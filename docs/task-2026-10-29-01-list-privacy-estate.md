# 2026-10-29 反響一覧・顧客DB・担当事業・メニューの改修（v2.2.227）

## 依頼
- ReadMeClaude.md（v2.2.227）
  - list ディレクトリ: ブラックリストのボタン → 一番小さいサイズで表示 → 理由を入力させ、値が TRUE（空でない）なら登録
  - favicon を Downloads/favicon に差し替え
- 追加（同じブランチ）
  - ListKaeru・ListResale: タグボタンが折れて不格好なので表の width を調整
  - リロードボタンを追加（→ list の3画面）
  - InformationEdit（Kaeru・Resale）のヘッダーに「個人情報削除」: 氏名・電話番号・メールアドレス・住所を ********、show_dashboard = 0
  - ListOrder（Kaeru・Resale）の各行に「個人情報削除」: 同じ列を ********、sync = 1
  - spec と realty のユーザーが used と realty の両方を見られるように（まとめてもいい）。共有された realty アプリのユーザーと spec のユーザーを差し替える SQL
  - Menu.tsx を固定し、はみ出た分をスクロール（右側のスクロールと一緒に動かさない）
- 確認への回答: モーダルは sm／リロードは list の3画面／個人情報の列は「同じ種類の列も含める」／個人情報削除の一覧は注文も含めた3画面／押せるのはその画面を使える全員／担当事業は A（estate にまとめる）

## 決めたこと
- **ブラックリストの理由**（BlackReasonModal.tsx。3画面共通）: タグを付けるときだけ sm のモーダル。空・空白だけでは「登録」を押せない。理由は black_list.note に「日付 理由」で残す
  - ⚠️ 調べる中で見つけた既存の問題: 登録は「押すたびに反転」だったため、別の反響で同じ人が登録済みだと**登録のつもりで解除**になっていた。再登録では理由も残らなかった
  - → ② の list:black に **value = 1（登録だけ）** を足した。登録中なら解除せず理由を書き足す／解除済みなら戻して書き足す／無ければ新規。value が無ければ今までどおりのトグル
- **再読み込み**: 3画面の読み込みを loadList（useCallback）に取り出し、「再読み込み」ボタンから呼ぶ。期間・絞り込みは変えない
- **表の幅**（ListKaeru・ListResale）: 表の幅が列の合計より狭く（建売 1500 < 2280、中古 1500 < 1820）、タグの列が押し縮められていた。タグの列を ListOrder と同じ 400px にし、表の幅を列の合計に（建売 2090・中古 1830。個人情報の列 110px を含む）。タグの並びは折り返さない
- **favicon**: public に7ファイル。index.html を ico・16/32/48・apple-touch-icon に、manifest.json を（無かった logo192/512 から）android-chrome に。古い favicon.png は削除
- **個人情報削除**（② の features/privacy.ts・画面は utils/privacyErase.ts）: 値が入っている列だけ ******** にする（空の列に入れると2人目などが居るように見えるため）。1つのトランザクション
  - 顧客DB（master_data_kaeru・resale）: 氏名・2人目・ふりがな・電話・携帯・メール・住所 → show_dashboard = 0。master_data_log に「誰が・どの列を」（値は書かない。log 列は JSON の CHECK あり）
  - 反響（inquiry_customer・_kaeru・_resale）: 氏名・ふりがな・携帯・固定電話・メール・郵便番号・住所 → sync = 1。記録は ② のログ
  - 確認（元に戻せません）を出してから送る。顧客DB は読み込みが終わるまで押せない
- **担当事業 estate**（建売・中古・不動産企画係）: utils/shopAccess.ts の canEnterCategory。事業を選ぶ画面・不動産企画係の入口・業務ガイド・日報（estate は建売として扱う）・権限編集の選択肢、② の REALTY_SHOPS・BROKER_SHOPS・AUTH_SHOPS、① の authz.php
  - SQL: spec・realty の人と、以前のアプリの担当者（設定の担当者4名。氏名の空白は無視）を estate に。⚠️ 全事業（all）の人は変えない。控え（staff_shop_bk_227）と戻す SQL つき
- **メニューの固定**: .modal_menu を sticky（ヘッダーの下〜画面の下）にし、中の Menu は高さ 100% でスクロール。fixed にすると右側が幅のぶんずれるため sticky。スマホの引き出しは今までどおり

## 確認したこと
- ① を通して ② まで届くか（トークン無しで 401）: privacy_erase の5つ・list:black
- ① を通した API（テスト行だけ）
  - ブラックリスト5通り: 新規（理由つき）／登録中にもう一度 → 解除しない・書き足す／理由なし → 今までどおり解除／解除済みを登録 → 戻して書き足す／空白の理由 → 備考を変えない
  - 個人情報削除: 反響3つ（値の入った列だけ伏せ、空の列はそのまま・ほかの行は無事・sync = 1）／顧客DB 2つ（show_dashboard = 0・履歴）／無い顧客 404／ID なし 400／顧客DB の注文は登録なし（404）
  - ⚠️ 最初は master_data_log の CHECK（JSON）で失敗 → 直した（トランザクションなので途中まで書き換わることはなかった）
- 画面（Playwright）: 3つの一覧でタグが1段（表の幅 1800・2090・1830）・再読み込み・理由のモーダル（sm・幅300px・空と空白は押せない・備考に入る・外すときは出ない）・行の個人情報削除／顧客DB 2つのヘッダーの個人情報削除（確認→知らせ→閉じる）／estate の人（注文は断られ、建売・中古・不動産企画係に入れる・チームサマリーが読める）／メニュー（右側を下までスクロールしても動かない・低い画面ではメニューの中でスクロール・右側の左端は 200px のまま・スマホの引き出しは画面いっぱい）。ページのエラー 0
- 担当事業の SQL をローカルで: 対象34人（建売32・以前のアプリの担当者のうち中古の2人）。戻す SQL で元どおり（違う人 0）→ もう一度差し替えた
- ② の型チェック・① の php -l・本番ビルド・変えた画面の型チェック
- テスト用の担当者・行・ブラックリストは消した

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features | **privacy.ts（新規）** | runPrivacyEraseMaster・runPrivacyEraseInquiry |
| backend-express/src/features/list | save.ts | runListBlack に value = 1（登録だけ）と理由の書き足し |
| backend-express/src/features/realty | index.ts | REALTY_SHOPS・BROKER_SHOPS に estate |
| backend-express/src/features | staffAdmin.ts | AUTH_SHOPS に estate |
| backend-express/src/gateway | registry.ts | privacy_erase:master（spec・used）・inquiry（order・spec・used） |
| backend/src/core | express_proxy.php・authz.php | privacy_erase の5つを2か所に／AUTHZ_*_SHOPS に estate |
| backend/scripts/sql | **2026-10-29_update_log_2.2.227.sql・2026-10-29_staff_shop_estate.sql・_restore.sql（新規）** | 更新履歴＋記事6本／担当事業の差し替えと戻し |
| frontend/src/components/list | **BlackReasonModal.tsx（新規）**・ListOrder・ListKaeru・ListResale・listUtils.ts | 理由のモーダル・再読み込み・個人情報削除・表の幅 |
| frontend/src/components/information | InformationEditKaeru・InformationEditResale | ヘッダーの個人情報削除 |
| frontend/src/utils | **privacyErase.ts・shopAccess.ts（新規）**・version.ts | 個人情報削除の確認と送信／担当事業で入れる事業／2.2.227 |
| frontend/src/components | Category.tsx・Menu.tsx・header/EditAuth.tsx・header/DailyReports.tsx・guide/openGuide.ts・guide/guideScreens.ts・realty/RealtyRoute.tsx | estate・メニューの高さ |
| frontend/src | index.css | .modal_menu を sticky |
| frontend/public | index.html・manifest.json・**favicon 7ファイル（新規）**・favicon.png（削除） | アイコン |
| backend/scripts/guide/articles | order/screen-010・spec/screen-010・used/screen-010・spec/screen-020・used/screen-020・common/screen-230 | 記事（下） |

## 業務ガイドの記事
- 「反響一覧」「反響一覧（建売営業）」「反響一覧（中古リノベ）」: 再読み込み・ブラックリストに登録する（理由）・個人情報削除の節
- 「顧客DB（建売営業）」「顧客DB（中古リノベ）」: 個人情報削除の節
- 「不動産企画係の画面（入口と権限）」: 入れる人に「建売・中古・不動産企画係」、まとめたことの注意

## コード

### backend-express/src/features/privacy.ts（新規・全文）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../db/pool';
import type { AuthenticatedStaff } from '../types/staff';
import { logger } from '../utils/logger';

/**
 * 個人情報削除（v2.2.227。② だけ）。
 *
 * ─────────────────────────────────────────────
 * 2026-10-29 の指示:
 *   ・顧客DB（InformationEditKaeru / InformationEditResale のヘッダー）… 氏名・電話番号・メールアドレス・住所を
 *     アスタリスク8個にして show_dashboard = 0（privacy_erase:master）
 *   ・反響一覧（ListOrder / ListKaeru / ListResale の各行）… 同じ列をアスタリスクにして sync = 1（privacy_erase:inquiry）
 *   ・対象の列は「同じ種類の列も含める」（ふりがな・2人目の氏名・固定電話・郵便番号も）。押せるのはその画面を使える全員
 *
 * ⚠️⚠️ **元に戻せない。** 画面は「元に戻せません」の確認を出してから送る。
 * ⚠️ 値が入っている列だけ伏せる（空の列に入れると、2人目の氏名などが居るように見えるため）。
 * ⚠️ 誰がいつ消したかを残す: 顧客DB は master_data_log（顧客の変更履歴）、反響は ② のログ（反響には履歴の表が無い）。
 *   ⚠️ 履歴にも消した人の名前と日時だけを書き、消した値は書かない。
 * ⚠️ 表の名前は下の許可リストからだけ選ぶ（リクエストの値を SQL に入れない）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface PrivacyResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const MASK = '********';

/** 顧客DB（事業区分 → 表）。⚠️ 指示は建売・中古だけ */
const MASTER_TABLES: Record<string, string> = {
  spec: 'master_data_kaeru',
  used: 'master_data_resale',
};
const MASTER_COLUMNS = [
  'customer_contacts_name', 'customer_contacts_name_2', 'customer_contacts_name_kana', 'customer_contacts_name_kana_2',
  'customer_contacts_phone_number', 'customer_contacts_mobile_phone_number',
  'customer_contacts_email',
  'full_address',
];

/** 反響（事業区分 → 表） */
const INQUIRY_TABLES: Record<string, string> = {
  order: 'inquiry_customer',
  spec: 'inquiry_customer_kaeru',
  used: 'inquiry_customer_resale',
};
const INQUIRY_COLUMNS = [
  'first_name', 'last_name', 'first_name_kana', 'last_name_kana',
  'mobile', 'landline',
  'mail',
  'zip', 'pref', 'city', 'town', 'street', 'building',
];

export const MASTER_CATEGORIES = Object.keys(MASTER_TABLES);
export const INQUIRY_CATEGORIES = Object.keys(INQUIRY_TABLES);

const fail = (httpStatus: number, message: string): PrivacyResult => ({ httpStatus, body: { status: 'error', message } });

/** 値が入っている列だけ伏せる SET 句 */
const maskSets = (columns: string[]): string =>
  columns.map((c) => `\`${c}\` = IF(\`${c}\` IS NULL OR \`${c}\` = '', \`${c}\`, '${MASK}')`).join(', ');

const idOf = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '');

/** 'YYYY/MM/DD HH:mm'（日本時間。master_data_log の updated_at と同じ形） */
const nowForLog = (): string => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`;
};

/** 顧客DB: body = { id }（master_data_* の id） */
export const runPrivacyEraseMaster = async (staff: AuthenticatedStaff, category: string, body: Record<string, unknown>): Promise<PrivacyResult> => {
  const table = MASTER_TABLES[category];
  const id = idOf(body.id);
  if (!table) return fail(400, '事業区分が正しくありません');
  if (id === '' || id === 'new') return fail(400, '顧客IDがありません');

  const done = await withTransaction(async (tx) => {
    const rows = await tx.query<DynamicRow>(`SELECT id FROM ${table} WHERE id = ? FOR UPDATE`, [id]);
    if (rows.length === 0) return false;
    await tx.execute(`UPDATE ${table} SET ${maskSets(MASTER_COLUMNS)}, show_dashboard = 0 WHERE id = ?`, [id]);
    // ⚠️ log は JSON でないと入らない（CHECK json_valid）。資金計画書の書き戻しと同じく source と columns の形。⚠️ 値は書かない
    await tx.execute(
      'INSERT INTO master_data_log (id, customer, staff, updated_at, log) VALUES (?, ?, ?, ?, ?)',
      [id, MASK, staff.name, nowForLog(), JSON.stringify({ source: 'privacy_erase', columns: [...MASTER_COLUMNS, 'show_dashboard'], note: `個人情報削除（${MASK} にして非表示）` })]
    );
    return true;
  });
  if (!done) return fail(404, '顧客が見つかりません');
  logger.info(`privacy_erase:master ${category} id=${id} by=${staff.name}`);
  return { httpStatus: 200, body: { status: 'success', mask: MASK } };
};

/** 反響: body = { inquiry_id }。応答の columns は伏せた列（画面がその行を書き換えるため） */
export const runPrivacyEraseInquiry = async (staff: AuthenticatedStaff, category: string, body: Record<string, unknown>): Promise<PrivacyResult> => {
  const table = INQUIRY_TABLES[category];
  const inquiryId = idOf(body.inquiry_id);
  if (!table) return fail(400, '事業区分が正しくありません');
  if (inquiryId === '') return fail(400, '反響IDがありません');

  const row = await withTransaction(async (tx) => {
    const rows = await tx.query<DynamicRow>(`SELECT inquiry_id FROM ${table} WHERE inquiry_id = ? FOR UPDATE`, [inquiryId]);
    if (rows.length === 0) return null;
    await tx.execute(`UPDATE ${table} SET ${maskSets(INQUIRY_COLUMNS)}, sync = 1 WHERE inquiry_id = ?`, [inquiryId]);
    const after = await tx.query<DynamicRow>(`SELECT ${INQUIRY_COLUMNS.map((c) => `\`${c}\``).join(', ')}, sync FROM ${table} WHERE inquiry_id = ?`, [inquiryId]);
    return after[0] ?? null;
  });
  if (!row) return fail(404, '反響が見つかりません');
  logger.info(`privacy_erase:inquiry ${category} inquiry_id=${inquiryId} by=${staff.name}`);
  return { httpStatus: 200, body: { status: 'success', row } };
};
```

