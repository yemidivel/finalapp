import { useMemo, useState, useEffect, useRef } from "react";
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
  ShieldAlert,
  Trophy,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  motion,
  AnimatePresence,
} from "framer-motion";
import { staggerContainer, fadeInUp } from "../../animations/variants";
import { Stagger } from "../../animations/Stagger";
import { useNavigate } from "react-router";

import { useStore, useProductSync, type Transaction } from "../state/store";
import { KPIValue } from "../components/KPIValue";
import { formatFullNumber } from "../../lib/utils";
import { CashierDashboard } from "../components/CashierDashboard";
import { LiveDot } from "../components/LiveDot";
import { db, type DbInsightLine } from "../../lib/db";

// Every number and every bar on the page animates off ONE shared clock, so
// they all move together and land on their final figures at exactly the same
// moment (nothing finishes early or lingers behind).
const COUNT_DURATION = 3600;
const COUNT_EASE: (t: number) => number = (t) => 1 - Math.pow(1 - t, 3);

let tickerStart = 0;
let tickerEased = 0;
const tickerSubs = new Set<() => void>();
let tickerRaf = 0;

function tickerRestart() {
  tickerStart = performance.now();
  tickerEased = 0;
  if (tickerRaf) cancelAnimationFrame(tickerRaf);
  const loop = (now: number) => {
    const t = Math.min((now - tickerStart) / COUNT_DURATION, 1);
    tickerEased = COUNT_EASE(t);
    tickerSubs.forEach((fn) => fn());
    if (t < 1) {
      tickerRaf = requestAnimationFrame(loop);
    } else {
      tickerRaf = 0;
    }
  };
  tickerRaf = requestAnimationFrame(loop);
}

function tickerSubscribe(fn: () => void) {
  tickerSubs.add(fn);
  return () => {
    tickerSubs.delete(fn);
  };
}

function AnimatedNumber({
  value,
  formatter,
  decimals = 0,
}: {
  value: number;
  formatter: (v: number) => string;
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(() => formatter(0));
  const fromRef = useRef(0);

  useEffect(() => {
    tickerRestart();
    return tickerSubscribe(() => {
      const current =
        fromRef.current + (value - fromRef.current) * tickerEased;
      const rounded =
        decimals > 0
          ? Math.round(current * 10 ** decimals) / 10 ** decimals
          : Math.round(current);
      setDisplayValue(formatter(rounded));
      if (tickerEased >= 1) fromRef.current = value;
    });
  }, [value, formatter, decimals]);

  return <motion.span>{displayValue}</motion.span>;
}

// Bar that rises in step with the shared clock used by the numbers.
function TopBar({ px, color }: { px: number; color: string }) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    tickerRestart();
    return tickerSubscribe(() => setHeight(px * tickerEased));
  }, [px]);

  return (
    <div
      className="w-8 rounded-t-[6px]"
      style={{ backgroundColor: color, height }}
    />
  );
}

// iPhone-battery-style health colouring: red at or below 15%, yellow 16-74%,
// green 75% and above.
function storeHealthColor(pct: number): string {
  if (pct <= 15) return "#EF4444";
  if (pct < 75) return "#F59E0B";
  return "#10B981";
}

