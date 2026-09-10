import React from "react";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "./ui/button";
import { fadeInUp } from "../../animations/variants";
import type { Insight } from "../lib/insights";

const priorityStyles: Record<
  Insight["priority"],
  { badge: string; bar: string }
> = {
  Critical: {
    badge: "bg-red-100 text-red-700 border-red-200",
    bar: "bg-red-500",
  },
  High: {
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    bar: "bg-orange-500",
  },
  Medium: {
    badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    bar: "bg-yellow-500",
  },
  Low: {
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    bar: "bg-gray-400",
  },
};

const categoryStyles: Record<Insight["category"], string> = {
  Inventory: "bg-indigo-50 text-indigo-600 border-indigo-100",
  Sales: "bg-emerald-50 text-emerald-600 border-emerald-100",
  Product: "bg-purple-50 text-purple-600 border-purple-100",
};

export function AISummaryCard({
  insight,
  onAction,
  index = 0,
}: {
  insight: Insight;
  onAction?: (insight: Insight) => void;
  index?: number;
}) {
  const Icon = insight.icon;
  const priority = priorityStyles[insight.priority] || priorityStyles.Low;

  return (
    <motion.div
      variants={fadeInUp}
      custom={index}
      whileHover={{ y: -4, boxShadow: "0 16px 32px -12px rgba(79,70,229,0.18)" }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="group rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:border-indigo-200 transition-colors"
    >
      <div className={`h-1 w-full ${priority.bar}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner transition-transform group-hover:scale-105"
            style={{ backgroundColor: `${insight.trendColor}18`, color: insight.trendColor }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest ${priority.badge}`}
            >
              {insight.priority}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest ${categoryStyles[insight.category] || "bg-gray-50 text-gray-500 border-gray-200"}`}
            >
              {insight.category}
            </span>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-bold text-sm text-gray-900 leading-tight">
            {insight.title}
          </h4>
          {insight.trendData?.length > 0 && (
            <div className="h-10 w-24 flex-shrink-0 bg-gray-50/70 rounded-lg p-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={insight.trendData}>
                  <Tooltip
                    contentStyle={{
                      fontSize: "10px",
                      borderRadius: "8px",
                      border: "1px solid rgba(0,0,0,0.06)",
                      padding: "4px 8px",
                    }}
                    formatter={(value: number) => [`${value}`, "Trend"]}
                    labelFormatter={() => ""}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={insight.trendColor}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                    animationDuration={600}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-4">
          {insight.message}
        </p>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            {insight.timestamp}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 rounded-lg"
            onClick={() => onAction?.(insight)}
          >
            {insight.action}
            <span className="ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default AISummaryCard;
