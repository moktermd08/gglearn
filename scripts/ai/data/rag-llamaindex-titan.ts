import type { TrackSpec } from "../types";

const spec: TrackSpec = {
  slug: "rag-llamaindex-titan",
  name: "LlamaIndex: Novice to Titan",
  description: "Build data-backed LLM applications with LlamaIndex: documents and nodes, readers, parsers, indices, retrievers, query and chat engines, postprocessors, pipelines, agents, workflows and evaluation.",
  roles: "developer",
  groups: {
    data: "core data object",
    load: "data loading tool",
    parse: "node parser",
    index: "index type",
    retr: "retriever",
    qe: "query engine",
    chat: "chat component",
    synth: "response mode",
    post: "node postprocessor",
    ing: "ingestion component",
    store: "storage component",
    setting: "global setting",
    agent: "agent concept",
    flow: "workflow concept",
    evalm: "evaluation module",
  },
  cards: [
    // ---------- data ----------
    {
      group: "data", subject: "Document", tier: 1,
      says: ["is a container for a whole source item such as a file, page or database row", "holds text plus metadata", "is the usual input handed to an index or an ingestion pipeline"],
      use: "need to wrap raw text from your own source so it can be indexed",
      like: ["Node"],
    },
    {
      group: "data", subject: "Node", tier: 1,
      says: ["is a chunk of a source document that gets embedded and retrieved", "carries metadata and relationships to its source and neighbors", "is the unit that a retriever returns"],
      not: ["always represents an entire file"],
      like: ["Document", "TextNode"],
    },
    {
      group: "data", subject: "TextNode", tier: 2,
      says: ["is the node class that stores a text chunk", "has an id, text, metadata and an optional embedding", "is what splitters typically produce from documents"],
      like: ["Node"],
    },
    {
      group: "data", subject: "NodeWithScore", tier: 2,
      says: ["pairs a retrieved node with its relevance score", "is the item type a retriever's retrieve call returns", "exposes the underlying node through its node attribute"],
      use: "need to read the similarity score of a retrieved chunk",
    },
    {
      group: "data", subject: "Metadata dictionary", tier: 2,
      says: ["stores key-value facts such as filename or author on a document or node", "is copied from a document onto the nodes made from it", "can be used for filtering at query time"],
      like: ["Excluded metadata keys"],
    },
    {
      group: "data", subject: "Excluded metadata keys", tier: 3,
      says: ["hide chosen metadata fields from the embedding text or from the text shown to the model", "are set separately for embedding and for the LLM", "keep noisy fields such as file paths out of the semantic vector"],
      use: "want a metadata field kept for filtering but not embedded",
      like: ["Metadata dictionary"],
    },
    {
      group: "data", subject: "Node relationships", tier: 3,
      says: ["record links such as source, previous, next, parent and child between nodes", "let postprocessors fetch neighbors or parents of a hit", "are stored in the node's relationships mapping"],
      use: "want to walk from a retrieved chunk to the chunk after it",
    },
    {
      group: "data", subject: "IndexNode", tier: 4,
      says: ["is a node whose content points to another retriever or query engine", "lets recursive retrieval follow a summary into a deeper index", "stores an index id linking it to the object it refers to"],
      use: "a short summary should lead retrieval into a larger document-specific index",
    },
    {
      group: "data", subject: "Response object", tier: 2,
      says: ["is what a query engine returns for a question", "holds the answer text and the source nodes used to produce it", "makes citations possible through its source_nodes list"],
      use: "need to show which chunks an answer was based on",
    },
    {
      group: "data", subject: "ref_doc_id", tier: 3,
      says: ["identifies the source document that a node came from", "is used to delete or refresh all nodes of one document", "stays the same across all nodes split from one document"],
    },

    // ---------- load ----------
    {
      group: "load", subject: "SimpleDirectoryReader", tier: 1,
      says: ["loads files from a folder into Document objects", "picks a parser based on each file's extension", "can recurse into subfolders when asked"],
      use: "have a local folder of mixed PDFs and text files to index",
    },
    {
      group: "load", subject: "load_data", tier: 1,
      says: ["is the method that readers call to return a list of Documents", "is invoked after constructing a reader", "returns a list rather than a single Document"],
    },
    {
      group: "load", subject: "required_exts", tier: 2,
      says: ["limits a directory reader to files with listed extensions", "takes a list of strings such as .md", "avoids loading unrelated files in a mixed folder"],
      use: "only want Markdown files from a folder that also has images",
    },
    {
      group: "load", subject: "file_extractor", tier: 3,
      says: ["maps file extensions to custom reader classes", "overrides how a directory reader parses a given file type", "is passed to the directory reader's constructor"],
      use: "need a custom parser for one file type inside a directory",
    },
    {
      group: "load", subject: "LlamaHub", tier: 2,
      says: ["is a community collection of data connectors and tools for LlamaIndex", "provides readers for sources such as web pages, Notion and databases", "is installed as separate integration packages"],
      use: "need a connector for a SaaS app or database that is not built in",
    },
    {
      group: "load", subject: "LlamaParse", tier: 3,
      says: ["is a hosted document parsing service from the LlamaIndex team", "targets complex files such as PDFs with tables and multi-column layouts", "requires an API key to use"],
      use: "plain PDF text extraction mangles your tables",
    },
    {
      group: "load", subject: "Metadata function", tier: 3,
      says: ["lets a directory reader compute metadata for every file it loads", "is passed through the file_metadata argument", "receives a file path and returns a dictionary"],
    },
    {
      group: "load", subject: "Web page reader", tier: 2,
      says: ["fetches pages from URLs and turns them into Documents", "is provided through the reader integration packages", "brings HTML-derived text into the same pipeline as local files"],
    },
    {
      group: "load", subject: "Database reader", tier: 3,
      says: ["runs a query against a database and converts each row into text for a Document", "needs a connection string or client", "lets structured records be embedded like any other text"],
    },

    // ---------- parse ----------
    {
      group: "parse", subject: "SentenceSplitter", tier: 1,
      says: ["splits text into chunks while trying to keep sentences intact", "takes chunk_size and chunk_overlap arguments", "is the default node parser for general text"],
      use: "want sensible general-purpose chunks",
      like: ["TokenTextSplitter"],
    },
    {
      group: "parse", subject: "TokenTextSplitter", tier: 2,
      says: ["splits text strictly by token count", "does not try to respect sentence boundaries first", "is a simpler alternative to the sentence-aware splitter"],
      like: ["SentenceSplitter"],
    },
    {
      group: "parse", subject: "SentenceWindowNodeParser", tier: 3,
      says: ["creates one node per sentence and stores surrounding sentences in metadata", "supports replacing a hit with its window before generation", "pairs with MetadataReplacementPostProcessor"],
      use: "want to embed single sentences but give the model surrounding context",
    },
    {
      group: "parse", subject: "SemanticSplitterNodeParser", tier: 4,
      says: ["picks split points using embedding similarity between adjacent sentences", "needs an embedding model at parsing time", "produces chunks of variable length"],
      use: "topic shifts matter more than a fixed chunk length",
    },
    {
      group: "parse", subject: "HierarchicalNodeParser", tier: 4,
      says: ["produces several levels of chunk sizes with parent and child links", "supports auto-merging retrieval", "takes a list of chunk sizes from large to small"],
      use: "want small chunks that can merge back into larger parents",
    },
    {
      group: "parse", subject: "MarkdownNodeParser", tier: 3,
      says: ["splits Markdown along its headings", "records the heading path as metadata", "keeps sections of a document together"],
      use: "indexing documentation written in Markdown",
    },
    {
      group: "parse", subject: "CodeSplitter", tier: 4,
      says: ["splits source code using its syntax tree", "needs the programming language to be named", "avoids cutting through functions mid-body where possible"],
      use: "indexing source files for a coding assistant",
    },
    {
      group: "parse", subject: "JSONNodeParser", tier: 4,
      says: ["parses JSON content into nodes", "turns structured fields into text elements with their paths", "suits records exported from APIs"],
    },
    {
      group: "parse", subject: "HTMLNodeParser", tier: 3,
      says: ["parses HTML and splits it by chosen tags", "removes markup so nodes hold readable text", "lets you pick which tags become separate nodes"],
      use: "indexing saved web pages",
    },

    // ---------- index ----------
    {
      group: "index", subject: "VectorStoreIndex", tier: 1,
      says: ["stores node embeddings and retrieves by semantic similarity", "is the most commonly used index type", "can be built directly from documents with from_documents"],
      use: "want semantic search over a set of documents",
      like: ["SummaryIndex"],
    },
    {
      group: "index", subject: "SummaryIndex", tier: 2,
      says: ["keeps nodes in a simple list", "by default sends every node to the response synthesizer", "suits summarizing a whole small collection"],
      use: "want to summarize all content rather than find the best few chunks",
      like: ["VectorStoreIndex"],
    },
    {
      group: "index", subject: "KeywordTableIndex", tier: 3,
      says: ["extracts keywords from nodes and maps keywords to nodes", "retrieves nodes whose keywords match the query", "does not need embeddings to retrieve"],
      use: "keyword matching is enough and no embedding model is wanted",
    },
    {
      group: "index", subject: "TreeIndex", tier: 3,
      says: ["builds a hierarchy where parent nodes summarize their children", "can answer by traversing from the root downward", "requires model calls at build time to create the summaries"],
    },
    {
      group: "index", subject: "KnowledgeGraphIndex", tier: 4,
      says: ["extracts subject-predicate-object triplets from text", "retrieves facts by following entities in a graph", "needs a model call per node to extract triplets while building"],
      use: "questions depend on relationships between entities",
    },
    {
      group: "index", subject: "DocumentSummaryIndex", tier: 4,
      says: ["generates a summary for each document and indexes by those summaries", "retrieves whole-document candidates before looking at their chunks", "costs model calls for summaries at build time"],
      use: "many long documents, and you first want to pick the right document",
    },
    {
      group: "index", subject: "from_documents", tier: 1,
      says: ["is the helper that parses documents into nodes and builds an index in one call", "uses the global settings for splitting and embedding by default", "accepts a list of Document objects"],
      use: "want the shortest path from documents to a working index",
    },
    {
      group: "index", subject: "Index insert", tier: 3,
      says: ["adds a new document to an existing index without rebuilding it", "parses the document into nodes and embeds them", "is called with a Document object"],
      like: ["Index delete_ref_doc"],
    },
    {
      group: "index", subject: "Index delete_ref_doc", tier: 3,
      says: ["removes all nodes that came from one source document", "takes the document's ref_doc_id", "can also remove the document from the docstore when asked"],
      like: ["Index insert"],
    },

    // ---------- retr ----------
    {
      group: "retr", subject: "VectorIndexRetriever", tier: 2,
      says: ["fetches the nodes most similar to the query embedding", "uses similarity_top_k to decide how many to return", "is what a vector index's as_retriever call builds"],
    },
    {
      group: "retr", subject: "as_retriever", tier: 1,
      says: ["is the index method that returns a retriever configured with given options", "accepts similarity_top_k for vector indices", "returns nodes rather than a generated answer"],
      use: "want just the matching chunks with no LLM answer step",
    },
    {
      group: "retr", subject: "BM25Retriever", tier: 3,
      says: ["ranks nodes by BM25 keyword scoring", "needs no embedding model", "is built from nodes held in a docstore or list"],
      use: "queries rely on exact terms and identifiers",
    },
    {
      group: "retr", subject: "QueryFusionRetriever", tier: 3,
      says: ["merges results from several retrievers into one ranking", "can generate multiple query variants with an LLM", "offers reciprocal rank fusion as a merge mode"],
      use: "want to combine vector and keyword retrievers into one hybrid result",
    },
    {
      group: "retr", subject: "AutoMergingRetriever", tier: 4,
      says: ["replaces several retrieved child chunks with their parent chunk when enough siblings match", "works on nodes produced by a hierarchical parser", "needs a storage context that holds all the nodes"],
      use: "adjacent child chunks of one section keep matching together",
    },
    {
      group: "retr", subject: "RecursiveRetriever", tier: 4,
      says: ["follows references from retrieved nodes into other retrievers or query engines", "works with IndexNode objects", "supports hierarchies such as a summary leading to a detailed index"],
    },
    {
      group: "retr", subject: "RouterRetriever", tier: 4,
      says: ["uses a selector to choose which retriever should handle a query", "relies on tool descriptions to decide", "can pick more than one retriever"],
      like: ["RouterQueryEngine"],
    },
    {
      group: "retr", subject: "VectorIndexAutoRetriever", tier: 5,
      says: ["asks an LLM to infer metadata filters and a search string from the user's question", "needs a description of the metadata fields", "combines semantic search with generated filters"],
      use: "users phrase attribute constraints inside natural-language questions",
    },
    {
      group: "retr", subject: "MetadataFilters", tier: 3,
      says: ["restrict a vector retrieval to nodes with matching metadata", "are passed into as_retriever or as_query_engine via filters", "are built from individual MetadataFilter entries"],
      use: "each user may only search their own documents",
    },
    {
      group: "retr", subject: "similarity_top_k", tier: 1,
      says: ["sets how many nodes a vector retriever returns", "is a keyword argument to as_query_engine and as_retriever", "balances recall against prompt length"],
      not: ["sets the minimum similarity score that nodes must reach"],
    },

    // ---------- qe ----------
    {
      group: "qe", subject: "as_query_engine", tier: 1,
      says: ["is the index method that builds a ready-to-use query engine", "wires a retriever and a response synthesizer together", "forwards keyword arguments such as similarity_top_k"],
      use: "want a question-in, answer-out object from an index",
    },
    {
      group: "qe", subject: "RetrieverQueryEngine", tier: 2,
      says: ["combines any retriever with a response synthesizer and optional postprocessors", "is the building block behind most index query engines", "lets you swap in a custom retriever"],
      use: "need a query engine around a retriever you configured yourself",
    },
    {
      group: "qe", subject: "RouterQueryEngine", tier: 3,
      says: ["selects among several query engines for each question", "uses descriptions of the engines to choose", "can send a question to a summary engine or a vector engine"],
      use: "have separate engines for summaries and for specific facts",
    },
    {
      group: "qe", subject: "SubQuestionQueryEngine", tier: 4,
      says: ["breaks a complex question into sub-questions for different data sources", "runs each sub-question on a matching query engine tool", "combines the sub-answers into a final response"],
      use: "a question compares facts spread across several documents",
    },
    {
      group: "qe", subject: "CitationQueryEngine", tier: 3,
      says: ["produces answers with numbered references to source chunks", "splits sources into citation-sized chunks", "makes it clear which excerpt supports each statement"],
      use: "users must see numbered citations for every claim",
    },
    {
      group: "qe", subject: "TransformQueryEngine", tier: 4,
      says: ["wraps another query engine and rewrites the query before it runs", "is used together with a query transform such as HyDE", "leaves the wrapped engine's retrieval logic untouched"],
    },
    {
      group: "qe", subject: "NLSQLTableQueryEngine", tier: 4,
      says: ["converts a natural-language question into SQL", "runs the generated query against a database and explains the result", "needs the relevant tables to be described to the model"],
      use: "the answer is a figure stored in a relational table",
    },
    {
      group: "qe", subject: "CustomQueryEngine", tier: 4,
      says: ["is a base class for writing your own query logic", "requires a custom_query method", "lets you compose retrievers, prompts and models freely"],
    },
    {
      group: "qe", subject: "query method", tier: 1,
      says: ["sends a question to a query engine and returns a Response", "is synchronous, with aquery as its async counterpart", "does not remember earlier questions"],
      not: ["keeps the conversation history between calls"],
      like: ["chat method"],
    },
    {
      group: "qe", subject: "Streaming query engine", tier: 3,
      says: ["yields answer tokens as they are generated", "is enabled with streaming=True", "returns a streaming response object whose tokens can be printed as they arrive"],
    },

    // ---------- chat ----------
    {
      group: "chat", subject: "SimpleChatEngine", tier: 2,
      says: ["chats with the LLM directly and does not retrieve data", "keeps conversation history", "is useful as a plain chatbot without an index"],
      like: ["ContextChatEngine"],
    },
    {
      group: "chat", subject: "ContextChatEngine", tier: 3,
      says: ["retrieves context for every user message and puts it in the system prompt", "keeps conversation history alongside the retrieved text", "is built with the context chat mode"],
      use: "want every turn to be grounded in retrieved documents",
      like: ["CondenseQuestionChatEngine", "CondensePlusContextChatEngine"],
    },
    {
      group: "chat", subject: "CondenseQuestionChatEngine", tier: 3,
      says: ["rewrites each message and the history into a standalone question", "passes that question to a query engine", "does not give the model the raw conversation when answering"],
      like: ["ContextChatEngine", "CondensePlusContextChatEngine"],
    },
    {
      group: "chat", subject: "CondensePlusContextChatEngine", tier: 4,
      says: ["first condenses the conversation into a standalone question, then retrieves context for it", "gives the model both the retrieved text and the chat history", "combines condensing with context injection"],
      use: "follow-up questions need rewriting and answers also need the history",
      like: ["ContextChatEngine", "CondenseQuestionChatEngine"],
    },
    {
      group: "chat", subject: "ChatMemoryBuffer", tier: 3,
      says: ["stores recent chat messages up to a token limit", "drops the oldest messages once the limit is exceeded", "is created with from_defaults and a token_limit"],
      use: "need to cap how much history is sent each turn",
    },
    {
      group: "chat", subject: "as_chat_engine", tier: 2,
      says: ["is the index method that creates a chat engine", "selects the engine type through chat_mode", "gives a conversational interface over an index"],
      use: "want multi-turn conversation over an index",
    },
    {
      group: "chat", subject: "chat method", tier: 1,
      says: ["sends a message to a chat engine and returns the reply", "adds the exchange to the conversation history", "has stream_chat as its streaming counterpart"],
      like: ["query method"],
    },
    {
      group: "chat", subject: "reset method", tier: 3,
      says: ["clears a chat engine's stored conversation history", "starts the next message with no earlier context", "is called with no arguments"],
    },
    {
      group: "chat", subject: "ChatMessage", tier: 2,
      says: ["represents one turn with a role and content", "uses roles such as user, assistant and system", "is the type used to pass history to chat engines and LLMs"],
    },

    // ---------- synth ----------
    {
      group: "synth", subject: "compact mode", tier: 2,
      says: ["packs as many retrieved chunks as fit into each LLM call before refining", "is the default response mode for query engines", "uses fewer model calls than plain refine"],
      like: ["refine mode"],
    },
    {
      group: "synth", subject: "refine mode", tier: 3,
      says: ["processes retrieved chunks one at a time, improving the answer with each", "makes at least one LLM call per chunk", "starts from an answer to the first chunk and revises it"],
      like: ["compact mode"],
    },
    {
      group: "synth", subject: "tree_summarize mode", tier: 3,
      says: ["summarizes chunks in groups and then summarizes those summaries", "builds the answer bottom-up in a tree", "suits summarization of many chunks"],
      use: "need a single summary of many retrieved chunks",
    },
    {
      group: "synth", subject: "simple_summarize mode", tier: 3,
      says: ["truncates the combined chunks to fit one LLM call", "makes just one model call", "loses text that does not fit in the prompt"],
    },
    {
      group: "synth", subject: "accumulate mode", tier: 4,
      says: ["applies the query to each chunk separately", "joins the individual answers into one output", "produces one answer section per chunk"],
      use: "want an independent answer per chunk rather than a merged one",
    },
    {
      group: "synth", subject: "no_text mode", tier: 4,
      says: ["retrieves nodes but skips the LLM call entirely", "returns the source nodes without a synthesized answer", "is handy for inspecting what retrieval returned"],
      use: "want to inspect retrieved nodes without paying for generation",
    },
    {
      group: "synth", subject: "generation mode", tier: 4,
      says: ["ignores the retrieved context and calls the LLM with only the query", "behaves like a plain model call", "does not use the index's contents when writing the answer"],
    },
    {
      group: "synth", subject: "get_response_synthesizer", tier: 3,
      says: ["is the helper that builds a response synthesizer for a chosen mode", "takes a response_mode argument", "lets you pass a custom synthesizer into a RetrieverQueryEngine"],
    },
    {
      group: "synth", subject: "text_qa_template", tier: 3,
      says: ["is the prompt template used to answer a question from context text", "contains context and query placeholders", "can be replaced with update_prompts or an argument to customize wording"],
      use: "want to change the instructions given to the model when answering",
    },

    // ---------- post ----------
    {
      group: "post", subject: "SimilarityPostprocessor", tier: 2,
      says: ["removes retrieved nodes whose score falls below a cutoff", "takes a similarity_cutoff argument", "can leave a query with no source nodes"],
      use: "want to drop weak matches instead of always passing k chunks",
    },
    {
      group: "post", subject: "KeywordNodePostprocessor", tier: 3,
      says: ["keeps or drops nodes depending on required or excluded keywords", "filters by exact keyword presence", "takes required_keywords and exclude_keywords lists"],
    },
    {
      group: "post", subject: "MetadataReplacementPostProcessor", tier: 3,
      says: ["swaps a node's text for a value stored in its metadata", "is used with sentence-window parsing to restore the window", "takes the metadata key to replace with"],
      use: "retrieved sentences should be replaced with their surrounding windows",
    },
    {
      group: "post", subject: "LLMRerank", tier: 3,
      says: ["asks a language model to rate and reorder retrieved nodes", "uses a model call per batch of candidates", "can trim the list to a top-n"],
      like: ["SentenceTransformerRerank"],
    },
    {
      group: "post", subject: "SentenceTransformerRerank", tier: 3,
      says: ["reorders nodes with a cross-encoder model run locally", "takes a model name and top_n", "avoids spending LLM calls on reranking"],
      use: "want cross-encoder reranking without calling an LLM",
      like: ["LLMRerank"],
    },
    {
      group: "post", subject: "PrevNextNodePostprocessor", tier: 4,
      says: ["adds the nodes before or after each retrieved node using their relationships", "needs the docstore to look up neighbors", "can look forward, backward or both"],
      use: "need to expand a hit with the chunks that surround it",
    },
    {
      group: "post", subject: "LongContextReorder", tier: 4,
      says: ["reorders nodes so the most relevant sit at the beginning and end", "targets models that attend poorly to the middle of long prompts", "changes order only and does not alter node text"],
    },
    {
      group: "post", subject: "node_postprocessors argument", tier: 2,
      says: ["is the parameter that attaches postprocessors to a query engine", "takes a list that is applied in order", "runs after retrieval and before response synthesis"],
    },

    // ---------- ing ----------
    {
      group: "ing", subject: "IngestionPipeline", tier: 2,
      says: ["applies a list of transformations to documents and returns nodes", "can write the results to a vector store", "is configured through its transformations argument"],
      use: "want a repeatable pipeline that splits, enriches and embeds documents",
    },
    {
      group: "ing", subject: "Transformation", tier: 2,
      says: ["is a step such as a splitter, extractor or embedding model in a pipeline", "takes nodes in and returns nodes out", "can be chained in any sensible order"],
    },
    {
      group: "ing", subject: "IngestionCache", tier: 3,
      says: ["remembers the output of each transformation for given inputs", "skips repeated work such as re-embedding unchanged nodes", "can be persisted to disk or a remote store"],
      use: "reruns of the pipeline keep paying for unchanged content",
    },
    {
      group: "ing", subject: "Pipeline docstore", tier: 3,
      says: ["lets a pipeline track document hashes between runs", "supports skipping documents that have not changed", "can be attached to the pipeline through its docstore argument"],
      use: "want a pipeline to ignore documents that are already ingested",
    },
    {
      group: "ing", subject: "TitleExtractor", tier: 3,
      says: ["uses an LLM to generate document titles into node metadata", "gives each node a title to help retrieval", "is a metadata extractor that runs as a transformation"],
      like: ["QuestionsAnsweredExtractor", "SummaryExtractor"],
    },
    {
      group: "ing", subject: "QuestionsAnsweredExtractor", tier: 4,
      says: ["generates questions that a node could answer and stores them in metadata", "can make nodes easier to match against user questions", "costs one LLM call per node"],
      like: ["TitleExtractor", "SummaryExtractor"],
    },
    {
      group: "ing", subject: "SummaryExtractor", tier: 4,
      says: ["generates summaries of a node and its neighbors into metadata", "can summarize the previous, current or next chunk", "adds LLM calls at ingestion time"],
      like: ["TitleExtractor", "QuestionsAnsweredExtractor"],
    },
    {
      group: "ing", subject: "num_workers", tier: 4,
      says: ["runs pipeline transformations across several processes", "is passed to the pipeline's run method", "speeds up large ingestion jobs"],
    },

    // ---------- store ----------
    {
      group: "store", subject: "StorageContext", tier: 2,
      says: ["bundles the document store, index store, vector store and graph store", "is created with from_defaults", "can be loaded from or saved to a persist directory"],
    },
    {
      group: "store", subject: "persist", tier: 2,
      says: ["saves an index's stores to disk through the storage context", "takes a persist_dir argument", "lets an index be reloaded without re-embedding"],
      use: "want to avoid recomputing embeddings on every run",
    },
    {
      group: "store", subject: "load_index_from_storage", tier: 2,
      says: ["rebuilds an index from a saved storage context", "requires a storage context created from the persist directory", "skips parsing and embedding the documents again"],
      use: "reopen a saved default index in a later session",
    },
    {
      group: "store", subject: "SimpleVectorStore", tier: 2,
      says: ["is the default in-memory vector store", "persists to JSON files on disk", "suits small projects but not very large collections"],
      like: ["External vector store"],
    },
    {
      group: "store", subject: "External vector store", tier: 3,
      says: ["is a vector database integrated through a vector store class", "is passed into a StorageContext as vector_store", "holds embeddings outside the local process"],
      use: "need a shared, scalable vector database",
      like: ["SimpleVectorStore"],
    },
    {
      group: "store", subject: "from_vector_store", tier: 3,
      says: ["builds an index object on top of an existing vector store", "does not re-ingest documents already stored there", "is how you reconnect to a populated vector database"],
      use: "the vectors already exist in an external database",
    },
    {
      group: "store", subject: "Docstore", tier: 3,
      says: ["stores the node and document objects themselves", "lets retrievers and postprocessors look up full nodes by id", "is separate from the place that stores embeddings"],
      like: ["Index store"],
    },
    {
      group: "store", subject: "Index store", tier: 4,
      says: ["stores metadata about indices such as their structure", "keeps track of which nodes belong to which index", "is one of the stores held by the storage context"],
      like: ["Docstore"],
    },
    {
      group: "store", subject: "refresh_ref_docs", tier: 4,
      says: ["compares given documents with stored ones by document id and hash", "updates changed documents and inserts new ones", "returns a list showing which documents were refreshed"],
      use: "need to sync an index with an edited set of source files",
    },

    // ---------- setting ----------
    {
      group: "setting", subject: "Settings object", tier: 1,
      says: ["is the global configuration singleton for LlamaIndex", "holds defaults such as the LLM and embedding model", "replaced the older service context"],
      like: ["ServiceContext"],
    },
    {
      group: "setting", subject: "Settings.llm", tier: 1,
      says: ["sets the default language model used for answering and other LLM steps", "is used by query engines unless one is passed explicitly", "must be assigned before building anything that needs it"],
    },
    {
      group: "setting", subject: "Settings.embed_model", tier: 1,
      says: ["sets the default embedding model for indexing and querying", "is used when documents are embedded and when queries are embedded", "must stay the same between index building and querying"],
      not: ["can differ between building an index and querying it"],
    },
    {
      group: "setting", subject: "Settings.chunk_size", tier: 2,
      says: ["sets the default chunk size used by the global node parser", "affects how documents are split in from_documents", "is changed by assigning an integer"],
      like: ["Settings.chunk_overlap"],
    },
    {
      group: "setting", subject: "Settings.chunk_overlap", tier: 2,
      says: ["sets the default overlap between neighboring chunks", "is applied by the global node parser", "is assigned as an integer"],
      like: ["Settings.chunk_size"],
    },
    {
      group: "setting", subject: "Settings.node_parser", tier: 3,
      says: ["replaces the global default splitter", "determines how from_documents splits documents", "can be set to any node parser instance"],
    },
    {
      group: "setting", subject: "Local override", tier: 3,
      says: ["passes a model or parser directly to a component to override the global default", "affects only the component it is passed to", "keeps one index on a different model without changing the global configuration"],
      use: "one index needs a different embedding model from the rest of the app",
    },
    {
      group: "setting", subject: "ServiceContext", tier: 4,
      says: ["is the older way of bundling the LLM, embedding model and parser", "has been superseded by the global Settings object", "appears in older tutorials"],
      like: ["Settings object"],
    },

    // ---------- agent ----------
    {
      group: "agent", subject: "FunctionTool", tier: 2,
      says: ["wraps a Python function so an agent can call it", "is commonly built with FunctionTool.from_defaults", "derives its name and description from the function unless overridden"],
      use: "want an agent to call a custom Python function such as a calculator",
    },
    {
      group: "agent", subject: "QueryEngineTool", tier: 2,
      says: ["wraps a query engine so an agent can use it as a tool", "carries a name and a description that tell the agent when to use it", "lets an agent answer questions over an index"],
      use: "want an agent to query a document index as one of its tools",
    },
    {
      group: "agent", subject: "ToolMetadata", tier: 3,
      says: ["holds the name and description of a tool", "is what the model reads to decide whether to call the tool", "is created automatically for tools built with from_defaults"],
    },
    {
      group: "agent", subject: "ReAct agent", tier: 3,
      says: ["alternates between reasoning text, tool calls and observations", "works with any LLM that can follow a text format", "stops when it produces a final answer"],
      like: ["Function-calling agent"],
    },
    {
      group: "agent", subject: "Function-calling agent", tier: 3,
      says: ["uses a model's native tool-calling interface to pick tools", "needs an LLM that supports function calling", "receives tool choices as structured arguments rather than free text"],
      like: ["ReAct agent"],
    },
    {
      group: "agent", subject: "Tool description", tier: 2,
      says: ["is the text an agent uses to decide which tool fits a request", "should say what the tool does and when to call it", "directly affects whether the right tool is chosen"],
      use: "the agent keeps picking the wrong tool",
    },
    {
      group: "agent", subject: "ObjectIndex", tier: 5,
      says: ["indexes tools or other objects so that only the relevant ones are retrieved", "helps when there are too many tools to list in one prompt", "retrieves tool objects by semantic match with the query"],
      use: "an agent has dozens of tools and the prompt is too crowded",
    },
    {
      group: "agent", subject: "Agent memory", tier: 3,
      says: ["holds the earlier messages and tool results an agent can see", "is bounded by a token limit in the default buffer", "must be sized to the model's context"],
    },

    // ---------- flow ----------
    {
      group: "flow", subject: "Workflow", tier: 2,
      says: ["is a class whose steps react to events", "is run asynchronously by awaiting its run method", "structures multi-step LLM applications as an event-driven graph"],
    },
    {
      group: "flow", subject: "step decorator", tier: 2,
      says: ["marks a method as a workflow step", "infers the events a step accepts and returns from its type hints", "is written as @step on an async method"],
    },
    {
      group: "flow", subject: "StartEvent", tier: 2,
      says: ["is the event that begins a workflow run", "carries the keyword arguments passed to run", "must be accepted by one step"],
      like: ["StopEvent"],
    },
    {
      group: "flow", subject: "StopEvent", tier: 2,
      says: ["ends a workflow and carries the final result", "is returned by the last step", "has its result value returned by the awaited run call"],
      like: ["StartEvent"],
    },
    {
      group: "flow", subject: "Custom Event", tier: 3,
      says: ["is a subclass of Event holding the data passed between steps", "routes execution to whichever step accepts that event type", "carries named fields defined on the subclass"],
    },
    {
      group: "flow", subject: "Context", tier: 3,
      says: ["is shared state accessible to every step in a run", "stores and reads values across steps", "also lets steps send events and collect them"],
    },
    {
      group: "flow", subject: "collect_events", tier: 4,
      says: ["waits until several expected event types have arrived", "returns the collected events together, or none yet", "supports fan-in where parallel steps feed one step"],
      use: "a step needs results from multiple parallel branches before it can continue",
    },
    {
      group: "flow", subject: "Branching and looping", tier: 3,
      says: ["are done by returning different event types from a step", "allow a step to return an earlier event to retry or iterate", "need no special loop syntax in a workflow"],
    },
    {
      group: "flow", subject: "Workflow timeout", tier: 4,
      says: ["limits how long a run may take", "is set on the workflow constructor", "raises an error when exceeded"],
    },

    // ---------- evalm ----------
    {
      group: "evalm", subject: "FaithfulnessEvaluator", tier: 2,
      says: ["checks whether an answer is supported by its retrieved source nodes", "detects hallucination relative to the context", "uses a language model as the judge"],
      like: ["RelevancyEvaluator"],
    },
    {
      group: "evalm", subject: "RelevancyEvaluator", tier: 2,
      says: ["checks whether the retrieved context and answer fit the query", "tests relevance of the response to the question", "judges the query against the response and its sources"],
      like: ["FaithfulnessEvaluator"],
    },
    {
      group: "evalm", subject: "CorrectnessEvaluator", tier: 3,
      says: ["compares a generated answer with a reference answer", "returns a score and feedback", "needs a reference answer to be provided"],
      use: "have ground-truth answers and want a graded comparison",
    },
    {
      group: "evalm", subject: "SemanticSimilarityEvaluator", tier: 4,
      says: ["scores the embedding similarity between a response and a reference", "needs no language model judge for scoring", "ignores whether the wording matches exactly"],
    },
    {
      group: "evalm", subject: "GuidelineEvaluator", tier: 4,
      says: ["judges a response against a written guideline", "lets you define custom criteria in plain language", "returns whether the guideline was met with feedback"],
      use: "want to check answers against your own style or policy rules",
    },
    {
      group: "evalm", subject: "RetrieverEvaluator", tier: 3,
      says: ["measures retrieval quality with metrics such as hit rate and MRR", "compares retrieved node ids with expected ids", "evaluates the retriever without generating answers"],
    },
    {
      group: "evalm", subject: "BatchEvalRunner", tier: 4,
      says: ["runs several evaluators over many queries in parallel", "takes a dictionary of named evaluators", "returns results grouped by evaluator name"],
      use: "need to evaluate hundreds of questions with multiple evaluators",
    },
    {
      group: "evalm", subject: "Question-context dataset generation", tier: 4,
      says: ["uses an LLM to write questions from nodes and records which node answers each", "creates labeled data for retrieval evaluation", "is provided by generate_question_context_pairs"],
      use: "no evaluation questions exist yet for your corpus",
    },
    {
      group: "evalm", subject: "EvaluationResult", tier: 3,
      says: ["is the object returned by an evaluator", "carries fields such as passing, score and feedback", "includes the query and response that were judged"],
    },
  ],
  qa: [
    {
      q: "What does this code do?",
      code: "from llama_index.core import VectorStoreIndex, SimpleDirectoryReader\n\ndocs = SimpleDirectoryReader(\"data\").load_data()\nindex = VectorStoreIndex.from_documents(docs)\nengine = index.as_query_engine()\nprint(engine.query(\"What is the refund policy?\"))",
      right: "Loads files from the data folder, builds a vector index and prints an answer to the question",
      wrong: ["Deletes the data folder after building the index", "Prints the raw embeddings of the folder's files", "Starts a chat session that remembers earlier questions"],
      tier: 1, why: "The reader loads Documents, from_documents builds the index, and the query engine retrieves and answers.",
    },
    {
      q: "Which import gives you the core classes in current LlamaIndex releases?",
      right: "from llama_index.core import VectorStoreIndex",
      wrong: ["from llama_index.vector import VectorStoreIndex", "from llamaindex import VectorStoreIndex", "import VectorStoreIndex from llama_index"],
      tier: 1, why: "Core abstractions live under the llama_index.core namespace.",
    },
    {
      q: "What does similarity_top_k=5 control here?",
      code: "engine = index.as_query_engine(similarity_top_k=5)",
      right: "The number of most similar nodes retrieved for each question",
      wrong: ["The minimum similarity score a node must have", "The number of questions the engine can answer", "The number of tokens in each answer"],
      tier: 1, why: "similarity_top_k is the k for the vector retriever.",
    },
    {
      q: "What is the difference between these two calls?",
      code: "retriever = index.as_retriever(similarity_top_k=3)\nnodes = retriever.retrieve(\"What is covered?\")",
      right: "retrieve returns a list of NodeWithScore objects and makes no answer-generating LLM call",
      wrong: ["retrieve returns a single string answer written by the LLM", "retrieve returns embeddings for the whole index", "retrieve builds a new index from the query"],
      tier: 2, why: "A retriever only returns scored nodes; synthesis is the query engine's job.",
    },
    {
      q: "How do you read which chunks supported the answer?",
      code: "response = engine.query(\"What is the notice period?\")",
      right: "response.source_nodes",
      wrong: ["response.chunks_used()", "engine.sources", "response.index.nodes"],
      tier: 2, why: "The Response object exposes retrieved nodes in source_nodes.",
    },
    {
      q: "What does this configuration do?",
      code: "from llama_index.core import Settings\nfrom llama_index.core.node_parser import SentenceSplitter\n\nSettings.node_parser = SentenceSplitter(chunk_size=512, chunk_overlap=50)",
      right: "Makes 512-token chunks with 50 tokens of overlap the default for later index building",
      wrong: ["Limits every answer to 512 characters", "Splits only the next document and then resets", "Deletes 50 nodes from each index"],
      tier: 2, why: "Settings.node_parser sets the global default parser for operations like from_documents.",
    },
    {
      q: "How do you save and later reload an index?",
      code: "index.storage_context.persist(persist_dir=\"./storage\")\n\nfrom llama_index.core import StorageContext, load_index_from_storage\nstorage_context = StorageContext.from_defaults(persist_dir=\"./storage\")\nindex = load_index_from_storage(storage_context)",
      right: "Persist the storage context to a folder, then rebuild a StorageContext from it and load the index",
      wrong: ["Pickle the retriever and call index.load()", "Call index.save() and index.open()", "Call from_documents again with persist=True"],
      tier: 2, why: "load_index_from_storage needs a StorageContext created from the persist directory.",
    },
    {
      q: "What does as_retriever with filters do here?",
      code: "from llama_index.core.vector_stores import MetadataFilters, MetadataFilter\n\nfilters = MetadataFilters(filters=[MetadataFilter(key=\"dept\", value=\"legal\")])\nretriever = index.as_retriever(filters=filters)",
      right: "Restricts retrieval to nodes whose metadata dept equals legal",
      wrong: ["Rewrites the query so it mentions legal", "Deletes all nodes that are not from legal", "Changes the embedding model to a legal-specific one"],
      tier: 3, why: "MetadataFilters constrain which nodes the vector store may return.",
    },
    {
      q: "Which setup makes a query engine drop nodes scoring under 0.75?",
      code: "A) index.as_query_engine(node_postprocessors=[SimilarityPostprocessor(similarity_cutoff=0.75)])\nB) index.as_query_engine(similarity_top_k=0.75)\nC) index.as_query_engine(response_mode=\"cutoff\")\nD) index.as_query_engine(min_score=0.75)",
      right: "A",
      wrong: ["B", "C", "D"],
      tier: 3, why: "SimilarityPostprocessor with similarity_cutoff filters by score; the other arguments are invalid or mean something else.",
    },
    {
      q: "A key setup rule when building an index and later querying it is:",
      right: "Use the same embedding model for indexing and querying",
      wrong: ["Use a different embedding model for queries to add variety", "Use a larger embedding model only for queries", "Embedding models are interchangeable at query time"],
      tier: 2, why: "Query vectors must live in the same vector space as the stored document vectors.",
    },
    {
      q: "What does response_mode=\"tree_summarize\" do?",
      code: "engine = index.as_query_engine(response_mode=\"tree_summarize\")",
      right: "Summarizes groups of chunks and then summarizes those summaries into one answer",
      wrong: ["Builds a TreeIndex from the query", "Returns only the first retrieved chunk", "Skips the LLM and returns raw nodes"],
      tier: 3, why: "tree_summarize recursively summarizes chunks bottom-up.",
    },
    {
      q: "You want to see the retrieved nodes but avoid any generation cost. Which line does that?",
      right: "index.as_query_engine(response_mode=\"no_text\")",
      wrong: ["index.as_query_engine(response_mode=\"refine\")", "index.as_query_engine(similarity_top_k=0)", "index.as_query_engine(streaming=True)"],
      tier: 3, why: "no_text retrieves nodes and skips the LLM synthesis step.",
    },
    {
      q: "What is the bug in this chat setup meant to remember history?",
      code: "for msg in messages:\n    engine = index.as_chat_engine()\n    print(engine.chat(msg))",
      right: "A new chat engine is created every turn, so conversation history is lost",
      wrong: ["as_chat_engine can only be called after persist", "chat must be called with a ChatMessage list", "The loop should call engine.reset before every message"],
      tier: 3, why: "History lives inside the chat engine instance, so it must be created once outside the loop.",
    },
    {
      q: "Which chat mode retrieves context for each user message and injects it into the system prompt?",
      code: "chat_engine = index.as_chat_engine(chat_mode=\"context\")",
      right: "context",
      wrong: ["condense_question", "simple", "best"],
      tier: 3, why: "The context chat mode uses a retriever on every message and inserts the text in the system prompt.",
    },
    {
      q: "How do you cap the history a chat engine remembers?",
      code: "from llama_index.core.memory import ChatMemoryBuffer\n\nmemory = ChatMemoryBuffer.from_defaults(token_limit=3000)\nchat_engine = index.as_chat_engine(chat_mode=\"context\", memory=memory)",
      right: "With a ChatMemoryBuffer that has a token limit, passed in as memory",
      wrong: ["By setting similarity_top_k to 3000", "By calling persist with a limit", "By setting Settings.chunk_size to 3000"],
      tier: 3, why: "The memory buffer drops older messages when the limit is exceeded.",
    },
    {
      q: "What does this pipeline return?",
      code: "from llama_index.core.ingestion import IngestionPipeline\nfrom llama_index.core.node_parser import SentenceSplitter\n\npipeline = IngestionPipeline(transformations=[SentenceSplitter(chunk_size=256)])\nnodes = pipeline.run(documents=docs)",
      right: "A list of nodes made by splitting the documents with 256-token chunks",
      wrong: ["A VectorStoreIndex built from the documents", "A single merged Document", "A dictionary of embeddings keyed by filename"],
      tier: 2, why: "Run applies the transformations and returns the resulting nodes.",
    },
    {
      q: "How would you make the pipeline write embeddings to a vector store as well?",
      code: "pipeline = IngestionPipeline(\n    transformations=[SentenceSplitter(chunk_size=256), embed_model],\n    vector_store=vector_store,\n)\npipeline.run(documents=docs)",
      right: "Include the embedding model as a transformation and pass vector_store to the pipeline",
      wrong: ["Call vector_store.write(pipeline) afterwards", "Set Settings.llm to the vector store", "Pass vector_store to SentenceSplitter"],
      tier: 3, why: "Nodes need embeddings before the pipeline can store them in the vector store.",
    },
    {
      q: "Why attach a docstore to an IngestionPipeline?",
      right: "So documents with unchanged hashes are skipped on later runs",
      wrong: ["To make the embeddings smaller", "To allow the pipeline to run without a splitter", "To translate documents into one language"],
      tier: 3, why: "The docstore records document hashes so the pipeline can detect duplicates and changes.",
    },
    {
      q: "What does this create?",
      code: "from llama_index.core.tools import FunctionTool\n\ndef multiply(a: float, b: float) -> float:\n    \"\"\"Multiply two numbers.\"\"\"\n    return a * b\n\ntool = FunctionTool.from_defaults(fn=multiply)",
      right: "A tool whose name and description come from the function, ready for an agent to call",
      wrong: ["A query engine that multiplies embeddings", "An index of multiplication tables", "A workflow with a single step named multiply"],
      tier: 2, why: "from_defaults derives tool metadata from the function name, signature and docstring.",
    },
    {
      q: "What do the name and description do here?",
      code: "from llama_index.core.tools import QueryEngineTool\n\ntool = QueryEngineTool.from_defaults(\n    query_engine=engine,\n    name=\"handbook\",\n    description=\"Answers questions about HR policies.\",\n)",
      right: "They tell the agent what the tool is and when to use it",
      wrong: ["They name the files that the index reads", "They set the prompt template for the query engine", "They are ignored by the agent and used only for logging"],
      tier: 2, why: "Agents rely on tool metadata to choose between tools.",
    },
    {
      q: "In a workflow, what makes a step run?",
      code: "class MyFlow(Workflow):\n    @step\n    async def first(self, ev: StartEvent) -> MyEvent:\n        return MyEvent(msg=\"hi\")\n\n    @step\n    async def second(self, ev: MyEvent) -> StopEvent:\n        return StopEvent(result=ev.msg)",
      right: "The type of event it accepts, as declared in its type hints",
      wrong: ["The order the methods appear in the file", "The alphabetical order of the method names", "A call to run_step inside the previous method"],
      tier: 3, why: "Steps are triggered by events matching their annotated input type.",
    },
    {
      q: "What does this print?",
      code: "result = await MyFlow(timeout=30).run()\nprint(result)",
      right: "hi",
      wrong: ["MyEvent(msg='hi')", "StopEvent", "None"],
      tier: 3, why: "The StopEvent's result value is returned from run; the first step passes msg='hi' to the second.",
    },
    {
      q: "How can a workflow step retry or loop?",
      right: "By returning an event type that an earlier step accepts",
      wrong: ["By calling its own method name recursively with decorators", "By raising StopIteration", "By setting loop=True on the Workflow"],
      tier: 4, why: "Control flow in workflows is expressed through the events steps return.",
    },
    {
      q: "Which evaluator needs a reference answer?",
      right: "CorrectnessEvaluator",
      wrong: ["FaithfulnessEvaluator", "RelevancyEvaluator", "BatchEvalRunner"],
      tier: 3, why: "Correctness compares the generated answer with a provided reference answer; the others judge against the query and context.",
    },
    {
      q: "What does this code check?",
      code: "from llama_index.core.evaluation import FaithfulnessEvaluator\n\nevaluator = FaithfulnessEvaluator(llm=llm)\nresult = evaluator.evaluate_response(response=response)\nprint(result.passing)",
      right: "Whether the answer is supported by the retrieved source nodes",
      wrong: ["Whether the answer matches a stored reference exactly", "Whether the index contains duplicate nodes", "Whether the retrieval was faster than a threshold"],
      tier: 3, why: "Faithfulness checks support from context and reports passing or failing.",
    },
    {
      q: "Which pair is correctly matched?",
      right: "RetrieverEvaluator: hit rate and MRR on retrieved node ids",
      wrong: ["FaithfulnessEvaluator: hit rate and MRR on retrieved node ids", "CorrectnessEvaluator: checks the embedding dimension", "BatchEvalRunner: splits documents into nodes"],
      tier: 3, why: "Retriever evaluation compares retrieved ids to expected ids, producing ranking metrics.",
    },
    {
      q: "A SimpleDirectoryReader loads PDFs and Markdown files, but you want only Markdown. Which argument do you add?",
      code: "SimpleDirectoryReader(\"docs\", required_exts=[\".md\"]).load_data()",
      right: "required_exts=[\".md\"]",
      wrong: ["only_md=True", "filter=\"md\"", "skip_pdf=True"],
      tier: 2, why: "required_exts takes a list of extensions to include.",
    },
    {
      q: "What does recursive=True do?",
      code: "SimpleDirectoryReader(\"docs\", recursive=True).load_data()",
      right: "Includes files in subdirectories",
      wrong: ["Loads each file twice for redundancy", "Splits each file into smaller files", "Calls the LLM on each file recursively"],
      tier: 1, why: "By default only the top level of the directory is read.",
    },
    {
      q: "You construct a Document like this. What is the metadata used for?",
      code: "from llama_index.core import Document\n\ndoc = Document(text=\"Return policy...\", metadata={\"dept\": \"support\", \"year\": 2024})",
      right: "It is attached to the document and copied to its nodes, and can be used for filtering",
      wrong: ["It replaces the text when the document is indexed", "It is deleted before embedding and cannot be read again", "It controls which LLM answers questions"],
      tier: 2, why: "Metadata travels with nodes and enables filters and citations.",
    },
    {
      q: "How do you keep the file_path metadata out of the embedding text?",
      code: "doc.excluded_embed_metadata_keys = [\"file_path\"]",
      right: "By adding the key to the document's excluded_embed_metadata_keys",
      wrong: ["By deleting the metadata dictionary", "By setting chunk_overlap to 0", "By calling index.hide(\"file_path\")"],
      tier: 3, why: "Excluded keys are left out of the text that is embedded but remain stored as metadata.",
    },
    {
      q: "Which retriever combination implements hybrid search with fusion?",
      code: "retriever = QueryFusionRetriever(\n    [vector_retriever, bm25_retriever],\n    similarity_top_k=5,\n    num_queries=1,\n    mode=\"reciprocal_rerank\",\n)",
      right: "The fusion retriever merges vector and BM25 results with reciprocal rank fusion",
      wrong: ["It picks only the retriever with the higher score", "It runs BM25 on the embeddings", "It concatenates the two result lists without ranking"],
      tier: 4, why: "QueryFusionRetriever merges the result lists; reciprocal_rerank is its rank-fusion mode.",
    },
    {
      q: "How do you run a query engine over a custom retriever?",
      code: "from llama_index.core.query_engine import RetrieverQueryEngine\n\nengine = RetrieverQueryEngine.from_args(retriever, response_mode=\"compact\")",
      right: "Wrap the retriever with RetrieverQueryEngine.from_args",
      wrong: ["Call retriever.as_query_engine_from_args()", "Assign the retriever to Settings.llm", "Call index.persist(retriever)"],
      tier: 3, why: "RetrieverQueryEngine combines a retriever with a response synthesizer.",
    },
    {
      q: "What does auto-merging retrieval need from the parser?",
      right: "A hierarchical parser that produces parent and child nodes",
      wrong: ["A semantic splitter with no overlap", "A JSON parser", "A code splitter with a named language"],
      tier: 4, why: "Merging child hits into parents depends on the parent-child links created by hierarchical parsing.",
    },
    {
      q: "What does the refine mode cost compared to compact?",
      right: "It usually makes more LLM calls, because chunks are processed one by one",
      wrong: ["It makes fewer calls because it packs more into each one", "It makes no LLM calls", "It always makes exactly one call"],
      tier: 3, why: "Compact packs chunks into fewer calls before refining.",
    },
    {
      q: "A KeywordTableIndex is a good fit when:",
      right: "keyword matches are enough and you do not want to compute embeddings",
      wrong: ["you need semantic matching of paraphrases", "you want a hierarchy of summaries", "you want to store images"],
      tier: 3, why: "It maps keywords to nodes and retrieves without embeddings.",
    },
    {
      q: "Which statement about SummaryIndex retrieval by default is true?",
      right: "It returns all nodes, so the answer considers the whole collection",
      wrong: ["It returns only the top 2 nodes", "It uses embeddings to pick nodes", "It returns no nodes without a filter"],
      tier: 3, why: "A summary index is a list; the default retriever hands everything to the synthesizer.",
    },
    {
      q: "What does stream_chat give you that chat does not?",
      code: "response = chat_engine.stream_chat(\"Summarize the policy\")\nfor token in response.response_gen:\n    print(token, end=\"\")",
      right: "Tokens as they are generated, instead of waiting for the full reply",
      wrong: ["Chat history is disabled", "Retrieval is skipped", "A longer reply limit"],
      tier: 3, why: "stream_chat returns a streaming response with a generator of tokens.",
    },
    {
      q: "What does the sentence-window setup need to give the LLM the surrounding sentences?",
      code: "parser = SentenceWindowNodeParser.from_defaults(window_size=3, window_metadata_key=\"window\", original_text_metadata_key=\"original_text\")\npostproc = MetadataReplacementPostProcessor(target_metadata_key=\"window\")",
      right: "A replacement postprocessor that swaps node text for the window stored in metadata",
      wrong: ["A larger similarity_top_k only", "A summary index in place of the vector index", "A reranker that adds neighbors"],
      tier: 4, why: "The parser stores windows in metadata, and the postprocessor swaps them into the text before synthesis.",
    },
  ],
  calc: [],
};

// Cards in these clusters can truthfully share predicates, so never use one as a distractor for another.
const clusters: string[][] = [
  ["VectorIndexRetriever", "as_retriever", "similarity_top_k", "MetadataFilters", "as_query_engine"],
  ["FaithfulnessEvaluator", "RelevancyEvaluator", "CorrectnessEvaluator", "SemanticSimilarityEvaluator", "GuidelineEvaluator", "RetrieverEvaluator", "BatchEvalRunner", "EvaluationResult", "Question-context dataset generation"],
  ["Settings object", "Settings.llm", "Settings.embed_model", "Settings.chunk_size", "Settings.chunk_overlap", "Settings.node_parser", "Local override", "ServiceContext"],
  ["IngestionPipeline", "Transformation", "IngestionCache", "Pipeline docstore", "num_workers"],
];
for (const cl of clusters) for (const c of spec.cards) if (cl.includes(c.subject)) c.like = [...new Set([...(c.like ?? []), ...cl.filter((x) => x !== c.subject)])];

export default spec;
