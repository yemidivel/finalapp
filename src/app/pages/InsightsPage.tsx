import { useMemo, useState, useEffect, useRef, Fragment } from "react";
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight,
  Info,
  Users,
  DollarSign,
  TrendingDown,
  Tag,
  Package,
  LayoutDashboard,
  BarChart4,
  Star,
  Layers,
  ShieldAlert,
  Download,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  RefreshCcw,
  Minus,
  Building2,
  Store,
  Sparkles,
  Send,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { LiveDot } from "../components/LiveDot";
import { Stagger } from "../../animations/Stagger";
import { motion } from "framer-motion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useStore } from "../state/store";
import { useNavigate } from "react-router";
import { db, type DbInsightLine } from "../../lib/db";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { FileText, FileSpreadsheet } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

const COLORS = [
  "#8b5cf6",
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

// Presentation for the six AI insight themes. The card heading is the theme
// name itself (returned by the backend), so icon and accent key off it.
const THEME_META: Record<
  string,
  { Icon: typeof TrendingUp; bg: string; text: string }
> = {
  "Sales Momentum": { Icon: TrendingUp, bg: "bg-green-50", text: "text-green-600" },
  "Stockout Risk": { Icon: AlertTriangle, bg: "bg-red-50", text: "text-red-600" },
  "Dead Stock": { Icon: TrendingDown, bg: "bg-indigo-50", text: "text-indigo-600" },
  "Discount & Margin": { Icon: Tag, bg: "bg-amber-50", text: "text-amber-600" },
  "Basket & Cross-Sell": { Icon: Layers, bg: "bg-blue-50", text: "text-blue-600" },
  "Peak Demand": { Icon: Clock, bg: "bg-violet-50", text: "text-violet-600" },
};

// Fallback when the backend only sent the coarse enum `type`.
const TYPE_TO_THEME: Record<string, string> = {
  SALES_SPIKE: "Sales Momentum",
  STOCKOUT_RISK: "Stockout Risk",
  LOW_STOCK: "Stockout Risk",
  SLOW_MOVING: "Dead Stock",
  TREND_CHANGE: "Insight",
};

const themeMetaFor = (theme: string) =>
  THEME_META[theme] || {
    Icon: Info,
    bg: "bg-surface-container-low",
    text: "text-on-surface-variant",
  };

// Every number and bar animates off ONE shared clock so they rise together and
// land at their final figures at the same moment — same behaviour as the Top
// Stores graph on the admin dashboard.
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

// Horizontal progress fill driven by the same shared clock as the numbers and
// bars, so it always grows from zero on mount — including the leader row, whose
// fill is a full 100% (a width the framework's own tween would skip straight
// to its end).
function FillBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    tickerRestart();
    return tickerSubscribe(() => setWidth(pct * tickerEased));
  }, [pct]);

  return (
    <div
      className="h-full rounded-full"
      style={{ backgroundColor: color, width: `${width}%` }}
    />
  );
}

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

const BAR_CHART_H = 228;

// Legend chips for a bar chart — rendered up in the card header so the graph
// below has room to breathe.
function InsightLegend({
  data,
  colorOffset = 0,
}: {
  data: { name: string; value: number }[];
  colorOffset?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-wrap items-center justify-start gap-2.5">
      {data.map((d, i) => (
        <span
          key={d.name}
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low/60 pl-1.5 pr-3 py-1.5"
        >
          <span
            className="w-4 h-4 rounded-sm shrink-0"
            style={{
              backgroundColor: COLORS[(i + colorOffset) % COLORS.length],
            }}
          />
          <span className="text-xs font-semibold text-on-surface">
            {d.name}
          </span>
          <span className="text-[11px] font-medium text-on-surface-variant">
            {total > 0 ? Math.round((d.value / total) * 100) : 0}%
          </span>
        </span>
      ))}
    </div>
  );
}

