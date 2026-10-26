# 2026-10-22 ハウジングバザールの取り込みを作り直す（v2.2.210 の追加）

## 指示（ReadMeClaude.md）
- v2.2.210 で作業。portal.php は誤って廃棄。週1件ほどなので重複ロジックは新しく作ってよい
- 住所の取得がうまくいっていないので取得ロジックから作り直す
- テーブルにはブランドや店舗は未設定の状態で登録する
- 渡された GAS（HousingBtoDashboard）を登録する API を作る。メールは件名で読む
- 確認で決めたこと：合い言葉は会員登録と同じ MEMBER_ENTRY_KEY・① の予備も作る・ブランド／店舗は KHG／ブランド・店舗未設定

## 今のデータで分かったこと
- ハウジングバザールの反響は 2025-06〜 119件
- **住所の頭の1文字が欠けていた**（「崎県日向市…」）。改行を消してから `slice(9)`（〒＋7桁＝8文字）で切っていたため
- 以前の GAS は shop に「KHG店舗未設定」を入れていたが、⚠️ 店舗一覧（shop_list）に無い。実在する未設定は「ブランド・店舗未設定」（brand = KHG）

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/housingBazar/ | **entry.ts**（新規） | `runHousingBazarEntry`（受け口） |
| backend-express/src/features/memberEntry/ | entry.ts | `keyMatches`・`duplicateNote` を export（housingBazar から使う）。`=(` の空白を直した |
| backend-express/src/gateway/ | registry.ts | `housing_bazar_entry` を登録 |
| backend/src/handlers/ | **housing_bazar_entry.php**（新規） | ① の予備（`housingBazarClean`・`housingBazarCleanMultiline`・`housingBazarRespond`） |
| backend/src/core/ | express_proxy.php | `expressProxyRequests()` に `housing_bazar_entry` |
| backend/scripts/gas/ | **HousingBtoDashboard.gs**（新規） | GAS 本体（`bazarParse`・`bazarSplitAddress`・`bazarSplitPlace`・`bazarBuildPayload`・`bazarPost`・`HousingBtoDashboard`） |
| backend/scripts/sql/ | 2026-10-22_update_log_2.2.210_housing_bazar.sql（新規） | 更新履歴の v2.2.210 の文に書き足す（ローカル投入済み） |
| docs/ | deploy-v2.2.210-housing-bazar.md（新規） | デプロイ手順 |

- 画面の変更なし（業務ガイドの記事は直していない）

## 送る内容（GAS → ② / ①）
`{ request: 'housing_bazar_entry', key, inquiry_id, inquiry_date, name, kana, mobile, mail, zip, address, area, remarks }`
- inquiry_id は以前と同じ `housingBazar` ＋ UTC の日時（toISOString）＋ `KHG`
- 受け側が 媒体・反響媒体＝ハウジングバザール、brand＝KHG、shop＝ブランド・店舗未設定 を入れる
- 重複：同じ inquiry_id → exists。メールが一致、または電話の数字（10桁以上）が一致する既存の反響があれば duplicate に「店舗 媒体 重複」
- 住所：「◆ 住所：」の行と次の行を合わせ、〒＋7桁を郵便番号に、残りを住所（building）に
- 建築予定地：1行目が 無し／有り なら土地の有無（備考）、残りを場所（area）
- 備考：資料請求・コンタクト方法・建築予定地の土地・家族人数・年齢・勤務先・建築予定時期・建築予算・既に話している会社・ご要望

## テスト
- GAS の読み取り（いただいた本文）：住所「鹿児島県霧島市隼人町神宮6-16-17 202」（頭が欠けない）・郵便番号 8995121・建築予定地「鹿児島県 霧島市」・土地「無し」・家族人数・年齢・時期・予算
  - CRLF・郵便番号と住所が同じ行・建築予定地に土地の有無が無い・ご要望が複数行 → いずれも正しく読む。返信（Re:）・氏名なし → 送らない
- ① 経由で ②：合い言葉なし 401・氏名なし 400・登録 200・2回目 exists・電話だけ一致の別の反響 → duplicate「ブランド・店舗未設定 ハウジングバザール 重複」
- ② を止めて ①：登録・exists・401（行の形は ② と同じ）
- 会員登録（member_entry）の回帰：401・登録・exists
- `tsc --noEmit` 通過・`php -l` 通過。テストの行は消した

