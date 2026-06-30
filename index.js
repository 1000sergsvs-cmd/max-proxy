const axios = require('axios');
const FormData = require('form-data');

const GOOGLE_SCRIPT_GET_POSTS_URL = "https://script.google.com/macros/s/AKfycbytfoFYqjZQ2pRMWQ4fUeENS2ErnpL_5O8zKPeLVqAnxg4Xo1e-umzhRXJMp1h2bcvX/exec?check=1";

// Токены и ID из настроек (Render подтянет их из Environment Variables)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
const VK_OWNER_ID = process.env.VK_OWNER_ID;

async function checkAndPublish() {
  try {
    console.log("Проверяем наличие отложенных постов в Google Таблице...");
    const response = await axios.get(GOOGLE_SCRIPT_GET_POSTS_URL);
    const data = response.data;

    if (!data || !data.hasPost) {
      console.log("Отложенных постов для публикации сейчас нет.");
      return;
    }

    console.log("Обнаружен пост для публикации:", data.text ? data.text.substring(0, 30) + "..." : "Без текста");
    
    // Логика отправки (ТГ / ВК) в зависимости от data.targets
    if (data.targets && data.targets.telegram) {
      await sendToTelegram(data.text, data.imageData, data.imageName, data.imageType);
    }
    if (data.targets && data.targets.vkontakte) {
      await sendToVK(data.text, data.imageData, data.imageName, data.imageType);
    }

    console.log("Обработка поста успешно завершена.");
  } catch (error) {
    console.error("Ошибка в цикле проверки:", error.message);
  }
}

async function sendToTelegram(text, base64Img, fileName, fileType) {
  try {
    if (base64Img) {
      console.log("Отправляем пост с картинкой в Telegram...");
      const base64Data = base64Img.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      
      const form = new FormData();
      form.append('chat_id', TELEGRAM_CHAT_ID);
      form.append('caption', text || "");
      form.append('photo', buffer, { filename: fileName || 'photo.jpg', contentType: fileType || 'image/jpeg' });

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, form, {
        headers: form.getHeaders()
      });
    } else {
      console.log("Отправляем текстовый пост в Telegram...");
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: text
      });
    }
    console.log("Успешно отправлено в Telegram!");
  } catch (err) {
    console.error("Ошибка отправки в Telegram:", err.message);
  }
}

async function sendToVK(text, base64Img, fileName, fileType) {
  // Базовая заглушка/логика для ВК, если используется
  try {
    console.log("Отправка в VK запущена...");
    // Твоя рабочая логика ВК...
  } catch (err) {
    console.error("Ошибка отправки в VK:", err.message);
  }
}

// Запуск проверки раз в минуту (для режима Web Service)
setInterval(checkAndPublish, 60000);
// Первый запуск при старте сервера
checkAndPublish();

// Простейший HTTP сервер, чтобы Render не закрывал Web Service по таймауту
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Max-Proxy Proxy Server is running...\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер слушает порт ${PORT}`);
});
