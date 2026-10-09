# デプロイ手順 v2.2.178

⚠️ **明日（2026-10-10）のフェスタ本番前に出すこと。**

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 受付画面（LP）へ返す項目に `status` を追加 | ⚠️ **② VPS**（`features/event/checkin.ts`） |
| 2 | フェスタ画面: ⚠️ **同期先を選んだ店舗の事業区分で決める**（注文の店舗 → master_data）／ 当日来場（non-reserve）のチケットを「なし」／ 備考列 | ① フロント |
| 3 | 更新履歴に1行増える | ① DB |
| 4 | 受付画面: 当日来場のチケットを「なし」 | LP（`reservation/index.html`） |

⚠️ **① PHP・DB の列は変更なし。**

---

## 順序

```
0. GitHub で v2.2.178 を main → production へマージ
1. ② Express（build）
2. ① フロント（build）
3. ① SQL（update_log）
4. LP の reservation/index.html をアップロード
```

- ⚠️ 4 を 1 より先に出しても壊れない（⚠️ ② が古いと status が来ず、従来のチケット判定になるだけ）。⚠️ ただし当日来場が「なし」にならないので、⚠️ **1 → 4 の順**で。
- ⚠️ 2 は ② に依存しない（⚠️ 同期・チケット・備考は既存の API のまま）。

---

## 手順1　【② VPS で実行】Express の再ビルド

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "staff, status" backend-express/src/features/event/checkin.ts
```
⚠️ 1行出れば v2.2.178 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

---

## 手順2　【WSL】フロントを ① へアップロード

| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.861e9ec4.js`** | ⚠️ **この版の本体** |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |

```bash
deploy-dashboard
```

---

## 手順3　【① レンタルサーバー／phpMyAdmin】更新履歴

⚠️ ファイル: `backend/scripts/sql/2026-10-09_update_log_2.2.178.sql`

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

⚠️ 一番上が `2.2.178` なら完了。

---

## 手順4　LP の受付画面

⚠️ ファイル: `C:\Users\shinji-kawano\Downloads\20260425_kokubu_ouchi_festa_LP_NK\reservation\index.html`
⚠️ いつもの LP のアップロード先へ、⚠️ このファイルだけ差し替える。

---

## ⚠️ 出したあとの確認

| # | 見ること | 期待 |
|---|---|---|
| 1 | ヘッダーの版 | **2.2.178** |
| 2 | ⚠️ 建売か中古の画面からフェスタ画面を開き、テスト用の予約を注文の店舗（例: KH熊本店）へ同期 | ⚠️ **注文の顧客一覧（master_data）に出る**（⚠️ 確認後はテスト顧客を削除） |
| 3 | フェスタ画面の表 | 相談内容の右に ⚠️ **備考**。改行もそのまま |
| 4 | 当日来場（status = non-reserve）の行 | チケットが ⚠️ **なし**（⚠️ 予約日が 10/9 以前でも） |
| 5 | 受付画面（LP）で当日来場の QR を読む | チケットが ⚠️ **なし** |

---

## 切り戻し

| 対象 | 方法 |
|---|---|
| ② | v2.2.177 の production で `dcp build` / `up -d` |
| ① フロント | v2.2.177 の `main.a896f6a8.js` と index.html に戻す |
| LP | 前の reservation/index.html に戻す（⚠️ `ticketOf` の1行を消すだけでも可） |
