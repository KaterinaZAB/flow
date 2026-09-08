import { Unzip, UnzipInflate } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
type XML = Record<string, any>;
const array = (v: any): any[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
function readXml(bytes: Uint8Array | undefined): XML {
  if (!bytes) throw new Error('Не удалось прочитать структуру XLSX.');
  const xml = new TextDecoder().decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw new Error('Некорректный XML в XLSX.');
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
  }).parse(xml);
}
function plain(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number')
    return String(value);
  return (
    plain(value.t ?? value['#text'] ?? '') + array(value.r).map(plain).join('')
  );
}
export function parseXlsx(bytes: Uint8Array): string[][] {
  if (bytes[0] !== 80 || bytes[1] !== 75)
    throw new Error(
      'Файл не является XLSX. Сохраните выписку в формате .xlsx.',
    );
  const entries: Record<string, Uint8Array> = {};
  let expanded = 0,
    fileCount = 0,
    failure: Error | undefined;
  const unzip = new Unzip((file) => {
    if (++fileCount > 150) throw new Error('Слишком сложный XLSX.');
    if ((file.originalSize ?? 0) > 8 * 1024 * 1024)
      throw new Error('Лист XLSX слишком большой.');
    if (/vbaProject|externalLinks/i.test(file.name))
      throw new Error(
        'XLSX с макросами или внешними ссылками не поддерживается.',
      );
    const keep =
      /^xl\/(?:workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/sheet\d+.xml)$/.test(
        file.name,
      );
    if (!keep) return;
    let parts: Uint8Array[] = [],
      size = 0;
    file.ondata = (err, data, final) => {
      if (err) {
        failure = err;
        file.terminate();
        return;
      }
      expanded += data.length;
      size += data.length;
      if (expanded > 12 * 1024 * 1024) {
        file.terminate();
        throw new Error('Распакованный XLSX превышает 12 МБ.');
      }
      parts.push(data);
      if (final) {
        const buf = new Uint8Array(size);
        let pos = 0;
        for (const p of parts) {
          buf.set(p, pos);
          pos += p.length;
        }
        entries[file.name] = buf;
        parts = [];
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Small chunks bound each decompressor callback's temporary allocation.
  for (let i = 0; i < bytes.length; i += 4096)
    unzip.push(bytes.subarray(i, i + 4096), i + 4096 >= bytes.length);
  if (failure) throw new Error('Повреждённый XLSX.');
  const wb = readXml(entries['xl/workbook.xml']);
  if (wb.workbook?.workbookPr?.['@date1904'] === '1')
    throw new Error(
      'Система дат 1904 не поддерживается. Экспортируйте выписку в CSV.',
    );
  const sheet = array(wb.workbook?.sheets?.sheet).find(
    (s) => s['@state'] !== 'hidden',
  );
  if (!sheet) throw new Error('В XLSX нет доступного листа.');
  const rels = array(
    readXml(entries['xl/_rels/workbook.xml.rels']).Relationships?.Relationship,
  );
  const rel = rels.find((r) => r['@Id'] === sheet['@r:id']);
  let target = String(rel?.['@Target'] ?? '');
  target = target.startsWith('/')
    ? target.slice(1)
    : 'xl/' + target.replace(/^\.\//, '');
  if (!/^xl\/worksheets\/sheet\d+.xml$/.test(target))
    throw new Error('Неподдерживаемая структура листа XLSX.');
  const shared = entries['xl/sharedStrings.xml']
    ? array(readXml(entries['xl/sharedStrings.xml']).sst?.si).map(plain)
    : [];
  const raw = array(readXml(entries[target]).worksheet?.sheetData?.row);
  if (raw.length > 10100) throw new Error('Максимум 10 000 операций в XLSX.');
  return raw
    .map((r) => {
      const result: string[] = [];
      for (const c of array(r.c)) {
        if (c.f !== undefined)
          throw new Error(
            'Выписка содержит формулы. Сохраните значения без формул.',
          );
        const letters = String(c['@r'] ?? '').match(/^[A-Z]+/)?.[0];
        if (!letters) throw new Error('Некорректные координаты ячейки.');
        let col = 0;
        for (const ch of letters) col = col * 26 + ch.charCodeAt(0) - 64;
        if (col > 80) throw new Error('Максимум 80 столбцов.');
        const value =
          c['@t'] === 's'
            ? (shared[Number(c.v)] ?? '')
            : c['@t'] === 'inlineStr'
              ? plain(c.is)
              : plain(c.v);
        if (value.length > 1000)
          throw new Error('В XLSX есть слишком длинная ячейка.');
        result[col - 1] = value;
      }
      return Array.from({ length: result.length }, (_, i) => result[i] ?? '');
    })
    .filter((r) => r.some(Boolean));
}
