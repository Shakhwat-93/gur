/**
 * Bulk Parcel Export Utility (CSV with UTF-8 BOM + Native OOXML .xlsx)
 * Zero external bloat — produces genuine Excel .xlsx workbooks with full Bangla Unicode support.
 */

const EXPORT_COLUMNS = [
  { key: 'order_id', header: 'Internal Order ID', width: 20 },
  { key: 'consignment_id', header: 'eShipFirst Consignment ID', width: 24 },
  { key: 'tracking_code', header: 'Tracking Code', width: 20 },
  { key: 'recipient_name', header: 'Customer Name', width: 24 },
  { key: 'recipient_phone', header: 'Phone', width: 16 },
  { key: 'recipient_address', header: 'Address', width: 42 },
  { key: 'cod_amount', header: 'COD Amount', width: 14, numeric: true },
  { key: 'booking_date', header: 'Booking Date', width: 20 },
  { key: 'delivery_status', header: 'Delivery Status', width: 26 }
];

function mapParcelRow(parcel) {
  const submittedAt = parcel.courier_submitted_at || parcel.created_at || '';
  const formattedDate = submittedAt
    ? new Date(submittedAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  return {
    order_id: String(parcel.order_id || parcel.order?.order_id || ''),
    consignment_id: String(parcel.consignment_id || ''),
    tracking_code: String(parcel.tracking_code || ''),
    recipient_name: String(parcel.recipient_name || parcel.order?.name || ''),
    recipient_phone: String(parcel.recipient_phone || parcel.order?.phone || ''),
    recipient_address: String(parcel.recipient_address || parcel.order?.address || ''),
    cod_amount: Number(parcel.cod_amount ?? parcel.order?.total_price ?? 0),
    booking_date: formattedDate,
    delivery_status: String(parcel.courier_delivery_status || parcel.courier_booking_status || 'pending')
  };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports parcels to UTF-8 BOM CSV (Excel-safe Bangla encoding)
 */
export function exportParcelsToCsv(parcels, filenamePrefix = 'eshipfirst-parcels') {
  const rows = (parcels || []).map(mapParcelRow);
  const escapeCsv = (val) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    EXPORT_COLUMNS.map((c) => escapeCsv(c.header)).join(','),
    ...rows.map((r) => EXPORT_COLUMNS.map((c) => escapeCsv(r[c.key])).join(','))
  ];

  // UTF-8 BOM ensures Excel decodes Bengali characters properly
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `${filenamePrefix}-${stamp}.csv`);
}

/* ============================================================================
   ZERO-DEPENDENCY GENUINE OOXML (.xlsx) GENERATOR
   ============================================================================ */

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(idx) {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Standard CRC-32 table for ZIP archive entries
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZipBuffer(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = crc32(dataBytes);

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local header signature
    lv.setUint16(4, 20, true);         // Version needed (2.0)
    lv.setUint16(6, 0x0800, true);     // UTF-8 filename flag
    lv.setUint16(8, 0, true);          // Compression method: 0 (STORE)
    lv.setUint16(10, 0, true);         // Mod time
    lv.setUint16(12, 0, true);         // Mod date
    lv.setUint32(14, crc, true);       // CRC-32
    lv.setUint32(18, dataBytes.length, true); // Compressed size
    lv.setUint32(22, dataBytes.length, true); // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // File name length
    lv.setUint16(28, 0, true);         // Extra field length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    // Central directory header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLen = offset + centralSize + eocd.length;
  const output = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    output.set(part, pos);
    pos += part.length;
  }
  return output;
}

/**
 * Exports parcels to a genuine .xlsx Excel workbook
 */
export function exportParcelsToXlsx(parcels, filenamePrefix = 'eshipfirst-parcels') {
  const rows = (parcels || []).map(mapParcelRow);

  const colsXml = EXPORT_COLUMNS.map(
    (c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`
  ).join('');

  const headerCells = EXPORT_COLUMNS.map(
    (c, i) => `<c r="${colLetter(i)}1" t="inlineStr" s="1"><is><t>${escapeXml(c.header)}</t></is></c>`
  ).join('');

  const bodyRowsXml = rows
    .map((r, rIdx) => {
      const rowNum = rIdx + 2;
      const cells = EXPORT_COLUMNS.map((c, cIdx) => {
        const ref = `${colLetter(cIdx)}${rowNum}`;
        const val = r[c.key];
        if (c.numeric && Number.isFinite(Number(val))) {
          return `<c r="${ref}"><v>${Number(val)}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
      }).join('');
      return `<row r="${rowNum}">${cells}</row>`;
    })
    .join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1">${headerCells}</row>
    ${bodyRowsXml}
  </sheetData>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="eShipFirst Parcels" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const zipBytes = buildZipBuffer([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml }
  ]);

  const blob = new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `${filenamePrefix}-${stamp}.xlsx`);
}
