# 2026-10-22 5ブランドのサイトのメンテナンス案内ページ＋.htaccess＋設置手順

## 指示
- PHP の脆弱性のニュースを受けて、サイトを止めたときの案内ページを用意する
- 対象：kh-house.jp・day-just-house.com・nagomi-koumuten.jp・2lhome.net・jusfy-home.com。各ブランドのロゴ・色・トンマナに合わせる
- 文面は https://www.kaeruhome.jp/ （緊急メンテナンスのお知らせ）を参照
- 追加：.htaccess に書く記述、設置方法のドキュメント

## 成果物（リポジトリ外）
- `C:\Users\shinji-kawano\Downloads\maintenance\<kh|djh|nagomi|2l|jusfy>\maintenance.html`：案内ページ。1ファイルで、ロゴは base64 で埋め込み（PHP を止めると WordPress の画像も 503 になるため）
- `C:\Users\shinji-kawano\Downloads\maintenance\<各ブランド>\htaccess.txt`：5サイト共通の記述
- `C:\Users\shinji-kawano\Downloads\maintenance\設置手順.md`：下の設置手順の写し

## リポジトリに足したファイル
- `docs/guide-2026-10-22-maintenance-page-setup.md`：設置手順
- `docs/task-2026-10-22-03-maintenance-pages.md`：この作業記録
- コードの変更はなし

## 各ブランドの見た目（各サイトの CSS から取った色・書体）
| ブランド | ロゴ | 帯 | 見出し色 | 線の色 | 書体 |
|---|---|---|---|---|---|
| 国分ハウジング | iconLogoMenuOpen.png（白抜き） | #0f3675 | #0f3675 | #c9af81 | 游ゴシック＋Josefin Sans |
| デイジャストハウス | header_logo.png | #fff | #19b5c4 | #19b5c4 | Noto Sans JP |
| なごみ工務店 | logoNew.png | #fdfbfa | #956134 | #79a311 | 游明朝（見出し）＋游ゴシック |
| 2Lhome | common_logo_01.png | #fff | #00803e | #8fc31f | システムのゴシック＋Roboto |
| JUSFY HOME | iconLogoHeader.png（白抜き） | #222222 | #222222 | #dc4235 | Noto Serif JP（見出し）＋游ゴシック |

