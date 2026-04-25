const http = require('http');

const PORT = 3001;
const TEST_COUNT = 10;

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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runStabilityTest() {
  console.log(`Starting stability test: Running operations ${TEST_COUNT} times...`);
  
  try {
    for (let i = 1; i <= TEST_COUNT; i++) {
      console.log(`\n--- Test Iteration ${i} ---`);
      const userStr = `testuser${Date.now()}_${i}`;
      
      // 1. Register
      console.log(`[1] Registering user ${userStr}...`);
      const regRes = await makeRequest('/api/auth/register', 'POST', { username: userStr, password: 'password123' });
      if (regRes.status !== 201) throw new Error(`Register failed with status ${regRes.status}: ${regRes.body}`);
      
      // 2. Login
      console.log(`[2] Logging in...`);
      const loginRes = await makeRequest('/api/auth/login', 'POST', { username: userStr, password: 'password123' });
      if (loginRes.status !== 200) throw new Error(`Login failed with status ${loginRes.status}`);
      
      const token = JSON.parse(loginRes.body).token;
      
      // 3. Fetch Dashboard
      console.log(`[3] Fetching dashboard...`);
      const dashRes = await makeRequest('/api/users/me', 'GET', null, { 'Authorization': `Bearer ${token}` });
      if (dashRes.status !== 200) throw new Error(`Dashboard failed with status ${dashRes.status}`);
      
      // 4. Fetch Market
      console.log(`[4] Fetching market...`);
      const marketRes = await makeRequest('/market', 'GET');
      if (marketRes.status !== 200) throw new Error(`Market fetch failed with status ${marketRes.status}`);
      
      console.log(`Iteration ${i} passed flawlessly!`);
    }
    
    console.log('\n✅ All 10 test iterations completed successfully without crashes or errors!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runStabilityTest();
