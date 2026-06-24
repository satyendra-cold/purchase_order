const SPREADSHEET_ID = "1DYTq5KGS-lDGFbKqXB8xpLy0I6VM0YeUsuW5CvCd_n0";
const PO_PDF_FOLDER_ID = "1Hzz1nxg1A_rDaigFZ6ZMxpB2-AzSmIhM";

let cachedSpreadsheet = null;

function getSpreadsheet() {
    if (!cachedSpreadsheet) {
        cachedSpreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    }
    return cachedSpreadsheet;
}

const SHEET_CONFIGS = {
    'FMS': {
        headerRow: 6,
        columnMap: {
            'Timestamp':          'timestamp',
            'Serial No':          'serialNo',
            'PO Number':          'poNumber',
            'Vendor Name':        'vendorName',
            'Total Quantity':     'totalQuantity',
            'Location':           'location',
            'Address':            'address',
            'Created By':         'createdBy',
            'PO Received Date':   'poReceivedDate',
            'PO Expired Date':    'poExpiredDate',
            'PO PDF':             'poPdfName',
            'Planned 1':          'planned1',
            'Actual 1':           'actual1',
            'Delay 1':            'delay1',
            'Bill Number':        'billNumber',
            'Bill Amount':        'billAmount',
            'Bill Date':          'billDate',
            'Bill PDF':           'billPdf',
            'Planned 2':          'planned2',
            'Actual 2':           'actual2',
            'Delay 2':            'delay2',
            'Actual Date':        'actualDate',
            'Planned 3':          'planned3',
            'Actual 3':           'actual3',
            'Delay 3':            'delay3',
            'Transporter name':   'transporterName',
            'Quantity':           'quantity',
            'Delivery location':  'deliveryLocation',
            'Delivery address':   'deliveryAddress',
            'Planned 4':          'planned4',
            'Actual 4':           'actual4',
            'Delay 4':            'delay4',
            'Planned 5':          'planned5',
            'Actual 5':           'actual5',
            'Delay 5':            'delay5',
            'Planned 6':          'planned6',
            'Actual 6':           'actual6',
            'Delay 6':            'delay6',
            'Planned 7':          'planned7',
            'Actual 7':           'actual7',
            'Delay 7':            'delay7',
        }
    },
    'Login': {
        headerRow: 1,
        columnMap: {
            'ID':          'id',
            'Username':    'username',
            'Password':    'password',
            'Name':        'name',
            'Email':       'email',
            'Phone':       'phone',
            'Role':        'role',
            'Status':      'status',
            'Page Access': 'pageAccess',
            'Date Joined': 'dateJoined',
        }
    }
};

const VIRTUAL_SHEETS = {
    'Vendors': {
        masterSheet:    'Master',
        typeValue:      'Vendor',
        exposeColumns:  [0, 2, 3],
        exposeHeaders:  ['id', 'name', 'phone']
    },
    'Locations': {
        masterSheet:    'Master',
        typeValue:      'Location',
        exposeColumns:  [2],
        exposeHeaders:  ['name']
    },
    'Transporters': {
        masterSheet:    'Master',
        typeValue:      'Transporter',
        exposeColumns:  [0, 2, 3],
        exposeHeaders:  ['id', 'name', 'phone']
    }
};

const MASTER_TOTAL_COLS = 4;

function jsonError(msg) {
    return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: msg })
    ).setMimeType(ContentService.MimeType.JSON);
}

