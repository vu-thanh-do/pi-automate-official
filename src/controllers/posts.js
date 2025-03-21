// const ExcelReaderService = require("../models/excelSheed");
// const apiClient = require("../api/apiClient");
// const path = require("path");
// const qs = require("qs");
// const getImageUrl = require("../services/serviceGetImage");


// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }


// function updateProgressStatus(total, success, fail, processing) {
//   const completed = success + fail;
//   const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
//   const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
//   console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ ĐĂNG BÀI --------`);
//   console.log(`[${bar}] ${percent}% (${completed}/${total})`);
//   console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
//   console.log(`------------------------------------------\n`);
// }

// async function handlePostArticles(req) {
//   try {
//     const postCount = req;
//     console.log(`>> Yêu cầu đăng ${postCount} bài viết`);

//     if (postCount <= 0) return { success: true, message: "Không cần đăng bài" };

//     const excelFilePath = path.join(__dirname, "../data/PI.xlsx");
//     const excelReader = new ExcelReaderService(excelFilePath);
    
//     const excelData = excelReader.readAllSheets();
    
//     const uid = excelData["prxageng"]["uid"] || [];
//     const piname = excelData["prxageng"]["piname"] || [];
//     const proxy = excelData["prxageng"]["proxy"] || [];
//     const ukey = excelData["prxageng"]["ukey"] || [];
//     const userAgent = excelData["prxageng"]["user_agent"] || [];
//     const titles = excelData["title"]["titles"] || [];
//     const contents = excelData["title"]["contents"] || [];
    
//     const userObjects = uid.map((user, index) => {
//       const newProxy = proxy[index].split(":");
//       return {
//         uid: user,
//         piname: piname[index],
//         ukey: ukey[index],
//         userAgent: userAgent[index],
//         proxy: {
//           host: newProxy[0],
//           port: newProxy[1],
//           name: newProxy[2],
//           password: newProxy[3],
//         },
//       };
//     });

//     if (userObjects.length === 0) {
//       return {
//         success: false,
//         message: "Không tìm thấy dữ liệu user từ file Excel",
//       };
//     }

//     if (titles.length === 0 || contents.length === 0) {
//       return {
//         success: false,
//         message: "Không tìm thấy nội dung bài viết (tiêu đề hoặc nội dung) từ file Excel",
//       };
//     }

//     console.log(`>> Tìm thấy ${userObjects.length} users, ${titles.length} tiêu đề, ${contents.length} nội dung`);
//     console.log(`>> Bắt đầu đăng bài...`);
    
//     const allPostPromises = [];
    
//     for (const [userIndex, user] of userObjects.entries()) {
//       console.log(`\n>> Chuẩn bị xử lý user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      
//       const api = apiClient(user);
      
//       for (let i = 0; i < postCount; i++) {
//         const postPromise = (async () => {
//           console.log(`\n>> Bắt đầu đăng bài với user ${user.piname} - Task ${i + 1}/${postCount}`);
          
//           const randomTitle = titles[Math.floor(Math.random() * titles.length)];
//           const randomContentFilter = contents.filter((t) => t != null && t != '');
//           const randomContent = randomContentFilter[Math.floor(Math.random() * randomContentFilter.length)];
          
//           const uniqueTitle = randomTitle;
          
//           console.log(`>> Đang lấy ảnh cho bài viết từ service...`);
//           let imageUrl;
//           try {
//             imageUrl = await getImageUrl();
//             console.log(`>> Đã lấy được ảnh: ${imageUrl}`);
//           } catch (error) {
//             console.error(`❌ Lỗi khi lấy ảnh: ${error.message}`);
//             imageUrl = "https://asset.vcity.app/vfile/2024/11/25/01/1732528133865582447460541631585-thumb.jpg"; // Ảnh mặc định
//           }
          
            
//           const galleryId = imageUrl.split('/').pop().split('.')[0];
//           console.log(`>> Sử dụng gallery ID: ${galleryId}`);
          
