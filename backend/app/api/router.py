from fastapi import APIRouter

from app.api.routes import (
    auth,
    users,
    rooms,
    furniture,
    inventory,
    openings,
    lights,
    jobs_ai,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(rooms.router)
api_router.include_router(furniture.router)
api_router.include_router(inventory.router)
api_router.include_router(openings.router)
api_router.include_router(lights.router)
api_router.include_router(jobs_ai.router)
