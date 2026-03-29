"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Form from "@/components/form/Form";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import React, { useState } from "react";
import { useNotification } from "@/components/ui/notification";
import { getDefaultLandingPath } from "@/libs/landing";

type LoginResult = { ok: true } | { ok: false; error: string };

export default function SignInForm() {
    const [showPassword, setShowPassword] = useState(false);
    const [isChecked, setIsChecked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { notify } = useNotification();

    return (
        <div className="flex flex-col flex-1 lg:w-1/2 w-full">
            <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
                <div>
                    <div className="mb-5 sm:mb-8">
                        <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                            Sign In
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Enter your username and password to sign in!
                        </p>
                    </div>
                    <div>
                        <Form onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.target as HTMLFormElement & {
                                username: { value: string };
                                password: { value: string };
                            };

                            setIsSubmitting(true);
                            try {
                                const res = await fetch("/api/auth/login", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        username: form.username.value,
                                        password: form.password.value,
                                    }),
                                });

                                const data = (await res.json().catch(() => null)) as LoginResult | null;

                                if (res.ok && data?.ok) {
                                    // Decide landing page based on user role.
                                    const meRes = await fetch("/api/user", { method: "GET" }).catch(() => null);
                                    const meJson = meRes && meRes.ok ? await meRes.json().catch(() => null) : null;
                                    const currentUser = meJson?.data ?? null;

                                    window.location.href = getDefaultLandingPath(currentUser);
                                    return;
                                }

                                const msg =
                                    (data && "error" in data && data.error) ||
                                    "Invalid username or password";
                                notify({ variant: "error", title: "Sign in failed", message: msg });
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}>
                            <div className="space-y-6">
                                <div>
                                    <Label>
                                        Username <span className="text-error-500">*</span>{" "}
                                    </Label>
                                    <Input placeholder="Enter your username" type="text" id="username"/>
                                </div>
                                <div>
                                    <Label>
                                        Password <span className="text-error-500">*</span>{" "}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter your password"
                                            id="password"
                                        />
                                        <span
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                                        >
                                            {showPassword ? <EyeIcon className="fill-gray-500 dark:fill-gray-400"/>
                                                : <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400"/>}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Checkbox checked={isChecked} onChange={setIsChecked} disabled/>
                                        <span
                                            className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                                          Keep me logged in
                                        </span>
                                    </div>
                                    <Link
                                        href="/reset-password"
                                        className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div>
                                    <Button className="w-full" size="sm" type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? "Signing in..." : "Sign in"}
                                    </Button>
                                </div>
                            </div>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
    );
}
