import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
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

// Настройка multer для приема multipart/form-data в памяти
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // до 50MB
});

app.post("/publish-image", upload.array("images"), async (req, res) => {
    try {
        console.log("=== [MULTIPART /publish-image] ПОЛУЧЕН ЗАПРОС ===");
        const text = req.body.text || "";
        const files = req.files as Express.Multer.File[] || [];
        
        console.log("Текст поста:", text);
        console.log("Количество файлов (картинок):", files.length);

        const attachments: any[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                console.log(`Картинка #${i + 1} (${file.originalname}): загрузка буфера (${file.buffer.length} байт) через maxBot.api.uploadImage...`);

                const uploadedImage = await maxBot.api.uploadImage({
                    source: file.buffer
                });

                console.log(`Картинка #${i + 1}: ответ от API MAX ->`, JSON.stringify(uploadedImage));

                if (uploadedImage) {
                    const fileId = (uploadedImage as any).file_id || 
                                   (uploadedImage as any).payload || 
                                   (uploadedImage as any).id || 
                                   ((uploadedImage as any).result && ((uploadedImage as any).result.file_id || (uploadedImage as any).result.payload));

                    if (fileId) {
                        const attachment = new ImageAttachment(fileId);
                        attachments.push(attachment.toJson ? attachment.toJson() : { type: "image", payload: fileId });
                        console.log(`Картинка #${i + 1}: успешно добавлена с ID: ${fileId}`);
                    } else if (typeof uploadedImage === 'string') {
                        attachments.push({ type: "image", payload: uploadedImage });
                        console.log(`Картинка #${i + 1}: успешно добавлена (строковый ID): ${uploadedImage}`);
                    } else {
                        attachments.push({ type: "image", payload: uploadedImage });
                    }
                }
            } catch (imgErr) {
                console.error(`❌ ОШИБКА при загрузке картинки #${i + 1}:`, imgErr);
            }
        }

        console.log("Итоговый массив вложений для отправки в МАКС:", JSON.stringify(attachments));

        const result = await maxBot.api.sendMessageToChat(
            CHAT_ID,
            text,
            attachments.length > 0 ? { attachments } : undefined
        );

        console.log("✅ Сообщение с картинкой успешно отправлено в МАКС! Ответ:", JSON.stringify(result));

        res.json({
            success: true,
            message: "Публикация с картинкой успешно отправлена в МАКС"
        });
    } catch (error: any) {
        console.error("❌ ОШИБКА НА СЕРВЕРЕ RENDER (/publish-image):", error);
        res.status(500).json({
            success: false,
            error: error.message || String(error)
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`PostHub server started on port ${PORT}`);
});
