

const SPREADSHEET_ID = "1DYTq5KGS-lDGFbKqXB8xpLy0I6VM0YeUsuW5CvCd_n0";
const PO_PDF_FOLDER_ID = "1Hzz1nxg1A_rDaigFZ6ZMxpB2-AzSmIhM";
const CACHE_EXPIRY_SEC = 60; // seconds for CacheService TTL

// ── Single spreadsheet handle per execution ──────────────────
let _ss = null;
function getSpreadsheet() {
    if (!_ss) _ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return _ss;
}

// ── In-execution sheet-data cache (avoids double reads) ──────
const _sheetDataCache = {};
function getSheetData(sheet) {
    const name = sheet.getName();
    if (!_sheetDataCache[name]) {
        _sheetDataCache[name] = sheet.getDataRange().getValues();
    }
    return _sheetDataCache[name];
}
function invalidateSheetData(sheetName) {
    delete _sheetDataCache[sheetName];
}

// ── CacheService layer for read requests ─────────────────────
const _appCache = CacheService.getScriptCache();

function getCached(key) {
    try {
        const raw = _appCache.get(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function putCached(key, data) {
    try {
        const s = JSON.stringify(data);
        // CacheService max value size is 100 KB; skip if too large
        if (s.length < 95000) _appCache.put(key, s, CACHE_EXPIRY_SEC);
    } catch (e) { /* silent */ }
}

function bustedCacheKey(sheetName) {
    return 'sheet_' + sheetName;
}

function bustCache(sheetName) {
    try { _appCache.remove(bustedCacheKey(sheetName)); } catch (e) { }
}

// ─────────────────────────────────────────────────────────────
//  Schema definitions (unchanged)
// ─────────────────────────────────────────────────────────────
const SHEET_CONFIGS = {
    'FMS': {
        headerRow: 6,
        columnMap: {
            'Timestamp': 'timestamp',
            'Serial No': 'serialNo',
            'PO Number': 'poNumber',
            'Vendor Name': 'vendorName',
            'Total Quantity': 'totalQuantity',
            'Location': 'location',
            'Address': 'address',
            'Created By': 'createdBy',
            'PO Received Date': 'poReceivedDate',
            'PO Expired Date': 'poExpiredDate',
            'PO PDF': 'poPdfName',
            'Planned 1': 'planned1',
            'Actual 1': 'actual1',
            'Delay 1': 'delay1',
            'Bill Number': 'billNumber',
            'Bill Amount': 'billAmount',
            'Bill Date': 'billDate',
            'Bill PDF': 'billPdf',
            'Planned 2': 'planned2',
            'Actual 2': 'actual2',
            'Delay 2': 'delay2',
            'Actual Date': 'actualDate',
            'Planned 3': 'planned3',
            'Actual 3': 'actual3',
            'Delay 3': 'delay3',
            'Transporter name': 'transporterName',
            'Quantity': 'quantity',
            'Delivery location': 'deliveryLocation',
            'Delivery address': 'deliveryAddress',
            'Planned 4': 'planned4',
            'Actual 4': 'actual4',
            'Delay 4': 'delay4',
            'Planned 5': 'planned5',
            'Actual 5': 'actual5',
            'Delay 5': 'delay5',
            'Planned 6': 'planned6',
            'Actual 6': 'actual6',
            'Delay 6': 'delay6',
            'Planned 7': 'planned7',
            'Actual 7': 'actual7',
            'Delay 7': 'delay7',
            'Total Paid': 'totalPaid',
            'Balance Due': 'balanceDue',
            'Payment Status': 'paymentStatus',
            'Payment History': 'paymentHistory',
        }
    },
    'Login': {
        headerRow: 1,
        columnMap: {
            'ID': 'id',
            'Username': 'username',
            'Password': 'password',
            'Name': 'name',
            'Email': 'email',
            'Phone': 'phone',
            'Role': 'role',
            'Status': 'status',
            'Page Access': 'pageAccess',
            'Date Joined': 'dateJoined',
        }
    }
};

const VIRTUAL_SHEETS = {
    'Vendors': {
        masterSheet: 'Master',
        typeValue: 'Vendor',
        exposeColumns: [0, 2, 3],
        exposeHeaders: ['id', 'name', 'phone']
    },
    'Locations': {
        masterSheet: 'Master',
        typeValue: 'Location',
        exposeColumns: [2],
        exposeHeaders: ['name']
    },
    'Transporters': {
        masterSheet: 'Master',
        typeValue: 'Transporter',
        exposeColumns: [0, 2, 3],
        exposeHeaders: ['id', 'name', 'phone']
    }
};

const MASTER_TOTAL_COLS = 4;

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
function jsonError(msg) {
    return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: msg }))
        .setMimeType(ContentService.MimeType.JSON);
}

