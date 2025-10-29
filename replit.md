# ShiftMate - Shift Management Application

## Overview

ShiftMate is a comprehensive web application designed for shift-based professionals to manage, track, and report on their work shifts. The application provides an intuitive interface for adding shifts, viewing calendar schedules, generating reports, and real-time shift timing capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with mobile-first responsive design
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod schema validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Session Management**: Express sessions with PostgreSQL storage
- **Authentication**: Passport.js with Google OAuth 2.0 strategy
- **API Design**: RESTful endpoints with JSON responses

### Database Layer
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM with type-safe queries
- **Connection**: Node.js pg driver with connection pooling
- **Schema Management**: Drizzle Kit for migrations and schema management

## Key Components

### Authentication System
- **Dual Authentication**: Google OAuth 2.0 + JWT token-based authentication
- **Access Tokens**: 15-minute expiry, stored in localStorage + memory
- **Refresh Tokens**: 30-day expiry, stored as httpOnly + secure cookies
- **Token Security**: SHA-256 hashing for database storage, no plaintext tokens
- **Auto-refresh**: Transparent token refresh on 401 errors with request retry
- **Session Management**: Legacy session-based auth maintained for backward compatibility
- **User Profile**: Automatic account creation via Google OAuth
- **Google OAuth Callback**: Dynamic callback URL using REPLIT_DEV_DOMAIN environment variable
- **Required Environment Variables**: JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (enforced, no fallback allowed)

### Shift Management
- Manual shift entry with date, time, and type selection
- Real-time shift timer with background persistence
- Automatic quarter-hour rounding for time tracking
- Support for multiple shift types (morning, evening, night, double, custom)
- Recurring shift patterns (daily, weekly, custom)

### Calendar System
- Monthly calendar view with shift visualization
- Color-coded shift types for easy identification
- Interactive day selection for shift management
- Responsive grid layout optimized for mobile devices

### Reporting & Analytics
- Weekly hours tracking with comparison to previous periods
- Export functionality (PDF and CSV formats)
- Chart visualization using Recharts library
- Customizable date ranges and filtering options

### Roster Management (Business Accounts)
- Visual weekly calendar interface for shift assignment
- Employee vs. days grid layout for easy shift planning
- Manager-level access controls for roster modification
- Real-time CRUD operations for shift assignments
- Modal-based shift creation and editing with form validation
- Support for location-based shift assignments
- Week-by-week navigation for roster planning

### Mobile Optimization
- Touch-friendly interface with 44px minimum touch targets
- Mobile-first responsive design
- Background timer persistence using localStorage
- Optimized form inputs to prevent mobile zoom

## Data Flow

### User Authentication Flow
1. User initiates login via Google OAuth
2. Passport.js handles OAuth callback and user verification
3. User profile created or retrieved from database
4. Session established with PostgreSQL session store
5. Frontend receives authentication state via React Query

### Shift Management Flow
1. User creates shift via form or timer interface
2. Client validates data using Zod schemas
3. API endpoint processes shift creation with user context
4. Database insertion via Drizzle ORM
5. React Query cache invalidation triggers UI updates
6. Real-time updates across all relevant components

### Timer Functionality
1. Timer state persisted in localStorage for reliability
2. Background execution continues when app is backgrounded
3. Automatic shift creation when timer is stopped
4. Quarter-hour rounding applied to final duration

## External Dependencies

### Production Dependencies
- **UI Components**: Radix UI primitives for accessible components
- **Charts**: Recharts for data visualization
- **Date Handling**: date-fns for date manipulation
- **HTTP Client**: Fetch API with custom wrapper for type safety
- **Database**: @neondatabase/serverless for PostgreSQL connection
- **Authentication**: Passport.js with Google OAuth strategy

### Development Dependencies
- **Build Tools**: Vite, esbuild for production builds
- **Type Checking**: TypeScript with strict configuration
- **Code Quality**: ESLint and Prettier (implied)
- **Development Server**: Hot module replacement via Vite

## Deployment Strategy

### Build Process
- Frontend built with Vite to static assets in `dist/public`
- Backend bundled with esbuild for Node.js production
- Single production build command: `npm run build`

### Environment Configuration
- Development: `npm run dev` with hot reloading
- Production: `npm run start` with optimized builds
- Database: Environment variable-based PostgreSQL connection
- Sessions: Configurable secret key for production security

### Platform Compatibility
- Deployed on Replit with autoscale deployment target
- PostgreSQL 16 module integration
- **Port Configuration**: Single-port architecture on port 5000
- Environment-specific build optimization

### Deployment Configuration (.replit)

**Required .replit Configuration for Cloud Run:**
```toml
modules = ["nodejs-20", "web", "postgresql-16"]
run = "npm run dev"

[deployment]
build = "npm run build"
run = "npm start"
deploymentTarget = "cloudrun"

[nix]
channel = "stable-24_05"

[[ports]]
localPort = 5000
externalPort = 80
```

**Required Production Environment Variables:**
These must be set in the Replit Deployments Configuration tab (NOT in Secrets pane):

1. **JWT_SECRET** - Secret key for JWT token signing (required, no fallback)
2. **GOOGLE_CLIENT_ID** - Google OAuth client ID
3. **GOOGLE_CLIENT_SECRET** - Google OAuth client secret
4. **SESSION_SECRET** - Express session secret key
5. **DATABASE_URL** - PostgreSQL connection string (auto-configured by Replit)
6. **NODE_ENV** - Set to `production` (auto-configured)
7. **SENDGRID_API_KEY** - (Optional) For email notifications

