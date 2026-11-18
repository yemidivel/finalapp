import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../../lib/db";
import { Stagger } from "../../animations/Stagger";
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
  FileText,
  Key,
  HelpCircle,
  Network,
  Save,
} from "lucide-react";
import { ReportsPage } from "./ReportsPage";
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
  const [moniepoint, setMoniepoint] = useState<{
    loading: boolean;
    connected: boolean;
    businessId?: string;
    clientId?: string;
    webhookUrl?: string;
  }>({ loading: false, connected: false });
  const [moniepointForm, setMoniepointForm] = useState({
    businessId: "",
    clientId: "",
    clientSecret: "",
    webhookSecret: "",
  });
  const [isSavingMoniepoint, setIsSavingMoniepoint] = useState(false);

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

    const canManageTerminals = isAdmin || isManager;

    const terminalData = {
      id: `POS-${Date.now()}`,
      name: newPOS.deviceLocation || `${newPOS.provider} Terminal`,
      provider: newPOS.provider,
      terminalId: newPOS.terminalId,
      merchantId: newPOS.merchantId,
      phoneNumber: newPOS.phoneNumber,
      deviceLocation: newPOS.deviceLocation,
      serialNumber: newPOS.terminalId,
      status: canManageTerminals ? "Connected" : "Offline",
      lastUsed: new Date().toISOString(),
    };

    try {
      if (canManageTerminals) {
        await addPOSTerminal(terminalData as any);
        toast.success(`${newPOS.provider} terminal linked successfully`);
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
        toast.info(
          "Terminal link request submitted to your manager for approval",
        );
      }

      setIsAddPOSOpen(false);
      setNewPOS({
        name: "",
        provider: "Moniepoint",
        terminalId: "",
        merchantId: "",
        phoneNumber: "",
        deviceLocation: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to link terminal",
      );
    } finally {
      setIsVerifyingPOS(false);
    }
  };

  useEffect(() => {
    const storeId = currentStore?.id;
    if (!storeId || storeId === "S-ALL") {
      setMoniepoint({ loading: false, connected: false });
      return;
    }

    let cancelled = false;
    setMoniepoint((prev) => ({ ...prev, loading: true }));

    db.terminals.connection
      .get(storeId)
      .then((res) => {
        if (cancelled) return;
        setMoniepoint({
          loading: false,
          connected: Boolean(res.connected),
          businessId: res.businessId,
          clientId: res.clientId,
          webhookUrl: res.webhookUrl,
        });
        if (res.connected && res.businessId) {
          setMoniepointForm((prev) => ({
            ...prev,
            businessId: res.businessId || "",
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setMoniepoint({ loading: false, connected: false });
      });

    return () => {
      cancelled = true;
    };
  }, [currentStore?.id]);

  const handleSaveMoniepoint = async () => {
    const storeId = currentStore?.id;
    if (!storeId || storeId === "S-ALL") {
      toast.error("Select a single store first");
      return;
    }
    if (
      !moniepointForm.businessId ||
      !moniepointForm.clientId ||
      !moniepointForm.clientSecret ||
      !moniepointForm.webhookSecret
    ) {
      toast.error("Fill in all Moniepoint credentials");
      return;
    }

    setIsSavingMoniepoint(true);
    try {
      const res = await db.terminals.connection.save(storeId, moniepointForm);
      setMoniepoint({
        loading: false,
        connected: true,
        businessId: res.businessId,
        clientId: res.clientId,
        webhookUrl: res.webhookUrl,
      });
      setMoniepointForm((prev) => ({
        ...prev,
        clientSecret: "",
        webhookSecret: "",
      }));
      toast.success("Moniepoint connected");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save Moniepoint credentials",
      );
    } finally {
      setIsSavingMoniepoint(false);
    }
  };

  const handleDisconnectMoniepoint = async () => {
    const storeId = currentStore?.id;
    if (!storeId || storeId === "S-ALL") return;

    setIsSavingMoniepoint(true);
    try {
      await db.terminals.connection.disconnect(storeId);
      setMoniepoint({ loading: false, connected: false });
      setMoniepointForm({
        businessId: "",
        clientId: "",
        clientSecret: "",
        webhookSecret: "",
      });
      toast.success("Moniepoint disconnected");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not disconnect Moniepoint",
      );
    } finally {
      setIsSavingMoniepoint(false);
    }
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
      <Stagger className="px-6 pt-2 pb-8 space-y-6 bg-surface text-on-surface min-h-screen">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">
              System Settings
            </h1>
            <p className="text-sm text-on-surface-variant font-medium max-w-2xl">
              {isManager && !isAdmin
                ? "Manage your store configuration, payment integrations, receipts, and global POS operational preferences."
                : "Manage your store configuration and preferences"}
            </p>
          </div>
          {isManager && !isStaff && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPaystackForm({
                    publicKey: paymentSettings.paystack?.publicKey || "",
                    secretKey: paymentSettings.paystack?.secretKey || "",
                    businessEmail: paymentSettings.paystack?.businessEmail || "",
                    subaccountCode:
                      paymentSettings.paystack?.subaccountCode || "",
                  });
                  toast.info("Unsaved changes discarded");
                }}
                className="h-11 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border-none text-on-surface font-bold text-xs"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Discard Unsaved
              </Button>
              <Button
                type="button"
                onClick={() =>
                  toast.success("Configuration Saved", {
                    description:
                      "Store parameters propagated to all online POS registers.",
                  })
                }
                className="h-11 px-5 rounded-xl bg-primary-container hover:opacity-90 text-on-primary font-bold text-xs shadow-md"
              >
                <Save className="w-4 h-4 mr-2" />
                Save All Changes
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-surface-container-low border border-outline-variant/40 p-1 h-12 shadow-sm overflow-x-auto inline-flex whitespace-nowrap">
            <TabsTrigger
              value="profile"
              className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-primary-container data-[state=active]:text-white"
            >
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              {isAdmin ? "Store Profile" : "My Store"}
            </TabsTrigger>
            {!isAdmin && (
              <TabsTrigger
                value="users"
                className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-primary-container data-[state=active]:text-white"
              >
                <Users className="w-3.5 h-3.5 mr-1.5" />
                {isManager ? "Team & Cashiers" : "My Profile"}
              </TabsTrigger>
            )}
            {(isAdmin || isManager) && (
              <TabsTrigger
                value="reports"
                className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-primary-container data-[state=active]:text-white"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Reports
              </TabsTrigger>
            )}
            {isManager && (
              <TabsTrigger
                value="payments"
                className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-primary-container data-[state=active]:text-white"
              >
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                Payments
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger
                value="security"
                className="rounded-lg px-3 h-9 font-black text-[10px] uppercase tracking-tighter data-[state=active]:bg-primary-container data-[state=active]:text-white"
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
                    className="border-none shadow-sm rounded-2xl overflow-hidden bg-surface-container-lowest hover:shadow-md transition-all group"
                  >
                    <CardContent className="p-0">
                      <div className="p-5 border-b border-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 bg-primary-fixed rounded-xl flex items-center justify-center border border-primary-fixed/50 overflow-hidden">
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
                              className={`${store.status === "Active" ? "bg-green-50 text-green-700" : "bg-surface-container-low text-gray-500"} border-none font-black text-[9px] uppercase px-2 py-0.5 rounded-lg`}
                            >
                              {store.status}
                            </Badge>
                            {store.isAdminStore && (
                              <Badge className="bg-primary-fixed text-indigo-600 border-none font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
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
              {isAdmin && currentStore && !currentStore.isAdminStore && (
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

            {/* --- Team & Cashiers / My Profile Tab (non-admin) --- */}
            {!isAdmin && (
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

              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-surface-container-lowest">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-surface-container-low/50 hover:bg-transparent">
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
                            className="hover:bg-surface-container-low/30 transition-colors border-b border-gray-50"
                          >
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-primary-fixed flex items-center justify-center border border-primary-fixed/50 overflow-hidden shrink-0">
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
                                className={`${user.role === "Admin" ? "bg-purple-50 text-purple-700" : user.role === "Manager" ? "bg-blue-50 text-blue-700" : "bg-surface-container-low text-gray-600"} border-none font-black text-[9px] uppercase px-2 py-0.5 rounded-lg`}
                              >
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {user.role === "Admin" ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-bold border-outline-variant/40 text-gray-500 rounded-md bg-surface-container-low/50"
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
                                          className="text-[9px] font-bold border-outline-variant/40 text-gray-500 rounded-md bg-surface-container-low/50"
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
                                      className="text-[9px] font-bold border-primary-fixed text-indigo-600 rounded-md bg-primary-fixed/60"
                                    >
                                      Under {getCashierManager(user.id)?.name}
                                    </Badge>
                                  )}
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
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
            )}

            {/* --- Reports Tab (admin + manager) --- */}
            {(isAdmin || isManager) && (
              <TabsContent value="reports" className="space-y-6">
                <ReportsPage embedded />
              </TabsContent>
            )}

            {/* --- Receipts Tab --- */}
            <TabsContent value="receipt" className="space-y-6">
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-surface-container-lowest">
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
                          className="h-12 rounded-xl bg-surface-container-low/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold"
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
                            <SelectTrigger className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs">
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
                            className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                          className="h-12 rounded-xl bg-surface-container-low/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold"
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
                          <SelectTrigger className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs">
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
                          <span className="text-[9px] font-bold text-indigo-500 bg-primary-fixed px-1.5 py-0.5 rounded uppercase">
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
                          className="w-full min-h-[100px] p-4 rounded-2xl bg-surface-container-low/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm resize-none"
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
                          <span className="text-[9px] font-bold text-indigo-500 bg-primary-fixed px-1.5 py-0.5 rounded uppercase">
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
                          className="w-full min-h-[100px] p-4 rounded-2xl bg-surface-container-low/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm resize-none"
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
                          <span className="text-[9px] font-bold text-indigo-500 bg-primary-fixed px-1.5 py-0.5 rounded uppercase">
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
                          className="w-full min-h-[100px] p-4 rounded-2xl bg-surface-container-low/50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm resize-none"
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

            {/* --- Payments Tab (Manager) --- */}
            <TabsContent value="payments" className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* LEFT COLUMN: payment channels, Paystack, settlement hardware */}
                <div className="xl:col-span-8 space-y-8">
                  {/* 1. Payment Methods master module */}
                  <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-surface-container-high text-primary-container flex items-center justify-center">
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="font-display text-xl font-bold text-on-surface tracking-tight">
                            Payment Methods
                          </h2>
                          <p className="text-sm text-on-surface-variant font-medium">
                            Enable or disable payment options available at POS
                            register counters
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-surface-container-high text-primary-container font-black text-[10px] uppercase tracking-widest">
                        Global Settings
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 pt-2">
                      {[
                        {
                          label: "Physical Cash",
                          key: "allowCash",
                          desc: "Accept physical cash at the counter",
                          icon: Banknote,
                          tone: "text-secondary",
                        },
                        {
                          label: "Card / Terminal",
                          key: "allowCard",
                          desc: "Accept card payments via POS terminal",
                          icon: CreditCard,
                          tone: "text-primary-container",
                        },
                        {
                          label: "Bank Transfer",
                          key: "allowTransfer",
                          desc: "Accept direct wire/bank transfers",
                          icon: Wallet,
                          tone: "text-primary-container",
                        },
                        {
                          label: "Pay with Transfer",
                          key: "enablePayWithTransfer",
                          desc: "Virtual bank account for dynamic transfers",
                          icon: Send,
                          tone: "text-primary-container",
                        },
                        {
                          label: "Paystack Online",
                          key: "allowPaystack",
                          desc: "Online payments via Paystack gateway",
                          icon: Globe,
                          tone: "text-primary-container",
                        },
                      ].map((opt) => (
                        <div
                          key={opt.key}
                          className="bg-surface-container-low/60 hover:bg-surface-container transition-all rounded-2xl p-4 flex flex-col justify-between min-h-[11rem] border border-outline-variant/40"
                        >
                          <div className="flex items-start justify-between">
                            <div
                              className={`w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-sm ${opt.tone}`}
                            >
                              <opt.icon className="w-5 h-5" />
                            </div>
                            <Switch
                              checked={(paymentSettings as any)[opt.key]}
                              onCheckedChange={(v) => {
                                updatePaymentSettings({ [opt.key]: v });
                                if (
                                  currentUser?.role === "Admin" &&
                                  adminOverview
                                ) {
                                  toast.success(
                                    `${opt.label} ${v ? "Enabled" : "Disabled"}`,
                                  );
                                } else {
                                  toast.info(
                                    `${opt.label} toggle submitted for Admin approval`,
                                  );
                                }
                              }}
                              className="data-[state=checked]:bg-primary-container"
                            />
                          </div>
                          <div className="space-y-1 mt-4">
                            <span className="text-sm font-bold text-on-surface block leading-tight">
                              {opt.label}
                            </span>
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block leading-snug">
                              {opt.desc}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Paystack integration */}
                  <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-surface-container-high text-primary-container flex items-center justify-center">
                          <Globe className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-xl font-bold text-on-surface tracking-tight">
                              Paystack Integration (Online Payment)
                            </h3>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-black uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                              Live
                            </span>
                          </div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-primary-container mt-1">
                            Connect Paystack for online checkout at POS
                          </p>
                        </div>
                      </div>
                      <a
                        href="https://paystack.com/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-container hover:opacity-80 text-[11px] font-bold flex items-center gap-1"
                      >
                        <HelpCircle className="w-4 h-4" />
                        API Documentation
                      </a>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                          Paystack Public Key
                        </Label>
                        <div className="relative">
                          <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-outline" />
                          <Input
                            value={paystackForm.publicKey}
                            onChange={(e) =>
                              setPaystackForm({
                                ...paystackForm,
                                publicKey: e.target.value,
                              })
                            }
                            placeholder="pk_live_..."
                            className="h-11 pl-10 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-on-surface-variant">
                          Visible in checkout client calls
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                          Paystack Secret Key
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-outline" />
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
                            className="h-11 pl-10 pr-10 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-on-surface-variant">
                          Stored encrypted in PCI DSS vault
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                          Business Email
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-outline" />
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
                            className="h-11 pl-10 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                            Subaccount Code
                          </Label>
                          <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-container text-[9px] font-black uppercase">
                            Optional
                          </span>
                        </div>
                        <div className="relative">
                          <Network className="absolute left-3.5 top-3.5 w-4 h-4 text-outline" />
                          <Input
                            value={paystackForm.subaccountCode}
                            onChange={(e) =>
                              setPaystackForm({
                                ...paystackForm,
                                subaccountCode: e.target.value,
                              })
                            }
                            placeholder="ACCT_..."
                            className="h-11 pl-10 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    {isManager && (
                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={handleSavePaystack}
                          className="h-11 px-8 bg-primary-container hover:opacity-90 text-on-primary rounded-xl font-black text-xs shadow-md transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Save Paystack Settings
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 3. Settlement hardware: banks + terminals */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Linked Bank Accounts */}
                    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary-container flex items-center justify-center">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-display text-base font-bold text-on-surface tracking-tight">
                              Linked Bank Accounts
                            </h4>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-container">
                              Manage settlement destinations
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddBankOpen(true)}
                          className="rounded-lg border-outline-variant/40 text-primary-container hover:bg-surface-container font-black text-[10px] uppercase tracking-wider h-8"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add Bank
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {bankAccounts.length > 0 ? (
                          bankAccounts.map((account) => (
                            <div
                              key={account.id}
                              className="group flex items-center justify-between p-4 bg-surface-container-low/60 hover:bg-surface-container rounded-2xl border border-outline-variant/40 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-surface-container-lowest rounded-xl flex items-center justify-center border border-outline-variant/40">
                                  <Building2 className="w-5 h-5 text-primary-container" />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-on-surface">
                                    {account.bankName}
                                  </p>
                                  <p className="text-[11px] font-bold text-on-surface-variant tracking-tight">
                                    {account.accountNumber} •{" "}
                                    {account.accountName}
                                  </p>
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
                          <div className="bg-surface-container-low/70 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
                              <Building2 className="w-6 h-6" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                              No bank accounts linked
                            </span>
                            <p className="text-xs text-on-surface-variant max-w-xs">
                              Link Nigerian commercial banks or fintech
                              sub-accounts to automate daily shift cash payouts.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Moniepoint connection */}
                    {(isAdmin || isManager) && (
                      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary-container flex items-center justify-center">
                              <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-display text-base font-bold text-on-surface tracking-tight">
                                Moniepoint POS
                              </h4>
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary-container">
                                {moniepoint.loading
                                  ? "Checking connection"
                                  : moniepoint.connected
                                    ? "Connected"
                                    : "Not connected"}
                              </p>
                            </div>
                          </div>
                          {moniepoint.connected && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDisconnectMoniepoint}
                              disabled={isSavingMoniepoint}
                              className="rounded-lg border-outline-variant/40 text-red-500 hover:bg-red-50 font-black text-[10px] uppercase tracking-wider h-8"
                            >
                              Disconnect
                            </Button>
                          )}
                        </div>

                        {moniepoint.connected ? (
                          <div className="space-y-1.5 text-xs text-on-surface-variant">
                            <p>
                              <span className="font-black text-on-surface">
                                Business:
                              </span>{" "}
                              {moniepoint.businessId}
                            </p>
                            <p>
                              <span className="font-black text-on-surface">
                                Client ID:
                              </span>{" "}
                              {moniepoint.clientId}
                            </p>
                            <p className="break-all">
                              <span className="font-black text-on-surface">
                                Webhook URL:
                              </span>{" "}
                              {moniepoint.webhookUrl}
                            </p>
                            <p>
                              Add this URL in your Moniepoint dashboard so
                              payments confirm automatically.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                              placeholder="Business ID"
                              value={moniepointForm.businessId}
                              onChange={(e) =>
                                setMoniepointForm({
                                  ...moniepointForm,
                                  businessId: e.target.value,
                                })
                              }
                              className="h-11 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
                            />
                            <Input
                              placeholder="Client ID"
                              value={moniepointForm.clientId}
                              onChange={(e) =>
                                setMoniepointForm({
                                  ...moniepointForm,
                                  clientId: e.target.value,
                                })
                              }
                              className="h-11 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
                            />
                            <Input
                              placeholder="Client Secret"
                              type="password"
                              value={moniepointForm.clientSecret}
                              onChange={(e) =>
                                setMoniepointForm({
                                  ...moniepointForm,
                                  clientSecret: e.target.value,
                                })
                              }
                              className="h-11 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
                            />
                            <Input
                              placeholder="Webhook Secret"
                              type="password"
                              value={moniepointForm.webhookSecret}
                              onChange={(e) =>
                                setMoniepointForm({
                                  ...moniepointForm,
                                  webhookSecret: e.target.value,
                                })
                              }
                              className="h-11 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
                            />
                            <Button
                              onClick={handleSaveMoniepoint}
                              disabled={isSavingMoniepoint}
                              className="sm:col-span-2 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs"
                            >
                              {isSavingMoniepoint
                                ? "Saving..."
                                : "Connect Moniepoint"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* POS Terminals */}
                    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary-container flex items-center justify-center">
                            <Smartphone className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-display text-base font-bold text-on-surface tracking-tight">
                              POS Terminals
                            </h4>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-container">
                              Connect hardware for card payments
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddPOSOpen(true)}
                          className="rounded-lg border-outline-variant/40 text-primary-container hover:bg-surface-container font-black text-[10px] uppercase tracking-wider h-8"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add Terminal
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {posTerminals.length > 0 ? (
                          posTerminals.map((pos) => (
                            <div
                              key={pos.id}
                              className="group flex items-center justify-between p-4 bg-surface-container-low/60 hover:bg-surface-container rounded-2xl border border-outline-variant/40 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-surface-container-lowest rounded-xl flex items-center justify-center border border-outline-variant/40">
                                  <Smartphone className="w-5 h-5 text-primary-container" />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-on-surface">
                                    {pos.name}
                                  </p>
                                  <p className="text-[11px] font-bold text-on-surface-variant tracking-tight">
                                    {pos.provider} • SN:{" "}
                                    {pos.serialNumber || "N/A"}
                                  </p>
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
                          <div className="bg-surface-container-low/70 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
                              <Smartphone className="w-6 h-6" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                              No terminals linked
                            </span>
                            <p className="text-xs text-on-surface-variant max-w-xs">
                              Pair Android SmartPOS, Bluetooth mPOS or PAX
                              handheld terminals to streamline checkout taps.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cashier payment requests (visible if this tab is ever granted to staff) */}
                  {isStaff && (
                    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary-container flex items-center justify-center">
                          <Clock className="w-5 h-5" />
                        </div>
                        <h4 className="font-display text-base font-bold text-on-surface tracking-tight">
                          Your Payment Requests
                        </h4>
                      </div>
                      {myRequests.length > 0 ? (
                        <div className="space-y-3">
                          {myRequests.map((req) => (
                            <div
                              key={req.id}
                              className="flex items-center justify-between p-4 bg-surface-container-low/60 rounded-2xl border border-outline-variant/40"
                            >
                              <p className="text-sm font-bold text-on-surface">
                                {req.type === "Bank"
                                  ? `Bank — ${req.details.bankName}`
                                  : req.type === "POS"
                                    ? `Terminal — ${req.details.name}`
                                    : `Paystack — ${req.details.businessEmail}`}
                              </p>
                              <Badge
                                className={`${req.status === "Pending" ? "bg-yellow-50 text-yellow-600" : req.status === "Approved" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"} border-none font-black text-[9px] uppercase px-2.5 py-1 rounded-md`}
                              >
                                {req.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-on-surface-variant">
                          No payment requests yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Receipt & alert defaults + app preferences */}
                <div className="xl:col-span-4 space-y-8">
                  {/* Receipt & Alert Defaults */}
                  <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-primary-container">
                        <Receipt className="w-5 h-5" />
                        <h3 className="font-display text-base font-bold text-on-surface tracking-tight">
                          Receipt &amp; Alert Defaults
                        </h3>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium">
                        Configure where automated sales reports and emergency
                        alerts are dispatched.
                      </p>
                    </div>
                    <div className="space-y-4 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                          Default Report Email
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-outline" />
                          <Input
                            type="email"
                            value={receiptDefaults.email}
                            onChange={(e) =>
                              setReceiptDefaults({
                                ...receiptDefaults,
                                email: e.target.value,
                              })
                            }
                            placeholder="reports@yourstore.com"
                            className="h-11 pl-10 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-on-surface-variant block">
                          Daily sales reports and inventory analytics will be
                          sent here.
                        </span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                          Critical Alert Phone
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-outline" />
                          <Input
                            value={receiptDefaults.phone}
                            onChange={(e) =>
                              setReceiptDefaults({
                                ...receiptDefaults,
                                phone: e.target.value,
                              })
                            }
                            placeholder="080 000 0000"
                            className="h-11 pl-10 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-on-surface-variant block">
                          Urgent expiry alerts and stockouts will be notified via
                          SMS.
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
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
                            <SelectTrigger className="h-11 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="Daily" className="text-xs">
                                Daily
                              </SelectItem>
                              <SelectItem value="Weekly" className="text-xs">
                                Weekly (Mondays)
                              </SelectItem>
                              <SelectItem value="Monthly" className="text-xs">
                                Monthly
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                            Daily Report Time
                          </Label>
                          <div className="relative flex items-center">
                            <Input
                              type="time"
                              value={receiptDefaults.reportTime}
                              onChange={(e) =>
                                setReceiptDefaults({
                                  ...receiptDefaults,
                                  reportTime: e.target.value,
                                })
                              }
                              className="h-11 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
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
                          <SelectTrigger className="h-11 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Real-time" className="text-xs">
                              Real-time (Immediate)
                            </SelectItem>
                            <SelectItem
                              value="Daily Summary"
                              className="text-xs"
                            >
                              End of Shift Only
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="pt-4 border-t border-outline-variant/40 space-y-4">
                        <div className="flex items-center gap-1.5 text-primary-container">
                          <Type className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            Custom Receipt Messages
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                              Receipt Header Message
                            </Label>
                            <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-container text-[9px] font-black uppercase">
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
                            rows={2}
                            className="w-full p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:outline-none font-medium text-sm resize-none"
                            placeholder="e.g., Welcome to our store! Quality products at affordable prices."
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                              Receipt Footer Message
                            </Label>
                            <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-container text-[9px] font-black uppercase">
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
                            rows={2}
                            className="w-full p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:outline-none font-medium text-sm resize-none"
                            placeholder="e.g., Thank you for shopping with us! See you again soon."
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                              Return / Exchange Message
                            </Label>
                            <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-container text-[9px] font-black uppercase">
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
                            rows={2}
                            className="w-full p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:outline-none font-medium text-sm resize-none"
                            placeholder="e.g., Exchange allowed within 48 hours with receipt."
                          />
                        </div>
                      </div>
                      {isManager && (
                        <div className="flex justify-end pt-2">
                          <Button
                            onClick={() =>
                              toast.success(
                                "Receipt and alert defaults saved",
                              )
                            }
                            className="h-11 px-6 bg-primary-container hover:opacity-90 text-on-primary rounded-xl font-black text-xs shadow-md transition-all active:scale-95"
                          >
                            Save Defaults
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* App Preferences */}
                  <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-primary-container">
                        <Calendar className="w-5 h-5" />
                        <h3 className="font-display text-base font-bold text-on-surface tracking-tight">
                          App Preferences
                        </h3>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium">
                        Configure visual numbers, date and checkout terminal
                        telemetry.
                      </p>
                    </div>
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                            Date Format
                          </Label>
                          <Select
                            value={preferences.dateFormat}
                            onValueChange={(v: Preferences["dateFormat"]) =>
                              updatePreferences({ ...preferences, dateFormat: v })
                            }
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="DD/MM/YYYY" className="text-xs">
                                DD/MM/YYYY
                              </SelectItem>
                              <SelectItem value="MM/DD/YYYY" className="text-xs">
                                MM/DD/YYYY
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                            Time Format
                          </Label>
                          <Select
                            value={preferences.timeFormat}
                            onValueChange={(v: Preferences["timeFormat"]) =>
                              updatePreferences({ ...preferences, timeFormat: v })
                            }
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-surface-container-low/50 border-outline-variant/40 font-bold text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="12h" className="text-xs">
                                12-Hour (AM/PM)
                              </SelectItem>
                              <SelectItem value="24h" className="text-xs">
                                24-Hour (Military)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/40">
                        <div className="space-y-0.5">
                          <span className="text-sm font-bold text-on-surface block leading-tight">
                            Thousand Separators
                          </span>
                          <span className="text-[10px] font-bold text-on-surface-variant block">
                            Format large numbers with commas
                          </span>
                        </div>
                        <Switch
                          checked={preferences.numberFormatting}
                          onCheckedChange={(v) =>
                            updatePreferences({
                              ...preferences,
                              numberFormatting: v,
                            })
                          }
                          className="data-[state=checked]:bg-primary-container"
                        />
                      </div>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-1.5 text-primary-container pb-1">
                          <Bell className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            Notification Sounds &amp; Alerts
                          </span>
                        </div>
                        {[
                          {
                            label: "In-App Chime on Complete Sale",
                            key: "saleChime",
                            desc: "Play a sound when a sale completes",
                          },
                          {
                            label: "Low Stock Warning Popups",
                            key: "lowStockPopups",
                            desc: "Show a popup when stock runs low",
                          },
                        ].map((n) => (
                          <div
                            key={n.key}
                            className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/40"
                          >
                            <div className="space-y-0.5 pr-3">
                              <span className="text-xs font-bold text-on-surface block leading-tight">
                                {n.label}
                              </span>
                              <span className="text-[10px] font-medium text-on-surface-variant block">
                                {n.desc}
                              </span>
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
                              className="data-[state=checked]:bg-primary-container"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* --- Manager Approvals Tab --- */}
            {isManager && (
              <TabsContent value="approvals" className="space-y-6">
                <Card className="border-none shadow-2xl shadow-purple-900/10 rounded-[3rem] overflow-hidden bg-surface-container-lowest border-2 border-purple-100">
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
                              className="flex flex-col md:flex-row md:items-center justify-between p-8 bg-surface-container-low/50 rounded-[2.5rem] border border-outline-variant/40 gap-8"
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
                                      className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg border-outline-variant/40 text-gray-400"
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
                                  <div className="mt-4 p-5 bg-surface-container-lowest rounded-[1.5rem] border border-outline-variant/40 space-y-2">
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
                                  className="h-14 px-8 rounded-2xl font-black text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-outline-variant/40 transition-all"
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
                      <div className="text-center py-14 border-2 border-dashed border-outline-variant/40 rounded-[2rem]">
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

                  <Card className="border-none shadow-sm rounded-2xl bg-surface-container-lowest">
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
                          <SelectTrigger className="h-12 rounded-xl bg-surface-container-low border-none font-bold">
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
                          <SelectTrigger className="h-12 rounded-xl bg-surface-container-low border-none font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="12h">12-Hour (AM/PM)</SelectItem>
                            <SelectItem value="24h">24-Hour</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
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

                  <Card className="border-none shadow-sm rounded-2xl bg-surface-container-lowest">
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
                          className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl"
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
                    <Card className="border-none shadow-sm rounded-2xl bg-surface-container-lowest">
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
                            className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl"
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
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-surface-container-lowest">
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
                            className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold"
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
                            className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold"
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
                            className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold"
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
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-surface-container-lowest">
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
                            <SelectTrigger className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold">
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
                                className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold"
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
                                className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold"
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
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-surface-container-lowest">
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
                    className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                    className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                  className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                    className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                    className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                    className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                    className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                    className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                  className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-surface-container-low/50">
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
                    className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                    className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                  className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-gray-400 ml-1">
                  System Role
                </Label>
                {newUserData.role === "Cashier" ? (
                  <div className="flex items-center justify-between h-10 px-4 rounded-xl bg-primary-fixed border border-primary-fixed">
                    <span className="text-xs font-black text-indigo-700">
                      Cashier
                    </span>
                    <Badge className="bg-surface-container-lowest text-indigo-600 border-primary-fixed font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
                      Fixed for this flow
                    </Badge>
                  </div>
                ) : editingUser?.role === "Admin" ? (
                  <div className="flex items-center justify-between h-10 px-4 rounded-xl bg-primary-fixed border border-primary-fixed">
                    <span className="text-xs font-black text-indigo-700">
                      Admin
                    </span>
                    <Badge className="bg-surface-container-lowest text-indigo-600 border-primary-fixed font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
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
                    <SelectTrigger className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs">
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
                  <div className="p-4 rounded-2xl bg-primary-fixed border border-primary-fixed">
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
                    <SelectTrigger className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs">
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
                      className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                      className="h-10 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="p-6 bg-surface-container-low/50">
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
                      className="w-full flex items-center justify-between p-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest hover:border-indigo-600 hover:shadow-md hover:shadow-indigo-100/50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-primary-fixed flex items-center justify-center font-black text-sm text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
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
                        <Badge className="bg-surface-container-low text-gray-600 border-outline-variant/40 font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
                          Manager Ready
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <DialogFooter className="p-6 bg-surface-container-low/50">
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
                  <SelectTrigger className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs">
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
                  className="h-12 rounded-xl bg-surface-container-low/50 border-none font-black text-sm"
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
                  className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                  className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
            <DialogFooter className="p-6 bg-surface-container-low/50">
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
                  <SelectTrigger className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs">
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
                  className="h-12 rounded-xl bg-surface-container-low/50 border-none font-black text-sm"
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
                  className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                  className="h-12 rounded-xl bg-surface-container-low/50 border-none font-bold text-xs"
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
                  className="h-12 rounded-xl bg-surface-container-low/50 border-none font-black text-sm"
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-surface-container-low/50">
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
              <AlertDialogCancel className="rounded-xl font-bold border-outline-variant/40 h-12">
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
              <AlertDialogCancel className="rounded-xl font-bold border-outline-variant/40 h-12">
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
              <AlertDialogCancel className="rounded-xl font-bold border-outline-variant/40 h-12">
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
              <AlertDialogCancel className="rounded-xl font-bold border-outline-variant/40 h-12">
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
      </Stagger>
    </ErrorBoundary>
  );
}
