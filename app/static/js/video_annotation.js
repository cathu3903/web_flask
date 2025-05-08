let annotations = [];
const videoElem = document.getElementById("video_player");
let currentGrid = null;


function initGrid(m , n)
{
    var canvas = document.getElementById('grid_overlay');

    var videoRect = videoElem.getBoundingClientRect();  // get the video element's bounding rectangle
    canvas.width = videoElem.width;
    canvas.height = videoElem.height;

    var ctx = canvas.getContext('2d');  // get the canvas context
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
    const rect = videoElem.getBoundingClientRect(); // get the video element's bouding rectangle
    const m = M;
    const n = N;
    const mouse_x = event.clientX - rect.left;  // get the mouse position relative to the video element
    const mouse_y = event.clientY - rect.top;   // same for y

    if(mouse_x >= 0 && mouse_x <= rect.width && mouse_y >= 0 && mouse_y <= rect.height)
    {
        // event.preventDefault();     // prevent the default action (click)

        const x = Math.floor(mouse_x / (rect.width / m));     // get the x and y coordinates of the mouse in grids
        const y = Math.floor(mouse_y / (rect.height / n));

        currentGrid = {x, y, m, n};

        // show the hidden menu
        const contextMenu = document.getElementById('context_menu');
        contextMenu.style.display = "inline";
        contextMenu.style.left = event.clientX + "px";
        contextMenu.style.top = event.clientY + "px";

        // stop
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

    if(e.target.tagName === "A"){
        e.preventDefault();
        let color;
        let stain_level;
        switch(e.target.getAttribute("data-color")) {
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
            default:
                color = "rgba(255, 255, 0, 0.5)";
                stain_level = 2;
        }
        const canvas = document.getElementById("grid_overlay");
        const ctx = canvas.getContext("2d");

        if (currentGrid) {
            const rect = videoElem.getBoundingClientRect(); // get the video element's bouding rectangle
            const {x, y, m, n} = currentGrid;

            ctx.fillStyle = color;
            ctx.fillRect(x * (rect.width / m) + 1, y * (rect.height / n) + 1, rect.width / m - 2, rect.height / n - 2);

            // Clear the rectangle after a delay of 2s
            setTimeout(() => {
                ctx.clearRect(x * (rect.width / m) + 1, y * (rect.height / n) + 1, rect.width / m - 2, rect.height / n - 2);
            }, 2000);
            document.getElementById('status').innerText = "Annotation Position" + " " + "/" + x + " " + y + " " + "Stain Level" + " " + stain_level;

            const annotation = {
                centerX: x * (rect.width / m) + (rect.width / m) / 2,
                centerY: y * (rect.width / n) + (rect.height / n) / 2,
                width: rect.width / m,
                height: rect.height / n,
                m: m,
                n: n,
                stainLevel: stain_level
            };
            annotations.push(annotation);
            submitAnnotation(annotation);

            this.style.display = "none";

            // Stopped in 4.29 afternoon
            // description: send the annotation to the server, the server creates a log in the database, and process the image, and return the annotation id
            // var xhr = new XMLHttpRequest();
            // xhr.open("POST", "/new_annotation", true);
            // xhr.setRequestHeader("Content-Type", "application/")
        }

    }
}

document.getElementById("context_menu").addEventListener("click", change_color);

document.getElementById('video_container').addEventListener('click', click_event);

document.addEventListener("DOMContentLoaded", function() {
    videoElem.onload = function() {     // once the video stream is loaded
        initGrid(M, N);                 // initialize the grid
    };
});

// document.addEventListener('DOMContentLoaded', (e) =>{
//     const dropdownButton = document.getElementById('dropdownButton');
//     const  dropdownMenu = document.getElementById('dropdownMenu');

//     dropdownButton.addEventListener('click', ()=>{
//         // change the visibility of the dropdown menu
//         dropdownMenu.style.display = (dropdownMenu.style.display === 'block' ? 'none' : 'block');
//     });

    // hide the dropdown menu when the user clicks outside of it
//     window.addEventListener('click', (e)=>{
//         if(!dropdownButton.contains(e.target) && !dropdownMenu.contains(e.target)){
//             dropdownMenu.style.display = 'none';
//         }
//     });
// });
