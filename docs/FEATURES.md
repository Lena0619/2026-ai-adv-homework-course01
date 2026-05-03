# 功能清單與完成狀態

## 功能概覽

| 功能模組 | 狀態 | 說明 |
|----------|------|------|
| 用戶認證 | ✅ 完成 | 註冊、登入、JWT、個人資料 |
| 商品瀏覽 | ✅ 完成 | 公開商品列表（分頁）、商品詳情 |
| 購物車 | ✅ 完成 | 雙模式（訪客/登入）、CRUD |
| 訂單管理 | ✅ 完成 | 建立訂單、查詢、模擬付款 |
| 綠界 ECPay 金流 | ✅ 完成 | AIO 信用卡付款、QueryTradeInfo 主動查詢 |
| 管理後台 - 商品 | ✅ 完成 | CRUD、刪除保護 |
| 管理後台 - 訂單 | ✅ 完成 | 列表（status 篩選）、詳情 |
| EJS 前端頁面 | ✅ 完成 | 前台9頁 + 後台2頁 |
| OpenAPI 文件 | ✅ 完成 | swagger-jsdoc 產生 |
| 測試覆蓋 | ✅ 完成 | 6個測試檔，涵蓋所有 API |

---

## 1. 用戶認證

### 行為描述

**註冊**（`POST /api/auth/register`）：
- 必填欄位：`email`（string）、`password`（string）、`name`（string）
- email 以正規表達式驗證格式（`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`）
- password 最短 6 個字元
- 密碼以 bcrypt 雜湊（saltRounds=10）
- ID 由 `uuidv4()` 生成
- email 重複 → 409 `CONFLICT`
- 成功回傳 201，`data.user`（id/email/name/role）+ `data.token`（JWT，7天）

**登入**（`POST /api/auth/login`）：
- 必填：`email`、`password`
- email 或密碼錯誤統一回 401「Email 或密碼錯誤」（防止枚舉攻擊）
- 成功回傳 200，同上格式

**個人資料**（`GET /api/auth/profile`）：
- 需 Bearer JWT
- 從 DB 重新查詢，確保資料是最新的
- 回傳：`id, email, name, role, created_at`

### 端點表

| 方法 | 路徑 | 認證 | 請求 Body | 成功回應 |
|------|------|------|-----------|---------|
| POST | `/api/auth/register` | 無 | `{email, password, name}` | 201 `{user, token}` |
| POST | `/api/auth/login` | 無 | `{email, password}` | 200 `{user, token}` |
| GET | `/api/auth/profile` | JWT | — | 200 `{id, email, name, role, created_at}` |

### 錯誤碼

| 狀態碼 | error | 情境 |
|--------|-------|------|
| 400 | `VALIDATION_ERROR` | 缺少必填欄位、email 格式錯誤、密碼少於6碼 |
| 401 | `UNAUTHORIZED` | 密碼錯誤、token 無效/過期 |
| 409 | `CONFLICT` | email 已被註冊 |

---

## 2. 商品瀏覽

### 行為描述

**商品列表**（`GET /api/products`）：
- **無需認證**，公開端點
- 查詢參數：`page`（預設 1）、`limit`（預設 10，最大 100，最小 1）
- 排序：`created_at DESC`（最新建立的排前面）
- 回傳 `data.products`（陣列）與 `data.pagination`（`{total, page, limit, totalPages}`）

**商品詳情**（`GET /api/products/:id`）：
- 無需認證
- id 不存在 → 404 `NOT_FOUND`

### 端點表

| 方法 | 路徑 | 認證 | 查詢參數 | 成功回應 |
|------|------|------|---------|---------|
| GET | `/api/products` | 無 | `page, limit` | 200 `{products[], pagination}` |
| GET | `/api/products/:id` | 無 | — | 200 `{...product}` |

### 商品欄位

回應中每個 product 物件包含：`id, name, description, price, stock, image_url, created_at, updated_at`

---

## 3. 購物車

### 行為描述

購物車採**雙模式認證**（`dualAuth`）：
- 已登入用戶：以 `user_id` 識別，傳 `Authorization: Bearer <token>`
- 訪客：以 `session_id` 識別，傳 `X-Session-Id: <uuid>` header（客戶端自行生成並在 localStorage 持久化）

**查看購物車**（`GET /api/cart`）：
- JOIN products 表取得完整商品資訊
- 計算 `total = Σ(price × quantity)`
- 回傳 `{items: [{id, product_id, quantity, product: {name, price, stock, image_url}}], total}`

**加入商品**（`POST /api/cart`）：
- 必填：`productId`
- 選填：`quantity`（預設 1，必須為正整數）
- **累加邏輯**：若同商品已在購物車，則合併數量（`newQty = existing + qty`）
- 庫存檢查：最終數量（累加後）不得超過 `product.stock`，否則 400 `STOCK_INSUFFICIENT`
- 商品不存在 → 404 `NOT_FOUND`

