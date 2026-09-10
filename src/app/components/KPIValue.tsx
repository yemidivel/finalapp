import React, { useState, useEffect } from "react";
import { motion, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface KPIValueProps {
  value: number | string;
  formatter?: (v: number) => string;
  className?: string;
  animate?: boolean;
  compact?: boolean;
}

function autoCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    const v = value / 1_000_000_000;
    return (Number.isInteger(v) ? v.toString() : v.toFixed(1)) + "B";
  }
  if (abs >= 1_000_000) {
    const v = value / 1_000_000;
    return (Number.isInteger(v) ? v.toString() : v.toFixed(1)) + "M";
  }
  if (abs >= 1_000) {
    const v = value / 1_000;
    return (Number.isInteger(v) ? v.toString() : v.toFixed(1)) + "K";
  }
  return value.toLocaleString();
}

export function KPIValue({
  value,
  formatter,
  className,
  animate = false,
  compact = true,
}: KPIValueProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (typeof value === "number") {
      return formatter ? formatter(value) : compact ? autoCompact(value) : value.toLocaleString();
    }
    return String(value);
  });
  const spring = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    if (typeof value === "number" && animate) {
      spring.set(value);
    } else {
      if (typeof value === "number" && compact) {
        setDisplayValue(formatter ? formatter(value) : autoCompact(value));
      } else {
        setDisplayValue(
          typeof value === "number" && formatter
            ? formatter(value)
            : String(value),
        );
      }
    }
  }, [value, spring, animate, formatter, compact]);

  useEffect(() => {
    if (typeof value === "number" && animate) {
      return spring.onChange((latest) => {
        if (compact) {
          setDisplayValue(formatter ? formatter(Math.floor(latest)) : autoCompact(Math.floor(latest)));
        } else {
          setDisplayValue(
            formatter
              ? formatter(Math.floor(latest))
              : Math.floor(latest).toLocaleString(),
          );
        }
      });
    }
  }, [spring, formatter, value, animate, compact]);

  useEffect(() => {
    if (!animate || typeof value !== "number") {
      if (typeof value === "number" && compact) {
        setDisplayValue(formatter ? formatter(value) : autoCompact(value));
      } else {
        setDisplayValue(
          typeof value === "number" && formatter
            ? formatter(value)
            : String(value),
        );
      }
    }
  }, [value, formatter, animate, compact]);

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
        title={displayValue}
      >
        {displayValue}
      </motion.span>
    </div>
  );
}
