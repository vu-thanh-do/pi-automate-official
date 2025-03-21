const path = require('path');
const ExcelReaderService = require('../models/excelSheed');
const apiClient = require('../api/apiClient');
const qs = require("qs");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function updateProgressStatus(total, success, fail, processing) {
  const completed = success + fail;
  const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
  const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
  console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ ĐĂNG NHẬP --------`);
  console.log(`[${bar}] ${percent}% (${completed}/${total})`);
  console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
  console.log(`-----------------------------------------\n`);
}

async function handleLogin(req) {
  try {
    const countLogin = req;
    console.log(`>> Yêu cầu đăng nhập ${countLogin} tài khoản`);
    if (countLogin <= 0) return { success: true, message: "Không cần đăng nhập" };
    
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

    console.log(`>> Tìm thấy ${userObjects.length} tài khoản`);
    
   
    const loginPromises = [];
    const usersToLogin = userObjects

    for (const [userIndex, user] of usersToLogin.entries()) {
      const loginPromise = (async () => {
        console.log(`\n>> Đang đăng nhập tài khoản ${userIndex + 1}/${countLogin}: ${user.piname}`);
        
        const maxRetries = 2;
        let retryCount = 0;
        
        while (retryCount <= maxRetries) {
          try {
            if (retryCount > 0) {
              console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho tài khoản ${user.piname}`);
              await sleep(3000 * retryCount);
            }

            const api = apiClient(user);
            const payload = qs.stringify({
              component: "signin",
              action: "go",
              user_name: user.piname,
              english_version: 0,
              selected_country: 1,
              selected_chain: 0
            });

            const response = await api.post('/api', payload);
            
            if (response.data && response.data.status && response.data.task) {
              console.log(`✅ Đăng nhập thành công tài khoản ${user.piname}`);
              return { success: true, userId: user.uid, piname: user.piname };
            } else {
              console.log(`⚠️ Đăng nhập không thành công tài khoản ${user.piname}:`, response.data);
              return { success: false, userId: user.uid, piname: user.piname };
            }
          } catch (error) {
            console.error(`❌ Lỗi khi đăng nhập tài khoản ${user.piname}:`, error.message);
            
            if (error.response && [404, 429, 500, 502, 503, 504].includes(error.response.status)) {
              retryCount++;
              if (retryCount <= maxRetries) {
                await sleep(3000 * retryCount);
                continue;
              }
            }
            
            return { success: false, userId: user.uid, piname: user.piname };
          }
        }
        
        return { success: false, userId: user.uid, piname: user.piname };
      })();
      
      loginPromises.push(loginPromise);
      await sleep(300 + Math.floor(Math.random() * 300));
    }

    const totalTasks = loginPromises.length;
    console.log(`>> Tổng số ${totalTasks} tài khoản đang được đăng nhập...`);
    
    let progressSuccessCount = 0;
    let progressFailCount = 0;
    let loginResults = new Map();
    
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
    for (const [index, promise] of loginPromises.entries()) {
      try {
        const result = await promise;
        if (result.success) {
          progressSuccessCount++;
          loginResults.set(result.userId, {
            piname: result.piname,
            status: 'success'
          });
        } else {
          progressFailCount++;
          loginResults.set(result.userId, {
            piname: result.piname,
            status: 'failed'
          });
        }
        results.push({ status: 'fulfilled', value: result });
      } catch (error) {
        console.error(`❌ Lỗi không xác định với promise #${index}: ${error.message}`);
        progressFailCount++;
        results.push({ status: 'rejected', reason: error.message });
      }
      
      if ((index + 1) % 5 === 0 || index === loginPromises.length - 1) {
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
    
    console.log(`\n>> Kết quả cuối cùng: ${progressSuccessCount} tài khoản đăng nhập thành công, ${progressFailCount} tài khoản thất bại`);
    
    return { 
      success: progressSuccessCount > 0, 
      message: `Đã đăng nhập ${progressSuccessCount}/${progressSuccessCount + progressFailCount} tài khoản thành công!`,
      stats: {
        total: progressSuccessCount + progressFailCount,
        success: progressSuccessCount,
        failure: progressFailCount,
        loginResults: Object.fromEntries(loginResults)
      }
    };
  } catch (error) {
    console.error(`❌ Lỗi không xử lý được: ${error.message}`);
    return {
      success: false,
      message: `Đã xảy ra lỗi khi đăng nhập: ${error.message}`,
      error: error.toString()
    };
  }
}

module.exports = handleLogin;
