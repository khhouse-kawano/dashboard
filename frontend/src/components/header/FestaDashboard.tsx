import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Spinner, Table } from 'react-bootstrap';
import { styles, positions, formatToYYYYMMDD } from '../list/listUtils';
import apiClient from '../../utils/apiClient';
import { generateULID } from '../../utils/createULID';
import { thisYear } from '../../utils/thisYear';
import AuthContext from '../../context/AuthContext';
import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';
import { setStyleClass } from '../../utils/setStyleClass';
import { syncCategoryOfShop } from './divisions';

/**
 * おうちづくりフェスタ2026（v2.2.172 新規）。ヘッダー → 集客イベント → おうちづくりフェスタ2026。
 *
 * ─────────────────────────────────────────────
 *   ⚠️ **イベント当日に使う画面。** 受付状況・チケット・ストラップ・担当営業と、
 *     ブランドごとの「面談」「次アポ」を1つの表で見て入力する。
 *
 *   ⚠️ 対象は `title === 'おうちづくりフェスタ2026'` の予約だけ。
 *   ⚠️ データの取得・保存は反響一覧（EventList.tsx）と同じ `request: 'list', roll: 'event'`。
 *     ・load   … 全予約（⚠️ ここで FESTA_TITLE に絞る）
 *     ・update … 1列ずつ保存（name / kana / check_in_time / check_out_time / staff / sync）
 *     ・festa  … ⚠️ 営業入力の **1項目だけ**を保存（② が JSON_SET で書く。⚠️ 同時に押しても消し合わない）
 *     ・sync_shop … ⚠️ 同期した店舗を shop に `,` 区切りで足す（v2.2.174。⚠️ 足すのはサーバー）
 *
 *   ⚠️⚠️ チケット・ストラップの判定は ⚠️ **受付画面（LP の festa/reservation/index.html）と同じ規則**。
 *     ⚠️ 片方だけ直すと、受付と本部で言うことが食い違う。⚠️ 直すときは両方直すこと。
 *
 *   ⚠️ 集計表・同期（顧客への取り込み）は EventList.tsx と同じ処理を写している
 *     （⚠️ EventList.tsx 側は触っていない。⚠️ 直すときは両方を見ること）。
 * ─────────────────────────────────────────────
 */

const FESTA_TITLE = 'おうちづくりフェスタ2026';

/** 予約1件（⚠️ この画面で使う列だけ） */
type FestaRow = {
    no: string;
    id: string;
    time: string;
    date: string;
    name: string;
    kana: string;
    address: string;
    street: string;
    phone: string;
    mail: string;
    zip: string;
    interview: string;
    request: string;
    medium: string | null;
    area: string;
    reserved_at: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    staff: string | null;
    /** 営業入力（JSON 文字列）。⚠️ NULL・壊れた値は {} として扱う */
    festa: string | null;
    title: string;
    shop: string;
    sync: number | null;
    /** 予約の種別。⚠️ 当日来場は 'non-reserve'（v2.2.178：チケットの判定に使う） */
    status: string | null;
    /** 備考（v2.2.178：相談内容の右に出す） */
    remarks: string | null;
};

type Staff = {
    name: string;
    shop: string;
    period: string;
    position: string;
    rank: string;
};

/**
 * 営業入力のブランド。⚠️ 並びは指示書どおり。
 * ⚠️⚠️ **② の features/list/event.ts の FESTA_BRANDS と ① の list_event.php と同じ表記**にすること
 *   （⚠️ サーバーは一覧に無いキーを受け付けない）。
 */
const FESTA_BRANDS = ['KH', 'DJH', 'なごみ', '2L', 'PGH', 'かえる', '中専'] as const;
const FESTA_KINDS: { key: 'interview' | 'next'; label: string }[] = [
    { key: 'interview', label: '面談' },
    { key: 'next', label: '次アポ' },
];

/**
 * ブランドの色（v2.2.172 追加指示）。
 *
 * ⚠️⚠️ **色は `utils/setStyleClass.ts`（反響一覧 ListOrder.tsx などのブランド色）から借りる。**
 *   ⚠️ ここに色を書き写さない（⚠️ ブランド色を変えたときに片方だけ古くなる）。
 *   ⚠️ setStyleClass は店舗名の先頭2文字で引くので、⚠️ 表記をその2文字に読み替える。
 *     KH → 'KH'（ネイビー）／ DJH → 'DJ'（シアン）／ なごみ → 'なご'（茶）／ 2L → '2L'（緑）／
 *     PGH → 'PG'（黒）／ かえる → 'かえ'（緑）
 * ⚠️ 中専（中古住宅専門店）は setStyleClass に無いので ⚠️ **オレンジを直接指定**
 *   （⚠️ utils/setStyleClassUsed.ts の「買い:ポータル」と同じ #ff7f0e）。
 */
const BRAND_SHOP_PREFIX: Record<string, string> = {
    KH: 'KH', DJH: 'DJ', なごみ: 'なご', '2L': '2L', PGH: 'PG', かえる: 'かえ',
};
const brandColorOf = (brand: string): string => {
    if (brand === '中専') return '#ff7f0e';
    const color = setStyleClass(BRAND_SHOP_PREFIX[brand] ?? '').backgroundColor;
    return typeof color === 'string' && color !== '' ? color : '#8898aa';
};

/**
 * チケットの色（v2.2.172 追加指示: 3色に分ける）。⚠️ 文字は白、角丸のラベルで出す。
 * ⚠️ ブランド色・ストラップの色（黄・赤・青）と ⚠️ **かぶらない色**にしている。
 * ⚠️「なし」「－」は色を付けない。
 */
const TICKET_COLOR: Record<string, string> = {
    '3,000円分': '#6f42c1',
    '2,000円': '#0f9d8a',
    '1,000円': '#5a6b7b',
};