//           const maxRetries = 2;
//           let retryCount = 0;
          
//           const urlVariants = ['/vapi', '/vapi/', 'vapi'];
//           let currentUrlVariantIndex = 0;
          
//           while (retryCount <= maxRetries) {
//             try {
//               if (retryCount > 0) {
//                 console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho đăng bài với user ${user.piname}`);
//                 await sleep(3000 * retryCount);
//               }
              
//               const payload = qs.stringify({
//                 gallery: imageUrl,
//                 update_country: 1,
//                 update_multi_country: JSON.stringify({ 1: 1 }),
//                 update_chain: 0,
//                 update_multi_chain: JSON.stringify({ 0: 1 }),
//                 component: "article",
//                 action: "create",
//                 title: uniqueTitle,
//                 content: randomContent,
//                 user_name: user.piname,
//                 english_version: 0,
//                 selected_country: 1,
//                 selected_chain: 0,
//               });
              
//               const currentUrl = urlVariants[currentUrlVariantIndex];
              
//               console.log(`>> [Task ${userIndex+1}-${i+1}] Đăng bài "${uniqueTitle.substring(0, 30)}..." với user ${user.piname}`);
//               const response = await api.post(currentUrl, payload);
              
//               console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
              
//               if (response.data && 
//                   response.data.hasOwnProperty('data') && 
//                   response.data.data && 
//                   response.data.data.status === 1) {
//                 console.log(`✅ [Task ${userIndex+1}-${i+1}] User ${user.piname} đã đăng bài thành công!`);
//                 if (response.data.data.id) {
//                   console.log(`✅ [Task ${userIndex+1}-${i+1}] Bài viết mới có ID: ${response.data.data.id}`);
//                 }
//                 return { success: true, articleId: response.data.data.id };
//               } else {
//                 console.log(`⚠️ [Task ${userIndex+1}-${i+1}] User ${user.piname} đăng bài không thành công:`, response.data);
//                 return { success: false };
//               }
//             } catch (error) {
//               console.error(`❌ [Task ${userIndex+1}-${i+1}] Lỗi khi đăng bài với user ${user.piname}:`, error.message);
              
              
//               if (error.response) {
//                 console.error(`Mã lỗi: ${error.response.status}`);
//                 console.error(`URL gọi: ${error.config?.url}`);
//                 console.error(`URL đầy đủ: ${error.config?.baseURL}${error.config?.url}`);
//                 console.error(`Phương thức: ${error.config?.method.toUpperCase()}`);
                
                
//                 if ([404, 429, 500, 502, 503, 504].includes(error.response.status)) {
//                   retryCount++;
//                   if (retryCount <= maxRetries) {
//                     console.log(`>> [Task ${userIndex+1}-${i+1}] Sẽ thử lại sau ${3 * retryCount} giây...`);
//                     if (error.response.status === 404) {
//                       console.error(`❗️ [Task ${userIndex+1}-${i+1}] Lỗi 404: URL không tồn tại, kiểm tra lại endpoint`);
//                       currentUrlVariantIndex = (currentUrlVariantIndex + 1) % urlVariants.length;
//                       console.error(`❗️ [Task ${userIndex+1}-${i+1}] Sẽ thử với biến thể URL mới: ${urlVariants[currentUrlVariantIndex]}`);
//                     }
                    
//                     await sleep(3000 * retryCount);
//                     continue;
//                   }
//                 }
//               }
              
//               return { success: false };
//             }
//           }
          
        
//           return { success: false };
//         })();
        
//         allPostPromises.push(postPromise);
        
//         await sleep(500 + Math.floor(Math.random() * 500));
//       }
//     }
    
//     const totalTasks = allPostPromises.length;
//     console.log(`>> Tổng số ${totalTasks} bài viết đang được xử lý đồng thời...`);
    
    
//     let progressSuccessCount = 0;
//     let progressFailCount = 0;
//     let createdArticleIds = []; 
    

