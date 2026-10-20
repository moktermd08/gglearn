import type { SizesDef } from "./engine";

/**
 * Size lens for the business map. A stop in no list matters from a startup. The headcount bands follow the usual UK small-business ones;
 * a business that is regulated, listed or in several countries often behaves like the next size up.
 */
export const BUSINESS_SIZES: SizesDef = {
  list: [
    { id: "startup", label: "Startup", people: "Under 10 people", blurb: "A new business. The founders do everything and money decides the pace.",
      changes: ["One person covers several lanes, so each stop is a light, quick version.", "Only what you need to open, get paid and stay legal is lit; the rest can wait.", "A handoff is a short check between the founders."],
      challenges: ["Doing everything yourself and nothing well", "Cash running out before customers pay", "No time to write anything down"],
      owner: "Usually the founders, one or two people.", formal: "A short check between the founders, written down." },
    { id: "small", label: "Small", people: "10 to 49 people", blurb: "A small business. Roles are separate, but most people still wear several hats.",
      changes: ["People and money routines appear: hiring, pay, regular reviews.", "Basic policies and records are written down.", "A named person checks each handoff."],
      challenges: ["Everything depends on a few people", "Informal habits that stop working as the team grows", "Hiring quickly without a plan"],
      owner: "A named person per lane, often one person for two lanes.", formal: "A written checklist and one person who signs it off." },
    { id: "medium", label: "Medium", people: "50 to 249 people", blurb: "A medium business. Managers manage managers, and departments appear.",
      changes: ["Departments own lanes, so handoffs between teams matter most.", "A board or leadership group sets targets and checks them.", "Reporting, policies and controls become routine."],
      challenges: ["Departments protecting their own patch", "Decisions slowing as more people are involved", "Culture drifting as new people join"],
      owner: "A department head per lane, with a leadership team over them.", formal: "A named owner per gate and a recorded decision." },
    { id: "large", label: "Large", people: "250 to 999 people", blurb: "A large business with several functions, layers of management and a head office.",
      changes: ["Specialist teams run finance, people, legal and technology.", "Shared systems, standards and approval routes replace local habits.", "Planning and budgeting follow an annual cycle."],
      challenges: ["Silos between functions", "Change that takes too long to agree", "Local teams working around central rules"],
      owner: "A functional head per lane, supported by central specialist teams.", formal: "A formal review with papers, an agenda and minutes." },
    { id: "enterprise", label: "Enterprise", people: "1,000 or more people, or several sites or countries", blurb: "A very large, multi-site, regulated or listed business with a board, committees and heavy outside scrutiny.",
      changes: ["Board committees, internal audit and regulators are part of normal work.", "Policies, risk and compliance are managed as functions in their own right.", "Every significant decision leaves an audit trail."],
      challenges: ["Complexity hiding weak delivery", "Approval chains longer than the work itself", "Legacy systems and contracts constraining every choice"],
      owner: "Dedicated teams and senior executives, accountable to a board.", formal: "A formal gate with independent assurance, a recorded approval and an audit trail." },
  ],
  from: {
    small: ["rhythm", "policies", "approvals", "hire", "recruit", "paysetup", "induct", "rota", "perf", "complaints", "records", "compliance", "dataprot", "safety", "employlaw", "keep", "reviews", "cashwatch", "profit", "review", "support", "terms", "supreview", "qcheck", "stockctl", "crm", "automate", "weekly", "strategy", "partners", "growteam", "ads", "range", "std", "stock", "custdata", "content", "social"],
    medium: ["board", "annual", "perfrep", "payreview", "wellbeing", "leaders", "keyacc", "contractrev", "cyber", "dash", "improve", "referrals", "succession"],
    large: ["scaleops", "growsys", "newoffers"],
    enterprise: ["govup", "value", "newmkts", "ip"],
  },
  notes: {
    plan: {
      startup: "One or two pages is enough. Look at it again every quarter.",
      small: "A short written plan the whole team has read.",
      medium: "A plan owned by the leadership team, with targets for each department.",
      large: "A plan that feeds department plans and budgets.",
      enterprise: "A plan approved by the board, tied to strategy and reported against.",
    },
    structure: {
      startup: "A sole trader or a simple company. Get advice once, before you start.",
      large: "Often a group of companies, with advisers on structure and tax.",
      enterprise: "A group structure, reviewed with advisers whenever you enter a new country or business.",
    },
    hire: {
      startup: "Often a first hire, a freelancer or a friend. Keep contracts simple but legal.",
      small: "A short hiring plan for the next year, agreed with whoever holds the budget.",
      medium: "A hiring plan per department, run with an HR specialist.",
      enterprise: "A workforce plan set centrally, with recruitment run by a dedicated team.",
    },
    policies: {
      small: "A few short written rules: data, expenses, conduct and complaints.",
      medium: "A policy set with a named owner for each policy.",
      enterprise: "Policies approved by the board and tested by internal audit.",
    },
    books: {
      startup: "Bookkeeping software and an accountant once a quarter.",
      medium: "A finance team with monthly management accounts.",
      enterprise: "A finance function with audited accounts and a finance director on the board.",
    },
    board: {
      medium: "A board or advisory group with a real agenda and minutes.",
      enterprise: "A formal board with committees (audit, remuneration, risk).",
    },
    cyber: {
      medium: "A regular security review and an owner for it.",
      large: "A security team, testing and an incident plan.",
      enterprise: "A security function reporting to the board, with independent testing.",
    },
    compliance: {
      small: "A yearly checklist against the rules that apply to you.",
      medium: "A named compliance owner and a calendar of checks.",
      enterprise: "A compliance function with internal audit and regulator reporting.",
    },
    risks: {
      startup: "A short list kept by the founders and looked at monthly.",
      medium: "A shared register with owners, scores and actions.",
      enterprise: "A register linked to the board's risk framework.",
    },
  },
};
