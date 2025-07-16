from flask import Flask, render_template, request, redirect, send_from_directory, Response, jsonify, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
from uaserver import server_minimal
# import asyncio
import time
import cv2
import os
import time
import threading
import time, json
import base64
import traceback
import numpy as np
from queue import Queue, Empty
import asyncio
import logging

# uaclient -- for the opc ua client connection
from uaserver.uaclient import UAClient

# from threading import Lock

app = Flask(__name__, template_folder='app/templates', static_folder='app/static', instance_path='C:/DDD/UIT_PROJECT/web_flask/data')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///annotations.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
ORIGINAL_SAVE_FOLDER = 'original_'
CROPPED_SAVE_FOLDER = 'cropped_'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app.config['DATA_FOLDER'] = 'data'
# make sure the data folder exists
os.makedirs(app.config['DATA_FOLDER'], exist_ok=True)

share_loop = None
# robot_task_queue = asyncio.Queue(maxsize=3)
robot_task_queue = Queue(maxsize=3)



class VideoCamera(object):
    current_raw_frame = None      # recording the current frame, for the image processing
    current_encoded_frame = None    # For the stream transmission
    # pause = False
    # pause_lock = Lock()           # Add thread lock for the pause

    def __init__(self):
        self.video = cv2.VideoCapture(0)    # read from the camera stream
        # self.video = cv2.VideoCapture('app/static/video/sample_2.mp4')  # read from the video file

    def __del__(self):
        self.video.release()

    def get_frame(self):
        # with self.pause_lock:
        #     if not self.pause:
        #         (self.grabbed, self.frame) = self.video.read()
        #         if self.grabbed:
        #             VideoCamera.current_raw_frame = self.frame.copy()
        #             image = self.frame
        #         # cv2.putText(image, "video", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0))
        #             ret, jpg = cv2.imencode('.jpg', image)
        #             if ret:
        #                 VideoCamera.current_encoded_frame = jpg
        #             return jpg.tobytes()
        #         else:
        #             return b'No frame'
        #     else:
        #         # return the last frame if the stream is paused
        #         return VideoCamera.current_encoded_frame if VideoCamera.current_encoded_frame else b'No frame'
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

    # annotations = db.relationship("Annotations", backref="frame")


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
        timestamp = int(time.time() * 1000)
        frame_filename = f"original_{timestamp}"
        # original_frame_path = os.path.join(app.config['DATA_FOLDER'], 'original', frame_filename + '.jpg')
        # os.makedirs(os.path.dirname(original_frame_path), exist_ok=True)

        # with open(original_frame_path, 'wb') as f:
        #     f.write(frame_binary)

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
                # cropped_data = cropped_list[idx]
                # print("cropped_data type:", type(cropped_data))
                # print("cropped_data: ", cropped_data)
                # if ',' in cropped_data:
                #     _, encoded_cropped = cropped_data.split(',', 1)
                # else:
                #     encoded_cropped = cropped_data
                # cropped_binary = base64.b64decode(encoded_cropped)
                cropped_filename = f"cropped_{timestamp}_{idx}"
                cropped_path = os.path.join(app.config['DATA_FOLDER'], 'cropped', cropped_filename)

                # os.makedirs(os.path.dirname(cropped_path), exist_ok=True)
                # with open(cropped_path, 'wb') as f:
                #     f.write(cropped_binary)

            annotation_record = Annotations(
                x = annotation['startX'],
                y = annotation['startY'],
                w = annotation['width'],
                h = annotation['height'],
                m = annotation['m'],
                n = annotation['n'],
                lv = annotation['stainLevel'],
                # img_cropped = cropped_binary,
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
    m = 25
    n = 30
    return render_template('video_annotation.html', m = m, n = n)


@app.route('/video')
def video():
    m = 5
    n = 5
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
    return Response(gen(VideoCamera()), mimetype='multipart/x-mixed-replace; boundary=frame')  # why multipart/x-mixed-replace

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

        # create original images using the database
        # original_dir = os.path.join(app.config['DATA_FOLDER'], 'original')
        # os.makedirs(os.path.dirname(original_dir), exist_ok=True)
        # original_path = os.path.join(original_dir, frame_record.img_original_path + ".jpg")

        # with open(original_path, 'wb') as f:
        #     f.write(frame_img)
        original_dir = os.path.join(app.config['DATA_FOLDER'], 'original')
        os.makedirs(original_dir, exist_ok=True)

        # encoded as JPG
        _, encoded_img = cv2.imencode('.jpg', frame_img)
        original_path = os.path.join(original_dir, frame_record.img_original_path + ".jpg")

        with open(original_path, 'wb') as f:
            f.write(encoded_img.tobytes())

        # frame_dir = os.path.join(app.config['DATA_FOLDER'], 'original')
        # frame_path = os.path.join(frame_path, frame_record.img_original_path)


        # Convert data to JSON string
        '''
            5.14 : add the image name, not finished yet
            5.20 : need to export both the image and the JSON file,
        '''

        # save each annotation data and cropped images
        for a in annotations:
            # cropped_data = cropped_list[idx]

            y1, x1 = int(a.y), int(a.x)
            h, w = int(a.h), int(a.w)
            print("y1, x1:" + str(y1) + ", " + str(x1))
            print("h, w:" + str(h) + ", " + str(w))
            cropped_img = frame_img[y1:y1+h, x1:x1+w]
            _, cropped_encoded = cv2.imencode('.jpg', cropped_img)
            cropped_filename = f"{a.img_cropped_path}.jpg"
            cropped_dir = os.path.join(app.config['DATA_FOLDER'], 'cropped')
            cropped_path = os.path.join(cropped_dir, cropped_filename)

            # os.makedirs(os.path.dirname(cropped_path), exist_ok=True)
            with open(cropped_path, 'wb') as f:
                f.write(cropped_encoded.tobytes())

            # generate YOLO annotatons files
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

@app.route('/clean_image', methods = ['GET', 'POST'])
def robot_image():
    m = 5
    n = 10
    return render_template('robot_cleaning_image.html', m = m, n = n)

@app.route('/new_actions', methods = ['GET', 'POST'])
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
        timestamp = int(time.time() * 1000)
        frame_filename = f"original_{timestamp}"

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
                cropped_filename = f"cropped_{timestamp}_{idx}"
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
            # if share_loop is not None:
            #     asyncio.run_coroutine_threadsafe(enqueue_robot_task(grid_x, grid_y, col_m, raw_n, lv), share_loop)
            # else:
            #     print("Share_loop is None. Error. Skipped command")
            enqueue_robot_task(grid_x, grid_y, col_m, raw_n, lv)


        db.session.commit()

        # Execute the robot move
        # This action is executed by the asynchrous consumer
        # server_minimal.update_variables(grid_x, grid_y, col_m, raw_n)

        return jsonify(success = True)

    except Exception as e:
        print(f"Error saving annotation data: {e}")
        traceback.print_exc()
        return jsonify(success = False)


def enqueue_robot_task(x, y, m, n, lv, mach_id = 0):
    # robot task enqueuing
    robot_task_queue.put({
        "grid_x": x,
        "grid_y": y,
        "col_m": m,
        "raw_n": n,
        "lv": lv,
        "mach_id": mach_id
    })

    print(f"Enqueued task: grid_x={x}, grid_y={y}, col_m={m}, raw_n={n}, lv={lv}, mach_id={mach_id}")

async def execute_robot_task_async(grid_x, grid_y, col_m, raw_n, lv=0, mach_id = 0):
    """
    asynchronous function to execute a robot task
    """
    print(f"[DEBUG] Starting task execution: x={grid_x}, y={grid_y}")
    try:
        # await server_minimal.update_variables(grid_x, grid_y, col_m, raw_n)

        result = await ua_client.update_variables(x=grid_x, y=grid_y, m=col_m, n=raw_n, lv=lv, mach_id=mach_id)

        if result["success"]:
            print(f"[DEBUG] Task executed successfully")
        else:
            print(f"[DEBUG] Task execution partially failed: {result['failed_updates']}")

        await asyncio.sleep(2)
    except Exception as e:
        print(f"Error executing task: {e}")
        traceback.print_exc()



async def queue_consumer():
    '''refactor task handler to use a single event loop'''
    print("Queue consumer started!!!")
    while True:
        try:
            # wait for RobotAvailable == True

            await ua_client.ensure_robot_available()

            # task = await asyncio.wait_for(robot_task_queue.get(), timeout=1)

            # synchrounous get from queue
            task = robot_task_queue.get(timeout=2)
            print(f"[DEBUG] Task fetched: {task}")

            # commit to the current event loop
            await execute_robot_task_async(
                task["grid_x"],
                task["grid_y"],
                task["col_m"],
                task["raw_n"],
                task["lv"],
                task["mach_id"]
            )

            robot_task_queue.task_done()
        except asyncio.TimeoutError:
            await asyncio.sleep(0.5)

        except Empty:
            await asyncio.sleep(0.2)
            continue
        except Exception as e:
            print(f"Error processing queue: {e}")
            traceback.print_exc()


def multi_thread(thread_name, delay):
    # start the OPC UA server
    asyncio.run(server_minimal.main())
    print(f"Thread {thread_name} exiting")

def start_ua_client_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

async def init_ua_client():
    """initialize OPC UA client"""
    global ua_client
    ua_client = UAClient()
    await ua_client.connect()


if __name__ == '__main__':
    try:
        opc_thread = threading.Thread(
            target=multi_thread,
            args=("OPC UA Server", 0.5),
            daemon=True
        )
        opc_thread.start()
    except Exception as e:
        print(f"Error starting OPC UA server: {e}")

    try:
        client_loop = asyncio.new_event_loop()

        # start the opc ua client loop in a separate thread
        ua_client_thread = threading.Thread(target=start_ua_client_loop, args=(client_loop,), daemon=True)
        ua_client_thread.start()

        # Run the OPC UA client
        asyncio.run_coroutine_threadsafe(init_ua_client(), client_loop)
        share_loop = client_loop
        asyncio.run_coroutine_threadsafe(queue_consumer(), client_loop)

    except Exception as e:
        print(f"Error starting OPC UA client: {e}")

    # create flask server
    try:
        with app.app_context():
            db.create_all()

        print("Starting Flask server...")
        app.run(host="localhost", port=12345,debug=True)
    except Exception as e:
        print(f"Error starting Flask server: {e}")
        traceback.print_exc()

