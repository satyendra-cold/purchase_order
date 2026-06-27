const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;

function parseJSON(text) {
  const t = (text || '').trim();
  if (!t) throw new Error('Empty response from server');
  try { return JSON.parse(t); }
  catch { throw new Error('Invalid response from server'); }
}

// ── GET fetch (no CORS issues) ─────────────────────────────────────────────
async function getParams(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SCRIPT_URL}?${qs}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const json = parseJSON(await res.text());
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json;
}

// ── POST: always routed through /api/upload (Vite proxy in dev, Vercel function in prod)
async function postParams(params) {
  const url = '/api/upload';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status}`);
  const json = parseJSON(await res.text());
  if (!json.success) throw new Error(json.error || 'POST failed');
  return json;
}

// ── Sheet read ─────────────────────────────────────────────────────────────
export async function fetchSheet(sheetName) {
  const url = `${SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch "${sheetName}": ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || `Error fetching "${sheetName}"`);

  const rows = json.data || [];
  const headerRow = json.headerRow || 1;
  const rowIndices = json.rowIndices || null;
  if (rows.length < 1) return { headers: [], data: [] };

  const headers = rows[0].map(String);
  const data = [];

  rows.slice(1).forEach((row, i) => {
    if (!row.some(c => c !== '' && c != null)) return;
    const obj = { _row: rowIndices ? rowIndices[i] : (i + headerRow + 1) };
    headers.forEach((h, j) => {
      let val = row[j] ?? '';
      if (typeof val === 'string' && val.startsWith('[')) {
        try { val = JSON.parse(val); } catch (_) { /* keep as string */ }
      }
      obj[h] = val;
    });
    data.push(obj);
  });

  return { headers, data };
}

// ── Write operations via POST (avoiding CORS and URL length limits) ─────────
export const insertRow = (sheetName, rowData) =>
  postParams({ action: 'insert', sheetName, rowData: JSON.stringify(rowData) });

// POST-based insert — use when rowData contains large values (e.g. base64 images)
export const insertRowPost = (sheetName, rowData) =>
  postParams({ action: 'insert', sheetName, rowData: JSON.stringify(rowData) });

export const updateRow = (sheetName, rowIndex, rowData) =>
  postParams({ action: 'update', sheetName, rowIndex, rowData: JSON.stringify(rowData) });

export const updateCell = (sheetName, rowIndex, columnIndex, value) =>
  postParams({ action: 'updateCell', sheetName, rowIndex, columnIndex, value });

export const deleteRow = (sheetName, rowIndex) =>
  postParams({ action: 'delete', sheetName, rowIndex });

export const markDeleted = (sheetName, rowIndex, columnIndex, value = 'Yes') =>
  postParams({ action: 'markDeleted', sheetName, rowIndex, columnIndex, value });

export const batchInsert = (sheetName, rowsData) =>
  postParams({ action: 'batchInsert', sheetName, rowsData: JSON.stringify(rowsData) });

// ── File upload stays POST (base64 too large for URL) ─────────────────────
export const uploadFile = (base64Data, fileName, mimeType, folderId) =>
  postParams({ action: 'uploadFile', base64Data, fileName, mimeType, folderId });
