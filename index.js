const axios = require('axios');
const fs = require('fs');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { HttpsProxyAgent } = require('https-proxy-agent');

const USERS_FILE = 'users.json';
const PROXIES_FILE = 'proxies.json';
const USER_AGENTS_FILE = 'user_agents.json';
const COMMENTS_FILE = 'comments.json';
const TITLES_FILE = 'titles.json';
const CONTENTS_FILE = 'contents.json';

const MAX_CONCURRENT_WORKERS = os.cpus().length * 2;
let activeWorkers = 0;
const workerQueue = [];

if (isMainThread) {
    main();
} else {
    runWorker(workerData);
}

function main() {
    console.log("\n Auto Request Tool - Chạy SLL với Proxy và User-Agent 🔥\n");

    const users = readJSON(USERS_FILE);
    const proxies = readJSON(PROXIES_FILE);
    const userAgents = readJSON(USER_AGENTS_FILE);
    const comments = readJSON(COMMENTS_FILE);
    const titles = readJSON(TITLES_FILE);
    const contents = readJSON(CONTENTS_FILE);

    if (users.length === 0 || proxies.length === 0 || userAgents.length === 0 || comments.length === 0 || titles.length === 0 || contents.length === 0) {
        console.log(" Lỗi: Một trong các file dữ liệu trống!\n");
        return;
    }

    console.log(` Đang chạy ${users.length} user với ${proxies.length} proxy và ${userAgents.length} User-Agent...\n`);

    users.forEach((user, index) => {
        const proxy = proxies[index % proxies.length];
        const userAgent = userAgents[index % userAgents.length];
        workerQueue.push({ user, proxy, userAgent, comments, titles, contents });
    });

    processQueue();
}

function processQueue() {
    while (activeWorkers < MAX_CONCURRENT_WORKERS && workerQueue.length > 0) {
        const workerData = workerQueue.shift();
        activeWorkers++;
        const worker = new Worker(__filename, { workerData });

        worker.on('exit', () => {
            activeWorkers--;
            processQueue();
        });

        worker.on('error', (err) => {
            console.error(` Lỗi Worker: ${err.message}`);
            activeWorkers--;
            processQueue();
        });
    }
}

async function runWorker({ user, proxy, userAgent, comments, titles, contents }) {
    const { uid, ukey, piname } = user;
    const proxyUrl = `http://${proxy.name}:${proxy.password}@${proxy.host}:${proxy.port}`;
    const httpsAgent = new HttpsProxyAgent(proxyUrl);

    const axiosInstance = axios.create({
        httpsAgent,
        headers: {
            'Accept': '*/*',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Cookie': `uid=${uid}; ukey=${ukey}; piname=${piname}`,
            'User-Agent': userAgent,
            'Origin': 'https://pivoice.app',
            'Referer': 'https://pivoice.app/',
            'X-Requested-With': 'XMLHttpRequest'
        }
    });

    try {
        const randomTitle = titles[Math.floor(Math.random() * titles.length)];
        const randomContent = contents[Math.floor(Math.random() * contents.length)];
        
        // Đăng bài viết
        const postResponse = await axiosInstance.post('https://pivoice.app/vapi', {
            gallery: 'https://asset.vcity.app/vfile/2024/11/25/01/1732528167210412889621186165805.jpg',
            update_country: 1,
            update_multi_country: JSON.stringify({ "1": 1 }),
            update_chain: 0,
            update_multi_chain: JSON.stringify({ "0": 1 }),
            component: 'article',
            action: 'create',
            title: randomTitle,
            content: randomContent,
            user_name: piname,
            english_version: 0,
            selected_country: 1,
            selected_chain: 0
        });

        if (!postResponse.data?.data?.status === 1) {
            console.log(`❌ [${piname}] Lỗi đăng bài.`);
            return;
        }

        console.log(`📝 [${piname}] Đã đăng bài: ${randomTitle}`);

        // Lấy danh sách bài viết
        const listResponse = await axiosInstance.get('https://pivoice.app/vjson/home/list/index/0_1');
        const articles = listResponse.data?.data?.home_1 || [];

        if (articles.length === 0) {
            console.log(`❌ Không tìm thấy bài viết nào.`);
            return;
        }

        const article = articles.find(a => a.title === randomTitle) || articles[Math.floor(Math.random() * articles.length)];
        const articleId = article.id;

        console.log(`🎯 [${piname}] Đang xử lý bài viết ID: ${articleId}`);

        // Like bài viết
        await axiosInstance.post('https://pivoice.app/vapi', {
            component: 'article',
            action: 'like',
            aid: articleId,
            user_name: piname,
            english_version: 0,
            selected_country: 1,
            selected_chain: 0
        });
        console.log(`👍 [${piname}] Đã Like bài viết ${articleId}`);

        const randomComment = comments[Math.floor(Math.random() * comments.length)];

        // Bình luận vào bài viết
        await axiosInstance.post('https://pivoice.app/vapi', {
            action: 'send',
            component: 'comment',
            message: randomComment,
            user_name: piname,
            article_id: articleId,
            english_version: 0,
            selected_country: 1,
            selected_chain: 0
        });
        console.log(`💬 [${piname}] Đã bình luận: "${randomComment}" vào bài viết ${articleId}`);

    } catch (error) {
        console.log(`❌ [${piname}] Lỗi request: ${error.message}`);
    }
}

function readJSON(filename) {
    try {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (err) {
        console.log(`❌ Lỗi khi đọc file ${filename}: ${err.message}`);
        return [];
    }
}