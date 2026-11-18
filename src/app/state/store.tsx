/**
 * =============================================================================
 * SELLSYNC STATE MANAGEMENT - BACKEND INTEGRATION GUIDE
 * =============================================================================
 *
 * This file manages all application state using React Context + useReducer.
 * Currently, data is stored in localStorage. To connect to a backend:
 *
 * 1. See src/lib/api.ts for the API service layer with commented examples
 * 2. Copy .env.example to .env and set VITE_API_BASE_URL
 * 3. Replace localStorage reads with API calls (see integration points below)
 * 4. Wrap reducer actions with API calls for write operations
 *
 * =============================================================================
 * INTEGRATION POINTS (search for "BACKEND_INTEGRATION:" comments)
 * =============================================================================
 *
 * 1. Line ~509: Initial state loading (replace localStorage with API fetch)
 * 2. Line ~666: Reducer - COMPLETE_SALE (add API call to save transaction)
 * 3. Line ~744: Reducer - REFUND_TRANSACTION (add API call for refunds)
 * 4. Line ~789: Reducer - ADJUST_STOCK (add API call for stock updates)
 * 5. Line ~831: Reducer - ADD_PRODUCT (add API call to create product)
 * 6. Line ~1361: StoreProvider - useEffect for data fetching
 * 7. Line ~1426: StoreProvider - Persistence logic (add API sync)
 *
 * =============================================================================
 * RECOMMENDED BACKEND ENDPOINTS
 * =============================================================================
 *
 * GET  /link/products      - Fetch all products
 * POST /link/transactions   - Create new sale
 * GET  /link/transactions  - Fetch transaction history
 * PUT  /link/inventory/:id - Update inventory levels
 *
 * See src/lib/api.ts for complete endpoint reference
 * =============================================================================
 */

import React, { createContext, useContext, useMemo, useReducer } from "react";
import {
  canEditModule,
  canViewModule,
} from "../../lib/rbac";
import { consumeHandoffCookie } from "../../lib/externalAuth";
import { toast } from "sonner";
import {
  db,
  clearToken,
  getToken,
  hasToken,
  mapNotification,
  SESSION_EXPIRED_EVENT,
  mapProduct,
  mapRole,
  mapStore,
  mapTerminal,
  mapTransaction,
  mapUser,
  type DbNotification,
  type DbProduct,
  type DbStore,
  type DbTerminal,
  type DbTransaction,
  type DbUser,
  type DbCashierKpis,
} from "../../lib/db";

export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  costPrice?: string;
  supplier?: string;
  manufacturedDate?: string;
  expiryDate?: string;
  // Product photo URL fetched from an image API when the product is created.
  imageUrl?: string;
  // Server truth: a deactivated product is not sellable (the sale API refuses
  // it). `undefined` means active, so local/mock products that never set it
  // keep working.
  isActive?: boolean;
};

export type InventoryItem = Product & {
  stock: number;
  reorderPoint: number;
  createdAt: string;
  storeId: string;
};

export type CartItem = {
  productId: string;
  qty: number;
  price: number;
};

export type Role = "Admin" | "Manager" | "Cashier";

// Used to enforce downward-only impersonation: an account may only act as a
// strictly-lower role (Admin -> Manager/Cashier, Manager -> Cashier). A
// Cashier cannot act as anyone else.
export const ROLE_RANK: Record<Role, number> = {
  Admin: 3,
  Manager: 2,
  Cashier: 1,
};

export const OWNABLE_ROLES: Record<Role, Role[]> = {
  Admin: ["Manager", "Cashier"],
  Manager: ["Cashier"],
  Cashier: [],
};

export type Currency = {
  id: string;
  name: string;
  symbol: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "Active" | "Inactive" | "Pending";
  phone: string;
  assignedStoreIds: string[]; // Changed from assignedStoreId to support multiple stores
  password?: string;
  profilePicture?: string;
  zipCode?: string;
  baseSalary?: number;
  commissionRate?: number;
  allowances?: number;
  deductions?: number;
  allowanceDescription?: string;
  deductionDescription?: string;
  expectedArrivalTime?: string; // "HH:mm" per-user arrival override (falls back to store default)
  lateThreshold?: number; // minutes, per-user late grace override (falls back to store default)
  notes?: string;
  customPermissions?: Record<string, { view: boolean; edit: boolean }>;
  createdBy?: string;
};

export type Preferences = {
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY";
  timeFormat: "12h" | "24h";
  numberFormatting: boolean; // Thousand separators
  notifications: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
    expiryAlerts: boolean;
  };
  receipts: {
    showLogo: boolean;
    showExpiry: boolean;
    showReturnPolicy: boolean;
  };
};

export type ShiftSettings = {
  clockInTime: string; // "HH:mm"
  clockOutTime: string; // "HH:mm"
  gracePeriod: number; // minutes

  // Late Arrival
  lateArrivalPenaltyEnabled: boolean;
  latePenaltyType: "fixed" | "per_minute";
  latePenaltyFixed: number; // ₦
  latePenaltyPerMinute: number; // ₦
  maxLatesPerMonth: number; // e.g. 3

  // Early Departure
  earlyDeparturePenaltyEnabled: boolean;
  earlyDeparturePenaltyType: "fixed" | "per_minute";
  earlyDeparturePenaltyFixed: number; // ₦
  earlyDeparturePenaltyPerMinute: number; // ₦

  // Absent Day
  absentDayPenaltyFixed: number; // ₦
  deductFullDayOnAbsence: boolean;

  // Overtime
  overtimeEnabled: boolean;
  overtimeMinThreshold: number; // minutes
  overtimeRateType: "multiplier" | "fixed";
  overtimeMultiplier: number; // e.g. 1.5
  overtimeFixedPerHour: number; // ₦
  weekendHolidayMultiplier: number; // e.g. 2.0

  // Global
  workingDaysPerMonth: number;
};

export type Attendance = {
  id: string;
  userId: string;
  storeId: string;
  date: string; // ISO Date YYYY-MM-DD
  clockIn?: string; // ISO Datetime
  clockOut?: string; // ISO Datetime
  status: "Present" | "Absent" | "Late";
};

export type PayrollRecord = {
  id: string;
  userId: string;
  storeId: string;
  period: string; // YYYY-MM
  baseSalary: number;
  commissionEarned: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: "Paid" | "Pending";
  paymentDate?: string;
};

export type Store = {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  currency?: string;
  logo?: string;
  tin?: string;
  status: "Active" | "Inactive";
  managerId?: string;
  isAdminStore?: boolean;
};

export type PermissionMatrix = Record<
  string,
  Record<Role, { view: boolean; edit: boolean }>
>;

export type Transaction = {
  id: string;
  datetime: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  vat?: number;
  amount: number;
  payment: string;
  status: "Completed" | "Refunded";
  storeId: string;
  cashier?: string;
  terminalId?: string;
  reference?: string;
  customer?: string;
  notes?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  balance: number;
  loyaltyPoints: number;
};

export type AppNotification = {
  id: string;
  type: "info" | "success" | "warning" | "alert" | "approval";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  // Which store the notice belongs to. An Admin sees every store at once, so
  // the Notifications page uses this to label each card with its shop. Null for
  // older rows written before the feed carried a store.
  storeId?: string | null;
  // A stock alert (low/out of stock, expiry) can be acknowledged from the
  // Notifications page, which moves it out of the Alerts tab into Resolved.
  resolved?: boolean;
  productId?: number;
  link?: string;
  actionId?: string;
  // When set, only this user sees the notification (e.g. a Manager needs to
  // approve a cashier's payment request, or a cashier gets the approval/denial
  // result of their own request).
  recipientUserId?: string;
};

export type PendingActionType =
  | "delete_product"
  | "delete_category"
  | "update_payment_settings"
  | "add_cashier"
  | "delete_store"
  | "add_bank_account"
  | "delete_bank_account"
  | "add_pos_terminal"
  | "delete_pos_terminal"
  | "update_paystack";

export type PendingApproval = {
  id: string;
  actionType: PendingActionType;
  payload: any;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  storeId: string;
  storeName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

export type KPIs = {
  windowHours: number;
  totalRevenue24h: number;
  totalRevenue24hChange: number;
  totalSales24h: number;
  totalSales24hChange: number;
  productsSold24h: number;
  productsSold24hChange: number;
  lowStockCount: number;
  lowStockCountChange: number;
  /** Active lines expiring within the 30-day warning window. */
  expiringSoonCount: number;
  /** Active lines already past their expiry date. */
  expiredCount: number;
};

export type SalesTrendPoint = {
  day: string;
  sales: number;
};

/** Server-computed dashboard data for a single store. */
export type StoreAnalytics = {
  kpis: KPIs;
  trend: { date: string; revenue: number }[];
  topProducts: { productName: string; unitsSold: number }[];
  salesByCategory: { category: string; revenue: number }[];
  hourlySales: { hour: string; revenue: number }[];
};

export type TopProduct = {
  id: number;
  name: string;
  unitsSold: number;
  revenue: number;
  stock: number;
  stockStatus: "healthy" | "low" | "critical";
};

export type DynamicInsight = {
  id: number;
  type: "warning" | "success" | "info";
  message: string;
};

export type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  phoneNumber?: string;
  status: "Verified" | "Pending";
  lastSettlement?: string;
};

export type POSTerminal = {
  id: string;
  storeId?: string;
  name: string;
  provider:
    | "Paystack"
    | "Paystack Terminal"
    | "Moniepoint"
    | "Flutterwave"
    | "Others"
    | "Manual"
    | "Interswitch"
    | "Global Accelerex"
    | "Sliva";
  status: "Connected" | "Offline" | "Coming Soon";
  lastUsed?: string;
  serialNumber?: string;
  terminalId?: string;
  merchantId?: string;
  phoneNumber?: string;
  deviceLocation?: string;
};

export type PaystackSettings = {
  publicKey: string;
  secretKey: string;
  businessEmail: string;
  subaccountCode?: string;
  enabled: boolean;
};

export type LinkingRequest = {
  id: string;
  userId: string;
  userName: string;
  userRole: Role;
  storeId: string;
  type: "Bank" | "POS" | "Paystack";
  action: "add" | "delete";
  details: any;
  status: "Pending" | "Approved" | "Rejected";
  timestamp: string;
  rejectionReason?: string;
};

export type PaymentSettings = {
  autoSettle: boolean;
  allowCash: boolean;
  allowTransfer: boolean;
  allowCard: boolean;
  allowPaystack: boolean;
  enableReceiptSMS: boolean;
  enableReceiptEmail: boolean;
  enableExpiryNotifications: boolean;
  enablePayWithTransfer: boolean;
  virtualAccountDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    phoneNumber?: string;
  };
  paystack?: PaystackSettings;
};

export type ReceiptDefaults = {
  email: string;
  phone: string;
  header?: string;
  footer?: string;
  returnPolicy?: string;
  reportSchedule: "Daily" | "Weekly" | "Monthly";
  reportTime: string; // "HH:mm"
  alertFrequency: "Real-time" | "Daily Summary";
};

type StoreState = {
  inventory: Record<string, InventoryItem>;
  transactions: Transaction[];
  notifications: AppNotification[];
  // Server-side page state for the notification table. `notificationTotal` is
  // the filtered row count for the current tab/search (drives the pager), and
  // `notificationCounts` is the scope-wide KPI totals from the backend.
  notificationTotal: number;
  notificationCounts: {
    total: number;
    unread: number;
    alerts: number;
    resolved: number;
  };
  customers: Customer[];
  terminals: { id: string; name: string; type: "pos" | "linkedAccount" }[];
  categoriesByStore: Record<string, string[]>;
  dailySales: Record<string, number>;
  /**
   * Dashboard figures computed by the backend and keyed by store id.
   *
   * The dashboard used to re-derive revenue, sale counts and low-stock counts
   * in the browser from `state.transactions` / `state.inventory`. That only ever
   * saw the rows the browser happened to be holding, so a live till could sit at
   * zero on every figure while the database had the sales in it, and low stock
   * never matched the catalogue. The API answers the same questions with a
   * single aggregate query, and it applies the caller's own sales scope for a
   * Cashier. Absent for a store means "not loaded yet" — callers fall back to
   * the local derivation rather than showing a hard zero.
   */
  analyticsByStore: Record<string, StoreAnalytics>;
  users: User[];
  currentStore: Store | null;
  allStores: Store[];
  permissions: PermissionMatrix;
  preferences: Preferences;
  theme: "light" | "dark";
  currency: Currency;
  currentUser: User | null;
  // Session owner = the account that actually holds the session token (the
  // person signed in on the Login / landing page). Everyone else in state is
  // accessed only as a downward impersonation. Kept so the owner can switch
  // straight back to their own screen (Admin overview, or a Manager's screen
  // after logging in as one of their Cashiers).
  sessionOwner: User | null;
  // Admin "overview" mode: Admin oversees all stores (cross-store data,
  // admin sidebar with Stores/Team tabs). When false, the Admin is inside a
  // specific store and gets the Manager's operational tabs.
  adminOverview: boolean;
  bankAccounts: BankAccount[];
  posTerminals: POSTerminal[];
  paymentSettings: PaymentSettings;
  receiptDefaults: ReceiptDefaults;
  attendance: Attendance[];
  payroll: PayrollRecord[];
  storeSettings: Record<string, ShiftSettings>;
  linkingRequests: LinkingRequest[];
  pendingApprovals: PendingApproval[];
  exchangeRates: Record<string, number>; // Rates relative to NGN (1 NGN = X Other)
};

type CompleteSalePayload = {
  transactionId?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  vat?: number;
  amount: number;
  payment:
    | "Cash"
    | "Linked Account"
    | "Transfer"
    | "POS Terminal"
    | "Account Balance";
  cashier?: string;
  terminalId?: string;
  reference?: string;
  customer?: string;
  notes?: string;
};

type Action =
  | { type: "COMPLETE_SALE"; payload: CompleteSalePayload }
  | { type: "REFUND_TRANSACTION"; transactionId: string }
  | { type: "ADJUST_STOCK"; productId: number; delta: number }
  | { type: "SET_PRICE"; productId: number; price: number }
  | {
      type: "ADD_PRODUCT";
      product: Omit<InventoryItem, "id"> & { id?: string };
    }
  | {
      type: "SET_STOCK";
      productId: number;
      stock: number;
    }
  | {
      type: "UPDATE_PRODUCT";
      product: InventoryItem;
    }
  | {
      type: "DELETE_PRODUCT";
      productId: number;
    }
  | {
      type: "ADD_CATEGORY";
      name: string;
      storeId: string;
    }
  | {
      type: "DELETE_CATEGORY";
      name: string;
      storeId: string;
    }
  | { type: "SET_DAILY_SALES"; payload: Record<string, number> }
  | { type: "MARK_NOTIFICATION_READ"; id: string }
  | { type: "RESOLVE_NOTIFICATION"; id: string }
  | { type: "MARK_ALL_NOTIFICATIONS_READ" }
  | { type: "CLEAR_ALL_NOTIFICATIONS" }
  | { type: "ADD_USER"; user: User }
  | { type: "DELETE_USER"; userId: string }
  | { type: "UPDATE_USER"; user: User }
  | { type: "ADD_STORE"; store: Store }
  | { type: "DELETE_STORE"; storeId: string }
  | { type: "SWITCH_STORE"; storeId: string }
  | { type: "LOGIN_USER"; user: User }
  | { type: "LOGOUT_USER" }
  | { type: "SET_ADMIN_OVERVIEW"; value: boolean }
  | { type: "SET_CURRENCY"; currency: Currency }
  | { type: "SET_THEME"; theme: "light" | "dark" }
  | { type: "UPDATE_STORE_PROFILE"; store: Store }
  | { type: "RESET_UNREAD_NOTIFICATIONS" }
  | {
      type: "REPLACE_NOTIFICATIONS";
      notifications: AppNotification[];
      total: number;
      counts: {
        total: number;
        unread: number;
        alerts: number;
        resolved: number;
      };
    }
  | { type: "UPDATE_PERMISSIONS"; permissions: PermissionMatrix }
  | { type: "UPDATE_PREFERENCES"; preferences: Preferences }
  | { type: "ADD_BANK_ACCOUNT"; account: BankAccount }
  | { type: "DELETE_BANK_ACCOUNT"; accountId: string }
  | { type: "ADD_POS_TERMINAL"; terminal: POSTerminal }
  | { type: "DELETE_POS_TERMINAL"; terminalId: string }
  | { type: "UPDATE_PAYMENT_SETTINGS"; settings: Partial<PaymentSettings> }
  | { type: "SET_RECEIPT_DEFAULTS"; defaults: ReceiptDefaults }
  | { type: "CLOCK_IN"; userId: string; storeId: string }
  | { type: "CLOCK_OUT"; userId: string; storeId: string }
  | { type: "MARK_ABSENT"; userId: string; storeId: string; date: string }
  | { type: "UPDATE_ATTENDANCE"; attendance: Attendance }
  | { type: "ADD_PAYROLL_RECORD"; record: PayrollRecord }
  | {
      type: "UPDATE_PAYROLL_STATUS";
      id: string;
      status: "Paid" | "Pending";
      paymentDate?: string;
    }
  | { type: "ADD_NOTIFICATION"; notification: AppNotification }
  | {
      type: "UPDATE_STORE_SETTINGS";
      storeId: string;
      settings: Partial<ShiftSettings>;
    }
  | { type: "UPDATE_STAFF_DETAILS"; userId: string; details: Partial<User> }
  | { type: "UPDATE_USER_PASSWORD"; userId: string; newPassword: string }
  | { type: "SUBMIT_LINK_REQUEST"; request: LinkingRequest }
  | { type: "APPROVE_LINK_REQUEST"; requestId: string }
  | { type: "REJECT_LINK_REQUEST"; requestId: string; reason: string }
  | { type: "SUBMIT_APPROVAL_REQUEST"; request: PendingApproval }
  | { type: "APPROVE_APPROVAL_REQUEST"; requestId: string }
  | { type: "REJECT_APPROVAL_REQUEST"; requestId: string; reason?: string }
  | {
      type: "REPLACE_STORE_CATEGORIES";
      storeId: string;
      categories: string[];
    }
  | {
      type: "REPLACE_STORE_PRODUCTS";
      storeId: string;
      products: InventoryItem[];
    }
  | {
      type: "REPLACE_STORE_ANALYTICS";
      storeId: string;
      analytics: StoreAnalytics;
    }
  | {
      type: "REPLACE_STORE_INSIGHT";
      storeId: string;
      insight: DbStoreInsight | null;
    }
  | {
      type: "REPLACE_STORE_TRANSACTIONS";
      storeId: string;
      transactions: Transaction[];
    }
  | {
      type: "HYDRATE_DB";
      payload: {
        me: DbUser;
        stores: DbStore[];
        byStore: Record<
          string,
          {
            products: DbProduct[];
            transactions: DbTransaction[];
            cashiers: DbUser[];
            terminals: DbTerminal[];
          }
        >;
        notifications: DbNotification[];
        notificationTotal: number;
        notificationCounts: {
          total: number;
          unread: number;
          alerts: number;
          resolved: number;
        };
      };
    }
  | { type: "HYDRATE_EXTERNAL_LOGIN"; user: User; store: Store };

