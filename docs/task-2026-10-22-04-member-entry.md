# 2026-10-22 会員登録の取り込み（GAS MEMBERtoDashboard）の改修・② へ・KH久留米店（v2.2.209）

## 指示（ReadMeClaude.md）
- v2.2.209 で作業開始
- 会員登録の反響を取り込む GAS の改修。KH久留米店の追加
- エリアの割り当ては /projects/sync のポータル反響の取り込み（utils/portalShopList.ts）を参照
- 保存先は inquiry_customer。今までの PHP（api/member.php）を参照し、直すべきところは直して ② へ向ける。落ちたとき用の ① も念のため用意
- 確認で決めたこと：受け口に合い言葉（共有キー）を付ける／KH の「登録情報更新」も取り込むが**退会は除く**

## 今の GAS・PHP で見つかった問題（直したもの）
1. PHP：既にいる人（同じメール）のとき `response_medium` に媒体（ホームページ反響）を入れていた → 「知ったきっかけ」のまま保存
2. PHP：メールが空でも `WHERE mail = ''` で重複を探していた → メールが空なら探さない
3. 中身が空の行が入っていた（ローカルにも `homepage2026/10/1803:32:05` の空行）→ 氏名と、メールか電話のどちらかが無ければ送らない・受けない
4. PHP：DB に入れる前に「受信完了」「接続成功」を出力していた（応答が JSON にならない）→ 応答は JSON 1つ
5. PHP：誰でも書き込めた → 合い言葉（MEMBER_ENTRY_KEY）
6. GAS：`.replace(' ', '')` は最初の空白1つだけ → 全部消す。KH の郵便番号が空・なごみの「町村・番地」を捨てていた → 拾う
7. GAS：存在しない店舗（DJH八代店・2L出水店）を表に持っていた／福岡県が無かった → ポータルと同じ表（KH久留米店に福岡県60市町村）
8. GAS：Parser ライブラリ依存・見出しの後ろの空白の数に依存 → 行ごとに「見出し : 値」で読む

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/memberEntry/ | **entry.ts**（新規） | `runMemberEntry`（受け口の本体）・`duplicateNote`（重複の文字列） |
| backend-express/src/gateway/ | registry.ts | `member_entry` を登録（auth none・本文の key で確認） |
| backend-express/src/config/ | env.ts | `memberEntryKey`（MEMBER_ENTRY_KEY） |
| backend/src/handlers/ | **member_entry.php**（新規） | ① の予備。② と同じ処理（`memberEntryClean`・`memberEntryCleanMultiline`・`memberEntryRespond`） |
| backend/src/core/ | express_proxy.php | `expressProxyRequests()` に `member_entry`（書き込みだが二度入らないので例外。Exclusive には入れない） |
| backend/scripts/gas/ | **MEMBERtoDashboard.gs**（新規） | GAS 本体（`memberParseBody`・`memberSplitZip`・`memberResolveShop`・`memberBuildPayload`・`memberPost`・`MEMBERtoDashboard`） |
| / | docker-compose.yml | ローカルの MEMBER_ENTRY_KEY=localtest（php-web・express-api） |
| / | docker-compose.prod.yml | `MEMBER_ENTRY_KEY=${MEMBER_ENTRY_KEY:-}` |
| frontend/src/utils/ | version.ts | 2.2.209 |
| backend/scripts/sql/ | 2026-10-22_update_log_2.2.209.sql（新規） | 更新履歴（ローカル no=309 に投入済み） |
| docs/ | deploy-v2.2.209.md（新規） | デプロイ手順 |

- 業務ガイドの記事：画面の変更が無いので直していない

## 送る内容（GAS → ② / ①）
`{ request: 'member_entry', key, inquiry_id, inquiry_date, brand, shop, campaign, response_medium, name, kana, mobile, mail, zip, address, remarks }`
- inquiry_id は以前と同じ形 `homepage` ＋ `yyyy/MM/ddHH:mm:ss`（日本時間）＋キャンペーン名（切り替えの前後で同じメールが二重に入らないため）
- 店舗は GAS が決める（② ① は決め直さない）。2L は県外でも 2L鹿児島店（以前と同じ）
- 住所はまとめて building（一覧は pref〜building をつなげて表示するので見え方は同じ）。年齢・希望・希望エリア・質問は remarks
- 応答：200 success／200 exists（登録済み）／400 項目不足／401 合い言葉違い／500 保存失敗。GAS は通信エラー・5xx のときだけ ① へ送り直す

## テスト
- GAS の読み取り（Node で GAS を読み込み、いただいた4ブランドの本文で）:
  - KH：大分県別府市 → KH大分店・郵便番号 8740840・住所に番地・「何を見て」は次の行の値（建築現場を見て）
  - KH の住所を福岡県久留米市に → **KH久留米店**／東京 → KH店舗未設定／件名に「退会」→ 送らない
  - なごみ → なごみ鹿児島店・番地まで／2L（宮崎県日南市）→ 2L鹿児島店／JH → JH熊本店
  - 複数行の質問（途中に「時間: 平日10時以降」）も1つの質問として読む／中身が空 → 送らない／CRLF の本文でも同じ結果
