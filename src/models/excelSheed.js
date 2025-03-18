const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../data/PI.xlsx');

function readExcel() {
    const workbook = xlsx.readFile(filePath);
    const usersSheet = workbook.Sheets[0]; // đây là user và proxy và user agent 
    const commentsSheet = workbook.Sheets[1]; // đây là comment 
    const likesSheet = workbook.Sheets[2]; // đây là likes 
    const titlesSheet = workbook.Sheets[3]; // đây là title 

    return {
        users: xlsx.utils.sheet_to_json(usersSheet),
        comments: xlsx.utils.sheet_to_json(commentsSheet),
        likes: xlsx.utils.sheet_to_json(likesSheet),
        titles: xlsx.utils.sheet_to_json(titlesSheet)
    };
}

module.exports = { readExcel };
