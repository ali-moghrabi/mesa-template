export const ROLES = ["customer", "staff", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "menu:availability", //   mark dishes sold out / back in stock during service
  "menu:manage", //         create, edit, delete dishes and categories
  "reservations:view", //   see the bookings (the day, requests, guest details)
  "reservations:manage", // confirm, decline, seat, cancel, edit bookings, take phone bookings
  "orders:manage", //       see online orders and move them along (accept, preparing, ready, done)
  "orders:edit", //         change an order's dishes and prices, cancel paid orders, refund (owner only)
  "content:manage", //      events, gallery, testimonials, page texts
  "analytics:view", //      sales figures on the overview: revenue, top dishes, busiest times
  "users:manage", //        list users, change roles, disable accounts
  "settings:manage", //     restaurant settings (hours, currency rate, features)
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF: Permission[] = [
  "menu:availability",
  "reservations:view",
  "orders:manage",
];
const MANAGER: Permission[] = [
  ...STAFF,
  "reservations:manage",
  "menu:manage",
  "content:manage",
  "analytics:view",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: [],
  staff: STAFF,
  manager: MANAGER,
  admin: PERMISSIONS,
};

export function hasPermission(
  role: Role | undefined,
  permission: Permission,
): boolean {
  return !!role && ROLE_PERMISSIONS[role]?.includes(permission) === true;
}

export function hasAllPermissions(
  role: Role | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

export function canAccessAdmin(role: Role | undefined): boolean {
  return !!role && (ROLE_PERMISSIONS[role]?.length ?? 0) > 0;
}

export const ROLE_RANK: Record<Role, number> = {
  customer: 0,
  staff: 1,
  manager: 2,
  admin: 3,
};
