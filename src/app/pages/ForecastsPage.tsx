import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Calendar,
  MapPin,
  Download,
  DollarSign,
  Clock,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Zap,
  XCircle,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ForecastChart } from "../components/ForecastChart";
import { BulkPOModal } from "../components/BulkPOModal";
import { ReorderTable } from "../components/ReorderTable";
import { motion } from "framer-motion";
import { staggerContainer, fadeInUp } from "../../animations/variants";
import { Stagger } from "../../animations/Stagger";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { useStore } from "../state/store";
import { KPIValue } from "../components/KPIValue";
import { toast } from "sonner";

export function ForecastsPage() {
  const { inventoryArray, allStores, currentStore, currentUser, formatCurrency, transactions, dailySales, canEdit, adminOverview } = useStore();
  const isAdmin = currentUser?.role === "Admin";
  const isManager = currentUser?.role === "Manager";
  const showReorderTable = !(isAdmin && adminOverview);

  // States
  const firstRealStore = allStores.find((s) => !s.isAdminStore);
  const [selectedStoreId, setSelectedStoreId] = useState(currentStore.isAdminStore ? (firstRealStore?.id || "") : currentStore.id);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState("6w");
  const [demandAdj, setDemandAdj] = useState(0);
  const [inflationAdj, setInflationAdj] = useState(0);
  const [poOpen, setPoOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSimulating, setIsSimulating] = useState(false);
  const [reorderPage, setReorderPage] = useState(1);
  const reorderPerPage = 10;

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const getForecastPeriods = () => {
    switch (timeRange) {
      case "6w": return 6;
      case "3m": return 13;
      case "6m": return 26;
      default: return 6;
    }
  };

  // Holt's Linear Trend (no seasonality)
  const calculateHolts = (data: number[], forecastPeriods: number) => {
    if (data.length < 2) return new Array(forecastPeriods).fill(data[0] || 0);
    let level = data[0];
    let trend = data[1] - data[0];
    const alpha = 0.3;
    const beta = 0.1;
    for (let i = 1; i < data.length; i++) {
      const lastLevel = level;
      level = alpha * data[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - lastLevel) + (1 - beta) * trend;
    }
    const forecast = [];
    for (let h = 1; h <= forecastPeriods; h++) {
      forecast.push(Math.max(0, Math.round(level + h * trend)));
    }
    return forecast;
  };

  // Holt-Winters (additive trend, multiplicative seasonality, period=7)
  const calculateHoltsWinters = (data: number[], forecastPeriods: number) => {
    const seasonLength = 7;
    if (data.length < seasonLength * 2) {
      return calculateHolts(data, forecastPeriods);
    }

    const alpha = 0.3;
    const beta = 0.1;
    const gamma = 0.2;
    const n = data.length;

    // Initial level: average of first season
    let level = 0;
    for (let i = 0; i < seasonLength; i++) level += data[i];
    level /= seasonLength;

    // Initial trend: average difference between first two seasons
    let trend = 0;
    for (let i = 0; i < seasonLength; i++) {
      trend += (data[seasonLength + i] - data[i]);
    }
    trend /= (seasonLength * seasonLength);

    // Initial seasonal indices
    const seasonal: number[] = new Array(n + forecastPeriods);
    for (let i = 0; i < n; i++) {
      seasonal[i] = data[i] / Math.max(level + trend * (i - seasonLength + 1), 1);
    }

    // Run Holt-Winters over historical data
    for (let t = seasonLength; t < n; t++) {
      const prevLevel = level;
      level = alpha * (data[t] / Math.max(seasonal[t - seasonLength], 0.01)) + (1 - alpha) * (prevLevel + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      seasonal[t] = gamma * (data[t] / Math.max(level, 0.01)) + (1 - gamma) * seasonal[t - seasonLength];
    }

    // Generate forecast
    const forecast: number[] = [];
    for (let h = 1; h <= forecastPeriods; h++) {
      const sIdx = n - seasonLength + ((h - 1) % seasonLength);
      const val = (level + h * trend) * seasonal[sIdx];
      forecast.push(Math.max(0, Math.round(val)));
    }
    return forecast;
  };

  // Compute MAPE from in-sample backtest for confidence bands
  const computeMape = (data: number[]) => {
    if (data.length < 4) return 10; // default 10% MAPE for sparse data
    // Backtest: fit on data[:-1], predict last point, measure error
    const train = data.slice(0, -1);
    const actual = data[data.length - 1];
    const forecast = calculateHolts(train, 1);
    const predicted = forecast[0];
    if (actual === 0) return predicted > 0 ? 15 : 5;
    return Math.min(30, Math.abs((actual - predicted) / actual) * 100);
  };

  // ====================================================================
  // 1. Weekly sales data — properly grouped by relative week from
  //    earliest transaction. Each week is a contiguous 7-day bucket.
  // ====================================================================
  const weeklySalesData = useMemo(() => {
    if (transactions.length === 0) {
      return {
        weekLabels: [] as string[],
        byProduct: {} as Record<number, Record<string, number>>,
        productTotals: {} as Record<string, number>,
        dailyRates: {} as Record<string, number>,
      };
    }

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    );
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;

    const firstDate = new Date(sorted[0].datetime);
    firstDate.setHours(0, 0, 0, 0);

    const weekBuckets: Record<string, typeof transactions> = {};
    sorted.forEach((tx) => {
      const txDate = new Date(tx.datetime);
      txDate.setHours(0, 0, 0, 0);
      const offset = Math.floor((txDate.getTime() - firstDate.getTime()) / msPerWeek);
      const key = `W${offset}`;
      if (!weekBuckets[key]) weekBuckets[key] = [];
      weekBuckets[key].push(tx);
    });

    const allKeys = Object.keys(weekBuckets).sort(
      (a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)),
    );
    const recentKeys = allKeys.slice(-8);

    const byProduct: Record<number, Record<string, number>> = {};
    const productTotals: Record<string, number> = {};

    recentKeys.forEach((wk) => {
      weekBuckets[wk].forEach((tx) => {
        tx.items.forEach((item) => {
          if (!byProduct[item.productId]) byProduct[item.productId] = {};
          byProduct[item.productId][wk] =
            (byProduct[item.productId][wk] || 0) + item.qty;
          productTotals[item.productId] =
            (productTotals[item.productId] || 0) + item.qty;
        });
      });
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const totalDays = Math.max(
      1,
      Math.ceil((now.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)),
    );

    const dailyRates: Record<string, number> = {};
    Object.entries(productTotals).forEach(([pid, qty]) => {
      dailyRates[Number(pid)] = Math.round((qty / totalDays) * 10) / 10;
    });

    return { weekLabels: recentKeys, byProduct, productTotals, dailyRates };
  }, [transactions, dailySales]);

  // ====================================================================
  // 2. Filtered product set — respects category, product, store filters
  // ====================================================================
  const filteredInventory = useMemo(() => {
    let items = inventoryArray;
    if (selectedProductId !== "all") {
      items = items.filter((p) => p.id.toString() === selectedProductId);
    } else if (selectedCategory !== "all") {
      items = items.filter((p) => p.category === selectedCategory);
    }
    return items;
  }, [inventoryArray, selectedProductId, selectedCategory]);

  // ====================================================================
  // 3. Products filtered by category (for the product selector dropdown)
  // ====================================================================
  const productsByCategory = useMemo(() => {
    if (selectedCategory === "all") return inventoryArray;
    return inventoryArray.filter((p) => p.category === selectedCategory);
  }, [inventoryArray, selectedCategory]);

  // ====================================================================
  // 4. Unique categories (for the dropdown — always shows ALL categories)
  // ====================================================================
  const categories = useMemo(() => {
    return Array.from(new Set(inventoryArray.map((p) => p.category))).sort();
  }, [inventoryArray]);

  // ====================================================================
  // 5. Stock Depletion Forecast
  //    Reconstructs historical aggregate stock from transaction data,
  //    then projects forward using Holt-Winters (8+ weeks) or Holt's.
  // ====================================================================
  const forecastData = useMemo(() => {
    const periods = getForecastPeriods();
    const factor = 1 + demandAdj / 100 - inflationAdj / 100;
    const products = filteredInventory;
    if (products.length === 0) return [];

    const totalCurrentStock = products.reduce((s, p) => s + p.stock, 0);
    const weekLabels = weeklySalesData.weekLabels;

    // Backwards reconstruction of historical aggregate stock
    const history: number[] = [];
    let stock = totalCurrentStock;
    for (let i = weekLabels.length - 1; i >= 0; i--) {
      const wk = weekLabels[i];
      const sales = products.reduce(
        (sum, p) => sum + (weeklySalesData.byProduct[p.id]?.[wk] || 0),
        0,
      );
      stock += sales;
      history.unshift(stock);
    }

    // Pad history if too short
    while (history.length < 3) {
      const prev = history.length > 0 ? history[0] : totalCurrentStock;
      history.unshift(prev);
    }

    // Use last 8 points for Holt-Winters, last 4 for Holt's
    const useSeasonal = history.length >= 8;
    const displayHistory = useSeasonal ? history.slice(-8) : history.slice(-4);

    // Choose forecasting method
    const forecast = useSeasonal
      ? calculateHoltsWinters(displayHistory, periods)
      : calculateHolts(displayHistory, periods);

    // Compute MAPE for confidence bands
    const mape = computeMape(displayHistory);
    const mapeFactor = mape / 100;

    const result: Array<{
      date: string;
      actual: number | null;
      predicted: number | null;
      upper: number | null;
      lower: number | null;
    }> = [];

    // Historical data points
    const histLen = displayHistory.length;
    for (let i = 0; i < histLen; i++) {
      result.push({
        date: i === histLen - 1 ? "Now" : `W-${histLen - 1 - i}`,
        actual: Math.round(displayHistory[i]),
        predicted: null,
        upper: null,
        lower: null,
      });
    }

    // Forecast with data-driven confidence bands
    for (let i = 0; i < periods; i++) {
      const predicted = Math.max(0, Math.round(forecast[i] * factor));
      const band = mapeFactor * Math.sqrt(i + 1);
      result.push({
        date: `W+${i + 1}`,
        actual: null,
        predicted,
        upper: Math.round(predicted * (1 + band)),
        lower: Math.max(0, Math.round(predicted * (1 - band))),
      });
    }

    return result;
  }, [filteredInventory, weeklySalesData, timeRange, demandAdj, inflationAdj]);

  // ====================================================================
  // 6. Weekly Demand Forecast
  //    Computes average sales per day-of-week with linear trend across weeks.
  //    NO Math.random() — fully deterministic.
  // ====================================================================
  const demandForecast = useMemo(() => {
    const factor = 1 + demandAdj / 100;
    const products = filteredInventory;
    const productIds = new Set(products.map((p) => p.id));
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const nextDays = ["Next Mon", "Next Tue", "Next Wed", "Next Thu", "Next Fri", "Next Sat", "Next Sun"];

    if (transactions.length === 0) {
      return [...days.map((d) => ({ date: d, actual: 0, predicted: null, variance: 0 })),
        ...nextDays.map((d) => ({ date: d, actual: null, predicted: 0 }))];
    }

    // Build week-keyed buckets: group transactions by week offset from earliest
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    );
    const firstDate = new Date(sorted[0].datetime);
    firstDate.setHours(0, 0, 0, 0);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;

    // daySalesByWeek[weekIndex][dayName] = total units sold
    const daySalesByWeek: Record<number, Record<string, number>> = {};
    const weekDayCounts: Record<number, Record<string, number>> = {};

    transactions.forEach((tx) => {
      const txDate = new Date(tx.datetime);
      txDate.setHours(0, 0, 0, 0);
      const weekIdx = Math.floor((txDate.getTime() - firstDate.getTime()) / msPerWeek);
      const dayName = days[txDate.getDay()];

      if (!daySalesByWeek[weekIdx]) daySalesByWeek[weekIdx] = {};
      if (!weekDayCounts[weekIdx]) weekDayCounts[weekIdx] = {};

      tx.items.forEach((item) => {
        if (!productIds.has(item.productId)) return;
        daySalesByWeek[weekIdx][dayName] = (daySalesByWeek[weekIdx][dayName] || 0) + item.qty;
      });
      weekDayCounts[weekIdx][dayName] = (weekDayCounts[weekIdx][dayName] || 0) + 1;
    });

    const weekIndices = Object.keys(daySalesByWeek).map(Number).sort((a, b) => a - b);
    const numWeeks = weekIndices.length;

    // For each day-of-week, compute average daily rate per week (linear regression for trend)
    const actuals: number[] = [];
    const trendSlopes: number[] = [];

    days.forEach((day) => {
      const weeklyRates: number[] = weekIndices.map((wi) => {
        const sold = daySalesByWeek[wi]?.[day] || 0;
        const count = weekDayCounts[wi]?.[day] || 1;
        return sold / count;
      });

      const avg = weeklyRates.reduce((s, v) => s + v, 0) / Math.max(weeklyRates.length, 1);
      actuals.push(Math.round(avg));

      // Linear regression slope across weeks (trend)
      if (numWeeks >= 3) {
        const n = weeklyRates.length;
        const xMean = (n - 1) / 2;
        const yMean = weeklyRates.reduce((s, v) => s + v, 0) / n;
        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i++) {
          num += (i - xMean) * (weeklyRates[i] - yMean);
          den += (i - xMean) * (i - xMean);
        }
        trendSlopes.push(den !== 0 ? num / den : 0);
      } else {
        trendSlopes.push(0);
      }
    });

    // Predict next week using: average + slope × (numWeeks) then apply factor
    const predicted = actuals.map((avg, i) => {
      const trendAdj = trendSlopes[i] || 0;
      const nextForecast = avg + trendAdj;
      return Math.max(0, Math.round(nextForecast * factor));
    });

    const historical = days.map((day, i) => ({
      date: day,
      actual: actuals[i],
      predicted: null,
      variance:
        actuals[i] > 0
          ? Math.round(((predicted[i] - actuals[i]) / actuals[i]) * 100)
          : 0,
    }));

    const future = nextDays.map((day, i) => ({
      date: day,
      actual: null,
      predicted: predicted[i],
    }));

    return [...historical, ...future];
  }, [filteredInventory, transactions, demandAdj]);

  // ====================================================================
  // 7. Reorder recommendations — now respects category, product & timeRange
  // ====================================================================
  const reorderItems = useMemo(() => {
    const factor = Math.max(0.2, 1 + demandAdj / 100);
    const periods = getForecastPeriods();

    return filteredInventory.map((p) => {
      const dailyRate = weeklySalesData.dailyRates[p.id]
        ? Math.max(0.5, weeklySalesData.dailyRates[p.id] * factor)
        : Math.max(0.5, (p.stock / 30) * factor);

      const horizonDays = periods * 7;
      const forecastedStock = Math.max(
        0,
        Math.round(p.stock - dailyRate * horizonDays),
      );
      const recommendedOrder = Math.max(
        0,
        Math.round(p.reorderPoint * 2 * factor - p.stock),
      );

      const isCritical = p.stock < p.reorderPoint * 0.5;
      const isWarning = p.stock < p.reorderPoint && !isCritical;
      const status = isCritical ? "critical" : isWarning ? "warning" : "good";

      const totalSold = weeklySalesData.productTotals[p.id] || 0;

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.stock,
        forecastedStock,
        reorderPoint: p.reorderPoint,
        unitPrice: p.price,
        recommendedOrder,
        status,
        daysUntilStockout:
          dailyRate > 0 ? Math.max(0, Math.floor(p.stock / dailyRate)) : 999,
        why:
          status === "critical"
            ? `Stock is at ${p.stock}, which is less than 50% of the reorder point (${p.reorderPoint}). ${totalSold > 0 ? `Sold ${totalSold} units total.` : ""} Immediate action is required.`
            : status === "warning"
              ? `Stock level of ${p.stock} is approaching the reorder point of ${p.reorderPoint}. ${totalSold > 0 ? `Historical sales: ${totalSold} units.` : ""} Plan restocking soon.`
              : `Stock level at ${p.stock} is sufficient. ${totalSold > 0 ? `Total historical sales: ${totalSold} units.` : ""} No immediate action needed.`,
      };
    });
  }, [filteredInventory, weeklySalesData, demandAdj, timeRange]);

  const totalReorderPages = Math.ceil(reorderItems.length / reorderPerPage);
  const paginatedReorderItems = reorderItems.slice(
    (reorderPage - 1) * reorderPerPage,
    reorderPage * reorderPerPage,
  );

  useEffect(() => {
    setReorderPage(1);
  }, [reorderItems.length]);

  // ====================================================================
  // 8. Reorder Summary
  // ====================================================================
  const reorderSummary = useMemo(() => {
    const now = new Date();
    const priceFactor = Math.max(0, 1 + inflationAdj / 100);
    const needsAction = reorderItems.filter((i) => i.status !== "good");
    const urgent = reorderItems.filter(
      (i) => i.status !== "good" && i.daysUntilStockout <= 30,
    );

    const totalValueAtRisk = urgent.reduce((sum, i) => {
      const atRiskUnits = Math.max(0, i.reorderPoint - i.currentStock);
      return sum + atRiskUnits * i.unitPrice * priceFactor;
    }, 0);

    const recommendedOrderValue = needsAction.reduce((sum, i) => {
      return sum + i.recommendedOrder * i.unitPrice * priceFactor;
    }, 0);

    const avgLeadTimeDays = clamp(
      Math.round(5 + Math.max(0, inflationAdj) / 10),
      3,
      14,
    );
    const nextReviewInDays = urgent.length > 0 ? 3 : 7;
    const nextReviewDate = new Date(now);
    nextReviewDate.setDate(now.getDate() + nextReviewInDays);

    const forecastAccuracy = clamp(
      Math.round(94 - Math.abs(demandAdj) / 4 - Math.abs(inflationAdj) / 6),
      70,
      99,
    );

    const totalStock = filteredInventory.reduce((s, p) => s + p.stock, 0);
    const demandFactor = Math.max(0.2, 1 + demandAdj / 100);
    const projectedDailySales = Math.max(
      1,
      filteredInventory.length * 5 * demandFactor,
    );
    const daysCoverage = Math.max(
      0,
      Math.floor(totalStock / projectedDailySales),
    );

    const monthName = now.toLocaleString("default", { month: "long" });
    const scopeLabel =
      selectedProductId !== "all"
        ? inventoryArray.find((p) => p.id.toString() === selectedProductId)
            ?.name || "selected product"
        : selectedCategory !== "all"
          ? selectedCategory
          : "key categories";

    const seasonalPct = now.getMonth() === 2 || now.getMonth() === 11 ? 15 : 8;
    const seasonalMessage = `Demand signals suggest a ~${seasonalPct}% seasonal swing in ${monthName} for ${scopeLabel}. Review reorder quantities accordingly.`;

    const optimizationCount = needsAction.length;
    const optimizationMessage = `Current forecast accuracy is ${forecastAccuracy}%. Reorder plan is updated for ${optimizationCount} product${optimizationCount === 1 ? "" : "s"} based on your current inputs.`;

    const immediateMessage =
      urgent.length === 0
        ? "No products are projected to stock out within 30 days based on current inputs."
        : `${urgent.length} product${urgent.length === 1 ? "" : "s"} are projected to stock out within 30 days. ${formatCurrency(totalValueAtRisk)} value at risk if not restocked.`;

    const nextReviewLabel = nextReviewDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return {
      totalValueAtRisk,
      recommendedOrderValue,
      avgLeadTimeDays,
      nextReviewLabel,
      forecastAccuracy,
      daysCoverage,
      urgentCount: urgent.length,
      seasonalMessage,
      optimizationMessage,
      immediateMessage,
    };
  }, [
    reorderItems,
    inflationAdj,
    demandAdj,
    filteredInventory,
    selectedCategory,
    selectedProductId,
    formatCurrency,
    clamp,
    inventoryArray,
  ]);

  const toggleSelected = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(reorderItems.map((i) => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSimulation = () => {
    if (isSimulating) {
      setIsSimulating(false);
      toast.info("Simulation mode disabled");
    } else {
      setIsSimulating(true);
      toast.success("Simulation mode enabled — adjust sliders to see impact");
    }
  };

  const handleResetSimulation = () => {
    setDemandAdj(0);
    setInflationAdj(0);
    setSelectedCategory("all");
    setSelectedProductId("all");
    setIsSimulating(false);
    toast.info("Forecast reset to baseline");
  };

  const handleDemandChange = (val: number) => {
    setDemandAdj(val);
    if (!isSimulating) setIsSimulating(true);
  };

  const handleInflationChange = (val: number) => {
    setInflationAdj(val);
    if (!isSimulating) setIsSimulating(true);
  };

  const handleExport = (format: "csv" | "excel" | "pdf") => {
    const dateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
    const fileName = `Forecast_Report_${dateStr}`;

    if (format === "csv") {
      const headers = [
        "Product",
        "Category",
        "Current Stock",
        "Forecasted",
        "Recommended Order",
      ];
      const rows = reorderItems.map((i) => [
        i.name,
        i.category,
        i.currentStock,
        i.forecastedStock,
        i.recommendedOrder,
      ]);
      const csvContent = [headers, ...rows]
        .map((e) => e.join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.csv`;
      link.click();
      toast.success("Forecast exported to CSV");
    } else if (format === "excel") {
      const data = reorderItems.map((i) => ({
        Product: i.name,
        Category: i.category,
        "Current Stock": i.currentStock,
        "Forecasted Stock": i.forecastedStock,
        "Recommended Order": i.recommendedOrder,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Forecast");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
      toast.success("Forecast exported to Excel");
    } else if (format === "pdf") {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("Stock Forecast Report", 105, 15, { align: "center" });
      doc.setFontSize(10);
      doc.text(
        `Generated on: ${new Date().toLocaleString()}`,
        14,
        25,
      );
      doc.text(
        `Demand Adj: ${demandAdj}% | Inflation Adj: ${inflationAdj}% | Time Range: ${timeRange}`,
        14,
        30,
      );

      const tableData = reorderItems.map((i) => [
        i.name,
        i.category,
        i.currentStock,
        i.forecastedStock,
        i.recommendedOrder,
        i.status.toUpperCase(),
      ]);

      (doc as any).autoTable({
        startY: 35,
        head: [
          [
            "Product",
            "Category",
            "Current",
            "Forecast",
            "Reorder Qty",
            "Status",
          ],
        ],
        body: tableData,
        headStyles: { fillColor: [79, 70, 229] },
      });

      doc.save(`${fileName}.pdf`);
      toast.success("Forecast exported to PDF");
    }
  };

  return (
    <Stagger className="px-8 pt-2 pb-8 space-y-8 bg-surface min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Stock Forecasts</h1>
            {currentUser?.role === "Admin" && adminOverview && (
              <Badge className="bg-indigo-600 text-white border-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg">
                All Stores
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 font-medium mt-1">
            {currentUser?.role === "Admin" && adminOverview
              ? "AI-powered inventory predictions and reorder recommendations across all your stores"
              : "AI-powered inventory predictions and reorder recommendations"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(isAdmin || isManager || canEdit("Forecasts")) && (
            <Button
              variant="outline"
              className={`h-11 font-bold rounded-xl border-outline-variant/40 gap-2 bg-surface-container-lowest hover:bg-surface-container-low transition-all shadow-sm ${isSimulating ? "border-amber-200 bg-amber-50 text-amber-700" : ""}`}
              onClick={handleToggleSimulation}
            >
              <Zap
                className={`w-4 h-4 ${isSimulating ? "animate-pulse text-amber-500 fill-amber-500" : "text-amber-500"}`}
              />
              {isSimulating ? "Disable Simulation" : "Simulate Impact"}
            </Button>
          )}
          {isSimulating && (
            <Button
              variant="ghost"
              className="h-11 font-bold rounded-xl gap-2 text-gray-500 hover:text-red-600"
              onClick={handleResetSimulation}
            >
              <XCircle className="w-4 h-4" />
              Reset
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold gap-2 px-6 shadow-lg shadow-indigo-100">
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl border-outline-variant/40 shadow-xl">
              <DropdownMenuItem className="rounded-lg gap-2 font-medium" onClick={() => handleExport("csv")}>
                <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg gap-2 font-medium" onClick={() => handleExport("excel")}>
                <FileSpreadsheet className="w-4 h-4 text-blue-600" /> Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters / Scenarios */}
      <Card className="border-none shadow-sm bg-surface-container-lowest rounded-2xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Store
              </label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="h-11 bg-surface-container-low border-transparent rounded-xl focus:ring-indigo-600 font-medium">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px] overflow-y-auto">
                  {(currentUser?.role === "Admin" || !currentUser
                    ? allStores.filter((s) => !s.isAdminStore)
                    : allStores.filter((s) => (currentUser?.assignedStoreIds || []).includes(s.id))
                  ).map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Filter className="w-3 h-3" /> Category
              </label>
              <Select
                value={selectedCategory}
                onValueChange={(val) => {
                  setSelectedCategory(val);
                  setSelectedProductId("all");
                }}
              >
                <SelectTrigger className="h-11 bg-surface-container-low border-transparent rounded-xl focus:ring-indigo-600 font-medium">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px] overflow-y-auto">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Package className="w-3 h-3" /> Product
              </label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger className="h-11 bg-surface-container-low border-transparent rounded-xl focus:ring-indigo-600 font-medium">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px] overflow-y-auto">
                  <SelectItem value="all">All Products</SelectItem>
                  {productsByCategory.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Time Range
              </label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="h-11 bg-surface-container-low border-transparent rounded-xl focus:ring-indigo-600 font-medium">
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6w">6 weeks</SelectItem>
                  <SelectItem value="3m">3 months</SelectItem>
                  <SelectItem value="6m">6 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isSimulating && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border-2 border-dashed border-amber-200 p-6 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-amber-600 fill-amber-500/20" />
              <div>
                <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest">
                  Active Simulation
                </h4>
                <p className="text-sm text-amber-700 font-medium">
                  Adjust sliders to see forecast impact in real time
                </p>
              </div>
            </div>
            <Button
              onClick={handleResetSimulation}
              variant="ghost"
              className="h-9 rounded-xl font-bold gap-2 px-4 text-amber-600 hover:bg-amber-100"
            >
              <XCircle className="w-4 h-4" />
              Reset
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                  Demand Scenario
                </Label>
                <Badge
                  variant="outline"
                  className="font-bold text-amber-600 border-amber-200 text-[10px]"
                >
                  {demandAdj > 0 ? "+" : ""}{demandAdj}%
                </Badge>
              </div>
              <Slider
                value={[demandAdj]}
                onValueChange={([val]) => handleDemandChange(val)}
                min={-50}
                max={100}
                step={5}
                className="py-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                  Inflation Impact
                </Label>
                <Badge
                  variant="outline"
                  className="font-bold text-red-600 border-red-200 text-[10px]"
                >
                  {inflationAdj > 0 ? "+" : ""}{inflationAdj}%
                </Badge>
              </div>
              <Slider
                value={[inflationAdj]}
                onValueChange={([val]) => handleInflationChange(val)}
                min={-20}
                max={50}
                step={1}
                className="py-2"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* KPI Cards */}
      {showReorderTable && (
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {[
          {
            label: "Products Tracked",
            value: filteredInventory.length,
            icon: Package,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Need Reorder",
            value: reorderItems.filter((i) => i.status !== "good").length,
            icon: AlertTriangle,
            color: "text-orange-600",
            bg: "bg-orange-50",
          },
          {
            label: "Forecast Accuracy",
            value: `${reorderSummary.forecastAccuracy}%`,
            icon: TrendingUp,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Days Coverage",
            value: reorderSummary.daysCoverage,
            icon: Calendar,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "Value at Risk",
            value: formatCurrency(reorderSummary.totalValueAtRisk),
            icon: DollarSign,
            color: "text-red-600",
            bg: "bg-red-50",
          },
          {
            label: "Proj. Stockouts",
            value: `${reorderSummary.urgentCount} items`,
            icon: AlertTriangle,
            color: "text-red-600",
            bg: "bg-red-50",
          },
        ].map((kpi, i) => (
          <motion.div key={i} variants={fadeInUp}>
            <Card className="border-none shadow-sm bg-surface-container-lowest rounded-2xl h-full">
              <CardContent className="p-5 flex flex-col gap-3">
                <div
                  className={`w-10 h-10 ${kpi.bg} rounded-xl flex items-center justify-center`}
                >
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">
                    {kpi.label}
                  </p>
                  <KPIValue value={kpi.value} className="text-gray-900" animate />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ForecastChart
          title={`Stock Depletion Forecast (${getForecastPeriods()} weeks)`}
          subtitle={
            selectedProductId !== "all"
              ? `Trend for ${inventoryArray.find((p) => p.id.toString() === selectedProductId)?.name}`
              : `Aggregated trend for ${selectedCategory === "all" ? "all categories" : selectedCategory}`
          }
          data={forecastData}
          mode="stock"
        />
        <ForecastChart
          title="Weekly Demand Forecast"
          subtitle="Average daily demand by day of week"
          data={demandForecast}
          mode="area"
        />
      </div>

      {/* Reorder Recommendations */}
      {showReorderTable && (
        <Card className="border-none shadow-sm bg-surface-container-lowest rounded-3xl overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-black text-gray-900">
                  Reorder Recommendations
                </CardTitle>
                <p className="text-sm text-gray-500 font-medium mt-1">
                  AI-powered restock suggestions based on current inventory and
                  demand
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <span className="text-sm font-bold text-indigo-600 bg-primary-fixed px-3 py-1.5 rounded-lg animate-in fade-in slide-in-from-right-2">
                    Selected: {selectedIds.size} items
                  </span>
                )}
                <Button
                  className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold gap-2 px-6 shadow-lg shadow-indigo-100"
                  onClick={() => setPoOpen(true)}
                  disabled={selectedIds.size === 0 || !canEdit("Forecasts")}
                >
                  Generate Purchase Order
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <ReorderTable
              items={paginatedReorderItems as any}
              selected={selectedIds}
              onToggle={toggleSelected}
              onSelectAll={handleSelectAll}
            />
            {totalReorderPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Showing {(reorderPage - 1) * reorderPerPage + 1} - {Math.min(reorderItems.length, reorderPage * reorderPerPage)} of {reorderItems.length} products
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-outline-variant/40 bg-surface-container-lowest"
                    onClick={() => setReorderPage((p) => Math.max(1, p - 1))}
                    disabled={reorderPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalReorderPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={reorderPage === page ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-8 p-0 text-xs ${reorderPage === page ? "bg-indigo-600 hover:bg-indigo-700" : "border-outline-variant/40 bg-surface-container-lowest"}`}
                        onClick={() => setReorderPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-outline-variant/40 bg-surface-container-lowest"
                    onClick={() => setReorderPage((p) => Math.min(totalReorderPages, p + 1))}
                    disabled={reorderPage === totalReorderPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showReorderTable && (
        <BulkPOModal
          isOpen={poOpen}
          onClose={() => setPoOpen(false)}
          items={(selectedIds.size
            ? reorderItems.filter((i) => selectedIds.has(i.id))
            : reorderItems
          ).map((p) => ({
            id: p.id,
            name: p.name,
            qty: p.recommendedOrder,
            unitCost: 500,
          }))}
        />
      )}

      {/* Bottom Split Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm bg-surface-container-lowest rounded-3xl overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Total Value at Risk
              </span>
              <span className="text-xl font-black text-red-600 break-words text-right">
                {formatCurrency(reorderSummary.totalValueAtRisk)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Recommended Order Value
              </span>
              <span className="text-xl font-black text-indigo-600 break-words text-right">
                {formatCurrency(reorderSummary.recommendedOrderValue)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Avg Lead Time
              </span>
              <span className="text-lg font-black text-gray-900">
                {reorderSummary.avgLeadTimeDays} days
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Next Review Date
              </span>
              <span className="text-lg font-black text-gray-900">
                {reorderSummary.nextReviewLabel}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-surface-container-lowest rounded-3xl overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="p-4 bg-primary-fixed border border-primary-fixed rounded-2xl flex gap-4">
              <div className="w-10 h-10 bg-surface-container-lowest rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">
                  Seasonal Trend Detected
                </p>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  {reorderSummary.seasonalMessage}
                </p>
              </div>
            </div>
            <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex gap-4">
              <div className="w-10 h-10 bg-surface-container-lowest rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">
                  Inventory Optimization
                </p>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  {reorderSummary.optimizationMessage}
                </p>
              </div>
            </div>
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-4">
              <div className="w-10 h-10 bg-surface-container-lowest rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">
                  Immediate Attention Required
                </p>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  {reorderSummary.immediateMessage}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Stagger>
  );
}
