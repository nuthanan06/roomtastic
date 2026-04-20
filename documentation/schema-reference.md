# API Schema Reference

This file summarizes Pydantic schemas in `backend/app/schemas` and how they map to database models.

## Naming Pattern

Most resources follow:

- `XBase`: shared fields
- `XCreate`: request body for create operations
- `XUpdate`: request body for partial/full updates
- `XOut`: response model (`from_attributes=True`)

## Auth Schemas

File: `backend/app/schemas/auth.py`

- `AuthRegister`
- `AuthLogin`
- `AuthToken`
- `AuthMe`
- `AuthLoginResponse`

Purpose:
- User registration/login payloads and token/profile response contracts.

## User Schemas

File: `backend/app/schemas/user.py`

- `UserBase`: `first_name`, `last_name`, `email`
- `UserCreate`: `UserBase` + `password`
- `UserUpdate`: optional profile fields
- `UserOut`: includes `user_id`, timestamps, optional list of room IDs

Maps to model:
- `backend/app/models/user.py`

## Room Schemas

File: `backend/app/schemas/room.py`

- `RoomBase`: room attributes (`wall_colour`, dimensions, natural light)
- `RoomCreate`: `RoomBase` + `user_id`
- `RoomUpdate`: patch model
- `RoomOut`: includes IDs and optional lists of related furniture/window/door IDs

Maps to model:
- `backend/app/models/room.py`

## Furniture Schemas

File: `backend/app/schemas/furniture.py`

- `FurnitureBase`: descriptive/layout fields + `inventory_id`
- `FurnitureCreate`
- `FurnitureUpdate`
- `FurnitureOut`: includes `furniture_id`, `room_id`, timestamps
- `FurnitureMoveBody`: position update payload (`x`, `y`, `z`)
- `FurnitureRotateBody`: rotation update payload

Maps to model:
- `backend/app/models/furniture.py`

## Inventory Schemas

File: `backend/app/schemas/inventory.py`

- `InventoryBase`: product catalog attributes
- `InventoryCreate`
- `InventoryUpdate`
- `InventoryOut`: includes `inventory_id`, timestamps

Maps to model:
- `backend/app/models/inventory.py`

## Position Schemas

File: `backend/app/schemas/position.py`

- `PositionBase`: `x`, `y`, `z`
- `PositionCreate`
- `PositionUpdate`
- `PositionOut`: includes integer `id`

Maps to model:
- `backend/app/models/position.py`

## Window Schemas

File: `backend/app/schemas/window.py`

- `WindowBase`: dimensions + `position_id`
- `WindowCreate`
- `WindowUpdate`
- `WindowOut`: includes `window_id`, `room_id`

Maps to model:
- `backend/app/models/window.py`

## Door Schemas

File: `backend/app/schemas/door.py`

- `DoorBase`: dimensions + `rotation` + `swing_direction` + `position_id`
- `DoorCreate`
- `DoorUpdate`
- `DoorOut`: includes `door_id`, `room_id`

Maps to model:
- `backend/app/models/door.py`

## Lighting Schemas

File: `backend/app/schemas/lighting_furniture.py`

- `LightingFurnitureBase`: light type/intensity/temperature + `furniture_id`
- `LightingFurnitureCreate`
- `LightingFurnitureUpdate`
- `LightingFurnitureOut`: includes `id`

Maps to model:
- `backend/app/models/lighting_furniture.py`

## Job Schemas

File: `backend/app/schemas/job.py`

- `JobOut`: generic queue status/metadata payload
- `HunyuanGenerateBody`: skeleton enqueue payload
  - `image_url`
  - `quality` (default `standard`)
  - `include_texture` (default `True`)

Maps to model:
- `backend/app/models/job.py`

## Implementation Notes

- All `XOut` models use `ConfigDict(from_attributes=True)` to serialize SQLAlchemy objects.
- Some `XOut` relationship fields are represented as ID lists rather than nested objects.
- Keep schema changes backward-compatible with active frontend and worker contracts when possible.
