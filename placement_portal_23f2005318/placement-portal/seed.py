"""Admin bootstrap + optional demo dataset.

    python seed.py          -> admin only
    python seed.py --demo   -> admin + sample companies, students, drives, applications
"""
import random
import sys
from datetime import date, datetime, timedelta

from extensions import db
from models import User, Student, Company, Drive, Application

ADMIN_EMAIL = "admin@institute.edu"
ADMIN_PASSWORD = "admin123"


def ensure_admin():
    """Called on every boot - the admin is a pre-existing superuser."""
    if User.query.filter_by(role="admin").first():
        return
    admin = User(email=ADMIN_EMAIL, role="admin")
    admin.set_password(ADMIN_PASSWORD)
    db.session.add(admin)
    db.session.commit()
    print(f"[seed] admin created -> {ADMIN_EMAIL} / {ADMIN_PASSWORD}")


BRANCHES = ["Computer Science", "Information Technology", "Electronics",
            "Mechanical", "Civil"]

COMPANIES = [
    ("Nexora Systems", "Priya Nair", "https://nexora.example.com", "Bengaluru",
     "Software Products", "approved",
     "Nexora builds developer tooling used by 40,000+ engineering teams. "
     "We hire for backend, data and platform roles."),
    ("Vertex Analytics", "Rahul Menon", "https://vertex.example.com", "Chennai",
     "Data & AI", "approved",
     "Vertex turns messy enterprise data into decisions. Our applied science "
     "team works on forecasting, NLP and optimisation."),
    ("Arclight Fintech", "Sneha Kulkarni", "https://arclight.example.com", "Mumbai",
     "Financial Services", "approved",
     "Arclight powers real-time payments for 60 banks across South Asia."),
    ("Kestrel Robotics", "Arjun Bose", "https://kestrel.example.com", "Pune",
     "Hardware & Robotics", "pending",
     "Kestrel designs warehouse automation robots and the control software "
     "that runs them."),
    ("Halcyon Cloud", "Meera Iyer", "https://halcyon.example.com", "Hyderabad",
     "Cloud Infrastructure", "pending",
     "Halcyon runs a sovereign cloud platform for regulated industries."),
]

STUDENTS = [
    ("Aditya Sharma", "CS21B001", "Computer Science", 8.9, 2026),
    ("Neha Verma", "CS21B002", "Computer Science", 9.4, 2026),
    ("Rohit Iyer", "IT21B011", "Information Technology", 7.8, 2026),
    ("Kavya Reddy", "IT21B012", "Information Technology", 8.2, 2026),
    ("Siddharth Rao", "EC21B021", "Electronics", 7.1, 2026),
    ("Ananya Gupta", "EC21B022", "Electronics", 8.6, 2026),
    ("Vikram Singh", "ME21B031", "Mechanical", 6.9, 2026),
    ("Ishita Das", "CS21B003", "Computer Science", 9.1, 2027),
]

DRIVES = [
    # (company idx, drive name, job title, branches, min cgpa, salary, location,
    #  days-to-deadline, status, mode, description)
    (0, "Drive 1", "Senior Software Developer", "Computer Science,Information Technology",
     8.0, 1800000, "Chennai", 21, "approved", "In-person",
     "An experienced developer who leads projects and designs scalable systems. "
     "You will own services that handle 2M requests per minute."),
    (0, "Drive 2", "Platform Engineer", "Computer Science,Electronics",
     7.5, 1400000, "Bengaluru", 12, "approved", "Online",
     "Build and operate the internal developer platform: CI/CD, observability "
     "and infrastructure-as-code."),
    (1, "Drive 3", "Data Scientist", "Computer Science,Information Technology",
     8.5, 2000000, "Chennai", 30, "approved", "In-person",
     "Design forecasting and NLP models end to end, from problem framing to "
     "production monitoring."),
    (1, "Drive 4", "Analytics Associate", "", 7.0, 900000, "Chennai",
     5, "approved", "Online",
     "Work with business teams to build dashboards and answer analytical questions."),
    (2, "Drive 5", "Backend Engineer - Payments", "Computer Science,Information Technology",
     7.5, 1600000, "Mumbai", 18, "approved", "In-person",
     "Own payment rails written in Go and Python with strict correctness "
     "and latency budgets."),
    (2, "Drive 6", "Security Analyst", "Computer Science,Electronics",
     7.0, 1200000, "Mumbai", 25, "pending", "Online",
     "Threat modelling, penetration testing and incident response for "
     "banking infrastructure."),
    (0, "Drive 7", "QA Automation Engineer", "", 6.5, 800000, "Bengaluru",
     -10, "closed", "Online",
     "Build automated regression suites for the Nexora product line."),
]


