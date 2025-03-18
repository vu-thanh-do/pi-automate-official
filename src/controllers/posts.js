const { postArticle } = require('../api/postApi');
const { readExcel } = require('../models/excelSheed');

async function handlePostArticles(req, res) {
    const { users, proxies, titles, contents } = readExcel();
    console.log(users," proxies, titles, contents")
    for (const [index, user] of users.entries()) {
        const proxy = proxies[index % proxies.length];
        const title = titles[Math.floor(Math.random() * titles.length)].title;
        const content = contents[Math.floor(Math.random() * contents.length)].content;

        await postArticle(proxy, user, title, content);
    }

    res.json({ success: true, message: "Đã đăng bài thành công!" });
}

module.exports = { handlePostArticles };
