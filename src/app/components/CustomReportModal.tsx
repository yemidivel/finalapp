import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Progress } from "./ui/progress";
import { Download, FileText, FileSpreadsheet, Loader2, Sparkles, Mail, CheckCircle2, MessageSquare, Building2, Store } from "lucide-react";
import { toast } from "sonner";
import { EmailShareModal } from "./EmailShareModal";
import { SMSShareModal } from "./SMSShareModal";
import { useStore, Transaction, InventoryItem } from "../state/store";
import * as XLSX from "xlsx";

type CustomReportModalProps = {
  open: boolean;
  onClose: () => void;
};

const sanitizeSheetName = (name: string): string => {
  return name.replace(/[\\/*?:\[\]]/g, "").trim().slice(0, 31);
};

const groupTransactionsByStore = (transactions: Transaction[]): Map<string, Transaction[]> => {
  const map = new Map<string, Transaction[]>();
  transactions.forEach((tx) => {
    const arr = map.get(tx.storeId) || [];
    arr.push(tx);
    map.set(tx.storeId, arr);
  });
  return map;
};

export function CustomReportModal({ open, onClose }: CustomReportModalProps) {
  const {
    transactions,
    inventoryArray,
    allTransactions,
    allInventory,
    allStores,
    currency,
    formatCurrency,
    currentStore,
    adminOverview,
    currentUser,
  } = useStore();

  const isAdmin = currentUser?.role === "Admin";
  const isAdminAllStores = isAdmin && adminOverview;

  const [reportType, setReportType] = useState("sales");
  const [timePeriod, setTimePeriod] = useState("30d");
  const [format, setFormat] = useState("excel");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "Revenue", "Units Sold", "Top Products", "Stock Levels", "Category Breakdown", "Tax Summary"
  ]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reportReady, setReportReady] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<{ blob: Blob; name: string; type: string } | null>(null);

  const realStores = useMemo(
    () => allStores.filter((s) => !s.isAdminStore),
    [allStores]
  );

  useEffect(() => {
    if (isAdminAllStores && realStores.length > 0 && selectedStoreId === "all") {
      // keep "all" as default
    }
  }, [isAdminAllStores, realStores, selectedStoreId]);

  const storeMap = useMemo(() => {
    if (!isAdminAllStores) return undefined;
    const map = new Map<string, string>();
    realStores.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [isAdminAllStores, realStores]);

  const inventoryByStore = useMemo(() => {
    if (!isAdminAllStores || !storeMap) return undefined;
    const map = new Map<string, InventoryItem[]>();
    const productIdsByStore = new Map<string, Set<number>>();
    allTransactions.forEach((tx) => {
      const set = productIdsByStore.get(tx.storeId) || new Set();
      tx.items.forEach((item) => set.add(item.productId));
      productIdsByStore.set(tx.storeId, set);
    });
    storeMap.forEach((_, storeId) => {
      const productIds = productIdsByStore.get(storeId) || new Set();
      map.set(storeId, inventoryArray.filter((item) => productIds.has(item.id)));
    });
    return map;
  }, [isAdminAllStores, storeMap, allTransactions, inventoryArray]);

  const reportDefaultsByType = useMemo<Record<string, string[]>>(
    () => ({
      sales: ["Revenue", "Units Sold", "Top Products", "Category Breakdown", "Tax Summary"],
      inventory: ["Stock Levels", "Category Breakdown"],
      product: ["Revenue", "Units Sold", "Top Products", "Stock Levels", "Category Breakdown"],
      financial: ["Revenue", "Tax Summary", "Category Breakdown"],
    }),
    []
  );

  useEffect(() => {
    setSelectedMetrics(reportDefaultsByType[reportType] || reportDefaultsByType.sales);
  }, [reportType, reportDefaultsByType]);

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  };

  const getPeriodRange = (period: string) => {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);

    if (period === "7d") start.setDate(now.getDate() - 7);
    else if (period === "30d") start.setDate(now.getDate() - 30);
    else if (period === "month") start.setDate(1);
    else if (period === "quarter") {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      start.setMonth(quarterStartMonth, 1);
    } else if (period === "year") {
      start.setMonth(0, 1);
    } else {
      start.setDate(now.getDate() - 30);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const buildCommon = (txSource: Transaction[], invSource: InventoryItem[]) => {
    const { start, end } = getPeriodRange(timePeriod);
    const filteredTx = txSource.filter((t) => {
      if (t.status !== "Completed") return false;
      const dt = new Date(t.datetime);
      return dt >= start && dt <= end;
    });

    const invMap = Object.fromEntries(invSource.map((p) => [p.id, p]));

    const totals = filteredTx.reduce(
      (acc, tx) => {
        const taxable = Math.max(0, (tx.subtotal || 0) - (tx.discount || 0));
        acc.revenue += tx.amount;
        acc.taxableSales += taxable;
        acc.orders += 1;
        acc.units += tx.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
        return acc;
      },
      { revenue: 0, taxableSales: 0, orders: 0, units: 0 }
    );
    const avgOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : 0;

    const dailyMap: Record<string, { revenue: number; orders: number; units: number }> = {};
    const paymentMap: Record<string, number> = {};
    const productMap: Record<string, { revenue: number; units: number }> = {};
    const categoryMap: Record<string, { revenue: number; units: number }> = {};

    filteredTx.forEach((tx) => {
      const day = tx.datetime.slice(0, 10);
      dailyMap[day] = dailyMap[day] || { revenue: 0, orders: 0, units: 0 };
      dailyMap[day].revenue += tx.amount;
      dailyMap[day].orders += 1;
      dailyMap[day].units += tx.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);

      const pay = tx.payment || "Unknown";
      paymentMap[pay] = (paymentMap[pay] || 0) + tx.amount;

      tx.items.forEach((it) => {
        const productId = it.productId;
        const qty = Number(it.qty) || 0;
        const price = Number(it.price) || 0;
        const amount = qty * price;

        productMap[productId] = productMap[productId] || { revenue: 0, units: 0 };
        productMap[productId].revenue += amount;
        productMap[productId].units += qty;

        const category = invMap[productId]?.category || "Uncategorized";
        categoryMap[category] = categoryMap[category] || { revenue: 0, units: 0 };
        categoryMap[category].revenue += amount;
        categoryMap[category].units += qty;
      });
    });

    const dailyRows = Object.entries(dailyMap)
      .map(([date, s]) => ({ Date: date, Orders: s.orders, Units: s.units, Revenue: s.revenue }))
      .sort((a, b) => (a.Date < b.Date ? -1 : 1));

    const paymentRows = Object.entries(paymentMap)
      .map(([method, amount]) => ({ Method: method, Amount: amount }))
      .sort((a, b) => b.Amount - a.Amount);

    const productRows = Object.entries(productMap)
      .map(([id, s]) => {
        const p = invMap[id];
        return {
          Product: p?.name || `#${id}`,
          SKU: p?.sku || "N/A",
          Category: p?.category || "Uncategorized",
          Units: s.units,
          Revenue: s.revenue,
          "Current Stock": p?.stock ?? 0,
          "Reorder Point": p?.reorderPoint ?? 0,
        };
      })
      .sort((a, b) => b.Revenue - a.Revenue);

    const categoryRows = Object.entries(categoryMap)
      .map(([category, s]) => ({ Category: category, Units: s.units, Revenue: s.revenue }))
      .sort((a, b) => b.Revenue - a.Revenue);

    const now = new Date();
    const expiringCutoff = new Date(now);
    expiringCutoff.setDate(now.getDate() + 30);

    const stockRows = invSource
      .map((p) => {
        const status =
          p.stock <= p.reorderPoint
            ? p.stock < p.reorderPoint * 0.5
              ? "CRITICAL"
              : "LOW"
            : "OK";
        const expiry = p.expiryDate ? new Date(p.expiryDate) : null;
        const expiringSoon = expiry ? expiry <= expiringCutoff : false;
        return {
          Product: p.name,
          SKU: p.sku,
          Category: p.category,
          Stock: p.stock,
          "Reorder Point": p.reorderPoint,
          Status: status,
          "Expiring Soon": expiringSoon ? "YES" : "NO",
          "Expiry Date": p.expiryDate
            ? new Date(p.expiryDate).toLocaleDateString("en-GB")
            : "",
          Valuation: p.stock * p.price,
        };
      })
      .sort((a, b) => (a.Category > b.Category ? 1 : -1));

    const lowStockRows = stockRows.filter((r) => r.Status !== "OK");
    const expiringRows = stockRows.filter((r) => r["Expiring Soon"] === "YES");

    const inventoryCategoryRows = Object.entries(
      stockRows.reduce(
        (
          acc: Record<
            string,
            { sku: number; units: number; valuation: number; low: number; expiring: number }
          >,
          r
        ) => {
          acc[r.Category] = acc[r.Category] || {
            sku: 0,
            units: 0,
            valuation: 0,
            low: 0,
            expiring: 0,
          };
          acc[r.Category].sku += 1;
          acc[r.Category].units += Number(r.Stock) || 0;
          acc[r.Category].valuation += Number(r.Valuation) || 0;
          if (r.Status !== "OK") acc[r.Category].low += 1;
          if (r["Expiring Soon"] === "YES") acc[r.Category].expiring += 1;
          return acc;
        },
        {}
      )
    )
      .map(([category, s]) => ({
        Category: category,
        SKUs: s.sku,
        Units: s.units,
        Valuation: s.valuation,
        "Low Stock SKUs": s.low,
        "Expiring SKUs": s.expiring,
      }))
      .sort((a, b) => b.Valuation - a.Valuation);

    return {
      start,
      end,
      filteredTx,
      invMap,
      totals,
      avgOrderValue,
      dailyRows,
      paymentRows,
      productRows,
      categoryRows,
      stockRows,
      lowStockRows,
      expiringRows,
      inventoryCategoryRows,
    };
  };

  const toCsv = (rows: Record<string, any>[]) => {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      const needs = /[",\n]/.test(s);
      return needs ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
    return `${headers.join(",")}\n${body}`;
  };

  const addSheet = (wb: XLSX.WorkBook, sheetName: string, rows: any[]) => {
    const safeName = sheetName.length > 31 ? sheetName.slice(0, 31) : sheetName;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), safeName);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setProgress(0);
    setReportReady(false);

    const duration = 8000;
    const intervalTime = 100;
    const steps = duration / intervalTime;
    const increment = 100 / steps;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);

          const now = new Date();
          const dateStr = now.toLocaleDateString("en-GB").replace(/\//g, "-");
          const typeLabel =
            reportType.charAt(0).toUpperCase() + reportType.slice(1).replace("_", " ");
          const periodLabel =
            timePeriod === "30d"
              ? "Last_30_Days"
              : timePeriod === "month"
                ? "This_Month"
                : timePeriod;
          const storeLabel =
            isAdminAllStores && selectedStoreId === "all"
              ? "All_Stores"
              : isAdminAllStores
                ? (realStores.find((s) => s.id === selectedStoreId)?.name || "Store").replace(
                    /\s+/g,
                    "_"
                  )
                : (currentStore?.name || "Main_Store").replace(/\s+/g, "_");
          const fileName = `${typeLabel}_Analysis_${storeLabel}_${periodLabel}_${dateStr}.${format === "csv" ? "csv" : "xlsx"}`;

          let blob: Blob;

          // Determine data source based on admin store selection
          let txSource: Transaction[];
          let invSource: InventoryItem[];
          if (isAdminAllStores && selectedStoreId === "all") {
            txSource = allTransactions;
            invSource = inventoryArray;
          } else if (isAdminAllStores && selectedStoreId !== "all") {
            txSource = allTransactions.filter((t) => t.storeId === selectedStoreId);
            const productIds = new Set<number>();
            txSource.forEach((t) => t.items.forEach((item) => productIds.add(item.productId)));
            invSource = inventoryArray.filter((item) => productIds.has(item.id));
          } else {
            txSource = transactions;
            invSource = inventoryArray;
          }

          const common = buildCommon(txSource, invSource);
          const vatRate = 7.5;
          const taxableBase = Math.max(0, common.totals.taxableSales);
          const vatAmount = (taxableBase * vatRate) / 100;

          if (format === "excel") {
            const wb = XLSX.utils.book_new();

            const buildSummaryRows = (c: ReturnType<typeof buildCommon>, label: string) => {
              const rows: any[] = [
                { Metric: "Report Type", Value: typeLabel },
                { Metric: "Store", Value: label },
                { Metric: "Period Start", Value: c.start.toLocaleDateString("en-GB") },
                { Metric: "Period End", Value: c.end.toLocaleDateString("en-GB") },
                { Metric: "Generated On", Value: now.toLocaleString("en-GB") },
              ];
              if (selectedMetrics.includes("Revenue")) {
                rows.push({ Metric: "Total Revenue", Value: formatCurrency(c.totals.revenue) });
                rows.push({ Metric: "Total Orders", Value: c.totals.orders });
                rows.push({
                  Metric: "Avg Order Value",
                  Value: formatCurrency(c.avgOrderValue),
                });
              }
              if (selectedMetrics.includes("Units Sold")) {
                rows.push({ Metric: "Total Units Sold", Value: c.totals.units });
              }
              if (selectedMetrics.includes("Tax Summary")) {
                rows.push({ Metric: `VAT (${vatRate}%)`, Value: formatCurrency(vatAmount) });
                rows.push({
                  Metric: "VAT Base (Completed Sales)",
                  Value: formatCurrency(taxableBase),
                });
              }
              return rows;
            };

            const buildSalesSheets = (c: ReturnType<typeof buildCommon>) => {
              const sheets: { name: string; rows: any[] }[] = [];
              if (selectedMetrics.includes("Revenue") || selectedMetrics.includes("Units Sold"))
                sheets.push({ name: "Daily Sales", rows: c.dailyRows });
              if (selectedMetrics.includes("Category Breakdown"))
                sheets.push({ name: "Category Sales", rows: c.categoryRows });
              if (selectedMetrics.includes("Top Products"))
                sheets.push({
                  name: "Top Products",
                  rows: c.productRows.slice(0, 30),
                });
              if (selectedMetrics.includes("Tax Summary"))
                sheets.push({ name: "Payment Methods", rows: c.paymentRows });
              return sheets;
            };

            const buildInventorySheets = (c: ReturnType<typeof buildCommon>) => {
              const sheets: { name: string; rows: any[] }[] = [];
              if (selectedMetrics.includes("Stock Levels")) {
                sheets.push({ name: "Stock Levels", rows: c.stockRows });
                sheets.push({ name: "Low Stock", rows: c.lowStockRows });
                sheets.push({ name: "Expiring Stock", rows: c.expiringRows });
              }
              if (selectedMetrics.includes("Category Breakdown"))
                sheets.push({
                  name: "Category Summary",
                  rows: c.inventoryCategoryRows,
                });
              return sheets;
            };

            const buildProductSheets = (c: ReturnType<typeof buildCommon>) => {
              const sheets: { name: string; rows: any[] }[] = [];
              if (selectedMetrics.includes("Top Products")) {
                sheets.push({ name: "Performance", rows: c.productRows });
                sheets.push({ name: "Top 10", rows: c.productRows.slice(0, 10) });
                sheets.push({
                  name: "Bottom 10",
                  rows: [...c.productRows].reverse().slice(0, 10),
                });
              }
              if (selectedMetrics.includes("Stock Levels"))
                sheets.push({ name: "Stock Snapshot", rows: c.stockRows });
              if (selectedMetrics.includes("Category Breakdown"))
                sheets.push({ name: "Category Sales", rows: c.categoryRows });
              return sheets;
            };

            const buildFinancialSheets = (c: ReturnType<typeof buildCommon>) => {
              const sheets: { name: string; rows: any[] }[] = [];
              const monthlyMap: Record<string, number> = {};
              c.filteredTx.forEach((t) => {
                const dt = new Date(t.datetime);
                const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
                monthlyMap[key] = (monthlyMap[key] || 0) + t.amount;
              });
              const monthlyRows = Object.entries(monthlyMap)
                .map(([month, amount]) => ({
                  Month: month,
                  Revenue: amount,
                  VAT: (amount * vatRate) / 100,
                }))
                .sort((a, b) => (a.Month < b.Month ? -1 : 1));

              if (selectedMetrics.includes("Revenue"))
                sheets.push({ name: "Monthly Revenue", rows: monthlyRows });
              if (selectedMetrics.includes("Tax Summary"))
                sheets.push({
                  name: "VAT Summary",
                  rows: [
                    {
                      "VAT Rate (%)": vatRate,
                      "VAT Base": taxableBase,
                      "VAT Due": vatAmount,
                    },
                  ],
                });
              if (selectedMetrics.includes("Category Breakdown"))
                sheets.push({ name: "Category Sales", rows: c.categoryRows });
              sheets.push({ name: "Payment Methods", rows: c.paymentRows });
              return sheets;
            };

            const getReportSheets = (c: ReturnType<typeof buildCommon>) => {
              switch (reportType) {
                case "sales":
                  return buildSalesSheets(c);
                case "inventory":
                  return buildInventorySheets(c);
                case "product":
                  return buildProductSheets(c);
                case "financial":
                  return buildFinancialSheets(c);
                default:
                  return buildSalesSheets(c);
              }
            };

            const usePerStore =
              isAdminAllStores && selectedStoreId === "all" && storeMap && storeMap.size > 0;

            if (usePerStore) {
              // Summary sheet across all stores
              addSheet(wb, "Summary", buildSummaryRows(common, "All Stores"));
              const reportSheets = getReportSheets(common);
              reportSheets.forEach((s) => addSheet(wb, `All - ${s.name}`, s.rows));

              // Per-store sheets
              const txByStore = groupTransactionsByStore(txSource);
              const invByStoreMap = inventoryByStore || new Map<string, InventoryItem[]>();

              storeMap!.forEach((storeName, storeId) => {
                const storeTxs = txByStore.get(storeId) || [];
                const storeInv = invByStoreMap.get(storeId) || [];
                if (storeTxs.length === 0 && storeInv.length === 0) return;
                const sheetPrefix = sanitizeSheetName(storeName);
                const storeCommon = buildCommon(storeTxs, storeInv);
                const storeSummary = buildSummaryRows(storeCommon, storeName);
                addSheet(wb, `${sheetPrefix} - Summary`, storeSummary);
                const storeSheets = getReportSheets(storeCommon);
                storeSheets.forEach((s) => addSheet(wb, `${sheetPrefix} - ${s.name}`, s.rows));
              });
            } else {
              // Single store or specific store mode
              const storeLabel2 =
                isAdminAllStores && selectedStoreId !== "all"
                  ? realStores.find((s) => s.id === selectedStoreId)?.name || "Store"
                  : "Store";
              addSheet(wb, "Summary", buildSummaryRows(common, storeLabel2));
              const reportSheets = getReportSheets(common);
              reportSheets.forEach((s) => addSheet(wb, s.name, s.rows));
            }

            const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            blob = new Blob([excelBuffer], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
          } else {
            // CSV mode
            let rows: any[] = [];
            if (reportType === "sales") rows = common.dailyRows;
            else if (reportType === "inventory") rows = common.stockRows;
            else if (reportType === "product") rows = common.productRows;
            else if (reportType === "financial") {
              const monthlyMap: Record<string, number> = {};
              common.filteredTx.forEach((t) => {
                const dt = new Date(t.datetime);
                const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
                monthlyMap[key] = (monthlyMap[key] || 0) + t.amount;
              });
              rows = Object.entries(monthlyMap)
                .map(([month, amount]) => ({
                  Month: month,
                  Revenue: amount,
                  VAT: (amount * 7.5) / 100,
                }))
                .sort((a, b) => (a.Month < b.Month ? -1 : 1));
            }

            // For admin with all stores, add Store column to CSV rows
            const usePerStoreCsv =
              isAdminAllStores && selectedStoreId === "all" && storeMap && storeMap.size > 0;

            if (usePerStoreCsv) {
              const storeNameById = new Map<string, string>();
              realStores.forEach((s) => storeNameById.set(s.id, s.name));

              // Rebuild rows with store info
              const txByStore = groupTransactionsByStore(txSource);
              let enrichedRows: any[] = [];

              txByStore.forEach((storeTxs, storeId) => {
                const storeName = storeNameById.get(storeId) || storeId;
                const storeCommon = buildCommon(storeTxs, invSource);
                let storeRows: any[] = [];
                if (reportType === "sales") storeRows = storeCommon.dailyRows;
                else if (reportType === "inventory") storeRows = storeCommon.stockRows;
                else if (reportType === "product") storeRows = storeCommon.productRows;
                else if (reportType === "financial") {
                  const mmap: Record<string, number> = {};
                  storeCommon.filteredTx.forEach((t) => {
                    const dt = new Date(t.datetime);
                    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
                    mmap[key] = (mmap[key] || 0) + t.amount;
                  });
                  storeRows = Object.entries(mmap)
                    .map(([month, amount]) => ({
                      Month: month,
                      Revenue: amount,
                      VAT: (amount * 7.5) / 100,
                    }))
                    .sort((a, b) => (a.Month < b.Month ? -1 : 1));
                }
                storeRows.forEach((r) => enrichedRows.push({ Store: storeName, ...r }));
              });

              rows = enrichedRows;
            }

            const csvContent = toCsv(rows);
            blob = new Blob([csvContent], { type: "text/csv" });
          }

          const fileObj = {
            blob,
            name: fileName,
            type:
              format === "csv"
                ? "text/csv"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          };
          setGeneratedFile(fileObj);
          setIsGenerating(false);
          setReportReady(true);
          toast.success("Custom report generated successfully!");

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 10000);

          return 100;
        }
        return prev + increment;
      });
    }, intervalTime);
  };

  const downloadFile = () => {
    if (!generatedFile) return;
    const url = URL.createObjectURL(generatedFile.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = generatedFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success(`Downloading ${generatedFile.name}...`);
  };

  const resetModal = () => {
    setIsGenerating(false);
    setProgress(0);
    setReportReady(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetModal()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
        <div className="bg-white">
          <DialogHeader className="p-8 pb-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-black text-white tracking-tight">
                  Custom Report Builder
                </DialogTitle>
                <DialogDescription className="text-sm text-indigo-100 font-medium mt-1">
                  {isAdminAllStores
                    ? "Cross-store analytics and detailed insights"
                    : "Tailor insights to your business needs"}
                </DialogDescription>
              </div>
              <Badge className="bg-white/20 text-white border-white/30 flex items-center gap-1.5 py-1 px-3 text-[10px] font-black animate-pulse backdrop-blur-sm">
                <Sparkles className="w-3 h-3" />
                AI-POWERED
              </Badge>
            </div>
          </DialogHeader>

          <div className="p-8 pt-6">
            {!isGenerating && !reportReady ? (
              <div className="space-y-8">
                {isAdminAllStores && realStores.length > 0 && (
                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
                      0. Store Scope
                    </Label>
                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                      <SelectTrigger className="w-full h-12 bg-gray-50 border-gray-100 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-100 transition-all">
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-xl max-h-60 overflow-y-auto">
                        <SelectItem
                          value="all"
                          className="text-sm font-medium flex items-center gap-2"
                        >
                          <Building2 className="w-4 h-4" /> All Stores (Cross-Store)
                        </SelectItem>
                        {realStores.map((s) => (
                          <SelectItem
                            key={s.id}
                            value={s.id}
                            className="text-sm font-medium flex items-center gap-2"
                          >
                            <Store className="w-4 h-4" /> {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedStoreId === "all" && (
                      <p className="text-[10px] text-indigo-600 font-bold">
                        Report will include per-store breakdown sheets for {realStores.length}{" "}
                        stores.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
                      1. Report Type
                    </Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger className="w-full h-12 bg-gray-50 border-gray-100 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-100 transition-all">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-xl">
                        <SelectItem value="sales" className="text-sm font-medium">
                          Sales Analysis
                        </SelectItem>
                        <SelectItem value="inventory" className="text-sm font-medium">
                          Inventory Analysis
                        </SelectItem>
                        <SelectItem value="product" className="text-sm font-medium">
                          Product Performance
                        </SelectItem>
                        <SelectItem value="financial" className="text-sm font-medium">
                          Financial Summary
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
                      2. Time Period
                    </Label>
                    <Select value={timePeriod} onValueChange={setTimePeriod}>
                      <SelectTrigger className="w-full h-12 bg-gray-50 border-gray-100 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-100 transition-all">
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-xl">
                        <SelectItem value="7d" className="text-sm font-medium">
                          Last 7 days
                        </SelectItem>
                        <SelectItem value="30d" className="text-sm font-medium">
                          Last 30 days
                        </SelectItem>
                        <SelectItem value="month" className="text-sm font-medium">
                          This Month
                        </SelectItem>
                        <SelectItem value="quarter" className="text-sm font-medium">
                          This Quarter
                        </SelectItem>
                        <SelectItem value="year" className="text-sm font-medium">
                          This Year
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
                    3. Include Metrics
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      "Revenue",
                      "Units Sold",
                      "Top Products",
                      "Stock Levels",
                      "Category Breakdown",
                      "Tax Summary",
                    ].map((metric) => (
                      <div
                        key={metric}
                        className={`flex items-center space-x-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                          selectedMetrics.includes(metric)
                            ? "bg-indigo-50/50 border-indigo-200"
                            : "bg-gray-50/50 border-gray-100 hover:border-gray-200"
                        }`}
                        onClick={() => toggleMetric(metric)}
                      >
                        <Checkbox
                          id={`custom-${metric}`}
                          checked={selectedMetrics.includes(metric)}
                          onCheckedChange={() => toggleMetric(metric)}
                          className="h-4 w-4 rounded-md border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                        <label
                          htmlFor={`custom-${metric}`}
                          className={`text-xs font-bold cursor-pointer transition-colors ${
                            selectedMetrics.includes(metric) ? "text-indigo-900" : "text-gray-600"
                          }`}
                        >
                          {metric}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3.5">
                  <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
                    4. Export Format
                  </Label>
                  <RadioGroup
                    value={format}
                    onValueChange={setFormat}
                    className="flex gap-8 bg-gray-50/50 p-5 rounded-xl border border-gray-100"
                  >
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem
                        value="csv"
                        id="csv"
                        className="w-4 h-4 border-gray-300 text-indigo-600"
                      />
                      <Label htmlFor="csv" className="text-xs font-black text-gray-700 cursor-pointer">
                        CSV
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem
                        value="excel"
                        id="excel"
                        className="w-4 h-4 border-gray-300 text-indigo-600"
                      />
                      <Label
                        htmlFor="excel"
                        className="text-xs font-black text-gray-700 cursor-pointer"
                      >
                        Excel (.xlsx)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between bg-indigo-600 p-5 rounded-2xl text-white shadow-xl shadow-indigo-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-indigo-200" />
                      </div>
                      <div>
                        <p className="text-xs font-black">AI Auto-Analysis</p>
                        <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-widest">
                          Processing ~8s
                        </p>
                      </div>
                    </div>
                    <Button
                      className="h-10 px-6 rounded-lg bg-white text-indigo-600 hover:bg-indigo-50 font-black text-xs shadow-lg transition-transform active:scale-95"
                      onClick={handleGenerate}
                    >
                      Generate Report
                    </Button>
                  </div>
                </div>
              </div>
            ) : isGenerating ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-6 text-center">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
                  <Sparkles className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">
                    AI is Analyzing Your Data
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Pulling real-time transactions and calculating metrics...
                  </p>
                </div>
                <div className="w-full max-w-xs px-4">
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-black text-indigo-600 mt-3 uppercase tracking-[0.2em]">
                    {Math.round(progress)}% Complete
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-10 space-y-8">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-green-50 rounded-[1.75rem] flex items-center justify-center mx-auto shadow-xl shadow-green-100/50">
                    <CheckCircle2 className="w-10 h-10 text-[#00A651]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                      Report Ready!
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      Your custom business analysis has been compiled.
                    </p>
                    <Badge
                      variant="outline"
                      className="mt-4 py-1 px-3 rounded-lg border-gray-100 text-[10px] text-gray-400 font-black bg-gray-50/50"
                    >
                      FILE: {generatedFile?.name}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    className="h-14 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-sm gap-2.5 shadow-xl shadow-indigo-100 transition-all hover:-translate-y-0.5 active:translate-y-0"
                    onClick={downloadFile}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    Download {format.toUpperCase()}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-14 rounded-xl border-gray-100 font-black text-xs gap-2 hover:bg-gray-50 transition-all hover:-translate-y-0.5 active:translate-y-0"
                      onClick={() => setEmailModalOpen(true)}
                    >
                      <Mail className="w-4 h-4 text-gray-400" />
                      Email
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-xl border-gray-100 font-black text-xs gap-2 hover:bg-gray-50 transition-all hover:-translate-y-0.5 active:translate-y-0"
                      onClick={() => setSmsModalOpen(true)}
                    >
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      SMS
                    </Button>
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <Button
                    variant="ghost"
                    className="text-[10px] text-gray-400 font-black uppercase tracking-widest hover:text-indigo-600 hover:bg-indigo-50 px-6 py-2 rounded-lg transition-all"
                    onClick={resetModal}
                  >
                    Create Another Report
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      <EmailShareModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportName={generatedFile?.name || "Custom Report"}
        reportType="Custom Report"
        file={generatedFile}
      />
      <SMSShareModal
        open={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        reportName={generatedFile?.name || "Custom Report"}
        reportType="Custom Report"
      />
    </Dialog>
  );
}
