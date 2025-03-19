const ExcelReaderService = require("../models/excelSheed");
const apiClient = require("../api/apiClient");
const path = require("path");
const qs = require('qs'); // hoặc sử dụng URLSearchParams nếu bạn thích
const getArticleId = require('../services/getArticleId')


// Hàm tạm dừng thực thi để tránh request quá nhanh
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Hàm cập nhật và hiển thị trạng thái tiến độ theo thời gian thực
function updateProgressStatus(total, success, fail, processing) {
  const completed = success + fail;
  const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
  const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
  console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ --------`);
  console.log(`[${bar}] ${percent}% (${completed}/${total})`);
  console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
  console.log(`-------------------------------------\n`);
}

async function handleComment(req) {
  const commentCount = req;
  console.log(`>> Yêu cầu gửi ${commentCount} comment`);

  if (commentCount <= 0) return { success: true, message: "Không cần comment" };

  // Khởi tạo Excel Reader Service với đường dẫn file
  const excelFilePath = path.join(__dirname, "../data/PI.xlsx");
  const excelReader = new ExcelReaderService(excelFilePath);

  // Đọc tất cả dữ liệu từ file Excel
  const excelData = excelReader.readAllSheets();

  // Truy cập dữ liệu cụ thể từ sheet và cột
  const proxies = excelData["prxageng"]["proxy"] || [];

  // Truy cập dữ liệu từ các sheet khác (giả định tên sheet và cột)
  const uid = excelData["prxageng"]["uid"] || [];
  const piname = excelData["prxageng"]["piname"] || [];
  const proxy = excelData["prxageng"]["proxy"] || [];
  const ukey = excelData["prxageng"]["ukey"] || [];
  const userAgent = excelData["prxageng"]["user_agent"] || [];
  // Tạo mảng đối tượng user có thông tin đầy đủ
  const userObjects = uid.map((user, index) => {
    const newProxy = proxy[index].split(":");
    return {
      uid: user,
      piname: piname[index],
      ukey: ukey[index],
      userAgent: userAgent[index],
      proxy: {
        host: newProxy[0],
        port: newProxy[1],
        name: newProxy[2],
        password: newProxy[3],
      },
    };
  });

  // Lấy dữ liệu comment từ sheet tương ứng
  const commentTexts = excelData["Sheet1"]["comments"] || [];

  const comments = commentTexts.map((message, index) => {
    const arrMessage = message.split(",");
    return {
      message: arrMessage[Math.floor(Math.random() * arrMessage.length)],
    };
  });

  // Kiểm tra dữ liệu trước khi tiếp tục
  if (
    proxies.length === 0 ||
    userObjects.length === 0 ||
    comments.length === 0
  ) {
    return {
      success: false,
      message: "Thiếu dữ liệu cần thiết từ file Excel",
      missing: {
        proxies: proxies.length === 0,
        users: userObjects.length === 0,
        comments: comments.length === 0,
      },
    };
  }

  console.log(
    `Tìm thấy ${userObjects.length} users, ${proxies.length} proxies, ${comments.length} comments`
  );

  // Thực hiện gửi comment
  let successCount = 0;
  let failureCount = 0;
  
  console.log(`>> Bắt đầu gửi comment...`);
  
  // Tạo mảng các promises cho tất cả task
  const allCommentPromises = [];
  
  for (const [userIndex, user] of userObjects.entries()) {
    console.log(`\n>> Chuẩn bị xử lý user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
    
    const api = apiClient(user);
    
    // Tạo các promises cho mỗi comment của user hiện tại
    for (let i = 0; i < commentCount; i++) {
      const message = comments[Math.floor(Math.random() * comments.length)].message;
      
      // Tạo một promise cho mỗi comment và thêm vào mảng
      const commentPromise = (async () => {
        console.log(`\n>> Bắt đầu comment với user ${user.piname} - Task ${i + 1}/${commentCount}`);
        
        // Lấy article ID ngẫu nhiên
        let articleId;
        try {
          articleId = await getArticleId();
        } catch (error) {
          console.log(`❌ Lỗi khi lấy article ID, sử dụng ID mặc định: ${error.message}`);
          articleId = 58203589; // ID mặc định nếu không lấy được
        }
        
        // Thiết lập số lần thử lại tối đa
        const maxRetries = 2;
        let retryCount = 0;
        let success = false;
        
        // Mảng các biến thể URL để thử
        const urlVariants = ['/vapi', '/vapi/', 'vapi'];
        let currentUrlVariantIndex = 0;
        
        while (retryCount <= maxRetries && !success) {
          try {
            if (retryCount > 0) {
              console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho comment với user ${user.piname}`);
              // Đợi trước khi thử lại
              await sleep(3000 * retryCount);
            }
            
            const payload = qs.stringify({
              action: 'send',
              component: 'comment',
              message: message,
              user_name: user.piname,
              article_id: articleId || 58203589,
              english_version: 0, 
              selected_country: 1,
              selected_chain: 0,
            });
            
            // Sử dụng biến thể URL hiện tại
            const currentUrl = urlVariants[currentUrlVariantIndex];
            
            // Thực hiện gọi API
            console.log(`>> [Task ${userIndex+1}-${i+1}] Gửi comment đến article ID: ${articleId || 58203589} với nội dung: "${message}"`);
            const response = await api.post(currentUrl, payload);
            
            // Log chi tiết response để debug
            console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
            
            // Kiểm tra kết quả
            if (response.data && response.data.hasOwnProperty('data') && response.data.hasOwnProperty('time')) {
                console.log(`✅ [Task ${userIndex+1}-${i+1}] User ${user.piname} đã comment thành công: "${message}"`);
              return { success: true };
            } else {
              console.log(`⚠️ [Task ${userIndex+1}-${i+1}] User ${user.piname} gửi comment không thành công:`, response.data);
              return { success: false };
            }
          } catch (error) {
            console.error(`❌ [Task ${userIndex+1}-${i+1}] Lỗi khi gửi comment với user ${user.piname}:`, error.message);
            
            // Log chi tiết lỗi để debug
            if (error.response) {
              console.error(`Mã lỗi: ${error.response.status}`);
              console.error(`URL gọi: ${error.config?.url}`);
              console.error(`URL đầy đủ: ${error.config?.baseURL}${error.config?.url}`);
              console.error(`Phương thức: ${error.config?.method.toUpperCase()}`);
              
              // Thử lại nếu gặp lỗi 404, 429 hoặc 5xx
              if ([404, 429, 500, 502, 503, 504].includes(error.response.status)) {
                retryCount++;
                if (retryCount <= maxRetries) {
                  console.log(`>> [Task ${userIndex+1}-${i+1}] Sẽ thử lại sau ${3 * retryCount} giây...`);
                  
                  // Nếu gặp lỗi 404, thử URL biến thể khác
                  if (error.response.status === 404) {
                    console.error(`❗️ [Task ${userIndex+1}-${i+1}] Lỗi 404: URL không tồn tại, kiểm tra lại endpoint`);
                    currentUrlVariantIndex = (currentUrlVariantIndex + 1) % urlVariants.length;
                    console.error(`❗️ [Task ${userIndex+1}-${i+1}] Sẽ thử với biến thể URL mới: ${urlVariants[currentUrlVariantIndex]}`);
                  }
                  
                  // Nếu đã thử hết tất cả các biến thể URL mà vẫn lỗi 404
                  if (error.response.status === 404 && 
                      currentUrlVariantIndex === urlVariants.length - 1 && 
                      retryCount === maxRetries) {
                    console.error(`❗️ [Task ${userIndex+1}-${i+1}] Đã thử tất cả các biến thể URL nhưng vẫn gặp lỗi 404.`);
                    console.error(`❗️ [Task ${userIndex+1}-${i+1}] Có thể API endpoint đã thay đổi hoặc không tồn tại.`);
                  }
                  
                  await sleep(3000 * retryCount);
                  continue;
                }
              }
            }
            
            return { success: false };
          }
        }
        
        // Nếu vòng lặp kết thúc mà không return, xem như thất bại
        return { success: false };
      })();
      
      allCommentPromises.push(commentPromise);
      
      // Thêm một khoảng delay ngẫu nhiên giữa việc khởi tạo các promises
      // để tránh gửi quá nhiều requests cùng một lúc
      await sleep(500 + Math.floor(Math.random() * 500));
    }
  }
  
  const totalTasks = allCommentPromises.length;
  console.log(`>> Tổng số ${totalTasks} comment đang được xử lý đồng thời...`);
  
  // Khởi tạo bảng để theo dõi trạng thái tiến độ
  let progressSuccessCount = 0;
  let progressFailCount = 0;
  
  // Hiển thị trạng thái ban đầu
  updateProgressStatus(totalTasks, progressSuccessCount, progressFailCount, totalTasks);
  
  // Thiết lập interval để cập nhật tiến độ mỗi 3 giây
  const progressInterval = setInterval(() => {
    updateProgressStatus(
      totalTasks, 
      progressSuccessCount, 
      progressFailCount, 
      totalTasks - (progressSuccessCount + progressFailCount)
    );
  }, 3000);
  
  // Xử lý các promises và cập nhật kết quả
  const results = [];
  for (const [index, promise] of allCommentPromises.entries()) {
    try {
      const result = await promise;
      if (result.success) {
        progressSuccessCount++;
      } else {
        progressFailCount++;
      }
      results.push({ status: 'fulfilled', value: result });
    } catch (error) {
      console.error(`❌ Lỗi không xác định với promise #${index}: ${error.message}`);
      progressFailCount++;
      results.push({ status: 'rejected', reason: error.message });
    }
    
    // Cập nhật tiến độ sau mỗi 5 promises hoàn thành
    if ((index + 1) % 5 === 0 || index === allCommentPromises.length - 1) {
      updateProgressStatus(
        totalTasks, 
        progressSuccessCount, 
        progressFailCount, 
        totalTasks - (progressSuccessCount + progressFailCount)
      );
    }
  }
  
  // Dừng interval cập nhật tiến độ
  clearInterval(progressInterval);
  
  // Cập nhật trạng thái tiến độ cuối cùng
  updateProgressStatus(totalTasks, progressSuccessCount, progressFailCount, 0);
  
  // Đếm số lượng thành công/thất bại từ kết quả
  successCount = progressSuccessCount;
  failureCount = progressFailCount;
  
  console.log(`\n>> Kết quả cuối cùng: ${successCount} comment thành công, ${failureCount} comment thất bại`);
  
  return { 
    success: successCount > 0, 
    message: `Đã gửi ${successCount}/${successCount + failureCount} comment thành công!`,
    stats: {
      total: successCount + failureCount,
      success: successCount,
      failure: failureCount
    }
  };
}

module.exports = { handleComment };
