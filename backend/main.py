from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.exceptions import ConflictError, NotFoundError
from core.logging import setup_logging
from domain.members.router import router as members_router
from domain.milestones.router import router as milestones_router
from domain.projects.router import router as projects_router
from domain.tasks.router import router as tasks_router

setup_logging()

app = FastAPI(title="NeuralPM Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before production
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(NotFoundError)
def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={"detail": exc.message})


app.include_router(projects_router)
app.include_router(members_router)
app.include_router(tasks_router)
app.include_router(milestones_router)


@app.get("/health")
def health():
    return {"status": "ok"}
