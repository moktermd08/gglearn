/**
 * Problems people actually have, in their own words, and the stops of the business map that help.
 * A person who does not know their role, stage or the map's names can type what is wrong and be shown where to start.
 * `say` is how the person puts it; `words` are other ways to say it (matching is on words, so list the ones people really use).
 * `first` is one thing to do today that needs no course; `done` is what is true when the problem is smaller. `pro` marks where
 * learning ends and a lawyer, accountant, insurer or other professional begins.
 */
export type ProblemDef = {
  id: string; say: string; words: string; stops: string[]; first: string; done: string; pro?: string;
  /** shown as a starting situation before anything is typed */ common?: boolean;
};

export const BUSINESS_PROBLEMS: ProblemDef[] = [
  // ---- I do not know where to start / what the company is
  { id: "company", common: true, say: "I work for a company and don't really understand what it does or how it makes money", words: "new job joined employer company brand mission vision purpose understand what does the company do how make money customers products onboarding", stops: ["mission", "promise", "icp", "model", "offer", "pricing", "numbers", "culture", "goals", "strategy"],
    first: "Ask three people: who pays us, for what, and why us rather than someone else. Write the answers in one paragraph.", done: "You can explain in a minute who the company serves, what it sells, how it earns money and what it is aiming at." },
  { id: "noidea", common: true, say: "I want to start a business but have no idea what to do", words: "no idea what business start ideas where do ideas come from want own business side hustle", stops: ["idea", "market", "talk", "icp", "test"],
    first: "List five annoying problems you or people you know had this month, and who would pay to fix each.", done: "You have one problem, one kind of customer, and ten people you can ask about it." },
  { id: "oneidea", say: "I have an idea but don't know if anyone wants it", words: "idea validate validation demand want need market test prototype will people buy", stops: ["market", "rivals", "talk", "test", "startcost"],
    first: "Describe the idea to ten people who might buy it and ask what they do about the problem today. Do not pitch.", done: "You have heard real reasons to buy or not to buy, and a go or no-go." },
  { id: "whichidea", say: "I have several ideas and can't choose", words: "choose pick between ideas options decide which cannot choose too many", stops: ["idea", "icp", "talk", "test", "startcost"],
    first: "Score each idea 1-5 on: I know the customer, I can reach them, they already pay for something similar.", done: "One idea is picked for a reason you can say out loud." },
  { id: "noclue", say: "I don't know where to start, or what I don't know", words: "lost overwhelmed confused start where begin dont know beginner basics", stops: ["idea", "plan", "books", "pricing", "sales"],
    first: "Write what you sell, to whom, for how much, in three lines. Whatever you can't fill in is what to learn first.", done: "You know which of the basics is your weakest and have chosen to learn it first." },
  { id: "comms", say: "My emails, reports and presentations don't land, and people don't do what I ask", words: "communication communicate writing emails email reports presentation present speaking public speaking persuade influence explain unclear pitch convince stakeholders confusing ignored misunderstood meeting clear message tell story", stops: ["comms", "rhythm", "perfrep", "offer"],
    first: "Take the last message that did not land. Rewrite it in three lines: what has happened, why it matters, and the one thing you need them to do by when.", done: "People can say back what you asked and why, and the right thing happens without a second reminder." },
  { id: "firefight", common: true, say: "I'm always firefighting and never get to the important work", words: "firefighting fire fighting time management priorities prioritise prioritize busy overloaded no time interruptions urgent important to do list overwhelmed distracted procrastinate always behind work life balance", stops: ["priorities", "weekly", "process", "roles", "automate"],
    first: "Write everything you did yesterday. Mark each item: only I can do this, someone else could, or it did not need doing. Then protect one hour tomorrow for the first kind.", done: "You start each week with three priorities, hand on or drop the rest, and the important work gets done before the urgent." },
  { id: "decisions", common: true, say: "Decisions take forever, get reversed, or I just go with my gut", words: "decision decisions decide slow indecision reversed gut feeling analysis paralysis too long choose choices bias groupthink consensus who decides data evidence second guess", stops: ["decide", "decisions", "risks", "rhythm", "board"],
    first: "Take your next big choice. Write the options, what you would need to know, who decides, and the date you will decide by. Then set a date to check how it went.", done: "Important decisions have an owner, a deadline and a written reason, and you review whether they worked." },
  { id: "mission", common: true, say: "We have a mission statement but nobody uses it, or I don't know what mission and vision mean", words: "mission vision purpose values statement why we exist meaning poster slogan what is our mission vision difference values mean direction brand purpose", stops: ["mission", "promise", "culture", "goals", "tellteam", "strategy"],
    first: "Finish two sentences: \"We exist to help ___ do ___.\" and \"In five years we want to be ___.\" Then ask three colleagues to do the same and compare.", done: "You can say what the company is for (mission), where it is heading (vision) and how it behaves (values), and decisions can be checked against them." },
  // ---- money
  { id: "busybroke", common: true, say: "I'm busy all the time but still broke", words: "busy broke no money profit profitable not making money working hard cant afford struggling margins", stops: ["pricing", "profit", "numbers", "cashwatch", "startcost"],
    first: "Take your last five jobs or sales. For each write the price, the direct costs and the hours. See which ones really paid.", done: "You know what each product or job earns after costs and your time, and which to change." },
  { id: "cash", common: true, say: "I make sales but run out of cash", words: "cash flow runs out of cash no cash late payments bills overdue overdraft pay suppliers wages cash crunch", stops: ["cashplan", "cashwatch", "invoice", "budget", "funding"],
    first: "List every payment due and every payment expected over the next 13 weeks, by week.", done: "You can see the week your cash is lowest, weeks ahead, and what you will do about it." },
  { id: "late", say: "Customers pay me late", words: "late payment chasing invoices unpaid debt debtors credit terms owed money not paying", stops: ["invoice", "terms", "cashwatch", "contracts"],
    first: "Send invoices the same day, with a due date and your terms, and call anything seven days overdue.", done: "Most invoices are paid on time and you have a routine for the rest." },
  { id: "price", say: "I don't know how to price what I sell", words: "price pricing charge rates quote undercharge too cheap how much to charge fees cost plus", stops: ["pricing", "startcost", "profit", "offer"],
    first: "Work out your cost for one job or unit, including your own time, then add the margin you need.", done: "You have a price you can defend, built from cost and value." },
  { id: "books", say: "I don't understand bookkeeping, accounts or my numbers", words: "bookkeeping accounts accounting numbers spreadsheet receipts profit and loss balance sheet read accounts records tax receipts", stops: ["books", "bank", "numbers", "tax", "records"],
    first: "Open a separate business bank account and put every receipt in one folder or app from today.", done: "Every month you can read your income, costs and profit on one page.", pro: "An accountant should file your tax and check your accounts." },
  { id: "tax", say: "I'm scared of tax, VAT and getting it wrong", words: "tax vat hmrc self assessment return deadline penalty irs sales tax payroll tax", stops: ["tax", "books", "records", "structure"],
    first: "Write down which taxes apply to you and their dates. Put the dates in a calendar.", done: "You know which taxes you owe and when, and nothing is a surprise.", pro: "Ask an accountant to confirm what applies to you." },
  { id: "funding", say: "I need money to start or grow and don't know the options", words: "funding loan investor grant raise money capital finance bank crowdfunding equity borrow", stops: ["startcost", "funding", "forecast", "growbudget"],
    first: "Work out exactly how much you need and what it buys. Lenders and investors ask this first.", done: "You know how much you need, what it is for, and which sources fit." },
  { id: "growmoney", say: "Can we afford to grow? I don't know if growth will pay", words: "afford growth expand expansion investment return payback budget spend hire open second site", stops: ["growopts", "growbudget", "cashwatch", "capacity", "forecast"],
    first: "For one growth idea write the cost, the extra income, and the month it pays back.", done: "You have a growth plan with costs, income and a cash check." },
  // ---- customers and sales
  { id: "nocust", common: true, say: "I get no customers or enquiries", words: "no customers no sales no enquiries no leads cant find customers nobody buying marketing not working quiet", stops: ["icp", "offer", "channels", "site", "leads", "referrals"],
    first: "Pick one kind of customer and one place they already are. Contact ten of them this week with a clear offer.", done: "A steady number of enquiries comes from a channel you chose on purpose." },
  { id: "sell", say: "I hate selling and don't know how to close", words: "selling sales close closing objections negotiate pitch proposal quote follow up cold call shy", stops: ["sales", "leads", "offer", "referrals"],
    first: "After your next enquiry, ask two questions about their problem before saying anything about your service.", done: "You can run a sales conversation from first question to asking for the order." },
  { id: "online", say: "My website or social media isn't bringing anything in", words: "website social media instagram facebook seo google ranking traffic followers posting content not converting", stops: ["site", "social", "content", "tracking", "ads"],
    first: "Look at your page as a stranger: in five seconds can they tell what you do, for whom, and what to do next?", done: "Your site says what you offer and what to do next, and you can see how many visitors become enquiries." },
  { id: "ads", say: "I spend on ads and don't know if it works", words: "ads advertising google ads facebook ads waste budget cost per click roas return", stops: ["ads", "tracking", "channels", "profit"],
    first: "Before spending more, work out the most you can pay to win one customer and still profit.", done: "You know the cost of winning a customer and stop channels that cost more than they earn." },
  { id: "leave", common: true, say: "Customers don't come back, or keep leaving", words: "churn losing customers leaving repeat business loyalty retention cancel unhappy", stops: ["feedback", "complaints", "keep", "cfeed", "reviews"],
    first: "Call three customers who left and ask, with no defence, what made them go.", done: "You know the top reasons customers leave and have fixed the first one." },
  { id: "angry", say: "Dealing with complaints and angry customers", words: "complaint angry customer refund upset difficult rude abuse bad review", stops: ["complaints", "std", "support", "cfeed", "reviews"],
    first: "Write down the last complaint. Say sorry for the experience, say what you will do, and say by when.", done: "You have a calm routine for complaints, and people usually leave satisfied." },
  { id: "bigcust", say: "One customer is most of my income", words: "one big customer depend dependent key client concentration lose client eggs", stops: ["keyacc", "keep", "referrals", "newmkts", "risks"],
    first: "Work out the percentage of income from your biggest customer. Over 30% is a risk to plan for.", done: "No single customer can sink you, and the big one is looked after on purpose." },
  // ---- what we sell
  { id: "range", say: "We sell too many things and some don't make money", words: "too many products range bloat unprofitable lines services simplify focus cut", stops: ["range", "profit", "retire", "newoffers"],
    first: "List every product with its sales and profit. Circle the bottom third.", done: "You keep what pays, and have a plan for what doesn't." },
  { id: "quality", say: "Quality is inconsistent or things go wrong for customers", words: "quality mistakes errors defects returns inconsistent standards faults rework", stops: ["quality", "qcheck", "process", "std", "improve"],
    first: "Write the five things that must be right every time. Check them before anything goes out.", done: "Customers get the same quality each time and mistakes are found before they reach them." },
  { id: "late-orders", say: "Orders go out late, wrong or get lost", words: "late orders delivery wrong lost shipping deadline fulfilment delays dispatch", stops: ["orders", "delivery", "process", "capacity", "stockctl"],
    first: "Follow one order from start to finish and write every step and handover. Find where it sticks.", done: "Orders move through a written process and you can see where each one is." },
  { id: "stock", say: "I'm out of stock or stuck with stock I can't sell", words: "stock inventory overstock understock reorder dead stock warehouse materials", stops: ["stock", "stockctl", "supreview", "capacity"],
    first: "Count what you hold, mark what hasn't moved in 90 days, and set a reorder level for your top ten items.", done: "You rarely run out and rarely hold stock that will not sell." },
  { id: "supplier", say: "My supplier let me down or raised prices", words: "supplier vendor price rise let down late delivery dependent single source contract", stops: ["suppliers", "supreview", "contracts", "stock"],
    first: "Find a second supplier for your most important item and get a quote, even if you don't switch.", done: "You have a backup, a contract you understand, and a review habit." },
  // ---- people
  { id: "firsthire", say: "I need to hire my first person and don't know how", words: "hire hiring first employee recruit job ad interview employ contractor staff", stops: ["roles", "hire", "recruit", "paysetup", "employlaw", "induct"],
    first: "Write the six tasks you want off your plate. If they add up to a role, you are ready to hire.", done: "You have a role, a pay range, a legal contract and a first-week plan.", pro: "Check contracts and employment status with an employment adviser." },
  { id: "manager", common: true, say: "I've just become a manager and I'm not sure how to do it", words: "new manager promoted team lead first time manage people delegate one to one feedback leadership supervise", stops: ["leaders", "perf", "rhythm", "train", "wellbeing"],
    first: "Book a 30-minute one-to-one with each person and ask: what's in your way, and what would help?", done: "You run a regular one-to-one and give clear feedback, and the team knows what is expected." },
  { id: "underperform", say: "Someone on my team isn't performing", words: "underperforming poor performance lazy mistakes warning difficult employee disciplinary dismiss", stops: ["perf", "leaders", "employlaw", "payreview"],
    first: "Write down specific examples, the standard expected, and what you have already said. Then have a direct conversation.", done: "The person knows the standard and what happens next, and you have a record.", pro: "Take HR or employment advice before any formal step." },
  { id: "quit", say: "Good people keep leaving", words: "turnover staff leaving resign retention attrition morale unhappy exit engagement", stops: ["wellbeing", "culture", "payreview", "leaders", "perf"],
    first: "Ask two people who stayed and two who left: what would have made it better?", done: "You know the real reasons and have acted on the biggest one." },
  { id: "overwhelm", say: "I do everything myself and can't delegate", words: "everything myself no time delegate overwhelmed overworked bottleneck founder control burnout", stops: ["priorities", "process", "roles", "automate", "train", "policies"],
    first: "Write down everything you did this week. Mark each as only-me or someone-else-could-do-it.", done: "Work is written down, shared, and does not stop when you are away." },
  { id: "chaos", say: "Nobody knows who decides what and things fall between teams", words: "unclear responsibility decisions who owns silo politics slow decisions confusion handoff blame meetings", stops: ["decide", "decisions", "roles", "approvals", "rhythm", "policies"],
    first: "List the five decisions that stall most. Write who decides each, and who must be asked first.", done: "Every important decision has one owner, and meetings end with named actions." },
  // ---- legal and risk
  { id: "legal", say: "I don't know which legal setup, licences or insurance I need", words: "legal structure limited company sole trader partnership licence permit insurance register liability registration", stops: ["structure", "register", "licence", "insure", "rules"],
    first: "Write what you do, who might be hurt or lose money, and who owns the business. Take that to an adviser.", done: "You know your structure, your licences and your cover, and why.", pro: "A solicitor and an insurance broker should confirm this for your case." },
  { id: "contract", say: "I sign contracts I don't fully understand", words: "contract terms agreement sign clause liability dispute small print nda", stops: ["contracts", "contractrev", "terms", "risks"],
    first: "Before signing anything, underline what you must do, what you get, when you can leave, and who pays if it goes wrong.", done: "You can read a contract's key terms and know when to get it checked.", pro: "A solicitor should review anything large or unusual." },
  { id: "data", say: "Customer data, privacy and GDPR worry me", words: "gdpr data protection privacy personal data breach consent cookies security customer information", stops: ["dataprot", "custdata", "secbasics", "records", "backups"],
    first: "List what personal data you hold, where it is kept, and who can see it.", done: "You know what you hold, why, who has access and how to respond to a breach.", pro: "Ask a data protection adviser if you hold sensitive data." },
  { id: "hacked", say: "I'm worried about being hacked or losing data", words: "hacked cyber security phishing ransomware password backup lost data scam virus", stops: ["secbasics", "backups", "cyber", "systems"],
    first: "Turn on two-step sign-in for email and banking today, and check you can restore a backup.", done: "Strong sign-in, tested backups, and a plan if something goes wrong." },
  { id: "risk", say: "I'm worried about what could go wrong", words: "risk worry what if disaster plan contingency crisis uncertainty protect unknown threat", stops: ["unknowns", "risks", "insure", "backups", "advisers"],
    first: "List the five things that would hurt most if they happened, and what you would do for each.", done: "You have a short risk list with an owner and a response for the top risks." },
  { id: "rules", say: "I don't know the rules for my industry", words: "regulations rules compliance regulator inspection health safety sector requirements standards audit", stops: ["rules", "compliance", "safety", "licence", "records"],
    first: "Find your sector's regulator or trade body and read their guidance for new businesses.", done: "You have a list of the rules that apply and dates when you must act.", pro: "Confirm with a specialist adviser for regulated work." },
  // ---- tools and numbers
  { id: "tools", say: "I don't know which software or tools I need", words: "software tools apps systems crm spreadsheet subscription which system choose automation", stops: ["tools", "systems", "crm", "automate"],
    first: "List the jobs you do every week and how. Look for tools only for the ones that eat the most time.", done: "You use a small set of tools on purpose and nothing is paid for and unused." },
  { id: "measure", say: "I don't know what to measure or how I'm doing", words: "metrics kpi measure numbers dashboard data performance track progress results reporting", stops: ["tracking", "numbers", "dash", "goals", "perfrep"],
    first: "Pick three numbers: how many enquiries, how many become sales, and money in the bank. Check them weekly.", done: "You look at the same few numbers every week and act on them." },
  { id: "plan", say: "I've never written a business plan or set goals", words: "business plan goals targets okr plan objectives roadmap direction strategy write plan", stops: ["plan", "goals", "forecast", "milestones", "review"],
    first: "Write one page: who you serve, what you sell, how you earn, and three goals with dates.", done: "A short plan the team has read, with goals you can measure and review." },
  { id: "drift", say: "We're drifting and I'm not sure what our priorities are", words: "priorities strategy direction focus drifting stuck stagnant plateau unclear vision lost direction", stops: ["mission", "strategy", "review", "goals", "growopts", "board"],
    first: "Ask your team to write the top three priorities separately. Compare the lists.", done: "Everyone can name the same three priorities and what is not being done." },
  // ---- leaving
  { id: "exit", say: "I want to sell, hand over or close my business", words: "sell business exit retire close shut down hand over succession value valuation wind down", stops: ["exitopts", "value", "succession", "wind", "legalclose", "dissolve"],
    first: "Write why you want out and by when. The answer decides between selling, handing over and closing.", done: "You have chosen a route, know roughly what it is worth, and know your legal duties.", pro: "Use an accountant and a solicitor for valuation and the sale or closure." },
];

