import type { ComponentType, SVGProps } from "react";
import * as si from "simple-icons";
import { BarChart3, Bot, Boxes, Braces, Briefcase, Brain, BookOpen, Bug, Cloud, Code, Cpu, Database, FileCode, FormInput, Gauge, Globe, GitBranch, Key, Layout, LayoutDashboard, Megaphone, MessageSquare, Network, Package, Palette, Plug, Repeat, Rocket, Route, Scale, Search, Server, Settings, Shield, Smartphone, Sparkles, Table, Terminal, TrendingUp, Users, Variable, Webhook, Workflow, Wrench, Zap, Aperture, ClipboardCheck, FileSearch, Image as ImageIcon, Library, ShieldCheck, SlidersHorizontal, WandSparkles, Waypoints } from "lucide-react";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;
type Art = { glyph: { kind: "brand"; path: string; title: string } | { kind: "line"; Icon: Icon }; color: string };

const brand = (i: si.SimpleIcon): Art["glyph"] => ({ kind: "brand", path: i.path, title: i.title });
const line = (Icon: Icon): Art["glyph"] => ({ kind: "line", Icon });

// Brand marks come from Simple Icons (CC0), self-hosted in the bundle. Where Simple Icons has no mark
// (it drops some trademarks), a Lucide line icon is drawn in the brand's colour instead.
const SUBJECTS: Record<string, Art> = {
  git: { glyph: brand(si.siGit), color: "#F05032" },
  github: { glyph: brand(si.siGithub), color: "#6e5494" },
  aws: { glyph: line(Cloud), color: "#FF9900" },
  lambda: { glyph: line(Zap), color: "#FF9900" },
  docusaurus: { glyph: brand(si.siDocusaurus), color: "#3ECC5F" },
  linkedin: { glyph: line(Briefcase), color: "#0A66C2" },
  angular: { glyph: brand(si.siAngular), color: "#DD0031" },
  bootstrap: { glyph: brand(si.siBootstrap), color: "#7952B3" },
  chatgpt: { glyph: line(Bot), color: "#10A37F" },
  openai: { glyph: line(Sparkles), color: "#10A37F" },
  google: { glyph: brand(si.siGooglecloud), color: "#4285F4" },
  analytics: { glyph: brand(si.siGoogleanalytics), color: "#E37400" },
  html: { glyph: brand(si.siHtml5), color: "#E34F26" },
  css: { glyph: brand(si.siCss), color: "#1572B6" },
  javascript: { glyph: brand(si.siJavascript), color: "#F7DF1E" },
  typescript: { glyph: brand(si.siTypescript), color: "#3178C6" },
  typeacript: { glyph: brand(si.siTypescript), color: "#3178C6" },
  jquery: { glyph: brand(si.siJquery), color: "#0769AD" },
  json: { glyph: brand(si.siJson), color: "#5B6B7B" },
  xml: { glyph: line(FileCode), color: "#E8742A" },
  laravel: { glyph: brand(si.siLaravel), color: "#FF2D20" },
  linux: { glyph: brand(si.siLinux), color: "#E5A00D" },
  mongodb: { glyph: brand(si.siMongodb), color: "#47A248" },
  mysql: { glyph: brand(si.siMysql), color: "#4479A1" },
  nextjs: { glyph: brand(si.siNextdotjs), color: "#475569" },
  nodejs: { glyph: brand(si.siNodedotjs), color: "#5FA04E" },
  npm: { glyph: brand(si.siNpm), color: "#CB3837" },
  php: { glyph: brand(si.siPhp), color: "#777BB4" },
  python: { glyph: brand(si.siPython), color: "#3776AB" },
  react: { glyph: brand(si.siReact), color: "#149ECA" },
  vue: { glyph: brand(si.siVuedotjs), color: "#42B883" },
  wordpress: { glyph: brand(si.siWordpress), color: "#21759B" },
  apache: { glyph: brand(si.siApache), color: "#D22128" },
  docker: { glyph: brand(si.siDocker), color: "#2496ED" },
  expressjs: { glyph: brand(si.siExpress), color: "#475569" },
  restapi: { glyph: line(Webhook), color: "#6366F1" },
  oop: { glyph: line(Boxes), color: "#8B5CF6" },
  dynamics: { glyph: line(LayoutDashboard), color: "#0078D4" },
  sample: { glyph: line(Briefcase), color: "#6366F1" },

  // AI technologies (scripts/ai): brand marks where Simple Icons has one, otherwise a line icon in a distinct colour
  "api-openai-platform": { glyph: line(Sparkles), color: "#10A37F" },
  "api-claude": { glyph: brand(si.siClaude), color: "#D97757" },
  "api-gemini": { glyph: brand(si.siGooglegemini), color: "#8E75B2" },
  "api-copilot": { glyph: brand(si.siGithubcopilot), color: "#6E40C9" },
  "llm-aisearch": { glyph: brand(si.siPerplexity), color: "#1FB8CD" },
  "llm-prompting": { glyph: line(WandSparkles), color: "#D946EF" },
  "llm-fundamentals": { glyph: line(Brain), color: "#A855F7" },
  "llm-local": { glyph: brand(si.siOllama), color: "#64748B" },
  "rag-pipelines": { glyph: line(Library), color: "#0D9488" },
  "rag-llamaindex": { glyph: line(FileSearch), color: "#DB2777" },
  "vec-databases": { glyph: line(Waypoints), color: "#2563EB" },
  "agent-design": { glyph: line(Bot), color: "#F59E0B" },
  "agent-mcp": { glyph: brand(si.siModelcontextprotocol), color: "#0F766E" },
  "agent-langchain": { glyph: brand(si.siLangchain), color: "#2E8B6E" },
  "agent-cursor": { glyph: brand(si.siCursor), color: "#475569" },
  "agent-claudecode": { glyph: brand(si.siClaudecode), color: "#C2410C" },
  "agent-automation": { glyph: brand(si.siN8n), color: "#EA4B71" },
  "ml-huggingface": { glyph: brand(si.siHuggingface), color: "#FFD21E" },
  "ml-pytorch": { glyph: brand(si.siPytorch), color: "#EE4C2C" },
  "ml-tensorflow": { glyph: brand(si.siTensorflow), color: "#FF6F00" },
  "ml-sklearn": { glyph: brand(si.siScikitlearn), color: "#F7931E" },
  "tune-finetuning": { glyph: line(SlidersHorizontal), color: "#E11D48" },
  "eval-llm": { glyph: line(ClipboardCheck), color: "#06B6D4" },
  "eval-safety": { glyph: line(ShieldCheck), color: "#DC2626" },
  "image-midjourney": { glyph: line(ImageIcon), color: "#EC4899" },
  "image-diffusion": { glyph: line(Aperture), color: "#7C3AED" },
};

