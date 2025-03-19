const ExcelReaderService = require("../models/excelSheed");
const apiClient = require("../api/apiClient");
const path = require("path");
const qs = require("qs");
const { getAllPostIds, deletePostById } = require("../services/serviceGetPostUser");

// Hàm tạm dừng thực thi để tránh request quá nhanh
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Hàm cập nhật và hiển thị trạng thái tiến độ theo thời gian thực
function updateProgressStatus(total, success, fail, processing) {
  const completed = success + fail;
  const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
  const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
  console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ XÓA BÀI --------`);
  console.log(`[${bar}] ${percent}% (${completed}/${total})`);
  console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
  console.log(`-----------------------------------------\n`);
}

async function handleDelete(req) {
  try {
    const deleteCount = req;
    console.log(`>> Yêu cầu xóa ${deleteCount} bài viết cho mỗi user`);

    if (deleteCount <= 0) return { success: true, message: "Không cần xóa bài" };

    // Khởi tạo Excel Reader Service với đường dẫn file
    const excelFilePath = path.join(__dirname, "../data/PI.xlsx");
    const excelReader = new ExcelReaderService(excelFilePath);
    
    // Đọc tất cả dữ liệu từ file Excel
    const excelData = excelReader.readAllSheets();
    
    // Truy cập dữ liệu từ các sheet
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

    // Kiểm tra dữ liệu user trước khi tiếp tục
    if (userObjects.length === 0) {
      return {
        success: false,
        message: "Không tìm thấy dữ liệu user từ file Excel",
      };
    }

    console.log(`>> Tìm thấy ${userObjects.length} users`);
    console.log(`>> Bắt đầu quá trình xóa bài...`);
    
    // Tạo mảng các promises cho tất cả task xóa bài
    const allDeletePromises = [];
    const totalDeletesPerUser = {};
    const userPostsMap = {};
    
    // Lấy danh sách bài viết của tất cả users
    for (const [userIndex, user] of userObjects.entries()) {
      console.log(`\n>> Đang lấy danh sách bài viết của user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      
      try {
        // Sử dụng service để lấy danh sách bài viết của user
        const userPosts = await getAllPostIds(user);
        userPostsMap[user.uid] = userPosts;
        
        console.log(`>> Tìm thấy ${userPosts.length} bài viết của user ${user.piname}`);
        
        // Nếu user không có bài viết nào, bỏ qua
        if (userPosts.length === 0) {
          console.log(`>> User ${user.piname} không có bài viết nào để xóa`);
          continue;
        }
        
        // Số lượng bài viết cần xóa (lấy min của số bài hiện có và số yêu cầu)
        const postsToDelete = Math.min(deleteCount, userPosts.length);
        totalDeletesPerUser[user.uid] = postsToDelete;
        
        console.log(`>> Sẽ xóa ${postsToDelete} bài viết của user ${user.piname}`);
      } catch (error) {
        console.error(`❌ Lỗi khi lấy danh sách bài viết của user ${user.piname}:`, error.message);
      }
      
      // Tạm dừng giữa các request để tránh quá tải
      await sleep(500);
    }
    
    // Tạo các promises để xóa bài viết
    for (const [userIndex, user] of userObjects.entries()) {
      // Bỏ qua users không có bài viết hoặc không lấy được danh sách
      if (!userPostsMap[user.uid] || userPostsMap[user.uid].length === 0 || !totalDeletesPerUser[user.uid]) {
        continue;
      }
      
      console.log(`\n>> Chuẩn bị xóa bài cho user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      
      const api = apiClient(user);
      const userPosts = userPostsMap[user.uid];
      const postsToDelete = totalDeletesPerUser[user.uid];
      
      // Tạo các promises cho mỗi bài viết cần xóa
      for (let i = 0; i < postsToDelete; i++) {
        // Lấy ID bài viết
        const postId = userPosts[i];
        
        // Tạo một promise cho việc xóa bài viết
        const deletePromise = (async () => {
          console.log(`\n>> Bắt đầu xóa bài viết ID ${postId} của user ${user.piname} - Task ${i + 1}/${postsToDelete}`);
          
          // Thiết lập số lần thử lại tối đa
          const maxRetries = 2;
          let retryCount = 0;
          
          // Mảng các biến thể URL để thử
          const urlVariants = ['/vapi', '/vapi/', 'vapi'];
          let currentUrlVariantIndex = 0;
          
          while (retryCount <= maxRetries) {
            try {
              if (retryCount > 0) {
                console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho xóa bài viết ID ${postId} của user ${user.piname}`);
                // Đợi trước khi thử lại
                await sleep(3000 * retryCount);
              }
              
              const payload = qs.stringify({
                component: "article",
                action: "delete",
                uid: user.uid,
                aid: postId,
                user_name: user.piname,
                english_version: 0,
                selected_country: 1,
                selected_chain: 0,
              });
              
              // Sử dụng biến thể URL hiện tại
              const currentUrl = urlVariants[currentUrlVariantIndex];
              
              // Thực hiện gọi API
              console.log(`>> [Task ${userIndex+1}-${i+1}] Xóa bài viết ID: ${postId} của user ${user.piname}`);
              const response = await api.post(currentUrl, payload);
              
              // Log chi tiết response để debug
              console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
              
              // Kiểm tra kết quả - giả định thành công nếu có response data và status = 1
              if (response.data && response.data.hasOwnProperty('data') && response.data.data && response.data.data.status === 1) {
                console.log(`✅ [Task ${userIndex+1}-${i+1}] Đã xóa thành công bài viết ID ${postId} của user ${user.piname}`);
                return { success: true, postId };
              } else {
                console.log(`⚠️ [Task ${userIndex+1}-${i+1}] Xóa bài viết ID ${postId} không thành công:`, response.data);
                
                // Nếu bài viết không tồn tại hoặc đã bị xóa
                if (response.data && response.data.message && (
                    response.data.message.includes("không tồn tại") || 
                    response.data.message.includes("not exist") ||
                    response.data.message.includes("đã xóa")
                )) {
                  console.log(`ℹ️ [Task ${userIndex+1}-${i+1}] Bài viết ID ${postId} có thể đã bị xóa trước đó hoặc không tồn tại`);
                  return { success: true, postId, alreadyDeleted: true };
                }
                
                return { success: false, postId };
              }
            } catch (error) {
              console.error(`❌ [Task ${userIndex+1}-${i+1}] Lỗi khi xóa bài viết ID ${postId} của user ${user.piname}:`, error.message);
              
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
                    
                    await sleep(3000 * retryCount);
                    continue;
                  }
                }
              }
              
              return { success: false, postId };
            }
          }
          
          // Nếu vòng lặp kết thúc mà không return, xem như thất bại
          return { success: false, postId };
        })();
        
        allDeletePromises.push(deletePromise);
        
        // Thêm một khoảng delay ngẫu nhiên giữa việc khởi tạo các promises
        // để tránh gửi quá nhiều requests cùng một lúc
        await sleep(300 + Math.floor(Math.random() * 300));
      }
    }
    
    const totalTasks = allDeletePromises.length;
    console.log(`>> Tổng số ${totalTasks} bài viết đang được xử lý để xóa...`);
    
    if (totalTasks === 0) {
      return {
        success: true,
        message: "Không có bài viết nào để xóa",
        stats: {
          total: 0,
          success: 0,
          failure: 0
        }
      };
    }
    
    // Khởi tạo bảng để theo dõi trạng thái tiến độ
    let progressSuccessCount = 0;
    let progressFailCount = 0;
    let deletedPostIds = []; // Lưu trữ ID các bài viết đã xóa thành công
    
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
    for (const [index, promise] of allDeletePromises.entries()) {
      try {
        const result = await promise;
        if (result.success) {
          progressSuccessCount++;
          if (result.postId) {
            deletedPostIds.push(result.postId);
          }
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
      if ((index + 1) % 5 === 0 || index === allDeletePromises.length - 1) {
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
    
    console.log(`\n>> Kết quả cuối cùng: ${progressSuccessCount} bài viết xóa thành công, ${progressFailCount} bài viết thất bại`);
    
    return { 
      success: progressSuccessCount > 0, 
      message: `Đã xóa ${progressSuccessCount}/${progressSuccessCount + progressFailCount} bài viết thành công!`,
      stats: {
        total: progressSuccessCount + progressFailCount,
        success: progressSuccessCount,
        failure: progressFailCount,
        deletedPostIds: deletedPostIds
      }
    };
  } catch (error) {
    console.error(`❌ Lỗi không xử lý được: ${error.message}`);
    return {
      success: false,
      message: `Đã xảy ra lỗi khi xóa bài: ${error.message}`,
      error: error.toString()
    };
  }
}

// Sửa cách export để cung cấp cả hai cách sử dụng
module.exports = handleDelete;
module.exports.handleDelete = handleDelete;