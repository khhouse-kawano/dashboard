# 作業記録 2026-10-30-02　アクセス解析の帯グラフと業者別の歩留まり（v2.2.232）

## 依頼（ReadMeClaude.md）
- サイトのサマリーの表の上に帯グラフ（項目ごとの割合。PV／CV で切り替え）
- 流入元のときは「業者別」ボタン。utm_campaign の末尾 `_pt1` は PURE GROWTH、`_pt2` は Bander。2社の PV・CV の割合
- 社名を押すと lg モーダルで、khg_vid と master_data・master_data_kaeru の landing_params を突き合わせて歩留まり（店舗名｜総反響｜来場数｜次アポ数｜契約数、1行目はブランド総計）
- KPI 単価は広告費が入力できるようになってから（今回は作らない）
- Downloads/database_bk の CSV をローカルの表に流し込む

## 決めたこと（利用者の回答）
- 表示名は「PURE GROWTH」「Bander」（指示書の PURE GROUTH は綴りの誤りとして直した）
- 歩留まりは「問い合わせの日までに、その業者の広告から一度でも来ていれば」数える
- 業者別の帯の分母は `_pt1`・`_pt2` の付いた分だけ（「それ以外」は出さない）。途中の指示で直した
- 来場・次アポ・契約の定義は紹介キャンペーンサマリーと同じ列（来場＝初回面談以降、次アポ＝事前審査・第二面談・契約、契約＝status 契約済み、重複除く）。店舗は併売店を親店舗に

## ローカルのデータ
- 控え：scratchpad `bk232_before_import.sql`（tracking_touches・master_data・master_data_kaeru・tracking_sites）
- TRUNCATE → LOAD DATA：tracking_touches 101,272件・master_data 27,030件・master_data_kaeru 11,683件（CSV の行数と一致、警告なし）
- tracking_sites に id=8（かえるホーム・khf。kaeruhome.jp）をローカルだけ仮登録（CSV のサイト8がローカルに無かったため）

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/tracking | **vendors.ts**（新規） | `TRACKING_VENDORS`・`OTHER_VENDOR_KEY`・`findVendor`・`vendorOf`・`vendorLike`・`VENDOR_CASE_SQL` |
| backend-express/src/features/tracking | **vendorFunnel.ts**（新規） | `trackingVendorFunnel` |
| backend-express/src/features/tracking | summary.ts | `group()` を式で受けるように・`vendors` を返す |
| backend-express/src/gateway | registry.ts | `tracking_vendor_funnel` を登録 |
| backend/src/core | express_proxy.php | `expressProxyRequests()`・`expressProxyExclusive()` に `tracking_vendor_funnel` |
| frontend/src/components/header | **TrackingVendorFunnel.tsx**（新規） | 業者別の歩留まりのモーダル |
| frontend/src/components/header | TrackingSettings.tsx | `BandChart`（新規）・SiteSummary に帯グラフ・業者別・`siteName` |
| frontend/src/utils | version.ts | 2.2.232 |
| backend/scripts/sql | **2026-10-30_update_log_2.2.232.sql**（新規） | 更新履歴＋業務ガイド |
| backend/scripts/guide/articles/common | screen-200.md | 業務ガイド |

## 業務ガイド
- 「アクセス解析」：「割合の帯グラフ」「業者別（流入元のとき）」「店舗別の歩留まり」の節を追加。summary に「広告の業者」を追加

## 確認
- ① 経由（localhost:8080）：トークン無し 401。Master で サマリーの vendors の PV が DB の件数と一致（サイト1：867／1,396、サイト8：0／808）
- 歩留まり：別に書いた SQL と一致（サイト1 PURE GROWTH 10件・来場3、Bander 2件、サイト8 Bander 9件）。不正な業者・サイト無し 400、一般の担当 403
- CV の業者分け：テスト用の反響1件で PURE GROWTH の CV が1になることを確認（確認後に削除）
- Playwright：帯（PV・CV）、業者別は流入元だけ、着地ページへ切り替えると PV に戻る、社名でモーダル、並べ替えで総計が先頭のまま、閉じてもアクセス解析は開いたまま、スマホ幅で横スクロールなし、ページのエラーなし
- テスト用の担当・反響は削除済み。開発サーバー（3100）は停止済み

## コード（全文・差分）

