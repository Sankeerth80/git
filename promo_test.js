const http = require('http');
const loginData = JSON.stringify({ username: 'admin', password: 'Admin@1234' });
const loginOptions = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData),
  },
};

const req = http.request(loginOptions, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('LOGIN', res.statusCode, body);
    if (res.statusCode !== 200) return;
    const token = JSON.parse(body).token;
    const promoData = JSON.stringify({ code: 'TEST123', discountPercent: 10, maxUses: 5 });
    const promoOptions = {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/promos',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(promoData),
        Authorization: 'Bearer ' + token,
      },
    };
    const req2 = http.request(promoOptions, (res2) => {
      let out = '';
      res2.on('data', (chunk) => out += chunk);
      res2.on('end', () => console.log('CREATE', res2.statusCode, out));
    });
    req2.on('error', console.error);
    req2.write(promoData);
    req2.end();
  });
});
req.on('error', console.error);
req.write(loginData);
req.end();
