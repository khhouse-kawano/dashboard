# 指示⑩　`form_get/src/components/Menu.tsx` の要否判断と撤去

⚠️ 依頼（要旨）: 「`react/form_get/src/components/Menu.tsx` は不要なコンポーネントか判断して」→ 退避を承認

---

## 判断: ⚠️ **不要**

| 確認 | 結果 |
|---|---|
| `App.tsx` のルート | ⚠️ `Form` と `Confirm` のみ。`Menu` は**無い** |
| `src` 内からの import | ⚠️ **0件** |
| ビルドに入るか | ⚠️ 入らない（未参照なので Vite が落とす） |

⚠️ 中身は**キャンペーン作成画面**（旧 `form_post`）。
⚠️ しかも**送信処理そのものがコメントアウト**されており、`setResponse({status:'success'})` を直に置いているだけ。
⚠️ **画面に出しても1件も登録されない**状態だった。

⚠️ 役割は dashboard 側の `frontend/src/components/campaign/NewCampaign.tsx` と `FormBuilder.tsx` に移っている。

## ⚠️ 撤去した積極的な理由

⚠️ **通知先のメールアドレスがソースに直書きされていた**（`mail_to` / `mail_cc` の初期値）。
⚠️ 今回の一連の作業で潰してきた漏洩経路と**同じもの**。
⚠️ ビルドに入らないため実害は出ていなかったが、⚠️ **誰かがルートに足した瞬間に公開される**。

---

## 実施内容

⚠️ **`form_get` は git 管理外**で、消すと戻せない。⚠️ **削除ではなく退避**した。

| 移動元 | 移動先 |
|---|---|
| `react/form_get/src/components/Menu.tsx` | `react/form_get/backup/Menu.tsx.removed-20260916` |

⚠️ `backup/` は `src` の外なのでビルドに入らない。

## 撤去後の `src/components/`

- `Form.tsx`
- `Confirm.tsx`

## 検証

| 確認 | 結果 |
|---|---|
| `npm run build`（`tsc -b && vite build`） | ⚠️ **成功**（412 modules） |
| ⚠️ ビルド成果物に通知先が残っていないか | ⚠️ **0件** |
