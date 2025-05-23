let Annotations = [];

let Current_grid = null;
let Is_context_menu_just_shown = false;
let flagAnnotate = false;      // flag of whether the user is allowed to annotate
let Current_frame_data = null;
let Current_cropped_image = [];


function initGrid(m , n)
{
    var canvas = document.getElementById('grid_overlay');
    // const videoElem = document.getElementById("video_player");
    var ctx = canvas.getContext('2d');  // get the canvas context
    const player = videojs('video_player');
    const videoElem = player.el();

    const rect = videoElem.getBoundingClientRect();  // get the video element's bounding rectangle

    canvas.width = rect.width;
    canvas.height = rect.height;
    // canvas.width = videoElem.videoWidth();
    // canvas.height = videoElem.videoHeight();

    ctx.clearRect(0, 0,canvas.width, canvas.height);
    ctx.strokeStyle = 'rgb(255, 0, 0)';   // set the color of the grids

    for(let i = 1; i < m; i++)          // draw the vertical lines
    {
        const x = (canvas.width / m) * i;   // calculate the horizontal position of the line
        ctx.beginPath();                // Create a new path
        ctx.moveTo(x, 0);               // Begin from the top
        ctx.lineTo(x, canvas.height);   // To the other side of the video window
        ctx.stroke();                   // Draw the line
    }

    for(let i = 1; i < n; i++)
    {
        const y = (canvas.height / n) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

let selectedGridColor = 'rgba(255, 255, 0, 0.5)';
function clickEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    // const videoElem = document.getElementById("video_player");
    if(!flagAnnotate) return;                       // if the user is not allowed to annotate, return
    const player = videojs('video_player');
    const videoElem = player.el();
    const rect = videoElem.getBoundingClientRect(); // get the video element's bouding rectangle
    const m = M;
    const n = N;
    const mouse_x = event.clientX - rect.left;  // get the mouse position relative to the video element
    const mouse_y = event.clientY - rect.top;   // same for y

    event.stopPropagation();

    if(mouse_x >= 0 && mouse_x <= rect.width && mouse_y >= 0 && mouse_y <= rect.height)
    {
        // event.preventDefault();     // prevent the default action (click)

        const x = Math.floor(mouse_x / (rect.width / m));     // get the x and y coordinates of the mouse in grids
        const y = Math.floor(mouse_y / (rect.height / n));

        // Current_grid = {x, y, m, n};
        const x1 = x * (rect.width / m) + 1;
        const y1 = y * (rect.height / n) + 1;
        const w = rect.width / m - 2;
        const h = rect.height / n - 2;

        Current_grid = {x1, y1, w, h};

        // show the hidden menu
        const contextMenu = document.getElementById('context_menu');
        contextMenu.style.display = "inline";
        contextMenu.style.left = event.clientX + "px";
        contextMenu.style.top = event.clientY + "px";
        Is_context_menu_just_shown = true;
        setTimeout(() => {Is_context_menu_just_shown = false;}, 100);

        window.addEventListener("contextmenu", function (e) {
            e.preventDefault();
        });

    }
}

function submitOneFrameAnnotation(Annotations, Current_cropped_image, Current_frame_data){
    const form = document.getElementById('annotation_form');
    const input = document.getElementById('annotation_data');

    // transfer the annotation to JSON format
    input.value = JSON.stringify({
        cropped: Current_cropped_image,
        frame: Current_frame_data,
        annotations: Annotations
    });

    // Use fetch API to submit form asynchronously
    fetch(form.action, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: input.value   // should use stringify()  to convert JSON to string
    })
    .then(response => response.json())
    .then(data => {
        console.log("Success:", data);
    })
    .catch(error => {
        console.error("Error:", error);
    });

}

// capture the current frame
function captureCurrentFrame()
{
    const player = videojs('video_player');
    const videoElem = player.el().querySelector('video');
    const canvas = document.createElement('canvas');
    const rect = videoElem.getBoundingClientRect();  // get the video element's bounding rectangle
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

// change the color of grid
function choose_color(e)
{
    const player = videojs('video_player');
    const videoElem = player.el();
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
                this.style.display = "none";
                return true;
            default:
                color = "rgba(255, 255, 255, 0.5)";
                stain_level = 0;
        }
        const canvas = document.getElementById("grid_overlay");
        const ctx = canvas.getContext("2d");

        if (Current_grid) {
            const rect = videoElem.getBoundingClientRect(); // get the video element's bouding rectangle
            const {x1, y1, w, h} = Current_grid;

            ctx.fillStyle = color;
            ctx.fillRect(x1, y1, w, h);

            // 5.23: Stop Clearing the rectangle after a delay, the rectangle will be cleared after play button is clicked
            // // Clear the rectangle after a delay of 2s
            // setTimeout(() => {
            //     ctx.clearRect(x1, y1, w, h);
            // }, 2000);

            // 5.20: new idea
            // instead of remove the annotation on the canvas layer, the color will disappear when play the video again
            document.getElementById('status').innerText = "Annotation Position" + " " + "/" + x1 + " " + y1 + " " + "Stain Level" + " " + stain_level;

            const annotation = {
                startX: x1,
                startY: y1,
                width: w,
                height: h,
                m: M,
                n: N,
                stainLevel: stain_level,
            };
            Annotations.push(annotation);
            // submitAnnotation(annotation);
            let cropped_img = cropGridInImage(Current_frame_data, Current_grid);
            Current_cropped_image.push(cropped_img);

            this.style.display = "none";
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
    })
}

