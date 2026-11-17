import "@/lib/publik-store.server";
import { currentUser } from "@/lib/supabase/server";
import { ensureUser, gatePage } from "@/lib/publik.server";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const state = await ensureUser(user.id);
  if (state.state === "claimed") return NextResponse.redirect(new URL("/", req.url));
  return new Response(gatePage(state, "/api/publik/status", "/"), { status: state.state === "unreachable" ? 503 : 200,
    headers: { "content-type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
