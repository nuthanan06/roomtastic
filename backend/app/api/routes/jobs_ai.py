from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.job import Job, JobStatus
from app.models.room import Room
from app.schemas.job import JobOut, RoomChatBody, RoomChatPutBody

router = APIRouter(tags=["jobs", "ai"])


def _enqueue(db: Session, job_type: str, payload: dict) -> Job:
    now = datetime.utcnow()
    j = Job(
        type=job_type,
        status=JobStatus.pending,
        payload=payload,
        created_at=now,
        updated_at=now,
    )
    db.add(j)
    db.commit()
    db.refresh(j)
    return j


@router.post("/rooms/{room_id}/generate-layout", response_model=JobOut)
def generate_layout(room_id: UUID, db: Session = Depends(get_db)):
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    j = _enqueue(db, "layout.generate", {"room_id": str(room_id)})
    return JobOut.model_validate(j)


@router.post("/rooms/{room_id}/optimize-layout", response_model=JobOut)
def optimize_layout(room_id: UUID, db: Session = Depends(get_db)):
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    j = _enqueue(db, "layout.optimize", {"room_id": str(room_id)})
    return JobOut.model_validate(j)


@router.post("/rooms/{room_id}/furniture-suggestions", response_model=JobOut)
def furniture_suggestions(room_id: UUID, db: Session = Depends(get_db)):
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    j = _enqueue(db, "furniture.suggestions", {"room_id": str(room_id)})
    return JobOut.model_validate(j)


@router.put("/room-chat", response_model=JobOut)
def room_chat_put(body: RoomChatPutBody, db: Session = Depends(get_db)):
    if not db.get(Room, body.room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    j = _enqueue(
        db,
        "room.chat",
        {"room_id": str(body.room_id), "message": body.message},
    )
    return JobOut.model_validate(j)


@router.post("/rooms/{room_id}/room-chat", response_model=JobOut)
def room_chat_for_room(room_id: UUID, body: RoomChatBody, db: Session = Depends(get_db)):
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    j = _enqueue(
        db,
        "room.chat",
        {"room_id": str(room_id), "message": body.message},
    )
    return JobOut.model_validate(j)


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: UUID, db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobOut.model_validate(j)
