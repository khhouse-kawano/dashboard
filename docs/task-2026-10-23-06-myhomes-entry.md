# マイホームズの取り込みを作り直す（v2.2.214）

## 依頼
- 消えた `khg-marketing.info/api/` の `4081Kokubu_myhomes` の続き。GAS `MyhomestoDashboard` が登録する API を作る（新しいブランチ）
- 処理が終わるたびに、残りの作業をリマインドする

## 承認した計画
- ハウジングバザール・カゴスマと同じ形：GAS → ② `myhomes_entry`、② に届かなければ ① の予備 `myhomes_entry.php`。合い言葉は MEMBER_ENTRY_KEY
- 件名「【マイホームズ】新規リード通知」で探す（ラベルは使わない）。3日分は以前と同じ
- inquiry_id は `myhomes_`＋メールの「リードID」。以前の形の行とは「マイホームズで同じ日・同じメールか電話」で二重にしない
- ブランドは KH。店舗は portalShopList.ts の KH 分で、希望エリア → 住所の順に探す。決まらなければ KH店舗未設定

## 取り込み済みのデータから分かった以前の形（ローカル DB）
- 媒体・反響媒体：マイホームズ、ブランド KH
- inquiry_id：`myhomes_` ＋ `yyyy/MM/dd` ＋ **php が受け取った時刻** ＋ 電話番号（例 `myhomes_2026/09/2120260921_14253507024100720`）。⚠️ メールの時刻ではないので作り直せない
- 住所（building）に空行が多数、備考に区切り線と空行がそのまま入っていた
- 実データは 9/21 の1件（もう1件はマイホームズ側のテスト）

## 以前の GAS から直したところ
| 以前 | 今回 |
|---|---|
| ラベル `反響管理_マイホームズ` で探す | 件名「【マイホームズ】新規リード通知」で探す |
| Parser ライブラリ | 「【見出し】値」を行ごとに読む（見出しの無い行は直前の見出しの続き。空行・━・■ で閉じる） |
| 店舗の照合が逆（`表のエリア.includes(希望エリア)`）→ 実質いつも KH店舗未設定 | 希望エリア → 住所 の順に `文字列.includes(表のエリア)`。表は portalShopList.ts の KH 分（福岡県 → KH久留米店） |
| inquiry_id は php の受信時刻 | `myhomes_`＋リードID（同じメールは何度読んでも同じ値） |
| 住所に空行・備考に区切り線 | 住所は1行につなぐ。備考は「見出し：値」だけ |
| 名前とかなを `getStrValue` で切り出し | 「江口 舞（えぐち まい）」をかっこで分ける（かっこが無ければ全部を名前） |
| 年齢・リードID・受付日時を捨てる | 備考に残す |

## 変更・追加したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/myhomes/ | **entry.ts**（新規） | `runMyhomesEntry` |
| backend-express/src/gateway/ | registry.ts | `myhomes_entry` を登録（auth none） |
| backend/src/core/ | express_proxy.php | `expressProxyRequests()` に `myhomes_entry`（⚠️ Exclusive には入れない） |
| backend/src/handlers/ | **myhomes_entry.php**（新規） | ① の予備。`myhomesClean` `myhomesCleanMultiline` `myhomesRespond` |
| backend/scripts/gas/ | **MyhomestoDashboard.gs**（新規） | `MyhomestoDashboard`（トリガー） `myhomesParse` `myhomesSplitName` `myhomesSplitAddress` `myhomesFindShop` `myhomesBuildPayload` `myhomesPost` ほか。店舗の表は portalShopList.ts からスクリプトで写した（KH 195件・15店舗） |
| backend/scripts/sql/ | **2026-10-23_update_log_2.2.214.sql**（新規） | update_log（ローカル no=314 で反映済み） |
| frontend/src/utils/ | version.ts | 2.2.214 |
| docs/ | deploy-v2.2.214.md（新規）・本書 | |

- 業務ガイドの記事：画面の変更が無いので直していない

## 確かめたこと
1. **GAS の読み取り**（Node で GAS をそのまま動かし、見本メールを入れた）
   - 見本 → `myhomes_CH-20260921-P65M`・KH鹿児島店・江口 舞／えぐち まい・電話・メール・郵便番号 8910143・住所1行・希望エリア・備考（年齢〜土地の保有状況・リードID・受付日時）
   - CRLF でも同じ／希望エリアが都城市 → KH都城店／希望エリアが県だけ → 住所で KH鹿児島店／福岡県の住所 → KH久留米店／東京都 → KH店舗未設定／かっこ無しの名前 → かなは空
   - 送らない：返信、リードIDなし、名前なし
2. **① 経由で ②**（localhost:8080。トークン無しで 401＝② に届く）
   - **見本そのまま → exists**（ローカル DB にある以前の php の行（9/21・同じメール）と同じ日・同じ人）
   - 合い言葉なし 401／リードIDなし 400／店舗なし 400／正しいもの success／同じもの exists／同じ日・別のリードID・同じ電話 → exists／別の日・同じ電話 → success（duplicate に「KH鹿児島店 マイホームズ 重複」）
