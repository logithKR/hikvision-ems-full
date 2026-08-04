# Hikvision Employee Management System — AI Agent Context

> **Purpose**: This file is the single source of truth for any AI agent working on this project.
> Read this BEFORE making any changes. It explains the architecture, conventions, roles, data models, and business rules so you don't need to be told twice.

---

## 1. Project Overview

A multi-tenant Employee Management System (EMS) built for **Praskla Technology**.
It manages employees, attendance (with optional Hikvision device integration), leave requests, departments, and organizational hierarchy across multiple organizations.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite 6, React Router v6, TanStack React Query, Radix UI (shadcn/ui), Tailwind CSS v4, Recharts |
| **Backend** | Node.js + Express.js (CommonJS `require()` — NOT ESM) |
| **Database** | Google Cloud Firestore (NoSQL) |
| **Auth** | Firebase Admin SDK (custom tokens → ID tokens) |
| **Realtime** | Socket.io + Firestore snapshot listeners |
| **Cache** | Redis (optional, has in-memory fallback) |
| **State** | React Query for server state, React Context for auth, `sessionStorage` for tokens |

---

## 2. Monorepo Structure

```
hikvision-ems-full/
├── backend/                    # Express API server (CommonJS)
│   ├── server.js               # Entry point — Express + Socket.io setup
│   ├── container.js            # Dependency Injection singleton
│   ├── firebase-admin.js       # Firebase Admin SDK initialization
│   ├── middleware.js            # Auth + role-based access middleware
│   ├── config/
│   │   └── redis.js            # Redis client (optional)
│   ├── repositories/           # Data access layer (Firestore queries)
│   │   ├── BaseRepository.js   # Shared CRUD methods
│   │   ├── UserRepository.js
│   │   ├── AttendanceRepository.js
│   │   ├── LeaveRepository.js
│   │   ├── DepartmentRepository.js
│   │   ├── OrganizationRepository.js
│   │   ├── StatisticsRepository.js
│   │   └── AuditLogRepository.js
│   ├── services/               # Business logic layer
│   │   ├── EmployeeService.js  # CRUD, promote/demote, department management
│   │   ├── AttendanceService.js
│   │   ├── LeaveService.js     # Leave lifecycle (apply, approve, reject)
│   │   ├── QuotaService.js     # Admin employee creation limits
│   │   ├── NotificationService.js  # Socket.io push
│   │   ├── AuditLogService.js
│   │   ├── StatisticsService.js
│   │   └── RealtimeListeners.js    # Firestore snapshot → Socket.io bridge
│   ├── routes/                 # Express route handlers
│   │   ├── auth.js             # Login, register, Google auth, profile
│   │   ├── admin.js            # Employee/dept/quota/dashboard CRUD
│   │   ├── attendance.js       # Employee attendance endpoints
│   │   ├── leave.js            # Leave apply/cancel + BO approval
│   │   ├── team.js             # Tech Lead / Manager team views
│   │   ├── system_admin.js     # Super admin — org management
│   │   └── hikvision.js        # Device callback (CURRENTLY DISABLED)
│   ├── migration/              # One-off data migration scripts
│   └── scripts/                # Utility scripts
│
├── frontend/                   # Vite + React SPA
│   ├── index.html              # Entry HTML (dynamic favicon)
│   ├── src/
│   │   ├── main.jsx            # React root — providers, QueryClient
│   │   └── App.jsx             # All routes defined here
│   ├── app/                    # Pages (organized by role)
│   │   ├── globals.css         # Global styles + dark mode palette
│   │   ├── page.jsx            # Landing page (/)
│   │   ├── login/page.jsx      # Unified login page
│   │   ├── admin/              # Admin dashboard pages
│   │   │   ├── layout.jsx      # Sidebar + navbar wrapper
│   │   │   ├── dashboard/page.jsx
│   │   │   ├── employees/page.jsx  # Main employee + dept CRUD (LARGEST FILE)
│   │   │   ├── attendance/page.jsx
│   │   │   ├── leave-requests/page.jsx
│   │   │   ├── org-chart/page.jsx
│   │   │   └── profile/page.jsx
│   │   ├── employee/           # Employee dashboard pages
│   │   │   ├── layout.jsx
│   │   │   ├── dashboard/page.jsx
│   │   │   ├── attendance/page.jsx
│   │   │   ├── leave-requests/page.jsx
│   │   │   ├── weekly-hours/page.jsx
│   │   │   ├── profile/page.jsx
│   │   │   └── team/           # Tech Lead / Manager team views
│   │   │       ├── page.jsx
│   │   │       ├── attendance/page.jsx
│   │   │       └── leaves/page.jsx
│   │   ├── business-owner/     # Business Owner dashboard pages
│   │   │   ├── layout.jsx
│   │   │   ├── register/page.jsx  # Org registration (public)
│   │   │   ├── dashboard/page.jsx
│   │   │   ├── employees/page.jsx  # Read-only employee view
│   │   │   ├── attendance/page.jsx
│   │   │   ├── leave-requests/page.jsx  # Approve Tech Lead leaves
│   │   │   └── profile/page.jsx
│   │   ├── system-admin/       # Super admin pages
│   │   │   ├── layout.jsx
│   │   │   ├── dashboard/page.jsx
│   │   │   ├── organizations/page.jsx
│   │   │   └── profile/page.jsx
│   │   ├── components/         # Shared app-level components
│   │   ├── config/             # App configuration
│   │   └── hooks/              # Custom React hooks
│   ├── components/             # Core UI components
│   │   ├── ui/                 # shadcn/ui primitives (button, card, dialog, etc.)
│   │   ├── theme-provider.jsx  # Light/dark theme context
│   │   ├── theme-toggle.jsx    # Theme switch button
│   │   ├── admin-navbar.jsx
│   │   ├── admin-sidebar.jsx
│   │   ├── employee-navbar.jsx
│   │   └── employee-sidebar.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx     # React context for auth state
│   └── lib/                    # Utility libraries
│       ├── auth.js             # Login/logout/token helpers
│       ├── firebaseClient.js   # Firebase client SDK init
│       ├── api.js              # Fetch wrapper with auth headers
│       ├── redirectUtils.js    # Role-based navigation
│       └── utils.ts            # cn() classname merger
│
├── BUSINESS_RULES_SUMMARY.md   # Business rules reference (PARTIALLY OUTDATED)
├── AI_CONTEXT.md               # THIS FILE — AI agent context
└── README.md
```