const initialInventory: InventoryItem[] = [];

const initialStores: Store[] = [];

const initialPermissions: PermissionMatrix = {
  Dashboard: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: true },
    Cashier: { view: true, edit: true },
  },
  Inventory: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: true },
    Cashier: { view: true, edit: false },
  },
  Products: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: true },
    Cashier: { view: true, edit: false },
  },
  Transactions: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: true },
    Cashier: { view: true, edit: true },
  },
  POS: {
    Admin: { view: true, edit: true },
    // Managers can work the till: `POST /transactions/create` authorises them and
    // resolves their assigned or owned store. This row said false, which is what
    // kept the POS out of a Manager's sidebar after the API was opened up to them.
    Manager: { view: true, edit: true },
    Cashier: { view: true, edit: true },
  },
  Insights: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: false },
    // A Cashier gets insights over its own sales only, which is what the
    // backend serves it. Row said false, hiding the page from the one role the
    // "your till" scope was built for.
    Cashier: { view: true, edit: false },
  },
  Forecasts: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: false },
    Cashier: { view: false, edit: false },
  },
  Reports: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: false },
    Cashier: { view: false, edit: false },
  },
  Staff: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: false },
    // Every Staff endpoint (`/users/:storeId`, `/cashiers/:storeId`, create,
    // deactivate, reactivate) is MANAGER-only, so a Cashier opening this page
    // got an empty list and 403s on every button. Page reachability is enforced
    // by `navModulesForRole`; this row just keeps the page honest.
    Cashier: { view: false, edit: false },
  },
  // Admin-only modules shown on the Admin overview sidebar
  Stores: {
    Admin: { view: true, edit: true },
    Manager: { view: false, edit: false },
    Cashier: { view: false, edit: false },
  },
  Team: {
    Admin: { view: true, edit: true },
    Manager: { view: false, edit: false },
    Cashier: { view: false, edit: false },
  },
  Notifications: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: true },
    Cashier: { view: true, edit: true },
  },
  Settings: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: false },
    Cashier: { view: true, edit: false },
  },
};

// =============================================================================
// STORAGE RESET ON MIGRATION
// Bump STORAGE_VERSION to wipe legacy/demo localStorage on the next launch.
// Fresh production installs ship completely empty and start from onboarding.
// =============================================================================
const STORAGE_VERSION = "dbauth-2026.09.22-v3";
if (localStorage.getItem("sellsync_storage_version") !== STORAGE_VERSION) {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("sellsync_"))
    .forEach((k) => localStorage.removeItem(k));
  localStorage.setItem("sellsync_storage_version", STORAGE_VERSION);
}

const initialState: StoreState = {
  // BACKEND_INTEGRATION: Replace this localStorage read with an API call:
  // const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/link/inventory`);
  // const data = await response.json();
  // return Object.fromEntries(data.map((i: InventoryItem) => [i.id, i]));
  inventory:
    JSON.parse(localStorage.getItem("sellsync_inventory") || "null") ||
    Object.fromEntries(initialInventory.map((i: InventoryItem) => [i.id, i])),
  // BACKEND_INTEGRATION: Replace with: inventory: data,

  // BACKEND_INTEGRATION: Replace with API call to /link/transactions
  transactions: JSON.parse(
    localStorage.getItem("sellsync_transactions") || "[]",
  ),
  notifications: JSON.parse(
    localStorage.getItem("sellsync_notifications") || "null",
  ) || [],
  notificationTotal: 0,
  notificationCounts: { total: 0, unread: 0, alerts: 0, resolved: 0 },
  customers: [],
  terminals: [
    { id: "T-01", name: "Register 1", type: "pos" },
    { id: "T-02", name: "Register 2", type: "pos" },
    { id: "T-03", name: "Mobile App", type: "linkedAccount" },
  ],
  categoriesByStore: {},
  dailySales: {},
  analyticsByStore: {},
  insightsByStore: {},
  users: (() => {
    const raw = JSON.parse(localStorage.getItem("sellsync_users") || "null");
    if (raw) {
      return raw.map((u: any) => ({
        ...u,
        role: u.role === "Cashier" ? "Cashier" : u.role,
      }));
    }
    return [];
  })(),
  allStores: (() => {
    const persistedStores =
      JSON.parse(localStorage.getItem("sellsync_all_stores") || "null") || [];
    return persistedStores.filter((store: Store) => store.id !== "S-ALL");
  })(),
  currentStore: (() => {
    const persistedStore = JSON.parse(
      localStorage.getItem("sellsync_current_store") || "null",
    );
    const availableStores = (
      JSON.parse(localStorage.getItem("sellsync_all_stores") || "null") || []
    ).filter((store: Store) => store.id !== "S-ALL");
    return (
      availableStores.find((store: Store) => persistedStore?.id === store.id) ||
      availableStores[0] ||
      null
    );
  })(),
  permissions: (() => {
    const persisted = JSON.parse(localStorage.getItem("sellsync_permissions") || "null");
    if (!persisted) return initialPermissions;
    const merged = { ...initialPermissions };
    for (const [module, roles] of Object.entries(persisted)) {
      if (!merged[module]) merged[module] = roles as any;
    }
    return merged;
  })(),
  preferences: (() => {
    const saved = JSON.parse(
      localStorage.getItem("sellsync_preferences") || "null",
    );
    const defaults = {
      dateFormat: "DD/MM/YYYY",
      timeFormat: "12h",
      numberFormatting: true,
      notifications: {
        email: true,
        sms: true,
        inApp: true,
        expiryAlerts: true,
      },
      receipts: {
        showLogo: true,
        showExpiry: true,
        showReturnPolicy: true,
      },
    };
    if (!saved) return defaults;
    return {
      ...defaults,
      ...saved,
      notifications: {
        ...defaults.notifications,
        ...(saved.notifications || {}),
      },
      receipts: { ...defaults.receipts, ...(saved.receipts || {}) },
    };
  })() as Preferences,
  theme:
    (localStorage.getItem("sellsync_theme") as "light" | "dark" | null) ||
    "light",
  currency: JSON.parse(
    localStorage.getItem("sellsync_currency") ||
      '{"id":"NGN","name":"Nigerian Naira","symbol":"₦"}',
  ),
  currentUser: (() => {
    const u = JSON.parse(localStorage.getItem("sellsync_user") || "null");
    if (u) {
      u.role = u.role === "Cashier" ? "Cashier" : u.role;
      return u;
    }
    return null;
  })(),
  // The session owner is ALWAYS derived from the backend session (see
  // HYDRATE_DB) — never seeded from localStorage, so a stale Admin snapshot
  // can never leak into a Manager/Cashier session.
  sessionOwner: null,
  adminOverview: (() => {
    const u = JSON.parse(localStorage.getItem("sellsync_user") || "null");
    if (!u || u.role !== "Admin") return false;
    const stored = localStorage.getItem("sellsync_admin_overview");
    return stored === null ? true : stored === "true";
  })(),
  bankAccounts: JSON.parse(
    localStorage.getItem("sellsync_bank_accounts") || "null",
  ) || [],
  posTerminals: JSON.parse(
    localStorage.getItem("sellsync_pos_terminals") || "null",
  ) || [],
  paymentSettings: JSON.parse(
    localStorage.getItem("sellsync_payment_settings") || "null",
  ) || {
    autoSettle: true,
    allowCash: true,
    allowTransfer: true,
    allowCard: true,
    allowPaystack: true,
    enableReceiptSMS: true,
    enableReceiptEmail: true,
    enableExpiryNotifications: true,
    enablePayWithTransfer: true,
    virtualAccountDetails: {
      bankName: "",
      accountNumber: "",
      accountName: "",
    },
    paystack: {
      publicKey: "",
      secretKey: "",
      businessEmail: "",
      subaccountCode: "",
      enabled: false,
    },
  },
  receiptDefaults: (() => {
    const saved = JSON.parse(
      localStorage.getItem("sellsync_receipt_defaults") || "null",
    );
    const defaults = {
      email: "",
      phone: "",
      header: "",
      footer: "",
      returnPolicy: "Exchange allowed within 48 hours with receipt.",
      reportSchedule: "Daily",
      reportTime: "20:00",
      alertFrequency: "Real-time",
    };
    if (!saved) return defaults;
    return { ...defaults, ...saved };
  })() as ReceiptDefaults,
  attendance: JSON.parse(localStorage.getItem("sellsync_attendance") || "[]"),
  payroll: JSON.parse(localStorage.getItem("sellsync_payroll") || "[]"),
  storeSettings: JSON.parse(
    localStorage.getItem("sellsync_store_settings") || "null",
  ) || {},
  linkingRequests: JSON.parse(
    localStorage.getItem("sellsync_linking_requests") || "[]",
  ),
  pendingApprovals: JSON.parse(
    localStorage.getItem("sellsync_pending_approvals") || "[]",
  ),
  exchangeRates: {
    NGN: 1,
    USD: 0.00062,
    GBP: 0.00049,
    EUR: 0.00057,
    GHS: 0.0085,
    ZAR: 0.012,
    CAD: 0.00084,
    AUD: 0.00095,
    JPY: 0.093,
    INR: 0.052,
    CNY: 0.0045,
    KSH: 0.081,
    USH: 2.38,
    TSH: 1.59,
    EGP: 0.03,
    BRL: 0.0031,
    MXN: 0.011,
    RUB: 0.057,
    TRY: 0.02,
    AED: 0.0023,
    SAR: 0.0023,
  },
};

