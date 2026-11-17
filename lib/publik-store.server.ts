import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { adminClient } from "./supabase/server";
import { useStore, type PublikUser } from "./publik.server";

function encryptionKey() {
  const secret = process.env.PUBLIK_INSTALL_SECRET;
  if (!secret || secret.length < 32) throw new Error("Server credentials are not configured.");
  return createHash("sha256").update(`pantryai-store:${secret}`).digest();
}
export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}
export function unseal<T>(value: string): T {
  const data = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
}

useStore({
  async get(userId) {
    const { data, error } = await adminClient().from("publik_users").select("record").eq("user_id", userId).maybeSingle();
    if (error) throw new Error("Could not load Publik sign-in.");
    return data ? unseal<PublikUser>(data.record) : null;
  },
  async set(userId, user) {
    const { error } = await adminClient().from("publik_users").upsert({ user_id: userId, record: seal(user) });
    if (error) throw new Error("Could not save Publik sign-in.");
  },
  async delete(userId) {
    const { error } = await adminClient().from("publik_users").delete().eq("user_id", userId);
    if (error) throw new Error("Could not reset Publik sign-in.");
  },
});
