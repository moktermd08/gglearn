import type { RawStation } from "./engine";
import type { ProblemDef } from "./problems";

/**
 * Stops added after the first draft of the business map, for problems real businesses have that the first stops did not name:
 * managing people, negotiation, tenders, investors, tax, quality systems, trade, ethics, AI, data and more.
 * Each is [id, x, name, size, ai, unused, owner, inputs, outputs] like the stops in business.ts. An input that repeats another
 * stop's name or output becomes a "builds on" link. Keep every x clear of the handoff gates on its line (npm run check:maps).
 */
const S = (id: string, x: number, name: string, size: RawStation[3], owner: string, ins: string, outs: string): RawStation => [id, x, name, size, 0, 0, owner, ins, outs];

/** Stops by line. */
export const MORE_STOPS: Record<string, RawStation[]> = {
  str: [
    S("swot", 22, "Strategy Tools", "S", "Owner", "Market Research|Competitor Check", "SWOT, PESTLE and five forces done with evidence|A few real options|Priorities for the next review"),
    S("franch", 30, "Franchising & Licensing", "L", "Owner", "Growth Options|Protect What You Built", "A system others can copy|Fees and legal agreements|Support for partners"),
  ],
  mkt: [
    S("sellskills", 19, "Sales Conversations", "S", "Seller", "Capture Enquiries|Ideal Customer", "Questions that find the real need|Objections answered|A clear next step or a close"),
    S("negotiate", 23, "Negotiation", "S", "Owner", "Sales Process|Pricing", "Terms you can live with|A walk-away point set beforehand|Agreements written down"),
    S("tender", 25, "Tenders & Bids", "S", "Owner", "Offer & Message|Pricing", "A decision to bid or not|A bid that answers every question|A price that wins and still pays"),
    S("adnum", 28, "Ad Numbers", "S", "Marketer", "Paid Advertising|Track the Numbers", "The cost of winning a customer|Ads that pay for themselves|Spend stopped where it does not"),
    S("salesteam", 30, "Sales Team & Pay", "M", "Owner", "Sales Process|Hiring Plan", "A team with clear targets|Pay that rewards the right things|Coaching for each person"),
  ],
  cus: [
    S("research", 6, "Customer Research", "S", "Founder", "Ideal Customer|Customer Conversations", "Interviews and surveys that give honest answers|Customer pictures based on real people|A score you can track"),
    S("servskill", 13, "Service Skills", "S", "Owner", "Service Standards|Support Set-up", "Staff who stay calm with upset customers|Replies that help|A rule for when to pass it up"),
    S("access", 24, "Accessibility for Customers", "S", "Owner", "Welcome & Onboarding|Website & Listings", "A place and website everyone can use|Adjustments you offer|Staff who know how to help"),
  ],
  pro: [
    S("pmodels", 10, "Pricing Models", "S", "Founder", "Pricing|Business Model", "A model that fits how customers buy|Tiers, subscriptions or one-off prices set|Price rises planned"),
    S("prodsafe", 14, "Product Safety & Labels", "S", "Owner", "Quality Standards|Rules for Your Sector", "Safety tests passed|The labels and marks required|A plan if something must be recalled"),
  ],
  ops: [
    S("projects", 16, "Project Management", "M", "Manager", "Milestone Plan|Roles & Team Plan", "A plan with scope, dates and owners|Risks and changes tracked|A review when it ends"),
    S("qms", 23, "Quality Systems", "M", "Owner", "Quality Checks|Policies & Procedures", "Written standards people follow|Audits and fixes|A route to a quality certificate"),
    S("trade", 30, "Import & Export", "M", "Owner", "Choose Suppliers|New Markets", "Duties, customs and shipping terms understood|Paperwork that is correct|Costs built into your price"),
  ],
  fin: [
    S("taxrun", 23, "Ongoing Tax & VAT", "S", "Owner", "Tax Registration|Bookkeeping", "Returns filed on time|Tax set aside every month|Allowable costs claimed"),
    S("insolv", 27, "Warning Signs of Trouble", "S", "Owner", "Cash Flow Watch|Monthly Numbers", "Early warnings spotted|A plan to act before cash runs out|Advice taken in time"),
    S("invest", 30, "Investors & Equity", "M", "Founder", "Funding Options|Business Plan", "A pitch and numbers an investor can check|Shares and terms understood|Agreements signed with advice"),
  ],
  peo: [
    S("payroll", 11, "Payroll & Pensions", "S", "Owner", "Pay & Contracts|Bookkeeping", "Staff paid correctly and on time|Tax and pension duties met|Payslips and records kept"),
    S("delegate", 22, "Delegating & One-to-ones", "S", "Manager", "Roles & Team Plan|Feedback & Performance", "Clear tasks with an owner and a date|A regular one-to-one with each person|Work that no longer depends on you"),
    S("hrproc", 24, "Discipline & Dismissal", "M", "Manager", "Feedback & Performance|Employment Law Basics", "A fair, written process|A record of each step|A decision you can defend"),
    S("stress", 27, "Stress & Burnout", "S", "Owner", "Wellbeing & Retention|Rotas & Workload", "Early signs spotted|Workload adjusted|Support people know they can ask for"),
  ],
  leg: [
    S("ipdeep", 18, "Patents & Copyright", "S", "Founder", "Protect the Idea|Name & Trademark", "What you own and what you only licence|Registrations where they are worth it|Agreements with makers and staff"),
    S("ethics", 24, "Ethics & Conduct", "S", "Owner", "Policies & Procedures|Culture & Values", "Clear rules on gifts, conflicts and honesty|A safe way to raise a concern|Leaders who follow the rules too"),
  ],
  tec: [
    S("aiwork", 17, "AI at Work", "S", "Owner", "Tools You Need|Data Protection Basics", "Where AI helps and where it must not be used|Rules on what staff may paste in|Checks on what it produces"),
    S("datask", 22, "Data Skills", "S", "Analyst", "Track the Numbers|Customer Data", "Clean data you can trust|Spreadsheet or query skills for your own questions|Charts that do not mislead"),
    S("upkeep", 27, "Systems Upkeep", "M", "Owner", "Choose Systems|Backups", "Software licences in order|Old systems replaced to a plan|Moves between systems done safely"),
  ],
  gov: [
    S("family", 17, "Co-founder & Family Agreements", "S", "Founder", "Legal Structure|Who Decides What", "Who owns what and who does what|What happens if someone leaves|A way to settle a dispute"),
    S("esg", 27, "Sustainability & Responsibility", "M", "Owner", "Culture & Values|Choose Suppliers", "A few honest goals on the environment and people|Claims you can back up|Customers and staff told the truth"),
  ],
};

