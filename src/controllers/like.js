const ExcelReaderService = require("../models/excelSheed");
const apiClient = require("../api/apiClient");
const getArticleId = require("../services/getArticleId");
const path = require("path");
const qs = require('qs');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function updateProgressStatus(total, success, fail, processing) {
  const completed = success + fail;
  const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
  const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
  console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ LIKE --------`);
  console.log(`[${bar}] ${percent}% (${completed}/${total})`);
  console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
  console.log(`----------------------------------------\n`);
}

async function handleLike(req) {
  try {
    const likeCount = req;
    console.log(`>> Yêu cầu thực hiện ${likeCount} like`);

    if (likeCount <= 0) return { success: true, message: "Không cần like" };
    
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
    
    console.log(`>> Đang tải danh sách bài viết để like...`);
    const articleIds = new Set(); 
    
    const requiredCount = likeCount * 2;
    let retries = 0;
    
    while (articleIds.size < requiredCount && retries < 10) {
      try {
        const newId = await getArticleId();
        if (newId) {
          articleIds.add(newId);
          console.log(`>> Đã lấy bài viết #${articleIds.size}: ID ${newId}`);
        }
      } catch (error) {
        console.log(`❌ Lỗi khi lấy article ID: ${error.message}`);
      }
      
      await sleep(300);
      
      if (articleIds.size < Math.min(retries + 1, requiredCount)) {
        retries++;
      }
    }
    
    const availableArticleIds = Array.from(articleIds);
    
    if (availableArticleIds.length === 0) {
      console.log(`❌ Không thể lấy được bài viết nào để like. Sử dụng ID mặc định.`);
      availableArticleIds.push(58203589); 
    }
    
    console.log(`>> Đã chuẩn bị ${availableArticleIds.length} bài viết khác nhau để like`);
    console.log(`>> Bắt đầu thực hiện like...`);
    
    const allLikePromises = [];
    
    for (const [userIndex, user] of userObjects.entries()) {
      console.log(`\n>> Chuẩn bị xử lý user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      
      const api = apiClient(user);
      
      const likedByThisUser = new Set();
      
      for (let i = 0; i < likeCount; i++) {
        const likePromise = (async () => {
          console.log(`\n>> Bắt đầu like với user ${user.piname} - Task ${i + 1}/${likeCount}`);
          
          let articleId;
          let attempts = 0;
          const maxAttempts = 5;
          
          while (attempts < maxAttempts) {
            const randomIndex = Math.floor(Math.random() * availableArticleIds.length);
            const candidateId = availableArticleIds[randomIndex];
            
            if (!likedByThisUser.has(candidateId)) {
              articleId = candidateId;
              likedByThisUser.add(articleId); 
              console.log(`>> Đã chọn bài viết ID ${articleId} cho user ${user.piname}`);
              break;
            }
            
            attempts++;
            
            if (attempts === maxAttempts - 1) {
              try {
                const newId = await getArticleId();
                if (newId && !likedByThisUser.has(newId)) {
                  articleId = newId;
                  availableArticleIds.push(newId); 
                  likedByThisUser.add(articleId); 
                  console.log(`>> Lấy thêm bài viết mới ID ${articleId} cho user ${user.piname}`);
                  break;
                }
              } catch (error) {
                console.log(`❌ Lỗi khi lấy article ID mới: ${error.message}`);
              }
            }
          }
          
          if (!articleId) {
            articleId = 58203589;
            console.log(`❌ Không tìm được bài viết chưa like, sử dụng ID mặc định: ${articleId}`);
          }
          
          const maxRetries = 2;
          let retryCount = 0;
          
          const urlVariants = ['/vapi', '/vapi/', 'vapi'];
          let currentUrlVariantIndex = 0;
          
          while (retryCount <= maxRetries) {
            try {
              if (retryCount > 0) {
                console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho like với user ${user.piname}`);
                await sleep(3000 * retryCount);
              }
              
              const payload = qs.stringify({
                component: "article",
                action: "like",
                aid: articleId,
                user_name: user.piname,
                english_version: 0,
                selected_country: 1,
                selected_chain: 0,
              });
              
              const currentUrl = urlVariants[currentUrlVariantIndex];
              
              console.log(`>> [Task ${userIndex+1}-${i+1}] Like bài viết ID: ${articleId} với user ${user.piname}`);
              const response = await api.post(currentUrl, payload);
              
              console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
              
              if (response.data && response.data.hasOwnProperty('data')) {
                console.log(`✅ [Task ${userIndex+1}-${i+1}] User ${user.piname} đã like bài viết ${articleId} thành công!`);
                return { success: true, articleId };
              } else {
                console.log(`⚠️ [Task ${userIndex+1}-${i+1}] User ${user.piname} like bài viết ${articleId} không thành công:`, response.data);
                
                if (response.data && response.data.message && (
                    response.data.message.includes("đã like") || 
                    response.data.message.includes("already") ||
                    response.data.message.includes("Đã like")
                )) {
                  console.log(`ℹ️ [Task ${userIndex+1}-${i+1}] Bài viết ${articleId} đã được like trước đó bởi user ${user.piname}`);
                }
                
                return { success: false, articleId };
              }
            } catch (error) {
              console.error(`❌ [Task ${userIndex+1}-${i+1}] Lỗi khi like bài viết ${articleId} với user ${user.piname}:`, error.message);
              
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
              
              return { success: false, articleId };
            }
          }
          
          return { success: false, articleId };
        })();
        
        allLikePromises.push(likePromise);
        
        await sleep(300 + Math.floor(Math.random() * 300));
      }
    }
    
    const totalTasks = allLikePromises.length;
    console.log(`>> Tổng số ${totalTasks} like đang được xử lý đồng thời...`);
    
    let progressSuccessCount = 0;
    let progressFailCount = 0;
    let uniqueArticlesLiked = new Set(); 
    
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
    for (const [index, promise] of allLikePromises.entries()) {
      try {
        const result = await promise;
        if (result.success) {
          progressSuccessCount++;
          if (result.articleId) {
            uniqueArticlesLiked.add(result.articleId);
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
      
      if ((index + 1) % 5 === 0 || index === allLikePromises.length - 1) {
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
    
    console.log(`\n>> Kết quả cuối cùng: ${progressSuccessCount} like thành công, ${progressFailCount} like thất bại`);
    console.log(`>> Tổng số bài viết độc nhất đã like: ${uniqueArticlesLiked.size}`);
    
    return { 
      success: progressSuccessCount > 0, 
      message: `Đã thực hiện ${progressSuccessCount}/${progressSuccessCount + progressFailCount} like thành công!`,
      stats: {
        total: progressSuccessCount + progressFailCount,
        success: progressSuccessCount,
        failure: progressFailCount,
        uniqueArticles: uniqueArticlesLiked.size
      }
    };
  } catch (error) {
    console.error(`❌ Lỗi không xử lý được: ${error.message}`);
    return {
      success: false,
      message: `Đã xảy ra lỗi khi thực hiện like: ${error.message}`,
      error: error.toString()
    };
  }
}

module.exports = { handleLike };
