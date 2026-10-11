import type { Card, QA, TrackSpec } from "../types";

type T = 1 | 2 | 3 | 4 | 5;
const k = (group: string, subject: string, tier: T, says: string[], use?: string, not?: string[], like?: string[]): Card => ({ group, subject, tier, says, use, not, like });
const q = (tier: T, qq: string, right: string, wrong: [string, string, string], why: string, code?: string, topic?: string): QA => ({ q: qq, right, wrong, tier, why, code, topic });

const cards: Card[] = [
  // ---- ChatGPT personalization / privacy settings
  k("setting", "Custom instructions", 1, [
    "stores standing preferences about you and how replies should be written",
    "applies to new conversations without retyping the preferences",
    "is edited in the settings rather than inside each chat",
  ], "want every new chat to answer in the same tone and format", ["only applies to the single chat where it was typed"], ["Memory"]),
  k("setting", "Memory", 1, [
    "can save details from your conversations to personalise later replies",
    "lets you view and delete individual saved items",
    "can be switched off entirely in the settings",
  ], "want ChatGPT to recall facts across separate conversations", ["is always on and cannot be reviewed by the user"], ["Custom instructions"]),
  k("setting", "Temporary Chat", 2, [
    "starts a conversation that does not appear in the sidebar history",
    "does not read from or write to saved memories",
    "suits a sensitive one-off question you do not want attached to your history",
  ], "ask a one-off question without leaving a trace in your history", ["permanently disables memory for your whole account"], ["Memory"]),
  k("setting", "Data controls", 2, [
    "let you choose whether your conversations may be used to improve the models",
    "sit in the settings alongside options to export or delete your data",
    "are where you opt out of model-training use of your chats",
  ], "need to opt out of your chats being used for model training", ["apply only to API traffic and never to ChatGPT conversations"], ["Temporary Chat"]),
  k("setting", "Data export", 2, [
    "provides a downloadable archive of your account's conversations",
    "is requested from the data controls in the settings",
    "is the way to keep a copy of your chat history outside ChatGPT",
  ], "want a personal backup of every conversation", undefined, ["Shared links"]),
  k("setting", "Shared links", 3, [
    "publish a snapshot of a conversation at a URL that anyone with the link can open",
    "leave out messages added after the link was created",
    "can be deleted so that the public URL stops working",
  ], "want to send a colleague a read-only copy of a conversation", ["update live as you keep chatting in the original conversation"], ["Data export"]),

  // ---- ChatGPT features
  k("feature", "Projects", 2, [
    "group related chats and files under one named workspace",
    "can carry their own instructions that apply to every chat inside them",
    "keep reference files available to all conversations in that workspace",
  ], "work on a long-running effort with shared files and context", ["merge every chat into one endless conversation"], ["The GPT builder"]),
  k("feature", "the GPT builder", 2, [
    "creates a custom assistant from instructions, knowledge files and optional actions",
    "needs no code to configure a reusable assistant",
    "produces assistants that can be shared by link",
  ], "want a reusable assistant with fixed instructions to hand to a team", ["requires retraining the underlying model for each assistant"], ["Projects"]),
  k("feature", "Canvas", 2, [
    "opens a side-by-side editing space next to the chat for writing and code",
    "lets you highlight a passage and request a targeted edit",
    "keeps a document or program as a working artefact that is refined across turns",
  ], "iteratively edit a long document or piece of code next to the conversation", undefined, ["Data analysis"]),
  k("feature", "Voice mode", 1, [
    "lets you hold a spoken conversation and hear spoken replies",
    "needs microphone access on your device",
    "shows a transcript of the spoken exchange in the conversation",
  ], "want to talk hands-free instead of typing"),
  k("feature", "ChatGPT search", 1, [
    "looks up current information on the web while answering",
    "includes links to the sources it used",
    "helps with recent events that the model's training data lacks",
  ], "need an answer about something that happened very recently", ["only answers from the model's frozen training data"], ["Deep research"]),
  k("feature", "Deep research", 3, [
    "runs a multi-step investigation across many sources before answering",
    "produces a long report with citations",
    "takes minutes rather than seconds to finish a request",
  ], "need a sourced, in-depth report on a broad topic", undefined, ["ChatGPT search"]),
  k("feature", "Data analysis", 2, [
    "lets you upload spreadsheets and other files and ask questions about them",
    "runs Python code in a sandbox to compute results and draw charts",
    "can return a modified file that you download",
  ], "want to explore a CSV and plot it without writing code yourself", undefined, ["Canvas"]),
  k("feature", "Image generation", 1, [
    "creates pictures from a text description inside the chat",
    "can restyle or edit an image you upload",
    "supports refining the result through follow-up messages",
  ], "want an illustration produced from a written description"),
  k("feature", "the model picker", 1, [
    "lets you choose which model answers the current chat",
    "is how you move between faster and more deliberate models",
    "offers only the models that your plan includes",
  ], "want a more deliberate model for a hard problem"),

  // ---- API endpoints
  k("endpoint", "Chat Completions", 1, [
    "accepts a messages array and returns the next assistant message",
    "is stateless, so you resend prior turns on every request",
    "is the long-established chat format that many third-party servers imitate",
  ], "need compatibility with servers that imitate the classic chat format", ["stores the conversation for you between requests"], ["The Responses API"]),
  k("endpoint", "the Responses API", 2, [
    "takes an input and returns a list of typed output items",
    "can chain turns with previous_response_id instead of resending history",
    "hosts built-in tools such as web search and file search",
  ], "want server-side conversation state and hosted tools in a single call", ["cannot call functions defined by the developer"], ["Chat Completions"]),
  k("endpoint", "the Embeddings API", 1, [
    "turns text into a vector of numbers",
    "returns vectors that can be compared by similarity",
    "accepts a list of strings in a single request",
  ], "need vectors to power semantic search", ["generates a written answer to a question"]),
  k("endpoint", "the Moderations API", 2, [
    "classifies text or images against content-safety categories",
    "returns a flagged value and per-category scores",
    "is used to screen user input or model output before acting on it",
  ], "want to screen user messages for harmful content before processing them"),
  k("endpoint", "the Batch API", 3, [
    "runs a file of many requests asynchronously within a completion window",
    "returns results in an output file rather than per request",
    "suits large workloads that do not need an immediate answer",
  ], "need to score a huge set of records overnight without real-time answers", ["returns each result within the same HTTP request"]),
  k("endpoint", "the Files API", 2, [
    "uploads documents that other endpoints can reference by file id",
    "stores files for purposes such as fine-tuning, batch and retrieval",
    "returns an id that is used instead of resending the content",
  ], "need to upload a dataset once and refer to it from later calls"),
  k("endpoint", "the Fine-tuning API", 3, [
    "creates and monitors training jobs that produce a customised model",
    "reads training examples from an uploaded file",
    "returns a new model identifier once a job succeeds",
  ], "want to launch a training job on your own examples"),
  k("endpoint", "the audio transcription endpoint", 2, [
    "converts speech in an uploaded audio file into text",
    "takes a file upload rather than a JSON text prompt",
    "has a sibling operation that translates speech into English text",
  ], "need a text transcript of a recorded meeting"),
  k("endpoint", "the Realtime API", 4, [
    "streams audio and events over a persistent connection such as WebSocket or WebRTC",
    "supports low-latency spoken conversations",
    "exchanges JSON events instead of making one request per turn",
  ], "build a live voice assistant with low latency", ["is a plain request-response endpoint for text only"]),
  k("endpoint", "the models endpoint", 1, [
    "lists the models that your key can access",
    "returns model ids that you can use in requests",
    "is read with a GET request",
  ], "want to check which model ids your key is allowed to call"),

  // ---- message elements
  k("message", "the system message", 1, [
    "sets high-level behaviour and context at the start of a conversation",
    "was the original role for top-level instructions in chat requests",
    "is written by the developer and not typed by end users",
  ], undefined, ["is shown to end users as part of the chat window by default"], ["The developer message"]),
  k("message", "the developer message", 2, [
    "carries application-level instructions that outrank user messages",
    "takes the place of the system role in requests to newer models",
    "is authored by the application, not typed by the end user",
  ], "want instructions that take priority over what the user types", undefined, ["The system message"]),
  k("message", "the user message", 1, [
    "carries the end user's question or input",
    "can include text and images in its content",
    "typically comes from the person using your application",
  ]),
  k("message", "the assistant message", 1, [
    "holds a reply generated by the model",
    "is how earlier model turns are included in the history you send",
    "may contain tool calls instead of text",
  ]),
  k("message", "the tool message", 3, [
    "returns the result of a function call to the model",
    "must reference the id of the tool call it answers",
    "is appended to the history after your code has run the function",
  ], "need to hand a function's output back to the model", undefined, ["The assistant message"]),
  k("message", "a few-shot example pair", 3, [
    "shows the desired behaviour with a sample user message and assistant reply",
    "is placed before the real user input in the messages array",
    "teaches by demonstration rather than by explicit description",
  ], "want to demonstrate an output format by example", undefined, ["The user message"]),
  k("message", "an image content part", 2, [
    "lets a user message include a picture alongside text",
    "is supplied as a URL or as base64-encoded data",
    "requires a model that accepts image input",
  ], "need the model to describe or read a screenshot"),

  // ---- request parameters
  k("param", "Temperature", 1, [
    "controls how random token sampling is",
    "makes output more deterministic as it approaches zero",
    "is not accepted by every model, such as some reasoning models",
  ], "want output that varies less between identical requests", ["sets the maximum length of the reply"], ["Top-p"]),
  k("param", "Top-p", 2, [
    "samples only from the smallest token set whose probabilities sum to p",
    "is also called nucleus sampling",
    "is the alternative to temperature for shaping randomness",
  ], undefined, undefined, ["Temperature"]),
  k("param", "the max output tokens limit", 2, [
    "caps how many tokens the model may generate",
    "cuts a reply off when the cap is reached",
    "limits generated output, not the size of the input",
  ], "need to bound the length of replies", ["reserves space in the context window for the prompt"]),
  k("param", "Stop sequences", 2, [
    "end generation when a listed string would appear",
    "are not included in the returned text",
    "let a prompt format finish a turn at a known marker",
  ]),
  k("param", "the seed parameter", 4, [
    "asks for repeatable sampling across identical requests",
    "gives best-effort determinism, not a guarantee",
    "only has a chance of matching outputs when all other parameters are identical",
  ], "want reproducible outputs for testing as far as possible", ["guarantees byte-identical output on every call"], ["Temperature"]),
  k("param", "Logprobs", 4, [
    "return the log probabilities of generated tokens",
    "can show the most likely alternative tokens at each position",
    "help gauge model confidence in a classification answer",
  ], "want to see how confident the model was in a label"),
  k("param", "the stream parameter", 2, [
    "asks for the response as incremental events",
    "changes the reply from a single JSON body into a series of chunks",
    "lowers perceived latency without shortening total generation",
  ], "want text to appear as it is produced", undefined, ["The n parameter"]),
  k("param", "the tool_choice parameter", 3, [
    "controls whether and which tools the model may call",
    "can force a specific function to be called",
    "accepts values such as auto, none and required",
  ], "need to force the model to call a particular function"),
  k("param", "the parallel_tool_calls setting", 4, [
    "allows the model to request several tool calls in one turn",
    "can be disabled to force one call at a time",
    "means your code must return a result for every call it receives",
  ]),
  k("param", "the store parameter", 4, [
    "controls whether the response is saved for later retrieval",
    "must be enabled for a stored response to be fetched or chained later",
    "is a Responses API option for server-side persistence",
  ]),
  k("param", "Reasoning effort", 4, [
    "controls how much thinking a reasoning model does before answering",
    "trades answer depth against latency and token use",
    "is only meaningful for models that support reasoning",
  ], "want a reasoning model to answer faster on an easy task"),
  k("param", "the n parameter", 3, [
    "asks for several alternative completions in one request",
    "adds extra entries to the choices array",
    "multiplies the output tokens that are generated",
  ], "want several candidate answers to compare", undefined, ["The stream parameter"]),

  // ---- tools
  k("tool", "the function tool", 1, [
    "lets the model request that your code run a function you described",
    "is defined by a name, a description and a JSON Schema for its parameters",
    "never runs on the provider's servers because your application executes it",
  ], "need the model to query your own database or API", ["executes your function automatically inside the platform"]),
  k("tool", "the file search tool", 2, [
    "searches documents in vector stores and feeds matches to the model",
    "is configured with the ids of the vector stores to search",
    "lets the model cite passages from your uploaded files",
  ], "want answers grounded in your uploaded documents without building retrieval yourself", undefined, ["The web search tool"]),
  k("tool", "the web search tool", 2, [
    "lets the model look up current web information during a response",
    "returns citations as URL annotations in the output",
    "accepts an approximate user location to localise results",
  ], "need up-to-date public information inside an API response", undefined, ["The file search tool"]),
  k("tool", "the code interpreter tool", 3, [
    "runs Python in a sandboxed container hosted by the platform",
    "can read uploaded files and create new ones",
    "suits calculations, data analysis and chart generation",
  ], "need exact arithmetic or a generated chart from data"),
  k("tool", "the remote MCP tool", 4, [
    "connects the model to tools exposed by an external MCP server",
    "is configured with the server's URL",
    "adds third-party capabilities without custom function glue code",
  ], "want to plug in tools that a third-party server already exposes"),
  k("tool", "the computer use tool", 5, [
    "lets the model propose mouse and keyboard actions based on screenshots",
    "relies on your code to perform each action and return a new screenshot",
    "should run in a sandboxed environment because its actions have real effects",
  ]),
  k("tool", "the image generation tool", 3, [
    "lets the model create or edit images as part of a response",
    "is invoked by the model when the conversation calls for a picture",
    "returns image data in the response output",
  ]),

  // ---- function calling steps
  k("fnstep", "a tool definition", 2, [
    "describes a function's name, purpose and parameter schema to the model",
    "tells the model what it may call and how to format the arguments",
    "relies on a clear description for the model to choose it correctly",
  ]),
  k("fnstep", "a tool call", 2, [
    "is the model's request to run a named function with arguments",
    "appears in the assistant output rather than being executed by the model",
    "carries an id used to match its result",
  ], undefined, undefined, ["a tool result"]),
  k("fnstep", "the arguments string", 3, [
    "contains the model's chosen parameters as a JSON-encoded string",
    "must be parsed and validated before your code uses it",
    "can be malformed or incomplete when strict mode is not used",
  ], undefined, undefined, ["Function-call validation"]),
  k("fnstep", "a tool result", 2, [
    "is what your code sends back after running the function",
    "must be linked to the matching call id",
    "is read by the model to write the final answer",
  ], undefined, undefined, ["a tool call"]),
  k("fnstep", "the tool loop", 3, [
    "repeats calling and returning results until the model gives a final answer",
    "ends when a response contains no further tool calls",
    "needs a maximum iteration limit to avoid runaway loops",
  ], "build an agent that may need several tool calls to finish a task"),
  k("fnstep", "strict mode for functions", 4, [
    "makes the model's arguments conform exactly to the declared JSON Schema",
    "is enabled with a strict flag in the function definition",
    "requires every property to be listed as required and extra properties to be disallowed",
  ], "need arguments that always match the declared schema"),
  k("fnstep", "function-call validation", 4, [
    "checks arguments against your own rules before anything runs",
    "protects against hallucinated or out-of-range values",
    "should still be done when the arguments look well formed",
  ], undefined, undefined, ["the arguments string"]),
  k("fnstep", "human confirmation for risky tools", 5, [
    "asks a person to approve actions that change data before the call runs",
    "limits damage when the model picks a wrong or injected action",
    "matters most for tools that send, delete or pay",
  ], "let an agent send emails but want a person to approve each one"),

  // ---- structured outputs
  k("format", "JSON mode", 2, [
    "guarantees the output is syntactically valid JSON",
    "does not guarantee that the JSON matches any particular schema",
    "still requires the prompt itself to ask for JSON",
  ], undefined, ["enforces the JSON Schema you supply"], ["Structured Outputs"]),
  k("format", "Structured Outputs", 2, [
    "makes the output follow a JSON Schema that you supply",
    "avoids missing required keys and invalid enum values",
    "is requested through a response format that includes a schema",
  ], "need the output to match a specific schema every time", ["only guarantees syntactically valid JSON"], ["JSON mode"]),
  k("format", "JSON Schema", 2, [
    "describes the expected shape, types and required fields of an object",
    "is the vocabulary used for both function parameters and structured outputs",
    "is supported only as a subset of its keywords in strict mode",
  ]),
  k("format", "the refusal field", 4, [
    "reports when the model declines a request instead of returning schema-valid data",
    "lets code tell a safety refusal apart from a parsing failure",
    "appears in place of the structured content",
  ]),
  k("format", "the SDK parse helper", 3, [
    "converts a Pydantic model into a response schema",
    "returns a parsed object on the message",
    "saves you from calling json.loads on the output yourself",
  ], "want typed Python objects back instead of raw JSON text"),
  k("format", "a nullable union type", 5, [
    "lets a strict schema allow a field to hold null",
    "keeps the key required while permitting an empty value",
    "is used instead of omitting a key because strict mode requires every field",
  ]),
  k("format", "an enum constraint", 3, [
    "restricts a field to a fixed list of allowed values",
    "is the schema tool for classification labels",
    "prevents the model from inventing a new category",
  ], "need the model to answer with exactly one of five known labels"),

  // ---- streaming
  k("stream", "the SSE transport", 2, [
    "carries streamed chunks over a single long-lived HTTP response",
    "sends lines that begin with data:",
    "ends a chat stream with a final [DONE] marker",
  ]),
  k("stream", "a delta", 2, [
    "holds the new fragment of content in each streamed chunk",
    "must be concatenated to rebuild the full message",
    "may be empty or None in some chunks, such as the first or last",
  ]),
  k("stream", "the include_usage stream option", 4, [
    "reports token usage in a final chunk at the end of a stream",
    "arrives with an empty choices list",
    "is switched on through the stream options",
  ]),
  k("stream", "Time to first token", 3, [
    "measures how long a user waits before output begins",
    "is what streaming improves for perceived responsiveness",
    "grows with prompt size and model load",
  ], "want to judge how fast a chat interface feels at the start"),
  k("stream", "Streamed tool-call arguments", 4, [
    "arrive as fragments of a JSON string across many chunks",
    "should be accumulated and parsed only after the call is complete",
    "cannot be safely parsed from a single partial chunk",
  ]),
  k("stream", "a typed stream event", 4, [
    "names its kind in a type field",
    "lets code branch on text deltas, tool calls and completion",
    "is how the Responses API structures streamed output",
  ]),
  k("stream", "Closing the stream early", 5, [
    "stops your client from receiving further output",
    "is how an application implements a stop-generating button",
    "does not undo tokens that were already generated",
  ]),
  k("stream", "Proxy buffering", 5, [
    "holds streamed chunks back so that they arrive in bursts",
    "must be turned off for streaming routes behind a reverse proxy",
    "makes a working stream look like one delayed response in the browser",
  ], "see a stream arrive all at once only when deployed behind a proxy"),

  // ---- response fields
  k("response", "the choices array", 2, [
    "holds the generated completions in a Chat Completions response",
    "contains one entry unless the n parameter asks for more",
    "carries each message together with its finish reason",
  ], undefined, undefined, ["The output array"]),
  k("response", "the finish_reason field", 2, [
    "explains why generation stopped",
    "reads length when the output hit the token cap",
    "reads tool_calls when the model wants a function run",
  ], "need to know whether a reply was cut off by the token limit"),
  k("response", "the usage object", 2, [
    "reports prompt, completion and total token counts",
    "is the source for tracking consumption per request",
    "can include details such as cached or reasoning tokens",
  ], "want to log how many tokens each call used"),
  k("response", "the output array", 3, [
    "holds typed items such as messages and tool calls in a Responses reply",
    "must be iterated instead of assuming the first item is text",
    "plays the role that choices plays in Chat Completions",
  ], undefined, undefined, ["The choices array", "output_text"]),
  k("response", "output_text", 3, [
    "gives the concatenated text of a response in the SDK",
    "saves digging through the output array for plain text",
    "is an SDK convenience rather than a raw API field",
  ], undefined, undefined, ["The output array"]),
  k("response", "the response id", 3, [
    "identifies a stored response for later retrieval or chaining",
    "is passed as previous_response_id to continue a conversation",
    "can be saved in your own records to resume a conversation later",
  ]),
  k("response", "the x-request-id header", 3, [
    "identifies one specific API call in a response header",
    "helps support staff trace a failing call",
    "should be logged alongside errors",
  ], "need something to quote when reporting a failed call"),
  k("response", "an incomplete status", 4, [
    "marks a Responses result that stopped before finishing",
    "comes with a reason such as reaching the max output limit",
    "should be handled instead of being treated as a full answer",
  ]),

  // ---- retrieval
  k("retrieval", "an embedding", 1, [
    "is a vector that represents the meaning of a piece of text",
    "places similar meanings close together in vector space",
    "has a fixed length for a given model",
  ]),
  k("retrieval", "Cosine similarity", 2, [
    "measures the angle between two vectors",
    "is the usual score for comparing embeddings",
    "ranges from -1 to 1",
  ], "need a score for how close two embeddings are", ["measures the length of a single vector"]),
  k("retrieval", "the dimensions parameter", 4, [
    "lets some embedding models return shorter vectors",
    "trades a little accuracy for smaller storage and faster search",
    "must be set the same for documents and queries",
  ], "want to shrink stored vectors to save space"),
  k("retrieval", "Chunking", 2, [
    "splits documents into smaller passages before embedding",
    "keeps each embedded unit focused and within input limits",
    "affects retrieval quality through chunk size and overlap",
  ], "have long manuals that must be indexed for search"),
  k("retrieval", "a vector store", 2, [
    "holds embedded document chunks for similarity search",
    "is created and filled by attaching uploaded files",
    "is what the file search tool queries",
  ]),
  k("retrieval", "Semantic search", 1, [
    "finds results by meaning rather than exact keywords",
    "embeds the query and compares it with document vectors",
    "can match a question to a passage that uses different words",
  ], undefined, undefined, ["Hybrid search"]),
  k("retrieval", "Hybrid search", 3, [
    "combines keyword matching with vector similarity",
    "catches exact terms like product codes that embeddings can blur",
    "merges two ranked lists into one result",
  ], "need exact part numbers and meaning-based matches together", undefined, ["Semantic search"]),
  k("retrieval", "Reranking", 4, [
    "rescores a shortlist of retrieved passages with a more precise model",
    "improves the order of candidates before they enter the prompt",
    "runs after the first fast retrieval step",
  ], "want better ordering of the top retrieved passages"),
  k("retrieval", "Metadata filtering", 4, [
    "restricts a search to documents whose attributes match",
    "narrows results by fields such as source, language or tenant",
    "helps keep one customer's documents out of another's results",
  ], "must search only the current customer's documents"),
  k("retrieval", "Embedding model consistency", 3, [
    "requires queries and documents to be embedded with the same model",
    "breaks similarity scores if the model changes without re-embedding",
    "means switching embedding models needs a full re-index",
  ]),

  // ---- customization / evaluation
  k("custom", "Supervised fine-tuning", 3, [
    "trains a model on example inputs paired with desired outputs",
    "suits consistent style, format or narrow behaviour",
    "produces a new model id that you call like any other",
  ], "want a consistent house style learned from hundreds of examples", ["is the recommended way to teach facts that change daily"], ["Preference fine-tuning"]),
  k("custom", "a fine-tuning training file", 3, [
    "is a JSONL file with one example conversation per line",
    "uses the same message structure as the chat API",
    "is uploaded through the Files API before a job starts",
  ]),
  k("custom", "a validation file", 4, [
    "supplies held-out examples to measure loss during training",
    "is optional for a fine-tuning job",
    "helps detect overfitting",
  ]),
  k("custom", "the epochs hyperparameter", 4, [
    "sets how many passes training makes over the dataset",
    "can cause overfitting when set too high",
    "is a setting of the fine-tuning job",
  ]),
  k("custom", "Preference fine-tuning", 5, [
    "trains on pairs of preferred and non-preferred responses",
    "is also known as direct preference optimisation",
    "shifts style and quality preferences rather than teaching a task from scratch",
  ], "have pairs of better and worse answers for the same prompt", undefined, ["Supervised fine-tuning"]),
  k("custom", "Reinforcement fine-tuning", 5, [
    "improves a reasoning model using a grader that scores its answers",
    "suits tasks whose correctness can be checked automatically",
    "needs a grader rather than only target outputs",
  ]),
  k("custom", "Distillation", 4, [
    "trains a smaller model on outputs from a larger one",
    "aims to keep task quality while lowering latency and cost",
    "depends on the larger model's outputs being good",
  ], "want a small fast model to imitate a big one on one task"),
  k("custom", "an eval", 2, [
    "scores model outputs against test cases you define",
    "is rerun after prompt or model changes to catch regressions",
    "turns a vague sense of quality into a repeatable measurement",
  ], "need to know whether a prompt change made things better"),

  // ---- errors
  k("error", "a 400 status", 1, [
    "indicates the request was malformed or had invalid parameters",
    "often includes a message naming the offending parameter",
    "is returned when a required field is missing from the body",
  ], undefined, undefined, ["Context length exceeded"]),
  k("error", "a 401 status", 1, [
    "means authentication failed",
    "is fixed by correcting the key, not by waiting",
    "appears when the Authorization header is missing or wrong",
  ], "see an error that says the API key is invalid", undefined, ["A 403 status"]),
  k("error", "a 403 status", 3, [
    "means the key is valid but not permitted for this resource or region",
    "signals an authorisation problem rather than an authentication problem",
    "can appear when calling from an unsupported country",
  ], undefined, undefined, ["A 401 status"]),
  k("error", "a 404 status", 2, [
    "means the requested path or resource was not found",
    "often follows a typo in the URL, file id or model name",
    "should be checked against the id returned when the object was created",
  ]),
  k("error", "a 429 status", 2, [
    "signals too many requests or tokens in a time window",
    "may come with headers describing the limits",
    "is cleared by slowing down",
  ], "get an error telling you to slow down your request rate", undefined, ["Insufficient quota"]),
  k("error", "Insufficient quota", 3, [
    "is returned with a 429 status but is not fixed by waiting",
    "means the account or project has run out of credit or budget",
    "is resolved in the billing settings",
  ], "keep getting 429 even at very low request rates and the dashboard shows no credit", undefined, ["A 429 status"]),
  k("error", "a 500 status", 2, [
    "indicates a failure inside the provider rather than a mistake in your request",
    "can appear intermittently on valid requests",
    "is not caused by anything you can fix in the request body",
  ], undefined, undefined, ["A 503 status", "A 429 status"]),
  k("error", "a 503 status", 3, [
    "signals the service is overloaded or briefly unavailable",
    "often clears after a short wait",
    "is a reason to reduce traffic and try again later",
  ], undefined, undefined, ["A 500 status", "A 429 status"]),
  k("error", "Context length exceeded", 3, [
    "occurs when the prompt plus requested output do not fit the model's window",
    "is reported as a 400 error mentioning the maximum context",
    "is fixed by trimming, summarising or retrieving less",
  ], undefined, undefined, ["A 400 status"]),
  k("error", "a client timeout", 3, [
    "occurs when the response takes longer than the client allows",
    "does not tell you whether the server finished the work",
    "is controlled by a client-side setting",
  ]),

  // ---- reliability and cost
  k("resilience", "Exponential backoff", 2, [
    "waits longer after each failed attempt before retrying",
    "prevents a retry storm during an outage or rate limiting",
    "is combined with a cap on the number of attempts",
  ], "handle repeated 429 and 5xx responses gracefully"),
  k("resilience", "Jitter", 3, [
    "adds randomness to retry delays",
    "prevents many clients from retrying at the same instant",
    "is added on top of backoff",
  ], undefined, undefined, ["Exponential backoff"]),
  k("resilience", "the x-ratelimit-remaining-requests header", 4, [
    "reports how many requests are left in the current window",
    "lets a client slow down before a 429 occurs",
    "is one of several rate-limit headers on responses",
  ]),
  k("resilience", "a token-per-minute limit", 2, [
    "counts tokens in prompts and outputs over a minute",
    "can be hit even when request counts are low",
    "makes large prompts consume the allowance faster than small ones",
  ], "see rate limits despite sending only a few huge prompts"),
  k("resilience", "Idempotent retry design", 4, [
    "makes repeating a request harmless",
    "uses keys stored on your side so tool side effects run once",
    "matters when a tool call sends an email or charges a card",
  ]),
  k("resilience", "Concurrency limiting", 3, [
    "caps how many requests run at the same time",
    "is usually implemented with a semaphore or queue",
    "smooths bursts that would trigger rate limits",
  ]),
  k("resilience", "Model fallback", 4, [
    "switches to another model when the first fails or is unavailable",
    "keeps a feature running during a partial outage",
    "needs both models' outputs to be handled in the same format",
  ]),
  k("resilience", "a circuit breaker", 5, [
    "stops sending calls after repeated failures for a cooling-off period",
    "protects your app and the provider from a failing dependency",
    "reopens gradually by testing with a few requests",
  ]),
  k("resilience", "Prompt caching", 3, [
    "reuses processing of an identical prompt prefix across requests",
    "works best when static content comes first and variable content last",
    "reduces latency for repeated long prefixes",
  ], "send the same long instructions at the start of thousands of requests"),
  k("resilience", "Conversation trimming", 3, [
    "drops or summarises old turns to stay within the context window",
    "keeps long chats from hitting the context limit",
    "has to preserve the system or developer instructions",
  ]),

  // ---- SDK
  k("sdk", "the client object", 1, [
    "is created once and reused for all requests",
    "holds configuration such as the API key and timeout",
    "exposes resources like chat, responses and embeddings",
  ]),
  k("sdk", "the OPENAI_API_KEY variable", 1, [
    "is read automatically by the SDK when no key is passed",
    "keeps the secret out of source code",
    "is set in the environment of the process running the app",
  ], "want the SDK to find the key without hard-coding it"),
  k("sdk", "AsyncOpenAI", 3, [
    "is the asynchronous Python client used with async and await",
    "lets many requests run concurrently in one event loop",
    "has the same method names as the synchronous client",
  ], "need to run many requests concurrently inside an async web server"),
  k("sdk", "the max_retries option", 3, [
    "sets how many times the SDK retries certain failures automatically",
    "covers connection errors, rate limits and server errors",
    "applies a short backoff between attempts",
  ]),
  k("sdk", "the timeout option", 3, [
    "sets how long the SDK waits for a response",
    "can be set on the client or per request",
    "raises a timeout error when exceeded",
  ]),
  k("sdk", "the base_url option", 4, [
    "points the SDK at a different API host",
    "allows routing through a proxy or a compatible server",
    "expects the URL prefix that API paths are appended to",
  ], "want to send SDK traffic through your own gateway"),
  k("sdk", "with_raw_response", 4, [
    "gives access to response headers and status along with the parsed body",
    "is how to read rate-limit headers from the Python SDK",
    "wraps the same method call in a raw-response accessor",
  ]),
  k("sdk", "Auto-pagination", 4, [
    "iterates list results across pages without manual cursor handling",
    "works by looping directly over the returned list object",
    "fetches the next page when the loop reaches the end of the current one",
  ]),
  k("sdk", "a typed SDK exception", 3, [
    "lets code handle failure kinds separately, such as rate-limit versus connection errors",
    "includes the HTTP status code for errors returned by the API",
    "derives from a common base error class",
  ]),
  k("sdk", "the SDK stream iterator", 3, [
    "yields event objects one at a time when streaming is enabled",
    "is consumed with a for loop, or async for in the async client",
    "keeps the HTTP connection open until iteration finishes",
  ]),

  // ---- safety and account controls
  k("safety", "Prompt injection", 3, [
    "is untrusted text that tries to override your instructions",
    "can arrive inside web pages or documents that the model reads",
    "is reduced by limiting tool permissions and treating retrieved text as data",
  ], "read outside emails with an agent that could be tricked into acting on them"),
  k("safety", "an API key", 1, [
    "authenticates server requests to the API",
    "is sent in an Authorization header as a bearer token",
    "must never be embedded in client-side code",
  ]),
  k("safety", "a project-scoped key", 3, [
    "limits a key's access to one project",
    "lets you separate environments such as staging and production",
    "reduces the damage if a single key leaks",
  ]),
  k("safety", "Key rotation", 3, [
    "replaces a credential with a new one on a schedule or after exposure",
    "is done by creating the new key before revoking the old one",
    "limits how long a leaked key stays usable",
  ]),
  k("safety", "a backend proxy", 2, [
    "keeps the API key on your server while browsers call your own endpoint",
    "is the standard way to use the API from a web application",
    "lets you add authentication and rate limits for your own users",
  ], "build a browser app that calls the API without exposing the key"),
  k("safety", "a spend limit", 3, [
    "caps how much a project or organisation can use",
    "protects against runaway loops and leaked keys",
    "is configured in the account's billing or usage settings",
  ]),
  k("safety", "a per-user identifier", 4, [
    "tags requests with a stable, hashed id for the end user",
    "helps detect abuse coming from specific users",
    "should not contain raw personal information",
  ]),
  k("safety", "Output guardrails", 4, [
    "check model output before it reaches users or triggers actions",
    "can use a moderation call, rules or a second model",
    "catch unsafe or malformed results that the prompt alone did not prevent",
  ]),
  k("safety", "Personal data minimisation", 3, [
    "means sending the model only the fields a task needs",
    "reduces exposure if prompts are logged or leaked",
    "is applied by redacting identifiers before the request is built",
  ]),
];


