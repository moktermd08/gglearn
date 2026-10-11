import type { Card, QA, TrackSpec } from "../types";

type T = 1 | 2 | 3 | 4 | 5;
const k = (group: string, subject: string, tier: T, says: string[], use?: string, not?: string[], like?: string[]): Card => ({ group, subject, tier, says, use, not, like });
const q = (tier: T, qq: string, right: string, wrong: [string, string, string], why: string, code?: string, topic?: string): QA => ({ q: qq, right, wrong, tier, why, code, topic });

const cards: Card[] = [
  // ---- Claude app features
  k("product", "a project", 2, [
    "keeps related chats together with a shared set of uploaded knowledge",
    "carries custom instructions that apply to every chat inside it",
    "lets you work repeatedly on one subject without re-uploading files",
  ], "work on one ongoing topic with a stable set of reference files", ["erases the conversation history every time a new chat starts"], ["a response style"]),
  k("product", "an artifact", 2, [
    "shows generated content such as code, documents or small apps in a window beside the chat",
    "lets you iterate on that content through follow-up messages",
    "can render things like web pages and diagrams for preview",
  ], "want to preview and refine a generated web page next to the conversation", ["exists only in the developer API and not in the Claude app"]),
  k("product", "Research", 3, [
    "breaks a broad question into several searches and gathers the findings",
    "produces a report with citations to its sources",
    "takes longer than an ordinary reply because it works in many steps",
  ], "need a cited, in-depth report that draws on many sources", undefined, ["Web search in the app"]),
  k("product", "Extended thinking mode", 2, [
    "lets Claude reason at length before giving its final answer",
    "is aimed at hard maths, coding and analysis problems",
    "trades a longer wait for deeper reasoning",
  ], "want more deliberate reasoning on a hard problem"),
  k("product", "a response style", 1, [
    "changes the tone and format of Claude's replies",
    "can be chosen from presets or created from a sample of your writing",
    "changes how Claude writes, not what it knows",
  ], "want replies in a more concise or more explanatory voice", undefined, ["Projects"]),
  k("product", "Web search in the app", 1, [
    "lets Claude look up current information online while answering",
    "includes links to the sources it used",
    "helps with events that happened after training ended",
  ], "need an answer about something very recent", undefined, ["Research"]),
  k("product", "a connector", 3, [
    "links Claude to an external service so it can use that service's data or actions",
    "needs you to grant permission for what Claude may access",
    "lets a chat draw on information outside the conversation itself",
  ], "want Claude to read from your document store during a chat"),
  k("product", "File and image upload", 1, [
    "lets you attach documents and images to a chat",
    "lets Claude read their content when answering",
    "is how you ask questions about your own files",
  ]),

  // ---- developer platform tools
  k("platform", "the Anthropic Console", 1, [
    "is the web dashboard where developers manage API keys and workspaces",
    "lets you review usage and set up billing",
    "includes a Workbench for trying prompts",
  ], "need to create an API key in a browser dashboard", undefined, ["The Workbench"]),
  k("platform", "the Workbench", 1, [
    "is a browser playground for trying prompts and model settings without code",
    "lets you adjust parameters such as temperature and max tokens",
    "can turn a tested prompt into example code",
  ], "want to experiment with a prompt before writing code", undefined, ["The Anthropic Console"]),
  k("platform", "the Model Context Protocol", 3, [
    "is an open standard for connecting AI applications to tools and data sources",
    "uses servers that expose tools, resources and prompts",
    "lets one integration work across many compatible clients",
  ], "want one tool integration to work in several AI applications"),
  k("platform", "Claude Code", 2, [
    "is an agentic coding tool that works in your terminal on a codebase",
    "can read files, run commands and edit code with your permission",
    "reads project instructions from a CLAUDE.md file",
  ], "want an AI agent to work inside your repository from the command line", ["is a hosted browser game with no access to local files"], ["The Claude Agent SDK"]),
  k("platform", "the Claude Agent SDK", 4, [
    "packages the agent loop used by Claude Code for use in your own programs",
    "provides built-in tools for files and commands",
    "is a library rather than a hosted chat application",
  ], "want to build your own autonomous agent on the same loop as Claude Code", undefined, ["Claude Code"]),
  k("platform", "Cloud platform access", 3, [
    "lets teams call Claude through a major cloud provider's own services",
    "follows the cloud provider's authentication and billing",
    "keeps most of the Messages request shape but may differ in details",
  ], "must keep all AI traffic inside an existing cloud account"),

  // ---- API endpoints
  k("endpoint", "the Messages API", 1, [
    "takes a list of user and assistant messages and returns Claude's next reply",
    "is stateless, so each request carries the whole conversation",
    "is the main endpoint for chat, tools, vision and thinking",
  ], "need to send a conversation and get Claude's next turn", ["remembers earlier requests on the server without being sent the history"], ["The Text Completions API"]),
  k("endpoint", "the Message Batches API", 3, [
    "processes many Messages requests asynchronously as one batch",
    "returns results later rather than in the same call",
    "suits large non-urgent workloads such as bulk classification",
  ], "need to classify a very large archive and can wait for results"),
  k("endpoint", "the Files API", 3, [
    "uploads a file once and returns an id",
    "lets later requests refer to the file by id instead of resending it",
    "avoids re-uploading the same large document on every call",
  ], "ask many questions about the same large document"),
  k("endpoint", "the token counting endpoint", 3, [
    "counts the tokens a Messages request would use without generating a reply",
    "accepts the same kind of input as a Messages call, including tools and system text",
    "helps check that a prompt fits before it is sent",
  ], "need to know if a prompt fits before paying for a real request"),
  k("endpoint", "the models endpoint", 1, [
    "lists the models available to your account",
    "returns model ids that you can use in requests",
    "is a read-only GET request",
  ]),
  k("endpoint", "the Text Completions API", 5, [
    "is the legacy prompt-in, text-out interface that predates the Messages API",
    "uses a single prompt string with Human and Assistant turns",
    "is not the recommended interface for new work",
  ], undefined, ["is the only interface that supports tool use and images"], ["The Messages API"]),

  // ---- message structure
  k("structure", "the messages array", 1, [
    "holds the conversation turns in order",
    "is sent in full with every request",
    "alternates between user and assistant turns",
  ]),
  k("structure", "the user role", 1, [
    "marks content supplied by the person or application sending input",
    "must be the role of the first message",
    "carries the human side of each turn",
  ]),
  k("structure", "the assistant role", 1, [
    "marks content written by Claude",
    "is how earlier Claude replies are included in the history",
    "can contain tool_use blocks",
  ]),
  k("structure", "the system parameter", 2, [
    "is a top-level field that sets Claude's role, rules and context",
    "sits beside model and messages in the request body",
    "stays separate from the user's turns",
  ], "want standing instructions that apply to the whole conversation", ["is passed as a message whose role is system"]),
  k("structure", "a text content block", 1, [
    "carries plain text inside a content array",
    "has the type text",
    "is what a simple reply contains",
  ]),
  k("structure", "an image content block", 2, [
    "carries an image supplied as base64 data or as a URL",
    "sits in a user message alongside text",
    "is the block type used to pass a picture to Claude",
  ], undefined, undefined, ["Vision", "a document content block"]),
  k("structure", "a document content block", 3, [
    "carries a PDF or text document for Claude to read",
    "can be supplied as base64 data, a URL or a file id",
    "can have citations switched on",
  ], "need to pass a whole PDF in a request", undefined, ["PDF support", "an image content block"]),
  k("structure", "a tool_use block", 2, [
    "is Claude's request to call a tool, with an id, a name and an input",
    "appears in assistant content",
    "carries its input as a JSON object rather than as a string",
  ], undefined, undefined, ["a tool_result block"]),
  k("structure", "a tool_result block", 2, [
    "returns a tool's output to Claude",
    "references the matching tool_use_id",
    "is sent back inside a user message",
  ], undefined, undefined, ["a tool_use block"]),

  // ---- request parameters
  k("param", "the model parameter", 1, [
    "names which model should answer the request",
    "is a required field",
    "takes a model id string",
  ]),
  k("param", "the max_tokens parameter", 1, [
    "is a required field that caps generated output",
    "limits output tokens, not the size of the prompt",
    "ends the reply with a max_tokens stop reason when reached",
  ], "want to put a hard cap on the length of a reply", ["is optional and defaults to the model's maximum"]),
  k("param", "the temperature parameter", 1, [
    "controls how random the sampling is",
    "accepts values from zero to one",
    "is better kept low for analytical tasks",
  ], "want more focused and repeatable output", undefined, ["The top_p parameter"]),
  k("param", "the top_p parameter", 3, [
    "limits sampling to the smallest set of likely tokens whose probabilities add up to p",
    "is an alternative way to narrow the token choices",
    "is generally adjusted instead of temperature rather than together with it",
  ], undefined, undefined, ["The temperature parameter", "The top_k parameter"]),
  k("param", "the top_k parameter", 4, [
    "samples only from the k most probable next tokens",
    "removes long-tail low-probability tokens",
    "is for advanced use rather than routine tuning",
  ], undefined, undefined, ["The top_p parameter"]),
  k("param", "the stop_sequences parameter", 2, [
    "is a list of strings that halt generation when produced",
    "leads to a stop_sequence stop reason",
    "reports the matching string in the response",
  ]),
  k("param", "the stream parameter", 2, [
    "asks for the reply as server-sent events",
    "produces event types such as content_block_delta",
    "is recommended for long outputs to avoid request timeouts",
  ], "want text to appear on screen as it is generated"),
  k("param", "the tool_choice parameter", 3, [
    "controls whether Claude may or must use tools",
    "accepts auto, any, tool or none",
    "can force a specific tool by name",
  ], "need Claude to call one particular tool"),
  k("param", "the metadata user_id field", 4, [
    "is an opaque identifier for the end user",
    "helps detect abuse without sending personal details",
    "should be a hash or internal id rather than a name or email",
  ]),
  k("param", "the thinking parameter", 4, [
    "enables extended thinking for models that support it",
    "takes a budget_tokens value",
    "makes thinking blocks appear in the response",
  ]),

  // ---- response fields and stop reasons
  k("response", "the end_turn stop reason", 1, [
    "means Claude finished its reply naturally",
    "is the most common stop reason",
    "needs no follow-up action from your code",
  ], "check that a reply ended on its own", ["means the reply was cut off by the token limit"]),
  k("response", "the max_tokens stop reason", 2, [
    "means the output hit the max_tokens limit",
    "can leave a reply or JSON truncated",
    "is fixed by raising the limit or shortening the task",
  ], "see that a reply stops mid-sentence because it ran out of room"),
  k("response", "the stop_sequence stop reason", 2, [
    "means generation halted on one of your stop strings",
    "comes with the matched string in the stop_sequence field",
    "cannot occur unless you supplied stop sequences",
  ]),
  k("response", "the tool_use stop reason", 2, [
    "means Claude wants you to run a tool",
    "tells your loop to execute tools and call again",
    "arrives together with tool_use blocks in the content",
  ], "need to know whether your code must run a function now"),
  k("response", "the pause_turn stop reason", 4, [
    "means a long-running turn with server tools was paused",
    "is continued by sending the response back as it is so Claude can resume",
    "can occur when server tool use takes many iterations",
  ]),
  k("response", "the refusal stop reason", 4, [
    "means Claude declined to continue for safety reasons",
    "should be handled as its own outcome in application code",
    "is reported in the response rather than as an HTTP error",
  ]),
  k("response", "the usage object", 2, [
    "reports input_tokens and output_tokens",
    "is the source of per-request token accounting",
    "includes cache read and write counts when caching is used",
  ]),
  k("response", "the content array", 2, [
    "holds the response as a list of typed blocks",
    "must be iterated rather than assuming one text block",
    "can mix thinking, text and tool_use blocks",
  ]),
  k("response", "the response id", 3, [
    "uniquely identifies the generated message",
    "starts with the prefix msg_",
    "is separate from the request-id header",
  ], undefined, undefined, ["The request-id header"]),
  k("response", "the request-id header", 3, [
    "is returned on responses in a header named request-id",
    "identifies the API request for support",
    "should be logged alongside errors",
  ], "need something to quote when asking for help with a failed call", undefined, ["The response id"]),
  k("response", "the stop_sequence field", 4, [
    "holds the matched stop string when one ended generation",
    "is null when no stop sequence was hit",
    "sits beside stop_reason at the top level of the message",
  ]),
  k("response", "the model field of a response", 3, [
    "echoes the id of the model that produced the reply",
    "is useful to log when you route between models",
    "is a plain string rather than a nested object",
  ]),

  // ---- streaming events
  k("stream", "the message_start event", 2, [
    "opens the stream with a message object that has empty content",
    "carries initial usage information",
    "is the first event in a stream",
  ]),
  k("stream", "the content_block_start event", 3, [
    "begins a new content block at a given index",
    "declares the block type, such as text or tool_use",
    "precedes the deltas for that block",
  ]),
  k("stream", "the content_block_delta event", 2, [
    "carries an incremental piece of a content block",
    "holds a text_delta for text blocks",
    "must be applied in order to rebuild the block",
  ], "need the next few characters to show in a live chat window"),
  k("stream", "the content_block_stop event", 3, [
    "marks the end of one content block",
    "is the point at which accumulated tool input can be parsed",
    "follows the last delta of its block",
  ]),
  k("stream", "the message_delta event", 3, [
    "carries top-level changes such as the stop_reason",
    "reports cumulative output token usage",
    "arrives after the last content block",
  ], "need to learn why the stream ended while it is still being read"),
  k("stream", "the message_stop event", 2, [
    "is the final event of a stream",
    "tells the client that the whole message has ended",
    "comes after the message_delta event",
  ]),
  k("stream", "the ping event", 4, [
    "is a keep-alive event that can appear anywhere in a stream",
    "carries no content",
    "should be ignored by consumers that do not need it",
  ]),
  k("stream", "the input_json_delta", 4, [
    "streams tool input as partial JSON strings",
    "must be concatenated and parsed after the block stops",
    "is the delta type used for tool_use blocks",
  ]),
  k("stream", "a mid-stream error event", 5, [
    "can arrive after the HTTP 200 status has already been sent",
    "reports problems such as overload during a stream",
    "means the status code alone cannot show that a stream succeeded",
  ]),

  // ---- tool use
  k("tool", "a tool definition", 2, [
    "gives a tool a name, a description and an input_schema",
    "is sent in the tools parameter",
    "depends on a precise description for Claude to use the tool correctly",
  ]),
  k("tool", "the input_schema field", 2, [
    "is a JSON Schema describing a tool's input",
    "defines property types and required fields",
    "only guides Claude, so your code should still validate the input",
  ]),
  k("tool", "a client tool", 3, [
    "is executed by your application, not by Anthropic",
    "gets its output back to Claude as a tool_result block",
    "covers custom functions as well as the bash and text editor tools",
  ], "need the model to call a function that runs in your own code", undefined, ["a server tool"]),
  k("tool", "a server tool", 3, [
    "is executed on Anthropic's infrastructure",
    "includes web search and code execution",
    "returns its results in the same response without your code running anything",
  ], "want search or code execution without writing any tool-running code", undefined, ["a client tool", "The web search server tool", "The code execution server tool"]),
  k("tool", "the tool loop", 3, [
    "continues while the stop_reason is tool_use",
    "appends the assistant content and then a user message with tool_result blocks",
    "ends when Claude replies with end_turn",
  ]),
  k("tool", "the is_error flag", 4, [
    "marks a tool_result as a failure",
    "lets Claude see that the tool failed and try another approach",
    "is set on the tool_result block",
  ]),
  k("tool", "parallel tool use", 4, [
    "lets Claude request several tools in one assistant turn",
    "requires all the results to be returned together in one user message",
    "can be switched off through tool_choice",
  ]),
  k("tool", "tool-based structured output", 4, [
    "gets JSON by forcing a tool whose input_schema is the desired shape",
    "reads the answer from the tool_use input object",
    "needs no tool to actually run",
  ], "need guaranteed-shape JSON from a model without a separate JSON feature"),
  k("tool", "computer use", 5, [
    "lets Claude see screenshots and request mouse and keyboard actions",
    "is a client tool that your code must carry out in a sandbox",
    "works in a loop of action, screenshot and next action",
  ]),

  // ---- caching and batch
  k("cost", "Prompt caching", 3, [
    "reuses the processed prefix of a prompt across requests",
    "is enabled by marking content with cache_control",
    "benefits long stable prefixes such as instructions and documents",
  ], "send the same long instructions with many requests", ["caches the model's answers so identical questions skip generation"]),
  k("cost", "a cache_control breakpoint", 3, [
    "marks the end of a prompt prefix that should be cached",
    "uses the type ephemeral",
    "applies to everything that comes before it in the request",
  ]),
  k("cost", "Cache prefix order", 4, [
    "follows the sequence tools, then system, then messages",
    "means a change early in the prompt invalidates later cached content",
    "is why variable content belongs at the end of the prompt",
  ]),
  k("cost", "cache_read_input_tokens", 4, [
    "counts input tokens that were served from the cache",
    "appears in the usage object",
    "is the signal that a cache hit occurred",
  ], undefined, undefined, ["cache_creation_input_tokens"]),
  k("cost", "cache_creation_input_tokens", 4, [
    "counts tokens that were written to the cache on this request",
    "appears in usage when caching is used",
    "shows a cache miss that populated the cache",
  ], undefined, undefined, ["cache_read_input_tokens"]),
  k("cost", "the cache lifetime", 5, [
    "is the limited time a cached prefix stays available",
    "is refreshed each time the cache entry is used",
    "means idle prompts eventually have to be written to the cache again",
  ]),
  k("cost", "the minimum cacheable length", 5, [
    "means prompts below a model-specific size are not cached",
    "does not raise an error when a prompt is too short",
    "is a reason a cache_control marker can seem to have no effect",
  ]),
  k("cost", "a batch custom_id", 3, [
    "is a unique id you assign to each request in a batch",
    "links each result to its request",
    "is needed because results may not come back in order",
  ]),
  k("cost", "a batch processing_status", 3, [
    "shows whether a batch is still in progress or has ended",
    "is polled until it reports ended",
    "decides when the results can be downloaded",
  ]),
  k("cost", "the batch results file", 3, [
    "is JSONL with one outcome per request",
    "records each request as succeeded, errored, canceled or expired",
    "is available once the batch has ended",
  ]),
  k("cost", "Canceling a batch", 4, [
    "ends a batch early",
    "leaves requests that already finished with their results",
    "is requested through the batch's cancel operation",
  ]),
  k("cost", "Conversation summarisation", 3, [
    "replaces old turns with a short summary to stay within the context window",
    "keeps the key facts of a long chat while freeing space",
    "has to preserve the instructions that must always apply",
  ]),

  // ---- capabilities
  k("capability", "Vision", 2, [
    "lets Claude analyse images supplied in a request",
    "can describe photos and read text in screenshots",
    "works better when the image is placed before the question",
  ], "need Claude to read a chart in a screenshot", undefined, ["an image content block"]),
  k("capability", "PDF support", 3, [
    "lets Claude read both the text and the visual content of a PDF",
    "takes the PDF as a document block",
    "is useful for reports that contain charts and tables",
  ], "need Claude to understand a PDF that contains charts", undefined, ["a document content block"]),
  k("capability", "the citations feature", 3, [
    "has Claude reference the exact passages in provided documents behind its claims",
    "is switched on for document blocks",
    "returns citation objects attached to text blocks",
  ], "need each claim traced to a passage in the source document"),
  k("capability", "the web search server tool", 3, [
    "lets Claude search the web within a single API request",
    "returns citations to the pages it used",
    "needs no search code on your side",
  ], undefined, undefined, ["a server tool", "The code execution server tool"]),
  k("capability", "the code execution server tool", 4, [
    "runs code in a sandbox managed by Anthropic",
    "lets Claude analyse data and produce files",
    "keeps code execution off your own machines",
  ], undefined, undefined, ["a server tool", "The web search server tool"]),
  k("capability", "Mixed-modality input", 2, [
    "combines text, images and documents in the same user turn",
    "is expressed as several content blocks in one message",
    "lets a question refer to an attached picture or file directly",
  ]),

  // ---- extended thinking
  k("thinking", "the thinking budget", 3, [
    "caps how many tokens Claude may spend reasoning",
    "is set with budget_tokens",
    "is rejected if set below a documented minimum",
  ], "want to limit how much reasoning a request may use"),
  k("thinking", "a thinking block", 3, [
    "contains Claude's reasoning before its final answer",
    "appears in the content array ahead of the text",
    "arrives as thinking_delta events when streaming",
  ]),
  k("thinking", "the signature field", 5, [
    "on a thinking block lets the API verify that the block is unaltered",
    "must be passed back unchanged with its thinking block",
    "is why your code cannot edit thinking blocks",
  ]),
  k("thinking", "Redacted thinking", 5, [
    "is a block holding encrypted reasoning that the user cannot read",
    "must be passed back unchanged like other thinking blocks",
    "appears when the reasoning was flagged by safety systems",
  ]),
  k("thinking", "Interleaved thinking", 5, [
    "lets Claude think between tool calls within one turn",
    "needs to be switched on explicitly for supported models",
    "helps multi-step tool workflows where each result shapes the next step",
  ]),
  k("thinking", "Preserving thinking blocks in a tool loop", 4, [
    "means returning the assistant's thinking blocks along with the tool_result",
    "keeps reasoning continuity across tool calls",
    "is required when thinking is enabled and tools are used",
  ]),
  k("thinking", "the thinking compatibility rule", 4, [
    "limits sampling controls such as temperature when thinking is enabled",
    "also restricts forcing a specific tool through tool_choice",
    "must be considered when combining thinking with other features",
  ]),
  k("thinking", "the cost of thinking", 3, [
    "is counted as output tokens",
    "consumes part of the max_tokens allowance",
    "grows with the amount of reasoning used",
  ]),

  // ---- SDK
  k("sdk", "the Python client", 1, [
    "is created with anthropic.Anthropic()",
    "exposes resources such as messages, batches and models",
    "is meant to be created once and reused",
  ], undefined, undefined, ["AsyncAnthropic"]),
  k("sdk", "the ANTHROPIC_API_KEY variable", 1, [
    "is the environment variable the SDK reads by default for the key",
    "keeps the secret out of source code",
    "lets a client be constructed with no arguments",
  ], "want the SDK to find the key without hard-coding it"),
  k("sdk", "AsyncAnthropic", 3, [
    "is the asynchronous Python client used with async and await",
    "lets many requests run concurrently in one event loop",
    "mirrors the method names of the synchronous client",
  ], "need to send many requests concurrently inside an async server", undefined, ["The Python client"]),
  k("sdk", "the messages.create method", 1, [
    "sends a Messages request and returns a message object",
    "takes model, max_tokens and messages as its core arguments",
    "is the call that returns content blocks",
  ]),
  k("sdk", "the messages.stream helper", 3, [
    "is a context manager that yields stream events",
    "offers a text_stream iterator for plain text deltas",
    "can return the final accumulated message afterwards",
  ], "want to print text as it arrives with the least code"),
  k("sdk", "the TypeScript SDK", 2, [
    "is installed as the package @anthropic-ai/sdk",
    "is imported as a default Anthropic class",
    "ships types for requests and responses",
  ]),
  k("sdk", "Type narrowing on content blocks", 3, [
    "is needed before reading .text because blocks are a union of types",
    "is done by checking that the block's type equals text",
    "avoids reading text from a tool_use block by mistake",
  ]),
  k("sdk", "the SDK retry default", 3, [
    "automatically retries certain failures with backoff",
    "can be changed through max_retries",
    "covers connection errors, rate limits and server errors",
  ]),
  k("sdk", "anthropic.RateLimitError", 3, [
    "is the Python exception raised for an HTTP 429 response",
    "is a kind of status error that carries the response",
    "is a signal to back off before retrying",
  ]),
  k("sdk", "the anthropic-version header", 4, [
    "is sent automatically by the official SDKs",
    "must be set by hand when calling the REST API directly",
    "pins the API version for the request",
  ]),

  // ---- errors
  k("error", "an invalid_request_error", 2, [
    "means the request body was malformed or had invalid fields",
    "is returned with HTTP status 400",
    "is not fixed by retrying the same request",
  ], undefined, undefined, ["A request_too_large error"]),
  k("error", "an authentication_error", 2, [
    "means the API key is missing or invalid",
    "is returned with HTTP status 401",
    "is fixed by supplying a valid key, not by waiting",
  ], "see an error saying the x-api-key is wrong", undefined, ["A permission_error"]),
  k("error", "a permission_error", 3, [
    "means the key is valid but not allowed to use the resource",
    "is returned with HTTP status 403",
    "signals an authorisation problem rather than an authentication one",
  ], undefined, undefined, ["An authentication_error"]),
  k("error", "a not_found_error", 2, [
    "means the requested resource such as a model or file was not found",
    "is returned with HTTP status 404",
    "often follows a typo in a model id or path",
  ]),
  k("error", "a request_too_large error", 4, [
    "means the request body exceeded the maximum allowed size",
    "is returned with HTTP status 413",
    "is fixed by sending less data, for example by using the Files API",
  ], undefined, undefined, ["An invalid_request_error"]),
  k("error", "a rate_limit_error", 2, [
    "means you exceeded a request or token limit",
    "is returned with HTTP status 429",
    "comes with a retry-after header describing how long to wait",
  ], "get an error asking you to slow down", undefined, ["An overloaded_error"]),
  k("error", "an api_error", 3, [
    "indicates an unexpected failure inside Anthropic's systems",
    "is returned with HTTP status 500",
    "is not caused by anything wrong in your request",
  ], undefined, undefined, ["An overloaded_error"]),
  k("error", "an overloaded_error", 3, [
    "means the API is temporarily overloaded",
    "is returned with HTTP status 529",
    "is a reason to retry later with backoff",
  ], undefined, undefined, ["An api_error", "A rate_limit_error"]),

  // ---- reliability
  k("reliability", "Exponential backoff", 2, [
    "waits longer after each failed attempt before retrying",
    "prevents a retry storm during an outage or rate limiting",
    "is combined with a cap on the number of attempts",
  ]),
  k("reliability", "Jitter", 3, [
    "adds randomness to retry delays",
    "prevents many clients from retrying at the same instant",
    "is added on top of backoff",
  ], undefined, undefined, ["Exponential backoff"]),
  k("reliability", "the retry-after header", 3, [
    "tells a client how long to wait before retrying",
    "accompanies rate-limit responses",
    "is preferred over guessing a delay",
  ]),
  k("reliability", "an anthropic-ratelimit header", 4, [
    "reports the remaining capacity or reset time for a limit",
    "lets a client slow down before hitting a 429",
    "exists separately for requests and for tokens",
  ]),
  k("reliability", "Concurrency limiting", 3, [
    "caps how many requests run at the same time",
    "is usually implemented with a semaphore or queue",
    "smooths bursts that would trigger rate limits",
  ]),
  k("reliability", "Model fallback", 4, [
    "switches to another model when the first fails or is unavailable",
    "keeps a feature running during a partial outage",
    "needs both models' outputs to be handled in the same format",
  ]),
  k("reliability", "Idempotent retry design", 4, [
    "makes repeating a request harmless",
    "uses keys stored on your side so tool side effects run once",
    "matters when a tool sends an email or charges a card",
  ]),
  k("reliability", "Streaming long outputs", 3, [
    "avoids timeouts on requests that generate a lot of text",
    "is advised by the SDKs when max_tokens is large",
    "keeps the connection active as chunks arrive",
  ]),
  k("reliability", "Graceful degradation on overload", 4, [
    "queues work or serves a simpler result when the API reports overload",
    "keeps users informed instead of showing a raw error",
    "is paired with retry limits rather than endless retries",
  ]),

  // ---- prompting
  k("prompting", "Direct instruction writing", 1, [
    "states exactly what you want and the format you need",
    "gives Claude context such as the audience and purpose",
    "reduces the guessing that leads to off-target answers",
  ]),
  k("prompting", "XML tag structuring", 2, [
    "wraps parts of a prompt such as documents and examples in named tags",
    "reduces confusion between instructions and data",
    "lets the prompt refer to a section by its tag name",
  ], "need to keep pasted documents separate from your instructions"),
  k("prompting", "Role prompting", 2, [
    "gives Claude a role in the system prompt to focus tone and expertise",
    "shapes the style and depth of the answers",
    "is a lightweight alternative to fine-tuning for voice",
  ]),
  k("prompting", "Multishot prompting", 2, [
    "includes several examples of the desired input and output",
    "shows format and style more reliably than description alone",
    "works best when the examples are varied and relevant",
  ], "want Claude to copy an output format shown by example"),
  k("prompting", "Chain-of-thought prompting", 3, [
    "asks Claude to reason step by step before answering",
    "can be done in the prompt without extended thinking",
    "benefits from separating the reasoning from the final answer with tags",
  ]),
  k("prompting", "Long-context ordering", 3, [
    "places long documents near the top and the question at the end",
    "tends to improve answers on large inputs",
    "applies when a prompt contains several lengthy documents",
  ]),
  k("prompting", "Prompt chaining", 3, [
    "splits a task into sequential prompts whose outputs feed the next",
    "makes each step easier to check and debug",
    "trades extra calls for clearer control",
  ]),
  k("prompting", "Permission to say I do not know", 3, [
    "tells Claude it may admit that information is missing",
    "reduces fabricated answers",
    "is a simple instruction added to the prompt",
  ]),
  k("prompting", "Quote-first grounding", 4, [
    "asks Claude to extract relevant quotes before answering",
    "ties the answer to text actually in the document",
    "makes unsupported claims easier to spot",
  ]),

  // ---- safety
  k("safety", "Constitutional AI", 3, [
    "trains a model using a written set of principles",
    "has the model critique and revise its own outputs against those principles",
    "uses AI-generated feedback guided by the principles in a later stage",
  ]),
  k("safety", "Refusal handling", 3, [
    "treats a declined request as a normal outcome the application must handle",
    "checks for the refusal stop reason or refusal text",
    "shows the user a helpful message instead of a blank result",
  ]),
  k("safety", "Prompt injection", 3, [
    "is untrusted text that tries to override your instructions",
    "can arrive in web pages or documents that Claude reads",
    "is reduced by limiting tool permissions and treating fetched text as data",
  ], "read outside emails with an agent that could be tricked into acting on them"),
  k("safety", "Least-privilege tool design", 4, [
    "gives an agent only the tools and permissions it needs",
    "limits the damage if the model is tricked or makes a mistake",
    "prefers narrow, purpose-built tools over a general shell",
  ]),
  k("safety", "Human approval for risky actions", 4, [
    "pauses before irreversible actions such as sending or deleting",
    "puts a person in the loop for high-impact tool calls",
    "is a control that does not depend on the model behaving correctly",
  ], "let an agent draft emails but have a person approve each send"),
  k("safety", "a workspace", 3, [
    "separates API keys and usage by project or team in the Console",
    "lets you scope access and limits per environment",
    "reduces the blast radius of a leaked key",
  ]),
  k("safety", "API key hygiene", 2, [
    "keeps keys in environment variables or a secrets manager",
    "never ships a key in client-side or public code",
    "rotates a key immediately if it may have leaked",
  ]),
  k("safety", "Output validation", 3, [
    "checks model output against a schema or rules before it is used",
    "catches malformed or unsafe results before they trigger actions",
    "treats generated text as untrusted input to the next system",
  ]),
  k("safety", "Hallucination", 2, [
    "is a fluent statement that is not supported by facts",
    "is reduced by grounding answers in provided documents",
    "can be limited by asking for citations or quotes",
  ]),
];


