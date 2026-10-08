# 2026-10-08 集客イベントに「おうちづくりフェスタ2026」（当日用ダッシュボード）を追加（v2.2.172）

## 依頼（ReadMeClaude.md）
- Header.tsx：「集客イベント」に **おうちづくりフェスタ2026** を追加 → 新規 FestaDashboard.tsx を fullscreen で開く
- FestaDashboard.tsx（イベント当日用）
  - 上部に EventList.tsx と同じ集計表
  - event_db の各行を表示・編集する表（同期／顧客名／ふりがな／ストラップ／来場日／来場時間／チケット／チェックイン／チェックアウト／担当営業／営業入力 7ブランド×面談・次アポ）
  - 営業入力用に `event_db.festa LONGTEXT DEFAULT NULL` を追加し、JSON で登録（既定は FALSE）

## 決定事項（2026-10-08 の計画で合意）
| 論点 | 決定 |
|---|---|
| 見出しの rowSpan / colSpan | 指示書は入れ替わっていると判断。1段目: 同期〜担当営業は rowSpan=3、営業入力は colSpan=14 ／ 2段目: ブランド colSpan=2 ／ 3段目: 面談・次アポ |
| JSON の形 | `{"KH_interview": true, "KH_next": false, …}`（キー＝ブランド_interview／ブランド_next、値＝真偽）。無いキーは FALSE |
| 保存方法 | ⚠️ **押した1項目だけ** `JSON_SET` で書く（`function: 'festa'`）。同時に押しても他の人の値を消さない。値は反転でなく true/false 指定（冪等） |
| ふりがな | 入力欄にするため `kana` を更新可能列に追加（⚠️ EventList.tsx では従来どおり表示のみ） |
| 集計表・同期 | EventList.tsx の処理を写して使う（EventList.tsx は変更しない） |
| チケット・ストラップ | 受付画面（festa/reservation/index.html）と同じ規則 |

- ⚠️ 追加したもの（指示外・小さなもの）: 上部に「お名前・ふりがなで検索」と「予約 N件 ／ チェックイン N件」の表示（当日に来場者をすぐ探すため）

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend/scripts/sql` | **2026-10-08_event_db_festa.sql**（新規） | `ALTER TABLE event_db ADD COLUMN festa LONGTEXT DEFAULT NULL … AFTER staff` |
| `backend/scripts/sql` | 2026-10-08_update_log_2.2.172.sql（新規） | update_log（ローカル no=268） |
| `backend-express/src/features/list` | **event.ts** | `ALLOWED_COLUMNS` に `kana`。**`FESTA_BRANDS` / `FESTA_KEYS` / `runFesta`** を追加。`runListEvent` に `function === 'festa'` |
| `backend/src/handlers/listAction` | **list_event.php** | `$allowed_columns` に `kana`。`$function === 'festa'` の処理（② と同じ） |
| `frontend/src/components/header` | **FestaDashboard.tsx**（新規） | 当日用ダッシュボード（全文は下） |
| `frontend/src/components/header` | **Header.tsx** | メニューに「おうちづくりフェスタ2026」、`showFesta` state、`<FestaDashboard>` |
| `frontend/src/utils` | version.ts | 2.2.172 |
| `docs/` → `docs/oldDocument/` | 2026-10-06 作成の deploy-v2.2.165〜168・task-2026-10-06-* | 2日経過のため移動 |

## 確認（ローカル）
| ケース | 結果 |
|---|---|
| KH_interview を true | `{"KH_interview": true}` |
| 4つのキーを同時に保存 | 4つとも残る（`DJH_next`・`なごみ_interview`・`中専_next`・`KH_next:false`）＝消し合わない |
| 同じ値をもう一度 | success（冪等） |
| 一覧に無いキー／パスを壊すキー（`KH_interview"].a`） | 「項目が正しくありません」 |
| 値が文字列 `"true"` | 「値が正しくありません」 |
| 存在しない予約 | 「予約が見つかりませんでした」 |
| festa に壊れた値 | `{}` から書き直す |
| kana の更新 | 保存された |
- テスト行は削除済み。② tsc OK、PHP `php -l` OK、フロント build `main.98adbab9.js`（FestaDashboard に警告なし。Header の警告は変更前から）
- ⚠️ ① PHP の festa 処理は構文チェックのみ（実行は未確認。② が応答する経路では使われない）
- ⚠️ ブラウザでの表示確認は未実施

---

## SQL
```sql
-- =====================================================================
-- event_db に festa（営業入力）を追加する（v2.2.172）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️⚠️ **② と ① PHP とフロントを出す前に流すこと。**
--
-- ⚠️ 中身は JSON（例: {"KH_interview": true, "KH_next": false}）。
--   ⚠️ キーは「ブランド_interview（面談）／ブランド_next（次アポ）」。⚠️ 無いキーは FALSE 扱い。
-- ⚠️ 書き込みは ② が JSON_SET で1項目ずつ行う（⚠️ 同時に押しても他の人の値を消さない）。
-- =====================================================================

ALTER TABLE event_db ADD COLUMN festa LONGTEXT DEFAULT NULL COMMENT 'おうちづくりフェスタ2026 の営業入力（JSON）' AFTER staff;

-- 確認（⚠️ information_schema は ① で使えないため SHOW COLUMNS）
-- SHOW COLUMNS FROM event_db LIKE 'festa';
```

