# Institute Placement Portal

A campus placement management application for an Institute Placement Cell, companies and students.

Built with **Flask** (REST API), **Vue 3 via CDN** (UI), **Bootstrap 5** (styling), **SQLite** (database),
**Redis** (caching) and **Celery + Redis** (scheduled batch jobs).

---

## Folder structure

```
placement-portal/
├── app.py                 # Flask app factory + entry point
├── config.py              # All configuration (paths, Redis URLs, JWT, schedules)
├── extensions.py          # db, jwt, cache objects (avoids circular imports)
├── models.py              # SQLAlchemy models: User, Student, Company, Drive, Application
├── seed.py                # Creates tables, the admin user, and optional demo data
├── mailer.py              # Sends email via SMTP + always saves a copy to reports/outbox/
├── celery_app.py          # Celery instance + beat schedule
├── tasks.py               # The two batch jobs
├── test_api.py            # 32-check smoke test suite against a running server
├── requirements.txt
│
├── api/                   # REST API, one blueprint per role
│   ├── __init__.py        # role_required decorator + shared helpers
│   ├── auth.py            # register / login / me
│   ├── admin.py           # approvals, blacklisting, search, stats, job triggers
│   ├── company.py         # drives, applications, profile
│   └── student.py         # drives, apply/withdraw, history, profile
│
├── templates/
│   └── index.html         # The ONLY Jinja2 template — just the SPA entry point
│
├── static/
│   ├── css/style.css      # Small amount of custom CSS on top of Bootstrap
│   └── js/
│       ├── api.js         # fetch() wrapper that attaches the JWT
│       ├── store.js       # Shared reactive state + formatting helpers
│       ├── components.js  # 6 reusable components (status-badge, stat-card, …)
│       ├── router.js      # Vue Router routes + role guards
│       ├── app.js         # Creates and mounts the Vue app
│       └── pages/
│           ├── auth.js    # Login + Register
│           ├── admin.js   # Admin dashboard, reports, detail pages
│           ├── company.js # Company dashboard, create drive, review applications
│           └── student.js # Student dashboard, browse drives, history, profile
│
├── instance/
│   └── placement.sqlite3  # The SQLite database (auto-created)
└── reports/               # Generated monthly reports
    └── outbox/            # Every email the app "sends" is saved here as HTML
```

---

## Setup

Requires Python 3.10+ and a Redis server.

```bash
# 1. Install Redis
sudo apt-get install -y redis-server     # Debian / Ubuntu
brew install redis                       # macOS

# 2. Create a virtual environment and install dependencies
python -m venv .venv
source .venv/bin/activate                # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Create the database (also creates the admin user)
python seed.py --demo                    # --demo also loads sample data
```

---

## Running

Four processes. Open a terminal for each (Redis usually runs as a service already).

```bash
redis-server                                          # 1. Redis  :6379
python app.py                                         # 2. Flask  :5000
celery -A celery_app.celery worker --loglevel=info    # 3. Celery worker
celery -A celery_app.celery beat --loglevel=info      # 4. Celery scheduler
```

Then open **http://localhost:5000**

To check everything is wired up:

```bash
curl localhost:5000/api/health     # {"status":"ok","redis":true,"users":14}
python test_api.py                 # 32-check smoke suite (server must be running)
```

---

## Demo logins

Created by `python seed.py --demo`.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@institute.edu` | `admin123` |
| Company | `hr@nexora.com` | `company123` |
| Student | `cs21b001@institute.edu` | `student123` |

The admin account is created automatically on every boot even without `--demo`.

Other demo accounts: companies `hr@vertex.com`, `hr@arclight.com`, `hr@kestrel.com`, `hr@halcyon.com`
(the last two are still pending approval, so you can test the approval flow); students `cs21b002`,
`cs21b003`, `it21b011`, `it21b012`, `ec21b021`, `ec21b022`, `me21b031` — all `@institute.edu` / `student123`.

Demo dataset: 5 companies, 8 students, 7 drives, 16 applications.

---

## Roles

### Admin — the Placement Cell
Pre-existing superuser, never registers. Approves or rejects company registrations and placement
drives, views and manages every student / company / drive, searches students and organizations,
blacklists or reinstates companies and students, and views placement reports and statistics.
Can also trigger both batch jobs manually from **Reports & Statistics**.

### Company
Registers a company profile, waits for admin approval, then creates placement drives (each drive is
also reviewed by the admin). Views the students who applied to its drives, shortlists them, records
remarks and interview details, and marks final selections. Can close and reopen drives.

### Student
Registers, logs in and edits their profile. Browses every approved drive with an "only show drives I
am eligible for" filter, applies to drives, withdraws while still in *Applied* status, and reviews
their full application history with results and remarks.

---

## How the workflow fits together

```
Company registers ──► Admin approves company
                              │
