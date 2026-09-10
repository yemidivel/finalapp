/**
 * =============================================================================
 * SELLSYNC API SERVICE LAYER
 * =============================================================================
 * 
 * This file provides the API integration layer for connecting the SellSync
 * frontend to your backend server. All API calls should be made through this
 * module for consistency and easier maintenance.
 * 
 * =============================================================================
 * SETUP INSTRUCTIONS
 * =============================================================================
 * 
 * 1. Create a .env file in the project root (copy from .env.example)
 * 2. Set VITE_API_BASE_URL to your backend's URL (e.g., http://localhost:3000)
 * 3. Your backend should serve endpoints under the /link prefix
 * 
 * Example backend URL structure:
 *   - GET  {baseUrl}/link/inventory     - Fetch all products
 *   - POST {baseUrl}/link/inventory     - Create a new product
 *   - PUT  {baseUrl}/link/inventory/:id - Update a product
 *   - DEL  {baseUrl}/link/inventory/:id - Delete a product
 * 
 * =============================================================================
 * ENDPOINT REFERENCE
 * =============================================================================
 * 
 * Replace these placeholder endpoints with your actual backend routes.
 * The {baseUrl} variable is read from VITE_API_BASE_URL in .env
 * 
 * PRODUCTS & INVENTORY
 *   GET    {baseUrl}/link/products              - List all products
 *   GET    {baseUrl}/link/products/:id          - Get single product
 *   POST   {baseUrl}/link/products              - Create product
 *   PUT    {baseUrl}/link/products/:id           - Update product
 *   DELETE {baseUrl}/link/products/:id           - Delete product
 *   POST   {baseUrl}/link/products/bulk         - Bulk import products
 * 
 * TRANSACTIONS (Sales)
 *   GET    {baseUrl}/link/transactions          - List transactions
 *   GET    {baseUrl}/link/transactions/:id       - Get transaction details
 *   POST   {baseUrl}/link/transactions          - Create new sale
 *   POST   {baseUrl}/link/transactions/:id/refund - Process refund
 * 
 * INVENTORY MANAGEMENT
 *   GET    {baseUrl}/link/inventory             - Get inventory levels
 *   PUT    {baseUrl}/link/inventory/:id/stock   - Adjust stock levels
 *   GET    {baseUrl}/link/inventory/low-stock   - Get low stock alerts
 *   GET    {baseUrl}/link/inventory/expiring    - Get expiring products
 * 
 * CUSTOMERS
 *   GET    {baseUrl}/link/customers             - List customers
 *   GET    {baseUrl}/link/customers/:id         - Get customer details
 *   POST   {baseUrl}/link/customers             - Create customer
 *   PUT    {baseUrl}/link/customers/:id         - Update customer
 * 
 * STAFF & USERS
 *   GET    {baseUrl}/link/users                 - List staff members
 *   GET    {baseUrl}/link/users/:id             - Get user details
 *   POST   {baseUrl}/link/users                 - Create user
 *   PUT    {baseUrl}/link/users/:id             - Update user
 * 
 * STORES
 *   GET    {baseUrl}/link/stores                - List stores
 *   GET    {baseUrl}/link/stores/:id            - Get store details
 *   POST   {baseUrl}/link/stores                - Create store
 *   PUT    {baseUrl}/link/stores/:id            - Update store
 * 
 * ATTENDANCE & PAYROLL
 *   GET    {baseUrl}/link/attendance             - Get attendance records
 *   POST   {baseUrl}/link/attendance/clock-in   - Clock in staff
 *   POST   {baseUrl}/link/attendance/clock-out  - Clock out staff
 *   GET    {baseUrl}/link/payroll               - Get payroll records
 *   POST   {baseUrl}/link/payroll               - Process payroll
 * 
 * NOTIFICATIONS
 *   GET    {baseUrl}/link/notifications         - Get notifications
 *   PUT    {baseUrl}/link/notifications/:id/read - Mark as read
 * 
 * ANALYTICS & REPORTS
 *   GET    {baseUrl}/link/analytics/kpis        - Get dashboard KPIs
 *   GET    {baseUrl}/link/analytics/sales-trend - Get sales trends
 *   GET    {baseUrl}/link/analytics/top-products - Get top selling products
 * 
 * SETTINGS
 *   GET    {baseUrl}/link/settings              - Get app settings
 *   PUT    {baseUrl}/link/settings              - Update settings
 * 
 * =============================================================================
 * REQUEST/Response TYPES
 * =============================================================================
 * 
 * These types mirror the frontend's store.tsx types for consistency.
 * Adjust based on your backend's actual response structure.
 */