## コード

### backend-express/src/features/housingBazar/entry.ts（新規）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';
import { duplicateNote, keyMatches } from '../memberEntry/entry';

/**
 * ハウジングバザール（bazar@g-rexjapan.co.jp）の問い合わせを inquiry_customer へ保存する。（v2.2.210）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS の HousingBtoDashboard（backend/scripts/gas/HousingBtoDashboard.gs）。
 *   通知メールを読み取ってから送ってくる。⚠️ 届かなかったとき GAS は ① の handlers/housing_bazar_entry.php へ送り直す。
 *   ⚠️ **同じ処理を PHP にも持っている。** ⚠️ ここを変えたら housing_bazar_entry.php も同じように変えること。
 * ⚠️ 移植元は ① `khg-marketing.info/api/portal.php`（⚠️ 誤って消えた。中身は残っていない）。
 * ⚠️ 合い言葉は会員登録の取り込み（member_entry）と同じ MEMBER_ENTRY_KEY。
 * ⚠️⚠️ **ブランド・店舗は決めない**（指示）。店舗一覧に実在する「未設定」の値（KHG・ブランド・店舗未設定）で入れる。
 *   ⚠️ 以前の GAS は「KHG店舗未設定」を入れていたが、⚠️ この店舗は店舗一覧に無い（一覧にも集計にも出ない）。
 * ⚠️ 重複：同じ inquiry_id は二度入らない。同じ人（メールか電話が一致）が既にいれば duplicate に「店舗 媒体 重複」。
 * ─────────────────────────────────────────────
 */

export interface HousingBazarResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** ⚠️ 以前の GAS と同じ形（housingBazar＋日時＋KHG）。⚠️ 取り込み済みのメールが二重に入らないように */
const INQUIRY_ID_PREFIX = 'housingBazar';
const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;
const MEDIUM = 'ハウジングバザール';
/** ⚠️ shop_list に実在する「未設定」（brand = KHG） */
const BRAND = 'KHG';
const SHOP = 'ブランド・店舗未設定';

/** 電話の数字だけ（重複の照合用。⚠️ 保存する値はそのまま） */
const digits = (value: string): string => value.replace(/\D/g, '');

interface DuplicateRow extends RowDataPacket {
    shop: string;
    medium: string;
}

export const runHousingBazarEntry = async (raw: Record<string, unknown>): Promise<HousingBazarResult> => {
    const body = raw ?? {};

    // ⚠️ 合い言葉を最初に確かめる（member_entry と同じ理由）
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、ハウジングバザールの取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const inquiryId = clean(body.inquiry_id, 200);
    const inquiryDate = clean(body.inquiry_date, 10);
    const name = clean(body.name, 120);
    const mail = clean(body.mail, 190);
    const mobile = clean(body.mobile, 30);

    if (!inquiryId.startsWith(INQUIRY_ID_PREFIX) || !DATE_PATTERN.test(inquiryDate) || name === '' || (mail === '' && mobile === '')) {
        logger.warn(`housing_bazar_entry: 必要な項目がありません id="${inquiryId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        const existing = await query<RowDataPacket>('SELECT id FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1', [inquiryId]);
        if (existing.length > 0) {
            return { httpStatus: 200, body: { status: 'exists', message: '登録済みです。', id: inquiryId } };
        }

        // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）
        const tel = digits(mobile);
        const conditions: string[] = [];
        const params: string[] = [];
        if (mail !== '') { conditions.push('mail = ?'); params.push(mail); }
        if (tel.length >= 10) { conditions.push("REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ?"); params.push(tel); }
        const duplicates = conditions.length === 0 ? [] : await query<DuplicateRow>(
            `SELECT shop, medium FROM inquiry_customer WHERE ${conditions.join(' OR ')} ORDER BY id`, params
        );

        const values: Record<string, string | number> = {};
        for (const column of NOT_NULL_COLUMNS) values[column] = '';
        // ⚠️ 数値列。空文字だと INSERT ごと失敗する
        values.sync = 0;
        values.delete_flag = 0;

        values.inquiry_id = inquiryId;
        values.inquiry_date = inquiryDate;
        values.medium = MEDIUM;
        values.response_medium = MEDIUM;
        // ⚠️ 他の反響と同じく氏名・かなは分けずに first_name / first_name_kana、住所はまとめて building
        values.first_name = name;
        values.first_name_kana = clean(body.kana, 120);
        values.mobile = mobile;
        values.mail = mail;
        values.zip = clean(body.zip, 10);
        values.building = clean(body.address, 300);
        // ⚠️ 建築予定地（以前の GAS と同じく area）
        values.area = clean(body.area, 200);
        values.brand = BRAND;
        values.shop = SHOP;
        values.remarks = cleanMultiline(body.remarks, 2000);
        values.duplicate = duplicateNote(duplicates);

        await execute(
            `INSERT INTO inquiry_customer (${NOT_NULL_COLUMNS.join(', ')})`
            + ` VALUES (${NOT_NULL_COLUMNS.map(() => '?').join(', ')})`,
            NOT_NULL_COLUMNS.map(c => values[c])
        );
    } catch (error) {
        logger.error(`housing_bazar_entry: inquiry_customer への保存に失敗 id="${inquiryId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データの追加に失敗しました。' } };
    }

    logger.info(`housing_bazar_entry を受け付けました id="${inquiryId}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが反響一覧に追加されました。`, id: inquiryId } };
};
```

### backend/src/handlers/housing_bazar_entry.php（新規）
```php
<?php

