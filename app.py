from flask import Flask, render_template, request, redirect, send_from_directory, Response, jsonify, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
import time
import cv2
import os
import ast
import time, json
import base64
import traceback
import numpy as np
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



# Read the image file from the certain route
# def store_image_from_route(file_path):

#         image = Image(image = image_data)
#         db.session.add(image)
#         db.session.commit()

'''

@app.route('/new_annotation', methods = ['POST'])
def new_annotation():
    data = request.form.get('annotation_data')
    # resolve and save the data
    data_dict = ast.literal_eval(data)      # transfer into dict type
    print(data_dict)

    new_annotation = Annotations(
        x = data_dict['startX'],
        y = data_dict['startY'],
        w = data_dict['width'],
        h = data_dict['height'],
        m = data_dict['m'],
        n = data_dict['n'],
        lv = data_dict['stainLevel']
    )
    if VideoCamera.current_raw_frame is not None:     # If the current_img in the class is not null, then save the image
        # new_annotation.img_l = VideoCamera.current_encoded_frame
        original_dir = os.path.join(app.instance_path, ORIGINAL_SAVE_FOLDER)
        cropped_dir = os.path.join(app.instance_path, CROPPED_SAVE_FOLDER)
        os.makedirs(original_dir, exist_ok=True)
        os.makedirs(cropped_dir, exist_ok=True)

        timestamp = int(time.time() * 1000)
        base_filename = f"annotation_{timestamp}"

        original_filename = f"{base_filename}_original.jpg"
        original_path = os.path.join(original_dir, original_filename)
        cv2.imwrite(original_path, VideoCamera.current_raw_frame)   # save the original image
        new_annotation.img_l_name = original_filename   # save the name of original image

        startX = new_annotation.x
        startY = new_annotation.y
        height = new_annotation.h
        width = new_annotation.w

        y1 = startY
        y2 = startY + height
        x1 = startX
        x2 = startX + width
        # cut the image
        cropped_image = VideoCamera.current_raw_frame[y1:y2, x1:x2]

        cropped_filename = f"{base_filename}_cropped.jpg"
        cropped_path = os.path.join(cropped_dir, cropped_filename)
        cv2.imwrite(cropped_path, cropped_image)
        new_annotation.img_s_name = cropped_filename    # save the name of cropped image

        # _, image_encoded = cv2.imencode('.jpg', cropped_image)
        # new_annotation.img_s = image_encoded.tobytes()
        db.session.add(new_annotation)
        db.session.commit()
        return jsonify(success = True)
    else:
        return jsonify(success = False)
'''
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
        # 创建保存原始图像的目录
        original_dir = os.path.join(app.config['DATA_FOLDER'], 'original')
        os.makedirs(original_dir, exist_ok=True)  # 直接创建目标目录，而非其父目录

        # 将图像编码为 JPEG 格式
        _, encoded_img = cv2.imencode('.jpg', frame_img)  # 编码为 JPEG 格式
        original_path = os.path.join(original_dir, frame_record.img_original_path + ".jpg")

        # 写入文件
        with open(original_path, 'wb') as f:
            f.write(encoded_img.tobytes())  # 确保写入的是字节流

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


# @app.route('/play_pause', methods=['GET', 'POST'])
# def play_control():
#     if VideoCamera.pause:
#         VideoCamera.pause = False
#         return jsonify(paused = False)
#     else:
#         VideoCamera.pause = True
#         return jsonify(paused = True)

if __name__ == '__main__':
    with app.app_context():
        # db.drop_all()
        db.create_all()
    app.run(debug=True)
