const ExcelReaderService = require('../models/excelSheed');
const apiClient = require('../api/apiClient');
const path = require('path');

/**
 * Xử lý gửi comment sử dụng dữ liệu từ file Excel
 * @param {number} req - Số lượng comment cần gửi
 * @returns {Object} - Kết quả xử lý
 */
async function handleComment(req) {
    const commentCount = req; console.log(commentCount);
    
    if (commentCount <= 0) return { success: true, message: "Không cần comment" };
    
    // Khởi tạo Excel Reader Service với đường dẫn file
    const excelFilePath = path.join(__dirname, '../data/PI.xlsx');
    const excelReader = new ExcelReaderService(excelFilePath);
    
   
    // Đọc tất cả dữ liệu từ file Excel
    const excelData = excelReader.readAllSheets();
    
    // Truy cập dữ liệu cụ thể từ sheet và cột
    const proxies = excelData["prxageng"]["proxy"] || [];
    console.log("Proxies:", proxies);
    
    // Truy cập dữ liệu từ các sheet khác (giả định tên sheet và cột)
    const users = excelData["user"] ? excelData["user"]["User"] || [] : [];
    const usernames = excelData["user"] ? excelData["user"]["piname"] || [] : [];
    
    // Tạo mảng đối tượng user có thông tin đầy đủ
    const userObjects = users.map((user, index) => ({
        user,
        piname: usernames[index] || user // Sử dụng username nếu có, nếu không thì dùng user
    }));
    
    // Lấy dữ liệu comment từ sheet tương ứng
    const commentTexts = excelData["comments"] ? excelData["comments"]["message"] || [] : [];
    const comments = commentTexts.map(message => ({ message }));
    
    // Kiểm tra dữ liệu trước khi tiếp tục
    if (proxies.length === 0 || userObjects.length === 0 || comments.length === 0) {
        return { 
            success: false, 
            message: "Thiếu dữ liệu cần thiết từ file Excel",
            missing: {
                proxies: proxies.length === 0,
                users: userObjects.length === 0,
                comments: comments.length === 0
            }
        };
    }
    
    console.log(`Tìm thấy ${userObjects.length} users, ${proxies.length} proxies, ${comments.length} comments`);
    
    // Thực hiện gửi comment
    for (const [index, user] of userObjects.entries()) {
        const proxy = proxies[index % proxies.length];
        const api = apiClient(proxy, user);

        for (let i = 0; i < commentCount; i++) {
            const message = comments[Math.floor(Math.random() * comments.length)].message;
            try {
                await api.post('/', { 
                    component: 'comment', 
                    action: 'send', 
                    message, 
                    user_name: user.piname 
                });
                console.log(`User ${user.piname} đã comment: ${message}`);
            } catch (error) {
                console.error(`Lỗi khi gửi comment với user ${user.piname}:`, error.message);
                // Tiếp tục với user khác nếu một user gặp lỗi
            }
        }
    }
    
    return { success: true, message: "Comment thành công!" };
}

module.exports = { handleComment };