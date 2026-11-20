/**
 * SellSync — Real backend (DB) client.
 *
 * This module talks to the Express/Prisma backend at VITE_API_BASE_URL (or
 * http://localhost:5000 by default). It owns:
 *   - the JWT session token (localStorage `sellsync_token`, mirroring the
 *     cookie name the backend `protect` middleware reads),
 *   - every typed read/write used by the core flow (onboarding, store,
 *     product/inventory, cashier, sale, notification, POS terminal),
 *   - mappers from backend response shapes to the frontend's store.tsx types.
 *
 * The backend uses UUID string ids, so product/cart id types in the frontend
 * are strings (Product.id, CartItem.productId, inventory keys).
 */
import type {
  InventoryItem,
  Transaction,
  Store,
  User,
  Role,
  AppNotification,
  POSTerminal,
  CartItem,
} from "../app/state/store";

const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(
  window.location.hostname,
);

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalHost ? "http://localhost:5000" : "https://api.sellsync.store");

export const LANDING_URL =
  import.meta.env.VITE_LANDING_URL ||
  (isLocalHost ? "http://localhost:3001" : "https://sellsync.store");

const TOKEN_KEY = "sellsync_token";

// =============================================================================
// Session token management
// The backend `protect` middleware accepts the token either as the
// `Authorization: Bearer` header or as the `sellsync_token` cookie — we
// persist it in localStorage so navigations across ports/origins keep working.
// =============================================================================

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return Boolean(getToken());
}

/**
 * Fired when a request is rejected because the session is no longer valid —
 * either because the JWT's `exp` has passed or because the API answered 401.
 *
 * The db module has no access to the React store, so it announces the event and
 * the app provider listens for it and performs the logout. Using a DOM event
 * keeps this layer free of UI imports.
 */
export const SESSION_EXPIRED_EVENT = "sellsync:session-expired";

/**
 * Read the `exp` claim from a JWT without verifying it.
 *
 * This is only a client-side courtesy check to avoid sending a request that is
 * certain to fail; the backend remains the authority on whether a token is
 * valid, and a 401 is still handled below.
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const claims = JSON.parse(atob(padded));
    if (typeof claims?.exp !== "number") return false;
    return claims.exp * 1000 <= Date.now();
  } catch {
    // A malformed token is not something we can judge here; let the API decide.
    return false;
  }
}

function announceSessionExpired() {
  clearToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
}

/**
 * Consume the landing-page handoff cookie (`sellsync_token` — written by the
 * landing site after a real backend login). Stores the JWT locally and clears
 * the cookie so it is one-time. Returns true when a new token was captured.
 */
export function readHandoffCookie(): boolean {
  const token = getCookie(TOKEN_KEY);
  if (!token) return false;
  clearCookie(TOKEN_KEY);
  setToken(token);
  return true;
}

// =============================================================================
// HTTP layer
// =============================================================================

