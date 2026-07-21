const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const CHAT_ID = Number(process.env.CHAT_ID || 0);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.post("/publish", async (req, res) => {
    try {
        console.log("=== [POST /publish] ПОЛУЧЕН ЗАПРОС ===");
        const post = req.body || {};
        const text = post.text || "";
        const images = post.images || [];

        console.log("Текст:", text);
        console.log("Количество картинок:", images.length);

        const attachments = [];

        // Загружаем картинки напрямую через REST API МАКС без падений SDK
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            if (img.data && typeof img.data === 'string' && img.data.includes(",")) {
                try {
                    const base64Data = img.data.split(",")[1];
                    const buffer = Buffer.from(base64Data, "base64");

                    console.log(`Загрузка картинки #${i + 1} (${buffer.length} байт)...`);
                    
                    const uploadRes = await fetch(`https://api.max.ru/v1/bots/${BOT_TOKEN}/images/upload`, {
                        method: "POST",
                        headers: { "Content-Type": "application/octet-stream" },
                        body: buffer
                    });

                    if (uploadRes.ok) {
                        const uploadJson = await uploadRes.json();
                        console.log(`Ответ загрузки картинки #${i + 1}:`, uploadJson);
                        const fileId = uploadJson.file_id || uploadJson.payload || uploadJson.id;
                        if (fileId) {
                            attachments.push({ type: "image", payload: fileId });
                        }
                    } else {
                        console.error(`Ошибка загрузки картинки #${i + 1}: HTTP`, uploadRes.status);
                    }
                } catch (imgErr) {
                    console.error(`Ошибка обработки картинки #${i + 1}:`, imgErr.message);
                }
            }
        }

        // Отправляем сообщение в чат
        console.log("Отправка сообщения в чат МАКС...");
        const sendPayload = { text: text };
        if (attachments.length > 0) {
            sendPayload.attachments = attachments;
        }

        const sendRes = await fetch(`https://api.max.ru/v1/bots/${BOT_TOKEN}/chats/${CHAT_ID}/messages`, {
            text: text,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sendPayload)
        });

        const sendJson = await sendRes.json();
        console.log("Результат отправки в МАКС:", sendJson);

        res.json({
            success: true,
            message: "Публикация успешно отправлена в МАКС"
        });
    } catch (error) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА НА СЕРВЕРЕ:", error);
        res.status(500).json({
            success: false,
            error: error.message || String(error)
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
