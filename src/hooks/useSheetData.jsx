import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSheet, insertRow, updateCell, updateRow, deleteRow, batchDelete, batchUpdateCells } from '@/services/api';

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
    return item.poReceivedDate ?? row['PO Received Date'] ?? '';
  }
  if (target === 'poexpireddate') {
    return item.poExpiredDate ?? row['PO Expired Date'] ?? '';
  }
  if (target === 'popdfname') {
    return item.poPdfName ?? row['PO PDF'] ?? '';
  }
  if (target === 'deletestatus') {
    return item.deleteStatus ?? item['Delete Status'] ?? '';
  }
  if (target === 'deliveredqty') {
    return item.deliveredQty ?? item['Delivered Qty'] ?? '';
  }
  if (target === 'narretion' || target === 'narration' || target === 'bc') {
    return item.narretion ?? item['Narretion'] ?? item.narration ?? item['Narration'] ?? item.BC ?? item['BC'] ?? '';
  }
  if (target === 'supplyquantity1') {
    return item.supplyQuantity1 ?? item['Supply Quantity 1'] ?? '';
  }
  if (target === 'receivedamount') {
    return item.receivedAmount ?? item['Received Amount'] ?? '';
  }
  if (target === 'supplyquantity2') {
    return item.supplyQuantity2 ?? item['Supply Quantity 2'] ?? '';
  }
  if (target === 'pendingqty') {
    return item.pendingQty ?? item['Pending Qty'] ?? '';
  }
  if (target === 'cancelqty') {
    return item.cancelQty ?? item['Cancel Qty'] ?? '';
  }
  if (target === 'damageqty' || target === 'bd') {
    return item.damageQty ?? item['Damage Qty'] ?? item['Damage Quantity'] ?? item.BD ?? item['BD'] ?? '';
  }
  if (target === 'extraqty' || target === 'bf') {
    return item.extraQty ?? item['Extra Qty'] ?? item.BF ?? item['BF'] ?? '';
  }
  if (target === 'supplycheck') {
    return item.supplyCheck ?? item['Supply Check'] ?? '';
  }
  if (target === 'billamount') {
    return item.billAmount ?? item['Bill Amount'] ?? '';
  }

  return '';
}

function toRow(headersList, item) {
  return headersList.map(h => {
    if (isReadOnlyField(h)) return '';
    const val = getValueForHeader(item, h);
    return Array.isArray(val) ? JSON.stringify(val) : (val ?? '');
  });
}

function rowEquals(headersList, itemA, itemB) {
  for (const h of headersList) {
    if (isReadOnlyField(h)) continue;
    const a = getValueForHeader(itemA, h);
    const b = getValueForHeader(itemB, h);
    if (String(a) !== String(b)) return false;
  }
  return true;
}

function cleanForDiff(obj) {
  if (!obj) return {};
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
    billAmount: row.billAmount ?? row['Bill Amount'] ?? '',
    'Bill Amount': row.billAmount ?? row['Bill Amount'] ?? '',
    damageQty: row.damageQty ?? row['Damage Qty'] ?? row['Damage Quantity'] ?? row.BD ?? row['BD'] ?? '',
    extraQty: row.extraQty ?? row['Extra Qty'] ?? row.BF ?? row['BF'] ?? '',
    'Extra Qty': row.extraQty ?? row['Extra Qty'] ?? row.BF ?? row['BF'] ?? '',
    supplyCheck: row.supplyCheck ?? row['Supply Check'] ?? '',
    'Supply Check': row.supplyCheck ?? row['Supply Check'] ?? '',
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
      return JSON.stringify(cleanForDiff(x)) !== JSON.stringify(cleanForDiff(prev));
    });

  return { inserts, updates, deletes };
}

// ── Global in-memory cache & event bus per sheet (persists across page navigations) ──────
const globalSheetCache = {};
const globalSheetListeners = {};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

function getValidCache(sheetName) {
  // Cache disabled: always return null to force fresh fetch
  return null;
}

// Auto-cleanup interval every 60 seconds to prune cache older than 10 minutes
if (typeof window !== 'undefined' && !window.__sheetCacheCleanerSet) {
  window.__sheetCacheCleanerSet = true;
  setInterval(() => {
    const now = Date.now();
    Object.keys(globalSheetCache).forEach((sName) => {
      if (sName === 'Login') return; // keep Login cache untouched
      if (globalSheetCache[sName] && now - globalSheetCache[sName].fetchedAt > CACHE_TTL_MS) {
        console.log(`[useSheetData] Auto-cleared 10-minute expired cache for "${sName}"`);
        delete globalSheetCache[sName];
      }
    });
  }, 60 * 1000);
}

