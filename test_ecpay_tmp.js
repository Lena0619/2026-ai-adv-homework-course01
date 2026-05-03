require('dotenv').config();
const app = require('./app');
const supertest = require('supertest');

async function test() {
  const agent = supertest(app);

  const loginRes = await agent.post('/api/auth/login').send({ email: 'admin@hexschool.com', password: '12345678' });
  console.log('Login status:', loginRes.status);
  const token = loginRes.body.data && loginRes.body.data.token;
  if (!token) { console.log('Login failed:', JSON.stringify(loginRes.body)); return; }
  console.log('Token 取得成功');

  const orderId = '8e8c1215-0568-40a3-936e-82c549913f51';
  const checkoutRes = await agent
    .post('/api/ecpay/checkout/' + orderId)
    .set('Authorization', 'Bearer ' + token);
  console.log('Checkout status:', checkoutRes.status);
  console.log('Checkout body:', JSON.stringify(checkoutRes.body, null, 2));
}
test().catch(function(e) { console.error('ERROR:', e.message, '\n', e.stack); });