---

## 3. User Roles & Hierarchy

The system has a strict role hierarchy. **Terminology matters — read carefully.**

| Role | DB Value | Description |
|------|----------|-------------|
| **System Admin** | `system_admin` | Super admin. Stored in root `users` collection (NOT inside any org). Manages all organizations. |
| **Business Owner** | `business_owner` | Owner of one organization. Can view everything, approve Tech Lead leaves, manage admin quotas. Created during org registration. |
| **Admin** | `admin` | Organization administrator. Full CRUD on employees, departments, attendance, leaves. Has an employee creation quota. |
| **Tech Lead** | `employee` + `isDeptHead: true` | Department head. Role string is still `employee` but flagged with `isDeptHead: true`. Approves leaves for dept members. **Previously called "HOD" — now renamed to "Tech Lead" everywhere in UI and API messages.** |
| **Manager** | `employee` + `isManager: true` | Middle manager. Has `directReports[]` array. Reports to Tech Lead. |
| **Employee** | `employee` | Regular employee. May have a `managerId` pointing to a Manager or Tech Lead. |

### ⚠️ CRITICAL: Tech Lead is NOT a separate role

The `role` field is always `'employee'` for Tech Leads. The distinction is the boolean flag `isDeptHead: true`. The internal state identifier in some frontend components still uses the string `'hod'` for conditional logic (e.g., `deptMemberType === 'hod'`), but ALL user-facing labels must say **"Tech Lead"**, never "HOD" or "Department Head".

