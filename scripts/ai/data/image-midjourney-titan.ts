import type { TrackSpec } from "../types";

const spec: TrackSpec = {
  slug: "image-midjourney-titan",
  name: "AI Image Generation Tools: Novice to Titan",
  description: "Prompting and controlling Midjourney-style, DALL·E-style and Firefly-style image tools: prompt anatomy, parameters, editing, consistency, licensing and AI video basics.",
  roles: "designer,developer,manager",
  groups: {
    tool: "image or video generation approach",
    element: "prompt element",
    param: "image prompt parameter",
    edit: "image editing operation",
    consistency: "consistency technique",
    legal: "licensing or policy topic",
    workflow: "designer workflow step",
    failure: "common image generation failure",
    video: "AI video concept",
    comp: "composition or camera term",
    light: "lighting term",
  },
  cards: [
    // ---------- tool ----------
    {
      group: "tool", subject: "Midjourney", tier: 1,
      says: [
        "is a hosted image generator driven by text prompts and trailing parameters",
        "has no downloadable open weights for users to run locally",
        "was first operated through chat commands such as /imagine",
      ],
      use: "want a polished, stylized look from a hosted service without running any model yourself",
      not: ["runs entirely on the user's own graphics card"],
      like: ["a DALL·E-style tool", "a Firefly-style tool"],
    },
    {
      group: "tool", subject: "a DALL·E-style tool", tier: 1,
      says: [
        "responds well to full natural-language sentences instead of keyword lists",
        "is commonly reached through a chat assistant or a developer API",
        "lets you refine a result by describing the change in plain conversation",
      ],
      use: "want to iterate on an image by chatting about what to change",
      not: ["requires double-hyphen parameters at the end of every request"],
      like: ["Midjourney", "a Firefly-style tool"],
    },
    {
      group: "tool", subject: "a Firefly-style tool", tier: 2,
      says: [
        "emphasizes training on licensed or permissioned content for commercial comfort",
        "is built into design software as features such as generative fill",
        "attaches provenance metadata to generated results",
      ],
      use: "need generative edits inside your existing layered design file",
      not: ["is trained only on images scraped without any licensing review"],
      like: ["Midjourney", "a DALL·E-style tool"],
    },
    {
      group: "tool", subject: "an open-weights model", tier: 3,
      says: [
        "can be downloaded and run on your own hardware",
        "can be fine-tuned or extended by the user with adapters",
        "leaves safety filtering largely up to whoever runs it",
      ],
      use: "need full control, offline generation and custom training",
      not: ["can only be used through the vendor's website"],
      like: ["Midjourney"],
    },
    {
      group: "tool", subject: "Text-to-image generation", tier: 1,
      says: [
        "creates a brand-new picture from a written description alone",
        "starts from random noise that is guided toward the prompt",
        "produces different results for the same prompt when the seed changes",
      ],
      use: "have no source picture and only an idea in words",
      like: ["Image-to-image generation"],
    },
    {
      group: "tool", subject: "Image-to-image generation", tier: 2,
      says: [
        "uses an existing picture as the starting point for a new one",
        "keeps the rough layout or colors of the input while restyling it",
        "can be steered by how strongly the input is allowed to change",
      ],
      use: "have a rough sketch or photo whose structure must carry over",
      not: ["ignores the uploaded picture and works from text only"],
      like: ["Text-to-image generation", "Inpainting"],
    },
    {
      group: "tool", subject: "Text-to-video generation", tier: 3,
      says: [
        "turns a written description into a short moving clip",
        "must keep subjects coherent across many consecutive frames",
        "usually yields brief clips rather than long continuous scenes",
      ],
      use: "need a short animated shot from a description with no footage",
      like: ["Image-to-video generation"],
    },
    {
      group: "tool", subject: "Image-to-video generation", tier: 3,
      says: [
        "animates a still image into a short clip",
        "treats the still as the first frame or visual anchor of the motion",
        "preserves the look of a chosen key image better than text alone",
      ],
      use: "have an approved still and want it to move without changing its look",
      like: ["Text-to-video generation"],
    },
    {
      group: "tool", subject: "an AI upscaler", tier: 2,
      says: [
        "increases pixel dimensions while synthesizing plausible fine detail",
        "can invent texture that was not in the source",
        "is used after a composition has already been approved",
      ],
      use: "need a print-sized file from a small generated image",
      not: ["recovers the exact original detail that was lost"],
    },
    {
      group: "tool", subject: "a vector generator", tier: 4,
      says: [
        "outputs scalable paths and shapes instead of a grid of pixels",
        "yields artwork that stays sharp at any size",
        "produces layers a designer can recolor and edit as shapes",
      ],
      use: "need a logo-like illustration that scales from icon to billboard",
      not: ["is the same as exporting a raster image at a bigger size"],
    },

    // ---------- element ----------
    {
      group: "element", subject: "The subject", tier: 1,
      says: [
        "states the main thing or person the image is about",
        "is usually placed first because early words carry strong weight",
        "should be concrete, such as a specific object with an action",
      ],
      use: "need the main focus of the picture to be unmistakable",
      not: ["is optional because style words alone define the content"],
      like: ["The setting"],
    },
    {
      group: "element", subject: "Medium and style", tier: 1,
      says: [
        "names the kind of artwork, such as oil painting, photograph or 3D render",
        "sets the overall rendering look more than any other single phrase",
        "can pair a medium with a movement or era for a more specific result",
      ],
      use: "want a watercolor illustration instead of a photo",
      like: ["The subject"],
    },
    {
      group: "element", subject: "The setting", tier: 2,
      says: [
        "describes the environment or background around the subject",
        "gives context such as a location, weather or time of day",
        "keeps the subject from floating in an empty, undefined space",
      ],
      use: "want the subject placed in a specific location like a rainy street",
      like: ["The subject"],
    },
    {
      group: "element", subject: "Lighting description", tier: 2,
      says: [
        "tells the generator where light comes from and how hard or soft it is",
        "changes mood and depth without changing the subject",
        "is one of the strongest levers for making a result look photographic",
      ],
      use: "want the same scene to feel warm and dramatic rather than flat",
      like: ["Mood"],
    },
    {
      group: "element", subject: "Composition cue", tier: 2,
      says: [
        "controls framing, such as close-up, wide shot or overhead view",
        "decides how the subject sits within the frame",
        "can be combined with an aspect ratio to match a layout",
      ],
      use: "need the subject framed for a banner with empty space for text",
      like: ["Camera and lens cue"],
    },
    {
      group: "element", subject: "Camera and lens cue", tier: 3,
      says: [
        "borrows photography terms such as focal length, aperture and film stock",
        "influences depth of field and perspective distortion in the result",
        "pushes the look toward a photograph rather than an illustration",
      ],
      use: "want a shallow-focus portrait with a creamy blurred background",
      not: ["makes the tool simulate real physical camera hardware settings exactly"],
      like: ["Composition cue"],
    },
    {
      group: "element", subject: "Color palette cue", tier: 2,
      says: [
        "names the dominant colors or a restricted scheme for the image",
        "helps keep a set of images visually coherent",
        "can reference a mood such as muted earth tones or high-contrast neon",
      ],
      use: "need results that match a brand color scheme",
      like: ["Mood"],
    },
    {
      group: "element", subject: "Mood", tier: 2,
      says: [
        "sets the emotional tone, such as serene, eerie or joyful",
        "works by nudging color, lighting and expression together",
        "is subjective, so different tools interpret it differently",
      ],
      use: "want the picture to feel calm and nostalgic",
      like: ["Lighting description", "Color palette cue"],
    },
    {
      group: "element", subject: "Detail modifiers", tier: 3,
      says: [
        "add specific texture, material or small-scale features to a scene",
        "work better when concrete, such as brushed steel or frayed linen",
        "lose effect when piled up as vague words like amazing or ultra",
      ],
      use: "need a recognizable material finish on a product shot",
      not: ["always improve quality when many are stacked"],
    },
    {
      group: "element", subject: "Prompt ordering", tier: 3,
      says: [
        "gives earlier terms more influence than later ones in many generators",
        "suggests leading with subject, then style, then lighting and extras",
        "matters less in tools that read full sentences than in keyword-style tools",
      ],
      use: "find that a minor background detail keeps dominating the result",
      not: ["has no effect on any image generator"],
    },
    {
      group: "element", subject: "Prompt weighting", tier: 4,
      says: [
        "lets you make one part of a prompt count more or less than another",
        "can split a prompt into parts that are blended by relative weights",
        "helps when a secondary concept is overpowering the main subject",
      ],
      use: "need one concept emphasized and another toned down",
      not: ["is identical to raising the chaos value"],
    },
    {
      group: "element", subject: "Natural-language versus keyword prompts", tier: 3,
      says: [
        "differ in whether the tool prefers whole sentences or comma-separated phrases",
        "should match the style a particular generator was tuned for",
        "can be tested by writing the same idea both ways and comparing",
      ],
      like: ["Prompt ordering"],
    },

    // ---------- param ----------
    {
      group: "param", subject: "Aspect ratio", tier: 1,
      says: [
        "sets the width-to-height proportion of the generated image",
        "is written as two numbers, such as 16:9 or 4:5",
        "should be chosen to match the final placement before generating",
      ],
      use: "need a tall mobile story image instead of a square",
      not: ["sets the total number of pixels in the file"],
    },
    {
      group: "param", subject: "Stylize", tier: 2,
      says: [
        "controls how strongly the tool's own aesthetic is applied to your prompt",
        "pushes results toward artistic polish as the value rises",
        "keeps results closer to the literal wording as the value falls",
      ],
      use: "want more literal adherence rather than the tool's artistic flair",
      not: ["determines how many images appear in a grid"],
      like: ["Chaos"],
    },
    {
      group: "param", subject: "Chaos", tier: 2,
      says: [
        "increases how different the initial results are from one another",
        "is useful early on when exploring wide-ranging ideas",
        "makes the four-image grid less uniform as it rises",
      ],
      use: "want a surprising spread of concepts from one prompt",
      not: ["sharpens detail and removes noise from a finished image"],
      like: ["Stylize", "Weird"],
    },
    {
      group: "param", subject: "Seed", tier: 2,
      says: [
        "is the number that fixes the starting noise of a generation",
        "gives more repeatable results when the prompt and settings stay the same",
        "lets you change only one prompt word and compare the difference",
      ],
      use: "want to vary one word while keeping the rest of the composition similar",
      not: ["guarantees an identical image even after the prompt is rewritten"],
    },
    {
      group: "param", subject: "Negative prompting", tier: 3,
      says: [
        "tells the generator what to leave out of the image",
        "is written with the no parameter in Midjourney-style prompts",
        "can fail when the unwanted word is also mentioned in the main prompt",
      ],
      use: "keep unwanted objects like text or people out of a background plate",
      not: ["works reliably as a way to switch off all copyright issues"],
    },
    {
      group: "param", subject: "Tile", tier: 3,
      says: [
        "produces images whose edges repeat seamlessly when placed side by side",
        "is aimed at patterns, textures and wallpapers",
        "does not guarantee the pattern looks good at every scale",
      ],
      use: "need a seamless fabric or background pattern",
      not: ["upscales the image by a factor of two"],
    },
    {
      group: "param", subject: "Weird", tier: 4,
      says: [
        "adds unconventional, quirky qualities to the aesthetic",
        "is separate from how varied the four starting results are",
        "can break an otherwise sensible brief when set too high",
      ],
      use: "want an offbeat, experimental look beyond the usual style",
      like: ["Chaos", "Stylize"],
    },
    {
      group: "param", subject: "Stop", tier: 4,
      says: [
        "ends the generation process partway through at a chosen percentage",
        "produces a softer, less finished image when set low",
        "is used for loose, abstract or painterly effects",
      ],
      use: "want a deliberately unfinished, hazy rendering",
      not: ["cancels a job that has already finished"],
    },
    {
      group: "param", subject: "Image weight", tier: 4,
      says: [
        "sets how much an uploaded image prompt influences the result relative to the text",
        "leans toward the picture's look as the value rises",
        "applies only when an image is included in the prompt",
      ],
      use: "need an uploaded reference photo to dominate the text instructions",
      like: ["Image prompt"],
    },
    {
      group: "param", subject: "Version flag", tier: 3,
      says: [
        "selects which underlying model generation renders the job",
        "changes how literally prompts are read and how images look",
        "should be recorded so results can be reproduced later",
      ],
      use: "must reproduce an older look from a past project",
      not: ["only changes the file format of the download"],
    },
    {
      group: "param", subject: "Parameter syntax", tier: 2,
      says: [
        "places parameters after the prompt text, each starting with two hyphens",
        "treats everything before the first parameter as the descriptive prompt",
        "is ignored if the flag is typed in the middle of a sentence incorrectly",
      ],
      use: "keep wondering why a trailing flag has no effect on the image",
      not: ["goes at the very start of the prompt before any words"],
    },
    {
      group: "param", subject: "Repeat", tier: 5,
      says: [
        "runs the same prompt multiple times in one command",
        "saves retyping when sampling many candidates of one concept",
        "consumes generation credits for every run it triggers",
      ],
      use: "want many candidates of one prompt without resubmitting it",
      like: ["Seed"],
    },

    // ---------- edit ----------
    {
      group: "edit", subject: "Upscaling", tier: 1,
      says: [
        "makes an approved image larger and sharper for final use",
        "should come after the composition is chosen, not before",
        "can subtly alter fine detail such as faces and textures",
      ],
      use: "need a larger file for print from a chosen candidate",
      not: ["restores a prompt that was lost"],
    },
    {
      group: "edit", subject: "Variations", tier: 1,
      says: [
        "generate new images that resemble a chosen result",
        "range from subtle tweaks to strong reinterpretations",
        "are a quick way to explore around a nearly right image",
      ],
      use: "like one result and want several close alternatives",
      not: ["always produce the exact same image again"],
      like: ["Reroll"],
    },
    {
      group: "edit", subject: "Inpainting", tier: 2,
      says: [
        "regenerates only a masked region of an existing image",
        "leaves the unmasked pixels as they were",
        "is the tool for fixing a bad hand or swapping a single object",
      ],
      use: "need to replace one object without touching the rest",
      not: ["extends the canvas beyond its original borders"],
      like: ["Outpainting", "Generative fill"],
    },
    {
      group: "edit", subject: "Outpainting", tier: 2,
      says: [
        "extends an image beyond its original borders",
        "invents new content that matches the existing edges",
        "is useful for converting a square image into a wide banner",
      ],
      use: "need a wider version of an image to fit a hero banner",
      not: ["repaints only a selected region inside the frame"],
      like: ["Inpainting", "Zoom out"],
    },
    {
      group: "edit", subject: "Reroll", tier: 1,
      says: [
        "runs the same prompt again to get a fresh set of results",
        "gives new compositions because the random start changes",
        "is cheaper in effort than rewriting when the prompt is already good",
      ],
      use: "like the prompt but not any of the four results",
      like: ["Variations"],
    },
    {
      group: "edit", subject: "Background removal", tier: 2,
      says: [
        "separates the subject from its surroundings",
        "outputs a cutout that can be placed on any new background",
        "can struggle with hair, glass and semi-transparent edges",
      ],
      use: "need a product cutout to place on a brand-colored layout",
      not: ["generates a new subject to replace the old one"],
    },
    {
      group: "edit", subject: "Generative fill", tier: 3,
      says: [
        "fills a selected area with new content from a text description",
        "works on layers inside design software as a non-destructive edit",
        "can remove an object by filling the area with matching background",
      ],
      use: "need to remove a stray object inside a layered design file",
      like: ["Inpainting"],
    },
    {
      group: "edit", subject: "Mask", tier: 3,
      says: [
        "marks which pixels an edit may change and which it must protect",
        "can be painted by hand or created from a subject selection",
        "affects edge blending, so a soft edge hides seams",
      ],
      use: "need to protect a logo while changing everything around it",
      not: ["is the generated result itself"],
    },
    {
      group: "edit", subject: "Edit strength", tier: 3,
      says: [
        "sets how far the output may depart from the input image",
        "keeps results near the original at low values",
        "gives the prompt more freedom to reinterpret at high values",
      ],
      use: "want a light restyle that still keeps the original photo recognizable",
      not: ["sets the file resolution of the output"],
      like: ["Image-to-image generation"],
    },
    {
      group: "edit", subject: "Zoom out", tier: 4,
      says: [
        "pulls the virtual camera back and fills in the newly revealed surroundings",
        "extends scene context in all directions at once",
        "is a quick way to turn a tight crop into a wider establishing shot",
      ],
      use: "need to reveal more of the environment around the original subject",
      like: ["Outpainting"],
    },
    {
      group: "edit", subject: "Face restoration", tier: 4,
      says: [
        "repairs distorted or low-detail faces in a generated image",
        "can make faces look smoother or more generic than intended",
        "is a cleanup step applied after the main generation",
      ],
      use: "find tiny faces in a group scene look mushy",
      not: ["changes the identity of a person to a famous one"],
    },

    // ---------- consistency ----------
    {
      group: "consistency", subject: "Seed reuse for continuity", tier: 3,
      says: [
        "keeps the starting noise identical across related generations",
        "stabilizes composition when only a few prompt words are changed",
        "does not by itself keep a character identical when the scene changes much",
      ],
      use: "want a series of images sharing the same underlying layout",
      not: ["locks a character's face across any new prompt"],
    },
    {
      group: "consistency", subject: "Style reference", tier: 3,
      says: [
        "borrows the visual style of a supplied image rather than its content",
        "carries over color, texture and rendering approach to new subjects",
        "helps keep a campaign's artwork looking like one family",
      ],
      use: "need new images that match the look of an existing illustration set",
      not: ["copies the objects shown in the reference picture"],
      like: ["Character reference"],
    },
    {
      group: "consistency", subject: "Character reference", tier: 3,
      says: [
        "keeps a character's recognizable features across different scenes",
        "uses a supplied image of the character as the identity anchor",
        "works best on a clearly shown, generated character rather than a messy photo",
      ],
      use: "need the same mascot to appear in several different scenes",
      not: ["transfers only the color palette of the reference"],
      like: ["Style reference"],
    },
    {
      group: "consistency", subject: "Character sheet", tier: 3,
      says: [
        "shows one character from several angles and expressions in a single image",
        "provides a reference to reuse in later generations",
        "gives animators or illustrators a stable design to follow",
      ],
      use: "want a reusable turnaround of a new character before building scenes",
      like: ["Character reference"],
    },
    {
      group: "consistency", subject: "Prompt template", tier: 2,
      says: [
        "fixes the shared wording and swaps only a few variable parts",
        "keeps style, lighting and camera phrasing identical across a set",
        "makes team output more uniform and easier to review",
      ],
      use: "need twenty product images that all look like they belong together",
      not: ["guarantees pixel-identical images each time"],
    },
    {
      group: "consistency", subject: "Moodboard reference set", tier: 3,
      says: [
        "bundles several images that together define an overall look",
        "guides new generations toward the collective aesthetic",
        "reduces the need to describe a style in many words",
      ],
      use: "need to capture a client's vague aesthetic as a repeatable guide",
      like: ["Style reference"],
    },
    {
      group: "consistency", subject: "Locked descriptors", tier: 2,
      says: [
        "repeat exact phrases for a character's hair, clothing and age in every prompt",
        "reduce drift in details like outfit colors between images",
        "work better with a reference image than words alone",
      ],
      use: "need the same character wording reused verbatim for each new scene",
      not: ["fully guarantee identical faces"],
    },
    {
      group: "consistency", subject: "A custom fine-tuned model", tier: 5,
      says: [
        "is trained on a set of images of a specific subject or style",
        "can reproduce a brand mascot or product more reliably than prompting",
        "requires owning or licensing all the training images used",
      ],
      use: "need a product or mascot rendered faithfully across hundreds of images",
      not: ["is created by typing a longer prompt"],
    },
    {
      group: "consistency", subject: "Image prompt", tier: 3,
      says: [
        "adds a picture to the text prompt as guidance",
        "can influence subject, color and layout",
        "is weaker as an identity lock than a dedicated character reference",
      ],
      use: "want to point the generator at an example picture while still writing text",
      like: ["Image weight", "Character reference"],
    },
    {
      group: "consistency", subject: "A fixed color palette", tier: 2,
      says: [
        "restricts every image in a set to the same named colors",
        "supports brand fit when combined with a style reference",
        "is stated in the prompt and checked afterward against swatches",
      ],
      use: "need generated artwork to stay within brand colors",
    },

    // ---------- legal ----------
    {
      group: "legal", subject: "Commercial-use terms", tier: 1,
      says: [
        "are defined by each tool's terms of service and often depend on the plan",
        "must be read before using generated images in client or paid work",
        "can differ between a free tier and a paid tier",
      ],
      use: "are about to use a generated image in a paid client campaign",
      not: ["are identical across all image generators"],
    },
    {
      group: "legal", subject: "Training-data copyright", tier: 3,
      says: [
        "concerns whether copyrighted images were used to train a model without permission",
        "is the subject of ongoing disputes and court cases",
        "is why some vendors advertise licensed or permissioned training sets",
      ],
      use: "need to judge how defensible a vendor's training data claims are",
      not: ["has been settled in the same way worldwide"],
    },
    {
      group: "legal", subject: "Human authorship requirement", tier: 4,
      says: [
        "is a basis on which some copyright offices decline to protect purely machine-generated output",
        "makes meaningful human creative contribution relevant to ownership",
        "can mean competitors may reuse an unmodified generated image",
      ],
      use: "want to know whether a raw generated image can be exclusively owned",
      not: ["is the same rule in every country"],
    },
    {
      group: "legal", subject: "Content policy", tier: 1,
      says: [
        "lists what a tool refuses to generate, such as certain violent or sexual content",
        "is enforced by prompt and image filters and by account action",
        "applies even to work intended for a legitimate client",
      ],
      use: "find that a prompt is blocked or an account is warned",
      not: ["can be turned off by paying for a higher plan"],
    },
    {
      group: "legal", subject: "Content credentials", tier: 3,
      says: [
        "are provenance metadata that record how an image was made",
        "can state that an image was generated or edited by AI",
        "may be lost when an image is screenshotted or re-encoded",
      ],
      use: "want a verifiable record that a file is AI-generated",
      not: ["prevent anyone from copying the image"],
    },
    {
      group: "legal", subject: "Likeness rights", tier: 3,
      says: [
        "protect a real person's image and identity from unauthorized commercial use",
        "make generating a recognizable real person for ads risky without consent",
        "also underpin concerns about deepfakes",
      ],
      use: "are asked to put a real celebrity's face on an ad",
      not: ["disappear when an image is labeled as AI-generated"],
    },
    {
      group: "legal", subject: "Trademark and logo risk", tier: 3,
      says: [
        "arises when generated images include brand marks or recognizable characters",
        "can occur unintentionally if a prompt names a brand or franchise",
        "calls for a human review before publishing client work",
      ],
      use: "find a competitor's logo appears in the background of a generated scene",
      like: ["Artist-style imitation"],
    },
    {
      group: "legal", subject: "Artist-style imitation", tier: 3,
      says: [
        "means prompting with a living artist's name to copy their look",
        "raises ethical and reputational concerns even where law is unsettled",
        "is better replaced by describing visual traits in your own words",
      ],
      use: "are tempted to name a working illustrator to copy their style in a pitch",
      like: ["Trademark and logo risk"],
    },
    {
      group: "legal", subject: "Licensed-training claims", tier: 4,
      says: [
        "should be verified through vendor documentation and contract terms",
        "may come with indemnity only for certain plans or enterprise customers",
        "do not remove your own responsibility to review outputs",
      ],
      use: "need a procurement answer about legal exposure from a vendor",
      like: ["Commercial-use terms"],
    },
    {
      group: "legal", subject: "Client disclosure", tier: 2,
      says: [
        "means telling a client when AI tools were used in the deliverable",
        "avoids disputes when contracts require original or human-made work",
        "should be written into the project agreement",
      ],
      use: "are delivering AI-assisted work to a client with an originality clause",
    },
    {
      group: "legal", subject: "Upload confidentiality", tier: 3,
      says: [
        "concerns what happens to unreleased client images sent to a cloud tool",
        "depends on the tool's data-retention and training settings",
        "is a reason to read the privacy terms before uploading under NDA",
      ],
      use: "need to put an unreleased product photo into a hosted generator",
      not: ["is guaranteed by default in every tool"],
    },
    {
      group: "legal", subject: "Public gallery visibility", tier: 3,
      says: [
        "determines whether other users can see your generations by default",
        "may be changeable only on certain plans",
        "matters when working on unannounced or confidential concepts",
      ],
      use: "worry that prompts for a stealth project are visible to other subscribers",
    },

    // ---------- workflow ----------
    {
      group: "workflow", subject: "Moodboarding", tier: 1,
      says: [
        "gathers visual references to define a direction before generating",
        "can combine human-made and generated images",
        "aligns a client and a designer before detailed work starts",
      ],
      use: "need agreement on a look before spending time on finals",
    },
    {
      group: "workflow", subject: "Rapid ideation", tier: 1,
      says: [
        "uses fast, cheap generations to explore many concepts early",
        "treats early outputs as disposable sketches",
        "benefits from high chaos and loose prompts",
      ],
      use: "have to show ten very different directions by the end of the day",
      not: ["demands print-ready quality on the first pass"],
    },
    {
      group: "workflow", subject: "Iterative refinement", tier: 2,
      says: [
        "changes one variable at a time between runs",
        "makes it clear which prompt edit caused which change",
        "narrows from broad concepts toward a single polished image",
      ],
      use: "want to learn which word is causing an unwanted result",
    },
    {
      group: "workflow", subject: "A shared prompt library", tier: 2,
      says: [
        "stores tested prompts and parameters for the whole team to reuse",
        "records version flags and seeds so results can be repeated",
        "saves time and keeps team output on-brand",
      ],
      use: "want colleagues to reuse successful prompts instead of starting over",
    },
    {
      group: "workflow", subject: "Hybrid retouching", tier: 3,
      says: [
        "polishes a generated image in conventional design software",
        "fixes details like text, logos and hands by hand",
        "adds human authorship that can strengthen a rights position",
      ],
      use: "have a near-final image with a few flawed areas",
      not: ["is unnecessary because generators produce finished layouts"],
    },
    {
      group: "workflow", subject: "Asset vectorization", tier: 3,
      says: [
        "converts a raster result into scalable shapes",
        "is needed when artwork must work at every size",
        "usually needs cleanup of stray anchor points",
      ],
      use: "need a logo-like generated mark to scale to signage",
      like: ["Hybrid retouching"],
    },
    {
      group: "workflow", subject: "AI storyboarding", tier: 3,
      says: [
        "makes a sequence of frames to plan a video or campaign",
        "depends on character and style consistency across frames",
        "is a low-cost way to align a team before production",
      ],
      use: "need to pitch a short film with consistent characters in each scene",
    },
    {
      group: "workflow", subject: "Product mockup generation", tier: 3,
      says: [
        "places products in realistic scenes without a photo shoot",
        "needs a faithful rendering of the real product's shape and label",
        "is risky when invented details misrepresent what is sold",
      ],
      use: "need lifestyle scenes of a product before a photo shoot is booked",
      not: ["is safe to publish without checking the product details"],
    },
    {
      group: "workflow", subject: "A/B variant testing", tier: 4,
      says: [
        "produces several creative versions to compare on real audience response",
        "is cheaper with generation than with separate photo shoots",
        "still needs a human to decide what is on brand",
      ],
      use: "want ten ad creatives to test with a small budget",
    },
    {
      group: "workflow", subject: "Brand guardrails", tier: 4,
      says: [
        "document colors, styles and banned content for AI-assisted work",
        "are enforced through templates and review rather than the tool alone",
        "protect brand consistency across many contributors",
      ],
      use: "need a rule set for everyone on the team using generators",
      like: ["A shared prompt library"],
    },

    // ---------- failure ----------
    {
      group: "failure", subject: "Malformed hands", tier: 1,
      says: [
        "show extra, missing or fused fingers in generated people",
        "occur because hands are complex and vary greatly in training images",
        "are commonly fixed with inpainting or manual retouching",
      ],
      use: "see six fingers on a generated person",
      not: ["cannot be corrected once an image is generated"],
    },
    {
      group: "failure", subject: "Garbled text", tier: 1,
      says: [
        "appears as nonsense letters in signs, packaging and posters",
        "is reduced by tools that handle typography better, but not removed",
        "is best fixed by adding real text in design software afterward",
      ],
      use: "need an exact slogan on a poster mockup",
      not: ["only affects images generated at small sizes"],
    },
    {
      group: "failure", subject: "Concept bleed", tier: 3,
      says: [
        "happens when attributes of one object leak onto another, like colors swapping",
        "becomes more common in prompts with many subjects",
        "is reduced by simplifying the prompt or generating elements separately",
      ],
      use: "get a red hat on the wrong person in a two-person prompt",
    },
    {
      group: "failure", subject: "Style sameness", tier: 3,
      says: [
        "makes outputs look generic or recognizably machine-made",
        "results from default aesthetics shared by many users",
        "is countered with specific references and human-made touches",
      ],
      use: "notice every team image has the same glossy AI look",
      like: ["Over-stylization"],
    },
    {
      group: "failure", subject: "Over-stylization", tier: 3,
      says: [
        "lets the tool's built-in look override the literal prompt",
        "is reduced by lowering the stylize value",
        "gives images that are attractive but off-brief",
      ],
      use: "find results beautiful but not matching your described scene",
      like: ["Style sameness"],
    },
    {
      group: "failure", subject: "Duplicated subjects", tier: 4,
      says: [
        "appear as repeated figures or stacked bodies at extreme aspect ratios",
        "happen when the canvas shape is far from what the model trained on",
        "are avoided by generating a normal ratio and then outpainting",
      ],
      use: "see two heads appearing in a very wide panorama",
      not: ["are caused by a negative prompt"],
    },
    {
      group: "failure", subject: "Training bias", tier: 3,
      says: [
        "makes generators default to stereotypes about people and professions",
        "can be countered with explicit, diverse descriptions in the prompt",
        "calls for human review before publishing images of people",
      ],
      use: "notice that every generated doctor looks the same",
      not: ["is a bug that disappears after a prompt is lengthened"],
    },
    {
      group: "failure", subject: "Ignored prompt details", tier: 2,
      says: [
        "occur when a prompt is long or contradicts itself",
        "are reduced by prioritizing the most important elements first",
        "show up as missing objects or wrong counts",
      ],
      use: "see that three of the five requested objects are missing",
    },
    {
      group: "failure", subject: "Counting errors", tier: 3,
      says: [
        "give the wrong number of objects, like seven candles instead of five",
        "arise because generators learn visual patterns rather than exact numbers",
        "are fixed by inpainting or manual editing",
      ],
      use: "need exactly three items in a scene",
      like: ["Ignored prompt details"],
    },
    {
      group: "failure", subject: "Upscale hallucination", tier: 4,
      says: [
        "adds fine details that were not in the approved image",
        "can alter faces, text or logos during enlargement",
        "is caught by comparing the enlarged file with the original",
      ],
      use: "see that a brand mark changed after enlarging",
      like: ["Garbled text"],
    },
    {
      group: "failure", subject: "Perspective and physics errors", tier: 4,
      says: [
        "show impossible shadows, reflections or object connections",
        "happen because generators have no physical simulation",
        "are caught by close inspection of reflections and contact points",
      ],
      use: "notice a shadow that points toward the light source",
    },

    // ---------- video ----------
    {
      group: "video", subject: "Camera-motion prompt", tier: 2,
      says: [
        "describes moves such as pan, tilt, dolly or zoom in a video prompt",
        "controls how the virtual camera travels through the shot",
        "is stated separately from what the subject itself does",
      ],
      use: "want a slow push-in toward a character",
      like: ["Motion strength"],
    },
    {
      group: "video", subject: "Temporal flicker", tier: 3,
      says: [
        "is frame-to-frame instability in textures, lighting or details",
        "arises because frames must be coherent over time and not just individually",
        "is reduced by shorter clips and stronger anchoring to a reference image",
      ],
      use: "see a character's jacket pattern change between frames",
      not: ["happens only in still image generators"],
    },
    {
      group: "video", subject: "Keyframes", tier: 3,
      says: [
        "pin the start and sometimes the end of a clip to chosen images",
        "let a designer control exactly how a shot begins and ends",
        "reduce randomness in the content of the generated motion",
      ],
      use: "need a clip to begin and end on specific approved images",
    },
    {
      group: "video", subject: "Motion strength", tier: 3,
      says: [
        "sets how much movement the generator adds to a shot",
        "gives subtle, stable motion at low values",
        "risks distortion and morphing when set very high",
      ],
      use: "want a gentle parallax instead of wild movement",
      like: ["Camera-motion prompt"],
    },
    {
      group: "video", subject: "Shot consistency", tier: 4,
      says: [
        "means characters and settings look the same across separate clips",
        "is hard because each clip is generated independently",
        "is helped by reference images and a fixed visual style",
      ],
      use: "need the same actor to appear in all six shots of a sequence",
    },
    {
      group: "video", subject: "Frame interpolation", tier: 4,
      says: [
        "synthesizes in-between frames to make motion smoother",
        "can raise frame rate without regenerating the whole clip",
        "can produce ghosting on fast, complex movement",
      ],
      use: "want a 12-frame-per-second render to play more fluidly",
    },
    {
      group: "video", subject: "Video upscaling", tier: 3,
      says: [
        "increases the resolution of each frame of a finished clip",
        "should preserve temporal coherence so detail does not shimmer",
        "is applied after editing, since it is slow and costly",
      ],
      use: "need to deliver a generated clip on a high-resolution display",
    },
    {
      group: "video", subject: "Lip sync", tier: 4,
      says: [
        "matches mouth movement to a supplied audio track",
        "needs a clearly visible face in the footage",
        "raises consent concerns when used on a real person's likeness",
      ],
      use: "want an avatar to speak recorded dialogue",
    },
    {
      group: "video", subject: "Clip-length limits", tier: 2,
      says: [
        "keep individual generated clips short",
        "are worked around by editing several clips into a sequence",
        "make planning shot-by-shot more important than generating one long take",
      ],
      use: "need a 30-second ad from a tool that outputs short clips",
      not: ["disappear when the prompt is written in more detail"],
    },
    {
      group: "video", subject: "Storyboard-to-video pipeline", tier: 4,
      says: [
        "generates approved key frames first and animates each afterward",
        "separates look decisions from motion decisions",
        "avoids paying for motion on shots whose composition is wrong",
      ],
      use: "want to lock composition before spending credits on animation",
    },

    // ---------- comp ----------
    {
      group: "comp", subject: "Rule of thirds", tier: 1,
      says: [
        "places key elements along lines dividing the frame into a 3 by 3 grid",
        "creates a balanced, less static composition than centering",
        "can be requested in a prompt but is not always followed exactly",
      ],
      use: "want the subject off-center with room to breathe",
      like: ["Symmetry"],
    },
    {
      group: "comp", subject: "Close-up", tier: 1,
      says: [
        "frames a subject tightly, such as just a face",
        "emphasizes emotion and detail",
        "removes most of the surrounding environment",
      ],
      use: "need an intimate portrait with the face filling the frame",
      like: ["Wide shot"],
    },
    {
      group: "comp", subject: "Wide shot", tier: 1,
      says: [
        "shows the subject small within a large environment",
        "establishes location and scale",
        "gives less facial detail than a tight framing",
      ],
      use: "need an establishing view of a whole landscape",
      like: ["Close-up"],
    },
    {
      group: "comp", subject: "Bird's-eye view", tier: 2,
      says: [
        "looks straight down from high above the scene",
        "flattens depth and emphasizes patterns and layout",
        "suits maps, flat lays and table arrangements",
      ],
      use: "need a flat-lay of ingredients on a kitchen table",
      like: ["Low angle"],
    },
    {
      group: "comp", subject: "Low angle", tier: 2,
      says: [
        "places the camera below the subject looking upward",
        "makes the subject seem powerful or imposing",
        "exaggerates height in buildings and figures",
      ],
      use: "want a hero figure to look monumental",
      like: ["Bird's-eye view"],
    },
    {
      group: "comp", subject: "Shallow depth of field", tier: 2,
      says: [
        "keeps the subject sharp while the background blurs",
        "is associated with wide apertures and portrait photography",
        "isolates the subject from distracting surroundings",
      ],
      use: "want a crisp subject against a softly blurred backdrop",
      like: ["Bokeh"],
    },
    {
      group: "comp", subject: "Bokeh", tier: 3,
      says: [
        "describes the look of out-of-focus highlights as soft circles or shapes",
        "is a quality of the blurred areas rather than the sharp subject",
        "is often requested with night lights behind a subject",
      ],
      use: "want soft glowing orbs of city lights behind the subject",
      like: ["Shallow depth of field"],
    },
    {
      group: "comp", subject: "Symmetry", tier: 3,
      says: [
        "mirrors visual weight evenly around a central axis",
        "gives a formal, stable and calm feeling",
        "often places the subject centered in the frame",
      ],
      use: "want a formal, centered architectural interior",
      like: ["Rule of thirds"],
    },
    {
      group: "comp", subject: "Negative space", tier: 3,
      says: [
        "leaves empty areas around the subject on purpose",
        "provides room for headlines and calls to action",
        "reduces visual clutter and emphasizes the subject",
      ],
      use: "need empty space on one side for ad copy",
      not: ["is wasted space that should be filled with detail"],
    },
    {
      group: "comp", subject: "Leading lines", tier: 4,
      says: [
        "use roads, rails or edges to pull the eye toward the subject",
        "add depth by converging toward a point in the distance",
        "work well in landscapes and architectural scenes",
      ],
      use: "want a road to guide attention to a distant building",
    },

    // ---------- light ----------
    {
      group: "light", subject: "Golden hour", tier: 1,
      says: [
        "is the warm, low-angle light shortly after sunrise or before sunset",
        "gives long shadows and a soft orange glow",
        "flatters landscapes and portraits with a gentle tone",
      ],
      use: "want a warm, flattering outdoor portrait",
      like: ["Overcast light"],
    },
    {
      group: "light", subject: "Rim light", tier: 3,
      says: [
        "outlines a subject's edge with a thin bright line",
        "separates the subject from a dark background",
        "is placed behind and to the side of the subject",
      ],
      use: "want a glowing edge that separates a figure from darkness",
      like: ["Backlighting"],
    },
    {
      group: "light", subject: "Soft diffused light", tier: 2,
      says: [
        "produces gentle shadows with smooth edges",
        "is created by large or filtered sources like a softbox or cloud cover",
        "flatters skin by reducing harsh highlights",
      ],
      use: "need flattering, shadow-soft light for a beauty shot",
      like: ["Overcast light", "Studio softbox light"],
    },
    {
      group: "light", subject: "Chiaroscuro", tier: 4,
      says: [
        "uses strong contrast between bright areas and deep shadow",
        "is associated with dramatic painting traditions",
        "creates tension and a sculpted look in a face",
      ],
      use: "want a moody, high-contrast portrait inspired by classical painting",
    },
    {
      group: "light", subject: "Volumetric light", tier: 4,
      says: [
        "makes beams of light visible through fog, dust or mist",
        "adds atmosphere and depth to a scene",
        "is often called god rays when shining through trees or windows",
      ],
      use: "want visible light shafts through a misty forest",
    },
    {
      group: "light", subject: "Backlighting", tier: 3,
      says: [
        "places the main light behind the subject facing the camera",
        "can turn a subject into a silhouette",
        "creates a glow around hair and semi-transparent objects",
      ],
      use: "want a silhouette against a bright sky",
      like: ["Rim light"],
    },
    {
      group: "light", subject: "Neon lighting", tier: 2,
      says: [
        "adds saturated colored glows, often in pink, blue and purple",
        "is associated with night city and cyberpunk scenes",
        "casts colored reflections on wet streets and faces",
      ],
      use: "want a rainy night city with colorful glowing signs",
    },
    {
      group: "light", subject: "Studio softbox light", tier: 3,
      says: [
        "uses controlled artificial light for clean product photography",
        "gives even, repeatable illumination with minimal harsh shadows",
        "suits e-commerce shots on seamless backgrounds",
      ],
      use: "need clean, even lighting for a catalog product image",
      like: ["Soft diffused light"],
    },
    {
      group: "light", subject: "Overcast light", tier: 2,
      says: [
        "is flat daylight filtered through cloud cover",
        "gives even exposure with very faint shadows",
        "is useful when you want color accuracy without drama",
      ],
      use: "want neutral outdoor light with no harsh shadows",
      like: ["Golden hour", "Soft diffused light"],
    },
    {
      group: "light", subject: "Hard directional light", tier: 3,
      says: [
        "casts sharp-edged, high-contrast shadows",
        "comes from a small or distant bright source such as midday sun",
        "emphasizes texture and form",
      ],
      use: "want crisp, graphic shadows across a surface",
      not: ["produces smooth gradients between light and dark"],
    },
  ],
  qa: [
    {
      q: "In a Midjourney-style prompt, what does the 16:9 in this prompt control?",
      code: "a lighthouse on a cliff at dusk, oil painting --ar 16:9",
      right: "The width-to-height proportion of the image",
      wrong: ["The number of images generated", "How much the tool's aesthetic is applied", "The seed used for the run"],
      tier: 1, topic: "Parameters",
      why: "The ar parameter sets aspect ratio.",
    },
    {
      q: "Where do parameters belong in a Midjourney-style prompt?",
      code: "portrait of a sailor, soft light --s 250 --chaos 10",
      right: "After the descriptive text, each starting with two hyphens",
      wrong: ["Before the first word of the prompt", "Inside quotation marks around the subject", "On a separate line after the image is made"],
      tier: 1, topic: "Parameters",
      why: "Flags trail the prompt and use a double hyphen.",
    },
    {
      q: "What does the trailing parameter in this prompt do?",
      code: "a wooden table by a window, morning light --no fruit",
      right: "It asks the tool to leave fruit out of the image",
      wrong: ["It sets the style to fruit", "It locks the seed to a fruit-themed value", "It makes a repeating fruit pattern"],
      tier: 2, topic: "Parameters",
      why: "The no parameter lists things to exclude.",
    },
    {
      q: "What does this prompt's chaos value most affect?",
      code: "futuristic city skyline --chaos 80",
      right: "How varied the initial results are from one another",
      wrong: ["The pixel resolution of the output", "Whether the image tiles seamlessly", "Which model version renders the job"],
      tier: 2, topic: "Parameters",
      why: "Chaos increases variety among starting results.",
    },
    {
      q: "You need to compare two prompts that differ by one word without the composition jumping around. What should you do?",
      code: "red fox in snow --seed 1234\nsilver fox in snow --seed 1234",
      right: "Reuse the same seed for both so the starting noise matches",
      wrong: ["Raise chaos to the maximum for both", "Use tile so both repeat", "Use a different seed for each to avoid bias"],
      tier: 2, topic: "Parameters",
      why: "A shared seed makes the comparison cleaner.",
    },
    {
      q: "Which parameter would you add to create a seamless fabric swatch?",
      code: "small blue floral pattern, vintage fabric",
      right: "--tile",
      wrong: ["--stop 10", "--weird 500", "--iw 2"],
      tier: 3, topic: "Parameters",
      why: "Tile makes edges repeat seamlessly.",
    },
    {
      q: "What does a low value of this parameter do?",
      code: "abstract mountains --stop 30",
      right: "Ends rendering early, giving a softer and less finished image",
      wrong: ["Stops the job from using credits", "Halts the prompt after 30 words", "Stops the seed from changing"],
      tier: 4, topic: "Parameters",
      why: "Stop ends the process at a percentage of completion.",
    },
    {
      q: "A prompt uses a very high stylize value but the picture ignores the literal description. What is the best adjustment?",
      code: "a plain white mug on a desk --s 900",
      right: "Lower the stylize value so the output follows the wording more closely",
      wrong: ["Raise the stylize value further", "Add --tile", "Replace the seed with 0"],
      tier: 2, topic: "Parameters",
      why: "High stylize emphasizes the tool's look over the prompt.",
    },
    {
      q: "Which prompt order is generally best for a generator that weights early words more?",
      right: "Subject first, then style, lighting and finishing details",
      wrong: ["Style words first, subject last", "Only lighting words, subject omitted", "Parameters first, then the subject"],
      tier: 2, topic: "Prompt anatomy",
      why: "Early terms are often given more influence.",
    },
    {
      q: "Which rewrite is the strongest improvement to the vague prompt 'a nice picture of a dog'?",
      right: "A golden retriever catching a frisbee in a park at golden hour, 85mm photograph",
      wrong: ["A very good amazing dog image, ultra quality", "dog dog dog dog", "A picture that is nice, of a dog, nice"],
      tier: 1, topic: "Prompt anatomy",
      why: "Concrete subject, setting, lighting and camera cues beat vague praise.",
    },
    {
      q: "Your poster mockup shows the wrong letters in a headline. What is the most reliable fix?",
      right: "Generate the artwork without text and add the headline in design software",
      wrong: ["Raise stylize until the letters correct themselves", "Repeat the headline ten times in the prompt", "Use the tile parameter"],
      tier: 2, topic: "Failures",
      why: "Generators often garble text; typesetting it yourself is exact.",
    },
    {
      q: "A generated person has an extra finger. Which operation fixes only that region?",
      right: "Inpainting the hand with a mask",
      wrong: ["Outpainting the hand", "Upscaling the whole image", "Raising chaos and regenerating all"],
      tier: 2, topic: "Editing",
      why: "Inpainting regenerates a masked area and leaves the rest alone.",
    },
    {
      q: "A square image must become a wide web banner without cropping the subject. What do you use?",
      right: "Outpainting to extend the canvas on the sides",
      wrong: ["Inpainting the center", "Lowering the seed", "Face restoration"],
      tier: 2, topic: "Editing",
      why: "Outpainting extends beyond the original borders.",
    },
    {
      q: "In which order should upscaling and composition choice happen?",
      right: "Choose the composition first, then upscale the chosen image",
      wrong: ["Upscale every candidate before reviewing any", "Upscale first, then rewrite the prompt", "Order never matters"],
      tier: 2, topic: "Workflow",
      why: "Upscaling every candidate wastes time and credits.",
    },
    {
      q: "You change one word in a prompt and the whole composition shifts. What likely explains this?",
      right: "The random starting noise changed or the new word re-weighted the scene",
      wrong: ["The tool has deleted your seed", "The aspect ratio was reset to square", "The content policy rewrote the prompt"],
      tier: 3, topic: "Prompt anatomy",
      why: "A fixed seed and small edits give more stable comparisons.",
    },
    {
      q: "A client's legal team asks if a raw AI-generated image can be exclusively owned. What is the most accurate answer?",
      right: "It depends on jurisdiction and tool terms, and purely machine-made output may not be protected by copyright",
      wrong: ["Yes, always, because the client paid for the subscription", "No, AI images are always in the public domain worldwide", "Only if the prompt is over fifty words"],
      tier: 4, topic: "Licensing",
      why: "Law varies and human contribution matters.",
    },
    {
      q: "Before using generated images in paid client work, what should you check first?",
      right: "The tool's terms of service for commercial use on your plan",
      wrong: ["The image's file size", "The number of images in the grid", "Whether the seed is even or odd"],
      tier: 1, topic: "Licensing",
      why: "Commercial rights are set by terms and often by plan.",
    },
    {
      q: "A prompt names a famous franchise character and the output looks nearly identical to it. Which risk does this raise?",
      right: "Trademark and copyright infringement risk if published",
      wrong: ["No risk because the image is new", "Only a file format risk", "A seed collision risk"],
      tier: 3, topic: "Licensing",
      why: "Generated images can reproduce protected characters.",
    },
    {
      q: "You must show a client ten very different logo mood directions in an hour. Which settings fit?",
      code: "minimalist coffee brand mark --chaos 60 --s 100",
      right: "Higher chaos for varied concepts and moderate stylize for early exploration",
      wrong: ["Chaos 0 and a locked seed", "Tile with a huge weird value", "A long stop value so images are fuzzy"],
      tier: 3, topic: "Workflow",
      why: "Chaos widens variety among starting results.",
    },
    {
      q: "A series of social posts must feature the same mascot in different scenes. Which approach best preserves the mascot?",
      right: "Use a character reference of the approved mascot plus locked descriptors",
      wrong: ["Use only a changing seed", "Use tile on every prompt", "Describe the mascot differently each time"],
      tier: 3, topic: "Consistency",
      why: "Reference images anchor identity better than words alone.",
    },
    {
      q: "What does a style reference transfer?",
      right: "The look, such as palette and rendering, but not the objects shown",
      wrong: ["The exact subject and pose", "The seed number", "The file's copyright ownership"],
      tier: 3, topic: "Consistency",
      why: "Style references carry aesthetic traits to new content.",
    },
    {
      q: "An AI upscaler enlarges a logo and its letters now differ slightly. What caused this?",
      right: "The upscaler synthesized plausible detail rather than restoring the original",
      wrong: ["The image's seed expired", "The content policy altered the logo", "The aspect ratio parameter was reset"],
      tier: 4, topic: "Failures",
      why: "Upscalers can invent detail, so verify brand marks afterward.",
    },
    {
      q: "A very wide panorama shows two stacked heads on the same person. What is the best fix?",
      right: "Generate at a standard ratio and extend with outpainting",
      wrong: ["Set the aspect ratio even wider", "Raise stylize to the maximum", "Add a negative prompt for heads"],
      tier: 4, topic: "Failures",
      why: "Extreme ratios often cause duplicated subjects.",
    },
    {
      q: "Which statement about content credentials is correct?",
      right: "They record how an image was made but can be stripped by re-encoding or screenshots",
      wrong: ["They make copying impossible", "They transfer copyright to the viewer", "They are required for every image online"],
      tier: 3, topic: "Licensing",
      why: "Provenance metadata is fragile.",
    },
    {
      q: "A brief calls for a warm, flattering outdoor portrait. Which lighting phrase fits best?",
      right: "golden hour, soft backlight",
      wrong: ["harsh noon overhead sun", "flat fluorescent office light", "pure black no light"],
      tier: 1, topic: "Lighting",
      why: "Golden hour is warm and low-angle.",
    },
    {
      q: "You want a shallow-focus portrait with blurred background lights. Which cue set fits?",
      right: "85mm lens, wide aperture, bokeh",
      wrong: ["ultra-wide fisheye, deep focus", "isometric top-down, flat shading", "pixel art 16-bit"],
      tier: 2, topic: "Camera",
      why: "Long lens and wide aperture give shallow depth of field and bokeh.",
    },
    {
      q: "A banner needs room for a headline on the left. Which prompt phrase helps?",
      right: "subject on the right third, large negative space on the left",
      wrong: ["subject filling the entire frame edge to edge", "no background, no space, crowded", "symmetrical centered subject"],
      tier: 2, topic: "Composition",
      why: "Negative space provides room for copy.",
    },
    {
      q: "A still image is approved and must move slightly without changing its look. Which approach fits?",
      right: "Image-to-video with the still as the anchor and low motion strength",
      wrong: ["Text-to-video with a new description", "Tile with high chaos", "Outpainting"],
      tier: 3, topic: "Video",
      why: "Anchoring to the still preserves its look.",
    },
    {
      q: "A generated video clip shows a patterned jacket that changes between frames. What is this called?",
      right: "Temporal flicker or inconsistency",
      wrong: ["Prompt bleed", "Negative space", "Aspect drift"],
      tier: 3, topic: "Video",
      why: "Frame-to-frame instability is temporal inconsistency.",
    },
    {
      q: "You need a 30-second ad but the video tool outputs short clips. What is the sound approach?",
      right: "Plan shots, generate them separately and edit them together",
      wrong: ["Request a 30-second clip in the prompt and expect it", "Use a bigger seed", "Use outpainting on the audio"],
      tier: 3, topic: "Video",
      why: "Clip length limits are handled with shot-by-shot editing.",
    },
    {
      q: "Which is the most responsible handling of a generated image of an apparently real, named public figure for an ad?",
      right: "Avoid it, since likeness rights and deception risks apply",
      wrong: ["Publish it because it was generated", "Add a tiny watermark and publish", "Mention the figure only in the metadata"],
      tier: 3, topic: "Licensing",
      why: "Using a real person's likeness without consent is risky.",
    },
    {
      q: "An unreleased product photo is under NDA. Before uploading it to a hosted generator, what should you check?",
      right: "The tool's data retention, training and visibility settings",
      wrong: ["Only the file's dimensions", "Whether the seed is saved", "Nothing, uploads are always private"],
      tier: 3, topic: "Licensing",
      why: "Hosted tools may retain or expose uploads depending on settings.",
    },
    {
      q: "What does a prompt library with recorded seeds and version flags enable?",
      right: "Reproducing and reusing successful results across the team",
      wrong: ["Skipping the commercial terms review", "Making images copyright free", "Avoiding any human review"],
      tier: 2, topic: "Workflow",
      why: "Recording settings makes results repeatable.",
    },
    {
      q: "A prompt of twelve subjects keeps swapping colors between them. What reduces concept bleed?",
      right: "Simplify the prompt or generate elements separately and combine them",
      wrong: ["Add more adjectives to each subject", "Increase chaos to the maximum", "Remove the aspect ratio"],
      tier: 3, topic: "Failures",
      why: "Fewer subjects per generation lessens attribute leakage.",
    },
    {
      q: "You want the least literal, most artistically embellished result. Which setting direction achieves it?",
      code: "serene mountain lake --s 900",
      right: "A high stylize value",
      wrong: ["A stylize of zero", "Tile", "A low stop value only"],
      tier: 2, topic: "Parameters",
      why: "Stylize raises the tool's own aesthetic influence.",
    },
    {
      q: "Which pairing correctly identifies tools by their emphasis?",
      right: "A Firefly-style tool: licensed training and design software integration",
      wrong: ["An open-weights model: only usable through the vendor website", "Midjourney: downloadable weights you run offline", "A vector generator: only outputs pixel grids"],
      tier: 3, topic: "Tools",
      why: "Open-weights models can run locally; hosted tools cannot.",
    },
    {
      q: "A teammate wants to prompt with a living illustrator's name to copy their style for a pitch. What is the better practice?",
      right: "Describe the desired visual traits in your own words and avoid imitating a living artist",
      wrong: ["Use the name; style cannot be an issue", "Use the name three times to be sure", "Only use it if the seed matches"],
      tier: 3, topic: "Licensing",
      why: "Name imitation raises ethical and reputational concerns.",
    },
    {
      q: "Which statement about negative prompts is true?",
      code: "a forest clearing --no people",
      right: "They can fail if the excluded word also appears in the main prompt",
      wrong: ["They always override the main prompt", "They change the aspect ratio", "They remove all copyright concerns"],
      tier: 3, topic: "Parameters",
      why: "Mentioning a concept in both places confuses the result.",
    },
    {
      q: "What does the trailing parameter in this command do?",
      code: "paper boat in a puddle --repeat 5",
      right: "It runs the same prompt five times",
      wrong: ["It tiles the image into five columns", "It uses five different seeds in one image", "It stops generation after five words"],
      tier: 5, topic: "Parameters",
      why: "Repeat re-runs the same prompt several times.",
    },
    {
      q: "What is the purpose of a character sheet in a series of illustrations?",
      right: "Giving a stable reference of a character from several angles for later scenes",
      wrong: ["Locking the aspect ratio", "Providing copyright clearance", "Reducing the file size of the output"],
      tier: 3, topic: "Consistency",
      why: "A sheet records the design to reuse as a reference.",
    },
    {
      q: "Training a custom model on your client's mascot images requires what?",
      right: "Owning or licensing every training image used",
      wrong: ["Nothing, because training is private", "Only a high stylize value", "A negative prompt for the mascot"],
      tier: 5, topic: "Licensing",
      why: "Training data rights still apply to custom models.",
    },
    {
      q: "A lone figure should appear as a dark silhouette against a bright sunset. Which lighting setup fits?",
      right: "Backlighting with the main light behind the subject",
      wrong: ["Studio softbox from the front", "Overcast flat daylight", "Neon from below"],
      tier: 3, topic: "Lighting",
      why: "Backlighting reduces front detail and creates silhouettes.",
    },
    {
      q: "Which approach best protects a client logo when changing the background of a generated product scene?",
      right: "Mask the logo area and inpaint only the background",
      wrong: ["Regenerate the whole image and hope the logo is the same", "Use a higher stylize value", "Outpaint across the logo"],
      tier: 3, topic: "Editing",
      why: "Masks protect pixels that must not change.",
    },
    {
      q: "Why generate approved key frames before animating in a video workflow?",
      right: "To fix the look and composition cheaply before paying for motion",
      wrong: ["Because video tools cannot read text", "To avoid ever needing consent", "Because key frames remove flicker entirely"],
      tier: 4, topic: "Video",
      why: "Separating look from motion avoids wasted animation.",
    },
    {
      q: "A designer finds every generated picture shares the same glossy look. What helps most?",
      right: "Add specific style references and human-made touches, and lower stylize",
      wrong: ["Raise stylize to the maximum", "Repeat the same prompt", "Add the tile parameter"],
      tier: 3, topic: "Failures",
      why: "Default aesthetics produce sameness; specific direction counters it.",
    },
  ],
  calc: [],
};
export default spec;
