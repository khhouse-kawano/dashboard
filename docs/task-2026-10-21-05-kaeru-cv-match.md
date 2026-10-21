# 2026-10-21 v2.2.205 かえるホームの CV の結びつけ・建売の HP閲覧履歴・アンバサダーの反響一覧

## 依頼（会話での指示。ReadMeClaude.md ではない）
1. 「https://www.kaeruhome.jp/ からの CV の際にも landing_params を送りたいが、制作会社がコントロールしているサイトのため制限が大きい。GTM に埋めれば着地や遷移はわかるが CV も取得したい」
   - 案：GTM で cv.js を入れ、「確認画面へ」でメール・電話のハッシュを送り、② が反響（通知メールから GAS が入れたもの）と突き合わせる → 「この方法でよい」
   - CV は別の表に貯めて ② が結びつける（反響の時点で inquiry_customer_kaeru に行を作らない）
   - 「ついでに GTM 管理者への依頼文も準備して」。プライバシーポリシーの文案は不要（Chatwork で投げる）
   - v2.2.204 はデプロイ済みなので v2.2.205 で
2. 「InformationEditKaeru.tsx に InformationEdit.tsx と同じような HP閲覧履歴を。備考の <tr> の次。tracking_pageviews と landing_params で突合できる顧客のみ。master_data_kaeru にも landing_params を追加する」
3. 「InquiryAmbassador.tsx に inquiry_ambassador テーブルの account も表示させたい。住所の右列へ」
4. 「InquiryAmbassador.tsx 横幅いっぱい使ってるのでテーブルの視認性が悪いため、padding 等で余白を設けてほしい」

## 作業開始
- `origin/main`（v2.2.204 マージ済み）から `v2.2.205`。v2.2.204 の最後の調査記録（28ac6c35。main に未マージ）を cherry-pick
- 版の3点：`version.ts`・`2026-10-21_update_log_2.2.205.sql`・ローカルDB（update_log no=306）

## サイトの調査（kaeruhome.jp）
| フォーム | ページ | メールの欄 | 電話の欄 | 反響の inquiry_id |
|---|---|---|---|---|
| 会員登録 | /member/ | member_email | TELNO | hp_member_…（8月以降 616件） |
| 来場予約 | /shop_reserve/ | EMAIL | TELNO | hp_reserve_…（72件） |
| 問い合わせ | /contact/ | EMAIL | TELNO | — |
- どれも `<form action="">` ＋「確認画面へ」（`onClick="submitChk();return false;"`）→ confirm.php → 完了
- 反響は通知メール（ask@kaeruhome.jp）を GAS が読み、① の portal/*_kaeru.php が inquiry_customer_kaeru に INSERT IGNORE（medium は「ホームページ反響」）
- GTM：GTM-WJS7JR3

## 設計
- **cv.js**（② が配る。GTM で All Pages）：「確認画面へ」を押したとき、メール（小文字・前後の空白なし）と電話（数字だけ。全角は半角に）を **SHA-256** にして、顧客ID（tracker.js の khg_vid）・landing_params・フォームの種類（パスの1段目）と一緒に `/api/track/cv` へ `sendBeacon`
  - ⚠️ 押すとすぐ次の画面へ移るため、SHA-256 は**同期**で計算（crypto.subtle は非同期で、移る前に終わらないおそれ）。小さい実装を入れ、Node の crypto と 311 通りで一致を確認
  - 元のメール・電話は送らない
- **`POST /api/track/cv`**（conversion.ts）：登録済み・有効・**CV を扱うブランド（CV_TARGETS。今は khf）**・許可したオリジン・UUID・64桁16進だけ保存。同じ（サイト・顧客ID・ハッシュ）は1行（結びついたあとは上書きしない）。ロボットは保存しない。1分30件/IP。応答は常に 204
- **突き合わせ**（cvMatch.ts。起動2分後・5分ごと）：直近14日の CV × 直近15日・landing_params が空のホームページ反響。メール・携帯・固定のどれかのハッシュが一致し、CV の日 ≦ 反響の日なら、最後の CV の landing_params を反響に書く。反響がもう取り込まれていれば（pg_id）、顧客（master_data_kaeru）にも書く。14日たって結びつかない CV は消す
  - 同じ人が別のフォームでも送っていれば、その反響にも同じ CV を使う（結びついた CV も候補に入れる）
- **アクセス解析**：CV の集計（conversions.ts）に inquiry_customer_kaeru を UNION ALL。id が表ごとなので `inquiryTable` を持たせ、詳細の CV 一覧（detail.ts）は表ごとに引く。整理（maintenance.ts）はかえるの反響・顧客も「消さない人」に。一覧（sites.ts）に `cvForm`（直近30日の送信・結びつき。CV を扱わないブランドは null）
- **建売の HP閲覧履歴**：`customer_pageviews` に `division`（order／spec）。⚠️ `category` はゲートウェイの鍵に入るので使わない。反響一覧（かえる）の取込で landing_params を顧客へ引き継ぐ（ListKaeru.tsx・queries.ts・list_spec.php）
- **アンバサダーの反響一覧**：`account` は**紹介アンバサダーのインスタのアカウント（反響が届いた時点）**（同期のときに備考へ「紹介アンバサダー: 〜」と書いている値）。お客様のアカウントではない

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/scripts/sql | **2026-10-21_tracking_conversions.sql**（新規）・**_rollback.sql**（新規） | 表 tracking_conversions、inquiry_customer_kaeru・master_data_kaeru に landing_params |
| backend/scripts/sql | **2026-10-21_update_log_2.2.205.sql**（新規） | update_log ＋ 記事3本 |
| backend-express/public | **cv.js**（新規） | 上記 |
| backend-express/src/features/tracking | **conversion.ts**（新規） | `recordConversion`・`CV_TARGETS` |
| backend-express/src/features/tracking | **cvMatch.ts**（新規） | `runCvMatch`・`startCvMatch`・`emailHashOf`・`telHashOf` |
| backend-express/src/features/tracking | **publicRouter.ts** | `loadTracker` → `loadScript(file)`（tracker.js・cv.js）・`cvLimiter`・`/api/track/cv` |
| backend-express/src/features/tracking | **conversions.ts** | `CV_TABLES`・`CvTable`・`Conversion.inquiryTable`・UNION ALL |
| backend-express/src/features/tracking | **detail.ts** | CV 一覧を表ごとに引く |
| backend-express/src/features/tracking | **maintenance.ts** | かえるの反響・顧客も消さない |
| backend-express/src/features/tracking | **sites.ts** | `cvForm` |
| backend-express/src/features/tracking | **customerPageviews.ts** | `division` → 顧客の表 |
| backend-express/src/features/list | **queries.ts** | 反響一覧（spec）に landing_params |
| backend-express/src/features/information | **masterDataColumns.ts** | コメントのみ（列は前からある） |
| backend-express/src/gateway | **registry.ts** | `customer_pageviews` に division |
| backend-express/src | **server.ts** | `startCvMatch()` |
| backend/src/handlers/listAction | **list_spec.php** | 反響一覧（spec）に landing_params |
| frontend/src/components/header | **TrackingSettings.tsx** | `gtmScriptTag`・`cvGtmTag`・`CV_URL`・CV 用タグ・「フォーム送信 n件（結びつき m件）」 |
| frontend/src/components/information | **InformationEditKaeru.tsx** | 備考の下に HP閲覧履歴（landing_params がある顧客だけ）・`expand.history` |
| frontend/src/components/information | **CustomerPageviews.tsx** | `division` |
| frontend/src/components/list | **ListKaeru.tsx** | 取込で landing_params を送る |
| frontend/src/components/header | **InquiryAmbassador.tsx** | アカウントの列（住所の右）・`IA_CSS`（余白） |
| frontend/src/utils | **version.ts** | 2.2.205 |
| backend/scripts/guide/articles | **common/screen-200.md**・**spec/screen-020.md**・**common/screen-210.md**（新規） | 記事 |
| （リポジトリ外） | **Downloads/GTM担当者への依頼_かえるホーム_v2.2.205.txt** | GTM 担当者への依頼文（【サイトキー】2か所は本番で登録したあとに差し替える） |

## 業務ガイドの記事
- **アクセス解析**：「自社のフォームでないサイト（かえるホーム）」の節を追加
- **顧客DB（建売営業）**：閉じている欄に「閲覧」、「HP閲覧履歴」の節を追加
- **アンバサダーの反響一覧**（新規。common/screen-210.md）：絞り込み・表の見方（アカウントの意味）・同期

## 確認
### ②（ローカル）
- cv.js：200・4.5KB・行頭の // なし。SHA-256 は Node の crypto と 311 通り一致
- Playwright で本物の kaeruhome.jp のページ（保存した HTML）に GTM と同じ形で tracker.js・cv.js を入れ、ローカルの ② へ
  - ヘッドレスの User-Agent は「ロボット」として保存しない（作りどおり）→ 通常の UA で確認
  - 問い合わせ（`  Kaeru.Test205@Example.COM `・`０９０－１２３４－５６７８`）→ ハッシュが `kaeru.test205@example.com`・`09012345678` と一致。landing_params は広告の情報＋khg_vid
  - 会員登録（member_email）を2回 → 1行のまま。メールも電話も空 → 送らない
- 突き合わせ（テストの反響4件）：A（メール一致）・B（固定電話だけ一致）が結びつく、C（一致なし）・D（反響の日が CV より前）は空のまま、2回目は変化なし。取込済み（pg_id あり）の顧客にも書く
- アクセス解析：かえるのサイトに CV 2件・cvForm {sent 2, matched 2}・詳細の CV 一覧にかえるの反響。ほかのサイトの cvForm は null
- customer_pageviews：spec → 4件、同じ id で order・division なし → 結びつかない、used・不正な値 → 400、注文の顧客は前と同じ 5件
- ① 経由：`{"request":"customer_pageviews","division":"spec"}` → 401
### 画面（ビルド `main.c468f5d5.js`。Playwright）
- 反響一覧（かえる）の取込：landing_params がある反響は送る、無い反響は項目ごと送らない
- かえるの顧客情報：備考 > **HP閲覧履歴** の順、`division: 'spec'` で問い合わせ、閉じると 80px・フェード、押すと開く。landing_params が無い顧客は行なし
- アクセス解析：CV の欄に「フォーム送信 3件（結びつき 2件）」、タグは かえる だけ3つ（GTM 用・フッター用・CV 用。CV 用は cv.js とサイトキー入り）、国分ハウジングは2つ
- アンバサダーの反響一覧：住所 > **アカウント** > 建築希望地、`@hanako_ig`／未入力は空。セルの余白 10px 14px、左右 43px（幅 1440px）・16px（幅 390px）、横はみ出しなし
- eslint：変更した行に新しい警告なし（出ているのは前からのもの）
### 後片付け
- テストの反響・顧客・CV・テスト用のサイト（id 10）とその着地・閲覧・消さない顧客ID を削除。ローカルDBは CSV を入れた直後の状態（サイト7・閲覧60・着地5,692）
- ⚠️ テスト用の顧客を既存の行から写したため、写真に実在のお客様の備考が写った → その写真と元の JSON は scratchpad から削除済み

### リファクタリング
- tracker.js の配信を `loadScript(file)` にして cv.js と共通化
- GTM 用のタグを `gtmScriptTag(src, siteKey)` にして CV 用と共通化
- 反響の表・顧客の表は `CV_TARGETS` の1か所に（conversion.ts・cvMatch.ts・sites.ts が使う）
- 上の確認は、この整理のあとのビルド・② で行った

---

## 付録：追加・変更したコード

### backend-express/public/cv.js（新規・全文）
```js
// 自社のフォームでないサイトの CV（v2.2.205。まずはかえるホーム kaeruhome.jp）。GTM で全ページに入れる（タグはアクセス解析が出す）。
// ⚠️ tracker.js と一緒に入れる（顧客ID khg_vid と流入の情報 landing_params は tracker.js が localStorage に書いたものを読む）。
// ⚠️ フォームの「確認画面へ」（data-button の文字を含むボタン）が押されたら、メール・電話を SHA-256 にして ② の /api/track/cv に送る。
// ⚠️⚠️ メールアドレス・電話番号そのものは送らない。ハッシュだけ。② は反響（通知メールから GAS が入れたもの）を同じ方法でハッシュにして突き合わせる。
// ⚠️ 正規化は ② の features/tracking/cvMatch.ts と同じ：メールは前後の空白を除いて小文字、電話は数字だけ（全角の数字も半角にする）。
// ⚠️ ボタンを押すと、すぐ次の画面へ移る。そのため SHA-256 は同期で計算し、sendBeacon（ページを移っても届く）で送る。
// ⚠️ 入力欄の名前は data-email / data-tel（カンマ区切り）。既定はかえるホームのもの（EMAIL・member_email／TELNO）。
// ⚠️⚠️ 全体を try/catch で囲む。このスクリプトのエラーでサイト・フォームを止めてはいけない。
// ⚠️ 行頭が // の行は配信時に ② が取り除く（features/tracking/publicRouter.ts）。行の途中にコメントを書かないこと。
(function () {
  try {
    var script = document.currentScript;
    var data = script && script.dataset ? script.dataset : {};
    var siteKey = data.site || '';
    if (!siteKey || window.khgTrackingDisabled === true || !window.localStorage) return;
    var ENDPOINT = 'https://api.khg-marketing.info/api/track/cv';
    var BUTTON = data.button || '確認画面へ';
    var EMAIL_NAMES = (data.email || 'EMAIL,member_email').split(',');
    var TEL_NAMES = (data.tel || 'TELNO').split(',');
    var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    var sha256 = function (text) {
      var bytes = unescape(encodeURIComponent(text));
      var len = bytes.length;
      var words = [];
      for (var i = 0; i < len; i++) words[i >> 2] |= (bytes.charCodeAt(i) & 255) << (24 - (i % 4) * 8);
      words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
      words[(((len + 8) >> 6) + 1) * 16 - 1] = len * 8;
      var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
      var w = [];
      var rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
      for (var j = 0; j < words.length; j += 16) {
        var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
        for (var t = 0; t < 64; t++) {
          if (t < 16) w[t] = words[j + t] | 0;
          else {
            var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
            var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
            w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
          }
          var t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
          var t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
          k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
        h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + k) | 0;
      }
      var out = '';
      for (var m = 0; m < 8; m++) out += ('00000000' + (h[m] >>> 0).toString(16)).slice(-8);
      return out;
    };

    var halfWidth = function (s) { return s.replace(/[０-９＠．＿－＋]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); }); };
    var valueOf = function (form, names) {
      for (var i = 0; i < names.length; i++) {
        var el = form.querySelector('[name="' + names[i].trim() + '"]');
        if (el && typeof el.value === 'string' && el.value.trim() !== '') return el.value;
      }
      return '';
    };

    var send = function (form) {
      var vid = (window.localStorage.getItem('khg_vid') || '').toLowerCase();
      if (!UUID.test(vid)) return;
      var email = halfWidth(valueOf(form, EMAIL_NAMES)).trim().toLowerCase();
      var tel = halfWidth(valueOf(form, TEL_NAMES)).replace(/[^0-9]/g, '');
      if (email.indexOf('@') < 1) email = '';
      if (tel.length < 10) tel = '';
      if (!email && !tel) return;
      var payload = JSON.stringify({
        site_key: siteKey,
        visitor_id: vid,
        form: (location.pathname.split('/')[1] || '').slice(0, 50),
        email_hash: email ? sha256(email) : '',
        tel_hash: tel ? sha256(tel) : '',
        landing_params: window.localStorage.getItem('landing_params') || '',
        url: location.origin + location.pathname
      });
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'text/plain' }))) return;
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.send(payload);
    };

    document.addEventListener('click', function (event) {
      try {
        var target = event.target;
        var button = target && target.closest ? target.closest('input[type="submit"], input[type="button"], button') : null;
        if (!button) return;
        var label = button.value || button.textContent || '';
        if (label.indexOf(BUTTON) < 0) return;
        var form = button.form || button.closest('form');
        if (form) send(form);
      } catch (e) {
        return;
      }
    }, true);
  } catch (e) {
    return;
  }
})();
```

### backend-express/src/features/tracking/conversion.ts（新規・全文）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { BOT_UA_PATTERN, TRACKING_KEYS, UUID_PATTERN, parseLandingParams } from './params';
import { findTrackingSite, normalizeOrigin } from './touch';

/**
 * 自社のフォームでないサイトの CV の受け付け（v2.2.205。`POST /api/track/cv`。⚠️ 公開・認証なし）。public/cv.js が送る。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **社外の誰でも叩ける書き込み口。リクエストの値を信用しない。**（pageview.ts と同じ考え方）
 *   ⚠️ 保存するのは、登録済み・有効で CV を扱うブランドのサイトの・許可したオリジンからの・UUID の顧客ID の、
 *     64桁の16進（SHA-256）のメール・電話のハッシュだけ。⚠️ ロボットは保存しない。
 * ⚠️ メールアドレス・電話番号そのものは受け取らない（cv.js がブラウザでハッシュにする）。
 * ⚠️ 同じ人が「確認画面へ」を何度押しても1行（サイト・顧客ID・ハッシュの組で上書き）。
 * ⚠️ landing_params は対象のキー（params.ts の TRACKING_KEYS）と khg_vid だけを残す。⚠️ khg_vid は送ってきた顧客ID に置き換える。
 * ⚠️ 反響との突き合わせは cvMatch.ts（5分ごと）。⚠️ 応答は成功・失敗とも 204（publicRouter.ts）。
 * ─────────────────────────────────────────────
 */

