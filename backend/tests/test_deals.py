import pytest


def test_create_deal_defaults_to_lead(client, make_company, make_contact):
    company = make_company()
    contact = make_contact(company_id=company["id"])
    response = client.post(
        "/api/deals",
        json={
            "title": "Patient portal",
            "amount": 64000,
            "company_id": company["id"],
            "contact_id": contact["id"],
            "expected_close_date": "2026-12-15",
        },
    )
    assert response.status_code == 201
    deal = response.json()
    assert deal["stage"] == "lead"
    assert deal["closed_at"] is None
    assert deal["company"]["name"] == "Acme Inc"
    assert deal["contact"]["full_name"] == contact["full_name"]


@pytest.mark.parametrize("amount", [0, -10, "abc", None])
def test_amount_must_be_positive(client, amount):
    response = client.post("/api/deals", json={"title": "Bad", "amount": amount})
    assert response.status_code == 422


def test_unknown_stage_is_rejected(client):
    response = client.post("/api/deals", json={"title": "X", "amount": 10, "stage": "closed"})
    assert response.status_code == 422


def test_stage_change_sets_and_clears_closed_at(client, make_deal):
    deal = make_deal()

    moved = client.patch(f"/api/deals/{deal['id']}/stage", json={"stage": "proposal"}).json()
    assert moved["stage"] == "proposal"
    assert moved["closed_at"] is None

    won = client.patch(f"/api/deals/{deal['id']}/stage", json={"stage": "won"}).json()
    assert won["stage"] == "won"
    assert won["closed_at"] is not None

    reopened = client.patch(f"/api/deals/{deal['id']}/stage", json={"stage": "negotiation"}).json()
    assert reopened["closed_at"] is None

    bad = client.patch(f"/api/deals/{deal['id']}/stage", json={"stage": "nope"})
    assert bad.status_code == 422


def test_update_deal(client, make_deal):
    deal = make_deal()
    response = client.patch(f"/api/deals/{deal['id']}", json={"amount": 15000, "stage": "lost"})
    assert response.status_code == 200
    body = response.json()
    assert body["amount"] == 15000
    assert body["stage"] == "lost"
    assert body["closed_at"] is not None

    assert client.patch(f"/api/deals/{deal['id']}", json={"amount": -1}).status_code == 422
    assert client.patch(f"/api/deals/{deal['id']}", json={"contact_id": 99}).status_code == 422


def test_filter_deals(client, make_company, make_deal):
    acme = make_company()
    make_deal(title="Small", amount=1000, company_id=acme["id"])
    make_deal(title="Medium", amount=20000, stage="proposal")
    make_deal(title="Big", amount=90000, stage="won")
    make_deal(title="Gone", amount=5000, stage="lost")

    def titles(**params):
        items = client.get("/api/deals", params=params).json()["items"]
        return sorted(item["title"] for item in items)

    assert titles(status="open") == ["Medium", "Small"]
    assert titles(status="closed") == ["Big", "Gone"]
    assert titles(status="won") == ["Big"]
    assert titles(stage=["lead", "proposal"]) == ["Medium", "Small"]
    assert titles(min_amount=5000, max_amount=50000) == ["Gone", "Medium"]
    assert titles(company_id=acme["id"]) == ["Small"]
    assert titles(search="acme") == ["Small"]

    by_amount = client.get("/api/deals", params={"sort": "-amount"}).json()["items"]
    assert [d["title"] for d in by_amount] == ["Big", "Medium", "Gone", "Small"]

    by_stage = client.get("/api/deals", params={"sort": "stage"}).json()["items"]
    assert [d["stage"] for d in by_stage] == ["lead", "proposal", "won", "lost"]

    assert client.get("/api/deals", params={"sort": "nope"}).status_code == 422


def test_pipeline_groups_deals_by_stage(client, make_deal):
    make_deal(amount=100)
    make_deal(amount=250)
    make_deal(amount=1000, stage="negotiation")

    columns = client.get("/api/deals/pipeline").json()
    assert [c["stage"] for c in columns] == [
        "lead",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
    ]
    lead = columns[0]
    assert lead["count"] == 2
    assert lead["total_amount"] == 350
    assert columns[3]["deals"][0]["amount"] == 1000


def test_delete_deal_removes_its_activities(client, make_deal):
    deal = make_deal()
    activity = client.post(
        "/api/activities", json={"type": "email", "subject": "Quote", "deal_id": deal["id"]}
    ).json()

    assert client.delete(f"/api/deals/{deal['id']}").status_code == 204
    assert client.get(f"/api/deals/{deal['id']}").status_code == 404
    assert client.get(f"/api/activities/{activity['id']}").status_code == 404
