import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Store,
  ShieldCheck,
  CreditCard,
  Building2,
  User,
  Plus,
  Trash2,
  Edit2,
  Receipt,
  AlertTriangle,
  Users,
  Clock,
  DollarSign,
  CheckCircle2,
  X,
  Lock,
  Mail,
  Phone,
  MapPin,
  MoreVertical,

  Shield,
  UserCheck,
  UserMinus,
  Upload,
  Image as ImageIcon,
  Smartphone,
  Globe,
  Bell,
  Calendar,
  Type,
  Hash,
  RefreshCcw,
  ExternalLink,
  ChevronRight,
  PlusCircle,
  LayoutGrid,
  ArrowRightLeft,
  Info,
  Banknote,
  Wallet,
  Calculator,
  Zap,
  Send,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  useStore,
  Role,
  User as UserType,
  Store as StoreType,
  Preferences,
} from "../state/store";
import { toast } from "sonner";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { isStoreTakenByOtherUser } from "../../lib/rbac";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export default function SettingsPage() {
  const {
    currentStore,
    allStores,
    users,
    currentUser,
    preferences,
    canEdit,
    addStore,
    deleteStore,
    requestDeleteStore,
    updateStoreProfile,
    addUser,
    deleteUser,
    updateUser,
    updatePaymentSettings,
    setReceiptDefaults,
    formatCurrency,
    updateStoreSettings,
    updatePreferences,
    paymentSettings,
    receiptDefaults,
    bankAccounts,
    posTerminals,
    addBankAccount,
    deleteBankAccount,
    addPOSTerminal,
    deletePOSTerminal,
    updateUserPassword,
    switchStore,
    submitLinkRequest,
    approveLinkRequest,
    rejectLinkRequest,
    requestAddCashier,
    linkingRequests,
    adminOverview,
  } = useStore();

  const isAdminRole = currentUser?.role === "Admin";
  // The Admin sees their oversight settings only in overview mode. Once the
  // Admin switches into a Manager's store, Settings presents that store's
  // Manager view (My Store / Team & Cashiers / Receipts / Payments / Prefs).
  const adminInStore = isAdminRole && !adminOverview;
  const isAdmin = isAdminRole && adminOverview;
  const isManager = currentUser?.role === "Manager" || adminInStore;
  const isStaff = currentUser?.role === "Cashier";

  // Payment requests from Cashiers that need this Manager's approval. The
  // linkingRequests list is already scoped to the current store by the store.
  const managerPendingCount = useMemo(
    () => (isManager ? linkingRequests.filter((r) => r.status === "Pending").length : 0),
    [isManager, linkingRequests],
  );

  // A Cashier's own payment requests (bank / terminal / Paystack), so they can
  // track what's waiting on their manager.
  const myRequests = useMemo(
    () =>
      currentUser
        ? linkingRequests.filter((r) => r.userId === currentUser.id)
        : [],
    [linkingRequests, currentUser],
  );

  // RBAC: Filter stores and users for non-Admin
  const filteredStores = useMemo(() => {
    if (isAdmin) return allStores;
    if (adminInStore) return allStores.filter((s) => s.id === currentStore.id);
    // For Manager and Staff, show only their assigned stores
    // Support both old 'assignedStoreId' and new 'assignedStoreIds'
    const assignedIds =
      currentUser?.assignedStoreIds ||
      ((currentUser as any)?.assignedStoreId
        ? [(currentUser as any).assignedStoreId]
        : []);
    return allStores.filter((s) => assignedIds.includes(s.id));
  }, [allStores, isAdmin, adminInStore, currentUser, currentStore.id]);

  const filteredUsers = useMemo(() => {
    if (isAdmin) return users;
    if (adminInStore) {
      // Admin inside a Manager's store sees that store's team (the Manager
      // and their Cashiers) — not their own Admin account.
      const storeManagerId =
        allStores.find((s) => s.id === currentStore.id)?.managerId;
      return users.filter(
        (u) =>
          u.id === storeManagerId ||
          (u.role === "Cashier" &&
            (u.assignedStoreIds || []).includes(currentStore.id)),
      );
    }
    // Manager: see themselves + the Cashiers assigned to their own stores
    if (isManager) {
      const myStoreIds = currentUser?.assignedStoreIds || [];
      return users.filter(
        (u) =>
          u.id === currentUser?.id ||
          (u.role === "Cashier" &&
            (u.assignedStoreIds || []).some((sid) =>
              myStoreIds.includes(sid),
            )),
      );
    }
    // Cashier: only themselves
    const filtered = users.filter((u) => u.id === currentUser?.id);
    if (filtered.length === 0 && currentUser) {
      return [currentUser];
    }
    return filtered;
  }, [users, isAdmin, adminInStore, isManager, currentUser, currentStore.id, allStores]);

  // Ensure current store is valid for non-admin
  useEffect(() => {
    if (!isAdmin && !adminInStore && currentUser) {
      const assignedIds =
        currentUser.assignedStoreIds ||
        ((currentUser as any).assignedStoreId
          ? [(currentUser as any).assignedStoreId]
          : []);
      if (!assignedIds.includes(currentStore.id) && assignedIds.length > 0) {
        switchStore(assignedIds[0]);
      }
    }
  }, [isAdmin, adminInStore, currentUser, currentStore.id, switchStore]);

  const [activeTab, setActiveTab] = useState("profile");

  // --- Security States ---
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");

  const handleUpdatePassword = () => {
    if (!currentUser) return;

    // Validate current password
    if (currentPasswordInput !== currentUser.password) {
      toast.error("Incorrect current password");
      return;
    }

    // Validate new password
    if (newPasswordInput.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }
    if (!/(?=.*[0-9])(?=.*[a-zA-Z])/.test(newPasswordInput)) {
      toast.error(
        "New password must contain at least one number and one letter",
      );
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      toast.error("New passwords do not match");
      return;
    }

    updateUserPassword(currentUser.id, newPasswordInput);
    toast.success("Password updated successfully");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
  };

  // --- Store Profile States ---
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreType | null>(null);
  const [isDeleteStoreConfirmOpen, setIsDeleteStoreConfirmOpen] =
    useState(false);
  const [storeToDelete, setStoreToDelete] = useState<StoreType | null>(null);
  const [newStoreData, setNewStoreData] = useState<Partial<StoreType>>({
    name: "",
    code: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    tin: "",
    status: "Active",
  });

  // --- User Management States ---
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [isDeleteUserConfirmOpen, setIsDeleteUserConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string>("");
  const [resetPasswordNewPass, setResetPasswordNewPass] = useState<string>("");
  const [resetPasswordConfirmPass, setResetPasswordConfirmPass] = useState<string>("");

  const [newUserData, setNewUserData] = useState<Partial<UserType>>({
    name: "",
    email: "",
    phone: "",
    role: "Cashier",
    assignedStoreIds: [currentStore.id],
    status: "Active",
    password: "",
    zipCode: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCashierStorePickerOpen, setIsCashierStorePickerOpen] =
    useState(false);

  const availableStoresForAssignment = useMemo(() => {
    const managerStoreIds = !isAdmin
      ? adminInStore
        ? [currentStore.id]
        : currentUser?.assignedStoreIds || []
      : null;
    return allStores
      .filter((s) => s.id !== "S-ALL")
      .filter((store) => {
        if (store.isAdminStore) return false;
        if (managerStoreIds && !managerStoreIds.includes(store.id))
          return false;
        if (newUserData.role === "Admin") return false;
        if (newUserData.role === "Manager") {
          return !isStoreTakenByOtherUser(users, store.id, editingUser?.id, "Manager");
        }
        if (newUserData.role === "Cashier") {
          return Boolean(store.managerId);
        }
        return true;
      });
  }, [allStores, users, editingUser?.id, newUserData.role, isAdmin, currentUser, adminInStore, currentStore.id]);

  const storesWithManager = useMemo(() => {
    let base = allStores.filter(
      (s) => s.id !== "S-ALL" && s.managerId && !s.isAdminStore,
    );
    if (isManager) {
      const myStoreIds = adminInStore
        ? [currentStore.id]
        : currentUser?.assignedStoreIds || [];
      base = base.filter((s) => myStoreIds.includes(s.id));
    }
    return base;
  }, [allStores, isManager, currentUser, adminInStore, currentStore.id]);

  const getCashierManager = (userId: string) => {
    const store = allStores.find((s) =>
      (users.find((u) => u.id === userId)?.assignedStoreIds || []).includes(
        s.id,
      ),
    );
    if (!store?.managerId) return null;
    return users.find((u) => u.id === store.managerId) || null;
  };

  // --- Payment States ---
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  const [isAddPOSOpen, setIsAddPOSOpen] = useState(false);
  const [isDeleteBankConfirmOpen, setIsDeleteBankConfirmOpen] = useState(false);
  const [isDeletePOSConfirmOpen, setIsDeletePOSConfirmOpen] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<string | null>(null);
  const [posToDelete, setPosToDelete] = useState<string | null>(null);
  const [newBank, setNewBank] = useState({
    bankName: "",
    accountNumber: "",
    accountName: "",
    phoneNumber: "",
  });
  const [newPOS, setNewPOS] = useState({
    name: "",
    provider: "Moniepoint" as const,
    terminalId: "",
    merchantId: "",
    phoneNumber: "",
    deviceLocation: "",
  });
  const [paystackForm, setPaystackForm] = useState({
    publicKey: paymentSettings.paystack?.publicKey || "",
    secretKey: paymentSettings.paystack?.secretKey || "",
    businessEmail: paymentSettings.paystack?.businessEmail || "",
    subaccountCode: paymentSettings.paystack?.subaccountCode || "",
  });

  // --- Role Permission Logic ---
  const adminCount = users.filter((u) => u.role === "Admin").length;
  const managerCount = users.filter((u) => u.role === "Manager").length;

  const handleSaveStore = () => {
    if (
      !newStoreData.name ||
      !newStoreData.email ||
      !newStoreData.phone ||
      !newStoreData.zip
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newStoreData.zip && !/^\d{6}$/.test(newStoreData.zip)) {
      toast.error("Zip Code must be exactly 6 digits");
      return;
    }

    if (editingStore) {
      updateStoreProfile({ ...editingStore, ...newStoreData } as StoreType);
      toast.success("Store profile updated successfully");
    } else {
      const storeId = `S-${Date.now()}`;
      addStore({
        ...newStoreData,
        id: storeId,
        code: newStoreData.code || `STR-${allStores.length + 1}`.toUpperCase(),
        status: "Active",
      } as StoreType);
      toast.success("New store added successfully");
    }
    setIsStoreModalOpen(false);
    setEditingStore(null);
  };

  const handleSaveUser = () => {
    if (
      !newUserData.name ||
      !newUserData.email ||
      !newUserData.phone ||
      !newUserData.role
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newUserData.zipCode && !/^\d{6}$/.test(newUserData.zipCode)) {
      toast.error("Zip Code must be exactly 6 digits");
      return;
    }

    if (!editingUser) {
      if (!newUserData.password || newUserData.password.length < 8) {
        toast.error("Password must be at least 8 characters long");
        return;
      }
      if (newUserData.password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (!/(?=.*[0-9])(?=.*[a-zA-Z])/.test(newUserData.password)) {
        toast.error("Password must contain at least one number and one letter");
        return;
      }
    }

    if (newUserData.role !== "Admin") {
      const storeIds = newUserData.assignedStoreIds || [];
      if (storeIds.length !== 1) {
        toast.error("Each user must be assigned to exactly one store");
        return;
      }
      if (newUserData.role === "Manager" && isStoreTakenByOtherUser(users, storeIds[0], editingUser?.id, "Manager")) {
        toast.error("This store already has a Manager assigned.");
        return;
      }
      if (newUserData.role === "Cashier") {
        const storeHasManager = allStores.find((s) => s.id === storeIds[0])?.managerId;
        if (!storeHasManager) {
          toast.error("A Cashier can only be assigned to a store that has a Manager.");
          return;
        }
      }
    }

    if (editingUser) {
      const userPayload = {
        ...editingUser,
        ...newUserData,
        // The Admin role is permanent: an existing Admin can never be
        // demoted or reassigned.
        role: editingUser.role === "Admin" ? "Admin" : newUserData.role,
        assignedStoreIds:
          newUserData.role === "Admin"
            ? allStores.filter((s) => s.id !== "S-ALL").map((s) => s.id)
            : newUserData.assignedStoreIds,
      } as UserType;
      updateUser(userPayload);
      toast.success("User updated successfully");
    } else if (isManager) {
      addUser({
        ...newUserData,
        id: `U-${Date.now()}`,
        status: "Active",
        assignedStoreIds:
          newUserData.role === "Admin"
            ? allStores.filter((s) => s.id !== "S-ALL").map((s) => s.id)
            : newUserData.assignedStoreIds,
      } as UserType);
      toast.success(
        "Cashier created successfully",
      );
      setIsUserModalOpen(false);
      setEditingUser(null);
      return;
    } else {
      if (newUserData.role === "Admin" && adminCount >= 1) {
        toast.error(
          `Only one Admin allowed. The current Admin is ${users.find((u) => u.role === "Admin")?.name}.`,
        );
        return;
      }
      if (newUserData.role === "Manager" && managerCount >= 5) {
        toast.error("Maximum of 5 Managers allowed.");
        return;
      }

      addUser({
        ...newUserData,
        id: `U-${Date.now()}`,
        status: "Active",
        assignedStoreIds:
          newUserData.role === "Admin"
            ? allStores.filter((s) => s.id !== "S-ALL").map((s) => s.id)
            : newUserData.assignedStoreIds,
      } as UserType);
      toast.success("User account created successfully");
    }
    setIsUserModalOpen(false);
    setEditingUser(null);
  };

  const handleConfirmDeleteStore = () => {
    if (storeToDelete) {
      if (isAdmin) {
        deleteStore(storeToDelete.id);
        setIsDeleteStoreConfirmOpen(false);
        setStoreToDelete(null);
        toast.success("Store deleted successfully");
      } else if (isManager) {
        requestDeleteStore(storeToDelete.id);
        setIsDeleteStoreConfirmOpen(false);
        setStoreToDelete(null);
        toast.success(
          "Approval request sent to the Admin. The store will be deleted once approved.",
        );
      }
    }
  };

  const handleConfirmDeleteUser = () => {
    if (userToDelete) {
      deleteUser(userToDelete.id);
      setIsDeleteUserConfirmOpen(false);
      setUserToDelete(null);
      toast.success("User deleted successfully");
    }
  };

  const handleConfirmDeleteBank = () => {
    if (bankToDelete) {
      if (isAdmin) {
        deleteBankAccount(bankToDelete);
        setIsDeleteBankConfirmOpen(false);
        setBankToDelete(null);
        toast.success("Bank account deleted successfully");
      } else {
        const account = bankAccounts.find((a) => a.id === bankToDelete);
        submitLinkRequest({
          id: `REQ-DBA-${Date.now()}`,
          userId: currentUser!.id,
          userName: currentUser!.name,
          userRole: currentUser!.role,
          storeId: currentStore.id,
          type: "Bank",
          action: "delete",
          details: account
            ? {
                id: account.id,
                bankName: account.bankName,
                accountNumber: account.accountNumber,
                accountName: account.accountName,
              }
            : { id: bankToDelete, bankName: "Bank Account" },
          status: "Pending",
          timestamp: new Date().toISOString(),
        });
        setIsDeleteBankConfirmOpen(false);
        setBankToDelete(null);
        toast.info("Bank account deletion sent to your manager for approval");
      }
    }
  };

  const handleConfirmDeletePOS = () => {
    if (posToDelete) {
      if (isAdmin) {
        deletePOSTerminal(posToDelete);
        setIsDeletePOSConfirmOpen(false);
        setPosToDelete(null);
        toast.success("POS terminal deleted successfully");
      } else {
        const terminal = posTerminals.find((t) => t.id === posToDelete);
        submitLinkRequest({
          id: `REQ-DPOS-${Date.now()}`,
          userId: currentUser!.id,
          userName: currentUser!.name,
          userRole: currentUser!.role,
          storeId: currentStore.id,
          type: "POS",
          action: "delete",
          details: terminal
            ? {
                id: terminal.id,
                name: terminal.name,
                provider: terminal.provider,
                serialNumber: terminal.serialNumber,
              }
            : { id: posToDelete, name: "POS Terminal" },
          status: "Pending",
          timestamp: new Date().toISOString(),
        });
        setIsDeletePOSConfirmOpen(false);
        setPosToDelete(null);
        toast.info("POS terminal removal sent to your manager for approval");
      }
    }
  };

  const nigerianBanks = [
    "GTBank",
    "Zenith Bank",
    "Access Bank",
    "First Bank",
    "UBA",
    "Fidelity Bank",
    "Stanbic IBTC",
    "Polaris Bank",
    "Unity Bank",
    "Providus Bank",
    "Sterling Bank",
    "Union Bank",
    "Heritage Bank",
    "Wema Bank",
    "Keystone Bank",
    "Kuda Bank",
    "OPay",
    "PalmPay",
  ];

  const [bankSearch, setBankSearch] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);

  const filteredBanks = nigerianBanks.filter((b) =>
    b.toLowerCase().includes(bankSearch.toLowerCase()),
  );

  const handleAddBankAccount = async () => {
    if (!selectedBank || !newBank.accountNumber || !newBank.accountName) {
      toast.error("Please fill in bank name, account number, and account name");
      return;
    }
    if (!/^\d{10,11}$/.test(newBank.accountNumber)) {
      toast.error("Account number must be 10–11 digits");
      return;
    }
    if (!newBank.phoneNumber || !/^\d{11}$/.test(newBank.phoneNumber)) {
      toast.error("Phone number linked to account must be 11 digits");
      return;
    }

    setIsVerifyingBank(true);
    await new Promise((r) => setTimeout(r, 1500));

    const accountData = {
      id: `BA-${Date.now()}`,
      bankName: selectedBank,
      accountNumber: newBank.accountNumber,
      accountName: newBank.accountName,
      phoneNumber: newBank.phoneNumber,
      status: isAdmin ? "Verified" : "Pending",
    };

    if (isAdmin) {
      addBankAccount(accountData as any);
      toast.success("Account verified successfully. Linked to SellSync.");
    } else {
      submitLinkRequest({
        id: `REQ-BA-${Date.now()}`,
        userId: currentUser!.id,
        userName: currentUser!.name,
        userRole: currentUser!.role,
        storeId: currentStore.id,
        type: "Bank",
        action: "add",
        details: accountData,
        status: "Pending",
        timestamp: new Date().toISOString(),
      });
      toast.info("Bank link request submitted to your manager for approval");
    }

    setIsVerifyingBank(false);
    setIsAddBankOpen(false);
    setNewBank({
      bankName: "",
      accountNumber: "",
      accountName: "",
      phoneNumber: "",
    });
    setSelectedBank("");
  };

  const [isVerifyingPOS, setIsVerifyingPOS] = useState(false);

  const handleAddPOS = async () => {
    if (
      !newPOS.terminalId ||
      !newPOS.phoneNumber ||
      !newPOS.deviceLocation
    ) {
      toast.error("Please fill in all required POS terminal fields");
      return;
    }
    if (!/^\d{11}$/.test(newPOS.phoneNumber)) {
      toast.error("Phone number must be 11 digits");
      return;
    }

    setIsVerifyingPOS(true);
    await new Promise((r) => setTimeout(r, 1500));

    const terminalData = {
      id: `POS-${Date.now()}`,
      name: newPOS.deviceLocation || `${newPOS.provider} Terminal`,
      provider: newPOS.provider,
      terminalId: newPOS.terminalId,
      merchantId: newPOS.merchantId,
      phoneNumber: newPOS.phoneNumber,
      deviceLocation: newPOS.deviceLocation,
      serialNumber: newPOS.terminalId,
      status: isAdmin ? "Connected" : "Offline",
      lastUsed: new Date().toISOString(),
    };

    if (isAdmin) {
      addPOSTerminal(terminalData as any);
      toast.success(`${newPOS.provider} Terminal linked successfully`);
    } else {
      submitLinkRequest({
        id: `REQ-POS-${Date.now()}`,
        userId: currentUser!.id,
        userName: currentUser!.name,
        userRole: currentUser!.role,
        storeId: currentStore.id,
        type: "POS",
        action: "add",
        details: terminalData,
        status: "Pending",
        timestamp: new Date().toISOString(),
      });
      toast.info("Terminal link request submitted to your manager for approval");
    }

    setIsVerifyingPOS(false);
    setIsAddPOSOpen(false);
    setNewPOS({
      name: "",
      provider: "Moniepoint",
      terminalId: "",
      merchantId: "",
      phoneNumber: "",
      deviceLocation: "",
    });
  };

  const handleSavePaystack = () => {
    if (
      !paystackForm.publicKey ||
      !paystackForm.secretKey ||
      !paystackForm.businessEmail
    ) {
      toast.error("Public key, secret key, and business email are required");
      return;
    }
    const paystackData = {
      publicKey: paystackForm.publicKey,
      secretKey: paystackForm.secretKey,
      businessEmail: paystackForm.businessEmail,
      subaccountCode: paystackForm.subaccountCode || "",
    };
    if (isAdmin) {
      updatePaymentSettings({
        paystack: {
          ...paystackData,
          enabled: paymentSettings.paystack?.enabled ?? false,
        },
      });
      toast.success("Paystack integration settings saved");
    } else {
      submitLinkRequest({
        id: `REQ-PS-${Date.now()}`,
        userId: currentUser!.id,
        userName: currentUser!.name,
        userRole: currentUser!.role,
        storeId: currentStore.id,
        type: "Paystack",
        action: "add",
        details: paystackData,
        status: "Pending",
        timestamp: new Date().toISOString(),
      });
      toast.info(
        "Paystack integration submitted to your manager for approval",
      );
    }
  };

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-6 bg-gray-50/50 min-h-screen">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              System Settings
            </h1>
            <p className="text-sm text-gray-500">
              Manage your store configuration and preferences
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-white border border-gray-200 p-1 h-11 shadow-sm overflow-x-auto inline-flex whitespace-nowrap">
            <TabsTrigger
              value="profile"
              className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
            >
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              {isAdmin ? "Store Profile" : "My Store"}
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              {isAdmin
                ? "Users & Roles"
                : isManager
                  ? "Team & Cashiers"
                  : "My Profile"}
            </TabsTrigger>
            {isStaff && (
              <>
                <TabsTrigger
                  value="receipt"
                  className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
                >
                  <Receipt className="w-3.5 h-3.5 mr-1.5" />
                  Receipts
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  Payments
                </TabsTrigger>
              </>
            )}
            {!isAdmin && (
              <TabsTrigger
                value="prefs"
                className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                Preferences
              </TabsTrigger>
            )}
            {isManager && (
              <TabsTrigger
                value="approvals"
                className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Approvals
                {managerPendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[8px] font-black">
                    {managerPendingCount}
                  </span>
                )}
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger
                value="security"
                className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Security
              </TabsTrigger>
            )}
          </TabsList>

          <div className="mt-6">
            {/* --- Store Profile Tab --- */}
            <TabsContent value="profile" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-900">
                    {isAdmin ? "Store Locations" : "My Store Profile"}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    {isAdmin
                      ? "Manage multiple branches and warehouses"
                      : "View and manage your assigned store details"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStores.map((store) => (
                  <Card
                    key={store.id}
                    className="border-none shadow-sm rounded-2xl overflow-hidden bg-white hover:shadow-md transition-all group"
                  >
                    <CardContent className="p-0">
                      <div className="p-5 border-b border-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100/50 overflow-hidden">
                            {store.logo ? (
                              <img
                                src={store.logo}
                                alt="Logo"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Building2 className="w-5 h-5 text-indigo-600" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-gray-400 hover:text-indigo-600"
                              onClick={() => {
                                setEditingStore(store);
                                setNewStoreData(store);
                                setIsStoreModalOpen(true);
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {isAdmin && !store.isAdminStore && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-600"
                                onClick={() => {
                                  setStoreToDelete(store);
                                  setIsDeleteStoreConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-black text-gray-900">
                              {store.name}
                            </h3>
                            <Badge
                              className={`${store.status === "Active" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"} border-none font-black text-[9px] uppercase px-2 py-0.5 rounded-lg`}
                            >
                              {store.status}
                            </Badge>
                            {store.isAdminStore && (
                              <Badge className="bg-indigo-50 text-indigo-600 border-none font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
                                Oversight · Cannot be deleted
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {store.code}
                          </p>
                        </div>
                      </div>
                      <div className="p-5 space-y-2.5">
                        <div className="flex items-start gap-2.5 text-[11px] font-bold text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                          <p className="leading-tight">
                            {store.address}, {store.city}, {store.state}{" "}
                            {store.zip}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 text-[11px] font-bold text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <p>{store.phone}</p>
                        </div>
                        <div className="flex items-center gap-2.5 text-[11px] font-bold text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <p className="truncate">{store.email}</p>
                        </div>
                      </div>
                      {!isAdmin && currentStore.id !== store.id && (
                        <div className="px-5 pb-5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl font-black text-[10px] uppercase tracking-wider h-8"
                            onClick={() => switchStore(store.id)}
                          >
                            Switch to this Store
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Danger Zone: a Manager requests store deletion (Admin approves). */}
              {isManager && currentStore && !currentStore.isAdminStore && (
                <div className="rounded-2xl border border-red-100 bg-red-50/50 dark:bg-red-950/20 p-5">
                  <h3 className="text-sm font-black text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Danger Zone
                  </h3>
                  <p className="text-xs font-medium text-gray-500 mt-1.5">
                    Delete this store? Your request will be sent to the Admin
                    for approval. Once approved, the store, its Manager and all
                    its Cashiers will be permanently removed.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl border-red-200 text-red-600 hover:text-red-700 font-black text-[10px] uppercase tracking-wider h-9"
                    onClick={() => {
                      setStoreToDelete(currentStore);
                      setIsDeleteStoreConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete This Store
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* --- Users & Roles Tab --- */}
            <TabsContent value="users" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-900">
                    {isAdmin
                      ? "User Management"
                      : isManager
                        ? "Team & Cashiers"
                        : "My Profile"}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    {isAdmin
                      ? "Control system access levels and assignments"
                      : isManager
                        ? "Add Cashiers to your stores"
                        : "Manage your personal information and contact details"}
                  </p>
                </div>
                {isManager && (
                  <Button
                    onClick={() => {
                      setEditingUser(null);
                      const myStores = currentUser?.assignedStoreIds || [];
                      setNewUserData({
                        role: "Cashier",
                        assignedStoreIds:
                          myStores.length === 1
                            ? [myStores[0]]
                            : [currentStore.id],
                        status: "Active",
                      });
                      if (myStores.length === 1) {
                        setIsUserModalOpen(true);
                      } else {
                        setIsCashierStorePickerOpen(true);
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black text-xs h-10 shadow-lg shadow-indigo-100"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add Cashier
                  </Button>
                )}
              </div>

              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/50 hover:bg-transparent">
                          <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            User
                          </TableHead>
                          <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Role
                          </TableHead>
                          <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Assigned Store
                          </TableHead>
                          <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow
                            key={user.id}
                            className="hover:bg-gray-50/30 transition-colors border-b border-gray-50"
                          >
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100/50 overflow-hidden shrink-0">
                                  {user.profilePicture ? (
                                    <img
                                      src={user.profilePicture}
                                      alt="Avatar"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="font-black text-indigo-600 text-sm">
                                      {user.name[0]}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-gray-900 text-sm truncate">
                                    {user.name}
                                  </p>
                                  <p className="text-[10px] text-gray-400 font-bold truncate">
                                    {user.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <Badge
                                className={`${user.role === "Admin" ? "bg-purple-50 text-purple-700" : user.role === "Manager" ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"} border-none font-black text-[9px] uppercase px-2 py-0.5 rounded-lg`}
                              >
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {user.role === "Admin" ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-bold border-gray-100 text-gray-500 rounded-md bg-gray-50/50"
                                  >
                                    All Stores
                                  </Badge>
                                ) : (
                                  (user.assignedStoreIds || [])
                                    .slice(0, 1)
                                    .map((sid) => {
                                      const store = allStores.find(
                                        (s) => s.id === sid,
                                      );
                                      return (
                                        <Badge
                                          key={sid}
                                          variant="outline"
                                          className="text-[9px] font-bold border-gray-100 text-gray-500 rounded-md bg-gray-50/50"
                                        >
                                          {store?.name || store?.code || sid}
                                        </Badge>
                                      );
                                    })
                                )}
                                {user.role === "Cashier" &&
                                  getCashierManager(user.id) && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] font-bold border-indigo-100 text-indigo-600 rounded-md bg-indigo-50/60"
                                    >
                                      Under {getCashierManager(user.id)?.name}
                                    </Badge>
                                  )}
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {(isAdmin ||
                                  user.id === currentUser?.id ||
                                  (isManager &&
                                    user.role === "Cashier")) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-gray-400 hover:text-indigo-600"
                                    onClick={() => {
                                      setEditingUser(user);
                                      setNewUserData(user);
                                      setIsUserModalOpen(true);
                                    }}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-600"
                                    disabled={user.role === "Admin"}
                                    onClick={() => {
                                      setUserToDelete(user);
                                      setIsDeleteUserConfirmOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Receipts Tab --- */}
            <TabsContent value="receipt" className="space-y-6">
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardHeader className="p-6 border-b border-gray-50">
                  <CardTitle className="text-lg font-black flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-indigo-600" /> Receipt &
                    Alert Defaults
                  </CardTitle>
                  <CardDescription className="font-medium text-gray-500">
                    Configure where system reports and critical alerts are sent.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  {/* Reports & Alerts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                          Default Report Email
                        </Label>
                        <Input
                          value={receiptDefaults.email}
                          onChange={(e) =>
                            setReceiptDefaults({
                              ...receiptDefaults,
                              email: e.target.value,
                            })
                          }
                          className="h-12 rounded-xl bg-gray-50/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold"
                          placeholder="zanchi@sellsync.com"
                        />
                        <p className="text-[10px] text-gray-400 font-medium px-1">
                          Daily sales reports and inventory analytics will be
                          sent here.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                            Report Schedule
                          </Label>
                          <Select
                            value={receiptDefaults.reportSchedule}
                            onValueChange={(v: any) =>
                              setReceiptDefaults({
                                ...receiptDefaults,
                                reportSchedule: v,
                              })
                            }
                          >
                            <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem
                                value="Daily"
                                className="font-bold text-xs"
                              >
                                Daily
                              </SelectItem>
                              <SelectItem
                                value="Weekly"
                                className="font-bold text-xs"
                              >
                                Weekly
                              </SelectItem>
                              <SelectItem
                                value="Monthly"
                                className="font-bold text-xs"
                              >
                                Monthly
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                            Daily Report Time
                          </Label>
                          <Input
                            type="time"
                            value={receiptDefaults.reportTime}
                            onChange={(e) =>
                              setReceiptDefaults({
                                ...receiptDefaults,
                                reportTime: e.target.value,
                              })
                            }
                            className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                          Critical Alert Phone
                        </Label>
                        <Input
                          value={receiptDefaults.phone}
                          onChange={(e) =>
                            setReceiptDefaults({
                              ...receiptDefaults,
                              phone: e.target.value,
                            })
                          }
                          className="h-12 rounded-xl bg-gray-50/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold"
                          placeholder="080 000 0000"
                        />
                        <p className="text-[10px] text-gray-400 font-medium px-1">
                          Urgent expiry alerts and stockouts will be notified
                          via SMS.
                        </p>
                      </div>
                      <div className="space-y-2 pt-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                          Alert Frequency
                        </Label>
                        <Select
                          value={receiptDefaults.alertFrequency}
                          onValueChange={(v: any) =>
                            setReceiptDefaults({
                              ...receiptDefaults,
                              alertFrequency: v,
                            })
                          }
                        >
                          <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem
                              value="Real-time"
                              className="font-bold text-xs"
                            >
                              Real-time (Immediate)
                            </SelectItem>
                            <SelectItem
                              value="Daily Summary"
                              className="font-bold text-xs"
                            >
                              Daily Summary
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Messages Section */}
                  <div className="pt-8 border-t border-gray-50">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Type className="w-4 h-4 text-indigo-600" />
                      Custom Receipt Messages
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Receipt Header Message
                          </Label>
                          <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                            Optional
                          </span>
                        </div>
                        <textarea
                          value={receiptDefaults.header || ""}
                          onChange={(e) =>
                            setReceiptDefaults({
                              ...receiptDefaults,
                              header: e.target.value,
                            })
                          }
                          className="w-full min-h-[100px] p-4 rounded-2xl bg-gray-50/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm resize-none"
                          placeholder="e.g., Welcome to our store! Quality products at affordable prices."
                        />
                        <p className="text-[10px] text-gray-400 font-medium px-1">
                          This appears at the top of every receipt.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Receipt Footer Message
                          </Label>
                          <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                            Optional
                          </span>
                        </div>
                        <textarea
                          value={receiptDefaults.footer || ""}
                          onChange={(e) =>
                            setReceiptDefaults({
                              ...receiptDefaults,
                              footer: e.target.value,
                            })
                          }
                          className="w-full min-h-[100px] p-4 rounded-2xl bg-gray-50/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm resize-none"
                          placeholder="e.g., Thank you for shopping with us! See you again soon."
                        />
                        <p className="text-[10px] text-gray-400 font-medium px-1">
                          This appears at the bottom of every receipt.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-gray-50 mt-8">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Return / Exchange Message
                          </Label>
                          <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                            Optional
                          </span>
                        </div>
                        <textarea
                          value={receiptDefaults.returnPolicy || ""}
                          onChange={(e) =>
                            setReceiptDefaults({
                              ...receiptDefaults,
                              returnPolicy: e.target.value,
                            })
                          }
                          className="w-full min-h-[100px] p-4 rounded-2xl bg-gray-50/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm resize-none"
                          placeholder="e.g., Exchange allowed within 48 hours with receipt."
                        />
                        <p className="text-[10px] text-gray-400 font-medium px-1">
                          This policy appears only when the return-policy toggle
                          is enabled below.
                        </p>
                      </div>
                    </div>
                  </div>

                  {canEdit("Settings") && (
                    <div className="flex justify-end pt-4">
                      <Button
                        onClick={() =>
                          toast.success("Receipt and notification settings saved")
                        }
                        className="h-12 px-10 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black text-xs shadow-lg shadow-indigo-100 transition-all active:scale-95"
                      >
                        Save All Receipt Settings
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Payments Tab --- */}
            <TabsContent value="payments" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Linked Bank Accounts Card */}
                <Card className="border-none shadow-xl shadow-purple-900/5 rounded-[2.5rem] overflow-hidden bg-white border border-purple-50">
                  <CardHeader className="p-8 border-b border-purple-50 bg-gradient-to-r from-purple-50/30 to-transparent">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-black flex items-center gap-3 text-purple-900">
                          <div className="p-2.5 bg-purple-100 rounded-2xl text-purple-600">
                            <Building2 className="w-6 h-6" />
                          </div>
                          Linked Bank Accounts
                        </CardTitle>
                        <CardDescription className="font-bold text-purple-600/60 text-[11px] uppercase tracking-widest mt-1.5 ml-12">
                          Manage settlement destinations
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddBankOpen(true)}
                        className="rounded-xl border-purple-100 text-purple-600 hover:bg-purple-50 font-black text-[10px] uppercase tracking-wider h-9"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add Bank
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      {bankAccounts.length > 0 ? (
                        bankAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="group relative flex items-center justify-between p-5 bg-gray-50/50 hover:bg-purple-50/30 rounded-3xl border border-gray-100 hover:border-purple-100 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm group-hover:scale-110 transition-transform">
                                <Building2 className="w-6 h-6 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-gray-900">
                                  {account.bankName}
                                </p>
                                <p className="text-xs font-bold text-gray-500 tracking-tight">
                                  {account.accountNumber} •{" "}
                                  {account.accountName}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    className={`${account.status === "Verified" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"} border-none font-black text-[8px] uppercase px-1.5 py-0 rounded-md`}
                                  >
                                    {account.status}
                                  </Badge>
                                  {account.lastSettlement && (
                                    <span className="text-[9px] font-bold text-gray-400">
                                      Settled:{" "}
                                      {new Date(
                                        account.lastSettlement,
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setBankToDelete(account.id);
                                setIsDeleteBankConfirmOpen(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-[2rem]">
                          <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                            No bank accounts linked
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* POS Terminals Card */}
                <Card className="border-none shadow-xl shadow-purple-900/5 rounded-[2.5rem] overflow-hidden bg-white border border-purple-50">
                  <CardHeader className="p-8 border-b border-purple-50 bg-gradient-to-r from-purple-50/30 to-transparent">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-black flex items-center gap-3 text-purple-900">
                          <div className="p-2.5 bg-purple-100 rounded-2xl text-purple-600">
                            <Smartphone className="w-6 h-6" />
                          </div>
                          POS Terminals
                        </CardTitle>
                        <CardDescription className="font-bold text-purple-600/60 text-[11px] uppercase tracking-widest mt-1.5 ml-12">
                          Connect hardware for card payments
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddPOSOpen(true)}
                        className="rounded-xl border-purple-100 text-purple-600 hover:bg-purple-50 font-black text-[10px] uppercase tracking-wider h-9"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add Terminal
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      {posTerminals.length > 0 ? (
                        posTerminals.map((pos) => (
                          <div
                            key={pos.id}
                            className="group relative flex items-center justify-between p-5 bg-gray-50/50 hover:bg-purple-50/30 rounded-3xl border border-gray-100 hover:border-purple-100 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm group-hover:scale-110 transition-transform">
                                <Smartphone className="w-6 h-6 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-gray-900">
                                  {pos.name}
                                </p>
                                <p className="text-xs font-bold text-gray-500 tracking-tight">
                                  {pos.provider} • SN:{" "}
                                  {pos.serialNumber || "N/A"}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    className={`${pos.status === "Connected" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"} border-none font-black text-[8px] uppercase px-1.5 py-0 rounded-md`}
                                  >
                                    {pos.status}
                                  </Badge>
                                  {pos.lastUsed && (
                                    <span className="text-[9px] font-bold text-gray-400">
                                      Last used:{" "}
                                      {new Date(
                                        pos.lastUsed,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setPosToDelete(pos.id);
                                setIsDeletePOSConfirmOpen(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-[2rem]">
                          <Smartphone className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                            No terminals linked
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cashier: Payment Request Status */}
              {isStaff && (
                <Card className="border-none shadow-xl shadow-purple-900/5 rounded-[2.5rem] overflow-hidden bg-white border border-purple-50">
                  <CardHeader className="p-8 border-b border-purple-50 bg-gradient-to-r from-purple-50/30 to-transparent">
                    <CardTitle className="text-xl font-black flex items-center gap-3 text-purple-900">
                      <div className="p-2.5 bg-purple-100 rounded-2xl text-purple-600">
                        <Clock className="w-6 h-6" />
                      </div>
                      Your Payment Requests
                    </CardTitle>
                    <CardDescription className="font-bold text-purple-600/60 text-[11px] uppercase tracking-widest mt-1.5 ml-12">
                      Sent to your manager — starts working once approved
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    {myRequests.length > 0 ? (
                      <div className="space-y-4">
                        {myRequests.map((req) => (
                          <div
                            key={req.id}
                            className="group relative flex flex-col md:flex-row md:items-center justify-between p-5 bg-gray-50/50 rounded-3xl border border-gray-100 gap-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm">
                                {req.type === "Bank" ? (
                                  <Building2 className="w-6 h-6 text-purple-600" />
                                ) : req.type === "POS" ? (
                                  <Smartphone className="w-6 h-6 text-purple-600" />
                                ) : (
                                  <Globe className="w-6 h-6 text-purple-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-black text-gray-900">
                                  {req.action === "delete"
                                    ? req.type === "Bank"
                                      ? `Delete Bank Account — ${req.details.bankName}`
                                      : req.type === "POS"
                                        ? `Delete POS Terminal — ${req.details.name} (${req.details.provider})`
                                        : "Remove Paystack Integration"
                                    : req.type === "Bank"
                                      ? `Link Bank Account — ${req.details.bankName}`
                                      : req.type === "POS"
                                        ? `Link POS Terminal — ${req.details.name} (${req.details.provider})`
                                        : `Set up Paystack Integration — ${req.details.businessEmail}`}
                                </p>
                                <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                                  Submitted{" "}
                                  {new Date(req.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-start md:items-end gap-1">
                              <Badge
                                className={`${req.status === "Pending" ? "bg-yellow-50 text-yellow-600" : req.status === "Approved" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"} border-none font-black text-[9px] uppercase px-2.5 py-1 rounded-md`}
                              >
                                {req.status === "Pending"
                                  ? "Waiting for manager approval"
                                  : req.status === "Approved"
                                    ? req.action === "delete"
                                      ? "Approved — removed"
                                      : "Approved — active"
                                    : "Denied by manager"}
                              </Badge>
                              {req.status === "Rejected" &&
                                req.rejectionReason && (
                                  <span className="text-[10px] font-bold text-gray-400">
                                    {req.rejectionReason}
                                  </span>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-[2rem]">
                        <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                          No payment requests yet
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1">
                          Add a bank, terminal, or Paystack above and it will
                          appear here for your manager to approve.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Payment Methods Section */}
              <Card className="border-none shadow-xl shadow-purple-900/5 rounded-[3rem] overflow-hidden bg-white border border-purple-50">
                <CardHeader className="p-10 border-b border-purple-50 bg-gradient-to-br from-purple-50/20 to-transparent">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-black flex items-center gap-4 text-purple-900">
                        <div className="p-3 bg-purple-600 rounded-[1.5rem] text-white shadow-lg shadow-purple-200">
                          <CreditCard className="w-7 h-7" />
                        </div>
                        Payment Methods
                      </CardTitle>
                      <p className="font-bold text-purple-600/60 text-sm tracking-tight ml-16">
                        Enable or disable payment options available at POS
                      </p>
                    </div>
                    <Badge className="w-fit bg-purple-100 text-purple-700 border-none font-black text-[10px] uppercase px-4 py-2 rounded-full">
                      Global Settings
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                    {[
                      {
                        label: "Physical Cash",
                        key: "allowCash",
                        desc: "Accept physical cash at the counter",
                        icon: Banknote,
                        color: "emerald",
                      },
                      {
                        label: "Card / Terminal",
                        key: "allowCard",
                        desc: "Accept card payments via POS terminal",
                        icon: Smartphone,
                        color: "blue",
                      },
                      {
                        label: "Bank Transfer",
                        key: "allowTransfer",
                        desc: "Accept direct wire/bank transfers",
                        icon: Wallet,
                        color: "purple",
                      },
                      {
                        label: "Pay with Transfer",
                        key: "enablePayWithTransfer",
                        desc: "Virtual bank account for transfers",
                        icon: Send,
                        color: "indigo",
                      },
                      {
                        label: "Paystack Online",
                        key: "allowPaystack",
                        desc: "Online payments via Paystack",
                        icon: Globe,
                        color: "cyan",
                      },
                    ].map((opt) => (
                      <div
                        key={opt.key}
                        className="group relative flex flex-col p-8 bg-gray-50/50 hover:bg-white rounded-[2.5rem] border border-gray-100 hover:border-purple-200 transition-all hover:shadow-2xl hover:shadow-purple-900/5"
                      >
                        <div className="flex items-start justify-between mb-8">
                          <div
                            className={`p-4 rounded-3xl bg-${opt.color}-50 text-${opt.color}-600 group-hover:scale-110 transition-transform`}
                          >
                            <opt.icon className="w-8 h-8" />
                          </div>
                          <Switch
                            checked={(paymentSettings as any)[opt.key]}
                            onCheckedChange={(v) => {
                              updatePaymentSettings({ [opt.key]: v });
                              if (currentUser?.role === "Admin" && adminOverview) {
                                toast.success(
                                  `${opt.label} ${v ? "Enabled" : "Disabled"}`,
                                );
                              } else {
                                toast.info(
                                  `${opt.label} toggle submitted for Admin approval`,
                                );
                              }
                            }}
                            className="data-[state=checked]:bg-purple-600 scale-125"
                          />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-lg font-black text-gray-900">
                            {opt.label}
                          </h4>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Admin Approvals Section (Existing) */}
              {isAdmin &&
                linkingRequests.filter((r) => r.status === "Pending").length >
                  0 && (
                  <Card className="border-none shadow-2xl shadow-purple-900/10 rounded-[3rem] overflow-hidden bg-white border-2 border-purple-100">
                    <CardHeader className="p-10 border-b border-purple-50 bg-purple-50/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl font-black flex items-center gap-4 text-purple-900">
                            <div className="p-3 bg-purple-100 rounded-2xl text-purple-600">
                              <ShieldCheck className="w-7 h-7" />
                            </div>
                            Pending Link Approvals
                          </CardTitle>
                          <CardDescription className="font-bold text-purple-600/60 text-xs uppercase tracking-widest mt-2 ml-16">
                            Review requests from Managers & Staff
                          </CardDescription>
                        </div>
                        <Badge className="bg-purple-600 text-white border-none font-black text-[11px] px-5 py-2 rounded-full animate-bounce">
                          {
                            linkingRequests.filter(
                              (r) => r.status === "Pending",
                            ).length
                          }{" "}
                          New
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-10">
                      <div className="space-y-6">
                        {linkingRequests
                          .filter((r) => r.status === "Pending")
                          .map((req) => (
                            <div
                              key={req.id}
                              className="flex flex-col md:flex-row md:items-center justify-between p-8 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 gap-8"
                            >
                              <div className="flex items-start gap-6">
                                <div
                                  className={`w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 ${req.type === "Bank" ? "bg-blue-100 text-blue-600" : req.type === "POS" ? "bg-purple-100 text-purple-600" : "bg-cyan-100 text-cyan-600"}`}
                                >
                                  {req.type === "Bank" ? (
                                    <Building2 className="w-8 h-8" />
                                  ) : req.type === "POS" ? (
                                    <Smartphone className="w-8 h-8" />
                                  ) : (
                                    <Globe className="w-8 h-8" />
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3">
                                    <p className="text-lg font-black text-gray-900">
                                      {req.userName}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg border-gray-200 text-gray-400"
                                    >
                                      {req.userRole}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-bold text-gray-500">
                                    {req.action === "delete"
                                      ? "Requested to delete a "
                                      : "Requested to link a new "}
                                    {req.type === "Bank"
                                      ? "Bank Account"
                                      : req.type === "POS"
                                        ? "POS Terminal"
                                        : "Paystack Integration"}
                                  </p>
                                  <div className="mt-4 p-5 bg-white rounded-[1.5rem] border border-gray-100 space-y-2">
                                    {req.type === "Bank" ? (
                                      <>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                          Bank Details
                                        </p>
                                        <p className="text-sm font-black text-gray-900">
                                          {req.details.bankName} •{" "}
                                          {req.details.accountNumber}
                                        </p>
                                        <p className="text-xs font-bold text-gray-500">
                                          {req.details.accountName}
                                        </p>
                                      </>
                                    ) : req.type === "POS" ? (
                                      <>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                          Terminal Details
                                        </p>
                                        <p className="text-sm font-black text-gray-900">
                                          {req.details.name} (
                                          {req.details.provider})
                                        </p>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                          SN: {req.details.serialNumber}
                                        </p>
                                      </>
                                    ) : (
                                      <>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                          Paystack Details
                                        </p>
                                        <p className="text-sm font-black text-gray-900">
                                          {req.details.businessEmail}
                                        </p>
                                        <p className="text-xs font-bold text-gray-500">
                                          Public key:{" "}
                                          {req.details.publicKey
                                            ? `${req.details.publicKey.slice(0, 10)}••••••`
                                            : "N/A"}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <Button
                                  variant="outline"
                                  className="h-14 px-8 rounded-2xl font-black text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-gray-200 transition-all"
                                  onClick={() => {
                                    const reason = prompt(
                                      "Enter rejection reason (optional):",
                                    );
                                    rejectLinkRequest(
                                      req.id,
                                      reason || "Request denied by Admin",
                                    );
                                    toast.error("Request rejected");
                                  }}
                                >
                                  Reject
                                </Button>
                                <Button
                                  className="h-14 px-10 rounded-2xl bg-purple-600 hover:bg-purple-700 font-black text-xs shadow-xl shadow-purple-200 transition-all active:scale-95"
                                  onClick={() => {
                                    approveLinkRequest(req.id);
                                    toast.success(
                                      "Request approved and linked successfully",
                                    );
                                  }}
                                >
                                  Approve & Link
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

              {/* Paystack Integration */}
              <Card className="border-none shadow-xl shadow-purple-900/5 rounded-[2.5rem] overflow-hidden bg-white border border-purple-50">
                <CardHeader className="p-8 border-b border-purple-50 bg-gradient-to-r from-purple-50/30 to-transparent">
                  <CardTitle className="text-xl font-black flex items-center gap-3 text-purple-900">
                    <div className="p-2.5 bg-purple-100 rounded-2xl text-purple-600">
                      <Globe className="w-6 h-6" />
                    </div>
                    Paystack Integration (Online Payment)
                  </CardTitle>
                  <CardDescription className="font-bold text-purple-600/60 text-[11px] uppercase tracking-widest mt-1.5 ml-12">
                    Connect Paystack for online checkout at POS
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                        Paystack Public Key
                      </Label>
                      <Input
                        value={paystackForm.publicKey}
                        onChange={(e) =>
                          setPaystackForm({
                            ...paystackForm,
                            publicKey: e.target.value,
                          })
                        }
                        placeholder="pk_live_..."
                        className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                        Paystack Secret Key
                      </Label>
                      <Input
                        type="password"
                        value={paystackForm.secretKey}
                        onChange={(e) =>
                          setPaystackForm({
                            ...paystackForm,
                            secretKey: e.target.value,
                          })
                        }
                        placeholder="sk_live_..."
                        className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                        Business Email
                      </Label>
                      <Input
                        type="email"
                        value={paystackForm.businessEmail}
                        onChange={(e) =>
                          setPaystackForm({
                            ...paystackForm,
                            businessEmail: e.target.value,
                          })
                        }
                        placeholder="business@yourstore.com"
                        className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                        Subaccount Code (Optional)
                      </Label>
                      <Input
                        value={paystackForm.subaccountCode}
                        onChange={(e) =>
                          setPaystackForm({
                            ...paystackForm,
                            subaccountCode: e.target.value,
                          })
                        }
                        placeholder="ACCT_..."
                        className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSavePaystack}
                      className="h-12 px-8 bg-purple-600 hover:bg-purple-700 rounded-xl font-black text-xs"
                    >
                      Save Paystack Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Manager Approvals Tab --- */}
            {isManager && (
              <TabsContent value="approvals" className="space-y-6">
                <Card className="border-none shadow-2xl shadow-purple-900/10 rounded-[3rem] overflow-hidden bg-white border-2 border-purple-100">
                  <CardHeader className="p-10 border-b border-purple-50 bg-purple-50/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-black flex items-center gap-4 text-purple-900">
                          <div className="p-3 bg-purple-100 rounded-2xl text-purple-600">
                            <ShieldCheck className="w-7 h-7" />
                          </div>
                          Pending Approvals
                        </CardTitle>
                        <CardDescription className="font-bold text-purple-600/60 text-xs uppercase tracking-widest mt-2 ml-16">
                          Review payment requests sent to you by your cashiers
                        </CardDescription>
                      </div>
                      <Badge className="bg-purple-600 text-white border-none font-black text-[11px] px-5 py-2 rounded-full">
                        {managerPendingCount} Pending
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-10">
                    {managerPendingCount > 0 ? (
                      <div className="space-y-6">
                        {linkingRequests
                          .filter((r) => r.status === "Pending")
                          .map((req) => (
                            <div
                              key={req.id}
                              className="flex flex-col md:flex-row md:items-center justify-between p-8 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 gap-8"
                            >
                              <div className="flex items-start gap-6">
                                <div
                                  className={`w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 ${req.type === "Bank" ? "bg-blue-100 text-blue-600" : req.type === "POS" ? "bg-purple-100 text-purple-600" : "bg-cyan-100 text-cyan-600"}`}
                                >
                                  {req.type === "Bank" ? (
                                    <Building2 className="w-8 h-8" />
                                  ) : req.type === "POS" ? (
                                    <Smartphone className="w-8 h-8" />
                                  ) : (
                                    <Globe className="w-8 h-8" />
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3">
                                    <p className="text-lg font-black text-gray-900">
                                      {req.userName}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg border-gray-200 text-gray-400"
                                    >
                                      {req.userRole}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-bold text-gray-500">
                                    {req.action === "delete"
                                      ? req.type === "Bank"
                                        ? "Requested to delete a Bank Account"
                                        : req.type === "POS"
                                          ? "Requested to delete a POS Terminal"
                                          : "Requested to remove Paystack integration"
                                      : req.type === "Bank"
                                        ? "Requested to link a new Bank Account"
                                        : req.type === "POS"
                                          ? "Requested to link a new POS Terminal"
                                          : "Requested to set up Paystack integration"}
                                  </p>
                                  <div className="mt-4 p-5 bg-white rounded-[1.5rem] border border-gray-100 space-y-2">
                                    {req.type === "Bank" ? (
                                      <>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                          Bank Details
                                        </p>
                                        <p className="text-sm font-black text-gray-900">
                                          {req.details.bankName} •{" "}
                                          {req.details.accountNumber}
                                        </p>
                                        <p className="text-xs font-bold text-gray-500">
                                          {req.details.accountName}
                                        </p>
                                      </>
                                    ) : req.type === "POS" ? (
                                      <>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                          Terminal Details
                                        </p>
                                        <p className="text-sm font-black text-gray-900">
                                          {req.details.name} (
                                          {req.details.provider})
                                        </p>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                          SN: {req.details.serialNumber}
                                        </p>
                                      </>
                                    ) : (
                                      <>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                          Paystack Details
                                        </p>
                                        <p className="text-sm font-black text-gray-900">
                                          {req.details.businessEmail}
                                        </p>
                                        <p className="text-xs font-bold text-gray-500">
                                          Public key:{" "}
                                          {req.details.publicKey
                                            ? `${req.details.publicKey.slice(0, 10)}••••••`
                                            : "N/A"}
                                        </p>
                                        <p className="text-xs font-bold text-purple-500">
                                          Will be enabled as soon as you approve.
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <Button
                                  variant="outline"
                                  className="h-14 px-8 rounded-2xl font-black text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-gray-200 transition-all"
                                  onClick={() => {
                                    const reason = prompt(
                                      "Enter denial reason (optional):",
                                    );
                                    rejectLinkRequest(
                                      req.id,
                                      reason || "Denied by manager",
                                    );
                                    toast.error("Request denied");
                                  }}
                                >
                                  Deny
                                </Button>
                                <Button
                                  className="h-14 px-10 rounded-2xl bg-purple-600 hover:bg-purple-700 font-black text-xs shadow-xl shadow-purple-200 transition-all active:scale-95"
                                  onClick={() => {
                                    approveLinkRequest(req.id);
                                    toast.success(
                                      req.action === "delete"
                                        ? "Approved — request carried out and removed"
                                        : req.type === "Paystack"
                                          ? "Approved — Paystack integration is now active"
                                          : "Approved — now linked and working",
                                    );
                                  }}
                                >
                                  {req.action === "delete"
                                    ? "Approve & Remove"
                                    : "Approve & Link"}
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-14 border-2 border-dashed border-gray-100 rounded-[2rem]">
                        <ShieldCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                          No pending requests
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1">
                          When a cashier requests to add a bank, terminal, or
                          Paystack, it will appear here for your approval.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* --- Preferences Tab --- */}
            <TabsContent value="prefs" className="space-y-6">
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-2 space-y-6">
                <div className="p-6 rounded-[2rem] bg-[#EFF6FF] border border-blue-100/50 space-y-6">
                  <div>
                    <h2 className="text-lg font-black text-gray-900">
                      App Preferences
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      Configure notifications
                      {isStaff ? ", receipts," : ""} and display options
                    </p>
                  </div>

                  <Card className="border-none shadow-sm rounded-2xl bg-white">
                    <CardHeader className="p-6 border-b border-gray-50">
                      <CardTitle className="text-base font-black flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        Date & Time
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Date Format
                        </Label>
                        <Select
                          value={preferences.dateFormat}
                          onValueChange={(v: Preferences["dateFormat"]) =>
                            updatePreferences({
                              ...preferences,
                              dateFormat: v,
                            })
                          }
                        >
                          <SelectTrigger className="h-12 rounded-xl bg-gray-50 border-none font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Time Format
                        </Label>
                        <Select
                          value={preferences.timeFormat}
                          onValueChange={(v: Preferences["timeFormat"]) =>
                            updatePreferences({
                              ...preferences,
                              timeFormat: v,
                            })
                          }
                        >
                          <SelectTrigger className="h-12 rounded-xl bg-gray-50 border-none font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="12h">12-Hour (AM/PM)</SelectItem>
                            <SelectItem value="24h">24-Hour</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                          <p className="text-sm font-black text-gray-900">
                            Thousand Separators
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold">
                            Format large numbers with commas (e.g. 1,000)
                          </p>
                        </div>
                        <Switch
                          checked={preferences.numberFormatting}
                          onCheckedChange={(v) =>
                            updatePreferences({
                              ...preferences,
                              numberFormatting: v,
                            })
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm rounded-2xl bg-white">
                    <CardHeader className="p-6 border-b border-gray-50">
                      <CardTitle className="text-base font-black flex items-center gap-2">
                        <Bell className="w-5 h-5 text-indigo-600" />
                        Notification Preferences
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                      {[
                        {
                          label: "Email Alerts",
                          key: "email",
                          desc: "Daily sales reports and inventory summaries",
                        },
                        {
                          label: "SMS Alerts",
                          key: "sms",
                          desc: "Critical stock and expiry alerts via SMS",
                        },
                        {
                          label: "In-App Alerts",
                          key: "inApp",
                          desc: "Notifications in the bell icon and Notifications tab",
                        },
                        {
                          label: "Expiry Alerts",
                          key: "expiryAlerts",
                          desc: "Alerts 30, 7, and 1 day before product expiry",
                        },
                      ].map((n) => (
                        <div
                          key={n.key}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                        >
                          <div>
                            <p className="text-sm font-black text-gray-900">
                              {n.label}
                            </p>
                            <p className="text-[10px] text-gray-400 font-bold">
                              {n.desc}
                            </p>
                          </div>
                          <Switch
                            checked={
                              (preferences?.notifications as Record<
                                string,
                                boolean
                              >)?.[n.key] || false
                            }
                            onCheckedChange={(v) => {
                              updatePreferences({
                                ...preferences,
                                notifications: {
                                  ...preferences?.notifications,
                                  [n.key]: v,
                                },
                              });
                            }}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {isStaff && (
                    <Card className="border-none shadow-sm rounded-2xl bg-white">
                      <CardHeader className="p-6 border-b border-gray-50">
                        <CardTitle className="text-base font-black flex items-center gap-2">
                          <Receipt className="w-5 h-5 text-indigo-600" />
                          Receipt Preferences
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-3">
                        {[
                          {
                            label: "Show Store Logo",
                            key: "showLogo",
                            desc: "Display store logo on printed receipts",
                          },
                          {
                            label: "Show Expiry Date",
                            key: "showExpiry",
                            desc: "Print expiry date per item when available",
                          },
                          {
                            label: "Show Return Policy",
                            key: "showReturnPolicy",
                            desc: "Display return policy message on receipt footer",
                          },
                        ].map((r) => (
                          <div
                            key={r.key}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                          >
                            <div>
                              <p className="text-sm font-black text-gray-900">
                                {r.label}
                              </p>
                              <p className="text-[10px] text-gray-400 font-bold">
                                {r.desc}
                              </p>
                            </div>
                            <Switch
                              checked={
                                (preferences?.receipts as Record<
                                  string,
                                  boolean
                                >)?.[r.key] || false
                              }
                              onCheckedChange={(v) => {
                                updatePreferences({
                                  ...preferences,
                                  receipts: {
                                    ...preferences?.receipts,
                                    [r.key]: v,
                                  },
                                });
                              }}
                            />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                </div>
              </div>
            </TabsContent>

            {/* --- Security Tab --- */}
            <TabsContent value="security" className="space-y-6">
              {isAdmin ? (
                <>
                  {/* Admin Own Password Change */}
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                    <CardHeader className="p-6 border-b border-gray-50">
                      <CardTitle className="text-lg font-black flex items-center gap-2">
                        <Lock className="w-5 h-5 text-indigo-600" /> My Password
                      </CardTitle>
                      <CardDescription className="font-medium text-gray-500">
                        Update your own account password.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-4 max-w-md">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                            Current Password
                          </Label>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            className="h-12 rounded-xl bg-gray-50/50 border-none font-bold"
                            value={currentPasswordInput}
                            onChange={(e) =>
                              setCurrentPasswordInput(e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                            New Password
                          </Label>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            className="h-12 rounded-xl bg-gray-50/50 border-none font-bold"
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                          />
                          <p className="text-[10px] text-gray-400 font-medium px-1">
                            Min 8 characters, at least 1 number and 1 letter.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                            Confirm New Password
                          </Label>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            className="h-12 rounded-xl bg-gray-50/50 border-none font-bold"
                            value={confirmPasswordInput}
                            onChange={(e) =>
                              setConfirmPasswordInput(e.target.value)
                            }
                          />
                        </div>
                        <Button
                          onClick={handleUpdatePassword}
                          className="h-12 w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black text-xs mt-4 shadow-lg shadow-indigo-100"
                        >
                          Update My Password
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Admin: Reset User Passwords */}
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                    <CardHeader className="p-6 border-b border-gray-50">
                      <CardTitle className="text-lg font-black flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" /> Reset User Password
                      </CardTitle>
                      <CardDescription className="font-medium text-gray-500">
                        Select a user and set a new password. They will need to log in again with the new credentials.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-4 max-w-md">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                            Select User
                          </Label>
                          <Select value={resetPasswordUserId} onValueChange={setResetPasswordUserId}>
                            <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-none font-bold">
                              <SelectValue placeholder="Choose a user..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-60 overflow-y-auto">
                              {users.filter(u => u.id !== currentUser?.id).map(u => (
                                <SelectItem key={u.id} value={u.id} className="text-xs font-medium">
                                  {u.name} ({u.role}) — {allStores.find(s => s.id === u.assignedStoreIds?.[0])?.name || allStores.find(s => s.id === u.assignedStoreIds?.[0])?.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {resetPasswordUserId && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                New Password
                              </Label>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                className="h-12 rounded-xl bg-gray-50/50 border-none font-bold"
                                value={resetPasswordNewPass}
                                onChange={(e) => setResetPasswordNewPass(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                Confirm New Password
                              </Label>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                className="h-12 rounded-xl bg-gray-50/50 border-none font-bold"
                                value={resetPasswordConfirmPass}
                                onChange={(e) => setResetPasswordConfirmPass(e.target.value)}
                              />
                            </div>
                            <Button
                              onClick={() => {
                                if (!resetPasswordNewPass || resetPasswordNewPass.length < 8) {
                                  toast.error("Password must be at least 8 characters");
                                  return;
                                }
                                if (resetPasswordNewPass !== resetPasswordConfirmPass) {
                                  toast.error("Passwords do not match");
                                  return;
                                }
                                if (!/(?=.*[0-9])(?=.*[a-zA-Z])/.test(resetPasswordNewPass)) {
                                  toast.error("Password must contain at least one number and one letter");
                                  return;
                                }
                                const targetUser = users.find(u => u.id === resetPasswordUserId);
                                updateUserPassword(resetPasswordUserId, resetPasswordNewPass);
                                toast.success(`Password reset for ${targetUser?.name || "user"}. They will need to log in again.`);
                                setResetPasswordUserId("");
                                setResetPasswordNewPass("");
                                setResetPasswordConfirmPass("");
                              }}
                              className="h-12 w-full bg-amber-600 hover:bg-amber-700 rounded-xl font-black text-xs shadow-lg shadow-amber-100"
                            >
                              Reset User Password
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                  <CardContent className="p-12 text-center">
                    <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-black text-gray-900 mb-2">Password Change Restricted</h3>
                    <p className="text-sm text-gray-500 max-w-md mx-auto">
                      Your account password is managed by your system administrator. 
                      Please contact your store admin to request a password change.
                    </p>
                  </CardContent>
                </Card>
              )}

            </TabsContent>
          </div>
        </Tabs>

        {/* --- Modals --- */}
        {/* Store Modal */}
        <Dialog open={isStoreModalOpen} onOpenChange={setIsStoreModalOpen}>
          <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden max-w-lg">
            <DialogHeader className="p-6 bg-indigo-600 text-white">
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingStore
                  ? "Edit Store Profile"
                  : "Link New Store Location"}
              </DialogTitle>
              <DialogDescription className="text-indigo-100 font-medium">
                {editingStore
                  ? "Update your branch details"
                  : "Add a new branch or warehouse to SellSync"}
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                    Store Name
                  </Label>
                  <Input
                    placeholder="Main Store"
                    value={newStoreData.name}
                    onChange={(e) =>
                      setNewStoreData({ ...newStoreData, name: e.target.value })
                    }
                    className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                    Store Code
                  </Label>
                  <Input
                    placeholder="STR-01"
                    value={newStoreData.code}
                    onChange={(e) =>
                      setNewStoreData({ ...newStoreData, code: e.target.value })
                    }
                    className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Physical Address
                </Label>
                <Input
                  placeholder="123 Retail Lane"
                  value={newStoreData.address}
                  onChange={(e) =>
                    setNewStoreData({
                      ...newStoreData,
                      address: e.target.value,
                    })
                  }
                  className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                    City
                  </Label>
                  <Input
                    placeholder="Lagos"
                    value={newStoreData.city}
                    onChange={(e) =>
                      setNewStoreData({ ...newStoreData, city: e.target.value })
                    }
                    className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                    State
                  </Label>
                  <Input
                    placeholder="Lagos State"
                    value={newStoreData.state}
                    onChange={(e) =>
                      setNewStoreData({
                        ...newStoreData,
                        state: e.target.value,
                      })
                    }
                    className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                    Zip Code
                  </Label>
                  <Input
                    placeholder="100001"
                    maxLength={6}
                    value={newStoreData.zip}
                    onChange={(e) =>
                      setNewStoreData({ ...newStoreData, zip: e.target.value })
                    }
                    className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                    Contact Phone
                  </Label>
                  <Input
                    placeholder="08012345678"
                    value={newStoreData.phone}
                    onChange={(e) =>
                      setNewStoreData({
                        ...newStoreData,
                        phone: e.target.value,
                      })
                    }
                    className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                    Contact Email
                  </Label>
                  <Input
                    placeholder="store@example.com"
                    value={newStoreData.email}
                    onChange={(e) =>
                      setNewStoreData({
                        ...newStoreData,
                        email: e.target.value,
                      })
                    }
                    className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  TIN (Tax Identification Number)
                </Label>
                <Input
                  placeholder="e.g., 01234567-0001"
                  value={newStoreData.tin || ""}
                  onChange={(e) =>
                    setNewStoreData({ ...newStoreData, tin: e.target.value })
                  }
                  className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-gray-50/50">
              <Button
                variant="ghost"
                onClick={() => setIsStoreModalOpen(false)}
                className="rounded-xl font-bold text-xs h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveStore}
                className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black text-xs h-10 px-8 shadow-lg shadow-indigo-100"
              >
                Save Store Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* User Modal */}
        <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
          <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden max-w-lg">
            <DialogHeader className="p-6 bg-indigo-600 text-white">
              <DialogTitle className="text-xl font-black tracking-tight">
                {editingUser
                  ? "Edit User Profile"
                  : isManager
                    ? "Add Cashier to My Store"
                    : "Register New User"}
              </DialogTitle>
              <DialogDescription className="text-indigo-100 font-medium">
                {editingUser
                  ? "Update system access for team members"
                  : isManager
                    ? "The Admin will be asked to approve this Cashier."
                    : "Grant a new team member access to SellSync"}
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                    Full Name
                  </Label>
                  <Input
                    placeholder="Full name"
                    value={newUserData.name}
                    onChange={(e) =>
                      setNewUserData({ ...newUserData, name: e.target.value })
                    }
                    className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                    Phone (11 Digits)
                  </Label>
                  <Input
                    placeholder="08012345678"
                    maxLength={11}
                    value={newUserData.phone}
                    onChange={(e) =>
                      setNewUserData({ ...newUserData, phone: e.target.value })
                    }
                    className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Email Address
                </Label>
                <Input
                  type="email"
                  placeholder="abioye@sellsync.com"
                  value={newUserData.email}
                  onChange={(e) =>
                    setNewUserData({ ...newUserData, email: e.target.value })
                  }
                  className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  System Role
                </Label>
                {newUserData.role === "Cashier" ? (
                  <div className="flex items-center justify-between h-10 px-4 rounded-xl bg-indigo-50 border border-indigo-100">
                    <span className="text-xs font-black text-indigo-700">
                      Cashier
                    </span>
                    <Badge className="bg-white text-indigo-600 border-indigo-100 font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
                      Fixed for this flow
                    </Badge>
                  </div>
                ) : editingUser?.role === "Admin" ? (
                  <div className="flex items-center justify-between h-10 px-4 rounded-xl bg-indigo-50 border border-indigo-100">
                    <span className="text-xs font-black text-indigo-700">
                      Admin
                    </span>
                    <Badge className="bg-white text-indigo-600 border-indigo-100 font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
                      Permanent role
                    </Badge>
                  </div>
                ) : (
                  <Select
                    value={newUserData.role}
                    onValueChange={(v: Role) =>
                      setNewUserData({
                        ...newUserData,
                        role: v,
                        assignedStoreIds:
                          v === "Admin"
                            ? allStores
                                .filter((s) => s.id !== "S-ALL")
                                .map((s) => s.id)
                            : newUserData.assignedStoreIds?.slice(0, 1) || [
                                currentStore.id,
                              ],
                      })
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem
                        value="Admin"
                        disabled={
                          adminCount >= 1 && editingUser?.role !== "Admin"
                        }
                        className="text-xs"
                      >
                        Admin
                      </SelectItem>
                      <SelectItem
                        value="Manager"
                        disabled={
                          managerCount >= 5 && editingUser?.role !== "Manager"
                        }
                        className="text-xs"
                      >
                        Manager
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-3 pt-2">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Assigned Store
                </Label>
                {newUserData.role === "Admin" ? (
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700">
                      Admin has access to all stores automatically.
                    </p>
                  </div>
                ) : (
                  <Select
                    value={newUserData.assignedStoreIds?.[0] || ""}
                    onValueChange={(storeId) =>
                      setNewUserData({
                        ...newUserData,
                        assignedStoreIds: [storeId],
                      })
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs">
                      <SelectValue placeholder="Select one store" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-60 overflow-y-auto">
                      {availableStoresForAssignment.map((store) => (
                        <SelectItem
                          key={store.id}
                          value={store.id}
                          className="text-xs font-bold"
                        >
                          {store.name}
                        </SelectItem>
                      ))}
                      {editingUser?.assignedStoreIds?.[0] &&
                        !availableStoresForAssignment.find(
                          (s) => s.id === editingUser.assignedStoreIds?.[0],
                        ) && (
                          <SelectItem
                            value={editingUser.assignedStoreIds[0]}
                            className="text-xs font-bold"
                          >
                            {allStores.find(
                              (s) => s.id === editingUser.assignedStoreIds[0],
                            )?.name || editingUser.assignedStoreIds[0]}
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[9px] text-gray-400 font-bold ml-1 uppercase">
                  * Admins manage all stores. One Manager per store; Cashiers
                  can only be added to stores that already have a Manager.
                </p>
              </div>
              {!editingUser && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                      Password
                    </Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={newUserData.password}
                      onChange={(e) =>
                        setNewUserData({
                          ...newUserData,
                          password: e.target.value,
                        })
                      }
                      className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                      Confirm Password
                    </Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-10 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="p-6 bg-gray-50/50">
              <Button
                variant="ghost"
                onClick={() => setIsUserModalOpen(false)}
                className="rounded-xl font-bold text-xs h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveUser}
                className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black text-xs h-10 px-8 shadow-lg shadow-indigo-100"
              >
                {isManager && !editingUser
                  ? "Send for Approval"
                  : "Save User Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Cashier Store Picker */}
        <Dialog
          open={isCashierStorePickerOpen}
          onOpenChange={setIsCashierStorePickerOpen}
        >
          <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden max-w-lg">
            <DialogHeader className="p-6 bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                <Users className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-xl font-black tracking-tight">
                Add Cashier
              </DialogTitle>
              <DialogDescription className="text-indigo-100 font-medium">
                {isManager
                  ? "Add a Cashier to one of your stores. The Admin will be asked to approve this request."
                  : "A Cashier can only be assigned to a store that already has a Manager. Pick the store below."}
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-3 max-h-[420px] overflow-y-auto">
              {storesWithManager.length === 0 ? (
                <div className="text-center py-12">
                  <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-black text-gray-500">
                    {isManager
                      ? "No stores assigned to you yet"
                      : "No stores have a Manager yet"}
                  </p>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    {isManager
                      ? "You need to be assigned to a store before you can add Cashiers."
                      : "Add a Manager to a store first, then you can create Cashiers for it."}
                  </p>
                </div>
              ) : (
                storesWithManager.map((store) => {
                  const manager = users.find(
                    (u) => u.id === store.managerId,
                  );
                  return (
                    <button
                      key={store.id}
                      onClick={() => {
                        setNewUserData({
                          role: "Cashier",
                          assignedStoreIds: [store.id],
                          status: "Active",
                        });
                        setIsCashierStorePickerOpen(false);
                        setIsUserModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-white hover:border-indigo-600 hover:shadow-md hover:shadow-indigo-100/50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center font-black text-sm text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                          {store.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm text-gray-900">
                            {store.name}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {store.city}, {store.state}
                          </p>
                          <p className="text-[10px] font-bold text-indigo-500 mt-0.5 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Manager: {manager?.name || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-gray-50 text-gray-600 border-gray-100 font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
                          Manager Ready
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <DialogFooter className="p-6 bg-gray-50/50">
              <Button
                variant="ghost"
                onClick={() => setIsCashierStorePickerOpen(false)}
                className="rounded-xl font-bold text-xs h-10"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Bank Modal */}
        <Dialog open={isAddBankOpen} onOpenChange={setIsAddBankOpen}>
          <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden max-w-md">
            <DialogHeader className="p-6 bg-purple-600 text-white">
              <DialogTitle className="text-xl font-black tracking-tight">
                Link Bank Account
              </DialogTitle>
              <DialogDescription className="text-purple-100 font-medium">
                Virtual bank account for receiving transfers
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Select Bank
                </Label>
                <Select value={selectedBank} onValueChange={setSelectedBank}>
                  <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs">
                    <SelectValue placeholder="Search or select bank" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[200px]">
                    {nigerianBanks.map((bank) => (
                      <SelectItem
                        key={bank}
                        value={bank}
                        className="text-xs font-bold"
                      >
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Account Number
                </Label>
                <Input
                  placeholder="Account number"
                  maxLength={11}
                  value={newBank.accountNumber}
                  onChange={(e) =>
                    setNewBank({
                      ...newBank,
                      accountNumber: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="h-12 rounded-xl bg-gray-50/50 border-none font-black text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Account Name
                </Label>
                <Input
                  placeholder="Registered business name"
                  value={newBank.accountName}
                  onChange={(e) =>
                    setNewBank({ ...newBank, accountName: e.target.value })
                  }
                  className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Phone Number Linked to Account
                </Label>
                <Input
                  placeholder="08012345678"
                  maxLength={11}
                  value={newBank.phoneNumber}
                  onChange={(e) =>
                    setNewBank({
                      ...newBank,
                      phoneNumber: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                />
              </div>
              <div className="p-4 bg-purple-50 rounded-2xl flex items-start gap-3 border border-purple-100">
                <Info className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-purple-700 leading-tight">
                  Accounts are verified instantly using NIP. Settlements occur
                  within 24 hours of successful transactions.
                </p>
              </div>
            </div>
            <DialogFooter className="p-6 bg-gray-50/50">
              <Button
                variant="ghost"
                onClick={() => setIsAddBankOpen(false)}
                className="rounded-xl font-bold text-xs h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddBankAccount}
                disabled={isVerifyingBank}
                className="bg-purple-600 hover:bg-purple-700 rounded-xl font-black text-xs h-12 px-8 shadow-lg shadow-purple-100 min-w-[140px]"
              >
                {isVerifyingBank ? (
                  <RefreshCcw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {isVerifyingBank ? "Verifying..." : "Verify & Link Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add POS Terminal Modal */}
        <Dialog open={isAddPOSOpen} onOpenChange={setIsAddPOSOpen}>
          <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden max-w-md">
            <DialogHeader className="p-6 bg-purple-600 text-white">
              <DialogTitle className="text-xl font-black tracking-tight">
                Link POS Terminal
              </DialogTitle>
              <DialogDescription className="text-purple-100 font-medium">
                Connect hardware for card and terminal payments
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  POS Provider
                </Label>
                <Select
                  value={newPOS.provider}
                  onValueChange={(v) =>
                    setNewPOS({
                      ...newPOS,
                      provider: v as typeof newPOS.provider,
                    })
                  }
                >
                  <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {[
                      "Moniepoint",
                      "OPay",
                      "PalmPay",
                    ].map((provider) => (
                      <SelectItem
                        key={provider}
                        value={provider}
                        className="text-xs font-bold"
                      >
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Terminal ID <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="e.g. 12345678"
                  value={newPOS.terminalId}
                  onChange={(e) =>
                    setNewPOS({ ...newPOS, terminalId: e.target.value })
                  }
                  className="h-12 rounded-xl bg-gray-50/50 border-none font-black text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Merchant ID (if available)
                </Label>
                <Input
                  placeholder="Optional merchant ID"
                  value={newPOS.merchantId}
                  onChange={(e) =>
                    setNewPOS({ ...newPOS, merchantId: e.target.value })
                  }
                  className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Phone Number Linked to POS <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="08012345678 (11 digits)"
                  maxLength={11}
                  value={newPOS.phoneNumber}
                  onChange={(e) =>
                    setNewPOS({
                      ...newPOS,
                      phoneNumber: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="h-12 rounded-xl bg-gray-50/50 border-none font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  Device Name / Location <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="e.g., Main Shop POS 1"
                  value={newPOS.deviceLocation}
                  onChange={(e) =>
                    setNewPOS({
                      ...newPOS,
                      deviceLocation: e.target.value,
                    })
                  }
                  className="h-12 rounded-xl bg-gray-50/50 border-none font-black text-sm"
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-gray-50/50">
              <Button
                variant="ghost"
                onClick={() => setIsAddPOSOpen(false)}
                className="rounded-xl font-bold text-xs h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddPOS}
                disabled={isVerifyingPOS}
                className="bg-purple-600 hover:bg-purple-700 rounded-xl font-black text-xs h-12 px-8 shadow-lg shadow-purple-100 min-w-[140px]"
              >
                {isVerifyingPOS ? (
                  <RefreshCcw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Smartphone className="w-4 h-4 mr-2" />
                )}
                {isVerifyingPOS ? "Connecting..." : "Link POS Terminal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Modals */}
        {/* Delete Store Confirmation */}
        <AlertDialog
          open={isDeleteStoreConfirmOpen}
          onOpenChange={setIsDeleteStoreConfirmOpen}
        >
          <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black flex items-center gap-3 text-red-600">
                <AlertTriangle className="w-6 h-6" />
                {isAdmin ? "Delete Store Location?" : "Request Store Deletion?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="font-bold text-gray-500 py-2">
                {isAdmin ? (
                  <>
                    Are you sure you want to delete{" "}
                    <span className="text-red-600 font-black">
                      {storeToDelete?.name}
                    </span>
                    ? This action is permanent and will remove the store, its
                    Manager and all its Cashiers.
                  </>
                ) : (
                  <>
                    Request to delete{" "}
                    <span className="text-red-600 font-black">
                      {storeToDelete?.name}
                    </span>
                    ? An approval request will be sent to the Admin. The store,
                    its Manager and all its Cashiers will be deleted once the
                    Admin approves.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="rounded-xl font-bold border-gray-100 h-12">
                Keep Store
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteStore}
                className="rounded-xl font-black bg-red-600 hover:bg-red-700 h-12 px-8 shadow-lg shadow-red-100"
              >
                {isAdmin ? "Yes, Delete Store" : "Send Approval Request"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete User Confirmation */}
        <AlertDialog
          open={isDeleteUserConfirmOpen}
          onOpenChange={setIsDeleteUserConfirmOpen}
        >
          <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black flex items-center gap-3 text-red-600">
                <UserMinus className="w-6 h-6" />
                Remove User Account?
              </AlertDialogTitle>
              <AlertDialogDescription className="font-bold text-gray-500 py-2">
                Are you sure you want to remove{" "}
                <span className="text-red-600 font-black">
                  {userToDelete?.name}
                </span>{" "}
                from the system? They will lose all access to SellSync
                immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="rounded-xl font-bold border-gray-100 h-12">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteUser}
                className="rounded-xl font-black bg-red-600 hover:bg-red-700 h-12 px-8 shadow-lg shadow-red-100"
              >
                Yes, Remove User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Bank Confirmation */}
        <AlertDialog
          open={isDeleteBankConfirmOpen}
          onOpenChange={setIsDeleteBankConfirmOpen}
        >
          <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black flex items-center gap-3 text-red-600">
                <Building2 className="w-6 h-6" />
                Unlink Bank Account?
              </AlertDialogTitle>
              <AlertDialogDescription className="font-bold text-gray-500 py-2">
                Are you sure you want to unlink this bank account? Automated
                settlements will stop until a new account is linked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="rounded-xl font-bold border-gray-100 h-12">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteBank}
                className="rounded-xl font-black bg-red-600 hover:bg-red-700 h-12 px-8 shadow-lg shadow-red-100"
              >
                Yes, Unlink Bank
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete POS Confirmation */}
        <AlertDialog
          open={isDeletePOSConfirmOpen}
          onOpenChange={setIsDeletePOSConfirmOpen}
        >
          <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black flex items-center gap-3 text-red-600">
                <Smartphone className="w-6 h-6" />
                Disconnect POS Terminal?
              </AlertDialogTitle>
              <AlertDialogDescription className="font-bold text-gray-500 py-2">
                Are you sure you want to disconnect this terminal? You will no
                longer be able to process card payments through this hardware.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="rounded-xl font-bold border-gray-100 h-12">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeletePOS}
                className="rounded-xl font-black bg-red-600 hover:bg-red-700 h-12 px-8 shadow-lg shadow-red-100"
              >
                Yes, Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ErrorBoundary>
  );
}