**修改數量**（`PATCH /api/cart/:itemId`）：
- 必填：`quantity`（正整數）
- 以新數量**取代**舊數量（不是累加）
- 驗證新數量不超過庫存

**移除項目**（`DELETE /api/cart/:itemId`）：
- 驗證 itemId 屬於當前用戶/session

### 端點表

| 方法 | 路徑 | 認證 | 請求 Body | 成功回應 |
|------|------|------|-----------|---------|
| GET | `/api/cart` | JWT 或 Session | — | 200 `{items[], total}` |
| POST | `/api/cart` | JWT 或 Session | `{productId, quantity?}` | 200 `{id, product_id, quantity}` |
| PATCH | `/api/cart/:itemId` | JWT 或 Session | `{quantity}` | 200 `{id, product_id, quantity}` |
| DELETE | `/api/cart/:itemId` | JWT 或 Session | — | 200 `{data: null}` |

### 錯誤碼

| 狀態碼 | error | 情境 |
|--------|-------|------|
| 400 | `VALIDATION_ERROR` | quantity 非正整數 |
| 400 | `STOCK_INSUFFICIENT` | 數量超過庫存 |
| 401 | `UNAUTHORIZED` | 無有效 token 也無 X-Session-Id |
| 404 | `NOT_FOUND` | 商品或購物車項目不存在 |

---

## 4. 訂單管理

### 行為描述

**建立訂單**（`POST /api/orders`）：
- 需 JWT（不支援訪客）
- 必填：`recipientName`、`recipientEmail`（驗證格式）、`recipientAddress`
- 從 `cart_items WHERE user_id = ?` 取得用戶購物車（JOIN products）
- 購物車為空 → 400 `CART_EMPTY`
- 任一商品庫存不足 → 400 `STOCK_INSUFFICIENT`（列出所有庫存不足商品名稱）
- 以 SQLite transaction 原子執行：
  1. `INSERT INTO orders`（order_no 格式：`ORD-YYYYMMDD-XXXXX`，X為UUID前5碼大寫）
  2. `INSERT INTO order_items`（每個購物車項目，含名稱/價格快照）
  3. `UPDATE products SET stock = stock - quantity`（逐項扣庫存）
  4. `DELETE FROM cart_items WHERE user_id = ?`（清空購物車）
- 回傳 201，`{id, order_no, total_amount, status, items[], created_at}`

**我的訂單列表**（`GET /api/orders`）：
- 需 JWT
- 只回傳當前用戶的訂單（`WHERE user_id = ?`）
- 按 `created_at DESC` 排序
- 回傳 `{orders: [{id, order_no, total_amount, status, created_at}]}`

**訂單詳情**（`GET /api/orders/:id`）：
- 需 JWT
- `WHERE id = ? AND user_id = ?`（確保只能查看自己的訂單）
- 回傳完整訂單 + `items[]`（order_items）

**模擬付款**（`PATCH /api/orders/:id/pay`）：
- 需 JWT
- 必填：`action`，值為 `"success"` 或 `"fail"`
- 只有 `status = 'pending'` 的訂單可以付款（否則 400 `INVALID_STATUS`）
- `action=success` → status 改為 `'paid'`；`action=fail` → `'failed'`
- 付款後訂單狀態**不可逆**（無法從 paid/failed 改回 pending）

### 端點表

| 方法 | 路徑 | 認證 | 請求 Body | 成功回應 |
|------|------|------|-----------|---------|
| POST | `/api/orders` | JWT | `{recipientName, recipientEmail, recipientAddress}` | 201 `{order + items[]}` |
| GET | `/api/orders` | JWT | — | 200 `{orders[]}` |
| GET | `/api/orders/:id` | JWT | — | 200 `{...order, items[]}` |
| PATCH | `/api/orders/:id/pay` | JWT | `{action: "success"\|"fail"}` | 200 `{...order, items[]}` |
| POST | `/api/orders/:id/ecpay/query` | JWT | — | 200 `{...order, items[]}` |

### 錯誤碼

| 狀態碼 | error | 情境 |
|--------|-------|------|
| 400 | `VALIDATION_ERROR` | 必填欄位缺失、email 格式錯誤、action 無效 |
| 400 | `CART_EMPTY` | 購物車為空無法建立訂單 |
| 400 | `STOCK_INSUFFICIENT` | 商品庫存不足 |
| 400 | `INVALID_STATUS` | 訂單狀態非 pending，無法付款 |
| 400 | `NOT_SUBMITTED` | 尚未送出付款（merchant_trade_no 為空）|
| 401 | `UNAUTHORIZED` | 未登入或 token 無效 |
| 404 | `NOT_FOUND` | 訂單不存在或不屬於當前用戶 |
| 502 | `ECPAY_ERROR` | 呼叫綠界 QueryTradeInfo 失敗 |

