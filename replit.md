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
- Google OAuth integration for secure login
- Session-based authentication with persistent storage
- User profile management with automatic account creation
- Mobile-optimized biometric authentication support (planned)

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
- Port 5000 internal, port 80 external mapping
- Environment-specific build optimization

## Changelog
- July 11, 2025. Redesigned Calendar page to show 2-week view with shift hours displayed directly on calendar
- July 11, 2025. Integrated ShiftMate logo throughout the application (header, sidebar, mobile sidebar, and login page)
- July 11, 2025. Fixed chart display issues with minPointSize, Y-axis domain, and proper shift type mapping
- June 28, 2025. Implemented persistent authentication with 1-year session duration and cross-device support
- June 13, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.