let annotations = [];

let currentGrid = null;
let isContextMenuJustShown = false;


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
function click_event(event) {
    // const videoElem = document.getElementById("video_player");
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

        // currentGrid = {x, y, m, n};
        const x1 = x * (rect.width / m) + 1;
        const y1 = y * (rect.height / n) + 1;
        const w = rect.width / m - 2;
        const h = rect.height / n - 2;

        currentGrid = {x1, y1, w, h};

        // show the hidden menu
        const contextMenu = document.getElementById('context_menu');
        contextMenu.style.display = "inline";
        contextMenu.style.left = event.clientX + "px";
        contextMenu.style.top = event.clientY + "px";
        isContextMenuJustShown = true;
        setTimeout(() => {isContextMenuJustShown = false;}, 100);

        window.addEventListener("contextmenu", function (e) {
            e.preventDefault();
        });

    }
}

function submitAnnotation(annotation){
    const form = document.getElementById('annotation_form');
    const input = document.getElementById('annotation_data');

    // transfer the annotation to JSON format
    input.value = JSON.stringify(annotation);

    // Use fetch API to submit form asynchronously
    fetch(form.action, {
        method: 'POST',
        body: new FormData(form)
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
    })
    .catch(error => {
        console.error(error);
    });

}

// change the color of grid
function change_color(e)
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

        if (currentGrid) {
            const rect = videoElem.getBoundingClientRect(); // get the video element's bouding rectangle
            const {x1, y1, w, h} = currentGrid;

            ctx.fillStyle = color;
            ctx.fillRect(x1, y1, w, h);

            // Clear the rectangle after a delay of 2s
            setTimeout(() => {
                ctx.clearRect(x1, y1, w, h);
            }, 2000);
            document.getElementById('status').innerText = "Annotation Position" + " " + "/" + x1 + " " + y1 + " " + "Stain Level" + " " + stain_level;

            const annotation = {
                startX: x1,
                startY: y1,
                width: w,
                height: h,
                m: M,
                n: N,
                stainLevel: stain_level
            };
            // annotations.push(annotation);
            submitAnnotation(annotation);

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


document.addEventListener("DOMContentLoaded", function() // Used DOMContentLoaded to secure the listen functions are binded after the DOM loaded
{
    const contextMenu = document.getElementById('context_menu');
    const container = document.getElementById('video_container');
    const fileInput = document.getElementById("video_file_input");
    // const videoElem = document.getElementById("video_player");
    const player = videojs('video_player');
    const videoElem = player.el();


    // Click outside to hide the window
    document.addEventListener('click', function (event){
        if(isContextMenuJustShown) {
            isContextMenuJustShown = false;
            return;
        }

        const isClickInsideMenu = contextMenu.contains(event.target);
        if(!isClickInsideMenu && contextMenu.style.display !== 'none')
        {
            contextMenu.style.display = 'none';
        }
    });

    // videoElem.onload = function() {     // once the video stream is loaded
    //     initGrid(M, N);                 // initialize the grid
    // };

    contextMenu.addEventListener("click", change_color);

    document.getElementById('video_container').addEventListener('click', click_event);

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

    // playPauseBtn.addEventListener("click", () =>{
    //     if(videoElem.paused){
    //         videoElem.play();
    //         playPauseBtn.textContent = "Play";  // change the button text to Play when paused
    //     }else{
    //         videoElem.pause();
    //         playPauseBtn.textContent = "Pause"; // change the button text to Pause when playing
    //     }
    // });

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

    document.addEventListener("dragover", function(event) {
        event.preventDefault();
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

});


