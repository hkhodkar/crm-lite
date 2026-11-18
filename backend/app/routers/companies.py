from typing import Annotated

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import Select, func, or_, select

from ..models import OPEN_STAGES, Company, Contact, Deal
from ..schemas import CompanyCreate, CompanyRead, CompanyUpdate, Page
from .common import DbSession, Paging, apply_changes, apply_sort, count_rows, get_or_404, like

router = APIRouter(prefix="/companies", tags=["companies"])

contact_count = (
    select(func.count(Contact.id))
    .where(Contact.company_id == Company.id)
    .correlate(Company)
    .scalar_subquery()
)
open_deal_count = (
    select(func.count(Deal.id))
    .where(Deal.company_id == Company.id, Deal.stage.in_(OPEN_STAGES))
    .correlate(Company)
    .scalar_subquery()
)
open_pipeline_value = (
    select(func.coalesce(func.sum(Deal.amount), 0.0))
    .where(Deal.company_id == Company.id, Deal.stage.in_(OPEN_STAGES))
    .correlate(Company)
    .scalar_subquery()
)

SORT_COLUMNS = {
    "name": func.lower(Company.name),
    "industry": Company.industry,
    "created_at": Company.created_at,
    "contacts": contact_count,
    "pipeline": open_pipeline_value,
}


def _with_stats(stmt: Select) -> Select:
    return stmt.add_columns(
        contact_count.label("contact_count"),
        open_deal_count.label("open_deal_count"),
        open_pipeline_value.label("open_pipeline_value"),
    )


def _to_read(row) -> CompanyRead:
    company, contacts, deals, pipeline = row
    read = CompanyRead.model_validate(company)
    read.contact_count = contacts
    read.open_deal_count = deals
    read.open_pipeline_value = pipeline
    return read


def _read_one(db: DbSession, company_id: int) -> CompanyRead:
    get_or_404(db, Company, company_id)
    row = db.execute(_with_stats(select(Company).where(Company.id == company_id))).one()
    return _to_read(row)


@router.get("", response_model=Page[CompanyRead])
def list_companies(
    db: DbSession,
    paging: Paging,
    search: Annotated[str | None, Query(description="Matches name, industry or city")] = None,
    industry: str | None = None,
    sort: Annotated[
        str | None,
        Query(description="name, industry, created_at, contacts, pipeline; - for descending"),
    ] = None,
):
    stmt = select(Company)
    if search and search.strip():
        pattern = like(search)
        stmt = stmt.where(
            or_(
                Company.name.ilike(pattern, escape="\\"),
                Company.industry.ilike(pattern, escape="\\"),
                Company.city.ilike(pattern, escape="\\"),
            )
        )
    if industry:
        stmt = stmt.where(Company.industry == industry)

    total = count_rows(db, stmt)
    stmt = apply_sort(_with_stats(stmt), sort, SORT_COLUMNS, "name")
    rows = db.execute(stmt.limit(paging.page_size).offset(paging.offset)).all()
    return Page(
        items=[_to_read(row) for row in rows],
        total=total,
        page=paging.page,
        page_size=paging.page_size,
    )


@router.get("/industries", response_model=list[str])
def list_industries(db: DbSession):
    stmt = (
        select(Company.industry)
        .where(Company.industry.is_not(None))
        .distinct()
        .order_by(Company.industry)
    )
    return list(db.scalars(stmt))


@router.get("/{company_id}", response_model=CompanyRead)
def get_company(company_id: int, db: DbSession):
    return _read_one(db, company_id)


@router.post("", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, db: DbSession):
    company = Company(**payload.model_dump())
    db.add(company)
    db.commit()
    return _read_one(db, company.id)


@router.patch("/{company_id}", response_model=CompanyRead)
def update_company(company_id: int, payload: CompanyUpdate, db: DbSession):
    company = get_or_404(db, Company, company_id)
    apply_changes(company, payload.model_dump(exclude_unset=True), required={"name"})
    db.commit()
    return _read_one(db, company_id)


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(company_id: int, db: DbSession):
    # contacts and deals are kept, they just lose the company link
    company = get_or_404(db, Company, company_id)
    db.delete(company)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