## 生成スクリプト（スクラッチパッド `close/gen.cjs`）
```js
// 各ブランドのメンテナンス案内ページ（1ファイル・ロゴは埋め込み）と .htaccess を作る
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const out = process.argv[2];

const brands = [
  { key: 'kh', name: '国分ハウジング', logo: 'kh.png', logoW: 261,
    band: '#0f3675', bg: '#f4f5f8', ink: '#2b2d33', accent: '#0f3675', rule: '#c9af81',
    font: '"游ゴシック", YuGothic, "Hiragino Kaku Gothic ProN", "メイリオ", Meiryo, sans-serif',
    head: '"游ゴシック", YuGothic, "Hiragino Kaku Gothic ProN", "メイリオ", Meiryo, sans-serif', en: 'MAINTENANCE', enFont: '"Josefin Sans", sans-serif', gfont: 'Josefin+Sans:wght@700' },
  { key: 'djh', name: 'デイジャストハウス', logo: 'djh.png', logoW: 258,
    band: '#ffffff', bg: '#f0f0f0', ink: '#231815', accent: '#19b5c4', rule: '#19b5c4',
    font: '"Noto Sans JP", sans-serif', head: '"Noto Sans JP", sans-serif', en: 'MAINTENANCE', enFont: '"Noto Sans JP", sans-serif', gfont: 'Noto+Sans+JP:wght@400;500;700' },
  { key: 'nagomi', name: 'なごみ工務店', logo: 'nagomi.png', logoW: 150,
    band: '#fdfbfa', bg: '#f6f1ea', ink: '#382a0b', accent: '#956134', rule: '#79a311',
    font: '"游ゴシック", YuGothic, "Hiragino Kaku Gothic ProN", "メイリオ", Meiryo, sans-serif',
    head: '"游明朝", YuMincho, "Hiragino Mincho ProN", serif', en: 'MAINTENANCE', enFont: '"Josefin Sans", sans-serif', gfont: 'Josefin+Sans:wght@700' },
  { key: '2l', name: '2Lhome（ニーエルホーム）', logo: '2l.png', logoW: 340,
    band: '#ffffff', bg: '#f1f7f2', ink: '#353535', accent: '#00803e', rule: '#8fc31f',
    font: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Yu Gothic", YuGothic, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
    head: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Yu Gothic", YuGothic, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif', en: 'MAINTENANCE', enFont: '"Roboto", sans-serif', gfont: 'Roboto:wght@700' },
  { key: 'jusfy', name: 'JUSFY HOME', logo: 'jusfy.png', logoW: 270,
    band: '#222222', bg: '#faf7f5', ink: '#222222', accent: '#222222', rule: '#dc4235',
    font: '"游ゴシック", YuGothic, "Hiragino Kaku Gothic ProN", "メイリオ", Meiryo, sans-serif',
    head: '"Noto Serif JP", serif', en: 'MAINTENANCE', enFont: '"Noto Serif JP", serif', gfont: 'Noto+Serif+JP:wght@500;700' },
];

// かえるホーム（https://www.kaeruhome.jp/）の文面と同じ。<br class="pc"> はスマホでは改行しない
const body = `
<p>いつも当サイトをご覧いただき、誠にありがとうございます。</p>
<p>現在、システムメンテナンスのため、<br class="pc">当サイトをご利用いただけない状態となっております。</p>
<p>本メンテナンスは、インターネットで広く利用されているソフトウェアに<br class="pc">重大な脆弱性が公表されたことを受け、<br class="pc">予防的な安全対策として実施しているものです。<br>対応が完了次第、再開いたします。</p>
<p>ご不便をおかけいたしますが、<br class="pc">何卒ご理解いただきますようお願い申し上げます。</p>`;

const page = (b, logo) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>緊急メンテナンスのお知らせ｜${b.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${b.gfont}&display=swap">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{display:flex;flex-direction:column;min-height:100vh;background:${b.bg};color:${b.ink};font-family:${b.font};font-size:15px;line-height:2;-webkit-font-smoothing:antialiased}
header{background:${b.band};padding:22px 20px;display:flex;justify-content:center;border-bottom:1px solid rgba(0,0,0,.06)}
header img{display:block;width:${b.logoW}px;max-width:80%;height:auto}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:48px 20px}
.card{width:100%;max-width:640px;background:#fff;padding:52px 48px 48px;text-align:center;border-top:4px solid ${b.rule};box-shadow:0 2px 18px rgba(0,0,0,.05)}
.en{font-family:${b.enFont};font-weight:700;font-size:13px;letter-spacing:.24em;color:${b.rule === '#ffffff' ? b.accent : b.rule}}
h1{font-family:${b.head};font-weight:700;font-size:24px;line-height:1.5;color:${b.accent};margin:10px 0 30px;letter-spacing:.06em}
.msg p+p{margin-top:1.3em}
footer{padding:20px;text-align:center;font-size:12px;color:${b.ink};opacity:.7}
@media (max-width:600px){
  body{font-size:14px;line-height:1.9}
  header{padding:16px}
  main{padding:28px 16px}
  .card{padding:36px 22px 32px;text-align:left}
  .en,h1{text-align:center}
  h1{font-size:20px;margin-bottom:22px}
  br.pc{display:none}
}
</style>
</head>
<body>
<header><img src="data:image/png;base64,${logo}" alt="${b.name}"></header>
<main>
<div class="card">
<p class="en">${b.en}</p>
<h1>緊急メンテナンスのお知らせ</h1>
<div class="msg">${body}
</div>
</div>
</main>
<footer>&copy; ${b.name}</footer>
</body>
</html>
`;

const htaccess = `（設置手順の「手順3」と同じ内容）`;

for (const b of brands) {
  const logo = fs.readFileSync(path.join(dir, 'logo', b.logo)).toString('base64');
  const d = path.join(out, b.key);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'maintenance.html'), page(b, logo));
  fs.writeFileSync(path.join(d, 'htaccess.txt'), htaccess);
  console.log(b.key, fs.statSync(path.join(d, 'maintenance.html')).size);
}
```

## .htaccess
`docs/guide-2026-10-22-maintenance-page-setup.md` の手順3に、記述をそのまま載せた。

## 確認
- Playwright で、5ページを PC（1366px）とスマホ（390px）の幅で表示した。横にはみ出さないこと、ロゴ・色・文面を確かめた。
- 一時的に立てた Apache（php:8.3-apache・rewrite と headers を有効、WordPress と同じ構成の .htaccess）で試した。
  - `/`・`/index.php`・`/wp-admin/`・`/a.png`・`/?p=1` → 503 で、本文は案内ページ。index.php は動かなかった。
  - `/maintenance.html` → 200。
  - `Retry-After: 86400` と `Cache-Control: no-store` が付く。
  - 試験用のコンテナは止めて消した。
- ⚠️ 未確認：社内 IP だけを通す行（コメントアウトしてある）は、試験の書き換えに失敗したため動作を確かめていない。手順書では「要確認」と書いた。
- ⚠️ サブフォルダに RewriteEngine On の .htaccess があると、親の書き換えルールは引き継がれない。デイジャストハウスの `/wp/` 用の手順を足した。