---

## 4.1 綠界 ECPay 金流

### 行為描述

使用者在訂單詳情頁對 `status = 'pending'` 的訂單進行真實信用卡付款。

**取得付款參數**（`POST /api/ecpay/checkout/:orderId`）：
- 需 JWT，訂單必須屬於當前用戶
- 若 `merchant_trade_no` 尚未生成，由 `order_no` 移除 dash 推導（`ORD-20260503-ABC12` → `ORD20260503ABC12`），並儲存至 DB
- 回傳 `{action: "https://payment-stage.ecpay.com.tw/...", params: {...}}` — 前端動態建立 `<form>` POST 至綠界，瀏覽器跳轉離開

**綠界付款結果導回**（`POST /api/ecpay/result`）：
- 綠界付款完成後將瀏覽器 redirect 至此端點（`OrderResultURL`），無需認證
- 根據 `RtnCode` 導向 `/orders/:id?payment=success` 或 `/orders/:id?payment=failed`
- 注意：ECPay 僅允許 `OrderResultURL` 為 port 80/443，本地 port 3001 下此 redirect 可能不會到達

**綠界 S2S Callback**（`POST /api/ecpay/notify`）：
- 綠界付款完成後 server-to-server 呼叫此端點（`ReturnURL`），無需認證
- 驗證 `CheckMacValue` 後依 `RtnCode` 更新訂單狀態
- 本地開發（port 3001）無法接收此 callback，實作供正式環境部署使用

**主動查詢付款狀態**（`POST /api/orders/:id/ecpay/query`）：
- 需 JWT，本地開發的主要確認機制（替代 S2S callback）
- 訂單必須已有 `merchant_trade_no`（即已送出至綠界）
- 呼叫 ECPay `QueryTradeInfo` API：`TradeStatus='1'` → 更新為 `'paid'`；其他非 `'0'` → `'failed'`
- 狀態已確認（非 pending）的訂單直接回傳現有狀態，不重複查詢

### 付款流程

```
訂單詳情頁（status=pending）
  │
  ├─ 點「前往綠界付款」
  │   └─ POST /api/ecpay/checkout/:id → 取得 {action, params}
  │       └─ 前端動態 form.submit() → 瀏覽器跳轉至綠界付款頁
  │           └─ 使用者完成付款
  │               └─ 綠界 redirect 回 /api/ecpay/result（若 port 允許）
  │                   └─ redirect 至 /orders/:id?payment=success
  │
  └─ 回到訂單頁後，點「確認付款狀態」
      └─ POST /api/orders/:id/ecpay/query → 呼叫 ECPay QueryTradeInfo
          └─ 更新訂單狀態至 paid / failed / pending
```

### 端點表

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | `/api/ecpay/checkout/:orderId` | JWT | 產生 ECPay AIO 付款參數 |
| POST | `/api/ecpay/notify` | 無（驗 CMV） | 綠界 S2S 付款通知 callback |
| POST | `/api/ecpay/result` | 無 | 綠界付款完成後瀏覽器導回 |
| POST | `/api/orders/:id/ecpay/query` | JWT | 主動查詢並更新付款狀態 |

### 環境變數

| 變數 | 說明 | 測試值 |
|------|------|------|
| `ECPAY_MERCHANT_ID` | 綠界商店代號 | `3002607` |
| `ECPAY_HASH_KEY` | 用於 CheckMacValue 計算 | `pwFHCqoQZGmho4w6` |
| `ECPAY_HASH_IV` | 用於 CheckMacValue 計算 | `EkRm7iFT261dpevs` |
| `ECPAY_ENV` | `stage`（測試）或 `production` | `stage` |
| `BASE_URL` | 伺服器公開 URL（用於 ReturnURL/OrderResultURL） | `http://localhost:3001` |

### 錯誤碼

| 狀態碼 | error | 情境 |
|--------|-------|------|
| 400 | `INVALID_STATUS` | 訂單非 pending 狀態，無法送出付款 |
| 400 | `NOT_SUBMITTED` | 尚未送出付款（無 merchant_trade_no） |
| 404 | `NOT_FOUND` | 訂單不存在或不屬於當前用戶 |
| 502 | `ECPAY_ERROR` | 呼叫 ECPay QueryTradeInfo API 失敗 |

---

## 5. 管理後台 — 商品

### 行為描述

所有路由需 `JWT + admin role`。

