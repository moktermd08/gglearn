import type { Template } from "@/lib/build/types";

/** The projects a person can start in Build & launch. Each one is small enough to reach a public launch, and real enough to put in a portfolio. */
export const TEMPLATES: Template[] = [
  {
    slug: "waitlist-site",
    title: "A product site with a waitlist",
    pitch: "A one-page site that explains an idea clearly and collects emails from people who want it.",
    customer: "people with the problem your idea solves",
    mvp: ["a page with a headline, three benefits and a screenshot or sketch", "an email sign-up that stores addresses somewhere you can read them", "a thank-you message and a privacy note", "a page that works on a phone"],
    stack: "plain HTML, CSS and a little JavaScript, hosted free on GitHub Pages, with a form service for the sign-ups",
    agent: "a short assistant on the page that answers questions about the product from your own written answers, and says so when it does not know",
    launch: "GitHub Pages, on a github.io address or your own domain",
  },
  {
    slug: "support-agent",
    title: "An AI support agent for a small business",
    pitch: "An assistant that answers a small business's customer questions from its own facts and hands over to a person when it should.",
    customer: "a small business owner who answers the same questions every day",
    mvp: ["a written knowledge base of the business's real answers", "a chat page that answers only from that knowledge", "a clear hand-over to a person when it is unsure or the customer is upset", "a test set of at least 20 real questions with the answers you expect"],
    stack: "a small web app with one page and one server route that calls an AI model, with the knowledge kept as files in the repository",
    agent: "the support agent itself: its instructions, its knowledge, the tools it may use and the moments it must hand over",
    launch: "a free hosting service such as Vercel, Netlify or Cloudflare Pages, with the code on GitHub",
  },
  {
    slug: "booking-app",
    title: "A booking page for a local business",
    pitch: "A simple page where customers of a local business pick a time and the owner sees the bookings.",
    customer: "a local service business such as a barber, tutor, cleaner or trainer",
    mvp: ["a page showing the services and free times", "a form to book a time that confirms on screen", "an owner view that lists upcoming bookings", "no double-booking of the same time"],
    stack: "a small web app with a free database (SQLite, or a free hosted Postgres), built with whichever framework your AI tool knows best",
    agent: "an assistant that turns a customer's message such as \"Thursday after work for a haircut\" into a booking request the owner can confirm",
    launch: "a free hosting service such as Vercel, Netlify, Render or Fly.io, with the code on GitHub",
  },
  {
    slug: "dev-tool",
    title: "A small tool other people can install",
    pitch: "A command-line tool or small library that does one useful job and is published with a version number.",
    customer: "developers or office workers who repeat one boring task by hand",
    mvp: ["one command that does the job end to end", "a --help message and clear error messages", "tests that prove it works on normal and odd input", "install instructions that work on a clean machine"],
    stack: "a single-language project (Python or JavaScript are the easiest to publish), with tests and a package published to PyPI or npm",
    agent: "a mode that uses an AI model to do the part that is hard to write as rules, with a switch to turn it off and a test that runs without it",
    launch: "a GitHub release, plus the package registry (PyPI or npm)",
  },
  {
    slug: "public-service",
    title: "A digital public service",
    pitch: "An online service that helps people get something done with a public body, such as applying, reporting a problem or booking.",
    customer: "people who use a council, agency or charity service",
    mvp: ["one clear journey from start to done, in plain words", "it works for people using a phone, a screen reader or the keyboard only", "a way to get help from a person", "a published page saying how the service is performing"],
    stack: "a small, accessible web app with plain HTML forms first, hosted somewhere you can show to reviewers, with the code in the open",
    agent: "an assistant that explains the service and helps someone fill in a form, never decides an outcome, and hands over to a person",
    launch: "a public address anyone can open, ideally on a domain you control, with the code on GitHub",
  },
  {
    slug: "custom",
    title: "My own idea, or a customer's project",
    pitch: "Your own idea, or a real project for a real customer, taken through the same journey.",
    customer: "the person or business you are building it for",
    mvp: ["the smallest version that solves one real problem for one real person", "everything beyond that is on a written \"not now\" list"],
    stack: "whatever fits the idea; ask your AI tool to propose two options and explain the trade-offs before you choose",
    agent: "one place where an AI model does real work for the user, with limits you wrote down",
    launch: "somewhere public that anyone can open, with the code on GitHub",
  },
];

export const templateBySlug = (slug: string) => TEMPLATES.find((t) => t.slug === slug);