function jsonSuccess(msg, extra) {
    return ContentService
        .createTextOutput(JSON.stringify({ success: true, message: msg, ...(extra || {}) }))
        .setMimeType(ContentService.MimeType.JSON);
}

function jsonData(payload) {
    return ContentService
        .createTextOutput(JSON.stringify(payload))
        .setMimeType(ContentService.MimeType.JSON);
}

function buildMasterRow(vCfg, exposedRowData) {
    const fullRow = new Array(MASTER_TOTAL_COLS).fill('');
    fullRow[1] = vCfg.typeValue;
    vCfg.exposeColumns.forEach((col, i) => {
        fullRow[col] = exposedRowData[i] !== undefined ? exposedRowData[i] : '';
    });
    return fullRow;
}

// ── Parameter normaliser (called once per request) ────────────
function parseParameters(e) {
    const params = {};
    if (e && e.parameter) {
        Object.assign(params, e.parameter);
    }
    if (e && e.postData && e.postData.contents) {
        const raw = e.postData.contents.trim();
        const type = e.postData.type || '';
        if (type.includes('application/json') || (raw[0] === '{' && raw[raw.length - 1] === '}')) {
            try { Object.assign(params, JSON.parse(raw)); } catch (_) { }
        } else if (type.includes('application/x-www-form-urlencoded')) {
            raw.split('&').forEach(pair => {
                const [k, v] = pair.split('=');
                if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
            });
        }
    }
    return params;
}

// ─────────────────────────────────────────────────────────────
//  READ handler  (used by both doGet and doPost for read actions)
// ─────────────────────────────────────────────────────────────
function handleRead(sheetName, ss) {
    // 1. Try CacheService first
    const cKey = bustedCacheKey(sheetName);
    const cached = getCached(cKey);
    if (cached) return jsonData(cached);

    // 2. Virtual sheet?
    if (VIRTUAL_SHEETS[sheetName]) return handleVirtualSheetGet(sheetName, ss);

    // 3. Real sheet
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return jsonError("Sheet '" + sheetName + "' not found");

    const cfg = SHEET_CONFIGS[sheetName] || {};
    const headerRow = cfg.headerRow || 1;
    const colMap = cfg.columnMap || {};

    // Single bulk read
    const allData = getSheetData(sheet);

    if (allData.length < headerRow) {
        const payload = { success: true, updated: new Date().toISOString(), data: [], headerRow };
        putCached(cKey, payload);
        return jsonData(payload);
    }

    const headers = allData[headerRow - 1].map(h => colMap[String(h)] || String(h));
    const dataRows = allData.slice(headerRow);
    const payload = {
        success: true,
        updated: new Date().toISOString(),
        data: [headers, ...dataRows],
        headerRow
    };
    putCached(cKey, payload);
    return jsonData(payload);
}

// ─────────────────────────────────────────────────────────────
//  WRITE handlers — each busts the cache on success
// ─────────────────────────────────────────────────────────────

// ── insert ────────────────────────────────────────────────────
function handleInsert(sheet, params) {
    const rowData = JSON.parse(params.rowData);
    // appendRow is fine for single-row insert; for batches use batchInsert
    sheet.appendRow(rowData);
    SpreadsheetApp.flush();
    bustCache(sheet.getName());
    return jsonSuccess("Data inserted successfully");
}

// ── update (batch-write all non-empty cells in one range call) ─
function handleUpdate(sheet, params) {
    const rowIndex = parseInt(params.rowIndex);
    if (isNaN(rowIndex) || rowIndex < 2) return jsonError("Invalid row index for update");

    const rowData = JSON.parse(params.rowData);
    const numCols = rowData.length;

    // ⚡ Read the existing row once, merge, then write the whole row in ONE call
    const existingRange = sheet.getRange(rowIndex, 1, 1, numCols);
    const existing = existingRange.getValues()[0];

    for (let i = 0; i < numCols; i++) {
        if (rowData[i] !== '' && rowData[i] !== undefined) {
            existing[i] = rowData[i];
        }
    }
    existingRange.setValues([existing]);   // ← single API call instead of N setValue() calls
    SpreadsheetApp.flush();
    bustCache(sheet.getName());
    return jsonSuccess("Data updated successfully");
}

