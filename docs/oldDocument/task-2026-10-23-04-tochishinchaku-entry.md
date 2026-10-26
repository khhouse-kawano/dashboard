# 土地新着ネットの会員登録の取り込みを作り直す（v2.2.212）

## 依頼（ReadMeClaude.md）
- v2.2.212 で作業開始
- php（`khg-marketing.info/api/`）は誤って廃棄。GAS `TochishinchakuToDashboard` が登録する API を作る
- 店舗は未設定でよい
- メールは件名で読む（「新規会員登録発生通知メール」）

## 承認した計画
- ハウジングバザール・カゴスマと同じ形：GAS → ② `tochishinchaku_entry`、② に届かなければ ① の予備 `tochishinchaku_entry.php`
- ブランド・店舗は「KHG・ブランド・店舗未設定」（以前は shop_list に無い「KHG店舗未設定」が入っていた）
- 合い言葉は MEMBER_ENTRY_KEY（以前の GAS に直書きされていた合い言葉は使わない。⚠️ 値はここにも書かない）
- 二重登録を防ぐ：同じ inquiry_id ＋「土地新着ネットで同じ日に、同じメールか電話の人」は登録済み

## 取り込み済みのデータから分かった以前の形（ローカル DB）
- 媒体・反響媒体：土地新着ネット
- inquiry_id：`tochishinchaku_` ＋ `yyyy/MM/dd` ＋ `yyyyMMdd_HHmmss`（例 `tochishinchaku_2026/10/1920261019_004320`）
- 氏名・かなは first_name / first_name_kana、住所は building、郵便番号は `895-2511` の形、area は希望エリアの1行目
- 電話番号（landline）は保存されていなかった

## 以前の GAS から直したところ
| 以前 | 今回 |
|---|---|
| ラベル `反響管理_土地新着ネット` で探す | 件名「新規会員登録発生通知メール」で探し、本文に「土地新着ネットの新規会員登録情報」があるものだけ送る。3日分は同じ |
| Parser ライブラリ | 行ごとに読む（上の段は「見出し：値」、土地希望条件は「■ 見出し」の次の行から） |
| 電話番号を読むが保存されない | landline に保存 |
| 希望エリアの1行目だけ | area は1行目（同じ）。全部の希望エリア・希望路線・価格・面積・校区・建築の予定・ハウスメーカー・その他・発生源・メール送信を備考に（空の項目は入れない） |
| 合い言葉を Authorization ヘッダーに直書き | スクリプト プロパティ MEMBER_ENTRY_KEY を本文の key で送る |
| 名前・連絡先が無くても送る | 送らない（受け側も 400） |
| ブランド・店舗：KHG・KHG店舗未設定（一覧に無い） | KHG・ブランド・店舗未設定 |

- 重複の照合：電話は携帯（mobile）と電話（landline）の両方の列と比べる（土地新着ネットは電話番号だけの人もいるため）

## 変更・追加したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/tochishinchaku/ | **entry.ts**（新規） | `runTochishinchakuEntry` |
| backend-express/src/gateway/ | registry.ts | `tochishinchaku_entry` を登録（auth none） |
| backend/src/core/ | express_proxy.php | `expressProxyRequests()` に `tochishinchaku_entry`（⚠️ Exclusive には入れない） |
| backend/src/handlers/ | **tochishinchaku_entry.php**（新規） | ① の予備。`tochishinchakuClean` `tochishinchakuCleanMultiline` `tochishinchakuRespond` |
| backend/scripts/gas/ | **TochishinchakuToDashboard.gs**（新規） | `TochishinchakuToDashboard`（トリガー） `tochiParse` `tochiSplitAddress` `tochiBuildPayload` `tochiPost` ほか |
| backend/scripts/sql/ | **2026-10-23_update_log_2.2.212.sql**（新規） | update_log（ローカル no=312 で反映済み） |
| frontend/src/utils/ | version.ts | 2.2.212 |
| docs/ | deploy-v2.2.212.md（新規）・本書 | |

- 業務ガイドの記事：画面の変更が無いので直していない

