from flask import Flask, render_template, request, redirect, send_from_directory, Response, jsonify, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
# from uaserver import server_minimal
from uaserver import server_synch
import time
import cv2
import os
import threading
import json
import base64
import traceback
import numpy as np
from queue import Queue, Empty
from datetime import datetime
from ultralytics import YOLO
from PIL import Image
import io
import logging

# uaclient -- for the opc ua client connection
from uaserver.uaclient import UAClient

app = Flask(__name__, template_folder='app/templates', static_folder='app/static', instance_path='C:/DDD/UIT_PROJECT/web_flask/data')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///annotations.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
ORIGINAL_SAVE_FOLDER = 'original_'
CROPPED_SAVE_FOLDER = 'cropped_'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app.config['YOLO_MODEL_PATH'] = 'yolo_trained_model/best_v11_25_7_17.pt'
app.config['INFERENCE_IMAGE_SIZE'] = int(640)
app.config['CONF_THRESHOLD'] = float(0.5)


M = 10
N = 10

app.config['DATA_FOLDER'] = 'data'
# make sure the data folder exists
os.makedirs(app.config['DATA_FOLDER'], exist_ok=True)

robot_task_queue = Queue(maxsize=3)
ua_client = None

class VideoCamera(object):
    current_raw_frame = None      # recording the current frame, for the image processing
    current_encoded_frame = None    # For the stream transmission

    def __init__(self):
        self.video = cv2.VideoCapture(0)    # read from the camera stream
        # self.video = cv2.VideoCapture('app/static/video/sample_2.mp4')  # read from the video file

    def __del__(self):
        self.video.release()

    def get_frame(self):
        (self.grabbed, self.frame) = self.video.read()
        if self.grabbed:
            VideoCamera.current_raw_frame = self.frame.copy()
            image = self.frame
            # cv2.putText(image, "video", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0))
            ret, jpg = cv2.imencode('.jpg', image)
            if ret:
                VideoCamera.current_encoded_frame = jpg
            return jpg.tobytes()
        else:
            return b'No frame'

class Annotations(db.Model):
    id = db.Column('annotation_id', db.Integer, primary_key = True)
    x = db.Column('startX', db.Integer)
    y = db.Column('startY', db.Integer)
    w = db.Column('width', db.Integer)
    h = db.Column('height', db.Integer)
    m = db.Column('m_horizontal_grid', db.Integer)
    n = db.Column('n_vertical_grid', db.Integer)
    lv = db.Column('stain_level', db.Integer)
    # img_cropped = db.Column('croppoed_image', db.LargeBinary)
    img_cropped_path = db.Column('cropped_image_path', db.String(100))
    frame_id = db.Column(db.INTEGER, db.ForeignKey('frames.id'))
    frame = db.relationship("Frames", backref=db.backref('annotations', lazy = True))

class Frames(db.Model):
    id = db.Column('id', db.Integer, primary_key = True)
    img_original = db.Column('original_image', db.LargeBinary)    # Save the relative image path
    img_original_path = db.Column('original_image_path', db.String(100))

@app.route('/new_annotation', methods = ['POST'])
def new_annotation():
    data = request.get_json()
    if not data:
        return jsonify({ "success": False, "error": "No JSON data received"} ), 400

    frame_data = data.get('frame')
    annotations = data.get('annotations', [])
    cropped_list = data.get('cropped', [])
    print("frame_data type:", type(frame_data))
    print("cropped_data type:" + str(type(cropped_list)) + "\nlength:" + str(len(cropped_list)))
    if not isinstance(frame_data, str):
        return jsonify({"error": "frame data must be a base64 string"}), 400

    if not frame_data or not annotations:
        return jsonify(success = False)

    try:
        # resolve and save the frame data
        if ',' in frame_data:
            _, encoded = frame_data.split(',', 1)
        else:
            encoded = frame_data
        frame_binary = base64.b64decode(encoded)

        # generate unique file name

        timestamp = time.time()
        datetime_obj = datetime.fromtimestamp(timestamp)
        formatted_time = datetime_obj.strftime("%Y_%m_%d-%H_%M_%S")
        frame_filename = f"original_{formatted_time}"

        # create the Frames object
        frame_record = Frames(img_original = frame_binary, img_original_path = frame_filename)
        db.session.add(frame_record)
        db.session.commit()

        # save each annotation data and cropped images
        for idx, annotation in enumerate(annotations):
            if idx >= len(cropped_list):
                # if the index is out of range, then the cropped image is None
                cropped_binary = None
                cropped_filename = None
            else:
                cropped_filename = f"cropped_{formatted_time}_{idx}"
                cropped_path = os.path.join(app.config['DATA_FOLDER'], 'cropped', cropped_filename)

            annotation_record = Annotations(
                x = annotation['startX'],
                y = annotation['startY'],
                w = annotation['width'],
                h = annotation['height'],
                m = annotation['m'],
                n = annotation['n'],
                lv = annotation['stainLevel'],
                img_cropped_path = cropped_filename,
                frame_id = frame_record.id,     # link to the Frames object
            )
            db.session.add(annotation_record)

        db.session.commit()
        return jsonify(success = True)

    except Exception as e:
        print(f"Error saving annotation data: {e}")
        traceback.print_exc()
        return jsonify(success = False)

