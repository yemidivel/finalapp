import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  BadgeCheck,
  UserPlus,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Trash2,
  Search,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
import type { Role, User } from "../state/store";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  storeId: "",
};

export function TeamPage() {
  const {
    users,
    allStores,
    pendingApprovals,
    addUser,
    updateUser,
    deleteUser,
    approveApprovalRequest,
    rejectApprovalRequest,
    theme,
  } = useStore();

  const [addRole, setAddRole] = useState<Role>("Manager");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");

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

  // Only stores without a manager can take a new Manager. The Admin's own
  // first/oversight store is never assignable.
  const availableManagerStores = useMemo(
    () => allStores.filter((s) => !s.managerId && !s.isAdminStore),
    [allStores],
  );

  // Only stores WITH a Manager can take a Cashier. The Admin's own
  // first/oversight store has no Manager, so it can never host a Cashier.
  const storesWithManager = useMemo(
    () => allStores.filter((s) => s.managerId && !s.isAdminStore),
    [allStores],
  );

  const getStoreName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    const storeId = user?.assignedStoreIds?.[0];
    const store = allStores.find((s) => s.id === storeId);
    return store ? store.name : "—";
  };

  const openAdd = (role: Role) => {
    setAddRole(role);
    setForm({ ...emptyForm, storeId: "" });
    setAddOpen(true);
  };

  const handleCreate = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!form.password.trim()) {
      toast.error("A password is required so the user can log in");
      return;
    }
    if (!form.storeId) {
      toast.error("Please select a store");
      return;
    }
    const store = allStores.find((s) => s.id === form.storeId);
    if (!store) return;

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
  const filteredCashiers = cashiers.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const inputClass =
    theme === "dark"
      ? "bg-gray-800 border-gray-700 text-white"
      : "bg-gray-50 border-gray-100";

  const userRow = (u: User) => (
    <div
      key={u.id}
      className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
            u.role === "Manager"
              ? "bg-blue-50 text-blue-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {u.name[0]}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-gray-900 dark:text-white truncate">
            {u.name}
          </p>
          <p className="text-[10px] text-gray-400 font-medium truncate">
            {u.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:block text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 justify-end">
            <Building2 className="w-3 h-3" />
            {getStoreName(u.id)}
          </p>
          <Badge
            className={`mt-1 border-none font-bold text-[9px] uppercase ${
              u.status === "Active"
                ? "bg-green-50 text-green-700"
                : u.status === "Pending"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {u.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {u.status === "Pending" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-[10px] font-bold border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              onClick={() => approvePending(u)}
            >
              Approve
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-700 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
              onClick={() => handleDeleteClick(u)}
              title="Delete user"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`p-4 md:p-6 space-y-6 min-h-screen ${
        theme === "dark" ? "bg-gray-950 text-gray-100" : "bg-gray-50/30"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
            Team Management
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            Create Managers to run your stores and assign Cashiers to them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => openAdd("Cashier")}
            className="gap-2 h-11 px-5 rounded-xl font-black border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-white hover:bg-gray-50"
          >
            <UserPlus className="w-4 h-4" />
            Add Cashier
          </Button>
          <Button
            onClick={() => openAdd("Manager")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 px-5 rounded-xl font-black shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            Add Manager
          </Button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <BadgeCheck className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Managers
            </p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {managerCount}
            </h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Cashiers
            </p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {cashierCount}
            </h3>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="managers" className="w-full">
        <TabsList className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-1 rounded-xl h-12 shadow-sm mb-6">
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
                filteredManagers.map(userRow)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashiers" className="mt-0">
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-50 dark:border-gray-800 flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black text-gray-900 dark:text-white">
                  Cashiers
                </CardTitle>
                <p className="text-xs text-gray-500 font-medium">
                  Cashiers sell at a store under its Manager.
                </p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Search cashiers..."
                  className="pl-9 h-9 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
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
                filteredCashiers.map(userRow)
              )}
            </CardContent>
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
              {pendingApprovals.filter((a) => a.status === "pending").length ===
              0 ? (
                <div className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-4" />
                  <p className="text-sm font-black text-gray-900 dark:text-white">
                    All caught up
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    No pending requests right now.
                  </p>
                </div>
              ) : (
                pendingApprovals
                  .filter((a) => a.status === "pending")
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 p-4 border-b border-gray-50 dark:border-gray-800 last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-gray-900 dark:text-white truncate">
                            {actionLabel(a.actionType)}
                          </p>
                          <Badge className="bg-amber-50 text-amber-700 border-none font-bold text-[9px] uppercase">
                            {a.storeName}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium mt-1">
                          {a.requesterName} ({a.requesterRole}) •{" "}
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          className="h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white gap-1.5 text-[10px] font-bold"
                          onClick={() => {
                            approveApprovalRequest(a.id);
                            toast.success("Request approved");
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg border-gray-200 dark:border-gray-700 text-red-600 gap-1.5 text-[10px] font-bold"
                          onClick={() => {
                            rejectApprovalRequest(a.id);
                            toast.success("Request rejected");
                          }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
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
              Add {addRole}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {addRole === "Manager"
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
                Password *
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
                  {addRole === "Manager"
                    ? availableManagerStores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))
                    : storesWithManager.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
              {addRole === "Manager" &&
                availableManagerStores.length === 0 && (
                  <p className="text-[10px] font-bold text-amber-600">
                    All stores already have a Manager. Create a new store first.
                  </p>
                )}
              {addRole === "Cashier" &&
                storesWithManager.length === 0 && (
                  <p className="text-[10px] font-bold text-amber-600">
                    Assign a Manager to a store first — Cashiers can only be
                    added to stores run by a Manager.
                  </p>
                )}
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
              Add {addRole}
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
    </div>
  );
}
