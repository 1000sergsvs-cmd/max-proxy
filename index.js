const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Bot, ImageAttachment } = require("@maxhub/max-bot-api");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const CHAT_ID = Number(process.env.CHAT_ID || 0);

const maxBot = new Bot(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.post("/publish", async (req, res) => {
    try {
        console.log("=== [POST /publish] ПОЛУЧЕН ЗАПРОС ===");
        const post = req.body || {};
        const text = post.text || post.postText || "";
        const images = post.images || [];

        const attachments = [];

        if (Array.isArray(images) && images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                try {
                    let buffer = null;
                    if (img && typeof img.data === 'string' && img.data.includes(",")) {
                        buffer = Buffer.from(img.data.split(",")[1], "base64");
                    } else if (img && typeof img.data === 'string') {
                        buffer = Buffer.from(img.data, "base64");
                    }

                    if (buffer && buffer.length > 0) {
                        console.log(`Загрузка картинки #${i + 1} (${buffer.length} байт)...`);
                        
                        // Загружаем через SDK МАКС
                        const uploadedImage = await maxBot.api.uploadImage({ source: buffer });
                        console.log(`Ответ API МАКС для картинки #${i + 1}:`, JSON.stringify(uploadedImage));

                        if (uploadedImage) {
                            const fileId = uploadedImage.file_id || 
                                           uploadedImage.payload || 
                                           uploadedImage.id || 
                                           (uploadedImage.result && (uploadedImage.result.file_id || uploadedImage.result.payload));

                            if (fileId) {
                                attachments.push({ type: "image", payload: fileId });
                            } else if (typeof uploadedImage === 'string') {
                                attachments.push({ type: "image", payload: uploadedImage });
                            } else if (uploadedImage.body && uploadedImage.body.file_id) {
                                attachments.push({ type: "image", payload: uploadedImage.body.file_id });
                            }
                        }
                    }
                } catch (imgErr) {
                    console.error(`Ошибка обработки картинки #${i + 1}:`, imgErr.message);
                }
            }
        }

        console.log("Итоговый текст:", text);
        console.log("Итоговые вложения:", JSON.stringify(attachments));

        // Отправляем сообщение в чат
        const payloadToSend = { text: text };
        if (attachments.length > 0) {
            payloadToSend.attachments = attachments;
        }

        await maxBot.api.sendMessageToChat(
            CHAT_ID,
            text,
            attachments.length > 0 ? { attachments } : undefined
        );

        res.json({ success: true, message: "Публикация с картинкой успешно отправлена в МАКС!" });
    } catch (error) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА НА СЕРВЕРЕ:", error);
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
