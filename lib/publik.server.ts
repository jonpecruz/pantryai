import "server-only";
// publik.server.ts — Sign in with publik, usage counting and publik API for a hosted web app's server.
// The server holds the app token and one publik key per person. The browser gets neither, ever.
// For each person the app has signed in its own way (its user ID):
//   1. ensureUser(userId) mints one publik install for that person (POST /api/v1/installs, os "web");
//   2. until GET /api/v1/wallet says "claimed", it answers "sign_in" with the claim URL: show gatePage() (no other way past it);
//   3. then keyFor(userId) and resolveProvider(userId) give that person's key for AI calls;
//   4. trackActive(userId) on each request counts the person: app_opened, then active_session every 30 minutes (POST /api/v1/telemetry).
import { createHmac } from "node:crypto";

export const APP_SLUG = "pantryai";
export const APP_VERSION = "1.0.0";
/** false: the app calls no model. It still signs people in and counts them. */
export const USES_AI = true;
const ORIGIN = process.env.PUBLIK_ORIGIN || "https://publikhq.com"; // PUBLIK_ORIGIN: tests only
export const DEFAULT_BASE_URL = `${ORIGIN}/api/v1`;
/** Ask for a tier, never a vendor model name. */
export const MODELS = { fast: "publik-fast", balanced: "publik-balanced", smart: "publik-smart" } as const;
export const POLL_MS = 3_000, POLL_LIMIT_MS = 10 * 60_000;
const CLAIMED_RECHECK_MS = 10 * 60_000;
const UNREACHABLE = "publik is not reachable. Check your connection.";

/** What the server keeps for one person. `key` is a secret: server side only. */
export interface PublikUser {
  installId: string; key: string; generation: number; claimed: boolean; checkedAt: number;
  hasPlan: boolean; topUpUrl: string | null; seenAt: number; eventAt: number; usage?: boolean;
}
/** Where the records live. memoryStore() is for development: in production, keep them in your database (one row per user ID). */
export interface PublikStore {
  get(userId: string): Promise<PublikUser | null>;
  set(userId: string, user: PublikUser): Promise<void>;
  delete(userId: string): Promise<void>;
}
export function memoryStore(): PublikStore {
  const rows = new Map<string, PublikUser>();
  return {
    get: async (id) => (rows.has(id) ? { ...rows.get(id)! } : null),
    set: async (id, u) => void rows.set(id, { ...u }),
    delete: async (id) => void rows.delete(id),
  };
}
let store: PublikStore = memoryStore();
export function useStore(s: PublikStore): void { store = s; }

export type UserState =
  | { state: "claimed"; hasPlan: boolean; topUpUrl: string | null }
  | { state: "sign_in"; claimUrl: string }
  | { state: "unreachable"; message: string };
export type Provider = { kind: "own" | "publik"; baseURL: string; apiKey: string } | { kind: "needs_own_key" } | { kind: "needs_sign_in" };

