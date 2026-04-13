import os
import sys
import subprocess
from pathlib import Path

def run_command(command, description):
    print(f"🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed")
        return result
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e}")
        if e.stdout:
            print(f"stdout: {e.stdout}")
        if e.stderr:
            print(f"stderr: {e.stderr}")
        return None

def main():
    """Setup development environment."""
    
    backend_dir = Path(__file__).parent.parent
    os.chdir(backend_dir)
    
    print("🚀 Setting up Circuitron Backend Development Environment")
    print(f"📁 Working directory: {backend_dir}")
    print("-" * 60)
    
    # Check Python version
    python_version = sys.version_info
    if python_version < (3, 9):
        print(f"❌ Python 3.9+ required, found {python_version.major}.{python_version.minor}")
        sys.exit(1)
    
    print(f"✅ Python version: {python_version.major}.{python_version.minor}.{python_version.micro}")
    
    # Create virtual environment if it doesn't exist
    venv_path = backend_dir / "venv"
    if not venv_path.exists():
        if not run_command("python -m venv venv", "Creating virtual environment"):
            sys.exit(1)
    else:
        print("✅ Virtual environment already exists")
    
    # Determine activation script
    if os.name == "nt":  # Windows
        activate_script = venv_path / "Scripts" / "activate.bat"
        pip_executable = venv_path / "Scripts" / "pip.exe"
    else:  # Unix/Linux/Mac
        activate_script = venv_path / "bin" / "activate"
        pip_executable = venv_path / "bin" / "pip"
    
    # Install requirements
    if not run_command(f'"{pip_executable}" install -r requirements.txt', "Installing Python packages"):
        sys.exit(1)
    
    # Create .env file if it doesn't exist
    env_file = backend_dir / ".env"
    env_example = backend_dir / ".env.example"
    
    if not env_file.exists() and env_example.exists():
        env_file.write_text(env_example.read_text())
        print("✅ Created .env file from .env.example")
    
    print("\n" + "=" * 60)
    print("🎉 Setup completed successfully!")
    print("\n📋 Next steps:")
    print("1. Activate virtual environment:")
    if os.name == "nt":
        print(f"   venv\\Scripts\\activate")
    else:
        print(f"   source venv/bin/activate")
    
    print("2. Start development server:")
    print("   python scripts/run_dev.py")
    
    print("3. View API documentation:")
    print("   http://127.0.0.1:8000/api/v1/docs")
    
    print("\n🔧 Development commands:")
    print("   Format code:     black app/")
    print("   Lint code:       flake8 app/")
    print("   Type check:      mypy app/")
    print("   Run tests:       pytest tests/")

if __name__ == "__main__":
    main()