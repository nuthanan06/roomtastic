from app.models.room import Room
from app.models.user import User
from app.schemas.room import RoomOut
from app.schemas.user import UserOut


def room_to_out(room: Room) -> RoomOut:
    return RoomOut(
        room_id=room.room_id,
        user_id=room.user_id,
        wall_colour=room.wall_colour,
        is_natural_light=room.is_natural_light,
        width=room.width,
        length=room.length,
        height=room.height,
        last_edited=room.last_edited,
        furniture=[f.furniture_id for f in room.furniture],
        openings=[o.opening_id for o in room.openings],
    )


def user_to_out(user: User) -> UserOut:
    return UserOut(
        user_id=user.user_id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        account_created=user.account_created,
        last_loged_in=user.last_loged_in,
        rooms=[r.room_id for r in user.rooms],
    )