### backend-express/src/features/tracking/vendors.ts（新規・全文）
```tsx
/**
 * 広告の業者（v2.2.232）。⚠️ utm_campaign の末尾で見分ける（例: `xxx_pt1` は PURE GROWTH）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面は header/TrackingSettings.tsx（流入元タブの「業者別」）と header/TrackingVendorFunnel.tsx（歩留まり）。
 * ⚠️ 末尾の大文字・小文字は区別しない（⚠️ SQL の LIKE も区別しないので、JS もそろえる）。
 * ⚠️ 業者を足すときは、この配列に1行足す（SQL も画面もここから作る）。
 * ─────────────────────────────────────────────
 */

export interface TrackingVendor {
  /** 画面とのやり取りに使うキー */
  key: string;
  /** utm_campaign の末尾 */
  suffix: string;
  name: string;
}

export const TRACKING_VENDORS: readonly TrackingVendor[] = [
  { key: 'pt1', suffix: '_pt1', name: 'PURE GROWTH' },
  { key: 'pt2', suffix: '_pt2', name: 'Bander' },
];

/** どの業者にも当たらない分のキー（⚠️ 画面には出さない。業者別の割合の分母に入れない） */
export const OTHER_VENDOR_KEY = '';

export const findVendor = (key: unknown): TrackingVendor | undefined => TRACKING_VENDORS.find((v) => v.key === key);

/** utm_campaign → 業者のキー（当たらなければ OTHER_VENDOR_KEY） */
export const vendorOf = (campaign: string | null | undefined): string => {
  const value = String(campaign ?? '').trim().toLowerCase();
  return TRACKING_VENDORS.find((v) => value.endsWith(v.suffix))?.key ?? OTHER_VENDOR_KEY;
};

/** LIKE の値（⚠️ `_` は LIKE の1文字なので逃がす） */
export const vendorLike = (vendor: TrackingVendor): string => `%${vendor.suffix.replace(/_/g, '\\_')}`;

/** tracking_touches（別名 t）の行 → 業者のキー（SQL）。⚠️ 値は TRACKING_VENDORS の定数だけ */
export const VENDOR_CASE_SQL = `CASE ${TRACKING_VENDORS.map((v) => `WHEN TRIM(t.utm_campaign) LIKE '${vendorLike(v)}' THEN '${v.key}'`).join(' ')} ELSE '${OTHER_VENDOR_KEY}' END`;
```

### backend-express/src/features/tracking/vendorFunnel.ts（新規・全文）
```tsx
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { UUID_PATTERN } from './params';
import { canManageTracking, type TrackingResult } from './sites';
import { findVendor, vendorLike } from './vendors';

/**
 * 業者別の歩留まり（v2.2.232）。画面は header/TrackingVendorFunnel.tsx（アクセス解析 → サイトのサマリー → 流入元 → 業者別 → 社名）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 対象 ＝ 顧客台帳（注文 master_data・建売 master_data_kaeru）の landing_params の khg_vid が、
 *   問い合わせの日（反響取得日）までに、そのサイトへその業者の広告（utm_campaign の末尾）から一度でも来ていた顧客（2026-10-30 の指示）。
 *   ⚠️ 最後の訪問ではない（サマリーの CV はラストクリック。数えている顧客も反響の表も違うので、数は一致しない）。
 *   ⚠️ 反響取得日が読めない顧客は、日付で切らずに数える。
 * ⚠️ 期間で切らない（記録を始めた 2026-10-20 以降のすべて）。
 * ⚠️ 歩留まりの列は紹介キャンペーンサマリー（introductory/summary.ts）と同じ。⚠️ status＝重複は数えない。
 * ⚠️ 店舗は in_charge_store。⚠️ 併売店（shop_list.parent_shop がある店舗）は親店舗にまとめる。
 * ⚠️ KPI単価（広告費 ÷ 件数）は、広告費が入力できるようになってから総計の行にだけ付ける（2026-10-30 の指示）。
 * ─────────────────────────────────────────────
 */

const COL_INQUIRY = 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99';     // 反響取得日
const COL_INTERVIEW = 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7';   // 初回面談
const COL_SCREENING = 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR';   // 事前審査
const COL_APPOINTMENT = 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'; // 第二面談
const COL_CONTRACT = 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG';    // 契約

/** 顧客台帳。⚠️ SQL に直接埋め込むので、この定数以外の値を入れないこと */
const TABLES = ['master_data', 'master_data_kaeru'] as const;
/** visitor_id を IN で渡す件数（conversions.ts と同じ） */
const CHUNK = 500;
const UNSET_SHOP = '（未入力）';

interface CustomerRow extends RowDataPacket {
  vid: string;
  status: string | null;
  store: string | null;
  col_inquiry: string | null;
  col_interview: string | null;
  col_screening: string | null;
  col_appointment: string | null;
  col_contract: string | null;
}

interface FirstTouchRow extends RowDataPacket {
  visitor_id: string;
  first_at: string;
}

interface ShopRow extends RowDataPacket {
  shop: string;
  parent_shop: string | null;
}

interface VendorFunnelRow {
  shop: string;
  inquiry: number;
  meeting: number;
  next: number;
  contract: number;
}

const hasValue = (value: unknown): boolean => String(value ?? '').trim() !== '';

/** 反響取得日 → `YYYY-MM-DD`（読めなければ null）。⚠️ `2026-02-28` と `2026/06/01` の両方がある */
const toDay = (value: unknown): string | null => {
  const matched = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(value ?? '').trim());
  return matched === null ? null : `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`;
};

const emptyRow = (shop: string): VendorFunnelRow => ({ shop, inquiry: 0, meeting: 0, next: 0, contract: 0 });

export const trackingVendorFunnel = async (staff: AuthenticatedStaff | null, siteIdValue: unknown, vendorKey: unknown): Promise<TrackingResult> => {
  if (!canManageTracking(staff)) return { httpStatus: 403, body: { status: 'error', message: 'この画面は管理者だけが使えます。' } };
  const siteId = Number(siteIdValue);
  if (!Number.isInteger(siteId) || siteId <= 0) return { httpStatus: 400, body: { status: 'error', message: 'サイトが指定されていません。' } };
  const vendor = findVendor(vendorKey);
  if (vendor === undefined) return { httpStatus: 400, body: { status: 'error', message: '業者が指定されていません。' } };

  const [shops, ...perTable] = await Promise.all([
    query<ShopRow>('SELECT shop, parent_shop FROM shop_list'),
    ...TABLES.map((table) => query<CustomerRow>(
      `SELECT CONVERT(LOWER(SUBSTRING(landing_params, LOCATE('khg_vid=', landing_params) + 8, 36)) USING utf8mb4) AS vid,
              status, in_charge_store AS store,
              ${COL_INQUIRY} AS col_inquiry, ${COL_INTERVIEW} AS col_interview, ${COL_SCREENING} AS col_screening,
              ${COL_APPOINTMENT} AS col_appointment, ${COL_CONTRACT} AS col_contract
         FROM ${table}
        WHERE landing_params LIKE '%khg_vid=%'`
    )),
  ]);
  const customers = perTable.flat().filter((c) => c.status !== '重複' && UUID_PATTERN.test(c.vid));

  // 顧客の訪問者ID → そのサイトにその業者の広告から最初に来た日時
  const firstTouch = new Map<string, string>();
  const vids = [...new Set(customers.map((c) => c.vid))];
  for (let i = 0; i < vids.length; i += CHUNK) {
    const part = vids.slice(i, i + CHUNK);
    const rows = await query<FirstTouchRow>(
      `SELECT t.visitor_id, DATE_FORMAT(MIN(t.created_at), '%Y-%m-%d %H:%i:%s') AS first_at
         FROM tracking_touches t
        WHERE t.site_id = ? AND TRIM(t.utm_campaign) LIKE ? AND t.visitor_id IN (${part.map(() => '?').join(', ')})
        GROUP BY t.visitor_id`,
      [siteId, vendorLike(vendor), ...part]
    );
    for (const row of rows) firstTouch.set(row.visitor_id, row.first_at);
  }

  const parentOf = new Map<string, string>();
  for (const s of shops) parentOf.set(s.shop, hasValue(s.parent_shop) ? String(s.parent_shop).trim() : s.shop);

  const total = emptyRow('');
  const byShop = new Map<string, VendorFunnelRow>();
  for (const c of customers) {
    const first = firstTouch.get(c.vid);
    if (first === undefined) continue;
    const day = toDay(c.col_inquiry);
    // ⚠️ 問い合わせの日より後に初めて来た顧客は数えない（⚠️ 日付が読めなければ切らない）
    if (day !== null && first > `${day} 23:59:59`) continue;

    const store = String(c.store ?? '').trim();
    const shop = store === '' ? UNSET_SHOP : parentOf.get(store) ?? store;
    const row = byShop.get(shop) ?? emptyRow(shop);
    const contract = c.status === '契約済み';
    const next = contract || hasValue(c.col_screening) || hasValue(c.col_appointment) || hasValue(c.col_contract);
    const meeting = next || hasValue(c.col_interview);
    for (const r of [row, total]) {
      r.inquiry += 1;
      if (meeting) r.meeting += 1;
      if (next) r.next += 1;
      if (contract) r.contract += 1;
    }
    byShop.set(shop, row);
  }

  // ⚠️ 反響の多い順（⚠️ 未入力は最後）
  const rows = [...byShop.values()].sort((a, b) => Number(a.shop === UNSET_SHOP) - Number(b.shop === UNSET_SHOP) || b.inquiry - a.inquiry);
  return {
    httpStatus: 200,
    body: { status: 'ok', siteId, vendor: vendor.key, total, rows },
  };
};
```