## 確かめたこと
1. **GAS の読み取り**（Node で GAS をそのまま動かし、ReadMeClaude のメール本文を入れた）
   - 見本 → 名前・フリガナ・メール・携帯・郵便番号 893-0032・住所（〒の後ろの全角空白で分ける）・area＝希望エリアの1行目・備考（16件の希望エリア・価格・面積・建築の予定・ハウスメーカー・発生源・メール送信）。空の「希望路線」「希望校区」「その他希望条件」は入らない
   - inquiry_id は `tochishinchaku_2026/10/2120261021_072005`（受信 10/21 7:20 と一致）
   - CRLF でも同じ／希望エリアなし → area 空／電話あり → tel／全角・ハイフンなしの郵便番号 → 893-0032／〒なし → 住所だけ
   - 送らない：返信、本文が土地新着ネットでないもの、名前なし
2. **① 経由で ②**（localhost:8080。トークン無しで 401＝② に届く）：合い言葉なし 401／名前なし 400／連絡先なし 400／正しいもの success／同じもの exists／別の日・電話だけ一致 → success（duplicate に印）／**以前の形の通番の行と同じ日・同じメール → exists**／電話番号だけ → success、同じ日にもう一通 → exists、別の日 → success（duplicate に印）
3. **② を止めて ① の PHP**：2 と同じ結果
4. 保存した列（媒体・反響媒体＝土地新着ネット、KHG・ブランド・店舗未設定、mobile・landline・mail・zip・building・area・remarks、sync=0、delete_flag=0）を DB で確認。テストの行（以前の形の行を含む10行）は削除済み
5. 回帰：member_entry・housing_bazar_entry・kagosuma_entry も ① 経由で 401（② に届く）
6. `tsc --noEmit` OK、`php -l` OK
7. リファクタリング：電話の照合を landline にも広げた（上記）。広げたあと 2・3 を再実行して同じ結果

## コード

### backend-express/src/features/tochishinchaku/entry.ts（新規）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';
import { duplicateNote, keyMatches } from '../memberEntry/entry';

/**
 * 土地新着ネット（ask@tochi-shinchaku.net）の新規会員登録を inquiry_customer へ保存する。（v2.2.212）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS の TochishinchakuToDashboard（backend/scripts/gas/TochishinchakuToDashboard.gs）。
 *   ⚠️ 届かなかったとき GAS は ① の handlers/tochishinchaku_entry.php へ送り直す。**同じ処理を PHP にも持っている。**
 *   ⚠️ ここを変えたら tochishinchaku_entry.php も同じように変えること。
 * ⚠️ 移植元は ① `khg-marketing.info/api/`（⚠️ 誤って消えた。中身は残っていない）。
 * ⚠️ 合い言葉は会員登録の取り込み（member_entry）と同じ MEMBER_ENTRY_KEY。
 *   ⚠️ 以前の GAS が Authorization ヘッダーに直書きしていた合い言葉は使わない。
 * ⚠️⚠️ **ブランド・店舗は決めない**（指示）。shop_list に実在する「KHG・ブランド・店舗未設定」で入れる。
 *   ⚠️ 以前は「KHG店舗未設定」が入っていたが、⚠️ この店舗は店舗一覧に無い。
 * ⚠️ 重複:
 *   - 同じ inquiry_id は二度入らない
 *   - ⚠️⚠️ 以前の php の inquiry_id の作り方は確かめられない（中身が残っていない）。切り替えの前後で二重に入らないよう、
 *     **土地新着ネットで同じ日に、同じメールか電話の人がいれば登録済み**として飛ばす
 *   - 他の媒体で同じ人（メールか電話が一致）がいれば duplicate に「店舗 媒体 重複」
 * ─────────────────────────────────────────────
 */

export interface TochishinchakuEntryResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** ⚠️ 以前と同じ形（tochishinchaku_＋受信日＋受信日時） */
const INQUIRY_ID_PREFIX = 'tochishinchaku_';
const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;
const MEDIUM = '土地新着ネット';
/** ⚠️ shop_list に実在する「未設定」（brand = KHG） */
const BRAND = 'KHG';
const SHOP = 'ブランド・店舗未設定';

/** 電話の数字だけ（重複の照合用。⚠️ 保存する値はそのまま） */
const digits = (value: string): string => value.replace(/\D/g, '');
/** ⚠️ 土地新着ネットは電話番号（landline）だけの人もいるので、携帯と電話の両方の列と比べる */
const SAME_PHONE_SQL = "(REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ? OR REPLACE(REPLACE(landline, '-', ''), ' ', '') = ?)";

