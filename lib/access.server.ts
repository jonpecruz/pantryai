import "server-only";
import "./publik-store.server";
import { currentUser } from "./supabase/server";
import { ensureUser, trackActive } from "./publik.server";

export async function appAccess() {
  const user = await currentUser();
  if (!user) return { user: null, state: null };
  const state = await ensureUser(user.id);
  if (state.state === "claimed") await trackActive(user.id);
  return { user, state };
}
