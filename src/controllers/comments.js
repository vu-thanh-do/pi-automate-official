const { readExcel } = require('../models/excelSheed');
const apiClient = require('../api/apiClient');
async function handleComment(req) {
    const  commentCount  = req;
    console.log(commentCount)
    if (commentCount <= 0) return res.json({ success: true, message: "Không cần comment" });
    const { users, proxies, comments } = readExcel();
    console.log(users, proxies, comments)
    for (const [index, user] of users.entries()) {
        const proxy = proxies[index % proxies.length];
        const api = apiClient(proxy, user);

        for (let i = 0; i < commentCount; i++) {
            const message = comments[Math.floor(Math.random() * comments.length)].message;
            await api.post('/', { component: 'comment', action: 'send', message, user_name: user.piname });
        }
    }
    return { success: true, message: "Comment thành công!" };
}

module.exports = { handleComment };