/** 営業入力の JSON を読む。⚠️ 無い・壊れているときは {}（⚠️ 画面の既定は FALSE） */
const parseFesta = (value: string | null): Record<string, boolean> => {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

/** 予約日（`YYYY/MM/DD`）。⚠️ reserved_at は `YYYY-MM-DD HH:MM:SS`（① は `/` のこともある） */
const reservedDate = (value: string | null): string => {
    const m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(value ?? '');
    return m ? `${m[1]}/${m[2]}/${m[3]}` : '';
};

/**
 * チケット。⚠️ 受付画面（reservation/index.html の ticketOf）と同じ規則。⚠️ **予約日**で決める。
 *   〜 9/13 … 3,000円分 ／ 9/14〜9/27 … 2,000円 ／
 *   9/28〜10/9 … 媒体が junko / 長原木 なら 2,000円、それ以外 1,000円 ／ 10/10〜（当日来場）… なし
 * ⚠️ v2.2.178: status が 'non-reserve'（当日来場の受付）は ⚠️ **予約日に関係なく「なし」**（10/10〜 と同じ扱い）。
 */
const TICKET_MEDIA = ['junko', '長原木'];
const WALK_IN_STATUS = 'non-reserve';
const ticketOf = (item: FestaRow): string => {
    if ((item.status ?? '').trim() === WALK_IN_STATUS) return 'なし';
    const d = reservedDate(item.reserved_at);
    if (d === '') return '－';
    if (d <= '2026/09/13') return '3,000円分';
    if (d <= '2026/09/27') return '2,000円';
    if (d <= '2026/10/09') return TICKET_MEDIA.includes(item.medium ?? '') ? '2,000円' : '1,000円';
    return 'なし';
};

/**
 * ストラップ。⚠️ 受付画面（strapOf）と同じ規則。
 *   相談内容か ご検討 に下のどれかがあれば ⚠️ **黄＋赤**、無ければ ⚠️ **青**。
 */
const STRAP_INTERVIEW = ['住宅相談', '資金・ローン相談', '土地探し相談', '不動産売却相談'];
const STRAP_REQUEST = ['注文住宅を検討している', '建売住宅を検討している', '中古住宅を検討している'];
const splitValues = (value: string | null | undefined): string[] =>
    String(value ?? '').split(',').map(v => v.trim()).filter(v => v !== '');
const strapOf = (item: FestaRow): ('yellow' | 'red' | 'blue')[] =>
    splitValues(item.interview).some(v => STRAP_INTERVIEW.includes(v))
        || splitValues(item.request).some(v => STRAP_REQUEST.includes(v))
        ? ['yellow', 'red'] : ['blue'];
const STRAP_COLOR = { yellow: '#ffd60a', red: '#e5383b', blue: '#1e6fd9' };
const STRAP_LABEL = { yellow: '黄', red: '赤', blue: '青' };

/**
 * 相談内容（v2.2.173 追加）。⚠️ 相談内容（interview）・ご検討（request）・建築予定地（area）を
 * ⚠️ **淡い色のチップ＋アイコン**で出す。⚠️ 下に無い値（キッチンカー・マルシェなど）は出さない。
 *   ⚠️ 背景は淡く、⚠️ 文字とアイコンは同じ系統の濃い色（⚠️ 色が強いと見づらいため：指示書）。
 *   ⚠️ title に元の文言（⚠️ マウスを乗せると見える）。
 */
type ConsultChip = { label: string; title: string; icon: string; bg: string; fg: string };
const CONSULT_INTERVIEW: Record<string, Omit<ConsultChip, 'title'>> = {
    '住宅相談': { label: '住宅', icon: 'fa-house', bg: '#e3eefc', fg: '#2b5a9e' },
    '資金・ローン相談': { label: '資金', icon: 'fa-yen-sign', bg: '#fdf3d3', fg: '#8a6a0a' },
    '土地探し相談': { label: '土地', icon: 'fa-map-location-dot', bg: '#e1f4e6', fg: '#2f7a45' },
    '不動産売却相談': { label: '売却', icon: 'fa-handshake', bg: '#fce4ec', fg: '#a8385f' },
};
const CONSULT_REQUEST: Record<string, Omit<ConsultChip, 'title'>> = {
    '注文住宅を検討している': { label: '注文', icon: 'fa-pen-ruler', bg: '#ede7f8', fg: '#5e3f9c' },
    '建売住宅を検討している': { label: '建売', icon: 'fa-house-chimney', bg: '#dff4f7', fg: '#1d6f7d' },
    '中古住宅を検討している': { label: '中古', icon: 'fa-key', bg: '#fdebdc', fg: '#a35418' },
};
const consultOf = (item: FestaRow): ConsultChip[] => {
    // ⚠️ 並びは表の順（相談 → 検討 → エリア）で固定。⚠️ 入力の順に左右されない
    const interviews = splitValues(item.interview);
    const requests = splitValues(item.request);
    const chips: ConsultChip[] = [
        ...Object.entries(CONSULT_INTERVIEW).filter(([v]) => interviews.includes(v)).map(([v, c]) => ({ ...c, title: v })),
        ...Object.entries(CONSULT_REQUEST).filter(([v]) => requests.includes(v)).map(([v, c]) => ({ ...c, title: v })),
    ];
    const area = String(item.area ?? '').trim();
    if (area !== '') chips.push({ label: area, title: `建築予定地：${area}`, icon: 'fa-location-dot', bg: '#eceef1', fg: '#4a5361' });
    return chips;
};

// ---------------------------------------------------------------------------
// ⚠️ ここから下の4つは EventList.tsx と同じ（集計表・同期で使う）
// ---------------------------------------------------------------------------

const brands: Record<string, string> = {
    'KH': '国分ハウジング',
    'DJ': 'デイジャストハウス',
    'なご': 'なごみ工務店',
    '2L': 'ニーエルホーム',
    'JH': 'ジャスフィーホーム',
    'FH': 'フルコミホーム',
    'PG': 'PG HOUSE'
};

/** 顧客取込（insert）用のペイロード。⚠️ EventList.tsx の createSyncPayload と同じ（⚠️ brand だけ違う） */
const createSyncPayload = (item: FestaRow, shop: string): Record<string, string> => ({
    id: generateULID(),
    customer_contacts_name: item.name || '',
    full_address: `${item.address || ''}${item.street || ''}`,
    // ⚠️ 反響取得日は予約日。⚠️ 無ければ来場日時（EventList.tsx の注記参照）
    step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99:
        formatToYYYYMMDD(item.reserved_at) || formatToYYYYMMDD(item.check_in_time),
    customer_contacts_mobile_phone_number: item.phone || '',
    customer_contacts_email: item.mail || '',
    postal_code: item.zip || '',
    sales_promotion_name: 'イベント',
    customized_input_01JRCT12N9X24PCQ5QZPAYKB93: item.title || '',
    status: '見込み',
    planned_construction_site: item.area || '',
    // ⚠️ v2.2.174: ブランドは ⚠️ **同期先に選んだ店舗**で決める（⚠️ フェスタの予約は shop が空・複数店舗になるため）
    brand: brands[shop.slice(0, 2)] || ''
});

/**
 * 同期した店舗（v2.2.174）。⚠️ event_db.shop に `,` 区切りで入っている（② の sync_shop が足す）。
 * ⚠️ 店舗が違えば何度でも同期できる。⚠️ 同じ店舗には2回同期できない。
 */
const syncedShopsOf = (item: FestaRow): string[] => splitValues(item.shop);

/**
 * 店舗 → 営業入力のブランド（v2.2.174：有効名簿数を数えるため）。
 * ⚠️ shop_list.brand で見分ける。⚠️ 無ければ店舗名の頭で見分ける（⚠️ なごみ・PG は shop_list に無いことがある）。
 * ⚠️ どれにも当たらない店舗（JH・FH など）は '' （⚠️ どのブランドにも数えない）。
 */
const BRAND_OF_SHOP_LIST: Record<string, string> = {
    KH: 'KH', DJH: 'DJH', '2L': '2L', PG: 'PGH', PGH: 'PGH', KHF: 'かえる', KHR: '中専',
};
const brandOfShop = (shop: string, shopList: MasterShop[]): string => {
    const master = shopList.find(s => (s.shop ?? '').trim() === shop);
    const byMaster = BRAND_OF_SHOP_LIST[(master?.brand ?? '').trim()];
    if (byMaster) return byMaster;
    if (shop.startsWith('なご')) return 'なごみ';
    if (shop.startsWith('PG')) return 'PGH';
    if (shop.startsWith('かえる')) return 'かえる';
    if (shop.startsWith('DJ')) return 'DJH';
    if (shop.startsWith('KH')) return 'KH';
    if (shop.startsWith('2L')) return '2L';
    if (shop === '中古住宅専門店') return '中専';
    return '';
};

/** 並び替え（v2.2.174）。⚠️ 見出しのボタンで 昇順 → 降順 → 解除 */
type SortKey = 'date' | 'time';
type SortDir = 'asc' | 'desc';

/** 「10:00」と「10:00~」をそろえる（⚠️ 集計表の見出し用） */
const normalizeTime = (value: string | null | undefined): string =>
    String(value ?? '').trim().replace(/[~〜～]+$/, '').trim();

const timeOrder = (value: string): number => {
    const m = value.match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
};

const UNSET_LABEL = '未設定';

/** 来場済みか（v2.2.181）。⚠️ check_in_time に値が入っていれば来場済み（⚠️ 画面上部の「チェックイン ◯件」と同じ判定） */
const isArrived = (item: { check_in_time: string | null }): boolean => (item.check_in_time ?? '').trim() !== '';

/**
 * 予約の区分（v2.2.182）。⚠️ 集計表の日付ごとの2行に使う。
 *   reserve … 事前予約（status !== 'non-reserve'。⚠️ status が空・NULL も事前予約）
 *   walkin  … 当日来場（status === 'non-reserve'。⚠️ ticketOf の WALK_IN_STATUS と同じ値）
 */
type BookingKind = 'reserve' | 'walkin';
const BOOKING_KINDS: { key: BookingKind; label: string }[] = [
    { key: 'reserve', label: '事前予約' },
    { key: 'walkin', label: '当日来場' },
];
const bookingKindOf = (item: { status: string | null }): BookingKind =>
    (item.status ?? '').trim() === WALK_IN_STATUS ? 'walkin' : 'reserve';

const rankByCount = (counts: Map<string, number>): string[] =>
    [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'ja')).map(([key]) => key);

// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '2px 4px',
    fontSize: '11px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    outline: 'none',
    height: '26px',
};

const thStyle: React.CSSProperties = {
    ...styles.label,
    display: 'table-cell',
    padding: '4px 6px',
    border: '1px solid #e9ecef',
    backgroundColor: '#f6f9fc',
    color: '#525f7f',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    textAlign: 'center',
    fontSize: '11px',
};

