/**
 * Fills in the atom library's structure from the terms already in the database: each term's public name, its place and its "confused with" links.
 *   npm run db:push            (first, for the new tables and columns; a deploy does this)
 *   npm run backfill:atoms
 * Safe to run again: it adds only what is missing. The app works without it, so it can be run whenever convenient.
 */
import { backfillAtoms } from "@/lib/termPlaces";

const r = backfillAtoms();
console.log(`Shared terms: ${r.terms}. Public names given: ${r.slugs}. Places recorded: ${r.places}. Links added: ${r.links}.`);
if (r.sharedNames.length) console.log(`Words used by more than one term, to be merged or told apart in review (${r.sharedNames.length}): ${r.sharedNames.sort().join(", ")}`);
if (r.unknownLookAlikes.length) console.log(`Look-alikes that name no term (${r.unknownLookAlikes.length}): ${r.unknownLookAlikes.slice(0, 15).join("; ")}${r.unknownLookAlikes.length > 15 ? "; …" : ""}`);
