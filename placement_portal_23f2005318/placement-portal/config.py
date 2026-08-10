import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    # --- Core ---
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 12  # 12 hours

    # --- Database (SQLite only) ---
    SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(BASE_DIR, "instance", "placement.sqlite3")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- Redis ---
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # --- Flask-Caching (Redis) ---
    CACHE_TYPE = "RedisCache"
    CACHE_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/1")
    CACHE_DEFAULT_TIMEOUT = 60

    # --- Celery ---
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/2")
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/3")
    CELERY_TIMEZONE = "Asia/Kolkata"

    # --- Mail (MailHog by default; failures are logged, never fatal) ---
    SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 1025))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    MAIL_SENDER = os.getenv("MAIL_SENDER", "placement-cell@institute.edu")
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@institute.edu")

    # Where generated reports / exports are written
    REPORTS_DIR = os.path.join(BASE_DIR, "reports")