/** Learning tracks that fit a new stop better than its line's default track: track slug to stop ids. */
export const MORE_TRACKS: Record<string, string[]> = {
  "gglink-sales-support": ["sellskills", "negotiate", "salesteam", "tender"],
  "facebook-marketing-titan": ["adnum"],
  "data-analytics": ["datask"],
  "ai-llm-practice": ["aiwork"],
  "product-management-core": ["research"],
  "governance-compliance": ["prodsafe"],
};

/** Where a stop usually breaks, in its own words. */
export const MORE_BREAKS: Record<string, string> = {
  swot: "The lists are written once, are full of opinions, and lead to no decision.",
  franch: "The business is copied before it is written down, so partners repeat its mistakes and the brand suffers.",
  sellskills: "The seller talks about the product, never finds out what the buyer needs, and hears \"let me think about it\".",
  negotiate: "Someone goes in without a walk-away point, gives ground early and finds out later what it cost.",
  tender: "The bid is written to the buyer's checklist too late, priced too low to profit, and sent without a go or no-go.",
  adnum: "Money keeps going into ads because clicks look good, while the cost of each real customer is never worked out.",
  salesteam: "Pay rewards the wrong thing, so people chase easy deals and nobody is coached on the hard ones.",
  research: "Friends and family say what you want to hear, and the questions asked lead to the answer you hoped for.",
  servskill: "Staff follow a script that does not help, or give in to avoid conflict, and the customer leaves unhappier.",
  access: "Accessibility is an afterthought, so some customers cannot use the site or the premises and never say why.",
  pmodels: "A price model is copied from a rival and does not match how your customers actually want to buy.",
  prodsafe: "Safety, labelling and marks are checked after production, when a fault costs a recall.",
  projects: "Scope grows quietly, dates slip, and nobody says so until the deadline has gone.",
  qms: "Standards are written for the auditor, not for the people doing the work, so they are ignored between audits.",
  trade: "Duties, shipping terms and paperwork are discovered at the border, and the price no longer pays.",
  taxrun: "Tax is paid from whatever is in the bank, and the bill arrives when the money has been spent.",
  insolv: "Warning signs are seen for months and ignored, so advice is sought when little can be done.",
  invest: "Terms are agreed in a rush, and the founder finds out what was given away only when the next round comes.",
  payroll: "Pay and tax are set up by guesswork, and errors are found by an employee or the tax office.",
  delegate: "Tasks are handed over with no clear end or checkpoint, so they come back late or get taken back.",
  hrproc: "A manager acts in anger or skips steps, and a fair dismissal turns into an unfair one.",
  stress: "Overwork is treated as commitment until someone is ill, and then the whole team is short.",
  ipdeep: "Something valuable is made by a contractor or published before anyone checks who owns it.",
  ethics: "Rules are written but not followed by leaders, so staff learn that they do not apply.",
  aiwork: "Staff paste customer or company data into AI tools and trust what comes back without checking it.",
  datask: "Numbers come from several places that disagree, and a chart is trusted because it looks professional.",
  upkeep: "Licences lapse and old systems run until they fail, and the move happens in a crisis.",
  family: "Everyone assumes they agree on who owns what, and the disagreement shows up when there is money or a falling out.",
  esg: "Claims are made in marketing before the practice exists, and customers or staff notice.",
};

