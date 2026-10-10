# Favon Tender Intelligence — frontend

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

The top bar has **Projects**, then the work steps **Positions · Review · Bid · Export**.

- **Projects**: stored tenders in the sidebar (import, open, remove), project hero with
  details read from the tender cover sheet (editable from the avatar menu), status ring,
  milestones, a calendar with the days left until the submission tinted red, open tasks
  and the activity journal.
- **Positions**: what was read from the tender (LV ID, system, page, category,
  description, quantity, unit) next to the tender page, the selected position highlighted.
- **Review**: every position matched against the company data (catalogue, supplier
  packages, productivity rules). Where that data covers the position the panel shows the
  proposal from company data; where it does not, the position is marked to review with
  options: choose a product, request a supplier quote or ask for information. Below the
  status come the net unit cost and the cost composition, every number linked to its
  source. Notes live in the Discussion tab.
- **Bid**: direct cost per system, the calculated price from the positions to the
  selling price (project parameters editable there), the bid scenarios and charts, then
  how the probability is estimated next to the scenario comparison.
- **Export**: the positions with their prices next to the priced tender PDF, then the
  readiness checklist, downloads and supplier RFQ packages.

A strip of HVAC categories (air, heating, cooling, sanitary, electro, controls, fire
protection, insulation, services) in their standard colours sits under the project
progress and filters every screen. Underlined numbers open a popup with their source. A
position stays marked **edited** once anything on it was changed. On wide screens the left
and right side of Positions and Review scroll separately.

Works on phone, tablet and desktop. State lives in a small zustand store (`src/store.ts`);
all numbers come from the backend.
