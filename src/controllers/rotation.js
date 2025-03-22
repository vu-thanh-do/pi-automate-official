const { cpus } = require('os');
const EventEmitter = require('events');
const { handleLogin } = require('./login');
const { handleLike } = require('./like');
const { handlePiKnow } = require('./piKnow');
const { handleLikeEachOther } = require('./likeEachOther');
const ExcelReaderService = require('../models/excelSheed');

// Tạo event emitter để quản lý tiến độ
const progressEmitter = new EventEmitter();

// Biến để lưu trữ trạng thái hiện tại
let currentState = {
    isRunning: false,
    currentTask: null,
    currentBatch: [],
    progress: 0,
    error: null
};

// Hàm xử lý từng tác vụ
async function executeTask(task, users, config) {
    const { type, name } = task;
    const { userDelay, retryCount } = config;

    try {
        switch (type) {
            case 'login':
                await handleLogin(users, userDelay);
                break;
            case 'like':
                await handleLike(users, userDelay, retryCount);
                break;
            case 'piKnow':
                await handlePiKnow(users, userDelay, retryCount);
                break;
            case 'likeEachOther':
                await handleLikeEachOther(users, userDelay, retryCount);
                break;
            default:
                throw new Error(`Không hỗ trợ tác vụ: ${name}`);
        }
        return true;
    } catch (error) {
        console.error(`Lỗi khi thực hiện tác vụ ${name}:`, error);
        return false;
    }
}

// Hàm chia users thành các lô
function splitIntoBatches(users, batchSize) {
    const batches = [];
    for (let i = 0; i < users.length; i += batchSize) {
        batches.push(users.slice(i, i + batchSize));
    }
    return batches;
}

// Hàm tính toán tiến độ
function calculateProgress(completedBatches, totalBatches, completedTasks, totalTasks) {
    const batchProgress = (completedBatches / totalBatches) * 100;
    const taskProgress = (completedTasks / totalTasks) * 100;
    return Math.floor((batchProgress + taskProgress) / 2);
}

// Hàm xử lý luân phiên
async function handleRotation(config) {
    const { batchSize, tasks } = config;

    try {
        // Đọc danh sách users từ file Excel
        const users = await ExcelReaderService();
        if (!users || users.length === 0) {
            throw new Error('Không tìm thấy dữ liệu người dùng');
        }

        // Chia users thành các lô
        const batches = splitIntoBatches(users, batchSize);
        let completedBatches = 0;
        let completedTasks = 0;

        // Xử lý từng lô
        for (const batch of batches) {
            if (!currentState.isRunning) break;

            currentState.currentBatch = batch;
            
            // Xử lý từng tác vụ trong lô
            for (const task of tasks) {
                if (!currentState.isRunning) break;

                currentState.currentTask = task.name;
                
                // Cập nhật tiến độ
                progressEmitter.emit('progress', {
                    progress: calculateProgress(completedBatches, batches.length, completedTasks, tasks.length),
                    currentTask: task.name,
                    status: `Đang xử lý lô ${completedBatches + 1}/${batches.length}`
                });

                // Thực hiện tác vụ
                const success = await executeTask(task, batch, config);
                if (success) {
                    completedTasks++;
                }
            }

            completedBatches++;
        }

        // Cập nhật hoàn thành
        if (currentState.isRunning) {
            progressEmitter.emit('progress', {
                progress: 100,
                currentTask: 'Hoàn thành',
                status: 'Đã xử lý tất cả các tác vụ'
            });
        }

    } catch (error) {
        progressEmitter.emit('progress', {
            error: error.message
        });
    }
}

// Endpoint để bắt đầu luân phiên
async function startRotation(req, res) {
    try {
        const config = req.body;
        
        // Kiểm tra config
        if (!config || !config.tasks || !config.batchSize) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin cấu hình'
            });
        }

        // Nếu đang chạy thì dừng tiến trình cũ
        if (currentState.isRunning) {
            currentState.isRunning = false;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Khởi tạo trạng thái mới
        currentState = {
            isRunning: true,
            currentTask: null,
            currentBatch: [],
            progress: 0,
            error: null
        };

        // Bắt đầu xử lý luân phiên
        handleRotation(config);

        res.json({
            success: true,
            message: 'Đã bắt đầu tiến trình luân phiên'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Endpoint để dừng luân phiên
function stopRotation(req, res) {
    currentState.isRunning = false;
    res.json({
        success: true,
        message: 'Đã dừng tiến trình luân phiên'
    });
}

// Endpoint để theo dõi tiến độ
function rotationProgress(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Gửi heartbeat để giữ kết nối
    const heartbeat = setInterval(() => {
        res.write(':\n\n');
    }, 30000);

    // Xử lý sự kiện tiến độ
    const progressHandler = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    progressEmitter.on('progress', progressHandler);

    // Xử lý khi client ngắt kết nối
    req.on('close', () => {
        clearInterval(heartbeat);
        progressEmitter.removeListener('progress', progressHandler);
    });
}

module.exports = {
    startRotation,
    stopRotation,
    rotationProgress
}; 