import datetime as dt

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.database import engine, Base, async_session_factory
from app.infrastructure.models import Resource, ResourceWorkingHours

# The three master types the CRUD screens are built around
CRUD_TYPES = ["MACHINE", "ROOM", "HUMAN"]


@pytest_asyncio.fixture(scope="function")
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # One resource per CRUD type so list filtering is observable
    async with async_session_factory() as db:
        for idx, rtype in enumerate(CRUD_TYPES, start=1):
            db.add(Resource(
                id=f"seed-{rtype.lower()}",
                code=f"{rtype[:3]}-{idx:03d}",
                name=f"Seed {rtype.title()}",
                resource_type=rtype,
                company_id="COM-TEST",
                capacity=1,
                is_active=True,
            ))
        db.add(ResourceWorkingHours(
            resource_id="seed-machine",
            day_of_week=0,
            start_time=dt.time(8, 0),
            end_time=dt.time(17, 0),
            is_active=True,
        ))
        await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.parametrize("resource_type", CRUD_TYPES)
@pytest.mark.asyncio
async def test_resource_crud_roundtrip(client: AsyncClient, resource_type: str):
    """Create -> read -> list-filter -> update -> hard delete, for each master type."""
    code = f"CRUD-{resource_type}"

    create_res = await client.post("/api/v1/resources", json={
        "code": code,
        "name": f"New {resource_type}",
        "resource_type": resource_type,
        "company_id": "COM-TEST",
        "capacity": 2,
        "working_hours": [
            {"day_of_week": 0, "start_time": "08:00:00", "end_time": "17:00:00", "is_active": True}
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

    # List filtered by type -> the seeded one plus the new one, nothing else
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
async def test_duplicate_code_is_rejected_on_create_and_update(client: AsyncClient):
    dup = await client.post("/api/v1/resources", json={
        "code": "MAC-001",  # already taken by the seeded machine
        "name": "Clash",
        "resource_type": "MACHINE",
    })
    assert dup.status_code == 400

    patch_res = await client.patch("/api/v1/resources/seed-room", json={"code": "MAC-001"})
    assert patch_res.status_code == 400

    # Patching a resource with its own code must still succeed
    same = await client.patch("/api/v1/resources/seed-room", json={"code": "ROO-002"})
    assert same.status_code == 200


@pytest.mark.asyncio
async def test_delete_deactivates_when_schedules_exist(client: AsyncClient):
    alloc = await client.post("/api/v1/schedules", json={
        "resource_id": "seed-machine",
        "start_at": "2026-09-07T09:00:00",
        "end_at": "2026-09-07T11:00:00",
        "source_type": "PRODUCTION_ORDER",
        "source_id": "PO-CRUD-1",
    })
    assert alloc.status_code == 201

    del_res = await client.delete("/api/v1/resources/seed-machine")
    assert del_res.status_code == 200
    assert del_res.json()["action"] == "deactivated"

    still_there = await client.get("/api/v1/resources/seed-machine")
    assert still_there.status_code == 200
    assert still_there.json()["is_active"] is False


@pytest.mark.asyncio
async def test_working_hours_crud(client: AsyncClient):
    # Create
    add_res = await client.post("/api/v1/resources/seed-room/working-hours", json={
        "day_of_week": 2,
        "start_time": "09:00:00",
        "end_time": "12:00:00",
        "is_active": True,
    })
    assert add_res.status_code == 201
    wh_id = add_res.json()["id"]

    # Identical entry is refused
    dup_res = await client.post("/api/v1/resources/seed-room/working-hours", json={
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
    put_res = await client.put("/api/v1/resources/seed-room/working-hours", json=[
        {"day_of_week": d, "start_time": "08:00:00", "end_time": "17:00:00", "is_active": True}
        for d in range(5)
    ])
    assert put_res.status_code == 200
    assert len(put_res.json()) == 5

    # Delete a single entry
    entries = (await client.get("/api/v1/resources/seed-room/working-hours")).json()
    del_res = await client.delete(f"/api/v1/resources/working-hours/{entries[0]['id']}")
    assert del_res.status_code == 200
    assert len((await client.get("/api/v1/resources/seed-room/working-hours")).json()) == 4


@pytest.mark.asyncio
async def test_exception_crud_and_listing(client: AsyncClient):
    create_res = await client.post("/api/v1/resources/exceptions", json={
        "resource_id": "seed-human",
        "exception_type": "HOLIDAY",
        "start_at": "2026-09-10T00:00:00",
        "end_at": "2026-09-11T00:00:00",
        "reason": "Annual leave",
    })
    assert create_res.status_code == 201
    exc_id = create_res.json()["id"]

    # Inverted range is rejected at the schema level
    bad_res = await client.post("/api/v1/resources/exceptions", json={
        "resource_id": "seed-human",
        "exception_type": "HOLIDAY",
        "start_at": "2026-09-11T00:00:00",
        "end_at": "2026-09-10T00:00:00",
    })
    assert bad_res.status_code == 422

    # The literal /exceptions path must not be swallowed by /{resource_id}
    list_res = await client.get("/api/v1/resources/exceptions?resource_id=seed-human")
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
    res = await client.get("/api/v1/resources?q=seed%20room")
    assert res.status_code == 200
    assert [r["id"] for r in res.json()] == ["seed-room"]