### frontend/src/components/list/BlackReasonModal.tsx（新規・全文）
```tsx
import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';

/**
 * ブラックリストに登録する理由を入れる小さな画面（v2.2.227）。ListOrder・ListKaeru・ListResale で共通。
 *
 * ⚠️ 2026-10-29 の指示: ブラックリストのボタンを押したら一番小さいサイズ（sm）で開き、理由を入れたときだけ登録する。
 *   理由が空（空白だけを含む）なら「登録」は押せない。
 * ⚠️ 理由は black_list.note（ヘッダーの「ブラックリスト編集」の備考）に入る（② の features/list/save.ts の runListBlack）。
 * ⚠️ 解除（タグを外す）のときは開かない（呼び出し側）。
 */

const MAX_REASON = 500;

type Props = {
    /** 登録しようとしているお客様の名前。null なら閉じている */
    name: string | null;
    onCancel: () => void;
    onSubmit: (reason: string) => void;
};

const BlackReasonModal: React.FC<Props> = ({ name, onCancel, onSubmit }) => {
    const [reason, setReason] = useState('');

    // 開くたびに空にする（前のお客様の理由を残さない）
    useEffect(() => { if (name !== null) setReason(''); }, [name]);

    const trimmed = reason.trim();
    const submit = () => { if (trimmed) onSubmit(trimmed); };

    return (
        <Modal show={name !== null} onHide={onCancel} size="sm" centered>
            <Modal.Header closeButton className="py-2">
                <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold' }}>ブラックリストに登録</Modal.Title>
            </Modal.Header>
            <Modal.Body className="py-2">
                <div style={{ fontSize: '12px', marginBottom: 6 }}>{name ? `${name} 様` : ''}</div>
                <label htmlFor="black-reason" style={{ fontSize: '11px', color: '#6c757d', display: 'block', marginBottom: 2 }}>
                    理由（必須）
                </label>
                <textarea
                    id="black-reason" className="form-control" rows={3} maxLength={MAX_REASON} autoFocus
                    style={{ fontSize: '12px' }} value={reason} placeholder="例）同業者の資料請求のため"
                    onChange={e => setReason(e.target.value)}
                />
                <div style={{ fontSize: '10px', color: '#6c757d', marginTop: 4 }}>理由はブラックリストの備考に残ります。</div>
            </Modal.Body>
            <Modal.Footer className="py-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" style={{ fontSize: '12px' }} onClick={onCancel}>キャンセル</button>
                <button type="button" className="btn btn-dark btn-sm" style={{ fontSize: '12px' }} disabled={!trimmed} onClick={submit}>登録</button>
            </Modal.Footer>
        </Modal>
    );
};

export default BlackReasonModal;
```

### frontend/src/utils/privacyErase.ts（新規・全文）
```ts
import apiClient from './apiClient';

/**
 * 個人情報削除（v2.2.227）。顧客DB（InformationEditKaeru / Resale）と反響一覧（ListOrder / Kaeru / Resale）で共通。
 *
 * ⚠️⚠️ 元に戻せない。必ず confirmPrivacyErase で確かめてから送る。
 * ⚠️ 処理は ② の features/privacy.ts（privacy_erase:master / privacy_erase:inquiry）。
 *   氏名・ふりがな・電話番号・メールアドレス・住所（郵便番号を含む）を ******** にする。
 *   顧客DB は show_dashboard = 0（一覧から消える）、反響は sync = 1（取込済み）。
 */

export const PRIVACY_MASK = '********';

/** 確認（キャンセルなら false） */
export const confirmPrivacyErase = (name: string, after: string): boolean =>
    window.confirm(
        `${name ? `${name} 様の` : ''}個人情報を削除します。\n\n`
        + `氏名・ふりがな・電話番号・メールアドレス・住所を「${PRIVACY_MASK}」に置き換え、${after}。\n`
        + '⚠️ 元に戻せません。よろしいですか？'
    );

type Body = { status?: string; message?: string; row?: Record<string, unknown> };

/** 送る。失敗は ② のメッセージで投げる */
export const postPrivacyErase = async (roll: 'master' | 'inquiry', category: string, key: Record<string, string>): Promise<Body> => {
    try {
        const res = await apiClient.post<Body>('', { request: 'privacy_erase', roll, category, ...key });
        if (res.data?.status !== 'success') throw new Error(res.data?.message || '個人情報を削除できませんでした');
        return res.data;
    } catch (e: unknown) {
        const message = (e as { response?: { data?: Body } })?.response?.data?.message;
        throw new Error(message || (e instanceof Error ? e.message : '通信エラーが発生しました'));
    }
};
```

### frontend/src/utils/shopAccess.ts（新規・全文）
```ts
/**
 * 担当事業（staff.shop）で入れる事業（category）（v2.2.227）。
 *
 * ⚠️ staff.shop は店舗名ではなく事業区分（order / spec / used / realty / estate / all）。
 * ⚠️ 2026-10-29 の指示: 建売（spec）と不動産企画係（realty）の人が、中古（used）と不動産企画係の両方を見られるように。
 *   「まとめてもいい」→ 新しい値 estate（建売・中古・不動産企画係）にまとめた（backend/scripts/sql/2026-10-29_staff_shop_estate.sql）。
 * ⚠️ ② の features/realty/index.ts（REALTY_SHOPS・BROKER_SHOPS）・staffAdmin.ts（AUTH_SHOPS）、
 *   ① の core/authz.php（AUTHZ_REALTY_SHOPS・AUTHZ_BROKER_SHOPS）も同じ考え方でそろえること。
 */

/** estate の人が入れる事業 */
export const ESTATE_CATEGORIES = ['spec', 'used', 'realty'];

/** その事業に入れるか（Category.tsx の入場判定・業務ガイドの切り替え） */
export const canEnterCategory = (shop: string, category: string): boolean =>
    shop === 'all' || shop === category || (shop === 'estate' && ESTATE_CATEGORIES.includes(category));
```

### backend/scripts/sql/2026-10-29_staff_shop_estate.sql（新規・全文）
```sql
-- =====================================================================
-- v2.2.227 担当事業（staff.shop）の差し替え: 建売（spec）と以前の不動産企画係アプリのユーザーを estate にまとめる
--
-- estate ＝ 建売・中古・不動産企画係の3つに入れる（frontend/src/utils/shopAccess.ts）。
-- 対象:
--   1. 担当事業が spec（建売）・realty（不動産企画係）の人
--   2. 以前の不動産企画係アプリ（khf-eigyokanri）の担当者（取り込んだ設定の担当者）。氏名の空白は無視して突き合わせる
-- ⚠️ 全事業（all）の人は変えない（権限が狭くなるため）。⚠️ estate の人はそのまま
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ v2.2.227 の ② と ① PHP・フロントを出したあとに流す
--   （先に流すと、estate の人が事業を選ぶ画面で「閲覧権限がありません」になる）
-- ⚠️ 戻すときは 2026-10-29_staff_shop_estate_restore.sql（控えの表 staff_shop_bk_227 から戻す）
-- =====================================================================

-- 1) 流す前の確認（対象の人と今の担当事業）。⚠️ ここで人数と顔ぶれを確かめてから 2) へ
SELECT id, name, brand, shop AS 今の担当事業
  FROM staff
 WHERE shop <> 'all' AND shop <> 'estate'
   AND (shop IN ('spec', 'realty')
        OR REPLACE(REPLACE(name, ' ', ''), '　', '') IN ('時任聡一朗', '宮城智一', '永田倫也', '岡崎真夕'))
 ORDER BY shop, id;

-- 2) 控え（対象の人の id と今の担当事業）。⚠️ 前の控えは作り直す（控えの表だけ。staff には触らない）
DROP TABLE IF EXISTS staff_shop_bk_227;
CREATE TABLE staff_shop_bk_227 AS
SELECT id, name, shop
  FROM staff
 WHERE shop <> 'all' AND shop <> 'estate'
   AND (shop IN ('spec', 'realty')
        OR REPLACE(REPLACE(name, ' ', ''), '　', '') IN ('時任聡一朗', '宮城智一', '永田倫也', '岡崎真夕'));

-- 3) 差し替え（控えにある人だけ）
UPDATE staff s JOIN staff_shop_bk_227 b ON b.id = s.id SET s.shop = 'estate';

-- 4) 確認: 担当事業ごとの人数（spec・realty が 0 になり、estate が控えの人数と同じならよい）
SELECT shop AS 担当事業, COUNT(*) AS 人数 FROM staff GROUP BY shop ORDER BY shop;
SELECT COUNT(*) AS 控えの人数 FROM staff_shop_bk_227;
```

### backend/scripts/sql/2026-10-29_staff_shop_estate_restore.sql（新規・全文）
```sql
-- =====================================================================
-- v2.2.227 担当事業の差し替えを戻す（2026-10-29_staff_shop_estate.sql の控え staff_shop_bk_227 から）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 控えにある人だけ、控えの担当事業に戻す。⚠️ 差し替えのあと権限編集で直した人も控えの値に戻る
-- =====================================================================
UPDATE staff s JOIN staff_shop_bk_227 b ON b.id = s.id SET s.shop = b.shop;

-- 確認: 控えと同じに戻ったか（0 ならよい）
SELECT COUNT(*) AS 戻っていない人 FROM staff s JOIN staff_shop_bk_227 b ON b.id = s.id WHERE s.shop <> b.shop;
```

### backend/scripts/sql/2026-10-29_update_log_2.2.227.sql（新規）
更新履歴の1行と記事6本の SQL（build-guide-sql.cjs の出力。記事は下の差分と同じ）。更新履歴の部分だけ載せる。
```sql
-- =====================================================================
-- update_log に v2.2.227 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.227', '2026-10-29', '反響一覧（注文・建売・中古）でブラックリストに登録するとき、理由を入れる小さな画面を出すようにした（理由はブラックリストの備考に残る）。一覧に「再読み込み」ボタンを付けた。建売・中古の一覧で顧客タグのボタンが折れないよう表の幅を直した。Dashboard のアイコン（favicon）を新しくした。反響一覧（注文・建売・中古）と顧客DB（建売・中古）に「個人情報削除」を付けた。担当事業に「建売・中古・不動産企画係」を足し、建売と以前の不動産企画係アプリの人をまとめた。左のメニューを画面に固定し、はみ出た分はメニューの中でスクロールするようにした。');
```

### favicon
Downloads/favicon の7ファイル（android-chrome-192x192.png・android-chrome-512x512.png・apple-touch-icon.png・favicon.ico・favicon-16x16.png・favicon-32x32.png・favicon-48x48.png）を frontend/public へ。favicon.png を削除。

### 直したファイル（差分）