interface DuplicateRow extends RowDataPacket {
    shop: string;
    medium: string;
}

export const runTochishinchakuEntry = async (raw: Record<string, unknown>): Promise<TochishinchakuEntryResult> => {
    const body = raw ?? {};

    // ⚠️ 合い言葉を最初に確かめる（member_entry と同じ理由）
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、土地新着ネットの取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const inquiryId = clean(body.inquiry_id, 200);
    const inquiryDate = clean(body.inquiry_date, 10);
    const name = clean(body.name, 120);
    const mail = clean(body.mail, 190);
    const mobile = clean(body.mobile, 30);
    const tel = clean(body.tel, 30);

    if (!inquiryId.startsWith(INQUIRY_ID_PREFIX) || !DATE_PATTERN.test(inquiryDate) || name === '' || (mail === '' && mobile === '' && tel === '')) {
        logger.warn(`tochishinchaku_entry: 必要な項目がありません id="${inquiryId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）。⚠️ 携帯が無ければ電話で照合する
        const phone = digits(mobile) || digits(tel);
        const conditions: string[] = [];
        const params: string[] = [];
        if (mail !== '') { conditions.push('mail = ?'); params.push(mail); }
        if (phone.length >= 10) { conditions.push(SAME_PHONE_SQL); params.push(phone, phone); }
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
        // ⚠️ メールの「電話番号」（以前は保存していなかった）
        values.landline = tel;
        values.mail = mail;
        values.zip = clean(body.zip, 10);
        values.building = clean(body.address, 300);
        // ⚠️ 希望エリアの1行目（以前と同じ）。⚠️ 全部の希望エリアは備考に入る
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
        logger.error(`tochishinchaku_entry: inquiry_customer への保存に失敗 id="${inquiryId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データの追加に失敗しました。' } };
    }

    logger.info(`tochishinchaku_entry を受け付けました id="${inquiryId}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが反響一覧に追加されました。`, id: inquiryId } };
};
```

### backend-express/src/gateway/registry.ts（追加分）
```ts
import { runTochishinchakuEntry } from '../features/tochishinchaku/entry';

/**
 * ⚠️⚠️ **土地新着ネットの新規会員登録の取り込み。書き込み口である。**（v2.2.212）
 *   ⚠️ 送ってくるのは GAS（TochishinchakuToDashboard）。⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY（本文の `key`）。
 *   ⚠️ GAS は ② に届かなければ ① の handlers/tochishinchaku_entry.php へ送り直す（同じ処理）。
 *   ⚠️ 同じ inquiry_id（と、同じ日の同じ人）は二度入らない（2回目は status: exists）。① の転送が二度届いても安全。
 */
register({
  request: 'tochishinchaku_entry',
  summary: '【書き込み・合い言葉】土地新着ネットの新規会員登録の取り込み（inquiry_customer）',
  phpSource: 'khg-marketing.info/api/（誤って消えた。handlers/tochishinchaku_entry.php に作り直し）',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runTochishinchakuEntry(ctx.body as Record<string, unknown>);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});
```

### backend/src/core/express_proxy.php（expressProxyRequests() に追加）
```php
        'kagosuma_entry',
        // ⚠️ v2.2.212。土地新着ネットの取り込み（GAS TochishinchakuToDashboard）。⚠️ member_entry と同じ理由で例外として入れる
        //   （同じ inquiry_id は二度入らない。⚠️ ① の予備は handlers/tochishinchaku_entry.php）
        'tochishinchaku_entry',
```

### backend/src/handlers/tochishinchaku_entry.php（新規）
```php
<?php

/**
 * 土地新着ネットの新規会員登録を inquiry_customer へ保存する。（v2.2.212）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/tochishinchaku/entry.ts の予備である。同じ処理を持つ。**
 *   ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 *   ⚠️ 動くのは ② に届かなかったとき（GAS が送り直したとき・① からの転送が失敗したとき）。
 *   ⚠️ ここを変えたら entry.ts も同じように変えること。
 * ⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY。⚠️ ブランド・店舗は「KHG・ブランド・店舗未設定」で入れる。
 * ⚠️ 土地新着ネットで同じ日に、同じメールか電話の人がいれば登録済み（以前の php と inquiry_id の形が違っても二重に入らないように）。
 * ─────────────────────────────────────────────
 */

