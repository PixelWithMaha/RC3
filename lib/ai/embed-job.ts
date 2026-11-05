// Job embedding (JOB-8). Non-fatal: a job without an embedding still works, matching just
// loses the cosine-similarity supporting signal.
import { embedTexts, toPgVector } from "@/lib/ai/gemini";
import { jobEmbeddingText } from "@/lib/ai/jobs";

export async function computeJobEmbedding(job: Parameters<typeof jobEmbeddingText>[0]): Promise<string | null> {
  try {
    const [v] = await embedTexts([jobEmbeddingText(job)], "RETRIEVAL_DOCUMENT");
    return toPgVector(v);
  } catch (err) {
    console.error("[jobs] embedding failure (non-fatal)", err);
    return null;
  }
}
