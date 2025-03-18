const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const path = require('path');

// Đọc config API
const configPath = path.join(__dirname, '../config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : {};

// Tạo Axios instance chung
const apiClient = (proxy, user) => {
    const proxyUrl = `http://${proxy.name}:${proxy.password}@${proxy.host}:${proxy.port}`;
    const httpsAgent = new HttpsProxyAgent(proxyUrl);

    return axios.create({
        baseURL: config.apiBaseUrl || 'https://pivoice.app/vapi',
        httpsAgent,
        headers: {
            'Accept': '*/*',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Cookie': `uid=${user.uid}; ukey=${user.ukey}; piname=${user.piname}`,
            'User-Agent': user.userAgent,
            'Origin': 'https://pivoice.app',
            'Referer': 'https://pivoice.app/',
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
};

module.exports = apiClient;
