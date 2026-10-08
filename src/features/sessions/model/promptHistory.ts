import type { Block } from "./session";
import { isOperatorUserTurn, operatorUserPrompt } from "./operatorCommand";

/**
 * Prompts sent in a session, oldest first, as they would be typed again.
 * A prompt sent more than once keeps only its latest position.
 */
export function promptHistory(blocks: Block[]): string[] {
  const seen = new Set<string>();
  const newestFirst: string[] = [];
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.role !== "user" || block.internal || block.draft) continue;
    const text = isOperatorUserTurn(block)
      ? `/operator ${operatorUserPrompt(block)}`
      : block.text;
    if (!text.trim() || seen.has(text)) continue;
    seen.add(text);
    newestFirst.push(text);
  }
  return newestFirst.reverse();
}

/** True when the caret sits on the first line, where ArrowUp has nowhere to go. */
export function caretOnFirstLine(
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): boolean {
  if (selectionStart === null || selectionStart !== selectionEnd) return false;
  return !value.slice(0, selectionStart).includes("\n");
}
