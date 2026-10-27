import type { Rank, Step } from "@/lib/build/types";

/**
 * Two ranks for the stops of the business map and the public-sector map that are not software work: running the organisation around the product.
 * Each step is a "pack": one real document in the repository with a short section for every topic it covers (the topics are the stops it answers,
 * see stops.ts). The check is a file of real size, which proves the document exists and was not left empty, not that it is right: where the
 * answer depends on law, tax or insurance, the prompts tell the learner to write down the question for a professional rather than guess.
 */
function pack(o: { key: string; title: string; why: string; file: string; topics: string[]; learn?: string; blurb?: string }): Step {
  return {
    key: o.key,
    title: o.title,
    why: o.why,
    doIt: [
      `Write one short, practical section for each of these, about {name} (a paragraph or a few bullets each is enough): ${o.topics.join("; ")}.`,
      "Where the answer depends on law, tax, insurance or employment rules, write down what you need to ask a qualified person and who you will ask, rather than guessing.",
      `Save it as ${o.file}.`,
    ],
    prompt: `Help me write ${o.file} for {name}. For each topic below, ask me what you need, then write a short, practical section for my situation. Flag anything I must check with a qualified professional, and never invent legal, tax or regulatory facts. Topics: ${o.topics.join("; ")}.`,
    learn: o.learn,
    check: { kind: "files", glob: o.file, minBytes: 120 * o.topics.length },
  };
}

export const BUSINESS_RANK: Rank = {
  key: "operator",
  title: "Operator",
  goal: "The business around your product is set up and run properly: legal, money, people, customers, operations and leadership are all written down.",
  stages: [
    {
      key: "set-up",
      title: "Set up the business",
      blurb: "The legal and safety foundations that are boring until they are missing.",
      steps: [
        pack({ key: "legal-setup", title: "Set up the business legally", file: "docs/25-legal-setup.md", why: "Your legal form, registrations, tax and protection decide who is liable, what you owe and what you own.", learn: "topic-legal",
          topics: ["The rules for your sector", "Legal structure", "Registering the business", "Tax registration", "Name and trademark", "Licences and permits", "Insurance needs", "Protecting the idea", "Protecting what you built (copyright, patents, code licence)"] }),
        pack({ key: "contracts-terms", title: "Write your terms and contracts", file: "docs/26-contracts-terms.md", why: "Clear terms stop most disputes before they start, and a contract you have not read is a risk you have not priced.", learn: "topic-legal",
          topics: ["Customer terms", "Contracts and terms you will sign", "How you review a contract before signing", "Privacy and data promises", "Ethics and conduct"] }),
        pack({ key: "quality-safety", title: "Set your quality, safety and service standards", file: "docs/27-quality-safety.md", why: "People forgive mistakes, not carelessness. Written standards make quality something you can check.", learn: "topic-services",
          topics: ["Service standards", "Quality standards", "Quality checks", "A practice run before launch", "Product safety and labels", "Health and safety", "Accessibility for customers", "A simple quality system"] }),
      ],
    },
    {
      key: "money",
      title: "Money",
      blurb: "Most businesses fail from cash, not from ideas.",
      steps: [
        pack({ key: "money-setup", title: "Set up how money moves", file: "docs/28-money-setup.md", why: "Getting paid, recording it and paying tax correctly are the basics that keep you open.", learn: "topic-finance",
          topics: ["Start-up costs", "Funding options", "Bank and payments", "Taking online payments", "Bookkeeping", "Invoicing and getting paid", "Ongoing tax and VAT", "Records and filings"] }),
        pack({ key: "cash-numbers", title: "Plan and watch your cash", file: "docs/29-cash-numbers.md", why: "A forecast tells you where you are going, and a weekly look at cash tells you before it is too late.", learn: "finance-for-leaders",
          topics: ["The financial forecast", "Cash flow plan", "Cash flow watch", "Monthly numbers", "Profit by product or service", "Ad spend and what it returns", "Growth budget", "Warning signs of trouble", "What the business is worth", "Investors and equity"] }),
      ],
    },
    {
      key: "people",
      title: "People",
      blurb: "Even a one-person business has people: yourself, helpers, suppliers and one day a team.",
      steps: [
        pack({ key: "team-plan", title: "Plan the team and hiring", file: "docs/30-team-plan.md", why: "Hiring is the most expensive decision most small businesses make. Plan it before the job is posted.", learn: "topic-hr",
          topics: ["Skills you need", "Roles and team plan", "Hiring plan", "Recruiting and selecting", "Pay and contracts", "Payroll and pensions", "Employment law basics", "Growing the team", "Managers and leaders"] }),
        pack({ key: "team-life", title: "Look after the team once they are in", file: "docs/31-team-life.md", why: "Good people leave bad management. These habits keep them.", learn: "people-operations",
          topics: ["Welcoming new staff", "Training the team", "Rotas and workload", "Feedback and performance", "Pay and progression", "Wellbeing and retention", "Culture and values", "Telling the team what is happening", "Delegating and one-to-ones", "Discipline and dismissal", "Stress and burnout"] }),
      ],
    },
    {
      key: "customers-ops",
      title: "Customers and operations",
      blurb: "Winning a customer is the start. Serving them well, every time, is the business.",
      steps: [
        pack({ key: "customer-care", title: "Look after your customers", file: "docs/32-customer-care.md", why: "Keeping a customer costs far less than finding one, and the way you handle a problem is what they remember.", learn: "topic-customers",
          topics: ["Support set-up", "Complaints and problems", "Keeping customers", "Referrals and repeat sales", "Key customers", "Customer research", "Service skills", "Telling customers about changes or closure", "Reviews and case studies"] }),
        pack({ key: "operations", title: "Run the day-to-day", file: "docs/33-operations.md", why: "Operations is where promises are kept or broken: the same thing done well, every day.", learn: "topic-project-management",
          topics: ["Premises and equipment", "Choosing and reviewing suppliers", "Stock and materials", "How work gets done", "Fulfilling the first orders", "Delivery and fulfilment", "Daily operations", "Stock control", "Capacity planning", "Scaling operations", "Project management", "Import and export"] }),
        pack({ key: "offer-range", title: "Shape and grow what you sell", file: "docs/34-offer-and-range.md", why: "What you sell, how you price it and where you sell it decide your growth more than any ad.", learn: "service-design-pricing",
          topics: ["What you offer", "A prototype or pilot", "The launch offer", "New products or services", "Reviewing the range", "Paid advertising", "Partners and resellers", "New markets", "Sales conversations and negotiation", "Tenders and bids", "Sales team and pay", "Franchising and licensing"] }),
      ],
    },
    {
      key: "lead",
      title: "Run and lead",
      blurb: "Rhythm beats heroics. A simple routine of review, decision and planning keeps everything else on track.",
      steps: [
        pack({ key: "leadership-rhythm", title: "Set your rhythm and your plan", file: "docs/35-leadership-rhythm.md", why: "A regular week, a clear plan and a few written rules keep a small business from running on adrenaline.", learn: "topic-business-plan",
          topics: ["Mission and vision", "The business model and plan", "Goals and targets", "Strategy tools such as SWOT", "Growth options and exit options", "Milestone plan", "Meeting rhythm and weekly review", "Time and priorities", "Clear communication", "Advisers and mentors", "Policies and procedures", "Annual plan and quarterly review", "Performance report", "Succession planning", "Co-founder and family agreements", "Trustees and board duties if you have them", "Better governance over time"] }),
      ],
    },
  ],
};

