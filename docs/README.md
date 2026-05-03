# 花卉電商後端專案

一個以 Node.js + Express 打造的花卉電商後端，提供 RESTful API 與 EJS 伺服器端渲染頁面，支援訪客購物車、JWT 認證、訂單管理與管理後台。

## 技術棧

| 層面 | 技術 |
|------|------|
| 執行環境 | Node.js (CommonJS 模組系統) |
| Web 框架 | Express ~4.16.1 |
| 資料庫 | SQLite via better-sqlite3 ^12.8.0 |
| 認證 | jsonwebtoken ^9.0.2 / bcrypt ^6.0.0 |
| 模板引擎 | EJS ^5.0.1 |
| CSS 框架 | Tailwind CSS ^4.2.2 |
| ID 生成 | uuid ^11.1.0 |
| API 文件 | swagger-jsdoc ^6.2.8 (OpenAPI 3.0.3) |
| 測試框架 | Vitest ^2.1.9 + supertest ^7.2.2 |
| 跨域 | cors ^2.8.5 |

## 快速開始

```bash
# 1. 複製環境變數範本
cp .env.example .env

# 2. 編輯 .env，至少設定 JWT_SECRET
#    JWT_SECRET=your-secret-key-at-least-32-chars

# 3. 安裝依賴
npm install

# 4. 啟動開發伺服器（port 3001）
npm run dev:server

# （選用）同時開啟 CSS 監控（另開 terminal）
npm run dev:css
```

伺服器啟動後訪問：
- 前台：http://localhost:3001/
- 管理後台：http://localhost:3001/admin/products
- 預設管理員：`admin@hexschool.com` / `12345678`

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev:server` | 啟動 Express 伺服器（port 3001） |
| `npm run dev:css` | 監控 Tailwind CSS 變更 |
| `npm start` | 生產啟動（先 build CSS 再起服務） |
| `npm test` | 執行全部測試（Vitest） |
| `npm run openapi` | 產生 openapi.json（需先啟動？否，直接執行） |
| `npm run css:build` | 一次性 build minified CSS |

## 環境變數

詳見 `.env.example`。**必填**：`JWT_SECRET`。

| 變數 | 用途 | 必要 | 預設值 |
|------|------|------|--------|
| `JWT_SECRET` | JWT 簽名金鑰 | **必填** | — |
| `BASE_URL` | 後端 URL（供 ECPay 回呼用） | 選填 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS 允許的前端來源 | 選填 | `http://localhost:3001` |
| `ADMIN_EMAIL` | 種子管理員 Email | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 種子管理員密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | 綠界特店編號 | 選填 | `3002607` |
| `ECPAY_HASH_KEY` | 綠界 Hash Key | 選填 | — |
| `ECPAY_HASH_IV` | 綠界 Hash IV | 選填 | — |
| `ECPAY_ENV` | 綠界環境（staging/production） | 選填 | `staging` |

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 目錄結構、啟動流程、API 路由表、資料庫 Schema |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 命名規範、新增 API/Middleware 步驟、計畫歸檔流程 |
| [FEATURES.md](./FEATURES.md) | 各功能行為描述、端點表格、錯誤碼說明 |
| [TESTING.md](./TESTING.md) | 測試架構、執行順序、撰寫新測試步驟 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新紀錄 |
| [plans/](./plans/) | 進行中的開發計畫 |
| [plans/archive/](./plans/archive/) | 已完成計畫歸檔 |