/** What is true when the stop has done its job: how someone knows it worked. */
export const MORE_OUTCOMES: Record<string, string> = {
  swot: "You can name two real options, with evidence for and against each, and pick one.",
  franch: "Someone could run your business from a manual and a short training, and still meet your standard.",
  sellskills: "You can run a conversation that finds the real need, answers the main objections and ends with a next step.",
  negotiate: "You go into talks knowing what you want, what you will give and where you walk away.",
  tender: "You can decide in an hour whether to bid, and when you do the bid is complete, priced to profit and on time.",
  adnum: "You know the most you can pay to win a customer, and every ad channel is judged against it.",
  salesteam: "Each person knows their target, how they are paid, and gets regular coaching.",
  research: "You have heard from at least ten real customers, and know what they do, not just what they say.",
  servskill: "Staff can calm an upset customer, solve most problems themselves and know when to pass one up.",
  access: "Someone with a disability can use your premises or site, and you know what to adjust when asked.",
  pmodels: "Your prices and plans match how your customers prefer to buy, and you know when and how to raise them.",
  prodsafe: "Before anything ships, the safety checks, marks and labels are done, and you have a recall plan.",
  projects: "Each project has a scope, dates and an owner, changes are agreed, and every project ends with a review.",
  qms: "Written standards are followed, problems are fixed at the cause, and you could pass an audit.",
  trade: "You know what each shipment costs after duties and fees, and the paperwork is right first time.",
  taxrun: "Tax is set aside every month, returns go in before the deadline, and nothing about tax is a surprise.",
  insolv: "You watch a short list of warning signs, and you know what to do and who to call before cash runs out.",
  invest: "You can explain what you are giving for what you get, and nothing is signed that you do not understand.",
  payroll: "Everyone is paid correctly and on time, and tax and pension duties are filed without a scramble.",
  delegate: "Tasks go out with a clear end, you meet each person regularly, and the work no longer waits for you.",
  hrproc: "Problems with a person are dealt with early, fairly and in writing, and you can defend what you did.",
  stress: "You notice strain early, adjust the work, and people know they can say so without penalty.",
  ipdeep: "You know what you own, what you only licence, and who must sign what before work starts.",
  ethics: "People know the rules on gifts, conflicts and honesty, and can raise a concern safely.",
  aiwork: "Your team uses AI where it helps, never with data it must not see, and checks what comes out.",
  datask: "You can answer your own questions with data you trust, and your charts tell the truth.",
  upkeep: "Licences are tracked, old systems have a replacement date, and moves are planned not forced.",
  family: "Who owns what, who does what and what happens if someone leaves is written down and signed.",
  esg: "You make a few real commitments on environment and people, and can show evidence for every claim.",
  // existing stops that most need a plain statement of success
  pricing: "You can say why a price is what it is, and what each sale earns after costs.",
  cashplan: "You can see, weeks ahead, the lowest point your cash will reach and what you will do about it.",
  invoice: "Invoices go out on the day, with terms, and most are paid on time.",
  books: "Every month you can read your income, costs and profit on one page.",
  hire: "You know the role, pay range and legal basics before you advertise.",
  recruit: "You choose people with a structured process, not a gut feel from one conversation.",
  leaders: "New managers know what is expected of them and have the skills to do it.",
  complaints: "Complaints are logged, answered quickly and used to fix the cause.",
  keep: "You know why customers stay or leave, and act on it.",
  numbers: "You look at the same few numbers every month and act on them.",
  structure: "You know which legal structure you chose and what it means for liability and tax.",
  dataprot: "You know what personal data you hold, why, and what to do if it is lost.",
  insure: "You know what you are covered for, what you are not, and why.",
  cyber: "Strong sign-in, tested backups and a plan if something goes wrong.",
  exitopts: "You have chosen sell, hand over or close, and know what each needs.",
  plan: "A short written plan the team has read, with goals you can measure.",
};