/**
 * ハウジングバザールの問い合わせを inquiry_customer へ保存する。（v2.2.210）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/housingBazar/entry.ts の予備である。同じ処理を持つ。**
 *   ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 *   ⚠️ 動くのは ② に届かなかったとき（GAS が送り直したとき・① からの転送が失敗したとき）。
 *   ⚠️ ここを変えたら entry.ts も同じように変えること。
 * ⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY。⚠️ ブランド・店舗は「KHG・ブランド・店舗未設定」で入れる。
 * ─────────────────────────────────────────────
 */

/** 制御文字を空白にし、連続する空白を1つにして長さで切る（② の clean と同じ） */
function housingBazarClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 改行だけ残す（② の cleanMultiline と同じ） */
function housingBazarCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

function housingBazarRespond(int $status, array $body): void
{
    http_response_code($status);
    // ⚠️ ② と同じ形にする（inquiry_id をエスケープしない）
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$expectedKey = trim((string)getenv('MEMBER_ENTRY_KEY'));
$inputKey = housingBazarClean($data['key'] ?? '', 200);
if ($expectedKey === '' || !hash_equals($expectedKey, $inputKey)) {
    if ($expectedKey === '') {
        error_log('housing_bazar_entry: MEMBER_ENTRY_KEY が未設定のため断りました');
    }
    housingBazarRespond(401, ['status' => 'error', 'message' => '合い言葉が違います。']);
}

$inquiryId   = housingBazarClean($data['inquiry_id'] ?? '', 200);
$inquiryDate = housingBazarClean($data['inquiry_date'] ?? '', 10);
$name        = housingBazarClean($data['name'] ?? '', 120);
$mail        = housingBazarClean($data['mail'] ?? '', 190);
$mobile      = housingBazarClean($data['mobile'] ?? '', 30);

if (
    strpos($inquiryId, 'housingBazar') !== 0
    || !preg_match('#^\d{4}/\d{2}/\d{2}$#', $inquiryDate)
    || $name === ''
    || ($mail === '' && $mobile === '')
) {
    error_log("housing_bazar_entry: 必要な項目がありません id=\"{$inquiryId}\"");
    housingBazarRespond(400, ['status' => 'error', 'message' => '必要な項目がありません。']);
}

try {
    $stmt = $pdo->prepare('SELECT id FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1');
    $stmt->execute([$inquiryId]);
    if ($stmt->fetch()) {
        housingBazarRespond(200, ['status' => 'exists', 'message' => '登録済みです。', 'id' => $inquiryId]);
    }

    // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）
    $tel = preg_replace('/\D/', '', $mobile) ?? '';
    $conditions = [];
    $params = [];
    if ($mail !== '') {
        $conditions[] = 'mail = ?';
        $params[] = $mail;
    }
    if (strlen($tel) >= 10) {
        $conditions[] = "REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ?";
        $params[] = $tel;
    }
    $duplicate = '';
    if ($conditions) {
        $stmt = $pdo->prepare('SELECT shop, medium FROM inquiry_customer WHERE ' . implode(' OR ', $conditions) . ' ORDER BY id');
        $stmt->execute($params);
        $notes = [];
        foreach (array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'medium', 'shop') as $dupShop => $dupMedium) {
            $notes[] = "{$dupShop} {$dupMedium} 重複";
        }
        $duplicate = implode(',', $notes);
    }

    // ⚠️ NOT NULL の列をすべて埋める（② の NOT_NULL_COLUMNS と同じ）
    $notNullColumns = [
        'inquiry_id', 'pg_id', 'mhl_id', 'mhl_url', 'mhl_mail', 'inquiry_date',
        'medium', 'response_medium',
        'first_name', 'last_name', 'first_name_kana', 'last_name_kana',
        'mobile', 'landline', 'mail',
        'zip', 'pref', 'city', 'town', 'street', 'building',
        'brand', 'shop', 'sync', 'staff', 'area',
        'reserved_date', 'reserved_time', 'black_list', 'hp_campaign',
        'delete_flag', 'duplicate', 'note',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'referrer', 'first_visit', 'hotlead_url', 'remarks',
    ];
    $values = array_fill_keys($notNullColumns, '');
    $values['sync'] = 0;
    $values['delete_flag'] = 0;
    $values['inquiry_id'] = $inquiryId;
    $values['inquiry_date'] = $inquiryDate;
    $values['medium'] = 'ハウジングバザール';
    $values['response_medium'] = 'ハウジングバザール';
    $values['first_name'] = $name;
    $values['first_name_kana'] = housingBazarClean($data['kana'] ?? '', 120);
    $values['mobile'] = $mobile;
    $values['mail'] = $mail;
    $values['zip'] = housingBazarClean($data['zip'] ?? '', 10);
    $values['building'] = housingBazarClean($data['address'] ?? '', 300);
    $values['area'] = housingBazarClean($data['area'] ?? '', 200);
    $values['brand'] = 'KHG';
    $values['shop'] = 'ブランド・店舗未設定';
    $values['remarks'] = housingBazarCleanMultiline($data['remarks'] ?? '', 2000);
    $values['duplicate'] = $duplicate;

    $placeholders = implode(', ', array_fill(0, count($notNullColumns), '?'));
    $stmt = $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $notNullColumns) . ") VALUES ({$placeholders})");
    $stmt->execute(array_values($values));
} catch (PDOException $e) {
    error_log("housing_bazar_entry: inquiry_customer への保存に失敗 id=\"{$inquiryId}\": " . $e->getMessage());
    housingBazarRespond(500, ['status' => 'error', 'message' => 'データの追加に失敗しました。']);
}

