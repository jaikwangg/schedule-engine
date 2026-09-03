import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta
from app.main import app
from app.core.database import engine, Base, async_session_factory
from app.infrastructure.models import Resource, ResourceWorkingHours, ResourceException
import datetime as dt

@pytest_asyncio.fixture(scope="function")
async def client():
    # Setup test DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Pre-seed one Resource for testing
    async with async_session_factory() as db:
        res = Resource(
            id="test-res-001",
            code="CNC-TEST",
            name="Test CNC Machine",
            resource_type="MACHINE",
            company_id="COM-TEST",
            capacity=1,
            is_active=True
        )
        db.add(res)
        # Working hours 08:00 - 18:00 all days
        for day in range(7):
            db.add(ResourceWorkingHours(
                resource_id="test-res-001",
                day_of_week=day,
                start_time=dt.time(8, 0),
                end_time=dt.time(18, 0),
                is_active=True
            ))
        await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["health"] == "healthy"

@pytest.mark.asyncio
async def test_list_resources(client: AsyncClient):
    response = await client.get("/api/v1/resources")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["code"] == "CNC-TEST"

@pytest.mark.asyncio
async def test_schedule_allocation_and_conflict_prevention(client: AsyncClient):
    start = "2026-09-02T09:00:00"
    end = "2026-09-02T12:00:00"

    # 1. First allocation -> Should succeed (201)
    payload1 = {
        "resource_id": "test-res-001",
        "start_at": start,
        "end_at": end,
        "priority": 50,
        "source_type": "PRODUCTION_ORDER",
        "source_id": "PO-1001"
    }
    res1 = await client.post("/api/v1/schedules", json=payload1)
    assert res1.status_code == 201
    created_sch = res1.json()
    assert created_sch["status"] == "CONFIRMED"

    # 2. Overlapping allocation -> Must fail with 409 Conflict
    payload2 = {
        "resource_id": "test-res-001",
        "start_at": "2026-09-02T11:00:00", # Overlaps with 09:00-12:00
        "end_at": "2026-09-02T13:00:00",
        "priority": 100,
        "source_type": "PROJECT_TASK",
        "source_id": "TASK-2002"
    }
    res2 = await client.post("/api/v1/schedules", json=payload2)
    assert res2.status_code == 409
    err_detail = res2.json()["detail"]
    assert "conflict detected" in err_detail["message"].lower()

@pytest.mark.asyncio
async def test_booking_workflow_and_approval(client: AsyncClient):
    # 1. Create a booking request
    booking_req = {
        "resource_id": "test-res-001",
        "start_at": "2026-09-02T14:00:00",
        "end_at": "2026-09-02T16:00:00",
        "requester_name": "Somchai Test",
        "requester_dept": "Quality Assurance",
        "purpose": "Sample Calibration Run"
    }
    b_res = await client.post("/api/v1/bookings", json=booking_req)
    assert b_res.status_code == 201
    booking_data = b_res.json()
    assert booking_data["status"] == "REQUESTED"
    booking_id = booking_data["id"]

    # 2. Approve Booking
    approval_payload = {
        "approver_id": "APPR-MGR-01",
        "approver_name": "Manager John",
        "status": "APPROVED",
        "comment": "Approved for testing calibration"
    }
    appr_res = await client.post(f"/api/v1/bookings/{booking_id}/approval", json=approval_payload)
    assert appr_res.status_code == 200
    updated_booking = appr_res.json()
    assert updated_booking["status"] == "CONFIRMED"
    assert updated_booking["schedule"]["status"] == "CONFIRMED"

@pytest.mark.asyncio
async def test_usage_clock_in_and_cost_calculation(client: AsyncClient):
    # Clock in
    clock_in_res = await client.post("/api/v1/usages/clock-in", json={
        "resource_id": "test-res-001",
        "actual_start_at": "2026-09-02T09:00:00",
        "meter_start": 100.0,
        "operator_id": "OP-01"
    })
    assert clock_in_res.status_code == 201
    usage_id = clock_in_res.json()["id"]

    # Clock out (2 hours later)
    clock_out_res = await client.post(f"/api/v1/usages/{usage_id}/clock-out", json={
        "actual_end_at": "2026-09-02T11:00:00", # 120 minutes = 2 hours
        "meter_end": 105.5,
        "hourly_rate": 1000.0,
        "setup_cost": 200.0
    })
    assert clock_out_res.status_code == 200
    usage_final = clock_out_res.json()
    assert usage_final["actual_duration_minutes"] == 120
    assert usage_final["cost"] is not None
    # 2 hours * 1000 + 200 = 2200.00
    assert float(usage_final["cost"]["total_cost"]) == 2200.00
