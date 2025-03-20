const path = require('path');
const ExcelReaderService = require('../models/excelSheed');
const apiClient = require('../api/apiClient');
const qs = require("qs");
const getUserPosts = require("../services/getPostUser");

// Hàm tạm dừng thực thi
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Hàm cập nhật và hiển thị trạng thái tiến độ
function updateProgressStatus(total, success, fail, processing) {
  const completed = success + fail;
  const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
  const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
  console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ LIKE --------`);
  console.log(`[${bar}] ${percent}% (${completed}/${total})`);
  console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
  console.log(`-----------------------------------------\n`);
}

// Hàm chọn ngẫu nhiên n user từ danh sách
function getRandomUsers(users, n) {
  const shuffled = [...users].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

async function handleLikeEachOther(req) {
  try {
  const countLikeEachOther = req;
    console.log(`>> Yêu cầu like ${countLikeEachOther} bài viết cho mỗi user`);
    if (countLikeEachOther <= 0) return { success: true, message: "Không cần like" };

    const excelFilePath = path.join(__dirname, "../data/PI.xlsx");
    const excelReader = new ExcelReaderService(excelFilePath);
    const excelData = excelReader.readAllSheets();
    
    const uid = excelData["prxageng"]["uid"] || [];
    const piname = excelData["prxageng"]["piname"] || [];
    const proxy = excelData["prxageng"]["proxy"] || [];
    const ukey = excelData["prxageng"]["ukey"] || [];
    const userAgent = excelData["prxageng"]["user_agent"] || [];
    const listUserId = excelData["likeEachOther"]["profileId"] || [];

    if (listUserId.length === 0) {
      return {
        success: false,
        message: "Không tìm thấy danh sách user cần like",
      };
    }

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

    console.log(`>> Tìm thấy ${userObjects.length} users để like, ${listUserId.length} users cần được like`);
    
    // Tạo mảng các promises cho tất cả task like
    const allLikePromises = [];
    const usedUsersForPost = new Map(); // Theo dõi user đã like cho mỗi bài viết

    // Xử lý từng user trong listUserId
    for (const [targetUserIndex, targetUserId] of listUserId.entries()) {
      console.log(`\n>> Đang xử lý user ${targetUserIndex + 1}/${listUserId.length}: ${targetUserId}`);
      
      // Tạo user object cho user cần lấy bài viết
      const targetUser = {
        uid: targetUserId,
        piname: targetUserId, // Sử dụng ID làm piname tạm thời
        ukey: "", // Không cần ukey vì chỉ lấy bài viết
        userAgent: userObjects[0].userAgent, // Sử dụng userAgent từ user đầu tiên
        proxy: userObjects[0].proxy // Sử dụng proxy từ user đầu tiên
      };
      
      // Lấy danh sách bài viết của user
      const userPosts = await getUserPosts(targetUser);
      console.log(`>> Tìm thấy ${userPosts.length} bài viết của user ${targetUserId}`);

      // Lấy số bài viết cần like (countLikeEachOther bài gần nhất)
      const postsToLike = userPosts.slice(0, countLikeEachOther);
      console.log(`>> Sẽ like ${postsToLike.length} bài viết gần nhất`);

      // Xử lý từng bài viết
      for (const [postIndex, postId] of postsToLike.entries()) {
        // Chọn 3 user ngẫu nhiên để like bài viết
        const availableUsers = userObjects.filter(u => 
          !usedUsersForPost.get(postId)?.includes(u.uid)
        );

        if (availableUsers.length < 3) {
          console.log(`⚠️ Không đủ user để like bài ${postId} (cần 3, có ${availableUsers.length})`);
          continue;
        }

        const selectedUsers = getRandomUsers(availableUsers, 3);
        usedUsersForPost.set(postId, selectedUsers.map(u => u.uid));

        // Tạo promises cho việc like từ mỗi user
        for (const [likeUserIndex, likeUser] of selectedUsers.entries()) {
          const likePromise = (async () => {
            console.log(`\n>> Bắt đầu like bài ${postId} của user ${targetUserId} bởi ${likeUser.piname}`);
            
            const maxRetries = 2;
            let retryCount = 0;
            
            while (retryCount <= maxRetries) {
              try {
                if (retryCount > 0) {
                  console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho like bài ${postId}`);
                  await sleep(3000 * retryCount);
                }

                const api = apiClient(likeUser);
                const payload = qs.stringify({
                  component: "article",
                  action: "like",
                  aid: postId,
                  user_name: likeUser.piname,
                  english_version: 0,
                  selected_country: 1,
                  selected_chain: 0,
                });

                const response = await api.post('/vapi', payload);
                
                if (response.data && response.data.time) {
                  console.log(`✅ Đã like thành công bài ${postId} bởi ${likeUser.piname}`);
                  return { success: true, postId, userId: likeUser.uid, targetUserId };
                } else {
                  console.log(`⚠️ Like bài ${postId} không thành công:`, response.data);
                  return { success: false, postId, userId: likeUser.uid, targetUserId };
                }
              } catch (error) {
                console.error(`❌ Lỗi khi like bài ${postId} bởi ${likeUser.piname}:`, error.message);
                
                if (error.response && [404, 429, 500, 502, 503, 504].includes(error.response.status)) {
                  retryCount++;
                  if (retryCount <= maxRetries) {
                    await sleep(3000 * retryCount);
                    continue;
                  }
                }
                
                return { success: false, postId, userId: likeUser.uid, targetUserId };
              }
            }
            
            return { success: false, postId, userId: likeUser.uid, targetUserId };
          })();
          
          allLikePromises.push(likePromise);
          await sleep(300 + Math.floor(Math.random() * 300));
        }
      }
    }
    
    const totalTasks = allLikePromises.length;
    console.log(`>> Tổng số ${totalTasks} lượt like đang được xử lý...`);
    
    if (totalTasks === 0) {
      return {
        success: true,
        message: "Không có bài nào để like",
        stats: {
          total: 0,
          success: 0,
          failure: 0
        }
      };
    }
    
    let progressSuccessCount = 0;
    let progressFailCount = 0;
    let likedPosts = new Map();
    
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
          if (!likedPosts.has(result.targetUserId)) {
            likedPosts.set(result.targetUserId, []);
          }
          likedPosts.get(result.targetUserId).push({
            postId: result.postId,
            likedBy: result.userId
          });
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
    
    console.log(`\n>> Kết quả cuối cùng: ${progressSuccessCount} lượt like thành công, ${progressFailCount} lượt thất bại`);
    
    return { 
      success: progressSuccessCount > 0, 
      message: `Đã like ${progressSuccessCount}/${progressSuccessCount + progressFailCount} lượt thành công!`,
      stats: {
        total: progressSuccessCount + progressFailCount,
        success: progressSuccessCount,
        failure: progressFailCount,
        likedPosts: Object.fromEntries(likedPosts)
      }
    };
  } catch (error) {
    console.error(`❌ Lỗi không xử lý được: ${error.message}`);
    return {
      success: false,
      message: `Đã xảy ra lỗi khi likeEachOther: ${error.message}`,
      error: error.toString()
    };
  }
}

module.exports = handleLikeEachOther;
