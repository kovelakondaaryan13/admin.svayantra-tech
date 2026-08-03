/**
 * Intelligent chunking: split on paragraph/sentence boundaries into bounded windows
 * with overlap, so semantic units stay intact and retrieval has enough context.
 */
export function chunkText(
  text: string,
  opts: { maxChars?: number; overlapChars?: number } = {},
): string[] {
  const maxChars = opts.maxChars ?? 1200;
  const overlap = opts.overlapChars ?? 150;
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  // Prefer paragraph boundaries, then sentences, before hard-splitting.
  const paragraphs = clean.split(/\n{2,}/);
  const units: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= maxChars) {
      units.push(p.trim());
    } else {
      for (const sentence of p.split(/(?<=[.!?])\s+/)) units.push(sentence.trim());
    }
  }

  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    if (!unit) continue;
    if ((current + "\n\n" + unit).length > maxChars && current) {
      chunks.push(current.trim());
      current = current.slice(Math.max(0, current.length - overlap)) + "\n\n" + unit;
    } else {
      current = current ? current + "\n\n" + unit : unit;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
