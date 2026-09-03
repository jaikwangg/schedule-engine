import datetime as dt

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.domain.models import ResourceType
from app.main import app
from app.core.database import engine, Base, async_session_factory
from app.infrastructure.models import Resource, ResourceWorkingHours

# Every category the master screens cover
CRUD_TYPES = [t.value for t in ResourceType]

# id -> (code, name, resource_type) for the rows every test starts from
SEED_ROWS = {
    "seed-room": ("ROOM-001", "Color Grading Suite 1", "ROOM"),
    "seed-producer": ("PRD-001", "Nattaya S. (Post Producer)", "PRODUCER"),
    "seed-colorist": ("CGS-001", "Anan T. (Senior Colorist)", "COLOR_GRADING_STAFF"),
    "seed-operator": ("OPU-001", "Kittipong R. (Online Operator)", "OPERATOR_UNIT_STAFF"),
    "seed-data": ("DMS-001", "Chalida P. (DIT / Data Manager)", "DATA_MANAGEMENT_STAFF"),
}


@pytest_asyncio.fixture(scope="function")
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # One resource per category so list filtering is observable
    async with async_session_factory() as db:
        for res_id, (code, name, rtype) in SEED_ROWS.items():
            db.add(Resource(
                id=res_id,
                code=code,
                name=name,
                resource_type=rtype,
                company_id="COM-TEST",
                capacity=1,
                is_active=True,
            ))
        db.add(ResourceWorkingHours(
            resource_id="seed-room",
            day_of_week=0,
            start_time=dt.time(9, 0),
            end_time=dt.time(21, 0),
            is_active=True,
        ))
        await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def test_crud_types_cover_the_five_master_categories():
    assert CRUD_TYPES == [
        "ROOM",
        "PRODUCER",
        "COLOR_GRADING_STAFF",
        "OPERATOR_UNIT_STAFF",
        "DATA_MANAGEMENT_STAFF",
    ]


@pytest.mark.parametrize("resource_type", CRUD_TYPES)
@pytest.mark.asyncio
async def test_resource_crud_roundtrip(client: AsyncClient, resource_type: str):
    """Create -> read -> list-filter -> update -> hard delete, for each category."""
    code = f"CRUD-{resource_type}"

    create_res = await client.post("/api/v1/resources", json={
        "code": code,
        "name": f"New {resource_type}",
        "resource_type": resource_type,
        "company_id": "COM-TEST",
        "capacity": 2,
        "working_hours": [
            {"day_of_week": 0, "start_time": "09:00:00", "end_time": "18:00:00", "is_active": True}
        ],
    })
    assert create_res.status_code == 201
    created = create_res.json()
    resource_id = created["id"]
    assert created["resource_type"] == resource_type
    assert len(created["working_hours"]) == 1

    # Read one
    get_res = await client.get(f"/api/v1/resources/{resource_id}")
    assert get_res.status_code == 200
    assert get_res.json()["code"] == code

    # List filtered by category -> the seeded one plus the new one, nothing else
    list_res = await client.get(f"/api/v1/resources?resource_type={resource_type}")
    assert list_res.status_code == 200
    listed = list_res.json()
    assert {r["code"] for r in listed} >= {code}
    assert all(r["resource_type"] == resource_type for r in listed)

    # Update, including the unique code
    patch_res = await client.patch(f"/api/v1/resources/{resource_id}", json={
        "code": f"{code}-R2",
        "name": "Renamed",
        "capacity": 5,
        "is_active": False,
    })
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["code"] == f"{code}-R2"
    assert updated["name"] == "Renamed"
    assert updated["capacity"] == 5
    assert updated["is_active"] is False

    # Delete -> no schedules attached, so it is removed for good
    del_res = await client.delete(f"/api/v1/resources/{resource_id}")
    assert del_res.status_code == 200
    assert del_res.json()["action"] == "deleted"
    assert (await client.get(f"/api/v1/resources/{resource_id}")).status_code == 404


@pytest.mark.asyncio
async def test_retired_categories_are_rejected(client: AsyncClient):
    """MACHINE / HUMAN / VEHICLE / TOOL are no longer part of the domain."""
    for retired in ["MACHINE", "HUMAN", "VEHICLE", "TOOL"]:
        res = await client.post("/api/v1/resources", json={
            "code": f"OLD-{retired}",
            "name": "Legacy category",
            "resource_type": retired,
        })
        assert res.status_code == 422, f"{retired} should no longer be accepted"