3. **② を止めて ① の PHP**：2 と同じ結果
4. 保存した列（媒体・反響媒体＝マイホームズ、KH・KH鹿児島店、かな・郵便番号・住所1行・area・remarks、sync=0）を DB で確認。テストの行（4行）は削除済み。実データ（江口様）は1行のまま
5. 回帰：member_entry・housing_bazar_entry・kagosuma_entry・tochishinchaku_entry も ① 経由で 401
6. `tsc --noEmit` OK、`php -l` OK

## 残りの作業（古い php の切り分け）
- ⏳ `registration`（`homepage`・`owners_house`）：簡単見積もり（JH・2L）・proposal・オーナーズハウス。Heroku の中継（projects/hub `/update`）経由で消えた php へ送っており、9月上旬から止まっていると思われる
- 済み・不要：form_* 一式（② と v2.2.213 の受け皿）、beforeSurvey、call_sheet、geo_info、tochishinchaku（v2.2.212）、myhomes（本書）

## コード

### backend-express/src/features/myhomes/entry.ts（新規）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';
import { duplicateNote, keyMatches } from '../memberEntry/entry';

/**
 * マイホームズ（no-reply@my-homes.jp）の新規リード通知を inquiry_customer へ保存する。（v2.2.214）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS の MyhomestoDashboard（backend/scripts/gas/MyhomestoDashboard.gs）。
 *   通知メールを読み取り、**店舗まで決めてから**送ってくる。⚠️ ここでは店舗を決め直さない（kagosuma_entry と同じ）。
 * ⚠️ 届かなかったとき GAS は ① の handlers/myhomes_entry.php へ送り直す。**同じ処理を PHP にも持っている。**
 *   ⚠️ ここを変えたら myhomes_entry.php も同じように変えること。
 * ⚠️ 移植元は ① `khg-marketing.info/api/`（Authorization: 4081Kokubu_myhomes。⚠️ 誤って消えた）。
 * ⚠️ 合い言葉は会員登録の取り込み（member_entry）と同じ MEMBER_ENTRY_KEY。
 * ⚠️ 重複:
 *   - 同じ inquiry_id（`myhomes_`＋リードID）は二度入らない
 *   - ⚠️⚠️ 以前の php は inquiry_id に**受け取った時刻**を入れていたので作り直せない。切り替えの前後で二重に入らないよう、
 *     **マイホームズで同じ日に、同じメールか電話の人がいれば登録済み**として飛ばす（tochishinchaku_entry と同じ）
 *   - 他の媒体で同じ人（メールか電話が一致）がいれば duplicate に「店舗 媒体 重複」
 * ─────────────────────────────────────────────
 */

export interface MyhomesEntryResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** ⚠️ `myhomes_`＋リードID（例 myhomes_CH-20260921-P65M） */
const INQUIRY_ID_PREFIX = 'myhomes_';
const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;
const MEDIUM = 'マイホームズ';

/** 電話の数字だけ（重複の照合用。⚠️ 保存する値はそのまま） */
const digits = (value: string): string => value.replace(/\D/g, '');
const SAME_PHONE_SQL = "REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ?";

interface DuplicateRow extends RowDataPacket {
    shop: string;
    medium: string;
}

export const runMyhomesEntry = async (raw: Record<string, unknown>): Promise<MyhomesEntryResult> => {
    const body = raw ?? {};

    // ⚠️ 合い言葉を最初に確かめる（member_entry と同じ理由）
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、マイホームズの取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const inquiryId = clean(body.inquiry_id, 200);
    const inquiryDate = clean(body.inquiry_date, 10);
    const name = clean(body.name, 120);
    const mail = clean(body.mail, 190);
    const mobile = clean(body.mobile, 30);
    const brand = clean(body.brand, 30);
    const shop = clean(body.shop, 80);

    if (inquiryId.length <= INQUIRY_ID_PREFIX.length || !inquiryId.startsWith(INQUIRY_ID_PREFIX) || !DATE_PATTERN.test(inquiryDate)
        || brand === '' || shop === '' || name === '' || (mail === '' && mobile === '')) {
        logger.warn(`myhomes_entry: 必要な項目がありません id="${inquiryId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）
        const phone = digits(mobile);
        const conditions: string[] = [];
        const params: string[] = [];
        if (mail !== '') { conditions.push('mail = ?'); params.push(mail); }
        if (phone.length >= 10) { conditions.push(SAME_PHONE_SQL); params.push(phone); }
        const samePerson = conditions.length === 0 ? '' : `(${conditions.join(' OR ')})`;

        const existing = await query<RowDataPacket>(
            'SELECT id FROM inquiry_customer WHERE inquiry_id = ?'
            + (samePerson ? ` OR (medium = ? AND inquiry_date = ? AND ${samePerson})` : '')
            + ' LIMIT 1',
            samePerson ? [inquiryId, MEDIUM, inquiryDate, ...params] : [inquiryId]
        );
        if (existing.length > 0) {
            return { httpStatus: 200, body: { status: 'exists', message: '登録済みです。', id: inquiryId } };
        }

        const duplicates = samePerson === '' ? [] : await query<DuplicateRow>(
            `SELECT shop, medium FROM inquiry_customer WHERE ${samePerson} ORDER BY id`, params
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
        // ⚠️ 以前と同じく氏名・かなは分けずに first_name / first_name_kana、住所はまとめて building
        values.first_name = name;
        values.first_name_kana = clean(body.kana, 120);
        values.mobile = mobile;
        values.mail = mail;
        values.zip = clean(body.zip, 10);
        values.building = clean(body.address, 300);
        // ⚠️ 希望エリア（以前と同じく area）
        values.area = clean(body.area, 200);
        values.brand = brand;
        values.shop = shop;
        values.remarks = cleanMultiline(body.remarks, 2000);
        values.duplicate = duplicateNote(duplicates);

        await execute(
            `INSERT INTO inquiry_customer (${NOT_NULL_COLUMNS.join(', ')})`
            + ` VALUES (${NOT_NULL_COLUMNS.map(() => '?').join(', ')})`,
            NOT_NULL_COLUMNS.map(c => values[c])
        );
    } catch (error) {
        logger.error(`myhomes_entry: inquiry_customer への保存に失敗 id="${inquiryId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データの追加に失敗しました。' } };
    }

    logger.info(`myhomes_entry を受け付けました id="${inquiryId}" brand="${brand}" shop="${shop}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが反響一覧に追加されました。`, id: inquiryId } };
};
```

### backend-express/src/gateway/registry.ts（追加分）
```ts
import { runMyhomesEntry } from '../features/myhomes/entry';

