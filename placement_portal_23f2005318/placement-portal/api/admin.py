from datetime import date

from flask import Blueprint, request, jsonify
from sqlalchemy import or_, func

from extensions import db, cache
from models import User, Student, Company, Drive, Application
from api import role_required, err

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

admin_only = role_required("admin")


def bust():
    """Admin writes change what everybody sees, so clear the cache."""
    try:
        cache.clear()
    except Exception:
        pass


# ------------------------------------------------------------------ dashboard
@admin_bp.get("/dashboard")
@admin_only
def dashboard():
    return jsonify({
        "companies": [c.to_dict() for c in Company.query
                      .filter_by(approval_status="approved")
                      .order_by(Company.name).all()],
        "pending_companies": [c.to_dict() for c in Company.query
                              .filter_by(approval_status="pending")
                              .order_by(Company.created_at.desc()).all()],
        "students": [s.to_dict() for s in Student.query
                     .order_by(Student.full_name).all()],
        "pending_drives": [d.to_dict() for d in Drive.query
                           .filter_by(status="pending")
                           .order_by(Drive.created_at.desc()).all()],
        "ongoing_drives": [d.to_dict() for d in Drive.query
                           .filter_by(status="approved")
                           .order_by(Drive.application_deadline).all()],
        "closed_drives": [d.to_dict() for d in Drive.query
                          .filter_by(status="closed")
                          .order_by(Drive.created_at.desc()).all()],
        "applications": [a.to_dict() for a in Application.query
                         .order_by(Application.applied_on.desc()).limit(100).all()],
    })


# --------------------------------------------------------------------- search
@admin_bp.get("/search")
@admin_only
def search():
    """Single search box on the admin dashboard: students + organisations."""
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify(students=[], companies=[], drives=[])
    like = f"%{q}%"
    students = Student.query.join(User).filter(or_(
        Student.full_name.ilike(like), Student.roll_number.ilike(like),
        Student.branch.ilike(like), User.email.ilike(like))).limit(50).all()
    companies = Company.query.join(User).filter(or_(
        Company.name.ilike(like), Company.industry.ilike(like),
        Company.location.ilike(like), User.email.ilike(like))).limit(50).all()
    drives = Drive.query.filter(or_(
        Drive.drive_name.ilike(like), Drive.job_title.ilike(like))).limit(50).all()
    return jsonify(students=[s.to_dict() for s in students],
                   companies=[c.to_dict() for c in companies],
                   drives=[d.to_dict() for d in drives])


# ----------------------------------------------------------- company approval
@admin_bp.post("/companies/<int:cid>/approval")
@admin_only
def company_approval(cid):
    company = Company.query.get_or_404(cid)
    decision = (request.get_json() or {}).get("decision")
    if decision not in ("approved", "rejected"):
        return err("decision must be 'approved' or 'rejected'.")
    company.approval_status = decision
    db.session.commit()
    bust()
    return jsonify(message=f"{company.name} {decision}.", company=company.to_dict())


@admin_bp.post("/companies/<int:cid>/blacklist")
@admin_only
def company_blacklist(cid):
    """Blacklisting a company also cancels every drive it owns (per wireframe note)."""
    company = Company.query.get_or_404(cid)
    flag = bool((request.get_json() or {}).get("blacklist", True))
    company.is_blacklisted = flag
    company.user.is_active = not flag
    if flag:
        for d in company.drives:
            if d.status in ("pending", "approved"):
                d.status = "rejected"
    db.session.commit()
    bust()
    word = "blacklisted" if flag else "reinstated"
    return jsonify(message=f"{company.name} has been {word}.",
                   company=company.to_dict())


# ----------------------------------------------------------------- students
@admin_bp.post("/students/<int:sid>/blacklist")
@admin_only
def student_blacklist(sid):
    student = Student.query.get_or_404(sid)
    flag = bool((request.get_json() or {}).get("blacklist", True))
    student.is_blacklisted = flag
    student.user.is_active = not flag
    db.session.commit()
    bust()
    word = "blacklisted" if flag else "reinstated"
    return jsonify(message=f"{student.full_name} has been {word}.",
                   student=student.to_dict())


