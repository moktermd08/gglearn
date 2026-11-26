/** Writing words into addresses so they stay readable. No imports, so pages and client components can both use it. */

/** "Casework Officer (AO)" -> "casework-officer-ao". */
export const slugify = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** A path inside this site as the value of a query parameter (`?next=/tracks/git`): everything that needs encoding is encoded, but "/" is allowed there and stays. */
export const queryPath = (path: string) => encodeURIComponent(path).replace(/%2F/gi, "/");
