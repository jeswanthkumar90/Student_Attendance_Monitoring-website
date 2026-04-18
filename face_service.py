from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import face_recognition
import numpy as np
import os
import pickle
from datetime import datetime
import csv
import traceback
from PIL import Image
import io
import mysql.connector
import requests
import xml.etree.ElementTree as ET

app = Flask(__name__)
CORS(app)

KNOWN_FACES_DIR = "known_faces"
ATTENDANCE_FILE = "attendance.csv"
os.makedirs(KNOWN_FACES_DIR, exist_ok=True)

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "tiger",
    "database": "TeacherDB"
}

def is_fp_scan_success(xml_string):
    try:
        if not xml_string or not xml_string.strip().startswith('<'):
            return False
        root = ET.fromstring(xml_string)
        resp = root.find('Resp')
        if resp is not None:
            return resp.attrib.get('errCode') == "0"
        return False
    except Exception as e:
        print(f"Fingerprint XML Error: {e}")
        return False

@app.route("/")
def home(): return render_template("Tea_attendance.html")

@app.route("/register")
def register_page(): return render_template("face_register.html")

@app.route("/attendance")
def attendance_page(): return render_template("take_attendance.html")

@app.route("/capture-fingerprint", methods=["GET", "POST"])
def capture_fingerprint():
    try:
        url = "http://127.0.0.1:11100/rd/capture"
        xml = '<?xml version="1.0"?><PidOptions ver="1.0"><Opts fCount="1" fType="1" iCount="0" iType="0" pCount="0" pType="0" format="0" pidVer="2.0" timeout="10000" posh="UNKNOWN" env="P" /><CustOpts><Param name="wadh" value="" /></CustOpts></PidOptions>'
        headers = {"Content-Type": "text/xml", "Accept": "text/xml"}
        response = requests.request(method="CAPTURE", url=url, data=xml, headers=headers, timeout=20)
        return response.text
    except Exception as e:
        return f"ERROR: {str(e)}"

def preprocess_image(img_bytes):
    try:
        pil_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        return np.array(pil_image, dtype=np.uint8)
    except Exception: return None

def load_known_faces():
    encodings, people = [], []
    if not os.path.exists(KNOWN_FACES_DIR): return encodings, people
    for file in os.listdir(KNOWN_FACES_DIR):
        if file.endswith(".pkl"):
            try:
                with open(os.path.join(KNOWN_FACES_DIR, file), "rb") as f:
                    data = pickle.load(f)
                    encodings.append(data["encoding"])
                    people.append(data)
            except: continue
    return encodings, people

@app.route("/register-face", methods=["POST"])
def register_face():
    try:
        roll = request.form.get("roll")
        name = request.form.get("name")
        image = request.files.get("image")
        fingerprint_xml = request.form.get("fingerprint")

        if not all([roll, name, image, fingerprint_xml]):
            return jsonify({"status": "error", "message": "Missing data"}), 400

        if not is_fp_scan_success(fingerprint_xml):
            return jsonify({"status": "error", "message": "Fingerprint scan failed during registration"}), 400

        rgb = preprocess_image(image.read())
        face_loc = face_recognition.face_locations(rgb)
        if len(face_loc) != 1:
            return jsonify({"status": "error", "message": "One face required"}), 400

        encoding = face_recognition.face_encodings(rgb, face_loc)[0]

        data = {
            "roll": roll, 
            "name": name, 
            "encoding": encoding, 
            "fingerprint": "registered" 
        }
        with open(os.path.join(KNOWN_FACES_DIR, f"{roll}.pkl"), "wb") as f:
            pickle.dump(data, f)

        return jsonify({"status": "success", "message": f"{name} registered successfully"})
    except Exception:
        traceback.print_exc()
        return jsonify({"status": "error", "message": "Internal error"}), 500

@app.route("/take-attendance", methods=["POST"])
def take_attendance():
    try:
        image = request.files.get("image")
        new_fingerprint_xml = request.form.get("fingerprint")

        if not image or not new_fingerprint_xml:
            return jsonify({"status": "error", "message": "Missing data"}), 400

        rgb = preprocess_image(image.read())
        face_locations = face_recognition.face_locations(rgb)
        
        if not face_locations:
            return jsonify({"status": "Unknown Face"})

        current_face_encoding = face_recognition.face_encodings(rgb, face_locations)[0]
        known_encodings, known_people = load_known_faces()

        if known_encodings:
            matches = face_recognition.compare_faces(known_encodings, current_face_encoding, tolerance=0.50)
            
            if True in matches:
                idx = matches.index(True)
                person = known_people[idx]

                if is_fp_scan_success(new_fingerprint_xml):
                    mark_attendance(person["roll"], person["name"])
                    return jsonify({
                        "status": "Present", 
                        "roll": person["roll"], 
                        "name": person["name"]
                    })
                else:
                    return jsonify({
                        "status": "Mismatched", 
                        "message": "Face recognized, but fingerprint scan failed or missing!"
                    })

        return jsonify({"status": "Unknown Face", "message": "Face not recognized in database"})
    except Exception:
        traceback.print_exc()
        return jsonify({"status": "error", "message": "Internal error"}), 500

def mark_attendance(roll, name):
    now = datetime.now()
    today, t_time = now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S")
    with open(ATTENDANCE_FILE, "a", newline="") as f:
        csv.writer(f).writerow([roll, name, today, t_time])
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        curr = conn.cursor()
        curr.execute("SELECT * FROM face_attendance WHERE roll=%s AND date=%s", (roll, today))
        if not curr.fetchone():
            curr.execute("INSERT INTO face_attendance (roll, name, date, time) VALUES (%s,%s,%s,%s)", (roll, name, today, t_time))
            conn.commit()
        conn.close()
    except Exception as e: print("DB Error:", e)

if __name__ == "__main__":
    app.run(debug=True)