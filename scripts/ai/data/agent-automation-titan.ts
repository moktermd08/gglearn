import type { TrackSpec } from "../types";

const spec: TrackSpec = {
  slug: "agent-automation-titan",
  name: "AI Workflow Automation: Novice to Titan",
  description:
    "Build reliable automations in n8n, Zapier, Make and similar tools: triggers, data mapping, branching, error handling, APIs, AI steps, approvals and governance.",
  roles: "developer,manager,sales",
  groups: {
    trigger: "trigger type",
    flow: "flow-control construct",
    data: "data-handling concept",
    http: "HTTP concept",
    auth: "authentication concept",
    paging: "pagination pattern",
    reliab: "reliability technique",
    platform: "automation platform or deployment model",
    ai: "AI-in-workflow component",
    sched: "scheduling concept",
    ops: "testing or monitoring practice",
    gov: "governance practice",
  },
  cards: [
    // ---------------- trigger ----------------
    {
      group: "trigger", subject: "Webhook trigger", tier: 1,
      says: [
        "starts a run when an external system sends an HTTP request to a URL the workflow exposes",
        "reacts within moments of the event instead of waiting for a check",
        "hands the request body, headers and query string to the first step",
      ],
      use: "need a workflow to react the instant another app posts an event",
      not: ["asks the source system for new records on a fixed timer"],
      like: ["Event subscription trigger"],
    },
    {
      group: "trigger", subject: "Polling trigger", tier: 1,
      says: [
        "asks the source app at intervals whether anything new exists",
        "can only notice an event as late as its check interval allows",
        "must remember what it has already seen so records are not processed twice",
      ],
      use: "work with an app that offers no way to push events to you",
      not: ["receives an instant call from the source app the moment something changes"],
    },
    {
      group: "trigger", subject: "Schedule trigger", tier: 1,
      says: [
        "starts a run at set times defined by an interval or cron expression",
        "needs no event from any outside system to fire",
        "suits recurring jobs such as nightly reports",
      ],
      use: "need a report generated every weekday morning",
      not: ["waits for an incoming HTTP request before starting"],
      like: ["Polling trigger"],
    },
    {
      group: "trigger", subject: "Manual trigger", tier: 1,
      says: [
        "starts a run only when a person clicks a button in the editor or app",
        "is handy for building and testing a workflow step by step",
        "never fires on its own in production",
      ],
      use: "are still prototyping and want to run the flow on demand",
      not: ["keeps the workflow running continuously in the background"],
    },
    {
      group: "trigger", subject: "Event subscription trigger", tier: 2,
      says: [
        "registers a callback with the source app so the app pushes changes to the workflow",
        "often creates and deletes the registration automatically when the workflow is activated",
        "depends on the source app supporting outbound notifications",
      ],
      use: "want push delivery from a SaaS app without hand-building the callback",
      not: ["only works by checking the source app every few minutes"],
      like: ["Webhook trigger"],
    },
    {
      group: "trigger", subject: "Form submission trigger", tier: 2,
      says: [
        "fires when a person submits a hosted or embedded form",
        "turns each answered field into a named value in the workflow data",
        "gives non-technical users a front door into an automation",
      ],
      use: "want colleagues to request a process by filling in a web form",
    },
    {
      group: "trigger", subject: "Email trigger", tier: 2,
      says: [
        "starts a run when a message arrives in a watched mailbox or address",
        "exposes the sender, subject and body as fields for later steps",
        "can pass attachments along as binary files",
      ],
      use: "need to process inbound invoices that arrive as email attachments",
    },
    {
      group: "trigger", subject: "Chat trigger", tier: 3,
      says: [
        "starts a run from a message typed into a chat interface",
        "is the usual entry point for conversational AI agent workflows",
        "carries a session identifier so follow-up messages can share memory",
      ],
      use: "are building a support assistant users talk to",
    },
    {
      group: "trigger", subject: "Sub-workflow trigger", tier: 3,
      says: [
        "lets one workflow be started by another workflow as a callable unit",
        "receives the input items its parent workflow passes in",
        "gives teams reusable logic that is maintained in one place",
      ],
      use: "want one shared enrichment routine called from many workflows",
      like: ["Execute sub-workflow"],
    },

    // ---------------- flow ----------------
    {
      group: "flow", subject: "Filter", tier: 1,
      says: [
        "lets an item continue only if it meets a stated condition",
        "stops the run for items that fail the condition, with no alternate path",
        "keeps workflows from acting on irrelevant records",
      ],
      use: "only want to continue for leads from a certain country",
      not: ["sends non-matching items down a second branch for different handling"],
      like: ["Router", "If branch"],
    },
    {
      group: "flow", subject: "Router", tier: 2,
      says: [
        "splits a run into several routes, each guarded by its own condition",
        "can send one item down more than one route when several conditions match",
        "usually includes a fallback route for items that match nothing",
      ],
      use: "need separate handling for refunds, upgrades and cancellations in one scenario",
      like: ["Filter", "If branch", "Switch"],
    },
    {
      group: "flow", subject: "If branch", tier: 1,
      says: [
        "tests one condition and sends items down a true path or a false path",
        "gives exactly two outcomes per item",
        "is the simplest way to do something different for each side of a yes or no test",
      ],
      use: "want a yes or no decision with a separate branch for each answer",
      like: ["Filter", "Router", "Switch"],
    },
    {
      group: "flow", subject: "Switch", tier: 3,
      says: [
        "compares one value against several cases and sends the item to the matching output",
        "scales better than a chain of nested true or false checks",
        "can offer a default output when no case matches",
      ],
      use: "need to route by a status field that has many possible values",
      like: ["Router", "If branch"],
    },
    {
      group: "flow", subject: "Loop", tier: 2,
      says: [
        "repeats a set of steps once for each element or batch of elements",
        "is how a workflow works through a long list one chunk at a time",
        "needs an exit condition or an end of the list so it terminates",
      ],
      use: "must call an API once for every row in a spreadsheet",
      like: ["Iterator"],
    },
    {
      group: "flow", subject: "Iterator", tier: 3,
      says: [
        "turns one array inside a single item into many separate items",
        "lets later steps process each array element on its own",
        "is the usual first half of the split-then-recombine pattern",
      ],
      use: "receive one order containing a line-items array and need each line processed separately",
      like: ["Loop", "Aggregator"],
    },
    {
      group: "flow", subject: "Aggregator", tier: 3,
      says: [
        "combines many separate items back into a single item or array",
        "is the usual second half of the split-then-recombine pattern",
        "lets you send one summary message instead of one message per record",
      ],
      use: "want one digest email built from fifty individual results",
      like: ["Iterator", "Merge"],
    },
    {
      group: "flow", subject: "Merge", tier: 3,
      says: [
        "joins the outputs of two branches into one stream",
        "can match items from the two inputs by a shared key field",
        "is needed when a later step depends on data from both branches",
      ],
      use: "need to combine customer details from one lookup with order data from another",
      like: ["Aggregator"],
    },
    {
      group: "flow", subject: "Wait step", tier: 2,
      says: [
        "pauses a run for a set time or until a specific moment",
        "can resume when an outside call hits a resume URL",
        "lets an automation delay a follow-up message by days without staying in the editor",
      ],
      use: "need to send a reminder three days after a signup",
    },
    {
      group: "flow", subject: "Execute sub-workflow", tier: 3,
      says: [
        "calls another saved workflow from inside a running workflow and waits for its result",
        "keeps large automations modular by moving repeated logic into one place",
        "returns the output of the called workflow to the caller",
      ],
      use: "want to avoid copying the same ten steps into every workflow",
      like: ["Sub-workflow trigger"],
    },
    {
      group: "flow", subject: "Error branch", tier: 3,
      says: [
        "routes a failed step onto a dedicated path instead of stopping the whole run",
        "lets the workflow log, notify or compensate when one step breaks",
        "is chosen per step, so some failures can still halt the run",
      ],
      use: "want a failed CRM update to log the problem and carry on with the rest of the batch",
    },
    {
      group: "flow", subject: "Parallel branches", tier: 4,
      says: [
        "run independent paths of a workflow at the same time",
        "shorten total run time when the paths do not depend on each other",
        "must be recombined carefully because their results arrive in no guaranteed order",
      ],
      use: "need to call three unrelated enrichment APIs without waiting on each other",
    },

    // ---------------- data ----------------
    {
      group: "data", subject: "JSON", tier: 1,
      says: [
        "is a text format built from key-value objects and ordered arrays",
        "is the common data format that APIs and automation steps pass around",
        "has strings, numbers, booleans, null, arrays and objects as its only value types",
      ],
      not: ["supports comments and date values natively"],
      like: ["Payload"],
    },
    {
      group: "data", subject: "Data mapping", tier: 1,
      says: [
        "connects fields from earlier steps to the inputs a later step expects",
        "is how a customer name from one app ends up in the right field of another",
        "breaks when the source field is renamed or comes back empty",
      ],
      use: "need to copy the email from a form into a CRM contact field",
      like: ["Expression"],
    },
    {
      group: "data", subject: "Expression", tier: 2,
      says: [
        "computes a field value at run time from data or functions instead of fixing it by hand",
        "is written inside special delimiters in a field, such as double curly braces",
        "can reference output from any earlier step",
      ],
      use: "want a field to be built from the first name and last name of previous data",
      like: ["Data mapping"],
    },
    {
      group: "data", subject: "Payload", tier: 2,
      says: [
        "is the body of data carried by a request or event",
        "differs from the headers, which describe the request rather than hold the business data",
        "is what a webhook trigger passes to the first step",
      ],
      like: ["JSON"],
    },
    {
      group: "data", subject: "Item", tier: 2,
      says: [
        "is one unit of data flowing through a workflow, such as a single record",
        "is the thing a step usually runs once per, so ten items mean ten executions",
        "can hold nested fields and attached binary files",
      ],
      like: ["Bundle"],
    },
    {
      group: "data", subject: "Bundle", tier: 3,
      says: [
        "is the term some visual platforms use for one record travelling between modules",
        "causes the next module to run once for each one produced by an iterator",
        "holds the collection of fields a module outputs",
      ],
      like: ["Item"],
    },
    {
      group: "data", subject: "Type coercion", tier: 3,
      says: [
        "converts a value from one type to another, such as the text 42 to the number 42",
        "silently turns an expected number into text when an API returns quoted values",
        "causes surprising comparison results if the types are not made consistent first",
      ],
      use: "find that a filter on amount greater than 100 behaves oddly because the amount arrives as text",
    },
    {
      group: "data", subject: "Null versus missing field", tier: 4,
      says: [
        "are different states: one means the key is present with no value and the other means the key is absent",
        "can both make a mapped value empty, yet they are tested differently",
        "should be handled with a default value before a required step uses them",
      ],
      use: "see intermittent errors when an optional field is sometimes not sent",
    },
    {
      group: "data", subject: "Binary data", tier: 3,
      says: [
        "carries files such as PDFs and images through a workflow separately from the JSON fields",
        "is usually referenced by a property name on the item that holds the file",
        "needs a specific upload or download step to move in and out of the workflow",
      ],
      use: "must download an invoice PDF and upload it to cloud storage",
    },
    {
      group: "data", subject: "Date and time zone handling", tier: 3,
      says: [
        "is a frequent source of off-by-hours bugs when systems store local rather than universal time",
        "works best by storing and passing timestamps in ISO 8601 with an explicit offset",
        "needs conversion to the user's zone only at the moment of display",
      ],
      use: "see meetings created an hour early after clocks change",
    },
    {
      group: "data", subject: "Code step", tier: 3,
      says: [
        "runs a short custom script for logic that built-in steps cannot express",
        "receives data from earlier steps and returns new items to later steps",
        "should stay small, because heavy logic there is harder to review and test than visual steps",
      ],
      use: "need a custom calculation that no ready-made step offers",
    },
    {
      group: "data", subject: "Schema validation", tier: 4,
      says: [
        "checks that incoming data has the required fields and types before processing continues",
        "rejects malformed payloads early instead of letting them corrupt downstream systems",
        "turns silent bad data into an explicit, loggable error",
      ],
      use: "must stop unexpected webhook shapes before they reach your database",
    },

    // ---------------- http ----------------
    {
      group: "http", subject: "REST API", tier: 1,
      says: [
        "exposes resources at URLs and acts on them using standard HTTP methods",
        "treats each request as self-contained with no server-side session memory required",
        "usually exchanges JSON bodies",
      ],
      not: ["requires the client to keep an open connection between requests"],
    },
    {
      group: "http", subject: "GET request", tier: 1,
      says: [
        "retrieves a resource without changing it on the server",
        "carries its filters in the URL query string rather than in a body",
        "is considered safe to repeat because it should not cause side effects",
      ],
      use: "want to read a customer record without altering it",
      not: ["is meant for creating new records"],
      like: ["POST request"],
    },
    {
      group: "http", subject: "POST request", tier: 1,
      says: [
        "sends data to the server, commonly to create a new resource",
        "carries its data in the request body",
        "can create a duplicate if the same call is sent twice, since it is not guaranteed to be idempotent",
      ],
      use: "need to create a new ticket in a help desk",
      like: ["GET request"],
    },
    {
      group: "http", subject: "PUT request", tier: 3,
      says: [
        "replaces the whole resource at a URL with the data supplied",
        "leaves any field you omit cleared or defaulted in typical designs",
        "gives the same end state when the identical call is repeated",
      ],
      use: "want to overwrite an entire record with a full new version",
      like: ["PATCH request", "DELETE request"],
    },
    {
      group: "http", subject: "PATCH request", tier: 3,
      says: [
        "changes only the fields you send and leaves the rest of the resource alone",
        "is the right fit for updating a single property of a large record",
        "sends a partial representation rather than the full object",
      ],
      use: "need to update just the status of an order",
      like: ["PUT request"],
    },
    {
      group: "http", subject: "DELETE request", tier: 2,
      says: [
        "asks the server to remove the resource at a URL",
        "usually answers not found on a repeat once the resource is gone, yet leaves the same end state",
        "typically carries no body",
      ],
      like: ["PUT request"],
    },
    {
      group: "http", subject: "Status code 401", tier: 2,
      says: [
        "means the request lacks valid authentication credentials",
        "usually points to a missing, expired or wrong token",
        "is fixed by supplying or refreshing proper credentials",
      ],
      use: "see unauthorized responses because the access token expired",
      like: ["Status code 403"],
    },
    {
      group: "http", subject: "Status code 403", tier: 2,
      says: [
        "means the server knows who you are but refuses the action",
        "points to missing permissions or scopes rather than missing credentials",
        "is not fixed by simply retrying the same request",
      ],
      use: "are authenticated yet the API says you may not delete that record",
      like: ["Status code 401"],
    },
    {
      group: "http", subject: "Status code 404", tier: 2,
      says: [
        "means the requested resource or URL was not found",
        "often comes from a wrong ID or a mistyped path",
        "is a client-side error, not a sign the server crashed",
      ],
      like: ["Status code 500"],
    },
    {
      group: "http", subject: "Status code 429", tier: 3,
      says: [
        "means too many requests were sent in a window of time",
        "often arrives with a header telling the client how long to wait",
        "calls for slowing down and retrying later rather than hammering the API",
      ],
      use: "see an API reject a burst of loop calls for sending them too fast",
    },
    {
      group: "http", subject: "Status code 500", tier: 3,
      says: [
        "signals an unexpected failure on the server's side",
        "is often transient, so a delayed retry can succeed",
        "does not by itself mean the request you sent was malformed",
      ],
      use: "see a vendor API fail with an internal error that may clear on its own",
      like: ["Status code 404"],
    },
    {
      group: "http", subject: "Request headers", tier: 2,
      says: [
        "carry metadata such as content type, authorization and custom keys alongside a request",
        "tell the server how to read the body through a content type value",
        "are where bearer tokens and API keys are often placed",
      ],
    },

    // ---------------- auth ----------------
    {
      group: "auth", subject: "API key", tier: 1,
      says: [
        "is a static secret string that identifies the calling application",
        "is commonly sent in a header or query parameter",
        "grants whatever access its owner configured until it is revoked or rotated",
      ],
      not: ["expires automatically after a few minutes"],
      like: ["Bearer token"],
    },
    {
      group: "auth", subject: "Bearer token", tier: 2,
      says: [
        "grants access to whoever presents it, so it must be kept confidential",
        "travels in an Authorization header after the word Bearer",
        "often has a limited lifetime, unlike a long-lived static key",
      ],
      like: ["API key", "OAuth 2.0"],
    },
    {
      group: "auth", subject: "OAuth 2.0", tier: 2,
      says: [
        "lets a user authorise an app to act on their account without giving it their password",
        "issues limited access tokens for approved scopes",
        "is the authorization flow behind most Connect your account buttons",
      ],
      use: "need a workflow to read a user's calendar after they grant consent",
      like: ["Bearer token"],
    },
    {
      group: "auth", subject: "Basic authentication", tier: 3,
      says: [
        "sends a username and password encoded as base64 in the Authorization header",
        "offers no protection unless the connection itself is encrypted with TLS",
        "is simple but exposes the real credentials on every request",
      ],
      not: ["encrypts the username and password so they cannot be read from the header"],
    },
    {
      group: "auth", subject: "Refresh token", tier: 3,
      says: [
        "is exchanged for a new access token when the old one expires",
        "lets a connection keep working without the user logging in again",
        "must be stored more carefully than a short-lived access token because it lasts longer",
      ],
      use: "want an OAuth connection to survive past the one-hour access token lifetime",
    },
    {
      group: "auth", subject: "Scope", tier: 3,
      says: [
        "limits what an access token is allowed to do, such as read-only calendar access",
        "is requested during consent and enforced by the API",
        "supports least privilege when only the needed ones are requested",
      ],
      use: "want a token that can read contacts but not delete them",
    },
    {
      group: "auth", subject: "HMAC signature", tier: 4,
      says: [
        "is computed from the payload and a shared secret so a receiver can verify the sender",
        "lets a webhook receiver detect forged or tampered requests",
        "must be checked against the raw request body, since reformatting it changes the result",
      ],
      use: "must prove an incoming webhook really came from the vendor",
      not: ["hides the content of the payload from anyone who intercepts it"],
    },
    {
      group: "auth", subject: "Credential store", tier: 2,
      says: [
        "keeps secrets encrypted in the platform and lets steps reference them by name",
        "means workflow definitions can be shared or exported without containing raw secrets",
        "centralises rotation so a changed key is updated in one place",
      ],
      use: "want to avoid pasting an API key directly into twenty workflows",
    },

    // ---------------- paging ----------------
    {
      group: "paging", subject: "Offset pagination", tier: 3,
      says: [
        "asks for records by skipping a stated number and taking a stated number",
        "can return duplicates or miss rows when data is inserted between page requests",
        "is simple but becomes slow on very deep pages in large tables",
      ],
      use: "meet an API with offset and limit parameters",
      like: ["Page number pagination"],
    },
    {
      group: "paging", subject: "Page number pagination", tier: 2,
      says: [
        "requests results with a page index and a page size",
        "ends when a page comes back empty or shorter than the requested size",
        "is offset pagination in friendlier terms",
      ],
      like: ["Offset pagination"],
    },
    {
      group: "paging", subject: "Cursor pagination", tier: 3,
      says: [
        "returns an opaque marker with each page that points to where the next page begins",
        "stays consistent when new records arrive while you are paging",
        "must be followed in order, since a cursor cannot be computed by the client",
      ],
      use: "need stable paging through a feed that changes constantly",
      not: ["lets you jump straight to page 50 by arithmetic"],
    },
    {
      group: "paging", subject: "Link header pagination", tier: 4,
      says: [
        "places next and previous page URLs in a response header",
        "lets the client follow the provided next URL without building one itself",
        "is finished when the response no longer offers a next link",
      ],
    },
    {
      group: "paging", subject: "Time-window pagination", tier: 4,
      says: [
        "pulls records between timestamps and then advances the window",
        "needs a persisted last-seen time so a restart resumes where it stopped",
        "risks missing records that arrive late with an older timestamp unless windows overlap",
      ],
      use: "sync only records changed since the previous run",
    },
    {
      group: "paging", subject: "Batch size", tier: 3,
      says: [
        "sets how many records one request or loop pass handles",
        "trades fewer calls against bigger payloads and slower retries after a failure",
        "should respect the maximum the target API accepts per call",
      ],
      use: "want to bulk-insert rows without exceeding what the API allows per request",
    },

    // ---------------- reliab ----------------
    {
      group: "reliab", subject: "Retry", tier: 1,
      says: [
        "runs a failed step again in the hope that a temporary fault has cleared",
        "suits timeouts, rate limits and server errors that tend to be transient",
        "is wasted on permanent errors such as invalid credentials or bad input",
      ],
      use: "face an occasional network timeout on an otherwise healthy API",
      not: ["fixes a request that is rejected because its data is invalid"],
      like: ["Exponential backoff"],
    },
    {
      group: "reliab", subject: "Exponential backoff", tier: 3,
      says: [
        "increases the wait between retries, often doubling it each time",
        "gives a struggling service room to recover",
        "usually stops at a maximum number of attempts or a maximum delay",
      ],
      use: "need retries that ease off instead of pounding an overloaded API",
      like: ["Retry", "Jitter"],
    },
    {
      group: "reliab", subject: "Jitter", tier: 4,
      says: [
        "adds a random amount to each retry delay",
        "stops many failing clients from retrying at exactly the same instant",
        "prevents synchronised retry waves from knocking a recovering service over again",
      ],
      use: "have many workflows that all retry at once after a shared outage",
      like: ["Exponential backoff"],
    },
    {
      group: "reliab", subject: "Idempotency key", tier: 4,
      says: [
        "is a unique value sent with a request so the server recognises a repeat of the same operation",
        "makes a retried create call return the original result instead of making a duplicate",
        "must be generated once per logical operation and reused on each retry",
      ],
      use: "must retry a payment-creating POST without charging twice",
      not: ["is regenerated fresh on every retry attempt"],
      like: ["Deduplication"],
    },
    {
      group: "reliab", subject: "Deduplication", tier: 3,
      says: [
        "drops items whose unique ID has already been processed",
        "protects against triggers that deliver the same event more than once",
        "needs a store of seen IDs that survives between runs",
      ],
      use: "find the same webhook event arrives twice and creates two records",
      like: ["Idempotency key"],
    },
    {
      group: "reliab", subject: "Error workflow", tier: 3,
      says: [
        "is a separate workflow that runs whenever another workflow fails",
        "receives details of the failed execution so it can alert someone",
        "centralises failure handling for many workflows",
      ],
      use: "want every production failure posted to one team channel",
      like: ["Error branch"],
    },
    {
      group: "reliab", subject: "Dead-letter queue", tier: 4,
      says: [
        "holds items that failed every retry so they can be inspected and replayed later",
        "keeps one bad record from blocking the rest of the stream",
        "turns silent data loss into a reviewable backlog",
      ],
      use: "need a place to park records that keep failing after all retries",
    },
    {
      group: "reliab", subject: "Timeout", tier: 2,
      says: [
        "sets how long a step waits for a response before giving up",
        "prevents a stalled external call from holding a run forever",
        "should be paired with a retry or fallback so giving up is handled",
      ],
      use: "see runs hang because a remote server never answers",
    },
    {
      group: "reliab", subject: "Rate limiting", tier: 2,
      says: [
        "is a cap an API enforces on how many calls a client may make in a time period",
        "triggers rejections for callers who go over the cap",
        "is respected in workflows by throttling loops or adding waits",
      ],
      like: ["Throttling"],
    },
    {
      group: "reliab", subject: "Throttling", tier: 3,
      says: [
        "deliberately slows your own workflow's call rate to stay under a limit",
        "can be done with a wait between iterations or a concurrency cap",
        "avoids errors up front instead of recovering from them afterwards",
      ],
      use: "must process thousands of rows against an API that allows a few calls per second",
      like: ["Rate limiting"],
    },
    {
      group: "reliab", subject: "Circuit breaker", tier: 5,
      says: [
        "stops calling a failing dependency for a cooling-off period once failures cross a threshold",
        "fails fast instead of piling more requests onto a broken service",
        "lets a trial request through later to test whether the dependency has recovered",
      ],
      use: "want to stop hammering a vendor that has been down for ten minutes",
    },
    {
      group: "reliab", subject: "Checkpointing", tier: 5,
      says: [
        "saves progress markers so a long job can resume from the last completed point",
        "avoids repeating work after a crash or restart",
        "needs the stored position to be updated only after the batch is safely processed",
      ],
      use: "run a multi-hour import that must pick up where it stopped after an interruption",
    },

    // ---------------- platform ----------------
    {
      group: "platform", subject: "n8n", tier: 1,
      says: [
        "is a node-based workflow tool that can be self-hosted as well as run in a managed cloud",
        "lets a Code node run JavaScript or Python inside a workflow",
        "uses a canvas where each node is a step connected by lines",
      ],
      like: ["Zapier", "Make"],
    },
    {
      group: "platform", subject: "Zapier", tier: 1,
      says: [
        "calls its automations Zaps, each made of a trigger followed by actions",
        "is a hosted service aimed at quick no-code connections between many apps",
        "offers Paths and Filters for conditional logic inside a Zap",
      ],
      like: ["n8n", "Make"],
    },
    {
      group: "platform", subject: "Make", tier: 1,
      says: [
        "calls its automations scenarios, built from modules on a visual canvas",
        "uses routers, iterators and aggregators to split and recombine data",
        "shows the bundles flowing out of each module for debugging",
      ],
      like: ["n8n", "Zapier"],
    },
    {
      group: "platform", subject: "Self-hosting", tier: 2,
      says: [
        "means you run the automation platform on your own infrastructure",
        "keeps data inside your network, but makes you responsible for updates, backups and uptime",
        "is chosen when data residency or internal-network access matters",
      ],
      use: "must keep customer data inside your own servers",
      not: ["removes the need to apply security patches"],
      like: ["Managed cloud hosting"],
    },
    {
      group: "platform", subject: "Managed cloud hosting", tier: 2,
      says: [
        "means the vendor runs the platform, updates it and handles scaling",
        "lets a team start building within minutes with no servers to maintain",
        "usually bills by usage and so ties cost to how many tasks run",
      ],
      use: "want zero infrastructure work for a small team",
      like: ["Self-hosting"],
    },
    {
      group: "platform", subject: "Workflow template", tier: 1,
      says: [
        "is a prebuilt workflow you copy and adapt instead of starting from scratch",
        "still needs your own credentials and field mapping after import",
        "should be reviewed step by step before activation, because you inherit its design choices",
      ],
      use: "want a quick start for a common automation like Slack alerts from forms",
    },
    {
      group: "platform", subject: "Queue mode", tier: 5,
      says: [
        "separates the process that receives triggers from worker processes that execute runs",
        "lets a self-hosted platform scale executions across several workers",
        "relies on a shared message broker and database to coordinate runs",
      ],
      use: "must handle heavy execution volume on a self-hosted instance",
    },
    {
      group: "platform", subject: "Custom node or app connector", tier: 4,
      says: [
        "wraps an API that has no ready-made integration into a reusable step",
        "hides the raw HTTP details behind named fields for other builders",
        "needs maintenance when the underlying API changes",
      ],
      use: "need to call an internal company API from many workflows in a consistent way",
    },
    {
      group: "platform", subject: "HTTP request step", tier: 2,
      says: [
        "calls any REST endpoint when no ready-made integration exists",
        "lets you set the method, URL, headers, query parameters and body yourself",
        "is the escape hatch for apps a platform does not support natively",
      ],
      use: "need to hit an API that has no ready-made integration",
    },

    // ---------------- ai ----------------
    {
      group: "ai", subject: "LLM step", tier: 1,
      says: [
        "sends a prompt to a language model and returns the generated text",
        "performs one model call with no tool use or looping on its own",
        "produces output that can vary from run to run",
      ],
      use: "need to summarise an inbound email in a single model call",
      like: ["AI agent step"],
    },
    {
      group: "ai", subject: "AI agent step", tier: 2,
      says: [
        "lets a model decide which attached tools to call and in what order to reach a goal",
        "loops between model reasoning and tool results until it produces a final answer",
        "is less predictable than a fixed chain of steps",
      ],
      use: "want the model to pick between searching a knowledge base and looking up an order",
      not: ["follows the same fixed sequence of steps on every run"],
      like: ["LLM step"],
    },
    {
      group: "ai", subject: "Tool calling", tier: 2,
      says: [
        "lets a model request that a defined function or step be run with arguments it supplies",
        "returns the tool's result to the model so it can continue",
        "depends on clear tool names and descriptions for the model to choose correctly",
      ],
      use: "want a model to fetch live data instead of guessing",
    },
    {
      group: "ai", subject: "Structured output", tier: 3,
      says: [
        "constrains a model reply to a defined JSON shape",
        "makes model results safe to map into later steps",
        "should still be validated before use, because a reply can be wrong even when well-formed",
      ],
      use: "need the model to return fields a CRM step can map directly",
      not: ["guarantees that every value in the reply is factually correct"],
    },
    {
      group: "ai", subject: "Prompt template", tier: 2,
      says: [
        "is a reusable prompt with placeholders filled from workflow data at run time",
        "keeps instructions constant while the inserted record changes",
        "should keep fixed instructions apart from untrusted inserted text",
      ],
    },
    {
      group: "ai", subject: "Conversation memory", tier: 3,
      says: [
        "stores earlier messages so an agent can refer back to them in later turns",
        "is keyed by a session identifier so different users do not share history",
        "adds to the number of tokens sent with each call as it grows",
      ],
      use: "need a chatbot that remembers what the user said two messages ago",
    },
    {
      group: "ai", subject: "Vector store lookup", tier: 3,
      says: [
        "finds stored text chunks whose embeddings are closest to the question",
        "is how a workflow retrieves context for a retrieval-augmented answer",
        "returns passages that are then placed into the model prompt",
      ],
      use: "want a model to answer from your own documents",
    },
    {
      group: "ai", subject: "Classification step", tier: 2,
      says: [
        "uses a model to assign each input to one label from a fixed list",
        "feeds a router or switch that handles each category differently",
        "works best when the allowed labels are listed explicitly in the prompt",
      ],
      use: "need to sort support emails into billing, bug or feature request",
    },
    {
      group: "ai", subject: "Human approval step", tier: 2,
      says: [
        "pauses a run until a person approves or rejects a proposed action",
        "guards high-impact steps such as sending money or messaging customers",
        "resumes the workflow with the decision as data",
      ],
      use: "want a person to confirm an AI-drafted refund before it is sent",
      not: ["lets the workflow carry on automatically if nobody responds"],
    },
    {
      group: "ai", subject: "Confidence threshold", tier: 4,
      says: [
        "is a cutoff score below which an AI result is sent to a person instead of acted on",
        "lets routine cases flow through automatically while uncertain ones are reviewed",
        "needs tuning against real examples because model self-reported scores are only a rough signal",
      ],
      use: "want only low-certainty classifications reviewed by staff",
    },
    {
      group: "ai", subject: "Output guardrail check", tier: 4,
      says: [
        "inspects a model's reply for format, policy or safety problems before it moves on",
        "can block or reroute a reply that fails a rule",
        "is a separate step placed between the model and any action that has consequences",
      ],
      use: "need to stop a drafted reply that contains an internal-only link",
    },
    {
      group: "ai", subject: "Token budget", tier: 4,
      says: [
        "limits how much text a model call may consume, in both input and output",
        "is exceeded when long documents or growing memory are pasted into prompts unchecked",
        "can be managed by chunking, summarising or trimming context first",
      ],
      use: "see AI steps fail because a long document exceeds the model's input limit",
    },

    // ---------------- sched ----------------
    {
      group: "sched", subject: "Cron expression", tier: 2,
      says: [
        "defines a repeating schedule with space-separated time fields",
        "reads minute, hour, day of month, month and day of week in the standard five-field form",
        "uses a slash to mean every nth unit, as in star slash 15 for every fifteen",
      ],
      use: "need a precise schedule like weekdays at 09:00",
    },
    {
      group: "sched", subject: "Interval schedule", tier: 1,
      says: [
        "runs a workflow every fixed span such as every ten minutes",
        "is simpler to configure than a cron expression for regular repetition",
        "counts from when the workflow was activated rather than a clock time",
      ],
      like: ["Cron expression"],
    },
    {
      group: "sched", subject: "Schedule time zone", tier: 3,
      says: [
        "decides which clock a schedule's hours refer to",
        "defaults to a workspace or server setting that may differ from where the team sits",
        "should be set explicitly so a nine o'clock job fires at the intended local nine",
      ],
      use: "see a morning report arrive at the wrong local hour",
    },
    {
      group: "sched", subject: "Daylight saving shift", tier: 4,
      says: [
        "makes a local-time schedule skip or repeat an hour on clock-change days",
        "is avoided by scheduling in UTC when exact spacing matters",
        "can run a job twice or not at all if the target time falls in the changed hour",
      ],
      use: "need a job that must not double-fire when clocks go back",
    },
    {
      group: "sched", subject: "Overlapping runs", tier: 4,
      says: [
        "occur when a new scheduled run starts while the previous one is still executing",
        "can double-process records unless a lock or concurrency limit is applied",
        "become likelier as data volume grows and runs get longer",
      ],
      use: "see two copies of a slow job working on the same rows",
    },
    {
      group: "sched", subject: "Missed run handling", tier: 5,
      says: [
        "decides what happens to schedule slots that passed while the platform was down",
        "may skip them silently on platforms that do not backfill",
        "is solved by a last-processed marker that lets the next run catch up",
      ],
      use: "must not lose a day of data after a self-hosted server restart",
    },

    // ---------------- ops ----------------
    {
      group: "ops", subject: "Execution history", tier: 1,
      says: [
        "records each past run with the data that went in and out of every step",
        "is the first place to look when a workflow misbehaves",
        "may expose sensitive data, so retention settings matter",
      ],
      use: "need to see exactly what a failed run received",
    },
    {
      group: "ops", subject: "Pinned test data", tier: 2,
      says: [
        "freezes a sample step output so the editor can reuse it without calling the source again",
        "lets you build and test downstream steps repeatedly with the same input",
        "must be removed or refreshed so it never masks real-world data changes",
      ],
      use: "want to test mapping without triggering the real event each time",
    },
    {
      group: "ops", subject: "Sandbox environment", tier: 3,
      says: [
        "is a safe copy of connected systems where a workflow can run without touching real data",
        "uses test credentials and dummy records",
        "catches harmful mistakes before the workflow is promoted to production",
      ],
      use: "want to try a delete-heavy workflow without risking live customer records",
      like: ["Staging promotion"],
    },
    {
      group: "ops", subject: "Staging promotion", tier: 4,
      says: [
        "moves a workflow from a test environment to production through a deliberate release step",
        "swaps test credentials and URLs for production ones as part of the move",
        "gives reviewers a chance to approve changes before they go live",
      ],
      like: ["Sandbox environment"],
    },
    {
      group: "ops", subject: "Failure alerting", tier: 2,
      says: [
        "notifies a person or channel when a run fails",
        "turns hidden failures into issues someone can act on",
        "works best when each alert names the workflow, the step and the error",
      ],
      use: "want to learn about a broken automation before customers do",
    },
    {
      group: "ops", subject: "Run metrics", tier: 3,
      says: [
        "track counts of runs, failures and durations over time",
        "reveal trends such as a slowly rising error rate that individual alerts miss",
        "show when a workflow quietly stops getting triggered",
      ],
      use: "need to notice that a normally busy workflow ran zero times today",
    },
    {
      group: "ops", subject: "Structured logging", tier: 4,
      says: [
        "records consistent fields such as workflow name, record ID and outcome for each action",
        "makes it practical to search logs for everything that happened to one record",
        "must avoid writing secrets or personal data into log lines",
      ],
      use: "must trace what happened to order 4812 across three workflows",
    },
    {
      group: "ops", subject: "Replay of failed runs", tier: 3,
      says: [
        "re-runs a failed execution using its saved input data",
        "is safe only when the steps are idempotent or already deduplicated",
        "lets teams recover from a temporary outage without asking the source to resend",
      ],
      use: "need to recover failed runs after a vendor outage ended",
    },
    {
      group: "ops", subject: "Heartbeat check", tier: 5,
      says: [
        "pings an external monitor each time a job completes successfully",
        "raises an alarm if the expected ping does not arrive on time",
        "detects workflows that died silently, which failure alerts inside the platform cannot report",
      ],
      use: "want to be warned when the scheduler itself stops running",
    },

    // ---------------- gov ----------------
    {
      group: "gov", subject: "Least-privilege credentials", tier: 2,
      says: [
        "give a workflow only the permissions its job actually needs",
        "limit the damage if a workflow or its token is compromised",
        "mean a read-only report should not run on a key that can delete data",
      ],
      use: "are setting up access for a workflow that only reads contacts",
    },
    {
      group: "gov", subject: "Workflow ownership", tier: 2,
      says: [
        "names a responsible person or team for each production automation",
        "avoids orphaned workflows nobody can fix when they break",
        "should survive staff changes, so it points to a team rather than a single leaver",
      ],
      use: "need someone to contact when a workflow starts failing at midnight",
    },
    {
      group: "gov", subject: "Audit log", tier: 3,
      says: [
        "records who changed or ran which workflow and when",
        "supports investigation after an incident or compliance review",
        "should be protected from edits by the people it records",
      ],
      use: "must show an auditor who modified a payment workflow",
    },
    {
      group: "gov", subject: "Change review", tier: 3,
      says: [
        "requires a second person to check a workflow edit before it reaches production",
        "catches mapping mistakes and risky steps that the author overlooked",
        "is most valuable for workflows that touch money, customers or personal data",
      ],
      use: "want a peer to approve edits to a billing workflow",
    },
    {
      group: "gov", subject: "Naming and documentation conventions", tier: 1,
      says: [
        "give workflows and steps meaningful names that describe their purpose",
        "help the next builder understand a flow without reverse engineering it",
        "include a short note on purpose, trigger, owner and dependencies",
      ],
    },
    {
      group: "gov", subject: "Data minimisation", tier: 3,
      says: [
        "means passing only the fields a step actually needs",
        "reduces the personal data stored in logs and third-party tools",
        "lowers exposure if any connected service is breached",
      ],
      use: "want to avoid sending a whole customer record to a vendor that needs only an email",
    },
    {
      group: "gov", subject: "Shadow automation", tier: 4,
      says: [
        "describes workflows built outside IT's visibility, often with personal accounts",
        "creates risk because data flows and credentials go unreviewed",
        "is reduced by offering an approved platform and a simple request path",
      ],
      use: "find a team has wired company data to a personal account on a free plan",
    },
    {
      group: "gov", subject: "Kill switch", tier: 4,
      says: [
        "is a quick way to disable a workflow or class of workflows during an incident",
        "limits harm when an automation is sending wrong data at scale",
        "should be documented and tested before it is needed",
      ],
      use: "need to halt a runaway workflow that is emailing customers by mistake",
    },
    {
      group: "gov", subject: "Secrets rotation", tier: 4,
      says: [
        "replaces credentials with fresh ones on a regular schedule or after exposure",
        "limits how long a leaked secret stays useful",
        "is simpler when workflows reference a central credential store rather than hard-coded values",
      ],
      use: "suspect an API key was pasted into a public chat",
    },
    {
      group: "gov", subject: "Human-in-the-loop policy", tier: 5,
      says: [
        "defines which automated actions need human sign-off by their impact and reversibility",
        "typically requires approval for irreversible or customer-facing actions",
        "lets low-risk, easily undone steps run unattended",
      ],
      use: "need a rule on when an AI-driven workflow may act without a person",
    },
  ],
  qa: [
    {
      q: "Which cron expression runs a schedule at 09:00 on weekdays?",
      right: "0 9 * * 1-5",
      wrong: ["9 0 * * 1-5", "0 9 1-5 * *", "0 9 * * 5"],
      tier: 3, topic: "Scheduling",
      why: "Fields are minute, hour, day of month, month, day of week; 1-5 in the last field means Monday to Friday.",
    },
    {
      q: "What does this schedule do?",
      code: "*/15 * * * *",
      right: "Runs every 15 minutes",
      wrong: ["Runs once at 15 minutes past midnight", "Runs at 15 seconds past every minute", "Runs every 15 hours"],
      tier: 2, topic: "Scheduling",
      why: "A slash in the minute field means every 15th minute; all other fields are wildcards.",
    },
    {
      q: "When does this cron expression run?",
      code: "0 0 1 * *",
      right: "At midnight on the first day of every month",
      wrong: ["At midnight every day", "At one o'clock every morning", "At midnight on every Monday"],
      tier: 3, topic: "Scheduling",
      why: "Minute 0, hour 0, day of month 1, any month, any weekday.",
    },
    {
      q: "In an n8n expression, how do you read the email field of the current item's JSON?",
      code: "{{ $json.email }}",
      right: "The expression returns the value of the email key from the current item",
      wrong: ["It prints the literal text $json.email", "It returns every item in the workflow", "It is a comment and returns nothing"],
      tier: 2, topic: "Data mapping",
      why: "Double curly braces mark an expression, and $json refers to the current item's JSON data.",
    },
    {
      q: "In an n8n Code node, what must the script return for later nodes to receive two items?",
      code: "const items = $input.all();\nreturn items.map(i => ({ json: { id: i.json.id } }));",
      right: "An array of objects, each with a json property",
      wrong: ["A single string of comma-separated ids", "A single object with an items array inside", "Nothing; the node forwards its input automatically"],
      tier: 3, topic: "Code step",
      why: "The Code node outputs an array of item objects, each holding its data under json.",
    },
    {
      q: "What does this curl command do?",
      code: "curl -X POST https://api.example.com/tickets \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"title\":\"Printer down\"}'",
      right: "Sends a JSON body to create a ticket",
      wrong: ["Fetches the ticket list without changing anything", "Deletes the ticket called Printer down", "Uploads a file named tickets"],
      tier: 2, topic: "HTTP",
      why: "POST with a JSON content type and a body is the standard way to create a resource.",
    },
    {
      q: "Why does this request return 401?",
      code: "curl https://api.example.com/me",
      right: "No Authorization header or key was sent",
      wrong: ["The GET method is not allowed on any API", "The server only accepts PUT requests", "The URL needs a trailing .json to work"],
      tier: 2, topic: "Authentication",
      why: "401 means missing or invalid credentials, and this call includes none.",
    },
    {
      q: "Which header carries a bearer token?",
      code: "curl -H \"Authorization: Bearer abc123\" https://api.example.com/items",
      right: "Authorization, with the word Bearer before the token",
      wrong: ["Content-Type, with the token as the value", "Accept, with the token after a colon", "Host, with the token appended to the domain"],
      tier: 2, topic: "Authentication",
      why: "Bearer tokens are sent in the Authorization header.",
    },
    {
      q: "A webhook receiver gets the same event ID twice. What is the safest design?",
      right: "Store processed event IDs and skip any ID already seen",
      wrong: ["Process both and hope the target system ignores duplicates", "Reject all events after the first of the day", "Delay every event by an hour and process only the latest"],
      tier: 3, topic: "Reliability",
      why: "Deduplication on a stable event ID makes delivery that is at-least-once behave like exactly-once.",
    },
    {
      q: "A step calls an API that returns 429 with a header saying wait 30 seconds. What is the best response?",
      right: "Wait at least that long, then retry",
      wrong: ["Retry immediately with a bigger batch", "Mark the item permanently failed", "Switch the method from GET to POST"],
      tier: 3, topic: "Reliability",
      why: "429 means you are sending too fast; honour the wait hint before retrying.",
    },
    {
      q: "Which delay sequence best shows exponential backoff with a base of 2 seconds?",
      right: "2s, 4s, 8s, 16s",
      wrong: ["2s, 2s, 2s, 2s", "2s, 3s, 4s, 5s", "16s, 8s, 4s, 2s"],
      tier: 3, topic: "Reliability",
      why: "Exponential backoff multiplies the wait each attempt, here by two.",
    },
    {
      q: "What is wrong with this retry logic for a POST that creates an invoice?",
      code: "for (let i = 0; i < 3; i++) {\n  try { return await post('/invoices', body); } catch (e) {}\n}",
      right: "A timeout after the server created the invoice leads to duplicate invoices on retry",
      wrong: ["POST requests can never be retried", "The loop runs one time too many", "Catching errors always stops the request from being sent"],
      tier: 4, topic: "Reliability",
      why: "Without an idempotency key, retrying a non-idempotent create can make duplicates.",
    },
    {
      q: "You must retry safely. Which request header pattern helps the server de-duplicate?",
      code: "POST /payments\nIdempotency-Key: 7f3c-91ab",
      right: "Reuse the same key value on every retry of this one payment",
      wrong: ["Send a new random key on each retry", "Omit the key on retries so it looks like a new call", "Put the payment amount in the key and change it on retry"],
      tier: 4, topic: "Reliability",
      why: "The server recognises the repeated key and returns the original outcome.",
    },
    {
      q: "A workflow fetches 10,000 rows through an API that returns 100 per page plus a next_cursor value. What is the correct loop?",
      right: "Request a page, then pass the returned next_cursor into the next request until no cursor comes back",
      wrong: ["Request page 1 repeatedly until the data changes", "Multiply the cursor by 100 for each new page", "Request all 10,000 at once with limit=10000 regardless of API caps"],
      tier: 3, topic: "Pagination",
      why: "Cursors are opaque and must be followed in sequence until exhausted.",
    },
    {
      q: "What does this pagination request fetch?",
      code: "GET /contacts?limit=50&offset=100",
      right: "50 contacts, starting after the first 100",
      wrong: ["Contacts number 50 to 100", "100 contacts, starting after the first 50", "Only contacts whose id equals 100"],
      tier: 3, topic: "Pagination",
      why: "Offset skips records and limit sets how many to take.",
    },
    {
      q: "A user submits this JSON array to a loop that processes one element at a time. How many iterations run?",
      code: "[{\"id\":1},{\"id\":2},{\"id\":3}]",
      right: "Three",
      wrong: ["One", "Two", "Zero, because arrays cannot be looped"],
      tier: 1, topic: "Flow control",
      why: "A loop runs once per element and the array holds three.",
    },
    {
      q: "A router has three routes: amount over 1000, amount over 100, and a fallback. An item with amount 5000 matches both conditions. In platforms that follow all matching routes, what happens?",
      right: "It travels down both matching routes",
      wrong: ["Only the first route runs and the second is deleted", "The run stops with an error", "It goes to the fallback route only"],
      tier: 4, topic: "Flow control",
      why: "Routers that evaluate every route can send one item down several branches, so make conditions exclusive when needed.",
    },
    {
      q: "A filter before a Slack message checks status equals urgent. What happens to an item with status normal?",
      right: "It stops at the filter and no message is sent",
      wrong: ["It is sent to Slack with a warning", "It loops back to the trigger", "It is sent to a hidden second branch"],
      tier: 1, topic: "Flow control",
      why: "A filter has no alternate path, so non-matching items simply end there.",
    },
    {
      q: "What does this JSON-parsing expression return when the key is absent?",
      code: "const total = data.order.total ?? 0;",
      right: "0 when total is null or undefined, otherwise the real value",
      wrong: ["Always 0", "An error whenever total is absent", "The string 'total'"],
      tier: 3, topic: "Data handling",
      why: "The nullish coalescing operator supplies a default only when the left side is null or undefined.",
    },
    {
      q: "A filter says amount > 100 but a record with amount \"250\" is rejected. What is the likely cause?",
      right: "The amount is text, not a number, so the comparison type is wrong",
      wrong: ["250 is not larger than 100", "Filters never accept numeric comparisons", "The record was already processed yesterday"],
      tier: 3, topic: "Data handling",
      why: "Quoted values are strings; convert to a number before comparing.",
    },
    {
      q: "What does this JavaScript produce?",
      code: "const rows = [{n:'A', q:2}, {n:'B', q:3}];\nconst total = rows.reduce((s, r) => s + r.q, 0);",
      right: "5",
      wrong: ["23", "6", "[2, 3]"],
      tier: 2, topic: "Code step",
      why: "reduce sums the q values starting from zero: 2 + 3.",
    },
    {
      q: "Which JSON is valid?",
      right: "{\"name\": \"Ada\", \"tags\": [\"a\", \"b\"]}",
      wrong: ["{name: 'Ada', tags: ['a', 'b']}", "{\"name\": \"Ada\", \"tags\": [\"a\", \"b\"],}", "{\"name\": \"Ada\" // user, \"tags\": []}"],
      tier: 2, topic: "Data handling",
      why: "JSON needs double-quoted keys and strings, no trailing commas and no comments.",
    },
    {
      q: "How should a webhook handler verify a signature?",
      code: "const expected = hmacSha256(secret, rawBody);\nconst ok = timingSafeEqual(expected, headerSignature);",
      right: "Compute the HMAC over the raw request body and compare it with the header in constant time",
      wrong: ["Hash only the URL and compare with ==", "Parse the JSON and re-serialise it before hashing", "Trust any request that contains the header name"],
      tier: 5, topic: "Authentication",
      why: "Re-serialising can change bytes, and a constant-time comparison avoids timing leaks.",
    },
    {
      q: "A workflow returns 200 immediately and does the real work later. Why do some teams build webhook handlers this way?",
      right: "The sender may time out and resend if the response is slow",
      wrong: ["200 is required to make the payload encrypted", "It makes the data deduplicate itself", "Webhooks cannot respond after processing"],
      tier: 4, topic: "Triggers",
      why: "Senders often retry on slow responses, so acknowledge quickly and process asynchronously.",
    },
    {
      q: "Your n8n webhook works with the Test URL but nothing happens when the vendor calls the same address. What is the likely fix?",
      right: "Give the vendor the Production URL and activate the workflow",
      wrong: ["Change the method from POST to GET", "Delete the credentials", "Add an Aggregator before the trigger"],
      tier: 3, topic: "Triggers",
      why: "The test endpoint only listens while you are executing in the editor; the production endpoint needs the workflow active.",
    },
    {
      q: "Which design stops an AI agent from emailing a customer a wrong refund promise?",
      right: "Have the agent draft the message and require human approval before the send step",
      wrong: ["Raise the model temperature so replies vary", "Let the agent send, then audit weekly", "Give the agent admin credentials so errors can be reversed"],
      tier: 4, topic: "AI steps",
      why: "An approval gate before an irreversible customer-facing action contains the risk.",
    },
    {
      q: "An AI classification step must return one of three labels. Which prompt design is most reliable?",
      right: "List the exact allowed labels, ask for only the label, and validate the reply against the list",
      wrong: ["Ask the model to be creative with the label names", "Ask for a paragraph and search it for words", "Give no labels and trust the model to guess the schema"],
      tier: 3, topic: "AI steps",
      why: "Constraining and then validating output keeps downstream routing predictable.",
    },
    {
      q: "A structured-output step returns this. What should happen next before a CRM update?",
      code: "{\"priority\": \"urgent-ish\", \"score\": 0.8}",
      right: "Validate that priority is one of the allowed values, since a well-formed reply can still be invalid",
      wrong: ["Pass it straight to the CRM because JSON is always valid data", "Delete the score and keep priority as written", "Convert the whole object to a number"],
      tier: 4, topic: "AI steps",
      why: "Valid JSON does not mean valid values; check against an enum.",
    },
    {
      q: "A text from a customer email is inserted into a prompt template. What is the best protection against it containing instructions to the model?",
      right: "Keep fixed instructions separate from the inserted text, treat the text as data and limit what tools the step can use",
      wrong: ["Put the email above the instructions and trust it", "Remove all punctuation from the email", "Raise the token limit"],
      tier: 4, topic: "AI steps",
      why: "Untrusted text can carry injected instructions, so contain it and limit permissions.",
    },
    {
      q: "A scheduled sync takes longer than its 10-minute interval. What problem can occur?",
      right: "Runs overlap and may process the same records twice",
      wrong: ["The schedule automatically cancels itself", "The cron expression is converted to UTC", "Items are encrypted twice"],
      tier: 4, topic: "Scheduling",
      why: "Overlapping runs need a lock or concurrency limit.",
    },
    {
      q: "Which approach lets a sync step resume after an outage without double-processing?",
      right: "Store the last successfully processed timestamp or ID and read from it next run",
      wrong: ["Start from the beginning every run", "Use the current clock time as the start point each run", "Skip records while the workflow is inactive"],
      tier: 4, topic: "Reliability",
      why: "A persisted high-water mark records exactly how far processing got.",
    },
    {
      q: "You use an HTTP request step to update only a customer's phone number. Which method fits best?",
      right: "PATCH with only the phone field",
      wrong: ["PUT with only the phone field, expecting other fields to be kept", "GET with the phone in the query string", "DELETE then POST"],
      tier: 3, topic: "HTTP",
      why: "PATCH sends a partial update; PUT usually replaces the whole resource.",
    },
    {
      q: "What does HTTP 404 on GET /orders/9999 most likely mean?",
      right: "No order with that id exists at that URL",
      wrong: ["The server crashed", "The token has expired", "You exceeded the rate limit"],
      tier: 1, topic: "HTTP",
      why: "404 is a not-found client error.",
    },
    {
      q: "A user is logged in but gets 403 when deleting a record. What should you check?",
      right: "Whether the account or token has permission or scope for deletion",
      wrong: ["Whether the JSON has a trailing comma", "Whether the clock is in UTC", "Whether the API key has been refreshed in the last minute"],
      tier: 3, topic: "Authentication",
      why: "403 means authenticated but not authorised.",
    },
    {
      q: "Which statement about storing an API key in a workflow is best practice?",
      right: "Keep it in the platform's credential store and reference it by name",
      wrong: ["Paste it into a Set node so it is easy to find", "Put it in the workflow name", "Email it to the team to share"],
      tier: 2, topic: "Governance",
      why: "A credential store encrypts secrets and keeps them out of exported workflows.",
    },
    {
      q: "Where does the bug appear in this loop?",
      code: "for (const lead of leads) {\n  await createContact(lead);\n}\n// 5000 leads, API allows 5 calls per second",
      right: "Calls are sent as fast as possible and will hit the rate limit without a delay or throttle",
      wrong: ["for loops cannot await", "The leads array is mutated", "createContact must be called once, outside the loop"],
      tier: 3, topic: "Reliability",
      why: "Without pacing, a fast loop exceeds the allowed rate.",
    },
    {
      q: "A scenario aggregates 200 results into one array before an email step. How many emails does it send?",
      right: "One",
      wrong: ["200", "Two", "None, because aggregators block messages"],
      tier: 2, topic: "Flow control",
      why: "The aggregator converts many items into a single item, so the next step runs once.",
    },
    {
      q: "A sub-workflow is edited to rename an output field. What risk does this create?",
      right: "Every parent workflow that maps the old field name may break",
      wrong: ["The sub-workflow will no longer be callable", "The parent workflows are automatically re-mapped", "No risk, since names are cosmetic"],
      tier: 4, topic: "Flow control",
      why: "Shared units are contracts; changing their output affects every caller.",
    },
    {
      q: "A workflow's failed step is configured to continue on error. What must you do to avoid hiding problems?",
      right: "Send failures to an error branch or log them so they are visible",
      wrong: ["Nothing; failures are logged automatically in every case", "Disable the trigger", "Remove the retry setting"],
      tier: 3, topic: "Reliability",
      why: "Continuing past an error without handling it makes silent failures.",
    },
    {
      q: "Why choose a self-hosted deployment for a workflow that handles patient-adjacent data?",
      right: "Data can stay inside your own infrastructure, though you must run security and backups yourself",
      wrong: ["It removes all compliance duties", "The vendor then takes responsibility for patching", "It guarantees the workflows never fail"],
      tier: 3, topic: "Platforms",
      why: "Self-hosting gives data control but also operational responsibility.",
    },
    {
      q: "What does this expression return in a Make-style mapping if the order has no coupon?",
      code: "{{ifempty(1.coupon; \"none\")}}",
      right: "The text none",
      wrong: ["An error", "An empty string", "The number 1"],
      tier: 4, topic: "Data mapping",
      why: "ifempty supplies the second argument when the first value is empty.",
    },
    {
      q: "What should an error-notification message include to be useful?",
      right: "Workflow name, failing step, error message and a link to the execution",
      wrong: ["Only the word failed", "The full credentials used", "A copy of every customer record the run processed"],
      tier: 2, topic: "Monitoring",
      why: "Context lets responders act fast, and sensitive data should not be broadcast.",
    },
    {
      q: "You test a new workflow that deletes rows. What is the safest first step?",
      right: "Run it against a sandbox copy with dummy data",
      wrong: ["Run it on production and watch carefully", "Activate it and fix errors as users report them", "Disable the error workflow"],
      tier: 2, topic: "Testing",
      why: "Destructive logic should be proven away from real data.",
    },
    {
      q: "A job runs daily at 02:30 local time. What risk exists on the spring day when clocks jump from 02:00 to 03:00?",
      right: "That time does not exist that day, so the run may be skipped or shifted",
      wrong: ["The job runs twice", "The job runs at 02:30 in UTC regardless", "The cron field becomes invalid forever"],
      tier: 5, topic: "Scheduling",
      why: "Local times inside the skipped hour do not occur on that day; scheduling in UTC avoids this.",
    },
    {
      q: "After a vendor outage, 400 runs failed. Replay is available. What must be true before replaying them?",
      right: "The steps are idempotent or de-duplicated, so a replay does not create duplicate side effects",
      wrong: ["The platform must be restarted first", "The original trigger must be renamed", "All credentials must be deleted"],
      tier: 4, topic: "Reliability",
      why: "Replay re-executes side effects; without idempotency it can duplicate them.",
    },
  ],
  calc: [],
};
export default spec;