//     updateProgressStatus(totalTasks, progressSuccessCount, progressFailCount, totalTasks);
    
    
//     const progressInterval = setInterval(() => {
//       updateProgressStatus(
//         totalTasks, 
//         progressSuccessCount, 
//         progressFailCount, 
//         totalTasks - (progressSuccessCount + progressFailCount)
//       );
//     }, 3000);
    
    
//     const results = [];
//     for (const [index, promise] of allPostPromises.entries()) {
//       try {
//         const result = await promise;
//         if (result.success) {
//           progressSuccessCount++;
//           if (result.articleId) {
//             createdArticleIds.push(result.articleId);
//           }
//         } else {
//           progressFailCount++;
//         }
//         results.push({ status: 'fulfilled', value: result });
//       } catch (error) {
//         console.error(`❌ Lỗi không xác định với promise #${index}: ${error.message}`);
//         progressFailCount++;
//         results.push({ status: 'rejected', reason: error.message });
//       }
      
      
//       if ((index + 1) % 5 === 0 || index === allPostPromises.length - 1) {
//         updateProgressStatus(
//           totalTasks, 
//           progressSuccessCount, 
//           progressFailCount, 
//           totalTasks - (progressSuccessCount + progressFailCount)
//         );
//       }
//     }
    

//     clearInterval(progressInterval);
    
    
//     updateProgressStatus(totalTasks, progressSuccessCount, progressFailCount, 0);
    
//     console.log(`\n>> Kết quả cuối cùng: ${progressSuccessCount} bài viết đăng thành công, ${progressFailCount} bài viết thất bại`);
//     console.log(`>> Tổng số bài viết đã tạo: ${createdArticleIds.length}`);
//     if (createdArticleIds.length > 0) {
//       console.log(`>> ID các bài viết đã tạo: ${createdArticleIds.join(', ')}`);
//     }
    
//     return { 
//       success: progressSuccessCount > 0, 
//       message: `Đã đăng ${progressSuccessCount}/${progressSuccessCount + progressFailCount} bài viết thành công!`,
//       stats: {
//         total: progressSuccessCount + progressFailCount,
//         success: progressSuccessCount,
//         failure: progressFailCount,
//         articleIds: createdArticleIds
//       }
//     };
//   } catch (error) {
//     console.error(`❌ Lỗi không xử lý được: ${error.message}`);
//     return {
//       success: false,
//       message: `Đã xảy ra lỗi khi đăng bài: ${error.message}`,
//       error: error.toString()
//     };
//   }
// }

// module.exports = { handlePostArticles };
// const ExcelReaderService = require("../models/excelSheed");
// const apiClient = require("../api/apiClient");
// const path = require("path");
// const qs = require("qs");
// const getImageUrl = require("../services/serviceGetImage");


// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }


// function updateProgressStatus(total, success, fail, processing) {
//   const completed = success + fail;
//   const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
//   const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
//   console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ ĐĂNG BÀI --------`);
//   console.log(`[${bar}] ${percent}% (${completed}/${total})`);
//   console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
//   console.log(`------------------------------------------\n`);
// }

// // Hàm tách câu thành các cụm từ
// function splitIntoChunks(text) {
//   // Tách theo dấu phẩy, chấm, và các ký tự đặc biệt
//   return text.split(/[,.!?;]/)
//     .map(chunk => chunk.trim())
//     .filter(chunk => chunk.length > 0);
// }

// // Hàm kết hợp các cụm từ ngẫu nhiên
// function combineRandomPhrases(phrases, minPhrases = 2, maxPhrases = 4) {
//   const numPhrases = Math.floor(Math.random() * (maxPhrases - minPhrases + 1)) + minPhrases;
//   const selectedPhrases = [];
//   const usedIndexes = new Set();

//   while (selectedPhrases.length < numPhrases && usedIndexes.size < phrases.length) {
//     const randomIndex = Math.floor(Math.random() * phrases.length);
//     if (!usedIndexes.has(randomIndex)) {
//       usedIndexes.add(randomIndex);
//       selectedPhrases.push(phrases[randomIndex]);
//     }
//   }