import type {
  Product,
  InventoryItem,
  Transaction,
  Customer,
  User,
  Store,
  Attendance,
  PayrollRecord,
  AppNotification,
} from "../app/state/store";

/**
 * Base URL for API calls - reads from environment variable
 * Access with: import.meta.env.VITE_API_BASE_URL
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/**
 * Default headers for all API requests
 * Add authentication headers here (e.g., Bearer token)
 */
const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Add auth token if available in env
  // const token = import.meta.env.VITE_API_TOKEN;
  // if (token) {
  //   headers["Authorization"] = `Bearer ${token}`;
  // }

  return headers;
};

/**
 * Generic API response wrapper type
 * Adjust based on your backend's response format
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

/**
 * Paginated response type for list endpoints
 */
interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * =============================================================================
 * API SERVICE FUNCTIONS
 * =============================================================================
 * 
 * Below are the API service functions. Each function is commented out with
 * example implementations. Uncomment and modify to connect to your backend.
 * 
 * =============================================================================
 */

// =============================================================================
// PRODUCTS API
// =============================================================================

/**
 * Fetch all products from the backend
 * 
 * Backend Endpoint: GET {baseUrl}/link/products
 * 
 * Example backend response:
 * {
 *   "success": true,
 *   "data": [
 *     { "id": 1, "name": "Product A", "sku": "SKU-001", "price": 100, ... }
 *   ]
 * }
 */
