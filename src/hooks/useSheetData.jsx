import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSheet, insertRow, updateCell, updateRow, deleteRow } from '@/services/api';

const isReadOnlyField = (h) =>
  /^planned\d*$/i.test(h) ||
  /^delay\d*$/i.test(h);

function getValueForHeader(item, h) {
  if (!item) return '';
  if (item[h] !== undefined && item[h] !== null) return item[h];

  const target = String(h).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (target === 'transportername' || target === 'transporter') {
    return item.transporterName ?? item['Transporter name'] ?? item['Transporter Name'] ?? item['Transporter'] ?? '';
  }
  if (target === 'vehiclenumber') {
    return item.vehicleNumber ?? item['Vehicle Number'] ?? item['Vehicle number'] ?? '';
  }
  if (target === 'deliverylocation') {
    return item.deliveryLocation ?? item['Delivery Location'] ?? item['Delivery location'] ?? item.location ?? item['Location'] ?? '';
  }
  if (target === 'deliveryaddress') {
    return item.deliveryAddress ?? item['Delivery Address'] ?? item['Delivery address'] ?? item.address ?? item['Address'] ?? '';
  }
  if (target === 'ponumber') {
    return item.poNumber ?? item['PO Number'] ?? '';
  }
  if (target === 'vendorname') {
    return item.vendorName ?? item['Vendor Name'] ?? '';
  }
  if (target === 'totalquantity') {
    return item.totalQuantity ?? item['Total Quantity'] ?? '';
  }
  if (target === 'quantity') {
    return item.quantity ?? item['Quantity'] ?? '';
  }
  if (target === 'serialno') {
    return item.serialNo ?? item['Serial No'] ?? '';
  }
  if (target === 'location') {
    return item.location ?? item['Location'] ?? '';
  }
  if (target === 'address') {
    return item.address ?? item['Address'] ?? '';
  }
  if (target === 'createdby') {
    return item.createdBy ?? item['Created By'] ?? '';
  }
  if (target === 'poreceiveddate') {
    return item.poReceivedDate ?? item['PO Received Date'] ?? '';
  }
  if (target === 'poexpireddate') {
    return item.poExpiredDate ?? item['PO Expired Date'] ?? '';
  }
  if (target === 'popdf' || target === 'popdfname') {
    return item.poPdfName || item.poPdfUrl || item.poPdf || item['PO PDF'] || '';
  }
  if (target === 'billnumber') {
    return item.billNumber ?? item['Bill Number'] ?? '';
  }
  if (target === 'billamount') {
    return item.billAmount ?? item['Bill Amount'] ?? '';
  }
  if (target === 'billdate') {
    return item.billDate ?? item['Bill Date'] ?? '';
  }
  if (target === 'billpdf') {
    return item.billPdf ?? item['Bill PDF'] ?? '';
  }
  if (target === 'actualdate') {
    return item.actualDate ?? item['Actual Date'] ?? '';
  }
  if (target === 'updatedby') {
    return item.updatedBy ?? item['Updated By'] ?? '';
  }
  if (target === 'deletestatus') {
    return item.deleteStatus ?? item['Delete Status'] ?? '';
  }
  if (target === 'deliveredqty') {
    return item.deliveredQty ?? item['Delivered Qty'] ?? '';
  }
  if (target === 'pendingqty') {
    return item.pendingQty ?? item['Pending Qty'] ?? '';
  }
  if (target === 'cancelqty') {
    return item.cancelQty ?? item['Cancel Qty'] ?? '';
  }
  if (target === 'damageqty') {
    return item.damageQty ?? item['Damage Qty'] ?? item['Damage Quantity'] ?? item.BD ?? item['BD'] ?? '';
  }

  for (const [k, v] of Object.entries(item)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === target && v !== undefined && v !== null) {
      return v;
    }
  }

  return '';
}

