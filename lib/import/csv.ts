export function parseCsv(text: string): string[][] {
  if (text.length > 2 * 1024 * 1024) throw new Error('CSV превышает 2 МБ.');
  const sample = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .slice(0, 8)
    .join('\n');
  const counts = [';', ',', '\t'].map((separator) => ({
    separator,
    count: sample.split('').filter((c) => c === separator).length,
  }));
  const separator = counts.sort((a, b) => b.count - a.count)[0].separator;
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false,
    afterQuote = false;
  function cell() {
    row.push(value);
    value = '';
    afterQuote = false;
    if (row.length > 80)
      throw new Error('Слишком много столбцов: максимум 80.');
  }
  function end() {
    cell();
    if (row.some((v) => v.trim())) rows.push(row);
    row = [];
    if (rows.length > 10100)
      throw new Error('Слишком много строк: максимум 10 000 операций.');
  }
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else value += c;
    } else if (c === '"' && !value && !afterQuote) quoted = true;
    else if (c === separator) cell();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      end();
    } else {
      if (afterQuote && c.trim()) throw new Error('Ошибка кавычек в CSV.');
      value += c;
    }
    if (value.length > 1000)
      throw new Error('В CSV есть слишком длинная ячейка.');
  }
  if (quoted) throw new Error('В CSV не закрыты кавычки.');
  if (value || row.length) end();
  return rows;
}
export function decodeCsv(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251').decode(bytes);
  }
}
