"use client";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useState } from "react";

export default function AccountControls() {
  const [busy, setBusy] = useState(false);
  return <div className="flex justify-end gap-4 px-4 py-3 text-sm">
    <Link href="/settings">AI & account</Link>
    <button disabled={busy} onClick={async () => {
      setBusy(true);
      await supabase.auth.signOut();
      window.location.assign("/login");
    }}>Sign out</button>
  </div>;
}