- ① 経由（localhost:8080 → ②）：合い言葉なし 401・違う 401・名前なし 400・登録 200 success・同じものをもう一度 200 exists・同じメールで別の反響 → duplicate「KH久留米店 ホームページ反響 重複」で response_medium は SUUMO のまま
- ② 直接：登録済み 200 exists
- ② を止めて ① 経由：① の PHP が登録 200 success・もう一度 exists・合い言葉なし 401・名前なし 400（① の行も ② の行と同じ形）
- `tsc --noEmit` 通過・`php -l` 通過・フロントのビルド通過（main.e02894ce.js）
- リファクタリング（duplicateNote の export を外す・① の応答の / をエスケープしない）の後に上をもう一度通した。テストの行は消した

## コード

### backend-express/src/features/memberEntry/entry.ts（新規）
```ts
import { timingSafeEqual } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';

/**
 * ホームページの会員登録（KH・2L・なごみ・JH）を inquiry_customer へ保存する。（v2.2.209）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS の MEMBERtoDashboard（backend/scripts/gas/MEMBERtoDashboard.gs）。
 *   通知メールを読み取り、店舗まで決めてから送ってくる。⚠️ ここでは店舗を決め直さない。
 * ⚠️ 届かなかったとき GAS は ① の handlers/member_entry.php へ送り直す。**同じ処理を PHP にも持っている。**
 *   ⚠️ ここを変えたら member_entry.php も同じように変えること。
 * ⚠️ 移植元は ① `khg-marketing.info/api/member.php`。違うところ:
 *   - 合い言葉（MEMBER_ENTRY_KEY）が合わない送信は断る（移植元は誰でも書き込めた）
 *   - 氏名と、メールか電話のどちらかが無い送信は断る（移植元は中身が空の行も入れていた）
 *   - 既にいる人のときも response_medium は「知ったきっかけ」のまま（移植元は媒体で上書きしていた）
 *   - メールが空のときは重複を調べない（移植元は空のメール同士を重複にしていた）
 *   - NOT NULL の列をすべて埋める・応答は JSON 1つ（移植元は保存前に「受信完了」を返していた）
 * ─────────────────────────────────────────────
 */

export interface MemberEntryResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** ⚠️ GAS の inquiry_id は `homepage` ＋日時＋キャンペーン名（移植元と同じ形。切り替えの前後で同じメールが二重に入らないため） */
const INQUIRY_ID_PREFIX = 'homepage';
const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;

/** ⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる（event/checkin.ts と同じ） */
const keyMatches = (input: string): boolean => {
    const expected = env.memberEntryKey;
    if (expected === '') return false;
    const a = Buffer.from(input, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
};

interface DuplicateRow extends RowDataPacket {
    shop: string;
    medium: string;
}

/**
 * 同じメールアドレスの既存の反響を「店舗 媒体 重複」の形で並べる（移植元と同じ形）。
 * ⚠️ 移植元は店舗ごとに1つ（同じ店舗なら後の行の媒体）。
 */
const duplicateNote =(rows: ReadonlyArray<{ shop: string; medium: string }>): string => {
    const byShop = new Map<string, string>();
    for (const row of rows) byShop.set(row.shop, row.medium);
    return [...byShop].map(([shop, medium]) => `${shop} ${medium} 重複`).join(',');
};

export const runMemberEntry = async (raw: Record<string, unknown>): Promise<MemberEntryResult> => {
    const body = raw ?? {};

    // ⚠️ 合い言葉を最初に確かめる。先に inquiry_id を調べると、応答の違いから登録の有無が漏れる
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、会員登録の取り込みを断りました。');
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
        logger.warn(`member_entry: 必要な項目がありません id="${inquiryId}" brand="${brand}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        const existing = await query<RowDataPacket>(
            'SELECT id FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1', [inquiryId]
        );
        if (existing.length > 0) {
            return { httpStatus: 200, body: { status: 'exists', message: '登録済みです。', id: inquiryId } };
        }

        const duplicates = mail === '' ? [] : await query<DuplicateRow>(
            'SELECT shop, medium FROM inquiry_customer WHERE mail = ? ORDER BY id', [mail]
        );

        const values: Record<string, string | number> = {};
        for (const column of NOT_NULL_COLUMNS) values[column] = '';
        // ⚠️ 数値列。空文字だと INSERT ごと失敗する
        values.sync = 0;
        values.delete_flag = 0;

        values.inquiry_id = inquiryId;
        values.inquiry_date = inquiryDate;
        values.medium = 'ホームページ反響';
        values.response_medium = clean(body.response_medium, 120);
        // ⚠️ 移植元と同じく氏名・かなは分けずに first_name / first_name_kana、住所はまとめて building
        //   （一覧は pref〜building をつなげて表示するので、どこに入れても見え方は同じ）
        values.first_name = name;
        values.first_name_kana = clean(body.kana, 120);
        values.mobile = mobile;
        values.mail = mail;
        values.zip = clean(body.zip, 10);
        values.building = clean(body.address, 300);
        values.brand = brand;
        values.shop = shop;
        values.hp_campaign = clean(body.campaign, 200);
        values.remarks = cleanMultiline(body.remarks, 2000);
        values.duplicate = duplicateNote(duplicates);

        await execute(
            `INSERT INTO inquiry_customer (${NOT_NULL_COLUMNS.join(', ')})`
            + ` VALUES (${NOT_NULL_COLUMNS.map(() => '?').join(', ')})`,
            NOT_NULL_COLUMNS.map(c => values[c])
        );
    } catch (error) {
        logger.error(`member_entry: inquiry_customer への保存に失敗 id="${inquiryId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データの追加に失敗しました。' } };
    }

    logger.info(`member_entry を受け付けました id="${inquiryId}" brand="${brand}" shop="${shop}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが反響一覧に追加されました。`, id: inquiryId } };
};
```

### backend/src/handlers/member_entry.php（新規）
```php
<?php

/**
 * ホームページの会員登録（KH・2L・なごみ・JH）を inquiry_customer へ保存する。（v2.2.209）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の features/memberEntry/entry.ts の予備である。同じ処理を持つ。**
 *   ⚠️ ふだんは ① の express_proxy.php が ② へ転送し、ここは動かない。
 *   ⚠️ 動くのは ② に届かなかったとき（GAS が送り直したとき・① からの転送が失敗したとき）。
 *   ⚠️ ここを変えたら entry.ts も同じように変えること。
 * ⚠️ 移植元の api/member.php との違いは entry.ts の冒頭を参照（合い言葉・必須項目・重複の扱い・応答の形）。
 * ─────────────────────────────────────────────
 */

/** 制御文字を空白にし、連続する空白を1つにして長さで切る（② の clean と同じ） */
function memberEntryClean($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$value) ?? '';
    $text = trim(preg_replace('/ +/u', ' ', $text) ?? '');
    return mb_substr($text, 0, $max, 'UTF-8');
}

