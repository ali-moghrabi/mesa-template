import React from "react";
import Image from "next/image";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import SignInForm from "@/components/auth/SignInForm";

type Props = {
  brandName: string;
  lightLogo: string;
  darkLogo: string;
  setSignInDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSignUpDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const AuthenticationDialog: React.FC<Props> = ({
  brandName,
  lightLogo,
  darkLogo,
  setSignInDialogOpen,
  setSignUpDialogOpen,
}) => {
  return (
    <DialogContent className="overflow-hidden rounded-2xl border-border/60 bg-background p-0 shadow-2xl sm:max-w-md">
      <DialogHeader className="items-center px-6 pt-8 pb-5 text-center">
        <div className="flex items-center justify-center">
          <Image
            src={`/${darkLogo}`}
            alt={brandName}
            width={65}
            height={65}
            className="size-16 dark:hidden rounded-full"
          />
          <Image
            src={`/${lightLogo}`}
            alt={brandName}
            width={65}
            height={65}
            className="hidden size-16 dark:block rounded-full"
          />
        </div>
        <div className="flex flex-col items-center justify-center gap-1">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Welcome back
          </DialogTitle>
          <DialogDescription className="max-w-xs text-sm leading-relaxed">
            Sign in to your {brandName} account to continue.
          </DialogDescription>
        </div>
      </DialogHeader>

      <SignInForm
        setSignInDialogOpen={setSignInDialogOpen}
        setSignUpDialogOpen={setSignUpDialogOpen}
      />
    </DialogContent>
  );
};

export default AuthenticationDialog;
