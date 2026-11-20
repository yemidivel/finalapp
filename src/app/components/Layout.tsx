import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Toaster } from "./ui/sonner";
import { ErrorBoundary } from "./ErrorBoundary";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  CreditCard,
  TrendingUp,
  LineChart,
  Bell,
  ChevronRight,
  Menu,
  LogOut,
  Users,
  Building2,
  RefreshCcw,
  ArrowLeft,
  Store as StoreIcon,
  SlidersHorizontal,
} from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState, useMemo, useEffect, useRef } from "react";
import { Badge } from "./ui/badge";
import { useStore, ROLE_RANK, OWNABLE_ROLES } from "../state/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { toast } from "sonner";
import {
  canAccessModuleByRole,
  canUserAccessStore,
  verifyUserPassword,
} from "../../lib/rbac";
import { LANDING_URL } from "../../lib/db";
import { Onboarding } from "./Onboarding";
import { Login } from "./Login";

import { Skeleton } from "./ui/skeleton";
import { motion } from "framer-motion";

// Admin "overview" sidebar: Admin oversees the whole business.
const adminNavItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Transactions", path: "/transactions", icon: Receipt },
  { name: "Insights", path: "/insights", icon: TrendingUp },
  { name: "Team", path: "/team", icon: Users },
  { name: "Notifications", path: "/notifications", icon: Bell },
  { name: "Settings", path: "/settings", icon: SlidersHorizontal },
];

// Operational sidebar: Manager / Cashier, or Admin inside a store.
//
// Both roles used to get this list verbatim, which handed a Cashier four links
// it cannot use: Staff and Team read endpoints that are MANAGER-only (403),
// Reports reads the store-wide transaction summary (403), and Stores lists all
// stores (403). The pages loaded empty and their buttons failed on click, so the
// role could see exactly what it was not allowed to do. Each item is filtered
// against `navModulesForRole` at render time instead.
const operationalNavItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "POS", path: "/pos", icon: CreditCard },
  { name: "Inventory", path: "/inventory", icon: Package },
  { name: "Products", path: "/products", icon: ShoppingCart },
  { name: "Transactions", path: "/transactions", icon: Receipt },
  { name: "Insights", path: "/insights", icon: TrendingUp },
  { name: "Forecasts", path: "/forecasts", icon: LineChart },
  { name: "Notifications", path: "/notifications", icon: Bell },
  { name: "Settings", path: "/settings", icon: SlidersHorizontal },
];

