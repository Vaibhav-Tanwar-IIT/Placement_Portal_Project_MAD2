"""API package: blueprints + shared helpers."""
from functools import wraps

from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity

from models import User, Student, Company


def role_required(*roles):
    """Decorator: require a valid JWT whose role is in `roles`."""
    def wrapper(fn):
        @wraps(fn)
        def decorated(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if roles and claims.get("role") not in roles:
                return jsonify(message="Forbidden: insufficient privileges"), 403
            user = User.query.get(int(get_jwt_identity()))
            if not user or not user.is_active:
                return jsonify(message="Account is deactivated. Contact the placement cell."), 403
            return fn(*args, **kwargs)
        return decorated
    return wrapper


def current_user():
    return User.query.get(int(get_jwt_identity()))


def current_student():
    return Student.query.filter_by(user_id=int(get_jwt_identity())).first()


def current_company():
    return Company.query.filter_by(user_id=int(get_jwt_identity())).first()


def ok(payload=None, **kw):
    data = payload if payload is not None else {}
    if isinstance(data, dict):
        data.update(kw)
    return jsonify(data), 200


def err(message, code=400):
    return jsonify(message=message), code
