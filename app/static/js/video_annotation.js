let Annotations = [];
let Current_grid = null;
let Is_context_menu_just_shown = false;
let flagAnnotate = false;      // flag of whether the user is allowed to annotate
let Current_frame_data = null;
let Current_cropped_image = [];
let GridMatrix = [];
let player = null;
let playerInitialized = false;

function redrawGrids(canvas, ctx)
{
    // Redraw all grid colors from GridMatrix
    if (GridMatrix === []) {
        return;
    }
    for(let i = 0; i < M; i++) {
        for(let j = 0; j < N; j++) {
            if(GridMatrix[i][j].stainLevel > 0) {
                // Calculate cell position
                const cellX = (canvas.width / M) * i;
                const cellY = (canvas.height / N) * j;
                const cellWidth = canvas.width / M;
                const cellHeight = canvas.height / N;

                // Set color based on stain level
                let cellColor;
                switch(GridMatrix[i][j].stainLevel) {
                    case 1: cellColor = "rgba(0, 255, 0, 0.5)"; break;
                    case 2: cellColor = "rgba(255, 255, 0, 0.5)"; break;
                    case 3: cellColor = "rgba(0, 0, 255, 0.5)"; break;
                    case 4: cellColor = "rgba(255, 0, 0, 0.5)"; break;
                    default: cellColor = "rgba(255, 255, 255, 0.5)";
                }

                // Draw colored cell
                ctx.fillStyle = cellColor;
                ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
            }
        }
    }
}

