"""Pytest bootstrap.

The fixtures in this suite call ``Base.metadata.drop_all`` on whatever database
``settings.DATABASE_URL`` points at. That default is ``./schedule_engine.db`` —
the same file the dev server and ``python -m app.seed`` use — so running the
tests would wipe the seeded development data.

pytest imports conftest before any test module, and ``app.core.database``
builds its engine at import time from ``settings``, so pointing the env var at a
throwaway file here is enough to isolate the run.
"""

import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_schedule_engine.db"
