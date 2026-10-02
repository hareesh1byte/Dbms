import os, datetime, decimal
from functools import wraps
import mysql.connector
from flask import Flask, request, jsonify, session, render_template
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-me")
DB = dict(host=os.getenv("DB_HOST", "localhost"), user=os.getenv("DB_USER", "root"),
          password=os.getenv("DB_PASS", ""), database=os.getenv("DB_NAME", "sip"))

def clean(v):
    if isinstance(v, (datetime.date, datetime.datetime)): return v.isoformat()[:10]
    if isinstance(v, decimal.Decimal): return float(v)
    return v

def q(sql, args=(), one=False, write=False):
    c = mysql.connector.connect(**DB); cur = c.cursor(dictionary=True)
    try:
        cur.execute(sql, args)
        if write: c.commit(); return cur.lastrowid
        rows = [{k: clean(v) for k, v in r.items()} for r in cur.fetchall()]
        return (rows[0] if rows else None) if one else rows
    finally:
        cur.close(); c.close()

def auth(f):
    @wraps(f)
    def w(*a, **k):
        if "uid" not in session: return jsonify(error="Please sign in"), 401
        return f(*a, **k)
    return w

@app.errorhandler(mysql.connector.Error)
def db_err(e):
    msg = "That roll number already exists." if getattr(e, "errno", 0) == 1062 else str(e)
    return jsonify(error=msg), 400

@app.route("/")
def index(): return render_template("index.html")

@app.post("/api/login")
def login():
    d = request.json or {}
    u = q("SELECT * FROM users WHERE username=%s", (d.get("username"),), one=True)
    if not u or not check_password_hash(u["password_hash"], d.get("password", "")):
        return jsonify(error="Wrong username or password"), 401
    session["uid"] = u["id"]; session["user"] = u["username"]
    return jsonify(user=u["username"])

@app.post("/api/logout")
def logout(): session.clear(); return jsonify(ok=True)

@app.get("/api/me")
@auth
def me(): return jsonify(user=session["user"])

SF = ["roll_no", "name", "email", "phone", "class_name", "dob"]
def sv(d): return [(d.get(k) or None) for k in SF]

@app.get("/api/students")
@auth
def students(): return jsonify(q("SELECT * FROM students ORDER BY roll_no"))

@app.post("/api/students")
@auth
def add_student():
    q("INSERT INTO students(roll_no,name,email,phone,class_name,dob) VALUES(%s,%s,%s,%s,%s,%s)", sv(request.json), write=True)
    return jsonify(ok=True)

@app.put("/api/students/<int:i>")
@auth
def edit_student(i):
    q("UPDATE students SET roll_no=%s,name=%s,email=%s,phone=%s,class_name=%s,dob=%s WHERE id=%s", sv(request.json) + [i], write=True)
    return jsonify(ok=True)

@app.delete("/api/students/<int:i>")
@auth
def del_student(i): q("DELETE FROM students WHERE id=%s", (i,), write=True); return jsonify(ok=True)

@app.get("/api/subjects")
@auth
def subjects(): return jsonify(q("SELECT * FROM subjects ORDER BY name"))

@app.get("/api/attendance")
@auth
def get_att():
    d = request.args.get("date", datetime.date.today().isoformat())
    return jsonify(q("SELECT s.id,s.roll_no,s.name,a.status FROM students s LEFT JOIN attendance a ON a.student_id=s.id AND a.att_date=%s ORDER BY s.roll_no", (d,)))

@app.post("/api/attendance")
@auth
def save_att():
    d = request.json
    for r in d["records"]:
        if r.get("status"):
            q("INSERT INTO attendance(student_id,att_date,status) VALUES(%s,%s,%s) ON DUPLICATE KEY UPDATE status=VALUES(status)", (r["student_id"], d["date"], r["status"]), write=True)
    return jsonify(ok=True)

@app.get("/api/grades")
@auth
def get_grades():
    sid = request.args.get("student_id")
    sql = "SELECT g.*,s.name student,s.roll_no,sub.name subject,ROUND(g.marks/g.max_marks*100,1) pct FROM grades g JOIN students s ON s.id=g.student_id JOIN subjects sub ON sub.id=g.subject_id"
    if sid: return jsonify(q(sql + " WHERE g.student_id=%s ORDER BY g.id DESC", (sid,)))
    return jsonify(q(sql + " ORDER BY g.id DESC LIMIT 200"))

@app.post("/api/grades")
@auth
def add_grade():
    d = request.json
    q("INSERT INTO grades(student_id,subject_id,exam,marks,max_marks) VALUES(%s,%s,%s,%s,%s)", (d["student_id"], d["subject_id"], d["exam"], d["marks"], d.get("max_marks") or 100), write=True)
    return jsonify(ok=True)

@app.delete("/api/grades/<int:i>")
@auth
def del_grade(i): q("DELETE FROM grades WHERE id=%s", (i,), write=True); return jsonify(ok=True)

@app.get("/api/stats")
@auth
def stats():
    t = datetime.date.today().isoformat()
    return jsonify(
        students=q("SELECT COUNT(*) n FROM students", one=True)["n"],
        present_today=q("SELECT COUNT(*) n FROM attendance WHERE att_date=%s AND status IN('Present','Late')", (t,), one=True)["n"],
        attendance_rate=q("SELECT ROUND(100*AVG(status<>'Absent'),1) n FROM attendance", one=True)["n"],
        avg_grade=q("SELECT ROUND(AVG(marks/max_marks*100),1) n FROM grades", one=True)["n"],
        top=q("SELECT s.name,ROUND(AVG(g.marks/g.max_marks*100),1) pct FROM grades g JOIN students s ON s.id=g.student_id GROUP BY s.id ORDER BY pct DESC LIMIT 5"))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3000")), debug=True)