export const api = {
  /**
   * Get all products
   * GET /link/products
   * 
   * To use:
   * 1. Uncomment this function
   * 2. Replace with actual fetch call to your backend
   * 3. Call from store.tsx or component with useEffect
   * 
   * Example usage:
   * ```ts
   * const products = await api.products.getAll();
   * dispatch({ type: "SET_INVENTORY", payload: products });
   * ```
   */
  // products: {
  //   getAll: async (): Promise<Product[]> => {
  //     const response = await fetch(`${BASE_URL}/link/products`, {
  //       method: "GET",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<Product[]> = await response.json();
  //     if (!result.success) throw new Error(result.error);
  //     return result.data;
  //   },
  //
  //   getById: async (id: number): Promise<Product> => {
  //     const response = await fetch(`${BASE_URL}/link/products/${id}`, {
  //       method: "GET",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<Product> = await response.json();
  //     if (!result.success) throw new Error(result.error);
  //     return result.data;
  //   },
  //
  //   create: async (product: Omit<Product, "id">): Promise<Product> => {
  //     const response = await fetch(`${BASE_URL}/link/products`, {
  //       method: "POST",
  //       headers: getHeaders(),
  //       body: JSON.stringify(product),
  //     });
  //     const result: ApiResponse<Product> = await response.json();
  //     if (!result.success) throw new Error(result.error);
  //     return result.data;
  //   },
  //
  //   update: async (id: number, product: Partial<Product>): Promise<Product> => {
  //     const response = await fetch(`${BASE_URL}/link/products/${id}`, {
  //       method: "PUT",
  //       headers: getHeaders(),
  //       body: JSON.stringify(product),
  //     });
  //     const result: ApiResponse<Product> = await response.json();
  //     if (!result.success) throw new Error(result.error);
  //     return result.data;
  //   },
  //
  //   delete: async (id: number): Promise<void> => {
  //     const response = await fetch(`${BASE_URL}/link/products/${id}`, {
  //       method: "DELETE",
  //       headers: getHeaders(),
  //     });
  //     if (!response.ok) throw new Error("Failed to delete product");
  //   },
  // },

  // =============================================================================
  // TRANSACTIONS API
  // =============================================================================
  // 
  // Backend Endpoint: GET/POST {baseUrl}/link/transactions
  // 
  // Example: Creating a new sale
  // POST /link/transactions
  // Body: { items: [], subtotal: 100, discount: 10, amount: 90, payment: "Cash", ... }
  //
  // transactions: {
  //   getAll: async (): Promise<Transaction[]> => {
  //     const response = await fetch(`${BASE_URL}/link/transactions`, {
  //       method: "GET",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<Transaction[]> = await response.json();
  //     return result.data;
  //   },
  //
  //   create: async (transaction: Omit<Transaction, "id">): Promise<Transaction> => {
  //     const response = await fetch(`${BASE_URL}/link/transactions`, {
  //       method: "POST",
  //       headers: getHeaders(),
  //       body: JSON.stringify(transaction),
  //     });
  //     const result: ApiResponse<Transaction> = await response.json();
  //     return result.data;
  //   },
  //
  //   refund: async (transactionId: string): Promise<Transaction> => {
  //     const response = await fetch(`${BASE_URL}/link/transactions/${transactionId}/refund`, {
  //       method: "POST",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<Transaction> = await response.json();
  //     return result.data;
  //   },
  // },

  // =============================================================================
  // INVENTORY API
  // =============================================================================
  // 
  // Backend Endpoints:
  //   GET  /link/inventory         - Get all inventory with stock levels
  //   PUT  /link/inventory/:id/stock - Adjust stock for a product
  //
  // inventory: {
  //   getAll: async (): Promise<InventoryItem[]> => {
  //     const response = await fetch(`${BASE_URL}/link/inventory`, {
  //       method: "GET",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<InventoryItem[]> = await response.json();
  //     return result.data;
  //   },
  //
  //   adjustStock: async (productId: number, delta: number): Promise<InventoryItem> => {
  //     const response = await fetch(`${BASE_URL}/link/inventory/${productId}/stock`, {
  //       method: "PUT",
  //       headers: getHeaders(),
  //       body: JSON.stringify({ delta }),
  //     });
  //     const result: ApiResponse<InventoryItem> = await response.json();
  //     return result.data;
  //   },
  // },

  // =============================================================================
  // CUSTOMERS API
  // =============================================================================
  // 
  // Backend Endpoints:
  //   GET  /link/customers     - List all customers
  //   POST /link/customers     - Create new customer
  //   PUT  /link/customers/:id - Update customer
  //
  // customers: {
  //   getAll: async (): Promise<Customer[]> => {
  //     const response = await fetch(`${BASE_URL}/link/customers`, {
  //       method: "GET",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<Customer[]> = await response.json();
  //     return result.data;
  //   },
  //
  //   create: async (customer: Omit<Customer, "id">): Promise<Customer> => {
  //     const response = await fetch(`${BASE_URL}/link/customers`, {
  //       method: "POST",
  //       headers: getHeaders(),
  //       body: JSON.stringify(customer),
  //     });
  //     const result: ApiResponse<Customer> = await response.json();
  //     return result.data;
  //   },
  // },

  // =============================================================================
  // USERS/STAFF API
  // =============================================================================
  // 
  // Backend Endpoints:
  //   GET  /link/users      - List all users
  //   POST /link/users      - Create user
  //   PUT  /link/users/:id  - Update user
  //
  // users: {
  //   login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
  //     const response = await fetch(`${BASE_URL}/link/auth/login`, {
  //       method: "POST",
  //       headers: getHeaders(),
  //       body: JSON.stringify({ email, password }),
  //     });
  //     const result = await response.json();
  //     return result;
  //   },
  //
  //   getAll: async (): Promise<User[]> => {
  //     const response = await fetch(`${BASE_URL}/link/users`, {
  //       method: "GET",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<User[]> = await response.json();
  //     return result.data;
  //   },
  // },

  // =============================================================================
  // ANALYTICS/KPIS API
  // =============================================================================
  // 
  // Backend Endpoints:
  //   GET /link/analytics/kpis          - Dashboard KPIs
  //   GET /link/analytics/sales-trend   - 7-day sales trend
  //   GET /link/analytics/top-products   - Top selling products
  //
  // analytics: {
  //   getKPIs: async (): Promise<KPIs> => {
  //     const response = await fetch(`${BASE_URL}/link/analytics/kpis`, {
  //       method: "GET",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<KPIs> = await response.json();
  //     return result.data;
  //   },
  //
  //   getSalesTrend: async (): Promise<SalesTrendPoint[]> => {
  //     const response = await fetch(`${BASE_URL}/link/analytics/sales-trend`, {
  //       method: "GET",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<SalesTrendPoint[]> = await response.json();
  //     return result.data;
  //   },
  // },

  // =============================================================================
  // NOTIFICATIONS API
  // =============================================================================
  // 
  // Backend Endpoints:
  //   GET  /link/notifications              - Get notifications
  //   PUT  /link/notifications/:id/read     - Mark as read
  //
  // notifications: {
  //   getAll: async (): Promise<AppNotification[]> => {
  //     const response = await fetch(`${BASE_URL}/link/notifications`, {
  //       method: "GET",
  //       headers: getHeaders(),
  //     });
  //     const result: ApiResponse<AppNotification[]> = await response.json();
  //     return result.data;
  //   },
  //
  //   markAsRead: async (id: string): Promise<void> => {
  //     await fetch(`${BASE_URL}/link/notifications/${id}/read`, {
  //       method: "PUT",
  //       headers: getHeaders(),
  //     });
  //   },
  // },
};

