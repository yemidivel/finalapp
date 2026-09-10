# SellSync - Complete Documentation

**Version 2.2**  
**AI-Powered Multi-Store Management System for Nigerian Businesses**

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Architecture & Data Flow](#architecture--data-flow)
4. [Multi-Store Management](#multi-store-management)
5. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
6. [Role Hierarchy & User Management Workflow](#role-hierarchy--user-management-workflow)
7. [Password & Security Policy](#password--security-policy)
8. [Notification System](#notification-system)
9. [Features](#features)
10. [Components](#components)
11. [API Reference](#api-reference)
12. [User Guide](#user-guide)
13. [Recent Changes](#recent-changes)
14. [Troubleshooting](#troubleshooting)

---

## Overview

SellSync is a comprehensive SaaS web dashboard designed for Nigerian small and medium business owners who manage multiple store locations. It combines point-of-sale, inventory management, AI-powered insights, role-based access control, and multi-store analytics in a single platform.

### Core Philosophy

SellSync operates on a **single-owner-multi-store** model:
- One business owner (Admin) manages all stores from one dashboard
- Each store has its own inventory, transactions, and staff
- Cashier users can only access their assigned store
- The Admin has full visibility and control across all stores
- Significant actions (deletions) are Admin-only per store
- All non-admin actions (add product/category) notify the Admin

### Target Users

- Small business owners in Nigeria with multiple locations
- Shop keepers and retailers
- Multi-location business managers
- Store staff and cashiers
- Convenience store operators

---

## Getting Started

### System Requirements

| Requirement | Specification |
|-------------|---------------|
| Browser | Chrome, Firefox, Safari, Edge (latest) |
| JavaScript | ES6+ enabled |
| Node.js | 18+ |
| React | 18+ |
| Package Manager | npm, pnpm, or yarn |

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app will be available at `http://localhost:5173`

> **Fresh installs start empty.** No demo data ships with the app. On first
> launch a setup screen asks for your store information and automatically
> creates the administrator account. All data is persisted locally in the
> browser (localStorage).
>
> The first store created during setup is the **Admin's oversight store**
> (`isAdminStore: true`). It is non-operational by design — it oversees all
> other stores and can **never** be assigned a Manager or a Cashier (blocked in
> both the UI pickers and the `ADD_USER`/`UPDATE_USER` reducer guards). It is
> also **permanently undeletable**: no delete button is shown for it anywhere
> and the `DELETE_STORE` reducer refuses it. Removing it requires contacting
> SellSync directly.
>
> **Store deletion rules:**
> - **Admin's oversight store** — cannot be deleted, period.
> - **Admin (other stores)** — deletes directly from Stores / Store Locations;
>   the store is removed together with its Manager and all its Cashiers.
> - **Manager** — Settings → My Store Profile → **Danger Zone → Delete This
>   Store** submits a `delete_store` approval request to the Admin (Admin-only
>   approval). On approval the store, its Manager and all its Cashiers are
>   deleted. Cashiers have no delete-store option at all.

### Environment Configuration

Create a `.env` file based on `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:3000   # your backend API base URL
# VITE_API_TOKEN=your_auth_token_here
# VITE_API_DEBUG=true
```

---

## Architecture & Data Flow

### Technology Stack

```
┌─────────────────────────────────────────┐
│              React 18+                   │
│         (TypeScript + JSX)               │
├─────────────────────────────────────────┤
│            Tailwind CSS 3.x              │
│         (Styling + Responsive)          │
├─────────────────────────────────────────┤
│         React Context + Reducer      │
│          (State Management)          │
├─────────────────────────────────────────┤
│           React Router v7                │
│          (Client-side Routing)          │
├─────────────────────────────────────────┤
│    Material UI + Radix UI + shadcn/ui    │
│            (Component Library)           │
├─────────────────────────────────────────┤
│         Recharts (Data Visualization)   │
├─────────────────────────────────────────┤
│           Vite (Build Tool)              │
└─────────────────────────────────────────┘
```

### State Architecture

SellSync uses a **single React Context + `useReducer` store** persisted to `localStorage`. All data — users, stores, inventory, transactions, categories — lives in one shared state. Role-based filtering is applied at the UI layer:

```
┌──────────────────────────────────────────────────┐
│        SellSync Store (Context)       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  Users   │ │  Stores  │ │  Inventory (all)  │  │
│  ├──────────┤ ├──────────┤ ├──────────────────┤  │
│  │ Roles    │ │ Per-store│ │ Categories (global)│  │
│  │ Passwords│ │ settings │ │ Transactions      │  │
│  └──────────┘ └──────────┘ └──────────────────┘  │
├──────────────────────────────────────────────────┤
│              UI Filtering Layer                   │
│  - Admin: sees ALL stores' data                  │
│  - Manager: sees assigned store's data only      │
│  - Cashier: sees assigned store's data only       │
│  - Categories: global, visible to all            │
└──────────────────────────────────────────────────┘
```

### Data Persistence

All data is stored in the browser's `localStorage` under the `sellsync_*` key prefix. This means:
- Data is shared across all users on the same browser
- There is no backend server — the app simulates a multi-user environment
- Refreshing the page preserves all data

### Component Hierarchy

```
App
└── StoreProvider
    └── RouterProvider
        └── Layout
            ├── Sidebar
            │   └── NavItem (x10)
            ├── Header
            │   ├── Search
            │   ├── Notifications
            │   └── UserMenu
            ├── Outlet
            │   ├── DashboardPage
            │   ├── InventoryPage
            │   ├── ProductsPage
            │   ├── TransactionsPage
            │   ├── PosPage
            │   ├── InsightsPage
            │   ├── ForecastsPage
            │   ├── ReportsPage
            │   ├── NotificationsPage
            │   └── SettingsPage
            ├── MobileNav
            ├── FloatingAIButton
            ├── AskAIModal
            └── Dialogs (StoreSwitch, Premium, etc.)
```

### File Structure

```
react 1/
├── src/
│   ├── app/
│   │   ├── components/          # Reusable components
│   │   │   ├── ui/             # Base UI (shadcn/ui)
│   │   │   ├── AIChatModal.tsx
│   │   │   ├── AISummaryCard.tsx
│   │   │   ├── AskAIModal.tsx
│   │   │   ├── BulkPOModal.tsx
│   │   │   ├── CustomReportModal.tsx
│   │   │   ├── EmailShareModal.tsx
│   │   │   ├── ForecastChart.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── POSVoiceButton.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductDetailModal.tsx
│   │   │   ├── QrGeneratorModal.tsx
│   │   │   ├── QrScannerModal.tsx
│   │   │   ├── ReorderTable.tsx
│   │   │   ├── ReportPreviewModal.tsx
│   │   │   └── SMSShareModal.tsx
│   │   ├── pages/              # Page components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ForecastsPage.tsx
│   │   │   ├── InsightsPage.tsx
│   │   │   ├── InventoryPage.tsx
│   │   │   ├── NotificationsPage.tsx
│   │   │   ├── PosPage.tsx
│   │   │   ├── ProductsPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── StaffPage.tsx
│   │   │   └── TransactionsPage.tsx
│   │   ├── state/              # Context + useReducer store
│   │   │   └── store.tsx
│   │   ├── App.tsx             # Root component
│   │   └── routes.tsx          # Route definitions
│   ├── animations/             # Animation utilities
│   ├── lib/                   # Utility functions
│   ├── styles/                # Global styles
│   └── main.tsx               # Entry point
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Backend Integration

### Architecture Overview

SellSync is designed as a **frontend-only SPA** that will connect to a separate backend server. The landing page (marketing site) and the dashboard app are two separate frontends sharing the **same backend database**.

```
┌─────────────────────┐     ┌─────────────────────┐
│   Landing Page      │     │   SellSync App      │
│   (Separate Repo)   │     │   (This Project)    │
│   - Marketing site  │     │   - Dashboard       │
│   - Sign up/login   │     │   - POS             │
│   - Pricing info    │     │   - Inventory       │
└─────────┬───────────┘     └──────────┬──────────┘
          │                            │
          └──────────┬─────────────────┘
                     │ HTTPS / REST
                     ▼
          ┌─────────────────────┐
          │   Backend API       │
          │   (Node.js/Express) │
          ├─────────────────────┤
          │   /api/auth/*       │
          │   /api/stores/*     │
          │   /api/inventory/*  │
          │   /api/products/*   │
          │   /api/sales/*      │
          │   /api/users/*      │
          │   /api/categories/* │
          │   /api/reports/*    │
          │   /api/notifications│
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
          │   PostgreSQL DB     │
          │   (Shared Database) │
          └─────────────────────┘
```

### Suggested Backend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 18+ | Server runtime |
| **Framework** | Express.js or Fastify | REST API framework |
| **Language** | TypeScript | Type safety |
| **Database** | PostgreSQL | Relational data store |
| **ORM** | Prisma or TypeORM | Database access |
| **Auth** | JWT + bcrypt | Authentication |
| **Email** | Nodemailer + SMTP | Password resets, notifications |
| **SMS** | Twilio or Africa's Talking | SMS notifications |
| **File Storage** | Cloudinary or S3 | Product images |
| **Validation** | Zod | Request validation |
| **Testing** | Jest + Supertest | API tests |

### Project Structure (Backend)

```
sellsync-api/
├── src/
│   ├── routes/           # Express route handlers
│   │   ├── auth.ts
│   │   ├── stores.ts
│   │   ├── inventory.ts
│   │   ├── products.ts
│   │   ├── sales.ts
│   │   ├── users.ts
│   │   ├── categories.ts
│   │   ├── reports.ts
│   │   ├── notifications.ts
│   │   └── dashboard.ts
│   ├── middleware/        # Auth, RBAC, validation
│   │   ├── auth.ts
│   │   ├── rbac.ts
│   │   └── validate.ts
│   ├── models/           # Prisma/TypeORM entities
│   ├── services/         # Business logic
│   ├── utils/            # Helpers
│   └── index.ts          # Entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── .env
├── package.json
└── tsconfig.json
```

### Required API Endpoints

#### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login, returns JWT |
| POST | `/api/auth/logout` | Invalidate session |
| POST | `/api/auth/register` | Register new user (from landing page) |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |

#### Stores

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores` | List all stores (Admin) or assigned stores |
| GET | `/api/stores/:id` | Get store details |
| POST | `/api/stores` | Create store (Admin only) |
| PUT | `/api/stores/:id` | Update store (Admin only) |
| DELETE | `/api/stores/:id` | Delete store (Admin only) |
| POST | `/api/stores/switch` | Switch active store |

#### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users (Admin) |
| GET | `/api/users/:id` | Get user details |
| POST | `/api/users` | Create user (Admin only) |
| PUT | `/api/users/:id` | Update user (Admin only) |
| DELETE | `/api/users/:id` | Delete user (Admin only) |
| PUT | `/api/users/:id/password` | Admin reset user password |
| PUT | `/api/users/me/password` | User change own password |

#### Inventory / Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | List inventory (filtered by store) |
| GET | `/api/inventory/:id` | Get product details |
| POST | `/api/inventory` | Add product (Admin/Manager) |
| PUT | `/api/inventory/:id` | Update product (Admin/Manager) |
| DELETE | `/api/inventory/:id` | Delete product (Admin only) |
| PUT | `/api/inventory/:id/stock` | Adjust stock |
| PUT | `/api/inventory/:id/price` | Update price |
| POST | `/api/inventory/bulk-pin` | Pin items to top |

#### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Add category (Admin/Manager) |
| DELETE | `/api/categories/:name` | Delete category (Admin only) |

#### Transactions / Sales

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions (filtered by store) |
| GET | `/api/transactions/:id` | Get transaction details |
| POST | `/api/transactions` | Complete a sale (POS) |
| POST | `/api/transactions/:id/refund` | Refund transaction (Admin only) |
| POST | `/api/transactions/close-day` | Close day (Admin/Manager) |
| GET | `/api/transactions/export` | Export transactions |

#### Dashboard / KPIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/kpis` | Get KPI data for current store |
| GET | `/api/dashboard/sales-trend` | Get sales trend data |
| GET | `/api/dashboard/top-products` | Get top selling products |
| GET | `/api/dashboard/insights` | Get AI-powered insights |

#### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reports/generate` | Generate report (Manager+) |
| GET | `/api/reports` | List generated reports |
| GET | `/api/reports/:id/download` | Download report file |
| POST | `/api/reports/:id/email` | Email report (Manager+) |
| POST | `/api/reports/:id/sms` | SMS report (Manager+) |

#### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user notifications |
| PUT | `/api/notifications/:id/read` | Mark notification as read |
| PUT | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/clear` | Clear notifications (Admin/Manager) |

#### Forecasting

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/forecasts` | Get forecast data |
| POST | `/api/forecasts/simulate` | Run simulation (Manager+) |
| POST | `/api/forecasts/purchase-order` | Generate PO (Manager+) |

### Database Schema (PostgreSQL)

```sql
-- Stores
CREATE TABLE stores (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('Admin', 'Manager', 'Cashier')) NOT NULL,
  phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'Active',
  assigned_store_ids TEXT[], -- Array of store IDs
  base_salary DECIMAL(10,2),
  commission_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inventory Items
CREATE TABLE inventory_items (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2),
  stock INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER DEFAULT 10,
  barcode VARCHAR(100),
  manufactured_date DATE,
  expiry_date DATE,
  image_url TEXT,
  store_id VARCHAR(20) NOT NULL REFERENCES stores(id),
  supplier VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categories (global)
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id VARCHAR(30) PRIMARY KEY,
  store_id VARCHAR(20) NOT NULL REFERENCES stores(id),
  cashier VARCHAR(255),
  customer VARCHAR(255),
  subtotal DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  vat DECIMAL(10,2) DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL,
  payment VARCHAR(50),
  status VARCHAR(20) DEFAULT 'Completed',
  terminal_id VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transaction Items
CREATE TABLE transaction_items (
  id SERIAL PRIMARY KEY,
  transaction_id VARCHAR(30) NOT NULL REFERENCES transactions(id),
  product_id INTEGER NOT NULL REFERENCES inventory_items(id),
  product_name VARCHAR(255),
  qty INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

-- Notifications
CREATE TABLE notifications (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL REFERENCES users(id),
  type VARCHAR(20) CHECK (type IN ('info', 'success', 'warning', 'alert')),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(255),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Permissions
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(20) NOT NULL,
  module VARCHAR(100) NOT NULL,
  can_view BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  UNIQUE(role, module)
);

-- Attendance
CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL REFERENCES users(id),
  store_id VARCHAR(20) NOT NULL REFERENCES stores(id),
  clock_in TIMESTAMP,
  clock_out TIMESTAMP,
  date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'Present'
);

-- Payroll
CREATE TABLE payroll (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL REFERENCES users(id),
  store_id VARCHAR(20) NOT NULL REFERENCES stores(id),
  base_salary DECIMAL(10,2),
  commission DECIMAL(10,2) DEFAULT 0,
  bonuses DECIMAL(10,2) DEFAULT 0,
  deductions DECIMAL(10,2) DEFAULT 0,
  net_pay DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'Pending',
  payment_date DATE,
  period_start DATE,
  period_end DATE
);
```

### Environment Variables (Backend)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sellsync

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS (Africa's Talking)
AT_API_KEY=your-api-key
AT_USERNAME=sandbox

# File Upload (Cloudinary)
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Frontend URLs
FRONTEND_APP_URL=http://localhost:5173
FRONTEND_LANDING_URL=http://localhost:3001
```

### Frontend Integration

> 📘 **Full guide:** see **[`BACKEND_INTEGRATION.md`](BACKEND_INTEGRATION.md)** — it covers the file-by-file wiring, the auth flow, the `/link/*` endpoint contract, the data-sync strategy, and the Admin ⇄ Manager ⇄ Cashier login scenario.

The current frontend uses `localStorage` as its data layer. To connect to the backend:

1. **Enable the API service layer** at `src/lib/api.ts` (currently scaffolded, all functions commented out)
2. **Replace store persistence**: Instead of reading/writing to `localStorage`, call the API
3. **Add authentication flow**: Login stores JWT, attaches to all requests via a headers helper
4. **Handle loading/error states**: Every API call needs loading, success, and error handling

```typescript
// Example API service structure (src/lib/api.ts)
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sellsync_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: RegisterData) => api.post('/auth/register', data),
};

export const storeApi = {
  list: () => api.get('/stores'),
  get: (id: string) => api.get(`/stores/${id}`),
  switch: (id: string) => api.post('/stores/switch', { id }),
};

export const inventoryApi = {
  list: (storeId: string) => api.get(`/inventory?storeId=${storeId}`),
  create: (data: Omit<InventoryItem, 'id'>) => api.post('/inventory', data),
  update: (id: number, data: Partial<InventoryItem>) => api.put(`/inventory/${id}`, data),
  delete: (id: number) => api.delete(`/inventory/${id}`),
};
```

---

### Concept

The Admin owns multiple stores (e.g., 6 different locations). Each store has its own:
- Inventory (products, stock levels, prices)
- Transactions (sales, refunds)
- Team (Manager, Cashier)
- Settings (receipts, payments)

### Store Switching & Admin Overview

- **Admin — Overview mode**: By default the Admin sees an **overview** sidebar (Dashboard, Stores, Inventory, Insights, Forecasts, Reports, Team, Notifications, Settings). In overview, all data is **cross-store** and operational modules (Inventory, Products, POS, Transactions) are read-only — the Admin oversees, not operates.
- **Admin — Inside a store**: Picking a store from **Stores → Enter Store** (or **Change Store**) switches the Admin into that store's context. The sidebar then shows the **Manager's operational tabs** (Products, POS, Inventory, Transactions, Staff) so the Admin sees exactly what happens in that store. Use **profile menu → Back to Store Overview** to return.
- **Manager/Cashier**: Switch only between their own assigned store(s)
- When switching, all data (inventory, transactions, KPIs) refreshes for the selected store

### Assigning Users to Stores

When creating a user (from the **Team** tab or **Settings → Users & Roles**):
1. Admin sets the user's role — **Manager** or **Cashier**
2. Admin assigns the user to exactly one store
3. A **Manager** can only be assigned to a store that has no Manager yet
4. A **Cashier** can be assigned to any store (the store's Manager supervises them)
5. Users only see data from their assigned store(s)

### Store Isolation

Each inventory item and transaction carries a `storeId`. The filtering logic ensures:
- Manager/Cashier users only see items where `storeId` matches their assigned store
- Categories are **global** — shared across all stores (since they're just a string list)

---

## Role-Based Access Control (RBAC)

### Roles Overview

| Role | Dashboard | Inventory | POS | Reports | Settings | User Management |
|------|-----------|-----------|-----|---------|----------|-----------------|
| **Admin** | Full | Full | Full | Full | Full | Full |
| **Manager** | View/Edit | View/Edit | Full | View/Edit | Limited | Self |
| **Cashier** | View | View | Full | View | None | Self |

### Permission Matrix

Each module has configurable permissions. The `canEdit(module)` function checks:
1. The user's role
2. The module's permission matrix (Admin/Manager/Cashier)
3. Whether the current view is a global store view

### Action Gating (Implemented)

| Action | Admin | Manager | Cashier |
|--------|-------|---------|-------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Inventory | ✅ | ✅ | ✅ |
| View Products | ✅ | ✅ | ✅ |
| View Transactions | ✅ | ✅ | ✅ |
| Use POS | ✅ | ✅ | ✅ |
| View Insights | ✅ | ✅ | ❌ |
| View Forecasts | ✅ | ✅ | ❌ |
| View Reports | ✅ | ✅ | ❌ |
| Export Data | ✅ | ✅ | ❌ |
| Add Product | ✅ | ✅ | ❌ |
| Edit Product | ✅ | ✅ | ❌ |
| Delete Product | ✅ | ❌ | ❌ |
| Add Category | ✅ | ✅ | ❌ |
| Delete Category | ✅ | ❌ | ❌ |
| Edit Stock | ✅ | ✅ | ❌ |
| Process Refund | ✅ | ❌ | ❌ |
| Close Day | ✅ | ✅ | ❌ |
| View Settings | ✅ | ✅ | ❌ |
| Manage Users | ✅ | ❌ | ❌ |
| Manage Stores | ✅ | ❌ | ❌ |
| Reset Passwords | ✅ | ❌ | ❌ |

### Admin Overview Read-only Restriction

When the Admin is in **overview** mode (not inside a store), editing actions on operational modules (Inventory, Products, POS, Transactions) are disabled — the Admin oversees stock across all stores but cannot edit it from the overview. To edit, the Admin enters a specific store first (the Manager's operational tabs).

### Implementation Pattern

Buttons that require edit permissions follow this pattern across all pages:
```tsx
{!isGlobalView && canEditX ? (
  <Button onClick={handleAction}>Action</Button>
) : (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button disabled>Action</Button>
      </TooltipTrigger>
      <TooltipContent>
        {isGlobalView ? "Switch to a specific store" : "Permission required"}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

---

## Role Hierarchy & User Management Workflow

SellSync uses a **three-tier role hierarchy** where each level has authority over the levels below it.

```
                ┌──────────────────┐
                │  Admin  (1 max)  │  owns all stores · creates Managers & Cashiers
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Manager (max 5)  │  manages 1+ assigned stores · sub-admin
                └────────┬─────────┘
                         │  (each store = ONE Manager, tracked via store.managerId)
                         ▼
                ┌──────────────────┐
                │ Cashier (unltd.) │  assigned to a store that already has a Manager
                └──────────────────┘
```

### Hierarchy Rules

| Rule | Detail |
|------|--------|
| **Admin** | Exactly **one** Admin per system. The Admin oversees all stores from the overview sidebar (Stores, Team, cross-store Dashboard/Inventory). Entering a store drops the Admin into that store's operational view. |
| **Manager** | Max **5** Managers. One Manager per store, enforced through `store.managerId`. A Manager may be assigned to multiple stores and acts as a sub-admin for those stores. **Managers can request Cashiers for their own store(s) — the Admin must approve before the Cashier is created.** |
| **Cashier** | **Unlimited** per store. A Cashier can only be created for a store that **already has a Manager**. Cashiers cannot create users. A Cashier sees only their assigned store's products, categories, and transactions. |
| **Role changes** | Demoting/deleting a Manager clears that store's `managerId`. Promoting a user to Manager sets the store's `managerId`. |

### Add a Manager (Admin only)

1. Go to the **Team** tab (or **Settings → Users & Roles**)
2. Click **Add Manager**
3. Pick a store. Stores that already have a Manager are hidden from the list
4. Fill in name, email, phone, and password, then save
5. The store is now linked to the Manager via `store.managerId`

### Add a Cashier (Admin only)

1. Go to the **Team** tab (or **Settings → Users & Roles**)
2. Click **Add Cashier**
3. Pick the store the Cashier will sell at
4. Fill in name, email, phone, and password, then save
5. The Cashier is created immediately and appears under that store

> **Empty state:** If no store has a Manager yet, the Team tab shows only the cashier picker and reminds the Admin to create a store / Manager first.

### Add a Cashier (Manager, requires Admin approval)

Managers can also add Cashiers, but only to **their own assigned store(s)** and only with the Admin's permission:

1. Log into the Manager account and go to **Settings → Users & Roles** (shown as "Team & Cashiers")
2. Click **Add Cashier** — the picker only lists the Manager's own stores
3. The form is locked to role **Cashier** and to the Manager's store
4. Click **Send for Approval** — a pending approval request (`add_cashier`) is created and the Admin is notified
5. The Admin opens **Notifications** and clicks **Approve** (or **Reject**)
6. On approval the Cashier user is created and can log in; on rejection the request is marked rejected with the Admin's reason

> The Cashier is **not** created until the Admin approves. Only the Admin can approve cashier-creation requests.

### Switching Stores & Entering a Store (Change Store)

From the header **profile menu → Change Store**:

- **Admin**: Clicking a store enters it **directly** (one click, no credentials) — the sidebar becomes that store's operational tabs. The Admin never logs in as a Cashier. A **"Back to Store Overview"** button returns to the cross-store overview. Store cards also list the store's Manager and Cashiers (read-only) for quick reference.
- **Manager/Cashier**: Store cards list the users assigned to that store; selecting a user asks for that user's email + password and logs in as them (e.g. *"Log in as Cashier"*). Multi-store Managers can switch between their assigned stores.
- **Admin preview & switch-back**: From the **Stores** tab an Admin can also **enter a store as that store's Manager/Cashier** to experience the app from their point of view. The Admin's own session is snapshotted into `adminUser` (persisted as `sellsync_admin_user`), and a **"Switch Back to Admin"** option — in the profile menu **and** the Change Store modal footer — restores the Admin's all-stores overview. The snapshot survives page refreshes and is cleared on logout.

### Approvals & Notifications

- When a Cashier or Manager requests a restricted action (delete product, delete category, update payment settings, delete store), the request appears in **Notifications**
- The **Approve / Reject** buttons are shown to the **Admin** and to the **Manager assigned to the store** where the request was made (matched via `store.managerId`)
- **`add_cashier` and `delete_store` requests are Admin-only** — the requesting Manager cannot approve their own request
- Approving executes the action (or creates the Cashier, or deletes the store with its Manager and Cashiers); rejecting records a reason and notifies the requester

### Cashier Data Scope & Metadata

- A Cashier sees **only their assigned store's data** — products, categories, and transactions are filtered by `storeId` (Cashiers now have read-only access to Inventory and Products, scoped to their store)
- Every Cashier record stores `createdBy` (the Admin or Manager who requested them) and resolves to their store's Manager via `store.managerId`
- In **Settings → Users & Roles**, each Cashier row shows an **"Under {Manager}"** badge so it's always clear which Manager or Admin supervises them
- **Managers stand on their own** (each owns an independent store via `managerId`); **Cashiers depend on a store** — they can only exist where a Manager is assigned

### Data Model Notes

- The `Role` type is `'Admin' | 'Manager' | 'Cashier'` (previously `'Staff'`)
- `Store` gained an optional `managerId: string` field used to enforce the one-manager-per-store rule
- `User` gained an optional `createdBy?: string` field recording who requested the user
- `PendingActionType` includes `add_cashier` for manager-initiated cashier requests
- **Migration:** users loaded from `localStorage` that still carry the old `"Staff"` role are automatically converted to `"Cashier"`

---

## Password & Security Policy

### Policy Overview

- **Admin**: Can change their own password anytime
- **Manager/Cashier**: Cannot change their own password
- Only the Admin can reset user passwords from Settings > Security

### Admin Password Reset Flow

1. Admin goes to **Settings > Security**
2. Sees "Reset User Password" section
3. Selects a user from the dropdown
4. Enters and confirms the new password
5. Admin clicks "Reset User Password"
6. The user's password is updated immediately
7. The user is effectively logged out (their old credentials no longer work)
8. User must log in with the new credentials provided by Admin

### Implementation

- Password changes use `updateUserPassword(userId, newPassword)` from the store
- The Security tab shows different content based on role:
  - **Admin**: Shows "My Password" form + "Reset User Password" section
  - **Manager/Cashier**: Shows a restricted message directing them to contact their admin

### Validation Rules

- Minimum 8 characters
- Must contain at least one number and one letter

---

## Notification System

### In-App Notifications

When a non-admin user performs significant actions, the Admin receives an in-app notification via `addNotification`:

| Action | Notification Title | Notification Message |
|--------|-------------------|---------------------|
| Add Product | "New Product Added" | `[User] added "[Product]" in [Store].` |
| Add Category | "New Category Added" | `[User] added "[Category]" category in [Store].` |

### Notification Types

| Type | Icon | Use Case |
|------|------|----------|
| `info` | Blue | General updates (new product, new category) |
| `success` | Green | Completed actions |
| `warning` | Yellow | Low stock alerts |
| `alert` | Red | Critical issues |

### Notification Flow

1. Non-admin user performs an action (add product, add category)
2. The component checks `currentUser?.role !== "Admin"`
3. If true, `addNotification()` is called with details
4. The notification appears in the Admin's notification panel
5. The notification badge count updates in real-time
6. Admin can click the notification to navigate to the relevant page

### Approval Requests

Approval requests (delete product, delete category, update payment settings) follow the hierarchy:

1. A Cashier or Manager submits a restricted-action request
2. The request is stored in `pendingApprovals` and a notification is created
3. The **Approve / Reject** buttons are visible to the Admin **and** the store's Manager (`store.managerId`)
4. Approving executes the action; rejecting records the reason
5. The requester receives a success/warning notification with the outcome

---

## Features

### 1. Point of Sale (POS)

Process sales quickly with modern POS features.

**Capabilities:**
- Product search and scan
- Barcode/QR code scanning
- Voice input support
- Multiple payment methods
- Receipt generation
- Cart management
- Discount application

**Payment Methods:**
- Cash
- Card
- Bank Transfer
- POS Terminal
- Account Balance

### 2. Inventory Management

Track stock levels and manage products across all stores.

**Capabilities:**
- Real-time stock monitoring
- Low stock alerts
- Reorder management
- Bulk operations
- Category filtering
- SKU management
- Category management (Add/Delete)
- Per-store inventory isolation

**Stock Status:**
| Status | Condition | Color |
|--------|-----------|-------|
| Critical | Stock < 10 | Red |
| Low | Stock < Reorder Point | Orange |
| Healthy | Stock >= Reorder Point | Green |

### 3. Category Management

Categories are global across all stores.

**Capabilities:**
- Add new categories (Admin/Manager)
- Delete categories (Admin only)
- Category delete confirmation showing affected products
- Product count display per category
- "and X more..." message when >10 products affected

**Delete Category Flow:**
1. Open Manage Categories dialog
2. Click delete (X) next to a category
3. If no products: category is deleted immediately
4. If products exist: confirmation dialog shows list of affected products (up to 10) with "and X more..."
5. Admin confirms to delete
6. Products retain their category string but the category is removed from the list

### 4. AI Assistant

Natural language interface for business queries.

**Features:**
- Stock level queries
- Revenue reports
- Sales insights
- Trend analysis
- Recommendations

**Example Queries:**
```
"Which items are running low?"
"How much did I sell today?"
"What should I reorder?"
"Show me business insights"
```

### 5. Insights & Analytics

AI-powered business intelligence.

**Available Insights:**
- Sales trends
- Top products
- Customer behavior
- Revenue analysis
- Demand forecasting

### 6. Forecasting

Predict future sales and demand.

**Forecast Types:**
- 7-day short-term
- 30-day medium-term
- 90+ day seasonal

### 7. Reports

Generate and export business reports.

**Report Types:**
- Sales reports
- Inventory reports
- Financial reports
- Staff performance

**Export Formats:**
- PDF
- Excel
- CSV

**Sharing:**
- Email (Manager+)
- SMS (Manager+)

### 8. Notifications

Stay updated with system events.

**Features:**
- Mark all as read
- Clear all (Admin/Manager+)
- Click to navigate to relevant page
- Real-time badge count
- Filter by status (all, unread, alert, success)

---

## Components

### Layout

Main application wrapper with sidebar, header, and navigation.

**Features:**
- Responsive sidebar (collapsible on mobile)
- Global search with debounce
- Notification bell with badge
- User dropdown menu
- Theme toggle
- Store switcher
- Floating AI button
- Mobile bottom navigation

**Navigation Items:**
| Path | Name | Icon | Roles |
|------|------|------|-------|
| `/` | Dashboard | LayoutDashboard | All |
| `/inventory` | Inventory | Package | Admin, Manager |
| `/products` | Products | ShoppingCart | All |
| `/transactions` | Transactions | Receipt | All |
| `/pos` | POS | CreditCard | All |
| `/insights` | Insights | TrendingUp | Admin, Manager |
| `/forecasts` | Forecasts | LineChart | Admin, Manager |
| `/reports` | Reports | FileText | Admin, Manager |
| `/notifications` | Notifications | Bell | All |
| `/settings` | Settings | Settings | Admin |

### AIChatModal

Full AI chat interface for natural language queries.

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
}
```

### AskAIModal

Quick AI question interface accessible from anywhere.

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
}
```

### AISummaryCard

Displays AI-generated daily summaries.

**Props:**
```typescript
{
  title: string;
  content: string;
  type: 'daily' | 'weekly' | 'alert';
}
```

### ForecastChart

Sales forecast visualization component.

**Props:**
```typescript
{
  data: ForecastData[];
  type?: 'line' | 'bar';
}
```

### ProductCard

Displays product in grid or list format.

**Props:**
```typescript
{
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  variant?: 'grid' | 'list';
}
```

### ProductDetailModal

View/Edit product details modal.

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onSave: (product: Product) => void;
}
```

### QrGeneratorModal

Generate product QR codes.

**Props:**
```typescript
{
  isOpen: boolean;
  onClose: () => void;
}
```

### QrScannerModal

Scan product QR/barcodes.

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}
```

### POSVoiceButton

Voice input for POS operations.

**Props:**
```typescript
{
  onTranscript: (text: string) => void;
}
```

### BulkPOModal

Bulk purchase order creation.

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  items: InventoryItem[];
}
```

### ReorderTable

Low stock alerts and reorder management.

**Props:**
```typescript
{
  items: InventoryItem[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
}
```

### CustomReportModal

Build custom reports.

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  onGenerate: (config: ReportConfig) => void;
}
```

### ReportPreviewModal

Preview report before export.

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  reportData: ReportData;
  onExport: (format: string) => void;
}
```

### EmailShareModal / SMSShareModal

Share reports via email or SMS.

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  reportName: string;
  reportType: string;
}
```

---

## API Reference

### Store Methods

```typescript
// Store Management
switchStore(storeId: string): void;

// User & Auth
loginUser(user: User): void;
logoutUser(): void;
updateUserPassword(userId: string, newPassword: string): void;

// Theme
toggleTheme(): void;

// Notifications
addNotification(notification: AppNotification): void;
markNotificationRead(id: string): void;
markAllNotificationsRead(): void;
clearAllNotifications(): void;

// Inventory
adjustStock(productId: number, delta: number): void;
setProductStock(productId: number, stock: number): void;
setProductPrice(productId: number, price: number): void;

// Products
addProduct(product: Omit<InventoryItem, "id">): void;
updateProduct(product: InventoryItem): void;
deleteProduct(productId: number): void;

// Categories
addCategory(name: string): void;
removeCategory(name: string): void;

// Transactions
completeSale(payload: CompleteSalePayload): void;
refundTransaction(transactionId: string): void;

// Users
addUser(user: User): void;
deleteUser(userId: string): void;
updateUser(user: User): void;
updateStaffDetails(userId: string, details: Partial<User>): void;

// Stores
addStore(store: Store): void;
deleteStore(storeId: string): void;
updateStoreProfile(store: Store): void;

// Permissions
canView(module: string): boolean;
canEdit(module: string): boolean;

// Currency
formatCurrency(amount: number): string;
```

### Type Definitions

```typescript
interface Store {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  phone?: string;
  managerId?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Cashier';
  phone?: string;
  status: 'Active' | 'Inactive';
  assignedStoreIds: string[];
  password?: string;
  baseSalary?: number;
  commissionRate?: number;
}

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  costPrice?: number;
  stock: number;
  reorderPoint: number;
  barcode?: string;
  manufacturedDate?: string;
  expiryDate?: string;
  image?: string;
  storeId: string;
  supplier?: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  datetime: string;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  vat?: number;
  amount: number;
  payment: string;
  status: string;
  cashier?: string;
  customer?: string;
  storeId: string;
  terminalId?: string;
}

interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  productId?: number;
  link?: string;
}

interface Role {
  name: 'Admin' | 'Manager' | 'Cashier';
  permissions: string[];
}
```

### Routing

```typescript
// routes.tsx
export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "inventory", Component: InventoryPage },
      { path: "products", Component: ProductsPage },
      { path: "transactions", Component: TransactionsPage },
      { path: "pos", Component: PosPage },
      { path: "insights", Component: InsightsPage },
      { path: "forecasts", Component: ForecastsPage },
      { path: "reports", Component: ReportsPage },
      { path: "notifications", Component: NotificationsPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
```

---

## User Guide

### Dashboard

**Purpose:** Overview of business performance

**Components:**
- KPI Cards (Revenue, Sales, Customers, Products)
- Sales Chart (trends)
- Top Products Chart
- Recent Transactions
- Low Stock Alerts
- AI Insights
- Stock Up popup (Admin/Manager)

### Point of Sale

**Making a Sale:**
1. Search or scan product
2. Add to cart
3. Adjust quantities
4. Select payment method
5. Complete transaction
6. Generate receipt

**Features:**
- Voice input (microphone button)
- Barcode/QR scanning
- Multiple payment options
- Real-time cart updates

### Inventory

**Managing Stock:**
1. View all products (table view)
2. Filter by category, stock status, or date
3. Search by name or SKU
4. Edit stock/price (Admin/Manager)
5. Delete products (Admin only)
6. Pin items to top
7. Manage categories (Add/Delete)

**Stock Status Colors:**
- Red: Critical (< 10 units)
- Orange: Low (below reorder point)
- Green: Healthy (above reorder point)

### Category Management

**Managing Categories:**
1. Click "Add Category" button in Inventory header
2. The "Manage Categories" dialog opens showing all categories with product counts
3. To add: type a name and click "Add"
4. To delete: click the X next to a category
5. If products exist in that category, a confirmation dialog lists affected products
6. Confirm to delete (Admin only)

### AI Assistant

**Access:** Click AI button (bottom-right) or go to Insights

**Commands:**
- "Which items are low?"
- "Show me today's revenue"
- "What should I reorder?"
- "Business insights"

### Reports

**Creating Reports:**
1. Click Reports in sidebar
2. Select report type (Sales, Inventory, Performance)
3. Choose date range
4. Preview report
5. Export (PDF/Excel/CSV)
6. Share via Email/SMS (Manager+)

### Settings

**Tabs:**
- **General**: Store profile, currency, theme
- **Stores**: Add/Edit/Delete stores (Admin only)
- **Users & Roles**: Create/Edit/Delete users, assign roles and stores (Admin only)
- **Permissions**: Configure module-level permissions (Admin only)
- **Receipts**: Configure receipt templates
- **Payments**: Link bank accounts, POS terminals
- **Security**: Change password (Admin), reset user passwords (Admin only)

### Changing Stores

1. For Admin: Click store switcher in header, select any store
2. For Manager/Cashier: Switch only between their assigned store(s)

### Password Reset (Admin)

1. Go to Settings > Security
2. Find "Reset User Password" section
3. Select the user from the dropdown
4. Enter and confirm the new password
5. Click "Reset User Password"
6. Inform the user of their new credentials

---

## Recent Changes

### Version 2.3 — Premium AI Chat & Admin Switch-Back

| Change | Files | Description |
|--------|-------|-------------|
| **Admin Switch-Back** | store.tsx, Layout.tsx | Admin entering a store as Manager/Cashier is snapshotted in `adminUser` (persisted `sellsync_admin_user`); "Switch Back to Admin" restores the Admin session + overview; cleared on logout |
| **Groq premium models** | AskAIModal | Models upgraded to `llama-3.1-8b-instant` / `llama-3.3-70b-versatile`; max_tokens raised (512/2048/4096) and temperature tuned (0.4/0.6/0.8) |
| **Real-data system prompt** | AskAIModal | Prompt now includes top 5 sellers, inventory snapshot, low-stock details, recent transactions, time-of-day greeting and an empathetic "market mood" personality |
| **Markdown chat** | MarkdownRenderer.tsx, AskAIModal | New lightweight markdown renderer with dependency-free code highlighting and copy button for AI messages |
| **Chat UX** | AskAIModal | Text-to-speech, click-to-edit chat title, inline pin/timestamp/delete/rename, "Clear All History", right-panel quick-action cards (Report / CSV / Refresh) |
| **Responsive AI** | AskAIModal | Chat list becomes a mobile drawer; right sidebar a tablet drawer (both with backdrops) |
| **Cleaner header** | AskAIModal | Removed the `fast/thinking/pro` selector, the Live badge, and the AI Ready/Offline badge; improved icon + "Intelligent Assistant" caption |

### Version 2.2 — Manager-Initiated Cashiers (Approval Workflow)

| Change | Files | Description |
|--------|-------|-------------|
| **Manager adds Cashiers** | SettingsPage | Managers get an "Add Cashier" button scoped to their own store(s); Users tab shows "Team & Cashiers" |
| **Admin approval** | store.tsx, SettingsPage | Manager cashier creation becomes an `add_cashier` approval request; Admin approves/rejects in Notifications |
| **Approval executes creation** | store.tsx | `APPROVE_APPROVAL_REQUEST` now creates the Cashier user (with `createdBy` set) |
| **Admin-only cashier approval** | NotificationsPage | `add_cashier` requests cannot be approved by the requesting Manager |
| **Cashier metadata** | store.tsx, SettingsPage | Cashier rows show an "Under {Manager}" badge; `User.createdBy` tracks the requester |
| **Cashier store scope** | store.tsx | Cashiers now have read-only access to Inventory & Products, filtered to their store |

### Version 2.1 — Role Hierarchy (Admin → Manager → Cashier)

| Change | Files | Description |
|--------|-------|-------------|
| **Role renamed** | store.tsx | `"Staff"` → `"Cashier"`; migration auto-converts old data |
| **Store manager link** | store.tsx | Added `Store.managerId`; 5 seed stores with manager assignments |
| **ADD_USER guard** | store.tsx | One Admin max, 5 Managers max, one Manager per store, sets `managerId` |
| **DELETE_USER / UPDATE_USER** | store.tsx | Clears/sets `managerId` on role changes and deletions |
| **RBAC helper** | rbac.ts | `isStoreTakenByOtherUser(users, storeId, excludeUserId, forRole)` |
| **Add Cashier flow** | SettingsPage | Separate "Add Cashier" button + store picker showing only stores with a Manager |
| **Role dropdown** | SettingsPage | Now shows only Admin/Manager; Cashier role is fixed via the Add Cashier flow |
| **Login as user** | Layout | Change Store modal lists every store user (Manager + Cashiers); Admins enter stores directly (no credentials), Manager/Cashiers authenticate with email + password |
| **Admin overview** | store.tsx, Layout, StoresPage, TeamPage | Admin starts in a cross-store overview (`adminOverview`, persisted as `sellsync_admin_overview`); new Stores + Team tabs; `canView`/`canEdit` are read-only in overview; entering a store switches to that store's operational tabs; "Back to Store Overview" returns |
| **Approvals** | NotificationsPage | Approve/Reject visible to Admin **and** the store's Manager |

### Version 2.0 — RBAC & Multi-Store Enhancements

| Change | Files | Description |
|--------|-------|-------------|
| **RBAC Gates** | All pages | Added `canEdit(module)` checks across all 11 pages |
| **Role-based Inventory** | InventoryPage | Export, Stock Up, bulk actions, dropdown actions gated |
| **Role-based Products** | ProductsPage | Delete bar, Promote Now gated |
| **Role-based Transactions** | TransactionsPage | Close Day (Manager+), Refund (Admin), Export (Manager+) |
| **Role-based Forecasting** | ForecastsPage | Simulate, Reset, Generate PO gated |
| **Role-based Reports** | ReportsPage | Generate Report, Create Custom, Email/SMS gated |
| **Role-based Notifications** | NotificationsPage | Clear All gated |
| **Tooltip Disabled Pattern** | Multiple pages | Consistent disabled+tooltip for restricted actions |
| **Category Delete** | InventoryPage, store.tsx | DELETE_CATEGORY reducer, Manage Categories dialog, product warning |
| **Product Limit Display** | InventoryPage | Shows first 10 affected products + "and X more..." |
| **Password Policy** | SettingsPage | Non-admin cannot change password; Admin can reset any user |
| **Notification Triggers** | ProductsPage, InventoryPage | Non-admin add product/category → Admin notified |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Can't login | Wrong credentials | Contact admin for password reset |
| "Access Denied" | Role restriction | Contact admin to adjust permissions |
| Can't delete product | Not Admin | Only Admin can delete products |
| Can't change password | Account policy | Contact store admin |
| Category delete shows products | Category has inventory | Review affected products before confirming |
| Search not working | Typo or empty | Check spelling |
| Scanner not working | Camera blocked | Allow camera permission |
| Voice input fails | Mic blocked | Allow microphone permission |
| Reports won't load | Large dataset | Reduce date range |

### Performance Tips

1. Close unused browser tabs
2. Clear browser cache regularly
3. Limit search results
4. Use filters instead of searching all
5. Export large reports as CSV

### Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 90+ | Full |
| Firefox 88+ | Full |
| Safari 14+ | Full |
| Edge 90+ | Full |

### Getting Help

1. **AI Assistant:** Quick answers to questions
2. **Notifications:** System alerts and updates
3. **Settings > Help:** Contact support

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| SKU | Stock Keeping Unit - unique product identifier |
| POS | Point of Sale - where transactions occur |
| RBAC | Role-Based Access Control - permission system |
| KPI | Key Performance Indicator - tracked metric |
| PO | Purchase Order - restock request |
| QR | Quick Response - scannable barcode |

### Currency

All amounts displayed in **Nigerian Naira (₦)**

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary | #4F46E5 (Indigo) | Brand, CTAs |
| Success | #16A34A (Green) | Healthy stock |
| Warning | #EA580C (Orange) | Low stock |
| Danger | #DC2626 (Red) | Critical stock |
| Background Light | #F9FAFB | Light mode bg |
| Background Dark | #030712 | Dark mode bg |

### License

MIT License

---

**Document Version:** 2.2  
**Last Updated:** July 2026  
**Project:** SellSync - AI-Powered Multi-Store Management OS