### frontend/src/components/header/TrackingVendorFunnel.tsx（新規・全文）
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-bootstrap';
import apiClient from '../../utils/apiClient';

/**
 * 業者別の歩留まり（v2.2.232 新規）。アクセス解析のサマリー → 流入元 → 業者別 → 社名を押すと開く（size="lg"）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 開いたときに ② の tracking_vendor_funnel を取りに行く（features/tracking/vendorFunnel.ts）。
 * ⚠️ 数えるのは、顧客台帳（注文・建売）の顧客のうち、問い合わせの日までにそのサイトへその業者の広告から一度でも来ていた人。
 *   ⚠️ サマリーの CV（最後の訪問で数える）とは数え方が違うので、件数は一致しない（注意書きに出す）。
 * ⚠️ 1行目はブランド（サイト）の総計。⚠️ 並べ替えは店舗の行だけ（総計は先頭のまま）。
 * ⚠️ KPI単価は、広告費を入力できるようになってから総計の行にだけ付ける（2026-10-30 の指示）。
 * ⚠️ アクセス解析（全画面モーダル）の上に重ねるので、幕を z-index 1055 に上げる（TrackingDetail.tsx と同じ）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tv_）。
 * ─────────────────────────────────────────────
 */

interface FunnelRow {
    shop: string;
    inquiry: number;
    meeting: number;
    next: number;
    contract: number;
}

interface FunnelData {
    total: FunnelRow;
    rows: FunnelRow[];
}

type SortKey = keyof FunnelRow;

const COLUMNS: { key: Exclude<SortKey, 'shop'>; label: string }[] = [
    { key: 'inquiry', label: '総反響' },
    { key: 'meeting', label: '来場数' },
    { key: 'next', label: '次アポ数' },
    { key: 'contract', label: '契約数' },
];

const pct = (a: number, b: number): string => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');

/** 業者（② の vendors.ts。サマリーの vendors の1行） */
interface Vendor {
    key: string;
    suffix: string;
    name: string;
}