### Leave Approval Chain

```
Employee → Tech Lead (isDeptHead) approves
Tech Lead → Business Owner approves
Manager → Tech Lead approves (same as employee)
```

---

## 4. Firestore Data Model

### Multi-tenant Structure

```
organizations/{orgId}                    # Organization document
organizations/{orgId}/users/{userId}     # Employee documents
organizations/{orgId}/attendance/{docId} # Attendance records (ID: {userId}_{date})
organizations/{orgId}/leaves/{leaveId}   # Leave requests
organizations/{orgId}/departments/{deptId}  # Departments
organizations/{orgId}/audit_logs/{logId} # Audit trail
organizations/{orgId}/statistics/{...}   # Cached statistics

users/{userId}                           # ROOT collection — System Admins only
```

### Key Document Schemas

#### User Document (`organizations/{orgId}/users/{userId}`)
```json
{
  "id": "firebaseUID",
  "name": "John Doe",
  "email": "john@example.com",
  "passwordHash": "...",
  "role": "employee | admin | business_owner",
  "department": "Engineering",
  "departmentId": "dept_abc123",
  "position": "Tech Lead | Manager | Developer",
  "phone": "+1234567890",
  "isActive": true,
  "isDeptHead": false,
  "isManager": false,
  "isTeamLead": false,
  "managerId": "uid_of_manager_or_techlead",
  "managerName": "Jane Smith",
  "directReports": ["uid1", "uid2"],
  "createdBy": "admin_uid",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "organizationId": "orgId",
  "hikvisionEmployeeId": "optional_device_id"
}
```

#### Department Document (`organizations/{orgId}/departments/{deptId}`)
```json
{
  "id": "deptId",
  "name": "Engineering",
  "description": "...",
  "headId": "userId_of_tech_lead",
  "headName": "Tech Lead Name",
  "maxEmployees": 50,
  "memberCount": 12,
  "createdBy": "admin_uid",
  "createdAt": "ISO timestamp"
}
```

#### Leave Document (`organizations/{orgId}/leaves/{leaveId}`)
```json
{
  "id": "leaveId",
  "userId": "requesting_user_id",
  "userName": "Employee Name",
  "userRole": "employee",
  "leaveType": "sick | casual | vacation",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "days": 3,
  "reason": "...",
  "status": "pending | approved | rejected",
  "approverId": "tech_lead_or_bo_uid",
  "approverName": "Approver Name",
  "reviewedBy": "reviewer_uid",
  "reviewedByName": "Reviewer Name",
  "reviewComments": "...",
  "reviewedAt": "ISO timestamp",
  "createdAt": "ISO timestamp"
}
```

---

## 5. Backend Architecture

### Dependency Injection

All services and repositories are instantiated in `container.js` (singleton pattern). Routes access them via:
```javascript
const container = require('./container');
const employeeService = container.getEmployeeService();
```

**NEVER instantiate services directly in route files.** Always go through the container.

### Middleware Chain

Every protected route uses: `authenticateToken` → `requireRole` middleware.

```javascript
router.get('/endpoint', authenticateToken, requireAdmin, handler);
```

Available role middleware:
- `requireAdmin` — `role === 'admin'`
- `requireBusinessOwner` — `role === 'business_owner'`
- `requireAdminOrBusinessOwner` — either of above
- `requireSystemAdmin` — `role === 'system_admin'`
- `requireTeamLead` — `isDeptHead || isManager || admin || business_owner`
- `requireManagerOrHOD` — same as above (function name is legacy)
- `requireDeptHead` — `isDeptHead || admin || business_owner`
- `requireEmployee` — any authenticated user

### API Route Prefixes

