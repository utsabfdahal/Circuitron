import os
import sys
import uvicorn
from pathlib import Path

# Add the app directory to Python path
backend_dir = Path(__file__).parent.parent
app_dir = backend_dir / "app"
sys.path.insert(0, str(backend_dir))

def main():
 
    os.environ.setdefault("DEBUG", "true")
    os.environ.setdefault("ENVIRONMENT", "development")
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    print("🚀 Starting Circuitron Backend Development Server")
    print(f"📁 Working directory: {backend_dir}")
    print(f"🌐 Server will be available at: http://127.0.0.1:8000")
    print(f"📚 API Documentation: http://127.0.0.1:8000/api/v1/docs")
    print(f"🔄 Auto-reload: Enabled")
    print("-" * 60)
    
    try:
        uvicorn.run(
            "app.main:app",
            host="127.0.0.1",
            port=8000,
            reload=True,
            reload_dirs=[str(app_dir)],
            log_level="info",
            access_log=True,
        )
    except KeyboardInterrupt:
        print("\n👋 Shutting down development server...")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()