// Convert an object to a flat row array in the order defined by the sheet headers.
// Arrays (e.g. pageAccess) are JSON-serialised so they survive a round-trip.
// Read-only fields (planned*, delay*) are always sent as '' so the sheet formula
// is never overwritten.
function toRow(headers, item) {
  return headers.map((h, idx) => {
    if (isReadOnlyField(h)) return ''; // never overwrite sheet-computed columns
    let v = getValueForHeader(item, h);
    if (idx === 54 && (!v || h === 'BC')) v = item.narration ?? item.narretion ?? item.BC ?? item['Narration'] ?? '';
    if (idx === 55 && (!v || h === 'BD')) v = item.damageQty ?? item.BD ?? item['Damage Qty'] ?? '';
    if (Array.isArray(v)) return JSON.stringify(v);
    return v != null ? String(v) : '';
  });
}

// Diff two snapshots of an entity array and return what changed.
// oldArr contains _row; newArr may or may not (new items won't have it).
// Read-only fields (planned*, delay*) are excluded from the comparison —
// they are sheet-computed and never written back, so changes to them (e.g.
// the sheet recalculates a delay after an actual date is saved) must not
// generate spurious updateRow calls.
function stripReadOnly(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !isReadOnlyField(k))
  );
}

function getKeyVal(obj, keyField) {
  if (!obj || !keyField) return '';
  if (obj[keyField] != null && obj[keyField] !== '') return String(obj[keyField]);
  
  // Case/space/punctuation-insensitive fallback
  const target = String(keyField).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === target && v != null && v !== '') {
      return String(v);
    }
  }
  return '';
}

function normalizeRow(row) {
  if (!row) return row;
  const tName = row.transporterName ?? row['Transporter name'] ?? row['Transporter Name'] ?? row['Transporter'] ?? '';
  const vNum = row.vehicleNumber ?? row['Vehicle Number'] ?? row['Vehicle number'] ?? '';
  const dLoc = row.deliveryLocation ?? row['Delivery Location'] ?? row['Delivery location'] ?? '';
  const dAddr = row.deliveryAddress ?? row['Delivery Address'] ?? row['Delivery address'] ?? '';
  const pNo = row.poNumber ?? row['PO Number'] ?? '';
  const vName = row.vendorName ?? row['Vendor Name'] ?? '';
  const tQty = row.totalQuantity ?? row['Total Quantity'] ?? '';
  const loc = row.location ?? row['Location'] ?? '';
  const addr = row.address ?? row['Address'] ?? '';
  const cBy = row.createdBy ?? row['Created By'] ?? '';
  const dStatus = row.deleteStatus ?? row['Delete Status'] ?? '';

  return {
    ...row,
    serialNo: row.serialNo ?? row['Serial No'] ?? '',
    'Serial No': row.serialNo ?? row['Serial No'] ?? '',
    poNumber: pNo,
    'PO Number': pNo,
    vendorName: vName,
    'Vendor Name': vName,
    totalQuantity: tQty,
    'Total Quantity': tQty,
    location: loc,
    'Location': loc,
    address: addr,
    'Address': addr,
    createdBy: cBy,
    'Created By': cBy,
    poReceivedDate: row.poReceivedDate ?? row['PO Received Date'] ?? '',
    'PO Received Date': row.poReceivedDate ?? row['PO Received Date'] ?? '',
    poExpiredDate: row.poExpiredDate ?? row['PO Expired Date'] ?? '',
    'PO Expired Date': row.poExpiredDate ?? row['PO Expired Date'] ?? '',
    poPdfName: row.poPdfName ?? row['PO PDF'] ?? '',
    'PO PDF': row.poPdfName ?? row['PO PDF'] ?? '',
    transporterName: tName,
    'Transporter name': tName,
    'Transporter Name': tName,
    'Transporter': tName,
    vehicleNumber: vNum,
    'Vehicle Number': vNum,
    'Vehicle number': vNum,
    deliveryLocation: dLoc,
    'Delivery Location': dLoc,
    'Delivery location': dLoc,
    deliveryAddress: dAddr,
    'Delivery Address': dAddr,
    'Delivery address': dAddr,
    deleteStatus: dStatus,
    'Delete Status': dStatus,
    deliveredQty: row.deliveredQty ?? row['Delivered Qty'] ?? '',
    'Delivered Qty': row.deliveredQty ?? row['Delivered Qty'] ?? '',
    narretion: row.narretion ?? row['Narretion'] ?? row.narration ?? row['Narration'] ?? row.BC ?? row['BC'] ?? '',
    narration: row.narretion ?? row['Narretion'] ?? row.narration ?? row['Narration'] ?? row.BC ?? row['BC'] ?? '',
    supplyQuantity1: row.supplyQuantity1 ?? row['Supply Quantity 1'] ?? '',
    receivedAmount: row.receivedAmount ?? row['Received Amount'] ?? '',
    supplyQuantity2: row.supplyQuantity2 ?? row['Supply Quantity 2'] ?? '',
    pendingQty: row.pendingQty ?? row['Pending Qty'] ?? '',
    'Pending Qty': row.pendingQty ?? row['Pending Qty'] ?? '',
    cancelQty: row.cancelQty ?? row['Cancel Qty'] ?? '',
    'Cancel Qty': row.cancelQty ?? row['Cancel Qty'] ?? '',
    damageQty: row.damageQty ?? row['Damage Qty'] ?? row['Damage Quantity'] ?? row.BD ?? row['BD'] ?? '',
  };
}

