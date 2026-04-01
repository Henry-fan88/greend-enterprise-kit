import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { EsgData, User } from '../../store';
import { cn } from '../../lib/utils';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

const SECTIONS = ['Environmental', 'Social', 'Governance'] as const;

type EsgField = 'id' | 'value' | 'unit' | 'category' | 'section' | 'scope' | 'department' | 'parentId';

const FIELDS: { key: EsgField; label: string; required: boolean; hint: string }[] = [
  { key: 'id',         label: 'KPI Name / ID',        required: true,  hint: 'Unique name of the indicator' },
  { key: 'value',      label: 'Numeric Value',         required: false, hint: 'The number for the selected year' },
  { key: 'unit',       label: 'Unit',                  required: false, hint: 'e.g. tCO2e, kWh, %' },
  { key: 'category',   label: 'Category',              required: false, hint: 'User-defined grouping label' },
  { key: 'section',    label: 'Section (E / S / G)',   required: false, hint: 'Environmental, Social, or Governance' },
  { key: 'scope',      label: 'Scope',                 required: false, hint: 'Only used for Environmental section' },
  { key: 'department', label: 'Department',            required: false, hint: 'e.g. Sustainability, Factory' },
  { key: 'parentId',   label: 'Parent KPI',            required: false, hint: 'Parent record ID for sub-indicators' },
];

const KEYWORDS: Record<EsgField, string[]> = {
  id:         ['name', 'kpi', 'metric', 'id', 'indicator', 'item', 'title', 'description', 'key'],
  value:      ['value', 'amount', 'quantity', 'data', 'figure', 'number', 'total', 'count'],
  unit:       ['unit', 'uom', 'measure', 'measurement'],
  category:   ['category', 'cat', 'group', 'type', 'classif'],
  section:    ['section', 'pillar', 'esg', 'environmental', 'social', 'governance', 'domain'],
  scope:      ['scope'],
  department: ['department', 'dept', 'division', 'team', 'bu'],
  parentId:   ['parent', 'parentid', 'sub'],
};

function autoSuggest(headers: string[]): Record<EsgField, string | null> {
  const result: Record<EsgField, string | null> = {
    id: null, value: null, unit: null, category: null,
    section: null, scope: null, department: null, parentId: null,
  };
  for (const field of FIELDS) {
    const kws = KEYWORDS[field.key];
    for (const header of headers) {
      if (kws.some(kw => header.toLowerCase().includes(kw))) {
        result[field.key] = header;
        break;
      }
    }
  }
  return result;
}

function columnLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function readUint32LE(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
}

/**
 * Parse the xlsx zip binary and return a map of cell address → XF style index.
 * Uses DecompressionStream (available in all modern browsers) to deflate sheet XML.
 * Falls back to an empty map if the browser doesn't support DecompressionStream.
 */
async function extractCellXfMap(bytes: Uint8Array): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (typeof DecompressionStream === 'undefined') return map;

  let offset = 0;
  while (offset + 30 < bytes.length) {
    // Local file header signature: PK\x03\x04
    if (bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4B ||
        bytes[offset + 2] !== 0x03 || bytes[offset + 3] !== 0x04) {
      break; // no more local headers
    }

    const compression   = bytes[offset + 8]  | (bytes[offset + 9]  << 8);
    const compressedSz  = readUint32LE(bytes, offset + 18);
    const fileNameLen   = bytes[offset + 26] | (bytes[offset + 27] << 8);
    const extraLen      = bytes[offset + 28] | (bytes[offset + 29] << 8);
    const fileName      = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + fileNameLen));
    const dataStart     = offset + 30 + fileNameLen + extraLen;

    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(fileName)) {
      try {
        let xmlText: string;
        const raw = bytes.slice(dataStart, dataStart + compressedSz);

        if (compression === 0) {
          // STORE — no compression
          xmlText = new TextDecoder().decode(raw);
        } else if (compression === 8) {
          // DEFLATE
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          writer.write(raw);
          writer.close();

          const chunks: Uint8Array[] = [];
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value as Uint8Array);
          }
          const total = chunks.reduce((s, c) => s + c.length, 0);
          const buf = new Uint8Array(total);
          let pos = 0;
          for (const c of chunks) { buf.set(c, pos); pos += c.length; }
          xmlText = new TextDecoder().decode(buf);
        } else {
          offset = dataStart + compressedSz;
          continue;
        }

        // Extract <c r="A1" s="12" ...> attributes
        // Attribute order can vary, so we parse the full opening tag
        const tagRe = /<c\b([^>]*)>/g;
        let m: RegExpExecArray | null;
        while ((m = tagRe.exec(xmlText)) !== null) {
          const attrs = m[1];
          const rM = /\br="([A-Z]+\d+)"/.exec(attrs);
          const sM = /\bs="(\d+)"/.exec(attrs);
          if (rM && sM) map.set(rM[1], parseInt(sM[1], 10));
        }
        break; // first sheet is enough
      } catch {
        // parse failure — leave map empty, fall back gracefully
      }
    }

    offset = dataStart + compressedSz;
  }

  return map;
}

