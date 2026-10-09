import React, { useState } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import Image from "next/image";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { RegisterUserForm, RegisterUserSchema } from "@/lib/schemas";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { useMutation } from "@tanstack/react-query";
import { registerUser } from "@/lib/actions/auth.actions";
import { toast } from "../ui/toast";

type Props = {
  brandName: string;
  lightLogo: string;
  darkLogo: string;
  setSignInDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSignUpDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const SignUpForm: React.FC<Props> = ({
  brandName,
  lightLogo,
  darkLogo,
  setSignInDialogOpen,
  setSignUpDialogOpen,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<RegisterUserForm>({
    resolver: zodResolver(RegisterUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
    },
  });

  const { mutate: registerMutation, isPending } = useMutation({
    mutationFn: async (data: RegisterUserForm) => {
      setErrorMessage(null);
      await registerUser(data);
    },
    onSuccess: () => {
      setSignUpDialogOpen(false);
      setSignInDialogOpen(true);

      toast.add({
        title: "Account Created Successfully!",
        type: "success",
      });

      form.reset();
    },
    onError: (error) => {
      setErrorMessage(String(error?.message || "Something went wrong!"));

      form.resetField("password");
    },
  });

  return (
    <DialogContent className="overflow-hidden rounded-2xl border-border/60 bg-background p-0 shadow-2xl sm:max-w-md">
      <DialogHeader className="items-center px-6 pt-8 pb-5 text-center gap-0">
        <div className="flex items-center justify-center">
          <Image
            src={`/${darkLogo}`}
            alt={brandName}
            width={65}
            height={65}
            className="size-16 rounded-full dark:hidden"
          />

          <Image
            src={`/${lightLogo}`}
            alt={brandName}
            width={65}
            height={65}
            className="hidden size-16 rounded-full dark:block"
          />
        </div>

        <div className="mt-4 flex flex-col items-center justify-center gap-1">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Create your account
          </DialogTitle>

          <DialogDescription className="max-w-xs text-sm leading-relaxed">
            Join {brandName}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="px-6 pb-7">
        <form
          onSubmit={form.handleSubmit((data) => registerMutation(data))}
          method="POST"
          noValidate
        >
          <FieldGroup className="gap-3">
            <div className="grid grid-cols-2 gap-1.25">
              <Controller
                name="firstName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1">
                    <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                    <Input
                      {...field}
                      id="firstName"
                      aria-invalid={fieldState.invalid}
                      placeholder="your first name"
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
                name="lastName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1">
                    <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                    <Input
                      {...field}
                      id="lastName"
                      aria-invalid={fieldState.invalid}
                      placeholder="your last name"
                      autoComplete="off"
                      className="h-11 border-neutral-300 transition placeholder:text-neutral-500 hover:border-neutral-500 focus-visible:ring-1 focus-visible:ring-neutral-500 dark:border-neutral-600 dark:hover:border-neutral-400 dark:focus-visible:ring-neutral-300"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="username"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1">
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input
                    {...field}
                    id="username"
                    aria-invalid={fieldState.invalid}
                    placeholder="your username"
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
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1">
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="email"
                    aria-invalid={fieldState.invalid}
                    placeholder="your email"
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
                  <FieldLabel htmlFor="password">Password</FieldLabel>
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

            <p className="text-xs leading-relaxed text-muted-foreground">
              By creating an account, you agree to our{" "}
              <button
                type="button"
                className="cursor-pointer font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="cursor-pointer font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
              >
                Privacy Policy
              </button>
              .
            </p>

            {errorMessage ? (
              <p className="text-red-500 text-sm font-medium text-center">
                {errorMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full cursor-pointer"
            >
              {isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                "Create account"
              )}
            </Button>
          </FieldGroup>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?
          <button
            type="button"
            onClick={() => {
              setSignUpDialogOpen(false);
              setSignInDialogOpen(true);
            }}
            className="ml-1 cursor-pointer font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Sign in
          </button>
        </p>
      </div>
    </DialogContent>
  );
};

export default SignUpForm;
