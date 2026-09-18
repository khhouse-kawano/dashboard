# 指示⑨　`CampaignSummary.tsx` の Express 化

⚠️ 依頼（要旨）: 「`CampaignSummary.tsx` の Express 化」

---

## 追加・変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features/` | `campaignSummary.ts` | ⚠️ **新規** |
| `backend-express/src/gateway/` | `registry.ts` | `campaignSummary` を登録 |
| `backend/src/core/` | `express_proxy.php` | 許可リストに追加 |
| `frontend/src/components/campaign/` | `CampaignSummary.tsx` | `apiClient` へ |

## 追加した関数・定数

| 名前 | ファイル |
|---|---|
| `runCampaignSummary()` | `features/campaignSummary.ts` |
| `CAMPAIGN_SQL` / `SHOP_SQL` | `features/campaignSummary.ts` |
| `CampaignRow` / `ShopRow`（型） | `features/campaignSummary.ts` |

⚠️ 登録は `auth: 'staff'`、`phpSource: 'backend/src/handlers/campaignSummary.php'`。
⚠️ 参照のみなので `expressProxyExclusive()` には**入れない**。⚠️ 転送に失敗すれば ① へ自動で戻る。

---

## ⚠️ フロント側で直したこと

⚠️ **本番URLが直書きで、Token を送っていなかった。**

```
axios.post('https://khg-marketing.info/dashboard/api/gateway/', ...,
           { headers: { Authorization: '4081Kokubu' } })
```

⚠️ そのため ⚠️ **ローカルで動かしても本番のDBを見ていた**。⚠️ `apiClient` に変更。
⚠️ 併せて、取得に失敗したときに `error` を画面へ出すようにした（⚠️ **0件と取得失敗が見分けられなかった**）。

## ⚠️ 移植時の注意

- ⚠️ **列名・別名は1文字も変えない。** 画面は5つの日付（`register` / `interview` / `screening` / `appointment` / `contract`）を**文字列のまま**受け取り、「値があるか」で数えている。⚠️ 別名を変えると集計が全部0になる（エラーは出ない）
- ⚠️ `step_migration_item_...` の対応は**DBコメントではなくコード内の対応表を正**とする
- ⚠️ **絞り込み（期間・ブランド・店舗・キャンペーン名）は画面に残す。** 期間の起点が画面側の定数（`getYearMonthArray(2025, 6)`）で、SQL に写すと片方だけ変わって食い違う

## 検証（ローカルDB）

| 確認 | 結果 |
|---|---|
| 反響 SQL の結果を PHP と突き合わせ | ⚠️ **4,367件すべて完全一致** |
| 店舗 SQL の結果を PHP と突き合わせ | ⚠️ **53件すべて完全一致** |
| ② の応答（`request: campaignSummary`） | 200 / 4,367件・53件、**列名も順序も同じ** |

## ⚠️ 未デプロイ

⚠️ ブランチ `v2.2.133` はローカルのみ。⚠️ **画面を開いての動作確認は未実施**。