/** Where learning ends and a professional begins. */
export const MORE_PROS: Record<string, string> = {
  payroll: "A payroll provider or an accountant should run payroll and confirm your duties.",
  hrproc: "Take employment advice before any formal warning or dismissal.",
  stress: "For an individual who is unwell, point them to occupational health or their doctor; do not manage it alone.",
  invest: "A solicitor must draft and check share and investment agreements.",
  insolv: "A licensed insolvency practitioner or accountant should advise before you decide anything.",
  taxrun: "An accountant should confirm what applies to you and file your returns.",
  prodsafe: "A testing body or product safety adviser confirms what you must meet.",
  ipdeep: "A patent or trademark attorney should file and advise on registrations.",
  trade: "A freight forwarder or customs broker usually handles filings.",
  family: "A solicitor should draft the agreement; do not rely on a template.",
  franch: "A franchise solicitor must draft the agreements and check the rules in each country.",
  qms: "An accredited body audits and certifies standards such as ISO 9001.",
  access: "An accessibility audit by a specialist shows what to fix on a website or premises.",
  structure: "An accountant or solicitor should confirm which structure fits you.",
  tax: "An accountant should register you correctly and confirm which taxes apply.",
  contracts: "A solicitor should review anything large or unusual.",
  contractrev: "A solicitor should review anything large or unusual.",
  employlaw: "An employment adviser should check contracts and any formal step.",
  dataprot: "Ask a data protection adviser if you hold sensitive or large amounts of data.",
  insure: "An insurance broker should place and explain your cover.",
  licence: "The licensing body, or an adviser, confirms what you need.",
  safety: "A qualified health and safety adviser should complete risk assessments for higher-risk work.",
  funding: "An accountant or adviser should check any loan or investment terms.",
  value: "A valuer or accountant should value a business before a sale.",
  legalclose: "A solicitor and an accountant should guide a sale, handover or closure.",
  dissolve: "A solicitor and an accountant should guide a sale, handover or closure.",
  register: "An accountant or formation agent can register the business correctly.",
  protect: "A solicitor or attorney should advise on protecting what you own.",
  trademark: "A trademark attorney can search and register a mark.",
  ip: "A solicitor or attorney should advise before you rely on any protection.",
  cyber: "A security specialist should test anything holding sensitive data.",
  rules: "Your sector regulator or trade body sets the real rules (for example food standards, financial, health and care, construction or charity regulators).",
  finalacc: "An accountant should prepare final accounts and filings.",
};

