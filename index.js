const express = require('express');
const axios = require('axios');
const app = express();

// Полное игнорирование капризов SSL-сертификатов (включая Минцифры)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.use(express.json({ limit: '50mb' }));

app.post('/api/proxy', async (req, res) => {
    try {
        const { targetUrl, method, headers, body } = req.body;

        if (!targetUrl) {
            return res.status(400).json({ error: "Missing targetUrl" });
        }

        const response = await axios({
            url: targetUrl,
            method: method || 'POST',
            headers: headers || {},
            data: body || undefined,
            timeout: 30000,
            validateStatus: () => true 
        });

        res.status(response.status).json(response.data);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = app;
