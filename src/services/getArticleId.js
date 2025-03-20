const axios = require("axios");
async function getArticleId() {
  console.log(">> Đang lấy article ID ngẫu nhiên từ trang chủ");
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Tháng (0-11) cần +1 và pad thành 2 chữ số
  const day = String(now.getDate()).padStart(2, "0"); // Ngày hiện tại dạng 2 chữ số
  const timeParam = `${month}${day}0420`;
  try {
    const url = `https://pivoice.app/vjson/home/list/index/0_1?time=${timeParam}`;
    console.log(`>> Gửi request đến: ${url}`);

    const listResponse = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://pivoice.app/",
      },
    });

    console.log(`>> Nhận được response với status: ${listResponse.status}`);

    if (
      !listResponse.data ||
      !listResponse.data.data ||
      !listResponse.data.data.home_1
    ) {
      console.log(
        `❌ Không tìm thấy dữ liệu bài viết. Response data: ${JSON.stringify(
          listResponse.data
        )}`
      );
      return 58203589; // Giá trị mặc định nếu không tìm thấy bài viết
    }

    const articles = listResponse.data.data.home_1 || [];

    if (articles.length === 0) {
      console.log(`❌ Danh sách bài viết trống.`);
      return 58203589; // Giá trị mặc định nếu danh sách bài viết trống
    }

    const article = articles[Math.floor(Math.random() * articles.length)];
    console.log(`>> Đã chọn bài viết: ${article.title || "Không có tiêu đề"}`);

    if (!article.id) {
      console.log(
        `❌ Bài viết không có ID. Bài viết: ${JSON.stringify(article)}`
      );
      return 58203589; // Giá trị mặc định nếu bài viết không có ID
    }

    console.log(`>> Sử dụng article ID: ${article.id}`);
    return article.id;
  } catch (error) {
    console.log(`❌ Lỗi khi lấy article ID: ${error.message}`);

    if (error.response) {
      console.log(`Status code: ${error.response.status}`);
      console.log(`Response data: ${JSON.stringify(error.response.data)}`);
    }

    console.log(">> Sử dụng article ID mặc định: 58203589");
    return 58203589; // Giá trị mặc định trong trường hợp lỗi
  }
}

module.exports = getArticleId;