function initGrid(m , n)
{
    var canvas = document.getElementById('grid_overlay');
    const playerElement = videojs('video_player');
    
    // Get the actual video element inside the video.js container
    const videoElem = playerElement.el().querySelector('video');
    
    if (!videoElem) {
        console.error('Video element not found');
        return;
    }

    // Get the bounding rectangle of the video element
    const rect = videoElem.getBoundingClientRect();
    
    GridMatrix = [];

    for(let i = 0; i < m; i ++)
    {
        GridMatrix[i] = [];
        for(let j = 0; j < n; j++)
        {
            GridMatrix[i][j] = {stainLevel: 0};
        }
    }

    // Position the canvas to exactly overlay the video element
    canvas.style.position = 'absolute';
    canvas.style.top = rect.top + 'px';
    canvas.style.left = rect.left + 'px';
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.pointerEvents = 'auto';
    canvas.style.zIndex = '2';

    // Use relative positioning to handle parent container
    const parent = videoElem.offsetParent;
    if (parent) {
        const parentRect = parent.getBoundingClientRect();
        canvas.style.top = (rect.top - parentRect.top) + 'px';
        canvas.style.left = (rect.left - parentRect.left) + 'px';
    }

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgb(255, 0, 0)';   // set the color of the grids

    // Draw vertical grid lines
    for(let i = 1; i < m; i++)
    {
        const x = (canvas.width / m) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Draw horizontal grid lines
    for(let i = 1; i < n; i++)
    {
        const y = (canvas.height / n) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    redrawGrids(canvas, ctx);
}

// Initialize video player
function initVideoPlayer() {
    const videoElement = document.getElementById('video_player');
    
    // Dispose of existing player if it exists
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
        html5: {
            hls: {
                overrideNative: true
            }
        },
        flash: {
            hls: {
                overrideNative: true
            }
        },
        fluid: true,
        responsive: true,
        controls: true,
        preload: 'auto',
        playbackRates: [0.5, 1, 1.5, 2],
        techOrder: ['html5']
    };
    
    try {
        player = videojs(videoElement, options);
        playerInitialized = true;
        
        // Listen to player events
        player.on('pause', PlayerPaused);
        player.on('play', PlayerPlaying);
        player.on('loadedmetadata', onVideoLoaded);
        player.on('canplay', onVideoCanPlay);
        player.on('error', onVideoError);
        player.on('resize', onVideoResize);
        
        // Set initial state
        player.ready(() => {
            console.log('Video player is ready');
            updatePlayPauseButtonState();
        });
        
        return player;
    } catch (error) {
        console.error('Error initializing video player:', error);
        return null;
    }
}

// Video event handlers
function onVideoLoaded() {
    console.log("Video metadata loaded");
    
    try {
        console.log("Video dimensions:", player.videoWidth(), "x", player.videoHeight());
        
        // Delay adjustment to ensure video dimension info is available
        setTimeout(() => {
            adjustVideoContainer();
            initGrid(M, N);
        }, 100);
    } catch (error) {
        console.error('Error handling video loaded event:', error);
    }
}

function onVideoCanPlay() {
    console.log("Video can play");
    // Reinitialize grid when video can play
    setTimeout(() => {
        initGrid(M, N);
    }, 50);
}

function onVideoError() {
    console.error("Video error occurred");
    const error = player.error();
    if (error) {
        console.error("Video.js error:", error.message);
    }
}

function onVideoResize() {
    console.log('Video resize event triggered');
    adjustVideoContainer();
    // Update grid overlay when video is resized
    setTimeout(() => {
        initGrid(M, N);
    }, 50);
}

// Dynamically adjust video container size
function adjustVideoContainer() {
    const videoSection = document.querySelector('.video_section');
    const videoContainer = document.querySelector('.video_container');
    
    if (!player || !videoSection || !videoContainer) return;
    
    try {
        const videoWidth = player.videoWidth();
        const videoHeight = player.videoHeight();
        
        if (videoWidth > 0 && videoHeight > 0) {
            // Mark as video state
            videoContainer.classList.add('has-video');
            videoContainer.classList.remove('no-video');
            videoSection.classList.add('video-loaded');
            
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
            
            console.log(`Containers adjusted: ${availableWidth}x${newHeight}, aspect ratio: ${videoAspectRatio}`);
        } else {
            // Default state when no video
            videoContainer.classList.add('no-video');
            videoContainer.classList.remove('has-video');
            videoSection.classList.remove('video-loaded');
        }
    } catch (error) {
        console.error('Error adjusting video container:', error);
    }
}

// Update play/pause button state
function updatePlayPauseButtonState() {
    const playPauseBtn = document.getElementById('play_pause');
    if (!playPauseBtn || !player) return;
    
    try {
        if (player.paused()) {
            playPauseBtn.textContent = 'Play';
            playPauseBtn.classList.remove('btn-pause');
            playPauseBtn.classList.add('btn-play');
        } else {
            playPauseBtn.textContent = 'Pause';
            playPauseBtn.classList.remove('btn-play');
            playPauseBtn.classList.add('btn-pause');
        }
    } catch (error) {
        console.error('Error updating play/pause button state:', error);
    }
}

let selectedGridColor = 'rgba(255, 255, 0, 0.5)';
function clickEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if(!flagAnnotate) return;                       // if the user is not allowed to annotate, return
    
    const playerElement = videojs('video_player');
    const videoElem = playerElement.el().querySelector('video');
    if (!videoElem) return;
    
    const rect = videoElem.getBoundingClientRect();
    const m = M;
    const n = N;
    const mouse_x = event.clientX - rect.left;
    const mouse_y = event.clientY - rect.top;

    if(mouse_x >= 0 && mouse_x <= rect.width && mouse_y >= 0 && mouse_y <= rect.height)
    {
        const a = Math.floor(mouse_x / (rect.width / m));
        const b = Math.floor(mouse_y / (rect.height / n));

        const x1 = a * (rect.width / m) + 1;
        const y1 = b * (rect.height / n) + 1;
        const w = rect.width / m - 2;
        const h = rect.height / n - 2;

        Current_grid = {x1, y1, w, h, a, b};

        // show the hidden menu
        const contextMenu = document.getElementById('context_menu');
        contextMenu.style.display = "inline";
        contextMenu.style.left = event.clientX + "px";
        contextMenu.style.top = event.clientY + "px";
        contextMenu.style.zIndex = "1000";
        Is_context_menu_just_shown = true;
        setTimeout(() => {Is_context_menu_just_shown = false;}, 100);
    }
}

