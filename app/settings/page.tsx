import "@/lib/publik-store.server";
import { redirect } from "next/navigation";
import { currentUser, adminClient } from "@/lib/supabase/server";
import { ensureUser, setUsage } from "@/lib/publik.server";
import { seal } from "@/lib/publik-store.server";
import Link from "next/link";
import AccountControls from "@/components/AccountControls";

export const dynamic = "force-dynamic";
export default async function Settings({ searchParams }: { searchParams: { message?: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const state = await ensureUser(user.id);
  if (state.state !== "claimed") redirect("/publik");
  const { data: preferences } = await adminClient().from("ai_preferences").select("provider,usage").eq("user_id", user.id).maybeSingle();
  async function save(form: FormData) {
    "use server";
    const user = await currentUser();
    if (!user) redirect("/login");
    if ((await ensureUser(user.id)).state !== "claimed") redirect("/publik");
    const provider = form.get("provider") === "gemini" ? "gemini" : "publik";
    const key = String(form.get("key") ?? "").trim();
    if (provider === "gemini" && (!key || key.length > 500)) redirect("/settings?message=Enter+your+Gemini+key+to+use+your+own+key.");
    const usage = form.get("usage") === "on";
    const { error } = await adminClient().from("ai_preferences").upsert({ user_id: user.id, provider, own_key: provider === "gemini" ? seal(key) : null, usage });
    if (error) redirect("/settings?message=Could+not+save.+Please+try+again.");
    await setUsage(user.id, usage);
    redirect("/");
  }
  return <><AccountControls /><section className="mx-auto flex max-w-lg flex-col gap-5 p-5">
    <h1 className="text-2xl font-semibold">AI & account</h1>
    <p>{user.email}</p>
    {state.topUpUrl && <a className="underline" href={state.topUpUrl} rel="noreferrer" target="_blank">{state.hasPlan ? "Connect your plan" : "Get a plan"}</a>}
    <form action={save} className="flex flex-col gap-5">
      <label>AI provider<select name="provider" defaultValue={preferences?.provider ?? "publik"} className="block w-full rounded-xl border bg-card p-3">
        <option value="publik">Connect your plan</option><option value="gemini">Use my own key</option>
      </select></label>
      <label>Gemini API key<input type="password" name="key" autoComplete="off" className="block w-full rounded-xl border bg-card p-3" /></label>
      <p className="text-sm">Your key is encrypted and kept on the server. Enter it again when saving the own-key option.</p>
      <label><input type="checkbox" name="usage" defaultChecked={preferences?.usage !== false} /> Count my app usage</label>
      <button className="rounded-xl bg-primary p-3 text-primary-foreground">Save preferences</button>
    </form>
    {searchParams.message && <p role="status">{searchParams.message}</p>}
    <Link className="underline" href="/">Back to PantryAI</Link>
  </section></>;
}
