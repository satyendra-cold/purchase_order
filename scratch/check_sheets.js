const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwK5XHoV4L6XNK8Q2cA6f5KnOkFyAseasCI4LAR8EZ4U_wMWwYk9KgkmwR2T_2g6Wpr2w/exec';

async function checkSheet(name) {
  try {
    const res = await fetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(name)}`);
    const json = await res.json();
    console.log(`\n--- SHEET: ${name} ---`);
    console.log('Success:', json.success);
    if (json.success && json.data && json.data.length > 0) {
      console.log('Headers:', json.data[0]);
      console.log('Row count:', json.data.length);
      console.log('First data row:', json.data[1]);
    } else {
      console.log('Error or no data:', json.error);
    }
  } catch (err) {
    console.error(`Failed to fetch ${name}:`, err.message);
  }
}

async function run() {
  await checkSheet('FMS');
  await checkSheet('Bills');
  await checkSheet('PurchaseOrders');
}

run();
