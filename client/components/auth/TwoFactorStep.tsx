"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  startTwoFactorSetup,
  TwoFactorError,
  verifyTwoFactor,
} from "@/lib/actions/auth.actions";
import {
  cleanCode,
  looksLikeBackupCode,
  TRUST_DAYS,
  type SetupInfo,
  type TwoFactorGate,
} from "@/lib/two-factor";
import {
  AuthenticatorSetup,
  CodeInput,
  RecoveryCodes,
  TrustDevice,
} from "./TwoFactorParts";

export function TwoFactorStep({
  gate,
  brand,
  onSignedIn,
  onRestart,
}: {
  gate: TwoFactorGate;
  brand: string;
  onSignedIn: () => void;
  onRestart: (message?: string) => void;
}) {
  const setup = gate.step === "setup";
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [trust, setTrust] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!setup) return;
    let alive = true;
    startTwoFactorSetup(gate.challenge)
      .then((data) => alive && setInfo(data))
      .catch((e: TwoFactorError) => {
        if (!alive) return;
        if (e.expired) onRestart(e.message);
        else setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [setup, gate.challenge, onRestart]);

  const submit = async (value = code) => {
    if (busy) return;
    const ready = backup ? looksLikeBackupCode(value) : cleanCode(value);
    if (!ready) {
      setError(
        backup
          ? "Enter a backup code, like abcde-12345."
          : "Enter the 6-digit code from your app.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await verifyTwoFactor(gate.challenge, value, trust);
      if (result.recoveryCodes?.length) setCodes(result.recoveryCodes);
      else onSignedIn();
    } catch (e) {
      const failure = e as TwoFactorError;
      if (failure.expired) return onRestart(failure.message);
      setError(failure.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (codes) {
    return (
      <div className="px-6 pb-7">
        <Heading
          title="Save your backup codes"
          text="Two-step sign-in is on."
        />
        <RecoveryCodes
          codes={codes}
          brand={brand}
          onDone={onSignedIn}
          doneLabel="Done, continue"
        />
      </div>
    );
  }

  return (
    <form
      className="px-6 pb-7"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Heading
        title={setup ? "Set up two-step sign-in" : "Two-step sign-in"}
        text={
          setup
            ? "Your role in the team needs a code from an authenticator app at each sign-in. It takes a minute."
            : backup
              ? "Enter one of the backup codes you saved."
              : "Open your authenticator app and enter the 6-digit code."
        }
      />

      {setup && (
        <AuthenticatorSetup info={info} loading={!info} className="mb-4" />
      )}

      <CodeInput
        id="two-factor-code"
        value={code}
        onChange={(v) => {
          setCode(v);
          if (error) setError(null);
        }}
        onComplete={(v) => void submit(v)}
        backup={backup}
        invalid={!!error}
        disabled={busy || (setup && !info)}
        autoFocus={!setup}
      />

      <p
        role="alert"
        aria-live="polite"
        className="mt-2 min-h-5 text-center text-sm font-medium text-destructive"
      >
        {error}
      </p>

      <div className="mt-2 grid gap-4">
        <TrustDevice checked={trust} onChange={setTrust} days={TRUST_DAYS} />

        <Button
          type="submit"
          disabled={busy || (setup && !info)}
          className="h-11 w-full cursor-pointer"
        >
          {busy ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : setup ? (
            "Turn on and sign in"
          ) : (
            "Verify and sign in"
          )}
        </Button>

        <div className="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => onRestart()}
            className="inline-flex items-center gap-1.5 text-foreground/60 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
          {!setup && (
            <button
              type="button"
              onClick={() => {
                setBackup((b) => !b);
                setCode("");
                setError(null);
              }}
              className="font-medium text-primary hover:underline"
            >
              {backup ? "Use the app instead" : "Use a backup code"}
            </button>
          )}
        </div>

        {!setup && (
          <p className="text-center text-xs text-pretty text-foreground/50">
            Lost your phone and your backup codes? Contact the restaurant and
            they can reset it for you.
          </p>
        )}
      </div>
    </form>
  );
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl bg-primary/8 p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <ShieldCheck className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-pretty text-foreground/65">{text}</p>
      </div>
    </div>
  );
}
