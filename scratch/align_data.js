const headers = [
  'Timestamp', 'Serial No', 'PO Number', 'Vendor Name', 'Total Quantity', 'Location', 'Address', 'Created By', 'PO Received Date', 'PO Expired Date', 'PO PDF',
  'Planned 1', 'Actual 1', 'Delay 1', 'Bill Number', 'Bill Amount', 'Bill Date', 'Bill PDF',
  'Planned 2', 'Actual 2', 'Delay 2', 'Actual Date',
  'Planned 3', 'Actual 3', 'Delay 3', 'Actual Date',
  'Transporter name', 'Quantity', 'Delivery location', 'Delivery address',
  'Planned 4', 'Actual 4', 'Delay 4',
  'Planned 5', 'Actual 5', 'Delay 5',
  'Planned 6', 'Actual 6', 'Delay 6',
  'Planned 7', 'Actual 7', 'Delay 7'
];

const rowStr = "6/23/2026 16:44:22\t7\t87654\tABC Traders\t23\tBILASPUR\tdurg\tAdmin User\t\t\t\t6/24/2026 16:44:00\t6/23/2026 17:00:00\t\tBILL-TEST-87654\t99999\t2026-06-23\t\t6/23/2026 17:00:00\t6/23/2026 17:08:21\t0.005798611106\t\t6/23/2026 17:08:00\t6/23/2026 17:19:42\t0.008124999993\t\t\t230\tBILASPUR\tdurg\t230\t\t45966.72995\t230\t\t45966.72995";
const rowVals = rowStr.split('\t');

console.log('Total headers:', headers.length);
console.log('Total values:', rowVals.length);

headers.forEach((h, i) => {
  const colLetter = getColumnLetter(i + 1);
  console.log(`${colLetter} (index ${i}) - ${h.padEnd(20)}: "${rowVals[i] ?? ''}"`);
});

function getColumnLetter(colNum) {
  let temp, letter = '';
  while (colNum > 0) {
    temp = (colNum - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colNum = (colNum - temp - 1) / 26;
  }
  return letter;
}
