---
table: update_log
title: 更新履歴
business: common
source: 改修
---
Dashboard の版ごとの更新内容。画面右上の版の表示と「更新履歴」に出る。
版を上げるたびに backend/scripts/sql/ の update_log の SQL で1行足す（CLAUDE.md「版を上げるとき」）。
⚠️ 最新の版の行が無いと画面が真っ白になる。

## 列
- no: 連番（自動採番。SQL では書かない）
- version: 版（例 2.2.301）。⚠️ frontend/src/utils/version.ts の newVersion・ブランチ名と同じ
- date: 公開日
- note: 更新内容の本文（画面の更新履歴にそのまま出る）
