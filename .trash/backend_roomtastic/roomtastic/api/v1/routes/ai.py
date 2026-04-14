from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import RoomChatRequest
from roomtastic.db.models import Job, JobStatus, Room, User
from roomtastic.db.session import get_session

router = APIRouter()


def _enqueue(session: Session, job_type: str, payload: dict) -> Job:
    j = Job(type=job_type, status=JobStatus.pending, payload=payload, attempts=0, updated_at=datetime.utcnow())
    session.add(j)
    session.commit()
    session.refresh(j)
    return j


def _assert_room_owner(session: Session, room_id: str, user: User) -> Room:
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return r


@router.post("/rooms/{room_id}/generate-layout")
def generate_layout(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _assert_room_owner(session, room_id, current_user)
    j = _enqueue(session, "layout.generate", {"room_id": room_id, "user_id": current_user.user_id})
    return {"job_id": j.job_id, "status": j.status.value}


@router.post("/rooms/{room_id}/optimize-layout")
def optimize_layout(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _assert_room_owner(session, room_id, current_user)
    j = _enqueue(session, "layout.optimize", {"room_id": room_id, "user_id": current_user.user_id})
    return {"job_id": j.job_id, "status": j.status.value}


@router.post("/rooms/{room_id}/furniture-suggestions")
def furniture_suggestions(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _assert_room_owner(session, room_id, current_user)
    j = _enqueue(session, "furniture.suggestions", {"room_id": room_id, "user_id": current_user.user_id})
    return {"job_id": j.job_id, "status": j.status.value}


@router.put("/room-chat")
def room_chat(
    req: RoomChatRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _assert_room_owner(session, req.room_id, current_user)
    j = _enqueue(
        session,
        "room.chat",
        {"room_id": req.room_id, "user_id": current_user.user_id, "message": req.message},
    )
    return {"job_id": j.job_id, "status": j.status.value}

