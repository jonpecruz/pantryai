import { redirect } from "next/navigation";
import { appAccess } from "@/lib/access.server";
import { adminClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import SyncManager from "@/components/SyncManager";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AIResponseNotice from "@/components/AIResponseNotice";
import AccountControls from "@/components/AccountControls";

export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, state } = await appAccess();
  if (!user) redirect("/login");
  if (state?.state !== "claimed") redirect("/publik");
  const { data: preferences } = await adminClient().from("ai_preferences").select("provider").eq("user_id", user.id).maybeSingle();
  if (!preferences || (!state.hasPlan && preferences.provider !== "gemini")) redirect("/settings");
  return <><ServiceWorkerRegister /><SyncManager /><AccountControls /><AIResponseNotice />
    <main className="flex-1 pb-28 pt-safe">{children}</main><BottomNav /></>;
}
