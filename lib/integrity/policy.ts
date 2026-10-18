import { eq, inArray } from "drizzle-orm";
import { brands, companies, db, integrityPolicies, tracks } from "@/lib/db";
import { scopesOf } from "@/lib/paths";
import { singleCompany } from "@/lib/brand";

/**
 * How carefully an exam is watched. The policy is set in layers, widest first:
 *
 *   global (the whole academy) -> company -> brand -> track
 *
 * A layer stores only what it sets; every other setting is inherited from the layer above, and the code defaults sit under all of them.
 * A layer can also LOCK a setting: nothing below it may change that setting (a company that must have webcam snapshots everywhere locks
 * them, so no brand or track can switch them off). An exam is held to the policy resolved for its track at the moment it begins.
 *
 * Be honest about what this can do: a website cannot see a second phone or a virtual machine. These settings gather evidence and make
 * cheating costly and visible; lib/integrity/session.ts turns the evidence into a risk score and a person makes the call.
 */

export type Scope = "global" | "company" | "brand" | "track";
export const SCOPES: Scope[] = ["global", "company", "brand", "track"];

export type Settings = {
  fullscreen: boolean; // the exam must stay fullscreen; leaving hides the questions until the person returns
  blockPaste: boolean; // copy, cut, paste, drag-drop and the context menu are blocked in the exam (attempts are still counted)
  tabSwitch: "off" | "log" | "limit"; // leaving the exam window: ignore, record, or record and treat extra leaves as serious
  maxTabLeaves: number; // leaves allowed before each extra one counts as serious (tabSwitch "limit")
  webcam: "off" | "snapshots"; // random webcam stills during the exam
  snapshots: number; // how many random stills
  selfie: boolean; // one still when the exam begins, for the reviewer to compare with the profile photo
  behaviour: boolean; // note automation, bulk text insertion and pasting
  minSecondsPerQuestion: number; // an exam finished faster than this per question is suspicious (0 = no check)
  reviewAt: number; // risk score (0-100) at which a passed exam goes to a person (0 = never flag by score)
  holdOnFlag: boolean; // a flagged pass waits for review before its certificate and rewards are given
  reviewFromLevel: number; // passes at this level and above always wait for a person, like a live check (0 = never)
  retainDays: number; // days webcam stills are kept after the exam is settled
};

export type Key = keyof Settings;

type Def = { key: Key; label: string; help: string; group: string } & (
  | { type: "bool"; def: boolean }
  | { type: "enum"; def: string; options: { value: string; label: string }[] }
  | { type: "int"; def: number; min: number; max: number; unit?: string }
);

