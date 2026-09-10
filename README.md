# sellsync-app
# SellSync - AI-Powered Store OS

A comprehensive SaaS web dashboard for Nigerian small business owners, combining point-of-sale, inventory management, AI insights, and business analytics.

## Features

- **Point of Sale (POS)** - Process sales with barcode scanning and voice input
- **Inventory Management** - Track stock levels, reorder points, and product details
- **AI Assistant** - Natural language queries for sales insights and stock alerts (Groq-powered, markdown-rendered chat, charts, TTS)
- **Business Insights** - Analytics on sales trends, forecasts, and performance
- **Reports** - Generate and export custom business reports
- **Multi-channel Communication** - Email and SMS notifications
- **QR Code System** - Generate and scan product QR codes
- **Role Hierarchy (Admin → Manager → Cashier)** - Three-tier access control with per-store manager assignments, admin store-switching, and a dedicated "Add Cashier" flow

## Tech Stack

- **Frontend:** React 18+ with TypeScript
- **Styling:** Tailwind CSS with shadcn/ui components
- **State Management:** React Context + `useReducer` (custom `StoreProvider`)
- **Routing:** React Router v7
- **Charts:** Recharts
- **Build Tool:** Vite
- **UI Library:** Material UI (MUI) + Radix UI
- **Motion:** Framer Motion
- **PDF Generation:** jsPDF
- **Barcode/QR:** JsBarcode, html5-qrcode
- **AI:** Groq API (dev proxy via Vite)

## Getting Started

### Prerequisites

- Node.js 18+
- npm, pnpm, or yarn

### Installation

```bash
# Install dependencies
npm install
# or
pnpm install

# Start development server
npm run dev
# or
pnpm dev

# Build for production
npm run build
```

The app will be available at `http://localhost:5173`

> **Fresh installs start empty.** SellSync ships with no demo data. On first
> launch you'll see a short setup screen where you enter your store information
> and are automatically set up as the store Administrator. Everything is stored
> in the browser (localStorage) — nothing is sent to any server.

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
VITE_API_BASE_URL=http://localhost:3000   # your backend API base URL
# VITE_API_TOKEN=your_auth_token_here      # optional static token
# VITE_API_DEBUG=true                      # optional API debug logging
```

See [`BACKEND_INTEGRATION.md`](BACKEND_INTEGRATION.md) for the full backend wiring guide.

## Project Structure

```
react 1/
├── src/
│   ├── app/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/           # Base UI components (shadcn/ui)
│   │   │   ├── AskAIModal.tsx
│   │   │   ├── AISummaryCard.tsx
│   │   │   ├── MarkdownRenderer.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── BulkPOModal.tsx
│   │   │   ├── CustomReportModal.tsx
│   │   │   ├── EmailShareModal.tsx
│   │   │   ├── ForecastChart.tsx
│   │   │   ├── POSVoiceButton.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductDetailModal.tsx
│   │   │   ├── QrGeneratorModal.tsx
│   │   │   ├── QrScannerModal.tsx
│   │   │   ├── ReorderTable.tsx
│   │   │   ├── ReportPreviewModal.tsx
│   │   │   └── SMSShareModal.tsx
│   │   ├── pages/            # Page components
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
│   │   │   ├── StoresPage.tsx
│   │   │   ├── TeamPage.tsx
│   │   │   └── TransactionsPage.tsx
│   │   ├── state/            # State management
│   │   │   └── store.tsx     # React Context + useReducer store
│   │   ├── App.tsx           # Root component
│   │   └── routes.tsx        # Route definitions
│   ├── animations/           # Animation utilities (framer-motion variants)
│   ├── lib/                  # Utility functions
│   │   ├── api.ts            # Backend API service layer (see BACKEND_INTEGRATION.md)
│   │   └── insights.ts       # Deterministic AI insights generator
│   ├── styles/               # Global styles
│   └── main.tsx              # Entry point
├── dist/                     # Production build
├── tailwind.config.js        # Tailwind configuration
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
└── package.json
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | Dashboard | Overview with KPIs and charts |
| `/stores` | Stores | Multi-store management (Admin overview) |
| `/team` | Team | User & role management (Admin overview) |
| `/inventory` | Inventory | Stock management and reorder |
| `/products` | Products | Product catalog management |
| `/transactions` | Transactions | Sales history |
| `/pos` | POS | Point of Sale terminal |
| `/insights` | Insights | AI-powered business insights |
| `/forecasts` | Forecasts | Sales predictions and trends |
| `/reports` | Reports | Custom report generation |
| `/notifications` | Notifications | Alerts and updates |
| `/staff` | Staff | Staff management (operational) |
| `/settings` | Settings | App configuration |