// Delete a store together with everyone assigned to it: its Manager and all
// Cashiers selling there. The Admin's own first/oversight store can never be
// deleted, so this returns state unchanged for it.
function cascadeDeleteStore(state: StoreState, storeId: string): StoreState {
  const store = state.allStores.find((s) => s.id === storeId);
  if (!store || store.isAdminStore) return state;

  const removedUserIds = new Set(
    state.users
      .filter(
        (u) =>
          u.id === store.managerId ||
          (u.role === "Cashier" &&
            (u.assignedStoreIds || []).includes(storeId)),
      )
      .map((u) => u.id),
  );

  const newAllStores = state.allStores.filter((s) => s.id !== storeId);

  return {
    ...state,
    allStores: newAllStores,
    users: state.users.filter((u) => !removedUserIds.has(u.id)),
    currentStore:
      state.currentStore?.id === storeId
        ? newAllStores[0] || null
        : state.currentStore,
    currentUser:
      state.currentUser && removedUserIds.has(state.currentUser.id)
        ? null
        : state.currentUser,
  };
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "COMPLETE_SALE": {
      // Notifications are NOT synthesised here.
      //
      // The reducer used to unshift a "Low Stock Alert" (and a "Sales
      // Milestone" every 10th sale) into local state. Both were invented in
      // the browser: they were never written to the database, so they vanished
      // on refresh, never reached the manager on another device, and the
      // low-stock one duplicated the alert the backend really does persist.
      // The backend now records the sale and any low-stock condition, and
      // `refreshNotifications` pulls the authoritative feed after checkout.
      //
      // Local stock and the sales list are still updated optimistically below
      // so the UI responds instantly; the backend refetch reconciles them.

      const {
        transactionId,
        items,
        subtotal,
        discount,
        vat,
        amount,
        payment,
        cashier,
        terminalId,
        reference,
        customer,
        notes,
      } = action.payload;
      const newInventory = { ...state.inventory };

      for (const item of items) {
        const inv = newInventory[item.productId];
        if (inv) {
          const newStock = Math.max(0, inv.stock - item.qty);
          newInventory[item.productId] = {
            ...inv,
            stock: newStock,
          };
        }
      }
      const now = new Date();
      const tx: Transaction = {
        id: transactionId || `TXN-${now.getTime()}`,
        datetime: now.toISOString(),
        items,
        subtotal,
        discount,
        vat,
        amount,
        payment,
        status: "Completed",
        storeId: state.currentStore?.id || "",
        cashier,
        terminalId,
        reference,
        customer,
        notes,
      };

      // Update daily sales tracking
      const newDailySales = { ...state.dailySales };
      for (const item of items) {
        newDailySales[item.productId] =
          (newDailySales[item.productId] || 0) + item.qty;
      }

      return {
        ...state,
        inventory: newInventory,
        transactions: [tx, ...state.transactions],
        notifications: state.notifications,
        dailySales: newDailySales,
      };
    }
    case "REFUND_TRANSACTION": {
      const txIndex = state.transactions.findIndex(
        (t) => t.id === action.transactionId,
      );
      if (txIndex === -1) return state;

      const tx = state.transactions[txIndex];
      if (tx.status === "Refunded") return state;

      const newTransactions = [...state.transactions];
      newTransactions[txIndex] = { ...tx, status: "Refunded" };

      // Create a negative transaction entry for audit
      const now = new Date();
      const refundAuditTx: Transaction = {
        id: `REF-${tx.id}`,
        datetime: now.toISOString(),
        items: tx.items.map((it) => ({ ...it, qty: -it.qty })),
        subtotal: -tx.subtotal,
        discount: -tx.discount,
        amount: -tx.amount,
        payment: tx.payment,
        status: "Refunded",
        storeId: tx.storeId,
        cashier: state.currentUser?.name || "System",
        customer: tx.customer,
        notes: `Refund for ${tx.id}`,
      };

      // Return items to inventory
      const newInventory = { ...state.inventory };
      for (const item of tx.items) {
        const inv = newInventory[item.productId];
        if (inv) {
          newInventory[item.productId] = {
            ...inv,
            stock: inv.stock + item.qty,
          };
        }
      }

      return {
        ...state,
        transactions: [refundAuditTx, ...newTransactions],
        inventory: newInventory,
      };
    }
    case "ADJUST_STOCK": {
      const inv = state.inventory[action.productId];
      if (!inv) return state;
      const newStock = Math.max(0, inv.stock + action.delta);
      const newNotifications: AppNotification[] = [...state.notifications];

      if (action.delta > 0) {
        // Check if this resolved a low stock alert
        if (inv.stock <= inv.reorderPoint && newStock > inv.reorderPoint) {
          newNotifications.unshift({
            id: `NTF-RES-${Date.now()}`,
            type: "success",
            title: "Alert Resolved",
            message: `${inv.name} stock is back to healthy levels (${newStock} units)`,
            timestamp: new Date().toISOString(),
            read: false,
            productId: action.productId,
            link: "/inventory",
          });
        } else {
          newNotifications.unshift({
            id: `NTF-ADJ-${Date.now()}`,
            type: "success",
            title: "Inventory Updated",
            message: `${action.delta} units of ${inv.name} added to inventory`,
            timestamp: new Date().toISOString(),
            read: false,
            productId: action.productId,
            link: "/inventory",
          });
        }
      }

      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.productId]: { ...inv, stock: newStock },
        },
        notifications: newNotifications,
      };
    }
    case "ADD_PRODUCT": {
      const storeId = action.product.storeId || state.currentStore?.id || "";

      // Ensure product is assigned to a valid store (no global overview store)
      if (!state.allStores.find((s) => s.id === storeId)) {
        return state;
      }

      // Keep the backend-generated id when the product was persisted to the
      // DB; otherwise fall back to a fresh UUID for offline/local mode.
      const id = action.product.id || crypto.randomUUID();
      const item: InventoryItem = { ...action.product, id, storeId };
      return {
        ...state,
        inventory: { ...state.inventory, [id]: item },
      };
    }
    case "UPDATE_PRODUCT": {
      return {
        ...state,
        inventory: { ...state.inventory, [action.product.id]: action.product },
      };
    }
    case "SET_STOCK": {
      const inv = state.inventory[action.productId];
      if (!inv) return state;
      const newStock = Math.max(0, action.stock);
      const newNotifications: AppNotification[] = [...state.notifications];

      if (newStock > inv.stock) {
        // Check if this resolved a low stock alert
        if (inv.stock <= inv.reorderPoint && newStock > inv.reorderPoint) {
          newNotifications.unshift({
            id: `NTF-RES-SET-${Date.now()}`,
            type: "success",
            title: "Alert Resolved",
            message: `${inv.name} stock is back to healthy levels (${newStock} units)`,
            timestamp: new Date().toISOString(),
            read: false,
            productId: action.productId,
            link: "/inventory",
          });
        } else {
          newNotifications.unshift({
            id: `NTF-SET-${Date.now()}`,
            type: "success",
            title: "Inventory Updated",
            message: `${inv.name} stock updated to ${newStock} units`,
            timestamp: new Date().toISOString(),
            read: false,
            productId: action.productId,
            link: "/inventory",
          });
        }
      }

      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.productId]: { ...inv, stock: newStock },
        },
        notifications: newNotifications,
      };
    }
    case "MARK_NOTIFICATION_READ": {
      const target = state.notifications.find((n) => n.id === action.id);
      const counts = { ...state.notificationCounts };
      if (target && !target.read) {
        counts.unread = Math.max(0, counts.unread - 1);
      }
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n,
        ),
        notificationCounts: counts,
      };
    }
    case "RESOLVE_NOTIFICATION": {
      const target = state.notifications.find((n) => n.id === action.id);
      const counts = { ...state.notificationCounts };
      if (target && target.type === "alert" && !target.resolved) {
        counts.alerts = Math.max(0, counts.alerts - 1);
        counts.resolved += 1;
        if (!target.read) counts.unread = Math.max(0, counts.unread - 1);
      }
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, resolved: true, read: true } : n,
        ),
        notificationCounts: counts,
      };
    }
    case "MARK_ALL_NOTIFICATIONS_READ": {
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        notificationCounts: { ...state.notificationCounts, unread: 0 },
      };
    }
    case "CLEAR_ALL_NOTIFICATIONS": {
      return {
        ...state,
        notifications: [],
        notificationTotal: 0,
        notificationCounts: { total: 0, unread: 0, alerts: 0, resolved: 0 },
      };
    }
    case "SET_PRICE": {
      const inv = state.inventory[action.productId];
      if (!inv) return state;
      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.productId]: { ...inv, price: Math.max(0, action.price) },
        },
      };
    }
    case "DELETE_PRODUCT": {
      const { [action.productId]: _, ...rest } = state.inventory;
      return {
        ...state,
        inventory: rest,
      };
    }
    case "REPLACE_STORE_CATEGORIES": {
      const { storeId, categories } = action;
      if (!storeId) return state;
      return {
        ...state,
        categoriesByStore: { ...state.categoriesByStore, [storeId]: categories },
      };
    }
    case "ADD_CATEGORY": {
      const name = action.name.trim();
      const { storeId } = action;
      if (!name || !storeId) return state;
      const list = state.categoriesByStore[storeId] || [];
      if (list.includes(name)) return state;
      return {
        ...state,
        categoriesByStore: {
          ...state.categoriesByStore,
          [storeId]: [...list, name],
        },
      };
    }
    case "DELETE_CATEGORY": {
      const { name, storeId } = action;
      if (!storeId) return state;
      const list = state.categoriesByStore[storeId] || [];
      return {
        ...state,
        categoriesByStore: {
          ...state.categoriesByStore,
          [storeId]: list.filter((c) => c !== name),
        },
      };
    }
    case "SET_DAILY_SALES": {
      return { ...state, dailySales: action.payload };
    }
    case "ADD_USER": {
      if (
        action.user.role === "Admin" &&
        state.users.some((u) => u.role === "Admin")
      ) {
        return state;
      }
      if (
        action.user.role === "Manager" &&
        state.users.filter((u) => u.role === "Manager").length >= 5
      ) {
        return state;
      }
      if (action.user.role !== "Admin") {
        const storeIds = action.user.assignedStoreIds || [];
        if (storeIds.length !== 1) return state;
        const targetStoreId = storeIds[0];
        const targetStore = state.allStores.find((s) => s.id === targetStoreId);
        if (!targetStore) return state;
        if (action.user.role === "Manager") {
          // A store can only ever have one Manager.
          if (targetStore.managerId) return state;
        }
        if (action.user.role === "Cashier") {
          // Cashiers can be added to any store, with or without a Manager.
          if (targetStore.isAdminStore) return state;
        }
      }
      let newAllStores = state.allStores;
      if (action.user.role === "Manager") {
        const storeIds = action.user.assignedStoreIds || [];
        if (storeIds.length === 1) {
          newAllStores = state.allStores.map((s) =>
            s.id === storeIds[0] ? { ...s, managerId: action.user.id } : s,
          );
        }
      }
      return { ...state, users: [...state.users, action.user], allStores: newAllStores };
    }
    case "DELETE_USER": {
      const deletedUser = state.users.find((u) => u.id === action.userId);
      const newAllStores = deletedUser?.role === "Manager"
        ? state.allStores.map((s) =>
            s.managerId === action.userId ? { ...s, managerId: undefined } : s,
          )
        : state.allStores;
      return {
        ...state,
        users: state.users.filter((u) => u.id !== action.userId),
        allStores: newAllStores,
        currentUser:
          state.currentUser?.id === action.userId ? null : state.currentUser,
      };
    }
    case "UPDATE_USER": {
      const oldUser = state.users.find((u) => u.id === action.user.id);
      if (action.user.role !== "Admin") {
        const storeIds = action.user.assignedStoreIds || [];
        if (storeIds.length !== 1) return state;
        const targetStore = state.allStores.find((s) => s.id === storeIds[0]);
        if (!targetStore) return state;
        if (
          action.user.role === "Manager" &&
          (targetStore.isAdminStore ||
            (targetStore.managerId && targetStore.managerId !== action.user.id))
        ) {
          return state;
        }
        if (
          action.user.role === "Cashier" &&
          targetStore.isAdminStore
        ) {
          return state;
        }
      }
      // The Admin role is permanent: an existing Admin can never be demoted.
      const forcedUser =
        oldUser?.role === "Admin" ? { ...action.user, role: "Admin" } : action.user;
      let updatedStores = state.allStores;
      if (oldUser?.role === "Manager" && forcedUser.role !== "Manager") {
        updatedStores = state.allStores.map((s) =>
          s.managerId === action.user.id ? { ...s, managerId: undefined } : s,
        );
      }
      if (forcedUser.role === "Manager") {
        const storeIds = forcedUser.assignedStoreIds || [];
        if (storeIds.length === 1) {
          updatedStores = updatedStores.map((s) =>
            s.id === storeIds[0] ? { ...s, managerId: action.user.id } : s,
          );
        }
      }
      const updatedUsers = state.users.map((u) =>
        u.id === action.user.id ? forcedUser : u,
      );
      const isCurrentUser = state.currentUser?.id === action.user.id;
      return {
        ...state,
        users: updatedUsers,
        allStores: updatedStores,
        currentUser: isCurrentUser ? forcedUser : state.currentUser,
      };
    }
    case "ADD_STORE": {
      const newAllStores = [...state.allStores, action.store];

      // If current user is an Admin, automatically assign them to the new store
      let newCurrentUser = state.currentUser;
      let newUsers = state.users;

      if (state.currentUser?.role === "Admin") {
        const updatedAssignedStoreIds = [
          ...state.currentUser.assignedStoreIds,
          action.store.id,
        ];
        newCurrentUser = {
          ...state.currentUser,
          assignedStoreIds: updatedAssignedStoreIds,
        };
        newUsers = state.users.map((u) =>
          u.id === state.currentUser?.id ? newCurrentUser! : u,
        );
      }

      return {
        ...state,
        allStores: newAllStores,
        currentUser: newCurrentUser,
        users: newUsers,
      };
    }
    case "DELETE_STORE": {
      // The Admin's own first/oversight store can never be deleted.
      const target = state.allStores.find((s) => s.id === action.storeId);
      if (!target || target.isAdminStore) return state;
      return cascadeDeleteStore(state, action.storeId);
    }
    case "SWITCH_STORE": {
      const store = state.allStores.find((s) => s.id === action.storeId);
      if (!store) return state;

      // Role-based restrictions for switching
      if (state.currentUser?.role !== "Admin") {
        if (!state.currentUser?.assignedStoreIds.includes(store.id))
          return state; // Cannot switch to unassigned store
      }

      // Switching into a store exits the Admin overview mode
      return { ...state, currentStore: store, adminOverview: false };
    }
    case "LOGIN_USER": {
      // Block login for users with "Pending" status
      if (action.user.status === "Pending") {
        return state;
      }

      // Downward-only impersonation: you may only ever act as a strictly
      // lower role than the account that owns the session token. A Cashier
      // cannot become a Manager or Admin; a Manager cannot become another
      // Manager or an Admin. Only the Browser puts this through the reducer
      // guard, it protects against any UI path that slips through.
      const owner = state.sessionOwner;
      const ownerRank = owner ? ROLE_RANK[owner.role] : Infinity;
      if (owner && ROLE_RANK[action.user.role] >= ownerRank) {
        console.warn(
          `Blocked login as ${action.user.role} — session owner is ${owner.role}.`,
        );
        return state;
      }

      // Persist the persona to localStorage only for the session owner; an
      // impersonated persona must never be re-seeded as the logged-in user.
      if (!owner || action.user.id === owner.id) {
        localStorage.setItem("sellsync_user", JSON.stringify(action.user));
      }

      // When logging in, set the current store to the first assigned store if the current one is not allowed
      let newStore: Store | null = state.currentStore;
      if (action.user.role !== "Admin") {
        if (!newStore || !action.user.assignedStoreIds.includes(newStore.id)) {
          const firstAssignedStore = state.allStores.find((s) =>
            action.user.assignedStoreIds.includes(s.id),
          );
          if (firstAssignedStore) {
            newStore = firstAssignedStore;
          }
        }
      } else {
        if (!newStore || !state.allStores.find((s) => s.id === newStore?.id)) {
          newStore = state.allStores[0] || null;
        }
      }

      return {
        ...state,
        currentUser: action.user,
        currentStore: newStore,
        adminOverview: action.user.role === "Admin",
        sessionOwner: owner || action.user,
      };
    }
    case "SET_ADMIN_OVERVIEW": {
      return { ...state, adminOverview: action.value };
    }
    case "LOGOUT_USER": {
      localStorage.removeItem("sellsync_user");
      localStorage.removeItem("sellsync_admin_user");
      localStorage.removeItem("sellsync_admin_overview");
      return { ...state, currentUser: null, sessionOwner: null, adminOverview: false };
    }
    case "REPLACE_STORE_PRODUCTS": {
      // Swap in the authoritative product list for a single store, leaving
      // every other store's products untouched. This is what keeps a Cashier's
      // open tab in sync after a Manager adds a product from another browser.
      const { storeId, products } = action;
      const kept: Record<string, InventoryItem> = {};
      for (const [id, item] of Object.entries(state.inventory)) {
        if (item.storeId !== storeId) kept[id] = item;
      }
      for (const p of products) kept[p.id] = p;
      return { ...state, inventory: kept };
    }
    case "REPLACE_STORE_ANALYTICS": {
      // Same per-store scoping as the products/transactions slices: a figure set
      // is only ever read for the store it was fetched for.
      const { storeId, analytics } = action;
      return {
        ...state,
        analyticsByStore: { ...state.analyticsByStore, [storeId]: analytics },
      };
    }
    case "REPLACE_STORE_INSIGHT": {
      // Insights are per-store and per-viewer: a cashier's card summarises their
      // own till while a manager's summarises the shop. Keying by storeId alone
      // would therefore serve one role's figures to the other after a user
      // switch, so the viewer's role is part of the key.
      const { storeId, insight } = action;
      const key = `${storeId}:${state.currentUser?.role ?? "?"}`;
      const insightsByStore = { ...state.insightsByStore };
      if (insight) insightsByStore[key] = insight;
      else delete insightsByStore[key];
      return { ...state, insightsByStore };
    }
    case "REPLACE_STORE_TRANSACTIONS": {
      // Same idea as REPLACE_STORE_PRODUCTS, for sales.
      //
      // Transactions were only ever loaded once, during hydration, so the
      // dashboard, reports and transaction list kept showing the totals from
      // sign-in. A sale rung up on another till (or by another cashier) never
      // appeared until the page was reloaded. Replacing the store's sales on a
      // refresh is what makes those figures move on their own.
      //
      // Other stores' transactions are preserved: in the Admin overview more
      // than one store is in view at a time.
      const { storeId, transactions } = action;
      const kept = state.transactions.filter((t) => t.storeId !== storeId);
      return { ...state, transactions: [...transactions, ...kept] };
    }
    case "HYDRATE_DB": {
      // Replaces the DB-backed slices with data pulled from the real backend.
      // Local-only slices (attendance, payroll, settings, linking requests,
      // bank accounts, etc.) are left untouched.
      const {
        me,
        stores,
        byStore,
        notifications,
        notificationTotal,
        notificationCounts,
      } = action.payload;
      const role = mapRole(me.role);

      // The first store is a normal store just like any other — it can take a
      // Manager and Cashiers. Nothing is treated as an oversight store.
      const dbStores: Store[] = stores.map((s) => mapStore(s));

      const inventory: Record<string, InventoryItem> = {};
      const transactions: Transaction[] = [];
      const cashierUsers: User[] = [];
      const managerUsers: User[] = [];
      const posTerminals: POSTerminal[] = [];
      const mixedTerminals: { id: string; name: string; type: "pos" | "linkedAccount" }[] =
        [];
      // Categories are shared per store from the backend — the taxonomy can no
      // longer drift per-browser, so we do NOT merge stale localStorage here.
      const categoriesByStore: Record<string, string[]> = {};

      stores.forEach((s) => {
        const bundle = byStore[s.id];
        if (!bundle) return;
        bundle.products.forEach((p) => {
          const item = mapProduct(p);
          inventory[item.id] = item;
        });
        bundle.transactions.forEach((t) => transactions.push(mapTransaction(t)));
        bundle.cashiers.forEach((c) =>
          cashierUsers.push(mapUser(c, s.id)),
        );
        bundle.managers.forEach((m) =>
          managerUsers.push(mapUser(m, s.id)),
        );
        bundle.terminals.forEach((t) => {
          const term = mapTerminal(t);
          posTerminals.push(term);
          mixedTerminals.push({ id: term.id, name: term.name, type: "pos" });
        });
        categoriesByStore[s.id] = bundle.categories || [];
      });

      const currentUser: User = {
        ...mapUser(me, me.storeId || stores[0]?.id),
        assignedStoreIds: dbStores.map((s) => s.id),
      };

      // A store is "run by a Manager" only when an actual MANAGER account is
      // linked to it — derive managerId from the fetched managers.
      const dbStoresWithManagers = dbStores.map((store) => {
        const mgr = managerUsers.find(
          (m) => m.assignedStoreIds?.[0] === store.id,
        );
        return mgr ? { ...store, managerId: mgr.id } : store;
      });

      // The DB is the source of truth for the team: the signed-up account
      // owner (Admin) plus the real managers and cashiers. Stale local-only
      // rows (like a bootstrapped "admin@sellsync.com" placeholder or
      // duplicate profiles of the account owner) are dropped here.
      const accountEmail = (me.email || "").toLowerCase();
      const mergedUsers: User[] = [
        currentUser,
        ...managerUsers,
        ...cashierUsers.filter(
          (cu) => (cu.email || "").toLowerCase() !== accountEmail,
        ),
      ];

      return {
        ...state,
        currentUser,
        // The person who holds the session token IS the session owner. Any
        // Admin/Manager acting as staff is a downward impersonation from here.
        sessionOwner: currentUser,
        adminOverview: role === "Admin",
        allStores: dbStoresWithManagers,
        // The DB is authoritative: a fresh account with no stores must land on
        // onboarding, not keep a stale store from a previous session.
        currentStore: dbStoresWithManagers[0] || null,
        inventory,
        transactions,
        notifications: notifications.map(mapNotification),
        notificationTotal,
        notificationCounts,
        posTerminals,
        terminals: mixedTerminals,
        users: mergedUsers,
        categoriesByStore,
      };
    }
    case "HYDRATE_EXTERNAL_LOGIN": {
      // Seeded from a verified landing-page session cookie: log the user in
      // and make sure their own store + user record exist.
      const { user, store } = action;
      const userExists = state.users.some((u) => u.id === user.id);
      const users = userExists
        ? state.users.map((u) => (u.id === user.id ? user : u))
        : [...state.users, user];
      const storeExists = state.allStores.some((s) => s.id === store.id);
      const allStores = storeExists
        ? state.allStores
        : [...state.allStores, store];
      return {
        ...state,
        users,
        allStores,
        currentStore: store,
        currentUser: user,
        sessionOwner: user,
        adminOverview: user.role === "Admin",
      };
    }
    case "SET_CURRENCY": {
      localStorage.setItem(
        "sellsync_currency",
        JSON.stringify(action.currency),
      );
      return { ...state, currency: action.currency };
    }
    case "SET_THEME": {
      return { ...state, theme: action.theme };
    }
    case "UPDATE_STORE_PROFILE": {
      return {
        ...state,
        currentStore: action.store,
        allStores: state.allStores.map((s: Store) =>
          s.id === action.store.id ? action.store : s,
        ),
      };
    }
    case "RESET_UNREAD_NOTIFICATIONS": {
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        notificationCounts: { ...state.notificationCounts, unread: 0 },
      };
    }
    case "REPLACE_NOTIFICATIONS": {
      // Swap in one page from the backend, plus the filtered total for the
      // pager and the scope-wide KPI counts.
      //
      // Resolving is a local acknowledgement, so re-apply it for any id already
      // resolved here. Without this a page read could drag resolved stock
      // alerts back into the Alerts tab.
      const resolvedIds = new Set(
        state.notifications.filter((n) => n.resolved).map((n) => n.id),
      );
      return {
        ...state,
        notifications: action.notifications.map((n) =>
          resolvedIds.has(n.id) ? { ...n, resolved: true } : n,
        ),
        notificationTotal: action.total,
        notificationCounts: action.counts,
      };
    }
    case "UPDATE_PERMISSIONS": {
      return { ...state, permissions: action.permissions };
    }
    case "UPDATE_PREFERENCES": {
      return { ...state, preferences: action.preferences };
    }
    case "ADD_BANK_ACCOUNT": {
      return {
        ...state,
        bankAccounts: [...state.bankAccounts, action.account],
      };
    }
    case "DELETE_BANK_ACCOUNT": {
      return {
        ...state,
        bankAccounts: state.bankAccounts.filter(
          (a) => a.id !== action.accountId,
        ),
      };
    }
    case "ADD_POS_TERMINAL": {
      return {
        ...state,
        posTerminals: [...state.posTerminals, action.terminal],
      };
    }
    case "DELETE_POS_TERMINAL": {
      return {
        ...state,
        posTerminals: state.posTerminals.filter(
          (t) => t.id !== action.terminalId,
        ),
      };
    }
    case "UPDATE_PAYMENT_SETTINGS": {
      return {
        ...state,
        paymentSettings: { ...state.paymentSettings, ...action.settings },
      };
    }
    case "SET_RECEIPT_DEFAULTS": {
      localStorage.setItem(
        "sellsync_receipt_defaults",
        JSON.stringify(action.defaults),
      );
      return { ...state, receiptDefaults: action.defaults };
    }
    case "CLOCK_IN": {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      const existingIndex = state.attendance.findIndex(
        (a) => a.userId === action.userId && a.date === today,
      );

      if (existingIndex !== -1) {
        // Allow re-clock in by clearing clockOut
        return {
          ...state,
          attendance: state.attendance.map((a, i) =>
            i === existingIndex
              ? {
                  ...a,
                  clockIn: a.clockIn || now,
                  clockOut: undefined,
                  status: "Present",
                }
              : a,
          ),
        };
      }

      const newAttendance: Attendance = {
        id: `ATT-${Date.now()}`,
        userId: action.userId,
        storeId: action.storeId,
        date: today,
        clockIn: now,
        status: "Present",
      };
      return { ...state, attendance: [newAttendance, ...state.attendance] };
    }
    case "CLOCK_OUT": {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      return {
        ...state,
        attendance: state.attendance.map((a) =>
          a.userId === action.userId && a.date === today
            ? { ...a, clockOut: now }
            : a,
        ),
      };
    }
    case "MARK_ABSENT": {
      const existingIndex = state.attendance.findIndex(
        (a) => a.userId === action.userId && a.date === action.date,
      );
      if (existingIndex !== -1) {
        return {
          ...state,
          attendance: state.attendance.map((a, i) =>
            i === existingIndex
              ? {
                  ...a,
                  status: "Absent",
                  clockIn: undefined,
                  clockOut: undefined,
                }
              : a,
          ),
        };
      }
      const newAttendance: Attendance = {
        id: `ATT-${Date.now()}`,
        userId: action.userId,
        storeId: action.storeId,
        date: action.date,
        status: "Absent",
      };
      return { ...state, attendance: [newAttendance, ...state.attendance] };
    }
    case "UPDATE_ATTENDANCE": {
      const index = state.attendance.findIndex(
        (a) => a.id === action.attendance.id,
      );
      if (index === -1) {
        return {
          ...state,
          attendance: [action.attendance, ...state.attendance],
        };
      }
      return {
        ...state,
        attendance: state.attendance.map((a) =>
          a.id === action.attendance.id ? action.attendance : a,
        ),
      };
    }
    case "ADD_PAYROLL_RECORD": {
      return { ...state, payroll: [action.record, ...state.payroll] };
    }
    case "UPDATE_PAYROLL_STATUS": {
      return {
        ...state,
        payroll: state.payroll.map((p) =>
          p.id === action.id
            ? { ...p, status: action.status, paymentDate: action.paymentDate }
            : p,
        ),
      };
    }
    case "ADD_NOTIFICATION": {
      return {
        ...state,
        notifications: [action.notification, ...state.notifications],
      };
    }
    case "UPDATE_STORE_SETTINGS":
      return {
        ...state,
        storeSettings: {
          ...state.storeSettings,
          [action.storeId]: {
            ...state.storeSettings[action.storeId],
            ...action.settings,
          },
        },
      };
    case "UPDATE_STAFF_DETAILS":
      const updatedUsersForStaff = state.users.map((u) =>
        u.id === action.userId ? { ...u, ...action.details } : u,
      );
      const isCurrentStaffUser = state.currentUser?.id === action.userId;
      return {
        ...state,
        users: updatedUsersForStaff,
        currentUser: isCurrentStaffUser
          ? { ...state.currentUser!, ...action.details }
          : state.currentUser,
      };
    case "UPDATE_USER_PASSWORD":
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.userId ? { ...u, password: action.newPassword } : u,
        ),
        currentUser:
          state.currentUser?.id === action.userId
            ? { ...state.currentUser, password: action.newPassword }
            : state.currentUser,
      };
    case "SUBMIT_LINK_REQUEST":
      const linkTypeLabel =
        action.request.type === "Bank"
          ? "Bank Account"
          : action.request.type === "POS"
            ? "POS Terminal"
            : "Paystack integration";
      // Payment requests go to the store's Manager. If the store has no
      // manager yet, fall back to no recipient (visible to all Operators).
      const targetStore = state.allStores.find(
        (s) => s.id === action.request.storeId,
      );
      const recipientUserId = targetStore?.managerId || undefined;
      const newNotif: AppNotification = {
        id: `notif-link-${Date.now()}`,
        type: "info",
        title: "New Payment Request",
        message: `${action.request.userName} requested to ${
          action.request.action === "delete"
            ? `delete ${linkTypeLabel.toLowerCase()}`
            : action.request.type === "Paystack"
              ? "set up their Paystack integration"
              : `link a new ${linkTypeLabel}`
        }.`,
        timestamp: new Date().toISOString(),
        read: false,
        link: "/settings",
        recipientUserId,
      };
      return {
        ...state,
        linkingRequests: [action.request, ...state.linkingRequests],
        notifications: [newNotif, ...state.notifications],
      };
    case "APPROVE_LINK_REQUEST": {
      const req = state.linkingRequests.find((r) => r.id === action.requestId);
      if (!req) return state;

      const updatedRequests = state.linkingRequests.map((r) =>
        r.id === action.requestId ? { ...r, status: "Approved" as const } : r,
      );

      const isDelete = req.action === "delete";
      const approvalNotif: AppNotification = {
        id: `notif-appr-${Date.now()}`,
        type: "success",
        title: "Payment Request Approved",
        message: `Your request to ${
          isDelete ? "delete" : "link"
        } ${
          req.type === "Bank"
            ? req.details.bankName
            : req.type === "POS"
              ? req.details.name
              : "Paystack integration"
        } has been approved and is now ${
          isDelete ? "removed" : "active"
        }.`,
        timestamp: new Date().toISOString(),
        read: false,
        recipientUserId: req.userId,
      };

      if (isDelete) {
        if (req.type === "Bank") {
          return {
            ...state,
            linkingRequests: updatedRequests,
            bankAccounts: state.bankAccounts.filter(
              (a) => a.id !== req.details.id,
            ),
            notifications: [approvalNotif, ...state.notifications],
          };
        } else if (req.type === "POS") {
          return {
            ...state,
            linkingRequests: updatedRequests,
            posTerminals: state.posTerminals.filter(
              (t) => t.id !== req.details.id,
            ),
            notifications: [approvalNotif, ...state.notifications],
          };
        } else {
          return {
            ...state,
            linkingRequests: updatedRequests,
            paymentSettings: {
              ...state.paymentSettings,
              paystack: {
                ...state.paymentSettings.paystack,
                enabled: false,
              },
            },
            notifications: [approvalNotif, ...state.notifications],
          };
        }
      }

      if (req.type === "Bank") {
        return {
          ...state,
          linkingRequests: updatedRequests,
          bankAccounts: [
            ...state.bankAccounts,
            { ...req.details, status: "Verified" },
          ],
          notifications: [approvalNotif, ...state.notifications],
        };
      } else if (req.type === "POS") {
        return {
          ...state,
          linkingRequests: updatedRequests,
          posTerminals: [
            ...state.posTerminals,
            { ...req.details, status: "Connected" },
          ],
          notifications: [approvalNotif, ...state.notifications],
        };
      } else {
        return {
          ...state,
          linkingRequests: updatedRequests,
          paymentSettings: {
            ...state.paymentSettings,
            paystack: {
              ...state.paymentSettings.paystack,
              ...req.details,
              enabled: true,
            },
          },
          notifications: [approvalNotif, ...state.notifications],
        };
      }
    }
    case "REJECT_LINK_REQUEST": {
      const rejReq = state.linkingRequests.find(
        (r) => r.id === action.requestId,
      );
      const rejectionNotif: AppNotification = {
        id: `notif-rej-${Date.now()}`,
        type: "warning",
        title: "Request Denied",
        message: `Your request to ${
          rejReq?.action === "delete" ? "delete" : "link"
        } ${
          rejReq?.type === "Bank"
            ? rejReq.details.bankName
            : rejReq?.type === "POS"
              ? rejReq?.details.name
              : "Paystack integration"
        } was denied by your manager${action.reason ? `: ${action.reason}` : ""}`,
        timestamp: new Date().toISOString(),
        read: false,
        recipientUserId: rejReq?.userId,
      };
      return {
        ...state,
        linkingRequests: state.linkingRequests.map((r) =>
          r.id === action.requestId
            ? {
                ...r,
                status: "Rejected" as const,
                rejectionReason: action.reason,
              }
            : r,
        ),
        notifications: [rejectionNotif, ...state.notifications],
      };
    }
    case "SUBMIT_APPROVAL_REQUEST": {
      const actionLabel = (t: PendingActionType) =>
        t === "delete_product"
          ? "Delete Product"
          : t === "delete_category"
            ? "Delete Category"
            : t === "add_cashier"
              ? "Add Cashier"
              : t === "delete_store"
                ? "Delete Store"
                : t === "add_bank_account"
                  ? "Add Bank Account"
                  : t === "delete_bank_account"
                    ? "Delete Bank Account"
                    : t === "add_pos_terminal"
                      ? "Add POS Terminal"
                      : t === "delete_pos_terminal"
                        ? "Delete POS Terminal"
                        : t === "update_paystack"
                          ? "Update Paystack"
                          : "Update Payment Settings";
      const approvalNotif: AppNotification = {
        id: `notif-approval-${Date.now()}`,
        type: "approval",
        title: `Approval Needed: ${actionLabel(action.request.actionType)}`,
        message: `${action.request.requesterName} (${action.request.requesterRole}) requested to ${
          action.request.actionType === "delete_product"
            ? `delete product #${action.request.payload.productId}`
            : action.request.actionType === "delete_category"
              ? `delete category "${action.request.payload.categoryName}"`
              : action.request.actionType === "add_cashier"
                ? `add cashier "${action.request.payload.user?.name || "New Cashier"}"`
                : action.request.actionType === "delete_store"
                  ? `delete store "${action.request.storeName}"`
                  : action.request.actionType === "add_bank_account"
                    ? `add bank account "${action.request.payload.account?.bankName || ""}"`
                    : action.request.actionType === "delete_bank_account"
                      ? `delete bank account "${action.request.payload.bankName}"`
                      : action.request.actionType === "add_pos_terminal"
                        ? `add POS terminal "${action.request.payload.terminal?.name || ""}"`
                        : action.request.actionType === "delete_pos_terminal"
                          ? `delete POS terminal "${action.request.payload.terminalName}"`
                          : action.request.actionType === "update_paystack"
                            ? "update Paystack integration settings"
                            : "update payment settings"
        } in ${action.request.storeName}.`,
        timestamp: new Date().toISOString(),
        read: false,
        actionId: action.request.id,
      };
      return {
        ...state,
        pendingApprovals: [action.request, ...state.pendingApprovals],
        notifications: [approvalNotif, ...state.notifications],
      };
    }
    case "APPROVE_APPROVAL_REQUEST": {
      const req = state.pendingApprovals.find((r) => r.id === action.requestId);
      if (!req || req.status !== "pending") return state;

      let newState = { ...state, pendingApprovals: state.pendingApprovals.map((r) =>
        r.id === action.requestId ? { ...r, status: "approved" as const, reviewedAt: new Date().toISOString() } : r
      ) };

      switch (req.actionType) {
        case "delete_product": {
          const { [req.payload.productId]: _, ...rest } = newState.inventory;
          newState = { ...newState, inventory: rest };
          break;
        }
        case "delete_category": {
          const catStoreId = req.storeId || req.payload.storeId || "";
          const list = newState.categoriesByStore[catStoreId] || [];
          newState = {
            ...newState,
            categoriesByStore: {
              ...newState.categoriesByStore,
              [catStoreId]: list.filter(
                (c) => c !== req.payload.categoryName,
              ),
            },
          };
          break;
        }
        case "update_payment_settings": {
          newState = { ...newState, paymentSettings: { ...newState.paymentSettings, ...req.payload.settings } };
          break;
        }
        case "add_cashier": {
          const draft = req.payload.user as Partial<User> | undefined;
          if (draft && draft.email) {
            const newCashier: User = {
              id: `U-${Date.now()}`,
              name: draft.name || "Cashier",
              email: draft.email,
              phone: draft.phone || "",
              role: "Cashier",
              status: "Active",
              password: draft.password,
              assignedStoreIds: draft.assignedStoreIds || [],
              zipCode: draft.zipCode,
              createdBy: req.requesterId,
            };
            newState = { ...newState, users: [...newState.users, newCashier] };
          }
          break;
        }
        case "delete_store": {
          // Remove the store plus its Manager and Cashiers. The Admin's own
          // first/oversight store is guarded and can never be deleted.
          newState = cascadeDeleteStore(newState, req.storeId);
          break;
        }
        case "add_bank_account": {
          const bankAccount = req.payload.account as BankAccount | undefined;
          if (bankAccount) {
            newState = { ...newState, bankAccounts: [...newState.bankAccounts, { ...bankAccount, status: "Verified" }] };
          }
          break;
        }
        case "delete_bank_account": {
          const deleteBankId = req.payload.accountId as string;
          newState = { ...newState, bankAccounts: newState.bankAccounts.filter((a) => a.id !== deleteBankId) };
          break;
        }
        case "add_pos_terminal": {
          const posTerminal = req.payload.terminal as POSTerminal | undefined;
          if (posTerminal) {
            newState = { ...newState, posTerminals: [...newState.posTerminals, { ...posTerminal, status: "Connected" }] };
          }
          break;
        }
        case "delete_pos_terminal": {
          const deleteTerminalId = req.payload.terminalId as string;
          newState = { ...newState, posTerminals: newState.posTerminals.filter((t) => t.id !== deleteTerminalId) };
          break;
        }
        case "update_paystack": {
          const paystackSettings = req.payload.settings as Partial<PaymentSettings>;
          if (paystackSettings) {
            newState = { ...newState, paymentSettings: { ...newState.paymentSettings, ...paystackSettings } };
          }
          break;
        }
      }

      const approvedNotif: AppNotification = {
        id: `notif-approved-${Date.now()}`,
        type: "success",
        title: "Request Approved",
        message: `Your request to ${
          req.actionType === "delete_product"
            ? `delete product`
            : req.actionType === "delete_category"
              ? `delete category`
              : req.actionType === "add_cashier"
                ? `add a Cashier`
                : req.actionType === "delete_store"
                  ? `delete store "${req.storeName}"`
                  : req.actionType === "add_bank_account"
                    ? `add bank account "${req.payload.account?.bankName || ""}"`
                    : req.actionType === "delete_bank_account"
                      ? `delete bank account "${req.payload.bankName}"`
                      : req.actionType === "add_pos_terminal"
                        ? `add POS terminal`
                        : req.actionType === "delete_pos_terminal"
                          ? `delete POS terminal`
                          : req.actionType === "update_paystack"
                            ? `update Paystack settings`
                            : `update payment settings`
        } has been approved.`,
        timestamp: new Date().toISOString(),
        read: false,
      };

      return {
        ...newState,
        notifications: [approvedNotif, ...newState.notifications],
      };
    }
    case "REJECT_APPROVAL_REQUEST": {
      const rejectedNotif: AppNotification = {
        id: `notif-rejected-${Date.now()}`,
        type: "warning",
        title: "Request Rejected",
        message: `Your request was rejected${action.reason ? `: ${action.reason}` : ""}.`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      return {
        ...state,
        pendingApprovals: state.pendingApprovals.map((r) =>
          r.id === action.requestId ? { ...r, status: "rejected" as const, reviewedAt: new Date().toISOString(), rejectionReason: action.reason } : r
        ),
        notifications: [rejectedNotif, ...state.notifications],
      };
    }
    default:
      return state;
  }
}

const StoreContext = createContext<
  | (StoreState & {
      // currentStore is exposed as non-null to consumers: Layout renders an
      // onboarding screen until a store exists, so pages never see null here.
      currentStore: Store;
      setTheme: (theme: "light" | "dark") => void;
      setAdminOverview: (value: boolean) => void;
      allTransactions: Transaction[];
      allInventory: InventoryItem[];
      completeSale: (payload: CompleteSalePayload) => Promise<DbTransaction>;
      refundTransaction: (transactionId: string) => void;
      kpis: KPIs;
      salesTrend: SalesTrendPoint[];
      topProducts: TopProduct[];
      dynamicInsights: DynamicInsight[];
      inventoryArray: InventoryItem[];
      addProduct: (p: Omit<InventoryItem, "id"> & { id?: string }) => void;
      /**
       * Re-pull a store's products from the backend. Called by the pages that
       * display the catalog (Inventory, Products, POS, Dashboard) so every
       * role reads the same database rows instead of a login-time snapshot.
       * Safe to call repeatedly — concurrent calls share one request.
       */
      refreshProducts: (storeId?: string) => Promise<void>;
      /**
       * Re-pull a store's sales from the backend so the dashboard, reports and
       * transaction list reflect sales made after sign-in — including by other
       * cashiers. Safe to call repeatedly; concurrent calls share one request.
       */
      refreshTransactions: (storeId?: string) => Promise<void>;
      /**
       * Re-pull server-computed KPIs and the latest store insight. Used by the
       * per-page refresh controls so a page can update itself in place instead
       * of reloading the whole app.
       */
      refreshAnalytics: (storeId?: string) => Promise<void>;
      refreshStoreInsight: (storeId?: string) => Promise<void>;
      /** Re-pull the authoritative notification feed from the backend. */
      refreshNotifications: () => Promise<void>;
      /** Fetch one page of the notification table (10 rows per page). */
      loadNotificationsPage: (opts?: {
        page?: number;
        filter?: string;
        search?: string;
      }) => Promise<{ page: number; total: number; totalPages: number }>;
      /**
       * Today's sales/units for the signed-in cashier, measured server-side and
       * scoped to that cashier's own till.
       */
      fetchCashierKpis: (storeId?: string) => Promise<DbCashierKpis | null>;
      setProductStock: (productId: string, stock: number) => void;
      setProductPrice: (productId: string, price: number) => void;
      deleteProduct: (productId: string) => void;
      addCategory: (name: string) => void;
      removeCategory: (name: string) => void;
      setDailySales: (payload: Record<string, number>) => void;
      markNotificationRead: (id: string) => Promise<void>;
      resolveNotification: (id: string) => Promise<void>;
      markAllNotificationsRead: () => Promise<void>;
      clearAllNotifications: () => void;
      addUser: (u: User) => void;
      deleteUser: (userId: string) => void;
      updateUser: (u: User) => void;
      addStore: (s: Store) => Promise<Store | void>;
      deleteStore: (storeId: string) => void;
      switchStore: (storeId: string) => void;
      loginUser: (u: User) => void;
      sessionOwner: User | null;
      switchBackToOwner: () => Promise<void>;
      logoutUser: () => void;
      status: "loading" | "auth" | "ready";
      login: (email: string, password: string) => Promise<{ id: string; name: string; email: string; role: string }>;
      setCurrency: (c: Currency) => void;
      updateStoreProfile: (s: Store) => void;
      resetUnreadNotifications: () => void;
      updatePermissions: (p: PermissionMatrix) => void;
      updatePreferences: (p: Preferences) => void;
      addBankAccount: (account: BankAccount) => void;
      deleteBankAccount: (accountId: string) => void;
      addPOSTerminal: (terminal: POSTerminal) => Promise<void>;
      deletePOSTerminal: (terminalId: string) => void;
      updatePaymentSettings: (settings: Partial<PaymentSettings>) => void;
      setReceiptDefaults: (defaults: ReceiptDefaults) => void;
      formatCurrency: (amount: number, full?: boolean) => string;
      clockIn: (userId: string, storeId: string) => void;
      clockOut: (userId: string, storeId: string) => void;
      markAbsent: (userId: string, storeId: string, date: string) => void;
      updateAttendance: (attendance: Attendance) => void;
      addPayrollRecord: (record: PayrollRecord) => void;
      updatePayrollStatus: (
        id: string,
        status: "Paid" | "Pending",
        paymentDate?: string,
      ) => void;
      addNotification: (notification: AppNotification) => void;
      updateStoreSettings: (
        storeId: string,
        settings: Partial<ShiftSettings>,
      ) => void;
      updateStaffDetails: (userId: string, details: Partial<User>) => void;
      updateProduct: (p: InventoryItem) => void;
      updateUserPassword: (userId: string, newPassword: string) => void;
      submitLinkRequest: (request: LinkingRequest) => void;
      approveLinkRequest: (requestId: string) => void;
      rejectLinkRequest: (requestId: string, reason: string) => void;
      requestAddCashier: (draft: Partial<User>) => void;
      requestDeleteStore: (storeId: string) => void;
      canView: (module: string) => boolean;
      canEdit: (module: string) => boolean;
      pendingApprovals: PendingApproval[];
      approveApprovalRequest: (requestId: string) => void;
      rejectApprovalRequest: (requestId: string, reason?: string) => void;
    })
  | undefined
>(undefined);

function computeDailySalesMap(transactions: Transaction[]) {
  const today = new Date().toISOString().slice(0, 10);

  return transactions
    .filter(
      (transaction) =>
        transaction.status === "Completed" &&
        transaction.datetime.startsWith(today),
    )
    .reduce<Record<string, number>>((acc, transaction) => {
      transaction.items.forEach((item) => {
        acc[item.productId] = (acc[item.productId] || 0) + item.qty;
      });
      return acc;
    }, {});
}

function computeKPIs(state: StoreState): KPIs {
  // Rolling 24 hours against the 24 hours before that, matching the backend's
  // window exactly. A fallback that used a different window than the server
  // would visibly jump the cards on the first refresh, which is the same class
  // of bug as the UTC/local split that used to sit here: this used to bucket by
  // calendar day, so in the small hours every figure read zero while the chart
  // below showed real revenue.
  //
  // Bucketing uses a local `datetime` string ("YYYY-MM-DDTHH:mm") rather than
  // `toISOString().slice(0, 10)`, which would bucket by UTC and misfile
  // post-midnight sales.
  const windowMs = 24 * 60 * 60 * 1000;
  const windowStart = Date.now() - windowMs;
  const previousStart = Date.now() - windowMs * 2;
  const at = (t: Transaction) => new Date(t.datetime).getTime();

  const windowTx = state.transactions.filter(
    (t: Transaction) => at(t) >= previousStart && t.status === "Completed",
  );
  const currentTx = windowTx.filter((t: Transaction) => at(t) >= windowStart);
  const previousTx = windowTx.filter(
    (t: Transaction) => at(t) < windowStart && at(t) >= previousStart,
  );

  const total = (rows: Transaction[]) => ({
    revenue: rows.reduce((sum: number, t: Transaction) => sum + t.amount, 0),
    sales: rows.length,
    units: rows.reduce(
      (sum: number, t: Transaction) =>
        sum + t.items.reduce((n: number, i: CartItem) => n + i.qty, 0),
      0,
    ),
  });

  const current = total(currentTx);
  const previous = total(previousTx);

  const lowStockCount = Object.values(state.inventory).filter(
    (i: InventoryItem) => i.stock < i.reorderPoint,
  ).length;
  const criticalStockCount = Object.values(state.inventory).filter(
    (i: InventoryItem) => i.stock < i.reorderPoint / 2,
  ).length;

  // Local fallback for the expiry figures, so the cards are still right during
  // the window before the analytics response lands (or if it fails). Matches the
  // API's definition: an item expiring within 30 days, and one already past.
  const nowMs = Date.now();
  const EXPIRY_WARNING_DAYS = 30;
  const expiryCounts = Object.values(state.inventory).reduce(
    (acc, item) => {
      if (!item.expiryDate) return acc;
      const at = new Date(item.expiryDate).getTime();
      if (Number.isNaN(at)) return acc;
      if (at < nowMs) acc.expiredCount += 1;
      else if (at <= nowMs + EXPIRY_WARNING_DAYS * 86400000)
        acc.expiringSoonCount += 1;
      return acc;
    },
    { expiringSoonCount: 0, expiredCount: 0 },
  );

  const getChange = (now: number, then: number) => {
    if (then === 0) return now > 0 ? 100 : 0;
    return Number((((now - then) / then) * 100).toFixed(1));
  };

  return {
    windowHours: 24,
    totalRevenue24h: current.revenue,
    totalRevenue24hChange: getChange(current.revenue, previous.revenue),
    totalSales24h: current.sales,
    totalSales24hChange: getChange(current.sales, previous.sales),
    productsSold24h: current.units,
    productsSold24hChange: getChange(current.units, previous.units),
    lowStockCount,
    lowStockCountChange: criticalStockCount, // We'll use this for the "X critical" label
    ...expiryCounts,
  };
}

function computeSalesTrend(state: StoreState): SalesTrendPoint[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dateStr: d.toISOString().slice(0, 10),
      dayName: days[d.getDay()],
    };
  });

  return last7Days.map((d) => {
    const revenue = state.transactions
      .filter(
        (t) => t.datetime.startsWith(d.dateStr) && t.status === "Completed",
      )
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      day: d.dayName,
      sales: revenue,
    };
  });
}

function computeTopProducts(state: StoreState): TopProduct[] {
  const productStats: Record<string, { unitsSold: number; revenue: number }> =
    {};

  state.transactions
    .filter((t) => t.status === "Completed")
    .forEach((t) => {
      t.items.forEach((item) => {
        if (!productStats[item.productId]) {
          productStats[item.productId] = { unitsSold: 0, revenue: 0 };
        }
        productStats[item.productId].unitsSold += item.qty;
        productStats[item.productId].revenue += item.qty * item.price;
      });
    });

  const sortedProducts = Object.entries(productStats)
    .map(([id, stats]) => {
      const product = state.inventory[id];
      if (!product) return null;
      return {
        id: product.id,
        name: product.name,
        unitsSold: stats.unitsSold,
        revenue: stats.revenue,
        stock: product.stock,
        stockStatus: (product.stock < product.reorderPoint / 2
          ? "critical"
          : product.stock < product.reorderPoint
            ? "low"
            : "healthy") as "healthy" | "low" | "critical",
      };
    })
    .filter((p): p is TopProduct => p !== null)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  // Fallback to inventory if no sales yet
  if (sortedProducts.length === 0) {
    return Object.values(state.inventory)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        name: p.name,
        unitsSold: 0,
        revenue: 0,
        stock: p.stock,
        stockStatus: (p.stock < p.reorderPoint / 2
          ? "critical"
          : p.stock < p.reorderPoint
            ? "low"
            : "healthy") as "healthy" | "low" | "critical",
      }));
  }

  return sortedProducts;
}

function computeDynamicInsights(
  state: StoreState,
  kpis: KPIs,
): DynamicInsight[] {
  const insights: DynamicInsight[] = [];

  // Low Stock Insight
  if (kpis.lowStockCount > 0) {
    insights.push({
      id: 1,
      type: "warning",
      message: `${kpis.lowStockCount} items are below critical stock levels. Reorder recommended.`,
    });
  }

  // Revenue Insight
  if (kpis.totalRevenue24hChange > 0) {
    insights.push({
      id: 2,
      type: "success",
      message: `Revenue is up ${kpis.totalRevenue24hChange}% over the last 24 hours.`,
    });
  } else if (kpis.totalRevenue24hChange < 0) {
    insights.push({
      id: 2,
      type: "warning",
      message: `Revenue is down ${Math.abs(kpis.totalRevenue24hChange)}% over the last 24 hours.`,
    });
  }

  // Peak Traffic Insight (Mocked based on transaction times if we had more)
  insights.push({
    id: 3,
    type: "info",
    message: "Peak traffic expected between 4 PM - 6 PM today.",
  });

  return insights;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrated, setHydrated] = React.useState(false);

  // Tracks the in-flight product refresh per store so that a page mount, a
  // store switch and a window-focus event firing together only produce one
  // request.
  const inFlight = React.useRef<Record<string, Promise<void> | undefined>>(
    {},
  );

  // The same thing for sales refreshes, which has its own lifecycle: a sale
  // triggers one at checkout and the sync hook triggers another, and those must
  // not both be in flight at once.
  //
  // This has to live at component level. Declared inside the context-value
  // useMemo, React warns that a Hook was called from inside useMemo, and the
  // ref would be recreated whenever the memo recomputed — defeating the point.
  const txInFlight = React.useRef<Record<string, Promise<void> | undefined>>(
    {},
  );

  // Same reasoning as txInFlight: this must be component level, not inside the
  // context-value useMemo, or React flags a Hook called from useMemo and the
  // in-flight guard would be thrown away on every recompute.
  const analyticsInFlight = React.useRef<
    Record<string, Promise<void> | undefined>
  >({});

  // =============================================================================
  // SESSION BOOTSTRAP + BACKEND HYDRATION
  // =============================================================================
  // 1) Consume a landing-page handoff cookie (`sellsync_token` = real backend
  //    JWT) if present and persist it locally.
  // 2) When a session token exists, hydrate the DB-backed slices from the real
  //    backend (account, stores, products/inventory, transactions, cashiers,
  //    managers, terminals, notifications).
  // No token after boot (or an invalid one) takes the user to the in-app Login
  // screen — the app is backend-first now, so there is no offline/local-only
  // mode that silently creates phantom stores and staff.
  const [session, setSession] = React.useState<"loading" | "auth" | "ready">("loading");

  // `Promise.allSettled` in the hydration loop turns a failed request into an
  // empty array, which made "not authorised" look exactly like "this store has
  // no products". Log the reason so the cause is visible in the console.
  const reportHydrationFailure = (
    resource: string,
    storeId: string,
    reason: unknown,
  ): never[] => {
    console.error(
      `Hydration failed for ${resource} (store ${storeId}):`,
      reason,
    );
    return [];
  };

  const hydrateFromDb = React.useCallback(async () => {    const me = (await db.auth.me()).data;

    const stores =
      me.role === "ADMIN" || me.role === "MANAGER"
        ? (await db.stores.fetch()).data.stores
        : (await db.stores.myStore()).data.stores;

    const notificationPage = await db.notifications.fetch(
      me.role === "ADMIN" ? undefined : stores[0]?.id,
    );
    const notifications = notificationPage.notifications;

    const byStore: Record<
      string,
{
            products: DbProduct[];
            transactions: DbTransaction[];
            cashiers: DbUser[];
            managers: DbUser[];
            terminals: DbTerminal[];
            categories: string[];
          }
    > = {};

    for (const s of stores) {
      const [products, transactions, cashiers, managers, categories] = await Promise.allSettled([
        db.products.fetch(s.id),
        db.transactions.fetch(s.id),
        db.cashiers.fetch(s.id),
        db.managers.fetch(s.id),
        db.categories.fetch(s.id),
      ]);
      let terminals: DbTerminal[] = [];
      try {
        terminals = (await db.terminals.fetch(s.id)).terminals;
      } catch {
        /* cashiers can't fetch terminals — leave empty */
      }
      byStore[s.id] = {
        products:
          products.status === "fulfilled"
            ? products.value.products
            : reportHydrationFailure("products", s.id, products.reason),
        transactions:
          transactions.status === "fulfilled"
            ? transactions.value.transactions
            : [],
        cashiers: cashiers.status === "fulfilled" ? cashiers.value.cashiers : [],
        managers: managers.status === "fulfilled" ? managers.value.managers : [],
        terminals,
        categories:
          categories.status === "fulfilled"
            ? categories.value.categories.map((c) => c.name)
            : [],
      };
    }

    dispatch({
      type: "HYDRATE_DB",
      payload: {
        me,
        stores,
        byStore,
        notifications,
        notificationTotal: notificationPage.total,
        notificationCounts: notificationPage.counts,
      },
    });

    // The dashboard reads its figures from the backend, so ask for them as part
    // of signing in rather than waiting for the first render to notice they are
    // missing. A failure here leaves the local derivation in place.
    await Promise.allSettled(stores.map((s) => refreshAnalytics(s.id)));
    await Promise.allSettled(stores.map((s) => refreshStoreInsight(s.id)));
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        consumeHandoffCookie();
        if (!getToken()) {
          if (!cancelled) setSession("auth");
          return;
        }
        await hydrateFromDb();
        if (!cancelled) setSession("ready");
      } catch (error) {
        console.error("Backend hydration failed:", error);
        // Invalid/expired token — drop it and ask the user to sign in again.
        clearToken();
        if (!cancelled) setSession("auth");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateFromDb]);

  // =============================================================================
  // Session expiry
  // =============================================================================
  // `lib/db.ts` cannot reach into the store, so a request that fails
  // authentication clears the token and fires SESSION_EXPIRED_EVENT. Without
  // this listener the app would sit on a dead session: every call rejected,
  // nothing telling the user why. One handler ends the session everywhere.
  React.useEffect(() => {
    const onExpired = () => {
      dispatch({ type: "LOGOUT_USER" });
      setSession("auth");
      toast.error("Your session has expired. Please sign in again.");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // =============================================================================
  // ANALYTICS REFRESH
  // =============================================================================
  /**
   * Pull the dashboard's headline figures from the backend.
   *
   * Each of the five endpoints is independent, so one failure (a Cashier
   * being refused a chart route, say) must not blank the whole dashboard —
   * `allSettled` keeps whatever came back and the KPI cards fall back to the
   * local derivation for the rest. Nothing here is awaited by the render
   * path, so a slow analytics query cannot delay the first paint.
   */
  const refreshAnalytics = async (storeId?: string): Promise<void> => {
    const target = storeId || state.currentStore?.id;
    if (!target || !getToken()) return;
    if (target === "S-ALL") return;
    if (analyticsInFlight.current[target]) return analyticsInFlight.current[target];

    const request = (async () => {
      try {
        const [kpis, trend, topProducts, byCategory, hourly] =
          await Promise.allSettled([
            db.analytics.kpis(target),
            db.analytics.salesTrend(target),
            db.analytics.topProducts(target),
            db.analytics.salesByCategory(target),
            db.analytics.hourlySales(target),
          ]);

        if (kpis.status !== "fulfilled") {
          console.error(
            `Analytics KPI refresh failed for store ${target}:`,
            kpis.reason,
          );
          return;
        }

        const value = (kpis.value.kpis || {}) as Partial<KPIs>;
        dispatch({
          type: "REPLACE_STORE_ANALYTICS",
          storeId: target,
          analytics: {
            kpis: {
              windowHours: value.windowHours ?? 24,
              totalRevenue24h: value.totalRevenue24h ?? 0,
              totalRevenue24hChange: value.totalRevenue24hChange ?? 0,
              totalSales24h: value.totalSales24h ?? 0,
              totalSales24hChange: value.totalSales24hChange ?? 0,
              productsSold24h: value.productsSold24h ?? 0,
              productsSold24hChange: value.productsSold24hChange ?? 0,
              lowStockCount: value.lowStockCount ?? 0,
              lowStockCountChange: value.lowStockCountChange ?? 0,
              expiringSoonCount: value.expiringSoonCount ?? 0,
              expiredCount: value.expiredCount ?? 0,
            },
            trend:
              trend.status === "fulfilled" ? trend.value.dailySales || [] : [],
            topProducts:
              topProducts.status === "fulfilled"
                ? topProducts.value.topProducts || []
                : [],
            salesByCategory:
              byCategory.status === "fulfilled"
                ? byCategory.value.salesByCategory || []
                : [],
            hourlySales:
              hourly.status === "fulfilled" ? hourly.value.hourlySales || [] : [],
          },
        });
      } finally {
        delete analyticsInFlight.current[target];
      }
    })();

    analyticsInFlight.current[target] = request;
    return request;
  };

  /**
   * Today's till figures for the signed-in cashier, measured by the backend.
   *
   * Deliberately *not* stored in state: it is a point-in-time snapshot the
   * cashier dashboard reads on mount and after a sale, and caching it in the
   * store risked it going stale behind the local transaction list. The backend
   * scopes a CASHIER to their own `cashierId`, so the numbers are that till's.
   */
  const fetchCashierKpis = async (
    storeId?: string,
  ): Promise<DbCashierKpis | null> => {
    const target = storeId || state.currentStore?.id;
    if (!target || !getToken()) return null;
    try {
      const cashierId = state.currentUser?.role === "CASHIER" ? state.currentUser?.id : undefined;
      const { cashierKpis } = await db.analytics.cashierKpis(target, cashierId);
      return cashierKpis;
    } catch (error) {
      console.error(`Cashier KPI fetch failed for store ${target}:`, error);
      return null;
    }
  };

  // =============================================================================
  // INSIGHT REFRESH
  // =============================================================================
  // The dashboard's insight cards read GET /ai/:storeId/insight instead of being
  // generated in the browser. `generateInsights` produced its sparkline points
  // with Math.random() and stamped its cards at fabricated 8-minute intervals, so
  // the numbers on screen were decoration. Everything now is measured server-side
  // from the store's own transactions and inventory.
  //
  // Scope comes from the backend and differs by role on purpose: a manager reads
  // the store-wide summary, a cashier reads their own till. Because the two are
  // different data, the state is keyed by store *and* role — switching users
  // without switching stores would otherwise show one role's figures to the
  // other.
  const insightInFlight = React.useRef<Record<string, Promise<void> | undefined>>({});

  const refreshStoreInsight = React.useCallback(async (storeId?: string) => {
    const target = storeId || state.currentStore?.id;
    if (!target || !getToken()) return;
    if (target === "S-ALL") return;
    if (insightInFlight.current[target]) return insightInFlight.current[target];

    const request = (async () => {
      try {
        const res = await db.insights.fetch(target);
        dispatch({
          type: "REPLACE_STORE_INSIGHT",
          storeId: target,
          insight: {
            success: res.success,
            scope: res.scope,
            title: res.title,
            summary: res.summary ?? null,
            insights: res.insights || [],
          },
        });
      } catch (error) {
        // The backend can legitimately have nothing yet. Clear any stale card
        // rather than leaving a previous store's summary on screen.
        console.error(`Insight refresh failed for store ${target}:`, error);
        dispatch({ type: "REPLACE_STORE_INSIGHT", storeId: target, insight: null });
      } finally {
        delete insightInFlight.current[target];
      }
    })();

    insightInFlight.current[target] = request;
    return request;
  }, [state.currentStore?.id]);

  // =============================================================================
  // NOTIFICATION REFRESH
  // =============================================================================
  // One helper, three triggers. The feed is owned by the backend, so the UI
  // re-reads it rather than patching it locally:
  //   - after a write (a sale), so the new entry appears immediately
  //   - when the tab regains focus, so a cashier on another till is seen
  //   - on a slow interval, as a backstop for a tab left open all day
  // Load one page of the notification table. The page component owns the
  // current page / tab / search; this just fetches that slice and stores the
  // filtered total (pager) plus the scope-wide KPI counts from the backend.
  const loadNotificationsPage = React.useCallback(
    async (opts: { page?: number; filter?: string; search?: string } = {}) => {
      if (!getToken()) return { page: 1, total: 0, totalPages: 0 };
      // Admins own every store, so their feed must span all of them — scoping
      // to the admin's own (empty) store was why their notification list stayed
      // at zero while sales were being recorded elsewhere. Everyone else is
      // scoped to their store.
      const storeId =
        state.currentUser?.role === "Admin"
          ? undefined
          : state.currentStore?.id;
      const result = await db.notifications.fetch(storeId, {
        page: opts.page ?? 1,
        limit: 10,
        filter: opts.filter,
        search: opts.search,
      });
      dispatch({
        type: "REPLACE_NOTIFICATIONS",
        notifications: result.notifications.map(mapNotification),
        total: result.total,
        counts: result.counts,
      });
      return {
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
      };
    },
    [state.currentStore?.id, state.currentUser?.role],
  );

  // Re-read page one (and the KPI counts) after a write, on focus, and on the
  // slow poll. The Notifications page pauses those triggers while it is open so
  // they cannot yank the user back to page one.
  const refreshNotifications = React.useCallback(async () => {
    await loadNotificationsPage({ page: 1 });
  }, [loadNotificationsPage]);

  React.useEffect(() => {
    if (!hasToken() || session !== "ready") return;

    const onFocus = () => {
      // The feed is paged on the Notifications page; a focus refresh there
      // would reset the list to page one and drop the pages already loaded.
      if (window.location.pathname === "/notifications") return;
      refreshNotifications().catch((error) =>
        console.error("Notification refresh failed:", error),
      );
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshNotifications, session]);

  React.useEffect(() => {
    if (!hasToken() || session !== "ready") return;
    // 60s: often enough to notice a colleague's activity, rare enough not to
    // matter on a till. Visibility is also checked so a backgrounded tab that
    // browsers throttle does not keep polling. Skipped on the Notifications
    // page for the same paging reason as the focus handler.
    const id = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        window.location.pathname !== "/notifications"
      ) {
        refreshNotifications().catch(() => {});
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refreshNotifications, session]);

  // =============================================================================
  // BACKEND_INTEGRATION: Data Fetching on Mount
  // =============================================================================
  // Replace individual useEffect calls with API calls to load initial data:
  //
  // useEffect(() => {
  //   const fetchInitialData = async () => {
  //     try {
  //       const baseUrl = import.meta.env.VITE_API_BASE_URL;
  //
  //       const [inventoryRes, transactionsRes, usersRes] = await Promise.all([
  //         fetch(`${baseUrl}/link/inventory`),
  //         fetch(`${baseUrl}/link/transactions`),
  //         fetch(`${baseUrl}/link/users`),
  //       ]);
  //
  //       const [inventoryData, transactionsData, usersData] = await Promise.all([
  //         inventoryRes.json(),
  //         transactionsRes.json(),
  //         usersRes.json(),
  //       ]);
  //
  //       // Dispatch actions to set initial data from API
  //       // dispatch({ type: "SET_INVENTORY", payload: inventoryData });
  //       // dispatch({ type: "SET_TRANSACTIONS", payload: transactionsData });
  //     } catch (error) {
  //       console.error("Failed to fetch initial data:", error);
  //     }
  //   };
  //
  //   fetchInitialData();
  // }, []);
  // =============================================================================

  // Apply theme to document
  React.useEffect(() => {
    if (state.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [state.theme]);

  // Expiry alerts are NOT generated here.
  //
  // This used to run a `checkExpiries` sweep every hour which built notification
  // objects in memory and dispatched them into client state. It was removed
  // because none of it was real:
  //
  //   - a notification created in the browser is not in the database, so it
  //     existed on this tab only, vanished on reload, and never reached the
  //     owner's phone. Low-stock alerts had already moved to the backend;
  //     expiry alerts were the last ones still pretending.
  //   - it logged `[EXPIRY ALERT] Sending SMS/Email to <phone>/<email>` for
  //     every product it saw. Nothing was sent. An operator watching that
  //     console believed expiry alerts were going out to customers.
  //   - the dedupe key was rebuilt in memory each pass, so "already sent" could
  //     not survive a reload and the same alert re-fired forever.
  //
  // Expiry is now scanned server-side (services/expiry.service.js): an hourly
  // sweep plus an immediate rescan whenever a product's date changes. Each
  // (product, urgency band) fires exactly once, enforced by a unique index, and
  // the alert arrives as a real Notification row that every device sees.
  //
  // KNOWN GAP: `paymentSettings.enableExpiryNotifications` no longer has any
  // effect. It was never more than a client-side flag (there is no settings
  // table on Store, so it has never survived a device change), and now that the
  // decision is made on the server there is nowhere for the server to read it
  // from. Turning the toggle off currently silences nothing. Wiring it properly
  // needs a per-store settings column or table, which is a design decision
  // rather than a bug fix — flagged rather than guessed at.

  // Persistence logic
  // =============================================================================
  // BACKEND_INTEGRATION: Real-time Sync
  // =============================================================================
  // For backend sync, replace localStorage with debounced API calls:
  //
  // React.useEffect(() => {
  //   const syncToBackend = debounce(async () => {
  //     try {
  //       await fetch(`${import.meta.env.VITE_API_BASE_URL}/link/sync`, {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           inventory: state.inventory,
  //           transactions: state.transactions,
  //           // ...other state to sync
  //         }),
  //       });
  //     } catch (error) {
  //       console.error("Sync failed:", error);
  //     }
  //   }, 1000); // Debounce for 1 second to avoid excessive API calls
  //
  //   syncToBackend();
  // }, [state.inventory, state.transactions]);
  // =============================================================================

  React.useEffect(() => {
    localStorage.setItem("sellsync_inventory", JSON.stringify(state.inventory));
    localStorage.setItem(
      "sellsync_transactions",
      JSON.stringify(state.transactions),
    );
    localStorage.setItem(
      "sellsync_notifications",
      JSON.stringify(state.notifications),
    );
    localStorage.setItem("sellsync_users", JSON.stringify(state.users));
    localStorage.setItem(
      "sellsync_current_store",
      JSON.stringify(state.currentStore),
    );
    localStorage.setItem(
      "sellsync_all_stores",
      JSON.stringify(state.allStores),
    );
    localStorage.setItem(
      "sellsync_permissions",
      JSON.stringify(state.permissions),
    );
    localStorage.setItem(
      "sellsync_preferences",
      JSON.stringify(state.preferences),
    );
    localStorage.setItem("sellsync_theme", state.theme);
    localStorage.setItem("sellsync_currency", JSON.stringify(state.currency));
    // Persist the logged-in persona only for the true session owner — an
    // impersonated Manager/Cashier must never be re-seeded as the account.
    if (!state.sessionOwner || state.currentUser?.id === state.sessionOwner.id) {
      localStorage.setItem("sellsync_user", JSON.stringify(state.currentUser));
    }
    localStorage.setItem(
      "sellsync_admin_overview",
      String(state.adminOverview),
    );
    localStorage.setItem(
      "sellsync_bank_accounts",
      JSON.stringify(state.bankAccounts),
    );
    localStorage.setItem(
      "sellsync_pos_terminals",
      JSON.stringify(state.posTerminals),
    );
    localStorage.setItem(
      "sellsync_payment_settings",
      JSON.stringify(state.paymentSettings),
    );
    localStorage.setItem(
      "sellsync_receipt_defaults",
      JSON.stringify(state.receiptDefaults),
    );
    localStorage.setItem(
      "sellsync_attendance",
      JSON.stringify(state.attendance),
    );
    localStorage.setItem("sellsync_payroll", JSON.stringify(state.payroll));
    localStorage.setItem(
      "sellsync_store_settings",
      JSON.stringify(state.storeSettings),
    );
    localStorage.setItem(
      "sellsync_linking_requests",
      JSON.stringify(state.linkingRequests),
    );
    localStorage.setItem(
      "sellsync_pending_approvals",
      JSON.stringify(state.pendingApprovals),
    );
  }, [state]);

  const value = useMemo(() => {
    const isAdmin = state.currentUser?.role === "Admin";

    // =============================================================================
    // MULTI-STORE FILTERING LOGIC
    // =============================================================================
    // Filter data based on role and store selection
    // Admin on "/" (Dashboard) sees global data unless they specifically switched
    // Manager/Staff only see data from their assigned stores

    const assignedIds = state.currentUser?.assignedStoreIds || [];
    // Admin "overview" mode shows data across all stores; otherwise everything
    // is scoped to the currently selected store.
    const isAdminOverview = isAdmin && state.adminOverview;

    // Filtering logic for different data types
    const filterByStore = (item: { storeId: string }) => {
      if (isAdminOverview) return true;
      if (isAdmin) return item.storeId === state.currentStore?.id;
      return (
        assignedIds.includes(item.storeId) &&
        item.storeId === state.currentStore?.id
      );
    };

    const filteredInventory = Object.values(state.inventory).filter(
      filterByStore,
    );
    const filteredTransactions = state.transactions.filter(filterByStore);
    const filteredNotifications = state.notifications.filter((n) => {
      if (!n.productId) {
        // Target-specific notifications (e.g. a Manager's payment requests or
        // a Cashier's approval/denial result) go only to their recipient.
        if (n.recipientUserId) {
          return n.recipientUserId === state.currentUser?.id;
        }
        // Global notifications — scope by role
        const isAdmin = state.currentUser?.role === "Admin";
        // Admin-only notification types
        if (n.type === "approval") return isAdmin;
        if (
          n.title === "New Linking Request" ||
          n.title === "Link Request Approved" ||
          n.title === "Link Request Rejected"
        ) {
          return isAdmin;
        }
        // A Cashier's feed is stock/product events only. "Sale Recorded" is
        // written for every store member, but a cashier does not need their own
        // or a colleague's sale echoed back at them — that is the Manager's
        // reconciliation view. Filtering here (not just on the page) keeps the
        // unread badge and toast from counting sales too.
        if (state.currentUser?.role === "Cashier") {
          const t = (n.title || "").toLowerCase();
          const isStockEvent =
            t.includes("low stock") ||
            t.includes("out of stock") ||
            t.includes("expiry") ||
            t.includes("expired") ||
            t.includes("new product");
          return isStockEvent;
        }
        return true;
      }
      const product = state.inventory[n.productId];
      return product ? filterByStore(product) : true;
    });
    const filteredAttendance = state.attendance.filter(filterByStore);
    const filteredPayroll = state.payroll.filter(filterByStore);
    const filteredLinkingRequests = state.linkingRequests.filter(filterByStore);

    const scopedInventory = Object.fromEntries(
      filteredInventory.map((i) => [i.id, i]),
    );
    const computedDailySales = computeDailySalesMap(filteredTransactions);

    // Server figures win. The local derivation stays as the fallback for the
    // window between first paint and the analytics response, and for a store
    // whose analytics request failed — the dashboard should never sit at zero
    // just because the aggregate query had not landed yet.
    const serverAnalytics = state.currentStore
      ? state.analyticsByStore[state.currentStore.id]
      : undefined;

    const kpis = serverAnalytics?.kpis ?? computeKPIs({
      ...state,
      inventory: scopedInventory,
      transactions: filteredTransactions,
    });
    const salesTrend = serverAnalytics
      ? (serverAnalytics.trend || []).map((p) => ({
          day: p.date,
          sales: p.revenue,
        }))
      : computeSalesTrend({
          ...state,
          transactions: filteredTransactions,
        });
    const topProducts = serverAnalytics
      ? (serverAnalytics.topProducts || []).map((p, i) => ({
          id: i,
          name: p.productName,
          unitsSold: p.unitsSold,
          // The endpoint ranks by units; revenue and stock per product are not
          // part of it, so they are left at 0 rather than invented. The chart
          // renders units.
          revenue: 0,
          stock: 0,
          stockStatus: "healthy" as const,
        }))
      : computeTopProducts({
          ...state,
          inventory: scopedInventory,
          transactions: filteredTransactions,
        });
    const dynamicInsights = computeDynamicInsights(
      {
        ...state,
        inventory: scopedInventory,
        transactions: filteredTransactions,
      },
      kpis,
    );

    const formatCurrency = (amount: number) => {
      const { symbol, id } = state.currency || { id: "NGN", symbol: "₦" };
      const rate = (id && state.exchangeRates[id]) || 1;
      const convertedAmount = amount * rate;

      // Full amounts only. This used to short-circuit to "₦1.5M" for anything
      // over a thousand, which meant a headline revenue figure on the dashboard
      // silently disagreed with the receipts that produced it. The `full` flag
      // that used to opt out of abbreviation is gone with it.
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: id === "NGN" || !id ? "NGN" : id,
          currencyDisplay: "narrowSymbol",
        })
          .format(convertedAmount)
          .replace("NGN", "₦");
      } catch (e) {
        return `${symbol || "₦"}${convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    };

    const role = state.currentUser?.role || "Cashier";

    // Categories are stored per store (backend-driven). Expose the union when
    // the Admin is overseeing all stores, otherwise the active store's list —
    // so POS/Inventory/Products dropdowns keep working unchanged.
    const categories = isAdminOverview
      ? Array.from(new Set(Object.values(state.categoriesByStore).flat()))
      : (state.categoriesByStore[state.currentStore?.id || ""] || []);

    /**
     * Re-read a store's products (and categories) from the API and replace the
     * local copy.
     *
     * This is a plain local function rather than a property of the value
     * object below so that `addProduct`, `updateProduct` and `deleteProduct`
     * can call it. When it was only an object property, those three referenced
     * an undeclared identifier and every product mutation died with
     * "refreshProducts is not defined" inside the .then() — after the API call
     * had already succeeded, so the row appeared to save and then vanished.
     */
    const refreshProducts = async (storeId?: string): Promise<void> => {
      const target = storeId || state.currentStore?.id;
      if (!target || !getToken()) return;
      // In Admin "all stores" overview there is no single store to sync.
      if (target === "S-ALL") return;

      // Collapse concurrent calls (page mount + focus + store switch firing
      // together) into a single request.
      if (inFlight.current[target]) return inFlight.current[target];

      const request = (async () => {
        try {
          const { products } = await db.products.fetch(target);
          const items = products.map(mapProduct);
          dispatch({
            type: "REPLACE_STORE_PRODUCTS",
            storeId: target,
            products: items,
          });
          // Categories are shared too: a product created elsewhere can
          // introduce a category this browser has never seen.
          try {
            const { categories: freshCategories } =
              await db.categories.fetch(target);
            dispatch({
              type: "REPLACE_STORE_CATEGORIES",
              storeId: target,
              categories: freshCategories.map((c) => c.name),
            });
          } catch (error) {
            console.error("Category refresh failed:", error);
          }
        } catch (error) {
          // Previously these failures were swallowed by Promise.allSettled,
          // which made "not permitted" look identical to "no products".
          console.error(`Product refresh failed for store ${target}:`, error);
        } finally {
          delete inFlight.current[target];
        }
      })();

      inFlight.current[target] = request;
      return request;
    };

    /**
     * Re-read a store's sales from the API and replace the local copy.
     *
     * Mirrors `refreshProducts`: same in-flight collapsing so a page mount, a
     * focus event and a store switch cannot fire three overlapping reads, and
     * errors are logged rather than swallowed so "not permitted" never looks
     * like "no sales".
     */
    const refreshTransactions = async (storeId?: string): Promise<void> => {
      const target = storeId || state.currentStore?.id;
      if (!target || !getToken()) return;
      if (target === "S-ALL") return;
      if (txInFlight.current[target]) return txInFlight.current[target];

      const request = (async () => {
        try {
          const { transactions } = await db.transactions.fetch(target);
          dispatch({
            type: "REPLACE_STORE_TRANSACTIONS",
            storeId: target,
            transactions: transactions.map(mapTransaction),
          });
        } catch (error) {
          console.error(`Transaction refresh failed for store ${target}:`, error);
        } finally {
          delete txInFlight.current[target];
        }
      })();

      txInFlight.current[target] = request;
      return request;
    };

    /**
     * Mark every notification read, and persist it.
     *
     * Defined here as a plain function rather than inline in the returned
     * object because `resetUnreadNotifications` (the bell in Layout.tsx) has to
     * call the same thing. When it only existed as a property of the object
     * being built, the reference threw `markAllNotificationsRead is not
     * defined` during render and took down the whole app on login.
     */
    const markAllNotificationsRead = (): Promise<void> => {
      let request: Promise<unknown> = Promise.resolve();
      if (getToken()) {
        // Admins read every store's feed, so "mark all" must not be narrowed to
        // the admin's own store; everyone else is scoped to theirs.
        const storeId =
          state.currentUser?.role === "Admin"
            ? undefined
            : state.currentStore?.id;
        request = db.notifications
          .markAllRead(storeId)
          .catch((error) =>
            console.error("Notifications failed to persist:", error),
          );
      }
      dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" });
      // The local state updates immediately; callers that want a fresh page
      // (e.g. the Notifications table) can await the persistence.
      return request.then(() => undefined);
    };

    return {
      ...state,
      categories,
      currentStore: state.currentStore as Store,
      setAdminOverview: (value: boolean) =>
        dispatch({ type: "SET_ADMIN_OVERVIEW", value }),
      allTransactions: state.transactions,
      allInventory: Object.values(state.inventory),
      kpis,
      salesTrend,
      topProducts,
      dynamicInsights,
      inventoryArray: filteredInventory,
      dailySales: computedDailySales,
      transactions: filteredTransactions,
      notifications: filteredNotifications,
      posTerminals: state.posTerminals.filter((terminal) => {
        if (isAdminOverview) return true;
        return (
          !terminal.storeId || terminal.storeId === state.currentStore?.id
        );
      }),
      attendance: filteredAttendance,
      payroll: filteredPayroll,
      linkingRequests: filteredLinkingRequests,
      formatCurrency,
      /**
       * Record a sale.
       *
       * The database is the source of truth, so the API call happens FIRST and
       * is awaited. This used to be fire-and-forget with a `console.error`
       * catch, which meant a rejected sale (insufficient stock, deactivated
       * product, no store) still showed the success screen, still printed a
       * receipt, and still decremented local stock — while nothing was written
       * to the database. The discount was also never sent, so the amount
       * recorded was the gross, not the discounted total.
       *
       * On success the local state is updated for responsiveness and the caller
       * re-syncs from the server. On failure this throws and deliberately does
       * NOT dispatch, so the local inventory is not decremented for a sale that
       * does not exist.
       */
      completeSale: async (payload: CompleteSalePayload) => {
        const storeId = state.currentStore?.id;

        if (!getToken()) {
          throw new Error("You must be signed in to record a sale.");
        }
        if (!storeId || storeId === "S-ALL") {
          // The Admin "all stores" overview has no single store to bill to.
          throw new Error(
            "Select a single store before recording a sale.",
          );
        }
        if (!payload.items.length) {
          throw new Error("Cannot record an empty sale.");
        }

        // Throws on a non-2xx response; `request` surfaces the server message.
        const { transaction } = await db.transactions.create({
          storeId,
          paymentMethod: payload.payment,
          items: payload.items.map((i) => ({
            productId: i.productId,
            quantity: i.qty,
          })),
          discount: payload.discount,
        });

        dispatch({ type: "COMPLETE_SALE", payload });

        // The sale is committed, so pull the authoritative feed. The backend
        // records the sale itself and any low-stock condition, and refreshes
        // the store's AI insight in the background.
        //
        // Awaited, but a failure here must not turn a completed sale into an
        // error the cashier sees at the till — the receipt is already valid.
        try {
          await Promise.all([
            refreshNotifications(),
            refreshTransactions(storeId),
            // Revenue, sale count and unit count for the day all just moved, so
            // the headline figures have to come back from the backend too.
            refreshAnalytics(storeId),
            // The insight summary quotes revenue and sale counts, both of which
            // this sale just changed.
            refreshStoreInsight(storeId),
          ]);
        } catch (error) {
          console.error("Post-sale refresh failed:", error);
        }

        return transaction;
      },
      refundTransaction: (transactionId: string) =>
        dispatch({ type: "REFUND_TRANSACTION", transactionId }),
      adjustStock: (productId: string, delta: number) => {
        const storeId = state.currentStore?.id;
        const prod = state.inventory[productId];
        const newQty = Math.max(0, (prod?.stock || 0) + delta);
        if (getToken() && storeId && prod) {
          db.products
            .stock(storeId, productId, {
              quantity: newQty,
              lowThreshold: prod.reorderPoint,
            })
            .catch((error) =>
              console.error("Stock change failed to persist:", error),
            );
        }
        dispatch({ type: "ADJUST_STOCK", productId, delta });
      },
      refreshProducts,
      refreshTransactions,
      refreshAnalytics,
      refreshStoreInsight,
      refreshNotifications,
      loadNotificationsPage,
      fetchCashierKpis,
      addProduct: (p: Omit<InventoryItem, "id">) => {
      const storeId = state.currentStore?.id;
      if (!getToken() || !storeId) {
        // Offline / no session: keep the row locally only.
        dispatch({ type: "ADD_PRODUCT", product: { ...p, id: crypto.randomUUID() } });
        return;
      }

      // The database is the source of truth, exactly as it is for categories:
      // POST to createProduct, then re-query getAllProducts instead of
      // hand-patching local state (which previously invented a product even
      // when the API rejected it, hiding the real error).
      db.products
        .create(storeId, {
          name: p.name,
          sku: p.sku,
          category: p.category,
          price: p.price,
          barcode: p.barcode,
          quantity: p.stock,
          lowThreshold: p.reorderPoint,
          imageUrl: p.imageUrl,
        })
        .then(() => refreshProducts(storeId))
        .catch((error) => {
          console.error("Product failed to persist:", error);
          toast.error("Could not save product", {
            description:
              error?.message || "The server rejected this product.",
          });
        });
    },
      updateProduct: (product: InventoryItem) => {
        const storeId = state.currentStore?.id;
        if (!getToken() || !storeId) {
          dispatch({ type: "UPDATE_PRODUCT", product });
          return;
        }
        const fields: {
          name: string;
          sku: string;
          category: string;
          price: number;
          barcode: string;
        } = {
          name: product.name,
          sku: product.sku || "",
          category: product.category,
          price: product.price,
          barcode: product.barcode || "",
        };
        db.products
          .update(storeId, product.id, fields)
          .then(() =>
            // Stock lives on its own endpoint, then re-read the catalog so the
            // row reflects what the server actually stored.
            db.products.stock(storeId, product.id, {
              quantity: product.stock,
              lowThreshold: product.reorderPoint,
            }),
          )
          .then(() => refreshProducts(storeId))
          .catch((error) => {
            console.error("Product failed to persist:", error);
            toast.error("Could not update product", {
              description:
                error?.message || "The server rejected these changes.",
            });
            // Re-read so the UI falls back to the stored values, not the
            // rejected ones.
            refreshProducts(storeId);
          });
      },
      setProductStock: (productId: string, stock: number) => {
        const storeId = state.currentStore?.id;
        if (getToken() && storeId) {
          db.products
            .stock(storeId, productId, { quantity: stock })
            .then(() => refreshProducts(storeId))
            .catch((error) => {
              console.error("Stock change failed to persist:", error);
              toast.error("Could not change stock", {
                description:
                  error?.message || "The server rejected this quantity.",
              });
              refreshProducts(storeId);
            });
          return;
        }
        dispatch({ type: "SET_STOCK", productId, stock });
      },
      setProductPrice: (productId: string, price: number) => {
        const storeId = state.currentStore?.id;
        if (getToken() && storeId) {
          // Send only the field being edited — PATCH is partial on both sides —
          // then re-read the catalog. Dispatching optimistically here used to
          // leave the screen showing a price the server had rejected.
          db.products
            .update(storeId, productId, { price })
            .then(() => refreshProducts(storeId))
            .catch((error) => {
              console.error("Price change failed to persist:", error);
              toast.error("Could not change price", {
                description:
                  error?.message || "The server rejected this price.",
              });
              // Fall back to whatever is actually stored.
              refreshProducts(storeId);
            });
          return;
        }
        dispatch({ type: "SET_PRICE", productId, price });
      },
      deleteProduct: (productId: string) => {
        if (state.currentUser?.role === "Admin" && state.adminOverview) {
          const storeId = state.currentStore?.id;
          if (!getToken() || !storeId || !state.inventory[productId]) return;
          db.products
            .deactivate(storeId, productId)
            .then(() => refreshProducts(storeId))
            .catch((error) => {
              console.error("Product delete failed to persist:", error);
              toast.error("Could not delete product", {
                description:
                  error?.message || "The server rejected the delete.",
              });
            });
        } else {
          const product = state.inventory[productId];
          const request: PendingApproval = {
            id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actionType: "delete_product",
            payload: { productId },
            requesterId: state.currentUser?.id || "",
            requesterName: state.currentUser?.name || "Unknown",
            requesterRole: state.currentUser?.role || "Cashier",
            storeId: state.currentStore?.id || "",
            storeName: state.currentStore?.name || "",
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          dispatch({ type: "SUBMIT_APPROVAL_REQUEST", request });
        }
      },
      addCategory: (name: string) => {
      const storeId = state.currentStore?.id || "";
      // Persist to the backend so every account in the store shares the
      // taxonomy. Optimistic local update keeps the UI instant.
      if (getToken() && storeId) {
        db.categories.create(storeId, name).catch((error) =>
          console.error("Category failed to persist:", error),
        );
      }
      dispatch({ type: "ADD_CATEGORY", name, storeId });
    },
    removeCategory: (name: string) => {
      const storeId =
        state.currentStore?.id ||
        Object.entries(state.categoriesByStore).find(([, list]) =>
          list.includes(name),
        )?.[0] ||
        "";
      if (state.currentUser?.role === "Admin" && state.adminOverview) {
        if (getToken() && storeId) {
          db.categories
            .remove(storeId, name)
            .catch((error) =>
              console.error("Category delete failed to persist:", error),
            );
        }
        dispatch({ type: "DELETE_CATEGORY", name, storeId });
      } else {
        const request: PendingApproval = {
          id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          actionType: "delete_category",
          payload: { categoryName: name },
          requesterId: state.currentUser?.id || "",
          requesterName: state.currentUser?.name || "Unknown",
          requesterRole: state.currentUser?.role || "Cashier",
          storeId: storeId || state.currentStore?.id || "",
          storeName: state.currentStore?.name || "",
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "SUBMIT_APPROVAL_REQUEST", request });
      }
    },
      setDailySales: (payload: Record<string, number>) =>
        dispatch({ type: "SET_DAILY_SALES", payload }),
      markNotificationRead: (id: string): Promise<void> => {
        const request = getToken()
          ? db.notifications
              .markRead(id)
              .then(() => undefined)
              .catch((error) =>
                console.error("Notification failed to persist:", error),
              )
          : Promise.resolve();
        dispatch({ type: "MARK_NOTIFICATION_READ", id });
        return request;
      },
      resolveNotification: (id: string): Promise<void> => {
        const request = getToken()
          ? db.notifications
              .resolve(id)
              .then(() => undefined)
              .catch((error) =>
                console.error("Notification resolve failed to persist:", error),
              )
          : Promise.resolve();
        dispatch({ type: "RESOLVE_NOTIFICATION", id });
        return request;
      },
      markAllNotificationsRead,
      clearAllNotifications: () =>
        dispatch({ type: "CLEAR_ALL_NOTIFICATIONS" }),
      addUser: (user: User) => {
        // Managers and Cashiers are persisted as REAL backend accounts so they
        // can log in on the landing page. The returned record is reloaded into
        // state so UI ids match the DB. A backend failure is surfaced instead
        // of silently creating a manager that only exists in localStorage.
        const isStaff =
          user.role === "Manager" || user.role === "Cashier";
        const targetStoreId = user.assignedStoreIds?.[0] || state.currentStore?.id;
        if (getToken() && isStaff && targetStoreId) {
          const password = user.password || (user.role === "Cashier" ? "Cashier@123" : "Manager@123");
          const api = user.role === "Manager" ? db.managers : db.cashiers;
          api
            .create(targetStoreId, {
              name: user.name,
              email: user.email,
              password,
            })
            .then(async () => {
              const list =
                user.role === "Manager"
                  ? (await db.managers.fetch(targetStoreId)).managers
                  : (await db.cashiers.fetch(targetStoreId)).cashiers;
              const created = list.find((c) => c.email === user.email);
              if (created) {
                dispatch({
                  type: "ADD_USER",
                  user: {
                    ...mapUser(created, targetStoreId),
                    password: user.password,
                  },
                });
              }
            })
            .catch((error) => {
              console.error("Staff failed to persist:", error);
              toast.error(
                `Could not create ${user.role}\u2019s account: ${
                  (error as Error).message || "backend error"
                }`,
              );
            });
        } else {
          dispatch({ type: "ADD_USER", user });
        }
      },
      deleteUser: (userId: string) => {
        const target = state.users.find((u) => u.id === userId);
        const storeId = state.currentStore?.id;
        const onError = (error: unknown) => {
          console.error("Staff deactivate failed to persist:", error);
          toast.error(
            `Could not remove ${target?.role ?? "user"}: ${
              (error as Error).message || "backend error"
            }`,
          );
        };
        if (getToken() && target && storeId) {
          if (target.role === "Cashier") {
            db.cashiers
              .deactivate(storeId, userId)
              .catch(onError);
          } else if (target.role === "Manager") {
            db.managers
              .deactivate(storeId, userId)
              .catch(onError);
          }
        }
        dispatch({ type: "DELETE_USER", userId });
      },
      updateUser: (user: User) => dispatch({ type: "UPDATE_USER", user }),
      addStore: (store: Store) => {
        if (getToken()) {
          return db.stores
            .create({
              name: store.name,
              location: store.address,
              phone: store.phone,
              email: store.email,
            })
            .then(({ store: created }) => {
              const mapped = mapStore(created);
              dispatch({ type: "ADD_STORE", store: mapped });
              return mapped;
            })
            .catch((error) => {
              console.error("Store failed to persist:", error);
              toast.error(
                `Could not create the store: ${
                  (error as Error).message || "backend error"
                }`,
              );
              return undefined;
            });
        }
        // Offline/legacy path — keep the local record so the app still works.
        dispatch({ type: "ADD_STORE", store });
        return Promise.resolve(store);
      },
      deleteStore: (storeId: string) => {
        if (getToken()) {
          db.stores
            .deactivate(storeId)
            .catch((error) =>
              console.error("Store delete failed to persist:", error),
            );
        }
        dispatch({ type: "DELETE_STORE", storeId });
      },
      switchStore: (storeId: string) =>
        dispatch({ type: "SWITCH_STORE", storeId }),
      loginUser: (user: User) => dispatch({ type: "LOGIN_USER", user }),
      sessionOwner: state.sessionOwner,
      switchBackToOwner: async () => {
        if (!state.sessionOwner) return;
        // Re-hydrate from the backend with the session owner's token. This is
        // the source of truth: it restores the owner's full view (all stores,
        // managers and cashiers for an Admin; the owned store and its staff
        // for a Manager) and clears whatever persona was being impersonated.
        try {
          await hydrateFromDb();
        } catch (error) {
          console.error("Switch back failed to re-hydrate:", error);
          toast.error("Could not restore your session. Please sign in again.");
        }
      },
      logoutUser: () => {
        if (getToken()) clearToken();
        dispatch({ type: "LOGOUT_USER" });
        setSession("auth");
      },
      status: session,
      login: async (email, password) => {
        const res = await db.auth.login(email, password);
        setToken(res.token);
        await hydrateFromDb();
        setSession("ready");
        return res.data;
      },
      setTheme: (theme: "light" | "dark") =>
        dispatch({ type: "SET_THEME", theme }),
      setCurrency: (currency: Currency) =>
        dispatch({ type: "SET_CURRENCY", currency }),
      updateStoreProfile: (store: Store) => {
        if (getToken()) {
          db.stores
            .update(store.id, {
              name: store.name,
              location: store.address,
              phone: store.phone,
              email: store.email,
            })
            .catch((error) =>
              console.error("Store update failed to persist:", error),
            );
        }
        dispatch({ type: "UPDATE_STORE_PROFILE", store });
      },
      resetUnreadNotifications: () =>
        // Persist, don't just repaint. The bell is the "mark all read" control,
        // and it used to clear the badge in local state only — so the unread
        // count came straight back on reload and on the manager's other device.
        markAllNotificationsRead(),
      updatePermissions: (permissions: PermissionMatrix) =>
        dispatch({ type: "UPDATE_PERMISSIONS", permissions }),
      updatePreferences: (preferences: Preferences) =>
        dispatch({ type: "UPDATE_PREFERENCES", preferences }),
      addBankAccount: (account: BankAccount) => {
        if (state.currentUser?.role === "Admin" && state.adminOverview) {
          dispatch({ type: "ADD_BANK_ACCOUNT", account });
        } else {
          const request: PendingApproval = {
            id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actionType: "add_bank_account",
            payload: { account },
            requesterId: state.currentUser?.id || "",
            requesterName: state.currentUser?.name || "Unknown",
            requesterRole: state.currentUser?.role || "Cashier",
            storeId: state.currentStore?.id || "",
            storeName: state.currentStore?.name || "",
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          dispatch({ type: "SUBMIT_APPROVAL_REQUEST", request });
        }
      },
      deleteBankAccount: (accountId: string) => {
        if (state.currentUser?.role === "Admin" && state.adminOverview) {
          dispatch({ type: "DELETE_BANK_ACCOUNT", accountId });
        } else {
          const account = state.bankAccounts.find((a) => a.id === accountId);
          const request: PendingApproval = {
            id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actionType: "delete_bank_account",
            payload: { accountId, bankName: account?.bankName || "Unknown" },
            requesterId: state.currentUser?.id || "",
            requesterName: state.currentUser?.name || "Unknown",
            requesterRole: state.currentUser?.role || "Cashier",
            storeId: state.currentStore?.id || "",
            storeName: state.currentStore?.name || "",
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          dispatch({ type: "SUBMIT_APPROVAL_REQUEST", request });
        }
      },
      addPOSTerminal: async (terminal: POSTerminal) => {
        const role = state.currentUser?.role;
        const storeId = state.currentStore?.id;
        const canManageTerminals = role === "Admin" || role === "Manager";

        if (
          canManageTerminals &&
          storeId &&
          storeId !== "S-ALL" &&
          getToken()
        ) {
          const { terminal: saved } = await db.terminals.add(storeId, {
            terminalSerial:
              terminal.serialNumber || terminal.terminalId || terminal.name,
            label: terminal.name,
            provider: terminal.provider,
            phoneNumber: terminal.phoneNumber,
            deviceLocation: terminal.deviceLocation,
            merchantId: terminal.merchantId,
          });
          dispatch({
            type: "ADD_POS_TERMINAL",
            terminal: saved ? mapTerminal(saved) : terminal,
          });
        } else {
          const request: PendingApproval = {
            id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actionType: "add_pos_terminal",
            payload: { terminal },
            requesterId: state.currentUser?.id || "",
            requesterName: state.currentUser?.name || "Unknown",
            requesterRole: state.currentUser?.role || "Cashier",
            storeId: state.currentStore?.id || "",
            storeName: state.currentStore?.name || "",
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          dispatch({ type: "SUBMIT_APPROVAL_REQUEST", request });
        }
      },
      deletePOSTerminal: (terminalId: string) => {
        const role = state.currentUser?.role;
        const terminal = state.posTerminals.find((t) => t.id === terminalId);
        const storeId = terminal?.storeId || state.currentStore?.id;
        const canManageTerminals = role === "Admin" || role === "Manager";

        if (
          canManageTerminals &&
          storeId &&
          storeId !== "S-ALL" &&
          getToken()
        ) {
          db.terminals
            .deactivate(storeId, terminalId)
            .catch((error) =>
              console.error("Terminal delete failed to persist:", error),
            );
          dispatch({ type: "DELETE_POS_TERMINAL", terminalId });
        } else {
          const terminal = state.posTerminals.find((t) => t.id === terminalId);
          const request: PendingApproval = {
            id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actionType: "delete_pos_terminal",
            payload: { terminalId, terminalName: terminal?.name || "Unknown" },
            requesterId: state.currentUser?.id || "",
            requesterName: state.currentUser?.name || "Unknown",
            requesterRole: state.currentUser?.role || "Cashier",
            storeId: state.currentStore?.id || "",
            storeName: state.currentStore?.name || "",
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          dispatch({ type: "SUBMIT_APPROVAL_REQUEST", request });
        }
      },
      updatePaymentSettings: (settings: Partial<PaymentSettings>) => {
        if (state.currentUser?.role === "Admin" && state.adminOverview) {
          dispatch({ type: "UPDATE_PAYMENT_SETTINGS", settings });
        } else {
          const request: PendingApproval = {
            id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actionType: "update_payment_settings",
            payload: { settings },
            requesterId: state.currentUser?.id || "",
            requesterName: state.currentUser?.name || "Unknown",
            requesterRole: state.currentUser?.role || "Cashier",
            storeId: state.currentStore?.id || "",
            storeName: state.currentStore?.name || "",
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          dispatch({ type: "SUBMIT_APPROVAL_REQUEST", request });
        }
      },
      setReceiptDefaults: (defaults: ReceiptDefaults) =>
        dispatch({ type: "SET_RECEIPT_DEFAULTS", defaults }),
      clockIn: (userId: string, storeId: string) =>
        dispatch({ type: "CLOCK_IN", userId, storeId }),
      clockOut: (userId: string, storeId: string) =>
        dispatch({ type: "CLOCK_OUT", userId, storeId }),
      markAbsent: (userId: string, storeId: string, date: string) =>
        dispatch({ type: "MARK_ABSENT", userId, storeId, date }),
      updateAttendance: (attendance: Attendance) =>
        dispatch({ type: "UPDATE_ATTENDANCE", attendance }),
      addPayrollRecord: (record: PayrollRecord) =>
        dispatch({ type: "ADD_PAYROLL_RECORD", record }),
      updatePayrollStatus: (
        id: string,
        status: "Paid" | "Pending",
        paymentDate?: string,
      ) => dispatch({ type: "UPDATE_PAYROLL_STATUS", id, status, paymentDate }),
      addNotification: (notification: AppNotification) =>
        dispatch({ type: "ADD_NOTIFICATION", notification }),
      updateStoreSettings: (
        storeId: string,
        settings: Partial<ShiftSettings>,
      ) => dispatch({ type: "UPDATE_STORE_SETTINGS", storeId, settings }),
      updateStaffDetails: (userId: string, details: Partial<User>) =>
        dispatch({ type: "UPDATE_STAFF_DETAILS", userId, details }),
      updateUserPassword: (userId: string, newPassword: string) =>
        dispatch({ type: "UPDATE_USER_PASSWORD", userId, newPassword }),
      submitLinkRequest: (request: LinkingRequest) =>
        dispatch({ type: "SUBMIT_LINK_REQUEST", request }),
      approveLinkRequest: (requestId: string) =>
        dispatch({ type: "APPROVE_LINK_REQUEST", requestId }),
      rejectLinkRequest: (requestId: string, reason: string) =>
        dispatch({ type: "REJECT_LINK_REQUEST", requestId, reason }),
      requestAddCashier: (draft: Partial<User>) => {
        const targetStore =
          state.allStores.find(
            (s) => s.id === draft.assignedStoreIds?.[0],
          ) || state.currentStore;
        const request: PendingApproval = {
          id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          actionType: "add_cashier",
          payload: { user: draft },
          requesterId: state.currentUser?.id || "",
          requesterName: state.currentUser?.name || "Unknown",
          requesterRole: state.currentUser?.role || "Manager",
          storeId: targetStore?.id || "",
          storeName: targetStore?.name || "",
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "SUBMIT_APPROVAL_REQUEST", request });
      },
      requestDeleteStore: (storeId: string) => {
        // The Admin's own first/oversight store can never be deleted — not
        // even via an approval request.
        const targetStore = state.allStores.find((s) => s.id === storeId);
        if (!targetStore || targetStore.isAdminStore) return;
        const request: PendingApproval = {
          id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          actionType: "delete_store",
          payload: { storeId },
          requesterId: state.currentUser?.id || "",
          requesterName: state.currentUser?.name || "Unknown",
          requesterRole: state.currentUser?.role || "Manager",
          storeId: targetStore.id,
          storeName: targetStore.name,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "SUBMIT_APPROVAL_REQUEST", request });
      },
      canView: (module: string) => {
        // Admin overview has no POS / Products / Transactions tabs
        if (
          isAdminOverview &&
          ["Products", "POS", "Transactions"].includes(module)
        ) {
          return false;
        }
        return canViewModule(state.permissions, role, module);
      },
      canEdit: (module: string) => {
        // In overview the Admin only oversees: operational modules become
        // read-only (Inventory is kept visible but cannot be edited).
        if (
          isAdminOverview &&
          ["Inventory", "Products", "POS", "Transactions", "Staff"].includes(
            module,
          )
        ) {
          return false;
        }
        return canEditModule(state.permissions, role, module);
      },
      pendingApprovals: state.pendingApprovals,
      approveApprovalRequest: (requestId: string) => {
        // Approving a delete must also reach the backend — otherwise the
        // "approved" row only vanishes from this browser and reappears on the
        // next hydration.
        const req = state.pendingApprovals.find(
          (r) => r.id === requestId && r.status === "pending",
        );
        if (req && getToken()) {
          if (req.actionType === "delete_category") {
            const catStoreId =
              req.storeId ||
              (req.payload as { storeId?: string }).storeId ||
              "";
            const categoryName = (req.payload as { categoryName?: string })
              .categoryName;
            if (catStoreId && categoryName) {
              db.categories
                .remove(catStoreId, categoryName)
                .catch((error) =>
                  console.error("Category delete failed:", error),
                );
            }
          } else if (req.actionType === "delete_product") {
            const productId = (req.payload as { productId?: string }).productId;
            if (req.storeId && productId) {
              db.products
                .deactivate(req.storeId, productId)
                .catch((error) =>
                  console.error("Product delete failed:", error),
                );
            }
          }
        }
        dispatch({ type: "APPROVE_APPROVAL_REQUEST", requestId });
      },
      rejectApprovalRequest: (requestId: string, reason?: string) =>
        dispatch({ type: "REJECT_APPROVAL_REQUEST", requestId, reason }),
    };
  }, [state, hydrateFromDb]);

  // Wait for the external-login handoff (if any) before first paint so the
  // app does not flash the onboarding screen.
  if (!hydrated) return null;

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return ctx;
}

/**
 * Keeps a page's product catalog and sales figures in sync with the database.
 *
 * Every page that lists products (Inventory, Products, POS, Dashboard) calls
 * this so Manager and Cashier read the same rows. It refreshes on mount, when
 * the active store changes, when the tab regains focus, and on a slow interval
 * while the tab is visible — which is what makes a Cashier's already-open tab
 * pick up a product a Manager just created in another browser.
 *
 * Sales are refreshed through the same triggers. Transactions used to be read
 * exactly once, during sign-in hydration, which pinned every revenue total,
 * chart and transaction list to the figures at that moment: a sale rung up on
 * another till, or by another cashier, only appeared after a manual reload.
 */
export function useProductSync(pollMs = 45000) {
  const {
    refreshProducts,
    refreshTransactions,
    refreshAnalytics,
    refreshStoreInsight,
    currentStore,
    currentUser,
  } = useStore();
  const storeId = currentStore?.id;

  React.useEffect(() => {
    if (!storeId || storeId === "S-ALL") return;
    if (!currentUser) return;

    // Sales first: the product read is already covered for the pages that show
    // the catalog, and these two are independent, so neither waits on the other.
    refreshTransactions(storeId);
    refreshProducts(storeId);
    refreshAnalytics(storeId);
    refreshStoreInsight(storeId);

    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      refreshTransactions(storeId);
      refreshProducts(storeId);
      refreshAnalytics(storeId);
      refreshStoreInsight(storeId);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    const timer =
      pollMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState !== "visible") return;
            refreshTransactions(storeId);
            refreshProducts(storeId);
            refreshAnalytics(storeId);
            refreshStoreInsight(storeId);
          }, pollMs)
        : undefined;

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (timer) window.clearInterval(timer);
    };
    // `refreshProducts`/`refreshTransactions` are recreated on every state
    // change; depending on them would re-run this effect (and the poll) on
    // unrelated updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, currentUser?.id, pollMs]);
}