/**
 * CV を扱うブランド → 突き合わせる反響の表と、反響を取り込んだ先の顧客の表。⚠️ ここに無いブランドのサイトからの送信は保存しない
 * ⚠️ 表の名前は SQL に直接入れる（⚠️ 外からの値を入れないこと）
 */
export const CV_TARGETS: Record<string, { inquiry: string; master: string }> = {
  khf: { inquiry: 'inquiry_customer_kaeru', master: 'master_data_kaeru' },
};

const HASH_PATTERN = /^[0-9a-f]{64}$/;

const hashOf = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return '';
  return typeof value === 'string' && HASH_PATTERN.test(value) ? value : null;
};

/** 対象のキーと khg_vid だけの landing_params（⚠️ 空なら khg_vid だけ） */
const cleanLandingParams = (value: unknown, visitorId: string): string => {
  const raw = parseLandingParams(typeof value === 'string' ? value.slice(0, 4000) : '');
  const kept = new URLSearchParams();
  for (const [key, max] of Object.entries(TRACKING_KEYS)) {
    const v = (raw[key] ?? '').trim();
    if (v !== '') kept.set(key, v.slice(0, max));
  }
  kept.set('khg_vid', visitorId);
  return kept.toString().slice(0, 2000);
};

interface BrandRow extends RowDataPacket {
  brand: string | null;
}

export interface ConversionInput {
  body: unknown;
  origin: string;
  userAgent: string;
}

/** 保存したら true。⚠️ 保存しなかった理由はログに出す */
export const recordConversion = async ({ body, origin, userAgent }: ConversionInput): Promise<boolean> => {
  const reject = (reason: string): false => {
    logger.info(`track/cv: 保存しません（${reason}） origin="${origin}"`);
    return false;
  };
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return reject('本文が JSON ではない');
  if (BOT_UA_PATTERN.test(userAgent)) return reject('ロボットのアクセス');
  const b = body as Record<string, unknown>;
  const siteKey = typeof b.site_key === 'string' ? b.site_key : '';
  const site = await findTrackingSite(siteKey);
  if (site === null) return reject(`サイトが無い site_key="${siteKey.slice(0, 40)}"`);
  if (!site.active) return reject(`無効のサイト site_id=${site.id}`);
  const normalized = normalizeOrigin(origin);
  if (normalized === '' || !site.origins.includes(normalized)) return reject(`許可していないオリジン site_id=${site.id}`);
  const brand = (await query<BrandRow>('SELECT brand FROM tracking_sites WHERE id = ? LIMIT 1', [site.id]))[0]?.brand ?? '';
  if (CV_TARGETS[brand] === undefined) return reject(`CV を扱わないブランド site_id=${site.id} brand="${brand}"`);
  const visitorId = typeof b.visitor_id === 'string' ? b.visitor_id.toLowerCase() : '';
  if (!UUID_PATTERN.test(visitorId)) return reject('顧客ID が UUID ではない');
  const emailHash = hashOf(b.email_hash);
  const telHash = hashOf(b.tel_hash);
  if (emailHash === null || telHash === null) return reject('ハッシュの形が違う');
  if (emailHash === '' && telHash === '') return reject('メールも電話も無い');
  const form = typeof b.form === 'string' ? b.form.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50) : '';
  let pageUrl: string | null = null;
  try {
    const u = new URL(typeof b.url === 'string' ? b.url : '');
    if (normalizeOrigin(u.origin) === normalized) pageUrl = `${u.origin}${u.pathname}`.slice(0, 2000);
  } catch {
    pageUrl = null;
  }

  // ⚠️ 結びついたあとに同じ組が来たら、日時だけ進めない（結びつけた記録を残す）
  await execute(
    `INSERT INTO tracking_conversions (site_id, visitor_id, form, email_hash, tel_hash, landing_params, page_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       form = IF(matched_at IS NULL, VALUES(form), form),
       landing_params = IF(matched_at IS NULL, VALUES(landing_params), landing_params),
       page_url = IF(matched_at IS NULL, VALUES(page_url), page_url),
       created_at = IF(matched_at IS NULL, CURRENT_TIMESTAMP, created_at)`,
    [site.id, visitorId, form, emailHash, telHash, cleanLandingParams(b.landing_params, visitorId), pageUrl]
  );
  return true;
};
```

### backend-express/src/features/tracking/cvMatch.ts（新規・全文）
```ts
import { createHash } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { CV_TARGETS } from './conversion';

