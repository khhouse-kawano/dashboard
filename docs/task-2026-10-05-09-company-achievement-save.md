# 2026-10-05-09　会社実績の予算・目標が保存されない不具合の修正（v2.2.164）

## 依頼

> Company.tsx の予算の修正ができないので修正して

## 原因

⚠️⚠️ **② のゲートウェイの振り分けキーに、本文の `category` が入っていた。**

- ② のゲートウェイは `request:roll:category` の ⚠️ **完全一致**で処理を引く（`backend-express/src/gateway/index.ts` の `findEntry(request, roll, category)`。`category` は `body.category`）。
- 画面（`Company.tsx` の `changeAchievement`）は company_achievement の ⚠️ **列の値**として `category: 'shop'`（店舗の予算）／`'staff'`（営業の目標）を送る。
- 登録は `category` 空の1件だけだったため、⚠️ `change_company_achievement::shop` が見つからず ⚠️ **「ループ検知」で 502**。
- ⚠️ 書き込みなので ① の `express_proxy.php` で ⚠️ **フォールバック禁止（exclusive）**。⚠️ ① でも保存されない。
- ⚠️ 画面は `setAchievement` で先に表示を変えるため、⚠️ 入力した直後は保存できたように見え、⚠️ **再読込で元に戻る**。

⚠️ 移植したのは 2026-09-10（53bf9af9）。⚠️⚠️ **それ以降に入力された予算・目標は DB に入っていない。**

## 再現と確認（ローカル ②、① から転送された形 `X-Forwarded-By: xserver-php` で送信）

| category | 直す前 | 直した後 |
|---|---|---|
| `shop` | ⚠️ **502** | 200 `{"status":"success"}` |
| `staff` | ⚠️ **502** | 200 |
| `''` | 200 | 200 |
| Token なし（shop） | — | 401（⚠️ 認証は効いたまま） |

- ⚠️ 書き込み先は実在しない期 `1999-01`・名前 `__qa_test__`。⚠️ 3行入ったことを確かめたあと削除した（⚠️ 残り0件）。
- `backend-express` の `tsc --noEmit` は成功。
- ② の起動ログに `change_company_achievement::` / `::shop` / `::staff` の3行が出ることを確認。

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/gateway/` | **registry.ts** | 定数 `COMPANY_ACHIEVEMENT_CATEGORY_VALUES`（新規）。⚠️ `change_company_achievement` を値ごとに3件登録 |
| `backend/scripts/sql/` | **2026-10-05_update_log_2.2.164.sql** | 文言に不具合修正を追記。⚠️ ローカルDBも UPDATE で揃えた |
| `docs/` | **deploy-v2.2.164.md** | ⚠️ ② の再ビルドを手順1に追加。確認項目 11〜14 を追加 |

⚠️ フロント（Company.tsx）と ① PHP は変えていない。⚠️ 画面が送る値はそのまま、② の登録だけで直した（⚠️ v2.2.163 の `header_staff_insert` と同じ作法）。

## 追加・変更したコード（全文）

`backend-express/src/gateway/registry.ts`

```ts
/**
 * ⚠️⚠️ **契約目標の登録は `category` の値ごとに登録する**（v2.2.164）。
 *
 *   ⚠️ company_achievement には **`category` という列**（'shop' = 店舗の予算 / 'staff' = 営業の目標）がある。
 *   ⚠️ ⚠️ **画面（Company.tsx の changeAchievement）はそれを `category: 'shop'` のように送るため、
 *     ゲートウェイの振り分けキー `request:roll:category` に入ってしまう。**
 *   ⚠️ 1件（category 空）だけの登録だと ⚠️ `change_company_achievement::shop` が見つからず、
 *     ⚠️⚠️ **「ループ検知」で 502 になる。** ⚠️ フォールバック禁止なので ① でも保存されない
 *     （⚠️ 2026-10-05「予算の修正ができない」で発覚。⚠️ 入力欄は画面上だけ変わり、再読込で消える）。
 *
 *   ⚠️ 来るのは `'shop'`・`'staff'`。⚠️ `''` は従来の登録を残すため。
 *   ⚠️ ⚠️ **ハンドラは同じ。** ⚠️ `category` は列の値として本文から読む。
 *   ⚠️ 画面に新しい種類（例: 'section'）を足したら、⚠️ **ここにも足すこと。**
 */
const COMPANY_ACHIEVEMENT_CATEGORY_VALUES = ['', 'shop', 'staff'];

for (const category of COMPANY_ACHIEVEMENT_CATEGORY_VALUES) {
  register({
    request: 'change_company_achievement',
    category,
    summary: '【書き込み・フォールバック禁止】契約目標の登録（company_achievement の upsert）',
    phpSource: 'backend/src/handlers/change_company_achievement.php',
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runChangeCompanyAchievement(ctx.body);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}
```

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **9/10 以降に入力した予算・目標は消えている**（⚠️ そもそも保存されていない）。⚠️ ② を出したあと、⚠️ 入力し直してもらう必要がある |
| 2 | ⚠️ ほかにも本文に `category` を業務データとして送る request が残っている可能性がある。⚠️ 移植済みの書き込み系で同じ症状が出たら、まずこれを疑う |
