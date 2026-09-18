# 指示⑪　サンクスメール・通知メールの編集機能

⚠️ 依頼（要旨）: 「サンクスメールおよび通知メールの編集機能追加。これに伴いテーブルの修正、追加が必要であれば実施せよ。デフォルトはおそらく実装済みの ts ファイルおよびフォールバック用の php に記載かと」
⚠️ 追加依頼: 「メール送信も Express もしくはフォールバックしたときの php 側でおこなうようにしたい」

---

## テーブル（`form_table` に4列追加）

`backend/scripts/sql/2026-09-16_form_mail_template.sql`（⚠️ 新規）

| 列 | 型 | 内容 |
|---|---|---|
| `thanks_subject` | TEXT | サンクスメールの件名 |
| `thanks_body` | LONGTEXT | サンクスメールの本文 |
| `internal_subject` | TEXT | 社内通知メールの件名 |
| `internal_body` | LONGTEXT | 社内通知メールの本文 |

⚠️⚠️ **`DEFAULT ''` は必須。** ⚠️ ① の `form_post` は**これらの列を知らないまま INSERT する**ため、既定値が無いと**新規登録がまるごと失敗する**。

⚠️ **`notice_*` にしなかった理由**: ⚠️ `form_table.notice` は既にあり、**フォーム画面の「注意書き」**である。取り違えると事故る。

⚠️⚠️ **既存340件へ本文を書き写していない。** ⚠️ 空＝既定という仕様。⚠️ 書き写すと**将来ひな型を直しても古い本文が全件に残る**。

---

## 追加・変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features/campaignForm/` | `mailTemplate.ts` | ⚠️ **新規**。既定文面と差し込み |
| 同上 | `mail.ts` | ひな型があればそれを使う |
| 同上 | `entry.ts` | 4列を SELECT して渡す |
| 同上 | `index.ts` | insert / update に4列追加 |
| `frontend/src/components/campaign/` | `mailTemplateFields.ts` | ⚠️ **新規**。差し込み語と警告 |
| 同上 | `NewCampaign.tsx` | 編集UI |
| `backend/forms/` | `khg-api-form-register.snippet.php` | ⚠️ **新規**。① 用の差し替え下書き |
| `backend/scripts/sql/` | `2026-09-16_form_mail_template.sql` | ⚠️ **新規** |

## 追加した関数・定数

| 名前 | ファイル |
|---|---|
| `detailBlock()` / `render()` / `pick()` | `mailTemplate.ts` |
| `DEFAULT_THANKS_SUBJECT` / `_BODY` / `DEFAULT_MEMBER_BODY` / `DEFAULT_INTERNAL_SUBJECT` / `_BODY` | `mailTemplate.ts` |
| `PLACEHOLDERS` / `MEMBER_CAMPAIGN_ID` / `TemplateValues` | `mailTemplate.ts` |
| `MAIL_TEMPLATE_COLUMNS` | `campaignForm/index.ts` |
| `toValues()` | `mail.ts` |
| `PLACEHOLDERS` / `unknownPlaceholders()` | `mailTemplateFields.ts` |
| `mailTemplateEditor()` / `changeTemplate()` / `TemplateKey` | `NewCampaign.tsx` |
| `khgSafeAddressList()` / `khgSanitizeHeader()` / `khgDetailBlock()` / `khgQuestionnaireBlock()` / `khgRender()` / `khgPick()` / `khgSendCampaignMails()` | `khg-api-form-register.snippet.php` |

---

## 差し込み語

`{{お名前}}` `{{姓}}` `{{名}}` `{{お名前カナ}}` `{{お問い合わせ内容}}` `{{キャンペーン名}}` `{{ブランド名}}` `{{受付日時}}` `{{来場希望場所}}` `{{来場希望日}}` `{{来場希望時間}}` `{{携帯番号}}` `{{メールアドレス}}` `{{年齢}}` `{{事前アンケート}}` `{{事前アンケートURL}}`

⚠️⚠️ **通知先アドレスの語は作っていない。** ⚠️ 顧客宛の本文に社内の宛先を書けてしまうため。

⚠️ **知らない語はそのまま残す。** ⚠️ 黙って空にすると打ち間違いに誰も気づけない。⚠️ 保存前に画面で警告する。

⚠️ ② と ① と画面の3か所に語の一覧がある。⚠️ **必ず揃えること。**

---

## ⚠️ ① 側（フォールバック）

⚠️ ① の `khg-marketing.info/api/` は**メールを自前で送っている**。⚠️ そのままだと**編集した文面が効かない**。

⚠️ `backend/forms/khg-api-form-register.snippet.php` を用意した。⚠️ **そのまま動かすものではなく**、`form_register` と `registration/homepage` のメール送信部分を `khgSendCampaignMails()` の呼び出しに置き換えるための下書き。

### ⚠️ ついでに塞がる穴

| # | 内容 |
|---|---|
| 1 | ⚠️ **通知先をリクエストから受け取っていた**（`'Cc:' . $data['mail_cc']`）。⚠️ 改行で `Bcc:` を足せ、**任意の宛先へ送信できた** |
| 2 | ⚠️ 送信可否（`thanks`）も**リクエストの値**だった |
| 3 | ⚠️ アンケートURLが無くても**見出しだけ**届いていた（`form_register` 側） |
| 4 | ⚠️ 会員登録メールの**署名が孤立**していた（⚠️ **2か所とも**） |

---

## 検証

| 確認 | 結果 |
|---|---|
| 既定文面の中身（宛名・項目・注意書き・アンケート） | ⚠️ OK |
| ⚠️ アンケートURLが無いブランドで案内ごと消える | ⚠️ OK |
| 未入力の行が出ない | ⚠️ OK |
| ⚠️ 空白だけ／null なら既定に戻る | ⚠️ OK |
| ⚠️ 知らない語がそのまま残る | ⚠️ OK |
| ⚠️ `{{mail_to}}` 等が差し込まれない | ⚠️ OK |
| 壊れた書き方（`{{` の連続など）で例外が出ない | ⚠️ OK |
| ⚠️ **② の TS と ① の PHP で文面が完全一致**（7パターン） | ⚠️ **一致** |
| ⚠️ 宛先の無害化（`\r\nBcc:` 注入） | ⚠️ **正当な2件だけ残り注入行は落ちた** |
| 実DBで保存→読込の往復、他の設定が壊れない | ⚠️ OK（⚠️ `medium` の差は `CM\/ラジオ` のスラッシュの逃がし方だけで値は同一。既存挙動） |

⚠️ ローカルDBへ移行SQLを適用済み。⚠️ テストで入れた文面は**元に戻した**（ひな型が入った行は0件）。

## ⚠️ 未デプロイ・要作業

- ⚠️ **本番DBへ移行SQLを適用**（① のサーバーパネル）
- ⚠️ ① の `index.php` へ差分を反映（⚠️ **私は開けないので利用者側で**）
- ⚠️ `v2.2.133` の push とデプロイ
- ⚠️ **画面を開いての動作確認**