const BY_KIND: Record<string, Art> = {
  subject: { glyph: line(BookOpen), color: "#6366F1" }, product: { glyph: line(Package), color: "#EC4899" },
  service: { glyph: line(Users), color: "#14B8A6" }, tool: { glyph: line(Wrench), color: "#F59E0B" },
  technology: { glyph: line(Cpu), color: "#0EA5E9" }, process: { glyph: line(Workflow), color: "#8B5CF6" },
};

/** "foundations-nodejs" / "nodejs-titan" / "AWS Lambda: Novice to Titan" -> "nodejs" / "aws" / "lambda" */
function subjectKey(slug: string, name: string) {
  const s = slug.toLowerCase().replace(/^foundations-/, "").replace(/-titan$/, "");
  if (s === "lambda" || s === "lamda") return "lambda";
  const n = name.toLowerCase().replace(/:.*$/, "").replace(/[^a-z]/g, "");
  return SUBJECTS[s] ? s : SUBJECTS[n] ? n : s.split("-")[0];
}

// Specific title words first, so "Database design" is a database rather than a palette.
const TRACK_ICONS: [RegExp, Icon][] = [
  [/database|data stores|analytics/i, Database], [/architecture|system design|patterns/i, Boxes], [/front-?end|ui\/ux|design systems/i, Layout],
  [/back-?end|server|infrastructure|hosting/i, Server], [/security|authentication|governance|compliance|risk/i, ShieldCheck], [/testing|qa\b/i, Bug],
  [/ci\/cd|devops|deploy|launch/i, Rocket], [/discover|planning|roadmap|strategy/i, Route], [/requirement/i, ClipboardCheck],
  [/payment|subscription|finance|pricing/i, Briefcase], [/sales|support|people|leadership|communication/i, Users], [/\bai\b|llm|automation/i, Brain],
  [/content|seo|brand|voice|marketing|social/i, Megaphone],
];

const FALLBACK_COLORS = ["#6366F1", "#EC4899", "#14B8A6", "#F59E0B", "#0EA5E9", "#8B5CF6", "#10B981", "#EF4444", "#06B6D4", "#D946EF"];