// ── updateCell ────────────────────────────────────────────────
function handleUpdateCell(sheet, params) {
    const rowIndex = parseInt(params.rowIndex);
    const columnIndex = parseInt(params.columnIndex);
    if (isNaN(rowIndex) || rowIndex < 1 || isNaN(columnIndex) || columnIndex < 1)
        return jsonError("Invalid row or column index");
    sheet.getRange(rowIndex, columnIndex).setValue(params.value);
    SpreadsheetApp.flush();
    bustCache(sheet.getName());
    return jsonSuccess("Cell updated successfully");
}

// ── delete ────────────────────────────────────────────────────
function handleDelete(sheet, params) {
    const rowIndex = parseInt(params.rowIndex);
    if (isNaN(rowIndex) || rowIndex < 2) return jsonError("Invalid row index for delete");
    sheet.deleteRow(rowIndex);
    SpreadsheetApp.flush();
    bustCache(sheet.getName());
    return jsonSuccess("Row deleted successfully");
}

// ── markDeleted ───────────────────────────────────────────────
function handleMarkDeleted(sheet, params) {
    const rowIndex = parseInt(params.rowIndex);
    const columnIndex = parseInt(params.columnIndex);
    if (isNaN(rowIndex) || rowIndex < 2) return jsonError("Invalid row index");
    if (isNaN(columnIndex) || columnIndex < 1) return jsonError("Invalid column index");
    sheet.getRange(rowIndex, columnIndex).setValue(params.value || 'Yes');
    SpreadsheetApp.flush();
    bustCache(sheet.getName());
    return jsonSuccess("Row marked as deleted successfully");
}

// ── batchInsert ───────────────────────────────────────────────
function handleBatchInsert(sheet, params) {
    const rowsData = JSON.parse(params.rowsData);
    if (!Array.isArray(rowsData) || rowsData.length === 0)
        return jsonError("Invalid rows data for batch insert");
    const lastRow = sheet.getLastRow();
    // Single setValues() call for all rows — fastest possible bulk write
    sheet.getRange(lastRow + 1, 1, rowsData.length, rowsData[0].length).setValues(rowsData);
    SpreadsheetApp.flush();
    bustCache(sheet.getName());
    return jsonSuccess("Batch insert successful", { rowsInserted: rowsData.length });
}

// ── Action dispatch map (avoids long if-else chains) ─────────
const WRITE_ACTIONS = {
    insert: handleInsert,
    update: handleUpdate,
    updateCell: handleUpdateCell,
    delete: handleDelete,
    markDeleted: handleMarkDeleted,
    batchInsert: handleBatchInsert
};

// ─────────────────────────────────────────────────────────────
//  Virtual sheet handlers
// ─────────────────────────────────────────────────────────────
function handleVirtualSheetGet(virtualSheetName, ss) {
    const vCfg = VIRTUAL_SHEETS[virtualSheetName];
    const masterSheet = ss.getSheetByName(vCfg.masterSheet);
    if (!masterSheet) return jsonError(`Master sheet '${vCfg.masterSheet}' not found`);

    // Single bulk read of master sheet (cached in-execution)
    const allData = getSheetData(masterSheet);
    if (allData.length < 2) {
        return jsonData({
            success: true, updated: new Date().toISOString(),
            data: [vCfg.exposeHeaders], headerRow: 1, rowIndices: []
        });
    }

    const masterHeaders = allData[0].map(h => String(h).toLowerCase().trim());
    const typeColIdx = masterHeaders.indexOf('type');
    const typeValueLc = vCfg.typeValue.toLowerCase();
    const rowIndices = [];
    const filteredRows = [];

    // Slice loop — no regex, no repeated indexOf
    for (let i = 1; i < allData.length; i++) {
        const row = allData[i];
        if (String(row[typeColIdx] || '').trim().toLowerCase() === typeValueLc) {
            rowIndices.push(i + 1); // 1-based sheet row
            filteredRows.push(vCfg.exposeColumns.map(col => row[col] !== undefined ? row[col] : ''));
        }
    }

    return jsonData({
        success: true,
        updated: new Date().toISOString(),
        data: [vCfg.exposeHeaders, ...filteredRows],
        headerRow: 1,
        rowIndices
    });
}