@pytest.mark.asyncio
async def test_duplicate_code_is_rejected_on_create_and_update(client: AsyncClient):
    dup = await client.post("/api/v1/resources", json={
        "code": "ROOM-001",  # already taken by the seeded room
        "name": "Clash",
        "resource_type": "ROOM",
    })
    assert dup.status_code == 400

    patch_res = await client.patch("/api/v1/resources/seed-producer", json={"code": "ROOM-001"})
    assert patch_res.status_code == 400

    # Patching a resource with its own code must still succeed
    same = await client.patch("/api/v1/resources/seed-producer", json={"code": "PRD-001"})
    assert same.status_code == 200


@pytest.mark.asyncio
async def test_delete_deactivates_when_schedules_exist(client: AsyncClient):
    alloc = await client.post("/api/v1/schedules", json={
        "resource_id": "seed-room",
        "start_at": "2026-09-07T10:00:00",
        "end_at": "2026-09-07T12:00:00",
        "source_type": "PROJECT_TASK",
        "source_id": "JOB-CRUD-1",
    })
    assert alloc.status_code == 201

    del_res = await client.delete("/api/v1/resources/seed-room")
    assert del_res.status_code == 200
    assert del_res.json()["action"] == "deactivated"

    still_there = await client.get("/api/v1/resources/seed-room")
    assert still_there.status_code == 200
    assert still_there.json()["is_active"] is False


@pytest.mark.asyncio
async def test_working_hours_crud(client: AsyncClient):
    # Create
    add_res = await client.post("/api/v1/resources/seed-colorist/working-hours", json={
        "day_of_week": 2,
        "start_time": "09:00:00",
        "end_time": "12:00:00",
        "is_active": True,
    })
    assert add_res.status_code == 201
    wh_id = add_res.json()["id"]

    # Identical entry is refused
    dup_res = await client.post("/api/v1/resources/seed-colorist/working-hours", json={
        "day_of_week": 2,
        "start_time": "09:00:00",
        "end_time": "12:00:00",
        "is_active": True,
    })
    assert dup_res.status_code == 400

    # Update
    patch_res = await client.patch(f"/api/v1/resources/working-hours/{wh_id}", json={
        "end_time": "15:30:00",
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["end_time"] == "15:30:00"

    # An inverted range is rejected
    bad_res = await client.patch(f"/api/v1/resources/working-hours/{wh_id}", json={
        "end_time": "07:00:00",
    })
    assert bad_res.status_code == 422

    # Bulk replace swaps the whole weekly template
    put_res = await client.put("/api/v1/resources/seed-colorist/working-hours", json=[
        {"day_of_week": d, "start_time": "09:00:00", "end_time": "18:00:00", "is_active": True}
        for d in range(5)
    ])
    assert put_res.status_code == 200
    assert len(put_res.json()) == 5

    # Delete a single entry
    entries = (await client.get("/api/v1/resources/seed-colorist/working-hours")).json()
    del_res = await client.delete(f"/api/v1/resources/working-hours/{entries[0]['id']}")
    assert del_res.status_code == 200
    assert len((await client.get("/api/v1/resources/seed-colorist/working-hours")).json()) == 4


@pytest.mark.asyncio
async def test_exception_crud_and_listing(client: AsyncClient):
    create_res = await client.post("/api/v1/resources/exceptions", json={
        "resource_id": "seed-operator",
        "exception_type": "HOLIDAY",
        "start_at": "2026-09-10T00:00:00",
        "end_at": "2026-09-11T00:00:00",
        "reason": "Annual leave",
    })
    assert create_res.status_code == 201
    exc_id = create_res.json()["id"]

    # Inverted range is rejected at the schema level
    bad_res = await client.post("/api/v1/resources/exceptions", json={
        "resource_id": "seed-operator",
        "exception_type": "HOLIDAY",
        "start_at": "2026-09-11T00:00:00",
        "end_at": "2026-09-10T00:00:00",
    })
    assert bad_res.status_code == 422

    # The literal /exceptions path must not be swallowed by /{resource_id}
    list_res = await client.get("/api/v1/resources/exceptions?resource_id=seed-operator")
    assert list_res.status_code == 200
    assert [e["id"] for e in list_res.json()] == [exc_id]

    patch_res = await client.patch(f"/api/v1/resources/exceptions/{exc_id}", json={
        "reason": "Sick leave",
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["reason"] == "Sick leave"

    del_res = await client.delete(f"/api/v1/resources/exceptions/{exc_id}")
    assert del_res.status_code == 200
    assert (await client.get("/api/v1/resources/exceptions")).json() == []


@pytest.mark.asyncio
async def test_search_filter(client: AsyncClient):
    res = await client.get("/api/v1/resources?q=colorist")
    assert res.status_code == 200
    assert [r["id"] for r in res.json()] == ["seed-colorist"]
