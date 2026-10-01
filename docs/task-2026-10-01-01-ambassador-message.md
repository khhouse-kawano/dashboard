# 2026-10-01 アンバサダーLPに「ご質問やご要望」欄を追加（v2.2.156）

## ⚠️ 依頼

| # | |
|---|---|
| 1 | ⚠️ LP（`C:\Users\shinji-kawano\lp\ambassador`）の入力フォームに ⚠️ **textarea を追加** |
| 2 | ⚠️⚠️ **入力は任意。未入力でも `handleSync` が動くこと** |
| 3 | ⚠️ ラベル **ご質問やご要望** ／ 説明 **連絡方法や連絡時間のご希望、ご質問など自由にご記入ください** |
| 4 | ⚠️ `inquiry_ambassador` に列を追加 |
| 5 | ⚠️ `InquiryAmbassador.tsx` にも列を追加。⚠️ **NULL なら何も表示しない** |
| 6 | ⚠️⚠️ **`handleSync` で `master_data.remarks` へ登録** |

⚠️ 利用者の選択: ⚠️ **版は v2.2.156（新規）**、⚠️ **列名は `message`**。

---

## ⚠️ 版を上げる3点（CLAUDE.md の手順）

| # | |
|---|---|
| 1 | ⚠️ `frontend/src/utils/version.ts` → ⚠️ **`2.2.156`**（ブランチ名と一致） |
| 2 | ⚠️ `backend/scripts/sql/2026-10-01_update_log_2.2.156.sql` を作成 |
| 3 | ⚠️⚠️ **ローカルDBへの投入は未実施**（⚠️ Docker が応答しないため。末尾を参照） |

---

## ⚠️ 追加・変更したファイル

### ⚠️ LP（`C:\Users\shinji-kawano\lp\ambassador`）

| ファイル | |
|---|---|
| `index.html` | ⚠️ textarea を1つ追加（⚠️ **Instagram欄の下、同意欄の上**）。⚠️ キャッシュ回避の `?v=` を更新 |
| `form.js` | ⚠️ `FIELDS` に1件追加。⚠️⚠️ **任意入力の扱いを `validateField` と `buildSummary` に実装** |
| `style.css` | ⚠️ `.reserve-optional` / `.reserve-textarea` / `.reserve-summary dd.confirm-empty` |

### ⚠️ Dashboard

| ディレクトリ | ファイル | |
|---|---|---|
| `backend/scripts/sql/` | ⚠️⚠️ **2026-10-01_ambassador_inquiry_message.sql**（新規） | ⚠️ 列追加 |
| `backend/scripts/sql/` | **2026-10-01_update_log_2.2.156.sql**（新規） | ⚠️ 更新履歴 |
| `backend-express/src/features/ambassador/` | `inquiry.ts` | ⚠️ 受付時に保存。⚠️ **`cleanMultiline()` を追加** |
| `backend-express/src/features/ambassador/` | `index.ts` | ⚠️⚠️ **同期時に `remarks` へ引き継ぐ** |
| `frontend/src/components/header/` | `InquiryAmbassador.tsx` | ⚠️ 列・型・検索対象 |
| `frontend/src/utils/` | `version.ts` | ⚠️ `2.2.156` |

⚠️ ⚠️ **`INQUIRY_LIST_SQL` は `SELECT i.*` のため、一覧の取得側は変更不要。**

---

## ⚠️ 実装の中身

### ⚠️ ① DB

```sql
ALTER TABLE `inquiry_ambassador`
  ADD COLUMN `message` TEXT DEFAULT NULL COMMENT 'ご質問やご要望（任意入力。顧客本人が記入）'
  AFTER `build_area`;
```

⚠️⚠️ **`TEXT` にしている。** ⚠️ 連絡時間の希望などが ⚠️ **改行つきで届く**ため。
⚠️ 既定は `NULL`。⚠️ ⚠️ **空文字では保存しない**（他の任意項目と揃えた。混在すると画面の出し分けが効かない）。

### ⚠️ ② LP：任意入力の扱い

⚠️⚠️ **既存の仕組みは「全項目が必須」を前提にしていた。**
⚠️ `validateField()` は空ならその場で `showError` していたため、⚠️ **そのままでは送信が止まる。**

```js
    var value = input.value.trim();

    /* ⚠️ 任意の項目は、未入力ならそこで合格とする。
       ⚠️ 下の test まで進めてはいけない（空文字が正規表現に落ちて弾かれる）。 */
    if (!value) {
      if (field.optional) {
        clearError(field);
        return true;
      }
      showError(field, field.label + "を入力してください。");
      return false;
    }
```

⚠️ 確認モーダルは ⚠️ **未入力でも行を消さず「（未入力）」と出す。**
⚠️ ⚠️ **消すと「入力し忘れたのか、そもそも欄が無かったのか」が分からない。**

```js
      /* ⚠️ 任意の項目が未入力でも行ごと消さない。 */
      if (value === "" && field.emptyText) {
        dd.textContent = field.emptyText;
        dd.classList.add("confirm-empty");
      } else {
        dd.textContent = value;
      }

      /* 改行をそのまま見せる（textarea 用） */
      if (field.multiline) dd.style.whiteSpace = "pre-wrap";
```

⚠️ `buildPayload()` は ⚠️ **`key` を持つ項目を自動で載せる**ので変更不要。

### ⚠️ ③ 受付（②Express）: `cleanMultiline()` を追加

⚠️⚠️ **既存の `clean()` は改行も制御文字として落とす。**
⚠️ 1行項目（氏名・住所）では ⚠️ **それが正しい**（一覧やCSVが壊れる）。
⚠️ ⚠️ **この項目だけが例外**なので、関数を分けた。

