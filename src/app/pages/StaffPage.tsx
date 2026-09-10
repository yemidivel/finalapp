import { useMemo, useState } from "react";
import {
  Users,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Download,
  ArrowUpRight,
  Plus,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { useStore, type User } from "../state/store";
import { motion } from "framer-motion";
import { staggerContainer, fadeInUp } from "../../animations/variants";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export default function StaffPage() {
  const {
    users,
    attendance,
    transactions,
    currentStore,
    currentUser,
    theme,
    clockIn,
    clockOut,
    markAbsent,
    formatCurrency,
    storeSettings,
    updateStoreSettings,
    updateStaffDetails,
    allStores,
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState("attendance");
  const [searchTerm, setSearchTerm] = useState("");
  const [historyFilterUser, setHistoryFilterUser] = useState("all");
  const [historyFilterPeriod, setHistoryFilterPeriod] = useState("this-month");
  const [historyFilterAction, setHistoryFilterAction] = useState("all");

  const isAdmin = currentUser?.role === "Admin";
  const isGlobalView = currentStore.id === "S-ALL";
  const isManager = currentUser?.role === "Manager";

  // Access Control: only Admin sees the full team overview.
  const canSeeAllStaff = isAdmin;

  const storeUsers = useMemo(() => {
    const baseUsers = isGlobalView
      ? users
      : users.filter((u) => u.assignedStoreIds.includes(currentStore.id));
    if (canSeeAllStaff) return baseUsers;
    return baseUsers.filter((u) => u.id === currentUser?.id);
  }, [users, currentStore.id, currentUser?.id, canSeeAllStaff, isGlobalView]);

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const settings = useMemo(() => {
    return (
      storeSettings[currentStore.id] || {
        clockInTime: "08:00",
        clockOutTime: "18:00",
        gracePeriod: 15,
        lateArrivalPenaltyEnabled: true,
        latePenaltyType: "fixed",
        latePenaltyFixed: 500,
        latePenaltyPerMinute: 50,
        maxLatesPerMonth: 3,
        earlyDeparturePenaltyEnabled: true,
        earlyDeparturePenaltyType: "fixed",
        earlyDeparturePenaltyFixed: 500,
        earlyDeparturePenaltyPerMinute: 50,
        absentDayPenaltyFixed: 1000,
        deductFullDayOnAbsence: true,
        overtimeEnabled: false,
        overtimeMinThreshold: 30,
        overtimeRateType: "multiplier",
        overtimeMultiplier: 1.5,
        overtimeFixedPerHour: 1000,
        weekendHolidayMultiplier: 2.0,
        workingDaysPerMonth: 25,
      }
    );
  }, [storeSettings, currentStore.id]);

  // Per-user schedule overrides (fall back to the store's shift settings)
  const userStoreName = (u: User) => {
    const s = allStores.find((x) => x.id === u.assignedStoreIds[0]);
    return s?.name || currentStore.name;
  };
  const userArrival = (u: User) =>
    u.expectedArrivalTime || settings.clockInTime;
  const userThreshold = (u: User) => u.lateThreshold ?? settings.gracePeriod;

  // --- Attendance Logic ---
  const todayAttendance = useMemo(() => {
    if (isGlobalView) return attendance.filter((a) => a.date === today);
    return attendance.filter(
      (a) => a.date === today && a.storeId === currentStore.id,
    );
  }, [attendance, today, isGlobalView, currentStore.id]);

  const attendanceStats = useMemo(() => {
    const relevantUsers = (
      isGlobalView
        ? users
        : users.filter((u) => u.assignedStoreIds.includes(currentStore.id))
    ).filter((u) => u.role !== "Admin");
    const storeTodayAttendance = isGlobalView
      ? attendance.filter((a) => a.date === today)
      : attendance.filter(
          (a) => a.date === today && a.storeId === currentStore.id,
        );

    const presentCount = storeTodayAttendance.filter(
      (a) => a.status === "Present" || a.status === "Late",
    ).length;
    const lateCount = storeTodayAttendance.filter(
      (a) => a.status === "Late",
    ).length;
    const absentCount = storeTodayAttendance.filter(
      (a) => a.status === "Absent",
    ).length;
    const rate =
      relevantUsers.length > 0
        ? (presentCount / relevantUsers.length) * 100
        : 0;

    return {
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      rate: rate.toFixed(1),
      total: relevantUsers.length,
    };
  }, [users, attendance, today, isGlobalView, currentStore.id]);

  const handleClockIn = (userId: string) => {
    if (userId !== currentUser?.id) {
      toast.error("You can only clock in for yourself");
      return;
    }

    if (currentUser?.role === "Admin") {
      toast.error("Admin accounts are not required to clock in");
      return;
    }

    if (
      !currentUser?.assignedStoreIds?.includes(currentStore.id)
    ) {
      toast.error("You can only clock in at your own store");
      return;
    }

    if (isGlobalView) {
      toast.error("Please switch to a specific store to clock in");
      return;
    }

    if (!window.confirm("Do you want to accept this clock-in action?")) {
      return;
    }

    const settings = storeSettings[currentStore.id] || {
      clockInTime: "08:00",
      gracePeriod: 15,
      lateArrivalPenaltyEnabled: true,
      latePenaltyType: "fixed",
      latePenaltyFixed: 500,
    };
    const now = new Date();
    const arrivalTime = currentUser?.expectedArrivalTime || settings.clockInTime;
    const threshold = currentUser?.lateThreshold ?? settings.gracePeriod;
    const [targetHour, targetMin] = arrivalTime.split(":").map(Number);
    const targetDate = new Date();
    targetDate.setHours(targetHour, targetMin, 0, 0);

    const diffMs = now.getTime() - targetDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    clockIn(userId, currentStore.id);

    if (settings.lateArrivalPenaltyEnabled && diffMins > threshold) {
      const penaltyAmount =
        settings.latePenaltyType === "fixed"
          ? settings.latePenaltyFixed
          : diffMins * (settings.latePenaltyPerMinute || 50);
      toast.warning(
        `Clocked in late by ${diffMins} minutes. Penalty: ${formatCurrency(penaltyAmount)}`,
      );
    } else {
      toast.success("Clocked in successfully");
    }
  };

  const handleClockOut = (userId: string) => {
    if (userId !== currentUser?.id) {
      toast.error("You can only clock out for yourself");
      return;
    }

    if (currentUser?.role === "Admin") {
      toast.error("Admin accounts are not required to clock in");
      return;
    }

    if (
      !currentUser?.assignedStoreIds?.includes(currentStore.id)
    ) {
      toast.error("You can only clock out at your own store");
      return;
    }

    if (isGlobalView) {
      toast.error("Please switch to a specific store to clock out");
      return;
    }

    if (!window.confirm("Do you want to accept this clock-out action?")) {
      return;
    }

    const settings = storeSettings[currentStore.id] || {
      clockOutTime: "18:00",
      earlyDeparturePenaltyEnabled: true,
      earlyDeparturePenaltyType: "fixed",
      earlyDeparturePenaltyFixed: 500,
      overtimeEnabled: false,
      overtimeMinThreshold: 30,
    };
    const now = new Date();
    const [targetHour, targetMin] = settings.clockOutTime
      .split(":")
      .map(Number);
    const targetDate = new Date();
    targetDate.setHours(targetHour, targetMin, 0, 0);

    const diffMs = targetDate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    clockOut(userId, currentStore.id);

    if (settings.earlyDeparturePenaltyEnabled && diffMins > 0) {
      const penaltyAmount =
        settings.earlyDeparturePenaltyType === "fixed"
          ? settings.earlyDeparturePenaltyFixed
          : diffMins * (settings.earlyDeparturePenaltyPerMinute || 50);
      toast.warning(
        `Clocked out early by ${diffMins} minutes. Penalty: ${formatCurrency(penaltyAmount)}`,
      );
    } else {
      const overtimeDiff = now.getTime() - targetDate.getTime();
      const overtimeMins = Math.floor(overtimeDiff / 60000);
      if (
        settings.overtimeEnabled &&
        overtimeMins >= settings.overtimeMinThreshold
      ) {
        toast.success(
          `Clocked out with ${Math.floor(overtimeMins / 60)}h ${overtimeMins % 60}m overtime!`,
        );
      } else {
        toast.success("Clocked out successfully");
      }
    }
  };

  // --- History Logic ---
  const historyData = useMemo(() => {
    let filtered = isGlobalView
      ? attendance
      : attendance.filter((a) => a.storeId === currentStore.id);

    if (historyFilterUser !== "all") {
      filtered = filtered.filter((a) => a.userId === historyFilterUser);
    }

    const now = new Date();
    if (historyFilterPeriod === "today") {
      filtered = filtered.filter((a) => a.date === today);
    } else if (historyFilterPeriod === "this-week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      filtered = filtered.filter((a) => a.date >= weekAgo);
    } else if (historyFilterPeriod === "this-month") {
      filtered = filtered.filter((a) => a.date.startsWith(currentMonth));
    } else if (historyFilterPeriod === "last-30-days") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      filtered = filtered.filter((a) => a.date >= thirtyDaysAgo);
    }

    if (historyFilterAction === "clock-in-only") {
      filtered = filtered.filter((a) => a.clockIn && !a.clockOut);
    } else if (historyFilterAction === "clock-out-only") {
      filtered = filtered.filter((a) => a.clockOut);
    } else if (historyFilterAction === "overtime-only") {
      filtered = filtered.filter((a) => {
        if (!a.clockOut) return false;
        const cout = new Date(a.clockOut);
        const user = users.find((u) => u.id === a.userId);
        const storeId = user?.assignedStoreIds[0] || currentStore.id;
        const s = storeSettings[storeId] || {
          clockOutTime: "18:00",
          overtimeMinThreshold: 30,
        };
        const [th, tm] = s.clockOutTime.split(":").map(Number);
        const tdate = new Date(cout);
        tdate.setHours(th, tm, 0, 0);
        const diff = Math.floor((cout.getTime() - tdate.getTime()) / 60000);
        return diff >= s.overtimeMinThreshold;
      });
    }

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [
    attendance,
    currentStore.id,
    historyFilterUser,
    historyFilterPeriod,
    historyFilterAction,
    today,
    currentMonth,
    isGlobalView,
    storeSettings,
    users,
  ]);

  const assignedStoresCount = currentUser?.assignedStoreIds?.length || 0;
  const todaySelfAttendance = todayAttendance.find(
    (record) => record.userId === currentUser?.id,
  );
  const currentClockStatus = !todaySelfAttendance?.clockIn
    ? "Not clocked in"
    : todaySelfAttendance.clockOut
      ? "Clocked out"
      : "Clocked in";

  const selfAttendanceStats = useMemo(() => {
    if (isAdmin) return { ratio: 0, lateCount: 0 };
    const userAtt = attendance.filter(
      (a) => a.userId === currentUser?.id && a.date.startsWith(currentMonth),
    );
    const daysPresent = userAtt.filter(
      (a) => a.status === "Present" || a.status === "Late",
    ).length;
    const s = storeSettings[currentStore.id] || { workingDaysPerMonth: 25 };
    const ratio = Math.round((daysPresent / s.workingDaysPerMonth) * 100);
    const lateCount = userAtt.filter((a) => a.status === "Late").length;
    return { ratio, lateCount };
  }, [isAdmin, attendance, currentUser?.id, currentMonth, currentStore.id, storeSettings]);

  const exportHistory = () => {
    const data = historyData.map((h) => {
      const user = users.find((u) => u.id === h.userId);
      let totalHours = 0;
      if (h.clockIn && h.clockOut) {
        totalHours =
          (new Date(h.clockOut).getTime() - new Date(h.clockIn).getTime()) /
          (1000 * 60 * 60);
      }
      return {
        Date: h.date,
        Staff: user?.name,
        Role: user?.role,
        "Clock In": h.clockIn ? new Date(h.clockIn).toLocaleTimeString() : "—",
        "Clock Out": h.clockOut
          ? new Date(h.clockOut).toLocaleTimeString()
          : "—",
        "Total Hours": totalHours.toFixed(2),
        Status: h.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance History");
    XLSX.writeFile(wb, `Attendance_History_${currentStore.name}.xlsx`);
    toast.success("Attendance history exported to Excel");
  };

  return (
    <div className={`p-4 md:p-6 space-y-6 min-h-screen ${theme === "dark" ? "bg-gray-900" : "bg-gray-50/30"}`}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-black tracking-tight ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
            Staff Management
          </h1>
          <p className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
            Manage attendance and performance for {currentStore.name}
          </p>
        </div>
      </div>

      {/* KPI Overview */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <Card className={`border-none shadow-sm rounded-2xl overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === "dark" ? "bg-indigo-500/10" : "bg-indigo-50"}`}>
                <Users className={`w-5 h-5 ${theme === "dark" ? "text-indigo-400" : "text-indigo-600"}`} />
              </div>
              <Badge className={`border-none text-[10px] font-bold ${theme === "dark" ? "bg-indigo-500/10 text-indigo-300" : "bg-indigo-50 text-indigo-700"}`}>
                {isAdmin ? "Network" : "Today"}
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isAdmin ? "Stores Managed" : "Clock Status"}
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <h3 className={`text-2xl font-black ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                {isAdmin ? assignedStoresCount : currentClockStatus}
              </h3>
              {isAdmin && (
                <span className="text-xs font-bold text-gray-400">stores</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-none shadow-sm rounded-2xl overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === "dark" ? "bg-green-500/10" : "bg-green-50"}`}>
                <CheckCircle2 className={`w-5 h-5 ${theme === "dark" ? "text-green-400" : "text-green-600"}`} />
              </div>
              <Badge className={`border-none text-[10px] font-bold ${theme === "dark" ? "bg-green-500/10 text-green-300" : "bg-green-50 text-green-700"}`}>
                Monthly
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Attendance Rate
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <h3 className={`text-2xl font-black ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                {isAdmin
                  ? attendanceStats.rate
                  : selfAttendanceStats.ratio}
                %
              </h3>
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-none shadow-sm rounded-2xl overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === "dark" ? "bg-amber-500/10" : "bg-amber-50"}`}>
                <Clock className={`w-5 h-5 ${theme === "dark" ? "text-amber-400" : "text-amber-600"}`} />
              </div>
              <Badge className={`border-none text-[10px] font-bold ${theme === "dark" ? "bg-amber-500/10 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
                Alerts
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Late Arrivals
            </p>
            <h3 className={`text-2xl font-black mt-0.5 ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
              {isAdmin
                ? attendanceStats.late
                : selfAttendanceStats.lateCount}
            </h3>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sub Tabs */}
      <Tabs
        defaultValue="attendance"
        className="w-full"
        onValueChange={setActiveSubTab}
      >
        <TabsList className={`p-1 rounded-xl h-12 shadow-sm mb-6 border ${theme === "dark" ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
          <TabsTrigger
            value="attendance"
            className={`rounded-lg px-6 h-10 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-bold transition-all ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
          >
            Daily Attendance
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="history"
              className={`rounded-lg px-6 h-10 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-bold transition-all ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              History
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger
              value="settings"
              className={`rounded-lg px-6 h-10 data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-bold transition-all ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Staff Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="attendance" className="mt-0">
          <Card className={`border-none shadow-sm rounded-2xl overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
            <CardHeader className={`p-6 border-b flex flex-row items-center justify-between ${theme === "dark" ? "border-gray-800" : "border-gray-50"}`}>
              <div>
                <CardTitle className={`text-lg font-black ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                  Attendance Tracker
                </CardTitle>
                <p className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  Record clock-in/out times for today,{" "}
                  {new Date().toLocaleDateString()}
                </p>
              </div>
              {canSeeAllStaff && (
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    placeholder="Search staff..."
                    className={`pl-9 h-9 border-none rounded-lg text-xs ${theme === "dark" ? "bg-gray-800 text-gray-100 placeholder:text-gray-500" : "bg-gray-50"}`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className={theme === "dark" ? "bg-gray-800/50" : "bg-gray-50/50"}>
                      <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Staff Member
                      </th>
                      <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Store / Role
                      </th>
                      <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Clock In
                      </th>
                      <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Clock Out
                      </th>
                      <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Status
                      </th>
                      <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={theme === "dark" ? "divide-y divide-gray-800" : "divide-y divide-gray-50"}>
                    {storeUsers
                      .filter((u) =>
                        u.name.toLowerCase().includes(searchTerm.toLowerCase()),
                      )
                      .map((user) => {
                        const att = todayAttendance.find(
                          (a) => a.userId === user.id,
                        );
                        const isSelf = user.id === currentUser?.id;

                        return (
                          <tr
                            key={user.id}
                            className={`transition-colors ${theme === "dark" ? "hover:bg-gray-800/50" : "hover:bg-gray-50/50"}`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${theme === "dark" ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
                                  {user.name[0]}
                                </div>
                                <div>
                                  <p className={`text-xs font-bold ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                                    {user.name}
                                  </p>
                                  <p className="text-[10px] text-gray-400 font-medium">
                                    {user.phone}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className={`text-xs font-bold ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                                {userStoreName(user)}
                              </p>
                              <Badge className={`border-none text-[9px] px-1.5 py-0 font-bold ${theme === "dark" ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                                {user.role}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-black ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                                {att?.clockIn
                                  ? new Date(att.clockIn).toLocaleTimeString(
                                      [],
                                      { hour: "2-digit", minute: "2-digit" },
                                    )
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-black ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                                {att?.clockOut
                                  ? new Date(att.clockOut).toLocaleTimeString(
                                      [],
                                      { hour: "2-digit", minute: "2-digit" },
                                    )
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {att ? (
                                <div className="flex flex-col gap-1">
                                  <Badge
                                    className={`${
                                      theme === "dark"
                                        ? att.status === "Present"
                                          ? "bg-green-500/10 text-green-300"
                                          : att.status === "Late"
                                            ? "bg-amber-500/10 text-amber-300"
                                            : "bg-red-500/10 text-red-300"
                                        : att.status === "Present"
                                          ? "bg-green-50 text-green-700"
                                          : att.status === "Late"
                                            ? "bg-amber-50 text-amber-700"
                                            : "bg-red-50 text-red-700"
                                    } border-none font-bold text-[10px]`}
                                  >
                                    {att.status}
                                  </Badge>
                                  {att.clockIn &&
                                    (() => {
                                      const cin = new Date(att.clockIn);
                                      const [th, tm] = userArrival(user)
                                        .split(":")
                                        .map(Number);
                                      const tdate = new Date(cin);
                                      tdate.setHours(th, tm, 0, 0);
                                      const diff = Math.floor(
                                        (cin.getTime() - tdate.getTime()) /
                                          60000,
                                      );
                                      if (diff > userThreshold(user)) {
                                        return (
                                          <span className="text-[9px] font-bold text-orange-500">
                                            Late by {diff} mins
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  {att.clockOut &&
                                    (() => {
                                      const cout = new Date(att.clockOut);
                                      const [th, tm] = settings.clockOutTime
                                        .split(":")
                                        .map(Number);
                                      const tdate = new Date(cout);
                                      tdate.setHours(th, tm, 0, 0);

                                      const earlyDiff = Math.floor(
                                        (tdate.getTime() - cout.getTime()) /
                                          60000,
                                      );
                                      const overtimeDiff = Math.floor(
                                        (cout.getTime() - tdate.getTime()) /
                                          60000,
                                      );

                                      if (earlyDiff > 0) {
                                        return (
                                          <span className="text-[9px] font-bold text-red-500">
                                            Early by {earlyDiff} mins
                                          </span>
                                        );
                                      }
                                      if (
                                        overtimeDiff >=
                                        settings.overtimeMinThreshold
                                      ) {
                                        return (
                                          <Badge className={`border-none text-[9px] font-bold w-fit ${theme === "dark" ? "bg-green-500/10 text-green-300" : "bg-green-50 text-green-700"}`}>
                                            OT: {(overtimeDiff / 60).toFixed(1)}
                                            h
                                          </Badge>
                                        );
                                      }
                                      return null;
                                    })()}
                                </div>
                              ) : user.role === "Admin" ? (
                                <Badge className={`border-none font-bold text-[10px] ${theme === "dark" ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-500"}`}>
                                  Not Required
                                </Badge>
                              ) : (
                                <Badge className={`border-none font-bold text-[10px] ${theme === "dark" ? "bg-gray-800 text-gray-400" : "bg-gray-50 text-gray-400"}`}>
                                  Not Clocked In
                                </Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {user.role === "Admin" ? (
                                <span className={`text-[10px] font-bold ${theme === "dark" ? "text-gray-600" : "text-gray-300"}`}>
                                  —
                                </span>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  {!att?.clockIn ? (
                                    <Button
                                      size="sm"
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 h-8 text-[11px] font-bold"
                                      onClick={() => handleClockIn(user.id)}
                                      disabled={!isSelf}
                                    >
                                      Clock In
                                    </Button>
                                  ) : !att?.clockOut ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={`rounded-lg px-3 h-8 text-[11px] font-bold border ${theme === "dark" ? "border-indigo-800 text-indigo-400 hover:bg-indigo-500/10" : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"}`}
                                      onClick={() => handleClockOut(user.id)}
                                      disabled={!isSelf}
                                    >
                                      Clock Out
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={`h-8 text-[11px] font-bold border ${theme === "dark" ? "text-indigo-400 border-indigo-800 bg-indigo-500/5" : "text-indigo-600 border-indigo-100 bg-indigo-50/30"}`}
                                      onClick={() => handleClockIn(user.id)}
                                      disabled={!isSelf}
                                    >
                                      Re-Clock In
                                    </Button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <>
          {isAdmin && (
            <TabsContent value="history" className="mt-0">
              <Card className={`border-none shadow-sm rounded-2xl overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
                <CardHeader className={`p-6 border-b space-y-4 ${theme === "dark" ? "border-gray-800" : "border-gray-50"}`}>
                  <div>
                    <CardTitle className={`text-lg font-black ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                      Attendance History
                    </CardTitle>
                    <p className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                      Detailed logs of all staff clock-in and clock-out actions
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                        Staff Member
                      </label>
                      <select
                        className={`border-none rounded-lg h-9 px-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 min-w-[150px] ${theme === "dark" ? "bg-gray-800 text-gray-100" : "bg-gray-50"}`}
                        value={historyFilterUser}
                        onChange={(e) => setHistoryFilterUser(e.target.value)}
                      >
                        <option value="all">All Staff</option>
                        {users
                          .filter((u) =>
                            u.assignedStoreIds.includes(currentStore.id),
                          )
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                        Period
                      </label>
                      <select
                        className={`border-none rounded-lg h-9 px-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 min-w-[150px] ${theme === "dark" ? "bg-gray-800 text-gray-100" : "bg-gray-50"}`}
                        value={historyFilterPeriod}
                        onChange={(e) => setHistoryFilterPeriod(e.target.value)}
                      >
                        <option value="today">Today</option>
                        <option value="this-week">This Week</option>
                        <option value="this-month">This Month</option>
                        <option value="last-30-days">Last 30 Days</option>
                        <option value="all-time">All Time</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                        Action Type
                      </label>
                      <select
                        className={`border-none rounded-lg h-9 px-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 min-w-[150px] ${theme === "dark" ? "bg-gray-800 text-gray-100" : "bg-gray-50"}`}
                        value={historyFilterAction}
                        onChange={(e) => setHistoryFilterAction(e.target.value)}
                      >
                        <option value="all">All Actions</option>
                        <option value="clock-in-only">Clock In Only</option>
                        <option value="clock-out-only">Clock Out Only</option>
                        <option value="overtime-only">Overtime Only</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 ml-auto">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                        &nbsp;
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-lg gap-2 text-xs font-bold"
                        onClick={exportHistory}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export History
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className={theme === "dark" ? "bg-gray-800/50" : "bg-gray-50/50"}>
                          <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Date
                          </th>
                          <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Staff Name
                          </th>
                          <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Store / Role
                          </th>
                          <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Clock In
                          </th>
                          <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Clock Out
                          </th>
                          <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Total Hours
                          </th>
                          <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className={theme === "dark" ? "divide-y divide-gray-800" : "divide-y divide-gray-50"}>
                        {historyData.map((a, idx) => {
                          const user = users.find((u) => u.id === a.userId);
                          let totalHours = "—";
                          if (a.clockIn && a.clockOut) {
                            const diff =
                              new Date(a.clockOut).getTime() -
                              new Date(a.clockIn).getTime();
                            totalHours =
                              (diff / (1000 * 60 * 60)).toFixed(1) + " hrs";
                          }

                          return (
                            <tr
                              key={idx}
                              className={`transition-colors text-xs ${theme === "dark" ? "hover:bg-gray-800/50" : "hover:bg-gray-50/50"}`}
                            >
                              <td className={`px-6 py-4 font-bold ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                                {new Date(a.date).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] ${theme === "dark" ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
                                    {user?.name[0]}
                                  </div>
                                  <span className={`font-bold ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                                    {user?.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className={`font-bold ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                                  {allStores.find((x) => x.id === a.storeId)
                                    ?.name || currentStore.name}
                                </p>
                                <p className="text-[10px] text-gray-400 font-medium uppercase">
                                  {user?.role}
                                </p>
                              </td>
                              <td className={`px-6 py-4 font-black ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                                {a.clockIn
                                  ? new Date(a.clockIn).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </td>
                              <td className={`px-6 py-4 font-black ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                                {a.clockOut
                                  ? new Date(a.clockOut).toLocaleTimeString(
                                      [],
                                      { hour: "2-digit", minute: "2-digit" },
                                    )
                                  : "—"}
                              </td>
                              <td className={`px-6 py-4 font-black ${theme === "dark" ? "text-indigo-400" : "text-indigo-600"}`}>
                                {totalHours}
                              </td>
                              <td className="px-6 py-4">
                                <Badge
                                  className={`${
                                    theme === "dark"
                                      ? a.status === "Present"
                                        ? "bg-green-500/10 text-green-300"
                                        : a.status === "Late"
                                          ? "bg-amber-500/10 text-amber-300"
                                          : "bg-red-500/10 text-red-300"
                                      : a.status === "Present"
                                        ? "bg-green-50 text-green-700"
                                        : a.status === "Late"
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-red-50 text-red-700"
                                  } border-none font-bold text-[10px]`}
                                >
                                  {a.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="settings" className="mt-0">
              <Card className={`border-none shadow-sm rounded-2xl overflow-hidden ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
                <CardHeader className={`p-6 border-b ${theme === "dark" ? "border-gray-800" : "border-gray-50"}`}>
                  <CardTitle className={`text-lg font-black flex items-center gap-2 ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                    <Clock className="w-5 h-5 text-indigo-600" />
                    Store Shift Settings
                  </CardTitle>
                  <p className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                    Configure default clock-in and clock-out times for{" "}
                    {currentStore.name}
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                        Default Clock-In
                      </label>
                      <Input
                        type="time"
                        value={settings.clockInTime}
                        onChange={(e) =>
                          updateStoreSettings(currentStore.id, {
                            clockInTime: e.target.value,
                          })
                        }
                        className={`h-11 rounded-xl border-none font-bold ${theme === "dark" ? "bg-gray-800 text-gray-100" : "bg-gray-50"}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                        Default Clock-Out
                      </label>
                      <Input
                        type="time"
                        value={settings.clockOutTime}
                        onChange={(e) =>
                          updateStoreSettings(currentStore.id, {
                            clockOutTime: e.target.value,
                          })
                        }
                        className={`h-11 rounded-xl border-none font-bold ${theme === "dark" ? "bg-gray-800 text-gray-100" : "bg-gray-50"}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </>
      </Tabs>
    </div>
  );
}
