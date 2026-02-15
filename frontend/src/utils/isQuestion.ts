const QUESTION_WORDS = [
  "what", "which", "who", "where", "when", "how", "why",
  "show me", "find me", "tell me", "list", "give me", "can you",
];

export function isQuestion(q: string): boolean {
  const lower = q.trim().toLowerCase();
  if (lower.endsWith("?")) return true;
  return QUESTION_WORDS.some((w) => lower.startsWith(w));
}
