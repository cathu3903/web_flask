// Robot Video 页面的 JavaScript 文件 - 简化版，直接发送到后端服务器
let Current_frame_data = null;
let flagAIRecognition = false;
let player = null;
let playerInitialized = false;

// 存储检测结果的变量 - 格式: [{id: 1, position: {x: 100, y: 200}}, ...]
let detectionResults = [];
let GlobalManualId = 0;

// 新增：网格参数（从后端获取或默认值）
let gridM = 10;
let gridN = 10;
let Is_context_menu_just_shown = false;
let GlobalMachineId = 0;
let currentGridA = null;
let currentGridB = null;

// 新增：颜色映射
const stainLevelColors = {
    0: "rgba(255, 255, 255, 0.5)",  // white
    1: "rgba(0, 255, 0, 0.5)",      // green - 默认值
    2: "rgba(255, 255, 0, 0.5)",    // yellow
    3: "rgba(0, 0, 255, 0.5)",      // blue
    4: "rgba(255, 0, 0, 0.5)"       // red
};

// 二维数组存储网格状态
let GridMatrix = [];

// Map存储详细信息，key为 "a,b" 格式
let GridDataMap = new Map();

// 初始化网格
function initGridData(m, n) {
    GridMatrix = [];
    GridDataMap.clear();
    
    for(let i = 0; i < m; i++) {
        GridMatrix[i] = [];
        for(let j = 0; j < n; j++) {
            GridMatrix[i][j] = {
                stainLevel: 0,
                hasData: false
            };
        }
    }
}

// 添加网格数据
function addGridData(a, b, gridInfo) {
    const key = `${a},${b}`;
    
    // 更新二维数组
    GridMatrix[a][b] = {
        stainLevel: gridInfo.stainLevel,
        hasData: true
    };
    
    // 更新Map
    GridDataMap.set(key, {
        startX: gridInfo.startX,
        startY: gridInfo.startY,
        width: gridInfo.width,
        height: gridInfo.height,
        m: gridInfo.m,
        n: gridInfo.n,
        stainLevel: gridInfo.stainLevel,
        a: a,
        b: b,
        detectionId: gridInfo.detectionId,
        className: gridInfo.className,
        machineId: gridInfo.machineId,
    });
}

// 获取网格数据
function getGridData(a, b) {
    const key = `${a},${b}`;
    return GridDataMap.get(key);
}

function updateGridLevel(a, b, stainLevel){
    const key = `${a},${b}`;
    const grid = getGridData(a, b);
    if(grid && GridMatrix[a][b].hasData) {
        GridDataMap.set(key, {
            ...grid,
            stainLevel: stainLevel,
            className: "manual",
        });

        GridMatrix[a][b].stainLevel = stainLevel;
        // 更新视觉显示
        const canvas = document.getElementById('detection_canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            // 清除原有颜色
            ctx.clearRect(grid.startX, grid.startY, grid.width, grid.height);

            // 绘制新颜色
            ctx.fillStyle = stainLevelColors[stainLevel];
            ctx.fillRect(grid.startX, grid.startY, grid.width, grid.height);

            // 重新绘制文字标识
            ctx.fillStyle = 'black';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const centerX = grid.startX + grid.width / 2;
            const centerY = grid.startY + grid.height / 2;

            ctx.fillText(`${grid.detectionId}`, centerX, centerY - 8);
            ctx.fillText(`manual`, centerX, centerY + 8);
            console.log(`updateGridLevel:${grid}`)
        }
    }
}

function addGridMachineId(a, b, machineId){
    grid = getGridData(a, b);
    if(grid.hasData)
    {
        GridDataMap.set(key, {
            machineId: machineId
        });
    }
    GlobalMachineId = machineId;
}

function updateGlobalMachineId(machineId){
    GlobalMachineId = machineId;
}

// 删除网格数据
function removeGridData(a, b) {
    const key = `${a},${b}`;
    // 清除视觉效果
    clearGridVisual(a, b);
    // 清除二维数组
    GridMatrix[a][b] = {
        stainLevel: 0,
        hasData: false
    };

    // 从Map中删除
    GridDataMap.delete(key);

}



// 检查网格是否有数据
function hasGridData(a, b) {
    return GridMatrix[a][b] && GridMatrix[a][b].hasData;
}

// 获取所有网格数据
function getAllGridData() {
    return Array.from(GridDataMap.values());
}

