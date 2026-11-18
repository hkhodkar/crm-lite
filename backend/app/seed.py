"""Demo data so the app has something to show on first start."""

import random
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import utcnow
from .models import Activity, ActivityType, Company, Contact, Deal, DealStage

COMPANIES = [
    ("Northwind Logistics", "Logistics", "northwind-logistics.com", "Rotterdam", "Netherlands"),
    ("Brightline Health", "Healthcare", "brightlinehealth.com", "Boston", "United States"),
    ("Copperleaf Studio", "Design", "copperleaf.studio", "Berlin", "Germany"),
    ("Atlas Fintech", "Financial services", "atlasfintech.io", "London", "United Kingdom"),
    (
        "Greenfield Organics",
        "Food & beverage",
        "greenfieldorganics.com",
        "Portland",
        "United States",
    ),
    ("Helix Robotics", "Manufacturing", "helixrobotics.de", "Munich", "Germany"),
    ("Bluewave Travel", "Travel", "bluewavetravel.es", "Barcelona", "Spain"),
    ("Summit Legal Partners", "Legal", "summitlegal.ca", "Toronto", "Canada"),
    ("Pinecrest Realty", "Real estate", "pinecrestrealty.com", "Denver", "United States"),
    ("Lumen Education", "Education", "lumen-education.nl", "Amsterdam", "Netherlands"),
    ("Riverstone Energy", "Energy", "riverstone-energy.no", "Oslo", "Norway"),
    ("Nimbus Software", "Software", "nimbussoftware.com", "Austin", "United States"),
]

PHONE_PREFIX = {
    "Netherlands": "+31 20",
    "United States": "+1 512",
    "Germany": "+49 30",
    "United Kingdom": "+44 20",
    "Spain": "+34 93",
    "Canada": "+1 416",
    "Norway": "+47 22",
}

# (first name, last name, job title, company index)
CONTACTS = [
    ("Emma", "de Vries", "Head of Operations", 0),
    ("Lars", "Bakker", "IT Manager", 0),
    ("Sophie", "Jansen", "Procurement Lead", 0),
    ("Olivia", "Parker", "Chief Digital Officer", 1),
    ("Marcus", "Reed", "Product Manager", 1),
    ("Hannah", "Brooks", "Clinic Operations Director", 1),
    ("Jonas", "Weber", "Founder", 2),
    ("Mia", "Schneider", "Creative Director", 2),
    ("Daniel", "Clarke", "CTO", 3),
    ("Priya", "Shah", "Head of Product", 3),
    ("Tom", "Fletcher", "Engineering Manager", 3),
    ("Grace", "Holloway", "Compliance Officer", 3),
    ("Ethan", "Miller", "E-commerce Manager", 4),
    ("Chloe", "Bennett", "Marketing Lead", 4),
    ("Felix", "Hoffmann", "VP Engineering", 5),
    ("Lena", "Fischer", "Operations Analyst", 5),
    ("Paul", "Wagner", "Purchasing Manager", 5),
    ("Lucia", "Fernandez", "Digital Marketing Manager", 6),
    ("Carlos", "Ruiz", "CEO", 6),
    ("Elena", "Martin", "Customer Experience Lead", 6),
    ("Nathan", "Cole", "Managing Partner", 7),
    ("Rachel", "Kim", "Office Manager", 7),
    ("Owen", "Tremblay", "IT Coordinator", 7),
    ("Ava", "Morales", "Broker", 8),
    ("Jack", "Sullivan", "Marketing Director", 8),
    ("Noah", "Peterson", "Sales Manager", 8),
    ("Femke", "Visser", "Program Director", 9),
    ("Sem", "Mulder", "Learning Technologist", 9),
    ("Anouk", "Smit", "Head of Partnerships", 9),
    ("Ingrid", "Hansen", "Project Manager", 10),
    ("Erik", "Johansen", "Head of IT", 10),
    ("Nora", "Berg", "Sustainability Lead", 10),
    ("Liam", "Carter", "CTO", 11),
    ("Zoe", "Mitchell", "Product Designer", 11),
    ("Ryan", "Hughes", "Frontend Lead", 11),
    ("Isabel", "Ortiz", "Head of Growth", 11),
    ("Ben", "Foster", "Freelance Consultant", None),
    ("Sara", "Lindqvist", "Independent Recruiter", None),
    ("Ahmed", "Nasser", "Operations Manager", 1),
    ("Julia", "Nowak", "Finance Manager", 4),
]

