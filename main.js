const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { handleComment } = require('./src/controllers/comments');
const { handleLike } = require('./src/controllers/like');
const { handlePostArticles } = require('./src/controllers/posts');
const handleDelete = require('./src/controllers/delete');
const { handlePiKnow } = require('./src/controllers/piKnow');
const handleLikeEachOther = require('./src/controllers/likeEachOther');
const handleLogin = require('./src/controllers/login');

let mainWindow;
let logWindow;

// Khởi tạo Express server
const server = express();
server.use(bodyParser.json());

// Ghi đè console.log để gửi log tới cửa sổ log
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function() {
    const args = Array.from(arguments);
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    if (logWindow) {
        logWindow.webContents.send('new-log', { type: 'info', message });
    }
    originalConsoleLog.apply(console, arguments);
};

console.error = function() {
    const args = Array.from(arguments);
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    if (logWindow) {
        logWindow.webContents.send('new-log', { type: 'error', message });
    }
    originalConsoleError.apply(console, arguments);
};

// Xử lý API
server.post('/execute-tasks', async (req, res) => {
    try {
        console.log('Bắt đầu thực hiện các tác vụ...');
        const { commentCount, likeCount, deleteCount, postCount, piKnow, likeEachOther, login } = req.body;
        let tasks = [];

        if (login > 0) {
            console.log(`Thực hiện đăng nhập ${login} tài khoản...`);
            tasks.push(handleLogin(login));
        }
        if (commentCount > 0) {
            console.log(`Thực hiện comment ${commentCount} lần...`);
            tasks.push(handleComment(commentCount));
        }
        if (likeCount > 0) {
            console.log(`Thực hiện like ${likeCount} lần...`);
            tasks.push(handleLike(likeCount));
        }
        if (deleteCount > 0) {
            console.log(`Thực hiện xóa ${deleteCount} bài...`);
            tasks.push(handleDelete(deleteCount));
        }
        if (postCount > 0) {
            console.log(`Thực hiện đăng ${postCount} bài...`);
            tasks.push(handlePostArticles(postCount));
        }
        if (piKnow > 0) {
            console.log(`Thực hiện comment PiKnow ${piKnow} lần...`);
            tasks.push(handlePiKnow(piKnow));
        }
        if (likeEachOther > 0) {
            console.log(`Thực hiện like chéo ${likeEachOther} lần...`);
            tasks.push(handleLikeEachOther(likeEachOther));
        }

        const results = await Promise.allSettled(tasks);
        const successCount = results.filter(r => r.status === "fulfilled").length;
        const failCount = results.filter(r => r.status === "rejected").length;

        console.log(`Hoàn thành: ${successCount} thành công, ${failCount} thất bại`);
        
        res.json({
            success: true,
            message: `Hoàn thành ${successCount} tác vụ, ${failCount} thất bại.`,
            details: results
        });
    } catch (error) {
        console.error('Lỗi:', error.message);
        res.json({ success: false, message: "Lỗi khi chạy tác vụ.", error: error.message });
    }
});

// Khởi động server Express
const expressServer = server.listen(0, () => {
    const port = expressServer.address().port;
    console.log(`Server đang chạy tại port ${port}`);
    startElectron(port);
});

function createLogWindow() {
    logWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Log Viewer',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    logWindow.loadFile('src/views/log.html');
    
    logWindow.on('closed', () => {
        logWindow = null;
    });
}

function startElectron(port) {
    function createMainWindow() {
        mainWindow = new BrowserWindow({
            width: 1000,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        mainWindow.loadFile('src/views/index.html');
        mainWindow.webContents.executeJavaScript(`window.SERVER_PORT = ${port};`);

        mainWindow.on('closed', () => {
            mainWindow = null;
            if (logWindow) logWindow.close();
            app.quit();
        });
    }

    app.whenReady().then(() => {
        createMainWindow();
        createLogWindow();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (mainWindow === null) createMainWindow();
        if (logWindow === null) createLogWindow();
    });
} 