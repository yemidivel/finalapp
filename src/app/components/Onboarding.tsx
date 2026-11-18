import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { Store, User } from "../state/store";
import { useStore } from "../state/store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Building2, ShieldCheck, Sparkles } from "lucide-react";

export function Onboarding() {
  const {
    users,
    currentUser,
    addUser,
    addStore,
    loginUser,
    updateUser,
    switchStore,
    setAdminOverview,
  } = useStore();

  // Prefer a real Admin that is already part of the app (the signed-up
  // account owner) so we never invent a placeholder account.
  const existingAdmin =
    users.find((u) => u.role === "Admin") ||
    (currentUser?.role === "Admin" ? currentUser : undefined);

  const [storeName, setStoreName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  // The user must confirm the contact details once; a second click then
  // creates the store and opens the admin dashboard.
  const [confirmed, setConfirmed] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleSubmit = async () => {
    if (!storeName.trim()) {
      toast.error("Please enter your store name");
      return;
    }
    if (!storePhone.trim()) {
      toast.error("Please enter your store phone number");
      return;
    }
    if (!/^[+0-9()\s-]{7,}$/.test(storePhone.trim())) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!storeEmail.trim()) {
      toast.error("Please enter your store email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storeEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    // First click: show the confirmation popup; second click proceeds.
    if (!confirmed) {
      setIsConfirmOpen(true);
      return;
    }

    setSubmitting(true);

    const code =
      storeCode.trim() ||
      storeName
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 4) || "STORE";

    // Local shape only — when a session token exists, addStore persists the
    // store through the backend and returns the REAL DB store record, so the
    // id used for switching/team assignment matches the database.
    const store: Store = {
      id: `S-${Date.now()}`,
      name: storeName.trim(),
      code,
      address: address.trim(),
      city: city.trim(),
      state: stateName.trim(),
      zip: "",
      phone: storePhone.trim(),
      email: storeEmail.trim(),
      status: "Active",
    };

    const autoAdmin: User = {
      id: `U-${Date.now()}`,
      name: "Administrator",
      email: "admin@sellsync.com",
      role: "Admin",
      status: "Active",
      phone: "",
      assignedStoreIds: [],
      password: "admin1234",
    };

    const admin = existingAdmin || autoAdmin;

    try {
      const created = await addStore(store);
      if (!created) {
        console.error("Store creation failed (see prior error).");
        setSubmitting(false);
        return;
      }
      if (!existingAdmin) {
        addUser(autoAdmin);
      }
      loginUser(admin);
      updateUser({
        ...admin,
        assignedStoreIds: [
          ...new Set([...(existingAdmin?.assignedStoreIds || []), created.id]),
        ],
      });
      switchStore(created.id);
      setAdminOverview(true);
      toast.success(
        existingAdmin
          ? `Store "${created.name}" created successfully`
          : `Welcome! You are now the Administrator of "${created.name}"`,
      );
    } catch (error) {
      console.error("Onboarding failed:", error);
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-3xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <img
              src="/icon.png"
              alt="SellSync"
              className="w-12 h-12 rounded-xl object-cover shadow-xl shadow-indigo-100"
            />
            <span className="text-3xl font-black tracking-tight text-[#3B82F6]">
              SellSync
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
            Set up your store
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-2 max-w-md">
            Enter your business details below — you'll automatically become the
            store Administrator. Add more stores and team members from the
            Stores and Team tabs anytime.
          </p>
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-100/60 border border-gray-100 overflow-hidden">
          <div className="p-8 sm:p-10 space-y-8">
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900">
                    Store information
                  </h2>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Your business details
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2 sm:col-span-2">
                  <Label
                    htmlFor="store-name"
                    className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
                  >
                    Store name *
                  </Label>
                  <Input
                    id="store-name"
                    placeholder="e.g. My Retail Outlet"
                    className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="store-code"
                    className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
                  >
                    Store code
                  </Label>
                  <Input
                    id="store-code"
                    placeholder="Auto-generated"
                    className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="store-phone"
                    className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
                  >
                    Phone *
                  </Label>
                  <Input
                    id="store-phone"
                    placeholder="+234 800 000 0000"
                    className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label
                    htmlFor="store-email"
                    className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
                  >
                    Store email *
                  </Label>
                  <Input
                    id="store-email"
                    type="email"
                    placeholder="hello@yourstore.com"
                    className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="store-address"
                    className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
                  >
                    Address
                  </Label>
                  <Input
                    id="store-address"
                    placeholder="Street address"
                    className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="store-city"
                      className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
                    >
                      City
                    </Label>
                    <Input
                      id="store-city"
                      placeholder="City"
                      className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="store-state"
                      className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1"
                    >
                      State
                    </Label>
                    <Input
                      id="store-state"
                      placeholder="State / Region"
                      className="h-12 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white transition-all font-medium"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="px-8 sm:px-10 py-6 bg-gray-50/60 border-t border-gray-50 flex flex-col sm:flex-row items-center gap-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 flex-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              You'll be set up as Administrator automatically — update your
              name, email and password anytime in Settings.
            </p>
            <Button
              className="w-full sm:w-auto px-8 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? "Setting up..."
                : existingAdmin
                  ? "Create Store"
                  : "Create Store & Become Admin"}
            </Button>
          </div>
        </div>
      </div>

      {/* Contact confirmation popup — shows on the first submit click. */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              Confirm your contact details
            </AlertDialogTitle>
            <AlertDialogDescription className="font-bold text-gray-500 py-2 leading-relaxed">
              Please make sure the <span className="text-indigo-600">email
              address</span> and <span className="text-indigo-600">phone
              number</span> above are the ones you use for your SellSync
              account — this is where the Admin will receive account
              information. Click{" "}
              <span className="text-indigo-600">Create Store & Become
              Admin</span> again to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogAction
              className="rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 h-12 px-8 shadow-lg shadow-indigo-100"
              onClick={() => {
                setConfirmed(true);
                setIsConfirmOpen(false);
              }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
