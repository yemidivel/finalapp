import { useState, useEffect } from "react";
import {
  Bell,
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  X,
  Clock,
  ExternalLink,
  Check,
  MoreVertical,
  Search,
  Store,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useStore, AppNotification } from "../state/store";
import { db } from "../../lib/db";
import { LiveDot } from "../components/LiveDot";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, fadeInUp } from "../../animations/variants";
import { Stagger } from "../../animations/Stagger";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function NotificationsPage() {
  const { 
    notifications, 
    markNotificationRead, 
    resolveNotification,
    markAllNotificationsRead, 
    clearAllNotifications,
    canEdit,
    currentUser,
    approveApprovalRequest,
    rejectApprovalRequest,
    pendingApprovals,
    allStores,
    notificationTotal,
    notificationCounts,
    loadNotificationsPage,
    currentStore,
  } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<
    "all" | "unread" | "alert" | "resolved"
  >("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const itemsPerPage = 10;
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; actionId: string }>({ open: false, actionId: "" });
  const [rejectReason, setRejectReason] = useState("");
  // Id of the alert whose resolve was just refused, so its card can play the
  // rejection wobble. Cleared shortly after so the animation can replay.
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // The feed is owned by the backend; fetch the requested page whenever the
  // page, tab or search changes. The store pauses focus/poll refreshes while
  // this page is open so they cannot yank the user back to page one.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadNotificationsPage({ page, filter, search })
      .then((result) => {
        if (!cancelled && result.totalPages > 0 && page > result.totalPages) {
          setPage(result.totalPages);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load notifications.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, filter, search, loadNotificationsPage]);

  const totalPages = Math.max(1, Math.ceil(notificationTotal / itemsPerPage));

  // Only a stock/expiry notice ("alert" type) can be resolved: acknowledging
  // one sets `resolved` (and read) so it leaves the Alerts tab and appears under
  // Resolved. A plain success item (e.g. "Sale Recorded") is never "resolved" —
  // it is just a normal notification, so it does not carry the Resolved tag and
  // does not count towards, or appear in, the Resolved tab.
  const isResolved = (n: AppNotification) => n.type === "alert" && !!n.resolved;
  const isResolvable = (n: AppNotification) => n.type === "alert" && !isResolved(n);

  // Card colour scheme: unresolved alerts stay red; a resolved low-stock alert
  // turns green like a sale card; success is green; everything else is blue.
  const toneOf = (n: AppNotification): "red" | "green" | "blue" => {
    if (n.type === "alert") return n.resolved ? "green" : "red";
    if (n.type === "success") return "green";
    return "blue";
  };

  // The name of the store a notice came from. Only the Admin reads a feed that
  // spans every store, so this is what lets them tell the shops apart; a
  // Manager's feed is already one store. Null (older rows) renders no chip.
  const storeNameOf = (n: AppNotification): string | null => {
    if (!n.storeId) return null;
    return allStores.find((s) => s.id === n.storeId)?.name || null;
  };

  // KPI counts come from the backend for the whole scope, so they stay accurate
  // even though the list only holds the current page.
  const stats = notificationCounts;

  // The list is already page-, tab- and search-filtered by the backend.
  const displayedNotifications = notifications;

  // Relative Time Formatter
  const getRelativeTime = (isoString: string) => {
    const now = new Date();
    const then = new Date(isoString);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  // Toast for new critical alerts
  useEffect(() => {
    const lastNotification = notifications[0];
    if (lastNotification && lastNotification.type === "alert" && !lastNotification.read && !lastNotification.resolved) {
      const isRecent = (new Date().getTime() - new Date(lastNotification.timestamp).getTime()) < 5000;
      if (isRecent) {
        toast.error(lastNotification.title, {
          description: lastNotification.message,
          action: {
            label: "View",
            onClick: () => handleViewDetails(lastNotification)
          }
        });
      }
    }
  }, [notifications, navigate]);

  const handleClearAll = () => {
    toast.warning("Clear all notifications?", {
      action: {
        label: "Clear All",
        onClick: () => {
          clearAllNotifications();
          toast.success("All notifications cleared");
        }
      }
    });
  };

  // Re-read the current page so rows that no longer match the active tab drop
  // out and the pager total stays truthful after a local action.
  const reloadCurrentPage = async () => {
    try {
      const result = await loadNotificationsPage({ page, filter, search });
      if (result.totalPages > 0 && page > result.totalPages) {
        setPage(result.totalPages);
      }
    } catch {
      toast.error("Could not refresh notifications.");
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    toast.success("All notifications marked as read");
    if (filter === "unread") await reloadCurrentPage();
  };

  const handleMarkRead = async (notification: AppNotification) => {
    await markNotificationRead(notification.id);
    if (filter === "unread") await reloadCurrentPage();
  };

  // A low-stock alert is only truthful to resolve once the product has actually
  // been restocked above its low-stock threshold. Re-read the product from the
  // backend at click time: if it is still at or below the threshold, refuse the
  // resolve, play the rejection wobble on the card, and say why.
  const isLowStockAlert = (n: AppNotification) =>
    n.type === "alert" && n.title.toLowerCase().includes("low stock");

  const handleResolve = async (notification: AppNotification) => {
    if (isLowStockAlert(notification) && currentStore?.id) {
      let stillLow = false;
      let detail = notification.message;
      try {
        const res = await db.products.fetch(currentStore.id);
        const name = notification.message
          .split(/ is running low/i)[0]
          .trim()
          .toLowerCase();
        const product = res.products.find(
          (p) => p.name.trim().toLowerCase() === name,
        );
        const qty = product?.inventory?.quantity ?? 0;
        const threshold = product?.inventory?.lowThreshold ?? 0;
        stillLow = !product || qty <= threshold;
        detail = product
          ? `${product.name} is at ${qty} in stock (low-stock level ${threshold}).`
          : notification.message;
      } catch {
        // If the stock check cannot be reached, do not block the manager.
        stillLow = false;
      }
      if (stillLow) {
        setRejectingId(notification.id);
        window.setTimeout(
          () =>
            setRejectingId((id) => (id === notification.id ? null : id)),
          650,
        );
        toast.error("Still at low stock", {
          description: `${detail} Restock the product before resolving this alert.`,
        });
        return;
      }
    }
    await resolveNotification(notification.id);
    toast.success("Alert resolved", { description: notification.title });
    if (filter === "alert") await reloadCurrentPage();
  };

  const handleViewDetails = (notification: AppNotification) => {
    markNotificationRead(notification.id);

    const isCashier = currentUser?.role === "Cashier";
    if (notification.type === "alert" && notification.productId) {
      navigate(isCashier ? "/inventory" : "/products", { state: { productId: notification.productId } });
    } else if (notification.link) {
      // Cashiers have no Products page, so a stock notice that links there
      // lands on Inventory instead of a route they cannot open.
      navigate(
        isCashier && notification.link.startsWith("/products")
          ? "/inventory"
          : notification.link,
      );
    } else {
      navigate("/notifications");
    }
  };

  const handleApprove = (actionId: string) => {
    approveApprovalRequest(actionId);
    toast.success("Request approved");
  };

  const handleRejectClick = (actionId: string) => {
    setRejectDialog({ open: true, actionId });
    setRejectReason("");
  };

  const handleRejectConfirm = () => {
    rejectApprovalRequest(rejectDialog.actionId, rejectReason || undefined);
    setRejectDialog({ open: false, actionId: "" });
    toast.success("Request rejected");
  };

  return (
    <Stagger className="px-8 pt-2 pb-8 space-y-8 bg-surface text-on-surface min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">Notifications</h1>
            <LiveDot size="h-4 w-4" />
          </div>
          <p className="text-sm text-on-surface-variant font-medium">
            Stay updated with important alerts and updates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            className="h-11 rounded-xl px-5 font-bold gap-2 bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest border-none shadow-none"
            onClick={handleMarkAllRead}
          >
            <CheckCircle className="w-4 h-4" />
            Mark All as Read
          </Button>
          {canEdit("Notifications") && (
            <Button
              className="h-11 rounded-xl px-5 font-bold gap-2 bg-error text-white hover:bg-[#93000a] shadow-none"
              onClick={handleClearAll}
            >
              <X className="w-4 h-4" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-5" variants={staggerContainer} initial="hidden" animate="visible">
        {[
          { label: "Total", value: stats.total, icon: Bell, chip: "bg-primary-fixed text-primary-container" },
          { label: "Unread", value: stats.unread, icon: Bell, chip: "bg-amber-100 text-amber-600" },
          { label: "Alerts", value: stats.alerts, icon: AlertTriangle, chip: "bg-error/10 text-error" },
          { label: "Resolved", value: stats.resolved, icon: CheckCircle, chip: "bg-secondary-container text-on-secondary-container" },
        ].map((stat, i) => (
          <motion.div key={i} variants={fadeInUp}>
            <div className="bento-card p-5 h-full">
              <div className={`w-11 h-11 ${stat.chip} rounded-2xl flex items-center justify-center mb-4`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-variant mb-1">{stat.label}</p>
              <h3 className="font-display text-3xl font-extrabold text-on-surface tracking-tight tabular-nums">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Filter Pills + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "All", count: stats.total },
            { id: "unread", label: "Unread", count: stats.unread },
            { id: "alert", label: "Alerts", count: stats.alerts },
            { id: "resolved", label: "Resolved", count: stats.resolved },
          ].map((pill) => (
            <button
              key={pill.id}
              className={`inline-flex items-center gap-2 rounded-full px-4 h-10 text-sm font-bold transition-all shrink-0 ${
                filter === pill.id
                  ? "bg-primary-container text-on-primary shadow-sm"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container border border-outline-variant/40"
              }`}
              onClick={() => {
                setFilter(pill.id as typeof filter);
                setPage(1);
              }}
            >
              {pill.label}
              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                filter === pill.id ? "bg-white/25 text-on-primary" : "bg-surface-container text-on-surface-variant"
              }`}>
                {pill.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search notifications..."
            className="h-10 pl-9 rounded-xl bg-surface-container-lowest border-outline-variant/40"
          />
        </div>
      </div>

      {/* Notification List — capped so the cards do not stretch the full width
          of a wide screen. */}
      <div className="space-y-4 max-w-4xl">
        <AnimatePresence mode="popLayout">
          {displayedNotifications.length > 0 ? (
            displayedNotifications.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group relative bg-surface-container-lowest rounded-2xl border border-outline-variant/40 border-l-4 p-5 shadow-sm hover:shadow-md transition-all ${
                  rejectingId === notification.id
                    ? "animate-shake border-error/60 ring-2 ring-error/30"
                    : ""
                } ${
                  toneOf(notification) === "red"
                    ? "border-l-error"
                    : toneOf(notification) === "green"
                      ? "border-l-on-secondary-container"
                      : "border-l-primary-container"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    toneOf(notification) === "red"
                      ? "bg-error/10"
                      : toneOf(notification) === "green"
                        ? "bg-secondary-container"
                        : "bg-primary-fixed"
                  }`}>
                    {toneOf(notification) === "red" ? (
                      <AlertTriangle className="w-5 h-5 text-error" />
                    ) : toneOf(notification) === "green" ? (
                      <CheckCircle className="w-5 h-5 text-on-secondary-container" />
                    ) : (
                      <Bell className="w-5 h-5 text-primary-container" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className={`text-base font-bold tracking-tight ${!notification.read ? "text-on-surface" : "text-on-surface-variant"}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
                        )}
                        {isResolvable(notification) && (
                          <Badge className="bg-error/10 text-error border-none text-[10px] font-black uppercase tracking-wider">
                            Alert (Unresolved)
                          </Badge>
                        )}
                        {isResolved(notification) && (
                          <Badge className="bg-secondary-container text-on-secondary-container border-none text-[10px] font-black uppercase tracking-wider">
                            Resolved
                          </Badge>
                        )}
                        {notification.type === "approval" && (
                          <Badge className="bg-primary-fixed text-primary-container border-none text-[10px] font-black uppercase tracking-wider">
                            Audited
                          </Badge>
                        )}
                        {currentUser?.role === "Admin" &&
                          storeNameOf(notification) && (
                            <Badge className="bg-surface-container text-on-surface-variant border-none text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                              <Store className="w-3 h-3" />
                              {storeNameOf(notification)}
                            </Badge>
                          )}
                      </div>
                      <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1.5 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {getRelativeTime(notification.timestamp)}
                      </span>
                    </div>
                    <p className={`text-sm font-medium leading-relaxed ${!notification.read ? "text-on-surface-variant" : "text-on-surface-variant/70"}`}>
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-outline-variant/40">
                      {notification.type === "approval" && notification.actionId && (currentUser?.role === "Admin" || (pendingApprovals.some(pa => pa.id === notification.actionId && pa.actionType !== "add_cashier" && pa.actionType !== "delete_store" && currentUser?.id === allStores.find(s => s.id === pa.storeId)?.managerId))) ? (
                        <div className="flex items-center gap-2">
                          <button 
                            className="text-xs font-black text-on-secondary-container hover:opacity-80 uppercase tracking-widest flex items-center gap-1.5"
                            onClick={() => handleApprove(notification.actionId!)}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button 
                            className="text-xs font-black text-error hover:opacity-80 uppercase tracking-widest flex items-center gap-1.5"
                            onClick={() => handleRejectClick(notification.actionId!)}
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <>
                          {isResolvable(notification) && currentUser?.role === "Manager" && (
                            <button
                              className="text-xs font-black text-on-secondary-container hover:opacity-80 uppercase tracking-widest flex items-center gap-1.5"
                              onClick={() => handleResolve(notification)}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Mark Resolved
                            </button>
                          )}
                          {!notification.read && (
                            <button 
                              className="text-xs font-black text-primary-container hover:opacity-80 uppercase tracking-widest flex items-center gap-1.5"
                              onClick={() => markNotificationRead(notification.id)}
                            >
                              <Check className="w-3.5 h-3.5" />
                              Mark as Read
                            </button>
                          )}
                          <button 
                            className="text-xs font-black text-on-surface-variant hover:text-primary-container uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                            onClick={() => handleViewDetails(notification)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Details
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-20 h-20 bg-surface-container-low rounded-[2rem] flex items-center justify-center mb-6">
                <Bell className="w-10 h-10 text-on-surface-variant/50" />
              </div>
              <h3 className="font-display text-xl font-bold text-on-surface">All caught up!</h3>
              <p className="text-on-surface-variant font-medium mt-1">No notifications match your current filter.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pager — same "Showing X - Y of N" / arrow pattern as Transactions. */}
      {notificationTotal > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-on-surface-variant max-w-4xl">
          <span className="text-xs font-medium">
            Showing {Math.min(notificationTotal, (page - 1) * itemsPerPage + 1)} -{" "}
            {Math.min(notificationTotal, page * itemsPerPage)} of {notificationTotal} notifications
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold text-on-surface-variant tabular-nums min-w-[72px] text-center">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      {/* Reject Reason Dialog */}
      <AlertDialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Request</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for rejecting this approval request (optional).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectDialog({ open: false, actionId: "" })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRejectConfirm} className="bg-red-600 hover:bg-red-700">
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Stagger>
  );
}
