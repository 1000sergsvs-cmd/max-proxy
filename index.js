const http = require('http');
const axios = require('axios');

// Тот самый надежный прокси-обработчик на базе axios
async function handleProxy(req, res) {
  let bodyChunks = [];
  
  req.on('data', (chunk) => {
    bodyChunks.push(chunk);
  }).on('end', async () => {
    try {
      const buffer = Buffer.concat(bodyChunks);
      const parsedData = JSON.parse(buffer.toString());
      const { targetUrl, method, headers, body } = parsedData;

      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing targetUrl' }));
      }

      console.log(`[Proxy] Направление запроса на: ${targetUrl}`);

      // Axios берет на себя всю работу с multipart и заголовками
      const response = await axios({
        method: method || 'POST',
        url: targetUrl,
        headers: headers || {},
        data: body || null,
        timeout: 30000,
        validateStatus: () => true // Пропускаем любые ответы МАКСа, не падая
      });

      res.writeHead(response.status, response.headers);
      
      // Отправляем ответ обратно в Google Таблицу
      if (typeof response.data === 'object') {
        res.end(JSON.stringify(response.data));
      } else {
        res.end(String(response.data));
      }

    } catch (e) {
      console.error('[Proxy Error]:', e.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Proxy internal error: ' + e.message);
    }
  });
}

const server = http.createServer((req, res) => {
  // Проверка связи
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Pult Postov Is Live and Proxy is Ready!');
  }

  // Маршрут прокси
  if (req.url === '/api/proxy' && req.method === 'POST') {
    return handleProxy(req, res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Сервер успешно запущен на порту ${PORT}`);
});