error_log("housing_bazar_entry: ① で受け付けました id=\"{$inquiryId}\"");
housingBazarRespond(200, ['status' => 'success', 'message' => "{$name} のデータが反響一覧に追加されました。", 'id' => $inquiryId]);
```

### backend/scripts/gas/HousingBtoDashboard.gs（新規）
```js
// =====================================================================
// ハウジングバザールの問い合わせ通知メール → 反響（inquiry_customer）として取り込む（v2.2.210）
//
// ⚠️ 送信元: ハウジングバザール <bazar@g-rexjapan.co.jp>
// ⚠️ 件名  : 【ハウジングバザール】お問い合わせがありました。（頭に [marketing]: [lead]: が付く）
// ⚠️ トリガー: HousingBtoDashboard（関数名は以前と同じ）
//
// ⚠️ 送り先:
//   1. ② https://api.khg-marketing.info/api/gateway （request: housing_bazar_entry）
//   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
//      （① の handlers/housing_bazar_entry.php が同じ処理をする）
//   ⚠️ 同じ inquiry_id は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
// ⚠️ ブランド・店舗は送らない（受け側が「KHG・ブランド・店舗未設定」で入れる）。
//
// ⚠️ 以前の版（api/portal.php 宛て。portal.php は誤って消えた）から直したところ:
//   - ラベルで探さない（件名で探す）
//   - Parser ライブラリを使わない（「◆ 見出し：値」を行ごとに読む。値が次の行に続く住所・建築予定地も拾う）
//   - 住所の頭の1文字が欠けていた（改行を消してから slice(9) していたため）→ 郵便番号と住所を分けて読む
//   - 建築予定地は「無し／有り」と場所を分ける（場所は area、土地の有無は備考）
//   - 家族人数・年齢・建築予定時期・予算・資料請求・ご要望を備考（remarks）に残す
// =====================================================================

