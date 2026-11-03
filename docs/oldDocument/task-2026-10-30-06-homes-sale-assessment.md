# 作業記録 2026-10-30-06　LIFULL HOME'S の査定依頼メール → 売り反響（v2.2.236）

## 依頼（ReadMeClaude.md）
- 査定依頼メール（件名【LIFULL HOME'S】＜実名＞査定依頼がありました）の文面を取り込む ② を実装
- brokerage_listings の **売り反響** の顧客として追加。件名・newer_than:1d で取得。重複時のスキップ処理も
  - ⚠️ 依頼のメール本文の見本には実在のお客様の情報が入っているため、この記録・テストには書き写していない（テストは架空のデータ）

## 決めたこと（利用者の回答）
- 重複のスキップ：**同じ査定ID**、または**前後90日に同じ電話番号（数字だけで比べる）の売り反響**がある
  - 同じメールがコールセンター（ミカタ）にも届き、ミカタの明細でも同じお客様が入るため
- GAS のトリガー：5分おき（利用者が設定）

## 調べたこと
- 売り反響 ＝ brokerage_listings の kind = 'leads'。反響元は設定（app_state.settings.sources・srcCosts）が "HOME's"（s が小文字）なので合わせた
  - ⚠️ 一覧の行の反響元の選択肢（LeadSell.tsx の SELL_SOURCES）は "HOME'S"（大文字）。既存の HOME's の51件と同じく、行の選択欄は空に見える（既存の食い違い。今回は直していない）
- extId は UNIQUE。既存の取り込みは 'ieul:'・'sumai:'・'mikata:'・'anken:'（イエイ）など。HOME'S のメールは 'homes:' + 査定ID にした
- 本番アプリの「査定依頼メールを売り反響へ自動登録」（v14.25・既定オフ）と同じく、段階は「リード受信」、住所は先頭の「鹿児島県」を外す

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/realty | **homesAssessment.ts**（新規） | `importHomesAssessment`・`newRecordId`・`toCategory`・`digits`・`buildNote` |
| backend-express/src/gateway | registry.ts | `homes_sale_assessment_entry` を登録（auth: none・合い言葉） |
| backend/src/core | express_proxy.php | `expressProxyRequests()`・`expressProxyExclusive()` に追加 |
| backend/scripts/gas | **HomesSaleAssessmentToDashboard.gs**（新規） | `homesSaleParse`・`homesSaleBuildPayload`・`HomesSaleAssessmentToDashboard` |
| frontend/src/utils | version.ts | 2.2.236 |
| backend/scripts/sql | **2026-10-30_update_log_2.2.236.sql**（新規） | 更新履歴＋業務ガイド |
| backend/scripts/guide/articles/common | screen-245.md | 「HOME'S の査定依頼メールの自動登録」の節を追加 |

## 業務ガイド
- 「売り反響・買い反響の歩留まり（不動産企画係）」：自動登録の節（入る項目・備考・重複の扱い・匿名は入らない）を追加

## 確認（ローカル。架空のメール本文で）
- GAS の読み取り関数をそのまま node で読み込み、本文から24項目を取り出せること（受信日時・Manager の URL・お客様の記入も）。返信・＜匿名＞は送らない
- ② 直接（GAS と同じ経路）：合い言葉なし 401／新規 success／同じメール再送 exists（査定ID）／査定IDだけ違う・電話同じ exists（電話）／別のお客様 success／必須なし 400
- ① 経由：合い言葉なし 401（許可リストに入っている）／新規 success
- 以前の取り込みの書き方（contact「000-9999-0005 / メール」）の行とも、電話番号で重複と判定
- 入った行：kind leads・受信日・反響元 HOME's・リード受信・区分 戸建・理由・時期・電話・メール・連絡先・住所（鹿児島県を外す）・備考・extId・callDates []
- Playwright：売り反響の画面の一覧に出て、反響元別の集計の「HOME's」に入る（反響単価も付く）。ページのエラーなし
- 型チェック・リファクタリング（使っていない export を外した）後に再テスト
- テストの行・テスト用の担当は削除済み。開発サーバー（3100）は停止済み

