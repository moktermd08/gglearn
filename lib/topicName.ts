/**
 * How a topic's name reads in lists, pickers and sentences. The stored name is never changed by this (a number in front keeps the software
 * lifecycle stages in order, and "Novice to Titan" marks the 20-level tracks); here both are dropped because every topic has them or
 * the list is already grouped, and they make a sentence like "gain 5 levels in 5. Backend development" read badly.
 */
export const topicLabel = (name: string) => name.replace(/^\d+\.\s*/, "").replace(/:\s*Novice to Titan$/i, "").trim() || name;

/** Alphabetical, but "2." comes before "10.", and case is ignored. Sort by the stored name so the lifecycle stages stay in order. */
export const byTopicName = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