function subscribeSheet(sheetName, callback) {
  if (!globalSheetListeners[sheetName]) globalSheetListeners[sheetName] = new Set();
  globalSheetListeners[sheetName].add(callback);
  return () => {
    globalSheetListeners[sheetName]?.delete(callback);
  };
}

function notifySheet(sheetName, cleanData, newInternal, newHeaders, sourceId) {
  if (globalSheetListeners[sheetName]) {
    globalSheetListeners[sheetName].forEach(cb => cb(cleanData, newInternal, newHeaders, sourceId));
  }
}

/**
 * Custom hook to read and update a Google Sheet via our serverless API proxy.
 *
 * Parameters:
 * - sheetName : string (e.g. 'FMS', 'Login', 'Vendors')
 * - keyField  : string (e.g. 'poNumber', 'id', '_row')
 * - options   : { onError: (msg) => void }
 *
 * Returns: [data, setData, loading]
 */
export function useSheetData(sheetName, keyField, { onError } = {}) {
  const instanceId = useRef(Math.random());
  const cached = getValidCache(sheetName);

  // internal state keeps _row on every item for sheet operations
  const internal = useRef(cached ? cached.internal : []);
  const headers  = useRef(cached ? cached.headers : []);

  // clean state exposed to components
  const [data, setDataState] = useState(cached ? cached.data : []);
  const dataRef = useRef(data);
  const [loading, setLoading] = useState(!cached);

  // keep refs in sync with latest state so async callbacks see fresh values
  useEffect(() => { dataRef.current = data; }, [data]);

  // helper to update memory state and global cache
  const updateGlobalCache = (newInternal, newHeaders) => {
    headers.current = newHeaders;
    internal.current = newInternal;
    const cleanData = newInternal.map(normalizeRow);
    // No global cache storage
    setDataState(cleanData);
    notifySheet(sheetName, cleanData, newInternal, newHeaders, instanceId.current);
  };

  // Subscribe to real-time updates from other component instances
  useEffect(() => {
    const unsub = subscribeSheet(sheetName, (cleanData, newInternal, newHeaders, sourceId) => {
      if (sourceId !== instanceId.current) {
        internal.current = newInternal;
        headers.current = newHeaders;
        setDataState(cleanData);
        setLoading(false);
      }
    });
    return unsub;
  }, [sheetName]);

  // ── Initial load / Silent revalidation ────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchSheet(sheetName)
      .then(({ headers: h, data: rows }) => {
        if (!alive) return;
        const normalizedRows = rows.map(({ _row, ...rest }) => ({ _row, ...normalizeRow(rest) }));
        updateGlobalCache(normalizedRows, h);
      })
      .catch(err => {
        console.error(`[useSheetData] ${sheetName}:`, err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [sheetName]);

  // ── Setter ────────────────────────────────────────────────────────────────
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const setData = useCallback(async (valueOrUpdater) => {
    const newClean =
      typeof valueOrUpdater === 'function'
        ? valueOrUpdater(dataRef.current)
        : valueOrUpdater;

    if (!keyField) {
      const newInternal = newClean.map((item, i) => ({ _row: i + 2, ...item }));
      updateGlobalCache(newInternal, headers.current);
      return;
    }

    const oldInternal = internal.current;
    const oldMap = new Map(oldInternal.map(x => [getKeyVal(x, keyField), x]));

    const newInternal = newClean.map(x => {
      const prev = oldMap.get(getKeyVal(x, keyField));
      return prev ? { ...x, _row: prev._row } : { ...x };
    });

    const changes = diff(oldInternal, newInternal, keyField);

    // Optimistically update memory state & global cache instantly
    updateGlobalCache(newInternal, headers.current);

    if (!headers.current.length) return;

    // ── deletes (use batchDelete when deleting multiple rows) ─────────────────
    if (changes.deletes.length > 0) {
      const deleteIndices = changes.deletes
        .map((item) => item._row)
        .filter((r) => r != null && !isNaN(r));

      if (deleteIndices.length > 1) {
        try {
          await batchDelete(sheetName, deleteIndices);
          const sorted = [...deleteIndices].sort((a, b) => b - a);
          let currentInt = internal.current;
          sorted.forEach((deletedRow) => {
            currentInt = currentInt
              .filter((x) => x._row !== deletedRow)
              .map((x) => (x._row > deletedRow ? { ...x, _row: x._row - 1 } : x));
          });
          updateGlobalCache(currentInt, headers.current);
        } catch (err) {
          console.error(`[useSheetData] batchDelete failed in "${sheetName}":`, err);
          onErrorRef.current?.(`Batch delete failed: ${err.message}`);
        }
      } else {
        const sortedDeletes = [...changes.deletes].sort((a, b) => (b._row ?? 0) - (a._row ?? 0));
        for (const item of sortedDeletes) {
          try {
            await deleteRow(sheetName, item._row);
            const currentInt = internal.current
              .filter((x) => getKeyVal(x, keyField) !== getKeyVal(item, keyField))
              .map((x) => (x._row > item._row ? { ...x, _row: x._row - 1 } : x));
            updateGlobalCache(currentInt, headers.current);
          } catch (err) {
            console.error(`[useSheetData] delete failed in "${sheetName}":`, err);
            onErrorRef.current?.(`Delete failed: ${err.message}`);
          }
        }
      }
    }

    // ── updates (batch cell updates per request) ───────────────────────────
    if (changes.updates.length > 0) {
      const cellUpdates = [];
      for (const item of changes.updates) {
        const prev = oldMap.get(getKeyVal(item, keyField));
        let col56Handled = false;
        let col57Handled = false;
        let col58Handled = false;

        for (let i = 0; i < headers.current.length; i++) {
          const h = headers.current[i];
          if (isReadOnlyField(h)) continue;
          if (i === 55) col56Handled = true;
          if (i === 56) col57Handled = true;
          if (i === 57) col58Handled = true;

          const newVal = getValueForHeader(item, h);
          const oldVal = prev ? getValueForHeader(prev, h) : undefined;
          if (oldVal !== undefined && String(newVal) === String(oldVal)) continue;

          const cellValue = Array.isArray(newVal) ? JSON.stringify(newVal) : String(newVal);
          cellUpdates.push({ rowIndex: item._row, columnIndex: i + 1, value: cellValue });
        }

        const bdVal = item.damageQty ?? item['Damage Qty'] ?? item['Damage Quantity'] ?? item.BD ?? item['BD'];
        const prevBdVal = prev ? (prev.damageQty ?? prev['Damage Qty'] ?? prev['Damage Quantity'] ?? prev.BD ?? prev['BD']) : undefined;
        if (!col56Handled && bdVal !== undefined && String(bdVal) !== String(prevBdVal ?? '') && item._row) {
          cellUpdates.push({ rowIndex: item._row, columnIndex: 56, value: String(bdVal) });
        }

        const beVal = item.vehicleNumber ?? item['Vehicle Number'] ?? item['Vehicle number'] ?? item.BE ?? item['BE'];
        const prevBeVal = prev ? (prev.vehicleNumber ?? prev['Vehicle Number'] ?? prev['Vehicle number'] ?? prev.BE ?? prev['BE']) : undefined;
        if (!col57Handled && beVal !== undefined && String(beVal) !== String(prevBeVal ?? '') && item._row) {
          cellUpdates.push({ rowIndex: item._row, columnIndex: 57, value: String(beVal) });
        }

        const bfVal = item.extraQty ?? item['Extra Qty'] ?? item.BF ?? item['BF'];
        const prevBfVal = prev ? (prev.extraQty ?? prev['Extra Qty'] ?? prev.BF ?? prev['BF']) : undefined;
        if (!col58Handled && bfVal !== undefined && String(bfVal) !== String(prevBfVal ?? '') && item._row) {
          cellUpdates.push({ rowIndex: item._row, columnIndex: 58, value: String(bfVal) });
        }
      }

      if (cellUpdates.length > 0) {
        try {
          if (cellUpdates.length === 1) {
            const u = cellUpdates[0];
            await updateCell(sheetName, u.rowIndex, u.columnIndex, u.value);
          } else {
            await batchUpdateCells(sheetName, cellUpdates);
          }
        } catch (err) {
          console.error(`[useSheetData] updates failed in "${sheetName}":`, err);
          onErrorRef.current?.(`Failed to save updates: ${err.message}`);
        }
      }
    }

    // ── inserts (appended to the end of the sheet) ─────────────────────────
    let nextRow = Math.max(1, ...internal.current.filter(x => x._row).map(x => x._row)) + 1;
    for (const item of changes.inserts) {
      try {
        await insertRow(sheetName, toRow(headers.current, item));
        const assignedRow = nextRow++;
        const currentInt = internal.current.map(x =>
          !x._row && getKeyVal(x, keyField) === getKeyVal(item, keyField)
            ? { ...x, _row: assignedRow }
            : x
        );
        updateGlobalCache(currentInt, headers.current);
      } catch (err) {
        console.error(`[useSheetData] insert failed in "${sheetName}":`, err);
        onErrorRef.current?.(`Insert failed: ${err.message}`);
      }
    }
  }, [sheetName, keyField]);

  return [data, setData, loading];
}
