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

export type Product = {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  costPrice?: number;
  supplier?: string;
  manufacturedDate?: string;
  expiryDate?: string;
};

export type InventoryItem = Product & {
  stock: number;
  reorderPoint: number;
  createdAt: string;
  storeId: string;
};

export type CartItem = {
  productId: number;
  qty: number;
  price: number;
};

export type Role = "Admin" | "Manager" | "Cashier";

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
  totalRevenueToday: number;
  totalRevenueTodayChange: number;
  totalSalesToday: number;
  totalSalesTodayChange: number;
  productsSoldToday: number;
  productsSoldTodayChange: number;
  lowStockCount: number;
  lowStockCountChange: number;
  todayRefunds: number;
};

export type SalesTrendPoint = {
  day: string;
  sales: number;
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
  inventory: Record<number, InventoryItem>;
  transactions: Transaction[];
  notifications: AppNotification[];
  customers: Customer[];
  terminals: { id: string; name: string; type: "pos" | "linkedAccount" }[];
  categories: string[];
  dailySales: Record<number, number>;
  users: User[];
  currentStore: Store | null;
  allStores: Store[];
  permissions: PermissionMatrix;
  preferences: Preferences;
  theme: "light" | "dark";
  currency: Currency;
  currentUser: User | null;
  // Snapshot of the Admin account. Kept so an Admin who enters a store as a
  // Manager/Cashier can switch back to their Admin session (all-stores view).
  adminUser: User | null;
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
      product: Omit<InventoryItem, "id">;
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
    }
  | {
      type: "DELETE_CATEGORY";
      name: string;
    }
  | { type: "SET_DAILY_SALES"; payload: Record<number, number> }
  | { type: "MARK_NOTIFICATION_READ"; id: string }
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
  | { type: "UPDATE_STORE_PROFILE"; store: Store }
  | { type: "RESET_UNREAD_NOTIFICATIONS" }
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
  | { type: "REJECT_APPROVAL_REQUEST"; requestId: string; reason?: string };

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
    Manager: { view: false, edit: false },
    Cashier: { view: true, edit: true },
  },
  Insights: {
    Admin: { view: true, edit: true },
    Manager: { view: true, edit: false },
    Cashier: { view: false, edit: false },
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
    Cashier: { view: true, edit: false },
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
const STORAGE_VERSION = "empty-2026.09.10-v2";
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
  customers: [],
  terminals: [
    { id: "T-01", name: "Register 1", type: "pos" },
    { id: "T-02", name: "Register 2", type: "pos" },
    { id: "T-03", name: "Mobile App", type: "linkedAccount" },
  ],
  categories: JSON.parse(
    localStorage.getItem("sellsync_categories") || "null",
  ) || [],
  dailySales: {},
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
  theme: "light",
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
  adminUser: (() => {
    const saved = JSON.parse(
      localStorage.getItem("sellsync_admin_user") || "null",
    );
    if (saved) return saved;
    const u = JSON.parse(localStorage.getItem("sellsync_user") || "null");
    return u && u.role === "Admin" ? u : null;
  })(),
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
      // BACKEND_INTEGRATION: Add API call to save transaction:
      // try {
      //   const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/link/transactions`, {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify(action.payload),
      //   });
      //   if (!response.ok) throw new Error("Failed to save transaction");
      // } catch (error) {
      //   console.error("API Error saving transaction:", error);
      // }

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
      const newNotifications: AppNotification[] = [...state.notifications];

      for (const item of items) {
        const inv = newInventory[item.productId];
        if (inv) {
          const newStock = Math.max(0, inv.stock - item.qty);
          newInventory[item.productId] = {
            ...inv,
            stock: newStock,
          };

          // Trigger Low Stock Notification
          if (newStock <= inv.reorderPoint) {
            newNotifications.unshift({
              id: `NTF-${Date.now()}-${item.productId}`,
              type: "alert",
              title: "Low Stock Alert",
              message: `${inv.name} stock is critically low (${newStock} units remaining)`,
              timestamp: new Date().toISOString(),
              read: false,
              productId: item.productId,
              link: "/forecasts",
            });
          }
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

      // Sales Milestone Trigger (Example: every 10th sale today)
      const today = now.toISOString().slice(0, 10);
      const todaySalesCount =
        state.transactions.filter((t) => t.datetime.startsWith(today)).length +
        1;

      // Update daily sales tracking
      const newDailySales = { ...state.dailySales };
      for (const item of items) {
        newDailySales[item.productId] =
          (newDailySales[item.productId] || 0) + item.qty;
      }

      if (todaySalesCount % 10 === 0) {
        newNotifications.unshift({
          id: `NTF-MS-${Date.now()}`,
          type: "info",
          title: "Sales Milestone",
          message: `Congratulations! You've reached ${todaySalesCount} sales today`,
          timestamp: now.toISOString(),
          read: false,
          link: "/reports",
        });
      }

      return {
        ...state,
        inventory: newInventory,
        transactions: [tx, ...state.transactions],
        notifications: newNotifications,
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
      const nextId =
        Math.max(0, ...Object.keys(state.inventory).map((k) => Number(k))) + 1;
      const storeId = action.product.storeId || state.currentStore?.id || "";

      // Ensure product is assigned to a valid store (no global overview store)
      if (!state.allStores.find((s) => s.id === storeId)) {
        return state;
      }

      const item: InventoryItem = { ...action.product, id: nextId, storeId };
      return {
        ...state,
        inventory: { ...state.inventory, [nextId]: item },
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
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n,
        ),
      };
    }
    case "MARK_ALL_NOTIFICATIONS_READ": {
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };
    }
    case "CLEAR_ALL_NOTIFICATIONS": {
      return {
        ...state,
        notifications: [],
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
    case "ADD_CATEGORY": {
      const name = action.name.trim();
      if (!name || state.categories.includes(name)) return state;
      return { ...state, categories: [...state.categories, name] };
    }
    case "DELETE_CATEGORY": {
      return { ...state, categories: state.categories.filter(c => c !== action.name) };
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
          // The Admin's own first/oversight store can never take a Manager.
          if (targetStore.managerId || targetStore.isAdminStore) return state;
        }
        if (action.user.role === "Cashier") {
          // A Cashier can only sell at a store run by a Manager — never at
          // the Admin's own first/oversight store.
          if (!targetStore.managerId || targetStore.isAdminStore) return state;
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
          (!targetStore.managerId || targetStore.isAdminStore)
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
      localStorage.setItem("sellsync_user", JSON.stringify(action.user));

      // Keep a snapshot of the Admin session so an Admin who enters a store
      // as a Manager/Cashier can switch back to their Admin account later.
      let adminUser = state.adminUser;
      if (action.user.role !== "Admin") {
        if (!adminUser && state.currentUser?.role === "Admin") {
          adminUser = state.currentUser;
        }
      } else {
        adminUser = action.user;
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
        adminUser,
      };
    }
    case "SET_ADMIN_OVERVIEW": {
      return { ...state, adminOverview: action.value };
    }
    case "LOGOUT_USER": {
      localStorage.removeItem("sellsync_user");
      localStorage.removeItem("sellsync_admin_user");
      return { ...state, currentUser: null, adminUser: null };
    }
    case "SET_CURRENCY": {
      localStorage.setItem(
        "sellsync_currency",
        JSON.stringify(action.currency),
      );
      return { ...state, currency: action.currency };
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
          newState = { ...newState, categories: newState.categories.filter((c) => c !== req.payload.categoryName) };
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
      setAdminOverview: (value: boolean) => void;
      allTransactions: Transaction[];
      allInventory: InventoryItem[];
      completeSale: (payload: CompleteSalePayload) => void;
      refundTransaction: (transactionId: string) => void;
      kpis: KPIs;
      salesTrend: SalesTrendPoint[];
      topProducts: TopProduct[];
      dynamicInsights: DynamicInsight[];
      inventoryArray: InventoryItem[];
      addProduct: (p: Omit<InventoryItem, "id">) => void;
      setProductStock: (productId: number, stock: number) => void;
      setProductPrice: (productId: number, price: number) => void;
      deleteProduct: (productId: number) => void;
      addCategory: (name: string) => void;
      removeCategory: (name: string) => void;
      setDailySales: (payload: Record<number, number>) => void;
      markNotificationRead: (id: string) => void;
      markAllNotificationsRead: () => void;
      clearAllNotifications: () => void;
      addUser: (u: User) => void;
      deleteUser: (userId: string) => void;
      updateUser: (u: User) => void;
      addStore: (s: Store) => void;
      deleteStore: (storeId: string) => void;
      switchStore: (storeId: string) => void;
      loginUser: (u: User) => void;
      switchBackToAdmin: () => void;
      logoutUser: () => void;
      setCurrency: (c: Currency) => void;
      updateStoreProfile: (s: Store) => void;
      resetUnreadNotifications: () => void;
      updatePermissions: (p: PermissionMatrix) => void;
      updatePreferences: (p: Preferences) => void;
      addBankAccount: (account: BankAccount) => void;
      deleteBankAccount: (accountId: string) => void;
      addPOSTerminal: (terminal: POSTerminal) => void;
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
    .reduce<Record<number, number>>((acc, transaction) => {
      transaction.items.forEach((item) => {
        acc[item.productId] = (acc[item.productId] || 0) + item.qty;
      });
      return acc;
    }, {});
}

function computeKPIs(state: StoreState): KPIs {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const todaysTx = state.transactions.filter((t: Transaction) =>
    t.datetime.startsWith(today),
  );
  const yesterdaysTx = state.transactions.filter((t: Transaction) =>
    t.datetime.startsWith(yesterday),
  );

  const totalRevenueToday = todaysTx
    .filter((t: Transaction) => t.status === "Completed")
    .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

  const totalRevenueYesterday = yesterdaysTx
    .filter((t: Transaction) => t.status === "Completed")
    .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

  const totalSalesToday = todaysTx.filter(
    (t: Transaction) => t.status === "Completed",
  ).length;
  const totalSalesYesterday = yesterdaysTx.filter(
    (t: Transaction) => t.status === "Completed",
  ).length;

  const productsSoldToday = todaysTx
    .filter((t: Transaction) => t.status === "Completed")
    .reduce(
      (sum: number, t: Transaction) =>
        sum + t.items.reduce((s: number, i: CartItem) => s + i.qty, 0),
      0,
    );

  const productsSoldYesterday = yesterdaysTx
    .filter((t: Transaction) => t.status === "Completed")
    .reduce(
      (sum: number, t: Transaction) =>
        sum + t.items.reduce((s: number, i: CartItem) => s + i.qty, 0),
      0,
    );

  const lowStockCount = Object.values(state.inventory).filter(
    (i: InventoryItem) => i.stock < i.reorderPoint,
  ).length;
  const criticalStockCount = Object.values(state.inventory).filter(
    (i: InventoryItem) => i.stock < i.reorderPoint / 2,
  ).length;

  const todayRefunds = todaysTx.filter(
    (t: Transaction) => t.status === "Refunded",
  ).length;

  const getChange = (now: number, then: number) => {
    if (then === 0) return now > 0 ? 100 : 0;
    return Number((((now - then) / then) * 100).toFixed(1));
  };

  return {
    totalRevenueToday,
    totalRevenueTodayChange: getChange(
      totalRevenueToday,
      totalRevenueYesterday,
    ),
    totalSalesToday,
    totalSalesTodayChange: getChange(totalSalesToday, totalSalesYesterday),
    productsSoldToday,
    productsSoldTodayChange: getChange(
      productsSoldToday,
      productsSoldYesterday,
    ),
    lowStockCount,
    lowStockCountChange: criticalStockCount, // We'll use this for the "X critical" label
    todayRefunds,
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
  const productStats: Record<number, { unitsSold: number; revenue: number }> =
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
      const product = state.inventory[Number(id)];
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
  if (kpis.totalRevenueTodayChange > 0) {
    insights.push({
      id: 2,
      type: "success",
      message: `Revenue is up ${kpis.totalRevenueTodayChange}% compared to yesterday.`,
    });
  } else if (kpis.totalRevenueTodayChange < 0) {
    insights.push({
      id: 2,
      type: "warning",
      message: `Revenue is down ${Math.abs(kpis.totalRevenueTodayChange)}% compared to yesterday.`,
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

  // Daily Expiry Check
  React.useEffect(() => {
    if (!state.paymentSettings.enableExpiryNotifications) return;

    const checkExpiries = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const inventoryArray = Object.values(state.inventory);

      inventoryArray.forEach((product) => {
        if (!product.expiryDate) return;

        const expiry = new Date(product.expiryDate);
        expiry.setHours(0, 0, 0, 0);

        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if ([30, 7, 1].includes(diffDays) || diffDays === 0 || diffDays < 0) {
          const alertType =
            diffDays < 0
              ? "expired"
              : diffDays === 0
                ? "expires today"
                : `expires in ${diffDays} days`;
          const notificationId = `EXP-${product.id}-${diffDays}-${today.toDateString()}`;

          // Check if we already sent this specific notification today
          const alreadyExists = state.notifications.some(
            (n) => n.id === notificationId,
          );

          if (!alreadyExists) {
            dispatch({
              type: "ADD_NOTIFICATION",
              notification: {
                id: notificationId,
                type: diffDays <= 7 ? "alert" : "warning",
                title: diffDays < 0 ? "Product Expired" : "Expiry Alert",
                message: `${product.name} (SKU: ${product.sku}) ${alertType}. Current Stock: ${product.stock}. Store: ${state.currentStore?.name || ""}`,
                timestamp: new Date().toISOString(),
                read: false,
                productId: product.id,
                link: "/products",
              },
            });

            // Mock SMS/Email sending
            console.log(
              `[EXPIRY ALERT] Sending ${state.paymentSettings.enableReceiptSMS ? "SMS" : ""} ${state.paymentSettings.enableReceiptEmail ? "Email" : ""} to ${state.currentStore?.phone || ""}/${state.currentStore?.email || ""}: ${product.name} ${alertType}`,
            );
          }
        }
      });
    };

    // Run once on mount and then every 24 hours (simulated by checking every hour)
    checkExpiries();
    const interval = setInterval(checkExpiries, 3600000); // Check every hour
    return () => clearInterval(interval);
  }, [
    state.inventory,
    state.paymentSettings.enableExpiryNotifications,
    state.currentStore,
  ]);

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
    localStorage.setItem("sellsync_user", JSON.stringify(state.currentUser));
    localStorage.setItem(
      "sellsync_admin_overview",
      String(state.adminOverview),
    );
    if (state.adminUser) {
      localStorage.setItem(
        "sellsync_admin_user",
        JSON.stringify(state.adminUser),
      );
    } else {
      localStorage.removeItem("sellsync_admin_user");
    }
    localStorage.setItem(
      "sellsync_categories",
      JSON.stringify(state.categories),
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

    const kpis = computeKPIs({
      ...state,
      inventory: scopedInventory,
      transactions: filteredTransactions,
    });
    const salesTrend = computeSalesTrend({
      ...state,
      transactions: filteredTransactions,
    });
    const topProducts = computeTopProducts({
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

    const abbreviateAmount = (num: number): string => {
      if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
      if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatCurrency = (amount: number, full?: boolean) => {
      const { symbol, id } = state.currency || { id: "NGN", symbol: "₦" };
      const rate = (id && state.exchangeRates[id]) || 1;
      const convertedAmount = amount * rate;

      if (convertedAmount >= 1000 && !full) {
        return `${symbol}${abbreviateAmount(convertedAmount)}`;
      }

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

    return {
      ...state,
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
      attendance: filteredAttendance,
      payroll: filteredPayroll,
      linkingRequests: filteredLinkingRequests,
      formatCurrency,
      completeSale: (payload: CompleteSalePayload) =>
        dispatch({ type: "COMPLETE_SALE", payload }),
      refundTransaction: (transactionId: string) =>
        dispatch({ type: "REFUND_TRANSACTION", transactionId }),
      adjustStock: (productId: number, delta: number) =>
        dispatch({ type: "ADJUST_STOCK", productId, delta }),
      addProduct: (p: Omit<InventoryItem, "id">) =>
        dispatch({ type: "ADD_PRODUCT", product: p }),
      updateProduct: (p: InventoryItem) =>
        dispatch({ type: "UPDATE_PRODUCT", product: p }),
      setProductStock: (productId: number, stock: number) =>
        dispatch({ type: "SET_STOCK", productId, stock }),
      setProductPrice: (productId: number, price: number) =>
        dispatch({ type: "SET_PRICE", productId, price }),
      deleteProduct: (productId: number) => {
        if (state.currentUser?.role === "Admin" && state.adminOverview) {
          dispatch({ type: "DELETE_PRODUCT", productId });
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
      addCategory: (name: string) => dispatch({ type: "ADD_CATEGORY", name }),
      removeCategory: (name: string) => {
        if (state.currentUser?.role === "Admin" && state.adminOverview) {
          dispatch({ type: "DELETE_CATEGORY", name });
        } else {
          const request: PendingApproval = {
            id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actionType: "delete_category",
            payload: { categoryName: name },
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
      setDailySales: (payload: Record<number, number>) =>
        dispatch({ type: "SET_DAILY_SALES", payload }),
      markNotificationRead: (id: string) =>
        dispatch({ type: "MARK_NOTIFICATION_READ", id }),
      markAllNotificationsRead: () =>
        dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" }),
      clearAllNotifications: () =>
        dispatch({ type: "CLEAR_ALL_NOTIFICATIONS" }),
      addUser: (user: User) => dispatch({ type: "ADD_USER", user }),
      deleteUser: (userId: string) => dispatch({ type: "DELETE_USER", userId }),
      updateUser: (user: User) => dispatch({ type: "UPDATE_USER", user }),
      addStore: (store: Store) => dispatch({ type: "ADD_STORE", store }),
      deleteStore: (storeId: string) =>
        dispatch({ type: "DELETE_STORE", storeId }),
      switchStore: (storeId: string) =>
        dispatch({ type: "SWITCH_STORE", storeId }),
      loginUser: (user: User) => dispatch({ type: "LOGIN_USER", user }),
      switchBackToAdmin: () => {
        if (!state.adminUser) return;
        dispatch({ type: "LOGIN_USER", user: state.adminUser });
      },
      logoutUser: () => dispatch({ type: "LOGOUT_USER" }),
      setCurrency: (currency: Currency) =>
        dispatch({ type: "SET_CURRENCY", currency }),
      updateStoreProfile: (store: Store) =>
        dispatch({ type: "UPDATE_STORE_PROFILE", store }),
      resetUnreadNotifications: () =>
        dispatch({ type: "RESET_UNREAD_NOTIFICATIONS" }),
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
      addPOSTerminal: (terminal: POSTerminal) => {
        if (state.currentUser?.role === "Admin" && state.adminOverview) {
          dispatch({ type: "ADD_POS_TERMINAL", terminal });
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
        if (state.currentUser?.role === "Admin" && state.adminOverview) {
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
      approveApprovalRequest: (requestId: string) =>
        dispatch({ type: "APPROVE_APPROVAL_REQUEST", requestId }),
      rejectApprovalRequest: (requestId: string, reason?: string) =>
        dispatch({ type: "REJECT_APPROVAL_REQUEST", requestId, reason }),
    };
  }, [state]);
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
