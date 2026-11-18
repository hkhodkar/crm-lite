from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..database import utcnow
from ..models import OPEN_STAGES, Activity, Company, Contact, Deal, DealStage
from ..schemas import ActivityRead, DashboardStats, MonthlyWon, StageSummary
from .common import DbSession

router = APIRouter(prefix="/stats", tags=["stats"])

# rough close probability per open stage, used for the weighted pipeline
STAGE_PROBABILITY = {
    DealStage.LEAD: 0.1,
    DealStage.QUALIFIED: 0.25,
    DealStage.PROPOSAL: 0.5,
    DealStage.NEGOTIATION: 0.75,
}


def _month_start(year: int, month: int) -> datetime:
    # normalise months outside 1..12 so callers can do simple arithmetic
    year += (month - 1) // 12
    month = (month - 1) % 12 + 1
    return datetime(year, month, 1, tzinfo=UTC)


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: DbSession, months: int = 6):
    now = utcnow()
    months = max(1, min(months, 24))
    this_month = _month_start(now.year, now.month)

    rows = db.execute(
        select(Deal.stage, func.count(Deal.id), func.sum(Deal.amount)).group_by(Deal.stage)
    )
    by_stage = {stage: StageSummary(stage=stage, count=0, amount=0) for stage in DealStage}
    for stage, count, amount in rows:
        by_stage[stage] = StageSummary(stage=stage, count=count, amount=round(amount or 0, 2))

    open_value = sum(by_stage[stage].amount for stage in OPEN_STAGES)
    open_count = sum(by_stage[stage].count for stage in OPEN_STAGES)
    weighted = sum(
        by_stage[stage].amount * probability for stage, probability in STAGE_PROBABILITY.items()
    )
    won_count, won_total = by_stage[DealStage.WON].count, by_stage[DealStage.WON].amount
    lost_count = by_stage[DealStage.LOST].count
    closed = won_count + lost_count

    first_month = _month_start(now.year, now.month - months + 1)
    won_recent = db.execute(
        select(Deal.closed_at, Deal.amount).where(
            Deal.stage == DealStage.WON, Deal.closed_at >= first_month
        )
    ).all()
    buckets: dict[str, list[float]] = {}
    for offset in range(months):
        start = _month_start(first_month.year, first_month.month + offset)
        buckets[start.strftime("%Y-%m")] = []
    for closed_at, amount in won_recent:
        key = closed_at.strftime("%Y-%m")
        if key in buckets:
            buckets[key].append(amount)
    won_by_month = [
        MonthlyWon(month=key, amount=round(sum(values), 2), count=len(values))
        for key, values in buckets.items()
    ]
    this_month_values = buckets.get(this_month.strftime("%Y-%m"), [])

    recent = db.scalars(
        select(Activity)
        .options(joinedload(Activity.contact), joinedload(Activity.deal))
        .order_by(Activity.occurred_at.desc(), Activity.id.desc())
        .limit(8)
    ).all()

    return DashboardStats(
        open_pipeline_value=round(open_value, 2),
        weighted_pipeline_value=round(weighted, 2),
        open_deal_count=open_count,
        won_this_month_value=round(sum(this_month_values), 2),
        won_this_month_count=len(this_month_values),
        win_rate=round(won_count / closed, 4) if closed else None,
        average_won_deal=round(won_total / won_count, 2) if won_count else None,
        deals_by_stage=list(by_stage.values()),
        won_by_month=won_by_month,
        recent_activities=[ActivityRead.model_validate(activity) for activity in recent],
        totals={
            "companies": db.scalar(select(func.count(Company.id))) or 0,
            "contacts": db.scalar(select(func.count(Contact.id))) or 0,
            "deals": db.scalar(select(func.count(Deal.id))) or 0,
            "activities": db.scalar(select(func.count(Activity.id))) or 0,
        },
    )
