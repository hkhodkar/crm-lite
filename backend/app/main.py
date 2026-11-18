import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from .config import Settings
from .database import Base, make_engine
from .routers import activities, companies, contacts, deals, stats
from .seed import seed_if_empty

logger = logging.getLogger("crm")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    engine = make_engine(settings.database_url)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        Base.metadata.create_all(engine)
        if settings.seed_demo_data:
            with session_factory() as session:
                if seed_if_empty(session):
                    logger.info("Database was empty, loaded demo data")
        yield
        engine.dispose()

    app = FastAPI(
        title="CRM Lite API",
        description="Contacts, companies, deals and activities for a small sales team.",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.state.session_factory = session_factory

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api = APIRouter(prefix="/api")
    for module in (companies, contacts, deals, activities, stats):
        api.include_router(module.router)

    @api.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api)
    return app


app = create_app()
