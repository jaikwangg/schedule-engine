# Schedule Core Engine (Next.js + FastAPI)

Enterprise-grade **Schedule & Resource Domain Engine** built with **Domain-Driven Design (DDD)**.
Separates the **Schedule Core** from **Demand (Production, Projects, Maintenance)**, **Booking (Approval lifecycle)**, **Usage (Actual tracking)**, and **Cost (Intercompany calculation)**.

---

## 🏗️ Tech Stack
- **Backend:** FastAPI (Python 3.13), SQLAlchemy 2.0 (Async), Pydantic v2, SQLite / PostgreSQL ready.
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Lucide Icons.

---

## 🚀 Quick Start

### 1. Start FastAPI Backend (Port 8000)
```powershell
cd backend
# Run test suite (isolated in test_schedule_engine.db — the dev DB is untouched)
pytest -v

# Seed sample data (CNC machines, Rooms, Staff, Schedules, Bookings, Usages)
python -m app.seed

# Start Uvicorn Server
uvicorn app.main:app --reload --port 8000
```
Interactive Swagger API Docs available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### 2. Start Next.js Frontend (Port 3000)
```powershell
cd frontend
npm.cmd run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Core Domain Architecture

```
schedule-engine/
├── backend/
│   ├── app/
│   │   ├── domain/               # Pure Domain Business Logic (No DB dependencies)
│   │   │   ├── models.py         # Domain Enums & Value Objects
│   │   │   └── services/         # Pure Conflict Engine & Interval Math
│   │   ├── infrastructure/       # SQLAlchemy 2.0 ORM Models
│   │   │   └── models.py         # Resource, WorkingHours, Exception, Schedule, Booking, Usage, Cost
│   │   ├── schemas/              # Pydantic Schemas for Validation & DTOs
│   │   ├── services/             # Application Orchestration & Concurrency Safe Locking
│   │   │   ├── availability_service.py
│   │   │   ├── scheduling_service.py
│   │   │   ├── booking_service.py
│   │   │   └── usage_service.py
│   │   ├── api/v1/               # REST API Endpoints
│   │   │   ├── resources.py
│   │   │   ├── schedules.py
│   │   │   ├── availability.py
│   │   │   ├── bookings.py
│   │   │   └── usages.py
│   │   ├── main.py               # FastAPI App & CORS configuration
│   │   └── seed.py               # Demo Database Seeder
│   └── tests/                    # Pytest Suite (Domain unit tests + API integration tests)
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx          # 📊 Resource Gantt / Schedule Timeline Board
        │   ├── booking/          # 📅 Demand Booking Portal (Dynamic Slot Picker)
        │   ├── approvals/        # ✍️ Booking Approval Workflow Queue
        │   ├── usage/            # ⏱️ Actual Usage & Costing Variance Tracker
        │   └── resources/        # ⚙️ Resource & Exception Master
        │       ├── page.tsx      #    All types overview + maintenance blackouts
        │       ├── machines/     #    🔧 Machine CRUD
        │       ├── rooms/        #    🚪 Room CRUD
        │       └── humans/       #    👥 Staff CRUD
        ├── components/           # TimelineGrid, AllocateModal, Navbar, ResourceCrud
        ├── lib/api.ts            # Typed Client for FastAPI
        └── types/index.ts        # TypeScript DTOs
```

---

## ⚙️ Resource Master CRUD

`/resources` keeps the cross-type overview; each schedulable kind also gets its own
full CRUD screen, all driven by the shared `ResourceCrud` component:

| Screen | Route | Type |
| --- | --- | --- |
| Machines | `/resources/machines` | `MACHINE` |
| Rooms | `/resources/rooms` | `ROOM` |
| Staff | `/resources/humans` | `HUMAN` |

Each screen supports debounced search, active/inactive filtering, create, edit
(including a multi-shift weekly working-hours editor), activate/deactivate, and delete.

### Resource endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/resources` | List; filter by `resource_type`, `is_active`, `company_id`, `q` |
| `POST` | `/api/v1/resources` | Create (optionally with working hours) |
| `GET` | `/api/v1/resources/{id}` | Read one |
| `PATCH` | `/api/v1/resources/{id}` | Update code / name / type / company / capacity / active |
| `DELETE` | `/api/v1/resources/{id}` | Hard delete when unused, otherwise deactivate |
| `GET` | `/api/v1/resources/{id}/working-hours` | List the weekly template |
| `POST` | `/api/v1/resources/{id}/working-hours` | Add one shift |
| `PUT` | `/api/v1/resources/{id}/working-hours` | Replace the whole template |
| `PATCH` | `/api/v1/resources/working-hours/{id}` | Update one shift |
| `DELETE` | `/api/v1/resources/working-hours/{id}` | Remove one shift |
| `GET` | `/api/v1/resources/exceptions` | List maintenance / holiday / blackout windows |
| `POST` | `/api/v1/resources/exceptions` | Create one (resource-scoped or global) |
| `PATCH` | `/api/v1/resources/exceptions/{id}` | Update one |
| `DELETE` | `/api/v1/resources/exceptions/{id}` | Delete one |

**Delete semantics:** a resource referenced by any schedule or usage record is
deactivated rather than removed, so scheduling history is never orphaned. The
response's `action` field is either `deleted` or `deactivated`.
