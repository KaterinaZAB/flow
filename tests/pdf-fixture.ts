export function makePdf(
  lines: { text: string; x: number; y: number }[] = [],
): Uint8Array {
  const stream = lines
    .map(
      (l) =>
        'BT /F1 10 Tf 1 0 0 1 ' +
        l.x +
        ' ' +
        l.y +
        ' Tm (' +
        l.text.replace(/[\\()]/g, '\\$&') +
        ') Tj ET',
    )
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += i + 1 + ' 0 obj\n' + objects[i] + '\nendobj\n';
  }
  const xref = pdf.length;
  pdf +=
    'xref\n0 6\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' +
    xref +
    '\n%%EOF';
  return new TextEncoder().encode(pdf);
}
export function fixtureLines(name = 'NETFLIX') {
  const result = [
    { text: 'Card account statement', x: 40, y: 750 },
    { text: 'Date', x: 40, y: 720 },
    { text: 'Merchant', x: 170, y: 720 },
    { text: 'Debit', x: 380, y: 720 },
    { text: 'Balance', x: 480, y: 720 },
  ];
  for (let i = 0; i < 3; i++) {
    const y = 690 - i * 30;
    result.push(
      { text: '21.0' + (i + 6) + '.2026', x: 40, y },
      { text: name, x: 170, y },
      { text: '699.00', x: 380, y },
      { text: '20 000.00', x: 480, y },
    );
  }
  return result;
}
