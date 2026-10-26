# カゴスマ・タテルヤの反響の取り込みを作り直す（v2.2.211）

## 依頼（ReadMeClaude.md）
- v2.2.211 で作業開始
- portal.php は誤って廃棄。GAS `KagosumatoDashboard` が登録する API を作る
- メールは2種類（資料送付・イベント参加リクエスト）。**件名で読む**
- 店舗設定のマッピングも最新にする

## 承認した計画
- ハウジングバザール（v2.2.210）と同じ形：GAS → ② `kagosuma_entry`、② に届かなければ ① の予備 `kagosuma_entry.php`
- 合い言葉は `MEMBER_ENTRY_KEY`（会員登録と同じ）。媒体は以前どおり「カゴスマ」
- 店舗の表は sync の `src/utils/portalShopList.ts`（417件・福岡県 → KH久留米店）をそのまま写す。決まらないときは shop_list に実在する「◯◯店舗未設定」
- イベントの希望日時は備考に入れ、来場予約の欄には入れない

## 以前の GAS から直したところ
| 以前 | 今回 |
|---|---|
| ラベル `反響管理_カゴスマnew` で探す | 件名（カゴスマ／タテルヤ ＋ 資料送付／イベント参加リクエスト）で探す。除外（[khf]・kaeru 宛て）と 20日分は同じ |
| イベントのメールを「居住希望エリア」で読む（見出しは「居住**予定**エリア」）→ **エリアが空** | 両方の見出しを読む |
| 店舗はエリアだけで決める | エリア → 住所 → 「◯◯店舗未設定」 |
| 2L は常に 2L鹿児島店 | 表どおり（鹿児島県内は 2L鹿児島店、県外は 2L店舗未設定） |
| 決まらないときは `ブランド名＋店舗未設定`（「PG HOUSE店舗未設定」「KHG店舗未設定」は shop_list に無い） | portalShopList.ts の NOT_FOUND_SHOP と同じ（PGH店舗未設定 など）。ブランド不明は KHG・ブランド・店舗未設定 |
| ブランドが読めない資料送付メールは捨てる | KHG・ブランド・店舗未設定 で入れる |
| 資料送付の 2L 判定だけ「二ーエルホーム」（漢字の二） | 「ニ」「二」どちらでも |
| イベントのメールの名前に「様」が残る | 外す |
| 家づくりの希望・イベントの希望日時を捨てる | 備考（remarks）に残す。「(未入力)」は入れない |
| Parser ライブラリ | 区切り線（-----）の間を「見出し：値」で行ごとに読む（署名の住所・電話は拾わない） |

⚠️ inquiry_id は以前と同じ形（`kagosuma` ＋ UTC の日時 ＋ ブランド）。取り込み済みのメールは二重に入らない。

## 変更・追加したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/kagosuma/ | **entry.ts**（新規） | `runKagosumaEntry` |
| backend-express/src/gateway/ | registry.ts | `kagosuma_entry` を登録（auth none） |
| backend/src/core/ | express_proxy.php | `expressProxyRequests()` に `kagosuma_entry`（⚠️ Exclusive には入れない。① の予備を動かすため） |
| backend/src/handlers/ | **kagosuma_entry.php**（新規） | ① の予備（同じ処理）。`kagosumaClean` `kagosumaCleanMultiline` `kagosumaRespond` |
| backend/scripts/gas/ | **KagosumatoDashboard.gs**（新規） | `KagosumatoDashboard`（トリガー） `kagosumaParse` `kagosumaBuildPayload` `kagosumaResolveBrand` `kagosumaFindShop` `kagosumaResolveShop` `kagosumaPost` ほか |
| backend/scripts/sql/ | **2026-10-23_update_log_2.2.211.sql**（新規） | update_log（ローカル no=311 で反映済み） |
| frontend/src/utils/ | version.ts | 2.2.211 |
| docs/ | deploy-v2.2.211.md（新規）・本書 | |

- 業務ガイドの記事：画面の変更が無いので直していない。
- docs の 2026-10-21 作成分（deploy-v2.2.203〜206・plan-2026-10-21・task-2026-10-21-01〜07）を oldDocument へ移した。

## 確かめたこと
1. **GAS の読み取り**（Node で GAS をそのまま動かし、ReadMeClaude のメール本文を入れた）
   - 資料送付 → PG HOUSE / PGH霧島店、エリア 鹿児島市、住所、備考（同時請求3社〜ご要望）
   - イベント → KH / KH八代店、エリア 八代市（以前は空）、名前「今里」（様を外す）、備考に希望日時。「備考：(未入力)」は入らない
   - 改行が CRLF でも同じ／2L（漢字の二）・熊本 → 2L店舗未設定／ブランド不明 → KHG・ブランド・店舗未設定／エリア未入力・福岡県の住所 → KH久留米店（住所で決まる）／DJH・八代市 → DJH店舗未設定／ご要望の複数行（途中に「時間：…」がある行も続きとして入る）
   - 送らない：返信、[khf]、kaeru 宛て、サイト名の無い「資料送付」
2. **表の店舗名**：表の31店舗＋未設定8つ、計39がすべてローカルの shop_list に実在
3. **① 経由で ②**（localhost:8080）：トークン無し 401（② まで届く）／合い言葉なし 401／名前なし 400／店舗なし 400／正しいもの 200 success／同じもの 200 exists／電話だけ一致する別の反響 → duplicate に「PGH霧島店 カゴスマ 重複」
4. **② を止めて ① の PHP**：success / exists / duplicate とも同じ結果
5. 保存した列（媒体・反響媒体＝カゴスマ、brand・shop・area・building・remarks、sync=0、delete_flag=0）を DB で確認。テストの行は削除済み
6. 回帰：member_entry・housing_bazar_entry も ① 経由で 401（② に届く）
7. `tsc --noEmit` OK、`php -l` OK
8. リファクタリング：`kagosumaResolveShop` のブランド不明の分岐を消した（表にも NOT_FOUND にも KHG が無いので、最後の既定値で同じ結果になる）。消したあと 1・3 を再実行して同じ結果

## コード

### backend-express/src/features/kagosuma/entry.ts（新規）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';
import { duplicateNote, keyMatches } from '../memberEntry/entry';

/**
 * カゴスマ・タテルヤ（株式会社ミカタ）の通知メールを inquiry_customer へ保存する。（v2.2.211）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS の KagosumatoDashboard（backend/scripts/gas/KagosumatoDashboard.gs）。
 *   「資料送付」「イベント参加リクエスト」のメールを読み取り、**ブランド・店舗まで決めてから**送ってくる。
 *   ⚠️ ここでは店舗を決め直さない（member_entry と同じ）。
 * ⚠️ 届かなかったとき GAS は ① の handlers/kagosuma_entry.php へ送り直す。**同じ処理を PHP にも持っている。**
 *   ⚠️ ここを変えたら kagosuma_entry.php も同じように変えること。
 * ⚠️ 移植元は ① `khg-marketing.info/api/portal.php`（⚠️ 誤って消えた。中身は残っていない）。
 * ⚠️ 合い言葉は会員登録の取り込み（member_entry）と同じ MEMBER_ENTRY_KEY。
 * ⚠️ 媒体は以前と同じく、タテルヤのメールも「カゴスマ」（媒体一覧に「タテルヤ」は無い）。
 * ⚠️ 重複：同じ inquiry_id は二度入らない。同じ人（メールか電話が一致）が既にいれば duplicate に「店舗 媒体 重複」。
 * ─────────────────────────────────────────────
 */

