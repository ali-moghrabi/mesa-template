"use client";

import type { Dispatch, SetStateAction } from "react";
import { Dialog } from "@/components/ui/dialog";
import QueryWrapper from "@/components/providers/query-wrapper";
import SignUpForm from "@/components/auth/SignUpForm";
import AuthenticationDialog from "./AuthenticationDialog";

export default function AuthDialogs({
  brandName,
  lightLogo,
  darkLogo,
  signInOpen,
  setSignInOpen,
  signUpOpen,
  setSignUpOpen,
}: {
  brandName: string;
  lightLogo: string;
  darkLogo: string;
  signInOpen: boolean;
  setSignInOpen: Dispatch<SetStateAction<boolean>>;
  signUpOpen: boolean;
  setSignUpOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <QueryWrapper>
      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <AuthenticationDialog
          brandName={brandName}
          lightLogo={lightLogo}
          darkLogo={darkLogo}
          setSignInDialogOpen={setSignInOpen}
          setSignUpDialogOpen={setSignUpOpen}
        />
      </Dialog>
      <Dialog open={signUpOpen} onOpenChange={setSignUpOpen}>
        <SignUpForm
          brandName={brandName}
          lightLogo={lightLogo}
          darkLogo={darkLogo}
          setSignInDialogOpen={setSignInOpen}
          setSignUpDialogOpen={setSignUpOpen}
        />
      </Dialog>
    </QueryWrapper>
  );
}
