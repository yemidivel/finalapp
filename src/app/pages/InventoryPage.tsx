import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router";
import {
  Search,
  Filter,
  Plus,
  Download,
  MoreVertical,
  Package,
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Trash2,
  Tag,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Pin,
  Minus,
  FileText,
  FileSpreadsheet,
  XCircle,
  X,
  QrCode,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Checkbox } from "../components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Progress } from "../components/ui/progress";
import { ScrollArea } from "../components/ui/scroll-area";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useStore } from "../state/store";
import { KPIValue } from "../components/KPIValue";
import { downloadProductQrCode } from "../../lib/qrcode";

export function InventoryPage() {
  const {
    inventoryArray,
    categories,
    setProductStock,
    setProductPrice,
    deleteProduct,
    addCategory,
    removeCategory,
    adjustStock,
    theme,
    currency,
    formatCurrency,
    canEdit,
    addNotification,
    currentUser,
    currentStore,
    adminOverview,
  } = useStore();

  const location = useLocation();

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | "none" }>({
    key: "none",
    direction: "none",
  });
  const [quickFilter, setQuickFilter] = useState<"all" | "in-stock" | "low-stock" | "critical" | "expiring">("all");

  // Handle incoming navigation filter (e.g. from Dashboard or Global Search)
  useEffect(() => {
    if (location.state?.highlightId) {
      const product = inventoryArray.find(p => p.id === location.state.highlightId);
      if (product) {
        setSearchTerm(product.name);
        setHighlightedId(product.id);
        setQuickFilter("all");
        
        // Scroll to the row
        setTimeout(() => {
          const element = document.getElementById(`product-row-${product.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);

        // Remove highlight after 3 seconds
        const timer = setTimeout(() => setHighlightedId(null), 3000);
        return () => clearTimeout(timer);
      }
    } else if (location.state?.search) {
      setSearchTerm(location.state.search);
      setQuickFilter("all");
    } else if (location.state?.productId) {
      const product = inventoryArray.find(p => p.id === location.state.productId);
      if (product) {
        setSearchTerm(product.name);
        setSelectedRows([product.id]);
        setQuickFilter("all");
      }
    } else if (location.state?.filter) {
      setQuickFilter(location.state.filter);
      
      if (location.state.filter === "low-stock") {
        const lowStockIds = inventoryArray
          .filter(item => item.stock < item.reorderPoint)
          .map(item => item.id);
        setSelectedRows(lowStockIds);
      }
    }
  }, [location.state, inventoryArray]);

  const thresholds = { low: 30, critical: 10, max: 100 };

  // Interaction State
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [deleteCategoryName, setDeleteCategoryName] = useState<string | null>(null);
  const [viewItemId, setViewItemId] = useState<number | null>(null);
  const [editStockItemId, setEditStockItemId] = useState<number | null>(null);
  const [editStockQty, setEditStockQty] = useState<number>(1);
  const [editPriceItemId, setEditPriceItemId] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>("");
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [stockUpOpen, setStockUpOpen] = useState(false);
  const [pinnedItems, setPinnedItems] = useState<Set<number>>(new Set());
  const [excludedStockUpItems, setExcludedStockUpItems] = useState<Set<number>>(new Set());

  const filteredItems = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysFromNow = new Date(todayStart);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    let arr = inventoryArray.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      
      let matchesDate = true;
      if (dateFrom) {
        matchesDate = matchesDate && item.createdAt >= new Date(dateFrom).toISOString();
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && item.createdAt <= end.toISOString();
      }

      let matchesQuickFilter = true;
      if (quickFilter === "in-stock") matchesQuickFilter = item.stock > 0;
      else if (quickFilter === "low-stock") matchesQuickFilter = item.stock >= thresholds.critical && item.stock < thresholds.low;
      else if (quickFilter === "critical") matchesQuickFilter = item.stock < thresholds.critical;
      else if (quickFilter === "expiring") {
        if (!item.expiryDate) matchesQuickFilter = false;
        else {
          const expiry = new Date(item.expiryDate);
          matchesQuickFilter = item.stock > 0 && expiry >= todayStart && expiry <= thirtyDaysFromNow;
        }
      }

      return matchesSearch && matchesCategory && matchesDate && matchesQuickFilter;
    });

    // Pinned logic: pinned items first
    arr = [...arr].sort((a, b) => {
      const aPinned = pinnedItems.has(a.id);
      const bPinned = pinnedItems.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    if (sortConfig.key !== "none") {
      arr = [...arr].sort((a: any, b: any) => {
        // If one is pinned and other isn't, maintain pinned status first
        const aPinned = pinnedItems.has(a.id);
        const bPinned = pinnedItems.has(b.id);
        if (aPinned !== bPinned) return 0; 

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (typeof aValue === "string") {
          return sortConfig.direction === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      });
    }
    return arr;
  }, [inventoryArray, searchTerm, categoryFilter, dateFrom, dateTo, sortConfig, quickFilter, pinnedItems, thresholds]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, dateFrom, dateTo, quickFilter, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, Math.max(1, totalPages || 1)));
  }, [totalPages]);

  const metrics = useMemo(() => {
    const stockOnHand = inventoryArray.reduce((sum, item) => sum + item.stock, 0);
    const critical = inventoryArray.filter((item) => item.stock < thresholds.critical).length;
    const low = inventoryArray.filter((item) => item.stock >= thresholds.critical && item.stock < thresholds.low).length;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysFromNow = new Date(todayStart);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiring = inventoryArray.filter((item) => {
      if (!item.expiryDate) return false;
      if (item.stock <= 0) return false;
      const expiry = new Date(item.expiryDate);
      return expiry >= todayStart && expiry <= thirtyDaysFromNow;
    }).length;

    return { stockOnHand, critical, low, expiring };
  }, [inventoryArray, thresholds]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getStatusBadge = (item: any) => {
    const stock = item.stock;
    const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    if (expiryDate && expiryDate < today) {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Expired
        </Badge>
      );
    }

    if (expiryDate && expiryDate <= thirtyDaysFromNow) {
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Expiring Soon
        </Badge>
      );
    }

    if (stock < thresholds.critical) {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Critical Stock
        </Badge>
      );
    }
    if (stock < thresholds.low) {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Low Stock
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Healthy
      </Badge>
    );
  };

  const exportCsv = () => {
    const rows = [
      ["Product Name", "SKU", "Category", "Stock", "Status", "Price", "Created At"],
      ...filteredItems.map((i) => {
        const status = i.stock < thresholds.critical ? "Critical" : i.stock < thresholds.low ? "Low Stock" : "In Stock";
        return [i.name, i.sku, i.category, String(i.stock), status, String(i.price), i.createdAt];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFile = (format: "csv" | "excel" | "pdf") => {
    if (format === "csv") {
      exportCsv();
      return;
    }
    
    // Excel Export
    if (format === "excel") {
      const data = filteredItems.map(i => ({
        "Product Name": i.name,
        "SKU": i.sku,
        "Category": i.category,
        "Stock Level": i.stock,
        "Status": i.stock < thresholds.critical ? "Critical" : i.stock < thresholds.low ? "Low Stock" : "Healthy",
        "Price": i.price
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory");
      const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      XLSX.writeFile(wb, `SellSync_Inventory_${dateStr}.xlsx`);
      toast.success("Inventory exported as Excel");
      return;
    }

    // PDF Export
    if (format === "pdf") {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("Inventory Status Report", 105, 15, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 25);

      const tableData = filteredItems.map(i => [
        i.name,
        i.sku,
        i.category,
        i.stock,
        formatCurrency(i.price),
        i.stock < thresholds.critical ? "CRITICAL" : i.stock < thresholds.low ? "LOW" : "Healthy"
      ]);

      (doc as any).autoTable({
        startY: 30,
        head: [["Product", "SKU", "Category", "Stock", "Price", "Status"]],
        body: tableData,
        headStyles: { fillColor: [79, 70, 229] }
      });

      doc.save(`inventory_report_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Inventory exported to PDF");
    }
  };

  const handleBulkPin = () => {
    const nextPinned = new Set(pinnedItems);
    selectedRows.forEach(id => {
      if (nextPinned.has(id)) nextPinned.delete(id);
      else nextPinned.add(id);
    });
    setPinnedItems(nextPinned);
    setSelectedRows([]);
  };

  const handleBulkDelete = () => {
    selectedRows.forEach(id => deleteProduct(id));
    setSelectedRows([]);
  };

  const selectedView = viewItemId ? inventoryArray.find((i) => i.id === viewItemId) : null;

  const canEditInventory = canEdit("Inventory");
  const isGlobalView = useStore().currentStore.id === "S-ALL";
  const isAdminAllStores = currentUser?.role === "Admin" && adminOverview;

  return (
    <div className={`p-6 space-y-6 min-h-screen ${theme === 'dark' ? 'bg-gray-950 text-gray-100' : 'bg-white text-gray-900'}`}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">Inventory</h1>
            {isAdminAllStores && (
              <Badge className="bg-indigo-600 text-white border-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg">
                All Stores
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            {isAdminAllStores
              ? "Stock levels and inventory health across all your stores."
              : `Manage stock levels and inventory health for ${useStore().currentStore.name}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isGlobalView && (canEditInventory || isAdminAllStores) ? (
            <Button 
              variant="outline" 
              onClick={() => exportFile("excel")}
              className={`hidden sm:flex gap-2 rounded-xl font-bold h-11 ${theme === 'dark' ? 'bg-gray-900 border-gray-800 text-white hover:bg-gray-800' : 'bg-white hover:bg-gray-50'}`}
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button disabled variant="outline" className={`hidden sm:flex gap-2 rounded-xl font-bold h-11 ${theme === 'dark' ? 'bg-gray-900 border-gray-800 text-gray-500' : 'bg-white text-gray-400'}`}>
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Switch to a specific store to export</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!isGlobalView && canEditInventory ? (
            <Button onClick={() => setAddCatOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 px-6 rounded-xl font-black shadow-lg shadow-indigo-100">
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button disabled className="bg-gray-100 text-gray-400 border-none h-11 px-6 rounded-xl font-black cursor-not-allowed">
                    <Plus className="w-4 h-4" />
                    Add Category
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Switch to a specific store to add categories</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className={`border-gray-200 shadow-sm cursor-pointer transition-all hover:ring-2 hover:ring-indigo-500/20 ${quickFilter === "in-stock" ? "ring-2 ring-indigo-500" : ""} ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}
                onClick={() => setQuickFilter("in-stock")}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Stock on Hand</p>
                      <KPIValue value={metrics.stockOnHand} formatter={(v) => v.toLocaleString()} className="text-gray-900 mt-1" animate />
                    </div>
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 font-medium">-3%</span>
                    <span>vs last week</span>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>Click to view in-stock items</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className={`border-gray-200 shadow-sm cursor-pointer transition-all hover:ring-2 hover:ring-indigo-500/20 ${quickFilter === "low-stock" ? "ring-2 ring-indigo-500" : ""} ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}
                onClick={() => setQuickFilter("low-stock")}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Low Stock</p>
                      <KPIValue value={metrics.low} className="text-gray-900 mt-1" animate />
                    </div>
                    <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-yellow-700">
                    <span className="font-medium">10–29 units</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>Low: 10–29 units</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className={`border-gray-200 shadow-sm cursor-pointer transition-all hover:ring-2 hover:ring-indigo-500/20 ${quickFilter === "critical" ? "ring-2 ring-indigo-500" : ""} ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}
                onClick={() => setQuickFilter("critical")}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Critical</p>
                      <KPIValue value={metrics.critical} className="text-gray-900 mt-1" animate />
                    </div>
                    <div className={`w-12 h-12 ${metrics.critical > 0 ? "bg-red-50" : "bg-gray-50"} rounded-xl flex items-center justify-center`}>
                      <AlertTriangle className={`w-6 h-6 ${metrics.critical > 0 ? "text-red-600 animate-pulse" : "text-gray-400"}`} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    {metrics.critical > 0 ? (
                      <span className="text-red-600 font-bold">Urgent Attention</span>
                    ) : (
                      <span className="text-gray-500">All Healthy</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>Critical: &lt;10 units</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className={`border-gray-200 shadow-sm cursor-pointer transition-all hover:ring-2 hover:ring-indigo-500/20 ${quickFilter === "expiring" ? "ring-2 ring-indigo-500" : ""} ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}
                onClick={() => setQuickFilter("expiring")}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Expiring Stock</p>
                      <KPIValue value={metrics.expiring} className="text-gray-900 mt-1" animate />
                    </div>
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-orange-700">
                    <span className="font-medium">Next 30 days</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>Expiring within 30 days</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Intelligent Alert Banner */}
      {(metrics.low > 0 || metrics.critical > 0) && (
        <Card className={`${theme === 'dark' ? 'bg-orange-950/20 border-orange-900/30' : 'bg-orange-50 border-orange-100'} shadow-sm overflow-hidden`}>
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className={`text-sm font-bold ${theme === 'dark' ? 'text-orange-400' : 'text-orange-900'}`}>{metrics.critical + metrics.low} items need attention</p>
                <p className={`text-xs ${theme === 'dark' ? 'text-orange-500/70' : 'text-orange-700'}`}>AI Suggestion: Reorder critical items now to prevent stockouts based on current sales velocity.</p>
              </div>
            </div>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white shrink-0 gap-2" disabled={!canEditInventory} onClick={() => setStockUpOpen(true)}>
              Stock Up
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className={`flex items-center gap-1 p-1 rounded-lg w-fit ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <Button
            variant={quickFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            className={`px-4 rounded-md ${quickFilter === "all" ? (theme === 'dark' ? "bg-gray-800" : "bg-white shadow-sm") : ""}`}
            onClick={() => setQuickFilter("all")}
          >
            All
          </Button>
          <Button
            variant={quickFilter === "in-stock" ? "secondary" : "ghost"}
            size="sm"
            className={`px-4 rounded-md ${quickFilter === "in-stock" ? (theme === 'dark' ? "bg-gray-800" : "bg-white shadow-sm") : ""}`}
            onClick={() => setQuickFilter("in-stock")}
          >
            In Stock
          </Button>
          <Button
            variant={quickFilter === "low-stock" ? "secondary" : "ghost"}
            size="sm"
            className={`px-4 rounded-md ${quickFilter === "low-stock" ? (theme === 'dark' ? "bg-gray-800" : "bg-white shadow-sm") : ""}`}
            onClick={() => setQuickFilter("low-stock")}
          >
            Low Stock
          </Button>
          <Button
            variant={quickFilter === "critical" ? "secondary" : "ghost"}
            size="sm"
            className={`px-4 rounded-md ${quickFilter === "critical" ? (theme === 'dark' ? "bg-gray-800" : "bg-white shadow-sm") : ""}`}
            onClick={() => setQuickFilter("critical")}
          >
            Critical
          </Button>
          <Button
            variant={quickFilter === "expiring" ? "secondary" : "ghost"}
            size="sm"
            className={`px-4 rounded-md ${quickFilter === "expiring" ? (theme === 'dark' ? "bg-gray-800" : "bg-white shadow-sm") : ""}`}
            onClick={() => setQuickFilter("expiring")}
          >
            Expiring
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search product name, SKU, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-9 border-none ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white border-gray-200'}`}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className={`gap-2 ${filtersOpen ? "bg-indigo-50 border-indigo-200 text-indigo-700" : ""} ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : ''}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <Card className={`border-gray-200 shadow-sm relative overflow-hidden ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}>
        {selectedRows.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-14 bg-indigo-600 text-white flex items-center px-6 justify-between z-10 animate-in slide-in-from-top duration-200">
            <span className="font-medium">{selectedRows.length} items selected</span>
            <div className="flex items-center gap-3">
              {canEditInventory && selectedRows.length === 1 ? (
                <>
                  <Button variant="ghost" className="text-white hover:bg-white/10 gap-2" onClick={() => {
                    setEditStockItemId(selectedRows[0]);
                    setEditStockQty(1);
                  }}>
                    <Plus className="w-4 h-4" />
                    Edit Stock
                  </Button>
                  <Button variant="ghost" className="text-white hover:bg-white/10 gap-2" onClick={() => {
                    const item = inventoryArray.find(i => i.id === selectedRows[0]);
                    setEditPriceItemId(selectedRows[0]);
                    setEditPriceValue(item ? String(item.price) : "0");
                  }}>
                    <Tag className="w-4 h-4" />
                    Edit Price
                  </Button>
                </>
              ) : canEditInventory && selectedRows.length > 1 ? (
                <Button 
                  variant="ghost" 
                  className="text-white hover:bg-white/10 gap-2" 
                  onClick={handleBulkPin}
                >
                  <Pin className="w-4 h-4" />
                  Pin to Top
                </Button>
              ) : null}
              {canEditInventory && (
                <Button variant="ghost" className="text-white hover:bg-white/10 gap-2 text-red-100" onClick={() => {
                  if (selectedRows.length === 1) setDeleteItemId(selectedRows[0]);
                  else handleBulkDelete();
                }}>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              )}
              <div className="w-px h-6 bg-white/20 mx-2" />
              <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSelectedRows([])}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={`${theme === 'dark' ? 'bg-gray-800/50 border-gray-800' : 'bg-gray-50/50 border-gray-100'}`}>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedRows.length === paginatedItems.length && paginatedItems.length > 0}
                      onCheckedChange={(checked) => {
                        setSelectedRows(checked ? paginatedItems.map(i => i.id) : []);
                      }}
                    />
                  </TableHead>
                  <TableHead className="w-16">Image</TableHead>
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
                  <TableHead>Category</TableHead>
                  <TableHead className="w-48 cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("stock")}>
                    <div className="flex items-center gap-1">
                      Stock Level
                      {sortConfig.key === "stock" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("price")}>
                    <div className="flex items-center gap-1 justify-end">
                      Price
                      {sortConfig.key === "price" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Package className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No products found</p>
                        <p className="text-sm">Try adjusting your filters or search term</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => {
                    const stockPercent = Math.min(100, (item.stock / thresholds.max) * 100);
                    const stockColor = item.stock < thresholds.critical ? "bg-red-500" : item.stock < thresholds.low ? "bg-yellow-500" : "bg-green-500";
                    const isPinned = pinnedItems.has(item.id);
                    const isHighlighted = highlightedId === item.id;
                    
                    return (
                      <TableRow 
                        key={item.id} 
                        id={`product-row-${item.id}`}
                        className={`group transition-all duration-500 ${isPinned ? (theme === 'dark' ? "bg-indigo-950/20" : "bg-indigo-50/30") : ""} ${isHighlighted ? (theme === 'dark' ? 'ring-2 ring-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'ring-2 ring-indigo-500 bg-indigo-50 shadow-[0_0_15px_rgba(99,102,241,0.2)] scale-[1.01]') : ""} ${theme === 'dark' ? 'hover:bg-gray-800/50 border-gray-800' : 'hover:bg-gray-50/80 border-gray-100'}`}
                      >
                        <TableCell>
                          <Checkbox 
                            checked={selectedRows.includes(item.id)}
                            onCheckedChange={(checked) => {
                              setSelectedRows(prev => checked ? [...prev, item.id] : prev.filter(id => id !== item.id));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                            {isPinned ? <Pin className="w-4 h-4 text-indigo-600" /> : <span className="text-gray-400 font-bold text-lg">{item.name[0]}</span>}
                          </div>
                        </TableCell>
                        <TableCell className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>{item.name}</TableCell>
                        <TableCell className="text-gray-500 font-mono text-xs">{item.sku}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-normal ${theme === 'dark' ? 'border-gray-700 text-gray-400' : 'border-gray-200'}`}>{item.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}>{item.stock} units</span>
                              <span className="text-gray-400">{thresholds.max} max</span>
                            </div>
                            <Progress value={stockPercent} className={`h-1.5 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`} indicatorClassName={stockColor} />
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(item)}</TableCell>
                        <TableCell className="text-right font-black text-indigo-600">{formatCurrency(item.price)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" title="Actions" aria-label="Actions">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={`w-48 ${theme === 'dark' ? 'bg-gray-900 border-gray-800 text-white' : 'bg-slate-900 text-white border-slate-700'}`}>
                                <DropdownMenuItem onClick={() => setViewItemId(item.id)} className="gap-2">
                                  <ExternalLink className="w-4 h-4" /> View Details
                                </DropdownMenuItem>
                                {canEditInventory && (
                                  <DropdownMenuItem onClick={() => { setEditStockItemId(item.id); setEditStockQty(1); }} className="gap-2">
                                    <Plus className="w-4 h-4" /> Edit Stock
                                  </DropdownMenuItem>
                                )}
                                {canEditInventory && (
                                  <DropdownMenuItem onClick={() => { setEditPriceItemId(item.id); setEditPriceValue(String(item.price)); }} className="gap-2">
                                    <Tag className="w-4 h-4" /> Edit Price
                                  </DropdownMenuItem>
                                )}
                                {canEditInventory && (
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      const next = new Set(pinnedItems);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      setPinnedItems(next);
                                    }} 
                                    className="gap-2"
                                  >
                                    <Pin className="w-4 h-4" /> {isPinned ? "Unpin" : "Pin to Top"}
                                  </DropdownMenuItem>
                                )}
                                {canEditInventory && (
                                  <DropdownMenuItem onClick={() => downloadProductQrCode(item, `${item.name.replace(/\s+/g, "-").toLowerCase()}-qr.svg`)} className="gap-2">
                                    <QrCode className="w-4 h-4" /> Generate QR Code
                                  </DropdownMenuItem>
                                )}
                                {canEditInventory && (
                                  <DropdownMenuItem className="text-red-600 gap-2" onClick={() => setDeleteItemId(item.id)}>
                                    <Trash2 className="w-4 h-4" /> Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {filteredItems.length > 0 && (
        <div className={`mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
          <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            Showing {Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(filteredItems.length, currentPage * itemsPerPage)} of {filteredItems.length} products
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className={`h-9 text-xs ${theme === 'dark' ? 'border-gray-800 bg-gray-950 hover:bg-gray-900' : 'border-gray-200 bg-white'}`}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className={`h-9 w-9 p-0 text-xs ${currentPage === page ? 'bg-indigo-600 hover:bg-indigo-700' : theme === 'dark' ? 'border-gray-800 bg-gray-950 hover:bg-gray-900' : 'border-gray-200 bg-white'}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className={`h-9 text-xs ${theme === 'dark' ? 'border-gray-800 bg-gray-950 hover:bg-gray-900' : 'border-gray-200 bg-white'}`}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Sheets & Dialogs */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Stock Status</label>
              <Select value={quickFilter} onValueChange={(v: any) => setQuickFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low-stock">Low Stock</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="expiring">Expiring</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">From</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">To</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="pt-6 border-t flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => {
                setCategoryFilter("all"); setQuickFilter("all"); setDateFrom(""); setDateTo("");
              }}>Reset</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => setFiltersOpen(false)}>Apply Filters</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* View Details Modal */}
      <Dialog open={viewItemId !== null} onOpenChange={(o) => !o && setViewItemId(null)}>
        <DialogContent className="bg-slate-900 text-white border-slate-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Product Details</DialogTitle>
          </DialogHeader>
          {selectedView && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Name</p>
                  <p className="text-lg font-medium">{selectedView.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">SKU</p>
                  <p className="text-lg font-medium font-mono">{selectedView.sku}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Category</p>
                  <p className="text-lg font-medium">{selectedView.category}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Current Stock</p>
                  <p className="text-lg font-medium">{selectedView.stock} units</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Price</p>
                  <p className="text-lg font-medium font-bold text-indigo-400">{formatCurrency(selectedView.price)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Reorder Point</p>
                  <p className="text-lg font-medium">{selectedView.reorderPoint} units</p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Created At</p>
                <p className="text-sm">{new Date(selectedView.createdAt).toLocaleString()}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => setViewItemId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Modal */}
      <Dialog open={editStockItemId !== null} onOpenChange={(o) => !o && setEditStockItemId(null)}>
        <DialogContent className="bg-slate-900 text-white border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Restock {inventoryArray.find(i => i.id === editStockItemId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-400">Current stock: <span className="font-bold text-white">{inventoryArray.find(i => i.id === editStockItemId)?.stock}</span> units</p>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white" onClick={() => setEditStockQty(prev => Math.max(1, prev - 1))}>
                <Minus className="w-4 h-4" />
              </Button>
              <Input type="number" className="bg-slate-800 border-slate-700 text-white text-center text-lg font-bold" value={editStockQty} onChange={(e) => setEditStockQty(Math.max(1, Number(e.target.value)))} />
              <Button variant="outline" size="icon" className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white" onClick={() => setEditStockQty(prev => prev + 1)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setEditStockItemId(null)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => {
              if (editStockItemId !== null) {
                const item = inventoryArray.find(i => i.id === editStockItemId);
                adjustStock(editStockItemId, editStockQty);
                toast.success(`Added ${editStockQty} units to ${item?.name}`);
                setEditStockItemId(null);
              }
            }}>Add Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Price Modal */}
      <Dialog open={editPriceItemId !== null} onOpenChange={(o) => !o && setEditPriceItemId(null)}>
        <DialogContent className="bg-slate-900 text-white border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Price - {inventoryArray.find(i => i.id === editPriceItemId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-400">Current price: <span className="font-bold text-white">{formatCurrency(inventoryArray.find(i => i.id === editPriceItemId)?.price || 0)}</span></p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">New Price ({currency.symbol})</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{currency.symbol}</span>
                <Input type="number" step="0.01" className="bg-slate-800 border-slate-700 text-white pl-8" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setEditPriceItemId(null)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => {
              if (editPriceItemId !== null) {
                const item = inventoryArray.find(i => i.id === editPriceItemId);
                setProductPrice(editPriceItemId, Number(editPriceValue));
                toast.success(`Price updated for ${item?.name} to ${formatCurrency(Number(editPriceValue))}`);
                setEditPriceItemId(null);
              }
            }}>Update Price</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Up / Reorder Modal */}
      <Dialog open={stockUpOpen} onOpenChange={(o) => {
        setStockUpOpen(o);
        if (!o) setExcludedStockUpItems(new Set());
      }}>
        <DialogContent className="bg-slate-900 text-white border-slate-700 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Stock Up Required</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              {inventoryArray
                .filter(i => i.stock < thresholds.low && !excludedStockUpItems.has(i.id))
                .sort((a, b) => a.stock - b.stock)
                .map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="space-y-1">
                      <p className="font-medium">{item.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge className={item.stock < thresholds.critical ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                          {item.stock} in stock
                        </Badge>
                        <span className="text-xs text-slate-400">Target: {thresholds.max}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 mr-2">Add Stock:</label>
                      <Input 
                        type="number" 
                        className="w-24 bg-slate-800 border-slate-700 text-white text-center"
                        defaultValue={thresholds.max - item.stock}
                        id={`stock-up-${item.id}`}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => setExcludedStockUpItems(prev => new Set([...prev, item.id]))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => {
              setStockUpOpen(false);
              setExcludedStockUpItems(new Set());
            }}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => {
              inventoryArray
                .filter(i => i.stock < thresholds.low && !excludedStockUpItems.has(i.id))
                .forEach(item => {
                  const input = document.getElementById(`stock-up-${item.id}`) as HTMLInputElement;
                  if (input && input.value) {
                    setProductStock(item.id, item.stock + Number(input.value));
                  }
                });
              setStockUpOpen(false);
              setExcludedStockUpItems(new Set());
            }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Modal */}
      <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Existing Categories</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {categories.map(cat => {
                  const productCount = inventoryArray.filter(i => i.category === cat).length;
                  return (
                    <div key={cat} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white">{cat}</span>
                        <span className="text-xs text-slate-500">({productCount} products)</span>
                      </div>
                      {canEditInventory && (
                        <button
                          onClick={() => {
                            if (productCount > 0) {
                              setDeleteCategoryName(cat);
                            } else {
                              removeCategory(cat);
                              toast.success(`"${cat}" category deleted`);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-slate-700 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Add New Category</label>
                <div className="flex gap-2">
                  <Input 
                    className="h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/20 flex-1" 
                    value={newCategoryName} 
                    onChange={e => setNewCategoryName(e.target.value)} 
                    placeholder="e.g. Wellness" 
                  />
                  <Button className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-6 shrink-0" onClick={() => {
                    if (newCategoryName.trim()) {
                      addCategory(newCategoryName.trim());
                      setNewCategoryName("");
                      toast.success("Category added successfully");
                      if (currentUser?.role !== "Admin") {
                        addNotification({
                          id: `notif-category-${Date.now()}`,
                          type: "info",
                          title: "New Category Added",
                          message: `${currentUser?.name || "A user"} added "${newCategoryName.trim()}" category in ${currentStore.name}.`,
                          timestamp: new Date().toISOString(),
                          read: false,
                          link: "/inventory",
                        });
                      }
                    }
                  }}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Delete Confirmation */}
      <Dialog open={deleteCategoryName !== null} onOpenChange={(o) => !o && setDeleteCategoryName(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delete "{deleteCategoryName}"?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              This category has products assigned to it. Deleting it will remove the category from those products. Are you sure you want to continue?
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Affected Products:</p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {inventoryArray
                  .filter(i => i.category === deleteCategoryName)
                  .slice(0, 10)
                  .map(item => (
                    <li key={item.id} className="flex items-center justify-between text-sm text-amber-700">
                      <span>{item.name}</span>
                      <span className="text-xs text-amber-500">SKU: {item.sku}</span>
                    </li>
                  ))}
                {inventoryArray.filter(i => i.category === deleteCategoryName).length > 10 && (
                  <li className="text-sm text-amber-500 italic pt-1">
                    and {inventoryArray.filter(i => i.category === deleteCategoryName).length - 10} more...
                  </li>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteCategoryName(null)}>Cancel</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => {
              if (deleteCategoryName) {
                removeCategory(deleteCategoryName);
                toast.success(`"${deleteCategoryName}" category deleted`);
                setDeleteCategoryName(null);
              }
            }}>Delete Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteItemId !== null} onOpenChange={(o) => !o && setDeleteItemId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">Are you sure you want to delete this product? This action cannot be undone and will remove all associated stock data.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteItemId(null)}>Cancel</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => {
              if (deleteItemId !== null) deleteProduct(deleteItemId);
              setDeleteItemId(null);
            }}>Delete Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
