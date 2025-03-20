const apiClient = require("../api/apiClient");
const qs = require("qs");
const path = require("path");
const {
  getAllPostIds,
  deletePostById,
} = require("../services/serviceGetPostUser");
const getAllPostPiKnow = require("../services/getAllPostPiKnow");
const ExcelReaderService = require("../models/excelSheed");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function updateProgressStatus(total, success, fail, processing) {
  const completed = success + fail;
  const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
  const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
  console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ PIKNOW --------`);
  console.log(`[${bar}] ${percent}% (${completed}/${total})`);
  console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
  console.log(`-----------------------------------------\n`);
}

async function handlePiKnow(req) {
  try {
    const countPiKnow = req;
    console.log(`>> Yêu cầu piknow ${countPiKnow} bài viết`);
    if (countPiKnow <= 0) return { success: true, message: "Không cần piknow" };

    const excelFilePath = path.join(__dirname, "../data/PI.xlsx");
    const excelReader = new ExcelReaderService(excelFilePath);
    const excelData = excelReader.readAllSheets();
    
    const uid = excelData["prxageng"]["uid"] || [];
    const piname = excelData["prxageng"]["piname"] || [];
    const proxy = excelData["prxageng"]["proxy"] || [];
    const ukey = excelData["prxageng"]["ukey"] || [];
    const userAgent = excelData["prxageng"]["user_agent"] || [];
    const piknow = excelData["piknow"]["piknow"] || [];

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

    const allPostPiKnow = await getAllPostPiKnow();
    console.log(`>> Tìm thấy ${userObjects.length} users, ${allPostPiKnow.length} bài PiKnow`);
    console.log(`>> Bắt đầu piknow...`);

    const allPiKnowPromises = [];
    const usedIds = new Set(); 

    for (const [userIndex, user] of userObjects.entries()) {
      console.log(`\n>> Chuẩn bị xử lý user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      const api = apiClient(user);

      for (let i = 0; i < countPiKnow; i++) {
        const piknowPromise = (async () => {
          console.log(`\n>> Bắt đầu piknow cho user ${user.piname} - Task ${i + 1}/${countPiKnow}`);
          
          const maxRetries = 2;
          let retryCount = 0;
          
          const urlVariants = ['/vapi', '/vapi/', 'vapi'];
          let currentUrlVariantIndex = 0;
          
          while (retryCount <= maxRetries) {
            try {
              if (retryCount > 0) {
                console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho piknow của user ${user.piname}`);
                await sleep(3000 * retryCount);
              }

              let availableIds = allPostPiKnow.filter(id => !usedIds.has(id));
              if (availableIds.length === 0) {
                usedIds.clear();
                availableIds = allPostPiKnow;
              }
              
              const randomIndex = Math.floor(Math.random() * availableIds.length);
              const selectedId = availableIds[randomIndex];
              usedIds.add(selectedId);

              const randomMessage = piknow[Math.floor(Math.random() * piknow.length)];
              
              const payload = qs.stringify({
                component: "know",
                action: "answer",
                message: randomMessage,
                user_name: user.piname,
                know_id: selectedId,
                english_version: 0,
                selected_country: 1,
                selected_chain: 0,
              });
              
              const currentUrl = urlVariants[currentUrlVariantIndex];
              
              console.log(`>> [Task ${userIndex+1}-${i+1}] Piknow bài ID: ${selectedId} của user ${user.piname}`);
              const response = await api.post(currentUrl, payload);
              
              console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
              
              if (response.data && response.data.time) {
                console.log(`✅ [Task ${userIndex+1}-${i+1}] Đã piknow thành công bài ID ${selectedId} của user ${user.piname}`);
                return { success: true, postId: selectedId };
              } else {
                console.log(`⚠️ [Task ${userIndex+1}-${i+1}] Piknow bài ID ${selectedId} không thành công:`, response.data);
                return { success: false, postId: selectedId };
              }
            } catch (error) {
              console.error(`❌ [Task ${userIndex+1}-${i+1}] Lỗi khi piknow bài ID ${selectedId} của user ${user.piname}:`, error.message);
              
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
              
              return { success: false, postId: selectedId };
            }
          }
          
          return { success: false, postId: selectedId };
        })();
        
        allPiKnowPromises.push(piknowPromise);
        
        await sleep(300 + Math.floor(Math.random() * 300));
      }
    }
    
    const totalTasks = allPiKnowPromises.length;
    console.log(`>> Tổng số ${totalTasks} bài đang được xử lý để piknow...`);
    
    if (totalTasks === 0) {
      return {
        success: true,
        message: "Không có bài nào để piknow",
        stats: {
          total: 0,
          success: 0,
          failure: 0
        }
      };
    }
    
    let progressSuccessCount = 0;
    let progressFailCount = 0;
    let piknowedPostIds = [];
    
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
    for (const [index, promise] of allPiKnowPromises.entries()) {
      try {
        const result = await promise;
        if (result.success) {
          progressSuccessCount++;
          if (result.postId) {
            piknowedPostIds.push(result.postId);
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
      
      if ((index + 1) % 5 === 0 || index === allPiKnowPromises.length - 1) {
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
    
    console.log(`\n>> Kết quả cuối cùng: ${progressSuccessCount} bài piknow thành công, ${progressFailCount} bài thất bại`);
    
    return { 
      success: progressSuccessCount > 0, 
      message: `Đã piknow ${progressSuccessCount}/${progressSuccessCount + progressFailCount} bài thành công!`,
      stats: {
        total: progressSuccessCount + progressFailCount,
        success: progressSuccessCount,
        failure: progressFailCount,
        piknowedPostIds: piknowedPostIds
      }
    };
  } catch (error) {
    console.error(`❌ Lỗi không xử lý được: ${error.message}`);
    return {
      success: false,
      message: `Đã xảy ra lỗi khi piknow: ${error.message}`,
      error: error.toString()
    };
  }
}

module.exports = handlePiKnow;
module.exports.handlePiKnow = handlePiKnow;