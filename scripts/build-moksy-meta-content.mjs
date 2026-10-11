/**
 * Authoring source for the "Moksy on Meta" track (slug moksy-meta-marketing): how to use Facebook and Instagram ads
 * in a way that fits Moksy's documented economics, positioning, content motion and brand rules.
 * Writes content/brand/moksy-meta-marketing.json, loaded with
 *   npm run import:knowledge -- content/brand/moksy-meta-marketing.json
 * Questions arrive as "review" and stay unpublished until an admin approves them at /admin/review/moksy-meta-marketing.
 *   node scripts/build-moksy-meta-content.mjs
 *
 * Sources (moksy.ai repo, mokay.ai/), read 2026-10-11:
 *   docs/SEO.md                                (2026-09-21): price range, economics, growth motion, positioning, editorial rules, measurement
 *   docs/brand/MOKSY_LEXICON.md                (2026-09-02): vocabulary, audiences, call to action
 *   apps/documentation/docs/frontend/brand-guidelines.md (2026-08-18): colour, casing, spelling, imagery
 *   docs/MOKSY_INTEGRATIONS_MASTER_PLAN.md     : Facebook sign-in and Facebook Page import status
 *   docs/promo/LAUNCH_PROMO_SPEC.md            (a PROPOSAL, 2026-08-13): used only for two dated cautions
 * What the documents do NOT contain, and so this track does not teach: any paid-social budget, targeting, audience
 * definition, offer, creative brief or KPI target; a Facebook Page or ad account; or a decision to run paid social at
 * all. The documented motion is content and search. General Meta Ads craft is in facebook-marketing-titan.
 * Prices of reviews are unsettled in the repo (two tables disagree) and are left out. Dated statements are marked.
 * Each question lists the correct answer first; the build shuffles options with a seed taken from the prompt.
 */
import fs from "node:fs";
import path from "node:path";