/** 制御文字を空白にし、連続する空白を1つにして長さで切る（② の clean と同じ） */
function tochishinchakuClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 改行だけ残す（② の cleanMultiline と同じ） */
function tochishinchakuCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

function tochishinchakuRespond(int $status, array $body): void
{
    http_response_code($status);
    // ⚠️ ② と同じ形にする（inquiry_id をエスケープしない）
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$expectedKey = trim((string)getenv('MEMBER_ENTRY_KEY'));
$inputKey = tochishinchakuClean($data['key'] ?? '', 200);
if ($expectedKey === '' || !hash_equals($expectedKey, $inputKey)) {
    if ($expectedKey === '') {
        error_log('tochishinchaku_entry: MEMBER_ENTRY_KEY が未設定のため断りました');
    }
    tochishinchakuRespond(401, ['status' => 'error', 'message' => '合い言葉が違います。']);
}

$medium      = '土地新着ネット';
$inquiryId   = tochishinchakuClean($data['inquiry_id'] ?? '', 200);
$inquiryDate = tochishinchakuClean($data['inquiry_date'] ?? '', 10);
$name        = tochishinchakuClean($data['name'] ?? '', 120);
$mail        = tochishinchakuClean($data['mail'] ?? '', 190);
$mobile      = tochishinchakuClean($data['mobile'] ?? '', 30);
$tel         = tochishinchakuClean($data['tel'] ?? '', 30);

if (
    strpos($inquiryId, 'tochishinchaku_') !== 0
    || !preg_match('#^\d{4}/\d{2}/\d{2}$#', $inquiryDate)
    || $name === ''
    || ($mail === '' && $mobile === '' && $tel === '')
) {
    error_log("tochishinchaku_entry: 必要な項目がありません id=\"{$inquiryId}\"");
    tochishinchakuRespond(400, ['status' => 'error', 'message' => '必要な項目がありません。']);
}

try {
    // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）。⚠️ 携帯が無ければ電話で照合する
    $phone = preg_replace('/\D/', '', $mobile) ?? '';
    if ($phone === '') {
        $phone = preg_replace('/\D/', '', $tel) ?? '';
    }
    $conditions = [];
    $params = [];
    if ($mail !== '') {
        $conditions[] = 'mail = ?';
        $params[] = $mail;
    }
    // ⚠️ 電話番号（landline）だけの人もいるので、携帯と電話の両方の列と比べる
    if (strlen($phone) >= 10) {
        $conditions[] = "(REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ? OR REPLACE(REPLACE(landline, '-', ''), ' ', '') = ?)";
        $params[] = $phone;
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
        tochishinchakuRespond(200, ['status' => 'exists', 'message' => '登録済みです。', 'id' => $inquiryId]);
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
    $values['first_name_kana'] = tochishinchakuClean($data['kana'] ?? '', 120);
    $values['mobile'] = $mobile;
    $values['landline'] = $tel;
    $values['mail'] = $mail;
    $values['zip'] = tochishinchakuClean($data['zip'] ?? '', 10);
    $values['building'] = tochishinchakuClean($data['address'] ?? '', 300);
    $values['area'] = tochishinchakuClean($data['area'] ?? '', 200);
    $values['brand'] = 'KHG';
    $values['shop'] = 'ブランド・店舗未設定';
    $values['remarks'] = tochishinchakuCleanMultiline($data['remarks'] ?? '', 2000);
    $values['duplicate'] = $duplicate;

    $placeholders = implode(', ', array_fill(0, count($notNullColumns), '?'));
    $stmt = $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $notNullColumns) . ") VALUES ({$placeholders})");
    $stmt->execute(array_values($values));
} catch (PDOException $e) {
    error_log("tochishinchaku_entry: inquiry_customer への保存に失敗 id=\"{$inquiryId}\": " . $e->getMessage());
    tochishinchakuRespond(500, ['status' => 'error', 'message' => 'データの追加に失敗しました。']);
}

