import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Bot, ImageAttachment } from "@maxhub/max-bot-api";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHAT_ID = Number(process.env.CHAT_ID);
const maxBot = new Bot(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.post("/publish", async (req, res) => {
    try {
        const post = req.body;
        console.log("=== [JSON /publish] ПОЛУЧЕН ЗАПРОС ИЗ GOOGLE APPS SCRIPT ===");
        console.log("Текст поста:", post.text || "");
        
        const images = post.images || [];
        console.log("Количество картинок в JSON:", images.length);

        const attachments: any[] = [];

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            try {
                if (img.data && typeof img.data === 'string' && img.data.includes(",")) {
                    const base64Data = img.data.split(",")[1];
                    const buffer = Buffer.from(base64Data, "base64");

                    console.log(`Картинка #${i + 1}: загрузка через maxBot.api.uploadImage, размер = ${buffer.length} байт`);

                    // Используем штатный метод SDK для загрузки изображения из буфера
                    const uploadedImage = await maxBot.api.uploadImage({
                        source: buffer
                    });

                    console.log(`Картинка #${i + 1}: ответ от API MAX ->`, JSON.stringify(uploadedImage));

                    if (uploadedImage) {
                        // Извлекаем file_id или payload из ответа
                        const fileId = (uploadedImage as any).file_id || 
                                       (uploadedImage as any).payload || 
                                       (uploadedImage as any).id || 
                                       ((uploadedImage as any).result && ((uploadedImage as any).result.file_id || (uploadedImage as any).result.payload));

                        if (fileId) {
                            // Создаем вложение с помощью официального класса ImageAttachment или объекта
                            const attachment = new ImageAttachment(fileId);
                            attachments.push(attachment.toJson ? attachment.toJson() : { type: "image", payload: fileId });
                            console.log(`Картинка #${i + 1}: успешно добавлена с ID: ${fileId}`);
                        } else if (typeof uploadedImage === 'string') {
                            attachments.push({ type: "image", payload: uploadedImage });
                            console.log(`Картинка #${i + 1}: успешно добавлена (строковый ID): ${uploadedImage}`);
                        }
                    }
                }
            } catch (imgErr) {
                console.error(`❌ ОШИБКА при загрузке картинки #${i + 1}:`, imgErr);
            }
        }

        console.log("Итоговый массив вложений для отправки в МАКС:", JSON.stringify(attachments));

        // Отправляем сообщение в чат с вложениями (если они есть)
        const sendMessagePayload: any = {
            text: post.text || ""
        };

        if (attachments.length > 0) {
            sendMessagePayload.attachments = attachments;
        }

        const result = await maxBot.api.sendMessageToChat(
            CHAT_ID,
            post.text || "",
            attachments.length > 0 ? { attachments } : undefined
        );

        console.log(`✅ Сообщение успешно отправлено в чат МАКС! Ответ:`, JSON.stringify(result));

        res.json({
            success: true,
            message: "Публикация успешно отправлена в МАКС"
        });
    } catch (error) {
        console.error("❌ ОШИБКА НА СЕРВЕРЕ RENDER (/publish):", error);
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
