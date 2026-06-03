# API Contract

The public FastAPI contract is exported to `docs/openapi.json`.

Regenerate it after changing any request model, response model, route, or status behavior:

```powershell
cd E:\xuexi\relativistic-civilization-simulator\backend
python scripts\export_openapi.py
```

The backend test suite compares the committed OpenAPI snapshot with `app.openapi()`. If the API changes intentionally, regenerate the snapshot and commit it with the code change.

Contract scope:

- Simulation lifecycle: `/api/simulations/*`
- Archive lifecycle: `/api/archive/*`
- Experiment lab: `/api/experiments/*`
- Reports and exports: `/api/report/{run_id}.md`, `/api/exports/{run_id}.csv`
- Research credibility: `/api/research/*`
- Optional chronicle layer: `/api/ai/chronicle`
