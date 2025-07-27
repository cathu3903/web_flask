# web_flask to control robot arm in Visual Components
This is a demonstration of how to control a robot arm using a web interface. 

## Installation
To ensure the successful and smooth running on another windows PC, the setup of python environment is  indispensable. Now there're two way to build the same conda virtual environment :
1. The conda dependency file on YAML format
2. The complete copy of conda environment.
The second one is quite simple but time-exhausting and requires good network environment and enough disk space. The first one is more practical compared with the second one.

### Step 1: Install 3 software:
1. [Anaconda](https://www.anaconda.com/docs/getting-started/getting-started) / [Miniconda](https://www.anaconda.com/docs/getting-started/miniconda/install), to create and manage the python environment
2. [CUDA](https://developer.nvidia.com/cuda-downloads) (optional but recommanded), to run the inference of YOLO model by GPU. The ultralytics package will switch to CPU when CUDA is not available.
3. [Git](https://git-scm.com/downloads/win), to copy from the server and manage the update of the project code
These 3 softwares are recommanded to registered as system environment variable. The following steps are based on that. 

### Step 2: Clone the project code on Github. 
Open git bash or cmd / powershell and change to the directory you want to place the project
```cmd
> git clone https://github.com/cathu3903/web_flask.git web_flask
> cd web_flask
```

Then create a new conda environment by the dependency attached in the project
```cmd
web_flask> conda create -n env_name -f web_flask_conda_env.yaml python=3.11.11
web_flask> activate env_name
```


Or to install the dependency in an existing environment(the python version is better to be 3.11.11)
```cmd
web_flask> activate env_name
(env_name)web_flask> conda env update -n env_name -f web_flask_conda.yaml
```

### Step 3 Start Flask and OPC-UA server
run the code
If everything goes well, you can start the porgram:
```cmd      
(env_name)web_flask> python app.py

```

## Usage

### Video-operated interface
There are two windows :
1. video window
2. Recognition image window

The first is to upload the video from the browser, the video will start to play automatically. When video is paused, the AI recognition button is unlocked to send the current screenshot to the server for recognition. The model file for the recogniton is trained and attached in the project code. 

Once the image recognition is finished, the image will appear in the window below. The grids will be plotted if there's anything detected. The corresponding rectangles are also plotted automatically on the grids, according to the center point of the bbox.

The robot in VC is controlled by the Execute button. Click the button to execute the gird coordinate on the image.
