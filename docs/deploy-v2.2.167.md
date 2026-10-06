# デプロイ手順 v2.2.167

⚠️⚠️ **v2.2.166 を先に出してあることが前提です。**

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️ フェスタの予約で ⚠️ **`medium` を受け取り、`長原木` だけ保存**（⚠️ それ以外・指定なしは従来どおり NULL） | ⚠️ **② VPS** |
| 2 | ⚠️ 長原木経由の予約は ⚠️ **社内通知の件名**が `【おうちづくりフェスタ2026／予約】〇〇様(長原木2,000円チケット)` | ② VPS |
| 3 | ⚠️ 長原木経由の予約は ⚠️ **予約者への確認メール**に「長原木2,000円チケットでのお申し込みを確認いたしました。」 | ② VPS |
| 4 | ⚠️ LP が ⚠️ **`?m=c` のときだけ** `medium: '長原木'` を送る | ⚠️ **LP（kh-house.jp/festa）** |
| 5 | 版の表示と更新履歴 | ① フロント／① DB |

⚠️ DBの構造は変えません（`event_db.medium` は既存の列）。⚠️ ① PHP は触りません。

---

## 順序

```
1. ② Express（build）      ← ⚠️ 先
2. LP（index.html）         ← ⚠️ 1 のあと
3. ① フロント（build）
4. ① SQL（update_log）
```

⚠️ 2 を先に出しても予約は壊れません（⚠️ `medium` が捨てられて NULL になるだけ）。⚠️ ただしその間の長原木の予約は ⚠️ **媒体が残らない**ので、1 → 2 の順にしてください。

⚠️ ② は `production` から取るので、⚠️ **先に GitHub で v2.2.167 を production へマージ**しておくこと。

---

## 手順1　【② VPS で実行】Express の再ビルド

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

⚠️ ライブラリの追加はありません。

| ファイル | |
|---|---|
| `src/features/event/reservation.ts` | ⚠️ `ALLOWED_MEDIUMS`（`長原木` のみ）。⚠️ `medium` を保存 |
| `src/features/event/mail.ts` | ⚠️ 社内通知の件名、確認メールの一文 |

---

## 手順2　【LP】index.html を差し替え

| ファイル | |
|---|---|
| ⚠️ `Downloads/20260425_kokubu_ouchi_festa_LP_NK/index.html` | ⚠️ **https://kh-house.jp/festa/ の index.html と差し替え** |

⚠️ 変更前は同じフォルダの `index.html.before-medium`（⚠️ 切り戻し用）。⚠️ LP はリポジトリ外です。

---

## 手順3　【WSL】フロントを ① へアップロード

| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.77962e36.js`** | ⚠️ **この版の本体**（⚠️ 版の表示が変わるだけ） |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |

```
main.77962e36.js   ← ⚠️⚠️ これが v2.2.167（正）
main.84fb8405.js   … v2.2.166
```

```bash
deploy-dashboard
```

---

## 手順4　【① レンタルサーバー／phpMyAdmin】更新履歴

⚠️ ファイル: `backend/scripts/sql/2026-10-06_update_log_2.2.167.sql`

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

⚠️ 一番上が `2.2.167` なら完了。

---

## ⚠️ 出したあとの確認

| # | 見ること | 期待 |
|---|---|---|
| 1 | ⚠️ ヘッダーの版 | ⚠️ **2.2.167** |
| 2 | ⚠️ `https://kh-house.jp/festa/?m=c` から予約 | ⚠️ event_db の `medium` が ⚠️ **長原木** |
| 3 | ⚠️ そのときの社内通知 | ⚠️ 件名の末尾が ⚠️ **`(長原木2,000円チケット)`** |
| 4 | ⚠️ そのときの確認メール | ⚠️ 「以下の内容で承りました。」の次に ⚠️ **「長原木2,000円チケットでのお申し込みを確認いたしました。」** |
| 5 | ⚠️ `https://kh-house.jp/festa/`（パラメータなし）から予約 | ⚠️ ⚠️ **登録される**。`medium` は NULL。⚠️ 件名・本文は従来どおり |

```sql
SELECT no, id, medium, reserved_at FROM event_db WHERE title = 'おうちづくりフェスタ2026' ORDER BY no DESC LIMIT 5;
```

⚠️ 確認で入れた予約は ⚠️ **ダッシュボードの反響一覧から削除**してください（⚠️ 集計表の件数に入ります）。

---

## ⚠️ 切り戻し

| 何が起きたか | どうする |
|---|---|
| ⚠️ 予約が入らない | ⚠️ LP を `index.html.before-medium` に戻す → ② を v2.2.166 の状態に戻して `dcp build` / `dcp up -d` |
| ⚠️ 版の表示だけおかしい | ⚠️ フロントを `main.84fb8405.js` と `index.html` に戻す |
