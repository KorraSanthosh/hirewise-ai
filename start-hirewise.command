#!/bin/bash
# One-click launcher: FastAPI backend + built React frontend on http://localhost:8000
cd "$(dirname "$0")/backend" || exit 1
echo "=== HireWise AI: starting ==="

PY=""
for c in python3.12 python3.11 python3.10 python3; do
  if command -v $c >/dev/null 2>&1 && $c -c 'import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)'; then PY=$c; break; fi
done
[ -z "$PY" ] && { echo "Need Python 3.10+ (brew install python@3.12)"; read -p "Press Enter to close"; exit 1; }
echo "Using $($PY --version)"

[ -d .venv ] || $PY -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt || { echo "pip install failed"; read -p "Press Enter to close"; exit 1; }

# check the database from ../.env
python - <<'PY'
import sys
from sqlalchemy import text
from app.db.session import engine
try:
    with engine.connect() as c:
        n = c.execute(text('select count(*) from "User"')).scalar()
    print(f"Database OK ({engine.url.render_as_string(hide_password=True)}), {n} users")
except Exception as e:
    print("DATABASE ERROR:", str(e).splitlines()[0]); sys.exit(1)
PY
[ $? -ne 0 ] && { echo "Start PostgreSQL (hirewise_db) and re-run."; read -p "Press Enter to close"; exit 1; }

if [ ! -d ../frontend/dist ]; then
  echo "Building frontend…"; (cd ../frontend && npm install --no-audit --no-fund && npm run build) || { read -p "Frontend build failed. Enter to close"; exit 1; }
fi

(sleep 3; open http://localhost:8000) &
echo "Serving on http://localhost:8000  (API docs: /docs).  Ctrl+C to stop."
uvicorn app.main:app --port 8000
