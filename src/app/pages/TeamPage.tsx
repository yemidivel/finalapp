import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Users,
  BadgeCheck,
  UserPlus,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Search,
  Clock,
  MinusCircle,
  Pencil,
  LogIn,
  Store as StoreIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Stagger } from "../../animations/Stagger";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { useStore } from "../state/store";
import type { Role, Store, User } from "../state/store";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  storeId: "",
};

const emptyStoreForm = {
  name: "",
  code: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  email: "",
};

export function TeamPage() {
  const navigate = useNavigate();
  const {
    users,
    allStores,
    pendingApprovals,
    addUser,
    updateUser,
    deleteUser,
    approveApprovalRequest,
    rejectApprovalRequest,
    addStore,
    theme,
    currentUser,
    loginUser,
    switchStore,
    setAdminOverview,
  } = useStore();

  const [addRole, setAddRole] = useState<Role>("Manager");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Edit-user + Add-store state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeForm, setStoreForm] = useState(emptyStoreForm);

  // Delete flow state
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2 | 3>(0); // 0=closed, 1=confirm, 2=type, 3=countdown
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteTypeInput, setDeleteTypeInput] = useState("");
  const [countdown, setCountdown] = useState(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const managers = useMemo(
    () => users.filter((u) => u.role === "Manager"),
    [users],
  );
  const cashiers = useMemo(
    () => users.filter((u) => u.role === "Cashier"),
    [users],
  );
  const pendingCashiers = useMemo(
    () => users.filter((u) => u.role === "Cashier" && u.status === "Pending"),
    [users],
  );

  const managerCount = managers.length;
  const cashierCount = cashiers.length;
  const pendingCount = pendingApprovals.filter(
    (a) => a.status === "pending",
  ).length + pendingCashiers.length;

  // Stores the Admin oversees — one Manager per store, any number of Cashiers.
  const adminStores = useMemo(
    () => allStores.filter((s) => !s.isAdminStore),
    [allStores],
  );
  const storeCount = adminStores.length;

  // Only stores without a Manager can take a new Manager (one per store).
  const availableManagerStores = useMemo(
    () => allStores.filter((s) => !s.managerId && !s.isAdminStore),
    [allStores],
  );

  // Cashiers can be added to any store, with or without a Manager.
  const storesWithManager = useMemo(
    () => allStores.filter((s) => !s.isAdminStore),
    [allStores],
  );

  // Store options for the add/edit dialog. While editing, the user's own store
  // is kept in the list even if it already has a Manager (that Manager is them).
  const storeOptions = useMemo(() => {
    if (editingUser) {
      const sid = editingUser.assignedStoreIds?.[0];
      return allStores.filter(
        (s) =>
          !s.isAdminStore &&
          (editingUser.role !== "Manager" || !s.managerId || s.id === sid),
      );
    }
    return addRole === "Manager"
      ? availableManagerStores
      : storesWithManager;
  }, [allStores, editingUser, addRole, availableManagerStores, storesWithManager]);

  const getStoreName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    const storeId = user?.assignedStoreIds?.[0];
    const store = allStores.find((s) => s.id === storeId);
    return store ? store.name : "—";
  };

  const getSupervisor = (u: User) => {
    if (u.role === "Manager") return { name: "Store Owner", role: "Admin" };
    const storeId = u.assignedStoreIds?.[0];
    const store = allStores.find((s) => s.id === storeId);
    const mgr = store?.managerId
      ? users.find((x) => x.id === store.managerId)
      : null;
    return mgr ? { name: mgr.name, role: "Manager" } : { name: "Unassigned", role: "—" };
  };

  const openAdd = (role: Role) => {
    setEditingUser(null);
    setAddRole(role);
    setForm({ ...emptyForm, storeId: "" });
    setAddOpen(true);
  };

  const openAddAtStore = (role: Role, storeId: string) => {
    openAdd(role);
    setForm({ ...emptyForm, storeId });
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setAddRole(user.role);
    setForm({
      name: user.name,
      email: user.email,
      password: user.password || "",
      phone: user.phone || "",
      storeId: user.assignedStoreIds?.[0] || "",
    });
    setAddOpen(true);
  };

  const handleCreate = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!editingUser && !form.password.trim()) {
      toast.error("A password is required so the user can log in");
      return;
    }
    if (!form.storeId) {
      toast.error("Please select a store");
      return;
    }
    const store = allStores.find((s) => s.id === form.storeId);
    if (!store) return;

    if (editingUser) {
      updateUser({
        ...editingUser,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password || editingUser.password,
        phone: form.phone.trim(),
        role: addRole,
        assignedStoreIds: [form.storeId],
      });
      setAddOpen(false);
      setForm(emptyForm);
      setEditingUser(null);
      toast.success(`${addRole} "${store.name}" updated`);
      return;
    }

    const user: User = {
      id: `U-${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone.trim(),
      role: addRole,
      status: "Active",
      assignedStoreIds: [form.storeId],
    };
    addUser(user);
    setAddOpen(false);
    setForm(emptyForm);
    toast.success(
      `${addRole} "${user.name}" added to ${store.name}`,
    );
  };

  const handleAddStore = () => {
    if (
      !storeForm.name.trim() ||
      !storeForm.email.trim() ||
      !storeForm.phone.trim() ||
      !storeForm.zip.trim()
    ) {
      toast.error("Please fill in name, email, phone and zip");
      return;
    }
    if (storeForm.zip && !/^\d{6}$/.test(storeForm.zip)) {
      toast.error("Zip Code must be exactly 6 digits");
      return;
    }
    const store: Store = {
      id: `S-${Date.now()}`,
      name: storeForm.name.trim(),
      code: storeForm.code.trim() || `STR-${allStores.length + 1}`.toUpperCase(),
      address: storeForm.address.trim(),
      city: storeForm.city.trim(),
      state: storeForm.state.trim(),
      zip: storeForm.zip.trim(),
      phone: storeForm.phone.trim(),
      email: storeForm.email.trim(),
      status: "Active",
    };
    addStore(store).then((created) => {
      if (!created) return;
      setStoreOpen(false);
      setStoreForm(emptyStoreForm);
      toast.success(`Store "${created.name}" added`);
    });
  };

  const toggleStatus = (user: User) => {
    updateUser({
      ...user,
      status: user.status === "Active" ? "Inactive" : "Active",
    });
    toast.success(
      `${user.name} ${user.status === "Active" ? "deactivated" : "activated"}`,
    );
  };

  const approvePending = (user: User) => {
    updateUser({
      ...user,
      status: "Active",
    });
    toast.success(`${user.name} activated and can now log in`);
  };

  // Step 1: open confirm dialog
  const handleDeleteClick = (user: User) => {
    setDeleteTarget(user);
    setDeleteStep(1);
  };

  // Step 2: open type-to-confirm dialog
  const handleConfirmStep1 = () => {
    setDeleteTypeInput("");
    setDeleteStep(2);
  };

  // Step 3: open countdown dialog
  const handleConfirmStep2 = () => {
    const storeName = getStoreName(deleteTarget!.id);
    const expected = `I want to delete ${storeName}`;
    if (deleteTypeInput.trim() !== expected) {
      toast.error(`Please type exactly: "${expected}"`);
      return;
    }
    setCountdown(10);
    setDeleteStep(3);
  };

  // Countdown effect
  useEffect(() => {
    if (deleteStep !== 3) return;
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          // Execute delete
          if (deleteTarget) {
            deleteUser(deleteTarget.id);
            toast.success(`${deleteTarget.name} has been deleted`);
          }
          setDeleteStep(0);
          setDeleteTarget(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [deleteStep, deleteTarget]);

  const cancelDelete = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setDeleteStep(0);
    setDeleteTarget(null);
    setDeleteTypeInput("");
    setCountdown(10);
  };

  const actionLabel = (t: string) =>
    t === "add_cashier"
      ? "Add Cashier"
      : t === "delete_product"
        ? "Delete Product"
        : t === "delete_category"
          ? "Delete Category"
          : t === "delete_store"
            ? "Delete Store"
            : "Payment Settings";

  const filteredManagers = managers.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const filteredCashiers = cashiers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (storeFilter === "all" ||
        (u.assignedStoreIds || []).includes(storeFilter)),
  );

  const pendingRequests = useMemo(
    () => pendingApprovals.filter((a) => a.status === "pending"),
    [pendingApprovals],
  );

  const paginate = <T,>(list: T[]) =>
    list.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );

  const renderPager = (list: unknown[], label: string) => {
    const total = Math.ceil(list.length / itemsPerPage);
    const safePage = Math.min(currentPage, Math.max(1, total));
    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-gray-50 dark:border-gray-800">
        <span className="text-xs font-medium text-gray-500">
          Showing {list.length === 0 ? 0 : (safePage - 1) * itemsPerPage + 1} -{" "}
          {Math.min(list.length, safePage * itemsPerPage)} of {list.length}{" "}
          {label}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-gray-200 bg-white text-gray-600"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold text-gray-600 tabular-nums min-w-[72px] text-center">
            Page {safePage} of {Math.max(1, total)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-gray-200 bg-white text-gray-600"
            onClick={() => setCurrentPage((p) => Math.min(Math.max(1, total), p + 1))}
            disabled={safePage >= Math.max(1, total)}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Reset pagination whenever the search term or store filter changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, storeFilter]);

  // Clamp the page against the largest visible list so a filter never strands
  // the user on an empty page.
  useEffect(() => {
    const largestList = Math.max(
      filteredManagers.length,
      filteredCashiers.length,
      adminStores.length,
      pendingRequests.length,
    );
    const totalPages = Math.ceil(largestList / itemsPerPage);
    setCurrentPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [
    filteredManagers.length,
    filteredCashiers.length,
    adminStores.length,
    pendingRequests.length,
  ]);

  const inputClass =
    theme === "dark"
      ? "bg-gray-800 border-gray-700 text-white"
      : "bg-gray-50 border-gray-100";

  // Admin impersonation: enter the selected Manager/Cashier's session locally
  // (same mechanism as the Stores page). The Admin keeps their token, so the
  // logout button in the shell reverts them back to the Admin overview.
  const handleLoginAs = (u: User) => {
    const storeId = u.assignedStoreIds?.[0];
    if (!storeId) {
      toast.error("This user is not assigned to a store");
      return;
    }
    switchStore(storeId);
    loginUser(u);
    setAdminOverview(false);
    toast.success(`Logged in as ${u.name} (${u.role})`);
    navigate("/");
  };

  const memberCard = (u: User) => {
    const statusConfig =
      u.status === "Active"
        ? { Icon: CheckCircle2, cls: "text-[#00A651]", label: "Active" }
        : u.status === "Pending"
          ? { Icon: Clock, cls: "text-amber-500", label: "Pending" }
          : { Icon: MinusCircle, cls: "text-gray-400", label: "Inactive" };
    const { Icon: StatusIcon, cls: statusCls, label } = statusConfig;
    const supervisor = getSupervisor(u);
    const roleBadge =
      u.role === "Manager"
        ? "bg-primary-fixed text-primary-container"
        : "bg-secondary-container text-on-secondary-container";
    return (
      <div
        key={u.id}
        className="grid grid-cols-[minmax(0,1.6fr)_0.7fr_minmax(0,1.1fr)_minmax(0,1.2fr)_10rem] gap-3 items-center px-6 py-3.5 border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container-low/60 transition-colors"
      >
        {/* User */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${roleBadge}`}>
            {u.name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">
              {u.name}
            </p>
            <p className="text-xs text-on-surface-variant font-medium truncate">
              {u.email}
            </p>
          </div>
        </div>

        {/* Role */}
        <div>
          <Badge className={`border-none font-bold text-[10px] uppercase tracking-wide ${roleBadge}`}>
            {u.role}
          </Badge>
        </div>

        {/* Assigned Store */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant min-w-0">
          <StoreIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{getStoreName(u.id)}</span>
        </div>

        {/* Supervisor & Activity */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <StatusIcon title={label} className={`w-3.5 h-3.5 shrink-0 ${statusCls}`} />
            <span className={`text-xs font-bold ${statusCls}`}>{label}</span>
          </div>
          <p className="text-[11px] text-on-surface-variant font-medium truncate mt-0.5">
            {supervisor.name} · {supervisor.role}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 justify-end">
          {u.status === "Pending" && (
            <Button
              size="sm"
              className="h-8 rounded-lg text-xs font-bold gap-1 bg-secondary-container text-on-secondary-container hover:opacity-90 border-none"
              onClick={() => approvePending(u)}
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </Button>
          )}
          {currentUser?.role === "Admin" && u.status === "Active" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-on-surface-variant hover:text-primary-container transition-colors"
              onClick={() => handleLoginAs(u)}
              aria-label={`Log in as ${u.name}`}
              title={`Log in as ${u.name}`}
            >
              <LogIn className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-on-surface-variant hover:text-primary-container transition-colors"
            onClick={() => openEdit(u)}
            aria-label="Edit user"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-error hover:bg-error/10 transition-colors"
            onClick={() => handleDeleteClick(u)}
            aria-label="Delete user"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Stagger
      className={`px-4 md:px-6 pt-2 pb-8 space-y-6 min-h-screen ${
        theme === "dark" ? "bg-gray-900 text-gray-100" : "bg-gray-50/50"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl font-extrabold text-on-surface tracking-tight">
              Team &amp; Cashiers
            </h1>
          </div>
          <p className="text-sm text-on-surface-variant font-medium mt-1">
            Manage your stores and the Managers and Cashiers who run them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => openAdd("Cashier")}
            className="bg-primary-container hover:opacity-90 text-on-primary gap-2 h-11 px-5 rounded-xl font-bold shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add Cashier
          </Button>
          <Button
            onClick={() => setStoreOpen(true)}
            variant="outline"
            className="group border-outline-variant/60 text-on-surface gap-2 h-11 px-5 rounded-xl font-bold bg-surface-container-lowest hover:bg-surface-container"
          >
            <Plus className="w-4 h-4 transition-transform duration-300 ease-in-out group-hover:rotate-180" />
            <span className="flex items-center gap-2">
              <StoreIcon className="w-4 h-4" />
              Add Store
            </span>
          </Button>
        </div>
      </div>

      {/* KPI Overview — dashboard first-row bento cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {/* Stores Managed */}
        <div className="bento-card bento-card-hover p-6 flex flex-col min-h-[220px]">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-surface-container flex items-center justify-center">
              <StoreIcon className="w-5 h-5 text-on-surface-variant" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Stores Managed
            </p>
            <p className="font-display text-4xl font-extrabold text-on-surface leading-none mt-2 tabular-nums">
              {storeCount}
            </p>
            <p className="text-xs font-medium text-on-surface-variant mt-3">
              Storefronts under your oversight
            </p>
          </div>
        </div>

        {/* Managers */}
        <div className="bento-card bento-card-hover p-6 flex flex-col min-h-[220px]">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-primary-fixed flex items-center justify-center">
              <BadgeCheck className="w-5 h-5 text-primary-container" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Managers
            </p>
            <p className="font-display text-4xl font-extrabold text-on-surface leading-none mt-2 tabular-nums">
              {managerCount}
            </p>
            <p className="text-xs font-medium text-on-surface-variant mt-3">
              Each Manager owns one store
            </p>
          </div>
        </div>

        {/* Cashiers */}
        <div className="bento-card bento-card-hover p-6 flex flex-col min-h-[220px]">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-secondary-container/40 flex items-center justify-center">
              <Users className="w-5 h-5 text-on-secondary-container" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Cashiers
            </p>
            <p className="font-display text-4xl font-extrabold text-on-surface leading-none mt-2 tabular-nums">
              {cashierCount}
            </p>
            <p className="text-xs font-medium text-on-surface-variant mt-3">
              Cashiers sell at a store under its Manager
            </p>
          </div>
        </div>
      </div>

      <Tabs
        defaultValue="stores"
        onValueChange={() => setCurrentPage(1)}
        className="w-full"
      >
        <TabsList className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-1 rounded-xl h-12 shadow-sm mb-6">
          <TabsTrigger
            value="stores"
            className="rounded-lg px-6 h-10 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-bold transition-all"
          >
            Stores ({storeCount})
          </TabsTrigger>
          <TabsTrigger
            value="managers"
            className="rounded-lg px-6 h-10 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-bold transition-all"
          >
            Managers ({managerCount})
          </TabsTrigger>
          <TabsTrigger
            value="cashiers"
            className="rounded-lg px-6 h-10 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-bold transition-all"
          >
            Cashiers ({cashierCount})
          </TabsTrigger>
          <TabsTrigger
            value="approvals"
            className="rounded-lg px-6 h-10 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-bold transition-all"
          >
            Approvals ({pendingCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="managers" className="mt-0">
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-50 dark:border-gray-800 flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black text-gray-900 dark:text-white">
                  Store Managers
                </CardTitle>
                <p className="text-xs text-gray-500 font-medium">
                  Each Manager owns one store.
                </p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Search managers..."
                  className="pl-9 h-9 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredManagers.length === 0 ? (
                <div className="p-12 text-center">
                  <BadgeCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm font-black text-gray-900 dark:text-white">
                    No managers yet
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Add a Manager to run each store.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[860px]">
                    <div className="grid grid-cols-[minmax(0,1.6fr)_0.7fr_minmax(0,1.1fr)_minmax(0,1.2fr)_10rem] gap-3 items-center px-6 py-3 border-b border-outline-variant/40 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                      <span>User</span>
                      <span>Role</span>
                      <span>Assigned Store</span>
                      <span>Supervisor &amp; Activity</span>
                      <span className="text-right">Actions</span>
                    </div>
                    <div className="border-t border-outline-variant/40">
                      {paginate(filteredManagers).map(memberCard)}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            {filteredManagers.length > 0 &&
              renderPager(filteredManagers, "managers")}
          </Card>
        </TabsContent>

        <TabsContent value="cashiers" className="mt-0">
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-50 dark:border-gray-800 flex flex-row flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black text-gray-900 dark:text-white">
                  Cashiers
                </CardTitle>
                <p className="text-xs text-gray-500 font-medium">
                  Cashiers sell at a store under its Manager.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={storeFilter}
                  onValueChange={(v) => setStoreFilter(v)}
                >
                  <SelectTrigger
                    className={`w-64 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 border-none text-xs ${
                      storeFilter === "all"
                        ? "text-gray-400"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    <SelectValue placeholder="Filter by store" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px] overflow-y-auto">
                    <SelectItem value="all">All stores</SelectItem>
                    {adminStores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative w-64 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    placeholder="Search cashiers..."
                    className="pl-9 h-9 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredCashiers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm font-black text-gray-900 dark:text-white">
                    No cashiers yet
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Add a Cashier to sell at a store. Admin must activate
                    before they can log in.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[860px]">
                    <div className="grid grid-cols-[minmax(0,1.6fr)_0.7fr_minmax(0,1.1fr)_minmax(0,1.2fr)_10rem] gap-3 items-center px-6 py-3 border-b border-outline-variant/40 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                      <span>User</span>
                      <span>Role</span>
                      <span>Assigned Store</span>
                      <span>Supervisor &amp; Activity</span>
                      <span className="text-right">Actions</span>
                    </div>
                    <div className="border-t border-outline-variant/40">
                      {paginate(filteredCashiers).map(memberCard)}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            {filteredCashiers.length > 0 &&
              renderPager(filteredCashiers, "cashiers")}
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="mt-0">
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-50 dark:border-gray-800">
              <div>
                <CardTitle className="text-lg font-black text-gray-900 dark:text-white">
                  Stores
                </CardTitle>
                <p className="text-xs text-gray-500 font-medium">
                  Each store takes one Manager and any number of Cashiers.
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {adminStores.length === 0 ? (
                <div className="p-12 text-center">
                  <StoreIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm font-black text-gray-900 dark:text-white">
                    No stores yet
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Add a store up top to start building your team.
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {paginate(adminStores).map((store) => {
                    const manager = store.managerId
                      ? users.find((u) => u.id === store.managerId)
                      : undefined;
                    const cashierCountInStore = users.filter(
                      (u) =>
                        u.role === "Cashier" &&
                        (u.assignedStoreIds || []).includes(store.id),
                    ).length;
                    return (
                      <div key={store.id} className="bento-card bento-card-hover p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                              <StoreIcon className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                                {store.name}
                              </p>
                              <p className="flex items-center gap-1 text-xs text-gray-400 font-medium truncate mt-0.5">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {[store.address, store.city, store.state]
                                    .filter(Boolean)
                                    .join(", ") || store.code}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <BadgeCheck className="w-4 h-4 text-[#00A651] shrink-0" />
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-0">
                              <span className="truncate max-w-[160px]">
                                {store.managerId
                                  ? `Managed by ${manager?.name || "—"}`
                                  : "No manager yet"}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Users className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {cashierCountInStore} cashier
                              {cashierCountInStore === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-lg text-xs font-bold gap-1 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                              onClick={() =>
                                openAddAtStore("Cashier", store.id)
                              }
                            >
                              <UserPlus className="w-4 h-4" />
                              Add Cashier
                            </Button>
                            <Button
                              size="sm"
                              disabled={Boolean(store.managerId)}
                              className={`h-9 rounded-lg text-xs font-bold gap-1 ${
                                store.managerId
                                  ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
                              }`}
                              onClick={() =>
                                openAddAtStore("Manager", store.id)
                              }
                            >
                              <Plus className="w-4 h-4" />
                              Add Manager
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            {adminStores.length > 0 && renderPager(adminStores, "stores")}
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="mt-0">
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-50 dark:border-gray-800">
              <CardTitle className="text-lg font-black text-gray-900 dark:text-white">
                Pending Approvals
              </CardTitle>
              <p className="text-xs text-gray-500 font-medium">
                Approve or reject requests raised by your team.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {pendingRequests.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-[#00A651] mx-auto mb-4" />
                  <p className="text-sm font-black text-gray-900 dark:text-white">
                    All caught up
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    No pending requests right now.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-4 space-y-3">
                    {paginate(pendingRequests).map((a) => (
                      <div
                        key={a.id}
                        className="bento-card bento-card-hover p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                              <AlertTriangle className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                                {actionLabel(a.actionType)}
                              </p>
                              <p className="text-xs text-gray-400 font-medium truncate mt-0.5">
                                {a.requesterName} ({a.requesterRole})
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <Badge className="bg-amber-50 text-amber-700 border-none font-bold text-[11px] uppercase">
                              {a.storeName}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-gray-400">
                            {new Date(a.createdAt).toLocaleString()}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              className="h-9 rounded-lg bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs font-bold"
                              onClick={() => {
                                approveApprovalRequest(a.id);
                                toast.success("Request approved");
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg border-gray-200 dark:border-gray-700 text-red-600 gap-1.5 text-xs font-bold"
                              onClick={() => {
                                rejectApprovalRequest(a.id);
                                toast.success("Request rejected");
                              }}
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {pendingRequests.length > 0 &&
                    renderPager(pendingRequests, "approvals")}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white">
              {editingUser ? "Edit" : "Add"} {addRole}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {editingUser
                ? "Update this member's role, store and contact details."
                : addRole === "Manager"
                  ? "A Manager runs one store and manages its products, POS and team."
                  : "A Cashier sells at the store under its Manager."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Full Name *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. Israel"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Email *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="israel@sellsync.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {editingUser ? "Password" : "Password *"}
              </Label>
              <Input
                type="password"
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Phone
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="0801 234 5678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Store *
              </Label>
              <Select
                value={form.storeId || undefined}
                onValueChange={(v) => setForm({ ...form, storeId: v })}
              >
                <SelectTrigger
                  className={`h-11 rounded-xl border-none ${inputClass}`}
                >
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px] overflow-y-auto">
                  {storeOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingUser &&
                addRole === "Manager" &&
                availableManagerStores.length === 0 && (
                  <p className="text-[10px] font-bold text-amber-600">
                    All stores already have a Manager. Create a new store first.
                  </p>
                )}
              {!editingUser &&
                addRole === "Cashier" &&
                storesWithManager.length === 0 && (
                  <p className="text-[10px] font-bold text-amber-600">
                    Create a store first — Cashiers are added to a store.
                  </p>
                )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setAddOpen(false);
                setEditingUser(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleCreate}
            >
              {editingUser ? "Save Changes" : `Add ${addRole}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Store Dialog */}
      <Dialog open={storeOpen} onOpenChange={setStoreOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white">
              Add Store
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Create a new store. You can then assign its Manager and Cashiers
              from the Stores tab.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Store Name *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. Sellysync Lekki"
                value={storeForm.name}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Store Code
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder={`e.g. STR-${allStores.length + 1}`}
                value={storeForm.code}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, code: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Address
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. 14 Admiralty Way, Lekki Phase 1"
                value={storeForm.address}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, address: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                City
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="Lagos"
                value={storeForm.city}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, city: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                State
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="Lagos"
                value={storeForm.state}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, state: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Zip Code *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. 100001"
                value={storeForm.zip}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, zip: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Phone *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="0801 234 5678"
                value={storeForm.phone}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, phone: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Email *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="store@company.com"
                value={storeForm.email}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, email: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setStoreOpen(false);
                setStoreForm(emptyStoreForm);
              }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleAddStore}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Step 1: Confirm */}
      <Dialog open={deleteStep === 1} onOpenChange={(o) => { if (!o) cancelDelete(); }}>
        <DialogContent className="sm:max-w-[420px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white text-center">
              Delete {deleteTarget?.name}?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 text-center">
              {deleteTarget?.role === "Manager"
                ? `This will remove the Manager of "${getStoreName(deleteTarget?.id || "")}". Their store will be left without a manager.`
                : `This will permanently remove ${deleteTarget?.name} from the system.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-row justify-center">
            <Button
              variant="outline"
              className="rounded-xl px-6"
              onClick={cancelDelete}
            >
              No, Cancel
            </Button>
            <Button
              className="rounded-xl px-6 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmStep1}
            >
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Step 2: Type to confirm */}
      <Dialog open={deleteStep === 2} onOpenChange={(o) => { if (!o) cancelDelete(); }}>
        <DialogContent className="sm:max-w-[480px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white text-center">
              Type to Confirm
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 text-center">
              To confirm deletion, please type the following exactly:
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs font-black text-gray-900 dark:text-white text-center mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
              I want to delete {getStoreName(deleteTarget?.id || "")}
            </p>
            <Input
              className="h-11 rounded-xl bg-gray-50/50 border-none font-bold text-sm text-center"
              placeholder="Type the phrase above..."
              value={deleteTypeInput}
              onChange={(e) => setDeleteTypeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && deleteTypeInput.trim()) handleConfirmStep2();
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 flex-row justify-center">
            <Button
              variant="outline"
              className="rounded-xl px-6"
              onClick={cancelDelete}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl px-6 bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteTypeInput.trim() !== `I want to delete ${getStoreName(deleteTarget?.id || "")}`}
              onClick={handleConfirmStep2}
            >
              Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Step 3: Countdown */}
      <Dialog open={deleteStep === 3} onOpenChange={(o) => { if (!o) cancelDelete(); }}>
        <DialogContent className="sm:max-w-[420px] rounded-[2rem] bg-white dark:bg-gray-900" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-black text-red-600">{countdown}</span>
            </div>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white text-center">
              Deleting in {countdown} seconds
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 text-center">
              {deleteTarget?.name} will be permanently removed when the countdown reaches zero.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 10) * 100}%` }}
              />
            </div>
          </div>
          <DialogFooter className="flex-row justify-center">
            <Button
              className="rounded-xl px-8 bg-gray-900 hover:bg-black text-white font-bold"
              onClick={cancelDelete}
            >
              Cancel Deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stagger>
  );
}
