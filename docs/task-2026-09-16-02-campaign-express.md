# 指示②　キャンペーンフォームの Express 化（`inquiry_customer` への API ＋ フォームHTML生成）

⚠️ 依頼（要旨）: 指示書③。`NewCampaign.tsx` をタブに組み込み、Express 化し、`campaign` ディレクトリへ集約。

---

## 追加したディレクトリ・ファイル

`backend-express/src/features/campaignForm/`

| ファイル | 内容 |
|---|---|
| `index.ts` | 管理画面用5件（list / detail / insert / update / master） |
| `entry.ts` | ⚠️ **公開受付**（entry / public）。認証なし |
| `mail.ts` | メール2通＋⚠️ **宛先の無害化** |
| `brands.ts` | ブランド対応表（⚠️ 4か所の写しを1つに集約） |
| `text.ts` | 入力の正規化・日付整形 |

`frontend/src/components/campaign/`

| ファイル | 内容 |
|---|---|
| `campaignApi.ts` | ⚠️ 新規。通信を1か所に |
| `formBuilderUtils.ts` | ⚠️ 新規。HTML生成・設定との対応表 |
| `FormBuilder.tsx` | ⚠️ 新規。LP用HTMLの生成 |
| `brands.ts` | ⚠️ 新規。ブランド表記・並び順 |
| `CampaignList.tsx` / `CampaignRouter.tsx` / `NewCampaign.tsx` | ⚠️ `components/` から**移動** |

`backend/forms/form-proxy.php` — ⚠️ 新規。8サイトに置くプロキシ

## 追加した関数

| 関数 | ファイル |
|---|---|
| `runCampaignFormList` / `Detail` / `Insert` / `Update` / `Master` | `campaignForm/index.ts` |
| `runCampaignFormEntry` / `runCampaignFormPublic` | `campaignForm/entry.ts` |
| `safeAddressList()` | `campaignForm/mail.ts`・`form-proxy.php` ⚠️ **メールヘッダの無害化** |
| `clean` / `cleanMultiline` / `dateOnly` / `dateTime` / `stamp` | `campaignForm/text.ts` |
| `usedFromSettings()` / `buildHtml()` | `formBuilderUtils.ts` |
| `brandLabel()` / `brandLogo()` | `campaign/brands.ts` |

---

## ⚠️ 直した本番の不具合

| # | 内容 |
|---|---|
| 1 | ⚠️ **公開フォームから任意の宛先へメールを送れた**（`mail_cc` のヘッダインジェクション） |
| 2 | ⚠️ **通知先をブラウザへ返していた**（`form_get` が `SELECT *`） |
| 3 | ⚠️ なごみの反響で `brand` が空（`nagomi` と `なごみ` の食い違い・実データ20件） |
| 4 | ⚠️ `sync` / `delete_flag` が数値列。42列の NOT NULL を全部埋めた |
| 5 | ⚠️ キャンペーンIDが違うとフォームが**真っ白**（原因も出ない） |
| 6 | ⚠️ 更新が0行でも「修正に成功しました」 |
| 7 | ⚠️ `form_update` に brand 条件が無く**別ブランドを巻き込んで更新** |
| 8 | ⚠️ アンケートURLが空でも案内文だけ届く |
| 9 | ⚠️ 会員登録メールの**署名が本文に入っていない** |
| 10 | ⚠️ `inquiry_date` の形式が2種類 |
| 11 | ⚠️ khg の `mail_cc` が **`※ここは編集しない`**（14フォームで壊れたヘッダ） |
| 12 | ⚠️ 旧APIが**ダッシュボードの認証を通っていなかった** |

## ⚠️ データ上の注意

- ⚠️ `inquiry_customer` は48列、**既定値なしの NOT NULL が42列**
- ⚠️ `first_name`＝姓 / `last_name`＝名（**既存18,098件すべて同じ。意図的にそのまま**）
- ⚠️ `PG HOUSE` は `brand` に空白あり、`shop` 接頭辞は `PGH`

## ⚠️ 未デプロイ・要作業

- ⚠️ **8サイトへ `form-proxy.php` を配布**（メールの穴が開いたまま・⚠️ **最優先**）
- ⚠️ `.env.prod` の `CORS_ORIGINS` に8オリジン追加
- ⚠️ **DBパスワードの変更**（平文でソースに入っている）
- ⚠️ `form_table.mail_cc` の khg 14件がプレースホルダのまま

commit `8997b8c9`（v2.2.132）/ `eef00889`（form-proxy）