export const FIELDS: Def[] = [
  { key: "fullscreen", group: "Screen", label: "Keep the exam fullscreen", help: "Leaving fullscreen covers the questions until the person returns, and is recorded.", type: "bool", def: false },
  { key: "blockPaste", group: "Screen", label: "Block copy and paste", help: "Stops pasting an answer in (or copying a question out). Attempts are still counted.", type: "bool", def: false },
  { key: "tabSwitch", group: "Screen", label: "Leaving the exam window", help: "Record each time the person switches tab or window, and for how long.", type: "enum", def: "off", options: [{ value: "off", label: "Ignore" }, { value: "log", label: "Record" }, { value: "limit", label: "Record, with a limit" }] },
  { key: "maxTabLeaves", group: "Screen", label: "Leaves allowed (with a limit)", help: "Each leave beyond this counts as serious.", type: "int", def: 3, min: 0, max: 20 },
  { key: "webcam", group: "Camera", label: "Random webcam stills", help: "The person must allow their camera. Stills are for a reviewer; nothing is matched automatically.", type: "enum", def: "off", options: [{ value: "off", label: "Off" }, { value: "snapshots", label: "Random stills" }] },
  { key: "snapshots", group: "Camera", label: "Number of stills", help: "Taken at random moments during the exam.", type: "int", def: 4, min: 1, max: 20 },
  { key: "selfie", group: "Camera", label: "Selfie at the start", help: "One still before the questions appear, for the reviewer to compare with the profile photo.", type: "bool", def: false },
  { key: "behaviour", group: "Signals", label: "Watch for automation and bulk text", help: "Records browser-automation flags, pasted answers and text that appears all at once.", type: "bool", def: false },
  { key: "minSecondsPerQuestion", group: "Signals", label: "Fastest believable pace", help: "Seconds per question below which the whole exam looks suspicious. 0 turns the check off.", type: "int", def: 0, min: 0, max: 120, unit: "seconds" },
  { key: "reviewAt", group: "Review", label: "Send to a person at risk score", help: "0 to 100. A passed exam at or above this goes to the review queue. 0 never flags by score.", type: "int", def: 50, min: 0, max: 100 },
  { key: "holdOnFlag", group: "Review", label: "Hold the reward until reviewed", help: "A flagged pass keeps its certificate and rewards back until an admin clears it. Off = they are given at once and the pass is only queued for a look.", type: "bool", def: false },
  { key: "reviewFromLevel", group: "Review", label: "Always review passes from level", help: "High-stakes levels: every pass at or above this waits for a person (a live check or viva). 0 = never.", type: "int", def: 0, min: 0, max: 20 },
  { key: "retainDays", group: "Privacy", label: "Keep webcam stills for", help: "Days after the exam is settled. Then the images are deleted; the written record stays.", type: "int", def: 30, min: 1, max: 365, unit: "days" },
];
const BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

export const DEFAULTS: Settings = Object.fromEntries(FIELDS.map((f) => [f.key, f.def])) as Settings;

/** Starting points for the admin form. Each is a full set of values; the admin can change any of them afterwards. */
export const PRESETS: Record<string, { label: string; blurb: string; values: Partial<Settings> }> = {
  off: { label: "Off", blurb: "No monitoring.", values: { fullscreen: false, blockPaste: false, tabSwitch: "off", webcam: "off", selfie: false, behaviour: false, minSecondsPerQuestion: 0, holdOnFlag: false, reviewFromLevel: 0 } },
  light: { label: "Light", blurb: "Record window changes and paste attempts; a person looks at flagged passes.", values: { fullscreen: false, blockPaste: false, tabSwitch: "log", webcam: "off", selfie: false, behaviour: true, minSecondsPerQuestion: 5, reviewAt: 60, holdOnFlag: false, reviewFromLevel: 0, retainDays: 30 } },
  standard: { label: "Standard", blurb: "Fullscreen, no pasting, a limit on leaving the window, a selfie and four random stills. Flagged passes are held.", values: { fullscreen: true, blockPaste: true, tabSwitch: "limit", maxTabLeaves: 3, webcam: "snapshots", snapshots: 4, selfie: true, behaviour: true, minSecondsPerQuestion: 8, reviewAt: 50, holdOnFlag: true, reviewFromLevel: 0, retainDays: 30 } },
  strict: { label: "Strict", blurb: "As standard with a stricter limit, more stills, and a person checks every pass from level 15.", values: { fullscreen: true, blockPaste: true, tabSwitch: "limit", maxTabLeaves: 1, webcam: "snapshots", snapshots: 8, selfie: true, behaviour: true, minSecondsPerQuestion: 10, reviewAt: 35, holdOnFlag: true, reviewFromLevel: 15, retainDays: 30 } },
};

/** What one layer stores: the values it sets, and the keys it locks for everything below. */
export type Stored = { v: Partial<Settings>; lock: Key[] };
export const EMPTY: Stored = { v: {}, lock: [] };

/** Coerces any one value to what its field allows, or undefined when it cannot be. */
export function coerce(key: Key, raw: unknown): Settings[Key] | undefined {
  const f = BY_KEY.get(key);
  if (!f) return undefined;
  if (f.type === "bool") return raw === true || raw === "on" || raw === "true" ? true : raw === false || raw === "off" || raw === "false" ? false : undefined;
  if (f.type === "enum") return typeof raw === "string" && f.options.some((o) => o.value === raw) ? raw as Settings[Key] : undefined;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= f.min && n <= f.max ? n : undefined;
}

