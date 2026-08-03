/** Browser-side Better Auth client for sign-in/up and session hooks. */
"use client";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();
export const { signIn, signUp, signOut, changePassword } = authClient;