@app.route('/')
def index():
    m = M
    n = N
    return render_template('video_annotation.html', m = m, n = n)

@app.route('/video_annotation')
def video():
    m = M
    n = N
    return render_template('video_cannotation.html', m = m, n = n)

def gen(camera):
    while True:
        start_t = time.time()
        frame = camera.get_frame()
        # use the generator function to output the frame, each output request  will output one frame of image/jpeg
        yield(b'--frame\r\n'
              b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video_feed')   # return video stream response
def video_feed():
    return Response(gen(VideoCamera()), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/cropped/<int:id>')
def serve_image_cropped(id):
    annotation = Annotations.query.get(id)
    cropped_image_name = annotation.img_s_name
    return send_from_directory(os.path.join(app.instance_path, CROPPED_SAVE_FOLDER), cropped_image_name)

@app.route('/original/<int:id>')
def serve_image_original(filename):
    annotation = Annotations.query.get(id)
    original_image_path = annotation.img_l_name
    return send_from_directory(os.path.join(app.instance_path, ORIGINAL_SAVE_FOLDER), original_image_name)

@app.route('/generate_json', methods=['GET', 'POST'])
def generate_json():
    # Generate JSON data
    frame_querys = Frames.query.all()
    for frame_record in frame_querys:
        if not frame_record:
            continue
        annotations = Annotations.query.filter(Annotations.frame_id == frame_record.id).all()

        # get the size of each frame
        frame_data = frame_record.img_original
        nparr = np.frombuffer(frame_data, np.uint8)
        frame_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        img_height, img_width = frame_img.shape[:2]
        yolo_lines = []

        original_dir = os.path.join(app.config['DATA_FOLDER'], 'original')
        os.makedirs(original_dir, exist_ok=True)

        # encoded as JPG
        _, encoded_img = cv2.imencode('.jpg', frame_img)
        original_path = os.path.join(original_dir, frame_record.img_original_path + ".jpg")

        with open(original_path, 'wb') as f:
            f.write(encoded_img.tobytes())

        # save each annotation data and cropped images
        for a in annotations:
            y1, x1 = int(a.y), int(a.x)
            h, w = int(a.h), int(a.w)
            print("y1, x1:" + str(y1) + ", " + str(x1))
            print("h, w:" + str(h) + ", " + str(w))
            cropped_img = frame_img[y1:y1+h, x1:x1+w]
            _, cropped_encoded = cv2.imencode('.jpg', cropped_img)
            cropped_filename = f"{a.img_cropped_path}.jpg"
            cropped_dir = os.path.join(app.config['DATA_FOLDER'], 'cropped')
            cropped_path = os.path.join(cropped_dir, cropped_filename)

            with open(cropped_path, 'wb') as f:
                f.write(cropped_encoded.tobytes())

            # generate YOLO annotations files
            stain_level = a.lv
            x_center = (x1 + w / 2) / img_width
            y_center = (y1 + h / 2) / img_height
            box_w = w / img_width
            box_h = h / img_height

            yolo_line = f"{stain_level} {x_center:.6f} {y_center:.6f} {box_w:.6f} {box_h:.6f}\n"
            yolo_lines.append(yolo_line)

        result = [
            {
                "image_name": a.img_cropped_path,
                "stain_level": a.lv,
                "startX": a.x,
                "startY": a.y,
                "width": a.w,
                "height": a.h,
                "image_width": frame_img.shape[1],
                "image_height": frame_img.shape[0],
            } for a in annotations
        ]
        json_data = jsonify(result)
        json_dir = os.path.join(app.config['DATA_FOLDER'], 'annotations_json')
        os.makedirs(os.path.dirname(json_dir), exist_ok=True)
        json_filename = f"{frame_record.img_original_path}.json"
        json_path = os.path.join(json_dir, json_filename)

        # Generate a json file in server
        with open(json_path, 'w') as f:
            json.dump(result, f, indent = 2)

        # generate YOLO annotation file
        txt_dir = os.path.join(app.config['DATA_FOLDER'], 'labels')
        os.makedirs(txt_dir, exist_ok=True)

        txt_filename = f"{frame_record.img_original_path}.txt"
        txt_path = os.path.join(txt_dir, txt_filename)

        with open(txt_path, 'w') as f:
            f.writelines(yolo_lines)

    return jsonify({"success": True, "message": "JSON and cropped images generated successfully."})

@app.route('/robot_image', methods = ['GET', 'POST'])
def image_cleaning():
    m = M
    n = N
    return render_template('robot_image.html', m = m, n = n)

@app.route('/robot_video', methods = ['GET', 'POST'])
def robot_video():
    m = M
    n = N
    return render_template('robot_video.html', m = m, n = n)

@app.route('/new_actions', methods = ['GET', 'POST'])
@app.route('/video_action', methods = ['GET', 'POST'])
def new_actions():
    data = request.get_json()
    if not data:
        return jsonify({ "success": False, "error": "No JSON data received"} ), 400

    frame_data = data.get('frame')
    annotations = data.get('annotations', [])
    cropped_list = data.get('cropped', [])
    print("frame_data type:", type(frame_data))
    print("cropped_data type:" + str(type(cropped_list)) + "\nlength:" + str(len(cropped_list)))
    if not isinstance(frame_data, str):
        return jsonify({"error": "frame data must be a base64 string"}), 400

    if not frame_data or not annotations:
        return jsonify(success = False)

    try:
        # resolve and save the frame data
        if ',' in frame_data:
            _, encoded = frame_data.split(',', 1)
        else:
            encoded = frame_data
        frame_binary = base64.b64decode(encoded)

        # generate unique file name
        timestamp = time.time()
        datetime_obj = datetime.fromtimestamp(timestamp)
        formatted_time = datetime_obj.strftime("%Y_%m_%d-%H_%M_%S")
        frame_filename = f"original_{formatted_time}"

        # create the Frames object
        frame_record = Frames(img_original = frame_binary, img_original_path = frame_filename)
        db.session.add(frame_record)
        db.session.commit()

        # save each annotation data and cropped images
        for idx, annotation in enumerate(annotations):
            if idx >= len(cropped_list):
                # if the index is out of range, then the cropped image is None
                cropped_binary = None
                cropped_filename = None
            else:
                cropped_filename = f"cropped_{formatted_time}_{idx}"
                cropped_path = os.path.join(app.config['DATA_FOLDER'], 'cropped', cropped_filename)

            annotation_record = Annotations(
                x = annotation['startX'],
                y = annotation['startY'],
                w = annotation['width'],
                h = annotation['height'],
                m = annotation['m'],
                n = annotation['n'],
                lv = annotation['stainLevel'],
                img_cropped_path = cropped_filename,
                frame_id = frame_record.id,     # link to the Frames object
            )
            db.session.add(annotation_record)

            grid_x = annotation['a']
            grid_y = annotation['b']
            col_m = int(annotation['m'])
            raw_n = int(annotation['n'])
            lv= int(annotation['stainLevel'])

            # Enqueue the robot task, trigger the consumer
            enqueue_robot_task(grid_x, grid_y, col_m, raw_n, lv)

        db.session.commit()
        return jsonify(success = True)

    except Exception as e:
        print(f"Error saving annotation data: {e}")
        traceback.print_exc()
        return jsonify(success = False)



@app.route('/to_robot_video')
def to_video_cleaning():
    return redirect(url_for('robot_video' , m = M, n = N))

@app.route("/to_robot_image")
def to_image_cleaning():
    # return render_template("robot_image.html", m = M, n = N)
    return redirect(url_for('image_cleaning' , m = M, n = N))

@app.route("/to_video_annotation")
def to_annotation():
    # return render_template("video_annotation.html",m = M, n = N)
    return  redirect(url_for('video_annotation' , m = M, n = N))


@app.route('/modify_grids', methods = ['GET', 'POST'])
def modify_grids():
    data = request.get_json()
    if not data:
        return jsonify({ "success": False, "error": "No JSON data received"} ), 400
    ''' not finished 
    this function allows to change the M and N on the server,
    the M and N also changes in javascript
    but need to do something to secure no risk
    '''


@app.route('/yolo_inference', methods=['POST'])
def yolo_inference_api():
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'success': False, 'error': 'No image selected'}), 400
        
        # 获取其他参数
        image_size = app.config['INFERENCE_IMAGE_SIZE']
        conf_threshold = app.config['CONF_THRESHOLD']
        
        # 读取图片
        image_bytes = image_file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        # 获取原始图像尺寸
        original_width, original_height = image.size
        
        # 使用配置的模型路径
        model_path = app.config['YOLO_MODEL_PATH']
        
        # 初始化YOLO模型
        model = YOLO(model_path)

        # 进行推理
        results = model.predict(
            source=image,
            imgsz=image_size,
            conf=conf_threshold,
            verbose=False
        )
        
        # 处理推理结果
        detections = []
        grid_positions = []  # 新增的网格位置数组
        
        if results and len(results) > 0:
            result = results[0]
            
            # 获取带注释的图片
            annotated_image_array = result.plot(labels=False, conf=False)
            
            # 修复颜色通道问题：BGR -> RGB
            annotated_image_rgb = cv2.cvtColor(annotated_image_array, cv2.COLOR_BGR2RGB)
            
            # 转换为PIL图像
            result_image = Image.fromarray(annotated_image_rgb)
            
            # 转换为base64
            buffered = io.BytesIO()
            result_image.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            annotated_image = f"data:image/png;base64,{img_str}"
            
            # 提取检测框信息
            if result.boxes is not None:
                boxes = result.boxes
                for i in range(len(boxes)):
                    # 获取边界框坐标 (x1, y1, x2, y2)
                    box_coords = boxes.xyxy[i].cpu().numpy().tolist()
                    
                    # 获取置信度
                    confidence = float(boxes.conf[i].cpu().numpy())
                    
                    # 获取类别ID
                    class_id = int(boxes.cls[i].cpu().numpy())
                    
                    # 获取类别名称
                    class_name = model.names[class_id] if class_id < len(model.names) else f"class_{class_id}"
                    
                    # 计算中心点和宽高
                    x1, y1, x2, y2 = box_coords
                    center_x = (x1 + x2) / 2
                    center_y = (y1 + y2) / 2
                    width = x2 - x1
                    height = y2 - y1
                    
                    # 计算网格坐标
                    # 网格大小计算
                    grid_width = original_width / M  # 每个网格的宽度
                    grid_height = original_height / N  # 每个网格的高度
                    
                    # 计算网格位置 (左闭右开区间)
                    grid_a = int(center_x // grid_width)  # 列坐标 (0 到 M-1)
                    grid_b = int(center_y // grid_height)  # 行坐标 (0 到 N-1)
                    
                    # 确保网格坐标不超出边界
                    grid_a = min(grid_a, M - 1)
                    grid_b = min(grid_b, N - 1)
                    grid_a = max(grid_a, 0)
                    grid_b = max(grid_b, 0)
                    
                    detection = {
                        'id': i,
                        'class_id': class_id,
                        'class_name': class_name,
                        'confidence': confidence,
                        'bbox': {
                            'x1': x1,
                            'y1': y1,
                            'x2': x2,
                            'y2': y2,
                            'center_x': center_x,
                            'center_y': center_y,
                            'width': width,
                            'height': height
                        },
                        'position': {
                            'x': center_x,
                            'y': center_y
                        },
                        'grid_position': {
                            'a': grid_a,
                            'b': grid_b
                        }
                    }
                    detections.append(detection)
                    
                    # 添加到网格位置数组 (id, a, b)
                    grid_positions.append({
                        'id': i,
                        'a': grid_a,
                        'b': grid_b
                    })
                    
                    # 打印调试信息
                    print(f"Detection {i}: center=({center_x:.1f}, {center_y:.1f}), "
                          f"grid=({grid_a}, {grid_b}), "
                          f"grid_size=({grid_width:.1f}, {grid_height:.1f}), "
                          f"image_size=({original_width}, {original_height})")
            
            return jsonify({
                'success': True,
                'annotated_image': annotated_image,
                'grid_m': M,
                'grid_n': N,
                'detections': detections,
                'grid_positions': grid_positions,  # 新增的网格位置数组
                'total_detections': len(detections),
                'image_size': {
                    'width': original_width,
                    'height': original_height
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No detection results',
                'annotated_image': None,
                'detections': [],
                'grid_positions': [],  # 空的网格位置数组
                'total_detections': 0,
                'image_size': {
                    'width': original_width,
                    'height': original_height
                }
            })
            
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"Error in yolo_inference_api: {error_msg}")
        print(traceback.format_exc())
        return jsonify({
            'success': False, 
            'error': error_msg,
            'detections': [],
            'grid_positions': [],  # 空的网格位置数组
            'total_detections': 0
        }), 500


def enqueue_robot_task(x, y, m, n, lv, mach_id = 0):
    """
    Enqueue robot task to the queue
    """
    robot_task_queue.put({
        "grid_x": x,
        "grid_y": y,
        "col_m": m,
        "raw_n": n,
        "lv": lv,
        "mach_id": mach_id
    })

    print(f"Enqueued task: grid_x={x}, grid_y={y}, col_m={m}, raw_n={n}, lv={lv}, mach_id={mach_id}")

def execute_robot_task(grid_x, grid_y, col_m, raw_n, lv=0, mach_id=0):
    """
    Synchronous function to execute a robot task
    """
    print(f"[DEBUG] Starting task execution: x={grid_x}, y={grid_y}")
    try:
        result = ua_client.update_variables(
            x=grid_x,
            y=grid_y,
            m=col_m,
            n=raw_n,
            lv=lv,
            mach_id=mach_id
        )

        if result["success"]:
            print(f"[DEBUG] Task executed successfully")
        else:
            print(f"[DEBUG] Task execution partially failed: {result['failed_updates']}")

        time.sleep(2)
    except Exception as e:
        print(f"Error executing task: {e}")
        traceback.print_exc()

def queue_consumer():
    """
    Refactored task handler to use synchronous operations
    """
    print("Queue consumer started!!!")
    while True:
        try:
            # Get task from queue with timeout
            try:
                task = robot_task_queue.get(timeout=2)
            except Empty:
                continue

            print(f"[DEBUG] Task fetched: {task}")

            # Execute the task
            execute_robot_task(
                task["grid_x"],
                task["grid_y"],
                task["col_m"],
                task["raw_n"],
                task["lv"],
                task["mach_id"]
            )

            robot_task_queue.task_done()

        except Exception as e:
            print(f"Error processing queue: {e}")
            traceback.print_exc()
            time.sleep(1)

def multi_thread(thread_name, delay):
    """
    Start the OPC UA server in a separate thread
    """
    # Note: You may need to modify this based on your server_minimal implementation
    try:
        server_synch.run()
    except Exception as e:
        print(f"Error starting OPC UA server: {e}")
    print(f"Thread {thread_name} exiting")

if __name__ == '__main__':
    try:
        # Start OPC UA server thread
        opc_thread = threading.Thread(
            target=multi_thread,
            args=("OPC UA Server", 0.5),
            daemon=True
        )
        opc_thread.start()
        
        # Give server time to start
        time.sleep(2)
        
    except Exception as e:
        print(f"Error starting OPC UA server: {e}")

    try:
        # Initialize UA client
        ua_client = UAClient()
        ua_client.connect()

        # Start consumer thread
        consumer_thread = threading.Thread(target=queue_consumer, daemon=True)
        consumer_thread.start()

    except Exception as e:
        print(f"Error starting OPC UA client: {e}")

    # Create flask server
    try:
        with app.app_context():
            db.create_all()

        print("Starting Flask server...")
        app.run(host="localhost", port=12345, debug=False, use_reloader=False)
    except Exception as e:
        print(f"Error starting Flask server: {e}")
        traceback.print_exc()