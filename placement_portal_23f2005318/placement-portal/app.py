import os

from flask import Flask, render_template, jsonify
from flask_cors import CORS

from config import Config
from extensions import db, jwt, cache


def create_app(config_class=Config):
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config.from_object(config_class)

    os.makedirs(os.path.join(app.root_path, "instance"), exist_ok=True)
    os.makedirs(app.config["REPORTS_DIR"], exist_ok=True)

    db.init_app(app)
    jwt.init_app(app)
    CORS(app)

    # Redis cache, with a safe in-memory fallback so the app boots without Redis.
    try:
        cache.init_app(app)
        with app.app_context():
            cache.set("__ping__", 1, timeout=5)
    except Exception as exc:  # pragma: no cover
        app.logger.warning("Redis unavailable (%s) - falling back to SimpleCache.", exc)
        cache.init_app(app, config={"CACHE_TYPE": "SimpleCache",
                                    "CACHE_DEFAULT_TIMEOUT": 60})

    # Blueprints
    from api.auth import auth_bp
    from api.admin import admin_bp
    from api.company import company_bp
    from api.student import student_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(company_bp)
    app.register_blueprint(student_bp)

    # ---- Jinja2 entry point (the ONLY template; the UI itself is Vue) ----
    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/health")
    def health():
        from models import User
        redis_ok = True
        try:
            cache.set("__ping__", 1, timeout=5)
        except Exception:
            redis_ok = False
        return jsonify(status="ok", users=User.query.count(), redis=redis_ok)

    # ---- Error handlers: always return JSON for the API ----
    @app.errorhandler(404)
    def not_found(e):
        return jsonify(message="Resource not found."), 404

    @app.errorhandler(500)
    def server_error(e):  # pragma: no cover
        db.session.rollback()
        return jsonify(message="Internal server error."), 500

    @jwt.expired_token_loader
    def expired(header, payload):
        return jsonify(message="Session expired. Please log in again."), 401

    @jwt.unauthorized_loader
    def missing(reason):
        return jsonify(message="Authentication required."), 401

    @jwt.invalid_token_loader
    def invalid(reason):
        return jsonify(message="Invalid token."), 401

    # ---- Create tables + seed the admin superuser on first boot ----
    with app.app_context():
        import models  # noqa: F401
        db.create_all()
        from seed import ensure_admin
        ensure_admin()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
