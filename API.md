# SellSync API Documentation

## Table of Contents

1. [Store](#store)
2. [Pages](#pages)
3. [Components](#components)

---

## Store

### State Structure

The **React Context + `useReducer` store** (consumed via `useStore()`) manages all application state with the following slices:

```typescript
interface StoreState {
  // Store Management
  currentStore: Store;
  allStores: Store[];
  switchStore: (storeId: string) => void;

  // User & Auth
  currentUser: User | null;
  adminUser: User | null;          // snapshot of the Admin session
  users: User[];
  loginUser: (user: User) => void;
  switchBackToAdmin: () => void;   // restore Admin from adminUser snapshot
  logoutUser: () => void;
  setAdminOverview: (value: boolean) => void;
  adminOverview: boolean;
  
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  resetUnreadNotifications: () => void;
  
  // Currency
  currency: string;
  formatCurrency: (amount: number) => string;
  
  // Inventory
  inventoryArray: InventoryItem[];
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  removeInventoryItem: (id: string) => void;
  
  // Transactions
  transactions: Transaction[];
  addTransaction: (transaction: Transaction) => void;
  
  // Products
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  removeProduct: (id: string) => void;
  
  // AI
  aiInsights: AIInsight[];
  addAIInsight: (insight: AIInsight) => void;
  
  // Permissions
  permissions: Record<string, Record<string, { view: boolean; edit: boolean; delete: boolean }>>;
}
```

### Store Types

```typescript
interface Store {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Cashier';
  profilePicture?: string;
  assignedStoreIds: string[];
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  reorderPoint: number;
  image?: string;
}

interface Transaction {
  id: string;
  date: string;
  time: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  cashier: string;
  storeId: string;
}

interface TransactionItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  reorderPoint: number;
  image?: string;
  barcode?: string;
  expiryDate?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  timestamp: string;
}

interface AIInsight {
  id: string;
  type: 'trend' | 'alert' | 'recommendation' | 'forecast';
  title: string;
  description: string;
  confidence: number;
  timestamp: string;
}
```

---

## Pages

### DashboardPage

**Route:** `/`

Main dashboard with KPIs and charts.

**Components Used:**
- KPI cards (Revenue, Sales, Customers, Products)
- SalesChart (line chart)
- TopProductsChart (bar chart)
- RecentTransactions
- LowStockAlert

**Calculated Metrics:**
- Total revenue (daily/weekly/monthly)
- Total transactions
- Average transaction value
- Low stock items count

---

### InventoryPage

**Route:** `/inventory`

Inventory management with search and filters.

**Features:**
- Product grid/list view toggle
- Search by name, SKU, category
- Category filter
- Stock status filter (All, Critical, Low, Healthy)
- Bulk actions
- Add/Edit/Delete products

**Components Used:**
- ProductCard
- ProductDetailModal
- BulkPOModal
- ReorderTable

---

### ProductsPage

**Route:** `/products`

Product catalog management.

**Features:**
- Product CRUD operations
- Barcode generation
- QR code generation
- Image upload
- Category management

**Components Used:**
- ProductCard
- ProductDetailModal
- QrGeneratorModal

---

### TransactionsPage

**Route:** `/transactions`

Transaction history and details.

**Features:**
- Transaction list with pagination
- Search by transaction ID
- Date range filter
- Payment method filter
- Transaction details view
- Receipt generation

---

### PosPage

**Route:** `/pos`

Point of Sale terminal interface.

**Features:**
- Product search/scan
- Cart management
- Quantity adjustment
- Price calculation
- Payment processing
- Receipt generation
- Voice input support

**Components Used:**
- POSVoiceButton
- QrScannerModal

---

### InsightsPage

**Route:** `/insights`

AI-powered business insights.

**Features:**
- Sales trends analysis
- Top selling products
- Customer behavior patterns
- Revenue forecasting
- Stock predictions

**Components Used:**
- AISummaryCard
- ForecastChart

---

### ForecastsPage

**Route:** `/forecasts`

Sales predictions and trend analysis.

**Features:**
- 7-day forecast
- 30-day forecast
- Seasonality analysis
- Demand prediction
- Reorder recommendations

**Components Used:**
- ForecastChart

---

### ReportsPage

**Route:** `/reports`

Custom report generation and export.

**Features:**
- Custom date range
- Report type selection (Sales, Inventory, Financial, Staff)
- Preview before export
- Export formats (PDF, Excel, CSV)
- Email/SMS sharing

**Components Used:**
- CustomReportModal
- ReportPreviewModal
- EmailShareModal
- SMSShareModal

---

### NotificationsPage

**Route:** `/notifications`

Alerts and updates management.

**Features:**
- Notification list
- Filter by type
- Mark as read
- Clear all
- Notification settings

---

### SettingsPage

**Route:** `/settings`

Application and store configuration.

**Features:**
- Profile settings
- Store information
- User management
- Role permissions (RBAC)
- Notification preferences
- Theme settings

---

## Components

### AIChatModal

**Purpose:** Full AI chat interface

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |

**Features:**
- Natural language queries
- Context-aware responses
- Quick action buttons
- Message history

---

### AskAIModal

**Purpose:** Quick AI question interface

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |

**Features:**
- Quick question input
- Suggested questions
- AI responses

---

### AISummaryCard

**Purpose:** Display AI-generated summaries

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | Yes | Summary title |
| `content` | string | Yes | Summary content |
| `type` | string | Yes | Summary type (daily, weekly, alert) |

---

### ForecastChart

**Purpose:** Sales forecast visualization

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | ForecastData[] | Yes | Forecast data points |
| `type` | 'line' \| 'bar' | No | Chart type |

---

### ProductCard

**Purpose:** Display product in grid/list

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `product` | Product | Yes | Product data |
| `onEdit` | function | No | Edit handler |
| `onDelete` | function | No | Delete handler |
| `variant` | 'grid' \| 'list' | No | Display variant |

---

### ProductDetailModal

**Purpose:** View/Edit product details

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |
| `product` | Product \| null | Yes | Product to edit (null for new) |
| `onSave` | function | Yes | Save handler |

---

### QrGeneratorModal

**Purpose:** Generate product QR codes

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |
| `product` | Product | Yes | Product for QR |

**Features:**
- QR code generation
- Download as PNG
- Print option
- Batch generation

---

### QrScannerModal

**Purpose:** Scan product QR/barcodes

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |
| `onScan` | function | Yes | Scan result handler |

**Features:**
- Camera access
- Real-time scanning
- Flash toggle
- Manual input fallback

---

### POSVoiceButton

**Purpose:** Voice input for POS

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onTranscript` | function | Yes | Voice transcript handler |

**Features:**
- Speech recognition
- Visual feedback
- Error handling

---

### BulkPOModal

**Purpose:** Bulk purchase order creation

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |
| `items` | InventoryItem[] | Yes | Items for PO |

**Features:**
- Multi-item selection
- Quantity adjustment
- Supplier selection
- PO generation

---

### ReorderTable

**Purpose:** Low stock alerts and reorder

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | InventoryItem[] | Yes | Inventory items |
| `onReorder` | function | Yes | Reorder handler |

---

### CustomReportModal

**Purpose:** Build custom reports

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |
| `onGenerate` | function | Yes | Generate handler |

**Features:**
- Date range selection
- Report type selection
- Column selection
- Grouping options

---

### ReportPreviewModal

**Purpose:** Preview report before export

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |
| `reportData` | object | Yes | Report data |
| `onExport` | function | Yes | Export handler |

---

### EmailShareModal

**Purpose:** Share report via email

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |
| `reportData` | object | Yes | Report to share |

---

### SMSShareModal

**Purpose:** Share report via SMS

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |
| `reportData` | object | Yes | Report to share |

---

### Layout

**Purpose:** Main application layout wrapper

**Features:**
- Sidebar navigation (Admin overview vs operational tabs)
- Header with search
- User dropdown (Change Store, Back to Store Overview, Switch Back to Admin, theme, logout)
- Theme toggle
- AI assistant button
- Mobile bottom nav
- Store switcher
- RBAC enforcement

**Navigation Items (Admin overview):**
| Path | Name | Icon | Roles |
|------|------|------|-------|
| `/` | Dashboard | LayoutDashboard | All |
| `/stores` | Stores | Building2 | Admin |
| `/team` | Team | Users | Admin |
| `/inventory` | Inventory | Package | Admin, Manager |
| `/insights` | Insights | TrendingUp | Admin, Manager |
| `/forecasts` | Forecasts | LineChart | Admin, Manager |
| `/reports` | Reports | FileText | Admin, Manager |
| `/notifications` | Notifications | Bell | All |
| `/settings` | Settings | Settings | Admin |

**Navigation Items (operational — Manager/Cashier or Admin inside a store):**
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
| `/staff` | Staff | UserCog | Admin, Manager |
| `/settings` | Settings | Settings | Admin |

---

### UI Components

Base UI components from shadcn/ui:

| Component | Library | Purpose |
|-----------|---------|---------|
| Button | Radix UI | Interactive buttons |
| Input | Radix UI | Text input |
| Dialog | Radix UI | Modal dialogs |
| DropdownMenu | Radix UI | Dropdown menus |
| Card | Custom | Content containers |
| Badge | Radix UI | Labels/tags |
| Avatar | Radix UI | User avatars |
| Table | Radix UI | Data tables |
| Tabs | Radix UI | Tabbed content |
| Select | Radix UI | Dropdown select |
| Toast | Sonner | Notifications |

---

## Routing

### Route Configuration

```typescript
// routes.tsx
import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "stores", Component: StoresPage },
      { path: "team", Component: TeamPage },
      { path: "inventory", Component: InventoryPage },
      { path: "products", Component: ProductsPage },
      { path: "transactions", Component: TransactionsPage },
      { path: "pos", Component: PosPage },
      { path: "insights", Component: InsightsPage },
      { path: "forecasts", Component: ForecastsPage },
      { path: "reports", Component: ReportsPage },
      { path: "notifications", Component: NotificationsPage },
      { path: "staff", Component: StaffPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
```

### Navigation Hooks

```typescript
import { useNavigate, useLocation } from "react-router";

function MyComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Navigate to a page
  navigate("/inventory");
  
  // Check current path
  const isActive = location.pathname === "/";
}
```

---

## Permissions (RBAC)

### Role Hierarchy

| Role | Permissions |
|------|-------------|
| Admin | Full access to all features |
| Manager | View & edit most features, limited settings |
| Cashier | POS, Products, Notifications only |

### Permission Structure

```typescript
interface Permission {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

type RolePermissions = Record<Role, Permission>;
```

---

## Theme

### Supported Themes

- `light` - Light mode (default)
- `dark` - Dark mode

### Implementation

Theme state is stored in the store and applied via CSS class:

```typescript
// In Layout component
useEffect(() => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}, [theme]);
```

---

## Currency Formatting

Currency is formatted using the store's `formatCurrency` function:

```typescript
const { formatCurrency } = useStore();

// Usage
formatCurrency(1250); // Returns "₦1,250.00"
```

Default currency is Nigerian Naira (₦).
