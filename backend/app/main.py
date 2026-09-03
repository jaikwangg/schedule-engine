from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import resources, schedules, availability, bookings, usages

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Domain-Driven Schedule Core Engine for Resources, Availability, Bookings, Usages and Costing",
    lifespan=lifespan
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
app.include_router(resources.router, prefix=settings.API_V1_STR)
app.include_router(schedules.router, prefix=settings.API_V1_STR)
app.include_router(availability.router, prefix=settings.API_V1_STR)
app.include_router(bookings.router, prefix=settings.API_V1_STR)
app.include_router(usages.router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "healthy"
    }