error_log("tochishinchaku_entry: ① で受け付けました id=\"{$inquiryId}\"");
tochishinchakuRespond(200, ['status' => 'success', 'message' => "{$name} のデータが反響一覧に追加されました。", 'id' => $inquiryId]);
```

### backend/scripts/gas/TochishinchakuToDashboard.gs（新規）
```js
// =====================================================================
// 土地新着ネットの「新規会員登録発生通知メール」→ 反響（inquiry_customer）として取り込む（v2.2.212）
//
// ⚠️ 送信元: 土地新着ネット <ask@tochi-shinchaku.net>
// ⚠️ 件名  : 新規会員登録発生通知メール
// ⚠️ トリガー: TochishinchakuToDashboard（関数名は以前と同じ）
//
// ⚠️ 送り先:
//   1. ② https://api.khg-marketing.info/api/gateway （request: tochishinchaku_entry）
//   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
//      （① の handlers/tochishinchaku_entry.php が同じ処理をする）
//   ⚠️ 同じ inquiry_id（と、同じ日の同じ人）は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
//   ⚠️ 以前の版が Authorization ヘッダーに直書きしていた合い言葉は使わない（消してよい）。
// ⚠️ ブランド・店舗は送らない（受け側が「KHG・ブランド・店舗未設定」で入れる。指示）。
//
// ⚠️ 以前の版（api/ 宛て。php は誤って消えた）から直したところ:
//   - ラベルで探さない（件名で探す）。Parser ライブラリを使わない（行ごとに読む）
//   - 「電話番号」も送る（以前は読んでいたが保存されていなかった）
//   - 希望エリアの全部・希望価格・面積・校区・路線・建築の予定・ハウスメーカー・その他・発生源を備考（remarks）に残す
//   - 名前もメールも電話も読めないメールは送らない
// =====================================================================

const TOCHI_EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
const TOCHI_PHP_URL = 'https://khg-marketing.info/dashboard/api/gateway/';
/** ⚠️ 件名で探す（指示）。⚠️ 本文の見出しでも土地新着ネットのメールか確かめる */
const TOCHI_SUBJECT = '新規会員登録発生通知メール';
const TOCHI_BODY_MARK = '土地新着ネットの新規会員登録情報';
/** ⚠️ 以前と同じく 3日分を毎回読む（取り込み済みは受け側が飛ばす） */
const TOCHI_QUERY = 'subject:"' + TOCHI_SUBJECT + '" newer_than:3d';

/** 上の段の「見出し：値」（⚠️ 本文の見出しのまま） */
const TOCHI_LABELS = ['発生源', 'メールアドレス', 'お名前', 'フリガナ', '住所', '電話番号', '携帯番号', 'メール送信'];
/** 「土地希望条件」の ■ 見出しのうち、備考に残すもの（⚠️ この順で並べる） */
const TOCHI_CONDITIONS = ['希望エリア', '希望路線', '希望価格', '希望土地面積', '希望校区',
  '建築の予定はありますか？', 'ハウスメーカーはお決まりですか？', 'その他希望条件'];

/** 半角・全角の空白を前後から除く */
function tochiTrim(text) {
  return String(text || '').replace(/^[\s　]+|[\s　]+$/g, '');
}