function submitOneFrameAnnotation(Annotations, Current_cropped_image, Current_frame_data){
    const form = document.getElementById('annotation_form');
    const input = document.getElementById('annotation_data');

    // 从GridMatrix提取有效标注
    const validAnnotations = [];
    const validCroppedImages = [];
    const canvas = document.getElementById("grid_overlay");
    
    for(let i = 0; i < M; i++) {
        for(let j = 0; j < N; j++) {
            if(GridMatrix[i][j].stainLevel > 0) {
                // 计算网格位置

                
                const cellX = (canvas.width / M) * i;
                const cellY = (canvas.height / N) * j;
                const cellWidth = canvas.width / M;
                const cellHeight = canvas.height / N;
                
                // 创建annotation对象
                const annotation = {
                    startX: cellX,
                    startY: cellY,
                    width: cellWidth,
                    height: cellHeight,
                    m: M,
                    n: N,
                    stainLevel: GridMatrix[i][j].stainLevel
                };
                
                validAnnotations.push(annotation);
                
                // 截取对应区域图像
                const cropped_img = cropGridInImage(
                    Current_frame_data, 
                    {x1: cellX, y1: cellY, w: cellWidth, h: cellHeight}
                );
                validCroppedImages.push(cropped_img);
            }
        }
    }

    // transfer the annotation to JSON format
    input.value = JSON.stringify({
        cropped: validCroppedImages,
        frame: Current_frame_data,
        annotations: validAnnotations
    });

    // Use fetch API to submit form asynchronously
    fetch(form.action, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: input.value
    })
    .then(response => response.json())
    .then(data => {
        console.log("Success:", data);
        Annotations = [];
        Current_cropped_image = [];
        Current_frame_data = null;
        GridMatrix = [];
    })
    .catch(error => {
        console.error("Error:", error);
    });
}

// capture the current frame
function captureCurrentFrame()
{
    const playerElement = videojs('video_player');
    const videoElem = playerElement.el().querySelector('video');
    const canvas = document.createElement('canvas');
    const rect = videoElem.getBoundingClientRect();
    const ctx = canvas.getContext('2d');

    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);

    const frameDataUrl = canvas.toDataURL('image/png');

    return frameDataUrl;
}

// crop the current frame according to the current grid
function cropGridInImage(base64Image, grid)
{
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = base64Image;

    canvas.width = grid.w;
    canvas.height = grid.h;
    ctx.drawImage(img, grid.x1, grid.y1, grid.w, grid.h);
    const croppedImageDataUrl = canvas.toDataURL('image/png');
    return croppedImageDataUrl;
}

function updateGrid(grid, level)
{
    // update the grid
    for(let i = 0; i < GridMatrix.length; i++)
    {
        if(i === grid.a)
        {
            for (let j = 0; j < GridMatrix[i].length; j++)
            {
                if(j === grid.b)
                {
                    GridMatrix[i][j].stainLevel = level;
                    break;
                }
            }
        }
    }
}