/** The person's install ID: a UUID (version 4) from HMAC-SHA256(PUBLIK_INSTALL_SECRET, slug + user ID + generation). Stable, and nobody can guess it. */
export function installIdFor(userId: string, generation = 0): string {
  const secret = process.env.PUBLIK_INSTALL_SECRET ?? "";
  if (secret.length < 32) throw new Error("Set PUBLIK_INSTALL_SECRET on the server: 32 or more random characters.");
  const h = createHmac("sha256", secret).update(`${APP_SLUG}\n${userId}\n${generation}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[parseInt(h[16]!, 16) & 3]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** POST /api/v1/installs for one install ID. The app token never leaves the server. */
async function mint(installId: string): Promise<{ status: number; key: string | null; type: string | null; message: string | null }> {
  const token = process.env.PUBLIK_APP_TOKEN?.trim() ?? "";
  if (!token.startsWith("pat_")) throw new Error("The server has no publik app token. Set PUBLIK_APP_TOKEN.");
  const res = await fetch(`${ORIGIN}/api/v1/installs`, {
    method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ app_token: token, app_slug: APP_SLUG, app_version: APP_VERSION, os: "web", install_id: installId, disclosure_version: 1, dialects: ["chat_completions"] }),
  });
  const b = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: res.status, key: typeof b.key === "string" && b.key.startsWith("pk_") ? b.key : null, type: b.error?.type ?? null, message: b.error?.message ?? null };
}

const pending = new Map<string, Promise<PublikUser>>();
/** One install for this person. publik shows a key only once: a replay (200) is another request's mint, or a record that was lost; then the next generation. */
function provision(userId: string, from: number): Promise<PublikUser> {
  const running = pending.get(userId);
  if (running) return running;
  const work = (async () => {
    for (let generation = from; generation < from + 8; generation++) {
      const installId = installIdFor(userId, generation);
      const r = await mint(installId);
      if (r.status === 201 && r.key) {
        const u: PublikUser = { installId, key: r.key, generation, claimed: false, checkedAt: 0, hasPlan: false, topUpUrl: null, seenAt: 0, eventAt: 0 };
        await store.set(userId, u); // the key reaches the store before anything else sees it
        return u;
      }
      if (r.status === 200) {
        for (let i = 0; i < 3; i++) {
          await new Promise((done) => setTimeout(done, 400));
          const u = await store.get(userId);
          if (u?.installId === installId) return u;
        }
        continue;
      }
      if (r.type === "install_revoked") continue;
      throw new Error(r.message ?? `publik could not set up this person (${r.status}).`);
    }
    throw new Error("publik could not set up this person.");
  })();
  pending.set(userId, work);
  return work.finally(() => pending.delete(userId));
}

/** GET /api/v1/wallet. `ended`: publik itself answered 401 or 403 (JSON): the key is revoked or the install was signed out. */
async function readWallet(key: string): Promise<{ wallet: Record<string, any> | null; ended: boolean; message: string | null }> {
  const res = await fetch(`${ORIGIN}/api/v1/wallet`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  const b = (await res.json().catch(() => null)) as Record<string, any> | null;
  if (res.ok && typeof b?.claim_state === "string") return { wallet: b, ended: false, message: null };
  const busy = res.status === 408 || res.status === 429 || res.status >= 500; // publik is busy or down: the gate's own words
  return { wallet: null, ended: (res.status === 401 || res.status === 403) && typeof b?.error?.type === "string", message: busy ? null : b?.error?.message ?? null };
}

const claimedState = (u: PublikUser): UserState => ({ state: "claimed", hasPlan: u.hasPlan, topUpUrl: u.topUpUrl });

/** The gate for one person (see the top of the file). Call it before any page of the app, after the app's own sign-in. */
export async function ensureUser(userId: string): Promise<UserState> {
  try {
    let u = (await store.get(userId)) ?? (await provision(userId, 0));
    if (u.claimed && Date.now() - u.checkedAt < CLAIMED_RECHECK_MS) return claimedState(u);
    for (let fresh = 0; ; fresh++) {
      const r = await readWallet(u.key);
      if (r.ended && fresh === 0) { await store.delete(userId); u = await provision(userId, u.generation + 1); continue; }
      if (!r.wallet) return u.claimed && !r.ended ? claimedState(u) : { state: "unreachable", message: r.message ?? UNREACHABLE };
      const w = r.wallet;
      u = { ...u, claimed: w.claim_state === "claimed", checkedAt: Date.now(), hasPlan: (w.plan?.kind ?? "none") !== "none" || (w.balance_micros ?? 0) > 0, topUpUrl: w.top_up_url ?? null };
      await store.set(userId, u);
      return u.claimed ? claimedState(u) : { state: "sign_in", claimUrl: w.claim_url ?? `${ORIGIN}/wallet` };
    }
  } catch (e) {
    // A person who signed in before passes while publik is not reachable; nobody else does.
    const known = await store.get(userId).catch(() => null);
    if (known?.claimed) return claimedState(known);
    const offline = e instanceof TypeError || (e instanceof Error && /abort|timeout/i.test(e.name));
    return { state: "unreachable", message: offline ? UNREACHABLE : e instanceof Error ? e.message : String(e) };
  }
}

/** The person's publik key, for server-side calls only; null until they signed in. Never send it to the browser. */
export async function keyFor(userId: string): Promise<string | null> {
  const u = await store.get(userId);
  return u?.claimed ? u.key : null;
}

/** The key for this person's AI call: their own provider key when they gave one, else their publik key. */
export async function resolveProvider(userId: string, ownKey?: { baseURL: string; apiKey: string } | null): Promise<Provider> {
  if (ownKey?.apiKey) return { kind: "own", ...ownKey };
  if (!USES_AI) return { kind: "needs_own_key" };
  const key = await keyFor(userId);
  return key ? { kind: "publik", baseURL: DEFAULT_BASE_URL, apiKey: key } : { kind: "needs_sign_in" };
}

/** OpenAI-compatible client config: new OpenAI(clientConfig(p)). */
export function clientConfig(p: Extract<Provider, { apiKey: string }>) { return { baseURL: p.baseURL, apiKey: p.apiKey }; }

/** A 402 renders its message plus exactly ONE link: this one. */
export function topUpUrlFrom402(body: unknown): { message: string; url: string | null } {
  const e = (body as { error?: { message?: string; top_up_url?: string } } | null)?.error;
  return { message: e?.message ?? "Not enough publik API balance.", url: e?.top_up_url ?? null };
}

// ---------- the gate page: no key and no token in it ----------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** The page for a person who is not signed in with publik. It polls `statusUrl` (your route that answers {"state": ...} from ensureUser) every 3 s for at most 10 minutes, then opens `nextUrl` (default: this page). */
export function gatePage(s: Exclude<UserState, { state: "claimed" }>, statusUrl: string, nextUrl?: string): string {
  const body = s.state === "unreachable"
    ? `<p>${esc(s.message)}</p><button onclick="location.reload()">Retry</button>`
    : `<p>This app uses your publik account. Click Sign in with publik, then sign in on the publik page. This page continues when you are signed in.</p>
<a id="go" href="${esc(s.claimUrl)}" target="_blank" rel="noopener">Sign in with publik</a><p id="note"></p>
<script>
const go = document.getElementById("go"), note = document.getElementById("note");
const next = new URL(${JSON.stringify(nextUrl ?? "")} || location.href, location.href).href;
go.href += (go.href.includes("?") ? "&" : "?") + "return_to=" + encodeURIComponent(next);
go.addEventListener("click", () => {
  note.textContent = "Waiting for you to sign in on the publik page.";
  const end = Date.now() + ${POLL_LIMIT_MS};
  const tick = async () => {
    const r = await fetch(${JSON.stringify(statusUrl)}, { credentials: "same-origin" }).then((x) => x.json()).catch(() => null);
    if (r && r.state === "claimed") return location.assign(next);
    if (Date.now() < end) return setTimeout(tick, ${POLL_MS});
    note.textContent = "No sign-in after 10 minutes. Click Sign in with publik to try again.";
  };
  setTimeout(tick, ${POLL_MS});
});
</script>`;
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sign in with publik</title><h1>Sign in with publik</h1>${body}`;
}

// ---------- usage counting: /skills/telemetry.md sections 3-5, from the server ----------
const interval = () => { const s = Number(process.env.PUBLIK_TELEMETRY_INTERVAL_SECONDS); return (s >= 1 && s <= 86_400 ? s : 1_800) * 1000; }; // tests only
function usageOff(u: PublikUser): boolean {
  const dnt = (process.env.DO_NOT_TRACK ?? "").trim().toLowerCase();
  if (dnt !== "" && dnt !== "0" && dnt !== "false") return true;
  if (["0", "false", "off"].includes((process.env.PUBLIK_TELEMETRY ?? "").trim().toLowerCase())) return true;
  return u.usage === false;
}
/** The person turned usage counting off (false) or on (true) in the app's settings. */
export async function setUsage(userId: string, on: boolean): Promise<void> {
  const u = await store.get(userId);
  if (u) await store.set(userId, { ...u, usage: on });
}

async function track(userId: string, openOnly: boolean): Promise<void> {
  const say = (r: unknown) => { if (process.env.PUBLIK_TELEMETRY_DEBUG === "1") process.stderr.write(`publik-telemetry: ${r}\n`); };
  try {
    const u = await store.get(userId);
    if (!u?.claimed) return; // from a server, publik keeps only a signed-in person's events
    if (usageOff(u)) return say("off (opt-out)");
    const now = Date.now(), every = interval();
    // Away for longer than the interval: a new visit (app_opened). Still here: active_session every interval.
    const event = now - u.seenAt > every ? "app_opened" : !openOnly && now - u.eventAt >= every ? "active_session" : null;
    if (event || now - u.seenAt > Math.min(60_000, every / 4)) await store.set(userId, { ...u, seenAt: now, eventAt: event ? now : u.eventAt });
    if (!event) return;
    const res = await fetch(process.env.PUBLIK_TELEMETRY_URL || `${ORIGIN}/api/v1/telemetry`, {
      method: "POST", signal: AbortSignal.timeout(5_000), headers: { "content-type": "application/json", authorization: `Bearer ${u.key}` },
      body: JSON.stringify({ v: 1, app: APP_SLUG, install_id: u.installId, event, app_version: APP_VERSION.replace(/^v/i, ""), os: "web" }),
    });
    say(`${event} -> ${res.status}`);
  } catch (e) { say(`error ${e instanceof Error ? e.name : ""}`); }
}
/** The person opened the app (for example, right after the app's own sign-in). Sends app_opened unless this visit is counted. Never throws. */
export const trackOpen = (userId: string) => track(userId, true);
/** The session ping: call it on each request of a signed-in person. A new visit sends app_opened, a visit that goes on sends active_session every 30 minutes. Never throws. */
export const trackActive = (userId: string) => track(userId, false);

