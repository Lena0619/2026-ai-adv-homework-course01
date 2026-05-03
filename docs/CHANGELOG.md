# Changelog

## [Unreleased]

### 新增

- **綠界 ECPay 金流整合**：串接 AIO 信用卡付款（測試環境），訂單詳情頁新增「前往綠界付款」按鈕
  - `src/services/ecpay.js`：CheckMacValue（SHA256）計算、QueryTradeInfo 主動查詢、付款參數組建
  - `src/routes/ecpayRoutes.js`：`POST /api/ecpay/checkout/:orderId`、`POST /api/ecpay/notify`、`POST /api/ecpay/result`
  - `POST /api/orders/:id/ecpay/query`：主動查詢綠界付款狀態並更新訂單
- **orders 表新增 `merchant_trade_no` 欄位**：追蹤對應的綠界交易編號（由 order_no 移除 dash 推導）
- **訂單詳情頁更新**：新增「前往綠界付款」與「確認付款狀態」按鈕，移除模擬付款按鈕

### 技術備注

- 本地開發（port 3001）無法接收 ECPay S2S ReturnURL callback，付款確認改以 `QueryTradeInfo` 主動查詢為主
- 不新增 npm 套件，使用 Node.js 內建 `node:crypto`、`URLSearchParams`、`fetch`
- SQLite 不支援 `ALTER TABLE ADD COLUMN ... UNIQUE`，`merchant_trade_no` 唯一性由應用層（order_no 唯一）保證

---

## [1.0.0] — 2026-05-03

### 新增

- **認證系統**：JWT 認證（7天有效期）、bcrypt 密碼雜湊、register/login/profile 端點
- **商品瀏覽**：公開商品列表（分頁）、商品詳情端點
- **購物車**：雙模式支援（JWT 用戶 / X-Session-Id 訪客）、加入/修改/刪除/查看
- **訂單管理**：SQLite transaction 建立訂單（含庫存扣除、購物車清空快照）、模擬付款
- **管理後台**：商品 CRUD（含刪除保護）、訂單列表（status 篩選）、訂單詳情
- **EJS 前端頁面**：前台 9 頁 + 後台 2 頁
- **OpenAPI 文件**：swagger-jsdoc 整合，`npm run openapi` 產生 `openapi.json`
- **測試套件**：6 個測試檔（Vitest + supertest），涵蓋所有 API 端點
- **種子資料**：管理員帳號 + 8 種花卉商品

### 技術選型

- Express ~4.16.1 + better-sqlite3（WAL 模式，foreign keys 開啟）
- CommonJS 模組系統（vitest.config.js 除外）
- Tailwind CSS v4.2.2 + EJS v5.0.1
