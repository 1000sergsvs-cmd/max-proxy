import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { Bot } from "@maxhub/max-bot-api";
import fs from "fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

dotenv.config();
const maxBot = new Bot(
    process.env.BOT_TOKEN!
);

const CHAT_ID = Number(process.env.CHAT_ID);

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(
            null,
            path.join(__dirname, "../uploads")
        );
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    }
});

const upload = multer({
    storage
});

app.use(cors());
app.use(
    express.json({
        limit: "50mb"
    })
);

app.use(
    express.static(
        path.join(__dirname, "../public")
    )
);

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "../uploads")
    )
);

let currentPost = {
    text: "",
    images: []
};

app.post(
    "/api/upload",
    upload.array("images", 10),
    (req, res)=>{
        const files = req.files as Express.Multer.File[];
        const images = files.map(file=>({
            url: `/uploads/${file.filename}`
        }));
        res.json({
            success: true,
            images
        });
    }
);

app.get("/api/post", (req, res)=>{
    res.json(currentPost);
});

app.post("/api/post", (req, res)=>{
    const post = req.body;
    if(
        typeof post.text !== "string" ||
        !Array.isArray(post.images)
    ){
        return res.status(400).json({
            error: "Неверный формат поста"
        });
    }

    if(post.images.length > 10){
        return res.status(400).json({
            error: "Максимум 10 изображений"
        });
    }

    currentPost = {
        text: post.text,
        images: post.images
    };

    res.json({
        success: true,
        post: currentPost
    });
});

app.post("/publish", async (req, res)=>{
    try {
        const post = req.body;
        const attachments: any[] = [];

        if (post.images && Array.isArray(post.images)) {
            for (const image of post.images) {
                let uploaded;

                // Проверяем, передана ли картинка в формате Base64 (data:image/...)
                if (image.data && image.data.startsWith("data:image")) {
                    console.log("Обработка Base64 изображения...");
                    const matches = image.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        const buffer = Buffer.from(matches[2], 'base64');
                        uploaded = await maxBot.api.uploadImage({
                            source: buffer
                        });
                    }
                } 
                // Стандартная обработка по URL
                else if (image.url && image.url.startsWith("http")) {
                    uploaded = await maxBot.api.uploadImage({
                        url: image.url
                    });
                } 
                // Обработка локального файла
                else if (image.url) {
                    const filePath = path.join(
                        __dirname,
                        "..",
                        image.url
                    );
                    const fileBuffer = fs.readFileSync(filePath);
                    uploaded = await maxBot.api.uploadImage({
                        source: fileBuffer
                    });
                }

                if (uploaded && uploaded.payload) {
                    const attachment = {
                        type: "image",
                        payload: uploaded.payload
                    };
                    attachments.push(attachment);
                }
            }
        }

        const result = await maxBot.api.sendMessageToChat(
            CHAT_ID,
            post.text || "",
            {
                attachments
            }
        );

        res.json({
            success: true,
            result
        });
    }
    catch(error){
        console.error("Ошибка публикации:", error);
        res.status(500).json({
            success: false,
            error: String(error)
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(
    PORT,
    ()=>{
        console.log(
            `PostHub server started on port ${PORT}`
        );
    }
);
