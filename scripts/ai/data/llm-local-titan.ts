import type { TrackSpec } from "../types";

const spec: TrackSpec = {
  slug: "llm-local-titan",
  name: "Local LLMs: Novice to Titan",
  description:
    "Running language models on your own hardware: runtimes, GGUF and safetensors, quantization, memory and VRAM sizing, GPU offload, Modelfiles, local servers, licences and privacy.",
  roles: "developer,manager",
  groups: {
    tool: "local LLM tool",
    fmt: "model file format",
    quant: "quantization concept",
    mem: "memory concept",
    hw: "hardware concept",
    serve: "serving concept",
    cmd: "command-line command",
    mf: "Modelfile instruction",
    setting: "runtime setting",
    dep: "local deployment concept",
  },
  cards: [
    // ---------------- tools ----------------
    {
      group: "tool", subject: "Ollama", tier: 1,
      says: [
        "runs as a background service with a local REST API and a simple command-line interface",
        "pulls models from its registry with a single pull command",
        "uses Modelfiles to package a model with its parameters and prompt template",
      ],
      use: "want the quickest command-line way to download and chat with a local model",
      not: ["is a cloud service that processes prompts on remote servers"],
      like: ["LM Studio", "llama.cpp"],
    },
    {
      group: "tool", subject: "llama.cpp", tier: 1,
      says: [
        "is a C/C++ inference engine that runs quantized models efficiently on ordinary CPUs and many GPUs",
        "is where the GGUF format originated",
        "ships command-line programs for chatting, serving and quantizing models",
      ],
      use: "want a lightweight, dependency-free engine you can build and tune yourself",
      not: ["requires an NVIDIA GPU to run at all"],
      like: ["Ollama", "LM Studio"],
    },
    {
      group: "tool", subject: "LM Studio", tier: 1,
      says: [
        "is a desktop application with a graphical interface for browsing, downloading and chatting with local models",
        "can start a local server that speaks an OpenAI-compatible API",
      ],
      use: "prefer a point-and-click app to discover and try models without a terminal",
      not: ["is a command-line-only tool with no graphical interface"],
      like: ["Ollama", "llama.cpp"],
    },
    {
      group: "tool", subject: "vLLM", tier: 3,
      says: [
        "is a serving engine built for high throughput on GPUs",
        "uses PagedAttention to manage the KV cache in small blocks",
        "uses continuous batching to serve many concurrent requests",
      ],
      use: "need to serve many simultaneous users from GPU servers with high aggregate throughput",
      not: ["is a desktop chat app for beginners with a model browser"],
      like: ["Text Generation Inference"],
    },
    {
      group: "tool", subject: "Text Generation Inference", tier: 3,
      says: [
        "is a Hugging Face server for deploying text-generation models",
        "supports token streaming and request batching",
        "is commonly run as a prebuilt container image",
      ],
      use: "want a Hugging Face-maintained serving container for models from the Hub",
      not: ["is an Apple-only framework for machine learning arrays"],
      like: ["vLLM"],
    },
    {
      group: "tool", subject: "llamafile", tier: 3,
      says: [
        "bundles model weights and a llama.cpp-based runtime into one executable file",
        "lets you share a model that runs by simply executing the file",
      ],
      use: "want to hand someone a single file that runs a model with no installation",
      not: ["streams the weights from a remote server each time it starts"],
      like: ["llama.cpp"],
    },
    {
      group: "tool", subject: "MLX", tier: 4,
      says: [
        "is an array framework designed for Apple silicon",
        "takes advantage of unified memory shared by the CPU and GPU",
      ],
      use: "run and fine-tune models natively on a Mac with Apple silicon",
      not: ["is designed only for NVIDIA GPUs"],
      like: ["llama.cpp"],
    },
    {
      group: "tool", subject: "the Transformers library", tier: 2,
      says: [
        "is a Python library for loading and running models from the Hugging Face Hub",
        "loads safetensors weights through classes such as AutoModelForCausalLM",
        "runs models at full or reduced precision rather than in the GGUF-only llama.cpp engine",
      ],
      use: "want to load a model's original weights in Python for research or fine-tuning",
      not: ["can only read GGUF files"],
      like: ["llama.cpp"],
    },
    {
      group: "tool", subject: "Hugging Face Hub", tier: 1,
      says: [
        "hosts model repositories where weights, tokenizers and model cards are published",
        "is the usual place to download open weights from",
      ],
      use: "need to find and download open model weights and read their model cards",
      not: ["is an inference runtime that executes models on your GPU"],
      like: ["Ollama"],
    },
    {
      group: "tool", subject: "a local chat front end", tier: 3,
      says: [
        "provides a browser interface that connects to a model server you run yourself",
        "works with any backend that exposes a compatible API endpoint",
      ],
      use: "want a web chat interface in front of a model server on your own network",
      not: ["contains its own copy of the model weights by necessity"],
      like: ["LM Studio"],
    },

    // ---------------- formats ----------------
    {
      group: "fmt", subject: "GGUF", tier: 1,
      says: [
        "is a single-file format for models run by llama.cpp",
        "stores the tensors together with metadata such as the tokenizer and architecture details",
        "is designed so a file can be memory-mapped and loaded quickly",
      ],
      use: "need a self-contained quantized model file for llama.cpp, Ollama or LM Studio",
      not: ["can hold only unquantized 32-bit weights"],
      like: ["GGML"],
    },
    {
      group: "fmt", subject: "GGML", tier: 4,
      says: [
        "is the older tensor library and file format that preceded GGUF in llama.cpp",
        "lacked the extensible metadata that GGUF adds",
      ],
      use: "meet an old model file that modern llama.cpp builds no longer load",
      not: ["is the current recommended format for new llama.cpp models"],
      like: ["GGUF"],
    },
    {
      group: "fmt", subject: "Safetensors", tier: 2,
      says: [
        "stores tensors in a simple format that cannot run code when loaded",
        "supports loading tensors lazily without reading the whole file",
        "is the usual format for original full-precision weights on the Hugging Face Hub",
      ],
      use: "want a weights file format that is safe to load from an untrusted source",
      not: ["relies on Python pickle to serialize tensors"],
      like: ["PyTorch pickle checkpoint"],
    },
    {
      group: "fmt", subject: "PyTorch pickle checkpoint", tier: 3,
      says: [
        "is a weights file saved with Python's pickle serialization",
        "can execute arbitrary code if an untrusted file is loaded carelessly",
      ],
      use: "need to warn about a security risk when loading old .bin or .pt weight files from unknown authors",
      not: ["is guaranteed safe to load because it only contains numbers"],
      like: ["Safetensors"],
    },
    {
      group: "fmt", subject: "ONNX", tier: 4,
      says: [
        "is an open interchange format that describes a model as a computation graph",
        "can be run by ONNX Runtime on many kinds of hardware",
      ],
      use: "need to move a model between frameworks using a framework-neutral graph format",
      not: ["is the file format native to llama.cpp"],
      like: ["GGUF"],
    },
    {
      group: "fmt", subject: "a model card", tier: 1,
      says: [
        "is the documentation page describing a model's intended use, training information and licence",
        "is the first place to check for prompt format and known limitations",
      ],
      use: "want to learn a model's licence, limitations and recommended prompt format before using it",
      not: ["is the file that holds the model's weights"],
      like: ["Hugging Face Hub"],
    },
    {
      group: "fmt", subject: "a sharded weight set", tier: 3,
      says: [
        "splits a large model's weights across several numbered files",
        "is described by an index file that maps each tensor to its shard",
      ],
      use: "see a large model repository with several numbered weight files and an index",
      not: ["means the model is several independent models run in sequence"],
      like: ["Safetensors"],
    },
    {
      group: "fmt", subject: "a LoRA adapter file", tier: 3,
      says: [
        "stores small low-rank weight updates to apply on top of a specific base model",
        "is only meaningful together with the base model it was trained for",
      ],
      use: "want a small file that changes a base model's behaviour without redistributing the full weights",
      not: ["contains a complete standalone model that can run by itself"],
      like: ["a sharded weight set"],
    },
    {
      group: "fmt", subject: "the tokenizer file set", tier: 2,
      says: [
        "defines the vocabulary and splitting rules the model was trained with",
        "must match the model, or the text will be encoded into the wrong token IDs",
      ],
      use: "load a model's original weights and need the vocabulary and splitting rules that go with them",
      not: ["can be swapped for any other model's tokenizer with no effect"],
      like: ["a model card"],
    },

    // ---------------- quantization ----------------
    {
      group: "quant", subject: "Quantization", tier: 1,
      says: [
        "stores weights with fewer bits per value to shrink the model",
        "reduces the memory needed and usually speeds up generation on memory-bound hardware",
        "trades some accuracy for a smaller footprint",
      ],
      use: "need a model that fits in less memory than its original weights",
      not: ["increases the number of parameters in the model"],
      like: ["Post-training quantization"],
    },
    {
      group: "quant", subject: "FP16", tier: 2,
      says: [
        "stores each weight in 16 bits using a floating-point format with a narrow exponent range",
        "needs about two bytes per parameter",
      ],
      use: "need the half-precision baseline to compare quantized sizes against",
      not: ["has the same exponent range as 32-bit floating point"],
      like: ["BF16"],
    },
    {
      group: "quant", subject: "BF16", tier: 3,
      says: [
        "is a 16-bit format that keeps the wide exponent range of 32-bit floats",
        "has fewer fraction bits than FP16, so it is less precise per value",
      ],
      use: "want a 16-bit format that avoids overflow problems by keeping a wide exponent range",
      not: ["uses 8 bits per value"],
      like: ["FP16"],
    },
    {
      group: "quant", subject: "Q8_0", tier: 2,
      says: [
        "stores weights using about 8 bits each in blocks with a scale",
        "usually gives output very close to the full-precision model",
        "needs roughly half the memory of a 16-bit model",
      ],
      use: "want a quantization that stays very close to full quality and can afford about a byte per weight",
      not: ["shrinks the model to about a quarter of its 16-bit size"],
      like: ["Q4_K_M"],
    },
    {
      group: "quant", subject: "Q4_K_M", tier: 2,
      says: [
        "stores weights at about 4 bits each using the k-quant block scheme",
        "is a popular middle ground between file size and quality",
        "uses a mix of precisions where the M stands for the medium variant",
      ],
      use: "want a common 4-bit choice that balances size and quality",
      not: ["stores every weight at exactly 8 bits"],
      like: ["Q8_0", "Q2_K"],
    },
    {
      group: "quant", subject: "Q2_K", tier: 3,
      says: [
        "is an aggressive quantization using about 2 bits per weight on average",
        "gives the smallest files in the family but a clearly noticeable drop in quality",
      ],
      use: "have extremely tight memory and accept a visible quality loss",
      not: ["is virtually indistinguishable from the original weights"],
      like: ["Q4_K_M"],
    },
    {
      group: "quant", subject: "Bits per weight", tier: 2,
      says: [
        "is the average storage cost of a weight after quantization, including block scales",
        "directly sets the file size when multiplied by the parameter count",
      ],
      use: "need a single number to compare how compact different quantizations are",
      not: ["is always exactly the number in the name, with no overhead"],
      like: ["Quantization"],
    },
    {
      group: "quant", subject: "Post-training quantization", tier: 3,
      says: [
        "quantizes an already trained model without training it again from scratch",
        "is how most downloadable quantized models are produced",
      ],
      use: "want to compress an already trained model without a new training run",
      not: ["requires pretraining the model again from random weights"],
      like: ["Quantization-aware training"],
    },
    {
      group: "quant", subject: "Quantization-aware training", tier: 5,
      says: [
        "simulates low-precision arithmetic during training so the model learns to tolerate it",
        "can recover more quality at low bit widths than quantizing afterwards",
      ],
      use: "can afford extra training to get the best quality at very low bit widths",
      not: ["is applied only after the model has been released and cannot involve training"],
      like: ["Post-training quantization"],
    },
    {
      group: "quant", subject: "the K-quant family", tier: 4,
      says: [
        "is a set of llama.cpp quantization types that use blocks and super-blocks of weights",
        "spends more bits on more sensitive tensors in its mixed variants",
      ],
      use: "ask about the family of llama.cpp quant types with names like Q4_K_S and Q5_K_M",
      not: ["is a format that stores weights as text"],
      like: ["Q4_K_M"],
    },
    {
      group: "quant", subject: "an importance matrix", tier: 5,
      says: [
        "uses calibration text to estimate which weights matter most to the model's outputs",
        "guides quantization so important weights keep more precision",
      ],
      use: "want better quality at low bit widths by weighting quantization with calibration data",
      not: ["is a table of the most frequently used vocabulary tokens"],
      like: ["Post-training quantization"],
    },
    {
      group: "quant", subject: "GPTQ", tier: 4,
      says: [
        "is a post-training method that quantizes weights layer by layer using calibration data",
        "is typically used to produce low-bit models for GPU inference",
      ],
      use: "ask about a calibration-based post-training method commonly used for GPU-served low-bit models",
      not: ["is the file format used by llama.cpp"],
      like: ["AWQ"],
    },
    {
      group: "quant", subject: "AWQ", tier: 4,
      says: [
        "stands for activation-aware weight quantization",
        "protects the weights that matter most according to activation statistics",
      ],
      use: "ask about a weight-only quantization method that uses activation statistics to protect important weights",
      not: ["quantizes the training data instead of the weights"],
      like: ["GPTQ"],
    },
    {
      group: "quant", subject: "Quality loss from quantization", tier: 3,
      says: [
        "generally grows as the bit width falls, and rises steeply below roughly 4 bits",
        "tends to be smaller for larger models than for small ones at the same bit width",
        "can be measured by comparing perplexity with the unquantized model",
      ],
      use: "want to judge how much a quantized model has degraded compared with the original",
      not: ["is identical for every quantization method at the same size"],
      like: ["Quantization"],
    },
    {
      group: "quant", subject: "Weight-only quantization", tier: 4,
      says: [
        "stores weights at low precision while activations stay at higher precision",
        "reduces memory and bandwidth for weights without changing the compute format of activations",
      ],
      use: "ask about quantizing only the stored parameters while computing with higher-precision values",
      not: ["quantizes the user's prompt text before tokenization"],
      like: ["GPTQ", "AWQ"],
    },

    // ---------------- memory ----------------
    {
      group: "mem", subject: "VRAM", tier: 1,
      says: [
        "is the memory on a graphics card",
        "must hold the model weights, KV cache and buffers for the model to run fully on the GPU",
        "is often the main limit on the size of model you can run quickly",
      ],
      use: "ask what limits the model size you can run entirely on the graphics card",
      not: ["is the same memory pool as system storage on disk"],
      like: ["System RAM"],
    },
    {
      group: "mem", subject: "System RAM", tier: 1,
      says: [
        "is the main memory attached to the CPU",
        "holds model layers that are not offloaded to the GPU",
        "is usually larger but has lower bandwidth than GPU memory",
      ],
      use: "have no suitable GPU or a model that does not fit in VRAM and need the CPU side to hold part of it",
      not: ["is built into the graphics card"],
      like: ["VRAM"],
    },
    {
      group: "mem", subject: "Unified memory", tier: 3,
      says: [
        "lets the CPU and GPU share one pool of memory",
        "is how Apple silicon Macs can give the GPU access to most of the machine's memory",
      ],
      use: "ask why a Mac with plenty of memory can load models larger than a typical discrete GPU's VRAM",
      not: ["is a feature that merges disk space with VRAM automatically"],
      like: ["VRAM", "System RAM"],
    },
    {
      group: "mem", subject: "Memory for weights", tier: 2,
      says: [
        "is approximately parameter count times bits per weight divided by eight",
        "is the largest fixed part of the memory a model needs",
      ],
      use: "estimate the minimum memory a model of a given size and quantization needs",
      not: ["grows with the number of tokens in the conversation"],
      like: ["KV cache memory"],
    },
    {
      group: "mem", subject: "KV cache memory", tier: 3,
      says: [
        "grows in proportion to the number of tokens held in context",
        "is multiplied by the number of concurrent sequences",
        "is separate from the memory used by the model's weights",
      ],
      use: "ask why memory use climbs during a long conversation even though the weights are fixed",
      not: ["is fixed at the size of the weights regardless of context length"],
      like: ["Memory for weights", "Context length memory"],
    },
    {
      group: "mem", subject: "Context length memory", tier: 3,
      says: [
        "means that raising the configured context size reserves more KV cache memory",
        "can cause an out-of-memory failure even when the weights fit comfortably",
      ],
      use: "raise a runtime's context size setting and then see the model fail to load",
      not: ["is unaffected by how many tokens of context you configure"],
      like: ["KV cache memory"],
    },
    {
      group: "mem", subject: "Quantized KV cache", tier: 5,
      says: [
        "stores cached keys and values at lower precision to reduce context memory",
        "can slightly reduce output quality, especially at very low bit widths",
      ],
      use: "need to fit a longer context into limited memory by compressing the cache rather than the weights",
      not: ["shrinks the model weights file on disk"],
      like: ["KV cache memory"],
    },
    {
      group: "mem", subject: "Memory bandwidth", tier: 3,
      says: [
        "is how fast data can be moved between memory and the processor",
        "often sets the ceiling on token generation speed because each token reads the weights",
      ],
      use: "ask why a faster memory system can speed up generation more than extra compute cores",
      not: ["has no effect on generation speed once the model fits in memory"],
      like: ["VRAM"],
    },
    {
      group: "mem", subject: "an out-of-memory error", tier: 2,
      says: [
        "occurs when weights, cache and buffers together exceed the available memory",
        "can be fixed by a smaller quantization, a smaller context size or offloading fewer layers",
      ],
      use: "see a model fail to load or crash partway through a long prompt with an allocation failure",
      not: ["is fixed by raising the temperature"],
      like: ["Context length memory"],
    },
    {
      group: "mem", subject: "a compute buffer", tier: 4,
      says: [
        "is scratch memory allocated for intermediate calculations during inference",
        "adds overhead on top of the weights and the KV cache",
      ],
      use: "ask why a model whose weights barely fit still runs out of memory",
      not: ["is stored permanently inside the GGUF file"],
      like: ["KV cache memory"],
    },
    {
      group: "mem", subject: "Memory mapping", tier: 4,
      says: [
        "lets the operating system load a model file's pages into memory lazily as they are used",
        "lets several processes share the same cached file pages",
      ],
      use: "ask how a large model file can start quickly without being copied into allocated memory first",
      not: ["forces the entire file to be copied into private memory before any token is generated"],
      like: ["System RAM"],
    },
    {
      group: "mem", subject: "Swapping to disk", tier: 3,
      says: [
        "moves memory pages to storage when RAM runs out",
        "slows generation dramatically because storage is far slower than memory",
      ],
      use: "see generation crawl to a fraction of its normal speed after memory fills up",
      not: ["has no noticeable effect on speed because storage is as fast as RAM"],
      like: ["an out-of-memory error"],
    },
    {
      group: "mem", subject: "Parameter count in a model name", tier: 1,
      says: [
        "gives the number of weights, such as 7B for seven billion",
        "is a rough guide to the size of the model before quantization",
      ],
      use: "read the size label in a model name to estimate how large the model is",
      not: ["tells you the context length in tokens"],
      like: ["Memory for weights"],
    },

    // ---------------- hardware ----------------
    {
      group: "hw", subject: "GPU offload", tier: 1,
      says: [
        "moves some or all model layers from CPU memory onto the GPU for faster computation",
        "is controlled in llama.cpp by how many layers you choose to place on the GPU",
      ],
      use: "want to speed up generation by running transformer layers on the graphics card",
      not: ["changes the model's weights or its answers"],
      like: ["Partial offload"],
    },
    {
      group: "hw", subject: "Partial offload", tier: 3,
      says: [
        "places only some layers on the GPU and keeps the rest on the CPU",
        "lets a model larger than VRAM run, at lower speed than full offload",
      ],
      use: "have a model that does not completely fit in VRAM but want to use the GPU as far as it goes",
      not: ["runs at the same speed as keeping every layer on the GPU"],
      like: ["GPU offload"],
    },
    {
      group: "hw", subject: "CPU inference", tier: 1,
      says: [
        "runs the model entirely on the processor using system RAM",
        "works on machines without a supported GPU but is usually slower for large models",
      ],
      use: "have no supported GPU and still want to run a small quantized model",
      not: ["is impossible for quantized models"],
      like: ["GPU offload"],
    },
    {
      group: "hw", subject: "CUDA", tier: 2,
      says: [
        "is NVIDIA's platform for running general computation on its GPUs",
        "is the backend used to accelerate local inference on NVIDIA cards",
      ],
      use: "accelerate a runtime on an NVIDIA graphics card",
      not: ["is the standard backend for Apple GPUs"],
      like: ["Metal", "ROCm"],
    },
    {
      group: "hw", subject: "Metal", tier: 2,
      says: [
        "is Apple's graphics and compute API used to run inference on Apple GPUs",
        "is the usual GPU backend for local models on Macs",
      ],
      use: "accelerate a runtime on the GPU of an Apple silicon Mac",
      not: ["is the backend for NVIDIA graphics cards"],
      like: ["CUDA", "ROCm"],
    },
    {
      group: "hw", subject: "ROCm", tier: 4,
      says: [
        "is AMD's software platform for GPU computing",
        "provides a route to accelerate inference on supported AMD graphics cards",
      ],
      use: "accelerate a runtime on a supported AMD graphics card",
      not: ["is Apple's compute API for Macs"],
      like: ["CUDA", "Metal"],
    },
    {
      group: "hw", subject: "Vulkan", tier: 4,
      says: [
        "is a cross-vendor graphics and compute API that some runtimes use as a GPU backend",
        "can accelerate inference on GPUs that lack a vendor-specific compute stack",
      ],
      use: "want a GPU backend that works across hardware vendors on systems without a vendor compute stack",
      not: ["works only on NVIDIA hardware"],
      like: ["CUDA"],
    },
    {
      group: "hw", subject: "SIMD vectorization", tier: 4,
      says: [
        "processes several numbers per instruction on a CPU, such as with AVX2 or NEON",
        "is a major reason well-built CPU inference can be fast enough to use",
      ],
      use: "ask why one CPU build of an inference engine runs much faster than a generic one",
      not: ["is a type of GPU memory"],
      like: ["CPU inference"],
    },
    {
      group: "hw", subject: "Thread count", tier: 3,
      says: [
        "sets how many CPU threads the engine uses for computation",
        "usually works best near the number of physical cores rather than far above it",
      ],
      use: "tune CPU-side performance when part of a model runs on the processor",
      not: ["sets how many users can chat at the same time"],
      like: ["CPU inference"],
    },
    {
      group: "hw", subject: "Multi-GPU splitting", tier: 4,
      says: [
        "divides a model's layers or tensors across several GPUs",
        "lets a model that exceeds one card's VRAM use the combined memory of several cards",
      ],
      use: "have several graphics cards and a model too large for any one of them",
      not: ["lets VRAM from separate cards become a single seamless chip"],
      like: ["Partial offload"],
    },
    {
      group: "hw", subject: "Prompt processing speed", tier: 3,
      says: [
        "measures how fast the engine reads the prompt before generating",
        "is usually much higher in tokens per second than generation speed because it is parallel",
      ],
      use: "ask why a long prompt is read quickly but the reply appears more slowly",
      not: ["is limited by memory bandwidth in the same way as generation"],
      like: ["Generation speed"],
    },
    {
      group: "hw", subject: "Generation speed", tier: 2,
      says: [
        "is measured in tokens per second while the model produces its reply",
        "falls as layers are moved from the GPU back to the CPU",
      ],
      use: "measure how fast text appears while the model is writing its reply",
      not: ["is the speed at which the engine reads the prompt in parallel"],
      like: ["Prompt processing speed"],
    },

    // ---------------- serving ----------------
    {
      group: "serve", subject: "an OpenAI-compatible endpoint", tier: 2,
      says: [
        "accepts requests in the same JSON shape as the OpenAI chat completions API",
        "lets existing client libraries talk to a local model by changing the base URL",
        "is offered by Ollama, llama.cpp's server, LM Studio and vLLM",
      ],
      use: "want to point existing OpenAI SDK code at a model running on your own machine",
      not: ["means the model itself was made by OpenAI"],
      like: ["Base URL"],
    },
    {
      group: "serve", subject: "Base URL", tier: 2,
      says: [
        "is the address prefix the client uses for every API request",
        "must be changed from the default to the local server's address to use a local model",
      ],
      use: "need to redirect an SDK's requests from a cloud service to your local server",
      not: ["selects which model weights are loaded"],
      like: ["an OpenAI-compatible endpoint"],
    },
    {
      group: "serve", subject: "the placeholder API key", tier: 3,
      says: [
        "is a dummy value some client libraries require even when the local server ignores it",
        "does not authenticate you when the local server has no key checking",
      ],
      use: "see an SDK refuse to start without a key when talking to a local server",
      not: ["must be a paid credential to unlock the local model"],
      like: ["Base URL"],
    },
    {
      group: "serve", subject: "the model name field", tier: 2,
      says: [
        "selects which of the server's available models handles the request",
        "must match a name the server knows, such as one listed by the server",
      ],
      use: "send a request and need to say which local model should answer",
      not: ["is ignored by every local server"],
      like: ["Base URL"],
    },
    {
      group: "serve", subject: "Response streaming", tier: 2,
      says: [
        "returns tokens incrementally as server-sent events instead of one final body",
        "is requested in chat completions with a stream flag",
      ],
      use: "want to show a local model's reply as it is generated",
      not: ["makes the server compute all tokens in parallel"],
      like: ["Batching"],
    },
    {
      group: "serve", subject: "Batching", tier: 3,
      says: [
        "processes several requests together on the hardware",
        "raises total tokens per second across users while possibly slowing a single request",
      ],
      use: "serve several users from one GPU and want higher aggregate throughput",
      not: ["always makes each single request finish sooner"],
      like: ["Continuous batching", "a parallel slot"],
    },
    {
      group: "serve", subject: "Continuous batching", tier: 4,
      says: [
        "admits new requests into a running batch as others finish",
        "avoids idle capacity from waiting for the slowest sequence in a batch",
      ],
      use: "serve requests whose output lengths vary a lot without wasting GPU capacity",
      not: ["waits for a full batch of equal-length requests before starting"],
      like: ["Batching"],
    },
    {
      group: "serve", subject: "PagedAttention", tier: 5,
      says: [
        "stores the KV cache in fixed-size blocks that need not be contiguous",
        "reduces memory fragmentation and waste when serving many sequences",
      ],
      use: "ask how a serving engine fits more concurrent sequences in the same GPU memory",
      not: ["quantizes the model weights to 4 bits"],
      like: ["vLLM"],
    },
    {
      group: "serve", subject: "a parallel slot", tier: 4,
      says: [
        "lets one server instance handle a conversation among several at once",
        "takes a share of the configured context size in llama.cpp's server",
      ],
      use: "tune how many simultaneous conversations a llama.cpp server can hold",
      not: ["loads its own separate copy of the weights"],
      like: ["Batching", "the context size flag"],
    },
    {
      group: "serve", subject: "Prompt caching", tier: 3,
      says: [
        "reuses computed state for a prompt prefix that repeats across requests",
        "saves prompt processing time when conversations share a long start",
      ],
      use: "send many requests that share a long system prompt or document at the beginning",
      not: ["returns a stored reply whenever the same question appears"],
      like: ["KV cache memory"],
    },
    {
      group: "serve", subject: "Keeping a model loaded", tier: 3,
      says: [
        "avoids paying the load time again on every request",
        "costs memory continuously until the server unloads the model",
      ],
      use: "want the next request to start immediately without reloading the weights",
      not: ["makes the model use less memory while idle"],
      like: ["Prompt caching"],
    },
    {
      group: "serve", subject: "the embeddings endpoint", tier: 3,
      says: [
        "returns a vector for each input text from an embedding model",
        "can be served locally by a runtime and called through an OpenAI-compatible client",
      ],
      use: "need to turn text into vectors for local semantic search without a cloud API",
      not: ["generates a chat reply from the input"],
      like: ["an OpenAI-compatible endpoint"],
    },
    {
      group: "serve", subject: "Tensor parallelism", tier: 5,
      says: [
        "splits individual layers' weight matrices across several GPUs that work on every token together",
        "needs fast links between GPUs because they exchange results at each layer",
      ],
      use: "serve a model too large for a single GPU with every card working on each token",
      not: ["assigns each GPU its own full copy of the model for different requests"],
      like: ["Multi-GPU splitting"],
    },
    {
      group: "serve", subject: "Speculative decoding", tier: 5,
      says: [
        "has a small draft model propose tokens that the main model verifies in one pass",
        "speeds up generation without changing what the main model would output",
      ],
      use: "want faster generation by pairing a large model with a small one that guesses ahead",
      not: ["skips the large model entirely for easy tokens"],
      like: ["Continuous batching"],
    },
    {
      group: "serve", subject: "a request concurrency limit", tier: 3,
      says: [
        "caps how many requests the server works on at the same time",
        "lets extra requests wait in a queue instead of exhausting memory",
      ],
      use: "need to stop many simultaneous callers from overloading a small local server",
      not: ["is unnecessary because local servers have unlimited capacity"],
      like: ["a parallel slot"],
    },

    // ---------------- commands ----------------
    {
      group: "cmd", subject: "ollama pull", tier: 1,
      says: [
        "downloads a model from the Ollama registry to local storage",
        "does not start a chat session by itself",
      ],
      use: "want to download a model now without opening a chat",
      not: ["uploads your local model to the registry"],
      like: ["ollama run"],
    },
    {
      group: "cmd", subject: "ollama run", tier: 1,
      says: [
        "starts an interactive chat with a model",
        "downloads the model first if it is not already present",
      ],
      use: "want a terminal chat with a model in one command",
      not: ["only lists models without loading any"],
      like: ["ollama pull"],
    },
    {
      group: "cmd", subject: "ollama list", tier: 1,
      says: [
        "shows the models stored locally",
        "is the command to check what is already downloaded",
      ],
      use: "need to see which models you have downloaded",
      not: ["shows only the models currently loaded in memory"],
      like: ["ollama ps"],
    },
    {
      group: "cmd", subject: "ollama ps", tier: 3,
      says: [
        "shows models currently loaded in memory",
        "reports how much of each loaded model is on the CPU versus the GPU",
      ],
      use: "want to check whether a loaded model is fully on the GPU or partly on the CPU",
      not: ["lists every model downloaded to disk"],
      like: ["ollama list"],
    },
    {
      group: "cmd", subject: "ollama create", tier: 3,
      says: [
        "builds a new named model from a Modelfile",
        "takes the Modelfile path through its -f option",
      ],
      use: "package a base model with your own system prompt and parameters under a new name",
      not: ["trains a new model from scratch on your documents"],
      like: ["ollama show"],
    },
    {
      group: "cmd", subject: "ollama show", tier: 3,
      says: [
        "prints details about a model such as its parameters and template",
        "can display the Modelfile for an existing model",
      ],
      use: "need to inspect the template and parameters of a model you already have",
      not: ["deletes the model from disk"],
      like: ["ollama create"],
    },
    {
      group: "cmd", subject: "ollama rm", tier: 2,
      says: [
        "removes a downloaded model from local storage",
        "frees the disk space the model files used",
      ],
      use: "want to free disk space by deleting a model you no longer use",
      not: ["unloads the model from memory only, leaving the files"],
      like: ["ollama ps"],
    },
    {
      group: "cmd", subject: "ollama serve", tier: 3,
      says: [
        "starts the Ollama server that exposes the local API",
        "is what the CLI talks to when it runs or lists models",
      ],
      use: "need to start the Ollama background server by hand",
      not: ["downloads every available model from the registry"],
      like: ["ollama run"],
    },
    {
      group: "cmd", subject: "llama-cli", tier: 2,
      says: [
        "is the llama.cpp program for running a model directly from the terminal",
        "loads a GGUF file given with the -m option",
      ],
      use: "want a direct terminal chat with a GGUF file without running a server",
      not: ["is the program that exposes an HTTP API"],
      like: ["llama-server"],
    },
    {
      group: "cmd", subject: "llama-server", tier: 3,
      says: [
        "is the llama.cpp program that serves an HTTP API with OpenAI-compatible endpoints",
        "also provides a built-in web interface",
      ],
      use: "need a lightweight HTTP server for a GGUF model from llama.cpp",
      not: ["is the program that converts model files between formats"],
      like: ["llama-cli"],
    },
    {
      group: "cmd", subject: "llama-quantize", tier: 4,
      says: [
        "is the llama.cpp tool that converts a GGUF file to a lower-bit quantization",
        "takes an input file, an output file and a quantization type",
      ],
      use: "need to produce a smaller quantized GGUF from a larger one",
      not: ["downloads models from the Hugging Face Hub"],
      like: ["convert_hf_to_gguf.py"],
    },
    {
      group: "cmd", subject: "convert_hf_to_gguf.py", tier: 4,
      says: [
        "is the llama.cpp script that converts Hugging Face model weights into a GGUF file",
        "is normally the first step before quantizing a downloaded original model",
      ],
      use: "have original Hugging Face weights and need them as a GGUF file",
      not: ["quantizes a GGUF file to 4 bits"],
      like: ["llama-quantize"],
    },

    // ---------------- Modelfile ----------------
    {
      group: "mf", subject: "FROM", tier: 2,
      says: [
        "sets the base model that a Modelfile builds on",
        "is the one instruction every Modelfile needs",
      ],
      use: "start a Modelfile by naming the model or GGUF file it builds on",
      not: ["sets the system prompt text"],
      like: ["ADAPTER"],
    },
    {
      group: "mf", subject: "PARAMETER", tier: 2,
      says: [
        "sets a default runtime option such as temperature or context size",
        "can be written several times in one Modelfile, once per option",
      ],
      use: "bake a default temperature or context length into a custom model",
      not: ["sets which base model is used"],
      like: ["SYSTEM"],
    },
    {
      group: "mf", subject: "SYSTEM", tier: 2,
      says: [
        "sets the system message that is sent with every conversation",
        "gives the model a persistent role or set of rules",
      ],
      use: "give a custom model a fixed persona or set of standing rules",
      not: ["selects the model weights file"],
      like: ["PARAMETER", "MESSAGE"],
    },
    {
      group: "mf", subject: "TEMPLATE", tier: 4,
      says: [
        "defines how system, user and assistant turns are formatted into the prompt",
        "must match the format the model was trained on",
      ],
      use: "import a raw GGUF model and need to tell the runtime how to format chat turns",
      not: ["limits how many tokens the reply may contain"],
      like: ["SYSTEM"],
    },
    {
      group: "mf", subject: "ADAPTER", tier: 4,
      says: [
        "applies a LoRA adapter on top of the base model",
        "requires an adapter trained for the same base model named in FROM",
      ],
      use: "layer a fine-tuned LoRA adapter on top of a base model in a Modelfile",
      not: ["replaces the base model completely with the adapter"],
      like: ["FROM"],
    },
    {
      group: "mf", subject: "MESSAGE", tier: 4,
      says: [
        "adds a preset message to the conversation history, such as an example turn",
        "can seed a model with example user and assistant exchanges",
      ],
      use: "seed a custom model with a sample exchange that shows the answer format",
      not: ["sets the maximum context length"],
      like: ["SYSTEM"],
    },
    {
      group: "mf", subject: "LICENSE", tier: 3,
      says: [
        "records the licence text that applies to the packaged model",
        "keeps licence terms with the model when it is shared",
      ],
      use: "keep a record of the licence terms inside the packaged model",
      not: ["activates a paid unlock for the model"],
      like: ["FROM"],
    },

    // ---------------- runtime settings ----------------
    {
      group: "setting", subject: "num_ctx", tier: 2,
      says: [
        "sets the context window size, in tokens, that Ollama allocates for a model",
        "increases the KV cache memory used when raised",
      ],
      use: "need a longer conversation to fit in an Ollama model",
      not: ["sets how many layers go to the GPU"],
      like: ["the context size flag"],
    },
    {
      group: "setting", subject: "the context size flag", tier: 3,
      says: [
        "is -c in llama.cpp and sets the context size in tokens",
        "determines how much KV cache memory the engine reserves",
      ],
      use: "set a llama.cpp program's context length from the command line",
      not: ["sets the number of CPU threads"],
      like: ["num_ctx"],
    },
    {
      group: "setting", subject: "the GPU layers flag", tier: 3,
      says: [
        "is -ngl in llama.cpp and sets how many layers are placed on the GPU",
        "can be raised until VRAM is nearly full to speed up generation",
      ],
      use: "decide how many transformer layers a llama.cpp program should run on the graphics card",
      not: ["sets the maximum number of tokens in the reply"],
      like: ["num_gpu"],
    },
    {
      group: "setting", subject: "num_gpu", tier: 4,
      says: [
        "is the Ollama option controlling how many layers are offloaded to the GPU",
        "can be lowered to leave GPU memory free for other applications",
      ],
      use: "manually control how many layers Ollama places on the GPU",
      not: ["sets the number of graphics cards that must be present"],
      like: ["the GPU layers flag"],
    },
    {
      group: "setting", subject: "the threads flag", tier: 3,
      says: [
        "is -t in llama.cpp and sets how many CPU threads to use",
        "matters most when layers run on the CPU",
      ],
      use: "tune CPU thread use for a llama.cpp program",
      not: ["sets the GPU layer count"],
      like: ["the GPU layers flag"],
    },
    {
      group: "setting", subject: "the model flag", tier: 1,
      says: [
        "is -m in llama.cpp programs and gives the path of the GGUF file to load",
        "is required to tell the program which model file to use",
      ],
      use: "tell a llama.cpp program which GGUF file to open",
      not: ["selects the CPU thread count"],
      like: ["the context size flag"],
    },
    {
      group: "setting", subject: "keep_alive", tier: 4,
      says: [
        "controls how long Ollama keeps a model loaded in memory after the last request",
        "can be set so a model unloads immediately or stays loaded for a long time",
      ],
      use: "decide how long Ollama should keep an idle model in memory",
      not: ["sets the lifetime of the downloaded files on disk"],
      like: ["num_ctx"],
    },
    {
      group: "setting", subject: "num_predict", tier: 3,
      says: [
        "caps the number of tokens the model will generate in a reply",
        "can stop a reply mid-sentence when set too low",
      ],
      use: "bound the length of generated replies in Ollama",
      not: ["sets the size of the context window"],
      like: ["num_ctx"],
    },
    {
      group: "setting", subject: "OLLAMA_HOST", tier: 4,
      says: [
        "is an environment variable that sets the address the server listens on",
        "must be changed before the server starts to make it reachable beyond the local machine",
      ],
      use: "make an Ollama server listen on a different address or interface",
      not: ["selects which model is loaded by default"],
      like: ["keep_alive"],
    },
    {
      group: "setting", subject: "Mlock", tier: 5,
      says: [
        "asks the operating system to keep model memory in RAM and not swap it out",
        "can fail or be limited by operating system memory-locking limits",
      ],
      use: "prevent the operating system from swapping model pages out to disk",
      not: ["encrypts the model file on disk"],
      like: ["Memory mapping"],
    },
    {
      group: "setting", subject: "Seed", tier: 3,
      says: [
        "fixes the random number stream used during sampling",
        "makes sampled output repeatable on the same setup with the same settings",
      ],
      use: "need the same sampled output when you rerun an identical request on one machine",
      not: ["selects which model version is loaded"],
      like: ["num_predict"],
    },

    // ---------------- deployment concepts ----------------
    {
      group: "dep", subject: "Data privacy of local inference", tier: 1,
      says: [
        "keeps prompts and documents on your own machine instead of sending them to a provider",
        "removes the need for a third party to process the sensitive text",
      ],
      use: "must process confidential text without sending it to an outside service",
      not: ["guarantees security even if the machine itself is compromised"],
      like: ["Offline operation"],
    },
    {
      group: "dep", subject: "Offline operation", tier: 1,
      says: [
        "lets a downloaded model run with no internet connection",
        "depends on having downloaded the weights beforehand",
      ],
      use: "need a model to work on a plane or inside an air-gapped network",
      not: ["requires a live connection to a hosting provider for every reply"],
      like: ["Data privacy of local inference"],
    },
    {
      group: "dep", subject: "an open-weights release", tier: 1,
      says: [
        "means a model's trained parameters are published for download",
        "does not necessarily include the training data or the training code",
      ],
      use: "ask what it means when a developer publishes the weights for download",
      not: ["always means the model is open source in the full sense"],
      like: ["a permissive licence", "a restrictive model licence"],
    },
    {
      group: "dep", subject: "a permissive licence", tier: 2,
      says: [
        "allows broad use, modification and commercial deployment with few conditions",
        "includes licences such as Apache 2.0 and MIT",
      ],
      use: "need a licence that allows commercial use with minimal conditions",
      not: ["forbids any commercial use"],
      like: ["a restrictive model licence"],
    },
    {
      group: "dep", subject: "a restrictive model licence", tier: 3,
      says: [
        "publishes the weights but adds custom conditions such as acceptable-use rules or user-count thresholds",
        "must be read carefully before shipping a product that uses the model",
      ],
      use: "see a model whose licence adds extra use conditions beyond ordinary open-source terms",
      not: ["is identical in every case to the MIT licence"],
      like: ["a permissive licence"],
    },
    {
      group: "dep", subject: "the base-versus-instruct choice", tier: 2,
      says: [
        "separates a base model that continues text from an instruct model that follows requests",
        "usually points chat applications to the instruct or chat variant",
      ],
      use: "choose between two variants of the same model when building a chat assistant",
      not: ["depends only on the size of the vocabulary"],
      like: ["an open-weights release"],
    },
    {
      group: "dep", subject: "Local retrieval-augmented generation", tier: 3,
      says: [
        "uses a local embedding model and vector store to find documents for a local language model",
        "lets private documents be searched and used without leaving the machine",
      ],
      use: "want to answer questions about private documents entirely on your own machine",
      not: ["requires uploading the documents to a cloud embedding service"],
      like: ["a local embedding"],
    },
    {
      group: "dep", subject: "a local embedding", tier: 3,
      says: [
        "is a vector produced by an embedding model running on your own hardware",
        "must come from the same embedding model for both documents and queries",
      ],
      use: "need to index private text for semantic search without a hosted embeddings API",
      not: ["can freely mix vectors from different embedding models in one index"],
      like: ["Local retrieval-augmented generation"],
    },
    {
      group: "dep", subject: "Fixed versus usage-based cost", tier: 3,
      says: [
        "contrasts buying hardware once with paying a provider for each use",
        "favours local hardware when usage is heavy and steady, and hosted services when usage is occasional",
      ],
      use: "compare running your own hardware against paying a provider for each request",
      not: ["is the same under all usage patterns, so a decision never depends on volume"],
      like: ["Data privacy of local inference"],
    },
    {
      group: "dep", subject: "Model capability gap", tier: 3,
      says: [
        "means smaller local models can be less capable than the largest hosted models on hard tasks",
        "narrows when a small model is fine-tuned for a specific narrow task",
      ],
      use: "weigh whether a small local model is good enough for a demanding task",
      not: ["is zero for every task and every model size"],
      like: ["Fixed versus usage-based cost"],
    },
    {
      group: "dep", subject: "Verifying downloads", tier: 3,
      says: [
        "means checking a file's checksum or source before running it",
        "reduces the risk of tampered or malicious model files",
      ],
      use: "want to confirm a downloaded model file is what the publisher released",
      not: ["is unnecessary for any file that ends in .gguf"],
      like: ["Safetensors"],
    },
    {
      group: "dep", subject: "Local network exposure", tier: 4,
      says: [
        "happens when a local server is bound to an address reachable by other machines",
        "can let others use your model or read its responses unless access is controlled",
      ],
      use: "worry that a model server started on your laptop is reachable from the rest of the network",
      not: ["cannot occur because local servers are always unreachable from other hosts"],
      like: ["Data privacy of local inference"],
    },
    {
      group: "dep", subject: "Fine-tuning a local model", tier: 4,
      says: [
        "adapts a model to a task or style using your own examples",
        "is often done with LoRA to fit within limited GPU memory",
      ],
      use: "want a local model to follow your company's response style using your own examples",
      not: ["is required before a model can run locally"],
      like: ["a LoRA adapter file"],
    },
    {
      group: "dep", subject: "Context limit of a model", tier: 2,
      says: [
        "is the maximum number of tokens the model was trained to handle at once",
        "should not be exceeded by the context size you configure, or quality can degrade",
      ],
      use: "need to know the longest input a given model can handle properly",
      not: ["can be raised freely by a runtime setting with no effect on quality"],
      like: ["num_ctx"],
    },
    {
      group: "dep", subject: "Structured output", tier: 4,
      says: [
        "can be enforced locally by restricting decoding to a grammar or JSON schema",
        "makes small local models produce valid machine-readable output more reliably",
      ],
      use: "need a small local model to always output valid JSON",
      not: ["is impossible without a hosted provider"],
      like: ["Local retrieval-augmented generation"],
    },
  ],
  qa: [
    { q: "A model has 7 billion parameters stored in 16-bit floating point. About how much memory do the weights alone need?", right: "About 14 GB", wrong: ["About 7 GB", "About 3.5 GB", "About 28 GB"], tier: 1, why: "Two bytes per parameter times seven billion parameters is about 14 GB." },
    { q: "The same 7-billion-parameter model is quantized to roughly 4 bits per weight. About how large are the weights?", right: "About 3.5 GB, plus some overhead for block scales", wrong: ["About 14 GB", "About 7 GB", "About 0.9 GB"], tier: 1, why: "4 bits is half a byte, so seven billion parameters take roughly 3.5 GB." },
    { q: "A 70-billion-parameter model is quantized to 8 bits per weight. Roughly how much memory do just the weights need?", right: "About 70 GB", wrong: ["About 35 GB", "About 140 GB", "About 560 GB"], tier: 2, why: "8 bits is one byte per parameter: 70 billion x 1 byte." },
    { q: "A GGUF file for an 8-billion-parameter model is 4.8 GB. About how many bits per weight does that imply?", right: "About 4.8 bits per weight", wrong: ["About 2.4 bits per weight", "About 8 bits per weight", "About 16 bits per weight"], tier: 3, why: "4.8 GB x 8 bits per byte divided by 8 billion parameters is 4.8 bits each." },
    { q: "You configure a longer context size and the same model, which loaded fine before, now fails with an out-of-memory error. What is the most likely reason?", right: "The larger context reserves more KV cache memory on top of the unchanged weights", wrong: ["Longer contexts make the weights file bigger", "The tokenizer grows with the context size", "Longer contexts disable GPU offload"], tier: 2, why: "KV cache size grows with the configured number of tokens." },
    { q: "A model has 32 layers, 8 KV heads, a head size of 128 and a 16-bit KV cache. About how much KV cache does an 8,192-token context need?", right: "About 1 GiB", wrong: ["About 128 MiB", "About 8 GiB", "About 16 MiB"], tier: 4, why: "Per token it is 2 x 32 x 8 x 128 x 2 bytes = 128 KiB; times 8,192 tokens is 1 GiB." },
    { q: "If the KV cache from the previous question were stored at 8 bits instead of 16, what would an 8,192-token context need?", right: "About 0.5 GiB", wrong: ["About 1 GiB", "About 2 GiB", "About 0.25 GiB"], tier: 4, why: "Halving the bytes per cached value halves the cache." },
    { q: "A model's quantized weights take 4 GB and each generated token reads all of them once. Memory bandwidth is 400 GB/s. What is the rough upper bound on generation speed?", right: "About 100 tokens per second", wrong: ["About 10 tokens per second", "About 1,600 tokens per second", "About 4 tokens per second"], tier: 4, why: "400 GB/s divided by 4 GB per token is 100 tokens per second, before other overheads." },
    { q: "Which command downloads a model into Ollama without starting a chat?", code: "# model name is a placeholder\n", right: "ollama pull my-model", wrong: ["ollama run my-model", "ollama create my-model", "ollama serve my-model"], tier: 1, why: "pull only downloads; run opens a chat; create builds from a Modelfile." },
    { q: "What does this command do?", code: "ollama run my-model", right: "Starts an interactive chat with my-model, downloading it first if needed", wrong: ["Deletes my-model from disk", "Lists the models stored locally", "Converts my-model to GGUF"], tier: 1, why: "ollama run opens an interactive session and pulls the model if it is missing." },
    { q: "You want to know whether a loaded Ollama model runs fully on the GPU. Which command shows this?", right: "ollama ps", wrong: ["ollama list", "ollama show", "ollama pull"], tier: 3, why: "ps lists loaded models and the share on CPU versus GPU." },
    { q: "What does this Modelfile produce when built?", code: "FROM my-base-model\nPARAMETER temperature 0.2\nSYSTEM You are a concise SQL assistant.", right: "A new model based on my-base-model with a low default temperature and a fixed system message", wrong: ["A new model trained from scratch on SQL data", "A model with its weights quantized to 2 bits", "A server that listens for SQL queries"], tier: 2, why: "A Modelfile wraps an existing model with defaults and instructions; it does not train anything." },
    { q: "Which command builds a model named sql-helper from a Modelfile in the current directory?", right: "ollama create sql-helper -f Modelfile", wrong: ["ollama run sql-helper --build Modelfile", "ollama pull sql-helper -f Modelfile", "ollama show sql-helper < Modelfile"], tier: 3, why: "ollama create takes the new name and the Modelfile path via -f." },
    { q: "Which Modelfile line sets the context window to 8,192 tokens?", right: "PARAMETER num_ctx 8192", wrong: ["SYSTEM num_ctx 8192", "FROM num_ctx 8192", "TEMPLATE num_ctx 8192"], tier: 3, why: "Runtime options such as num_ctx are set with PARAMETER." },
    { q: "Which llama.cpp command runs the GGUF file and puts 20 layers on the GPU?", right: "llama-cli -m model.gguf -ngl 20", wrong: ["llama-cli -m model.gguf -t 20", "llama-cli -m model.gguf -c 20", "llama-quantize model.gguf 20"], tier: 3, why: "-ngl sets the GPU layer count; -t is threads and -c is context size." },
    { q: "What does this command do?", code: "llama-server -m model.gguf -c 8192 --port 8080", right: "Serves the model over HTTP on port 8080 with an 8,192-token context", wrong: ["Quantizes model.gguf to 8,192 bits", "Converts the model to safetensors", "Starts a terminal chat and exits after 8,192 tokens"], tier: 3, why: "llama-server exposes an HTTP API; -c sets the context size." },
    { q: "You raised -ngl on a llama.cpp run until the program crashed with a GPU allocation error. What is the right adjustment?", right: "Lower -ngl, use a smaller quantization or reduce the context size", wrong: ["Raise the temperature", "Add more CPU threads with -t", "Convert the file from GGUF to pickle"], tier: 3, why: "GPU memory is exhausted; free it by offloading fewer layers or shrinking weights or cache." },
    { q: "What does this command do?", code: "llama-quantize model-f16.gguf model-q4_k_m.gguf Q4_K_M", right: "Writes a new GGUF file with the weights quantized to Q4_K_M", wrong: ["Downloads a Q4_K_M model from the Hub", "Converts the model to ONNX", "Loads the model and runs a chat session"], tier: 4, why: "llama-quantize takes an input, an output and a quantization type." },
    { q: "Which tool converts original Hugging Face weights into a GGUF file for llama.cpp?", right: "convert_hf_to_gguf.py", wrong: ["llama-server", "ollama ps", "llama-cli"], tier: 4, why: "The conversion script produces a GGUF that llama-quantize can then compress." },
    { q: "What does this Python code do?", code: "from openai import OpenAI\n\nclient = OpenAI(base_url=\"http://localhost:11434/v1\", api_key=\"local\")\nr = client.chat.completions.create(\n    model=\"my-model\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello\"}],\n)\nprint(r.choices[0].message.content)", right: "Sends a chat request to a local server through the OpenAI client and prints the reply", wrong: ["Sends the request to OpenAI's cloud because the SDK always uses it", "Downloads my-model from the Hub", "Starts an Ollama server in the background"], tier: 2, why: "Changing base_url redirects the SDK to a local compatible server." },
    { q: "In the code above, why is an api_key passed at all?", code: "client = OpenAI(base_url=\"http://localhost:11434/v1\", api_key=\"local\")", right: "The client library requires a value, but a local server usually ignores it", wrong: ["It decrypts the model weights", "It selects the GPU to use", "It licenses the model for commercial use"], tier: 3, why: "The SDK expects a key; local servers typically do no key checking." },
    { q: "What is wrong with this local request when the server only knows a model called my-model?", code: "r = client.chat.completions.create(\n    model=\"gpt-large\",\n    messages=[{\"role\": \"user\", \"content\": \"Hi\"}],\n)", right: "The model field names a model the local server does not have, so the request fails", wrong: ["The messages list must be a single string", "A local server cannot accept chat completions", "The role must be \"assistant\" for the first message"], tier: 3, why: "The model name must match one the server has loaded or can load." },
    { q: "What does this curl command do?", code: "curl http://localhost:11434/api/generate -d '{\"model\": \"my-model\", \"prompt\": \"Why is the sky blue?\", \"stream\": false}'", right: "Requests one completed text response from the local Ollama server instead of a token stream", wrong: ["Downloads the model from the registry", "Lists the loaded models", "Streams each token as it is generated"], tier: 3, why: "stream: false returns a single JSON response once generation finishes." },
    { q: "Which setting do you change so an OpenAI SDK talks to a locally hosted model instead of a cloud service?", right: "The base URL", wrong: ["The tokenizer file", "The temperature", "The embedding dimension"], tier: 2, why: "The base URL controls where requests are sent." },
    { q: "A GGUF model loaded into a runtime produces garbled, off-format replies in chat. What is the most likely issue?", right: "The chat template does not match the format the model was trained on", wrong: ["The file has too many layers", "The runtime is using too few CPU threads", "The model is stored in safetensors format"], tier: 3, why: "Wrong turn markers confuse a chat model." },
    { q: "Which file format is considered safe to load from an untrusted source because it cannot execute code on load?", right: "Safetensors", wrong: ["A pickle-based PyTorch checkpoint", "Any .bin file", "A Python script that builds the model"], tier: 2, why: "Safetensors stores only tensor data and metadata; pickle can run arbitrary code." },
    { q: "You must run a quantized model on a Mac with Apple silicon using the GPU. Which backend does llama.cpp use there?", right: "Metal", wrong: ["CUDA", "ROCm", "AVX-512 only"], tier: 3, why: "Metal is Apple's GPU API." },
    { q: "Which GPU stack accelerates local inference on NVIDIA cards?", right: "CUDA", wrong: ["Metal", "Core ML only", "NEON"], tier: 2, why: "CUDA is NVIDIA's compute platform." },
    { q: "Your GPU has 8 GB of VRAM and the quantized model is 12 GB. What is a reasonable way to still use the GPU?", right: "Offload only part of the layers to the GPU and keep the rest on the CPU", wrong: ["Set the temperature to zero", "Convert the file to safetensors", "Increase the context size to use spare memory"], tier: 3, why: "Partial offload splits layers between GPU and CPU." },
    { q: "Two quantizations of the same model are compared. Q8_0 is about 8 GB and Q4_K_M is about 4.5 GB. Which tradeoff is expected?", right: "Q4_K_M is smaller and a bit faster, with a small quality loss relative to Q8_0", wrong: ["Q4_K_M is larger and more accurate", "Both have the same size and quality", "Q8_0 is smaller but slower"], tier: 3, why: "Lower bit widths shrink files and cut memory traffic at some accuracy cost." },
    { q: "Why does generation on a memory-bandwidth-limited machine usually speed up when you move to a smaller quantization of the same model?", right: "Each token reads fewer bytes of weights from memory", wrong: ["The tokenizer produces fewer tokens", "The model has fewer layers to compute", "The context window becomes unlimited"], tier: 3, why: "Decode time is largely the time to read the weights." },
    { q: "Which quantization is likely to degrade a model most noticeably?", right: "Q2_K", wrong: ["Q8_0", "BF16", "FP16"], tier: 3, why: "Quality loss grows as bits per weight fall." },
    { q: "A teammate downloads a model file named model.bin from an unknown website and loads it with an old PyTorch loader. What is the main concern?", right: "A pickle-based file can run arbitrary code when loaded", wrong: ["The file will make the GPU run out of VRAM", "It will increase the tokenizer vocabulary", "The model will overwrite the operating system's memory-mapped files"], tier: 3, why: "Unpickling untrusted data is a code execution risk." },
    { q: "A llama-server instance is started with 4 parallel slots and a context size of 16,384. About how much context does each conversation get?", right: "About 4,096 tokens, because the context is divided among the slots", wrong: ["16,384 tokens each", "65,536 tokens each", "1,024 tokens each"], tier: 5, why: "In llama.cpp's server the configured context is shared between slots." },
    { q: "Which server design lets many users share one GPU efficiently by adding new requests into a running batch?", right: "Continuous batching", wrong: ["Static batching with a fixed full batch", "Single request at a time", "Serving requests in alphabetical order"], tier: 4, why: "Continuous batching refills the batch as sequences finish." },
    { q: "You have a laptop with no supported GPU and a small quantized model. What happens when you run it?", right: "It runs on the CPU using system RAM, usually more slowly than with a GPU", wrong: ["It cannot run at all", "It runs faster than on a GPU because the CPU has more cores", "It runs only after being converted to a cloud API"], tier: 2, why: "CPU inference works for small quantized models." },
    { q: "You need to answer questions about confidential contracts on a laptop with no internet access. Which setup fits?", right: "A local embedding model and vector store feeding a local language model", wrong: ["A hosted embedding API feeding a local language model", "A hosted language model with the contracts pasted in", "A base model with no retrieval, asked about the files by name"], tier: 3, why: "Both embedding and generation must run locally to keep the documents on the machine." },
    { q: "You index documents with one embedding model, then query the index using vectors from a different embedding model. What is the likely result?", right: "Poor or meaningless matches, because the vectors live in different spaces", wrong: ["Perfect results, since all embeddings are interchangeable", "A tokenizer error that prevents any search", "The index automatically converts to the new model"], tier: 4, why: "Similarity only makes sense within one model's embedding space." },
    { q: "Before using an open-weights model in a commercial product, what should you check first?", right: "The licence terms on the model card", wrong: ["The number of layers", "The default temperature", "Whether the file name ends in .gguf"], tier: 2, why: "Open weights do not imply unrestricted commercial rights." },
    { q: "A server was started so that it listens on all network interfaces of your laptop. What is the risk?", right: "Other machines on the network may be able to use it unless access is controlled", wrong: ["The model weights will be re-downloaded", "The model will switch to a higher quantization", "Nothing, because local servers are never reachable from outside"], tier: 4, why: "Binding to a reachable address exposes the API." },
    { q: "Which pair of runtimes is aimed mainly at serving many concurrent users from GPU servers?", right: "vLLM and Text Generation Inference", wrong: ["LM Studio and llamafile", "ONNX and GGUF", "Modelfile and MLX"], tier: 3, why: "Both focus on batching and throughput for server workloads." },
    { q: "You see Ollama's `ollama ps` listing a model as using partly CPU. What is the likely cause?", right: "Not all layers fit in available GPU memory, so some run on the CPU", wrong: ["The model is corrupt", "The model uses a different tokenizer", "The seed is set"], tier: 4, why: "Layers that do not fit in VRAM stay on the CPU, slowing generation." },
    { q: "Which change reduces memory use but also risks cutting off long conversations early?", right: "Lowering the configured context size", wrong: ["Raising the context size", "Switching from Q4_K_M to Q8_0", "Loading a second copy of the model"], tier: 3, why: "A smaller context means a smaller KV cache but less text fits." },
    { q: "Why is a bigger context size setting not automatically better?", right: "It reserves more memory and can slow processing, and may exceed what the model was trained for", wrong: ["It makes the model forget its weights", "It disables GPU offload", "It changes the model's licence"], tier: 4, why: "Larger windows cost KV cache and may degrade quality beyond the trained length." },
    { q: "You want the response style baked into a reusable local model, but no new training. What should you use?", right: "A Modelfile with SYSTEM and PARAMETER lines", wrong: ["llama-quantize with a style option", "A larger GPU", "The seed setting"], tier: 2, why: "A Modelfile packages system prompts and defaults without training." },
  ],
  calc: [],
};
export default spec;
