from flask import Flask, render_template, request, redirect, send_from_directory, Response, jsonify, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
import time
import cv2
import os
import ast
import time, json
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
    img_s_name = db.Column('croppoed_image', db.String(255))    # Save the relative image path
    img_l_name = db.Column('original_image', db.String(255))    # Save the relative image path



# Read the image file from the certain route
# def store_image_from_route(file_path):

#         image = Image(image = image_data)
#         db.session.add(image)
#         db.session.commit()


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


@app.route('/')
def index():
    m = 5
    n = 5
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
    annotations = Annotations.query.with_entities(Annotations.id, Annotations.x, Annotations.y, Annotations.w, Annotations.h, Annotations.lv, Annotations.img_l_name).all()

    # Convert data to JSON string
    '''
        5.14 : add the image name, not finished yet
    '''

    result = [
        {
            "image_name": a.img_l_name,
            "stain_level": a.lv,
            "startX": a.x1,
            "startY": a.y1,
            "width": a.w,
            "height": a.h
        } for a in annotations
    ]
    json_data = jsonify(result)

    file_path = os.path.join('annotation_data', time.strftime("%Y-%m-%d_%H_%M_%S",time.localtime()) +'.json')
    # Generate a json file in server
    with open(file_path, 'w') as f:
        json.dump(result, f, indent = 2)

    # Return JSON data
    return json_data


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
        db.create_all()
    app.run(debug=True)
