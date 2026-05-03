# 開發規範

## 模組系統

本專案使用 **CommonJS**（`require` / `module.exports`），**不使用** ES modules（`import`/`export`）。

唯一例外：`vitest.config.js` 使用 `import { defineConfig } from 'vitest/config'`，因為 Vitest 設定檔由 Vitest 本身載入，支援 ES module 語法。

## 命名規則

| 項目 | 規則 | 範例 |
|------|------|------|
| 檔案名稱（路由） | camelCase + 功能後綴 | `authRoutes.js`, `adminProductRoutes.js` |
| 檔案名稱（middleware） | camelCase + Middleware | `authMiddleware.js`, `sessionMiddleware.js` |
| 路由前綴 | kebab-case | `/api/admin/products`, `/api/cart` |
| DB 欄位 | snake_case | `user_id`, `product_name`, `created_at` |
| JS 變數 | camelCase | `req.user`, `cartItems`, `orderId` |
| Request body 欄位 | camelCase | `productId`, `recipientName`, `recipientEmail` |
| Response JSON 欄位 | snake_case | `order_no`, `total_amount`, `image_url` |
| Error code | UPPER_SNAKE_CASE | `VALIDATION_ERROR`, `STOCK_INSUFFICIENT`, `NOT_FOUND` |
| UUID | 由 `uuidv4()` 生成 | 用於所有表的 PRIMARY KEY |

**Request body vs Response**：前端送來的 body 用 camelCase（`productId`），資料庫回傳的 JSON 用 snake_case（`product_id`）。這是現有慣例，務必遵守避免混亂。

## 環境變數表

| 變數 | 用途 | 必要性 | 預設值 |
|------|------|--------|--------|
| `JWT_SECRET` | JWT 簽名/驗證金鑰，缺少時 server.js 會 exit(1) | **必填** | — |
| `PORT` | 伺服器監聽 port | 選填 | `3001` |
| `BASE_URL` | 後端完整 URL（ECPay 非同步通知回呼位址） | 選填 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS 允許的 origin | 選填 | `http://localhost:3001` |
| `ADMIN_EMAIL` | 資料庫種子管理員 Email | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 資料庫種子管理員密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | 綠界金流特店編號 | 選填（金流功能必填） | `3002607` |
| `ECPAY_HASH_KEY` | 綠界金流 Hash Key | 選填（金流功能必填） | — |
| `ECPAY_HASH_IV` | 綠界金流 Hash IV | 選填（金流功能必填） | — |
| `ECPAY_ENV` | 綠界環境（`staging` / `production`） | 選填 | `staging` |
| `NODE_ENV` | 執行環境；值為 `test` 時 bcrypt saltRounds 降為 1 加速測試 | 選填 | — |

## 新增 API 路由

1. **決定路由檔案**：選擇現有路由檔（如 `authRoutes.js`）或建立新的（如 `newFeatureRoutes.js`）

2. **撰寫路由處理器**：在路由檔加入 `@openapi` JSDoc 注解（供 swagger-jsdoc 產生文件）

   ```js
   /**
    * @openapi
    * /api/your-route:
    *   post:
    *     summary: 說明
    *     tags: [TagName]
    *     security:
    *       - bearerAuth: []
    *     requestBody: ...
    *     responses: ...
    */
   router.post('/', authMiddleware, (req, res) => {
     // 從 db 讀取/寫入使用 prepared statements
     const result = db.prepare('SELECT ...').get(param);
     res.json({ data: result, error: null, message: '成功' });
   });
   ```

3. **掛載路由**：在 `app.js` 加入 `app.use('/api/your-route', require('./src/routes/yourRoutes'))`

4. **套用 middleware**：
   - 需要登入：在路由檔頂部 `router.use(authMiddleware)` 或個別 handler 加參數
   - 需要管理員：`router.use(authMiddleware, adminMiddleware)`
   - 購物車雙模式：使用路由檔內的 `dualAuth` middleware

5. **回應格式**：所有回應必須符合統一格式 `{ data, error, message }`

## 新增 Middleware

1. 在 `src/middleware/` 建立新檔案（命名：`camelCaseMiddleware.js`）

2. 匯出單一 function，接受 `(req, res, next)` 參數

3. 在 `app.js` 或個別路由中引入並使用

   ```js
   // app.js（全局 middleware）
   const myMiddleware = require('./src/middleware/myMiddleware');
   app.use(myMiddleware);
   
   // 或在路由檔（局部使用）
   router.get('/protected', myMiddleware, handler);
   ```

## 新增資料庫表或欄位

1. 編輯 `src/database.js` 中的 `initializeDatabase()` 函式

2. 修改對應的 `CREATE TABLE IF NOT EXISTS` 語句

3. **重要**：`IF NOT EXISTS` 表示若表已存在則跳過 CREATE，**不會**自動 migrate 現有表格結構。開發時若修改已存在表的 schema，必須刪除 `database.sqlite` 後重新啟動。

4. 若需要新的種子資料，在 `seedProducts()` 或建立新的 `seedXxx()` 函式，並在 `initializeDatabase()` 末尾呼叫。

## 計畫歸檔流程

### 計畫檔案命名格式

```
docs/plans/YYYY-MM-DD-<feature-name>.md
```

範例：`docs/plans/2026-05-03-payment-integration.md`

### 計畫文件結構

```markdown
# [功能名稱] 開發計畫

**日期**：YYYY-MM-DD
**狀態**：進行中 / 已完成

## User Story
身為 [角色]，我希望 [功能]，以便 [目的]。

## Spec（技術規格）
- 端點：...
- 請求格式：...
- 業務邏輯：...

## Tasks
- [ ] 建立資料庫 schema
- [ ] 實作 API 路由
- [ ] 撰寫測試
- [ ] 更新文件
```

### 功能完成後的收尾步驟

1. 將計畫檔案移至 `docs/plans/archive/`
2. 更新 `docs/FEATURES.md` — 將功能狀態改為 ✅，補充行為描述
3. 更新 `docs/CHANGELOG.md` — 新增版本記錄

## JSDoc 格式

本專案 JSDoc 主要用於 OpenAPI 路由注解。格式範例：

```js
/**
 * @openapi
 * /api/resource:
 *   get:
 *     summary: 一行功能摘要
 *     tags: [TagName]         # 對應 swagger-config.js 的 tags 設定
 *     security:               # 可選：bearerAuth 或 sessionId
 *       - bearerAuth: []
 *     parameters:             # query/path 參數
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1]
 *             properties:
 *               field1:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: ...
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 參數錯誤
 *       401:
 *         description: 未登入
 */
```

執行 `npm run openapi` 後，swagger-jsdoc 會掃描所有 `src/routes/*.js` 中的 `@openapi` 注解並輸出 `openapi.json`。
