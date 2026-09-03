import asyncio
from datetime import datetime, time, timedelta
from decimal import Decimal
from app.core.database import async_session_factory, engine, Base
from app.infrastructure.models import (
    Resource, ResourceWorkingHours, ResourceException,
    Schedule, Booking, BookingApproval, ResourceUsage, UsageCost
)

async def seed():
    async with engine.begin() as conn:
        # Recreate tables for clean demo
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        print("[SEED] Seeding Resources...")

        # 1. Rooms / Suites
        grading_suite = Resource(
            code="ROOM-CG1",
            name="Color Grading Suite 1 (Baselight)",
            resource_type="ROOM",
            company_id="COM-POST-01",
            capacity=1,
            is_active=True
        )
        online_suite = Resource(
            code="ROOM-ONL1",
            name="Online / Conform Suite 1",
            resource_type="ROOM",
            company_id="COM-POST-01",
            capacity=1,
            is_active=True
        )
        screening_room = Resource(
            code="ROOM-SCR",
            name="Client Screening Room",
            resource_type="ROOM",
            company_id="COM-POST-01",
            capacity=12,
            is_active=True
        )

        # 2. Producers
        producer1 = Resource(
            code="PRD-001",
            name="Nattaya S. (Senior Post Producer)",
            resource_type="PRODUCER",
            company_id="COM-POST-01",
            capacity=3,
            is_active=True
        )
        producer2 = Resource(
            code="PRD-002",
            name="Wichai K. (Post Producer)",
            resource_type="PRODUCER",
            company_id="COM-POST-01",
            capacity=3,
            is_active=True
        )

        # 3. Color Grading Staff
        colorist1 = Resource(
            code="CGS-001",
            name="Anan T. (Senior Colorist)",
            resource_type="COLOR_GRADING_STAFF",
            company_id="COM-POST-01",
            capacity=1,
            is_active=True
        )
        colorist2 = Resource(
            code="CGS-002",
            name="Pimchanok W. (Colorist)",
            resource_type="COLOR_GRADING_STAFF",
            company_id="COM-POST-01",
            capacity=1,
            is_active=True
        )

        # 4. Operator Unit Staff
        operator1 = Resource(
            code="OPU-001",
            name="Kittipong R. (Online Operator)",
            resource_type="OPERATOR_UNIT_STAFF",
            company_id="COM-POST-01",
            capacity=1,
            is_active=True
        )
        operator2 = Resource(
            code="OPU-002",
            name="Suphachai M. (Conform Operator)",
            resource_type="OPERATOR_UNIT_STAFF",
            company_id="COM-POST-01",
            capacity=1,
            is_active=True
        )

        # 5. Data Management Staff
        dit1 = Resource(
            code="DMS-001",
            name="Chalida P. (DIT / Data Manager)",
            resource_type="DATA_MANAGEMENT_STAFF",
            company_id="COM-POST-01",
            capacity=2,
            is_active=True
        )

        rooms = [grading_suite, online_suite, screening_room]
        staff = [producer1, producer2, colorist1, colorist2, operator1, operator2, dit1]

        db.add_all(rooms + staff)
        await db.flush()

        # Working hours: suites run long days (09:00-21:00), staff on 09:00-18:00
        for res in rooms:
            for day in range(0, 6): # Mon(0) to Sat(5)
                db.add(ResourceWorkingHours(
                    resource_id=res.id,
                    day_of_week=day,
                    start_time=time(9, 0),
                    end_time=time(21, 0),
                    is_active=True
                ))

        for res in staff:
            for day in range(0, 5): # Mon(0) to Fri(4)
                db.add(ResourceWorkingHours(
                    resource_id=res.id,
                    day_of_week=day,
                    start_time=time(9, 0),
                    end_time=time(18, 0),
                    is_active=True
                ))

        await db.flush()

        # Exception: projector/calibration downtime on the grading suite
        today = datetime.utcnow().date()
        maint_start = datetime.combine(today, time(13, 0))
        maint_end = datetime.combine(today, time(16, 0))

        exc1 = ResourceException(
            resource_id=grading_suite.id,
            exception_type="MAINTENANCE",
            start_at=maint_start,
            end_at=maint_end,
            reason="Monthly projector calibration & display profiling"
        )
        db.add(exc1)
        await db.flush()

        # Sample Schedules
        # Grading session in Suite 1 (09:00 - 12:00)
        sch1 = Schedule(
            resource_id=grading_suite.id,
            start_at=datetime.combine(today, time(9, 0)),
            end_at=datetime.combine(today, time(12, 0)),
            status="CONFIRMED",
            priority=10,
            source_type="PROJECT_TASK",
            source_id="JOB-2026-8891",
            metadata_json={"title": "TVC — Bangkok Airways 30s", "stage": "Primary Grade"}
        )

        # The colorist assigned to that same session
        sch2 = Schedule(
            resource_id=colorist1.id,
            start_at=datetime.combine(today, time(9, 0)),
            end_at=datetime.combine(today, time(12, 0)),
            status="CONFIRMED",
            priority=10,
            source_type="PROJECT_TASK",
            source_id="JOB-2026-8891",
            metadata_json={"title": "TVC — Bangkok Airways 30s", "role": "Colorist"}
        )

        # Client review booked into the screening room (14:00 - 16:00)
        sch3 = Schedule(
            resource_id=screening_room.id,
            start_at=datetime.combine(today, time(14, 0)),
            end_at=datetime.combine(today, time(16, 0)),
            status="TENTATIVE",
            priority=100,
            source_type="BOOKING",
            source_id="BK-20260902-DEMO",
            metadata_json={"meeting_title": "Client Review — Episode 04 Final Grade"}
        )

        db.add_all([sch1, sch2, sch3])
        await db.flush()

        # Booking Entity behind the screening room slot
        booking1 = Booking(
            booking_code="BK-20260902-DEMO",
            schedule_id=sch3.id,
            requester_id="REQ-USER-001",
            requester_name="Nattaya S.",
            requester_dept="Post Production",
            purpose="Client review session for Episode 04 final grade",
            status="REQUESTED"
        )
        db.add(booking1)
        await db.flush()

        # Actual usage & cost recorded against the colorist's session
        usage1 = ResourceUsage(
            schedule_id=sch2.id,
            resource_id=colorist1.id,
            actual_start_at=datetime.combine(today, time(9, 5)),
            actual_end_at=datetime.combine(today, time(12, 20)),
            actual_duration_minutes=195, # 3h 15m
            meter_start=Decimal("0"),
            meter_end=Decimal("0"),
            operator_id="CGS-001",
            telemetry_data={"shots_graded": 42, "render_passes": 3}
        )
        db.add(usage1)
        await db.flush()

        cost1 = UsageCost(
            usage_id=usage1.id,
            hourly_rate=Decimal("2500.00"), # 2500 THB/hr
            setup_cost=Decimal("0.00"),
            total_cost=Decimal("8125.00"), # 3.25h * 2500
            billing_company_id="COM-AGENCY-02",
            charging_company_id="COM-POST-01",
            status="CALCULATED"
        )
        db.add(cost1)

        await db.commit()
        print("[SUCCESS] Database successfully seeded with rich DDD domain data!")

if __name__ == "__main__":
    asyncio.run(seed())