Company creates drive ──► Admin approves drive ──► Drive visible to students
                                                          │
                                          Student applies (eligibility checked)
                                                          │
                                    Company: shortlist / waiting / reject / select
                                                          │
                                        Student sees the result in their history
```

**Statuses**

- Drive: `pending` → `approved` → `closed`, plus `rejected`. Editing an approved drive sends it back
  to `pending` for re-approval.
- Application: `applied` → `shortlisted` / `waiting` → `selected` / `rejected`.

**Blacklisting** — per the wireframe note, blacklisting a company cancels all of its pending and
approved drives, and the account can no longer log in. Blacklisting a student blocks their login.
Both are reversible from the same screen.

---

## Redis caching

`flask-caching` backed by Redis (DB 1). Read-heavy endpoints such as `/api/admin/stats`,
the drive lists and the company directory are cached for 60 seconds, and the cache is cleared
whenever anything is written. If Redis is unavailable the app falls back to in-process caching so
it still runs — `/api/health` reports `"redis": false` in that case.

Redis databases used: `0` general, `1` cache, `2` Celery broker, `3` Celery results.

## Celery batch jobs

Defined in `tasks.py`, scheduled in `celery_app.py` (timezone `Asia/Kolkata`).

| Job | Schedule | What it does |
|---|---|---|
| `daily_student_reminders` | Every day at 18:00 | Emails students who are eligible for an open drive but have not applied yet, listing the drives closing soon. |
| `monthly_placement_report` | 1st of each month at 08:00 | Builds an HTML placement report for the previous month (applications, selections, placement rate, CTC figures, top recruiters, branch-wise placements), saves it to `reports/` and emails it to the admin. |

Both can be run on demand from the admin **Reports & Statistics** page, or via
`POST /api/admin/reports/reminders` and `POST /api/admin/reports/monthly`.

Emails go to SMTP on `localhost:1025` (use [MailHog](https://github.com/mailhog/MailHog) to view
them). If no SMTP server is running the failure is logged and ignored — a copy of every email is
always written to `reports/outbox/` as HTML, so the jobs are easy to verify without a mail server.

---

## API overview

All endpoints are under `/api`. Authentication is a JWT bearer token from `/api/auth/login`
(12 hour expiry), kept in `localStorage` by the frontend.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Admin | `GET /admin/dashboard`, `GET /admin/search`, `GET /admin/stats`, `GET/POST /admin/companies…`, `GET/POST /admin/students…`, `POST /admin/drives/<id>/approve|reject|close`, `POST /admin/reports/reminders|monthly` |
| Company | `GET /company/dashboard`, `GET/POST/PUT /company/drives…`, `GET /company/drives/<id>/applications`, `PUT /company/applications`, `GET/PUT /company/profile` |
| Student | `GET /student/dashboard`, `GET /student/drives`, `GET /student/drives/<id>`, `POST /student/drives/<id>/apply`, `DELETE /student/applications/<id>`, `GET /student/history`, `GET/PUT /student/profile`, `GET /student/organizations…` |
| Misc | `GET /health` |

Roles are enforced server-side with a `role_required(*roles)` decorator, and again in the router as
a convenience so users never see a page they cannot use.

---

## Notes on the tech constraints

- **Flask** serves both the REST API and the single entry-point page.
- **Vue 3 + Vue Router 4** are loaded from a CDN — no build step, no npm.
- **Jinja2** is used for exactly one thing: rendering `templates/index.html`, the SPA entry point.
  No UI is built with Jinja2.
- **Bootstrap 5.3** (plus Bootstrap Icons) from a CDN is the only CSS framework;
  `static/css/style.css` only holds a handful of small tweaks.
- **SQLite** is the only database, stored at `instance/placement.sqlite3`.
- **Redis** provides caching, and is the broker and result backend for Celery.
