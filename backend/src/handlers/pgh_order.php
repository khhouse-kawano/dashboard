<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../core/bulk_upsert.php';

/**
 * 【PG HOUSE九州】資料請求メールからの反響を取り込む。
 *
 * ```
 * Gmail ─(GAS backend/scripts/gas/runPghCatalog.gs)→ ここ → inquiry_customer
 * ```
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **値の組み立ては全部ここでやる。**
 *   ⚠️ GAS は**本文を見出しで割って送るだけ**にしてある。
 *   ⚠️ ⚠️ **GAS に判断を持たせないこと。** 直すたびに Apps Script を開いて
 *     貼り替えが要るため、⚠️ **変わりやすい決め事（媒体名・住所の分け方・
 *     カナ変換）はこちら側に置く。**
 *
 * ⚠️⚠️ **受け口テーブル（*_db）は作っていない。**
 *   ⚠️ SUUMO などのポータルは、ポータル側の生データを残すために `suumo_db` を持つ。
 *   ⚠️ ⚠️ **こちらはメール本文そのものを `remarks` に入れてある**ので、
 *     ⚠️ 生データを別に持つ意味が薄い。⚠️ **テーブルを1つ増やさない判断。**
 *   ⚠️ そのため `portalRunBulkImport()` は使わず、`portalInsertNewOnly()` を直接呼ぶ。
 *
 * ⚠️⚠️ **`inquiry_customer` には `inquiry_id` の一意キーが無い**（PRIMARY は `id` だけ）。
 *   ⚠️ ⚠️ **`INSERT IGNORE` では重複を防げない。**
 *   ⚠️ `portalInsertNewOnly()` が「既にある鍵を SELECT してから入れる」ので、
 *     ⚠️ **必ずこれを通すこと。**
 *
 * ⚠️ `express_proxy.php` には足さないこと。
 *   ⚠️⚠️ **書き込みを ② へ転送すると、自動フォールバックで二重に走る。**
 * ─────────────────────────────────────────────
 */

/** ⚠️ ブランドと店舗は固定（利用者の指示。2026-09-28） */
const PGH_BRAND = 'PGH';
const PGH_SHOP  = 'PGH店舗未設定';

/**
 * ⚠️ 媒体。
 *   ⚠️ `medium` は ⚠️ **「ホームページ反響」で固定**（利用者の指示）。
 *   ⚠️ `response_medium` は ⚠️ **「お申込のきっかけ」をそのまま**入れる。
 *     ⚠️⚠️ **medium_list に無い値が入りうる。** その場合は販促媒体別の集計から漏れる。
 *     ⚠️ 新しい値が出てきたら medium_list に足すこと。
 */
const PGH_MEDIUM      = 'ホームページ反響';
const PGH_HP_CAMPAIGN = '資料請求';

/** ⚠️ 都道府県。⚠️ 住所の先頭を切り出すために使う */
const PGH_PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

/**
 * ひらがなをカタカナに直す。
 *
 * ⚠️⚠️ **frontend/src/utils/nexusUtils.ts の hiraToKata と同じ挙動にしてある。**
 *   ⚠️ v2.2.149 で「フリガナはカタカナ」に揃えたので、⚠️ **入口でも合わせる。**
 *   ⚠️ ⚠️ **ここでひらがなのまま入れると、Nexus へ移行できない顧客が増える。**
 *
 * ⚠️ `mb_convert_kana($s, 'C')` は**ひらがな→カタカナ**の変換。
 *   ⚠️ 繰り返し記号（ゝ ゞ）も併せて直す（⚠️ `C` では変わらない）。
 */
function pghHiraToKata(string $value): string
{
    $converted = mb_convert_kana($value, 'C', 'UTF-8');
    return str_replace(['ゝ', 'ゞ'], ['ヽ', 'ヾ'], $converted);
}

/**
 * 反響日。
 *
 * ⚠️⚠️ **`YYYY/MM/DD` のスラッシュ区切りにすること。**
 *   ⚠️ メニューの未同期バッジは `SUBSTRING(inquiry_date, 1, 7)` を
 *     `'2025/06'` と比べている（backend-express/src/features/menu.ts）。
 *   ⚠️ ⚠️ **ハイフンで入れるとバッジにも「要確認」にも出てこない。**
 */