// change the color of grid
function choose_color(e)
{
    const playerElement = videojs('video_player');
    const videoElem = playerElement.el().querySelector('video');
    if (!videoElem) return;
    
    const rect = videoElem.getBoundingClientRect();
    const canvas = document.getElementById("grid_overlay");
    
    // Update canvas position to match video element
    canvas.style.position = 'absolute';
    canvas.style.top = rect.top + 'px';
    canvas.style.left = rect.left + 'px';
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.zIndex = '2';

    // Handle parent container offset
    const parent = videoElem.offsetParent;
    if (parent) {
        const parentRect = parent.getBoundingClientRect();
        canvas.style.top = (rect.top - parentRect.top) + 'px';
        canvas.style.left = (rect.left - parentRect.left) + 'px';
    }

    const ctx = canvas.getContext("2d");
    if(e.target.tagName === "A"){
        e.preventDefault();
        let color;
        let stain_level;
        switch(e.target.getAttribute("data-color")) {
            case "white":
                color = "rgba(255, 255, 255, 0.5)";
                stain_level = 0;
                break;
            case "red":
                color = "rgba(255, 0, 0, 0.5)";
                stain_level = 4;
                break;
            case "green":
                color = "rgba(0, 255, 0, 0.5)";
                stain_level = 1;
                break;
            case "blue":
                color = "rgba(0, 0, 255, 0.5)";
                stain_level = 3;
                break;
            case "yellow":
                color = "rgba(255, 255, 0, 0.5)";
                stain_level = 2;
                break;
            case "_cancel_":
                const contextMenu = document.getElementById('context_menu');
                contextMenu.style.display = "none";
                Current_grid = null;
                break;
            case "_clear_":
                if (Current_grid) {
                    ctx.clearRect(Current_grid.x1, Current_grid.y1, Current_grid.w, Current_grid.h);
                    updateGrid(Current_grid, 0);
                }
                const clearMenu = document.getElementById('context_menu');
                clearMenu.style.display = "none";
                return true;
                break;
            default:
                color = "rgba(255, 255, 255, 0.5)";
                stain_level = 0;
        }

        if (Current_grid) {
            updateGrid(Current_grid, stain_level);
            const {x1, y1, w, h, a, b} = Current_grid;

            // Clear canvas and redraw all annotations
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            redrawGrids(canvas, ctx);
            
            // Redraw grid lines
            ctx.strokeStyle = 'rgb(255, 0, 0)';
            ctx.lineWidth = 1;
            
            // Redraw vertical lines
            for(let i = 1; i < M; i++) {
                const x = (canvas.width / M) * i;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            
            // Redraw horizontal lines
            for(let i = 1; i < N; i++) {
                const y = (canvas.height / N) * i;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            document.getElementById('status').innerText = "Annotation Position" + " " + "/" + x1 + " " + y1 + " " + "Stain Level" + " " + stain_level;

            // const annotation = {
            //     startX: x1,
            //     startY: y1,
            //     width: w,
            //     height: h,
            //     m: M,
            //     n: N,
            //     stainLevel: stain_level,
            // };
            // Annotations.push(annotation);
            // let cropped_img = cropGridInImage(Current_frame_data, Current_grid);
            // Current_cropped_image.push(cropped_img);

            const contextMenu = document.getElementById('context_menu');
            contextMenu.style.display = "none";
        }
    }
}

function generateJSON(){
    // ask the server to generate the JSON file
    fetch('/generate_json', {
        method: 'POST',
        body: JSON.stringify({
            'Give me the JSON file': 'If you want it, then you will have to take it'
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        window.alert("Generated JSON file on server!");
    })
    .then(data => {
        console.log(data);
    })
    .catch(error => {
        console.error(error);
    });
}

function PlayerPaused()
{
    const playerElement = videojs('video_player');
    if (playerElement.paused()){
        console.log("Player is paused.");

        // allow user to annotate
        flagAnnotate = true;
        document.getElementById('upload_annotation').style.display = "inline";
        Current_frame_data = captureCurrentFrame();
        updatePlayPauseButtonState();
        
        // Reinitialize grid when paused
        setTimeout(() => {
            GridMatrix = [];
            initGrid(M, N);
        }, 50);
    }
}

function PlayerPlaying()
{
    const playerElement = videojs('video_player');
    if (!playerElement.paused()){
        console.log("Player is playing.");
        flagAnnotate = false;
        document.getElementById('upload_annotation').style.display = "none";
        updatePlayPauseButtonState();
        
        // Clear annotations data when playing
        Annotations = [];
        Current_cropped_image = [];
        Current_frame_data = null;
        GridMatrix = [];  // Reset GridMatrix
    }
}

function togglePlayPause()
{
    const playerElement = videojs('video_player');
    if (playerElement) {
        if (playerElement.paused())
        {
            playerElement.play();
        }
        else
        {
            playerElement.pause();
        }
        updatePlayPauseButtonState();
    }
}

function handleVideoUpload(file) {
    if (!file) return;
    
    try {
        const videoURL = URL.createObjectURL(file);
        
        // Set video source
        player.src({
            type: file.type,
            src: videoURL
        });
        
        // Reload and play
        player.load();
        player.play();
        
        console.log('Video uploaded successfully');
        document.getElementById('status').innerText = 'Video uploaded and loading...';
        
    } catch (error) {
        console.error('Error uploading video:', error);
        document.getElementById('status').innerText = 'Error uploading video';
    }
}

document.addEventListener("DOMContentLoaded", function() // Used DOMContentLoaded to secure the listen functions are binded after the DOM loaded
{
    const contextMenu = document.getElementById('context_menu');
    const fileInput = document.getElementById("video_file_input");
    const annotateUpload = document.getElementById("upload_annotation");
    const generateJSONBtn = document.getElementById("generateJSON");
    const playPauseBtn = document.getElementById('play_pause');
    const videoContainer = document.querySelector('.video_container');
    const canvas = document.getElementById("grid_overlay");
    // Initialize video player
    initVideoPlayer();

    contextMenu.addEventListener("click", choose_color);

    // Video container click event for annotations
    videoContainer.addEventListener('click', function (event) {
        // Only trigger if we're clicking directly on the video element
        const playerElement = videojs('video_player');
        const videoElem = playerElement.el().querySelector('video');
        
        if (videoElem && (event.target === videoElem || event.target === videoContainer || event.target === canvas)) {
            clickEvent(event);
        }
    });

    // Click outside to hide the context menu
    document.addEventListener('click', function (event){
        if(Is_context_menu_just_shown) {
            Is_context_menu_just_shown = false;
            return;
        }

        const isClickInsideMenu = contextMenu.contains(event.target);
        if(!isClickInsideMenu && contextMenu.style.display !== 'none')
        {
            contextMenu.style.display = 'none';
        }
    });

    // File input change handler
    fileInput.addEventListener("change", function(event) {
        const file = event.target.files[0];
        if (file) {
            handleVideoUpload(file);
        }
    });

    // Drag and drop handling
    videoContainer.addEventListener("dragover", function(event) {
        event.preventDefault();
        videoContainer.classList.add('drag-over');
    });

    videoContainer.addEventListener("dragleave", function() {
        videoContainer.classList.remove('drag-over');
    });

    videoContainer.addEventListener("drop", function(event) {
        event.preventDefault();
        videoContainer.classList.remove('drag-over');
        
        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith("video/")) {
            handleVideoUpload(file);
        }
    });

    document.getElementById("upload_button").addEventListener("click", () => {
        document.getElementById("video_file_input").click();
    });

    annotateUpload.addEventListener("click", () => {
        submitOneFrameAnnotation(Annotations, Current_cropped_image, Current_frame_data);
        Annotations = [];
        Current_cropped_image = [];
        Current_frame_data = null;
        document.getElementById('upload_annotation').style.display = "none";
    });

    generateJSONBtn.addEventListener("click", () => {
        generateJSON();
    });

    playPauseBtn.addEventListener('click', togglePlayPause);
    
    // Control by Space key
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            togglePlayPause();
        }
    });

    // Jump buttons
    document.getElementById('jump_to_robot_image').addEventListener('click', () => {
        window.location.href = '/to_robot_image';
    });

    document.getElementById('jump_to_robot_video').addEventListener('click', () => {
        window.location.href = '/to_robot_video';
    });

    // Window resize handler
    window.addEventListener('resize', function() {
        if (player && player.videoWidth() > 0) {
            setTimeout(() => {
                initGrid(M, N);
            }, 100);
        }
    });
});