// Generates clean y-axis tick values that comfortably cover the biggest bar.
function niceTicks(maxVal: number, count = 4): number[] {
  const rawStep = maxVal / count;
  const pow = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / pow;
  let step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  step *= pow;
  const top = Math.ceil(maxVal / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

function formatAxisTick(v: number, symbol: string): string {
  if (v >= 1_000_000) {
    return `${symbol}${v % 1_000_000 === 0 ? (v / 1_000_000).toFixed(0) : (v / 1_000_000).toFixed(1)}M`;
  }
  if (v >= 1_000) return `${symbol}${(v / 1_000).toFixed(0)}k`;
  return `${symbol}${v.toLocaleString()}`;
}

const BAR_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#A78BFA",
  "#C4B5FD",
  "#DDD6FE",
];

// Distinct fills for the Top Stores bars.
const ADMIN_BAR_COLORS = [
  "#4D44E3",
  "#6D5FF0",
  "#8B7BF8",
  "#A78BFA",
  "#C4B5FD",
];

// One source of truth for a given 24h/7d/30d window: the start of the current
// window and the start of the equal-length window before it (used for the
// "vs previous" deltas). Everything admin derives from this single pass.
function windowDelimiters(range: "24h" | "7d" | "30d") {
  const now = new Date();
  const start = new Date(now);
  const prevStart = new Date(now);
  if (range === "24h") {
    start.setHours(now.getHours() - 24);
    prevStart.setHours(now.getHours() - 48);
  } else if (range === "7d") {
    start.setDate(now.getDate() - 7);
    prevStart.setDate(now.getDate() - 14);
  } else {
    start.setDate(now.getDate() - 30);
    prevStart.setDate(now.getDate() - 60);
  }
  return { start, prevStart };
}

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
    formatCurrency,
    currentStore,
    currentUser,
    adjustStock,
    canEdit,
    adminOverview,
    allTransactions,
    allInventory,
    allStores,
    users,
    pendingApprovals,
    approveApprovalRequest,
    rejectApprovalRequest,
    linkingRequests,
    approveLinkRequest,
    rejectLinkRequest,
    storeInsight,
    refreshTransactions,
    refreshProducts,
    refreshAnalytics,
    refreshStoreInsight,
  } = useStore();
  // Read products from the database (not a login-time snapshot) so this
  // page stays in sync across Manager and Cashier sessions.
  useProductSync();


  const isAdmin = currentUser?.role === "Admin";
  const isCashier = currentUser?.role === "Cashier";
  const canEditInventory = canEdit("Inventory");

  // "Expiring soon" means still sellable and within the warning window.
  //
  // The old filter was `expiryDate <= now + 30 days`, which also swept in
  // everything already past its date, so stock that should have been written
  // off appeared in a card reassuring the manager it was fine for another month.
  // Expired lines are counted and shown separately further down.
  const expiringSoonItems = useMemo(() => {
    const now = Date.now();
    const thirtyDaysFromNow = now + 30 * 86400000;
    return inventoryArray
      .filter((item) => {
        if (!item.expiryDate) return false;
        const at = new Date(item.expiryDate).getTime();
        if (Number.isNaN(at)) return false;
        if (at < now) return false; // already expired
        if (at > thirtyDaysFromNow) return false;
        if (item.stock <= 0) return false; // nothing left to sell
        return true;
      })
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
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [refreshing, setRefreshing] = useState(false);
  const rangeLabel =
    timeRange === "24h" ? "24h" : timeRange === "7d" ? "7 Days" : "30 Days";

  const handleRefresh = async () => {
    const storeId = currentStore?.id;
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refreshTransactions(storeId),
        refreshProducts(storeId),
        refreshAnalytics(storeId),
        refreshStoreInsight(storeId),
      ]);
      setAiReloadKey((k) => k + 1);
    } finally {
      window.setTimeout(() => setRefreshing(false), 500);
    }
  };

  // AI Store Insights, read from the same endpoint that backs the Insights
  // tab's "Alerts & Pricing" analyses, so the dashboard headline and its lead
  // paragraph are the exact copy a manager sees when they open the full view.
  // The window follows the 24h / 7d / 30d switch.
  const [aiInsights, setAiInsights] = useState<DbInsightLine[]>([]);
  const [aiReloadKey, setAiReloadKey] = useState(0);
  useEffect(() => {
    const storeId = currentStore?.id;
    if (!storeId || isCashier) {
      setAiInsights([]);
      return;
    }
    let cancelled = false;
    db.insights
      .fetch(storeId, timeRange)
      .then((res) => {
        if (!cancelled) {
          setAiInsights(Array.isArray(res.insights) ? res.insights : []);
        }
      })
      .catch(() => {
        if (!cancelled) setAiInsights([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentStore?.id, timeRange, aiReloadKey, isCashier]);

  // Fast lookup for product→category resolution inside the store aggregation;
  // avoids an O(n) .find() per line item on every range switch.
  const inventoryById = useMemo(
    () => new Map(allInventory.map((i) => [i.id, i])),
    [allInventory],
  );

  const completedTxns = useMemo(
    () => allTransactions.filter((t) => t.status === "Completed"),
    [allTransactions],
  );

  // One pass over completed transactions computes the current window's
  // transactions + revenue + sales AND the previous equal-length window's
  // revenue/sales, so the 24h/7d/30d switch re-paints every admin card in a
  // single O(n) sweep (no double filtering, no per-item inventory scans).
  const adminRangeStats = useMemo(() => {
    if (!showAdminView)
      return {
        txns: [] as Transaction[],
        revenue: 0,
        sales: 0,
        revenueChange: 0,
        salesChange: 0,
      };
    const { start, prevStart } = windowDelimiters(timeRange);
    const startMs = start.getTime();
    const prevMs = prevStart.getTime();
    const txns: Transaction[] = [];
    let revenue = 0;
    let sales = 0;
    let prevRevenue = 0;
    let prevSales = 0;
    for (const t of completedTxns) {
      const ts = new Date(t.datetime).getTime();
      if (ts >= startMs) {
        txns.push(t);
        revenue += t.amount;
        sales += 1;
      } else if (ts >= prevMs) {
        prevRevenue += t.amount;
        prevSales += 1;
      }
    }
    return {
      txns,
      revenue,
      sales,
      // When the previous window had no activity the store either did not
      // exist yet or sold nothing on it, so the honest reading is full growth
      // (+100%) whenever the current window has sales to show.
      revenueChange:
        prevRevenue > 0
          ? ((revenue - prevRevenue) / prevRevenue) * 100
          : revenue > 0
            ? 100
            : 0,
      salesChange:
        prevSales > 0
          ? ((sales - prevSales) / prevSales) * 100
          : sales > 0
            ? 100
            : 0,
    };
  }, [showAdminView, timeRange, completedTxns]);

  // Manager (store-scoped) twin of `adminRangeStats`: the same single pass
  // derives the current window's revenue / sales / units sold AND the previous
  // equal-length window's figures, so the 24h / 7d / 30d switch repaints the
  // manager KPI cards instantly without re-filtering the ledger repeatedly.
  const managerRangeStats = useMemo(() => {
    if (showAdminView)
      return {
        revenue: 0,
        sales: 0,
        units: 0,
        revenueChange: 0,
        salesChange: 0,
        unitsChange: 0,
      };
    const { start, prevStart } = windowDelimiters(timeRange);
    const startMs = start.getTime();
    const prevMs = prevStart.getTime();
    let revenue = 0;
    let sales = 0;
    let units = 0;
    let prevRevenue = 0;
    let prevSales = 0;
    let prevUnits = 0;
    for (const t of completedTxns) {
      if (t.storeId !== currentStore?.id) continue;
      const ts = new Date(t.datetime).getTime();
      if (ts >= startMs) {
        revenue += t.amount;
        sales += 1;
        for (const it of t.items) units += it.qty;
      } else if (ts >= prevMs) {
        prevRevenue += t.amount;
        prevSales += 1;
        for (const it of t.items) prevUnits += it.qty;
      }
    }
    const pctChange = (cur: number, prev: number) =>
      prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
    return {
      revenue,
      sales,
      units,
      revenueChange: pctChange(revenue, prevRevenue),
      salesChange: pctChange(sales, prevSales),
      unitsChange: pctChange(units, prevUnits),
    };
  }, [showAdminView, timeRange, completedTxns, currentStore?.id]);

  const adminConnectedStores = useMemo(
    () => allStores.filter((s) => !s.isAdminStore),
    [allStores],
  );

  // "HOUSE HEALTH" = share of connected stores that settled at least one
  // sale inside the selected window. It is a measurement, not static copy.
  const adminStoreHealth = useMemo(() => {
    const total = adminConnectedStores.length;
    if (total === 0) return 0;
    const withSales = new Set(adminRangeStats.txns.map((t) => t.storeId));
    return Math.round(
      (adminConnectedStores.filter((s) => withSales.has(s.id)).length /
        total) *
        100,
    );
  }, [adminConnectedStores, adminRangeStats.txns]);

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

    const productSalesPerStore = new Map<
      string,
      Map<number, { units: number; revenue: number }>
    >();
    const categoryRevenuePerStore = new Map<string, Map<string, number>>();

    for (const txn of adminRangeStats.txns) {
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

        const invItem = inventoryById.get(item.productId);
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
            const invItem = inventoryById.get(prodId);
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
  }, [adminRangeStats.txns, allStores, inventoryById]);

  // Top performer is only meaningful once a store has actually sold something;
  // on a window with no sales the spotlight card shows its empty state instead.
  const topStore = topStores.find((s) => s.transactions > 0) || null;

  // Scale shared by the y-axis ticks and the bars so a bar reaches exactly the
  // height its amount sits at on the axis.
  const topChartMax = Math.max(...topStores.map((s) => s.revenue), 1);
  const topChartTicks = niceTicks(topChartMax);
  const topChartAxisMax = topChartTicks[topChartTicks.length - 1];

  const managerForStore = (storeId: string) => {
    const store = allStores.find((s) => s.id === storeId);
    const mgr = store?.managerId
      ? users.find((u) => u.id === store.managerId)
      : undefined;
    return (
      mgr ||
      users.find(
        (u) =>
          u.role === "Manager" && u.assignedStoreIds?.includes(storeId),
      )
    );
  };

  const adminTopTotalRevenue = useMemo(
    () => topStores.reduce((s, st) => s + st.revenue, 0),
    [topStores],
  );

  const adminLeaderShare =
    adminTopTotalRevenue > 0
      ? Math.round(((topStore?.revenue || 0) / adminTopTotalRevenue) * 100)
      : 0;

  const recentTransactions = useMemo(() => {
    let txns = [...allTransactions].filter((t) => t.status === "Completed");
    if (!showAdminView) {
      txns = txns.filter((t) => t.storeId === currentStore?.id);
    }
    const cutoff = new Date();
    if (timeRange === "24h") {
      cutoff.setHours(cutoff.getHours() - 24);
    } else if (timeRange === "7d") {
      cutoff.setDate(cutoff.getDate() - 7);
    } else if (timeRange === "30d") {
      cutoff.setDate(cutoff.getDate() - 30);
    }
    txns = txns.filter((t) => new Date(t.datetime) >= cutoff);
    return txns
      .sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
      )
      .slice(0, 5);
  }, [allTransactions, showAdminView, currentStore?.id, timeRange]);

  // Range-aware sales series for the Daily Sales card, mirroring the buckets the
  // Insights tab's Revenue Trend card uses: 24 hourly columns for 24h, the seven
  // weekday columns for 7d, and four weekly columns for 30d. Every figure is
  // summed from this store's completed transactions on the local clock, so the
  // card re-buckets the moment the 24h / 7d / 30d switch moves.
  const dailySalesData = useMemo(() => {
    const now = new Date();
    const txns = completedTxns.filter((t) => t.storeId === currentStore?.id);

    if (timeRange === "24h") {
      const cutoff = new Date(now);
      cutoff.setHours(now.getHours() - 24);
      const buckets: Record<number, number> = {};
      for (const t of txns) {
        const d = new Date(t.datetime);
        if (d < cutoff) continue;
        const h = d.getHours();
        buckets[h] = (buckets[h] || 0) + t.amount;
      }
      return Array.from({ length: 24 }, (_, h) => ({
        day: `${String(h).padStart(2, "0")}:00`,
        sales: buckets[h] || 0,
      }));
    }

    if (timeRange === "7d") {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() - 7);
      const totals: Record<string, number> = {};
      for (const t of txns) {
        const d = new Date(t.datetime);
        if (d < cutoff) continue;
        const k = dayNames[d.getDay()];
        totals[k] = (totals[k] || 0) + t.amount;
      }
      return dayNames.map((d) => ({ day: d, sales: totals[d] || 0 }));
    }

    const start = new Date();
    start.setDate(start.getDate() - 30);
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const totals = [0, 0, 0, 0];
    for (const t of txns) {
      const d = new Date(t.datetime);
      if (d < start) continue;
      const idx = Math.min(
        3,
        Math.max(0, Math.floor((d.getTime() - start.getTime()) / weekMs)),
      );
      totals[idx] += t.amount;
    }
    return totals.map((v, i) => ({ day: `Week ${i + 1}`, sales: v }));
  }, [completedTxns, currentStore?.id, timeRange]);

  const dailyRangeSubtitle =
    timeRange === "24h"
      ? "revenue for the last 24 hours"
      : timeRange === "7d"
        ? "revenue for the last 7 days"
        : "weekly revenue for the last 30 days";
  const dailyRangeBadge =
    timeRange === "24h"
      ? "Last 24h"
      : timeRange === "7d"
        ? "Last 7 days"
        : "Last 30 days";

  const getStoreName = (storeId: string) => {
    return allStores.find((s) => s.id === storeId)?.name || storeId;
  };

  // Scale for the Daily Sales bars, shared by the y-axis ticks and the bars so
  // each bar reaches exactly the height its amount sits at on the axis. Mirrors
  // the Insights tab's Product Performance / Sales by Category graphs.
  const dailyChartMax = Math.max(...dailySalesData.map((d) => d.sales), 1);
  const dailyChartTicks = niceTicks(dailyChartMax);
  const dailyChartAxisMax = dailyChartTicks[dailyChartTicks.length - 1];
  // The 24h window has 24 columns, too many to print a value on every bar or a
  // label under each one, so those are thinned out.
  const denseSales = dailySalesData.length > 12;

  return (
    <Stagger
      className={`px-8 pt-2 pb-8 space-y-6 min-h-screen transition-colors duration-300 ${theme === "dark" ? "bg-gray-900 text-gray-100" : "bg-surface text-on-surface"}`}
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-on-surface"            >
              Dashboard
            </h1>
            <LiveDot size="h-4 w-4" />
          </div>
          <p className="text-xs font-medium text-on-surface-variant mt-1">
            Welcome back,{" "}
            <span className="font-semibold text-on-surface">
              {currentUser?.name || "there"}
            </span>
            {isAdmin && adminOverview
              ? "! Here's what's happening across all your stores."
              : `! Here's what's happening in ${currentStore.name}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* The 24h / 7 Days / 30 Days telemetry window repaints the KPI cards
              and charts. Managers and admin-overview use it; the cashier's till
              dashboard measures one till and never shows it. */}
          {!isCashier && (
            <div className="inline-flex items-center bg-surface-container-lowest p-1 rounded-xl shadow-sm border border-outline-variant/40">
              <button
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${timeRange === "24h" ? "bg-primary-container text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                onClick={() => setTimeRange("24h")}
              >
                24h
              </button>
              <button
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${timeRange === "7d" ? "bg-primary-container text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                onClick={() => setTimeRange("7d")}
              >
                7 Days
              </button>
              <button
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${timeRange === "30d" ? "bg-primary-container text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                onClick={() => setTimeRange("30d")}
              >
                30 Days
              </button>
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant hover:text-primary hover:bg-surface-container shadow-sm transition-all"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh dashboard"
          >
            <RefreshCcw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
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
                onClick={() => navigate(isCashier ? "/inventory" : "/products")}
              >
                View Details
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <AnimatePresence mode="popLayout" initial={false}>
        {isCashier ? (
          <CashierDashboard key="cashier" />
        ) : (
          <motion.div
            key={timeRange}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -22 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
      {/* Admin KPI Cards */}
      {showAdminView && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* Revenue — follows the selected 24h / 7d / 30d window */}
          <div className="bento-card bento-card-hover p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-secondary-container/40 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-on-secondary-container" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                  Revenue (Last{" "}
                  {timeRange === "24h" ? "24h" : timeRange === "7d" ? "7 Days" : "30 Days"})
                </p>
              </div>
            </div>
            <div className="mt-4">
              <p className="font-display text-4xl font-extrabold text-on-surface leading-none tabular-nums">
                <AnimatedNumber
                  value={adminRangeStats.revenue}
                  formatter={formatCurrency}
                  decimals={2}
                />
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold ${adminRangeStats.revenueChange >= 0 ? "text-on-secondary-container" : "text-error"}`}
                >
                  {adminRangeStats.revenueChange >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {adminRangeStats.revenueChange > 0 ? "+" : ""}
                  {adminRangeStats.revenueChange.toFixed(1)}%
                </span>
                <span className="text-xs font-medium text-on-surface-variant">
                  vs prev {timeRange === "24h" ? "24h" : timeRange === "7d" ? "7d" : "30d"}
                </span>
              </div>
            </div>
          </div>

          {/* Sales — follows the selected 24h / 7d / 30d window */}
          <div className="bento-card bento-card-hover p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-primary-fixed flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5 text-primary-container" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                  Sales (Last{" "}
                  {timeRange === "24h" ? "24h" : timeRange === "7d" ? "7 Days" : "30 Days"})
                </p>
              </div>
            </div>
            <div className="mt-4">
              <p className="font-display text-4xl font-extrabold text-on-surface leading-none tabular-nums">
                <AnimatedNumber
                  value={adminRangeStats.sales}
                  formatter={formatFullNumber}
                />
              </p>
              <div className="flex items-center justify-between gap-2 mt-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${adminRangeStats.salesChange >= 0 ? "text-on-secondary-container" : "text-error"}`}
                  >
                    {adminRangeStats.salesChange >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {adminRangeStats.salesChange > 0 ? "+" : ""}
                    {adminRangeStats.salesChange.toFixed(1)}%
                  </span>
                  <span className="text-xs font-medium text-on-surface-variant whitespace-nowrap">
                    vs prev {timeRange === "24h" ? "24h" : timeRange === "7d" ? "7d" : "30d"}
                  </span>
                </div>
                <p className="text-xs font-medium text-on-surface-variant whitespace-nowrap">
                  <AnimatedNumber
                    value={adminRangeStats.sales}
                    formatter={(v) =>
                      `${v.toLocaleString()} ${v === 1 ? "sale" : "sales"} settled`
                    }
                  />
                </p>
              </div>
            </div>
          </div>

          {/* Connected Stores */}
          <div className="bento-card bento-card-hover p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-surface-container flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-on-surface-variant" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                  Connected Stores
                </p>
              </div>
              <div className="relative overflow-hidden rounded-full bg-surface-container-high shrink-0">
                <motion.span
                  className="absolute inset-y-0 left-0"
                  style={{
                    backgroundColor: storeHealthColor(adminStoreHealth),
                  }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${adminStoreHealth}%` }}
                  transition={{
                    duration: COUNT_DURATION / 1000,
                    ease: COUNT_EASE,
                  }}
                />
                <span className="relative flex items-center gap-1 py-1 pr-3 pl-3">
                  <span className="rounded-md bg-surface-container-lowest/80 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    Health
                  </span>
                  <span className="text-xs font-bold text-on-surface tabular-nums">
                    {adminStoreHealth}%
                  </span>
                </span>
              </div>
            </div>
            <div className="mt-4">
              <p className="font-display text-4xl font-extrabold text-on-surface leading-none tabular-nums">
                <AnimatedNumber
                  value={adminConnectedStores.length}
                  formatter={(v) => v.toLocaleString()}
                />
                <span className="text-base font-bold text-on-surface-variant ml-1.5">
                  Active
                </span>
              </p>
              <p className="text-xs font-medium text-on-surface-variant mt-3">
                Stores with a completed sale in the current window
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manager/Cashier KPI Cards: 4 columns */}
      {!showAdminView && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {[
            {
              label: `Revenue (Last ${rangeLabel})`,
              value: managerRangeStats.revenue,
              change: `${managerRangeStats.revenueChange > 0 ? "+" : ""}${managerRangeStats.revenueChange.toFixed(1)}%`,
              detail: `vs prev ${rangeLabel.toLowerCase()}`,
              icon: DollarSign,
              chip: "bg-secondary-container/40 text-on-secondary-container",
              trend: managerRangeStats.revenueChange >= 0 ? "up" : "down",
              isCurrency: true,
            },
            {
              label: `Sales (Last ${rangeLabel})`,
              value: managerRangeStats.sales,
              change: `${managerRangeStats.salesChange > 0 ? "+" : ""}${managerRangeStats.salesChange.toFixed(1)}%`,
              detail: "orders completed",
              icon: ShoppingCart,
              chip: "bg-primary-fixed text-primary-container",
              trend: managerRangeStats.salesChange >= 0 ? "up" : "down",
            },
            {
              label: "Low Stock Items",
              value: lowStockItems.length,
              change: "",
              detail:
                lowStockItems.length > 0
                  ? "below reorder point"
                  : "all stock levels healthy",
              icon: AlertTriangle,
              chip:
                lowStockItems.length > 0
                  ? "bg-error/10 text-error"
                  : "bg-surface-container text-on-surface-variant",
              trend: lowStockItems.length > 0 ? "down" : "up",
            },
            {
              label: `Products Sold (Last ${rangeLabel})`,
              value: managerRangeStats.units,
              change: `${managerRangeStats.unitsChange > 0 ? "+" : ""}${managerRangeStats.unitsChange.toFixed(1)}%`,
              detail: "units total",
              icon: Package,
              chip: "bg-primary-fixed-dim/50 text-on-primary-fixed",
              trend: managerRangeStats.unitsChange >= 0 ? "up" : "down",
            },
          ].map((kpi, i) => (
            <motion.div key={i} variants={fadeInUp} className="h-full">
              <div className="bento-card p-5 h-full flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${kpi.chip}`}
                  >
                    <kpi.icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-variant mb-1.5">
                  {kpi.label}
                </p>
                <div className="flex items-baseline gap-2 min-w-0">
                  <KPIValue
                    value={kpi.value}
                    formatter={kpi.isCurrency ? formatCurrency : formatFullNumber}
                    animate={true}
                    className="text-on-surface"
                  />
                </div>
                <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center gap-2">
                  {kpi.change ? (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold ${kpi.trend === "up" ? "text-on-secondary-container" : "text-error"}`}
                    >
                      {kpi.trend === "up" ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {kpi.change}
                    </span>
                  ) : null}
                  <span className="text-xs font-medium text-on-surface-variant truncate">
                    {kpi.detail}
                  </span>
                </div>
              </div>
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
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden h-full flex flex-col bg-surface-container-lowest border border-outline-variant/40">
              <CardHeader className="p-6 pb-4">
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
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-4 bg-surface-container-low/60 border-outline-variant/40`}
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
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-4 bg-surface-container-low/60 border-outline-variant/40`}
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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Top Stores — bar graph of amount vs stores, with txn stats beside the bars */}
          <div className="xl:col-span-8 bento-card p-6 flex flex-col">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
                  <Store className="w-5 h-5 text-on-surface-variant" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-on-surface">
                    Top Stores
                  </h3>
                  <p className="text-xs font-medium text-on-surface-variant">
                    Top performing stores by amount (last{" "}
                    {timeRange === "24h"
                      ? "24 hours"
                      : timeRange === "7d"
                        ? "7 days"
                        : "30 days"}
                    )
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="h-9 rounded-xl font-semibold text-primary-container hover:bg-primary-fixed px-3 text-sm inline-flex items-center gap-1"
                  onClick={() => navigate("/team")}
                >
                  View All <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {topStores.length > 0 ? (
              <div className="flex flex-col flex-1 gap-4">
                {/* Per-store additional info on top of the chart */}
                <div className="flex flex-wrap items-center gap-2">
                  {topStores.map((s, i) => {
                    const sharePct =
                      adminTopTotalRevenue > 0
                        ? Math.round(
                            (s.revenue / adminTopTotalRevenue) * 100,
                          )
                        : 0;
                    return (
                      <span
                        key={s.storeId}
                        className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low/60 pl-1.5 pr-3 py-1.5"
                      >
                        <span
                          className="w-4 h-4 rounded-sm shrink-0"
                          style={{
                            backgroundColor:
                              ADMIN_BAR_COLORS[
                                i % ADMIN_BAR_COLORS.length
                              ],
                          }}
                        />
                        <span className="text-xs font-semibold text-on-surface">
                          {s.storeName}
                        </span>
                        <span className="text-[11px] font-medium text-on-surface-variant">
                          {s.transactions}{" "}
                          {s.transactions === 1 ? "txn" : "txns"} ·{" "}
                          {sharePct}%
                        </span>
                      </span>
                    );
                  })}
                </div>

                {/* Bar graph: bars start next to the y-axis and grow to the height their
                    amount maps to on the scale, with the number counting up in
                    step as each bar rises */}
                <div className="flex flex-1 min-h-0">
                  {/* Y axis numbers */}
                  <div className="relative h-[280px] w-16 shrink-0">
                    {topChartTicks.map((t) => (
                      <span
                        key={t}
                        className="absolute right-1 -translate-y-1/2 text-[10px] font-medium text-on-surface-variant tabular-nums"
                        style={{
                          bottom: `${(t / topChartAxisMax) * 258}px`,
                        }}
                      >
                        {formatAxisTick(t, currency.symbol)}
                      </span>
                    ))}
                  </div>
                  <div
                    className="relative h-[280px] flex-1 border-b-2"
                    style={{
                      borderBottom:
                        "2px solid rgb(var(--m3-on-surface))",
                    }}
                  >
                    {topChartTicks.map((t) => (
                      <div
                        key={t}
                        className="absolute left-0 right-0 border-t border-dashed border-outline-variant/60"
                        style={{
                          bottom: `${(t / topChartAxisMax) * 258}px`,
                        }}
                      />
                    ))}
                    <div className="absolute inset-0 flex items-end justify-start gap-3 pl-9 pr-1">
                      {topStores.map((s, i) => {
                        const barPx = Math.max(
                          Math.round(
                            (s.revenue / topChartAxisMax) * 258,
                          ),
                          0,
                        );
                        const color =
                          ADMIN_BAR_COLORS[
                            i % ADMIN_BAR_COLORS.length
                          ];
                        return (
                          <div
                            key={s.storeId}
                            className="w-16 h-full flex flex-col items-center justify-end"
                          >
                            <motion.span
                              key={`${s.storeId}-${timeRange}`}
                              className="text-xs font-bold text-on-surface tabular-nums whitespace-nowrap mb-1.5"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.9, ease: "easeOut" }}
                            >
                              <AnimatedNumber
                                value={s.revenue}
                                formatter={formatCurrency}
                                decimals={2}
                              />
                            </motion.span>
                            <TopBar px={barPx} color={color} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pr-1 pl-[6.25rem]">
                  {topStores.map((s) => (
                    <div
                      key={s.storeId}
                      className="w-16 pl-4 text-left text-xs font-semibold text-on-surface-variant truncate"
                    >
                      {s.storeName}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-outline-variant/60 rounded-2xl py-10">
                <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center mb-4">
                  <Store className="w-7 h-7 text-primary" />
                </div>
                <p className="font-display text-lg font-bold text-on-surface">
                  No store data yet
                </p>
                <p className="text-xs font-medium text-on-surface-variant mt-1">
                  Sales data will appear here once stores start processing
                  transactions.
                </p>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-outline-variant/40 flex items-center justify-between gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                <RefreshCcw className="w-3.5 h-3.5 text-on-secondary-container" />
                Calculated across{" "}
                {timeRange === "24h"
                  ? "24 hours"
                  : timeRange === "7d"
                    ? "7 days"
                    : "30 days"}
              </span>
            </div>
          </div>

          {/* Top Performing Store spotlight */}
          <div className="xl:col-span-4 relative rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/40 h-full flex flex-col">
            <div
              aria-hidden="true"
              className="absolute -top-16 right-6 w-44 h-44 rounded-full opacity-25 blur-3xl pointer-events-none"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(77,68,227,0.55), transparent 70%)",
              }}
            />
            {topStore ? (
              <div className="relative flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-on-surface">
                      Top Performing Store
                    </h3>
                    <p className="text-xs font-medium text-on-surface-variant mt-0.5">
                      #1 store by revenue this window
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary-fixed-dim text-on-primary-fixed flex items-center justify-center">
                    <Trophy className="w-5 h-5" />
                  </div>
                </div>

                <div className="rounded-xl bg-surface-container-low border border-outline-variant/40 p-4 mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                      Store Platter
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase rounded-full bg-secondary-container text-on-secondary-container px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-on-secondary-container animate-blink" />
                      Online
                    </span>
                  </div>
                  <p className="font-display text-2xl font-extrabold text-primary tracking-tight">
                    {topStore.storeName}
                  </p>
                  {(() => {
                    const manager = managerForStore(topStore.storeId);
                    return manager ? (
                      <p className="text-xs font-medium text-on-surface-variant mt-1.5">
                        {manager.name} · {manager.email || "Manager"}
                      </p>
                    ) : null;
                  })()}
                </div>

                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant mb-1.5">
                  7-Day Revenue
                </p>
                <div className="rounded-xl bg-primary-fixed-dim/40 border border-primary-fixed-dim p-4 mb-4">
                  <p className="font-display text-4xl font-extrabold text-on-primary-fixed tracking-tight tabular-nums">
                    <AnimatedNumber
                      value={topStore.revenue}
                      formatter={formatCurrency}
                      decimals={2}
                    />
                  </p>
                  <p className="text-xs font-bold text-on-secondary-container mt-1">
                    <AnimatedNumber
                      value={topStore.transactions}
                      formatter={(v) => `${v.toLocaleString()} Transactions Settled`}
                    />
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        Top Product
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {topStore.topProduct?.name || "N/A"}
                    </p>
                    {topStore.topProduct && (
                      <p className="text-xs font-medium text-on-surface-variant">
                        <AnimatedNumber
                          value={topStore.topProduct.units}
                          formatter={(v) => `${v.toLocaleString()} units sold`}
                        />
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        Top Category
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {topStore.topCategory?.name || "N/A"}
                    </p>
                    {topStore.topCategory && (
                      <p className="text-xs font-medium text-on-surface-variant">
                        <AnimatedNumber
                          value={topStore.topCategory.revenue}
                          formatter={(v) => `${formatCurrency(v)} revenue`}
                          decimals={2}
                        />
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-outline-variant/40 flex items-center justify-between">
                  <span className="text-xs font-medium text-on-surface-variant">
                    Ledger share of top stores
                  </span>
                  <span className="text-sm font-bold text-on-secondary-container">
                    {adminLeaderShare}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center mb-4">
                  <Store className="w-7 h-7 text-primary" />
                </div>
                <p className="font-display text-lg font-bold text-on-surface">
                  No store data yet
                </p>
                <p className="text-xs font-medium text-on-surface-variant mt-1">
                  Data will appear once stores process transactions.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sales Chart */}
          <div className="lg:col-span-2 bento-card overflow-hidden flex flex-col">
            <div className="p-6 pb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary-container flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-on-surface">
                    Daily Sales
                  </h3>
                  <p className="text-xs font-medium text-on-surface-variant">
                    {currentStore?.name} · {dailyRangeSubtitle}
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant shrink-0">
                {dailyRangeBadge}
              </span>
            </div>
            <div className="p-6 pt-4">
              {dailySalesData.some((d) => d.sales > 0) ? (
                <div className="flex flex-col gap-4">
                  <div className="flex min-h-0">
                    {/* Y axis numbers */}
                    <div className="relative h-[260px] w-16 shrink-0">
                      {dailyChartTicks.map((t) => (
                        <span
                          key={t}
                          className="absolute right-1 -translate-y-1/2 text-[10px] font-medium text-on-surface-variant tabular-nums"
                          style={{
                            bottom: `${(t / dailyChartAxisMax) * 238}px`,
                          }}
                        >
                          {formatAxisTick(t, currency.symbol)}
                        </span>
                      ))}
                    </div>
                    <div
                      className="relative h-[260px] flex-1 border-b-2"
                      style={{
                        borderBottom: "2px solid rgb(var(--m3-on-surface))",
                      }}
                    >
                      {dailyChartTicks.map((t) => (
                        <div
                          key={t}
                          className="absolute left-0 right-0 border-t border-dashed border-outline-variant/60"
                          style={{
                            bottom: `${(t / dailyChartAxisMax) * 238}px`,
                          }}
                        />
                      ))}
                      <div className="absolute inset-0 flex items-end justify-around gap-2 px-2">
                        {dailySalesData.map((d, i) => {
                          const barPx = Math.max(
                            Math.round((d.sales / dailyChartAxisMax) * 238),
                            0,
                          );
                          const color = BAR_COLORS[i % BAR_COLORS.length];
                          return (
                            <div
                              key={`${d.day}-${i}`}
                              className="flex-1 min-w-0 h-full flex flex-col items-center justify-end"
                            >
                              {!denseSales && (
                                <motion.span
                                  className="text-[10px] font-bold text-on-surface tabular-nums whitespace-nowrap mb-1.5"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ duration: 0.9, ease: "easeOut" }}
                                >
                                  <AnimatedNumber
                                    value={d.sales}
                                    formatter={formatCurrency}
                                  />
                                </motion.span>
                              )}
                              <TopBar px={barPx} color={color} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-around gap-2 pl-16 pr-2">
                    {dailySalesData.map((d, i) => (
                      <div
                        key={`${d.day}-${i}`}
                        className="flex-1 min-w-0 text-center text-xs font-semibold text-on-surface-variant truncate"
                      >
                        {!denseSales || i % 3 === 0 ? d.day : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-center border-2 border-dashed border-outline-variant/60 rounded-2xl">
                  <div className="w-14 h-14 bg-primary-fixed rounded-full flex items-center justify-center mb-4">
                    <Store className="w-7 h-7 text-primary-container" />
                  </div>
                  <p className="font-bold text-on-surface">No sales data yet</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Daily sales will appear here once transactions are recorded.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="bento-card overflow-hidden flex flex-col">
            <div className="p-6 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-fixed rounded-xl flex items-center justify-center shrink-0 text-primary-container">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-on-surface">
                    AI Store Insights
                  </h3>
                  {/* Names the figures and their window. The subtitle used to
                      read "Smart recommendations", which described generated
                      advice; these are now measurements, and a cashier's are
                      their own till rather than the shop's. */}
                  <p className="text-[11px] text-on-surface-variant font-medium">
                    {storeInsight?.scope === "own-sales"
                      ? "Your till · last 7 days"
                      : "Whole store · last 7 days"}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 pt-2 flex-1">
              {aiInsights.length > 0 ? (
                <div className="space-y-2.5">
                  {aiInsights.slice(0, 3).map((insight, i) => {
                    // Severity comes from the backend, which derives it from
                    // measured facts (a stockout is HIGH, a quiet week is LOW).
                    // The old cards picked an icon from a fabricated `priority`
                    // that had no relationship to the data.
                    const tone =
                      insight.severity === "HIGH"
                        ? { box: "bg-error/10", glyph: "text-error", bar: "bg-error", Icon: ShieldAlert }
                        : insight.severity === "MEDIUM"
                          ? { box: "bg-amber-100", glyph: "text-amber-600", bar: "bg-amber-500", Icon: AlertCircle }
                          : { box: "bg-primary-fixed", glyph: "text-primary-container", bar: "bg-primary-container", Icon: TrendingUp };
                    const Icon = tone.Icon;
                    return (
                      <div
                        key={`${insight.type}-${i}`}
                        className="relative pl-4 p-2.5 rounded-xl bg-surface-container-low overflow-hidden"
                      >
                        <span className={`absolute left-0 top-0 h-full w-1 ${tone.bar}`} />
                        <div className="flex items-start gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${tone.box}`}>
                            <Icon className={`w-3.5 h-3.5 ${tone.glyph}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold leading-tight text-on-surface">
                              {insight.title}
                            </p>
                            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5 line-clamp-2">
                              {insight.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    variant="ghost"
                    className="w-full text-[10px] font-black uppercase tracking-widest text-primary-container h-8 mt-1"
                    onClick={() => navigate("/insights")}
                  >
                    View All Insights
                  </Button>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-on-surface-variant">No insights available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin-only: Recent Activity */}
      {showAdminView && (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/40 overflow-hidden">
          <div className="p-6 pb-4 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-display text-lg font-bold text-on-surface">
                Recent Activity
              </h3>
              <p className="text-xs font-medium text-on-surface-variant mt-0.5">
                Latest transactions across all stores
              </p>
            </div>
            <button
              onClick={() => navigate("/transactions")}
              className="h-9 rounded-xl font-semibold text-primary-container hover:bg-primary-fixed px-3 text-sm inline-flex items-center gap-1"
            >
              View Transactions <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[880px]">
              <div className="px-6 pb-3 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_0.7fr_0.45fr_0.4fr_0.8fr] gap-3 items-center text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                <span>Store</span>
                <span>Transaction ID</span>
                <span>Date & Time</span>
                <span>Items</span>
                <span className="text-right">Status</span>
                <span className="text-right">Amount</span>
              </div>

              <div className="border-t border-outline-variant/40">
{recentTransactions.length > 0 ? (
                  recentTransactions.map((txn) => {
                    const txnDate = new Date(txn.datetime);

                    const storeMgr = managerForStore(txn.storeId);
                    return (
                      <div
                        key={txn.id}
                        className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_0.7fr_0.45fr_0.4fr_0.8fr] gap-3 items-center px-6 py-3.5 border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container-low/60 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">
                            {getStoreName(txn.storeId)}
                          </p>
                          <p className="text-xs font-medium text-on-surface-variant truncate">
                            {storeMgr?.name || "Store"}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-on-surface truncate">
                            TX-
                            {txn.id.length > 10
                              ? `${txn.id.slice(0, 9).toLowerCase()}…`
                              : txn.id.toLowerCase()}
                          </p>
                          <p className="text-xs font-medium text-on-surface-variant truncate">
                            {(txn.customer || "Walk-in")} · {txn.payment}
                          </p>
                        </div>
                        <div className="text-xs font-medium text-on-surface-variant">
                          <p className="truncate">
                            {txnDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                          <p className="truncate">
                            {txnDate.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-on-surface tabular-nums">
                            {txn.items.reduce((s, i) => s + i.qty, 0)}
                          </p>
                        </div>
                        <div className="flex justify-end">
                          <span className="group/status inline-flex items-center gap-1.5">
                            <span className="w-7 h-7 rounded-full bg-[#00A651] flex items-center justify-center shrink-0 transition-colors duration-200 group-hover/status:bg-[#008a43]">
                              <Check className="w-4 h-4 text-white" />
                            </span>
                            <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold text-[#00A651] opacity-0 group-hover/status:max-w-[5.5rem] group-hover/status:opacity-100 transition-all duration-200">
                              Completed
                            </span>
                          </span>
                        </div>
                        <p className="text-right text-sm font-semibold text-on-surface tabular-nums truncate">
                          {formatCurrency(txn.amount)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 px-6">
                    <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="w-7 h-7 text-primary" />
                    </div>
                    <p className="font-display text-lg font-bold text-on-surface">
                      No transactions yet
                    </p>
                    <p className="text-xs font-medium text-on-surface-variant mt-1">
                      Activity will appear here once sales are recorded.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
          </motion.div>
        )}
      </AnimatePresence>
    </Stagger>
  );
}
