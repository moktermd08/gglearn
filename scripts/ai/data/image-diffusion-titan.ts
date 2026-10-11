import type { TrackSpec } from "../types";

const spec: TrackSpec = {
  slug: "image-diffusion-titan",
  name: "Stable Diffusion & Diffusion Models: Novice to Titan",
  description: "How diffusion models generate images: noising and denoising, latent diffusion, text conditioning, guidance, samplers, ControlNet, LoRA, tooling and safety.",
  roles: "developer,designer",
  groups: {
    process: "diffusion process concept",
    arch: "model component",
    sampler: "sampler or scheduler concept",
    setting: "generation setting",
    custom: "customization method",
    control: "ControlNet input type",
    task: "image generation task",
    tool: "diffusion tool or library concept",
    problem: "common diffusion problem",
    safety: "safety or governance topic",
  },
  cards: [
    // ---------- process ----------
    {
      group: "process", subject: "Forward diffusion", tier: 1,
      says: [
        "gradually adds Gaussian noise to a training image until it is nearly pure noise",
        "follows a fixed schedule rather than being learned",
        "is only used during training, not when generating new images",
      ],
      use: "need to describe how training examples are corrupted",
      not: ["is the step that creates new images at inference time"],
      like: ["Reverse diffusion"],
    },
    {
      group: "process", subject: "Reverse diffusion", tier: 1,
      says: [
        "removes noise step by step to turn random noise into an image",
        "is carried out by a trained neural network at inference time",
        "is guided by the text prompt through conditioning",
      ],
      use: "need to describe how a new image is produced from noise",
      not: ["adds noise to the training data"],
      like: ["Forward diffusion"],
    },
    {
      group: "process", subject: "The noise schedule", tier: 2,
      says: [
        "defines how much noise is present at each timestep",
        "is chosen by the designer and fixed for training",
        "determines how the signal-to-noise ratio falls from clean image to pure noise",
      ],
      use: "need to understand how quickly an image is destroyed in the forward process",
      like: ["Timestep"],
    },
    {
      group: "process", subject: "Timestep", tier: 2,
      says: [
        "is an integer index telling the network how noisy its input is",
        "is converted into an embedding that conditions the denoiser",
        "runs from high noise toward zero noise during sampling",
      ],
      use: "need the network to know the current noise level",
      like: ["The noise schedule"],
    },
    {
      group: "process", subject: "Noise prediction", tier: 2,
      says: [
        "trains the network to estimate the noise that was added to an image",
        "lets the clean image be recovered by subtracting the estimated noise",
        "uses a simple mean-squared-error loss in the common formulation",
      ],
      use: "need to describe the classic DDPM training target",
      not: ["asks the network to output the final image from scratch in one step"],
      like: ["V-prediction"],
    },
    {
      group: "process", subject: "V-prediction", tier: 4,
      says: [
        "trains the network to predict a blend of noise and clean image called velocity",
        "can behave better than noise prediction at very high noise levels",
        "needs the sampler to match how the model was trained",
      ],
      use: "load a checkpoint trained to output velocity rather than noise",
      like: ["Noise prediction"],
    },
    {
      group: "process", subject: "Signal-to-noise ratio", tier: 4,
      says: [
        "measures how much of an image remains versus added noise at a timestep",
        "drops as the timestep moves toward pure noise",
        "is why noise schedules matter so much for training stability",
      ],
      use: "need to compare how different schedules corrupt an image",
      like: ["The noise schedule"],
    },
    {
      group: "process", subject: "DDPM", tier: 3,
      says: [
        "is the denoising diffusion probabilistic model that popularized the approach",
        "samples with many small stochastic steps",
        "uses a Markov chain of noising steps with a learned reverse chain",
      ],
      use: "need the original formulation that later samplers speed up",
      like: ["DDIM"],
    },
    {
      group: "process", subject: "The training objective", tier: 3,
      says: [
        "samples a random timestep and noise level for each training image",
        "compares the network's prediction with the true noise or target",
        "does not require labeled captions unless conditioning is used",
      ],
      use: "need to explain one training step in a diffusion model",
    },
    {
      group: "process", subject: "Latent noise tensor", tier: 3,
      says: [
        "is the random starting array that sampling progressively denoises",
        "is determined by the seed",
        "has the shape of the latent, not of the final pixel image",
      ],
      use: "need to know what exactly the seed produces",
      not: ["is the final decoded picture"],
    },
    {
      group: "process", subject: "Flow matching", tier: 5,
      says: [
        "trains a model to predict a velocity field that moves noise toward data",
        "is an alternative to the classic noise-prediction formulation",
        "often yields straighter paths that need fewer sampling steps",
      ],
      use: "meet a model described as rectified flow instead of DDPM",
      like: ["Noise prediction", "V-prediction"],
    },
    {
      group: "process", subject: "Iterative refinement", tier: 1,
      says: [
        "is why diffusion needs many network evaluations per image",
        "improves the image gradually from coarse structure to fine detail",
        "makes generation slower than a single-pass generator",
      ],
      use: "need to explain why images take multiple steps to appear",
    },

    // ---------- arch ----------
    {
      group: "arch", subject: "The U-Net", tier: 1,
      says: [
        "is a convolutional encoder-decoder network with skip connections",
        "predicts the noise in a latent at each timestep",
        "uses cross-attention layers to take in the text conditioning",
      ],
      use: "need the classic network inside early latent diffusion models",
      not: ["decodes latents into final pixels"],
      like: ["The diffusion transformer"],
    },
    {
      group: "arch", subject: "The diffusion transformer", tier: 4,
      says: [
        "replaces the U-Net backbone with a transformer operating on latent patches",
        "scales well with more parameters and compute",
        "is the architecture behind many recent image models",
      ],
      use: "need a transformer-based denoiser instead of convolutions",
      like: ["The U-Net"],
    },
    {
      group: "arch", subject: "The VAE", tier: 1,
      says: [
        "compresses images into a smaller latent space and decodes them back",
        "lets diffusion run on small latents instead of full-size pixels",
        "is trained separately from the denoising network",
      ],
      use: "need to know why generation is memory-efficient compared with pixel space",
      not: ["reads the text prompt and produces embeddings"],
      like: ["The VAE decoder"],
    },
    {
      group: "arch", subject: "The VAE decoder", tier: 2,
      says: [
        "converts the final denoised latent into a visible pixel image",
        "runs once at the end of sampling",
        "can introduce color shifts if mismatched to the model",
      ],
      use: "need the stage that turns latents into the final image",
      like: ["The VAE"],
    },
    {
      group: "arch", subject: "Latent space", tier: 2,
      says: [
        "is a compressed representation of an image used for diffusion",
        "is spatially much smaller than the pixel image, commonly by a factor of eight per side",
        "keeps the semantic and structural content needed for reconstruction",
      ],
      use: "need to reason about why denoising is cheaper than in pixel space",
      like: ["Latent noise tensor"],
    },
    {
      group: "arch", subject: "The CLIP text encoder", tier: 2,
      says: [
        "turns a prompt into embeddings that condition the denoiser",
        "was trained jointly with an image encoder to align text and images",
        "tokenizes prompts with a limit that truncates long text in classic models",
      ],
      use: "need to know what reads the prompt in classic Stable Diffusion",
      like: ["The T5 text encoder"],
    },
    {
      group: "arch", subject: "The T5 text encoder", tier: 4,
      says: [
        "is a language-model encoder that handles longer and more detailed prompts",
        "improves understanding of sentence structure and spatial relations",
        "is used by some newer models alongside or instead of CLIP",
      ],
      use: "need a text encoder that follows long, complex descriptions",
      like: ["The CLIP text encoder"],
    },
    {
      group: "arch", subject: "Cross-attention", tier: 3,
      says: [
        "lets image features attend to the text embeddings",
        "is the main route by which a prompt influences each region of the image",
        "uses image-derived queries and text-derived keys and values",
      ],
      use: "need the mechanism linking prompt words to image areas",
      like: ["Self-attention"],
    },
    {
      group: "arch", subject: "Self-attention", tier: 3,
      says: [
        "relates different positions within the image features to each other",
        "helps maintain global coherence across the image",
        "uses queries, keys and values all computed from the image features",
      ],
      use: "need the layer that lets distant image regions interact",
      like: ["Cross-attention"],
    },
    {
      group: "arch", subject: "Skip connections", tier: 3,
      says: [
        "pass encoder features directly to matching decoder layers",
        "preserve fine spatial detail that downsampling would lose",
        "are a defining feature of the U-Net design",
      ],
      use: "need to explain how a U-Net keeps high-resolution detail",
    },
    {
      group: "arch", subject: "Timestep embedding", tier: 3,
      says: [
        "encodes the current noise level as a vector, often with sinusoidal features",
        "is injected into the denoiser's blocks so it can adapt its behavior",
        "lets one network handle every noise level",
      ],
      use: "need to know how one network handles all noise levels",
      like: ["Timestep"],
    },
    {
      group: "arch", subject: "Latent diffusion", tier: 2,
      says: [
        "runs the diffusion process inside the VAE's latent space",
        "combines a VAE, a denoiser and a text encoder",
        "reduced the compute needed to train and run high-resolution image models",
      ],
      use: "need the overall design of Stable Diffusion",
      not: ["runs the denoiser directly on full-resolution pixels"],
    },
    {
      group: "arch", subject: "Refiner model", tier: 5,
      says: [
        "is a second model that polishes details in a nearly finished latent",
        "is run on the last portion of the denoising steps",
        "is optional and not part of every pipeline",
      ],
      use: "want a second stage to improve fine detail in a two-stage pipeline",
    },

    // ---------- sampler ----------
    {
      group: "sampler", subject: "A sampler", tier: 1,
      says: [
        "is the algorithm that steps from noise to an image using the network's predictions",
        "determines how many steps are needed for a clean result",
        "can change the look and speed without retraining the model",
      ],
      use: "want a different result quality or speed without changing the checkpoint",
      like: ["A scheduler"],
    },
    {
      group: "sampler", subject: "A scheduler", tier: 2,
      says: [
        "decides which noise levels the steps visit",
        "is often a separate component in libraries from the stepping algorithm",
        "can be swapped without changing the model weights",
      ],
      use: "want to change how noise levels are spaced across steps",
      like: ["A sampler", "The Karras sigma schedule"],
    },
    {
      group: "sampler", subject: "Euler", tier: 2,
      says: [
        "is a simple first-order solver for the denoising equation",
        "is fast and predictable",
        "converges to a stable image as steps increase",
      ],
      use: "want a straightforward sampler for quick drafts",
      like: ["Euler ancestral"],
    },
    {
      group: "sampler", subject: "Euler ancestral", tier: 3,
      says: [
        "injects fresh noise at each step",
        "does not converge to a single image as steps increase",
        "gives varied results when the step count changes",
      ],
      use: "want creative variety and accept that changing steps changes the picture",
      like: ["Euler"],
    },
    {
      group: "sampler", subject: "DDIM", tier: 3,
      says: [
        "is a deterministic sampler that can skip timesteps",
        "gives reproducible results for a fixed seed and steps",
        "made diffusion sampling much faster than the original DDPM",
      ],
      use: "need deterministic, fast sampling with fewer steps",
      like: ["DDPM"],
    },
    {
      group: "sampler", subject: "DPM++ solvers", tier: 3,
      says: [
        "are higher-order solvers that reach good quality in few steps",
        "come in single-step and multistep variants",
        "are popular defaults for quality at about twenty to thirty steps",
      ],
      use: "want good results with a small step count",
      like: ["Euler"],
    },
    {
      group: "sampler", subject: "The Karras sigma schedule", tier: 4,
      says: [
        "spaces noise levels more densely at low noise",
        "often improves detail at the same step count",
        "is a schedule choice, not a different sampler algorithm",
      ],
      use: "want finer detail without changing the step count",
      like: ["A scheduler"],
    },
    {
      group: "sampler", subject: "Ancestral sampling", tier: 4,
      says: [
        "adds new randomness during denoising rather than following a fixed path",
        "makes the image depend on the total number of steps",
        "is the reason some samplers never settle on one result",
      ],
      use: "need to explain why more steps change an image instead of refining it",
      like: ["Euler ancestral"],
    },
    {
      group: "sampler", subject: "Few-step distilled models", tier: 5,
      says: [
        "are trained to produce images in only a handful of steps",
        "trade some diversity or fidelity for speed",
        "often use a low or disabled guidance scale at inference",
      ],
      use: "need near-real-time generation with very few steps",
      not: ["need hundreds of steps like the original DDPM"],
    },
    {
      group: "sampler", subject: "Heun", tier: 4,
      says: [
        "is a second-order method that evaluates the network twice per step",
        "can be more accurate than first-order Euler at the same step count",
        "costs roughly double the compute per step",
      ],
      use: "want higher accuracy per step and accept extra cost per step",
      like: ["Euler"],
    },
    {
      group: "sampler", subject: "Sigma", tier: 5,
      says: [
        "is the noise standard deviation at a given point in sampling",
        "starts large and reaches zero when sampling ends",
        "is used by many solvers instead of integer timesteps",
      ],
      use: "need the noise-level quantity used by Euler-style solvers",
      like: ["Timestep"],
    },

    // ---------- setting ----------
    {
      group: "setting", subject: "Classifier-free guidance scale", tier: 1,
      says: [
        "controls how strongly the image is pushed toward the prompt",
        "combines a conditional and an unconditional prediction",
        "gives oversaturated, burnt images when set far too high",
      ],
      use: "want results to follow the prompt more literally",
      not: ["sets the number of denoising steps"],
      like: ["Sampling steps"],
    },
    {
      group: "setting", subject: "Sampling steps", tier: 1,
      says: [
        "is the number of denoising iterations used for one image",
        "raises generation time roughly in proportion",
        "gives diminishing returns beyond a modest count for most samplers",
      ],
      use: "want to trade speed against refinement",
      not: ["controls how closely the prompt is followed"],
      like: ["Classifier-free guidance scale"],
    },
    {
      group: "setting", subject: "The seed", tier: 1,
      says: [
        "determines the initial random noise",
        "reproduces the same image when all other settings are unchanged",
        "lets you vary only the prompt while keeping a similar layout",
      ],
      use: "need to reproduce a previous result exactly",
      not: ["is the name of a prompt style"],
    },
    {
      group: "setting", subject: "Denoising strength", tier: 2,
      says: [
        "sets how much noise is added to the input image in image-to-image mode",
        "keeps the input mostly unchanged at low values",
        "approaches a fresh text-to-image generation near the maximum",
      ],
      use: "want a light restyle that preserves the original structure",
      like: ["Classifier-free guidance scale"],
    },
    {
      group: "setting", subject: "The negative prompt", tier: 1,
      says: [
        "supplies the content to steer away from in place of the empty unconditional prompt",
        "works through the guidance mechanism",
        "gets stronger at higher guidance scale",
      ],
      use: "want to push the image away from blur or extra limbs",
      not: ["is a mask that deletes objects from the picture"],
    },
    {
      group: "setting", subject: "Image resolution", tier: 2,
      says: [
        "must be divisible by a model-specific factor, such as eight",
        "works best near the resolutions the model was trained on",
        "multiplies memory and time costs as pixels grow",
      ],
      use: "need to pick a width and height the model handles well",
      like: ["Hires fix"],
    },
    {
      group: "setting", subject: "Clip skip", tier: 4,
      says: [
        "uses an earlier layer of the CLIP text encoder instead of the last one",
        "changes how literally or stylistically the prompt is interpreted",
        "is relevant to checkpoints trained with a specific skip value",
      ],
      use: "load a model whose instructions recommend skipping the last text-encoder layer",
    },
    {
      group: "setting", subject: "Batch size", tier: 2,
      says: [
        "is the number of images computed in parallel per run",
        "raises VRAM use as it grows",
        "does not make any single image higher quality",
      ],
      use: "want several candidates in one run if memory allows",
      not: ["is the number of denoising steps"],
    },
    {
      group: "setting", subject: "Prompt weighting syntax", tier: 3,
      says: [
        "lets you emphasize terms with parentheses such as (word:1.3)",
        "is a feature of the user interface or library, not of the model itself",
        "adjusts how strongly specific tokens are represented",
      ],
      use: "need one phrase to count more than the others",
    },
    {
      group: "setting", subject: "Guidance rescale", tier: 5,
      says: [
        "counteracts overexposed results at high guidance scales",
        "rescales the guided prediction to match the conditional one",
        "mainly helps models trained with zero-terminal-SNR schedules",
      ],
      use: "see washed-out, overexposed images at a high guidance scale",
      like: ["Classifier-free guidance scale"],
    },
    {
      group: "setting", subject: "VAE selection", tier: 3,
      says: [
        "chooses which decoder turns latents into pixels",
        "can fix washed-out colors caused by a mismatched decoder",
        "must be compatible with the model's latent format",
      ],
      use: "see gray, low-contrast outputs from a checkpoint",
    },
    {
      group: "setting", subject: "Hires fix", tier: 3,
      says: [
        "generates at a small size, upscales the latent or image, and denoises again",
        "avoids duplicated subjects that appear when generating directly at high resolution",
        "adds extra time because of a second denoising pass",
      ],
      use: "need a larger image without duplicate subjects",
      like: ["Image resolution"],
    },

    // ---------- custom ----------
    {
      group: "custom", subject: "A checkpoint", tier: 1,
      says: [
        "is a full set of model weights saved to disk",
        "defines the base capabilities and general style of generation",
        "is typically several gigabytes in size",
      ],
      use: "need a different base model or overall style",
      not: ["is a small add-on file that patches another model"],
      like: ["A LoRA"],
    },
    {
      group: "custom", subject: "A LoRA", tier: 2,
      says: [
        "stores low-rank weight updates that modify a base model",
        "is much smaller than a full checkpoint",
        "can be combined with a checkpoint at an adjustable strength",
      ],
      use: "want to add a style or character without replacing the base model",
      not: ["replaces the entire base model when loaded"],
      like: ["A checkpoint"],
    },
    {
      group: "custom", subject: "Textual inversion", tier: 3,
      says: [
        "learns a new token embedding for a concept while freezing the model",
        "produces a tiny file containing only embedding vectors",
        "is invoked by writing its token in the prompt",
      ],
      use: "want to teach a new word for a concept with a tiny file",
      like: ["A LoRA"],
    },
    {
      group: "custom", subject: "DreamBooth", tier: 3,
      says: [
        "fine-tunes the model on a few images of a specific subject",
        "binds the subject to a rare identifier token",
        "uses prior-preservation images to limit forgetting",
      ],
      use: "need a specific person or object rendered faithfully",
      like: ["A LoRA", "Textual inversion"],
    },
    {
      group: "custom", subject: "LoRA rank", tier: 4,
      says: [
        "sets the size of the low-rank matrices in an adapter",
        "raises capacity and file size as it grows",
        "can overfit if too high for a tiny dataset",
      ],
      use: "need more adapter capacity for a complex style",
      like: ["LoRA weight"],
    },
    {
      group: "custom", subject: "LoRA weight", tier: 3,
      says: [
        "sets how strongly a LoRA is applied at generation time",
        "causes distorted images when pushed far above its intended value",
        "can be lowered to blend a LoRA softly",
      ],
      use: "want a LoRA's effect to be subtler",
      like: ["LoRA rank"],
    },
    {
      group: "custom", subject: "Trigger word", tier: 2,
      says: [
        "is a token that activates a learned concept in the prompt",
        "is chosen during training of a LoRA or embedding",
        "may be unnecessary for style adapters trained without one",
      ],
      use: "load a character LoRA and need to summon it in the prompt",
      not: ["is required by every checkpoint"],
    },
    {
      group: "custom", subject: "A merged checkpoint", tier: 3,
      says: [
        "blends the weights of two or more models",
        "mixes their styles and abilities",
        "can unpredictably lose abilities from either parent",
      ],
      use: "want a blend of two models' looks in a single file",
      like: ["A checkpoint"],
    },
    {
      group: "custom", subject: "IP-Adapter", tier: 4,
      says: [
        "conditions generation on a reference image through an image encoder",
        "transfers style or subject cues without per-subject training",
        "works alongside the text prompt",
      ],
      use: "need to steer the result with a reference image and no training",
      like: ["ControlNet"],
    },
    {
      group: "custom", subject: "Full fine-tuning", tier: 4,
      says: [
        "updates all or most of a model's weights on new data",
        "needs more memory and compute than adapter methods",
        "risks overwriting general capabilities if overdone",
      ],
      use: "have a large dataset and need deep changes to the model",
      like: ["A LoRA"],
    },
    {
      group: "custom", subject: "Overfitting in training", tier: 4,
      says: [
        "makes a custom model reproduce its training images instead of generalizing",
        "shows up as ignored prompts and repeated poses",
        "is reduced by fewer steps, lower learning rate or more varied images",
      ],
      use: "see a trained subject appear identically no matter what the prompt says",
    },
    {
      group: "custom", subject: "The safetensors format", tier: 2,
      says: [
        "stores model weights without arbitrary code execution during loading",
        "is preferred over pickle-based checkpoint files for safety",
        "loads quickly because tensors can be memory-mapped",
      ],
      use: "need a safer file format for downloaded model weights",
      not: ["runs embedded Python code when opened"],
    },

    // ---------- control ----------
    {
      group: "control", subject: "ControlNet", tier: 2,
      says: [
        "adds a trainable copy of a network's encoder that takes a spatial condition",
        "lets an extra image such as edges or depth steer the layout",
        "leaves the base model's weights frozen",
      ],
      use: "need to control composition or pose precisely",
      like: ["IP-Adapter"],
    },
    {
      group: "control", subject: "Canny edge map", tier: 2,
      says: [
        "is a black-and-white outline of edges extracted from an image",
        "preserves shapes and contours of the source",
        "ignores color and shading information",
      ],
      use: "need to keep the outline of an object while restyling it",
      like: ["Lineart"],
    },
    {
      group: "control", subject: "Depth map", tier: 2,
      says: [
        "encodes how far each pixel is from the camera",
        "preserves 3D layout and spacing of objects",
        "is estimated from a photo by a monocular depth model",
      ],
      use: "need to keep the spatial arrangement of a scene while changing its appearance",
      like: ["Normal map"],
    },
    {
      group: "control", subject: "OpenPose skeleton", tier: 2,
      says: [
        "represents a human pose as keypoints joined by lines",
        "fixes the pose of figures without fixing their appearance",
        "can include hands and face landmarks in some variants",
      ],
      use: "need a character in an exact body pose",
    },
    {
      group: "control", subject: "Scribble input", tier: 3,
      says: [
        "turns a rough hand-drawn sketch into a finished image",
        "tolerates imprecise, hand-drawn lines",
        "gives loose guidance compared with precise edge maps",
      ],
      use: "have only a quick doodle of the layout",
      like: ["Canny edge map", "Lineart"],
    },
    {
      group: "control", subject: "Semantic segmentation map", tier: 3,
      says: [
        "labels each region of the image with a class, shown as colored areas",
        "controls what goes where, such as sky, building or road",
        "does not specify exact edge shapes inside regions",
      ],
      use: "need to place categories like sky and water in specific regions",
    },
    {
      group: "control", subject: "Normal map", tier: 4,
      says: [
        "encodes surface orientation at each pixel as color",
        "preserves fine surface geometry and lighting cues",
        "captures relief detail that a depth map may smooth out",
      ],
      use: "need surface detail and shading direction preserved",
      like: ["Depth map"],
    },
    {
      group: "control", subject: "Lineart", tier: 3,
      says: [
        "extracts clean outlines of drawings and illustrations",
        "suits coloring and restyling hand-drawn artwork",
        "retains line shapes more cleanly than a generic edge detector",
      ],
      use: "need to color or restyle a clean illustration",
      like: ["Canny edge map", "Scribble input"],
    },
    {
      group: "control", subject: "Tile control", tier: 4,
      says: [
        "conditions on a low-detail version of the image to add detail",
        "is used for upscaling in tiles without large changes",
        "keeps the overall content while adding texture",
      ],
      use: "need a detail-adding upscale that stays faithful to the original",
    },
    {
      group: "control", subject: "Conditioning strength", tier: 3,
      says: [
        "sets how strongly the control image constrains the result",
        "lets the prompt take over when set low",
        "can produce rigid, over-constrained images when set too high",
      ],
      use: "want a control image to guide the layout loosely rather than exactly",
      not: ["controls the number of steps"],
    },

    // ---------- task ----------
    {
      group: "task", subject: "Text-to-image", tier: 1,
      says: [
        "starts from pure random noise in latent space",
        "produces an image guided only by the prompt",
        "uses the full sequence of denoising steps",
      ],
      use: "have only a text description",
      like: ["Image-to-image"],
    },
    {
      group: "task", subject: "Image-to-image", tier: 1,
      says: [
        "starts from a noised version of an input image",
        "uses denoising strength to control how much of the input survives",
        "skips the early high-noise steps at low strength",
      ],
      use: "have a picture whose composition must carry over",
      like: ["Text-to-image"],
    },
    {
      group: "task", subject: "Inpainting", tier: 2,
      says: [
        "regenerates only the masked region of an image",
        "uses the unmasked pixels as context",
        "can use a dedicated model trained with an extra mask input",
      ],
      use: "need to replace one object without altering the rest",
      like: ["Outpainting"],
    },
    {
      group: "task", subject: "Outpainting", tier: 2,
      says: [
        "extends the canvas beyond the original borders",
        "invents new content consistent with the existing edges",
        "is performed by treating the new area as a masked region",
      ],
      use: "need to widen an image beyond its edges",
      like: ["Inpainting"],
    },
    {
      group: "task", subject: "Mask blur", tier: 3,
      says: [
        "softens the edge of an inpainting mask",
        "reduces visible seams at the boundary of an edit",
        "too much of it lets the edit leak outside the intended area",
      ],
      use: "see a visible seam around an inpainted area",
    },
    {
      group: "task", subject: "Latent upscaling", tier: 3,
      says: [
        "enlarges the latent before denoising again",
        "adds new detail instead of just interpolating pixels",
        "needs a moderate denoise to avoid changing the composition",
      ],
      use: "want more detail in an enlarged image through another pass",
      like: ["Hires fix"],
    },
    {
      group: "task", subject: "Tiled upscaling", tier: 4,
      says: [
        "processes a large image in overlapping tiles",
        "allows very large outputs within limited VRAM",
        "can leave seams or inconsistent detail between tiles",
      ],
      use: "need a very large image with limited GPU memory",
    },
    {
      group: "task", subject: "Regional prompting", tier: 4,
      says: [
        "assigns different prompts to different parts of the canvas",
        "helps stop attributes from leaking between subjects",
        "needs masks or layout regions as input",
      ],
      use: "need two characters with different clothing in one scene",
    },
    {
      group: "task", subject: "Batch generation", tier: 2,
      says: [
        "produces many images from varying seeds or prompts in one job",
        "is how candidate sets are made for review",
        "multiplies the total compute used",
      ],
      use: "want to browse many variations then pick one",
    },
    {
      group: "task", subject: "Prompt matrix or grid", tier: 4,
      says: [
        "compares the same seed across systematically varied settings",
        "makes the effect of a single parameter visible side by side",
        "is useful for choosing a guidance scale or checkpoint",
      ],
      use: "need to see how one setting changes the output",
    },

    // ---------- tool ----------
    {
      group: "tool", subject: "ComfyUI", tier: 1,
      says: [
        "builds generation pipelines as a graph of connected nodes",
        "saves a whole workflow so it can be shared and reloaded",
        "exposes every stage such as loading, sampling and decoding as a node",
      ],
      use: "need a visual, modular, reproducible pipeline",
      like: ["AUTOMATIC1111"],
    },
    {
      group: "tool", subject: "AUTOMATIC1111", tier: 1,
      says: [
        "is a browser-based interface with tabs for text-to-image and image-to-image",
        "supports extensions that add features",
        "presents settings as form fields instead of a graph",
      ],
      use: "want a form-based web interface for generating images",
      like: ["ComfyUI"],
    },
    {
      group: "tool", subject: "The diffusers library", tier: 2,
      says: [
        "is a Python library with pipelines for diffusion models",
        "loads models with from_pretrained",
        "separates models, schedulers and pipelines as interchangeable parts",
      ],
      use: "need to generate images from Python code",
      not: ["is a graphical node editor"],
    },
    {
      group: "tool", subject: "A diffusion pipeline object", tier: 3,
      says: [
        "bundles the text encoder, denoiser, scheduler and VAE",
        "is called with a prompt to return images",
        "lets you swap components such as the scheduler",
      ],
      use: "need a single object that runs the whole generation process",
    },
    {
      group: "tool", subject: "A node graph workflow", tier: 3,
      says: [
        "stores the exact wiring and settings used for a result",
        "can be embedded in output image metadata in some tools",
        "makes complex multi-stage pipelines reproducible",
      ],
      use: "need to repeat or share a multi-step pipeline exactly",
    },
    {
      group: "tool", subject: "Custom nodes and extensions", tier: 3,
      says: [
        "add features that the base tool does not include",
        "are written by the community and vary in quality",
        "should be reviewed before installing because they run code",
      ],
      use: "want features like new ControlNet preprocessors in a UI",
      not: ["are always safe to install without review"],
    },
    {
      group: "tool", subject: "Model offloading", tier: 4,
      says: [
        "moves unused model components to system memory to save VRAM",
        "trades extra speed cost for lower GPU memory use",
        "lets large models run on smaller GPUs",
      ],
      use: "run out of VRAM when loading a large model",
    },
    {
      group: "tool", subject: "Half precision", tier: 3,
      says: [
        "stores weights and activations in 16 bits instead of 32",
        "roughly halves memory use",
        "can produce numerical problems such as black images with some components",
      ],
      use: "want to reduce memory and speed up inference",
    },
    {
      group: "tool", subject: "A model hub", tier: 2,
      says: [
        "hosts downloadable model files and their documentation",
        "includes model cards describing licenses and intended use",
        "lets you load models by name in a library",
      ],
      use: "need to find and download a checkpoint with its license",
    },
    {
      group: "tool", subject: "Generation metadata", tier: 3,
      says: [
        "records prompt, seed, steps and sampler in the output file",
        "lets someone recreate the same image with the same settings",
        "can be stripped when an image is re-saved by other software",
      ],
      use: "want to reproduce an image from a downloaded file",
    },

    // ---------- problem ----------
    {
      group: "problem", subject: "Duplicated subjects", tier: 2,
      says: [
        "appear when generating far above the training resolution",
        "show as extra heads or repeated figures in one frame",
        "are reduced with a lower base resolution plus an upscale pass",
      ],
      use: "see two heads on one body in a tall image",
      like: ["Concept bleeding"],
    },
    {
      group: "problem", subject: "Oversaturation at high guidance", tier: 3,
      says: [
        "gives burnt, overly contrasted colors",
        "happens as the guidance scale is raised too far",
        "is reduced by lowering guidance or using rescaling",
      ],
      use: "see harsh colors and crunchy contrast at a high scale",
    },
    {
      group: "problem", subject: "Out-of-memory error", tier: 2,
      says: [
        "occurs when the GPU lacks memory for the model or image size",
        "is eased with lower resolution, smaller batches or offloading",
        "is a hardware limit rather than a prompt problem",
      ],
      use: "have a CUDA out-of-memory crash",
    },
    {
      group: "problem", subject: "Prompt truncation", tier: 3,
      says: [
        "drops tokens beyond the text encoder's limit in classic models",
        "silently ignores late parts of very long prompts",
        "is worked around by chunking or by encoders with longer limits",
      ],
      use: "find that the end of a long prompt has no effect",
    },
    {
      group: "problem", subject: "Concept bleeding", tier: 3,
      says: [
        "lets attributes from one object leak into another",
        "is common when a prompt lists several subjects with different colors",
        "is reduced by regional prompting or separate generations",
      ],
      use: "see a red shirt appear on the wrong character",
      like: ["Duplicated subjects"],
    },
    {
      group: "problem", subject: "Washed-out colors", tier: 2,
      says: [
        "are often caused by a mismatched or missing VAE",
        "show as flat, low-contrast gray tones",
        "are fixed by loading the correct VAE for the checkpoint",
      ],
      use: "see dull gray output from an otherwise good checkpoint",
    },
    {
      group: "problem", subject: "Overbaked LoRA", tier: 4,
      says: [
        "shows as distorted, overly stylized images when applied too strongly",
        "is addressed by lowering the LoRA weight",
        "can also come from training for too many steps",
      ],
      use: "see burnt textures after adding an adapter at full strength",
    },
    {
      group: "problem", subject: "Non-determinism across hardware", tier: 5,
      says: [
        "can make the same seed give slightly different images on different GPUs",
        "comes from floating-point and kernel differences",
        "is why exact reproducibility is guaranteed only on identical setups",
      ],
      use: "find that a shared seed gives a different image on another machine",
      not: ["is impossible because seeds do nothing"],
    },
    {
      group: "problem", subject: "Low step count blur", tier: 2,
      says: [
        "leaves images soft or unfinished when too few steps are used",
        "is more severe with first-order samplers",
        "improves as steps increase until returns diminish",
      ],
      use: "see mushy images at five steps",
    },
    {
      group: "problem", subject: "Text rendering failure", tier: 2,
      says: [
        "yields misspelled or nonsense letters inside images",
        "is common in models with weaker text encoders",
        "is avoided by adding text in post-processing",
      ],
      use: "need exact lettering on a sign",
    },

    // ---------- safety ----------
    {
      group: "safety", subject: "A safety checker", tier: 2,
      says: [
        "is a classifier that screens generated images for unsafe content",
        "is part of some pipelines by default",
        "can be disabled by users of open weights, which is a governance concern",
      ],
      use: "need to block unsafe outputs in a public application",
      like: ["Prompt filtering"],
    },
    {
      group: "safety", subject: "Prompt filtering", tier: 2,
      says: [
        "blocks requests containing disallowed terms before generation",
        "can be bypassed with creative rewording",
        "is typically combined with an output filter",
      ],
      use: "want to refuse disallowed requests before any compute is spent",
      like: ["A safety checker"],
    },
    {
      group: "safety", subject: "Dataset filtering", tier: 3,
      says: [
        "removes unsafe or unwanted images from the training data",
        "shapes what a model can generate from the start",
        "is imperfect and does not eliminate all risk",
      ],
      use: "want a model that never learned certain content",
    },
    {
      group: "safety", subject: "Concept erasure", tier: 5,
      says: [
        "edits model weights to remove the ability to depict a concept",
        "can often be partly undone through further fine-tuning",
        "is an active research area rather than a perfect guarantee",
      ],
      use: "want to remove a concept after training without retraining from scratch",
    },
    {
      group: "safety", subject: "Invisible watermarking", tier: 3,
      says: [
        "embeds a hidden signal in images to mark them as generated",
        "is intended to survive some edits such as resizing",
        "can be removed or weakened by determined attackers",
      ],
      use: "want to tag generated images so they can be detected later",
    },
    {
      group: "safety", subject: "Memorization", tier: 4,
      says: [
        "happens when a model reproduces near-copies of training images",
        "is more likely for images duplicated many times in the data",
        "is a privacy and copyright concern",
      ],
      use: "see a generated image nearly identical to a known photo",
    },
    {
      group: "safety", subject: "Model licenses", tier: 3,
      says: [
        "set terms for use, redistribution and prohibited uses of weights",
        "differ between models and must be read for commercial use",
        "may include use-based restrictions carried to derivatives",
      ],
      use: "plan to sell a service built on downloaded weights",
      not: ["are identical for all open models"],
    },
    {
      group: "safety", subject: "Dataset bias", tier: 3,
      says: [
        "makes outputs reflect stereotypes in the training data",
        "shows when neutral prompts default to one demographic",
        "is mitigated through data curation and explicit prompting",
      ],
      use: "notice that neutral prompts keep producing the same kind of person",
    },
    {
      group: "safety", subject: "Deepfake misuse", tier: 3,
      says: [
        "uses image models to fabricate realistic images of real people",
        "is a main reason for consent rules and provenance efforts",
        "is eased by identity-conditioning tools like fine-tuned adapters",
      ],
      use: "are asked to generate a convincing photo of a real person doing something they never did",
    },
    {
      group: "safety", subject: "Provenance metadata", tier: 3,
      says: [
        "attaches signed information about how an image was made",
        "helps viewers judge whether an image is synthetic",
        "can be lost if the file is re-encoded or screenshotted",
      ],
      use: "want a verifiable record of the origin of an image",
      like: ["Invisible watermarking"],
    },
  ],
  qa: [
    {
      q: "What does this diffusers snippet do?",
      code: "import torch\nfrom diffusers import DiffusionPipeline\n\npipe = DiffusionPipeline.from_pretrained(\"path/to/model\", torch_dtype=torch.float16).to(\"cuda\")\nimage = pipe(\"a lighthouse at dusk\").images[0]",
      right: "Loads a half-precision pipeline onto the GPU and generates one image from the prompt",
      wrong: ["Trains the model on a lighthouse dataset", "Converts the model into the safetensors format", "Downloads only the VAE and decodes a blank latent"],
      tier: 2, topic: "diffusers",
      why: "from_pretrained loads the pipeline, and calling it returns images.",
    },
    {
      q: "What does the generator argument achieve in this call?",
      code: "gen = torch.Generator(\"cuda\").manual_seed(42)\nimage = pipe(prompt, generator=gen).images[0]",
      right: "It fixes the starting noise so the result can be reproduced",
      wrong: ["It sets the guidance scale to 42", "It loads a LoRA with id 42", "It runs the model for 42 steps"],
      tier: 2, topic: "diffusers",
      why: "A seeded generator gives repeatable initial noise.",
    },
    {
      q: "Which call sets the number of denoising steps and the guidance scale?",
      code: "image = pipe(\n    prompt,\n    num_inference_steps=30,\n    guidance_scale=7.5,\n).images[0]",
      right: "num_inference_steps sets the steps and guidance_scale sets prompt adherence",
      wrong: ["guidance_scale sets the steps and num_inference_steps sets the batch size", "num_inference_steps sets the image width and guidance_scale the height", "Both only change the VAE"],
      tier: 2, topic: "diffusers",
      why: "These are the standard argument names.",
    },
    {
      q: "How is a negative prompt passed in diffusers?",
      code: "image = pipe(\n    \"a portrait photo\",\n    negative_prompt=\"blurry, extra fingers\",\n).images[0]",
      right: "With the negative_prompt argument",
      wrong: ["With the exclude_tokens argument", "With a second call that inverts the image", "It cannot be passed to pipelines"],
      tier: 2, topic: "diffusers",
      why: "negative_prompt is the supported argument.",
    },
    {
      q: "What does this line change?",
      code: "from diffusers import DPMSolverMultistepScheduler\npipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)",
      right: "The sampling algorithm, without changing the model weights",
      wrong: ["The text encoder to a larger one", "The VAE to a different resolution", "The checkpoint to a LoRA"],
      tier: 3, topic: "diffusers",
      why: "Schedulers are interchangeable components.",
    },
    {
      q: "What does this code do?",
      code: "pipe.load_lora_weights(\"path/to/lora\")\nimage = pipe(\"a castle, watercolor\").images[0]",
      right: "Applies the adapter's low-rank updates to the pipeline before generating",
      wrong: ["Replaces the checkpoint with the adapter only", "Fine-tunes the pipeline for one epoch", "Converts the model to half precision"],
      tier: 3, topic: "diffusers",
      why: "load_lora_weights adds LoRA weights to the pipeline.",
    },
    {
      q: "Which change reduces GPU memory use at some cost in speed?",
      code: "pipe.enable_model_cpu_offload()",
      right: "Moving idle model components to the CPU until they are needed",
      wrong: ["Raising the guidance scale", "Doubling the batch size", "Switching to a deterministic sampler"],
      tier: 4, topic: "diffusers",
      why: "Offloading trades speed for lower VRAM.",
    },
    {
      q: "What does the strength argument do in this image-to-image call?",
      code: "image = img2img_pipe(\n    prompt=\"oil painting\",\n    image=init_image,\n    strength=0.3,\n).images[0]",
      right: "At a low value, it keeps the result close to the input image",
      wrong: ["It sets the output to be 30 steps long", "It makes the output ignore the input image", "It lowers the guidance scale to 0.3"],
      tier: 2, topic: "diffusers",
      why: "Low strength adds little noise, so the input survives.",
    },
    {
      q: "In the DDPM forward process, which expression gives the noised image at timestep t?",
      code: "x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * eps",
      right: "A weighted sum of the clean image and Gaussian noise",
      wrong: ["A product of the clean image with a random mask", "The average of all previous timesteps", "The text embedding added to the clean image"],
      tier: 4, topic: "Theory",
      why: "The formula blends signal and noise by the schedule.",
    },
    {
      q: "In this formula, what happens to the clean-image coefficient as t approaches the end of the schedule?",
      code: "x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * eps",
      right: "It approaches zero so the sample is almost pure noise",
      wrong: ["It approaches one so the image is perfect", "It becomes negative", "It stays constant"],
      tier: 4, topic: "Theory",
      why: "alpha_bar_t falls toward zero by the final step.",
    },
    {
      q: "How is classifier-free guidance computed from the two predictions?",
      code: "eps = eps_uncond + w * (eps_cond - eps_uncond)",
      right: "By moving from the unconditional prediction toward the conditional one, scaled by w",
      wrong: ["By averaging the two predictions evenly", "By subtracting the conditional prediction from the image", "By multiplying the prediction by the seed"],
      tier: 3, topic: "Theory",
      why: "The scale w extrapolates along the conditional direction.",
    },
    {
      q: "What does a guidance scale of exactly 1 imply in the CFG formula?",
      code: "eps = eps_uncond + w * (eps_cond - eps_uncond)",
      right: "The result equals the conditional prediction with no extra amplification",
      wrong: ["The result equals the unconditional prediction", "The prediction is zero", "Sampling runs for one step"],
      tier: 4, topic: "Theory",
      why: "With w equal to one the expression reduces to eps_cond.",
    },
    {
      q: "A 512x512 image is encoded by a VAE with downsampling factor 8 per side. What spatial size is the latent?",
      right: "64x64",
      wrong: ["8x8", "128x128", "256x256"],
      tier: 2, topic: "Latent space",
      why: "512 divided by 8 is 64 per side.",
    },
    {
      q: "A 768x512 image is encoded with a downsampling factor of 8. What is the latent height and width?",
      right: "Height 64 and width 96",
      wrong: ["Height 96 and width 64", "Height 512 and width 768", "Height 8 and width 12"],
      tier: 3, topic: "Latent space",
      why: "512/8 is 64 and 768/8 is 96.",
    },
    {
      q: "Why does latent diffusion run faster than pixel-space diffusion at the same image size?",
      right: "The denoiser works on a much smaller latent array than the full pixel grid",
      wrong: ["It uses fewer text tokens", "It skips the noise schedule", "It never needs a decoder"],
      tier: 2, topic: "Latent space",
      why: "Compression by the VAE shrinks the work per step.",
    },
    {
      q: "You raise the guidance scale from 7 to 20 and get burnt, harsh images. What is the best adjustment?",
      right: "Lower the guidance scale to a moderate value",
      wrong: ["Raise the scale further for sharper results", "Set the seed to zero", "Increase the batch size"],
      tier: 2, topic: "Settings",
      why: "Excess guidance oversaturates.",
    },
    {
      q: "Two runs share a prompt and seed but use Euler ancestral with 20 steps and 40 steps. What should you expect?",
      right: "Noticeably different images because new noise is injected each step",
      wrong: ["Identical images", "Identical images except for brightness", "An error for mismatched steps"],
      tier: 3, topic: "Samplers",
      why: "Ancestral samplers do not converge to one image.",
    },
    {
      q: "Two runs share a prompt and seed and use a deterministic sampler at 30 and 50 steps. What do you expect?",
      right: "Similar images that differ mainly in fine detail",
      wrong: ["Completely unrelated compositions", "Black images", "Two copies of the same pixels"],
      tier: 3, topic: "Samplers",
      why: "Deterministic samplers converge toward a similar result.",
    },
    {
      q: "You need to keep the exact pose of a person from a reference photo but change their clothing. Which control input is best?",
      right: "OpenPose skeleton",
      wrong: ["Tile control", "A semantic segmentation of sky and water", "A higher seed"],
      tier: 2, topic: "ControlNet",
      why: "Pose keypoints fix the body's configuration.",
    },
    {
      q: "You want to keep the outline of a product while re-rendering it in a new material. Which control input fits?",
      right: "Canny edge map",
      wrong: ["OpenPose skeleton", "Prompt weighting", "Clip skip"],
      tier: 2, topic: "ControlNet",
      why: "Edges preserve contours.",
    },
    {
      q: "A quick pencil doodle is your only layout guide. Which control type tolerates it best?",
      right: "Scribble input",
      wrong: ["A precise depth map", "A normal map", "Semantic segmentation"],
      tier: 3, topic: "ControlNet",
      why: "Scribble control is built for rough lines.",
    },
    {
      q: "After adding ControlNet at full strength, the image is rigid and ignores the prompt. What helps?",
      right: "Lower the conditioning strength so the prompt has more influence",
      wrong: ["Raise conditioning strength", "Increase the number of steps to 500", "Swap to a different VAE"],
      tier: 3, topic: "ControlNet",
      why: "High conditioning strength over-constrains the result.",
    },
    {
      q: "You want to teach the model a new subject using a file only a few kilobytes large. Which method fits?",
      right: "Textual inversion",
      wrong: ["Full fine-tuning", "Merging two checkpoints", "A tiled upscale"],
      tier: 3, topic: "Customization",
      why: "Textual inversion stores only new embeddings.",
    },
    {
      q: "A LoRA applied at weight 1.5 looks distorted and burnt. What should you try first?",
      right: "Lower the LoRA weight toward its recommended value",
      wrong: ["Raise the weight to 3", "Delete the VAE", "Switch to batch size 1"],
      tier: 3, topic: "Customization",
      why: "Excess adapter strength overbakes the output.",
    },
    {
      q: "Which statement correctly contrasts a checkpoint and a LoRA?",
      right: "A checkpoint holds the full weights; a LoRA stores small low-rank updates applied to a base model",
      wrong: ["A LoRA holds the full weights; a checkpoint is a small patch", "They are identical files with different names", "A LoRA replaces the text encoder only"],
      tier: 2, topic: "Customization",
      why: "LoRAs are compact adapters.",
    },
    {
      q: "Your output looks gray and washed out with a downloaded checkpoint. What is the most likely fix?",
      right: "Load the correct VAE for that checkpoint",
      wrong: ["Double the number of steps", "Lower the batch size", "Use a longer prompt"],
      tier: 3, topic: "Problems",
      why: "A mismatched VAE causes flat colors.",
    },
    {
      q: "A 1024x2048 tall image from a model trained at 512x512 shows two stacked heads. What fixes this best?",
      right: "Generate at a lower resolution and then upscale with a second pass such as hires fix",
      wrong: ["Raise the guidance scale", "Increase the seed value", "Lower the batch size to zero"],
      tier: 3, topic: "Problems",
      why: "Directly generating far above training size duplicates subjects.",
    },
    {
      q: "A long prompt is ignored after its first part in a classic Stable Diffusion setup. Why?",
      right: "The text encoder truncates prompts beyond its token limit",
      wrong: ["The sampler rejects commas", "The seed limits prompt length", "The VAE cannot read text"],
      tier: 3, topic: "Problems",
      why: "CLIP-based encoders have a token limit.",
    },
    {
      q: "A server crashes with a CUDA out-of-memory error at 2048x2048. Which change helps most?",
      right: "Reduce the resolution or enable offloading or tiling",
      wrong: ["Increase the seed", "Add a negative prompt", "Raise the guidance scale"],
      tier: 2, topic: "Problems",
      why: "Memory use scales with pixel count.",
    },
    {
      q: "For a downloaded model file, which format is safer to load?",
      right: "safetensors, because it does not execute arbitrary code on load",
      wrong: ["A pickle-based file, because it is always scanned", "Any format, since loading is passive", "A zip with an embedded script"],
      tier: 2, topic: "Safety",
      why: "Pickle files can execute code; safetensors cannot.",
    },
    {
      q: "A teammate shares a seed and prompt but gets a slightly different image on a different GPU model. What explains it?",
      right: "Floating-point and kernel differences across hardware",
      wrong: ["Seeds expire after a day", "The negative prompt is hidden", "The prompt is re-encoded by the VAE"],
      tier: 5, topic: "Problems",
      why: "Exact reproducibility holds only for identical setups.",
    },
    {
      q: "In image-to-image mode, which denoising strength gives the output that is closest to the input?",
      right: "A low value such as 0.2",
      wrong: ["A value near 1.0", "A value of exactly 7.5", "A value of 50"],
      tier: 2, topic: "Settings",
      why: "Low strength adds little noise and starts late.",
    },
    {
      q: "You edit a hand in an image and a hard seam shows around the area. Which setting helps blend it?",
      right: "Increase mask blur slightly",
      wrong: ["Raise the guidance scale to the maximum", "Switch to a larger batch", "Lower the VAE precision"],
      tier: 3, topic: "Tasks",
      why: "Softer mask edges reduce seams.",
    },
    {
      q: "In ComfyUI, what is a saved workflow?",
      right: "A graph of connected nodes and settings that can be reloaded to repeat a pipeline",
      wrong: ["A compressed copy of the model weights", "A list of banned words for the safety checker", "The text of the last prompt only"],
      tier: 2, topic: "Tools",
      why: "Workflows capture the whole pipeline.",
    },
    {
      q: "Which statement about AUTOMATIC1111 and ComfyUI is correct?",
      right: "AUTOMATIC1111 is form-based with tabs; ComfyUI exposes the pipeline as a node graph",
      wrong: ["Both are Python libraries without interfaces", "ComfyUI is form-based; AUTOMATIC1111 is node-based", "Neither can load a checkpoint"],
      tier: 2, topic: "Tools",
      why: "The interfaces differ fundamentally.",
    },
    {
      q: "Before installing a community custom node or extension, what is the sensible precaution?",
      right: "Review its source and reputation, because it runs code on your machine",
      wrong: ["Nothing, because extensions are sandboxed", "Only check its icon", "Lower the guidance scale"],
      tier: 3, topic: "Tools",
      why: "Extensions execute code with your permissions.",
    },
    {
      q: "A few-step distilled model gives washed-out results when run with the default guidance scale of a standard model. What is the likely fix?",
      right: "Use the low or disabled guidance scale recommended for that model",
      wrong: ["Raise guidance to the maximum", "Switch to Euler ancestral", "Increase steps to 500"],
      tier: 5, topic: "Samplers",
      why: "Distilled models usually bake guidance in.",
    },
    {
      q: "A checkpoint was trained with v-prediction but is sampled as if it predicts noise. What is likely to happen?",
      right: "Poor or corrupted results because the prediction type does not match",
      wrong: ["Perfect images with faster sampling", "The seed is ignored but quality is fine", "Only the VAE colors change"],
      tier: 4, topic: "Theory",
      why: "Samplers must interpret the output the way it was trained.",
    },
    {
      q: "Which statement about the seed is correct?",
      right: "It fixes the initial noise; changing the prompt with the same seed often keeps a similar layout",
      wrong: ["It stores the prompt", "It chooses the sampler automatically", "It sets the number of steps"],
      tier: 1, topic: "Settings",
      why: "The seed sets the starting noise only.",
    },
    {
      q: "Which of these best explains why diffusion generation needs many network evaluations?",
      right: "Each step removes only part of the noise, refining the image gradually",
      wrong: ["Each step translates one prompt word", "The VAE must be retrained each step", "The text encoder is called once per pixel"],
      tier: 1, topic: "Theory",
      why: "Sampling is iterative denoising.",
    },
    {
      q: "A model should be able to depict a person it was never trained on, using about ten photos. Which approach is common?",
      right: "DreamBooth-style fine-tuning or a LoRA trained on those photos",
      wrong: ["Raising the guidance scale", "A bigger batch size at inference", "A tiled upscale"],
      tier: 3, topic: "Customization",
      why: "Subject-specific training binds the person to a token.",
    },
    {
      q: "Which is the right order of components in a basic text-to-image latent diffusion run?",
      right: "Text encoder, then repeated denoising in latent space, then VAE decoder",
      wrong: ["VAE decoder, then denoiser, then text encoder", "Denoiser, then text encoder, then safety filter only", "Text encoder only"],
      tier: 2, topic: "Architecture",
      why: "Prompt conditioning, iterative denoising, then decoding.",
    },
    {
      q: "A prompt contains a named person's face and you must decline unsafe uses. Which layered approach is the most robust?",
      right: "Prompt filtering plus an output classifier plus clear usage policy",
      wrong: ["Only lowering the guidance scale", "Only a longer negative prompt", "Only a different sampler"],
      tier: 4, topic: "Safety",
      why: "Single filters can be bypassed; layered controls are stronger.",
    },
    {
      q: "What does the weighted prompt text do in this interface?",
      code: "a cat (wearing a hat:1.4), studio photo",
      right: "It emphasizes the hat phrase more than the rest of the prompt",
      wrong: ["It removes the hat from the image", "It repeats the prompt 1.4 times", "It sets the seed to 1.4"],
      tier: 3, topic: "Settings",
      why: "Parenthesized weights above 1 increase emphasis.",
    },
  ],
  calc: [],
};
export default spec;
