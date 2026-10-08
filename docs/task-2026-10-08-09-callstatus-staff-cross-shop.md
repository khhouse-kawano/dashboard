# v2.2.177 架電状況（CallStatusList.tsx）: header へ移動 ／ 店舗スタッフ表示は店舗で絞らずスタッフ名で数える ／ 読み込み中表示

## 依頼（ReadMeClaude.md ＋ 追加指示）
- `CallStatus.tsx` を header ディレクトリへ移動（⚠️ 実体は `CallStatusList.tsx`。Header.tsx が `CallStatus` の名前で読み込んでいる）
- insideSalesCategory が shopStaff のとき、架電数は targetShop と call_sheet.shop を突合せず、スタッフ名で call_log から取る（所属店舗以外の歩留まりも計算できるように）
- 追加（2026-10-08）: ① アポ取得数・架電からの来場数も店舗で絞らない ② ファイル名は変えない ③ 統計が描かれるまで読み込み中を表示

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/` → `frontend/src/components/header/` | **CallStatusList.tsx**（git mv） | import を `../../utils` `../../context` に。追加: state `loading` / `rendering`、`allParsedActions`、`statsOrLoading`（Spinner）。変更: `renderShopStaffList` の `staffLogs`（parsedCallLogs 全件）・アポ/来場（originalDatabase）・総架電数/通電数（allParsedActions）。削除: `targetParsedActions`（使われなくなった） |
| `frontend/src/components/header/` | **Header.tsx** | `import CallStatus from './CallStatusList'` |
| `frontend/src/components/database/` | **DatabaseOrder.tsx / DatabaseKaeru.tsx / DatabaseResale.tsx** | `import CallStatusList from '../header/CallStatusList'` |
| `frontend/src/utils/` | **version.ts** | 2.2.177 |
| `backend/scripts/sql/` | **2026-10-08_update_log_2.2.177.sql**（新規） | ローカル no=273 |

⚠️ ②・① PHP・DB の変更なし（⚠️ サーバーの callStatusList は call_sheet を全件返している）。
⚠️ インサイドセールス表示（renderInsideSalesList）は変更なし。土地新着ネット（estate）はもともと店舗で絞っていないので結果は同じ。

## 数え方（店舗スタッフ表示）
| 項目 | 以前 | v2.2.177 |
|---|---|---|
| 総架電数・通電数 | 選んだ店舗の架電シート（call_sheet.shop）の記録 × スタッフ名 | ⚠️ **全架電シート**の記録 × スタッフ名 |
| アポ取得数・架電からの来場数 | 選んだ店舗の架電シート × 選んだ店舗の顧客 | ⚠️ 全架電シート（担当 or 記録にスタッフ名）× ⚠️ この事業の全顧客 |
| 合計行 | 選んだ店舗所属スタッフ全員 | 同じ（⚠️ 数える範囲が全店舗に） |

## 読み込み中表示
- `loading`（取得中）か `rendering`（集計前）の間は表を描かず、Spinner と「架電状況を読み込んでいます…」／「集計しています…」。
- ⚠️ 集計は描画の中で同期的に走る（⚠️ 画面が固まる）ので、⚠️ **先にスピナーを描いてから**（setTimeout 50ms）表を描く。
- 店舗・担当の切り替え時も `rendering` を立てる。

## 確認
- `npm run build` OK（main.e056c1a3.js。警告は既存）
- ⚠️ ブラウザ未確認

## 差分
```diff
diff --git a/frontend/src/components/CallStatusList.tsx b/frontend/src/components/header/CallStatusList.tsx
similarity index 100%
rename from frontend/src/components/CallStatusList.tsx
rename to frontend/src/components/header/CallStatusList.tsx
```
