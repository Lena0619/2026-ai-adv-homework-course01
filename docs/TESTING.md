# 測試規範與指南

## 技術棧

- **框架**：Vitest ^2.1.9（ESM/CJS 相容，支援 globals）
- **HTTP 測試**：supertest ^7.2.2
- **資料庫**：測試共用開發資料庫（`database.sqlite`）

## 測試檔案總覽

| 測試檔 | 測試對象 | 主要涵蓋範圍 |
|--------|----------|------------|
| `tests/auth.test.js` | `POST /register`, `POST /login`, `GET /profile` | 成功註冊、重複 email、登入成功/失敗、profile 認證 |
| `tests/products.test.js` | `GET /products`, `GET /products/:id` | 分頁回應結構、詳情、404 |
| `tests/cart.test.js` | `GET/POST/PATCH/DELETE /cart` | 訪客 session cart、登入 cart、累加邏輯、404 |
| `tests/orders.test.js` | `POST/GET/PATCH /orders` | 建立訂單完整流程、空購物車、401、詳情、付款模擬 |
| `tests/adminProducts.test.js` | `GET/POST/PUT/DELETE /admin/products` | CRUD、驗證錯誤、403 防護 |
| `tests/adminOrders.test.js` | `GET /admin/orders`, `GET /admin/orders/:id` | status 篩選、詳情含 user 資訊、403 防護 |

## 執行順序與依賴關係

Vitest 設定 `fileParallelism: false`，測試檔案**序列執行**，順序固定：

```
1. auth.test.js         → 建立種子數據（users 表需存在 admin）
2. products.test.js     → 依賴 seedProducts（8筆初始商品）
3. cart.test.js         → 依賴 products 存在
4. orders.test.js       → 依賴 cart（先加入商品再建立訂單）
5. adminProducts.test.js → 依賴 admin token
6. adminOrders.test.js  → 依賴 orders 存在（從 orders.test.js 建立）
```

**關鍵依賴**：`orders.test.js` 建立的訂單資料，`adminOrders.test.js` 會用到。若單獨執行 `adminOrders.test.js` 可能因缺少訂單資料而失敗。

## 輔助函式（tests/setup.js）

```js
const { app, request, getAdminToken, registerUser } = require('./setup');
```

### `getAdminToken()`

```js
async function getAdminToken(): Promise<string>
```

呼叫 `POST /api/auth/login` 以 seed admin 帳號（`admin@hexschool.com` / `12345678`）登入，回傳 JWT token string。每次呼叫都發送 HTTP 請求，不快取。

### `registerUser(overrides?)`

```js
async function registerUser(overrides?: {
  email?: string;
  password?: string;
  name?: string;
}): Promise<{ token: string, user: object }>
```

呼叫 `POST /api/auth/register` 建立測試用戶，預設：
- email：`test-{timestamp}-{random}@example.com`（確保唯一）
- password：`password123`
- name：`測試使用者`

回傳 `{ token, user }`（從 register response 取得）。

### `request`

supertest 的 `request(app)`，可直接呼叫：

```js
const res = await request(app).get('/api/products').expect(200);
```

## 撰寫新測試的步驟

### 1. 在對應測試檔加入 describe 區塊

```js
const { app, request, getAdminToken, registerUser } = require('./setup');

describe('功能名稱', () => {
  let token;

  beforeAll(async () => {
    // 準備測試資料
    const { token: t } = await registerUser();
    token = t;
  });

  it('成功案例描述', async () => {
    const res = await request(app)
      .post('/api/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ field: 'value' })
      .expect(201);

    expect(res.body.data).toBeDefined();
    expect(res.body.error).toBeNull();
  });

  it('錯誤案例描述', async () => {
    const res = await request(app)
      .post('/api/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ /* 缺少必填欄位 */ })
      .expect(400);

    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
```

### 2. 購物車測試 — Session ID

```js
const sessionId = 'test-session-' + Date.now();

const res = await request(app)
  .post('/api/cart')
  .set('X-Session-Id', sessionId)
  .send({ productId: '<uuid>', quantity: 1 })
  .expect(200);
```

### 3. Admin 測試

```js
let adminToken;
beforeAll(async () => {
  adminToken = await getAdminToken();
});

it('需要 admin role', async () => {
  const { token: userToken } = await registerUser();
  
  // 一般用戶應得到 403
  await request(app)
    .get('/api/admin/products')
    .set('Authorization', `Bearer ${userToken}`)
    .expect(403);
  
  // Admin 可以存取
  const res = await request(app)
    .get('/api/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
});
```

## 常見陷阱

### 1. 資料庫狀態殘留

測試使用**真實的 SQLite 資料庫**（`database.sqlite`），測試之間的資料不會自動清除。若某個測試依賴「初始狀態」（如 products 表筆數），可能因前面測試插入資料而失敗。

解法：不依賴絕對數字，改用相對斷言（如 `expect(products.length).toBeGreaterThan(0)`）。

### 2. 訂單 transaction 的隱含效果

`POST /api/orders` 會清空該用戶的購物車。若在同一個測試 session 中需要多次建立訂單，每次建立訂單前都要重新 `POST /api/cart` 加入商品。

### 3. bcrypt saltRounds 在測試環境

`src/database.js` 的 `seedAdminUser()` 在 `NODE_ENV === 'test'` 時使用 `saltRounds = 1`（加速 seed），但 `authRoutes.js` 的 register handler 固定使用 `saltRounds = 10`。若測試中需大量 register 用戶，可能較慢。

Vitest 無需手動設定 `NODE_ENV=test`，但若需要啟用 saltRounds=1 的種子加速，確認環境變數已設定。

### 4. 序列執行限制

所有測試檔案序列執行（`fileParallelism: false`），無法並行加速。這是因為共用同一個 SQLite 資料庫，避免並發寫入衝突。

### 5. 訪客購物車 vs 登入購物車互不可見

以 `X-Session-Id` 加入的購物車項目，以 JWT 登入後查詢 `GET /api/cart` 看不到（因為 owner_field 不同）。測試中需注意這個隔離性。

## 執行測試

```bash
# 執行全部測試（依序執行6個測試檔）
npm test

# 等同於
npx vitest run
```

測試輸出會顯示每個 describe/it 的結果。失敗時會顯示 diff 和錯誤堆疊。
