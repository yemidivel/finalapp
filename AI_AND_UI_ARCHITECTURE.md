# SellSync — AI System & UI Architecture

This document explains two internal aspects of the SellSync dashboard:

1. **How the AI works** — the assistant ("Ask SellSync AI"), its model provider, prompting, chart rendering, and the deterministic insights engine.
2. **How the UI is structured** — bootstrapping, routing, layout chrome, state, styling, and the navigation model (Admin overview vs. operational).

> Scope note: this is about the **dashboard app** (`src/`). The separate landing/marketing repo and the backend API are out of scope (see [`BACKEND_INTEGRATION.md`](BACKEND_INTEGRATION.md) and `DOCUMENTATION.md`).

---

## 1. How the AI works

### 1.1 The AI surfaces

| Surface | File | Status |
|---|---|---|
| **Ask SellSync AI** (full-screen chat) | `src/app/components/AskAIModal.tsx` | **Active** — opened from the floating button on the Dashboard (`Layout.tsx`) and the "AI Analysis" button on Reports (`ReportsPage.tsx`) |
| Legacy AI chat | `src/app/components/AIChatModal.tsx` | Not wired into any route; kept for reference. Uses a local static responder only |
| AI Summary card | `src/app/components/AISummaryCard.tsx` | Renders each deterministic insight (title, summary, confidence, progress bar) in the Dashboard's **AI Insights** panel |
| AI Insights panel | `src/app/pages/DashboardPage.tsx` (panel) + `src/app/lib/insights.ts` (shared engine) | Deterministic, rule-based insights over live data (`InsightsPage.tsx` keeps its own `dynamicInsights` builder) |
| Markdown renderer | `src/app/components/MarkdownRenderer.tsx` | Lightweight, dependency-free markdown + code highlighting used for AI chat messages |

### 1.2 Provider & request flow (AskAIModal)

