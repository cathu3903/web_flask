// Robot Video 页面的 JavaScript 文件 - 精简版YOLOv11虾皮检测
// 专门针对单一类别 shrimp_skin 检测

let Current_frame_data = null;
let flagAIRecognition = false;
let player = null;
let yoloModel = null;
let isModelLoaded = false;
let playerInitialized = false;

// 存储检测结果的变量 - 格式: [{id: 1, position: {x: 100, y: 200}}, ...]
let detectionResults = [];

// 精简的模型配置 - 仅针对虾皮检测
const MODEL_CONFIG = {
    inputSize: 640,
    confidenceThreshold: 0.5,
    nmsThreshold: 0.4,
    className: 'shrimp_skin',
    detectionColor: '#FF0000'  // 红色检测框
};

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

// 加载YOLOv11模型
async function loadYOLOModel(modelFile) {
    try {
        updateStatus('Loading YOLOv11 shrimp_skin detection model...');
        
        const session = new onnx.InferenceSession();
        const arrayBuffer = await modelFile.arrayBuffer();
        await session.loadModel(arrayBuffer);
        
        yoloModel = session;
        isModelLoaded = true;
        
        updateStatus('YOLOv11 model loaded successfully');
        
        // 启用AI识别按钮
        const aiButton = document.getElementById('ai_recognition_button');
        if (aiButton) {
            aiButton.disabled = false;
            aiButton.classList.remove('btn-ai');
            aiButton.classList.add('btn-ai-enabled');
        }
        
        return true;
    } catch (error) {
        console.error('Error loading YOLOv11 model:', error);
        updateStatus('Error loading model: ' + error.message);
        return false;
    }
}

// 视频事件处理函数
function onPlayerPaused() {
    console.log("Video paused");
    updatePauseButtonState();
    
    flagAIRecognition = true;
    Current_frame_data = captureCurrentFrame();
    
    updateStatus('Video paused - AI Recognition available');
}

function onPlayerPlaying() {
    console.log("Video playing");
    updatePauseButtonState();
    
    flagAIRecognition = false;
    Current_frame_data = null;
    
    updateStatus('Video playing');
}

function onVideoLoaded() {
    console.log("Video metadata loaded");
    
    try {
        console.log("Video dimensions:", player.videoWidth(), "x", player.videoHeight());
        
        // 延迟调整，确保视频尺寸信息已经可用
        setTimeout(() => {
            adjustVideoContainer();
            updatePauseButtonState();
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
            }).catch(error => {
                console.error('Error playing video:', error);
                updateStatus('Error playing video');
            });
        } else {
            player.pause();
            updatePauseButtonState();
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
        const videoContainer = document.querySelector('.video_container');
        const imageContainer = document.querySelector('.image_container');
        
        // 修复：使用 videoContainer 而不是 container
        if (videoContainer) {
            videoContainer.classList.remove('has-video');
            videoContainer.classList.add('no-video');
        }
        
        if (videoSection) {
            videoSection.classList.remove('video-loaded');
        }
        
        if (imageSection) {
            imageSection.classList.remove('video-loaded');
        }
        
        if (imageContainer) {
            imageContainer.style.height = '300px';
        }
        
        // 清除之前的错误状态
        player.error(null);
        
        // 设置视频源
        player.src({
            type: file.type,
            src: videoURL
        });
        
        // 监听视频加载完成
        player.one('loadedmetadata', () => {
            // 调整容器大小
            setTimeout(() => {
                adjustVideoContainer();
                updatePauseButtonState();
            }, 100);
            
            updateStatus('Video uploaded successfully');
        });
        
        // 监听加载错误
        player.one('error', () => {
            updateStatus('Error loading video file');
        });
        
        player.load();
    } catch (error) {
        console.error('Error handling video upload:', error);
        updateStatus('Error uploading video: ' + error.message);
    }
}

// 窗口大小调整处理
function handleResize() {
    console.log('Window resize event');
    if (player && player.videoWidth && player.videoWidth() > 0) {
        // 延迟调整，确保DOM已经更新
        setTimeout(() => {
            adjustVideoContainer();
        }, 100);
    }
}

// 更新状态显示
function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = `Status: ${message}`;
        console.log('Status:', message);
    }
}

// 更新检测信息显示
function updateDetectionInfo(message) {
    const infoElement = document.getElementById('detection_info');
    if (infoElement) {
        infoElement.innerHTML = `<strong>Detection Info:</strong> ${message}`;
        infoElement.classList.add('show');
        
        // 5秒后自动隐藏
        setTimeout(() => {
            infoElement.classList.remove('show');
        }, 5000);
    }
}

// 键盘事件处理
function handleKeydown(event) {
    switch(event.code) {
        case 'Space':
            event.preventDefault();
            togglePlayPause();
            break;
        case 'KeyA':
            if (event.ctrlKey) {
                event.preventDefault();
                performAIRecognition();
            }
            break;
        case 'KeyE':
            if (event.ctrlKey) {
                event.preventDefault();
                executeRobotAction();
            }
            break;
    }
}

// 页面跳转功能
function jumpToRobotImage() {
    window.location.href = '/robot_image';
}