function handleVirtualSheetPost(virtualSheetName, action, params, ss) {
    try {
        const vCfg = VIRTUAL_SHEETS[virtualSheetName];
        const masterSheet = ss.getSheetByName(vCfg.masterSheet);
        if (!masterSheet) return jsonError(`Master sheet '${vCfg.masterSheet}' not found`);

        if (action === 'insert') {
            const fullRow = buildMasterRow(vCfg, JSON.parse(params.rowData));
            masterSheet.appendRow(fullRow);
            SpreadsheetApp.flush();
            bustCache(vCfg.masterSheet);
            bustCache(virtualSheetName);
            return jsonSuccess("Data inserted successfully");
        }
        if (action === 'update') {
            const rowIndex = parseInt(params.rowIndex);
            if (isNaN(rowIndex) || rowIndex < 2) return jsonError("Invalid row index");
            const fullRow = buildMasterRow(vCfg, JSON.parse(params.rowData));
            masterSheet.getRange(rowIndex, 1, 1, fullRow.length).setValues([fullRow]);
            SpreadsheetApp.flush();
            bustCache(vCfg.masterSheet);
            bustCache(virtualSheetName);
            return jsonSuccess("Data updated successfully");
        }
        if (action === 'delete') {
            const rowIndex = parseInt(params.rowIndex);
            if (isNaN(rowIndex) || rowIndex < 2) return jsonError("Invalid row index");
            masterSheet.deleteRow(rowIndex);
            SpreadsheetApp.flush();
            bustCache(vCfg.masterSheet);
            bustCache(virtualSheetName);
            return jsonSuccess("Row deleted successfully");
        }
        return jsonError("Unsupported action for virtual sheet: " + action);
    } catch (err) {
        return jsonError(err.toString());
    }
}

// ─────────────────────────────────────────────────────────────
//  File upload (unchanged logic, same flow)
// ─────────────────────────────────────────────────────────────
function handleFileUpload(params) {
    try {
        if (!params.base64Data || !params.fileName || !params.mimeType)
            throw new Error("Missing required parameters for file upload");
        const folderId = params.folderId || PO_PDF_FOLDER_ID;
        const fileUrl = uploadFileToDrive(params.base64Data, params.fileName, params.mimeType, folderId);
        if (!fileUrl) throw new Error("Failed to upload file to Google Drive");
        return jsonData({ success: true, fileUrl, message: "File uploaded successfully" });
    } catch (err) {
        return jsonError(err.toString());
    }
}

function uploadFileToDrive(base64Data, fileName, mimeType, folderId) {
    try {
        let fileData = base64Data.includes('base64,')
            ? base64Data.split('base64,')[1]
            : base64Data;
        fileData = fileData.replace(/ /g, '+');
        const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return "https://drive.google.com/file/d/" + file.getId() + "/view";
    } catch (err) {
        console.error("uploadFileToDrive:", err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
//  doGet  — entry point for GET requests
// ─────────────────────────────────────────────────────────────
function doGet(e) {
    try {
        const action = e.parameter.action;
        const sheetName = e.parameter.sheet || e.parameter.sheetName || "Data";
        const ss = getSpreadsheet();

        // Write actions that arrive via GET (legacy support)
        if (WRITE_ACTIONS[action]) {
            if (VIRTUAL_SHEETS[sheetName]) {
                return handleVirtualSheetPost(sheetName, action, e.parameter, ss);
            }
            const sheet = ss.getSheetByName(sheetName);
            if (!sheet) return jsonError("Sheet '" + sheetName + "' not found");
            return WRITE_ACTIONS[action](sheet, e.parameter);
        }

        // Default: read
        return handleRead(sheetName, ss);

    } catch (err) {
        return jsonError(err.message || "Server error");
    }
}

// ─────────────────────────────────────────────────────────────
//  doPost — entry point for POST requests
// ─────────────────────────────────────────────────────────────
function doPost(e) {
    try {
        const params = parseParameters(e); // parsed once
        const action = params.action || 'insert';
        const sheetName = params.sheetName;
        const ss = getSpreadsheet();

        if (action === 'uploadFile') return handleFileUpload(params);

        if (VIRTUAL_SHEETS[sheetName]) {
            return handleVirtualSheetPost(sheetName, action, params, ss);
        }

        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return jsonError("Sheet '" + sheetName + "' not found");

        const handler = WRITE_ACTIONS[action];
        if (!handler) return jsonError("Unknown action: " + action);

        return handler(sheet, params);

    } catch (err) {
        console.error("doPost error:", err);
        return jsonError(err.toString());
    }
}
