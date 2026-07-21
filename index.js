import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Bot } from "@maxhub/max-bot-api";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

dotenv.config();
const maxBot = new Bot(
    process.env.BOT_TOKEN!
);

const CHAT_ID = Number(process.env.CHAT_ID);
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.post("/publish", async (req, res) => {
    try {
        const post = req.body;
        const attachments: any[] = [];

        console.log("=== НАЧАЛО ОБРАБОТКИ ПОСТА ===");
        console.log("Текст:", post.text);
        console.log("Количество картинок в запросе:", post.images ? post.images.length : 0);

        if (post.images && Array.isArray(post.images)) {
            for (let i = 0; i < post.images.length; i++) {
                const image = post.images[i];
                let uploaded;

                try {
                    if (image.data && image.data.startsWith("data:image")) {
                        console.log(`Картинка #${i + 1}: обнаружен Base64, декодируем...`);
                        const matches = image.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                        if (matches && matches.length === 3) {
                            const buffer = Buffer.from(matches[2], 'base64');
                            console.log(`Картинка #${i + 1}: буфер создан, размер ${buffer.length} байт. Вызываем maxBot.api.uploadImage...`);
                            
                            uploaded = await maxBot.api.uploadImage({
                                source: buffer
                            });
                            console.log(`Картинка #${i + 1}: успешно загружена! Ответ от MAX API:`, JSON.stringify(uploaded));
                        } else {
                            console.log(`Картинка #${i + 1}: ошибка парсинга Base64`);
                        }
                    } else if (image.url && image.url.startsWith("http")) {
                        console.log(`Картинка #${i + 1}: загрузка по URL: ${image.url}`);
                        uploaded = await maxBot.api.uploadImage({
                            url: image.url
                        });
                    }

                    if (uploaded) {
                        const payloadId = uploaded.payload || uploaded.file_id || uploaded.id || (uploaded.result && uploaded.result.payload);
                        if (payloadId) {
                            attachments.push({
                                type: "image",
                                payload: payloadId
                            });
                        } else {
                            attachments.push({
                                type: "image",
                                payload: uploaded
                            });
                        }
                    }
                } catch (imgErr) {
                    console.error(`КРИТИЧЕСКАЯ ОШИБКА при загрузке картинки #${i + 1}:`, imgErr);
                }
            }
        }

        console.log(`Всего вложений готово к отправке: ${attachments.length}`);

        const result = await maxBot.api.sendMessageToChat(
            CHAT_ID,
            post.text || "",
            attachments.length > 0 ? { attachments } : undefined
        );

        console.log("Сообщение успешно отправлено в чат МАКС!");
        res.json({
            success: true,
            message: "Публикация успешно отправлена с " + attachments.length + " вложениями",
            result
        });
    }
    catch (error) {
        console.error("ОШИБКА НА СЕРВЕРЕ RENDER:", error);
        res.status(500).json({
            success: false,
            message: "Ошибка сервера: " + String(error)
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`PostHub server started on port ${PORT}`);
});
