"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Loader2,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { confirmEmail } from "@/lib/actions/account.actions";
import type { VerifyLinkInfo } from "@/lib/account";
import { State } from "@/components/shared/NewsletterManage";

type Props = {
  token: string;
  info: VerifyLinkInfo;
  signedIn: boolean;
  brandName: string;
};

export function VerifyEmail({
  token,
  info: initial,
  signedIn,
  brandName,
}: Props) {
  const router = useRouter();
  const [info, setInfo] = useState(initial);
  const [justVerified, setJustVerified] = useState(false);
  const [error, setError] = useState<{ message: string; gone: boolean } | null>(
    null,
  );
  const [pending, start] = useTransition();

  const verify = () =>
    start(async () => {
      setError(null);
      const result = await confirmEmail(token);
      if (!result.ok)
        return setError({ message: result.message, gone: result.gone });
      setInfo(result.data);
      setJustVerified(true);
      if (signedIn) router.refresh();
    });

  const email = (
    <span className="font-semibold break-all text-foreground">
      {info.email}
    </span>
  );

  if (error?.gone)
    return <LinkProblem message={error.message} signedIn={signedIn} />;

  if (info.status === "verified") {
    return (
      <State
        icon={<BadgeCheck />}
        tone="success"
        title={justVerified ? "Email verified!" : "Already verified"}
      >
        <p>
          {email}{" "}
          {justVerified
            ? "is confirmed. Thanks!"
            : "was verified before, nothing more to do."}{" "}
          Booking and order emails from {brandName} will reach you there.
        </p>
        <Actions>
          {signedIn ? (
            <Primary href="/account">Go to my account</Primary>
          ) : (
            <Primary href="/">Back to the website</Primary>
          )}
          <Secondary href="/menu">See the menu</Secondary>
        </Actions>
      </State>
    );
  }

  return (
    <State icon={<MailCheck />} tone="brand" title="Confirm your email">
      <p>
        One click to confirm that {email} belongs to your {brandName} account.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" /> {error.message}
        </p>
      )}
      <Actions>
        <button
          type="button"
          disabled={pending}
          onClick={verify}
          className={PRIMARY}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          {pending ? "Verifying…" : "Verify my email"}
        </button>
      </Actions>
    </State>
  );
}

export function LinkProblem({
  message,
  signedIn,
}: {
  message: string;
  signedIn: boolean;
}) {
  return (
    <State
      icon={<AlertTriangle />}
      tone="warning"
      title="This link doesn't work anymore"
    >
      <p>{message}</p>
      <Actions>
        {signedIn ? (
          <Primary href="/account#verification">
            Send me a new link <ArrowRight className="size-4" />
          </Primary>
        ) : (
          <Primary href="/">Back to the website</Primary>
        )}
      </Actions>
      {!signedIn && (
        <p className="mt-5 text-sm text-foreground/55">
          Sign in, then ask for a new link from your account page.
        </p>
      )}
    </State>
  );
}

const PRIMARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-white shadow-[0_14px_30px_-16px_var(--primary)] transition hover:brightness-110 disabled:opacity-70";
const SECONDARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-foreground/15 px-6 font-semibold transition hover:bg-muted disabled:opacity-70";

const Primary = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className={PRIMARY}>
    {children}
  </Link>
);
const Secondary = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <Link href={href} className={SECONDARY}>
    {children}
  </Link>
);
const Actions = ({ children }: { children: ReactNode }) => (
  <div className="mt-7 flex flex-col justify-center gap-2.5 min-[480px]:flex-row">
    {children}
  </div>
);