```ts
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;

const cleanMultiline = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_KEEP_NEWLINE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
};
```

⚠️ 上限 **1,000文字**。⚠️ ⚠️ **超えても弾かず切り詰める**（既存の方針どおり。反響を捨てない）。
⚠️⚠️ **textarea の `maxlength` は curl では無視できる**ため、⚠️ **サーバー側でも必ず掛ける。**

### ⚠️ ④ 同期：`master_data.remarks` へ

```ts
  const message = asString(inquiry.message).trim();

  const remarksLines = [
    account === '' ? '' : `紹介アンバサダー: ${account}`,
    buildArea === '' ? '' : `建築希望地: ${buildArea}`,
    DIVISIONS[division].storeIsShop ? '' : `担当店舗: ${shop}`,
    // ⚠️ 本人の記入はいちばん最後。⚠️ 見出しを別行にして本文と混ざらないようにする
    message === '' ? '' : `【ご質問やご要望】\n${message}`,
  ].filter((line) => line !== '');
```

⚠️⚠️ **いちばん最後に置いている。** ⚠️ 複数行で届くため、⚠️ 途中に挟むと
⚠️ **2行目以降が「建築希望地」の続きに見える。**

⚠️ ⚠️ **未入力なら行ごと増えない**（`filter` で落ちる）。⚠️ 従来と同じ備考になる。

### ⚠️ ⑤ 一覧画面

```tsx
{/*
  ⚠️ 未入力なら**何も出さない。**
    ⚠️ 「—」や「なし」を出すと、記入のある行を
      目で探すときに雑音になる（大半は未入力）。
  ⚠️ 改行をそのまま見せる（連絡時間の希望が複数行で届く）。
*/}
<td style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
    {item.message ?? ''}
</td>
```

⚠️ あわせて
- ⚠️ 検索の対象に `i.message` を追加（⚠️ 「平日」「夜」などで拾える）
- ⚠️ ⚠️ **空表示の `colSpan` を 14 → 15**（⚠️ 直さないと列がずれる）
- ⚠️ 表の `minWidth` を 1800px → 2040px

---

## ⚠️ 確認

| # | 見たこと | 結果 |
|---|---|---|
| 1 | ⚠️ `backend-express` の `tsc --noEmit` | ⚠️ ✅ エラーなし |
| 2 | ⚠️ `frontend` の `npm run build` | ⚠️ ✅ 成功。⚠️ **`main.c9344e7a.js`（+33B）** |
| 3 | ⚠️ 新規の警告 | ⚠️ ✅ なし（既存の未使用変数のみ） |

⚠️⚠️ **以下は未実施。**

| # | |
|---|---|
| ⚠️ A | ⚠️⚠️ **ローカルDBへのSQL投入**（列追加・update_log の2本） |
| ⚠️ B | ⚠️ 受付 → 一覧表示 → 同期 の通し確認 |
| ⚠️ C | ⚠️ LP のブラウザ表示（⚠️ **スマホ幅での textarea の見え方**） |

⚠️ ⚠️ **理由: Docker Desktop が応答しなくなった**（`docker ps` が
`500 Internal Server Error ... check if the server supports the requested API version`、
のちに応答なし）。⚠️ **実装の問題ではない。**

---

## ⚠️ デプロイ

⚠️⚠️ **順序を守ること。**

| 順 | 対象 | 内容 |
|---|---|---|
| 1 | ⚠️ **① phpMyAdmin** | ⚠️⚠️ **`2026-10-01_ambassador_inquiry_message.sql`（列追加）** |
| 2 | ⚠️ ① phpMyAdmin | `2026-10-01_update_log_2.2.156.sql` |
| 3 | ⚠️ **② VPS** | ⚠️ Express を再デプロイ |
| 4 | ⚠️ ① | ⚠️ frontend の `build/`（⚠️ **`main.c9344e7a.js`**） |
| 5 | ⚠️ **LP サーバー** | ⚠️ `index.html` / `form.js` / `style.css` |

⚠️⚠️ **列追加（1）を最初にやること。**
⚠️ ⚠️ **② を先に出すと `Unknown column 'message'` で INSERT が落ち、
⚠️ その間に届いた反響が丸ごと失われる**（⚠️ フォームには「送信に失敗しました」と出る）。

⚠️⚠️ **LP（5）は最後。**
⚠️ ⚠️ **先に出すと、`message` を送っているのに ② が受け取れない。**
⚠️ ただし ⚠️ **受付自体は成功する**（知らない項目は無視される）ので、⚠️ **気づけない。**

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **社内通知メールには含めていない。** ⚠️ 依頼の範囲外のため。⚠️ ⚠️ **「連絡時間の希望」は初回架電の成否に直結する**ので、⚠️ **入れたほうがよいと思う**（`features/ambassador/mail.ts`）。判断を仰ぎたい |
| 2 | ⚠️ ⚠️ **同期済みの反響に後から記入が増えることはない**（フォームは1回きり）。⚠️ 再同期の考慮は不要 |
| 3 | ⚠️⚠️ **既に同期済みの過去の反響には `message` が無い。** ⚠️ 備考も従来どおりで変わらない |
| 4 | ⚠️ ⚠️ **`master_data.remarks` は上書きではなく新規作成時のみ**（`insertCustomer`）。⚠️ 既存顧客の備考を壊すことはない |
| 5 | ⚠️ LP は ⚠️⚠️ **git 管理されていない。** ⚠️ 変更前の状態は `_backup` のみ |
