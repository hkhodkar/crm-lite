from datetime import UTC, datetime, timedelta


def test_empty_dashboard(client):
    stats = client.get("/api/stats/dashboard").json()
    assert stats["open_pipeline_value"] == 0
    assert stats["win_rate"] is None
    assert stats["average_won_deal"] is None
    assert len(stats["deals_by_stage"]) == 6
    assert len(stats["won_by_month"]) == 6
    assert stats["recent_activities"] == []


def test_dashboard_numbers(client, make_deal, make_contact):
    make_deal(amount=1000)
    make_deal(amount=3000, stage="proposal")
    won = make_deal(amount=5000)
    client.patch(f"/api/deals/{won['id']}/stage", json={"stage": "won"})
    make_deal(amount=7000, stage="lost")
    make_deal(amount=2000, stage="lost")

    contact = make_contact()
    old = (datetime.now(UTC) - timedelta(days=3)).isoformat()
    client.post(
        "/api/activities",
        json={"type": "note", "subject": "Older", "occurred_at": old, "contact_id": contact["id"]},
    )
    client.post(
        "/api/activities", json={"type": "call", "subject": "Newest", "contact_id": contact["id"]}
    )

    stats = client.get("/api/stats/dashboard").json()
    assert stats["open_pipeline_value"] == 4000
    assert stats["open_deal_count"] == 2
    assert stats["weighted_pipeline_value"] == 1000 * 0.1 + 3000 * 0.5
    assert stats["won_this_month_value"] == 5000
    assert stats["won_this_month_count"] == 1
    assert stats["win_rate"] == round(1 / 3, 4)
    assert stats["average_won_deal"] == 5000
    assert stats["won_by_month"][-1] == {
        "month": datetime.now(UTC).strftime("%Y-%m"),
        "amount": 5000,
        "count": 1,
    }

    by_stage = {s["stage"]: s for s in stats["deals_by_stage"]}
    assert by_stage["lost"] == {"stage": "lost", "count": 2, "amount": 9000}
    assert [a["subject"] for a in stats["recent_activities"]] == ["Newest", "Older"]
    assert stats["totals"] == {"companies": 0, "contacts": 1, "deals": 5, "activities": 2}


def test_demo_data_is_seeded_once(seeded_client):
    totals = seeded_client.get("/api/stats/dashboard").json()["totals"]
    assert totals == {"companies": 12, "contacts": 40, "deals": 25, "activities": 60}
    assert seeded_client.get("/api/health").json() == {"status": "ok"}