| Prefix | File | Access |
|--------|------|--------|
| `/api/auth` | `routes/auth.js` | Public (login, register) + authenticated (profile) |
| `/api/admin` | `routes/admin.js` | Admin + Business Owner |
| `/api/attendance` | `routes/attendance.js` | Any authenticated employee |
| `/api/leave` | `routes/leave.js` | Employee (apply/cancel) + BO (approve Tech Lead leaves) |
| `/api/team` | `routes/team.js` | Tech Lead + Manager (team views, leave approval) |
| `/api/system-admin` | `routes/system_admin.js` | System Admin only |

### Department Endpoints (inside admin routes)

```
POST   /api/admin/departments              # Create department
GET    /api/admin/departments              # List all departments
GET    /api/admin/departments/:id          # Get department + members
PUT    /api/admin/departments/:id          # Update department
DELETE /api/admin/departments/:id          # Delete department + soft-delete members
POST   /api/admin/departments/:id/hod      # Create Tech Lead for department
POST   /api/admin/departments/:id/employees # Add employee to department
POST   /api/admin/departments/:id/managers  # Add manager to department
```

> **Note**: The route path is `/hod` but the response says "Tech Lead created". This is intentional — changing the route path would break existing frontend calls.

---

## 6. Frontend Architecture

### Provider Hierarchy (in main.jsx)

```
React.StrictMode
  └── BrowserRouter
      └── QueryClientProvider (staleTime: 30s, gcTime: 5min)
          └── AuthProvider (React Context)
              └── SocketProvider
                  └── ThemeProvider (default: "light", key: "ems-ui-theme-v2")
                      └── App (routes)
```

### Authentication Flow

1. User logs in via `/login` page
2. Backend returns `firebaseToken` (custom token)
3. Frontend exchanges it for a Firebase ID token via `signInWithCustomToken()`
4. ID token stored in `sessionStorage` as `firebaseToken`
5. All API calls include `Authorization: Bearer <idToken>` header
6. Token refresh handled by `getValidIdToken()` in `lib/firebaseClient.js`

### API Calls Pattern

Pages use **TanStack React Query** for data fetching:
```javascript
const { data, isLoading } = useQuery({
  queryKey: ['employees'],
  queryFn: async () => {
    const token = await getValidIdToken();
    const res = await fetch(`${getApiBase()}/admin/employees`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  }
});
```

The `getApiBase()` function returns `import.meta.env.VITE_API_URL || ''`. In development, Vite proxies `/api` to `http://localhost:3000`.

### Theme System

- Default theme: **Light mode** (enforced via `ems-ui-theme-v2` storage key)
- Dark mode uses a professional deep slate/navy `oklch` palette defined in `globals.css`
- Favicon dynamically switches between `/favicon-light.png` and `/favicon-dark.png` based on active theme (logic in `theme-provider.jsx`)
- All components MUST use CSS variables (`bg-background`, `text-foreground`, etc.) — never hardcode colors

### UI Component Library

Uses **shadcn/ui** (Radix UI + Tailwind). Components live in `frontend/components/ui/`.
Import pattern: `import { Button } from "@/components/ui/button"`

---

## 7. Development Commands

```bash
# Backend (from /backend)
node server.js              # Start backend on port 3000

# Frontend (from /frontend)
npm run dev                 # Start Vite dev server on port 5173
npm run build               # Production build to /frontend/dist

# Utilities (from /backend)
node create-system-admin.js # Create a system admin user
node reset-password.js      # Reset a user's password
node migration/migrate-hod-to-techlead.js  # Migrate HOD→Tech Lead (already run)
```

### Environment Variables

**Backend** (`backend/.env`):
- `PORT` — Server port (default: 3000)
- `NODE_ENV` — `development` | `production`
- `FIREBASE_CREDENTIALS` or `serviceAccountKey.json` — Firebase admin credentials
- `REDIS_URL` — Optional Redis connection string
- `FRONTEND_URL` — CORS origin (default: `http://localhost:5173`)

