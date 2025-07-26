// Robot Video Page JavaScript File - Simplified version, directly send to backend server
let Current_frame_data = null;
let flagAIRecognition = false;
let player = null;
let playerInitialized = false;

// Store detection results - Format: [{id: 1, position: {x: 100, y: 200}}, ...]
let detectionResults = [];
let GlobalManualId = 0;

// New: Grid parameters (from backend or default values)
let gridM = 10;
let gridN = 10;
let Is_context_menu_just_shown = false;
let GlobalMachineId = 0;
let currentGridA = null;
let currentGridB = null;
let visualDetectionId = null;
let GlobalModelId = 0;

// New: Color mapping
const stainLevelColors = {
    0: "rgba(255, 255, 255, 0.5)",  // white
    1: "rgba(0, 255, 0, 0.5)",      // green - default value
    2: "rgba(255, 255, 0, 0.5)",    // yellow
    3: "rgba(0, 0, 255, 0.5)",      // blue
    4: "rgba(255, 0, 0, 0.5)"       // red
};

// 2D array to store grid status
let GridMatrix = [];

// Map to store detailed information, key in "a,b" format
let GridDataMap = new Map();

// Initialize grid
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

// Add grid data
function addGridData(a, b, gridInfo) {
    const key = `${a},${b}`;
    
    // Update 2D array
    GridMatrix[a][b] = {
        stainLevel: gridInfo.stainLevel,
        hasData: true
    };
    
    // Update Map
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

// Get grid data
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
        // Update visual display
        const canvas = document.getElementById('detection_canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            // Clear previous color
            ctx.clearRect(grid.startX, grid.startY, grid.width, grid.height);

            // Draw new color
            ctx.fillStyle = stainLevelColors[stainLevel];
            ctx.fillRect(grid.startX, grid.startY, grid.width, grid.height);

            // Redraw text identifier
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

// Delete grid data
function removeGridData(a, b) {
    const key = `${a},${b}`;
    // Clear visual effect
    clearGridVisual(a, b);
    // Clear 2D array
    GridMatrix[a][b] = {
        stainLevel: 0,
        hasData: false
    };

    // Delete from Map
    GridDataMap.delete(key);

}

// Check if grid has data
function hasGridData(a, b) {
    return GridMatrix[a][b] && GridMatrix[a][b].hasData;
}

// Get all grid data
function getAllGridData() {
    return Array.from(GridDataMap.values());
}

// Initialize grid line drawing - Refer to initGrid function in video_annotation.js
function initGridLines(m, n) {
    const canvas = document.getElementById('detection_canvas');
    const imageDisplay = document.getElementById('image_display');
    
    if (!canvas || !imageDisplay) {
        console.error('Canvas or image display not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const rect = imageDisplay.getBoundingClientRect();
    
    // Set canvas dimensions to match image display size
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Set canvas style position to overlay on image
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'auto'; // Allow click events
    
    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set grid line style
    ctx.strokeStyle = 'rgb(255, 0, 0)';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let i = 1; i < m; i++) {
        const x = (canvas.width / m) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let i = 1; i < n; i++) {
        const y = (canvas.height / n) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// Clear grid visual effect
function clearGridVisual(a, b) {
    const canvas = document.getElementById('detection_canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const grid = getGridData(a, b);
    
    const gridWidth = grid.width;
    const gridHeight = grid.height;
    
    const startX = grid.startX;
    const startY = grid.startY;
    
    // Clear this grid area
    ctx.clearRect(startX, startY, gridWidth, gridHeight);
    
    // Redraw grid lines
    ctx.strokeStyle = 'rgb(255, 0, 0)';
    ctx.lineWidth = 1;
    
    // Redraw the border of this grid
    ctx.strokeRect(startX, startY, gridWidth, gridHeight);
}

// Initialize video player
function initVideoPlayer() {
    const videoElement = document.getElementById('video_player');
    
    // Check if already initialized
    if (playerInitialized && player) {
        console.log('Video player already initialized');
        return player;
    }
    
    // Destroy existing player instance (if exists)
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
    
    // Configure Video.js options
    const options = {
        fluid: true,
        responsive: true,
        controls: true,
        preload: 'none', // Avoid loading empty source
        playbackRates: [0.5, 1, 1.5, 2],
        techOrder: ['html5'],
        sources: [], // Initialize with empty source list
        html5: {
            vhs: {
                overrideNative: true
            }
        }
    };
    
    try {
        player = videojs(videoElement, options);
        playerInitialized = true;
        
        // Listen to player events
        player.on('pause', onPlayerPaused);
        player.on('play', onPlayerPlaying);
        player.on('loadedmetadata', onVideoLoaded);
        player.on('canplay', onVideoCanPlay);
        player.on('error', onVideoError);
        player.on('resize', onVideoResize);
        
        // Set initial state
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

// Update pause button state
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

// Update AI Recognition button state
function updateAIRecognitionButton() {
    const aiButton = document.getElementById('ai_recognition_button');
    if (!aiButton) return;
    
    try {
        if (flagAIRecognition && Current_frame_data) {
            // Enable button when paused and frame data exists
            aiButton.disabled = false;
            aiButton.classList.remove('btn-ai-disabled');
            aiButton.classList.add('btn-ai');
        } else {
            // Disable button in other states
            aiButton.disabled = true;
            aiButton.classList.remove('btn-ai');
            aiButton.classList.add('btn-ai-disabled');
        }
    } catch (error) {
        console.error('Error updating AI recognition button state:', error);
    }
}

// Dynamically adjust video container and image container size
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
            // Mark as video state
            videoContainer.classList.add('has-video');
            videoContainer.classList.remove('no-video');
            videoSection.classList.add('video-loaded');
            imageSection.classList.add('video-loaded');
            
            // Calculate video aspect ratio
            const videoAspectRatio = videoWidth / videoHeight;
            
            // Get actual width of video area (minus padding)
            const sectionPadding = 60; // 30px on each side
            const availableWidth = videoSection.offsetWidth - sectionPadding;
            
            // Calculate maximum available height (60% of screen height)
            const maxHeight = window.innerHeight * 0.6;
            
            // Calculate height based on aspect ratio
            let newHeight = availableWidth / videoAspectRatio;
            
            // Limit maximum height
            if (newHeight > maxHeight) {
                newHeight = maxHeight;
            }
            
            // Limit minimum height
            const minHeight = 250;
            if (newHeight < minHeight) {
                newHeight = minHeight;
            }
            
            // Set video container height
            videoContainer.style.height = `${newHeight}px`;
            
            // Set image container to same height
            imageContainer.style.height = `${newHeight}px`;
            
            // Adjust player dimensions
            player.dimensions(availableWidth, newHeight);
            
            console.log(`Containers adjusted: ${availableWidth}x${newHeight}, aspect ratio: ${videoAspectRatio}`);
        } else {
            // Default state when no video
            videoContainer.classList.add('no-video');
            videoContainer.classList.remove('has-video');
            videoSection.classList.remove('video-loaded');
            imageSection.classList.remove('video-loaded');
            
            // Reset image container height
            imageContainer.style.height = '300px';
        }
    } catch (error) {
        console.error('Error adjusting video container:', error);
    }
}

// Handle video size change
function onVideoResize() {
    console.log('Video resize event triggered');
    adjustVideoContainer();
}

// Video event handler functions
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
        
        // Delay adjustment to ensure video dimension info is available
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
        // Adjust container size again
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
        // Only show error when there's an actual video source
        if (player && player.currentSrc() && player.currentSrc() !== '') {
            updateStatus('Video loading error');
        } else {
            // If no source, don't show error
            updateStatus('Video ready - Please upload a video file');
        }
    } catch (e) {
        console.error('Error in onVideoError:', e);
    }
}

// Toggle play/pause state
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

// Handle video upload
function handleVideoUpload(file) {
    if (!file) return;
    
    try {
        const videoURL = URL.createObjectURL(file);
        
        // Set video source
        player.src({
            type: 'video/mp4',
            src: videoURL
        });
        
        // Reload and play
        player.load();
        player.play();
        
        console.log('Video uploaded successfully');
        updateStatus('Video uploaded and loading...');
        
    } catch (error) {
        console.error('Error uploading video:', error);
        updateStatus('Error uploading video');
    }
}

// Capture current frame
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

// Update image placeholder
function updateImagePlaceholder(message) {
    const placeholder = document.querySelector('.image_placeholder');
    if (placeholder) {
        placeholder.innerHTML = `<p>${message}</p>`;
        placeholder.style.display = 'block';
    }
    
    // Hide image and canvas
    const imageDisplay = document.getElementById('image_display');
    const canvas = document.getElementById('detection_canvas');
    
    if (imageDisplay) {
        imageDisplay.style.display = 'none';
    }
    
    if (canvas) {
        canvas.style.display = 'none';
    }
}

// Modified: Render grid based on detection results - Refer to choose_color function in video_annotation.js
function renderGridByResults(gridPositions) {
    if (!gridPositions || gridPositions.length === 0) {
        console.log('No grid positions to render');
        return;
    }

    // Initialize grid data
    initGridData(gridM, gridN);
    
    // Get canvas and image elements
    const canvas = document.getElementById('detection_canvas');
    const imageDisplay = document.getElementById('image_display');
    
    if (!canvas || !imageDisplay) {
        console.error('Canvas or image display not found');
        return;
    }

    // Wait for image to load before drawing grid
    const renderGrid = () => {
        const ctx = canvas.getContext('2d');
        const rect = imageDisplay.getBoundingClientRect();
        
        // Set canvas dimensions to match image display size
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Set canvas style position to overlay on image
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'auto'; // Allow click events
        
        // Clear previous drawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // First draw grid lines
        initGridLines(gridM, gridN);
        // Initialize visual id
        visualDetectionId = 0;

        // Iterate through each detection result's grid position
        gridPositions.forEach((gridPos, index) => {
            const { id, a, b } = gridPos;

            // a,b may be duplicated, need to deduplicate
            if (gridPositions.findIndex(pos => pos.a === a && pos.b === b) !== index)
            {return;}
            
            // Calculate actual pixel position of grid - Refer to method in video_annotation.js
            const x1 = a * (canvas.width / gridM) + 1;
            const y1 = b * (canvas.height / gridN) + 1;
            const w = canvas.width / gridM - 2;
            const h = canvas.height / gridN - 2;
            
            // Get corresponding detection result info
            const detection = detectionResults[id] || {};
            const className = detection.class_name || 'unknown';
            
            // Default stainLevel = 1 (green)
            const stainLevel = 1;
            const color = stainLevelColors[stainLevel];
            
            // Draw grid fill
            ctx.fillStyle = color;
            ctx.fillRect(x1, y1, w, h);
            
            // Draw text identifier at grid center
            ctx.fillStyle = 'black';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const centerX = x1 + w / 2;
            const centerY = y1 + h / 2;
            
            // Draw detection ID and class name
            // Use visualId instead of detection id
            ctx.fillText(`${visualDetectionId}`, centerX, centerY - 8);
            ctx.fillText(`${className}`, centerX, centerY + 8);
            visualDetectionId ++;
            
            // Store grid info using GridDataMap
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
            
            // Add to GridDataMap
            addGridData(a, b, gridInfo);
            
            console.log(`Rendered grid at (${a}, ${b}) for detection ${id} (${className})`);
        });
        
        console.log(`Rendered ${gridPositions.length} grid positions`);
        console.log('GridDataMap:', GridDataMap);
    };
    
    // If image already loaded, render directly
    if (imageDisplay.complete && imageDisplay.naturalWidth > 0) {
        renderGrid();
    } else {
        // Otherwise wait for image to load
        imageDisplay.onload = renderGrid;
    }
}

// Modified: Clear grid rendering - Use GridDataMap
function clearGridRender() {
    const canvas = document.getElementById('detection_canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Clear GridDataMap
    GridDataMap.clear();
    
    // Reset GridMatrix
    initGridData(gridM, gridN);
    
    console.log('Grid render cleared');
}

// Modified performAIRecognition function
async function performAIRecognition() {
    if (!flagAIRecognition) {
        updateStatus('Please pause the video first for AI recognition');
        return;
    }
    
    if (!Current_frame_data) {
        updateStatus('No frame data available');
        return;
    }
    
    // Update image area display text to waiting state
    updateImagePlaceholder('Waiting for server result...');
    updateStatus('AI Recognition in progress...');
    
    try {
        // Convert base64 image data to blob format
        const response = await fetch(Current_frame_data);
        const blob = await response.blob();
        
        // Create FormData object to send image
        const formData = new FormData();
        formData.append('image', blob, 'frame.png');
        if (GlobalModelId == 0)
            formData.append('model_id', 'upper_part_model');
        else if (GlobalModelId == 1)
            formData.append('model_id', 'lower_part_model');
        formData.append('image_size', '640');
        formData.append('conf_threshold', '0.3');
        
        // Send to Flask backend
        const apiResponse = await fetch('/yolo_inference', {
            method: 'POST',
            body: formData
        });
        
        if (!apiResponse.ok) {
            throw new Error(`HTTP error! status: ${apiResponse.status}`);
        }
        
        const result = await apiResponse.json();
        
        // Check if there are recognition results
        if (result.success && result.annotated_image) {
            // Display recognition result image
            displayRecognitionResult(result.annotated_image);
            
            // Update grid parameters
            gridM = result.grid_m || 10;
            gridN = result.grid_n || 10;
            
            // Store detection results and grid positions
            detectionResults = result.detections || [];
            const gridPositions = result.grid_positions || [];
            
            // Delay rendering grid to ensure image is loaded
            setTimeout(() => {
                renderGridByResults(gridPositions);
            }, 100);
            
            // Update detection info, including grid position info
            if (result.detections && result.detections.length > 0) {
                let infoText = `Found ${result.detections.length} objects:\n`;
                result.detections.forEach((detection, index) => {
                    const gridPos = gridPositions[index];
                    infoText += `• ${detection.class_name} (confidence: ${(detection.confidence * 100).toFixed(1)}%) at grid (${gridPos.a}, ${gridPos.b})\n`;
                });
                updateDetectionInfo(infoText);
                
                // Output grid position info in console
                console.log('Grid positions:', gridPositions);
                console.log('GridDataMap:', GridDataMap);
            } else {
                updateDetectionInfo('No objects detected');
            }
            
            updateStatus('AI Recognition completed successfully');
        } else {
            // If no recognition results, display original image
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

// Modified: Execute robot action based on grid position - Use GridDataMap
function executeRobotAction() {
    const allGridData = getAllGridData();
    
    if (!allGridData || allGridData.length === 0) {
        updateStatus('No grid positions selected. Please run AI Recognition first.');
        return;
    }

    // Get first grid position
    const firstGrid = allGridData[0];
    if (firstGrid) {
        const { a, b, className } = firstGrid;
        
        console.log(`Executing robot action at grid position (${a}, ${b}) for ${className}`);
        updateStatus(`Executing robot action at grid (${a}, ${b}) for ${className}`);
        
        // Send all grid positions to backend
        sendGridPositionsToRobot(allGridData);
    }
}

// Modified: Send grid positions to robot control system - Use GridDataMap
async function sendGridPositionsToRobot(gridPositions) {
    try {
        // Get current image
        const imageDisplay = document.getElementById('image_display');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas dimensions to match image
        canvas.width = imageDisplay.naturalWidth;
        canvas.height = imageDisplay.naturalHeight;

        // Draw image on canvas
        ctx.drawImage(imageDisplay, 0, 0);

        // Get base64 data of current image
        const frameData = canvas.toDataURL('image/png');

        // Prepare cropped image array
        const croppedImages = [];

        // Convert to new annotation format
        const annotations = gridPositions.map(grid => {
            const { startX, startY, width, height, a, b, m, n, stainLevel, machineId} = grid;

            // Crop each area
            const cropCanvas = document.createElement('canvas');
            const cropCtx = cropCanvas.getContext('2d');
            cropCanvas.width = width;
            cropCanvas.height = height;
            cropCtx.drawImage(imageDisplay, startX, startY, width, height, 0, 0, width, height);

            // Add cropped image to array
            croppedImages.push(cropCanvas.toDataURL('image/png'));

            // Return new format annotation
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

        // Use same format as submitOneFrameAnnotation to send data
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
            GlobalManualId = 0;
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error sending robot action:', error);
        updateStatus('Failed to send robot action: ' + error.message);
    }
}

// Grid click event handler - Support click to delete
function onGridClick(event) {
    const canvas = document.getElementById('detection_canvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate clicked grid coordinates
    const gridWidth = canvas.width / gridM;
    const gridHeight = canvas.height / gridN;
    
    const a = Math.floor(mouseX / gridWidth);
    const b = Math.floor(mouseY / gridHeight);
    
    // Check boundaries
    if (a >= 0 && a < gridM && b >= 0 && b < gridN) {
        if (hasGridData(a, b)) {
            // If grid has data, delete it
            removeGridData(a, b);
            console.log(`Removed grid data at (${a}, ${b})`);
            updateStatus(`Removed grid at (${a}, ${b})`);
        } else {
            console.log(`No data at grid (${a}, ${b})`);
        }
    }
}

// Modified: displayRecognitionResult function
function displayRecognitionResult(imageData) {
    const imageDisplay = document.getElementById('image_display');
    const placeholder = document.querySelector('.image_placeholder');
    const canvas = document.getElementById('detection_canvas');


    if (imageDisplay && placeholder) {
        // Clear previous grid rendering
        clearGridRender();
        
        // Hide placeholder, show image
        placeholder.style.display = 'none';
        imageDisplay.style.display = 'block';
        imageDisplay.src = imageData;
        
        // Ensure image fully loads before binding events
        imageDisplay.onload = () => {
            if (canvas) {
                // Set canvas dimensions to match image
                canvas.width = imageDisplay.width;
                canvas.height = imageDisplay.height;
                canvas.style.display = 'block';
                
                // Remove possible old event listeners
                canvas.removeEventListener('click', handleGridClick);
                // Bind click event to support grid operations
                canvas.addEventListener('click', handleGridClick);
                
                // Redraw grid lines
                initGridLines(gridM, gridN);
            }
        };
                // If there's a canvas, also show and bind click event
        // if (canvas) {
        //     canvas.style.display = 'block';
        //     // Bind click event to support deleting grid
        //     canvas.removeEventListener('click', handleGridClick);
        //     canvas.addEventListener('click', handleGridClick);
        // }
    }
}

// Status update function
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

    // Get click position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const mouse_x = event.clientX - rect.left;
    const mouse_y = event.clientY - rect.top;

    // Check if click is within valid area
    if (mouse_x >= 0 && mouse_x < rect.width && mouse_y >= 0 && mouse_y < rect.height) {
        // Calculate clicked grid coordinates
        const gridWidth = canvas.width / gridM;
        const gridHeight = canvas.height / gridN;

        const a = Math.floor(mouse_x / gridWidth);
        const b = Math.floor(mouse_y / gridHeight);

        // Check boundaries
        if (a >= 0 && a < gridM && b >= 0 && b < gridN) {
            // Save current clicked grid coordinates
            currentGridA = a;
            currentGridB = b;
            // Show menu
            const dropdown = document.getElementById('context_menu');
            dropdown.style.display = 'block';
            
            // Use pageX/pageY and add 5px offset to prevent cursor occlusion
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
                    
                    // Hide menu
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
                // Hide menu
                const contextMenuReturn = document.getElementById('context_menu');
                if (contextMenuReturn) {
                    contextMenuReturn.style.display = 'none';
                }
                
                currentGridA = -1;
                currentGridB = -1;
                return;
        }
        
        // For color change operations
        if (color && stain_level) {
            let grid = getGridData(a, b);
            if (grid) {
                // Update grid level
                updateGridLevel(a, b, stain_level);
                
                console.log(`Updated grid (${a}, ${b}) to stain level ${stain_level}`);
                updateStatus(`Updated grid (${a}, ${b}) to stain level ${stain_level}`);
            }
            else {
                // create new grid and draw
                // If clicking on an empty grid, add a new grid entry
                if (!hasGridData(a, b)) {

                    // Calculate actual pixel position of grid
                    const x1 = a * (canvas.width / gridM) + 1;
                    const y1 = b * (canvas.height / gridN) + 1;
                    const w = canvas.width / gridM - 2;
                    const h = canvas.height / gridN - 2;

                    // Create new grid info
                    const gridInfo = {
                        startX: x1,
                        startY: y1,
                        width: w,
                        height: h,
                        m: gridM,
                        n: gridN,
                        stainLevel: stain_level,
                        detectionId: GlobalManualId,
                        className: 'manual',
                        machineId: GlobalMachineId,
                    };

                    // Add to GridDataMap
                    addGridData(a, b, gridInfo);

                    // Draw new grid
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = color;
                    ctx.fillRect(x1, y1, w, h);

                    // Draw text identifier at grid center
                    ctx.fillStyle = 'black';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const centerX = x1 + w / 2;
                    const centerY = y1 + h / 2;

                    // Draw detection class name (manual)
                    ctx.fillText(`${GlobalManualId}`, centerX, centerY - 8);
                    ctx.fillText('manual', centerX, centerY + 8);

                    console.log(`Added new grid at (${a}, ${b}) with detectionId ${GlobalManualId}`);
                    GlobalManualId ++;
                }
            }
        }
        
        // Hide menu
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
    
    // Initialize grid data
    initGridData(gridM, gridN);
    
    // Initialize video player
    initVideoPlayer();
    
    // Bind event listeners
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
    
    // Pause/Play button
    if (pauseButton) {
        pauseButton.addEventListener('click', togglePlayPause);
    }
    
    // AI recognition button
    if (aiRecognitionButton) {
        aiRecognitionButton.addEventListener('click', performAIRecognition);
    }
    
    // Execute button
    if (executeButton) {
        executeButton.addEventListener('click', executeRobotAction);
    }
    
    // Machine selection dropdown menu
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
    
    // Click elsewhere on page to close dropdown menu
    window.addEventListener('click', function(event) {
        const machineSelector = document.querySelector('.machine-selector');
        if (machineSelector && !machineSelector.contains(event.target)) {
            const dropdown = document.getElementById('machine_dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        }
    });
    
    // Jump buttons
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

    // Bind context menu click event
    if(contextMenu){
        contextMenu.addEventListener('click', handleContextMenuClick);
    }
    
    // Add global click event listener to hide menu
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

    // Add debug log
    console.log('Setting up canvas event binding');
});