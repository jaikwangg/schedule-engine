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

        # 1. CNC Machines
        cnc1 = Resource(
            code="CNC-001",
            name="5-Axis CNC Milling Machine #1",
            resource_type="MACHINE",
            company_id="COM-MFG-01",
            capacity=1,
            is_active=True
        )
        cnc2 = Resource(
            code="CNC-002",
            name="High-Precision CNC Lathe #2",
            resource_type="MACHINE",
            company_id="COM-MFG-01",
            capacity=1,
            is_active=True
        )

        # 2. Rooms
        room1 = Resource(
            code="ROOM-BOARD",
            name="Executive Boardroom",
            resource_type="ROOM",
            company_id="COM-HQ-01",
            capacity=20,
            is_active=True
        )
        room2 = Resource(
            code="ROOM-LAB",
            name="Rapid Prototyping Lab",
            resource_type="ROOM",
            company_id="COM-HQ-01",
            capacity=6,
            is_active=True
        )

        # 3. Specialist / Staff
        staff1 = Resource(
            code="ENG-SOMCHAI",
            name="Somchai Prasert (Lead CAM Engineer)",
            resource_type="HUMAN",
            company_id="COM-MFG-01",
            capacity=1,
            is_active=True
        )

        db.add_all([cnc1, cnc2, room1, room2, staff1])
        await db.flush()

        # Add Working Hours (Mon - Fri: 08:00 - 17:00 for CNC, 09:00 - 18:00 for Rooms)
        for res in [cnc1, cnc2, staff1]:
            for day in range(0, 5): # Mon(0) to Fri(4)
                db.add(ResourceWorkingHours(
                    resource_id=res.id,
                    day_of_week=day,
                    start_time=time(8, 0),
                    end_time=time(17, 0),
                    is_active=True
                ))

        for res in [room1, room2]:
            for day in range(0, 5): # Mon(0) to Fri(4)
                db.add(ResourceWorkingHours(
                    resource_id=res.id,
                    day_of_week=day,
                    start_time=time(9, 0),
                    end_time=time(18, 0),
                    is_active=True
                ))

        await db.flush()

        # Add Exceptions (e.g. Maintenance on CNC-001)
        today = datetime.utcnow().date()
        maint_start = datetime.combine(today, time(13, 0))
        maint_end = datetime.combine(today, time(16, 0))

        exc1 = ResourceException(
            resource_id=cnc1.id,
            exception_type="MAINTENANCE",
            start_at=maint_start,
            end_at=maint_end,
            reason="Monthly Spindle Lubrication & Alignment Calibration"
        )
        db.add(exc1)
        await db.flush()

        # Add Sample Schedules
        # Morning Production Order on CNC-001 (09:00 - 12:00)
        sch1 = Schedule(
            resource_id=cnc1.id,
            start_at=datetime.combine(today, time(9, 0)),
            end_at=datetime.combine(today, time(12, 0)),
            status="CONFIRMED",
            priority=10,
            source_type="PRODUCTION_ORDER",
            source_id="PO-2026-8891",
            metadata_json={"product": "Turbine Blade Impeller", "batch_size": 25}
        )

        # Project Task on CNC-002 (09:00 - 14:00)
        sch2 = Schedule(
            resource_id=cnc2.id,
            start_at=datetime.combine(today, time(9, 0)),
            end_at=datetime.combine(today, time(14, 0)),
            status="CONFIRMED",
            priority=30,
            source_type="PROJECT_TASK",
            source_id="TASK-EV-MOTOR-SHAFT",
            metadata_json={"project": "EV Powertrain Project"}
        )

        # Booking on Boardroom (14:00 - 16:00)
        sch3 = Schedule(
            resource_id=room1.id,
            start_at=datetime.combine(today, time(14, 0)),
            end_at=datetime.combine(today, time(16, 0)),
            status="TENTATIVE",
            priority=100,
            source_type="BOOKING",
            source_id="BK-20260902-DEMO",
            metadata_json={"meeting_title": "Q3 Engineering Review"}
        )

        db.add_all([sch1, sch2, sch3])
        await db.flush()

        # Add Booking Entity
        booking1 = Booking(
            booking_code="BK-20260902-DEMO",
            schedule_id=sch3.id,
            requester_id="REQ-USER-001",
            requester_name="Kittisak N.",
            requester_dept="R&D Department",
            purpose="Quarterly Engineering Milestone and Resource Review",
            status="REQUESTED"
        )
        db.add(booking1)
        await db.flush()

        # Add Sample Actual Usage & Cost on CNC-002
        usage1 = ResourceUsage(
            schedule_id=sch2.id,
            resource_id=cnc2.id,
            actual_start_at=datetime.combine(today, time(9, 5)),
            actual_end_at=datetime.combine(today, time(13, 50)),
            actual_duration_minutes=285, # 4h 45m
            meter_start=Decimal("1250.5"),
            meter_end=Decimal("1255.25"),
            operator_id="OP-WICHAI-09",
            telemetry_data={"avg_spindle_load_pct": 72.4, "max_temperature_c": 58.2}
        )
        db.add(usage1)
        await db.flush()

        cost1 = UsageCost(
            usage_id=usage1.id,
            hourly_rate=Decimal("1200.00"), # 1200 THB/hr
            setup_cost=Decimal("500.00"),
            total_cost=Decimal("6200.00"),
            billing_company_id="COM-AUTO-02",
            charging_company_id="COM-MFG-01",
            status="CALCULATED"
        )
        db.add(cost1)

        await db.commit()
        print("[SUCCESS] Database successfully seeded with rich DDD domain data!")

if __name__ == "__main__":
    asyncio.run(seed())
