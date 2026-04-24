from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Roomtastic API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

glb_models_dir = Path(__file__).resolve().parents[1] / "glb_models"
glb_models_dir.mkdir(parents=True, exist_ok=True)
app.mount("/glb-models", StaticFiles(directory=str(glb_models_dir)), name="glb-models")
