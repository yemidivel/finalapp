import {
  Package,
  TrendingUp,
  BarChart3,
  Plus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Stagger } from "../../animations/Stagger";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
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
import { useStore, useProductSync } from "../state/store";
import { QrGeneratorModal } from "../components/QrGeneratorModal";
import { AddProductModal } from "../components/AddProductModal";
import { fetchProductImage } from "../../lib/productImage";
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
  // Read products from the database (not a login-time snapshot) so this
  // page stays in sync across Manager and Cashier sessions.
  useProductSync();

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

  // Catalog sorting (client-side, mirrors the Inventory page pattern).
  // The API already returns products in a deterministic database order;
  // this state lets the user re-order the visible table on demand.
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

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
    const revenueByProduct: Record<string, number> = {};
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
    const soldTodayMap: Record<string, number> = {};
    const totalSoldMap: Record<string, number> = {};

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

  const sortedProducts = useMemo(() => {
    const { key, direction } = sortConfig;
    const rows = [...productList];

    rows.sort((a: any, b: any) => {
      // Uncategorised products collect at the bottom in both directions.
      const aEmpty =
        a[key] === null || a[key] === undefined || a[key] === "";
      const bEmpty =
        b[key] === null || b[key] === undefined || b[key] === "";
      if (aEmpty && bEmpty) return a.name.localeCompare(b.name);
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      const aValue = a[key];
      const bValue = b[key];
      const result =
        typeof aValue === "string"
          ? aValue.localeCompare(bValue)
          : aValue - bValue;
      // Stable tie-breaker so equal rows never reshuffle between renders.
      if (result === 0) return a.name.localeCompare(b.name);
      return direction === "asc" ? result : -result;
    });

    return rows;
  }, [productList, sortConfig]);


  return (
    <Stagger className="px-6 pt-2 pb-8 space-y-6 min-h-screen bg-surface text-on-surface">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
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
            className="gap-2 border-indigo-200 text-indigo-600 hover:bg-primary-fixed rounded-xl h-11 px-6 font-bold"
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
                    className="bg-surface-container text-gray-400 border-none h-11 px-6 rounded-xl font-black cursor-not-allowed"
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
        <Card className="border-outline-variant/40 shadow-sm">
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

        <Card className="border-outline-variant/40 shadow-sm">
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

        <Card className="border-outline-variant/40 shadow-sm">
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

        <Card className="border-outline-variant/40 shadow-sm">
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
              <div className="w-12 h-12 bg-primary-fixed rounded-xl flex items-center justify-center">
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
        <Card className="border-outline-variant/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Sales History
            </CardTitle>
            <Select
              value={rangeLine}
              onValueChange={(v) => setRangeLine(v as any)}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs bg-surface-container-low">
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
              <div className="h-[250px] flex flex-col items-center justify-center text-gray-400 bg-surface-container-low/50 rounded-xl border border-dashed border-outline-variant/40">
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

        <Card className="border-outline-variant/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Top Products (Revenue)
            </CardTitle>
            <Select
              value={rangeBar}
              onValueChange={(v) => setRangeBar(v as any)}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs bg-surface-container-low">
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
              <div className="h-[250px] flex flex-col items-center justify-center text-gray-400 bg-surface-container-low/50 rounded-xl border border-dashed border-outline-variant/40">
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

      {/* Product Catalog */}
      <Card className="border-outline-variant/40 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Product Catalog
          </CardTitle>
          <span className="text-xs font-medium text-gray-500">
            {totalProducts} {totalProducts === 1 ? "product" : "products"} ·
            click a column to sort
          </span>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-outline-variant/40 overflow-hidden">
            <div className="max-h-[520px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-surface-container-lowest">
                  <TableRow>
                    <TableHead className="cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1">
                        Product Name
                        {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("sku")}>
                      <div className="flex items-center gap-1">
                        SKU
                        {sortConfig.key === "sku" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("category")}>
                      <div className="flex items-center gap-1">
                        Category
                        {sortConfig.key === "category" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("stock")}>
                      <div className="flex items-center gap-1">
                        Stock
                        {sortConfig.key === "stock" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("price")}>
                      <div className="flex items-center gap-1 justify-end">
                        Price
                        {sortConfig.key === "price" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("soldToday")}>
                      <div className="flex items-center gap-1 justify-end">
                        Sold Today
                        {sortConfig.key === "soldToday" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-medium">No products yet</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedProducts.map((p: any) => (
                      <TableRow
                        key={p.id}
                        onClick={() => {
                          setSelectedProductForDetail(p);
                          setIsDetailModalOpen(true);
                        }}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-semibold text-gray-900">
                          {p.name}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {p.sku || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="font-normal"
                          >
                            {p.category || "Uncategorized"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              p.stock === 0
                                ? "text-red-600 font-semibold"
                                : p.stock < 10
                                  ? "text-orange-600 font-semibold"
                                  : "text-gray-700"
                            }
                          >
                            {p.stock ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-700">
                          {formatCurrency(p.price)}
                        </TableCell>
                        <TableCell className="text-right text-gray-500">
                          {p.soldToday}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Optimization */}
      <Card className="border-outline-variant/40 shadow-sm">
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
                return <div className="h-[250px] flex flex-col items-center justify-center text-gray-400 bg-surface-container-low/50 rounded-xl border border-dashed border-outline-variant/40"><TrendingUp className="w-10 h-10 mb-2 opacity-20" /><p className="text-sm font-medium">All products look healthy</p></div>;
              }
              return (
                <div className="space-y-3">
                  {suggestions.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/40">
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
        onSave={async (data) => {
          if (selectedProductForEdit) {
            updateProduct({ ...selectedProductForEdit, ...data });
          } else {
            const imageUrl = await fetchProductImage(data.name);
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
              imageUrl,
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
    </Stagger>
  );
}