const link = (...names: string[]) => {
  for (const a of names) {
    const c = cards.find((x) => x.subject.toLowerCase() === a.toLowerCase());
    if (!c) throw new Error("link: unknown subject " + a);
    c.like = [...new Set([...(c.like ?? []), ...names.filter((n) => n !== a)])];
  }
};
link("The tool message", "a tool result", "a tool call");
link("The function tool", "a tool definition");
link("A 429 status", "The x-ratelimit-remaining-requests header");
link("The stream parameter", "The SSE transport");
link("The max output tokens limit", "The finish_reason field");
link("Preference fine-tuning", "Reinforcement fine-tuning");
link("The remote MCP tool", "The function tool");
link("The code interpreter tool", "Data analysis");

const qa: QA[] = [
  q(1, "Which expression reads the reply text from a Chat Completions response held in `resp`?", "resp.choices[0].message.content", ["resp.message.text", "resp.output_text[0]", "resp.choices.text"],
    "In Chat Completions the reply lives on the first entry of the choices array.",
    `from openai import OpenAI
client = OpenAI()
resp = client.chat.completions.create(
    model=MODEL,
    messages=[{"role": "user", "content": "Say hi"}],
)`),
  q(2, "Which attribute gives the plain text of a Responses API result?", "response.output_text", ["response.choices[0].message.content", "response.text.value", "response.data[0].text"],
    "The SDK exposes output_text as a convenience that joins the text of the output items.",
    `response = client.responses.create(model=MODEL, input="Say hi")
print(response.???)`),
  q(2, "What is `vec` after this call?", "A list of floats representing the text", ["A single float score for the text", "A dictionary of token counts", "The original string after normalisation"],
    "Embeddings are returned as a vector of numbers on data[0].embedding.",
    `emb = client.embeddings.create(model=EMBED_MODEL, input="hello")
vec = emb.data[0].embedding`),
  q(3, "Why does this streaming loop use `or \"\"`?", "delta.content can be None in some chunks, such as the first or last", ["It converts bytes to a string", "It strips the stop sequence from each chunk", "It prevents the SDK from retrying the stream"],
    "Chunks that carry only a role or finish reason have no content, so None must be guarded.",
    `stream = client.chat.completions.create(model=MODEL, messages=msgs, stream=True)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`),
  q(3, "This code returns a function result to the model but the next call fails. What is missing from the tool message?", "The tool_call_id of the call being answered", ["A name field with the model's name", "An assistant role instead of tool", "A finish_reason of tool_calls"],
    "A tool message must reference the id of the tool call it answers.",
    `msgs.append(resp.choices[0].message)
msgs.append({
    "role": "tool",
    "content": json.dumps(result),
})`),
  q(3, "Why is `json.loads` applied to the function arguments?", "The arguments arrive as a JSON-encoded string, not as a dict", ["The SDK returns them compressed", "The model returns Python pickles", "It validates the schema automatically"],
    "Function arguments are a string that must be parsed and then validated.",
    `call = resp.choices[0].message.tool_calls[0]
args = json.loads(call.function.arguments)`),
  q(3, "What does this retry helper implement?", "Exponential backoff with jitter", ["A circuit breaker", "Token-bucket rate limiting", "Linear polling with a fixed interval"],
    "The delay doubles on each attempt and a random amount is added.",
    `for attempt in range(5):
    try:
        return call_api()
    except openai.RateLimitError:
        time.sleep(2 ** attempt + random.random())`),
  q(2, "Which Python SDK exception corresponds to an HTTP 429 response?", "openai.RateLimitError", ["openai.QuotaError", "openai.TooManyRequestsError", "openai.ThrottleError"],
    "The SDK maps 429 to RateLimitError."),
  q(2, "Which Python SDK exception is raised for an invalid or missing API key (401)?", "openai.AuthenticationError", ["openai.PermissionDeniedError", "openai.BadRequestError", "openai.InvalidKeyError"],
    "401 maps to AuthenticationError; 403 maps to PermissionDeniedError."),
  q(2, "A reply ends with finish_reason set to \"length\". What happened?", "Generation hit the token cap and the reply was cut off", ["The model finished its answer naturally", "The model requested a tool call", "A safety filter blocked the answer"],
    "length means the max token limit was reached before the model finished."),
  q(3, "Which tool_choice value forces this exact function in Chat Completions?", "{\"type\": \"function\", \"function\": {\"name\": \"get_weather\"}}", ["\"auto\"", "\"required\"", "{\"force\": \"get_weather\"}"],
    "Naming the function in tool_choice forces that call; required only forces some tool call."),
  q(4, "In this request, what does `\"strict\": True` do?", "Forces the output to conform exactly to the supplied schema", ["Makes the model reply faster", "Rejects requests longer than the schema allows", "Turns off the model's refusals"],
    "Strict enables schema-constrained decoding for Structured Outputs.",
    `response_format={
    "type": "json_schema",
    "json_schema": {"name": "ticket", "strict": True, "schema": TICKET_SCHEMA},
}`),
  q(4, "A strict JSON Schema is rejected. Which pair of fixes does strict mode require for each object?", "Set additionalProperties to false and list every property in required", ["Set minProperties to 1 and remove all types", "Add a default for every property and drop required", "Set nullable to true on the root and drop properties"],
    "Strict mode needs closed objects with every property marked required.",
    `{"type": "object",
 "properties": {"title": {"type": "string"}, "urgent": {"type": "boolean"}}}`),
  q(3, "Why does a second call not remember the user's name?", "Chat Completions is stateless, so earlier messages must be included again", ["The temperature was too high", "The client object expired after one call", "Names are removed by the moderation filter"],
    "Nothing is stored between Chat Completions calls unless you resend the history.",
    `client.chat.completions.create(model=MODEL, messages=[{"role": "user", "content": "I am Sam."}])
r = client.chat.completions.create(model=MODEL, messages=[{"role": "user", "content": "What is my name?"}])`),
  q(3, "What does `previous_response_id` do here?", "Continues the earlier conversation on the server without resending history", ["Replays the earlier request and returns the cached reply", "Marks the earlier response as deleted", "Switches the call to the Batch API"],
    "The Responses API can chain turns using a stored response.",
    `r1 = client.responses.create(model=MODEL, input="I am Sam.")
r2 = client.responses.create(model=MODEL, input="What is my name?",
                             previous_response_id=r1.id)`),
  q(3, "A JSON reply is cut off mid-object and fails to parse. What is the most likely cause?", "The max output token limit was reached, so finish_reason is length", ["JSON mode was disabled by the stop sequence", "The embeddings model changed", "The API key lacks a project scope"],
    "Truncation by the token cap produces incomplete JSON; check finish_reason."),
  q(3, "How should a prompt be laid out to benefit from prompt caching?", "Put long static instructions first and variable user content last", ["Put the user's question first and the instructions after", "Randomise the order of sections on each request", "Place a unique request id at the very start"],
    "Caching matches on an identical prefix, so changing content early breaks reuse."),
  q(3, "You get 429 errors while sending only a handful of requests with very large prompts. What is the likely limit?", "The tokens-per-minute limit", ["The requests-per-day limit on embeddings", "The maximum file size limit", "The context length limit"],
    "Large prompts consume the token allowance quickly even when request counts are low."),
  q(2, "An API key was committed to a public repository. What should you do first?", "Revoke or rotate the key immediately", ["Delete the commit and keep using the key", "Wait to see whether anyone uses it", "Add the key to a .gitignore file"],
    "Anything pushed publicly must be treated as compromised, so the key must be revoked and replaced."),
  q(4, "An agent reads customer emails and can send emails. Which mitigation best reduces prompt-injection risk?", "Require human approval before it sends and treat email text as untrusted data", ["Raise the temperature so it ignores odd instructions", "Put 'ignore malicious emails' in the first user message only", "Increase the max output tokens"],
    "Limiting permissions and requiring confirmation contain what an injected instruction can do."),
  q(4, "A tool charges a card and the HTTP call times out, so your code retries. What design prevents a double charge?", "Use an idempotency key stored on your side so the charge runs once", ["Lower the temperature before retrying", "Switch to streaming", "Retry faster with no delay"],
    "Retries are only safe when the operation is idempotent."),
  q(3, "What is the effect of `stream=True` in this call?", "The call returns an iterator of chunk objects", ["The reply is returned as a single completed string", "The request is queued as a batch", "Token usage is no longer reported"],
    "Streaming turns the reply into incremental chunks that you iterate over.",
    `stream = client.chat.completions.create(model=MODEL, messages=msgs, stream=True)
print(type(stream))`),
  q(4, "What does this reasoning setting do?", "Asks a reasoning model to think less before answering", ["Lowers the temperature to zero", "Caps the reply at low token counts", "Forces the model to cite sources"],
    "Reasoning effort trades depth of thinking against latency and token use.",
    `client.responses.create(model=REASONING_MODEL, input=prompt, reasoning={"effort": "low"})`),
  q(4, "What does this request add to the response?", "Per-token log probabilities with the three most likely alternatives", ["Three alternative completions", "A three-token summary", "Three retries on failure"],
    "logprobs=True with top_logprobs adds probability data for each generated token.",
    `client.chat.completions.create(model=MODEL, messages=msgs, logprobs=True, top_logprobs=3)`),
  q(2, "With n=3, how many entries does resp.choices contain?", "Three", ["One", "Four", "Zero until the stream ends"],
    "n asks for several alternative completions, each as an entry in choices.",
    `resp = client.chat.completions.create(model=MODEL, messages=msgs, n=3)
print(len(resp.choices))`),
  q(2, "Which content part lets a Chat Completions user message include an image?", "{\"type\": \"image_url\", \"image_url\": {\"url\": ...}}", ["{\"type\": \"picture\", \"src\": ...}", "{\"role\": \"image\", \"content\": ...}", "{\"type\": \"file_text\", \"text\": ...}"],
    "Image input is a content part inside the user message's content list.",
    `{"role": "user", "content": [
    {"type": "text", "text": "What is in this picture?"},
    ???
]}`),
  q(3, "Where does a Chat Completions function tool put its parameter schema?", "In function.parameters as a JSON Schema object", ["In function.returns as a Python type", "In the system message", "In tool_choice"],
    "The parameters field holds the JSON Schema for the function's arguments.",
    `tools=[{"type": "function", "function": {
    "name": "get_weather",
    "description": "Get weather for a city",
    "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
}}]`),
  q(2, "With `stop=[\"END\"]`, what happens to the string END in the returned text?", "Generation stops when it would appear and it is not included", ["It is included and generation continues", "The API returns a 400 error", "It is replaced by an empty tool call"],
    "Stop sequences end generation and are omitted from the output.",
    `client.chat.completions.create(model=MODEL, messages=msgs, stop=["END"])`),
  q(2, "Which purpose value is used when uploading a training file for fine-tuning?", "fine-tune", ["training", "finetune-data", "tune"],
    "The Files API uses the fine-tune purpose for training data.",
    `f = client.files.create(file=open("train.jsonl", "rb"), purpose="???")`),
  q(3, "Which line is a valid training example for fine-tuning a chat model?", "{\"messages\": [{\"role\": \"user\", \"content\": \"Hi\"}, {\"role\": \"assistant\", \"content\": \"Hello!\"}]}", ["{\"prompt\": \"Hi\", \"completion\": \"Hello!\"}", "Hi,Hello!", "<user>Hi</user><assistant>Hello!</assistant>"],
    "Chat-model training data is JSONL with a messages array per line."),
  q(3, "What is the custom_id in a Batch API request line used for?", "Matching each result in the output file back to its input request", ["Choosing the model for that request", "Setting the priority of the request", "Authenticating the request"],
    "Results are not guaranteed to be in input order, so custom_id links them.",
    `{"custom_id": "req-1", "method": "POST", "url": "/v1/chat/completions",
 "body": {"model": MODEL, "messages": [{"role": "user", "content": "Hi"}]}}`),
  q(2, "What does `numpy.dot(a, b) / (norm(a) * norm(b))` compute for two embeddings?", "Their cosine similarity", ["Their Euclidean distance", "The number of shared tokens", "Their sum of squared errors"],
    "Dividing the dot product by both norms gives the cosine of the angle."),
  q(3, "What do these client settings do?", "Disable automatic SDK retries and fail after ten seconds", ["Retry forever with a ten second delay", "Cache replies for ten seconds", "Limit output to ten tokens"],
    "max_retries=0 turns off retries and timeout sets how long to wait.",
    `client = OpenAI(max_retries=0, timeout=10.0)`),
  q(4, "How can you read the x-request-id header from a Python SDK call?", "Call the method through with_raw_response and read raw.headers", ["Read resp.choices[0].headers", "Pass return_headers=True to create", "Parse it from the message content"],
    "with_raw_response exposes headers and status next to the parsed result.",
    `raw = client.chat.completions.with_raw_response.create(model=MODEL, messages=msgs)
rid = raw.headers.get("x-request-id")
resp = raw.parse()`),
  q(3, "What is wrong with calling the synchronous client inside this async function?", "It blocks the event loop; use AsyncOpenAI with await", ["Nothing, it automatically becomes async", "The model rejects calls from coroutines", "It disables streaming"],
    "A sync call occupies the event loop thread until the network call returns.",
    `client = OpenAI()
async def handler():
    return client.chat.completions.create(model=MODEL, messages=msgs)`),
  q(2, "What does this call return?", "A result with a flagged value and category scores", ["A rewritten safe version of the text", "A list of banned words found in it", "A token count for the text"],
    "The Moderations API classifies content and reports flagged status and scores.",
    `r = client.moderations.create(input=user_text)
print(r.results[0].flagged)`),
  q(1, "A user wants ChatGPT to answer in a formal tone in every new chat. Which feature fits?", "Custom instructions", ["Temporary Chat", "Shared links", "Data export"],
    "Custom instructions store standing preferences that apply to new conversations."),
  q(1, "Where do you delete a single saved item that ChatGPT remembered about you?", "In the memory management settings", ["In the Moderations API", "By renaming the chat", "By exporting your data"],
    "Memory items can be viewed and deleted individually."),
  q(2, "You want answers repeated as consistently as possible in tests. Which combination helps most?", "Low temperature and a fixed seed, with all other parameters identical", ["High top-p and n set to three", "Streaming enabled and a long system message", "A larger max output tokens value"],
    "Low randomness plus a seed gives best-effort reproducibility, not a guarantee."),
  q(2, "A shared link was created, then you kept chatting. What does a visitor to the link see?", "The snapshot as it was when the link was created", ["Every new message live", "Only your newest message", "Nothing until you re-share"],
    "Shared links publish a snapshot and exclude later messages."),
  q(4, "A stream works locally but arrives all at once in production behind a reverse proxy. Likely cause?", "Proxy buffering is holding chunks back", ["The temperature is too low", "The SSE protocol cannot pass through proxies", "The model ignores stream=True in production"],
    "Disable buffering on streaming routes so chunks flush immediately."),
  q(5, "A tool-call stream delivers function arguments in many chunks. When should you json.loads them?", "After the call's arguments are complete", ["On every chunk as it arrives", "Before the model starts the call", "Never, the SDK sends dicts"],
    "Partial JSON fragments are not parseable until fully accumulated."),
  q(5, "Your documents were embedded with one model and queries with another. What is the consequence?", "Similarity scores become unreliable and retrieval degrades", ["Nothing, vectors are interchangeable", "The API returns a 401", "Only the query is cut short"],
    "Different models produce incompatible vector spaces."),
  q(4, "A fine-tuned model scores well on training examples but poorly on new ones. Which setting is a likely culprit?", "Too many epochs causing overfitting", ["A missing stop sequence", "Too low a seed", "Using the Files API"],
    "Too many passes over a small dataset memorises it; a validation file helps detect this."),
  q(3, "Which role carries your application's instructions with higher priority than the user's messages in newer models?", "developer", ["assistant", "tool", "observer"],
    "The developer role is for application instructions that outrank user messages."),
];

const spec: TrackSpec = {
  slug: "api-openai-platform-titan",
  name: "ChatGPT & the OpenAI Platform: Novice to Titan",
  description: "ChatGPT features and the OpenAI API: messages, tools, structured outputs, streaming, embeddings, fine-tuning, errors and SDK usage.",
  roles: "developer,manager",
  groups: {
    setting: "ChatGPT personalization or privacy setting",
    feature: "ChatGPT feature",
    endpoint: "API endpoint",
    message: "message element",
    param: "request parameter",
    tool: "built-in or developer tool",
    fnstep: "function-calling concept",
    format: "structured-output concept",
    stream: "streaming concept",
    response: "response field",
    retrieval: "retrieval concept",
    custom: "customization or evaluation method",
    error: "API error condition",
    resilience: "reliability or cost technique",
    sdk: "SDK feature",
    safety: "security or safety practice",
  },
  cards,
  qa,
  calc: [],
};
export default spec;