function pghInquiryDate(string $registered): string
{
    $head = str_replace('-', '/', substr(trim($registered), 0, 10));
    return preg_match('#^\d{4}/\d{2}/\d{2}$#', $head) === 1 ? $head : '';
}

/**
 * 住所を都道府県とそれ以降に割る。
 *
 * ⚠️ 見本は `鹿児島県 霧島市国分重久1063-1-201`（⚠️ **県のあとに空白**）。
 * ⚠️⚠️ **市区町村までは割らない。** 表記が安定せず、誤って割ると住所が壊れる。
 *   ⚠️ 既存の townlife / catalog も同じ判断で building にまとめている。
 *
 * @return array{0:string,1:string} [pref, building]
 */
function pghSplitAddress(string $address): array
{
    $text = trim(preg_replace('/\s+/u', ' ', $address) ?? '');

    foreach (PGH_PREFECTURES as $pref) {
        if (mb_strpos($text, $pref) === 0) {
            return [$pref, trim(mb_substr($text, mb_strlen($pref)))];
        }
    }
    return ['', $text];
}

/**
 * 電話番号。
 *
 * ⚠️ 既存の取り込み（townlife など）に合わせて ⚠️ **`mobile` に入れる。**
 *   ⚠️ 固定電話か携帯かはメール本文から判別できない。
 * ⚠️ 全角数字やハイフンが混ざることがあるので、⚠️ **数字だけにする。**
 */
function pghTel(string $tel): string
{
    $halfWidth = mb_convert_kana($tel, 'n', 'UTF-8');
    return preg_replace('/\D/', '', $halfWidth) ?? '';
}

/**
 * 重複排除の鍵。
 *
 * ⚠️⚠️ **Gmail のメッセージIDは使わない**（2026-09-28 に直した）。
 *   ⚠️ ⚠️ **同じ問い合わせが2通届くことがある**（受信箱に別アドレス宛の控えも入る）。
 *     ⚠️ メッセージIDは通ごとに違うため、⚠️ **2件とも入ってしまっていた。**
 *
 * ⚠️ 既存の `catalog_resale` は `UNIQUE(email, registered)` で、
 *   ⚠️ ⚠️ **「誰が・いつ」で内容によって弾いている。** ⚠️ **それに合わせる。**
 *
 * ⚠️ 日付までで見る（⚠️ **時刻は見ない**）。
 *   ⚠️ ⚠️ **控えは数秒ずれて届く**ので、秒まで見ると弾けない。
 *   ⚠️ ⚠️ **同じ人が同じ日に2回出すと1件に畳まれる。** これは承知のうえ
 *     （⚠️ メール本文だけでは本当に2回目なのか控えなのか区別できない）。
 *
 * ⚠️ メールが空のときは電話、それも空なら氏名で代用する。
 *   ⚠️ ⚠️ **全部空なら空文字を返す。** 呼び出し側がその行を捨てる。
 */
function pghInquiryKey(array $row, string $inquiryDate): string
{
    $mail = trim((string)($row['email'] ?? ''));
    $tel  = pghTel((string)($row['tel'] ?? ''));
    $name = trim((string)($row['name'] ?? ''));

    $who = $mail !== '' ? $mail : ($tel !== '' ? $tel : $name);
    if ($who === '' || $inquiryDate === '') {
        return '';
    }

    // ⚠️ 生のメールアドレスを inquiry_id に入れない。⚠️ 画面や一覧に出る列のため
    return 'pgh_hp_' . md5($who . '|' . $inquiryDate);
}

/**
 * GAS から届いた1通ぶんを `inquiry_customer` の形に直す。
 *
 * ⚠️⚠️ **氏名は分割しない**（利用者の判断。2026-09-28）。
 *   ⚠️ 本文が `中島健太` のように**区切りを持たない**ため、姓名を推測すると誤る。
 *   ⚠️ ⚠️ **まるごと `first_name` に入れ、`last_name` は空にする。**
 *   ⚠️ 既存の資料請求（catalog_resale）も同じ扱いにしてある。
 *   ⚠️ ⚠️ **同期するときに人が直す前提。**
 *
 * @return array<string,string>|null 鍵か氏名が無ければ null
 */
