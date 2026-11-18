/**
 * Pure cart helpers for the POS.
 *
 * A transaction can hold any number of distinct products, so every mutation
 * must merge into the previous map instead of rebuilding it from a captured
 * closure — that is what makes a second line silently disappear when two adds
 * land in the same render.
 *
 * `CartMap` is keyed by the backend UUID string of the product.
 */
export type CartMap = Record<string, number>;

/** Number of distinct products in the order (not the unit count). */
export function distinctLines(cart: CartMap): number {
  return Object.keys(cart).length;
}

/** Total units across every line. */
export function totalUnits(cart: CartMap): number {
  return Object.values(cart).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

/** Drop a line entirely. */
export function removeLine(cart: CartMap, id: string): CartMap {
  if (!(id in cart)) return cart;
  const { [id]: _removed, ...rest } = cart;
  return rest;
}

/**
 * Set the quantity of one line.
 *
 * `qty` is the quantity for THIS line (what the quantity dialog shows), not an
 * increment. The dialog opens at the current line quantity, so confirming it
 * sets an explicit number and re-adding a product already in the cart can no
 * longer double it. A quantity of 0 or less removes the line.
 */
export function setLine(
  cart: CartMap,
  id: string,
  qty: number,
  stock: number,
): CartMap {
  const requested = Number.isFinite(qty) ? Math.round(qty) : 1;
  if (requested <= 0) return removeLine(cart, id);
  const next = Math.min(requested, stock);
  if (next <= 0) return cart;
  if (cart[id] === next) return cart;
  return { ...cart, [id]: next };
}

/**
 * Add `delta` to a line, for the barcode scanner and the quick-add tiles where
 * "one more" is the intent. Clamped to what is actually on the shelf.
 */
export function bumpLine(
  cart: CartMap,
  id: string,
  delta: number,
  stock: number,
): CartMap {
  const current = cart[id] ?? 0;
  const next = Math.min(current + delta, stock);
  if (next <= 0) return removeLine(cart, id);
  if (cart[id] === next) return cart;
  return { ...cart, [id]: next };
}
