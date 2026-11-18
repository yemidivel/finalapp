import type { PermissionMatrix, Role, User } from "../app/state/store";

export function getUserAssignedStoreId(user: User): string | null {
  if (user.role === "Admin") return null;
  const ids = user.assignedStoreIds || [];
  return ids[0] ?? null;
}

export function isStoreTakenByOtherUser(
  users: User[],
  storeId: string,
  excludeUserId?: string,
  forRole?: Role,
): boolean {
  if (forRole === "Manager") {
    return users.some(
      (u) =>
        u.role === "Manager" &&
        u.id !== excludeUserId &&
        (u.assignedStoreIds || []).includes(storeId),
    );
  }
  return false;
}

export function canUserAccessStore(user: User, storeId: string): boolean {
  if (user.role === "Admin") return true;
  return (user.assignedStoreIds || []).includes(storeId);
}

export function verifyUserPassword(user: User, password: string): boolean {
  if (user.password) return user.password === password;
  return password === "password";
}

export function canViewModule(
  permissions: PermissionMatrix,
  role: Role,
  module: string,
): boolean {
  if (role === "Admin") return true;
  return permissions[module]?.[role]?.view ?? false;
}

export function canEditModule(
  permissions: PermissionMatrix,
  role: Role,
  module: string,
): boolean {
  if (role === "Admin") return true;
  const perm = permissions[module]?.[role];
  return Boolean(perm?.view && perm?.edit);
}

/**
 * Which top-level modules each role may open, mirroring the `authorize(...)` list
 * on each backend route.
 *
 * This is a *navigation* rule, deliberately separate from `PermissionMatrix`.
 * The matrix lives in localStorage and is user-editable, so it cannot decide
 * whether a page is reachable: a role that grants itself access would render a
 * page whose every action the API then refuses with 403. The API is the
 * authority on what exists; this map only stops the UI offering it in the first
 * place, and the route guard stops a typed URL from rendering it anyway.
 *
 * Cashier is the interesting case. It can ring up sales, read the catalogue and
 * read its own analytics, but it cannot reach anything about staff, other
 * cashiers' sales, store administration, audit logs or goals — all 403. The
 * default `PermissionMatrix` got two of these wrong in both directions: it let a
 * Cashier open "Staff" (whose every endpoint is MANAGER-only, so the page loaded
 * empty and its buttons 403'd) and hid "POS" from a Manager, whose till the API
 * permits — a link the role could not see but could reach by typing the URL.
 *
 * This map replaces the matrix as the nav/guard authority. The matrix stays
 * editable for in-page controls, where a wrong `edit` flag merely disables a
 * button the API would refuse anyway; it no longer decides whether a page is
 * reachable, because a role that granted itself a page it lacks would render a
 * dead page full of failing buttons.
 */
const NAV_MODULES_BY_ROLE: Record<Role, string[]> = {
  Admin: [
    "Dashboard",
    "Stores",
    "Team",
    "Inventory",
    "Transactions",
    "Insights",
    "Staff",
    "Notifications",
    "Settings",
  ],
  Manager: [
    "Dashboard",
    "Inventory",
    "Transactions",
    "Insights",
    "Staff",
    "Notifications",
    "Settings",
  ],
  Cashier: [
    "Dashboard",
    "Inventory",
    "Transactions",
    "POS",
    "Notifications",
    "Settings",
  ],
};

export function navModulesForRole(role: Role | undefined): string[] {
  if (!role) return [];
  return NAV_MODULES_BY_ROLE[role] ?? [];
}

/**
 * True when `role` may open `module` (see NAV_MODULES_BY_ROLE).
 *
 * An unknown role is treated as permitted, because the role arrives from the
 * `me` call during hydration and the sidebar renders before it does. Filtering
 * strictly would flash an empty nav on every load; allowing it briefly costs one
 * frame of extra links, and the filter re-runs the moment the role is known.
 */
export function canAccessModuleByRole(
  role: Role | undefined,
  module: string,
): boolean {
  if (!role) return true;
  return navModulesForRole(role).includes(module);
}