- **Provider:** [Groq](https://groq.com). The API key lives in `localStorage` under `sellsync_groq_api_key`. On mount, if the key is missing, a bundled default key is written.
- **Proxy:** in dev, requests go to relative `/api/groq/...` and Vite proxies them to `https://api.groq.com` (path rewrite strips the `/api/groq` prefix) — see `vite.config.ts`. In production the same relative path must be reverse-proxied.
- **Models** (selected internally via `MODEL_MAP`; the app defaults to `pro` — a visible fast/thinking/pro selector was removed from the chat header):

| Mode | Groq model | Temp | max_tokens |
|---|---|---|---|
| fast | `llama-3.1-8b-instant` | 0.4 | 512 |
| thinking | `llama-3.3-70b-versatile` | 0.6 | 2048 |
| pro (default) | `llama-3.3-70b-versatile` | 0.8 | 4096 |

- **Endpoint:** `POST /api/groq/openai/v1/chat/completions` with `Authorization: Bearer <key>`, body `{ model, messages, temperature, max_tokens }`.

### 1.3 Prompting strategy

`callGroqAPI()` (inside `AskAIModal.tsx`) builds a **dynamic system prompt** every turn from live store state:

- Identity block: current store name, user name, user role, real date/time (en-NG locale).
- Live data block: **top 5 sellers**, an **inventory snapshot** (top 15 products), **low-stock details** with real product names and counts, **recent transactions** (last 5), active product count, today's revenue, revenue trend % vs yesterday, and a **time-of-day greeting + market mood** ("I'm sorry today's market is not moving well…") for an empathetic, premium tone.
- A **SellSync Platform Guide** (tab-by-tab usage) so the model can answer "how do I…" questions correctly.
- Per-mode verbosity directive (`fast` = short numbers only, `thinking` = structured analysis, `pro` = comprehensive + recommendations).
- Hard rules: plain text only (no `**`, no emojis), answer identity/data questions from the provided context, be honest when data is missing, tailor depth by role (Admin = strategic/multi-store, Manager = operational, Cashier = task-focused), and relate to the user like a real store assistant ("I'm sorry today's market is not moving well…").

**Conversation context:** the previous messages in the current chat tab are appended as `user`/`assistant` turns (the canned welcome greeting is skipped), followed by the new question.

**Fallback (offline-safe):** `generateAIResponse()` first tries the Groq call; if it throws or returns empty, it runs a **static intent matcher** over lowercased keywords — identity ("who am I"), performance ("how am I doing"), best sellers, sales advice, date/time, store performance, inventory/low stock, forecast, profit, greetings, and a generic default. It still produces real numbers from `kpis`/`inventoryArray`/`transactions`, so the app never depends on network availability.

### 1.4 Charts in chat

After computing the text answer, the modal decides on a chart via keywords:

| Question intent | Chart |
|---|---|
| "revenue" / "sales" / "performance" / "how is my store doing" | **Area** — weekly revenue by day (built from transactions) |
| "product" / "inventory" / "stock" / "low" | **Bar** — top 5 products by stock level |
| "forecast" / "prediction" / "trend" / "future" | **Area** — 4-week revenue projection (scaled from today's revenue) |

`ChartRenderer` (`AskAIModal.tsx`) turns that `chartConfig` into a Recharts chart (area/bar), themed for the chat's light/dark toggle, with a **Download CSV** button (`downloadChartCSV`).

### 1.5 Chat UX details (AskAIModal)

- **Tabs:** multiple chats, persisted to `localStorage["sellsync_chat_tabs_v4"]`; create / rename (double-click a tab) / pin / delete / search, plus clear-history.
- **Markdown rendering:** AI messages are rendered through `MarkdownContent` (`MarkdownRenderer.tsx`) — code blocks with syntax highlighting + a copy button, inline code, and light/dark theming.
- **Streaming illusion:** the response is shown word-by-word via a timer into `streamingContent` with a typing indicator ("Analyzing store data…").
- **Message actions:** copy, edit a user message (regenerates), regenerate the last answer, thumbs up/down, share via `EmailShareModal`, and **text-to-speech** via the browser `speechSynthesis` API.
- **Header:** click-to-edit chat title + message count; the `fast/thinking/pro` model selector and the **Live** / **AI Ready** badges were removed.
- **Input:** textarea, Enter to send, **voice input** via `webkitSpeechRecognition` (mic button), **Live context** toggle, and role-aware **quick prompts** (Admin/Manager/Cashier).
- **Right sidebar:** live KPIs (revenue today, trend), plus quick-action cards (View Full Report → `/reports`, Export Data → CSV, Refresh Insights with a spinner).
- **Responsive:** the left chat list becomes a drawer on mobile and the right sidebar becomes a drawer on tablets, both with backdrops.
- **Theme:** independent light/dark toggle, persisted in `sellsync_ai_theme`.

### 1.6 Deterministic Insights engine (Insights / Dashboard)

The **shared engine** lives in `src/app/lib/insights.ts` — `generateInsights(inventoryArray, dailySales)` powers the Dashboard's **AI Insights** panel (each insight rendered by `AISummaryCard.tsx`). `InsightsPage.tsx` keeps its own `dynamicInsights` builder for the full Insights page. Rules:

| Rule (per product) | Insight |
|---|---|
| `stock < reorderPoint` | Critical Stock Alert |
| `stock < reorderPoint * 2` | Medium Priority Stock Alert |
| no sales today & `stock > 100` | Dead Stock Alert |
| no sales today & reorder < stock < 100 | Discount Recommendation |
| sold 1–2 today | Slow-Moving Product Alert |
| sold > 15 today | Top Performer Highlight |
| `stock > 250` | Overstock Alert |
| expired / expiring ≤ 30 days | Product Expired / Expiring Soon |
| always | one static Seasonal Trend Alert |

Each insight carries a priority, category, action label, color-coded icon, and a small **random sparkline trend** (`generateTrend`). Timestamps are faked 8 minutes apart, filtered to the last 6 hours, capped at 20, newest first. These feed the Dashboard's **AI Insights** panel (colored by `type`). This is pure client-side logic — no model inference.

---

## 2. How the UI is structured

### 2.1 Bootstrapping & routing

```
src/main.tsx                  → forces light mode, mounts <App/>
└─ src/app/App.tsx            → <StoreProvider><RouterProvider/></StoreProvider>
   └─ src/app/routes.tsx      → react-router v7 createBrowserRouter
      └─ Layout (root)        → renders sidebar + header + <Outlet/>
         ├─ /                 DashboardPage
         ├─ /stores           StoresPage       (Admin overview only)
         ├─ /team             TeamPage         (Admin overview only)
         ├─ /inventory        InventoryPage
         ├─ /products         ProductsPage
         ├─ /transactions     TransactionsPage
         ├─ /pos              PosPage
         ├─ /insights         InsightsPage
         ├─ /forecasts        ForecastsPage
         ├─ /reports          ReportsPage
         ├─ /notifications    NotificationsPage
         ├─ /staff            StaffPage
         └─ /settings         SettingsPage
```

Every page is wrapped in `<ErrorBoundary>` inside the Layout's `<main>`; a skeleton screen is shown while the store is switching.

### 2.2 Layout chrome (`src/app/components/Layout.tsx`)

- **Sidebar** (desktop fixed, mobile drawer): logo, nav links, and a **Premium upgrade** promo box.
- **Header**: mobile menu button, global search, notification bell with unread badge, **user menu** (Change Store, **Back to Store Overview** for an Admin in a store, **Switch Back to Admin** for anyone previewing a store as Manager/Cashier, theme toggle, logout → `https://sellsync.store/login`).
- **Mobile bottom tab bar**: first 5 items of the filtered nav.
- **Floating AI button**: bottom-right, only on `/` (Dashboard).
- **Modals**: `AskAIModal`, store-switcher (Change Store) dialog, and a Premium upgrade dialog.

### 2.3 The dual navigation model

There are two nav sets and a RBAC filter:

- `adminNavItems` — the Admin **overview** sidebar: Dashboard, Stores, Team, Inventory, Insights, Forecasts, Reports, Staff, Notifications, Settings.
- `operationalNavItems` — the Manager/Cashier (or Admin-inside-a-store) sidebar: Dashboard, Inventory, Products, Transactions, POS, Insights, Forecasts, Reports, Staff, Notifications, Settings.
- `filteredNavItems = navSource.filter(item => permissions[item.name][role].view)` — the permission matrix lives in `src/app/state/store.tsx` and defines view/edit flags per module per role.

Which set is shown depends on `showAdminOverview` (`isAdmin && adminOverview`): the Admin in overview sees the cross-store sidebar (Stores/Team, read-only operational modules), and once inside a store sees the operational tabs. Store switching for the Admin is restricted to manager-run stores.

### 2.4 State management (`src/app/state/store.tsx`)

- **Single React Context + `useReducer` store** (`StoreProvider`) persisted to `localStorage` under the `sellsync_*` prefix.
- A `STORAGE_VERSION` constant wipes all `sellsync_*` keys on migration bumps (fresh installs start empty from onboarding).
- All domain data lives here: users, stores, inventory, transactions, categories, notifications, attendance, payroll, store settings, permissions, theme, `currentStore`, `currentUser`, `adminUser`, `adminOverview`, `dailySales`, KPIs.
- **Admin session snapshot:** when an Admin enters a store as a Manager/Cashier (`loginUser`), the reducer snapshots the Admin into `adminUser` (persisted as `sellsync_admin_user`); `switchBackToAdmin()` restores the Admin session + overview. This survives page refreshes and is cleared on logout.
- **Role-based filtering is a UI-layer concern** — the store keeps everything; pages filter by `currentStore.id` / `currentUser.role` / `assignedStoreIds`.
- Exposed helpers used app-wide: `canView(module)`, `canEdit(module)`, `formatCurrency(amount)` (₦ NGN), `switchStore`, `loginUser`, `switchBackToAdmin`, `setAdminOverview`, plus CRUD for users/stores/products/transactions/settings.

### 2.5 Styling & component system

- **Tailwind CSS 3.x** (`tailwind.config.js`) with shadcn-style CSS-variable theming (hsl vars for border/background/card/primary/etc.) and the `tailwindcss-animate` plugin.
- **Design language:** indigo (`#6366F1`) primary accents, white cards with `border-none rounded-2xl shadow-sm`, `bg-gray-50/30` page backgrounds, uppercase `tracking-widest` micro-labels, and small black uppercase badges.
- **UI primitives:** ~50 shadcn/ui components in `src/app/components/ui/` (dialog, card, tabs, select, tooltip, dropdown-menu, sheet, input, button, etc.).
- **Icons:** `lucide-react`. **Charts:** `recharts` (Dashboard, Insights, Forecasts, Reports, AskAIModal). **Motion:** `framer-motion` with shared variants in `src/animations/variants.ts` (`fadeInUp`, `staggerContainer`, `hoverLift`, `slideInRight`, `pulseGlow`).
- **Toasts:** `sonner` (`<Toaster/>` in Layout). **PDF/Excel:** `jspdf` + `jspdf-autotable`, `xlsx`.

### 2.6 Feature components

Reusable pieces live in `src/app/components/` alongside the Layout and modals:

`AddProductModal`, `ProductCard`, `ProductDetailModal`, `QrGeneratorModal`, `QrScannerModal`, `BulkPOModal`, `ReorderTable`, `POSVoiceButton`, `ForecastChart`, `CustomReportModal`, `ReportPreviewModal`, `EmailShareModal`, `SMSShareModal`, `AskAIModal`, `AISummaryCard`, `KPIValue`, `ErrorBoundary`, plus the `ui/` primitives.

---

## 3. Key file map

| Concern | Path |
|---|---|
| AI chat + Groq call + fallback + ChartRenderer | `src/app/components/AskAIModal.tsx` |
| Markdown / code highlighting for AI replies | `src/app/components/MarkdownRenderer.tsx` |
| Groq dev proxy | `vite.config.ts` |
| Shared rule-based insights engine | `src/app/lib/insights.ts` |
| Dashboard AI panel | `src/app/pages/DashboardPage.tsx` + `src/app/components/AISummaryCard.tsx` |
| Layout, nav sets, store switcher, modals | `src/app/components/Layout.tsx` |
| Routes | `src/app/routes.tsx` |
| React Context + useReducer store, RBAC matrix, reducers | `src/app/state/store.tsx` |
| Backend API service layer (integration) | `src/lib/api.ts` + `BACKEND_INTEGRATION.md` |
| shadcn UI primitives | `src/app/components/ui/` |
| Framer-motion variants | `src/animations/variants.ts` |
| Tailwind theme | `tailwind.config.js` |
