const axios = require("axios");

async function getAllPostPiKnow() {
  console.log(">> Đang lấy article ID từ trang chủ PiKnow");

  try {
    const response = await axios({
      url: 'https://pivoice.app/vapi',
      method: 'post',
      headers: {
        'accept': '*/*',
        'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'cookie': 'uid=1792378; ukey=XEDCBCFPMP38BXD3BH3EBRDCFBCMAG; piname=hh56y93',
        'origin': 'https://pivoice.app',
        'priority': 'u=1, i',
        'referer': 'https://pivoice.app/',
        'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
      },
      data: 'component=know&action=get-list&search=&user_name=hh56y93&english_version=0&selected_country=1&selected_chain=0'
    });
    if (
      response.data &&
      response.data.data &&
      response.data.data.status === 1 &&
      Array.isArray(response.data.data.data)
    ) {
      const ids = response.data.data.data.map(item => item.id);
      return ids;
    }
    return [];
  } catch (error) {
    console.error("Lỗi khi lấy post PiKnow:", error);
    return [];
  }
}

module.exports = getAllPostPiKnow;