const BAZAR_EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
const BAZAR_PHP_URL = 'https://khg-marketing.info/dashboard/api/gateway/';
/** ⚠️ 件名で探す（指示）。⚠️ 頭の [marketing]: [lead]: はメーリングリストが付けるもの（部分一致なので気にしない） */
const BAZAR_SUBJECT = '【ハウジングバザール】お問い合わせがありました';
const BAZAR_QUERY = 'subject:"' + BAZAR_SUBJECT + '" newer_than:7d';

/** 半角・全角の空白を前後から除く */
function bazarTrim(text) {
  return String(text || '').replace(/^[\s　]+|[\s　]+$/g, '');
}

/** 全角の英数字・記号を半角に（電話・郵便番号用） */
function bazarToHalfWidth(text) {
  return String(text || '').replace(/[！-～]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/**
 * 本文を「◆ 見出し：値」で読む。⚠️ 戻り値は { 見出し: [1行目, 2行目, ...] }。
 *
 * ⚠️ ◆ で始まる行が見出し。⚠️ 見出しと値は全角・半角のコロンで分かれる（コロンが無い見出しもある）。
 * ⚠️ 見出しの後ろの空白（「年齢 ：」など）は除いて比べる。
 * ⚠️ 次の ◆・区切り線（===）・空行までが、その見出しの値の続き（住所・建築予定地・ご要望は複数行になる）。
 */
function bazarParse(body) {
  const fields = {};
  let current = null;
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = bazarTrim(line);
    if (/^◆/.test(trimmed)) {
      const head = trimmed.replace(/^◆[\s　]*/, '');
      const at = head.search(/[：:]/);
      const label = bazarTrim(at === -1 ? head : head.slice(0, at)).replace(/[\s　]+/g, '');
      const value = at === -1 ? '' : bazarTrim(head.slice(at + 1));
      current = label;
      fields[label] = value === '' ? [] : [value];
      continue;
    }
    if (trimmed === '' || /^={3,}/.test(trimmed)) { current = null; continue; }
    if (current) fields[current].push(trimmed);
  }
  return fields;
}

/** 見出しの値（複数行は区切りでつなぐ） */
function bazarValue(fields, label, sep) {
  return (fields[label] || []).join(sep === undefined ? ' ' : sep).replace(/[\s　]+$/, '');
}

/**
 * 住所：「〒8995121」の行と、その下の住所の行。⚠️ 同じ行に続けて書かれていても分ける。
 * ⚠️ 戻り値は [郵便番号（数字7桁）, 住所]
 */
function bazarSplitAddress(lines) {
  const all = (lines || []).join(' ');
  const half = bazarToHalfWidth(all);
  const m = half.match(/〒?\s*(\d{3})-?(\d{4})/);
  const zip = m ? m[1] + m[2] : '';
  const rest = m ? all.slice(0, m.index) + all.slice(m.index + m[0].length) : all;
  return [zip, bazarTrim(rest.replace(/^[\s　]*〒/, '')).replace(/[\s　]+/g, ' ')];
}

/**
 * 建築予定地：1行目が「無し／有り」なら土地の有無、残りが場所。⚠️ 場所は「鹿児島県 霧島市」の形で来る。
 * ⚠️ 戻り値は [場所, 土地の有無]
 */
function bazarSplitPlace(lines) {
  const list = (lines || []).slice();
  let land = '';
  if (list.length && /^(無し|なし|有り|あり)$/.test(list[0])) land = list.shift();
  return [list.join(' ').replace(/[\s　]+/g, ' ').trim(), land];
}

/** 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 } */
function bazarBuildPayload(subject, body, date) {
  const s = String(subject || '');
  if (s.indexOf(BAZAR_SUBJECT) === -1) return { skip: '件名が違う' };
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };

  const f = bazarParse(body);
  const name = bazarValue(f, 'お名前').replace(/[\s　]+/g, ' ');
  const mobile = bazarToHalfWidth(bazarValue(f, 'TEL')).replace(/[\s　]/g, '');
  const mail = bazarToHalfWidth(bazarValue(f, 'Emailアドレス')).replace(/[\s　]/g, '');
  if (name === '') return { skip: 'お名前が読めない' };
  if (mail === '' && mobile === '') return { skip: 'メールも電話も無い' };

  const address = bazarSplitAddress(f['住所']);
  const place = bazarSplitPlace(f['建築予定地']);
  const remarks = [
    ['資料請求', bazarValue(f, '資料請求').replace(/、$/, '')],
    ['コンタクト方法', bazarValue(f, 'コンタクト方法')],
    ['建築予定地の土地', place[1]],
    ['家族人数', bazarValue(f, '家族人数')],
    ['年齢', bazarValue(f, '年齢')],
    ['勤務先', bazarValue(f, '勤務先')],
    ['建築予定時期', bazarValue(f, '建築予定時期')],
    ['建築予算', bazarValue(f, '建築予算')],
    ['既に話している会社', bazarValue(f, 'こちらの会社と既にお話しをされていますか？')],
    ['ご要望', bazarValue(f, 'その他ご要望', '\n')],
  ].filter(function (pair) { return pair[1]; })
    .map(function (pair) { return pair[0] + '：' + pair[1]; })
    .join('\n');

  return {
    request: 'housing_bazar_entry',
    // ⚠️ 以前の GAS と同じ形（housingBazar＋UTC の日時＋KHG）。⚠️ 取り込み済みのメールが二重に入らないように
    inquiry_id: 'housingBazar' + date.toISOString() + 'KHG',
    inquiry_date: Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd'),
    name: name,
    kana: bazarValue(f, 'フリガナ').replace(/[\s　]+/g, ' '),
    mobile: mobile,
    mail: mail,
    zip: address[0],
    address: address[1],
    area: place[0],
    remarks: remarks
  };
}

