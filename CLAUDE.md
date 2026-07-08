# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DocBook** is a Next.js full-stack application for local dispensary doctor booking and live queue tracking. It provides:
- Patient appointment booking and queue tracking
- Doctor session management and queue operations
- Admin dashboard for doctor verification and payment management
- Real-time queue status updates

The application uses a single MongoDB document to store all application state, making it easy to test locally and deploy without complex database migrations.

## Architecture

### Data Model
All data is stored as a single JSON-like document in MongoDB (see `src/lib/types.ts` for the complete schema). The core entities are:
- **Users** (role: patient, doctor, admin) with authentication via JWT
- **DoctorProfiles** with sessions and specializations
- **Appointments** with queue positions and status tracking
- **QueueSessions** for managing active doctor queues
- **Notifications** for user updates

### Tech Stack
- **Framework**: Next.js 16 (React 19, TypeScript)
- **Database**: MongoDB (single document pattern)
- **UI Components**: Ant Design (antd)
- **Auth**: JWT + bcryptjs for password hashing
- **Validation**: Zod for API request validation

### Directory Structure
```
src/
├── app/              # Next.js App Router pages and API routes
│   ├── api/          # REST API endpoints (route handlers)
│   ├── patients/     # Patient-facing pages
│   ├── doctors/      # Doctor portal pages
│   └── admin/        # Admin dashboard pages
├── components/       # React components (currently mostly MediQueueApp.tsx - a monolithic client component)
├── lib/
│   ├── db.ts         # MongoDB connection and database mutations
│   ├── auth.ts       # JWT session and cookie management
│   ├── types.ts      # TypeScript type definitions for all entities
│   └── http.ts       # Response helpers (ok, fail)
└── data/             # Local JSON data for reference/testing
```

### Data Access Pattern
All data operations go through `src/lib/db.ts`:
- `readDb()` - reads the full database document
- `writeDb()` - replaces the entire document
- `mutateDb(fn)` - atomic read-modify-write: calls fn with current db, fn mutates db, then writes back
- Helper functions like `publicDoctor()`, `appointmentView()`, `recalculateQueue()`, `notify()`

**Critical invariant**: `mutateDb()` performs the read and write sequentially in a single async operation. Do NOT split reads and writes across separate requests or you'll lose concurrent mutations.

### Authentication
- Sessions stored as JWT cookies (7-day expiration)
- User roles determine access: patient, doctor, admin
- Session verification via `getCurrentUser(requiredRole?)` in each protected route
- Passwords hashed with bcryptjs

### UI/UX
- Single monolithic `MediQueueApp.tsx` component handles all routing logic client-side
- Uses Ant Design for UI components and layout
- Responsive design for patients to check queue status, book appointments, and doctors to manage their queue

## Development

### Setup
```bash
# Install dependencies
npm install

# Create .env.local with MongoDB connection and admin credentials
# Copy .env.example and fill in your values
cp .env.example .env.local

# Run dev server
npm run dev
# Open http://localhost:3000
```

### Build & Deploy
```bash
# Build for production
npm run build

# Start production server
npm start

# Lint the codebase
npm lint
```

### Key Environment Variables
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB` - Database name (default: "docbook")
- `MONGODB_COLLECTION` - Collection name (default: "app_state")
- `JWT_SECRET` - Secret for signing JWT tokens
- `ADMIN_PHONE`, `ADMIN_PASSWORD` - Initial admin account (used only on first startup)

## Common Tasks

### Adding a New API Endpoint
1. Create a route handler in `src/app/api/[path]/route.ts`
2. Use `getCurrentUser(requiredRole)` to protect with auth
3. Use `mutateDb()` to safely read and modify the database
4. Return responses via `ok()` or `fail()` helpers

### Adding a New Page
1. Create the page in `src/app/[role]/page.tsx` (following Next.js App Router conventions)
2. Call `getCurrentUser(requiredRole)` on the server to gate access
3. Redirect to login if not authenticated

### Modifying the Data Schema
1. Update type definitions in `src/lib/types.ts`
2. Add normalization logic in `normalizeDb()` if adding optional fields
3. No database migrations needed - the single-document pattern handles schema flexibility

### Queue Operations
The queue recalculation logic in `recalculateQueue()` is critical:
- Maintains a linear queue of appointments per doctor per session per date
- Recalculates estimated times based on doctor's average consultation minutes
- Called whenever appointment status changes

## Testing Workflow

1. **Local testing**: Use `.env.local` with a local or test MongoDB instance
2. **Admin bootstrap**: The first startup creates an admin user from `ADMIN_*` env vars
3. **Manual testing**: Use the UI to book appointments, manage queues, and verify status updates
4. **API testing**: All endpoints return JSON and can be tested with `curl` or Postman

## Important Patterns & Gotchas

### Atomic Updates
Always use `mutateDb()` for any operation that reads and writes data. Never do:
```typescript
// WRONG: Two separate requests
const db = await readDb();
db.users.push(newUser);
await writeDb(db);
```

### User Status & Active Check
User accounts have a `status` field (active, blocked, pending, suspended). Login and auth checks verify `status === "active"`. Blocking a user prevents login.

### Appointment Status Lifecycle
Appointments flow through states: pending → confirmed → waiting → current → completed (or cancelled/no-show/rescheduled). Each state transition may require queue recalculation.

### Session Cookies
JWT cookies are `httpOnly` and `sameSite: lax`. The cookie name is hardcoded as `docbook_session` in `src/lib/auth.ts`.

## Code Style
- TypeScript strict mode enabled
- No unused variables or imports (linted by Next.js)
- Prefer functional components and hooks
- Use type-safe helpers from `src/lib/db.ts` for data access

## Related Files
- `.env.example` - Environment variable template
- `.next/` - Build output (gitignored, regenerated on build)
- `node_modules/` - Dependencies (gitignored)
