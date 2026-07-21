import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { Bot } from "@maxhub/max-bot-api";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
dotenv.config();

const maxBot = new Bot(process.env.BOT_TOKEN!);
const CHAT_ID = Number(process.env.CHAT_ID);
const app = express();

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.post("/publish-image", upload.array("images", 10), async (req, res) => {
    try {
        const text = req.body.text || "";
        const files = req.files as Express.Multer.File[] || [];
        const attachments: any[] = [];

        console.log("=== НАЧАЛО ОБРАБОТКИ ФОРМАТА MULTIPART ===");
        console.log("Текст:", text);
        console.log("Количество файлов:", files.length);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                console.log(`Картинка #${i + 1}: загрузка буфера (${file.size} байт) через maxBot.api.uploadImage...`);
                const uploaded = await maxBot.api.uploadImage({
                    source: file.buffer
                });
                console.log(`Картинка #${i + 1}: успешно! Ответ:`, JSON.stringify(uploaded));

                if (uploaded) {
                    const payloadId = uploaded.payload || uploaded.file_id || uploaded.id || (uploaded.result && uploaded.result.payload);
                    attachments.push({
                        type: "image",
                        payload: payloadId || uploaded
                    });
                }
            } catch (imgErr) {
                console.error(`Ошибка при загрузке картинки #${i + 1}:`, imgErr);
            }
        }

        const result = await maxBot.api.sendMessageToChat(
            CHAT_ID,
            text,
            attachments.length > 0 ? { attachments } : undefined
        );

        console.log("Сообщение с картинками успешно отправлено в чат МАКС!");
        res.json({
            success: true,
            message: "Публикация успешно отправлена"
        });
    } catch (error) {
        console.error("ОШИБКА НА СЕРВЕРЕ RENDER:", error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

app.post("/publish", async (req, res) => {
    try {
        const post = req.body;
        const result = await maxBot.api.sendMessageToChat(
            CHAT_ID,
            post.text || ""
        );
        res.json({
            success: true,
            message: "Публикация успешно отправлена"
        });
    } catch (error) {
        console.error("ОШИБКА НА СЕРВЕРЕ RENDER:", error);
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
