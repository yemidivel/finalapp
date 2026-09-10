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
  FileText,
  Bell,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  Menu,
  User as UserIcon,
  LogOut,
  Users,
  Building2,
  RefreshCcw,
  ArrowLeft,
  Star,
  CheckCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { useStore } from "../state/store";
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
import { Card, CardContent } from "./ui/card";
import { canUserAccessStore, verifyUserPassword } from "../../lib/rbac";
import { Onboarding } from "./Onboarding";

import { Skeleton } from "./ui/skeleton";

// Admin "overview" sidebar: Admin oversees the whole business.
const adminNavItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Stores", path: "/stores", icon: Building2 },
  { name: "Team", path: "/team", icon: Users },
  { name: "Insights", path: "/insights", icon: TrendingUp },
  { name: "Reports", path: "/reports", icon: FileText },
  { name: "Staff", path: "/staff", icon: Users },
  { name: "Notifications", path: "/notifications", icon: Bell },
  { name: "Settings", path: "/settings", icon: Settings },
];

// Operational sidebar: Manager / Cashier, or Admin inside a store.
const operationalNavItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Inventory", path: "/inventory", icon: Package },
  { name: "Products", path: "/products", icon: ShoppingCart },
  { name: "Transactions", path: "/transactions", icon: Receipt },
  { name: "POS", path: "/pos", icon: CreditCard },
  { name: "Insights", path: "/insights", icon: TrendingUp },
  { name: "Forecasts", path: "/forecasts", icon: LineChart },
  { name: "Reports", path: "/reports", icon: FileText },
  { name: "Staff", path: "/staff", icon: Users },
  { name: "Notifications", path: "/notifications", icon: Bell },
  { name: "Settings", path: "/settings", icon: Settings },
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
    notifications,
    resetUnreadNotifications,
    users,
    permissions,
    currentUser,
    adminUser,
    loginUser,
    logoutUser,
    switchBackToAdmin,
    currency,
    inventoryArray,
    formatCurrency,
    adminOverview,
    setAdminOverview
  } = useStore();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSelectStoreModalOpen, setIsSelectStoreModalOpen] = useState(false);
  const [isSwitchingStore, setIsSwitchingStore] = useState(false);
  const [isSwitchingLoading, setIsSwitchingLoading] = useState(false);
  const [pendingStore, setPendingStore] = useState<any>(null);
  const [switchEmail, setSwitchEmail] = useState("");
  const [switchPassword, setSwitchPassword] = useState("");
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [storeSelectStep, setStoreSelectStep] = useState<"store" | "role" | "cashier">("store");
  const [selectedSwitchStore, setSelectedSwitchStore] = useState<any>(null);

  // Global Search State
  const [globalSearch, setGlobalSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Debounce logic
  useEffect(() => {
    if (!globalSearch.trim()) {
      setDebouncedSearch("");
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    const handler = setTimeout(() => {
      setDebouncedSearch(globalSearch);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [globalSearch]);

  const searchResults = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    return inventoryArray.filter(p => 
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(debouncedSearch.toLowerCase())
    ).slice(0, 5);
  }, [debouncedSearch, inventoryArray]);

  const getStockStatus = (stock: number, reorderPoint: number = 40) => {
    if (stock < 10) return { label: "Critical", color: "text-red-600 bg-red-50 border-red-100" };
    if (stock < reorderPoint) return { label: "Low Stock", color: "text-orange-600 bg-orange-50 border-orange-100" };
    return { label: "Healthy", color: "text-green-600 bg-green-50 border-green-100" };
  };

  const activeUser = currentUser || users[0]; // Fallback to first user if none logged in
  const unreadCount = notifications.filter(n => !n.read).length;
  const isAdmin = activeUser?.role === "Admin";
  // Admin overview mode: cross-store oversight sidebar. Inside a store the
  // Admin sees the Manager's operational tabs.
  const showAdminOverview = isAdmin && adminOverview;

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
      // Admin can only switch into a store that has a Manager appointed.
      return allStores.filter(
        (s) => s.id !== "S-ALL" && s.managerId && !s.isAdminStore,
      );
    }
    return userStores;
  }, [allStores, isAdmin, userStores]);

  // RBAC: Filter nav items based on role + Admin overview vs store context
  const navSource = showAdminOverview ? adminNavItems : operationalNavItems;
  const filteredNavItems = useMemo(() => {
    return navSource.filter(item => {
      const permission = permissions[item.name];
      return permission
        ? (permission[activeUser?.role || "Cashier"]?.view ?? true)
        : true;
    });
  }, [navSource, activeUser?.role, permissions]);

  // RBAC: Enforce access control
  useEffect(() => {
    const currentPath = location.pathname;
    const currentItem = allNavItems.find(item => item.path === currentPath || (item.path !== "/" && currentPath.startsWith(item.path)));
    
    if (currentItem) {
      const permission = permissions[currentItem.name];
      if (permission && !(permission[activeUser?.role || "Cashier"]?.view ?? true)) {
        toast.error("Access denied for your role");
        navigate("/");
      }
    }
  }, [location.pathname, activeUser?.role, permissions, navigate]);

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
    toast.promise(new Promise(resolve => setTimeout(resolve, 1000)), {
      loading: "Logging out...",
      success: () => {
        logoutUser();
        window.location.href = "https://sellsync.store/login";
        return "Logged out successfully";
      },
      error: "Logout failed"
    });
  };

  // Onboarding: until a store exists (fresh install or last store deleted),
  // show the setup screen instead of the app shell.
  if (!currentStore) {
    return <Onboarding />;
  }

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed lg:translate-x-0 lg:static inset-y-0 left-0 z-50 w-64 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border-r transition-transform duration-300 ease-in-out flex flex-col`}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center px-6 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2.5 group">
            <img src="/icon.png" alt="SellSync" className="w-10 h-10 rounded-lg object-cover shadow-lg shadow-indigo-100 group-hover:scale-105 transition-transform duration-300" />
            <span className="text-xl font-bold tracking-tight text-[#3B82F6]">SellSync</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : theme === 'dark' 
                      ? "text-gray-400 hover:bg-gray-800 hover:text-white"
                      : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Premium Upgrade Box at bottom — Admin only */}
        {currentUser?.role === "Admin" && (
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
          <div 
            onClick={() => setIsPremiumModalOpen(true)}
            className="p-4 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-xl shadow-indigo-100 cursor-pointer group hover:scale-[1.02] transition-all duration-300 overflow-hidden relative"
          >
            <div className="flex items-center gap-2 mb-1.5 relative z-10">
              <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
              <span className="text-[10px] font-black uppercase tracking-widest">Premium</span>
            </div>
            <p className="text-[10px] text-indigo-100 font-bold leading-tight mb-3 relative z-10">
              Unlock advanced AI insights & unlimited stores
            </p>
            <Button className="w-full h-7 bg-white text-indigo-700 hover:bg-indigo-50 text-[9px] font-black uppercase rounded-lg border-none relative z-10">
              Upgrade Now
            </Button>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl" />
          </div>
        </div>
        )}
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
        {/* Header */}
        <header className={`h-16 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border-b flex items-center px-4 lg:px-6 gap-4`}>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Search — hidden for admin */}
          {!isAdmin && (
          <div className="flex-1 max-w-md mx-auto relative">
            <div className="relative">
              {isSearching ? (
                <RefreshCcw className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600 animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              )}
              <Input
                type="search"
                placeholder="Search inventory, SKUs, categories..."
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowSearchResults(false);
                }}
                className={`pl-9 border-none h-10 rounded-xl transition-all ${theme === 'dark' ? 'bg-gray-800 text-white focus:bg-gray-700' : 'bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-100'}`}
              />
            </div>

            {/* Global Search Results Dropdown */}
            {showSearchResults && globalSearch.trim() && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowSearchResults(false)} 
                />
                <Card className={`absolute top-full left-0 right-0 mt-2 z-20 border-none shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                  <CardContent className="p-2">
                    {searchResults.length > 0 ? (
                      <div className="space-y-1">
                        {searchResults.map((p) => {
                          const status = getStockStatus(p.stock, p.reorderPoint);
                          return (
                            <button
                              key={p.id}
                              className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-left ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                              onClick={() => {
                                navigate("/inventory", { state: { search: p.name, highlightId: p.id } });
                                setShowSearchResults(false);
                                setGlobalSearch("");
                              }}
                            >
                              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100/50">
                                <span className="text-indigo-600 font-black text-lg">{p.name[0]}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-bold text-sm truncate text-gray-900 dark:text-white">{p.name}</p>
                                  <span className="text-xs font-black text-indigo-600 shrink-0">{formatCurrency(p.price)}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">SKU: {p.sku}</span>
                                  <span className="text-[10px] text-gray-300">•</span>
                                  <span className="text-[10px] font-bold text-gray-400">{p.category}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge className={`text-[9px] px-1.5 h-4 font-black uppercase tracking-tighter border-none ${status.color}`}>
                                    {status.label}
                                  </Badge>
                                  <span className="text-[10px] font-bold text-gray-500">{p.stock} units left</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        <div className="pt-1 mt-1 border-t border-gray-100 dark:border-gray-700">
                          <Button 
                            variant="ghost" 
                            className="w-full justify-center text-xs font-black uppercase tracking-widest text-indigo-600 h-10 hover:bg-indigo-50"
                            onClick={() => {
                              navigate("/inventory", { state: { search: globalSearch } });
                              setShowSearchResults(false);
                              setGlobalSearch("");
                            }}
                          >
                            View all results for "{globalSearch}"
                          </Button>
                        </div>
                      </div>
                    ) : !isSearching && (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Search className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-sm font-bold text-gray-900">No products found</p>
                        <p className="text-xs text-gray-500 mt-1">Try a different search term or SKU</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
          )}

          {/* Right side */}
          <div className={`flex items-center gap-3 ${isAdmin ? 'ml-auto pr-5' : ''}`}>
            {/* Notification Bell */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative hover:bg-indigo-50 hover:text-indigo-600 rounded-xl"
              onClick={() => {
                resetUnreadNotifications();
                navigate("/notifications");
              }}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-500 text-white border-2 border-white text-[10px] font-bold">
                  {unreadCount}
                </Badge>
              )}
            </Button>

            {/* User Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={`flex items-center gap-3 px-3 h-10 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
                  <Avatar className="w-8 h-8 border-2 border-indigo-50">
                    {activeUser.profilePicture ? (
                      <img src={activeUser.profilePicture} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-black text-[10px]">
                        {activeUser.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start text-left mr-1">
                    <p className="text-xs font-black leading-none">{activeUser.name}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">{showAdminOverview ? "All Stores" : currentStore.name}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-none">
                <DropdownMenuLabel className="px-3 py-3 border-b border-gray-50 mb-1">
                  <p className="text-sm font-black">{activeUser.name}</p>
                  <p className="text-[10px] text-gray-500 font-medium truncate">{activeUser.email}</p>
                  <Badge variant="outline" className="mt-2 text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border-indigo-100 px-2 py-0.5">
                    {activeUser.role}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuItem 
                  className="rounded-xl px-3 py-2.5 cursor-pointer font-bold text-xs"
                  onClick={() => navigate("/settings")}
                >
                  <Settings className="w-4 h-4 mr-3 text-gray-400" />
                  Settings
                </DropdownMenuItem>
                {isAdmin && !showAdminOverview && (
                  <DropdownMenuItem 
                    className="rounded-xl px-3 py-2.5 cursor-pointer font-bold text-xs"
                    onClick={() => {
                      setAdminOverview(true);
                      navigate("/");
                    }}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-3 text-indigo-600" />
                    Back to Store Overview
                  </DropdownMenuItem>
                )}
                {adminUser && activeUser?.role !== "Admin" && (
                  <DropdownMenuItem 
                    className="rounded-xl px-3 py-2.5 cursor-pointer font-bold text-xs"
                    onClick={() => {
                      switchBackToAdmin();
                      navigate("/");
                    }}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-3 text-indigo-600" />
                    Switch Back to Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  className="rounded-xl px-3 py-2.5 cursor-pointer font-bold text-xs"
                  onClick={() => setIsSelectStoreModalOpen(true)}
                >
                  <Building2 className="w-4 h-4 mr-3 text-indigo-600" />
                  Change Store
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-gray-50" />
                <DropdownMenuItem 
                  className="rounded-xl px-3 py-2.5 cursor-pointer font-bold text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
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
              <Outlet />
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
        </nav>
      </div>

      {/* Premium Upgrade Modal */}
      <Dialog open={isPremiumModalOpen} onOpenChange={setIsPremiumModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white">
          <div className="bg-indigo-600 p-10 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
              </div>
              <h2 className="text-3xl font-black tracking-tight mb-2">Upgrade to Premium</h2>
              <p className="text-indigo-100 font-medium">Take your retail business to the next level with advanced intelligence.</p>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          </div>
          
          <div className="p-10 space-y-6">
            <div className="space-y-4">
              {[
                "Unlimited stores and unlimited products",
                "Advanced AI predictive sales forecasting",
                "Multi-user RBAC with custom permissions",
                "Priority 24/7 expert support",
                "Bulk data exports and custom API access",
                "White-label receipt branding"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-50 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                  </div>
                  <span className="text-sm font-bold text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
            
            <Button
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 mt-4"
              onClick={() => window.open("https://payment.sellsync.store/", "_blank", "noopener,noreferrer")}
            >
              Continue to Upgrade →
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                {adminUser && !isAdmin && (
                  <Button 
                    className="w-full h-12 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100"
                    onClick={() => { switchBackToAdmin(); setIsSelectStoreModalOpen(false); navigate("/"); }}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Switch Back to Admin
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
                <button
                  type="button"
                  onClick={() => {
                    if (isAdmin) {
                      const targetStore = selectedSwitchStore;
                      const manager = users.find((u) => u.id === targetStore.managerId);
                      if (!manager) {
                        toast.error("Manager not found for this store");
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