## Backend Integration

The app currently runs fully offline (`localStorage`). A ready-made API service
layer exists in [`src/lib/api.ts`](src/lib/api.ts) and a detailed, file-by-file
integration guide lives in **[`BACKEND_INTEGRATION.md`](BACKEND_INTEGRATION.md)**
— including the auth flow, the `/link/*` endpoint contract, the data-sync
strategy, and the Admin ⇄ Manager ⇄ Cashier login scenario.

## Key Components

### AI Features

- **AIChatModal** - Chat interface for natural language queries
- **AISummaryCard** - AI-generated daily summaries
- **AskAIModal** - Quick AI question interface

### POS Features

- **POSVoiceButton** - Voice input for hands-free operation
- **QrScannerModal** - Scan product QR codes
- **ProductDetailModal** - View/edit product details

### Inventory Features

- **BulkPOModal** - Bulk purchase order creation
- **ReorderTable** - Low stock alerts and reorder management
- **QrGeneratorModal** - Generate product QR codes

### Reports Features

- **CustomReportModal** - Build custom reports
- **ReportPreviewModal** - Preview before export
- **EmailShareModal** - Share reports via email
- **SMSShareModal** - Share reports via SMS

## User Roles & Hierarchy

SellSync uses a three-tier role hierarchy. The single **Admin** can create users directly; **Managers** can request Cashiers for their own stores, subject to Admin approval.

| Role | Limit | Manages | Can Create Users |
|------|-------|---------|------------------|
| **Admin** | 1 | All stores | Manager, Cashier (immediate) |
| **Manager** | 5 | 1+ assigned stores (one Manager per store) | Cashier — but only for own store(s), with **Admin approval** |
| **Cashier** | Unlimited | One assigned store | No |

**Adding a Manager:** **Team** tab (or Settings → Users & Roles) → **Add Manager**. Stores that already have a Manager are hidden from the picker.

**Adding a Cashier (Admin):** **Team** tab (or Settings → Users & Roles) → **Add Cashier**. Pick the store, fill the form — the Cashier is created immediately.

**Adding a Cashier (Manager):** The Manager's Staff tab shows "Team & Cashiers" with an **Add Cashier** button scoped to their own stores. Submitting sends a **pending approval request** to the Admin, who approves or rejects it in Notifications. The Cashier is only created once approved. `add_cashier` requests are Admin-only (the requesting Manager cannot self-approve).

**Cashier scope & metadata:** A Cashier sees only their assigned store's products, categories, and transactions (read-only). Each Cashier row shows an **"Under {Manager}"** badge, and the record stores `createdBy` so it's always clear which Admin/Manager supervises them. Managers own independent stores; Cashiers depend on a store that has a Manager.

**Admin overview vs store context:** The Admin starts in an **overview** mode (sidebar: Dashboard, Stores, Inventory, Insights, Forecasts, Reports, Team, Notifications, Settings) where all data is cross-store and operational modules are read-only. Selecting a store (**Stores → Enter Store** or **Change Store**) drops the Admin into that store's **operational tabs** (Products, POS, Inventory, Transactions, Staff); **Back to Store Overview** returns. The Admin never logs in as a Cashier. Each store's Manager is tracked via `store.managerId`.

**Admin preview & switch-back:** The Stores tab lets an Admin **enter a store as that store's Manager or Cashier** to see the app exactly as they do. The Admin's own session is snapshotted, and a **"Switch Back to Admin"** option (profile menu or Change Store modal) restores the Admin's all-stores overview at any time — even after a page refresh.

**Approvals:** Restricted-action requests (delete product/category, payment settings) can be approved or rejected by the Admin and by the store's Manager.

## State Management

Uses a **React Context + `useReducer`** store (`StoreProvider`) persisted to
`localStorage`, consumed app-wide through the `useStore()` hook.

```typescript
// Example store usage
import { useStore } from './state/store';

function MyComponent() {
  const { products, addProduct, switchBackToAdmin } = useStore();
  // ...
}
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## License

MIT
