# 架構文件

## 目錄結構

```
project-root/
├── app.js                        # Express app 工廠：掛載 middleware、routes、error handler；不含 listen()
├── server.js                     # 入口點：驗證 JWT_SECRET 後呼叫 app.listen(3001)
├── database.sqlite               # SQLite 資料庫檔案（git ignore，首次啟動自動建立）
├── swagger-config.js             # swagger-jsdoc 設定，掃描 ./src/routes/*.js 的 @openapi 注解
├── generate-openapi.js           # CLI script：呼叫 swagger-jsdoc 後輸出 openapi.json
├── vitest.config.js              # Vitest 測試設定：globals、序列執行順序、hookTimeout
├── .env.example                  # 環境變數範本
├── .env                          # 實際環境變數（不進版控）
│
├── src/
│   ├── database.js               # 初始化 SQLite（pragma、建表、seed admin & products），export db 單例
│   ├── middleware/
│   │   ├── sessionMiddleware.js  # 從 X-Session-Id header 提取訪客 session，設 req.sessionId
│   │   ├── authMiddleware.js     # 驗證 Bearer JWT，設 req.user = {userId, email, role}
│   │   ├── adminMiddleware.js    # 驗證 req.user.role === 'admin'，否則 403
│   │   └── errorHandler.js      # 全局 Express 錯誤處理，統一 JSON 格式，隱藏 500 細節
│   └── routes/
│       ├── authRoutes.js         # POST /register, POST /login, GET /profile
│       ├── productRoutes.js      # GET /products, GET /products/:id（公開，無認證）
│       ├── cartRoutes.js         # GET/POST /cart, PATCH/DELETE /cart/:itemId（dualAuth）
│       ├── orderRoutes.js        # POST/GET /orders, GET /orders/:id, PATCH /orders/:id/pay
│       ├── adminProductRoutes.js # GET/POST /admin/products, PUT/DELETE /admin/products/:id
│       ├── adminOrderRoutes.js   # GET /admin/orders, GET /admin/orders/:id
│       └── pageRoutes.js         # EJS 頁面路由（/, /products/:id, /cart, /checkout, /orders 等）
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs             # 前台 HTML 外框（含 header、footer）
│   │   └── admin.ejs             # 後台 HTML 外框
│   └── pages/
│       ├── index.ejs             # 首頁（商品列表）
│       ├── product-detail.ejs    # 商品詳情頁
│       ├── cart.ejs              # 購物車頁
│       ├── checkout.ejs          # 結帳頁
│       ├── login.ejs             # 登入頁
│       ├── orders.ejs            # 訂單列表頁
│       ├── order-detail.ejs      # 訂單詳情頁
│       ├── admin-products.ejs    # 後台商品管理頁
│       ├── admin-orders.ejs      # 後台訂單管理頁
│       └── 404.ejs               # 404 頁面
│
├── public/
│   ├── css/
│   │   ├── input.css             # Tailwind CSS 來源（@tailwind 指令）
│   │   └── output.css            # 建置後的 CSS（由 build 指令產生）
│   └── js/
│       ├── api.js                # apiFetch() 封裝：自動加 auth headers、處理 401 跳轉
│       ├── auth.js               # Auth 物件：localStorage token/user 存取、session ID 管理
│       ├── notification.js       # Toast 通知系統：show(msg, type)，3秒自動消失
│       ├── header-init.js        # 頁面頭部初始化（登入狀態、購物車數量等）
│       └── pages/
│           ├── index.js          # 首頁邏輯（商品列表、加入購物車）
│           ├── login.js          # 登入頁邏輯
│           ├── product-detail.js # 商品詳情頁邏輯
│           ├── cart.js           # 購物車頁邏輯（CRUD cart items）
│           ├── checkout.js       # 結帳頁邏輯（建立訂單）
│           ├── orders.js         # 訂單列表頁邏輯
│           ├── order-detail.js   # 訂單詳情頁邏輯（含付款模擬）
│           ├── admin-products.js # 後台商品管理頁邏輯
│           └── admin-orders.js   # 後台訂單管理頁邏輯
│
└── tests/
    ├── setup.js                  # 測試共用 helpers：getAdminToken()、registerUser()
    ├── auth.test.js              # 認證端點測試
    ├── products.test.js          # 商品端點測試
    ├── cart.test.js              # 購物車端點測試
    ├── orders.test.js            # 訂單端點測試
    ├── adminProducts.test.js     # 後台商品端點測試
    └── adminOrders.test.js       # 後台訂單端點測試
```

## 啟動流程

