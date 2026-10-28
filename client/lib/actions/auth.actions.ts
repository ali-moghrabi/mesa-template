import axios from "axios";
import {
  LoginUserForm,
  LoginUserSchema,
  RegisterUserForm,
  RegisterUserSchema,
} from "../schemas";
import ServerEndpoint from "../server-endpoint";
import type { SetupInfo, SignInOutcome, TwoFactorGate } from "../two-factor";

type SignInBody = { message?: string; twoFactor?: TwoFactorGate };

const outcome = (data: SignInBody | undefined): SignInOutcome =>
  data?.twoFactor
    ? { status: "two-factor", gate: data.twoFactor }
    : { status: "signed-in" };

const messageOf = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429)
      return (
        firstMessage(error.response.data) ||
        "Too many tries. Please wait a minute and try again."
      );
    return firstMessage(error.response?.data) || fallback;
  }
  return fallback;
};
const firstMessage = (data: unknown): string | undefined => {
  const message = (data as { message?: unknown } | undefined)?.message;
  if (Array.isArray(message)) return String(message[0]);
  return typeof message === "string" ? message : undefined;
};

export async function registerUser(data: RegisterUserForm) {
  try {
    const parsedData = RegisterUserSchema.parse(data);

    const response = await ServerEndpoint.post("/auth/register", parsedData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status !== 201) {
      throw new Error(response.data.message || "Something went wrong");
    }
  } catch (error) {
    console.error(error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data.message || "Something went wrong");
    } else if (error instanceof Error) {
      throw new Error("Something went wrong");
    }
  }
}

export async function loginUser(data: LoginUserForm): Promise<SignInOutcome> {
  try {
    const parsedData = LoginUserSchema.parse(data);

    const response = await ServerEndpoint.post<SignInBody>(
      "/auth/login",
      parsedData,
      { headers: { "Content-Type": "application/json" } },
    );
    return outcome(response.data);
  } catch (error) {
    console.error(error);
    throw new Error(messageOf(error, "Something went wrong"));
  }
}

export async function loginWithGoogle(code: string): Promise<SignInOutcome> {
  try {
    const response = await ServerEndpoint.post<SignInBody>(
      "/auth/google",
      { code },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      },
    );
    return outcome(response.data);
  } catch (error) {
    console.error(error);
    throw new Error(
      messageOf(error, "Google sign-in failed. Please try again."),
    );
  }
}

export async function startTwoFactorSetup(
  challenge: string,
): Promise<SetupInfo> {
  try {
    const response = await ServerEndpoint.post<SetupInfo>("/auth/2fa/setup", {
      challenge,
    });
    return response.data;
  } catch (error) {
    throw new TwoFactorError(error, "We couldn't start the setup. Try again.");
  }
}

export async function verifyTwoFactor(
  challenge: string,
  code: string,
  trustDevice: boolean,
): Promise<{ recoveryCodes?: string[] }> {
  try {
    const response = await ServerEndpoint.post<{ recoveryCodes?: string[] }>(
      "/auth/2fa/verify",
      { challenge, code: code.trim(), trustDevice },
    );
    return { recoveryCodes: response.data.recoveryCodes };
  } catch (error) {
    throw new TwoFactorError(error, "That didn't work. Please try again.");
  }
}

export class TwoFactorError extends Error {
  readonly expired: boolean;
  constructor(error: unknown, fallback: string) {
    super(messageOf(error, fallback));
    this.expired = axios.isAxiosError(error) && error.response?.status === 401;
  }
}

export async function logoutUser() {
  try {
    const response = await ServerEndpoint.post("/auth/logout");

    if (response.status !== 200) {
      throw new Error(response.data.message || "Something went wrong");
    }
  } catch (error) {
    console.error(error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data.message || "Something went wrong");
    } else if (error instanceof Error) {
      throw new Error("Something went wrong");
    }
  }
}