// function play_pause(){
//     const playPauseBtn = document.getElementById('play_pause');
//     if(videoElem.playing === "true"){
//         fetch('/play_pause', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             }
//         })
//         .then(response => response.json())
//         .then(data => {
//             console.log(data);
//             if (data.paused) {
//                 playPauseBtn.innerHTML = "Play";    // change the button text to Pause when playing
//             } else {
//                 playPauseBtn.innerHTML = "Pause";   // change the button text to Play when paused
//             }
//         })
//         .catch(error => {
//             console.error(error);
//         });
//     }
// }

function PlayerPaused()
{
    const player = videojs('video_player');
    if (player.pause){
        console.log("Player is paused.");

        // allow user to annotate
        flagAnnotate = true;
        document.getElementById('upload_annotation').style.display = "inline";
        Current_frame_data = captureCurrentFrame();
    }
}

function PlayerPlaying()
{
    const player = videojs('video_player');
    if (player.play){
        console.log("Player is playing.");
        flagAnnotate = false;
        document.getElementById('upload_annotation').style.display = "none";
    }
}

function togglePlayPause()
{
    const player = videojs('video_player');
    if (player) {
        if (player.paused())
        {
            player.play();
            initGrid(M, N);
        }
        else
        {
            player.pause();
        }
    }
}


document.addEventListener("DOMContentLoaded", function() // Used DOMContentLoaded to secure the listen functions are binded after the DOM loaded
{
    const contextMenu = document.getElementById('context_menu');
    const container = document.getElementById('video_container');
    const fileInput = document.getElementById("video_file_input");
    // const videoElem = document.getElementById("video_player");
    const player = videojs('video_player');
    const videoElem = player.el();
    const annotateUpload = document.getElementById("upload_annotation");
    const generateJSONBtn = document.getElementById("generateJSON");
    const playPauseBtn = document.getElementById('play_pause');
    // const tooltip = document.getElementById('progress_tooltip');

    // const progressControl = player.contorlBar.progressControl;


    player.on('pause', PlayerPaused);
    player.on('play', PlayerPlaying);

    contextMenu.addEventListener("click", choose_color);

    document.getElementById('video_container').addEventListener('click', clickEvent);

    document.addEventListener("dragover", function(event) {
        event.preventDefault();
    });

    // Click outside to hide the window
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

    // add a listener to adjust the overlay of the button below the video window
    videoElem.addEventListener("loadedmetadata", () =>{
        console.log("Video metadata loaded.");
        console.log("videoWidth:", player.videoWidth);
        console.log("videoHeight:", player.videoHeight);
        container.style.height = `${player.el().offsetHeight}px`;     // get the html element of the video by template literals
        initGrid(M, N);
    });

    // change the grid size when the window is resized
    window.addEventListener("resize", () =>{
        if( player.videoWidth() > 0){
            container.style.height = `${player.el().offsetHeight}px`;
            initGrid(M, N);
        }
    });

    fileInput.addEventListener("change", function(event) {
        const file = event.target.files[0];
        if (file) {
            const videoURL = URL.createObjectURL(file);
            player.src({type: 'video/mp4', src: videoURL});
            player.load();
            player.play();
            // videoElem.src = videoURL;
            // videoElem.load();
            // videoElem.play();
            player.on('canplay', () => {
                initGrid(M, N);
            });
        }
    });

    // Drag the video above the window
    document.addEventListener("drop", function(event) {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith("video/")) {
            const videoURL = URL.createObjectURL(file);
            // videoElem.src = videoURL;
            // videoElem.load();
            // videoElem.play();
            player.src({type: 'video/mp4', src: videoURL});
            player.load();
            player.play();

            videoElem.addEventListener("canplay", () => {
                initGrid(M, N);
            });
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

    // bind click event on play_pause button
    player.on('play', function() {
        playPauseBtn.textContent = "Pause";
    });
    player.on('pause', () => {
        playPauseBtn.textContent = "Play";
    });

    playPauseBtn.addEventListener('click', togglePlayPause);
    // control by Space
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            togglePlayPause();
        }
    });

    // if(progressControl)
    // {
    //     const seekBar = progressControl.seekBar;

    //     // display the time when mouse over the seek bar
    //     seekBar.addEventListener('mousemove', (e) => {
    //         const duration = player.duration();
    //         if (!duration || isNaN(duration)) return;

    //         const rect = seekBar.el_.getBoundingClientRect();
    //         const percent = (e.clientX - rect.left) / rect.width;
    //         const time = duration * percent;

    //         tooltip.textContent = formatTime(time);
    //         tooltip.style.left = `${e.clientX + 10}px`;
    //         tooltip.style.top = `${rect.top - 30}px`;
    //         tooltip.style.opacity = 1;
    //     });

    //     // hide the time when mouse leave the seek bar
    //     seekBar.addEventListener('mouseleave', () => {
    //         tooltip.style.opacity = 0;
    //     });
    // }

    // // format time
    // function formatTime(seconds) {
    //     const min = Math.floor(seconds / 60);
    //     const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
    //     return `${min}:${sec}`;
    // }

});


