# CLAUDE.md

## 專案概述

花卉電商後端 — Node.js + Express + SQLite (better-sqlite3) + EJS + JWT 認證 + Tailwind CSS + Vitest

本專案是一個花卉電商平台的後端服務，支援公開商品瀏覽、雙模式購物車（訪客 session / 登入用戶）、訂單建立（含庫存 transaction）、模擬付款，以及管理後台的商品 CRUD 與訂單管理。

## 常用指令

```bash
# 安裝依賴
npm install

# 開發：啟動伺服器（不含 CSS watch）
npm run dev:server

# 開發：CSS 監控（另開 terminal）
npm run dev:css

# 正式啟動（先 build CSS 再啟動）
npm start

# 執行測試
npm test

# 產生 OpenAPI 文件（輸出 openapi.json）
npm run openapi

# 建置 CSS（minify 版本）
npm run css:build
```

## 關鍵規則

- **JWT_SECRET 必須設定**：server.js 啟動時若缺少 `JWT_SECRET` 環境變數會直接 `process.exit(1)`，絕不可省略
- **資料庫 schema 在 src/database.js**：新增欄位必須修改 `CREATE TABLE IF NOT EXISTS` 語句，但已存在的 DB 不會自動 migrate，開發時需刪除 `database.sqlite` 重建
- **雙模式購物車**：Cart 路由的 `dualAuth` middleware 先驗 Bearer JWT，失敗才用 `X-Session-Id`；若 Authorization header 存在但 token 無效，會直接回 401 而不 fallback 至 session
- **訂單結帳使用 SQLite transaction**：建立訂單、新增 order_items、扣庫存、清空購物車四步驟在同一個 `db.transaction()` 中執行，確保原子性
- **Admin 路由保護**：`/api/admin/*` 所有路由均套用 `authMiddleware` + `adminMiddleware`，role 必須為 `'admin'`（CHECK constraint 只允許 `'user'` 或 `'admin'`）
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`

## 詳細文件

- [./docs/README.md](./docs/README.md) — 項目介紹與快速開始
- [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流
- [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則
- [./docs/FEATURES.md](./docs/FEATURES.md) — 功能列表與完成狀態
- [./docs/TESTING.md](./docs/TESTING.md) — 測試規範與指南
- [./docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