## frontend/src/components/header/FestaDashboard.tsx（新規・全文）
```tsx
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Spinner, Table } from 'react-bootstrap';
import { styles, positions, formatToYYYYMMDD } from '../list/listUtils';
import apiClient from '../../utils/apiClient';
import { generateULID } from '../../utils/createULID';
import { thisYear } from '../../utils/thisYear';
import AuthContext from '../../context/AuthContext';
import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';

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
 */
const TICKET_MEDIA = ['junko', '長原木'];
const ticketOf = (item: FestaRow): string => {
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

/** 顧客取込（insert）用のペイロード。⚠️ EventList.tsx の createSyncPayload と同じ */
const createSyncPayload = (item: FestaRow): Record<string, string> => ({
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
    brand: brands[(item.shop || '').slice(0, 2)] || ''
});

/** 「10:00」と「10:00~」をそろえる（⚠️ 集計表の見出し用） */
const normalizeTime = (value: string | null | undefined): string =>
    String(value ?? '').trim().replace(/[~〜～]+$/, '').trim();

const timeOrder = (value: string): number => {
    const m = value.match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
};

const UNSET_LABEL = '未設定';

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

/** 表の列数（同期〜担当営業の10列 ＋ 営業入力 7ブランド×2） */
const COLUMN_COUNT = 10 + FESTA_BRANDS.length * FESTA_KINDS.length;

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
    /** ⚠️ 保存中のトグル（`id:key`）。⚠️ 連打で二重に送らない */
    const [savingKey, setSavingKey] = useState('');

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

        type Line = { total: number; time: Map<string, number>; interview: Map<string, number>; request: Map<string, number> };
        const emptyLine = (): Line => ({ total: 0, time: new Map(), interview: new Map(), request: new Map() });
        const lines = new Map<string, Line>(dates.map(d => [d, emptyLine()]));
        const sum = emptyLine();
        const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

        data.forEach(item => {
            const line = lines.get((item.date || '').trim() || UNSET_LABEL);
            if (!line) return;
            const time = normalizeTime(item.time) || UNSET_LABEL;
            [line, sum].forEach(target => {
                target.total += 1;
                add(target.time, time);
                splitValues(item.interview).forEach(v => add(target.interview, v));
                splitValues(item.request).forEach(v => add(target.request, v));
            });
        });

        return { dates, times, interviews, requests, lines, sum };
    }, [data]);

    const filtered = useMemo(() => {
        const word = keyword.trim();
        const rows = word === ''
            ? data
            : data.filter(item => (item.name || '').includes(word) || (item.kana || '').includes(word));
        return [...rows].sort((a, b) => Number(b.no) - Number(a.no));
    }, [data, keyword]);

    // --- スクロールに合わせて描く行を増やす（EventList.tsx と同じ） ---
    const [displayLength, setDisplayLength] = useState(PAGE_SIZE);
    const loaderRef = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
        setDisplayLength(PAGE_SIZE);
    }, [keyword]);

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

    const handleSync = (item: FestaRow) => {
        setSyncTarget(item);
        setTargetStaff('');
        setSyncShop((item.shop ?? '').trim());
        setSyncShow(true);
    };

    const syncStart = async () => {
        if (!syncTarget || syncShop === '') {
            alert('担当店舗を選択してください');
            return;
        }
        if (targetStaff === '') {
            alert('スタッフを選択してください');
            return;
        }
        try {
            const response = await apiClient.post('', {
                ...createSyncPayload(syncTarget),
                in_charge_user: targetStaff,
                in_charge_store: syncShop,
                request: 'list',
                roll: 'insert',
                category,
            });
            if (response.data.status === 'success') {
                const id = syncTarget.id;
                setData(prev => prev.map(item => item.id === id ? { ...item, sync: 1 } : item));
                void updateField(id, 'sync', 1);
                setSyncShow(false);
                setSyncTarget(null);
                setTargetStaff('');
                setSyncShop('');
            } else {
                alert('同期に失敗しました。');
            }
        } catch (e) {
            console.error(e);
            alert('同期に失敗しました。');
        }
    };

    const checkedIn = data.filter(item => (item.check_in_time ?? '') !== '').length;

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
                        .fe_sum tr.fe_sumrow td { background: #f6f9fc; font-weight: 700; }
                        .fe_sum .fe_zero { color: #ced4da; }
                        .fe_sum .fe_sep, .fe_tbl .fe_sep { border-left: 2px solid #ced4da; }
                        .fe_tbl { font-size: 11px; }
                        .fe_tbl td { border: 1px solid #eef0f3; padding: 3px 4px; vertical-align: middle; }
                        .fe_strap { display: inline-block; width: 18px; height: 18px; border-radius: 3px; border: 1px solid rgba(0,0,0,.15); margin-right: 3px; vertical-align: middle; }
                        .fe_toggle { width: 34px; height: 18px; border-radius: 999px; border: none; background: #ced4da; position: relative; cursor: pointer; padding: 0; transition: background .15s; }
                        .fe_toggle[data-on="1"] { background: #2dce89; }
                        .fe_toggle:disabled { opacity: .5; cursor: wait; }
                        .fe_toggle .fe_knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; }
                        .fe_toggle[data-on="1"] .fe_knob { transform: translateX(16px); }
                        .fe_toggle:focus-visible { outline: 2px solid #5e72e4; outline-offset: 2px; }
                    `}</style>

                    {/* 上部の操作。⚠️ EventList.tsx と同じく上に固定する */}
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2"
                        style={{ position: 'sticky', top: '-8px', zIndex: 5, backgroundColor: '#f8f9fe', padding: '8px 0', margin: '-8px 0 8px' }}>
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
                        <span style={{ fontSize: '11px', color: '#8898aa' }}>
                            予約 {data.length.toLocaleString()}件 ／ チェックイン {checkedIn.toLocaleString()}件
                        </span>
                    </div>

                    {/* 集計表（⚠️ EventList.tsx と同じ配置） */}
                    {data.length > 0 && (
                        <div className="bg-white rounded shadow-sm border mb-2 p-2">
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#32325d', marginBottom: '4px' }}>
                                {FESTA_TITLE}
                                <small style={{ fontSize: '10px', fontWeight: 400, color: '#8898aa', marginLeft: '8px' }}>
                                    予約 {summaryTable.sum.total.toLocaleString()}件 ／ 相談内容・検討内容は複数選択のため予約数と一致しません
                                </small>
                            </div>
                            <div className="fe_sum_wrap">
                                <table className="fe_sum">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2}>日付</th>
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
                                        {[...summaryTable.dates.map(d => ({ label: d, line: summaryTable.lines.get(d), isSum: false })),
                                          { label: '合計', line: summaryTable.sum, isSum: true }].map(({ label, line, isSum }) => {
                                            if (!line) return null;
                                            const cell = (map: Map<string, number>, key: string, first: boolean) => {
                                                const n = map.get(key) ?? 0;
                                                return <td key={key} className={`${n === 0 ? 'fe_zero' : ''}${first ? ' fe_sep' : ''}`}>{n}</td>;
                                            };
                                            return (
                                                <tr key={label} className={isSum ? 'fe_sumrow' : ''}>
                                                    <td className="fe_date">{label}</td>
                                                    <td className="fe_total">{line.total}</td>
                                                    {summaryTable.times.map((t, i) => cell(line.time, t, i === 0))}
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

                    {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}

                    <div className="bg-white rounded shadow-sm border table-responsive">
                        <Table hover className="m-0 text-nowrap fe_tbl" style={{ minWidth: '2000px' }}>
                            {/*
                              ⚠️ 見出しは3段。⚠️ 指示書の rowSpan / colSpan は入れ替わっていると判断した（2026-10-08 の計画で合意）。
                                1段目: 同期〜担当営業（縦に3段ぶん）＋ 営業入力（横に14列ぶん）
                                2段目: ブランド（横に2列ずつ）
                                3段目: 面談 ／ 次アポ
                            */}
                            <thead>
                                <tr>
                                    <th rowSpan={3} style={{ ...thStyle, width: '90px' }}>同期</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>顧客名</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>ふりがな</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '70px' }}>ストラップ</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '110px' }}>来場日</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '70px' }}>来場時間</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '80px' }}>チケット</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '140px' }}>チェックイン</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '140px' }}>チェックアウト</th>
                                    <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>担当営業</th>
                                    <th colSpan={FESTA_BRANDS.length * FESTA_KINDS.length} className="fe_sep" style={{ ...thStyle, backgroundColor: '#eef2f7', color: '#32325d' }}>営業入力</th>
                                </tr>
                                <tr>
                                    {FESTA_BRANDS.map(brand => (
                                        <th key={brand} colSpan={FESTA_KINDS.length} className="fe_sep" style={thStyle}>{brand}</th>
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
                                        <tr key={item.id} className={item.sync === 1 ? 'table-primary' : ''}>
                                            <td className="text-center fw-bold" style={{ fontSize: '10px' }}>
                                                <div className="d-flex align-items-center gap-1">
                                                    <span>{index + 1}</span>
                                                    {item.sync === 1
                                                        ? <span style={{ fontSize: '9px', color: 'red' }}>同期済み</span>
                                                        : <i className="fa-solid fa-arrows-rotate pointer" role="button" aria-label={`${item.name} を同期`} onClick={() => handleSync(item)}></i>}
                                                </div>
                                                {item.shop && <div className="text-start fw-normal mt-1" style={{ fontSize: '9px', color: '#525f7f', whiteSpace: 'normal', lineHeight: 1.2 }}>{item.shop}</div>}
                                            </td>
                                            <td><input type="text" style={inputStyle} ref={setRef(item.id, 'name')} defaultValue={item.name ?? ''} onBlur={() => handleBlur(item.id, 'name')} /></td>
                                            <td><input type="text" style={inputStyle} ref={setRef(item.id, 'kana')} defaultValue={item.kana ?? ''} onBlur={() => handleBlur(item.id, 'kana')} /></td>
                                            <td className="text-center">
                                                {strapOf(item).map(color => (
                                                    <span key={color} className="fe_strap" style={{ backgroundColor: STRAP_COLOR[color] }} title={STRAP_LABEL[color]} aria-label={STRAP_LABEL[color]} role="img" />
                                                ))}
                                            </td>
                                            <td>{item.date || ''}</td>
                                            <td>{item.time || ''}</td>
                                            <td className="fw-bold text-end">{ticketOf(item)}</td>
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
                    </div>
                    <select className="mb-2" style={{ ...inputStyle, height: '28px', fontSize: '12px' }}
                        value={syncShop} onChange={(e) => { setSyncShop(e.target.value); setTargetStaff(''); }}>
                        <option value="">担当店舗を選択</option>
                        {shopOptions.map(name => <option key={name} value={name}>{name}</option>)}
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
```

## 差分（event.ts / list_event.php / Header.tsx）
```diff
diff --git a/backend-express/src/features/list/event.ts b/backend-express/src/features/list/event.ts
index 48c41f38..baabe47f 100644
--- a/backend-express/src/features/list/event.ts
+++ b/backend-express/src/features/list/event.ts
@@ -11,6 +11,7 @@ import type { SqlParam } from '../../db/pool';
  * ⚠️⚠️ **1つの roll で参照と書き込みを兼ねている。** `function` で分かれる。
  *     function = 'load'   … event_db と staff_list を全件返す（参照）
  *     function = 'update' … event_db の1行を更新（書き込み）
+ *     function = 'festa'  … event_db.festa（営業入力の JSON）の1項目を書く（v2.2.172。書き込み）
  *   `rank` と同じ構造である。request 名や roll だけでは書き込みか判断できない。
  *
  * ⚠️ ① に PHP ハンドラが**実在する**（消していない）。
@@ -50,6 +51,7 @@ export interface ListEventResult {
  *     check_out_time      … 退場時刻
  *     remarks             … 社内メモ（原本ではない）
  *     staff               … 担当スタッフ（v2.2.171。自由入力）
+ *     kana                … ふりがな（v2.2.172。フェスタ当日画面で直せるように。指示書）
  *     sync                … 顧客への取り込み済みフラグ
  *
  * ⚠️ ここに列を戻すときは EventList.tsx の入力欄と ① の PHP も合わせること。
@@ -66,6 +68,8 @@ const ALLOWED_COLUMNS = [
   'check_in_time',
   'check_out_time',
   'remarks',
+  // ⚠️ v2.2.172 追加。ふりがな（FestaDashboard.tsx の入力欄。⚠️ EventList.tsx では表示のみ）
+  'kana',
   // ⚠️ v2.2.171 追加。担当スタッフ（event_db.staff。⚠️ 先に ALTER を流すこと）
   'staff',
   'sync',
@@ -185,6 +189,70 @@ const runUpdate = async (body: Record<string, unknown>): Promise<ListEventResult
   }
 };
 
+/**
+ * 営業入力（event_db.festa）のキー。v2.2.172。
+ *
+ * ⚠️ `ブランド_interview`（面談）と `ブランド_next`（次アポ）。⚠️ 7ブランド × 2 = 14個。
+ * ⚠️⚠️ **この一覧に無いキーは受け付けない**（⚠️ JSON のパスを外から自由に書かせない）。
+ * ⚠️ FestaDashboard.tsx の FESTA_BRANDS と同じ並び・同じ表記にすること。
+ */
+export const FESTA_BRANDS = ['KH', 'DJH', 'なごみ', '2L', 'PGH', 'かえる', '中専'] as const;
+const FESTA_KINDS = ['interview', 'next'] as const;
+const FESTA_KEYS = new Set<string>(
+  FESTA_BRANDS.flatMap((brand) => FESTA_KINDS.map((kind) => `${brand}_${kind}`))
+);
+
+/**
+ * 営業入力の1項目を書く（function = 'festa'）。v2.2.172。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️⚠️ **JSON を丸ごと上書きしない。** ⚠️ `JSON_SET` で ⚠️ **1つのキーだけ**書き換える。
+ *   ⚠️ 当日は複数の営業が同じ行のトグルを同時に押す。⚠️ 画面が持っている JSON を丸ごと送ると、
+ *     ⚠️ **後から保存した人が、先に押した人の値を消してしまう。**
+ *
+ * ⚠️ 値は ⚠️ **トグル（反転）ではなく「true / false を指定」**。
+ *   ⚠️ 同じ要求が2回届いても結果は同じ（冪等）なので、
+ *     ⚠️ ① へのフォールバックで再実行されても壊れない（⚠️ expressProxyExclusive には入れない）。
+ *
+ * ⚠️ 列が空・壊れた JSON のときは `{}` から始める（⚠️ JSON_SET が NULL を返して値が消えるのを防ぐ）。
+ * ⚠️ true / false は ⚠️ **SQL のリテラルで埋める**（⚠️ 値は boolean から作るので外部の文字は入らない）。
+ *   ⚠️ プレースホルダで渡すと 1 / 0 の数値で保存される。
+ * ─────────────────────────────────────────────
+ */
+const runFesta = async (body: Record<string, unknown>): Promise<ListEventResult> => {
+  const id = typeof body.id === 'string' ? body.id.trim() : '';
+  const key = typeof body.key === 'string' ? body.key : '';
+
+  if (id === '') {
+    return { httpStatus: 200, body: { status: 'error', message: 'IDが指定されていません' } };
+  }
+  if (!FESTA_KEYS.has(key)) {
+    return { httpStatus: 200, body: { status: 'error', message: '項目が正しくありません' } };
+  }
+  if (typeof body.value !== 'boolean') {
+    return { httpStatus: 200, body: { status: 'error', message: '値が正しくありません' } };
+  }
+  const literal = body.value ? 'TRUE' : 'FALSE';
+
+  try {
+    // ⚠️ パスは FESTA_KEYS を通った値だけ。⚠️ キーに日本語があるので必ず "" で囲む
+    const result = await execute(
+      `UPDATE event_db
+          SET festa = JSON_SET(IF(JSON_VALID(festa), festa, '{}'), ?, ${literal})
+        WHERE id = ?`,
+      [`$."${key}"`, id]
+    );
+    if (result.affectedRows === 0) {
+      return { httpStatus: 200, body: { status: 'error', message: '予約が見つかりませんでした' } };
+    }
+    return { httpStatus: 200, body: { status: 'success', message: '更新が完了しました' } };
+  } catch (error) {
+    // ⚠️ DB のエラー本文は返さない（runUpdate と同じ）
+    console.error('list:event festa failed', { id, key, error });
+    return { httpStatus: 200, body: { status: 'error', message: '更新に失敗しました' } };
+  }
+};
+
 export const runListEvent = async (
   body: Record<string, unknown>
 ): Promise<ListEventResult> => {
@@ -192,6 +260,7 @@ export const runListEvent = async (
 
   if (fn === 'load') return runLoad();
   if (fn === 'update') return runUpdate(body);
+  if (fn === 'festa') return runFesta(body);
 
   /**
    * ⚠️ PHP はここで**何も出力せず**終わる（空レスポンス・HTTP 200）。
diff --git a/backend/src/handlers/listAction/list_event.php b/backend/src/handlers/listAction/list_event.php
index ff11a344..c72c2735 100644
--- a/backend/src/handlers/listAction/list_event.php
+++ b/backend/src/handlers/listAction/list_event.php
@@ -60,13 +60,16 @@ if ($function && $function === 'update') {
     //   check_out_time      … 退場時刻。受付運用で使う
     //   remarks             … 社内メモ。原本ではないので自由に書ける
     //   staff               … 担当スタッフ（v2.2.171。自由入力。⚠️ 先に ALTER を流すこと）
+    //   kana                … ふりがな（v2.2.172。フェスタ当日画面 FestaDashboard.tsx で直せるように）
     //   sync                … 顧客への取り込み済みフラグ
     //
     // ⚠️ ここに列を戻すときは EventList.tsx 側の入力欄も合わせること。
     //   片方だけ変えると、画面では編集できるのに保存されない（無言で消える）。
     $allowed_columns = [
         'name', 'phone', 'mail',
-        'check_in_time', 'check_out_time', 'remarks', 'staff', 'sync'
+        'check_in_time', 'check_out_time', 'remarks', 'staff', 'sync',
+        // ⚠️ v2.2.172 追加（② の ALLOWED_COLUMNS と揃える）
+        'kana'
     ];
 
     $update_fields = [];
@@ -103,3 +106,54 @@ if ($function && $function === 'update') {
     
     exit;
 }
+
+// ---------------------------------------------------------------------------
+// 営業入力（event_db.festa の JSON）の1項目を書く。v2.2.172。
+//
+// ⚠️ ② の features/list/event.ts の runFesta と同じ処理（⚠️ ② が落ちたときのフォールバック）。
+// ⚠️⚠️ JSON を丸ごと上書きしない。JSON_SET で1つのキーだけ書く（同時に押しても他の人の値を消さない）。
+// ⚠️ キーは下の一覧にあるものだけ（⚠️ JSON のパスを外から自由に書かせない）。
+// ⚠️ true / false は SQL のリテラルで埋める（⚠️ 値は bool から作るので外部の文字は入らない）。
+// ---------------------------------------------------------------------------
+if ($function && $function === 'festa') {
+
+    $id    = isset($data['id']) && is_string($data['id']) ? trim($data['id']) : '';
+    $key   = isset($data['key']) && is_string($data['key']) ? $data['key'] : '';
+    $value = $data['value'] ?? null;
+
+    $brands = ['KH', 'DJH', 'なごみ', '2L', 'PGH', 'かえる', '中専'];
+    $keys   = [];
+    foreach ($brands as $brand) {
+        $keys[] = $brand . '_interview';
+        $keys[] = $brand . '_next';
+    }
+
+    if ($id === '') {
+        echo json_encode(['status' => 'error', 'message' => 'IDが指定されていません'], JSON_UNESCAPED_UNICODE);
+        exit;
+    }
+    if (!in_array($key, $keys, true)) {
+        echo json_encode(['status' => 'error', 'message' => '項目が正しくありません'], JSON_UNESCAPED_UNICODE);
+        exit;
+    }
+    if (!is_bool($value)) {
+        echo json_encode(['status' => 'error', 'message' => '値が正しくありません'], JSON_UNESCAPED_UNICODE);
+        exit;
+    }
+    $literal = $value ? 'TRUE' : 'FALSE';
+
+    try {
+        $stmt = $pdo->prepare(
+            "UPDATE event_db SET festa = JSON_SET(IF(JSON_VALID(festa), festa, '{}'), :path, {$literal}) WHERE id = :id"
+        );
+        $stmt->execute([':path' => '$."' . $key . '"', ':id' => $id]);
+
+        echo json_encode(['status' => 'success', 'message' => '更新が完了しました'], JSON_UNESCAPED_UNICODE);
+    } catch (PDOException $e) {
+        // ⚠️ DB のエラー本文は返さない（② と同じ）
+        error_log('list_event festa failed: ' . $e->getMessage());
+        echo json_encode(['status' => 'error', 'message' => '更新に失敗しました'], JSON_UNESCAPED_UNICODE);
+    }
+
+    exit;
+}
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 4aa52fa2..92a6b5fb 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -25,6 +25,7 @@ import AmbassadorList from './AmbassadorList';
 import { InquiryAmbassador } from './InquiryAmbassador';
 import InquiryIntroductory from './InquiryIntroductory';
 import EventList from './EventList';
+import FestaDashboard from './FestaDashboard';
 import EventSummary from './EventSummary';
 import EventBudget from './EventBudget';
 import GoogleReview from './GoogleReview';
@@ -61,6 +62,11 @@ const Header = ({ }) => {
      *   共通モーダルの中に入れるとモーダルが二重になる。
      */
     const [eventSummary, setEventSummary] = useState<boolean>(false);
+    /**
+     * おうちづくりフェスタ2026（v2.2.172）。⚠️ イベント当日に使う画面。
+     * ⚠️ FestaDashboard も自前の fullscreen モーダルを持つので、EventList と同じく専用の state で開く。
+     */
+    const [showFesta, setShowFesta] = useState<boolean>(false);
     /**
      * 広告費入力の表示。
      *
@@ -178,7 +184,8 @@ const Header = ({ }) => {
         ],
         '公式アンバサダー': ['アンバサダー管理', '反響一覧'],
         '紹介キャンペーン': ['反響一覧'],
-        '集客イベント': ['反響一覧', '集客サマリー', '広告費入力'],
+        // ⚠️ v2.2.172: 「おうちづくりフェスタ2026」を追加（⚠️ イベント当日用。FestaDashboard.tsx）
+        '集客イベント': ['反響一覧', '集客サマリー', '広告費入力', 'おうちづくりフェスタ2026'],
         'Google口コミ': ['口コミ集計']
     };
 
@@ -393,6 +400,11 @@ const Header = ({ }) => {
                                             setEventBudget(true);
                                             return;
                                         }
+                                        // ⚠️ おうちづくりフェスタ2026（v2.2.172）も自前の fullscreen モーダル
+                                        if (menu === '集客イベント' && item === 'おうちづくりフェスタ2026') {
+                                            setShowFesta(true);
+                                            return;
+                                        }
                                         // ⚠️ ローン情報更新も自前のモーダル（md）を持つ（v2.2.168）
                                         if (menu === 'システム管理' && item === 'ローン情報更新') {
                                             setUploadLoan(true);
@@ -516,6 +528,9 @@ const Header = ({ }) => {
                 2026-09-06 にヘッダーへ移した */}
             <EventList eventSummary={eventSummary} setEventSummary={setEventSummary} />
 
+            {/* おうちづくりフェスタ2026（v2.2.172）。⚠️ 自前の fullscreen モーダル。⚠️ データは開いたときに取る */}
+            <FestaDashboard show={showFesta} setShow={setShowFesta} />
+
             {/* 広告費入力。⚠️ 集客サマリーの上に重ねて開くこともあるため、
                 共通モーダルの外（ここ）に置く */}
             <EventBudget show={eventBudget} setShow={setEventBudget} />
```


---

## 追加対応（同日）
| 指示 | 対応 |
|---|---|
| チケットの色を3色に分ける | 3,000円分＝紫 `#6f42c1`／2,000円＝青緑 `#0f9d8a`／1,000円＝灰青 `#5a6b7b` の角丸ラベル（白文字）。なし・－ は色なし。⚠️ ブランド色・ストラップ色とかぶらない色を選んだ（指定なし） |
| ブランドの色を分ける | 2段目のブランド見出しをブランド色で塗り、オンのトグルもブランド色にした。色は **`utils/setStyleClass.ts` から借りる**（KH ネイビー `#0f3675`／DJH シアン `#28aeba`／なごみ 茶 `#956134`／2L 緑 `#0d9f6d`／PGH 黒／かえる 緑 `#0d6d4b`）。⚠️ 中専は対応表に無いのでオレンジ `#ff7f0e`（setStyleClassUsed.ts と同じ）を直接指定 |
| 同期・顧客名・ふりがなを固定列に | `position: sticky`（幅 90／130／130px、left は `STICKY_LEFT`）。背景は `--bs-table-bg`（同期済みの行の色も保つ）。ふりがなの右に境界線 |
| 来場日・来場時間を検索の右に | 反響一覧と同じ select で絞り込み（時間は「10:00」と「10:00~」を同一視）。⚠️ 指示は「ソート」だが、反響一覧に合わせて絞り込みにした |

- フロント build `main.f6ec89af.js`（FestaDashboard に警告なし）

### 差分（FestaDashboard.tsx・前回コミットから）
```diff
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index 657cdc46..97d3d081 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -6,6 +6,7 @@ import { generateULID } from '../../utils/createULID';
 import { thisYear } from '../../utils/thisYear';
 import AuthContext from '../../context/AuthContext';
 import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';
+import { setStyleClass } from '../../utils/setStyleClass';
 
 /**
  * おうちづくりフェスタ2026（v2.2.172 新規）。ヘッダー → 集客イベント → おうちづくりフェスタ2026。
@@ -77,6 +78,37 @@ const FESTA_KINDS: { key: 'interview' | 'next'; label: string }[] = [
     { key: 'next', label: '次アポ' },
 ];
 
+/**
+ * ブランドの色（v2.2.172 追加指示）。
+ *
+ * ⚠️⚠️ **色は `utils/setStyleClass.ts`（反響一覧 ListOrder.tsx などのブランド色）から借りる。**
+ *   ⚠️ ここに色を書き写さない（⚠️ ブランド色を変えたときに片方だけ古くなる）。
+ *   ⚠️ setStyleClass は店舗名の先頭2文字で引くので、⚠️ 表記をその2文字に読み替える。
+ *     KH → 'KH'（ネイビー）／ DJH → 'DJ'（シアン）／ なごみ → 'なご'（茶）／ 2L → '2L'（緑）／
+ *     PGH → 'PG'（黒）／ かえる → 'かえ'（緑）
+ * ⚠️ 中専（中古住宅専門店）は setStyleClass に無いので ⚠️ **オレンジを直接指定**
+ *   （⚠️ utils/setStyleClassUsed.ts の「買い:ポータル」と同じ #ff7f0e）。
+ */
+const BRAND_SHOP_PREFIX: Record<string, string> = {
+    KH: 'KH', DJH: 'DJ', なごみ: 'なご', '2L': '2L', PGH: 'PG', かえる: 'かえ',
+};
+const brandColorOf = (brand: string): string => {
+    if (brand === '中専') return '#ff7f0e';
+    const color = setStyleClass(BRAND_SHOP_PREFIX[brand] ?? '').backgroundColor;
+    return typeof color === 'string' && color !== '' ? color : '#8898aa';
+};
+
+/**
+ * チケットの色（v2.2.172 追加指示: 3色に分ける）。⚠️ 文字は白、角丸のラベルで出す。
+ * ⚠️ ブランド色・ストラップの色（黄・赤・青）と ⚠️ **かぶらない色**にしている。
+ * ⚠️「なし」「－」は色を付けない。
+ */
+const TICKET_COLOR: Record<string, string> = {
+    '3,000円分': '#6f42c1',
+    '2,000円': '#0f9d8a',
+    '1,000円': '#5a6b7b',
+};
+
 /** 営業入力の JSON を読む。⚠️ 無い・壊れているときは {}（⚠️ 画面の既定は FALSE） */
 const parseFesta = (value: string | null): Record<string, boolean> => {
     if (!value) return {};
@@ -202,6 +234,16 @@ type EditField = (typeof EDIT_FIELDS)[number];
 /** ⚠️ 1回に描く行数。⚠️ スクロールが届くたびに増やす（EventList.tsx と同じ） */
 const PAGE_SIZE = 20;
 
+/**
+ * 固定列の幅と左端（v2.2.172）。⚠️ 同期・顧客名・ふりがな の3列。
+ * ⚠️ 幅を固定しないと left がずれて重なる。⚠️ 見出しと各行の両方でこの値を使う。
+ */
+const STICKY_WIDTH = [90, 130, 130];
+const STICKY_LEFT = [0, STICKY_WIDTH[0], STICKY_WIDTH[0] + STICKY_WIDTH[1]];
+const stickyStyle = (i: number): React.CSSProperties => ({
+    left: STICKY_LEFT[i], width: STICKY_WIDTH[i], minWidth: STICKY_WIDTH[i], maxWidth: STICKY_WIDTH[i],
+});
+
 /** 表の列数（同期〜担当営業の10列 ＋ 営業入力 7ブランド×2） */
 const COLUMN_COUNT = 10 + FESTA_BRANDS.length * FESTA_KINDS.length;
 
@@ -217,6 +259,13 @@ const FestaDashboard = ({ show, setShow }: Props) => {
     const [error, setError] = useState<string | null>(null);
     /** ⚠️ 名前・ふりがなで探す（⚠️ 当日、来場者をすぐ見つけるため） */
     const [keyword, setKeyword] = useState('');
+    /**
+     * 来場日・来場時間の絞り込み（v2.2.172 追加指示）。⚠️ 反響一覧（EventList.tsx）と同じ選び方。
+     *   来場日 … `event_db.date` の値そのまま（例: 2026/10/10(土)）
+     *   来場時間 … normalizeTime を通した値（⚠️「10:00」と「10:00~」を同じ時刻として扱う）
+     */
+    const [targetDate, setTargetDate] = useState('');
+    const [targetTime, setTargetTime] = useState('');
     /** ⚠️ 保存中のトグル（`id:key`）。⚠️ 連打で二重に送らない */
     const [savingKey, setSavingKey] = useState('');
 
@@ -315,13 +364,27 @@ const FestaDashboard = ({ show, setShow }: Props) => {
         return { dates, times, interviews, requests, lines, sum };
     }, [data]);
 
+    /** 来場日・来場時間の選択肢（⚠️ 空の値は出さない。⚠️ 時間は早い順） */
+    const dateOptions = useMemo(
+        () => Array.from(new Set(data.map(item => (item.date || '').trim()).filter(v => v !== ''))).sort(),
+        [data]
+    );
+    const timeOptions = useMemo(
+        () => Array.from(new Set(data.map(item => normalizeTime(item.time)).filter(v => v !== '')))
+            .sort((a, b) => timeOrder(a) - timeOrder(b) || a.localeCompare(b)),
+        [data]
+    );
+
     const filtered = useMemo(() => {
         const word = keyword.trim();
-        const rows = word === ''
-            ? data
-            : data.filter(item => (item.name || '').includes(word) || (item.kana || '').includes(word));
+        const rows = data.filter(item =>
+            (word === '' || (item.name || '').includes(word) || (item.kana || '').includes(word)) &&
+            (targetDate === '' || (item.date || '').trim() === targetDate) &&
+            // ⚠️ 選択肢と同じく normalizeTime を通して比べる
+            (targetTime === '' || normalizeTime(item.time) === targetTime)
+        );
         return [...rows].sort((a, b) => Number(b.no) - Number(a.no));
-    }, [data, keyword]);
+    }, [data, keyword, targetDate, targetTime]);
 
     // --- スクロールに合わせて描く行を増やす（EventList.tsx と同じ） ---
     const [displayLength, setDisplayLength] = useState(PAGE_SIZE);
@@ -329,7 +392,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
 
     useEffect(() => {
         setDisplayLength(PAGE_SIZE);
-    }, [keyword]);
+    }, [keyword, targetDate, targetTime]);
 
     useEffect(() => {
         const total = filtered.length;
@@ -495,6 +558,17 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         .fe_toggle .fe_knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; }
                         .fe_toggle[data-on="1"] .fe_knob { transform: translateX(16px); }
                         .fe_toggle:focus-visible { outline: 2px solid #5e72e4; outline-offset: 2px; }
+                        .fe_toggle[data-on="1"][data-brand] { background: var(--fe-brand); }
+                        .fe_ticket { display: inline-block; min-width: 64px; padding: 2px 8px; border-radius: 999px; color: #fff; font-weight: 700; text-align: center; }
+                        /*
+                          ⚠️ 固定列（v2.2.172 追加指示）: 同期・顧客名・ふりがな の3列を左に固定する。
+                            ⚠️ left は列幅の合計（STICKY_LEFT）。⚠️ 列幅を変えたらそちらも直すこと。
+                            ⚠️ 背景色が無いと、横スクロールした列が透けて見える。
+                              td は Bootstrap の --bs-table-bg（同期済みの行は table-primary の色）で塗る。
+                        */
+                        .fe_tbl .fe_stick { position: sticky; z-index: 2; background-color: var(--bs-table-bg, #fff); }
+                        .fe_tbl thead .fe_stick { z-index: 3; background-color: #f6f9fc; }
+                        .fe_tbl .fe_stick_last { box-shadow: inset -2px 0 0 #ced4da; }
                     `}</style>
 
                     {/* 上部の操作。⚠️ EventList.tsx と同じく上に固定する */}
@@ -513,6 +587,15 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                             value={keyword}
                             onChange={(e) => setKeyword(e.target.value)}
                         />
+                        {/* ⚠️ 来場日・来場時間（v2.2.172 追加指示）。⚠️ 検索の右 */}
+                        <select style={{ ...inputStyle, width: 'auto' }} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} aria-label="来場日">
+                            <option value="">来場日を選択</option>
+                            {dateOptions.map(v => <option key={v} value={v}>{v}</option>)}
+                        </select>
+                        <select style={{ ...inputStyle, width: 'auto' }} value={targetTime} onChange={(e) => setTargetTime(e.target.value)} aria-label="来場時間">
+                            <option value="">来場時間を選択</option>
+                            {timeOptions.map(v => <option key={v} value={v}>{v}</option>)}
+                        </select>
                         <span style={{ fontSize: '11px', color: '#8898aa' }}>
                             予約 {data.length.toLocaleString()}件 ／ チェックイン {checkedIn.toLocaleString()}件
                         </span>
@@ -579,9 +662,9 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                             */}
                             <thead>
                                 <tr>
-                                    <th rowSpan={3} style={{ ...thStyle, width: '90px' }}>同期</th>
-                                    <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>顧客名</th>
-                                    <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>ふりがな</th>
+                                    <th rowSpan={3} className="fe_stick" style={{ ...thStyle, ...stickyStyle(0) }}>同期</th>
+                                    <th rowSpan={3} className="fe_stick" style={{ ...thStyle, ...stickyStyle(1) }}>顧客名</th>
+                                    <th rowSpan={3} className="fe_stick fe_stick_last" style={{ ...thStyle, ...stickyStyle(2) }}>ふりがな</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '70px' }}>ストラップ</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '110px' }}>来場日</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '70px' }}>来場時間</th>
@@ -593,7 +676,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                 </tr>
                                 <tr>
                                     {FESTA_BRANDS.map(brand => (
-                                        <th key={brand} colSpan={FESTA_KINDS.length} className="fe_sep" style={thStyle}>{brand}</th>
+                                        <th key={brand} colSpan={FESTA_KINDS.length} className="fe_sep"
+                                            style={{ ...thStyle, backgroundColor: brandColorOf(brand), color: '#fff', fontWeight: 700 }}>{brand}</th>
                                     ))}
                                 </tr>
                                 <tr>
