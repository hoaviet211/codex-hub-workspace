import type { EmbeddingProvider } from "./types.js";
import { hashText } from "./utils.js";

export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 32;

  async embed(text: string): Promise<number[]> {
    return hashText(text);
  }
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number | null = null;

  constructor(
    private readonly options: {
      url: string;
      apiKey?: string;
      model: string;
      headers?: Record<string, string>;
    },
  ) {}

  async embed(text: string): Promise<number[]> {
    const response = await fetch(this.options.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        ...(this.options.headers ?? {}),
      },
      body: JSON.stringify({
        model: this.options.model,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const embedding = payload.data?.[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error("Embedding response did not contain a vector");
    }

    return embedding;
  }
}

export function createEmbeddingProviderFromEnv(env: NodeJS.ProcessEnv): EmbeddingProvider {
  const provider = (env.EMBEDDING_PROVIDER ?? "hash").toLowerCase();
  if (provider === "openai-compatible") {
    const url = env.EMBEDDING_URL;
    const model = env.EMBEDDING_MODEL;
    if (!url || !model) {
      throw new Error("EMBEDDING_URL and EMBEDDING_MODEL are required for openai-compatible embeddings");
    }

    return new OpenAICompatibleEmbeddingProvider({
      url,
      apiKey: env.EMBEDDING_API_KEY,
      model,
    });
  }

  return new HashEmbeddingProvider();
}
