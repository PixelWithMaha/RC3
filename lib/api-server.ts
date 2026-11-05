// Shared helpers for app/api/* route handlers (server only).
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export type AuthContext = { supabase: SupabaseClient; user: User; profile: Profile };

/** Checks session + role (AUTH-5). Returns a ready NextResponse on failure. */
export async function requireUser(role?: Role): Promise<AuthContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Not authenticated", 401);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return jsonError("Profile not found", 403);
  if (role && profile.role !== role) return jsonError("Forbidden", 403);
  return { supabase, user, profile: profile as Profile };
}

/** Parses and validates a JSON body with zod (AUTH-8). */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T | NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const r = schema.safeParse(body);
  if (!r.success) return jsonError("Invalid input: " + r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "), 400);
  return r.data;
}