function pghToInquiry(array $row): ?array
{
    $name = trim((string)($row['name'] ?? ''));

    // ⚠️ 氏名が無いものは作らない。⚠️ **誰のことか分からない行を増やさない**
    if ($name === '') {
        return null;
    }

    $inquiryDate = pghInquiryDate((string)($row['registered'] ?? ''));

    /**
     * ⚠️⚠️ **同じ問い合わせが2通届く**（利用者の確認。2026-09-28）。
     *   ⚠️ ⚠️ **鍵は「誰が・いつ」で作る。** ⚠️ **メッセージIDでは弾けない。**
     */
    $inquiryId = pghInquiryKey($row, $inquiryDate);
    if ($inquiryId === '') {
        return null;
    }

    [$pref, $building] = pghSplitAddress((string)($row['address'] ?? ''));
    $trigger = trim((string)($row['trigger'] ?? ''));

    return [
        // ⚠️ 接頭辞を付けて他の媒体と衝突させない（例: townlife は 'townlife' + id）
        'inquiry_id'      => $inquiryId,
        'inquiry_date'    => $inquiryDate,
        'medium'          => PGH_MEDIUM,
        'response_medium' => $trigger !== '' ? $trigger : PGH_MEDIUM,
        'first_name'      => $name,
        'last_name'       => '',
        'first_name_kana' => pghHiraToKata(trim((string)($row['kana'] ?? ''))),
        'last_name_kana'  => '',
        'mobile'          => pghTel((string)($row['tel'] ?? '')),
        'mail'            => trim((string)($row['email'] ?? '')),
        'zip'             => trim((string)($row['zip'] ?? '')),
        'pref'            => $pref,
        'building'        => $building,
        'brand'           => PGH_BRAND,
        'shop'            => PGH_SHOP,
        'hp_campaign'     => PGH_HP_CAMPAIGN,
        // ⚠️ 本文まるごと。⚠️ 連絡可能時間・ご質問等・紹介者はここから読める
        'remarks'         => trim((string)($row['remarks'] ?? '')),
    ];
}

$rows = portalReadBulkPayload('pgh_order');

$summary = ['processed' => 0, 'skipped' => 0, 'errors' => []];
$batchSize = 500;

foreach (array_chunk($rows, $batchSize) as $chunk) {
    $inquiryRows = [];

    foreach ($chunk as $row) {
        if (!is_array($row)) {
            continue;
        }
        $inquiry = pghToInquiry($row);
        if ($inquiry === null) {
            continue;
        }
        // ⚠️ NOT NULL の列があるため、空文字のまま入れる（null にしない）
        $inquiryRows[] = portalNormalizeRow($inquiry, false);
    }

    if (count($inquiryRows) === 0) {
        continue;
    }

    try {
        $pdo->beginTransaction();
        $res = portalInsertNewOnly($pdo, 'inquiry_customer', $inquiryRows, 'inquiry_id');

        if (!empty($res['errors'])) {
            $pdo->rollBack();
            $summary['errors'] = array_merge($summary['errors'], $res['errors']);
        } else {
            $pdo->commit();
            $summary['processed'] += $res['processed'];
            $summary['skipped']   += $res['skipped'];
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $summary['errors'][] = $e->getMessage();
    }
}

header('Content-Type: application/json; charset=utf-8');
// ⚠️ skipped は「既に取り込み済みだった件数」。⚠️ **エラーではない。**
//   ⚠️ GAS は1日ぶんを毎回送るため、平常時は skipped のほうが大きくなる。
echo json_encode([
    'ok'       => empty($summary['errors']),
    'inserted' => $summary['processed'],
    'skipped'  => $summary['skipped'],
    'errors'   => $summary['errors'],
], JSON_UNESCAPED_UNICODE);