# (title, amount, stage, company index, contact index, days until close / days since closed)
DEALS = [
    ("Fleet tracking dashboard", 48_000, DealStage.NEGOTIATION, 0, 0, 12),
    ("Warehouse app support plan", 12_500, DealStage.WON, 0, 1, -4),
    ("Patient portal redesign", 64_000, DealStage.PROPOSAL, 1, 3, 25),
    ("Appointment booking module", 22_000, DealStage.QUALIFIED, 1, 4, 40),
    ("Brand website relaunch", 18_500, DealStage.WON, 2, 6, -128),
    ("Design system in Angular", 27_000, DealStage.LEAD, 2, 7, 60),
    ("Onboarding flow rebuild", 56_000, DealStage.NEGOTIATION, 3, 9, 8),
    ("Admin console migration", 72_000, DealStage.PROPOSAL, 3, 8, 30),
    ("Compliance reporting tool", 31_000, DealStage.LOST, 3, 11, -21),
    ("Online shop performance audit", 6_500, DealStage.WON, 4, 12, -2),
    ("Subscription box storefront", 24_000, DealStage.QUALIFIED, 4, 13, 35),
    ("Production line monitoring UI", 89_000, DealStage.PROPOSAL, 5, 14, 45),
    ("Supplier portal", 38_000, DealStage.LEAD, 5, 16, 75),
    ("Booking engine integration", 42_000, DealStage.WON, 6, 18, -38),
    ("Customer self-service area", 19_500, DealStage.LEAD, 6, 19, 55),
    ("Client intake forms", 9_800, DealStage.QUALIFIED, 7, 20, 20),
    ("Document management upgrade", 26_000, DealStage.LOST, 7, 22, -50),
    ("Property listings app", 34_500, DealStage.WON, 8, 23, -66),
    ("Agent CRM integration", 15_000, DealStage.NEGOTIATION, 8, 25, 6),
    ("Learning platform MVP", 58_000, DealStage.QUALIFIED, 9, 26, 50),
    ("Course catalogue redesign", 11_000, DealStage.LEAD, 9, 28, 70),
    ("Energy usage dashboard", 46_000, DealStage.PROPOSAL, 10, 30, 28),
    ("Field service mobile app", 67_000, DealStage.LEAD, 10, 29, 90),
    ("Angular 21 upgrade", 21_000, DealStage.WON, 11, 32, -95),
    ("Analytics module", 33_000, DealStage.QUALIFIED, 11, 35, 42),
]

ACTIVITY_TEMPLATES = {
    ActivityType.CALL: [
        (
            "Discovery call",
            "Went through their setup and main pain points. Wants a follow-up with the tech lead.",
        ),
        (
            "Follow-up call",
            "Answered questions about timeline and team size. They are comparing two vendors.",
        ),
        (
            "Budget check-in",
            "Budget is approved for this quarter, procurement needs a formal quote.",
        ),
        ("Quick catch-up", "Short call to confirm next steps, nothing blocking right now."),
    ],
    ActivityType.EMAIL: [
        ("Sent proposal", "Shared the proposal PDF with scope, milestones and pricing."),
        ("Sent case study", "Sent two similar projects and a short summary of results."),
        ("Contract draft", "Sent the contract draft for legal review."),
        ("Intro email", "Introduced myself and suggested a 30 minute call next week."),
    ],
    ActivityType.MEETING: [
        (
            "Kick-off workshop",
            "Half-day workshop with product and engineering. Agreed on the first milestone.",
        ),
        (
            "Demo of prototype",
            "Showed the clickable prototype. Positive feedback on the dashboard layout.",
        ),
        ("Requirements session", "Collected requirements for reporting and user roles."),
        (
            "Quarterly review",
            "Reviewed delivery so far and discussed the roadmap for next quarter.",
        ),
    ],
    ActivityType.NOTE: [
        ("Decision maker", "Final sign-off goes through the CFO, keep her in the loop."),
        ("Competitor in play", "They also talked to a larger agency, our edge is speed and price."),
        ("Holiday", "Out of office for two weeks, follow up after the 20th."),
        ("Tech stack", "Angular frontend, .NET backend, hosted on Azure."),
    ],
}


