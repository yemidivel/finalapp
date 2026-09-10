import { useMemo } from "react";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Receipt,
  Smartphone,
  Copy,
  ArrowUpRight,
  Clock,
  Store,
  Wallet,
  CreditCard,
  Banknote,
  Undo2,
  Calendar,
  ShoppingBag,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { KPIValue } from "../components/KPIValue";
import { abbreviateNumber } from "../../lib/utils";
import { useStore } from "../state/store";
import { useNavigate } from "react-router";

export function CashierDashboard() {
  const navigate = useNavigate();
  const {
    theme,
    transactions,
    currentStore,
    currentUser,
    formatCurrency,
  } = useStore();

  const today = new Date().toISOString().slice(0, 10);
  const cashierName = currentUser?.name || "Cashier";

  const myTxnsToday = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.datetime.startsWith(today) &&
        t.status === "Completed" &&
        t.cashier === cashierName,
    );
  }, [transactions, today, cashierName]);

  const storeTxnsToday = useMemo(() => {
    return transactions.filter(
      (t) => t.datetime.startsWith(today) && t.status === "Completed",
    );
  }, [transactions, today]);

  const refundsToday = useMemo(() => {
    return transactions.filter(
      (t) => t.datetime.startsWith(today) && t.status === "Refunded",
    );
  }, [transactions, today]);

  const mySales = useMemo(
    () => myTxnsToday.reduce((s, t) => s + t.amount, 0),
    [myTxnsToday],
  );
  const myItemsSold = useMemo(
    () => myTxnsToday.reduce((s, t) => s + t.items.reduce((a, i) => a + i.qty, 0), 0),
    [myTxnsToday],
  );
  const myAvgSale = myTxnsToday.length > 0 ? mySales / myTxnsToday.length : 0;

  const paymentTotals = useMemo(() => {
    return {
      cash: storeTxnsToday
        .filter((t) => t.payment === "Cash")
        .reduce((s, t) => s + t.amount, 0),
      card: storeTxnsToday
        .filter(
          (t) =>
            t.payment === "Card" ||
            t.payment === "POS Terminal" ||
            t.payment === "Linked Account",
        )
        .reduce((s, t) => s + t.amount, 0),
      transfer: storeTxnsToday
        .filter((t) => t.payment === "Transfer")
        .reduce((s, t) => s + t.amount, 0),
    };
  }, [storeTxnsToday]);

  const weeklyChart = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      const total = transactions
        .filter(
          (t) => t.datetime.startsWith(key) && t.status === "Completed",
        )
        .reduce((s, t) => s + t.amount, 0);
      days.push({ day: label, sales: total });
    }
    return days;
  }, [transactions]);

  const recent = useMemo(() => {
    return transactions
      .filter((t) => t.datetime.startsWith(today))
      .sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
      )
      .slice(0, 6);
  }, [transactions, today]);

  const handleCloseDay = () => {
    const headers = ["ID", "Date", "Time", "Customer", "Items", "Amount", "Payment", "Status"];
    const rows = storeTxnsToday.map((t) => [
      t.id,
      new Date(t.datetime).toLocaleDateString("en-GB"),
      new Date(t.datetime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      t.customer || "Guest",
      t.items.reduce((s, i) => s + i.qty, 0).toString(),
      t.amount.toString(),
      t.payment,
      t.status,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `close-day-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Day closed successfully", {
      description: `${storeTxnsToday.length} transactions exported. All KPIs reset.`,
    });
  };

  const paymentBadge = (method: string) => {
    switch (method) {
      case "Cash":
        return (
          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200">
            Cash
          </Badge>
        );
      case "Transfer":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
            Transfer
          </Badge>
        );
      case "POS Terminal":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
            POS
          </Badge>
        );
      case "Linked Account":
        return (
          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
            Linked Acct
          </Badge>
        );
      default:
        return (
          <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 border-sky-200">
            {method}
          </Badge>
        );
    }
  };

  const kpis = [
    {
      label: "My Sales Today",
      value: mySales,
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
      formatter: formatCurrency,
    },
    {
      label: "My Orders",
      value: myTxnsToday.length,
      icon: ShoppingCart,
      color: "text-blue-600",
      bg: "bg-blue-50",
      formatter: abbreviateNumber,
    },
    {
      label: "Items Sold",
      value: myItemsSold,
      icon: Package,
      color: "text-purple-600",
      bg: "bg-purple-50",
      formatter: abbreviateNumber,
    },
    {
      label: "Avg Sale",
      value: myAvgSale,
      icon: Receipt,
      color: "text-orange-600",
      bg: "bg-orange-50",
      formatter: formatCurrency,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Cashier KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
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
                <KPIValue
                  value={kpi.value}
                  formatter={kpi.formatter}
                  animate={false}
                  className={
                    theme === "dark" ? "text-gray-100" : "text-gray-900"
                  }
                />
                <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                  {currentStore?.name} · {cashierName}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          className={`md:col-span-1 border-none shadow-sm rounded-[2rem] overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-600`}
        >
          <CardContent className="p-8 flex flex-col justify-between h-full">
            <div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <p className="text-white font-black text-xl">Start Selling</p>
              <p className="text-white/70 text-sm font-medium mt-1">
                Open the point-of-sale terminal and ring up orders.
              </p>
            </div>
            <Button
              onClick={() => navigate("/pos")}
              className="mt-6 h-12 w-full bg-white hover:bg-gray-50 text-indigo-700 font-black rounded-2xl shadow-lg transition-all gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              Open POS
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        <Card
          className={`md:col-span-2 border-none shadow-sm rounded-[2rem] overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
        >
          <CardHeader className="p-6 pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <CardTitle className="text-base font-black">
                  Today's Payments
                </CardTitle>
                <p className="text-[11px] text-gray-400 font-medium">
                  {currentStore?.name} · {storeTxnsToday.length} sales today
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                className={`p-4 rounded-2xl border ${theme === "dark" ? "border-gray-800 bg-gray-800/30" : "border-gray-100 bg-gray-50"}`}
              >
                <Banknote className="w-4 h-4 text-green-600 mb-1.5" />
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cash</p>
                <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
                  {formatCurrency(paymentTotals.cash)}
                </p>
              </div>
              <div
                className={`p-4 rounded-2xl border ${theme === "dark" ? "border-gray-800 bg-gray-800/30" : "border-gray-100 bg-gray-50"}`}
              >
                <CreditCard className="w-4 h-4 text-blue-600 mb-1.5" />
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Card / POS</p>
                <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
                  {formatCurrency(paymentTotals.card)}
                </p>
              </div>
              <div
                className={`p-4 rounded-2xl border ${theme === "dark" ? "border-gray-800 bg-gray-800/30" : "border-gray-100 bg-gray-50"}`}
              >
                <Smartphone className="w-4 h-4 text-indigo-600 mb-1.5" />
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Transfer</p>
                <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
                  {formatCurrency(paymentTotals.transfer)}
                </p>
              </div>
              <div
                className={`p-4 rounded-2xl border ${theme === "dark" ? "border-gray-800 bg-gray-800/30" : "border-gray-100 bg-gray-50"}`}
              >
                <Undo2 className="w-4 h-4 text-red-500 mb-1.5" />
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Refunds</p>
                <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
                  {refundsToday.length}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-5">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-2xl font-black text-xs border-gray-200 gap-2"
                onClick={() => navigate("/transactions")}
              >
                <Receipt className="w-4 h-4" />
                View Transactions
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                className="h-11 flex-1 rounded-2xl font-black text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-100"
                onClick={handleCloseDay}
              >
                <Copy className="w-4 h-4" />
                Close Day & Export
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Sales + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card
          className={`lg:col-span-2 border-none shadow-sm rounded-[2rem] overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
        >
          <CardHeader className="p-8 pb-2">
            <CardTitle className="text-xl font-black">
              Weekly Sales — {currentStore?.name}
            </CardTitle>
            <p className="text-sm text-gray-500 font-medium">
              Revenue for the last 7 days
            </p>
          </CardHeader>
          <CardContent className="p-8 pt-6">
            {weeklyChart.some((d) => d.sales > 0) ? (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weeklyChart}
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
                        `${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                      }
                    />
                    <Tooltip
                      cursor={{ fill: theme === "dark" ? "#1f2937" : "#f9fafb" }}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        backgroundColor: theme === "dark" ? "#111827" : "#fff",
                        color: theme === "dark" ? "#fff" : "#000",
                      }}
                      formatter={(v: number) => [formatCurrency(v), "Sales"]}
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
              <div className="h-[260px] flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 rounded-2xl">
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

        {/* Recent Transactions */}
        <Card
          className={`border-none shadow-sm rounded-[2rem] overflow-hidden flex flex-col ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}
        >
          <CardHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <CardTitle className="text-base font-black">
                    Recent Activity
                  </CardTitle>
                  <p className="text-[11px] text-gray-400 font-medium">
                    Today's latest transactions
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 gap-1"
                onClick={() => navigate("/transactions")}
              >
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="max-h-[320px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow
                    className={`hover:bg-transparent ${theme === "dark" ? "bg-gray-800/50 border-gray-800" : "bg-gray-50/50"}`}
                  >
                    <TableHead className="px-6 py-3 font-black text-gray-400 uppercase tracking-widest text-[10px]">
                      Details
                    </TableHead>
                    <TableHead className="py-3 font-black text-gray-400 uppercase tracking-widest text-[10px] text-right">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.length > 0 ? (
                    recent.map((t) => {
                      const txnDate = new Date(t.datetime);
                      const timeLabel = txnDate.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <TableRow
                          key={t.id}
                          className={`transition-colors border-b ${theme === "dark" ? "hover:bg-gray-800/50 border-gray-800" : "hover:bg-gray-50/50 border-gray-50"}`}
                        >
                          <TableCell className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                                <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className={`font-bold text-xs truncate max-w-[110px] ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}
                                >
                                  {t.customer || "Guest"}
                                </p>
                                <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {timeLabel}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-right pr-6">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-black text-xs text-gray-900 dark:text-gray-100">
                                {formatCurrency(t.amount)}
                              </span>
                              {paymentBadge(t.payment)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <div className="text-center py-12">
                          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-7 h-7 text-gray-400" />
                          </div>
                          <p className="font-bold text-gray-700">
                            No transactions today
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Start selling from the POS to see activity here.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}