export const PROBLEM_BY_ID = new Map(BUSINESS_PROBLEMS.map((p) => [p.id, p]));

const STOP = new Set("i a an the and or to of in on for my me we our is are am it its this that with so but not do dont don't how what why can cant can't have has had be been about at as by from up out into than too very just really keep still open opening opened want".split(" "));
const stem = (w: string) => w.replace(/'s$/, "").replace(/(ing|ed|es|s)$/, (m, _x, i) => (i > 3 ? "" : m));
const tokens = (t: string) => t.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem);

const dfCache = new WeakMap<readonly ProblemDef[], Map<string, number>>();
/** How many problems mention each word, so a word found in most of them (such as "staff") counts for less than a rare one. */
function wordCounts(list: readonly ProblemDef[]): Map<string, number> {
  let df = dfCache.get(list);
  if (!df) {
    df = new Map();
    for (const p of list) for (const w of new Set([...tokens(p.say), ...tokens(p.words)])) df.set(w, (df.get(w) ?? 0) + 1);
    dfCache.set(list, df);
  }
  return df;
}

/** The problems that best fit what someone typed, best first. Matching is on words, so it works for a few clumsy words as well as a sentence. */
export function findProblems(query: string, list: readonly ProblemDef[] = BUSINESS_PROBLEMS, max = 5): ProblemDef[] {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const df = wordCounts(list), n = list.length;
  const weight = (w: string) => Math.log(1 + n / (df.get(w) ?? 1));
  const scored = list.map((p) => {
    const say = new Set(tokens(p.say)), words = new Set(tokens(p.words));
    let s = 0;
    for (const w of q) s += weight(w) * (say.has(w) ? 3 : words.has(w) ? 2 : [...words].some((x) => x.length > 4 && w.length > 4 && (x.startsWith(w) || w.startsWith(x))) ? 1 : 0);
    return { p, s };
  }).filter((x) => x.s >= 4);
  const top = Math.max(0, ...scored.map((x) => x.s)); // keep what fits about as well as the best match, so weak word overlaps do not trail it
  return scored.filter((x) => x.s >= top * 0.75).sort((a, b) => b.s - a.s).slice(0, max).map((x) => x.p);
}

