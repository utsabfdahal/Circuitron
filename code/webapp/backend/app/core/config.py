from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    
    # API Configuration
    api_v1_prefix: str = "/api/v1"
    project_name: str = "Circuitron Backend"
    version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"
    
    # Server Configuration
    host: str = "127.0.0.1"
    port: int = 8000
    workers: int = 1
    
    # CORS Configuration
    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000"
    ]
    allowed_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allowed_headers: List[str] = ["*"]
    
    # Simulation Configuration
    max_simulation_time: int = 300  # seconds
    max_concurrent_simulations: int = 10
    simulation_cache_ttl: int = 3600  # seconds
    
    # Logging Configuration
    log_level: str = "INFO"
    log_format: str = "json"
    
    @validator("allowed_origins", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v
    
    @validator("allowed_methods", pre=True)
    def assemble_cors_methods(cls, v: str | List[str]) -> List[str]:
        """Parse CORS methods from string or list."""
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()