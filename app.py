from flask import Flask, render_template, request, redirect, send_from_directory, Response, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
import time
import cv2
import os
import ast

app = Flask(__name__, template_folder='app/templates', static_folder='app/static')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///annotations.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

app.config['DATA_FOLDER'] = 'data'
# make sure the data folder exists
os.makedirs(app.config['DATA_FOLDER'], exist_ok=True)



class VideoCamera(object):
    current_raw_frame = None      # recording the current frame, for the image processing
    current_encoded_frame = None    # For the stream transmission
    def __init__(self):
        self.video = cv2.VideoCapture(0)

    def __del__(self):
        self.video.release()

    def get_frame(self):
        (self.grabbed, self.frame) = self.video.read()
        VideoCamera.current_raw_frame = self.frame.copy()
        image = self.frame
        # cv2.putText(image, "video", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0))
        ret, jpg = cv2.imencode('.jpg', image)
        if ret:
            VideoCamera.current_encoded_frame = jpg
        return jpg.tobytes()

class Annotations(db.Model):
    id = db.Column('annotation_id', db.Integer, primary_key = True)
    x = db.Column('x_center', db.Integer)
    y = db.Column('y_center', db.Integer)
    w = db.Column('width', db.Integer)
    h = db.Column('height', db.Integer)
    m = db.Column('m_horizontal_grid', db.Integer)
    n = db.Column('n_vertical_grid', db.Integer)
    lv = db.Column('stain_level', db.Integer)
    img_s = db.Column('annotation_image', db.LargeBinary)
    img_l = db.Column('original_image', db.LargeBinary)



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
        x = data_dict['centerX'],
        y = data_dict['centerY'],
        w = data_dict['width'],
        h = data_dict['height'],
        m = data_dict['m'],
        n = data_dict['n'],
        lv = data_dict['stainLevel']
    )
    if VideoCamera.current_raw_frame is not None:     # If the current_img in the class is not null, then save the image
        new_annotation.img_l = VideoCamera.current_encoded_frame
        print(VideoCamera.current_raw_frame.shape)
        y_center = int(new_annotation.y)
        x_center = int(new_annotation.x)
        height = int(new_annotation.h)
        width = int(new_annotation.w)

        y1 = int(y_center - height / 2)
        y2 = int(y_center + height / 2)
        x1 = int(x_center - width / 2)
        x2 = int(x_center + width / 2)
        # cut the image
        cropped_image = VideoCamera.current_raw_frame[y1:y2, x1:x2]
        # save to the database
        _, image_encoded = cv2.imencode('.jpg', cropped_image)
        new_annotation.img_s = image_encoded.tobytes()
    db.session.add(new_annotation)
    db.session.commit()
    return jsonify(success = True)


@app.route('/')
def index():
    m = 5
    n = 5
    return render_template('video_annotation.html', m = m, n = n)

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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