**Google OAuth Production Setup:**
- Add your production deployment URL to Google Cloud Console authorized redirect URIs
- Format: `https://your-app-name.replit.app/api/auth/google/callback`
- The app uses REPLIT_DEV_DOMAIN in development and falls back to request-based URL construction in production

### Port Configuration Details

**Architecture**: ShiftMate uses a unified single-port architecture where both the frontend and backend run on the same port.

**Current Setup**:
- **Internal Port**: 5000 (application listens here)
- **External Port**: Should map to 80 for standard web access
- **Technology**: Vite dev server integrated into Express via middleware (not running separately)

**How It Works**:
1. Express server starts on port 5000
2. In development mode, Vite middleware is integrated into Express
3. All frontend and backend traffic flows through port 5000
4. No separate Vite server on port 5173 - it's embedded in Express

**Important Notes**:
- The application does NOT run on port 3000
- Port 5173 is not used in production (Vite middleware mode)
- For proper external access, `.replit` should map `localPort = 5000` to `externalPort = 80`
- This single-port design simplifies deployment and avoids CORS issues

**Correct `.replit` Port Mapping** (manual update required):
```toml
[[ports]]
localPort = 5000
externalPort = 80
```

**Why This Matters**:
- `localPort = 5000`: Matches where the app actually listens
- `externalPort = 80`: Standard HTTP port for web traffic (no port number in URL)
- Ensures traffic is routed correctly to the application

## Documentation

### Product Requirements Document (PRD)
- **PRODUCT_REQUIREMENTS_DOCUMENT.md**: Comprehensive PRD covering all product requirements, user stories, technical specifications, and success metrics for ShiftMate

## Changelog
- October 29, 2025. DESIGN: Enhanced dashboard visual design with improved metric cards featuring gradient icons, better shadows and spacing. Updated shift type color palette (amber for morning, blue for afternoon, indigo for night). Added smooth transitions and animations in global CSS. Created comprehensive dashboard design guidelines with color palette, typography hierarchy, and responsive behavior specifications.
- October 29, 2025. DEPLOYMENT: Fixed Cloud Run deployment configuration - added [deployment] section to .replit with proper build and production run commands
- October 29, 2025. DEPLOYMENT: Documented required production environment variables and Google OAuth callback URL setup for production deployments
- October 29, 2025. AUTHENTICATION: Fixed Google OAuth callback URL to use dynamic absolute URLs (REPLIT_DEV_DOMAIN) instead of relative paths, resolving redirect_uri_mismatch errors
- October 29, 2025. SECURITY: Implemented JWT authentication system with dual-token architecture (access + refresh tokens), SHA-256 token hashing, httpOnly cookies, and enforced JWT_SECRET requirement (removed hardcoded fallback for security)
- October 29, 2025. FEATURE: Added automatic token refresh on 401 errors with request retry in frontend queryClient
- October 29, 2025. DATABASE: Added refreshTokens table with tokenHash, expiresAt, and revokedAt fields for secure token management
- October 29, 2025. DOCUMENTATION: Created AUTH_TESTING.md with comprehensive JWT authentication testing guide and security best practices
- October 29, 2025. DOCUMENTATION: Added comprehensive port configuration documentation explaining single-port architecture (port 5000) and correct .replit mapping requirements
- October 29, 2025. INFRASTRUCTURE: Fixed critical server startup issues - removed keepalive .unref(), created dirname-shim.mjs for ES module __dirname support, corrected server/package.json configuration
- September 26, 2025. FEATURE: Implemented comprehensive roster planning functionality for business accounts including visual weekly grid interface, manager shift assignments, modal-based CRUD operations, and real-time roster management with full API backend support
- September 26, 2025. DOCUMENTATION: Created comprehensive Product Requirements Document (PRD) with user stories, technical requirements, and success metrics
- September 26, 2025. BUGFIX: Fixed Daily Summary Table in business dashboard to properly display employee hours by handling undefined values
- August 12, 2025. MAJOR FIX: Resolved critical JWT authentication issue preventing shift data access across all dashboards
- August 12, 2025. Updated all data hooks (individual and business) to use JWT-enabled apiRequest instead of basic fetch
- August 12, 2025. Individual users can now access all 47+ shifts with proper authentication and analytics
- August 12, 2025. Business dashboard now displays 105+ company shifts from 4 employees with real-time data
- August 11, 2025. Fixed critical multi-tenant data integrity issue: Individual user shifts now automatically associate with their company, enabling real-time visibility in business dashboards
- August 11, 2025. Resolved routing 404 errors for both business and individual users with proper wildcard catch-all routes
- August 11, 2025. Updated 10 historical shifts to have proper company association, restoring business timeline data integrity
- August 8, 2025. Implementing multi-tenant architecture with separate user and business portals similar to Deputy-style interface
- August 8, 2025. Updated database schema to support companies table, user types, and business management features
- August 8, 2025. Changed "This Week's Hours" to display last 7 days (rolling period) instead of Monday-Sunday week
- August 8, 2025. Created landing page for portal selection between individual users and business accounts
- July 11, 2025. Redesigned Calendar to Google Calendar-style weekly view with hourly time slots (6 AM - 11 PM)
- July 11, 2025. Integrated ShiftMate logo throughout the application (header, sidebar, mobile sidebar, and login page)
- July 11, 2025. Fixed chart display issues with minPointSize, Y-axis domain, and proper shift type mapping
- June 28, 2025. Implemented persistent authentication with 1-year session duration and cross-device support
- June 13, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.