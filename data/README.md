# Data strategy for PS 26027 — what's real, what's synthetic, and why

## Use REAL data here: the train timetable / COA layer

The Government of India's Open Data Platform publishes an actual Indian
Railways train timetable dataset:

  https://www.data.gov.in/catalog/indian-railways-train-time-table

It contains real train numbers, station codes/names, arrival & departure
times, and distances. A cleaned mirror of the same underlying data also
exists on Kaggle ("Indian Railways Dataset"). Download it, put the raw
file in `data/raw/`, and load it with `seed_real_timetable.py`. This is
genuinely real published government data — use it directly for the COA
side of your system (train windows, corridor traffic density) instead of
inventing a fake timetable.

## Cannot be real, and that's not a "try harder" problem

TMS, SMMS, and TDMS are internal CRIS systems for logging track, signalling,
and traction defects. There is no public dataset or API for them — not
because no one has built one yet, but because they hold operational data
about live railway infrastructure. A student team cannot get authorized
access to them in a week, and no amount of extra effort changes that; it's
a data-access constraint, not an effort constraint. Claiming real access to
these in your PPT is also a real risk: any judge who knows the domain will
ask how you got it, and there's no good answer.

So: generate synthetic defect records for these three. To make them
credible rather than arbitrary, ground the distributions in real published
findings instead of guessing:

- CAG's 2022 performance audit on derailments found that of 1,024
  derailments in India between 2018-21, roughly a third were attributed to
  track defects — use this to justify your defect-severity distribution
  being weighted toward track/engineering issues.
- A separate CAG compliance audit on track maintenance found some deep-
  screening maintenance backlogs running 1-22 years overdue in audited
  sections — use this to justify including a "days_overdue" tail that goes
  well beyond a few days, not just 0-10.

Cite both in your references slide. "Synthetic data, but the distribution
assumptions are grounded in CAG audit findings [cite]" is a stronger, more
defensible claim than either "we have real Indian Railways data" (untrue)
or an unsourced random-number generator (arbitrary).

## What "real and working" should actually mean for this project

Not "every input is real" — that's not achievable here for the reason
above. What IS achievable, and what actually earns credibility with
judges, is a system where the computation is 100% real:

- The OR-Tools solver in `app/services/optimizer.py` actually solves the
  constraint problem you hand it — nothing is a canned/scripted output.
- The priority scores in `app/services/priority_engine.py` are actually
  computed from the input features, not hardcoded per demo scenario.
- If you add the ML layer later, it's actually trained and actually
  predicts — not a model object that always returns the same number.

That's the honest, defensible version of "nothing here is fake."