//   return selectedPhrases.join(', ');
// }

// // Hàm tạo tiêu đề độc đáo
// function generateUniqueTitle(titles) {
//   // Tạo pool các cụm từ từ tất cả tiêu đề
//   const phrasePool = titles.reduce((acc, title) => {
//     if (title) {
//       acc.push(...splitIntoChunks(title));
//     }
//     return acc;
//   }, []);

//   // Kết hợp 2-3 cụm từ ngẫu nhiên
//   return combineRandomPhrases(phrasePool, 2, 3);
// }

// // Hàm tạo nội dung độc đáo
// function generateUniqueContent(contents) {
//   // Tạo pool các cụm từ từ tất cả nội dung
//   const phrasePool = contents.reduce((acc, content) => {
//     if (content) {
//       acc.push(...splitIntoChunks(content));
//     }
//     return acc;
//   }, []);

//   // Kết hợp 3-5 cụm từ ngẫu nhiên
//   return combineRandomPhrases(phrasePool, 3, 5);
// }

// async function handlePostArticles(req) {
//   try {
//     const postCount = req;
//     console.log(`>> Yêu cầu đăng ${postCount} bài viết`);

//     if (postCount <= 0) return { success: true, message: "Không cần đăng bài" };

//     const excelFilePath = path.join(__dirname, "../data/PI.xlsx");
//     const excelReader = new ExcelReaderService(excelFilePath);
    
//     const excelData = excelReader.readAllSheets();
    
//     const uid = excelData["prxageng"]["uid"] || [];
//     const piname = excelData["prxageng"]["piname"] || [];
//     const proxy = excelData["prxageng"]["proxy"] || [];
//     const ukey = excelData["prxageng"]["ukey"] || [];
//     const userAgent = excelData["prxageng"]["user_agent"] || [];
//     const titles = excelData["title"]["titles"] || [];
//     const contents = excelData["title"]["contents"] || [];
    
//     const userObjects = uid.map((user, index) => {
//       const newProxy = proxy[index].split(":");
//       return {
//         uid: user,
//         piname: piname[index],
//         ukey: ukey[index],
//         userAgent: userAgent[index],
//         proxy: {
//           host: newProxy[0],
//           port: newProxy[1],
//           name: newProxy[2],
//           password: newProxy[3],
//         },
//       };
//     });

//     if (userObjects.length === 0) {
//       return {
//         success: false,
//         message: "Không tìm thấy dữ liệu user từ file Excel",
//       };
//     }

//     if (titles.length === 0 || contents.length === 0) {
//       return {
//         success: false,
//         message: "Không tìm thấy nội dung bài viết (tiêu đề hoặc nội dung) từ file Excel",
//       };
//     }

//     console.log(`>> Tìm thấy ${userObjects.length} users, ${titles.length} tiêu đề, ${contents.length} nội dung`);
//     console.log(`>> Bắt đầu đăng bài...`);
    
//     const allPostPromises = [];
    
//     for (const [userIndex, user] of userObjects.entries()) {
//       console.log(`\n>> Chuẩn bị xử lý user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      
//       const api = apiClient(user);
      
//       for (let i = 0; i < postCount; i++) {
//         const postPromise = (async () => {
//           console.log(`\n>> Bắt đầu đăng bài với user ${user.piname} - Task ${i + 1}/${postCount}`);
          
//           // Tạo tiêu đề và nội dung độc đáo
//           const uniqueTitle = generateUniqueTitle(titles);
//           const uniqueContent = generateUniqueContent(contents);
          
//           // Thêm timestamp để đảm bảo độc đáo hơn nữa
//           const timestamp = new Date().getTime();
//           const finalTitle = `${uniqueTitle} #${timestamp % 1000}`;

//           console.log(`>> Tiêu đề được tạo: ${finalTitle}`);
//           console.log(`>> Nội dung được tạo: ${uniqueContent}`);

