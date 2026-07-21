import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { Bot, ImageAttachment } from "@maxhub/max-bot-api";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const CHAT_ID = Number(process.env.CHAT_ID || 0);

if (!BOT_TOKEN || !CHAT_ID) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: BOT_TOKEN или CHAT_ID не заданы в переменных окружения Render!");
}

const maxBot = new Bot(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

async function sendToMax(text, files = [], base64Images = []) {
    const attachments = [];

    if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                console.log(`[Multipart] Картинка #${i + 1} (${file.originalname}): загрузка буфера (${file.buffer.length} байт)...`);
                const uploadedImage = await maxBot.api.uploadImage({ source: file.buffer });
                console.log(`[Multipart] Картинка #${i + 1} ответ от MAX ->`, JSON.stringify(uploadedImage));

                if (uploadedImage) {
                    const fileId = uploadedImage.file_id || 
                                   uploadedImage.payload || 
                                   uploadedImage.id || 
                                   (uploadedImage.result && (uploadedImage.result.file_id || uploadedImage.result.payload));

                    if (fileId) {
                        const attachment = new ImageAttachment(fileId);
                        attachments.push(attachment.toJson ? attachment.toJson() : { type: "image", payload: fileId });
                    } else if (typeof uploadedImage === 'string') {
                        attachments.push({ type: "image", payload: uploadedImage });
                    } else {
                        attachments.push({ type: "image", payload: uploadedImage });
                    }
                }
            } catch (err) {
                console.error(`❌ Ошибка загрузки multipart картинки #${i + 1}:`, err);
            }
        }
    }

    if (base64Images && base64Images.length > 0) {
        for (let i = 0; i < base64Images.length; i++) {
            const img = base64Images[i];
            try {
                if (img.data && typeof img.data === 'string' && img.data.includes(",")) {
                    const base64Data = img.data.split(",")[1];
                    const buffer = Buffer.from(base64Data, "base64");

                    console.log(`[Base64] Картинка #${i + 1}: загрузка буфера (${buffer.length} байт)...`);
                    const uploadedImage = await maxBot.api.uploadImage({ source: buffer });
                    console.log(`[Base64] Картинка #${i + 1} ответ от MAX ->`, JSON.stringify(uploadedImage));

                    if (uploadedImage) {
                        const fileId = uploadedImage.file_id || 
                                       uploadedImage.payload || 
                                       uploadedImage.id || 
                                       (uploadedImage.result && (uploadedImage.result.file_id || uploadedImage.result.payload));

                        if (fileId) {
                            const attachment = new ImageAttachment(fileId);
                            attachments.push(attachment.toJson ? attachment.toJson() : { type: "image", payload: fileId });
                        } else if (typeof uploadedImage === 'string') {
                            attachments.push({ type: "image", payload: uploadedImage });
                        }
                    }
                }
            } catch (err) {
                console.error(`❌ Ошибка загрузки Base64 картинки #${i + 1}:`, err);
            }
        }
    }

    console.log("Итоговый текст поста:", text);
    console.log("Итоговый массив вложений:", JSON.stringify(attachments));

    const result = await maxBot.api.sendMessageToChat(
        CHAT_ID,
        text || "",
        attachments.length > 0 ? { attachments } : undefined
    );

    return result;
}

app.post("/publish-image", upload.array("images"), async (req, res) => {
    try {
        console.log("=== [POST /publish-image] ПОЛУЧЕН ЗАПРОС ===");
        const text = req.body.text || "";
        const files = req.files || [];
        
        await sendToMax(text, files, []);

        res.json({
            success: true,
            message: "Публикация с картинкой успешно отправлена в МАКС"
        });
    } catch (error) {
        console.error("❌ ОШИБКА НА СЕРВЕРЕ RENDER (/publish-image):", error);
        res.status(500).json({
            success: false,
            error: error.message || String(error)
        });
    }
});

app.post("/publish", async (req, res) => {
    try {
        console.log("=== [POST /publish] ПОЛУЧЕН ЗАПРОС ===");
        const post = req.body || {};
        const text = post.text || "";
        const images = post.images || [];

        await sendToMax(text, [], images);

        res.json({
            success: true,
            message: "Публикация успешно отправлена в МАКС"
        });
    } catch (error) {
        console.error("❌ ОШИБКА НА СЕРВЕРЕ RENDER (/publish):", error);
        res.status(500).json({
            size: error.message || String(error)
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`PostHub server started on port ${PORT}`);
});