@admin_bp.get("/students/<int:sid>")
@admin_only
def student_detail(sid):
    student = Student.query.get_or_404(sid)
    return jsonify(student=student.to_dict(),
                   applications=[a.to_dict() for a in student.applications])


@admin_bp.get("/companies/<int:cid>")
@admin_only
def company_detail(cid):
    company = Company.query.get_or_404(cid)
    return jsonify(company=company.to_dict(with_drives=True))


# -------------------------------------------------------------------- drives
@admin_bp.post("/drives/<int:did>/approval")
@admin_only
def drive_approval(did):
    drive = Drive.query.get_or_404(did)
    decision = (request.get_json() or {}).get("decision")
    if decision not in ("approved", "rejected"):
        return err("decision must be 'approved' or 'rejected'.")
    if drive.company.approval_status != "approved":
        return err("The owning company is not approved yet.", 409)
    drive.status = decision
    db.session.commit()
    bust()
    return jsonify(message=f"{drive.drive_name} {decision}.", drive=drive.to_dict())


@admin_bp.post("/drives/<int:did>/close")
@admin_only
def drive_close(did):
    drive = Drive.query.get_or_404(did)
    drive.status = "closed"
    db.session.commit()
    bust()
    return jsonify(message=f"{drive.drive_name} marked as complete.",
                   drive=drive.to_dict())


@admin_bp.get("/drives/<int:did>")
@admin_only
def drive_detail(did):
    drive = Drive.query.get_or_404(did)
    return jsonify(drive=drive.to_dict(),
                   applications=[a.to_dict() for a in drive.applications])


# ------------------------------------------------------------------- reports
@admin_bp.get("/stats")
@admin_only
@cache.cached(timeout=60, key_prefix="admin_stats")
def stats():
    total_students = Student.query.count()
    placed = db.session.query(func.count(func.distinct(Application.student_id))) \
        .filter(Application.status == "selected").scalar() or 0
    by_status = dict(db.session.query(Application.status, func.count(Application.id))
                     .group_by(Application.status).all())

    top_companies = db.session.query(Company.name, func.count(Application.id)) \
        .join(Drive, Drive.company_id == Company.id) \
        .join(Application, Application.drive_id == Drive.id) \
        .filter(Application.status == "selected") \
        .group_by(Company.name).order_by(func.count(Application.id).desc()) \
        .limit(10).all()

    by_branch = db.session.query(
        Student.branch,
        func.count(func.distinct(Student.id))
    ).join(Application, Application.student_id == Student.id) \
        .filter(Application.status == "selected") \
        .group_by(Student.branch).all()

    salaries = [d.salary for d in Drive.query.filter(Drive.salary > 0).all()]

    return jsonify({
        "generated_on": date.today().isoformat(),
        "total_students": total_students,
        "total_companies": Company.query.filter_by(approval_status="approved").count(),
        "pending_companies": Company.query.filter_by(approval_status="pending").count(),
        "total_drives": Drive.query.count(),
        "open_drives": Drive.query.filter_by(status="approved").count(),
        "pending_drives": Drive.query.filter_by(status="pending").count(),
        "total_applications": Application.query.count(),
        "students_placed": placed,
        "placement_rate": round(placed * 100.0 / total_students, 1) if total_students else 0,
        "applications_by_status": by_status,
        "top_recruiters": [{"company": n, "hires": c} for n, c in top_companies],
        "placed_by_branch": [{"branch": b or "N/A", "count": c} for b, c in by_branch],
        "highest_ctc": max(salaries) if salaries else 0,
        "average_ctc": round(sum(salaries) / len(salaries)) if salaries else 0,
    })


@admin_bp.post("/reports/monthly")
@admin_only
def trigger_monthly_report():
    """Kick off the Celery monthly report job on demand."""
    from tasks import monthly_placement_report
    try:
        job = monthly_placement_report.delay()
        return jsonify(message="Monthly report job queued.", task_id=job.id), 202
    except Exception as exc:
        return err(f"Could not reach the Celery broker: {exc}", 503)


@admin_bp.post("/reports/reminders")
@admin_only
def trigger_reminders():
    from tasks import daily_student_reminders
    try:
        job = daily_student_reminders.delay()
        return jsonify(message="Daily reminder job queued.", task_id=job.id), 202
    except Exception as exc:
        return err(f"Could not reach the Celery broker: {exc}", 503)
