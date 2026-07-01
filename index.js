const axios = require('axios');
const FormData = require('form-data');

const GOOGLE_SCRIPT_GET_POSTS_URL = "https://script.google.com/macros/s/AKfcybytdfOFm_N8k87NnN_vNz3q9Y-nO6yK6B_N4_R7Q_v7A/exec"; // Твой URL из скрипта таблицы

// Токены и ID из настроек (Render подтянет их из Environment Variables)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
const VK_OWNER_ID = process.env.VK_OWNER_ID;
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;
const MAX_CHAT_ID = process.env.MAX_CHAT_ID;

async function checkAndPublish() {
  try {
    console.log("Проверяем наличие отложенных постов в Google Таблице...");
    const response = await axios.get(GOOGLE_SCRIPT_GET_POSTS_URL);
    const data = response.data;

    if (!data || !data.hasPost) {
      console.log("Отложенных постов для публикации сейчас нет.");
      return;
    }

    console.log(`Обнаружен пост для публикации: "${data.text ? data.text.substring(0, 30) : 'Без текста'}..."`);

    // 1. ОТПРАВКА В TELEGRAM
    if (data.channels && data.channels.telegram) {
      try {
        console.log("Отправка в Telegram запущена...");
        if (data.imageUrl) {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            chat_id: TELEGRAM_CHAT_ID,
            photo: data.imageUrl,
            caption: data.text
          });
        } else {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: data.text
          });
        }
        console.log("Успешно отправлено в Telegram!");
      } catch (tgError) {
        console.error("Ошибка отправки в Telegram:", tgError.response ? tgError.response.data : tgError.message);
      }
    }

    // 2. ОТПРАВКА В ВКОНТАКТЕ
    if (data.channels && data.channels.vkontakte) {
      try {
        console.log("Отправка в VK запущена...");
        // Публикация на стену (с картинкой, если есть)
        let attachments = "";
        if (data.imageUrl) {
          // Для простоты передаем картинку как ссылку, если у тебя настроен импорт ссылок в ВК, 
          // либо отправляем чистый текст. Попробуем прямую публикацию текста + ссылка на фото
          attachments = data.imageUrl;
        }

        const vkResponse = await axios.get(`https://api.vk.com/method/wall.post`, {
          params: {
            owner_id: `-${VK_OWNER_ID}`.replace('--', '-'), // Защита от двойного минуса
            from_group: 1,
            message: data.text,
            attachments: attachments,
            access_token: VK_ACCESS_TOKEN,
            v: "5.131"
          }
        });

        if (vkResponse.data.error) {
          console.error("VK API вернул ошибку:", vkResponse.data.error);
        } else {
          console.log("Успешно отправлено в VK! ID поста:", vkResponse.data.response.post_id);
        }
      } catch (vkError) {
        console.error("Системная ошибка при отправке в VK:", vkError.message);
      }
    }

    // 3. ОТПРАВКА В МЕССЕНДЖЕР МАКС
    if (data.channels && data.channels.max) {
      try {
        console.log("Отправка в мессенджер МАКС запущена...");
        // Отправляем запрос в Bot API Макса
        await axios.post(`https://api.max.ru/bot${MAX_BOT_TOKEN}/sendMessage`, {
          chat_id: MAX_CHAT_ID,
          text: data.text,
          photo: data.imageUrl // Если API поддерживает отправку фото в этом же запросе
        });
        console.log("Успешно отправлено в мессенджер МАКС!");
      } catch (maxError) {
        console.error("Ошибка отправки в МАКС:", maxError.response ? maxError.response.data : maxError.message);
      }
    }

    // Оповещаем таблицу, что обработка завершена
    await axios.post(GOOGLE_SCRIPT_GET_POSTS_URL, { id: data.id, status: "success" });
    console.log("Обработка поста успешно завершена.");

  } catch (error) {
    console.error("Глобальная ошибка в процессе проверки:", error.message);
  }
}

// Запуск проверки каждые 60 секунд
setInterval(checkAndPublish, 60000);

// Поддержка порта для Render
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Proxy is running...'));
app.listen(process.env.PORT || 10000, () => console.log(`Сервер слушает порт ${process.env.PORT || 10000}`));