/**
 * ⚠️⚠️ **マイホームズの新規リード通知の取り込み。書き込み口である。**（v2.2.214）
 *   ⚠️ 送ってくるのは GAS（MyhomestoDashboard）。⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY（本文の `key`）。
 *   ⚠️ GAS は ② に届かなければ ① の handlers/myhomes_entry.php へ送り直す（同じ処理）。
 *   ⚠️ 同じ inquiry_id（と、同じ日の同じ人）は二度入らない（2回目は status: exists）。① の転送が二度届いても安全。
 */
register({
  request: 'myhomes_entry',
  summary: '【書き込み・合い言葉】マイホームズの新規リード通知の取り込み（inquiry_customer）',
  phpSource: 'khg-marketing.info/api/（Authorization: 4081Kokubu_myhomes。誤って消えた。handlers/myhomes_entry.php に作り直し）',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runMyhomesEntry(ctx.body as Record<string, unknown>);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});
```

### backend/src/core/express_proxy.php（expressProxyRequests() に追加）
```php
        'tochishinchaku_entry',
        // ⚠️ v2.2.214。マイホームズの取り込み（GAS MyhomestoDashboard）。⚠️ member_entry と同じ理由で例外として入れる
        //   （同じ inquiry_id は二度入らない。⚠️ ① の予備は handlers/myhomes_entry.php）
        'myhomes_entry',
```

### backend/src/handlers/myhomes_entry.php（新規）
```php
<?php

/**
 * マイホームズの新規リード通知を inquiry_customer へ保存する。（v2.2.214）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/myhomes/entry.ts の予備である。同じ処理を持つ。**
 *   ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 *   ⚠️ 動くのは ② に届かなかったとき（GAS が送り直したとき・① からの転送が失敗したとき）。
 *   ⚠️ ここを変えたら entry.ts も同じように変えること。
 * ⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY。⚠️ ブランド・店舗は GAS が決めて送ってくる（ここでは決め直さない）。
 * ⚠️ マイホームズで同じ日に、同じメールか電話の人がいれば登録済み（以前の php と inquiry_id の形が違っても二重に入らないように）。
 * ─────────────────────────────────────────────
 */

/** 制御文字を空白にし、連続する空白を1つにして長さで切る（② の clean と同じ） */
function myhomesClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 改行だけ残す（② の cleanMultiline と同じ） */
function myhomesCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

