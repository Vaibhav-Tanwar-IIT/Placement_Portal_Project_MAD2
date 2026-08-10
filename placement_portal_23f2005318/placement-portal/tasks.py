"""Celery batch jobs.

1. daily_student_reminders  - evening nudge about drives closing soon / not applied to
2. monthly_placement_report - monthly activity + placement report for the admin
"""
import os
import sys
from datetime import date, timedelta, datetime

# Keep the project root importable regardless of how the worker was launched.
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from celery_app import celery
from config import Config
from mailer import send_email

REMINDER_WINDOW_DAYS = 7


def _flask_app():
    """Import the Flask app lazily so Celery never triggers a circular import.

    The path guard is repeated here because the Celery worker resets sys.path
    after bootstrapping, which would otherwise break `import app` inside a task.
    """
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)
    from app import app
    return app


# --------------------------------------------------------------------------
# 1. Daily reminders
# --------------------------------------------------------------------------
@celery.task(name="tasks.daily_student_reminders")
def daily_student_reminders():
    app = _flask_app()
    with app.app_context():
        from models import Student, Drive

        today = date.today()
        cutoff = today + timedelta(days=REMINDER_WINDOW_DAYS)

        open_drives = Drive.query.filter(
            Drive.status == "approved",
            Drive.application_deadline != None,          # noqa: E711
            Drive.application_deadline >= today,
            Drive.application_deadline <= cutoff,
        ).order_by(Drive.application_deadline).all()

        if not open_drives:
            return {"sent": 0, "reason": "no drives closing in the next "
                                         f"{REMINDER_WINDOW_DAYS} days"}

        sent = 0
        for student in Student.query.filter_by(is_blacklisted=False).all():
            if not student.user.is_active:
                continue
            applied_ids = {a.drive_id for a in student.applications}
            pending = []
            for drive in open_drives:
                if drive.id in applied_ids or drive.company.is_blacklisted:
                    continue
                eligible, _ = drive.is_student_eligible(student)
                if eligible:
                    pending.append(drive)
            if not pending:
                continue

            rows = "".join(
                f"<tr><td>{d.company.name}</td><td>{d.drive_name}</td>"
                f"<td>{d.job_title}</td>"
                f"<td>{d.application_deadline.strftime('%d %b %Y')}</td>"
                f"<td>{(d.application_deadline - today).days} day(s)</td></tr>"
                for d in pending
            )
            html = f"""
            <div style="font-family:Segoe UI,Arial,sans-serif;color:#20304a">
              <h2 style="color:#0d6efd">Placement drives closing soon</h2>
              <p>Hi {student.full_name}, you are eligible for
                 <b>{len(pending)}</b> drive(s) you have not applied to yet.</p>
              <table border="1" cellpadding="8" cellspacing="0"
                     style="border-collapse:collapse;font-size:14px">
                <tr style="background:#eef4ff">
                  <th>Company</th><th>Drive</th><th>Role</th>
                  <th>Deadline</th><th>Time left</th>
                </tr>
                {rows}
              </table>
              <p style="margin-top:18px">
                <a href="http://localhost:5000/#/student/drives"
                   style="background:#0d6efd;color:#fff;padding:10px 18px;
                          border-radius:6px;text-decoration:none">
                  Open the placement portal</a>
              </p>
              <p style="color:#7a869a;font-size:12px">
                Institute Placement Cell &middot; automated reminder</p>
            </div>"""
            send_email(student.user.email,
                       f"{len(pending)} placement drive(s) closing soon", html)
            sent += 1

        return {"sent": sent, "drives_considered": len(open_drives),
                "run_at": datetime.now().isoformat(timespec="seconds")}


# --------------------------------------------------------------------------
# 2. Monthly placement report
# --------------------------------------------------------------------------
@celery.task(name="tasks.monthly_placement_report")
def monthly_placement_report(month=None, year=None):
    app = _flask_app()
    with app.app_context():
        from sqlalchemy import func
        from extensions import db
        from models import Student, Company, Drive, Application

        today = date.today()
        last_day_prev = today.replace(day=1) - timedelta(days=1)
        month = month or last_day_prev.month
        year = year or last_day_prev.year
        start = date(year, month, 1)
        end = (start + timedelta(days=32)).replace(day=1)
        label = start.strftime("%B %Y")

        new_apps = Application.query.filter(
            Application.applied_on >= start, Application.applied_on < end).all()
        new_drives = Drive.query.filter(
            Drive.created_at >= start, Drive.created_at < end).all()
        new_companies = Company.query.filter(
            Company.created_at >= start, Company.created_at < end).all()
        selected = [a for a in new_apps if a.status == "selected"]

        total_students = Student.query.count()
        placed_all_time = db.session.query(
            func.count(func.distinct(Application.student_id))
        ).filter(Application.status == "selected").scalar() or 0

        top = db.session.query(Company.name, func.count(Application.id)) \
            .join(Drive, Drive.company_id == Company.id) \
            .join(Application, Application.drive_id == Drive.id) \
            .filter(Application.status == "selected") \
            .group_by(Company.name) \
            .order_by(func.count(Application.id).desc()).limit(5).all()

        def card(title, value):
            return (f'<td style="padding:14px 20px;border:1px solid #dbe3ef;'
                    f'border-radius:8px;text-align:center">'
                    f'<div style="font-size:26px;font-weight:700;color:#0d6efd">{value}</div>'
                    f'<div style="font-size:12px;color:#7a869a">{title}</div></td>')

        top_rows = "".join(
            f"<tr><td>{i}</td><td>{n}</td><td>{c}</td></tr>"
            for i, (n, c) in enumerate(top, 1)) or \
            '<tr><td colspan="3">No selections recorded yet.</td></tr>'

        rate = round(placed_all_time * 100.0 / total_students, 1) if total_students else 0

        html = f"""
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#20304a">
          <h2 style="color:#0d6efd">Monthly Placement Report &mdash; {label}</h2>
          <table cellspacing="8"><tr>
            {card("New applications", len(new_apps))}
            {card("New drives", len(new_drives))}
            {card("New companies", len(new_companies))}
            {card("Students selected", len(selected))}
          </tr></table>

          <h3>Overall position</h3>
          <ul>
            <li>Registered students: <b>{total_students}</b></li>
            <li>Students placed (all time): <b>{placed_all_time}</b></li>
            <li>Placement rate: <b>{rate}%</b></li>
            <li>Approved companies:
                <b>{Company.query.filter_by(approval_status='approved').count()}</b></li>
            <li>Drives awaiting approval:
                <b>{Drive.query.filter_by(status='pending').count()}</b></li>
          </ul>

          <h3>Top recruiters</h3>
          <table border="1" cellpadding="8" cellspacing="0"
                 style="border-collapse:collapse;font-size:14px">
            <tr style="background:#eef4ff"><th>#</th><th>Company</th><th>Hires</th></tr>
            {top_rows}
          </table>

          <p style="color:#7a869a;font-size:12px;margin-top:20px">
            Generated on {datetime.now().strftime('%d %b %Y, %I:%M %p')} by the
            Institute Placement Portal.</p>
        </div>"""

        os.makedirs(Config.REPORTS_DIR, exist_ok=True)
        filename = os.path.join(Config.REPORTS_DIR,
                                f"placement-report-{year}-{month:02d}.html")
        with open(filename, "w", encoding="utf-8") as fh:
            fh.write(html)

        delivered, _ = send_email(Config.ADMIN_EMAIL,
                                  f"Monthly Placement Report - {label}", html)

        return {"month": label, "file": filename, "emailed": delivered,
                "new_applications": len(new_apps), "selected": len(selected)}
