import type { TrackSpec } from "../types";

const spec: TrackSpec = {
  slug: "rag-pipelines-titan",
  name: "RAG Pipelines: Novice to Titan",
  description: "Build retrieval-augmented generation systems: ingestion, chunking, embeddings, hybrid retrieval, reranking, grounding, evaluation and advanced patterns.",
  roles: "developer",
  groups: {
    ingest: "ingestion step",
    chunk: "chunking strategy",
    embed: "embedding concept",
    search: "retrieval method",
    score: "scoring method",
    query: "query transformation",
    post: "post-retrieval step",
    gen: "generation practice",
    eval: "evaluation measure",
    fail: "failure mode",
    adv: "advanced RAG pattern",
    ops: "operational concern",
  },
  cards: [
    // ---------- ingest ----------
    {
      group: "ingest", subject: "Document loading", tier: 1,
      says: ["reads raw files, pages or records from their source into text the pipeline can process", "is the first stage of building an index", "has to handle many formats such as PDF, HTML and spreadsheets"],
      use: "need to pull content out of a shared drive, website or database",
      not: ["decides which chunk the model should read at query time"],
    },
    {
      group: "ingest", subject: "Text extraction from PDFs", tier: 2,
      says: ["turns page layouts into plain text, often losing reading order or table structure", "needs layout-aware parsing for multi-column pages", "produces garbage when fed a scanned page with no text layer"],
      use: "find that retrieved chunks contain jumbled columns from a PDF",
      like: ["OCR"],
    },
    {
      group: "ingest", subject: "OCR", tier: 2,
      says: ["recognizes text in images and scanned pages so they can be indexed", "is required when a PDF has no embedded text layer", "can introduce character errors that hurt keyword matching"],
      use: "must index scanned contracts that are only images",
      like: ["Text extraction from PDFs"],
    },
    {
      group: "ingest", subject: "Boilerplate removal", tier: 2,
      says: ["strips navigation bars, footers and cookie notices from scraped pages", "stops repeated page furniture from polluting many chunks", "raises the share of useful content in each embedding"],
      use: "scraped web pages return chunks full of menu links",
      not: ["compresses vectors to save storage"],
    },
    {
      group: "ingest", subject: "Deduplication", tier: 3,
      says: ["removes identical or near-identical documents before indexing", "prevents the top-k from filling with copies of the same passage", "often relies on hashing or similarity thresholds"],
      use: "the same policy appears in five folders and fills the results with copies",
      not: ["merges two different documents into one summary"],
    },
    {
      group: "ingest", subject: "Metadata extraction", tier: 2,
      says: ["captures fields such as title, author, date and source with each document", "enables filtering and citation later in the pipeline", "is attached to every chunk derived from the document"],
      use: "want users to filter results by department or year",
    },
    {
      group: "ingest", subject: "Table handling", tier: 4,
      says: ["converts tables into a form that keeps row and column relationships, such as Markdown or structured records", "avoids flattening cells into an unreadable run of numbers", "may add a short generated description so the table can be found semantically"],
      use: "answers must cite figures out of financial tables",
    },
    {
      group: "ingest", subject: "Incremental indexing", tier: 3,
      says: ["processes only new or changed documents on each run", "relies on content hashes or modification timestamps to detect changes", "avoids re-embedding the entire corpus for small updates"],
      use: "the corpus is large and a few files change every day",
      like: ["Full reindexing"],
    },
    {
      group: "ingest", subject: "Full reindexing", tier: 3,
      says: ["rebuilds the whole index from scratch", "becomes necessary after switching to a different embedding model", "guarantees all vectors come from one consistent model and chunking setup"],
      use: "are changing the embedding model for the whole corpus",
      like: ["Incremental indexing"],
    },
    {
      group: "ingest", subject: "Text normalization", tier: 3,
      says: ["cleans whitespace, encoding problems and broken hyphenation in extracted text", "makes identical content produce identical chunks and hashes", "fixes artifacts such as words split across line breaks"],
      not: ["translates every document into one language"],
    },
    {
      group: "ingest", subject: "PII scrubbing", tier: 4,
      says: ["detects and masks personal data before text is indexed", "keeps sensitive values from ever reaching the vector store or the prompt", "is applied at ingestion rather than hoping the model refuses to repeat them"],
      use: "indexed support tickets contain customer phone numbers and card details",
    },

    // ---------- chunk ----------
    {
      group: "chunk", subject: "Fixed-size chunking", tier: 1,
      says: ["splits text into pieces of a set character or token length", "is the simplest strategy and ignores sentence or section boundaries", "can cut a sentence or idea in half"],
      use: "need a quick baseline with no document structure assumptions",
      like: ["Recursive chunking"],
    },
    {
      group: "chunk", subject: "Chunk overlap", tier: 1,
      says: ["repeats the end of one chunk at the start of the next", "reduces the chance an answer is split across a boundary", "increases the total number of tokens stored and embedded"],
      not: ["guarantees no information is ever lost at chunk boundaries"],
    },
    {
      group: "chunk", subject: "Recursive chunking", tier: 2,
      says: ["tries a list of separators from paragraph breaks down to single characters", "keeps paragraphs and sentences together whenever they fit the size limit", "falls back to smaller separators only when a piece is still too large"],
      use: "want a sensible default for generic prose",
      like: ["Fixed-size chunking"],
    },
    {
      group: "chunk", subject: "Sentence-based chunking", tier: 2,
      says: ["packs whole sentences into a chunk until a size limit is reached", "never splits in the middle of a sentence", "yields chunks of uneven length"],
      like: ["Recursive chunking"],
    },
    {
      group: "chunk", subject: "Semantic chunking", tier: 3,
      says: ["places boundaries where the embedding similarity between adjacent sentences drops", "groups text by topic rather than by length", "costs extra embedding calls during ingestion"],
      use: "documents shift topic without clear headings",
      not: ["produces chunks that are always exactly the same length"],
    },
    {
      group: "chunk", subject: "Structure-aware chunking", tier: 3,
      says: ["splits along headings, sections, list items or code blocks", "keeps a section title attached to its body text", "relies on the document having reliable markup"],
      use: "indexing Markdown or HTML documentation with clear headings",
    },
    {
      group: "chunk", subject: "Contextual chunk headers", tier: 3,
      says: ["prepend the document title and section path to each chunk before embedding", "let a short chunk carry the context it lost when it was cut out of its document", "help distinguish similar passages from different documents"],
      use: "chunks say \"the limit is 5\" with no hint of what they describe",
    },
    {
      group: "chunk", subject: "Proposition chunking", tier: 4,
      says: ["rewrites text into self-contained factual statements before indexing", "resolves pronouns so each unit makes sense alone", "needs a language model pass over the corpus at ingestion time"],
    },
    {
      group: "chunk", subject: "Sliding window chunking", tier: 3,
      says: ["moves a fixed-length window across the text with a step smaller than the window", "creates heavily overlapping chunks by design", "trades extra storage for fewer split answers"],
      like: ["Chunk overlap"],
    },
    {
      group: "chunk", subject: "Code-aware chunking", tier: 4,
      says: ["splits source files along functions, classes or syntax tree nodes", "keeps a function body together with its signature", "avoids cutting code in the middle of a block"],
      use: "indexing a repository for a coding assistant",
    },
    {
      group: "chunk", subject: "Chunk size trade-off", tier: 2,
      says: ["balances precise matches from small chunks against fuller context from large ones", "must fit within the embedding model's input limit", "usually needs to be tuned on real questions rather than guessed"],
      not: ["is always best at the largest size the embedding model accepts"],
    },

    // ---------- embed ----------
    {
      group: "embed", subject: "Embedding", tier: 1,
      says: ["maps text to a vector so that similar meaning lands close together", "has a fixed length set by the model that produced it", "lets semantic search compare meaning rather than exact words"],
      use: "need to compare a question with passages by meaning",
    },
    {
      group: "embed", subject: "Embedding model", tier: 1,
      says: ["is the neural network that converts text into vectors", "must be the same one for indexing documents and encoding queries", "determines the dimensionality of the stored vectors"],
      not: ["can be swapped at query time without reindexing the documents"],
    },
    {
      group: "embed", subject: "Vector dimensionality", tier: 2,
      says: ["is the number of values in each embedding", "drives storage size and search cost per vector", "is fixed for a given model and index"],
    },
    {
      group: "embed", subject: "Bi-encoder", tier: 3,
      says: ["encodes the query and each document independently into vectors", "allows document vectors to be precomputed and indexed", "scores a pair by comparing two vectors rather than reading them together"],
      like: ["Cross-encoder"],
      use: "need first-stage search across millions of passages",
    },
    {
      group: "embed", subject: "Cross-encoder", tier: 3,
      says: ["reads the query and one document together in a single forward pass", "is more accurate than a bi-encoder but far too slow to run over a whole corpus", "cannot have its scores precomputed per document"],
      like: ["Bi-encoder"],
      use: "want to rescore only a short list of candidates precisely",
    },
    {
      group: "embed", subject: "Asymmetric search", tier: 3,
      says: ["matches short questions against longer answer passages", "may require a different prefix or instruction for queries than for documents", "differs from symmetric tasks such as finding duplicate sentences"],
    },
    {
      group: "embed", subject: "Domain mismatch", tier: 4,
      says: ["happens when an embedding model was not exposed to a field's jargon", "makes specialist terms cluster poorly or collide with everyday meanings", "can be reduced by fine-tuning the embedding model on in-domain pairs"],
      like: ["Embedding drift"],
    },
    {
      group: "embed", subject: "Embedding fine-tuning", tier: 4,
      says: ["adapts an embedding model using query and relevant-passage pairs", "pulls matching pairs closer and non-matching pairs apart", "requires re-embedding the corpus afterwards"],
      use: "off-the-shelf embeddings keep missing your company's terminology",
    },
    {
      group: "embed", subject: "Sparse vector", tier: 3,
      says: ["has a dimension per vocabulary term with most values zero", "supports exact term matching and is usually weighted by term importance", "contrasts with a dense embedding where every value is used"],
      like: ["Dense vector"],
    },
    {
      group: "embed", subject: "Dense vector", tier: 2,
      says: ["packs meaning into a few hundred or thousand continuous values", "can match paraphrases that share no words with the query", "is the output of a typical embedding model"],
      like: ["Sparse vector"],
    },
    {
      group: "embed", subject: "Multilingual embeddings", tier: 4,
      says: ["place text from different languages in one shared vector space", "allow a query in one language to retrieve a passage in another", "depend on the underlying model being trained on those languages"],
    },
    {
      group: "embed", subject: "Embedding drift", tier: 5,
      says: ["appears when vectors in one index come from mixed model versions", "makes similarity scores between old and new vectors meaningless", "is prevented by versioning the embedding model alongside the index"],
      like: ["Domain mismatch"],
    },

    // ---------- search ----------
    {
      group: "search", subject: "Dense retrieval", tier: 1,
      says: ["finds passages whose embeddings are nearest to the query embedding", "matches on meaning rather than shared words", "can miss rare identifiers such as part numbers"],
      use: "users phrase questions differently from the documents",
      like: ["Lexical search"],
    },
    {
      group: "search", subject: "Lexical search", tier: 2,
      says: ["matches documents by the words they contain", "excels at exact terms, codes and names", "fails when the query uses synonyms the document never mentions"],
      use: "queries contain error codes or product SKUs",
      like: ["Dense retrieval"],
    },
    {
      group: "search", subject: "Top-k retrieval", tier: 1,
      says: ["returns the k highest scoring chunks for a query", "uses a fixed k regardless of how relevant the results are", "controls how much context reaches the prompt"],
      not: ["only returns chunks that exceed a relevance threshold"],
      like: ["Similarity threshold"],
    },
    {
      group: "search", subject: "Similarity threshold", tier: 3,
      says: ["drops results whose score is below a cutoff", "can return zero chunks when nothing is relevant", "needs calibration because score scales differ between models"],
      use: "want the system to admit when nothing relevant was found",
      like: ["Top-k retrieval"],
    },
    {
      group: "search", subject: "Hybrid search", tier: 2,
      says: ["combines keyword search and vector search results", "covers both exact term matches and semantic matches", "needs a method such as score weighting or rank fusion to merge the lists"],
      use: "need both exact identifiers and paraphrase matching",
    },
    {
      group: "search", subject: "Approximate nearest neighbor search", tier: 3,
      says: ["trades a little recall for much faster vector lookup", "avoids comparing the query to every stored vector", "is what makes large vector indexes practical"],
      like: ["Exact nearest neighbor search"],
    },
    {
      group: "search", subject: "Exact nearest neighbor search", tier: 3,
      says: ["compares the query against every vector in the index", "always returns the true closest vectors", "becomes slow as the collection grows"],
      like: ["Approximate nearest neighbor search"],
    },
    {
      group: "search", subject: "HNSW index", tier: 4,
      says: ["organizes vectors in a layered graph of neighbors", "searches by greedily walking from coarse layers down to fine ones", "keeps the whole graph structure in memory for speed"],
      like: ["IVF index"],
    },
    {
      group: "search", subject: "IVF index", tier: 4,
      says: ["partitions vectors into clusters around centroids", "searches only the few clusters nearest the query", "loses matches that lie in clusters it did not probe"],
      like: ["HNSW index"],
    },
    {
      group: "search", subject: "Maximal marginal relevance", tier: 4,
      says: ["picks results that are relevant yet different from those already chosen", "uses a weight to balance relevance against diversity", "reduces near-duplicate passages in the context"],
      use: "the top results are ten rephrasings of the same paragraph",
    },
    {
      group: "search", subject: "Metadata filtering", tier: 2,
      says: ["restricts search to chunks whose attributes match conditions", "applies constraints such as tenant, date range or document type", "narrows the candidate set before or during the vector search"],
      use: "each customer may only see their own documents",
      not: ["changes how the embedding model encodes the query"],
    },
    {
      group: "search", subject: "Multi-vector retrieval", tier: 5,
      says: ["stores several vectors per document, such as one per section or generated question", "lets a small summary or question vector point back to a larger source passage", "increases index size in exchange for better matching"],
    },
    {
      group: "search", subject: "Namespace partitioning", tier: 4,
      says: ["separates vectors into isolated groups inside one index", "limits a query to one tenant's slice of the data", "avoids scanning other tenants' vectors"],
      use: "serving many customers from one vector database",
      like: ["Metadata filtering"],
    },

    // ---------- score ----------
    {
      group: "score", subject: "Cosine similarity", tier: 1,
      says: ["measures the angle between two vectors", "ignores vector length and compares direction only", "ranges from minus one to one"],
      like: ["Dot product", "Euclidean distance"],
    },
    {
      group: "score", subject: "Dot product", tier: 2,
      says: ["multiplies matching components and sums them", "equals cosine similarity when vectors are normalized to unit length", "grows with vector magnitude"],
      like: ["Cosine similarity"],
    },
    {
      group: "score", subject: "Euclidean distance", tier: 2,
      says: ["measures the straight-line distance between two points", "treats a smaller value as more similar", "is sensitive to differences in vector length"],
      like: ["Cosine similarity"],
    },
    {
      group: "score", subject: "BM25", tier: 2,
      says: ["ranks documents by weighted term frequency with length normalization", "gives rare query terms more weight than common ones", "saturates the benefit of repeating a term many times"],
      use: "want a strong lexical baseline without any neural model",
      like: ["TF-IDF"],
    },
    {
      group: "score", subject: "TF-IDF", tier: 2,
      says: ["multiplies how often a term appears in a document by how rare it is across the corpus", "downweights words that appear in nearly every document", "is the older relative of BM25 without term frequency saturation"],
      like: ["BM25"],
    },
    {
      group: "score", subject: "Reciprocal rank fusion", tier: 3,
      says: ["merges ranked lists by summing a function of each item's rank", "needs no calibration between score scales of different retrievers", "rewards items that appear high in several lists"],
      use: "need to merge BM25 and vector results whose scores are incomparable",
      like: ["Weighted score fusion"],
    },
    {
      group: "score", subject: "Weighted score fusion", tier: 3,
      says: ["combines normalized scores from each retriever with tunable weights", "requires scores to be put on a comparable scale first", "lets you lean the blend toward keyword or semantic results"],
      like: ["Reciprocal rank fusion"],
    },
    {
      group: "score", subject: "Score normalization", tier: 4,
      says: ["rescales scores from different retrievers onto a common range", "is a prerequisite before adding raw scores from different systems", "can be done with min-max or z-score scaling"],
    },
    {
      group: "score", subject: "Late interaction", tier: 5,
      says: ["keeps one vector per token and scores by matching query tokens to document tokens", "sits between single-vector bi-encoders and full cross-encoders in cost", "stores far more vectors per document than single-vector embeddings"],
      like: ["Bi-encoder"],
    },

    // ---------- query ----------
    {
      group: "query", subject: "Query rewriting", tier: 2,
      says: ["rephrases a user's question into a form that retrieves better", "may fix typos, expand abbreviations or remove chatty filler", "is usually done by a language model before search"],
      use: "users type vague or abbreviated questions",
    },
    {
      group: "query", subject: "HyDE", tier: 4,
      says: ["asks a model to write a hypothetical answer and embeds that instead of the question", "stands for hypothetical document embeddings", "relies on an answer-shaped text being closer to real passages than a question is"],
      use: "short questions retrieve poorly compared with answer-like text",
      not: ["retrieves a real document and skips the embedding step"],
    },
    {
      group: "query", subject: "Multi-query retrieval", tier: 3,
      says: ["generates several variants of the question and searches with each", "merges and deduplicates the results from all variants", "improves recall for ambiguous or underspecified questions"],
      use: "one phrasing of the question may miss relevant passages",
    },
    {
      group: "query", subject: "Step-back prompting", tier: 4,
      says: ["asks a broader, more general question to fetch background context", "retrieves for the general principle in addition to the specific question", "helps when the detail question is too narrow to match anything"],
    },
    {
      group: "query", subject: "Query decomposition", tier: 3,
      says: ["splits a complex question into simpler sub-questions", "retrieves evidence for each sub-question separately", "suits questions that need several facts combined"],
      use: "a question compares two products across several attributes",
      like: ["Multi-query retrieval"],
    },
    {
      group: "query", subject: "Conversational query condensing", tier: 3,
      says: ["rewrites a follow-up into a standalone question using chat history", "turns \"what about its price?\" into a question that names the product", "is needed because retrieval does not see earlier turns"],
      use: "follow-up questions contain pronouns referring to earlier turns",
    },
    {
      group: "query", subject: "Query routing", tier: 3,
      says: ["chooses which index, tool or data source should handle a question", "can send some questions to retrieval and others straight to the model", "is often decided by a classifier or a language model"],
      use: "have separate indexes for HR, legal and engineering content",
    },
    {
      group: "query", subject: "Query expansion", tier: 2,
      says: ["adds synonyms or related terms to the search query", "raises recall at the risk of pulling in noise", "is a long-standing technique in keyword search"],
      like: ["Query rewriting"],
    },
    {
      group: "query", subject: "Text-to-filter extraction", tier: 4,
      says: ["turns phrases such as \"in 2022\" into structured metadata conditions", "combines semantic search with exact attribute constraints", "depends on a metadata schema the model is told about"],
      use: "users ask for documents by author, date or category in natural language",
    },

    // ---------- post ----------
    {
      group: "post", subject: "Reranking", tier: 2,
      says: ["rescores a retrieved candidate list with a more accurate model", "usually runs on a few dozen candidates rather than the whole corpus", "improves which chunks end up in the final top positions"],
      use: "the right passage is retrieved but ranked too low",
      like: ["Cross-encoder reranker"],
    },
    {
      group: "post", subject: "Cross-encoder reranker", tier: 3,
      says: ["scores each query and candidate pair jointly", "adds latency proportional to the number of candidates", "is commonly applied after a fast first-stage retriever"],
      like: ["Reranking"],
    },
    {
      group: "post", subject: "Over-fetch then trim", tier: 3,
      says: ["retrieves many candidates first and keeps only the best few after reranking", "separates a recall-oriented first stage from a precision-oriented second stage", "typically fetches a larger k than the final context needs"],
    },
    {
      group: "post", subject: "Context compression", tier: 4,
      says: ["shortens retrieved passages to the parts relevant to the question", "fits more useful evidence into a limited prompt", "can be done by extracting sentences or summarizing with a model"],
      use: "retrieved chunks are long and mostly irrelevant to the question",
    },
    {
      group: "post", subject: "Lost-in-the-middle reordering", tier: 4,
      says: ["places the strongest passages at the start and end of the context", "responds to models attending less to material in the middle of a long prompt", "changes only the order of chunks, not their content"],
    },
    {
      group: "post", subject: "Context deduplication", tier: 3,
      says: ["removes overlapping or repeated chunks before building the prompt", "saves tokens that would be spent on the same sentences twice", "matters most when chunk overlap is large"],
      like: ["Deduplication"],
    },
    {
      group: "post", subject: "Neighbor chunk expansion", tier: 4,
      says: ["adds the chunks before and after a hit to give surrounding context", "recovers detail lost to a chunk boundary", "grows the prompt in exchange for completeness"],
      use: "a matching sentence is useless without the paragraph around it",
    },
    {
      group: "post", subject: "Relevance filtering", tier: 3,
      says: ["discards retrieved chunks judged irrelevant before generation", "can use a score cutoff or a model that grades each chunk", "reduces noise that could distract the generator"],
      like: ["Similarity threshold"],
    },
    {
      group: "post", subject: "Source attribution tagging", tier: 3,
      says: ["labels each chunk with an identifier before it enters the prompt", "lets the model refer to sources by those labels", "makes mapping an answer back to documents possible"],
    },

    // ---------- gen ----------
    {
      group: "gen", subject: "Context assembly", tier: 2,
      says: ["arranges retrieved chunks and instructions into the final prompt", "must stay inside the model's context window", "decides ordering, separators and labels for each passage"],
    },
    {
      group: "gen", subject: "Grounding", tier: 1,
      says: ["ties the answer to the retrieved text rather than the model's memory", "is usually encouraged by instructing the model to answer only from the context", "reduces but does not eliminate unsupported claims"],
      not: ["guarantees the model can never state something unsupported"],
    },
    {
      group: "gen", subject: "Citations", tier: 1,
      says: ["point from claims in an answer to the source passages", "let users verify the answer", "work best when sources are labeled in the prompt"],
      use: "users need to check where each claim came from",
    },
    {
      group: "gen", subject: "Abstention", tier: 3,
      says: ["has the system say it does not know when context lacks the answer", "is encouraged with an explicit instruction and a refusal option in the prompt", "counters the pull to answer from background knowledge"],
      use: "wrong answers are worse than no answer",
    },
    {
      group: "gen", subject: "Faithfulness instruction", tier: 2,
      says: ["tells the model to use only the provided context", "usually appears in the system prompt of a RAG application", "works as a strong nudge, not a hard guarantee"],
      like: ["Grounding"],
    },
    {
      group: "gen", subject: "Quote extraction", tier: 4,
      says: ["asks the model to copy the exact supporting sentences before answering", "makes unsupported claims easier to spot", "can be checked mechanically by string matching against the sources"],
    },
    {
      group: "gen", subject: "Structured answer format", tier: 3,
      says: ["has the model return an answer field and a list of source ids", "makes citations machine-checkable", "is enforced by schema-constrained output where available"],
      use: "downstream code must verify that cited sources exist",
    },
    {
      group: "gen", subject: "Context budget", tier: 3,
      says: ["is the number of tokens allotted to retrieved text in the prompt", "must leave room for the question, instructions and the reply", "forces a choice between more chunks and longer chunks"],
    },
    {
      group: "gen", subject: "Answer verification pass", tier: 4,
      says: ["checks each claim in a draft answer against the retrieved context", "can trigger a regeneration or a removal of unsupported sentences", "adds an extra model call and latency"],
    },
    {
      group: "gen", subject: "Delimiting retrieved text", tier: 3,
      says: ["wraps passages in clear markers so they are distinct from instructions", "lowers the chance retrieved text is read as a command", "is a mitigation rather than a complete defense against prompt injection"],
      like: ["Context assembly"],
    },

    // ---------- eval ----------
    {
      group: "eval", subject: "Recall at k", tier: 2,
      says: ["is the fraction of relevant documents that appear in the top k results", "falls when a needed passage is missing from the retrieved set", "tells you nothing about the order within the top k"],
      like: ["Precision at k"],
    },
    {
      group: "eval", subject: "Precision at k", tier: 2,
      says: ["is the fraction of the top k results that are relevant", "falls when retrieval returns many irrelevant chunks", "ignores relevant documents ranked below k"],
      like: ["Recall at k"],
    },
    {
      group: "eval", subject: "Hit rate", tier: 3,
      says: ["is the share of queries where at least one relevant document is in the top k", "gives a query full credit for a single relevant hit", "is simpler than recall because it ignores how many relevant documents exist"],
      like: ["Recall at k"],
    },
    {
      group: "eval", subject: "Mean reciprocal rank", tier: 3,
      says: ["averages the inverse rank of the first relevant result across queries", "rewards putting a relevant result at the very top", "ignores relevant results beyond the first one"],
    },
    {
      group: "eval", subject: "nDCG", tier: 4,
      says: ["scores a ranking with graded relevance and a discount for lower positions", "is normalized by the best possible ordering to land between zero and one", "values highly relevant documents more than marginal ones"],
    },
    {
      group: "eval", subject: "Faithfulness", tier: 2,
      says: ["measures whether every claim in the answer is supported by the retrieved context", "is lowered by hallucinated details", "can be correct for an answer that is faithful but irrelevant"],
      like: ["Answer relevance"],
    },
    {
      group: "eval", subject: "Answer relevance", tier: 2,
      says: ["measures whether the answer actually addresses the question asked", "penalizes answers that are off-topic or incomplete", "can be high for an answer that is not grounded in the sources"],
      like: ["Faithfulness"],
    },
    {
      group: "eval", subject: "Context precision", tier: 3,
      says: ["checks whether the retrieved chunks are mostly relevant and ranked high", "drops when noisy chunks crowd the context", "evaluates the retriever rather than the generator"],
      like: ["Context recall"],
    },
    {
      group: "eval", subject: "Context recall", tier: 3,
      says: ["checks whether the retrieved context contains the information needed for the reference answer", "drops when a required fact was never retrieved", "needs a ground-truth answer or labeled passages to compute"],
      like: ["Context precision"],
    },
    {
      group: "eval", subject: "Golden dataset", tier: 2,
      says: ["is a set of questions paired with expected answers or relevant passages", "lets you compare pipeline changes on the same footing", "should reflect real user questions rather than only easy ones"],
      use: "need to know whether a chunking change actually helped",
    },
    {
      group: "eval", subject: "Synthetic question generation", tier: 3,
      says: ["uses a model to write test questions from the corpus", "bootstraps an evaluation set before real traffic exists", "tends to produce questions that are easier than real ones"],
    },
    {
      group: "eval", subject: "LLM-as-judge", tier: 3,
      says: ["uses a language model to grade answers against criteria", "scales evaluation beyond what humans can label", "needs spot checks against human judgments because judges have biases"],
    },
    {
      group: "eval", subject: "End-to-end evaluation", tier: 3,
      says: ["scores the final answer produced by the whole pipeline", "cannot show by itself whether retrieval or generation caused a failure", "should be paired with separate retrieval metrics"],
      like: ["Component-level evaluation"],
    },
    {
      group: "eval", subject: "Component-level evaluation", tier: 4,
      says: ["scores retrieval and generation separately", "pinpoints which stage is responsible for a bad answer", "uses labeled relevant passages to test the retriever alone"],
      like: ["End-to-end evaluation"],
    },

    // ---------- fail ----------
    {
      group: "fail", subject: "Retrieval miss", tier: 1,
      says: ["happens when the needed passage never reaches the model", "leaves the generator to guess or refuse", "is diagnosed by checking recall before blaming the model"],
      like: ["Boundary split"],
    },
    {
      group: "fail", subject: "Boundary split", tier: 2,
      says: ["occurs when a chunk cut separates a fact from its qualifier or subject", "produces chunks that are retrievable but misleading", "is reduced with overlap or structure-aware chunking"],
      like: ["Retrieval miss"],
    },
    {
      group: "fail", subject: "Vocabulary mismatch", tier: 2,
      says: ["occurs when the query and the document use different words for the same idea", "hurts lexical search far more than semantic search", "is a main reason to add embeddings or query expansion"],
    },
    {
      group: "fail", subject: "Stale index", tier: 2,
      says: ["serves answers based on documents that have since changed or been removed", "grows when updates are not propagated to the vector store", "is fixed with scheduled or event-driven reindexing"],
    },
    {
      group: "fail", subject: "Hallucination despite context", tier: 3,
      says: ["is when the answer adds claims that the retrieved text does not support", "can happen even when the right passage was retrieved", "is measured by faithfulness checks"],
      not: ["only occurs when retrieval returns nothing"],
    },
    {
      group: "fail", subject: "Lost in the middle", tier: 4,
      says: ["is the tendency of models to use information in the middle of a long context less reliably", "can make a correct but centrally placed chunk be ignored", "motivates putting the best chunks at the edges"],
    },
    {
      group: "fail", subject: "Context poisoning", tier: 4,
      says: ["happens when a retrieved document contains instructions that hijack the model", "makes untrusted documents a prompt-injection channel", "calls for treating retrieved text as data and limiting what the model can do with it"],
    },
    {
      group: "fail", subject: "Distractor chunks", tier: 3,
      says: ["are retrieved passages that look relevant but contain the wrong answer", "can pull the generator toward an incorrect statement", "are reduced by reranking and relevance filtering"],
    },
    {
      group: "fail", subject: "Conflicting sources", tier: 4,
      says: ["arise when retrieved passages disagree, such as an old and a new policy", "need dates or authority metadata to choose between them", "can cause the model to blend contradictory statements"],
    },
    {
      group: "fail", subject: "Permission leakage", tier: 4,
      says: ["happens when retrieval returns documents the user is not allowed to see", "is prevented by enforcing access control in the retrieval query", "cannot be fixed by asking the model not to reveal the text"],
    },
    {
      group: "fail", subject: "Over-retrieval", tier: 3,
      says: ["stuffs too many chunks into the prompt", "dilutes useful evidence with noise and raises cost", "is addressed by lowering k, reranking or compressing"],
    },

    // ---------- adv ----------
    {
      group: "adv", subject: "Parent-child retrieval", tier: 3,
      says: ["matches on small child chunks but returns the larger parent passage", "combines precise matching with richer context for the generator", "stores a link from each child to its parent"],
      use: "small chunks match well but are too short to answer from",
    },
    {
      group: "adv", subject: "Sentence-window retrieval", tier: 4,
      says: ["embeds single sentences and expands each hit to a window of neighbors", "keeps the embedded unit small and the context large", "swaps the sentence for its surrounding window before generation"],
      like: ["Parent-child retrieval"],
    },
    {
      group: "adv", subject: "GraphRAG", tier: 4,
      says: ["builds a graph of entities and relationships extracted from the corpus", "can answer questions that span many documents through connected facts", "adds substantial extraction cost at indexing time"],
      use: "questions ask how entities across many documents relate",
    },
    {
      group: "adv", subject: "Agentic RAG", tier: 4,
      says: ["lets an agent decide when and what to retrieve, possibly over several steps", "can call multiple tools or indexes and revise its queries", "trades predictability and latency for flexibility"],
      use: "a question needs iterative searching across different sources",
    },
    {
      group: "adv", subject: "Corrective RAG", tier: 5,
      says: ["grades retrieved documents and takes a fallback action when they look poor", "may trigger a new search or a web lookup when quality is low", "adds an evaluation step between retrieval and generation"],
    },
    {
      group: "adv", subject: "Self-RAG", tier: 5,
      says: ["trains a model to decide when to retrieve and to critique its own output", "emits reflection signals about relevance and support", "needs a model trained for that behavior rather than only prompting"],
    },
    {
      group: "adv", subject: "Hierarchical summary indexing", tier: 5,
      says: ["clusters chunks and summarizes each cluster into higher-level nodes", "lets retrieval pick up either detailed leaves or broad summaries", "suits questions about a whole document rather than a single fact"],
      use: "questions ask for themes across a long document",
    },
    {
      group: "adv", subject: "Multi-hop retrieval", tier: 4,
      says: ["uses the result of one retrieval to form the next query", "chains evidence across documents to answer a layered question", "fails if the first hop returns the wrong entity"],
      like: ["Query decomposition"],
    },
    {
      group: "adv", subject: "Knowledge graph retrieval", tier: 4,
      says: ["follows explicit edges between entities to collect related facts", "complements vector search with relationship traversal", "requires extracting entities and relations before querying"],
      like: ["GraphRAG"],
    },
    {
      group: "adv", subject: "Text-to-SQL retrieval", tier: 4,
      says: ["translates a question into a database query instead of searching text", "returns exact structured values such as counts and totals", "needs the table schema supplied to the model"],
      use: "the answer is a number held in a relational table",
    },
    {
      group: "adv", subject: "Multimodal RAG", tier: 5,
      says: ["retrieves images, charts or tables as well as text", "may embed images directly or index generated captions", "needs a generator able to read the retrieved visuals"],
    },

    // ---------- ops ----------
    {
      group: "ops", subject: "Embedding cache", tier: 2,
      says: ["stores vectors keyed by a hash of the text", "avoids paying to embed the same chunk twice", "is keyed together with the model version so stale vectors are not reused"],
    },
    {
      group: "ops", subject: "Semantic cache", tier: 3,
      says: ["reuses a stored answer for a new question whose embedding is close to an old one", "saves a model call for repeated questions", "risks returning a wrong answer if the similarity cutoff is too loose"],
      like: ["Exact-match cache"],
    },
    {
      group: "ops", subject: "Exact-match cache", tier: 2,
      says: ["returns a stored response only for an identical query string", "never confuses two different questions", "misses rephrasings of the same question"],
      like: ["Semantic cache"],
    },
    {
      group: "ops", subject: "Freshness", tier: 2,
      says: ["describes how current the indexed content is compared with its source", "depends on how often ingestion runs", "can be improved with change-triggered updates instead of nightly jobs"],
      like: ["Stale index"],
    },
    {
      group: "ops", subject: "Access control filtering", tier: 3,
      says: ["attaches permission metadata to chunks and filters at query time", "keeps one user from retrieving another's documents", "must be enforced in the retrieval layer, not left to the prompt"],
    },
    {
      group: "ops", subject: "Observability", tier: 3,
      says: ["records the query, retrieved chunks, prompt and answer for each request", "makes it possible to see whether a bad answer came from retrieval or generation", "supports building evaluation sets from real traffic"],
      use: "need to debug why one particular answer was wrong",
    },
    {
      group: "ops", subject: "Latency budget", tier: 3,
      says: ["splits the allowed response time across embedding, search, reranking and generation", "pushes you to rerank fewer candidates when time is tight", "is dominated by the generation step in many pipelines"],
    },
    {
      group: "ops", subject: "Index versioning", tier: 4,
      says: ["tags each index with its embedding model and chunking configuration", "lets you build a new index beside the old one and switch over", "supports rollback if the new configuration performs worse"],
      use: "are migrating to a new embedding model without downtime",
    },
    {
      group: "ops", subject: "Deletion propagation", tier: 4,
      says: ["removes a deleted source document's chunks from the vector index", "requires tracking which chunks came from which document", "matters for compliance when content must stop being retrievable"],
    },
    {
      group: "ops", subject: "Streaming responses", tier: 2,
      says: ["send generated tokens to the user as they are produced", "improve perceived latency without changing total generation time", "are applied after retrieval has already finished"],
    },
    {
      group: "ops", subject: "Feedback loop", tier: 3,
      says: ["collects user ratings or corrections on answers", "feeds failed queries back into the evaluation set", "helps find gaps in the knowledge base"],
    },
  ],
  qa: [
    {
      q: "Which of these is the correct order of a basic RAG pipeline at query time?",
      right: "Embed the query, retrieve top chunks, build the prompt with them, generate the answer",
      wrong: ["Generate the answer, embed it, retrieve chunks, edit the answer", "Chunk the documents, embed the query, generate, then retrieve", "Fine-tune the model on the chunks, then generate the answer"],
      tier: 1, why: "At query time the question is embedded and used to retrieve context that is placed in the prompt before generation.",
    },
    {
      q: "A user asks about part number XK-7741 and a pure vector search returns unrelated passages. What is the most likely fix?",
      right: "Add keyword (BM25) search alongside the vectors in a hybrid setup",
      wrong: ["Increase the embedding dimensionality", "Lower the temperature of the generator", "Reduce the chunk overlap to zero"],
      tier: 2, why: "Exact identifiers are matched reliably by lexical search, which embeddings often blur.",
    },
    {
      q: "What does this code compute?",
      code: "import numpy as np\n\ndef f(a, b):\n    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))",
      right: "Cosine similarity between vectors a and b",
      wrong: ["Euclidean distance between a and b", "The dot product of a and b normalized by the sum of their lengths", "The Jaccard overlap of the two vectors' non-zero entries"],
      tier: 2, why: "Dividing the dot product by both norms gives the cosine of the angle between the vectors.",
    },
    {
      q: "For unit-length vectors, which statement is true?",
      right: "Cosine similarity and dot product give the same ranking",
      wrong: ["Dot product ranks in the opposite order from cosine similarity", "Euclidean distance gives a different ranking from cosine similarity", "Dot product always returns exactly 1"],
      tier: 3, why: "When norms are 1, the denominator in cosine similarity is 1, and Euclidean distance is also monotonic in the dot product.",
    },
    {
      q: "What is the result of this reciprocal rank fusion with k = 60 for document D that is ranked 1st in list A and 2nd in list B?",
      code: "score = 1/(60 + 1) + 1/(60 + 2)",
      right: "About 0.0325",
      wrong: ["About 0.0167", "About 3.0", "About 0.5"],
      tier: 4, why: "1/61 is about 0.01639 and 1/62 is about 0.01613; their sum is about 0.0325.",
    },
    {
      q: "What does this splitter configuration do?",
      code: "from langchain_text_splitters import RecursiveCharacterTextSplitter\n\nsplitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)\nchunks = splitter.split_text(text)",
      right: "Splits text into pieces of up to 800 characters, with about 100 characters repeated between neighbors",
      wrong: ["Splits text into exactly 800 chunks of 100 characters each", "Keeps only the first 800 characters and discards 100", "Splits into 800-token chunks and removes 100 duplicate chunks"],
      tier: 2, why: "chunk_size is a maximum length in characters by default and chunk_overlap is how much neighbors share.",
    },
    {
      q: "A chunk size of 100 with an overlap of 20 is used on a long document with a step of chunk_size minus overlap. About how many chunks does a 1,000-unit document produce?",
      right: "About 12",
      wrong: ["10", "50", "20"],
      tier: 3, why: "The step is 80, so a 1,000-unit document needs about (1000 - 20) / 80, roughly 12 chunks.",
    },
    {
      q: "Retrieval recall at 5 is 0.95 but answers are often wrong and contain unsupported details. Which area should you investigate first?",
      right: "Generation: the prompt, grounding instructions and faithfulness of the model's answer",
      wrong: ["Raising k so more chunks are retrieved", "Re-embedding the corpus with a larger vector size", "Removing the metadata filters"],
      tier: 3, why: "High recall means the evidence is being retrieved, so the problem is in how the generator uses it.",
    },
    {
      q: "What is the purpose of the following prompt line?",
      code: "Answer using only the context below. If the context does not contain the answer, reply \"I don't know.\"\n\nContext:\n{context}\n\nQuestion: {question}",
      right: "To ground the answer in the retrieved text and give the model a way to abstain",
      wrong: ["To force the model to return a fixed number of tokens", "To make the retriever fetch more documents", "To switch off the model's ability to follow instructions"],
      tier: 1, why: "Restricting the source and giving an explicit refusal path reduces answers from background memory.",
    },
    {
      q: "Which pairing correctly matches a metric to what it checks?",
      right: "Faithfulness: are the answer's claims supported by the retrieved context",
      wrong: ["Faithfulness: is the first relevant document at rank one", "Answer relevance: is every claim backed by the sources", "Context recall: does the answer sound fluent"],
      tier: 2, why: "Faithfulness is about support from the context; answer relevance is about addressing the question.",
    },
    {
      q: "A system's mean reciprocal rank is 0.5 on a set of queries where each has exactly one relevant document. What does this suggest?",
      right: "The relevant document is typically around rank 2",
      wrong: ["Half of the queries returned nothing at all", "The model answered half of the questions correctly", "The relevant document is typically at rank 5"],
      tier: 3, why: "A reciprocal rank of 0.5 corresponds to rank 2 (1/2).",
    },
    {
      q: "Compute recall at 3: the relevant set is {A, B, C, D} and the top 3 results are [A, X, C].",
      right: "0.5",
      wrong: ["0.67", "0.75", "1.0"],
      tier: 2, why: "Two of the four relevant documents (A and C) are in the top 3, so recall is 2/4.",
    },
    {
      q: "Compute precision at 4: the top 4 results are [A, X, C, Y] and A and C are relevant.",
      right: "0.5",
      wrong: ["0.25", "1.0", "2.0"],
      tier: 2, why: "Two of the four returned results are relevant.",
    },
    {
      q: "Why does this snippet usually give worse results than expected for a question-answer system?",
      code: "doc_vecs = model_a.encode(chunks)\nindex.add(doc_vecs)\n\nq_vec = model_b.encode(question)\nhits = index.search(q_vec, 5)",
      right: "The query and documents were embedded with different models, so their vectors are not comparable",
      wrong: ["The number of results requested is too small", "Encoding questions always requires a cross-encoder", "The index should be searched before it is populated"],
      tier: 3, why: "Vectors from different models live in unrelated spaces, so similarity scores are meaningless.",
    },
    {
      q: "You changed the embedding model but kept the existing vectors for old documents and embedded only new ones with the new model. What is the likely effect?",
      right: "Similarity scores between queries and old documents become unreliable, so a full reindex is needed",
      wrong: ["Nothing, because embeddings are interchangeable between models", "Only the latency changes", "Old documents will always rank first"],
      tier: 4, why: "Mixed model versions in one index produce incomparable vector spaces.",
    },
    {
      q: "Which retrieval call matches the intent \"top 4 chunks, only from the 2023 handbook\"?",
      code: "A) retriever.search(query, k=4, filter={\"source\": \"handbook\", \"year\": 2023})\nB) retriever.search(query, k=2023, filter=None)\nC) retriever.search(\"handbook\", k=4)\nD) retriever.search(query, threshold=4)",
      right: "A",
      wrong: ["B", "C", "D"],
      tier: 2, why: "A pairs a top-k of 4 with a metadata filter for source and year.",
    },
    {
      q: "A question needs a fact that appears in a sentence like \"It expires after 30 days\" in a chunk that never names the product. What best helps retrieval?",
      right: "Prepend the document title and section heading to each chunk before embedding",
      wrong: ["Remove all headings during ingestion", "Increase the temperature of the generator", "Switch from cosine similarity to Euclidean distance"],
      tier: 3, why: "Contextual headers restore the missing subject to the chunk's embedding.",
    },
    {
      q: "In parent-child retrieval, what is returned to the generator?",
      right: "The larger parent passage of the best matching child chunk",
      wrong: ["Only the single best matching sentence", "A summary of all child chunks in the index", "The child chunk's embedding vector"],
      tier: 3, why: "Children are used to match precisely, and the parent supplies richer context.",
    },
    {
      q: "Which description of HyDE is correct?",
      right: "A model writes a hypothetical answer and its embedding is used to search for real documents",
      wrong: ["Real documents are rewritten as hypothetical questions at ingestion time only", "The query is hashed and looked up in a table", "The generator's answer is cached and returned without retrieval"],
      tier: 4, why: "HyDE embeds a generated pseudo-answer because it tends to lie closer to real answer passages than the question does.",
    },
    {
      q: "What is the main reason to add a reranker after the first-stage retriever?",
      right: "To rescore a small candidate set with a more accurate but slower model",
      wrong: ["To make the vector index smaller", "To replace the generator", "To avoid needing any embeddings at all"],
      tier: 2, why: "Cross-encoders are accurate but too slow for whole-corpus search, so they rerank a short list.",
    },
    {
      q: "A reranker scoring 200 candidates makes responses too slow. Which change reduces latency most directly?",
      right: "Rerank only the top 30 or so candidates from the first stage",
      wrong: ["Raise the chunk overlap", "Embed the documents again with a bigger model", "Remove the system prompt"],
      tier: 3, why: "Reranking cost grows with the number of candidate pairs, so cutting candidates cuts latency.",
    },
    {
      q: "Which chunk order best addresses the lost-in-the-middle effect for five ranked chunks (1 = best)?",
      right: "1, 3, 5, 4, 2 so the strongest sit at the start and end",
      wrong: ["5, 4, 3, 2, 1 so the strongest is last only", "3, 1, 2, 4, 5 so the best is in the middle", "1, 2, 3, 4, 5 with no change possible"],
      tier: 4, why: "Putting the most relevant passages at the edges avoids the weakest-attended middle region.",
    },
    {
      q: "A semantic cache is returning the answer to \"How do I reset my password?\" for \"How do I reset my email?\". What is the likely cause?",
      right: "The similarity cutoff for a cache hit is too loose",
      wrong: ["The embedding dimensionality is too high", "The generator's temperature is zero", "The index uses HNSW"],
      tier: 4, why: "Different questions can be close in embedding space; a tighter threshold avoids false hits.",
    },
    {
      q: "Which fix is correct for users seeing documents they are not authorized to read?",
      right: "Apply a permission filter in the retrieval query so unauthorized chunks are never returned",
      wrong: ["Add a prompt line asking the model not to reveal restricted content", "Increase k so authorized content dominates", "Embed the user's role into the answer"],
      tier: 3, why: "Access control must be enforced where data is fetched; the model can be tricked into repeating what it sees.",
    },
    {
      q: "What does this metadata filter express?",
      code: "filter = {\n  \"$and\": [\n    {\"department\": {\"$eq\": \"legal\"}},\n    {\"year\": {\"$gte\": 2022}}\n  ]\n}",
      right: "Only chunks from the legal department dated 2022 or later",
      wrong: ["Chunks from legal or from 2022, whichever matches first", "Chunks from any department except legal before 2022", "Only chunks whose year equals the string \"gte\""],
      tier: 3, why: "$and requires both conditions: department equals legal and year at least 2022.",
    },
    {
      q: "Which statement about approximate nearest neighbor search is correct?",
      right: "It can miss the true nearest vector in exchange for much faster search",
      wrong: ["It always returns the exact nearest vectors but stores them compressed", "It only works for sparse vectors", "It requires a cross-encoder to run"],
      tier: 3, why: "ANN indexes trade a small loss in recall for speed.",
    },
    {
      q: "You measure that the correct chunk is in the top 20 for 98% of questions but only in the top 3 for 60%. Which stage will most likely help?",
      right: "A reranking step over the top 20 candidates",
      wrong: ["A larger generator context window", "A smaller embedding dimension", "Removing the system prompt"],
      tier: 3, why: "The retriever finds the right chunk but ranks it too low, which reranking addresses.",
    },
    {
      q: "Which approach best handles a follow-up like \"and how long does it last?\" in a chat-based RAG system?",
      right: "Rewrite it into a standalone question using the conversation history before retrieval",
      wrong: ["Embed it as is, since embeddings understand pronouns from earlier turns", "Increase the chunk overlap", "Lower the similarity threshold to zero"],
      tier: 3, why: "The retriever sees only the query text, so the pronoun's referent must be written into it.",
    },
    {
      q: "What does this code do?",
      code: "seen = set()\nunique = []\nfor c in chunks:\n    h = hash(c.text.strip().lower())\n    if h not in seen:\n        seen.add(h)\n        unique.append(c)",
      right: "Removes chunks whose normalized text is identical to an earlier one",
      wrong: ["Sorts chunks by similarity to the query", "Splits each chunk into smaller pieces", "Embeds each chunk and keeps the closest to the query"],
      tier: 2, why: "A hash of normalized text identifies exact duplicates.",
    },
    {
      q: "Which of these is a mistake in the following ingestion code for an index that must support deleting a document?",
      code: "for i, text in enumerate(chunks):\n    store.add(id=str(i), vector=embed(text), metadata={\"text\": text})",
      right: "Chunks do not record the source document, so a document's chunks cannot be located for deletion",
      wrong: ["The ids should be floating-point numbers", "Metadata must never contain the text", "The embeddings must be created after storing"],
      tier: 4, why: "Without a source document id in metadata, deletion propagation cannot find the right chunks.",
    },
    {
      q: "A team chunks at 2000 tokens, but the embedding model accepts only 512 tokens. What is the likely outcome?",
      right: "The input is truncated or rejected, so most of each chunk is not represented in its vector",
      wrong: ["The model automatically averages four embeddings with no loss", "Retrieval improves because chunks are larger", "The vectors become sparse"],
      tier: 3, why: "Text beyond the model's input limit does not contribute to the embedding.",
    },
    {
      q: "Which mitigation best reduces the risk of prompt injection through retrieved documents?",
      right: "Treat retrieved text as untrusted data, delimit it, and limit what actions the model may take",
      wrong: ["Trust documents from the vector store because they were embedded", "Increase k so injected text is outvoted", "Lower the temperature to zero"],
      tier: 4, why: "Retrieved text can contain instructions; isolating it and restricting capabilities reduces harm.",
    },
    {
      q: "Compute the storage for 1,000,000 vectors of 768 dimensions as 32-bit floats (ignoring index overhead).",
      right: "About 3 GB",
      wrong: ["About 768 MB", "About 30 GB", "About 300 MB"],
      tier: 3, why: "1,000,000 x 768 x 4 bytes = 3,072,000,000 bytes, roughly 3 GB.",
    },
    {
      q: "Which question is best answered by GraphRAG rather than plain top-k vector retrieval?",
      right: "What are the main themes and how do the key people relate across the whole corpus?",
      wrong: ["What is the phone number on page 3 of the manual?", "What does error code E12 mean?", "Who wrote the file named intro.txt?"],
      tier: 4, why: "Corpus-wide synthesis over entity relationships is the case graph-based indexing targets.",
    },
    {
      q: "In an agentic RAG loop, what does the agent do that a fixed pipeline does not?",
      right: "Decide whether to search again with a new query after inspecting the first results",
      wrong: ["Skip embedding queries entirely", "Guarantee exactly one retrieval per question", "Train the embedding model at every step"],
      tier: 4, why: "An agent can iterate and choose tools, unlike a fixed retrieve-then-generate sequence.",
    },
    {
      q: "A scraped help site produces many chunks that all start with the same navigation text. Which step fixes this most directly?",
      right: "Remove boilerplate during ingestion before chunking",
      wrong: ["Raise the similarity threshold at query time only", "Use a larger generator", "Switch from cosine similarity to dot product"],
      tier: 2, why: "Repeated furniture should be stripped at ingestion so it does not dominate embeddings.",
    },
    {
      q: "Which is the best way to find out whether a new chunking strategy improved your system?",
      right: "Run the same golden question set before and after and compare retrieval and answer metrics",
      wrong: ["Ask a colleague whether the chunks look nicer", "Compare index sizes only", "Check that no errors appear in the logs"],
      tier: 2, why: "A fixed evaluation set allows a fair before-and-after comparison.",
    },
    {
      q: "In this pseudo-code, what is the bug?",
      code: "def answer(q):\n    chunks = retriever.search(q, k=5)\n    prompt = f\"Question: {q}\"\n    return llm(prompt)",
      right: "The retrieved chunks are never added to the prompt, so generation ignores them",
      wrong: ["k should always be set to 1", "The question must be sent after the model call", "The retriever must be called twice"],
      tier: 1, why: "Retrieved context has to be placed in the prompt for the model to use it.",
    },
    {
      q: "What does a score threshold of 0.8 on cosine similarity do if no chunk scores above 0.8?",
      right: "Returns no chunks, letting the system answer that nothing relevant was found",
      wrong: ["Returns the single highest chunk anyway", "Raises the threshold automatically", "Falls back to returning all chunks"],
      tier: 3, why: "A threshold removes results below the cutoff, which can leave an empty set.",
    },
    {
      q: "Why is a hybrid search that adds raw BM25 scores to raw cosine scores problematic?",
      right: "The two scores are on different scales, so one side can dominate unless they are normalized or rank-fused",
      wrong: ["BM25 scores are always negative", "Cosine scores can never be compared to anything", "Vector search never returns scores"],
      tier: 4, why: "Unscaled scores are not comparable; normalization or reciprocal rank fusion avoids the issue.",
    },
    {
      q: "Which pipeline change requires reindexing the entire corpus?",
      right: "Switching to a different embedding model",
      wrong: ["Changing the generator's temperature", "Changing k from 4 to 6", "Editing the answer prompt template"],
      tier: 2, why: "Existing vectors would not be comparable with queries from a different model.",
    },
    {
      q: "A document is deleted at the source but its content keeps appearing in answers. What is the most likely gap?",
      right: "Deletions are not propagated to the vector index",
      wrong: ["The reranker is too accurate", "The embedding dimensionality is too small", "The generator's context window is too large"],
      tier: 3, why: "Without deletion handling, stale chunks remain retrievable.",
    },
  ],
  calc: [],
};
export default spec;