/** Tracks with no brand mark get a keyword icon for their title and a stable colour, so a long list of them stays tell-apart-able. */
export function artFor(slug: string, name: string, kind: string): Art {
  const known = SUBJECTS[subjectKey(slug, name)];
  if (known) return known;
  const base = BY_KIND[kind] ?? BY_KIND.subject;
  const clean = name.replace(/^\d+\.\s*/, "");
  const Icon = TRACK_ICONS.find(([re]) => re.test(clean))?.[1] ?? TOPIC_ICONS.find(([re]) => re.test(clean))?.[1];
  const hash = [...slug].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return { glyph: Icon ? line(Icon) : base.glyph, color: FALLBACK_COLORS[hash % FALLBACK_COLORS.length] };
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)} ${c((n >> 8) & 255)} ${c(n & 255)})`;
}

/**
 * Square subject tile: brand-coloured gradient, Haikei-style layered waves, and the subject's mark.
 * Pure SVG, no network request, so every subject always has an image.
 */
export function SubjectArt({ slug, name, kind, size = 48, className = "" }: { slug: string; name: string; kind: string; size?: number; className?: string }) {
  const { glyph, color } = artFor(slug, name, kind);
  const id = `sa-${slug.replace(/[^a-z0-9]/gi, "")}-${size}`;
  const lum = (0.299 * parseInt(color.slice(1, 3), 16) + 0.587 * parseInt(color.slice(3, 5), 16) + 0.114 * parseInt(color.slice(5, 7), 16)) / 255;
  const dark = lum > 0.72; // yellow needs a dark mark
  const ink = dark ? "#1f2937" : "#ffffff";
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} className={`shrink-0 rounded-[22%] ${className}`} role="img" aria-label={`${name} logo`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={color} /><stop offset="1" stopColor={shade(color, 0.55)} /></linearGradient>
      </defs>
      <rect width="96" height="96" fill={`url(#${id})`} />
      <path d="M0 66 Q24 52 48 64 T96 58 V96 H0Z" fill="#fff" opacity=".12" />
      <path d="M0 78 Q26 66 52 77 T96 72 V96 H0Z" fill="#000" opacity=".16" />
      <circle cx="82" cy="14" r="22" fill="#fff" opacity=".08" />
      {glyph.kind === "brand" ? (
        <g transform="translate(24 24) scale(2)" fill={ink}><title>{glyph.title}</title><path d={glyph.path} /></g>
      ) : (
        <g transform="translate(24 24) scale(2)" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <glyph.Icon size={24} />
        </g>
      )}
    </svg>
  );
}

// Topics are free text (1,500+ of them), so match on keywords and fall back to the subject's own mark.
const TOPIC_ICONS: [RegExp, Icon][] = [
  [/rout|navigat|redirect|url/i, Route], [/secur|auth|permission|oauth|encrypt|vulnerab/i, Shield], [/password|login|token|key/i, Key],
  [/lock|privacy|ethic|compliance|legal|limitation/i, Scale], [/test|debug|error|exception|bug/i, Bug],
  [/data ?type|variable|constant|scope/i, Variable], [/array|list|collection|table|matrix/i, Table], [/loop|iterat|recurs|repeat/i, Repeat],
  [/function|method|callback|closure|lambda|promise|async/i, Braces], [/class|object|inherit|polymorph|encapsul|abstract|oop/i, Boxes],
  [/form|input|validat/i, FormInput], [/layout|grid|flex|responsive|position|box model/i, Layout], [/style|color|font|animation|theme|design|css/i, Palette],
  [/database|sql|query|schema|index|collection|mongo|mysql|storage/i, Database], [/server|deploy|host|cloud|aws|container|docker|ec2|s3/i, Server],
  [/api|rest|http|endpoint|request|webhook|json|xml/i, Webhook], [/network|dns|protocol|socket/i, Network],
  [/branch|merge|commit|rebase|clone|repo|git/i, GitBranch], [/package|npm|module|import|depend|install/i, Package],
  [/config|setting|setup|install|environment/i, Settings], [/perform|optimi|speed|cach|scal/i, Gauge], [/command|shell|terminal|cli|bash/i, Terminal],
  [/ai|model|gpt|llm|prompt|machine learning|neural|chatbot/i, Brain], [/chart|analytic|metric|report|dashboard|recharts|track/i, BarChart3],
  [/advertis|marketing|content|campaign|brand|seo|social|strateg/i, Megaphone], [/network|connect|follow|profile|people|team|sales|lead/i, Users],
  [/message|chat|comment|email|mail|inbox/i, MessageSquare], [/search|find|filter|sort/i, Search], [/plugin|extension|middleware|hook|component/i, Plug],
  [/mobile|app|react native|ios|android/i, Smartphone], [/growth|career|best practice|tips|trend/i, TrendingUp], [/start|intro|basic|fundamental|overview|getting/i, Rocket],
  [/web|html|dom|browser|page|site/i, Globe], [/code|syntax|script|program/i, Code],
];

/** Small round icon for a topic chip. */
function topicGlyph(topic: string) {
  const Icon = TOPIC_ICONS.find(([re]) => re.test(topic))?.[1] ?? BookOpen;
  return <Icon size={12} color="#fff" strokeWidth={2.2} />;
}

export function TopicChip({ topic, color }: { topic: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-sm">
      <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: color }}>{topicGlyph(topic)}</span>
      {topic}
    </span>
  );
}
