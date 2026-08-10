from datetime import datetime, date

from werkzeug.security import generate_password_hash, check_password_hash

from extensions import db


# --------------------------------------------------------------------------
# User  (one table for all three roles: admin / company / student)
# --------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)          # admin | company | student
    is_active = db.Column(db.Boolean, default=True)          # deactivate / blacklist switch
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship("Student", back_populates="user", uselist=False,
                              cascade="all, delete-orphan")
    company = db.relationship("Company", back_populates="user", uselist=False,
                              cascade="all, delete-orphan")

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)

    def to_dict(self):
        return {"id": self.id, "email": self.email, "role": self.role,
                "is_active": self.is_active}


# --------------------------------------------------------------------------
# Student
# --------------------------------------------------------------------------
class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)

    full_name = db.Column(db.String(120), nullable=False)
    roll_number = db.Column(db.String(40), unique=True)
    branch = db.Column(db.String(80))                  # e.g. "Computer Science"
    cgpa = db.Column(db.Float, default=0.0)
    grad_year = db.Column(db.Integer)
    phone = db.Column(db.String(20))
    resume_url = db.Column(db.String(300))
    about = db.Column(db.Text)
    is_blacklisted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="student")
    applications = db.relationship("Application", back_populates="student",
                                   cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id, "user_id": self.user_id, "email": self.user.email,
            "full_name": self.full_name, "roll_number": self.roll_number,
            "branch": self.branch, "cgpa": self.cgpa, "grad_year": self.grad_year,
            "phone": self.phone, "resume_url": self.resume_url, "about": self.about,
            "is_blacklisted": self.is_blacklisted,
            "is_active": self.user.is_active,
            "applications_count": len(self.applications),
        }


# --------------------------------------------------------------------------
# Company
# --------------------------------------------------------------------------
class Company(db.Model):
    __tablename__ = "companies"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)

    name = db.Column(db.String(150), nullable=False)
    hr_contact = db.Column(db.String(120))
    hr_phone = db.Column(db.String(20))
    website = db.Column(db.String(200))
    location = db.Column(db.String(120))
    industry = db.Column(db.String(120))
    overview = db.Column(db.Text)
    logo_url = db.Column(db.String(300))
    approval_status = db.Column(db.String(20), default="pending")  # pending|approved|rejected
    is_blacklisted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="company")
    drives = db.relationship("Drive", back_populates="company",
                             cascade="all, delete-orphan")

    def to_dict(self, with_drives=False):
        data = {
            "id": self.id, "user_id": self.user_id, "email": self.user.email,
            "name": self.name, "hr_contact": self.hr_contact, "hr_phone": self.hr_phone,
            "website": self.website, "location": self.location, "industry": self.industry,
            "overview": self.overview, "logo_url": self.logo_url,
            "approval_status": self.approval_status,
            "is_blacklisted": self.is_blacklisted,
            "is_active": self.user.is_active,
            "drives_count": len(self.drives),
        }
        if with_drives:
            data["drives"] = [d.to_dict() for d in self.drives]
        return data


# --------------------------------------------------------------------------
# Placement Drive
# --------------------------------------------------------------------------
class Drive(db.Model):
    __tablename__ = "drives"

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False)

    drive_name = db.Column(db.String(150), nullable=False)      # "Drive 1"
    job_title = db.Column(db.String(150), nullable=False)       # "Data Scientist"
    job_description = db.Column(db.Text)

    # Eligibility criteria
    eligible_branches = db.Column(db.String(300))               # comma separated, "" == all
    min_cgpa = db.Column(db.Float, default=0.0)
    eligible_year = db.Column(db.Integer)                       # graduating year, null == any

    salary = db.Column(db.Integer, default=0)                   # annual CTC
    location = db.Column(db.String(120))
    openings = db.Column(db.Integer, default=1)
    interview_mode = db.Column(db.String(40), default="In-person")  # In-person | Online
    application_deadline = db.Column(db.Date)

    # pending -> approved (admin) -> closed (completed) ; rejected is terminal
    status = db.Column(db.String(20), default="pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    company = db.relationship("Company", back_populates="drives")
    applications = db.relationship("Application", back_populates="drive",
                                   cascade="all, delete-orphan")

    @property
    def branch_list(self):
        if not self.eligible_branches:
            return []
        return [b.strip() for b in self.eligible_branches.split(",") if b.strip()]

    def is_student_eligible(self, student: "Student"):
        """Returns (ok: bool, reason: str)."""
        if student.is_blacklisted:
            return False, "Your account has been blacklisted by the placement cell."
        if self.branch_list and student.branch not in self.branch_list:
            return False, f"Open to {', '.join(self.branch_list)} only."
        if (student.cgpa or 0) < (self.min_cgpa or 0):
            return False, f"Minimum CGPA required is {self.min_cgpa}."
        if self.eligible_year and student.grad_year != self.eligible_year:
            return False, f"Open to the {self.eligible_year} graduating batch only."
        if self.application_deadline and self.application_deadline < date.today():
            return False, "The application deadline has passed."
        if self.status != "approved":
            return False, "This drive is not open for applications."
        return True, ""

    def to_dict(self, with_company=True):
        data = {
            "id": self.id, "company_id": self.company_id,
            "drive_name": self.drive_name, "job_title": self.job_title,
            "job_description": self.job_description,
            "eligible_branches": self.eligible_branches or "",
            "branch_list": self.branch_list,
            "min_cgpa": self.min_cgpa, "eligible_year": self.eligible_year,
            "salary": self.salary, "location": self.location,
            "openings": self.openings, "interview_mode": self.interview_mode,
            "application_deadline": self.application_deadline.isoformat()
            if self.application_deadline else None,
            "status": self.status,
            "applications_count": len(self.applications),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if with_company and self.company:
            data["company_name"] = self.company.name
            data["company_logo"] = self.company.logo_url
        return data


# --------------------------------------------------------------------------
# Application
# --------------------------------------------------------------------------
class Application(db.Model):
    __tablename__ = "applications"
    __table_args__ = (db.UniqueConstraint("student_id", "drive_id", name="uq_student_drive"),)

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    drive_id = db.Column(db.Integer, db.ForeignKey("drives.id"), nullable=False)

    applied_on = db.Column(db.DateTime, default=datetime.utcnow)
    # applied | shortlisted | waiting | selected | rejected
    status = db.Column(db.String(20), default="applied")
    remark = db.Column(db.Text)
    interview_datetime = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = db.relationship("Student", back_populates="applications")
    drive = db.relationship("Drive", back_populates="applications")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "student_name": self.student.full_name,
            "student_branch": self.student.branch,
            "student_cgpa": self.student.cgpa,
            "student_email": self.student.user.email,
            "resume_url": self.student.resume_url,
            "drive_id": self.drive_id,
            "drive_name": self.drive.drive_name,
            "job_title": self.drive.job_title,
            "interview_mode": self.drive.interview_mode,
            "company_id": self.drive.company_id,
            "company_name": self.drive.company.name,
            "applied_on": self.applied_on.isoformat() if self.applied_on else None,
            "status": self.status,
            "remark": self.remark or "None",
            "interview_datetime": self.interview_datetime.isoformat()
            if self.interview_datetime else None,
        }
