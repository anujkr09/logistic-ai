function pdfEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(title, lines = []) {
  const contentLines = [
    `BT /F1 18 Tf 50 780 Td (${pdfEscape(title)}) Tj ET`,
    ...lines.slice(0, 34).map((line, index) => `BT /F1 10 Tf 50 ${750 - index * 18} Td (${pdfEscape(line)}) Tj ET`),
  ];
  const stream = contentLines.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
  ];

  let offset = '%PDF-1.4\n'.length;
  const xref = ['0000000000 65535 f '];
  const body = objects.map((object) => {
    xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
    offset += object.length + 1;
    return object;
  }).join('\n');
  const xrefOffset = '%PDF-1.4\n'.length + body.length + 1;
  return Buffer.from([
    '%PDF-1.4',
    body,
    `xref\n0 ${xref.length}`,
    xref.join('\n'),
    `trailer << /Size ${xref.length} /Root 1 0 R >>`,
    `startxref\n${xrefOffset}`,
    '%%EOF',
  ].join('\n'));
}

module.exports = { buildPdf };
