const http = require('http');

const PORT = 3000;
const CONCURRENCY = 100;
const PROMO_CODE = 'TEST100'; // Make sure this promo code exists and has 100 max uses, or test will get 400s naturally

async function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runLoadTest() {
  console.log(`Starting load test with ${CONCURRENCY} concurrent users...`);
  const start = Date.now();

  try {
    // 1. Concurrent Logins
    console.log(`Firing ${CONCURRENCY} concurrent login requests...`);
    const loginPromises = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      loginPromises.push(makeRequest('/api/auth/login', 'POST', { username: 'Sankeerth', password: 'Satyamani80' }));
    }
    const loginResults = await Promise.allSettled(loginPromises);
    
    let loginSuccess = 0;
    let rateLimited = 0;
    loginResults.forEach(r => {
      if (r.value && r.value.status === 200) loginSuccess++;
      else if (r.value && r.value.status === 429) rateLimited++;
    });
    console.log(`Logins - Success: ${loginSuccess}, Rate Limited: ${rateLimited}, Failed: ${CONCURRENCY - loginSuccess - rateLimited}`);

    // If we didn't get any successful logins due to rate limits, grab at least one token directly
    const firstLogin = loginResults.find(r => r.value && r.value.status === 200);
    if (!firstLogin) {
      console.log("All logins rate limited. Cannot proceed with redeem load test.");
      return;
    }
    const token = JSON.parse(firstLogin.value.body).token;

    // 2. Concurrent Promos
    console.log(`Firing ${CONCURRENCY} concurrent promo redeem requests for same user...`);
    const redeemPromises = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      redeemPromises.push(makeRequest('/api/promos/redeem', 'POST', { code: PROMO_CODE }, {
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': `loadtest-key-${i}` // Simulate 100 different clicks
      }));
    }
    const redeemResults = await Promise.allSettled(redeemPromises);

    let redeemSuccess = 0;
    let duplicateErrors = 0;
    redeemResults.forEach(r => {
      if (r.value && r.value.status === 200) redeemSuccess++;
      else if (r.value && r.value.body.includes('already used')) duplicateErrors++;
    });

    console.log(`Redeems - Success: ${redeemSuccess} (Should be EXACTLY 1), Duplicate Denied: ${duplicateErrors}`);
    if (redeemSuccess > 1) {
      console.error("CRITICAL FAILURE: Double credit occurred!");
    } else if (redeemSuccess === 1) {
      console.log("PASS: Atomic transaction prevented double credit.");
    }

    const duration = Date.now() - start;
    console.log(`Load test completed in ${duration}ms.`);
  } catch (err) {
    console.error("Load test failed:", err);
  }
}

runLoadTest();