// Amount-vs-bars graph: legend chips, a y-axis, and bars that grow to the
// height their amount maps to on the scale. Mirrors the Top Stores graph.
function InsightBarChart({
  data,
  formatCurrency,
  colorOffset = 0,
}: {
  data: { name: string; value: number }[];
  formatCurrency: (v: number) => string;
  colorOffset?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-outline-variant/60 rounded-2xl py-10">
        <p className="text-sm font-medium text-on-surface-variant">
          No sales data for this period.
        </p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const ticks = niceTicks(max);
  const axisMax = ticks[ticks.length - 1];

  return (
    <div className="flex flex-col flex-1 gap-4">
      <div className="mt-auto flex min-h-0">
        <div className="relative h-[240px] w-16 shrink-0">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-1 -translate-y-1/2 text-[10px] font-medium text-on-surface-variant tabular-nums"
              style={{ bottom: `${(t / axisMax) * BAR_CHART_H}px` }}
            >
              {formatAxisTick(t, "₦")}
            </span>
          ))}
        </div>
        <div
          className="relative h-[240px] flex-1 border-b-2"
          style={{ borderBottom: "2px solid rgb(var(--m3-on-surface))" }}
        >
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 border-t border-dashed border-outline-variant/60"
              style={{ bottom: `${(t / axisMax) * BAR_CHART_H}px` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end justify-start gap-3 pl-9 pr-1">
            {data.map((d, i) => {
              const barPx = Math.max(
                Math.round((d.value / axisMax) * BAR_CHART_H),
                0,
              );
              const color = COLORS[(i + colorOffset) % COLORS.length];
              return (
                <div
                  key={d.name}
                  className="w-16 h-full flex flex-col items-center justify-end"
                >
                  <motion.span
                    className="text-xs font-bold text-on-surface tabular-nums whitespace-nowrap mb-1.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  >
                    <AnimatedNumber
                      value={d.value}
                      formatter={formatCurrency}
                      decimals={0}
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
        {data.map((d) => (
          <div
            key={d.name}
            className="w-16 pl-4 text-left text-xs font-semibold text-on-surface-variant truncate"
          >
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsightsPage() {
  const {
    inventoryArray,
    dailySales,
    transactions,
    formatCurrency,
    currentUser,
    adminOverview,
    allStores,
    allTransactions,
    currentStore,
    users,
    refreshTransactions,
    refreshProducts,
    refreshAnalytics,
    refreshStoreInsight,
  } = useStore();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  // Real AI insights, fetched from the backend job that reads this store's
  // sales and inventory. Replaces the old client-side rule engine.
  const [aiInsights, setAiInsights] = useState<DbInsightLine[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiStatus, setAiStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [aiReloadKey, setAiReloadKey] = useState(0);

  // AI chatbot state.
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const isAdmin = currentUser?.role === "Admin";
  const showStoreSelector = isAdmin && adminOverview;
  const canUseAI = isAdmin || currentUser?.role === "Manager";
  const realStores = allStores.filter((s) => !s.isAdminStore);

  // The store every AI call is scoped to: the picked store for admins, the
  // signed-in user's own store otherwise.
  const targetStoreId = showStoreSelector ? selectedStoreId : currentStore?.id;

  useEffect(() => {
    if (!targetStoreId) {
      setAiInsights([]);
      setAiStatus("idle");
      return;
    }
    let cancelled = false;
    setAiStatus("loading");
    db.insights
      .fetch(targetStoreId, timeRange)
      .then((res) => {
        if (cancelled) return;
        setAiInsights(Array.isArray(res.insights) ? res.insights : []);
        setAiSummary(res.summary || "");
        setAiStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setAiInsights([]);
        setAiStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [targetStoreId, timeRange, aiReloadKey]);

  const refetchAIInsights = () => setAiReloadKey((k) => k + 1);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refreshTransactions(targetStoreId),
        refreshProducts(targetStoreId),
        refreshAnalytics(targetStoreId),
        refreshStoreInsight(targetStoreId),
      ]);
      setAiReloadKey((k) => k + 1);
      // Bump the key so every card remounts and replays its count-up / draw-in
      // animation from zero against the fresh numbers.
      setRefreshKey((k) => k + 1);
    } finally {
      window.setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleSendChat = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text || !targetStoreId || chatSending) return;
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatInput("");
    setChatSending(true);
    try {
      const res = await db.chat.send(targetStoreId, text);
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: res.reply || "I couldn't find an answer for that." },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setChatMessages((prev) => [...prev, { role: "ai", text: message }]);
    } finally {
      setChatSending(false);
    }
  };

  // Memoised so the chart data keeps a stable identity between renders. When
  // the Admin picks a store this array used to be rebuilt on every render,
  // which made Recharts treat each frame as a new dataset and cut the
  // draw-in short. The Manager path reads `transactions` directly and was
  // already stable, which is why its Revenue Trend animation played in full.
  const insightsTransactions = useMemo(() => {
    if (!showStoreSelector) return transactions;
    if (!selectedStoreId) return [];
    return allTransactions.filter((tx) => tx.storeId === selectedStoreId);
  }, [showStoreSelector, selectedStoreId, allTransactions, transactions]);

  const insightsInventory = useMemo(() => {
    if (!showStoreSelector || !selectedStoreId) return inventoryArray;
    const productIds = new Set<number>();
    allTransactions
      .filter((tx) => tx.storeId === selectedStoreId)
      .forEach((tx) => tx.items.forEach((item) => productIds.add(item.productId)));
    return inventoryArray.filter((item) => productIds.has(item.id));
  }, [showStoreSelector, selectedStoreId, allTransactions, inventoryArray]);

  const insightsDailySales = useMemo(() => {
    if (!showStoreSelector || !selectedStoreId) return dailySales;
    const sales: Record<string, number> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    allTransactions
      .filter((tx) => tx.storeId === selectedStoreId && new Date(tx.datetime) >= today)
      .forEach((tx) => {
        tx.items.forEach((item) => {
          sales[item.productId] = (sales[item.productId] || 0) + item.qty;
        });
      });
    return sales;
  }, [showStoreSelector, selectedStoreId, allTransactions, dailySales]);

  // Helper to filter transactions by time range
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (timeRange === "24h") {
      cutoff.setHours(now.getHours() - 24);
    } else if (timeRange === "7d") {
      cutoff.setDate(now.getDate() - 7);
    } else {
      cutoff.setDate(now.getDate() - 30);
    }
    return insightsTransactions.filter(
      (tx) => new Date(tx.datetime) >= cutoff,
    );
  }, [insightsTransactions, timeRange]);

  // 1. Calculate Sales by Category
  const categorySalesData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    filteredTransactions.forEach((tx) => {
      tx.items.forEach((item) => {
        const product = insightsInventory.find((p) => p.id === item.productId);
        const category = product?.category || "Uncategorized";
        categoryTotals[category] =
          (categoryTotals[category] || 0) + item.qty * item.price;
      });
    });

    const data = Object.entries(categoryTotals)
      .map(([name, revenue]) => ({
        name,
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    if (data.length === 0) {
      return [];
    }
    return data;
  }, [filteredTransactions, insightsInventory]);

  // 2. Dynamic Revenue Trend (range-aware: hourly / daily / weekly)
  const { revenueTrendData, revenueTrendLabel } = useMemo(() => {
    if (timeRange === "24h") {
      // Last 24 hours, bucketed by hour of day.
      const buckets: Record<number, number> = {};
      filteredTransactions.forEach((tx) => {
        const h = new Date(tx.datetime).getHours();
        buckets[h] = (buckets[h] || 0) + tx.amount;
      });
      return {
        revenueTrendData: Array.from({ length: 24 }, (_, h) => ({
          name: `${String(h).padStart(2, "0")}:00`,
          revenue: buckets[h] || 0,
        })),
        revenueTrendLabel: "Hourly sales — last 24 hours",
      };
    }

    if (timeRange === "7d") {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const totals: Record<string, number> = {};
      filteredTransactions.forEach((tx) => {
        const d = dayNames[new Date(tx.datetime).getDay()];
        totals[d] = (totals[d] || 0) + tx.amount;
      });
      return {
        revenueTrendData: dayNames.map((d) => ({
          name: d,
          revenue: totals[d] || 0,
        })),
        revenueTrendLabel: "Daily sales — last 7 days",
      };
    }

    // Last 30 days, split into 4 weeks, oldest first.
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const totals = [0, 0, 0, 0];
    filteredTransactions.forEach((tx) => {
      const idx = Math.min(
        3,
        Math.max(0, Math.floor((new Date(tx.datetime).getTime() - start.getTime()) / weekMs)),
      );
      totals[idx] += tx.amount;
    });
    return {
      revenueTrendData: totals.map((rev, i) => ({
        name: `Week ${i + 1}`,
        revenue: rev,
      })),
      revenueTrendLabel: "Weekly sales — last 30 days",
    };
  }, [filteredTransactions, timeRange]);

  // 3. Dynamic Customer Growth (Weekly)
  const { customerGrowthData, customerGrowthChange } = useMemo(() => {
    const weeklyUniqueCustomers: Record<string, Set<string>> = {};

    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.datetime);
      const weekNumber = Math.ceil(date.getDate() / 7);
      const weekLabel = `Week ${weekNumber}`;

      if (!weeklyUniqueCustomers[weekLabel]) {
        weeklyUniqueCustomers[weekLabel] = new Set();
      }
      if (tx.customer) {
        weeklyUniqueCustomers[weekLabel].add(tx.customer);
      } else {
        weeklyUniqueCustomers[weekLabel].add(tx.id);
      }
    });

    const data = Object.entries(weeklyUniqueCustomers)
      .map(([name, customers]) => ({
        name,
        users: customers.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    let change = 0;
    if (data.length >= 2) {
      const last = data[data.length - 1].users;
      const prev = data[data.length - 2].users;
      change = prev !== 0 ? Math.round(((last - prev) / prev) * 100) : 0;
    }

    return { customerGrowthData: data, customerGrowthChange: change };
  }, [filteredTransactions]);

  // 5. Product Performance Chart (Revenue per product)
  const productPerformanceData = useMemo(() => {
    const productRevenue: Record<string, number> = {};

    filteredTransactions.forEach((tx) => {
      tx.items.forEach((item) => {
        const product = insightsInventory.find((p) => p.id === item.productId);
        const name = product?.name || `Product ${item.productId}`;
        productRevenue[name] =
          (productRevenue[name] || 0) + item.qty * item.price;
      });
    });

    const data = Object.entries(productRevenue)
      .map(([name, revenue]) => ({
        name,
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    if (data.length === 0) {
      return [];
    }
    return data;
  }, [filteredTransactions, insightsInventory]);

  const dynamicInsights = useMemo(() => {
    const list: any[] = [];
    const now = Date.now();

    // Insights are computed from the live inventory/sales at render time, so
    // "now" is their honest timestamp. This used to walk backwards eight
    // minutes per card, which stamped real alerts with invented times and made
    // them read as a fake drip-feed.
    const buildTimestamp = () => new Date(now).toISOString();

    const formatRelativeTime = (value: string) => {
      const diffMinutes = Math.max(
        0,
        Math.floor((now - new Date(value).getTime()) / 60000),
      );
      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60)
        return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    };

    /**
     * Units sold per day for a product over the last 7 days, from real sales.
     *
     * This replaced a `Math.random()` generator. Every insight card carried a
     * sparkline that was pure decoration, yet it was drawn as a line chart
     * labelled like any other, so a real stock or sales alert was presented
     * alongside an invented history. A reader has no way to tell the two
     * apart, and the invented line was the thing that made the page look
     * authoritative while being unfounded.
     *
     * Returns undefined when there is no history to plot. The card then
     * renders without a sparkline (`{insight.trendData && ...}`) rather than
     * with a fabricated one — no data is better than made-up data.
     */
    const productTrend = (productId: string | number): { sales: number }[] | undefined => {
      const DAY = 24 * 60 * 60 * 1000;
      const days = new Array(7).fill(0);
      const cutoff = now - 7 * DAY;
      let total = 0;

      for (const tx of insightsTransactions) {
        const at = new Date(tx.datetime).getTime();
        if (Number.isNaN(at) || at < cutoff) continue;
        for (const item of tx.items) {
          if (String(item.productId) !== String(productId)) continue;
          const ago = Math.min(6, Math.floor((now - at) / DAY));
          days[6 - ago] += item.qty;
          total += item.qty;
        }
      }

      if (total === 0) return undefined;
      return days.map((units) => ({ sales: units }));
    };

    /** Store revenue per day for the last 7 days, for store-wide insights. */
    const storeTrend = (): { sales: number }[] | undefined => {
      const DAY = 24 * 60 * 60 * 1000;
      const days = new Array(7).fill(0);
      const cutoff = now - 7 * DAY;
      let total = 0;

      for (const tx of insightsTransactions) {
        const at = new Date(tx.datetime).getTime();
        if (Number.isNaN(at) || at < cutoff) continue;
        const ago = Math.min(6, Math.floor((now - at) / DAY));
        days[6 - ago] += tx.amount;
        total += tx.amount;
      }

      if (total === 0) return undefined;
      return days.map((units) => ({ sales: units }));
    };

    const pushInsight = (insight: any) => {
      list.push({ ...insight, timestampValue: buildTimestamp() });
    };

    insightsInventory.forEach((p) => {
      const soldToday = insightsDailySales[p.id] || 0;

      if (p.stock < p.reorderPoint) {
        pushInsight({
          id: `critical-${p.id}`,
          title: "Critical Stock Alert",
          type: "Stock Alert",
          product: p.name,
          message: `${p.name} critically low (${p.stock} units). Reorder soon to avoid a stockout.`,
          priority: "critical",
          category: ["alerts"],
          icon: ShieldAlert,
          action: "Reorder Now",
          trendData: productTrend(p.id),
          trendColor: "#ef4444",
        });
      } else if (p.stock < p.reorderPoint * 2) {
        pushInsight({
          id: `med-${p.id}`,
          title: "Medium Priority Stock Alert",
          type: "Stock Alert",
          product: p.name,
          message: `${p.name} stock level is ${p.stock}. Plan restocking soon to maintain optimal levels.`,
          priority: "medium",
          category: ["alerts"],
          icon: Info,
          action: "Reorder",
          trendData: productTrend(p.id),
          trendColor: "#f59e0b",
        });
      }

      if (soldToday === 0 && p.stock > 100) {
        pushInsight({
          id: `dead-${p.id}`,
          title: "Dead Stock Alert",
          type: "Stock Alert",
          product: p.name,
          message: `${p.name} (Stock: ${p.stock}) has not sold recently. Consider creating a promotion.`,
          priority: "recommendation",
          category: ["alerts"],
          icon: Package,
          action: "Create Promo",
          trendData: productTrend(p.id),
          trendColor: "#94a3b8",
        });
      }

      if (soldToday === 0 && p.stock > p.reorderPoint && p.stock < 100) {
        pushInsight({
          id: `discount-${p.id}`,
          title: "Discount Recommendation",
          type: "Pricing Insight",
          product: p.name,
          message: `No sales yet today for ${p.name}. Apply a small discount to boost movement.`,
          priority: "recommendation",
          category: ["pricing"],
          icon: Tag,
          action: "Create Discount",
          trendData: productTrend(p.id),
          trendColor: "#3b82f6",
        });
      }

      if (soldToday > 0 && soldToday < 3) {
        pushInsight({
          id: `slow-${p.id}`,
          title: "Slow-Moving Product Alert",
          type: "Stock Alert",
          product: p.name,
          message: `${p.name} sold only ${soldToday} units today. Consider bundling or promotion.`,
          priority: "recommendation",
          category: ["alerts", "pricing"],
          icon: Clock,
          action: "Create Bundle",
          trendData: productTrend(p.id),
          trendColor: "#f59e0b",
        });
      }

      if (soldToday > 15) {
        pushInsight({
          id: `top-${p.id}`,
          title: "Top Performer Highlight",
          type: "Pricing Insight",
          product: p.name,
          message: `${p.name} is a top seller today and stock is dropping fast. Increase safety stock?`,
          priority: "opportunity",
          category: ["pricing"],
          icon: Star,
          action: "Adjust Reorder",
          trendData: productTrend(p.id),
          trendColor: "#10b981",
        });
      }

      if (p.stock > 250) {
        pushInsight({
          id: `overstock-${p.id}`,
          title: "Overstock Alert",
          type: "Stock Alert",
          product: p.name,
          message: `${p.name} (${p.stock} units) is heavily stocked. Consider a promo to improve turnover.`,
          priority: "high",
          category: ["alerts"],
          icon: Layers,
          action: "Create Promo",
          trendData: productTrend(p.id),
          trendColor: "#f59e0b",
        });
      }
    });

    // A previously hardcoded "Seasonal Trend Alert" about "Pain Relief Tablets"
    // was removed. It was not derived from anything: it asserted that demand
    // for a product was trending upward regardless of whether the store even
    // stocked it, let alone whether it had sold. Every other card on this page
    // is computed from real stock and sales, and this one was not — so it was
    // a confident claim about a made-up trend sitting in the same list as real
    // alerts. It has no honest version without an actual forecasting source.

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const today = new Date();

    insightsInventory.forEach((p) => {
      if (!p.expiryDate) return;

      const expiry = new Date(p.expiryDate);
      if (expiry < today) {
        pushInsight({
          id: `expired-${p.id}`,
          title: "Product Expired",
          type: "Expiry Alert",
          product: p.name,
          message: `${p.name} expired on ${expiry.toLocaleDateString()}. Remove from shelf immediately.`,
          priority: "critical",
          category: ["alerts"],
          icon: ShieldAlert,
          action: "Remove Item",
          trendData: productTrend(p.id),
          trendColor: "#ef4444",
        });
      } else if (expiry <= thirtyDaysFromNow) {
        pushInsight({
          id: `expiring-${p.id}`,
          title: "Expiring Soon",
          type: "Expiry Alert",
          product: p.name,
          message: `${p.name} expires in ${Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} days. Review stock level (${p.stock}).`,
          priority: "high",
          category: ["alerts"],
          icon: Clock,
          action: "Markdown",
          trendData: productTrend(p.id),
          trendColor: "#f59e0b",
        });
      }
    });

    return list
      .filter(
        (insight) =>
          (now - new Date(insight.timestampValue).getTime()) /
            (1000 * 60 * 60) <=
          6,
      )
      .sort(
        (a, b) =>
          new Date(b.timestampValue).getTime() -
          new Date(a.timestampValue).getTime(),
      )
      .slice(0, 20)
      .map(({ timestampValue, ...insight }) => ({
        ...insight,
        timestamp: formatRelativeTime(timestampValue),
      }));
  }, [insightsInventory, insightsDailySales]);

  // TOP STAFF RANKING LOGIC (respects the selected 24h / 7d / 30d window).
  // For each cashier we total their completed takings, count their baskets, and
  // derive an average scanning velocity (seconds per basket) from the time
  // between consecutive sales, ignoring gaps over 30 minutes as idle time.
  const topStaffData = useMemo(() => {
    const byCashier: Record<
      string,
      { revenue: number; count: number; times: number[] }
    > = {};

    filteredTransactions.forEach((tx) => {
      if (tx.status === "Completed" && tx.cashier) {
        const entry =
          byCashier[tx.cashier] || { revenue: 0, count: 0, times: [] };
        entry.revenue += tx.amount;
        entry.count += 1;
        entry.times.push(new Date(tx.datetime).getTime());
        byCashier[tx.cashier] = entry;
      }
    });

    return Object.entries(byCashier)
      .map(([cashier, s]) => {
        s.times.sort((a, b) => a - b);
        const gaps: number[] = [];
        for (let i = 1; i < s.times.length; i++) {
          const gap = (s.times[i] - s.times[i - 1]) / 1000;
          if (gap > 0 && gap <= 1800) gaps.push(gap);
        }
        const velocity = gaps.length
          ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
          : null;
        const staff = users.find(
          (u) => u.id === cashier || u.name === cashier,
        );
        return {
          name: cashier,
          clerkId: staff?.id ?? cashier,
          clerkName: staff?.name ?? cashier,
          revenue: s.revenue,
          count: s.count,
          velocity,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
  }, [filteredTransactions, users]);

  const topProductsData = useMemo(() => {
    const productSales: Record<string, number> = {};
    filteredTransactions.forEach((tx) => {
      tx.items.forEach((item) => {
        productSales[item.productId] =
          (productSales[item.productId] || 0) + item.qty;
      });
    });

    return insightsInventory
      .map((p) => ({
        id: p.id,
        name: p.name,
        sold: productSales[p.id] || 0,
      }))
      .filter((p) => p.sold > 0)
      .sort((a, b) => {
        if (b.sold !== a.sold) {
          return b.sold - a.sold;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, 5);
  }, [insightsInventory, filteredTransactions]);

  const handleExport = (format: "csv" | "excel" | "pdf") => {
    const dateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
    const rangeLabel =
      timeRange === "24h"
        ? "Last_24_Hours"
        : timeRange === "7d"
          ? "Last_7_Days"
          : "Last_30_Days";
    const fileName = `Insights_${rangeLabel}_${dateStr}`;

    const exportData = dynamicInsights.map((i) => ({
      Priority: i.priority,
      Type: i.type,
      Product: i.product,
      Message: i.message,
      Time: i.timestamp,
    }));

    if (format === "csv") {
      const headers = ["Priority", "Type", "Product", "Message", "Time"];
      const rows = exportData.map((i) => [
        i.Priority,
        i.Type,
        i.Product,
        `"${i.Message.replace(/"/g, '""')}"`,
        i.Time,
      ]);
      const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.csv`;
      link.click();
      toast.success("Insights exported to CSV");
    } else if (format === "excel") {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Insights");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
      toast.success("Insights exported to Excel");
    } else if (format === "pdf") {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(
        `Insights Analysis - ${rangeLabel.replace(/_/g, " ")}`,
        105,
        15,
        { align: "center" },
      );
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 25);

      const tableData = exportData.map((i) => [
        i.Priority.toUpperCase(),
        i.Type,
        i.Product,
        i.Message,
        i.Time,
      ]);

      (doc as any).autoTable({
        startY: 30,
        head: [["Priority", "Type", "Product", "Message", "Time"]],
        body: tableData,
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: { 3: { cellWidth: 80 } },
      });

      doc.save(`${fileName}.pdf`);
      toast.success("Insights exported to PDF");
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            CRITICAL
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
            HIGH
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
            MEDIUM
          </Badge>
        );
      case "recommendation":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            RECOMMENDATION
          </Badge>
        );
      case "opportunity":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            OPPORTUNITY
          </Badge>
        );
      case "insight":
        return (
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">
            INSIGHT
          </Badge>
        );
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const filterInsights = (category: string) => {
    let list = dynamicInsights;
    if (category !== "all") {
      list = list.filter((i) => i.category.includes(category));
    }
    return list;
  };

  const [activeTab, setActiveTab] = useState("all");
  const [visibleCount, setVisibleCount] = useState({
    all: 3,
    alerts: 3,
    pricing: 3,
  });

  const handleShowMore = (tab: string) => {
    setVisibleCount((prev) => ({
      ...prev,
      [tab]: prev[tab as keyof typeof prev] + 3,
    }));
  };

  const handleShowLess = (tab: string) => {
    setVisibleCount((prev) => ({
      ...prev,
      [tab]: Math.max(3, prev[tab as keyof typeof prev] - 3),
    }));
  };

  const handleViewAll = (tab: string, total: number) => {
    setVisibleCount((prev) => ({
      ...prev,
      [tab]: total,
    }));
  };

  const hasStoreSelected = !showStoreSelector || selectedStoreId;
  const noStores = showStoreSelector && realStores.length === 0;

  return (
    <Stagger className="px-6 pt-2 pb-8 space-y-8 bg-surface min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">AI Insights</h1>
            <LiveDot size="h-4 w-4" />
          </div>
          <p className="text-sm text-gray-500">
            {showStoreSelector
              ? "Select a store to view insights and analytics"
              : "Store intelligence: recommendations and alerts based on real-time data"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {showStoreSelector && (
            <Select
              value={selectedStoreId}
              onValueChange={setSelectedStoreId}
            >
              <SelectTrigger className="w-[200px] bg-surface-container-lowest border-outline-variant/40">
                <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Select a Store" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {realStores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant hover:text-primary hover:bg-surface-container shadow-sm transition-all"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh insights"
          >
            <RefreshCcw
              className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {noStores ? (
        <Card className="border-none shadow-sm bg-surface-container-lowest rounded-[2rem]">
          <CardContent className="p-16 text-center">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No stores created yet</h3>
            <p className="text-sm text-gray-500">
              Create a store first to view insights and analytics.
            </p>
          </CardContent>
        </Card>
      ) : !hasStoreSelected ? (
        <Card className="border-none shadow-sm bg-surface-container-lowest rounded-[2rem]">
          <CardContent className="p-16 text-center">
            <div className="w-16 h-16 bg-primary-fixed rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-indigo-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Select a Store</h3>
            <p className="text-sm text-gray-500">
              Choose a store from the dropdown above to view its insights and analytics.
            </p>
          </CardContent>
        </Card>
      ) : (
      <Fragment key={`${refreshKey}-${targetStoreId}`}>
      {/* 0. AI Assistant — available on both tabs for Admin / Manager */}
      {canUseAI && (
        <Card className="border-outline-variant/40 shadow-sm bg-surface-container-lowest overflow-hidden mb-8">
          <CardHeader className="pb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-900">
                  Ask SellSync AI
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Ask about sales, stock, staff or trends for this store.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-72 overflow-y-auto space-y-3 mb-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {[
                    "How were sales today?",
                    "What should I restock?",
                    "Who is my top cashier this week?",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setChatInput(q)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-outline-variant/50 bg-surface-container-low hover:bg-primary-fixed text-on-surface-variant transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-surface-container-low text-on-surface rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {chatSending && (
                <div className="flex justify-start">
                  <div className="bg-surface-container-low rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleSendChat} className="flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question about this store..."
                className="flex-1 h-11 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-sm outline-none focus:border-indigo-400"
              />
              <Button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 1. Insights Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 bg-surface-container-lowest border border-outline-variant/40 p-1 h-11 shadow-sm">
          <TabsTrigger
            value="all"
            className="px-8 h-9 data-[state=active]:bg-primary-fixed data-[state=active]:text-indigo-700"
          >
            All metrics
          </TabsTrigger>
          <TabsTrigger
            value="alerts-pricing"
            className="px-8 h-9 data-[state=active]:bg-primary-fixed data-[state=active]:text-indigo-700"
          >
            Alerts & Pricing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-8">

      {/* 2. Top 5 Selling Products + Revenue Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-outline-variant/40 shadow-sm bg-surface-container-lowest overflow-hidden">
        <CardHeader className="pb-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900">
                  Top 5 Selling Products
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Units sold in the last{" "}
                  {timeRange === "24h"
                    ? "24 hours"
                    : timeRange === "7d"
                      ? "7 days"
                      : "30 days"}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-surface-container-lowest border-outline-variant/40 gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Export Analytics
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="rounded-2xl border-none shadow-2xl"
              >
                <DropdownMenuItem
                  onClick={() => handleExport("csv")}
                  className="gap-2 font-medium"
                >
                  <FileText className="w-4 h-4 text-gray-400" /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("excel")}
                  className="gap-2 font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-500" /> Export
                  Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-1">
          {topProductsData.length > 0 ? (
            <div className="divide-y divide-outline-variant/30">
              {topProductsData.map((p, index) => {
                const maxSold = topProductsData[0]?.sold || 1;
                return (
                  <div key={p.id} className="flex items-center gap-4 py-3">
                    <span className="w-7 h-7 rounded-full bg-surface-container-low text-gray-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {p.name}
                      </p>
                      <div className="mt-1.5 h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                        <FillBar
                          pct={Math.max((p.sold / maxSold) * 100, 4)}
                          color={COLORS[index % COLORS.length]}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        <AnimatedNumber
                          value={p.sold}
                          formatter={(v) => v.toLocaleString()}
                        />
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                        units sold
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-outline-variant/60 rounded-2xl py-10">
              <Package className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm font-medium text-on-surface-variant">
                No sales in this period.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Trend Card. Keyed by range so switching 24h/7d/30d remounts the
          chart and its draw-in replays from zero, exactly as it does on first
          entering the tab — for admins as well as managers. */}
      <Card
        key={`revenue-trend-${timeRange}`}
        className="border-outline-variant/40 shadow-sm bg-surface-container-lowest flex flex-col"
      >
        <CardHeader className="pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-bold text-gray-900">
                Revenue Trend
              </CardTitle>
              <p className="text-sm text-gray-500">{revenueTrendLabel}</p>
            </div>
            <Badge className="bg-green-50 text-green-700 border-green-100 shrink-0">
              Rising
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-2 min-h-[260px]">
          <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData} animationDuration={COUNT_DURATION} animationEasing="ease-out">
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f3f4f6"
                />
                <XAxis
                  dataKey="name"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  interval={timeRange === "24h" ? 2 : 0}
                  padding={{ left: 24, right: 24 }}
                />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₦${val}`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: number) => [
                    `₦${value.toLocaleString()}`,
                    "Revenue",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  isAnimationActive
                  animationDuration={COUNT_DURATION}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
        <div className="px-6 py-3 bg-surface-container-low/50 border-t border-outline-variant/40 flex justify-between items-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Synced with POS
          </span>
        </div>
      </Card>
      </div>

      {/* 3. Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Performance Card */}
        <Card className="border-outline-variant/40 shadow-sm bg-surface-container-lowest flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                  <BarChart4 className="w-5 h-5 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Product Performance
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Revenue generated per product
                  </p>
                </div>
              </div>
              <Badge className="bg-orange-50 text-orange-700 border-orange-100 shrink-0">
                Top Performers
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 pt-4">
            <InsightLegend
              data={productPerformanceData.map((d) => ({
                name: d.name,
                value: d.revenue,
              }))}
              colorOffset={3}
            />
            <div className="mt-4 flex flex-col flex-1">
              <InsightBarChart
                data={productPerformanceData.map((d) => ({
                  name: d.name,
                  value: d.revenue,
                }))}
                formatCurrency={formatCurrency}
                colorOffset={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sales by Category Card */}
        <Card className="border-outline-variant/40 shadow-sm bg-surface-container-lowest flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center shrink-0">
                  <LayoutDashboard className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Sales by Category
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Revenue distribution by category
                  </p>
                </div>
              </div>
              <Badge className="bg-primary-fixed text-indigo-700 border-primary-fixed shrink-0">
                Market Mix
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 pt-4">
            <InsightLegend
              data={categorySalesData.slice(0, 6).map((d) => ({
                name: d.name,
                value: d.revenue,
              }))}
            />
            <div className="mt-4 flex flex-col flex-1">
              <InsightBarChart
                data={categorySalesData.slice(0, 6).map((d) => ({
                  name: d.name,
                  value: d.revenue,
                }))}
                formatCurrency={formatCurrency}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Performance Insights */}
      {topStaffData.length > 0 && (
        <Card className="border-outline-variant/40 shadow-sm bg-surface-container-lowest rounded-[2rem] overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-surface-container-high rounded-2xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-on-surface">
                  Top Performing Staff
                </h3>
                <p className="text-on-surface-variant text-sm font-medium">
                  Clerk, gross handled and scanning velocity for the last{" "}
                  {timeRange === "24h"
                    ? "24 hours"
                    : timeRange === "7d"
                      ? "7 days"
                      : "30 days"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topStaffData.map((staff, i) => (
                <div
                  key={staff.name}
                  className="bg-surface-container rounded-2xl p-5 border border-outline-variant/40 flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-black text-sm shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                        Clerk Name
                      </p>
                      <p className="font-bold truncate text-on-surface">
                        {staff.clerkName}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                      Gross Handled
                    </p>
                    <p className="text-xl font-black text-on-surface">
                      {formatCurrency(staff.revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                      Avg. Scanning Velocity
                    </p>
                    <p className="font-bold text-on-surface">
                      {staff.velocity ? `${staff.velocity}s / basket` : "—"}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      {staff.count} transaction{staff.count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="alerts-pricing" className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" /> AI Insights
              </h3>
              <p className="text-sm text-gray-500">
                Six analyses generated from this store's live sales and
                inventory.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={refetchAIInsights}
              className="gap-2 shadow-sm"
            >
              <RefreshCcw className="w-4 h-4" /> Refresh
            </Button>
          </div>
          <AIInsightCards
            insights={aiInsights}
            status={aiStatus}
            summary={aiSummary}
            onRetry={refetchAIInsights}
          />
        </TabsContent>
      </Tabs>
      </Fragment>
      )}
    </Stagger>
  );

  function AIInsightCards({
    insights,
    status,
    summary,
    onRetry,
  }: {
    insights: DbInsightLine[];
    status: "idle" | "loading" | "ready" | "error";
    summary?: string;
    onRetry: () => void;
  }) {
    if (status === "loading" || status === "idle") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="border-outline-variant/40 bg-surface-container-lowest"
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-low animate-pulse" />
                  <div className="h-4 w-32 rounded bg-surface-container-low animate-pulse" />
                </div>
                <div className="h-3 w-full rounded bg-surface-container-low animate-pulse mb-2" />
                <div className="h-3 w-5/6 rounded bg-surface-container-low animate-pulse mb-2" />
                <div className="h-3 w-2/3 rounded bg-surface-container-low animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (status === "error" || insights.length === 0) {
      return (
        <div className="text-center py-16 bg-surface-container-lowest border-2 border-dashed border-outline-variant/40 rounded-2xl">
          <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {status === "error"
              ? "Couldn't load AI insights"
              : "No insights yet"}
          </h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-5">
            {status === "error"
              ? "The insight service is unavailable right now. Please try again."
              : "We haven't generated insights for this store yet. Record a sale and check back, or refresh."}
          </p>
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {summary && (
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-primary-fixed/40 p-4">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-sm text-indigo-900/80 leading-relaxed">
              {summary}
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insights.map((insight, i) => {
            const theme = insight.theme || TYPE_TO_THEME[insight.type] || "Insight";
            const meta = themeMetaFor(theme);
            const Icon = meta.Icon;
            return (
              <Card
                key={`${insight.type}-${i}`}
                className="border-outline-variant/40 bg-surface-container-lowest shadow-sm hover:shadow-lg transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-11 h-11 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={`w-6 h-6 ${meta.text}`} />
                    </div>
                    <h4 className="font-black text-lg tracking-tight text-gray-900 uppercase">
                      {theme}
                    </h4>
                  </div>
                  <p className="font-bold text-gray-900 mb-2 leading-snug">
                    {insight.title}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {insight.detail}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  function InsightList({
    items,
    totalItems,
    onShowMore,
    onShowLess,
    onViewAll,
    navigate,
  }: {
    items: any[];
    totalItems: number;
    onShowMore: () => void;
    onShowLess: () => void;
    onViewAll: () => void;
    navigate: any;
  }) {
    if (items.length === 0 && totalItems === 0) {
      return (
        <div className="text-center py-16 bg-surface-container-lowest border-2 border-dashed border-outline-variant/40 rounded-2xl">
          <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            No active insights
          </h3>
          <p className="text-gray-500 max-w-xs mx-auto">
            We couldn't find any insights in this category at the moment.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((insight) => {
            const Icon = insight.icon;
            return (
              <Card
                key={insight.id}
                className="shadow-sm border-outline-variant/40 bg-surface-container-lowest hover:border-indigo-400 hover:shadow-lg transition-all duration-300 group overflow-hidden"
              >
                <div className="h-1 bg-transparent group-hover:bg-primary-fixed0 transition-colors" />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center flex-shrink-0 group-hover:bg-primary-fixed transition-colors shadow-inner">
                      <Icon className="w-6 h-6 text-gray-500 group-hover:text-indigo-600 transition-colors" />
                    </div>
                    {getPriorityBadge(insight.priority)}
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="font-bold text-base text-gray-900 leading-tight group-hover:text-indigo-700 transition-colors">
                        {insight.title}
                      </h4>
                      {insight.trendData && (
                        <div className="h-[40px] w-[90px] flex-shrink-0 bg-surface-container-low/50 rounded-lg p-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={insight.trendData}>
                              <Line
                                type="monotone"
                                dataKey="sales"
                                stroke={insight.trendColor}
                                strokeWidth={3}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 leading-relaxed min-h-[40px]">
                      {insight.message}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-outline-variant/40">
                      <span className="text-xs text-gray-400 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5" /> {insight.timestamp}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-primary-fixed p-0 px-3 font-bold gap-1 transition-all"
                        onClick={() =>
                          navigate(
                            insight.action.includes("Reorder")
                              ? "/inventory"
                              : "/products",
                          )
                        }
                      >
                        {insight.action}{" "}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {totalItems > items.length ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex items-center gap-4">
              <Button
                onClick={onShowMore}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-10 h-12 font-black text-xs shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                Show More Insights
              </Button>
              {items.length > 3 && (
                <Button
                  onClick={onShowLess}
                  variant="outline"
                  className="border-indigo-600 text-indigo-600 hover:bg-primary-fixed rounded-xl px-10 h-12 font-black text-xs transition-all active:scale-95 flex items-center gap-2"
                >
                  <Minus className="w-4 h-4" />
                  Show Less
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={onViewAll}
              className="text-indigo-600 hover:text-indigo-700 font-bold text-sm"
            >
              View All {totalItems} Insights
            </Button>
          </div>
        ) : (
          totalItems > 0 && (
            <div className="flex flex-col items-center gap-4 py-8">
              {items.length > 3 && (
                <Button
                  onClick={onShowLess}
                  variant="outline"
                  className="border-indigo-600 text-indigo-600 hover:bg-primary-fixed rounded-xl px-10 h-12 font-black text-xs transition-all active:scale-95 flex items-center gap-2"
                >
                  <Minus className="w-4 h-4" />
                  Show Less
                </Button>
              )}
              <div className="text-center py-4">
                <Badge
                  variant="outline"
                  className="px-4 py-2 rounded-full border-outline-variant/40 text-gray-400 font-bold text-[10px] uppercase tracking-widest"
                >
                  All insights loaded
                </Badge>
              </div>
            </div>
          )
        )}
      </div>
    );
  }
}
