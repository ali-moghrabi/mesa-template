export type TwoFactorState = {
  enabled: boolean;
  enabledAt?: string;
  required: boolean;
  recoveryCodesLeft: number;
  trustedDevices: number;
};

export type SetupInfo = {
  secret: string;
  uri: string;
  issuer: string;
  account: string;
};

export type TwoFactorGate = {
  step: "verify" | "setup";
  challenge: string;
  expiresAt: string;
};

export type SignInOutcome =
  | { status: "signed-in" }
  | { status: "two-factor"; gate: TwoFactorGate };

export const TRUST_DAYS = 30;
export const CODE_LENGTH = 6;

export const cleanCode = (value: string) => {
  const digits = value.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
};

export const looksLikeBackupCode = (value: string) =>
  value.replace(/[^a-z0-9]/gi, "").length === 10;

export const AUTHENTICATOR_APPS = [
  "Google Authenticator",
  "Microsoft Authenticator",
  "2FAS",
  "Aegis (Android)",
];
