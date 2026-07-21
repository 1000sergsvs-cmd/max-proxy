var MAX_PROXY_BASE = "https://max-proxy-bdw6.onrender.com";

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index.html')
    .setTitle('Пульт управления публикациями')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function publishPostFromWeb(payload) {
  try {
    let results = [];
    
    // Если выбран МАКС, отправляем пост (с текстом и картинками) в формате JSON
    if (payload.targetMAX) {
      sendToMaxAsJson(payload.postText, payload.images || []);
      results.push("МАКС: Успешно");
    }
    
    return {
      success: true,
      message: "Успешно опубликовано:\n" + results.join("\n")
    };
  } catch (e) {
    return {
      success: false,
      message: "Ошибка публикации: " + e.message
    };
  }
}

function sendToMaxAsJson(text, images) {
  let url = MAX_PROXY_BASE + "/publish";
  
  let data = {
    text: text || "",
    images: images || []
  };

  let options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };

  Logger.log("Отправка в МАКС через JSON (/publish)...");
  let response = UrlFetchApp.fetch(url, options);
  let responseCode = response.getResponseCode();
  let responseText = response.getContentText();

  Logger.log("ОТВЕТ ОТ RENDER -> Код: " + responseCode + ", Текст: " + responseText);

  if (responseCode !== 200) {
    throw new Error("HTTP " + responseCode + ": " + responseText);
  }

  return true;
}
