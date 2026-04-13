#!/usr/bin/env python3
"""
Production server runner for Circuitron Backend.
"""

import os
import sys
import uvicorn
from pathlib import Path

# Add the app directory to Python path
backend_dir = Path(__file__).parent.parent
app_dir = backend_dir / "app"
sys.path.insert(0, str(backend_dir))

def main():
    """Run the production server."""
    
    # Set environment variables for production
    os.environ.setdefault("DEBUG", "false")
    os.environ.setdefault("ENVIRONMENT", "production")
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("WORKERS", "4"))
    
    print("🚀 Starting Circuitron Backend Production Server")
    print(f"📁 Working directory: {backend_dir}")
    print(f"🌐 Server: {host}:{port}")
    print(f"👥 Workers: {workers}")
    print("-" * 60)
    
    try:
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            workers=workers,
            log_level="info",
            access_log=True,
            reload=False,
        )
    except KeyboardInterrupt:
        print("\n👋 Shutting down production server...")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()