/**
 * 自社のフォームでないサイトの CV と反響の突き合わせ（v2.2.205）。② の起動から2分後に1回、その後5分ごと（startCvMatch）。
 *
 * ─────────────────────────────────────────────
 * 1. ブランドごとに（conversion.ts の CV_TARGETS）、直近14日の CV（tracking_conversions）を読む
 * 2. 反響の表から、landing_params が空の、直近15日のホームページ反響（削除を除く）を読む
 *    ⚠️ 反響は通知メールから GAS が入れる（届く順番は CV と前後する。だから CV を別の表に貯めておく）
 * 3. 反響のメール・携帯・固定電話を cv.js と同じ方法でハッシュにし、どれかが一致して、CV の日が反響の日以前のものを探す
 *    ⚠️ 一致が複数あれば最後の CV。⚠️ 同じ人が別のフォームでも送っていれば、その反響にも同じ CV を使う
 * 4. 反響の landing_params に、CV が覚えていた流入の情報（khg_vid を含む）を書く。CV に結びついた反響を書く（最初の1件）
 *    ⚠️ 反響がもう顧客DBに取り込まれていたら（pg_id あり）、顧客の landing_params にも書く（空のときだけ。顧客情報の「HP閲覧履歴」が読む）
 *    ⚠️ 取り込みがあとなら、反響一覧の「取込」が反響の landing_params を顧客へ引き継ぐ（ListKaeru.tsx）
 * 5. 14日たっても結びつかない CV を消す（確認画面で止めた人など）
 * ⚠️ 正規化は public/cv.js と必ず同じにすること（メールは前後の空白を除いて小文字、電話は数字だけ。全角の数字・記号は半角に）。
 * ─────────────────────────────────────────────
 */

const KEEP_DAYS = 14;
const INQUIRY_DAYS = 15;
const FIRST_DELAY_MS = 120_000;
const INTERVAL_MS = 5 * 60 * 1000;