/** Reads a stored settings column. Anything unrecognised or out of range is dropped, so a hand-edited row can never break an exam. */
export function parseStored(text: string | null | undefined): Stored {
  let j: unknown;
  try { j = JSON.parse(text || "{}"); } catch { return { v: {}, lock: [] }; }
  const o = (j && typeof j === "object" ? j : {}) as { v?: Record<string, unknown>; lock?: unknown };
  const v: Partial<Settings> = {};
  for (const [k, raw] of Object.entries(o.v ?? {})) {
    const c = BY_KEY.has(k as Key) ? coerce(k as Key, raw) : undefined;
    if (c !== undefined) (v as Record<string, unknown>)[k] = c;
  }
  const lock = Array.isArray(o.lock) ? [...new Set(o.lock.filter((k): k is Key => typeof k === "string" && BY_KEY.has(k as Key)))] : [];
  return { v, lock };
}

export type Layer = { scope: Scope; refId: number; label: string };
export type Source = { scope: Scope | "default"; label: string };

export type Resolved = {
  values: Settings;
  source: Record<Key, Source>; // which layer each value came from
  lockedBy: Partial<Record<Key, Source>>; // which wider layer locked a key, so layers below it cannot change it
};

/**
 * Walks the layers widest to narrowest. A layer's value applies unless a wider layer has locked that key; a layer's own locks then
 * bind everything below it. `stored` is looked up by "scope:refId"; a layer with no row sets nothing.
 */
export function resolveLayers(layers: Layer[], stored: Map<string, Stored>): Resolved {
  const values = { ...DEFAULTS } as Settings;
  const source = Object.fromEntries(FIELDS.map((f) => [f.key, { scope: "default", label: "Default" } as Source])) as Record<Key, Source>;
  const lockedBy: Partial<Record<Key, Source>> = {};
  for (const layer of layers) {
    const row = stored.get(`${layer.scope}:${layer.refId}`) ?? EMPTY;
    const here: Source = { scope: layer.scope, label: layer.label };
    for (const [k, val] of Object.entries(row.v) as [Key, Settings[Key]][]) {
      if (lockedBy[k]) continue; // a wider layer locked it
      (values as Record<string, unknown>)[k] = val;
      source[k] = here;
    }
    for (const k of row.lock) if (!lockedBy[k]) lockedBy[k] = here;
  }
  return { values, source, lockedBy };
}

function loadStored(layers: Layer[]): Map<string, Stored> {
  const out = new Map<string, Stored>();
  const refs = layers.filter((l) => l.scope !== "global").map((l) => l.refId);
  const rows = db.select().from(integrityPolicies).where(refs.length ? inArray(integrityPolicies.refId, [0, ...refs]) : eq(integrityPolicies.refId, 0)).all();
  for (const r of rows) out.set(`${r.scope}:${r.refId}`, parseStored(r.settings));
  return out;
}

const GLOBAL: Layer = { scope: "global", refId: 0, label: "Whole academy" };

/** The layers that apply to a track, widest first. A shared (academy) brand has no company, so the chain skips that step. */
export function layersForTrack(trackId: number): Layer[] {
  const out: Layer[] = [GLOBAL];
  const t = db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!t) return out;
  const b = db.select().from(brands).where(eq(brands.id, t.brandId)).get();
  if (b?.companyId != null) {
    const c = db.select().from(companies).where(eq(companies.id, b.companyId)).get();
    if (c) out.push({ scope: "company", refId: c.id, label: c.academyName || c.name });
  }
  if (b) out.push({ scope: "brand", refId: b.id, label: b.name });
  out.push({ scope: "track", refId: t.id, label: t.name });
  return out;
}

/** The layers for something that is not one track (a role check across several): the academy, then the person's company when they have exactly one. */
export function layersForUser(userId: number): Layer[] {
  const out: Layer[] = [GLOBAL];
  const cid = singleCompany(scopesOf(userId));
  const c = cid == null ? undefined : db.select().from(companies).where(eq(companies.id, cid)).get();
  if (c) out.push({ scope: "company", refId: c.id, label: c.academyName || c.name });
  return out;
}

