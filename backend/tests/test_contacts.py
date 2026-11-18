def test_create_contact_with_company(client, make_company):
    company = make_company(name="Atlas")
    response = client.post(
        "/api/contacts",
        json={
            "first_name": "Priya",
            "last_name": "Shah",
            "email": "priya@atlas.io",
            "job_title": "Head of Product",
            "company_id": company["id"],
        },
    )
    assert response.status_code == 201
    contact = response.json()
    assert contact["full_name"] == "Priya Shah"
    assert contact["company"] == {"id": company["id"], "name": "Atlas"}


def test_email_must_be_valid(client):
    payload = {"first_name": "A", "last_name": "B", "email": "not-an-email"}
    assert client.post("/api/contacts", json=payload).status_code == 422


def test_email_must_be_unique(client, make_contact):
    make_contact(email="dup@example.com")
    payload = {"first_name": "A", "last_name": "B", "email": "DUP@example.com"}
    response = client.post("/api/contacts", json=payload)
    assert response.status_code == 409


def test_unknown_company_is_rejected(client):
    payload = {"first_name": "A", "last_name": "B", "email": "a@b.co", "company_id": 42}
    response = client.post("/api/contacts", json=payload)
    assert response.status_code == 422
    assert "company_id" in response.json()["detail"]


def test_update_contact(client, make_contact):
    contact = make_contact()
    other = make_contact()

    response = client.patch(f"/api/contacts/{contact['id']}", json={"job_title": "CTO"})
    assert response.json()["job_title"] == "CTO"

    # keeping your own email is fine, taking someone else's is not
    same = client.patch(f"/api/contacts/{contact['id']}", json={"email": contact["email"]})
    assert same.status_code == 200
    taken = client.patch(f"/api/contacts/{contact['id']}", json={"email": other["email"]})
    assert taken.status_code == 409


def test_search_and_filter_contacts(client, make_company, make_contact):
    atlas = make_company(name="Atlas Fintech")
    make_contact(first_name="Daniel", last_name="Clarke", company_id=atlas["id"])
    make_contact(first_name="Emma", last_name="Vries", email="emma@northwind.com")

    by_company_name = client.get("/api/contacts", params={"search": "atlas"}).json()
    assert [c["full_name"] for c in by_company_name["items"]] == ["Daniel Clarke"]

    by_full_name = client.get("/api/contacts", params={"search": "emma vries"}).json()
    assert by_full_name["total"] == 1

    by_email = client.get("/api/contacts", params={"search": "northwind"}).json()
    assert by_email["items"][0]["first_name"] == "Emma"

    by_id = client.get("/api/contacts", params={"company_id": atlas["id"]}).json()
    assert by_id["total"] == 1


def test_search_treats_wildcards_literally(client, make_contact):
    make_contact(first_name="Ann")
    assert client.get("/api/contacts", params={"search": "%"}).json()["total"] == 0


def test_delete_contact_moves_deal_activities(client, make_contact, make_deal):
    contact = make_contact()
    deal = make_deal(contact_id=contact["id"])
    on_deal = client.post(
        "/api/activities",
        json={
            "type": "call",
            "subject": "Intro",
            "contact_id": contact["id"],
            "deal_id": deal["id"],
        },
    ).json()
    only_contact = client.post(
        "/api/activities", json={"type": "note", "subject": "Hi", "contact_id": contact["id"]}
    ).json()

    assert client.delete(f"/api/contacts/{contact['id']}").status_code == 204

    assert client.get(f"/api/activities/{only_contact['id']}").status_code == 404
    kept = client.get(f"/api/activities/{on_deal['id']}").json()
    assert kept["contact_id"] is None
    assert kept["deal_id"] == deal["id"]
    assert client.get(f"/api/deals/{deal['id']}").json()["contact_id"] is None
