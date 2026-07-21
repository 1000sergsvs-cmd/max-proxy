import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHAT_ID = Number(process.env.CHAT_ID);
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

                    console.log(`Картинка #${i + 1}: буфер создан, размер = ${buffer.length} байт`);

                    // Используем прямой multipart-запрос к официальному API загрузки файлов MAX
                    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
                    let headerBuffer = Buffer.from(
                        `--${boundary}\r\n` +
                        `Content-Disposition: form-data; name="file"; filename="${img.name || `image_${i}.jpg`}"\r\n` +
                        `Content-Type: image/jpeg\r\n\r\n`,
                        "utf-8"
                    );
                    let footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");
                    let multipartBody = Buffer.concat([headerBuffer, buffer, footerBuffer]);

                    const uploadRes = await fetch("https://platform-api.max.ru/files?type=image", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${BOT_TOKEN}`,
                            "Content-Type": `multipart/form-data; boundary=${boundary}`
                        },
                        body: multipartBody
                    });

                    const uploadText = await uploadRes.text();
                    console.log(`Картинка #${i + 1}: статус загрузки -> ${uploadRes.status}, ответ -> ${uploadText}`);

                    if (uploadRes.ok) {
                        try {
                            const uploadJson: any = JSON.parse(uploadText);
                            const fileId = uploadJson.file_id || uploadJson.payload || uploadJson.id || uploadJson.result?.file_id;
                            if (fileId) {
                                attachments.push({
                                    type: "image",
                                    payload: fileId
                                });
                                console.log(`Картинка #${i + 1}: успешно добавлена с ID: ${fileId}`);
                            }
                        } catch (parseErr) {
                            console.error(`Ошибка парсинга ответа загрузки картинки #${i + 1}:`, parseErr);
                        }
                    }
                }
            } catch (imgErr) {
                console.error(`❌ ОШИБКА при загрузке картинки #${i + 1}:`, imgErr);
            }
        }

        console.log("Итоговый массив вложений для отправки в МАКС:", JSON.stringify(attachments));

        const sendMessageRes = await fetch(`https://platform-api.max.ru/chats/${CHAT_ID}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${BOT_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: post.text || "",
                attachments: attachments.length > 0 ? attachments : undefined
            })
        });

        const sendResultText = await sendMessageRes.text();
        console.log(`✅ Ответ отправки сообщения в МАКС -> Статус: ${sendMessageRes.status}, Ответ: ${sendResultText}`);

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