const allNavItems = [...adminNavItems, ...operationalNavItems];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    currentStore, 
    allStores, 
    switchStore, 
    theme, 
    users,
    permissions,
    currentUser,
    sessionOwner,
    loginUser,
    logoutUser,
    switchBackToOwner,
    currency,
    formatCurrency,
    adminOverview,
    setAdminOverview,
    status,
    notificationCounts,
  } = useStore();

  // The feed is paged, so the badge must use the backend's scope-wide unread
  // count rather than counting the handful of rows currently loaded.
  const unreadNotifications = notificationCounts?.unread ?? 0;

  // Every route change starts at the top of the scroll container. Without this
  // a navigation inherited the previous page's scroll offset, so opening a new
  // section dropped the user halfway down it.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSelectStoreModalOpen, setIsSelectStoreModalOpen] = useState(false);
  const [isSwitchingStore, setIsSwitchingStore] = useState(false);
  const [isSwitchingLoading, setIsSwitchingLoading] = useState(false);
  const [pendingStore, setPendingStore] = useState<any>(null);
  const [switchEmail, setSwitchEmail] = useState("");
  const [switchPassword, setSwitchPassword] = useState("");

  const [storeSelectStep, setStoreSelectStep] = useState<"store" | "role" | "cashier">("store");
  const [selectedSwitchStore, setSelectedSwitchStore] = useState<any>(null);

  // Global Search State
  const activeUser = currentUser || users[0]; // Fallback to first user if none logged in
  const isAdmin = activeUser?.role === "Admin";
  // Admin overview mode: cross-store oversight sidebar. Inside a store the
  // Admin sees the Manager's operational tabs.
  const showAdminOverview = isAdmin && adminOverview;

  // Downward-only impersonation matrix. The session owner (the account that
  // holds the token) may only act as strictly-lower roles:
  //   Admin   -> Manager, Cashier
  //   Manager -> Cashier
  //   Cashier -> (none)
  // Anyone who is not the owner is currently an impersonated persona, so the
  // owner's role decides what they can switch to.
  const sessionOwnerRole = sessionOwner?.role || activeUser?.role || "Cashier";
  const ownableRoles = OWNABLE_ROLES[sessionOwnerRole] || [];
  const isImpersonating = Boolean(
    sessionOwner && activeUser && activeUser.id !== sessionOwner.id,
  );

  // RBAC: Filter stores available to the user
  const userStores = useMemo(() => {
    if (!activeUser) return [];
    if (isAdmin) {
      return allStores.filter((s) => s.id !== "S-ALL");
    }
    return allStores.filter(
      (s) =>
        s.id !== "S-ALL" &&
        (activeUser.assignedStoreIds || []).includes(s.id),
    );
  }, [allStores, activeUser, isAdmin]);

  const switchableStores = useMemo(() => {
    if (isAdmin) {
      // Admin can enter any of their stores (manager-run or not).
      return allStores.filter((s) => s.id !== "S-ALL" && !s.isAdminStore);
    }
    return userStores;
  }, [allStores, isAdmin, userStores]);

  // RBAC: Filter nav items based on role + Admin overview vs store context
  const navSource = showAdminOverview ? adminNavItems : operationalNavItems;
  const filteredNavItems = useMemo(() => {
    // Page reachability comes from `navModulesForRole`, which mirrors the
    // backend's per-route `authorize(...)` lists — not from `permissions`.
    // `permissions` is a user-editable localStorage matrix, so letting it decide
    // reachability meant the app could advertise a page the API refuses (a
    // Cashier opening "Staff" against MANAGER-only endpoints) and could also
    // hide one the API allows (a Manager locked out of "POS"). The matrix still
    // governs in-page controls via canEdit/canView.
    return navSource.filter(item =>
      canAccessModuleByRole(activeUser?.role, item.name),
    );
  }, [navSource, activeUser?.role]);

  // RBAC: Enforce access control
  useEffect(() => {
    const currentPath = location.pathname;
    const currentItem = allNavItems.find(item => item.path === currentPath || (item.path !== "/" && currentPath.startsWith(item.path)));
    
    if (currentItem && !canAccessModuleByRole(activeUser?.role, currentItem.name)) {
      navigate("/", { replace: true });
    }
  }, [location.pathname, activeUser?.role, navigate]);

  // Dark Mode Support
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleStoreSwitch = async () => {
    const targetStoreId = pendingStore?.id;
    if (!targetStoreId) {
      toast.error("Please select a store first.");
      return;
    }

    const userForStore = users.find(
      (u) =>
        u.email.toLowerCase() === switchEmail.toLowerCase() &&
        u.status === "Active" &&
        canUserAccessStore(u, targetStoreId),
    );

    // Downward-only: never allow acting as the session owner or a peer/higher
    // role (e.g. a Cashier logging in as a Manager, or a Manager as an Admin).
    if (userForStore && ROLE_RANK[userForStore.role] >= ROLE_RANK[sessionOwnerRole]) {
      toast.error("You cannot log in as a user with the same or higher privileges.");
      return;
    }

    if (
      userForStore &&
      verifyUserPassword(userForStore, switchPassword)
    ) {
      setIsSwitchingLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));

      switchStore(targetStoreId);
      loginUser(userForStore);

      setIsSwitchingLoading(false);
      setIsSwitchingStore(false);
      setSwitchEmail("");
      setSwitchPassword("");
      toast.success(
        `Successfully switched to ${pendingStore?.name} as ${userForStore.role}`,
      );
      navigate("/");
    } else {
      toast.error(
        "Invalid email or password for this store. Use the credentials created for this store's assigned user.",
      );
    }
  };

  const handleLogout = () => {
    // While impersonating a Manager/Cashier, "logout" must not end the
    // Admin/Manager session. Drop the persona and restore the account that
    // owns the token (Admin overview, or a Manager's own store).
    if (isImpersonating) {
      toast.promise(switchBackToOwner().then(() => navigate("/")), {
        loading: `Switching back to ${sessionOwner?.role ?? "your account"}...`,
        success: `Switched back to ${sessionOwner?.role ?? "your account"}`,
        error: "Could not switch back to your account",
      });
      return;
    }
    toast.promise(new Promise(resolve => setTimeout(resolve, 1000)), {
      loading: "Logging out...",
      success: () => {
        logoutUser();
        window.location.href = `${LANDING_URL}/login`;
        return "Logged out successfully";
      },
      error: "Logout failed"
    });
  };

  // Session gate: wait for boot, then ask for a real backend sign-in before
  // the shell (Offline/local mode is no longer a thing — accounts must be
  // persisted so Managers/Cashiers can log in on the landing page).
  if (status === "loading") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  if (status === "auth") {
    return <Login />;
  }

  // Onboarding: until a store exists (fresh install or last store deleted),
  // show the setup screen instead of the app shell.
  if (!currentStore) {
    return <Onboarding />;
  }

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-gray-950 text-gray-100' : 'bg-surface text-on-surface'}`}>
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed lg:translate-x-0 lg:static inset-y-0 left-0 z-50 w-[260px] ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-surface-container-lowest border-outline-variant/40'} border-r transition-transform duration-300 ease-in-out flex flex-col`}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center px-6 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2.5 group">
            <img src="/icon.png" alt="SellSync" className="w-10 h-10 rounded-lg object-cover shadow-lg shadow-indigo-100 group-hover:scale-105 transition-transform duration-300" />
            <span className="text-xl font-bold tracking-tight text-[#3B82F6]">SellSync</span>
          </div>
        </div>

        {/* Store Context Card — only in a store-scoped view (Manager/Cashier,
            or Admin inside a store). Hidden in the Admin cross-store overview,
            where the Admin is not scoped to a single store. */}
        {!showAdminOverview && (
          <div className="px-3 pt-4">
            <div
              className={`w-full flex items-center gap-3 p-3 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-800/60 border-gray-800'
                  : 'bg-surface-container-lowest border-outline-variant/40 shadow-[0_1px_3px_rgba(15,23,42,0.05)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-indigo-900/50' : 'bg-surface-container'}`}>
                  <StoreIcon className={`w-5 h-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-primary'}`} />
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-bold truncate leading-none ${theme === 'dark' ? 'text-white' : 'text-on-surface'}`}>
                      {currentStore.name}
                    </span>
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-fixed-dim opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-on-secondary-container" />
                    </span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-medium truncate mt-1">
                    {currentStore.address ||
                      `${currentStore.city} ${currentStore.state}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] font-semibold transition-all ${
                  isActive
                    ? "bg-primary-container text-white font-bold shadow-[0_6px_16px_-6px_rgba(79,70,229,0.7)]"
                    : theme === 'dark'
                      ? "text-gray-400 hover:bg-gray-800 hover:text-white"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 truncate">{item.name}</span>
                {item.name === "Notifications" && unreadNotifications > 0 && (
                  <span
                    className={`shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold flex items-center justify-center ${
                      isActive
                        ? "bg-white text-primary-container"
                        : "bg-primary-container text-white"
                    }`}
                  >
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Account + Logout */}
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3 px-2">
            <Avatar className="w-9 h-9 border-2 border-indigo-50 shrink-0">
              {activeUser.profilePicture ? (
                <img src={activeUser.profilePicture} alt="Avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                <AvatarFallback className="bg-indigo-100 text-indigo-700 font-black text-[10px]">
                  {activeUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-on-surface'}`}>{activeUser.name}</p>
              <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest truncate">
                {activeUser.role}
                {!showAdminOverview ? ` · ${currentStore.name}` : " · All Stores"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label={isImpersonating ? `Switch back to ${sessionOwner?.role ?? "your account"}` : "Logout"}
              className={`group/logout shrink-0 flex items-center gap-1.5 h-8 px-2 rounded-lg text-red-600 transition-colors ${theme === 'dark' ? 'hover:bg-red-950/30' : 'hover:bg-red-50'}`}
            >
              <LogOut className="w-4 h-4" />
              <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 group-hover/logout:max-w-[3.5rem] group-hover/logout:opacity-100 transition-all duration-200">
                {isImpersonating ? "Back" : "Logout"}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Main View Area */}
        <main
          ref={mainRef}
          style={{ overscrollBehaviorY: "none" }}
          className="flex-1 overflow-y-auto pb-20 lg:pb-0"
        >
          <ErrorBoundary>
            {isSwitchingLoading ? (
              <div className="p-8 space-y-8">
                <div className="space-y-4">
                  <Skeleton className="h-10 w-1/4 rounded-xl" />
                  <Skeleton className="h-4 w-1/3 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Skeleton className="h-32 rounded-3xl" />
                  <Skeleton className="h-32 rounded-3xl" />
                  <Skeleton className="h-32 rounded-3xl" />
                  <Skeleton className="h-32 rounded-3xl" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Skeleton className="lg:col-span-2 h-[400px] rounded-[2rem]" />
                  <Skeleton className="h-[400px] rounded-[2rem]" />
                </div>
              </div>
            ) : (
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            )}
          </ErrorBoundary>
          <Toaster />
        </main>

        {/* Mobile Bottom Navigation Tab Bar */}
        <nav className={`lg:hidden fixed bottom-0 left-0 right-0 h-16 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border-t flex items-center justify-around px-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]`}>
          {filteredNavItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? "text-indigo-600" : "text-gray-400"}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${isActive ? "bg-indigo-50" : "transparent"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-tighter">{item.name}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all text-gray-400"
          >
            <div className="p-1.5 rounded-lg">
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter">Menu</span>
          </button>
        </nav>
      </div>



      {/* Store Selection Modal */}
      <Dialog open={isSelectStoreModalOpen} onOpenChange={(open) => { setIsSelectStoreModalOpen(open); if (!open) { setStoreSelectStep("store"); setSelectedSwitchStore(null); } }}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] !grid !grid-rows-[auto_1fr] rounded-[2rem] p-0 border-none shadow-2xl bg-white">
          {storeSelectStep === "store" && (
            <>
              <div className="p-8 border-b border-gray-50 bg-gray-50/50">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-100">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight">Change Store Context</DialogTitle>
                <DialogDescription className="text-sm font-medium text-gray-500 mt-1">Select the business location you want to manage.</DialogDescription>
              </div>
              
              <div className="p-6 overflow-y-auto min-h-0">
                <div className="grid gap-3">
                  {switchableStores.map((store) => {
                    const isCurrent = !showAdminOverview && store.id === currentStore.id;
                    const storeStaffCount = users.filter(
                      (u) => u.role !== "Admin" && u.status === "Active" && (u.assignedStoreIds || []).includes(store.id),
                    ).length;
                    return (
                      <button
                        key={store.id}
                        disabled={isCurrent}
                        onClick={() => {
                          setSelectedSwitchStore(store);
                          // A Cashier owns no lower roles, so there is nothing
                          // to impersonate — just switch the store context.
                          if (ownableRoles.length === 0) {
                            setIsSelectStoreModalOpen(false);
                            setSelectedSwitchStore(null);
                            switchStore(store.id);
                            navigate("/");
                            return;
                          }
                          setStoreSelectStep("role");
                        }}
                        className={`rounded-2xl border transition-all p-4 flex items-center justify-between text-left ${
                          isCurrent
                            ? "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
                            : "bg-white border-gray-100 hover:border-indigo-600 hover:shadow-md hover:shadow-indigo-100/50 group"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-colors ${
                            isCurrent ? "bg-gray-200 text-gray-400" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                          }`}>
                            {store.name[0]}
                          </div>
                          <div>
                            <p className="font-black text-sm text-gray-900">{store.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              {store.id === "S-ALL" ? "All Stores" : `${store.city}, ${store.state}`}
                              {!isAdmin && !isCurrent && storeStaffCount > 0 && ` · ${storeStaffCount} staff`}
                            </p>
                          </div>
                        </div>
                        {isCurrent ? (
                          <Badge className="bg-green-50 text-green-700 border-green-100 font-black text-[9px] uppercase tracking-tighter">Active</Badge>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 bg-gray-50/50 border-t border-gray-50 space-y-2">
                {isImpersonating && (
                  <Button 
                    className="w-full h-12 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100"
                    onClick={() => { switchBackToOwner(); setIsSelectStoreModalOpen(false); navigate("/"); }}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Switch Back to {sessionOwner?.role}
                  </Button>
                )}
                {isAdmin && !showAdminOverview && (
                  <Button 
                    className="w-full h-12 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100"
                    onClick={() => { setAdminOverview(true); setIsSelectStoreModalOpen(false); navigate("/"); }}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Back to Store Overview
                  </Button>
                )}
                <Button variant="ghost" className="w-full h-10 rounded-xl font-bold text-gray-500 text-xs" onClick={() => setIsSelectStoreModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {storeSelectStep === "role" && selectedSwitchStore && (
            <>
              <div className="p-8 border-b border-gray-50 bg-gray-50/50">
                <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setStoreSelectStep("store"); setSelectedSwitchStore(null); }}
                    className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  {selectedSwitchStore.name}
                </DialogTitle>
                <DialogDescription className="text-sm font-medium text-gray-500 mt-1 ml-11">Choose how you want to access this store.</DialogDescription>
              </div>
              
              <div className="p-6 space-y-3">
                {ownableRoles.includes("Manager") && (
                <button
                  type="button"
                  onClick={() => {
                    if (isAdmin) {
                      const targetStore = selectedSwitchStore;
                      const manager = users.find((u) => u.id === targetStore.managerId);
                      if (!manager) {
                        // No Manager assigned yet — open the friendly assign
                        // flow on the Stores page instead of dead-ending.
                        setIsSelectStoreModalOpen(false);
                        setStoreSelectStep("store");
                        setSelectedSwitchStore(null);
                        navigate("/stores");
                        return;
                      }
                      setPendingStore(targetStore);
                      setIsSelectStoreModalOpen(false);
                      setStoreSelectStep("store");
                      setSelectedSwitchStore(null);
                      setIsSwitchingLoading(true);
                      setTimeout(() => {
                        switchStore(targetStore.id);
                        loginUser(manager);
                        setAdminOverview(false);
                        setIsSwitchingLoading(false);
                        toast.success(`Logged in as ${manager.name} (Manager)`);
                        navigate("/");
                      }, 600);
                    } else {
                      const manager = users.find((u) => u.role === "Manager" && (u.assignedStoreIds || []).includes(selectedSwitchStore.id));
                      setPendingStore(selectedSwitchStore);
                      setSwitchPassword("");
                      setSwitchEmail(manager ? manager.email : activeUser.email);
                      setIsSelectStoreModalOpen(false);
                      setStoreSelectStep("store");
                      setSelectedSwitchStore(null);
                      setIsSwitchingStore(true);
                    }
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-blue-100 bg-blue-50/50 hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-gray-900">Login as Manager</p>
                    <p className="text-[11px] font-bold text-gray-500 truncate">
                      {(() => {
                        const mgr = users.find((u) => u.role === "Manager" && (u.assignedStoreIds || []).includes(selectedSwitchStore.id));
                        return mgr ? `${mgr.name} · ${mgr.email}` : "No manager assigned";
                      })()}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0" />
                </button>
                )}

                {ownableRoles.includes("Cashier") && (
                <button
                  type="button"
                  onClick={() => setStoreSelectStep("cashier")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-gray-900">Login as Cashier</p>
                    <p className="text-[11px] font-bold text-gray-500">
                      {(() => {
                        const count = users.filter((u) => u.role === "Cashier" && u.status === "Active" && (u.assignedStoreIds || []).includes(selectedSwitchStore.id)).length;
                        return count > 0 ? `${count} cashier${count !== 1 ? "s" : ""} available` : "No cashier assigned yet";
                      })()}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
                </button>
                )}
              </div>
            </>
          )}

          {storeSelectStep === "cashier" && selectedSwitchStore && (
            <>
              <div className="p-8 border-b border-gray-50 bg-gray-50/50">
                <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStoreSelectStep("role")}
                    className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  Select Cashier
                </DialogTitle>
                <DialogDescription className="text-sm font-medium text-gray-500 mt-1 ml-11">
                  Choose a cashier to log in as for {selectedSwitchStore.name}.
                </DialogDescription>
              </div>
              
              <div className="p-6 overflow-y-auto min-h-0 max-h-[400px] space-y-1.5">
                {(() => {
                  const cashiers = users.filter(
                    (u) => u.role === "Cashier" && u.status === "Active" && (u.assignedStoreIds || []).includes(selectedSwitchStore.id),
                  );
                  return cashiers.length > 0 ? cashiers.map((cashier) => (
                    <button
                      key={cashier.id}
                      type="button"
                      onClick={() => {
                        if (isAdmin) {
                          const targetStore = selectedSwitchStore;
                          const targetCashier = cashier;
                          const storeId = targetCashier.assignedStoreIds?.[0];
                          if (!storeId) {
                            toast.error("This Cashier is not assigned to a store");
                            return;
                          }
                          setPendingStore(targetStore);
                          setIsSelectStoreModalOpen(false);
                          setStoreSelectStep("store");
                          setSelectedSwitchStore(null);
                          setIsSwitchingLoading(true);
                          setTimeout(() => {
                            switchStore(storeId);
                            loginUser(targetCashier);
                            setAdminOverview(false);
                            setIsSwitchingLoading(false);
                            toast.success(`Logged in as ${targetCashier.name} (Cashier)`);
                            navigate("/");
                          }, 600);
                        } else {
                          setPendingStore(selectedSwitchStore);
                          setSwitchPassword("");
                          setSwitchEmail(cashier.email);
                          setIsSelectStoreModalOpen(false);
                          setIsSwitchingStore(true);
                          setStoreSelectStep("store");
                          setSelectedSwitchStore(null);
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-black text-xs text-gray-500 shrink-0">
                        {cashier.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-700 truncate">{cashier.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 truncate">{cashier.email}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
                    </button>
                  )) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500 font-bold">No cashiers assigned to this store yet.</p>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Store Switching Credentials (Step 2) */}
      <Dialog open={isSwitchingStore} onOpenChange={setIsSwitchingStore}>
        <DialogContent className="sm:max-w-[450px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-white">
          <div className="p-8 border-b border-gray-50 bg-gray-50/50">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-100">
              <RefreshCcw className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Switch to {pendingStore?.name || "Store"}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-gray-500 mt-1">
              Enter the email and password created for this store's assigned user.
            </DialogDescription>
          </div>

          <div className="p-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="gaius@sellsync.com"
                className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
                value={switchEmail}
                onChange={(e) => setSwitchEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pass" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</Label>
              <Input
                id="pass"
                type="password"
                placeholder="••••••••"
                className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
                value={switchPassword}
                onChange={(e) => setSwitchPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStoreSwitch()}
              />
              <p className="text-[9px] text-gray-400 font-bold ml-1 uppercase tracking-tighter">* Use your assigned password for this store</p>
            </div>
          </div>

          <div className="p-8 bg-gray-50 flex flex-row gap-4">
            <Button 
              className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]"
              onClick={handleStoreSwitch}
              disabled={isSwitchingLoading}
            >
              {isSwitchingLoading ? (
                <RefreshCcw className="w-6 h-6 animate-spin" />
              ) : (
                "Confirm Switch"
              )}
            </Button>
            <Button 
              variant="outline"
              className="flex-1 h-14 rounded-2xl font-black text-lg border-gray-200 text-gray-500 hover:bg-white hover:text-gray-700 transition-all active:scale-[0.98]"
              onClick={() => {
                setIsSwitchingStore(false);
                setIsSelectStoreModalOpen(true); // Go back to step 1
              }}
            >
              Back
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

