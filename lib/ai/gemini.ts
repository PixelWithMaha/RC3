// Server-only Gemini client. Never import from client components.
import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { EMBEDDING_DIM } from "@/lib/types";

// gemini-2.5-flash is closed to new API keys. Retries walk a chain of models so a demand
// spike (503/429) on one model doesn't break the demo.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.8-flash";
// Lite models stay available when the big ones are overloaded, so they come right after the primary.
const MODEL_CHAIN = [...new Set([GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", GEMINI_FALLBACK_MODEL])];
const ATTEMPT_TIMEOUT_MS = 15_000; // a slow 503 on one model must not eat the whole budget
const TOTAL_BUDGET_MS = 50_000; // stays under route maxDuration (60s)
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (typeof window !== "undefined") throw new Error("Gemini client is server-only");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIError("GEMINI_API_KEY is not configured");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

/**
 * Structured JSON generation. Validates with zod; on overload / timeout / invalid JSON it
 * retries on the next model in the chain (short backoff) within a total time budget,
 * then throws AIError (PRD §7 failure handling).
 */
export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  zod: z.ZodType<T>;
  temperature?: number;
  timeoutMs?: number;
}): Promise<T> {
  let lastErr: unknown;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  for (let attempt = 0; attempt < MODEL_CHAIN.length; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(400 * attempt, remaining / 4)));
    try {
      const res = await withTimeout(
        ai().models.generateContent({
          model: MODEL_CHAIN[attempt],
          contents: opts.prompt,
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            responseJsonSchema: opts.jsonSchema,
            temperature: opts.temperature ?? 0.1,
          },
        }),
        Math.min(opts.timeoutMs ?? ATTEMPT_TIMEOUT_MS, deadline - Date.now()),
      );
      const text = res.text;
      if (!text) throw new Error("Empty response from model");
      const parsed = opts.zod.safeParse(JSON.parse(text));
      if (!parsed.success) throw new Error("Model output failed validation: " + parsed.error.message);
      return parsed.data;
    } catch (err) {
      lastErr = err;
      if (err instanceof AIError) throw err; // config errors: don't retry
      console.warn(`[gemini] ${MODEL_CHAIN[attempt]} failed: ${errMsg(err).slice(0, 160)}`);
    }
  }
  throw new AIError(`AI request failed after retries: ${errMsg(lastErr)}`);
}

export type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY";

/** Embeds texts (batched, max 100 per call). Returns one 768-d vector per input. */
export async function embedTexts(texts: string[], taskType: EmbedTask = "RETRIEVAL_DOCUMENT"): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    let lastErr: unknown;
    let vectors: number[][] | null = null;
    for (let attempt = 0; attempt < 2 && !vectors; attempt++) {
      try {
        const res = await withTimeout(
          ai().models.embedContent({
            model: EMBED_MODEL,
            contents: batch,
            config: { taskType, outputDimensionality: EMBEDDING_DIM },
          }),
          30_000,
        );
        const v = (res.embeddings ?? []).map((e) => e.values ?? []);
        if (v.length !== batch.length || v.some((x) => x.length !== EMBEDDING_DIM)) {
          throw new Error("Unexpected embedding shape");
        }
        vectors = v;
      } catch (err) {
        lastErr = err;
        if (err instanceof AIError) throw err;
      }
    }
    if (!vectors) throw new AIError(`Embedding failed after retry: ${errMsg(lastErr)}`);
    out.push(...vectors);
  }
  return out;
}

/** pgvector literal for supabase-js inserts / rpc args */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