function diff(oldArr, newArr, keyField) {
  const oldMap = new Map(oldArr.map(x => [getKeyVal(x, keyField), x]));
  const newKeys = new Set(newArr.map(x => getKeyVal(x, keyField)));

  const inserts = newArr.filter(x => !oldMap.has(getKeyVal(x, keyField)));
  const deletes = oldArr.filter(x => !newKeys.has(getKeyVal(x, keyField)));

  const updates = newArr
    .filter(x => {
      const key = getKeyVal(x, keyField);
      const prev = oldMap.get(key);
      if (!prev) return false;
      const { _row: _a, ...a } = prev;
      const { _row: _b, ...b } = x;
      // Compare only writable fields — ignore planned*/delay* differences
      return JSON.stringify(stripReadOnly(a)) !== JSON.stringify(stripReadOnly(b));
    })
    .map(x => ({ ...x, _row: oldMap.get(getKeyVal(x, keyField))._row }));

  return { inserts, deletes, updates };
}

/**
 * Drop-in async replacement for useLocalStorage.
 *
 * Usage:
 *   const [data, setData, loading] = useSheetData('SheetName', 'keyField');
 *
 * - data      — clean array of objects (no _row); same shape pages already consume.
 * - setData   — accepts a new array OR a functional updater (prev => newArray).
 *               Updates state optimistically, then syncs to the sheet in background.
 * - loading   — true while the initial fetch is in flight.
 *
 * The hook tracks sheet row indices internally so it can issue precise
 * insertRow / updateRow / deleteRow calls without needing a full sheet rewrite.
 */
