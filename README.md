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
# Run test suite
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
        ├── components/           # TimelineGrid, AllocateModal, Navbar
        ├── lib/api.ts            # Typed Client for FastAPI
        └── types/index.ts        # TypeScript DTOs
```