```
node server.js
  │
  ├─ 驗證 JWT_SECRET（缺少則 process.exit(1)）
  │
  ├─ require('./app')
  │     ├─ require('dotenv').config()
  │     ├─ require('./src/database')   ← 建立/開啟 database.sqlite
  │     │     ├─ db.pragma('journal_mode = WAL')
  │     │     ├─ db.pragma('foreign_keys = ON')
  │     │     ├─ CREATE TABLE IF NOT EXISTS（5張表）
  │     │     ├─ seedAdminUser()  ← 僅在 admin email 不存在時插入
  │     │     └─ seedProducts()   ← 僅在 products 表為空時插入 8 筆
  │     │
  │     ├─ 掛載 global middleware
  │     │     ├─ cors({ origin: FRONTEND_URL })
  │     │     ├─ express.json()
  │     │     ├─ express.urlencoded({ extended: false })
  │     │     └─ sessionMiddleware  ← 解析 X-Session-Id header
  │     │
  │     ├─ 掛載 API routes（見路由表）
  │     ├─ 掛載 page routes
  │     ├─ 404 handler
  │     └─ errorHandler
  │
  └─ app.listen(3001)
```

## API 路由總覽

| 方法 | 路徑 | 檔案 | 認證 | 說明 |
|------|------|------|------|------|
| POST | `/api/auth/register` | authRoutes.js | 無 | 註冊（email/password/name） |
| POST | `/api/auth/login` | authRoutes.js | 無 | 登入，回傳 JWT |
| GET | `/api/auth/profile` | authRoutes.js | JWT | 取得當前使用者資料 |
| GET | `/api/products` | productRoutes.js | 無 | 商品列表（分頁） |
| GET | `/api/products/:id` | productRoutes.js | 無 | 商品詳情 |
| GET | `/api/cart` | cartRoutes.js | JWT 或 Session | 查看購物車 |
| POST | `/api/cart` | cartRoutes.js | JWT 或 Session | 加入商品（累加） |
| PATCH | `/api/cart/:itemId` | cartRoutes.js | JWT 或 Session | 修改數量 |
| DELETE | `/api/cart/:itemId` | cartRoutes.js | JWT 或 Session | 移除項目 |
| POST | `/api/orders` | orderRoutes.js | JWT | 建立訂單（含庫存 transaction） |
| GET | `/api/orders` | orderRoutes.js | JWT | 我的訂單列表 |
| GET | `/api/orders/:id` | orderRoutes.js | JWT | 訂單詳情（僅限本人） |
| PATCH | `/api/orders/:id/pay` | orderRoutes.js | JWT | 模擬付款 |
| GET | `/api/admin/products` | adminProductRoutes.js | JWT + admin | 後台商品列表（分頁） |
| POST | `/api/admin/products` | adminProductRoutes.js | JWT + admin | 新增商品 |
| PUT | `/api/admin/products/:id` | adminProductRoutes.js | JWT + admin | 編輯商品（可部分更新） |
| DELETE | `/api/admin/products/:id` | adminProductRoutes.js | JWT + admin | 刪除商品 |
| GET | `/api/admin/orders` | adminOrderRoutes.js | JWT + admin | 後台訂單列表（可 status 篩選） |
| GET | `/api/admin/orders/:id` | adminOrderRoutes.js | JWT + admin | 後台訂單詳情（含用戶資訊） |

## 統一回應格式

所有 API（含錯誤）均使用以下 JSON 格式：

```json
{
  "data": { ... } | null,
  "error": null | "ERROR_CODE",
  "message": "人類可讀訊息"
}
```