export interface KagosumaEntryResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** ⚠️ 以前の GAS と同じ形（kagosuma＋UTC の日時＋ブランド）。⚠️ 取り込み済みのメールが二重に入らないように */
const INQUIRY_ID_PREFIX = 'kagosuma';
const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;
const MEDIUM = 'カゴスマ';

/** 電話の数字だけ（重複の照合用。⚠️ 保存する値はそのまま） */
const digits = (value: string): string => value.replace(/\D/g, '');

interface DuplicateRow extends RowDataPacket {
    shop: string;
    medium: string;
}

export const runKagosumaEntry = async (raw: Record<string, unknown>): Promise<KagosumaEntryResult> => {
    const body = raw ?? {};

    // ⚠️ 合い言葉を最初に確かめる（member_entry と同じ理由）
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、カゴスマの取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const inquiryId = clean(body.inquiry_id, 200);
    const inquiryDate = clean(body.inquiry_date, 10);
    const name = clean(body.name, 120);
    const mail = clean(body.mail, 190);
    const mobile = clean(body.mobile, 30);
    const brand = clean(body.brand, 30);
    const shop = clean(body.shop, 80);

    if (!inquiryId.startsWith(INQUIRY_ID_PREFIX) || !DATE_PATTERN.test(inquiryDate)
        || brand === '' || shop === '' || name === '' || (mail === '' && mobile === '')) {
        logger.warn(`kagosuma_entry: 必要な項目がありません id="${inquiryId}" brand="${brand}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        const existing = await query<RowDataPacket>('SELECT id FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1', [inquiryId]);
        if (existing.length > 0) {
            return { httpStatus: 200, body: { status: 'exists', message: '登録済みです。', id: inquiryId } };
        }

        // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない。housing_bazar_entry と同じ）
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
        values.building = clean(body.address, 300);
        // ⚠️ 居住希望（予定）エリア。以前の GAS と同じく area
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
        logger.error(`kagosuma_entry: inquiry_customer への保存に失敗 id="${inquiryId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データの追加に失敗しました。' } };
    }

    logger.info(`kagosuma_entry を受け付けました id="${inquiryId}" brand="${brand}" shop="${shop}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが反響一覧に追加されました。`, id: inquiryId } };
};
```

### backend-express/src/gateway/registry.ts（追加分）
```ts
import { runKagosumaEntry } from '../features/kagosuma/entry';

/**
 * ⚠️⚠️ **カゴスマ・タテルヤの資料送付／イベント参加リクエストの取り込み。書き込み口である。**（v2.2.211）
 *   ⚠️ 送ってくるのは GAS（KagosumatoDashboard）。⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY（本文の `key`）。
 *   ⚠️ GAS は ② に届かなければ ① の handlers/kagosuma_entry.php へ送り直す（同じ処理）。
 *   ⚠️ 同じ inquiry_id は二度入らない（2回目は status: exists）。① の転送が二度届いても安全。
 */
register({
  request: 'kagosuma_entry',
  summary: '【書き込み・合い言葉】カゴスマ・タテルヤの反響の取り込み（inquiry_customer）',
  phpSource: 'khg-marketing.info/api/portal.php（誤って消えた。handlers/kagosuma_entry.php に作り直し）',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runKagosumaEntry(ctx.body as Record<string, unknown>);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});
```

### backend/src/core/express_proxy.php（expressProxyRequests() に追加）
```php
        'housing_bazar_entry',
        // ⚠️ v2.2.211。カゴスマ・タテルヤの取り込み（GAS KagosumatoDashboard）。⚠️ member_entry と同じ理由で例外として入れる
        //   （同じ inquiry_id は二度入らない。⚠️ ① の予備は handlers/kagosuma_entry.php）
        'kagosuma_entry',
```

### backend/src/handlers/kagosuma_entry.php（新規）
```php
<?php

/**
 * カゴスマ・タテルヤの資料送付／イベント参加リクエストを inquiry_customer へ保存する。（v2.2.211）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/kagosuma/entry.ts の予備である。同じ処理を持つ。**
 *   ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 *   ⚠️ 動くのは ② に届かなかったとき（GAS が送り直したとき・① からの転送が失敗したとき）。
 *   ⚠️ ここを変えたら entry.ts も同じように変えること。
 * ⚠️ 合い言葉は member_entry と同じ MEMBER_ENTRY_KEY。⚠️ ブランド・店舗は GAS が決めて送ってくる（ここでは決め直さない）。
 * ─────────────────────────────────────────────
 */

/** 制御文字を空白にし、連続する空白を1つにして長さで切る（② の clean と同じ） */
function kagosumaClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 改行だけ残す（② の cleanMultiline と同じ） */
function kagosumaCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

function kagosumaRespond(int $status, array $body): void
{
    http_response_code($status);
    // ⚠️ ② と同じ形にする（inquiry_id をエスケープしない）
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$expectedKey = trim((string)getenv('MEMBER_ENTRY_KEY'));
$inputKey = kagosumaClean($data['key'] ?? '', 200);
if ($expectedKey === '' || !hash_equals($expectedKey, $inputKey)) {
    if ($expectedKey === '') {
        error_log('kagosuma_entry: MEMBER_ENTRY_KEY が未設定のため断りました');
    }
    kagosumaRespond(401, ['status' => 'error', 'message' => '合い言葉が違います。']);
}

$inquiryId   = kagosumaClean($data['inquiry_id'] ?? '', 200);
$inquiryDate = kagosumaClean($data['inquiry_date'] ?? '', 10);
$name        = kagosumaClean($data['name'] ?? '', 120);
$mail        = kagosumaClean($data['mail'] ?? '', 190);
$mobile      = kagosumaClean($data['mobile'] ?? '', 30);
$brand       = kagosumaClean($data['brand'] ?? '', 30);
$shop        = kagosumaClean($data['shop'] ?? '', 80);

if (
    strpos($inquiryId, 'kagosuma') !== 0
    || !preg_match('#^\d{4}/\d{2}/\d{2}$#', $inquiryDate)
    || $brand === ''
    || $shop === ''
    || $name === ''
    || ($mail === '' && $mobile === '')
) {
    error_log("kagosuma_entry: 必要な項目がありません id=\"{$inquiryId}\" brand=\"{$brand}\"");
    kagosumaRespond(400, ['status' => 'error', 'message' => '必要な項目がありません。']);
}

try {
    $stmt = $pdo->prepare('SELECT id FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1');
    $stmt->execute([$inquiryId]);
    if ($stmt->fetch()) {
        kagosumaRespond(200, ['status' => 'exists', 'message' => '登録済みです。', 'id' => $inquiryId]);
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
    $values['medium'] = 'カゴスマ';
    $values['response_medium'] = 'カゴスマ';
    $values['first_name'] = $name;
    $values['first_name_kana'] = kagosumaClean($data['kana'] ?? '', 120);
    $values['mobile'] = $mobile;
    $values['mail'] = $mail;
    $values['building'] = kagosumaClean($data['address'] ?? '', 300);
    $values['area'] = kagosumaClean($data['area'] ?? '', 200);
    $values['brand'] = $brand;
    $values['shop'] = $shop;
    $values['remarks'] = kagosumaCleanMultiline($data['remarks'] ?? '', 2000);
    $values['duplicate'] = $duplicate;

    $placeholders = implode(', ', array_fill(0, count($notNullColumns), '?'));
    $stmt = $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $notNullColumns) . ") VALUES ({$placeholders})");
    $stmt->execute(array_values($values));
} catch (PDOException $e) {
    error_log("kagosuma_entry: inquiry_customer への保存に失敗 id=\"{$inquiryId}\": " . $e->getMessage());
    kagosumaRespond(500, ['status' => 'error', 'message' => 'データの追加に失敗しました。']);
}

