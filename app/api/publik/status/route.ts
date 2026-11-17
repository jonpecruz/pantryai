import { appAccess } from "@/lib/access.server";
export const dynamic = "force-dynamic";
export async function GET() {
  const { user, state } = await appAccess();
  return Response.json({ state: user ? state?.state : "signed_out" }, { headers: { "Cache-Control": "private, no-store" } });
}