/** ⚠️ 入力欄にしている列（⚠️ 取り直したときに画面の値を上書きする対象） */
const EDIT_FIELDS = ['name', 'kana', 'check_in_time', 'check_out_time', 'staff'] as const;
type EditField = (typeof EDIT_FIELDS)[number];

/** ⚠️ 1回に描く行数。⚠️ スクロールが届くたびに増やす（EventList.tsx と同じ） */
const PAGE_SIZE = 20;

/**
 * 固定列の幅と左端（v2.2.172）。⚠️ 同期・顧客名・ふりがな の3列。
 * ⚠️ 幅を固定しないと left がずれて重なる。⚠️ 見出しと各行の両方でこの値を使う。
 */
const STICKY_WIDTH = [90, 130, 130];
const STICKY_LEFT = [0, STICKY_WIDTH[0], STICKY_WIDTH[0] + STICKY_WIDTH[1]];
const stickyStyle = (i: number): React.CSSProperties => ({
    left: STICKY_LEFT[i], width: STICKY_WIDTH[i], minWidth: STICKY_WIDTH[i], maxWidth: STICKY_WIDTH[i],
});

/** 表の列数（同期〜担当営業の11列（⚠️ v2.2.173 で相談内容、v2.2.178 で備考を追加・ストラップとチケットを1列に） ＋ 営業入力 7ブランド×2） */
const COLUMN_COUNT = 11 +FESTA_BRANDS.length * FESTA_KINDS.length;

type Props = {
    show: boolean;
    setShow: React.Dispatch<React.SetStateAction<boolean>>;
};

