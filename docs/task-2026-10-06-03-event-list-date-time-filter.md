# 2026-10-06-03　集客イベントの予約一覧に来場予定日・時間の絞り込み（v2.2.166）

## 依頼（ReadMeClaude.md）

- `EventList.tsx` の改修
  - state `targetDate` / `targetTime` を追加
  - イベント・店舗の select を左寄せにして **閉じる** の右へ（ps-3 等で間隔）
  - `event_db.date` のユニーク値 → **来場予定日を選択**、`event_db.time` のユニーク値 → **来場予定時間を選択**
  - 上部の **特設URLはこちら** 〜 **来場予定時間を選択** を固定
  - `event_db.shop` を同期列に表示（2行。shop が真なら rotate アイコンの下）

## 確認したこと（ユーザーの回答）

| 質問 | 回答 |
|---|---|
| 時間の「10:00」と「10:00~」 | ⚠️ **「~」を外してまとめる** |
| 来場状況（来場済み／未来場）の select | ⚠️ **来場予定時間の右に並べる**（右端から移す） |

## 調べてわかったこと（ローカル event_db）

| 列 | 値 |
|---|---|
| date | `2026/10/10(土)` 61件・`2026/10/11(日)` 55件・⚠️ **空 89件**（手入力の行） |
| time | ⚠️ **`10:00` と `10:00~` が混在**（イベントで書き方が違う）。`9:00` もある |
| shop | KH出水阿久根店 89件・NULL 116件 |

## 版の準備

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/utils/` | **version.ts** | `'2.2.166'` |
| `backend/scripts/sql/` | **2026-10-06_update_log_2.2.166.sql**（新規） | update_log に1行。⚠️ ローカルDBにも投入済み（no=262） |
| — | ブランチ | `v2.2.165` から `v2.2.166` を作成 |

## 変更したファイル

| ディレクトリ | ファイル | 追加・変更 |
|---|---|---|
| `frontend/src/components/header/` | **EventList.tsx** | 関数 `normalizeTime` `timeOrder`（新規・モジュール直下）、state `targetDate` `targetTime`、`eventRows` `dateArray` `timeArray` `changeEvent`（新規）、`filteredData`（条件追加）、表示件数を戻す useEffect の依存、上部の並びと固定、同期列の2行目 |
| `docs/` | **deploy-v2.2.166.md**（新規） | ⚠️ ① フロント＋SQL だけ |

## 判断したこと

- ⚠️ 日付・時間の選択肢は ⚠️ **選んでいるイベントの予約から作る**（⚠️ 他のイベントの日付を出さない）。
- ⚠️ イベントを選び直したら ⚠️ **日付・時間を戻す**（⚠️ 選択肢に無い値で絞り込まれ、表示と一覧が食い違うのを防ぐ）。
- ⚠️ 時間は選択肢・絞り込みの ⚠️ **両方で `normalizeTime` を通す**。⚠️ 表の表示は元の値のまま。
- ⚠️ 時間は ⚠️ **時刻として並べる**（⚠️ 文字のままだと 9:00 が最後）。
- ⚠️ 固定は `position: sticky; top: -8px`（⚠️ Modal.Body の p-2 ぶん）。⚠️ 同じ背景色で塗り、⚠️ 固定した行の上に表がのぞかないようにした。
- ⚠️ 同期列は 40px → 110px（⚠️ 店舗名を入れるため）。

## 動作確認

| 確認 | 結果 |
|---|---|
| `npm run build` | 成功（`main.0db9f532.js`）。⚠️ EventList.tsx の警告（298行目 fetchData）は以前からのもの |
| 実データの time 18通りで `normalizeTime` → 重複除去 → `timeOrder` | `9:00 10:00 10:30 11:00 11:30 12:00 12:30 13:00 13:30 14:00 14:30 15:00`（⚠️ 空は落ちる） |
| ⚠️ 画面での表示 | ⚠️ **未確認** |

## EventList.tsx（全文）

```tsx
import React, { useEffect, useState, useRef, useMemo, useContext } from 'react';
import { Table, Spinner, Alert, Modal } from 'react-bootstrap';
// ⚠️ 2026-09-06 に list/ から header/ へ移動した。listUtils は list/ に残している
//   （ListOrder / ListKaeru / ListResale も使っており、こちらへ移すと影響が広い）
import { styles, positions ,formatToYYYYMMDD} from '../list/listUtils';
import apiClient from '../../utils/apiClient';
import { generateULID } from '../../utils/createULID';
import { thisYear } from '../../utils/thisYear';
import AuthContext from '../../context/AuthContext';
import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';

/**
 * イベント予約1件。
 *
 * ⚠️ 2つの経路で作られる。
 *     1. LPのフォーム（おうちづくりフェスタ2026）→ ② Express の event_reservation
 *     2. 受付での手入力（既存の運用）
 *   `title` でイベントを区別している。
 *
 * ⚠️ **編集できるのは name / phone / mail の3つだけ**（2026-09-07）。
 *   それ以外は来場者本人が入力した原本であり、社内で書き換えると
 *   「本当は何と入力されたのか」が分からなくなる。
 *   サーバー側（listAction/list_event.php）でも同じ制限を掛けている。
 *   受付運用のための check_in_time / check_out_time / remarks は例外。
 */
