import { useMemo, useState, useEffect } from "react";
import {
  Receipt,
  Calendar,
  CreditCard,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Wallet,
  ArrowRight,
  TrendingUp,
  Printer,
  Mail,
  Undo2,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Terminal,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Stagger } from "../../animations/Stagger";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { LiveDot } from "../components/LiveDot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { useStore } from "../state/store";
import { useNavigate } from "react-router";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { generateReceiptPDF, downloadReceiptPDF } from "../../lib/receipt";
import { EmailShareModal } from "../components/EmailShareModal";
import { KPIValue } from "../components/KPIValue";

function windowDelimiters(range: "24h" | "7d" | "30d") {
  const now = new Date();
  const start = new Date(now);
  if (range === "24h") {
    start.setHours(now.getHours() - 24);
  } else if (range === "7d") {
    start.setDate(now.getDate() - 7);
  } else {
    start.setDate(now.getDate() - 30);
  }
  return { start, now };
}

export function TransactionsPage() {
  const {
    transactions,
    inventory,
    refundTransaction,
    currency,
    currentStore,
    currentUser,
    allStores,
    users,
    formatCurrency,
    receiptDefaults,
    preferences,
    canEdit,
    refreshTransactions,
    refreshProducts,
    refreshAnalytics,
    refreshStoreInsight,
  } = useStore();
  const navigate = useNavigate();

  const isAdmin = currentUser?.role === "Admin";
  const isCashier = currentUser?.role === "Cashier";

  // Cashiers only ever see the sales they rang up, and the KPIs/totals are
  // computed from that same scoped set so the figures match their own till.
  const scopedTransactions = useMemo(() => {
    if (!isCashier) return transactions;
    return transactions.filter(
      (t) => t.cashier === currentUser?.id || t.cashier === currentUser?.name,
    );
  }, [transactions, isCashier, currentUser?.id, currentUser?.name]);

  const storeNameFor = (storeId: string) =>
    allStores.find((s) => s.id === storeId)?.name || storeId;

  const storeManagerFor = (storeId: string) => {
    const store = allStores.find((s) => s.id === storeId);
    const mgr = store?.managerId
      ? users.find((u) => u.id === store.managerId)
      : undefined;
    return (
      mgr ||
      users.find(
        (u) =>
          u.role === "Manager" && (u.assignedStoreIds || []).includes(storeId),
      )
    );
  };

  const formatTxnId = (id: string, admin: boolean) => {
    const lower = id.toLowerCase();
    if (admin) {
      return id.length > 10 ? `${id.slice(0, 9).toLowerCase()}…` : lower;
    }
    const first = id.indexOf("-");
    const second = first >= 0 ? id.indexOf("-", first + 1) : -1;
    return second >= 0 ? `${id.slice(0, second + 1).toLowerCase()}…` : lower;
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [dateOpen, setDateOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(
    null,
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "datetime",
    direction: "desc",
  });

  // Modal states for actions
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [transactionToEmail, setTransactionToEmail] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isRefundConfirmOpen, setIsRefundConfirmOpen] = useState(false);
  const [transactionToRefund, setTransactionToRefund] = useState<string | null>(
    null,
  );

  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
      // Remount the KPI figures so they count back up from zero on every refresh.
      setRefreshKey((k) => k + 1);
    } finally {
      // Keep the spinner visible briefly so the refresh reads as intentional.
      window.setTimeout(() => setRefreshing(false), 500);
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRows(next);
  };

  const handleRefund = (id: string) => {
    setTransactionToRefund(id);
    setIsRefundConfirmOpen(true);
  };

  const confirmRefund = () => {
    if (transactionToRefund) {
      refundTransaction(transactionToRefund);
      toast.success("Sale refunded and stock restored", {
        description: `Transaction ${transactionToRefund} has been reversed.`,
      });
      setIsRefundConfirmOpen(false);
      setTransactionToRefund(null);
    }
  };

  const handleReprint = (txn: any) => {
    if (!txn) {
      toast.error("Transaction data missing");
      return;
    }

    try {
      const items = (txn.items || []).map((it: any) => {
        const invItem = inventory[it.productId];
        return {
          name: invItem?.name ?? `#${it.productId}`,
          sku: invItem?.sku ?? "N/A",
          qty: it.qty,
          price: it.price,
          manufacturedDate: invItem?.manufacturedDate,
          expiryDate: invItem?.expiryDate,
        };
      });

      const blob = generateReceiptPDF({
        store: currentStore,
        transactionId: txn.id,
        date: new Date(txn.datetime).toLocaleString("en-GB"),
        cashier: txn.cashier || "System",
        customer: txn.customer || "Guest Customer",
        items,
        subtotal: txn.subtotal,
        discount: txn.discount,
        vat: txn.vat,
        total: txn.amount,
        paymentMethod: txn.payment,
        currency,
        terminalId: txn.terminalId,
        receiptDefaults: { ...receiptDefaults, ...preferences.receipts },
      });
      downloadReceiptPDF(blob, txn.id);
    } catch (err) {
      console.error("Reprint failed:", err);
      toast.error("Could not reprint receipt");
    }
  };

  const handleEmailReceipt = (txn: any) => {
    if (!txn) {
      toast.error("Transaction data missing");
      return;
    }

    try {
      const items = (txn.items || []).map((it: any) => {
        const invItem = inventory[it.productId];
        return {
          name: invItem?.name ?? `#${it.productId}`,
          sku: invItem?.sku ?? "N/A",
          qty: it.qty,
          price: it.price,
          manufacturedDate: invItem?.manufacturedDate,
          expiryDate: invItem?.expiryDate,
        };
      });

      const blob = generateReceiptPDF({
        store: currentStore,
        transactionId: txn.id,
        date: new Date(txn.datetime).toLocaleString("en-GB"),
        cashier: txn.cashier || "System",
        customer: txn.customer || "Guest Customer",
        items,
        subtotal: txn.subtotal,
        discount: txn.discount,
        vat: txn.vat,
        total: txn.amount,
        paymentMethod: txn.payment,
        currency,
        terminalId: txn.terminalId,
        receiptDefaults: { ...receiptDefaults, ...preferences.receipts },
      });

      setTransactionToEmail({ ...txn, blob });
      setIsEmailModalOpen(true);
    } catch (err) {
      console.error("Email preparation failed:", err);
      toast.error("Could not prepare receipt for email");
    }
  };

  const handleBulkRefund = () => {
    if (selectedRows.size === 0) return;
    if (!canEdit("Transactions")) {
      toast.error("You do not have permission to process refunds");
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to refund ${selectedRows.size} transactions?`,
      )
    ) {
      selectedRows.forEach((id) => refundTransaction(id));
      setSelectedRows(new Set());
    }
  };

  // Free-text search no longer filters the table. A search is a lookup: the
  // matched transactions are surfaced in the search box itself, while the list
  // below keeps showing the current payment/status/date view. Filtering the
  // whole table on a keystroke made an old sale disappear from the working set
  // the moment someone started typing an ID.
  const searchMatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return scopedTransactions
      .filter((txn) => {
        const idMatch = txn.id.toLowerCase().includes(term);
        const custMatch = (txn.customer ?? "").toLowerCase().includes(term);
        const amountMatch = txn.amount.toString().includes(term);
        return idMatch || custMatch || amountMatch;
      })
      .slice(0, 6);
  }, [scopedTransactions, searchTerm]);

  const filteredTransactions = useMemo(() => {
    const { start, now } = windowDelimiters(timeRange);
    let list = scopedTransactions.filter((txn) => {
      const t = new Date(txn.datetime);
      const matchesRange = t >= start && t <= now;
      const normalizedPayment =
        txn.payment === "Linked Account" ? "Card" : txn.payment;
      const matchesPayment =
        paymentFilter === "all" || normalizedPayment === paymentFilter;
      const matchesStatus =
        statusFilter === "all" || txn.status === statusFilter;

      let matchesDate = true;
      if (dateFrom) {
        matchesDate =
          matchesDate && txn.datetime >= new Date(dateFrom).toISOString();
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && txn.datetime <= end.toISOString();
      }
      return matchesRange && matchesPayment && matchesStatus && matchesDate;
    });

    if (sortConfig.key) {
      list = [...list].sort((a: any, b: any) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (sortConfig.direction === "asc") return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
    }

    return list;
  }, [
    scopedTransactions,
    timeRange,
    paymentFilter,
    statusFilter,
    dateFrom,
    dateTo,
    sortConfig,
  ]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [timeRange, paymentFilter, statusFilter, dateFrom, dateTo, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, Math.max(1, totalPages || 1)));
  }, [totalPages]);

  const kpis = useMemo(() => {
    const { start, now } = windowDelimiters(timeRange);
    const inWindow = (dt: string) => {
      const t = new Date(dt);
      return t >= start && t <= now;
    };
    const windowTx = scopedTransactions.filter((txn) => inWindow(txn.datetime));
    const windowCompleted = windowTx.filter(
      (transaction) => transaction.status === "Completed",
    );

    const cardTotal = windowCompleted
      .filter(
        (transaction) =>
          transaction.payment === "Linked Account" ||
          transaction.payment === "POS Terminal",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const cashTotal = windowCompleted
      .filter((transaction) => transaction.payment === "Cash")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const transferTotal = windowCompleted
      .filter((transaction) => transaction.payment === "Transfer")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const refundedCount = windowTx.filter(
      (transaction) => transaction.status === "Refunded",
    ).length;
    const avgTransaction =
      windowCompleted.reduce(
        (sum, transaction) => sum + transaction.amount,
        0,
      ) / (windowCompleted.length || 1);

    return {
      todayCount: windowCompleted.length,
      cardTotal,
      cashTotal,
      transferTotal,
      avgTransaction,
      refundedCount,
    };
  }, [scopedTransactions, timeRange]);

  const rangeLabel =
    timeRange === "24h"
      ? "last 24 hours"
      : timeRange === "7d"
        ? "last 7 days"
        : "last 30 days";

  const chartData = useMemo(
    () =>
      [
        { name: "Cash", value: kpis.cashTotal, color: "#8b5cf6" },
        { name: "Card", value: kpis.cardTotal, color: "#3b82f6" },
        { name: "Transfer", value: kpis.transferTotal, color: "#f59e0b" },
      ].filter((d) => d.value > 0),
    [kpis],
  );

  const details = useMemo(() => {
    if (!selectedTransaction) return null;
    const tx = scopedTransactions.find((t) => t.id === selectedTransaction);
    if (!tx) return null;
    const items = tx.items.map((it) => ({
      name: inventory[it.productId]?.name ?? `#${it.productId}`,
      qty: it.qty,
      price: it.price,
    }));
    const dt = new Date(tx.datetime);
    return {
      ...tx,
      items,
      date: dt.toISOString().slice(0, 10),
      time: dt.toTimeString().slice(0, 5),
    };
  }, [selectedTransaction, scopedTransactions, inventory]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const getPaymentBadge = (method: string) => {
    const label =
      method === "Linked Account" || method === "POS Terminal"
        ? "Card"
        : method;
    return (
      <Badge
        variant="outline"
        className="uppercase tracking-widest text-gray-600 border-gray-300 font-bold text-[10px]"
      >
        {label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
            Completed
          </Badge>
        );
      case "Refunded":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
            Refunded
          </Badge>
        );
      case "Pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Stagger className="px-6 pt-2 pb-8 space-y-6 min-h-screen bg-surface text-on-surface">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Transactions</h1>
            <LiveDot size="h-4 w-4" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Monitor, reconcile, and manage your sales history
          </p>
        </div>
        <div className="flex items-center gap-3">
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
            aria-label="Refresh transactions"
          >
            <RefreshCcw
              className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div key={refreshKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className="bento-card bento-card-hover border-none shadow-none"
          onClick={() => setPaymentFilter("Transfer")}
        >
          <CardContent className="pt-6 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transfer
                </p>
                <KPIValue
                  value={kpis.transferTotal}
                  formatter={formatCurrency}
                  className="text-gray-900 mt-1"
                  animate
                />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              {kpis.transferTotal > 0
                ? `Transfers in the ${rangeLabel}`
                : `No transfers in the ${rangeLabel}`}
            </div>
          </CardContent>
        </Card>

        <Card
          className="bento-card bento-card-hover border-none shadow-none"
          onClick={() => setPaymentFilter("Cash")}
        >
          <CardContent className="pt-6 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cash
                </p>
                <KPIValue
                  value={kpis.cashTotal}
                  formatter={formatCurrency}
                  className="text-gray-900 mt-1"
                  animate
                />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              {kpis.cashTotal > 0
                ? `Cash payments in the ${rangeLabel}`
                : `No cash in the ${rangeLabel}`}
            </div>
          </CardContent>
        </Card>

        <Card
          className="bento-card bento-card-hover border-none shadow-none"
          onClick={() => setPaymentFilter("Card")}
        >
          <CardContent className="pt-6 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Card
                </p>
                <KPIValue
                  value={kpis.cardTotal}
                  formatter={formatCurrency}
                  className="text-gray-900 mt-1"
                  animate
                />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              {kpis.cardTotal > 0
                ? `Card payments in the ${rangeLabel}`
                : `No card in the ${rangeLabel}`}
            </div>
          </CardContent>
        </Card>

        <Card className="bento-card bento-card-hover border-none shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Refunds
                </p>
                <KPIValue
                  value={kpis.refundedCount}
                  className="text-gray-900 mt-1"
                  animate
                />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              {kpis.refundedCount > 0
                ? `Refunds in the ${rangeLabel}`
                : `No refunds in the ${rangeLabel}`}
            </div>
          </CardContent>
        </Card>

        <Card className="bento-card bento-card-hover border-none shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-dotted border-gray-300">
                      Avg Sale
                    </TooltipTrigger>
                    <TooltipContent>
                      Average completed sale in the {rangeLabel}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <KPIValue
                  value={kpis.avgTransaction}
                  formatter={formatCurrency}
                  className="text-gray-900 mt-1"
                  animate
                />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              Based on completed sales in the {rangeLabel}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Visuals Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bento-card border-none shadow-none">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by ID, customer name/phone, amount..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 rounded-xl bg-surface-container-lowest border-outline-variant/40"
                />
                {searchTerm.trim() && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-xl overflow-hidden">
                    {searchMatches.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">
                        No transaction matches “{searchTerm}”.
                      </p>
                    ) : (
                      searchMatches.map((txn) => (
                        <button
                          key={txn.id}
                          type="button"
                          onClick={() => {
                            setSelectedTransaction(txn.id);
                            setSearchTerm("");
                          }}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors border-b border-outline-variant/20 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">
                              {txn.id.slice(0, 9)}…
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {txn.customer || "Guest"} ·{" "}
                              {new Date(txn.datetime).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span className="text-sm font-black text-gray-900 shrink-0">
                            {formatCurrency(txn.amount)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-40 h-10 rounded-xl bg-surface-container-lowest">
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 h-10 rounded-xl bg-surface-container-lowest">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Refunded">Refunded</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bento-card border-none shadow-none overflow-hidden">
          <CardHeader className="py-3 px-4 bg-surface-container-low border-b border-outline-variant/30">
            <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Payment Split
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex items-center justify-center h-24">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={25}
                    outerRadius={35}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400">No data to display</p>
            )}
            <div className="flex flex-col gap-1 pr-6">
              {chartData.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center gap-2 text-[10px] font-medium text-gray-600"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  {d.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <Card className="border-gray-200 shadow-sm relative overflow-hidden">
        {selectedRows.size > 0 && (
          <div className="absolute top-0 left-0 right-0 h-14 bg-indigo-600 text-white flex items-center px-6 justify-between z-10 animate-in slide-in-from-top duration-200">
            <span className="font-medium">
              {selectedRows.size} transactions selected
            </span>
            <div className="flex items-center gap-3">
              {currentUser?.role === "Admin" && (
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 gap-2"
                  onClick={handleBulkRefund}
                >
                  <Undo2 className="w-4 h-4" /> Refund Selected
                </Button>
              )}
              {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && (
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 gap-2"
                >
                  <Download className="w-4 h-4" /> Export
                </Button>
              )}
              <div className="w-px h-6 bg-white/20 mx-2" />
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => setSelectedRows(new Set())}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed min-w-[880px] [&_th]:px-3 [&_td]:px-3">
              <TableHeader>
                <TableRow className="bg-surface text-on-surface select-none">
                  <TableHead className="w-12"></TableHead>
                  {isAdmin && <TableHead className="w-[17%]">Store</TableHead>}
                  <TableHead
                    className="w-[22%] cursor-pointer"
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center gap-1">
                      Transaction ID{" "}
                      {sortConfig.key === "id" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className={`${isAdmin ? "w-[12%]" : "w-[17%]"} cursor-pointer`}
                    onClick={() => handleSort("datetime")}
                  >
                    <div className="flex items-center gap-1">
                      Date & Time{" "}
                      {sortConfig.key === "datetime" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead className={isAdmin ? "w-[8%]" : "w-[13%]"}>
                    Items
                  </TableHead>
                  <TableHead className={isAdmin ? "w-[11%]" : "w-[16%]"}>
                    Payment
                  </TableHead>
                  <TableHead className="w-[8%] text-right">Status</TableHead>
                  <TableHead
                    className="w-[14%] cursor-pointer"
                    onClick={() => handleSort("amount")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Amount{" "}
                      {sortConfig.key === "amount" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        ))}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                          <Receipt className="w-8 h-8 text-gray-200" />
                        </div>
                        <p className="text-lg font-medium text-gray-900">
                          No transactions found
                        </p>
                        <p className="text-sm max-w-xs mx-auto mt-1">
                          Try adjusting your filters or head to the POS to
                          record your first sale.
                        </p>
                        <Button
                          className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                          onClick={() => navigate("/pos")}
                        >
                          Go to POS <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransactions.map((txn) => {
                    const isExpanded = expandedRows.has(txn.id);
                    return (
                      <>
                        <TableRow
                          key={txn.id}
                          className={`group hover:bg-surface-container-low transition-colors ${isExpanded ? "bg-surface text-on-surface" : ""}`}
                        >
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleRow(txn.id)}
                              aria-label={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="min-w-0">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {storeNameFor(txn.storeId)}
                                </p>
                                <p className="text-xs font-medium text-gray-500 truncate">
                                  {storeManagerFor(txn.storeId)?.name ||
                                    "Store"}
                                </p>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="min-w-0">
                            <p className="text-sm font-normal text-gray-900 truncate">
                              TX-{formatTxnId(txn.id, isAdmin)}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-gray-500">
                            <div className="flex flex-col">
                              <p className="truncate">
                                {new Date(txn.datetime).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </p>
                              <p className="truncate">
                                {new Date(txn.datetime).toLocaleTimeString(
                                  "en-US",
                                  { hour: "numeric", minute: "2-digit" },
                                )}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-gray-900 tabular-nums">
                            {txn.items.reduce((s, i) => s + i.qty, 0)}
                          </TableCell>
                          <TableCell className="pl-1">{getPaymentBadge(txn.payment)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <span className="group/status inline-flex items-center gap-1.5">
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                                    txn.status === "Completed"
                                      ? "bg-[#00A651] group-hover/status:bg-[#008a43]"
                                      : txn.status === "Refunded"
                                        ? "bg-red-500 group-hover/status:bg-red-600"
                                        : "bg-amber-500 group-hover/status:bg-amber-600"
                                  }`}
                                >
                                  {txn.status === "Refunded" ? (
                                    <Undo2 className="w-3.5 h-3.5 text-white" />
                                  ) : txn.status === "Pending" ? (
                                    <Clock className="w-3.5 h-3.5 text-white" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-white" />
                                  )}
                                </span>
                                <span
                                  className={`max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 group-hover/status:max-w-[5.5rem] group-hover/status:opacity-100 transition-all duration-200 ${
                                    txn.status === "Completed"
                                      ? "text-[#00A651]"
                                      : txn.status === "Refunded"
                                        ? "text-red-600"
                                        : "text-amber-600"
                                  }`}
                                >
                                  {txn.status}
                                </span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-gray-900 tabular-nums truncate">
                            {formatCurrency(txn.amount)}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-gray-50/30 border-t-0">
                            <TableCell colSpan={isAdmin ? 8 : 7} className="py-4 px-12">
                              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    Order Breakdown
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    {isAdmin && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={() =>
                                          setSelectedTransaction(txn.id)
                                        }
                                      >
                                        <Eye className="w-3.5 h-3.5" /> View
                                        Details
                                      </Button>
                                    )}
                                    {canEdit("Transactions") && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                        onClick={() => handleRefund(txn.id)}
                                        disabled={txn.status === "Refunded"}
                                      >
                                        <Undo2 className="w-3.5 h-3.5" /> Refund
                                        Sale
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <p className="font-mono text-xs font-medium text-gray-900">
                                    Order ID: {txn.id}
                                  </p>
                                  <p className="text-xs font-medium text-gray-500">
                                    {txn.customer || "Guest Customer"} ·{" "}
                                    {txn.items.length}{" "}
                                    {txn.items.length === 1 ? "item" : "items"}
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {txn.items.map((it, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">
                                          {inventory[it.productId]?.name?.[0] ||
                                            "?"}
                                        </div>
                                        <div>
                                          <p className="font-medium text-gray-900">
                                            {inventory[it.productId]?.name ||
                                              "Unknown Product"}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            Qty: {it.qty} ×{" "}
                                            {formatCurrency(it.price)}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="font-bold text-gray-900">
                                        {formatCurrency(it.qty * it.price)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex items-end justify-between gap-3 pt-3 border-t border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1.5"
                                      onClick={() => handleReprint(txn)}
                                    >
                                      <Printer className="w-3.5 h-3.5" /> Reprint
                                      Receipt
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1.5"
                                      onClick={() => handleEmailReceipt(txn)}
                                    >
                                      <Mail className="w-3.5 h-3.5" /> Email
                                      Receipt
                                    </Button>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">
                                      Total Amount
                                    </p>
                                    <p className="text-lg font-black text-gray-900">
                                      {formatCurrency(txn.amount)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
              {filteredTransactions.length > 0 && (
                <tfoot className="bg-gray-50/50 border-t border-gray-200">
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 4 : 3}
                      className="text-right text-xs font-medium text-gray-500 uppercase"
                    >
                      Filtered Totals
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">
                      {filteredTransactions.reduce(
                        (s, t) => s + t.items.reduce((si, i) => si + i.qty, 0),
                        0,
                      )}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right font-semibold text-gray-900">
                      {formatCurrency(
                        filteredTransactions.reduce((s, t) => s + t.amount, 0),
                      )}
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {filteredTransactions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-gray-600">
          <span className="text-xs font-medium text-gray-500">
            Showing {Math.min(filteredTransactions.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(filteredTransactions.length, currentPage * itemsPerPage)} of {filteredTransactions.length} transactions
          </span>
          {/* Arrow pager: the table body is limited to `itemsPerPage` (10) rows,
              so the page never grows without bound. Arrows step to the next
              11–20, etc.; the last page simply holds the remainder (11 txns
              means one row on page two). */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-gray-200 bg-white text-gray-600"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold text-gray-600 tabular-nums min-w-[72px] text-center">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-gray-200 bg-white text-gray-600"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      <Dialog
        open={selectedTransaction !== null}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      >
        <DialogContent className="sm:max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-white">
          <DialogHeader className="p-8 pb-4 bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black text-gray-900">
                  Transaction Details
                </DialogTitle>
                <DialogDescription className="text-gray-500 font-medium">
                  Full audit trail for order #{selectedTransaction}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {details && (
            <div className="p-8 space-y-8">
              {/* Header Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    Transaction ID
                  </p>
                  <p className="text-sm font-mono font-bold text-indigo-600">
                    {details.id}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    Status
                  </p>
                  {getStatusBadge(details.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    Date & Time
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {details.date} • {details.time}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    Payment
                  </p>
                  {getPaymentBadge(details.payment)}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    Customer
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {details.customer || "Guest Customer"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    Store
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {currentStore.name}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    Cashier
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {details.cashier || currentUser?.name || "System"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    Total Amount
                  </p>
                  <p className="text-sm font-black text-indigo-600">
                    {formatCurrency(details.amount)}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                    Line Items
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold text-gray-400"
                  >
                    {details.items.length} Items
                  </Badge>
                </div>
                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-gray-100">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">
                          Item
                        </TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">
                          Qty
                        </TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">
                          Price
                        </TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">
                          Subtotal
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.items.map((item, index) => (
                        <TableRow key={index} className="border-gray-100/50">
                          <TableCell className="py-3 font-medium text-gray-900">
                            {item.name}
                          </TableCell>
                          <TableCell className="py-3 text-center font-bold text-gray-600">
                            {item.qty}
                          </TableCell>
                          <TableCell className="py-3 text-right text-gray-600">
                            {formatCurrency(item.price)}
                          </TableCell>
                          <TableCell className="py-3 text-right font-black text-gray-900">
                            {formatCurrency(item.price * item.qty)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-4 bg-indigo-50/30 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      Grand Total
                    </span>
                    <span className="text-xl font-black text-indigo-600">
                      {formatCurrency(details.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  className="w-full h-14 bg-gray-900 hover:bg-black text-white font-black rounded-2xl shadow-xl transition-all"
                  onClick={() => setSelectedTransaction(null)}
                >
                  Close Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Date Range Sheet */}
      <Sheet open={dateOpen} onOpenChange={setDateOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-gray-100 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Filter by Date
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={() => {
                  setDateFrom(new Date().toISOString().slice(0, 10));
                  setDateTo(new Date().toISOString().slice(0, 10));
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  setDateFrom(y.toISOString().slice(0, 10));
                  setDateTo(y.toISOString().slice(0, 10));
                }}
              >
                Yesterday
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={() => {
                  const l7 = new Date();
                  l7.setDate(l7.getDate() - 7);
                  setDateFrom(l7.toISOString().slice(0, 10));
                  setDateTo(new Date().toISOString().slice(0, 10));
                }}
              >
                Last 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={() => {
                  const tm = new Date();
                  tm.setDate(1);
                  setDateFrom(tm.toISOString().slice(0, 10));
                  setDateTo(new Date().toISOString().slice(0, 10));
                }}
              >
                This Month
              </Button>
            </div>
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  From Date
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  To Date
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
            <div className="pt-4 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 text-gray-500"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                onClick={() => setDateOpen(false)}
              >
                Apply Range
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>


      {/* Refund Confirmation Modal */}
      <Dialog open={isRefundConfirmOpen} onOpenChange={setIsRefundConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <DialogTitle className="text-2xl font-black text-gray-900">
                Refund this sale?
              </DialogTitle>
              <DialogDescription className="text-gray-500 mt-2">
                This will reverse the transaction and restore stock levels for
                all items in order{" "}
                <span className="font-bold text-gray-900">
                  #{transactionToRefund}
                </span>
                .
              </DialogDescription>
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 h-12 font-bold text-gray-400"
                onClick={() => setIsRefundConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-100"
                onClick={confirmRefund}
              >
                Confirm Refund
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Share Modal */}
      {transactionToEmail && (
        <EmailShareModal
          open={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          reportName={`Receipt for Order ${transactionToEmail.id}`}
          reportType="Receipt"
          file={{
            blob: transactionToEmail.blob,
            name: `receipt-${transactionToEmail.id}.pdf`,
            type: "application/pdf",
          }}
        />
      )}
    </Stagger>
  );
}
