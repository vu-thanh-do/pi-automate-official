const ExcelReaderService = require("../models/excelSheed");
const apiClient = require("../api/apiClient");
const path = require("path");
const qs = require("qs");
const getImageUrl = require("../services/serviceGetImage");

// Hàm tạm dừng thực thi để tránh request quá nhanh
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Hàm cập nhật và hiển thị trạng thái tiến độ theo thời gian thực
function updateProgressStatus(total, success, fail, processing) {
  const completed = success + fail;
  const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
  const bar = Array(20).fill('▒').map((char, i) => i < Math.floor(percent / 5) ? '█' : '▒').join('');
  
  console.log(`\n-------- TRẠNG THÁI TIẾN ĐỘ ĐĂNG BÀI --------`);
  console.log(`[${bar}] ${percent}% (${completed}/${total})`);
  console.log(`✅ Thành công: ${success} | ❌ Thất bại: ${fail} | ⏳ Đang xử lý: ${processing}`);
  console.log(`------------------------------------------\n`);
}

async function handlePostArticles(req) {
  try {
    const postCount = req;
    console.log(`>> Yêu cầu đăng ${postCount} bài viết`);

    if (postCount <= 0) return { success: true, message: "Không cần đăng bài" };

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
    const titles = excelData["title"]["titles"] || [];
    const contents = excelData["title"]["contents"] || [];

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

    // Kiểm tra dữ liệu trước khi tiếp tục
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
    
    // Tạo mảng các promises cho tất cả task đăng bài
    const allPostPromises = [];
    
    for (const [userIndex, user] of userObjects.entries()) {
      console.log(`\n>> Chuẩn bị xử lý user ${userIndex + 1}/${userObjects.length}: ${user.piname}`);
      
      const api = apiClient(user);
      
      // Tạo các promises cho mỗi bài đăng của user hiện tại
      for (let i = 0; i < postCount; i++) {
        // Tạo một promise cho mỗi bài đăng và thêm vào mảng
        const postPromise = (async () => {
          console.log(`\n>> Bắt đầu đăng bài với user ${user.piname} - Task ${i + 1}/${postCount}`);
          
          // Chọn ngẫu nhiên tiêu đề và nội dung từ danh sách
          const randomTitle = titles[Math.floor(Math.random() * titles.length)];
          const randomContent = contents[Math.floor(Math.random() * contents.length)];
          
          // Thêm giá trị ngẫu nhiên vào tiêu đề để tránh trùng lặp
          const uniqueTitle = `${randomTitle} #${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`;
          
          // Lấy ảnh từ service
          console.log(`>> Đang lấy ảnh cho bài viết từ service...`);
          let imageUrl;
          try {
            imageUrl = await getImageUrl();
            console.log(`>> Đã lấy được ảnh: ${imageUrl}`);
          } catch (error) {
            console.error(`❌ Lỗi khi lấy ảnh: ${error.message}`);
            imageUrl = "https://asset.vcity.app/vfile/2024/11/25/01/1732528133865582447460541631585-thumb.jpg"; // Ảnh mặc định
          }
          
          // Lấy gallery ID từ URL hình ảnh
          const galleryId = imageUrl.split('/').pop().split('.')[0];
          console.log(`>> Sử dụng gallery ID: ${galleryId}`);
          
          // Thiết lập số lần thử lại tối đa
          const maxRetries = 2;
          let retryCount = 0;
          
          // Mảng các biến thể URL để thử
          const urlVariants = ['/vapi', '/vapi/', 'vapi'];
          let currentUrlVariantIndex = 0;
          
          while (retryCount <= maxRetries) {
            try {
              if (retryCount > 0) {
                console.log(`>> Thử lại lần ${retryCount}/${maxRetries} cho đăng bài với user ${user.piname}`);
                // Đợi trước khi thử lại
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
                title: uniqueTitle,
                content: randomContent,
                user_name: user.piname,
                english_version: 0,
                selected_country: 1,
                selected_chain: 0,
              });
              
              // Sử dụng biến thể URL hiện tại
              const currentUrl = urlVariants[currentUrlVariantIndex];
              
              // Thực hiện gọi API
              console.log(`>> [Task ${userIndex+1}-${i+1}] Đăng bài "${uniqueTitle.substring(0, 30)}..." với user ${user.piname}`);
              const response = await api.post(currentUrl, payload);
              
              // Log chi tiết response để debug
              console.log(`>> [Task ${userIndex+1}-${i+1}] Status code: ${response.status}`);
              
              // Kiểm tra kết quả - giả định thành công nếu có response data và status = 1
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
              
              return { success: false };
            }
          }
          
          // Nếu vòng lặp kết thúc mà không return, xem như thất bại
          return { success: false };
        })();
        
        allPostPromises.push(postPromise);
        
        // Thêm một khoảng delay ngẫu nhiên giữa việc khởi tạo các promises
        // để tránh gửi quá nhiều requests cùng một lúc
        await sleep(500 + Math.floor(Math.random() * 500));
      }
    }
    
    const totalTasks = allPostPromises.length;
    console.log(`>> Tổng số ${totalTasks} bài viết đang được xử lý đồng thời...`);
    
    // Khởi tạo bảng để theo dõi trạng thái tiến độ
    let progressSuccessCount = 0;
    let progressFailCount = 0;
    let createdArticleIds = []; // Lưu trữ ID các bài viết mới
    
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
      
      // Cập nhật tiến độ sau mỗi 5 promises hoàn thành
      if ((index + 1) % 5 === 0 || index === allPostPromises.length - 1) {
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