/** A few plain questions that name the stage of a business for someone who cannot say which they are in. Answers are yes/no. */
export const STAGE_QUESTIONS: { id: string; ask: string }[] = [
  { id: "trading", ask: "Do you have paying customers today?" },
  { id: "steady", ask: "Do most weeks look about the same as the last?" },
  { id: "bigger", ask: "Are you trying to take on more, a bigger team or new markets?" },
  { id: "leaving", ask: "Are you thinking of selling, handing over or closing?" },
  { id: "open", ask: "Are you getting ready to open or take your first orders?" },
];
/** The stage that fits a set of yes/no answers (the business map's stage ids). */
export function suggestStage(a: Record<string, boolean | undefined>): string {
  if (a.leaving) return "close";
  if (a.trading && a.bigger) return "grow";
  if (a.trading && a.steady) return "steady";
  if (a.trading) return "launch";
  if (a.open) return "setup";
  return "idea";
}

/**
 * Several problems at once, as one: their stops joined (each stop once, in the order met), their first steps and their ways of knowing it worked.
 * An id of the form "a+b" names the problems a and b. Returns null when any of them is unknown, so a link can never break the page.
 */
export function combineProblems(ids: string | null | undefined, list: readonly ProblemDef[]): ProblemDef | null {
  if (!ids) return null;
  const parts = [...new Set(ids.split(/[+\s]+/).filter(Boolean))].slice(0, 4);
  const found = parts.map((id) => list.find((p) => p.id === id));
  if (!found.length || found.some((p) => !p)) return null;
  const ps = found as ProblemDef[];
  if (ps.length === 1) return ps[0];
  return {
    id: parts.join("+"),
    say: ps.map((p) => p.say.replace(/\.$/, "")).join("; and "),
    words: "",
    stops: [...new Set(ps.flatMap((p) => p.stops))],
    first: `Start with the first one: ${ps[0].first}`,
    done: ps.map((p) => p.done).join(" "),
    pro: ps.map((p) => p.pro).filter(Boolean).join(" ") || undefined,
  };
}

/** Stops whose name or what they produce matches what was typed, best first (so "payroll" or "tender" finds the stop itself). */
export function findStops(query: string, stops: readonly { id: string; name: string; outs: string[] }[], max = 3): { id: string; name: string }[] {
  const q = [...new Set(tokens(query))].filter((w) => w.length > 2);
  if (!q.length) return [];
  return stops.map((s) => {
    const name = new Set(tokens(s.name)), outs = new Set(s.outs.flatMap(tokens));
    let n = 0;
    for (const w of q) n += name.has(w) ? 3 : [...name].some((x) => x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x))) ? 2 : outs.has(w) ? 1 : 0;
    return { s, n };
  }).filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, max).map((x) => ({ id: x.s.id, name: x.s.name }));
}
