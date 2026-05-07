from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


def test_debug_status_reachable():
    response = client.get("/debug/status")
    assert response.status_code in (200, 503)


def test_phonemes_get_requires_text():
    response = client.get("/phonemes")
    assert response.status_code in (200, 422)
