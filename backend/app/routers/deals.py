from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.orm import aliased, joinedload

from ..models import OPEN_STAGES, Company, Contact, Deal, DealStage
from ..schemas import DealCreate, DealRead, DealStageUpdate, DealUpdate, Page, PipelineColumn
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

router = APIRouter(prefix="/deals", tags=["deals"])


class DealStatus(StrEnum):
    OPEN = "open"
    WON = "won"
    LOST = "lost"
    CLOSED = "closed"


DealCompany = aliased(Company)
DealContact = aliased(Contact)

SORT_COLUMNS = {
    "title": func.lower(Deal.title),
    "amount": Deal.amount,
    "stage": case({stage: index for index, stage in enumerate(DealStage)}, value=Deal.stage),
    "expected_close_date": Deal.expected_close_date,
    "company": func.lower(DealCompany.name),
    "created_at": Deal.created_at,
    "updated_at": Deal.updated_at,
}


def _filtered(
    search: str | None,
    stages: list[DealStage] | None = None,
    deal_status: DealStatus | None = None,
    company_id: int | None = None,
    contact_id: int | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
) -> Select:
    stmt = (
        select(Deal)
        .outerjoin(DealCompany, Deal.company)
        .outerjoin(DealContact, Deal.contact)
        .options(joinedload(Deal.company), joinedload(Deal.contact))
    )
    if search and search.strip():
        pattern = like(search)
        stmt = stmt.where(
            or_(
                Deal.title.ilike(pattern, escape="\\"),
                DealCompany.name.ilike(pattern, escape="\\"),
                (DealContact.first_name + " " + DealContact.last_name).ilike(pattern, escape="\\"),
            )
        )
    if stages:
        stmt = stmt.where(Deal.stage.in_(stages))
    if deal_status == DealStatus.OPEN:
        stmt = stmt.where(Deal.stage.in_(OPEN_STAGES))
    elif deal_status == DealStatus.CLOSED:
        stmt = stmt.where(Deal.stage.in_([DealStage.WON, DealStage.LOST]))
    elif deal_status is not None:
        stmt = stmt.where(Deal.stage == DealStage(deal_status.value))
    if company_id is not None:
        stmt = stmt.where(Deal.company_id == company_id)
    if contact_id is not None:
        stmt = stmt.where(Deal.contact_id == contact_id)
    if min_amount is not None:
        stmt = stmt.where(Deal.amount >= min_amount)
    if max_amount is not None:
        stmt = stmt.where(Deal.amount <= max_amount)
    return stmt


@router.get("", response_model=Page[DealRead])
def list_deals(
    db: DbSession,
    paging: Paging,
    search: Annotated[str | None, Query(description="Matches title, company or contact")] = None,
    stage: Annotated[list[DealStage] | None, Query()] = None,
    deal_status: Annotated[DealStatus | None, Query(alias="status")] = None,
    company_id: int | None = None,
    contact_id: int | None = None,
    min_amount: Annotated[float | None, Query(ge=0)] = None,
    max_amount: Annotated[float | None, Query(ge=0)] = None,
    sort: Annotated[
        str | None,
        Query(description=f"{', '.join(SORT_COLUMNS)}; prefix with - for descending"),
    ] = None,
):
    stmt = _filtered(search, stage, deal_status, company_id, contact_id, min_amount, max_amount)
    total = count_rows(db, stmt)
    stmt = apply_sort(stmt, sort, SORT_COLUMNS, "-updated_at").order_by(Deal.id.desc())
    items = db.scalars(stmt.limit(paging.page_size).offset(paging.offset)).unique().all()
    return Page(items=items, total=total, page=paging.page, page_size=paging.page_size)


@router.get("/pipeline", response_model=list[PipelineColumn])
def pipeline(
    db: DbSession,
    search: str | None = None,
    company_id: int | None = None,
):
    """All deals grouped by stage, in pipeline order, for the kanban board."""
    stmt = _filtered(search, company_id=company_id).order_by(Deal.updated_at.desc())
    deals = db.scalars(stmt).unique().all()
    columns = []
    for stage in DealStage:
        in_stage = [deal for deal in deals if deal.stage == stage]
        columns.append(
            PipelineColumn(
                stage=stage,
                count=len(in_stage),
                total_amount=round(sum(deal.amount for deal in in_stage), 2),
                deals=[DealRead.model_validate(deal) for deal in in_stage],
            )
        )
    return columns


@router.get("/{deal_id}", response_model=DealRead)
def get_deal(deal_id: int, db: DbSession):
    return get_or_404(db, Deal, deal_id)


@router.post("", response_model=DealRead, status_code=status.HTTP_201_CREATED)
def create_deal(payload: DealCreate, db: DbSession):
    ensure_exists(db, Company, payload.company_id, "company_id")
    ensure_exists(db, Contact, payload.contact_id, "contact_id")
    data = payload.model_dump(exclude={"stage"})
    deal = Deal(**data, stage=DealStage.LEAD)
    deal.move_to(payload.stage)
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return deal


@router.patch("/{deal_id}", response_model=DealRead)
def update_deal(deal_id: int, payload: DealUpdate, db: DbSession):
    deal = get_or_404(db, Deal, deal_id)
    changes = payload.model_dump(exclude_unset=True)
    ensure_exists(db, Company, changes.get("company_id"), "company_id")
    ensure_exists(db, Contact, changes.get("contact_id"), "contact_id")
    stage = changes.pop("stage", None)
    apply_changes(deal, changes, required={"title", "amount"})
    if stage is not None:
        deal.move_to(stage)
    db.commit()
    db.refresh(deal)
    return deal


@router.patch("/{deal_id}/stage", response_model=DealRead)
def change_stage(deal_id: int, payload: DealStageUpdate, db: DbSession):
    deal = get_or_404(db, Deal, deal_id)
    deal.move_to(payload.stage)
    db.commit()
    db.refresh(deal)
    return deal


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deal(deal_id: int, db: DbSession):
    deal = get_or_404(db, Deal, deal_id)
    db.delete(deal)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