//           console.log(`>> Đang lấy ảnh cho bài viết từ service...`);
//           let imageUrl;
//           try {
//             imageUrl = await getImageUrl();
//             console.log(`>> Đã lấy được ảnh: ${imageUrl}`);
//           } catch (error) {
//             console.error(`❌ Lỗi khi lấy ảnh: ${error.message}`);
//             imageUrl = "https://asset.vcity.app/vfile/2024/11/25/01/1732528133865582447460541631585-thumb.jpg"; // Ảnh mặc định
//           }
          
            
//           const galleryId = imageUrl.split('/').pop().split('.')[0];
//           console.log(`>> Sử dụng gallery ID: ${galleryId}`);
          
//           const maxRetries = 2;
//           let retryCount = 0;
          
//           const urlVariants = ['/vapi', '/vapi/', 'vapi'];
//           let currentUrlVariantIndex = 0;
          
//           while (retryCount <= maxRetries) {
//             try {
//               if (retryCount > 0) {
//                 console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho đăng bài với user ${user.piname}`);
//                 await sleep(3000 * retryCount);
//               }
              
//               const payload = qs.stringify({
//                 gallery: imageUrl,
//                 update_country: 1,
//                 update_multi_country: JSON.stringify({ 1: 1 }),
//                 update_chain: 0,
//                 update_multi_chain: JSON.stringify({ 0: 1 }),
//                 component: "article",
//                 action: "create",
//                 title: finalTitle,
//                 content: uniqueContent,
//                 user_name: user.piname,
//                 english_version: 0,
//                 selected_country: 1,
//                 selected_chain: 0,
//               });
              
//               const currentUrl = urlVariants[currentUrlVariantIndex];
              
//               console.log(`>> [Task ${userIndex+1}-${i+1}] Đăng bài "${finalTitle.substring(0, 30)}..." với user ${user.piname}`);
//               const response = await api.post(currentUrl, payload);
              
//               console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
              
//               if (response.data && 
//                   response.data.hasOwnProperty('data') && 
//                   response.data.data && 
//                   response.data.data.status === 1) {
//                 console.log(`✅ [Task ${userIndex+1}-${i+1}] User ${user.piname} đã đăng bài thành công!`);
//                 if (response.data.data.id) {
//                   console.log(`✅ [Task ${userIndex+1}-${i+1}] Bài viết mới có ID: ${response.data.data.id}`);
//                 }
//                 return { success: true, articleId: response.data.data.id };
//               } else {
//                 console.log(`⚠️ [Task ${userIndex+1}-${i+1}] User ${user.piname} đăng bài không thành công:`, response.data);
//                 return { success: false };
//               }
//             } catch (error) {
//               console.error(`❌ [Task ${userIndex+1}-${i+1}] Lỗi khi đăng bài với user ${user.piname}:`, error.message);
              
              
//               if (error.response) {
//                 console.error(`Mã lỗi: ${error.response.status}`);
//                 console.error(`URL gọi: ${error.config?.url}`);
//                 console.error(`URL đầy đủ: ${error.config?.baseURL}${error.config?.url}`);
//                 console.error(`Phương thức: ${error.config?.method.toUpperCase()}`);
                
                
//                 if ([404, 429, 500, 502, 503, 504].includes(error.response.status)) {
//                   retryCount++;
//                   if (retryCount <= maxRetries) {
//                     console.log(`>> [Task ${userIndex+1}-${i+1}] Sẽ thử lại sau ${3 * retryCount} giây...`);
//                     if (error.response.status === 404) {
//                       console.error(`❗️ [Task ${userIndex+1}-${i+1}] Lỗi 404: URL không tồn tại, kiểm tra lại endpoint`);
//                       currentUrlVariantIndex = (currentUrlVariantIndex + 1) % urlVariants.length;
//                       console.error(`❗️ [Task ${userIndex+1}-${i+1}] Sẽ thử với biến thể URL mới: ${urlVariants[currentUrlVariantIndex]}`);
//                     }
                    
//                     await sleep(3000 * retryCount);
//                     continue;
//                   }
//                 }
//               }
              