## コード（全文・差分）

### backend-express/src/features/realty/homesAssessment.ts（新規・全文）
```js
import { randomBytes } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { clean, cleanMultiline } from '../campaignForm/text';
import { keyMatches } from '../memberEntry/entry';

/**
 * LIFULL HOME'S の査定依頼メール → 売り反響（brokerage_listings の kind = leads）。（v2.2.236）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS（backend/scripts/gas/HomesSaleAssessmentToDashboard.gs）。合い言葉は MEMBER_ENTRY_KEY（会員登録の GAS と同じ値）。
 *   ⚠️ 件名「【LIFULL HOME'S】＜実名＞査定依頼がありました」を newer_than:1d で毎回読むので、同じメールが何度も届く。
 * ⚠️⚠️ 重複はスキップ（2026-10-30 の指示）:
 *   1. 外部ID（extId = 'homes:' + 査定ID）が同じ売り反響がある。⚠️ extId は UNIQUE
 *   2. 電話番号（数字だけで比べる）が同じ売り反響が、受信日の前後90日にある
 *      ⚠️ 同じメールがコールセンター（ミカタ）にも届き、あとからミカタの明細でも同じお客様が入るため
 * ⚠️ 反響元は "HOME's"（売り反響の設定の反響元・反響単価のキーと同じ書き方）。⚠️ フェーズは「リード受信」。担当は空（画面で割り当てる）。
 * ⚠️ id は画面（realty/common/leadUtiles.ts の newRecordId）と同じ形（'x' ＋ 時刻の36進 ＋ 乱数）。
 * ─────────────────────────────────────────────
 */

const HOMES_SOURCE = "HOME's";
const PHASE = 'リード受信';
const EXT_PREFIX = 'homes:';
/** 電話番号で重複を見る期間（受信日の前後） */
const PHONE_DUP_DAYS = 90;
const RECEIVED_PATTERN = /^(\d{4})\/(\d{2})\/(\d{2}) \d{2}:\d{2}:\d{2}$/;

export interface HomesAssessmentResult {
  httpStatus: number;
  body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** 画面の newRecordId と同じ形 */
const newRecordId = (): string => `x${Date.now().toString(36)}${randomBytes(4).toString('hex').slice(0, 6)}`;

/** 物件種別 → 売り反響の区分（既存の値：戸建・マンション・住宅用地・その他） */
const toCategory = (type: string): string | null => {
  if (type === '') return null;
  if (/戸建/.test(type)) return '戸建';
  if (/マンション/.test(type)) return 'マンション';
  if (/土地/.test(type)) return '住宅用地';
  return 'その他';
};

/** 全角数字も数字として、数字だけを残す */
const digits = (value: string): string =>
  value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/\D/g, '');

/** 備考（「見出し：値」を改行で並べる。空の項目は入れない） */
const buildNote = (body: Record<string, unknown>, assessmentId: string): string => {
  const pairs: [string, string][] = [
    ['査定ID', assessmentId],
    ['間取り', clean(body.layout, 50)],
    ['建物面積', clean(body.building_area, 50)],
    ['土地面積', clean(body.land_area, 50)],
    ['築年', clean(body.built_year, 80)],
    ['現況', clean(body.current_status, 50)],
    ['名義', clean(body.ownership, 50)],
    ['ご要望', clean(body.wish, 200)],
    ['フリガナ', clean(body.kana, 100)],
    ['ご住所', clean(body.customer_address, 200)],
    ['希望の連絡時間', clean(body.contact_time, 100)],
    ['希望の連絡方法', clean(body.contact_method, 100)],
    ['同時送信社数', clean(body.companies, 30)],
  ];
  const lines = pairs.filter(([, v]) => v !== '').map(([k, v]) => `${k}：${v}`);
  const free = cleanMultiline(body.free_text, 1000).trim();
  if (free !== '') lines.push(`お客様の記入：${free}`);
  const url = clean(body.manager_url, 300);
  if (/^https:\/\/manager\.homes\.co\.jp\//.test(url)) lines.push(`Manager：${url}`);
  return lines.join('\n');
};

interface IdRow extends RowDataPacket {
  id: string;
}

/** 査定依頼メール1通を売り反響として取り込む */
export const importHomesAssessment = async (raw: Record<string, unknown>): Promise<HomesAssessmentResult> => {
  const body = raw ?? {};
  if (!keyMatches(clean(body.key, 200))) {
    if (env.memberEntryKey === '') logger.warn("MEMBER_ENTRY_KEY が未設定のため、HOME'S 査定依頼の取り込みを断りました。");
    return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
  }

  const assessmentId = clean(body.assessment_id, 30);
  const receivedAt = clean(body.received_at, 19);
  const received = RECEIVED_PATTERN.exec(receivedAt);
  const name = clean(body.name, 100).replace(/[\s　]*様$/, '');
  const phone = digits(clean(body.phone, 30));
  const mail = clean(body.mail, 200).replace(/[\s　]/g, '');
  if (!/^\d{1,20}$/.test(assessmentId) || received === null || name === '' || (phone === '' && mail === '')) {
    logger.warn(`homes_sale_assessment_entry: 必要な項目がありません assessment_id="${assessmentId}"`);
    return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
  }
  const receivedDate = `${received[1]}-${received[2]}-${received[3]}`;
  const extId = `${EXT_PREFIX}${assessmentId}`;

  try {
    if ((await query<IdRow>('SELECT id FROM brokerage_listings WHERE extId = ? LIMIT 1', [extId])).length > 0) {
      return { httpStatus: 200, body: { status: 'exists', message: '取り込み済みです（同じ査定ID）。' } };
    }
    // ⚠️ 電話は phone 列と、以前の取り込みの連絡先（contact「電話 / メール」）の両方を数字だけで比べる
    if (phone.length >= 10) {
      const dup = await query<IdRow>(
        `SELECT id FROM brokerage_listings
          WHERE kind = 'leads'
            AND (REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '') = ?
                 OR REGEXP_REPLACE(SUBSTRING_INDEX(COALESCE(contact, ''), '/', 1), '[^0-9]', '') = ?)
            AND COALESCE(receivedDate, DATE(created_at)) BETWEEN DATE_SUB(?, INTERVAL ${PHONE_DUP_DAYS} DAY) AND DATE_ADD(?, INTERVAL ${PHONE_DUP_DAYS} DAY)
          LIMIT 1`,
        [phone, phone, receivedDate, receivedDate]
      );
      if (dup.length > 0) {
        return { httpStatus: 200, body: { status: 'exists', message: `取り込み済みです（同じ電話番号の売り反響が前後${PHONE_DUP_DAYS}日にあります）。` } };
      }
    }

    const id = newRecordId();
    const location = clean(body.location, 200).replace(/^鹿児島県/, '');
    await execute(
      `INSERT INTO brokerage_listings
         (id, kind, receivedDate, source, phase, seller, customer, name, phone, mail, contact,
          addr, category, reason, timing, note, extId, callDates, show_dashboard)
       VALUES (?, 'leads', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 1)`,
      [
        id, receivedDate, HOMES_SOURCE, PHASE, name, name, name,
        phone || null, mail || null, [phone, mail].filter((v) => v !== '').join(' / '),
        location || null, toCategory(clean(body.property_type, 50)),
        clean(body.reason, 100) || null, clean(body.timing, 100) || null,
        buildNote(body, assessmentId), extId,
      ]
    );
    logger.info(`homes_sale_assessment_entry を受け付けました extId="${extId}" id="${id}"`);
    return { httpStatus: 200, body: { status: 'success', message: '売り反響に登録しました。', id } };
  } catch (error) {
    // ⚠️ 同時に2回届いて extId の UNIQUE に当たったときは取り込み済みとして返す
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return { httpStatus: 200, body: { status: 'exists', message: '取り込み済みです（同じ査定ID）。' } };
    }
    logger.error(`homes_sale_assessment_entry: 保存に失敗 extId="${extId}": ${(error as Error).message}`);
    return { httpStatus: 500, body: { status: 'error', message: '保存に失敗しました。' } };
  }
};
```