export function useSheetData(sheetName, keyField, { onError } = {}) {
  // internal state keeps _row on every item for sheet operations
  const internal = useRef([]);
  const headers  = useRef([]);

  // clean state exposed to components (no _row)
  const [data, setDataState] = useState([]);
  const dataRef = useRef([]);
  const [loading, setLoading] = useState(true);

  // keep refs in sync with latest state so async callbacks see fresh values
  useEffect(() => { dataRef.current = data; }, [data]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchSheet(sheetName)
      .then(({ headers: h, data: rows }) => {
        if (!alive) return;
        headers.current  = h;
        const normalizedRows = rows.map(({ _row, ...rest }) => ({ _row, ...normalizeRow(rest) }));
        internal.current = normalizedRows;
        setDataState(normalizedRows.map(({ _row, ...rest }) => rest));
      })
      .catch(err => console.error(`[useSheetData] ${sheetName}:`, err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sheetName]);

  // ── Setter ────────────────────────────────────────────────────────────────
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const setData = useCallback(async (valueOrUpdater) => {
    // resolve functional updater (e.g. setPrev(prev => [...prev, item]))
    const newClean =
      typeof valueOrUpdater === 'function'
        ? valueOrUpdater(dataRef.current)
        : valueOrUpdater;

    // no keyField → simple overwrite (used by locations array of strings, etc.)
    if (!keyField) {
      internal.current = newClean.map((item, i) => ({ _row: i + 2, ...item }));
      setDataState(newClean);
      return;
    }

    const oldInternal = internal.current;
    const oldMap = new Map(oldInternal.map(x => [getKeyVal(x, keyField), x]));

    // rebuild internal: carry over existing _row where available
    const newInternal = newClean.map(x => {
      const prev = oldMap.get(getKeyVal(x, keyField));
      return prev ? { ...x, _row: prev._row } : { ...x }; // new items: no _row yet
    });

    // compute diff BEFORE the optimistic update so we compare old vs new correctly
    const changes = diff(oldInternal, newInternal, keyField);

    // optimistic state update (UI responds instantly)
    internal.current = newInternal;
    setDataState(newClean.map(normalizeRow));

    if (!headers.current.length) return; // sheet not loaded yet; skip sync

    // ── deletes (process bottom-to-top so earlier row indices stay valid) ──
    const sortedDeletes = [...changes.deletes].sort((a, b) => (b._row ?? 0) - (a._row ?? 0));
    for (const item of sortedDeletes) {
      try {
        await deleteRow(sheetName, item._row);
        // shift _row of rows that were below the deleted one
        internal.current = internal.current
          .filter(x => getKeyVal(x, keyField) !== getKeyVal(item, keyField))
          .map(x => x._row > item._row ? { ...x, _row: x._row - 1 } : x);
      } catch (err) {
        console.error(`[useSheetData] delete failed in "${sheetName}":`, err);
        onErrorRef.current?.(`Delete failed: ${err.message}`);
      }
    }

    // ── updates — one updateCell call per changed writable field ─────────
    // Only the fields that actually changed are sent. planned*/delay* are
    // always excluded (isReadOnlyField) so sheet formulas are never touched.
    for (const item of changes.updates) {
      const prev = oldMap.get(getKeyVal(item, keyField));
      let col55Handled = false;
      let col56Handled = false;

      for (let i = 0; i < headers.current.length; i++) {
        const h = headers.current[i];
        if (isReadOnlyField(h)) continue; // never write planned* or delay*
        if (i === 54) col55Handled = true;
        if (i === 55) col56Handled = true;

        const newVal = getValueForHeader(item, h);
        const oldVal = prev ? getValueForHeader(prev, h) : undefined;
        // Skip fields that haven't changed
        if (oldVal !== undefined && String(newVal) === String(oldVal)) continue;
        const cellValue = Array.isArray(newVal) ? JSON.stringify(newVal) : String(newVal);
        try {
          await updateCell(sheetName, item._row, i + 1, cellValue);
        } catch (err) {
          console.error(`[useSheetData] updateCell failed for "${h}" in "${sheetName}":`, err);
          onErrorRef.current?.(`Failed to save "${h}": ${err.message}`);
        }
      }

      // Fallback for Column BC (55th column) if not updated by header match
      const bcVal = item.narration ?? item['Narration'] ?? item.BC ?? item['BC'] ?? item.narretion ?? item['Narretion'];
      const prevBcVal = prev ? (prev.narration ?? prev['Narration'] ?? prev.BC ?? prev['BC'] ?? prev.narretion ?? prev['Narretion']) : undefined;
      if (!col55Handled && bcVal !== undefined && String(bcVal) !== String(prevBcVal ?? '') && item._row) {
        try {
          await updateCell(sheetName, item._row, 55, String(bcVal));
        } catch (err) {
          console.error(`[useSheetData] updateCell col 55 (BC) failed in "${sheetName}":`, err);
        }
      }

      // Fallback for Column BD (56th column) if not updated by header match
      const bdVal = item.damageQty ?? item['Damage Qty'] ?? item['Damage Quantity'] ?? item.BD ?? item['BD'];
      const prevBdVal = prev ? (prev.damageQty ?? prev['Damage Qty'] ?? prev['Damage Quantity'] ?? prev.BD ?? prev['BD']) : undefined;
      if (!col56Handled && bdVal !== undefined && String(bdVal) !== String(prevBdVal ?? '') && item._row) {
        try {
          await updateCell(sheetName, item._row, 56, String(bdVal));
        } catch (err) {
          console.error(`[useSheetData] updateCell col 56 (BD) failed in "${sheetName}":`, err);
        }
      }
    }

    // ── inserts (appended to the end of the sheet) ─────────────────────────
    let nextRow = Math.max(1, ...internal.current.filter(x => x._row).map(x => x._row)) + 1;
    for (const item of changes.inserts) {
      try {
        await insertRow(sheetName, toRow(headers.current, item));
        // assign the new sheet row to the in-memory item
        const assignedRow = nextRow++;
        internal.current = internal.current.map(x =>
          !x._row && getKeyVal(x, keyField) === getKeyVal(item, keyField)
            ? { ...x, _row: assignedRow }
            : x
        );
      } catch (err) {
        console.error(`[useSheetData] insert failed in "${sheetName}":`, err);
        onErrorRef.current?.(`Insert failed: ${err.message}`);
      }
    }
  }, [sheetName, keyField]); // stable — does not depend on data state

  // ── Refetch: reload data from sheet ──────────────────────────────────────
  const refetch = useCallback(() => {
    setLoading(true);
    fetchSheet(sheetName)
      .then(({ headers: h, data: rows }) => {
        headers.current  = h;
        internal.current = rows;
        setDataState(rows.map(({ _row, ...rest }) => rest));
      })
      .catch(err => console.error(`[useSheetData] refetch ${sheetName}:`, err))
      .finally(() => setLoading(false));
  }, [sheetName]);

  // ── setLocalOnly: update React state WITHOUT syncing to sheet ─────────────
  // Use for optimistic updates when you handle the sheet sync yourself (patchItem).
  const setLocalOnly = useCallback((valueOrUpdater) => {
    const newClean =
      typeof valueOrUpdater === 'function'
        ? valueOrUpdater(dataRef.current)
        : valueOrUpdater;
    const oldMap = new Map(internal.current.map(x => [getKeyVal(x, keyField), x]));
    internal.current = newClean.map(x => {
      const prev = oldMap.get(getKeyVal(x, keyField));
      return prev ? { ...x, _row: prev._row } : { ...x };
    });
    setDataState(newClean.map(normalizeRow));
  }, [keyField]);

  // ── patchItem: write specific fields directly to sheet ────────────────────
  // Validates that all requested columns exist in the sheet, then writes the
  // entire row in one atomic updateRow call. Throws on any failure.
  const patchItem = useCallback(async (keyValue, fields, { onlySpecified = false } = {}) => {
    const internalItem = internal.current.find(
      x => String(x[keyField] ?? '') === String(keyValue) ||
           String(x['Serial No'] ?? '') === String(keyValue) ||
           String(x['serialNo'] ?? '') === String(keyValue) ||
           String(x['poNumber'] ?? '') === String(keyValue)
    );
    if (!internalItem?._row) throw new Error('Row not found — try refreshing the page.');
    if (!headers.current.length) throw new Error('Sheet not loaded — try refreshing the page.');

    const headerSet = new Set(headers.current);

    // Columns in `fields` that the sheet doesn't have — skip gracefully
    const unknownCols = Object.keys(fields).filter(
      k => !isReadOnlyField(k) && !headerSet.has(k)
    );
    if (unknownCols.length > 0) {
      console.warn(`[patchItem] "${sheetName}" sheet has no column(s): ${unknownCols.join(', ')} — skipping`);
    }

    // If NONE of the requested writable fields exist, the write would be a no-op — fail loudly
    const writableCols = Object.keys(fields).filter(k => !isReadOnlyField(k) && headerSet.has(k));
    if (writableCols.length === 0) {
      throw new Error(
        `Sheet "${sheetName}" is missing all required column(s): ${Object.keys(fields).join(', ')}. ` +
        `Add these headers to the Google Sheet and refresh the page.`
      );
    }

    // Write only the specified writable fields using updateCell to ensure non-patched columns, formulas, and formatting are untouched
    for (const colName of writableCols) {
      const colIndex = headers.current.indexOf(colName) + 1;
      if (colIndex > 0) {
        const val = fields[colName];
        const cellValue = Array.isArray(val) ? JSON.stringify(val) : (val != null ? String(val) : '');
        await updateCell(sheetName, internalItem._row, colIndex, cellValue);
      }
    }
  }, [sheetName, keyField]);

  return [data, setData, loading, refetch, setLocalOnly, patchItem];
}
