import sys
import os
from pathlib import Path

if __name__ == "__main__":
    backend_dir = Path(__file__).parent.parent
    sys.path.insert(0, str(backend_dir))
    os.chdir(backend_dir)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.api.v1.api import api_router


# Configure logging
configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Circuitron Backend", version=settings.version)
    yield
    # Shutdown
    logger.info("Shutting down Circuitron Backend")


# Create FastAPI application
app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="FastAPI backend for circuit simulation and analysis",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url=f"{settings.api_v1_prefix}/docs",
    redoc_url=f"{settings.api_v1_prefix}/redoc",
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=settings.allowed_methods,
    allow_headers=settings.allowed_headers,
)

# Add trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Configure appropriately for production
)

# Include API routes
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/api/v1/", tags=["root"])
async def root():
    return {
        "message": "Circuitron Backend API",
        "version": settings.version,
        "docs": f"{settings.api_v1_prefix}/docs",
    }


@app.get("/", tags=["root"])
async def root_redirect():
    return {
        "message": "Circuitron Backend API",
        "version": settings.version,
        "docs": f"{settings.api_v1_prefix}/docs",
        "health": f"{settings.api_v1_prefix}/health/",
        "api": f"{settings.api_v1_prefix}/",
    }


if __name__ == "__main__":
    import uvicorn
    from pathlib import Path
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=1 if settings.debug else settings.workers,
        log_level=settings.log_level.lower(),
    )