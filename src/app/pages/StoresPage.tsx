import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Building2,
  Users,
  Plus,
  ArrowRight,
  Pencil,
  Trash2,
  AlertTriangle,
  Phone,
  MapPin,
  BadgeCheck,
  Mail,
  ChevronRight,
  LogIn,
  ArrowLeft,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
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
import { toast } from "sonner";
import { useStore } from "../state/store";
import type { Store, User } from "../state/store";

const emptyForm = {
  name: "",
  code: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zip: "",
};

export function StoresPage() {
  const navigate = useNavigate();
  const {
    allStores,
    users,
    allTransactions,
    allInventory,
    pendingApprovals,
    addStore,
    deleteStore,
    updateStoreProfile,
    switchStore,
    setAdminOverview,
    addUser,
    loginUser,
    formatCurrency,
    theme,
  } = useStore();

  const [addOpen, setAddOpen] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [contactDialog, setContactDialog] = useState<{
    type: "call" | "message";
    store: Store;
  } | null>(null);
  const [deleteStoreTarget, setDeleteStoreTarget] = useState<Store | null>(
    null,
  );
  const [managerStore, setManagerStore] = useState<Store | null>(null);
  const [assignFormOpen, setAssignFormOpen] = useState(false);
  const [managerForm, setManagerForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [loginStore, setLoginStore] = useState<Store | null>(null);
  const [loginStep, setLoginStep] = useState<"role" | "cashier">("role");
  const [cashierStore, setCashierStore] = useState<Store | null>(null);
  const [cashierForm, setCashierForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const stats = useMemo(() => {
    const managers = users.filter((u) => u.role === "Manager").length;
    const cashiers = users.filter((u) => u.role === "Cashier").length;
    const pending = pendingApprovals.filter(
      (a) => a.status === "pending",
    ).length;
    return {
      stores: allStores.length,
      managers,
      cashiers,
      pending,
    };
  }, [users, allStores.length, pendingApprovals]);

  const storeStats = useMemo(() => {
    const map = new Map<
      string,
      { revenue: number; lowStock: number; teamSize: number; pending: number }
    >();
    for (const s of allStores) {
      map.set(s.id, { revenue: 0, lowStock: 0, teamSize: 0, pending: 0 });
    }
    for (const t of allTransactions) {
      const entry = map.get(t.storeId);
      if (entry && t.status === "Completed") entry.revenue += t.amount;
    }
    for (const i of allInventory) {
      const entry = map.get(i.storeId);
      if (entry && i.stock < i.reorderPoint) entry.lowStock += 1;
    }
    for (const u of users) {
      // "Team" on a store card counts the Cashiers that store's Manager has.
      if (u.role !== "Cashier") continue;
      for (const id of u.assignedStoreIds || []) {
        const entry = map.get(id);
        if (entry) entry.teamSize += 1;
      }
    }
    for (const a of pendingApprovals) {
      const entry = map.get(a.storeId);
      if (entry && a.status === "pending") entry.pending += 1;
    }
    return map;
  }, [allStores, allTransactions, allInventory, users, pendingApprovals]);

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("Store name is required");
      return;
    }
    const store: Store = {
      id: `S-${Date.now()}`,
      name: form.name.trim(),
      code: form.code.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
      status: "Active",
    };
    addStore(store);
    setAddOpen(false);
    setForm(emptyForm);
    toast.success(`"${store.name}" created`);
  };

  const handleSaveEdit = () => {
    if (!editStore) return;
    if (!form.name.trim()) {
      toast.error("Store name is required");
      return;
    }
    updateStoreProfile({
      ...editStore,
      name: form.name.trim(),
      code: form.code.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
    });
    setEditStore(null);
    setForm(emptyForm);
    toast.success("Store updated");
  };

  const handleDelete = (store: Store) => {
    setDeleteStoreTarget(store);
  };

  const handleConfirmDelete = () => {
    if (deleteStoreTarget) {
      deleteStore(deleteStoreTarget.id);
      setDeleteStoreTarget(null);
      toast.success(`"${deleteStoreTarget.name}" deleted`);
    }
  };

  const handleEnter = (store: Store) => {
    // A store must have a Manager before the Admin can enter it.
    if (!store.managerId) {
      setManagerStore(store);
      setManagerForm({ name: "", email: "", password: "", phone: "" });
      setAssignFormOpen(false);
      return;
    }
    // Manager-run store: let the Admin pick which role to log in as.
    setLoginStep("role");
    setLoginStore(store);
  };

  const storeCashiers = useMemo(() => {
    if (!loginStore) return [];
    return users.filter(
      (u) =>
        u.role === "Cashier" &&
        (u.assignedStoreIds || []).includes(loginStore.id),
    );
  }, [users, loginStore]);

  const loginStoreManager = useMemo(() => {
    if (!loginStore?.managerId) return null;
    return users.find((u) => u.id === loginStore.managerId) || null;
  }, [users, loginStore]);

  const handleLoginAsManager = (store: Store) => {
    const manager = users.find((u) => u.id === store.managerId);
    if (!manager) {
      toast.error("Manager not found for this store");
      return;
    }
    setLoginStore(null);
    switchStore(store.id);
    loginUser(manager);
    setAdminOverview(false);
    toast.success(`Logged in as ${manager.name} (Manager)`);
    navigate("/");
  };

  const handleLoginAsCashier = (cashier: User) => {
    const storeId = cashier.assignedStoreIds?.[0];
    if (!storeId) {
      toast.error("This Cashier is not assigned to a store");
      return;
    }
    setLoginStore(null);
    switchStore(storeId);
    loginUser(cashier);
    setAdminOverview(false);
    toast.success(`Logged in as ${cashier.name} (Cashier)`);
    navigate("/");
  };

  const openCreateCashier = (store: Store) => {
    setCashierStore(store);
    setCashierForm({ name: "", email: "", password: "", phone: "" });
    setLoginStore(null);
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleCreateCashier = () => {
    if (!cashierStore) return;
    if (!cashierForm.name.trim() || !cashierForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!isValidEmail(cashierForm.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!cashierForm.password.trim()) {
      toast.error("A password is required so the user can log in");
      return;
    }
    const store = cashierStore;
    const newCashier: User = {
      id: `U-${Date.now()}`,
      name: cashierForm.name.trim(),
      email: cashierForm.email.trim(),
      password: cashierForm.password,
      phone: cashierForm.phone.trim(),
      role: "Cashier",
      status: "Active",
      assignedStoreIds: [store.id],
    };
    addUser(newCashier);
    setCashierStore(null);
    toast.success(`Cashier ${newCashier.name} created`);
    switchStore(store.id);
    loginUser(newCashier);
    setAdminOverview(false);
    toast.success(`Logged in as ${newCashier.name} (Cashier)`);
    navigate("/");
  };

  const handleAssignManager = () => {
    if (!managerStore) return;
    if (!managerForm.name.trim() || !managerForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!isValidEmail(managerForm.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!managerForm.password.trim()) {
      toast.error("A password is required so the user can log in");
      return;
    }
    const store = managerStore;
    const newManager: User = {
      id: `U-${Date.now()}`,
      name: managerForm.name.trim(),
      email: managerForm.email.trim(),
      password: managerForm.password,
      phone: managerForm.phone.trim(),
      role: "Manager",
      status: "Active",
      assignedStoreIds: [store.id],
    };
    addUser(newManager);
    setManagerStore(null);
    setAssignFormOpen(false);
    toast.success(`Manager assigned to ${store.name}`);
    switchStore(store.id);
    loginUser(newManager);
    setAdminOverview(false);
    toast.success(`Logged in as ${newManager.name} (Manager)`);
    navigate("/");
  };

  const openEdit = (store: Store) => {
    setEditStore(store);
    setForm({
      name: store.name || "",
      code: store.code || "",
      phone: store.phone || "",
      email: store.email || "",
      address: store.address || "",
      city: store.city || "",
      state: store.state || "",
      zip: store.zip || "",
    });
  };

  const inputClass =
    theme === "dark"
      ? "bg-gray-800 border-gray-700 text-white"
      : "bg-gray-50 border-gray-100";

  return (
    <Stagger
      className={`px-4 md:px-6 pt-2 pb-8 space-y-6 min-h-screen ${
        theme === "dark" ? "bg-gray-900 text-gray-100" : "bg-gray-50/50"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Stores
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Oversee all business locations, their managers and performance.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setAddOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 px-6 rounded-xl font-black shadow-lg shadow-indigo-100"
        >
          <Plus className="w-4 h-4" />
          Add Store
        </Button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <Badge className="bg-indigo-50 text-indigo-700 border-none text-[10px] font-bold">
                Branches
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Total Stores
            </p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {stats.stores}
            </h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <BadgeCheck className="w-5 h-5 text-blue-600" />
              </div>
              <Badge className="bg-blue-50 text-blue-700 border-none text-[10px] font-bold">
                Managers
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Store Managers
            </p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {stats.managers}
            </h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <Badge className="bg-green-50 text-green-700 border-none text-[10px] font-bold">
                Cashiers
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Team Members
            </p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {stats.cashiers}
            </h3>
          </CardContent>
        </Card>
      </div>

      {/* Store Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {allStores.length === 0 && (
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl col-span-full">
            <CardContent className="p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-black text-gray-900 dark:text-white">
                No stores yet
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Create your first store to get started.
              </p>
            </CardContent>
          </Card>
        )}

        {allStores.map((store) => {
          const manager = users.find((u) => u.id === store.managerId);
          const s = storeStats.get(store.id) || {
            revenue: 0,
            lowStock: 0,
            teamSize: 0,
            pending: 0,
          };
          return (
            <Card
              key={store.id}
              className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden transition-all hover:shadow-md"
            >
              <CardHeader className="p-5 border-b border-gray-50 dark:border-gray-800 flex flex-row items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 text-sm">
                    {store.name[0]}
                  </div>
                  <div>
                    <CardTitle className="text-base font-black text-gray-900 dark:text-white leading-tight">
                      {store.name}
                    </CardTitle>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {store.city || "—"}, {store.state || "—"}
                    </p>
                  </div>
                </div>
                <Badge
                  className={`border-none font-black text-[9px] uppercase px-2 py-0.5 ${
                    store.status === "Active"
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {store.status}
                </Badge>
                {store.isAdminStore && (
                  <Badge className="bg-indigo-50 text-indigo-600 border-none font-black text-[9px] uppercase px-2 py-0.5">
                    Oversight · Cannot be deleted
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {store.isAdminStore ? (
                  /* Admin's oversight store: quick contact actions only */
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        store.phone &&
                        setContactDialog({ type: "call", store })
                      }
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl border font-black text-xs transition-all ${
                        store.phone
                          ? "bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100"
                          : "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                      }`}
                    >
                      <Phone className="w-4 h-4" />
                      Call
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        store.email &&
                        setContactDialog({ type: "message", store })
                      }
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl border font-black text-xs transition-all ${
                        store.email
                          ? "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                          : "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                      Message
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          Manager
                        </p>
                        <p className="text-xs font-black text-gray-900 dark:text-white mt-1 truncate">
                          {manager ? "1" : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          Team
                        </p>
                        <p className="text-xs font-black text-gray-900 dark:text-white mt-1">
                          {s.teamSize} cashiers
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          Revenue
                        </p>
                        <p className="text-xs font-black text-indigo-600 mt-1 truncate">
                          {formatCurrency(s.revenue)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          store.phone &&
                          setContactDialog({ type: "call", store })
                        }
                        className={`flex items-center justify-center gap-2 h-10 rounded-xl border font-black text-xs transition-all ${
                          store.phone
                            ? "bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100"
                            : "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                        }`}
                      >
                        <Phone className="w-4 h-4" />
                        Call
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          store.email &&
                          setContactDialog({ type: "message", store })
                        }
                        className={`flex items-center justify-center gap-2 h-10 rounded-xl border font-black text-xs transition-all ${
                          store.email
                            ? "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                            : "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                        }`}
                      >
                        <Mail className="w-4 h-4" />
                        Message
                      </button>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  {store.isAdminStore ? (
                    <div className="flex-1 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Your oversight store
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleEnter(store)}
                      className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs gap-1.5 shadow-lg shadow-indigo-100"
                    >
                      Enter Store
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-gray-200 dark:border-gray-700"
                    onClick={() => openEdit(store)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {!store.isAdminStore && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-gray-200 dark:border-gray-700 text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(store)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Store Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white">
              Add New Store
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Create a new business location. A Manager can then be assigned to
              it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Store Name *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. Main Store"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Store Code
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. MS-001"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Phone
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. 0801 234 5678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Email
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="store@sellsync.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Address
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="Street address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                City
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. Lagos"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                State
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. Lagos"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleCreate}
            >
              Create Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Store Dialog */}
      <Dialog
        open={editStore !== null}
        onOpenChange={(o) => {
          if (!o) {
            setEditStore(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white">
              Edit Store
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Update details for {editStore?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Store Name *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Store Code
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Phone
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Email
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Address
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                City
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                State
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setEditStore(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSaveEdit}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog
        open={contactDialog !== null}
        onOpenChange={(o) => !o && setContactDialog(null)}
      >
        <DialogContent className="sm:max-w-[420px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white">
              {contactDialog?.type === "call" ? "Call Store" : "Message Store"}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {contactDialog?.store.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {contactDialog?.type === "call" ? (
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-indigo-50 border border-indigo-100 p-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    Phone Number
                  </p>
                  <p className="text-lg font-black text-gray-900 mt-0.5 truncate">
                    {contactDialog?.store.phone || "No phone number saved"}
                  </p>
                </div>
                <div className="w-11 h-11 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 border border-gray-200 p-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    Email Address
                  </p>
                  <p className="text-lg font-black text-gray-900 mt-0.5 truncate">
                    {contactDialog?.store.email || "No email saved"}
                  </p>
                </div>
                <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setContactDialog(null)}
            >
              Cancel
            </Button>
            {contactDialog?.type === "call" ? (
              <a
                href={`tel:${contactDialog?.store.phone || ""}`}
                onClick={() => setContactDialog(null)}
                className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs"
              >
                <Phone className="w-4 h-4" />
                Call Now
              </a>
            ) : (
              <a
                href={`mailto:${contactDialog?.store.email || ""}`}
                onClick={() => setContactDialog(null)}
                className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs"
              >
                <Mail className="w-4 h-4" />
                Send Email
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Store Confirmation */}
      <AlertDialog
        open={deleteStoreTarget !== null}
        onOpenChange={(o) => !o && setDeleteStoreTarget(null)}
      >
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              Delete Store Location?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-bold text-gray-500 py-2">
              Are you sure you want to delete{" "}
              <span className="text-red-600 font-black">
                {deleteStoreTarget?.name}
              </span>
              ? This action is permanent and cannot be undone. It will remove
              the store, its Manager and all its Cashiers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl font-bold border-gray-100 h-12">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="rounded-xl font-black bg-red-600 hover:bg-red-700 h-12 px-8 shadow-lg shadow-red-100"
            >
              Yes, Delete Store
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Manager Prompt */}
      <Dialog
        open={managerStore !== null && !assignFormOpen}
        onOpenChange={(o) => !o && setManagerStore(null)}
      >
        <DialogContent className="sm:max-w-[420px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              Assign a Manager
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 pt-2 leading-relaxed">
              <span className="font-black text-gray-900 dark:text-white">
                {managerStore?.name}
              </span>{" "}
              does not have a Manager assigned yet. A Manager must run the store
              before you can enter it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setManagerStore(null)}
            >
              Not Now
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setAssignFormOpen(true)}
            >
              Assign Manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Manager Form */}
      <Dialog
        open={managerStore !== null && assignFormOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAssignFormOpen(false);
            setManagerStore(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white">
              Assign Manager
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              A Manager runs one store and manages its products, POS and team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Store *
              </Label>
              <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-black text-indigo-700 truncate">
                  {managerStore?.name}
                </span>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Full Name *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. Daniel"
                value={managerForm.name}
                onChange={(e) =>
                  setManagerForm({ ...managerForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Email *
              </Label>
              <Input
                type="email"
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="daniel@sellsync.com"
                value={managerForm.email}
                onChange={(e) =>
                  setManagerForm({ ...managerForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Password *
              </Label>
              <Input
                type="password"
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="••••••••"
                value={managerForm.password}
                onChange={(e) =>
                  setManagerForm({ ...managerForm, password: e.target.value })
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
                value={managerForm.phone}
                onChange={(e) =>
                  setManagerForm({ ...managerForm, phone: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setAssignFormOpen(false);
                setManagerStore(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleAssignManager}
            >
              Assign Manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login As Dialog — pick how to access a Manager-run store */}
      <Dialog
        open={loginStore !== null}
        onOpenChange={(o) => { if (!o) { setLoginStore(null); setLoginStep("role"); } }}
      >
        <DialogContent className="sm:max-w-[460px] rounded-[2rem] bg-white dark:bg-gray-900">
          {loginStep === "role" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <LogIn className="w-5 h-5 text-indigo-600" />
                  </div>
                  Login to {loginStore?.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 pt-2 leading-relaxed">
                  Choose how you want to access this store as the Admin.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <button
                  type="button"
                  onClick={() => loginStore && handleLoginAsManager(loginStore)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-blue-100 bg-blue-50/50 hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-gray-900 dark:text-white">
                      Login as Manager
                    </p>
                    <p className="text-[11px] font-bold text-gray-500 truncate">
                      {loginStoreManager?.name || "Manager"} ·{" "}
                      {loginStoreManager?.email || "Not assigned"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setLoginStep("cashier")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-gray-900 dark:text-white">
                      Login as Cashier
                    </p>
                    <p className="text-[11px] font-bold text-gray-500">
                      {storeCashiers.length > 0
                        ? `${storeCashiers.length} cashier${storeCashiers.length !== 1 ? "s" : ""} available`
                        : "No cashier assigned yet"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
                </button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLoginStep("role")}
                    className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  Select Cashier
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 pt-2 leading-relaxed">
                  Choose a cashier to log in as for {loginStore?.name}.
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[400px] overflow-y-auto min-h-0 py-2 space-y-1.5">
                {storeCashiers.length > 0 ? (
                  storeCashiers.map((cashier) => (
                    <button
                      key={cashier.id}
                      type="button"
                      onClick={() => handleLoginAsCashier(cashier)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-black text-xs text-gray-500 shrink-0">
                        {cashier.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-700 dark:text-gray-200 truncate">
                          {cashier.name}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 truncate">
                          {cashier.email}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => loginStore && openCreateCashier(loginStore)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-gray-800 transition-colors group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <Plus className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-indigo-600">
                        Create Cashier for this store
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        No Cashier assigned yet — add one to log in as them.
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-indigo-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={cashierStore !== null}
        onOpenChange={(o) => !o && setCashierStore(null)}
      >
        <DialogContent className="sm:max-w-[480px] rounded-[2rem] bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 dark:text-white">
              Create Cashier
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              A Cashier sells products at the POS under the store's Manager.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Store *
              </Label>
              <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-black text-indigo-700 truncate">
                  {cashierStore?.name}
                </span>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Full Name *
              </Label>
              <Input
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="e.g. Eben"
                value={cashierForm.name}
                onChange={(e) =>
                  setCashierForm({ ...cashierForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Email *
              </Label>
              <Input
                type="email"
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="eben@sellsync.com"
                value={cashierForm.email}
                onChange={(e) =>
                  setCashierForm({ ...cashierForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Password *
              </Label>
              <Input
                type="password"
                className={`h-11 rounded-xl border-none ${inputClass}`}
                placeholder="••••••••"
                value={cashierForm.password}
                onChange={(e) =>
                  setCashierForm({ ...cashierForm, password: e.target.value })
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
                value={cashierForm.phone}
                onChange={(e) =>
                  setCashierForm({ ...cashierForm, phone: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setCashierStore(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleCreateCashier}
            >
              Create & Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stagger>
  );
}
