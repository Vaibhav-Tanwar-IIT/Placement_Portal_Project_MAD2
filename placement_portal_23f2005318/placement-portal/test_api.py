"""End-to-end smoke test against a running server: python test_api.py"""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:5000"
passed, failed = 0, 0


def call(method, path, body=None, token=None, expect=200):
    global passed, failed
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=15) as r:
            status, payload = r.status, json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        status, payload = e.code, json.loads(e.read() or "{}")

    if status == expect:
        passed += 1
        print(f"  PASS  {method:6} {path[:52]:52} -> {status}")
    else:
        failed += 1
        print(f"  FAIL  {method:6} {path[:52]:52} -> {status} (expected {expect}) "
              f"{payload.get('message', '')}")
    return payload


def login(email, pw):
    return call("POST", "/api/auth/login", {"email": email, "password": pw})["access_token"]


print("\n== health ==")
call("GET", "/api/health")

print("\n== auth ==")
admin = login("admin@institute.edu", "admin123")
company = login("hr@nexora.com", "company123")
student = login("cs21b002@institute.edu", "student123")
call("POST", "/api/auth/login", {"email": "admin@institute.edu", "password": "wrong"},
     expect=401)
call("GET", "/api/admin/dashboard", expect=401)  # no token

print("\n== role guards ==")
call("GET", "/api/admin/dashboard", token=student, expect=403)
call("GET", "/api/company/dashboard", token=student, expect=403)
call("GET", "/api/student/dashboard", token=admin, expect=403)

print("\n== admin ==")
d = call("GET", "/api/admin/dashboard", token=admin)
print(f"        companies={len(d['companies'])} students={len(d['students'])} "
      f"ongoing={len(d['ongoing_drives'])} pending_co={len(d['pending_companies'])}")
call("GET", "/api/admin/search?q=Neha", token=admin)
call("GET", "/api/admin/stats", token=admin)
call("GET", "/api/admin/stats", token=admin)  # served from the Redis cache

print("\n== company: create drive -> admin approves ==")
new = call("POST", "/api/company/drives", {
    "drive_name": "Drive 99", "job_title": "SDE Intern",
    "job_description": "Six month internship.",
    "eligible_branches": "Computer Science", "min_cgpa": 7.0,
    "eligible_year": 2026, "salary": 600000, "location": "Remote",
    "openings": 5, "interview_mode": "Online",
    "application_deadline": "2026-12-31"}, token=company, expect=201)
did = new["drive"]["id"]
call("POST", "/api/company/drives", {"drive_name": "", "job_title": ""},
     token=company, expect=400)

# Student cannot see it until the admin approves.
drives = call("GET", "/api/student/drives", token=student)["drives"]
assert not any(x["id"] == did for x in drives), "unapproved drive leaked to students!"
print("        unapproved drive correctly hidden from students")

call("POST", f"/api/admin/drives/{did}/approval", {"decision": "approved"}, token=admin)

print("\n== student: apply ==")
call("GET", f"/api/student/drives/{did}", token=student)
app_row = call("POST", f"/api/student/drives/{did}/apply", {}, token=student, expect=201)
aid = app_row["application"]["id"]
call("POST", f"/api/student/drives/{did}/apply", {}, token=student, expect=409)  # duplicate

print("\n== eligibility rejection ==")
low = login("me21b031@institute.edu", "student123")  # Mechanical, CGPA 6.9
call("POST", f"/api/student/drives/{did}/apply", {}, token=low, expect=403)

print("\n== company: review the application ==")
call("PUT", f"/api/company/applications/{aid}",
     {"status": "shortlisted", "remark": "Cleared round 1.",
      "interview_datetime": "2026-09-10T10:30"}, token=company)
call("PUT", "/api/company/applications/bulk",
     {"items": [{"id": aid, "status": "selected", "remark": "Offer released."}]},
     token=company)

print("\n== student: history reflects the decision ==")
hist = call("GET", "/api/student/history", token=student)
row = next(h for h in hist["history"] if h["id"] == aid)
assert row["status"] == "selected" and row["remark"] == "Offer released.", row
print(f"        status={row['status']!r} remark={row['remark']!r}")

print("\n== withdraw guard ==")
call("DELETE", f"/api/student/applications/{aid}", token=student, expect=409)

print("\n== blacklist cascade ==")
call("POST", "/api/admin/students/2/blacklist", {"blacklist": True}, token=admin)
call("POST", "/api/auth/login", {"email": "cs21b002@institute.edu",
                                 "password": "student123"}, expect=403)
call("POST", "/api/admin/students/2/blacklist", {"blacklist": False}, token=admin)
login("cs21b002@institute.edu", "student123")

print("\n== celery jobs ==")
call("POST", "/api/admin/reports/reminders", {}, token=admin, expect=202)
call("POST", "/api/admin/reports/monthly", {}, token=admin, expect=202)

print(f"\n{'=' * 60}\n  {passed} passed, {failed} failed\n{'=' * 60}")
sys.exit(1 if failed else 0)