export const PUBLIC_RANK: Rank = {
  key: "public-service",
  title: "Public service",
  for: "public-service",
  goal: "Your service meets the standards a public body would expect: mandate, users, money, law, assurance and openness are all evidenced.",
  stages: [
    {
      key: "mandate-users",
      title: "Mandate and users",
      blurb: "A public service starts from a need and a legal basis, and from the people who must be able to use it.",
      steps: [
        pack({ key: "policy-case", title: "Set out the need, the powers and the outcomes", file: "docs/40-policy-mandate.md", why: "Public money and powers need a clear reason, a legal basis and a way to tell if it worked.", learn: "ps-business-cases",
          topics: ["The public need", "Evidence and data", "Mandate and powers", "Intended outcomes", "Options appraisal", "Objectives and scope", "Impact assessment", "A pilot or trial", "Monitoring outcomes", "Evaluation", "Change or continue", "Future options", "End of mandate"] }),
        pack({ key: "users-inclusion", title: "Design for everyone who must use it", file: "docs/41-users-inclusion.md", why: "A service that excludes people fails its purpose, however well it is built.", learn: "ps-service-standard",
          topics: ["Who uses it", "Inclusion and access needs", "Co-designing with users", "The service journey", "Helping people start", "Public support and contact", "Public feedback", "Complaints and redress", "Reaching excluded groups", "Outcomes for people", "Telling users and moving them on"] }),
      ],
    },
    {
      key: "deliver",
      title: "Deliver and buy",
      blurb: "Delivering a service, and buying what you need to deliver it, both follow rules.",
      steps: [
        pack({ key: "service-standard", title: "Deliver through discovery, alpha, beta and live", file: "docs/42-service-delivery.md", why: "Staged delivery lets you learn cheaply before you commit, and gives reviewers something to assess.", learn: "ps-service-standard",
          topics: ["The service owner", "Discovery", "Alpha", "Ways of working", "Service design", "Beta: build and test", "Operational readiness", "Go live", "Running the service", "Continuous improvement", "Change control", "Service performance", "Business continuity", "Post-implementation review", "Decommission or transfer", "Handover pack"] }),
        pack({ key: "commissioning", title: "Commission and buy what you need", file: "docs/43-commissioning.md", why: "Public buying has to be fair, open and good value, and a contract has to be managed after it is signed.", learn: "ps-procurement",
          topics: ["Commissioning needs", "Market engagement", "Procurement route", "Specification and outcomes", "Tender and evaluate", "Social value", "Award and standstill", "Contract and terms", "Mobilisation", "Supplier management", "Contract review", "Extend, re-tender or exit", "Contract exit"] }),
        pack({ key: "public-digital", title: "Handle digital, data and security", file: "docs/47-digital-data.md", why: "Public services hold sensitive data and must stay up, safe and open to inspection.", learn: "ps-information",
          topics: ["Data you hold", "Data sharing agreements", "Technology options", "Architecture and standards", "Security and accreditation", "Hosting and cloud", "Build and integrate", "Testing", "Accessibility testing", "Monitoring and incidents", "Patching and cyber resilience", "Data quality", "Open data and publishing", "Archive and delete data", "Switching off systems"] }),
      ],
    },
    {
      key: "money-people-law",
      title: "Money, people and law",
      blurb: "Public bodies answer for how they spend, who they employ and what the law requires.",
      steps: [
        pack({ key: "public-money", title: "Show the money and the value", file: "docs/44-public-money.md", why: "Public money must be justified up front and accounted for at the end.", learn: "ps-public-money",
          topics: ["Funding source", "Cost estimate", "Budget line", "Benefits and value for money", "Business case", "Affordability", "Spending controls", "Financial controls", "Forecast and cash", "Paying suppliers on time", "Monthly finance report", "Value for money check", "Benefits realisation", "Annual accounts", "Final accounts and assets"] }),
        pack({ key: "public-workforce", title: "Plan the workforce", file: "docs/45-workforce.md", why: "A service is only as good as the people running it, and staff must be consulted and supported through change.", learn: "people-operations",
          topics: ["Roles and capacity", "Skills needed", "Recruit or second", "Vetting and clearance", "Induction", "Train the team", "Consult staff and unions", "Cover and rotas", "Performance and support", "Wellbeing", "Succession and retention", "Redeploy and support staff"] }),
        pack({ key: "public-law", title: "Meet your legal duties", file: "docs/46-law-duties.md", why: "Public bodies have duties private ones do not: equality, human rights, openness and consultation.", learn: "ps-legal-duties",
          topics: ["Legal powers", "Equality duty", "Equality impact assessment", "Data protection impact assessment", "Subsidy control check", "Public consultation", "Human rights check", "Freedom of information readiness", "Accessibility law", "Privacy notice", "Complaints policy", "Information requests", "Legal change watch", "Records and retention", "Legal duties on closing"] }),
      ],
    },
    {
      key: "assure-lead",
      title: "Assure, lead and be open",
      blurb: "Independent challenge, clear decisions and honest publication are what make a public service trusted.",
      steps: [
        pack({ key: "assurance", title: "Plan assurance and scrutiny", file: "docs/48-assurance.md", why: "Independent review catches what the delivery team cannot see.", learn: "ps-assurance",
          topics: ["The risk register", "An early assurance review", "Assurance plan", "Internal audit plan", "Independent review", "Delivery assurance", "Readiness review", "Scrutiny and committees", "External audit and inspection", "Assurance of benefits", "Closure assurance"] }),
        pack({ key: "public-governance", title: "Set decision rights and governance", file: "docs/49-governance.md", why: "Everyone should know who decides, who is told and what gets escalated.", learn: "ps-governance",
          topics: ["Senior sponsor", "Programme board", "Decision rights and delegation", "Committee or cabinet approval", "Governance rhythm", "Risk appetite", "Escalation", "Performance reporting", "Briefing ministers or members", "Strategic review", "Closure report"] }),
        pack({ key: "transparency", title: "Engage and publish", file: "docs/50-transparency.md", why: "Trust comes from telling people what you are doing and how it is going, including when it is not going well.", learn: "ps-governance",
          topics: ["Stakeholder map", "Engagement plan", "Publishing plans and data", "Public communications", "Announcing the service", "Publishing performance", "Annual report", "Ongoing engagement", "Telling the public"] }),
      ],
    },
  ],
};
