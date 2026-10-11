/**
 * Authoring source for the customer getting-started tracks. Writes content/customer/*.json, which
 * `npm run import:knowledge` loads. Each question lists the correct answer first; the build shuffles the
 * options with a seed taken from the prompt, so answer positions are mixed but the files are reproducible.
 *   node scripts/build-customer-content.mjs
 *
 * Everything here comes from the product docs and code. Where a source is unsettled or internal (for example
 * Moksy's report counts, or GGMoney, which is an in-house tool still in sandbox) it is deliberately left out.
 */
import fs from "node:fs";
import path from "node:path";

const seed = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (s) => { let a = seed(s); return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** q(level, prompt, correct, [wrong x3], hint) */
const q = (level, prompt, correct, wrong, hint, topic) => {
  if (wrong.length !== 3) throw new Error(`need 3 wrong options: ${prompt}`);
  const opts = [correct, ...wrong], r = rng(prompt);
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  const keys = ["a", "b", "c", "d"];
  return { level, type: "mcq", prompt, options: opts.map((text, i) => ({ key: keys[i], text })), answer: keys[opts.indexOf(correct)], hint, ...(topic ? { topic } : {}) };
};

const tracks = [];

// ---------------------------------------------------------------- GGLearn
tracks.push({
  trackSlug: "gglearn-customer-start",
  lessons: [
    [1, "Meet GGLearn", ["Tracks are subjects, products, services, tools, technologies or processes", "Every track has 20 levels, from Novice to Titan", "A level exam asks up to 10 questions and you need 80% to pass", "You join by invitation: one single-use link for your email address"]],
    [2, "How progress works", ["Levels unlock in order: pass one to open the next", "Three daily quests: study guide, 5-question drill, finish an exam", "Each track has a rival who earns XP every day", "Certificates arrive at levels 5, 10, 15 and 20"]],
    [3, "Grading, certificates and checks", ["Multiple choice is marked automatically; written answers are marked against a rubric", "Certificates have a code anyone can verify", "The placement check finds your starting level", "A failed exam can be retaken with a fresh draw of questions"]],
    [4, "Looking after your account", ["Passwords are 8 characters or more", "A profile photo is optional: JPEG, PNG or WebP up to 300 KB", "Use Sign out everywhere on a shared or lost device", "Streaks count consecutive days with at least one quest"]],
    [5, "Contests and getting it right", ["A contest is a race to gain a set number of levels before a deadline", "Bots are simulated: they follow a fixed daily XP schedule", "GGLearn never holds or moves prize money", "Required learning shows up on your dashboard with due dates"]],
  ],
  items: [
    {
      title: "What GGLearn is and how you move through it",
      body: "GGLearn is a training academy. You learn in tracks: each track is one subject, product, service, tool, technology or process. Every track has 20 levels, named from Novice (level 1) up to Titan (level 20). To pass a level you sit an exam that asks up to 10 questions and you need 80% to pass. Levels unlock in order. Before each exam there is a study guide with the level's syllabus and flip cards. Accounts are by invitation: a manager issues a single-use link tied to one email address and valid for 7 days. Passwords are 8 characters or more. A new person can be given required tracks with due dates; they appear on the dashboard under Required for you, and customers only ever see tracks made for customers.",
      questions: [
        q(1, "How many levels does every GGLearn track have?", "20", ["5", "10", "100"], "Every track runs from level 1 (Novice) to level 20 (Titan).", "Levels"),
        q(1, "What is the first level of a track called?", "Novice", ["Titan", "Beginner", "Master"], "Level 1 is Novice; level 20 is Titan.", "Levels"),
        q(1, "What is the top level of a track called?", "Titan", ["Master", "Grandmaster", "Legend"], "Titan is level 20. Master (15) and Grandmaster (19) come before it.", "Levels"),
        q(1, "In GGLearn, what is a track?", "One subject, product, service, tool, technology or process that you can learn and be tested on", ["A single exam question", "A group of learners", "A printed certificate"], "A track is one area of knowledge with its own 20 levels.", "Tracks"),
        q(1, "What score do you need to pass a level exam?", "80%", ["50%", "60%", "100%"], "The pass mark is 80%.", "Exams"),
        q(1, "A level exam draws up to how many questions?", "10", ["5", "20", "50"], "Each attempt draws up to 10 questions for that level.", "Exams"),
        q(1, "How do you get a GGLearn account?", "A manager sends you a single-use invite link for your email address", ["Anyone can sign up on the home page", "You pay a joining fee", "You sign in with a social media account"], "Signup is invite-only.", "Accounts"),
        q(2, "Normally, what must you do before you can start level 6 of a track?", "Pass level 5 (or already be placed past it by the placement check)", ["Nothing, any level can be taken at any time", "Win a contest", "Ask your manager to unlock it"], "Levels unlock in order.", "Levels"),
        q(2, "What does a study guide show you?", "The level's syllabus and flip cards drawn from that level's questions", ["Your rival's exam answers", "Your password", "The questions from tomorrow's exam"], "The study guide prepares you for the level before the exam.", "Study"),
        q(2, "Where do you see the tracks you are required to pass, with due dates?", "On your dashboard under Required for you", ["In the contests list", "On your profile photo page", "In your email only"], "Required tracks and their deadlines are listed on the dashboard.", "Required learning"),
        q(3, "How long is a GGLearn invite link valid, and how many times can it be used?", "7 days and once", ["24 hours and once", "30 days and any number of times", "It never expires"], "An invite is single-use, tied to one email, and valid for 7 days.", "Accounts"),
        q(4, "Your invite link says it is not valid. What is the most likely reason?", "It has expired or has already been used, so ask for a new one", ["Your browser is out of date", "You must pay first", "Links only work on mobile"], "Invites expire after 7 days and work only once.", "Accounts"),
        q(4, "You passed level 4 yesterday and want to sit level 6 today. What must you do?", "Pass level 5 first", ["Go straight to level 6", "Ask your rival", "Create a second account"], "Levels unlock in order.", "Levels"),
        q(5, "Why might the questions in your exam differ from your last attempt?", "Each attempt draws a fresh set of questions, favouring ones you have not yet answered correctly", ["The exam is broken", "Only your rival sees the same ones twice", "Questions change only once a year"], "Fresh draws mean you cannot just memorise one paper.", "Exams"),
        q(5, "Which tracks can a customer account open?", "Only tracks made for customers", ["Every track, including staff-only ones", "None", "Only tracks they have paid extra for"], "Customer accounts only see customer-facing tracks.", "Accounts"),
      ],
    },
    {
      title: "Exams, levels and certificates",
      body: "Multiple-choice answers are marked automatically against the answer key. Open and scenario answers are graded by Claude against a reference answer and rubric; without an AI key a coarse keyword fallback is used. Passing level 5, 10, 15 or 20 issues a certificate: level 5 is Foundation, level 10 Practitioner, level 15 Expert and level 20 Titan. Each certificate has a public code and can be verified at /cert/<code>. A failed exam can be retaken: the level stays locked and you try again with a fresh draw. The placement check is a short set of questions that finds the level you already know, so you start there instead of at level 1; it never places someone past level 15, higher levels have to be earned by exam.",
      questions: [
        q(2, "Which levels issue a certificate when you pass them?", "5, 10, 15 and 20", ["Every level", "1, 2, 3 and 4", "Only level 20"], "Milestone levels 5, 10, 15 and 20 issue certificates.", "Certificates"),
        q(2, "How are multiple-choice questions marked?", "Automatically against the answer key", ["By your manager", "By your rival", "By a vote of other learners"], "Multiple-choice marking is automatic.", "Grading"),
        q(3, "What is the level-10 certificate called?", "Practitioner", ["Foundation", "Expert", "Titan"], "Foundation (5), Practitioner (10), Expert (15), Titan (20).", "Certificates"),
        q(3, "How are open-answer questions graded?", "Claude compares them with a reference answer and rubric, with a simpler keyword check if AI is unavailable", ["They are not graded", "A random score is given", "Only a manager can grade them"], "Open answers are marked against a reference answer and rubric.", "Grading"),
        q(3, "How can someone check that a certificate is genuine?", "Use its verification code at /cert/<code>", ["Phone the learner", "Look at the file name", "It cannot be checked"], "Every certificate has a public code that can be verified.", "Certificates"),
        q(3, "What does the placement check do?", "It finds the level you already know so you start there instead of level 1", ["It resets all your progress", "It ranks you against everyone else", "It issues a certificate"], "The placement check saves you repeating what you already know.", "Placement"),
        q(3, "You fail a level exam. What happens?", "The level stays locked and you can try again with a fresh draw of questions", ["Your account is suspended", "You must wait 30 days", "You are removed from the track"], "You can retake the exam; there is no lockout.", "Exams"),
        q(4, "What helps most when answering an open question?", "Covering the key points a good answer should include", ["Writing as much as possible, whatever it says", "Answering in one word", "Repeating the question"], "Open answers are marked against a rubric of key points.", "Grading"),
        q(5, "You already know a subject well. What is the best way to avoid repeating the basics?", "Take the placement check to start at a higher level", ["Take level 1 anyway", "Skip the track", "Ask for a refund"], "The placement check sets your starting level.", "Placement"),
      ],
    },
    {
      title: "Daily quests, streaks and rivals",
      body: "Each track has three daily quests: read the study guide (+20 XP), answer a five-question drill with instant feedback (+30 XP) and finish any level exam (+40 XP). Drills only draw from levels you have already passed, so they never reveal the exam you are about to sit; a brand-new learner drills level 1. A streak is the number of consecutive days, ending today or yesterday, on which you completed at least one quest. Every track has a stable, named rival who earns XP every day; on the scale used for rivals, 150 XP equals one level. The dashboard compares your levels with your rival's. Badges mark milestones such as passing your first level, a 3-day streak, a 7-day streak and earning a certificate.",
      questions: [
        q(1, "What is XP in GGLearn?", "Experience points earned from quests and exams", ["Money you can withdraw", "A kind of password", "The time an exam takes"], "XP measures your effort and feeds the race with your rival.", "XP"),
        q(2, "Which three daily quests does each track offer?", "Read the study guide, answer a five-question drill, finish an exam", ["Log in, share, invite", "Read, write, speak", "Sign, pay, review"], "Study guide, drill and exam are the three quests.", "Quests"),
        q(2, "What is a rival?", "A named opponent assigned to each track who earns XP every day", ["Another customer's account", "Your manager", "The system that marks exams"], "A rival gives you someone to race on each track.", "Rivals"),
        q(2, "What is the drill?", "Five quick questions with instant feedback", ["A timed 3-hour exam", "A printed certificate", "A contest"], "The drill is short practice with immediate feedback.", "Quests"),
        q(2, "What does a streak count?", "Consecutive days on which you completed at least one quest", ["Correct answers in a row", "Exams passed in total", "Contests you have won"], "Streaks reward showing up day after day.", "Streaks"),
        q(3, "Which daily quest earns the most XP?", "Finishing an exam (+40)", ["The study guide (+20)", "The drill (+30)", "They all earn the same"], "Exam +40, drill +30, study +20.", "Quests"),
        q(3, "Which levels can a drill draw questions from?", "Only levels you have already passed", ["Only the exam you are about to sit", "Any level at random", "Only level 20"], "Drills never reveal the exam you are about to sit.", "Quests"),
        q(3, "On the scale GGLearn uses for rivals, how much XP equals one level?", "150 XP", ["10 XP", "50 XP", "1,000 XP"], "A rival's level is its XP divided by 150.", "Rivals"),
        q(4, "You completed a quest on Monday, then nothing on Tuesday or Wednesday. What is your streak when you open GGLearn on Thursday?", "Zero: a streak needs consecutive days ending today or yesterday", ["Three", "One", "Four"], "The streak resets after a missed day.", "Streaks"),
      ],
    },
    {
      title: "Contests, privacy and your account",
      body: "A contest is a time-boxed race on one track: gain a set number of levels (1 to 20) before a deadline of 1 to 90 days. Progress is growth, so beginners and experts race fairly. Ranking goes to who reached the goal first, then levels gained, then XP in the window. Contests can include simulated bots; a bot does not study or answer questions, it follows a fixed daily XP schedule and is labelled as simulated. A contest is private (only the organiser, invited people and members can open it) or public (anyone can watch, and joining requires consent that your name, photo and progress become public). A cash prize is optional: the organiser pays winners, GGLearn never holds or moves money. A profile photo is optional (JPEG, PNG or WebP up to 300 KB); colleagues who are signed in can see it and strangers see it only if you play in a public contest. Sign out everywhere ends your session on every device.",
      questions: [
        q(4, "Who can see your profile photo?", "Signed-in colleagues, and strangers only if you play in a public contest", ["Everyone on the internet, always", "Nobody", "Only your manager"], "A photo is optional and its visibility is limited.", "Privacy"),
        q(4, "You think you left yourself signed in on a shared computer. What should you do?", "Use Sign out everywhere to end your session on every device", ["Change your email address", "Do nothing, sessions never matter", "Delete your XP"], "Sign out everywhere ends all your sessions.", "Account"),
        q(4, "How long must a GGLearn password be?", "At least 8 characters", ["At least 4 characters", "Exactly 12 characters", "Passwords are not used"], "Passwords are 8 characters or more.", "Account"),
        q(4, "What photo can you upload to your profile?", "A JPEG, PNG or WebP image up to 300 KB", ["Any file of any size", "A GIF up to 5 MB", "Photos are not allowed"], "Photos are optional and limited in type and size.", "Privacy"),
        q(5, "What does a GGLearn contest measure?", "Who gains the most levels in one track before the deadline", ["Who has the most followers", "Who answers fastest in one minute", "Who invites the most people"], "A contest is a race to gain a set number of levels.", "Contests"),
        q(5, "A contest offers a cash prize. Who pays it?", "The organiser, because GGLearn never holds or moves money", ["GGLearn pays automatically", "Your rival pays", "No one, prizes are not real"], "Prize money is arranged between the organiser and winners.", "Contests"),
        q(5, "Who can open a private contest?", "The organiser, invited people and members", ["Anyone with the web address", "Only managers", "Every GGLearn user"], "Anyone else sees a not-found page.", "Contests"),
        q(5, "What do contest bots do?", "Follow a fixed daily XP schedule and are labelled as simulated", ["Study and answer questions like a person", "Mark exams", "Pay out prizes"], "A bot does not actually study or answer questions.", "Contests"),
        q(5, "Who receives the champion certificate for a contest?", "The best human who reached the goal", ["The fastest bot", "Everyone who joined", "The organiser"], "Champions and finishers are people who reached the goal.", "Contests"),
        q(5, "Your dashboard shows a required track as overdue. What should you do?", "Work on it first, because required learning has a deadline", ["Ignore it, it is optional", "Delete the track", "Wait for the next streak"], "Overdue required learning is reported to managers.", "Required learning"),
      ],
    },
  ],
});

// ---------------------------------------------------------------- GGSocial
tracks.push({
  trackSlug: "ggsocial-customer-start",
  lessons: [
    [1, "Meet GGSocial", ["One desk to plan, approve, schedule and publish content for every brand", "A brand is one company or project with its own channels, calendar and team", "A channel is one account on one platform", "The Composer writes copy once for many channels"]],
    [2, "Posts, roles and channels", ["A post moves from draft to approval to scheduled", "Roles belong to a brand: owner, admin, editor, approver, viewer", "Live channels publish by themselves; manual-only channels end with a person posting", "Platforms have their own rules, such as 280 characters on X"]],
    [3, "Composer, queue and playbook", ["Override the base copy for any one channel", "The Publish queue holds posts for manual channels, with copy and media ready", "Playbook rules marked as must stop a post being scheduled", "Scheduled times show in the brand's own timezone"]],
    [4, "Working as a team", ["Approvers review and comment but cannot edit", "Editors write, schedule and publish; admins manage channels and team", "Manual and live channels share the same approval flow", "Hiding a button is not security: the role is checked every time"]],
    [5, "Agents and the Review inbox", ["Brands can switch on agents: strategist, writer, community manager, analyst", "Everything waiting for a person lands in the Review inbox", "Risky content such as prices, refunds, legal or health matters always stops for a person", "Every AI call is logged with its cost"]],
  ],
  items: [
    {
      title: "What GGSocial is: brands, channels and the desk",
      body: "GGSocial is one desk for every brand you run. It lets a team plan, approve, schedule and publish social content for many companies without a separate login for each. The core unit is the brand: one company or project, with its own channels, media, calendar, team and timezone. A channel is one account on one platform, owned by one brand. Some channels are live: GGSocial publishes to them itself through the platform's API. Others are manual-only, because the platform has no write API for organic content. For those, GGSocial still composes, validates, schedules and queues the post and gives a person copy-ready blocks to post themselves. A manual-only channel gets the same validation, calendar slot and approval flow as a live one and simply ends with a person clicking publish. People sign in with an email and a password.",
      questions: [
        q(1, "What is GGSocial for?", "Planning, approving, scheduling and publishing social content for many brands from one place", ["Sending marketing email only", "Doing company accounts", "Hosting websites"], "It is one desk for every brand you run.", "Overview"),
        q(1, "What is a brand in GGSocial?", "One company or project, with its own channels, media, calendar, team and timezone", ["A logo file", "A single post", "A social media platform"], "The brand is the core unit.", "Brands"),
        q(1, "What is a channel in GGSocial?", "One account on one platform, owned by one brand", ["A team of people", "A calendar view", "A folder of images"], "A channel belongs to exactly one brand.", "Channels"),
        q(1, "How do people sign in to GGSocial?", "With an email address and a password", ["With a phone number only", "With a hardware key only", "They do not sign in"], "Accounts use email and password.", "Accounts"),
        q(1, "Roughly how many platforms does GGSocial cover?", "More than a hundred, grouped into categories", ["Only one", "About five", "About twenty"], "GGSocial covers over a hundred platforms; some publish live and some are manual-only.", "Channels"),
        q(1, "What does the Playbook hold?", "Master instructions and limits for each format and kind of engagement", ["Your passwords", "The list of team members", "Posts that have failed"], "The Playbook also checks limits such as hashtag count and copy length.", "Playbook"),
        q(2, "What is the difference between a live channel and a manual-only channel?", "A live channel is published to by GGSocial itself; a manual-only channel ends with a person posting", ["Live channels are free, manual ones are paid", "Manual channels cannot be scheduled", "There is no difference"], "Manual-only channels exist because some platforms offer no write API for organic posts.", "Channels"),
        q(2, "For a manual-only channel, who does the final posting?", "A person, using the copy-ready blocks GGSocial prepares", ["GGSocial, automatically", "The platform", "Nobody, it is not posted"], "The post is composed, checked and queued, then a person publishes.", "Channels"),
        q(2, "Are roles in GGSocial global or per brand?", "Per brand", ["Global for the whole account", "Per post", "Per platform"], "A person can hold a different role in each brand.", "Roles"),
        q(3, "Does a manual-only channel go through the same approval flow as a live channel?", "Yes, it ends with a person clicking publish", ["No, it skips approval", "No, it needs a manager's phone call", "Yes, but only on weekdays"], "Same validation, calendar slot and approval flow.", "Channels"),
        q(5, "Which view in GGSocial shows every brand on a single month grid?", "The Calendar", ["Analytics", "The Playbook", "The Review inbox"], "The Calendar is colour-coded by brand and posts can be dragged to move them.", "Calendar"),
      ],
    },
    {
      title: "Writing and planning: composer, calendar, playbook",
      body: "The Composer lets you write base copy once and override it per channel, with live character counts and per-platform rules: Reddit needs a title and a subreddit, YouTube needs a title, Instagram needs media, and X caps at 280 characters and can thread on blank lines. The Calendar shows every brand on one month grid, colour-coded, and a post can be dragged to move it. A post's scheduled time is an absolute instant shown in the brand's timezone. The Playbook holds master instructions for each format and kind of engagement, with limits the app checks itself such as title words, hashtag count, copy length, aspect ratio and posting windows; scheduling and approval refuse a post that breaks a rule marked as a must. Analytics shows what went out, where, and whatever metrics the platform returns.",
      questions: [
        q(1, "What is the maximum length of a post on X in the Composer?", "280 characters", ["100 characters", "1,000 characters", "There is no limit"], "X caps at 280 characters, and the Composer shows a live count.", "Composer"),
        q(1, "Where do you write one piece of copy for several channels?", "The Composer", ["The Calendar", "Analytics", "The Review inbox"], "Write base copy once and override it per channel.", "Composer"),
        q(2, "What does an Instagram post need?", "Media (an image or video)", ["A subreddit", "A thread", "A title only"], "Instagram needs media; Reddit needs a title and a subreddit.", "Composer"),
        q(2, "What does a Reddit post need?", "A title and a subreddit", ["Media only", "A hashtag", "A video"], "Per-platform rules are checked in the Composer.", "Composer"),
        q(2, "How do you move a post to another day on the Calendar?", "Drag it to the new day", ["Delete it and start again", "Email the support team", "You cannot move posts"], "The Calendar supports drag to move.", "Calendar"),
        q(3, "How do you tune the wording of a post for one platform only?", "Override the base copy on that channel", ["Write a new post for every platform from scratch", "Edit the brand's name", "Change the calendar colour"], "Base copy plus per-channel overrides.", "Composer"),
        q(3, "What do Playbook rules marked as must do?", "Scheduling and approval refuse a post that breaks them", ["Nothing, they are suggestions", "Delete the post", "Email the owner"], "Must rules block scheduling and approval.", "Playbook"),
        q(3, "In which timezone is a post's scheduled time shown?", "The brand's own timezone", ["Always UTC", "The viewer's phone only", "New York time"], "The time is an absolute instant shown in the brand's timezone.", "Calendar"),
        q(4, "Your draft for X is 400 characters. What can you do?", "Shorten it, or split it into a thread by separating parts with blank lines", ["Publish it anyway, X will accept it", "Nothing, it is blocked forever", "Switch to Instagram"], "X caps at 280 characters and can thread on blank lines.", "Composer"),
        q(4, "What does Analytics show?", "What went out, where, and the metrics the platform returns", ["Your password history", "Only the team list", "Nothing, it is a placeholder"], "Analytics reports on published posts.", "Analytics"),
      ],
    },
    {
      title: "Approvals, roles and the publish queue",
      body: "A post moves from draft to needs approval to approved to scheduled, with comments and change requests along the way. Roles are per brand: owner (everything, including archiving the brand), admin (channels, team and content), editor (write, schedule and publish), approver (review only, cannot edit) and viewer (read-only). Editing and publishing need editor or above; managing channels, team and the brand needs admin or above; approving is for the approver role or admin and above. Every server action re-checks the role, because hiding a button in the screen is not the security boundary. The Publish queue holds anything due on a manual-only channel, with copy buttons, the media to download and platform-specific steps. Ticking a queue item off marks it published.",
      questions: [
        q(2, "In what order does a post normally move through approval?", "Draft, needs approval, approved, scheduled", ["Scheduled, draft, approved", "Approved, draft, scheduled", "Draft, published, approved"], "Posts are approved before they are scheduled.", "Approvals"),
        q(2, "Which role can approve posts but cannot edit them?", "Approver", ["Editor", "Owner", "Viewer"], "An approver reviews only.", "Roles"),
        q(2, "Which role is read-only?", "Viewer", ["Editor", "Approver", "Admin"], "A viewer can look but not change anything.", "Roles"),
        q(3, "What does the Publish queue hold?", "Anything due on a manual-only channel, with copy buttons, media and steps", ["Every post ever written", "Only failed posts", "Passwords"], "The queue is where a person finishes manual posts.", "Queue"),
        q(3, "You have posted a queued item by hand. What do you do in GGSocial?", "Tick it off in the queue, which marks it published", ["Delete the brand", "Nothing, it updates itself", "Email the platform"], "Ticking the item off marks it published.", "Queue"),
        q(3, "What is the minimum role needed to schedule and publish posts?", "Editor", ["Viewer", "Approver", "Owner only"], "Editing and publishing need editor or above.", "Roles"),
        q(3, "Which role can manage channels and the team?", "Admin or above", ["Viewer", "Approver", "Editor"], "Managing channels, team and the brand needs admin or above.", "Roles"),
        q(3, "What can only a brand's owner do that others cannot?", "Archive the brand", ["Write a post", "Read the calendar", "Approve a post"], "The owner can do everything, including archiving the brand.", "Roles"),
        q(4, "You are an approver and spot a typo in a draft. What is the right move?", "Comment or request changes so an editor fixes it", ["Edit the post yourself", "Delete the post", "Ask the viewer to fix it"], "Approvers can comment and request changes but cannot edit.", "Approvals"),
        q(4, "Which post status means a reviewer has sent it back for edits?", "Changes requested", ["Published", "Scheduled", "Approved"], "A change request returns the post to the author.", "Approvals"),
        q(4, "Who adds a new teammate to a brand?", "An admin or the owner", ["A viewer", "An approver", "Any visitor"], "Managing the team needs admin or above.", "Roles"),
        q(4, "A post is published on two channels but fails on a third. Which overall status fits?", "Partially published", ["Published", "Draft", "Approved"], "A post has one target per channel, each with its own status.", "Approvals"),
        q(4, "Why does a post for a manual-only channel go to the Publish queue instead of being sent?", "The platform has no write API for organic posts, so a person publishes it", ["GGSocial forgot to send it", "It has been rejected", "Queues are only for failed posts"], "Manual-only channels end with a person publishing.", "Queue"),
        q(4, "A viewer opens a direct link to an edit action. What happens?", "GGSocial checks their role again and refuses", ["The edit goes through", "The page deletes itself", "Their role is upgraded"], "Hiding a button is not the security boundary; roles are re-checked.", "Roles"),
      ],
    },
    {
      title: "Agents and the Review inbox",
      body: "Each brand can switch on a crew of agents that do hourly work so people only set guidelines and review. There are four: the content strategist (keeps the content plan ahead of the calendar), the content writer (keeps the calendar full from the plan, books posts into open slots and revises work sent back), the community manager (drafts replies to comments, messages, mentions and reviews and flags anything a person must decide) and the performance analyst (reads yesterday's posts each morning and writes weekly and monthly reports). Review is on for every step until the brand owner switches it off, and the reason is kept in the log. A reviewer scores agent output out of 100 and flags risks; weak but safe work goes back to the agent once with fixes. Safety stops pause a run whatever the setting: a flagged risk such as prices, refunds, legal or health matters, a score under the pass mark, a broken playbook rule marked as a must, the reviewer being unable to run, the daily AI budget being spent, or a step that keeps failing. Everything waiting on a person lands in one Review inbox, where you can approve, send back with a note, or stop the run. Every Claude call is logged with its cost.",
      questions: [
        q(5, "Which agent keeps the calendar full from the content plan?", "The content writer", ["The performance analyst", "The community manager", "The reviewer"], "The writer books posts into open slots.", "Agents"),
        q(5, "Which agent reads yesterday's posts each morning and writes weekly and monthly reports?", "The performance analyst", ["The content strategist", "The content writer", "The community manager"], "The analyst turns results into reports.", "Agents"),
        q(5, "Which agent drafts replies to comments, messages, mentions and reviews?", "The community manager", ["The content strategist", "The performance analyst", "The content writer"], "It also flags anything a person must decide.", "Agents"),
        q(5, "Where does everything waiting for a person land?", "The Review inbox", ["The Calendar", "The Playbook", "Analytics"], "In the Review inbox you can approve, send back with a note, or stop the run.", "Review"),
        q(5, "Who can switch off review for a brand's agent steps?", "The brand owner, with the reason kept in the log", ["Any viewer", "The agents themselves", "Nobody, it is permanent"], "Review is on until the owner switches it off.", "Review"),
        q(5, "An agent drafts a reply promising a customer a refund. What happens?", "The run pauses for a person, whatever the review setting", ["It is sent immediately", "It is deleted silently", "The platform decides"], "Prices, refunds, legal and health matters always stop for a person.", "Review"),
        q(5, "An agent's work scores weak but safe. What happens?", "It goes back to the agent once with fixes", ["It is published at once", "It is deleted", "The owner is locked out"], "Weak but safe work gets one chance to improve.", "Review"),
        q(5, "What is logged for every Claude call GGSocial makes?", "Its cost", ["Your password", "Your location", "Nothing"], "AI usage and cost are logged.", "Review"),
        q(5, "What happens to a run if the daily AI budget has been spent?", "It pauses for a person", ["It spends more anyway", "It deletes the brand", "It is published as is"], "A spent budget is one of the safety stops.", "Review"),
      ],
    },
  ],
});

// ---------------------------------------------------------------- Moksy
tracks.push({
  trackSlug: "moksy-customer-start",
  lessons: [
    [1, "Meet Moksy", ["Moksy turns an idea into a build-ready plan", "An AI interviews you about your idea", "Your idea and its document live in a project", "MOX is Moksy credit: 1 MOX is one cent, kept in your Wallet"]],
    [2, "The journey", ["Idea, interview, document, expert review, then build", "Reviewers check documents; customers create projects and receive them", "MXP is experience points for the Ladder, not money", "You get Starter MOX when you join"]],
    [3, "MOX and MXP", ["Always pair the unit with a noun: MOX in the Wallet, MXP on the Ladder", "MOX can be bought in packs and is held in escrow while a review is open", "The build stage covers downloads, exports and hiring", "Your role decides what you can do"]],
    [4, "Reading your document", ["Your interview answers are the input to the document", "Every number should trace to a stored fact with a source", "A model may phrase a figure but never invents one", "Convert MOX to money: 1 MOX is one cent"]],
    [5, "Using Moksy well", ["Know the stage you are in and what comes next", "If a fact is missing, Moksy asks, derives or gives a range instead of inventing", "MOX and MXP differ by one letter, so always use the pairing"]],
  ],
  items: [
    {
      title: "What Moksy is and the customer journey",
      body: "Moksy turns an idea into a build-ready plan. You type in your idea and an AI asks a series of questions in what the product calls the interview. Your answers become the input to a document: the plan for your idea. After the document comes an expert review, where a reviewer checks it, and then the build stage, which covers downloads, exports and hiring. One idea and its document live inside a project. Customers create projects and receive documents; reviewers check documents; staff run the platform from an operator console. A person's role decides what they can do. In the customer area the home screen is called Home.",
      questions: [
        q(1, "What does Moksy do?", "Turns an idea into a build-ready plan", ["Hosts your website", "Prints your invoices", "Sells domain names"], "That is Moksy's tagline.", "Overview"),
        q(1, "What is the first thing you give Moksy?", "Your idea", ["Your bank details", "A finished website", "A logo"], "Everything starts with the idea you type in.", "Overview"),
        q(1, "What asks you questions about your idea in Moksy?", "An AI, in what the product calls the interview", ["A human reviewer in a live call", "Your rival", "A printed form"], "The interview is how Moksy learns about your idea.", "Journey"),
        q(1, "Where do your idea and its document live?", "In a project", ["In your Wallet", "On the Ladder", "In the Console"], "One idea and its document live inside a project.", "Projects"),
        q(2, "What is the order of the Moksy journey?", "Idea, interview, document, expert review, build", ["Build, interview, idea, review", "Document, idea, build, interview", "Review, build, idea, document"], "The document comes after the interview and before the review.", "Journey"),
        q(2, "What does the expert review do?", "A reviewer checks your document", ["It deletes your project", "It builds your product", "It prices MOX"], "Reviewers check documents.", "Journey"),
        q(2, "What do customers receive from Moksy?", "Documents for their projects", ["Free MOX forever", "Reviewer earnings", "Console access"], "Customers create projects and receive documents.", "Journey"),
        q(3, "What does the build stage cover?", "Downloads, exports and hiring", ["Only the interview", "Reviewer payments", "Account deletion"], "Build is what you do with your finished document.", "Journey"),
        q(3, "What decides what a person can do in Moksy?", "Their role", ["The colour of their avatar", "The time of day", "Their email provider"], "Roles include customers, reviewers and staff.", "Roles"),
        q(5, "Which stage comes after your document has been generated?", "The expert review", ["The interview", "Choosing your idea", "Deleting the project"], "The document is checked by a reviewer before you build.", "Journey"),
        q(1, "Who checks your document in the expert review stage?", "A reviewer", ["Your rival", "The Wallet", "Nobody"], "Reviewers check documents.", "Journey"),
        q(2, "What is the customer's home screen called in Moksy?", "Home", ["The Console", "The Ladder", "The Wallet"], "Customers start from Home; staff use the Console.", "Roles"),
        q(2, "Which part of Moksy do staff use to run the platform?", "The operator console, called the Console", ["The Wallet", "The Ladder", "Home"], "The Console is the staff area.", "Roles"),
        q(4, "You have finished the interview. What does Moksy produce next?", "A document built from your answers", ["A refund", "A new Wallet", "A reviewer badge"], "Your answers become the input to the document.", "Journey"),
        q(4, "Which stage is where you download or export your finished work?", "The build stage", ["The interview", "The expert review", "The Wallet"], "The build stage covers downloads, exports and hiring.", "Journey"),
        q(5, "Who checks documents, and who receives them?", "Reviewers check them and customers receive them", ["Customers check them and reviewers receive them", "Staff receive them and customers check them", "Nobody checks them"], "Customers create projects and receive documents; reviewers check them.", "Roles"),
      ],
    },
    {
      title: "MOX and MXP",
      body: "Moksy has two coined marks that are one letter apart. MOX stands for Moksy credit, and 1 MOX equals one cent. MXP stands for Moksy Experience Points, and it is what you climb the Ladder with. Always pair the unit with a noun so they cannot be confused: the Wallet holds MOX, the Ladder is climbed with MXP. MOX lives in the Wallet, can be bought in packs, is granted as Starter MOX on joining, and is held in escrow while a review is open.",
      questions: [
        q(1, "What is 1 MOX worth?", "One cent", ["One pound", "One hundred dollars", "Nothing, it is just points"], "1 MOX equals one cent.", "MOX"),
        q(1, "Where do you hold your MOX?", "In your Wallet", ["On the Ladder", "In a project", "In the Console"], "MOX lives in the Wallet.", "MOX"),
        q(2, "What is MXP?", "Moksy Experience Points, used to climb the Ladder", ["Moksy money you can spend", "A type of document", "A hiring fee"], "MXP is experience, not currency.", "MXP"),
        q(2, "What do you receive when you join Moksy?", "Starter MOX", ["A free document for life", "A reviewer badge", "Console access"], "New accounts are granted Starter MOX.", "MOX"),
        q(3, "Which pairing is correct?", "MOX in the Wallet, MXP on the Ladder", ["MXP in the Wallet, MOX on the Ladder", "MOX on the Ladder, MXP in the Console", "Both live in the Wallet"], "Always pair each unit with its noun.", "MOX and MXP"),
        q(3, "How can you get more MOX?", "Buy it in packs", ["By reading the lexicon", "By changing your role", "It cannot be increased"], "MOX can be bought in packs.", "MOX"),
        q(3, "What happens to MOX while a review is open?", "It is held in escrow", ["It is destroyed", "It is converted to MXP", "It is returned immediately"], "Escrow protects both sides while the review happens.", "MOX"),
        q(4, "Your Wallet shows 250 MOX. What is it worth?", "250 cents", ["250 pounds", "2,500 cents", "25 cents"], "1 MOX is one cent.", "MOX"),
        q(4, "You want to climb the Ladder. Which do you earn?", "MXP", ["MOX", "Escrow", "Starter packs"], "MXP is what the Ladder runs on.", "MXP"),
        q(5, "Why does Moksy always pair each unit with a noun?", "MOX and MXP are one letter apart and easy to confuse", ["It is a legal requirement in every country", "To make the screens longer", "Because they mean the same thing"], "Pairing with a noun keeps money and experience apart.", "MOX and MXP"),
        q(5, "Which statement about MOX and MXP is correct?", "1 MOX is one cent; MXP is experience points and not money", ["MXP can be spent in the Wallet", "MOX is used to climb the Ladder", "They are the same thing"], "Money and experience are separate things.", "MOX and MXP"),
        q(4, "Your Wallet balance looks lower while a review of your document is still open. What is the likeliest explanation?", "Some MOX is held in escrow until the review finishes", ["MOX expires every day", "MXP was subtracted", "The Ladder reset"], "MOX is held in escrow while a review is open.", "MOX"),
        q(4, "A friend says you can buy MXP in packs and spend it. What is right?", "MXP is experience points for the Ladder; it is MOX you buy in packs", ["Yes, MXP is the currency", "MXP and MOX are the same", "Neither can be bought"], "MOX is credit; MXP is experience.", "MOX and MXP"),
        q(5, "Which sentence uses the units correctly?", "I topped up my Wallet with MOX and I earn MXP on the Ladder", ["I topped up my Wallet with MXP and I earn MOX on the Ladder", "I climb the Wallet with MOX", "My Ladder holds 300 MOX of experience"], "Wallet goes with MOX and Ladder with MXP.", "MOX and MXP"),
      ],
    },
    {
      title: "Where the numbers in your document come from",
      body: "The report is the centre of the product, and the rule is that every number, name, date and judgement shown to a customer should resolve to a stored fact with a source. A model may phrase a figure but may never originate one. If a fact is missing, the system refuses, asks, derives or gives a band rather than inventing a number. Your interview answers are the input to your document.",
      questions: [
        q(3, "What becomes the input to your Moksy document?", "Your answers in the interview", ["The colour theme you pick", "Your Wallet balance", "Your reviewer's earnings"], "The interview answers feed the document.", "Document"),
        q(3, "What is the rule for numbers shown to a customer in a Moksy document?", "Each should come from a stored fact with a source", ["The AI may make up any number it likes", "Numbers are never shown", "Numbers come from the reviewer's memory"], "A model may phrase a figure but never originate one.", "Document"),
        q(4, "You notice a cost figure in your document with no source behind it. What does Moksy's own rule say should be true?", "Every figure should trace to a stored fact with a source", ["Unsourced figures are fine if they look right", "Only prices need a source", "Figures never need a source"], "Traceability is the rule for every number.", "Document"),
        q(4, "What should you give the interview if you want a useful document?", "Specific, honest answers about your idea", ["One-word answers", "Random answers", "Nothing, the AI guesses"], "The document is built from your answers.", "Document"),
        q(5, "Moksy lacks a fact it needs for your document. What does it do rather than invent a number?", "It asks, derives the value, or gives a range", ["It makes up a plausible figure", "It deletes your project", "It charges extra MOX"], "Missing facts lead to a question, a derivation or a band.", "Document"),
        q(5, "Who is allowed to originate a figure in a Moksy document?", "Nobody: a model may phrase a figure but only stored facts supply it", ["The AI model", "Any reviewer", "The customer's rival"], "Figures come from stored data with a source.", "Document"),
      ],
    },
  ],
});

// ---------------------------------------------------------------- write
const out = path.resolve("content/customer");
fs.mkdirSync(out, { recursive: true });
for (const t of tracks) {
  const prompts = new Set();
  const counts = {};
  for (const it of t.items) for (const x of it.questions) {
    if (prompts.has(x.prompt)) throw new Error(`duplicate prompt in ${t.trackSlug}: ${x.prompt}`);
    prompts.add(x.prompt);
    counts[x.level] = (counts[x.level] ?? 0) + 1;
  }
  const file = { trackSlug: t.trackSlug, status: "review", lessons: t.lessons.map(([level, title, syllabus]) => ({ level, title, syllabus })), items: t.items };
  fs.writeFileSync(path.join(out, `${t.trackSlug}.json`), JSON.stringify(file, null, 1) + "\n");
  console.log(t.trackSlug, [...prompts].length, "questions, per level:", JSON.stringify(counts));
}
