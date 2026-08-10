from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from extensions import db
from models import User, Student, Company
from api import err, current_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _profile_payload(user: User):
    """Everything the SPA needs right after login."""
    data = {"user": user.to_dict()}
    if user.role == "student" and user.student:
        data["profile"] = user.student.to_dict()
    elif user.role == "company" and user.company:
        data["profile"] = user.company.to_dict()
    else:
        data["profile"] = {"full_name": "Admin", "name": "Placement Cell"}
    return data


@auth_bp.post("/register")
def register():
    """Students and companies self-register. Admin is seeded, never registered."""
    d = request.get_json() or {}
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    role = d.get("role")

    if not email or not password:
        return err("Email and password are required.")
    if role not in ("student", "company"):
        return err("Role must be either 'student' or 'company'.")
    if len(password) < 6:
        return err("Password must be at least 6 characters long.")
    if User.query.filter_by(email=email).first():
        return err("An account with this email already exists.", 409)

    user = User(email=email, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    if role == "student":
        if not d.get("full_name"):
            return err("Full name is required.")
        if d.get("roll_number") and Student.query.filter_by(
                roll_number=d["roll_number"]).first():
            return err("That roll number is already registered.", 409)
        db.session.add(Student(
            user_id=user.id,
            full_name=d["full_name"],
            roll_number=d.get("roll_number"),
            branch=d.get("branch"),
            cgpa=float(d.get("cgpa") or 0),
            grad_year=int(d["grad_year"]) if d.get("grad_year") else None,
            phone=d.get("phone"),
            resume_url=d.get("resume_url"),
            about=d.get("about"),
        ))
        msg = "Registration successful. You can log in now."
    else:
        if not d.get("name"):
            return err("Company name is required.")
        db.session.add(Company(
            user_id=user.id,
            name=d["name"],
            hr_contact=d.get("hr_contact"),
            hr_phone=d.get("hr_phone"),
            website=d.get("website"),
            location=d.get("location"),
            industry=d.get("industry"),
            overview=d.get("overview"),
            logo_url=d.get("logo_url"),
            approval_status="pending",
        ))
        msg = ("Registration submitted. Your company profile is pending approval "
               "from the placement cell.")

    db.session.commit()
    return jsonify(message=msg), 201


@auth_bp.post("/login")
def login():
    d = request.get_json() or {}
    email = (d.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(d.get("password") or ""):
        return err("Invalid email or password.", 401)
    if not user.is_active:
        return err("Your account has been deactivated by the placement cell.", 403)
    if user.role == "student" and user.student and user.student.is_blacklisted:
        return err("Your account has been blacklisted by the placement cell.", 403)
    if user.role == "company" and user.company and user.company.is_blacklisted:
        return err("Your company has been blacklisted by the placement cell.", 403)

    token = create_access_token(identity=str(user.id),
                                additional_claims={"role": user.role})
    payload = _profile_payload(user)
    payload["access_token"] = token
    return jsonify(payload), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user = current_user()
    if not user:
        return err("User not found.", 404)
    return jsonify(_profile_payload(user)), 200
