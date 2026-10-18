import type { MetadataRoute } from "next";

/** Lets a phone or browser offer "Add to home screen" and open gglearn like an app, straight into the learner's quest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "gglearn",
    short_name: "gglearn",
    description: "Learn, race and prove it: 20 levels from Novice to Titan.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f5ef",
    theme_color: "#4f46e5",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