function myhomesRespond(int $status, array $body): void
{
    http_response_code($status);
    // ⚠️ ② と同じ形にする（inquiry_id をエスケープしない）
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$expectedKey = trim((string)getenv('MEMBER_ENTRY_KEY'));
$inputKey = myhomesClean($data['key'] ?? '', 200);
if ($expectedKey === '' || !hash_equals($expectedKey, $inputKey)) {
    if ($expectedKey === '') {
        error_log('myhomes_entry: MEMBER_ENTRY_KEY が未設定のため断りました');
    }
    myhomesRespond(401, ['status' => 'error', 'message' => '合い言葉が違います。']);
}

$medium      = 'マイホームズ';
$inquiryId   = myhomesClean($data['inquiry_id'] ?? '', 200);
$inquiryDate = myhomesClean($data['inquiry_date'] ?? '', 10);
$name        = myhomesClean($data['name'] ?? '', 120);
$mail        = myhomesClean($data['mail'] ?? '', 190);
$mobile      = myhomesClean($data['mobile'] ?? '', 30);
$brand       = myhomesClean($data['brand'] ?? '', 30);
$shop        = myhomesClean($data['shop'] ?? '', 80);

if (
    strlen($inquiryId) <= strlen('myhomes_')
    || strpos($inquiryId, 'myhomes_') !== 0
    || !preg_match('#^\d{4}/\d{2}/\d{2}$#', $inquiryDate)
    || $brand === ''
    || $shop === ''
    || $name === ''
    || ($mail === '' && $mobile === '')
) {
    error_log("myhomes_entry: 必要な項目がありません id=\"{$inquiryId}\"");
    myhomesRespond(400, ['status' => 'error', 'message' => '必要な項目がありません。']);
}

try {
    // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）
    $phone = preg_replace('/\D/', '', $mobile) ?? '';
    $conditions = [];
    $params = [];
    if ($mail !== '') {
        $conditions[] = 'mail = ?';
        $params[] = $mail;
    }
    if (strlen($phone) >= 10) {
        $conditions[] = "REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ?";
        $params[] = $phone;
    }
    $samePerson = $conditions ? '(' . implode(' OR ', $conditions) . ')' : '';

    $sql = 'SELECT id FROM inquiry_customer WHERE inquiry_id = ?';
    $existingParams = [$inquiryId];
    if ($samePerson !== '') {
        $sql .= " OR (medium = ? AND inquiry_date = ? AND {$samePerson})";
        $existingParams = array_merge($existingParams, [$medium, $inquiryDate], $params);
    }
    $stmt = $pdo->prepare($sql . ' LIMIT 1');
    $stmt->execute($existingParams);
    if ($stmt->fetch()) {
        myhomesRespond(200, ['status' => 'exists', 'message' => '登録済みです。', 'id' => $inquiryId]);
    }

    $duplicate = '';
    if ($samePerson !== '') {
        $stmt = $pdo->prepare("SELECT shop, medium FROM inquiry_customer WHERE {$samePerson} ORDER BY id");
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
    $values['medium'] = $medium;
    $values['response_medium'] = $medium;
    $values['first_name'] = $name;
    $values['first_name_kana'] = myhomesClean($data['kana'] ?? '', 120);
    $values['mobile'] = $mobile;
    $values['mail'] = $mail;
    $values['zip'] = myhomesClean($data['zip'] ?? '', 10);
    $values['building'] = myhomesClean($data['address'] ?? '', 300);
    $values['area'] = myhomesClean($data['area'] ?? '', 200);
    $values['brand'] = $brand;
    $values['shop'] = $shop;
    $values['remarks'] = myhomesCleanMultiline($data['remarks'] ?? '', 2000);
    $values['duplicate'] = $duplicate;

    $placeholders = implode(', ', array_fill(0, count($notNullColumns), '?'));
    $stmt = $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $notNullColumns) . ") VALUES ({$placeholders})");
    $stmt->execute(array_values($values));
} catch (PDOException $e) {
    error_log("myhomes_entry: inquiry_customer への保存に失敗 id=\"{$inquiryId}\": " . $e->getMessage());
    myhomesRespond(500, ['status' => 'error', 'message' => 'データの追加に失敗しました。']);
}

error_log("myhomes_entry: ① で受け付けました id=\"{$inquiryId}\" brand=\"{$brand}\" shop=\"{$shop}\"");
myhomesRespond(200, ['status' => 'success', 'message' => "{$name} のデータが反響一覧に追加されました。", 'id' => $inquiryId]);
```

### backend/scripts/gas/MyhomestoDashboard.gs（新規）
```js
// =====================================================================
// マイホームズの「新規リード通知」メール → 反響（inquiry_customer）として取り込む（v2.2.214）
//
// ⚠️ 送信元: マイホームズ <no-reply@my-homes.jp>
// ⚠️ 件名  : 【マイホームズ】新規リード通知 ◯◯様／鹿児島県鹿児島市（頭に [marketing]: が付く）
// ⚠️ トリガー: MyhomestoDashboard（関数名は以前と同じ）
//
// ⚠️ 送り先:
//   1. ② https://api.khg-marketing.info/api/gateway （request: myhomes_entry）
//   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
//      （① の handlers/myhomes_entry.php が同じ処理をする）
//   ⚠️ 同じ inquiry_id（と、同じ日の同じ人）は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
//
// ⚠️ 以前の版（api/ 宛て。php は誤って消えた）から直したところ:
//   - ラベルで探さない（件名で探す）。Parser ライブラリを使わない（「【見出し】値」を行ごとに読む）
//   - inquiry_id をメールの「リードID」から作る（以前は php が受け取った時刻で、作り直せなかった）
//   - 店舗の照合の向きが逆だった（`表のエリア.includes(希望エリア)` → 実質いつも店舗未設定）。
//     sync の portalShopList.ts（最新）の KH 分で、希望エリア → 住所の順に探す
//   - 住所の空行・備考の区切り線と空行を入れない。名前とかなを「江口 舞（えぐち まい）」から分ける
//   - 年齢・希望内容・リードID・受付日時を備考（remarks）に残す
// =====================================================================

