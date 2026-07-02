const axios = require('axios');
const http = require('http');

const GOOGLE_SCRIPT_GET_POSTS_URL = "https://script.google.com/macros/s/AKfycbytfoFYqjZQ2pRMWQ4fUeENS2ErnpL_5O8zKPeLVqAnxg4Xo1e-umzhRXJMp1h2bcvX/exec?check=1";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
const VK_OWNER_ID = process.env.VK_OWNER_ID;
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;
const MAX_CHAT_ID = process.env.MAX_CHAT_ID;

async function checkAndPublish() {
  try {
    console.log("Проверяем наличие отложенных постов в Google Таблице...");
    
    const response = await axios.get(GOOGLE_SCRIPT_GET_POSTS_URL).catch(err => {
      console.log("Ошибка запроса к Google Таблице:", err.message);
      return null;
    });

    if (!response || !response.data) return;
    const data = response.data;

    if (!data || !data.hasPost) {
      console.log("Отложенных постов для публикации сейчас нет.");
      return;
    }

    const postText = data.text || "";
    const imageUrl = data.image || data.imageUrl || ""; 
    const channelsString = JSON.stringify(data.channels || data).toLowerCase();

    console.log(`Обнаружен пост: "${postText.substring(0, 30)}..."`);

    // 1. TELEGRAM (Изолированный блок)
    if (channelsString.includes("telegram")) {
      try {
        console.log("Отправка в Telegram...");
        if (imageUrl) {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            chat_id: TELEGRAM_CHAT_ID,
            photo: imageUrl,
            caption: postText
          });
        } else {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: postText
          });
        }
        console.log("Успешно отправлено в Telegram!");
      } catch (tgError) {
        console.log("Ошибка в Telegram (продолжаем работу):", tgError.message);
      }
    }

    // 2. ВКОНТАКТЕ (Изолированный блок)
    if (channelsString.includes("vkontakte")) {
      try {
        console.log("Отправка в VK...");
        const vkResponse = await axios.get(`https://api.vk.com/method/wall.post`, {
          params: {
            owner_id: `-${VK_OWNER_ID}`.replace('--', '-'),
            from_group: 1,
            message: postText,
            attachments: imageUrl,
            access_token: VK_ACCESS_TOKEN,
            v: "5.131"
          }
        });
        if (vkResponse.data && vkResponse.data.error) {
          console.log("VK API вернул ошибку:", vkResponse.data.error.error_msg);
        } else {
          console.log("Успешно отправлено в VK!");
        }
      } catch (vkError) {
        console.log("Ошибка в VK (продолжаем работу):", vkError.message);
      }
    }

    // 3. МЕССЕНДЖЕР МАКС (Изолированный блок)
    if (channelsString.includes("max")) {
      try {
        console.log("Отправка в мессенджер МАКС...");
        await axios.post(`https://api.max.ru/bot${MAX_BOT_TOKEN}/sendMessage`, {
          chat_id: MAX_CHAT_ID,
          text: postText,
          photo: imageUrl
        });
        console.log("Успешно отправлено в МАКС!");
      } catch (maxError) {
        console.log("Ошибка в МАКС (продолжаем работу):", maxError.message);
      }
    }

    // Финал функции: ошибки соцсетей выше перехвачены, поэтому мы СЮДА гарантированно дойдём
    console.log("Отправляем статус закрытия строки в Google Таблицу...");
    const targetId = data.rowIndex || data.id;
    
    await axios.post(GOOGLE_SCRIPT_GET_POSTS_URL, { id: targetId, status: "success" })
      .then(() => {
        console.log("Статус строки успешно обновлен в таблице.");
      })
      .catch((err) => {
        console.log("Не удалось обновить статус в таблице:", err.message);
      });

    console.log("Обработка строки завершена.");

  } catch (error) {
    console.log("Общая ошибка в checkAndPublish:", error.message);
  }
}

// Запуск раз в минуту
setInterval(checkAndPublish, 60000);

// Создаем простейший сервер для заглушки порта Render
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Proxy Server is running');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Прокси-сервер успешно запущен на порту ${PORT}...`);
  checkAndPublish();
});
