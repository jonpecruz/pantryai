import "server-only";
import "@/lib/publik-store.server";
import { currentUser, adminClient } from "@/lib/supabase/server";
import { ensureUser, keyFor, MODELS, topUpUrlFrom402 } from "@/lib/publik.server";
import { unseal } from "@/lib/publik-store.server";
import { GeminiAdapter } from "./geminiAdapter";
import { AIProviderError, type AIProviderAdapter, type AIGenerateParams } from "../ProviderAdapter";

export class PublikAdapter implements AIProviderAdapter {
  readonly name = "publik";
  async generateJSON(params: AIGenerateParams): Promise<string> {
    const user = await currentUser();
    if (!user) throw new AIProviderError("Please sign in to PantryAI.", this.name, undefined, 401);
    const state = await ensureUser(user.id);
    if (state.state !== "claimed") throw new AIProviderError("Please sign in with publik.", this.name, undefined, 403);
    const { data: preferences, error } = await adminClient().from("ai_preferences").select("provider,own_key").eq("user_id", user.id).maybeSingle();
    if (error) throw new AIProviderError("Could not load your AI choice.", this.name);
    if (preferences?.provider === "gemini" && preferences.own_key) {
      return new GeminiAdapter(unseal<string>(preferences.own_key)).generateJSON(params);
    }
    const key = await keyFor(user.id);
    if (!key) throw new AIProviderError("Please sign in with publik.", this.name, undefined, 403);
    const content: unknown[] = [];
    if (params.image) content.push({ type: "image_url", image_url: { url: `data:${params.image.mimeType};base64,${params.image.base64}` } });
    content.push({ type: "text", text: params.userPrompt });
    let response: Response;
    try {
      response = await fetch("https://publikhq.com/api/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(55_000),
        body: JSON.stringify({ model: MODELS.balanced, messages: [{ role: "system", content: params.systemPrompt }, { role: "user", content }],
          temperature: params.temperature ?? 0.4, response_format: { type: "json_object" } }),
      });
    } catch { throw new AIProviderError("Could not reach publik. Try again.", this.name); }
    const body = await response.json().catch(() => null);
    if (response.status === 402) {
      const error402 = topUpUrlFrom402(body);
      throw new AIProviderError(error402.message, this.name, undefined, 402, error402.url ?? undefined);
    }
    if (!response.ok) throw new AIProviderError(response.status === 429 ? "AI rate limit reached. Try again shortly." : "The AI request failed. Try again.", this.name, undefined, response.status === 429 ? 429 : 502);
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new AIProviderError("The AI returned no usable response.", this.name);
    return text;
  }
}