#### backend-express/src/features/list/save.ts
```diff
diff --git a/backend-express/src/features/list/save.ts b/backend-express/src/features/list/save.ts
index f6bd1fbc..ce0afeff 100644
--- a/backend-express/src/features/list/save.ts
+++ b/backend-express/src/features/list/save.ts
@@ -14,7 +14,7 @@ import type { ListResult } from './index';
  *   roll = 'shop_change'  → 担当店舗（中古はカテゴリー）の変更
  *   roll = 'staff_change' → 担当営業の変更
  *   roll = 'tag'          → 顧客タグ（重複/ギフト/業者/ブラック）の ON・OFF
- *   roll = 'black'        → ブラックリストの登録・解除（トグル）
+ *   roll = 'black'        → ブラックリストの登録・解除（トグル。value = 1 なら登録だけ。v2.2.227）
  *   roll = 'insert'       → 顧客台帳への取り込み（upsert）＋反響の同期済み化
  *
  * ⚠️⚠️ **① の PHP ハンドラは実在する。** いずれも書き込みなので、
@@ -296,6 +296,11 @@ export const runListTag = async (body: unknown): Promise<ListResult> => {
  *
  * ⚠️ 登録日は `date('Y/m/d')` と同じ 'YYYY/MM/DD'（スラッシュ区切り）。
  *   ハイフンにすると既存データと書式が混ざる。
+ *
+ * ⚠️⚠️ v2.2.227: **value = 1 のときは登録だけ**（反響一覧で理由を入れて登録するとき）。
+ *   トグルのままだと、別の反響で同じ人がすでに登録されていると「登録」のつもりで**解除**になっていた。
+ *   value = 1 のとき: 1. 登録中 → そのまま（理由を備考に書き足す）／2. 解除済み → 戻して理由を書き足す／3. 無し → 新規
+ *   ⚠️ 理由（note）は備考の末尾に「日付 理由」で足す（前の理由を消さない）。value が無ければ今までどおりのトグル
  */
 const BLACK_DATE = (): string => {
   const parts = new Intl.DateTimeFormat('ja-JP', {
@@ -313,6 +318,11 @@ export const runListBlack = async (body: unknown): Promise<ListResult> => {
 
   const mobile = asString(data.mobile);
   const mail = asString(data.mail);
+  const registerOnly = data.value === 1 || data.value === '1';
+  const note = asString(data.note).trim().slice(0, 500);
+  // 備考に「日付 理由」を書き足す式（備考が空ならそのまま入れる）
+  const appendNote = "note = IF(? = '', note, IF(note = '', ?, CONCAT(note, '\n', ?)))";
+  const noteParams = (): SqlParam[] => [note, `${BLACK_DATE()} ${note}`, `${BLACK_DATE()} ${note}`];
 
   // ⚠️ 両方空だと無関係な行に当たる（上のコメント参照）
   if (mobile === '' && mail === '') {
@@ -329,6 +339,14 @@ export const runListBlack = async (body: unknown): Promise<ListResult> => {
         [mobile, mail]
       );
 
+      if (active.length > 0 && registerOnly) {
+        await tx.execute(
+          `UPDATE black_list SET ${appendNote} WHERE (mobile = ? OR mail = ?) AND show_key = 1`,
+          [...noteParams(), mobile, mail]
+        );
+        return 'already_active';
+      }
+
       if (active.length > 0) {
         await tx.execute(
           'UPDATE black_list SET show_key = 0 WHERE (mobile = ? OR mail = ?) AND show_key = 1',
@@ -343,7 +361,8 @@ export const runListBlack = async (body: unknown): Promise<ListResult> => {
       );
 
       if (any.length > 0) {
-        await tx.execute('UPDATE black_list SET show_key = 1 WHERE mobile = ? OR mail = ?', [
+        await tx.execute(`UPDATE black_list SET show_key = 1, ${appendNote} WHERE mobile = ? OR mail = ?`, [
+          ...noteParams(),
           mobile,
           mail,
         ]);
@@ -379,7 +398,7 @@ export const runListBlack = async (body: unknown): Promise<ListResult> => {
           asString(data.zip),
           // ⚠️ フロントは `address` で送るが、列名は full_address
           asString(data.address),
-          asString(data.note),
+          note === '' ? '' : `${BLACK_DATE()} ${note}`,
         ]
       );
       return 'insert_success';
```

#### backend-express/src/features/realty/index.ts
```diff
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index 469d2b77..ed962ac9 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -24,9 +24,10 @@ import type { AuthenticatedStaff } from '../../types/staff';
  */
 
 /** 不動産企画係の画面を使える担当事業 */
-export const REALTY_SHOPS = ['realty', 'all'];
+// ⚠️ v2.2.227: estate（建売・中古・不動産企画係）も入れる（frontend/src/utils/shopAccess.ts）
+export const REALTY_SHOPS = ['realty', 'estate', 'all'];
 /** 媒介台帳（broker:*）を使える担当事業。⚠️ 中古の顧客DB・顧客詳細も台帳を読み書きする */
-export const BROKER_SHOPS = ['realty', 'all', 'used'];
+export const BROKER_SHOPS = ['realty', 'estate', 'all', 'used'];
 
 interface DynamicRow extends RowDataPacket {
   [key: string]: unknown;
```

#### backend-express/src/features/staffAdmin.ts
```diff
diff --git a/backend-express/src/features/staffAdmin.ts b/backend-express/src/features/staffAdmin.ts
index ecb543b5..7f0b0780 100644
--- a/backend-express/src/features/staffAdmin.ts
+++ b/backend-express/src/features/staffAdmin.ts
@@ -65,7 +65,8 @@ export const AUTH_BRANDS = ['Master', 'BrandAdmin', 'Manager', 'ordinary', 'Cons
  *   （2026-10-05 に利用者と確認済み）。
  */
 // ⚠️ v2.2.221: realty（不動産企画係）を追加。⚠️ realty の人は不動産企画係の画面にだけ入れる
-export const AUTH_SHOPS = ['order', 'spec', 'used', 'realty', 'all'] as const;
+// ⚠️ v2.2.227: estate（建売・中古・不動産企画係の3つに入れる人）を追加
+export const AUTH_SHOPS = ['order', 'spec', 'used', 'realty', 'estate', 'all'] as const;
 
 const isAuthBrand = (value: string): boolean => (AUTH_BRANDS as readonly string[]).includes(value);
 const isAuthShop = (value: string): boolean => (AUTH_SHOPS as readonly string[]).includes(value);
```

#### backend-express/src/gateway/registry.ts
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index e978c2d5..828a77fe 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -175,6 +175,7 @@ import type { Result as RealtyResult } from '../features/realty';
 import { runPlannerCompliance, runPlannerSettings, runPlannerState, runPlannerWeekly } from '../features/realty/state';
 import { runImportCheck, runImportFinish, runImportRecords } from '../features/realty/importer';
 import { runCallLogs, runCallLogsImport, runCallMark, runCallUndo, runNaviSave, runPracticeLogsImport } from '../features/realty/calls';
+import { INQUIRY_CATEGORIES, MASTER_CATEGORIES, runPrivacyEraseInquiry, runPrivacyEraseMaster } from '../features/privacy';
 import type { AuthenticatedStaff } from '../types/staff';
 import type { GatewayContext, GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
@@ -1830,6 +1831,47 @@ for (const category of ['order', 'spec', 'used']) {
   });
 }
 
+// ---------------------------------------------------------------------------
+// 個人情報削除（v2.2.227。② だけ）。features/privacy.ts
+//   privacy_erase:master  … 顧客DB（InformationEditKaeru / Resale のヘッダー）。建売・中古
+//   privacy_erase:inquiry … 反響一覧（ListOrder / Kaeru / Resale の各行）。注文・建売・中古
+// ⚠️ 元に戻せない書き込み。⚠️ express_proxy.php の expressProxyRequests() と expressProxyExclusive() の両方に入れてある
+// ⚠️ 押せるのはその画面を使える全員（2026-10-29 の利用者の判断）。ログインは必須（auth: 'staff'）
+// ⚠️ category は本文の値（事業区分）。ゲートウェイの鍵に入るので値ごとに登録する
+// ---------------------------------------------------------------------------
+for (const category of MASTER_CATEGORIES) {
+  register({
+    request: 'privacy_erase',
+    roll: 'master',
+    category,
+    summary: `【書き込み・元に戻せない】顧客DBの個人情報を伏せて非表示（${category}）`,
+    phpSource: '(Express のみ。PHPハンドラは無い)',
+    auth: 'staff',
+    handler: async (ctx) => {
+      if (!ctx.staff) return null;
+      const result = await runPrivacyEraseMaster(ctx.staff, category, ctx.body);
+      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+      return result.body;
+    },
+  });
+}
+for (const category of INQUIRY_CATEGORIES) {
+  register({
+    request: 'privacy_erase',
+    roll: 'inquiry',
+    category,
+    summary: `【書き込み・元に戻せない】反響の個人情報を伏せて取込済みに（${category}）`,
+    phpSource: '(Express のみ。PHPハンドラは無い)',
+    auth: 'staff',
+    handler: async (ctx) => {
+      if (!ctx.staff) return null;
+      const result = await runPrivacyEraseInquiry(ctx.staff, category, ctx.body);
+      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+      return result.body;
+    },
+  });
+}
+
 // ---------------------------------------------------------------------------
 // 店舗別動向（shopTrend/ShopTrendOrder.tsx / ShopTrendKaeru.tsx / ShopTrendResale.tsx）
 //
```

#### backend/src/core/express_proxy.php
```diff
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 9024b889..596dc7ab 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -166,6 +166,12 @@ function expressProxyRequests(): array
         'planner:call_logs',
         'planner:call_logs_import',
         'planner:practice_logs_import',
+        // ⚠️ v2.2.227。個人情報削除（元に戻せない・② だけ）。expressProxyExclusive() にも入れてある
+        'privacy_erase:master:spec',
+        'privacy_erase:master:used',
+        'privacy_erase:inquiry:order',
+        'privacy_erase:inquiry:spec',
+        'privacy_erase:inquiry:used',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
@@ -832,6 +838,12 @@ function expressProxyExclusive(): array
         'planner:call_logs',
         'planner:call_logs_import',
         'planner:practice_logs_import',
+        // v2.2.227 新規。個人情報削除（元に戻せない）。⚠️ ① に PHP ハンドラは無い（② だけ）
+        'privacy_erase:master:spec',
+        'privacy_erase:master:used',
+        'privacy_erase:inquiry:order',
+        'privacy_erase:inquiry:spec',
+        'privacy_erase:inquiry:used',
 
         // -----------------------------------------------------------------
         // v2.2.215 新規。オーナーズハウス募集（owners_house_application）の一覧と過去メールの取り込み。
```

#### backend/src/core/authz.php
```diff
diff --git a/backend/src/core/authz.php b/backend/src/core/authz.php
index d28e4852..40ec2b5f 100644
--- a/backend/src/core/authz.php
+++ b/backend/src/core/authz.php
@@ -93,8 +93,9 @@ const AUTHZ_KPI_ANALYSIS = ['Master', 'BrandAdmin', 'Manager'];
  * 不動産企画係（realty）の画面を使える担当事業（v2.2.221）。② の REALTY_SHOPS / BROKER_SHOPS と同じ値にすること。
  *   媒介台帳（broker）は中古の顧客DB・顧客詳細も読み書きするため used も可。
  */