def seed_demo():
    ensure_admin()
    if Company.query.count() > 0:
        print("[seed] demo data already present - skipping.")
        return

    companies = []
    for name, hr, site, loc, industry, status, overview in COMPANIES:
        slug = name.split()[0].lower()
        user = User(email=f"hr@{slug}.com", role="company")
        user.set_password("company123")
        db.session.add(user)
        db.session.flush()
        c = Company(user_id=user.id, name=name, hr_contact=hr, hr_phone="+91-9800000000",
                    website=site, location=loc, industry=industry, overview=overview,
                    approval_status=status)
        db.session.add(c)
        companies.append(c)
    db.session.flush()

    students = []
    for full_name, roll, branch, cgpa, year in STUDENTS:
        user = User(email=f"{roll.lower()}@institute.edu", role="student")
        user.set_password("student123")
        db.session.add(user)
        db.session.flush()
        s = Student(user_id=user.id, full_name=full_name, roll_number=roll,
                    branch=branch, cgpa=cgpa, grad_year=year,
                    phone="+91-9900000000",
                    resume_url=f"https://resumes.example.com/{roll.lower()}.pdf",
                    about=f"{branch} undergraduate graduating in {year}.")
        db.session.add(s)
        students.append(s)
    db.session.flush()

    drives = []
    for (ci, dname, title, branches, cgpa, salary, loc, days, status, mode,
         desc) in DRIVES:
        d = Drive(company_id=companies[ci].id, drive_name=dname, job_title=title,
                  job_description=desc, eligible_branches=branches, min_cgpa=cgpa,
                  eligible_year=2026, salary=salary, location=loc, openings=3,
                  interview_mode=mode,
                  application_deadline=date.today() + timedelta(days=days),
                  status=status)
        db.session.add(d)
        drives.append(d)
    db.session.flush()

    random.seed(7)
    statuses = ["applied", "applied", "shortlisted", "selected", "rejected", "waiting"]
    for student in students:
        for drive in drives:
            if drive.status not in ("approved", "closed"):
                continue
            ok, _ = drive.is_student_eligible(student)
            if drive.status == "closed":
                ok = (not drive.branch_list or student.branch in drive.branch_list) \
                     and student.cgpa >= drive.min_cgpa
            if not ok or random.random() > 0.55:
                continue
            st = random.choice(statuses)
            db.session.add(Application(
                student_id=student.id, drive_id=drive.id, status=st,
                applied_on=datetime.now() - timedelta(days=random.randint(1, 40)),
                remark={"shortlisted": "Cleared the online round.",
                        "selected": "Offer released.",
                        "rejected": "Did not clear the technical round.",
                        "waiting": "Awaiting panel feedback."}.get(st),
                interview_datetime=datetime.now() + timedelta(days=random.randint(2, 15))
                if st in ("shortlisted", "selected") else None,
            ))

    db.session.commit()
    print(f"[seed] demo data created: {len(companies)} companies, "
          f"{len(students)} students, {len(drives)} drives, "
          f"{Application.query.count()} applications")
    print("[seed] logins -> admin@institute.edu/admin123 | "
          "hr@nexora.com/company123 | cs21b001@institute.edu/student123")


if __name__ == "__main__":
    from app import app
    with app.app_context():
        if "--demo" in sys.argv:
            seed_demo()
        else:
            ensure_admin()