def seed_if_empty(db: Session) -> bool:
    if db.scalar(select(func.count(Company.id))):
        return False
    seed(db)
    return True


def seed(db: Session, rng: random.Random | None = None) -> None:
    rng = rng or random.Random(42)
    now = utcnow().replace(second=0, microsecond=0)

    companies = []
    for name, industry, domain, city, country in COMPANIES:
        companies.append(
            Company(
                name=name,
                industry=industry,
                website=f"https://{domain}",
                phone=f"{PHONE_PREFIX[country]} {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
                city=city,
                country=country,
                created_at=now - timedelta(days=rng.randint(120, 240)),
            )
        )
    db.add_all(companies)
    db.flush()

    contacts = []
    for first, last, title, company_index in CONTACTS:
        company = companies[company_index] if company_index is not None else None
        domain = COMPANIES[company_index][2] if company_index is not None else "gmail.com"
        local = f"{first}.{last}".lower().replace(" ", "")
        contacts.append(
            Contact(
                first_name=first,
                last_name=last,
                email=f"{local}@{domain}",
                phone=f"+1 555 {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
                job_title=title,
                company=company,
                created_at=(company.created_at if company else now - timedelta(days=150))
                + timedelta(days=rng.randint(0, 90)),
            )
        )
    db.add_all(contacts)
    db.flush()

    deals = []
    for title, amount, stage, company_index, contact_index, days in DEALS:
        closed = stage in (DealStage.WON, DealStage.LOST)
        created = now - timedelta(
            days=(abs(days) + rng.randint(20, 60)) if closed else rng.randint(5, 70)
        )
        deal = Deal(
            title=title,
            amount=float(amount),
            stage=stage,
            company=companies[company_index],
            contact=contacts[contact_index],
            expected_close_date=(now + timedelta(days=days)).date(),
            closed_at=now + timedelta(days=days, hours=-rng.randint(1, 8)) if closed else None,
            created_at=created,
            updated_at=now - timedelta(hours=rng.randint(1, 24 * 20)),
        )
        if closed:
            deal.updated_at = deal.closed_at
        deals.append(deal)
    db.add_all(deals)
    db.flush()

    activities = []
    # every deal gets a couple of touch points with its contact
    for deal in deals:
        for _ in range(rng.randint(1, 3)):
            activities.append(_activity(rng, now, deal.contact, deal, earliest=deal.created_at))
    # and some general activity on contacts without a deal
    while len(activities) < 60:
        contact = rng.choice(contacts)
        activities.append(_activity(rng, now, contact, None, earliest=contact.created_at))
    db.add_all(activities[:60])
    db.commit()


def _activity(rng: random.Random, now, contact: Contact, deal: Deal | None, earliest) -> Activity:
    activity_type = rng.choices(list(ActivityType), weights=[3, 4, 2, 2])[0]
    subject, body = rng.choice(ACTIVITY_TEMPLATES[activity_type])
    max_hours = max(2, min(int((now - earliest).total_seconds() // 3600), 24 * 45))
    occurred = now - timedelta(hours=rng.randint(1, max_hours))
    # keep timestamps within working hours so the timeline looks believable
    occurred = occurred.replace(hour=rng.randint(8, 17), minute=rng.choice([0, 15, 30, 45]))
    if occurred > now:
        occurred -= timedelta(days=1)
    return Activity(
        type=activity_type,
        subject=subject,
        body=body,
        occurred_at=occurred,
        contact=contact,
        deal=deal,
    )