-const AUTHZ_REALTY_SHOPS = ['realty', 'all'];
-const AUTHZ_BROKER_SHOPS = ['realty', 'all', 'used'];
+// ⚠️ v2.2.227: estate（建売・中古・不動産企画係）も入れる（② の features/realty/index.ts と同じ）
+const AUTHZ_REALTY_SHOPS = ['realty', 'estate', 'all'];
+const AUTHZ_BROKER_SHOPS = ['realty', 'estate', 'all', 'used'];
 
 /**
  * 認証と「担当事業（staff.shop）が許されていること」の確認（v2.2.221）。
```

#### frontend/src/components/list/listUtils.ts
```diff
diff --git a/frontend/src/components/list/listUtils.ts b/frontend/src/components/list/listUtils.ts
index 00ee60ab..c2c49762 100644
--- a/frontend/src/components/list/listUtils.ts
+++ b/frontend/src/components/list/listUtils.ts
@@ -8,7 +8,12 @@ export const dateFormate = (date: string) => {
     return date ? date.replace(/-/g, '/') : '';
 };
 
-export const handleBlack = async (brandValue: string, nameValue: string, mobileValue: string, mailValue: string, zipValue: string, addressValue: string, category: string) => {
+/**
+ * ブラックリスト（名簿 black_list）への登録。
+ * ⚠️ v2.2.227: reason（理由）を渡すと「登録だけ」（value = 1）で送り、理由を備考に残す。
+ *   渡さないと今までどおりのトグル（登録中なら解除）。② の features/list/save.ts の runListBlack
+ */
+export const handleBlack = async (brandValue: string, nameValue: string, mobileValue: string, mailValue: string, zipValue: string, addressValue: string, category: string, reason?: string) => {
     const fetchData = async () => {
         try {
             const response = await apiClient.post('',
@@ -21,7 +26,8 @@ export const handleBlack = async (brandValue: string, nameValue: string, mobileV
                     address: addressValue,
                     request: 'list',
                     category,
-                    roll: 'black'
+                    roll: 'black',
+                    ...(reason ? { value: 1, note: reason } : {}),
                 });
             console.log(response.data.status);
         } catch (err) {
```

#### frontend/src/components/list/ListOrder.tsx
```diff
diff --git a/frontend/src/components/list/ListOrder.tsx b/frontend/src/components/list/ListOrder.tsx
index f0cbb3b7..56e994d8 100644
--- a/frontend/src/components/list/ListOrder.tsx
+++ b/frontend/src/components/list/ListOrder.tsx
@@ -1,4 +1,4 @@
-import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
+import React, { useCallback, useEffect, useState, useContext, useMemo, useRef } from 'react';
 import Table from "react-bootstrap/Table";
 import apiClient from '../../utils/apiClient';
 import AuthContext from '../../context/AuthContext';
@@ -10,6 +10,8 @@ import InformationEdit from '../information/InformationEdit';
 import { generateULID } from '../../utils/createULID';
 import { positions } from './listUtils';
 import { monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField, filledField } from './listUtils';
+import BlackReasonModal from './BlackReasonModal';
+import { confirmPrivacyErase, postPrivacyErase } from '../../utils/privacyErase';
 import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './listTags';
 import type { TagKey } from './listTags';
 import { useIsSp } from '../../utils/isSp';
@@ -169,6 +171,40 @@ const ListOrder = ({ onReload }: Props) => {
         [summaryShops]
     );
 
+    const [reloading, setReloading] = useState(false);
+    /**
+     * 一覧のデータを読む（v2.2.227: 「再読み込み」ボタンからも呼ぶ）。
+     * ⚠️ 期間・店舗などの絞り込みはここでは変えない（初回の設定は下の useEffect）。
+     */
+    const loadList = useCallback(async () => {
+        const now = new Date();
+        const thisYear = now.getMonth() <= 4 ? now.getFullYear() : now.getFullYear() + 1;
+        try {
+            const response = await apiClient.post('', { request: 'list', category });
+            setCustomerList(response.data.summary);
+            setShopArray(response.data.shop);
+            const responseSection = response.data.section.filter(s => s.division === '注文事業').map(s => s.name);
+            setStaffList(response.data.staff.filter((s: Staff) => s.period === String(thisYear) && responseSection.includes(s.section))
+        .sort((a, b) => {
+            const positionA = positions.indexOf(a.position) ?? 6;
+            const positionB = positions.indexOf(b.position) ?? 6;
+            return positionA - positionB}));
+            setMediumArray(response.data.medium.filter((m: Medium) => m.list_medium === 1));
+            setOriginalList(response.data.inquiry);
+            setOriginalBeforeList(response.data.survey);
+            setBlackList(response.data.black);
+            setSections(responseSection);
+        } catch (error) {
+            console.error("データ取得エラー:", error);
+        }
+    }, [category]);
+
+    const reload = async () => {
+        setReloading(true);
+        await loadList();
+        setReloading(false);
+    };
+
     useEffect(() => {
         const now = new Date();
         const year = now.getFullYear();
@@ -185,31 +221,9 @@ const ListOrder = ({ onReload }: Props) => {
         setStartMonth(previousMonthValue({ monthArray: months }));
         setEndMonth(currentMonthValue());
         setSelectedMonth([`${year}/${month}`]);
-        const thisYear = now.getMonth() <= 4 ? year : year + 1;
-
-        const fetchData = async () => {
-            try {
-                const response = await apiClient.post('', { request: 'list', category });
-                setCustomerList(response.data.summary);
-                setShopArray(response.data.shop);
-                const responseSection = response.data.section.filter(s => s.division === '注文事業').map(s => s.name);
-                setStaffList(response.data.staff.filter((s: Staff) => s.period === String(thisYear) && responseSection.includes(s.section))
-            .sort((a, b) => {
-                const positionA = positions.indexOf(a.position) ?? 6;
-                const positionB = positions.indexOf(b.position) ?? 6;
-                return positionA - positionB}));
-                setMediumArray(response.data.medium.filter((m: Medium) => m.list_medium === 1));
-                setOriginalList(response.data.inquiry);
-                setOriginalBeforeList(response.data.survey);
-                setBlackList(response.data.black);
-                setSections(responseSection);
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
-        };
 
-        fetchData();
-    }, [category]);
+        void loadList();
+    }, [category, loadList]);
 
     useEffect(() => {
         const startIndex = startMonth ? monthArray.indexOf(startMonth) : 0;
@@ -534,14 +548,36 @@ const ListOrder = ({ onReload }: Props) => {
         }
     };
 
+    /**
+     * 個人情報削除（v2.2.227）。氏名・電話番号・メールアドレス・住所を ******** にして取込済み（sync = 1）にする。
+     * ⚠️ 元に戻せない（utils/privacyErase.ts・② の features/privacy.ts）
+     */
+    const erasePrivacy = async (item: InquiryCustomer) => {
+        const id = String(item.inquiry_id || '');
+        if (!confirmPrivacyErase(`${item.first_name || ''}${item.last_name || ''}`, '取込済みにします')) return;
+        try {
+            const d = await postPrivacyErase('inquiry', category, { inquiry_id: id });
+            const patch = (d.row ?? {}) as Partial<InquiryCustomer>;
+            patchRow(id, patch);
+            onReload();
+        } catch (e) {
+            alert((e as Error).message);
+        }
+    };
+
+    /** ブラックリストの理由を入れているお客様（v2.2.227。⚠️ 外すときは出さない） */
+    const [blackTarget, setBlackTarget] = useState<InquiryCustomer | null>(null);
+
     /**
      * 顧客タグの ON / OFF。
      *
      * ⚠️ 旧実装は black_list に文字列を追記し、出現回数の偶奇で判定していた。
      *   「押すたびに反転」する仕様だったため、通信が二重に走ると状態が
      *   ずれて戻せなくなった。ここでは次の値を明示して送るので冪等になる。
+     *
+     * ⚠️ v2.2.227: reason はブラックリストに登録するときの理由（BlackReasonModal で入れる）。
      */
-    const toggleTag = async (item: InquiryCustomer, tag: TagKey) => {
+    const toggleTag = async (item: InquiryCustomer, tag: TagKey, reason?: string) => {
         const nextValue = isTagOn(item, tag) ? 0 : 1;
         const field = TAG_FIELD[tag];
 
@@ -579,7 +615,8 @@ const ListOrder = ({ onReload }: Props) => {
                 item.mail || '',
                 item.zip || '',
                 `${item.pref || ''}${item.city || ''}${item.town || ''}${item.street || ''}${item.building || ''}`,
-                category
+                category,
+                reason
             );
         }
 
@@ -674,6 +711,9 @@ const ListOrder = ({ onReload }: Props) => {
                 .lo_saas .lo_btn_primary:hover { background: #1d4ed8; }
                 .lo_saas .lo_btn_success { background: #16a34a; color: #fff; }
                 .lo_saas .lo_btn_success:hover { background: #15803d; }
+                .lo_saas .lo_btn_secondary { background: #fff; color: #2563eb; border: 1px solid #2563eb; }
+                .lo_saas .lo_btn_secondary:hover { background: #eff6ff; }
+                .lo_saas .lo_btn:disabled { opacity: .6; cursor: wait; }
 
                 .lo_saas .inquiry { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
                                     box-shadow: 0 1px 3px rgba(15, 23, 42, .06), 0 1px 2px rgba(15, 23, 42, .04); }
@@ -765,6 +805,10 @@ const ListOrder = ({ onReload }: Props) => {
                     <button type="button" className="lo_btn lo_btn_primary m-1" onClick={() => setEditId('new')}>
                         <i className="fa-solid fa-plus" aria-hidden="true" />新規登録
                     </button>
+                    {/* ⚠️ v2.2.227: データだけ読み直す（絞り込みはそのまま） */}
+                    <button type="button" className="lo_btn lo_btn_secondary m-1" onClick={() => void reload()} disabled={reloading}>
+                        <i className={`fa-solid fa-arrows-rotate${reloading ? ' fa-spin' : ''}`} aria-hidden="true" />再読み込み
+                    </button>
 
                     {checkedIds.length > 0 && (
                         <button type="button" className="lo_btn lo_btn_success m-1" onClick={() => handleSync(checkedIds)}>
@@ -826,6 +870,7 @@ const ListOrder = ({ onReload }: Props) => {
                                 <td style={{ width: '130px' }}>詳細</td>
                                 <td style={{ width: '120px' }}>予定地</td>
                                 <td style={{ width: '400px' }}>顧客タグ</td>
+                                <td style={{ width: '110px', textAlign: 'center' }}>個人情報</td>
                             </tr>
                         </thead>
                         <tbody>
@@ -921,11 +966,16 @@ const ListOrder = ({ onReload }: Props) => {
                                                     <div
                                                         key={tag.key}
                                                         className={`${tag.className} text-white rounded-pill px-2 me-2 tag ${isTagOn(item, tag.key) ? 'checked' : ''}`}
-                                                        onClick={() => toggleTag(item, tag.key)}
+                                                        onClick={() => (tag.key === 'black' && !isTagOn(item, 'black') ? setBlackTarget(item) : toggleTag(item, tag.key))}
                                                     >{tag.label}</div>
                                                 ))}
                                             </div>
                                         </td>
+                                        <td style={{ textAlign: 'center' }}>
+                                            {/* ⚠️ v2.2.227: 個人情報削除（元に戻せない） */}
+                                            <button type="button" className="btn btn-outline-danger btn-sm" style={{ fontSize: '10px', padding: '0 6px' }}
+                                                onClick={() => void erasePrivacy(item)}>個人情報削除</button>
+                                        </td>
                                     </tr>);
                             })}
                         </tbody>
@@ -940,6 +990,16 @@ const ListOrder = ({ onReload }: Props) => {
             <OrderModal show={show} modalClose={modalClose} modalContent={modalContent} modalBeforeContent={modalBeforeContent} />
             <TrackingTouches inquiryId={trackingTarget?.id ?? null} customerName={trackingTarget?.name ?? ''} onClose={() => setTrackingTarget(null)} />
             <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
+            {/* ⚠️ v2.2.227: ブラックリストに登録する理由（一番小さい sm。理由が空なら登録できない） */}
+            <BlackReasonModal
+                name={blackTarget ? `${blackTarget.first_name || ''}${blackTarget.last_name || ''}` : null}
+                onCancel={() => setBlackTarget(null)}
+                onSubmit={reason => {
+                    const target = blackTarget;
+                    setBlackTarget(null);
+                    if (target) void toggleTag(target, 'black', reason);
+                }}
+            />
         </>
     )
 }
```

#### frontend/src/components/list/ListKaeru.tsx
```diff
diff --git a/frontend/src/components/list/ListKaeru.tsx b/frontend/src/components/list/ListKaeru.tsx
index ebefcf0f..a5942459 100644
--- a/frontend/src/components/list/ListKaeru.tsx
+++ b/frontend/src/components/list/ListKaeru.tsx
@@ -1,4 +1,4 @@
-import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
+import React, { useCallback, useEffect, useState, useContext, useMemo, useRef } from 'react';
 import Table from "react-bootstrap/Table";
 import apiClient from '../../utils/apiClient';
 import AuthContext from '../../context/AuthContext';
@@ -10,6 +10,8 @@ import Modal from 'react-bootstrap/Modal';
 import { setStyleClassSpec } from '../../utils/setStyleClassSpec';
 import { thisYear } from '../../utils/thisYear';
 import { dateFormate, monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField, filledField } from './listUtils';
+import BlackReasonModal from './BlackReasonModal';
+import { confirmPrivacyErase, postPrivacyErase } from '../../utils/privacyErase';
 import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './listTags';
 import type { TagKey } from './listTags';
 import { kataToHira } from '../../utils/kataToHira';
@@ -97,6 +99,32 @@ const ListKaeru = ({ onReload }: Props) => {
         [summaryShops]
     );
 
+    const [reloading, setReloading] = useState(false);
+    /**
+     * 一覧のデータを読む（v2.2.227: 「再読み込み」ボタンからも呼ぶ）。
+     * ⚠️ 期間・店舗などの絞り込みはここでは変えない（初回の設定は下の useEffect）。
+     */
+    const loadList = useCallback(async () => {
+        try {
+            const response = await apiClient.post('', { request: 'list', category });
+            setCustomerList(response.data.summary);
+            setShopArray(response.data.shop);
+            setStaffList(response.data.staff.filter((s: Staff) => s.period === String(thisYear) && targetSection.includes(s.section)));
+            setMediumArray(response.data.medium.map((m: any) => m.medium));
+            setOriginalList(response.data.inquiry);
+            setOriginalBeforeList(response.data.survey || []);
+            setBlackList(response.data.black);
+        } catch (error) {
+            console.error("データ取得エラー:", error);
+        }
+    }, [category]);
+
+    const reload = async () => {
+        setReloading(true);
+        await loadList();
+        setReloading(false);
+    };
+
     useEffect(() => {
         const now = new Date();
         const year = now.getFullYear();
@@ -115,22 +143,8 @@ const ListKaeru = ({ onReload }: Props) => {
         setEndMonth(currentMonthValue());
         setSelectedMonth([`${year}/${month}`]);
 
-        const fetchData = async () => {
-            try {
-                const response = await apiClient.post('', { request: 'list', category });
-                setCustomerList(response.data.summary);
-                setShopArray(response.data.shop);
-                setStaffList(response.data.staff.filter((s: Staff) => s.period === String(thisYear) && targetSection.includes(s.section)));
-                setMediumArray(response.data.medium.map((m: any) => m.medium));
-                setOriginalList(response.data.inquiry);
-                setOriginalBeforeList(response.data.survey || []);
-                setBlackList(response.data.black);
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
-        };
-        fetchData();
-    }, [category]);
+        void loadList();
+    }, [category, loadList]);
 
     useEffect(() => {
         const startIndex = startMonth ? monthArray.indexOf(startMonth) : 0;
@@ -422,14 +436,36 @@ const ListKaeru = ({ onReload }: Props) => {
         }
     };
 
+    /**
+     * 個人情報削除（v2.2.227）。氏名・電話番号・メールアドレス・住所を ******** にして取込済み（sync = 1）にする。
+     * ⚠️ 元に戻せない（utils/privacyErase.ts・② の features/privacy.ts）
+     */
+    const erasePrivacy = async (item: InquiryCustomer) => {
+        const id = String(item.inquiry_id || '');
+        if (!confirmPrivacyErase(`${item.first_name || ''}${item.last_name || ''}`, '取込済みにします')) return;
+        try {
+            const d = await postPrivacyErase('inquiry', category, { inquiry_id: id });
+            const patch = (d.row ?? {}) as Partial<InquiryCustomer>;
+            setOriginalList(prev => prev.map(row => (String(row.inquiry_id) === id ? { ...row, ...patch } as InquiryCustomer : row)));
+            onReload();
+        } catch (e) {
+            alert((e as Error).message);
+        }
+    };
+
+    /** ブラックリストの理由を入れているお客様（v2.2.227。⚠️ 外すときは出さない） */
+    const [blackTarget, setBlackTarget] = useState<InquiryCustomer | null>(null);
+
     /**
      * 顧客タグの ON / OFF。
      *
      * ⚠️ 旧実装は black_list に文字列を追記し、出現回数の偶奇で判定していた。
      *   「押すたびに反転」する仕様のため、通信が二重に走ると状態がずれた。
      *   次の値を明示して送ることで冪等にしている。
+     *
+     * ⚠️ v2.2.227: reason はブラックリストに登録するときの理由（BlackReasonModal で入れる）。
      */
-    const toggleTag = async (item: InquiryCustomer, tag: TagKey) => {
+    const toggleTag = async (item: InquiryCustomer, tag: TagKey, reason?: string) => {
         const id = String(item.inquiry_id || '');
         const nextValue = isTagOn(item, tag) ? 0 : 1;
         const field = TAG_FIELD[tag];
@@ -474,7 +510,8 @@ const ListKaeru = ({ onReload }: Props) => {
                 String(item.mail || ''),
                 String(item.zip || ''),
                 `${item.pref || ''}${item.city || ''}${item.town || ''}${item.street || ''}${item.building || ''}`,
-                category
+                category,
+                reason
             );
         }
 
@@ -642,6 +679,12 @@ const ListKaeru = ({ onReload }: Props) => {
 
                     <div className="bg-primary text-white px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                         onClick={() => setEditId('new')}>新規登録</div>
+                    {/* ⚠️ v2.2.227: データだけ読み直す（絞り込みはそのまま） */}
+                    <button type="button" className="bg-white text-primary px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center"
+                        style={{ border: '1px solid #0d6efd', cursor: reloading ? 'wait' : 'pointer', fontSize: '13px' }}
+                        onClick={() => void reload()} disabled={reloading}>
+                        <i className={`fa-solid fa-arrows-rotate me-1${reloading ? ' fa-spin' : ''}`} aria-hidden="true" />再読み込み
+                    </button>
 
                     {checkedIds.length > 0 && (
                         <div className="bg-success text-white px-3 py-1 rounded m-1 d-flex justify-content-center align-items-center"
@@ -688,7 +731,8 @@ const ListKaeru = ({ onReload }: Props) => {
                             </tbody>
                         </Table>}
 
-                    <Table striped bordered hover style={{ width: isSp ? '1100px' : '1500px', fontSize: isSp ? "8px" : "12px" }}>
+                    {/* ⚠️ v2.2.227: PC の幅は列の幅の合計（顧客タグは ListOrder と同じ 400px・個人情報 110px）。合計より狭いと顧客タグのボタンが折れる */}
+                    <Table striped bordered hover style={{ width: isSp ? '1100px' : '2090px', fontSize: isSp ? "8px" : "12px" }}>
                         <thead className='sticky-header'>
                             <tr className='sticky-header align-middle'>
                                 <td style={{ width: '100px', textAlign: 'center' }} className={`${isSp ? '' : 'sticky-column'}`}>顧客取込</td>
@@ -703,7 +747,8 @@ const ListKaeru = ({ onReload }: Props) => {
                                 <td style={{ width: '200px' }}>住所</td>
                                 <td style={{ width: '130px' }}>物件名</td>
                                 <td style={{ width: '120px' }}>希望エリア</td>
-                                <td style={{ width: '700px' }}>顧客タグ</td>
+                                <td style={{ width: '400px' }}>顧客タグ</td>
+                                <td style={{ width: '110px', textAlign: 'center' }}>個人情報</td>
                             </tr>
                         </thead>
                         <tbody>
@@ -782,16 +827,21 @@ const ListKaeru = ({ onReload }: Props) => {
                                         <td>{item.property || ''}</td>
                                         <td>{item.area || ''}</td>
                                         <td>
-                                            <div className='d-flex'>
+                                            <div className='d-flex' style={{ whiteSpace: 'nowrap' }}>
                                                 {TAG_DEFINITIONS.map(tag => (
                                                     <div
                                                         key={tag.key}
                                                         className={`${tag.className} text-white rounded-pill px-2 me-2 tag ${isTagOn(item, tag.key) ? 'checked' : ''}`}
-                                                        onClick={() => toggleTag(item, tag.key)}
+                                                        onClick={() => (tag.key === 'black' && !isTagOn(item, 'black') ? setBlackTarget(item) : toggleTag(item, tag.key))}
                                                     >{tag.label}</div>
                                                 ))}
                                             </div>
                                         </td>
+                                        <td style={{ textAlign: 'center' }}>
+                                            {/* ⚠️ v2.2.227: 個人情報削除（元に戻せない） */}
+                                            <button type="button" className="btn btn-outline-danger btn-sm" style={{ fontSize: '10px', padding: '0 6px' }}
+                                                onClick={() => void erasePrivacy(item)}>個人情報削除</button>
+                                        </td>
                                     </tr>);
                             })}
                         </tbody>
@@ -812,6 +862,16 @@ const ListKaeru = ({ onReload }: Props) => {
                     )}
                 </Modal.Body>
             </Modal>
+            {/* ⚠️ v2.2.227: ブラックリストに登録する理由（一番小さい sm。理由が空なら登録できない） */}
+            <BlackReasonModal
+                name={blackTarget ? `${blackTarget.first_name || ''}${blackTarget.last_name || ''}` : null}
+                onCancel={() => setBlackTarget(null)}
+                onSubmit={reason => {
+                    const target = blackTarget;
+                    setBlackTarget(null);
+                    if (target) void toggleTag(target, 'black', reason);
+                }}
+            />
         </>
     )
 }
```

#### frontend/src/components/list/ListResale.tsx
```diff
diff --git a/frontend/src/components/list/ListResale.tsx b/frontend/src/components/list/ListResale.tsx
index c6f95684..8e8df980 100644
--- a/frontend/src/components/list/ListResale.tsx
+++ b/frontend/src/components/list/ListResale.tsx
@@ -1,4 +1,4 @@
-import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
+import React, { useCallback, useEffect, useState, useContext, useMemo, useRef } from 'react';
 import { useLocation } from 'react-router-dom';
 import Table from "react-bootstrap/Table";
 import apiClient from '../../utils/apiClient';
@@ -11,6 +11,8 @@ import { setStyleClassUsed } from '../../utils/setStyleClassUsed';
 import { thisYear } from '../../utils/thisYear';
 import { useIsSp } from '../../utils/isSp';
 import { dateFormate, monthFormate, handleBlack, toHalfWidth, matchesBlackList, positions, previousMonthValue, currentMonthValue, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField } from './listUtils';
+import BlackReasonModal from './BlackReasonModal';
+import { confirmPrivacyErase, postPrivacyErase } from '../../utils/privacyErase';
 import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './listTags';
 import type { TagKey } from './listTags';
 import { hiraToKata } from '../../utils/nexusUtils';
@@ -86,6 +88,39 @@ const ListResale = ({ onReload }: Props) => {
     const loaderRef = useRef<HTMLDivElement>(null);
     const isSp = useIsSp();
 
+    const [reloading, setReloading] = useState(false);
+    /**
+     * 一覧のデータを読む（v2.2.227: 「再読み込み」ボタンからも呼ぶ）。
+     * ⚠️ 期間・店舗などの絞り込みはここでは変えない（初回の設定は下の useEffect）。
+     */
+    const loadList = useCallback(async () => {
+        try {
+            const response = await apiClient.post('', { request: 'list', category });
+            setCustomerList(response.data.summary);
+            const targetShop = categoryMapping[shopValue] === '買い:中古リノベ' ? '中古住宅専門店' : '不動産企画係';
+            const staffResponse = response.data.staff
+                .sort((a, b) => {
+                    const positionA = positions.indexOf(a.position) ?? 6;
+                    const positionB = positions.indexOf(b.position) ?? 6;
+                    return positionA - positionB
+                })
+                .filter((s: Staff) => s.shop  === targetShop)
+            setStaffList(staffResponse);
+            setMediumArray(response.data.medium.map((m: any) => m.medium));
+            setOriginalList(response.data.inquiry);
+            setOriginalBeforeList(response.data.survey || []);
+            setBlackList(response.data.black);
+        } catch (error) {
+            console.error("データ取得エラー:", error);
+        }
+    }, [category, shopValue]);
+
+    const reload = async () => {
+        setReloading(true);
+        await loadList();
+        setReloading(false);
+    };
+
     useEffect(() => {
         const now = new Date();
         const year = now.getFullYear();
@@ -104,30 +139,8 @@ const ListResale = ({ onReload }: Props) => {
         setEndMonth(currentMonthValue());
         setSelectedMonth([`${year}/${month}`]);
 
-        const fetchData = async () => {
-            try {
-                const response = await apiClient.post('', { request: 'list', category });
-                setCustomerList(response.data.summary);
-                const targetShop = categoryMapping[shopValue] === '買い:中古リノベ' ? '中古住宅専門店' : '不動産企画係';
-                const staffResponse = response.data.staff
-                    .sort((a, b) => {
-                        const positionA = positions.indexOf(a.position) ?? 6;
-                        const positionB = positions.indexOf(b.position) ?? 6;
-                        return positionA - positionB
-                    })
-                    .filter((s: Staff) => s.shop  === targetShop)
-                setStaffList(staffResponse);
-                setMediumArray(response.data.medium.map((m: any) => m.medium));
-                setOriginalList(response.data.inquiry);
-                setOriginalBeforeList(response.data.survey || []);
-                setBlackList(response.data.black);
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
-        };
-
-        fetchData();
-    }, [category, shopValue]);
+        void loadList();
+    }, [category, shopValue, loadList]);
 
     useEffect(() => {
         const startIndex = startMonth ? monthArray.indexOf(startMonth) : 0;
@@ -333,14 +346,36 @@ const ListResale = ({ onReload }: Props) => {
         }
     };
 
+    /**
+     * 個人情報削除（v2.2.227）。氏名・電話番号・メールアドレス・住所を ******** にして取込済み（sync = 1）にする。
+     * ⚠️ 元に戻せない（utils/privacyErase.ts・② の features/privacy.ts）
+     */
+    const erasePrivacy = async (item: InquiryCustomer) => {
+        const id = String(item.inquiry_id || '');
+        if (!confirmPrivacyErase(`${item.first_name || ''}${item.last_name || ''}`, '取込済みにします')) return;
+        try {
+            const d = await postPrivacyErase('inquiry', category, { inquiry_id: id });
+            const patch = (d.row ?? {}) as Partial<InquiryCustomer>;
+            setInquiryList(prev => prev.map(row => (String(row.inquiry_id) === id ? { ...row, ...patch } : row)));
+            onReload();
+        } catch (e) {
+            alert((e as Error).message);
+        }
+    };
+
+    /** ブラックリストの理由を入れているお客様（v2.2.227。⚠️ 外すときは出さない） */
+    const [blackTarget, setBlackTarget] = useState<InquiryCustomer | null>(null);
+
     /**
      * 顧客タグの ON / OFF。
      *
      * ⚠️ 旧実装は black_list に文字列を追記し、出現回数の偶奇で判定していた。
      *   「押すたびに反転」する仕様のため、通信が二重に走ると状態がずれた。
      *   次の値を明示して送ることで冪等にしている。
+     *
+     * ⚠️ v2.2.227: reason はブラックリストに登録するときの理由（BlackReasonModal で入れる）。
      */
-    const toggleTag = async (item: InquiryCustomer, tag: TagKey) => {
+    const toggleTag = async (item: InquiryCustomer, tag: TagKey, reason?: string) => {
         const nextValue = isTagOn(item, tag) ? 0 : 1;
         const field = TAG_FIELD[tag];
 
@@ -384,7 +419,8 @@ const ListResale = ({ onReload }: Props) => {
                 item.mail || '',
                 item.zip || '',
                 `${item.pref || ''}${item.city || ''}${item.town || ''}${item.street || ''}${item.building || ''}`,
-                category
+                category,
+                reason
             );
         }
 
@@ -551,6 +587,12 @@ const ListResale = ({ onReload }: Props) => {
 
                     <div className="bg-warning text-dark px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center" style={{ border: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                         onClick={() => setEditId('new')}>新規登録</div>
+                    {/* ⚠️ v2.2.227: データだけ読み直す（絞り込みはそのまま） */}
+                    <button type="button" className="bg-white text-primary px-2 py-1 rounded m-1 target d-flex justify-content-center align-items-center"
+                        style={{ border: '1px solid #0d6efd', cursor: reloading ? 'wait' : 'pointer', fontSize: '13px' }}
+                        onClick={() => void reload()} disabled={reloading}>
+                        <i className={`fa-solid fa-arrows-rotate me-1${reloading ? ' fa-spin' : ''}`} aria-hidden="true" />再読み込み
+                    </button>
 
                     {/* 💡 一括登録ボタン（チェックされている場合のみ表示） */}
                     {checkedIds.length > 0 && (
@@ -595,7 +637,8 @@ const ListResale = ({ onReload }: Props) => {
                                 )}
                             </tbody>
                         </Table>}
-                    <Table striped bordered hover style={{ width: isSp ? '1200px' : '1500px', fontSize: isSp ? "8px" : "12px" }}>
+                    {/* ⚠️ v2.2.227: PC の幅は列の幅の合計（顧客タグは ListOrder と同じ 400px・個人情報 110px）。合計より狭いと顧客タグのボタンが折れる */}
+                    <Table striped bordered hover style={{ width: isSp ? '1200px' : '1830px', fontSize: isSp ? "8px" : "12px" }}>
                         <thead className='sticky-header'>
                             <tr className='sticky-header align-middle'>
                                 {/* 💡 顧客取込列にチェックボックスと同期ボタンを統合 */}
@@ -609,7 +652,8 @@ const ListResale = ({ onReload }: Props) => {
                                 <td style={{ width: '200px' }}>連絡先</td>
                                 <td style={{ width: '130px' }}>物件名</td>
                                 <td style={{ width: '120px' }}>希望エリア</td>
-                                <td style={{ width: '500px' }}>顧客タグ</td>
+                                <td style={{ width: '400px' }}>顧客タグ</td>
+                                <td style={{ width: '110px', textAlign: 'center' }}>個人情報</td>
                             </tr>
                         </thead>
                         <tbody>
@@ -678,16 +722,21 @@ const ListResale = ({ onReload }: Props) => {
                                         <td>{item.property || ''}</td>
                                         <td>{item.area || ''}</td>
                                         <td>
-                                            <div className='d-flex'>
+                                            <div className='d-flex' style={{ whiteSpace: 'nowrap' }}>
                                                 {TAG_DEFINITIONS.map(tag => (
                                                     <div
                                                         key={tag.key}
                                                         className={`${tag.className} text-white rounded-pill px-2 me-2 tag ${isTagOn(item, tag.key) ? 'checked' : ''}`}
-                                                        onClick={() => toggleTag(item, tag.key)}
+                                                        onClick={() => (tag.key === 'black' && !isTagOn(item, 'black') ? setBlackTarget(item) : toggleTag(item, tag.key))}
                                                     >{tag.label}</div>
                                                 ))}
                                             </div>
                                         </td>
+                                        <td style={{ textAlign: 'center' }}>
+                                            {/* ⚠️ v2.2.227: 個人情報削除（元に戻せない） */}
+                                            <button type="button" className="btn btn-outline-danger btn-sm" style={{ fontSize: '10px', padding: '0 6px' }}
+                                                onClick={() => void erasePrivacy(item)}>個人情報削除</button>
+                                        </td>
                                     </tr>);
                             })}
                         </tbody>
@@ -707,6 +756,16 @@ const ListResale = ({ onReload }: Props) => {
                     )}
                 </Modal.Body>
             </Modal>
+            {/* ⚠️ v2.2.227: ブラックリストに登録する理由（一番小さい sm。理由が空なら登録できない） */}
+            <BlackReasonModal
+                name={blackTarget ? `${blackTarget.first_name || ''}${blackTarget.last_name || ''}` : null}
+                onCancel={() => setBlackTarget(null)}
+                onSubmit={reason => {
+                    const target = blackTarget;
+                    setBlackTarget(null);
+                    if (target) void toggleTag(target, 'black', reason);
+                }}
+            />
         </>
     )
 }
```

#### frontend/src/components/information/InformationEditKaeru.tsx
```diff
diff --git a/frontend/src/components/information/InformationEditKaeru.tsx b/frontend/src/components/information/InformationEditKaeru.tsx
index b51709a7..368053d6 100644
--- a/frontend/src/components/information/InformationEditKaeru.tsx
+++ b/frontend/src/components/information/InformationEditKaeru.tsx
@@ -30,6 +30,7 @@ import { calculateAge } from '../../utils/informationUtils';
 import { dateFormate } from '../../utils/informationUtils';
 import { useIsSp } from '../../utils/isSp';
 import apiClient from '../../utils/apiClient';
+import { confirmPrivacyErase, postPrivacyErase } from '../../utils/privacyErase';
 import { uploadCompetitorPdf } from '../../utils/competitorPdfUpload';
 import type { CompetitorPdfItem } from '../../utils/competitorPdfUpload';
 
@@ -611,6 +612,23 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
         style: expandStyle(key),
         onClickCapture: openOnClickCapture(expand[key], () => setExpand(prev => ({ ...prev, [key]: true })))
     });
+    /**
+     * 個人情報削除（v2.2.227）。氏名・電話番号・メールアドレス・住所を ******** にして、顧客DBの一覧から外す（show_dashboard = 0）。
+     * ⚠️ 元に戻せない。⚠️ 入力中で保存していない内容は保存せずに閉じる
+     */
+    const erasePersonalInfo = async () => {
+        if (!id || id === 'new') return;
+        if (!confirmPrivacyErase(String(information.customer_contacts_name ?? ''), '顧客DBの一覧から外します')) return;
+        try {
+            await postPrivacyErase('master', category, { id });
+            alert('個人情報を削除しました。');
+            modalClose();
+            handleClose();
+        } catch (e) {
+            alert((e as Error).message);
+        }
+    };
+
     const handleClose = () => {
         setInterviewLog({
             id: '',
@@ -772,7 +790,17 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
                     handleClose();
                 }}
             >
-                <Modal.Header closeButton><div style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }}>{id === 'new' ? <div>新規顧客登録 <span className='text-danger'>※は入力必須</span></div> : `${information.in_charge_store ?? ''} ${information.customer_contacts_name ?? ''}様`}</div></Modal.Header>
+                <Modal.Header closeButton>
+                    <div style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }}>{id === 'new' ? <div>新規顧客登録 <span className='text-danger'>※は入力必須</span></div> : `${information.in_charge_store ?? ''} ${information.customer_contacts_name ?? ''}様`}</div>
+                    {/* ⚠️ v2.2.227: 個人情報削除（元に戻せない。utils/privacyErase.ts） */}
+                    {id !== 'new' && (
+                        <button type="button" className="btn btn-outline-danger btn-sm ms-3" style={{ fontSize: '11px', padding: '1px 10px' }}
+                            disabled={!information.id} title={information.id ? undefined : '読み込み中'}
+                            onClick={() => void erasePersonalInfo()}>
+                            <i className="fa-solid fa-user-slash me-1" aria-hidden="true" />個人情報削除
+                        </button>
+                    )}
+                </Modal.Header>
                 <Modal.Body>
                     <div style={{ height: '78vh', overflowY: 'scroll', overflowX: 'scroll', zoom: isSp ? 0.35 : 1 }}>
                         <div style={{ minWidth: '1000px' }}>
```

#### frontend/src/components/information/InformationEditResale.tsx
```diff
diff --git a/frontend/src/components/information/InformationEditResale.tsx b/frontend/src/components/information/InformationEditResale.tsx
index daf6e2d1..bc84e4a8 100644
--- a/frontend/src/components/information/InformationEditResale.tsx
+++ b/frontend/src/components/information/InformationEditResale.tsx
@@ -19,6 +19,7 @@ import { calculateAge } from '../../utils/informationUtils';
 import { dateFormate } from '../../utils/informationUtils';
 import { useIsSp } from '../../utils/isSp';
 import apiClient from '../../utils/apiClient';
+import { confirmPrivacyErase, postPrivacyErase } from '../../utils/privacyErase';
 import { uploadCompetitorPdf } from '../../utils/competitorPdfUpload';
 import type { CompetitorPdfItem } from '../../utils/competitorPdfUpload';
 import PropertyRegister from '../database/PropertyRegister';
@@ -625,6 +626,23 @@ const InformationEditResale = ({ id, token, onClose, authority }: Props) => {
         onClickCapture: openOnClickCapture(expand[key], () => setExpand(prev => ({ ...prev, [key]: true })))
     });
 
+    /**
+     * 個人情報削除（v2.2.227）。氏名・電話番号・メールアドレス・住所を ******** にして、顧客DBの一覧から外す（show_dashboard = 0）。
+     * ⚠️ 元に戻せない。⚠️ 入力中で保存していない内容は保存せずに閉じる
+     */
+    const erasePersonalInfo = async () => {
+        if (!id || id === 'new') return;
+        if (!confirmPrivacyErase(String(information.customer_contacts_name ?? ''), '顧客DBの一覧から外します')) return;
+        try {
+            await postPrivacyErase('master', category, { id });
+            alert('個人情報を削除しました。');
+            modalClose();
+            handleClose();
+        } catch (e) {
+            alert((e as Error).message);
+        }
+    };
+
     const handleClose = () => {
         setInterviewLog({
             id: '',
@@ -812,7 +830,17 @@ const InformationEditResale = ({ id, token, onClose, authority }: Props) => {
                     handleClose();
                 }}
             >
-                <Modal.Header closeButton><div style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }}>{id === 'new' ? <div>新規顧客登録 <span className='text-danger'>※は入力必須</span></div> : `${information.in_charge_store ?? ''} ${information.customer_contacts_name ?? ''}様`}</div></Modal.Header>
+                <Modal.Header closeButton>
+                    <div style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }}>{id === 'new' ? <div>新規顧客登録 <span className='text-danger'>※は入力必須</span></div> : `${information.in_charge_store ?? ''} ${information.customer_contacts_name ?? ''}様`}</div>
+                    {/* ⚠️ v2.2.227: 個人情報削除（元に戻せない。utils/privacyErase.ts） */}
+                    {id !== 'new' && (
+                        <button type="button" className="btn btn-outline-danger btn-sm ms-3" style={{ fontSize: '11px', padding: '1px 10px' }}
+                            disabled={!information.id} title={information.id ? undefined : '読み込み中'}
+                            onClick={() => void erasePersonalInfo()}>
+                            <i className="fa-solid fa-user-slash me-1" aria-hidden="true" />個人情報削除
+                        </button>
+                    )}
+                </Modal.Header>
                 <Modal.Body>
                     <div style={{ height: '78vh', overflowY: 'scroll', overflowX: 'scroll', zoom: isSp ? 0.35 : 1 }}>
                         <div style={{ minWidth: '1000px' }}>
```

#### frontend/src/components/Category.tsx
```diff
diff --git a/frontend/src/components/Category.tsx b/frontend/src/components/Category.tsx
index 9628f962..ada01747 100644
--- a/frontend/src/components/Category.tsx
+++ b/frontend/src/components/Category.tsx
@@ -7,6 +7,7 @@ import Table from "react-bootstrap/Table";
 import { useIsSp } from '../utils/isSp';
 import { markCategoryChosen } from './DailyAction';
 import { openGuide } from './guide/openGuide';
+import { canEnterCategory } from '../utils/shopAccess';
 
 type Log = { no: number, version: string, date: string, note: string };
 
@@ -29,7 +30,8 @@ const Category = () => {
     }, []);
 
     const goToDashboard = async (categoryValue: string) => {
-        if (shopValue !== 'all' && shopValue !== categoryValue) {
+        // ⚠️ v2.2.227: estate（建売・中古・不動産企画係）も見る（utils/shopAccess.ts）
+        if (!canEnterCategory(shopValue, categoryValue)) {
             alert('閲覧権限がありません');
             return;
         }
@@ -77,7 +79,7 @@ const Category = () => {
                   ⚠️ v2.2.194: 業務ガイド（⚠️ 4つのボタンの下・指示）。⚠️ 別ウインドウで開く（guide/openGuide.ts）。
                     ⚠️ この画面ではまだ事業を選んでいないので、⚠️ **担当事業（shopValue）が注文営業・建売営業・中古リノベ・全事業の人にだけ**出す。
                 */}
-                {['order', 'spec', 'used', 'all'].includes(shopValue) && (
+                {['order', 'spec', 'used', 'estate', 'all'].includes(shopValue) && (
                     <div className="text-center mt-2">
                         <button type="button" onClick={() => openGuide()}
                             style={{ background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', borderRadius: 999,
```

#### frontend/src/components/Menu.tsx
```diff
diff --git a/frontend/src/components/Menu.tsx b/frontend/src/components/Menu.tsx
index f6161af5..c8156d74 100644
--- a/frontend/src/components/Menu.tsx
+++ b/frontend/src/components/Menu.tsx
@@ -283,7 +283,8 @@ const Menu = ({ key, onReload }: Props) => {
 
     return (
         <>
-            <div className="d-md-flex flex-column p-2" style={{ height: '100vh', borderRight: '1px solid #D3D3D3', overflowY: 'auto' }}>
+            {/* ⚠️ v2.2.227: 高さは枠（PC は index.css の .modal_menu＝画面に固定、スマホは .modal_menu_sp＝100vh）いっぱい。はみ出た分はここでスクロール */}
+            <div className="d-md-flex flex-column p-2" style={{ height: '100%', borderRight: '1px solid #D3D3D3', overflowY: 'auto' }}>
                 <div className="menuLogo m-3 position-relative" style={{ cursor: 'pointer' }} onClick={() => handleNavigate("/home")}>
                     <img src={Logo} alt="PG-CLOUDダッシュボード" className="w-100" />
                     <div style={{ fontSize: '10px', bottom: '-10px', right: '0' }} className="position-absolute">
```

#### frontend/src/components/header/EditAuth.tsx
```diff
diff --git a/frontend/src/components/header/EditAuth.tsx b/frontend/src/components/header/EditAuth.tsx
index 9c428428..19b481d7 100644
--- a/frontend/src/components/header/EditAuth.tsx
+++ b/frontend/src/components/header/EditAuth.tsx
@@ -68,6 +68,8 @@ const SHOP_OPTIONS = [
     { value: 'used', label: '中古' },
     // ⚠️ v2.2.221: 不動産企画係だけを見る人（入れるのは不動産企画係の画面だけ）
     { value: 'realty', label: '不動産企画係' },
+    // ⚠️ v2.2.227: 建売・中古・不動産企画係の3つに入れる人（utils/shopAccess.ts）
+    { value: 'estate', label: '建売・中古・不動産企画係' },
     { value: 'all', label: '全事業' },
 ] as const;
```

#### frontend/src/components/header/DailyReports.tsx
```diff
diff --git a/frontend/src/components/header/DailyReports.tsx b/frontend/src/components/header/DailyReports.tsx
index 6343299a..a6f887fc 100644
--- a/frontend/src/components/header/DailyReports.tsx
+++ b/frontend/src/components/header/DailyReports.tsx
@@ -151,9 +151,14 @@ const parseLogs = (json: string | null): ActionLog[] => {
 const authorityMapping: Record<string, string> = {
     'order': '注文事業',
     'spec': '建売分譲事業',
-    'used': '中古リノベ'
+    'used': '中古リノベ',
+    // ⚠️ v2.2.227: estate（建売・中古・不動産企画係）は建売の人として扱う（日報は建売の分）
+    'estate': '建売分譲事業',
 };
 
+/** 日報の書き手（authority）と突き合わせる担当事業。⚠️ estate は建売（spec）として見る */
+const reportShopOf = (shopName: string): string => (shopName === 'estate' ? 'spec' : shopName);
+
 const positions = ['常務', '部長', '課長', '課長代理', '店長', '店長代理', '一般'];
 
 // 💡 共通の空メトリクス生成関数（集計用と総数計算用で使い回すため外出し）
@@ -250,7 +255,7 @@ const DailyReports = ({ onOpenCompetitorReports }: Props) => {
                 if (response.data) {
                     // ⚠️ shop はサーバーで読み替え済み
                     setResponseList((response.data.response || [])
-                        .filter((r: ResponseInfo) => (!shopName || shopName === 'all') ? true : r.authority === shopName));
+                        .filter((r: ResponseInfo) => (!shopName || shopName === 'all') ? true : r.authority === reportShopOf(shopName)));
                     setCallList(response.data.call || []);
                     setInterviewList(response.data.interview || []);
```

#### frontend/src/components/guide/openGuide.ts
```diff
diff --git a/frontend/src/components/guide/openGuide.ts b/frontend/src/components/guide/openGuide.ts
index cc6343fc..13ec4c2b 100644
--- a/frontend/src/components/guide/openGuide.ts
+++ b/frontend/src/components/guide/openGuide.ts
@@ -11,6 +11,7 @@
  * ⚠️ スマホ（幅 768px 未満）は別ウインドウが扱いにくいので、同じタブで移動する。
  * ─────────────────────────────────────────────
  */
+import { canEnterCategory } from '../../utils/shopAccess';
 
 export const GUIDE_WINDOW = 'khg-business-guide';
 
@@ -30,12 +31,12 @@ export const GUIDE_COMMON = 'common';
 export const isGuideCategory = (category: string): boolean => GUIDE_DIVISIONS.some((d) => d.value === category);
 
 /**
- * 見られる事業。⚠️ shopName は担当事業（order / spec / used / all）。
+ * 見られる事業。⚠️ shopName は担当事業（order / spec / used / estate / all）。
  * ⚠️ Master と全事業（all）の人はすべて。⚠️ 選んでいる事業（category）も足す（⚠️ 事業の権限はトップ画面が確かめている）。
  */
 export const allowedGuideDivisions = (authority: string, category: string, shopName: string): string[] =>
     GUIDE_DIVISIONS.map((d) => d.value as string).filter((v) =>
-        authority === 'Master' || shopName === 'all' || shopName === v || category === v);
+        authority === 'Master' || canEnterCategory(shopName, v) || category === v);
 
 /** ⚠️ Router の basename（App.tsx の `/dashboard`）を含めた URL */
 const guideUrl = (title?: string): string =>
```

#### frontend/src/components/guide/guideScreens.ts
```diff
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 0370ffe6..f666e0ff 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -21,6 +21,7 @@
  */
 
 import { GUIDE_WINDOW } from './openGuide';
+import { canEnterCategory } from '../../utils/shopAccess';
 
 export type GuideDivision = 'order' | 'spec' | 'used';
 
@@ -173,7 +174,7 @@ export type ScreenPlan =
  * どの事業で・どのページを開くかを決める（⚠️ ダッシュボードの窓で呼ぶ）。
  * @param articleDivision 記事の事業（⚠️ 全事業共通の記事は null。そのときはいま選んでいる事業を優先）
  * @param category ダッシュボードで選んでいる事業
- * @param shopName 担当事業（order / spec / used / all）。⚠️ 切り替えてよいかの判定は Category.tsx の goToDashboard と同じ
+ * @param shopName 担当事業（order / spec / used / estate / all）。⚠️ 切り替えてよいかの判定は Category.tsx の goToDashboard と同じ（utils/shopAccess.ts）
  */
 export const planScreen = (name: string, articleDivision: string | null, category: string, shopName: string): ScreenPlan => {
     const screen = GUIDE_SCREENS[name];
@@ -186,7 +187,7 @@ export const planScreen = (name: string, articleDivision: string | null, categor
         else division = divisions[0];
     }
     const switching = division !== null && division !== category;
-    if (switching && shopName !== 'all' && shopName !== division) {
+    if (switching && !canEnterCategory(shopName, division as string)) {
         return { ok: false, message: `「${name}」は${DIVISION_LABEL[division as GuideDivision]}の画面です。担当の事業ではないため開けません。` };
     }
     let path: string | null = null;
```

#### frontend/src/components/realty/RealtyRoute.tsx
```diff
diff --git a/frontend/src/components/realty/RealtyRoute.tsx b/frontend/src/components/realty/RealtyRoute.tsx
index 76cfe27a..51893aeb 100644
--- a/frontend/src/components/realty/RealtyRoute.tsx
+++ b/frontend/src/components/realty/RealtyRoute.tsx
@@ -5,11 +5,11 @@ import AuthContext from '../../context/AuthContext';
 /**
  * 不動産企画係（category = realty）の画面の入口（v2.2.221）。
  *
- * ⚠️ 担当事業（staff.shop）が `realty`（不動産企画係）か `all`（全事業）の人だけが入れる。
+ * ⚠️ 担当事業（staff.shop）が `realty`（不動産企画係）・`estate`（建売・中古・不動産企画係。v2.2.227）・`all`（全事業）の人だけが入れる。
  *   それ以外の人が URL を直接開いたら、事業を選ぶ画面へ戻す。
  * ⚠️ これは見た目の入口。データの読み書きは ② / ① が同じ条件で確かめている（REALTY_SHOPS）。
  */
-export const REALTY_SHOPS = ['realty', 'all'];
+export const REALTY_SHOPS = ['realty', 'estate', 'all'];
 
 const RealtyRoute = ({ children }: { children: React.ReactElement }) => {
     const { shopName } = useContext(AuthContext);
```

#### frontend/src/index.css
```diff
diff --git a/frontend/src/index.css b/frontend/src/index.css
index 007b7838..92233ffd 100644
--- a/frontend/src/index.css
+++ b/frontend/src/index.css
@@ -171,6 +171,13 @@ textarea::placeholder {
 .modal_menu {
   width: 20%;
   max-width: 200px;
+  /* v2.2.227: メニューは画面に固定し、右側のスクロールと一緒に動かさない。はみ出た分はメニューの中でスクロール（components/Menu.tsx）
+     ⚠️ fixed にすると右側が幅のぶんずれるため sticky。上はヘッダーの高さ（Header.tsx が --header-h に入れる。App.tsx の paddingTop と同じ） */
+  position: sticky;
+  top: calc(var(--header-h, 30px) + 6px);
+  height: calc(100vh - var(--header-h, 30px) - 6px);
+  align-self: flex-start;
+  flex-shrink: 0;
 }
 
 @media screen and (min-width: 769px) {
```

#### frontend/public/index.html
```diff
diff --git a/frontend/public/index.html b/frontend/public/index.html
index 87fe3416..b5bcde5b 100644
--- a/frontend/public/index.html
+++ b/frontend/public/index.html
@@ -14,7 +14,12 @@
       href="https://use.fontawesome.com/releases/v6.2.0/css/all.css"
       rel="stylesheet"
     />
-    <link rel="icon" href="./favicon.png" />
+    <!-- v2.2.227: アイコンを差し替え（favicon.ico と各サイズの PNG・apple-touch-icon） -->
+    <link rel="icon" href="./favicon.ico" sizes="any" />
+    <link rel="icon" type="image/png" sizes="16x16" href="./favicon-16x16.png" />
+    <link rel="icon" type="image/png" sizes="32x32" href="./favicon-32x32.png" />
+    <link rel="icon" type="image/png" sizes="48x48" href="./favicon-48x48.png" />
+    <link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png" />
     <title>Dashboard|PG-CLOUD</title>
   </head>
   <body>
```

#### frontend/public/manifest.json
```diff
diff --git a/frontend/public/manifest.json b/frontend/public/manifest.json
index 26656b21..d1ca23a5 100644
--- a/frontend/public/manifest.json
+++ b/frontend/public/manifest.json
@@ -3,12 +3,12 @@
   "name": "Dashboard System",
   "icons": [
     {
-      "src": "logo192.png",
+      "src": "android-chrome-192x192.png",
       "type": "image/png",
       "sizes": "192x192"
     },
     {
-      "src": "logo512.png",
+      "src": "android-chrome-512x512.png",
       "type": "image/png",
       "sizes": "512x512"
     }
```

#### frontend/src/utils/version.ts
```diff
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index bb0edd87..62211931 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.226';
+export const newVersion = '2.2.227';
```

#### backend/scripts/guide/articles/order/screen-010.md
```diff
diff --git a/backend/scripts/guide/articles/order/screen-010.md b/backend/scripts/guide/articles/order/screen-010.md
index 879ff5e6..d13d7a00 100644
--- a/backend/scripts/guide/articles/order/screen-010.md
+++ b/backend/scripts/guide/articles/order/screen-010.md
@@ -22,7 +22,7 @@ summary: 届いた反響の確認・割り振り・取込をする画面。
 
 ## 列の見方
 - **重複**：氏名・携帯・メールのうち2つ以上が同じ、別の反響があると表示されます
-- **顧客タグ**：重複／ギフト券進呈済み／業者／ブラックリスト
+- **顧客タグ**：重複／ギフト券進呈済み／業者／ブラックリスト（ブラックリストは理由を入れて登録。下の「ブラックリストに登録する」）
 - **流入**（反響媒体の下の青い札）：ホームページの反響で、広告などから来た情報があるときに出ます。札には流入元（Google など）が出ます。押すと、顧客IDと、その人がいつ・どの広告からサイトに来たかが見られます
   - 灰色の「流入：ID」は、広告の情報が無く顧客IDだけがあるもの（自然検索・直接の訪問など）です
 
@@ -35,5 +35,21 @@ summary: 届いた反響の確認・割り振り・取込をする画面。
 
 > 注意：ひらがなのフリガナは、取込のときにカタカナへ自動で直ります。
 
+## 再読み込み
+上の「🔄 再読み込み」を押すと、絞り込み（期間・店舗・氏名など）はそのままで、新しく届いた反響を読み直します。
+
+## ブラックリストに登録する
+顧客タグの「ブラックリスト」を押すと、小さな画面が開きます。**理由**を入れて「登録」を押すと登録されます。
+- 理由が空のままでは登録できません
+- 理由は、ヘッダーの「ブラックリスト編集」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
+- 外すとき（もう一度押す）は、理由の画面は出ません
+
+## 個人情報削除
+いちばん右の「個人情報削除」を押すと、その反響の**氏名・ふりがな・電話番号・メールアドレス・住所（郵便番号を含む）**を「********」に置き換え、**取込済み**にします。
+
+> 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。
+
+> 要確認：個人情報を消してよいか（お客様からの削除の依頼など）は、社内のルールに従ってください。
+
 ## 関係する記事
 - [[反響が来たら]]
```

#### backend/scripts/guide/articles/spec/screen-010.md
```diff
diff --git a/backend/scripts/guide/articles/spec/screen-010.md b/backend/scripts/guide/articles/spec/screen-010.md
index 02b9ce73..a438f462 100644
--- a/backend/scripts/guide/articles/spec/screen-010.md
+++ b/backend/scripts/guide/articles/spec/screen-010.md
@@ -18,5 +18,21 @@ summary: 届いた反響の確認・割り振り・取込。
 - **物件名**：問い合わせのあった物件
 - **希望エリア**
 
+## 再読み込み
+上の「🔄 再読み込み」を押すと、絞り込み（期間・店舗・氏名など）はそのままで、新しく届いた反響を読み直します。
+
+## ブラックリストに登録する
+顧客タグの「ブラックリスト」を押すと、小さな画面が開きます。**理由**を入れて「登録」を押すと登録されます。
+- 理由が空のままでは登録できません
+- 理由は、ヘッダーの「ブラックリスト編集」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
+- 外すとき（もう一度押す）は、理由の画面は出ません
+
+## 個人情報削除
+いちばん右の「個人情報削除」を押すと、その反響の**氏名・ふりがな・電話番号・メールアドレス・住所（郵便番号を含む）**を「********」に置き換え、**取込済み**にします。
+
+> 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。
+
+> 要確認：個人情報を消してよいか（お客様からの削除の依頼など）は、社内のルールに従ってください。
+
 ## 関係する記事
 - [[反響が来たら（建売営業）]]
```

#### backend/scripts/guide/articles/used/screen-010.md
```diff
diff --git a/backend/scripts/guide/articles/used/screen-010.md b/backend/scripts/guide/articles/used/screen-010.md
index 1cbec92d..898991dc 100644
--- a/backend/scripts/guide/articles/used/screen-010.md
+++ b/backend/scripts/guide/articles/used/screen-010.md
@@ -11,5 +11,21 @@ summary: 届いた反響の確認・取込（中古リノベ）。
 - 「店舗」の代わりに**カテゴリー**（[[取引区分（中古リノベ）]]）の列があります
 - 上の集計は「中専全体」と「カテゴリーごと」に、反響合計・反響目標・来場合計・来場目標
 
+## 再読み込み
+上の「🔄 再読み込み」を押すと、絞り込み（期間・店舗・氏名など）はそのままで、新しく届いた反響を読み直します。
+
+## ブラックリストに登録する
+顧客タグの「ブラックリスト」を押すと、小さな画面が開きます。**理由**を入れて「登録」を押すと登録されます。
+- 理由が空のままでは登録できません
+- 理由は、ヘッダーの「ブラックリスト編集」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
+- 外すとき（もう一度押す）は、理由の画面は出ません
+
+## 個人情報削除
+いちばん右の「個人情報削除」を押すと、その反響の**氏名・ふりがな・電話番号・メールアドレス・住所（郵便番号を含む）**を「********」に置き換え、**取込済み**にします。
+
+> 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。
+
+> 要確認：個人情報を消してよいか（お客様からの削除の依頼など）は、社内のルールに従ってください。
+
 ## 関係する記事
 - [[反響が来たら（中古リノベ）]]
```

#### backend/scripts/guide/articles/spec/screen-020.md
```diff
diff --git a/backend/scripts/guide/articles/spec/screen-020.md b/backend/scripts/guide/articles/spec/screen-020.md
index f40a0f17..ffaa2c80 100644
--- a/backend/scripts/guide/articles/spec/screen-020.md
+++ b/backend/scripts/guide/articles/spec/screen-020.md
@@ -33,3 +33,11 @@ summary: お客様の検索と、商談ステップ・ステータス・ラン
 > 注意：反響一覧で取り込む前に結びついた反響は、取り込むと顧客にも引き継がれます。取り込んだあとに結びついた場合も、自動で顧客に書き込みます。
 
 > 要確認：お客様に閲覧履歴の話をそのまま伝えるかどうかは、社内のルールに従ってください。
+
+## 個人情報削除
+顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBの一覧から外します。
+- 誰がいつ消したかは、そのお客様の変更履歴に残ります（消した値は残りません）
+
+> 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。
+
+> 要確認：個人情報を消してよいか（お客様からの削除の依頼など）は、社内のルールに従ってください。
```

#### backend/scripts/guide/articles/used/screen-020.md
```diff
diff --git a/backend/scripts/guide/articles/used/screen-020.md b/backend/scripts/guide/articles/used/screen-020.md
index 0798292b..a29eb5fc 100644
--- a/backend/scripts/guide/articles/used/screen-020.md
+++ b/backend/scripts/guide/articles/used/screen-020.md
@@ -19,3 +19,11 @@ summary: お客様の検索と編集（中古リノベ）。
 - 左の **編集** を押すか、薄くなっている部分を押すと開きます。閉じるときは **×閉じる**
 
 > 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。
+
+## 個人情報削除
+顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBの一覧から外します。
+- 誰がいつ消したかは、そのお客様の変更履歴に残ります（消した値は残りません）
+
+> 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。
+
+> 要確認：個人情報を消してよいか（お客様からの削除の依頼など）は、社内のルールに従ってください。
```

#### backend/scripts/guide/articles/common/screen-230.md
```diff
diff --git a/backend/scripts/guide/articles/common/screen-230.md b/backend/scripts/guide/articles/common/screen-230.md
index 7516f962..d6065a29 100644
--- a/backend/scripts/guide/articles/common/screen-230.md
+++ b/backend/scripts/guide/articles/common/screen-230.md
@@ -17,6 +17,7 @@ summary: 不動産企画係の画面に入れる人と、入り方。
 
 ## 入れる人
 - 担当事業が「**不動産企画係**」の人
+- 担当事業が「**建売・中古・不動産企画係**」の人（建売営業・中古リノベにも入れます）
 - 担当事業が「**全事業**」の人
 
 ほかの担当事業（注文・建売・中古）の人は入れません。画面のアドレスを直接開いても、事業を選ぶ画面に戻ります。
@@ -29,7 +30,9 @@ summary: 不動産企画係の画面に入れる人と、入り方。
 3. チームサマリーが開く。左のメニューから各画面へ移る
 
 ## 担当事業を「不動産企画係」にする
-ヘッダーの「システム管理 → 権限編集」で、その人の担当事業を「不動産企画係」に変えます（変えられるのは管理者だけです）。
+ヘッダーの「システム管理 → 権限編集」で、その人の担当事業を「不動産企画係」か「建売・中古・不動産企画係」に変えます（変えられるのは管理者だけです）。
+
+> 注意：v2.2.227 の更新で、建売営業の人と、以前の不動産企画係アプリを使っていた人の担当事業を「建売・中古・不動産企画係」にまとめました。
 
 > 注意：変えたあと、本人が次に画面を移ったときに反映されます。ログインし直す必要はありません。
```

## 追記（同日）: 注文の顧客DB（InformationEdit）にも個人情報削除（同じ v2.2.227。マージ前のため）
### 依頼
- 「InformationEdit に個人情報削除ボタンがない」→「order にも実装して」。伏せる項目を広げるのは次の版で

### 決めたこと・作ったもの
- InformationEdit.tsx のヘッダーに建売・中古と同じボタン（読み込みが終わるまで押せない）
- ② の privacy_erase:master に order（master_data）を追加。① の許可リスト2か所に privacy_erase:master:order
- 記事「顧客DB」（注文）に個人情報削除の節。更新履歴の文を「顧客DB（注文・建売・中古）」に

### 確認したこと
- ① を通して ② まで届くか（トークン無しで 401）: privacy_erase:master:order
- 画面（Playwright。開発サーバーは 3100）: テスト用の注文の顧客で、確認（名前つき）→ 知らせ → 閉じる。DB は5列が ********・show_dashboard = 0、変更履歴に source = privacy_erase。ページのエラー 0。テストのデータは消した
- ② の型チェック

### 差分

#### frontend/src/components/information/InformationEdit.tsx
```diff
diff --git a/frontend/src/components/information/InformationEdit.tsx b/frontend/src/components/information/InformationEdit.tsx
index f61b8f6c..0c2bf70c 100644
--- a/frontend/src/components/information/InformationEdit.tsx
+++ b/frontend/src/components/information/InformationEdit.tsx
@@ -30,6 +30,7 @@ import FundingPlan from './FundingPlan';
 import CustomerPageviews from './CustomerPageviews';
 import { useIsSp } from '../../utils/isSp';
 import apiClient from '../../utils/apiClient';
+import { confirmPrivacyErase, postPrivacyErase } from '../../utils/privacyErase';
 import NexusBadge, { NEXUS_HEADER_LABEL } from '../NexusBadge';
 import { isNexus, nexusNameMessages, nexusRankMessage } from '../../utils/nexusUtils';
 import { uploadCompetitorPdf } from '../../utils/competitorPdfUpload';
@@ -674,6 +675,23 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
         onClickCapture: openOnClickCapture(expand[key], () => setExpand(prev => ({ ...prev, [key]: true })))
     });
 
+    /**
+     * 個人情報削除（v2.2.227）。氏名・電話番号・メールアドレス・住所を ******** にして、顧客DBの一覧から外す（show_dashboard = 0）。
+     * ⚠️ 元に戻せない。⚠️ 入力中で保存していない内容は保存せずに閉じる
+     */
+    const erasePersonalInfo = async () => {
+        if (!id || id === 'new') return;
+        if (!confirmPrivacyErase(String(information.customer_contacts_name ?? ''), '顧客DBの一覧から外します')) return;
+        try {
+            await postPrivacyErase('master', category, { id });
+            alert('個人情報を削除しました。');
+            modalClose();
+            handleClose();
+        } catch (e) {
+            alert((e as Error).message);
+        }
+    };
+
     const handleClose = () => {
         setInterviewLog({
             id: '',
@@ -858,6 +876,14 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                     {id !== 'new' && isNexus(information) && <NexusBadge className='me-1' label={NEXUS_HEADER_LABEL} />}
                     {id === 'new' ? <div>新規顧客登録 </div> : `${information.in_charge_store ?? ''} ${information.customer_contacts_name ?? ''}様`}</div>
                     <div style={{ background: 'rgb(233, 233, 233)', fontSize: '11px' }} className='ms-1 fw-bold p-1 rounded'>※着色部分は特典進呈申請の際の必須項目</div>
+                    {/* ⚠️ v2.2.227: 個人情報削除（元に戻せない。utils/privacyErase.ts） */}
+                    {id !== 'new' && (
+                        <button type="button" className="btn btn-outline-danger btn-sm ms-3" style={{ fontSize: '11px', padding: '1px 10px' }}
+                            disabled={!information.id} title={information.id ? undefined : '読み込み中'}
+                            onClick={() => void erasePersonalInfo()}>
+                            <i className="fa-solid fa-user-slash me-1" aria-hidden="true" />個人情報削除
+                        </button>
+                    )}
                 </Modal.Header>
                 <Modal.Body>
                     <div style={{ height: '78vh', overflowY: 'scroll', overflowX: 'scroll', zoom: isSp ? 0.35 : 1 }}>
```

#### backend-express/src/features/privacy.ts
```diff
diff --git a/backend-express/src/features/privacy.ts b/backend-express/src/features/privacy.ts
index d1387f06..eeb22e7d 100644
--- a/backend-express/src/features/privacy.ts
+++ b/backend-express/src/features/privacy.ts
@@ -8,10 +8,11 @@ import { logger } from '../utils/logger';
  *
  * ─────────────────────────────────────────────
  * 2026-10-29 の指示:
- *   ・顧客DB（InformationEditKaeru / InformationEditResale のヘッダー）… 氏名・電話番号・メールアドレス・住所を
+ *   ・顧客DB（InformationEdit / InformationEditKaeru / InformationEditResale のヘッダー）… 氏名・電話番号・メールアドレス・住所を
  *     アスタリスク8個にして show_dashboard = 0（privacy_erase:master）
  *   ・反響一覧（ListOrder / ListKaeru / ListResale の各行）… 同じ列をアスタリスクにして sync = 1（privacy_erase:inquiry）
  *   ・対象の列は「同じ種類の列も含める」（ふりがな・2人目の氏名・固定電話・郵便番号も）。押せるのはその画面を使える全員
+ *   ・2026-10-29 追加: 注文の顧客DB（InformationEdit・master_data）にも
  *
  * ⚠️⚠️ **元に戻せない。** 画面は「元に戻せません」の確認を出してから送る。
  * ⚠️ 値が入っている列だけ伏せる（空の列に入れると、2人目の氏名などが居るように見えるため）。
@@ -32,8 +33,9 @@ export interface PrivacyResult {
 
 const MASK = '********';
 
-/** 顧客DB（事業区分 → 表）。⚠️ 指示は建売・中古だけ */
+/** 顧客DB（事業区分 → 表） */
 const MASTER_TABLES: Record<string, string> = {
+  order: 'master_data',
   spec: 'master_data_kaeru',
   used: 'master_data_resale',
 };
```

#### backend-express/src/gateway/registry.ts
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 828a77fe..74004258 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -1833,7 +1833,7 @@ for (const category of ['order', 'spec', 'used']) {
 
 // ---------------------------------------------------------------------------
 // 個人情報削除（v2.2.227。② だけ）。features/privacy.ts
-//   privacy_erase:master  … 顧客DB（InformationEditKaeru / Resale のヘッダー）。建売・中古
+//   privacy_erase:master  … 顧客DB（InformationEdit / Kaeru / Resale のヘッダー）。注文・建売・中古
 //   privacy_erase:inquiry … 反響一覧（ListOrder / Kaeru / Resale の各行）。注文・建売・中古
 // ⚠️ 元に戻せない書き込み。⚠️ express_proxy.php の expressProxyRequests() と expressProxyExclusive() の両方に入れてある
 // ⚠️ 押せるのはその画面を使える全員（2026-10-29 の利用者の判断）。ログインは必須（auth: 'staff'）
```

#### backend/src/core/express_proxy.php
```diff
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 596dc7ab..196be41c 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -167,6 +167,7 @@ function expressProxyRequests(): array
         'planner:call_logs_import',
         'planner:practice_logs_import',
         // ⚠️ v2.2.227。個人情報削除（元に戻せない・② だけ）。expressProxyExclusive() にも入れてある
+        'privacy_erase:master:order',
         'privacy_erase:master:spec',
         'privacy_erase:master:used',
         'privacy_erase:inquiry:order',
@@ -839,6 +840,7 @@ function expressProxyExclusive(): array
         'planner:call_logs_import',
         'planner:practice_logs_import',
         // v2.2.227 新規。個人情報削除（元に戻せない）。⚠️ ① に PHP ハンドラは無い（② だけ）
+        'privacy_erase:master:order',
         'privacy_erase:master:spec',
         'privacy_erase:master:used',
         'privacy_erase:inquiry:order',
```

#### backend/scripts/guide/articles/order/screen-020.md
```diff
diff --git a/backend/scripts/guide/articles/order/screen-020.md b/backend/scripts/guide/articles/order/screen-020.md
index 58177e06..c2b0bd61 100644
--- a/backend/scripts/guide/articles/order/screen-020.md
+++ b/backend/scripts/guide/articles/order/screen-020.md
@@ -55,3 +55,11 @@ summary: お客様の検索と、商談の日付・ステータス・ランク
 - [[来場予約が入ったら・来場したら]]
 - [[契約したら（注文営業）]]
 - [[ランク]]
+
+## 個人情報削除
+顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBの一覧から外します。
+- 誰がいつ消したかは、そのお客様の変更履歴に残ります（消した値は残りません）
+
+> 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。
+
+> 要確認：個人情報を消してよいか（お客様からの削除の依頼など）は、社内のルールに従ってください。
```
