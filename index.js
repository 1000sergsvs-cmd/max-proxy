const axios = require('axios');
const http = require('http');
const FormData = require('form-data');

const GOOGLE_SCRIPT_GET_POSTS_URL = "https://script.google.com/macros/s/AKfycbytfoFYqjZQ2pRMWQ4fUeENS2ErnpL_5O8zKPeLVqAnxg4Xo1e-umzhRXJMp1h2bcvX/exec?check=1";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
const VK_OWNER_ID = process.env.VK_OWNER_ID;
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;
const MAX_CHAT_ID = process.env.MAX_CHAT_ID;

function base64ToBuffer(base64String) {
  if (!base64String || !base64String.includes('base64,')) return null;
  const base64Data = base64String.split('base64,')[1];
  return Buffer.from(base64Data, 'base64');
}

async function checkAndPublish() {
  try {
    console.log("Проверяем наличие отложенных постов в Google Таблице...");
    
    const response = await axios.get(GOOGLE_SCRIPT_GET_POSTS_URL).catch(err => {
      console.log("Ошибка запроса к Google Таблице:", err.message);
      return null;
    });

    if (!response || !response.data) return;
    const data = response.data;

    if (!data || !data.hasPost) {
      console.log("Отложенных постов для публикации сейчас нет.");
      return;
    }

    // Как только мы попали сюда, в таблице эта строка УЖЕ переведена в статус "Опубликовано"
    const postText = data.text || "";
    const rawImage = data.image || data.imageUrl || ""; 
    let channelsString = "";
    try {
      channelsString = typeof data.channels === 'string' ? data.channels.toLowerCase() : JSON.stringify(data.channels).toLowerCase();
    } catch(e) {
      channelsString = String(data.channels).toLowerCase();
    }

    console.log(`Обнаружен пост: "${postText.substring(0, 30)}..."`);
    const imageBuffer = base64ToBuffer(rawImage);

    // 1. TELEGRAM
    if (channelsString.includes("telegram")) {
      try {
        console.log("Отправка в Telegram...");
        if (imageBuffer) {
          const form = new FormData();
          form.append('chat_id', TELEGRAM_CHAT_ID);
          form.append('caption', postText);
          form.append('photo', imageBuffer, { filename: 'image.jpg' });

          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, form, {
            headers: form.getHeaders()
          });
        } else {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: postText
          });
        }
        console.log("Успешно отправлено в Telegram!");
      } catch (tgError) {
        console.log("Ошибка в Telegram:", tgError.response ? JSON.stringify(tgError.response.data) : tgError.message);
      }
    }

    // 2. ВКОНТАКТЕ
    if (channelsString.includes("vkontakte")) {
      try {
        console.log("Отправка в VK...");
        if (imageBuffer) {
          const serverUrlRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, {
            params: { group_id: VK_OWNER_ID, access_token: VK_ACCESS_TOKEN, v: "5.131" }
          });
          
          const uploadServerUrl = serverUrlRes.data?.response?.upload_url;
          
          if (uploadServerUrl) {
            const form = new FormData();
            form.append('photo', imageBuffer, { filename: 'image.jpg' });
            
            const uploadRes = await axios.post(uploadServerUrl, form, { headers: form.getHeaders() });
            
            const savePhotoRes = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, {
              params: {
                group_id: VK_OWNER_ID,
                photo: uploadRes.data.photo,
                server: uploadRes.data.server,
                hash: uploadRes.data.hash,
                access_token: VK_ACCESS_TOKEN,
                v: "5.131"
              }
            });

            const photoInfo = savePhotoRes.data?.response?.[0];
            if (photoInfo) {
              const attachmentString = `photo${photoInfo.owner_id}_${photoInfo.id}`;
              
              await axios.get(`https://api.vk.com/method/wall.post`, {
                params: {
                  owner_id: `-${VK_OWNER_ID}`.replace('--', '-'),
                  from_group: 1,
                  message: postText,
                  attachments: attachmentString,
                  access_token: VK_ACCESS_TOKEN,
                  v: "5.131"
                }
              });
              console.log("Успешно отправлено в VK с картинкой!");
            }
          }
        } else {
          await axios.get(`https://api.vk.com/method/wall.post`, {
            params: {
              owner_id: `-${VK_OWNER_ID}`.replace('--', '-'),
              from_group: 1,
              message: postText,
              access_token: VK_ACCESS_TOKEN,
              v: "5.131"
            }
          });
          console.log("Успешно отправлено в VK (только текст)!");
        }
      } catch (vkError) {
        console.log("Ошибка в VK:", vkError.message);
      }
    }

    // 3. МЕССЕНДЖЕР МАКС
    if (channelsString.includes("max")) {
      try {
        console.log("Отправка в мессенджер МАКС...");
        // В вашем скрипте МАКС работает через прокси-урл "https://max-proxy-ifk0.onrender.com/api/proxy"
        // Но так как этот код сейчас выполняется внутри самого Рендера, шлем запрос на базовый адрес МАКСа:
        await axios.post(`https://api.max.ru/bot${MAX_BOT_TOKEN}/sendMessage`, {
          chat_id: MAX_CHAT_ID,
          text: postText
        });
        console.log("Успешно отправлено в МАКС!");
      } catch (maxError) {
        console.log("Ошибка в МАКС:", maxError.message);
      }
    }

    console.log("Обработка строки завершена. Повторы исключены.");

  } catch (error) {
    console.log("Общая ошибка в checkAndPublish:", error.message);
  }
}

// Запуск раз в минуту
setInterval(checkAndPublish, 60000);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Pult Postov Is Live');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}...`);
  checkAndPublish();
});
