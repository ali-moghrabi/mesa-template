import React, { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginUserForm, LoginUserSchema } from "@/lib/schemas";
import { useMutation } from "@tanstack/react-query";
import { toast } from "../ui/toast";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { useSessionRefresh } from "@/hooks/use-session-refresh";
import { loginUser } from "../../lib/actions/auth.actions";

const SignInForm: React.FC<{
  setSignInDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSignUpDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ setSignInDialogOpen, setSignUpDialogOpen }) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { syncSession, isSyncing } = useSessionRefresh();

  const form = useForm<LoginUserForm>({
    resolver: zodResolver(LoginUserSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const { mutate: loginMutation, isPending } = useMutation({
    mutationFn: (data: LoginUserForm) => loginUser(data),
    onMutate: () => setErrorMessage(null),
    onSuccess: () => {
      toast.add({
        title: "Signed in successfully! Welcome Back.",
        type: "success",
      });

      void syncSession({
        then: () => {
          setSignInDialogOpen(false);
          setSignUpDialogOpen(false);
          form.reset();
        },
      });
    },
    onError: (error) => {
      setErrorMessage(String(error?.message || "Something went wrong!"));
      form.resetField("password");
    },
  });

  const busy = isPending || isSyncing;

  return (
    <div className="px-6 pb-7">
      <form
        onSubmit={form.handleSubmit((data) => loginMutation(data))}
        method="POST"
        noValidate
      >
        <FieldGroup className="gap-3">
          <Controller
            name="identifier"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1">
                <FieldLabel htmlFor="identifier">{`Email or Username`}</FieldLabel>
                <Input
                  {...field}
                  id="identifier"
                  aria-invalid={fieldState.invalid}
                  placeholder="enter email or username"
                  autoComplete="off"
                  className="h-11 border-neutral-300 transition placeholder:text-neutral-500 hover:border-neutral-500 focus-visible:ring-1 focus-visible:ring-neutral-500 dark:border-neutral-600 dark:hover:border-neutral-400 dark:focus-visible:ring-neutral-300"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1">
                <div className="flex items-center justify-between gap-4">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary transition-colors hover:text-primary/80 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    {...field}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    aria-invalid={fieldState.invalid}
                    placeholder="create a password"
                    autoComplete="off"
                    className="h-11 border-neutral-300 pr-11 transition placeholder:text-neutral-500 hover:border-neutral-500 focus-visible:ring-1 focus-visible:ring-neutral-500 dark:border-neutral-600 dark:hover:border-neutral-400 dark:focus-visible:ring-neutral-300"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-0 top-0 flex h-11 w-11 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {errorMessage ? (
            <p className="text-red-500 text-sm font-medium text-center">
              {errorMessage}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full cursor-pointer"
          >
            {busy ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              "Sign in"
            )}
          </Button>
        </FieldGroup>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {`Don't have an account?`}
        <button
          type="button"
          onClick={() => {
            setSignInDialogOpen(false);
            setSignUpDialogOpen(true);
          }}
          className="ml-1 font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary cursor-pointer"
        >
          Create one
        </button>
      </p>
    </div>
  );
};

export default SignInForm;
