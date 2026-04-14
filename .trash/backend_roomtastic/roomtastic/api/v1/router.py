from __future__ import annotations

from fastapi import APIRouter

from roomtastic.api.v1.routes import (
    ai,
    auth,
    doors,
    furniture,
    inventory,
    jobs,
    lights,
    rooms,
    users,
    windows,
)


api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
api_router.include_router(furniture.router, tags=["furniture"])
api_router.include_router(lights.router, tags=["lights"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(windows.router, tags=["windows"])
api_router.include_router(doors.router, tags=["doors"])
api_router.include_router(ai.router, tags=["ai"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])