const halfWidth = (s: string): string => s.replace(/[０-９＠．＿－＋]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

export const emailHashOf = (value: string | null): string => {
  const email = halfWidth(value ?? '').trim().toLowerCase();
  return email.indexOf('@') < 1 ? '' : sha256(email);
};

export const telHashOf = (value: string | null): string => {
  const tel = halfWidth(value ?? '').replace(/[^0-9]/g, '');
  return tel.length < 10 ? '' : sha256(tel);
};

interface CvRow extends RowDataPacket {
  id: number;
  email_hash: string;
  tel_hash: string;
  landing_params: string | null;
  visitor_id: string;
  day: string;
  matched_at: string | null;
}

interface InquiryRow extends RowDataPacket {
  inquiry_id: string;
  pg_id: string | null;
  mail: string | null;
  mobile: string | null;
  landline: string | null;
  day: string | null;
}

export interface CvMatchResult {
  matched: number;
  removed: number;
}

export const runCvMatch = async (): Promise<CvMatchResult> => {
  let matched = 0;
  for (const [brand, { inquiry: table, master }] of Object.entries(CV_TARGETS)) {
    // ⚠️ 新しい順（一致が複数あれば最初に見つかったものが最後の CV）
    const cvs = await query<CvRow>(
      `SELECT c.id, c.email_hash, c.tel_hash, c.landing_params, c.visitor_id, DATE_FORMAT(c.created_at, '%Y-%m-%d') AS day, c.matched_at
         FROM tracking_conversions c JOIN tracking_sites s ON s.id = c.site_id
        WHERE s.brand = ? AND c.created_at >= NOW() - INTERVAL ${KEEP_DAYS} DAY
        ORDER BY c.created_at DESC, c.id DESC`,
      [brand]
    );
    if (cvs.length === 0) continue;
    const byHash = new Map<string, CvRow[]>();
    for (const cv of cvs) {
      for (const hash of [cv.email_hash, cv.tel_hash]) {
        if (hash === '') continue;
        const list = byHash.get(hash) ?? [];
        list.push(cv);
        byHash.set(hash, list);
      }
    }

    const inquiries = await query<InquiryRow>(
      `SELECT inquiry_id, pg_id, mail, mobile, landline, DATE_FORMAT(STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d'), '%Y-%m-%d') AS day
         FROM ${table}
        WHERE delete_flag = 0 AND medium = 'ホームページ反響' AND (landing_params IS NULL OR landing_params = '')
          AND STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d') >= CURDATE() - INTERVAL ${INQUIRY_DAYS} DAY`
    );
    for (const inquiry of inquiries) {
      if (inquiry.day === null) continue;
      const hashes = [emailHashOf(inquiry.mail), telHashOf(inquiry.mobile), telHashOf(inquiry.landline)].filter((h) => h !== '');
      const hits = new Map<number, CvRow>();
      for (const hash of hashes) for (const cv of byHash.get(hash) ?? []) if (cv.day <= (inquiry.day as string)) hits.set(cv.id, cv);
      if (hits.size === 0) continue;
      const chosen = [...hits.values()].sort((a, b) => b.day.localeCompare(a.day) || b.id - a.id)[0];
      const landing = chosen.landing_params && chosen.landing_params.includes('khg_vid=') ? chosen.landing_params : `khg_vid=${chosen.visitor_id}`;
      const updated = await execute(
        `UPDATE ${table} SET landing_params = ? WHERE inquiry_id = ? AND (landing_params IS NULL OR landing_params = '')`,
        [landing, inquiry.inquiry_id]
      );
      if (updated.affectedRows === 0) continue;
      matched += 1;
      if (inquiry.pg_id) {
        await execute(`UPDATE ${master} SET landing_params = ? WHERE id = ? AND (landing_params IS NULL OR landing_params = '')`, [landing, inquiry.pg_id]);
      }
      const open = [...hits.values()].filter((cv) => cv.matched_at === null).map((cv) => cv.id);
      if (open.length > 0) {
        await execute(
          `UPDATE tracking_conversions SET matched_inquiry_id = ?, matched_at = NOW() WHERE matched_at IS NULL AND id IN (${open.map(() => '?').join(', ')})`,
          [inquiry.inquiry_id, ...open]
        );
        for (const cv of hits.values()) cv.matched_at = cv.matched_at ?? 'now';
      }
    }
  }

  const removed = await execute(`DELETE FROM tracking_conversions WHERE matched_at IS NULL AND created_at < NOW() - INTERVAL ${KEEP_DAYS} DAY`);
  if (matched > 0 || removed.affectedRows > 0) {
    logger.info(`tracking: CV を反響に結びつけました（${matched} 件・結びつかずに消した CV ${removed.affectedRows} 件）`);
  }
  return { matched, removed: removed.affectedRows };
};

export const startCvMatch = (): void => {
  const run = (): void => {
    runCvMatch().catch((error: unknown) => logger.error('tracking: CV の突き合わせに失敗しました', error));
  };
  setTimeout(run, FIRST_DELAY_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
};
```

### backend/scripts/sql/2026-10-21_tracking_conversions.sql（新規・全文）
```sql
-- =====================================================================
-- アクセス解析：自社のフォームでないサイトの CV（v2.2.205。まずはかえるホーム kaeruhome.jp）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何度流しても安全（IF NOT EXISTS）。
-- ⚠️ 書くのは ② の公開の受け口（POST /api/track/cv。GTM で入れた cv.js が「確認画面へ」を押したときに送る）。
-- ⚠️ メールアドレス・電話番号は**保存しない**。ブラウザで SHA-256 にした値だけを持つ（突き合わせのため）。
-- ⚠️ ② が5分ごとに反響（inquiry_customer_kaeru）のメール・電話を同じ方法でハッシュにして突き合わせ、
--   一致したら反響の landing_params に顧客ID（khg_vid）と着地の広告の情報を書く（features/tracking/cvMatch.ts）。
-- ⚠️ 14日たっても結びつかない行は ② が消す（確認画面で止めた人など）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS tracking_conversions (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id             INT UNSIGNED    NOT NULL,
    visitor_id          CHAR(36)        NOT NULL COMMENT '顧客ID（khg_vid）',
    form                VARCHAR(50)     NOT NULL DEFAULT '' COMMENT 'フォームの種類（ページのパスの1段目。member・shop_reserve など）',
    email_hash          CHAR(64)        NOT NULL DEFAULT '' COMMENT 'メールアドレス（小文字・前後の空白なし）の SHA-256。無ければ空',
    tel_hash            CHAR(64)        NOT NULL DEFAULT '' COMMENT '電話番号（数字だけ）の SHA-256。無ければ空',
    landing_params      VARCHAR(2000)   DEFAULT NULL COMMENT '送ったときにブラウザが覚えていた流入の情報（対象のキーと khg_vid だけ）',
    page_url            VARCHAR(2000)   DEFAULT NULL COMMENT 'フォームのページ（? 以降を除く）',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最後に送った日時',
    matched_inquiry_id  VARCHAR(255)    DEFAULT NULL COMMENT '結びついた反響の inquiry_id',
    matched_at          DATETIME        DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tracking_conversions (site_id, visitor_id, email_hash, tel_hash),
    KEY idx_tracking_conversions_open (matched_at, created_at),
    KEY idx_tracking_conversions_email (email_hash),
    KEY idx_tracking_conversions_tel (tel_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='アクセス解析：自社のフォームでないサイトの CV（v2.2.205）';

-- かえるホームの反響に、結びついた流入の情報（注文の inquiry_customer.landing_params と同じ形）
ALTER TABLE inquiry_customer_kaeru
    ADD COLUMN IF NOT EXISTS landing_params TEXT DEFAULT NULL COMMENT 'v2.2.205 サイトでの閲覧と結びついた流入の情報（khg_vid など）';

-- かえるホームの顧客にも（反響を顧客DBへ取り込むときに引き継ぐ。顧客情報の「HP閲覧履歴」が読む。2026-10-21 の追加の指示）
ALTER TABLE master_data_kaeru
    ADD COLUMN IF NOT EXISTS landing_params TEXT DEFAULT NULL COMMENT 'v2.2.205 反響から引き継いだ流入の情報（khg_vid など）';

SHOW TABLES LIKE 'tracking_conversions';
SHOW COLUMNS FROM inquiry_customer_kaeru LIKE 'landing_params';
SHOW COLUMNS FROM master_data_kaeru LIKE 'landing_params';
```

### backend/scripts/sql/2026-10-21_tracking_conversions_rollback.sql（新規・全文）
```sql
-- v2.2.205 の CV の表と、かえるホームの反響の landing_params を消す（⚠️ 結びつけた記録が消える）
DROP TABLE IF EXISTS tracking_conversions;
ALTER TABLE inquiry_customer_kaeru DROP COLUMN IF EXISTS landing_params;
ALTER TABLE master_data_kaeru DROP COLUMN IF EXISTS landing_params;
```

### backend/scripts/guide/articles/common/screen-210.md（新規・全文）
```md
---
title: アンバサダーの反響一覧
section: 画面の使い方
sort: 210
summary: 公式アンバサダーの紹介フォームから届いた反響の確認と、担当の割り振り・顧客への取り込み。
---
ヘッダーの「公式アンバサダー → 反響一覧」。公式アンバサダーの紹介ページのフォームから届いた反響を確認し、担当店舗・担当営業を決めて、顧客として取り込む画面です。

[[画面:アンバサダーの反響一覧]]

## 絞り込み
- **未同期／同期済み／すべて**：はじめは「すべて」です。取り込みが済んだ行は青くなります
- **担当店舗**：届いている反響の店舗だけが選べます
- **検索**：氏名・アカウント・電話番号で探せます

## 表の見方
- 反響日・氏名・ふりがな・電話番号・メールアドレス・住所
- **アカウント**：住所の右の列です。紹介したアンバサダーのインスタのアカウントで、**反響が届いた時点**のものです。入っていなければ空です
- **建築希望地**：これから建てたい場所です。担当店舗はここを見て決めます
- **ご質問やご要望**：お客様が書いた文章です。書き換えないでください
- **事業区分**・**担当店舗**・**担当営業**：この画面で選んで保存します
- **紹介アンバサダー**：紹介したアンバサダーの、**今の**名前とアカウントです（アンバサダー管理の台帳の値）。台帳に無いときは黄色の印が出ます
- **メール**：お客様へのお礼のメールと社内への通知が届いたかです。✕ は送れなかった印です

> 注意：アンバサダーがアカウント名を変えていると、「アカウント」（届いた時点）と「紹介アンバサダー」（今）が食い違います。誰の紹介かは「紹介アンバサダー」で見てください。

## 顧客への取り込み（同期）
1. 事業区分を選ぶ（取り込み先が変わります）
2. 担当店舗・担当営業を選ぶ
3. 「同期」を押す → 確認が出たら進める

> 注意：同期は取り消せません。事業区分を間違えると、担当の画面に出てこない顧客になります。

- 同期が済んだ行の「URL」を押すと、顧客情報のページのアドレスをコピーできます。担当営業への共有に使います
```

### update_log の1行（記事の SQL は build-guide-sql.cjs の出力なので省略）
```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.205', '2026-10-21', 'かえるホームのサイトの問い合わせを、サイトでの閲覧の記録と結びつけるようにした（アクセス解析の CV にかえるホームも入る）。建売営業の顧客情報にも「HP閲覧履歴」を追加した。アンバサダーの反響一覧に、紹介アンバサダーの反響時点のアカウントの列を追加し、表に余白を付けて見やすくした。');
```

### 差分（既存ファイル）
```diff
diff --git a/backend-express/src/features/information/masterDataColumns.ts b/backend-express/src/features/information/masterDataColumns.ts
index 34eeeb81..c8ff06a9 100644
--- a/backend-express/src/features/information/masterDataColumns.ts
+++ b/backend-express/src/features/information/masterDataColumns.ts
@@ -79,7 +79,8 @@ export const MASTER_DATA_COLUMNS: readonly string[] = [
   'last_action_step_migration_item_date', 'last_action_step_migration_item_name', 'lat_lng',
   // LINE ID（3テーブルとも列あり）
   'line_id',
-  // ⚠️ フォームを埋め込んだページの URL パラメータ。⚠️ master_data にだけ列がある（送られた列だけ使うので、かえる・中古には影響しない）
+  // ⚠️ フォームを埋め込んだページの URL パラメータ。⚠️ url_params は master_data だけ、landing_params は master_data と v2.2.205〜 master_data_kaeru にある
+  //   （送られた列だけ使うので、中古には影響しない）
   'url_params', 'landing_params',
   'memo_developer_application_company', 'memo_fire_insurance', 'memo_ground_survey',
   'memo_lawyer', 'memo_marketing', 'memo_other_related_person', 'memo_site_survey', 'monthly_repayment_amount',
diff --git a/backend-express/src/features/list/queries.ts b/backend-express/src/features/list/queries.ts
index aab50f1d..f951b945 100644
--- a/backend-express/src/features/list/queries.ts
+++ b/backend-express/src/features/list/queries.ts
@@ -135,7 +135,7 @@ const INQUIRY_SQL: Record<ListCategory, string> = {
     SELECT id, inquiry_id, pg_id, inquiry_date, medium, response_medium,
            first_name, last_name, first_name_kana, last_name_kana, mobile, landline, mail, line_id,
            zip, pref, city, town, street, building, brand, shop, sync, staff, area,
-           reserved_date, hp_campaign, duplicate, property, note,
+           reserved_date, hp_campaign, duplicate, property, note, landing_params,
            duplicate_flag, gift_flag, support_flag, black_flag
       FROM inquiry_customer_kaeru
      WHERE first_name <> ''
diff --git a/backend-express/src/features/tracking/conversions.ts b/backend-express/src/features/tracking/conversions.ts
index 920951ad..e800cdab 100644
--- a/backend-express/src/features/tracking/conversions.ts
+++ b/backend-express/src/features/tracking/conversions.ts
@@ -10,6 +10,8 @@ import { UUID_PATTERN } from './params';
  *   ⚠️ 1件の反響が複数のサイトを訪問していれば、それぞれのサイトで1件（サイトごとに見る数字のため）。
  *   ⚠️ どの訪問の手柄にするかは、問い合わせの日までの「そのサイトへの最後の訪問」（ラストクリック）。
  * ⚠️ 反響の日付（inquiry_date）は 'YYYY/MM/DD' の文字列で時刻が無い。⚠️ その日の 23:59:59 までの訪問を「問い合わせ前」とみなす。
+ * ⚠️ v2.2.205 かえるホームの反響（inquiry_customer_kaeru。landing_params は cvMatch.ts が書く）も数える。
+ *   ⚠️ id は表ごとの番号なので、どちらの表の反響か（inquiryTable）と組で見ること。
  * ─────────────────────────────────────────────
  */
 
@@ -17,7 +19,12 @@ export const DAYS = 30;
 /** visitor_id を IN で渡す件数（⚠️ プレースホルダーが増えすぎないよう分ける） */
 const CHUNK = 500;
 
+/** 反響の表（⚠️ 注文と、v2.2.205〜 かえるホーム） */
+export const CV_TABLES = ['inquiry_customer', 'inquiry_customer_kaeru'] as const;
+export type CvTable = (typeof CV_TABLES)[number];
+
 interface InquiryRow extends RowDataPacket {
+  inquiry_table: CvTable;
   id: number;
   inquiry_day: string | null;
   vid: string;
@@ -34,6 +41,8 @@ interface TouchRow extends RowDataPacket {
 }
 
 export interface Conversion {
+  /** ⚠️ v2.2.205 どちらの表の反響か（inquiryId は表ごとの番号） */
+  inquiryTable: CvTable;
   inquiryId: number;
   /** 反響の日（YYYY-MM-DD） */
   inquiryDay: string;
@@ -48,12 +57,12 @@ export interface Conversion {
 export const attributeConversions = async (siteId?: number): Promise<Map<number, Conversion[]>> => {
   const result = new Map<number, Conversion[]>();
   const inquiries = (await query<InquiryRow>(
-    `SELECT id, DATE_FORMAT(STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d'), '%Y-%m-%d') AS inquiry_day,
-            LOWER(SUBSTRING(landing_params, LOCATE('khg_vid=', landing_params) + 8, 36)) AS vid
-       FROM inquiry_customer
+    CV_TABLES.map((table) => `SELECT '${table}' AS inquiry_table, id, DATE_FORMAT(STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d'), '%Y-%m-%d') AS inquiry_day,
+            CONVERT(LOWER(SUBSTRING(landing_params, LOCATE('khg_vid=', landing_params) + 8, 36)) USING utf8mb4) AS vid
+       FROM ${table}
       WHERE landing_params LIKE '%khg_vid=%'
         AND delete_flag = 0
-        AND STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d') >= CURDATE() - INTERVAL ${DAYS} DAY`
+        AND STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d') >= CURDATE() - INTERVAL ${DAYS} DAY`).join(' UNION ALL ')
   )).filter((r) => r.inquiry_day !== null && UUID_PATTERN.test(r.vid));
   if (inquiries.length === 0) return result;
 
@@ -85,7 +94,7 @@ export const attributeConversions = async (siteId?: number): Promise<Map<number,
     for (const [site, touch] of lastBySite) {
       const list = result.get(site) ?? [];
       list.push({
-        inquiryId: Number(inquiry.id), inquiryDay: inquiry.inquiry_day ?? '', landingUrl: touch.landing_url ?? '', source: touch.source ?? '',
+        inquiryTable: inquiry.inquiry_table, inquiryId: Number(inquiry.id), inquiryDay: inquiry.inquiry_day ?? '', landingUrl: touch.landing_url ?? '', source: touch.source ?? '',
         adId: touch.utm_content ?? '', campaign: touch.utm_campaign ?? '',
       });
       result.set(site, list);
diff --git a/backend-express/src/features/tracking/customerPageviews.ts b/backend-express/src/features/tracking/customerPageviews.ts
index 3325e68e..a137e8ac 100644
--- a/backend-express/src/features/tracking/customerPageviews.ts
+++ b/backend-express/src/features/tracking/customerPageviews.ts
@@ -3,12 +3,14 @@ import { query } from '../../db/pool';
 import { UUID_PATTERN, parseLandingParams } from './params';
 
 /**
- * 顧客1人の HP閲覧履歴（v2.2.204）。画面は information/CustomerPageviews.tsx（注文営業の顧客情報）。
+ * 顧客1人の HP閲覧履歴（v2.2.204）。画面は information/CustomerPageviews.tsx（注文営業・v2.2.205〜 建売営業の顧客情報）。
  *
  * ─────────────────────────────────────────────
- * ⚠️ 画面からは顧客の id だけを受け取る。master_data.landing_params の khg_vid を ② で読み、
+ * ⚠️ 画面からは顧客の id（と事業）だけを受け取る。顧客の表の landing_params の khg_vid を ② で読み、
  *   tracking_pageviews の visitor_id と突き合わせる（⚠️ 画面から visitor_id を受け取らない。他人の履歴を引けないように）。
- * ⚠️ 注文（master_data）だけ。建売・中古の顧客の表には landing_params が無い（2026-10-21 の指示で対象外）。
+ * ⚠️ 事業は division で受け取る（order → master_data・spec → master_data_kaeru）。⚠️ 中古の顧客の表には landing_params が無い。
+ *   ⚠️ category という名前で送らないこと（ゲートウェイの鍵に入り、別の request として探される）。
+ * ⚠️ かえるの顧客の landing_params は、反響一覧の「取込」か、② の cvMatch.ts（サイトの CV と反響の突き合わせ）が書く。
  * ⚠️ khg_vid はサイト（ドメイン）ごとの ID。反響を送ったサイトの閲覧だけが出る。
  * ⚠️ 古い行は 6時間ごとの整理で消えるが、有効名簿の人は消さない（maintenance.ts）。
  * ─────────────────────────────────────────────
@@ -29,11 +31,20 @@ interface PageviewRow extends RowDataPacket {
 
 const LIMIT = 500;
 
-export const listCustomerPageviews = async (idValue: unknown): Promise<{ httpStatus: number; body: Record<string, unknown> }> => {
+/** 事業 → 顧客の表。⚠️ 表の名前は SQL に直接入れるので、この対応表の値しか使わない */
+const CUSTOMER_TABLES: Record<string, string> = {
+  order: 'master_data',
+  spec: 'master_data_kaeru',
+};
+
+export const listCustomerPageviews = async (idValue: unknown, divisionValue: unknown = 'order'): Promise<{ httpStatus: number; body: Record<string, unknown> }> => {
   const id = typeof idValue === 'string' ? idValue.trim().slice(0, 100) : '';
   if (id === '') return { httpStatus: 400, body: { status: 'error', message: '顧客が指定されていません。' } };
 
-  const customers = await query<CustomerRow>('SELECT landing_params FROM master_data WHERE id = ? LIMIT 1', [id]);
+  const table = CUSTOMER_TABLES[typeof divisionValue === 'string' && divisionValue !== '' ? divisionValue : 'order'];
+  if (table === undefined) return { httpStatus: 400, body: { status: 'error', message: '事業の指定が違います。' } };
+
+  const customers = await query<CustomerRow>(`SELECT landing_params FROM ${table} WHERE id = ? LIMIT 1`, [id]);
   const visitorId = (parseLandingParams(customers[0]?.landing_params).khg_vid ?? '').toLowerCase();
   if (!UUID_PATTERN.test(visitorId)) {
     return { httpStatus: 200, body: { status: 'ok', linked: false, pageviews: [], limit: LIMIT } };
diff --git a/backend-express/src/features/tracking/detail.ts b/backend-express/src/features/tracking/detail.ts
index 3a03378a..3a804643 100644
--- a/backend-express/src/features/tracking/detail.ts
+++ b/backend-express/src/features/tracking/detail.ts
@@ -2,7 +2,7 @@ import type { RowDataPacket } from 'mysql2/promise';
 import { query } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
 import { isMetaConfigured } from '../metaAds/importer';
-import { attributeConversions, DAYS, type Conversion } from './conversions';
+import { attributeConversions, CV_TABLES, DAYS, type Conversion } from './conversions';
 import { AD_TOUCH_SQL } from './params';
 import { canManageTracking, type TrackingResult } from './sites';
 
@@ -234,13 +234,19 @@ export const trackingDetail = async (
   const flow = axis === 'landing' && key !== '' ? await loadPageFlow(siteId, key) : null;
 
   // CV の一覧（⚠️ 個人情報は出さない）
-  const inquiries = cv.length === 0 ? [] : await query<InquiryRow>(
-    `SELECT id, medium, response_medium, hp_campaign, shop FROM inquiry_customer WHERE id IN (${cv.map(() => '?').join(', ')})`,
-    cv.map((c) => c.inquiryId)
-  );
-  const inquiryById = new Map(inquiries.map((r) => [Number(r.id), r]));
+  // ⚠️ v2.2.205 id は表ごとの番号なので、表ごとに引いて「表:id」で探す
+  const inquiryById = new Map<string, InquiryRow>();
+  for (const table of CV_TABLES) {
+    const ids = cv.filter((c) => c.inquiryTable === table).map((c) => c.inquiryId);
+    if (ids.length === 0) continue;
+    const rows = await query<InquiryRow>(
+      `SELECT id, medium, response_medium, hp_campaign, shop FROM ${table} WHERE id IN (${ids.map(() => '?').join(', ')})`,
+      ids
+    );
+    for (const r of rows) inquiryById.set(`${table}:${Number(r.id)}`, r);
+  }
   const cvList = cv.map((c) => {
-    const r = inquiryById.get(c.inquiryId);
+    const r = inquiryById.get(`${c.inquiryTable}:${c.inquiryId}`);
     return {
       day: c.inquiryDay,
       medium: r?.response_medium || r?.medium || '',
diff --git a/backend-express/src/features/tracking/maintenance.ts b/backend-express/src/features/tracking/maintenance.ts
index b38db42e..fbf55966 100644
--- a/backend-express/src/features/tracking/maintenance.ts
+++ b/backend-express/src/features/tracking/maintenance.ts
@@ -7,8 +7,8 @@ import { logger } from '../../utils/logger';
  *
  * ─────────────────────────────────────────────
  * 1. 消さない顧客ID（tracking_keep_visitors）を足す
- *    - cv：反響（inquiry_customer.landing_params）に khg_vid がある人
- *    - master：有効名簿（master_data.landing_params）に khg_vid がある人（MA 用。2026-10-21 の指示）
+ *    - cv：反響（inquiry_customer・v2.2.205〜 inquiry_customer_kaeru の landing_params）に khg_vid がある人
+ *    - master：有効名簿（master_data・v2.2.205〜 master_data_kaeru の landing_params）に khg_vid がある人（MA 用。2026-10-21 の指示）
  * 2. tracking_pageviews が PAGEVIEW_CAP 行を超えていたら、新しい PAGEVIEW_CAP 行より古い行のうち、
  *    消さない顧客ID に無い人の行を消す（⚠️ 一度に DELETE_CHUNK 行ずつ。DB を長く止めないため）
  * ⚠️ 消さない人の行は上限に関係なく残る。⚠️ 増えすぎていないかは手順書の確認の SQL で見る。
@@ -33,7 +33,8 @@ export interface MaintenanceResult {
 /** ⚠️ cap は確かめるときだけ小さくして渡す（ふだんは PAGEVIEW_CAP） */
 export const runTrackingMaintenance = async (cap: number = PAGEVIEW_CAP): Promise<MaintenanceResult> => {
   let kept = 0;
-  for (const [table, reason] of [['inquiry_customer', 'cv'], ['master_data', 'master']] as const) {
+  // ⚠️ v2.2.205 かえるホームの反響（cvMatch.ts が landing_params を書く）と顧客も残す
+  for (const [table, reason] of [['inquiry_customer', 'cv'], ['inquiry_customer_kaeru', 'cv'], ['master_data', 'master'], ['master_data_kaeru', 'master']] as const) {
     const result = await execute(
       `INSERT IGNORE INTO tracking_keep_visitors (visitor_id, reason)
        SELECT DISTINCT CONVERT(${VID_SQL} USING utf8mb4), '${reason}'
diff --git a/backend-express/src/features/tracking/publicRouter.ts b/backend-express/src/features/tracking/publicRouter.ts
index 8d828112..51e87e6a 100644
--- a/backend-express/src/features/tracking/publicRouter.ts
+++ b/backend-express/src/features/tracking/publicRouter.ts
@@ -3,6 +3,7 @@ import path from 'path';
 import express, { type NextFunction, type Request, type Response, Router } from 'express';
 import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
 import { logger } from '../../utils/logger';
+import { recordConversion } from './conversion';
 import { recordPageview } from './pageview';
 import { isKnownOrigin, recordTouch } from './touch';
 
@@ -12,6 +13,8 @@ import { isKnownOrigin, recordTouch } from './touch';
  *   GET  /t/v1/tracker.js    … 各ブランドサイトのフッターに貼るスクリプト（public/tracker.js）
  *   POST /api/track/touch    … 着地の記録（tracker.js が sendBeacon で送る）
  *   POST /api/track/pv       … ページの閲覧（v2.2.203。tracker.js がページを開くたびに送る。pageview.ts）
+ *   GET  /t/v1/cv.js         … 自社のフォームでないサイトの CV（v2.2.205。public/cv.js。GTM で入れる）
+ *   POST /api/track/cv       … その CV（メール・電話のハッシュ。conversion.ts。反響との突き合わせは cvMatch.ts）
  *
  * ─────────────────────────────────────────────
  * ⚠️⚠️ **app.ts で全体の CORS より前に置くこと。**
@@ -27,12 +30,12 @@ import { isKnownOrigin, recordTouch } from './touch';
  * 配信する中身。⚠️ 起動時に1回だけ読む。⚠️ 行頭の // の行と字下げを落として小さくする（5KB 以内の目安）。
  * ⚠️ 読めなければ 404 にする（⚠️ サイトの表示には影響しない）。
  */
-const loadTracker = (): string | null => {
+const loadScript = (file: string): string | null => {
   try {
-    const source = readFileSync(path.resolve(process.cwd(), 'public/tracker.js'), 'utf8');
+    const source = readFileSync(path.resolve(process.cwd(), 'public', file), 'utf8');
     return source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('//')).join('\n');
   } catch (error) {
-    logger.error(`tracker.js を読めません: ${(error as Error).message}`);
+    logger.error(`${file} を読めません: ${(error as Error).message}`);
     return null;
   }
 };
@@ -66,6 +69,19 @@ const pageviewLimiter = rateLimit({
   },
 });
 
+/** v2.2.205 CV は同じ IP から1分に30件まで（⚠️ 超えても 204） */
+const cvLimiter = rateLimit({
+  windowMs: 60_000,
+  limit: 30,
+  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
+  standardHeaders: false,
+  legacyHeaders: false,
+  handler: (req: Request, res: Response) => {
+    logger.info(`track/cv: 保存しません（流量の上限） origin="${req.get('origin') ?? ''}"`);
+    res.status(204).end();
+  },
+});
+
 /** 許可したオリジンにだけ ACAO を返す。⚠️ credentials は使わない */
 const trackingCors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
   const origin = req.get('origin') ?? '';
@@ -98,17 +114,18 @@ const readBody = (raw: unknown): unknown => {
 
 export const createTrackingPublicRouter = (): Router => {
   const router = Router();
-  const tracker = loadTracker();
-
-  router.get('/t/v1/tracker.js', (_req, res) => {
-    if (tracker === null) {
-      res.status(404).end();
-      return;
-    }
-    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
-    res.setHeader('Cache-Control', 'public, max-age=3600');
-    res.send(tracker);
-  });
+  for (const file of ['tracker.js', 'cv.js']) {
+    const script = loadScript(file);
+    router.get(`/t/v1/${file}`, (_req, res) => {
+      if (script === null) {
+        res.status(404).end();
+        return;
+      }
+      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
+      res.setHeader('Cache-Control', 'public, max-age=3600');
+      res.send(script);
+    });
+  }
 
   router.options('/api/track/touch', trackingCors);
   router.post(
@@ -157,5 +174,26 @@ export const createTrackingPublicRouter = (): Router => {
     res.status(204).end();
   });
 
+  // v2.2.205 自社のフォームでないサイトの CV（⚠️ 着地と同じ CORS・応答は常に 204）
+  router.options('/api/track/cv', trackingCors);
+  router.post(
+    '/api/track/cv',
+    trackingCors,
+    cvLimiter,
+    express.text({ type: () => true, limit: '16kb' }),
+    async (req: Request, res: Response) => {
+      try {
+        await recordConversion({ body: readBody(req.body), origin: req.get('origin') ?? '', userAgent: req.get('user-agent') ?? '' });
+      } catch (error) {
+        logger.error(`track/cv: 保存に失敗: ${(error as Error).message}`);
+      }
+      res.status(204).end();
+    }
+  );
+  router.use('/api/track/cv', (error: Error, _req: Request, res: Response, _next: NextFunction) => {
+    logger.info(`track/cv: 保存しません（本文を読めない: ${error.message}）`);
+    res.status(204).end();
+  });
+
   return router;
 };
diff --git a/backend-express/src/features/tracking/sites.ts b/backend-express/src/features/tracking/sites.ts
index e9d6ee09..2a577327 100644
--- a/backend-express/src/features/tracking/sites.ts
+++ b/backend-express/src/features/tracking/sites.ts
@@ -3,6 +3,7 @@ import type { RowDataPacket } from 'mysql2/promise';
 import { execute, query } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
 import { isMetaConfigured } from '../metaAds/importer';
+import { CV_TARGETS } from './conversion';
 import { attributeConversions } from './conversions';
 import { AD_TOUCH_SQL } from './params';
 import { clearTrackingSiteCache, normalizeOrigin, parseOrigins } from './touch';
@@ -48,6 +49,8 @@ const fail = (httpStatus: number, message: string): TrackingResult => ({ httpSta
 /**
  * 一覧（⚠️ 運用の確認用に、直近30日の着地数と最後の着地も返す。⚠️ 画面の見出しが「広告からの着地」なので広告の分だけ数える）。
  * ⚠️ v2.2.202 直近30日の CV も返す（数え方は conversions.ts。⚠️ 広告以外の訪問からの CV も含む）。
+ * ⚠️ v2.2.205 CV 用のタグ（cv.js）を使うブランドのサイトは、直近30日に cv.js が送った件数と、反響に結びついた件数も返す（cvForm）。
+ *   ⚠️ 送っているのに結びつかないなら、フォームの入力欄の名前が変わったなど（cvMatch.ts）。⚠️ 表がまだ無い＝① に SQL を流す前なら 0。
  */
 export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promise<TrackingResult> => {
   if (!canManageTracking(staff)) return fail(403, 'この画面は管理者だけが使えます。');
@@ -56,6 +59,12 @@ export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promi
   const lastImport = await query<RowDataPacket & { at: string | null }>("SELECT DATE_FORMAT(MAX(imported_at), '%Y-%m-%d %H:%i') AS at FROM meta_ad_items")
     .then((r) => r[0]?.at ?? null)
     .catch(() => null);
+  const cvForm = await query<RowDataPacket & { site_id: number; sent: number; matched: number }>(
+    `SELECT site_id, COUNT(*) AS sent, SUM(matched_at IS NOT NULL) AS matched
+       FROM tracking_conversions WHERE created_at >= NOW() - INTERVAL 30 DAY GROUP BY site_id`
+  )
+    .then((r) => new Map(r.map((x) => [Number(x.site_id), { sent: Number(x.sent), matched: Number(x.matched) }])))
+    .catch(() => new Map<number, { sent: number; matched: number }>());
   const rows = await query<SiteRow>(
     `SELECT s.id, s.site_key, s.name, s.brand, s.allowed_origins, s.is_active, s.memo, s.updated_by,
             DATE_FORMAT(s.updated_at, '%Y-%m-%d %H:%i') AS updated_at,
@@ -71,6 +80,7 @@ export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promi
       id: Number(r.id), siteKey: r.site_key, name: r.name, brand: r.brand ?? '', origins: parseOrigins(r.allowed_origins),
       active: Number(r.is_active) === 1, memo: r.memo, updatedBy: r.updated_by, updatedAt: r.updated_at,
       touches30d: Number(r.touches_30d), lastTouch: r.last_touch, cv30d: conversions.get(Number(r.id))?.length ?? 0,
+      cvForm: CV_TARGETS[r.brand ?? ''] === undefined ? null : cvForm.get(Number(r.id)) ?? { sent: 0, matched: 0 },
     })),
   });
 };
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 78af2929..de5c5ac8 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -892,11 +892,11 @@ register({
 
 register({
   request: 'customer_pageviews',
-  summary: '顧客1人の HP閲覧履歴（master_data.landing_params の khg_vid → tracking_pageviews。注文の顧客のみ）',
+  summary: '顧客1人の HP閲覧履歴（顧客の landing_params の khg_vid → tracking_pageviews。division: order（既定）／spec）',
   phpSource: '（新規。PHP版なし）',
   auth: 'staff',
   handler: async (ctx) => {
-    const result = await listCustomerPageviews(ctx.body.id);
+    const result = await listCustomerPageviews(ctx.body.id, ctx.body.division);
     if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
     return result.body;
   },
diff --git a/backend-express/src/server.ts b/backend-express/src/server.ts
index 7da9d8f1..5296c4d8 100644
--- a/backend-express/src/server.ts
+++ b/backend-express/src/server.ts
@@ -2,6 +2,7 @@ import { createApp } from './app';
 import { env } from './config/env';
 import { closePool, pingDatabase } from './db/pool';
 import { startMetaAdsScheduler } from './features/metaAds/scheduler';
+import { startCvMatch } from './features/tracking/cvMatch';
 import { startTrackingMaintenance } from './features/tracking/maintenance';
 import { gatewaySummary, logGatewayRoutes } from './gateway';
 import { logger } from './utils/logger';
@@ -34,6 +35,8 @@ const bootstrap = async (): Promise<void> => {
     startMetaAdsScheduler();
     // アクセス解析の表の整理（v2.2.203。消さない顧客ID の追加・閲覧の古い行の削除）
     startTrackingMaintenance();
+    // 自社のフォームでないサイトの CV と反響の突き合わせ（v2.2.205。5分ごと）
+    startCvMatch();
   });
 
   // 重い集計SQLの途中で切断されないよう、既定より長めに設定する
diff --git a/backend/scripts/guide/articles/common/screen-200.md b/backend/scripts/guide/articles/common/screen-200.md
index e0dd6455..f39f00ca 100644
--- a/backend/scripts/guide/articles/common/screen-200.md
+++ b/backend/scripts/guide/articles/common/screen-200.md
@@ -85,6 +85,18 @@ summary: 各ブランドサイトのタグの発行と、着地ページ・流
 
 > 注意：GTM の中で、タグごとに動くサイトを分けてください（自社のサイト用のタグは自社のサイトだけ、見学クラウド用のタグは見学クラウドだけ）。分けないと、別のサイトのタグが動いてしまいます。
 
+## 自社のフォームでないサイト（かえるホーム）
+かえるホームのサイトは、問い合わせのフォームを制作会社が作っていて、顧客IDをフォームに載せられません。そこで、別のタグで問い合わせを反響に結びつけます。
+- サイトのブランドを「かえるホーム」にして登録すると、「タグ」に3つ目の「**CV 用**」が出ます
+- 「GTM 用」と「CV 用」の**両方**を、サイトの GTM に入れます（どちらもトリガーは「All Pages」）
+- お客様がフォームで「確認画面へ」を押すと、入力したメールアドレスと電話番号を**読めない形（暗号のような文字列）**に変えて送ります。メールアドレスや電話番号そのものは送りません
+- 反響が届くと、5分ごとに同じ方法で変えた反響のメールアドレス・電話番号と比べ、一致したら反響とサイトの閲覧を結びつけます。結びついた反響は、上の CV にも入ります
+- 一覧の CV の下に「**フォーム送信 ○件（結びつき ○件）**」が出ます
+
+> 注意：フォーム送信があるのに結びつきが増えないときは、フォームの入力欄の名前が変わった、反響が届いていない、などが考えられます。システムの担当者に知らせてください。
+
+> 注意：確認画面で止めた人の分は、反響が来ないので結びつきません。14日たったら消えます。
+
 ## 止める
 - 「直す」で「有効」を外すと、記録を止めます。タグを貼ったままでもサイトの表示やフォームには影響しません
 - サイトは消せません（記録が残るため）
diff --git a/backend/scripts/guide/articles/spec/screen-020.md b/backend/scripts/guide/articles/spec/screen-020.md
index 9f0d8d1e..f40a0f17 100644
--- a/backend/scripts/guide/articles/spec/screen-020.md
+++ b/backend/scripts/guide/articles/spec/screen-020.md
@@ -14,9 +14,22 @@ summary: お客様の検索と、商談ステップ・ステータス・ラン
 - **追客状況**：追客中（A〜D）／追客終了（E〜H）
 - 店舗・担当・反響月・媒体・氏名・電話など
 
-## 閉じている欄（「編集」）
-顧客情報の架電状況・商談ステップ・反響内容の欄は、はじめは閉じています。
+## 閉じている欄（「編集」「閲覧」）
+顧客情報の架電状況・商談ステップ・備考・HP閲覧履歴の欄は、はじめは閉じています。
 - 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています
-- 左の **編集** を押すか、薄くなっている部分を押すと開きます。閉じるときは **×閉じる**
+- 左の **編集**（HP閲覧履歴は **閲覧**）を押すか、薄くなっている部分を押すと開きます。閉じるときは **×閉じる**
 
 > 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。
+
+## HP閲覧履歴
+備考のすぐ下の欄です。そのお客様が、かえるホームのサイトで**どのページを、いつ見たか**が出ます。
+- 上に、訪問の回数・見たページの数・最後に見た日時が出ます
+- 訪問（30分以上あくと別の訪問）ごとにまとまり、新しい訪問が上です。訪問の中は見た順に並びます
+- ページの名前を押すと、そのページが別のタブで開きます
+- 欄が出るのは、サイトの問い合わせ（会員登録・来場予約など）と結びついたお客様だけです。結びつけ方は [[アクセス解析]] の「自社のフォームでないサイト」を見てください
+
+> 注意：結びつくのは、サイトのフォームに入力したメールアドレスか電話番号が、反響と同じだったときだけです。また、出るのはタグを入れた日からの閲覧だけです。
+
+> 注意：反響一覧で取り込む前に結びついた反響は、取り込むと顧客にも引き継がれます。取り込んだあとに結びついた場合も、自動で顧客に書き込みます。
+
+> 要確認：お客様に閲覧履歴の話をそのまま伝えるかどうかは、社内のルールに従ってください。
diff --git a/backend/src/handlers/listAction/list_spec.php b/backend/src/handlers/listAction/list_spec.php
index a84021aa..a59fb42c 100644
--- a/backend/src/handlers/listAction/list_spec.php
+++ b/backend/src/handlers/listAction/list_spec.php
@@ -44,7 +44,7 @@ $response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);
 // 反響一覧
 $sql_inquiry = "SELECT id, inquiry_id, pg_id, inquiry_date, medium, response_medium, first_name, last_name,
         first_name_kana, last_name_kana, mobile, landline, mail, line_id, zip, pref, city, town, street, building, brand, shop, sync, staff, area, 
-        reserved_date, hp_campaign, duplicate, property, note,
+        reserved_date, hp_campaign, duplicate, property, note, landing_params,
         duplicate_flag, gift_flag, support_flag, black_flag
         FROM inquiry_customer_kaeru WHERE first_name <> '' ORDER By inquiry_date DESC";
 $stmt_inquiry = $pdo->prepare($sql_inquiry);
diff --git a/frontend/src/components/header/InquiryAmbassador.tsx b/frontend/src/components/header/InquiryAmbassador.tsx
index e44d2638..12998851 100644
--- a/frontend/src/components/header/InquiryAmbassador.tsx
+++ b/frontend/src/components/header/InquiryAmbassador.tsx
@@ -109,6 +109,17 @@ const ambassadorLabel = (item: Inquiry): string =>
         .filter(v => v !== '')
         .join(' / ');
 
+/**
+ * 画面の余白（v2.2.205）。⚠️ 左右は画面の幅に合わせて 16〜48px。⚠️ セルは上下 10px・左右 14px（Bootstrap の既定 0.5rem では詰まって見える）
+ * ⚠️ 表は横に長い（16列）ので、列の幅の合計に余白の分を足して minWidth を 2400px にしている
+ */
+const IA_CSS = `
+.ia_wrap { padding: 20px clamp(16px, 3vw, 48px) 32px; }
+.ia_table_wrap { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06); }
+.ia_table > :not(caption) > * > th { padding: 12px 14px; font-size: 12px; letter-spacing: .4px; }
+.ia_table > :not(caption) > * > td { padding: 10px 14px; line-height: 1.6; }
+`;
+
 export const InquiryAmbassador = () => {
     const [list, setList] = useState<Inquiry[]>([]);
     const [loading, setLoading] = useState(true);
@@ -399,7 +410,9 @@ export const InquiryAmbassador = () => {
         //   そちらの Modal.Body は `p-0`（縦を使い切るため）なので、
         //   何も付けないとテーブルが画面の端に貼り付いて読みにくい。
         //   ⚠️ Header.tsx 側に余白を足すと**他の全画面メニューにも効く**ので触らない。
-        <div className="py-3 px-4">
+        <div className="ia_wrap">
+            {/* ⚠️ v2.2.205 表の余白（2026-10-21 の指示「横幅いっぱいで見づらい」）。⚠️ この画面だけに効くよう接頭辞 ia_ */}
+            <style>{IA_CSS}</style>
             <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
                 <span className="fw-bold" style={{ fontSize: '14px' }}>
                     <i className="fa-brands fa-instagram me-2 text-danger" aria-hidden="true" />
@@ -496,8 +509,8 @@ export const InquiryAmbassador = () => {
                     </div>
                 </div>
             ) : (
-                <div className="table-responsive border rounded" style={{ maxHeight: '65vh' }}>
-                    <Table hover bordered className="mb-0 align-middle text-nowrap" style={{ fontSize: '12px', minWidth: '2040px' }}>
+                <div className="table-responsive border rounded ia_table_wrap" style={{ maxHeight: '65vh' }}>
+                    <Table hover bordered className="mb-0 align-middle text-nowrap ia_table" style={{ fontSize: '12px', minWidth: '2400px' }}>
                         <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                             <tr>
                                 <th className="bg-light text-center" style={{ width: '90px' }}>同期</th>
@@ -507,6 +520,9 @@ export const InquiryAmbassador = () => {
                                 <th className="bg-light" style={{ width: '130px' }}>電話番号</th>
                                 <th className="bg-light" style={{ width: '190px' }}>メールアドレス</th>
                                 <th className="bg-light" style={{ width: '260px' }}>住所</th>
+                                {/* ⚠️ v2.2.205 紹介アンバサダーのインスタのアカウント（反響が届いた時点の値。inquiry_ambassador.account。2026-10-21 の指示で住所の右に）
+                                    ⚠️ 右の「紹介アンバサダー」は台帳の今の値。アカウント名を変えていると食い違う */}
+                                <th className="bg-light" style={{ width: '140px' }}>アカウント</th>
                                 {/* ⚠️ 住所とは別。担当店舗の割り振りはここを見て決める */}
                                 <th className="bg-light" style={{ width: '160px' }}>建築希望地</th>
                                 {/* ⚠️ お客様本人の記入。連絡時間の希望などが入る */}
@@ -574,6 +590,8 @@ export const InquiryAmbassador = () => {
                                             {item.zip ? <span className="text-muted me-1">{item.zip}</span> : null}
                                             {item.address ?? ''}
                                         </td>
+                                        {/* ⚠️ 値に @ は入っていない（紹介アンバサダーの欄と同じく @ を付けて出す）。未入力なら何も出さない */}
+                                        <td>{item.account ? `@${item.account}` : ''}</td>
 
                                         <td style={{ whiteSpace: 'normal' }}>{item.build_area ?? ''}</td>
 
@@ -700,7 +718,7 @@ export const InquiryAmbassador = () => {
 
                             {filtered.length === 0 && (
                                 <tr>
-                                    <td colSpan={15} className="text-center text-muted py-5">
+                                    <td colSpan={16} className="text-center text-muted py-5">
                                         該当する反響がありません
                                     </td>
                                 </tr>
diff --git a/frontend/src/components/header/TrackingSettings.tsx b/frontend/src/components/header/TrackingSettings.tsx
index 16070c2c..a898b84d 100644
--- a/frontend/src/components/header/TrackingSettings.tsx
+++ b/frontend/src/components/header/TrackingSettings.tsx
@@ -14,6 +14,9 @@ import TrackingDetail, { type DetailAxis } from './TrackingDetail';
  * ⚠️ v2.2.202 サイト名を押すと、その行の下にサマリー（SiteSummary）が開く。⚠️ 開閉はサイトごと（ほかのサイトと連動しない）。
  *   ⚠️ サマリーは開いたときに取りに行く（tracking_site_summary。② は features/tracking/summary.ts）。⚠️「再読み込み」で一覧と開いているサマリーを取り直す。
  *   ⚠️ CV の数え方は ② の features/tracking/conversions.ts（直近30日の反響の khg_vid が、問い合わせの日までにそのサイトに来ていたもの）。
+ * ⚠️ v2.2.205 自社のフォームでないサイト（かえるホーム）は、CV 用のタグ（cv.js。cvGtmTag）も出す。② が cvForm を返すサイトだけ。
+ *   ⚠️ cv.js は「確認画面へ」でメール・電話のハッシュを送り、② が反響と突き合わせる（features/tracking/cvMatch.ts）。
+ *   ⚠️ 一覧の CV の下に「フォーム送信 n件（結びつき m件）」。送っているのに結びつかないなら、フォームの入力欄の名前が変わったなど。
  * ⚠️ v2.2.203 サマリーの着地ページ・流入元を押すと、詳細のモーダル（TrackingDetail.tsx）が開く。着地ページは右のアイコンでそのページを開く。
  *   ⚠️ 上の「Meta から取り込む」は ② の meta_ads_import（待たずに返る。終わったかは「最後の取り込み」で見る）。⚠️ ② は6時間ごとにも自動で取り込む。
  * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
@@ -24,19 +27,24 @@ import TrackingDetail, { type DetailAxis } from './TrackingDetail';
 
 export const TRACKER_URL = 'https://api.khg-marketing.info/t/v1/tracker.js';
 export const trackingTag = (siteKey: string): string => `<script src="${TRACKER_URL}" data-site="${siteKey}" defer></script>`;
-export const gtmTag = (siteKey: string): string => [
+/** GTM 用。⚠️ src を差し替えて CV 用（cv.js）にも使う */
+const gtmScriptTag = (src: string, siteKey: string): string => [
     '<script>',
     '(function () {',
     "  var s = document.createElement('script');",
-    `  s.src = '${TRACKER_URL}';`,
+    `  s.src = '${src}';`,
     '  s.defer = true;',
     `  s.setAttribute('data-site', '${siteKey}');`,
     '  document.body.appendChild(s);',
     '})();',
     '</script>',
 ].join('\n');
+export const gtmTag = (siteKey: string): string => gtmScriptTag(TRACKER_URL, siteKey);
+/** v2.2.205 自社のフォームでないサイトの CV 用（tracker.js と一緒に、GTM の All Pages で入れる） */
+export const CV_URL = 'https://api.khg-marketing.info/t/v1/cv.js';
+export const cvGtmTag = (siteKey: string): string => gtmScriptTag(CV_URL, siteKey);
 
-type TagKind = 'gtm' | 'footer';
+type TagKind = 'gtm' | 'footer' | 'cv';
 const TAG_KINDS: { kind: TagKind; label: string; make: (siteKey: string) => string }[] = [
     { kind: 'gtm', label: 'GTM 用：GTM（Googleタグマネージャー）のカスタム HTML に入れるタグ（トリガーは「All Pages」）', make: gtmTag },
     { kind: 'footer', label: 'フッター用：GTM を使わず、すべてのページのフッターに直接貼るタグ', make: trackingTag },
@@ -61,6 +69,8 @@ interface Site {
     touches30d: number;
     lastTouch: string | null;
     cv30d: number;
+    /** v2.2.205 CV 用のタグ（cv.js）の直近30日の送信・反響に結びついた件数。⚠️ CV 用のタグを使わないブランドは null */
+    cvForm: { sent: number; matched: number } | null;
 }
 
 interface Draft {
@@ -437,7 +447,10 @@ const TrackingSettings: React.FC = () => {
                                         <td className="tk_td">{s.origins.map((o) => <div key={o} className="tk_origin">{o}</div>)}</td>
                                         <td className="tk_td"><span className={`tk_state${s.active ? ' is_on' : ''}`}>{s.active ? '有効' : '無効'}</span></td>
                                         <td className="tk_td tk_num">{s.touches30d.toLocaleString()}</td>
-                                        <td className="tk_td tk_num">{s.cv30d.toLocaleString()}</td>
+                                        <td className="tk_td tk_num">
+                                            {s.cv30d.toLocaleString()}
+                                            {s.cvForm && <div className="tk_sub">フォーム送信 {s.cvForm.sent.toLocaleString()}件（結びつき {s.cvForm.matched.toLocaleString()}件）</div>}
+                                        </td>
                                         <td className="tk_td tk_date">{s.lastTouch ?? '—'}</td>
                                         <td className="tk_td tk_date">{s.updatedAt}{s.updatedBy && <div className="tk_sub">{s.updatedBy}</div>}</td>
                                         <td className="tk_td tk_actions">
@@ -470,7 +483,23 @@ const TrackingSettings: React.FC = () => {
                                                         </div>
                                                     );
                                                 })}
-                                                <div className="tk_sub">どちらか一方だけ入れてください（両方あると着地が2回記録されます）。サイトキー：{s.siteKey}（公開される識別子です。パスワードではありません）</div>
+                                                {s.cvForm && (() => {
+                                                    const key = `${s.id}:cv`;
+                                                    const text = cvGtmTag(s.siteKey);
+                                                    return (
+                                                        <div className="tk_tag_block">
+                                                            <div className="tk_label">CV 用：自社のフォームでないサイトの問い合わせを反響と結びつけるタグ（GTM のカスタム HTML・トリガーは「All Pages」。上の GTM 用と一緒に入れる）</div>
+                                                            <div className="tk_code_row">
+                                                                <code className="tk_code" onClick={(e) => window.getSelection()?.selectAllChildren(e.currentTarget)}>{text}</code>
+                                                                <button type="button" className="tk_btn is_primary" onClick={() => copy(s, 'cv', text)}>
+                                                                    {copied === key ? 'コピーしました' : 'コピー'}
+                                                                </button>
+                                                            </div>
+                                                            {copied === `!${key}` && <div className="tk_error">コピーできませんでした。タグを押して選び、Ctrl+C でコピーしてください。</div>}
+                                                        </div>
+                                                    );
+                                                })()}
+                                                <div className="tk_sub">GTM 用とフッター用は、どちらか一方だけ入れてください（両方あると着地が2回記録されます）。サイトキー：{s.siteKey}（公開される識別子です。パスワードではありません）</div>
                                             </td>
                                         </tr>
                                     )}
diff --git a/frontend/src/components/information/CustomerPageviews.tsx b/frontend/src/components/information/CustomerPageviews.tsx
index 99bd96be..12018ebd 100644
--- a/frontend/src/components/information/CustomerPageviews.tsx
+++ b/frontend/src/components/information/CustomerPageviews.tsx
@@ -3,6 +3,7 @@ import apiClient from '../../utils/apiClient';
 
 /**
  * 顧客情報の「HP閲覧履歴」（v2.2.204 新規）。注文営業の顧客情報（InformationEdit.tsx）の商談ステップの上の行。
+ * ⚠️ v2.2.205〜 建売営業（かえるホーム）の顧客情報（InformationEditKaeru.tsx）の備考の下の行にも出す（division='spec'）。
  *
  * ─────────────────────────────────────────────
  * ⚠️ ② の customer_pageviews（features/tracking/customerPageviews.ts）。顧客の id だけを送り、
@@ -30,6 +31,8 @@ interface Visit {
 interface Props {
     /** 顧客の id。⚠️ 新規の顧客は空 */
     customerId: string;
+    /** 事業（v2.2.205）。⚠️ ② は category ではなく division で受け取る（category はゲートウェイの鍵に入るため） */
+    division?: 'order' | 'spec';
 }
 
 const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
@@ -48,7 +51,7 @@ const pathOf = (url: string): string => {
     try { return decodeURI(new URL(url).pathname); } catch { return url; }
 };
 
-const CustomerPageviews = ({ customerId }: Props) => {
+const CustomerPageviews = ({ customerId, division = 'order' }: Props) => {
     const [state, setState] = useState<'loading' | 'error' | 'unlinked' | 'ok'>('loading');
     const [pageviews, setPageviews] = useState<Pageview[]>([]);
     const [limit, setLimit] = useState(0);
@@ -57,7 +60,7 @@ const CustomerPageviews = ({ customerId }: Props) => {
         if (!customerId) { setState('unlinked'); setPageviews([]); return; }
         let alive = true;
         setState('loading');
-        apiClient.post('', { request: 'customer_pageviews', id: customerId })
+        apiClient.post('', { request: 'customer_pageviews', id: customerId, division })
             .then((res) => {
                 if (!alive) return;
                 setPageviews(res.data.pageviews ?? []);
@@ -69,7 +72,7 @@ const CustomerPageviews = ({ customerId }: Props) => {
                 if (alive) setState('error');
             });
         return () => { alive = false; };
-    }, [customerId]);
+    }, [customerId, division]);
 
     /** 新しい訪問が上。⚠️ ② は新しい順で返すので、同じ訪問の行は続いて並ぶ */
     const visits = useMemo(() => {
diff --git a/frontend/src/components/information/InformationEditKaeru.tsx b/frontend/src/components/information/InformationEditKaeru.tsx
index efc87a5b..b51709a7 100644
--- a/frontend/src/components/information/InformationEditKaeru.tsx
+++ b/frontend/src/components/information/InformationEditKaeru.tsx
@@ -25,6 +25,7 @@ import TableStatus from './TableStatus';
 import TableMedium from './TableMedium';
 import TableCompetitor from './TableCompetitor';
 import TableCompetitorPdf from './TableCompetitorPdf';
+import CustomerPageviews from './CustomerPageviews';
 import { calculateAge } from '../../utils/informationUtils';
 import { dateFormate } from '../../utils/informationUtils';
 import { useIsSp } from '../../utils/isSp';
@@ -75,7 +76,8 @@ type Expand = {
     call: boolean,
     remarks: boolean,
     reason: boolean,
-    trigger: boolean
+    trigger: boolean,
+    history: boolean
 };
 
 type Props = {
@@ -167,7 +169,8 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
         call: false,
         remarks: false,
         reason: false,
-        trigger: false
+        trigger: false,
+        history: false
     });
     const propertyRef = useRef<HTMLInputElement>(null);
 
@@ -647,7 +650,8 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
             call: false,
             remarks: false,
             reason: false,
-            trigger: false
+            trigger: false,
+            history: false
         });
 
         setInformation({});
@@ -1096,6 +1100,30 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
                                         </td>
                                         <td></td><td></td>
                                     </tr>
+                                    {/* ⚠️ v2.2.205: その顧客が自社サイト（かえるホーム）で見たページ（CustomerPageviews.tsx。注文の顧客情報と同じ）
+                                        ⚠️ landing_params（反響から引き継いだ流入の情報）がある顧客だけ行を出す（2026-10-21 の指示） */}
+                                    {safeFormate(information.landing_params).trim() !== '' && <tr>
+                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
+                                            <div className="position-relative">
+                                                HP閲覧履歴
+                                                <div className='position-absolute'
+                                                    style={buttonStyle}
+                                                    onClick={() => {
+                                                        setExpand(prev =>
+                                                        ({
+                                                            ...prev,
+                                                            history: !prev.history
+                                                        })
+                                                        );
+                                                    }}>{expand.history ? '×閉じる' : '閲覧'}</div>
+                                            </div>
+                                        </td>
+                                        <td colSpan={3} style={{ verticalAlign: 'top', paddingTop: '25px' }}>
+                                            <div {...expandProps('history')}>
+                                                <CustomerPageviews customerId={id === 'new' ? '' : information.id ?? ''} division='spec' />
+                                            </div>
+                                        </td>
+                                    </tr>}
                                 </tbody>
                             </Table>
                             <Table>
diff --git a/frontend/src/components/list/ListKaeru.tsx b/frontend/src/components/list/ListKaeru.tsx
index a58c6a83..ebefcf0f 100644
--- a/frontend/src/components/list/ListKaeru.tsx
+++ b/frontend/src/components/list/ListKaeru.tsx
@@ -9,7 +9,7 @@ import { generateULID } from '../../utils/createULID';
 import Modal from 'react-bootstrap/Modal';
 import { setStyleClassSpec } from '../../utils/setStyleClassSpec';
 import { thisYear } from '../../utils/thisYear';
-import { dateFormate, monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField } from './listUtils';
+import { dateFormate, monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField, filledField } from './listUtils';
 import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './listTags';
 import type { TagKey } from './listTags';
 import { kataToHira } from '../../utils/kataToHira';
@@ -343,6 +343,8 @@ const ListKaeru = ({ onReload }: Props) => {
                 customer_contacts_mobile_phone_number: phone_number_2,
                 customer_contacts_email: filteredCustomer.mail || '',
                 ...lineIdField(filteredCustomer.line_id),
+                // ⚠️ v2.2.205 サイトでの閲覧と結びついた流入の情報（② の cvMatch.ts が反響に書く）。顧客情報の「HP閲覧履歴」が読む
+                ...filledField('landing_params', filteredCustomer.landing_params),
                 postal_code: filteredCustomer.zip || '',
                 full_address: `${filteredCustomer.pref || ''} ${filteredCustomer.city || ''} ${filteredCustomer.town || ''} ${filteredCustomer.street || ''} ${filteredCustomer.building || ''}`,
                 sales_promotion_name: filteredCustomer.response_medium || '',
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 8deebc47..b984de37 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.204';
+export const newVersion = '2.2.205';
```
