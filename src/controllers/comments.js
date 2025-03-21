const ExcelReaderService = require("../models/excelSheed");
const apiClient = require("../api/apiClient");
const path = require("path");
const qs = require('qs'); 
const getArticleId = require('../services/getArticleId')


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function updateProgressStatus(total, success, fail, processing) {
  const completed = success + fail;
  const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
  const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
  console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ --------`);
  console.log(`[${bar}] ${percent}% (${completed}/${total})`);
  console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
  console.log(`-------------------------------------\n`);
}

function splitIntoWords(text) {
  return text.split(/\s+/).filter(word => word.length > 0);
}

function splitIntoPhrases(text) {
  return text.split(/[,.!?;]/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateMixedComment(commentTexts) {
  const allComments = commentTexts.reduce((acc, text) => {
    if (text) {
      const comments = text.split(",").map(c => c.trim());
      acc.push(...comments);
    }
    return acc;
  }, []);

  const wordPool = allComments.reduce((acc, text) => {
    if (text) {
      acc.push(...splitIntoWords(text));
    }
    return acc;
  }, []);

  const phrasePool = allComments.reduce((acc, text) => {
    if (text) {
      acc.push(...splitIntoPhrases(text));
    }
    return acc;
  }, []);

  const mixingStyle = Math.floor(Math.random() * 6);

  switch (mixingStyle) {
    case 0:
      return getRandomElement(allComments);

    case 1:
      const numWords = Math.floor(Math.random() * 2) + 3;
      const words = [];
      for (let i = 0; i < numWords; i++) {
        words.push(getRandomElement(wordPool));
      }
      return words.join(' ');

    case 2:
      const phrase = getRandomElement(phrasePool);
      const word = getRandomElement(wordPool);
      return `${phrase} ${word}`;

    case 3:
      const phrases = [
        getRandomElement(phrasePool),
        getRandomElement(phrasePool)
      ];
      return phrases.join(', ');

    case 4:
      const firstWord = getRandomElement(wordPool);
      const middlePhrase = getRandomElement(phrasePool);
      const lastWord = getRandomElement(wordPool);
      return `${firstWord} ${middlePhrase} ${lastWord}`;

    case 5:
      const numParts = Math.floor(Math.random() * 2) + 2;
      const selectedComments = [];
      for (let i = 0; i < numParts; i++) {
        const comment = getRandomElement(allComments);
        const parts = splitIntoPhrases(comment);
        selectedComments.push(getRandomElement(parts));
      }
      return selectedComments.join(' ');
  }
}

async function handleComment(req) {
  const commentCount = req;
  console.log(`>> Yêu cầu gửi ${commentCount} comment`);

  if (commentCount <= 0) return { success: true, message: "Không cần comment" };

  const excelFilePath = path.join(__dirname, "../data/PI.xlsx");
  const excelReader = new ExcelReaderService(excelFilePath);

  const excelData = excelReader.readAllSheets();

  const proxies = excelData["prxageng"]["proxy"] || [];

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

  const commentTexts = excelData["Sheet1"]["comments"] || [];

  if (commentTexts.length === 0) {
    return {
      success: false,
      message: "Không tìm thấy dữ liệu comments từ file Excel",
    };
  }

  console.log(
    `Tìm thấy ${userObjects.length} users, ${proxies.length} proxies, ${commentTexts.length} comments`
  );

  let successCount = 0;
  let failureCount = 0;
  
  console.log(`>> Bắt đầu gửi comment...`);
  
  const allCommentPromises = [];
  
  for (const [userIndex, user] of userObjects.entries()) {
    console.log(`\n>> Chuẩn bị xử lý user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
    
    const api = apiClient(user);
    
    for (let i = 0; i < commentCount; i++) {
      const commentPromise = (async () => {
        console.log(`\n>> Bắt đầu comment với user ${user.piname} - Task ${i + 1}/${commentCount}`);
        
        let articleId;
        try {
          articleId = await getArticleId();
        } catch (error) {
          console.log(`❌ Lỗi khi lấy article ID, sử dụng ID mặc định: ${error.message}`);
          articleId = 58203589; 
        }
        
        const maxRetries = 2;
        let retryCount = 0;
        let success = false;
        
        const urlVariants = ['/vapi', '/vapi/', 'vapi'];
        let currentUrlVariantIndex = 0;
        
        while (retryCount <= maxRetries && !success) {
          try {
            if (retryCount > 0) {
              console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho comment với user ${user.piname}`);
              await sleep(3000 * retryCount);
            }
            
            const message = generateMixedComment(commentTexts);
            console.log(`>> Nội dung comment được tạo: "${message}"`);
            
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
            
            const currentUrl = urlVariants[currentUrlVariantIndex];
            
            console.log(`>> [Task ${userIndex+1}-${i+1}] Gửi comment đến article ID: ${articleId || 58203589} với nội dung: "${message}"`);
            const response = await api.post(currentUrl, payload);
            
            console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
            
            if (response.data && response.data.hasOwnProperty('data') && response.data.hasOwnProperty('time')) {
                console.log(`✅ [Task ${userIndex+1}-${i+1}] User ${user.piname} đã comment thành công: "${message}"`);
              return { success: true };
            } else {
              console.log(`⚠️ [Task ${userIndex+1}-${i+1}] User ${user.piname} gửi comment không thành công:`, response.data);
              return { success: false };
            }
          } catch (error) {
            console.error(`❌ [Task ${userIndex+1}-${i+1}] Lỗi khi gửi comment với user ${user.piname}:`, error.message);
            
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
        
        return { success: false };
      })();
      
      allCommentPromises.push(commentPromise);
      
      await sleep(500 + Math.floor(Math.random() * 500));
    }
  }
  
  const totalTasks = allCommentPromises.length;
  console.log(`>> Tổng số ${totalTasks} comment đang được xử lý đồng thời...`);
  
  let progressSuccessCount = 0;
  let progressFailCount = 0;
  
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
    
    if ((index + 1) % 5 === 0 || index === allCommentPromises.length - 1) {
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