/** The layers from the academy down to one place an admin is editing. */
export function layersAt(scope: Scope, refId: number): Layer[] {
  if (scope === "global") return [GLOBAL];
  if (scope === "track") return layersForTrack(refId);
  if (scope === "company") {
    const c = db.select().from(companies).where(eq(companies.id, refId)).get();
    return c ? [GLOBAL, { scope: "company", refId: c.id, label: c.academyName || c.name }] : [GLOBAL];
  }
  const b = db.select().from(brands).where(eq(brands.id, refId)).get();
  if (!b) return [GLOBAL];
  const out = [GLOBAL];
  const c = b.companyId != null ? db.select().from(companies).where(eq(companies.id, b.companyId)).get() : undefined;
  if (c) out.push({ scope: "company", refId: c.id, label: c.academyName || c.name });
  out.push({ scope: "brand", refId: b.id, label: b.name });
  return out;
}

export const resolveFor = (layers: Layer[]): Resolved => resolveLayers(layers, loadStored(layers));
export const policyForTrack = (trackId: number): Resolved => resolveFor(layersForTrack(trackId));
export const policyForUser = (userId: number): Resolved => resolveFor(layersForUser(userId));

/** The row one layer has stored (what it sets itself, not what it inherits). */
export function storedAt(scope: Scope, refId: number): Stored {
  const r = db.select().from(integrityPolicies).where(eq(integrityPolicies.scope, scope)).all().find((x) => x.refId === refId);
  return r ? parseStored(r.settings) : { v: {}, lock: [] };
}

// ---- what a policy asks of the browser ----

/** Does the exam need a camera? */
export const needsCamera = (s: Settings) => s.webcam !== "off" || s.selfie;
/** Does anything run in the person's browser? Then they get the check screen, and are told what is recorded. */
export const needsGuard = (s: Settings) => s.fullscreen || s.blockPaste || s.tabSwitch !== "off" || needsCamera(s) || s.behaviour;
/** Does the policy ask for anything at all? */
export const isActive = (s: Settings) => needsGuard(s) || s.minSecondsPerQuestion > 0 || s.reviewFromLevel > 0;

/** The part of the policy the browser is given. Nothing about thresholds or holds: the page only needs to know what to do, not how it is judged. */
export type ClientPolicy = Pick<Settings, "fullscreen" | "blockPaste" | "tabSwitch" | "webcam" | "snapshots" | "selfie" | "behaviour">;
export const clientPolicy = (s: Settings): ClientPolicy => ({ fullscreen: s.fullscreen, blockPaste: s.blockPaste, tabSwitch: s.tabSwitch, webcam: s.webcam, snapshots: s.snapshots, selfie: s.selfie, behaviour: s.behaviour });

/** A short, plain list of what a policy does, for the person taking the exam and for the admin summary. */
export function describePolicy(s: Settings): string[] {
  const out: string[] = [];
  if (s.fullscreen) out.push("The exam runs fullscreen. Leaving it is recorded.");
  if (s.blockPaste) out.push("Copying and pasting are blocked, and attempts are recorded.");
  if (s.tabSwitch === "log") out.push("Switching to another tab or window is recorded.");
  if (s.tabSwitch === "limit") out.push(`Switching to another tab or window is recorded; more than ${s.maxTabLeaves} counts as serious.`);
  if (s.selfie) out.push("A photo is taken from your camera when you begin.");
  if (s.webcam === "snapshots") out.push(`${s.snapshots} photos are taken from your camera at random moments.`);
  if (s.behaviour) out.push("Signs of automation, pasted answers and text that appears all at once are recorded.");
  if (s.minSecondsPerQuestion > 0) out.push("Finishing implausibly fast is flagged.");
  if (s.reviewFromLevel > 0) out.push(`Passes from level ${s.reviewFromLevel} are checked by a person before they count towards rewards.`);
  return out;
}
