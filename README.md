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
- **Positions**: face 2 face. Every LV position on the left (status pills, search, sort,
  bulk approve), the tender page on the right with the selected position highlighted.
- **Review**: the sign-off queue, positions needing a decision first, plus the design
  consistency checks. The detail panel holds the AI proposal, source, discussion,
  alternatives and, further down, the position's calculation (net unit cost and cost
  build-up). The toggle switches to the project price build-up with editable parameters.
- **Systems**: cost and completion per HVAC system.
- **Bid**: aggressive, target and conservative bid, win probability, what-if
  parameters and saved scenarios to compare and restore.
- **Export**: face 2 face on the priced tender, the positions with their prices next to
  the filled-in PDF page, then the readiness checklist, Excel estimate, PDF downloads and
  supplier RFQ packages.

The HVAC systems float as a strip under the project progress on every work screen; a
click filters the screen to that system.

Works on phone, tablet and desktop. State lives in a small zustand store (`src/store.ts`);
all numbers come from the backend.
