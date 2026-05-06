# RAJLO Web

RAJLO is a Jamaica rideshare platform with red plate driver-only onboarding and TA compliance tracking.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
npm run dev
```

Open http://localhost:3000

## Supabase setup

1. Create a Supabase project.
2. In Supabase SQL editor, run the SQL in `supabase/schema.sql`.
3. Add values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Notes:
- Service role key is used only by server routes.
- If env vars are missing, the app automatically falls back to mock compliance data.

## Compliance API routes

- `GET /api/driver/compliance?driverId=DRV-1031`
	- Returns TA document list + renewal summary.
- `POST /api/driver/onboarding`
	- Persists onboarding form and submitted document metadata.
- `GET /api/admin/verification?driverId=DRV-1031`
	- Returns document review state and audit trail.
- `POST /api/admin/verification/decision`
	- Saves approve/reject/resubmit decisions and driver activation state.

## Key pages now using persistence APIs

- Driver onboarding: `src/app/driver/onboarding/page.tsx`
- Driver compliance dashboard: `src/app/driver/verification/page.tsx`
- Driver renewal reminders: `src/app/driver/notifications/page.tsx`
- Admin verification detail: `src/app/admin/verification-detail/page.tsx`
