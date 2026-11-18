from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from ..database import utcnow
from ..models import Activity, ActivityType, Contact, Deal
from ..schemas import ActivityCreate, ActivityRead, ActivityUpdate, Page
from .common import (
    DbSession,
    Paging,
    apply_changes,
    apply_sort,
    count_rows,
    ensure_exists,
    get_or_404,
    like,
)

router = APIRouter(prefix="/activities", tags=["activities"])

SORT_COLUMNS = {"occurred_at": Activity.occurred_at, "type": Activity.type}


@router.get("", response_model=Page[ActivityRead])
def list_activities(
    db: DbSession,
    paging: Paging,
    contact_id: int | None = None,
    deal_id: int | None = None,
    company_id: Annotated[
        int | None, Query(description="Activities of the company's contacts and deals")
    ] = None,
    activity_type: Annotated[ActivityType | None, Query(alias="type")] = None,
    search: Annotated[str | None, Query(description="Matches subject or body")] = None,
    sort: Annotated[str | None, Query(description="occurred_at or type, - for desc")] = None,
):
    stmt = select(Activity).options(joinedload(Activity.contact), joinedload(Activity.deal))
    if contact_id is not None:
        stmt = stmt.where(Activity.contact_id == contact_id)
    if deal_id is not None:
        stmt = stmt.where(Activity.deal_id == deal_id)
    if company_id is not None:
        company_contacts = select(Contact.id).where(Contact.company_id == company_id)
        company_deals = select(Deal.id).where(Deal.company_id == company_id)
        stmt = stmt.where(
            or_(Activity.contact_id.in_(company_contacts), Activity.deal_id.in_(company_deals))
        )
    if activity_type is not None:
        stmt = stmt.where(Activity.type == activity_type)
    if search and search.strip():
        pattern = like(search)
        stmt = stmt.where(
            or_(
                Activity.subject.ilike(pattern, escape="\\"),
                Activity.body.ilike(pattern, escape="\\"),
            )
        )

    total = count_rows(db, stmt)
    stmt = apply_sort(stmt, sort, SORT_COLUMNS, "-occurred_at").order_by(Activity.id.desc())
    items = db.scalars(stmt.limit(paging.page_size).offset(paging.offset)).unique().all()
    return Page(items=items, total=total, page=paging.page, page_size=paging.page_size)


@router.get("/{activity_id}", response_model=ActivityRead)
def get_activity(activity_id: int, db: DbSession):
    return get_or_404(db, Activity, activity_id)


@router.post("", response_model=ActivityRead, status_code=status.HTTP_201_CREATED)
def create_activity(payload: ActivityCreate, db: DbSession):
    ensure_exists(db, Contact, payload.contact_id, "contact_id")
    ensure_exists(db, Deal, payload.deal_id, "deal_id")
    data = payload.model_dump()
    data["occurred_at"] = data["occurred_at"] or utcnow()
    activity = Activity(**data)
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.patch("/{activity_id}", response_model=ActivityRead)
def update_activity(activity_id: int, payload: ActivityUpdate, db: DbSession):
    activity = get_or_404(db, Activity, activity_id)
    changes = payload.model_dump(exclude_unset=True)
    ensure_exists(db, Contact, changes.get("contact_id"), "contact_id")
    ensure_exists(db, Deal, changes.get("deal_id"), "deal_id")
    apply_changes(activity, changes, required={"type", "subject", "occurred_at"})
    if activity.contact_id is None and activity.deal_id is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "An activity must be linked to a contact or a deal",
        )
    db.commit()
    db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: int, db: DbSession):
    activity = get_or_404(db, Activity, activity_id)
    db.delete(activity)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
