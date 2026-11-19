/* Será Que Devo? · Beta 3.0 — Exportação Excel XLSX genuína, sem CDN, servidor ou acesso a dados adicionais.
   ZIP não comprimido (formato ZIP padrão) com planilhas OOXML e células tipadas.
   Os valores são recebidos dos filtros já existentes; nenhuma consulta ou gravação é feita aqui. */
(function () {
  'use strict';
  const encoder = new TextEncoder();
  const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const esc = value => String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const column = index => {
    let n = index + 1, s = '';
    while (n) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); }
    return s;
  };
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let result = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) result = crcTable[(result ^ bytes[i]) & 255] ^ (result >>> 8);
    return (result ^ 0xFFFFFFFF) >>> 0;
  }
  function createZip(files) {
    if (files.length > 65535) throw Error('Quantidade de arquivos inválida para XLSX.');
    const chunks = [], directory = [];
    let offset = 0, centralSize = 0;
    for (const file of files) {
      const name = encoder.encode(file.name), data = encoder.encode(file.content);
      if (data.length > 0xFFFFFFFF) throw Error('Relatório excede o limite do formato ZIP.');
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true); // UTF-8, sem compactação
      lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true);
      local.set(name, 30);
      chunks.push(local, data);
      const entry = new Uint8Array(46 + name.length), ev = new DataView(entry.buffer);
      ev.setUint32(0, 0x02014b50, true); ev.setUint16(4, 20, true);
      ev.setUint16(6, 20, true); ev.setUint16(8, 0x0800, true);
      ev.setUint16(10, 0, true); ev.setUint32(16, crc, true);
      ev.setUint32(20, data.length, true); ev.setUint32(24, data.length, true);
      ev.setUint16(28, name.length, true); ev.setUint32(42, offset, true);
      entry.set(name, 46); directory.push(entry);
      offset += local.length + data.length; centralSize += entry.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
    return new Blob([...chunks, ...directory, end], { type: MIME });
  }
  function excelDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return null;
    const date = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    return Math.round(date.getTime() / 86400000 + 25569);
  }
  function makeSheet(spec) {
    const headers = spec.headers || [], rows = spec.rows || [];
    if (!headers.length || headers.length > 100) throw Error('Colunas inválidas para exportação.');
    if (rows.length > 1048575) throw Error('O Excel aceita até 1.048.576 linhas por planilha.');
    const currency = new Set(spec.currencyColumns || []), dates = new Set(spec.dateColumns || []);
    const cols = headers.map((_, i) => {
      const width = Math.min(50, Math.max(14, Number(spec.widths?.[i]) || (i === 2 ? 35 : 20)));
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
    }).join('');
    const cell = (value, r, c, heading) => {
      const ref = column(c) + r;
      if (value === null || value === undefined || value === '') return `<c r="${ref}"/>`;
      if (!heading && dates.has(c)) {
        const serial = excelDate(String(value));
        if (serial !== null) return `<c r="${ref}" s="3"><v>${serial}</v></c>`;
      }
      if (!heading && typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${ref}"${currency.has(c) ? ' s="2"' : ''}><v>${value}</v></c>`;
      }
      // inlineStr impede que conteúdo digitado pelo usuário seja executado como fórmula.
      return `<c r="${ref}"${heading ? ' s="1"' : ''} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
    };
    const body = [`<row r="1">${headers.map((x, i) => cell(x, 1, i, true)).join('')}</row>`];
    for (let i = 0; i < rows.length; i++) {
      const values = rows[i];
      body.push(`<row r="${i + 2}">${headers.map((_, j) => cell(values[j], i + 2, j, false)).join('')}</row>`);
    }
    const last = column(headers.length - 1) + (rows.length + 1);
    return XML + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<dimension ref="A1:${last}"/>` +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      `<cols>${cols}</cols><sheetData>${body.join('')}</sheetData>` +
      `<autoFilter ref="A1:${last}"/></worksheet>`;
  }
  const styles = XML +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;[Red](&quot;R$&quot; #,##0.00)"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF542F80"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
    '</styleSheet>';
  function saveWorkbook(filename, sheets) {
    if (!Array.isArray(sheets) || !sheets.length || sheets.length > 10) throw Error('Nenhuma planilha selecionada.');
    const names = new Set();
    const docs = sheets.map((sheet, i) => {
      const title = String(sheet.name || `Planilha ${i + 1}`).replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31) || `Planilha ${i + 1}`;
      if (names.has(title.toLowerCase())) throw Error('Nomes de planilhas duplicados.');
      names.add(title.toLowerCase());
      return { ...sheet, name: title };
    });
    const files = [
      { name: '[Content_Types].xml', content: XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + docs.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
      { name: '_rels/.rels', content: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', content: XML + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + docs.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', content: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + docs.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${docs.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', content: styles },
      ...docs.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: makeSheet(s) }))
    ];
    const blob = createZip(files);
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = filename.toLowerCase().endsWith('.xlsx') ? filename : filename + '.xlsx';
    link.style.display = 'none';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return blob;
  }
  window.SCD_EXCEL = Object.freeze({ saveWorkbook });
})();
