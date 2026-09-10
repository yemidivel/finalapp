import { useMemo, useState, useEffect } from "react";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RefreshCcw,
  Calendar,
  Check,
  X,
  Clock,
  Store,
  Tag,
  ShoppingBag,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Package,
  Building2,
  Smartphone,
  Globe,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import {
  motion,
  AnimatePresence,
  useSpring,
} from "framer-motion";
import { staggerContainer, fadeInUp } from "../../animations/variants";
import { useNavigate } from "react-router";

import { useStore } from "../state/store";
import { KPIValue } from "../components/KPIValue";
import { abbreviateNumber } from "../../lib/utils";
import { generateInsights } from "../lib/insights";
import { CashierDashboard } from "../components/CashierDashboard";

function AnimatedNumber({
  value,
  formatter,
}: {
  value: number;
  formatter: (v: number) => string;
}) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    return spring.onChange((latest) => {
      setDisplayValue(formatter(Math.floor(latest)));
    });
  }, [spring, formatter]);

  useEffect(() => {
    setDisplayValue(formatter(value));
  }, [formatter, value]);

  return <motion.span>{displayValue}</motion.span>;
}

const BAR_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#A78BFA",
  "#C4B5FD",
  "#DDD6FE",
];

function formatActionLabel(actionType: string): string {
  switch (actionType) {
    case "delete_product":
      return "Delete Product";
    case "delete_category":
      return "Delete Category";
    case "update_payment_settings":
      return "Update Payment Settings";
    case "add_cashier":
      return "Add Cashier";
    case "delete_store":
      return "Delete Store";
    default:
      return actionType;
  }
}

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    theme,
    kpis,
    inventoryArray,
    currency,
    dailySales,
    formatCurrency,
    currentStore,
    currentUser,
    adjustStock,
    canEdit,
    adminOverview,
    allTransactions,
    allInventory,
    allStores,
    pendingApprovals,
    approveApprovalRequest,
    rejectApprovalRequest,
    linkingRequests,
    approveLinkRequest,
    rejectLinkRequest,
  } = useStore();

  const isAdmin = currentUser?.role === "Admin";
  const isCashier = currentUser?.role === "Cashier";
  const canEditInventory = canEdit("Inventory");

  const expiringSoonItems = useMemo(() => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return inventoryArray
      .filter(
        (item) =>
          item.expiryDate && new Date(item.expiryDate) <= thirtyDaysFromNow,
      )
      .sort(
        (a, b) =>
          new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime(),
      );
  }, [inventoryArray]);

  const lowStockItems = useMemo(() => {
    return inventoryArray
      .filter((item) => item.stock < item.reorderPoint)
      .sort((a, b) => a.stock - b.stock);
  }, [inventoryArray]);

  const showAdminView = isAdmin && adminOverview;

  const topInsights = useMemo(() => {
    return generateInsights(inventoryArray, dailySales).slice(0, 3);
  }, [inventoryArray, dailySales]);

  const topSellingProducts = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const productMap = new Map<number, { name: string; units: number; revenue: number }>();
    for (const txn of allTransactions) {
      if (txn.status !== "Completed") continue;
      if (!showAdminView && txn.storeId !== currentStore?.id) continue;
      const txnDate = new Date(txn.datetime).toISOString().split("T")[0];
      if (txnDate !== today) continue;
      for (const item of txn.items) {
        const existing = productMap.get(item.productId) || { name: "", units: 0, revenue: 0 };
        existing.units += item.qty;
        existing.revenue += item.qty * item.price;
        productMap.set(item.productId, existing);
      }
    }
    for (const [prodId, data] of productMap) {
      if (!data.name) {
        const invItem = inventoryArray.find((i) => i.id === prodId) || allInventory.find((i) => i.id === prodId);
        data.name = invItem?.name || `Product ${prodId}`;
      }
    }
    return Array.from(productMap.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [allTransactions, showAdminView, currentStore?.id, inventoryArray, allInventory]);

  const topStores = useMemo(() => {
    const storeMap = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        revenue: number;
        transactions: number;
        topProduct: { name: string; units: number } | null;
        topCategory: { name: string; revenue: number } | null;
      }
    >();

    for (const store of allStores) {
      if (store.isAdminStore) continue;
      storeMap.set(store.id, {
        storeId: store.id,
        storeName: store.name,
        revenue: 0,
        transactions: 0,
        topProduct: null,
        topCategory: null,
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const productSalesPerStore = new Map<
      string,
      Map<number, { units: number; revenue: number }>
    >();
    const categoryRevenuePerStore = new Map<string, Map<string, number>>();

    for (const txn of allTransactions) {
      if (txn.status !== "Completed") continue;
      const txnDate = new Date(txn.datetime);
      if (txnDate < sevenDaysAgo) continue;

      const entry = storeMap.get(txn.storeId);
      if (!entry) continue;

      entry.revenue += txn.amount;
      entry.transactions += 1;

      if (!productSalesPerStore.has(txn.storeId)) {
        productSalesPerStore.set(txn.storeId, new Map());
      }
      const storeProducts = productSalesPerStore.get(txn.storeId)!;

      if (!categoryRevenuePerStore.has(txn.storeId)) {
        categoryRevenuePerStore.set(txn.storeId, new Map());
      }
      const storeCategories = categoryRevenuePerStore.get(txn.storeId)!;

      for (const item of txn.items) {
        const prod = storeProducts.get(item.productId) || {
          units: 0,
          revenue: 0,
        };
        prod.units += item.qty;
        prod.revenue += item.qty * item.price;
        storeProducts.set(item.productId, prod);

        const invItem = allInventory.find((i) => i.id === item.productId);
        if (invItem) {
          const cat = storeCategories.get(invItem.category) || 0;
          storeCategories.set(
            invItem.category,
            cat + item.qty * item.price,
          );
        }
      }
    }

    for (const [storeId] of storeMap) {
      const storeProducts = productSalesPerStore.get(storeId);
      if (storeProducts) {
        let topProd = { name: "N/A", units: 0 };
        for (const [prodId, data] of storeProducts) {
          if (data.units > topProd.units) {
            const invItem = allInventory.find((i) => i.id === prodId);
            topProd = {
              name: invItem?.name || `Product ${prodId}`,
              units: data.units,
            };
          }
        }
        storeMap.get(storeId)!.topProduct = topProd;
      }

      const storeCategories = categoryRevenuePerStore.get(storeId);
      if (storeCategories) {
        let topCat = { name: "N/A", revenue: 0 };
        for (const [cat, rev] of storeCategories) {
          if (rev > topCat.revenue) {
            topCat = { name: cat, revenue: rev };
          }
        }
        storeMap.get(storeId)!.topCategory = topCat;
      }
    }

    return Array.from(storeMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [allTransactions, allStores, allInventory]);

  const topStore = topStores[0] || null;

  const recentTransactions = useMemo(() => {
    let txns = [...allTransactions].filter((t) => t.status === "Completed");
    if (!showAdminView) {
      txns = txns.filter((t) => t.storeId === currentStore?.id);
    }
    return txns
      .sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
      )
      .slice(0, 8);
  }, [allTransactions, showAdminView, currentStore?.id]);

  const dailySalesData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      const total = dailySales[key] || 0;
      days.push({ day: label, sales: total });
    }
    return days;
  }, [dailySales]);

  const getStoreName = (storeId: string) => {
    return allStores.find((s) => s.id === storeId)?.name || storeId;
  };

  return (
    <div
      className={`p-8 space-y-8 min-h-screen transition-colors duration-300 ${theme === "dark" ? "bg-gray-900 text-gray-100" : "bg-gray-50/50 text-gray-900"}`}
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
            <Badge
              className={`${theme === "dark" ? "bg-indigo-900/30 text-indigo-400 border-indigo-800" : "bg-indigo-50 text-indigo-700 border-indigo-100"} flex items-center gap-1.5 py-1 px-3`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Live Updates Active
            </Badge>
          </div>
          <p className="text-gray-500 font-medium">
            {isAdmin && adminOverview
              ? `Welcome back, ${currentUser?.name}! Here's what's happening across all your stores.`
              : `Welcome back, ${currentUser?.name}! Here's what's happening in ${currentStore.name}.`}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className={`h-10 w-10 rounded-xl transition-all shadow-sm ${theme === "dark" ? "bg-gray-900 border-gray-800 text-gray-400 hover:text-indigo-400" : "bg-white border-gray-200 text-gray-400 hover:text-indigo-600"}`}
          onClick={() => window.location.reload()}
        >
          <RefreshCcw className="w-5 h-5" />
        </Button>
      </div>

      {/* Expiry Alerts Card */}
      {expiringSoonItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            className={`${theme === "dark" ? "bg-red-950/20 border-red-900/30" : "bg-red-50 border-red-100"} shadow-sm overflow-hidden`}
          >
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p
                    className={`text-sm font-bold ${theme === "dark" ? "text-red-400" : "text-red-900"}`}
                  >
                    {expiringSoonItems.length} products expiring soon
                  </p>
                  <p
                    className={`text-xs ${theme === "dark" ? "text-red-500/70" : "text-red-700"}`}
                  >
                    Items expiring within 30 days require immediate review or
                    markdown.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white shrink-0 gap-2"
                onClick={() => navigate("/products")}
              >
                View Details
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isCashier ? (
        <CashierDashboard />
      ) : (
        <>
      {/* Admin KPI Cards */}
      {showAdminView && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {[
            {
              label: "Total Revenue Today",
              value: kpis.totalRevenueToday,
              change: `${kpis.totalRevenueTodayChange > 0 ? "+" : ""}${kpis.totalRevenueTodayChange}%`,
              icon: DollarSign,
              color: "text-green-600",
              bg: "bg-green-50",
              trend: kpis.totalRevenueTodayChange >= 0 ? "up" : "down",
              isCurrency: true,
            },
            {
              label: "Total Sales",
              value: kpis.totalSalesToday,
              change: `${kpis.totalSalesTodayChange > 0 ? "+" : ""}${kpis.totalSalesTodayChange}%`,
              icon: ShoppingCart,
              color: "text-blue-600",
              bg: "bg-blue-50",
              trend: kpis.totalSalesTodayChange >= 0 ? "up" : "down",
            },
          ].map((kpi, i) => (
            <motion.div key={i} variants={fadeInUp}>
              <Card
                className={`border-none shadow-sm rounded-3xl overflow-hidden group hover:shadow-md transition-all ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 ${kpi.bg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}
                    >
                      <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold border-gray-100 flex items-center gap-1 ${theme === "dark" ? "text-gray-500 border-gray-800" : "text-gray-400 border-gray-100"}`}
                    >
                      <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                      LIVE
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
                      {kpi.label}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <KPIValue
                        value={kpi.value}
                        formatter={
                          kpi.isCurrency
                            ? formatCurrency
                            : abbreviateNumber
                        }
                        animate={true}
                        className={
                          theme === "dark" ? "text-gray-100" : "text-gray-900"
                        }
                      />
                      <div
                        className={`flex items-center gap-0.5 text-xs font-bold ${kpi.trend === "up" ? "text-green-600" : "text-orange-600"}`}
                      >
                        {kpi.trend === "up" ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {kpi.change}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Manager/Cashier KPI Cards: 4 columns */}
      {!showAdminView && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {[
            {
              label: "Total Revenue Today",
              value: kpis.totalRevenueToday,
              change: `${kpis.totalRevenueTodayChange > 0 ? "+" : ""}${kpis.totalRevenueTodayChange}%`,
              icon: DollarSign,
              color: "text-green-600",
              bg: "bg-green-50",
              trend: kpis.totalRevenueTodayChange >= 0 ? "up" : "down",
              isCurrency: true,
            },
            {
              label: "Total Sales",
              value: kpis.totalSalesToday,
              change: `${kpis.totalSalesTodayChange > 0 ? "+" : ""}${kpis.totalSalesTodayChange}%`,
              icon: ShoppingCart,
              color: "text-blue-600",
              bg: "bg-blue-50",
              trend: kpis.totalSalesTodayChange >= 0 ? "up" : "down",
            },
            {
              label: "Low Stock Items",
              value: lowStockItems.length,
              change: "",
              icon: AlertTriangle,
              color: "text-orange-600",
              bg: "bg-orange-50",
              trend: lowStockItems.length > 0 ? "down" : "up",
            },
            {
              label: "Products Sold",
              value: kpis.productsSoldToday,
              change: `${kpis.productsSoldTodayChange > 0 ? "+" : ""}${kpis.productsSoldTodayChange}%`,
              icon: Package,
              color: "text-purple-600",
              bg: "bg-purple-50",
              trend: kpis.productsSoldTodayChange >= 0 ? "up" : "down",
            },
          ].map((kpi, i) => (
            <motion.div key={i} variants={fadeInUp}>
              <Card
                className={`border-none shadow-sm rounded-3xl overflow-hidden group hover:shadow-md transition-all ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 ${kpi.bg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}
                    >
                      <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold border-gray-100 flex items-center gap-1 ${theme === "dark" ? "text-gray-500 border-gray-800" : "text-gray-400 border-gray-100"}`}
                    >
                      <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                      LIVE
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      {kpi.label}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <KPIValue
                        value={kpi.value}
                        formatter={
                          kpi.isCurrency
                            ? formatCurrency
                            : abbreviateNumber
                        }
                        animate={true}
                        className={
                          theme === "dark" ? "text-gray-100" : "text-gray-900"
                        }
                      />
                      {kpi.change && (
                        <div
                          className={`flex items-center gap-0.5 text-xs font-bold ${kpi.trend === "up" ? "text-green-600" : "text-orange-600"}`}
                        >
                          {kpi.trend === "up" ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {kpi.change}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Admin-only: Pending Approvals */}
      {showAdminView && (
        (() => {
          const pendingLinkReqs = linkingRequests.filter((r) => r.status === "Pending");
          const pendingAprReqs = pendingApprovals.filter((r) => r.status === "pending");
          const totalPending = pendingLinkReqs.length + pendingAprReqs.length;
          if (totalPending === 0) return null;
          return (
            <Card className={`border-none shadow-sm rounded-[2rem] overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black">
                        Pending Approvals
                      </CardTitle>
                      <p className="text-sm text-gray-500 font-medium">
                        Requests from Managers & Staff requiring your review
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[10px] px-3 py-1.5 rounded-full">
                    {totalPending} pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-2 space-y-3">
                {pendingLinkReqs.map((req) => (
                  <div
                    key={req.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border gap-4 ${theme === "dark" ? "bg-gray-800/50 border-gray-800" : "bg-gray-50/50 border-gray-100"}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${req.type === "Bank" ? "bg-blue-100" : req.type === "POS" ? "bg-purple-100" : "bg-cyan-100"}`}>
                        {req.type === "Bank" ? (
                          <Building2 className={`w-5 h-5 ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`} />
                        ) : req.type === "POS" ? (
                          <ShoppingBag className={`w-5 h-5 ${theme === "dark" ? "text-purple-400" : "text-purple-600"}`} />
                        ) : (
                          <Globe className={`w-5 h-5 ${theme === "dark" ? "text-cyan-400" : "text-cyan-600"}`} />
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                          {req.action === "delete"
                            ? req.type === "Bank"
                              ? `Delete Bank Account — ${req.details.bankName}`
                              : req.type === "POS"
                                ? `Delete POS Terminal — ${req.details.name}`
                                : "Remove Paystack Integration"
                            : req.type === "Bank"
                              ? `Link Bank Account — ${req.details.bankName}`
                              : req.type === "POS"
                                ? `Link POS Terminal — ${req.details.name}`
                                : "Set up Paystack Integration"}
                        </p>
                        <p className="text-[11px] text-gray-400 font-medium">
                          Requested by {req.userName} ({req.userRole})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl font-bold text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                        onClick={() => {
                          rejectLinkRequest(req.id, "Rejected by Admin");
                          toast.error("Request rejected");
                        }}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 rounded-xl font-bold text-xs bg-green-600 hover:bg-green-700 text-white shadow-sm"
                        onClick={() => {
                          approveLinkRequest(req.id);
                          toast.success("Request approved");
                        }}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}

                {pendingAprReqs.map((req) => {
                  const label =
                    req.actionType === "add_bank_account"
                      ? `Add Bank Account — ${req.payload.account?.bankName || ""}`
                      : req.actionType === "delete_bank_account"
                        ? `Delete Bank Account — ${req.payload.bankName || ""}`
                        : req.actionType === "add_pos_terminal"
                          ? `Add POS Terminal — ${req.payload.terminal?.name || ""}`
                          : req.actionType === "delete_pos_terminal"
                            ? `Delete POS Terminal — ${req.payload.terminalName || ""}`
                            : req.actionType === "update_paystack"
                              ? "Update Paystack Integration"
                              : req.actionType === "update_payment_settings"
                                ? "Update Payment Settings"
                                : req.actionType;
                  return (
                    <div
                      key={req.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border gap-4 ${theme === "dark" ? "bg-gray-800/50 border-gray-800" : "bg-gray-50/50 border-gray-100"}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                            {label}
                          </p>
                          <p className="text-[11px] text-gray-400 font-medium">
                            Requested by {req.requesterName} ({req.requesterRole})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl font-bold text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                          onClick={() => {
                            rejectApprovalRequest(req.id, "Rejected by Admin");
                            toast.error("Request rejected");
                          }}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="h-9 rounded-xl font-bold text-xs bg-green-600 hover:bg-green-700 text-white shadow-sm"
                          onClick={() => {
                            approveApprovalRequest(req.id);
                            toast.success("Request approved");
                          }}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })()
      )}

      {/* Sales Chart — single-store daily sales for Manager, Top Stores for Admin overview */}
      {showAdminView ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card
            className={`lg:col-span-2 border-none shadow-sm rounded-[2rem] overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
          >
            <CardHeader className="p-8 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black">
                    Top Stores
                  </CardTitle>
                  <p className="text-sm text-gray-500 font-medium">
                    Top performing stores by revenue (last 7 days)
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 gap-1"
                  onClick={() => navigate("/stores")}
                >
                  View All <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-6">
              {topStores.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topStores}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke={theme === "dark" ? "#1f2937" : "#f3f4f6"}
                      />
                      <XAxis
                        type="number"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        stroke={theme === "dark" ? "#9ca3af" : "#6b7280"}
                        tickFormatter={(v) =>
                          `${currency.symbol}${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="storeName"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={120}
                        stroke={theme === "dark" ? "#9ca3af" : "#6b7280"}
                      />
                      <Tooltip
                        cursor={{ fill: theme === "dark" ? "#1f2937" : "#f9fafb" }}
                        contentStyle={{
                          borderRadius: "16px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                          backgroundColor:
                            theme === "dark" ? "#111827" : "#fff",
                          color: theme === "dark" ? "#fff" : "#000",
                        }}
                        formatter={(v: number) => [
                          formatCurrency(v),
                          "Revenue",
                        ]}
                      />
                      <Bar
                        dataKey="revenue"
                        radius={[0, 8, 8, 0]}
                        animationDuration={500}
                      >
                        {topStores.map((_, index) => (
                          <Cell
                            key={index}
                            fill={
                              index === 0
                                ? "#4F46E5"
                                : BAR_COLORS[index % BAR_COLORS.length]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 rounded-2xl">
                  <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                    <Store className="w-7 h-7 text-indigo-400" />
                  </div>
                  <p className="font-bold text-gray-700">
                    No store data yet
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Sales data will appear here once stores start processing
                    transactions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Store Detail Card */}
          <Card
            className={`border-none shadow-sm rounded-[2rem] overflow-hidden flex flex-col ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
          >
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black">
                Top Performing Store
              </CardTitle>
              <p className="text-sm text-gray-500 font-medium">
                #1 store by revenue this week
              </p>
            </CardHeader>
            <CardContent className="p-8 pt-2 flex-1">
              {topStore ? (
                <motion.div
                  key={topStore.storeId}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-5"
                >
                  <div
                    className={`p-4 rounded-2xl border ${theme === "dark" ? "border-gray-800 bg-gray-800/30" : "border-gray-100 bg-gray-50"}`}
                  >
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
                      Store Name
                    </p>
                    <p className="text-lg font-black text-indigo-600">
                      {topStore.storeName}
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border ${theme === "dark" ? "border-gray-800 bg-gray-800/30" : "border-gray-100 bg-gray-50"}`}
                  >
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
                      7-Day Revenue
                    </p>
                    <p
                      className={`text-lg font-black ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}
                    >
                      {formatCurrency(topStore.revenue)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {topStore.transactions} transaction
                      {topStore.transactions !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border ${theme === "dark" ? "border-gray-800 bg-gray-800/30" : "border-gray-100 bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-purple-500" />
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                        Top Product
                      </p>
                    </div>
                    <p
                      className={`font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}
                    >
                      {topStore.topProduct?.name || "N/A"}
                    </p>
                    {topStore.topProduct && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {topStore.topProduct.units} units sold
                      </p>
                    )}
                  </div>

                  <div
                    className={`p-4 rounded-2xl border ${theme === "dark" ? "border-gray-800 bg-gray-800/30" : "border-gray-100 bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Tag className="w-3.5 h-3.5 text-orange-500" />
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                        Top Category
                      </p>
                    </div>
                    <p
                      className={`font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}
                    >
                      {topStore.topCategory?.name || "N/A"}
                    </p>
                    {topStore.topCategory && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatCurrency(topStore.topCategory.revenue)}{" "}
                        revenue
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                    <Store className="w-8 h-8 text-indigo-400" />
                  </div>
                  <p className="font-bold text-gray-500">
                    No store data yet
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Data will appear once stores process transactions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sales Chart */}
          <Card
            className={`lg:col-span-2 border-none shadow-sm rounded-[2rem] overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
          >
            <CardHeader className="p-8 pb-2">
              <CardTitle className="text-xl font-black">
                Daily Sales — {currentStore?.name}
              </CardTitle>
              <p className="text-sm text-gray-500 font-medium">
                Revenue for the last 7 days
              </p>
            </CardHeader>
            <CardContent className="p-8 pt-6">
              {dailySalesData.some((d) => d.sales > 0) ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailySalesData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={theme === "dark" ? "#1f2937" : "#f3f4f6"}
                      />
                      <XAxis
                        dataKey="day"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        stroke={theme === "dark" ? "#9ca3af" : "#6b7280"}
                      />
                      <YAxis
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        stroke={theme === "dark" ? "#9ca3af" : "#6b7280"}
                        tickFormatter={(v) =>
                          `${currency.symbol}${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                        }
                      />
                      <Tooltip
                        cursor={{ fill: theme === "dark" ? "#1f2937" : "#f9fafb" }}
                        contentStyle={{
                          borderRadius: "16px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                          backgroundColor:
                            theme === "dark" ? "#111827" : "#fff",
                          color: theme === "dark" ? "#fff" : "#000",
                        }}
                        formatter={(v: number) => [
                          formatCurrency(v),
                          "Sales",
                        ]}
                      />
                      <Bar
                        dataKey="sales"
                        radius={[8, 8, 0, 0]}
                        animationDuration={500}
                        fill="#6366F1"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 rounded-2xl">
                  <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                    <Store className="w-7 h-7 text-indigo-400" />
                  </div>
                  <p className="font-bold text-gray-700">No sales data yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Daily sales will appear here once transactions are recorded.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card
            className={`border-none shadow-sm rounded-[2rem] overflow-hidden flex flex-col ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
          >
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <CardTitle className="text-base font-black">AI Insights</CardTitle>
                  <p className="text-[11px] text-gray-400 font-medium">Smart recommendations</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2 flex-1">
              {topInsights.length > 0 ? (
                <div className="space-y-2">
                  {topInsights.map((insight) => {
                    const Icon = insight.icon;
                    return (
                      <div
                        key={insight.id}
                        className={`p-2.5 rounded-xl ${theme === "dark" ? "bg-gray-800/50" : "bg-gray-50"}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            insight.priority === "Critical"
                              ? "bg-red-100"
                              : insight.priority === "High"
                                ? "bg-orange-100"
                                : "bg-indigo-100"
                          }`}>
                            <Icon className={`w-3 h-3 ${
                              insight.priority === "Critical"
                                ? "text-red-600"
                                : insight.priority === "High"
                                  ? "text-orange-600"
                                  : "text-indigo-600"
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[11px] font-bold leading-tight ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                              {insight.title}
                            </p>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5 line-clamp-2">
                              {insight.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    variant="ghost"
                    className="w-full text-[10px] font-black uppercase tracking-widest text-indigo-600 h-8 mt-1"
                    onClick={() => navigate("/insights")}
                  >
                    View All Insights
                  </Button>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-gray-400">No insights available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Row: Top 5 Selling, Low Stock, Expiring — Manager/Cashier only */}
      {!showAdminView && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Top 5 Selling Products */}
          <Card
            className={`border-none shadow-sm rounded-[2rem] overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
          >
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <CardTitle className="text-base font-black">Top Selling Products</CardTitle>
                  <p className="text-[11px] text-gray-400 font-medium">Today's best performers</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {topSellingProducts.length > 0 ? (
                <div className="space-y-2">
                  {topSellingProducts.map((prod, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2.5 rounded-xl ${theme === "dark" ? "bg-gray-800/50" : "bg-gray-50"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                          {prod.name}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {prod.units} units sold
                        </p>
                      </div>
                      <Badge
                        className={`text-[9px] font-black shrink-0 ml-2 border-none ${
                          idx === 0
                            ? "bg-indigo-100 text-indigo-700"
                            : idx === 1
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        #{idx + 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-gray-400">No sales recorded today</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Items */}
          <Card
            className={`border-none shadow-sm rounded-[2rem] overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
          >
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-base font-black">Low Stock</CardTitle>
                  <p className="text-[11px] text-gray-400 font-medium">Below reorder point</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {lowStockItems.length > 0 ? (
                <div className="space-y-2">
                  {lowStockItems.slice(0, 5).map((item) => {
                    const stockPct = Math.round((item.stock / item.reorderPoint) * 100);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl ${theme === "dark" ? "bg-gray-800/50" : "bg-gray-50"}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold truncate ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${stockPct < 30 ? "bg-red-500" : "bg-orange-400"}`}
                                style={{ width: `${Math.min(stockPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <Badge
                          className={`text-[9px] font-black shrink-0 ml-3 border-none ${
                            item.stock === 0
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {item.stock}/{item.reorderPoint}
                        </Badge>
                      </div>
                    );
                  })}
                  {lowStockItems.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full text-[10px] font-black uppercase tracking-widest text-orange-600 h-8 mt-1"
                      onClick={() => navigate("/inventory")}
                    >
                      +{lowStockItems.length - 5} more
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-gray-400">All stock levels healthy</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expiring Items */}
          <Card
            className={`border-none shadow-sm rounded-[2rem] overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
          >
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-base font-black">Expiring Soon</CardTitle>
                  <p className="text-[11px] text-gray-400 font-medium">Within 30 days</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {expiringSoonItems.length > 0 ? (
                <div className="space-y-2">
                  {expiringSoonItems.slice(0, 5).map((item) => {
                    const daysLeft = Math.ceil(
                      (new Date(item.expiryDate!).getTime() - Date.now()) / 86400000,
                    );
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl ${theme === "dark" ? "bg-gray-800/50" : "bg-gray-50"}`}
                      >
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                            {item.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium">
                            {item.stock} units left
                          </p>
                        </div>
                        <Badge
                          className={`text-[9px] font-black shrink-0 ml-2 border-none ${
                            daysLeft <= 7
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {daysLeft}d left
                        </Badge>
                      </div>
                    );
                  })}
                  {expiringSoonItems.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full text-[10px] font-black uppercase tracking-widest text-red-600 h-8 mt-1"
                      onClick={() => navigate("/products")}
                    >
                      +{expiringSoonItems.length - 5} more
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-gray-400">No products expiring soon</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin-only: Recent Activity */}
      {showAdminView && (
        <div>
          <Card
            className={`border-none shadow-sm rounded-[2rem] overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
          >
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-black">
                  Recent Activity
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 gap-1"
                  onClick={() => navigate("/transactions")}
                >
                  View All <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-sm text-gray-500 font-medium">
                Latest transactions across all stores
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow
                    className={`hover:bg-transparent border-gray-50 ${theme === "dark" ? "bg-gray-800/50 border-gray-800" : "bg-gray-50/50"}`}
                  >
                    <TableHead className="px-8 py-3 font-black text-gray-400 uppercase tracking-widest text-[10px]">
                      Store
                    </TableHead>
                    <TableHead className="py-3 font-black text-gray-400 uppercase tracking-widest text-[10px]">
                      Items
                    </TableHead>
                    <TableHead className="py-3 font-black text-gray-400 uppercase tracking-widest text-[10px] text-right">
                      Amount
                    </TableHead>
                    <TableHead className="px-8 py-3 font-black text-gray-400 uppercase tracking-widest text-[10px] text-right">
                      Time
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((txn) => {
                      const txnDate = new Date(txn.datetime);
                      const now = new Date();
                      const diffMs = now.getTime() - txnDate.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      let timeLabel: string;
                      if (diffMins < 1) timeLabel = "Just now";
                      else if (diffMins < 60)
                        timeLabel = `${diffMins}m ago`;
                      else if (diffMins < 1440)
                        timeLabel = `${Math.floor(diffMins / 60)}h ago`;
                      else
                        timeLabel = txnDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });

                      return (
                        <TableRow
                          key={txn.id}
                          className={`group transition-colors border-b ${theme === "dark" ? "hover:bg-gray-800/50 border-gray-800" : "hover:bg-gray-50/50 border-gray-50"}`}
                        >
                          <TableCell className="px-8 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                                <Store className="w-3.5 h-3.5 text-indigo-500" />
                              </div>
                              <span
                                className={`font-bold text-sm truncate max-w-[120px] ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}
                              >
                                {getStoreName(txn.storeId)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <span
                              className={`font-bold text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                            >
                              {txn.items.reduce((s, i) => s + i.qty, 0)}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 text-right font-black text-sm text-indigo-600">
                            {formatCurrency(txn.amount)}
                          </TableCell>
                          <TableCell className="px-8 py-3 text-right">
                            <span className="text-xs text-gray-400 font-bold flex items-center justify-end gap-1">
                              <Clock className="w-3 h-3" />
                              {timeLabel}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="text-center py-16">
                          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShoppingCart className="w-7 h-7 text-gray-400" />
                          </div>
                          <p className="font-bold text-gray-700">
                            No transactions yet
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Activity will appear here once sales are recorded.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
        </>
      )}
    </div>
  );
}
