import { cn } from "./ui/utils";

/**
 * The status beacon used beside page headings and the store name in the
 * navigation. A steady green core with a ping ring, so it reads as "live" at a
 * glance. `size` maps to a Tailwind sizing class; the default is deliberately
 * larger than the tiny nav dot so page headers get a prominent beacon.
 */
export function LiveDot({
  size = "h-3.5 w-3.5",
  className,
}: {
  size?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", size, className)}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-secondary-fixed-dim opacity-75 animate-ping" />
      <span className="relative inline-flex h-full w-full rounded-full bg-on-secondary-container" />
    </span>
  );
}
