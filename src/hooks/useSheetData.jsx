import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSheet, insertRow, updateRow, deleteRow } from '@/services/api';

// Convert an object to a flat row array in the order defined by the sheet headers.
// Arrays (e.g. pageAccess) are JSON-serialised so they survive a round-trip.
function toRow(headers, item) {
  return headers.map(h => {
    const v = item[h];
    if (Array.isArray(v)) return JSON.stringify(v);
    return v != null ? String(v) : '';
  });
}

// Diff two snapshots of an entity array and return what changed.
// oldArr contains _row; newArr may or may not (new items won't have it).
function diff(oldArr, newArr, keyField) {
  const oldMap = new Map(oldArr.map(x => [String(x[keyField]), x]));
  const newKeys = new Set(newArr.map(x => String(x[keyField])));

  const inserts = newArr.filter(x => !oldMap.has(String(x[keyField])));
  const deletes = oldArr.filter(x => !newKeys.has(String(x[keyField])));

  const updates = newArr
    .filter(x => {
      const prev = oldMap.get(String(x[keyField]));
      if (!prev) return false;
      const { _row: _a, ...a } = prev;
      const { _row: _b, ...b } = x;
      return JSON.stringify(a) !== JSON.stringify(b);
    })
    .map(x => ({ ...x, _row: oldMap.get(String(x[keyField]))._row }));

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
export function useSheetData(sheetName, keyField) {
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
        internal.current = rows;
        setDataState(rows.map(({ _row, ...rest }) => rest));
      })
      .catch(err => console.error(`[useSheetData] ${sheetName}:`, err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sheetName]);

  // ── Setter ────────────────────────────────────────────────────────────────
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
    const oldMap = new Map(oldInternal.map(x => [String(x[keyField]), x]));

    // rebuild internal: carry over existing _row where available
    const newInternal = newClean.map(x => {
      const prev = oldMap.get(String(x[keyField]));
      return prev ? { ...x, _row: prev._row } : { ...x }; // new items: no _row yet
    });

    // compute diff BEFORE the optimistic update so we compare old vs new correctly
    const changes = diff(oldInternal, newInternal, keyField);

    // optimistic state update (UI responds instantly)
    internal.current = newInternal;
    setDataState(newClean);

    if (!headers.current.length) return; // sheet not loaded yet; skip sync

    // ── deletes (process bottom-to-top so earlier row indices stay valid) ──
    const sortedDeletes = [...changes.deletes].sort((a, b) => (b._row ?? 0) - (a._row ?? 0));
    for (const item of sortedDeletes) {
      try {
        await deleteRow(sheetName, item._row);
        // shift _row of rows that were below the deleted one
        internal.current = internal.current
          .filter(x => String(x[keyField]) !== String(item[keyField]))
          .map(x => x._row > item._row ? { ...x, _row: x._row - 1 } : x);
      } catch (err) {
        console.error(`[useSheetData] delete failed in "${sheetName}":`, err);
      }
    }

    // ── updates ───────────────────────────────────────────────────────────
    for (const item of changes.updates) {
      try {
        const prev = oldMap.get(String(item[keyField]));
        const diffItem = { ...item };
        if (prev) {
          headers.current.forEach(h => {
            if (h !== keyField && String(diffItem[h] ?? '') === String(prev[h] ?? '')) {
              diffItem[h] = '';
            }
          });
        }
        await updateRow(sheetName, item._row, toRow(headers.current, diffItem));
      } catch (err) {
        console.error(`[useSheetData] update failed in "${sheetName}":`, err);
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
          !x._row && String(x[keyField]) === String(item[keyField])
            ? { ...x, _row: assignedRow }
            : x
        );
      } catch (err) {
        console.error(`[useSheetData] insert failed in "${sheetName}":`, err);
      }
    }
  }, [sheetName, keyField]); // stable — does not depend on data state

  // ── Refetch: reload data from sheet (call after a direct insertRow) ──────
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

  return [data, setData, loading, refetch];
}