/**
 * =============================================================================
 * INTEGRATION GUIDE FOR STORE.TSX
 * =============================================================================
 * 
 * To connect store.tsx to the backend:
 * 
 * 1. Replace localStorage reads with API calls in useEffect:
 * 
 *    // BEFORE (current - localStorage)
 *    const inventory = JSON.parse(localStorage.getItem("sellsync_inventory") || 'null') || initialInventory;
 * 
 *    // AFTER (with backend)
 *    useEffect(() => {
 *      const fetchInventory = async () => {
 *        try {
 *          const data = await api.inventory.getAll();
 *          dispatch({ type: "SET_INVENTORY", payload: data });
 *        } catch (error) {
 *          console.error("Failed to fetch inventory:", error);
 *        }
 *      };
 *      fetchInventory();
 *    }, []);
 * 
 * 2. Replace reducer actions with API calls:
 * 
 *    // BEFORE (current - local state update)
 *    completeSale: (payload) => dispatch({ type: "COMPLETE_SALE", payload }),
 * 
 *    // AFTER (with backend)
 *    completeSale: async (payload) => {
 *      try {
 *        await api.transactions.create(payload);
 *        dispatch({ type: "COMPLETE_SALE", payload });
 *      } catch (error) {
 *        console.error("Sale failed:", error);
 *        throw error; // Re-throw so UI can show error
 *      }
 *    },
 * 
 * 3. Add SET_INVENTORY action to reducer:
 * 
 *    | { type: "SET_INVENTORY"; payload: Record<number, InventoryItem> }
 * 
 *    case "SET_INVENTORY":
 *      return { ...state, inventory: action.payload };
 * 
 * =============================================================================
 * SUGGESTED BACKEND INTEGRATION ORDER
 * =============================================================================
 * 
 * 1. Start with read-only endpoints (GET):
 *    - Products/Inventory
 *    - Transactions (historical)
 *    - Customers
 *    - Users
 * 
 * 2. Then add write endpoints (POST/PUT):
 *    - Create sale (COMPLETE_SALE)
 *    - Stock adjustments
 *    - Customer management
 * 
 * 3. Finally add complex features:
 *    - Real-time notifications (WebSocket)
 *    - Analytics
 *    - Staff attendance
 * 
 * =============================================================================
 */

export default api;
