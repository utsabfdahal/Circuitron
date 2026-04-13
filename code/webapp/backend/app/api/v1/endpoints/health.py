from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


@router.get("/")
async def get_version():
    """Get API version information."""
    return {
        "version": settings.version,
        "api_version": "v1",
        "project_name": settings.project_name
    }