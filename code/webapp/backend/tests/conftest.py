"""
Test configuration and fixtures.
"""

import pytest
import asyncio
from typing import Generator
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_circuit():
    """Sample circuit for testing."""
    return {
        "components": [
            {
                "id": "R1",
                "type": "resistor",
                "value": 1000.0,
                "properties": {},
                "position": {"x": 100, "y": 100},
                "rotation": 0.0,
                "nodes": ["node1", "node2"]
            },
            {
                "id": "V1",
                "type": "voltage_source",
                "value": 5.0,
                "properties": {},
                "position": {"x": 50, "y": 100},
                "rotation": 0.0,
                "nodes": ["node1", "ground"]
            }
        ],
        "wires": [
            {
                "id": "wire1",
                "start_node": "node1",
                "end_node": "node2",
                "points": []
            }
        ],
        "text_elements": []
    }


@pytest.fixture
def sample_probes():
    """Sample probes for testing."""
    return [
        {
            "id": "probe1",
            "type": "voltage",
            "position": {"x": 100, "y": 50},
            "node_id": "node1",
            "component_id": None,
            "label": "V1",
            "color": "#3b82f6",
            "is_visible": True
        },
        {
            "id": "probe2",
            "type": "current",
            "position": {"x": 150, "y": 100},
            "node_id": None,
            "component_id": "R1",
            "label": "I1",
            "color": "#ef4444",
            "is_visible": True
        }
    ]


@pytest.fixture
def sample_simulation_request(sample_circuit, sample_probes):
    """Sample simulation request for testing."""
    return {
        "circuit": sample_circuit,
        "analysis_type": "transient",
        "parameters": {
            "start_time": 0.0,
            "end_time": 1.0,
            "time_step": 0.01,
            "additional_params": {}
        },
        "probes": sample_probes
    }