/** 全角の英数字・記号を半角に（電話・郵便番号用） */
function tochiToHalfWidth(text) {
  return String(text || '').replace(/[！-～]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/**
 * 本文を読む。⚠️ 戻り値は { fields: { 見出し: 値 }, conditions: { ■見出し: [行, ...] } }。
 *
 * ⚠️ 上の段は「見出し：値」（全角コロン）。⚠️ 値が空の見出し（電話番号：）もある。
 * ⚠️ 「土地希望条件」より下は「■ 見出し」の次の行からが値（複数行）。次の ■ か「このメールは」で閉じる。
 */
function tochiParse(body) {
  const result = { fields: {}, conditions: {} };
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  let inConditions = false;
  let current = '';

  for (const line of lines) {
    const trimmed = tochiTrim(line);
    if (trimmed === '土地希望条件') { inConditions = true; current = ''; continue; }
    if (/^このメールは/.test(trimmed)) break;

    if (inConditions) {
      const head = trimmed.match(/^■[\s　]*(.+)$/);
      if (head) { current = tochiTrim(head[1]); result.conditions[current] = []; continue; }
      if (current && trimmed !== '') result.conditions[current].push(trimmed);
      continue;
    }
    const matched = trimmed.match(/^([^：:]+?)[\s　]*[：:][\s　]*(.*)$/);
    if (matched && TOCHI_LABELS.indexOf(matched[1]) !== -1) result.fields[matched[1]] = tochiTrim(matched[2]);
  }
  return result;
}

/**
 * 住所「〒893-0032　鹿児島県鹿屋市…」→ [郵便番号（893-0032 の形。以前と同じ）, 住所]
 * ⚠️ 〒 が無い・郵便番号が無い住所でもそのまま住所として返す。
 */
function tochiSplitAddress(text) {
  const value = tochiTrim(text);
  const m = tochiToHalfWidth(value).match(/^〒?[\s　]*(\d{3})-?(\d{4})[\s　]*/);
  if (!m) return ['', value.replace(/^〒[\s　]*/, '')];
  return [m[1] + '-' + m[2], tochiTrim(value.slice(m[0].length))];
}

/** 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 } */
function tochiBuildPayload(subject, body, date) {
  const s = String(subject || '');
  if (s.indexOf(TOCHI_SUBJECT) === -1) return { skip: '件名が違う' };
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };
  if (String(body || '').indexOf(TOCHI_BODY_MARK) === -1) return { skip: '土地新着ネットのメールではない' };

  const parsed = tochiParse(body);
  const f = parsed.fields;
  const c = parsed.conditions;
  const name = (f['お名前'] || '').replace(/[\s　]+/g, ' ');
  const mail = tochiToHalfWidth(f['メールアドレス']).replace(/[\s　]/g, '');
  const mobile = tochiToHalfWidth(f['携帯番号']).replace(/[\s　]/g, '');
  const tel = tochiToHalfWidth(f['電話番号']).replace(/[\s　]/g, '');
  if (name === '') return { skip: 'お名前が読めない' };
  if (mail === '' && mobile === '' && tel === '') return { skip: 'メールも電話も無い' };

  const address = tochiSplitAddress(f['住所']);
  const areas = c['希望エリア'] || [];
  const remarks = TOCHI_CONDITIONS
    .map(function (label) { return [label, (c[label] || []).join('、')]; })
    .concat([['発生源', f['発生源'] || ''], ['メール送信', f['メール送信'] || '']])
    .filter(function (pair) { return pair[1]; })
    .map(function (pair) { return pair[0] + '：' + pair[1]; })
    .join('\n');

  return {
    request: 'tochishinchaku_entry',
    // ⚠️ 以前と同じ形（tochishinchaku_＋受信日＋受信日時）。⚠️ 変えないこと（取り込み済みのメールが二重に入る）
    inquiry_id: 'tochishinchaku_' + Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd')
      + Utilities.formatDate(date, 'Asia/Tokyo', 'yyyyMMdd_HHmmss'),
    inquiry_date: Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd'),
    name: name,
    kana: (f['フリガナ'] || '').replace(/[\s　]+/g, ' '),
    mail: mail,
    mobile: mobile,
    tel: tel,
    zip: address[0],
    address: address[1],
    // ⚠️ 以前と同じく希望エリアの1行目（全部は備考に入る）
    area: areas[0] || '',
    remarks: remarks
  };
}

/**
 * 送る。② → だめなら ①。
 * ⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。401・400 は ① でも同じなので送り直さない。
 */
function tochiPost(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const targets = [['②', TOCHI_EXPRESS_URL], ['①', TOCHI_PHP_URL]];
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
function TochishinchakuToDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  GmailApp.search(TOCHI_QUERY).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const payload = tochiBuildPayload(message.getSubject(), message.getPlainBody(), message.getDate());
      if (payload.skip) {
        Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
        return;
      }
      payload.key = key;
      tochiPost(payload);
    });
  });
}
```

### backend/scripts/sql/2026-10-23_update_log_2.2.212.sql（新規）
```sql
-- =====================================================================
-- update_log に v2.2.212 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.212', '2026-10-23', '土地新着ネットの会員登録の取り込みを作り直した。メールは件名で探し、ブランド・店舗は「ブランド・店舗未設定」で入れる。電話番号と、希望エリア・希望価格・面積などの希望条件を備考に残すようにした。');
```
