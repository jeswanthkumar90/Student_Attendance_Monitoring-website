app.get("/teacher/:email", (req, res) => {
    const email = req.params.email;

    teacherDB.query(
        `SELECT teacher_id, teacher_name, email, phone,
                dob, gender, age, address
         FROM teachers
         WHERE email = ?`,
        [email],
        (err, result) => {
            if (err) return res.status(500).json({ message: "DB error" });
            if (result.length === 0) {
                return res.status(404).json({ message: "Teacher not found" });
            }
            res.json(result[0]);
        }
    );
});