/** 改行だけ残す（② の cleanMultiline と同じ） */
function memberEntryCleanMultiline($value, int $max): string
{
    if ($value === null || is_array($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string)$value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $text) ?? '';
    $lines = array_map('trim', explode("\n", $text));
    return mb_substr(trim(implode("\n", $lines)), 0, $max, 'UTF-8');
}

function memberEntryRespond(int $status, array $body): void
{
    http_response_code($status);
    // ⚠️ ② と同じ形にする（inquiry_id の / をエスケープしない）
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ⚠️ 合い言葉を最初に確かめる。⚠️ 未設定なら全件断る（素通しにしない）
$expectedKey = trim((string)getenv('MEMBER_ENTRY_KEY'));
$inputKey = memberEntryClean($data['key'] ?? '', 200);
if ($expectedKey === '' || !hash_equals($expectedKey, $inputKey)) {
    if ($expectedKey === '') {
        error_log('member_entry: MEMBER_ENTRY_KEY が未設定のため断りました');
    }
    memberEntryRespond(401, ['status' => 'error', 'message' => '合い言葉が違います。']);
}

$inquiryId   = memberEntryClean($data['inquiry_id'] ?? '', 200);
$inquiryDate = memberEntryClean($data['inquiry_date'] ?? '', 10);
$name        = memberEntryClean($data['name'] ?? '', 120);
$mail        = memberEntryClean($data['mail'] ?? '', 190);
$mobile      = memberEntryClean($data['mobile'] ?? '', 30);
$brand       = memberEntryClean($data['brand'] ?? '', 30);
$shop        = memberEntryClean($data['shop'] ?? '', 80);

if (
    strpos($inquiryId, 'homepage') !== 0
    || !preg_match('#^\d{4}/\d{2}/\d{2}$#', $inquiryDate)
    || $brand === '' || $shop === '' || $name === ''
    || ($mail === '' && $mobile === '')
) {
    error_log("member_entry: 必要な項目がありません id=\"{$inquiryId}\" brand=\"{$brand}\"");
    memberEntryRespond(400, ['status' => 'error', 'message' => '必要な項目がありません。']);
}

try {
    $stmt = $pdo->prepare('SELECT id FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1');
    $stmt->execute([$inquiryId]);
    if ($stmt->fetch()) {
        memberEntryRespond(200, ['status' => 'exists', 'message' => '登録済みです。', 'id' => $inquiryId]);
    }

    // ⚠️ メールが空なら重複を調べない（空のメール同士を重複にしない）。店舗ごとに1つ（後の行の媒体）
    $duplicate = '';
    if ($mail !== '') {
        $stmt = $pdo->prepare('SELECT shop, medium FROM inquiry_customer WHERE mail = ? ORDER BY id');
        $stmt->execute([$mail]);
        $byShop = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'medium', 'shop');
        $notes = [];
        foreach ($byShop as $dupShop => $dupMedium) {
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
    $values['medium'] = 'ホームページ反響';
    $values['response_medium'] = memberEntryClean($data['response_medium'] ?? '', 120);
    $values['first_name'] = $name;
    $values['first_name_kana'] = memberEntryClean($data['kana'] ?? '', 120);
    $values['mobile'] = $mobile;
    $values['mail'] = $mail;
    $values['zip'] = memberEntryClean($data['zip'] ?? '', 10);
    $values['building'] = memberEntryClean($data['address'] ?? '', 300);
    $values['brand'] = $brand;
    $values['shop'] = $shop;
    $values['hp_campaign'] = memberEntryClean($data['campaign'] ?? '', 200);
    $values['remarks'] = memberEntryCleanMultiline($data['remarks'] ?? '', 2000);
    $values['duplicate'] = $duplicate;

    $placeholders = implode(', ', array_fill(0, count($notNullColumns), '?'));
    $stmt = $pdo->prepare('INSERT INTO inquiry_customer (' . implode(', ', $notNullColumns) . ") VALUES ({$placeholders})");
    $stmt->execute(array_values($values));
} catch (PDOException $e) {
    error_log("member_entry: inquiry_customer への保存に失敗 id=\"{$inquiryId}\": " . $e->getMessage());
    memberEntryRespond(500, ['status' => 'error', 'message' => 'データの追加に失敗しました。']);
}

error_log("member_entry: ① で受け付けました id=\"{$inquiryId}\" brand=\"{$brand}\" shop=\"{$shop}\"");
memberEntryRespond(200, ['status' => 'success', 'message' => "{$name} のデータが反響一覧に追加されました。", 'id' => $inquiryId]);
```

### backend/scripts/gas/MEMBERtoDashboard.gs（新規・全文）
```js
// =====================================================================
// ホームページの会員登録の通知メール → 反響（inquiry_customer）として取り込む（v2.2.209）
//
// ⚠️ 対象: 国分ハウジング（KH）・ニーエルホーム（2L）・なごみ工務店（Nagomi）・ジャスフィーホーム（JH）
// ⚠️ トリガー: MEMBERtoDashboard（関数名は以前と同じ）
//
// ⚠️ 送り先:
//   1. ② https://api.khg-marketing.info/api/gateway （request: member_entry）
//   2. ② に届かない（通信エラー・5xx）ときだけ ① https://khg-marketing.info/dashboard/api/gateway/ へ送り直す
//      （① の handlers/member_entry.php が同じ処理をする）
//   ⚠️ 同じ inquiry_id は二度入らない（2回目は status: exists）。何度実行しても二重にならない。
//
// ⚠️⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY（合い言葉）が要る。⚠️ ① ② と同じ値。⚠️ ここに直書きしない。
//
// ⚠️ 以前の版（api/member.php 宛て）から直したところ:
//   - Parser ライブラリを使わない（行ごとに「見出し : 値」で読む。見出しの後ろの空白の数が変わっても読める）
//   - 氏名・かな・電話・メールの空白を全部消す（以前は最初の1つだけ）
//   - 郵便番号を住所から分ける・なごみの「町村・番地」を拾う
//   - 店舗の割り当てをポータル反響（sync の utils/portalShopList.ts）と同じ表にする
//     （福岡県 → KH久留米店 を追加。存在しない「DJH八代店」「2L出水店」を使わない）
//   - 退会の通知・氏名が読めないメール・連絡先が無いメールは送らない
//   - 送信の結果（成功・登録済み・失敗）をログに残す
// =====================================================================

/** ② のゲートウェイ */
const MEMBER_EXPRESS_URL = 'https://api.khg-marketing.info/api/gateway';
/** ① のゲートウェイ（② に届かないときだけ） */
const MEMBER_PHP_URL = 'https://khg-marketing.info/dashboard/api/gateway/';

/**
 * ブランドごとの設定。
 *
 * ⚠️ query は以前の GAS と同じラベル・件名（Gmail のフィルタでラベルが付く）。
 * ⚠️ labels は「メール本文の見出し → 取り出す項目」。⚠️ 見出しは前後の空白を除いて完全一致で比べる。
 * ⚠️ campaign は inquiry_id と hp_campaign に入る。⚠️ **変えないこと**（変えると同じメールが別の反響として二重に入る）。
 */
const MEMBER_BRANDS = [
  {
    brand: 'KH',
    campaign: '【KH共通】会員登録',
    query: 'label:会員登録_KH newer_than:2d',
    labels: {
      'お名前': 'name',
      'ふりがな': 'kana',
      'メールアドレス': 'mail',
      '携帯電話番号': 'mobile',
      '年齢': 'age',
      'ご住所': 'address',
      '町村・番地': 'street',
      '何を見て「国分ハウジング」お知りになりましたか？': 'medium',
      '新しいお住まいのご希望': 'wish',
      'ご希望の土地のエリア': 'area',
      'ご質問・ご相談等': 'question'
    }
  },
  {
    brand: '2L',
    campaign: '【2L鹿児島】会員登録',
    query: 'label:ラクリア_2L subject:"【2Lhome】会員登録がありました" newer_than:2d',
    labels: {
      '名前(漢字)': 'name',
      '名前(かな)': 'kana',
      'メールアドレス': 'mail',
      '電話番号': 'mobile',
      '年齢': 'age',
      '郵便番号': 'zip',
      '都道府県': 'pref',
      '市・区': 'city',
      '町村・番地': 'street',
      'ビル名・建物名・番号': 'building',
      '何を見て「ニーエルホーム」をお知りになりましたか？': 'medium',
      '会員登録のきっかけ': 'trigger',
      '新しいお住まいのご希望': 'wish',
      'ご希望の土地のエリア': 'area',
      'ご意見・ご質問等': 'question'
    }
  },
  {
    brand: 'Nagomi',
    campaign: '【なごみ共通】会員登録',
    query: 'label:会員登録_なごみ subject:会員登録がありました newer_than:2d',
    labels: {
      'お名前': 'name',
      'ふりがな': 'kana',
      'メールアドレス': 'mail',
      '携帯電話番号': 'mobile',
      '年齢': 'age',
      'ご住所': 'address',
      '町村・番地': 'street',
      '何を見て「なごみ工務店」お知りになりましたか？': 'medium',
      '新しいお住まいのご希望': 'wish',
      'ご希望の土地のエリア': 'area',
      'ご質問・ご相談等': 'question'
    }
  },
  {
    brand: 'JH',
    campaign: '【JH共通】会員登録',
    query: 'label:会員登録_JH subject:会員登録がありました newer_than:2d',
    labels: {
      'お名前': 'name',
      'フリガナ': 'kana',
      '電話番号': 'mobile',
      'メールアドレス': 'mail',
      'ご住所': 'address',
      'ジャスフィーホームを知ったきっかけ': 'medium',
      'ご希望の土地のエリアを教えてください': 'area',
      'ご質問・ご相談等': 'question'
    }
  }
];

/** ⚠️ 見出しの無い行を「続き」として受ける項目（複数行になる自由記述） */
const MEMBER_MULTILINE_KEYS = ['question'];

/** 店舗が決まらないときの店舗名。⚠️ どれも Dashboard の店舗一覧（shop_list）に実在する */
const MEMBER_NOT_FOUND_SHOP = {
  KH: 'KH店舗未設定',
  Nagomi: 'なごみ店舗未設定',
  JH: 'JH店舗未設定',
  // ⚠️ 2L は店舗が1つだけなので、以前の GAS と同じく県外の住所でも 2L鹿児島店 にする
  '2L': '2L鹿児島店'
};

/**
 * 住所 → 店舗の表。⚠️⚠️ sync の utils/portalShopList.ts から 4ブランド分をそのまま写したもの（2026-10-22）。
 *
 * ⚠️ 照合は「ブランドが同じで、住所に area を含む最初の1件」。⚠️ **先に一致した行が勝つ。**
 * ⚠️ 追加は必ず末尾に（福岡県も末尾。2文字の area が他県の住所に偶然当たらないように）。
 * ⚠️ shop は shop_list の店舗名と完全一致させること（違うと一覧にも集計にも出ない顧客ができる）。
 * ⚠️ portalShopList.ts を直したら、ここも同じように直すこと。
 */
const MEMBER_SHOP_LIST = [
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

/** 全角の英数字・記号を半角に（電話・郵便番号用） */
function memberToHalfWidth(text) {
  return String(text || '').replace(/[！-～]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
}

/** 半角・全角の空白をすべて消す */
function memberRemoveSpaces(text) {
  return String(text || '').replace(/[\s　]+/g, '');
}

/**
 * 本文を「見出し : 値」で読む。
 *
 * ⚠️ 半角・全角のコロンを受ける。⚠️ 見出しの後ろの空白の数はメールごとに違うので trim して比べる。
 * ⚠️ 値が空の見出しは、⚠️ **次の行からが値**（KH・なごみの「何を見て…」は値が次の行に来る）。
 * ⚠️ 見出しの無い行は、直前の項目の続き。⚠️ ただし続きにするのは「何を見て」のように値が空だった項目と自由記述だけ。
 * ⚠️ `----` `====` の区切り線・知らない見出しで直前の項目を閉じる（2L の「その他を選択された方」などを混ぜない）。
 * ⚠️ `--` だけの行（署名の区切り）で読むのをやめる。
 */
function memberParseBody(body, labels) {
  const result = {};
  Object.keys(labels).forEach(function (label) { result[labels[label]] = ''; });

  let currentKey = '';
  let openForNextLine = false;
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '--') break;
    if (/^[-=]{3,}/.test(trimmed)) { currentKey = ''; continue; }

    const matched = trimmed.match(/^([^:：]+?)\s*[:：]\s*(.*)$/);
    const key = matched ? labels[matched[1].trim()] : undefined;
    if (key) {
      currentKey = key;
      result[key] = matched[2].trim();
      openForNextLine = result[key] === '';
      continue;
    }
    // ⚠️ 自由記述の途中に「時間: 10時」のような行があっても続きとして受ける
    const continues = currentKey !== '' && (openForNextLine || MEMBER_MULTILINE_KEYS.indexOf(currentKey) !== -1);
    if (matched && !continues) { currentKey = ''; continue; }
    if (continues && trimmed !== '') {
      result[currentKey] = result[currentKey] ? result[currentKey] + '\n' + trimmed : trimmed;
      // ⚠️ 「何を見て」の値は1行だけ。次の行は別の項目
      if (MEMBER_MULTILINE_KEYS.indexOf(currentKey) === -1) { currentKey = ''; openForNextLine = false; }
    }
  }
  return result;
}

/**
 * 住所の先頭の郵便番号を分ける。「〒8740840 大分県別府市鶴見」→ ['8740840', '大分県別府市鶴見']
 * ⚠️ ハイフン・全角数字・〒 の有無を問わない。
 */
function memberSplitZip(address) {
  const text = String(address || '').trim();
  const matched = memberToHalfWidth(text).match(/^〒?\s*(\d{3})-?(\d{4})\s*/);
  if (!matched) return ['', text];
  return [matched[1] + matched[2], text.slice(matched[0].length).trim()];
}

/** ブランドと住所から店舗を決める（ポータル反響と同じ。先に一致した1件が勝つ） */
function memberResolveShop(brand, address) {
  const text = String(address || '');
  if (text !== '') {
    for (const row of MEMBER_SHOP_LIST) {
      if (row.brand === brand && text.indexOf(row.area) !== -1) return row.shop;
    }
  }
  return MEMBER_NOT_FOUND_SHOP[brand] || 'ブランド・店舗未設定';
}

/** 日本時間の日付 */
function memberFormatDate(date, pattern) {
  return Utilities.formatDate(date, 'Asia/Tokyo', pattern);
}

/**
 * 1通のメールから送る内容を作る。⚠️ 送らないメールは null（理由をログに出す）。
 */
function memberBuildPayload(config, subject, body, date) {
  // ⚠️ 退会の通知は反響にしない（件名か、本文の最初の行に「退会」）
  const firstLine = (String(body || '').trim().split('\n')[0] || '');
  if (String(subject || '').indexOf('退会') !== -1 || firstLine.indexOf('退会') !== -1) {
    return { skip: '退会の通知' };
  }

  const v = memberParseBody(body, config.labels);
  const name = memberRemoveSpaces(v.name);
  const mail = memberRemoveSpaces(v.mail);
  const mobile = memberToHalfWidth(memberRemoveSpaces(v.mobile));
  if (name === '') return { skip: 'お名前が読めない' };
  if (mail === '' && mobile === '') return { skip: 'メールも電話も無い' };

  // ⚠️ 2L は項目が分かれて届く。他は「ご住所（〒＋都道府県市区町村）」＋「町村・番地」
  let zip = memberToHalfWidth(String(v.zip || '').replace(/[〒\-ー－\s]/g, ''));
  let address = '';
  if (config.brand === '2L') {
    address = [v.pref, v.city, v.street, v.building].join('').trim();
  } else {
    const split = memberSplitZip(v.address);
    zip = split[0];
    address = (split[1] + (v.street || '')).trim();
  }

  const remarks = [
    ['年齢', v.age],
    ['会員登録のきっかけ', v.trigger],
    ['新しいお住まいのご希望', v.wish],
    ['ご希望の土地のエリア', v.area],
    ['ご質問・ご相談等', v.question]
  ].filter(function (pair) { return pair[1]; })
    .map(function (pair) { return pair[0] + '：' + pair[1]; })
    .join('\n');

  return {
    request: 'member_entry',
    // ⚠️ 以前の GAS と同じ形（homepage＋日時＋キャンペーン名）。切り替えの前後で同じメールが二重に入らないように
    inquiry_id: 'homepage' + memberFormatDate(date, 'yyyy/MM/ddHH:mm:ss') + config.campaign,
    inquiry_date: memberFormatDate(date, 'yyyy/MM/dd'),
    brand: config.brand,
    shop: memberResolveShop(config.brand, address),
    campaign: config.campaign,
    // ⚠️ 2L は複数選べる。以前と同じく最初の1つ
    response_medium: String(v.medium || '').split(/[,、]/)[0].trim(),
    name: name,
    kana: memberRemoveSpaces(v.kana),
    mobile: mobile,
    mail: mail,
    zip: zip,
    address: address,
    remarks: remarks
  };
}

/**
 * 送る。② → だめなら ①。
 * ⚠️ ① に送り直すのは「② に届かなかった」とき（通信エラー・5xx）だけ。
 *   401（合い言葉違い）・400（項目不足）は ① でも同じ結果なので送り直さない。
 */
function memberPost(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const targets = [['②', MEMBER_EXPRESS_URL], ['①', MEMBER_PHP_URL]];

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
function MEMBERtoDashboard() {
  const key = PropertiesService.getScriptProperties().getProperty('MEMBER_ENTRY_KEY');
  if (!key) {
    Logger.log('⚠️ スクリプト プロパティ MEMBER_ENTRY_KEY が未設定です。取り込みを中止しました。');
    return;
  }

  MEMBER_BRANDS.forEach(function (config) {
    const threads = GmailApp.search(config.query);
    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (message) {
        const payload = memberBuildPayload(config, message.getSubject(), message.getPlainBody(), message.getDate());
        if (payload.skip) {
          Logger.log(config.brand + ' 送らない（' + payload.skip + '）: ' + message.getSubject());
          return;
        }
        payload.key = key;
        memberPost(payload);
      });
    });
  });
}
```

### backend/scripts/sql/2026-10-22_update_log_2.2.209.sql（新規）
```sql
-- =====================================================================
-- update_log に v2.2.209 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.209', '2026-10-22', 'ホームページの会員登録（国分ハウジング・ニーエルホーム・なごみ工務店・ジャスフィーホーム）の取り込みを見直した。福岡県の会員登録が KH久留米店 に入るようにし、退会の通知や中身が空のメールが反響として入らないようにした。同じお客様が既にいるときに「知ったきっかけ」が消える不具合を直した。');
```

### 変更したファイルの差分（env.ts・registry.ts・express_proxy.php・docker-compose.yml・docker-compose.prod.yml・version.ts）
```diff
diff --git a/backend-express/src/config/env.ts b/backend-express/src/config/env.ts
index 2941556f..bc07c176 100644
--- a/backend-express/src/config/env.ts
+++ b/backend-express/src/config/env.ts
@@ -178,6 +178,15 @@ export const env = {
    */
   eventCheckinPasscode: (process.env.EVENT_CHECKIN_PASSCODE ?? '').trim(),
 
+  /**
+   * 会員登録の取り込み（member_entry。GAS の MEMBERtoDashboard が送る）の合い言葉。（v2.2.209）
+   *
+   * ⚠️ **未設定なら全件断る**（素通しにしない）。⚠️ requireEnv にはしない（他の機能まで止めないため）。
+   * ⚠️ 同じ値を GAS のスクリプト プロパティ MEMBER_ENTRY_KEY と ① の環境変数にも入れる。
+   *   ⚠️ **リポジトリに書かないこと。** 設定先は ② VPS の .env.prod のみ。
+   */
+  memberEntryKey: (process.env.MEMBER_ENTRY_KEY ?? '').trim(),
+
   /** アンバサダー反響の社内通知先。カンマ区切りで複数可 */
   ambassadorNotifyTo: (process.env.AMBASSADOR_NOTIFY_TO ?? '')
     .split(',')
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 8b8eee0a..7a871544 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -142,6 +142,7 @@ import { runShopList } from '../features/shopList';
 import { runUpdateLog } from '../features/updateLog';
 import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
 import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
+import { runMemberEntry } from '../features/memberEntry/entry';
 import type { GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
 
@@ -2254,6 +2255,26 @@ register({
   },
 });
 
+/**
+ * ⚠️⚠️ **ホームページの会員登録（KH・2L・なごみ・JH）の取り込み。書き込み口である。**（v2.2.209）
+ *   ⚠️ 送ってくるのは GAS（MEMBERtoDashboard）。スタッフのトークンは無いので auth は none、
+ *     代わりに合い言葉（MEMBER_ENTRY_KEY）を本文の `key` で確かめる。
+ *   ⚠️ GAS は ② に届かなければ ① の handlers/member_entry.php へ送り直す（同じ処理）。
+ *   ⚠️ 同じ inquiry_id は二度入らない（2回目は status: exists）。① の転送が二度届いても安全。
+ *   ⚠️ GATEWAY_REQUIRE_AUTH を true にすると止まる（GAS はスタッフのトークンを持たない）。
+ */
+register({
+  request: 'member_entry',
+  summary: '【書き込み・合い言葉】ホームページの会員登録の取り込み（inquiry_customer）',
+  phpSource: 'khg-marketing.info/api/member.php（handlers/member_entry.php に作り直し）',
+  auth: 'none',
+  handler: async (ctx) => {
+    const result = await runMemberEntry(ctx.body as Record<string, unknown>);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 // ---------------------------------------------------------------------------
 // 他社広告ライブラリ（meta_ads）
 //
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 4a015653..0d65a2da 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -108,6 +108,12 @@ function expressProxyRequests(): array
         'kSnap',
         // ⚠️ v2.2.206。公開ギャラリーのログイン（参照のみ）。⚠️ 認証を要求しない（顧客向け）
         'k-snap_login',
+        // ⚠️⚠️ v2.2.209。会員登録の取り込み（GAS MEMBERtoDashboard）。**書き込みだが例外として入れる。**
+        //   ⚠️ 同じ inquiry_id は ②・① どちらでも二度入らない（2回目は status: exists）ので、
+        //     ② が保存した直後に応答が失われて ① の handlers/member_entry.php が動いても二重登録にならない。
+        //   ⚠️ ② が落ちたときは ① の PHP が保存する（GAS も ② に直接送れなかったときここへ送り直す）。
+        //   ⚠️ expressProxyExclusive() には入れないこと（入れると ① の予備が動かない）。
+        'member_entry',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
diff --git a/docker-compose.prod.yml b/docker-compose.prod.yml
index 70168bc2..81b47409 100644
--- a/docker-compose.prod.yml
+++ b/docker-compose.prod.yml
@@ -118,6 +118,13 @@ services:
       # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
       - EVENT_CHECKIN_PASSCODE=${EVENT_CHECKIN_PASSCODE:-}
 
+      # 会員登録の取り込み（member_entry。GAS の MEMBERtoDashboard が送る）の合い言葉（v2.2.209）。
+      #
+      # ⚠️ 未設定だと全件 401（素通しにしない）。GAS は ① の予備へ送り直すが、① も同じ値でないと入らない。
+      # ⚠️ GAS のスクリプト プロパティ MEMBER_ENTRY_KEY・① の環境変数と**同じ値**にすること。
+      # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
+      - MEMBER_ENTRY_KEY=${MEMBER_ENTRY_KEY:-}
+
       # K-SNAP の owner を公開ギャラリー向けに暗号化する鍵。
       #
       # ⚠️ ① の .htaccess（SetEnv）と**同じ値**にすること。
diff --git a/docker-compose.yml b/docker-compose.yml
index f8184a7f..a5a01dfc 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -24,6 +24,8 @@ services:
       # ⚠️ localhost ではなく express-api（サービス名）。
       #   php-web コンテナの中から見た宛先なので、localhost は自分自身になる。
       - EXPRESS_API_URL=http://express-api:3001/api/gateway
+      # 会員登録の取り込み（member_entry）の合い言葉。⚠️ 開発用のダミー値。本番の値は ① の環境変数にのみ書く（v2.2.209）
+      - MEMBER_ENTRY_KEY=localtest
     env_file:
       # 実際に価値を持つ秘密情報（暗号化マスターキー等）はこちら。
       # このファイルは .gitignore で保護されており、Gitには入らない。
@@ -68,6 +70,8 @@ services:
       # ⚠️ 空にすると受付機能が全て 401 になる。ローカルで受付を試すときは
       #   この値を使うこと。
       - EVENT_CHECKIN_PASSCODE=localtest
+      # 会員登録の取り込み（member_entry）の合い言葉。⚠️ 開発用のダミー値。本番の値は ② VPS の .env.prod にのみ書く（v2.2.209）
+      - MEMBER_ENTRY_KEY=localtest
     env_file:
       # Meta 広告 API のトークンと対象の ID（v2.2.203。META_ACCESS_TOKEN・META_AD_ACCOUNTS）。
       #
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 313eff76..93089c60 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.207';
+export const newVersion = '2.2.209';
```

## 追加の指示（同日）：ラベルではなく件名で取る
- 「ラベルはたまに外れるので件名で判断してほしい」
- `MEMBER_BRANDS` の `query`（ラベル）をやめ、`from`（差出人）と `subjects`（件名に含む語）にした
  - KH：`kh-t@kh-house.jp`・「会員登録」か「登録情報更新」／2L：`noreply@2lhome.net`・「会員登録」／なごみ：`wordpress@nagomi-koumuten.jp`・「会員登録」／JH：`wordpress@jusfy-home.com`・「会員登録」
  - ⚠️ 差出人は通知メールの見本から。wordpress@ はほかのフォームの通知も送るので、件名で絞る
- 追加した関数:
```js
/** Gmail の検索条件。⚠️ ラベルは使わない（差出人＋件名）。過去2日分を毎回読む（取り込み済みは受け側が飛ばす） */
function memberQuery(config) {
  const subjects = config.subjects.map(function (s) { return '"' + s + '"'; }).join(' OR ');
  return 'from:' + config.from + ' subject:(' + subjects + ') newer_than:2d';
}

/**
 * ⚠️ スレッドには条件に合わない返信・転送も混ざる（search はスレッド単位で返す）。1通ずつ差出人と件名を確かめる。
 * ⚠️ 返信・転送（Re: / Fwd:）は送らない（お客様の通知ではない）。
 */
function memberIsTarget(config, from, subject) {
  const s = String(subject || '');
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return false;
  return String(from || '').toLowerCase().indexOf(config.from) !== -1
    && config.subjects.some(function (keyword) { return s.indexOf(keyword) !== -1; });
}
```
- `MEMBERtoDashboard()` は `GmailApp.search(memberQuery(config))` にし、1通ごとに `memberIsTarget` で確かめてから読む
- テスト：読み取りの結果は変化なし（前回と同じ出力）。差出人・件名の判定 10件（見本の件名・別ブランドの差出人・資料請求・Re:／Fwd:）がすべて期待どおり
- ⚠️ 未確認：本番の Gmail での検索結果（メーリングリストが差出人を書き換えていないか）。デプロイ手順書の手順3に、検索窓での確認を足した