/** How much a size changes: the first size at which these stops matter (stops in no list matter from a startup). */
export const MORE_FROM: Record<string, string[]> = {
  small: ["delegate", "hrproc", "ethics", "stress", "datask", "swot", "tender", "trade"],
  medium: ["qms", "salesteam", "franch", "upkeep", "esg"],
};

/** Company stages these stops belong to (the stage's own list is extended). */
export const MORE_STAGE: Record<string, string[]> = {
  idea: ["research"],
  setup: ["research", "pmodels", "prodsafe", "payroll", "servskill", "family", "aiwork"],
  launch: ["projects", "sellskills", "ipdeep", "servskill", "payroll", "negotiate"],
  steady: ["delegate", "hrproc", "stress", "taxrun", "qms", "negotiate", "access", "ethics", "datask", "swot", "insolv", "upkeep"],
  grow: ["tender", "salesteam", "adnum", "trade", "invest", "franch", "esg", "swot", "projects"],
};

/** Things people say, and the stops that help. */
export const MORE_PROBLEMS: ProblemDef[] = [
  { id: "newmanager2", say: "I need to delegate and run one-to-ones but don't know how", words: "delegate delegation one to one 1 1 meeting manage people give tasks check progress micromanage trust handover coaching direct reports", stops: ["delegate", "leaders", "perf", "rhythm"],
    first: "Pick one task you could hand over. Write the result you want, the deadline and when you will check in. Then give it to someone.", done: "Tasks leave your desk with a clear end, and each person has a regular one-to-one with you." },
  { id: "dismiss", say: "I have to discipline or dismiss someone and I'm afraid of getting it wrong", words: "discipline disciplinary dismiss dismissal sack fire redundancy grievance warning tribunal unfair misconduct performance absence", stops: ["hrproc", "perf", "employlaw", "records"],
    first: "Write down the facts: what happened, when, what was said before, and the standard expected. Do not act until you have asked for advice.", done: "You follow a fair written process and can defend every step.", pro: "Take employment advice before any formal step." },
  { id: "payroll", say: "I don't know how to run payroll, tax and pensions for staff", words: "payroll pay staff wages salary paye pension auto enrolment payslip national insurance holiday pay overtime", stops: ["payroll", "paysetup", "books", "employlaw"],
    first: "List each person, how they are paid, and which tax and pension rules apply. Ask a payroll provider for a quote.", done: "Everyone is paid correctly and on time, and the tax and pension duties are filed.", pro: "A payroll provider or accountant should run payroll." },
  { id: "burnout", say: "I'm exhausted, or my team is burning out", words: "burnout burning burn out burned stress exhausted tired overwork overworked sick mental health wellbeing anxiety long hours pressure unwell", stops: ["stress", "wellbeing", "rota", "delegate"],
    first: "Ask each person, including yourself, which one thing would take the most pressure off this month. Do one of them.", done: "Strain is spotted early, work is adjusted, and people can say so without penalty.", pro: "For someone who is unwell, point them to occupational health or their doctor." },
  { id: "negotiate", say: "I don't know how to negotiate with customers, suppliers or staff", words: "negotiate negotiation haggle bargain deal terms discount supplier salary raise pushback leverage concession walk away", stops: ["negotiate", "sellskills", "pricing", "suppliers"],
    first: "Before your next negotiation write: what I want, what I will give, and where I walk away. Say the walk-away only to yourself.", done: "You go into talks prepared and come out with terms written down." },
  { id: "tender2", say: "I want to win tenders or bids but don't know how", words: "tender bid bids rfp rfq proposal procurement public sector framework contract win answer questionnaire", stops: ["tender", "offer", "pricing", "contracts"],
    first: "Find one tender you could realistically win. Score it: do you meet every must-have, can you profit at the likely price, and can you deliver on time?", done: "You decide in an hour whether to bid, and when you do the bid is complete and priced to profit." },
  { id: "investor", say: "I want to raise money from investors and don't understand equity", words: "investor investors equity shares dilution pitch deck raise funding seed angel venture cap table valuation convertible founders stake", stops: ["invest", "funding", "plan", "forecast", "family"],
    first: "Write what you would do with the money, what you would give for it (a percentage), and the numbers that justify it.", done: "You can explain what you are giving for what you get, and sign nothing you do not understand.", pro: "A solicitor must draft and check share and investment agreements." },
  { id: "trouble", say: "I think the business might be in trouble and I don't know what to do", words: "insolvency insolvent trouble failing going under debt creditors cant pay liquidation administration bankruptcy closing down crisis cash running out", stops: ["insolv", "cashwatch", "creditors", "advisers"],
    first: "List what you owe, who is owed it and when it is due, and what money is coming in. Then ask for advice this week, not next month.", done: "You have seen the position clearly and taken advice early.", pro: "A licensed insolvency practitioner or accountant should advise before you decide anything." },
  { id: "taxrun", say: "I don't know which taxes I must pay each month or year", words: "tax vat returns deadlines filing quarterly allowable expenses set aside corporation tax income tax sales tax payroll tax hmrc irs", stops: ["taxrun", "tax", "books", "records"],
    first: "Set up a separate account and move a fixed share of every payment into it for tax.", done: "Tax is set aside monthly and filed on time.", pro: "An accountant should confirm what applies to you." },
  { id: "quality2", say: "I want recognised quality standards, like ISO, to win bigger customers", words: "iso 9001 quality management certification audit standards accreditation certificate system procedures", stops: ["qms", "qcheck", "policies", "improve"],
    first: "Write down the five steps in your most important process, who does each, and how you check it was done right.", done: "Written standards are followed and you could pass an audit.", pro: "An accredited body audits and certifies." },
  { id: "export", say: "I want to sell or buy from abroad and don't know the rules", words: "export import customs duty tariff shipping international overseas incoterms freight forwarder border vat abroad", stops: ["trade", "newmkts", "suppliers", "tax"],
    first: "Pick one country and one product. Find the duty, the rules and the shipping cost, and add them to your price.", done: "You know what each shipment costs after duties and fees, and the paperwork is right first time.", pro: "A freight forwarder or customs broker handles filings." },
  { id: "franchise", say: "I want to franchise or license what I've built", words: "franchise franchising licence license replicate copy brand manual expand partners royalty territory", stops: ["franch", "growopts", "ipdeep", "ip", "contracts"],
    first: "Write down how a new person would run one site from scratch. If you cannot, it is not ready to copy.", done: "Someone could run your business from a manual and short training and still meet your standard.", pro: "A franchise solicitor must draft the agreements." },
  { id: "ip", say: "I'm worried someone could copy what I've made, or that I'm copying someone", words: "patent copyright trademark intellectual property ip copy stolen infringement design owns ownership licence contractor made", stops: ["ipdeep", "protect", "trademark", "ip"],
    first: "List what you have created and who made it. For each, check you or the business owns it in writing.", done: "You know what you own and what you only licence, and who must sign before work starts.", pro: "A patent or trademark attorney should file and advise." },
  { id: "ethics", say: "I'm not sure about the rules on gifts, honesty and conflicts of interest", words: "ethics ethical bribery gifts conflict of interest whistleblowing integrity honesty conduct code corruption raise concern", stops: ["ethics", "policies", "culture", "records"],
    first: "Write a one-page rule on gifts, conflicts and raising concerns, and read it out at your next team meeting.", done: "People know the rules and can raise a concern safely." },
  { id: "ai", common: true, say: "I don't know how to use AI at work safely", words: "ai artificial intelligence chatgpt claude copilot llm prompt automate generative policy staff paste confidential data hallucination", stops: ["aiwork", "dataprot", "automate", "secbasics"],
    first: "Write three rules: what staff may use AI for, what they must never paste in, and who checks the output.", done: "Your team uses AI where it helps, never with data it must not see, and checks what comes out." },
  { id: "data2", say: "My data is a mess and I don't know how to use it", words: "data spreadsheet excel sql pivot clean messy chart dashboard statistics analyse analyze reports numbers disagree source of truth", stops: ["datask", "tracking", "dash", "custdata"],
    first: "Pick one question you want answered. Find where the data lives, and whether two sources give the same answer.", done: "You can answer your own questions with data you trust." },
  { id: "upkeep", say: "Our software and systems are old, messy or out of licence", words: "software licences licenses legacy old system migration upgrade technical debt it support renew subscription replace outdated", stops: ["upkeep", "systems", "backups", "secbasics"],
    first: "List every system and licence, who owns it and when it is due to renew or end.", done: "Licences are tracked, old systems have a replacement date, and moves are planned." },
  { id: "cofounder", say: "I'm starting with a partner or family and worry about disagreements", words: "co founder cofounder partner partnership family business disagreement dispute split equity ownership leave exit agreement shareholders", stops: ["family", "structure", "decide", "exitopts"],
    first: "Each of you writes separately: who owns what, who does what, and what happens if one of you leaves. Compare the answers.", done: "Who owns what, who does what and what happens if someone leaves is written down and signed.", pro: "A solicitor should draft the agreement." },
  { id: "green", say: "Customers ask about our environmental and social impact and I don't know what to say", words: "sustainability esg environment carbon green social responsibility greenwashing net zero impact ethical sourcing csr claims", stops: ["esg", "suppliers", "culture", "ethics"],
    first: "List three honest things you already do and three you could do this year. Only claim what you can prove.", done: "You make a few real commitments and can show evidence for every claim." },
  { id: "research2", say: "I don't know how to find out what customers really think", words: "customer research survey interview feedback focus group questions persona nps satisfaction understand customers listen", stops: ["research", "talk", "feedback", "cfeed"],
    first: "Ask five customers: what were you doing before you found us, and what almost stopped you buying? Do not defend. Write what they say.", done: "You have heard from at least ten real customers and know what they do, not just what they say." },
  { id: "access", say: "I want my premises, website or service to work for disabled customers", words: "accessibility accessible disabled disability wheelchair screen reader inclusive wcag adjustments reasonable equality", stops: ["access", "site", "std", "servskill"],
    first: "Try your website with the keyboard only and your premises with a wheelchair user's eyes. Write what you could not do.", done: "Someone with a disability can use your premises or site, and you know what to adjust.", pro: "An accessibility audit by a specialist shows what to fix." },
  { id: "safetyprod", say: "I make or sell a product and I'm not sure about safety rules and labels", words: "product safety labelling labels ce ukca recall testing standards allergen packaging marks regulation warnings food cosmetic toy electrical", stops: ["prodsafe", "quality", "rules", "licence"],
    first: "Find the product safety rules for your product type, and list what must be tested, marked and printed on it.", done: "Before anything ships, the safety checks, marks and labels are done, and you have a recall plan.", pro: "A testing body or product safety adviser confirms what you must meet." },
  { id: "projectsw", say: "My projects run late, over budget or keep growing", words: "project management late over budget scope creep deadline gantt delivery plan overrun change requests slipping milestones", stops: ["projects", "milestones", "weekly", "decisions"],
    first: "For your current project write what is in scope, what is out, and the date and owner of each piece. Share it and ask for corrections.", done: "Each project has a scope, dates and an owner, changes are agreed, and every project ends with a review." },
  { id: "pricemodel", say: "Should I charge a subscription, a fee, or per job?", words: "subscription pricing model tiers freemium retainer per hour fixed price recurring revenue one off package bundle charge", stops: ["pmodels", "pricing", "profit", "offer"],
    first: "Ask five customers how they would prefer to pay: once, monthly, or per use. Compare with what you earn most from.", done: "Your prices and plans match how customers prefer to buy." },
  { id: "salesboost", say: "I need a sales team, or want my salespeople to perform", words: "sales team commission targets hire salespeople coach quota incentive pipeline manage sales performance bonus", stops: ["salesteam", "sellskills", "sales", "hire"],
    first: "Write what you want one salesperson to do each week, how many, and how you will pay for the right result.", done: "Each person knows their target and how they are paid, and gets regular coaching." },
  { id: "adspend", say: "I don't know which ads or channels actually pay for themselves", words: "ad spend roas cpc cpa cost per acquisition cost per lead tracking attribution return on ad spend paid channels budget analytics conversions", stops: ["adnum", "ads", "tracking", "profit"],
    first: "Work out the most you can pay to win one customer. Then check each channel's real cost per customer against it.", done: "Every channel is judged against what a customer is worth." },
  { id: "serviceskill", say: "My staff don't handle customers well", words: "customer service staff training rude angry calm scripts call handling complaints skills empathy phone chat escalate de escalation", stops: ["servskill", "std", "complaints", "train"],
    first: "Listen to three recent customer calls or read three chats. Mark one thing each person did well and one thing to change.", done: "Staff can calm an upset customer, solve most problems themselves and know when to pass one up." },
  { id: "careerchange", say: "I want to change career or get promoted and don't know what to learn", words: "career change promotion promoted next role skills what to learn qualification certificate interview prepare switch job ladder growth", stops: ["skills", "leaders", "train", "perf"],
    first: "Find three job ads for the role you want. List the skills they ask for that you lack, and pick the one that appears most.", done: "You know which skills your next role needs and have picked the first to learn." },
  { id: "sidebiz", say: "I want to start a business while keeping my job", words: "side business side hustle part time employed keep job weekend start small test moonlighting contract employer conflict", stops: ["idea", "test", "startcost", "structure", "tax"],
    first: "Read your employment contract for rules on outside work. Then test the idea with five paying customers before you spend anything.", done: "You have proof people will pay, and you are sure you are allowed to do it.", pro: "Check your contract or ask an adviser if you are unsure." },
  { id: "mysize", say: "I don't know what changes when a business grows from 5 to 50 to 500 people", words: "growing size headcount scale hire more people bigger organisation startup small medium large enterprise change structure departments formal", stops: ["roles", "decisions", "policies", "delegate", "leaders"],
    first: "Choose the size that matches you in the size picker. The map will show what matters at that size and what can wait.", done: "You know which stops matter at your size and which can wait." },
  { id: "symptom", say: "Something is wrong but I can't say what", words: "something wrong not sure unsure feels off vague problem stuck going nowhere not working struggling lost cant tell what", stops: ["numbers", "feedback", "weekly", "advisers"],
    first: "Look at three things this week: money in the bank, enquiries received, and how many customers came back. Write what each says.", done: "You have a clear view of the money, the demand and the customers, and know which to fix first." },
];

/** Stops where local rules matter: the map's examples are drawn from the UK. */
export const MORE_LOCAL_NOTE = "Rules on tax, employment, data, licences and company law differ by country. The examples here follow UK practice, so check what applies where you trade.";
