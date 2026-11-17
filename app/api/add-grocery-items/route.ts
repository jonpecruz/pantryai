import { appAccess } from "@/lib/access.server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiService } from "@/lib/ai/AIService";
import { buildAddGroceryItemsPrompt } from "@/lib/ai/prompts";
import { groceryAddResponseSchema } from "@/lib/ai/schemas";
import { AIProviderError } from "@/lib/ai/ProviderAdapter";

export const runtime = "nodejs";

const requestSchema = z.object({
  userPrompt: z.string().min(1).max(300),
  currency: z.string().default("EUR"),
});

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { user, state } = await appAccess();
  if (!user) return NextResponse.json({ error: "Sign in to PantryAI." }, { status: 401 });
  if (state?.state !== "claimed") return NextResponse.json({ error: "Sign in with publik." }, { status: 403 });
  let body: z.infer<typeof requestSchema>;
  try {
    const json = await req.json();
    body = requestSchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request: describe what you want to add." },
      { status: 400 }
    );
  }

  const { systemPrompt, userPrompt } = buildAddGroceryItemsPrompt(body);

  try {
    const aiResult = await aiService.generateStructured(
      { systemPrompt, userPrompt, temperature: 0.3 },
      groceryAddResponseSchema
    );

    return NextResponse.json({ items: aiResult.items });
  } catch (err) {
    if (err instanceof AIProviderError) {
      const status = err.status ?? (err.message.includes("rate limit") ? 429 : 502);
      return NextResponse.json({ error: err.message, ...(err.topUpUrl ? { top_up_url: err.topUpUrl } : {}) }, { status });
    }
    return NextResponse.json(
      { error: "Unexpected error interpreting the request." },
      { status: 500 }
    );
  }
}
