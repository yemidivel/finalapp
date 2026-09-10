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