const MYHOMES_EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
const MYHOMES_PHP_URL = 'https://khg-marketing.info/dashboard/api/gateway/';
/** ⚠️ 件名で探す（指示）。⚠️ 頭の [marketing]: はメーリングリストが付けるもの */
const MYHOMES_SUBJECT = '【マイホームズ】新規リード通知';
/** ⚠️ 以前と同じく 3日分を毎回読む（取り込み済みは受け側が飛ばす） */
const MYHOMES_QUERY = 'subject:"' + MYHOMES_SUBJECT + '" newer_than:3d';
/** ⚠️ 宛名は「株式会社国分ハウジング　ご担当者様」。⚠️ 国分ハウジングとして受けている */
const MYHOMES_BRAND = 'KH';
const MYHOMES_NOT_FOUND_SHOP = 'KH店舗未設定';

/** 備考に残す見出し（⚠️ この順で並べる）。⚠️ 名前・連絡先・住所・希望エリアは備考に入れない（それぞれの欄に入る） */
const MYHOMES_REMARK_LABELS = ['年齢', '建物代のご予算', 'ご希望の階数', '理想の間取り',
  '一緒に暮らす大人（18歳以上）', '18歳未満のお子様', '理想の土地の広さ', '土地の保有状況', 'リードID', '受付日時'];

/**
 * エリア・住所 → 店舗の表。⚠️⚠️ sync の utils/portalShopList.ts の **KH 分をそのまま写したもの**（2026-10-23）。
 *
 * ⚠️ 照合は「文字列に area を含む最初の1件」。⚠️ **先に一致した行が勝つ。**
 * ⚠️ 追加は必ず末尾に（福岡県も末尾。2文字の area が他県の住所に偶然当たらないように）。
 * ⚠️ shop は shop_list の店舗名と完全一致させること。⚠️ portalShopList.ts を直したら、ここも同じように直すこと。
 */
