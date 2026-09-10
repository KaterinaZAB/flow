export type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height?: number;
};

export type VisualLine = {
  cells: PdfTextItem[];
  text: string;
  y: number;
  minX: number;
  maxX: number;
};

export type TransactionBlock = {
  lines: VisualLine[];
  boundingBox: { minX: number; maxX: number; minY: number; maxY: number };
};

export function sortLineItemsByX(items: PdfTextItem[]) {
  return [...items].sort((a, b) => a.x - b.x);
}

export function mergeNearbyTextItems(items: PdfTextItem[], maxGap = 9) {
  const merged: PdfTextItem[] = [];
  for (const item of sortLineItemsByX(items)) {
    const previous = merged[merged.length - 1];
    const gap = previous ? item.x - (previous.x + previous.width) : Infinity;
    if (previous && gap >= -1 && gap < maxGap) {
      previous.text += (gap > 2 ? ' ' : '') + item.text;
      previous.width = Math.max(
        previous.width,
        item.x + item.width - previous.x,
      );
      previous.height = Math.max(previous.height ?? 0, item.height ?? 0);
    } else merged.push({ ...item });
  }
  return merged;
}

export function groupItemsIntoLines(
  items: PdfTextItem[],
  yTolerance = 2.5,
): VisualLine[] {
  const groups: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of [...items]
    .filter((candidate) => candidate.text.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x)) {
    let group = groups.find(
      (candidate) =>
        Math.abs(candidate.y - item.y) <=
        Math.max(yTolerance, (item.height ?? 0) * 0.25),
    );
    if (!group) {
      group = { y: item.y, items: [] };
      groups.push(group);
    }
    group.items.push(item);
    group.y =
      group.items.reduce((sum, candidate) => sum + candidate.y, 0) /
      group.items.length;
  }
  return groups
    .sort((a, b) => b.y - a.y)
    .map((group) => {
      const cells = mergeNearbyTextItems(group.items);
      return {
        cells,
        text: cells
          .map((cell) => cell.text.trim())
          .filter(Boolean)
          .join('  '),
        y: group.y,
        minX: Math.min(...cells.map((cell) => cell.x)),
        maxX: Math.max(...cells.map((cell) => cell.x + cell.width)),
      };
    });
}

export function blockBounds(
  lines: VisualLine[],
): TransactionBlock['boundingBox'] {
  return {
    minX: Math.min(...lines.map((line) => line.minX)),
    maxX: Math.max(...lines.map((line) => line.maxX)),
    minY: Math.min(...lines.map((line) => line.y)),
    maxY: Math.max(...lines.map((line) => line.y)),
  };
}
