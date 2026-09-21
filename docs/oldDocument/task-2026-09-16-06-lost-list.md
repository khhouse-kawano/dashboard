# 指示⑥　`LostStatusList.tsx` の Express 化

⚠️ 依頼（要旨）: 「`LostStatusList.tsx` の Express 化も実装して」

---

## 追加・変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features/` | `lostList.ts` | ⚠️ **新規** |
| `frontend/src/components/` | `LostStatusList.tsx` | 通信先を `apiClient` へ |

## 追加した関数

- `runLostList()`（`lostList.ts`）— ⚠️ `WHERE status = '失注'` を SQL 側で付与

---

## ⚠️ 移植時の注意

- ⚠️ 移植元（`backend/src/handlers/lostList.php`）は `master_data` を**全件（24,697行）**返していた。画面が受け取ったあとで絞っていた
- ⚠️ **列名・別名は1文字も変えない**。`customized_input_01JRF9CZSW65A151WR30NA4PB3` などは**別名を付けずそのままの名前**で画面が使っている
- ⚠️ **日付の絞り込みは画面に残す**。起点（2026-06-01）が画面側の定数で、写すと片方だけ変わって食い違うため
- ⚠️ フロントは**本番URL直書き＋Token なし**だったので `apiClient` に変更

## 検証

⚠️ **2,562件すべてで値が完全一致**。14.3MB → 1.5MB（**89%減**）。

⚠️ 比較時は一度 ① へも転送されていて比較になっておらず、許可リストを一時的に外して**PHP本来の応答**と突き合わせ直した。

---

## 併せて対応: 失注先「不明」ボタン

| ディレクトリ | ファイル |
|---|---|
| `frontend/src/components/information/` | `TableStatus.tsx`（`unknownButton` を追加） |
| `frontend/src/utils/` | `informationUtils.ts`（⚠️ `UNKNOWN_COMPETITOR` を追加） |

⚠️ 同じ判定が **3か所**にある（`DatabaseOrder.tsx` / `LostStatusList.tsx` / `menu.ts`）。⚠️ **片方だけ直さないこと。**