### backend/scripts/gas/HomesSaleAssessmentToDashboard.gs（新規・全文）
```js
// =====================================================================
// LIFULL HOME'S「不動産売却査定サービス」の査定依頼メール → 売り反響（brokerage_listings の kind = leads）として取り込む（v2.2.236）
//
// ⚠️ 取り込むメール: 件名「【LIFULL HOME'S】＜実名＞査定依頼がありました」（差出人 support@homes.co.jp）
//   ⚠️ 頭の [marketing]: [khr]: はメーリングリストが付けるもの。⚠️ ＜匿名＞の査定依頼（連絡先が無い）は取り込まない。
// ⚠️ トリガー: HomesSaleAssessmentToDashboard を 5分おき。⚠️ 毎回 newer_than:1d（直近1日）を読む。
// ⚠️ 送り先: ② https://api.khg-marketing.info/api/gateway （request: homes_sale_assessment_entry）
//   ⚠️ ① に予備は無い（② が直れば、次の実行で直近1日分を取り込み直す）。
//   ⚠️ 同じ査定ID、または前後90日に同じ電話番号の売り反響があれば ② が入れない（status: exists）。何度送っても二重にならない。
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
// =====================================================================

const HOMES_SALE_URL = 'https://api.khg-marketing.info/api/gateway';
const HOMES_SALE_SUBJECT = "【LIFULL HOME'S】＜実名＞査定依頼がありました";
const HOMES_SALE_QUERY = 'subject:"' + HOMES_SALE_SUBJECT + '" newer_than:1d';

/** 本文の見出し → 送る項目。⚠️ 見出しは 2026-10 のメールの見本から。HOME'S が見出しを変えたら、ここも変えること */
const HOMES_SALE_LABELS = {
  '査定ID（問合せ番号）': 'assessment_id',
  '物件種別': 'property_type',
  '所在地': 'location',
  '間取り': 'layout',
  '建物面積': 'building_area',
  '土地面積': 'land_area',
  '築年': 'built_year',
  '現況': 'current_status',
  '名義': 'ownership',
  '売却理由': 'reason',
  '売却希望時期': 'timing',
  'ご要望': 'wish',
  'お名前': 'name',
  'フリガナ': 'kana',
  'ご住所': 'customer_address',
  '電話番号': 'phone',
  'メールアドレス': 'mail',
  '希望の連絡時間': 'contact_time',
  '希望の連絡方法': 'contact_method',
  '同時送信社数': 'companies'
};

/** 半角・全角の空白を前後から除く */
function homesSaleTrim(text) {
  return String(text || '').replace(/^[\s　]+|[\s　]+$/g, '');
}

/**
 * 本文を読む。⚠️ お客様の情報は ┏ と ┗ の罫線に挟まれた部分だけ（サポートデスクの電話・住所を拾わない）。
 * ⚠️ 見出しと値は全角のコロン（最初のコロンで分ける）。⚠️ 「同時送信社数」より後の行はお客様の自由記入（free_text）。
 * ⚠️ 受信日時は罫線の上の「（受信日時：YYYY/MM/DD HH:MM:SS）」、Manager の URL も罫線の上から拾う。
 */
function homesSaleParse(body) {
  const result = { fields: {}, freeLines: [], receivedAt: '', managerUrl: '' };
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  let inBlock = false;
  let afterCompanies = false;

  for (const line of lines) {
    const trimmed = homesSaleTrim(line);
    if (/^┏/.test(trimmed)) { inBlock = true; continue; }
    if (/^┗/.test(trimmed)) { break; }
    if (!inBlock) {
      const received = trimmed.match(/受信日時[：:]\s*(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
      if (received) result.receivedAt = received[1];
      if (/^https:\/\/manager\.homes\.co\.jp\//.test(trimmed)) result.managerUrl = trimmed;
      continue;
    }
    if (trimmed === '') continue;

    const matched = trimmed.match(/^([^：:]+?)[\s　]*[：:][\s　]*(.*)$/);
    const key = matched ? HOMES_SALE_LABELS[homesSaleTrim(matched[1])] : undefined;
    if (key && !afterCompanies) {
      result.fields[key] = homesSaleTrim(matched[2]);
      if (key === 'companies') afterCompanies = true;
      continue;
    }
    if (afterCompanies) result.freeLines.push(trimmed);
  }
  return result;
}

/** 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 } */
function homesSaleBuildPayload(subject, body, date) {
  const s = String(subject || '');
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };
  if (s.indexOf(HOMES_SALE_SUBJECT) === -1) return { skip: '件名が違う' };

  const parsed = homesSaleParse(body);
  const f = parsed.fields;
  if (!/^\d+$/.test(f.assessment_id || '')) return { skip: '査定IDが読めない' };
  if (!f.name) return { skip: 'お名前が読めない' };
  if (!f.phone && !f.mail) return { skip: '電話もメールも無い' };

  const payload = { request: 'homes_sale_assessment_entry' };
  Object.keys(HOMES_SALE_LABELS).forEach(function (label) {
    const key = HOMES_SALE_LABELS[label];
    if (f[key]) payload[key] = f[key];
  });
  payload.free_text = parsed.freeLines.join('\n');
  payload.manager_url = parsed.managerUrl;
  // ⚠️ 本文の受信日時が読めないときはメールの日時
  payload.received_at = parsed.receivedAt || Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  return payload;
}

// =====================================================================
// ⚠️ メインの実行関数。⚠️ **トリガーはこれを指定する**（5分おき）
// =====================================================================
function HomesSaleAssessmentToDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  const count = { success: 0, exists: 0, skip: 0, error: 0 };
  // ⚠️ search はスレッド単位で返すので、返信などが混ざる。1通ずつ確かめる
  GmailApp.search(HOMES_SALE_QUERY).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const payload = homesSaleBuildPayload(message.getSubject(), message.getPlainBody(), message.getDate());
      if (payload.skip) {
        count.skip++;
        Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
        return;
      }
      payload.key = key;
      try {
        const response = UrlFetchApp.fetch(HOMES_SALE_URL, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        const code = response.getResponseCode();
        const text = response.getContentText();
        // ⚠️ ログにお客様の名前・連絡先は出さない（査定IDだけ）
        Logger.log(code + ' 査定ID ' + payload.assessment_id + ' : ' + text);
        if (code === 200 && text.indexOf('"exists"') !== -1) count.exists++;
        else if (code === 200) count.success++;
        else count.error++;
      } catch (e) {
        count.error++;
        Logger.log('送信エラー 査定ID ' + payload.assessment_id + ' : ' + e.toString());
      }
    });
  });
  Logger.log('おわり: 登録 ' + count.success + ' 件 / 取り込み済み ' + count.exists + ' 件 / 送らない ' + count.skip + ' 件 / エラー ' + count.error + ' 件');
}
```