// 初始化网格线绘制 - 参考video_annotation.js中的initGrid函数
function initGridLines(m, n) {
    const canvas = document.getElementById('detection_canvas');
    const imageDisplay = document.getElementById('image_display');
    
    if (!canvas || !imageDisplay) {
        console.error('Canvas or image display not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const rect = imageDisplay.getBoundingClientRect();
    
    // 设置canvas尺寸与图片显示尺寸一致
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // 设置canvas样式位置覆盖在图片上
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'auto'; // 允许点击事件
    
    // 清除之前的绘制
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 设置网格线样式
    ctx.strokeStyle = 'rgb(255, 0, 0)';
    ctx.lineWidth = 1;
    
    // 绘制垂直线
    for (let i = 1; i < m; i++) {
        const x = (canvas.width / m) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // 绘制水平线
    for (let i = 1; i < n; i++) {
        const y = (canvas.height / n) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// 清除网格视觉效果
function clearGridVisual(a, b) {
    const canvas = document.getElementById('detection_canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const grid = getGridData(a, b);
    
    const gridWidth = grid.width;
    const gridHeight = grid.height;
    
    const startX = grid.startX;
    const startY = grid.startY;
    
    // 清除该网格区域
    ctx.clearRect(startX, startY, gridWidth, gridHeight);
    
    // 重新绘制网格线
    ctx.strokeStyle = 'rgb(255, 0, 0)';
    ctx.lineWidth = 1;
    
    // 重新绘制这个网格的边框
    ctx.strokeRect(startX, startY, gridWidth, gridHeight);
}

// 初始化视频播放器
function initVideoPlayer() {
    const videoElement = document.getElementById('video_player');
    
    // 检查是否已经初始化过
    if (playerInitialized && player) {
        console.log('Video player already initialized');
        return player;
    }
    
    // 销毁现有的播放器实例（如果存在）
    if (window.videojs && window.videojs.getPlayer) {
        try {
            const existingPlayer = window.videojs.getPlayer('video_player');
            if (existingPlayer) {
                existingPlayer.dispose();
            }
        } catch (e) {
            console.log('No existing player to dispose');
        }
    }
    
    // 配置 Video.js 选项
    const options = {
        fluid: true,
        responsive: true,
        controls: true,
        preload: 'none', // 避免加载空源
        playbackRates: [0.5, 1, 1.5, 2],
        techOrder: ['html5'],
        sources: [], // 初始化为空源列表
        html5: {
            vhs: {
                overrideNative: true
            }
        }
    };
    
    try {
        player = videojs(videoElement, options);
        playerInitialized = true;
        
        // 监听播放器事件
        player.on('pause', onPlayerPaused);
        player.on('play', onPlayerPlaying);
        player.on('loadedmetadata', onVideoLoaded);
        player.on('canplay', onVideoCanPlay);
        player.on('error', onVideoError);
        player.on('resize', onVideoResize);
        
        // 设置初始状态
        player.ready(() => {
            console.log('Video player is ready');
            updatePauseButtonState();
            updateAIRecognitionButton();
        });
        
        return player;
    } catch (error) {
        console.error('Error initializing video player:', error);
        return null;
    }
}

// 更新暂停按钮状态
function updatePauseButtonState() {
    const pauseBtn = document.getElementById('pause_button');
    if (!pauseBtn || !player) return;
    
    try {
        if (player.paused()) {
            pauseBtn.textContent = 'Play';
            pauseBtn.classList.remove('btn-pause');
            pauseBtn.classList.add('btn-play');
        } else {
            pauseBtn.textContent = 'Pause';
            pauseBtn.classList.remove('btn-play');
            pauseBtn.classList.add('btn-pause');
        }
    } catch (error) {
        console.error('Error updating pause button state:', error);
    }
}

// 更新AI Recognition按钮状态
function updateAIRecognitionButton() {
    const aiButton = document.getElementById('ai_recognition_button');
    if (!aiButton) return;
    
    try {
        if (flagAIRecognition && Current_frame_data) {
            // 暂停状态且有帧数据时启用按钮
            aiButton.disabled = false;
            aiButton.classList.remove('btn-ai-disabled');
            aiButton.classList.add('btn-ai');
        } else {
            // 其他状态时禁用按钮
            aiButton.disabled = true;
            aiButton.classList.remove('btn-ai');
            aiButton.classList.add('btn-ai-disabled');
        }
    } catch (error) {
        console.error('Error updating AI recognition button state:', error);
    }
}

// 动态调整视频容器和图片容器大小
function adjustVideoContainer() {
    const videoSection = document.querySelector('.video_section');
    const imageSection = document.querySelector('.image_section');
    const videoContainer = document.querySelector('.video_container');
    const imageContainer = document.querySelector('.image_container');
    
    if (!player || !videoSection || !imageSection || !videoContainer || !imageContainer) return;
    
    try {
        const videoWidth = player.videoWidth();
        const videoHeight = player.videoHeight();
        
        if (videoWidth > 0 && videoHeight > 0) {
            // 标记为有视频状态
            videoContainer.classList.add('has-video');
            videoContainer.classList.remove('no-video');
            videoSection.classList.add('video-loaded');
            imageSection.classList.add('video-loaded');
            
            // 计算视频的宽高比
            const videoAspectRatio = videoWidth / videoHeight;
            
            // 获取视频区域的实际宽度（减去padding）
            const sectionPadding = 60; // 左右各30px
            const availableWidth = videoSection.offsetWidth - sectionPadding;
            
            // 计算最大可用高度（屏幕高度的60%）
            const maxHeight = window.innerHeight * 0.6;
            
            // 根据宽高比计算高度
            let newHeight = availableWidth / videoAspectRatio;
            
            // 限制最大高度
            if (newHeight > maxHeight) {
                newHeight = maxHeight;
            }
            
            // 限制最小高度
            const minHeight = 250;
            if (newHeight < minHeight) {
                newHeight = minHeight;
            }
            
            // 设置视频容器高度
            videoContainer.style.height = `${newHeight}px`;
            
            // 设置图片容器为相同高度
            imageContainer.style.height = `${newHeight}px`;
            
            // 调整播放器尺寸
            player.dimensions(availableWidth, newHeight);
            
            console.log(`Containers adjusted: ${availableWidth}x${newHeight}, aspect ratio: ${videoAspectRatio}`);
        } else {
            // 无视频时的默认状态
            videoContainer.classList.add('no-video');
            videoContainer.classList.remove('has-video');
            videoSection.classList.remove('video-loaded');
            imageSection.classList.remove('video-loaded');
            
            // 重置图片容器高度
            imageContainer.style.height = '300px';
        }
    } catch (error) {
        console.error('Error adjusting video container:', error);
    }
}

// 视频尺寸改变时的处理
function onVideoResize() {
    console.log('Video resize event triggered');
    adjustVideoContainer();
}

// 视频事件处理函数
function onPlayerPaused() {
    console.log("Video paused");
    updatePauseButtonState();
    
    flagAIRecognition = true;
    Current_frame_data = captureCurrentFrame();
    
    updateStatus('Video paused - AI Recognition available');
    updateAIRecognitionButton();
}

function onPlayerPlaying() {
    console.log("Video playing");
    updatePauseButtonState();
    
    flagAIRecognition = false;
    Current_frame_data = null;
    
    updateStatus('Video playing');
    updateAIRecognitionButton();
}

function onVideoLoaded() {
    console.log("Video metadata loaded");
    
    try {
        console.log("Video dimensions:", player.videoWidth(), "x", player.videoHeight());
        
        // 延迟调整，确保视频尺寸信息已经可用
        setTimeout(() => {
            adjustVideoContainer();
            updatePauseButtonState();
            updateAIRecognitionButton();
        }, 100);
        
        updateStatus('Video uploaded and playing');
    } catch (error) {
        console.error('Error in onVideoLoaded:', error);
    }
}

function onVideoCanPlay() {
    console.log("Video can play");
    
    try {
        // 再次调整容器大小
        setTimeout(() => {
            adjustVideoContainer();
            updatePauseButtonState();
            updateAIRecognitionButton();
        }, 100);
        
        updateStatus('Video ready to play');
    } catch (error) {
        console.error('Error in onVideoCanPlay:', error);
    }
}

function onVideoError(error) {
    console.error('Video error:', error);
    
    try {
        // 只在有实际视频源时才显示错误
        if (player && player.currentSrc() && player.currentSrc() !== '') {
            updateStatus('Video loading error');
        } else {
            // 如果没有源，则不显示错误
            updateStatus('Video ready - Please upload a video file');
        }
    } catch (e) {
        console.error('Error in onVideoError:', e);
    }
}

// 切换播放/暂停状态
function togglePlayPause() {
    if (!player) {
        console.error('Video player not initialized');
        return;
    }
    
    try {
        if (player.paused()) {
            player.play().then(() => {
                updatePauseButtonState();
                updateAIRecognitionButton();
            }).catch(error => {
                console.error('Error playing video:', error);
                updateStatus('Error playing video');
            });
        } else {
            player.pause();
            updatePauseButtonState();
            updateAIRecognitionButton();
        }
    } catch (error) {
        console.error('Error toggling play/pause:', error);
    }
}

// 处理视频上传
function handleVideoUpload(file) {
    if (!file) return;
    
    try {
        const videoURL = URL.createObjectURL(file);
        
        // 设置视频源
        player.src({
            type: 'video/mp4',
            src: videoURL
        });
        
        // 重新加载并播放
        player.load();
        player.play();
        
        console.log('Video uploaded successfully');
        updateStatus('Video uploaded and loading...');
        
    } catch (error) {
        console.error('Error uploading video:', error);
        updateStatus('Error uploading video');
    }
}

// 捕获当前帧
function captureCurrentFrame() {
    if (!player) return null;
    
    try {
        const videoElem = player.el().querySelector('video');
        if (!videoElem) return null;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = videoElem.videoWidth || videoElem.clientWidth;
        canvas.height = videoElem.videoHeight || videoElem.clientHeight;
        
        ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
        
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error capturing current frame:', error);
        return null;
    }
}

// 更新图片占位符
function updateImagePlaceholder(message) {
    const placeholder = document.querySelector('.image_placeholder');
    if (placeholder) {
        placeholder.innerHTML = `<p>${message}</p>`;
        placeholder.style.display = 'block';
    }
    
    // 隐藏图片和canvas
    const imageDisplay = document.getElementById('image_display');
    const canvas = document.getElementById('detection_canvas');
    
    if (imageDisplay) {
        imageDisplay.style.display = 'none';
    }
    
    if (canvas) {
        canvas.style.display = 'none';
    }
}

// 修改：根据检测结果渲染网格 - 参考video_annotation.js中的choose_color函数
function renderGridByResults(gridPositions) {
    if (!gridPositions || gridPositions.length === 0) {
        console.log('No grid positions to render');
        return;
    }

    // 初始化网格数据
    initGridData(gridM, gridN);
    
    // 获取canvas和图片元素
    const canvas = document.getElementById('detection_canvas');
    const imageDisplay = document.getElementById('image_display');
    
    if (!canvas || !imageDisplay) {
        console.error('Canvas or image display not found');
        return;
    }

    // 等待图片加载完成后再绘制网格
    const renderGrid = () => {
        const ctx = canvas.getContext('2d');
        const rect = imageDisplay.getBoundingClientRect();
        
        // 设置canvas尺寸与图片显示尺寸一致
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // 设置canvas样式位置覆盖在图片上
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'auto'; // 允许点击事件
        
        // 清除之前的绘制
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 先绘制网格线
        initGridLines(gridM, gridN);
        
        // 遍历每个检测结果的网格位置
        gridPositions.forEach((gridPos, index) => {
            const { id, a, b } = gridPos;
            
            // 计算网格的实际像素位置 - 参考video_annotation.js中的方法
            const x1 = a * (canvas.width / gridM) + 1;
            const y1 = b * (canvas.height / gridN) + 1;
            const w = canvas.width / gridM - 2;
            const h = canvas.height / gridN - 2;
            
            // 获取对应的检测结果信息
            const detection = detectionResults[id] || {};
            const className = detection.class_name || 'unknown';
            
            // 使用默认的stainLevel = 1 (绿色)
            const stainLevel = 1;
            const color = stainLevelColors[stainLevel];
            
            // 绘制网格填充
            ctx.fillStyle = color;
            ctx.fillRect(x1, y1, w, h);
            
            // 在网格中心绘制文字标识
            ctx.fillStyle = 'black';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const centerX = x1 + w / 2;
            const centerY = y1 + h / 2;
            
            // 绘制检测ID和类别名称
            ctx.fillText(`${id}`, centerX, centerY - 8);
            ctx.fillText(`${className}`, centerX, centerY + 8);
            
            // 使用GridDataMap存储网格信息
            const gridInfo = {
                startX: x1,
                startY: y1,
                width: w,
                height: h,
                m: gridM,
                n: gridN,
                stainLevel: stainLevel,
                detectionId: id,
                className: className,
                machineId: GlobalMachineId,
            };
            
            // 添加到GridDataMap
            addGridData(a, b, gridInfo);
            
            console.log(`Rendered grid at (${a}, ${b}) for detection ${id} (${className})`);
        });
        
        console.log(`Rendered ${gridPositions.length} grid positions`);
        console.log('GridDataMap:', GridDataMap);
    };
    
    // 如果图片已经加载完成，直接渲染
    if (imageDisplay.complete && imageDisplay.naturalWidth > 0) {
        renderGrid();
    } else {
        // 否则等待图片加载完成
        imageDisplay.onload = renderGrid;
    }
}

// 修改：清除网格渲染 - 使用GridDataMap
function clearGridRender() {
    const canvas = document.getElementById('detection_canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // 清除GridDataMap
    GridDataMap.clear();
    
    // 重置GridMatrix
    initGridData(gridM, gridN);
    
    console.log('Grid render cleared');
}

// 修改后的 performAIRecognition 函数
async function performAIRecognition() {
    if (!flagAIRecognition) {
        updateStatus('Please pause the video first for AI recognition');
        return;
    }
    
    if (!Current_frame_data) {
        updateStatus('No frame data available');
        return;
    }
    
    // 更新图片区域显示文字为等待状态
    updateImagePlaceholder('Waiting for server result...');
    updateStatus('AI Recognition in progress...');
    
    try {
        // 将base64图片数据转换为blob格式
        const response = await fetch(Current_frame_data);
        const blob = await response.blob();
        
        // 创建FormData对象发送图片
        const formData = new FormData();
        formData.append('image', blob, 'frame.png');
        formData.append('model_id', 'yolov11n.pt');
        formData.append('image_size', '640');
        formData.append('conf_threshold', '0.5');
        
        // 发送到Flask后端
        const apiResponse = await fetch('/yolo_inference', {
            method: 'POST',
            body: formData
        });
        
        if (!apiResponse.ok) {
            throw new Error(`HTTP error! status: ${apiResponse.status}`);
        }
        
        const result = await apiResponse.json();
        
        // 检查是否有识别结果
        if (result.success && result.annotated_image) {
            // 显示识别结果图片
            displayRecognitionResult(result.annotated_image);
            
            // 更新网格参数
            gridM = result.grid_m || 10;
            gridN = result.grid_n || 10;
            
            // 存储检测结果和网格位置
            detectionResults = result.detections || [];
            const gridPositions = result.grid_positions || [];
            
            // 延迟渲染网格，确保图片已加载
            setTimeout(() => {
                renderGridByResults(gridPositions);
            }, 100);
            
            // 更新检测信息，包含网格位置信息
            if (result.detections && result.detections.length > 0) {
                let infoText = `Found ${result.detections.length} objects:\n`;
                result.detections.forEach((detection, index) => {
                    const gridPos = gridPositions[index];
                    infoText += `• ${detection.class_name} (confidence: ${(detection.confidence * 100).toFixed(1)}%) at grid (${gridPos.a}, ${gridPos.b})\n`;
                });
                updateDetectionInfo(infoText);
                
                // 在控制台输出网格位置信息
                console.log('Grid positions:', gridPositions);
                console.log('GridDataMap:', GridDataMap);
            } else {
                updateDetectionInfo('No objects detected');
            }
            
            updateStatus('AI Recognition completed successfully');
        } else {
            // 如果没有识别结果，显示原图
            displayRecognitionResult(Current_frame_data);
            updateDetectionInfo('No objects detected');
            updateStatus('AI Recognition completed - No objects found');
        }
        
    } catch (error) {
        console.error('Error during AI recognition:', error);
        updateStatus('AI Recognition failed: ' + error.message);
        updateImagePlaceholder('Detection results will appear here');
    }
}

// 修改：根据网格位置执行机器人动作 - 使用GridDataMap
function executeRobotAction() {
    const allGridData = getAllGridData();
    
    if (!allGridData || allGridData.length === 0) {
        updateStatus('No grid positions selected. Please run AI Recognition first.');
        return;
    }

    // 获取第一个网格位置
    const firstGrid = allGridData[0];
    if (firstGrid) {
        const { a, b, className } = firstGrid;
        
        console.log(`Executing robot action at grid position (${a}, ${b}) for ${className}`);
        updateStatus(`Executing robot action at grid (${a}, ${b}) for ${className}`);
        
        // 发送所有网格位置到后端
        sendGridPositionsToRobot(allGridData);
    }
}

// 修改：发送网格位置到机器人控制系统 - 使用GridDataMap
async function sendGridPositionsToRobot(gridPositions) {
    try {
        // 获取当前图像
        const imageDisplay = document.getElementById('image_display');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 设置画布尺寸与图像一致
        canvas.width = imageDisplay.naturalWidth;
        canvas.height = imageDisplay.naturalHeight;

        // 将图像绘制到画布上
        ctx.drawImage(imageDisplay, 0, 0);

        // 获取当前图像的base64数据
        const frameData = canvas.toDataURL('image/png');

        // 准备裁剪图像数组
        const croppedImages = [];

        // 转换为新的注释格式
        const annotations = gridPositions.map(grid => {
            const { startX, startY, width, height, a, b, m, n, stainLevel, machineId} = grid;

            // 裁剪每个区域
            const cropCanvas = document.createElement('canvas');
            const cropCtx = cropCanvas.getContext('2d');
            cropCanvas.width = width;
            cropCanvas.height = height;
            cropCtx.drawImage(imageDisplay, startX, startY, width, height, 0, 0, width, height);

            // 添加裁剪图像到数组
            croppedImages.push(cropCanvas.toDataURL('image/png'));

            // 返回新格式的注释
            return {
                startX: startX,
                startY: startY,
                a: a,
                b: b,
                width: width,
                height: height,
                m: m,
                n: n,
                stainLevel: stainLevel,
                machineId: machineId
            };
        });

        // 使用与submitOneFrameAnnotation相同的格式发送数据
        const response = await fetch('/video_action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cropped: croppedImages,
                frame: frameData,
                annotations: annotations
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Robot action result:', result);
            updateStatus('Robot action sent successfully');
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error sending robot action:', error);
        updateStatus('Failed to send robot action: ' + error.message);
    }
}

// 网格点击事件处理 - 支持点击删除
function onGridClick(event) {
    const canvas = document.getElementById('detection_canvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // 计算点击的网格坐标
    const gridWidth = canvas.width / gridM;
    const gridHeight = canvas.height / gridN;
    
    const a = Math.floor(mouseX / gridWidth);
    const b = Math.floor(mouseY / gridHeight);
    
    // 检查边界
    if (a >= 0 && a < gridM && b >= 0 && b < gridN) {
        if (hasGridData(a, b)) {
            // 如果网格有数据，删除它
            removeGridData(a, b);
            console.log(`Removed grid data at (${a}, ${b})`);
            updateStatus(`Removed grid at (${a}, ${b})`);
        } else {
            console.log(`No data at grid (${a}, ${b})`);
        }
    }
}

// 修改：displayRecognitionResult函数
function displayRecognitionResult(imageData) {
    const imageDisplay = document.getElementById('image_display');
    const placeholder = document.querySelector('.image_placeholder');
    const canvas = document.getElementById('detection_canvas');
    
    if (imageDisplay && placeholder) {
        // 清除之前的网格渲染
        clearGridRender();
        
        // 隐藏占位符，显示图片
        placeholder.style.display = 'none';
        imageDisplay.style.display = 'block';
        imageDisplay.src = imageData;
        
        // 确保图片完全加载后再绑定事件
        imageDisplay.onload = () => {
            if (canvas) {
                // 设置canvas尺寸与图片一致
                canvas.width = imageDisplay.width;
                canvas.height = imageDisplay.height;
                canvas.style.display = 'block';
                
                // 移除可能存在的旧事件监听器
                canvas.removeEventListener('click', handleGridClick);
                // 绑定点击事件以支持网格操作
                canvas.addEventListener('click', handleGridClick);
                
                // 重新绘制网格线
                initGridLines(gridM, gridN);
            }
        };
                // 如果有canvas，也显示并绑定点击事件
        // if (canvas) {
        //     canvas.style.display = 'block';
        //     // 绑定点击事件以支持删除网格
        //     canvas.removeEventListener('click', handleGridClick);
        //     canvas.addEventListener('click', handleGridClick);
        // }
    }
}

// 状态更新函数
function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function updateDetectionInfo(message) {
    const detectionInfoElement = document.getElementById('detection_info');
    if (detectionInfoElement) {
        detectionInfoElement.innerHTML = message.replace(/\n/g, '<br>');
    }
}

// click event on the grid, only when the image is loaded
function handleGridClick(event){
    event.preventDefault();
    event.stopPropagation();
    
    const canvas = document.getElementById('detection_canvas');
    const imageDisplay = document.getElementById('image_display');
    
    if (!canvas || !imageDisplay) return;

    // 获取点击相对于canvas的位置
    const rect = canvas.getBoundingClientRect();
    const mouse_x = event.clientX - rect.left;
    const mouse_y = event.clientY - rect.top;

    // 检查点击是否在有效区域内
    if (mouse_x >= 0 && mouse_x < rect.width && mouse_y >= 0 && mouse_y < rect.height) {
        // 计算点击的网格坐标
        const gridWidth = canvas.width / gridM;
        const gridHeight = canvas.height / gridN;

        const a = Math.floor(mouse_x / gridWidth);
        const b = Math.floor(mouse_y / gridHeight);

        // 检查边界
        if (a >= 0 && a < gridM && b >= 0 && b < gridN) {
            // 保存当前点击的网格坐标
            currentGridA = a;
            currentGridB = b;
            // 显示菜单
            const dropdown = document.getElementById('context_menu');
            dropdown.style.display = 'block';
            
            // 使用 pageX/pageY 并添加 5px 偏移防止遮挡光标
            dropdown.style.left = (event.pageX + 5) + 'px';
            dropdown.style.top = (event.pageY + 5) + 'px';
            
            Is_context_menu_just_shown = true;
            setTimeout(() => {Is_context_menu_just_shown = false;}, 100);
        }
        else {
            console.log(`Clicked on grid (${a}, ${b}) without data`);
            currentGridA = -1;
            currentGridB = -1;
        }
    }
}

// Click event of menu --> add/remove/modify color
function handleContextMenuClick(event){
    event.preventDefault();
    event.stopPropagation();
    
    const canvas = document.getElementById('detection_canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if(event.target.tagName === "A" && currentGridA >= 0 && currentGridB >= 0) {
        let color;
        let stain_level;
        const a = currentGridA;
        const b = currentGridB;
        
        switch(event.target.getAttribute("data-color")) {
            case "green":
                color = "rgba(0,255,0,0.5)";
                stain_level = 1;
                break;
            case "yellow":
                color = "rgba(255,255,0,0.5)";
                stain_level = 2;
                break;
            case "blue":
                color = "rgba(0,0, 255, 0.5)";
                stain_level = 3;
                break;
            case "_delete_":
                if(hasGridData(a, b))
                {
                    removeGridData(a, b);
                    console.log(`Removed grid data at (${a}, ${b})`);
                    updateStatus(`Removed grid at (${a}, ${b})`);
                    
                    // 隐藏菜单
                    const contextMenu = document.getElementById('context_menu');
                    if (contextMenu) {
                        contextMenu.style.display = 'none';
                    }
                    
                    currentGridA = -1;
                    currentGridB = -1;
                    return true;
                }
                break;
            case "_return_":
                // 隐藏菜单
                const contextMenuReturn = document.getElementById('context_menu');
                if (contextMenuReturn) {
                    contextMenuReturn.style.display = 'none';
                }
                
                currentGridA = -1;
                currentGridB = -1;
                return;
        }
        
        // 对于颜色更改操作
        if (color && stain_level) {
            let grid = getGridData(a, b);
            if (grid) {
                // 更新网格级别
                updateGridLevel(a, b, stain_level);
                
                console.log(`Updated grid (${a}, ${b}) to stain level ${stain_level}`);
                updateStatus(`Updated grid (${a}, ${b}) to stain level ${stain_level}`);
            }
            else {
                // create new grid and draw
                // 如果点击的是一个空网格，添加一个新的网格条目
                if (!hasGridData(a, b)) {

                    // 计算网格的实际像素位置
                    const x1 = a * (canvas.width / gridM) + 1;
                    const y1 = b * (canvas.height / gridN) + 1;
                    const w = canvas.width / gridM - 2;
                    const h = canvas.height / gridN - 2;

                    // 创建新的网格信息
                    const gridInfo = {
                        startX: x1,
                        startY: y1,
                        width: w,
                        height: h,
                        m: gridM,
                        n: gridN,
                        stainLevel: color,
                        detectionId: GlobalManualId,
                        className: 'manual',
                        machineId: GlobalMachineId,
                    };

                    // 添加到GridDataMap
                    addGridData(a, b, gridInfo);

                    // 绘制新网格
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = color;
                    ctx.fillRect(x1, y1, w, h);

                    // 在网格中心绘制文字标识
                    ctx.fillStyle = 'black';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const centerX = x1 + w / 2;
                    const centerY = y1 + h / 2;

                    // 绘制检测类别名称 (手动)
                    ctx.fillText(`${GlobalManualId}`, centerX, centerY - 8);
                    ctx.fillText('manual', centerX, centerY + 8);

                    console.log(`Added new grid at (${a}, ${b}) with detectionId ${GlobalManualId}`);
                    GlobalManualId ++;
                }
            }
        }
        
        // 隐藏菜单
        const contextMenu = document.getElementById('context_menu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        
        currentGridA = -1;
        currentGridB = -1;
        this.style.display = "none";
    }
}

// machine id selector
function selectMachine(machineId) {
    GlobalMachineId = machineId;
    updateStatus(`Selected Machine ${GlobalMachineId}`);
    
    // update the button text
    const selectorButton = document.getElementById('machine_selector_button');
    if (selectorButton) {
        selectorButton.textContent = `Machine ${machineId} ▼`;
    }
    
    // hide the dropdown
    const dropdown = document.getElementById('machine_dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }

    console.log(`Selected Machine ${machineId}`)
}

// change the visual state of the dropdown
function toggleMachineDropdown() {
    const dropdown = document.getElementById('machine_dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');

    }
}

// Bound events after DOM loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    
    // 初始化网格数据
    initGridData(gridM, gridN);
    
    // 初始化视频播放器
    initVideoPlayer();
    
    // 绑定事件监听器
    const uploadButton = document.getElementById('upload_video_button');
    const fileInput = document.getElementById('video_file_input');
    const pauseButton = document.getElementById('pause_button');
    const aiRecognitionButton = document.getElementById('ai_recognition_button');
    const executeButton = document.getElementById('execute_button');
    const jumpToImageButton = document.getElementById('jump_to_robot_image');
    const jumpToAnnotationButton = document.getElementById('jump_to_video_annotation');
    const contextMenu = document.getElementById('context_menu');

    if (uploadButton && fileInput) {
        uploadButton.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleVideoUpload(file);
            }
        });
    }
    
    // 暂停/播放按钮
    if (pauseButton) {
        pauseButton.addEventListener('click', togglePlayPause);
    }
    
    // AI识别按钮
    if (aiRecognitionButton) {
        aiRecognitionButton.addEventListener('click', performAIRecognition);
    }
    
    // 执行按钮
    if (executeButton) {
        executeButton.addEventListener('click', executeRobotAction);
    }
    
    // 机器选择下拉菜单
    const machineSelectorButton = document.getElementById('machine_selector_button');
    const machineOptions = document.querySelectorAll('.machine-option');
    
    if (machineSelectorButton) {
        machineSelectorButton.addEventListener('click', toggleMachineDropdown);
    }
    
    machineOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            const machineId = parseInt(this.getAttribute('data-machine-id'));
            selectMachine(machineId);
        });
    });
    
    // 点击页面其他地方时关闭下拉菜单
    window.addEventListener('click', function(event) {
        const machineSelector = document.querySelector('.machine-selector');
        if (machineSelector && !machineSelector.contains(event.target)) {
            const dropdown = document.getElementById('machine_dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        }
    });
    
    // 跳转按钮
    if (jumpToImageButton) {
        jumpToImageButton.addEventListener('click', function() {
            window.location.href = '/robot_image';
        });
    }
    
    if (jumpToAnnotationButton) {
        jumpToAnnotationButton.addEventListener('click', function() {
            window.location.href = '/video_annotation';
        });
    }
    
    console.log('Video player initialized successfully');

    // 绑定上下文菜单的点击事件
    if(contextMenu){
        contextMenu.addEventListener('click', handleContextMenuClick);
    }
    
    // 添加全局点击事件监听器以隐藏菜单
    document.addEventListener('click', (event) => {
        if (Is_context_menu_just_shown) {
            Is_context_menu_just_shown = false;
            return;
        }

        const contextMenu = document.getElementById('context_menu');
        if (contextMenu.style.display !== 'none' && !contextMenu.contains(event.target)) {
            contextMenu.style.display = 'none';
            currentGridA = -1;
            currentGridB = -1;
        }
    });

    // 添加调试日志
    console.log('Setting up canvas event binding');
});