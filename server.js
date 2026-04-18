const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname)));

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) =>
        cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


const studentDB = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "tiger",
    database: "StudentDB"
});

const teacherDB = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "tiger",
    database: "TeacherDB"
});

const parentDB = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "tiger",
    database: "ParentDB"
});


studentDB.connect(err =>
    err ? console.error(" StudentDB", err) : console.log(" StudentDB Connected")
);

teacherDB.connect(err =>
    err ? console.error(" TeacherDB", err) : console.log(" TeacherDB Connected")
);

parentDB.connect(err =>
    err ? console.error(" ParentDB", err) : console.log(" ParentDB Connected")
);


app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Index.html"));
});




app.post("/student-login", (req, res) => {

    const { email, password } = req.body;

    studentDB.query(
        "SELECT email FROM students WHERE email=? AND password=?",
        [email, password],
        (err, result) => {

            if (err) return res.status(500).json({ message: "Student DB Error" });

            if (result.length === 0)
                return res.status(401).json({ message: "Invalid credentials" });

            res.json({ email });
        }
    );
});


app.post("/student-signup", (req, res) => {

    const {
        full_name,
        roll_no,
        email,
        password,
        mobile,
        father_name,
        mother_name,
        address,
        gender,
        age,
        dob
    } = req.body;

    if (!full_name || !roll_no || !email || !password) {
        return res.status(400).json({
            message: "Required fields missing"
        });
    }

    studentDB.query(
        "SELECT email FROM students WHERE email=?",
        [email],
        (err, result) => {

            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Database error"
                });
            }

            if (result.length > 0) {
                return res.status(409).json({
                    message: "Email already registered"
                });
            }

            const query = `
                INSERT INTO students 
                (full_name, roll_no, email, password, mobile, father_name, mother_name, address, gender, age, dob)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            studentDB.query(
                query,
                [
                    full_name,
                    roll_no,
                    email,
                    password,
                    mobile,
                    father_name,
                    mother_name,
                    address,
                    gender,
                    age,
                    dob
                ],
                (err) => {

                    if (err) {
                        console.error(err);
                        return res.status(500).json({
                            message: "Signup failed"
                        });
                    }

                    res.json({
                        message: "Signup successful"
                    });
                }
            );
        }
    );
});



app.get("/student/:email", (req, res) => {

    studentDB.query(
        `SELECT full_name, roll_no, email, mobile,
        father_name, mother_name, address,
        gender, age,
        DATE_FORMAT(dob,'%d-%m-%Y') AS dob_formatted,
        profile_photo
        FROM students WHERE email=?`,
        [req.params.email],

        (err, result) => {

            if (err) return res.status(500).json({ message: "Student DB Error" });

            if (result.length === 0)
                return res.status(404).json({ message: "Student not found" });

            res.json(result[0]);
        }
    );
});



app.post("/student/upload-photo/:email", upload.single("photo"), (req, res) => {

    if (!req.file)
        return res.status(400).json({ message: "No file" });

    const photo = `/uploads/${req.file.filename}`;

    studentDB.query(
        "UPDATE students SET profile_photo=? WHERE email=?",
        [photo, req.params.email],

        err => {

            if (err) return res.status(500).json({ message: "Save failed" });

            res.json({ photo });
        }
    );
});



app.get("/student-subjects/:email", (req, res) => {

    studentDB.query(
        "SELECT subject FROM student_subjects WHERE student_email=?",
        [req.params.email],

        (err, result) => {

            if (err) return res.status(500).json({ message: "Student DB Error" });

            res.json(result.map(r => r.subject));
        }
    );
});



app.post("/student-subjects", (req, res) => {

    const { email, subjects } = req.body;

    if (!email || !Array.isArray(subjects) || subjects.length !== 8) {

        return res.status(400).json({
            message: "Exactly 8 subjects are required"
        });
    }

    const unique = new Set(subjects);

    if (unique.size !== subjects.length) {

        return res.status(400).json({
            message: "Duplicate subjects are not allowed"
        });
    }

    studentDB.query(
        "SELECT subject FROM student_subjects WHERE student_email=?",
        [email],

        (err, result) => {

            if (err) return res.status(500).json({ message: "Student DB Error" });

            if (result.length > 0) {

                return res.status(403).json({
                    message: "Subjects already registered"
                });
            }

            const values = subjects.map(sub => [email, sub]);

            studentDB.query(
                "INSERT INTO student_subjects (student_email, subject) VALUES ?",
                [values],

                err => {

                    if (err) return res.status(500).json({ message: "Save failed" });

                    res.json({ message: "Subjects registered successfully" });
                }
            );
        }
    );
});



app.post("/teacher-login", (req, res) => {

    const { email, password } = req.body;

    teacherDB.query(
        "SELECT email FROM teachers WHERE email=? AND password=?",
        [email, password],

        (err, result) => {

            if (err) return res.status(500).json({ message: "Teacher DB Error" });

            if (result.length === 0)
                return res.status(401).json({ message: "Invalid credentials" });

            res.json({ email });
        }
    );
});



app.get("/teacher/:email", (req, res) => {

    teacherDB.query(
        `SELECT teacher_id, teacher_name, email, phone,
        DATE_FORMAT(dob,'%d-%m-%Y') AS dob_formatted,
        gender, age, address, profile_photo
        FROM teachers WHERE email=?`,

        [req.params.email],

        (err, result) => {

            if (err) return res.status(500).json({ message: "Teacher DB Error" });

            if (result.length === 0)
                return res.status(404).json({ message: "Teacher not found" });

            res.json(result[0]);
        }
    );
});



app.post("/register-face", async (req, res) => {

    const { roll, name, image } = req.body;

    try {

        await axios.post("http://localhost:5000/register-face", {
            roll,
            name,
            image
        });

        res.json({ message: "Face registered successfully" });

    } catch {

        res.status(500).json({ message: "Face registration failed" });
    }
});



app.post("/take-attendance", async (req, res) => {

    const { image } = req.body;

    try {

        const response = await axios.post(
            "http://localhost:5000/take-attendance",
            { image }
        );

        const roll = response.data.roll;

        if (!roll) {

            return res.json({
                message: "Face not recognized"
            });
        }

        teacherDB.query(
            "INSERT INTO attendance (roll_no, date, status) VALUES (?, CURDATE(), 'Present')",
            [roll]
        );

        res.json({
            message: `Attendance marked for ${roll}`
        });

    } catch {

        res.status(500).json({
            message: "Attendance failed"
        });
    }
});



app.get("/teacher-subject/:email", (req, res) => {

    const email = req.params.email;

    teacherDB.query(
        "SELECT subject FROM teacher_subjects WHERE teacher_email = ?",
        [email],

        (err, result) => {

            if (err) return res.status(500).json({ message: "DB Error" });

            if (result.length === 0)
                return res.json({ subject: null });

            res.json({ subject: result[0].subject });
        }
    );
});



app.post("/teacher-subject/:email", (req, res) => {

    const { subject } = req.body;
    const email = req.params.email;

    teacherDB.query(
        "SELECT subject FROM teacher_subjects WHERE teacher_email=?",
        [email],

        (err, result) => {

            if (err) return res.status(500).json({ message: "DB Error" });

            if (result.length > 0) {

                return res.status(403).json({
                    message: "Subject already selected"
                });
            }

            teacherDB.query(
                "INSERT INTO teacher_subjects (teacher_email, subject) VALUES (?, ?)",
                [email, subject],

                err => {

                    if (err) return res.status(500).json({ message: "Save failed" });

                    res.json({ subject });
                }
            );
        }
    );
});



app.get("/students-by-subject/:subject", (req, res) => {

    const subject = req.params.subject;

    teacherDB.query(
        `SELECT s.full_name, s.roll_no
        FROM StudentDB.students s
        JOIN StudentDB.student_subjects ss
        ON s.email = ss.student_email
        WHERE ss.subject = ?`,

        [subject],

        (err, result) => {

            if (err) return res.status(500).json({ message: "DB Error" });

            res.json(result);
        }
    );
});



app.post("/save-attendance", (req, res) => {

    const { subject, attendance } = req.body;

    const today = new Date().toISOString().split("T")[0];

    const values = attendance.map(student => [
        student.roll_no,
        subject,
        today,
        student.status
    ]);

    teacherDB.query(
        "INSERT INTO attendance_records (roll_no, subject, date, status) VALUES ?",
        [values],

        err => {

            if (err)
                return res.status(500).json({ message: "Insert failed" });

            res.json({ message: "Attendance saved successfully" });
        }
    );
});



app.get("/attendance-result/:subject", (req, res) => {

    const subject = req.params.subject;

    const today = new Date().toISOString().split("T")[0];

    const query = `
        SELECT s.roll_no, s.full_name,
        CASE
            WHEN fa.roll IS NOT NULL THEN 'Present'
            ELSE 'Absent'
        END AS status
        FROM StudentDB.students s
        JOIN StudentDB.student_subjects ss
        ON s.email = ss.student_email
        LEFT JOIN TeacherDB.face_attendance fa
        ON s.roll_no = fa.roll AND fa.date = ?
        WHERE ss.subject = ?
    `;

    teacherDB.query(query, [today, subject], (err, result) => {

        if (err) return res.status(500).json({ message: "DB Error" });

        res.json(result);

    });

});


app.get("/student-attendance/:roll", (req, res) => {

    const roll = req.params.roll;

    const query = `
        SELECT 
            subject,

            COUNT(DISTINCT date) AS total_classes,

            COUNT(DISTINCT CASE 
                WHEN status='Present' THEN date 
            END) AS attended

        FROM TeacherDB.attendance_records
        WHERE roll_no = ?
        GROUP BY subject
    `;

    teacherDB.query(query, [roll], (err, result) => {

        if (err) {
            console.error(err);
            return res.status(500).json({ message: "DB Error" });
        }

        const data = result.map(r => ({
            subject: r.subject,
            attended: r.attended || 0,
            total: r.total_classes || 0,
            percentage: r.total_classes
                ? ((r.attended / r.total_classes) * 100).toFixed(2)
                : 0
        }));

        res.json(data);

    });

});


app.get("/student-analysis/:subject", (req, res) => {

    const subject = req.params.subject;

    teacherDB.query(

        `SELECT 
            s.full_name,
            s.roll_no,
            s.profile_photo,

            COUNT(ar.roll_no) AS total_classes,

            SUM(CASE WHEN ar.status='Present' THEN 1 ELSE 0 END) AS attended,

            IFNULL(
                ROUND(
                    (SUM(CASE WHEN ar.status='Present' THEN 1 ELSE 0 END) /
                    COUNT(ar.roll_no)) * 100,2
                ),0
            ) AS percentage

        FROM StudentDB.students s

        JOIN StudentDB.student_subjects ss
        ON s.email = ss.student_email

        LEFT JOIN TeacherDB.attendance_records ar
        ON s.roll_no = ar.roll_no AND ar.subject = ?

        WHERE ss.subject = ?

        GROUP BY 
            s.roll_no,
            s.full_name,
            s.profile_photo`,

        [subject, subject],

        (err, result) => {

            if (err) {
                console.error("Student Analysis Error:", err);
                return res.status(500).json({ message: "DB Error" });
            }

            res.json(result);
        }
    );

});



app.post("/parent-login", (req, res) => {

    const { email, password } = req.body;

    parentDB.query(
        `SELECT email, child_roll_no, parent_type
         FROM parents
         WHERE email=? AND password=?`,
        [email, password],
        (err, result) => {

            if (err)
                return res.status(500).json({ message: "Parent DB Error" });

            if (result.length === 0)
                return res.status(401).json({ message: "Invalid credentials" });

            res.json({
                email: result[0].email,
                child_roll_no: result[0].child_roll_no,
                parent_type: result[0].parent_type
            });
        }
    );
});



app.get("/parent/:email", (req, res) => {

    parentDB.query(
        `SELECT parent_name, phone, email,
        child_roll_no, address, parent_type
        FROM parents WHERE email=?`,

        [req.params.email],

        (err, result) => {

            if (err) return res.status(500).json({ message: "Parent DB Error" });

            if (result.length === 0)
                return res.status(404).json({ message: "Parent not found" });

            res.json(result[0]);
        }
    );
});


app.get("/child-subjects/:roll", (req, res) => {

    const roll = req.params.roll;

    console.log("Child roll received:", roll);

    studentDB.query(
        `SELECT s.roll_no, s.email, ss.subject
         FROM students s
         JOIN student_subjects ss
         ON s.email = ss.student_email
         WHERE s.roll_no = ?`,
        [roll],
        (err, result) => {

            if (err) {
                console.error(err);
                return res.status(500).json({ message: "DB Error" });
            }

            console.log("Subjects found:", result);

            res.json(result);
        }
    );
});


app.get("/child-analysis/:roll", (req, res) => {

    const roll = req.params.roll;

    teacherDB.query(
        `SELECT 
            s.full_name,
            s.roll_no,
            s.profile_photo,

            COUNT(ar.roll_no) AS total_classes,

            SUM(CASE WHEN ar.status='Present' THEN 1 ELSE 0 END) AS attended,

            IFNULL(
                ROUND(
                    (SUM(CASE WHEN ar.status='Present' THEN 1 ELSE 0 END) /
                    COUNT(ar.roll_no)) * 100,2
                ),0
            ) AS percentage

        FROM StudentDB.students s

        LEFT JOIN TeacherDB.attendance_records ar
        ON s.roll_no = ar.roll_no

        WHERE s.roll_no = ?

        GROUP BY 
            s.roll_no,
            s.full_name,
            s.profile_photo`,

        [roll],

        (err, result) => {

            if (err) {
                console.error(err);
                return res.status(500).json({ message: "DB Error" });
            }

            res.json(result[0]);

        }
    );

});



const PORT = 3000;

app.listen(PORT, () => {

    console.log(` Server running at http://localhost:${PORT}`);

});