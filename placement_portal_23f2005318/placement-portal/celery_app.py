"""Celery entry point.

Run the worker:  celery -A celery_app.celery worker --loglevel=info
Run the beat  :  celery -A celery_app.celery beat   --loglevel=info
"""
import os
import sys

# Make sure the project root is importable no matter where celery is launched from.
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from celery import Celery
from celery.schedules import crontab

from config import Config

celery = Celery(
    "placement_portal",
    broker=Config.CELERY_BROKER_URL,
    backend=Config.CELERY_RESULT_BACKEND,
    include=["tasks"],
)

celery.conf.update(
    timezone=Config.CELERY_TIMEZONE,
    enable_utc=False,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    beat_schedule={
        # Every evening at 18:00 IST: nudge students about drives closing soon.
        "daily-student-reminders": {
            "task": "tasks.daily_student_reminders",
            "schedule": crontab(hour=18, minute=0),
        },
        # 1st of every month at 08:00 IST: placement report to the admin.
        "monthly-placement-report": {
            "task": "tasks.monthly_placement_report",
            "schedule": crontab(day_of_month=1, hour=8, minute=0),
        },
    },
)
