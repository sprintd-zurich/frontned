# EQUANS Tender Intelligence — frontend

React 19 + TypeScript + Vite web app (design by Tomas, wired to the pricing backend) for Equans estimators: upload a tender, review every
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

- **Overview**: stored tenders in the sidebar (import, open, remove), project hero with
  details read from the tender cover sheet (editable from the avatar menu), status ring,
  milestones, calendar, system completion, open tasks and the activity journal.
- **Positions**: every LV position with status pills (needs review, supplier quote,
  assumption, calculated, approved), system sidebar, search, sort and bulk approve. The
  detail panel shows the AI proposal, the highlighted source on the tender page,
  discussion notes, alternative products, technical data and history.
- **Review**: the sign-off queue, positions needing a decision first, plus the design
  consistency checks.
- **Systems**: cost and completion per HVAC system.
- **Calculation**: unit and total cost build-up per position, and the project price
  build-up with editable parameters.
- **Face 2 face**: tender page next to the extracted positions.
- **Bid**: aggressive, target and conservative bid, win probability, what-if
  parameters and saved scenarios to compare and restore.
- **Export**: readiness checklist, Excel estimate, priced tender PDF with preview, and
  supplier RFQ packages.

Works on phone, tablet and desktop. State lives in a small zustand store (`src/store.ts`);
all numbers come from the backend.
