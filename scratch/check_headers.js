const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
  const url = 'https://script.google.com/macros/s/AKfycbw29a7GH4YEEVSsZLRvFGmN89CBaz66HSfVw-8-S6KkfyDjUUTgA7XYrfaVyr5affalaA/exec?sheet=FMS';
  const res = await fetch(url);
  const json = await res.json();
  if (json.success && json.data) {
    const headers = json.data[0];
    console.log("Headers length:", headers.length);
    headers.forEach((h, i) => {
      const colLetter = getColumnLetter(i + 1);
      console.log(`${i + 1} (${colLetter}): ${h}`);
    });
  } else {
    console.error("Failed to fetch sheet:", json);
  }
}

function getColumnLetter(col) {
  let letter = '';
  while (col > 0) {
    let temp = (col - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

run().catch(console.error);