const seed = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (s) => { let a = seed(s); return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const q = (level, prompt, correct, wrong, hint, topic) => {
  if (wrong.length !== 3) throw new Error(`need 3 wrong options: ${prompt}`);
  const opts = [correct, ...wrong], r = rng(prompt);
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  const keys = ["a", "b", "c", "d"];
  return { level, type: "mcq", prompt, options: opts.map((text, i) => ({ key: keys[i], text })), answer: keys[opts.indexOf(correct)], hint, topic };
};
const open = (level, prompt, answer, rubric, topic) => ({ level, type: "scenario", prompt, answer, rubric, topic });

const items = [
  {
    title: "Moksy's economics and its documented growth motion",
    body: "Moksy's SEO document (written 21 September 2026) says Moksy costs £19 to £79 a month, so its revenue is a volume number: at those prices £100k a year is roughly 280 to 440 paying subscribers. It concludes that outbound sales cannot reach that and that growth \"is a content and search problem\". The documented motion is therefore guides and search, shipped at one guide a week, with two events to track by landing page: free Blueprint started and Pro upgrade. Results are reviewed at 4, 8 and 12 weeks along the chain impressions, clicks, Blueprints, Pro: a guide with impressions but no clicks needs a better title; one with clicks but no Blueprints needs a better close. Nothing should be expected for four to eight weeks, because judging earlier measures the crawler's schedule, not the content. Paid social is not part of the documented motion: any Facebook or Instagram test is new and has to earn its place against the same numbers. A subscriber on £19 a month pays £228 in a year before churn and costs, which sets a ceiling on what can sensibly be paid to win one. Source: moksy.ai docs/SEO.md.",
    questions: [
      q(1, "What price range does Moksy's SEO document give for the product?", "£19 to £79 a month", ["£5 to £15 a month", "£99 to £299 a month", "It is free for everyone"], "Pro and above.", "Economics"),
      q(1, "According to the SEO document, what kind of problem is Moksy's growth?", "A content and search problem", ["An outbound sales problem", "A hardware problem", "A hiring problem"], "Outbound cannot reach the volume.", "Economics"),
      q(2, "Roughly how many paying subscribers does £100k a year take at Moksy's prices?", "About 280 to 440", ["About 20 to 40", "About 1,000 to 2,000", "About 10,000"], "A volume number.", "Economics"),
      q(2, "Why does the document say outbound sales cannot reach the target?", "At £19 to £79 a month, revenue is a volume number", ["Because customers hate phone calls", "Because outbound is illegal", "Because Moksy has no sales staff"], "Low price, high volume.", "Economics"),
      q(2, "How long does the document say to expect nothing after fixing the site?", "Four to eight weeks", ["One day", "Three months exactly", "Never"], "Crawling, indexing and trust take time.", "Economics"),
      q(3, "Is paid social a documented part of Moksy's growth motion?", "No: the documented motion is content and search, so any paid test is new and must earn its place", ["Yes, it is the main channel", "Yes, but only on Instagram", "It was banned by the board"], "The documents do not mention it.", "Economics"),
      q(3, "How much does a subscriber on £19 a month pay in a year, before churn and costs?", "£228", ["£190", "£19", "£2,280"], "19 × 12.", "Economics"),
      q(3, "Which two events does the SEO document say to track by landing page?", "Free Blueprint started and Pro upgrade", ["Page views and scroll depth", "Likes and shares", "Email opens and unsubscribes"], "The only numbers that say whether a guide earns its place.", "Economics"),
      q(4, "A test brings Pro subscribers at £19 a month for £300 each, and they stay about 12 months on average. Ignoring costs, is that sensible?", "No: a subscriber pays about £228 in that time, less than the £300 it cost to win them", ["Yes: any subscriber is profitable", "Yes: because Pro is the cheapest plan", "It cannot be judged without a logo"], "Compare lifetime value with acquisition cost.", "Economics"),
      q(4, "At which points does the document say to review a new motion?", "4, 8 and 12 weeks", ["Every day", "After one week only", "Only at year end"], "Impressions to clicks to Blueprints to Pro.", "Economics"),
      q(4, "What does judging results before four to eight weeks measure, according to the document?", "The crawler's schedule, not the content", ["The quality of the logo", "The size of the audience", "The price of the product"], "Too early to tell.", "Economics"),
      q(5, "Which chain does the document say to review?", "Impressions, clicks, Blueprints, Pro", ["Likes, shares, comments, followers", "Visits, bounces, exits, returns", "Reach, frequency, CPM, ROAS"], "It ends at paid subscribers.", "Economics"),
      q(5, "A guide has clicks but no Blueprints. What does the document say it needs?", "A better close", ["A better title", "More impressions", "A longer introduction"], "Impressions but no clicks needs a better title.", "Economics"),
      q(5, "A guide has impressions but no clicks. What does the document say it needs?", "A better title", ["A better close", "A new product", "More paid traffic"], "The same logic applies to an ad's hook.", "Economics"),
    ],
  },
  {
    title: "Positioning: the only voice not selling the build",
    body: "The SEO document's central position: every page that ranks for questions such as \"how much does it cost to build an app in the UK\" belongs to an agency that wants to win the build, so Moksy is the only voice in the result list not selling the build, and that neutrality is the entire advantage. It sets editorial rules: never recommend a builder, not even a sister company; ranges are labelled as ranges, and as agency marketing, and only figures that appear in a source are stated, with nothing interpolated to look precise; and every guide ends in the same place: a range is not your number, and the free Blueprint is how you get yours, which is an honest conversion because it is literally what the product does. The head term is saturated by agencies with years of links, so Moksy does not fight it. The winnable ground is the gap between \"I have an idea\" and \"I have signed an agency\": questions with high intent, weak current answers and a direct line to the product. Source: docs/SEO.md section 4.",
    questions: [
      q(1, "What is Moksy's position among the results for \"how much does it cost to build an app\"?", "The only voice not selling the build", ["The cheapest builder", "The biggest agency", "A recruitment site"], "Neutrality is the advantage.", "Positioning"),
      q(1, "What are the five words of the Moksy spine, in order?", "Idea, Briefing, Blueprint, Review, Build", ["Idea, Interview, Report, Review, Build", "Brief, Plan, Spec, Sign-off, Export", "Idea, Plan, Spec, Review, Launch"], "From the lexicon.", "Positioning"),
      q(1, "What is a Blueprint?", "Moksy's name for your build-ready plan", ["A reviewer's payout", "A kind of Membership", "A Facebook ad format"], "The document Moksy produces.", "Positioning"),
      q(1, "What does Moksy turn an idea into, according to its tagline?", "A build-ready plan", ["A finished app", "A funded start-up", "A trained AI model"], "Turn your idea into a build-ready plan.", "Positioning"),
      q(2, "Which editorial rule governs whom a Moksy guide may recommend?", "Never recommend a builder, not even a sister company", ["Recommend the cheapest builder", "Recommend one partner studio", "Recommend whoever pays most"], "The neutrality would be gone.", "Positioning"),
      q(2, "How are price ranges presented in Moksy content?", "Labelled as ranges and as agency marketing, using only figures from a source", ["As exact quotes", "As Moksy's own prices", "Rounded to look precise"], "Nothing interpolated.", "Positioning"),
      q(3, "Which stage of the buyer's journey does Moksy aim at?", "The gap between \"I have an idea\" and \"I have signed an agency\"", ["After the product is built", "Only enterprise procurement", "Existing customers only"], "High intent, weak current answers.", "Positioning"),
      q(3, "How does every Moksy guide end?", "A range is not your number; the free Blueprint is how you get yours", ["With a price list", "With a phone number", "With a competitor comparison"], "The same close every time.", "Positioning"),
      q(3, "Why is that close described as honest?", "Because it is literally what the product does", ["Because it is short", "Because it is legally required", "Because it is free"], "The Blueprint gives your own number.", "Positioning"),
      q(4, "Which Facebook ad headline respects the editorial rules?", "How much will your app really cost? Get your own number with a free Blueprint.", ["Build your app for £5,000 with our partner studio", "The UK's cheapest app builders, ranked", "Apps from £999, guaranteed"], "No builder, no unsourced figure.", "Positioning"),
      q(4, "An ad says \"Build your app for £5,000 with our partner studio\". Which rules does it break?", "It recommends a builder and states an unsourced figure", ["It uses British spelling", "It mentions a price", "It is too short"], "Two editorial rules.", "Positioning"),
      q(4, "Why does Moksy not fight for the head search term about app cost?", "It is saturated by agencies with years of links", ["It is banned by Google", "It has no volume", "Moksy cannot afford a website"], "Fight where the gap is.", "Positioning"),
      q(5, "A teammate wants to blend two sourced price ranges into one precise figure for an ad. What do the rules say?", "Do not: only figures that appear in a source are stated, and nothing is interpolated", ["Do it, if the figure looks neat", "Do it, if it is rounded", "Do it, if competitors do"], "Precision that is not in a source is a claim.", "Positioning"),
      q(5, "An ad quotes a price range for building an app. What must accompany it under Moksy's rules?", "That it is a range from a source and agency marketing, and that the Blueprint gives the reader's own number", ["A link to a builder", "A discount code", "A countdown timer"], "Labelled, sourced, and closing on the Blueprint.", "Positioning"),
    ],
  },
  {
    title: "Who Moksy is for: starting points and audiences",
    body: "Moksy names six starting points for a project: a booking system, an e-commerce website, a SaaS MVP, a marketplace, a school website and a mobile app (the guides compare a mobile app with a web app). Booking system and e-commerce website guides are in wave 1 of the guides; the SaaS MVP, marketplace, school website and mobile app versus web app cost guides complete the six in wave 2. The public site's audience pages are Founders, Teams and startups, Agencies, Enterprise, Education and Public sector. The product's one-line description is: Idea in, build-ready plan out; AI structures it, vetted experts refine it. Because the guides are built around the gap between having an idea and signing an agency, ads aimed at a starting point should send people to the guide for that starting point, not to a generic page. Source: docs/SEO.md and the Moksy Lexicon.",
    questions: [
      q(1, "How many starting points does Moksy name for a project?", "Six", ["Two", "Three", "Twelve"], "Booking system, e-commerce website, SaaS MVP, marketplace, school website, mobile app.", "Audience"),
      q(2, "Which of these is one of Moksy's starting points?", "A booking system", ["A video game", "A payroll bureau", "A data centre"], "One of the six.", "Audience"),
      q(2, "Which set lists Moksy's six starting points?", "Booking system, e-commerce website, SaaS MVP, marketplace, school website, mobile app", ["Logo, website, brochure, banner, poster, flyer", "Server, database, firewall, router, switch, cable", "Report, pillar, area, section, block, figure"], "Projects people begin.", "Audience"),
      q(2, "Which are audience pages on the Moksy site?", "Founders, Teams and startups, Agencies, Enterprise, Education, Public sector", ["Pilots, Chefs, Farmers, Judges, Doctors, Artists", "Free, Pro, Max, Team, Guest, Member", "Home, Desk, Console, Queue, Standing, Ladder"], "Six audiences.", "Audience"),
      q(3, "Which of these is NOT one of the audience pages?", "Freelance photographers", ["Founders", "Education", "Public sector"], "Only six are listed.", "Audience"),
      q(3, "Which guides complete the set of six starting points?", "Wave 2: SaaS MVP, marketplace, school website, and mobile app versus web app", ["Wave 1: the eight cost and hiring guides", "The home page FAQ", "The privacy policy"], "Booking system and e-commerce came first.", "Audience"),
      q(3, "What is Moksy's one-line description of how it works?", "Idea in, build-ready plan out. AI structures it, vetted experts refine it.", ["Code in, app out. Engineers deploy it.", "Money in, leads out. Agents sell it.", "Plan in, idea out. Experts structure it."], "From the brand guideline.", "Audience"),
      q(4, "An ad is aimed at people planning a school website. Where should it send them?", "To the guide for that starting point, ending in the free Blueprint", ["To the home page only", "To a generic pricing table", "To a competitor's article"], "Match the promise to the page.", "Audience"),
      q(4, "Why should an ad for a booking system point to the booking-system guide?", "The ad's promise should match the page, and each guide is built for one starting point", ["Because guides load faster", "Because Facebook requires it", "Because the home page is broken"], "Relevance raises Blueprint starts.", "Audience"),
      q(5, "How many audience pages does the public site list?", "Six", ["Two", "Nine", "Twelve"], "Founders, Teams and startups, Agencies, Enterprise, Education, Public sector.", "Audience"),
      q(5, "A founder with an idea but no developer clicks an ad. Which guide cluster fits the stage of that visitor best?", "Cost and briefing guides, which sit before hiring an agency", ["Reviewer accreditation", "Enterprise procurement", "Investor relations"], "The gap between idea and agency.", "Audience"),
    ],
  },
  {
    title: "Landing pages, calls to action and what to measure",
    body: "The guides are Moksy's landing pages. Wave 1 is eight guides: the software cost hub, app development cost, booking system cost, e-commerce website cost, a software requirements document template, how to compare software development quotes, fixed price versus time and materials, and questions to ask a software agency. All are linked from /resources/guides. The one primary call to action everywhere is \"Start free\", and \"Get my Blueprint\" is used on the home form only. The document says to track free Blueprint started and Pro upgrade with the landing page as a dimension, because that is the only number that says whether a page earns its place. For paid traffic the same logic applies at ad level: a high click-through rate with few Blueprint starts points at the landing page's close; low click-through points at the ad's hook. Meta's pixel or Conversions API would be needed to measure those events, and consent rules decide whether they may fire (see facebook-marketing-titan). Source: docs/SEO.md, Moksy Lexicon C7.",
    questions: [
      q(1, "What is the one primary call to action everywhere on Moksy?", "Start free", ["Buy now", "Book a call", "Join the waitlist"], "One CTA.", "Landing"),
      q(2, "Where is \"Get my Blueprint\" used?", "On the home form only", ["On every button", "In email footers only", "On the pricing page only"], "Start free is the primary CTA elsewhere.", "Landing"),
      q(2, "How many guides are in wave 1?", "Eight", ["Two", "Twenty", "Three"], "Cost and hiring clusters.", "Landing"),
      q(3, "Where are all the wave-1 guides linked from?", "/resources/guides", ["/pricing", "/login", "/admin"], "One click from a page Google already has.", "Landing"),
      q(3, "Which wave-1 guide targets people searching for a requirements document template?", "The software requirements document template guide, because the Blueprint is literally that document", ["The fixed price versus time and materials guide", "The booking system cost guide", "The questions to ask an agency guide"], "SERP owned by tools; the Blueprint is the document.", "Landing"),
      q(3, "Which number does the document say tells whether a page earns its place?", "Free Blueprint started and Pro upgrade, by landing page", ["Page views", "Time on page", "Number of social shares"], "Outcome, not activity.", "Landing"),
      q(4, "An ad set has a high click-through rate but very few Blueprint starts. Where do you look first?", "The landing page's close and whether it matches the ad's promise", ["The ad's colour only", "The number of impressions", "The time of day"], "Clicks without Blueprints needs a better close.", "Landing"),
      q(4, "An ad set has low click-through rate. What does Moksy's own diagnosis suggest?", "The hook (the headline or first line) needs improving", ["The product is wrong", "The pixel is missing", "The audience is too small"], "Impressions without clicks needs a better title.", "Landing"),
      q(4, "Which two Moksy events would you send to Meta to optimise for real value, rather than clicks?", "Free Blueprint started and Pro upgrade", ["Page view and scroll", "Like and share", "Video view and comment"], "They are the documented success events.", "Landing"),
      q(5, "What must be true before the Meta pixel sends those events from visitors in regions that require consent?", "Visitors have given consent through your consent setup", ["The ad has been approved", "The page has a banner image", "The event has a long name"], "See the consent management concept.", "Landing"),
      q(5, "Why is a free Blueprint a sensible conversion for a paid ad, given Moksy's positioning?", "It is literally what the product does and gives the reader their own number", ["Because free offers always convert", "Because Meta prefers free offers", "Because it avoids needing a landing page"], "An honest conversion.", "Landing"),
    ],
  },
  {
    title: "Brand rules for Moksy ad creative",
    body: "Moksy's brand guideline and lexicon apply to ads like any other copy. Moksy is written with a capital M; the tagline is \"Turn your idea into a build-ready plan.\" and three older taglines are retired (\"Empowering your digital transformation\", \"Building Future-Ready Brands\", \"AI requirements + expert review\"). The document Moksy produces is a Blueprint and the guided conversation is a Briefing; \"report\", \"interview\" and \"pillars\" are retired words. The spine is Idea, Briefing, Blueprint, Review, Build. Headings and buttons use Title Case, body copy sentence case, and ALL-CAPS only through the eyebrow style. Spelling is British English. Brand orange #EF4123 is the only non-neutral action colour, with one primary action per view; status colours are for state, not decoration. Imagery is minimal and icon-led, with product and data visuals preferred over stock photography. Decorative images have empty alt text; meaningful ones have descriptive alt text. Voice is friendly, professional and confident, in plain language. Source: brand-guidelines.md and MOKSY_LEXICON.md (see moksy-brand-voice).",
    questions: [
      q(1, "What is Moksy's primary brand colour?", "#EF4123, an orange-red", ["#1E3A8A, a blue", "#002835, deep petrol", "#6D6E71, a warm grey"], "The one accent.", "Creative"),
      q(1, "Which three words describe Moksy's voice?", "Friendly, professional, confident", ["Playful, edgy, loud", "Formal, distant, technical", "Casual, sarcastic, quick"], "Plain language.", "Creative"),
      q(1, "How is the product name written in ad copy?", "Moksy", ["MOKSY", "moksy", "MoKsy"], "Capital M, lower-case rest.", "Creative"),
      q(2, "What casing do ad headlines and button labels use?", "Title Case", ["sentence case", "ALL CAPS", "lower case"], "Body copy is sentence case.", "Creative"),
      q(2, "Which spelling does Moksy use in ad copy?", "British English", ["American English", "A mix", "Whichever the writer prefers"], "A UK product.", "Creative"),
      q(3, "Which line is correct ad body copy?", "Moksy asks you a few questions in your Briefing, then builds your Blueprint.", ["Our engine runs an interview and produces a report across 22 pillars.", "Leverage AI synergies to ideate your app.", "Answer our chat and receive your spec document."], "Briefing and Blueprint.", "Creative"),
      q(3, "Which colour should the primary call-to-action button in an ad image use?", "Brand orange", ["Black", "Indigo", "Grey"], "Only non-neutral action colour.", "Creative"),
      q(4, "Which image direction fits Moksy's ads?", "Minimal, icon-led graphics and product or data visuals", ["Stock photos of people shaking hands", "Busy gradient collages", "Photographs of founders on every ad"], "Over stock photography.", "Creative"),
      q(4, "An ad headline reads \"START YOUR APP TODAY\". What is wrong?", "ALL-CAPS is only allowed through the eyebrow style; headlines use Title Case", ["Nothing: capitals attract attention", "It is too short", "It uses British spelling"], "No literal shouting.", "Creative"),
      q(4, "Which of these taglines must not appear in a new ad?", "Empowering your digital transformation", ["Turn your idea into a build-ready plan", "Idea in, build-ready plan out", "Bring your idea to life"], "Retired from copy.", "Creative"),
      q(5, "Which words must ad copy avoid for the document Moksy produces?", "Report, spec and solution plan as its name; the document is a Blueprint", ["Blueprint", "Build-ready plan as the plain twin", "Briefing"], "Blueprint is the mark; build-ready plan is its twin.", "Creative"),
      q(5, "A designer adds a decorative Moksy logo to an ad's landing page. What alt text does it need?", "Empty alt text with aria-hidden", ["\"Moksy logo\"", "\"Image\"", "The page title"], "Decorative means hidden from screen readers.", "Creative"),
      q(5, "How many primary actions should a single ad creative have?", "One", ["Two, one per column", "As many as there are offers", "None"], "One primary per view.", "Creative"),
    ],
  },
  {
    title: "Claims and guardrails: what you may promise",
    body: "Ads are claims, so they may only describe what exists and can be evidenced. Moksy's integrations plan lists Facebook sign-in as existing but gated by environment settings, and a Facebook Page import as absent: it would use the Graph API with pages_show_list and pages_read_engagement and needs Meta's App Review, and no ad should promise it unless that has changed. Figures in ads must come from a source, as the editorial rules say. Two dated cautions come from the launch promo proposal of 13 August 2026 (a proposal, not a decision, so check whether they still hold): guest AI quotas reset when a new session is minted, so inference spend is uncapped and a public free tier gets farmed, so a guest or free offer should not be pushed with paid traffic until that is fixed; and you cannot state what a free review is worth until one price table is chosen, because two disagreed, so ads should not quote review values. Source: docs/MOKSY_INTEGRATIONS_MASTER_PLAN.md and docs/promo/LAUNCH_PROMO_SPEC.md.",
    questions: [
      q(2, "May an ad promise \"Import your Facebook Page into Moksy\"?", "No: the integrations plan lists the Facebook Page import as absent, so it must not be advertised unless that has changed", ["Yes: it is live", "Yes, but only on Instagram", "Yes, if you add small print"], "Only describe what exists.", "Claims"),
      q(3, "What is the status of Facebook sign-in in Moksy's integrations plan?", "It exists but is gated by environment settings", ["It is absent", "It is only for staff", "It was removed"], "Env-gated.", "Claims"),
      q(3, "Why must ads describe only features that exist?", "An ad is a claim, and promising an absent feature misleads people", ["Because Meta charges more otherwise", "Because competitors might copy it", "Because ads are not read"], "Claims need evidence.", "Claims"),
      q(4, "What would a Facebook Page import need, according to the integrations plan?", "The Graph API with pages_show_list and pages_read_engagement, and Meta's App Review", ["A Chrome extension", "A new pricing plan", "A phone call to Meta"], "A platform approval is required.", "Claims"),
      q(4, "Where must the figures in an ad come from?", "A source, with nothing interpolated to look precise", ["Whatever sounds good", "The competitor's website", "An average the team invents"], "Editorial rule.", "Claims"),
      q(4, "May an ad say a Moksy free review is worth a specific amount?", "Not while the repository's two review price tables disagree; do not quote review values", ["Yes: quote the higher one", "Yes: quote the lower one", "Yes: quote an average"], "A dated caution from the promo proposal.", "Claims"),
      q(5, "The August 2026 promo proposal warns against pushing a guest or free offer before a fix. What is the problem it describes?", "Guest AI quotas reset when a new session is minted, so inference spend is uncapped and a public free tier gets farmed", ["Guests cannot see the logo", "Free offers are banned by Meta", "The offer needs a longer name"], "Check whether it still holds.", "Claims"),
      q(5, "The proposal is dated 13 August 2026 and is a proposal. How should you use its cautions?", "As things to verify before launching, not as current facts", ["As settled policy", "As proof the fix is done", "Ignore them entirely"], "Check the current state first.", "Claims"),
      q(5, "A colleague wants an ad headline \"Moksy builds your app\". Which Moksy fact does that contradict?", "Moksy produces a build-ready plan (a Blueprint); it does not build the app", ["Moksy only sells hosting", "Moksy is a recruitment site", "Moksy builds apps for free"], "The tagline is plan, not app.", "Claims"),
    ],
  },
];

// -------- written answers (graded by Claude against the rubric)
items[1].questions.push(open(6,
  "Write a Facebook ad for someone who is thinking about a booking system for their small business and has not yet spoken to any agency. Give the primary text (no more than 50 words), a headline and the call-to-action label, following Moksy's positioning and brand rules.",
  "Primary text: Wondering what a booking system will really cost? Agency quotes vary widely and every one is selling you the build. Answer a few questions in your Briefing and get your own numbers in a free Blueprint, a build-ready plan you can take to any agency. Headline: Get Your Own Booking System Number. Call to action: Start free.",
  "A good answer: speaks to the stage between having an idea and signing an agency; takes the neutral position (not recommending any builder); promises the reader's own number via a free Blueprint rather than a price; uses Moksy vocabulary (Briefing, Blueprint, build-ready plan); uses British English, Title Case headline and sentence-case body; one call to action, Start free; stays within roughly 50 words; invents no prices, statistics or testimonials and does not claim Moksy builds the app. Penalise quoting a price, naming a builder, ALL-CAPS, or retired words (report, interview, pillars).",
  "Applying the brand"));
items[4].questions.push(open(6,
  "A manager proposes this Facebook ad: a stock photo of two people shaking hands, the headline \"BUILD YOUR APP FOR £4,999 WITH MOKSY'S PARTNER STUDIO!\", and a blue Buy Now button linking to the home page. List every problem against Moksy's rules and rewrite the ad.",
  "Problems: it recommends a builder (a partner studio) and breaks the neutrality rule; it states an unsourced price (£4,999); it implies Moksy builds apps, but Moksy produces a build-ready plan; ALL-CAPS headline (only the eyebrow may use capitals) and the headline is not Title Case; the button is blue and says Buy Now, but the single primary action is brand orange and the CTA is Start free; stock photography instead of minimal icon-led or product visuals; it sends everyone to the home page instead of a matching guide. Rewrite: icon-led image, headline in Title Case such as \"How Much Will Your App Really Cost?\", body in sentence case offering your own number in a free Blueprint, orange Start free button linking to the relevant guide.",
  "A good answer names at least five of: recommends a builder; unsourced price; implies Moksy builds the app; ALL-CAPS/casing; wrong button colour and CTA label; stock photo; wrong landing page. The rewrite should respect neutrality, avoid an invented figure, use Start free in brand orange, minimal imagery and a matching guide. Credit each correct problem with its reason.",
  "Applying the brand"));
items[0].questions.push(open(7,
  "Design a 12-week paid Facebook test for Moksy that fits its documented economics and motion. State the objective, the landing page, the events you would measure, the review points, and the rule you would use to stop or continue. Do not invent budgets or results.",
  "Treat it as a test that must earn its place against a content-and-search motion. Objective: free Blueprint starts (a lead or sales-style conversion, optimised on the free Blueprint started event once enough events exist). Landing page: the guide matching the starting point in the ad, ending in the free Blueprint. Measure: free Blueprint started and Pro upgrade by landing page, plus ad-level click-through rate, cost per Blueprint start and cost per Pro subscriber, using the pixel or Conversions API with consent. Review at 4, 8 and 12 weeks along impressions, clicks, Blueprints, Pro. Clicks without Blueprints means improve the landing page close; impressions without clicks means improve the hook. Stop or continue by comparing cost per Pro subscriber with what a subscriber pays (about £228 a year at £19 a month, before churn and costs): if acquisition costs exceed that, stop or change the offer; avoid judging before the learning phase and the early weeks have passed. Keep ads within the editorial and brand rules, advertise only features that exist, and set the budget from what the business is willing to spend rather than from this plan.",
  "A good answer: ties the test to Moksy's documented economics and motion; picks a sensible objective tied to the free Blueprint event; uses the matching guide as landing page; names the two events and consent for tracking; reviews at 4, 8 and 12 weeks with the impressions-clicks-Blueprints-Pro chain and the correct diagnosis for each break; has a stop rule comparing cost per paying subscriber with what a subscriber pays; respects the learning phase; keeps to brand and editorial rules; does not invent a budget or results. Penalise guaranteed numbers, ignoring unit economics, or advertising absent features.",
  "Test design"));
items[5].questions.push(open(7,
  "Your Facebook test is getting plenty of clicks but very few free Blueprint starts. A colleague suggests adding \"Import your Facebook Page into Moksy\" to the ad to improve results. Diagnose the problem and respond to the suggestion.",
  "Clicks without Blueprints points at the landing page's close or at a mismatch between the ad's promise and the page, not at the ad's hook. Check that the ad's starting point matches the guide it links to, that the page ends in the free Blueprint close with a single Start free action, that the page loads fast, and that tracking is firing correctly with consent. I would not add the Facebook Page import line: the integrations plan lists it as absent (it would need the Graph API and Meta's App Review), so the ad would promise a feature that does not exist, which misleads people and risks the ad's policy standing. Instead test a clearer hook and a sharper close, and keep claims to what Moksy does today: a free Blueprint that gives your own number.",
  "A good answer: diagnoses clicks-without-Blueprints as a landing-page or promise-mismatch problem and lists concrete checks (match, close, speed, tracking and consent); rejects the Facebook Page import claim because it is absent per the integrations plan and would need Meta App Review; proposes legitimate tests instead. Penalise accepting the claim, blaming only the audience, or inventing results.",
  "Troubleshooting"));

const lessons = [
  [1, "Moksy's economics and motion", ["Price range £19 to £79 a month: a volume business", "Growth is a content and search problem, not outbound", "Success events: free Blueprint started and Pro upgrade", "Paid social is not documented: any test must earn its place"]],
  [2, "Position and audience", ["Moksy is the only voice not selling the build", "Never recommend a builder; ranges labelled; only sourced figures", "Six starting points; six audience pages", "Every guide ends: the free Blueprint gives your own number"]],
  [3, "Pages and numbers", ["Guides are the landing pages; one primary CTA: Start free", "A subscriber on £19 a month pays £228 a year before churn", "Review at 4, 8 and 12 weeks: impressions, clicks, Blueprints, Pro", "Ads need the same close as the page they send people to"]],
  [4, "Creative rules", ["Moksy with a capital M; Blueprint and Briefing, not report and interview", "Title Case headlines and buttons; sentence case body; British English", "Brand orange for the one action; minimal icon-led imagery", "No ALL-CAPS headlines; no retired taglines"]],
  [5, "Claims and tests", ["Advertise only features that exist: no Facebook Page import", "Do not quote review values or unsourced prices", "Dated cautions: check whether guest-quota and price-table issues still hold", "Keep unit economics in view: cost per Pro subscriber versus what a subscriber pays"]],
];

const prompts = new Set(), counts = {};
for (const it of items) for (const x of it.questions) {
  if (prompts.has(x.prompt)) throw new Error(`duplicate prompt: ${x.prompt}`);
  prompts.add(x.prompt);
  counts[x.level] = (counts[x.level] ?? 0) + 1;
}
const out = path.resolve("content/brand");
fs.mkdirSync(out, { recursive: true });
const file = { trackSlug: "moksy-meta-marketing", status: "review", lessons: lessons.map(([level, title, syllabus]) => ({ level, title, syllabus })), items };
fs.writeFileSync(path.join(out, "moksy-meta-marketing.json"), JSON.stringify(file, null, 1) + "\n");
console.log("moksy-meta-marketing", prompts.size, "questions, per level:", JSON.stringify(counts));
