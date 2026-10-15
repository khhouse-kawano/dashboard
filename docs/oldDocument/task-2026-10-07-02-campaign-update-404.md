# 2026-10-07 キャンペーン修正で 404「該当する処理がありません」（v2.2.168）

## 依頼
- `frontend/src/components/campaign/NewCampaign.tsx` で内容を修正したとき postForm() の保存が通らず 404 が返る
- 対象: djh / `240000_djh_kyotsu_catalog`（240000【DJH共通】資料請求）。応答 `{"status":"error","message":"該当する処理がありません。"}`

## 原因
1. form_table の JSON 列は `longtext ... CHECK (json_valid(...))`。
2. 該当行の `notice` は `""`（⚠️ 空文字の JSON）。画面は `JSON.parse` して空文字 `""` にし、そのまま送る。
3. ② の `jsonText()` は「文字列なら既に JSON」とみなして ⚠️ **空文字をそのまま** UPDATE → ⚠️ 制約違反（`CONSTRAINT form_table.notice failed`）で **500**。
4. ① の express_proxy は ② の 5xx で ① の処理へ切り替える → ① に `campaign_form` の PHP は無い → ⚠️ **404「該当する処理がありません」**。
- ⚠️ 2026-09-16 に ① の別API（PHP の `json_encode`）から ② へ移したときに入った不具合。PHP は `json_encode("")` = `""` を書いていた。
- ローカルでは ⚠️ **9件**（notice が文字列。nagomi 1・djh 2・kh 2・2l 2・jh 2）が修正すると必ず失敗していた（attention / question が文字列の行も各1件）。

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features/campaignForm/` | `index.ts` | ⚠️ `jsonText()`：JSON として読めない文字列は `JSON.stringify` する（読める文字列は従来どおりそのまま） |
| `backend/scripts/sql/` | `2026-10-06_update_log_2.2.168.sql` | 文言に追記（⚠️ ローカルは UPDATE で揃え済み） |
| `docs/` | `deploy-v2.2.168.md` | 変更表 7・② のファイル表・確認 12〜13 を追加 |

- ⚠️ 画面（NewCampaign.tsx）は変えていない（⚠️ 画面で既定値に置き換えると、注意書きの表示有無が変わってしまうため）。
- ⚠️ DB に保存される値は従来と同じ `""`（公開フォームの見え方は変わらない）。

## 確認（ローカル、① → ② の実経路）
- 修正前: いただいた Payload をそのまま送信 → ⚠️ **HTTP 404「該当する処理がありません。」**（再現）。② のログに `CONSTRAINT form_table.notice failed`。
- 修正後: 同じ Payload → ⚠️ **HTTP 200「240000【DJH共通】資料請求の修正に成功しました。」**
- 影響の9件すべて detail → update（画面と同じ形）→ ⚠️ **全件 200 success**。
- 保存後も notice は `""`、文字列の件数（9 / 1 / 1）は変わらない。
- テストで書き換わった registered_date は全件元に戻した（kh / 261003_UMK も戻し済み）。
- `tsc --noEmit` 通過。

## 本番の影響件数の確認（① phpMyAdmin、読むだけ）
```sql
SELECT COUNT(*) FROM form_table WHERE JSON_TYPE(notice) = 'STRING';
```

## コード

### backend-express/src/features/campaignForm/index.ts — `jsonText`（修正後）
```ts
/**
 * JSON 列へ入れる値。
 * ⚠️ 移植元の `json_encode($data['x'], JSON_UNESCAPED_UNICODE)` に相当する。
 *   ⚠️ 画面はオブジェクトを送ってくるので、ここで文字列化する。
 *   ⚠️ 既に JSON の文字列なら二重にエンコードしない（画面が古い形で送ってきた場合）。
 *
 * ⚠️⚠️ **JSON として読めない文字列は JSON にする**（v2.2.168 で修正）。
 *   ⚠️ form_table の JSON 列は `CHECK (json_valid(...))` 付き。
 *   ⚠️ DB に `""`（空文字の JSON）が入っている行（notice など）は、画面が読むと
 *     空文字 `""` になってそのまま送ってくる。⚠️ 以前はそれを素通しで書こうとして
 *     **制約で 500 → ① が自分で処理して 404「該当する処理がありません」**になっていた。
 *   ⚠️ PHP の json_encode("") は `""` を返すので、それに合わせる。
 */
const jsonText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
        try {
            JSON.parse(value);
            return value;
        } catch {
            return JSON.stringify(value);
        }
    }
    return JSON.stringify(value);
};
```