// ── Component ──────────────────────────────────────────────────────────────

type WizardStep = 'setup' | 'mapping' | 'preview';

type Props = {
  file: File;
  existingData: EsgData[];
  existingYears: number[];
  user: User;
  onConfirm: (records: EsgData[], year: number) => void;
  onClose: () => void;
};

export default function ImportWizard({ file, existingData, existingYears, user, onConfirm, onClose }: Props) {
  const [step, setStep] = useState<WizardStep>('setup');

  // Setup step
  const defaultYear = existingYears.length > 0 ? existingYears[existingYears.length - 1] : new Date().getFullYear();
  const [yearMode, setYearMode] = useState<'existing' | 'new'>(existingYears.length > 0 ? 'existing' : 'new');
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [newYearInput, setNewYearInput] = useState('');
  const [dataStartRow, setDataStartRow] = useState(2);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // Mapping step
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<EsgField, string | null>>({
    id: null, value: null, unit: null, category: null,
    section: null, scope: null, department: null, parentId: null,
  });

  // XF indent detection: cell address → XF index, and the XF table from XLSX styles
  const [cellXfMap, setCellXfMap] = useState<Map<string, number>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [xfTable, setXfTable] = useState<any[]>([]);

  // Parse file on mount
  useEffect(() => {
    // 1. Use XLSX to get raw cell values and the XF style table
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellStyles: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const all = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        setRawRows(all);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setXfTable((wb as any).Styles?.CellXf ?? []);
      } catch {
        setFileError('Failed to read the Excel file. Please ensure it is a valid .xlsx or .xls file.');
      }
    };
    reader.readAsBinaryString(file);

    // 2. Also parse as ArrayBuffer to extract per-cell XF indices from the raw zip XML
    file.arrayBuffer().then(async (buf) => {
      try {
        const map = await extractCellXfMap(new Uint8Array(buf));
        setCellXfMap(map);
      } catch {
        // non-critical — indent detection just won't work for this file
      }
    });
  }, [file]);

  const targetYear = yearMode === 'existing' ? selectedYear : parseInt(newYearInput, 10);
  const yearValid = yearMode === 'existing'
    ? true
    : /^\d{4}$/.test(newYearInput) && parseInt(newYearInput, 10) >= 1900 && parseInt(newYearInput, 10) <= 2100;

  const proceedToMapping = () => {
    const headerIdx = dataStartRow - 2; // 0-based index of the header row
    let headers: string[];
    let dataRows: Record<string, any>[];

    if (headerIdx < 0 || headerIdx >= rawRows.length) {
      const maxCols = Math.max(...rawRows.map(r => r.length));
      headers = Array.from({ length: maxCols }, (_, i) => columnLetter(i));
      dataRows = rawRows.slice(dataStartRow - 1).map(row =>
        Object.fromEntries(headers.map((h, i) => [h, (row as any[])[i]]))
      );
    } else {
      headers = (rawRows[headerIdx] as any[])
        .map((h: any) => String(h ?? '').trim())
        .filter(Boolean);
      dataRows = rawRows.slice(dataStartRow - 1).map(row =>
        Object.fromEntries(headers.map((h, i) => [h, (row as any[])[i]]))
      );
    }

    setSheetHeaders(headers);
    setParsedRows(dataRows.filter(r => Object.values(r).some(v => v !== undefined && v !== null && v !== '')));
    setMapping(autoSuggest(headers));
    setStep('mapping');
  };

  /**
   * Check whether the cell in the KPI-name column at a given parsedRow index
   * has Excel's native indent (indent ≥ 1 in Format Cells → Alignment).
   * Falls back to leading-whitespace detection if XF data is unavailable.
   */
  const isRowIndented = (parsedRowIdx: number, rawCellValue: string): boolean => {
    // Primary: Excel native indent via XF table
    if (cellXfMap.size > 0 && xfTable.length > 0 && mapping.id) {
      const kpiColIdx = sheetHeaders.indexOf(mapping.id);
      if (kpiColIdx >= 0) {
        const excelCol = columnLetter(kpiColIdx);
        const excelRow = dataStartRow + parsedRowIdx;   // 1-based Excel row
        const addr = `${excelCol}${excelRow}`;
        const xfIdx = cellXfMap.get(addr);
        if (xfIdx !== undefined) {
          const xf = xfTable[xfIdx];
          const indent = parseInt(xf?.alignment?.indent ?? '0', 10);
          return indent > 0;
        }
      }
    }
    // Fallback: leading whitespace / non-breaking space in the raw text
    return /^[\s\u00a0]+/.test(rawCellValue);
  };

  const buildRecords = (): EsgData[] => {
    const ts = new Date().toISOString();
    let lastTopLevelId: string | null = null;

    return parsedRows
      .filter(row => mapping.id && String(row[mapping.id] ?? '').trim() !== '')
      .map((row, idx) => {
        const rawIdValue = String(row[mapping.id!] ?? '');
        const isIndented = isRowIndented(idx, rawIdValue);
        const id = rawIdValue.trim();

        if (!isIndented) lastTopLevelId = id;

        const explicitParentId = mapping.parentId && row[mapping.parentId]
          ? String(row[mapping.parentId]).trim()
          : null;
        const resolvedParentId = explicitParentId
          ?? (isIndented ? (lastTopLevelId ?? undefined) : undefined)
          ?? existingData.find(d => d.id === id)?.parentId;

        const rawSection = mapping.section ? String(row[mapping.section] ?? '').trim() : '';
        const section = (SECTIONS as readonly string[]).includes(rawSection)
          ? rawSection as EsgData['section']
          : undefined;
        const rawScope = mapping.scope ? String(row[mapping.scope] ?? '').trim() : '';
        const existing = existingData.find(d => d.id === id);

        return {
          id,
          parentId: resolvedParentId || undefined,
          category: (mapping.category && row[mapping.category]
            ? String(row[mapping.category]).trim()
            : undefined) ?? existing?.category,
          section: section ?? existing?.section,
          scope: section === 'Environmental' && rawScope ? rawScope : existing?.scope,
          yearlyValues: {
            ...(existing?.yearlyValues ?? {}),
            [targetYear]: mapping.value ? (Number(row[mapping.value]) || 0) : 0,
          },
          unit: (mapping.unit && row[mapping.unit]
            ? String(row[mapping.unit]).trim()
            : '') || existing?.unit || '',
          department: (mapping.department && row[mapping.department]
            ? String(row[mapping.department]).trim()
            : '') || existing?.department || user.department,
          lastModifiedBy: [
            ...(existing?.lastModifiedBy ?? []),
            { userId: user.id, userName: user.name, timestamp: ts, year: targetYear, field: 'created', newValue: 'imported' },
          ],
        };
      });
  };

  const sampleValue = (col: string | null): string => {
    if (!col || parsedRows.length === 0) return '—';
    const v = parsedRows[0][col];
    return v !== undefined && v !== null && v !== '' ? String(v) : '—';
  };

  const handleConfirm = () => onConfirm(buildRecords(), targetYear);

  const previewRecords = buildRecords().slice(0, 5);

  // ── Step indicator ──────────────────────────────────────────────────────

  const STEPS: { key: WizardStep; label: string }[] = [
    { key: 'setup',   label: 'Year & Range' },
    { key: 'mapping', label: 'Column Mapping' },
    { key: 'preview', label: 'Preview' },
  ];
  const stepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold">Import Excel Data</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">

          {/* Step indicator */}
          <div className="flex items-center space-x-1 mb-6">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className="flex items-center space-x-1.5">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                    i < stepIndex   ? 'bg-gray-800 text-white' :
                    i === stepIndex ? 'bg-black text-white' :
                                      'bg-gray-200 text-gray-500'
                  )}>
                    {i < stepIndex ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={cn(
                    'text-xs',
                    i === stepIndex ? 'font-medium text-black' : 'text-gray-400'
                  )}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-gray-200 mx-1" />}
              </React.Fragment>
            ))}
          </div>

          {fileError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {fileError}
            </div>
          )}

          {/* ── Step 1: Setup ── */}
          {step === 'setup' && (
            <div className="space-y-6">

              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  Which year does this data belong to?
                </label>
                <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                    <button
                      onClick={() => setYearMode('existing')}
                      disabled={existingYears.length === 0}
                      className={cn(
                        'px-3 py-1.5 transition-colors',
                        yearMode === 'existing' ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
                        existingYears.length === 0 && 'opacity-40 cursor-not-allowed'
                      )}
                    >Existing year</button>
                    <button
                      onClick={() => setYearMode('new')}
                      className={cn(
                        'px-3 py-1.5 transition-colors',
                        yearMode === 'new' ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                      )}
                    >New year</button>
                  </div>
                  {yearMode === 'existing' ? (
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                    >
                      {existingYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  ) : (
                    <input
                      type="number"
                      placeholder="e.g. 2025"
                      value={newYearInput}
                      onChange={e => setNewYearInput(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28"
                    />
                  )}
                </div>
              </div>

              {/* Data start row */}
              {rawRows.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">
                    Data starts at row
                    <span className="ml-1 text-xs font-normal text-gray-500">
                      — the row just above is treated as column headers
                    </span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={rawRows.length}
                    value={dataStartRow}
                    onChange={e => setDataStartRow(Math.max(1, parseInt(e.target.value) || 1))}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24 mb-3"
                  />
                  <div className="border border-gray-200 rounded-lg overflow-auto max-h-44">
                    <table className="text-xs w-full">
                      <tbody>
                        {rawRows.slice(0, 10).map((row, ri) => {
                          const isHeader = ri === dataStartRow - 2;
                          const isData   = ri >= dataStartRow - 1;
                          return (
                            <tr key={ri} className={cn(
                              isHeader ? 'bg-blue-50 font-semibold text-blue-800' :
                              isData   ? 'bg-white hover:bg-gray-50' :
                                         'bg-gray-50 text-gray-400'
                            )}>
                              <td className="px-2 py-1 border-r border-gray-100 text-gray-400 select-none w-8 text-center shrink-0">
                                {ri + 1}
                              </td>
                              {(row as any[]).slice(0, 8).map((cell, ci) => (
                                <td key={ci} className="px-2 py-1 border-r border-gray-100 truncate max-w-[110px]">
                                  {cell !== undefined && cell !== null ? String(cell) : ''}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {dataStartRow > 1
                      ? `Row ${dataStartRow - 1} (highlighted) = column headers · Row ${dataStartRow}+ = data`
                      : 'Row 1 = data (no header row — columns will be labeled A, B, C…)'}
                  </p>
                </div>
              )}

              {rawRows.length === 0 && !fileError && (
                <p className="text-sm text-gray-400 italic">Reading file…</p>
              )}
            </div>
          )}

          {/* ── Step 2: Column Mapping ── */}
          {step === 'mapping' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                The app has made its best guess. Review each row and adjust if needed.
                The <span className="font-medium text-black">KPI Name / ID</span> field is required.
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-[38%]">Field</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-[38%]">Your column</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-[24%]">Sample value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELDS.map(field => (
                      <tr key={field.key} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800 text-sm">
                            {field.label}
                            {field.required && <span className="ml-0.5 text-red-500">*</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{field.hint}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={mapping[field.key] ?? ''}
                            onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value || null }))}
                            className={cn(
                              'w-full border rounded-lg px-2 py-1.5 text-xs bg-white',
                              field.required && !mapping[field.key]
                                ? 'border-red-300 focus:outline-none focus:ring-1 focus:ring-red-300'
                                : 'border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300'
                            )}
                          >
                            <option value="">— Not mapped —</option>
                            {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 truncate max-w-[80px]">
                          {sampleValue(mapping[field.key])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {parsedRows.length} data rows detected · year:{' '}
                <span className="font-medium text-gray-600">{targetYear}</span>
                {cellXfMap.size > 0 && (
                  <span className="ml-2 text-emerald-600">· indent detection active</span>
                )}
              </p>
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 'preview' && (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Showing first {previewRecords.length} of{' '}
                {buildRecords().length} records for{' '}
                <span className="font-medium text-black">{targetYear}</span>.
              </p>
              <div className="border border-gray-200 rounded-lg overflow-auto max-h-60">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">KPI Name</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Parent</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Value</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Unit</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Section</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRecords.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium truncate max-w-[130px]">
                          {r.parentId
                            ? <span className="ml-3 text-gray-500">↳ {r.id}</span>
                            : r.id}
                        </td>
                        <td className="px-3 py-2 text-gray-500 truncate max-w-[90px] text-xs">{r.parentId || '—'}</td>
                        <td className="px-3 py-2">{r.yearlyValues[targetYear] ?? '—'}</td>
                        <td className="px-3 py-2">{r.unit || '—'}</td>
                        <td className="px-3 py-2">{r.section || '—'}</td>
                        <td className="px-3 py-2">{r.category || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Rows indented in Excel are automatically detected as sub-items (↳) of the nearest
                non-indented KPI above them. Records whose KPI Name already exists will have
                their {targetYear} value updated; all other years remain unchanged.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => {
              if (step === 'setup') onClose();
              else if (step === 'mapping') setStep('setup');
              else setStep('mapping');
            }}
            className="flex items-center space-x-1 text-sm text-gray-600 hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{step === 'setup' ? 'Cancel' : 'Back'}</span>
          </button>

          {step !== 'preview' ? (
            <button
              disabled={
                !!fileError ||
                rawRows.length === 0 ||
                (step === 'setup' && !yearValid) ||
                (step === 'mapping' && !mapping.id)
              }
              onClick={() => {
                if (step === 'setup') proceedToMapping();
                else setStep('preview');
              }}
              className="flex items-center space-x-1.5 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={buildRecords().length === 0}
              className="flex items-center space-x-1.5 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Import ({buildRecords().length} records)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
