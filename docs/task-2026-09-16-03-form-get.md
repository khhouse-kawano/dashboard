# 指示③　公開フォーム（`react/form_get`）の改修と転送先の根本対処

⚠️ 依頼（要旨）: 「`form_get/src/components` の改修案を」「エラー発生時に備えて POST 先を ① にも準備」「フロントも ② を直接叩くが正しいのでは？」「転送先の根本対処」

⚠️ **このプロジェクトは git 管理外**。⚠️ 変更の控えが無いので配布前にバックアップすること。

---

## 追加したディレクトリ・ファイル

`react/form_get/src/api/`

| ファイル | 内容 |
|---|---|
| `gateway.ts` | ⚠️ ② VPS を叩き、失敗したら ① へ回す |
| `brands.ts` | ロゴ・ブランド解決・サンクスページ（⚠️ 2ファイルの重複を集約） |

## 変更したファイル

`react/form_get/src/components/Form.tsx` / `Confirm.tsx`

## 追加した定数・関数（`gateway.ts`）

- `EXPRESS_URL` = `https://api.khg-marketing.info/api/gateway`
- `FALLBACK_URL` — ⚠️ 8ブランドの ① 側プロキシURL
- `ROLL` — `form_get: 'public'` / `form_register: 'entry'`

## 追加した定数（`brands.ts`）

`brandLogo` / `KHG_BRAND` / `KHG_THANKS` — ⚠️ **宛先（メールアドレス）は書かない**

---

## ⚠️ 落とし穴

- ⚠️ `mail_to` / `mail_cc` を**空で固定してはいけない**。⚠️ ① へ退避したとき**社内通知が飛ばなくなる**（気づけない）
- ⚠️ 許可リストの書式は `request:roll:category`。⚠️ roll で読み書きが分かれるものは **roll 込みで書く**
- ⚠️ `expressProxyExclusive()` はフォールバック禁止リスト。⚠️ **PHPハンドラが実在する書き込み系のみ**

## ⚠️ 未デプロイ

- ⚠️ 8サイトへ `form-proxy.php` と再ビルドした公開フォームを配布
