export const ROLES = ['customer', 'staff', 'manager', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'menu:availability', //   mark dishes sold out / back in stock during service
  'menu:manage', //         create, edit, delete dishes and categories
  'reservations:manage', // see, confirm, cancel bookings
  'orders:manage', //       see and update online orders
  'content:manage', //      events, gallery, testimonials, page texts
  'users:manage', //        list users, change roles, disable accounts
  'settings:manage', //     restaurant settings (hours, currency rate, features)
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF: Permission[] = [
  'menu:availability',
  'reservations:manage',
  'orders:manage',
];
const MANAGER: Permission[] = [...STAFF, 'menu:manage', 'content:manage'];

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
