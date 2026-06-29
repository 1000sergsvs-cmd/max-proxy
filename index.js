const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const FormData = require('form-data');
const app = express();

// ================= НАСТРОЙКИ ДОСТУПА =================
const TG_BOT_TOKEN = "8223527991:AAG3wD26rOih0CRAtFW9_r7yhls_Ws42Goo";
const TG_CHAT_ID = "@sopelev_sergei";

const VK_ACCESS_TOKEN = "vk1.a.7qpgIH5rmzSmRqi75L0rvHzLGHQB_-7mS9l2ajQ9v4waNrvg9X69xgNi5VhqZN74mNOqpcxJau8FPy42EvUGpSf-Qu_EyXPxbzzV7dbOzUVj29yEXDgFA4VkBo-bHdwmydZcl69K1rroDMgfQy6orxjSJIblyO7cI9JhgltszPzhEAIpxCf5CamKkQCUATi7X1_K0sPy0PDgSQ50w6HLnA";
const VK_OWNER_ID = "-206615815";

const MAX_TOKEN = "f9LHodD0cOLjc6PWXm9X8_o89x3yepPLNK3WxQji9sO5K918rsPNifU9oNBmT0-oKjshxHH6tGSqgvFfUkbH";
const MAX_CHANNEL_ID = "-72415543328123";

// Ссылка на твою Google Таблицу, переведенная в формат веб-скрипта для планировщика
const GOOGLE_SCRIPT_GET_POSTS_URL = "https://script.google.com/macros/s/AKfycbytfoFYqjZQ2pRMWQ4fUeENS2ErnpL_5O8zKPeLVqAnxg4Xo1e-umzhRXJMp1h2bcvX/exec";
// =====================================================

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
app.use(express.json({ limit: '50mb' }));

// Функция публикации на платформы (вынесена отдельно, чтобы её вызывал и пульт, и планировщик)
async function publishPost({ text, imageData, imageName, imageType, targets }) {
    let cleanText = text.replace(/<\/?[^>]+(>|$)/g, ""); 
    const promises = [];
    const results = {};

    let imageBuffer = null;
    if (imageData) {
        const base64Data = imageData.split(",")[1] || imageData;
        imageBuffer = Buffer.from(base64Data, 'base64');
    }

    // 1. TELEGRAM
    if (targets && targets.telegram) {
        promises.push((async () => {
            try {
                if (imageBuffer) {
                    const formData = new FormData();
                    formData.append('chat_id', TG_CHAT_ID);
                    formData.append('caption', cleanText);
                    formData.append('photo', imageBuffer, { filename: imageName || 'photo.jpg' });
                    await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, formData, { headers: formData.getHeaders() });
                } else {
                    await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, { chat_id: TG_CHAT_ID, text: cleanText });
                }
                results.telegram = "Success";
            } catch (err) { results.telegram = "Error: " + err.message; }
        })());
    }

    // 2. ВКОНТАКТЕ
    if (targets && targets.vkontakte) {
        promises.push((async () => {
            try {
                let attachments = "";
                if (imageBuffer) {
                    const serverUrlRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, { params: { access_token: VK_ACCESS_TOKEN, v: "5.131" } });
                    const uploadUrl = serverUrlRes.data.response.upload_url;

                    const formData = new FormData();
                    formData.append('photo', imageBuffer, { filename: imageName || 'photo.jpg' });
                    const uploadRes = await axios.post(uploadUrl, formData, { headers: formData.getHeaders() });

                    const saveRes = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, {
                        params: { access_token: VK_ACCESS_TOKEN, server: uploadRes.data.server, photo: uploadRes.data.photo, hash: uploadRes.data.hash, v: "5.131" }
                    });
                    const photoMedia = saveRes.data.response[0];
                    attachments = `photo${photoMedia.owner_id}_${photoMedia.id}`;
                }
                await axios.get(`https://api.vk.com/method/wall.post`, {
                    params: { access_token: VK_ACCESS_TOKEN, owner_id: VK_OWNER_ID, message: cleanText, attachments: attachments || undefined, v: "5.131" }
                });
                results.vkontakte = "Success";
            } catch (err) { results.vkontakte = "Error: " + err.message; }
        })());
    }

    // 3. МАКС
    if (targets && targets.max) {
        promises.push((async () => {
            try {
                let attachments = [];
                if (imageBuffer) {
                    const initRes = await axios.post("https://platform-api2.max.ru/uploads?type=image", {}, { headers: { "Authorization": MAX_TOKEN } });
                    const targetUploadUrl = initRes.data.url;

                    const formData = new FormData();
                    formData.append('data', imageBuffer, { filename: imageName || 'photo.jpg', contentType: imageType || 'image/jpeg' });
                    const uploadRes = await axios.post(targetUploadUrl, formData, { headers: formData.getHeaders() });
                    
                    let imgToken = null;
                    if (uploadRes.data.token) imgToken = uploadRes.data.token;
                    else if (uploadRes.data.photos) {
                        let keys = Object.keys(uploadRes.data.photos);
                        if (keys.length > 0) imgToken = uploadRes.data.photos[keys[0]].token;
                    }
                    if (imgToken) attachments.push({ type: "image", payload: { token: imgToken } });
                }
                let finalPayload = { "text": cleanText };
                if (attachments.length > 0) finalPayload.attachments = attachments;

                await axios.post(`https://platform-api2.max.ru/messages?chat_id=${MAX_CHANNEL_ID}`, finalPayload, {
                    headers: { "Authorization": MAX_TOKEN, "Content-Type": "application/json" }
                });
                results.max = "Success";
            } catch (err) { results.max = "Error: " + err.message; }
        })());
    }

    await Promise.all(promises);
    return results;
}

// Маршрут для МГНОВЕННОЙ отправки с пульта
app.post('/api/publish', async (req, res) => {
    try {
        const { text, image, targets } = req.body;
        const results = await publishPost({
            text,
            imageData: image ? image.data : null,
            imageName: image ? image.name : null,
            imageType: image ? image.type : null,
            targets
        });
        res.json({ status: "Executed", details: results });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ================= АВТОМАТИЧЕСКИЙ ПЛАНИРОВЩИК (CRON) =================
// Запускается каждую минуту: проверяет, есть ли отложенные посты в таблице
cron.schedule('* * * * *', async () => {
    console.log("Проверка отложенных постов...");
    if (!GOOGLE_SCRIPT_GET_POSTS_URL || GOOGLE_SCRIPT_GET_POSTS_URL.includes("СЮДА_МЫ_ВСТАВИМ")) return;

    try {
        // Спрашиваем у Google Таблицы, есть ли пост на текущую минуту
        const response = await axios.get(GOOGLE_SCRIPT_GET_POSTS_URL);
        if (response.data && response.data.hasPost) {
            console.log("Обнаружен запланированный пост! Начинаем публикацию...");
            const report = await publishPost({
                text: response.data.text,
                imageData: response.data.imageData,
                imageName: response.data.imageName,
                imageType: response.data.imageType,
                targets: response.data.targets
            });
            console.log("Результат отложенной публикации:", report);
        }
    } catch (error) {
        console.error("Ошибка планировщика cron:", error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Professional Publisher with CRON running on port ${PORT}`));

