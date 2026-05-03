'use strict';
const crypto = require('node:crypto');

const ECPAY_URLS = {
  stage: {
    checkout: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
    query:    'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
  },
  production: {
    checkout: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
    query:    'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
  },
};

const env = process.env.ECPAY_ENV === 'production' ? 'production' : 'stage';
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const HASH_KEY    = process.env.ECPAY_HASH_KEY;
const HASH_IV     = process.env.ECPAY_HASH_IV;

/**
 * ECPay-specific URL encoding (仿 PHP urlencode + .NET HttpUtility.UrlEncode):
 * 1. encodeURIComponent → space 為 %20
 * 2. %20 → + (space to plus)
 * 3. ~ → %7e  (JS encodeURIComponent 不編碼 ~，但 ECPay 需要)
 * 4. lowercase
 * 5. 還原 .NET 不編碼的字元: %2d→-, %5f→_, %2e→., %21→!, %2a→*, %28→(, %29→)
 */
function ecpayUrlEncode(str) {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .toLowerCase()
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
}

function generateCheckMacValue(params, hashKey = HASH_KEY, hashIv = HASH_IV) {
  const sorted = Object.keys(params)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(k => `${k}=${params[k]}`);
  const raw = `HashKey=${hashKey}&${sorted.join('&')}&HashIV=${hashIv}`;
  return crypto.createHash('sha256').update(ecpayUrlEncode(raw)).digest('hex').toUpperCase();
}

function verifyCheckMacValue(receivedCmv, params, hashKey = HASH_KEY, hashIv = HASH_IV) {
  const { CheckMacValue: _, ...rest } = params;
  const expected = generateCheckMacValue(rest, hashKey, hashIv);
  const a = Buffer.from(expected);
  const b = Buffer.from((receivedCmv || '').toUpperCase());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function getMerchantTradeDate() {
  // UTC+8 Taiwan time, format: yyyy/MM/dd HH:mm:ss
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())} ` +
         `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function orderNoToMerchantTradeNo(orderNo) {
  // ORD-20260503-AB123 → ORD20260503AB123 (remove dashes, max 20 chars)
  return orderNo.replace(/-/g, '');
}

function buildAioParams(order, items, merchantTradeNo) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  let itemName = items.map(i => `${i.product_name} x${i.quantity}`).join('#');
  if (itemName.length > 400) itemName = itemName.slice(0, 397) + '...';

  const params = {
    MerchantID:        MERCHANT_ID,
    MerchantTradeNo:   merchantTradeNo,
    MerchantTradeDate: getMerchantTradeDate(),
    PaymentType:       'aio',
    TotalAmount:       String(order.total_amount),
    TradeDesc:         '花卉電商訂單',
    ItemName:          itemName,
    ReturnURL:         `${baseUrl}/api/ecpay/notify`,
    OrderResultURL:    `${baseUrl}/api/ecpay/result`,
    ClientBackURL:     `${baseUrl}/orders/${order.id}`,
    ChoosePayment:     'Credit',
    EncryptType:       '1',
  };
  params.CheckMacValue = generateCheckMacValue(params);
  return params;
}

async function queryTradeInfo(merchantTradeNo) {
  const params = {
    MerchantID:      MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp:       String(Math.floor(Date.now() / 1000)),
  };
  params.CheckMacValue = generateCheckMacValue(params);

  const res = await fetch(ECPAY_URLS[env].query, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`ECPay QueryTradeInfo HTTP ${res.status}`);
  return Object.fromEntries(new URLSearchParams(await res.text()));
}

module.exports = {
  ecpayUrlEncode,
  generateCheckMacValue,
  verifyCheckMacValue,
  getMerchantTradeDate,
  orderNoToMerchantTradeNo,
  buildAioParams,
  queryTradeInfo,
  ECPAY_URLS,
  env,
};
