const apiClient = require("../api/apiClient");
const qs = require("qs");
const {
  getAllPostIds,
  deletePostById,
} = require("../services/serviceGetPostUser");
const getAllPostPiKnow = require("../services/getAllPostPiKnow");
async   function handlePiKnow() {
    try {
        const allPostPiKnow = await getAllPostPiKnow();
        console.log(allPostPiKnow);
    } catch (error) {
        console.log(error);
    }
}
module.exports = {
  handlePiKnow,
};
// comment
curl 'https://pivoice.app/vapi' \
  -H 'accept: */*' \
  -H 'accept-language: vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5' \
  -H 'content-type: application/x-www-form-urlencoded; charset=UTF-8' \
  -H 'cookie: uid=1792378; ukey=XEDCBCFPMP38BXD3BH3EBRDCFBCMAG; piname=hh56y93' \
  -H 'origin: https://pivoice.app' \
  -H 'priority: u=1, i' \
  -H 'referer: https://pivoice.app/' \
  -H 'sec-ch-ua: "Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36' \
  -H 'x-requested-with: XMLHttpRequest' \
--data - raw 'component=know&action=answer&message=nice+idea+&user_name=hh56y93&know_id=164406&english_version=0&selected_country=1&selected_chain=0'
  
// like