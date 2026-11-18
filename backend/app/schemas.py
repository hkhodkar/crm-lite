from datetime import date, datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    model_validator,
)

from .models import ActivityType, DealStage


def _blank_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _with_scheme(value: str | None) -> str | None:
    if value and not value.startswith(("http://", "https://")):
        return f"https://{value}"
    return value


Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Subject = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
# optional free-text fields: empty strings from forms are stored as NULL
OptionalText = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None,
    BeforeValidator(_blank_to_none),
]
LongText = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] | None,
    BeforeValidator(_blank_to_none),
]
Phone = Annotated[
    Annotated[
        str,
        StringConstraints(strip_whitespace=True, max_length=40, pattern=r"^\+?[0-9()\-.\s]{5,}$"),
    ]
    | None,
    BeforeValidator(_blank_to_none),
]
Website = Annotated[OptionalText, AfterValidator(_with_scheme)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


# --- summaries used for nested objects ---


class CompanyRef(ORMModel):
    id: int
    name: str


class ContactRef(ORMModel):
    id: int
    full_name: str
    email: str


class DealRef(ORMModel):
    id: int
    title: str
    stage: DealStage


# --- companies ---


class CompanyBase(BaseModel):
    industry: OptionalText = None
    website: Website = None
    phone: Phone = None
    city: OptionalText = None
    country: OptionalText = None
    notes: LongText = None


class CompanyCreate(CompanyBase):
    name: Name


class CompanyUpdate(CompanyBase):
    name: Name | None = None


class CompanyRead(ORMModel):
    id: int
    name: str
    industry: str | None
    website: str | None
    phone: str | None
    city: str | None
    country: str | None
    notes: str | None
    created_at: datetime
    contact_count: int = 0
    open_deal_count: int = 0
    open_pipeline_value: float = 0


# --- contacts ---


class ContactBase(BaseModel):
    phone: Phone = None
    job_title: OptionalText = None
    company_id: int | None = None


class ContactCreate(ContactBase):
    first_name: Name
    last_name: Name
    email: EmailStr


class ContactUpdate(ContactBase):
    first_name: Name | None = None
    last_name: Name | None = None
    email: EmailStr | None = None


class ContactRead(ORMModel):
    id: int
    first_name: str
    last_name: str
    full_name: str
    email: str
    phone: str | None
    job_title: str | None
    company_id: int | None
    company: CompanyRef | None
    created_at: datetime


# --- deals ---


class DealBase(BaseModel):
    expected_close_date: date | None = None
    company_id: int | None = None
    contact_id: int | None = None


class DealCreate(DealBase):
    title: Name
    amount: float = Field(gt=0, le=100_000_000)
    stage: DealStage = DealStage.LEAD


class DealUpdate(DealBase):
    title: Name | None = None
    amount: float | None = Field(default=None, gt=0, le=100_000_000)
    stage: DealStage | None = None


class DealStageUpdate(BaseModel):
    stage: DealStage


class DealRead(ORMModel):
    id: int
    title: str
    amount: float
    stage: DealStage
    expected_close_date: date | None
    company_id: int | None
    contact_id: int | None
    company: CompanyRef | None
    contact: ContactRef | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PipelineColumn(BaseModel):
    stage: DealStage
    count: int
    total_amount: float
    deals: list[DealRead]


# --- activities ---


class ActivityBase(BaseModel):
    body: LongText = None
    occurred_at: datetime | None = None
    contact_id: int | None = None
    deal_id: int | None = None


class ActivityCreate(ActivityBase):
    type: ActivityType
    subject: Subject

    @model_validator(mode="after")
    def needs_a_parent(self) -> "ActivityCreate":
        if self.contact_id is None and self.deal_id is None:
            raise ValueError("An activity must be linked to a contact or a deal")
        return self


class ActivityUpdate(ActivityBase):
    type: ActivityType | None = None
    subject: Subject | None = None


class ActivityRead(ORMModel):
    id: int
    type: ActivityType
    subject: str
    body: str | None
    occurred_at: datetime
    contact_id: int | None
    deal_id: int | None
    contact: ContactRef | None
    deal: DealRef | None
    created_at: datetime


# --- dashboard ---


class StageSummary(BaseModel):
    stage: DealStage
    count: int
    amount: float


class MonthlyWon(BaseModel):
    month: str  # YYYY-MM
    amount: float
    count: int


class DashboardStats(BaseModel):
    open_pipeline_value: float
    weighted_pipeline_value: float
    open_deal_count: int
    won_this_month_value: float
    won_this_month_count: int
    win_rate: float | None
    average_won_deal: float | None
    deals_by_stage: list[StageSummary]
    won_by_month: list[MonthlyWon]
    recent_activities: list[ActivityRead]
    totals: dict[str, int]
