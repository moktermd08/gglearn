/**
 * Which question families serve which track. Tracks come from imports, so match on the slug's subject, not on ids.
 * The first tag is the track's own subject; families carrying it are drawn more often than the supporting tags after it.
 */
const base = (slug: string) => slug.replace(/^foundations-/, "").replace(/-titan$/, "").replace(/[^a-z0-9]/g, "");

const TAGS: Record<string, string[]> = {
  analytics: ["analytics", "marketing"],
  angular: ["angular", "ts", "js"],
  apache: ["apache", "rest"],
  aws: ["cloud", "rest"],
  bootstrap: ["bootstrap", "css", "html"],
  chatgpt: ["llm"],
  css: ["css", "selector"],
  docker: ["docker", "linux"],
  docusaurus: ["docusaurus", "json", "js"],
  dynamics: ["crm", "marketing"],
  expressjs: ["express", "rest", "js"],
  git: ["git"],
  github: ["git"],
  google: ["cloud", "rest"],
  html: ["html", "selector"],
  javascript: ["js"],
  jquery: ["selector", "js"],
  json: ["json"],
  lambda: ["lambda", "cloud", "js"],
  laravel: ["laravel", "php"],
  linkedin: ["marketing", "crm"],
  linux: ["linux"],
  mongodb: ["mongo", "json"],
  mysql: ["sql"],
  nextjs: ["nextjs", "react", "js"],
  nodejs: ["node", "js", "rest"],
  npm: ["npm", "json"],
  oop: ["oop"],
  openai: ["llm", "rest"],
  php: ["php"],
  python: ["py"],
  react: ["react", "js"],
  restapi: ["rest"],
  samplebrandsalesbasics: ["crm", "marketing"],
  typeacript: ["ts"],
  typescript: ["ts"],
  vue: ["vue", "js"],
  wordpress: ["wordpress", "php"],
  xml: ["xml"],
};

export const tagsFor = (slug: string): string[] => {
  const b = base(slug);
  return TAGS[b] ?? [];
};

/** The tag a track is "about": its families get extra weight so a Vue exam is mostly Vue, not generic JavaScript. */
export const primaryTag = (slug: string): string | undefined => tagsFor(slug)[0];