/**
 * 送る。② → だめなら ①。
 * ⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。401・400 は ① でも同じなので送り直さない。
 */
function bazarPost(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const targets = [['②', BAZAR_EXPRESS_URL], ['①', BAZAR_PHP_URL]];
  for (const target of targets) {
    try {
      const response = UrlFetchApp.fetch(target[1], options);
      const code = response.getResponseCode();
      Logger.log(target[0] + ' ' + code + ' ' + payload.inquiry_id + ' : ' + response.getContentText());
      if (code < 500) return code === 200;
    } catch (e) {
      Logger.log(target[0] + ' 送信エラー ' + payload.inquiry_id + ' : ' + e.toString());
    }
  }
  return false;
}

// =====================================================================
// ⚠️ メインの実行関数。⚠️ **トリガーはこれを指定する**（以前と同じ関数名）
// =====================================================================
function HousingBtoDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  GmailApp.search(BAZAR_QUERY).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const payload = bazarBuildPayload(message.getSubject(), message.getPlainBody(), message.getDate());
      if (payload.skip) {
        Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
        return;
      }
      payload.key = key;
      bazarPost(payload);
    });
  });
}
```

### backend/scripts/sql/2026-10-22_update_log_2.2.210_housing_bazar.sql（新規）
```sql
-- =====================================================================
-- v2.2.210 の更新履歴に、ハウジングバザールの取り込みの見直しを書き足す
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 2026-10-22_update_log_2.2.210.sql（4半期サマリー）を流したあとに流す。⚠️ 2回流しても文は1回しか付かない（NOT LIKE で弾く）
-- =====================================================================
UPDATE update_log
SET note = CONCAT(note, 'ハウジングバザールの問い合わせの取り込みを作り直した（住所の頭の1文字が欠ける不具合を直し、建築予定地・家族人数・予算などを備考に残す。店舗は「ブランド・店舗未設定」で入る）。')
WHERE version = '2.2.210' AND note NOT LIKE '%ハウジングバザール%';
SELECT no, version, note FROM update_log WHERE version = '2.2.210';
```

### 変更したファイルの差分（memberEntry/entry.ts・registry.ts・express_proxy.php）
```diff
diff --git a/backend-express/src/features/memberEntry/entry.ts b/backend-express/src/features/memberEntry/entry.ts
index 5bfd3eca..06d469e1 100644
--- a/backend-express/src/features/memberEntry/entry.ts
+++ b/backend-express/src/features/memberEntry/entry.ts
@@ -32,8 +32,11 @@ export interface MemberEntryResult {
 const INQUIRY_ID_PREFIX = 'homepage';
 const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;
 
-/** ⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる（event/checkin.ts と同じ） */
-const keyMatches = (input: string): boolean => {
+/**
+ * ⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる（event/checkin.ts と同じ）。
+ * ⚠️ housingBazar/entry.ts も使う（同じ合い言葉。v2.2.210）
+ */
+export const keyMatches = (input: string): boolean => {
     const expected = env.memberEntryKey;
     if (expected === '') return false;
     const a = Buffer.from(input, 'utf8');
@@ -48,9 +51,9 @@ interface DuplicateRow extends RowDataPacket {
 
 /**
  * 同じメールアドレスの既存の反響を「店舗 媒体 重複」の形で並べる（移植元と同じ形）。
- * ⚠️ 移植元は店舗ごとに1つ（同じ店舗なら後の行の媒体）。
+ * ⚠️ 移植元は店舗ごとに1つ（同じ店舗なら後の行の媒体）。⚠️ housingBazar/entry.ts も使う（v2.2.210）
  */
-const duplicateNote =(rows: ReadonlyArray<{ shop: string; medium: string }>): string => {
+export const duplicateNote = (rows: ReadonlyArray<{ shop: string; medium: string }>): string => {
     const byShop = new Map<string, string>();
     for (const row of rows) byShop.set(row.shop, row.medium);
     return [...byShop].map(([shop, medium]) => `${shop} ${medium} 重複`).join(',');
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 7a871544..a779e496 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -143,6 +143,7 @@ import { runUpdateLog } from '../features/updateLog';
 import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
 import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
 import { runMemberEntry } from '../features/memberEntry/entry';
+import { runHousingBazarEntry } from '../features/housingBazar/entry';
 import type { GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
 
@@ -2275,6 +2276,24 @@ register({
   },
 });
 
+/**
+ * ⚠️⚠️ **ハウジングバザールの問い合わせの取り込み。書き込み口である。**（v2.2.210）
+ *   ⚠️ 送ってくるのは GAS（HousingBtoDashboard）。⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY（本文の `key`）。
+ *   ⚠️ GAS は ② に届かなければ ① の handlers/housing_bazar_entry.php へ送り直す（同じ処理）。
+ *   ⚠️ 同じ inquiry_id は二度入らない（2回目は status: exists）。① の転送が二度届いても安全。
+ */
+register({
+  request: 'housing_bazar_entry',
+  summary: '【書き込み・合い言葉】ハウジングバザールの問い合わせの取り込み（inquiry_customer）',
+  phpSource: 'khg-marketing.info/api/portal.php（誤って消えた。handlers/housing_bazar_entry.php に作り直し）',
+  auth: 'none',
+  handler: async (ctx) => {
+    const result = await runHousingBazarEntry(ctx.body as Record<string, unknown>);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 // ---------------------------------------------------------------------------
 // 他社広告ライブラリ（meta_ads）
 //
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 0d65a2da..c2cc1ccc 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -114,6 +114,9 @@ function expressProxyRequests(): array
         //   ⚠️ ② が落ちたときは ① の PHP が保存する（GAS も ② に直接送れなかったときここへ送り直す）。
         //   ⚠️ expressProxyExclusive() には入れないこと（入れると ① の予備が動かない）。
         'member_entry',
+        // ⚠️ v2.2.210。ハウジングバザールの取り込み（GAS HousingBtoDashboard）。⚠️ member_entry と同じ理由で例外として入れる
+        //   （同じ inquiry_id は二度入らない。⚠️ ① の予備は handlers/housing_bazar_entry.php）
+        'housing_bazar_entry',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
```