const MYHOMES_SHOP_LIST = [
  { shop: 'KH鹿児島店', area: '鹿児島市' },
  { shop: 'KH鹿屋店', area: '鹿屋市' },
  { shop: 'KH加世田店', area: '枕崎市' },
  { shop: 'KH出水阿久根店', area: '阿久根市' },
  { shop: 'KH出水阿久根店', area: '出水市' },
  { shop: 'KH加世田店', area: '指宿市' },
  { shop: 'KH鹿屋店', area: '垂水市' },
  { shop: 'KH薩摩川内店', area: '薩摩川内市' },
  { shop: 'KH鹿児島店', area: '日置市' },
  { shop: 'KH霧島店', area: '曽於市' },
  { shop: 'KH霧島店', area: '霧島市' },
  { shop: 'KH鹿屋店', area: '曽於郡' },
  { shop: 'KH薩摩川内店', area: 'いちき串木野市' },
  { shop: 'KH加世田店', area: '南さつま市' },
  { shop: 'KH鹿屋店', area: '志布志市' },
  { shop: 'KH加世田店', area: '南九州市' },
  { shop: 'KH姶良店', area: '伊佐市' },
  { shop: 'KH姶良店', area: '姶良市' },
  { shop: 'KH薩摩川内店', area: 'さつま町' },
  { shop: 'KH出水阿久根店', area: '長島町' },
  { shop: 'KH霧島店', area: '湧水町' },
  { shop: 'KH鹿屋店', area: '大崎町' },
  { shop: 'KH鹿屋店', area: '東串良町' },
  { shop: 'KH鹿屋店', area: '錦江町' },
  { shop: 'KH鹿屋店', area: '南大隅町' },
  { shop: 'KH鹿屋店', area: '肝付町' },
  { shop: 'KH宮崎店', area: '宮崎市' },
  { shop: 'KH都城店', area: '都城市' },
  { shop: 'KH延岡店', area: '延岡市' },
  { shop: 'KH都城店', area: '日南市' },
  { shop: 'KH都城店', area: '小林市' },
  { shop: 'KH延岡店', area: '日向市' },
  { shop: 'KH都城店', area: '串間市' },
  { shop: 'KH宮崎店', area: '西都市' },
  { shop: 'KH都城店', area: 'えびの市' },
  { shop: 'KH都城店', area: '三股町' },
  { shop: 'KH都城店', area: '高原町' },
  { shop: 'KH宮崎店', area: '国富町' },
  { shop: 'KH宮崎店', area: '綾町' },
  { shop: 'KH宮崎店', area: '高鍋町' },
  { shop: 'KH宮崎店', area: '新富町' },
  { shop: 'KH宮崎店', area: '西米良村' },
  { shop: 'KH宮崎店', area: '木城町' },
  { shop: 'KH宮崎店', area: '川南町' },
  { shop: 'KH宮崎店', area: '都農町' },
  { shop: 'KH延岡店', area: '門川町' },
  { shop: 'KH延岡店', area: '諸塚村' },
  { shop: 'KH延岡店', area: '椎葉村' },
  { shop: 'KH延岡店', area: '美郷町' },
  { shop: 'KH延岡店', area: '高千穂町' },
  { shop: 'KH延岡店', area: '日之影町' },
  { shop: 'KH延岡店', area: '五ヶ瀬町' },
  { shop: 'KH熊本店', area: '熊本市' },
  { shop: 'KH八代店', area: '八代市' },
  { shop: 'KH八代店', area: '人吉市' },
  { shop: 'KH熊本店', area: '荒尾市' },
  { shop: 'KH出水阿久根店', area: '水俣市' },
  { shop: 'KH熊本店', area: '玉名市' },
  { shop: 'KH熊本店', area: '山鹿市' },
  { shop: 'KH熊本店', area: '菊池市' },
  { shop: 'KH八代店', area: '宇土市' },
  { shop: 'KH八代店', area: '上天草市' },
  { shop: 'KH八代店', area: '宇城市' },
  { shop: 'KH熊本店', area: '阿蘇市' },
  { shop: 'KH八代店', area: '天草市' },
  { shop: 'KH熊本店', area: '合志市' },
  { shop: 'KH熊本店', area: '美里町' },
  { shop: 'KH熊本店', area: '玉東町' },
  { shop: 'KH熊本店', area: '南関町' },
  { shop: 'KH熊本店', area: '長洲町' },
  { shop: 'KH熊本店', area: '和水町' },
  { shop: 'KH熊本店', area: '大津町' },
  { shop: 'KH熊本店', area: '菊陽町' },
  { shop: 'KH熊本店', area: '南小国町' },
  { shop: 'KH熊本店', area: '小国町' },
  { shop: 'KH熊本店', area: '産山村' },
  { shop: 'KH熊本店', area: '高森町' },
  { shop: 'KH熊本店', area: '西原村' },
  { shop: 'KH熊本店', area: '南阿蘇村' },
  { shop: 'KH熊本店', area: '御船町' },
  { shop: 'KH熊本店', area: '嘉島町' },
  { shop: 'KH熊本店', area: '益城町' },
  { shop: 'KH熊本店', area: '甲佐町' },
  { shop: 'KH熊本店', area: '山都町' },
  { shop: 'KH八代店', area: '氷川町' },
  { shop: 'KH八代店', area: '芦北町' },
  { shop: 'KH八代店', area: '津奈木町' },
  { shop: 'KH八代店', area: '錦町' },
  { shop: 'KH八代店', area: '多良木町' },
  { shop: 'KH八代店', area: '湯前町' },
  { shop: 'KH八代店', area: '水上村' },
  { shop: 'KH八代店', area: '相良村' },
  { shop: 'KH八代店', area: '五木村' },
  { shop: 'KH八代店', area: '山江村' },
  { shop: 'KH八代店', area: '球磨村' },
  { shop: 'KH八代店', area: 'あさぎり町' },
  { shop: 'KH八代店', area: '苓北町' },
  { shop: 'KH大分店', area: '大分市' },
  { shop: 'KH大分店', area: '別府市' },
  { shop: 'KH大分店', area: '中津市' },
  { shop: 'KH大分店', area: '日田市' },
  { shop: 'KH大分店', area: '佐伯市' },
  { shop: 'KH大分店', area: '臼杵市' },
  { shop: 'KH大分店', area: '津久見市' },
  { shop: 'KH大分店', area: '竹田市' },
  { shop: 'KH大分店', area: '豊後高田市' },
  { shop: 'KH大分店', area: '杵築市' },
  { shop: 'KH大分店', area: '宇佐市' },
  { shop: 'KH大分店', area: '豊後大野市' },
  { shop: 'KH大分店', area: '由布市' },
  { shop: 'KH大分店', area: '国東市' },
  { shop: 'KH大分店', area: '姫島村' },
  { shop: 'KH大分店', area: '日出町' },
  { shop: 'KH大分店', area: '九重町' },
  { shop: 'KH大分店', area: '玖珠町' },
  { shop: 'KH佐賀店', area: '佐賀市' },
  { shop: 'KH佐賀店', area: '唐津市' },
  { shop: 'KH佐賀店', area: '鳥栖市' },
  { shop: 'KH佐賀店', area: '多久市' },
  { shop: 'KH佐賀店', area: '伊万里市' },
  { shop: 'KH佐賀店', area: '武雄市' },
  { shop: 'KH佐賀店', area: '鹿島市' },
  { shop: 'KH佐賀店', area: '小城市' },
  { shop: 'KH佐賀店', area: '嬉野市' },
  { shop: 'KH佐賀店', area: '神埼市' },
  { shop: 'KH佐賀店', area: '吉野ヶ里町' },
  { shop: 'KH佐賀店', area: '基山町' },
  { shop: 'KH佐賀店', area: '上峰町' },
  { shop: 'KH佐賀店', area: 'みやき町' },
  { shop: 'KH佐賀店', area: '玄海町' },
  { shop: 'KH佐賀店', area: '有田町' },
  { shop: 'KH佐賀店', area: '大町町' },
  { shop: 'KH佐賀店', area: '江北町' },
  { shop: 'KH佐賀店', area: '白石町' },
  { shop: 'KH佐賀店', area: '太良町' },
  // ⚠️ 福岡県（portalShopList.ts で 2026-09-08 追加）。⚠️ 必ず末尾に置く
  { shop: 'KH久留米店', area: '北九州市' },
  { shop: 'KH久留米店', area: '福岡市' },
  { shop: 'KH久留米店', area: '大牟田市' },
  { shop: 'KH久留米店', area: '久留米市' },
  { shop: 'KH久留米店', area: '直方市' },
  { shop: 'KH久留米店', area: '飯塚市' },
  { shop: 'KH久留米店', area: '田川市' },
  { shop: 'KH久留米店', area: '柳川市' },
  { shop: 'KH久留米店', area: '八女市' },
  { shop: 'KH久留米店', area: '筑後市' },
  { shop: 'KH久留米店', area: '大川市' },
  { shop: 'KH久留米店', area: '行橋市' },
  { shop: 'KH久留米店', area: '豊前市' },
  { shop: 'KH久留米店', area: '中間市' },
  { shop: 'KH久留米店', area: '小郡市' },
  { shop: 'KH久留米店', area: '筑紫野市' },
  { shop: 'KH久留米店', area: '春日市' },
  { shop: 'KH久留米店', area: '大野城市' },
  { shop: 'KH久留米店', area: '宗像市' },
  { shop: 'KH久留米店', area: '太宰府市' },
  { shop: 'KH久留米店', area: '古賀市' },
  { shop: 'KH久留米店', area: '福津市' },
  { shop: 'KH久留米店', area: 'うきは市' },
  { shop: 'KH久留米店', area: '宮若市' },
  { shop: 'KH久留米店', area: '嘉麻市' },
  { shop: 'KH久留米店', area: '朝倉市' },
  { shop: 'KH久留米店', area: 'みやま市' },
  { shop: 'KH久留米店', area: '糸島市' },
  { shop: 'KH久留米店', area: '那珂川市' },
  { shop: 'KH久留米店', area: '宇美町' },
  { shop: 'KH久留米店', area: '篠栗町' },
  { shop: 'KH久留米店', area: '志免町' },
  { shop: 'KH久留米店', area: '須恵町' },
  { shop: 'KH久留米店', area: '新宮町' },
  { shop: 'KH久留米店', area: '久山町' },
  { shop: 'KH久留米店', area: '粕屋町' },
  { shop: 'KH久留米店', area: '芦屋町' },
  { shop: 'KH久留米店', area: '水巻町' },
  { shop: 'KH久留米店', area: '岡垣町' },
  { shop: 'KH久留米店', area: '遠賀町' },
  { shop: 'KH久留米店', area: '小竹町' },
  { shop: 'KH久留米店', area: '鞍手町' },
  { shop: 'KH久留米店', area: '桂川町' },
  { shop: 'KH久留米店', area: '筑前町' },
  { shop: 'KH久留米店', area: '東峰村' },
  { shop: 'KH久留米店', area: '大刀洗町' },
  { shop: 'KH久留米店', area: '大木町' },
  { shop: 'KH久留米店', area: '広川町' },
  { shop: 'KH久留米店', area: '香春町' },
  { shop: 'KH久留米店', area: '添田町' },
  { shop: 'KH久留米店', area: '糸田町' },
  { shop: 'KH久留米店', area: '川崎町' },
  { shop: 'KH久留米店', area: '大任町' },
  { shop: 'KH久留米店', area: '赤村' },
  { shop: 'KH久留米店', area: '福智町' },
  { shop: 'KH久留米店', area: '苅田町' },
  { shop: 'KH久留米店', area: 'みやこ町' },
  { shop: 'KH久留米店', area: '吉富町' },
  { shop: 'KH久留米店', area: '上毛町' },
  { shop: 'KH久留米店', area: '築上町' },
];