**Frontend** (`frontend/.env`):
- `VITE_API_URL` — Backend URL (empty string = same origin with Vite proxy)
- `VITE_FIREBASE_*` — Firebase client SDK config keys

---

## 8. Conventions & Rules

### Naming
- Backend: CommonJS (`require/module.exports`), camelCase for variables, PascalCase for classes
- Frontend: ES modules (`import/export`), JSX files use `.jsx` extension, UI components use `.tsx`
- API responses: `{ message, data }` on success, `{ error }` on failure

### Soft Deletes
Employees are NEVER physically deleted. They are soft-deleted: `isActive: false`, `deletedAt: timestamp`.

### Department Rules
- A department MUST have a Tech Lead (`headId`) before employees or managers can be added
- Deleting a department soft-deletes ALL its members atomically (Firestore batch)
- Department `memberCount` is tracked on the department document

### Quota System
- Admins have a limit on how many employees they can create
- Business Owners can adjust admin quotas via `/api/admin/admins/:id/quota`
- Quota is checked before every employee creation

### Leave Routing
- When an employee applies for leave, `approverId` is set to their Tech Lead (via `isDeptHead` lookup)
- When a Tech Lead applies for leave, `approverId` is set to the Business Owner
- The `approverId` determines whose pending queue the leave appears in

### Organization Chart
- The `/api/admin/org-chart` endpoint builds a hierarchy: Department → Tech Lead → Managers → Employees
- Uses a `assignedUserIds` Set to prevent duplicate nodes in the tree
- Unassigned employees (no department) are listed separately

---

## 9. Known Technical Debt

| Issue | Details |
|-------|---------|
| **Backend route path `/hod`** | The API endpoint is still `/api/admin/departments/:id/hod` but creates a "Tech Lead". Changing the path would require frontend updates. |
| **Internal `'hod'` state string** | `admin/employees/page.jsx` uses `deptMemberType === 'hod'` as an internal state value (not user-facing). Should be refactored to `'tech_lead'` for consistency. |
| **Backend comments** | Several backend files still have comments referencing "HOD" (e.g., `team.js`, `AttendanceService.js`). These are code comments only, not user-facing. |
| **`main.jsx` ThemeProvider** | `main.jsx` still passes `storageKey="ems-ui-theme"` but `theme-provider.jsx` defaults to `"ems-ui-theme-v2"`. The component's default wins, but this should be aligned. |
| **`page_old.jsx`** | `admin/employees/page_old.jsx` is a deprecated backup file that should be deleted. |
| **Hikvision integration** | Currently disabled in `server.js`. Route file exists but is not imported. |
| **Password storage** | Passwords are stored with basic hashing. Consider upgrading to bcrypt with proper salting. |
| **CORS** | Currently allows all origins (`callback(null, true)`). Should be locked down for production. |

---

## 10. Quick Reference: Common Tasks

### Adding a new page
1. Create `frontend/app/{role}/{page-name}/page.jsx`
2. Add route in `frontend/src/App.jsx` inside the appropriate `<Route>` group
3. Add navigation link in `frontend/app/{role}/layout.jsx` sidebar

### Adding a new API endpoint
1. Add route handler in the appropriate `backend/routes/*.js` file
2. Add business logic in the corresponding `backend/services/*.js`
3. Add data access in the corresponding `backend/repositories/*.js`
4. Apply correct middleware: `authenticateToken` + role guard

### Modifying the Firestore schema
1. Update the repository that reads/writes the affected collection
2. If existing documents need updating, write a migration script in `backend/migration/`
3. Update this documentation

### Changing UI terminology
1. Search frontend with `grep -ri "old term"` across all `.jsx` files
2. Search backend for user-facing strings (API responses, error messages)
3. Check `BUSINESS_RULES_SUMMARY.md` and this file
4. If the term exists in Firestore documents, write a migration script
