const { readExcel } = require('../models/excelSheed');
const apiClient = require('../api/apiClient');

async function handleLike(req, res) {
    const { likeCount } = req.body;
    if (likeCount <= 0) return res.json({ success: true, message: "Không cần like" });

    const { users, proxies } = readExcel();
    for (const [index, user] of users.entries()) {
        const proxy = proxies[index % proxies.length];
        const api = apiClient(proxy, user);

        for (let i = 0; i < likeCount; i++) {
            await api.post('/', { component: 'article', action: 'like', user_name: user.piname });
        }
    }
    res.json({ success: true, message: "Like thành công!" });
}

module.exports = { handleLike };
