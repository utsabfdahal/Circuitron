from fastapi import APIRouter

from app.api.v1.endpoints import simulation, circuit, health, analyze
from app.core.config import settings



api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(simulation.router, prefix="/simulation", tags=["simulation"])
api_router.include_router(circuit.router, prefix="/circuit", tags=["circuit"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["analyze"])