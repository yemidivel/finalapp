/**
 * =============================================================================
 * POS PAGE - BACKEND INTEGRATION POINTS
 * =============================================================================
 *
 * This page handles point-of-sale operations. Key areas to integrate:
 *
 * 1. Product Scanning (handleScanSuccess) - Line ~202
 *    - Replace local inventory lookup with: api.products.getByBarcode()
 *
 * 2. Sale Completion (handleCompleteSale) - Line ~255
 *    - POST to /link/transactions for recording sales
 *    - Integrate with payment providers (Paystack, Flutterwave, etc.)
 *
 * 3. SMS/Email Receipts (handleSmsShare) - Line ~380
 *    - POST to /link/notifications/sms and /link/notifications/email
 *
 * See src/lib/api.ts for complete API documentation.
 * =============================================================================
 */

import {
  useMemo,
  useState,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import { useStore, useProductSync, InventoryItem } from "../state/store";
import {
  setLine,
  bumpLine,
  distinctLines,
  type CartMap,
} from "./posCart";
import { formatFullNumber } from "../../lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Textarea } from "../components/ui/textarea";
import { ErrorBoundary } from "../components/ErrorBoundary";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Wallet,
  Terminal,
  Receipt,
  CheckCircle2,
  X,
  ShoppingCart,
  ChevronRight,
  ChevronLeft,
  History,
  Star,
  Smartphone,
  Banknote,
  Percent,
  Calculator,
  Printer,
  Mail,
  Send,
  Loader2,
  QrCode,
  RefreshCcw,
  Building2,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { QrScannerModal } from "../components/QrScannerModal";
import { QrGeneratorModal } from "../components/QrGeneratorModal";
import { toast } from "sonner";
import { ProductCard } from "../components/ProductCard";
import { motion } from "framer-motion";
import {
  staggerContainer,
  slideInRight,
  fadeInUp,
} from "../../animations/variants";
import { generateReceiptPDF, downloadReceiptPDF } from "../../lib/receipt";
import { EmailShareModal } from "../components/EmailShareModal";
import { db, type DbCashierKpis } from "../../lib/db";

type PaymentMethod =
  | "Cash"
  | "Linked Account"
  | "Transfer"
  | "POS Terminal"
  | "Account Balance";

interface CartItemData {
  id: number;
  name: string;
  price: number;
  qty: number;
  stock: number;
  sku: string;
}

export function PosPage() {
  const {
    inventoryArray,
    completeSale,
    categories,
    dailySales,
    customers,
    kpis,
    bankAccounts,
    posTerminals,
    paymentSettings,
    currency,
    currentStore,
    currentUser,
    receiptDefaults,
    preferences,
    formatCurrency,
    refreshProducts,
    refreshTransactions,
    refreshAnalytics,
    refreshNotifications,
    transactions,
  } = useStore();
  // Read products from the database (not a login-time snapshot) so this
  // page stays in sync across Manager and Cashier sessions.
  useProductSync();


  // Search & Filter State
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartListRef = useRef<HTMLDivElement>(null);

  // Cart State
  const [cart, setCart] = useState<CartMap>({});
  const [discount, setDiscount] = useState<number>(0); // Fixed amount for now
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(
    "fixed",
  );
  const [selectedCustomer, setSelectedCustomer] = useState<string>("C-001"); // Default to Guest
  const [orderNotes, setOrderNotes] = useState("");

  // Payment State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [payments, setPayments] = useState<
    { method: PaymentMethod; amount: number }[]
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTxId, setLastTxId] = useState<string>("");
  const [completedOrderData, setCompletedOrderData] = useState<any>(null);

  // Receipt Sharing Modals
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState(receiptDefaults.email);
  const [sharePhone, setSharePhone] = useState(receiptDefaults.phone);
  const [isSendingShare, setIsSendingShare] = useState(false);

  // Sync share state with defaults when they change
  useEffect(() => {
    setShareEmail(receiptDefaults.email);
    setSharePhone(receiptDefaults.phone);
  }, [receiptDefaults]);

  // Payment Flow UI State
  const [paymentStep, setPaymentStep] = useState<
    "method" | "processing" | "success"
  >("method");
  const [processingMessage, setProcessingMessage] = useState(
    "Processing payment...",
  );

  const activeBankAccount = bankAccounts.find((a) => a.status === "Verified");
  const activeTerminal = posTerminals.find((t) => t.status === "Connected");

  const availablePaymentMethods = useMemo(() => {
    const methods: {
      id: PaymentMethod;
      icon: typeof Banknote;
      color: string;
    }[] = [
      {
        id: "Cash",
        icon: Banknote,
        color: "bg-green-50 text-green-600",
      },
      {
        id: "POS Terminal",
        icon: Smartphone,
        color: "bg-blue-50 text-blue-600",
      },
      {
        id: "Linked Account",
        icon: CreditCard,
        color: "bg-purple-50 text-purple-600",
      },
      {
        id: "Transfer",
        icon: Send,
        color: "bg-orange-50 text-orange-600",
      },
    ];

    return methods.filter((method) => {
      switch (method.id) {
        case "Cash":
          return paymentSettings.allowCash !== false;
        case "POS Terminal":
          return paymentSettings.allowCard !== false;
        case "Linked Account":
          return paymentSettings.enablePayWithTransfer !== false;
        case "Transfer":
          return paymentSettings.allowTransfer !== false;
        default:
          return true;
      }
    });
  }, [paymentSettings]);

  useEffect(() => {
    if (
      !availablePaymentMethods.some((m) => m.id === paymentMethod) &&
      availablePaymentMethods.length > 0
    ) {
      setPaymentMethod(availablePaymentMethods[0].id);
    }
  }, [availablePaymentMethods, paymentMethod]);

  // UI State
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  // The previous `activeTab` was write-only: it was flipped to "order" on the
  // first add and no UI could ever set it back, which is why adding a second
  // product looked impossible. The panel is now driven by real, dismissible
  // state: a static column from lg up, an overlay drawer below it.
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Below lg the order panel is a full-screen overlay; lock the page behind it
  // so scrolling the order never drags the underlying POS along. The static
  // lg column needs no lock because the layout is already viewport-fixed.
  useEffect(() => {
    if (!isCartOpen) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isCartOpen]);

  // The POS header, search row and Popular Items form one static sticky block at
  // the top; only the product grid scrolls underneath it. Its height is fluid,
  // so measure it and expose the offset to the sticky order card via a CSS var.
  const topBlockRef = useRef<HTMLDivElement>(null);
  const [topBlockH, setTopBlockH] = useState(0);

  // Server-measured, cashier-scoped figures for today. The local transaction
  // feed is only a fallback for the moment between first paint and the API
  // response (or a failed request) so the cards never sit at a hard zero$a
  const cashierId = currentUser?.id;
  const cashierName = currentUser?.name || "Cashier";
  
  const today = new Date().toISOString().slice(0, 10);
  const [serverKpis, setServerKpis] = useState<DbCashierKpis | null>(null);
  const myTxnsToday = useMemo(
          () =>
      transactions.filter(
        (t) =>
          t.datetime.startsWith(today) &&
          t.status === "Completed" &&
          (t.cashier === cashierId || t.cashier === cashierName),
      ),
    [transactions, today, cashierId, cashierName],
  );


  const localSales = myTxnsToday.reduce((s, t) => s + t.amount, 0);
  const localItems = myTxnsToday.reduce(
    (s, t) => s + t.items.reduce((a, i) => a + i.qty, 0),
    0,
  );

  const mySales = serverKpis?.salesToday ?? localSales;
  const myItemsSold = serverKpis?.itemsSoldToday ?? localItems;



  useEffect(() => {
    const measure = () => {
      setTopBlockH(topBlockRef.current?.offsetHeight ?? 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (topBlockRef.current) ro.observe(topBlockRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    searchInputRef.current?.focus();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // A deactivated product is refused by the sale API (POST /api/transactions/create
  // requires isActive), so it must not be offered here — otherwise a cashier fills
  // a cart and only discovers the problem at checkout.
  const sellableArray = useMemo(
    () => inventoryArray.filter((p) => p.isActive !== false),
    [inventoryArray],
  );

  const products = useMemo(() => {
    return sellableArray
      .filter((p) => {
        const matchesQuery =
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.sku.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = category === "all" || p.category === category;
        return matchesQuery && matchesCategory;
      })
      .sort((a, b) => (dailySales[b.id] || 0) - (dailySales[a.id] || 0));
  }, [sellableArray, query, category, dailySales]);

  const popularProducts = useMemo(() => {
    return [...sellableArray]
      .sort((a, b) => (dailySales[b.id] || 0) - (dailySales[a.id] || 0))
      .slice(0, 5);
  }, [inventoryArray, dailySales]);

  const cartItems: CartItemData[] = useMemo(() => {
    return Object.entries(cart)
      // A cart can outlive its products: deleting a product on another device
      // (or from another tab) drops it from inventoryArray while the local cart
      // still holds the id. The old `find(...)!` then threw on `p.id` and
      // white-screened POS, so skip ids we can no longer resolve.
      .map(([productId, qty]) => {
        const p = inventoryArray.find((i) => i.id === productId);
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          qty: qty as number,
          stock: p.stock,
          sku: p.sku,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [cart, inventoryArray]);

  // Keep the newest line in view. Once the order outgrows the list, the earliest
  // items scroll up under the "Current Order" header instead of pushing the
  // totals footer down.
  useEffect(() => {
    const el = cartListRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [cartItems.length]);

  const subtotal = cartItems.reduce((sum, ci) => sum + ci.price * ci.qty, 0);
  const calculatedDiscount =
    discountType === "percent" ? (subtotal * discount) / 100 : discount;
  const total = Math.max(0, subtotal - calculatedDiscount);

  const totalPaid =
    payments.reduce((s, p) => s + p.amount, 0) + (Number(cashReceived) || 0);
  const remainingDue = Math.max(0, total - totalPaid);
  const changeDue = totalPaid > total ? totalPaid - total : 0;

  // A transaction can hold any number of distinct products. All cart writes go
  // through the pure helpers in ./posCart and are applied functionally, so two
  // adds landing in the same render cannot clobber one another.
  //
  // The two helpers differ only in what `qty` means:
  //  - setCartLineQty: the quantity for this line (what the dialog shows), so
  //    confirming the dialog sets an explicit number. The dialog opens at the
  //    current line quantity, so re-adding a product already in the cart can no
  //    longer double it by treating the value as an increment.
  //  - bumpCartLine:   a delta, for the scanner and the quick-add tiles where
  //    "one more" is the intent.
  const setCartLineQty = (id: string, qty: number) => {
    const item = inventoryArray.find((i) => i.id === id);
    if (!item) return;
    if (item.stock === 0) {
      toast.error(`${item.name} is out of stock`);
      return;
    }
    setCart((prev) => setLine(prev, id, qty, item.stock));
  };

  const bumpCartLine = (id: string, delta: number = 1) => {
    const item = inventoryArray.find((i) => i.id === id);
    if (!item) return;
    if (item.stock === 0) {
      toast.error(`${item.name} is out of stock`);
      return;
    }
    setCart((prev) => bumpLine(prev, id, delta, item.stock));
  };

  // =============================================================================
  // BACKEND_INTEGRATION: Barcode/QR Scanner
  // =============================================================================
  // To integrate with backend for product lookup:
  // 1. Replace local inventoryArray.find() with API call
  // 2. Example: const response = await fetch(`${VITE_API_BASE_URL}/link/products?barcode=${decodedText}`);
  // 3. See src/lib/api.ts for full API documentation
  // =============================================================================

  const handleScanSuccess = (decodedText: string) => {
    // Try to find product by SKU or Barcode
    // BACKEND_INTEGRATION: Replace with: const product = await api.products.getByBarcode(decodedText);
    //
    // NOTE: the lookup is against local state, so it never reaches the server's
    // isActive check. A deactivated product is therefore rejected here with a
    // clear message instead of silently entering the cart and failing at checkout.
    const found = inventoryArray.find(
      (p) => p.sku === decodedText || p.barcode === decodedText,
    );
    const product = found && found.isActive === false ? undefined : found;
    if (product) {
      if (product.stock > 0) {
        bumpCartLine(product.id);
        toast.success(`Added ${product.name} to cart via scan`);
      } else {
        toast.error(`${product.name} is out of stock`);
      }
    } else if (found) {
      toast.error(`${found.name} is deactivated and cannot be sold`);
    } else {
      // Try to parse if it's JSON (for advanced QR codes)
      try {
        const data = JSON.parse(decodedText);
        const p = inventoryArray.find(
          (prod) => prod.sku === data.sku || prod.barcode === data.barcode,
        );
        if (!p) {
          toast.error("No product found for this QR data");
        } else if (p.isActive === false) {
          toast.error(`${p.name} is deactivated and cannot be sold`);
        } else if (p.stock > 0) {
          bumpCartLine(p.id);
          toast.success(`Added ${p.name} to cart via scan`);
        } else {
          toast.error(`${p.name} is out of stock`);
        }
      } catch (e) {
        toast.error(`No product matches barcode: ${decodedText}`);
      }
    }
  };

  const updateQty = (id: string, qty: number) => {
    setCartLineQty(id, qty);
  };

  const handleNumpadClick = (val: string) => {
    if (val === "Clear") setCashReceived("");
    else if (val === "Exact") setCashReceived(remainingDue.toFixed(2));
    else if (val === "⌫") setCashReceived((prev) => prev.slice(0, -1));
    else setCashReceived((prev) => prev + val);
  };

  const addPartialPayment = () => {
    const amount = Number(cashReceived);
    if (amount <= 0) return;
    setPayments([...payments, { method: paymentMethod, amount }]);
    setCashReceived("");
  };

  const processTerminalPayment = async ({
    terminalId,
    items,
    discount,
    customer,
    notes,
  }: {
    terminalId: string;
    items: { productId: string; quantity: number }[];
    discount: number;
    customer: string;
    notes: string;
  }) => {
    const storeId = currentStore?.id;
    if (!storeId || storeId === "S-ALL") {
      throw new Error("Select a single store before taking a terminal payment.");
    }

    setProcessingMessage("Sending payment to terminal...");
    const initiation = await db.terminals.initiatePayment(storeId, {
      terminalId,
      items,
      discount,
      paymentMethod: "CARD",
      customer,
      notes,
    });

    setProcessingMessage("Waiting for terminal...");
    const deadline = Date.now() + 90_000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const result = await db.terminals.paymentStatus(
        storeId,
        initiation.merchantReference,
      );

      if (result.status === "SUCCESSFUL") {
        if (!result.transaction) {
          throw new Error(
            "Payment succeeded but the sale could not be recorded.",
          );
        }
        setProcessingMessage("Payment confirmed!");
        return result.transaction;
      }

      if (result.status === "FAILED" || result.status === "CANCELLED") {
        throw new Error(
          result.status === "CANCELLED"
            ? "The payment was cancelled on the terminal."
            : "The terminal declined the payment.",
        );
      }

      setProcessingMessage("Waiting for terminal...");
    }

    throw new Error(
      "Timed out waiting for the terminal. Confirm the transaction on the terminal before retrying.",
    );
  };

  // =============================================================================
  // BACKEND_INTEGRATION: Complete Sale
  // =============================================================================
  // Replace simulated payment processing with actual API calls:
  //
  // // Before processing, verify with backend
  // const verifyPayment = async () => {
  //   const response = await fetch(`${VITE_API_BASE_URL}/link/transactions/verify`, {
  //     method: "POST",
  //     body: JSON.stringify({ paymentMethod, amount: total }),
  //   });
  //   return response.json();
  // };
  //
  // // After successful sale, save to backend
  // const response = await fetch(`${VITE_API_BASE_URL}/link/transactions`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(orderData),
  // });
  //
  // See src/lib/api.ts for full endpoint documentation
  // =============================================================================

  const handleCompleteSale = async () => {
    setIsProcessing(true);
    setPaymentStep("processing");

    // Finalize current entry if any
    const finalPayments = [...payments];
    if (Number(cashReceived) > 0) {
      finalPayments.push({
        method: paymentMethod,
        amount: Number(cashReceived),
      });
    }

    // Integrated Payment Flow Logic
    const isTerminalPayment = paymentMethod === "POS Terminal";
    if (isTerminalPayment) {
      if (!activeTerminal) {
        toast.error("No POS terminal connected. Please use manual entry.");
        setIsProcessing(false);
        setPaymentStep("method");
        return;
      }
    } else if (paymentMethod === "Linked Account") {
      if (!activeBankAccount) {
        toast.error("No bank account linked. Please use manual entry.");
        setIsProcessing(false);
        setPaymentStep("method");
        return;
      }
      setProcessingMessage("Initiating transfer...");
      await new Promise((r) => setTimeout(r, 2000));
    } else if (paymentMethod === "Transfer") {
      if (!paymentSettings.enablePayWithTransfer) {
        toast.error(
          "Pay with Transfer is disabled. Please enable it in Settings.",
        );
        setIsProcessing(false);
        setPaymentStep("method");
        return;
      }
      setProcessingMessage("Awaiting bank transfer...");
      await new Promise((r) => setTimeout(r, 3000));
      setProcessingMessage("Verifying transaction...");
      await new Promise((r) => setTimeout(r, 1500));
      setProcessingMessage("Payment confirmed!");
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      await new Promise((r) => setTimeout(r, 800)); // Standard simulation
    }

    const customerObj = customers.find((c) => c.id === selectedCustomer);
    const resolvedTerminalId =
      (finalPayments[0]?.method || paymentMethod) === "POS Terminal"
        ? activeTerminal?.serialNumber ||
          activeTerminal?.id ||
          activeTerminal?.name
        : (finalPayments[0]?.method || paymentMethod) === "Linked Account"
          ? activeBankAccount?.id || activeBankAccount?.bankName
          : undefined;

    // ---------------------------------------------------------------------
    // Persist the sale BEFORE showing success.
    //
    // This used to invent a local id (`TXN-${Date.now()}`) and hand the cart to
    // a fire-and-forget API call, so the success screen and the printed receipt
    // appeared even when the server rejected the sale. The database now decides:
    // on failure we stop here with the server's message and leave the cart and
    // the local stock untouched.
    // ---------------------------------------------------------------------
    let serverTx: Awaited<ReturnType<typeof completeSale>>;
    try {
      if (isTerminalPayment) {
        if (!resolvedTerminalId) {
          throw new Error("No terminal is available to receive this payment.");
        }
        serverTx = await processTerminalPayment({
          terminalId: resolvedTerminalId,
          items: cartItems.map((ci) => ({
            productId: ci.id,
            quantity: ci.qty,
          })),
          discount: calculatedDiscount,
          customer: customerObj?.name || "Guest Customer",
          notes: orderNotes,
        });
      } else {
        serverTx = await completeSale({
          transactionId: undefined,
          items: cartItems.map((ci) => ({
            productId: ci.id,
            qty: ci.qty,
            price: ci.price,
          })),
          subtotal,
          discount: calculatedDiscount,
          vat: 0,
          amount: total,
          payment: finalPayments[0]?.method || paymentMethod,
          cashier: currentUser?.name || "Cashier",
          terminalId: resolvedTerminalId,
          customer: customerObj?.name || "Guest Customer",
          notes: orderNotes,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The sale could not be saved. Please try again.";
      toast.error(message);
      setIsProcessing(false);
      setPaymentStep("method");
      return;
    }

    // The server is authoritative for money. Rebuild the receipt from what it
    // actually stored (its prices, quantities, discount and total) rather than
    // the locally computed figures, so the printed document always matches the
    // saved transaction. Names are not returned by the API, so they are joined
    // from the local catalog.
    const serverItems = (serverTx.items || []).map((i) => {
      const local = inventoryArray.find((p) => p.id === i.productId);
      return {
        id: i.productId,
        name: local?.name ?? "Unknown product",
        price: i.price,
        qty: i.quantity,
        sku: local?.sku ?? "",
        manufacturedDate: local?.manufacturedDate,
        expiryDate: local?.expiryDate,
      };
    });
    const serverSubtotal = serverItems.reduce(
      (sum, i) => sum + i.price * i.qty,
      0,
    );
    const serverDiscount = serverTx.discount ?? 0;
    const serverTotal = serverTx.totalAmount;

    // A mismatch means local state was stale (e.g. a price changed on another
    // device). The sale is already saved, so this is a warning, not a failure.
    if (Math.abs(serverTotal - total) > 0.01) {
      console.warn(
        `[POS] Server total (${serverTotal}) differs from the cart total (${total}); ` +
          `using the server figure on the receipt.`,
      );
    }

    const txId = serverTx.id;

    // Figures come from the saved transaction (see above), not from local state.
    const orderData = {
      id: txId,
      items: serverItems,
      subtotal: serverSubtotal,
      discount: serverDiscount,
      vat: 0,
      total: serverTotal,
      paymentMethod: finalPayments[0]?.method || paymentMethod,
      cashier: currentUser?.name || "Cashier",
      customer: customerObj?.name || "Guest Customer",
      date: new Date().toLocaleString("en-GB"), // Professional format
      store: currentStore,
      terminalId: resolvedTerminalId,
      changeDue: changeDue > 0 ? changeDue : 0,
    };

    setCompletedOrderData(orderData);
    setLastTxId(txId);
    setIsProcessing(false);
    setShowSuccess(true);
    setIsPaymentModalOpen(false);
    setPaymentStep("method");

    // The server decremented stock inside its own transaction; pull the
    // authoritative quantities back so the grid, cart and dashboard agree with
    // the database instead of relying on the local decrement.
    void refreshProducts(currentStore?.id);

    if (isTerminalPayment && currentStore?.id) {
      void Promise.all([
        refreshTransactions(currentStore.id),
        refreshAnalytics(currentStore.id),
        refreshNotifications(),
      ]);
    }

    // Auto-download receipt - Professional version
    setTimeout(() => {
      const blob = generateReceiptPDF({
        store: currentStore,
        transactionId: txId,
        date: orderData.date,
        cashier: orderData.cashier,
        customer: orderData.customer,
        items: orderData.items,
        subtotal: orderData.subtotal,
        discount: orderData.discount,
        vat: orderData.vat,
        total: orderData.total,
        paymentMethod: orderData.paymentMethod,
        currency,
        terminalId: orderData.terminalId,
        changeDue: orderData.changeDue,
        receiptDefaults: { ...receiptDefaults, ...preferences.receipts },
      });
      downloadReceiptPDF(blob, txId, true);
    }, 1000);

    if (paymentMethod === "POS Terminal") {
      toast.success(
        `Payment confirmed • ${formatCurrency(total)} settled on ${activeTerminal?.name || "the POS terminal"}`,
      );
    } else if (paymentMethod === "Linked Account") {
      toast.success(
        `Payment confirmed • ${formatCurrency(total)} settled to ${activeBankAccount?.bankName || "linked account"}`,
      );
    } else {
      toast.success(`Payment Successful! ${formatCurrency(total)} processed`);
    }

    setCart({});
    setCashReceived("");
    setPayments([]);
    setDiscount(0);
    setOrderNotes("");
  };

  // =============================================================================
  // BACKEND_INTEGRATION: SMS Receipt Sharing
  // =============================================================================
  // Replace simulated SMS sending with actual SMS API integration:
  //
  // const handleSmsShare = async () => {
  //   try {
  //     const response = await fetch(`${VITE_API_BASE_URL}/link/notifications/sms`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         phone: sharePhone,
  //         message: `Your SellSync receipt ${lastTxId}`,
  //         receiptUrl: `${VITE_API_BASE_URL}/receipts/${lastTxId}`,
  //       }),
  //     });
  //     if (!response.ok) throw new Error("SMS failed");
  //     toast.success(`Receipt SMS sent to ${sharePhone}`);
  //   } catch (error) {
  //     toast.error("Failed to send SMS");
  //   }
  // };
  // =============================================================================

  const handleSmsShare = async () => {
    if (!sharePhone || !sharePhone.startsWith("+234")) {
      toast.error(
        "Please enter a valid Nigerian phone number starting with +234",
      );
      return;
    }
    setIsSendingShare(true);
    // Simulate API call - replace with actual SMS API integration
    await new Promise((r) => setTimeout(r, 1500));
    setIsSendingShare(false);
    setIsSmsModalOpen(false);
    toast.success(`Receipt SMS sent to ${sharePhone}`);
  };

  const isAdmin = currentUser?.role === "Admin";
  const isGlobalView = currentStore.id === "S-ALL";

  // Global overview mode removed — always render POS normally. If no store is selected, the app will prompt via header controls.

  return (
    <ErrorBoundary>
      <motion.div
        className="flex flex-col min-h-full bg-surface"
        style={
          { "--pos-top": `${topBlockH}px` } as CSSProperties
        }
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Static top region — Point Of Sale bar, search and Popular Items stay
            pinned together while only the product grid scrolls beneath them. */}
        <div ref={topBlockRef} className="sticky top-0 z-30 bg-surface">
          <motion.header
            variants={fadeInUp}
            className="min-h-16 bg-surface-container-lowest border-b border-outline-variant/30 px-6 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between shrink-0"
          >
            {/* Page Header */}
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                Point Of Sale
              </h1>
            </div>


          <div className="flex items-center gap-6 min-w-0 justify-end">
            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <div className="flex items-center gap-2 text-gray-500">
                <History className="w-4 h-4" />
                <span>
                  Today’s Sales:{" "}
                  <span className="text-gray-900 font-bold">
                    {formatCurrency(mySales)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Receipt className="w-4 h-4" />
                <span>
                  Today’s Orders:{" "}
                  <span className="text-gray-900 font-bold">
                    {formatFullNumber(myItemsSold)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </motion.header>

          <div className="px-6 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search products or scan barcode..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-12 h-10 bg-surface-container-lowest border-outline-variant/40 shadow-sm text-sm focus-visible:ring-primary rounded-xl"
                />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold gap-2 px-6 shadow-lg shadow-indigo-100 animate-blink-subtle"
                  onClick={() => setIsScannerOpen(true)}
                >
                  <QrCode className="w-4 h-4" />
                  <span className="hidden sm:inline">Scan</span>
                </Button>
                {/* Below lg the order panel is an overlay, so it needs a way back
                    in. The badge counts distinct lines so a multi-item order is
                    visible before it is opened. */}
                {cartItems.length > 0 && (
                  <Button
                    variant="outline"
                    className="lg:hidden h-10 bg-indigo-600 hover:bg-indigo-700 text-white border-transparent rounded-xl font-bold gap-2 px-4 shadow-sm"
                    onClick={() => setIsCartOpen(true)}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {cartItems.length}
                  </Button>
                )}
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-60 h-10 bg-surface-container-lowest border-outline-variant/40 shadow-sm rounded-xl text-sm font-medium">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>
        </div>

        <main className="flex-1 flex items-start gap-6 px-6 py-6">
          {/* Left: Product Grid Area — scrolls under the static top block. */}
          <motion.div
            className="flex-1 min-w-0"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Popular Items — compact, horizontally scrollable strip so it never
                pushes the product grid down. */}
            {!query && category === "all" && popularProducts.length > 0 && (
              <section className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  Popular Items
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {popularProducts.slice(0, 5).map((p) => (
                    <Button
                      key={p.id}
                      variant="outline"
                      className="h-16 w-full bg-surface-container-lowest border-outline-variant/40 shadow-sm hover:border-primary-container hover:bg-primary-fixed/40 justify-start px-2.5 rounded-xl transition-all"
                      onClick={() => bumpCartLine(p.id)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center shrink-0 mr-2">
                        <span className="text-primary-container font-black text-sm">
                          {p.name[0]}
                        </span>
                      </div>
                      <div className="text-left overflow-hidden">
                        <p className="text-[11px] font-bold text-gray-900 truncate">
                          {p.name}
                        </p>
                        <p className="text-xs font-black text-gray-900">
                          {formatCurrency(p.price)}
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              </section>
            )}
            <motion.div
              className={`grid grid-cols-2 gap-6 sm:grid-cols-[repeat(auto-fill,minmax(245px,1fr))] ${
                cartItems.length > 0 ? "lg:grid-cols-3" : ""
              }`}
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p as any}
                  inCart={cart[p.id] || 0}
                  onAdd={(id) => bumpCartLine(id)}
                />
              ))}
            </motion.div>
          </motion.div>

          {/* Right: Cart Area
              A fixed 420px column in a flex row squeezed the product grid down
              to a couple of columns on narrow screens, so once a single item was
              added there was effectively nothing left to click. Below lg the
              panel is now a dismissible overlay instead of a sibling column. */}
          {cartItems.length > 0 && (
            <motion.aside
              className={`${
                isCartOpen ? "flex" : "hidden"
              } lg:flex fixed inset-0 z-40 w-full lg:sticky lg:-mt-6 lg:inset-auto lg:top-[var(--pos-top)] lg:self-start lg:z-10 lg:w-[420px] bg-surface-container-lowest border-l border-outline-variant/40 flex-col min-h-0 shrink-0 overflow-hidden shadow-2xl`}
              variants={slideInRight}
              initial="hidden"
              animate="visible"
            >
              {/* Cart Header */}
              <div className="relative z-10 p-4 bg-surface-container-lowest border-b border-outline-variant/40">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-gray-500" />
                    Current Order
                    {cartItems.length > 1 && (
                      <span className="text-xs font-black text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        {distinctLines(cart)} items
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="lg:hidden text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg h-8 px-2 font-bold text-xs gap-1.5"
                      onClick={() => setIsCartOpen(false)}
                    >
                      <ChevronLeft className="w-4 h-4" /> Products
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 bg-red-50 hover:text-red-700 hover:bg-red-100 rounded-lg h-8 px-2 font-bold text-xs gap-1.5"
                      onClick={() => setCart({})}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear
                    </Button>
                  </div>
                </div>
              </div>

              {/* Cart Items */}
              <div
                ref={cartListRef}
                className="relative z-0 flex-1 lg:flex-none lg:max-h-[240px] overflow-y-auto px-4 min-h-0 [scrollbar-width:thin]"
              >
                <div className="py-2 divide-y divide-outline-variant/20">
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <ShoppingCart className="w-10 h-10 text-gray-200" />
                      </div>
                      <p className="text-gray-900 font-bold">
                        Your cart is empty
                      </p>
                      <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                        Scan a barcode or search products to start a sale
                      </p>
                    </div>
                  ) : (
                    <>
                      {cartItems.map((item) => (
                        <div
                          key={item.id}
                          className="group flex gap-3 py-2.5 first:pt-0 animate-in slide-in-from-right-4 duration-300"
                        >
                          <div className="w-11 h-11 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 overflow-hidden">
                            <img
                              src={`https://placehold.co/60x60/e5e7eb/6b7280?text=${item.name[0]}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="text-[13px] font-bold text-gray-900 truncate leading-none mb-1">
                                {item.name}
                              </h4>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 bg-red-50 hover:text-red-700 hover:bg-red-100 rounded-lg h-6 w-6 p-0.5 shrink-0"
                                onClick={() => updateQty(item.id, 0)}
                                aria-label="Remove item"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white rounded-md transition-all shadow-sm"
                                  onClick={() =>
                                    updateQty(item.id, item.qty - 1)
                                  }
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <Input
                                  type="number"
                                  value={item.qty}
                                  onChange={(e) =>
                                    updateQty(
                                      item.id,
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  className="w-9 h-6 p-0 text-center text-xs font-black text-gray-900 bg-transparent border-none focus-visible:ring-0"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white rounded-md transition-all shadow-sm"
                                  onClick={() =>
                                    updateQty(item.id, item.qty + 1)
                                  }
                                  disabled={item.qty >= item.stock}
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                              <p className="text-sm font-black text-gray-900">
                                {formatCurrency(item.price * item.qty)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Cart Footer / Totals */}
              <div className="relative z-10 p-4 bg-surface-container-low border-t border-outline-variant/40 space-y-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.1)]">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-medium">
                        Discount{" "}
                        {discount > 0 &&
                          `(${discount}${discountType === "percent" ? "%" : ""})`}
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] font-black uppercase text-on-surface bg-surface-container-high px-2 py-0.5 rounded hover:bg-surface-container-highest shadow-sm"
                          >
                            Add
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Apply Discount</DialogTitle>
                            <DialogDescription>
                              Apply a fixed amount or percentage discount to
                              this order.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="flex gap-2">
                              <Button
                                variant={
                                  discountType === "fixed"
                                    ? "default"
                                    : "outline"
                                }
                                className="flex-1 h-12 gap-2"
                                onClick={() => setDiscountType("fixed")}
                              >
                                <Banknote className="w-4 h-4" /> Fixed (
                                {currency.symbol})
                              </Button>
                              <Button
                                variant={
                                  discountType === "percent"
                                    ? "default"
                                    : "outline"
                                }
                                className="flex-1 h-12 gap-2"
                                onClick={() => setDiscountType("percent")}
                              >
                                <Percent className="w-4 h-4" /> Percent (%)
                              </Button>
                            </div>
                            <Input
                              type="number"
                              placeholder={
                                discountType === "fixed" ? "0.00" : "0"
                              }
                              value={discount || ""}
                              onChange={(e) =>
                                setDiscount(Number(e.target.value))
                              }
                              className="h-14 text-2xl font-black text-center"
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              className="w-full h-12 text-lg font-bold"
                              onClick={() => setIsPaymentModalOpen(false)}
                            >
                              Apply Discount
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="text-red-500 font-bold">
                      -{formatCurrency(calculatedDiscount)}
                    </span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-lg font-black text-gray-900">
                      Total
                    </span>
                    <span className="text-2xl font-black text-gray-900">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 rounded-xl font-black text-base gap-2 transition-all active:scale-[0.98]"
                  disabled={cartItems.length === 0}
                  onClick={() => setIsPaymentModalOpen(true)}
                >
                  Pay Now <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </motion.aside>
          )}
        </main>


        {/* Payment Modal */}
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-3xl gap-0 border-none max-h-[92vh] [&>button]:top-2 [&>button]:right-2">
            <div className="flex h-[min(660px,90vh)]">
              {/* Payment Method Selector */}
              <div className="w-1/3 bg-surface-container-low border-r border-outline-variant/40 p-5 flex flex-col gap-2.5 overflow-y-auto">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">
                  Payment Method
                </h3>
                {availablePaymentMethods.map((method) => (
                  <Button
                    key={method.id}
                    variant="ghost"
                    className={`flex flex-col items-center justify-center h-auto p-4 rounded-2xl border-2 transition-all gap-2 ${paymentMethod === method.id ? "bg-surface-container-lowest border-primary-container shadow-lg scale-[1.02]" : "bg-transparent border-transparent hover:bg-surface-container"}`}
                    onClick={() => setPaymentMethod(method.id)}
                    aria-label={`Pay via ${method.id}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${method.color}`}
                    >
                      <method.icon className="w-6 h-6" />
                    </div>
                    <span
                      className={`text-xs font-black ${paymentMethod === method.id ? "text-gray-900" : "text-gray-500"}`}
                    >
                      {method.id}
                    </span>
                  </Button>
                ))}
                {availablePaymentMethods.length === 0 && (
                  <p className="text-xs font-bold text-red-500 p-4">
                    No payment methods enabled. Enable methods in Settings →
                    Payments.
                  </p>
                )}
              </div>

              {/* Payment Details / Numpad */}
              <div className="flex-1 bg-surface-container-lowest p-6 flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col pr-1">
                {/* Linked Devices & Accounts Header — not relevant to cash. */}
                {paymentMethod !== "Cash" && (
                  <div className="mb-4 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/40">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    Linked Devices & Accounts
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activeBankAccount ? (
                      <Badge className="bg-green-50 text-green-700 border-green-100 py-1 px-3 rounded-lg gap-1.5 font-bold">
                        <Building2 className="w-3 h-3" />
                        {activeBankAccount.bankName} ••••
                        {activeBankAccount.accountNumber.slice(-4)}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-gray-400 border-gray-200 py-1 px-3 rounded-lg gap-1.5 font-bold"
                      >
                        No Bank Linked
                      </Badge>
                    )}
                    {activeTerminal ? (
                      <Badge className="bg-green-50 text-green-700 border-green-100 py-1 px-3 rounded-lg gap-1.5 font-bold">
                        <Smartphone className="w-3 h-3" />
                        {activeTerminal.name}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-gray-400 border-gray-200 py-1 px-3 rounded-lg gap-1.5 font-bold"
                      >
                        No POS Linked
                      </Badge>
                    )}
                  </div>
                  {(!activeBankAccount || !activeTerminal) && (
                    <p className="text-[10px] text-orange-600 font-bold mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Payments will be manual only
                    </p>
                  )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-[31px] font-black text-gray-900 mb-1 whitespace-nowrap">
                      Total Due
                    </h2>
                    <p className="text-gray-500 font-medium">
                      Remaining:{" "}
                      <span className="text-indigo-600 font-black">
                        {formatCurrency(remainingDue, true)}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-black text-gray-900 whitespace-nowrap tabular-nums">
                      {formatCurrency(total, true)}
                    </span>
                  </div>
                </div>

                {/* Partial Payments List */}
                {payments.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Partial Payments
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {payments.map((p, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="bg-indigo-50 text-indigo-700 border-indigo-100 py-1.5 px-3 rounded-lg gap-2"
                        >
                          {p.method}: {formatCurrency(p.amount, true)}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() =>
                              setPayments(
                                payments.filter((_, idx) => idx !== i),
                              )
                            }
                            aria-label="Remove payment"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {paymentStep === "processing" ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-12 animate-in fade-in zoom-in duration-500">
                    <div className="relative">
                      <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center">
                        <RefreshCcw className="w-12 h-12 text-indigo-600 animate-spin" />
                      </div>
                      {paymentMethod === "POS Terminal" && (
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-indigo-600" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xl font-black text-gray-900">
                        {processingMessage}
                      </h4>
                      <p className="text-gray-500 max-w-[240px]">
                        Please do not close this window or refresh the page
                      </p>
                    </div>
                  </div>
                ) : paymentMethod === "Cash" ? (
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="relative">
                      <Input
                        className="h-16 text-4xl font-black text-right pr-14 bg-surface-container-low border-none rounded-2xl focus-visible:ring-primary shadow-inner"
                        value={cashReceived}
                        readOnly
                        placeholder="0.00"
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">
                        {currency.symbol}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {[
                        "1",
                        "2",
                        "3",
                        "5000",
                        "4",
                        "5",
                        "6",
                        "10000",
                        "7",
                        "8",
                        "9",
                        "Exact",
                        ".",
                        "0",
                        "⌫",
                        "Clear",
                      ].map((btn) => (
                        <Button
                          key={btn}
                          variant={
                            btn === "Exact" || btn === "Clear" || btn === "⌫"
                              ? "outline"
                              : "ghost"
                          }
                          className={`h-11 text-lg font-black rounded-xl border-2 ${btn === "Exact" ? "bg-primary-fixed border-primary-fixed text-primary-container" : btn === "Clear" ? "border-red-100 text-red-600 hover:bg-red-50" : btn === "⌫" ? "border-outline-variant/40 text-on-surface-variant" : "bg-surface-container-low border-transparent hover:bg-surface-container"}`}
                          onClick={() => handleNumpadClick(btn)}
                        >
                          {btn}
                        </Button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 h-11 font-bold rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        onClick={addPartialPayment}
                        disabled={!cashReceived || Number(cashReceived) <= 0}
                      >
                        Add Partial
                      </Button>
                    </div>

                    {totalPaid >= total && (
                      <div className="bg-green-50 border border-green-100 px-3 py-2 rounded-xl flex justify-between items-center animate-in fade-in zoom-in duration-300">
                        <span className="text-green-700 font-bold uppercase tracking-wider text-[10px]">
                          Change to give
                        </span>
                        <span className="text-xl font-black text-green-700">
                          {formatCurrency(changeDue, true)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center animate-pulse">
                      {paymentMethod === "POS Terminal" ? (
                        <Terminal className="w-8 h-8 text-indigo-600" />
                      ) : (
                        <CreditCard className="w-8 h-8 text-indigo-600" />
                      )}
                    </div>

                    {paymentMethod === "Transfer" &&
                    paymentSettings.enablePayWithTransfer &&
                    paymentSettings.virtualAccountDetails ? (
                      <div className="space-y-3 w-full max-w-sm">
                        <div className="space-y-2">
                          <h4 className="text-xl font-black text-gray-900 tracking-tight">
                            Ready for Transfer
                          </h4>
                          <p className="text-gray-500 font-medium">
                            Scan QR or use details below to pay
                          </p>
                        </div>

                        <div className="p-3 bg-surface-container-low rounded-2xl border-2 border-dashed border-primary-fixed flex flex-col items-center gap-3 relative overflow-hidden group">
                          <div className="w-36 h-36 bg-surface-container-lowest p-2 rounded-xl shadow-sm border border-outline-variant/40 flex items-center justify-center">
                            <QRCodeSVG
                              value={JSON.stringify({
                                accountName: paymentSettings.virtualAccountDetails.accountName,
                                accountNumber: paymentSettings.virtualAccountDetails.accountNumber,
                                bankName: paymentSettings.virtualAccountDetails.bankName,
                                amount: remainingDue,
                                store: currentStore.name,
                              })}
                              size={116}
                              level="H"
                              includeMargin={true}
                              bgColor="#ffffff"
                              fgColor="#4F46E5"
                            />
                          </div>

                          <div className="w-full space-y-2 pt-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">
                                Bank Name
                              </span>
                              <span className="font-black text-gray-900">
                                {paymentSettings.virtualAccountDetails.bankName}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">
                                Account Number
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-indigo-600 text-lg tracking-wider">
                                  {
                                    paymentSettings.virtualAccountDetails
                                      .accountNumber
                                  }
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-gray-400 hover:text-indigo-600"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      paymentSettings.virtualAccountDetails
                                        ?.accountNumber || "",
                                    );
                                    toast.success("Account number copied!");
                                  }}
                                >
                                  <RefreshCcw className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">
                                Account Name
                              </span>
                              <span className="font-black text-gray-900 uppercase">
                                {
                                  paymentSettings.virtualAccountDetails
                                    .accountName
                                }
                              </span>
                            </div>
                            <Separator className="bg-gray-200/50" />
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">
                                Amount
                              </span>
                              <span className="font-black text-gray-900">
                                {formatCurrency(remainingDue, true)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                          <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                            Awaiting Confirmation...
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-xl font-black text-gray-900">
                          {paymentMethod === "POS Terminal"
                            ? "Ready for Terminal"
                            : "Ready for Transfer"}
                        </h4>
                        <p className="text-gray-500 max-w-[240px]">
                          {paymentMethod === "POS Terminal"
                            ? `Present card on ${activeTerminal?.name || "terminal"} for ${formatCurrency(remainingDue, true)}`
                            : `Confirm transfer of ${formatCurrency(remainingDue, true)} to ${activeBankAccount?.bankName || "linked account"}`}
                        </p>
                      </div>
                    )}

                    {((paymentMethod === "POS Terminal" && !activeTerminal) ||
                      (paymentMethod === "Linked Account" &&
                        !activeBankAccount)) && (
                      <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <p className="text-xs font-bold text-orange-800 text-left">
                          {paymentMethod === "POS Terminal"
                            ? "No terminal connected"
                            : "No bank account linked"}
                          . Go to Settings to set this up.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                </div>

                <Button
                  className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl mt-4 shadow-xl shadow-indigo-100 gap-3 shrink-0"
                  disabled={isProcessing || totalPaid < total}
                  onClick={handleCompleteSale}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" /> Complete Sale
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Success Modal - Upgraded to Premium POS Completion */}
        <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
          <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-white dark:bg-[#0f1115]">
            {/* Purple Header Section */}
            <div className="bg-indigo-600 p-8 flex flex-col items-center text-center text-white relative overflow-hidden">
              {/* Abstract Background Decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/5 rounded-full -ml-32 -mb-32 blur-3xl" />

              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  damping: 12,
                  stiffness: 200,
                  delay: 0.1,
                }}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-2xl shadow-indigo-900/20"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
                >
                  <CheckCircle2 className="w-12 h-12 text-[#00A651]" />
                </motion.div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-[28px] font-black mb-2 tracking-tight"
              >
                Sale Completed!
              </motion.h2>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-3 bg-white/15 backdrop-blur-md px-4 py-1.5 rounded-xl border border-white/20 group cursor-pointer hover:bg-white/25 transition-all"
                onClick={() => {
                  navigator.clipboard.writeText(lastTxId);
                  toast.success("Transaction ID copied!");
                }}
              >
                <span className="text-lg font-black tracking-wider opacity-90">
                  {lastTxId}
                </span>
                <RefreshCcw className="w-4 h-4 opacity-60 group-hover:rotate-180 transition-transform duration-500" />
              </motion.div>
            </div>

            <div className="p-8 space-y-6">
              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
                <div className="space-y-1">
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Customer
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white text-base">
                    {completedOrderData?.customer || "Guest Customer"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <p className="font-bold text-gray-900 dark:text-white text-base">
                      {completedOrderData?.paymentMethod}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white text-base">
                    {completedOrderData?.date}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Store Location
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white text-base">
                    {completedOrderData?.store?.name || "Main Store"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Served By
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white text-base">
                    {completedOrderData?.cashier}
                  </p>
                </div>
              </div>

              {/* Total Amount Card */}
              <div className="bg-indigo-50/50 dark:bg-indigo-500/5 rounded-[1.5rem] p-6 flex flex-col items-center border border-indigo-100/50 dark:border-indigo-500/10 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Receipt className="w-20 h-20 text-indigo-600" />
                </div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">
                  Total Amount Paid
                </p>
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="flex items-baseline gap-1"
                >
                  <span className="text-5xl font-black text-indigo-600 tracking-tighter tabular-nums">
                    {formatCurrency(completedOrderData?.total || 0)}
                  </span>
                </motion.div>
                <div className="mt-3 flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-500/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100 dark:border-green-500/20">
                  <CheckCircle2 className="w-3 h-3 text-[#00A651]" />
                  Payment Successful
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-20 flex-col rounded-[1.5rem] gap-2 border-gray-100 dark:border-white/5 hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all group shadow-sm bg-white dark:bg-white/5"
                  onClick={() => {
                    const blob = generateReceiptPDF({
                      store: currentStore,
                      transactionId: lastTxId,
                      date: completedOrderData.date,
                      cashier: completedOrderData.cashier,
                      customer: completedOrderData.customer,
                      items: completedOrderData.items,
                      subtotal: completedOrderData.subtotal,
                      discount: completedOrderData.discount,
                      vat: completedOrderData.vat,
                      total: completedOrderData.total,
                      paymentMethod: completedOrderData.paymentMethod,
                      currency,
                      terminalId: completedOrderData.terminalId,
                      changeDue: completedOrderData.changeDue,
                      receiptDefaults: {
                        ...receiptDefaults,
                        ...preferences.receipts,
                      },
                    });
                    downloadReceiptPDF(blob, lastTxId);
                  }}
                >
                  <div className="w-9 h-9 bg-gray-50 dark:bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white dark:group-hover:bg-white/10 transition-colors">
                    <Printer className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-indigo-600" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 group-hover:text-indigo-600">
                    Print
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col rounded-[1.5rem] gap-2 border-gray-100 dark:border-white/5 hover:border-purple-200 dark:hover:border-purple-500/30 hover:bg-purple-50/50 dark:hover:bg-purple-500/5 transition-all group shadow-sm bg-white dark:bg-white/5"
                  onClick={() => setIsEmailModalOpen(true)}
                >
                  <div className="w-9 h-9 bg-gray-50 dark:bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white dark:group-hover:bg-white/10 transition-colors">
                    <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-purple-600" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 group-hover:text-purple-600">
                    Email
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col rounded-[1.5rem] gap-2 border-gray-100 dark:border-white/5 hover:border-green-200 dark:hover:border-green-500/30 hover:bg-green-50/50 dark:hover:bg-green-500/5 transition-all group shadow-sm bg-white dark:bg-white/5"
                  onClick={() => setIsSmsModalOpen(true)}
                >
                  <div className="w-9 h-9 bg-gray-50 dark:bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white dark:group-hover:bg-white/10 transition-colors">
                    <Smartphone className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-green-600" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 group-hover:text-green-600">
                    SMS
                  </span>
                </Button>
              </div>

              <Button
                className="w-full h-16 rounded-[1.5rem] bg-gray-900 hover:bg-black text-white font-black text-lg shadow-xl shadow-gray-200 transition-all active:scale-[0.98]"
                onClick={() => setShowSuccess(false)}
              >
                Start New Sale
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Email Share Modal */}
        {completedOrderData && (
          <EmailShareModal
            open={isEmailModalOpen}
            onClose={() => setIsEmailModalOpen(false)}
            reportName={`Receipt for Order ${lastTxId}`}
            reportType="Receipt"
            file={{
              blob: generateReceiptPDF({
                store: currentStore,
                transactionId: lastTxId,
                date: completedOrderData.date,
                cashier: completedOrderData.cashier,
                customer: completedOrderData.customer,
                items: completedOrderData.items,
                subtotal: completedOrderData.subtotal,
                discount: completedOrderData.discount,
                vat: completedOrderData.vat,
                total: completedOrderData.total,
                paymentMethod: completedOrderData.paymentMethod,
                currency,
                terminalId: completedOrderData.terminalId,
                changeDue: completedOrderData.changeDue,
                receiptDefaults: {
                  ...receiptDefaults,
                  ...preferences.receipts,
                },
              }),
              name: `receipt-${lastTxId}.pdf`,
              type: "application/pdf",
            }}
          />
        )}

        {/* SMS Share Modal - Premium Design */}
        <Dialog open={isSmsModalOpen} onOpenChange={setIsSmsModalOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-[#0f1115] text-white">
            <div>
              <DialogHeader className="p-8 pb-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-black tracking-tight">
                        Share via SMS
                      </DialogTitle>
                      <DialogDescription className="text-gray-400 font-medium">
                        Send digital receipt link via mobile
                      </DialogDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-gray-500 hover:text-white hover:bg-white/5"
                    onClick={() => setIsSmsModalOpen(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="p-8 space-y-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
                      Phone Number
                    </Label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        placeholder="+234 800 000 0000"
                        value={sharePhone}
                        onChange={(e) => setSharePhone(e.target.value)}
                        className="h-14 pl-12 bg-white/5 border-white/5 rounded-2xl focus:ring-2 focus:ring-green-500/20 text-white placeholder:text-gray-600 font-bold transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
                      Message Preview
                    </Label>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/5 text-sm font-medium text-gray-300 leading-relaxed italic">
                      "Thank you! Your SellSync receipt {lastTxId} for{" "}
                      {formatCurrency(total)} is ready. View full:
                      sellsync.me/r/{lastTxId.split("-")[1]}"
                    </div>
                  </div>

                  <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10 flex items-start gap-3">
                    <div className="w-5 h-5 bg-orange-500/10 rounded flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                    </div>
                    <p className="text-[10px] font-bold text-orange-400/80 leading-relaxed">
                      Full file attachments are not supported in SMS. A secure
                      download link will be provided instead.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="p-8 pt-0 flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl border-white/5 bg-transparent text-gray-400 font-bold hover:bg-white/5 hover:text-white transition-all"
                  onClick={() => setIsSmsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-[2] h-14 rounded-2xl bg-green-600 hover:bg-green-700 font-black text-lg gap-3 shadow-xl shadow-green-500/20 transition-all"
                  onClick={handleSmsShare}
                  disabled={isSendingShare}
                >
                  {isSendingShare ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  Send SMS
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <QrScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
        />

        <QrGeneratorModal
          isOpen={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
        />
      </motion.div>
    </ErrorBoundary>
  );
}
