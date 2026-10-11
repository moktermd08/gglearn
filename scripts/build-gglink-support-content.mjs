/**
 * Authoring source for the GGLink hosting and maintenance track (slug gglink-hosting-maintenance, role developer).
 * Writes content/gglink/gglink-hosting-maintenance.json, loaded with
 *   npm run import:knowledge -- content/gglink/gglink-hosting-maintenance.json
 * Questions arrive as "review" and stay unpublished until an admin approves them at /admin/review/gglink-hosting-maintenance.
 *   node scripts/build-gglink-support-content.mjs
 *
 * Sources, all read from the gglink repo on 2026-10-11 (no secrets were read; config.local.php was not opened):
 *   gglink/DEPLOY.md, gglink/.htaccess, gglink/.gitignore, gglink/deploy-check.php, gglink/config.php (public constants),
 *   gglink/admin/inc/{auth,db,crm}.php, gglink/admin/views/users.php.
 * Deliberately left out: anything about care plans, prices, service levels, response times or client outcomes. In
 * gglink/gg-sales-config.php those are still TODO placeholders and published prices are legally sensitive claims, so
 * nothing here may suggest they are decided. Also left out: hosting for clients' own sites (nothing is documented).
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
    title: "Deploying the GGLink site safely",
    body: "The GGLink website (www.gglink.co.uk) is a PHP site deployed by copying files. Run `php deploy-check.php` before and after uploading: it only reports, changes nothing, exits non-zero if anything would break the site, and refuses to run over HTTP so it is safe to leave on the server. Secrets live in config.local.php, which is gitignored and must never be committed; create it from config.local.php.example. Its settings are SENDGRID_API_KEY (a restricted key with Mail Send permission only), SENDGRID_FROM (must be a verified sender or mail is rejected), ENQUIRY_TO (where enquiries land) and RECAPTCHA_SECRET (without it spam filtering is off). Upload everything except .git/, node_modules/ and storage/gglink.sqlite*. vendor/ must be uploaded because there is no Composer on the server. Never overwrite storage/gglink.sqlite on a re-deploy: it holds the CMS content, blog posts, enquiries and contacts. Back it up before every release, for example cp storage/gglink.sqlite storage/backup-$(date +%F).sqlite. Permissions: chmod 755 storage assets/images/uploads and chmod 644 config.local.php. Only storage/ and assets/images/uploads/ should be writable by the web server. Source: gglink/DEPLOY.md and deploy-check.php.",
    questions: [
      q(1, "What should you run before and after uploading a new version of the GGLink site?", "php deploy-check.php", ["composer install", "npm run build", "php artisan migrate"], "A pre-flight check that only reports.", "Deploy"),
      q(1, "What does deploy-check.php do to the site?", "Only reports; it changes nothing", ["Fixes permissions automatically", "Uploads the vendor folder", "Restores the latest backup"], "Report-only.", "Deploy"),
      q(1, "Which file holds the GGLink site's secrets such as the SendGrid key?", "config.local.php", ["config.php", "DEPLOY.md", ".htaccess"], "Gitignored, created from the example file.", "Deploy"),
      q(1, "How is the GGLink site deployed?", "By copying files to the server", ["By a Composer install on the server", "By a Docker image", "By pushing to a managed platform"], "There is no Composer on the server.", "Deploy"),
      q(2, "Why can deploy-check.php be left on the server safely?", "It refuses to run over HTTP, so visitors cannot trigger it", ["It deletes itself after one run", "It only reads public files", "It is password protected by Apache"], "It is command-line only.", "Deploy"),
      q(2, "Is config.local.php committed to the repository?", "No: it is gitignored and must never be committed", ["Yes, so everyone has the same keys", "Yes, but encrypted", "Only on the main branch"], "It holds secrets.", "Deploy"),
      q(2, "What happens if RECAPTCHA_SECRET is not set?", "Spam filtering is off", ["Enquiries are rejected", "The site returns a 500 error", "Emails are sent twice"], "deploy-check warns that spam protection is not enforced.", "Deploy"),
      q(2, "Which setting decides where enquiry emails land?", "ENQUIRY_TO", ["SENDGRID_FROM", "BASE_URL", "RECAPTCHA_SECRET"], "SENDGRID_FROM is the sender.", "Deploy"),
      q(3, "Which folder must be uploaded because there is no Composer on the server?", "vendor/", ["node_modules/", ".git/", "storage/"], "The dependency tree ships with the site.", "Deploy"),
      q(3, "Which paths are left out when uploading?", ".git/, node_modules/ and storage/gglink.sqlite*", ["vendor/, assets/ and snippets/", "admin/, storage/ and vendor/", "config.php and header.php"], "The database file must never be overwritten.", "Deploy"),
      q(3, "What should you do before every release?", "Back up storage/gglink.sqlite, for example with cp to storage/backup-$(date +%F).sqlite", ["Delete storage/ so it is recreated", "Run composer update", "Change the admin password"], "The file is your CMS data.", "Deploy"),
      q(3, "What kind of key should the SendGrid API key be?", "A restricted key with Mail Send permission only", ["A full access key", "A read-only key", "A key shared with the whole team"], "Least privilege.", "Deploy"),
      q(4, "A re-deploy overwrote storage/gglink.sqlite with an old copy. What was lost?", "CMS content, blog posts, enquiries and contacts", ["Only the logo", "Only the vendor folder", "Nothing: the data lives in the PHP files"], "That file is the CMS data.", "Deploy"),
      q(4, "What happens if SENDGRID_FROM is not a verified sender?", "Mail is rejected", ["Mail is sent from a default address", "Mail goes to spam but is delivered", "The site falls back to PHP mail()"], "The sender must be verified in SendGrid.", "Deploy"),
      q(4, "Which permissions does the guide set on config.local.php?", "644", ["777", "400 owned by root only", "755"], "chmod 644 config.local.php.", "Deploy"),
      q(5, "Which folders should be writable by the web server?", "storage/ and assets/images/uploads/, and nothing else", ["Every folder", "Only vendor/", "admin/ and storage/"], "Everything else should not be writable.", "Deploy"),
      q(5, "Which missing setting would stop enquiry emails from sending at all?", "SENDGRID_API_KEY", ["RECAPTCHA_SECRET", "BASE_URL", "APP_NAME"], "deploy-check marks it FAIL: enquiry emails will not send.", "Deploy"),
    ],
  },
  {
    title: "First run and checking a deploy",
    body: "On first run, visit https://www.gglink.co.uk/admin/: it asks you to create the first account, and that page disappears once an account exists. Fill in Credentials (certificate numbers), Pricing (care plans and day rates) and Results; each section stays hidden on the public site until it has real values, so nothing ships half-finished. Branding (logo, favicon, social share image, brand colour) is optional: a blank field falls back to the shipped asset. One brand colour drives the whole site; darker, softer and wash shades are worked out from it. site-manifest.php serves the web app manifest so the installed-app name, icon and colour follow these settings. After a deploy, check: the home page loads and the logo appears; submitting the contact form lands on the thank-you page; the enquiry appears under Enquiries in the admin; the notification email arrives; and https://www.gglink.co.uk/storage/gglink.sqlite returns 403 or 404 (if it downloads, .htaccess is not being honoured and must be fixed before going live). Run deploy-check.php again and confirm zero failures. Source: gglink/DEPLOY.md.",
    questions: [
      q(1, "What does /admin/ ask you to do the first time it is opened?", "Create the first account", ["Enter the SendGrid key", "Upload the database", "Choose a theme"], "It drives first-run setup.", "First run"),
      q(1, "What is the public address of the GGLink site?", "https://www.gglink.co.uk", ["https://gglink.com", "https://app.gglink.uk", "https://www.gurugraphics.co.uk"], "www is the canonical host.", "First run"),
      q(1, "Where do contact-form enquiries appear for the team?", "Under Enquiries in the admin", ["In the browser console", "In storage/backup files only", "On the thank-you page"], "They are stored in the CMS.", "First run"),
      q(2, "What happens to the first-run setup page once an account exists?", "It disappears", ["It stays visible for 24 hours", "It is emailed to the owner", "It becomes the login page"], "Setup is one-time.", "First run"),
      q(2, "Which sections stay hidden on the public site until they have real values?", "Credentials, Pricing and Results", ["Home, About and Contact", "Blog, Media and Users", "Branding, Account and Setup"], "Nothing ships half-finished.", "First run"),
      q(2, "Which file serves the web app manifest so the installed-app name, icon and colour follow the settings?", "site-manifest.php", ["manifest.json", "serviceWorker.js", "robots.txt"], "It replaced two static manifest files.", "First run"),
      q(3, "How many colours drive the whole GGLink site's palette?", "One brand colour, with the shades worked out from it", ["Five fixed colours", "A colour per page", "Two colours chosen by the browser"], "Darker, softer and wash shades are derived.", "First run"),
      q(3, "https://www.gglink.co.uk/storage/gglink.sqlite should return what?", "403 or 404", ["200 with the file", "A redirect to the admin", "A blank page with 200"], "The database must not be downloadable.", "First run"),
      q(3, "That URL downloads the database file. What does it tell you?", ".htaccess is not being honoured, so fix it before going live", ["The backup ran successfully", "The CMS is up to date", "Cloudflare is caching it, which is harmless"], "The protections depend on Apache honouring .htaccess.", "First run"),
      q(4, "After submitting the contact form on a fresh deploy, what should you see?", "The thank-you page, then the enquiry under Enquiries and a notification email", ["The admin dashboard immediately", "A download of the enquiry", "No visible change until the next day"], "These are steps on the post-deploy checklist.", "First run"),
      q(4, "A brand field left blank in the Branding screen does what?", "Falls back to the shipped asset, so the site never breaks because a slot is empty", ["Shows a broken image", "Hides the whole site", "Uses the Guru Graphics logo"], "Everything in Branding is optional.", "First run"),
      q(5, "Why do Pricing and Results stay hidden until they have real values?", "So nothing ships half-finished or with invented figures", ["Because they are slow to load", "Because Apache blocks them", "Because they need a licence key"], "They are claims you can be held to.", "First run"),
      q(5, "What is the final step after the deploy checklist passes?", "Run deploy-check.php again and confirm zero failures", ["Delete deploy-check.php", "Restore the backup", "Change config.php"], "Check before and after.", "First run"),
    ],
  },
  {
    title: "Security and hosting configuration",
    body: "The site's .htaccess forces HTTPS, canonicalises non-www to www, collapses /index.php to /, sets security headers (HSTS, Referrer-Policy, X-Content-Type-Options, X-Frame-Options SAMEORIGIN, Permissions-Policy) and removes the PHP version banner. It denies source and secret file types (scss, map, lock, json, md, sh, bak, sql, sqlite, db, ini, log and others, plus config.local.php, composer files and dotfiles) and returns 404 for /vendor/, /storage/ and /admin/inc and /admin/views. manifest.json is the one JSON file allowed. All of this depends on AllowOverride being enabled; on nginx the rules must be reproduced manually or the database is downloadable. The site sits behind Cloudflare: with Flexible SSL the origin is reached over plain HTTP, so the HTTPS redirect keys off X-Forwarded-Proto and only falls back to %{HTTPS} for direct hits, to avoid a redirect loop. HSTS starts with a short max-age (86400) and should be raised to 31536000 once nothing is served over plain HTTP. Admin sessions are host-scoped; serving the admin from crm.gglink.co.uk isolates its cookie from the public site, so a cross-site scripting bug on the marketing pages cannot reach the CRM. display_errors is off in the admin and the form handler and should be off site-wide; errors are logged instead. Source: gglink/.htaccess and DEPLOY.md.",
    questions: [
      q(2, "What does the GGLink .htaccess force for visitors?", "HTTPS, and the www host as the canonical address", ["HTTP only", "The non-www host", "A login page for every visitor"], "Plain HTTP and non-www are redirected.", "Security"),
      q(2, "Which paths does the site refuse to serve?", "/storage/, /admin/inc/, /admin/views/ and vendor/", ["/assets/ and /snippets/", "/index.php and /thank-you.php", "/admin/ and /blog/"], "The database and engine are never served directly.", "Security"),
      q(2, "Should PHP show errors to visitors?", "No: display_errors is off and errors are logged instead", ["Yes, to help reporting", "Only on the home page", "Only for admin users"], "Showing errors leaks details.", "Security"),
      q(3, "What do the .htaccess protections depend on in Apache?", "AllowOverride being enabled", ["mod_php being disabled", "A paid licence", "Cloudflare being switched off"], "Without it the rules are ignored.", "Security"),
      q(3, "The site moves to nginx. What must you do about the .htaccess rules?", "Reproduce them manually, or the database is downloadable", ["Nothing: nginx reads .htaccess", "Delete them", "Move them into config.php"], "nginx ignores .htaccess.", "Security"),
      q(3, "Which kinds of files are denied by the .htaccess file-type rules?", "Source, config and data files such as sqlite, sql, ini, log and md", ["Images and fonts", "HTML pages", "CSS stylesheets"], "They could expose secrets or data.", "Security"),
      q(4, "Why does the HTTPS redirect check X-Forwarded-Proto?", "The site sits behind Cloudflare, and a plain %{HTTPS} check would loop under Flexible SSL", ["Because PHP sets that header", "Because Apache cannot read HTTPS", "Because browsers send it"], "Cloudflare may talk to the origin over HTTP.", "Security"),
      q(4, "Which Cloudflare SSL mode makes it reach the origin over plain HTTP?", "Flexible", ["Full", "Full (strict)", "Off, with no proxy"], "Flexible encrypts only to the visitor.", "Security"),
      q(4, "What HSTS max-age does the file start with, and why?", "86400 seconds, kept short until you are sure nothing is served over plain HTTP", ["31536000 seconds, to be safe", "Zero, because HSTS is risky", "10 seconds for testing"], "Raise to 31536000 later.", "Security"),
      q(5, "What does serving the admin from crm.gglink.co.uk achieve?", "Its session cookie is isolated, so XSS on the marketing pages cannot reach the CRM", ["It makes the admin faster", "It removes the need for a password", "It hides the admin from search engines only"], "Admin sessions are host-scoped.", "Security"),
      q(5, "Which JSON file must stay reachable despite the JSON deny rule?", "manifest.json", ["composer.json", "package.json", "initialData.json"], "The web app manifest needs to be public.", "Security"),
      q(5, "Why does the .htaccess unset the PHP version banner and turn expose_php off?", "To avoid telling attackers which PHP version runs", ["To speed up responses", "To satisfy Cloudflare", "To enable HTTPS"], "Less information, less targeting.", "Security"),
    ],
  },
  {
    title: "Rolling back a bad release",
    body: "Content and data live in the database, not in files, so a bad code deploy is recovered by restoring the previous files and leaving storage/ alone. The database is never restored over live data just to undo a code change, because enquiries and contacts keep arriving between the release and the rollback. Back up storage/gglink.sqlite before every release so there is always a copy to compare against or recover from if the data itself is damaged. Source: gglink/DEPLOY.md.",
    questions: [
      q(2, "Where do the GGLink site's content and data live?", "In the database, not in files", ["In the PHP files", "In the vendor folder", "In Cloudflare"], "storage/gglink.sqlite.", "Rollback"),
      q(3, "A release broke a page. How do you roll back the code?", "Restore the previous files and leave storage/ alone", ["Restore the old database", "Delete storage/ and reinstall", "Re-run composer update"], "Data and code are separate.", "Rollback"),
      q(4, "Which rollback step is wrong?", "Restoring an old storage/gglink.sqlite over the live one", ["Restoring the previous PHP files", "Leaving storage/ untouched", "Re-running deploy-check.php afterwards"], "Enquiries that arrived since would be lost.", "Rollback"),
      q(4, "Why take a database backup before every release?", "So there is a copy to recover from if the data itself is damaged", ["Because PHP requires it", "Because deploy-check.php needs it", "To speed up the upload"], "It is insurance, not part of a code rollback.", "Rollback"),
      q(5, "Two hours after a release, enquiries have arrived and the contact form is broken. What is the right recovery?", "Restore the previous code files, keep storage/ as it is, then re-run deploy-check.php and the contact-form check", ["Restore last night's database backup", "Delete the new enquiries and redeploy", "Switch the site off until Monday"], "The live data is newer than any backup.", "Rollback"),
    ],
  },
  {
    title: "Admin access and sign-in rules",
    body: "The admin deliberately uses plain, well-understood tools: password_hash and password_verify for passwords, a session id regenerated at login, a host-scoped session named gglink_cms with an httponly cookie and SameSite=Lax, and a per-session CSRF token checked with hash_equals on forms. Login attempts are limited to 8 per IP with a 15-minute lockout. When an email is unknown the code still verifies against a dummy hash so timing does not reveal which emails exist. There are two roles, owner and editor; the role column was added after launch, and the last owner cannot be removed or demoted. The first account is created on first run. Source: gglink/admin/inc/auth.php, config constants and views/users.php.",
    questions: [
      q(1, "Which PHP functions does the admin use for passwords?", "password_hash and password_verify", ["md5 and sha1", "crypt with a fixed salt", "base64_encode"], "Deliberately boring and safe.", "Admin"),
      q(2, "How many failed sign-ins per IP before a lockout, and for how long?", "8 attempts, locked out for 15 minutes", ["3 attempts, locked out for a day", "20 attempts, locked out for a minute", "No limit"], "CMS_MAX_ATTEMPTS and CMS_LOCKOUT_MINUTES.", "Admin"),
      q(2, "Which roles exist in the CMS?", "owner and editor", ["admin and guest", "owner, manager and viewer", "root and user"], "Two roles.", "Admin"),
      q(3, "What protects admin forms against cross-site request forgery?", "A per-session CSRF token compared with hash_equals", ["A hidden honeypot field", "Checking the referrer only", "Nothing; the cookie is enough"], "Forms carry a token.", "Admin"),
      q(3, "What happens to the session id when someone signs in?", "It is regenerated", ["It stays the same", "It is copied into the URL", "It is stored in localStorage"], "session_regenerate_id(true).", "Admin"),
      q(3, "Which flags does the admin session cookie use?", "httponly and SameSite=Lax", ["Not httponly and SameSite=None", "Only secure", "No flags"], "Standard hardening.", "Admin"),
      q(4, "Why does login verify against a dummy hash when the email is unknown?", "So timing does not reveal which emails exist", ["To count failed attempts", "To save database queries", "To create a new account"], "Timing side-channel defence.", "Admin"),
      q(4, "Can the last owner account be removed or demoted?", "No: the code refuses it", ["Yes, any owner can do it", "Only from the command line", "Only on Mondays"], "At least one owner must remain.", "Admin"),
      q(5, "The role column was added after launch. How were existing installs handled?", "A patch checks the columns and runs ALTER TABLE, so existing data is kept", ["The database was recreated", "Users were asked to export and import", "The column was added only for new installs"], "Applied as a patch rather than part of CREATE TABLE.", "Admin"),
      q(5, "A support developer needs to give a colleague edit access to blog posts only. Which role fits?", "editor", ["owner", "root", "visitor"], "Owners can manage users; editors cannot.", "Admin"),
    ],
  },
  {
    title: "The CMS database and PHP requirements",
    body: "The CMS keeps everything in storage/gglink.sqlite (the code can also use MySQL). Tables include cms_users, cms_content, cms_posts, cms_enquiries, cms_settings, the CRM tables cms_contacts, cms_deals, cms_activities and cms_campaigns, and a login-attempts table. The SQLite file contains customer enquiries and password hashes, so storage/*.sqlite and its -wal and -shm files are gitignored and must never be committed; it is recreated automatically on first run. Schema changes made after launch are applied as patches that inspect the existing columns first, so existing installs keep their data. The CRM was built for about 100,000 contacts, so every filtered or sorted column is indexed and all lists are paginated server-side. deploy-check.php requires PHP 7.4 or newer, warns that PHP 7.4 is end-of-life (unsupported since November 2022) and should be planned for upgrade, and needs the extensions pdo_sqlite, curl, mbstring, fileinfo, openssl and json. shell_exec is optional: without it the content editor falls back to parsing and image constants may not be editable. Source: gglink/admin/inc/db.php, .gitignore and deploy-check.php.",
    questions: [
      q(1, "Which file holds the GGLink CMS content, blog posts, enquiries and contacts?", "storage/gglink.sqlite", ["config.php", "vendor/autoload.php", "assets/images/uploads"], "The SQLite database.", "Data"),
      q(2, "Which table stores contact-form enquiries?", "cms_enquiries", ["cms_contacts", "cms_posts", "cms_settings"], "Enquiries and contacts are separate tables.", "Data"),
      q(2, "Which tables make up the CRM?", "cms_contacts, cms_deals, cms_activities and cms_campaigns", ["cms_users, cms_posts and cms_content", "cms_enquiries and cms_settings only", "cms_login_attempts only"], "Contacts, deals, activities and nurture campaigns.", "Data"),
      q(3, "Why is the SQLite file never committed to git?", "It contains customer enquiries and password hashes", ["It is too large for git", "git cannot store binary files", "It changes every minute"], "Sensitive data.", "Data"),
      q(3, "What is the minimum PHP version deploy-check.php accepts?", "7.4", ["5.6", "8.3", "9.0"], "Below it fails.", "Data"),
      q(3, "What does deploy-check.php say about PHP 7.4?", "It is end-of-life, so plan the upgrade", ["It is the recommended version", "It is blocked", "It is only for Windows"], "Unsupported since November 2022.", "Data"),
      q(4, "Which PHP extensions does the pre-flight check require?", "pdo_sqlite, curl, mbstring, fileinfo, openssl and json", ["gd, intl and redis", "mysqli and pgsql only", "zip, soap and imap"], "Missing ones are FAIL.", "Data"),
      q(4, "What happens if shell_exec is not available?", "The content editor falls back to parsing and image constants may not be editable", ["The whole site stops", "Enquiries are not saved", "Emails are not sent"], "It is a WARN, not a FAIL.", "Data"),
      q(5, "The CRM was built for about 100,000 contacts. What does that imply for the code?", "Filtered columns are indexed and lists are paginated on the server", ["All contacts are loaded into the page", "Contacts are limited to 200 per list", "Contacts are stored in files"], "A LIMIT-200 list is useless at that scale.", "Data"),
      q(5, "What happens to the database file if it is deleted?", "It is recreated automatically on first run, but the data in it is gone", ["It is restored from git", "The site keeps working with the old data", "Cloudflare restores it"], "The file is never committed, so there is no copy in git.", "Data"),
    ],
  },
  {
    title: "CRM, consent and the pipeline",
    body: "Consent is a first-class field on every contact (consent, consent_date, consent_source). The contacts we may bulk email are those whose consent is consented, soft or legitimate, whose status is not unsubscribed or bounced, and whose email is not empty; a contact with unknown or withdrawn/opted-out consent is not mailable. Deals move through stages with default probabilities: Qualified 25%, Proposal sent 50%, Negotiation 75%, Won 100% and Lost 0%. The weighted pipeline is the sum of value times probability divided by 100. Product interest tags are stored as a comma-wrapped string such as \",crm,ecommerce,\" so LIKE matching is exact and cannot half-match another tag. Nurture sequences keep a send log so nobody is emailed twice. Source: gglink/admin/inc/crm.php and db.php.",
    questions: [
      q(1, "Which deal stage has a default probability of 50%?", "Proposal sent", ["Qualified", "Negotiation", "Won"], "Qualified 25, Proposal 50, Negotiation 75.", "CRM"),
      q(2, "What is the default probability of a Qualified deal?", "25%", ["10%", "50%", "90%"], "The first stage.", "CRM"),
      q(2, "What are the default probabilities of Won and Lost?", "100% and 0%", ["75% and 25%", "100% and 50%", "50% and 0%"], "Closed outcomes.", "CRM"),
      q(3, "Which contacts may be bulk emailed?", "Consent consented, soft or legitimate; status not unsubscribed or bounced; email not empty", ["Everyone with an email address", "Only contacts with consent consented", "Anyone who has ever enquired"], "The mailable clause.", "CRM"),
      q(3, "How is the weighted pipeline value worked out?", "The sum of each deal's value multiplied by its probability divided by 100", ["The sum of deal values", "The number of deals times 25", "The Won deals only"], "SUM(value * probability / 100).", "CRM"),
      q(3, "Where is consent recorded for a contact?", "On the contact itself, with the date and source", ["Only in an email footer", "In the server log", "In the browser"], "Consent is a first-class field.", "CRM"),
      q(4, "A contact's consent is unknown. May they be included in a bulk email?", "No: unknown is not in the mailable list", ["Yes, until they object", "Yes, if the email is valid", "Yes, on weekdays"], "Only consented, soft and legitimate qualify.", "CRM"),
      q(4, "A contact has consent withdrawn or opted out. May they be bulk emailed?", "No", ["Yes, once", "Yes, if they bought before", "Yes, if their status is new"], "They have opted out.", "CRM"),
      q(4, "Why are product tags stored like \",crm,ecommerce,\"?", "So LIKE matching is exact and cannot half-match another tag", ["To save space", "To sort them alphabetically", "Because SQLite requires it"], "Each tag is wrapped in commas.", "CRM"),
      q(5, "What does the send log on nurture sequences prevent?", "Emailing the same person twice", ["Emails going to spam", "Duplicate contacts", "Failed deploys"], "It records who has already received each step.", "CRM"),
      q(5, "A contact is bounced and has consent consented. May they be bulk emailed?", "No: bounced status excludes them", ["Yes, because consent is consented", "Yes, if the email is long", "Yes, if the tag matches"], "Both conditions must hold.", "CRM"),
    ],
  },
  {
    title: "Email, spam protection and the blog feed",
    body: "Enquiry notifications are sent with SendGrid. Verify the whole gglink.co.uk domain in SendGrid rather than a single sender: it sets up SPF and DKIM, which keeps notifications out of spam. SENDGRID_FROM must be a verified sender or mail is rejected. Google reCAPTCHA protects the form; without RECAPTCHA_SECRET spam filtering is not enforced. The site also reads the GGLink blog from the WordPress REST API (BLOG_API_URL) with a 3-second timeout and a 900-second cache of the last good response, so a slow or failing blog never blocks a page render. Source: DEPLOY.md and config.php.",
    questions: [
      q(2, "Which service sends the enquiry notification emails?", "SendGrid", ["Mailchimp", "Gmail SMTP", "Amazon SES"], "Configured in config.local.php.", "Mail"),
      q(3, "What should you verify in SendGrid so notifications stay out of spam?", "The whole domain, which sets up SPF and DKIM", ["A single email address only", "Nothing: SendGrid does it automatically", "The reCAPTCHA key"], "Domain authentication.", "Mail"),
      q(3, "Which service protects the contact form from spam?", "Google reCAPTCHA", ["SendGrid", "Cloudflare Workers", "SQLite"], "Needs RECAPTCHA_SECRET.", "Mail"),
      q(4, "Enquiries are saved but nobody gets the notification email. Which settings do you check first?", "SENDGRID_API_KEY, SENDGRID_FROM being a verified sender, and ENQUIRY_TO", ["BASE_URL and APP_NAME", "RECAPTCHA_SECRET only", "The blog API URL"], "Mail depends on those three.", "Mail"),
      q(4, "Why does the blog feed use a 3-second timeout?", "A slow blog must never block a page render for long", ["Because WordPress needs three seconds to start", "To limit API costs", "Because SendGrid requires it"], "BLOG_API_TIMEOUT.", "Mail"),
      q(5, "How long is the last good blog response reused?", "900 seconds (15 minutes)", ["3 seconds", "24 hours", "It is never cached"], "BLOG_CACHE_TTL.", "Mail"),
      q(5, "The blog is down. What should visitors see on the GGLink site?", "The site still renders; the feed falls back to the last good cached response", ["A fatal error", "A blank site", "A redirect to the admin"], "Resilience by design.", "Mail"),
    ],
  },
  {
    title: "Published prices and results are claims",
    body: "Two master switches, GG_PRICING_LIVE and GG_RESULTS_LIVE in gg-sales-config.php, keep pricing and client results hidden until they are real. They are gated because published prices and published outcomes are claims you can be held to (the CAP Code for advertising and the DMCC Act 2024 for testimonials and anything presented as a customer result), and shipping invented figures would be worse than shipping nothing. Results must be real numbers, anonymised, and something you could evidence if a customer or the ASA asked; delete any you cannot back up. Service-level figures such as response times, uptime and backup retention are only to be published if they can be evidenced and met. In the repository copy of gg-sales-config.php the prices and service levels are TODO placeholders; whether real values have been entered in the live admin was not checked. Either way, this track does not state any price, response time or support commitment, and none should be quoted to a client from it. Source: gglink/gg-sales-config.php.",
    questions: [
      q(2, "Which two switches keep pricing and results hidden on the GGLink site until they are real?", "GG_PRICING_LIVE and GG_RESULTS_LIVE", ["APP_DEBUG and APP_LIVE", "SENDGRID_LIVE and RECAPTCHA_LIVE", "BASE_URL and BASE_URL_ADMIN"], "Both default to false.", "Claims"),
      q(3, "Why must placeholder or invented prices never go live?", "Published prices and outcomes are claims you can be held to", ["They slow the site down", "SendGrid rejects them", "Search engines ban them"], "CAP Code and DMCC Act 2024.", "Claims"),
      q(4, "What must a published client result be?", "A real, anonymised number you could evidence if asked", ["A rounded-up estimate", "A competitor's figure", "A target for next year"], "Delete any you cannot back up.", "Claims"),
      q(4, "A colleague wants to quote a 4-hour response time to a client from the config file. What is the right response?", "Do not: in the config file they are TODO placeholders, not confirmed commitments, and only figures that can be evidenced and met may be quoted", ["Quote it; it is in the file", "Quote it but say approximately", "Quote a 1-hour time to be safe"], "Only publish what can be evidenced and met.", "Claims"),
      q(5, "Which statement about service-level figures such as uptime and backup retention is correct?", "Only publish figures you can evidence and meet", ["Publish ambitious figures to win work", "Publish industry averages", "Publish whatever competitors publish"], "Claims must be substantiated.", "Claims"),
    ],
  },
];

// -------- written answers (graded by Claude against the rubric)
items[0].questions.push(open(6,
  "You must release a code change to the GGLink site. Describe the steps from preparation to confirming it worked.",
  "Run php deploy-check.php before; back up storage/gglink.sqlite (cp to storage/backup-DATE.sqlite); upload everything except .git, node_modules and storage/gglink.sqlite*, including vendor/; never overwrite the database; check permissions (storage and uploads writable only); run deploy-check.php again for zero failures; then verify: the home page loads, the contact form reaches the thank-you page, the enquiry appears under Enquiries, the notification email arrives, and /storage/gglink.sqlite returns 403 or 404.",
  "A good answer includes: deploy-check.php before and after; a database backup before release; the exclusion list (.git, node_modules, storage/gglink.sqlite*); uploading vendor/ because there is no Composer on the server; not overwriting the database; permissions; and the post-deploy checks (home page, contact form to thank-you page, enquiry in admin, notification email, database URL returns 403 or 404). Give credit for each correct step with its reason; mark down any step that overwrites the database or skips the backup.",
  "Release procedure"));
items[1].questions.push(open(6,
  "A client says the GGLink contact form \"does nothing\" since yesterday's release. List the checks you would make, in order, and what each one tells you.",
  "Run deploy-check.php for FAILs. Check config.local.php still has SENDGRID_API_KEY, SENDGRID_FROM (a verified sender) and ENQUIRY_TO. Submit the form yourself: does it reach the thank-you page? Does the enquiry appear under Enquiries in the admin (data saved) and does the notification email arrive (mail)? If saved but no email, suspect SendGrid key or sender; if not saved, suspect permissions on storage/ or an error in the form handler (check logs, not displayed errors). If the release caused it and the cause is not quickly fixed, roll back the code files and leave storage/ alone.",
  "A good answer: starts with deploy-check.php; checks the three mail settings; reproduces the problem by submitting the form; distinguishes saved-but-not-emailed from not-saved; mentions storage/ writable permissions and checking logs (display_errors is off); and, if needed, rolls back code only while leaving storage/ untouched. Credit logical order and the reasoning for each check.",
  "Troubleshooting"));
items[2].questions.push(open(7,
  "While checking a deploy you find that https://www.gglink.co.uk/storage/gglink.sqlite downloads. Explain what it means, what you do immediately, and how you prevent it from recurring.",
  "It means .htaccess is not being honoured (AllowOverride disabled, or the server is nginx without the rules), so the CMS database is publicly downloadable. It contains customer enquiries, contacts and admin password hashes, so treat it as a potential personal data breach. Immediately block access (restore the rules or deny /storage/ at the server level), check access logs for downloads of the file, tell the owner, change the admin passwords and rotate keys if needed, and assess whether the breach must be reported (in the UK a personal data breach likely to risk people's rights must be reported to the ICO within 72 hours). Prevent it by enabling AllowOverride or reproducing the rules in the server config, adding the 403/404 check to every deploy, and running deploy-check.php before and after.",
  "A good answer: identifies .htaccess not honoured / AllowOverride or missing nginx rules; recognises the file contains enquiries, contacts and password hashes; takes immediate containment steps (block the path, check logs, inform the owner, change passwords); mentions assessing breach reporting duties (UK GDPR, 72 hours to the ICO where required); and gives preventive steps (server config, the post-deploy check). Partial credit for fix without breach thinking.",
  "Incident response"));
items[3].questions.push(open(7,
  "Your team wants to move the GGLink site from Apache to nginx. What could go wrong and how do you move it safely?",
  "nginx ignores .htaccess, so the HTTPS and www redirects, the security headers, the blocked paths (/storage/, /admin/inc/, /admin/views/, vendor/) and the denied file types would all stop working and the database could become downloadable. Reproduce every rule in the nginx config first, handle X-Forwarded-Proto behind Cloudflare to avoid a redirect loop, keep display_errors off, copy files without overwriting the database, back up storage/gglink.sqlite, run deploy-check.php, and verify the checklist including that /storage/gglink.sqlite returns 403 or 404, with the ability to roll back to Apache.",
  "A good answer: states that .htaccess rules do not apply on nginx; lists the rules to recreate (HTTPS and www redirects, headers, blocked paths and file types); notes the Cloudflare X-Forwarded-Proto redirect issue; keeps display_errors off; backs up and does not overwrite storage/gglink.sqlite; verifies that /storage/gglink.sqlite is 403 or 404; and has a rollback plan. Credit each correct point.",
  "Hosting changes"));

const lessons = [
  [1, "Meet the GGLink site", ["A PHP site, deployed by copying files, with its data in storage/gglink.sqlite", "Run php deploy-check.php before and after every upload", "Secrets live in config.local.php, never in git", "Enquiries appear under Enquiries in the admin"]],
  [2, "Deploy and first run", ["Upload vendor/ (there is no Composer on the server)", "Never overwrite storage/gglink.sqlite", "First run: create the first admin account", "Pricing, Credentials and Results stay hidden until real"]],
  [3, "Checks and safety nets", ["Back up the database before every release", "/storage/gglink.sqlite must return 403 or 404", "Rollback: restore the previous files, leave storage/ alone", "Mail: verify the whole domain in SendGrid for SPF and DKIM"]],
  [4, "Security and access", ["Everything in .htaccess depends on AllowOverride; nginx needs the rules copied by hand", "Admin: 8 attempts per IP then a 15-minute lockout; owner and editor roles", "Behind Cloudflare, redirects key off X-Forwarded-Proto", "Consent decides who may be bulk emailed"]],
  [5, "Running it with confidence", ["PHP 7.4 minimum and already end-of-life: plan the upgrade", "CRM built for about 100,000 contacts: indexed and paginated", "Prices, results and service levels are claims: publish only what is real", "Treat a downloadable database as a possible data breach"]],
];

const prompts = new Set(), counts = {};
for (const it of items) for (const x of it.questions) {
  if (prompts.has(x.prompt)) throw new Error(`duplicate prompt: ${x.prompt}`);
  prompts.add(x.prompt);
  counts[x.level] = (counts[x.level] ?? 0) + 1;
}
const out = path.resolve("content/gglink");
fs.mkdirSync(out, { recursive: true });
const file = { trackSlug: "gglink-hosting-maintenance", status: "review", lessons: lessons.map(([level, title, syllabus]) => ({ level, title, syllabus })), items };
fs.writeFileSync(path.join(out, "gglink-hosting-maintenance.json"), JSON.stringify(file, null, 1) + "\n");
console.log("gglink-hosting-maintenance", prompts.size, "questions, per level:", JSON.stringify(counts));
