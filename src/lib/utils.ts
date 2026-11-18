import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number in full, with thousands separators.
 *
 * This replaced an `abbreviateNumber` that rendered 1_500_000 as "1.5M" and
 * 12_400 as "12.4k". On a till, a sales figure that has been silently rounded
 * to one decimal place in millions is not a sales figure — the cashier and the
 * owner read different numbers, and the KPI no longer matches the receipt.
 * Full grouped digits also stay copy-pasteable into a spreadsheet.
 *
 * Whole numbers are shown without decimals; anything with a fractional part
 * keeps up to two, with trailing zeros dropped (1_250.5 -> "1,250.5").
 */
export function formatFullNumber(num: number, maxDecimals = 2): string {
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

export function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\r\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;encoding=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