//               return { success: false };
//             }
//           }
          
        
//           return { success: false };
//         })();
        
//         allPostPromises.push(postPromise);
        
//         await sleep(500 + Math.floor(Math.random() * 500));
//       }
//     }
    
//     const totalTasks = allPostPromises.length;
//     console.log(`>> Tổng số ${totalTasks} bài viết đang được xử lý đồng thời...`);
    
    
//     let progressSuccessCount = 0;
//     let progressFailCount = 0;
//     let createdArticleIds = []; 
    

//     updateProgressStatus(totalTasks, progressSuccessCount, progressFailCount, totalTasks);
    
    
//     const progressInterval = setInterval(() => {
//       updateProgressStatus(
//         totalTasks, 
//         progressSuccessCount, 
//         progressFailCount, 
//         totalTasks - (progressSuccessCount + progressFailCount)
//       );
//     }, 3000);
    
    
//     const results = [];
//     for (const [index, promise] of allPostPromises.entries()) {
//       try {
//         const result = await promise;
//         if (result.success) {
//           progressSuccessCount++;
//           if (result.articleId) {
//             createdArticleIds.push(result.articleId);
//           }
//         } else {
//           progressFailCount++;
//         }
//         results.push({ status: 'fulfilled', value: result });
//       } catch (error) {
//         console.error(`❌ Lỗi không xác định với promise #${index}: ${error.message}`);
//         progressFailCount++;
//         results.push({ status: 'rejected', reason: error.message });
//       }
      
      
//       if ((index + 1) % 5 === 0 || index === allPostPromises.length - 1) {
//         updateProgressStatus(
//           totalTasks, 
//           progressSuccessCount, 
//           progressFailCount, 
//           totalTasks - (progressSuccessCount + progressFailCount)
//         );
//       }
//     }
    

//     clearInterval(progressInterval);
    
    
//     updateProgressStatus(totalTasks, progressSuccessCount, progressFailCount, 0);
    
//     console.log(`\n>> Kết quả cuối cùng: ${progressSuccessCount} bài viết đăng thành công, ${progressFailCount} bài viết thất bại`);
//     console.log(`>> Tổng số bài viết đã tạo: ${createdArticleIds.length}`);
//     if (createdArticleIds.length > 0) {
//       console.log(`>> ID các bài viết đã tạo: ${createdArticleIds.join(', ')}`);
//     }
    
//     return { 
//       success: progressSuccessCount > 0, 
//       message: `Đã đăng ${progressSuccessCount}/${progressSuccessCount + progressFailCount} bài viết thành công!`,
//       stats: {
//         total: progressSuccessCount + progressFailCount,
//         success: progressSuccessCount,
//         failure: progressFailCount,
//         articleIds: createdArticleIds
//       }
//     };
//   } catch (error) {
//     console.error(`❌ Lỗi không xử lý được: ${error.message}`);
//     return {
//       success: false,
//       message: `Đã xảy ra lỗi khi đăng bài: ${error.message}`,
//       error: error.toString()
//     };
//   }
// }