const FestaDashboard = ({ show, setShow }: Props) => {
    const { category } = useContext(AuthContext);
    const [data, setData] = useState<FestaRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** ⚠️ 名前・ふりがなで探す（⚠️ 当日、来場者をすぐ見つけるため） */
    const [keyword, setKeyword] = useState('');
    /**
     * 来場日・来場時間の絞り込み（v2.2.172 追加指示）。⚠️ 反響一覧（EventList.tsx）と同じ選び方。
     *   来場日 … `event_db.date` の値そのまま（例: 2026/10/10(土)）
     *   来場時間 … normalizeTime を通した値（⚠️「10:00」と「10:00~」を同じ時刻として扱う）
     */
    const [targetDate, setTargetDate] = useState('');
    const [targetTime, setTargetTime] = useState('');
    /** 並び替え（v2.2.174）。⚠️ null は既定（新しい予約が上） */
    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
    /** 見出しのボタン: 昇順 → 降順 → 解除（⚠️ 別の列を押したらその列の昇順から） */
    const toggleSort = (key: SortKey) => setSort(prev => {
        if (!prev || prev.key !== key) return { key, dir: 'asc' };
        return prev.dir === 'asc' ? { key, dir: 'desc' } : null;
    });
    /** ⚠️ 保存中のトグル（`id:key`）。⚠️ 連打で二重に送らない */
    const [savingKey, setSavingKey] = useState('');
    /** 上部のサマリー（集計表・ブランド別の歩留まり・注意書き）の開閉（v2.2.183）。⚠️ 既定は開く */
    const [summaryOpen, setSummaryOpen] = useState(true);

    // 同期（担当者選択）モーダル。⚠️ EventList.tsx と同じ
    const [staffArray, setStaffArray] = useState<Staff[]>([]);
    const [shopList, setShopList] = useState<MasterShop[]>([]);
    const [syncShow, setSyncShow] = useState(false);
    const [syncTarget, setSyncTarget] = useState<FestaRow | null>(null);
    const [syncShop, setSyncShop] = useState('');
    const [targetStaff, setTargetStaff] = useState('');

    const rowRefs = useRef<Record<string, Partial<Record<EditField, HTMLInputElement | null>>>>({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.post('', {
                request: 'list',
                roll: 'event',
                function: 'load',
                category,
                _t: Date.now(),
            });
            const rows = ((response.data?.summary ?? []) as FestaRow[]).filter(item => (item.title || '') === FESTA_TITLE);
            setData(rows);
            const positionIndex = (position: string) => {
                const index = positions.indexOf(position);
                return index === -1 ? positions.length : index;
            };
            setStaffArray((response.data?.staff ?? [])
                .filter((s: Staff) => s.period === String(thisYear) && Number(s.rank) === 1)
                .sort((a: Staff, b: Staff) => positionIndex(a.position) - positionIndex(b.position)));
            setShopList(response.data?.shop ?? []);
        } catch (err) {
            console.error(err);
            setError('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [category]);

    // ⚠️ 開いたときに取る（⚠️ ヘッダーは全画面に出ているので、開かない人の分まで取らない）
    useEffect(() => {
        if (show) void fetchData();
    }, [show, fetchData]);

    // ⚠️ 取り直したら、入力欄（defaultValue）の表示も新しい値にそろえる（EventList.tsx と同じ）
    useEffect(() => {
        data.forEach(item => {
            const refs = rowRefs.current[item.id];
            if (!refs) return;
            EDIT_FIELDS.forEach(field => {
                const el = refs[field];
                const next = String(item[field] ?? '');
                if (el && el.value !== next) el.value = next;
            });
        });
    }, [data]);

    /** 集計表（⚠️ EventList.tsx の summaryTable と同じ。⚠️ フェスタの全予約で数える） */
    const summaryTable = useMemo(() => {
        const dateArray = Array.from(new Set(data.map(item => (item.date || '').trim()).filter(v => v !== ''))).sort();
        const timeArray = Array.from(new Set(data.map(item => normalizeTime(item.time)).filter(v => v !== '')))
            .sort((a, b) => timeOrder(a) - timeOrder(b) || a.localeCompare(b));
        const dates = data.some(item => (item.date || '').trim() === '') ? [...dateArray, UNSET_LABEL] : dateArray;
        const times = data.some(item => normalizeTime(item.time) === '') ? [...timeArray, UNSET_LABEL] : timeArray;

        const interviewTotal = new Map<string, number>();
        const requestTotal = new Map<string, number>();
        data.forEach(item => {
            splitValues(item.interview).forEach(v => interviewTotal.set(v, (interviewTotal.get(v) ?? 0) + 1));
            splitValues(item.request).forEach(v => requestTotal.set(v, (requestTotal.get(v) ?? 0) + 1));
        });
        const interviews = rankByCount(interviewTotal);
        const requests = rankByCount(requestTotal);

        // ⚠️ v2.2.181: arrived / arrivedTime … 来場済み（check_in_time が入っている）の人数
        type Line = { total: number; arrived: number; time: Map<string, number>; arrivedTime: Map<string, number>; interview: Map<string, number>; request: Map<string, number> };
        const emptyLine = (): Line => ({ total: 0, arrived: 0, time: new Map(), arrivedTime: new Map(), interview: new Map(), request: new Map() });
        /**
         * ⚠️ v2.2.182: 日付ごとに ⚠️ **事前予約（status !== 'non-reserve'）と当日来場（status === 'non-reserve'）の2行**に分ける。
         *   ⚠️ 合計行は分けない（⚠️ 全体の合計）。
         */
        const lines = new Map<string, Record<BookingKind, Line>>(dates.map(d => [d, { reserve: emptyLine(), walkin: emptyLine() }]));
        const sum = emptyLine();
        const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

        data.forEach(item => {
            const line = lines.get((item.date || '').trim() || UNSET_LABEL)?.[bookingKindOf(item)];
            if (!line) return;
            const time = normalizeTime(item.time) || UNSET_LABEL;
            const arrived = isArrived(item);
            [line, sum].forEach(target => {
                target.total += 1;
                add(target.time, time);
                if (arrived) {
                    target.arrived += 1;
                    add(target.arrivedTime, time);
                }
                splitValues(item.interview).forEach(v => add(target.interview, v));
                splitValues(item.request).forEach(v => add(target.request, v));
            });
        });

        return { dates, times, interviews, requests, lines, sum };
    }, [data]);

    /**
     * ブランド別の歩留まり（v2.2.174）。⚠️ フェスタの全予約で数える（⚠️ 検索・絞り込みは効かない）。
     *   面談数 ／ 次アポ数 … 営業入力のトグルがオンの件数
     *   次アポ率          … 次アポ数 ÷ 面談数（⚠️ 面談 0 なら「－」）
     *   有効名簿数        … ⚠️ **そのブランドの店舗へ同期した人数**（⚠️ 1人を2ブランドへ同期したら両方で1件ずつ）
     * ⚠️ 合計: 面談・次アポは各ブランドの足し算。⚠️ 有効名簿は ⚠️ **同期した人数**（⚠️ 重複を数えない）。
     * ⚠️ v2.2.173 までに同期した行は shop が空なので、⚠️ どのブランドにも入らない（⚠️ 合計には入る）。
     */
    const brandYield = useMemo(() => {
        const empty = () => ({ interview: 0, next: 0, list: 0 });
        const byBrand = new Map<string, { interview: number; next: number; list: number }>(FESTA_BRANDS.map(b => [b, empty()]));
        const total = empty();
        data.forEach(item => {
            const festa = parseFesta(item.festa);
            FESTA_BRANDS.forEach(brand => {
                const line = byBrand.get(brand)!;
                if (festa[`${brand}_interview`] === true) { line.interview += 1; total.interview += 1; }
                if (festa[`${brand}_next`] === true) { line.next += 1; total.next += 1; }
            });
            const listed = new Set(syncedShopsOf(item).map(shop => brandOfShop(shop, shopList)).filter(b => b !== ''));
            listed.forEach(brand => { const line = byBrand.get(brand); if (line) line.list += 1; });
            if (Number(item.sync) === 1) total.list += 1;
        });
        return { byBrand, total };
    }, [data, shopList]);

    /** 来場日・来場時間の選択肢（⚠️ 空の値は出さない。⚠️ 時間は早い順） */
    const dateOptions = useMemo(
        () => Array.from(new Set(data.map(item => (item.date || '').trim()).filter(v => v !== ''))).sort(),
        [data]
    );
    const timeOptions = useMemo(
        () => Array.from(new Set(data.map(item => normalizeTime(item.time)).filter(v => v !== '')))
            .sort((a, b) => timeOrder(a) - timeOrder(b) || a.localeCompare(b)),
        [data]
    );

    const filtered = useMemo(() => {
        const word = keyword.trim();
        const rows = data.filter(item =>
            (word === '' || (item.name || '').includes(word) || (item.kana || '').includes(word)) &&
            (targetDate === '' || (item.date || '').trim() === targetDate) &&
            // ⚠️ 選択肢と同じく normalizeTime を通して比べる
            (targetTime === '' || normalizeTime(item.time) === targetTime)
        );
        const byNo = (a: FestaRow, b: FestaRow) => Number(b.no) - Number(a.no);
        if (!sort) return [...rows].sort(byNo);

        /**
         * 並び替え（v2.2.174）。
         *   ⚠️ 来場日は文字のまま比べる（`2026/10/10(土)` の形なので順に並ぶ）。
         *   ⚠️ 来場時間は timeOrder（⚠️「10:00」と「10:00~」は同じ時刻）。
         *   ⚠️ 空欄は ⚠️ **昇順でも降順でも最後**。
         *   ⚠️ 同じ値どうしは、来場日なら時間の早い順・来場時間なら日の早い順・最後は新しい予約が上。
         */
        const dateOf = (item: FestaRow) => (item.date || '').trim();
        const timeOf = (item: FestaRow) => normalizeTime(item.time);
        const compareDate = (a: FestaRow, b: FestaRow) => dateOf(a).localeCompare(dateOf(b));
        const compareTime = (a: FestaRow, b: FestaRow) =>
            timeOrder(timeOf(a)) - timeOrder(timeOf(b)) || timeOf(a).localeCompare(timeOf(b));
        const primaryValue = sort.key === 'date' ? dateOf : timeOf;
        const primary = sort.key === 'date' ? compareDate : compareTime;
        const secondary = sort.key === 'date' ? compareTime : compareDate;
        const sign = sort.dir === 'asc' ? 1 : -1;

        return [...rows].sort((a, b) => {
            const emptyA = primaryValue(a) === '';
            const emptyB = primaryValue(b) === '';
            if (emptyA !== emptyB) return emptyA ? 1 : -1;
            return sign * primary(a, b) || secondary(a, b) || byNo(a, b);
        });
    }, [data, keyword, targetDate, targetTime, sort]);

    // --- スクロールに合わせて描く行を増やす（EventList.tsx と同じ） ---
    const [displayLength, setDisplayLength] = useState(PAGE_SIZE);
    const loaderRef = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
        setDisplayLength(PAGE_SIZE);
    }, [keyword, targetDate, targetTime, sort]);

    useEffect(() => {
        const total = filtered.length;
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) setDisplayLength(prev => (prev < total ? prev + PAGE_SIZE : prev));
        }, { rootMargin: '200px' });
        const current = loaderRef.current;
        if (current) observer.observe(current);
        return () => { if (current) observer.unobserve(current); };
    }, [filtered.length, show]);

    const visible = useMemo(() => filtered.slice(0, displayLength), [filtered, displayLength]);

    // --- 保存 ---

    /** 1列の保存（⚠️ EventList.tsx の updateField と同じ要求） */
    const updateField = async (id: string, field: string, value: string | number) => {
        try {
            await apiClient.post('', { id, request: 'list', roll: 'event', function: 'update', category, [field]: value });
        } catch (e) {
            console.error(e);
            setError('保存に失敗しました。通信の状態を確認して、もう一度お試しください。');
        }
    };

    const handleBlur = (id: string, field: EditField) => {
        const el = rowRefs.current[id]?.[field];
        if (!el) return;
        const next = el.value;
        const current = data.find(item => item.id === id);
        // ⚠️ NULL と空欄は同じとみなす（⚠️ 触っただけで空文字を保存しない）
        if (current && String(current[field] ?? '') === next) return;
        setData(prev => prev.map(item => item.id === id ? { ...item, [field]: next } : item));
        void updateField(id, field, next);
    };

    const setRef = (id: string, field: EditField) => (el: HTMLInputElement | null) => {
        if (!rowRefs.current[id]) rowRefs.current[id] = {};
        rowRefs.current[id][field] = el;
    };

    /**
     * 営業入力のトグル。
     *
     * ⚠️ 先に画面を書き換えてから送る（⚠️ 当日は待たせない）。⚠️ 失敗したら元に戻す。
     * ⚠️⚠️ **送るのは押した1項目だけ**（`function: 'festa'`）。⚠️ JSON を丸ごと送らない
     *   （⚠️ 別の営業が同じ行を同時に押しても、互いの値を消さない）。
     * ⚠️ 値は反転ではなく ⚠️ **true / false を指定**して送る（⚠️ 同じ要求が2回届いても結果が変わらない）。
     */
    const toggleFesta = async (item: FestaRow, key: string) => {
        const before = parseFesta(item.festa);
        const value = !before[key];
        const busy = `${item.id}:${key}`;
        const write = (v: boolean) => setData(prev => prev.map(row => {
            if (row.id !== item.id) return row;
            return { ...row, festa: JSON.stringify({ ...parseFesta(row.festa), [key]: v }) };
        }));

        setSavingKey(busy);
        write(value);
        try {
            const res = await apiClient.post('', {
                request: 'list', roll: 'event', function: 'festa', category, id: item.id, key, value,
            });
            if (res.data?.status !== 'success') throw new Error(res.data?.message ?? '保存できませんでした');
            setError(null);
        } catch (e) {
            console.error(e);
            write(!value);
            setError('営業入力を保存できませんでした。通信の状態を確認して、もう一度お試しください。');
        } finally {
            setSavingKey('');
        }
    };

    // --- 同期（顧客への取り込み）。⚠️ EventList.tsx と同じ ---

    const shopOptions = useMemo(() => {
        const seen = new Set<string>();
        const names: string[] = [];
        sortShops(filterReportShops(shopList)).forEach(s => {
            const name = (s.shop ?? '').trim();
            if (name === '' || seen.has(name)) return;
            seen.add(name);
            names.push(name);
        });
        return names;
    }, [shopList]);

    const staffOptions = useMemo(() => {
        if (syncShop === '') return [];
        return [...staffArray.filter(s => s.shop === syncShop).map(s => s.name), `${syncShop} 管理`];
    }, [staffArray, syncShop]);

    /**
     * 同期（v2.2.174 で変更）。⚠️ **店舗が違えば何度でも同期できる**（指示書）。
     *   ⚠️ 店舗は毎回選び直す（⚠️ 最初は空。⚠️ 同期済みの店舗は選択肢で選べない）。
     */
    const handleSync = (item: FestaRow) => {
        setSyncTarget(item);
        setTargetStaff('');
        setSyncShop('');
        setSyncShow(true);
    };

    /** 同期の画面で、⚠️ その人がもう同期した店舗（⚠️ 選択肢で選べなくする） */
    const syncedOfTarget = useMemo(() => (syncTarget ? syncedShopsOf(syncTarget) : []), [syncTarget]);

    /**
     * 同期の実行。
     *   1. 顧客へ取り込む（roll: 'insert'。⚠️ EventList.tsx と同じ）
     *   2. ⚠️ **同期した店舗を event_db.shop に足す**（function: 'sync_shop'。⚠️ 足すのはサーバー。sync も 1 になる）
     * ⚠️ 1 が成功して 2 が失敗すると、⚠️ 取り込みは済んだのに画面では未同期の店舗に見える
     *   （⚠️ もう一度押すと二重に取り込まれる）。⚠️ そのときは赤字で知らせる。
     * ⚠️ 2人がほぼ同時に同じ人を同じ店舗へ同期すると、取り込みは2件になりうる（⚠️ 店舗は1つしか足されない）。
     */
    const syncStart = async () => {
        if (!syncTarget || syncShop === '') {
            alert('担当店舗を選択してください');
            return;
        }
        if (syncedOfTarget.includes(syncShop)) {
            alert('この店舗にはもう同期しています');
            return;
        }
        if (targetStaff === '') {
            alert('スタッフを選択してください');
            return;
        }
        const target = syncTarget;
        const shop = syncShop;
        // ⚠️ v2.2.178: 取り込み先は ⚠️ **選んだ店舗の事業区分**（⚠️ 画面の category ではない）
        const insertCategory = syncCategoryOfShop(shop, shopList);
        try {
            const response = await apiClient.post('', {
                ...createSyncPayload(target, shop),
                in_charge_user: targetStaff,
                in_charge_store: shop,
                request: 'list',
                roll: 'insert',
                category: insertCategory,
            });
            if (response.data.status !== 'success') {
                alert('同期に失敗しました。');
                return;
            }
        } catch (e) {
            console.error(e);
            alert('同期に失敗しました。');
            return;
        }

        setSyncShow(false);
        setSyncTarget(null);
        setTargetStaff('');
        setSyncShop('');

        try {
            const res = await apiClient.post('', {
                request: 'list', roll: 'event', function: 'sync_shop', category, id: target.id, shop,
            });
            if (res.data?.status !== 'success') throw new Error(res.data?.message ?? '保存できませんでした');
            const nextShop = String(res.data.shop ?? '');
            setData(prev => prev.map(item => item.id === target.id ? { ...item, shop: nextShop, sync: 1 } : item));
            setError(null);
        } catch (e) {
            console.error(e);
            setError(`${target.name} 様の取り込み（${shop}）は済みましたが、同期した店舗を記録できませんでした。もう一度同期しないでください。`);
        }
    };

    const checkedIn = data.filter(item => (item.check_in_time ?? '') !== '').length;

    /** 見出しの並び替えボタン（v2.2.174）。⚠️ 今の向きを矢印で示す（⚠️ 解除中は上下の矢印） */
    const sortButton = (key: SortKey, label: string) => {
        const dir = sort?.key === key ? sort.dir : null;
        const icon = dir === 'asc' ? 'fa-sort-up' : dir === 'desc' ? 'fa-sort-down' : 'fa-sort';
        const state = dir === 'asc' ? '昇順' : dir === 'desc' ? '降順' : '並び替えなし';
        return (
            <button type="button" className="fe_sortbtn" data-active={dir ? '1' : '0'} onClick={() => toggleSort(key)}
                aria-label={`${label}で並び替え（いま: ${state}）`} title={`${label}：${state}（押すと 昇順 → 降順 → 解除）`}>
                <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
            </button>
        );
    };

    /** 歩留まり表の1マス（⚠️ 0 は薄く） */
    const yieldCell = (n: number, key: string, first = false) =>
        <td key={key} className={`${n === 0 ? 'fe_zero' : ''}${first ? ' fe_sep' : ''}`}>{n}</td>;
    const rateText = (next: number, interview: number) =>
        interview === 0 ? '－' : `${Math.round((next / interview) * 1000) / 10}%`;

    return (
        <>
            <Modal show={show} onHide={() => setShow(false)} fullscreen>
                <Modal.Header closeButton className="py-2">
                    <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold', color: '#32325d' }}>{FESTA_TITLE}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-2" style={{ backgroundColor: '#f8f9fe' }}>
                    <style>{`
                        .fe_sum_wrap { overflow-x: auto; }
                        .fe_sum { border-collapse: collapse; font-size: 11px; white-space: nowrap; }
                        .fe_sum th, .fe_sum td { border: 1px solid #e9ecef; padding: 1px 6px; line-height: 1.35; text-align: right; }
                        .fe_sum th { background: #f6f9fc; color: #525f7f; font-size: 10px; font-weight: 700; text-align: center; }
                        .fe_sum .fe_group { background: #eef2f7; color: #32325d; }
                        .fe_sum .fe_date { text-align: left; font-weight: 700; color: #32325d; background: #fff; }
                        .fe_sum .fe_total { font-weight: 700; color: #32325d; }
                        .fe_sum .fe_kind { text-align: left; white-space: nowrap; font-size: 11px; color: #525f7f; }
                        .fe_sum tr.fe_kind_walkin td { background: #fff8ec; }
                        .fe_sum tr.fe_kind_walkin td.fe_kind { color: #b0590c; font-weight: 700; }
                        .fe_sum tr.fe_sumrow td { background: #f6f9fc; font-weight: 700; }
                        .fe_sum .fe_zero { color: #ced4da; }
                        .fe_arrived { display: inline-flex; align-items: center; gap: 2px; margin-left: 4px; padding: 0 5px; border-radius: 999px; background: #2dce89; color: #fff; font-size: 10px; font-weight: 700; line-height: 1.5; }
                        .fe_arrived i { font-size: 8px; }
                        .fe_arrived[data-zero="1"] { background: #e9ecef; color: #8898aa; }
                        .fe_sum .fe_sep, .fe_tbl .fe_sep { border-left: 2px solid #ced4da; }
                        .fe_tbl { font-size: 11px; }
                        .fe_tbl td { border: 1px solid #eef0f3; padding: 3px 4px; vertical-align: middle; }
                        .fe_yield_grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: start; }
                        @media (max-width: 991px) { .fe_yield_grid { grid-template-columns: minmax(0, 1fr); } }
                        .fe_notice { font-size: 12px; color: #32325d; border-left: 4px solid #fb6340 !important; }
                        .fe_notice_title { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
                        .fe_notice_list { margin: 0; padding-left: 18px; line-height: 1.7; }
                        .fe_notice_list li .fe_strap { width: 12px; height: 12px; }
                        .fe_notice_steps li::marker { color: #fb6340; }
                        .fe_strap_ticket { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
                        .fe_slash { color: #adb5bd; }
                        .fe_strap { display: inline-block; width: 18px; height: 18px; border-radius: 3px; border: 1px solid rgba(0,0,0,.15); margin-right: 3px; vertical-align: middle; }
                        .fe_toggle { width: 34px; height: 18px; border-radius: 999px; border: none; background: #ced4da; position: relative; cursor: pointer; padding: 0; transition: background .15s; }
                        .fe_toggle[data-on="1"] { background: #2dce89; }
                        .fe_toggle:disabled { opacity: .5; cursor: wait; }
                        .fe_toggle .fe_knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; }
                        .fe_toggle[data-on="1"] .fe_knob { transform: translateX(16px); }
                        .fe_toggle:focus-visible { outline: 2px solid #5e72e4; outline-offset: 2px; }
                        .fe_toggle[data-on="1"][data-brand] { background: var(--fe-brand); }
                        .fe_tbl thead tr th.fe_brand { background-color: var(--fe-brand) !important; color: #fff !important; font-weight: 700; }
                        .fe_consult_cell { white-space: normal; min-width: 200px; max-width: 240px; }
                        .fe_consult { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; margin: 1px 3px 1px 0; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 1.5; white-space: nowrap; }
                        .fe_consult i { font-size: 10px; }
                        .fe_remarks_cell { white-space: pre-wrap; word-break: break-all; min-width: 200px; max-width: 260px; font-size: 11px; color: #525f7f; }
                        .fe_sortbtn { border: none; background: transparent; padding: 0 0 0 4px; color: #adb5bd; cursor: pointer; line-height: 1; }
                        .fe_sortbtn[data-active="1"] { color: #5e72e4; }
                        .fe_sortbtn:focus-visible { outline: 2px solid #5e72e4; outline-offset: 1px; border-radius: 2px; }
                        .fe_sum th.fe_brandhead { background: var(--fe-brand); color: #fff; }
                        .fe_sum .fe_label { text-align: left; font-weight: 700; color: #32325d; background: #fff; }
                        .fe_ticket { display: inline-block; min-width: 64px; padding: 2px 8px; border-radius: 999px; color: #fff; font-weight: 700; text-align: center; }
                        /*
                          ⚠️ 固定列（v2.2.172 追加指示）: 同期・顧客名・ふりがな の3列を左に固定する。
                            ⚠️ left は列幅の合計（STICKY_LEFT）。⚠️ 列幅を変えたらそちらも直すこと。
                            ⚠️ 背景色が無いと、横スクロールした列が透けて見える。
                              td は Bootstrap の --bs-table-bg（同期済みの行は table-primary の色）で塗る。
                        */
                        .fe_tbl .fe_stick { position: sticky; z-index: 2; background-color: var(--bs-table-bg, #fff); }
                        .fe_tbl thead .fe_stick { z-index: 3; background-color: #f6f9fc; }
                        .fe_tbl .fe_stick_last { box-shadow: inset -2px 0 0 #ced4da; }
                        .fe_top { box-shadow: 0 6px 6px -6px rgba(50, 50, 93, .25); }
                        .fe_summary_panel { max-height: 45vh; overflow-y: auto; padding-bottom: 2px; }
                    `}</style>

                    {/*
                      ⚠️ v2.2.183: 上部の操作 ＋ サマリー（集計表・ブランド別の歩留まり・注意書き）を ⚠️ **まとめて上に固定**する。
                        ⚠️ それまでは操作の行だけ固定していた。
                        ⚠️ サマリーは「サマリーを閉じる／開く」で畳める（⚠️ 既定は開く）。
                        ⚠️ サマリーが高いと下の表が見えなくなるので、⚠️ サマリー部分は高さの上限（画面の45%）を超えたら中でスクロールする。
                    */}
                    <div className="fe_top" style={{ position: 'sticky', top: '-8px', zIndex: 5, backgroundColor: '#f8f9fe', padding: '8px 0 0', margin: '-8px 0 8px' }}>
                    {/* 上部の操作 */}
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <button style={{ ...styles.buttonPrimary, padding: '4px 10px', fontSize: '11px' }} onClick={() => void fetchData()} disabled={loading}>
                            {loading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="fa-solid fa-rotate-right me-1"></i>}
                            リロード
                        </button>
                        <button style={{ ...styles.buttonDanger, padding: '4px 10px', fontSize: '11px' }} onClick={() => setShow(false)}>
                            <i className="fa-solid fa-xmark me-1"></i>閉じる
                        </button>
                        <input
                            style={{ ...inputStyle, width: '220px', marginLeft: '12px' }}
                            placeholder="お名前・ふりがなで検索"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                        {/* ⚠️ 来場日・来場時間（v2.2.172 追加指示）。⚠️ 検索の右 */}
                        <select style={{ ...inputStyle, width: 'auto' }} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} aria-label="来場日">
                            <option value="">来場日を選択</option>
                            {dateOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <select style={{ ...inputStyle, width: 'auto' }} value={targetTime} onChange={(e) => setTargetTime(e.target.value)} aria-label="来場時間">
                            <option value="">来場時間を選択</option>
                            {timeOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <span style={{ fontSize: '11px', color: '#8898aa' }}>
                            予約 {data.length.toLocaleString()}件 ／ チェックイン {checkedIn.toLocaleString()}件
                        </span>
                        {/* ⚠️ v2.2.183: サマリーの開閉 */}
                        <button type="button" className="ms-auto" style={{ ...styles.buttonPrimary, padding: '4px 10px', fontSize: '11px' }}
                            onClick={() => setSummaryOpen(v => !v)} aria-expanded={summaryOpen} aria-controls="fe_summary_panel">
                            <i className={`fa-solid ${summaryOpen ? 'fa-chevron-up' : 'fa-chevron-down'} me-1`} aria-hidden="true"></i>
                            {summaryOpen ? 'サマリーを閉じる' : 'サマリーを開く'}
                        </button>
                    </div>

                    {summaryOpen && (
                    <div id="fe_summary_panel" className="fe_summary_panel">
                    {/* 集計表（⚠️ EventList.tsx と同じ配置） */}
                    {data.length > 0 && (
                        <div className="bg-white rounded shadow-sm border mb-2 p-2">
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#32325d', marginBottom: '4px' }}>
                                {FESTA_TITLE}
                                <small style={{ fontSize: '10px', fontWeight: 400, color: '#8898aa', marginLeft: '8px' }}>
                                    予約 {summaryTable.sum.total.toLocaleString()}件 ／ <span className="fe_arrived" style={{ marginLeft: 0 }}><i className="fa-solid fa-check" aria-hidden="true"></i>来場済み</span> の数字は check_in_time が入っている人数 ／ 相談内容・検討内容は複数選択のため予約数と一致しません
                                </small>
                            </div>
                            <div className="fe_sum_wrap">
                                <table className="fe_sum">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2}>日付</th>
                                            <th rowSpan={2}>区分</th>
                                            <th rowSpan={2}>予約数</th>
                                            {summaryTable.times.length > 0 && <th className="fe_group fe_sep" colSpan={summaryTable.times.length}>来場予定時間</th>}
                                            {summaryTable.interviews.length > 0 && <th className="fe_group fe_sep" colSpan={summaryTable.interviews.length}>相談内容</th>}
                                            {summaryTable.requests.length > 0 && <th className="fe_group fe_sep" colSpan={summaryTable.requests.length}>検討内容</th>}
                                        </tr>
                                        <tr>
                                            {summaryTable.times.map((t, i) => <th key={`t-${t}`} className={i === 0 ? 'fe_sep' : ''}>{t}</th>)}
                                            {summaryTable.interviews.map((v, i) => <th key={`i-${v}`} className={i === 0 ? 'fe_sep' : ''}>{v}</th>)}
                                            {summaryTable.requests.map((v, i) => <th key={`r-${v}`} className={i === 0 ? 'fe_sep' : ''}>{v}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/*
                                          ⚠️ v2.2.182: 日付ごとに2行（上: 事前予約 ／ 下: 当日来場）。⚠️ 日付のマスは2行ぶん縦につなぐ。
                                            ⚠️ 合計行は1行（⚠️ 日付と区分のマスを横につなぐ）。
                                        */}
                                        {[...summaryTable.dates.flatMap(d => BOOKING_KINDS.map((kind, k) => ({
                                            key: `${d}_${kind.key}`, label: d, kind: kind.key as BookingKind | 'sum', kindLabel: kind.label,
                                            firstOfDate: k === 0, line: summaryTable.lines.get(d)?.[kind.key], isSum: false,
                                          }))),
                                          { key: 'sum', label: '合計', kind: 'sum' as BookingKind | 'sum', kindLabel: '', firstOfDate: true, line: summaryTable.sum, isSum: true }]
                                          .map(({ key: rowKey, label, kind, kindLabel, firstOfDate, line, isSum }) => {
                                            if (!line) return null;
                                            const cell = (map: Map<string, number>, key: string, first: boolean) => {
                                                const n = map.get(key) ?? 0;
                                                return <td key={key} className={`${n === 0 ? 'fe_zero' : ''}${first ? ' fe_sep' : ''}`}>{n}</td>;
                                            };
                                            /**
                                             * 来場予定時間（v2.2.181）。⚠️ 予約数の隣に ⚠️ **来場済み（check_in_time あり）の人数**を色付きで出す。
                                             *   ⚠️ 予約が 0 の枠は従来どおり薄い 0 だけ。⚠️ 来場 0 の枠は「✓0」を薄く出す（⚠️ まだ誰も来ていないとわかるように）。
                                             */
                                            const timeCell = (key: string, first: boolean) => {
                                                const n = line.time.get(key) ?? 0;
                                                const arrived = line.arrivedTime.get(key) ?? 0;
                                                return (
                                                    <td key={key} className={`${n === 0 ? 'fe_zero' : ''}${first ? ' fe_sep' : ''}`}>
                                                        {n}
                                                        {n > 0 && <span className="fe_arrived" data-zero={arrived === 0 ? '1' : '0'} title={`来場済み ${arrived}人 ／ 予約 ${n}人`}><i className="fa-solid fa-check" aria-hidden="true"></i>{arrived}</span>}
                                                    </td>
                                                );
                                            };
                                            return (
                                                <tr key={rowKey} className={isSum ? 'fe_sumrow' : `fe_kind_${kind}`}>
                                                    {isSum
                                                        ? <td className="fe_date" colSpan={2}>{label}</td>
                                                        : <>
                                                            {firstOfDate && <td className="fe_date" rowSpan={BOOKING_KINDS.length}>{label}</td>}
                                                            <td className="fe_kind">{kindLabel}</td>
                                                        </>}
                                                    <td className="fe_total">
                                                        {line.total}
                                                        {line.total > 0 && <span className="fe_arrived" data-zero={line.arrived === 0 ? '1' : '0'} title={`来場済み ${line.arrived}人 ／ 予約 ${line.total}人`}><i className="fa-solid fa-check" aria-hidden="true"></i>{line.arrived}</span>}
                                                    </td>
                                                    {summaryTable.times.map((t, i) => timeCell(t, i === 0))}
                                                    {summaryTable.interviews.map((v, i) => cell(line.interview, v, i === 0))}
                                                    {summaryTable.requests.map((v, i) => cell(line.request, v, i === 0))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/*
                      ⚠️ v2.2.179: 歩留まりの右の空きに注意書き（⚠️ グリッドで左右2列。⚠️ 画面が狭いと縦に並ぶ）。
                        ⚠️ 注意書きは予約が0件でも出す（⚠️ 当日の朝、開いた人がまず読むため）。
                    */}
                    <div className="fe_yield_grid mb-2">
                    {/* ブランド別の歩留まり（v2.2.174）。⚠️ 集計表の下 */}
                    {data.length > 0 && (
                        <div className="bg-white rounded shadow-sm border p-2">
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#32325d', marginBottom: '4px' }}>
                                ブランド別の歩留まり
                                <small style={{ fontSize: '10px', fontWeight: 400, color: '#8898aa', marginLeft: '8px' }}>
                                    有効名簿数＝そのブランドの店舗へ同期した人数（合計は同期した人数。2ブランドへ同期した人も1人）
                                </small>
                            </div>
                            <div className="fe_sum_wrap">
                                <table className="fe_sum">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            {FESTA_BRANDS.map((brand, i) => (
                                                <th key={brand} className={`fe_brandhead${i === 0 ? ' fe_sep' : ''}`} style={{ ['--fe-brand' as string]: brandColorOf(brand), minWidth: '52px' } as React.CSSProperties}>{brand}</th>
                                            ))}
                                            <th className="fe_group fe_sep" style={{ minWidth: '52px' }}>合計</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="fe_label">面談数</td>
                                            {FESTA_BRANDS.map((brand, i) => yieldCell(brandYield.byBrand.get(brand)?.interview ?? 0, brand, i === 0))}
                                            {yieldCell(brandYield.total.interview, 'total', true)}
                                        </tr>
                                        <tr>
                                            <td className="fe_label">次アポ数</td>
                                            {FESTA_BRANDS.map((brand, i) => yieldCell(brandYield.byBrand.get(brand)?.next ?? 0, brand, i === 0))}
                                            {yieldCell(brandYield.total.next, 'total', true)}
                                        </tr>
                                        <tr>
                                            <td className="fe_label">次アポ率</td>
                                            {FESTA_BRANDS.map((brand, i) => {
                                                const line = brandYield.byBrand.get(brand);
                                                return <td key={brand} className={i === 0 ? 'fe_sep' : ''}>{rateText(line?.next ?? 0, line?.interview ?? 0)}</td>;
                                            })}
                                            <td className="fe_sep">{rateText(brandYield.total.next, brandYield.total.interview)}</td>
                                        </tr>
                                        <tr className="fe_sumrow">
                                            <td className="fe_label">有効名簿数</td>
                                            {FESTA_BRANDS.map((brand, i) => yieldCell(brandYield.byBrand.get(brand)?.list ?? 0, brand, i === 0))}
                                            {yieldCell(brandYield.total.list, 'total', true)}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 注意書き（v2.2.179）。⚠️ 文言は指示書どおり */}
                    <div className="bg-white rounded shadow-sm border p-2 fe_notice">
                        <div className="fe_notice_title">ストラップの色</div>
                        <ul className="fe_notice_list">
                            <li>
                                <span className="fe_strap" style={{ backgroundColor: STRAP_COLOR.yellow }} aria-hidden="true" />
                                <span className="fe_strap" style={{ backgroundColor: STRAP_COLOR.red }} aria-hidden="true" />
                                住宅・不動産を検討しているお客様
                            </li>
                            <li>
                                <span className="fe_strap" style={{ backgroundColor: STRAP_COLOR.blue }} aria-hidden="true" />
                                マルシェやキッチンカーのみ希望のお客様
                            </li>
                        </ul>
                        <div className="fe_notice_title mt-2">営業の皆様へ</div>
                        <ul className="fe_notice_list fe_notice_steps">
                            <li>お客様と面談した場合、ご自身の所属するブランドの<strong>「面談」</strong>にチェックを入れる</li>
                            <li>面談したお客様とアポイントが取れた場合、ご自身の所属するブランドの<strong>「次アポ」</strong>にチェックを入れる</li>
                            <li>次アポが取れたお客様、今後追客するお客様は<strong>必ず「同期」処理</strong>をおこなう</li>
                            <li>店舗をまたいで同期処理は可能なので、<strong>他店舗が同期済みでも追客する場合</strong>は忘れないように処理をする</li>
                        </ul>
                    </div>
                    </div>
                    </div>
                    )}
                    </div>

                    {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}

                    <div className="bg-white rounded shadow-sm border table-responsive">
                        <Table hover className="m-0 text-nowrap fe_tbl" style={{ minWidth: '2460px' }}>
                            {/*
                              ⚠️ 見出しは3段。⚠️ 指示書の rowSpan / colSpan は入れ替わっていると判断した（2026-10-08 の計画で合意）。
                                1段目: 同期〜担当営業（縦に3段ぶん）＋ 営業入力（横に14列ぶん）
                                2段目: ブランド（横に2列ずつ）
                                3段目: 面談 ／ 次アポ
                            */}
                            <thead>
                                <tr>
                                    <th rowSpan={3} className="fe_stick" style={{ ...thStyle, ...stickyStyle(0) }}>同期</th>
                                    <th rowSpan={3} className="fe_stick" style={{ ...thStyle, ...stickyStyle(1) }}>顧客名</th>
                                    <th rowSpan={3} className="fe_stick fe_stick_last" style={{ ...thStyle, ...stickyStyle(2) }}>ふりがな</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '170px' }}>ストラップ/チケット</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '220px' }}>相談内容</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '240px' }}>備考</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>来場日{sortButton('date', '来場日')}</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '90px' }}>来場時間{sortButton('time', '来場時間')}</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '140px' }}>チェックイン</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '140px' }}>チェックアウト</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>担当営業</th>
                                    <th colSpan={FESTA_BRANDS.length * FESTA_KINDS.length} className="fe_sep" style={{ ...thStyle, backgroundColor: '#eef2f7', color: '#32325d' }}>営業入力</th>
                                </tr>
                                <tr>
                                    {FESTA_BRANDS.map(brand => (
                                        /*
                                          ⚠️⚠️ ブランド色は `.fe_brand` ＋ `--fe-brand` で塗る（2026-10-08 に色が出なかった原因）。
                                            ⚠️ 全体の CSS（components/SearchBox.css の `thead tr:nth-of-type(even) th`）が
                                              ⚠️ **見出しの偶数行を #eeeeee !important で塗っている。** ⚠️ ブランドの行はちょうど2行目。
                                            ⚠️ 全体の CSS は他の画面が使うので変えず、⚠️ こちらの詳細度を上げて上書きする（<style> の .fe_brand）。
                                        */
                                        <th key={brand} colSpan={FESTA_KINDS.length} className="fe_sep fe_brand"
                                            style={{ ...thStyle, ['--fe-brand' as string]: brandColorOf(brand) } as React.CSSProperties}>{brand}</th>
                                    ))}
                                </tr>
                                <tr>
                                    {FESTA_BRANDS.map(brand => FESTA_KINDS.map((kind, i) => (
                                        <th key={`${brand}_${kind.key}`} className={i === 0 ? 'fe_sep' : ''} style={{ ...thStyle, fontWeight: 400 }}>{kind.label}</th>
                                    )))}
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((item, index) => {
                                    const festa = parseFesta(item.festa);
                                    return (
                                        <tr key={item.id} className={Number(item.sync) === 1 ? 'table-primary' : ''}>
                                            {/*
                                              ⚠️ v2.2.174: 店舗が違えば何度でも同期できるので ⚠️ 回転アイコンは常に出す（⚠️「同期済み」の文字は外した）。
                                                ⚠️ 同期済みかは行の色（table-primary）と、⚠️ アイコンの下の店舗名でわかる。
                                            */}
                                            <td className="text-center fw-bold fe_stick" style={{ fontSize: '10px', ...stickyStyle(0) }}>
                                                <div className="d-flex align-items-center gap-1">
                                                    <span>{index + 1}</span>
                                                    <i className="fa-solid fa-arrows-rotate pointer" role="button" tabIndex={0} aria-label={`${item.name} を同期`} title="同期"
                                                        onClick={() => handleSync(item)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSync(item); } }}></i>
                                                </div>
                                                {syncedShopsOf(item).map(shop => (
                                                    <div key={shop} className="text-start fw-normal mt-1" style={{ fontSize: '9px', color: '#525f7f', whiteSpace: 'normal', lineHeight: 1.2 }}>{shop}</div>
                                                ))}
                                            </td>
                                            <td className="fe_stick" style={stickyStyle(1)}><input type="text" style={inputStyle} ref={setRef(item.id, 'name')} defaultValue={item.name ?? ''} onBlur={() => handleBlur(item.id, 'name')} /></td>
                                            <td className="fe_stick fe_stick_last" style={stickyStyle(2)}><input type="text" style={inputStyle} ref={setRef(item.id, 'kana')} defaultValue={item.kana ?? ''} onBlur={() => handleBlur(item.id, 'kana')} /></td>
                                            {/* ⚠️ v2.2.178: ストラップとチケットを1列にまとめる（ストラップの色 / チケット代） */}
                                            <td className="text-center">
                                                <div className="fe_strap_ticket">
                                                    <span>
                                                        {strapOf(item).map(color => (
                                                            <span key={color} className="fe_strap" style={{ backgroundColor: STRAP_COLOR[color] }} title={STRAP_LABEL[color]} aria-label={STRAP_LABEL[color]} role="img" />
                                                        ))}
                                                    </span>
                                                    <span className="fe_slash" aria-hidden="true">/</span>
                                                    {(() => {
                                                        const ticket = ticketOf(item);
                                                        const color = TICKET_COLOR[ticket];
                                                        return color
                                                            ? <span className="fe_ticket" style={{ backgroundColor: color }} title={`チケット：${ticket}`}><i className="fa-solid fa-ticket me-1" aria-hidden="true"></i>{ticket}</span>
                                                            : <span className="text-muted" title={`チケット：${ticket}`}>{ticket}</span>;
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="fe_consult_cell">
                                                {consultOf(item).map(chip => (
                                                    <span key={chip.title} className="fe_consult" style={{ backgroundColor: chip.bg, color: chip.fg }} title={chip.title}>
                                                        <i className={`fa-solid ${chip.icon}`} aria-hidden="true"></i>{chip.label}
                                                    </span>
                                                ))}
                                            </td>
                                            {/* ⚠️ v2.2.178: 備考（event_db.remarks）。⚠️ 表示だけ。⚠️ 改行はそのまま出す */}
                                            <td className="fe_remarks_cell" title={item.remarks ?? ''}>{item.remarks ?? ''}</td>
                                            <td>{item.date || ''}</td>
                                            <td>{item.time || ''}</td>
                                            <td><input type="text" style={inputStyle} placeholder="2026/10/10 10:05" ref={setRef(item.id, 'check_in_time')} defaultValue={item.check_in_time ?? ''} onBlur={() => handleBlur(item.id, 'check_in_time')} /></td>
                                            <td><input type="text" style={inputStyle} placeholder="2026/10/10 11:30" ref={setRef(item.id, 'check_out_time')} defaultValue={item.check_out_time ?? ''} onBlur={() => handleBlur(item.id, 'check_out_time')} /></td>
                                            <td><input type="text" style={inputStyle} placeholder="担当営業" ref={setRef(item.id, 'staff')} defaultValue={item.staff ?? ''} onBlur={() => handleBlur(item.id, 'staff')} /></td>
                                            {FESTA_BRANDS.map(brand => FESTA_KINDS.map((kind, i) => {
                                                const key = `${brand}_${kind.key}`;
                                                const on = festa[key] === true;
                                                return (
                                                    <td key={key} className={`text-center${i === 0 ? ' fe_sep' : ''}`}>
                                                        <button
                                                            type="button"
                                                            className="fe_toggle"
                                                            data-on={on ? '1' : '0'}
                                                            data-brand={brand}
                                                            style={{ ['--fe-brand' as string]: brandColorOf(brand) } as React.CSSProperties}
                                                            aria-pressed={on}
                                                            aria-label={`${item.name} の ${brand} ${kind.label}`}
                                                            disabled={savingKey === `${item.id}:${key}`}
                                                            onClick={() => void toggleFesta(item, key)}
                                                        >
                                                            <span className="fe_knob" />
                                                        </button>
                                                    </td>
                                                );
                                            }))}
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={COLUMN_COUNT} className="text-center p-4 text-muted">データがありません</td>
                                    </tr>
                                )}
                                {/* ⚠️ 追加読み込みの目印。⚠️ tbody の中なので tr / td で置く（EventList.tsx と同じ） */}
                                <tr ref={loaderRef}>
                                    <td colSpan={COLUMN_COUNT} className="text-center text-muted p-2">
                                        {filtered.length > displayLength
                                            ? `読み込み中…（${displayLength} / ${filtered.length} 件）`
                                            : filtered.length > 0 ? `全 ${filtered.length} 件` : ''}
                                    </td>
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                </Modal.Body>
            </Modal>

            {/* 担当者選択モーダル（⚠️ EventList.tsx と同じ） */}
            <Modal show={syncShow} onHide={() => setSyncShow(false)} centered size="sm">
                <Modal.Header closeButton className="py-2">
                    <Modal.Title style={{ fontSize: '13px', fontWeight: 'bold', color: '#32325d' }}>担当営業の選択</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    <div className="mb-2" style={{ fontSize: '11px', color: '#8898aa' }}>
                        {syncTarget ? `${syncTarget.name} 様` : ''}
                        {/* ⚠️ v2.2.174: もう同期した店舗（⚠️ 下の選択肢では選べない） */}
                        {syncedOfTarget.length > 0 && <div className="mt-1">同期済み：{syncedOfTarget.join('、')}</div>}
                    </div>
                    <select className="mb-2" style={{ ...inputStyle, height: '28px', fontSize: '12px' }}
                        value={syncShop} onChange={(e) => { setSyncShop(e.target.value); setTargetStaff(''); }}>
                        <option value="">担当店舗を選択</option>
                        {shopOptions.map(name => {
                            const done = syncedOfTarget.includes(name);
                            return <option key={name} value={name} disabled={done}>{done ? `${name}（同期済み）` : name}</option>;
                        })}
                    </select>
                    <select style={{ ...inputStyle, height: '28px', fontSize: '12px' }} value={targetStaff} onChange={(e) => setTargetStaff(e.target.value)}>
                        <option value="">担当営業を選択</option>
                        {staffOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <button className="mt-2" style={{ ...styles.buttonDanger, padding: '0px 10px', fontSize: '11px' }} onClick={() => void syncStart()}>
                        <i className="fa-solid fa-rotate me-1"></i>同期する
                    </button>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default FestaDashboard;
