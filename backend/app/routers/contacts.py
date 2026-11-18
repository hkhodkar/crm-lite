from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import joinedload

from ..models import Activity, Company, Contact
from ..schemas import ContactCreate, ContactRead, ContactUpdate, Page
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

router = APIRouter(prefix="/contacts", tags=["contacts"])

SORT_COLUMNS = {
    "name": func.lower(Contact.last_name),
    "first_name": func.lower(Contact.first_name),
    "email": Contact.email,
    "company": func.lower(Company.name),
    "created_at": Contact.created_at,
}


def _email_taken(db: DbSession, email: str, exclude_id: int | None = None) -> bool:
    stmt = select(Contact.id).where(func.lower(Contact.email) == email.lower())
    if exclude_id is not None:
        stmt = stmt.where(Contact.id != exclude_id)
    return db.scalar(stmt) is not None


def _conflict(email: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, f"A contact with email {email} already exists")


@router.get("", response_model=Page[ContactRead])
def list_contacts(
    db: DbSession,
    paging: Paging,
    search: Annotated[
        str | None, Query(description="Matches name, email, job title or company")
    ] = None,
    company_id: int | None = None,
    sort: Annotated[
        str | None,
        Query(description="name, first_name, email, company, created_at; prefix - for desc"),
    ] = None,
):
    stmt = select(Contact).outerjoin(Contact.company).options(joinedload(Contact.company))
    if search and search.strip():
        pattern = like(search)
        full_name = Contact.first_name + " " + Contact.last_name
        stmt = stmt.where(
            or_(
                full_name.ilike(pattern, escape="\\"),
                Contact.email.ilike(pattern, escape="\\"),
                Contact.job_title.ilike(pattern, escape="\\"),
                Company.name.ilike(pattern, escape="\\"),
            )
        )
    if company_id is not None:
        stmt = stmt.where(Contact.company_id == company_id)

    total = count_rows(db, stmt)
    stmt = apply_sort(stmt, sort, SORT_COLUMNS, "name").order_by(Contact.first_name)
    items = db.scalars(stmt.limit(paging.page_size).offset(paging.offset)).all()
    return Page(items=items, total=total, page=paging.page, page_size=paging.page_size)


@router.get("/{contact_id}", response_model=ContactRead)
def get_contact(contact_id: int, db: DbSession):
    return get_or_404(db, Contact, contact_id)


@router.post("", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
def create_contact(payload: ContactCreate, db: DbSession):
    ensure_exists(db, Company, payload.company_id, "company_id")
    if _email_taken(db, payload.email):
        raise _conflict(payload.email)
    contact = Contact(**payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch("/{contact_id}", response_model=ContactRead)
def update_contact(contact_id: int, payload: ContactUpdate, db: DbSession):
    contact = get_or_404(db, Contact, contact_id)
    changes = payload.model_dump(exclude_unset=True)
    ensure_exists(db, Company, changes.get("company_id"), "company_id")
    if changes.get("email") and _email_taken(db, changes["email"], exclude_id=contact_id):
        raise _conflict(changes["email"])
    apply_changes(contact, changes, required={"first_name", "last_name", "email"})
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: int, db: DbSession):
    contact = get_or_404(db, Contact, contact_id)
    # activities that also belong to a deal stay on the deal's timeline
    db.execute(
        update(Activity)
        .where(Activity.contact_id == contact_id, Activity.deal_id.is_not(None))
        .values(contact_id=None)
    )
    db.delete(contact)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
