/**
 * Authoring source for the "Moksy brand & voice" track. Writes content/brand/moksy-brand-voice.json, loaded with
 *   npm run import:knowledge -- content/brand/moksy-brand-voice.json
 * Questions arrive as "review" and stay unpublished until an admin approves them at /admin/review/moksy-brand-voice.
 *   node scripts/build-brand-content.mjs
 *
 * Sources (moksy.ai repo, mokay.ai/):
 *   docs/brand/MOKSY_LEXICON.md                                  (2 Sep 2026): vocabulary, marks, rules
 *   apps/documentation/docs/frontend/brand-guidelines.md          (18 Aug 2026): colour, type, casing, voice
 *   docs/MOKSY_BRAND_AUDIT.md                                     (18 Aug 2026): founder decisions
 * Where the two disagree the lexicon (later) wins. Anything unsettled is left out on purpose: the legal entity name
 * (guidelines say "Moksy AI Ltd", this academy's company record says "Moksy Limited") and who may Sign-off a whole
 * Blueprint (the lexicon says Principal in one place and Senior in another).
 * Each question lists the correct answer first; the build shuffles options with a seed taken from the prompt.
 */
import fs from "node:fs";
import path from "node:path";

const seed = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (s) => { let a = seed(s); return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** q(level, prompt, correct, [wrong x3], hint, topic) */
const q = (level, prompt, correct, wrong, hint, topic) => {
  if (wrong.length !== 3) throw new Error(`need 3 wrong options: ${prompt}`);
  const opts = [correct, ...wrong], r = rng(prompt);
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  const keys = ["a", "b", "c", "d"];
  return { level, type: "mcq", prompt, options: opts.map((text, i) => ({ key: keys[i], text })), answer: keys[opts.indexOf(correct)], hint, topic };
};
/** open(level, prompt, model answer, rubric, topic) */
const open = (level, prompt, answer, rubric, topic) => ({ level, type: "scenario", prompt, answer, rubric, topic });

const items = [
  {
    title: "Name, tagline and the promise",
    body: "The product is written Moksy in prose: capital M, never MOKSY or moksy. The one tagline is \"Turn your idea into a build-ready plan.\" The one-line description of how it works is \"Idea in, build-ready plan out. AI structures it, vetted experts refine it.\" Three older taglines are retired from the interface: \"Empowering your digital transformation\", \"Building Future-Ready Brands\" and \"AI requirements + expert review\". The home headline stays \"Bring your idea to life\". The document Moksy produces is called a Blueprint; \"build-ready plan\" is its plain-English twin, which is why the tagline did not change when the document was named. Moksy is the voice that asks the questions: where the platform speaks it says \"Moksy will ask…\" or \"Tell Moksy…\". Source: brand guidelines (18 Aug 2026) and Moksy Lexicon (2 Sep 2026).",
    questions: [
      q(1, "How is the product name written in running text?", "Moksy", ["MOKSY", "moksy", "MoKsy"], "Capital M, lower-case rest.", "Name"),
      q(1, "What is Moksy's tagline?", "Turn your idea into a build-ready plan.", ["Empowering your digital transformation.", "Building Future-Ready Brands.", "AI requirements + expert review."], "The other three are retired.", "Tagline"),
      q(2, "Which of these taglines has been retired from the interface?", "Empowering your digital transformation", ["Turn your idea into a build-ready plan", "Idea in, build-ready plan out", "Bring your idea to life"], "The first is the old declared tagline that appeared nowhere in the product.", "Tagline"),
      q(2, "Which line describes how Moksy works in one sentence?", "Idea in, build-ready plan out. AI structures it, vetted experts refine it.", ["Idea in, finished app out. AI builds it, experts deploy it.", "Questions in, quotes out. People write it, AI checks it.", "Plan in, idea out. Experts structure it, AI refines it."], "AI structures, experts refine.", "Tagline"),
      q(3, "A draft post opens \"MOKSY helps founders…\". What do you change?", "Write Moksy with a capital M only", ["Nothing: brand names go in capitals", "Write it as moksy in lower case", "Write it as MOKSY AI"], "Moksy, always.", "Name"),
      q(3, "Which line is the home headline, which stays as it is?", "Bring your idea to life", ["Turn your idea into a build-ready plan", "Start free", "Get my Blueprint"], "The tagline is a separate line; Start free is the call to action.", "Tagline"),
      q(4, "You need the tagline in a bio. Which wording is correct?", "Turn your idea into a build-ready plan.", ["Moksy: Empowering your digital transformation", "Turn your idea into a build-ready spec", "Turn your idea into a Blueprint-ready plan"], "The tagline is fixed wording.", "Tagline"),
      q(4, "How should the platform refer to itself where it speaks to a customer?", "As Moksy, in the first person, such as \"Moksy will ask…\"", ["As the system", "As the engine", "As Newton"], "Never the system, the engine or Newton on a customer surface.", "Name"),
      q(5, "Why does the tagline still say \"plan\" when the document is called a Blueprint?", "Plan is the plain-English twin of Blueprint, so the tagline stays unchanged", ["Nobody has updated the tagline yet", "Plan is now the name of a membership", "Plan is the name for a Review"], "Blueprint is the mark; build-ready plan is its twin.", "Tagline"),
    ],
  },
  {
    title: "The spine and the six marks",
    body: "Five words, in order, carry the whole journey: Idea, Briefing, Blueprint, Review, Build. It is the tagline made concrete. Moksy owns six capitalised marks and keeps them rare on purpose, because every coined word is a word a new customer must learn: Moksy, MOX, MXP, Blueprint, Briefing and Ladder. Spec Sprint is also a proper noun: the one-day, human-led engagement, always two capitalised words, never split. Every mark has a plain-English twin that is shown on first use on a page, for example MOX (Moksy credit). Source: Moksy Lexicon part B (2 Sep 2026).",
    questions: [
      q(1, "What are the five words of the Moksy spine, in order?", "Idea, Briefing, Blueprint, Review, Build", ["Idea, Interview, Report, Review, Build", "Brief, Briefing, Blueprint, Sign-off, Export", "Idea, Plan, Spec, Review, Launch"], "Idea to Build.", "Spine"),
      q(2, "Which of these is NOT one of Moksy's six owned marks?", "Pillar", ["Blueprint", "Ladder", "Briefing"], "Pillars were renamed Areas.", "Marks"),
      q(2, "Which proper noun names the one-day, human-led engagement?", "Spec Sprint", ["Concierge", "Priority Review", "Starter"], "Two capitalised words, never split.", "Marks"),
      q(3, "What does the spine make concrete?", "The tagline", ["The pricing page", "The reviewer Ladder", "The email footer"], "Idea in, build-ready plan out, step by step.", "Spine"),
      q(3, "What does every Moksy mark come with?", "A plain-English twin that explains it", ["A trademark symbol", "A different colour", "A reviewer's approval"], "Shown on first use on a page.", "Marks"),
      q(4, "A page uses MOX for the first time. What should it do?", "Show the plain twin with it, such as MOX (Moksy credit)", ["Nothing: MOX is obvious", "Write it as mox to feel friendly", "Replace it with points"], "Marks get a twin on first use per page.", "Marks"),
      q(5, "Why are the marks kept to six?", "Every coined word is a word a new customer has to learn", ["Trademark law allows six", "The design system has six slots", "Reviewers asked for six"], "Rare on purpose.", "Marks"),
      q(5, "Which sentence uses the spine words correctly?", "Moksy asks questions in your Briefing, then builds your Blueprint.", ["Moksy asks questions in your interview, then builds your report.", "Moksy runs your discussion, then writes your spec.", "Moksy opens a chat, then produces a document."], "Briefing and Blueprint.", "Spine"),
    ],
  },
  {
    title: "Words for the customer journey",
    body: "Idea is what you type in. Briefing is the guided conversation where Moksy learns your idea; it replaces interview, conversation, Q&A and AI requirements. Brief is the answers your Briefing has gathered, as a noun. Blueprint is your build-ready plan; it replaces report, plan (as the document), spec, solution plan, document and blueprint variants. Areas are the analysis areas a Blueprint covers, 22 in a complete one; the word replaces pillars everywhere a customer or reviewer can read it. A Section is one rendered part of a Blueprint. Build is the stage after the Blueprint: exports, hiring, tools. The nav word Exports replaces Downloads. Source: Moksy Lexicon C1 (2 Sep 2026).",
    questions: [
      q(1, "What is the guided conversation where Moksy learns your idea called?", "Briefing", ["Interview", "Discussion", "Chat"], "Not Interview: it implies being judged.", "Journey words"),
      q(1, "What is a Blueprint?", "Your build-ready plan", ["A reviewer's payout", "A kind of membership", "Where your MOX lives"], "The document Moksy produces.", "Journey words"),
      q(2, "What are the Areas of a Blueprint?", "The analysis areas it covers, 22 in a complete one", ["The tracks a reviewer is accredited in", "The sections of the website", "The rungs of the Ladder"], "Areas replaced pillars.", "Journey words"),
      q(2, "Which word replaces \"pillars\" wherever a customer can read it?", "Areas", ["Sections", "Bands", "Rungs"], "A Blueprint has Areas.", "Journey words"),
      q(3, "What is a Brief?", "The answers your Briefing has gathered", ["The document Moksy produces", "A reviewer's feedback", "A paid engagement"], "Same root as Briefing.", "Journey words"),
      q(3, "Which one-word nav label replaced Downloads?", "Exports", ["Files", "Build", "Packages"], "Where Build starts.", "Journey words"),
      q(3, "What is a Section?", "One rendered part of a Blueprint", ["A kind of Review", "A reviewer's track", "A membership"], "Each Area renders as one or more Sections.", "Journey words"),
      q(4, "A teammate writes \"Start your Moksy interview\". How should it read?", "Start your Briefing", ["Start your Moksy conversation", "Start your Moksy Q&A", "Start your Moksy pillar"], "Interview was retired.", "Journey words"),
      q(4, "An email subject says \"Your Moksy report is ready\". What does the lexicon say it should be?", "Your Blueprint is ready", ["Your Moksy plan is ready", "Your Moksy document is ready", "Your Brief is ready"], "Report is retired for the document.", "Journey words"),
      q(5, "Which sentence uses the vocabulary correctly?", "Your Blueprint covers 22 Areas, each shown as one or more Sections.", ["Your report covers 22 pillars, each shown as one or more blocks.", "Your spec covers 22 areas, each shown as pages.", "Your document covers 22 bands, each shown as rungs."], "Blueprint, Areas, Sections.", "Journey words"),
      q(5, "Which word names the stage after the Blueprint and its Review?", "Build", ["Launch", "Export", "Deploy"], "The last word of the spine.", "Journey words"),
    ],
  },
  {
    title: "Reviews and who does them",
    body: "Review is one noun with three kinds, each a single adjective. Peer Review is free, from the community. Expert Review is included in Pro and Max and done by an accredited reviewer. Priority Review is paid and fast: an Expert Review within 36 hours. Priority won over Rush because it is already the on-screen badge and says what you buy, a place at the front. A review of one part of a Blueprint is a Section Review. The tabs on the Reviews page are Peer, Expert, Priority and History. Retired labels include Community review (now Peer Review) and Urgent expert review (now Priority Review). Source: Moksy Lexicon C1 and C9 (2 Sep 2026).",
    questions: [
      q(1, "Which Review is a free check by another member?", "Peer Review", ["Expert Review", "Priority Review", "Section Review"], "Free, from the community.", "Reviews"),
      q(2, "Which Review is included in Pro and Max?", "Expert Review", ["Peer Review", "Priority Review", "Rush Review"], "Done by an accredited reviewer.", "Reviews"),
      q(2, "What is a Priority Review?", "A paid Expert Review within 36 hours", ["A free check by another member", "A review of one Section only", "A review included in Free"], "Paid, fast, guaranteed clock.", "Reviews"),
      q(3, "What do the three kinds of Review share?", "One noun, Review, with a single adjective for each kind", ["One price", "One reviewer", "One deadline"], "Peer, Expert, Priority.", "Reviews"),
      q(3, "What is a review of one part of a Blueprint called?", "A Section Review", ["A Peer Review", "A Sign-off", "A Priority Review"], "Per-section work.", "Reviews"),
      q(3, "Which tab labels belong on the Reviews page?", "Peer, Expert, Priority, History", ["Free, Pro, Max, Team", "Open, Closed, Disputed, Paid", "Claim, Queue, Desk, Standing"], "One word each.", "Reviews"),
      q(4, "An old string says \"Community review\". What replaces it?", "Peer Review", ["Free Review", "Expert Review", "Open Review"], "Community review was retired.", "Reviews"),
      q(4, "An old string says \"Urgent expert review\". What replaces it?", "Priority Review", ["Rush Review", "Express Review", "Fast Expert Review"], "Rush was the runner-up.", "Reviews"),
      q(5, "Why is the paid fast Review called Priority rather than Rush?", "It is already the on-screen badge and says what you buy: a place at the front", ["Rush is a registered trademark", "Priority is shorter", "Reviewers voted for it"], "A naming decision made in the lexicon.", "Reviews"),
      q(5, "A customer on Free wants a check at no cost. Which Review do you point them to?", "Peer Review", ["Expert Review", "Priority Review", "Section Review"], "Expert is included in Pro and Max; Priority is paid.", "Reviews"),
    ],
  },
  {
    title: "Money and membership words",
    body: "MOX is Moksy credit; 1 MOX equals $0.01. It is always upper-case, with the plain twin on first use per page, and never written mox or Mox. MXP is Moksy Experience Points: the letters, upper-case, never XP, points or score. They are one transposition apart and sit side by side on the reviewer's Desk, so always pair a unit with its noun: Wallet · 1,200 MOX, Ladder · 340 MXP. Wallet is where MOX lives (not MOX wallet). A Pack is a one-off MOX purchase. Starter is the free MOX granted on joining. Escrow is MOX held while a Review is open, held until you accept the review. Membership is the monthly plan; customer names are Free, Pro and Max, with Team as the label for an organisation. The reviewer's monthly plan is Reviewer Membership: Reviewer, Reviewer Pro, Reviewer Elite. Earnings is MOX a reviewer has earned; Payouts is money sent to a bank. Tip is MOX sent to a reviewer beyond the fee. Spec Sprint requests live under Sprints, never called concierge on a customer surface. Source: Moksy Lexicon C3, C4 and B3 (2 Sep 2026).",
    questions: [
      q(1, "What is MOX?", "Moksy credit", ["Moksy Experience Points", "A reviewer rung", "A kind of Review"], "1 MOX = $0.01.", "Money"),
      q(1, "What is MXP?", "Moksy Experience Points", ["Moksy credit", "A kind of Membership", "A payout currency"], "What you climb the Ladder with.", "Money"),
      q(2, "What is 1 MOX worth?", "$0.01", ["$0.10", "$1", "$100"], "A cent.", "Money"),
      q(2, "Which are the customer Membership names?", "Free, Pro, Max", ["Starter, Fuller, Complete", "Visitor, Silver, Gold", "Guest, VIP, VVIP"], "Starter, Fuller and Complete are Blueprint sizes on the pricing page.", "Money"),
      q(3, "Where does your MOX live?", "In your Wallet", ["In your Escrow", "In your Ladder", "In your Pack"], "Not \"MOX wallet\".", "Money"),
      q(3, "What is a Pack?", "A one-off MOX purchase, such as a 1,000 MOX pack", ["A monthly Membership", "A reviewer's payout", "A bundle of Areas for free"], "Top up is the verb.", "Money"),
      q(3, "What is Starter?", "The free MOX granted on joining", ["A cheap Membership", "A small Blueprint", "A reviewer rung"], "Starter MOX.", "Money"),
      q(4, "Which stat tile follows the rules?", "Wallet · 1,200 MOX", ["1,200 mox in your MOX wallet", "Credits: 1,200", "Wallet · 1,200 MXP"], "Noun plus unit, upper-case.", "Money"),
      q(4, "MOX and MXP sit side by side on the reviewer's Desk. What protects against mixing them up?", "Always pair the unit with its noun, such as Wallet · MOX and Ladder · MXP", ["Always show them in different colours only", "Use XP for MXP", "Write MOX in lower case"], "They are one transposition apart.", "Money"),
      q(5, "What is Escrow?", "MOX held while a Review is open, until the customer accepts it", ["A free MOX grant", "A reviewer's monthly plan", "A kind of tip"], "Explained on first use.", "Money"),
      q(5, "Which pair names a reviewer's MOX earned and money sent to their bank?", "Earnings and Payouts", ["Payouts and Earnings", "Tips and Packs", "Escrow and Wallet"], "Two words, two states.", "Money"),
      q(5, "How should MXP be written in copy?", "Always MXP, never XP, points or score", ["XP is fine on busy screens", "Mxp, to match mox", "Experience score"], "Letters, upper-case.", "Money"),
    ],
  },
  {
    title: "Colour and logo",
    body: "One accent, a dark ink and neutrals. Primary brand colour is Moksy orange-red #EF4123; secondary is deep petrol #002835; accent grey is #6D6E71; text ink is #0F172A; the page canvas is #FAFBFC and surfaces are white. Brand orange is the only non-neutral colour used for actions, with one primary action per view; it is never replaced by black, blue, indigo or grey for a primary action. Status colours are emerald for success, amber for warning, rose for danger and indigo for info, used for data and state only, never as page fills. Logo files are local (horizontal and vertical master logos and an icon master); never link a remote moksy.ai URL as a fallback. Logo height is h-8 in headers and footers and h-10 on sign-in pages, with h-6 or h-7 for the compact icon mark. A decorative logo has empty alt text and aria-hidden; a meaningful image has descriptive alt text; an avatar's alt text is the person's name. Imagery is minimal and icon-led, with product and data visuals preferred over stock photography. Source: brand guidelines sections 2 and 4 (18 Aug 2026).",
    questions: [
      q(1, "What is Moksy's primary brand colour?", "#EF4123, an orange-red", ["#1E3A8A, a blue", "#002835, a deep petrol", "#6D6E71, a warm grey"], "The single accent.", "Colour"),
      q(1, "What is Moksy's secondary colour?", "#002835, deep petrol", ["#EF4123, orange-red", "#FAFBFC, off-white", "#0F172A, ink"], "High-emphasis dark surfaces.", "Colour"),
      q(2, "Which is the only non-neutral colour used for actions?", "Brand orange", ["Indigo", "Emerald", "Black"], "Brand orange only.", "Colour"),
      q(2, "What is the page canvas colour?", "#FAFBFC", ["#EF4123", "#0F172A", "#002835"], "Cards and panels are white on top of it.", "Colour"),
      q(3, "How many primary actions should a view have?", "One", ["Two, one per column", "As many as there are tasks", "None: use links"], "One primary per view.", "Colour"),
      q(3, "What are emerald, amber, rose and indigo used for?", "Status in data and state only, never page fills", ["Page backgrounds in different sections", "Primary buttons for each team", "Heading colours"], "Success, warning, danger, info.", "Colour"),
      q(4, "A designer proposes a black Save button as the primary action. What is the verdict?", "Not allowed: a primary action is brand orange", ["Fine: black is a neutral", "Fine on admin pages only", "Allowed if it has an icon"], "Never black, blue, indigo or grey for a primary action.", "Colour"),
      q(4, "How tall is the logo on a sign-in page?", "h-10", ["h-5", "h-8", "h-16"], "Header and footer use h-8.", "Logo"),
      q(4, "Where should logo files come from?", "Local assets, never remote moksy.ai URLs", ["Whichever site is fastest", "The CDN used by the marketing site", "A link to the public moksy.ai logo"], "Local only.", "Logo"),
      q(5, "What alt text goes on a purely decorative logo?", "Empty alt text with aria-hidden", ["\"Moksy logo\"", "\"Image\"", "The page title"], "Decorative means hidden from screen readers.", "Logo"),
      q(5, "What is the alt text of a person's avatar?", "The person's name", ["\"Profile\"", "\"Avatar\"", "Nothing"], "Never alt=\"Profile\".", "Logo"),
      q(5, "What imagery direction does Moksy prefer?", "Minimal, icon-led graphics and product or data visuals over stock photography", ["Stock photos of teams shaking hands", "Busy gradient illustrations", "Photographs of founders on every page"], "Clear, calm, uncluttered.", "Logo"),
    ],
  },
  {
    title: "Typography and casing",
    body: "Headings use Bebas Neue (decided by the founder 18 Aug 2026; the font file still has to be added, until then headings render in the system font). Body text is Myriad Variable and code and ids use JetBrains Mono. The type scale is expressed as roles: display (marketing hero only), headline (one page title per screen), subheadline (section heading), title (card heading), eyebrow (a small micro-label and the only sanctioned ALL-CAPS), lead, paragraph and small. The maximum weight is semibold. Casing: headings, buttons, navigation, tabs and labels use Title Case; body copy, descriptions, help text, empty-state messages and tooltips use sentence case; proper nouns stay as written. Buttons are one verb where possible, with a verb-first label. Empty states read \"No {things} yet.\" with the trailing full stop, for example \"No Blueprints yet.\" Source: brand guidelines sections 3 and 6 and Lexicon C9 (2 Sep 2026).",
    questions: [
      q(1, "Which typeface did the founder choose for all headings?", "Bebas Neue", ["Myriad Variable", "JetBrains Mono", "Georgia"], "Display, condensed.", "Type"),
      q(2, "What casing do headings and buttons use?", "Title Case", ["sentence case", "ALL CAPS", "lower case"], "Body copy is sentence case.", "Casing"),
      q(2, "What casing does body copy use?", "Sentence case", ["Title Case", "ALL CAPS", "Any, as long as it is consistent per page"], "Headings are Title Case.", "Casing"),
      q(2, "Which font is for ids and code?", "JetBrains Mono", ["Bebas Neue", "Myriad Variable", "Arial"], "Mono for code.", "Type"),
      q(3, "Where is ALL-CAPS allowed?", "Only through the eyebrow style", ["On any heading", "On buttons that matter", "In email subjects"], "Never literal shouting.", "Casing"),
      q(3, "What is the maximum font weight in the scale?", "Semibold", ["Regular", "Bold", "Black"], "font-black and font-extrabold are out.", "Type"),
      q(4, "Which button label follows the rules?", "Save", ["SAVE", "Save changes and continue to the next screen", "save it now"], "One verb, Title Case.", "Casing"),
      q(4, "Which empty state follows the pattern?", "No Blueprints yet.", ["No data available", "Nothing here!", "No blueprints found"], "\"No {things} yet.\"", "Casing"),
      q(5, "How many headline-role titles should a screen have?", "One", ["Two, one per column", "As many as there are sections", "None"], "One page title per screen.", "Type"),
      q(5, "Which role is for the marketing hero heading only?", "Display", ["Headline", "Eyebrow", "Lead"], "Display is 40 to 48 pixels.", "Type"),
      q(5, "In Title Case, which of these is a proper noun that stays as written?", "Moksy", ["Save", "Briefing as a verb", "Today"], "Proper nouns are kept.", "Casing"),
    ],
  },
  {
    title: "Voice, tone and spelling",
    body: "Moksy's personality is friendly, professional and confident, in plain language that never adds guesswork. Spelling is British English everywhere a person reads: organise, colour, analyse, centre, behaviour, judgement, cancelled, catalogue, artefact, grey, towards; licence as a noun and license as a verb; programme for a scheme but program for software. Code identifiers, enum values, HTTP header names and CSS keep their original spelling. Customer and reviewer surfaces use the lexicon words. Operator surfaces may keep internal names such as pillars, Newton, Base and Master or Patterns, but those names never appear on a customer or reviewer surface, in an email or in a generated document. Words that name people never use Ninja, Guru, Mystic, Sage or Master as titles, so they read the same in every country. A register split between terse admin copy and warmer customer copy is allowed, but it must be deliberate. Source: brand guidelines section 6 and Lexicon B3 (2 Sep 2026).",
    questions: [
      q(1, "Which three words describe Moksy's voice?", "Friendly, professional, confident", ["Playful, edgy, loud", "Formal, distant, technical", "Casual, sarcastic, quick"], "Plain language.", "Voice"),
      q(1, "Which spelling does Moksy use in copy?", "British English", ["American English", "A mix, whichever the writer prefers", "Australian English"], "Moksy is a UK product.", "Voice"),
      q(2, "Which is the British spelling of the verb meaning to arrange?", "organise", ["organize", "organyse", "orgenise"], "Also colour, analyse, centre.", "Spelling"),
      q(2, "Which is the British spelling of the word for hue?", "colour", ["color", "colur", "collour"], "Also grey, catalogue.", "Spelling"),
      q(3, "Which is right for a partner scheme: programme or program?", "Programme", ["Program", "Both are always wrong", "Programm"], "Program is for software.", "Spelling"),
      q(3, "Which is correct for the noun in \"a software ___\"?", "licence", ["license", "licens", "lisence"], "Licence is the noun and license the verb.", "Spelling"),
      q(4, "Which line is better plain-language copy?", "Moksy asks you a few questions, then builds your Blueprint.", ["Moksy ingests your input to synthesise requirement artefacts.", "Our engine orchestrates a requirement elicitation workflow.", "Leverage Moksy to operationalise ideation."], "Plain words, no guesswork.", "Voice"),
      q(4, "Where do code identifiers, enum values and CSS keep their original spelling?", "They are not changed by the British English rule", ["They are rewritten to British spelling", "Only CSS is exempt", "Only enum values are exempt"], "The rule covers what a person reads.", "Spelling"),
      q(5, "Which names may stay on operator surfaces but never appear on customer or reviewer surfaces?", "Pillars, Newton, Base and Master, Patterns", ["Blueprint, Briefing, Areas", "Moksy, MOX, MXP", "Peer, Expert, Priority"], "Internal register only.", "Voice"),
      q(5, "Which of these words must not be used as a title for a person?", "Ninja", ["Fellow", "Principal", "Reviewer"], "Also Guru, Mystic, Sage and Master.", "Voice"),
      q(5, "Is it acceptable for admin screens to read terser than customer screens?", "Yes, if the register split is deliberate and documented", ["No, every screen must read the same", "Only on mobile", "Only in emails"], "A split is allowed, an accident is not.", "Voice"),
    ],
  },
  {
    title: "People and the Ladder",
    body: "Persona homes are Home for the customer, Desk for the reviewer and Console for staff. The people words are Guest (not signed in), Member (signed in, on Free), Customer (anyone with a Project), Reviewer (accredited) and Staff (operator). The only customer standing words are Guest, Member, Pro and Max. Moksy is the platform as an actor, in first person; never the system, the engine, Newton or Moksy AI on a customer surface. The reviewer Ladder has six named rungs, with numeric levels beneath: Candidate, Contributor, Reviewer, Senior, Principal and Fellow, written as, for example, Senior · Level 9. The twenty fantasy titles (Novice to Titan) and the five tier names (Foundation to Apex) are retired from every Moksy surface. A Standing is where a reviewer is now: rung, band and tracks. Band is how demanding a piece of work is (C1 to C4). Calibration is the blind test with seeded defects. Accreditation is the whole route to Reviewer. Source: Moksy Lexicon C2, C4 to C6 (2 Sep 2026).",
    questions: [
      q(1, "What is the reviewer's home called?", "Desk", ["Home", "Console", "Dashboard"], "Customer: Home. Staff: Console.", "People"),
      q(2, "What is the customer's home called?", "Home", ["Desk", "Console", "Workspace"], "My workspace is retired.", "People"),
      q(2, "Which word describes someone signed in but on the Free membership?", "Member", ["Guest", "Visitor", "User"], "Guest is not signed in.", "People"),
      q(3, "What are the six rungs of the reviewer Ladder, in order?", "Candidate, Contributor, Reviewer, Senior, Principal, Fellow", ["Novice, Apprentice, Master, Guru, Sage, Titan", "Foundation, Practitioner, Authority, Mastery, Apex, Fellow", "Junior, Mid, Senior, Lead, Head, Chief"], "Six named rungs.", "Ladder"),
      q(3, "How is a reviewer's rung and level written?", "Senior · Level 9", ["L9 Senior", "Level 9 Grandmaster", "Rung 6 of 20"], "Named rung plus numeric level.", "Ladder"),
      q(4, "On Moksy's reviewer Ladder, which names are retired from every surface?", "The twenty fantasy titles and the five tier names", ["Candidate and Fellow", "Reviewer and Senior", "Band and Standing"], "Replaced by six rungs.", "Ladder"),
      q(4, "Which words must never be used to name the platform on a customer surface?", "The system, the engine, Newton", ["Moksy", "Moksy, in first person", "Tell Moksy"], "Always Moksy.", "People"),
      q(5, "What is Calibration?", "The blind test with seeded defects", ["The reviewer's monthly plan", "A kind of Review", "The reviewer's payout"], "Part of Accreditation.", "Ladder"),
      q(5, "What is Band?", "How demanding a piece of work is, from C1 to C4", ["A reviewer's rung", "A membership tier", "A kind of Area"], "Simple, Single system, Complex, Regulated.", "Ladder"),
    ],
  },
  {
    title: "Emails, buttons and navigation",
    body: "Email subjects follow the formula {Thing} + {state}, with Title Case on the mark and sentence case otherwise, and Moksy always capitalised: \"Your Blueprint is ready\", \"{n} areas added to your Moksy account\", \"You can now claim Expert Reviews\", \"Review my Blueprint: {name}\" and the generic \"Moksy update\" (not \"Moksy Notification\"). Buttons are one verb with one glyph per verb: Start, Continue, Claim, Export, Share, Review and Top up (the one two-word verb). There is one primary call to action everywhere, \"Start free\"; \"Get my Blueprint\" is used on the home form only. Customer navigation is one word each: Home, Projects, Briefing, Blueprint, Reviews, Exports, Messages, Wallet, Membership, Areas, Sprints, Profile. Reviewer navigation: Desk, Queue, Standing, Ladder, Earnings, Payouts, Membership, Directory, Accreditation, Availability. Source: Moksy Lexicon C8 and C9 (2 Sep 2026).",
    questions: [
      q(2, "What is the email subject formula?", "{Thing} plus {state}", ["{Greeting} plus {offer}", "{Brand} plus {date}", "{Verb} plus {exclamation}"], "For example Your Blueprint is ready.", "Email"),
      q(3, "Which subject line is right when a Blueprint has finished?", "Your Blueprint is ready", ["Your Moksy report is ready!!", "MOKSY Blueprint READY", "Moksy Notification"], "Thing plus state.", "Email"),
      q(3, "What replaces the generic subject \"Moksy Notification\"?", "Moksy update", ["Moksy alert", "Notification from moksy", "Moksy news!"], "Capital M, plain words.", "Email"),
      q(3, "What is the one primary call to action everywhere?", "Start free", ["Get started now", "Sign up", "Try it today"], "Get my Blueprint is on the home form only.", "CTA"),
      q(4, "Which verbs are on the approved button list?", "Start, Continue, Claim, Export, Share, Review, Top up", ["Submit, Proceed, Engage, Leverage", "Buy, Pay, Checkout, Subscribe", "Go, Next, Done, OK"], "One verb, one glyph.", "CTA"),
      q(4, "An old subject says \"500 pillars added to your moksy account\". What should it be?", "500 areas added to your Moksy account", ["500 pillars added to your Moksy account", "500 areas added to your moksy account", "Your pillars were added"], "Areas, and a capital M.", "Email"),
      q(5, "Which is the customer navigation, one word each?", "Home, Projects, Briefing, Blueprint, Reviews, Exports, Messages, Wallet, Membership, Areas, Sprints, Profile", ["Dashboard, My Projects, Interview, Report, Reviews, Downloads, Inbox, MOX wallet, Plan, Pillars, Concierge, My Profile", "Home, Desk, Queue, Standing, Ladder, Earnings, Payouts", "Start, Continue, Claim, Export, Share, Review, Top up"], "The second list is the reviewer nav; the third is buttons.", "Navigation"),
      q(5, "Which is the only two-word button verb?", "Top up", ["Get started", "Sign in", "Learn more"], "The one exception.", "CTA"),
    ],
  },
];

// -------- written answers (graded by Claude against the rubric)
items[0].questions.push(open(6,
  "Rewrite this draft LinkedIn post so it follows Moksy's brand and vocabulary: \"MOKSY AI's engine ingests your brief via our interview and generates a spec report with pillars, reviewed by community or urgent experts. Get started with a free account today!!\"",
  "Moksy asks you a few questions in your Briefing, then builds your Blueprint across up to 22 Areas. Get a free Peer Review or a Priority Review within 36 hours. Start free.",
  "A good answer: writes Moksy with a capital M (not MOKSY); speaks as Moksy rather than \"the engine\"; uses Briefing, Blueprint, Areas, Peer Review and Priority Review instead of interview, report/spec, pillars, community review and urgent review; uses plain language; uses British spelling if any applies; ends on the single call to action \"Start free\"; drops the double exclamation marks. Partial credit for fixing some terms; no credit for keeping the retired words.",
  "Applying the brand"));
items[5].questions.push(open(6,
  "A colleague proposes a campaign graphic with a blue Buy Now button, a stock photo of a handshake and the slogan \"EMPOWERING YOUR DIGITAL TRANSFORMATION\" in capitals. List what you would change and why.",
  "Make the primary button Moksy orange (#EF4123), because brand orange is the only action colour. Replace the stock photo with a minimal, icon-led or product visual. Replace the retired tagline with \"Turn your idea into a build-ready plan.\" Remove the all-capitals: ALL-CAPS is only for the eyebrow style. Use Title Case on the button and a short verb such as Start.",
  "A good answer names at least four of: primary action must be brand orange not blue; imagery should be minimal icon-led or product/data not stock photography; the slogan is a retired tagline and should be \"Turn your idea into a build-ready plan.\"; ALL-CAPS is only allowed through the eyebrow style; Title Case and a short verb for the button (Buy is not on the approved list; Start free is the primary call to action); one primary action per view. Give credit for each correct change with its reason.",
  "Applying the brand"));
items[3].questions.push(open(7,
  "Write about 60 words for a first-time customer explaining what a Priority Review is, using Moksy's own vocabulary.",
  "A Priority Review is an Expert Review with a clock on it: an accredited reviewer checks your Blueprint within 36 hours. It is paid, so you get a place at the front of the queue. If you would rather not pay, a Peer Review is free, and Expert Reviews are included in Pro and Max.",
  "A good answer: says a Priority Review is a paid Expert Review done within 36 hours by an accredited reviewer; refers to the document as a Blueprint; uses the Review names (Peer, Expert, Priority) correctly; if MOX is mentioned it appears upper-case with its plain twin (Moksy credit) on first use; sounds friendly, professional and confident in plain language; uses British spelling; roughly 60 words. Penalise: calling it urgent or rush review, report/spec, jargon such as engine or pillars.",
  "Applying the brand"));
items[8].questions.push(open(7,
  "Rewrite these three email subject lines to follow Moksy's formula: (1) \"Your Moksy report!!\" (2) \"500 pillars added to your moksy account\" (3) \"Moksy Notification\". Explain the rule you applied.",
  "(1) Your Blueprint is ready. (2) 500 areas added to your Moksy account. (3) Moksy update. The rule is {Thing} plus {state}, with Title Case on the mark, sentence case otherwise, Moksy always capitalised, and the lexicon words (Blueprint, Areas) instead of report and pillars.",
  "A good answer gives: (1) Your Blueprint is ready (state included, no exclamation marks, Blueprint not report); (2) 500 areas added to your Moksy account (Areas not pillars; capital M); (3) Moksy update. It also states the {Thing} + {state} formula or equivalent. Partial credit for getting two of three or for naming the rule without correct rewrites.",
  "Applying the brand"));

const lessons = [
  [1, "Moksy in a nutshell", ["Moksy is written with a capital M, always", "Tagline: Turn your idea into a build-ready plan.", "The spine: Idea, Briefing, Blueprint, Review, Build", "MOX is Moksy credit; MXP is Moksy Experience Points"]],
  [2, "The core words", ["Briefing is the conversation; Blueprint is the plan", "Areas replaced pillars", "Peer, Expert and Priority are the three Reviews", "Free, Pro and Max are the memberships"]],
  [3, "Using the words", ["Brief: the answers your Briefing gathered", "Wallet holds MOX; a Pack is a one-off purchase", "Eyebrow is the only place for ALL-CAPS", "Headings and buttons in Title Case, body in sentence case"]],
  [4, "Spotting mistakes", ["Retired words: interview, report, pillars, community review, concierge", "One primary action per view, in brand orange", "British spelling, plain language, no jargon on customer surfaces", "Never call the platform the system, the engine or Newton"]],
  [5, "Putting it together", ["Pair every unit with its noun: Wallet · MOX, Ladder · MXP", "Email subjects: {Thing} + {state}", "One call to action: Start free", "Operator names stay out of customer surfaces, emails and generated documents"]],
];

// -------- write
const prompts = new Set(), counts = {};
for (const it of items) for (const x of it.questions) {
  if (prompts.has(x.prompt)) throw new Error(`duplicate prompt: ${x.prompt}`);
  prompts.add(x.prompt);
  counts[x.level] = (counts[x.level] ?? 0) + 1;
}
const out = path.resolve("content/brand");
fs.mkdirSync(out, { recursive: true });
const file = { trackSlug: "moksy-brand-voice", status: "review", lessons: lessons.map(([level, title, syllabus]) => ({ level, title, syllabus })), items };
fs.writeFileSync(path.join(out, "moksy-brand-voice.json"), JSON.stringify(file, null, 1) + "\n");
console.log("moksy-brand-voice", prompts.size, "questions, per level:", JSON.stringify(counts));