**後台商品列表**（`GET /api/admin/products`）：
- 查詢參數：`page`（預設1）、`limit`（預設10，1-100）
- 回傳所有欄位（含 description、created_at、updated_at）
- 與公開列表相同排序邏輯（`created_at DESC`）

**新增商品**（`POST /api/admin/products`）：
- 必填：`name`（string）、`price`（正整數）、`stock`（非負整數）
- 選填：`description`、`image_url`
- 驗證：
  - `name` 不可為空字串
  - `price` 必須為整數且 > 0（型別嚴格檢查：`Number.isInteger(price) && price > 0`）
  - `stock` 必須為整數且 >= 0

**編輯商品**（`PUT /api/admin/products/:id`）：
- 支援**部分更新**（只傳需要修改的欄位）
- 未傳入的欄位保留原值
- `updated_at` 自動更新為 `datetime('now')`
- 商品不存在 → 404

**刪除商品**（`DELETE /api/admin/products/:id`）：
- **刪除保護**：若商品存在於任一 `status = 'pending'` 的訂單中 → 409 `CONFLICT`
- 已結束訂單（paid/failed）的商品可以刪除
- 商品不存在 → 404

### 端點表

| 方法 | 路徑 | 認證 | 請求 Body | 成功回應 |
|------|------|------|-----------|---------|
| GET | `/api/admin/products` | JWT+admin | — | 200 `{products[], pagination}` |
| POST | `/api/admin/products` | JWT+admin | `{name, price, stock, description?, image_url?}` | 201 `{...product}` |
| PUT | `/api/admin/products/:id` | JWT+admin | 任意商品欄位（部分） | 200 `{...product}` |
| DELETE | `/api/admin/products/:id` | JWT+admin | — | 200 `{data: null}` |

### 錯誤碼

| 狀態碼 | error | 情境 |
|--------|-------|------|
| 400 | `VALIDATION_ERROR` | name 空、price 非正整數、stock 非非負整數 |
| 401 | `UNAUTHORIZED` | 未登入 |
| 403 | `FORBIDDEN` | 非 admin |
| 404 | `NOT_FOUND` | 商品不存在 |
| 409 | `CONFLICT` | 商品存在未完成訂單 |

---

## 6. 管理後台 — 訂單

### 行為描述

所有路由需 `JWT + admin role`。

**後台訂單列表**（`GET /api/admin/orders`）：
- 查詢參數：`page`（預設1）、`limit`（預設10）、`status`（可選：`pending|paid|failed`）
- `status` 參數若非有效值則忽略（回傳全部）
- 回傳所有訂單欄位（不篩選用戶）

**後台訂單詳情**（`GET /api/admin/orders/:id`）：
- 不限制用戶（可查看任意訂單）
- 回傳：`{...order, items[], user: {name, email}}`
- 若訂單對應用戶已不存在，`user` 欄位為 `null`

### 端點表

| 方法 | 路徑 | 認證 | 查詢參數 | 成功回應 |
|------|------|------|---------|---------|
| GET | `/api/admin/orders` | JWT+admin | `page, limit, status` | 200 `{orders[], pagination}` |
| GET | `/api/admin/orders/:id` | JWT+admin | — | 200 `{...order, items[], user}` |

---

## 7. EJS 前端頁面

### 頁面路由

| URL | EJS 模板 | 用途 |
|-----|----------|------|
| `GET /` | pages/index.ejs | 商品列表首頁 |
| `GET /products/:id` | pages/product-detail.ejs | 商品詳情 |
| `GET /cart` | pages/cart.ejs | 購物車 |
| `GET /checkout` | pages/checkout.ejs | 結帳頁 |
| `GET /login` | pages/login.ejs | 登入頁 |
| `GET /orders` | pages/orders.ejs | 我的訂單列表 |
| `GET /orders/:id` | pages/order-detail.ejs | 訂單詳情 |
| `GET /admin/products` | pages/admin-products.ejs | 後台商品管理 |
| `GET /admin/orders` | pages/admin-orders.ejs | 後台訂單管理 |

頁面使用 `layouts/front.ejs` 或 `layouts/admin.ejs` 作為外框（含 header、footer）。

業務邏輯由 `public/js/pages/*.js` 在前端以 `fetch` 呼叫 API 執行（SPA-like 方式）。

---

## 8. 種子資料

資料庫首次建立時自動插入：
- **管理員帳號**：`admin@hexschool.com` / `12345678`（role: admin）
- **8種花卉商品**：粉色玫瑰、白色百合、向日葵、紫色鬱金香、乾燥花圈、多肉植物、紅玫瑰99朵、季節鮮花訂閱

種子只在 users/products 表為空時執行（`IF NOT EXISTS` 邏輯），重啟伺服器不會重複插入。
