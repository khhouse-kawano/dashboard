# 指示⑫　`form_get` の配布準備（basename の修正と手順書）

⚠️ 依頼（要旨）: 「`react/form_get/src/components` のデプロイ（手順をまとめて）」→ 調査で不具合が見つかり、⚠️ **案A（basename を実行時に決める）** を承認いただいて実施。

---

## ⚠️ 見つけた不具合

⚠️ `App.tsx` の `basename` が **`/khg/form` にベタ書き**されていた。

⚠️ 配布済みの旧バンドル**9本すべて**を調べたところ **`/form`** だった。

| 置き場所 | 必要な basename |
|---|---|
| 7ブランド（`kh-house.jp/form/` 等） | `/form` |
| KHG共通（`kh-house.jp/khg/form/`） | `/khg/form` |

⚠️⚠️ **手元のソースをそのままビルドして7サイトへ配ると、React Router が一致せず画面が真っ白になる。**
⚠️ エラーも警告も出ないため、配ったあと誰も気づけない。

⚠️ 最後に触った人が KHG 向けにビルドしたまま残っていたもの。

---

## 変更したファイル

| ディレクトリ | ファイル |
|---|---|
| `react/form_get/src/` | `App.tsx` |

## 追加した関数

- `resolveBasename()`（`App.tsx`）— 置き場所から basename を決める

```ts
const resolveBasename = (): string => {
  const path = window.location.pathname;
  return path.includes('/khg/form') ? '/khg/form' : '/form';
};
```

⚠️⚠️ **`/khg/form` を先に見ること。** ⚠️ `/form` で先に判定すると `/khg/form/` も `/form` を含むため、**KHG が必ず外れる**。

⚠️ これで **1つのビルドを8サイトすべてへ配れる**。⚠️ 「どちらのビルドを配ったか」を間違えようがなくなる。

---

## 追加したドキュメント

| ファイル | 内容 |
|---|---|
| `docs/deploy-form-get.md` | ⚠️ **新規**。8サイトへの配布手順 |

### ⚠️ 手順書に太字で書いた落とし穴

| # | 内容 |
|---|---|
| 1 | ⚠️ **`form/` を「同期」しないこと。** ⚠️ 中に `api/index.php` があり、消すと**退避先が全滅する** |
| 2 | ⚠️ `index.html` の上書き漏れ（⚠️ 見た目が変わらないのに挙動だけ古い） |
| 3 | ⚠️ KHG は `kh-house.jp` の中の**別ディレクトリ** |
| 4 | ⚠️ ② に行かず ① へ退避し続けても**画面では気づけない**（Network を見る） |
| 5 | ⚠️ ロールバックで **`api/index.php` は戻さない**（穴が復活する） |

---

## 検証

| 確認 | 結果 |
|---|---|
| 8サイトすべてのパスで basename が正しい | ⚠️ **OK** |
| ⚠️ `confirm` 画面（1段深い）でも正しい | ⚠️ OK |
| ⚠️ 三項の条件が `/khg/form` 側（逆だとKHGが外れる） | ⚠️ OK |
| ⚠️ `form_table.tag` の実データ（`/form/?id=...`）と一致 | ⚠️ OK |
| ビルド成果物に `/form` と `/khg/form` の**両方**がある | ⚠️ OK |
| ⚠️ 通知先アドレスが混ざっていない | ⚠️ OK |
| ② を叩き、① への退避先が8件ある | ⚠️ OK |
| `npm run build`（`tsc -b && vite build`） | ⚠️ **成功**（412 modules） |

⚠️ 検証中に NG が1件出たが、⚠️ **コメント中の `'/form'` を先に拾っていたテスト側の誤り**だった。コードは正しい。

## ⚠️ 未実施

- ⚠️ 8サイトへの配布（⚠️ **利用者側の作業**）
- ⚠️ ① `khg-marketing.info/api/` の `index.php` 改修