### 差分（registry.ts・express_proxy.php・version.ts・screen-245.md）
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index c199a3e6..3c0f5b78 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -150,6 +150,7 @@ import { runKagosumaEntry } from '../features/kagosuma/entry';
 import { runTochishinchakuEntry } from '../features/tochishinchaku/entry';
 import { runMyhomesEntry } from '../features/myhomes/entry';
 import { importOwnersHouseApplication, listOwnersHouseApplications } from '../features/ownersHouse/application';
+import { importHomesAssessment } from '../features/realty/homesAssessment';
 import { runOwnersHouseReservation } from '../features/ownersHouse/reservation';
 import { runEstimateEntry } from '../features/estimate/entry';
 import {
@@ -2595,6 +2596,23 @@ register({
   },
 });
 
+/**
+ * ⚠️⚠️ **LIFULL HOME'S の査定依頼メール → 売り反響（brokerage_listings の kind = leads）。書き込み口である。**（v2.2.236）
+ *   ⚠️ 送ってくるのは GAS（HomesSaleAssessmentToDashboard。5分おき・newer_than:1d）。⚠️ 合い言葉は MEMBER_ENTRY_KEY（本文の `key`）。
+ *   ⚠️ 同じ査定ID・前後90日に同じ電話番号の売り反響があれば入れない（status: exists）。features/realty/homesAssessment.ts
+ */
+register({
+  request: 'homes_sale_assessment_entry',
+  summary: "【書き込み・合い言葉】LIFULL HOME'S の査定依頼メールを売り反響に登録（brokerage_listings）",
+  phpSource: '(Express のみ)',
+  auth: 'none',
+  handler: async (ctx) => {
+    const result = await importHomesAssessment(ctx.body as Record<string, unknown>);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 /**
  * ⚠️⚠️ **簡単見積もり（2L・JH）の反響受付。認証なしの書き込み口である。**（v2.2.216）
  *   ⚠️ 中身は campaign_form:entry（見積もりの3キャンペーンだけ受ける）。⚠️ publicFormRateLimit の対象。
diff --git a/backend/scripts/guide/articles/common/screen-245.md b/backend/scripts/guide/articles/common/screen-245.md
index 5f537ba4..8c7367d4 100644
--- a/backend/scripts/guide/articles/common/screen-245.md
+++ b/backend/scripts/guide/articles/common/screen-245.md
@@ -40,3 +40,12 @@ summary: 売り反響・買い反響の画面の上に出るタイル・反響
 - 媒介獲得単価（申込単価）＝反響費用÷媒介受託（購入申込）
 
 > 注意：率は小数第1位まで。分母が0のときは「―」です。
+
+## HOME'S の査定依頼メールの自動登録
+LIFULL HOME'S の「＜実名＞査定依頼がありました」のメールは、届いてから数分で**売り反響に自動で登録**されます（5分おきに直近1日分のメールを確かめます）。
+- 反響元は「HOME's」、段階は「リード受信」、担当は空です。担当は一覧で割り当ててください
+- 物件の所在地・物件種別（区分）・売却理由・売却希望時期・お名前・電話・メールが入ります
+- 間取り・面積・築年・現況・名義・ご要望・お客様の記入・同時送信社数・査定IDは**備考**に入ります
+- 同じ査定IDのメールや、前後90日に**同じ電話番号の売り反響**がすでにあるときは、登録しません（コールセンターの明細などで先に入っている場合も二重になりません）
+
+> 注意：＜匿名＞の査定依頼（連絡先が無いもの）は登録しません。HOME'S の Manager で確認してください。
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 95b94bf2..380c9991 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -384,6 +384,10 @@ function expressProxyRequests(): array
         'owners_house_application_list',
         'owners_house_application_import',
 
+        // v2.2.236 新規。LIFULL HOME'S の査定依頼メール → 売り反響（brokerage_listings）。⚠️ ① に PHP ハンドラは無い（② だけ）
+        //   ⚠️ GAS（HomesSaleAssessmentToDashboard）は ② に直接送る。① を通る経路は確認用
+        'homes_sale_assessment_entry',
+
         // -----------------------------------------------------------------
         // 2026-10-06 新規（v2.2.168）。住宅ローン金利（loan_product / loan_rate）。
         //
@@ -859,6 +863,10 @@ function expressProxyExclusive(): array
         'owners_house_application_list',
         'owners_house_application_import',
 
+        // v2.2.236 新規。LIFULL HOME'S の査定依頼メール → 売り反響（brokerage_listings）。⚠️ ① に PHP ハンドラは無い（② だけ）
+        //   ⚠️ GAS（HomesSaleAssessmentToDashboard）は ② に直接送る。① を通る経路は確認用
+        'homes_sale_assessment_entry',
+
         // -----------------------------------------------------------------
         // 2026-10-06 新規（v2.2.168）。住宅ローン金利（loan_product / loan_rate）。
         //
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index e6ddcb1d..6e01c822 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.235';
+export const newVersion = '2.2.236';
```
