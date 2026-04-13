# Circuitron Backend

A professional FastAPI backend for circuit simulation and analysis.

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── simulation.py
│   │       │   └── health.py
│   │       ├── __init__.py
│   │       └── api.py
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   └── security.py
│   ├── models/
│   │   ├── circuit.py
│   │   ├── simulation.py
│   │   └── probe.py
│   ├── services/
│   │   ├── simulation_engine.py
│   │   ├── circuit_analyzer.py
│   │   └── waveform_generator.py
│   ├── utils/
│   │   ├── math_utils.py
│   │   └── validation.py
│   ├── main.py
│   └── __init__.py
├── tests/
├── docs/
├── scripts/
├── requirements.txt
├── pyproject.toml
├── .env.example
└── README.md
```

## Features

- Circuit simulation (Transient, DC, AC analysis)
- Probe-based measurements
- Real-time waveform generation
- RESTful API with OpenAPI documentation
- Professional logging and error handling
- Type safety with Pydantic models
- Comprehensive testing suite

## Setup

1. Create virtual environment:

```bash
python -m venv venv
venv\Scripts\activate  # Windows
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run development server:

```bash
python scripts/run_dev.py
```

## API Endpoints

- `GET /api/v1/health` - Health check
- `POST /api/v1/simulation/start` - Start simulation
- `GET /api/v1/simulation/{simulation_id}/status` - Get simulation status
- `GET /api/v1/simulation/{simulation_id}/results` - Get simulation results
- `POST /api/v1/simulation/{simulation_id}/stop` - Stop simulation

## Development

- Code formatting: `black app/`
- Linting: `flake8 app/`
- Type checking: `mypy app/`
- Testing: `pytest tests/`