const link = (...names: string[]) => {
  for (const a of names) {
    const c = cards.find((x) => x.subject.toLowerCase() === a.toLowerCase());
    if (!c) throw new Error("link: unknown subject " + a);
    c.like = [...new Set([...(c.like ?? []), ...names.filter((n) => n !== a)])];
  }
};
link("The user role", "The assistant role");
link("a tool_use block", "a tool_result block");
link("The content_block_start event", "The content_block_stop event");
link("The message_delta event", "The message_stop event");
link("The refusal stop reason", "Refusal handling");
link("The stop_sequences parameter", "The stop_sequence stop reason", "The stop_sequence field");
link("The max_tokens parameter", "The max_tokens stop reason");
link("the tool loop", "The tool_use stop reason");
link("anthropic.RateLimitError", "A rate_limit_error");
link("The thinking parameter", "A thinking block", "The thinking budget");
link("The signature field", "Redacted thinking", "Preserving thinking blocks in a tool loop");
link("The system parameter", "a document content block", "The messages array");

const qa: QA[] = [
  q(1, "Which role names does the Messages API accept in the messages array?", "user and assistant", ["system and user", "human and ai", "user, assistant and tool"],
    "The messages array alternates user and assistant turns; the system prompt is a separate parameter, and tool results go in a user message."),
  q(1, "Where does the system prompt go in a Messages API request?", "In the top-level system parameter", ["As the first message with role system", "Inside the metadata field", "In a header named x-system"],
    "Claude's system prompt is a top-level parameter rather than a message.",
    `client.messages.create(
    model=MODEL,
    max_tokens=512,
    system="You are a terse code reviewer.",
    messages=[{"role": "user", "content": "Review this diff"}],
)`),
  q(1, "Which parameters are required for client.messages.create?", "model, max_tokens and messages", ["model and prompt only", "messages and temperature", "model, system and stream"],
    "The Messages API requires a model, a max_tokens limit and the messages."),
  q(1, "How do you read the reply text of the first block in Python?", "message.content[0].text", ["message.choices[0].message.content", "message.text", "message.output_text[0]"],
    "The reply is a list of content blocks; a text block has a text attribute.",
    `message = client.messages.create(model=MODEL, max_tokens=256,
                                  messages=[{"role": "user", "content": "Hi"}])
print(???)`),
  q(2, "What does a stop_reason of max_tokens tell you?", "The reply was cut off by the max_tokens limit", ["Claude finished its answer", "A stop string was produced", "Claude wants to call a tool"],
    "max_tokens means output hit the cap, so the answer may be incomplete."),
  q(2, "In a tool loop, what does stop_reason tool_use mean for your code?", "Run the requested tool and send back a tool_result", ["The conversation is finished", "The request was rejected", "Resend the same request unchanged"],
    "Your code executes the tool and calls the API again with the result."),
  q(2, "Which message returns a tool's output to Claude?", "A user message containing a tool_result block with the matching tool_use_id", ["An assistant message containing the output text", "A system message with the tool name", "A tool message with role tool"],
    "Tool results are sent back in a user turn and reference the tool_use_id.",
    `{"role": "user", "content": [
    {"type": "tool_result", "tool_use_id": "toolu_123", "content": "72F and sunny"}
]}`),
  q(3, "What is wrong with this tool result?", "It is missing tool_use_id, so it cannot be matched to the request", ["The content should be a number", "The role must be assistant", "The type should be tool_call"],
    "Each tool_result must reference the id of the tool_use block it answers.",
    `{"role": "user", "content": [
    {"type": "tool_result", "content": "72F and sunny"}
]}`),
  q(2, "What does this tool definition's input_schema do?", "Describes the expected JSON input for Claude to fill in", ["Runs the function on Anthropic's servers", "Restricts which users may call the tool", "Sets the tool's output format"],
    "The input_schema is a JSON Schema that guides what Claude sends.",
    `tools=[{
    "name": "get_weather",
    "description": "Get the current weather for a city",
    "input_schema": {"type": "object",
                     "properties": {"city": {"type": "string"}},
                     "required": ["city"]},
}]`),
  q(3, "Which tool_choice value forces Claude to call this specific tool?", "{\"type\": \"tool\", \"name\": \"get_weather\"}", ["{\"type\": \"auto\"}", "{\"type\": \"any\"}", "{\"type\": \"function\", \"name\": \"get_weather\"}"],
    "type tool with a name forces that tool; any only forces some tool."),
  q(3, "What does `cache_control` do in this system block?", "Marks the end of a prefix that can be cached for reuse", ["Encrypts the system text", "Prevents the system text from being logged", "Makes Claude remember the text across chats"],
    "A cache_control breakpoint caches everything up to and including that block.",
    `system=[{"type": "text", "text": LONG_INSTRUCTIONS,
         "cache_control": {"type": "ephemeral"}}]`),
  q(4, "A usage object shows cache_read_input_tokens greater than zero. What does it mean?", "Part of the prompt prefix was served from the cache", ["The reply was cached and generation was skipped", "The batch has ended", "The prompt was too short to cache"],
    "Cache reads count input tokens that matched a cached prefix."),
  q(4, "A cached prompt stops hitting the cache after you insert a timestamp at the very start of the system text. Why?", "Changing the early prefix invalidates the cache from that point on", ["Timestamps are blocked by the API", "The cache only works for numeric text", "cache_control is ignored in system prompts"],
    "Caching matches an identical prefix, so variable content should come last."),
  q(2, "How can you stream text with the Python helper?", "Use `with client.messages.stream(...) as stream:` and iterate stream.text_stream", ["Call client.messages.create(stream=False) and loop over the string", "Pass callback=print to create", "Use client.messages.listen() in a while loop"],
    "The stream helper is a context manager that exposes text_stream.",
    `with client.messages.stream(model=MODEL, max_tokens=512,
                            messages=[{"role": "user", "content": "Hi"}]) as stream:
    for text in stream.text_stream:
        print(text, end="")`),
  q(3, "In a raw stream, which event tells you the stop_reason?", "message_delta", ["message_start", "content_block_stop", "ping"],
    "message_delta carries top-level changes such as stop_reason and usage."),
  q(3, "In what order do these events occur for a one-block text reply?", "message_start, content_block_start, content_block_delta, content_block_stop, message_delta, message_stop", ["content_block_start, message_start, message_delta, content_block_delta, message_stop, content_block_stop", "message_start, content_block_delta, content_block_start, message_stop, message_delta, content_block_stop", "message_delta, message_start, content_block_start, content_block_delta, content_block_stop, message_stop"],
    "A message opens, the block opens, deltas arrive, the block closes, then the message ends."),
  q(4, "A streamed tool_use block arrives as many input_json_delta events. When should you parse the JSON?", "After the content_block_stop for that block", ["On every delta as it arrives", "Before the content_block_start", "Only after message_start"],
    "The partial JSON strings must be concatenated first."),
  q(3, "Which Python exception class corresponds to an HTTP 429?", "anthropic.RateLimitError", ["anthropic.TooManyRequestsError", "anthropic.QuotaExceeded", "anthropic.ThrottledError"],
    "The SDK maps 429 to RateLimitError."),
  q(2, "Which header carries the API key in a raw REST request?", "x-api-key", ["Authorization: Basic", "api-token", "x-claude-secret"],
    "Raw calls use x-api-key plus an anthropic-version header; the SDK adds these for you.",
    `curl https://api.anthropic.com/v1/messages \\
  -H "content-type: application/json" \\
  -H "???: $ANTHROPIC_API_KEY" ...`),
  q(2, "A request returns HTTP 401. What is the most likely problem?", "The API key is missing or invalid", ["The prompt is too long", "The model is overloaded", "The batch has not ended"],
    "401 corresponds to an authentication_error."),
  q(3, "Which status code does the API use to report that it is temporarily overloaded?", "529", ["503", "502", "408"],
    "Anthropic uses 529 with an overloaded_error."),
  q(3, "What should a client do first when it receives a 429 with a retry-after header?", "Wait at least that long before retrying", ["Retry immediately with a bigger max_tokens", "Switch to the Text Completions API", "Give up permanently"],
    "The header tells you how long to wait, and backoff avoids a retry storm."),
  q(3, "What does this retry loop implement?", "Exponential backoff with jitter", ["A circuit breaker", "Token-bucket rate limiting", "A fixed polling interval"],
    "The delay doubles each attempt with random jitter added.",
    `for attempt in range(5):
    try:
        return client.messages.create(**params)
    except anthropic.RateLimitError:
        time.sleep(2 ** attempt + random.random())`),
  q(3, "What do these client settings do?", "Turn off SDK retries and fail after ten seconds", ["Retry forever every ten seconds", "Limit output to ten tokens", "Cache replies for ten seconds"],
    "max_retries=0 disables automatic retries; timeout is the wait limit.",
    `client = anthropic.Anthropic(max_retries=0, timeout=10.0)`),
  q(3, "Why must you check `block.type == \"text\"` before reading block.text in TypeScript?", "Content blocks are a union and not all of them have a text field", ["Text is stored in the type field", "The API returns text only in streaming mode", "TypeScript hides text unless asked"],
    "Narrowing the union avoids reading text from a tool_use or thinking block.",
    `const block = message.content[0];
if (block.type === "text") {
  console.log(block.text);
}`),
  q(2, "How do you create the async Python client?", "anthropic.AsyncAnthropic()", ["anthropic.Anthropic(async=True)", "anthropic.aio.Client()", "anthropic.Anthropic().async_mode()"],
    "AsyncAnthropic is the dedicated async client used with await."),
  q(3, "What is wrong with calling the sync client inside this async function?", "It blocks the event loop; use AsyncAnthropic and await", ["Nothing, it becomes async automatically", "The API rejects calls from coroutines", "It disables streaming"],
    "A synchronous call holds the thread until the request returns.",
    `client = anthropic.Anthropic()
async def handler():
    return client.messages.create(model=MODEL, max_tokens=256, messages=msgs)`),
  q(3, "What does this thinking configuration request?", "Extended thinking with up to a set number of reasoning tokens", ["A fixed number of retries", "A cap on output of exactly 2000 tokens", "Streaming at a slower pace"],
    "The thinking parameter enables reasoning with a budget_tokens limit.",
    `client.messages.create(
    model=MODEL, max_tokens=4000,
    thinking={"type": "enabled", "budget_tokens": 2000},
    messages=msgs)`),
  q(4, "Where does a thinking block appear in the response content array?", "Before the final text block", ["After the text block", "Inside the usage object", "In a separate response header"],
    "Reasoning is delivered ahead of the answer."),
  q(5, "When thinking is on and you run a tool loop, what must you do with the thinking blocks?", "Pass them back unchanged along with the tool result", ["Delete them to save tokens", "Rewrite them as text blocks", "Move them into the system prompt"],
    "Thinking blocks carry a signature and must be returned unmodified."),
  q(3, "Which block type do you use to give Claude a PDF?", "A document block", ["An image block", "A file_text block", "A pdf_stream block"],
    "PDFs are passed as document content blocks.",
    `{"role": "user", "content": [
    {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": B64}},
    {"type": "text", "text": "Summarise this report"}
]}`),
  q(3, "Why does each batch request carry a custom_id?", "Results may return in any order, so the id matches results to requests", ["It sets the model for the request", "It orders the requests by priority", "It authenticates each request"],
    "Batch outputs are matched back to inputs through custom_id.",
    `{"custom_id": "doc-17", "params": {"model": MODEL, "max_tokens": 200,
                                 "messages": [{"role": "user", "content": "Summarise"}]}}`),
  q(2, "A batch is still processing. What should your code do?", "Poll the batch until processing_status reports ended, then fetch results", ["Read the results immediately from the create call", "Resend the batch", "Switch the batch to streaming"],
    "Batches are asynchronous; results are available only after the batch has ended."),
  q(3, "How do you get strictly shaped JSON out of Claude without a dedicated JSON mode?", "Define a tool whose input_schema is the desired shape and force it with tool_choice", ["Set temperature to zero and hope", "Put the word JSON in max_tokens", "Use the stop_sequences parameter with braces"],
    "A forced tool call returns an input object matching the schema.",
    `tools=[{"name": "record", "description": "Save the result", "input_schema": SCHEMA}],
tool_choice={"type": "tool", "name": "record"}`),
  q(3, "A reply stops mid-JSON and stop_reason is max_tokens. What is the fix?", "Raise max_tokens or ask for shorter output", ["Lower the temperature", "Add a stop sequence", "Switch to the models endpoint"],
    "The cap was hit before Claude could finish."),
  q(1, "Which feature shows generated code or a web page in a window next to the chat?", "Artifacts", ["Projects", "Response styles", "Connectors"],
    "Artifacts render generated content beside the conversation."),
  q(1, "Which Claude app feature keeps chats and reference files together under shared instructions?", "Projects", ["Artifacts", "Extended thinking mode", "Web search in the app"],
    "Projects bundle knowledge and instructions for an ongoing topic."),
  q(2, "An agent reads untrusted web pages and has a tool that sends emails. Which control reduces injection risk most?", "Require human approval before it sends and treat page text as data", ["Raise the temperature", "Add the word 'secure' to the prompt", "Increase max_tokens"],
    "Controls outside the model limit what an injected instruction can do."),
  q(2, "A key was pasted into a public repository. What is the first step?", "Revoke or rotate the key", ["Delete the file and keep using the key", "Wait to see if it is used", "Rename the key in the Console"],
    "A public key must be treated as compromised."),
  q(3, "A tool call times out and your code retries it. What design stops a payment tool from charging twice?", "An idempotency key stored on your side", ["A lower temperature", "Streaming the tool result", "A longer system prompt"],
    "Retries are safe only for idempotent operations."),
  q(4, "The API returns HTTP 200 and then the stream ends with an error event. How should you treat the call?", "As a failure, because errors can occur after the 200 status", ["As a success because the status was 200", "As a rate limit", "As a batch expiry"],
    "Streams can fail mid-flight, so you must handle error events."),
  q(4, "What is the purpose of the token counting endpoint?", "Count the tokens a request would use without generating a reply", ["Reduce the tokens in a prompt automatically", "Set a spending limit", "Cache the prompt"],
    "It lets you check prompt size before sending."),
  q(3, "How should you lay out a prompt that contains long documents and a question?", "Put the documents first and the question last, wrapped in XML tags", ["Put the question first and omit tags", "Interleave the question every paragraph", "Put the question in the system parameter only"],
    "Long-context guidance puts documents at the top and the query at the end."),
  q(4, "Which stop_reason indicates a long server-tool turn was paused and can be resumed?", "pause_turn", ["end_turn", "stop_sequence", "tool_use"],
    "pause_turn means send the response back so Claude can continue."),
  q(2, "What does the response id start with?", "msg_", ["req_", "resp_", "chatcmpl-"],
    "Message ids begin with msg_, while the request-id header identifies the HTTP call."),
];

const spec: TrackSpec = {
  slug: "api-claude-titan",
  name: "Claude & the Anthropic API: Novice to Titan",
  description: "Claude apps and features plus the Messages API: roles, stop reasons, streaming, tool use, caching, batches, thinking, SDKs, errors and safety.",
  roles: "developer,manager",
  groups: {
    product: "Claude app feature",
    platform: "Anthropic developer tool",
    endpoint: "API endpoint",
    structure: "message structure element",
    param: "request parameter",
    response: "response field or stop reason",
    stream: "streaming event",
    tool: "tool-use concept",
    cost: "caching, batch or cost feature",
    capability: "model capability",
    thinking: "extended thinking concept",
    sdk: "SDK feature",
    error: "API error type",
    reliability: "reliability technique",
    prompting: "prompting technique",
    safety: "safety or governance practice",
  },
  cards,
  qa,
  calc: [],
};
export default spec;