error_log("kagosuma_entry: ① で受け付けました id=\"{$inquiryId}\" brand=\"{$brand}\" shop=\"{$shop}\"");
kagosumaRespond(200, ['status' => 'success', 'message' => "{$name} のデータが反響一覧に追加されました。", 'id' => $inquiryId]);
```

### backend/scripts/gas/KagosumatoDashboard.gs（新規）
```js
// =====================================================================
// カゴスマ・タテルヤ（株式会社ミカタ）の通知メール → 反響（inquiry_customer）として取り込む（v2.2.211）
//
// ⚠️ 取り込むメールは2種類（件名で見分ける）:
//   - 【カゴスマ】資料送付お願いいたします         … 資料請求（ご住所・居住希望エリア・家づくりの希望がある）
//   - 【タテルヤ】イベント参加リクエスト            … イベントの参加希望（居住予定エリア・希望日時がある）
//   ⚠️ どちらのサイトからもどちらの件名も来うるので、「サイト名」と「種類」を別々に見る。
// ⚠️ トリガー: KagosumatoDashboard（関数名は以前と同じ）
//
// ⚠️ 送り先:
//   1. ② https://api.khg-marketing.info/api/gateway （request: kagosuma_entry）
//   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
//      （① の handlers/kagosuma_entry.php が同じ処理をする）
//   ⚠️ 同じ inquiry_id は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ 会員登録の GAS と同じ値。⚠️ ここに直書きしない。
//
// ⚠️ 以前の版（api/portal.php 宛て。portal.php は誤って消えた）から直したところ:
//   - ラベルで探さない（件名で探す）。Parser ライブラリを使わない（「見出し：値」を行ごとに読む）
//   - イベントのメールでエリアが空だった（見出しは「居住予定エリア」なのに「居住希望エリア」で読んでいた）
//   - 店舗の表を sync の utils/portalShopList.ts（最新）に合わせた（福岡県 → KH久留米店。2L も表どおり）
//   - 店舗はエリアで決め、決まらなければ住所でも探す
//   - 店舗が決まらないときは shop_list に実在する「◯◯店舗未設定」（以前は「KHG店舗未設定」など一覧に無い値もあった）
//   - ブランドが読めない資料送付メールを捨てていた → KHG・ブランド・店舗未設定 で入れる
//   - 名前の「様」をイベントのメールでも外す。2L は「ニ」（カタカナ）と「二」（漢字）のどちらでも読む
//   - 家づくりの希望・イベントの希望日時などを備考（remarks）に残す（「(未入力)」は入れない）
//   ⚠️ イベントの希望日時は来場予約の欄（reserved_date）に入れない（確定前の日時が予約の集計に入るため）
// =====================================================================

const KAGOSUMA_EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
const KAGOSUMA_PHP_URL = 'https://khg-marketing.info/dashboard/api/gateway/';

/** ⚠️ 件名に「サイト名」と「種類」の両方があるメールだけ読む。⚠️ 頭の [marketing]: [lead]: はメーリングリストが付けるもの */
const KAGOSUMA_SITES = ['カゴスマ', 'タテルヤ'];
const KAGOSUMA_KIND_DOCUMENT = '資料送付';
const KAGOSUMA_KIND_EVENT = 'イベント参加リクエスト';
/** ⚠️ 以前と同じ除外：[khf] の付いたメールと kaeru 宛て（建売の別の取り込み）。⚠️ 以前と同じく 20日分を毎回読む */
const KAGOSUMA_EXCLUDE_SUBJECT = '[khf]';
const KAGOSUMA_EXCLUDE_TO = 'kaeru@kh-house.jp';
const KAGOSUMA_QUERY = 'subject:("' + KAGOSUMA_SITES.join('" OR "') + '")'
  + ' subject:("' + KAGOSUMA_KIND_DOCUMENT + '" OR "' + KAGOSUMA_KIND_EVENT + '")'
  + ' -subject:"' + KAGOSUMA_EXCLUDE_SUBJECT + '" -to:' + KAGOSUMA_EXCLUDE_TO
  + ' newer_than:20d';

/**
 * 「◯◯　ご担当者様」の会社名 → ブランド。⚠️ 本文の「資料請求先：…,デイジャストハウス,PGハウス」に当たらないよう、
 * ⚠️ 「ご担当者様」の行だけで見る。⚠️ 2L は「ニ」（カタカナ）と「二」（漢字）の両方が来る。
 */
const KAGOSUMA_BRANDS = [
  { name: '国分ハウジング', brand: 'KH' },
  { name: 'デイジャストハウス', brand: 'DJH' },
  { name: 'ニーエルホーム', brand: '2L' },
  { name: '二ーエルホーム', brand: '2L' },
  { name: 'なごみ工務店', brand: 'Nagomi' },
  { name: 'フルコミホーム', brand: 'FH' },
  { name: 'ジャスフィーホーム', brand: 'JH' },
  { name: 'PGハウス', brand: 'PG HOUSE' }
];
/** ⚠️ ブランドが読めないとき（shop_list に実在する brand = KHG の「ブランド・店舗未設定」） */
const KAGOSUMA_UNKNOWN_BRAND = 'KHG';
const KAGOSUMA_UNKNOWN_SHOP = 'ブランド・店舗未設定';

/** 店舗が決まらないときの店舗名。⚠️ sync の portalShopList.ts の NOT_FOUND_SHOP と同じ。⚠️ どれも shop_list に実在する */
const KAGOSUMA_NOT_FOUND_SHOP = {
  KH: 'KH店舗未設定',
  DJH: 'DJH店舗未設定',
  JH: 'JH店舗未設定',
  Nagomi: 'なごみ店舗未設定',
  'PG HOUSE': 'PGH店舗未設定',
  '2L': '2L店舗未設定',
  FH: 'FH店舗未設定'
};

/**
 * エリア・住所 → 店舗の表。⚠️⚠️ sync の utils/portalShopList.ts を**そのまま写したもの**（2026-10-23。417件）。
 *
 * ⚠️ 照合は「ブランドが同じで、文字列に area を含む最初の1件」。⚠️ **先に一致した行が勝つ。**
 * ⚠️ 追加は必ず末尾に（福岡県も末尾。2文字の area が他県の住所に偶然当たらないように）。
 * ⚠️ shop は shop_list の店舗名と完全一致させること（違うと一覧にも集計にも出ない顧客ができる）。
 * ⚠️ portalShopList.ts を直したら、ここも同じように直すこと。
 */
