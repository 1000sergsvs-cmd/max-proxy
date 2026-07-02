const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Корневой адрес для проверки работоспособности
app.get('/', (req, res) => {
  res.send('Pult Postov Is Live and Proxy is Ready!');
});

// ТОТ САМЫЙ ПРОКСИ-МАРШРУТ, КОТОРЫЙ МЫ СЛУЧАЙНО СТЕРЛИ
app.post('/api/proxy', async (req, res) => {
  try {
    const { targetUrl, method, headers, body } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing targetUrl' });
    }

    console.log(`[Proxy] Направление запроса на: ${targetUrl}`);

    const config = {
      method: method || 'POST',
      url: targetUrl,
      headers: headers || {},
      data: body || null,
      timeout: 30000
    };

    const response = await axios(config);
    res.status(response.status).json(response.data);

  } catch (error) {
    console.error('[Proxy Error]:', error.message);
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).send(error.message);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
