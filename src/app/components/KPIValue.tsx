import React, { useState, useEffect } from "react";
import { motion, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface KPIValueProps {
  value: number | string;
  formatter?: (v: number) => string;
  className?: string;
  animate?: boolean;
}

/**
 * Full grouped digits, never abbreviated.
 *
 * This used to collapse to "1.5M" / "12.4K". Every figure on the KPI cards is
 * money or a unit count that has to reconcile with a receipt, so the digits are
 * always shown in full. The `getFontSizeClass` helper below already steps the
 * type down for longer strings, so a seven-figure number still fits.
 *
 * A `compact` prop used to switch between the two behaviours. Nothing passed it,
 * and the abbreviated branch is gone, so the prop is removed rather than left
 * as a no-op that suggests the behaviour is still selectable.
 */
function formatFull(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function KPIValue({
  value,
  formatter,
  className,
  animate = false,
}: KPIValueProps) {
  const render = (v: number) => (formatter ? formatter(v) : formatFull(v));

  const [displayValue, setDisplayValue] = useState<string>(() =>
    typeof value === "number" ? render(value) : String(value),
  );
  const spring = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    if (typeof value === "number" && animate) {
      spring.set(value);
    } else {
      setDisplayValue(
        typeof value === "number" ? render(value) : String(value),
      );
    }
  }, [value, spring, animate, formatter]);

  useEffect(() => {
    if (typeof value === "number" && animate) {
      return spring.on("change", (latest) => {
        setDisplayValue(render(Math.floor(latest)));
      });
    }
  }, [spring, formatter, value, animate]);

  useEffect(() => {
    if (!animate || typeof value !== "number") {
      setDisplayValue(
        typeof value === "number" ? render(value) : String(value),
      );
    }
  }, [value, formatter, animate]);

  const getFontSizeClass = (text: string) => {
    const length = text.replace(/\s+/g, "").length;
    if (length > 24) return "text-xs sm:text-sm";
    if (length > 20) return "text-sm sm:text-base";
    if (length > 17) return "text-base sm:text-lg";
    if (length > 14) return "text-lg sm:text-xl";
    if (length > 12) return "text-xl sm:text-2xl";
    if (length > 10) return "text-2xl sm:text-3xl";
    return "text-3xl";
  };

  const fontSizeClass = getFontSizeClass(displayValue);

  return (
    <div className={cn("flex items-baseline min-w-0 w-full", className)}>
      <motion.span
        className={cn(
          "font-black tracking-tight w-full transition-all duration-300 leading-tight tabular-nums whitespace-nowrap overflow-hidden text-ellipsis",
          fontSizeClass,
        )}
      >
        {displayValue}
      </motion.span>
    </div>
  );
}
