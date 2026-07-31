const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwK5XHoV4L6XNK8Q2cA6f5KnOkFyAseasCI4LAR8EZ4U_wMWwYk9KgkmwR2T_2g6Wpr2w/exec';

async function testUpdate() {
  const rowData = new Array(41).fill('');
  // Let's set some dummy values for the bill columns to test the update
  rowData[2] = '87654'; // poNumber (col C, index 2)
  rowData[12] = '6/23/2026 17:00:00'; // actual1 (col M, index 12)
  rowData[14] = 'BILL-TEST-87654'; // billNumber (col O, index 14)
  rowData[15] = '99999'; // billAmount (col P, index 15)
  rowData[16] = '2026-06-23'; // billDate (col Q, index 16)

  const params = {
    action: 'update',
    sheetName: 'FMS',
    rowIndex: '7',
    rowData: JSON.stringify(rowData)
  };

  const qs = new URLSearchParams(params).toString();
  const url = `${SCRIPT_URL}?${qs}`;

  console.log('Sending request to:', url);

  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testUpdate();
