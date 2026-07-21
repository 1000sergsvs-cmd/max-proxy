import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Bot } from "@maxhub/max-bot-api";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
dotenv.config();

const maxBot = new Bot(process.env.BOT_TOKEN!);
const CHAT_ID = Number(process.env.CHAT_ID);
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Маршрут для обработки запросов от Google Apps Script (JSON с Base64 картинками)
app.post("/publish", async (req, res) => {
    try {
        const post = req.body;
        console.log("=== ОБРАБОТКА ПОСТА ИЗ GOOGLE APPS SCRIPT ===");
        console.log("Текст:", post.text || "");
        
        const images = post.images || [];
        console.log("Количество картинок в JSON:", images.length);

        const attachments: any[] = [];

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            try {
                if (img.data && typeof img.data === 'string' && img.data.includes(",")) {
                    // Извлекаем чистый Base64 буфер из строки data:image/...;base64,...
                    const base64Data = img.data.split(",")[1];
                    const buffer = Buffer.from(base64Data, "base64");

                    console.log(`Картинка #${i + 1}: загрузка буфера (${buffer.length} байт) через maxBot.api.uploadImage...`);

                    const uploaded = await maxBot.api.uploadImage({
                        source: buffer
                    });

                    console.log(`Картинка #${i + 1}: успешно! Ответ от МАКС:`, JSON.stringify(uploaded));

                    if (uploaded) {
                        const payloadId = uploaded.payload || uploaded.file_id || uploaded.id || (uploaded.result && (uploaded.result.payload || uploaded.result.file_id));
                        
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
                }
            } catch (imgErr) {
                console.error(`ОШИБКА при загрузке картинки #${i + 1}:`, imgErr);
            }
        }

        console.log("Итоговый массив вложений для отправки в МАКС:", JSON.stringify(attachments));

        const result = await maxBot.api.sendMessageToChat(
            CHAT_ID,
            post.text || "",
            attachments.length > 0 ? { attachments } : undefined
        );

        console.log("Сообщение успешно отправлено в чат МАКС! Ответ:", JSON.stringify(result));

        res.json({
            success: true,
            message: "Публикация успешно отправлена в МАКС"
        });
    } catch (error) {
        console.error("ОШИБКА НА СЕРВЕРЕ RENDER (/publish):", error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`PostHub server started on port ${PORT}`);
});
