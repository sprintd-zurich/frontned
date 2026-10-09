# Pricing Assistant — frontend

React + TypeScript + Vite web app for Equans estimators: upload a tender, review every
extracted LV position with its source page, adjust matches, quantities and rates, and see
the price build-up update live.

## Run

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to the backend on :8000
```

Start the backend first (see the backend repo). To point at another API, set
`VITE_API_URL=https://api.example.com` before `npm run build`.

## Screens

- **Start**: drop a tender PDF or open the Oberglatt demo tender.
- **Positions**: every position grouped by system and section, with status, match
  confidence, unit cost, hours, direct cost and source page. Filter by focus
  ("Needs my decision"), system and status. Click a row for the detail drawer:
  calculation breakdown, assumptions, editable fields and the rendered tender page.
- **Price build-up**: cost lines to the indicative selling price, cost by system,
  cost by confidence status, and editable project parameters.
