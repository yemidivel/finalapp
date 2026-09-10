import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { FileText, Download, Mail, MessageSquare } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { motion } from "framer-motion";
import React, { useMemo } from "react";
import { useStore } from "../state/store";

type ReportPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  report: any;
  onEmail: (report: any) => void;
  onSMS: (report: any) => void;
  onDownload: (report: any) => void;
};

export function ReportPreviewModal({ open, onClose, report, onEmail, onSMS, onDownload }: ReportPreviewModalProps) {
  const { transactions, inventoryArray, formatCurrency } = useStore();

  const preview = useMemo(() => {
    const completedTx = transactions.filter((t) => t.status === "Completed");
    const invMap = Object.fromEntries(inventoryArray.map((p) => [p.id, p]));

    const totals = completedTx.reduce(
      (acc, tx) => {
        acc.revenue += tx.amount;
        acc.orders += 1;
        acc.units += tx.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
        acc.taxable += Math.max(0, (tx.subtotal || 0) - (tx.discount || 0));
        return acc;
      },
      { revenue: 0, taxable: 0, orders: 0, units: 0 }
    );

    const categoryTotals: Record<string, number> = {};
    completedTx.forEach((tx) => {
      tx.items.forEach((it) => {
        const p = invMap[Number(it.productId)];
        const cat = p?.category || "Uncategorized";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(it.qty) || 0) * (Number(it.price) || 0);
      });
    });
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0];

    const productTotals: Record<number, { revenue: number; units: number }> = {};
    completedTx.forEach((tx) => {
      tx.items.forEach((it) => {
        const id = Number(it.productId);
        const qty = Number(it.qty) || 0;
        const rev = qty * (Number(it.price) || 0);
        productTotals[id] = productTotals[id] || { revenue: 0, units: 0 };
        productTotals[id].revenue += rev;
        productTotals[id].units += qty;
      });
    });
    const topProduct = Object.entries(productTotals)
      .map(([id, s]) => ({ id: Number(id), ...s, name: invMap[Number(id)]?.name || `#${id}` }))
      .sort((a, b) => b.revenue - a.revenue)[0];

    const stockOnHand = inventoryArray.reduce((sum, p) => sum + p.stock, 0);
    const lowStockSkus = inventoryArray.filter((p) => p.stock <= p.reorderPoint).length;
    const valuation = inventoryArray.reduce((sum, p) => sum + p.stock * p.price, 0);

    const type = (report?.type || "").toLowerCase();
    const name = report?.name || "Report";

    if (type.includes("inventory")) {
      return {
        title: name,
        summary: `Snapshot of current stock, reorder risk, valuation, and expiry exposure for your inventory.`,
        kpiA: { label: "SKUs", value: inventoryArray.length.toLocaleString(), color: "text-indigo-600" },
        kpiB: { label: "Low Stock SKUs", value: lowStockSkus.toLocaleString(), color: lowStockSkus > 0 ? "text-red-600" : "text-green-600" },
        insight: lowStockSkus > 0 ? `Immediate attention needed: ${lowStockSkus} SKUs are at/below reorder point.` : "Stock health looks stable with no SKUs currently below reorder point.",
      };
    }

    if (type.includes("finance")) {
      const vatRate = 7.5;
      const vatDue = (totals.taxable * vatRate) / 100;
      const profitEst = totals.revenue * 0.25;
      return {
        title: name,
        summary: `Financial summary including revenue, estimated profit, and VAT position for the selected period.`,
        kpiA: { label: "Revenue", value: formatCurrency(totals.revenue), color: "text-indigo-600" },
        kpiB: { label: `VAT Due (${vatRate}%)`, value: formatCurrency(vatDue), color: "text-purple-600" },
        insight: `Estimated profit (25% margin): ${formatCurrency(profitEst)}.`,
      };
    }

    if (type.includes("analytics") || type.includes("performance")) {
      return {
        title: name,
        summary: `Performance analysis highlighting best sellers, contribution, and operational signals from sales + stock.`,
        kpiA: { label: "Top Product", value: topProduct ? topProduct.name : "N/A", color: "text-indigo-600" },
        kpiB: { label: "Revenue", value: formatCurrency(totals.revenue), color: "text-green-600" },
        insight: topProduct ? `${topProduct.name} leads with ${formatCurrency(topProduct.revenue)} revenue (${topProduct.units} units).` : "No sales data available for this period.",
      };
    }

    return {
      title: name,
      summary: `Sales report covering revenue, units sold, order volume, and category/product drivers.`,
      kpiA: { label: "Total Sales", value: formatCurrency(totals.revenue), color: "text-indigo-600" },
      kpiB: { label: "Orders", value: totals.orders.toLocaleString(), color: "text-green-600" },
      insight: topCategory ? `Top category by revenue: ${topCategory}.` : "No category sales data available for this period.",
    };
  }, [transactions, inventoryArray, formatCurrency, report?.name, report?.type]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
        <div className="bg-white">
          <DialogHeader className="p-8 pb-4 bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black text-gray-900">Report Preview</DialogTitle>
                <DialogDescription className="text-gray-500 font-medium">{report?.name || "Report Overview"}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-1">
                <h3 className="text-lg font-black text-gray-900 mb-1">{report?.name || "Selected Report"}</h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">{report?.description || "This report provides a comprehensive breakdown of business performance, including sales metrics, inventory turnover, and financial summaries."}</p>
                <div className="flex items-center gap-2 mt-4">
                  {report?.type && <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 font-bold">{report.type}</Badge>}
                  {report?.format && <Badge className="bg-green-50 text-green-700 border-green-100 font-bold">{report.format}</Badge>}
                  {report?.date && <span className="text-xs text-gray-400 font-black uppercase tracking-widest ml-auto">{report.date}</span>}
                </div>
              </div>
            </div>

            <Card className="border-gray-100 bg-gray-50/30 rounded-2xl overflow-hidden mb-8">
              <CardContent className="p-0">
                <ScrollArea className="h-[280px]">
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Executive Summary</p>
                        <p className="text-sm text-gray-600 font-medium leading-relaxed">
                          {preview.summary}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{preview.kpiA.label}</p>
                          <p className={`text-xl font-black ${preview.kpiA.color}`}>{preview.kpiA.value}</p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{preview.kpiB.label}</p>
                          <p className={`text-xl font-black ${preview.kpiB.color}`}>{preview.kpiB.value}</p>
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Key Insight</p>
                        <p className="text-sm text-gray-600 font-medium italic">"{preview.insight}"</p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="h-12 rounded-xl border-gray-200 font-bold gap-2 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                  onClick={() => onEmail(report)}
                >
                  <Mail className="w-5 h-5" />
                  Email Report
                </Button>
                <Button 
                  variant="outline" 
                  className="h-12 rounded-xl border-gray-200 font-bold gap-2 hover:bg-green-50 hover:text-green-600 transition-all"
                  onClick={() => onSMS(report)}
                >
                  <MessageSquare className="w-5 h-5" />
                  SMS Summary
                </Button>
              </div>
              <Button 
                className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black text-lg gap-3 shadow-xl shadow-indigo-100 transition-all"
                onClick={() => onDownload(report)}
              >
                <Download className="w-5 h-5" />
                Download Full Report
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

