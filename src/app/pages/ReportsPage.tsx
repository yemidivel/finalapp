import React, { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Package,
  DollarSign,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  Plus,
  Mail,
  PieChart as PieChartIcon,
  BarChart4,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Search,
  Eye,
  FileSpreadsheet,
  Download as DownloadIcon,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { ReportPreviewModal } from "@/app/components/ReportPreviewModal";
import { CustomReportModal } from "@/app/components/CustomReportModal";
import { EmailShareModal } from "@/app/components/EmailShareModal";
import { SMSShareModal } from "@/app/components/SMSShareModal";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { Calendar as CalendarPicker } from "../components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, fadeInUp } from "../../animations/variants";
import { Stagger } from "../../animations/Stagger";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useStore, Transaction, InventoryItem, CartItem } from "../state/store";
import { toast } from "sonner";
import { KPIValue } from "../components/KPIValue";

// --- Helper Functions for Report Generation ---

const downloadFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Safe delay for revocation to avoid "Failed to load document" errors
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

const getQuarter = (date: Date) => Math.floor((date.getMonth() + 3) / 3);

// Sanitize store name for Excel sheet name (max 31 chars, no invalid chars)
const sanitizeSheetName = (name: string): string => {
  return name.replace(/[\\/*?:\[\]]/g, '').trim().slice(0, 31);
};

// Group transactions by storeId, returning Map<storeId, Transaction[]>
const groupTransactionsByStore = (transactions: Transaction[]): Map<string, Transaction[]> => {
  const map = new Map<string, Transaction[]>();
  transactions.forEach(tx => {
    const arr = map.get(tx.storeId) || [];
    arr.push(tx);
    map.set(tx.storeId, arr);
  });
  return map;
};

// 1. Sales Report (Excel - Multi Sheet)
const generateSalesExcel = (transactions: Transaction[], inventory: Record<number, InventoryItem>, currency: any, fileNamePrefix: string = "Daily_Weekly_Sales_Summary", storeMap?: Map<string, string>) => {
  const wb = XLSX.utils.book_new();
  const now = new Date();
  
  const completedTX = transactions.filter(t => t.status === "Completed");

  const buildSalesSheets = (txs: Transaction[], label: string) => {
    const totalRevenue = txs.reduce((sum, t) => sum + t.amount, 0);
    const unitsSold = txs.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.qty, 0), 0);
    const avgOrder = txs.length > 0 ? totalRevenue / txs.length : 0;
    
    const midpoint = Math.floor(txs.length / 2);
    const recentRev = txs.slice(0, midpoint).reduce((s, t) => s + t.amount, 0);
    const olderRev = txs.slice(midpoint).reduce((s, t) => s + t.amount, 0);
    const growth = olderRev > 0 ? ((recentRev - olderRev) / olderRev) * 100 : 0;

    const summaryData = [
      { Metric: "Store", Value: label },
      { Metric: "Total Revenue", Value: `${currency.symbol}${totalRevenue.toLocaleString()}` },
      { Metric: "Total Units Sold", Value: unitsSold },
      { Metric: "Average Order Value", Value: `${currency.symbol}${avgOrder.toLocaleString()}` },
      { Metric: "Growth %", Value: `${growth.toFixed(1)}%` },
      { Metric: "Total Transactions", Value: txs.length },
      { Metric: "Report Date", Value: now.toLocaleDateString() }
    ];

    const dailyMap: Record<string, { revenue: number, units: number }> = {};
    txs.forEach(t => {
      const day = t.datetime.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { revenue: 0, units: 0 };
      dailyMap[day].revenue += t.amount;
      dailyMap[day].units += t.items.reduce((s, i) => s + i.qty, 0);
    });
    const dailyData = Object.entries(dailyMap).map(([date, stats]) => ({
      Date: date,
      "Products Sold": stats.units,
      Revenue: stats.revenue
    }));

    const productsSoldData: any[] = [];
    txs.forEach(t => {
      t.items.forEach(item => {
        const p = inventory[item.productId];
        productsSoldData.push({
          Product: p?.name || "Unknown",
          Category: p?.category || "Retail",
          Units: item.qty,
          Amount: item.qty * item.price,
          Date: t.datetime.slice(0, 10)
        });
      });
    });

    return { summaryData, dailyData, productsSoldData };
  };

  if (storeMap && storeMap.size > 0) {
    // Summary sheet across all stores
    const allSummary = buildSalesSheets(completedTX, "All Stores");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allSummary.summaryData), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allSummary.dailyData), "Daily Breakdown");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allSummary.productsSoldData), "Products Sold");

    // Per-store sheets
    const txByStore = groupTransactionsByStore(completedTX);
    storeMap.forEach((storeName, storeId) => {
      const storeTxs = txByStore.get(storeId) || [];
      if (storeTxs.length === 0) return;
      const sheetName = sanitizeSheetName(storeName);
      const data = buildSalesSheets(storeTxs, storeName);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.summaryData), `${sheetName} - Summary`);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.dailyData), `${sheetName} - Daily`);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.productsSoldData), `${sheetName} - Products`);
    });
  } else {
    // Single-store mode (original behavior)
    const data = buildSalesSheets(completedTX, "Store");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.summaryData), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.dailyData), "Daily Breakdown");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.productsSoldData), "Products Sold");
  }

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

// 2. Inventory Report (Excel) - Multi Sheet (Stock Levels, Low Stock, Expiring, Category Summary)
const generateInventoryExcel = (inventoryArray: InventoryItem[], storeMap?: Map<string, string>, inventoryByStore?: Map<string, InventoryItem[]>) => {
  const now = new Date();
  const expiringCutoff = new Date(now);
  expiringCutoff.setDate(now.getDate() + 30);

  const buildInventorySheets = (items: InventoryItem[]) => {
    const stockLevels = items.map(item => {
      const status = item.stock <= item.reorderPoint ? (item.stock < item.reorderPoint * 0.5 ? "CRITICAL" : "LOW") : "OK";
      const expiry = item.expiryDate ? new Date(item.expiryDate) : null;
      const expiringSoon = expiry ? expiry <= expiringCutoff : false;
      return {
        Product: item.name,
        SKU: item.sku,
        Category: item.category,
        "Current Stock": item.stock,
        "Reorder Point": item.reorderPoint,
        Status: status,
        "Expiring Soon": expiringSoon ? "YES" : "NO",
        "Expiry Date": item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("en-GB") : "",
        Valuation: item.stock * item.price
      };
    });

    const lowStock = stockLevels.filter(r => r.Status !== "OK");
    const expiringStock = stockLevels.filter(r => r["Expiring Soon"] === "YES");
    const categorySummary = Object.entries(
      stockLevels.reduce((acc: Record<string, { sku: number; units: number; valuation: number; low: number; expiring: number }>, r) => {
        acc[r.Category] = acc[r.Category] || { sku: 0, units: 0, valuation: 0, low: 0, expiring: 0 };
        acc[r.Category].sku += 1;
        acc[r.Category].units += Number(r["Current Stock"]) || 0;
        acc[r.Category].valuation += Number(r.Valuation) || 0;
        if (r.Status !== "OK") acc[r.Category].low += 1;
        if (r["Expiring Soon"] === "YES") acc[r.Category].expiring += 1;
        return acc;
      }, {})
    )
      .map(([category, s]) => ({
        Category: category,
        SKUs: s.sku,
        Units: s.units,
        Valuation: s.valuation,
        "Low Stock SKUs": s.low,
        "Expiring SKUs": s.expiring
      }))
      .sort((a, b) => b.Valuation - a.Valuation);

    return { stockLevels, lowStock, expiringStock, categorySummary };
  };

  const wb = XLSX.utils.book_new();

  if (storeMap && storeMap.size > 0 && inventoryByStore) {
    // Summary sheet across all stores
    const allData = buildInventorySheets(inventoryArray);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData.stockLevels), "Summary - Stock Levels");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData.lowStock), "Summary - Low Stock");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData.expiringStock), "Summary - Expiring");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData.categorySummary), "Summary - Categories");

    // Per-store sheets
    storeMap.forEach((storeName, storeId) => {
      const storeItems = inventoryByStore.get(storeId) || [];
      if (storeItems.length === 0) return;
      const sheetName = sanitizeSheetName(storeName);
      const data = buildInventorySheets(storeItems);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.stockLevels), `${sheetName} - Stock`);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.lowStock), `${sheetName} - Low Stock`);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.categorySummary), `${sheetName} - Categories`);
    });
  } else {
    // Single-store mode (original behavior)
    const data = buildInventorySheets(inventoryArray);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.stockLevels), "Stock Levels");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.lowStock), "Low Stock");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.expiringStock), "Expiring Stock");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.categorySummary), "Category Summary");
  }

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

// 3. Performance Report (Excel)
const generatePerformanceExcel = (transactions: Transaction[], inventory: Record<number, InventoryItem>, limit: number = 0, storeMap?: Map<string, string>) => {
  const wb = XLSX.utils.book_new();

  const buildPerformanceSheets = (txs: Transaction[]) => {
    const completedTX = txs.filter(t => t.status === "Completed");
    
    const productStats: Record<number, { revenue: number, units: number }> = {};
    completedTX.forEach(t => {
      t.items.forEach(item => {
        if (!productStats[item.productId]) productStats[item.productId] = { revenue: 0, units: 0 };
        productStats[item.productId].revenue += item.qty * item.price;
        productStats[item.productId].units += item.qty;
      });
    });
    
    let performanceData: any[] = Object.entries(productStats).map(([id, stats]) => {
      const p = inventory[Number(id)];
      return {
        Product: p?.name || "Unknown",
        Units: stats.units,
        Revenue: stats.revenue,
        "% of Total": 0
      };
    });

    const totalRevenue = performanceData.reduce((sum, p) => sum + p.Revenue, 0);
    performanceData = performanceData.map(p => ({
      ...p,
      "% of Total": totalRevenue > 0 ? `${((p.Revenue / totalRevenue) * 100).toFixed(1)}%` : "0%"
    }));

    const topPerformers = [...performanceData].sort((a, b) => b.Revenue - a.Revenue);
    const bottomPerformers = [...performanceData].sort((a, b) => a.Revenue - b.Revenue);

    let finalPerfData: any[] = performanceData;
    if (limit > 0) {
      finalPerfData = [
        { Product: "--- TOP PERFORMERS ---", Units: "", Revenue: "", "% of Total": "" },
        ...topPerformers.slice(0, limit),
        { Product: "", Units: "", Revenue: "", "% of Total": "" },
        { Product: "--- BOTTOM PERFORMERS ---", Units: "", Revenue: "", "% of Total": "" },
        ...bottomPerformers.slice(0, limit)
      ];
    } else {
      finalPerfData = topPerformers;
    }

    const staffMap: Record<string, { sales: number, count: number }> = {};
    completedTX.forEach(t => {
      const staff = t.cashier || "Admin";
      if (!staffMap[staff]) staffMap[staff] = { sales: 0, count: 0 };
      staffMap[staff].sales += t.amount;
      staffMap[staff].count += 1;
    });
    const staffData = Object.entries(staffMap).map(([name, stats]) => ({
      Staff: name,
      "Total Sales": stats.sales,
      "Order Count": stats.count
    }));

    return { productPerformance: finalPerfData, staffPerformance: staffData };
  };

  if (storeMap && storeMap.size > 0) {
    // Summary sheet (all stores combined)
    const allData = buildPerformanceSheets(transactions);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData.productPerformance), "Summary - Products");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData.staffPerformance), "Summary - Staff");

    // Per-store sheets
    const txByStore = groupTransactionsByStore(transactions);
    storeMap.forEach((storeName, storeId) => {
      const storeTxs = txByStore.get(storeId) || [];
      if (storeTxs.length === 0) return;
      const sheetName = sanitizeSheetName(storeName);
      const data = buildPerformanceSheets(storeTxs);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.productPerformance), `${sheetName} - Products`);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.staffPerformance), `${sheetName} - Staff`);
    });
  } else {
    // Single-store mode (original behavior)
    const data = buildPerformanceSheets(transactions);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.productPerformance), "Product Performance");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.staffPerformance), "Staff Performance");
  }

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

// 4. Inventory Status Report (PDF)
const generateInventoryPDF = (inventoryArray: InventoryItem[], currency: any, storeName: string) => {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("Inventory Status Report", 105, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Store: ${storeName}`, 10, 25);
  doc.text(`Date: ${new Date().toLocaleString()}`, 10, 30);

  const tableData = inventoryArray.map(item => [
    item.name,
    item.stock,
    item.reorderPoint,
    item.stock < item.reorderPoint ? "LOW" : "Healthy",
    `${currency.symbol}${(item.stock * item.price).toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Product", "Stock", "Reorder", "Status", "Valuation"]],
    body: tableData,
    headStyles: { fillColor: [99, 102, 241] },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 3 && data.cell.raw === 'LOW') {
        data.cell.styles.textColor = [239, 68, 68];
      }
    }
  });

  return doc.output("blob");
};

// 5. Financial Summary (PDF)
const generateFinancialPDF = (transactions: Transaction[], currency: any, storeName: string, storeMap?: Map<string, string>) => {
  const doc = new jsPDF();
  const now = new Date();
  const Q = getQuarter(now);
  
  doc.setFontSize(20);
  doc.text(`Financial Summary Q${Q} ${now.getFullYear()}`, 105, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Store: ${storeName}`, 10, 25);
  
  const totalRev = transactions.filter(t => t.status === "Completed").reduce((s, t) => s + t.amount, 0);
  const profitEst = totalRev * 0.25;

  doc.setFontSize(14);
  doc.text(`Estimated Revenue: ${currency.symbol}${totalRev.toLocaleString()}`, 10, 40);
  doc.text(`Estimated Profit (25%): ${currency.symbol}${profitEst.toLocaleString()}`, 10, 50);

  // Monthly breakdown
  const monthlyMap: Record<string, number> = {};
  transactions.filter(t => t.status === "Completed").forEach(t => {
    const month = new Date(t.datetime).toLocaleString('default', { month: 'long' });
    monthlyMap[month] = (monthlyMap[month] || 0) + t.amount;
  });

  const tableData = Object.entries(monthlyMap).map(([m, val]) => [m, `${currency.symbol}${val.toLocaleString()}`]);
  autoTable(doc, {
    startY: 60,
    head: [["Month", "Revenue"]],
    body: tableData,
    headStyles: { fillColor: [99, 102, 241] }
  });

  // Per-store breakdown (admin only)
  if (storeMap && storeMap.size > 0) {
    let y = (doc as any).lastAutoTable?.finalY + 15;
    if (y > 250) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.text("Revenue by Store", 10, y);
    y += 5;

    const txByStore = groupTransactionsByStore(transactions.filter(t => t.status === "Completed"));
    const storeRows: any[][] = [];
    storeMap.forEach((name, id) => {
      const storeTxs = txByStore.get(id) || [];
      const rev = storeTxs.reduce((s, t) => s + t.amount, 0);
      storeRows.push([name, `${currency.symbol}${rev.toLocaleString()}`, `${storeTxs.length} orders`]);
    });
    storeRows.push(["TOTAL", `${currency.symbol}${totalRev.toLocaleString()}`, `${transactions.filter(t => t.status === "Completed").length} orders`]);

    autoTable(doc, {
      startY: y,
      head: [["Store", "Revenue", "Orders"]],
      body: storeRows,
      headStyles: { fillColor: [99, 102, 241] },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.row.index === storeRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
        }
      }
    });
  }

  return doc.output("blob");
};

// 6. VAT Return Form (PDF) - Standard Nigerian Format
const generateVatPDF = (store: any, transactions: Transaction[], vatRate: number, currency: any, storeBreakdown?: Array<{ name: string; sales: number; vat: number }>) => {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const pageH = 297;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 0;

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();
  const period = `${monthName} ${year}`;
  const filingDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Helpers
  const line = (x1: number, yy: number, x2: number, color: number[] = [200, 200, 200]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(x1, yy, x2, yy);
  };

  const sectionTitle = (title: string, yy: number) => {
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(margin, yy, contentW, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 4, yy + 5.5);
    doc.setTextColor(0, 0, 0);
    return yy + 12;
  };

  const fieldRow = (label: string, value: string, yy: number, opts?: { bold?: boolean; bg?: boolean }) => {
    if (opts?.bg) {
      doc.setFillColor(248, 249, 252);
      doc.rect(margin, yy - 4.5, contentW, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(label, margin + 4, yy);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(value, margin + contentW - 4, yy, { align: "right" });
    return yy + 7;
  };

  // =========== PAGE 1 ===========

  // Top accent bar
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 4, "F");

  // Header
  y = 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text("VAT RETURN FORM", pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(99, 102, 241);
  doc.text("Federal Inland Revenue Service (FIRS)", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Form Reference: VAT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${store?.id?.slice(0, 6) || "000000"}`, pageW / 2, y, { align: "center" });
  y += 4;
  doc.text(`Filed on: ${filingDate}`, pageW / 2, y, { align: "center" });

  y += 10;
  line(margin, y, pageW - margin, [99, 102, 241]);
  y += 8;

  // Section A: Taxpayer Information
  y = sectionTitle("SECTION A: TAXPAYER INFORMATION", y);
  y += 2;

  y = fieldRow("Business Name:", store?.name || "N/A", y, { bg: true });
  y = fieldRow("Taxpayer Identification Number (TIN):", store?.tin || "TIN-00000000-0001", y);
  y = fieldRow("Business Address:", `${store?.address || "N/A"}, ${store?.city || "N/A"}`, y, { bg: true });
  y = fieldRow("Phone Number:", store?.phone || "N/A", y);
  y = fieldRow("Email Address:", store?.email || "N/A", y, { bg: true });
  y = fieldRow("Tax Office:", "Lagos Island", y);
  y = fieldRow("Reporting Period:", period, y, { bg: true });
  y = fieldRow("Filing Date:", filingDate, y);

  y += 6;

  // Section B: Output VAT Calculation
  y = sectionTitle("SECTION B: OUTPUT VAT CALCULATION", y);
  y += 2;

  const completedTx = transactions.filter(t => t.status === "Completed");
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthlyTx = completedTx.filter(t => {
    const d = new Date(t.datetime);
    return d >= firstDay && d <= lastDay;
  });

  const totalSales = monthlyTx.reduce((sum, t) => sum + Math.max(0, (t.subtotal || 0) - (t.discount || 0)), 0);
  const totalVat = monthlyTx.reduce((sum, t) => sum + (t.vat || 0), 0);
  const computedVat = (totalSales * vatRate) / 100;

  // Breakdown table
  const tableData = [
    ["1", "Total Value of Taxable Supplies (Excl. VAT)", `${currency.symbol}${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
    ["2", "VAT Rate", `${vatRate}%`],
    ["3", "Output VAT Due (Line 1 x Line 2)", `${currency.symbol}${computedVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
    ["4", "VAT Collected at Source (Withholding)", `${currency.symbol}0.00`],
    ["5", "Adjustments / Credits", `${currency.symbol}0.00`],
    ["6", "Total Output VAT (Line 3 + 4 - 5)", `${currency.symbol}${computedVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Description", "Amount"]],
    body: tableData,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      lineColor: [220, 220, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", textColor: [140, 140, 140] },
      1: { cellWidth: 110 },
      2: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index === 5) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [238, 242, 255];
        data.cell.styles.textColor = [99, 102, 241];
      }
    },
  });

  y = (doc as any).lastAutoTable?.finalY + 8;

  // Section C: Input VAT (Deductions)
  y = sectionTitle("SECTION C: INPUT VAT (DEDUCTIBLE PURCHASES)", y);
  y += 2;

  const inputTableData = [
    ["7", "Total Value of Purchases (Excl. VAT)", `${currency.symbol}0.00`],
    ["8", "Input VAT on Purchases (Line 7 x Line 2)", `${currency.symbol}0.00`],
    ["9", "Capital Expenditure Input VAT", `${currency.symbol}0.00`],
    ["10", "Total Input VAT (Line 8 + 9)", `${currency.symbol}0.00`],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Description", "Amount"]],
    body: inputTableData,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      lineColor: [220, 220, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", textColor: [140, 140, 140] },
      1: { cellWidth: 110 },
      2: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index === 3) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [238, 242, 255];
        data.cell.styles.textColor = [99, 102, 241];
      }
    },
  });

  y = (doc as any).lastAutoTable?.finalY + 8;

  // Check if we need a new page for net VAT section
  if (y > pageH - 80) {
    doc.addPage();
    y = margin + 5;
  }

  // Section D: Net VAT Payable
  y = sectionTitle("SECTION D: NET VAT PAYABLE", y);
  y += 2;

  const netVat = computedVat;
  const netTableData = [
    ["11", "Total Output VAT (Line 6)", `${currency.symbol}${computedVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
    ["12", "Less: Total Input VAT (Line 10)", `${currency.symbol}0.00`],
    ["13", "NET VAT PAYABLE (Line 11 - 12)", `${currency.symbol}${netVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Description", "Amount"]],
    body: netTableData,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      lineColor: [220, 220, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", textColor: [140, 140, 140] },
      1: { cellWidth: 110 },
      2: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index === 2) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [232, 245, 233];
        data.cell.styles.textColor = [27, 94, 32];
        data.cell.styles.fontSize = 10;
      }
    },
  });

  y = (doc as any).lastAutoTable?.finalY + 8;

  // Store Breakdown (admin only)
  if (storeBreakdown && storeBreakdown.length > 0) {
    if (y > pageH - 80) {
      doc.addPage();
      y = margin + 5;
    }

    y = sectionTitle("SECTION E: BREAKDOWN BY STORE", y);
    y += 2;

    const storeRows = storeBreakdown.map((s, i) => [
      String(i + 1),
      s.name,
      `${currency.symbol}${s.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `${currency.symbol}${s.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    ]);

    // Add totals row
    const totalStoreSales = storeBreakdown.reduce((s, store) => s + store.sales, 0);
    const totalStoreVat = storeBreakdown.reduce((s, store) => s + store.vat, 0);
    storeRows.push([
      "",
      "TOTAL",
      `${currency.symbol}${totalStoreSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `${currency.symbol}${totalStoreVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "Store Name", "Taxable Sales", "VAT Amount"]],
      body: storeRows,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        lineColor: [220, 220, 225],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center", textColor: [140, 140, 140] },
        1: { cellWidth: 70 },
        2: { halign: "right" },
        3: { halign: "right", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [248, 249, 252] },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.row.index === storeRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [238, 242, 255];
          data.cell.styles.textColor = [99, 102, 241];
        }
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 8;
  }

  // Check if we need a new page for declaration
  if (y > pageH - 70) {
    doc.addPage();
    y = margin + 5;
  }

  // Section F: Declaration & Authorization
  y = sectionTitle("SECTION F: DECLARATION & AUTHORIZATION", y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const declarationText = "I hereby certify that the information contained in this VAT return is true, complete, and correct to the best of my knowledge. I understand that making a false or misleading statement is an offence under the Federal Inland Revenue Service (Establishment) Act, 2007.";
  const splitDecl = doc.splitTextToSize(declarationText, contentW - 8);
  doc.text(splitDecl, margin + 4, y);
  y += splitDecl.length * 5 + 10;

  // Signature boxes
  const sigBoxW = (contentW - 12) / 2;

  // Authorized Signatory
  doc.setDrawColor(180, 180, 185);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, sigBoxW, 28, 1, 1, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("AUTHORIZED SIGNATORY", margin + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text("Name: ________________________________", margin + 4, y + 13);
  doc.text("Signature: ____________________________", margin + 4, y + 19);
  doc.text(`Date: ${filingDate}`, margin + 4, y + 25);

  // Tax Officer
  doc.roundedRect(margin + sigBoxW + 12, y, sigBoxW, 28, 1, 1, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("TAX OFFICER USE ONLY", margin + sigBoxW + 16, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text("Name: ________________________________", margin + sigBoxW + 16, y + 13);
  doc.text("Signature: ____________________________", margin + sigBoxW + 16, y + 19);
  doc.text("Date Received: ________________________", margin + sigBoxW + 16, y + 25);

  y += 36;

  // Payment Summary Box
  if (y > pageH - 40) {
    doc.addPage();
    y = margin + 5;
  }

  doc.setFillColor(232, 245, 233);
  doc.roundedRect(margin, y, contentW, 18, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(27, 94, 32);
  doc.text(`NET VAT PAYABLE: ${currency.symbol}${netVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW / 2, y + 11, { align: "center" });

  y += 24;

  // Footer
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("This form was generated by SellSync Dashboard — FIRS Compliance Module", margin, y);
  doc.text("For official use only. Not valid without authorized signature and stamp.", margin, y + 4);
  doc.text(`Page 1 of 1`, pageW - margin, y, { align: "right" });

  // Bottom accent bar
  doc.setFillColor(99, 102, 241);
  doc.rect(0, pageH - 4, pageW, 4, "F");

  return doc.output("blob");
};

export function ReportsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { kpis, inventoryArray, transactions, allTransactions, allInventory, allStores, currency, currentStore, currentUser, formatCurrency, canEdit, canView, adminOverview } = useStore();
  const isAdmin = currentUser?.role === "Admin";
  const isAdminAllStores = isAdmin && adminOverview;
  const reportTransactions = isAdminAllStores ? allTransactions : transactions;
  const reportInventory = isAdminAllStores ? allInventory : inventoryArray;

  // Admin: store name map and inventory grouped by store
  const adminStoreMap = useMemo(() => {
    if (!isAdminAllStores) return undefined;
    const map = new Map<string, string>();
    allStores.filter(s => !s.isAdminStore).forEach(s => map.set(s.id, s.name));
    return map;
  }, [isAdminAllStores, allStores]);

  const adminInventoryByStore = useMemo(() => {
    if (!isAdminAllStores || !adminStoreMap) return undefined;
    const map = new Map<string, InventoryItem[]>();
    // Derive which products are sold per store from transactions
    const productIdsByStore = new Map<string, Set<number>>();
    allTransactions.forEach(tx => {
      const set = productIdsByStore.get(tx.storeId) || new Set();
      tx.items.forEach(item => set.add(item.productId));
      productIdsByStore.set(tx.storeId, set);
    });
    adminStoreMap.forEach((_, storeId) => {
      const productIds = productIdsByStore.get(storeId) || new Set();
      map.set(storeId, inventoryArray.filter(item => productIds.has(item.id)));
    });
    return map;
  }, [isAdminAllStores, adminStoreMap, allTransactions, inventoryArray]);
  const [dateRange, setDateRange] = useState("this-month");
  const [reportType, setReportType] = useState("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [reportToShare, setReportToShare] = useState<any>(null);
  const [vatRate, setVatRate] = useState(7.5);

  // Calculate Monthly Taxable Sales for VAT
  const vatSales = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return reportTransactions
      .filter(t => {
        const tDate = new Date(t.datetime);
        return t.status === "Completed" && 
               tDate.getMonth() === currentMonth && 
               tDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + Math.max(0, (t.subtotal || 0) - (t.discount || 0)), 0);
  }, [reportTransactions]);
  const [isWeeklyEmail, setIsWeeklyEmail] = useState(false);
  const [isMonthlyEmail, setIsMonthlyEmail] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [filingDate, setFilingDate] = useState<Date | undefined>(new Date(2026, 3, 21)); // Next FIRS deadline
  const [filingNotes, setFilingNotes] = useState("");
  const [filingEmail, setFilingEmail] = useState(currentUser?.email || "");
  const [filingPhone, setFilingPhone] = useState(currentStore?.phone || "");

  const vatDue = useMemo(() => (vatSales * vatRate) / 100, [vatSales, vatRate]);

  // Per-store monthly VAT breakdown for the Admin's all-stores view.
  const vatByStore = useMemo(() => {
    if (!isAdminAllStores) return [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const storeTotals: Record<string, number> = {};
    allTransactions.forEach((t) => {
      const tDate = new Date(t.datetime);
      if (
        t.status === "Completed" &&
        tDate.getMonth() === currentMonth &&
        tDate.getFullYear() === currentYear
      ) {
        storeTotals[t.storeId] =
          (storeTotals[t.storeId] || 0) +
          Math.max(0, (t.subtotal || 0) - (t.discount || 0));
      }
    });

    return allStores
      .map((store) => {
        const sales = storeTotals[store.id] || 0;
        return {
          id: store.id,
          name: store.name,
          sales,
          vat: (sales * vatRate) / 100,
        };
      })
      .filter((s) => s.sales > 0)
      .sort((a, b) => b.sales - a.sales);
  }, [allTransactions, allStores, vatRate, isAdminAllStores]);

  // Dynamic Chart Data
  const turnoverData = useMemo(() => {
    const now = new Date();
    const completedTx = reportTransactions.filter(t => t.status === "Completed");
    const points: { month: string; ratio: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const soldByProduct: Record<string, number> = {};
      let soldTotal = 0;

      completedTx.forEach(tx => {
        const dt = new Date(tx.datetime);
        if (dt < monthStart || dt >= monthEnd) return;
        tx.items.forEach(item => {
          const productId = item.productId;
          const qty = Number(item.qty) || 0;
          soldTotal += qty;
          soldByProduct[productId] = (soldByProduct[productId] || 0) + qty;
        });
      });

      const avgInventoryUnits = reportInventory.reduce((sum, inv) => {
        const sold = soldByProduct[inv.id] || 0;
        return sum + inv.stock + sold / 2;
      }, 0);

      const ratio = Number((((soldTotal / Math.max(1, avgInventoryUnits)) * 10)).toFixed(1));
      points.push({
        month: monthStart.toLocaleString("en-US", { month: "short" }),
        ratio,
      });
    }

    return points;
  }, [reportTransactions, reportInventory]);

  const stockoutRiskData = useMemo(() => {
    const categories = Array.from(new Set(reportInventory.map(i => i.category)));
    const riskByCategory = categories.map(cat => {
      const catItems = reportInventory.filter(i => i.category === cat);
      const lowStockItems = catItems.filter(i => i.stock <= i.reorderPoint);
      return {
        name: cat,
        value: lowStockItems.length,
        total: catItems.length
      };
    }).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

    const COLORS = ["#EF4444", "#F59E0B", "#6366F1", "#10B981", "#EC4899"];
    return riskByCategory.map((c, i) => ({
      ...c,
      color: COLORS[i % COLORS.length]
    }));
  }, [reportInventory]);

  const stockoutRiskTotal = useMemo(
    () => stockoutRiskData.reduce((sum, entry) => sum + entry.value, 0),
    [stockoutRiskData]
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB').replace(/\//g, '-'); // 17-03-2026
  const monthYear = now.toLocaleString('default', { month: 'long', year: 'numeric' }).replace(' ', '-'); // March-2026

  // Generation history (localStorage-backed)
  const historyKey = `sellsync_report_history_${currentUser?.id || "guest"}`;
  const [generationHistory, setGenerationHistory] = useState<Array<{
    reportId: string;
    generatedAt: string;
    fileName: string;
    format: string;
  }>>(() => {
    try {
      return JSON.parse(localStorage.getItem(historyKey) || "[]");
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(historyKey, JSON.stringify(generationHistory));
  }, [generationHistory, historyKey]);

  // Compute real stats from data
  const completedTx = useMemo(() => reportTransactions.filter(t => t.status === "Completed"), [reportTransactions]);
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const todayTx = completedTx.filter(t => t.datetime.slice(0, 10) === today);
    const weekTx = completedTx.filter(t => t.datetime.slice(0, 10) >= weekAgo);
    const monthTx = completedTx.filter(t => t.datetime.slice(0, 10) >= monthStart);
    const quarterTx = completedTx.filter(t => t.datetime.slice(0, 10) >= quarterStart);

    const sumRev = (tx: typeof completedTx) => tx.reduce((s, t) => s + t.amount, 0);
    const sumUnits = (tx: typeof completedTx) => tx.reduce((s, t) => s + t.items.reduce((si, i) => si + i.qty, 0), 0);

    const lowStockItems = reportInventory.filter(i => i.stock <= i.reorderPoint);
    const criticalItems = reportInventory.filter(i => i.stock < i.reorderPoint * 0.5);
    const expiringItems = reportInventory.filter(i => {
      if (!i.expiryDate) return false;
      const exp = new Date(i.expiryDate);
      const cutoff = new Date(Date.now() + 30 * 86400000);
      return exp <= cutoff;
    });

    const staffMap: Record<string, { sales: number; count: number }> = {};
    completedTx.forEach(t => {
      const name = t.cashier || "Admin";
      if (!staffMap[name]) staffMap[name] = { sales: 0, count: 0 };
      staffMap[name].sales += t.amount;
      staffMap[name].count += 1;
    });

    const productMap: Record<number, { revenue: number; units: number; name: string }> = {};
    completedTx.forEach(t => {
      t.items.forEach(item => {
        const p = reportInventory.find(inv => inv.id === item.productId);
        if (!productMap[item.productId]) productMap[item.productId] = { revenue: 0, units: 0, name: p?.name || "Unknown" };
        productMap[item.productId].revenue += item.qty * item.price;
        productMap[item.productId].units += item.qty;
      });
    });

    const storeMap: Record<string, { revenue: number; transactions: number; name: string }> = {};
    completedTx.forEach(t => {
      if (!storeMap[t.storeId]) {
        const store = allStores.find(s => s.id === t.storeId);
        storeMap[t.storeId] = { revenue: 0, transactions: 0, name: store?.name || t.storeId };
      }
      storeMap[t.storeId].revenue += t.amount;
      storeMap[t.storeId].transactions += 1;
    });

    const topProducts = Object.entries(productMap).sort(([, a], [, b]) => b.revenue - a.revenue);
    const topStaff = Object.entries(staffMap).sort(([, a], [, b]) => b.sales - a.sales);
    const storeList = Object.entries(storeMap).sort(([, a], [, b]) => b.revenue - a.revenue);

    const prevMonthTx = completedTx.filter(t => {
      const d = t.datetime.slice(0, 10);
      const prevMonthEnd = monthStart;
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      return d >= prevMonthStart && d < prevMonthEnd;
    });

    const monthGrowth = prevMonthTx.length > 0
      ? ((sumRev(monthTx) - sumRev(prevMonthTx)) / sumRev(prevMonthTx)) * 100
      : 0;

    return {
      today: { count: todayTx.length, revenue: sumRev(todayTx), units: sumUnits(todayTx) },
      week: { count: weekTx.length, revenue: sumRev(weekTx), units: sumUnits(weekTx) },
      month: { count: monthTx.length, revenue: sumRev(monthTx), units: sumUnits(monthTx), growth: monthGrowth },
      quarter: { count: quarterTx.length, revenue: sumRev(quarterTx), units: sumUnits(quarterTx) },
      inventory: { total: reportInventory.length, lowStock: lowStockItems.length, critical: criticalItems.length, expiring: expiringItems.length },
      topProducts,
      topStaff,
      storeList,
      totalProductsSold: sumUnits(completedTx),
    };
  }, [completedTx, reportInventory, allStores, monthStart, quarterStart, today, weekAgo, now]);

  const availableReports = useMemo(() => {
    const reports = [
      {
        id: "daily-sales",
        name: `Daily Sales Summary`,
        description: `${stats.today.count} transactions — ${currency.symbol}${stats.today.revenue.toLocaleString()} revenue`,
        stat: `${stats.today.units} units sold`,
        date: now.toLocaleDateString(),
        type: "Sales",
        format: "Excel",
        category: "Sales",
        hasAI: false,
      },
      {
        id: "weekly-sales",
        name: `Weekly Sales Report`,
        description: `${stats.week.count} transactions — ${currency.symbol}${stats.week.revenue.toLocaleString()} revenue`,
        stat: `${stats.week.units} units sold`,
        date: now.toLocaleDateString(),
        type: "Sales",
        format: "Excel",
        category: "Sales",
        hasAI: true,
      },
      {
        id: "monthly-sales",
        name: `Monthly Sales Report — ${monthYear}`,
        description: `${stats.month.count} transactions — ${currency.symbol}${stats.month.revenue.toLocaleString()} revenue`,
        stat: `${stats.month.units} units · ${stats.month.growth >= 0 ? '+' : ''}${stats.month.growth.toFixed(1)}% vs last month`,
        date: now.toLocaleDateString(),
        type: "Sales",
        format: "Excel",
        category: "Sales",
        hasAI: true,
      },
      {
        id: "quarterly-sales",
        name: `Quarterly Sales Report — Q${getQuarter(now)} ${now.getFullYear()}`,
        description: `${stats.quarter.count} transactions — ${currency.symbol}${stats.quarter.revenue.toLocaleString()} revenue`,
        stat: `${stats.quarter.units} units sold`,
        date: now.toLocaleDateString(),
        type: "Finance",
        format: "PDF",
        category: "Financial",
        hasAI: true,
      },
      {
        id: "inventory-status",
        name: `Inventory Status Report`,
        description: `${stats.inventory.total} products tracked — ${stats.inventory.lowStock} below reorder point`,
        stat: `${stats.inventory.expiring} expiring within 30 days`,
        date: now.toLocaleDateString(),
        type: "Inventory",
        format: "Excel",
        category: "Inventory",
        hasAI: false,
      },
      {
        id: "low-stock",
        name: `Low Stock Alert`,
        description: `${stats.inventory.lowStock} items below reorder point — ${stats.inventory.critical} critically low`,
        stat: `Immediate reorder recommended`,
        date: now.toLocaleDateString(),
        type: "Inventory",
        format: "Excel",
        category: "Inventory",
        hasAI: false,
      },
      {
        id: "product-performance",
        name: `Product Performance Report`,
        description: `${stats.topProducts.length} products analyzed — Top: ${stats.topProducts[0]?.[1]?.name || "N/A"}`,
        stat: `${stats.totalProductsSold} total units sold`,
        date: now.toLocaleDateString(),
        type: "Analytics",
        format: "Excel",
        category: "Performance",
        hasAI: true,
      },
      {
        id: "staff-performance",
        name: `Staff Performance Report`,
        description: `${stats.topStaff.length} staff members — Top: ${stats.topStaff[0]?.[0] || "N/A"}`,
        stat: `${currency.symbol}${stats.topStaff[0]?.[1]?.sales.toLocaleString() || 0} top seller`,
        date: now.toLocaleDateString(),
        type: "Analytics",
        format: "Excel",
        category: "Performance",
        hasAI: false,
      },
      {
        id: "financial-summary",
        name: `Financial Summary — Q${getQuarter(now)} ${now.getFullYear()}`,
        description: `${currency.symbol}${stats.quarter.revenue.toLocaleString()} total revenue — ${stats.quarter.count} completed orders`,
        stat: `${currency.symbol}${(stats.quarter.revenue * vatRate / 100).toLocaleString()} VAT due`,
        date: now.toLocaleDateString(),
        type: "Finance",
        format: "PDF",
        category: "Financial",
        hasAI: true,
      },
    ];

    if (isAdminAllStores) {
      reports.push({
        id: "store-comparison",
        name: `Store Comparison Report`,
        description: `${stats.storeList.length} stores compared — Top: ${stats.storeList[0]?.[1]?.name || "N/A"}`,
        stat: `${currency.symbol}${stats.storeList[0]?.[1]?.revenue.toLocaleString() || 0} top store revenue`,
        date: now.toLocaleDateString(),
        type: "Analytics",
        format: "Excel",
        category: "Performance",
        hasAI: true,
      });
    }

    return reports;
  }, [stats, currency, monthYear, now, isAdminAllStores, vatRate]);

  const handleGenerate = (type: string) => {
    let blob: Blob | null = null;
    let fileName = "";
    const invMap = Object.fromEntries(reportInventory.map(i => [i.id, i]));

    toast.promise(
      new Promise((resolve) => {
        setTimeout(() => {
          if (type === "Sales Report") {
            blob = generateSalesExcel(reportTransactions, invMap, currency, isAdminAllStores ? "All_Stores_Sales_Report" : "Daily_Weekly_Sales_Summary", adminStoreMap);
            fileName = `Sales_Report_${dateStr}.xlsx`;
          } else if (type === "Inventory Report") {
            blob = generateInventoryExcel(reportInventory, adminStoreMap, adminInventoryByStore);
            fileName = `Inventory_Report_${dateStr}.xlsx`;
          } else if (type === "Performance Report") {
            blob = generatePerformanceExcel(reportTransactions, invMap, 0, adminStoreMap);
            fileName = `Performance_Report_${dateStr}.xlsx`;
          }

          if (blob) {
            downloadFile(blob, fileName);
            resolve(true);
          }
        }, 1500);
      }),
      {
        loading: `Generating ${type}...`,
        success: `${type} generated and downloaded!`,
        error: "Failed to generate report.",
      }
    );
  };

  const handleDownloadAvailable = (report: any) => {
    let blob: Blob | null = null;
    let fileName = "";
    const invMap = Object.fromEntries(reportInventory.map(i => [i.id, i]));
    const storeLabel = isAdminAllStores ? "All_Stores" : (currentStore?.name || "Main_Store").replace(/\s+/g, "_");

    if (report.id === "daily-sales") {
      const todayTx = reportTransactions.filter(t => t.status === "Completed" && t.datetime.slice(0, 10) === today);
      blob = generateSalesExcel(todayTx, invMap, currency, "Daily_Sales_Summary", adminStoreMap);
      fileName = `Daily_Sales_${storeLabel}_${dateStr}.xlsx`;
    } else if (report.id === "weekly-sales") {
      const weekTx = reportTransactions.filter(t => t.status === "Completed" && t.datetime.slice(0, 10) >= weekAgo);
      blob = generateSalesExcel(weekTx, invMap, currency, "Weekly_Sales_Report", adminStoreMap);
      fileName = `Weekly_Sales_${storeLabel}_${dateStr}.xlsx`;
    } else if (report.id === "monthly-sales") {
      blob = generateSalesExcel(reportTransactions, invMap, currency, "Monthly_Sales_Report", adminStoreMap);
      fileName = `Monthly_Sales_${storeLabel}_${monthYear}.xlsx`;
    } else if (report.id === "quarterly-sales") {
      const quarterTx = reportTransactions.filter(t => t.status === "Completed" && t.datetime.slice(0, 10) >= quarterStart);
      blob = generateSalesExcel(quarterTx, invMap, currency, "Quarterly_Sales_Report", adminStoreMap);
      fileName = `Quarterly_Sales_${storeLabel}_Q${getQuarter(now)}_${now.getFullYear()}.xlsx`;
    } else if (report.id === "inventory-status") {
      blob = generateInventoryExcel(reportInventory, adminStoreMap, adminInventoryByStore);
      fileName = `Inventory_Status_${storeLabel}_${dateStr}.xlsx`;
    } else if (report.id === "low-stock") {
      const lowStockItems = reportInventory.filter(i => i.stock <= i.reorderPoint);
      blob = generateInventoryExcel(lowStockItems, adminStoreMap, adminInventoryByStore);
      fileName = `Low_Stock_Alert_${storeLabel}_${dateStr}.xlsx`;
    } else if (report.id === "product-performance") {
      blob = generatePerformanceExcel(reportTransactions, invMap, 10, adminStoreMap);
      fileName = `Product_Performance_${storeLabel}_${dateStr}.xlsx`;
    } else if (report.id === "staff-performance") {
      blob = generatePerformanceExcel(reportTransactions, invMap, 0, adminStoreMap);
      fileName = `Staff_Performance_${storeLabel}_${dateStr}.xlsx`;
    } else if (report.id === "financial-summary") {
      blob = generateFinancialPDF(reportTransactions, currency, isAdminAllStores ? "All Stores" : currentStore?.name || "Main Store", adminStoreMap);
      fileName = `Financial_Summary_${storeLabel}_Q${getQuarter(now)}_${now.getFullYear()}.pdf`;
    } else if (report.id === "store-comparison") {
      blob = generatePerformanceExcel(reportTransactions, invMap, 0, adminStoreMap);
      fileName = `Store_Comparison_${dateStr}.xlsx`;
    }

    if (blob) {
      downloadFile(blob, fileName);
      setGenerationHistory(prev => [{
        reportId: report.id,
        generatedAt: new Date().toISOString(),
        fileName,
        format: report.format,
      }, ...prev].slice(0, 20));
    }
  };

  const handleExportVatForm = () => {
    toast.promise(
      new Promise(async (resolve) => {
        const blob = generateVatPDF(
          isAdminAllStores
            ? {
                ...currentStore,
                name: "SellSync — All Stores",
                tin: "",
                address: "",
                city: "",
              }
            : currentStore,
          reportTransactions,
          vatRate,
          currency,
          isAdminAllStores ? vatByStore : undefined,
        );
        const fileName = `VAT_Return_Form_${now.toLocaleString('default', { month: 'long' })}-${now.getFullYear()}.pdf`;
        downloadFile(blob, fileName);
        setTimeout(resolve, 1000);
      }),
      {
        loading: "Generating VAT Return Form...",
        success: "VAT form exported successfully",
        error: "Failed to export VAT form",
      }
    );
  };

  const handleScheduleFiling = () => {
    if (!filingDate) {
      toast.error("Please select a filing date");
      return;
    }
    
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: "Scheduling VAT filing reminder...",
        success: `VAT filing reminder scheduled for ${format(filingDate, "PPP")}`,
        error: "Failed to schedule reminder",
      }
    );
    setIsScheduleModalOpen(false);
  };

  const handleShareEmail = (report: any) => {
    setReportToShare({
      name: report.name || report.title,
      type: report.type || "General Report",
      format: report.format || "PDF"
    });
    setEmailModalOpen(true);
  };

  const handleShareSMS = (report: any) => {
    setReportToShare({
      name: report.name || report.title,
      type: report.type || "General Report",
      format: report.format || "PDF"
    });
    setSmsModalOpen(true);
  };

  const handlePreview = (report: any) => {
    setSelectedReport(report);
    setPreviewOpen(true);
  };

  return (
    <Stagger className={embedded ? "space-y-8" : "px-8 pt-2 pb-8 space-y-8 bg-surface min-h-screen"}>
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className={embedded ? "text-lg font-black text-gray-900" : "text-3xl font-black text-gray-900 dark:text-white tracking-tight"}>Reports</h1>
              {isAdminAllStores && (
                <Badge className="bg-indigo-600 text-white border-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg">
                  All Stores
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Generate and download business reports
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canEdit("Reports") && (
              <Button 
                className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold gap-2 shadow-lg shadow-indigo-100 transition-all"
                onClick={() => setCustomModalOpen(true)}
              >
                <Plus className="w-5 h-5" />
                Create Custom Report
              </Button>
            )}
          </div>
        </div>

        {/* KPI Row — hidden for admin in overview mode */}
        {!isAdminAllStores && (
        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" variants={staggerContainer} initial="hidden" animate="visible">
          {[
            { 
              label: "Total Revenue", 
              value: formatCurrency(kpis.totalRevenue24h), 
              change: `${kpis.totalRevenue24hChange > 0 ? "+" : ""}${kpis.totalRevenue24hChange}%`, 
              color: kpis.totalRevenue24hChange >= 0 ? "text-green-600" : "text-red-600", 
              bg: kpis.totalRevenue24hChange >= 0 ? "bg-green-50" : "bg-red-50", 
              icon: DollarSign 
            },
            { label: "Sales Growth", value: `${kpis.totalSales24hChange > 0 ? "+" : ""}${kpis.totalSales24hChange}%`, change: "vs previous 24h", color: "text-blue-600", bg: "bg-blue-50", icon: TrendingUp },
            { label: "Units Sold", value: kpis.productsSold24h.toLocaleString(), change: "Last 24h", color: "text-purple-600", bg: "bg-purple-50", icon: Package },
            { label: "Reports Generated", value: "24", change: "This month", color: "text-indigo-600", bg: "bg-primary-fixed", icon: FileText },
          ].map((stat, i) => (
            <motion.div key={i} variants={fadeInUp}>
              <Card className="border-none shadow-sm bg-surface-container-lowest rounded-3xl overflow-hidden group hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold border-primary-fixed text-indigo-600 animate-pulse">
                      LIVE
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <KPIValue 
                        value={stat.value} 
                        className="text-gray-900 mt-1"
                        animate 
                      />
                      <span className={`text-xs font-bold ${stat.color}`}>{stat.change}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
        )}

        {/* Generate Report Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm bg-surface-container-lowest rounded-3xl group hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-primary-fixed rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                  <FileSpreadsheet className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900">Sales Report</h3>
                  <p className="text-xs text-gray-500 font-medium">Daily & Weekly sales summary</p>
                </div>
              </div>
              {canView("Reports") && (
                <Button 
                  className="w-full h-12 rounded-xl bg-gray-900 hover:bg-black text-white font-bold gap-2 shadow-lg shadow-gray-200 transition-all"
                  onClick={() => handleGenerate("Sales Report")}
                >
                  <DownloadIcon className="w-4 h-4" />
                  Generate Report
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-surface-container-lowest rounded-3xl group hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-600 transition-colors">
                  <Package className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900">Inventory Report</h3>
                  <p className="text-xs text-gray-500 font-medium">Stock levels & valuation</p>
                </div>
              </div>
              {canView("Reports") && (
                <Button 
                  className="w-full h-12 rounded-xl bg-gray-900 hover:bg-black text-white font-bold gap-2 shadow-lg shadow-gray-200 transition-all"
                  onClick={() => handleGenerate("Inventory Report")}
                >
                  <DownloadIcon className="w-4 h-4" />
                  Generate Report
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-surface-container-lowest rounded-3xl group hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                  <TrendingUp className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900">Performance Report</h3>
                  <p className="text-xs text-gray-500 font-medium">Product & Staff performance</p>
                </div>
              </div>
              {canView("Reports") && (
                <Button 
                  className="w-full h-12 rounded-xl bg-gray-900 hover:bg-black text-white font-bold gap-2 shadow-lg shadow-gray-200 transition-all"
                  onClick={() => handleGenerate("Performance Report")}
                >
                  <DownloadIcon className="w-4 h-4" />
                  Generate Report
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reports Visuals — hidden for admin in overview mode */}
        {!isAdminAllStores && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Inventory Turnover */}
          <Card className="border-none shadow-sm bg-surface-container-lowest rounded-[2rem] overflow-hidden">
            <CardHeader className="p-8 pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <BarChart4 className="w-5 h-5 text-purple-600" />
                </div>
                <Badge className="bg-purple-50 text-purple-700 border-purple-100 font-bold">Real-time</Badge>
              </div>
              <CardTitle className="text-xl font-black text-gray-900">Inventory Turnover Trend</CardTitle>
              <p className="text-sm text-gray-500 font-medium">Last 6 months turnover ratio</p>
            </CardHeader>
            <CardContent className="p-8 pt-6">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={turnoverData}>
                    <defs>
                      <linearGradient id="colorTurnover" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Area type="monotone" dataKey="ratio" stroke="#8B5CF6" strokeWidth={4} fillOpacity={1} fill="url(#colorTurnover)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Right: Stockout Risk */}
          <Card className="border-none shadow-sm bg-surface-container-lowest rounded-[2rem] overflow-hidden">
            <CardHeader className="p-8 pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <PieChartIcon className="w-5 h-5 text-red-600" />
                </div>
                <Badge className="bg-red-50 text-red-700 border-red-100 font-bold">Urgent</Badge>
              </div>
              <CardTitle className="text-xl font-black text-gray-900">Stockout Risk by Category</CardTitle>
              <p className="text-sm text-gray-500 font-medium">This month distribution</p>
            </CardHeader>
            <CardContent className="p-8 pt-6">
              <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stockoutRiskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {stockoutRiskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-3xl font-black text-gray-900">{stockoutRiskTotal}</p>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">At Risk</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Tax / VAT Calculator */}
        <Card className="border-none shadow-sm bg-surface-container-lowest rounded-[2rem] overflow-hidden">
          <CardHeader className="p-8 pb-4 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-fixed rounded-xl flex items-center justify-center">
                <Calculator className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-gray-900">Tax / VAT Calculator</CardTitle>
                <p className="text-sm text-gray-500 font-medium">
                  {isAdminAllStores
                    ? "Live VAT calculation across all your stores"
                    : "Live VAT calculation based on store sales"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 uppercase tracking-widest">Sales Value ({currency.symbol})</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">{currency.symbol}</span>
                  <Input 
                    type="text" 
                    value={vatSales.toLocaleString()} 
                    readOnly
                    className="h-14 pl-10 bg-surface-container border-none rounded-2xl text-lg font-black focus:ring-0 cursor-not-allowed opacity-80"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 uppercase tracking-widest">VAT Rate (%)</Label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                  <Input 
                    type="number" 
                    value={vatRate} 
                    onChange={(e) => setVatRate(Number(e.target.value))} 
                    className="h-14 pr-10 bg-surface-container-low border-none rounded-2xl text-lg font-black focus:ring-2 focus:ring-primary-container/30"
                  />
                </div>
              </div>
              <div className="bg-indigo-600 rounded-[1.5rem] p-6 text-white shadow-xl shadow-indigo-100 flex flex-col justify-center">
                <p className="text-xs font-black text-indigo-200 uppercase tracking-[0.2em] mb-1">VAT Due</p>
                <p className="text-3xl font-black tracking-tight">{formatCurrency(vatDue)}</p>
              </div>
            </div>

            {isAdminAllStores && (
              <div className="mt-8 rounded-2xl border border-outline-variant/40 bg-surface-container-low/50 overflow-hidden">
                <div className="px-5 py-3 border-b border-outline-variant/40 flex items-center justify-between">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    VAT Breakdown by Store
                  </p>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {vatByStore.length} store{vatByStore.length === 1 ? "" : "s"} with sales
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  {vatByStore.length === 0 ? (
                    <div className="px-5 py-4 text-sm font-medium text-gray-400">
                      No completed sales this month yet.
                    </div>
                  ) : (
                    vatByStore.map((s) => (
                      <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                            Taxable sales: {formatCurrency(s.sales)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-indigo-600">{formatCurrency(s.vat)}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                            VAT @ {vatRate}%
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-8">
              <Button 
                className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold gap-2 shadow-lg shadow-indigo-100 transition-all"
                onClick={handleExportVatForm}
              >
                <DownloadIcon className="w-5 h-5" />
                Export VAT Form
              </Button>
              <Button 
                variant="outline" 
                className="h-12 px-8 rounded-xl bg-surface-container-low border-outline-variant/40 text-gray-600 hover:bg-surface-container font-bold gap-2 transition-all"
                onClick={() => setIsScheduleModalOpen(true)}
              >
                <Calendar className="w-5 h-5" />
                Schedule Filing
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Schedule VAT Filing Modal */}
        <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-surface-container-lowest">
            <DialogHeader className="p-8 pb-4 bg-surface-container-low/50 border-b border-outline-variant/40">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-100">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-gray-900">Schedule VAT Filing</DialogTitle>
                  <DialogDescription className="text-gray-500 font-medium">Set a reminder for your next tax submission</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black text-gray-400 uppercase tracking-widest">Filing Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full h-12 justify-start text-left font-bold bg-surface-container-low border-outline-variant/40 rounded-xl",
                          !filingDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4 text-purple-600" />
                        {filingDate ? format(filingDate, "PPP") : <span>Pick a deadline</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={filingDate}
                        onSelect={setFilingDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-gray-400 uppercase tracking-widest">Reminder Email</Label>
                    <Input 
                      placeholder="admin@example.com" 
                      value={filingEmail}
                      onChange={(e) => setFilingEmail(e.target.value)}
                      className="h-12 bg-surface-container-low border-outline-variant/40 rounded-xl focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-gray-400 uppercase tracking-widest">Reminder SMS</Label>
                    <Input 
                      placeholder="0801 234 5678" 
                      value={filingPhone}
                      onChange={(e) => setFilingPhone(e.target.value)}
                      className="h-12 bg-surface-container-low border-outline-variant/40 rounded-xl focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black text-gray-400 uppercase tracking-widest">Notes</Label>
                  <Textarea 
                    placeholder="Add any specific instructions for this filing..." 
                    rows={3}
                    value={filingNotes}
                    onChange={(e) => setFilingNotes(e.target.value)}
                    className="bg-surface-container-low border-outline-variant/40 rounded-2xl focus:ring-2 focus:ring-purple-100 resize-none font-medium"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="p-8 pt-0 flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-14 rounded-2xl border-outline-variant/40 font-bold hover:bg-surface-container-low transition-all"
                onClick={() => setIsScheduleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-[2] h-14 rounded-2xl bg-purple-600 hover:bg-purple-700 font-black text-lg shadow-xl shadow-purple-100 transition-all"
                onClick={handleScheduleFiling}
              >
                Schedule Reminder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Available Reports Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Available Reports</h2>
              <p className="text-gray-500 font-medium">Real-time data · Generated from {reportTransactions.length} transactions & {reportInventory.length} products</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {availableReports.map((report) => (
              <Card key={report.id} className="border-none shadow-sm bg-surface-container-lowest rounded-3xl overflow-hidden group hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5 flex-1">
                      <div className="w-14 h-14 bg-surface-container-low rounded-2xl flex items-center justify-center group-hover:bg-primary-fixed transition-colors">
                        <FileText className="w-7 h-7 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-black text-gray-900 group-hover:text-indigo-600 transition-colors">{report.name}</h3>
                          {report.hasAI && (
                            <Badge className="bg-primary-fixed text-indigo-700 border-primary-fixed font-bold text-[10px]">AI INSIGHT READY</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 font-medium">{report.description}</p>
                        <p className="text-xs text-indigo-500 font-bold mt-1">{report.stat}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <Badge variant="outline" className="bg-surface-container-low/50 border-outline-variant/40 text-gray-500 font-bold">{report.category}</Badge>
                          <Badge className="bg-green-50 text-green-700 border-green-100 font-bold">{report.format}</Badge>
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">{report.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {canEdit("Reports") && (
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-gray-400 hover:text-indigo-600 font-bold" onClick={() => handleShareEmail(report)}>
                          <Mail className="w-5 h-5" />
                        </Button>
                      )}
                      {canEdit("Reports") && (
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-gray-400 hover:text-green-600 font-bold" onClick={() => handleShareSMS(report)}>
                          <MessageSquare className="w-5 h-5" />
                        </Button>
                      )}
                      <Button variant="ghost" className="h-12 px-6 rounded-xl text-gray-400 hover:text-indigo-600 font-bold gap-2" onClick={() => handlePreview(report)}>
                        <Eye className="w-5 h-5" />
                        Preview
                      </Button>
                      <Button 
                        className="h-12 px-8 rounded-xl bg-gray-900 hover:bg-black text-white font-bold gap-2 shadow-lg shadow-gray-200" 
                        onClick={() => handleDownloadAvailable(report)}
                      >
                        <Download className="w-5 h-5" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Generation History */}
        {generationHistory.length > 0 && (
          <div className="space-y-4 mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Recent Downloads</h3>
                <p className="text-gray-500 font-medium text-sm">Last {generationHistory.length} generated reports</p>
              </div>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500 font-bold text-xs" onClick={() => setGenerationHistory([])}>
                Clear History
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {generationHistory.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-3 bg-surface-container-lowest rounded-2xl border border-gray-50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#00A651]" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">{entry.fileName}</p>
                      <p className="text-xs text-gray-400 font-medium">{new Date(entry.generatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <Badge className="bg-surface-container-low text-gray-500 border-outline-variant/40 font-bold">{entry.format}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <ReportPreviewModal 
          open={previewOpen} 
          onClose={() => setPreviewOpen(false)} 
          report={selectedReport}
          onEmail={handleShareEmail}
          onSMS={handleShareSMS}
          onDownload={handleDownloadAvailable}
        />
        <CustomReportModal open={customModalOpen} onClose={() => setCustomModalOpen(false)} />
        <EmailShareModal 
          open={emailModalOpen} 
          onClose={() => setEmailModalOpen(false)} 
          reportName={reportToShare?.name || "Report"} 
          reportType={reportToShare?.type || "General Report"}
          file={null} // Passing null for now, can be extended to pass generated blobs
        />
        <SMSShareModal 
          open={smsModalOpen} 
          onClose={() => setSmsModalOpen(false)} 
          reportName={reportToShare?.name || "Report"} 
          reportType={reportToShare?.type || "General Report"}
        />
      </Stagger>
  );
}

