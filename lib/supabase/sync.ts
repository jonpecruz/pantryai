import { supabase } from "./client";
export async function syncFullState(state: unknown): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("user_state").upsert({ user_id: user.id, state, updated_at: new Date().toISOString() });
  return !error;
}