type CustomerData = {
    no: string;
    id: string;
    time: string;
    date: string;
    name: string;
    /** ふりがな。⚠️ LPのフォームから届いた予約にのみ入る */
    kana: string;
    zip: string;
    address: string;
    street: string;
    phone: string;
    mail: string;
    age: string;
    adult: string;
    child: string;
    house: string;
    interview: string;
    /** マイホームのご検討。⚠️ カンマ区切り。LPのフォームから届いた予約にのみ入る */
    request: string;
    medium: string;
    area: string;
    question: string;
    /** 個人情報の取り扱いへの同意。⚠️ NULL は同意欄が無かった頃の予約 */
    agree: number | null;
    /** 予約を受け付けた日時。⚠️ 手入力で作られた行には入らない */
    reserved_at: string | null;
    status: string;
    check_in_time: string | null;
    check_out_time: string | null;
    remarks: string;
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

// ⚠️ セレクトボックスの選択肢（OPTIONS）は 2026-09-07 に削除した。
//   来場予定・世帯情報・相談内容・きっかけを編集できなくしたため使い道が無い。
//   選択肢はイベントごとに違い（LPのフォームと旧イベントで別物）、
//   固定の一覧で描くと、そのイベントにしか無い値が画面から消える。
//   復活させるなら listAction/list_event.php の $allowed_columns も戻すこと。

const brands: Record<string, string> = {
    'KH': '国分ハウジング',
    'DJ': 'デイジャストハウス',
    'なご': 'なごみ工務店',
    '2L': 'ニーエルホーム',
    'JH': 'ジャスフィーホーム',
    'FH': 'フルコミホーム',
    'PG': 'PG HOUSE'
};

/**
 * 相談意向のある来場者と判定する `interview` の値。
 *
 * ⚠️ 部分一致（includes）で判定してよい。似た値と衝突しないことを実データで確認済み。
 *   `interview` には「注文住宅の相談」「中古住宅の相談」もあるが、これらは
 *   **「住宅の相談」であって「住宅相談」を含まない**（「の」が入る）。
 *
 * ⚠️ 完全一致にはしないこと。`interview` はカンマ区切りの複数選択で、
 *   実データは「住宅相談,資金・ローン相談,キッチンカー,マルシェ,…」のように連なる。
 *
 * ⚠️ 選択肢はイベントごとに違う（LPのフォームと旧イベントで別物）。
 *   将来この文言が変わったら、ここを直すこと。
 */
const CONSULTATION_KEYWORDS = ['住宅相談', '資金・ローン相談'];

/**
 * 相談意向のある行か。**どちらか一方でも満たせば真（OR）。**
 *
 * ⚠️ AND ではない。ロジックを変えるときは注意。
 *   ローカルの実データでは `request` が入っている行が2件しか無く、
 *   その2件はどちらも `interview` 側にも該当するため、
 *   **AND と OR で件数の差が出ず、テストでは違いに気づけない。**
 *   本番では `request` 未入力でも相談内容だけで着色される行が出る。
 */
const hasConsultationIntent = (item: CustomerData): boolean => {
    const interview = item.interview || '';
    if (CONSULTATION_KEYWORDS.some(keyword => interview.includes(keyword))) return true;

    /**
     * マイホームのご検討（`request`）が入力済みか。
     * ⚠️ 空文字・NULL は「未入力」。LPのフォーム由来の予約にしか入らない。
     * ⚠️ trim している。空白だけの値は未入力として扱う
     *   （表示側も `.filter(v => v)` で空を落としており、そちらと揃える）。
     */
    return (item.request || '').trim() !== '';
};

/**
 * 行の配色。
 * inline style では .table のセル背景に負けるため Bootstrap の配色クラスを使用。
 *
 * ⚠️⚠️ **判定の順序に意味がある。先に返した色が勝つ。**
 *
 *   1. sync === 1（同期済み）が最優先。顧客取込の済み／未済は作業判断に直結するため、
 *      相談意向の色で塗り潰さないこと。
 *   2. house（賃貸／持ち家）は既存の挙動をそのまま残す。
 *   3. 相談意向は最後。⚠️ **意図的に一番弱くしている。**
 *      ここより上に置くと、既に色が付いている行の色が変わってしまう。
 *
 * ⚠️ 2 と 3 は実質ぶつからない。`house` は手入力の行にしか入らず、
 *   `interview` / `request` が埋まる LP フォーム由来の行は `house` が全件空である
 *   （2026-09-10 時点の実データで確認）。順序は将来の値の追加に対する保険。
 */
const getRowClass = (item: CustomerData) => {
    if (item.sync === 1) return 'table-primary';
    const house = item.house || '';
    if (house.includes('賃貸')) return 'table-info';
    if (house.includes('持ち家')) return 'table-warning';
    // ⚠️ 上の3色（青・水色・黄）と区別が付く薄い色にする
    if (hasConsultationIntent(item)) return 'table-success';
    return '';
};

// 顧客取込(insert)用のペイロードを生成
const createSyncPayload = (item: CustomerData): Record<string, string> => ({
    id: generateULID(),
    customer_contacts_name: item.name || '',
    full_address: `${item.address || ''}${item.street || ''}`,
    /**
     * 反響取得日。
     *
     * ⚠️⚠️ **`reserved_at`（予約を受け付けた日時）を入れる**（2026-09-28 の指示）。
     *   ⚠️ それまでは `check_in_time`（来場した日時）を入れていた。
     *   ⚠️ ⚠️ **反響取得日は「問い合わせが来た日」**なので、予約日のほうが正しい。
     *
     * ⚠️ `reserved_at` は ⚠️ **手入力で作られた行には入らない**（実測で203件中89件が空）。
     *   ⚠️ ⚠️ **空のときは従来どおり `check_in_time` を使う。**
     *     ⚠️ ここを空で入れると、⚠️ **反響一覧にも推移にも出てこない顧客**ができる。
     *
     * ⚠️ `formatToYYYYMMDD` は `YYYY/MM/DD`（0埋めあり）を返す。
     *   ⚠️⚠️ **スラッシュ区切りであること。** ハイフンだと画面の集計から漏れる。
     */
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

/**
 * 来場予定時間の表記をそろえる（v2.2.166）。
 *
 * ⚠️⚠️ **`event_db.time` は「10:00」と「10:00~」が混在している**（イベントによって書き方が違う）。
 *   ⚠️ 2026-10-06 の確認で ⚠️ **末尾の「~」を外して同じ時刻として扱う**ことにした。
 *   ⚠️ 選択肢・絞り込みの ⚠️ **両方でこの関数を通すこと**（片方だけだと選んでも出てこない）。
 * ⚠️ 全角の「〜」「～」も外す。⚠️ 表の表示は元の値のまま（⚠️ 原本は書き換えない）。
 */
const normalizeTime = (value: string | null | undefined): string =>
    String(value ?? '').trim().replace(/[~〜～]+$/, '').trim();

/**
 * 時刻の並び順（分）。
 * ⚠️ 文字のまま並べると ⚠️ **「9:00」が「14:00」より後ろ**になる。⚠️ 時刻として並べる。
 * ⚠️ 読めない値は最後に回す。
 */
const timeOrder = (value: string): number => {
    const m = value.match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
};

// 極限まで高さを削るための共通スタイル
const compactInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '2px 4px',
    fontSize: '10px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
    height: '24px',
};

const thStyle: React.CSSProperties = {
    ...styles.label,
    display: 'table-cell',
    padding: '4px 8px',
    borderBottom: '1px solid #e9ecef',
    backgroundColor: '#f6f9fc',
    color: '#8898aa',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    fontSize: '11px',
};

type Props = {
    eventSummary: boolean,
    setEventSummary: React.Dispatch<React.SetStateAction<boolean>>
}

const EventList = ({ eventSummary, setEventSummary }: Props) => {
    const { category } = useContext(AuthContext);
    const [data, setData] = useState<CustomerData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetEvent, setTargetEvent] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [isVisited, setIsVisited] = useState<number | null>(null);
    /** 来場予定日（v2.2.166）。⚠️ `event_db.date` の値そのまま（例: 2026/10/10(土)） */
    const [targetDate, setTargetDate] = useState('');
    /** 来場予定時間（v2.2.166）。⚠️ normalizeTime を通した値（例: 10:00） */
    const [targetTime, setTargetTime] = useState('');
    const [staffArray, setStaffArray] = useState<Staff[]>([]);
    // 同期(担当者選択)モーダル用の状態
    const [syncShow, setSyncShow] = useState(false);
    const [syncTarget, setSyncTarget] = useState<CustomerData | null>(null);
    const [targetStaff, setTargetStaff] = useState('');
    /**
     * ⚠️⚠️ **同期先の担当店舗**（2026-09-28 追加）。
     *   ⚠️ `event_db.shop` が空の予約があり、⚠️ **そのままでは同期できなかった。**
     *   ⚠️ ⚠️ **入っている場合もここに入れて、選び直せるようにする**（指示）。
     */
    const [syncShop, setSyncShop] = useState('');
    const [shopList, setShopList] = useState<MasterShop[]>([]);

    // ⚠️ QRコードの読み取り（受付）は 2026-09-07 にこの画面から外した。
    //   受付はスタッフが自分のスマホで来場者のQRを読み、
    //   kh-house.jp/festa/reservation/?id=... を開いて行う運用に変えたため。
    //   スマホではヘッダーのメニューが出ないので、この画面はそもそも開けない。
    //   サーバー側の実装は backend-express/src/features/event/checkin.ts。
    const rowRefs = useRef<{ [key: string]: { [field: string]: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null } }>({});

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // キャッシュバスターを残しつつ、最新データを取得
            const payload = {
                request: 'list',
                roll: 'event',
                function: 'load',
                category,
                _t: Date.now()
            };
            const response = await apiClient.post('', payload);
            setData(response.data.summary);
            const positionIndex = (position: string) => {
                const index = positions.indexOf(position);
                return index === -1 ? positions.length : index;
            };
            const responseStaff = response.data.staff
                .filter((s: Staff) => s.period === String(thisYear) && Number(s.rank) === 1)
                .sort((a: Staff, b: Staff) => positionIndex(a.position) - positionIndex(b.position));
            setStaffArray(responseStaff);
            // ⚠️ 並び替えは下の shopOptions で行う。ここでは受け取るだけ
            setShopList(response.data.shop ?? []);
        } catch (err) {
            setError("データの取得に失敗しました");
            console.error(err)
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventSummary) {
            fetchData();
        }
    }, [eventSummary]);

    // ==========================================
    // 💡 追加: 外部からデータが再取得された際に、
    // rowRefs を使って強制的に画面の DOM (value) を上書き同期する
    // ==========================================
    useEffect(() => {
        data.forEach(item => {
            const refs = rowRefs.current[item.id];
            if (!refs) return;

            // ⚠️ 入力欄として描画している項目だけを列挙すること。
            //   表示のみの項目を書くと ref が無く、毎回空振りする
            const fields: (keyof CustomerData)[] = [
                'name', 'phone', 'mail',
                'check_in_time', 'check_out_time', 'remarks'
            ];

            fields.forEach(field => {
                const el = refs[field];
                if (el) {
                    const newValue = item[field] || '';
                    if (el.value !== String(newValue)) {
                        el.value = String(newValue);
                    }
                }
            });
        });
    }, [data]); // dataが更新されるたびに発火

    // ==========================================
    // 取得データから絞り込み用の選択肢(ユニーク値)を生成
    // ==========================================
    const eventArray = useMemo(() => Array.from(new Set(data.map(item => item.title).filter(value => !!value))), [data]);

    const shopArray = useMemo(() => Array.from(new Set(data.map(item => item.shop).filter(value => !!value))), [data]);

    /**
     * 来場予定日・時間の選択肢（v2.2.166）。
     *
     * ⚠️ ⚠️ **選んでいるイベントの予約から作る。** ⚠️ 他のイベントにしか無い日付・時間を出さない。
     *   ⚠️ イベント未選択なら全予約から。
     * ⚠️ 空の値は出さない（⚠️ 手入力の行は date が空のことがある。実測で89件）。
     * ⚠️ 日付は「YYYY/MM/DD(曜)」なので文字の順で日付順になる。⚠️ 時間は timeOrder で並べる。
     */
    const eventRows = useMemo(
        () => (targetEvent === '' ? data : data.filter(item => (item.title || '') === targetEvent)),
        [data, targetEvent]
    );
    const dateArray = useMemo(
        () => Array.from(new Set(eventRows.map(item => (item.date || '').trim()).filter(value => value !== ''))).sort(),
        [eventRows]
    );
    const timeArray = useMemo(
        () => Array.from(new Set(eventRows.map(item => normalizeTime(item.time)).filter(value => value !== '')))
            .sort((a, b) => timeOrder(a) - timeOrder(b) || a.localeCompare(b)),
        [eventRows]
    );

    /**
     * イベントを選び直したとき。
     * ⚠️⚠️ **来場予定日・時間も戻す。** ⚠️ 選択肢がイベントごとに変わるため、
     *   ⚠️ 残すと ⚠️ **選択肢に無い値で絞り込まれ、select の表示（未選択）と一覧（0件）が食い違う。**
     */
    const changeEvent = (value: string) => {
        setTargetEvent(value);
        setTargetDate('');
        setTargetTime('');
    };

    // ==========================================
    // イベント名・店舗・来場予定日時・来場状況による絞り込み
    // ==========================================
    const filteredData = useMemo(() => {
        return data.filter(item => {
            const visited = !!item.check_in_time && item.check_in_time !== '';
            return (
                (targetEvent === '' || (item.title || '') === targetEvent) &&
                (targetShop === '' || (item.shop || '') === targetShop) &&
                (targetDate === '' || (item.date || '').trim() === targetDate) &&
                // ⚠️ 選択肢と同じく normalizeTime を通して比べる（⚠️「10:00~」も「10:00」で拾う）
                (targetTime === '' || normalizeTime(item.time) === targetTime) &&
                (isVisited === null || (isVisited === 1 ? visited : !visited))
            );
        });
    }, [data, targetEvent, targetShop, targetDate, targetTime, isVisited]);

    const sortedData = useMemo(() => {
        return [...filteredData].sort((a, b) => Number(b.no) - Number(a.no));
    }, [filteredData]);

    // ==========================================
    // 段階的なレンダリング（スクロールで20件ずつ増やす）
    //
    // ⚠️ 1行あたりの要素数が多く、全件を一度に描くと数百件で目に見えて重くなる。
    //   ListOrder.tsx と同じ IntersectionObserver 方式に揃えている。
    //
    // ⚠️ **QRの受付は描画件数の影響を受けない。** 検索対象は data（全件）であり、
    //   画面に出ていない予約でもチェックインできる。ここを slice 済みの
    //   配列に変えてはいけない（下までスクロールしないと受付できなくなる）。
    // ==========================================
    const PAGE_SIZE = 20;
    const [displayLength, setDisplayLength] = useState<number>(PAGE_SIZE);
    const loaderRef = useRef<HTMLTableRowElement>(null);

    // ⚠️ 絞り込みが変わったら先頭に戻す。戻さないと、少ない結果に絞ったあとで
    //   「前に読み込んだ件数」が残り、次に絞り込みを外したとき一気に描画される
    useEffect(() => {
        setDisplayLength(PAGE_SIZE);
    }, [targetEvent, targetShop, targetDate, targetTime, isVisited]);

    useEffect(() => {
        const total = sortedData.length;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayLength((prev) => (prev < total ? prev + PAGE_SIZE : prev));
                }
            },
            // ⚠️ 表(.table-responsive)が縦スクロールするわけではなくモーダル全体が
            //   スクロールするため、root は既定（ビューポート）でよい。
            //   先読みして体感の待ちを減らす
            { rootMargin: '200px' }
        );

        const current = loaderRef.current;
        if (current) observer.observe(current);

        return () => {
            if (current) observer.unobserve(current);
        };
    }, [sortedData.length]);

    const visibleData = useMemo(
        () => sortedData.slice(0, displayLength),
        [sortedData, displayLength]
    );

    // 1項目のみを更新するAPI呼び出し(handleBlur / チェックボックス / 同期完了で共用)
    const updateField = async (id: string, field: string, value: string | number) => {
        try {
            await apiClient.post('', {
                id,
                request: 'list',
                roll: 'event',
                function: 'update',
                category,
                [field]: value
            });
        } catch (e) {
            console.error(e);
        }
    };

    const handleBlur = (id: string, field: keyof CustomerData) => {
        const element = rowRefs.current[id]?.[field];
        if (!element) return;

        const newValue = element.value;
        const currentData = data.find(item => item.id === id);

        if (currentData && currentData[field] === newValue) return;

        setData(prev => prev.map(item => item.id === id ? { ...item, [field]: newValue } : item));
        updateField(id, field, newValue);
    };

    // ⚠️ 相談内容（interview）のチェックボックス編集は 2026-09-07 に廃止した。
    //   選択肢がイベントごとに違い、固定の選択肢で描くと
    //   「そのイベントにしか無い値」が画面から消えたうえ、
    //   触った瞬間に保存されて**原本が失われる**ため。

    const setRef = (id: string, field: string) => (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => {
        if (!rowRefs.current[id]) {
            rowRefs.current[id] = {};
        }
        rowRefs.current[id][field] = el;
    };

    /**
     * イベントの特設ページ。
     *
     * ⚠️ イベントごとにURLが違う。絞り込みで選んでいるイベントのものを開く。
     *   1つに固定すると、イベントが変わるたびに古いページへ飛ぶ
     *   （実際に 2026-09-07 まで前年の住まいるフェス2025を指したままだった）。
     */
    const EVENT_URLS: Record<string, string> = {
        'おうちづくりフェスタ2026': 'https://kh-house.jp/festa/',
        '住まいるフェスティバル2026': 'https://kh-house.jp/lp/smilefes_akune_2025/',
    };

    /** ⚠️ 未選択・未登録のイベントのときは最新のものを開く */
    const currentEventUrl = EVENT_URLS[targetEvent] ?? 'https://kh-house.jp/festa/';

    const openUrl = () => {
        window.open(currentEventUrl, '_blank');
    };



    const reload = () => {
        fetchData();
    };

    /**
     * 担当店舗の選択肢。
     *
     * ⚠️⚠️ **既存の `filterReportShops` / `sortShops` をそのまま使う**
     *   （`components/header/useAmbassadorMaster.ts`）。
     *   ⚠️ 絞り込み: `report_flag = 1`（⚠️ **管理用の擬似店舗を外す**）
     *   ⚠️ 並び替え: 事業区分 → ブランド → id
     *   ⚠️ ⚠️ **規則を写さないこと。** 片方だけ直すと画面ごとに順が変わる。
     *
     * ⚠️ 事業区分では絞っていない（指示）。⚠️ イベントには複数ブランドの来場者が混ざる。
     */
    const shopOptions = useMemo(() => {
        const sorted = sortShops(filterReportShops(shopList));
        const seen = new Set<string>();
        const names: string[] = [];
        sorted.forEach(s => {
            const name = (s.shop ?? '').trim();
            if (name === '' || seen.has(name)) return;
            seen.add(name);
            names.push(name);
        });
        return names;
    }, [shopList]);

    /**
     * 選んだ店舗に紐づくスタッフ ＋ 「〇〇店 管理」。
     *
     * ⚠️⚠️ **`syncTarget.shop` ではなく `syncShop` を見る**（2026-09-28 に変更）。
     *   ⚠️ 店舗を選び直したとき、⚠️ **担当者の候補も入れ替わらないと辻褄が合わない。**
     */
    const staffOptions = useMemo(() => {
        if (syncShop === '') return [];
        return [...staffArray.filter(s => s.shop === syncShop).map(s => s.name), `${syncShop} 管理`];
    }, [staffArray, syncShop]);

    const handleSync = (item: CustomerData) => {
        setSyncTarget(item);
        setTargetStaff('');
        // ⚠️ 既に入っていればそれを既定にする（指示）。⚠️ 空なら選んでもらう
        setSyncShop((item.shop ?? '').trim());
        setSyncShow(true);
    };

    // 同期成功(status === 'success')後のUI更新
    const syncSuccess = (id: string) => {
        setData(prev => prev.map(item => item.id === id ? { ...item, sync: 1 } : item));
        updateField(id, 'sync', 1);
        setSyncShow(false);
        setSyncTarget(null);
        setTargetStaff('');
        setSyncShop('');
    };

    const syncStart = async () => {
        /**
         * ⚠️⚠️ **店舗が空のまま同期させない**（2026-09-28 追加）。
         *   ⚠️ 空で入れると ⚠️ **担当者の画面に出てこない顧客**ができる。
         */
        if (!syncTarget || syncShop === '') {
            alert('担当店舗を選択してください');
            return;
        }
        if (targetStaff === '') {
            alert('スタッフを選択してください');
            return;
        }

        const postData: Record<string, string> = {
            ...createSyncPayload(syncTarget),
            in_charge_user: targetStaff,
            // ⚠️⚠️ **選び直した店舗を使う。** ⚠️ `syncTarget.shop` は空のことがある
            in_charge_store: syncShop,
            request: 'list',
            roll: 'insert',
            category
        };

        try {
            const response = await apiClient.post('', postData);
            if (response.data.status === 'success') {
                syncSuccess(syncTarget.id);
            } else {
                alert('同期に失敗しました。');
            }
        } catch (e) {
            console.error(e);
            alert('同期に失敗しました。');
        }
    };

    return (
        <>
            <Modal show={eventSummary} onHide={() => setEventSummary(false)} fullscreen>
                <Modal.Header closeButton className="py-2">
                    {/* ⚠️ 複数のイベントを扱うため、特定のイベント名を書かない。
                        どのイベントを見ているかは右上の絞り込みで示す */}
                    <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold', color: '#32325d' }}>イベント予約状況</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-2" style={{ backgroundColor: '#f8f9fe' }}>

                    {/*
                      ⚠️⚠️ 上部の操作（v2.2.166）。⚠️ 「特設URLはこちら」〜絞り込みまでを ⚠️ **上に固定する**。
                        ⚠️ スクロールしているのは Modal.Body（fullscreen）。⚠️ Body の p-2（8px）ぶん top を上げ、
                          ⚠️ 同じ色で塗って ⚠️ **固定した行の上に表がのぞかない**ようにしている。
                        ⚠️ 表（.table-responsive）より前に描くので、z-index は表の見出しより上にする。
                      ⚠️ 絞り込みは ⚠️ **左寄せで「閉じる」の右**に並べる（ps-3 で間隔。2026-10-06 の指示）。
                        ⚠️ 並び: イベント → 店舗 → 来場予定日 → 来場予定時間 → 来場状況（来場状況は 2026-10-06 の確認で右端から移した）。
                    */}
                    <div className="d-flex flex-wrap align-items-center mb-2"
                        style={{ position: 'sticky', top: '-8px', zIndex: 5, backgroundColor: '#f8f9fe', padding: '8px 0', margin: '-8px 0 8px' }}>
                        <div className="d-flex gap-2">
                            <button style={{ ...styles.buttonSecondary, padding: '4px 10px', fontSize: '11px' }} onClick={openUrl}>
                                <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>特設URLはこちら
                            </button>
                            <button style={{ ...styles.buttonPrimary, padding: '4px 10px', fontSize: '11px' }} onClick={reload} disabled={loading}>
                                {loading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="fa-solid fa-rotate-right me-1"></i>}
                                リロード
                            </button>
                            <button style={{ ...styles.buttonDanger, padding: '4px 10px', fontSize: '11px' }} onClick={() => setEventSummary(false)} disabled={loading}>
                                <i className="fa-solid fa-xmark me-1"></i>閉じる
                            </button>
                        </div>

                        {/* 💡 絞り込み用セレクトタグ。⚠️ v2.2.166: 左寄せで「閉じる」の右へ（ps-3） */}
                        <div className="d-flex flex-wrap gap-2 align-items-center ps-3">
                            {/* ⚠️ イベントを変えると来場予定日・時間も戻す（changeEvent の注記参照） */}
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={targetEvent} onChange={(e) => changeEvent(e.target.value)}>
                                <option value="">全イベント表示</option>
                                {eventArray.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={targetShop} onChange={(e) => setTargetShop(e.target.value)}>
                                <option value="">全店舗表示</option>
                                {shopArray.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={targetDate} onChange={(e) => setTargetDate(e.target.value)}>
                                <option value="">来場予定日を選択</option>
                                {dateArray.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={targetTime} onChange={(e) => setTargetTime(e.target.value)}>
                                <option value="">来場予定時間を選択</option>
                                {timeArray.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={isVisited === null ? '' : String(isVisited)}
                                onChange={(e) => setIsVisited(e.target.value === '' ? null : Number(e.target.value))}>
                                <option value="">来場状況</option>
                                <option value="1">来場済み</option>
                                <option value="0">未来場</option>
                            </select>
                        </div>
                    </div>

                    {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}

                    <div className="bg-white rounded shadow-sm border table-responsive">
                        <Table hover className="m-0 align-top text-nowrap" style={{ minWidth: '1800px' }}>
                            <thead>
                                <tr>
                                    {/* ⚠️ v2.2.166: 2行目に担当店舗を出すため 40px → 110px */}
                                    <th style={{ ...thStyle, width: '110px' }}>同期</th>
                                    <th style={{ ...thStyle, width: '110px' }}>来場予定</th>
                                    {/* ⚠️ ここから3列だけが編集できる。他は来場者の入力した原本 */}
                                    <th style={{ ...thStyle, width: '110px' }}>お名前</th>
                                    <th style={{ ...thStyle, width: '100px' }}>電話番号</th>
                                    <th style={{ ...thStyle, width: '180px' }}>メールアドレス</th>
                                    <th style={{ ...thStyle, width: '80px' }}>郵便番号</th>
                                    <th style={{ ...thStyle, width: '220px' }}>住所</th>
                                    <th style={{ ...thStyle, width: '200px' }}>世帯情報</th>
                                    <th style={{ ...thStyle, width: '220px', whiteSpace: 'normal' }}>相談内容</th>
                                    <th style={{ ...thStyle, width: '160px', whiteSpace: 'normal' }}>ご検討</th>
                                    <th style={{ ...thStyle, width: '100px' }}>きっかけ</th>
                                    <th style={{ ...thStyle, width: '120px' }}>希望エリア</th>
                                    <th style={{ ...thStyle, width: '130px' }}>チェックイン</th>
                                    <th style={{ ...thStyle, width: '130px' }}>チェックアウト</th>
                                    <th style={{ ...thStyle, width: '180px' }}>事前質問</th>
                                    <th style={{ ...thStyle, width: '180px' }}>備考欄</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleData.map((item, index) => {
                                    const hasCheckIn = !!item.check_in_time && item.check_in_time !== '';
                                    const hasCheckOut = !!item.check_out_time && item.check_out_time !== '';
                                    let statusIcon;

                                    if (hasCheckIn && !hasCheckOut) {
                                        statusIcon = <i className="fa-solid fa-arrow-right-to-bracket text-success" title="チェックイン"></i>;
                                    } else if (hasCheckIn && hasCheckOut) {
                                        statusIcon = <i className="fa-solid fa-check-double text-secondary" title="チェックアウト"></i>;
                                    }

                                    return (
                                        <tr key={item.id} className={getRowClass(item)}>
                                            <td className="p-1 align-middle text-center fw-bold" style={{ fontSize: '10px' }}>
                                                <div className="d-flex align-items-center gap-1">
                                                    <span>{index + 1}</span>
                                                    {statusIcon && <span style={{ fontSize: '12px' }}>{statusIcon}</span>}
                                                    {item.sync === 1
                                                        ? <span style={{ fontSize: '9px' ,color: 'red'}}>同期済み</span>
                                                        : <i className='fa-solid fa-arrows-rotate pointer' onClick={() => handleSync(item)}></i>}
                                                </div>
                                                {/*
                                                  ⚠️ 2行目: 予約の担当店舗（event_db.shop）。⚠️ 値があるときだけ（v2.2.166）。
                                                    ⚠️ 同期の前に「どの店舗の予約か」が分かるように。⚠️ 長い店舗名は折り返す
                                                */}
                                                {item.shop && (
                                                    <div className="text-start fw-normal mt-1" style={{ fontSize: '9px', color: '#525f7f', whiteSpace: 'normal', lineHeight: 1.2 }}>
                                                        {item.shop}
                                                    </div>
                                                )}
                                            </td>
                                            {/* ⚠️ ここから下、編集できるのは お名前 / 電話番号 / メールアドレス の3つだけ。
                                                他は来場者本人が入力した原本のため表示のみにしている（2026-09-07）。
                                                サーバー側（listAction/list_event.php）でも同じ制限を掛けているので、
                                                入力欄に戻すだけでは保存されない。 */}
                                            <td className="p-1 align-middle" style={{ fontSize: '11px' }}>
                                                <div>{item.date || ''}</div>
                                                <div className="fw-bold">{item.time || ''}</div>
                                            </td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} ref={setRef(item.id, 'name')} defaultValue={item.name} onBlur={() => handleBlur(item.id, 'name')} />
                                                {/* ⚠️ ふりがなは編集させない。読み仮名は本人の申告が正 */}
                                                {item.kana && <div style={{ fontSize: '10px', color: '#8898aa' }}>{item.kana}</div>}
                                            </td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} ref={setRef(item.id, 'phone')} defaultValue={item.phone} onBlur={() => handleBlur(item.id, 'phone')} />
                                            </td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} ref={setRef(item.id, 'mail')} defaultValue={item.mail} onBlur={() => handleBlur(item.id, 'mail')} />
                                            </td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px' }}>{item.zip || ''}</td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px', whiteSpace: 'normal' }}>
                                                {`${item.address || ''}${item.street || ''}`}
                                            </td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px', whiteSpace: 'normal' }}>
                                                {/* ⚠️ 手入力で作られた行にしか入らない項目。LPのフォームには無い */}
                                                {[item.age, item.adult, item.child, item.house].filter(v => v).join(' / ')}
                                            </td>
                                            <td className="p-1 align-middle" style={{ whiteSpace: 'normal', lineHeight: '1.3', fontSize: '10px' }}>
                                                {/* ⚠️ 選択肢はイベントごとに違う（LPのフォームと旧イベントで別物）。
                                                    固定のチェックボックスにすると、知らない値が黙って消える */}
                                                {(item.interview || '').split(',').filter(v => v).map(v => (
                                                    <span key={v} className="badge bg-light text-dark border me-1 mb-1 fw-normal">{v}</span>
                                                ))}
                                            </td>
                                            <td className="p-1 align-middle" style={{ whiteSpace: 'normal', lineHeight: '1.3', fontSize: '10px' }}>
                                                {(item.request || '').split(',').filter(v => v).map(v => (
                                                    <span key={v} className="badge bg-light text-dark border me-1 mb-1 fw-normal">{v}</span>
                                                ))}
                                            </td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px' }}>{item.medium || ''}</td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px', whiteSpace: 'normal' }}>{item.area || ''}</td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} placeholder="2026/03/21 10:05" ref={setRef(item.id, 'check_in_time')} defaultValue={item.check_in_time || ''} onBlur={() => handleBlur(item.id, 'check_in_time')} />
                                            </td>
                                            <td className="p-1 align-middle">
                                                <input type="text" style={compactInputStyle} placeholder="2026/03/21 11:30" ref={setRef(item.id, 'check_out_time')} defaultValue={item.check_out_time || ''} onBlur={() => handleBlur(item.id, 'check_out_time')} />
                                            </td>
                                            <td className="p-1 align-middle" style={{ fontSize: '11px', whiteSpace: 'normal' }}>
                                                {/* ⚠️ 事前質問も本人の入力。書き換えると原本が失われる */}
                                                {item.question || ''}
                                            </td>
                                            <td className="p-1 align-middle">
                                                <textarea
                                                    style={{ ...compactInputStyle, height: '40px', resize: 'none' }}
                                                    placeholder="受付スタッフ用メモ..."
                                                    ref={setRef(item.id, 'remarks')}
                                                    defaultValue={item.remarks}
                                                    onBlur={() => handleBlur(item.id, 'remarks')}
                                                ></textarea>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sortedData.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={16} className="text-center p-4 text-muted" style={{ fontSize: '11px' }}>データがありません</td>
                                    </tr>
                                )}

                                {/* ⚠️ 追加読み込みの目印。tbody の中なので tr / td で置くこと。
                                    div を直接入れるとブラウザが table の外へ弾き出し、
                                    交差判定が働かずスクロールしても増えなくなる */}
                                <tr ref={loaderRef}>
                                    <td colSpan={16} className="text-center text-muted p-2" style={{ fontSize: '11px' }}>
                                        {sortedData.length > displayLength
                                            ? `読み込み中…（${displayLength} / ${sortedData.length} 件）`
                                            : sortedData.length > 0 ? `全 ${sortedData.length} 件` : ''}
                                    </td>
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                </Modal.Body>
            </Modal>

            {/* 💡 追加: 担当者選択モーダル */}
            <Modal show={syncShow} onHide={() => setSyncShow(false)} centered size="sm">
                <Modal.Header closeButton className="py-2">
                    <Modal.Title style={{ fontSize: '13px', fontWeight: 'bold', color: '#32325d' }}>担当営業の選択</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    <div className="mb-2" style={{ fontSize: '11px', color: '#8898aa' }}>
                        {syncTarget ? `${syncTarget.name} 様` : ''}
                    </div>

                    {/*
                      ⚠️⚠️ **担当店舗（2026-09-28 追加）。**
                        ⚠️ `event_db.shop` が空の予約があり、⚠️ **同期できなかった。**
                        ⚠️ ⚠️ **入っている場合も選び直せる**（指示）。
                        ⚠️ 店舗を変えたら**担当者は選び直してもらう**（候補が入れ替わるため）。
                    */}
                    <select className='mb-2'
                        style={{ ...compactInputStyle, height: '28px', fontSize: '12px' }}
                        value={syncShop}
                        onChange={(e) => { setSyncShop(e.target.value); setTargetStaff(''); }}>
                        <option value="">担当店舗を選択</option>
                        {shopOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>

                    <select style={{ ...compactInputStyle, height: '28px', fontSize: '12px' }} value={targetStaff} onChange={(e) => setTargetStaff(e.target.value)}>
                        <option value="">担当営業を選択</option>
                        {staffOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <button className='mt-2'
                        style={{ ...styles.buttonDanger, padding: '0px 10px', fontSize: '11px' }}
                        onClick={syncStart}>
                        <i className="fa-solid fa-rotate me-1"></i>同期する
                    </button>
                </Modal.Body>
            </Modal>

        </>
    );
};

export default EventList;
```
