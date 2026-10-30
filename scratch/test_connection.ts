import http from 'http';

async function test() {
  console.log('Testing connection to http://127.0.0.1:8000/health and http://localhost:8000/health...');

  // 1. fetch 127.0.0.1
  try {
    const res = await fetch('http://127.0.0.1:8000/health');
    console.log('[fetch 127.0.0.1] status:', res.status, await res.text());
  } catch (err: any) {
    console.error('[fetch 127.0.0.1] ERROR:', err.name, err.message, err.cause);
  }

  // 2. fetch localhost
  try {
    const res = await fetch('http://localhost:8000/health');
    console.log('[fetch localhost] status:', res.status, await res.text());
  } catch (err: any) {
    console.error('[fetch localhost] ERROR:', err.name, err.message, err.cause);
  }

  // 3. node http 127.0.0.1
  await new Promise<void>((resolve) => {
    const req = http.get('http://127.0.0.1:8000/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('[http.get 127.0.0.1] status:', res.statusCode, data);
        resolve();
      });
    });
    req.on('error', (err) => {
      console.error('[http.get 127.0.0.1] ERROR:', err.message);
      resolve();
    });
  });

  // 4. node http localhost
  await new Promise<void>((resolve) => {
    const req = http.get('http://localhost:8000/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('[http.get localhost] status:', res.statusCode, data);
        resolve();
      });
    });
    req.on('error', (err) => {
      console.error('[http.get localhost] ERROR:', err.message);
      resolve();
    });
  });
}

test().catch(console.error);
