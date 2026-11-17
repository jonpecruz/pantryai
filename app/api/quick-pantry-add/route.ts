import { appAccess } from "@/lib/access.server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiService } from "@/lib/ai/AIService";
import { buildQuickPantryPrompt } from "@/lib/ai/prompts";
import { quickPantryResponseSchema } from "@/lib/ai/schemas";
import { AIProviderError } from "@/lib/ai/ProviderAdapter";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().min(1).max(500),
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
      { error: "Invalid request: tell me what you have at home." },
      { status: 400 }
    );
  }

  const { systemPrompt, userPrompt } = buildQuickPantryPrompt(body);

  try {
    const aiResult = await aiService.generateStructured(
      { systemPrompt, userPrompt, temperature: 0.2 },
      quickPantryResponseSchema
    );

    return NextResponse.json({ items: aiResult.items });
  } catch (err) {
    if (err instanceof AIProviderError) {
      const status = err.status ?? (err.message.includes("rate limit") ? 429 : 502);
      return NextResponse.json({ error: err.message, ...(err.topUpUrl ? { top_up_url: err.topUpUrl } : {}) }, { status });
    }
    return NextResponse.json(
      { error: "Unexpected error interpreting what you dictated." },
      { status: 500 }
    );
  }
}
