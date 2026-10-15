import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, candidates, dashboard, jobs, matches
from app.core.config import settings
from app.core.errors import AppError

app = FastAPI(title="HireWise AI API", version="1.0.0",
              description="FastAPI backend for HireWise AI (same PostgreSQL + pgvector database as the former Next.js app).")

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    body = {"success": False, "message": exc.message}
    if exc.errors:
        body["errors"] = exc.errors
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(HTTPException)
async def http_error_handler(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"success": False, "message": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = {}
    for e in exc.errors():
        errors.setdefault(".".join(str(p) for p in e["loc"] if p != "body"), []).append(e["msg"])
    return JSONResponse(status_code=400, content={"success": False, "message": "Validation failed.", "errors": errors})


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}


for r in (auth.router, jobs.router, matches.router, candidates.router, dashboard.router):
    app.include_router(r)

# Serve the built React app (frontend/dist) from the same process when present.
dist = settings.FRONTEND_DIST
if os.path.isdir(dist):
    if os.path.isdir(os.path.join(dist, "assets")):
        app.mount("/assets", StaticFiles(directory=os.path.join(dist, "assets")), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        f = os.path.join(dist, path)
        return FileResponse(f if path and os.path.isfile(f) else os.path.join(dist, "index.html"))
