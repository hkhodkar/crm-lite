def test_create_and_get_company(client):
    response = client.post(
        "/api/companies",
        json={
            "name": "  Northwind  ",
            "website": "northwind.com",
            "phone": "",
            "industry": "Logistics",
        },
    )
    assert response.status_code == 201
    company = response.json()
    assert company["name"] == "Northwind"
    assert company["website"] == "https://northwind.com"
    assert company["phone"] is None
    assert company["contact_count"] == 0

    fetched = client.get(f"/api/companies/{company['id']}").json()
    assert fetched == company


def test_company_name_is_required(client):
    assert client.post("/api/companies", json={"name": "   "}).status_code == 422
    assert client.post("/api/companies", json={}).status_code == 422


def test_invalid_phone_is_rejected(client):
    response = client.post("/api/companies", json={"name": "Acme", "phone": "call me"})
    assert response.status_code == 422


def test_update_company(client, make_company):
    company = make_company()
    response = client.patch(f"/api/companies/{company['id']}", json={"city": "Berlin"})
    assert response.status_code == 200
    assert response.json()["city"] == "Berlin"
    assert response.json()["name"] == "Acme Inc"

    assert client.patch(f"/api/companies/{company['id']}", json={"name": None}).status_code == 422


def test_list_search_filter_and_pagination(client, make_company):
    make_company(name="Alpha Health", industry="Healthcare")
    make_company(name="Beta Bank", industry="Finance", city="London")
    make_company(name="Gamma Clinics", industry="Healthcare")

    page = client.get("/api/companies", params={"page_size": 2}).json()
    assert page["total"] == 3
    assert [c["name"] for c in page["items"]] == ["Alpha Health", "Beta Bank"]

    second = client.get("/api/companies", params={"page_size": 2, "page": 2}).json()
    assert [c["name"] for c in second["items"]] == ["Gamma Clinics"]

    health = client.get("/api/companies", params={"industry": "Healthcare"}).json()
    assert {c["name"] for c in health["items"]} == {"Alpha Health", "Gamma Clinics"}

    by_city = client.get("/api/companies", params={"search": "lond"}).json()
    assert [c["name"] for c in by_city["items"]] == ["Beta Bank"]

    desc = client.get("/api/companies", params={"sort": "-name"}).json()
    assert desc["items"][0]["name"] == "Gamma Clinics"

    assert client.get("/api/companies/industries").json() == ["Finance", "Healthcare"]


def test_company_counts(client, make_company, make_contact, make_deal):
    company = make_company()
    make_contact(company_id=company["id"])
    make_deal(company_id=company["id"], amount=1000)
    make_deal(company_id=company["id"], amount=500, stage="won")

    fetched = client.get(f"/api/companies/{company['id']}").json()
    assert fetched["contact_count"] == 1
    assert fetched["open_deal_count"] == 1
    assert fetched["open_pipeline_value"] == 1000


def test_delete_company_keeps_contacts(client, make_company, make_contact):
    company = make_company()
    contact = make_contact(company_id=company["id"])

    assert client.delete(f"/api/companies/{company['id']}").status_code == 204
    assert client.get(f"/api/companies/{company['id']}").status_code == 404

    contact = client.get(f"/api/contacts/{contact['id']}").json()
    assert contact["company_id"] is None
    assert contact["company"] is None


def test_unknown_company_returns_404(client):
    assert client.get("/api/companies/999").status_code == 404
    assert client.patch("/api/companies/999", json={"name": "x"}).status_code == 404
    assert client.delete("/api/companies/999").status_code == 404