function jsonSuccess(msg, additionalData) {
    const response = { success: true, message: msg, ...additionalData };
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

function buildMasterRow(vCfg, exposedRowData) {
    const fullRow = new Array(MASTER_TOTAL_COLS).fill('');
    fullRow[1] = vCfg.typeValue;
    vCfg.exposeColumns.forEach((masterColIdx, i) => {
        fullRow[masterColIdx] = (exposedRowData[i] !== undefined) ? exposedRowData[i] : '';
    });
    return fullRow;
}

function parseParameters(e) {
    var params = {};
    if (e && e.parameter) {
        for (var key in e.parameter) {
            params[key] = e.parameter[key];
        }
    }
    if (e && e.postData && e.postData.contents) {
        var contents = e.postData.contents.trim();
        var type = e.postData.type || '';
        if (type.indexOf('application/json') !== -1 || (contents.charAt(0) === '{' && contents.charAt(contents.length - 1) === '}')) {
            try {
                var json = JSON.parse(contents);
                for (var k in json) {
                    params[k] = json[k];
                }
            } catch (err) {
                console.error("Failed to parse JSON body: " + err.toString());
            }
        } else if (type.indexOf('application/x-www-form-urlencoded') !== -1) {
            try {
                var parts = contents.split('&');
                for (var i = 0; i < parts.length; i++) {
                    var pair = parts[i].split('=');
                    if (pair[0]) {
                        var k = decodeURIComponent(pair[0]);
                        var v = decodeURIComponent(pair[1] || '');
                        params[k] = v;
                    }
                }
            } catch (err) {
                console.error("Failed to parse urlencoded body: " + err.toString());
            }
        }
    }
    return params;
}

function doGet(e) {
    const action    = e.parameter.action;
    const sheetName = e.parameter.sheet || e.parameter.sheetName || "Data";

    try {
        const ss = getSpreadsheet();

        if (action === 'insert' || action === 'update' || action === 'delete' ||
            action === 'updateCell' || action === 'markDeleted' || action === 'batchInsert') {

            if (VIRTUAL_SHEETS[sheetName]) {
                return handleVirtualSheetPost(sheetName, action, e.parameter, ss);
            }

            const sheet = ss.getSheetByName(sheetName);
            if (!sheet) return jsonError("Sheet '" + sheetName + "' not found");

            if (action === 'insert') {
                const rowData = JSON.parse(e.parameter.rowData);
                sheet.appendRow(rowData);
                SpreadsheetApp.flush();
                return jsonSuccess("Data inserted successfully");
            }

            if (action === 'update') {
                const rowIndex = parseInt(e.parameter.rowIndex);
                const rowData  = JSON.parse(e.parameter.rowData);
                if (isNaN(rowIndex) || rowIndex < 2) return jsonError("Invalid row index for update");
                
                const range = sheet.getRange(rowIndex, 1, 1, rowData.length);
                const existingValues = range.getValues()[0];
                const existingFormulas = range.getFormulas()[0];
                
                const mergedData = existingValues.map(function(existingVal, i) {
                    // 1. If rowData[i] is provided (non-empty & non-undefined), write it
                    if (rowData[i] !== '' && rowData[i] !== undefined) {
                        return rowData[i];
                    }
                    // 2. Otherwise, if there is a formula in the cell, keep the formula intact
                    if (existingFormulas[i] !== '') {
                        return existingFormulas[i];
                    }
                    // 3. Otherwise, keep the existing value
                    return existingVal;
                });
                
                range.setValues([mergedData]);
                SpreadsheetApp.flush();
                return jsonSuccess("Data updated successfully");
            }

            if (action === 'updateCell') {
                const rowIndex    = parseInt(e.parameter.rowIndex);
                const columnIndex = parseInt(e.parameter.columnIndex);
                if (isNaN(rowIndex) || rowIndex < 1 || isNaN(columnIndex) || columnIndex < 1)
                    return jsonError("Invalid row or column index");
                sheet.getRange(rowIndex, columnIndex).setValue(e.parameter.value);
                SpreadsheetApp.flush();
                return jsonSuccess("Cell updated successfully");
            }

            if (action === 'delete') {
                const rowIndex = parseInt(e.parameter.rowIndex);
                if (isNaN(rowIndex) || rowIndex < 2) return jsonError("Invalid row index for delete");
                sheet.deleteRow(rowIndex);
                SpreadsheetApp.flush();
                return jsonSuccess("Row deleted successfully");
            }

            if (action === 'markDeleted') {
                const rowIndex    = parseInt(e.parameter.rowIndex);
                const columnIndex = parseInt(e.parameter.columnIndex);
                if (isNaN(rowIndex) || rowIndex < 2)       return jsonError("Invalid row index");
                if (isNaN(columnIndex) || columnIndex < 1) return jsonError("Invalid column index");
                sheet.getRange(rowIndex, columnIndex).setValue(e.parameter.value || 'Yes');
                SpreadsheetApp.flush();
                return jsonSuccess("Row marked as deleted successfully");
            }

            if (action === 'batchInsert') {
                const rowsData = JSON.parse(e.parameter.rowsData);
                if (!Array.isArray(rowsData) || rowsData.length === 0)
                    return jsonError("Invalid rows data for batch insert");
                const lastRow = sheet.getLastRow();
                sheet.getRange(lastRow + 1, 1, rowsData.length, rowsData[0].length).setValues(rowsData);
                SpreadsheetApp.flush();
                return jsonSuccess("Batch insert successful", { rowsInserted: rowsData.length });
            }
        }

        if (VIRTUAL_SHEETS[sheetName]) return handleVirtualSheetGet(sheetName, ss);

        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return jsonError("Sheet '" + sheetName + "' not found");

        const cfg       = SHEET_CONFIGS[sheetName] || {};
        const headerRow = cfg.headerRow || 1;
        const colMap    = cfg.columnMap  || {};
        const allData   = sheet.getDataRange().getValues();

        if (allData.length < headerRow) {
            return ContentService.createTextOutput(JSON.stringify({
                success: true, updated: new Date().toISOString(),
                data: [], headerRow
            })).setMimeType(ContentService.MimeType.JSON);
        }

        const headers  = allData[headerRow - 1].map(h => {
            const s = String(h);
            return colMap[s] || s;
        });
        const dataRows = allData.slice(headerRow);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            updated: new Date().toISOString(),
            data: [headers, ...dataRows],
            headerRow
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return jsonError(err.message || "Server error");
    }
}

function handleVirtualSheetGet(virtualSheetName, ss) {
    const vCfg        = VIRTUAL_SHEETS[virtualSheetName];
    const masterSheet = ss.getSheetByName(vCfg.masterSheet);
    if (!masterSheet) return jsonError(`Master sheet '${vCfg.masterSheet}' not found`);

    const allData = masterSheet.getDataRange().getValues();
    if (allData.length < 2) {
        return ContentService.createTextOutput(JSON.stringify({
            success: true, updated: new Date().toISOString(),
            data: [vCfg.exposeHeaders], headerRow: 1, rowIndices: []
        })).setMimeType(ContentService.MimeType.JSON);
    }

    const masterHeaders = allData[0].map(h => String(h).toLowerCase().trim());
    const typeColIdx    = masterHeaders.indexOf('type');
    const rowIndices    = [];
    const filteredRows  = [];

    allData.slice(1).forEach((row, i) => {
        const actualRow = i + 2;
        if (String(row[typeColIdx] || '').trim().toLowerCase() === vCfg.typeValue.toLowerCase()) {
            rowIndices.push(actualRow);
            filteredRows.push(vCfg.exposeColumns.map(col => row[col] !== undefined ? row[col] : ''));
        }
    });

    return ContentService.createTextOutput(JSON.stringify({
        success: true,
        updated: new Date().toISOString(),
        data: [vCfg.exposeHeaders, ...filteredRows],
        headerRow: 1,
        rowIndices: rowIndices
    })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    try {
        var params    = parseParameters(e);
        var action    = params.action || 'insert';
        var sheetName = params.sheetName;
        var ss        = getSpreadsheet();

        if (action === 'uploadFile') return handleFileUpload(params);

        if (VIRTUAL_SHEETS[sheetName]) {
            return handleVirtualSheetPost(sheetName, action, params, ss);
        }

        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) throw new Error("Sheet '" + sheetName + "' not found");

        if (action === 'insert') {
            var rowData = JSON.parse(params.rowData);
            sheet.appendRow(rowData);
            SpreadsheetApp.flush();
            return jsonSuccess("Data inserted successfully");
        }
        else if (action === 'update') {
            var rowIndex = parseInt(params.rowIndex);
            var rowData  = JSON.parse(params.rowData);
            if (isNaN(rowIndex) || rowIndex < 2) throw new Error("Invalid row index for update");
            
            const range = sheet.getRange(rowIndex, 1, 1, rowData.length);
            const existingValues = range.getValues()[0];
            const existingFormulas = range.getFormulas()[0];
            
            const mergedData = existingValues.map(function(existingVal, i) {
                // 1. If rowData[i] is provided (non-empty & non-undefined), write it
                if (rowData[i] !== '' && rowData[i] !== undefined) {
                    return rowData[i];
                }
                // 2. Otherwise, if there is a formula in the cell, keep the formula intact
                if (existingFormulas[i] !== '') {
                    return existingFormulas[i];
                }
                // 3. Otherwise, keep the existing value
                return existingVal;
            });
            
            range.setValues([mergedData]);
            SpreadsheetApp.flush();
            return jsonSuccess("Data updated successfully");
        }
        else if (action === 'updateCell') {
            var rowIndex    = parseInt(params.rowIndex);
            var columnIndex = parseInt(params.columnIndex);
            if (isNaN(rowIndex) || rowIndex < 1 || isNaN(columnIndex) || columnIndex < 1)
                throw new Error("Invalid row or column index");
            sheet.getRange(rowIndex, columnIndex).setValue(params.value);
            SpreadsheetApp.flush();
            return jsonSuccess("Cell updated successfully");
        }
        else if (action === 'delete') {
            var rowIndex = parseInt(params.rowIndex);
            if (isNaN(rowIndex) || rowIndex < 2) throw new Error("Invalid row index for delete");
            sheet.deleteRow(rowIndex);
            SpreadsheetApp.flush();
            return jsonSuccess("Row deleted successfully");
        }
        else if (action === 'markDeleted') {
            var rowIndex    = parseInt(params.rowIndex);
            var columnIndex = parseInt(params.columnIndex);
            if (isNaN(rowIndex) || rowIndex < 2)    throw new Error("Invalid row index");
            if (isNaN(columnIndex) || columnIndex < 1) throw new Error("Invalid column index");
            sheet.getRange(rowIndex, columnIndex).setValue(params.value || 'Yes');
            SpreadsheetApp.flush();
            return jsonSuccess("Row marked as deleted successfully");
        }
        else if (action === 'batchInsert') {
            var rowsData = JSON.parse(params.rowsData);
            if (!Array.isArray(rowsData) || rowsData.length === 0)
                throw new Error("Invalid rows data for batch insert");
            var lastRow = sheet.getLastRow();
            sheet.getRange(lastRow + 1, 1, rowsData.length, rowsData[0].length).setValues(rowsData);
            SpreadsheetApp.flush();
            return jsonSuccess("Batch insert successful", { rowsInserted: rowsData.length });
        }
        else {
            throw new Error("Unknown action: " + action);
        }

    } catch (error) {
        console.error("Error in doPost:", error);
        return ContentService.createTextOutput(JSON.stringify({
            success: false, error: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

function handleVirtualSheetPost(virtualSheetName, action, params, ss) {
    try {
        const vCfg        = VIRTUAL_SHEETS[virtualSheetName];
        const masterSheet = ss.getSheetByName(vCfg.masterSheet);
        if (!masterSheet) return jsonError(`Master sheet '${vCfg.masterSheet}' not found`);

        if (action === 'insert') {
            const fullRow = buildMasterRow(vCfg, JSON.parse(params.rowData));
            masterSheet.appendRow(fullRow);
            SpreadsheetApp.flush();
            return jsonSuccess("Data inserted successfully");
        }
        if (action === 'update') {
            const rowIndex = parseInt(params.rowIndex);
            if (isNaN(rowIndex) || rowIndex < 2) return jsonError("Invalid row index");
            const fullRow = buildMasterRow(vCfg, JSON.parse(params.rowData));
            masterSheet.getRange(rowIndex, 1, 1, fullRow.length).setValues([fullRow]);
            SpreadsheetApp.flush();
            return jsonSuccess("Data updated successfully");
        }
        if (action === 'delete') {
            const rowIndex = parseInt(params.rowIndex);
            if (isNaN(rowIndex) || rowIndex < 2) return jsonError("Invalid row index");
            masterSheet.deleteRow(rowIndex);
            SpreadsheetApp.flush();
            return jsonSuccess("Row deleted successfully");
        }
        return jsonError("Unsupported action for virtual sheet: " + action);
    } catch (err) {
        return jsonError(err.toString());
    }
}

function handleFileUpload(params) {
    try {
        var folderId = params.folderId || PO_PDF_FOLDER_ID;
        if (!params.base64Data || !params.fileName || !params.mimeType)
            throw new Error("Missing required parameters for file upload");
        var fileUrl = uploadFileToDrive(params.base64Data, params.fileName, params.mimeType, folderId);
        if (!fileUrl) throw new Error("Failed to upload file to Google Drive");
        return ContentService.createTextOutput(JSON.stringify({
            success: true, fileUrl: fileUrl, message: "File uploaded successfully"
        })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        console.error("Error in handleFileUpload:", error);
        return ContentService.createTextOutput(JSON.stringify({
            success: false, error: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

function uploadFileToDrive(base64Data, fileName, mimeType, folderId) {
    try {
        let fileData = base64Data;
        if (base64Data.indexOf('base64,') !== -1) fileData = base64Data.split('base64,')[1];
        fileData = fileData.replace(/ /g, '+');
        const decoded = Utilities.base64Decode(fileData);
        const blob    = Utilities.newBlob(decoded, mimeType, fileName);
        const folder  = DriveApp.getFolderById(folderId);
        const file    = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return "https://drive.google.com/file/d/" + file.getId() + "/view";
    } catch (error) {
        console.error("Error in uploadFileToDrive:", error);
        return null;
    }
}