# SellSync — Backend Integration Guide

How to connect this React frontend to your separate backend + database, where
the connection points are, and how the multi-user flow (Admin ⇄ Manager ⇄
Cashier) is meant to work end-to-end.

> **Current state (important):** today the entire app runs **offline**.
> All data lives in the browser under `localStorage` (`sellsync_*` keys). There
> is no backend call anywhere except Groq (AI) in dev mode. This document is the
> roadmap for replacing the localStorage layer with your API.

---

## Table of Contents

1. [The big picture](#1-the-big-picture)
2. [How the app is wired today](#2-how-the-app-is-wired-today)
3. [The integration points (file by file)](#3-the-integration-points-file-by-file)
4. [Authentication flow](#4-authentication-flow)
5. [Data synchronization strategy](#5-data-synchronization-strategy)
6. [Endpoint contract](#6-endpoint-contract)
7. [Step-by-step integration plan](#7-step-by-step-integration-plan)
8. [Multi-store roles & the Admin "Switch Back"](#8-multi-store-roles--the-admin-switch-back)
9. [Security checklist](#9-security-checklist)
10. [End-to-end scenario you asked about](#10-end-to-end-scenario-you-asked-about)

---

## 1. The big picture

There are **three** pieces:

```
┌─────────────────────┐    ┌──────────────────────┐
│  Landing page site   │    │  SellSync dashboard   │  (this repo)
│  (sellsync.store)    │    │  src/                 │
│  - marketing         │    │  - POS / Inventory    │
│  - LOGIN / signup    │    │  - Admin overview     │
└──────────┬──────────┘    └───────────┬──────────┘
           │                          │
           └────────────┬─────────────┘
                        ▼
             ┌──────────────────────┐
             │   Your Backend API    │   (separate repo/server)
             │   e.g. Node + Express │
             │   reads VITE_API_BASE_URL /link/*
             ├──────────────────────┤
             │   PostgreSQL DB       │   (shared by both frontends)
             └──────────────────────┘
```

- The **landing page** and the **dashboard** are two separate frontends.
- They both talk to the **same backend + same database**.
- A user created by the Admin in the dashboard is a row in the shared DB, so
  that same user can log in from the landing page.
- Sales made from the dashboard (POS) are written to the shared DB, so the
  Admin sees them when they open that store.

---

## 2. How the app is wired today

| Area | Current behaviour | Where |
|---|---|---|
| **Data storage** | `localStorage` under `sellsync_*` | `src/app/state/store.tsx` (initializers + a persistence `useEffect`) |
| **Users / login** | Users stored in `sellsync_users`; password verified locally | `store.tsx` + `Layout.tsx` (`verifyUserPassword`) |
| **Logout** | Redirects to the external landing login page | `Layout.tsx` `handleLogout` → `window.location.href = "https://sellsync.store/login"` |
| **API layer** | Fully written but **commented out** | `src/lib/api.ts` |
| **Env var** | `VITE_API_BASE_URL` (default `http://localhost:3000`) | `.env` / `.env.example` |
| **Live network calls** | Only Groq (AI) via a Vite dev proxy | `vite.config.ts` + `AskAIModal.tsx` |

Key fact: **role + store filtering is already done on the frontend** (a user's
`assignedStoreIds`, `adminOverview`, the `adminUser` snapshot). Your backend
must *mirror and enforce* the same rules so a logged-in manager cannot see other
stores by editing localStorage.

---

## 3. The integration points (file by file)

### 3.1 `.env` / `.env.example`

Already set up. `src/lib/api.ts` reads:

```env
VITE_API_BASE_URL=http://localhost:3000   # point this at your backend
# Optional: VITE_API_TOKEN=...            # static token fallback
```

### 3.2 `src/lib/api.ts` — the API service layer (main entry point)

This file defines `BASE_URL` and `getHeaders()`. All network calls should go
through it. The functions are **commented out**; enable them group by group
(see [§7](#7-step-by-step-integration-plan)).

```ts
// src/lib/api.ts (already present, commented out)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  // const token = localStorage.getItem("sellsync_token");   // add JWT here
  // if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

export const api = {
  products:   { getAll, getById, create, update, delete },   // /link/products
  transactions:{ getAll, create, refund },                    // /link/transactions
  inventory:  { getAll, adjustStock },                        // /link/inventory
  customers:  { getAll, create },                             // /link/customers
  users:      { login, getAll },                              // /link/users, /link/auth/login
  analytics:  { getKPIs, getSalesTrend },                     // /link/analytics/*
  notifications: { getAll, markAsRead },                      // /link/notifications
};
```

### 3.3 `src/app/state/store.tsx` — the heart of the app

This is a **React Context + useReducer** store (not Zustand). The three parts
you'll change:

1. **Initializers** (top of the reducer) — currently read `localStorage` to seed
   state. Replace with a hydration step that fetches from the API once.
2. **Reducer actions** — currently mutate state + write `localStorage`. Add an
   API call before/after each dispatch (see [§5](#5-data-synchronization-strategy)).
3. **Persistence `useEffect`** — currently writes every `sellsync_*` key on each
   state change. Once the backend is the source of truth this effect is removed
   (or kept only for offline caching).

Store methods you must wire to the backend:

| Store method | Reducer action | Backend call |
|---|---|---|
| `loginUser(u)` | `LOGIN_USER` | `POST /link/auth/login` (returns user + token) |
| `logoutUser()` | `LOGOUT_USER` | `POST /link/auth/logout` (optional) |
| `switchBackToAdmin()` | `LOGIN_USER` (admin snapshot) | `GET /link/users/me` |
| `completeSale(p)` | `COMPLETE_SALE` | `POST /link/transactions` |
| `refundTransaction(id)` | `REFUND_TRANSACTION` | `POST /link/transactions/:id/refund` |
| `addProduct/updateProduct/deleteProduct` | `ADD/UPDATE/DELETE_PRODUCT` | `POST/PUT/DELETE /link/products` |
| `setProductStock/setProductPrice` | `SET_STOCK` / `SET_PRICE` | `PUT /link/inventory/:id/stock` (price) |
| `adjustStock(id, delta)` | `ADJUST_STOCK` | `PUT /link/inventory/:id/stock` |
| `addCategory/removeCategory` | `ADD/DELETE_CATEGORY` | `POST/DELETE /link/categories` |
| `addUser/updateUser/deleteUser` | `ADD/UPDATE/DELETE_USER` | `POST/PUT/DELETE /link/users` |
| `addStore/updateStoreProfile/deleteStore` | `ADD/UPDATE/DELETE_STORE` | `POST/PUT/DELETE /link/stores` |
| `approveApprovalRequest` | `APPROVE_APPROVAL_REQUEST` | `POST /link/approvals/:id/approve` |

### 3.4 `src/app/components/Layout.tsx`

- `handleLogout` already points to the landing login page — keep it; after
  backend auth, call `POST /link/auth/logout` and clear `sellsync_token` first.
- `handleStoreSwitch` uses local `verifyUserPassword` — replace with a real
  `POST /link/auth/login` using the entered email/password, or simpler: allow
  the admin flow and keep credential checks server-side.
- The "Switch Back to Admin" entries call `switchBackToAdmin()` from the store —
  no change needed here, it works once the store is API-backed.

### 3.5 `src/app/pages/StoresPage.tsx`

`handleLoginAsManager`, `handleLoginAsCashier`, `handleCreateCashier` call
`loginUser(manager/cashier)` with the locally-created user. With a backend:

- Creating a Manager/Cashier → `POST /link/users` (server hashes the password,
  never store plaintext).
- "Enter as Manager/Cashier" for preview → keep the local `loginUser` behaviour
  **but do not write a fake token**; this is a UI convenience that should be
  replaced by the same `POST /link/auth/login` the real user would use.

### 3.6 `vite.config.ts`

Only proxies Groq today. If your backend is on another origin during dev, add a
proxy (e.g. `/api` → `http://localhost:3000`) — or just set `VITE_API_BASE_URL`
and call the full URL.

---

## 4. Authentication flow

Recommended (industry standard, matches the scaffolding in `api.ts`):

1. **Register/signup** happens on the **landing page** → `POST /link/auth/register`
   (or `POST /api/auth/register` depending on your backend). The backend creates
   the user, **hashes the password with bcrypt**, returns a JWT.
2. **Login** (landing page or dashboard) → `POST /link/auth/login` with
   `{ email, password }`. Backend verifies + returns `{ user, token }`.
3. The dashboard stores the token: `localStorage.setItem("sellsync_token", token)`
   and the user: `loginUser(user)`.
4. Every API request attaches `Authorization: Bearer <token>` — uncomment the
   line in `getHeaders()`.
5. `logoutUser()` clears the token + user from localStorage, then redirects to
   the landing page.
6. **Restoring the session on refresh:** the store initializer already restores
   `currentUser` from `sellsync_user`. Add a `GET /link/users/me` (with the
   token) on boot to re-validate the session and refresh the user's profile,
   `assignedStoreIds`, and role.

Example:

```ts
// src/lib/api.ts (enable users.login)
users: {
  login: async (email: string, password: string) => {
    const response = await fetch(`${BASE_URL}/link/auth/login`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Login failed");
    localStorage.setItem("sellsync_token", result.token);
    return result.user;
  },
},

// store.tsx provider value
loginUser: async (user: User) => {
  dispatch({ type: "LOGIN_USER", user });
},
```

---

## 5. Data synchronization strategy

Use a **write-through** pattern: the reducer stays the UI's source of truth for
instant feedback, and every mutating action also calls the API. On errors, roll
back / show a toast.

```ts
// store.tsx provider value (example for completeSale)
completeSale: async (payload: CompleteSalePayload) => {
  try {
    const tx = await api.transactions.create(payload);   // backend first
    dispatch({ type: "COMPLETE_SALE", payload: tx });    // then update UI
  } catch (e) {
    toast.error("Sale failed — please retry");
    throw e;
  }
},
```

**Hydration on load** (replace the localStorage initializers): on first mount
fetch everything the logged-in role can see, then `dispatch` a bulk
`SET_ALL_DATA` action:

```ts
useEffect(() => {
  const token = localStorage.getItem("sellsync_token");
  if (!token) return; // no session → show login
  Promise.all([
    api.users.me(token),
    api.stores.list(token),
    api.inventory.getAll(token),
    api.transactions.getAll(token),
    api.notifications.getAll(token),
  ]).then(([me, stores, inventory, transactions, notifications]) => {
    dispatch({ type: "HYDRATE", payload: { me, stores, inventory, transactions, notifications } });
  });
}, []);
```

**Offline fallback:** keep `localStorage` as a cache. Write-through + a small
queue is enough for a v1; a full offline-first (indexedDB + sync queue) can come
later.

---

## 6. Endpoint contract

The frontend's `api.ts` expects these (prefix comes from `VITE_API_BASE_URL`).
Adjust the paths if your backend differs, but keep `api.ts` as the only place
that knows the URLs.

| Area | Method | Path | Frontend use |
|---|---|---|---|
| Auth | POST | `/link/auth/login` | `users.login` |
| Auth | POST | `/link/auth/logout` | `logoutUser` |
| Auth | GET | `/link/users/me` | session restore |
| Users | GET/POST/PUT/DELETE | `/link/users` · `/link/users/:id` | user CRUD, createdBy, role |
| Stores | GET/POST/PUT/DELETE | `/link/stores` · `/link/stores/:id` | store CRUD, `managerId`, switch |
| Products | GET/POST/PUT/DELETE | `/link/products` · `/link/products/:id` | product CRUD |
| Inventory | GET | `/link/inventory` | stock levels |
| Inventory | PUT | `/link/inventory/:id/stock` | `adjustStock`, `setProductStock` |
| Inventory | PUT | `/link/inventory/:id/price` | `setProductPrice` |
| Transactions | GET | `/link/transactions` | sales history |
| Transactions | POST | `/link/transactions` | `completeSale` |
| Transactions | POST | `/link/transactions/:id/refund` | `refundTransaction` |
| Categories | GET/POST | `/link/categories` · `DELETE /link/categories/:name` | categories |
| Notifications | GET | `/link/notifications` | notification feed |
| Notifications | PUT | `/link/notifications/:id/read` | mark read |
| Analytics | GET | `/link/analytics/kpis` | dashboard KPIs |
| Analytics | GET | `/link/analytics/sales-trend` | dashboard charts |
| Approvals | POST | `/link/approvals/:id/approve` · `.../reject` | approval workflow |

> `DOCUMENTATION.md` also contains a **full PostgreSQL schema** (stores, users,
> inventory_items, transactions, transaction_items, notifications, permissions,
> attendance, payroll) you can reuse as-is. Add a `created_by` column on `users`
> and a `manager_id` column on `stores` to match the frontend's current model.

---

## 7. Step-by-step integration plan

Do it in this order so the app never breaks:

1. **Point the env at the backend.** Set `VITE_API_BASE_URL` to your server.
   Verify with a `GET /link/health` (add one to your backend if missing).
2. **Auth first.** Enable `users.login`, store `sellsync_token`, and wire
   `loginUser`/`logoutUser`. Now real users can log in; the app still reads the
   rest from localStorage.
3. **Read-only hydration.** Implement the `HYDRATE` flow: `users/me`, stores,
   inventory, transactions. Pages then show **live** data for the logged-in
   user.
4. **Writes for the core loop.** Wire `completeSale`, `adjustStock`,
   `setProductStock/Price`, product CRUD. The POS and Inventory now persist to
   your database — this is when a Manager/Cashier's sales actually reach the
   Admin.
5. **User & store management.** Wire `addUser/updateUser/deleteUser`,
   `addStore/deleteStore`, manager assignment, and the approval actions. The
   Admin-created Manager/Cashier now exists in the DB.
6. **Notifications & analytics.** Wire the remaining read endpoints; either
   call the backend or compute client-side (the app can compute KPIs itself).
7. **Remove the localStorage persistence `useEffect`** (or gate it behind an
   offline flag), then delete the now-unused initializers.
8. **Real-time (optional, later).** WebSockets / SSE for live notifications and
   stock updates across devices.

---

## 8. Multi-store roles & the Admin "Switch Back"

This is the model you described, and it's already implemented client-side:

- **Admin** owns all stores. `adminOverview: true` shows the cross-store
  overview (Stores, Team, read-only operational modules).
- **Manager/Cashier** see only their `assignedStoreIds` (store-scoped data).
- **Admin entering a store as a Manager/Cashier** (Stores tab → "Enter as…")
  calls `loginUser(manager)`. The reducer **snapshots the Admin** into
  `adminUser` (persisted as `sellsync_admin_user`) so the Admin can come back.
- **"Switch Back to Admin"** (profile menu or Change Store modal) calls
  `switchBackToAdmin()` → `LOGIN_USER(adminUser)` + `adminOverview: true`.

On the backend, mirror it like this:

- `users` table: `role`, `assigned_store_ids`, `created_by`.
- `stores` table: `manager_id` (one Manager per store).
- `/link/users/me` must return the current user **with** their
  `assignedStoreIds` so the frontend scopes data correctly.
- For the "preview as Manager/Cashier" convenience, either (a) keep it purely
  frontend-local (does **not** create a real session) or (b) have the backend
  issue a short-lived token for the target user after the Admin confirms.
  **Server-side rule:** only an Admin may obtain another user's session.

---

## 9. Security checklist

- [ ] **Never store plaintext passwords** — the current localStorage mock stores
      them in the clear (`User.password`). Move to **bcrypt hashes** server-side
      and drop password from the client `User` type.
- [ ] **JWT expiry + refresh** — short-lived access token, `sellsync_token`.
- [ ] **Validate role & store on the server.** Never trust `role`/
      `assignedStoreIds` sent from the client — derive them from the DB from the
      authenticated user's id.
- [ ] **`/link/inventory`, `/link/transactions`, `/link/users`** must filter by
      the caller's `assignedStoreIds` / admin status. A Cashier hitting
      `GET /link/users` directly must only get their own store's data.
- [ ] **Admin snapshot is a convenience, not auth.** `switchBackToAdmin`
      re-issues the *real* Admin's JWT server-side; the client never keeps a
      second plaintext credential.
- [ ] **Rate-limit login**, use HTTPS, and keep the Groq API key **out of the
      frontend** (route it through a small backend proxy in production).

---

## 10. End-to-end scenario you asked about

> "When the Admin creates a Manager/Cashier, the Admin can toggle between them
> and return to the Admin tab; the Manager/Cashier uses the same email +
> password at the landing page to enter their own store, make sales; the Admin
> still sees what they did and can switch to their store."

1. **Admin creates Manager** (Team tab / Settings → Users & Roles). Frontend
   calls `POST /link/users`. Backend hashes the password, sets `role=Manager`,
   `assigned_store_ids=[store.id]`, links `stores.manager_id`, sets
   `created_by=admin.id`. → row in the shared DB. ✅
2. **Admin toggles in** (Stores → "Enter as Manager"). Reducer keeps the Admin
   snapshot (`adminUser`). **"Switch Back to Admin"** restores the Admin. ✅
3. **Manager logs in at the landing page** with the email/password the Admin
   created. Backend validates against the same DB row. Frontend hydrates with
   `users/me` → `assignedStoreIds` → manager sees **only their store**. ✅
4. **Manager/Cashier makes sales** (POS). `completeSale` →
   `POST /link/transactions` (with `storeId`, `cashier`). Stock adjusts via
   `/link/inventory/:id/stock`. Both written to the shared DB. ✅
5. **Admin sees it all.** Opening that store (or the cross-store overview) reads
   the same DB → the new transactions and stock levels appear. **Switch to their
   store** → `GET /link/inventory?storeId=...` + `GET /link/transactions?storeId=...`.
   ✅

Every step above already works **locally**; what's missing is the wiring in
[§3](#3-the-integration-points-file-by-file) and [§7](#7-step-by-step-integration-plan).

---

*Companion docs: [`README.md`](README.md) (overview), [`DOCUMENTATION.md`](DOCUMENTATION.md) (architecture, RBAC, DB schema), [`API.md`](API.md) (frontend API), [`USER_GUIDE.md`](USER_GUIDE.md) (usage), [`AI_AND_UI_ARCHITECTURE.md`](AI_AND_UI_ARCHITECTURE.md) (AI + UI internals).*