// module.exports = { handlePostArticles };
const ExcelReaderService = require("../models/excelSheed");
const apiClient = require("../api/apiClient");
const path = require("path");
const qs = require("qs");
const getImageUrl = require("../services/serviceGetImage");


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function updateProgressStatus(total, success, fail, processing) {
  const completed = success + fail;
  const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
  const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
  console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ ĐĂNG BÀI --------`);
  console.log(`[${bar}] ${percent}% (${completed}/${total})`);
  console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
  console.log(`------------------------------------------\n`);
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

function generateMixedContent(sourceTexts, minParts = 2, maxParts = 4) {

  const wordPool = sourceTexts.reduce((acc, text) => {
    if (text) {
      acc.push(...splitIntoWords(text));
    }
    return acc;
  }, []);

  const phrasePool = sourceTexts.reduce((acc, text) => {
    if (text) {
      acc.push(...splitIntoPhrases(text));
    }
    return acc;
  }, []);

  const mixingStyle = Math.floor(Math.random() * 4);
  const parts = [];
  const numParts = Math.floor(Math.random() * (maxParts - minParts + 1)) + minParts;

  switch (mixingStyle) {
    case 0: 
      for (let i = 0; i < numParts; i++) {
        parts.push(getRandomElement(phrasePool));
      }
      return parts.join(', ');

    case 1: 
      for (let i = 0; i < numParts + 2; i++) {
        parts.push(getRandomElement(wordPool));
      }
      return parts.join(' ');

    case 2: 
      for (let i = 0; i < numParts; i++) {
        if (Math.random() > 0.5) {
          parts.push(getRandomElement(phrasePool));
        } else {
          const numWords = Math.floor(Math.random() * 3) + 1;
          const words = [];
          for (let j = 0; j < numWords; j++) {
            words.push(getRandomElement(wordPool));
          }
          parts.push(words.join(' '));
        }
      }
      return parts.join(', ');

    case 3: 
      const mainPhrase = getRandomElement(phrasePool);
      const words = [];
      for (let i = 0; i < 2; i++) {
        words.push(getRandomElement(wordPool));
      }
      return `${mainPhrase} ${words.join(' ')}`;
  }
}


function generateUniqueTitle(titles) {
  const title = generateMixedContent(titles, 2, 3);
  return `${title}`;
}


function generateUniqueContent(contents) {
  return generateMixedContent(contents, 3, 5);
}

async function handlePostArticles(req) {
  try {
    const postCount = req;
    console.log(`>> Yêu cầu đăng ${postCount} bài viết`);

    if (postCount <= 0) return { success: true, message: "Không cần đăng bài" };
    
    const excelFilePath = path.join(__dirname, "../data/PI.xlsx");
    const excelReader = new ExcelReaderService(excelFilePath);
    
    const excelData = excelReader.readAllSheets();
    
    const uid = excelData["prxageng"]["uid"] || [];
    const piname = excelData["prxageng"]["piname"] || [];
    const proxy = excelData["prxageng"]["proxy"] || [];
    const ukey = excelData["prxageng"]["ukey"] || [];
    const userAgent = excelData["prxageng"]["user_agent"] || [];
    const titles = excelData["title"]["titles"] || [];
    const contents = excelData["title"]["contents"] || [];
    
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

    if (titles.length === 0 || contents.length === 0) {
      return {
        success: false,
        message: "Không tìm thấy nội dung bài viết (tiêu đề hoặc nội dung) từ file Excel",
      };
    }

    console.log(`>> Tìm thấy ${userObjects.length} users, ${titles.length} tiêu đề, ${contents.length} nội dung`);
    console.log(`>> Bắt đầu đăng bài...`);
    
    const allPostPromises = [];
    
    for (const [userIndex, user] of userObjects.entries()) {
      console.log(`\n>> Chuẩn bị xử lý user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      
      const api = apiClient(user);
      
      for (let i = 0; i < postCount; i++) {
        const postPromise = (async () => {
          console.log(`\n>> Bắt đầu đăng bài với user ${user.piname} - Task ${i + 1}/${postCount}`);
          
          const finalTitle = generateUniqueTitle(titles);
          const uniqueContent = generateUniqueContent(contents);

          console.log(`>> Tiêu đề được tạo: ${finalTitle}`);
          console.log(`>> Nội dung được tạo: ${uniqueContent}`);

          console.log(`>> Đang lấy ảnh cho bài viết từ service...`);
          let imageUrl;
          try {
            imageUrl = await getImageUrl();
            console.log(`>> Đã lấy được ảnh: ${imageUrl}`);
          } catch (error) {
            console.error(`❌ Lỗi khi lấy ảnh: ${error.message}`);
            imageUrl = "https://asset.vcity.app/vfile/2024/11/25/01/1732528133865582447460541631585-thumb.jpg"; // Ảnh mặc định
          }
          
            
          const galleryId = imageUrl.split('/').pop().split('.')[0];
          console.log(`>> Sử dụng gallery ID: ${galleryId}`);
          
          const maxRetries = 2;
          let retryCount = 0;
          
          const urlVariants = ['/vapi', '/vapi/', 'vapi'];
          let currentUrlVariantIndex = 0;
          
          while (retryCount <= maxRetries) {
            try {
              if (retryCount > 0) {
                console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho đăng bài với user ${user.piname}`);
                await sleep(3000 * retryCount);
              }
              
              const payload = qs.stringify({
                gallery: imageUrl,
                update_country: 1,
                update_multi_country: JSON.stringify({ 1: 1 }),
                update_chain: 0,
                update_multi_chain: JSON.stringify({ 0: 1 }),
                component: "article",
                action: "create",
                title: finalTitle,
                content: uniqueContent,
                user_name: user.piname,
                english_version: 0,
                selected_country: 1,
                selected_chain: 0,
              });
              
              const currentUrl = urlVariants[currentUrlVariantIndex];
              
              console.log(`>> [Task ${userIndex+1}-${i+1}] Đăng bài "${finalTitle.substring(0, 30)}..." với user ${user.piname}`);
              const response = await api.post(currentUrl, payload);
              
              console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
              
              if (response.data && 
                  response.data.hasOwnProperty('data') && 
                  response.data.data && 
                  response.data.data.status === 1) {
                console.log(`✅ [Task ${userIndex+1}-${i+1}] User ${user.piname} đã đăng bài thành công!`);
                if (response.data.data.id) {
                  console.log(`✅ [Task ${userIndex+1}-${i+1}] Bài viết mới có ID: ${response.data.data.id}`);
                }
                return { success: true, articleId: response.data.data.id };
              } else {
                console.log(`⚠️ [Task ${userIndex+1}-${i+1}] User ${user.piname} đăng bài không thành công:`, response.data);
                return { success: false };
              }
            } catch (error) {
              console.error(`❌ [Task ${userIndex+1}-${i+1}] Lỗi khi đăng bài với user ${user.piname}:`, error.message);
              
              
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
              
              return { success: false };
            }
          }
          
        
          return { success: false };
        })();
        
        allPostPromises.push(postPromise);
        
        await sleep(500 + Math.floor(Math.random() * 500));
      }
    }
    
    const totalTasks = allPostPromises.length;
    console.log(`>> Tổng số ${totalTasks} bài viết đang được xử lý đồng thời...`);
    
    
    let progressSuccessCount = 0;
    let progressFailCount = 0;
    let createdArticleIds = []; 
    

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
    for (const [index, promise] of allPostPromises.entries()) {
      try {
        const result = await promise;
        if (result.success) {
          progressSuccessCount++;
          if (result.articleId) {
            createdArticleIds.push(result.articleId);
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
      
      
      if ((index + 1) % 5 === 0 || index === allPostPromises.length - 1) {
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
    
    console.log(`\n>> Kết quả cuối cùng: ${progressSuccessCount} bài viết đăng thành công, ${progressFailCount} bài viết thất bại`);
    console.log(`>> Tổng số bài viết đã tạo: ${createdArticleIds.length}`);
    if (createdArticleIds.length > 0) {
      console.log(`>> ID các bài viết đã tạo: ${createdArticleIds.join(', ')}`);
    }
    
    return { 
      success: progressSuccessCount > 0, 
      message: `Đã đăng ${progressSuccessCount}/${progressSuccessCount + progressFailCount} bài viết thành công!`,
      stats: {
        total: progressSuccessCount + progressFailCount,
        success: progressSuccessCount,
        failure: progressFailCount,
        articleIds: createdArticleIds
      }
    };
  } catch (error) {
    console.error(`❌ Lỗi không xử lý được: ${error.message}`);
    return {
      success: false,
      message: `Đã xảy ra lỗi khi đăng bài: ${error.message}`,
      error: error.toString()
    };
  }
}

module.exports = { handlePostArticles };
