const http = require('http');
const https = require('https');

// Функция для обработки прокси-запросов (в МАКС)
function handleProxy(req, res) {
  let bodyChunks = [];
  
  req.on('data', (chunk) => {
    bodyChunks.push(chunk);
  }).on('end', () => {
    const buffer = Buffer.concat(bodyChunks);
    
    try {
      const parsedData = JSON.parse(buffer.toString());
      const { targetUrl, method, headers, body } = parsedData;

      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing targetUrl' }));
      }

      console.log(`[Proxy] Направление запроса на: ${targetUrl}`);

      const targetOptions = new URL(targetUrl);
      const options = {
        method: method || 'POST',
        hostname: targetOptions.hostname,
        path: targetOptions.pathname + targetOptions.search,
        headers: headers || {}
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let resChunks = [];
        proxyRes.on('data', (chunk) => resChunks.push(chunk));
        proxyRes.on('end', () => {
          const resBuffer = Buffer.concat(resChunks);
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          res.end(resBuffer);
        });
      });

      proxyReq.on('error', (err) => {
        console.error('[Proxy Request Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });

      if (body) {
        proxyReq.write(JSON.stringify(body));
      }
      proxyReq.end();

    } catch (e) {
      console.error('[Proxy Parsing Error]:', e.message);
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid JSON body');
    }
  });
}

// Создаем сервер
const server = http.createServer((req, res) => {
  // Маршрут для проверки работоспособности
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Pult Postov Is Live and Proxy is Ready!');
  }

  // Тот самый рабочий маршрут прокси
  if (req.url === '/api/proxy' && req.method === 'POST') {
    return handleProxy(req, res);
  }

  // Любой другой адрес
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Сервер успешно запущен на порту ${PORT}`);
});
