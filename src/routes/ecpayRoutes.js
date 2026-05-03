'use strict';
const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const {
  buildAioParams,
  verifyCheckMacValue,
  orderNoToMerchantTradeNo,
  ECPAY_URLS,
  env,
} = require('../services/ecpay');

const router = express.Router();

// POST /api/ecpay/checkout/:orderId
// 回傳 ECPay 付款參數，前端動態建立 form 並 POST 至綠界
router.post('/checkout/:orderId', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.orderId, req.user.userId);

  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ data: null, error: 'INVALID_STATUS', message: '只有待付款訂單可進行付款' });
  }

  // 重用已存在的 merchant_trade_no，避免 ECPay 拒絕重複送出
  let merchantTradeNo = order.merchant_trade_no;
  if (!merchantTradeNo) {
    merchantTradeNo = orderNoToMerchantTradeNo(order.order_no);
    db.prepare('UPDATE orders SET merchant_trade_no = ? WHERE id = ?').run(merchantTradeNo, order.id);
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const params = buildAioParams(order, items, merchantTradeNo);

  res.json({
    data: { action: ECPAY_URLS[env].checkout, params },
    error: null,
    message: '付款參數已產生',
  });
});

// POST /api/ecpay/notify  (ReturnURL — S2S callback)
// 本地端 port 3001 無法接收，但實作完整以利未來部署
router.post('/notify', (req, res) => {
  const payload = req.body;

  if (!verifyCheckMacValue(payload.CheckMacValue, payload)) {
    console.warn('[ECPay notify] CheckMacValue mismatch, MerchantTradeNo:', payload.MerchantTradeNo);
    return res.send('0|CheckMacValue Error');
  }

  const order = db.prepare('SELECT * FROM orders WHERE merchant_trade_no = ?').get(payload.MerchantTradeNo);
  if (order && order.status === 'pending') {
    // AIO callback: RtnCode 為字串，'1' = 付款成功
    const newStatus = payload.RtnCode === '1' ? 'paid' : 'failed';
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);
  }

  // 綠界要求精確回應 "1|OK"，HTTP 200
  res.status(200).type('text/plain').send('1|OK');
});

// POST /api/ecpay/result  (OrderResultURL — 瀏覽器導回)
// ECPay 付款後以 form POST 將結果送至此 URL，再導回訂單頁
router.post('/result', (req, res) => {
  const { MerchantTradeNo, RtnCode } = req.body;

  if (!MerchantTradeNo) return res.redirect('/orders');

  const order = db.prepare('SELECT id FROM orders WHERE merchant_trade_no = ?').get(MerchantTradeNo);
  if (!order) return res.redirect('/orders');

  const result = RtnCode === '1' ? 'success' : 'failed';
  res.redirect(`/orders/${order.id}?payment=${result}`);
});

module.exports = router;
