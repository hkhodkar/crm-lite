def test_activity_needs_contact_or_deal(client):
    response = client.post("/api/activities", json={"type": "call", "subject": "Hello"})
    assert response.status_code == 422


def test_activity_type_is_validated(client, make_contact):
    contact = make_contact()
    response = client.post(
        "/api/activities", json={"type": "fax", "subject": "Hi", "contact_id": contact["id"]}
    )
    assert response.status_code == 422


def test_create_activity_defaults_to_now(client, make_contact):
    contact = make_contact()
    response = client.post(
        "/api/activities",
        json={"type": "meeting", "subject": "Kick-off", "body": "  ", "contact_id": contact["id"]},
    )
    assert response.status_code == 201
    activity = response.json()
    assert activity["body"] is None
    assert activity["occurred_at"].endswith("Z")
    assert activity["contact"]["id"] == contact["id"]


def test_timeline_is_newest_first(client, make_contact):
    contact = make_contact()
    for day in ("2026-01-05", "2026-03-01", "2026-02-10"):
        client.post(
            "/api/activities",
            json={
                "type": "note",
                "subject": day,
                "occurred_at": f"{day}T10:00:00Z",
                "contact_id": contact["id"],
            },
        )

    items = client.get("/api/activities", params={"contact_id": contact["id"]}).json()["items"]
    assert [a["subject"] for a in items] == ["2026-03-01", "2026-02-10", "2026-01-05"]


def test_filter_activities(client, make_company, make_contact, make_deal):
    company = make_company()
    contact = make_contact(company_id=company["id"])
    deal = make_deal(company_id=company["id"])
    stranger = make_contact()

    client.post(
        "/api/activities", json={"type": "call", "subject": "A", "contact_id": contact["id"]}
    )
    client.post("/api/activities", json={"type": "email", "subject": "B", "deal_id": deal["id"]})
    client.post(
        "/api/activities",
        json={"type": "email", "subject": "C", "body": "pricing", "contact_id": stranger["id"]},
    )

    def subjects(**params):
        items = client.get("/api/activities", params=params).json()["items"]
        return sorted(item["subject"] for item in items)

    assert subjects(company_id=company["id"]) == ["A", "B"]
    assert subjects(type="email") == ["B", "C"]
    assert subjects(deal_id=deal["id"]) == ["B"]
    assert subjects(search="pricing") == ["C"]


def test_update_and_delete_activity(client, make_contact):
    contact = make_contact()
    activity = client.post(
        "/api/activities", json={"type": "call", "subject": "Call", "contact_id": contact["id"]}
    ).json()

    updated = client.patch(
        f"/api/activities/{activity['id']}", json={"subject": "Follow-up call", "type": "meeting"}
    )
    assert updated.json()["subject"] == "Follow-up call"
    assert updated.json()["type"] == "meeting"

    orphan = client.patch(f"/api/activities/{activity['id']}", json={"contact_id": None})
    assert orphan.status_code == 422

    assert client.delete(f"/api/activities/{activity['id']}").status_code == 204
    assert client.get(f"/api/activities/{activity['id']}").status_code == 404
