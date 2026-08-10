from datetime import datetime, date

from flask import Blueprint, request, jsonify

from extensions import db, cache
from models import Drive, Application, Company
from api import role_required, current_company, err

company_bp = Blueprint("company", __name__, url_prefix="/api/company")

company_only = role_required("company")


def _guard(company):
    if company is None:
        return err("Company profile not found.", 404)
    if company.is_blacklisted:
        return err("Your company has been blacklisted by the placement cell.", 403)
    return None


def bust():
    try:
        cache.clear()
    except Exception:
        pass


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


# ------------------------------------------------------------------ dashboard
@company_bp.get("/dashboard")
@company_only
def dashboard():
    company = current_company()
    if (bad := _guard(company)):
        return bad

    drives = Drive.query.filter_by(company_id=company.id) \
        .order_by(Drive.created_at.desc()).all()
    return jsonify({
        "company": company.to_dict(),
        "upcoming_drives": [d.to_dict() for d in drives
                            if d.status in ("pending", "approved")],
        "closed_drives": [d.to_dict() for d in drives if d.status == "closed"],
        "rejected_drives": [d.to_dict() for d in drives if d.status == "rejected"],
        "total_applications": sum(len(d.applications) for d in drives),
    })


@company_bp.put("/profile")
@company_only
def update_profile():
    company = current_company()
    if (bad := _guard(company)):
        return bad
    d = request.get_json() or {}
    for field in ("name", "hr_contact", "hr_phone", "website", "location",
                  "industry", "overview", "logo_url"):
        if field in d:
            setattr(company, field, d[field])
    db.session.commit()
    bust()
    return jsonify(message="Profile updated.", company=company.to_dict())


# --------------------------------------------------------------------- drives
@company_bp.post("/drives")
@company_only
def create_drive():
    company = current_company()
    if (bad := _guard(company)):
        return bad
    if company.approval_status != "approved":
        return err("Your company must be approved by the placement cell "
                   "before you can create drives.", 403)

    d = request.get_json() or {}
    if not d.get("drive_name") or not d.get("job_title"):
        return err("Drive name and job title are required.")

    deadline = _parse_date(d.get("application_deadline"))
    if deadline and deadline < date.today():
        return err("The application deadline cannot be in the past.")

    drive = Drive(
        company_id=company.id,
        drive_name=d["drive_name"],
        job_title=d["job_title"],
        job_description=d.get("job_description"),
        eligible_branches=d.get("eligible_branches"),
        min_cgpa=float(d.get("min_cgpa") or 0),
        eligible_year=int(d["eligible_year"]) if d.get("eligible_year") else None,
        salary=int(d.get("salary") or 0),
        location=d.get("location"),
        openings=int(d.get("openings") or 1),
        interview_mode=d.get("interview_mode") or "In-person",
        application_deadline=deadline,
        status="pending",
    )
    db.session.add(drive)
    db.session.commit()
    bust()
    return jsonify(message="Drive created and sent to the placement cell for approval.",
                   drive=drive.to_dict()), 201


@company_bp.get("/drives/<int:did>")
@company_only
def drive_detail(did):
    company = current_company()
    drive = Drive.query.filter_by(id=did, company_id=company.id).first_or_404()
    return jsonify(drive=drive.to_dict(),
                   applications=[a.to_dict() for a in sorted(
                       drive.applications, key=lambda a: a.applied_on, reverse=True)])


@company_bp.put("/drives/<int:did>")
@company_only
def update_drive(did):
    company = current_company()
    drive = Drive.query.filter_by(id=did, company_id=company.id).first_or_404()
    if drive.status == "closed":
        return err("A completed drive can no longer be edited.", 409)

    d = request.get_json() or {}
    for field in ("drive_name", "job_title", "job_description", "eligible_branches",
                  "location", "interview_mode"):
        if field in d:
            setattr(drive, field, d[field])
    if "min_cgpa" in d:
        drive.min_cgpa = float(d["min_cgpa"] or 0)
    if "salary" in d:
        drive.salary = int(d["salary"] or 0)
    if "openings" in d:
        drive.openings = int(d["openings"] or 1)
    if "eligible_year" in d:
        drive.eligible_year = int(d["eligible_year"]) if d["eligible_year"] else None
    if "application_deadline" in d:
        drive.application_deadline = _parse_date(d["application_deadline"])

    # Editing an approved drive sends it back for re-approval.
    if drive.status == "approved":
        drive.status = "pending"
    db.session.commit()
    bust()
    return jsonify(message="Drive updated and resubmitted for approval.",
                   drive=drive.to_dict())


@company_bp.post("/drives/<int:did>/close")
@company_only
def close_drive(did):
    company = current_company()
    drive = Drive.query.filter_by(id=did, company_id=company.id).first_or_404()
    drive.status = "closed"
    db.session.commit()
    bust()
    return jsonify(message=f"{drive.drive_name} marked as complete.",
                   drive=drive.to_dict())


@company_bp.post("/drives/<int:did>/reopen")
@company_only
def reopen_drive(did):
    company = current_company()
    drive = Drive.query.filter_by(id=did, company_id=company.id).first_or_404()
    if drive.status != "closed":
        return err("Only completed drives can be reopened.", 409)
    drive.status = "pending"
    db.session.commit()
    bust()
    return jsonify(message="Drive reopened and sent for re-approval.",
                   drive=drive.to_dict())


# --------------------------------------------------------------- applications
@company_bp.get("/applications/<int:aid>")
@company_only
def application_detail(aid):
    company = current_company()
    app_row = Application.query.join(Drive).filter(
        Application.id == aid, Drive.company_id == company.id).first_or_404()
    return jsonify(application=app_row.to_dict())


@company_bp.put("/applications/<int:aid>")
@company_only
def review_application(aid):
    """Shortlist / waiting / select / reject + interview scheduling + remark."""
    company = current_company()
    app_row = Application.query.join(Drive).filter(
        Application.id == aid, Drive.company_id == company.id).first_or_404()

    d = request.get_json() or {}
    status = d.get("status")
    allowed = ("applied", "shortlisted", "waiting", "selected", "rejected")
    if status and status not in allowed:
        return err(f"status must be one of {', '.join(allowed)}.")
    if status:
        app_row.status = status
    if "remark" in d:
        app_row.remark = d["remark"]
    if "interview_datetime" in d:
        raw = d["interview_datetime"]
        if raw:
            try:
                app_row.interview_datetime = datetime.fromisoformat(raw)
            except ValueError:
                return err("interview_datetime must be ISO format, e.g. 2026-09-01T10:30")
        else:
            app_row.interview_datetime = None

    db.session.commit()
    bust()
    return jsonify(message="Application updated.", application=app_row.to_dict())


@company_bp.put("/applications/bulk")
@company_only
def bulk_review():
    """The wireframe's 'save' button on the review screen."""
    company = current_company()
    items = (request.get_json() or {}).get("items") or []
    updated = 0
    for item in items:
        row = Application.query.join(Drive).filter(
            Application.id == item.get("id"),
            Drive.company_id == company.id).first()
        if not row:
            continue
        if item.get("status"):
            row.status = item["status"]
        if "remark" in item:
            row.remark = item["remark"]
        updated += 1
    db.session.commit()
    bust()
    return jsonify(message=f"{updated} application(s) updated.")