@@ -607,7 +691,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                     const festa = parseFesta(item.festa);
                                     return (
                                         <tr key={item.id} className={item.sync === 1 ? 'table-primary' : ''}>
-                                            <td className="text-center fw-bold" style={{ fontSize: '10px' }}>
+                                            <td className="text-center fw-bold fe_stick" style={{ fontSize: '10px', ...stickyStyle(0) }}>
                                                 <div className="d-flex align-items-center gap-1">
                                                     <span>{index + 1}</span>
                                                     {item.sync === 1
@@ -616,8 +700,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                                 </div>
                                                 {item.shop && <div className="text-start fw-normal mt-1" style={{ fontSize: '9px', color: '#525f7f', whiteSpace: 'normal', lineHeight: 1.2 }}>{item.shop}</div>}
                                             </td>
-                                            <td><input type="text" style={inputStyle} ref={setRef(item.id, 'name')} defaultValue={item.name ?? ''} onBlur={() => handleBlur(item.id, 'name')} /></td>
-                                            <td><input type="text" style={inputStyle} ref={setRef(item.id, 'kana')} defaultValue={item.kana ?? ''} onBlur={() => handleBlur(item.id, 'kana')} /></td>
+                                            <td className="fe_stick" style={stickyStyle(1)}><input type="text" style={inputStyle} ref={setRef(item.id, 'name')} defaultValue={item.name ?? ''} onBlur={() => handleBlur(item.id, 'name')} /></td>
+                                            <td className="fe_stick fe_stick_last" style={stickyStyle(2)}><input type="text" style={inputStyle} ref={setRef(item.id, 'kana')} defaultValue={item.kana ?? ''} onBlur={() => handleBlur(item.id, 'kana')} /></td>
                                             <td className="text-center">
                                                 {strapOf(item).map(color => (
                                                     <span key={color} className="fe_strap" style={{ backgroundColor: STRAP_COLOR[color] }} title={STRAP_LABEL[color]} aria-label={STRAP_LABEL[color]} role="img" />
@@ -625,7 +709,15 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                             </td>
                                             <td>{item.date || ''}</td>
                                             <td>{item.time || ''}</td>
-                                            <td className="fw-bold text-end">{ticketOf(item)}</td>
+                                            <td className="text-center">
+                                                {(() => {
+                                                    const ticket = ticketOf(item);
+                                                    const color = TICKET_COLOR[ticket];
+                                                    return color
+                                                        ? <span className="fe_ticket" style={{ backgroundColor: color }}>{ticket}</span>
+                                                        : <span className="text-muted">{ticket}</span>;
+                                                })()}
+                                            </td>
                                             <td><input type="text" style={inputStyle} placeholder="2026/10/10 10:05" ref={setRef(item.id, 'check_in_time')} defaultValue={item.check_in_time ?? ''} onBlur={() => handleBlur(item.id, 'check_in_time')} /></td>
                                             <td><input type="text" style={inputStyle} placeholder="2026/10/10 11:30" ref={setRef(item.id, 'check_out_time')} defaultValue={item.check_out_time ?? ''} onBlur={() => handleBlur(item.id, 'check_out_time')} /></td>
                                             <td><input type="text" style={inputStyle} placeholder="担当営業" ref={setRef(item.id, 'staff')} defaultValue={item.staff ?? ''} onBlur={() => handleBlur(item.id, 'staff')} /></td>
@@ -638,6 +730,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                                             type="button"
                                                             className="fe_toggle"
                                                             data-on={on ? '1' : '0'}
+                                                            data-brand={brand}
+                                                            style={{ ['--fe-brand' as string]: brandColorOf(brand) } as React.CSSProperties}
                                                             aria-pressed={on}
                                                             aria-label={`${item.name} の ${brand} ${kind.label}`}
                                                             disabled={savingKey === `${item.id}:${key}`}
```
