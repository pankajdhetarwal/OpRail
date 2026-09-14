# AI-Powered Automatic Block Planning — SIH 2026, PS 26027

A real, runnable FastAPI project skeleton. Nothing here is a mock UI screenshot —
every route in this skeleton does actual work: it hits a real (if empty) database,
or runs the actual OR-Tools solver. Fill in the blanks; don't fake the plumbing.

## Why this folder structure (the thing you said you'd never seen before)

Python web projects tend to converge on a "layered" structure because it keeps
each concern in its own place, so you can change one layer without breaking
the others:

```
app/
├── main.py          # the FastAPI app itself — wires everything together
├── core/            # cross-cutting stuff: settings, DB connection
│   ├── config.py    # reads environment variables (DB url, API keys) — never hardcode secrets
│   └── database.py  # SQLAlchemy engine/session setup
├── models/          # SQLAlchemy ORM classes = your DATABASE TABLES
├── schemas/         # Pydantic classes = what your API ACCEPTS/RETURNS as JSON
├── api/routes/      # the actual endpoints (URLs), grouped by resource
└── services/        # your real logic: the priority scorer, the OR-Tools optimizer
```

The split between `models/` (DB tables) and `schemas/` (API JSON shape) trips
up almost everyone coming from Node/Mongo, where you often use one shape for
both. In FastAPI they're deliberately separate: your DB table might have a
column you never want to expose in the API (internal notes, raw scores), and
your API might accept a field that isn't stored directly. Keeping them apart
means changing your database doesn't silently change your API contract.

`services/` is where the actual "AI" of this project lives — `priority_engine.py`
and `optimizer.py`. Routes in `api/` should stay thin: parse the request, call
a service function, return the result. If you find yourself writing real logic
inside a route file, move it into `services/`.

## Setup

```bash
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env            # then fill in your actual DB url / API key
uvicorn app.main:app --reload
```

Then open http://127.0.0.1:8000/docs — FastAPI generates an interactive API
tester for you automatically from your Pydantic schemas. This is the single
biggest "wait, that's free?" moment coming from Express, where you'd normally
reach for Postman/Swagger by hand.

I could not `pip install` or execute this in my sandbox (no network access
there), so double-check things run cleanly once you install the real
dependencies — the OR-Tools model and API wiring follow the standard
documented patterns, but verify locally before you build on top.

## Data strategy — see `data/README.md`

Short version: your train-timetable layer can use REAL published Indian
Railways data. Your defect-log layer (TMS/SMMS/TDMS) has to be synthetic
because that data simply isn't public — see `data/README.md` for why, and
how to make the synthetic part still credible.

## Where to go next

1. Get `uvicorn app.main:app --reload` running and hit `/health` in the browser.
2. Run `pytest` — `tests/test_optimizer.py` checks the OR-Tools model actually
   schedules two tasks without overlap. If this passes, your optimizer works.
3. Build out `app/services/priority_engine.py` — start with the weighted
   formula that's there, don't jump to ML until this whole loop works end to end.
4. Wire a Postgres DB (or even SQLite to start — change one line in `config.py`)
   and get `/api/tasks` actually persisting data.
5. Only then: layer the ML model, then the Gantt frontend, then the Gemini
   explanation layer.