const KAGOSUMA_SHOP_LIST = [
  { brand: 'KH', shop: 'KH鹿児島店', area: '鹿児島市' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '鹿屋市' },
  { brand: 'KH', shop: 'KH加世田店', area: '枕崎市' },
  { brand: 'KH', shop: 'KH出水阿久根店', area: '阿久根市' },
  { brand: 'KH', shop: 'KH出水阿久根店', area: '出水市' },
  { brand: 'KH', shop: 'KH加世田店', area: '指宿市' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '垂水市' },
  { brand: 'KH', shop: 'KH薩摩川内店', area: '薩摩川内市' },
  { brand: 'KH', shop: 'KH鹿児島店', area: '日置市' },
  { brand: 'KH', shop: 'KH霧島店', area: '曽於市' },
  { brand: 'KH', shop: 'KH霧島店', area: '霧島市' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '曽於郡' },
  { brand: 'KH', shop: 'KH薩摩川内店', area: 'いちき串木野市' },
  { brand: 'KH', shop: 'KH加世田店', area: '南さつま市' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '志布志市' },
  { brand: 'KH', shop: 'KH加世田店', area: '南九州市' },
  { brand: 'KH', shop: 'KH姶良店', area: '伊佐市' },
  { brand: 'KH', shop: 'KH姶良店', area: '姶良市' },
  { brand: 'KH', shop: 'KH薩摩川内店', area: 'さつま町' },
  { brand: 'KH', shop: 'KH出水阿久根店', area: '長島町' },
  { brand: 'KH', shop: 'KH霧島店', area: '湧水町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '大崎町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '東串良町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '錦江町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '南大隅町' },
  { brand: 'KH', shop: 'KH鹿屋店', area: '肝付町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '宮崎市' },
  { brand: 'KH', shop: 'KH都城店', area: '都城市' },
  { brand: 'KH', shop: 'KH延岡店', area: '延岡市' },
  { brand: 'KH', shop: 'KH都城店', area: '日南市' },
  { brand: 'KH', shop: 'KH都城店', area: '小林市' },
  { brand: 'KH', shop: 'KH延岡店', area: '日向市' },
  { brand: 'KH', shop: 'KH都城店', area: '串間市' },
  { brand: 'KH', shop: 'KH宮崎店', area: '西都市' },
  { brand: 'KH', shop: 'KH都城店', area: 'えびの市' },
  { brand: 'KH', shop: 'KH都城店', area: '三股町' },
  { brand: 'KH', shop: 'KH都城店', area: '高原町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '国富町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '綾町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '高鍋町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '新富町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '西米良村' },
  { brand: 'KH', shop: 'KH宮崎店', area: '木城町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '川南町' },
  { brand: 'KH', shop: 'KH宮崎店', area: '都農町' },
  { brand: 'KH', shop: 'KH延岡店', area: '門川町' },
  { brand: 'KH', shop: 'KH延岡店', area: '諸塚村' },
  { brand: 'KH', shop: 'KH延岡店', area: '椎葉村' },
  { brand: 'KH', shop: 'KH延岡店', area: '美郷町' },
  { brand: 'KH', shop: 'KH延岡店', area: '高千穂町' },
  { brand: 'KH', shop: 'KH延岡店', area: '日之影町' },
  { brand: 'KH', shop: 'KH延岡店', area: '五ヶ瀬町' },
  { brand: 'KH', shop: 'KH熊本店', area: '熊本市' },
  { brand: 'KH', shop: 'KH八代店', area: '八代市' },
  { brand: 'KH', shop: 'KH八代店', area: '人吉市' },
  { brand: 'KH', shop: 'KH熊本店', area: '荒尾市' },
  { brand: 'KH', shop: 'KH出水阿久根店', area: '水俣市' },
  { brand: 'KH', shop: 'KH熊本店', area: '玉名市' },
  { brand: 'KH', shop: 'KH熊本店', area: '山鹿市' },
  { brand: 'KH', shop: 'KH熊本店', area: '菊池市' },
  { brand: 'KH', shop: 'KH八代店', area: '宇土市' },
  { brand: 'KH', shop: 'KH八代店', area: '上天草市' },
  { brand: 'KH', shop: 'KH八代店', area: '宇城市' },
  { brand: 'KH', shop: 'KH熊本店', area: '阿蘇市' },
  { brand: 'KH', shop: 'KH八代店', area: '天草市' },
  { brand: 'KH', shop: 'KH熊本店', area: '合志市' },
  { brand: 'KH', shop: 'KH熊本店', area: '美里町' },
  { brand: 'KH', shop: 'KH熊本店', area: '玉東町' },
  { brand: 'KH', shop: 'KH熊本店', area: '南関町' },
  { brand: 'KH', shop: 'KH熊本店', area: '長洲町' },
  { brand: 'KH', shop: 'KH熊本店', area: '和水町' },
  { brand: 'KH', shop: 'KH熊本店', area: '大津町' },
  { brand: 'KH', shop: 'KH熊本店', area: '菊陽町' },
  { brand: 'KH', shop: 'KH熊本店', area: '南小国町' },
  { brand: 'KH', shop: 'KH熊本店', area: '小国町' },
  { brand: 'KH', shop: 'KH熊本店', area: '産山村' },
  { brand: 'KH', shop: 'KH熊本店', area: '高森町' },
  { brand: 'KH', shop: 'KH熊本店', area: '西原村' },
  { brand: 'KH', shop: 'KH熊本店', area: '南阿蘇村' },
  { brand: 'KH', shop: 'KH熊本店', area: '御船町' },
  { brand: 'KH', shop: 'KH熊本店', area: '嘉島町' },
  { brand: 'KH', shop: 'KH熊本店', area: '益城町' },
  { brand: 'KH', shop: 'KH熊本店', area: '甲佐町' },
  { brand: 'KH', shop: 'KH熊本店', area: '山都町' },
  { brand: 'KH', shop: 'KH八代店', area: '氷川町' },
  { brand: 'KH', shop: 'KH八代店', area: '芦北町' },
  { brand: 'KH', shop: 'KH八代店', area: '津奈木町' },
  { brand: 'KH', shop: 'KH八代店', area: '錦町' },
  { brand: 'KH', shop: 'KH八代店', area: '多良木町' },
  { brand: 'KH', shop: 'KH八代店', area: '湯前町' },
  { brand: 'KH', shop: 'KH八代店', area: '水上村' },
  { brand: 'KH', shop: 'KH八代店', area: '相良村' },
  { brand: 'KH', shop: 'KH八代店', area: '五木村' },
  { brand: 'KH', shop: 'KH八代店', area: '山江村' },
  { brand: 'KH', shop: 'KH八代店', area: '球磨村' },
  { brand: 'KH', shop: 'KH八代店', area: 'あさぎり町' },
  { brand: 'KH', shop: 'KH八代店', area: '苓北町' },
  { brand: 'KH', shop: 'KH大分店', area: '大分市' },
  { brand: 'KH', shop: 'KH大分店', area: '別府市' },
  { brand: 'KH', shop: 'KH大分店', area: '中津市' },
  { brand: 'KH', shop: 'KH大分店', area: '日田市' },
  { brand: 'KH', shop: 'KH大分店', area: '佐伯市' },
  { brand: 'KH', shop: 'KH大分店', area: '臼杵市' },
  { brand: 'KH', shop: 'KH大分店', area: '津久見市' },
  { brand: 'KH', shop: 'KH大分店', area: '竹田市' },
  { brand: 'KH', shop: 'KH大分店', area: '豊後高田市' },
  { brand: 'KH', shop: 'KH大分店', area: '杵築市' },
  { brand: 'KH', shop: 'KH大分店', area: '宇佐市' },
  { brand: 'KH', shop: 'KH大分店', area: '豊後大野市' },
  { brand: 'KH', shop: 'KH大分店', area: '由布市' },
  { brand: 'KH', shop: 'KH大分店', area: '国東市' },
  { brand: 'KH', shop: 'KH大分店', area: '姫島村' },
  { brand: 'KH', shop: 'KH大分店', area: '日出町' },
  { brand: 'KH', shop: 'KH大分店', area: '九重町' },
  { brand: 'KH', shop: 'KH大分店', area: '玖珠町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '佐賀市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '唐津市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '鳥栖市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '多久市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '伊万里市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '武雄市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '鹿島市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '小城市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '嬉野市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '神埼市' },
  { brand: 'KH', shop: 'KH佐賀店', area: '吉野ヶ里町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '基山町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '上峰町' },
  { brand: 'KH', shop: 'KH佐賀店', area: 'みやき町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '玄海町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '有田町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '大町町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '江北町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '白石町' },
  { brand: 'KH', shop: 'KH佐賀店', area: '太良町' },
  { brand: 'DJH', shop: 'DJH鹿児島北店', area: '鹿児島市' },
  { brand: 'DJH', shop: 'DJH鹿屋店', area: '鹿屋市' },
  { brand: 'DJH', shop: 'DJH鹿児島北店', area: '枕崎市' },
  { brand: 'DJH', shop: 'DJH薩摩川内店', area: '阿久根市' },
  { brand: 'DJH', shop: 'DJH薩摩川内店', area: '出水市' },
  { brand: 'DJH', shop: 'DJH鹿児島北店', area: '指宿市' },
  { brand: 'DJH', shop: 'DJH鹿屋店', area: '垂水市' },
  { brand: 'DJH', shop: 'DJH薩摩川内店', area: '薩摩川内市' },
  { brand: 'DJH', shop: 'DJH鹿児島北店', area: '日置市' },
  { brand: 'DJH', shop: 'DJH霧島店', area: '曽於市' },
  { brand: 'DJH', shop: 'DJH霧島店', area: '霧島市' },
  { brand: 'DJH', shop: 'DJH薩摩川内店', area: 'いちき串木野市' },
  { brand: 'DJH', shop: 'DJH鹿児島北店', area: '南さつま市' },
  { brand: 'DJH', shop: 'DJH鹿屋店', area: '志布志市' },
  { brand: 'DJH', shop: 'DJH鹿児島北店', area: '南九州市' },
  { brand: 'DJH', shop: 'DJH霧島店', area: '伊佐市' },
  { brand: 'DJH', shop: 'DJH霧島店', area: '姶良市' },
  { brand: 'DJH', shop: 'DJH薩摩川内店', area: 'さつま町' },
  { brand: 'DJH', shop: 'DJH薩摩川内店', area: '長島町' },
  { brand: 'DJH', shop: 'DJH霧島店', area: '湧水町' },
  { brand: 'DJH', shop: 'DJH鹿屋店', area: '大崎町' },
  { brand: 'DJH', shop: 'DJH鹿屋店', area: '東串良町' },
  { brand: 'DJH', shop: 'DJH鹿屋店', area: '錦江町' },
  { brand: 'DJH', shop: 'DJH鹿屋店', area: '南大隅町' },
  { brand: 'DJH', shop: 'DJH鹿屋店', area: '肝付町' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '宮崎市' },
  { brand: 'DJH', shop: 'DJH都城店', area: '都城市' },
  { brand: 'DJH', shop: 'DJH延岡店', area: '延岡市' },
  { brand: 'DJH', shop: 'DJH都城店', area: '日南市' },
  { brand: 'DJH', shop: 'DJH都城店', area: '小林市' },
  { brand: 'DJH', shop: 'DJH延岡店', area: '日向市' },
  { brand: 'DJH', shop: 'DJH都城店', area: '串間市' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '西都市' },
  { brand: 'DJH', shop: 'DJH都城店', area: 'えびの市' },
  { brand: 'DJH', shop: 'DJH都城店', area: '三股町' },
  { brand: 'DJH', shop: 'DJH都城店', area: '高原町' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '国富町' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '綾町' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '高鍋町' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '新富町' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '西米良村' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '木城町' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '川南町' },
  { brand: 'DJH', shop: 'DJH宮崎店', area: '都農町' },
  { brand: 'DJH', shop: 'DJH延岡店', area: '門川町' },
  { brand: 'DJH', shop: 'DJH延岡店', area: '諸塚村' },
  { brand: 'DJH', shop: 'DJH延岡店', area: '椎葉村' },
  { brand: 'DJH', shop: 'DJH延岡店', area: '美郷町' },
  { brand: 'DJH', shop: 'DJH延岡店', area: '高千穂町' },
  { brand: 'DJH', shop: 'DJH延岡店', area: '日之影町' },
  { brand: 'DJH', shop: 'DJH延岡店', area: '五ヶ瀬町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '鹿児島市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '鹿屋市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '枕崎市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '阿久根市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '出水市' },
  { brand: 'Nagomi', shop: 'なごみ加世田店', area: '指宿市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '垂水市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '薩摩川内市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '日置市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '曽於市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '霧島市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: 'いちき串木野市' },
  { brand: 'Nagomi', shop: 'なごみ加世田店', area: '南さつま市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '志布志市' },
  { brand: 'Nagomi', shop: 'なごみ加世田店', area: '南九州市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '伊佐市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '姶良市' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: 'さつま町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '長島町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '湧水町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '大崎町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '東串良町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '錦江町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '南大隅町' },
  { brand: 'Nagomi', shop: 'なごみ鹿児島店', area: '肝付町' },
  { brand: '2L', shop: '2L鹿児島店', area: '鹿児島市' },
  { brand: '2L', shop: '2L鹿児島店', area: '鹿屋市' },
  { brand: '2L', shop: '2L鹿児島店', area: '枕崎市' },
  { brand: '2L', shop: '2L鹿児島店', area: '阿久根市' },
  { brand: '2L', shop: '2L鹿児島店', area: '出水市' },
  { brand: '2L', shop: '2L鹿児島店', area: '指宿市' },
  { brand: '2L', shop: '2L鹿児島店', area: '垂水市' },
  { brand: '2L', shop: '2L鹿児島店', area: '薩摩川内市' },
  { brand: '2L', shop: '2L鹿児島店', area: '日置市' },
  { brand: '2L', shop: '2L鹿児島店', area: '曽於市' },
  { brand: '2L', shop: '2L鹿児島店', area: '霧島市' },
  { brand: '2L', shop: '2L鹿児島店', area: 'いちき串木野市' },
  { brand: '2L', shop: '2L鹿児島店', area: '南さつま市' },
  { brand: '2L', shop: '2L鹿児島店', area: '志布志市' },
  { brand: '2L', shop: '2L鹿児島店', area: '南九州市' },
  { brand: '2L', shop: '2L鹿児島店', area: '伊佐市' },
  { brand: '2L', shop: '2L鹿児島店', area: '姶良市' },
  { brand: '2L', shop: '2L鹿児島店', area: 'さつま町' },
  { brand: '2L', shop: '2L鹿児島店', area: '長島町' },
  { brand: '2L', shop: '2L鹿児島店', area: '湧水町' },
  { brand: '2L', shop: '2L鹿児島店', area: '大崎町' },
  { brand: '2L', shop: '2L鹿児島店', area: '東串良町' },
  { brand: '2L', shop: '2L鹿児島店', area: '錦江町' },
  { brand: '2L', shop: '2L鹿児島店', area: '南大隅町' },
  { brand: '2L', shop: '2L鹿児島店', area: '肝付町' },
  { brand: 'FH', shop: 'FH鹿児島店', area: '鹿児島市' },
  { brand: 'FH', shop: 'FH霧島店', area: '鹿屋市' },
  { brand: 'FH', shop: 'FH鹿児島店', area: '枕崎市' },
  { brand: 'FH', shop: 'FH霧島店', area: '阿久根市' },
  { brand: 'FH', shop: 'FH霧島店', area: '出水市' },
  { brand: 'FH', shop: 'FH鹿児島店', area: '指宿市' },
  { brand: 'FH', shop: 'FH霧島店', area: '垂水市' },
  { brand: 'FH', shop: 'FH霧島店', area: '薩摩川内市' },
  { brand: 'FH', shop: 'FH鹿児島店', area: '日置市' },
  { brand: 'FH', shop: 'FH霧島店', area: '曽於市' },
  { brand: 'FH', shop: 'FH霧島店', area: '霧島市' },
  { brand: 'FH', shop: 'FH鹿児島店', area: 'いちき串木野市' },
  { brand: 'FH', shop: 'FH鹿児島店', area: '南さつま市' },
  { brand: 'FH', shop: 'FH霧島店', area: '志布志市' },
  { brand: 'FH', shop: 'FH鹿児島店', area: '南九州市' },
  { brand: 'FH', shop: 'FH霧島店', area: '伊佐市' },
  { brand: 'FH', shop: 'FH霧島店', area: '姶良市' },
  { brand: 'FH', shop: 'FH霧島店', area: 'さつま町' },
  { brand: 'FH', shop: 'FH霧島店', area: '長島町' },
  { brand: 'FH', shop: 'FH霧島店', area: '湧水町' },
  { brand: 'FH', shop: 'FH霧島店', area: '大崎町' },
  { brand: 'FH', shop: 'FH霧島店', area: '東串良町' },
  { brand: 'FH', shop: 'FH霧島店', area: '錦江町' },
  { brand: 'FH', shop: 'FH霧島店', area: '南大隅町' },
  { brand: 'FH', shop: 'FH霧島店', area: '肝付町' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '鹿児島市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '鹿屋市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '枕崎市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '阿久根市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '出水市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '指宿市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '垂水市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '薩摩川内市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '日置市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '曽於市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '霧島市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: 'いちき串木野市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '南さつま市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '志布志市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '南九州市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '伊佐市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '姶良市' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: 'さつま町' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '長島町' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '湧水町' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '大崎町' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '東串良町' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '錦江町' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '南大隅町' },
  { brand: 'PG HOUSE', shop: 'PGH霧島店', area: '肝付町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '宮崎市' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '都城市' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '延岡市' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '日南市' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '小林市' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '日向市' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '串間市' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '西都市' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: 'えびの市' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '三股町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '高原町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '国富町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '綾町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '高鍋町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '新富町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '西米良村' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '木城町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '川南町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '都農町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '門川町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '諸塚村' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '椎葉村' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '美郷町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '高千穂町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '日之影町' },
  { brand: 'PG HOUSE', shop: 'PGH宮崎店', area: '五ヶ瀬町' },
  { brand: 'JH', shop: 'JH熊本店', area: '熊本市' },
  { brand: 'JH', shop: 'JH八代店', area: '八代市' },
  { brand: 'JH', shop: 'JH八代店', area: '人吉市' },
  { brand: 'JH', shop: 'JH熊本店', area: '荒尾市' },
  { brand: 'JH', shop: 'JH八代店', area: '水俣市' },
  { brand: 'JH', shop: 'JH熊本店', area: '玉名市' },
  { brand: 'JH', shop: 'JH熊本店', area: '山鹿市' },
  { brand: 'JH', shop: 'JH熊本店', area: '菊池市' },
  { brand: 'JH', shop: 'JH八代店', area: '宇土市' },
  { brand: 'JH', shop: 'JH八代店', area: '上天草市' },
  { brand: 'JH', shop: 'JH八代店', area: '宇城市' },
  { brand: 'JH', shop: 'JH熊本店', area: '阿蘇市' },
  { brand: 'JH', shop: 'JH八代店', area: '天草市' },
  { brand: 'JH', shop: 'JH熊本店', area: '合志市' },
  { brand: 'JH', shop: 'JH熊本店', area: '美里町' },
  { brand: 'JH', shop: 'JH熊本店', area: '玉東町' },
  { brand: 'JH', shop: 'JH熊本店', area: '南関町' },
  { brand: 'JH', shop: 'JH熊本店', area: '長洲町' },
  { brand: 'JH', shop: 'JH熊本店', area: '和水町' },
  { brand: 'JH', shop: 'JH熊本店', area: '大津町' },
  { brand: 'JH', shop: 'JH熊本店', area: '菊陽町' },
  { brand: 'JH', shop: 'JH熊本店', area: '南小国町' },
  { brand: 'JH', shop: 'JH熊本店', area: '小国町' },
  { brand: 'JH', shop: 'JH熊本店', area: '産山村' },
  { brand: 'JH', shop: 'JH熊本店', area: '高森町' },
  { brand: 'JH', shop: 'JH熊本店', area: '西原村' },
  { brand: 'JH', shop: 'JH熊本店', area: '南阿蘇村' },
  { brand: 'JH', shop: 'JH熊本店', area: '御船町' },
  { brand: 'JH', shop: 'JH熊本店', area: '嘉島町' },
  { brand: 'JH', shop: 'JH熊本店', area: '益城町' },
  { brand: 'JH', shop: 'JH熊本店', area: '甲佐町' },
  { brand: 'JH', shop: 'JH熊本店', area: '山都町' },
  { brand: 'JH', shop: 'JH八代店', area: '氷川町' },
  { brand: 'JH', shop: 'JH八代店', area: '芦北町' },
  { brand: 'JH', shop: 'JH八代店', area: '津奈木町' },
  { brand: 'JH', shop: 'JH八代店', area: '錦町' },
  { brand: 'JH', shop: 'JH八代店', area: '多良木町' },
  { brand: 'JH', shop: 'JH八代店', area: '湯前町' },
  { brand: 'JH', shop: 'JH八代店', area: '水上村' },
  { brand: 'JH', shop: 'JH八代店', area: '相良村' },
  { brand: 'JH', shop: 'JH八代店', area: '五木村' },
  { brand: 'JH', shop: 'JH八代店', area: '山江村' },
  { brand: 'JH', shop: 'JH八代店', area: '球磨村' },
  { brand: 'JH', shop: 'JH八代店', area: 'あさぎり町' },
  { brand: 'JH', shop: 'JH八代店', area: '苓北町' },
  // ⚠️ 福岡県（portalShopList.ts で 2026-09-08 追加）。⚠️ 必ず末尾に置く
  { brand: 'KH', shop: 'KH久留米店', area: '北九州市' },
  { brand: 'KH', shop: 'KH久留米店', area: '福岡市' },
  { brand: 'KH', shop: 'KH久留米店', area: '大牟田市' },
  { brand: 'KH', shop: 'KH久留米店', area: '久留米市' },
  { brand: 'KH', shop: 'KH久留米店', area: '直方市' },
  { brand: 'KH', shop: 'KH久留米店', area: '飯塚市' },
  { brand: 'KH', shop: 'KH久留米店', area: '田川市' },
  { brand: 'KH', shop: 'KH久留米店', area: '柳川市' },
  { brand: 'KH', shop: 'KH久留米店', area: '八女市' },
  { brand: 'KH', shop: 'KH久留米店', area: '筑後市' },
  { brand: 'KH', shop: 'KH久留米店', area: '大川市' },
  { brand: 'KH', shop: 'KH久留米店', area: '行橋市' },
  { brand: 'KH', shop: 'KH久留米店', area: '豊前市' },
  { brand: 'KH', shop: 'KH久留米店', area: '中間市' },
  { brand: 'KH', shop: 'KH久留米店', area: '小郡市' },
  { brand: 'KH', shop: 'KH久留米店', area: '筑紫野市' },
  { brand: 'KH', shop: 'KH久留米店', area: '春日市' },
  { brand: 'KH', shop: 'KH久留米店', area: '大野城市' },
  { brand: 'KH', shop: 'KH久留米店', area: '宗像市' },
  { brand: 'KH', shop: 'KH久留米店', area: '太宰府市' },
  { brand: 'KH', shop: 'KH久留米店', area: '古賀市' },
  { brand: 'KH', shop: 'KH久留米店', area: '福津市' },
  { brand: 'KH', shop: 'KH久留米店', area: 'うきは市' },
  { brand: 'KH', shop: 'KH久留米店', area: '宮若市' },
  { brand: 'KH', shop: 'KH久留米店', area: '嘉麻市' },
  { brand: 'KH', shop: 'KH久留米店', area: '朝倉市' },
  { brand: 'KH', shop: 'KH久留米店', area: 'みやま市' },
  { brand: 'KH', shop: 'KH久留米店', area: '糸島市' },
  { brand: 'KH', shop: 'KH久留米店', area: '那珂川市' },
  { brand: 'KH', shop: 'KH久留米店', area: '宇美町' },
  { brand: 'KH', shop: 'KH久留米店', area: '篠栗町' },
  { brand: 'KH', shop: 'KH久留米店', area: '志免町' },
  { brand: 'KH', shop: 'KH久留米店', area: '須恵町' },
  { brand: 'KH', shop: 'KH久留米店', area: '新宮町' },
  { brand: 'KH', shop: 'KH久留米店', area: '久山町' },
  { brand: 'KH', shop: 'KH久留米店', area: '粕屋町' },
  { brand: 'KH', shop: 'KH久留米店', area: '芦屋町' },
  { brand: 'KH', shop: 'KH久留米店', area: '水巻町' },
  { brand: 'KH', shop: 'KH久留米店', area: '岡垣町' },
  { brand: 'KH', shop: 'KH久留米店', area: '遠賀町' },
  { brand: 'KH', shop: 'KH久留米店', area: '小竹町' },
  { brand: 'KH', shop: 'KH久留米店', area: '鞍手町' },
  { brand: 'KH', shop: 'KH久留米店', area: '桂川町' },
  { brand: 'KH', shop: 'KH久留米店', area: '筑前町' },
  { brand: 'KH', shop: 'KH久留米店', area: '東峰村' },
  { brand: 'KH', shop: 'KH久留米店', area: '大刀洗町' },
  { brand: 'KH', shop: 'KH久留米店', area: '大木町' },
  { brand: 'KH', shop: 'KH久留米店', area: '広川町' },
  { brand: 'KH', shop: 'KH久留米店', area: '香春町' },
  { brand: 'KH', shop: 'KH久留米店', area: '添田町' },
  { brand: 'KH', shop: 'KH久留米店', area: '糸田町' },
  { brand: 'KH', shop: 'KH久留米店', area: '川崎町' },
  { brand: 'KH', shop: 'KH久留米店', area: '大任町' },
  { brand: 'KH', shop: 'KH久留米店', area: '赤村' },
  { brand: 'KH', shop: 'KH久留米店', area: '福智町' },
  { brand: 'KH', shop: 'KH久留米店', area: '苅田町' },
  { brand: 'KH', shop: 'KH久留米店', area: 'みやこ町' },
  { brand: 'KH', shop: 'KH久留米店', area: '吉富町' },
  { brand: 'KH', shop: 'KH久留米店', area: '上毛町' },
  { brand: 'KH', shop: 'KH久留米店', area: '築上町' },
];

/** 半角・全角の空白を前後から除く */
function kagosumaTrim(text) {
  return String(text || '').replace(/^[\s　]+|[\s　]+$/g, '');
}

/** 全角の英数字・記号を半角に（電話用） */
function kagosumaToHalfWidth(text) {
  return String(text || '').replace(/[！-～]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/** 「(未入力)」は空にする */
function kagosumaValue(fields, label) {
  const value = kagosumaTrim(fields[label]);
  return /^[(（]未入力[)）]$/.test(value) ? '' : value;
}

/**
 * 本文を読む。⚠️ 戻り値は { company: 「ご担当者様」の会社名, header: 【…】の行, fields: { 見出し: 値 } }。
 *
 * ⚠️ お客様の情報は `-----` の区切り線に挟まれた部分だけ（署名の住所・電話を拾わない）。
 * ⚠️ 見出しと値は全角・半角のコロンで分かれる（最初のコロンで分ける。「13：00」のような値はそのまま）。
 * ⚠️ 見出しの無い行・知らない見出しの行は、直前の項目の続き（ご要望・備考は複数行になる）。
 */
function kagosumaParse(body) {
  const result = { company: '', header: '', fields: {} };
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  let inBlock = false;
  let blockDone = false;
  let current = '';

  for (const line of lines) {
    const trimmed = kagosumaTrim(line);
    if (/^-{10,}$/.test(trimmed)) {
      if (inBlock) { blockDone = true; inBlock = false; } else if (!blockDone) { inBlock = true; }
      current = '';
      continue;
    }
    if (!inBlock) {
      const company = trimmed.match(/^(.+?)[\s　]*ご担当者様/);
      if (!blockDone && company && result.company === '') result.company = company[1];
      continue;
    }
    if (trimmed === '') continue;
    if (/^【/.test(trimmed) && current === '') { result.header = trimmed; continue; }

    const matched = trimmed.match(/^([^：:]+?)[\s　]*[：:][\s　]*(.*)$/);
    if (matched && KAGOSUMA_KNOWN_LABELS.indexOf(matched[1]) !== -1) {
      current = matched[1];
      result.fields[current] = matched[2];
      continue;
    }
    if (current) result.fields[current] = result.fields[current] ? result.fields[current] + '\n' + trimmed : trimmed;
  }
  return result;
}

/**
 * 備考に残す項目（⚠️ この順で並べる）。⚠️ 名前・連絡先・住所・エリアは備考に入れない（それぞれの欄に入る）。
 * ⚠️ 見出しは 2026-10 のメールの見本から。⚠️ ミカタが見出しを変えたら、ここも変えること。
 */
const KAGOSUMA_REMARK_LABELS = [
  // イベント参加リクエスト
  '参加希望のイベント', 'ご参加希望日時【第1希望】', 'ご参加希望日時【第2希望】', '備考',
  // 資料送付
  '現在の状況', '資料請求先', '連絡希望時間帯', '年齢', 'ご職業',
  '建設予定時期', '建築予算 (土地予算除く)', '建築内容',
  '希望の世帯数', '居住予定人数', '希望の家の広さ', '希望の建て方', '外観・内装・デザインの希望',
  '土地の有無', '土地を探したいエリア', '希望する土地の広さ', '土地購入の予算',
  'その他、ご意見・ご要望'
];
const KAGOSUMA_KNOWN_LABELS = ['お名前', 'ふりがな', 'メールアドレス', 'ご住所', 'お電話番号', '居住希望エリア', '居住予定エリア']
  .concat(KAGOSUMA_REMARK_LABELS);

/** 「ご担当者様」の会社名からブランド */
function kagosumaResolveBrand(company) {
  for (const row of KAGOSUMA_BRANDS) {
    if (String(company || '').indexOf(row.name) !== -1) return row.brand;
  }
  return KAGOSUMA_UNKNOWN_BRAND;
}

/** 表から店舗を探す（先に一致した1件が勝つ）。⚠️ 見つからなければ '' */
function kagosumaFindShop(brand, text) {
  const target = String(text || '');
  if (target === '') return '';
  for (const row of KAGOSUMA_SHOP_LIST) {
    if (row.brand === brand && target.indexOf(row.area) !== -1) return row.shop;
  }
  return '';
}

/**
 * ブランド・エリア・住所から店舗。⚠️ エリアを先に見る（以前と同じ）。決まらなければ住所 → 「◯◯店舗未設定」。
 * ⚠️ ブランドが読めない（KHG）ときは、表にも NOT_FOUND にも無いので「ブランド・店舗未設定」になる。
 */
function kagosumaResolveShop(brand, area, address) {
  return kagosumaFindShop(brand, area) || kagosumaFindShop(brand, address)
    || KAGOSUMA_NOT_FOUND_SHOP[brand] || KAGOSUMA_UNKNOWN_SHOP;
}

/** 1通のメールから送る内容を作る。⚠️ 送らないメールは { skip: 理由 } */
function kagosumaBuildPayload(subject, to, body, date) {
  const s = String(subject || '');
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return { skip: '返信・転送' };
  if (!KAGOSUMA_SITES.some(function (site) { return s.indexOf(site) !== -1; })) return { skip: '件名にサイト名が無い' };
  const isEvent = s.indexOf(KAGOSUMA_KIND_EVENT) !== -1;
  if (!isEvent && s.indexOf(KAGOSUMA_KIND_DOCUMENT) === -1) return { skip: '件名が違う' };
  if (s.indexOf(KAGOSUMA_EXCLUDE_SUBJECT) !== -1) return { skip: '除外の件名' };
  if (String(to || '').toLowerCase().indexOf(KAGOSUMA_EXCLUDE_TO) !== -1) return { skip: '除外の宛先' };

  const parsed = kagosumaParse(body);
  const f = parsed.fields;
  const name = kagosumaValue(f, 'お名前').replace(/[\s　]*様$/, '');
  const mobile = kagosumaToHalfWidth(kagosumaValue(f, 'お電話番号')).replace(/[\s　]/g, '');
  const mail = kagosumaToHalfWidth(kagosumaValue(f, 'メールアドレス')).replace(/[\s　]/g, '');
  if (name === '') return { skip: 'お名前が読めない' };
  if (mail === '' && mobile === '') return { skip: 'メールも電話も無い' };

  // ⚠️ 資料送付は「居住希望エリア」、イベントは「居住予定エリア」
  const area = kagosumaValue(f, '居住希望エリア') || kagosumaValue(f, '居住予定エリア');
  const address = kagosumaValue(f, 'ご住所');
  const brand = kagosumaResolveBrand(parsed.company);

  // ⚠️ 【10/22 14:15】【同時請求3社】の「同時請求」も残す
  const together = (parsed.header.match(/【(同時請求[^】]*)】/) || [])[1] || '';
  const remarks = [['種類', isEvent ? 'イベント参加リクエスト' : '資料請求'], ['同時請求', together.replace(/^同時請求/, '')]]
    .concat(KAGOSUMA_REMARK_LABELS.map(function (label) { return [label, kagosumaValue(f, label)]; }))
    .filter(function (pair) { return pair[1]; })
    .map(function (pair) { return pair[0] + '：' + pair[1]; })
    .join('\n');

  return {
    request: 'kagosuma_entry',
    // ⚠️ 以前の GAS と同じ形（kagosuma＋UTC の日時＋ブランド）。⚠️ 取り込み済みのメールが二重に入らないように
    inquiry_id: 'kagosuma' + date.toISOString() + brand,
    inquiry_date: Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd'),
    brand: brand,
    shop: kagosumaResolveShop(brand, area, address),
    name: name,
    kana: kagosumaValue(f, 'ふりがな'),
    mobile: mobile,
    mail: mail,
    address: address,
    area: area,
    remarks: remarks
  };
}

/**
 * 送る。② → だめなら ①。
 * ⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。401・400 は ① でも同じなので送り直さない。
 */
function kagosumaPost(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const targets = [['②', KAGOSUMA_EXPRESS_URL], ['①', KAGOSUMA_PHP_URL]];
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
function KagosumatoDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }
  // ⚠️ search はスレッド単位で返すので、返信などが混ざる。1通ずつ kagosumaBuildPayload で確かめる
  GmailApp.search(KAGOSUMA_QUERY).forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      const payload = kagosumaBuildPayload(message.getSubject(), message.getTo(), message.getPlainBody(), message.getDate());
      if (payload.skip) {
        Logger.log('送らない（' + payload.skip + '）: ' + message.getSubject());
        return;
      }
      payload.key = key;
      kagosumaPost(payload);
    });
  });
}
```

### backend/scripts/sql/2026-10-23_update_log_2.2.211.sql（新規）
```sql
-- =====================================================================
-- update_log に v2.2.211 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.211', '2026-10-23', 'カゴスマ・タテルヤの反響（資料請求・イベント参加リクエスト）の取り込みを作り直した。メールは件名で探し、店舗はポータル反響と同じ最新の表で決める（福岡県は KH久留米店）。イベントのメールでエリアが空になっていた不具合を直し、家づくりの希望やイベントの希望日時を備考に残すようにした。');
```
