from datetime import date

from flask import Blueprint, request, jsonify
from sqlalchemy import or_

from extensions import db, cache
from models import Drive, Application, Company, Student
from api import role_required, current_student, err

student_bp = Blueprint("student", __name__, url_prefix="/api/student")

student_only = role_required("student")


def _guard(student):
    if student is None:
        return err("Student profile not found.", 404)
    if student.is_blacklisted:
        return err("Your account has been blacklisted by the placement cell.", 403)
    return None


# ------------------------------------------------------------------ dashboard
@student_bp.get("/dashboard")
@student_only
def dashboard():
    student = current_student()
    if (bad := _guard(student)):
        return bad

    companies = Company.query.filter_by(approval_status="approved",
                                        is_blacklisted=False) \
        .order_by(Company.name).all()
    apps = sorted(student.applications, key=lambda a: a.applied_on, reverse=True)

    return jsonify({
        "profile": student.to_dict(),
        "organizations": [c.to_dict() for c in companies],
        "applied_drives": [a.to_dict() for a in apps],
        "open_drives_count": Drive.query.filter_by(status="approved").count(),
    })


@student_bp.put("/profile")
@student_only
def update_profile():
    student = current_student()
    if (bad := _guard(student)):
        return bad
    d = request.get_json() or {}
    for field in ("full_name", "roll_number", "branch", "phone", "resume_url", "about"):
        if field in d:
            setattr(student, field, d[field])
    if "cgpa" in d:
        try:
            cgpa = float(d["cgpa"] or 0)
        except ValueError:
            return err("CGPA must be a number.")
        if not 0 <= cgpa <= 10:
            return err("CGPA must be between 0 and 10.")
        student.cgpa = cgpa
    if "grad_year" in d:
        student.grad_year = int(d["grad_year"]) if d["grad_year"] else None
    db.session.commit()
    try:
        cache.clear()
    except Exception:
        pass
    return jsonify(message="Profile updated.", profile=student.to_dict())


# --------------------------------------------------------------------- drives
@student_bp.get("/drives")
@student_only
def list_drives():
    """All approved drives, annotated with eligibility + whether already applied."""
    student = current_student()
    if (bad := _guard(student)):
        return bad

    q = Drive.query.filter_by(status="approved")
    if company_id := request.args.get("company_id"):
        q = q.filter_by(company_id=int(company_id))
    if term := (request.args.get("q") or "").strip():
        like = f"%{term}%"
        q = q.filter(or_(Drive.drive_name.ilike(like), Drive.job_title.ilike(like)))

    applied = {a.drive_id: a.status for a in student.applications}
    out = []
    for drive in q.order_by(Drive.application_deadline).all():
        if drive.company.is_blacklisted:
            continue
        item = drive.to_dict()
        eligible, reason = drive.is_student_eligible(student)
        item["eligible"] = eligible
        item["ineligible_reason"] = reason
        item["applied"] = drive.id in applied
        item["application_status"] = applied.get(drive.id)
        out.append(item)
    return jsonify(drives=out)


@student_bp.get("/drives/<int:did>")
@student_only
def drive_detail(did):
    student = current_student()
    if (bad := _guard(student)):
        return bad
    drive = Drive.query.get_or_404(did)
    if drive.status not in ("approved", "closed"):
        return err("This drive is not available.", 404)

    item = drive.to_dict()
    eligible, reason = drive.is_student_eligible(student)
    existing = Application.query.filter_by(student_id=student.id,
                                           drive_id=drive.id).first()
    item["eligible"] = eligible
    item["ineligible_reason"] = reason
    item["applied"] = existing is not None
    item["application_status"] = existing.status if existing else None
    item["company"] = drive.company.to_dict()
    return jsonify(drive=item)


@student_bp.get("/organizations/<int:cid>")
@student_only
def organization_detail(cid):
    student = current_student()
    if (bad := _guard(student)):
        return bad
    company = Company.query.filter_by(id=cid, approval_status="approved").first_or_404()
    applied = {a.drive_id for a in student.applications}
    drives = []
    for drive in company.drives:
        if drive.status != "approved":
            continue
        item = drive.to_dict()
        item["applied"] = drive.id in applied
        drives.append(item)
    return jsonify(company=company.to_dict(), drives=drives)


# ---------------------------------------------------------------- application
@student_bp.post("/drives/<int:did>/apply")
@student_only
def apply(did):
    student = current_student()
    if (bad := _guard(student)):
        return bad
    drive = Drive.query.get_or_404(did)

    if Application.query.filter_by(student_id=student.id, drive_id=drive.id).first():
        return err("You have already applied to this drive.", 409)

    eligible, reason = drive.is_student_eligible(student)
    if not eligible:
        return err(reason or "You are not eligible for this drive.", 403)

    row = Application(student_id=student.id, drive_id=drive.id, status="applied")
    db.session.add(row)
    db.session.commit()
    return jsonify(message=f"Applied to {drive.drive_name} successfully.",
                   application=row.to_dict()), 201


@student_bp.delete("/applications/<int:aid>")
@student_only
def withdraw(aid):
    student = current_student()
    row = Application.query.filter_by(id=aid, student_id=student.id).first_or_404()
    if row.status in ("selected", "shortlisted"):
        return err("You cannot withdraw once you have been shortlisted or selected.", 409)
    db.session.delete(row)
    db.session.commit()
    return jsonify(message="Application withdrawn.")


@student_bp.get("/history")
@student_only
def history():
    """Powers the 'Student Application History' screen in the wireframe."""
    student = current_student()
    if (bad := _guard(student)):
        return bad
    rows = sorted(student.applications, key=lambda a: a.applied_on, reverse=True)
    return jsonify(profile=student.to_dict(),
                   history=[a.to_dict() for a in rows],
                   summary={
                       "total": len(rows),
                       "shortlisted": sum(1 for a in rows if a.status == "shortlisted"),
                       "selected": sum(1 for a in rows if a.status == "selected"),
                       "rejected": sum(1 for a in rows if a.status == "rejected"),
                   })
