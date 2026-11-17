import { redirect } from "next/navigation";
import { authClient, currentUser } from "@/lib/supabase/server";
import { signUpErrorMessage } from "@/lib/auth-errors";
import AuthButtons from "@/components/AuthButtons";

export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: { message?: string } }) {
  if (await currentUser()) redirect("/");
  async function signIn(form: FormData) {
    "use server";
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || password.length < 8) redirect("/login?message=Enter+your+email+and+a+password+of+at+least+8+characters.");
    const client = authClient();
    if (form.get("action") === "signup") {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) {
        console.warn("PantryAI sign-up failed", { code: error.code ?? "unknown", status: error.status });
        redirect(`/login?message=${encodeURIComponent(signUpErrorMessage(error))}`);
      }
      if (!data.session) redirect("/login?message=Check+your+email+to+confirm+your+account,+then+sign+in.");
    } else {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) redirect("/login?message=Sign-in+failed.+Check+your+email,+password,+and+email+confirmation.");
    }
    redirect("/publik");
  }
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 px-6">
    <h1 className="text-3xl font-semibold">PantryAI</h1>
    <p>Your pantry, meal plans, and shopping lists, kept separate for your account.</p>
    {!configured ? <p>This deployment is being configured. Please check back soon.</p> : <form action={signIn} className="flex flex-col gap-4">
      <label>Email<input className="mt-1 w-full rounded-xl border bg-card p-3" name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input className="mt-1 w-full rounded-xl border bg-card p-3" name="password" type="password" minLength={8} autoComplete="current-password" required /></label>
      <AuthButtons />
    </form>}
    {searchParams.message && <p role="status">{searchParams.message}</p>}
  </main>;
}

