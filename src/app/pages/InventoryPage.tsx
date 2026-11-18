import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router";
import {
  Search,
  Plus,
  Download,
  Package,
  AlertTriangle,
  CheckCircle2,
  Check,
  ChevronUp,
  ChevronDown,
  Trash2,
  Tag,
  ArrowRight,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Pin,
  Minus,
  FileText,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Stagger } from "../../animations/Stagger";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Progress } from "../components/ui/progress";
import { ScrollArea } from "../components/ui/scroll-area";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useStore, useProductSync } from "../state/store";
import { KPIValue } from "../components/KPIValue";
import {
  buildProductImageUrl,
  placeholderProductImage,
  fetchProductImage,
} from "../../lib/productImage";
import { AddProductModal } from "../components/AddProductModal";

function InventoryThumb({
  name,
  imageUrl,
  pinned,
}: {
  name: string;
  imageUrl?: string;
  pinned?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = failed
    ? placeholderProductImage(name)
    : imageUrl || buildProductImageUrl(name);
  return (
    <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden border border-outline-variant/50 bg-surface-container shrink-0">
      {pinned ? (
        <Pin className="w-4 h-4 text-primary-container" />
      ) : (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

export function InventoryPage() {
  const {
    inventoryArray,
    categories,
    setProductStock,
    setProductPrice,
    deleteProduct,
    addCategory,
    removeCategory,
    addProduct,
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
  // Read products from the database (not a login-time snapshot) so this
  // page stays in sync across Manager and Cashier sessions.
  useProductSync();


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
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
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

    // Stock levels are judged against each product's OWN reorder point, not one
    // global cut-off. A line that warns at 50 units is not "healthy" at 30
    // just because 30 clears a hardcoded <10 rule, and a line that warns at 5
    // is not "in stock" at 9. The global thresholds stay as a floor for
    // products that have no reorder point set at all (0).
    const lowAt = (item: { stock: number; reorderPoint: number }) => {
      const point = item.reorderPoint > 0 ? item.reorderPoint : thresholds.low;
      return item.stock <= point;
    };
    const criticalAt = (item: { stock: number; reorderPoint: number }) => {
      if (item.stock <= 0) return true;
      const point = item.reorderPoint > 0 ? item.reorderPoint : thresholds.low;
      return item.stock <= Math.max(1, Math.floor(point / 2));
    };

    const critical = inventoryArray.filter(criticalAt).length;
    const low = inventoryArray.filter(
      (item) => lowAt(item) && !criticalAt(item),
    ).length;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysFromNow = new Date(todayStart);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // `expiryDate` is now actually populated by mapProduct, so these two finally
    // have data to work with. Out-of-stock lines are excluded from "expiring"
    // (there is nothing to sell) but an expired line is always worth surfacing.
    const withExpiry = inventoryArray.filter((item) => {
      if (!item.expiryDate) return false;
      return !Number.isNaN(new Date(item.expiryDate).getTime());
    });

    const expiring = withExpiry.filter((item) => {
      if (item.stock <= 0) return false;
      const expiry = new Date(item.expiryDate!);
      return expiry >= todayStart && expiry <= thirtyDaysFromNow;
    }).length;

    const expired = withExpiry.filter(
      (item) => new Date(item.expiryDate!) < todayStart,
    ).length;

    return { stockOnHand, critical, low, expiring, expired };
  }, [inventoryArray, thresholds]);

  const { activeCategories, unusedCategories } = useMemo(() => {
    const usedSet = new Set(inventoryArray.map((p) => p.category));
    const active = categories.filter((c) => usedSet.has(c)).length;
    return { activeCategories: active, unusedCategories: categories.length - active };
  }, [categories, inventoryArray]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Status is icon-only; the label expands on hover so the column stays compact.
  // Mirrors the status cell on the transactions list.
  const getStatusBadge = (item: any) => {
    const stock = item.stock;
    const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    let circle = "bg-[#00A651] group-hover/status:bg-[#008a43]";
    let labelColor = "text-[#00A651]";
    let text = "Healthy";
    let Icon = Check;

    if (expiryDate && expiryDate < today) {
      circle = "bg-red-500 group-hover/status:bg-red-600";
      labelColor = "text-red-600";
      text = "Expired";
      Icon = AlertTriangle;
    } else if (expiryDate && expiryDate <= thirtyDaysFromNow) {
      circle = "bg-orange-500 group-hover/status:bg-orange-600";
      labelColor = "text-orange-600";
      text = "Expiring Soon";
      Icon = AlertTriangle;
    } else {
      // Judged against the product's own reorder point, so the icon agrees with
      // the Critical / Low Stock cards at the top of the page.
      const point = item.reorderPoint > 0 ? item.reorderPoint : thresholds.low;
      if (stock <= Math.max(1, Math.floor(point / 2))) {
        circle = "bg-red-500 group-hover/status:bg-red-600";
        labelColor = "text-red-600";
        text = "Critical Stock";
        Icon = AlertTriangle;
      } else if (stock <= point) {
        circle = "bg-amber-500 group-hover/status:bg-amber-600";
        labelColor = "text-amber-600";
        text = "Low Stock";
        Icon = AlertTriangle;
      }
    }

    return (
      <span className="group/status inline-flex items-center gap-1.5">
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${circle}`}
        >
          <Icon className="w-4 h-4 text-white" />
        </span>
        <span
          className={`max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 group-hover/status:max-w-[6.5rem] group-hover/status:opacity-100 transition-all duration-200 ${labelColor}`}
        >
          {text}
        </span>
      </span>
    );
  };

  const exportCsv = () => {
    const rows = [
      ["Product Name", "SKU", "Category", "Stock", "Status", "Price", "Created At"],
      ...filteredItems.map((i) => {
        const iPoint = i.reorderPoint > 0 ? i.reorderPoint : thresholds.low;
        const iStatus =
          i.stock <= Math.max(1, Math.floor(iPoint / 2))
            ? "Critical"
            : i.stock <= iPoint
              ? "Low Stock"
              : "In Stock";
        return [i.name, i.sku, i.category, String(i.stock), iStatus, String(i.price), i.createdAt];
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
    <Stagger className={`px-6 pt-2 pb-8 space-y-6 min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-surface text-on-surface'}`}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Inventory</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            {isAdminAllStores
              ? "Stock levels and inventory health across all your stores."
              : `Manage stock levels and inventory health for ${useStore().currentStore.name}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isGlobalView && canEditInventory ? (
            <Button 
              onClick={() => setIsAddProductOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 px-6 rounded-xl font-black shadow-lg shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button disabled className="bg-gray-100 text-gray-400 border-none h-11 px-6 rounded-xl font-black cursor-not-allowed">
                    <Plus className="w-4 h-4" />
                    Add Product
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Switch to a specific store to add products</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!isGlobalView && canEditInventory ? (
            <Button 
              variant="outline" 
              onClick={() => setAddCatOpen(true)}
              className={`hidden sm:flex gap-2 rounded-xl font-bold h-11 ${theme === 'dark' ? 'bg-gray-900 border-gray-800 text-white hover:bg-gray-800' : 'bg-white hover:bg-gray-50'}`}
            >
              <Tag className="w-4 h-4" />
              Add Category
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button disabled variant="outline" className={`hidden sm:flex gap-2 rounded-xl font-bold h-11 ${theme === 'dark' ? 'bg-gray-900 border-gray-800 text-gray-500' : 'bg-white text-gray-400'}`}>
                    <Tag className="w-4 h-4" />
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bento-card bento-card-hover border-none shadow-none">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Total Products</p>
                <KPIValue value={inventoryArray.length} className="font-display text-3xl font-extrabold text-on-surface mt-1" animate />
              </div>
              <div className="w-10 h-10 bg-primary-fixed rounded-xl flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-primary-container" />
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-on-surface-variant">{categories.length} categories available</p>
          </CardContent>
        </Card>

        <Card className="bento-card bento-card-hover border-none shadow-none">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Categories</p>
                <KPIValue value={categories.length} className="font-display text-3xl font-extrabold text-on-surface mt-1" animate />
              </div>
              <div className="w-10 h-10 bg-secondary-container/40 rounded-xl flex items-center justify-center shrink-0">
                <Tag className="w-5 h-5 text-on-secondary-container" />
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-on-surface-variant">
              {activeCategories} active · {unusedCategories} unused
            </p>
          </CardContent>
        </Card>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={`bento-card bento-card-hover border-none shadow-none cursor-pointer ${quickFilter === "in-stock" ? "ring-2 ring-primary-container" : ""}`}
                onClick={() => setQuickFilter("in-stock")}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Stock on Hand</p>
                      <KPIValue value={metrics.stockOnHand} formatter={(v) => v.toLocaleString()} className="font-display text-3xl font-extrabold text-on-surface mt-1" animate />
                    </div>
                    <div className="w-10 h-10 bg-tertiary-fixed/40 rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#00A651]" />
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                    <span className="font-semibold text-on-surface">{inventoryArray.length}</span>
                    products tracked
                  </p>
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
                className={`bento-card bento-card-hover border-none shadow-none cursor-pointer ${quickFilter === "low-stock" ? "ring-2 ring-primary-container" : ""}`}
                onClick={() => setQuickFilter("low-stock")}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Low Stock</p>
                      <KPIValue value={metrics.low} className="font-display text-3xl font-extrabold text-on-surface mt-1" animate />
                    </div>
                    <div className="w-10 h-10 bg-[#fff4e0] rounded-xl flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-[#b26a00]" />
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                    <span className="font-semibold text-[#b26a00]">
                      {metrics.low + metrics.critical}
                    </span>
                    {metrics.low + metrics.critical === 1 ? "item" : "items"} at or below reorder point
                  </p>
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
                className={`bento-card bento-card-hover border-none shadow-none cursor-pointer ${quickFilter === "expiring" ? "ring-2 ring-primary-container" : ""}`}
                onClick={() => setQuickFilter("expiring")}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Expiring Stock</p>
                      <KPIValue value={metrics.expiring} className="font-display text-3xl font-extrabold text-on-surface mt-1" animate />
                    </div>
                    <div className="w-10 h-10 bg-error-container/50 rounded-xl flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-error" />
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                    <span className="font-semibold text-error">Next 30 days</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </p>
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
        <div className={`flex items-center gap-1 p-1 rounded-xl w-fit ${theme === 'dark' ? 'bg-gray-900' : 'bg-surface-container'}`}>
          {[
            { id: "all", label: "All" },
            { id: "low-stock", label: "Low Stock" },
            { id: "critical", label: "Critical" },
            { id: "expiring", label: "Expiring" },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              className={`px-4 rounded-lg font-semibold transition-all ${
                quickFilter === tab.id
                  ? "bg-surface-container-lowest text-primary-container shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
              onClick={() => setQuickFilter(tab.id as typeof quickFilter)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <Input
              placeholder="Search product name, SKU, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-9 border-none rounded-xl ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-surface-container-lowest border border-outline-variant/40'}`}
            />
          </div>
          {!isGlobalView && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={`gap-2 rounded-xl font-bold h-11 shrink-0 ${theme === 'dark' ? 'bg-gray-900 border-gray-800 text-white hover:bg-gray-800' : 'bg-white hover:bg-gray-50'}`}
                >
                  <Download className="w-4 h-4" />
                  Export
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl p-1.5 w-44">
                <DropdownMenuItem onClick={() => exportFile("csv")} className="rounded-lg cursor-pointer">
                  <FileText className="w-4 h-4 mr-2" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFile("excel")} className="rounded-lg cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFile("pdf")} className="rounded-lg cursor-pointer">
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Table Section */}
      <Card className={`bento-card border-none shadow-none relative overflow-hidden ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : ''}`}>
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
            <Table className="table-fixed min-w-[980px] [&_th]:px-6 [&_td]:px-6">
              <TableHeader>
                <TableRow className={`${theme === 'dark' ? 'bg-gray-800/50 hover:!bg-gray-800/50 border-gray-800' : 'bg-surface-container-low hover:!bg-surface-container-low border-outline-variant/30'}`}>
                  <TableHead className="w-16">Image</TableHead>
                  <TableHead className="cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("name")}>
                    <div className="flex items-center gap-1">
                      Product Name
                      {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[14%] cursor-pointer hover:text-indigo-600 transition-colors group px-4" onClick={() => handleSort("sku")}>
                    <div className="flex items-center gap-1">
                      SKU
                      {sortConfig.key === "sku" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[14%] px-4">Category</TableHead>
                  <TableHead className="w-[20%] px-4 cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("stock")}>
                    <div className="flex items-center gap-1">
                      Stock Level
                      {sortConfig.key === "stock" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[14%] text-right">Status</TableHead>
                  <TableHead className="w-[12%] text-right cursor-pointer hover:text-indigo-600 transition-colors group" onClick={() => handleSort("price")}>
                    <div className="flex items-center justify-end gap-1">
                      Price
                      {sortConfig.key === "price" ? (sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
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
                        onClick={() => setViewItemId(item.id)}
                        className={`group cursor-pointer transition-all duration-500 ${isPinned ? (theme === 'dark' ? "bg-indigo-950/20" : "bg-indigo-50/30") : ""} ${isHighlighted ? (theme === 'dark' ? 'ring-2 ring-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'ring-2 ring-indigo-500 bg-indigo-50 shadow-[0_0_15px_rgba(99,102,241,0.2)] scale-[1.01]') : ""} ${theme === 'dark' ? 'hover:bg-gray-800/50 border-gray-800' : 'hover:bg-surface-container-low border-outline-variant/20'}`}
                      >
                        <TableCell>
                          <InventoryThumb
                            name={item.name}
                            imageUrl={item.imageUrl}
                            pinned={isPinned}
                          />
                        </TableCell>
                        <TableCell className={`font-medium px-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>{item.name}</TableCell>
                        <TableCell className="px-4 text-gray-500 font-mono text-xs">{item.sku}</TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline" className={`font-normal ${theme === 'dark' ? 'border-gray-700 text-gray-400' : 'border-gray-200'}`}>{item.category}</Badge>
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}>{item.stock} units</span>
                              <span className="text-gray-400">{thresholds.max} max</span>
                            </div>
                            <Progress value={stockPercent} className={`h-1.5 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`} indicatorClassName={stockColor} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">{getStatusBadge(item)}</div>
                        </TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${theme === 'dark' ? 'text-gray-200' : 'text-black'}`}>{formatCurrency(item.price)}</TableCell>
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
        <DialogContent className="bg-surface text-on-surface border-outline-variant/40 sm:max-w-md [&_[data-slot='dialog-close']]:hidden">
          <DialogClose className="absolute top-4 right-4 h-8 w-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
            <X className="w-4 h-4" />
          </DialogClose>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Product Details</DialogTitle>
          </DialogHeader>
          {selectedView && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider">Name</p>
                  <p className="text-lg font-medium">{selectedView.name}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider">SKU</p>
                  <p className="text-lg font-medium font-mono">{selectedView.sku}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider">Category</p>
                  <p className="text-lg font-medium">{selectedView.category}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider">Current Stock</p>
                  <p className="text-lg font-medium">{selectedView.stock} units</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider">Price</p>
                  <p className={`text-lg font-medium font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-black'}`}>{formatCurrency(selectedView.price)}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider">Reorder Point</p>
                  <p className="text-lg font-medium">{selectedView.reorderPoint} units</p>
                </div>
              </div>
              <div className="pt-4 border-t border-outline-variant/40">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider">Created At</p>
                <p className="text-sm">{new Date(selectedView.createdAt).toLocaleString()}</p>
              </div>
            </div>
          )}
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

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSave={async (data) => {
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
              link: "/inventory",
            });
          }
        }}
      />

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
    </Stagger>
  );
}