成功範例：
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "王小明", "role": "user" },
    "token": "eyJhbGc..."
  },
  "error": null,
  "message": "登入成功"
}
```

錯誤範例：
```json
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "密碼至少需要 6 個字元"
}
```

## 認證與授權機制

### JWT 認證（authMiddleware.js）

適用路由：`/api/auth/profile`、`/api/orders/*`、`/api/admin/*`

1. 讀取 `Authorization: Bearer <token>` header
2. 使用 `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` 驗證
3. 從 DB 確認 `users.id` 仍存在（防止已刪除帳號的舊 token）
4. 設定 `req.user = { userId, email, role }`

JWT Payload：`{ userId, email, role }`，有效期 **7天**（`expiresIn: '7d'`）

錯誤情境：
- Header 缺失或非 Bearer → 401 `UNAUTHORIZED` 「請先登入」
- Token 無效或過期 → 401 `UNAUTHORIZED` 「Token 無效或已過期」
- 用戶已從 DB 刪除 → 401 `UNAUTHORIZED` 「使用者不存在，請重新登入」

### Admin 授權（adminMiddleware.js）

接在 authMiddleware 之後執行，檢查 `req.user.role === 'admin'`，否則 403 `FORBIDDEN`。

### 購物車雙模式認證（cartRoutes.js dualAuth）

購物車允許**訪客操作**（透過 session ID）：

```
請求進入 dualAuth()
  │
  ├─ Authorization header 存在？
  │     ├─ 是 → jwt.verify()
  │     │         ├─ 成功 → 設 req.user，繼續
  │     │         └─ 失敗 → 立即回 401（不 fallback 至 session）
  │     └─ 否 → 檢查 req.sessionId（X-Session-Id header）
  │               ├─ 存在 → 繼續（訪客模式）
  │               └─ 不存在 → 401
```

**重要**：若 Authorization header 存在但 token 無效，會直接回 401，**不會** fallback 至 session 模式。這防止 token 偷換攻擊。

購物車歸屬判斷（`getOwnerCondition()`）：
- 有 `req.user` → 使用 `user_id = req.user.userId`
- 無 → 使用 `session_id = req.sessionId`

## 資料庫 Schema

資料庫位置：`database.sqlite`（專案根目錄）

SQLite pragmas：
- `journal_mode = WAL`（Write-Ahead Logging，提升並發讀取效能）
- `foreign_keys = ON`（強制外鍵約束）

### users 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `email` | TEXT | UNIQUE NOT NULL | 登入帳號 |
| `password_hash` | TEXT | NOT NULL | bcrypt hash，saltRounds=10（測試環境=1） |
| `name` | TEXT | NOT NULL | 顯示名稱 |
| `role` | TEXT | NOT NULL DEFAULT 'user' CHECK IN ('user','admin') | 角色 |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | 建立時間（UTC，ISO格式） |

### products 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `name` | TEXT | NOT NULL | 商品名稱 |
| `description` | TEXT | — | 商品描述（可 NULL） |
| `price` | INTEGER | NOT NULL CHECK(price > 0) | 單價（整數，單位：元） |
| `stock` | INTEGER | NOT NULL DEFAULT 0 CHECK(stock >= 0) | 庫存數量 |
| `image_url` | TEXT | — | 商品圖片 URL（可 NULL） |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | 建立時間 |
| `updated_at` | TEXT | NOT NULL DEFAULT datetime('now') | 更新時間（PUT 時手動更新） |

### cart_items 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `session_id` | TEXT | — | 訪客 session ID（與 user_id 擇一） |
| `user_id` | TEXT | FK → users(id) | 登入用戶 ID（與 session_id 擇一） |
| `product_id` | TEXT | NOT NULL FK → products(id) | 商品 ID |
| `quantity` | INTEGER | NOT NULL DEFAULT 1 CHECK(quantity > 0) | 數量（必須 >= 1） |

注意：`session_id` 與 `user_id` 無 CHECK 約束確保二擇一，需靠應用層保證。

### orders 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `order_no` | TEXT | UNIQUE NOT NULL | 格式：`ORD-YYYYMMDD-XXXXX`（UUID 前5碼大寫） |
| `user_id` | TEXT | NOT NULL FK → users(id) | 下訂用戶 |
| `recipient_name` | TEXT | NOT NULL | 收件人姓名 |
| `recipient_email` | TEXT | NOT NULL | 收件人 Email |
| `recipient_address` | TEXT | NOT NULL | 收件地址 |
| `total_amount` | INTEGER | NOT NULL | 訂單總金額（元） |
| `status` | TEXT | NOT NULL DEFAULT 'pending' CHECK IN ('pending','paid','failed') | 訂單狀態 |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | 建立時間 |

### order_items 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `order_id` | TEXT | NOT NULL FK → orders(id) | 所屬訂單 |
| `product_id` | TEXT | NOT NULL | 商品 ID（快照，不設 FK 避免商品刪除後資料遺失） |
| `product_name` | TEXT | NOT NULL | 下訂當時商品名稱（快照） |
| `product_price` | INTEGER | NOT NULL | 下訂當時商品單價（快照） |
| `quantity` | INTEGER | NOT NULL | 購買數量 |

`product_name` 與 `product_price` 儲存快照是重要設計決策：商品日後修改或刪除不影響歷史訂單記錄。

## 資料流

### 結帳流程（關鍵）

```
POST /api/orders
  │
  ├─ authMiddleware（JWT 必填）
  ├─ 驗證 recipientName / recipientEmail / recipientAddress
  ├─ 從 cart_items WHERE user_id = ? 取得購物車（JOIN products）
  ├─ 購物車為空？→ 400 CART_EMPTY
  ├─ 任一商品 quantity > stock？→ 400 STOCK_INSUFFICIENT
  ├─ 計算 totalAmount
  │
  └─ db.transaction()（原子操作）
        ├─ INSERT INTO orders
        ├─ INSERT INTO order_items（每個 cart item 一筆）
        ├─ UPDATE products SET stock = stock - quantity（每個 cart item）
        └─ DELETE FROM cart_items WHERE user_id = ?
```

### 購物車加入商品（累加邏輯）

```
POST /api/cart { productId, quantity }
  │
  ├─ dualAuth（JWT 優先，否則 X-Session-Id）
  ├─ 驗證 productId 存在（否則 404）
  ├─ 查詢 cart_items WHERE product_id = ? AND {owner_field} = ?
  │
  ├─ 已存在？→ 累加數量（newQty = existing.quantity + qty）
  │     └─ newQty > stock？→ 400 STOCK_INSUFFICIENT
  └─ 不存在？→ 插入新 cart_item
        └─ qty > stock？→ 400 STOCK_INSUFFICIENT
```
