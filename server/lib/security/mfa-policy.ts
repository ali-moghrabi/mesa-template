import type { Role } from 'lib/constants/roles';

const TEAM_ROLES: readonly Role[] = ['staff', 'manager', 'admin'];

export function mfaRequiredRoles(): readonly Role[] {
  const raw = process.env.MFA_REQUIRED_ROLES?.trim().toLowerCase();
  if (raw === undefined || raw === '') return TEAM_ROLES;
  if (raw === 'none') return [];
  return raw
    .split(',')
    .map((r) => r.trim())
    .filter((r): r is Role =>
      (['customer', ...TEAM_ROLES] as string[]).includes(r),
    );
}

export const mfaRequiredFor = (role: Role | undefined) =>
  !!role && mfaRequiredRoles().includes(role);
