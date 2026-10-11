import type { TrackSpec } from "../types";

const spec: TrackSpec = {
  slug: "api-copilot-titan",
  name: "Microsoft Copilot & GitHub Copilot: Novice to Titan",
  description: "Microsoft 365 Copilot (grounding, permissions, Copilot Studio agents), Windows and Edge Copilot, GitHub Copilot (completions, chat, agent mode, instructions, review, CLI, enterprise controls), Azure OpenAI basics and responsible-use controls.",
  roles: "developer,manager",
  groups: {
    m365: "Microsoft 365 Copilot concept",
    m365app: "Copilot feature in a Microsoft 365 app",
    studio: "agent-building concept",
    winedge: "Windows or Edge Copilot feature",
    ghfeat: "GitHub Copilot feature",
    ghctx: "Copilot context mechanism",
    ghcmd: "Copilot chat command",
    ghadmin: "GitHub Copilot admin control",
    azure: "Azure OpenAI Service concept",
    resp: "responsible-use control",
    prompt: "prompting practice",
  },
  cards: [
    // ---------------- Microsoft 365 Copilot concepts ----------------
    {
      group: "m365", subject: "Microsoft 365 Copilot", tier: 1,
      says: [
        "combines a large language model with your work content and Microsoft 365 apps",
        "helps draft, summarize and analyze content inside apps such as Word and Outlook",
        "answers using data the signed-in user is allowed to see",
      ],
      use: "want AI help grounded in your own emails, files and meetings",
      like: ["Copilot Chat"],
    },
    {
      group: "m365", subject: "Copilot Chat", tier: 1,
      says: [
        "is a chat experience for asking questions and getting answers grounded in the web",
        "applies enterprise data protection to prompts for users signed in with a work account",
      ],
      use: "want a secure general chat assistant for work without pulling in organizational files",
      like: ["Microsoft 365 Copilot"],
    },
    {
      group: "m365", subject: "Microsoft Graph", tier: 2,
      says: [
        "is the API surface through which Microsoft 365 data such as mail, files, chats and calendars is reached",
        "supplies the organizational content that Copilot retrieves to ground its answers",
      ],
      use: "need to know where Copilot's work data comes from",
      like: ["The semantic index"],
    },
    {
      group: "m365", subject: "Grounding", tier: 2,
      says: [
        "adds relevant retrieved content to the prompt before the model answers",
        "makes answers specific to your organization instead of only general knowledge",
      ],
      not: ["permanently trains the underlying model on your files"],
    },
    {
      group: "m365", subject: "Permission trimming", tier: 2,
      says: [
        "limits what Copilot can retrieve to content the asking user already has access to",
        "means Copilot does not create new access to files",
      ],
      use: "worry that Copilot will reveal files a user could not otherwise open",
      like: ["Oversharing"],
    },
    {
      group: "m365", subject: "Oversharing", tier: 3,
      says: [
        "happens when files are shared more broadly than intended, so Copilot can surface them to more people",
        "is addressed by reviewing site and file permissions before a wide Copilot rollout",
      ],
      use: "prepare a tenant where old broadly shared files could leak into Copilot answers",
      not: ["is a flaw in Copilot that bypasses permissions"],
      like: ["Permission trimming"],
    },
    {
      group: "m365", subject: "The semantic index", tier: 4,
      says: [
        "helps Copilot find conceptually relevant content in a tenant rather than only exact keyword matches",
        "is built over content users already have access to",
      ],
      like: ["Microsoft Graph"],
    },
    {
      group: "m365", subject: "The Copilot orchestrator", tier: 4,
      says: [
        "coordinates the steps between a user prompt, retrieval of context and the model call",
        "also runs checks and formatting on the response before the user sees it",
      ],
    },
    {
      group: "m365", subject: "Web grounding", tier: 3,
      says: [
        "lets Copilot draw on public web search results in addition to work data",
        "can be allowed or restricted by administrators",
      ],
      use: "need answers that include current public information",
    },
    {
      group: "m365", subject: "A Copilot citation", tier: 2,
      says: [
        "points to the file, email or web page an answer is based on",
        "lets the user open the source and check the claim",
      ],
      use: "want to verify where a Copilot answer came from",
    },
    {
      group: "m365", subject: "A sensitivity label", tier: 4,
      says: [
        "carries classification and protection settings that Copilot respects when using labeled content",
        "is applied through Microsoft Purview",
      ],
      use: "need Copilot to honor confidentiality classification on documents",
      like: ["Oversharing"],
    },
    {
      group: "m365", subject: "The tenant data commitment", tier: 3,
      says: [
        "means prompts, responses and data accessed through Graph are not used to train the underlying foundation models",
        "keeps Copilot processing within the Microsoft 365 service boundary",
      ],
      not: ["lets other organizations' users see your prompts"],
    },

    // ---------------- Copilot in Microsoft 365 apps ----------------
    {
      group: "m365app", subject: "Copilot in Word", tier: 1,
      says: [
        "drafts and rewrites document text from a prompt",
        "can summarize a long document or adjust its tone",
        "can pull in content from other files you reference",
      ],
      use: "need a first draft of a report inside a document",
    },
    {
      group: "m365app", subject: "Copilot in Excel", tier: 2,
      says: [
        "helps explain data, suggest formulas and highlight trends in a workbook",
        "works best when the data is organized as a formatted table",
      ],
      use: "need help analyzing a table of numbers with natural language",
    },
    {
      group: "m365app", subject: "Copilot in PowerPoint", tier: 2,
      says: [
        "creates a slide deck from a prompt or from an existing document",
        "can restyle or summarize slides in a presentation",
      ],
      use: "want a presentation generated from a Word document",
    },
    {
      group: "m365app", subject: "Copilot in Outlook", tier: 2,
      says: [
        "drafts replies and summarizes long email threads",
        "can coach on the tone and clarity of a draft message",
      ],
      use: "need to catch up on a long email thread before replying",
    },
    {
      group: "m365app", subject: "Copilot in Teams", tier: 2,
      says: [
        "summarizes meetings and chats, including action items",
        "can answer questions about what was discussed in a meeting",
      ],
      use: "missed a meeting and want the decisions and action items",
    },
    {
      group: "m365app", subject: "Copilot in OneNote", tier: 3,
      says: [
        "summarizes notes and can generate lists or plans from them",
        "helps organize unstructured notes into action items",
      ],
      use: "need a task list drawn from scattered meeting notes",
    },

    // ---------------- Copilot Studio / agents ----------------
    {
      group: "studio", subject: "Copilot Studio", tier: 2,
      says: [
        "is a low-code tool for building and managing custom agents",
        "lets makers add knowledge sources, topics and tools to an agent",
        "publishes agents to channels such as Teams or a website",
      ],
      use: "want a business team to build its own agent with little code",
    },
    {
      group: "studio", subject: "An agent", tier: 1,
      says: [
        "is an AI assistant configured with instructions, knowledge and tools for a purpose",
        "can take actions through connected tools, not only answer questions",
      ],
      like: ["A declarative agent"],
    },
    {
      group: "studio", subject: "A topic", tier: 2,
      says: [
        "is a conversation flow that handles one kind of user request",
        "can ask questions, branch on answers and call tools",
      ],
      use: "need a scripted conversation path for a specific scenario",
    },
    {
      group: "studio", subject: "Generative orchestration", tier: 3,
      says: [
        "lets the model choose which topics, tools and knowledge to use for a request",
        "replaces reliance on fixed trigger phrases alone",
      ],
      use: "want the agent to plan which tool to call from the user's request",
      like: ["A topic"],
    },
    {
      group: "studio", subject: "A knowledge source", tier: 2,
      says: [
        "gives an agent content such as websites or SharePoint files to answer from",
        "enables generative answers grounded in that content",
      ],
      use: "need an agent to answer from company documents",
    },
    {
      group: "studio", subject: "An agent tool", tier: 3,
      says: [
        "lets an agent do something such as call a connector, flow or API",
        "gives the agent capabilities beyond conversation",
      ],
      use: "need an agent to create a ticket or look up an order",
      like: ["A knowledge source"],
    },
    {
      group: "studio", subject: "A connector", tier: 3,
      says: [
        "wraps an external service so agents and flows can call it",
        "is available through the Power Platform",
      ],
      like: ["An agent tool"],
    },
    {
      group: "studio", subject: "A declarative agent", tier: 3,
      says: [
        "customizes Microsoft 365 Copilot through instructions, knowledge and actions defined in a manifest",
        "runs on the Copilot orchestrator rather than bringing its own",
      ],
      use: "want a focused Copilot persona limited to chosen knowledge",
      like: ["An agent"],
    },
    {
      group: "studio", subject: "An agent trigger", tier: 4,
      says: [
        "starts an autonomous agent run when an event occurs, such as a new email",
        "lets an agent act without a user typing a message",
      ],
      use: "want an agent to react automatically to an incoming event",
    },
    {
      group: "studio", subject: "A data policy", tier: 4,
      says: [
        "controls which connectors can be combined or used within a Power Platform environment",
        "helps prevent business data from flowing to unapproved services",
      ],
      use: "need admins to restrict which connectors makers can use",
    },

    // ---------------- Windows and Edge ----------------
    {
      group: "winedge", subject: "The Copilot app on Windows", tier: 1,
      says: [
        "is a standalone app for chatting with Copilot on a Windows PC",
        "can be signed in with a personal or work account",
      ],
      like: ["Copilot in Edge"],
    },
    {
      group: "winedge", subject: "Copilot in Edge", tier: 1,
      says: [
        "is an assistant in the Edge browser that can summarize and discuss web pages",
        "can use the page you are viewing as context when you allow it",
      ],
      use: "want a summary of the web page you are reading",
      like: ["The Copilot app on Windows"],
    },
    {
      group: "winedge", subject: "Copilot Vision", tier: 3,
      says: [
        "lets Copilot see what is on your screen or page to help",
        "works only after the user chooses to share",
      ],
      not: ["watches the screen continuously without consent"],
    },
    {
      group: "winedge", subject: "Enterprise data protection", tier: 3,
      says: [
        "covers prompts and responses of users signed in with a work or school account",
        "keeps that data from being used to train foundation models",
      ],
      use: "need a work-safe Copilot chat for employees",
    },
    {
      group: "winedge", subject: "Microsoft Entra ID sign-in", tier: 2,
      says: [
        "identifies the user with a work or school account",
        "is what turns on organizational protections and controls in Copilot",
      ],
      like: ["Enterprise data protection"],
    },
    {
      group: "winedge", subject: "The Copilot key", tier: 2,
      says: [
        "is a dedicated key on some Windows keyboards that launches Copilot",
        "gives one-press access to the assistant",
      ],
    },

    // ---------------- GitHub Copilot features ----------------
    {
      group: "ghfeat", subject: "Inline code completion", tier: 1,
      says: [
        "suggests code as ghost text while you type in the editor",
        "is accepted by pressing Tab",
        "can complete a function from a descriptive comment or name",
      ],
      use: "want line-by-line and block suggestions as you type",
      like: ["Next edit suggestion"],
    },
    {
      group: "ghfeat", subject: "Copilot Chat", tier: 1,
      says: [
        "answers coding questions in natural language in the IDE and on GitHub",
        "can explain code, suggest fixes and write tests on request",
      ],
      use: "want to ask questions about code in a conversation",
      like: ["Agent mode"],
    },
    {
      group: "ghfeat", subject: "Inline chat", tier: 2,
      says: [
        "opens a prompt box directly in the editor at the selected code",
        "applies the requested change in place for you to review",
      ],
      use: "want a small targeted edit on selected code without opening the chat panel",
      like: ["Copilot Chat"],
    },
    {
      group: "ghfeat", subject: "Agent mode", tier: 3,
      says: [
        "lets Copilot decide which files to edit and which terminal commands to run in your IDE",
        "iterates on errors, such as failing builds or tests, to finish the task",
        "asks for approval before running terminal commands",
      ],
      use: "want Copilot to carry out a multi-step change across many files",
      not: ["only suggests code and never edits files"],
      like: ["Edit mode"],
    },
    {
      group: "ghfeat", subject: "Edit mode", tier: 3,
      says: [
        "applies changes across files you explicitly add to the request",
        "keeps the developer in control of exactly which files are touched",
      ],
      use: "want multi-file edits limited to files you choose",
      like: ["Agent mode"],
    },
    {
      group: "ghfeat", subject: "The Copilot coding agent", tier: 3,
      says: [
        "works asynchronously on a task assigned to it, such as a GitHub issue",
        "opens a pull request with its changes for human review",
        "runs in a GitHub-hosted environment rather than on your laptop",
      ],
      use: "want to delegate a well-scoped issue and review the resulting pull request",
      not: ["merges its own pull requests without human review"],
      like: ["Agent mode"],
    },
    {
      group: "ghfeat", subject: "Copilot code review", tier: 3,
      says: [
        "can be requested as a reviewer on a pull request",
        "leaves comments and suggested changes on the diff",
      ],
      use: "want an automated first-pass review on a pull request",
      not: ["replaces the need for human reviewers"],
    },
    {
      group: "ghfeat", subject: "Copilot CLI", tier: 3,
      says: [
        "brings Copilot chat and agent behavior to the terminal",
        "can propose and run commands after you approve them",
      ],
      use: "want Copilot help from the command line",
      like: ["Agent mode"],
    },
    {
      group: "ghfeat", subject: "Pull request summarization", tier: 2,
      says: [
        "drafts a description of what a pull request changes",
        "saves time writing the description field",
      ],
    },
    {
      group: "ghfeat", subject: "Commit message generation", tier: 2,
      says: [
        "proposes a commit message from the staged changes",
        "is triggered from the source control view in supported editors",
      ],
    },
    {
      group: "ghfeat", subject: "Next edit suggestion", tier: 4,
      says: [
        "predicts where the developer will edit next and what change to make",
        "goes beyond completing text at the cursor",
      ],
      like: ["Inline code completion"],
    },
    {
      group: "ghfeat", subject: "The model picker", tier: 3,
      says: [
        "lets a user choose among the models their plan and organization allow",
        "can change the quality, speed and style of chat responses",
      ],
    },
    {
      group: "ghfeat", subject: "Copilot on GitHub.com", tier: 2,
      says: [
        "answers questions about repositories, issues and pull requests in the browser",
        "works with the repository context you open it from",
      ],
    },
    {
      group: "ghfeat", subject: "An MCP server", tier: 5,
      says: [
        "extends agent mode with tools exposed through the Model Context Protocol",
        "must be trusted because its tools can act on your behalf",
      ],
      use: "need the agent to reach an external system through a standard protocol",
    },

    // ---------------- context mechanisms ----------------
    {
      group: "ghctx", subject: "The copilot-instructions.md file", tier: 2,
      says: [
        "lives at .github/copilot-instructions.md in a repository",
        "supplies repository-wide custom instructions in plain Markdown",
        "is added automatically to Copilot's context for requests in that repository",
      ],
      use: "want every Copilot request in a repo to follow the same coding conventions",
      like: ["A path-specific instruction file"],
    },
    {
      group: "ghctx", subject: "A path-specific instruction file", tier: 3,
      says: [
        "uses the .instructions.md extension in .github/instructions",
        "names the files it applies to with an applyTo glob in front matter",
      ],
      use: "need rules that only apply to certain folders or file types",
      like: ["The copilot-instructions.md file"],
    },
    {
      group: "ghctx", subject: "A prompt file", tier: 3,
      says: [
        "is a reusable prompt saved as a .prompt.md file",
        "is run on demand from the chat input",
      ],
      use: "want a reusable task prompt the team can invoke on demand",
      like: ["The copilot-instructions.md file"],
    },
    {
      group: "ghctx", subject: "AGENTS.md", tier: 4,
      says: [
        "is a repository file of instructions aimed at AI coding agents",
        "can be read by Copilot's agent features as project guidance",
      ],
      like: ["The copilot-instructions.md file"],
    },
    {
      group: "ghctx", subject: "The #file variable", tier: 2,
      says: [
        "attaches a specific file to a chat request as context",
        "makes the answer rely on that file's actual contents",
      ],
      use: "want an answer based on one particular file",
      like: ["The #codebase variable"],
    },
    {
      group: "ghctx", subject: "The #codebase variable", tier: 3,
      says: [
        "lets Copilot search the workspace for relevant code itself",
        "suits questions where you do not know which files matter",
      ],
      use: "want Copilot to find relevant code across the whole project",
      like: ["The #file variable"],
    },
    {
      group: "ghctx", subject: "Open-tab context", tier: 2,
      says: [
        "serves as nearby context for inline completions",
        "improves suggestions that need to match code in neighboring files",
      ],
    },
    {
      group: "ghctx", subject: "Content exclusion", tier: 4,
      says: [
        "lets administrators name files or paths that Copilot should not use",
        "does not cover every Copilot feature, so its documented limitations should be checked",
      ],
      use: "need Copilot to ignore a folder containing sensitive code",
      like: ["Public code matching"],
    },
    {
      group: "ghctx", subject: "The context window limit", tier: 4,
      says: [
        "caps how much text Copilot can consider in one request",
        "makes focused file references more reliable than dumping a whole repository",
      ],
    },
    {
      group: "ghctx", subject: "Meaningful naming and commenting", tier: 2,
      says: [
        "steers inline completions toward what you intend",
        "gives Copilot a clearer description than vague identifiers",
      ],
    },
    {
      group: "ghctx", subject: "A selection", tier: 2,
      says: [
        "narrows chat or inline chat to the highlighted code",
        "avoids Copilot guessing which part of a file you mean",
      ],
    },

    // ---------------- chat commands ----------------
    {
      group: "ghcmd", subject: "/explain", tier: 1,
      says: [
        "asks Copilot to explain the selected code in plain language",
        "is useful for understanding unfamiliar code",
      ],
      use: "need to understand what a selected function does",
      like: ["/fix"],
    },
    {
      group: "ghcmd", subject: "/fix", tier: 1,
      says: [
        "asks Copilot to propose a fix for problems in the selected code",
        "targets errors or failing code you highlight",
      ],
      use: "have selected code with a bug and want a correction proposed",
      like: ["/explain"],
    },
    {
      group: "ghcmd", subject: "/tests", tier: 2,
      says: [
        "asks Copilot to generate unit tests for the selected code",
        "should have its generated tests reviewed and run",
      ],
      use: "want unit tests for a function",
      like: ["/doc"],
    },
    {
      group: "ghcmd", subject: "/doc", tier: 2,
      says: [
        "asks Copilot to add documentation comments to the selected code",
        "documents functions or classes in the file's comment style",
      ],
      use: "want docstrings added to existing code",
      like: ["/tests"],
    },
    {
      group: "ghcmd", subject: "/clear", tier: 2,
      says: [
        "starts the chat over and discards the current conversation",
        "removes earlier turns so they no longer influence answers",
      ],
      use: "want to reset a conversation that has drifted off topic",
    },
    {
      group: "ghcmd", subject: "/new", tier: 3,
      says: [
        "scaffolds a new project or file from a description",
        "creates starting files for you to review",
      ],
    },
    {
      group: "ghcmd", subject: "@workspace", tier: 2,
      says: [
        "directs a question to Copilot's knowledge of the files in your workspace",
        "suits questions about how the project fits together",
      ],
      like: ["@vscode", "@terminal"],
    },
    {
      group: "ghcmd", subject: "@vscode", tier: 3,
      says: [
        "answers questions about VS Code commands, settings and features",
        "helps find the right setting or command",
      ],
      use: "need help finding a VS Code setting",
      like: ["@workspace", "@terminal"],
    },
    {
      group: "ghcmd", subject: "@terminal", tier: 3,
      says: [
        "answers questions about the integrated terminal and shell commands",
        "can explain a command or error from the terminal",
      ],
      use: "need an explanation of a shell command or terminal error",
      like: ["@workspace", "@vscode"],
    },
    {
      group: "ghcmd", subject: "@github", tier: 4,
      says: [
        "gives chat access to GitHub-specific skills such as repository search",
        "lets a question draw on GitHub data beyond your open files",
      ],
      like: ["@workspace"],
    },

    // ---------------- admin controls ----------------
    {
      group: "ghadmin", subject: "An organization Copilot policy", tier: 2,
      says: [
        "enables or disables Copilot features for people in an organization",
        "can be set by an enterprise owner to apply across organizations",
      ],
      use: "need to switch a Copilot feature on or off for all members",
    },
    {
      group: "ghadmin", subject: "Seat management", tier: 2,
      says: [
        "decides which users or teams are assigned Copilot access",
        "is handled in the organization or enterprise settings",
      ],
    },
    {
      group: "ghadmin", subject: "Public code matching", tier: 3,
      says: [
        "is a setting that blocks or allows suggestions matching public code",
        "reduces the chance that suggested code is a verbatim public match when blocking is chosen",
      ],
      use: "need to avoid suggestions that duplicate public code",
      like: ["Content exclusion"],
    },
    {
      group: "ghadmin", subject: "A content exclusion setting", tier: 4,
      says: [
        "is configured by repository or organization administrators using path patterns",
        "tells Copilot to ignore the matched files",
      ],
      like: ["Public code matching"],
    },
    {
      group: "ghadmin", subject: "A model access policy", tier: 4,
      says: [
        "decides which models users in an organization can choose",
        "lets administrators approve or block specific models",
      ],
    },
    {
      group: "ghadmin", subject: "The Copilot audit log", tier: 4,
      says: [
        "records administrative actions such as policy and seat changes",
        "supports review of who changed Copilot settings",
      ],
    },
    {
      group: "ghadmin", subject: "The usage metrics dashboard", tier: 3,
      says: [
        "shows how people in an organization are using Copilot",
        "is also available through an API",
      ],
      use: "need to report Copilot adoption to leadership",
    },
    {
      group: "ghadmin", subject: "Business and Enterprise data handling", tier: 3,
      says: [
        "commits that prompts and suggestions are not used to train the underlying models",
        "applies to organization-managed accounts",
      ],
      like: ["The product improvement setting"],
    },
    {
      group: "ghadmin", subject: "The product improvement setting", tier: 3,
      says: [
        "is a user-level option controlling whether GitHub may use snippets and prompts to improve the product",
        "can be turned off in an individual account's Copilot settings",
      ],
      use: "individual developer who wants to opt out of data collection for product improvement",
      like: ["Business and Enterprise data handling"],
    },
    {
      group: "ghadmin", subject: "IP indemnification", tier: 5,
      says: [
        "is a contractual protection offered to eligible customers for copyright claims about suggestions",
        "depends on required settings such as public code matching being configured",
      ],
    },
    {
      group: "ghadmin", subject: "Feature availability by surface", tier: 5,
      says: [
        "is controlled separately for IDE, CLI and GitHub.com experiences",
        "lets a policy allow Copilot in one place while blocking it in another",
      ],
    },

    // ---------------- Azure OpenAI ----------------
    {
      group: "azure", subject: "An Azure OpenAI resource", tier: 1,
      says: [
        "is the Azure resource created in a subscription and region that holds your models and keys",
        "provides the endpoint your application calls",
      ],
      like: ["A model deployment"],
    },
    {
      group: "azure", subject: "A model deployment", tier: 2,
      says: [
        "is a named instance of a model inside your resource",
        "is referenced by its deployment name in API calls",
      ],
      use: "need an addressable endpoint for a chosen model",
      like: ["An Azure OpenAI resource"],
    },
    {
      group: "azure", subject: "The resource endpoint", tier: 2,
      says: [
        "is the https address of your Azure OpenAI resource",
        "usually includes your resource name in the host",
      ],
    },
    {
      group: "azure", subject: "API key authentication", tier: 2,
      says: [
        "sends a resource key with each request",
        "is simple but must be stored and rotated carefully",
      ],
      like: ["Microsoft Entra ID authentication"],
    },
    {
      group: "azure", subject: "Microsoft Entra ID authentication", tier: 3,
      says: [
        "authenticates with a token for an identity instead of a shared key",
        "works with managed identities and role-based access control",
      ],
      use: "want keyless authentication from an Azure-hosted application",
      like: ["API key authentication"],
    },
    {
      group: "azure", subject: "The chat completions API", tier: 2,
      says: [
        "takes a list of messages with roles such as system, user and assistant",
        "returns the next assistant message as a choice",
      ],
    },
    {
      group: "azure", subject: "An Azure OpenAI content filter", tier: 3,
      says: [
        "checks prompts and completions for harmful content categories",
        "can be configured per deployment through a content filtering configuration",
        "can cause a completion to end with a content_filter finish reason",
      ],
      use: "need to tune what harmful content is blocked for a deployment",
      like: ["Azure AI Content Safety"],
    },
    {
      group: "azure", subject: "Azure OpenAI quota", tier: 3,
      says: [
        "limits the tokens per minute that can be assigned to deployments in a region",
        "leads to HTTP 429 responses when a deployment exceeds its rate",
      ],
      like: ["Provisioned throughput"],
    },
    {
      group: "azure", subject: "Provisioned throughput", tier: 4,
      says: [
        "reserves dedicated model processing capacity for a deployment",
        "provides more predictable latency than shared capacity",
      ],
      use: "need reserved capacity for steady production traffic",
      like: ["Azure OpenAI quota"],
    },
    {
      group: "azure", subject: "Azure OpenAI On Your Data", tier: 4,
      says: [
        "grounds model answers in your own data from sources such as Azure AI Search",
        "returns citations to the retrieved documents",
      ],
      use: "need answers drawn from enterprise documents using Azure services",
    },
    {
      group: "azure", subject: "A private endpoint", tier: 4,
      says: [
        "lets an application reach the service over a private network address",
        "reduces exposure of the resource to the public internet",
      ],
      use: "need Azure OpenAI traffic to stay on a private network",
    },
    {
      group: "azure", subject: "The Azure OpenAI data privacy commitment", tier: 3,
      says: [
        "states that prompts and completions are not used to train models without permission",
        "states that customer data is not shared with other customers",
      ],
      not: ["sends customer prompts to the public consumer chat service"],
    },
    {
      group: "azure", subject: "An embeddings deployment", tier: 3,
      says: [
        "turns text into vectors for search and retrieval",
        "is a separate deployment from the one used for chat",
      ],
      use: "need vector representations to build a semantic search index",
    },
    {
      group: "azure", subject: "The AzureOpenAI client", tier: 2,
      says: [
        "is the client class in the openai Python package for Azure endpoints",
        "is constructed with an endpoint, a credential and an API version",
      ],
    },

    // ---------------- responsible-use controls ----------------
    {
      group: "resp", subject: "Azure AI Content Safety", tier: 3,
      says: [
        "detects harmful text and images across categories such as hate, sexual content, violence and self-harm",
        "returns a severity level for each category",
      ],
      like: ["An Azure OpenAI content filter"],
    },
    {
      group: "resp", subject: "Prompt Shields", tier: 4,
      says: [
        "detects jailbreak attempts in user prompts",
        "detects indirect injection hidden in documents the model reads",
      ],
      use: "need to detect hostile instructions inside retrieved documents",
    },
    {
      group: "resp", subject: "Groundedness detection", tier: 4,
      says: [
        "checks whether a response is supported by the provided source material",
        "helps flag unsupported claims in generated answers",
      ],
      use: "need to catch answers that go beyond the source documents",
    },
    {
      group: "resp", subject: "Protected material detection", tier: 4,
      says: [
        "flags generated output that matches known copyrighted text or public code",
        "helps reduce accidental reproduction of protected content",
      ],
    },
    {
      group: "resp", subject: "Human oversight", tier: 2,
      says: [
        "keeps a person responsible for reviewing consequential AI output",
        "is the basis for pull request review of Copilot-written code",
      ],
      not: ["becomes unnecessary once content filters are enabled"],
    },
    {
      group: "resp", subject: "Microsoft's responsible AI framework", tier: 3,
      says: [
        "includes fairness, reliability and safety, and privacy and security",
        "also includes inclusiveness, transparency and accountability",
      ],
    },
    {
      group: "resp", subject: "A transparency note", tier: 4,
      says: [
        "documents a service's intended uses, limitations and responsible-use guidance",
        "helps teams judge whether the service suits a scenario",
      ],
    },
    {
      group: "resp", subject: "Red teaming", tier: 4,
      says: [
        "tests an AI system with adversarial attempts to elicit harmful behavior",
        "finds weaknesses before real users do",
      ],
      use: "want to probe an AI application for abuse before launch",
    },
    {
      group: "resp", subject: "Microsoft Purview audit and compliance", tier: 4,
      says: [
        "records Copilot interactions for audit and eDiscovery",
        "applies retention and compliance policies to Copilot content",
      ],
      use: "need auditable records of Copilot usage",
    },
    {
      group: "resp", subject: "Verifying AI output", tier: 1,
      says: [
        "means checking facts, numbers and code before relying on them",
        "is needed because generated text can sound confident while being wrong",
      ],
      not: ["is only needed for images, not text"],
    },
    {
      group: "resp", subject: "Least-privilege agent access", tier: 5,
      says: [
        "grants an agent only the data and tools its task needs",
        "limits damage if the agent is manipulated by injected instructions",
      ],
    },

    // ---------------- prompting practices ----------------
    {
      group: "prompt", subject: "The goal-context-expectations-source framework", tier: 2,
      says: [
        "structures a Microsoft 365 Copilot prompt around what you want, why, how it should look and where to look",
        "makes prompts more specific than a one-line request",
      ],
      use: "want a repeatable way to structure a Copilot prompt",
    },
    {
      group: "prompt", subject: "Referencing a file in the prompt", tier: 2,
      says: [
        "points Copilot at the exact document to use",
        "keeps the answer from relying on unrelated content",
      ],
    },
    {
      group: "prompt", subject: "Stating audience and tone", tier: 1,
      says: [
        "tells Copilot who the output is for and how formal it should sound",
        "reduces rewriting afterward",
      ],
    },
    {
      group: "prompt", subject: "Iterating with follow-up prompts", tier: 1,
      says: [
        "refines an answer by asking for specific changes",
        "is faster than starting a new prompt from scratch each time",
      ],
    },
    {
      group: "prompt", subject: "Breaking a task into steps", tier: 3,
      says: [
        "splits a large request into smaller prompts that can each be checked",
        "makes errors easier to locate",
      ],
    },
    {
      group: "prompt", subject: "Asking for sources", tier: 2,
      says: [
        "requests references so answers can be verified",
        "helps spot claims that have no support",
      ],
    },
    {
      group: "prompt", subject: "Giving examples", tier: 3,
      says: [
        "shows Copilot the format or style you want imitated",
        "teaches a pattern more reliably than description alone",
      ],
    },
    {
      group: "prompt", subject: "Specifying the output format", tier: 2,
      says: [
        "states whether you want a table, list, email or code block",
        "makes the result ready to paste where it is needed",
      ],
    },
    {
      group: "prompt", subject: "Reviewing generated code", tier: 3,
      says: [
        "means reading, running and testing code before accepting it",
        "includes checking for insecure patterns and invented APIs",
      ],
      not: ["can be skipped when the suggestion compiles"],
    },
    {
      group: "prompt", subject: "Stating the constraints in a code prompt", tier: 3,
      says: [
        "names the language, framework and style rules to follow",
        "gets suggestions that fit the existing codebase",
      ],
    },
  ],
  qa: [
    {
      q: "Where does GitHub Copilot read repository-wide custom instructions from?",
      right: ".github/copilot-instructions.md",
      wrong: [".copilot/config.json", "README.copilot", ".github/workflows/copilot.yml"],
      tier: 2, topic: "Context",
      why: "A Markdown file at that path is added to requests in the repository.",
    },
    {
      q: "What does the applyTo line do in this file?",
      code: `---
applyTo: "**/*.ts"
---
Use strict typing and avoid the any type.`,
      right: "Limits these instructions to TypeScript files",
      wrong: ["Makes Copilot run the file on every commit", "Blocks Copilot from editing TypeScript files", "Installs a TypeScript linter"],
      tier: 3, topic: "Context",
      why: "Path-specific instruction files use an applyTo glob in front matter.",
    },
    {
      q: "Where would this file belong?",
      code: `.github/instructions/python.instructions.md`,
      right: "It is a path-specific instruction file for Copilot",
      wrong: ["A GitHub Actions workflow", "A dependency lock file", "A pull request template"],
      tier: 3, topic: "Context",
      why: "The .instructions.md extension in .github/instructions marks path-specific instructions.",
    },
    {
      q: "Which VS Code setting turns off Copilot completions only for Markdown files?",
      code: `"github.copilot.enable": {
  "*": true,
  "markdown": ???
}`,
      right: "false",
      wrong: ["\"off\" as a string only", "null with a comment", "true, because Markdown is always excluded"],
      tier: 3, topic: "Configuration",
      why: "The setting maps language ids to booleans, with * as the default.",
    },
    {
      q: "You highlight a function and type /tests. What happens?",
      right: "Copilot proposes unit tests for the selected code, which you should review and run",
      wrong: ["Copilot runs your existing test suite", "Copilot deletes untested code", "Copilot uploads the function to a test server"],
      tier: 1, topic: "Chat",
      why: "/tests generates tests; it does not execute them for you.",
    },
    {
      q: "Which command asks Copilot to describe what selected code does?",
      right: "/explain",
      wrong: ["/fix", "/clear", "/new"],
      tier: 1, topic: "Chat",
      why: "/explain explains the selected code.",
    },
    {
      q: "Which prompt targets questions about VS Code settings?",
      code: `@vscode how do I change the font size?`,
      right: "The @vscode participant, which answers questions about editor commands and settings",
      wrong: ["@terminal, which controls the editor font", "@workspace, which edits settings files automatically", "/new, which creates a settings file"],
      tier: 3, topic: "Chat",
      why: "@vscode is the participant for VS Code functionality.",
    },
    {
      q: "Which participant is best when asking how files in your project fit together?",
      right: "@workspace",
      wrong: ["@terminal", "@vscode", "/clear"],
      tier: 2, topic: "Chat",
      why: "@workspace brings in knowledge of project files.",
    },
    {
      q: "In agent mode, Copilot wants to run `npm test`. What normally happens?",
      right: "It asks for your approval before running the terminal command",
      wrong: ["It runs every command silently", "It refuses to use the terminal entirely", "It sends the command to GitHub's servers to run"],
      tier: 3, topic: "Agent mode",
      why: "Agent mode requests confirmation for terminal commands.",
    },
    {
      q: "What is the difference between agent mode and the Copilot coding agent?",
      right: "Agent mode works interactively in your IDE; the coding agent works asynchronously on an issue and opens a pull request",
      wrong: ["They are the same feature with two names", "Agent mode needs GitHub Actions; the coding agent runs only locally", "The coding agent works only on a single selected line"],
      tier: 3, topic: "Agent mode",
      why: "The coding agent runs in a GitHub-hosted environment and delivers a PR.",
    },
    {
      q: "The Copilot coding agent finishes an issue. What should happen next?",
      right: "A human reviews the pull request before it is merged",
      wrong: ["Copilot merges it automatically", "The issue is deleted", "The branch is force pushed to main"],
      tier: 3, topic: "Agent mode",
      why: "The agent proposes changes; people stay responsible for approval.",
    },
    {
      q: "A teammate wants Copilot to follow a team convention in every request in one repo. Which approach fits?",
      right: "Add the convention to .github/copilot-instructions.md",
      wrong: ["Retype the convention at the start of every chat", "Put it in the pull request title", "Change the model picker"],
      tier: 2, topic: "Context",
      why: "Repository instructions are applied automatically.",
    },
    {
      q: "Which approach tells Copilot Chat to base its answer on one specific file?",
      code: `Explain the retry logic in #file:src/client.ts`,
      right: "Attach the file with the #file variable",
      wrong: ["Add the filename as a stop sequence", "Use /clear first", "Rename the file to copilot.ts"],
      tier: 2, topic: "Context",
      why: "#file attaches the named file as context.",
    },
    {
      q: "What does this Python call do?",
      code: `from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint="https://my-resource.openai.azure.com",
    api_key=KEY,
    api_version=API_VERSION,
)
r = client.chat.completions.create(
    model="my-deployment",
    messages=[{"role": "user", "content": "Hello"}],
)`,
      right: "Sends a chat request to the deployment named my-deployment",
      wrong: ["Creates a new Azure OpenAI resource", "Uploads training data to my-deployment", "Lists every model in the subscription"],
      tier: 2, topic: "Azure OpenAI",
      why: "In Azure OpenAI the model parameter holds the deployment name.",
    },
    {
      q: "In Azure OpenAI, what goes in the `model` parameter of a chat completion call?",
      right: "The name you gave the deployment",
      wrong: ["The resource name", "The subscription id", "The region"],
      tier: 2, topic: "Azure OpenAI",
      why: "Calls target a deployment, identified by name.",
    },
    {
      q: "What does this approach change compared with an API key?",
      code: `from azure.identity import DefaultAzureCredential, get_bearer_token_provider

provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")
client = AzureOpenAI(azure_endpoint=ENDPOINT, azure_ad_token_provider=provider, api_version=API_VERSION)`,
      right: "It authenticates with a Microsoft Entra ID token, so no key is stored in code",
      wrong: ["It disables content filters", "It switches to the embeddings API", "It makes the deployment public"],
      tier: 3, topic: "Azure OpenAI",
      why: "Token providers use identities and RBAC instead of shared keys.",
    },
    {
      q: "Which curl line shows how the classic REST API authenticates with a key?",
      code: `curl "https://RESOURCE.openai.azure.com/openai/deployments/DEPLOYMENT/chat/completions?api-version=API_VERSION" \\
  -H "api-key: $AZURE_OPENAI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hi"}]}'`,
      right: "The key travels in an api-key header, and the deployment name is in the URL path",
      wrong: ["The key is placed in the JSON messages array", "The key is the deployment name", "No credential is required inside the same region"],
      tier: 3, topic: "Azure OpenAI",
      why: "The classic endpoint identifies the deployment in the path and reads api-key from a header.",
    },
    {
      q: "An Azure OpenAI request returns HTTP 429. What is the usual cause and fix?",
      right: "The deployment exceeded its tokens-per-minute rate; slow down, retry with backoff or raise its quota",
      wrong: ["The prompt is malformed; rewrite the JSON", "The API key is wrong; regenerate it", "The region has no deployments"],
      tier: 3, topic: "Azure OpenAI",
      why: "429 signals rate or quota limits.",
    },
    {
      q: "A completion ends with finish_reason content_filter. What does that mean?",
      right: "A content filter stopped the output",
      wrong: ["The response was cut by the max token limit", "A function call is awaiting a result", "The user cancelled the stream"],
      tier: 3, topic: "Azure OpenAI",
      why: "Filtered completions report content_filter as the finish reason.",
    },
    {
      q: "A prompt is blocked by the Azure OpenAI content filter before generation. What do you typically see?",
      right: "An error response with a content_filter code that you handle in the app",
      wrong: ["A normal completion with an empty string", "A silently truncated reply", "An automatic retry that bypasses the filter"],
      tier: 4, topic: "Azure OpenAI",
      why: "Blocked prompts return an error describing the filter result.",
    },
    {
      q: "Employees ask whether Copilot will reveal HR files to everyone. What is the accurate answer?",
      right: "Copilot only retrieves what each user can already access, so fix overly broad permissions",
      wrong: ["Copilot ignores permissions to give better answers", "Copilot copies HR files to a shared index visible to all", "Permissions only matter for files over a size limit"],
      tier: 3, topic: "Microsoft 365 Copilot",
      why: "Permission trimming is paired with permission hygiene to avoid oversharing.",
    },
    {
      q: "What does grounding do before the model answers in Microsoft 365 Copilot?",
      right: "Retrieves relevant content and adds it to the prompt",
      wrong: ["Retrains the model on your mailbox", "Deletes old files", "Changes user permissions"],
      tier: 2, topic: "Microsoft 365 Copilot",
      why: "Grounding adds retrieved context to the prompt; it does not train the model.",
    },
    {
      q: "Which source layer supplies emails, files and calendars to Microsoft 365 Copilot?",
      right: "Microsoft Graph",
      wrong: ["The GitHub REST API", "The Azure Resource Manager", "The Windows registry"],
      tier: 2, topic: "Microsoft 365 Copilot",
      why: "Graph exposes tenant content that Copilot retrieves.",
    },
    {
      q: "A user wants a focused agent that answers only from a few policy documents. Which fits best?",
      right: "A Copilot Studio agent with those documents as knowledge sources",
      wrong: ["A bigger temperature setting", "An Edge browser extension", "A GitHub Actions workflow"],
      tier: 3, topic: "Agents",
      why: "Knowledge sources limit an agent to chosen content.",
    },
    {
      q: "Which feature lets a Copilot Studio agent decide which tool to call from the user's request?",
      right: "Generative orchestration",
      wrong: ["Content exclusion", "Public code matching", "Provisioned throughput"],
      tier: 3, topic: "Agents",
      why: "With generative orchestration the model plans tool and topic use.",
    },
    {
      q: "A maker wants an agent that reacts to every new email without a chat message. What is needed?",
      right: "An agent trigger on the email event",
      wrong: ["A topic with trigger phrases only", "A sensitivity label", "A prompt file"],
      tier: 4, topic: "Agents",
      why: "Triggers start autonomous runs from events.",
    },
    {
      q: "An admin wants to stop makers from combining a business connector with an unapproved one. What controls that?",
      right: "A data policy for the Power Platform environment",
      wrong: ["A Copilot instructions file", "A seat assignment", "A temperature setting"],
      tier: 4, topic: "Agents",
      why: "Data policies classify and restrict connectors.",
    },
    {
      q: "Which setting reduces the chance of verbatim public code appearing in GitHub Copilot suggestions?",
      right: "Blocking suggestions that match public code",
      wrong: ["Raising the context window", "Turning on inline chat", "Adding more open tabs"],
      tier: 3, topic: "Admin",
      why: "The public code matching setting can block such suggestions.",
    },
    {
      q: "What does this content exclusion pattern do?",
      code: `- "/secrets/**"`,
      right: "Tells Copilot to ignore files under the secrets folder",
      wrong: ["Deletes the folder from the repository", "Encrypts the folder", "Forces Copilot to read it first"],
      tier: 4, topic: "Admin",
      why: "Exclusion patterns name paths Copilot should not use.",
    },
    {
      q: "A security lead says content exclusion is enough to guarantee Copilot never sees a file in any feature. What is the better view?",
      right: "It has documented limitations by feature, so verify coverage and keep real secrets out of repos",
      wrong: ["It is absolute for every Copilot surface", "It only applies to Markdown", "It works only for personal accounts"],
      tier: 5, topic: "Admin",
      why: "Controls are not a substitute for secret hygiene.",
    },
    {
      q: "Who can opt out of sharing snippets for product improvement through personal Copilot settings?",
      right: "An individual user in their own account settings",
      wrong: ["Only Microsoft support staff", "Only repository bots", "Nobody; it cannot be changed"],
      tier: 3, topic: "Admin",
      why: "The product improvement option is a user-level setting.",
    },
    {
      q: "Which Azure AI service flags jailbreak attempts and instructions hidden in documents?",
      right: "Prompt Shields",
      wrong: ["Groundedness detection", "Private endpoints", "Provisioned throughput"],
      tier: 4, topic: "Responsible use",
      why: "Prompt Shields target direct and indirect prompt attacks.",
    },
    {
      q: "A summarizer cites claims that the source documents never make. Which check targets this?",
      right: "Groundedness detection",
      wrong: ["Public code matching", "A larger deployment", "A shorter system message only"],
      tier: 4, topic: "Responsible use",
      why: "Groundedness detection compares outputs to source material.",
    },
    {
      q: "Copilot wrote a helper that compiles. What is the right next step?",
      right: "Review and test it before merging, since compiling does not prove it is correct or safe",
      wrong: ["Merge it because it compiled", "Ask Copilot to approve its own work and skip tests", "Delete the tests"],
      tier: 2, topic: "Responsible use",
      why: "Human review remains essential.",
    },
    {
      q: "Which prompt follows the goal-context-expectations-source idea?",
      right: "Draft a project update for executives, using this week's status notes, as three short bullets in a formal tone",
      wrong: ["Write something", "Update", "Make it good"],
      tier: 2, topic: "Prompting",
      why: "It states the goal, context, expectations and source.",
    },
    {
      q: "A chat in Copilot has drifted far off the original topic. What helps most?",
      right: "Clear the conversation and start again with a focused prompt",
      wrong: ["Keep adding unrelated questions to the same thread", "Delete the repository", "Raise the temperature"],
      tier: 2, topic: "Prompting",
      why: "Old turns keep influencing answers until cleared.",
    },
    {
      q: "Which statement about the Copilot Studio vs declarative agents distinction is accurate?",
      right: "Declarative agents customize Microsoft 365 Copilot with instructions, knowledge and actions",
      wrong: ["They replace Microsoft Graph", "They run only in GitHub", "They require no instructions at all"],
      tier: 4, topic: "Agents",
      why: "Declarative agents are manifest-defined Copilot customizations.",
    },
    {
      q: "A user signed in to Copilot Chat with a work account. What protection applies to their prompts?",
      right: "Enterprise data protection applies to prompts and responses",
      wrong: ["Prompts are published to the company directory", "Prompts are used to retrain the foundation model", "No protection applies to work accounts"],
      tier: 3, topic: "Windows and Edge",
      why: "Entra sign-in enables organizational protections.",
    },
    {
      q: "A team must keep Azure OpenAI traffic off the public internet. What should they configure?",
      right: "A private endpoint for the resource",
      wrong: ["A higher temperature", "A longer system message", "A second deployment name"],
      tier: 4, topic: "Azure OpenAI",
      why: "Private endpoints give private network access.",
    },
  ],
  calc: [],
};
export default spec;
