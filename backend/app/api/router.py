from fastapi import APIRouter

from app.api import legacy_vision
from app.api.routes import (
    auth,
    users,
    rooms,
    furniture,
    inventory,
    positions,
    windows,
    doors,
    lights,
    jobs_ai,
)

api_router = APIRouter()
api_router.include_router(legacy_vision.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(rooms.router)
api_router.include_router(furniture.router)
api_router.include_router(inventory.router)
api_router.include_router(positions.router)
api_router.include_router(windows.router)
api_router.include_router(doors.router)
api_router.include_router(lights.router)
api_router.include_router(jobs_ai.router)