async function request<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Do not bother the API with a token we already know has expired.
  // This is what stops a stale session from looking like a network error:
  // the user gets a sign-out prompt instead of a spinner that never resolves.
  if (token && isTokenExpired(token)) {
    announceSessionExpired();
    const expired = new Error("Your session has expired. Please sign in again.") as Error & { status?: number };
    expired.status = 401;
    throw expired;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    // The token was revoked, expired server-side, or the secret rotated.
    // One 401 ends the session for good; without this the app would keep
    // replaying a dead token on every subsequent request.
    if (res.status === 401 && token) {
      announceSessionExpired();
    }
    const message =
      (json && (json.message || json.error)) ||
      `Request failed (${res.status})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json as T;
}

// =============================================================================
// Backend response shapes (verified against the Express controllers)
// =============================================================================

export type DbUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  storeId?: string | null;
  isActive?: boolean;
  isVerified?: boolean;
  createdAt?: string;
};

export type DbStore = {
  id: string;
  name: string;
  location?: string | null;
  ownerId: string;
  phone: string;
  email: string;
  isActive?: boolean;
  createdAt?: string;
};

export type DbProduct = {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  price: number;
  barcode?: string | null;
  storeId: string;
  isActive?: boolean;
  createdAt?: string;
  // Perishable goods only. Absent/null means the line does not expire, which is
  // what every non-food product looks like.
  expiryDate?: string | null;
  // Product photo URL, set from an image API when the product is added. Null
  // means the UI should render its placeholder.
  imageUrl?: string | null;
  inventory?: {
    quantity: number;
    lowThreshold: number;
    updatedAt?: string;
  } | null;
};

export type DbTransactionItem = {
  id: string;
  productId: string;
  quantity: number;
  price: number;
};

/**
 * Headline dashboard figures, computed by the backend from the full sales
 * table. Every field is a number — the API already guards the yesterday
 * comparison against a divide-by-zero, so no Infinity/NaN reaches the UI.
 */
export type DbAnalyticsKpis = {
  windowHours: number;
  totalRevenue24h: number;
  totalRevenue24hChange: number;
  totalSales24h: number;
  totalSales24hChange: number;
  productsSold24h: number;
  productsSold24hChange: number;
  lowStockCount: number;
  lowStockCountChange: number;
  // Catalogue-wide expiry counts: lines expiring within the warning window, and
  // lines already past their date.
  expiringSoonCount?: number;
  expiredCount?: number;
};

/**
 * Today-anchored figures for a single cashier's till. `cashierId` is null when
 * a manager/admin asked for the store-wide day.
 */
export type DbCashierKpis = {
  cashierId: string | null;
  windowStart: string;
  salesToday: number;
  itemsSoldToday: number;
  salesCountToday: number;
};

export type DbTrendPoint = { date: string; revenue: number };
export type DbTopProduct = { productName: string; unitsSold: number };
export type DbCategorySlice = { category: string; revenue: number };
export type DbHourPoint = { hour: string; revenue: number };

export type DbTransaction = {
  id: string;
  storeId: string;
  cashierId?: string;
  // Net amount collected (after discount).
  totalAmount: number;
  // How much was discounted off the gross subtotal. Older rows may not have it.
  discount?: number | null;
  paymentMethod?: string | null;
  createdAt?: string;
  items: DbTransactionItem[];
};

/**
 * One card's worth of insight. `scope` distinguishes a manager's store-wide
 * summary from a cashier's own-till summary — they are different data, and the UI
 * labels them differently so nobody reads a till figure as the shop's.
 */
export type DbInsightLine = {
  theme?: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  detail: string;
};

export type DbStoreInsight = {
  success: boolean;
  scope: "store" | "own-sales";
  range?: string;
  title: string;
  summary?: string | null;
  insights: DbInsightLine[];
};

export type DbNotification = {
  id: string;
  userId: string;
  storeId?: string | null;
  title: string;
  message: string;
  read: boolean;
  resolved?: boolean;
  createdAt?: string;
};

export type DbTerminal = {
  id: string;
  storeId: string;
  terminalSerial: string;
  label?: string | null;
  provider?: string | null;
  phoneNumber?: string | null;
  deviceLocation?: string | null;
  merchantId?: string | null;
  isActive?: boolean;
  createdAt?: string;
};

export type DbPaymentInitiation = {
  success: boolean;
  merchantReference: string;
  attemptId: string;
  status: string;
  amount: number;
  message?: string;
};

export type DbPaymentStatus = {
  success: boolean;
  status: string;
  transaction: DbTransaction | null;
};

export type DbMoniepointConnection = {
  success: boolean;
  connected: boolean;
  businessId?: string;
  clientId?: string;
  webhookUrl?: string;
  hasWebhookSecret?: boolean;
};

export type DbCategory = {
  id: string;
  name: string;
  createdAt?: string;
};

// =============================================================================
// Field mappers → frontend types
// =============================================================================

export function mapRole(dbRole: string): Role {
  if (dbRole === "MANAGER") return "Manager";
  if (dbRole === "CASHIER") return "Cashier";
  return "Admin"; // ADMIN / OWNER / anything else → Admin
}

export function mapProduct(p: DbProduct): InventoryItem {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku || "",
    barcode: p.barcode || undefined,
    category: p.category || "Uncategorized",
    price: p.price,
    stock: p.inventory?.quantity ?? 0,
    reorderPoint: p.inventory?.lowThreshold ?? 0,
    createdAt: p.createdAt || new Date().toISOString(),
    // Carried through from the API. Without it the expiry checks downstream saw
    // `undefined` on every product and silently reported nothing expiring.
    expiryDate: p.expiryDate || undefined,
    // Product photo; undefined lets ProductCard fall back to its placeholder.
    imageUrl: p.imageUrl || undefined,
    storeId: p.storeId,
    // Carried through so callers can tell a deactivated product apart from an
    // active one. Normalised to a boolean; absent means active.
    isActive: p.isActive !== false,
  };
}

export function mapTransaction(t: DbTransaction): Transaction {
  const items: CartItem[] = (t.items || []).map((i) => ({
    productId: i.productId,
    qty: i.quantity,
    price: i.price,
  }));
  // The API stores the net amount in `totalAmount` and the discount
  // separately, so the gross subtotal is recoverable. Before, `subtotal` was
  // set to the net figure and `discount` was hardcoded to 0, which made a
  // reprint from history show the discounted total as the subtotal and omit the
  // discount line that the original receipt showed.
  const discount = t.discount ?? 0;
  const net = t.totalAmount;
  return {
    id: t.id,
    datetime: t.createdAt || new Date().toISOString(),
    items,
    subtotal: net + discount,
    discount,
    amount: net,
    payment: t.paymentMethod || "",
    status: "Completed",
    storeId: t.storeId,
    cashier: t.cashierId,
  };
}

export function mapStore(s: DbStore, isAdminStore = false): Store {
  return {
    id: s.id,
    name: s.name,
    code: "",
    address: s.location || "",
    city: "",
    state: "",
    zip: "",
    phone: s.phone,
    email: s.email,
    status: s.isActive === false ? "Inactive" : "Active",
    // A store only gets a managerId once a Manager role has been assigned to it
    // in the app (derived from Manager users). The DB owner is NOT a manager.
    managerId: undefined,
    isAdminStore,
  };
}

export function mapUser(u: DbUser, storeId?: string): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || "",
    role: mapRole(u.role),
    status: u.isActive === false ? "Inactive" : "Active",
    assignedStoreIds: [u.storeId || storeId || ""].filter(Boolean),
    createdBy: undefined,
  };
}

export function mapNotification(n: DbNotification): AppNotification {
  return {
    id: n.id,
    type: notificationType(n.title),
    title: n.title,
    message: n.message,
    timestamp: n.createdAt || new Date().toISOString(),
    read: n.read,
    resolved: n.resolved,
    storeId: n.storeId ?? null,
  };
}

/**
 * The backend stores no severity, so derive one from the title it writes. Stock
 * and expiry notices are alerts, a completed sale is a success, everything else
 * is plain information. Without this every notification copied the same "info"
 * type and the Alerts/Resolved counters on the Notifications page stayed at 0.
 */
function notificationType(title: string): AppNotification["type"] {
  const t = (title || "").toLowerCase();
  if (t.includes("expired") || t.includes("expiry") || t.includes("low stock") || t.includes("out of stock")) {
    return "alert";
  }
  if (t.includes("sale recorded")) return "success";
  return "info";
}

export function mapTerminal(t: DbTerminal): POSTerminal {
  return {
    id: t.id,
    storeId: t.storeId,
    name: t.label || t.deviceLocation || t.terminalSerial,
    provider: (t.provider || "Manual") as POSTerminal["provider"],
    status: t.isActive === false ? "Offline" : "Connected",
    serialNumber: t.terminalSerial,
    terminalId: t.terminalSerial,
    merchantId: t.merchantId || undefined,
    phoneNumber: t.phoneNumber || undefined,
    deviceLocation: t.deviceLocation || undefined,
  };
}

// =============================================================================
// API methods
// =============================================================================

export const db = {
  // ----------------------------------------------------------------- auth
  auth: {
    me: () => request<{ success: boolean; data: DbUser }>("/api/auth/me"),
    login: (email: string, password: string) =>
      request<{
        success: boolean;
        data: { id: string; name: string; email: string; role: string };
        token: string;
      }>("/api/auth/login", { method: "POST", body: { email, password } }),
    signup: (payload: { name: string; email: string; password: string; phone?: string }) =>
      request<{ success: boolean; message: string }>("/api/auth/signUp", {
        method: "POST",
        body: payload,
      }),
  },

  // ----------------------------------------------------------------- stores
  stores: {
    fetch: () =>
      request<{ success: boolean; data: { stores: DbStore[] } }>("/api/stores/"),
    myStore: () =>
      request<{ success: boolean; data: { stores: DbStore[] } }>(
        "/api/stores/my-store",
      ),
    create: (payload: { name: string; location?: string; phone: string; email: string }) =>
      request<{ success: boolean; store: DbStore }>("/api/stores/create", {
        method: "POST",
        body: payload,
      }),
    update: (storeId: string, payload: Partial<{ name: string; location: string; phone: string; email: string }>) =>
      request<{ success: boolean; data: { updatedStore: DbStore } }>(
        `/api/stores/update/${storeId}`,
        { method: "PATCH", body: payload },
      ),
    deactivate: (storeId: string) =>
      request<{ success: boolean }>(`/api/stores/deactivate/${storeId}`, {
        method: "PATCH",
      }),
  },

  // ---------------------------------------------------------------- products
  products: {
    fetch: (storeId: string) =>
      request<{ success: boolean; products: DbProduct[] }>(
        `/api/products/${storeId}`,
      ),
    create: (
      storeId: string,
      payload: {
        name: string;
        sku?: string;
        category?: string;
        price: number;
        barcode?: string;
        quantity: number;
        lowThreshold: number;
        imageUrl?: string;
      },
    ) =>
      request<{ success: boolean; product: DbProduct }>(
        `/api/products/${storeId}/create`,
        { method: "POST", body: payload },
      ),
    update: (storeId: string, id: string, payload: Partial<{ name: string; sku: string; category: string; price: number; barcode: string; imageUrl: string }>) =>
      request<{ success: boolean; updatedProduct: DbProduct }>(
        `/api/products/${storeId}/update/${id}`,
        { method: "PATCH", body: payload },
      ),
    stock: (storeId: string, id: string, payload: { quantity?: number; lowThreshold?: number }) =>
      request<{ success: boolean; updatedInventory: any }>(
        `/api/products/${storeId}/stock/${id}`,
        { method: "PATCH", body: payload },
      ),
    deactivate: (storeId: string, id: string) =>
      request<{ success: boolean }>(`/api/products/${storeId}/deactivate/${id}`, {
        method: "PATCH",
      }),
  },

  // ------------------------------------------------------------- categories
  // Category taxonomy is shared per store (both Managers and Cashiers see the
  // same list), so reads go through the backend just like products.
  categories: {
    fetch: (storeId: string) =>
      request<{ success: boolean; categories: DbCategory[] }>(
        `/api/categories/${storeId}`,
      ),
    create: (storeId: string, name: string) =>
      request<{ success: boolean; category: DbCategory }>(
        `/api/categories/${storeId}`,
        { method: "POST", body: { name } },
      ),
    remove: (storeId: string, name: string) =>
      request<{ success: boolean }>(
        `/api/categories/${storeId}/${encodeURIComponent(name)}`,
        { method: "DELETE" },
      ),
  },

  // ------------------------------------------------------------- transactions
  transactions: {
    fetch: (storeId: string) =>
      request<{ success: boolean; transactions: DbTransaction[] }>(
        `/api/transactions/${storeId}?limit=100000`,
      ),
    create: (
      payload: {
        storeId: string;
        paymentMethod: string;
        items: { productId: string; quantity: number }[];
        discount?: number;
      },
    ) =>
      request<{ success: boolean; transaction: DbTransaction }>(
        "/api/transactions/create",
        { method: "POST", body: payload },
      ),
  },
  // The dashboard figures are computed server-side. Doing it here client-side
  // meant re-deriving revenue, unit counts and low-stock from whatever subset of
  // rows happened to be in memory, which is how a live till could show zeros
  // while the database had the sales in it. CASHIER is allowed through these
  // routes; the handlers narrow the rows to that cashier's own sales.
  analytics: {
    kpis: (storeId: string) =>
      request<{ success: boolean; kpis: DbAnalyticsKpis }>(
        `/api/analytics/${storeId}/kpis`,
      ),
    // Today-anchored, cashier-scoped figures for the till dashboard. A CASHIER
    // gets their own sales; managers/admins can pass a cashierId.
    cashierKpis: (storeId: string, cashierId?: string) =>
      request<{ success: boolean; cashierKpis: DbCashierKpis }>(
        `/api/analytics/${storeId}/cashier-kpis${cashierId ? `?cashierId=${encodeURIComponent(cashierId)}` : ""}`,
      ),
    salesTrend: (storeId: string) =>
      request<{ success: boolean; dailySales: DbTrendPoint[] }>(
        `/api/analytics/${storeId}/sales-trend`,
      ),
    topProducts: (storeId: string) =>
      request<{ success: boolean; topProducts: DbTopProduct[] }>(
        `/api/analytics/${storeId}/top-products`,
      ),
    salesByCategory: (storeId: string) =>
      request<{ success: boolean; salesByCategory: DbCategorySlice[] }>(
        `/api/analytics/${storeId}/sales-by-category`,
      ),
    hourlySales: (storeId: string) =>
      request<{ success: boolean; hourlySales: DbHourPoint[] }>(
        `/api/analytics/${storeId}/hourly-sales`,
      ),
  },

  // ---------------------------------------------------------------- managers
  // A manager is just a backend User with role "MANAGER" linked to a store —
  // created through the same signUp endpoint used for any user.
  managers: {
    fetch: async (storeId: string) => {
      const res = await request<{ success: boolean; users: DbUser[] }>(
        `/api/users/${storeId}?role=MANAGER`,
      );
      return { success: res.success, managers: res.users };
    },
    create: (storeId: string, payload: { name: string; email: string; password: string }) =>
      request<{ success: boolean; message: string }>("/api/auth/signUp", {
        method: "POST",
        body: { ...payload, role: "MANAGER", storeId },
      }),
    deactivate: (storeId: string, id: string) =>
      request<{ success: boolean }>(`/api/users/${storeId}/deactivate/${id}`, {
        method: "PATCH",
      }),
  },

  // ---------------------------------------------------------------- cashiers
  cashiers: {
    fetch: (storeId: string) =>
      request<{ success: boolean; cashiers: DbUser[] }>(
        `/api/cashiers/${storeId}`,
      ),
    create: (storeId: string, payload: { name: string; email: string; password: string }) =>
      request<{ success: boolean; message: string }>(
        `/api/cashiers/${storeId}/create`,
        { method: "POST", body: payload },
      ),
    deactivate: (storeId: string, id: string) =>
      request<{ success: boolean }>(`/api/cashiers/${storeId}/deactivate/${id}`, {
        method: "PATCH",
      }),
    reactivate: (storeId: string, id: string) =>
      request<{ success: boolean }>(`/api/cashiers/${storeId}/reactivate/${id}`, {
        method: "PATCH",
      }),
  },

  // --------------------------------------------------------------- terminals
  terminals: {
    fetch: (storeId: string) =>
      request<{ success: boolean; terminals: DbTerminal[] }>(
        `/api/terminals/${storeId}`,
      ),
    add: (
      storeId: string,
      payload: {
        terminalSerial: string;
        label?: string;
        provider?: string;
        phoneNumber?: string;
        deviceLocation?: string;
        merchantId?: string;
      },
    ) =>
      request<{ success: boolean; message: string; terminal: DbTerminal }>(
        `/api/terminals/${storeId}/add`,
        { method: "POST", body: payload },
      ),
    deactivate: (storeId: string, id: string) =>
      request<{ success: boolean; message: string }>(
        `/api/terminals/${storeId}/deactivate/${id}`,
        { method: "PATCH" },
      ),
    initiatePayment: (
      storeId: string,
      payload: {
        terminalId: string;
        items: { productId: string; quantity: number }[];
        discount?: number;
        paymentMethod?: string;
        customer?: string;
        notes?: string;
      },
    ) =>
      request<DbPaymentInitiation>(`/api/terminals/${storeId}/pay`, {
        method: "POST",
        body: payload,
      }),
    paymentStatus: (storeId: string, merchantReference: string) =>
      request<DbPaymentStatus>(
        `/api/terminals/${storeId}/payment/${encodeURIComponent(merchantReference)}`,
      ),
    connection: {
      get: (storeId: string) =>
        request<DbMoniepointConnection>(
          `/api/terminals/${storeId}/connection`,
        ),
      save: (
        storeId: string,
        payload: {
          businessId: string;
          clientId: string;
          clientSecret: string;
          webhookSecret: string;
        },
      ) =>
        request<DbMoniepointConnection>(
          `/api/terminals/${storeId}/connection`,
          { method: "POST", body: payload },
        ),
      disconnect: (storeId: string) =>
        request<DbMoniepointConnection>(
          `/api/terminals/${storeId}/connection`,
          { method: "DELETE" },
        ),
    },
  },

  // ------------------------------------------------------------ notifications
  notifications: {
    // `storeId` narrows the feed to the store the user is looking at. The
    // backend returns every notification addressed to the user when it is
    // omitted, so callers that have a store should always pass it. The pager
    // options mirror the transactions table: `page` / `limit` fetch one page,
    // `filter` / `search` narrow the list, and the response carries the
    // filtered `total` plus scope-wide KPI `counts`.
    fetch: (
      storeId?: string,
      opts?: {
        page?: number;
        limit?: number;
        filter?: string;
        search?: string;
      },
    ) => {
      const params = new URLSearchParams();
      if (storeId) params.set("storeId", storeId);
      if (opts?.page) params.set("page", String(opts.page));
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.filter && opts.filter !== "all") {
        params.set("filter", opts.filter);
      }
      if (opts?.search) params.set("search", opts.search);
      const query = params.toString();
      return request<{
        success: boolean;
        notifications: DbNotification[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        counts: {
          total: number;
          unread: number;
          alerts: number;
          resolved: number;
        };
      }>(`/api/notifications${query ? `?${query}` : ""}`);
    },
    markRead: (id: string) =>
      request<{ success: boolean; notification: DbNotification }>(
        `/api/notifications/${id}/read`,
        { method: "PATCH" },
      ),
    resolve: (id: string) =>
      request<{ success: boolean; notification: DbNotification }>(
        `/api/notifications/${id}/resolve`,
        { method: "PATCH" },
      ),
    markAllRead: (storeId?: string) =>
      request<{ success: boolean; updated: number }>(
        `/api/notifications/read-all${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ""}`,
        { method: "PATCH" },
      ),
  },

  // ---------------------------------------------------------------- insights
  //
  // The dashboard's insight cards used to be built in the browser by
  // `generateInsights`, whose sparklines came from Math.random() and whose
  // timestamps were fabricated at 8-minute intervals. Nothing here is
  // fabricated: the figures are measured by the backend from the store's own
  // transactions and inventory.
  insights: {
    fetch: (storeId: string, range?: string) =>
      request<DbStoreInsight>(
        `/api/ai/${encodeURIComponent(storeId)}/insight${range ? `?range=${encodeURIComponent(range)}` : ""}`,
      ),
  },

  // ------------------------------------------------------------------- chat
  // The AI assistant is server-side: the backend detects the intent behind a
  // question, pulls the matching store figures, and answers with the LLM. The
  // browser only sends the message and renders the reply.
  chat: {
    send: (storeId: string, message: string) =>
      request<{ success: boolean; reply: string }>(
        `/api/chat/${encodeURIComponent(storeId)}`,
        { method: "POST", body: { message } },
      ),
  },
};