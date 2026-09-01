# CargoPulse

A full stack logistics and fleet management platform for tracking shipments across road and air
freight — covering multi-stop routing, fleet and driver records, warehouse inventory, maintenance
scheduling, and operational analytics.

Built with Next.js 16, React 19, TypeScript and Supabase.

> **Status:** personal project, actively developed.
> **Live demo: https://cargopulse-mishan.netlify.app**
>
> **Try it without signing up.** The login page has one-click buttons for each role, or sign
> in manually with the accounts below. Password for all three: `CargoPulseDemo2026!`
>
> | Role | Email | What you see |
> |---|---|---|
> | Admin | `admin@cargopulse.com` | Everything: shipments, fleet, drivers, inventory, analytics |
> | Dispatcher | `mike.johnson@cargopulse.com` | Shipment and routing operations |
> | Driver | `james.wilson@cargopulse.com` | Only the jobs assigned to that driver |
>
> These are throwaway accounts on a demo database, published so the project can be reviewed.
> Access is enforced by Row Level Security at the database, so the driver account cannot read
> another driver's shipments even by calling the API directly.

---

## Features

**Shipment tracking**
- Multi-stop shipments with per-stop status progression and an itemised manifest
- Algorithmic route optimisation via the **OSRM Trip API**
- Real-time vehicle movement simulation using **Turf.js** great-circle interpolation
- Interactive map views built on **Leaflet** / react-leaflet

**Fleet & operations**
- Vehicle, driver and pilot records with assignment tracking
- Maintenance history and scheduling per vehicle
- Warehouse inventory management
- Expense tracking with reporting

**Analytics & reporting**
- Operational dashboards built with **Recharts**
- PDF export of shipment and expense reports via **jsPDF**

**Access control**
- Supabase Auth with email/password and password recovery
- Role-based access separating operator, driver and client views
- **Row Level Security enforced on all 13 tables** — authorisation lives in the database,
  not only in the UI layer

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase / PostgreSQL |
| Auth | Supabase Auth + Row Level Security |
| Mapping | Leaflet, react-leaflet, Turf.js, geolib |
| Routing engine | OSRM Trip API |
| Charts / export | Recharts, jsPDF |

---

## Architecture notes

The PostgreSQL schema spans 13 related tables — `shipments`, `shipment_stops`, `shipment_items`,
`vehicles`, `drivers`, `pilots`, `locations`, `inventory`, `expenses`, `maintenance_logs`,
`notifications`, `activity_logs` and `profiles`.

Every table has Row Level Security enabled, so a compromised client key cannot read data the
signed-in user isn't entitled to. Policies are the authorisation boundary; the UI reflects them
rather than enforcing them.

Route optimisation calls OSRM's Trip endpoint to solve stop ordering, then Turf.js interpolates
positions along the returned geometry to animate vehicle movement between updates.

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project

### Setup

```bash
git clone https://github.com/mishanshrestha18/CargoPulse.git
cd cargo-pulse
npm install
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

```bash
npm run dev
```

Open http://localhost:3000.

> **Note on credentials.** The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security entirely.
> It is only read by maintenance scripts in `scripts/` and must never be committed or exposed to
> the browser. Only the `NEXT_PUBLIC_*` values are safe client-side.

### Maintenance scripts

Utilities in `scripts/` handle migrations, schema checks and seed data. They read credentials from
`.env.local` and exit with a clear error if the environment is not configured:

```bash
node scripts/verify-tables.js
```

---

## Licence

Released under the MIT Licence.
