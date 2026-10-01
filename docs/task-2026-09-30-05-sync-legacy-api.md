# 2026-09-30 syncプロジェクトの旧APIあて送信の調査

## 依頼

`C:\Users\shinji-kawano\projects\sync` で、`api/gateway` 以外を向いて旧APIへPOSTしているものがないか。

※ 調査のみ。**コードは変更していない**（対象が別プロジェクトのため）。

## 調べ方

`src` / `dist` / ルート直下の `.js` を全文検索（`khg-marketing` / `dashboard/api` / `herokuapp`）。
`Procfile` が `web: node dist/server.js` なので、**動いているのは `src`（→ `dist`）だけ**。
ルート直下の `index.js` や `run*.js` は TypeScript 化される前の古い版で、**実行されていない**。

エンドポイントの生死は GET のみで確認（POSTはしていない）。

| URL | 応答 | 意味 |
|---|---|---|
| `dashboard/api/` | **403** | index.php が無い＝**旧APIは消えたまま** |
| `dashboard/api/gateway/` | 400 | index.php が動いている（正常） |
| `dashboard/api/changeShop.php` | **200** | **単体ファイルなので生き残っている** |
| `survey/api/` | 200 | 別アプリ。生きている |

## 結果：gateway以外へPOSTしている箇所は4つ

| # | ファイル | 行 | 送り先 | `demand` | 今の状態 |
|---|---|---|---|---|---|
| 1 | `src/services/breakawayService.ts` | 20 | `dashboard/api/` | `breakaway` | **動いていない（403）** |
| 2 | `src/services/openService.ts` | 23 | `dashboard/api/` | `open_myhomerobo_mail` | **動いていない（403）** |
| 3 | `src/services/runBeforeSurvey.ts` | 89 | `dashboard/api/changeShop.php` | `before_survey` | 動いている |
| 4 | `src/services/runMyHomeRobo.ts` | 164 | `dashboard/api/changeShop.php` | `robo` | 動いている |

`dashboard/api/gateway/` を向いている残り約30箇所は問題なし。

### 1と2が止まっていることの影響

- **離脱（breakaway）の受信が記録されていない。** 外部から `/api/breakaway` に届いた分がそのまま捨てられている
- **マイホームロボのメール開封ログが記録されていない。** 透明PNGは返るので、**外から見ると正常に見える**（気づけない）

いずれも `catch` で `console.error` するだけなので、**失敗しても処理は続き、エラー通知も飛ばない。**

### 3と4が生きている理由

`changeShop.php` は `dashboard/api/` 直下の**単体のPHPファイル**で、
消えたのは `index.php`（demand形式の振り分け）の方。ファイルが残っていれば単体で動く。

ただし **gateway の外にあるPHPが1本だけ残っている状態**であり、
次に `dashboard/api/` を掃除すると、**予告なく3と4も止まる。**

## 対象外（旧APIではない）

| ファイル | 行き先 | |
|---|---|---|
| `src/services/runDataRegistrationBeforeInterview.ts` | `survey/api/` | 別アプリ（アンケート） |
| `src/services/runPdfToPpt.ts` | `api/receive-png/` | 別サービス |
| `src/services/runGeocode.ts` | `GATEWAY_URL` 環境変数（既定は gateway） | 差し替え可。問題なし |
| ルート直下 `index.js` / `run*.js` | `dashboard/api/` ほか | **実行されていない古い版** |
| `dist/` 配下 | — | `src` のビルド結果。`src` を直せば消える |

## 申し送り（未対応）

| # | 内容 |
|---|---|
| 1 | **1と2は、Dashboard側に受け口そのものが無い。** `breakaway` / `open_myhomerobo_mail` に相当するハンドラは `backend/src/handlers/` に存在しないので、**syncを直すだけでは足りず、ハンドラの新規作成が要る** |
| 2 | **3と4は当面動くが、`changeShop.php` 頼み。** gateway へ寄せるなら `changeShop.php` の中身を読んでハンドラ化する必要がある |
| 3 | どちらも **失敗が握りつぶされている。** 直すときに `sendErrorMail` を通すべき |
| 4 | ルート直下の古い `.js` は紛らわしい。**消すかどうかは利用者の判断** |
