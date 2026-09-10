import {
  Package,
  TrendingUp,
  BarChart3,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { QrGeneratorModal } from "../components/QrGeneratorModal";
import { AddProductModal } from "../components/AddProductModal";
import { ProductDetailModal } from "../components/ProductDetailModal";
import { QrCode } from "lucide-react";
import { KPIValue } from "../components/KPIValue";

export function ProductsPage() {
  const {
    inventoryArray,
    transactions,
    categories,
    addProduct,
    updateProduct,
    formatCurrency,
    currentStore,
    currentUser,
    canEdit,
    addNotification,
  } = useStore();
  const canEditProducts = canEdit("Products");
  const isGlobalView = currentStore.id === "S-ALL";

  const [rangeLine, setRangeLine] = useState<"day" | "week" | "month" | "year">(
    "week",
  );
  const [rangeBar, setRangeBar] = useState<"hour" | "day" | "week" | "month">(
    "day",
  );

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isAddModalOpen, setIsAddProductOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] =
    useState<any>(null);
  const [selectedProductForDetail, setSelectedProductForDetail] =
    useState<any>(null);

  const totalProducts = inventoryArray.length;
  const categoriesCount = categories.length;

  const { activeCategories, unusedCategories } = useMemo(() => {
    const usedSet = new Set(inventoryArray.map((p) => p.category));
    const active = categories.filter((c) => usedSet.has(c)).length;
    return { activeCategories: active, unusedCategories: categoriesCount - active };
  }, [categories, inventoryArray, categoriesCount]);

  const groupByDate = (tx: typeof transactions) => {
    const map: Record<string, number> = {};
    for (const t of tx) {
      const d = t.datetime.slice(0, 10);
      map[d] = (map[d] || 0) + t.amount;
    }
    return map;
  };

  const withinRange = (
    d: Date,
    unit: "day" | "week" | "month" | "year" | "hour",
  ) => {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hour = 3600 * 1000;
    const day = 24 * hour;
    if (unit === "hour") return diff <= hour;
    if (unit === "day") return diff <= day;
    if (unit === "week") return diff <= 7 * day;
    if (unit === "month") return diff <= 30 * day;
    if (unit === "year") return diff <= 365 * day;
    return true;
  };

  const filteredForLine = useMemo(
    () =>
      transactions.filter((t) => withinRange(new Date(t.datetime), rangeLine)),
    [transactions, rangeLine],
  );
  const filteredForBar = useMemo(
    () =>
      transactions.filter((t) => withinRange(new Date(t.datetime), rangeBar)),
    [transactions, rangeBar],
  );

  const todayCompletedTransactions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return transactions.filter(
      (transaction) =>
        transaction.datetime.startsWith(today) &&
        transaction.status === "Completed",
    );
  }, [transactions]);

  const highestDailySales = useMemo(() => {
    return todayCompletedTransactions.reduce(
      (max, transaction) => Math.max(max, transaction.amount),
      0,
    );
  }, [todayCompletedTransactions]);

  const averageProductsPerSale = useMemo(() => {
    if (todayCompletedTransactions.length === 0) return 0;

    const totalUnits = todayCompletedTransactions.reduce(
      (sum, transaction) =>
        sum +
        transaction.items.reduce((itemSum, item) => itemSum + item.qty, 0),
      0,
    );

    return Number((totalUnits / todayCompletedTransactions.length).toFixed(1));
  }, [todayCompletedTransactions]);

  const salesHistoryData = useMemo(() => {
    const grouped = groupByDate(filteredForLine);
    const data = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sales]) => ({ label: date, sales }));
    return data;
  }, [filteredForLine]);

  const topProductsByRevenue = useMemo(() => {
    const revenueByProduct: Record<number, number> = {};
    for (const t of filteredForBar) {
      for (const it of t.items) {
        revenueByProduct[it.productId] =
          (revenueByProduct[it.productId] || 0) + it.qty * it.price;
      }
    }
    const rows = Object.entries(revenueByProduct).map(([id, value]) => {
      const prod = inventoryArray.find((p) => p.id === Number(id));
      return { name: prod?.name ?? `#${id}`, value };
    });
    rows.sort((a, b) => b.value - a.value);
    return rows.slice(0, 5);
  }, [filteredForBar, inventoryArray]);

  const productList = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const soldTodayMap: Record<number, number> = {};
    const totalSoldMap: Record<number, number> = {};

    for (const t of transactions) {
      const isToday = t.datetime.startsWith(today);
      for (const it of t.items) {
        if (isToday)
          soldTodayMap[it.productId] =
            (soldTodayMap[it.productId] || 0) + it.qty;
        totalSoldMap[it.productId] = (totalSoldMap[it.productId] || 0) + it.qty;
      }
    }

    return inventoryArray.map((p) => ({
      ...p,
      soldToday: soldTodayMap[p.id] || 0,
      totalSold: totalSoldMap[p.id] || 0,
    }));
  }, [inventoryArray, transactions]);


  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Products
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            {isGlobalView
              ? "Comprehensive product performance across all business locations."
              : `Product catalog and performance analytics for ${currentStore.name}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl h-11 px-6 font-bold"
            onClick={() => {
              setIsGeneratorOpen(true);
            }}
          >
            <QrCode className="w-4 h-4" />
            Generate QR
          </Button>
          {!isGlobalView && canEditProducts ? (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 px-6 rounded-xl font-black shadow-lg shadow-indigo-100"
              onClick={() => {
                setSelectedProductForEdit(null);
                setIsAddProductOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    disabled
                    className="bg-gray-100 text-gray-400 border-none h-11 px-6 rounded-xl font-black cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Add Product
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Switch to a specific store to add products
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Products
                </p>
                <KPIValue
                  value={totalProducts}
                  className="text-gray-900 mt-1"
                  animate
                />
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                +2
              </span>
              <span className="text-gray-500">this week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Highest Daily Sales
                </p>
                <KPIValue
                  value={highestDailySales > 0 ? highestDailySales : "—"}
                  formatter={highestDailySales > 0 ? formatCurrency : undefined}
                  className="text-gray-900 mt-1"
                  animate
                />
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              {highestDailySales > 0 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-medium">+5%</span>
                  <span>vs avg</span>
                </>
              ) : (
                "No sales data yet"
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average Product
                </p>
                <KPIValue
                  value={
                    averageProductsPerSale > 0 ? averageProductsPerSale : "—"
                  }
                  className="text-gray-900 mt-1"
                  animate
                />
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              {averageProductsPerSale > 0 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-medium">
                    Per sale today
                  </span>
                </>
              ) : (
                "No product movement yet"
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Categories</p>
                <KPIValue
                  value={categoriesCount}
                  className="text-gray-900 mt-1"
                  animate
                />
              </div>
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium">{activeCategories} active</span>
              <span className="text-gray-300">•</span>
              <span>{unusedCategories} unused</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Sales History
            </CardTitle>
            <Select
              value={rangeLine}
              onValueChange={(v) => setRangeLine(v as any)}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs bg-gray-50">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {salesHistoryData.length === 0 ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm font-medium">
                  No sales recorded for this period
                </p>
              </div>
            ) : (
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesHistoryData}>
                    <defs>
                      <linearGradient
                        id="colorSales"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#4f46e5"
                          stopOpacity={0.1}
                        />
                        <stop
                          offset="95%"
                          stopColor="#4f46e5"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f3f4f6"
                    />
                    <XAxis
                      dataKey="label"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#9ca3af" }}
                    />
                    <YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#9ca3af" }}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSales)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Top Products (Revenue)
            </CardTitle>
            <Select
              value={rangeBar}
              onValueChange={(v) => setRangeBar(v as any)}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs bg-gray-50">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Last Hour</SelectItem>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {topProductsByRevenue.length === 0 ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <TrendingUp className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm font-medium">
                  Start selling to unlock performance data
                </p>
              </div>
            ) : (
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProductsByRevenue}
                    layout="vertical"
                    margin={{ left: 40 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#f3f4f6"
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                      tick={{ fill: "#4b5563", fontWeight: 500 }}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "#f9fafb" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#6366f1"
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Price Optimization */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Price Optimization Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
            {(() => {
              const suggestions = productList
                .filter(p => p.totalSold > 0 || p.stock > 0)
                .map(p => {
                  const velocity = p.totalSold || 1;
                  const stockRatio = p.stock / velocity;
                  let suggestion = "";
                  let type: "raise" | "lower" | "watch" = "watch";
                  if (stockRatio < 1 && p.totalSold > 5) {
                    suggestion = "High demand, low stock. Consider raising price.";
                    type = "raise";
                  } else if (stockRatio > 10 && p.totalSold > 0) {
                    suggestion = "Slow moving. Consider lowering price or bundling.";
                    type = "lower";
                  } else if (p.totalSold === 0 && p.stock > 0) {
                    suggestion = "Zero sales. Consider discounting or removing.";
                    type = "lower";
                  }
                  return { ...p, suggestion, type };
                })
                .filter(p => p.suggestion)
                .slice(0, 5);
              if (suggestions.length === 0) {
                return <div className="h-[250px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200"><TrendingUp className="w-10 h-10 mb-2 opacity-20" /><p className="text-sm font-medium">All products look healthy</p></div>;
              }
              return (
                <div className="space-y-3">
                  {suggestions.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatCurrency(p.price)} · Stock: {p.stock} · Sold: {p.totalSold}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0">
                        <Badge className={p.type === "raise" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}>
                          {p.type === "raise" ? "↑ Raise" : "↓ Lower"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>


      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddProductOpen(false)}
        product={selectedProductForEdit}
        onSave={(data) => {
          if (selectedProductForEdit) {
            updateProduct({ ...selectedProductForEdit, ...data });
          } else {
            addProduct({
              name: data.name,
              sku: data.sku,
              price: data.price,
              category: data.category,
              stock: data.stock,
              reorderPoint: data.reorderPoint,
              createdAt: new Date().toISOString(),
              manufacturedDate: data.manufacturedDate,
              expiryDate: data.expiryDate,
              costPrice: data.costPrice,
              supplier: data.supplier,
              barcode: data.barcode,
              storeId: currentStore.id,
            });
            if (currentUser?.role !== "Admin") {
              addNotification({
                id: `notif-product-${Date.now()}`,
                type: "info",
                title: "New Product Added",
                message: `${currentUser?.name || "A user"} added "${data.name}" to ${currentStore.name}.`,
                timestamp: new Date().toISOString(),
                read: false,
                link: "/products",
              });
            }
          }
        }}
      />

      <QrGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
      />

      <ProductDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        product={selectedProductForDetail}
      />
    </div>
  );
}
