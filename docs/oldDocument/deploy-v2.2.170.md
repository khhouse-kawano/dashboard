# デプロイ手順 v2.2.170

⚠️⚠️ **v2.2.169 を先に出してあることが前提です**（⚠️ 2026-10-07 時点でデプロイ済みと確認）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️ SatBaseサマリーの「表示項目」の右に ⚠️ **「物件更新」**ボタン（⚠️ **Master だけ**） | ① フロント |
| 2 | ⚠️ SatBase の CSV（中間加工（物件））で ⚠️ **satbase_property を更新・追加**する API `satbase_import`（⚠️ Master だけ） | ⚠️ **② VPS** |
| 3 | ⚠️ ① の転送リストに `satbase_import` を追加 | ⚠️ **① PHP**（`core/express_proxy.php`） |
| 4 | 更新履歴に1行増える | ① DB |

⚠️ DB の構造は変えません。⚠️ 取り込み自体は ⚠️ **デプロイ後に画面から Master が行う**（⚠️ デプロイ作業では台帳は変わらない）。

---

## 順序

```
1. ② Express（build）
2. ① PHP（express_proxy.php）   ← ⚠️ 1 のあと
3. ① フロント（build）
4. ① SQL（update_log）
```

- ⚠️ 2 を 1 より先に出すと、⚠️ 古い ② に `satbase_import` が無く、⚠️ ① が「該当する処理がありません」（404）を返します（⚠️ ボタンを押したときだけ。⚠️ 他の画面は影響なし）。
- ⚠️ ② は `production` から取るので、⚠️ **先に GitHub で v2.2.170 を production へマージ**しておくこと。

---

## 手順0　【② VPS で実行】Express の再ビルド

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

⚠️ 起動ログに次の行があること（⚠️ 登録一覧は長いので grep で探す）:
```bash
dcp logs express-api | grep satbase_import
```
```
👑 satbase_import::  — 【書き込み】SatBase の CSV で物件台帳（satbase_property）を更新・追加する
```

| ファイル | |
|---|---|
| `src/features/satbase.ts` | ⚠️ `runSatbaseImport`（検証 → 比較 → dryRun / トランザクションで反映） |
| `src/gateway/registry.ts` | ⚠️ `satbase_import`（auth: master） |

---

## 手順1　【① レンタルサーバー】PHP

| ファイル | |
|---|---|
| ⚠️ `backend/src/core/express_proxy.php` | ⚠️ `satbase_import` を ⚠️ **`expressProxyRequests()` と `expressProxyExclusive()` の両方**に追加 |

---

## 手順2　【WSL】フロントを ① へアップロード

| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.09d1872c.js`** | ⚠️ **この版の本体** |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |

```
main.09d1872c.js   ← ⚠️⚠️ これが v2.2.170（正）
main.6df64034.js   … v2.2.169
```

```bash
deploy-dashboard
```

---

## 手順3　【① レンタルサーバー／phpMyAdmin】更新履歴

⚠️ ファイル: `backend/scripts/sql/2026-10-07_update_log_2.2.170.sql`

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

⚠️ 一番上が `2.2.170` なら完了。

---

## ⚠️ 出したあとの確認

| # | 見ること | 期待 |
|---|---|---|
| 1 | ⚠️ ヘッダーの版 | ⚠️ **2.2.170** |
| 2 | ⚠️ 土地・物件管理 → SatBaseサマリー（Master） | ⚠️ 「表示項目」の右に ⚠️ **「物件更新」** |
| 3 | ⚠️ 同じ画面（Master 以外） | ⚠️ ⚠️ **「物件更新」が無い** |
| 4 | ⚠️ 物件更新 → SatBase の CSV を選ぶ | ⚠️ 「更新 N件 ／ 追加 N件 ／ 変更なし N件」と変わる項目が出る。⚠️ ⚠️ **この時点では台帳は変わらない** |
| 5 | ⚠️ 「更新する」 | ⚠️ 「更新 N件・追加 N件を反映しました。」。⚠️ 一覧が取り直され、⚠️ 新しい物件が上に出る |
| 6 | ⚠️ 広告出稿・Instagram のトグル | ⚠️ ⚠️ **取り込み前と同じ** |
| 7 | ⚠️ 同じ CSV をもう一度選ぶ | ⚠️ ⚠️ **変更なし**だけになり、「更新する」が押せない |
| 8 | ⚠️ 列数の違う CSV を選ぶ | ⚠️ 赤字で「列の数が…」。⚠️ 何も変わらない |

⚠️⚠️ **初回の取り込みは、ほぼ全行が「更新」になります。**
今の表は phpMyAdmin の CSV 取り込みで入れたため、空欄が `''`・空の日付が `0000-00-00` で入っています。物件更新では空欄を「空（NULL）」で入れるため、初回だけ 決済日（仕入）・契約日（仕入）・位置情報 などが全行「変わる項目」に出ます（画面では `0000-00-00` が空欄になります）。2回目からは実際に変わった行だけになります。

⚠️ 参考: ローカルの表には ⚠️ **物件ID = 0 の行**（見出し行が取り込まれたもの）が1件あります。CSV に無いので物件更新では消えません。消す場合は判断のうえ `DELETE FROM satbase_property WHERE property_id = 0;`（⚠️ 本番にもあるかは未確認）。

---

## 切り戻し

| 対象 | 方法 |
|---|---|
| ① フロント | v2.2.169 の `main.6df64034.js` と index.html に戻す |
| ① PHP | `express_proxy.php` の `satbase_import` 2行を外す（⚠️ 残しても害はない） |
| ② | v2.2.169 の production で `dcp build` / `up -d` |
| 取り込んだ台帳 | ⚠️ 取り込み前に phpMyAdmin で `satbase_property` をエクスポートしておくと戻せる（⚠️ 取り込みは画面操作なので、⚠️ 初回の前に一度取っておくことを推奨） |
