import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  Smartphone,
  Undo2,
  ShoppingBag,
  ArrowUpRight,
  ArrowRight,
  Package,
  Receipt,
  Copy,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Wifi,
  WifiOff,
  Boxes,
  Zap,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { formatFullNumber } from "../../lib/utils";
import { useStore } from "../state/store";
import { type DbCashierKpis } from "../../lib/db";
import { useNavigate } from "react-router";

// Trading-hours window for the hourly "items sold" sparkline.
const START_HOUR = 8;
const END_HOUR = 21;

export function CashierDashboard() {
  const navigate = useNavigate();
  const {
    transactions,
    currentStore,
    currentUser,
    formatCurrency,
    fetchCashierKpis,
    inventoryArray,
    posTerminals,
  } = useStore();

  const storeId = currentStore?.id;
  const cashierId = currentUser?.id;
  const cashierName = currentUser?.name || "Cashier";
  const today = new Date().toISOString().slice(0, 10);

  // Server-measured, cashier-scoped figures for today. The local transaction
  // feed is only a fallback for the moment between first paint and the API
  // response (or a failed request) so the cards never sit at a hard zero.
  const [serverKpis, setServerKpis] = useState<DbCashierKpis | null>(null);
  useEffect(() => {
    let active = true;
    if (!storeId) return;
    fetchCashierKpis(storeId)
      .then((k) => {
        if (active) setServerKpis(k);
      })
      .catch(() => {
        /* Fall back to the local feed. */
      });
    return () => {
      active = false;
    };
    // Keyed by store and cashier so it refreshes when cashier changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, cashierId]);

  const myTxnsToday = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.datetime.startsWith(today) &&
          t.status === "Completed" &&
          (t.cashier === cashierId || t.cashier === cashierName),
      ),
    [transactions, today, cashierId, cashierName],
  );

  const storeTxnsToday = useMemo(
    () =>
      transactions
        .filter((t) => t.datetime.startsWith(today) && t.status === "Completed")
        .sort(
          (a, b) =>
            new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
        ),
    [transactions, today],
  );

  const refundsToday = useMemo(
    () =>
      transactions.filter(
        (t) => t.datetime.startsWith(today) && t.status === "Refunded",
      ),
    [transactions, today],
  );

  const localSales = myTxnsToday.reduce((s, t) => s + t.amount, 0);
  const localItems = myTxnsToday.reduce(
    (s, t) => s + t.items.reduce((a, i) => a + i.qty, 0),
    0,
  );

  const mySales = serverKpis?.salesToday ?? localSales;
  const myItemsSold = serverKpis?.itemsSoldToday ?? localItems;
  const ordersToday = serverKpis?.salesCountToday ?? myTxnsToday.length;
  const avgBasket = ordersToday > 0 ? mySales / ordersToday : 0;

  const shiftTarget =
    mySales > 0
      ? Math.ceil((mySales * 1.15) / 5000) * 5000
      : 50000;
  const targetProgress = Math.min(
    100,
    shiftTarget > 0 ? (mySales / shiftTarget) * 100 : 0,
  );

  const paymentTotals = useMemo(
    () => ({
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
    }),
    [storeTxnsToday],
  );

  // The reference splits the payment mix into a single distribution bar.
  const paymentTotal =
    paymentTotals.cash + paymentTotals.card + paymentTotals.transfer || 1;
  const mix = [
    {
      key: "cash",
      label: "Cash",
      value: paymentTotals.cash,
      pct: (paymentTotals.cash / paymentTotal) * 100,
      color: "bg-secondary-container",
    },
    {
      key: "card",
      label: "Card / POS",
      value: paymentTotals.card,
      pct: (paymentTotals.card / paymentTotal) * 100,
      color: "bg-primary-container",
    },
    {
      key: "transfer",
      label: "Transfer",
      value: paymentTotals.transfer,
      pct: (paymentTotals.transfer / paymentTotal) * 100,
      color: "bg-tertiary-container",
    },
  ];

  const lowStock = useMemo(
    () =>
      [...inventoryArray]
        .filter((i) => i.stock > 0 && i.stock <= i.reorderPoint)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 4),
    [inventoryArray],
  );

  // Real running item-sales total, built only from hours that have actually
  // happened and actually sold something. Each bar is the cumulative units sold
  // from opening up to that hour, so the line climbs as the day goes on and the
  // last bar is the total so far. Hours in the future, and hours with no sales,
  // are dropped rather than drawn as empty/static bars.
  const { hourlyBars, peakIndex, axisHours } = useMemo(() => {
    const source = myTxnsToday.length ? myTxnsToday : storeTxnsToday;
    const nowHour = new Date().getHours();
    const perHour = new Map<number, number>();
    source.forEach((t) => {
      const h = new Date(t.datetime).getHours();
      if (h < START_HOUR || h > END_HOUR || h > nowHour) return;
      const units = t.items.reduce((a, i) => a + i.qty, 0);
      perHour.set(h, (perHour.get(h) || 0) + units);
    });

    const hours = [...perHour.keys()].sort((a, b) => a - b);
    let running = 0;
    const values = hours.map((h) => {
      running += perHour.get(h) || 0;
      return running;
    });
    const max = Math.max(1, ...values);
    const bars = values.map((v) => Math.max(6, (v / max) * 100));

    return {
      hourlyBars: bars,
      peakIndex: hours.length ? hours.length - 1 : -1,
      axisHours: hours,
    };
  }, [myTxnsToday, storeTxnsToday]);

  const handleCloseDay = () => {
    const headers = [
      "ID",
      "Date",
      "Time",
      "Customer",
      "Items",
      "Amount",
      "Payment",
      "Status",
    ];
    const rows = storeTxnsToday.map((t) => [
      t.id,
      new Date(t.datetime).toLocaleDateString("en-GB"),
      new Date(t.datetime).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
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
      description: `${storeTxnsToday.length} transactions exported.`,
    });
  };

  const recent = storeTxnsToday.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Tier 1 — headline metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 items-stretch">
        {/* My Sales Today */}
        <div className="xl:col-span-4 bento-card bento-card-hover p-6 flex flex-col justify-between min-h-[220px]">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-secondary-container/40 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-on-secondary-container" />
            </div>
            <Badge className="bg-secondary-container text-on-secondary-container border-none font-semibold gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-on-secondary-container animate-blink" />
              LIVE
            </Badge>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              My Sales Today
            </p>
            <p className="font-display text-4xl font-extrabold text-on-surface leading-none mt-2">
              {formatCurrency(mySales)}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-on-secondary-container">
                <TrendingUp className="w-3.5 h-3.5" />
                {ordersToday} {ordersToday === 1 ? "order" : "orders"}
              </span>
              <span className="text-xs font-medium text-on-surface-variant">
                avg {formatCurrency(avgBasket)}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] font-semibold text-on-surface-variant mb-1.5">
              <span>Shift target</span>
              <span>{formatCurrency(shiftTarget)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-container transition-all duration-700"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Items Sold */}
        <div className="xl:col-span-4 bento-card bento-card-hover p-6 flex flex-col justify-between min-h-[220px]">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-primary-fixed flex items-center justify-center">
              <Boxes className="w-5 h-5 text-primary-container" />
            </div>
            <Badge className="bg-surface-container text-on-surface-variant border-none font-semibold">
              {ordersToday} {ordersToday === 1 ? "Order" : "Orders"}
            </Badge>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Items Sold
            </p>
            <p className="font-display text-4xl font-extrabold text-on-surface leading-none mt-2">
              {formatFullNumber(myItemsSold)}
              <span className="text-base font-bold text-on-surface-variant ml-1.5">
                units
              </span>
            </p>
            <p className="text-xs font-medium text-on-surface-variant mt-3">
              Average basket {formatCurrency(avgBasket)}
            </p>
          </div>
          <div className="mt-4">
            {axisHours.length === 0 ? (
              <p className="text-xs font-medium text-on-surface-variant">
                No sales recorded yet today.
              </p>
            ) : (
              <>
                <div className="flex items-end gap-1 h-8">
                  {hourlyBars.map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t ${
                        i === peakIndex ? "bg-primary-container" : "bg-primary-container/20"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="flex gap-1 mt-1">
                  {axisHours.map((hour, i) => (
                    <span
                      key={i}
                      className={`flex-1 text-center text-[9px] leading-none tabular-nums ${
                        i === peakIndex
                          ? "font-bold text-primary-container"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {hour}:00
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Start Selling */}
        <div className="xl:col-span-4 rounded-3xl p-6 flex flex-col justify-between min-h-[220px] text-white bg-gradient-to-br from-primary-container to-[#6d28d9] shadow-[0_20px_45px_-18px_rgba(79,70,229,0.65)] relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-start justify-between relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)] ring-1 ring-white/25">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <Badge className="bg-white/15 text-white border-none font-semibold gap-1.5 backdrop-blur-sm shadow-[0_8px_20px_-8px_rgba(0,0,0,0.7)] ring-1 ring-white/25">
              <Zap className="w-3 h-3 text-yellow-300" />
              POS Ready
            </Badge>
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Quick Action
            </p>
            <p className="font-display text-2xl font-extrabold leading-tight mt-1">
              Start Selling
            </p>
            <p className="text-sm text-white/80 mt-1">
              Open the point-of-sale terminal.
            </p>
          </div>
          <Button
            onClick={() => navigate("/pos")}
            className="relative z-10 mt-4 h-12 w-full bg-white hover:bg-white/90 text-primary-container font-bold rounded-2xl shadow-lg gap-2"
          >
            Open POS Terminal
            <kbd className="px-1.5 py-0.5 rounded bg-primary-container/10 text-[10px] font-bold">
              F2
            </kbd>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tier 2 — Today's payments */}
      <div className="bento-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary-container" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-on-surface">
                Today's Payments Breakdown
              </h2>
              <p className="text-xs font-medium text-on-surface-variant">
                {storeTxnsToday.length} sales settled today
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/transactions")}
            className="h-9 rounded-xl font-semibold gap-2 border-outline-variant text-on-surface-variant hover:bg-surface-container"
          >
            <Receipt className="w-4 h-4" />
            View Transactions
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {[
            {
              label: "Cash",
              value: paymentTotals.cash,
              icon: Banknote,
              color: "text-on-secondary-container",
              bg: "bg-secondary-container/30",
            },
            {
              label: "Card / POS",
              value: paymentTotals.card,
              icon: CreditCard,
              color: "text-primary-container",
              bg: "bg-primary-fixed",
            },
            {
              label: "Transfer",
              value: paymentTotals.transfer,
              icon: Smartphone,
              color: "text-tertiary",
              bg: "bg-tertiary-fixed/40",
            },
            {
              label: "Refunds",
              value: refundsToday.length,
              icon: Undo2,
              color: "text-error",
              bg: "bg-error-container/50",
              raw: true,
            },
          ].map((p) => (
            <div
              key={p.label}
              className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-4"
            >
              <div
                className={`w-8 h-8 rounded-lg ${p.bg} flex items-center justify-center mb-2`}
              >
                <p.icon className={`w-4 h-4 ${p.color}`} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                {p.label}
              </p>
              <p className="font-display text-lg font-extrabold text-on-surface mt-0.5">
                {p.raw ? p.value : formatCurrency(p.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Distribution bar */}
        <div className="mt-5">
          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-surface-container-high">
            {mix.map((m) => (
              <div
                key={m.key}
                className={`h-full ${m.color} first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${m.pct}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3">
            {mix.map((m) => (
              <span
                key={m.key}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant"
              >
                <span className={`w-2 h-2 rounded-full ${m.color}`} />
                {m.label} {m.pct.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-2xl font-bold text-sm border-outline-variant text-on-surface-variant hover:bg-surface-container gap-2"
            onClick={() => navigate("/transactions")}
          >
            <Receipt className="w-4 h-4" />
            Transactions
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
          <Button
            className="h-11 flex-1 rounded-2xl font-bold text-sm bg-primary-container hover:bg-primary text-white gap-2 shadow-lg shadow-primary-container/25"
            onClick={handleCloseDay}
          >
            <Copy className="w-4 h-4" />
            Close Day &amp; Export
          </Button>
        </div>
      </div>

      {/* Tier 3 — Recent activity + side column */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Recent Activity — spans the full height of the side column */}
        <div className="xl:col-span-8 bento-card p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
                <Receipt className="w-5 h-5 text-on-surface-variant" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-on-surface">
                  Recent Activity
                </h2>
                <p className="text-xs font-medium text-on-surface-variant">
                  Latest completed sales in this store
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate("/transactions")}
              className="h-9 rounded-xl font-semibold text-primary-container hover:bg-primary-fixed gap-1"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 mt-4 overflow-hidden">
            {recent.length === 0 ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center mb-3">
                  <Receipt className="w-5 h-5 text-on-surface-variant" />
                </div>
                <p className="text-sm font-semibold text-on-surface">
                  No sales yet today
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Completed sales will appear here in real time.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/30">
                {recent.map((t) => {
                  const units = t.items.reduce((s, i) => s + i.qty, 0);
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-4 py-3 first:pt-0"
                    >
                      <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center font-display font-bold text-on-surface-variant shrink-0">
                        {units}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {t.customer || "Walk-in Customer"}
                        </p>
                        <p className="text-[11px] font-medium text-on-surface-variant">
                          {new Date(t.datetime).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {t.payment} · {t.cashier || "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display text-sm font-extrabold text-on-surface">
                          {formatCurrency(t.amount)}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-on-secondary-container">
                          <span className="w-1.5 h-1.5 rounded-full bg-on-secondary-container" />
                          {t.status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Side column */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          {/* Stock Warning */}
          <div className="bento-card bento-card-hover p-6 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-error-container/50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-error" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-on-surface">
                  Stock Warning
                </h3>
                <p className="text-xs font-medium text-on-surface-variant">
                  At or below reorder point
                </p>
              </div>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-sm font-medium text-on-surface-variant py-2">
                All products are above their reorder point.
              </p>
            ) : (
              <ul className="space-y-3">
                {lowStock.map((i) => (
                  <li key={i.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-on-surface-variant" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-on-surface truncate">
                        {i.name}
                      </p>
                      <p className="text-[11px] font-medium text-on-surface-variant">
                        Reorder at {i.reorderPoint}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-error shrink-0">
                      {i.stock} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="ghost"
              onClick={() => navigate("/inventory")}
              className="mt-4 w-full h-9 rounded-xl font-semibold text-primary-container hover:bg-primary-fixed gap-1"
            >
              Review inventory
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Hardware connectivity */}
          <div className="bento-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
                <Wifi className="w-5 h-5 text-on-surface-variant" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-on-surface">
                  Hardware Connectivity
                </h3>
                <p className="text-xs font-medium text-on-surface-variant">
                  Point-of-sale terminals
                </p>
              </div>
            </div>
            {posTerminals.length === 0 ? (
              <p className="text-sm font-medium text-on-surface-variant">
                No terminals configured for this store.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {posTerminals.slice(0, 3).map((term) => {
                  const online = term.status === "Connected";
                  return (
                    <li
                      key={term.id}
                      className="flex items-center gap-3 rounded-xl bg-surface-container-low border border-outline-variant/30 px-3 py-2.5"
                    >
                      {online ? (
                        <Wifi className="w-4 h-4 text-on-secondary-container shrink-0" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-on-surface-variant shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-on-surface truncate flex-1">
                        {term.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide ${
                          online ? "text-on-secondary-container" : "text-on-surface-variant"
                        }`}
                      >
                        {term.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
