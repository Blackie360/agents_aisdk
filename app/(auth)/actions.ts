"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export interface LoginActionState {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
}

export const login = async (
  formData: FormData,
): Promise<void> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const result = await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    if (result?.error) {
      throw new Error("Invalid credentials");
    }

    redirect("/");
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error("Invalid email or password");
    }
    throw error;
  }
};

export interface RegisterActionState {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
}

export const register = async (
  formData: FormData,
): Promise<void> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const { getUser, createUser } = await import("@/db/queries");

    // Check if user already exists
    const existingUsers = await getUser(validatedData.email);
    if (existingUsers.length > 0) {
      throw new Error("User already exists");
    }

    // Create new user
    await createUser(validatedData.email, validatedData.password);

    // Sign in the new user
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    redirect("/");
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error("Invalid email or password");
    }
    throw error;
  }
};
