/**
 * 全社報告用フォーマット（会社実績）の型（v2.2.264 で Company.tsx から分けた）。
 *
 * ⚠️ 集計（companyAggregate.ts）が「行の配列」を作り、表（CompanyTable.tsx）はそれを並べるだけにしている。
 *   描くときに顧客や予算の配列を探さない（以前はセルごとに探していて遅かった）。
 */

export type Staff = { name: string, shop: string, section: string, report: number, sort: number, multi: number, status: string, period: string, position: string, khg_id: string };

/**
 * 店舗。
 * ⚠️ `parent_shop` は併売店（multi = 1）の親店舗名。運用側が手作業で設定する。
 *   ⚠️ 未設定なら null。**親店舗自身も null** である（自分を指さない）。
 *   列の追加: backend/scripts/sql/2026-09-10_shop_list_parent_shop.sql
 */
export type Shop = { brand: string, shop: string, section: string, area: string, division: string, multi: number, parent_shop: string | null };
export type Section = { name: string, division: string };
export type Customer = Record<string, string>;
export type Achievement = { category: string, name: string, period: string, value: string };
/** 不動産企画係の商談案件（② の company が返す数字と担当だけ。v2.2.264） */
export type RealtyDeal = Record<string, unknown>;

/** 数字のセル（契約数・粗利・売上・予算の合計）。⚠️ 表示する文字まで集計の時点で決めておく */
export type NumCell = {
    t: 'num';
    /**
     * contract … 数があれば青（押せる）／ budget … 数があれば赤 ／ budgetFixed … いつも赤 ／ sales … 不動産企画係の売上（押せない）
     */
    tone: 'contract' | 'budget' | 'budgetFixed' | 'sales';
    main: string;
    /** 仲介（建売）。0 なら出さない */
    broker: number;
    /** 解約。0 なら出さない（「キャンセル数を表示」のときだけ出す） */
    cancel: number;
    /** 昨年実績（「昨年実績を表示」のときだけ出す）。null なら出さない */
    ly: string | null;
    lyBroker: number;
    /** 昨年実績の丸の位置（右からの px） */
    lyRight: number;
    /** 押したときに顧客詳細に出す顧客（空なら押せない） */
    list: Customer[];
    active: boolean;
    colSpan: number;
    rowSpan: number;
};

/** 予算の入力欄（店舗の月ごとの予算・担当の個人目標） */
export type InputCell = {
    t: 'input';
    /** 店舗の予算の行（赤い背景）か、担当の個人目標か */
    tone: 'shop' | 'staff';
    category: 'shop' | 'staff';
    name: string;
    period: string;
    value: string;
    colSpan: number;
};

export type Td = NumCell | InputCell;

/** 行の左の見出し（事業部・課・店舗の名前、担当名・予算・実績） */
export type Head = {
    text: string;
    rowSpan: number;
    colSpan: number;
    /** level … 事業部・課・店舗の名前のセル ／ name … 担当名 ／ budget・result … 予算・実績 */
    variant: 'division' | 'section' | 'shop' | 'name' | 'budget' | 'result';
    /** 課の色（0〜5。課・店舗の名前のセルの左の帯） */
    color?: number;
    /** 2列目（固定する位置が違う） */
    second?: boolean;
};

export type RowLevel = 'group' | 'division' | 'section' | 'shop' | 'realty';

export type RowModel = {
    key: string;
    /** 上のバーの「事業部・課・店舗を選択」で移る先 */
    id?: string;
    level: RowLevel;
    /** そのまとまりの最初の行（上に区切りの線を引く） */
    first: boolean;
    /** 上に固定する行（グループ予算 = 1、グループ実績 = 2） */
    sticky?: 1 | 2;
    /** 行の種類（色分けに使う） */
    kind: 'budget' | 'result' | 'staff';
    heads: Head[];
    tds: Td[];
    /** ランクの5列（null の行は、上の行のセルが2行ぶん） */
    ranks: NumCell[] | null;
    /** この行の前に空ける余白（事業部 = 3、課 = 2、店舗 = 1） */
    gapBefore?: 1 | 2 | 3;
    /** 余白の行に出す見出し（事業部の名前） */
    gapLabel?: string;
    /** v2.2.264 で足した行（不動産企画係の事業部）。⚠️ 以前の表と比べるテストで見分けるための印 */
    isNew?: boolean;
};
