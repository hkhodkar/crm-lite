import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def _client(seed: bool):
    app = create_app(Settings(database_url="sqlite://", seed_demo_data=seed))
    with TestClient(app) as client:
        yield client


@pytest.fixture
def client():
    yield from _client(seed=False)


@pytest.fixture
def seeded_client():
    yield from _client(seed=True)


@pytest.fixture
def make_company(client):
    def _make(**overrides):
        payload = {"name": "Acme Inc", "industry": "Software", "city": "Austin"} | overrides
        response = client.post("/api/companies", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make


@pytest.fixture
def make_contact(client):
    counter = iter(range(1, 10_000))

    def _make(**overrides):
        n = next(counter)
        payload = {
            "first_name": "Jane",
            "last_name": f"Doe{n}",
            "email": f"jane{n}@example.com",
        } | overrides
        response = client.post("/api/contacts", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make


@pytest.fixture
def make_deal(client):
    def _make(**overrides):
        payload = {"title": "Website redesign", "amount": 12000} | overrides
        response = client.post("/api/deals", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make
