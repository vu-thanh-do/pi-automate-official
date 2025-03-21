const ExcelReaderService = require("../models/excelSheed");
const apiClient = require("../api/apiClient");
const path = require("path");
const qs = require("qs");
const { getAllPostIds, deletePostById } = require("../services/serviceGetPostUser");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    
    const excelFilePath = path.join(__dirname, "../data/PI.xlsx");
    const excelReader = new ExcelReaderService(excelFilePath);
    
    const excelData = excelReader.readAllSheets();
    
    const uid = excelData["prxageng"]["uid"] || [];
    const piname = excelData["prxageng"]["piname"] || [];
    const proxy = excelData["prxageng"]["proxy"] || [];
    const ukey = excelData["prxageng"]["ukey"] || [];
    const userAgent = excelData["prxageng"]["user_agent"] || [];

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

    if (userObjects.length === 0) {
      return {
        success: false,
        message: "Không tìm thấy dữ liệu user từ file Excel",
      };
    }

    console.log(`>> Tìm thấy ${userObjects.length} users`);
    console.log(`>> Bắt đầu quá trình xóa bài...`);
    
    const allDeletePromises = [];
    const totalDeletesPerUser = {};
    const userPostsMap = {};
    
    for (const [userIndex, user] of userObjects.entries()) {
      console.log(`\n>> Đang lấy danh sách bài viết của user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      
      try {
        const userPosts = await getAllPostIds(user);
        userPostsMap[user.uid] = userPosts;
        
        console.log(`>> Tìm thấy ${userPosts.length} bài viết của user ${user.piname}`);
        
        if (userPosts.length === 0) {
          console.log(`>> User ${user.piname} không có bài viết nào để xóa`);
          continue;
        }
        
        const postsToDelete = Math.min(deleteCount, userPosts.length);
        totalDeletesPerUser[user.uid] = postsToDelete;
        
        console.log(`>> Sẽ xóa ${postsToDelete} bài viết của user ${user.piname}`);
      } catch (error) {
        console.error(`❌ Lỗi khi lấy danh sách bài viết của user ${user.piname}:`, error.message);
      }
      
      await sleep(500);
    }
    
    for (const [userIndex, user] of userObjects.entries()) {
      if (!userPostsMap[user.uid] || userPostsMap[user.uid].length === 0 || !totalDeletesPerUser[user.uid]) {
        continue;
      }
      
      console.log(`\n>> Chuẩn bị xóa bài cho user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      
      const api = apiClient(user);
      const userPosts = userPostsMap[user.uid];
      const postsToDelete = totalDeletesPerUser[user.uid];
      
      for (let i = 0; i < postsToDelete; i++) {
        const postId = userPosts[i];

        const deletePromise = (async () => {
          console.log(`\n>> Bắt đầu xóa bài viết ID ${postId} của user ${user.piname} - Task ${i + 1}/${postsToDelete}`);
          
          const maxRetries = 2;
          let retryCount = 0;
          
          const urlVariants = ['/vapi', '/vapi/', 'vapi'];
          let currentUrlVariantIndex = 0;
          
          while (retryCount <= maxRetries) {
            try {
              if (retryCount > 0) {
                console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho xóa bài viết ID ${postId} của user ${user.piname}`);
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
              
              const currentUrl = urlVariants[currentUrlVariantIndex];
              
              console.log(`>> [Task ${userIndex+1}-${i+1}] Xóa bài viết ID: ${postId} của user ${user.piname}`);
              const response = await api.post(currentUrl, payload);
              
              console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
              
              if (response.data && response.data.hasOwnProperty('data') && response.data.data && response.data.data.status === 1) {
                console.log(`✅ [Task ${userIndex+1}-${i+1}] Đã xóa thành công bài viết ID ${postId} của user ${user.piname}`);
                return { success: true, postId };
              } else {
                console.log(`⚠️ [Task ${userIndex+1}-${i+1}] Xóa bài viết ID ${postId} không thành công:`, response.data);
                
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
              
              if (error.response) {
                console.error(`Mã lỗi: ${error.response.status}`);
                console.error(`URL gọi: ${error.config?.url}`);
                console.error(`URL đầy đủ: ${error.config?.baseURL}${error.config?.url}`);
                console.error(`Phương thức: ${error.config?.method.toUpperCase()}`);
                
                if ([404, 429, 500, 502, 503, 504].includes(error.response.status)) {
                  retryCount++;
                  if (retryCount <= maxRetries) {
                    console.log(`>> [Task ${userIndex+1}-${i+1}] Sẽ thử lại sau ${3 * retryCount} giây...`);
                    
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
          
          return { success: false, postId };
        })();
        
        allDeletePromises.push(deletePromise);
        
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
    
    let progressSuccessCount = 0;
    let progressFailCount = 0;
    let deletedPostIds = []; 
    
    updateProgressStatus(totalTasks, progressSuccessCount, progressFailCount, totalTasks);
    
    const progressInterval = setInterval(() => {
      updateProgressStatus(
        totalTasks, 
        progressSuccessCount, 
        progressFailCount, 
        totalTasks - (progressSuccessCount + progressFailCount)
      );
    }, 3000);
    
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
      
      if ((index + 1) % 5 === 0 || index === allDeletePromises.length - 1) {
        updateProgressStatus(
          totalTasks, 
          progressSuccessCount, 
          progressFailCount, 
          totalTasks - (progressSuccessCount + progressFailCount)
        );
      }
    }
    
    clearInterval(progressInterval);
    
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

module.exports = handleDelete;
module.exports.handleDelete = handleDelete;