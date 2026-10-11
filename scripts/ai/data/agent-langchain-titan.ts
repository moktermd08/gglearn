import type { TrackSpec } from "../types";

const spec: TrackSpec = {
  slug: "agent-langchain-titan",
  name: "LangChain & LangGraph: Novice to Titan",
  description: "Build LLM applications with LangChain runnables, prompts, models, retrieval and tools, then orchestrate stateful agents with LangGraph graphs, persistence, interrupts and tracing.",
  roles: "developer",
  groups: {
    runnable: "LCEL or Runnable concept",
    prompt: "prompt or message class",
    model: "model or output-parsing concept",
    rag: "retrieval pipeline component",
    tool: "tool or agent concept",
    graph: "LangGraph concept",
    persist: "persistence or streaming feature",
    ops: "tracing or operations concept",
    pitfall: "common pitfall",
  },
  cards: [
    // ---------- runnable ----------
    {
      group: "runnable", subject: "The Runnable interface", tier: 1,
      says: ["is the shared interface that prompts, models, parsers and retrievers implement", "exposes invoke, batch and stream along with async versions", "lets components be composed because they all accept and return values the same way"],
      use: "want every component to be callable in a uniform way",
    },
    {
      group: "runnable", subject: "LCEL", tier: 1,
      says: ["is the LangChain Expression Language for composing runnables", "builds chains with the pipe operator", "gives streaming, batching and async support to a composed chain automatically"],
      not: ["is a separate programming language with its own compiler"],
    },
    {
      group: "runnable", subject: "The pipe operator", tier: 1,
      says: ["connects runnables so one output feeds the next input", "creates a RunnableSequence under the hood", "is written as prompt | model | parser"],
      like: ["RunnableSequence"],
    },
    {
      group: "runnable", subject: "RunnableSequence", tier: 2,
      says: ["runs its steps one after another, passing each output forward", "is what a chain built with the pipe operator becomes", "can itself be nested inside a larger chain"],
      like: ["The pipe operator", "RunnableParallel"],
    },
    {
      group: "runnable", subject: "RunnableParallel", tier: 2,
      says: ["runs several runnables on the same input at the same time", "returns a dictionary keyed by branch name", "is created automatically when a plain dict appears inside a chain"],
      use: "need to fetch context and pass the question through in the same step",
      like: ["RunnableSequence"],
    },
    {
      group: "runnable", subject: "RunnablePassthrough", tier: 2,
      says: ["returns its input unchanged", "is commonly used to forward the original question alongside retrieved context", "can add computed keys to a dict through its assign method"],
    },
    {
      group: "runnable", subject: "RunnableLambda", tier: 2,
      says: ["wraps an ordinary Python function so it can sit in a chain", "is applied automatically when a plain function is piped", "gives custom code the same invoke, batch and stream interface"],
      use: "need to put your own parsing function in the middle of a chain",
    },
    {
      group: "runnable", subject: "The invoke method", tier: 1,
      says: ["runs the runnable on one input and returns the final output", "blocks until the full result is ready", "is the synchronous entry point, with ainvoke as its async twin"],
      like: ["The stream method", "The batch method"],
    },
    {
      group: "runnable", subject: "The batch method", tier: 2,
      says: ["runs the runnable on a list of inputs and returns a list of outputs", "executes inputs concurrently up to a configurable limit", "accepts max_concurrency in its config"],
      like: ["The invoke method"],
    },
    {
      group: "runnable", subject: "The stream method", tier: 2,
      says: ["yields output chunks as they are produced", "lets a user interface show tokens before the full reply is done", "works through a chain only when each step can pass chunks along"],
      like: ["The invoke method"],
    },
    {
      group: "runnable", subject: "The astream_events method", tier: 4,
      says: ["streams a typed event for each step inside a chain", "exposes intermediate events such as model token chunks and tool starts", "is useful for showing progress of nested components"],
    },
    {
      group: "runnable", subject: "The with_retry method", tier: 3,
      says: ["wraps a runnable so failed calls are retried", "lets you set a maximum number of attempts", "is useful against transient network or rate-limit errors"],
      like: ["The with_fallbacks method"],
    },
    {
      group: "runnable", subject: "The with_fallbacks method", tier: 3,
      says: ["tries alternative runnables when the primary one raises an error", "lets a chain fall back to a different model", "keeps the same interface as the original runnable"],
      like: ["The with_retry method"],
    },
    {
      group: "runnable", subject: "RunnableConfig", tier: 3,
      says: ["is a dictionary of per-call settings such as tags, metadata and callbacks", "propagates automatically to every step of a chain", "carries max_concurrency and the recursion limit"],
    },
    {
      group: "runnable", subject: "The bind method", tier: 4,
      says: ["returns a runnable with fixed keyword arguments attached", "is how a model is given a stop sequence or tool list ahead of time", "does not mutate the original runnable"],
    },
    // ---------- prompt ----------
    {
      group: "prompt", subject: "PromptTemplate", tier: 1,
      says: ["formats a single string from a template with placeholders", "declares its input variables from the braces in the text", "produces a prompt value ready for a completion-style model"],
      like: ["ChatPromptTemplate"],
    },
    {
      group: "prompt", subject: "ChatPromptTemplate", tier: 1,
      says: ["builds a list of role-tagged messages from a template", "is commonly created with from_messages using system and human entries", "fills named placeholders from the dictionary passed to invoke"],
      use: "need a system message and a user message built from variables",
      like: ["PromptTemplate"],
    },
    {
      group: "prompt", subject: "MessagesPlaceholder", tier: 2,
      says: ["inserts a list of messages into a chat prompt at a chosen position", "is how chat history is injected before the new user input", "takes its variable name from the variable_name argument"],
      use: "need to splice a stored conversation into the prompt",
    },
    {
      group: "prompt", subject: "SystemMessage", tier: 1,
      says: ["carries instructions that set the assistant's behavior", "is conventionally placed first in a conversation", "represents the system role"],
      like: ["HumanMessage", "AIMessage"],
    },
    {
      group: "prompt", subject: "HumanMessage", tier: 1,
      says: ["represents input from the user", "holds the text or content blocks the user sent", "maps to the user role in provider APIs"],
      like: ["SystemMessage", "AIMessage"],
    },
    {
      group: "prompt", subject: "AIMessage", tier: 2,
      says: ["represents a reply from the model", "can carry a tool_calls list when the model requests tools", "holds token counts in its usage_metadata when the provider reports them"],
      like: ["SystemMessage", "HumanMessage", "ToolMessage"],
    },
    {
      group: "prompt", subject: "ToolMessage", tier: 3,
      says: ["carries the result of a tool call back to the model", "must include the tool_call_id of the request it answers", "follows the AIMessage that requested the tool"],
      use: "need to return a tool's output to the model after it requested a call",
      like: ["AIMessage"],
    },
    {
      group: "prompt", subject: "A partial prompt", tier: 3,
      says: ["fixes some template variables ahead of time", "leaves the remaining variables to be supplied at invoke time", "is created with the partial method or partial_variables"],
    },
    {
      group: "prompt", subject: "FewShotChatMessagePromptTemplate", tier: 4,
      says: ["inserts example input and output message pairs into a chat prompt", "can pick examples from a fixed list or through a selector", "shows the model the desired pattern by demonstration"],
    },
    {
      group: "prompt", subject: "trim_messages", tier: 4,
      says: ["cuts a message list down to a token or message budget", "can keep the most recent messages and preserve the system message", "prevents long histories from overflowing the model's context window"],
      use: "need to keep a long chat history within the context limit",
    },
    // ---------- model ----------
    {
      group: "model", subject: "A chat model", tier: 1,
      says: ["takes a list of messages and returns an AIMessage", "wraps a provider's chat API behind the Runnable interface", "can be swapped for another provider with little change to a chain"],
    },
    {
      group: "model", subject: "init_chat_model", tier: 3,
      says: ["creates a chat model from a model name and an optional provider string", "lets the provider be chosen by configuration instead of an import", "returns a standard chat model object"],
    },
    {
      group: "model", subject: "StrOutputParser", tier: 1,
      says: ["converts a model's message into a plain string", "is the usual last step of a simple chain", "extracts the content text from an AIMessage"],
      like: ["JsonOutputParser"],
    },
    {
      group: "model", subject: "JsonOutputParser", tier: 2,
      says: ["parses the model's text output into a Python dictionary", "can stream partial JSON as it arrives", "does not itself force the model to emit valid JSON"],
      like: ["StrOutputParser", "PydanticOutputParser"],
    },
    {
      group: "model", subject: "PydanticOutputParser", tier: 3,
      says: ["parses model text into an instance of a Pydantic class", "supplies format instructions to place in the prompt", "raises an error when the text does not match the schema"],
      like: ["JsonOutputParser"],
    },
    {
      group: "model", subject: "with_structured_output", tier: 2,
      says: ["makes a chat model return data matching a given schema", "accepts a Pydantic class, TypedDict or JSON Schema", "returns a parsed object instead of a raw message"],
      use: "need the model to return validated, typed data",
      not: ["guarantees correct values for every field"],
    },
    {
      group: "model", subject: "The include_raw option", tier: 4,
      says: ["makes with_structured_output also return the raw model message", "returns a dict with raw, parsed and parsing_error entries", "lets a caller handle a parse failure without losing the output"],
    },
    {
      group: "model", subject: "usage_metadata", tier: 3,
      says: ["reports input, output and total token counts on an AIMessage", "helps track the cost of each call", "is filled in when the provider integration supplies usage data"],
    },
    {
      group: "model", subject: "Model temperature", tier: 2,
      says: ["is an argument passed to the chat model, not to the prompt template", "controls how random the sampling is", "is best kept low for extraction and classification tasks"],
    },
    {
      group: "model", subject: "A message content block", tier: 4,
      says: ["is one part of a message's content list, such as text or an image", "is how multimodal input is passed to a model", "depends on the provider supporting that kind of input"],
    },
    // ---------- rag ----------
    {
      group: "rag", subject: "A Document", tier: 1,
      says: ["is LangChain's container for text with attached metadata", "has a page_content string and a metadata dictionary", "is the unit that loaders, splitters and retrievers pass around"],
    },
    {
      group: "rag", subject: "A document loader", tier: 1,
      says: ["reads data from a source such as a file, web page or database into Documents", "exposes load for all documents at once", "exposes lazy_load to yield documents one at a time"],
      use: "need to turn PDFs or web pages into Documents",
    },
    {
      group: "rag", subject: "RecursiveCharacterTextSplitter", tier: 2,
      says: ["splits text by trying a list of separators from largest to smallest", "keeps paragraphs and sentences together where it can", "measures chunk_size in characters unless a different length function is supplied"],
      use: "need a general-purpose splitter that respects paragraph and sentence boundaries",
    },
    {
      group: "rag", subject: "chunk_size", tier: 2,
      says: ["sets the maximum size of each chunk", "trades precision of retrieval against context per chunk", "is too large when retrieved chunks carry a lot of irrelevant text"],
      like: ["chunk_overlap"],
    },
    {
      group: "rag", subject: "chunk_overlap", tier: 2,
      says: ["repeats some text between neighboring chunks", "helps prevent an idea being cut in half at a boundary", "increases the total amount of text to embed and store"],
      like: ["chunk_size"],
    },
    {
      group: "rag", subject: "An embeddings model", tier: 2,
      says: ["turns text into a fixed-length vector of numbers", "places texts with similar meaning close together in vector space", "provides embed_documents for many texts and embed_query for one"],
    },
    {
      group: "rag", subject: "A vector store", tier: 2,
      says: ["stores embeddings together with their documents", "finds the stored vectors nearest to a query vector", "provides add_documents and similarity_search"],
      like: ["A retriever"],
    },
    {
      group: "rag", subject: "A retriever", tier: 2,
      says: ["takes a query string and returns a list of Documents", "implements the Runnable interface, so it can sit in a chain", "can be backed by a vector store, a keyword index or an API"],
      like: ["A vector store"],
      use: "need a component that maps a question to relevant documents inside a chain",
    },
    {
      group: "rag", subject: "The as_retriever method", tier: 3,
      says: ["turns a vector store into a retriever", "accepts search_kwargs such as the number of results k", "accepts a search_type such as similarity or mmr"],
    },
    {
      group: "rag", subject: "Maximal marginal relevance", tier: 4,
      says: ["balances relevance to the query with diversity among the results", "reduces near-duplicate chunks in the retrieved set", "is chosen with search_type mmr"],
      use: "need retrieved chunks to cover different aspects instead of repeating one",
    },
    {
      group: "rag", subject: "MultiQueryRetriever", tier: 4,
      says: ["asks a model to rewrite the question in several ways", "retrieves for every variant and merges the unique results", "improves recall when a single phrasing misses relevant text"],
      like: ["EnsembleRetriever"],
    },
    {
      group: "rag", subject: "EnsembleRetriever", tier: 4,
      says: ["combines results from several retrievers using rank fusion", "commonly pairs a keyword retriever with a vector retriever", "gives weights to each retriever's contribution"],
      like: ["MultiQueryRetriever"],
    },
    {
      group: "rag", subject: "Metadata filtering", tier: 3,
      says: ["restricts retrieval to documents whose metadata matches a condition", "is passed to the vector store search through a filter argument", "needs metadata to have been attached at indexing time"],
    },
    {
      group: "rag", subject: "A RAG chain", tier: 2,
      says: ["retrieves relevant documents, inserts them into a prompt and calls a model", "is often written as a dict with context and question piped into prompt | model | parser", "grounds the answer in the retrieved text"],
      use: "need the model to answer from your own documents",
    },
    {
      group: "rag", subject: "Parent document retrieval", tier: 5,
      says: ["indexes small chunks but returns the larger parent passage", "pairs precise matching with richer context", "needs a docstore to hold the full parent documents"],
    },
    {
      group: "rag", subject: "Contextual compression", tier: 5,
      says: ["post-processes retrieved documents to keep only the relevant parts", "wraps a base retriever with a compressor", "reduces tokens sent to the model at the cost of an extra step"],
    },
    // ---------- tool ----------
    {
      group: "tool", subject: "The tool decorator", tier: 1,
      says: ["turns a Python function into a LangChain tool", "uses the function name as the tool name", "uses the docstring as the tool description shown to the model"],
      use: "need to expose a plain Python function to a model",
    },
    {
      group: "tool", subject: "A tool args schema", tier: 3,
      says: ["describes the input arguments of a tool as a schema", "is inferred from type hints or given explicitly through args_schema", "is what the model sees when deciding what arguments to send"],
    },
    {
      group: "tool", subject: "The bind_tools method", tier: 2,
      says: ["attaches tool definitions to a chat model", "lets the model respond with tool calls instead of plain text", "does not run the tools itself"],
      not: ["executes the tool and returns its result"],
      use: "need a chat model to know which tools it can request",
    },
    {
      group: "tool", subject: "The tool_calls list", tier: 2,
      says: ["is found on an AIMessage when the model requests tools", "holds entries with a name, args and an id", "must be turned into actual tool executions by your code or an agent loop"],
    },
    {
      group: "tool", subject: "The tool_call_id", tier: 3,
      says: ["links a tool result to the specific request that triggered it", "must be copied into the matching ToolMessage", "lets a model make several tool calls in one turn without mixing results"],
    },
    {
      group: "tool", subject: "An agent loop", tier: 1,
      says: ["alternates between model calls and tool executions", "stops when the model replies without requesting a tool", "lets the model decide the next step based on earlier results"],
      use: "need the model to decide which tools to call and in what order",
    },
    {
      group: "tool", subject: "The ReAct pattern", tier: 2,
      says: ["interleaves reasoning with actions that use tools", "feeds each observation back before the next decision", "underlies many general tool-using agents"],
    },
    {
      group: "tool", subject: "AgentExecutor", tier: 4,
      says: ["is the older LangChain class that runs an agent loop", "has largely been replaced by LangGraph for new agents", "limits iterations with max_iterations"],
    },
    {
      group: "tool", subject: "ToolNode", tier: 3,
      says: ["is a LangGraph prebuilt node that runs the tool calls in the latest AIMessage", "produces ToolMessages as its output", "can run several requested tools concurrently"],
      like: ["tools_condition"],
    },
    {
      group: "tool", subject: "tools_condition", tier: 3,
      says: ["is a prebuilt routing function that checks the last message for tool calls", "sends the graph to the tools node when tool calls exist", "ends the run when the model produced a final answer"],
      like: ["ToolNode"],
    },
    {
      group: "tool", subject: "A tool description", tier: 2,
      says: ["is read by the model to decide which tool to call", "should state what a tool does and when to use it", "affects agent reliability as much as the code does"],
    },
    {
      group: "tool", subject: "Tool error handling", tier: 4,
      says: ["lets an error be returned to the model as a message so it can retry", "stops one failing tool from ending the whole run", "can be configured on ToolNode"],
    },
    {
      group: "tool", subject: "Parallel tool calling", tier: 4,
      says: ["occurs when a model requests several tools in one message", "matches each result back by its own tool_call_id", "saves latency when the calls are independent"],
    },
    // ---------- graph ----------
    {
      group: "graph", subject: "LangGraph", tier: 1,
      says: ["is a library for building stateful, multi-step workflows as graphs", "models agent control flow with nodes and edges", "supports loops, branching and human intervention"],
      use: "need an agent workflow with loops, branches and saved state",
      not: ["is a vector database"],
    },
    {
      group: "graph", subject: "StateGraph", tier: 1,
      says: ["is the builder class for graphs that share a state object", "is created with a state schema", "becomes runnable after compile"],
    },
    {
      group: "graph", subject: "Graph state", tier: 1,
      says: ["is the shared data that every node reads and updates", "is usually declared as a TypedDict or Pydantic model", "defines the keys a graph can carry between steps"],
    },
    {
      group: "graph", subject: "A node", tier: 1,
      says: ["is a function that receives the current state and returns updates", "is added with add_node under a name", "does its work by returning a partial dictionary of state keys"],
      like: ["An edge"],
    },
    {
      group: "graph", subject: "An edge", tier: 1,
      says: ["connects one node to the next in the graph", "is added with add_edge from a source to a target", "decides the order in which nodes run"],
      like: ["A node", "A conditional edge"],
    },
    {
      group: "graph", subject: "The START node", tier: 2,
      says: ["is a special node that marks where a graph begins", "is imported from langgraph.graph", "is used as the source of the first edge"],
    },
    {
      group: "graph", subject: "A conditional edge", tier: 2,
      says: ["chooses the next node by running a routing function on the state", "is added with add_conditional_edges", "enables branching and loops"],
      use: "need the graph to decide between tools and a final answer",
      like: ["An edge"],
    },
    {
      group: "graph", subject: "A reducer", tier: 2,
      says: ["defines how a node's update is merged into an existing state key", "is attached to a key with Annotated", "decides whether updates replace or combine values"],
      use: "need parallel nodes to append to one list instead of overwriting it",
    },
    {
      group: "graph", subject: "add_messages", tier: 2,
      says: ["is a reducer that appends new messages to a message list", "updates an existing message when the same id appears", "is the standard reducer for chat history in state"],
      like: ["A reducer"],
    },
    {
      group: "graph", subject: "MessagesState", tier: 2,
      says: ["is a prebuilt state class with a messages key", "uses add_messages as the reducer for that key", "can be subclassed to add more keys"],
    },
    {
      group: "graph", subject: "The compile method", tier: 2,
      says: ["checks the graph structure and returns an executable graph", "is where a checkpointer is attached", "accepts interrupt_before and interrupt_after node lists"],
    },
    {
      group: "graph", subject: "The Command object", tier: 4,
      says: ["lets a node update state and choose the next node in one return value", "uses update and goto fields", "is also used to resume a paused graph with a value"],
    },
    {
      group: "graph", subject: "The Send API", tier: 5,
      says: ["dispatches a node to run once per item with its own input", "enables map-reduce style fan-out with a dynamic number of branches", "is returned from a conditional edge function"],
      use: "need to run the same node over a variable number of items in parallel",
    },
    {
      group: "graph", subject: "A subgraph", tier: 4,
      says: ["is a compiled graph used as a node in a parent graph", "can have its own state schema", "lets large workflows be split into reusable pieces"],
    },
    {
      group: "graph", subject: "The recursion limit", tier: 3,
      says: ["caps how many steps a graph run may take", "raises an error when a loop exceeds it", "is set through the config passed to invoke"],
      not: ["limits the length of the state's message list"],
    },
    {
      group: "graph", subject: "A supervisor pattern", tier: 4,
      says: ["uses one routing agent to delegate work to specialist agents", "returns control to the supervisor after each worker finishes", "is built from nodes and conditional edges or Commands"],
    },
    // ---------- persist ----------
    {
      group: "persist", subject: "A checkpointer", tier: 2,
      says: ["saves a snapshot of graph state after each step", "enables memory across calls, resumption and time travel", "is passed to compile as the checkpointer argument"],
      use: "need a graph to remember a conversation between invocations",
    },
    {
      group: "persist", subject: "InMemorySaver", tier: 2,
      says: ["is a checkpointer that keeps snapshots in process memory", "loses all saved state when the process exits", "is also importable under the older name MemorySaver"],
      like: ["A durable checkpointer"],
    },
    {
      group: "persist", subject: "A durable checkpointer", tier: 3,
      says: ["stores graph snapshots in a database such as SQLite or Postgres", "keeps conversations available after a restart", "suits production deployments better than an in-memory saver"],
      like: ["InMemorySaver"],
    },
    {
      group: "persist", subject: "thread_id", tier: 2,
      says: ["identifies one conversation or run lineage for the checkpointer", "is passed in config under configurable", "separates the saved state of different users or sessions"],
      use: "need two users' conversations to stay separate",
    },
    {
      group: "persist", subject: "The interrupt function", tier: 3,
      says: ["pauses the graph and surfaces a value to the caller", "returns the resume value when the graph continues", "requires a checkpointer to save the paused state"],
      use: "need a human to approve a step before the graph continues",
    },
    {
      group: "persist", subject: "Resuming with Command", tier: 3,
      says: ["continues a paused graph by invoking it with Command(resume=value)", "must use the same thread_id as the paused run", "makes interrupt return the supplied value"],
    },
    {
      group: "persist", subject: "interrupt_before", tier: 3,
      says: ["pauses the graph before a named node runs", "is given as a list of node names to compile", "suits a static approval point before a sensitive node"],
      like: ["The interrupt function"],
    },
    {
      group: "persist", subject: "State history", tier: 4,
      says: ["lists past checkpoints of a thread with get_state_history", "lets you replay or fork a run from an earlier point", "is the basis of time travel debugging"],
    },
    {
      group: "persist", subject: "The update_state method", tier: 4,
      says: ["writes changes into a thread's saved state", "lets a person correct state before a paused graph continues", "applies updates through the same reducers as node returns"],
    },
    {
      group: "persist", subject: "A store for long-term memory", tier: 4,
      says: ["keeps data shared across threads, such as user preferences", "organizes items under namespaces and keys", "complements a checkpointer, which is scoped to one thread"],
      like: ["A checkpointer"],
    },
    {
      group: "persist", subject: "Stream mode values", tier: 3,
      says: ["emits the full state after each step", "is chosen with stream_mode set to values", "suits showing the complete state as it evolves"],
      like: ["Stream mode updates"],
    },
    {
      group: "persist", subject: "Stream mode updates", tier: 3,
      says: ["emits only what each node changed", "labels each chunk with the node that produced it", "is smaller than streaming full state"],
      like: ["Stream mode values"],
    },
    {
      group: "persist", subject: "Stream mode messages", tier: 4,
      says: ["streams model tokens as they are generated inside nodes", "pairs each chunk with metadata about its origin", "enables a chat interface to type out replies"],
    },
    {
      group: "persist", subject: "Durable execution", tier: 5,
      says: ["lets a run resume from its last checkpoint after a failure", "re-runs the interrupted node from its beginning", "requires side effects to be safe to repeat"],
    },
    // ---------- ops ----------
    {
      group: "ops", subject: "LangSmith", tier: 1,
      says: ["is a platform for tracing, debugging and evaluating LLM applications", "records each step of a run as a trace", "works with LangChain and with code that does not use it"],
      use: "need to see exactly what each step of a chain received and returned",
    },
    {
      group: "ops", subject: "Enabling tracing by environment variables", tier: 2,
      says: ["turns on LangSmith tracing without changing application code", "uses LANGSMITH_TRACING set to true together with an API key", "applies to LangChain and LangGraph runs automatically"],
    },
    {
      group: "ops", subject: "A trace", tier: 2,
      says: ["is the tree of runs recorded for one invocation", "shows inputs, outputs, latency and errors for each step", "includes token usage when models report it"],
    },
    {
      group: "ops", subject: "The traceable decorator", tier: 3,
      says: ["traces an ordinary function as a run", "is imported from the langsmith package", "nests under a parent run when called inside another traced function"],
    },
    {
      group: "ops", subject: "A run tag", tier: 3,
      says: ["is a label added through config to categorize traces", "makes it possible to filter runs by user, version or experiment", "is inherited by child runs"],
    },
    {
      group: "ops", subject: "A callback handler", tier: 3,
      says: ["receives events such as model start, token and tool end", "can be passed in config to observe a chain", "is how custom logging or metrics are attached"],
    },
    {
      group: "ops", subject: "A LangSmith dataset", tier: 3,
      says: ["is a saved collection of example inputs and reference outputs", "is the input to running evaluations", "can be built from real traces"],
    },
    {
      group: "ops", subject: "An evaluator", tier: 4,
      says: ["scores a run's output against criteria or a reference", "can be a function, a heuristic or a model acting as judge", "lets prompt or code changes be compared on the same dataset"],
    },
    {
      group: "ops", subject: "ConversationBufferMemory", tier: 3,
      says: ["is a legacy memory class from older LangChain versions", "has been deprecated in favor of LangGraph persistence", "should not be chosen for new applications"],
      not: ["is the recommended way to persist conversations in LangGraph"],
    },
    {
      group: "ops", subject: "RunnableWithMessageHistory", tier: 3,
      says: ["wraps a runnable so it loads and saves chat history per session", "uses a function that returns a history object for a session id", "is a simpler alternative to LangGraph when only chat memory is needed"],
    },
    {
      group: "ops", subject: "Package split", tier: 3,
      says: ["places core abstractions in langchain-core", "places provider integrations in separate packages", "keeps text splitters in their own package"],
    },
    {
      group: "ops", subject: "Token and cost monitoring", tier: 4,
      says: ["relies on usage metadata returned by model calls", "can be aggregated per trace or per tag", "helps find chains that use far more tokens than expected"],
    },
    // ---------- pitfall ----------
    {
      group: "pitfall", subject: "A missing reducer", tier: 3,
      says: ["makes each update to a state key overwrite the previous value", "causes lost messages when a list is expected to grow", "is fixed by annotating the key with a reducer such as add_messages"],
    },
    {
      group: "pitfall", subject: "A concurrent write conflict", tier: 4,
      says: ["raises an error when two parallel nodes update the same key in one step", "is fixed by giving the key a reducer that merges updates", "does not occur when the nodes write different keys"],
    },
    {
      group: "pitfall", subject: "A missing thread_id", tier: 2,
      says: ["makes a graph with a checkpointer refuse to run or lose continuity", "prevents conversation state from being saved to the right thread", "is fixed by passing configurable thread_id in the config"],
    },
    {
      group: "pitfall", subject: "A missing prompt variable", tier: 2,
      says: ["happens when the dict passed to invoke lacks a placeholder name from the template", "raises an error naming the missing variable", "is avoided by checking the prompt's input_variables"],
    },
    {
      group: "pitfall", subject: "An unbounded agent loop", tier: 3,
      says: ["keeps calling tools without ever finishing", "is stopped by the recursion limit or an iteration cap", "usually signals vague tools or a missing stop condition"],
    },
    {
      group: "pitfall", subject: "Mutating state in place", tier: 4,
      says: ["can bypass reducers and checkpointing", "is avoided by returning new values from a node", "leads to confusing behavior when a run is resumed"],
    },
    {
      group: "pitfall", subject: "A side effect before an interrupt", tier: 5,
      says: ["runs again when the node restarts after resume", "can send a duplicate email or repeat a payment", "is avoided by placing the interrupt first or making the action idempotent"],
    },
    {
      group: "pitfall", subject: "Embedding model mismatch", tier: 3,
      says: ["happens when documents and queries are embedded with different models", "makes similarity scores meaningless", "is avoided by using the same embeddings for indexing and search"],
    },
    {
      group: "pitfall", subject: "An oversized chunk", tier: 3,
      says: ["dilutes the match between a query and the chunk's text", "fills the prompt with irrelevant text", "is fixed by reducing chunk_size"],
    },
    {
      group: "pitfall", subject: "Trusting structured output blindly", tier: 4,
      says: ["accepts values that match the schema but are factually wrong", "is mitigated by validating business rules after parsing", "is not prevented by schema validation alone"],
    },
    {
      group: "pitfall", subject: "Unbounded chat history", tier: 3,
      says: ["grows the prompt every turn until it exceeds the context window", "raises cost and latency as conversations lengthen", "is handled by trimming or summarizing old messages"],
    },
    {
      group: "pitfall", subject: "In-memory checkpointer in production", tier: 4,
      says: ["loses all conversations on restart", "does not share state between multiple server instances", "is replaced by a database-backed checkpointer"],
    },
    {
      group: "pitfall", subject: "Dropped tool_call_id", tier: 4,
      says: ["causes a provider error because a tool call has no matching result", "happens when a ToolMessage is built without the original id", "is avoided by copying the id from the model's tool call"],
    },
    {
      group: "pitfall", subject: "Streaming through a non-streaming step", tier: 4,
      says: ["delays output because a step waits for its full input", "is common with custom functions that return only at the end", "is avoided with generator functions that yield chunks"],
    },
  ],
  qa: [
    {
      q: "What does this chain return when invoked?", tier: 1,
      code: `from langchain_core.prompts import ChatPromptTemplate\nfrom langchain_core.output_parsers import StrOutputParser\n\nprompt = ChatPromptTemplate.from_messages([("human", "Translate to French: {text}")])\nchain = prompt | model | StrOutputParser()\nchain.invoke({"text": "hello"})`,
      right: "A plain string containing the model's translation",
      wrong: ["An AIMessage object", "A list of Documents", "A dictionary with a text key"],
      why: "StrOutputParser at the end converts the AIMessage into its string content.",
    },
    {
      q: "Which error does this call produce?", tier: 2,
      code: `prompt = ChatPromptTemplate.from_messages([("system", "You are a {role}."), ("human", "{question}")])\nprompt.invoke({"question": "What is 2+2?"})`,
      right: "An error about the missing input variable role",
      wrong: ["None; role defaults to an empty string", "A TypeError about from_messages", "A recursion limit error"],
      why: "Every placeholder in the template must be supplied at invoke time.",
    },
    {
      q: "What type is the value that the pipe in this expression builds?", tier: 2,
      code: `chain = prompt | model | parser`,
      right: "A RunnableSequence",
      wrong: ["A RunnableParallel", "A Python generator", "A plain function"],
      why: "The | operator composes runnables into a RunnableSequence.",
    },
    {
      q: "What does this chain pass to the prompt?", tier: 3,
      code: `chain = (\n    {"context": retriever, "question": RunnablePassthrough()}\n    | prompt | model | StrOutputParser()\n)\nchain.invoke("What is LCEL?")`,
      right: "A dict with context from the retriever for the question and question equal to the original string",
      wrong: ["Only the retrieved documents", "The string wrapped in a list of messages", "A dict with the model's answer"],
      why: "The dict becomes a RunnableParallel that feeds the same input to both branches.",
    },
    {
      q: "What does stream_mode=\"updates\" yield in this loop?", tier: 3,
      code: `for chunk in graph.stream({"messages": [("user", "hi")]}, stream_mode="updates"):\n    print(chunk)`,
      right: "One dict per step, keyed by node name, containing only what that node returned",
      wrong: ["The full state after every step", "Only model token chunks", "A single final result at the end"],
      why: "updates mode emits per-node state changes.",
    },
    {
      q: "Which snippet creates a tool whose description is shown to the model?", tier: 1,
      code: `from langchain_core.tools import tool\n\n@tool\ndef multiply(a: int, b: int) -> int:\n    """Multiply two integers."""\n    return a * b`,
      right: "The @tool function above; its docstring becomes the description and its type hints become the schema",
      wrong: ["Only a class that subclasses Runnable", "A function must be registered in a YAML file", "The return annotation sets the tool name"],
      why: "The decorator builds name, description and args schema from the function.",
    },
    {
      q: "After this call, where are the requested tool calls found?", tier: 2,
      code: `llm_with_tools = model.bind_tools([multiply])\nmsg = llm_with_tools.invoke("What is 6 times 7?")`,
      right: "In msg.tool_calls, a list of dicts with name, args and id",
      wrong: ["In msg.content as the number 42", "In model.tool_results", "In a ToolMessage already returned by invoke"],
      why: "bind_tools lets the model request a call; running the tool is a separate step.",
    },
    {
      q: "What is wrong with this follow-up message?", tier: 3,
      code: `ToolMessage(content="42")`,
      right: "It lacks the tool_call_id that links it to the model's tool call",
      wrong: ["Content must be an integer", "ToolMessage cannot hold strings", "It must be a SystemMessage"],
      why: "Providers match tool results to requests through the id.",
    },
    {
      q: "What does this graph do when route returns \"tools\"?", tier: 2,
      code: `graph.add_conditional_edges("agent", route, {"tools": "tools", "end": END})`,
      right: "It continues to the node named tools",
      wrong: ["It stops the run immediately", "It raises a recursion error", "It reruns the agent node only"],
      why: "The mapping converts the routing function's return value into a target node.",
    },
    {
      q: "What does this state definition give you?", tier: 2,
      code: `from typing import Annotated, TypedDict\nfrom langgraph.graph.message import add_messages\n\nclass State(TypedDict):\n    messages: Annotated[list, add_messages]`,
      right: "A messages key where node updates are appended to the list instead of replacing it",
      wrong: ["A messages key that is cleared after every node", "A key that can hold only one message", "A key that is invisible to nodes"],
      why: "The reducer in Annotated controls how updates merge.",
    },
    {
      q: "What happens to counter in this graph state after two nodes each return {\"counter\": 1}, assuming no reducer and sequential execution?", tier: 3,
      code: `class State(TypedDict):\n    counter: int`,
      right: "It ends at 1, because each update replaces the previous value",
      wrong: ["It ends at 2", "It becomes a list [1, 1]", "It raises an error at compile"],
      why: "Without a reducer the default is overwrite.",
    },
    {
      q: "How do you make this state key accumulate integers from parallel nodes?", tier: 4,
      code: `class State(TypedDict):\n    results: list[int]`,
      right: "Annotate it with a reducer such as Annotated[list[int], operator.add]",
      wrong: ["Rename the key to accumulate", "Call compile twice", "Set the recursion limit to 1"],
      why: "A reducer merges concurrent updates; without it parallel writes conflict.",
    },
    {
      q: "Which call continues a conversation on the same thread?", tier: 2,
      code: `app = builder.compile(checkpointer=InMemorySaver())\nconfig = {"configurable": {"thread_id": "user-42"}}\napp.invoke({"messages": [("user", "My name is Ada")]}, config)\napp.invoke({"messages": [("user", "What is my name?")]}, config)`,
      right: "The second invoke sees the earlier message because it uses the same thread_id and checkpointer",
      wrong: ["The second invoke starts empty because invoke never stores anything", "The second invoke fails because thread_id must change per call", "The first message is only kept if streaming is enabled"],
      why: "Checkpoints are keyed by thread_id.",
    },
    {
      q: "What happens if the second invoke uses thread_id \"user-43\"?", tier: 2,
      right: "It starts with fresh state and does not see the first thread's messages",
      wrong: ["It merges both threads", "It raises a recursion error", "It reuses user-42 automatically"],
      why: "Each thread_id has its own checkpoint history.",
    },
    {
      q: "How is a paused graph resumed here?", tier: 3,
      code: `from langgraph.types import interrupt, Command\n\ndef approval(state):\n    answer = interrupt({"question": "Send email?"})\n    return {"approved": answer}\n\n# later, same thread_id:\napp.invoke(Command(resume=True), config)`,
      right: "interrupt returns True, so approved becomes True and the graph continues",
      wrong: ["The node is skipped entirely", "interrupt raises an exception that ends the thread", "The state is reset before resuming"],
      why: "The resume value becomes the return value of interrupt.",
    },
    {
      q: "What does this code do in the approval node on resume?", tier: 5,
      code: `def approval(state):\n    send_email(state["draft"])\n    ok = interrupt("Confirm?")\n    return {"ok": ok}`,
      right: "It sends the email again, because the node restarts from the beginning on resume",
      wrong: ["It skips send_email since it already ran", "It resumes on the line after interrupt without re-running earlier lines", "It never sends the email"],
      why: "Code before interrupt runs again after a resume, so place side effects after it or make them idempotent.",
    },
    {
      q: "Which splitter configuration yields overlapping chunks?", tier: 2,
      code: `from langchain_text_splitters import RecursiveCharacterTextSplitter\nsplitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)\nchunks = splitter.split_documents(docs)`,
      right: "Neighboring chunks share up to 50 characters",
      wrong: ["Each chunk is exactly 50 tokens", "Chunks are discarded if shorter than 500", "docs are embedded during splitting"],
      why: "chunk_overlap repeats text between adjacent chunks; sizes are characters by default.",
    },
    {
      q: "What does this call return?", tier: 2,
      code: `retriever = vectorstore.as_retriever(search_kwargs={"k": 3})\nresult = retriever.invoke("What is a reducer?")`,
      right: "A list of up to three Documents most similar to the query",
      wrong: ["A single string answer", "An AIMessage", "A dictionary of embeddings"],
      why: "Retrievers return Documents, not generated text.",
    },
    {
      q: "How do you choose maximal marginal relevance search?", tier: 4,
      code: `retriever = vectorstore.as_retriever(\n    search_type="mmr", search_kwargs={"k": 4, "fetch_k": 20}\n)`,
      right: "Set search_type to mmr; fetch_k candidates are fetched and k diverse results kept",
      wrong: ["Set k to a negative number", "Call the stream method", "Add a checkpointer"],
      why: "MMR reranks a larger candidate pool for relevance and diversity.",
    },
    {
      q: "What does include_raw=True change?", tier: 4,
      code: `structured = model.with_structured_output(Person, include_raw=True)\nout = structured.invoke("Ada, 36")`,
      right: "out is a dict with raw, parsed and parsing_error entries",
      wrong: ["out is a Person only", "out is a string", "The model returns nothing on a parse failure"],
      why: "include_raw returns the raw message and the parse outcome.",
    },
    {
      q: "What does out hold here?", tier: 2,
      code: `class Person(BaseModel):\n    name: str\n    age: int\n\nstructured = model.with_structured_output(Person)\nout = structured.invoke("Ada is 36")`,
      right: "A Person instance such as Person(name=\"Ada\", age=36)",
      wrong: ["A raw AIMessage", "A JSON string", "A list of Documents"],
      why: "With a Pydantic schema the output is parsed into that class.",
    },
    {
      q: "Which call runs three inputs concurrently with at most two at once?", tier: 3,
      right: "chain.batch(inputs, config={\"max_concurrency\": 2})",
      wrong: ["chain.invoke(inputs, concurrency=2)", "chain.stream(inputs, workers=2)", "chain.bind(max=2).invoke(inputs)"],
      why: "batch accepts max_concurrency in its config.",
    },
    {
      q: "What does this wrapper do?", tier: 3,
      code: `robust = model.with_fallbacks([backup_model])`,
      right: "If model raises an error, the call is retried with backup_model",
      wrong: ["Every call uses both models and returns two answers", "backup_model replaces model permanently", "Errors are ignored and None is returned"],
      why: "with_fallbacks tries alternatives only when the primary fails.",
    },
    {
      q: "How do you enable LangSmith tracing without changing code?", tier: 2,
      code: `export LANGSMITH_TRACING=true\nexport LANGSMITH_API_KEY=<your key>`,
      right: "Set the tracing environment variable and an API key; runs are then recorded automatically",
      wrong: ["Add a stream_mode argument", "Wrap every chain in a ToolNode", "Install a vector store"],
      why: "Tracing is controlled through environment variables.",
    },
    {
      q: "What does this decorator do?", tier: 3,
      code: `from langsmith import traceable\n\n@traceable\ndef clean(text: str) -> str:\n    return text.strip()`,
      right: "Records each call of clean as a run in the trace",
      wrong: ["Turns clean into a tool the model can call", "Makes clean asynchronous", "Caches the result forever"],
      why: "traceable adds LangSmith tracing to ordinary functions.",
    },
    {
      q: "What does this prompt contain at call time?", tier: 3,
      code: `prompt = ChatPromptTemplate.from_messages([\n    ("system", "Be brief."),\n    MessagesPlaceholder("history"),\n    ("human", "{input}"),\n])\nprompt.invoke({"history": [HumanMessage("hi"), AIMessage("hello")], "input": "bye"})`,
      right: "Four messages in order: system, human hi, ai hello, human bye",
      wrong: ["Two messages: system and human bye", "Three messages with history first", "An error because history is not a string"],
      why: "The placeholder expands into the supplied messages at its position.",
    },
    {
      q: "What does this node return mean for the state?", tier: 2,
      code: `def node(state):\n    return {"summary": "done"}`,
      right: "Only the summary key is updated; other keys keep their values",
      wrong: ["The whole state is replaced by this dict", "All other keys are deleted", "The graph ends"],
      why: "Nodes return partial updates that are merged into state.",
    },
    {
      q: "What does this Command return do?", tier: 4,
      code: `from langgraph.types import Command\n\ndef router(state):\n    return Command(update={"step": "a"}, goto="worker")`,
      right: "Updates the step key and sends execution to the node named worker",
      wrong: ["Ends the graph", "Starts a subgraph on a new thread", "Resumes an interrupt"],
      why: "Command combines a state update with routing in one value.",
    },
    {
      q: "What does this conditional edge function enable?", tier: 5,
      code: `from langgraph.types import Send\n\ndef fan_out(state):\n    return [Send("summarize", {"doc": d}) for d in state["docs"]]\n\nbuilder.add_conditional_edges(START, fan_out)`,
      right: "Runs the summarize node once per document in parallel, each with its own input",
      wrong: ["Runs summarize once with all documents merged", "Skips summarize for empty documents only", "Creates one checkpoint per character"],
      why: "Send dispatches a node with custom state per item.",
    },
    {
      q: "A run fails with a recursion limit error. What is the most useful first check?", tier: 3,
      right: "Look for a loop in which the model keeps requesting tools or a route that never reaches END",
      wrong: ["Increase chunk_size", "Replace the checkpointer with MemorySaver", "Disable tracing"],
      why: "The limit exists to stop runaway loops; the fix is usually the stop condition.",
    },
    {
      q: "How do you raise the recursion limit for a call?", tier: 3,
      code: `app.invoke(inputs, config={"recursion_limit": 50})`,
      right: "Pass recursion_limit in the config of the call",
      wrong: ["Pass it to add_node", "Set it on StrOutputParser", "Use stream_mode"],
      why: "The limit is a runtime configuration value.",
    },
    {
      q: "What does this graph builder produce when compiled with a checkpointer and interrupt_before?", tier: 3,
      code: `app = builder.compile(checkpointer=saver, interrupt_before=["tools"])`,
      right: "A graph that pauses before the tools node runs so the call can be reviewed",
      wrong: ["A graph that never runs tools", "A graph that deletes checkpoints", "A graph that runs tools twice"],
      why: "interrupt_before is a static breakpoint requiring persistence.",
    },
    {
      q: "Which LCEL element runs two branches on the same input and returns a dict?", tier: 2,
      right: "RunnableParallel",
      wrong: ["RunnableSequence", "RunnableLambda", "StrOutputParser"],
      why: "RunnableParallel fans one input out to several runnables.",
    },
    {
      q: "What does RunnablePassthrough.assign do in this chain?", tier: 4,
      code: `chain = RunnablePassthrough.assign(length=lambda x: len(x["text"]))\nchain.invoke({"text": "hello"})`,
      right: "Returns {\"text\": \"hello\", \"length\": 5}",
      wrong: ["Returns 5", "Returns {\"length\": 5}", "Raises a KeyError"],
      why: "assign keeps the input keys and adds computed ones.",
    },
    {
      q: "Which approach keeps a long chat from overflowing the context window?", tier: 3,
      code: `from langchain_core.messages import trim_messages\ntrimmed = trim_messages(messages, max_tokens=1000, strategy="last", token_counter=model, include_system=True)`,
      right: "Trim to the most recent messages within a token budget while keeping the system message",
      wrong: ["Double chunk_overlap", "Switch stream_mode", "Add more tools"],
      why: "trim_messages limits what is sent to the model each turn.",
    },
    {
      q: "Why does this agent often fail to pick the right tool?", tier: 3,
      code: `@tool\ndef lookup(x: str) -> str:\n    """Lookup."""\n    ...`,
      right: "The name and description say almost nothing, so the model cannot tell when to use it",
      wrong: ["Tools may not take strings", "Docstrings are ignored and the code is read instead", "Tools need a checkpointer"],
      why: "The model decides from the name, description and schema alone.",
    },
    {
      q: "What does the stream_mode=\"messages\" option stream?", tier: 4,
      right: "Chat model tokens as they are generated inside nodes, with metadata about their origin",
      wrong: ["Only final messages after the run", "Checkpoints in a database", "Document chunks from the retriever"],
      why: "messages mode gives token-level streaming from model calls.",
    },
    {
      q: "Which statement about InMemorySaver is correct?", tier: 3,
      right: "It keeps checkpoints only in process memory, so they are lost on restart",
      wrong: ["It writes to Postgres by default", "It replaces the need for thread_id", "It is shared between all server instances"],
      why: "It is meant for development and tests.",
    },
    {
      q: "A retrieval chain returns irrelevant chunks for questions that are clearly in the documents. Which cause is plausible?", tier: 4,
      right: "Queries and documents were embedded with different embedding models",
      wrong: ["The retriever was compiled without a checkpointer", "The prompt used a system message", "The recursion limit was too high"],
      why: "Vectors from different models are not comparable, making similarity scores meaningless.",
    },
    {
      q: "How can you route a graph to tools or to the end using the prebuilt helper?", tier: 3,
      code: `from langgraph.prebuilt import ToolNode, tools_condition\n\nbuilder.add_node("tools", ToolNode(tools))\nbuilder.add_conditional_edges("agent", tools_condition)`,
      right: "tools_condition sends the run to the tools node when the last message has tool calls, otherwise to the end",
      wrong: ["It always goes to tools", "It always ends", "It chooses randomly"],
      why: "tools_condition inspects the last AIMessage for tool_calls.",
    },
    {
      q: "What is the purpose of a store compared with a checkpointer?", tier: 4,
      right: "A store keeps data shared across threads, while a checkpointer keeps state for one thread",
      wrong: ["A store replaces the graph state", "A checkpointer stores embeddings", "They are the same object with different names"],
      why: "Long-term memory such as user preferences must outlive any single thread.",
    },
    {
      q: "What does lazy_load give you on a document loader?", tier: 3,
      right: "An iterator that yields Documents one at a time without loading everything into memory",
      wrong: ["A faster embedding model", "A cached vector store", "A single concatenated string"],
      why: "lazy_load is the memory-friendly alternative to load.",
    },
  ],
};
export default spec;
