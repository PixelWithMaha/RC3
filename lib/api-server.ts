// Shared helpers for app/api/* route handlers (server only).
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createTokenClient } from "@supabase/supabase-js";
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
  // Browser requests use the SSR cookie session; scripts (e.g. the demo seed) may send a Bearer token.
  // Either way Supabase verifies the JWT and every query runs under that user's RLS.
  const auth = (await headers()).get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const supabase = token
    ? createTokenClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await createClient();
  const {
    data: { user },
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
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

/** Job columns returned to clients (embedding excluded). */
export const JOB_COLUMNS =
  "id, recruiter_id, title, department, location, type, salary_min, salary_max, description, required_skills, preferred_skills, min_experience_years, qualifications, status, created_at, updated_at";
