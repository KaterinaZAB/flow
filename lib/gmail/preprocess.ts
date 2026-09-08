import { Parser } from 'htmlparser2';
import type { GmailMessage, GmailPart, PreparedEmail } from './types.ts';
const suppressed = new Set([
  'script',
  'style',
  'head',
  'iframe',
  'svg',
  'form',
  'template',
  'noscript',
  'object',
]);
export function htmlText(html: string) {
  if (html.length > 150000) throw new Error('Письмо слишком большое.');
  const stack: boolean[] = [],
    pieces: string[] = [];
  let hidden = 0;
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const skip =
          suppressed.has(name) ||
          'hidden' in attrs ||
          /display\s*:\s*none|visibility\s*:\s*hidden/i.test(
            attrs.style ?? '',
          ) ||
          attrs['aria-hidden'] === 'true';
        stack.push(skip);
        if (skip) hidden++;
        if (
          !hidden &&
          ['br', 'p', 'div', 'tr', 'td', 'li', 'h1', 'h2', 'h3'].includes(name)
        )
          pieces.push('\n');
      },
      ontext(text) {
        if (!hidden) pieces.push(text);
      },
      onclosetag() {
        if (stack.pop()) hidden--;
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return pieces
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
export function preprocessEmail(message: GmailMessage): PreparedEmail {
  const header = (name: string) =>
    message.payload?.headers?.find((h) => h.name.toLowerCase() === name)
      ?.value ?? '';
  const from = header('from');
  const sender = (from.match(/<([^<>]+)>/)?.[1] ?? from)
    .trim()
    .toLowerCase()
    .slice(0, 250);
  const plain: string[] = [],
    html: string[] = [];
  let parts = 0,
    total = 0;
  function visit(part: GmailPart, depth = 0) {
    if (++parts > 80 || depth > 10)
      throw new Error('Слишком сложная структура письма.');
    if (part.filename) return;
    const data = part.body?.data;
    if (data && ['text/plain', 'text/html'].includes(part.mimeType ?? '')) {
      if (data.length > 200000) throw new Error('Письмо слишком большое.');
      const bytes = Uint8Array.from(
        atob(data.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      );
      total += bytes.length;
      if (total > 150000) throw new Error('Письмо слишком большое.');
      const text = new TextDecoder().decode(bytes);
      (part.mimeType === 'text/plain' ? plain : html).push(text);
    }
    for (const child of part.parts ?? []) visit(child, depth + 1);
  }
  if (message.payload) visit(message.payload);
  const received = Number(message.internalDate);
  if (
    !Number.isFinite(received) ||
    received < 946684800000 ||
    received > Date.now() + 86400000
  )
    throw new Error('Нет достоверной даты получения письма.');
  return {
    id: message.id,
    sender,
    subject: header('subject').slice(0, 500),
    text: [...new Set(plain.length ? plain : html.map(htmlText))]
      .join('\n')
      .replace(/\r/g, '')
      .slice(0, 100000),
    receivedAt: new Date(received).toISOString(),
  };
}