const TrackingVendorFunnel: React.FC<{ siteId: number; siteName: string; vendor: Vendor; onClose: () => void }> = ({ siteId, siteName, vendor, onClose }) => {
    const [data, setData] = useState<FunnelData | null>(null);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('inquiry');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        let alive = true;
        setData(null);
        setError('');
        apiClient.post('', { request: 'tracking_vendor_funnel', site_id: siteId, vendor: vendor.key })
            .then((response) => { if (alive) setData(response.data as FunnelData); })
            .catch((e) => {
                console.error('tracking_vendor_funnel failed:', e);
                if (alive) setError('歩留まりを読み込めませんでした。閉じて開き直してください。');
            });
        return () => { alive = false; };
    }, [siteId, vendor.key]);

    const rows = useMemo(() => {
        const dir = sortOrder === 'asc' ? 1 : -1;
        return [...(data?.rows ?? [])].sort((a, b) => (sortKey === 'shop' ? a.shop.localeCompare(b.shop, 'ja') : a[sortKey] - b[sortKey]) * dir);
    }, [data, sortKey, sortOrder]);

    const SortHead = ({ label, k, num = true }: { label: string; k: SortKey; num?: boolean }) => {
        const active = sortKey === k;
        return (
            <th className={`tv_th tv_sort${num ? ' tv_num' : ''}`} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(k); setSortOrder('desc'); }
                }}>
                {label}<span className={`tv_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const Cells = ({ row }: { row: FunnelRow }) => (
        <>
            {COLUMNS.map(({ key }) => (
                <td key={key} className="tv_td tv_num">
                    {row[key].toLocaleString()}
                    {key !== 'inquiry' && <span className="tv_rate">{pct(row[key], row.inquiry)}</span>}
                </td>
            ))}
        </>
    );

    return (
        <Modal show onHide={onClose} size="lg" centered scrollable backdropClassName="tv_backdrop" contentClassName="tv_content">
            <style>{CSS}</style>
            <Modal.Header closeButton className="bg-light py-2">
                <Modal.Title className="tv_title">
                    <span className="tv_axis">業者別の歩留まり</span>
                    {vendor.name}
                    <span className="tv_sub">{siteName}</span>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="tv_body">
                {error !== '' && <div className="tv_error">{error}</div>}
                {data === null && error === '' && <div className="tv_sub">読み込み中…</div>}
                {data !== null && (
                    <>
                        <div className="tv_kpi">
                            <div className="tv_card"><div className="tv_label">総反響</div><div className="tv_value">{data.total.inquiry.toLocaleString()}</div></div>
                            <div className="tv_card"><div className="tv_label">来場率</div><div className="tv_value">{pct(data.total.meeting, data.total.inquiry)}</div></div>
                            <div className="tv_card"><div className="tv_label">次アポ率</div><div className="tv_value">{pct(data.total.next, data.total.inquiry)}</div></div>
                            <div className="tv_card"><div className="tv_label">契約率</div><div className="tv_value">{pct(data.total.contract, data.total.inquiry)}</div></div>
                        </div>
                        <div className="tv_table_wrap">
                            <table className="tv_table">
                                <thead>
                                    <tr>
                                        <SortHead label="店舗名" k="shop" num={false} />
                                        {COLUMNS.map((c) => <SortHead key={c.key} label={c.label} k={c.key} />)}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="tv_total">
                                        <td className="tv_td">ブランド総計</td>
                                        <Cells row={data.total} />
                                    </tr>
                                    {rows.length === 0 ? (
                                        <tr><td className="tv_td tv_empty" colSpan={5}>{vendor.name} の広告から来た反響はまだありません。</td></tr>
                                    ) : rows.map((r) => (
                                        <tr key={r.shop}>
                                            <td className="tv_td">{r.shop}</td>
                                            <Cells row={r} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="tv_note">
                            ※ 問い合わせの日までに、このサイトへ {vendor.name} の広告（キャンペーン名の末尾が {vendor.suffix}）から一度でも来ていた反響を数えます（記録を始めた 2026-10-20 以降）。
                            サマリーの CV は最後の訪問で数えるため、件数は一致しません。<br />
                            ※ 来場＝初回面談以降の日付あり、次アポ＝事前審査・第二面談・契約の日付あり、契約＝契約済み。重複は数えません。率は総反響に対する割合です。
                        </div>
                    </>
                )}
            </Modal.Body>
        </Modal>
    );
};

/** ⚠️ GoogleReview.tsx・TrackingDetail.tsx と同じ配色・余白・角丸（接頭辞 tv_） */
const CSS = `
.tv_backdrop.modal-backdrop { z-index: 1055; }
.tv_backdrop.modal-backdrop.show { opacity: .55; }
.tv_content.modal-content { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 24px 64px rgba(15,23,42,.45), 0 2px 8px rgba(15,23,42,.2); }
.tv_title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tv_axis { font-size: 10px; font-weight: 700; color: #1d4ed8; background: #eff6ff; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.tv_sub { font-size: 11px; color: #6b7280; font-weight: 400; }
.tv_body { font-size: 12px; color: #1f2937; display: flex; flex-direction: column; gap: 12px; }
.tv_error { font-size: 12px; color: #b91c1c; font-weight: 700; }
.tv_note { font-size: 11px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 10px; line-height: 1.6; }
.tv_kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
.tv_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; }
.tv_label { font-size: 11px; color: #6b7280; }
.tv_value { font-size: 17px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.tv_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; max-height: 420px; }
.tv_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.tv_th { position: sticky; top: 0; z-index: 1; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 7px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
.tv_sort { cursor: pointer; user-select: none; }
.tv_sort:hover { background: #eef2f7; }
.tv_sort_icon { margin-left: 4px; font-size: 10px; color: #cbd5e1; }
.tv_sort_icon.is_active { color: #2563eb; }
.tv_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
.tv_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tv_rate { margin-left: 6px; font-size: 10px; color: #6b7280; }
.tv_total > .tv_td { background: #eff6ff; font-weight: 700; }
.tv_empty { color: #9ca3af; text-align: center; padding: 16px; }
`;

export default TrackingVendorFunnel;
```

### 差分（summary.ts・registry.ts・express_proxy.php・TrackingSettings.tsx・version.ts）
```diff
diff --git a/backend-express/src/features/tracking/summary.ts b/backend-express/src/features/tracking/summary.ts
index 36a78b1e..acb501b1 100644
--- a/backend-express/src/features/tracking/summary.ts
+++ b/backend-express/src/features/tracking/summary.ts
@@ -4,6 +4,7 @@ import type { AuthenticatedStaff } from '../../types/staff';
 import { attributeConversions, DAYS } from './conversions';
 import { AD_TOUCH_SQL } from './params';
 import { canManageTracking, type TrackingResult } from './sites';
+import { TRACKING_VENDORS, VENDOR_CASE_SQL, vendorOf } from './vendors';
 
 /**
  * トラッキング設定のサマリーと CV（v2.2.202）。画面は header/TrackingSettings.tsx（サイト名を押すと開く）。
@@ -13,6 +14,8 @@ import { canManageTracking, type TrackingResult } from './sites';
  * ⚠️ 訪問数は広告・広告以外の両方（tracking_touches の行数）。⚠️ 一覧の「直近30日の着地」は広告の分だけ（sites.ts）。
  * ⚠️ CV の数え方は conversions.ts。着地ページ別・流入元別は、その CV の「最後の訪問」の着地ページ・流入元に1件を付ける。
  *   ⚠️ その訪問が30日より前なら、訪問数 0 の行として出る。
+ * ⚠️ v2.2.232 業者別（vendors。utm_campaign の末尾 _pt1・_pt2。vendors.ts）。⚠️ CV も「最後の訪問」の utm_campaign で分ける。
+ *   ⚠️ 業者に当たらない分は返さない（画面の割合の分母は業者の付いた分だけ）。
  * ─────────────────────────────────────────────
  */
 
@@ -48,17 +51,27 @@ export const trackingSiteSummary = async (staff: AuthenticatedStaff | null, site
   const siteId = Number(siteIdValue);
   if (!Number.isInteger(siteId) || siteId <= 0) return { httpStatus: 400, body: { status: 'error', message: 'サイトが指定されていません。' } };
 
-  const group = (column: string): Promise<GroupRow[]> => query<GroupRow>(
-    `SELECT t.${column} AS k, COUNT(*) AS visits, SUM(${AD_TOUCH_SQL}) AS ad
+  /** ⚠️ expr は SQL に直接入る（列名か、VENDOR_CASE_SQL などの定数だけ） */
+  const group = (expr: string): Promise<GroupRow[]> => query<GroupRow>(
+    `SELECT ${expr} AS k, COUNT(*) AS visits, SUM(${AD_TOUCH_SQL}) AS ad
        FROM tracking_touches t
       WHERE t.site_id = ? AND t.created_at >= NOW() - INTERVAL ${DAYS} DAY
-      GROUP BY t.${column}`,
+      GROUP BY k`,
     [siteId]
   );
-  const [landingRows, sourceRows, conversions] = await Promise.all([group('landing_url'), group('source'), attributeConversions(siteId)]);
+  const [landingRows, sourceRows, vendorRows, conversions] = await Promise.all([
+    group('t.landing_url'), group('t.source'), group(VENDOR_CASE_SQL), attributeConversions(siteId),
+  ]);
   const cv = conversions.get(siteId) ?? [];
   const landing = mergeRows(landingRows, cv.map((c) => c.landingUrl), false);
   const source = mergeRows(sourceRows, cv.map((c) => c.source), true);
+  // v2.2.232 業者別。⚠️ 業者が0件でも行を出す（帯グラフの凡例をそろえる）
+  // ⚠️ どの業者にも当たらない分は返さない（割合の分母は _pt1・_pt2 の付いた分だけ。2026-10-30 の指示）
+  const byVendor = new Map(mergeRows(vendorRows, cv.map((c) => vendorOf(c.campaign)), false).map((r) => [r.key, r]));
+  const vendors = TRACKING_VENDORS.map((v) => {
+    const row = byVendor.get(v.key);
+    return { key: v.key, suffix: v.suffix, name: v.name, visits: row?.visits ?? 0, cv: row?.cv ?? 0 };
+  });
 
   return {
     httpStatus: 200,
@@ -73,6 +86,7 @@ export const trackingSiteSummary = async (staff: AuthenticatedStaff | null, site
       },
       landing,
       source,
+      vendors,
     },
   };
 };
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 788be2fb..c199a3e6 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -15,6 +15,7 @@ import { getGuide, listGuide, saveGuide } from '../features/guide';
 import { canManageTracking, listTrackingSites, saveTrackingSite } from '../features/tracking/sites';
 import { trackingSiteSummary } from '../features/tracking/summary';
 import { trackingDetail } from '../features/tracking/detail';
+import { trackingVendorFunnel } from '../features/tracking/vendorFunnel';
 import { importMetaAds, isMetaConfigured } from '../features/metaAds/importer';
 import { listInquiryTouches } from '../features/tracking/touches';
 import { listCustomerPageviews } from '../features/tracking/customerPageviews';
@@ -879,6 +880,18 @@ register({
   },
 });
 
+register({
+  request: 'tracking_vendor_funnel',
+  summary: 'アクセス解析の業者別の歩留まり（サイト1つ・業者1つ。utm_campaign の末尾 _pt1/_pt2 から来た顧客の店舗別の反響・来場・次アポ・契約。Master / BrandAdmin のみ）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await trackingVendorFunnel(ctx.staff, ctx.body.site_id, ctx.body.vendor);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 register({
   request: 'tracking_detail',
   summary: 'アクセス解析の詳細（サイト1つの着地ページ1つ／流入元1つ。直近30日の日別・時間帯・端末・広告別・CV。Meta 広告の数字つき。Master / BrandAdmin のみ）',
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 196be41c..95b94bf2 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -744,11 +744,13 @@ function expressProxyRequests(): array
         //   ⚠️ 各サイトの tracker.js・着地の記録（/t/v1/tracker.js・/api/track/touch）は ① を通らない（② へ直接）。
         //   ⚠️ tracking_site_summary は v2.2.202 で追加（サイト名を押すと開くサマリー）。
         //   ⚠️ tracking_detail・meta_ads_import は v2.2.203 で追加（アクセス解析のモーダル・Meta 広告の取り込み。meta_ads_import は書き込み）。
+        //   ⚠️ tracking_vendor_funnel は v2.2.232 で追加（業者別の歩留まり）。
         // -----------------------------------------------------------------
         'tracking_site_list',
         'tracking_site_save',
         'tracking_site_summary',
         'tracking_detail',
+        'tracking_vendor_funnel',
         'meta_ads_import',
         'tracking_touches',
         'customer_pageviews',
@@ -1032,11 +1034,12 @@ function expressProxyExclusive(): array
         'guide_list',
         'guide_article',
         'guide_save',
-        // ⚠️ 2026-10-20 新規（v2.2.199）。広告流入トラッキング。⚠️ 理由は上と同じ（tracking_site_summary は v2.2.202、tracking_detail・meta_ads_import は v2.2.203）
+        // ⚠️ 2026-10-20 新規（v2.2.199）。広告流入トラッキング。⚠️ 理由は上と同じ（tracking_site_summary は v2.2.202、tracking_detail・meta_ads_import は v2.2.203、tracking_vendor_funnel は v2.2.232）
         'tracking_site_list',
         'tracking_site_save',
         'tracking_site_summary',
         'tracking_detail',
+        'tracking_vendor_funnel',
         'meta_ads_import',
         'tracking_touches',
         'customer_pageviews',
diff --git a/frontend/src/components/header/TrackingSettings.tsx b/frontend/src/components/header/TrackingSettings.tsx
index a898b84d..0ce5afa8 100644
--- a/frontend/src/components/header/TrackingSettings.tsx
+++ b/frontend/src/components/header/TrackingSettings.tsx
@@ -1,6 +1,7 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import apiClient from '../../utils/apiClient';
 import TrackingDetail, { type DetailAxis } from './TrackingDetail';
+import TrackingVendorFunnel from './TrackingVendorFunnel';
 
 /**
  * アクセス解析（v2.2.199 新規「トラッキング設定」→ v2.2.203 で「アクセス解析」に改名）。ヘッダー「反響管理 → アクセス解析」（Master / BrandAdmin）。
@@ -19,6 +20,8 @@ import TrackingDetail, { type DetailAxis } from './TrackingDetail';
  *   ⚠️ 一覧の CV の下に「フォーム送信 n件（結びつき m件）」。送っているのに結びつかないなら、フォームの入力欄の名前が変わったなど。
  * ⚠️ v2.2.203 サマリーの着地ページ・流入元を押すと、詳細のモーダル（TrackingDetail.tsx）が開く。着地ページは右のアイコンでそのページを開く。
  *   ⚠️ 上の「Meta から取り込む」は ② の meta_ads_import（待たずに返る。終わったかは「最後の取り込み」で見る）。⚠️ ② は6時間ごとにも自動で取り込む。
+ * ⚠️ v2.2.232 サマリーの表の上に帯グラフ（PV・CV の割合）。流入元タブでは「業者別」（PURE GROWTH・Bander。② の vendors.ts）も出し、
+ *   社名を押すと店舗別の歩留まり（TrackingVendorFunnel.tsx）が開く。
  * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
  * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
  * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tk_）。
@@ -101,15 +104,66 @@ interface SummaryRow {
     cv: number;
 }
 
+/** v2.2.232 業者別（utm_campaign の末尾 _pt1・_pt2。② の vendors.ts）。⚠️ 業者の付いていない分は来ない */
+interface VendorRow {
+    key: string;
+    /** utm_campaign の末尾（例 _pt1） */
+    suffix: string;
+    name: string;
+    visits: number;
+    cv: number;
+}
+
 interface Summary {
     days: number;
     kpi: { visits: number; ad: number; cv: number };
     landing: SummaryRow[];
     source: SummaryRow[];
+    vendors: VendorRow[];
 }
 
 type SummaryTab = 'landing' | 'source';
 type SummarySortKey = 'key' | 'visits' | 'ad' | 'cv' | 'rate';
+/** 帯グラフの切り替え（v2.2.232）。⚠️ 業者別は流入元タブだけ */
+type BandMode = 'visits' | 'cv' | 'vendor';
+/** 帯グラフに出す件数。⚠️ これより後ろは「その他」にまとめる */
+const BAND_TOP = 8;
+const BAND_COLORS = ['#2563eb', '#f97316', '#10b981', '#a855f7', '#eab308', '#06b6d4', '#ef4444', '#ec4899'];
+const BAND_REST_COLOR = '#cbd5e1';
+
+interface BandItem {
+    label: string;
+    value: number;
+    color: string;
+    /** 押すと開く（業者の社名） */
+    onClick?: () => void;
+}
+
+/** 100% の帯グラフ（v2.2.232）。⚠️ 0件の項目は帯に出さないが、凡例には出す */
+const BandChart: React.FC<{ title: string; items: BandItem[] }> = ({ title, items }) => {
+    const total = items.reduce((s, i) => s + i.value, 0);
+    const share = (v: number): string => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '—');
+    return (
+        <div className="tk_band_block">
+            <div className="tk_band_title">{title}<span className="tk_sub">（計 {total.toLocaleString()}）</span></div>
+            <div className="tk_band" role="img" aria-label={`${title}の割合`}>
+                {/* ⚠️ key に番号を付ける（http と https の着地ページは同じ表示になる） */}
+                {total === 0 ? <div className="tk_band_empty">記録がありません</div> : items.map((i, n) => i.value > 0 && (
+                    <div key={`${n}-${i.label}`} className="tk_band_seg" style={{ width: `${(i.value / total) * 100}%`, background: i.color }} title={`${i.label}　${i.value.toLocaleString()}（${share(i.value)}）`} />
+                ))}
+            </div>
+            <div className="tk_band_legend">
+                {items.map((i, n) => (
+                    <span key={`${n}-${i.label}`} className="tk_band_item" title={i.label}>
+                        <span className="tk_band_swatch" style={{ background: i.color }} />
+                        {i.onClick ? <button type="button" className="tk_key_btn tk_band_name" onClick={i.onClick}>{i.label}</button> : <span className="tk_band_name">{i.label}</span>}
+                        <span className="tk_band_num">{i.value.toLocaleString()}（{share(i.value)}）</span>
+                    </span>
+                ))}
+            </div>
+        </div>
+    );
+};
 
 const rateOf = (cv: number, visits: number): number | null => (visits > 0 ? (cv / visits) * 100 : null);
 const formatRate = (rate: number | null): string => (rate === null ? '—' : `${rate.toFixed(1)}%`);
@@ -130,7 +184,7 @@ const readableUrl = (url: string): string => {
  * ⚠️ 表記は「PV」（2026-10-20 の指示）。⚠️ 中身は ② の訪問数（30分以内のページの移動はまとめて1件）で、ページが見られた回数より少ない。
  * ⚠️ reloadKey が変わったら取り直す（親の「再読み込み」）。
  */
-const SiteSummary: React.FC<{ siteId: number; reloadKey: number }> = ({ siteId, reloadKey }) => {
+const SiteSummary: React.FC<{ siteId: number; siteName: string; reloadKey: number }> = ({ siteId, siteName, reloadKey }) => {
     const [data, setData] = useState<Summary | null>(null);
     const [error, setError] = useState('');
     const [tab, setTab] = useState<SummaryTab>('landing');
@@ -138,6 +192,11 @@ const SiteSummary: React.FC<{ siteId: number; reloadKey: number }> = ({ siteId,
     const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
     /** 詳細を開いている着地ページ・流入元（v2.2.203） */
     const [detail, setDetail] = useState<{ axis: DetailAxis; value: string } | null>(null);
+    const [bandMode, setBandMode] = useState<BandMode>('visits');
+    /** 歩留まりを開いている業者（v2.2.232） */
+    const [vendor, setVendor] = useState<VendorRow | null>(null);
+    // ⚠️ 業者別は流入元タブだけ。着地ページに切り替えたら PV に戻して見せる
+    const mode: BandMode = bandMode === 'vendor' && tab !== 'source' ? 'visits' : bandMode;
 
     useEffect(() => {
         let alive = true;
@@ -161,9 +220,27 @@ const SiteSummary: React.FC<{ siteId: number; reloadKey: number }> = ({ siteId,
         });
     }, [data, tab, sortKey, sortOrder]);
 
+    /** 帯グラフの項目（PV・CV）。⚠️ 表の並べ替えに関係なく多い順。上位 BAND_TOP 件と「その他」 */
+    const bandItems = useMemo((): BandItem[] => {
+        if (data === null || mode === 'vendor') return [];
+        const metric = mode;
+        const list = data[tab].filter((r) => r[metric] > 0).sort((a, b) => b[metric] - a[metric]);
+        const items: BandItem[] = list.slice(0, BAND_TOP).map((r, i) => ({
+            label: tab === 'landing' ? readableUrl(r.key) : r.key || '（不明）', value: r[metric], color: BAND_COLORS[i],
+        }));
+        const rest = list.slice(BAND_TOP).reduce((s, r) => s + r[metric], 0);
+        if (rest > 0) items.push({ label: `その他（${list.length - BAND_TOP}件）`, value: rest, color: BAND_REST_COLOR });
+        return items;
+    }, [data, tab, mode]);
+
     if (error !== '') return <div className="tk_error">{error}</div>;
     if (data === null) return <div className="tk_sub">読み込み中…</div>;
 
+    // ⚠️ 業者別の分母は _pt1・_pt2 の付いた分だけ（それ以外は ② が返さない）
+    const vendorItems = (metric: 'visits' | 'cv'): BandItem[] => data.vendors.map((v, i) => ({
+        label: v.name, value: v[metric], color: BAND_COLORS[i], onClick: () => setVendor(v),
+    }));
+
     const SortHead = ({ label, keyName, num = true }: { label: string; keyName: SummarySortKey; num?: boolean }) => {
         const active = sortKey === keyName;
         return (
@@ -193,6 +270,25 @@ const SiteSummary: React.FC<{ siteId: number; reloadKey: number }> = ({ siteId,
                 ))}
                 <span className="tk_sub">CV は、問い合わせの日までの最後の訪問の{tab === 'landing' ? '着地ページ' : '流入元'}で数えます</span>
             </div>
+            <div className="tk_band_wrap">
+                <div className="tk_band_switch" role="group" aria-label="帯グラフの切り替え">
+                    {([['visits', 'PV'], ['cv', 'CV'], ...(tab === 'source' ? [['vendor', '業者別']] : [])] as [BandMode, string][]).map(([key, label]) => (
+                        <button key={key} type="button" aria-pressed={mode === key}
+                            className={`tk_tab${mode === key ? ' is_active' : ''}`} onClick={() => setBandMode(key)}>{label}</button>
+                    ))}
+                    {mode === 'vendor' && (
+                        <span className="tk_sub">
+                            utm_campaign の末尾が{data.vendors.map((v) => ` ${v.suffix} なら ${v.name}`).join('、')}。社名を押すと店舗別の歩留まりが開きます
+                        </span>
+                    )}
+                </div>
+                {mode === 'vendor' ? (
+                    <>
+                        <BandChart title="PV" items={vendorItems('visits')} />
+                        <BandChart title="CV" items={vendorItems('cv')} />
+                    </>
+                ) : <BandChart title={mode === 'visits' ? 'PV' : 'CV'} items={bandItems} />}
+            </div>
             <div className="tk_sum_table_wrap">
                 <table className="tk_table">
                     <thead>
@@ -230,6 +326,7 @@ const SiteSummary: React.FC<{ siteId: number; reloadKey: number }> = ({ siteId,
                 </table>
             </div>
             {detail !== null && <TrackingDetail siteId={siteId} axis={detail.axis} value={detail.value} onClose={() => setDetail(null)} />}
+            {vendor !== null && <TrackingVendorFunnel siteId={siteId} siteName={siteName} vendor={vendor} onClose={() => setVendor(null)} />}
         </div>
     );
 };
@@ -461,7 +558,7 @@ const TrackingSettings: React.FC = () => {
                                     </tr>
                                     {openSummary.has(s.id) && (
                                         <tr className="tk_summary">
-                                            <td className="tk_td" colSpan={9}><SiteSummary siteId={s.id} reloadKey={reloadKey} /></td>
+                                            <td className="tk_td" colSpan={9}><SiteSummary siteId={s.id} siteName={s.name} reloadKey={reloadKey} /></td>
                                         </tr>
                                     )}
                                     {openTag === s.id && (
@@ -562,6 +659,19 @@ const CSS = `
 .tk_tab:hover { background: #eef2f7; }
 .tk_tab.is_active { background: #2563eb; border-color: #2563eb; color: #fff; }
 .tk_tab:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; }
+.tk_band_wrap { display: flex; flex-direction: column; gap: 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
+.tk_band_switch { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
+.tk_band_block { display: flex; flex-direction: column; gap: 4px; }
+.tk_band_title { font-size: 11px; font-weight: 700; color: #4b5563; }
+.tk_band { display: flex; height: 22px; border-radius: 6px; overflow: hidden; background: #f3f4f6; }
+.tk_band_seg { height: 100%; min-width: 2px; }
+.tk_band_seg + .tk_band_seg { border-left: 1px solid #fff; }
+.tk_band_empty { font-size: 11px; color: #9ca3af; line-height: 22px; padding: 0 8px; }
+.tk_band_legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11px; color: #374151; }
+.tk_band_item { display: inline-flex; align-items: center; gap: 5px; max-width: 360px; min-width: 0; }
+.tk_band_swatch { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
+.tk_band_name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
+.tk_band_num { color: #6b7280; white-space: nowrap; font-variant-numeric: tabular-nums; }
 .tk_sum_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; max-height: 360px; }
 .tk_th_sort { cursor: pointer; user-select: none; }
 .tk_th_sort:hover { background: #eef2f7; }
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 1ed99d72..b713674b 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.231';
+export const newVersion = '2.2.232';
```
