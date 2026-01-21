# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShiftMate is a shift management application for tracking work hours, managing employee rosters, and calculating billing. It supports both individual users and businesses with employees.

## Commands

```bash
# Development
npm run dev          # Start dev server on http://localhost:3000

# Build
npm run build        # Build frontend (Vite) and backend (esbuild)
npm run start        # Run production build

# Type checking
npm run check        # TypeScript type check

# Database
npm run db:push      # Push schema changes to database (Drizzle)
```

## Architecture

### Tech Stack
- **Frontend**: React 18 + Vite + TailwindCSS + Shadcn/UI
- **Backend**: Express.js (single routes.ts file)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: JWT tokens + session-based (hybrid for mobile compatibility)

### Directory Structure
```
client/src/
├── pages/           # Route pages (dashboard, calendar, shifts, etc.)
├── components/      # UI components (ui/ has Shadcn components)
├── hooks/           # React hooks (use-auth, use-shifts, use-business)
└── lib/             # Utilities (queryClient, auth, constants, formatters)

server/
├── index.ts         # Express app entry point
├── routes.ts        # All API endpoints (~1500 lines)
├── storage.ts       # Database layer (Drizzle queries)
├── billing-engine.ts# Pay calculation logic
└── auth-utils.ts    # JWT token management

shared/
└── schema.ts        # Drizzle schema + Zod types (shared between client/server)
```

### Key Patterns

**Path Aliases**: Use `@/` for client imports, `@shared/` for shared code:
```typescript
import { Button } from "@/components/ui/button";
import type { Shift } from "@shared/schema";
```

**API Requests**: Use `apiRequest()` from `@/lib/queryClient` for authenticated requests. React Query hooks in `hooks/use-shifts.ts` and `hooks/use-business.ts` handle caching.

**Authentication Flow**: JWT access token (15min) stored in memory, refresh token (30 days) in httpOnly cookie. `optionalJwtAuth` middleware tries JWT first, falls back to session.

### Database Tables (prefixed `shiftmate_`)
- `users` - Individual users or employees linked to companies
- `companies` - Business accounts
- `shifts` - Work shifts with approval workflow
- `employee_rates` - Per-employee pay rates (weekday, weeknight, saturday, sunday, holiday)
- `rate_tiers` - Tiered billing configuration per company
- `public_holidays` - Holiday dates for rate calculations

### User Roles
- `individual` - Personal shift tracking
- `business_owner` - Company admin with full access
- `manager` - Can assign shifts and view employee reports
- `employee` - Can view assigned roster and log personal shifts

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string

Optional:
- `SESSION_SECRET`, `JWT_SECRET` - Auth secrets (have defaults for dev)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `SENDGRID_API_KEY` - Email notifications
