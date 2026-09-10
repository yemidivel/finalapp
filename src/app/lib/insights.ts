import {
  ShieldAlert,
  AlertCircle,
  PackageX,
  Tag,
  Clock,
  Star,
  Layers,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import type { InventoryItem } from "../state/store";

export type InsightPriority = "Critical" | "High" | "Medium" | "Low";

export type InsightCategory = "Inventory" | "Sales" | "Product";

export type Insight = {
  id: string;
  title: string;
  type: string;
  category: InsightCategory;
  product: string;
  message: string;
  priority: InsightPriority;
  action: string;
  icon: LucideIcon;
  trendColor: string;
  trendData: { value: number }[];
  timestamp: string;
};

type TrendKind = "up" | "down" | "flat";

function generateTrend(kind: TrendKind, points = 6): { value: number }[] {
  const data: { value: number }[] = [];
  let val = kind === "up" ? 20 : kind === "down" ? 80 : 50;
  for (let i = 0; i < points; i++) {
    if (kind === "up") val += Math.random() * 15;
    else if (kind === "down") val -= Math.random() * 15;
    else val += (Math.random() - 0.5) * 10;
    data.push({ value: Math.max(0, Math.round(val)) });
  }
  return data;
}

function formatRelativeTime(minutes: number): string {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/**
 * Deterministic, rule-based insights engine. Pure client-side logic — no AI
 * model call. Insights are stamped at fake 8-minute intervals, filtered to the
 * last 6 hours, capped at 20, newest first.
 */
export function generateInsights(
  inventoryArray: InventoryItem[],
  dailySales: Record<number, number> = {},
): Insight[] {
  const now = Date.now();
  let sequence = 0;
  const list: Array<Omit<Insight, "timestamp"> & { timestampValue: string }> =
    [];

  const pushInsight = (
    insight: Omit<Insight, "timestamp" | "timestampValue">,
  ) => {
    sequence += 1;
    list.push({
      ...insight,
      timestampValue: new Date(
        now - sequence * 8 * 60 * 1000,
      ).toISOString(),
    });
  };

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const today = new Date();

  inventoryArray.forEach((p) => {
    const soldToday = dailySales[p.id] || 0;

    if (p.stock < p.reorderPoint) {
      pushInsight({
        id: `critical-${p.id}`,
        title: "Critical Stock Alert",
        type: "Stock Alert",
        category: "Inventory",
        product: p.name,
        message: `${p.name} is critically low (${p.stock} units, reorder point ${p.reorderPoint}). Risk of stockout.`,
        priority: "Critical",
        action: "Reorder Now",
        icon: ShieldAlert,
        trendColor: "#ef4444",
        trendData: generateTrend("down"),
      });
    } else if (p.stock < p.reorderPoint * 2) {
      pushInsight({
        id: `med-${p.id}`,
        title: "Medium Priority Stock",
        type: "Stock Alert",
        category: "Inventory",
        product: p.name,
        message: `${p.name} stock level is ${p.stock}. Plan restocking soon to maintain optimal levels.`,
        priority: "High",
        action: "Reorder",
        icon: AlertCircle,
        trendColor: "#f97316",
        trendData: generateTrend("down"),
      });
    }

    if (soldToday === 0 && p.stock > 100) {
      pushInsight({
        id: `dead-${p.id}`,
        title: "Dead Stock Alert",
        type: "Stock Alert",
        category: "Product",
        product: p.name,
        message: `${p.name} (Stock: ${p.stock}) has not sold recently. Consider creating a promotion.`,
        priority: "Medium",
        action: "Create Promo",
        icon: PackageX,
        trendColor: "#94a3b8",
        trendData: generateTrend("flat"),
      });
    }

    if (soldToday === 0 && p.stock > p.reorderPoint && p.stock < 100) {
      pushInsight({
        id: `discount-${p.id}`,
        title: "Discount Recommendation",
        type: "Pricing Insight",
        category: "Sales",
        product: p.name,
        message: `No sales yet today for ${p.name}. Apply a small discount to boost movement.`,
        priority: "Low",
        action: "Apply Discount",
        icon: Tag,
        trendColor: "#3b82f6",
        trendData: generateTrend("down"),
      });
    }

    if (soldToday > 0 && soldToday < 3) {
      pushInsight({
        id: `slow-${p.id}`,
        title: "Slow-Moving Product",
        type: "Stock Alert",
        category: "Product",
        product: p.name,
        message: `${p.name} sold only ${soldToday} units today. Consider bundling or promotion.`,
        priority: "Low",
        action: "Create Bundle",
        icon: Clock,
        trendColor: "#eab308",
        trendData: generateTrend("down"),
      });
    }

    if (soldToday > 15) {
      pushInsight({
        id: `top-${p.id}`,
        title: "Top Performer",
        type: "Sales Highlight",
        category: "Sales",
        product: p.name,
        message: `${p.name} is a top seller today (${soldToday} units) and stock is dropping fast. Increase safety stock?`,
        priority: "Low",
        action: "View Product",
        icon: Star,
        trendColor: "#10b981",
        trendData: generateTrend("up"),
      });
    }

    if (p.stock > 250) {
      pushInsight({
        id: `overstock-${p.id}`,
        title: "Overstock Alert",
        type: "Stock Alert",
        category: "Inventory",
        product: p.name,
        message: `${p.name} (${p.stock} units) is heavily stocked. Consider a promo to improve turnover.`,
        priority: "Medium",
        action: "Create Promo",
        icon: Layers,
        trendColor: "#8b5cf6",
        trendData: generateTrend("flat"),
      });
    }

    if (p.expiryDate) {
      const expiry = new Date(p.expiryDate);
      if (expiry < today) {
        pushInsight({
          id: `expired-${p.id}`,
          title: "Product Expired",
          type: "Expiry Alert",
          category: "Inventory",
          product: p.name,
          message: `${p.name} expired on ${expiry.toLocaleDateString()}. Remove from shelf immediately.`,
          priority: "Critical",
          action: "Remove Item",
          icon: CalendarClock,
          trendColor: "#ef4444",
          trendData: generateTrend("down"),
        });
      } else if (expiry <= thirtyDaysFromNow) {
        pushInsight({
          id: `expiring-${p.id}`,
          title: "Expiring Soon",
          type: "Expiry Alert",
          category: "Inventory",
          product: p.name,
          message: `${p.name} expires in ${Math.ceil(
            (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          )} days. Review stock level (${p.stock}).`,
          priority: "High",
          action: "Markdown",
          icon: CalendarClock,
          trendColor: "#f97316",
          trendData: generateTrend("down"),
        });
      }
    }
  });

  return list
    .filter(
      (insight) =>
        (now - new Date(insight.timestampValue).getTime()) /
          (1000 * 60 * 60) <=
        6,
    )
    .sort(
      (a, b) =>
        new Date(b.timestampValue).getTime() -
        new Date(a.timestampValue).getTime(),
    )
    .slice(0, 20)
    .map(({ timestampValue, ...insight }) => ({
      ...insight,
      timestamp: formatRelativeTime(
        Math.max(0, Math.floor((now - new Date(timestampValue).getTime()) / 60000)),
      ),
    }));
}
