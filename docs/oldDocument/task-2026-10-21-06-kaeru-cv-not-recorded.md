# 2026-10-21 かえるホームの反響に流入の情報が入らない件の調査（v2.2.205 の後）

## 結論
GTM（GTM-WJS7JR3）に公開された2つのタグが、**どちらも tracker.js を読み込んでいた**。cv.js が一度も読み込まれていないので、`tracking_conversions` に何も入らず、反響と結びつかない。

- 原因：GTM 側で「CV 用のタグ」にトラッキングのタグと同じ中身（tracker.js）が入っている。
  - 実際に送った依頼文（利用者が貼って確認）の CV 用のタグは `cv.js` で正しかった。手元の Downloads のファイルだけが tracker.js になっていた（サイトキーを置き換えるときに上のタグを写したものと思われる）。
- 付随：tracker.js が2回動くため、公開してからの着地・PV が2重に記録されている可能性がある。

## 確認したこと
- フォーム3つ（/member/・/shop_reserve/・/contact/）は cv.js の条件に合っている
  - ボタン：`<input type="submit" value="確認画面へ">`
  - メール：/member/ は `member_email`、/shop_reserve/・/contact/ は `EMAIL`
  - 電話：3つとも `TELNO`
- `https://www.googletagmanager.com/gtm.js?id=GTM-WJS7JR3` の中身：`khg-marketing.info` が2回、どちらも `t/v1/tracker.js`。サイトキー `s_qfdQCA1PGuSzir5C` も2回。`cv.js` は0回
- ② の `https://api.khg-marketing.info/t/v1/cv.js` は 200 で配信できている（`api/track/cv` を含む）

## 直したもの
**ファイル** `C:\Users\shinji-kawano\Downloads\GTM担当者への依頼_かえるホーム_v2.2.205.txt`（リポジトリの外）

```diff
 ▼▼▼ ここから（CV 用のタグ） ▼▼▼
 <script>
 (function () {
   var s = document.createElement('script');
-  s.src = 'https://api.khg-marketing.info/t/v1/tracker.js';
+  s.src = 'https://api.khg-marketing.info/t/v1/cv.js';
```

- コードの変更はなし（画面のアクセス解析の「CV 用」のタグは `CV_URL` = cv.js で正しい）。

## 残っていること（利用者側）
- GTM 担当者に「CV 用のタグ」の1行（`tracker.js` → `cv.js`）を直して公開し直してもらう
- 公開前に送られた分は記録が無いので、さかのぼって結びつけることはできない
