// Robot Video 页面的 JavaScript 文件 - 简化版，直接发送到后端服务器
let Current_frame_data = null;
let flagAIRecognition = false;
let player = null;
let playerInitialized = false;

// 存储检测结果的变量 - 格式: [{id: 1, position: {x: 100, y: 200}}, ...]
let detectionResults = [];

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
        formData.append('model_id', 'yolov11n.pt'); // 你可以根据实际模型名称调整
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
            
            // 绘制红色网格 (假设使用 M x N 网格)
            drawRedGrid(result.grid_m || 10, result.grid_n || 10);
            
            // 更新检测信息
            if (result.detections && result.detections.length > 0) {
                updateDetectionInfo(`Found ${result.detections.length} objects detected`);
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

// 更新图片占位符文字
function updateImagePlaceholder(text) {
    const placeholder = document.querySelector('.image_placeholder p');
    if (placeholder) {
        placeholder.textContent = text;
    }
}

// 显示识别结果
function displayRecognitionResult(imageData) {
    const imageDisplay = document.getElementById('image_display');
    const placeholder = document.querySelector('.image_placeholder');
    const canvas = document.getElementById('detection_canvas');
    
    if (imageDisplay && placeholder) {
        // 隐藏占位符，显示图片
        placeholder.style.display = 'none';
        imageDisplay.style.display = 'block';
        imageDisplay.src = imageData;
        
        // 如果有canvas，也显示
        if (canvas) {
            canvas.style.display = 'block';
        }
    }
}

// 在图片区域上方绘制红色网格
function drawRedGrid(m, n) {
    const canvas = document.getElementById('detection_canvas');
    const imageDisplay = document.getElementById('image_display');
    
    if (!canvas || !imageDisplay) return;
    
    // 等待图片加载完成
    imageDisplay.onload = function() {
        const ctx = canvas.getContext('2d');
        const rect = imageDisplay.getBoundingClientRect();
        
        // 设置canvas尺寸与图片一致
        canvas.width = imageDisplay.naturalWidth || imageDisplay.width;
        canvas.height = imageDisplay.naturalHeight || imageDisplay.height;
        
        // 设置canvas样式位置覆盖在图片上
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none'; // 允许点击穿透
        
        // 清除之前的绘制
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 设置红色网格样式
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        
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
    };
}

// 处理视频文件上传
function handleVideoUpload(file) {
    if (!file || !file.type.startsWith('video/')) {
        updateStatus('Please select a valid video file');
        return;
    }
    
    if (!player) {
        console.error('Video player not initialized');
        return;
    }
    
    try {
        const videoURL = URL.createObjectURL(file);
        
        // 显示加载状态
        updateStatus('Loading video...');
        
        // 重置容器状态
        const videoSection = document.querySelector('.video_section');
        const imageSection = document.querySelector('.image_section');
        
        if (videoSection) videoSection.classList.remove('video-loaded');
        if (imageSection) imageSection.classList.remove('video-loaded');
        
        // 重置检测结果
        detectionResults = [];
        const imageDisplay = document.getElementById('image_display');
        const placeholder = document.querySelector('.image_placeholder');
        const canvas = document.getElementById('detection_canvas');
        
        if (imageDisplay) imageDisplay.style.display = 'none';
        if (canvas) canvas.style.display = 'none';
        if (placeholder) {
            placeholder.style.display = 'block';
            updateImagePlaceholder('Detection results will appear here');
        }
        
        // 设置视频源
        player.src({ type: file.type, src: videoURL });
        
        // 重置AI识别状态
        flagAIRecognition = false;
        Current_frame_data = null;
        updateAIRecognitionButton();
        
        console.log('Video uploaded successfully');
        
    } catch (error) {
        console.error('Error uploading video:', error);
        updateStatus('Error uploading video: ' + error.message);
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
        detectionInfoElement.textContent = message;
    }
}

// DOM加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    
    // 初始化视频播放器
    initVideoPlayer();
    
    // 绑定事件监听器
    const uploadButton = document.getElementById('upload_video_button');
    const fileInput = document.getElementById('video_file_input');
    const pauseButton = document.getElementById('pause_button');
    const aiRecognitionButton = document.getElementById('ai_recognition_button');
    
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
    
    if (pauseButton) {
        pauseButton.addEventListener('click', togglePlayPause);
    }
    
    if (aiRecognitionButton) {
        aiRecognitionButton.addEventListener('click', performAIRecognition);
    }
    
    // 页面跳转按钮事件
    const jumpToImageButton = document.getElementById('jump_to_robot_image');
    const jumpToAnnotationButton = document.getElementById('jump_to_video_annotation');
    
    if (jumpToImageButton) {
        jumpToImageButton.addEventListener('click', () => {
            window.location.href = '/image_cleaning';
        });
    }
    
    if (jumpToAnnotationButton) {
        jumpToAnnotationButton.addEventListener('click', () => {
            window.location.href = '/to_annotation';
        });
    }
    
    // 初始化状态
    updateStatus('Ready - Please upload a video file');
    updateAIRecognitionButton();
});