/** 半角・全角の空白を前後から除く */
function myhomesTrim(text) {
  return String(text || '').replace(/^[\s　]+|[\s　]+$/g, '');
}

/** 全角の英数字・記号を半角に（電話・郵便番号用） */
function myhomesToHalfWidth(text) {
  return String(text || '').replace(/[！-～]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/**
 * 本文を「【見出し】値」で読む。⚠️ 戻り値は { 見出し: [1行目, 2行目, ...] }。
 * ⚠️ 見出しの無い行は直前の見出しの続き（【ご住所】は次の行から〒と住所が続く）。
 * ⚠️ 空行・区切り線（━）・「■ 」の小見出しで閉じる。
 */
function myhomesParse(body) {
  const fields = {};
  let current = '';
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = myhomesTrim(line);
    if (trimmed === '' || /^━/.test(trimmed) || /^■/.test(trimmed)) { current = ''; continue; }
    const matched = trimmed.match(/^【([^】]+)】(.*)$/);
    if (matched) {
      current = matched[1];
      const value = myhomesTrim(matched[2]);
      fields[current] = value === '' ? [] : [value];
      continue;
    }
    if (current) fields[current].push(trimmed);
  }
  return fields;
}

function myhomesValue(fields, label) {
  return (fields[label] || []).join(' ');
}

/** 「江口 舞（えぐち まい）」→ [名前, かな]。⚠️ かっこが無ければ全部を名前に */
function myhomesSplitName(text) {
  const m = String(text || '').match(/^(.+?)[\s　]*[（(](.+?)[）)][\s　]*$/);
  return m ? [myhomesTrim(m[1]), myhomesTrim(m[2])] : [myhomesTrim(text), ''];
}

/**
 * 【ご住所】の行 → [郵便番号（数字7桁）, 住所（複数行をつなぐ）]
 * ⚠️ 〒の行が無い・同じ行に続けて書かれていても分ける。
 */
function myhomesSplitAddress(lines) {
  const all = (lines || []).join(' ');
  const m = myhomesToHalfWidth(all).match(/〒?\s*(\d{3})-?(\d{4})/);
  const rest = m ? all.slice(0, m.index) + all.slice(m.index + m[0].length) : all;
  return [m ? m[1] + m[2] : '', myhomesTrim(rest.replace(/〒/g, '')).replace(/[\s　]+/g, ' ')];
}

/** 表から店舗を探す（先に一致した1件が勝つ）。⚠️ 見つからなければ '' */
function myhomesFindShop(text) {
  const target = String(text || '');
  if (target === '') return '';
  for (const row of MYHOMES_SHOP_LIST) {
    if (target.indexOf(row.area) !== -1) return row.shop;
  }
  return '';
}

/** 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 } */
function myhomesBuildPayload(subject, body, date) {
  const s = String(subject || '');
  if (s.indexOf(MYHOMES_SUBJECT) === -1) return { skip: '件名が違う' };
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };

  const f = myhomesParse(body);
  const leadId = myhomesValue(f, 'リードID').replace(/[\s　]/g, '');
  if (leadId === '') return { skip: 'リードIDが読めない' };

  const nameKana = myhomesSplitName(myhomesValue(f, 'お名前'));
  const name = nameKana[0].replace(/[\s　]+/g, ' ');
  const mobile = myhomesToHalfWidth(myhomesValue(f, '電話番号')).replace(/[\s　]/g, '');
  const mail = myhomesToHalfWidth(myhomesValue(f, 'メールアドレス')).replace(/[\s　]/g, '');
  if (name === '') return { skip: 'お名前が読めない' };
  if (mail === '' && mobile === '') return { skip: 'メールも電話も無い' };

  const address = myhomesSplitAddress(f['ご住所']);
  const area = myhomesValue(f, 'ご希望エリア').replace(/[\s　]+/g, ' ');
  const remarks = MYHOMES_REMARK_LABELS
    .map(function (label) { return [label, myhomesValue(f, label)]; })
    .filter(function (pair) { return pair[1]; })
    .map(function (pair) { return pair[0] + '：' + pair[1]; })
    .join('\n');

  return {
    request: 'myhomes_entry',
    // ⚠️ リードIDから作る（同じメールは何度読んでも同じ値）。⚠️ 変えないこと
    inquiry_id: 'myhomes_' + leadId,
    inquiry_date: Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd'),
    brand: MYHOMES_BRAND,
    // ⚠️ 希望エリア → 住所 の順に探す
    shop: myhomesFindShop(area) || myhomesFindShop(address[1]) || MYHOMES_NOT_FOUND_SHOP,
    name: name,
    kana: nameKana[1].replace(/[\s　]+/g, ' '),
    mobile: mobile,
    mail: mail,
    zip: address[0],
    address: address[1],
    area: area,
    remarks: remarks
  };
}

/**
 * 送る。② → だめなら ①。
 * ⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。401・400 は ① でも同じなので送り直さない。
 */
function myhomesPost(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const targets = [['②', MYHOMES_EXPRESS_URL], ['①', MYHOMES_PHP_URL]];
  for (const target of targets) {
    try {
      const response = UrlFetchApp.fetch(target[1], options);
      const code = response.getResponseCode();
      Logger.log(target[0] + ' ' + code + ' ' + payload.inquiry_id + ' ' + payload.shop + ' : ' + response.getContentText());
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
function MyhomestoDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  GmailApp.search(MYHOMES_QUERY).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const payload = myhomesBuildPayload(message.getSubject(), message.getPlainBody(), message.getDate());
      if (payload.skip) {
        Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
        return;
      }
      payload.key = key;
      myhomesPost(payload);
    });
  });
}
```

### backend/scripts/sql/2026-10-23_update_log_2.2.214.sql（新規）
```sql
-- =====================================================================
-- update_log に v2.2.214 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.214', '2026-10-23', 'マイホームズの反響の取り込みを作り直した。メールは件名で探し、店舗は希望エリアと住所から最新の表で決める（以前はいつも店舗未設定になっていた）。年齢・予算・間取りなどの希望内容を備考に残すようにした。');
```