function jumpToVideoAnnotation() {
    window.location.href = '/video_annotation';
}

// 执行机器人动作功能
function executeRobotAction() {
    const results = getCurrentDetectionResults();
    
    if (results.length === 0) {
        updateStatus('No detection results available for robot action');
        return;
    }
    
    updateStatus('Executing robot action with detection results...');
    
    // 发送检测结果到后端
    fetch('/execute_robot_action', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            frame_data: Current_frame_data,
            detection_results: results,
            timestamp: new Date().toISOString()
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Robot action executed with results:', data);
        updateStatus('Robot action executed successfully');
    })
    .catch(error => {
        console.error('Error executing robot action:', error);
        updateStatus('Error executing robot action');
    });
}

// 获取当前检测结果
function getCurrentDetectionResults() {
    return detectionResults;
}

// 模拟AI识别功能
async function performAIRecognition() {
    if (!flagAIRecognition) {
        updateStatus('Please pause the video first for AI recognition');
        return;
    }
    
    if (!Current_frame_data) {
        updateStatus('No frame data available');
        return;
    }
    
    if (!isModelLoaded) {
        updateStatus('Please load YOLOv11 model first');
        return;
    }
    
    updateStatus('AI Recognition in progress...');
    
    // 模拟结果
    setTimeout(() => {
        const mockResults = [
            { id: 1, position: { x: 150, y: 200 } },
            { id: 2, position: { x: 300, y: 150 } }
        ];
        
        detectionResults = mockResults;
        displayRecognitionResult();
        
        if (mockResults.length > 0) {
            const positions = mockResults.map(r => `(${r.position.x}, ${r.position.y})`).join(', ');
            updateDetectionInfo(`Found ${mockResults.length} shrimp_skin objects at: ${positions}`);
        } else {
            updateDetectionInfo('No shrimp_skin objects detected');
        }
        
        updateStatus('AI Recognition completed');
    }, 2000);
}

// 显示识别结果
function displayRecognitionResult() {
    const imageDisplay = document.getElementById('image_display');
    const imagePlaceholder = document.querySelector('.image_placeholder');
    
    if (Current_frame_data && imageDisplay) {
        imageDisplay.src = Current_frame_data;
        imageDisplay.style.display = 'block';
        if (imagePlaceholder) {
            imagePlaceholder.style.display = 'none';
        }
    }
}

// DOM加载完成后的初始化
document.addEventListener("DOMContentLoaded", function() {
    console.log("Robot Video with YOLOv11 Shrimp Detection loaded");
    
    // 初始化视频播放器
    const playerInstance = initVideoPlayer();
    if (!playerInstance) {
        console.error('Failed to initialize video player');
        updateStatus('Error initializing video player');
        return;
    }
    
    // 获取DOM元素
    const fileInput = document.getElementById('video_file_input');
    const modelFileInput = document.getElementById('model_file_input');
    const uploadButton = document.getElementById('upload_video_button');
    const loadModelButton = document.getElementById('load_model_button');
    const pauseButton = document.getElementById('pause_button');
    const aiRecognitionButton = document.getElementById('ai_recognition_button');
    const executeButton = document.getElementById('execute_button');
    const jumpToRobotImageButton = document.getElementById('jump_to_robot_image');
    const jumpToVideoAnnotationButton = document.getElementById('jump_to_video_annotation');
    
    // 初始状态：禁用AI识别按钮
    if (aiRecognitionButton) {
        aiRecognitionButton.disabled = true;
    }
    
    // 事件监听器
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }
    
    if (loadModelButton) {
        loadModelButton.addEventListener('click', () => {
            if (modelFileInput) modelFileInput.click();
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) handleVideoUpload(file);
        });
    }
    
    if (modelFileInput) {
        modelFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) loadYOLOModel(file);
        });
    }
    
    if (pauseButton) {
        pauseButton.addEventListener('click', togglePlayPause);
    }
    
    if (aiRecognitionButton) {
        aiRecognitionButton.addEventListener('click', performAIRecognition);
    }
    
    if (executeButton) {
        executeButton.addEventListener('click', executeRobotAction);
    }
    
    if (jumpToRobotImageButton) {
        jumpToRobotImageButton.addEventListener('click', jumpToRobotImage);
    }
    
    if (jumpToVideoAnnotationButton) {
        jumpToVideoAnnotationButton.addEventListener('click', jumpToVideoAnnotation);
    }
    
    // 全局事件监听
    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', handleKeydown);
    
    // 拖拽上传支持
    const videoContainer = document.querySelector('.video_container');
    if (videoContainer) {
        videoContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            videoContainer.classList.add('drag-over');
        });
        
        videoContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            videoContainer.classList.remove('drag-over');
        });
        
        videoContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            videoContainer.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleVideoUpload(files[0]);
            }
        });
    }
    
    updateStatus('YOLOv11 Shrimp Detection ready - Please upload a video and load model');
});

// 页面卸载时清理
window.addEventListener('beforeunload', function() {
    if (player && playerInitialized) {
        try {
            player.dispose();
        } catch (error) {
            console.error('Error disposing video player:', error);
        }
    }
});