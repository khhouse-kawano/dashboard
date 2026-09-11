import React, { useEffect, useState, useContext, useMemo } from "react";
import '../chartConfig';
import AuthContext from '../../context/AuthContext';
import Table from "react-bootstrap/Table";
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { isLastYear } from '../../utils/isLastYear';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { get11MonthsAgoString } from "../../utils/get11MonthsAgoString";
import apiClient from "../../utils/apiClient";
import { chartColors } from "./utils";
import CustomerListModal from "../CustomerListModal";
import InformationEditKaeru from "../information/InformationEditKaeru";

type Shop = { brand: string; shop: string; section: string; area: string; }
/**
 * 販促媒体（medium_kaeru）。
 * ⚠️ `show_graph` は「表の行とグラフの系列に出すか」。2026-09-11 追加。
 *   backend/scripts/sql/2026-09-11_medium_kaeru_show_graph.sql を先に実行すること。
 *   ⚠️ DB から文字列で来ることがあるため Number() で比べる。
 */
type MediumType = { medium: string, category: string, sort_key: number, response_medium: number, show_graph?: number | string };
type CustomerList = Record<string, string>;
type GraphData = { month: string, [key: string]: number | string };
type CheckItem = {
  name: string;
  show: boolean;
};
type CheckedState = {
  [key: string]: CheckItem;
};
type Budget = { budget_period: string, shop: string, medium: string, budget_value: number, note: string, company: string, response_medium: number, section: string, order_section: string };

const CustomerTrendKaeru: React.FC = () => {
  // ⚠️ token / authority は顧客詳細（InformationEditKaeru）に渡すために取る
  const { category, token, authority } = useContext(AuthContext);
  const [originalUserData, setOriginalUserData] = useState<CustomerList[]>([]);
  const [mediumList, setMediumList] = useState<MediumType[]>([]);
  const [graphCategory, setGraphCategory] = useState('register');
  const startMonthValue = get11MonthsAgoString().replace(/-/g, '/');
  const [startMonth, setStartMonth] = useState(startMonthValue);
  const [endMonth, setEndMonth] = useState('');
  const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
  const [targetShop, setTargetShop] = useState('');
  const [targetSection, setTargetSection] = useState('');
  const [targetBrand, setTargetBrand] = useState('');
  const [originalShopArray, setOriginalShopArray] = useState<Shop[]>([]);
  const [checked, setChecked] = useState<CheckedState>({
    graph: { name: 'グラフ', show: false },
    register: { name: '総反響数', show: true },
    contact: { name: '接触数', show: true },
    interview: { name: '店舗来場数', show: true },
    application: { name: '申込み', show: true },
    contract: { name: '契約数', show: true },
    budget: { name: '広告費', show: false },
    // comparison: { name: '昨年実績', show: false }
  });
  const [budgetList, setBudget] = useState<Budget[]>([]);
  const [isReverse, setIsReverse] = useState(true);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  /** 顧客一覧モーダル。label は「実来場」などの見出し */
  const [listShow, setListShow] = useState<{ show: boolean, label: string, list: CustomerList[] }>({
    show: false, label: '', list: []
  });
  /** 顧客詳細モーダルを開く顧客ID。'' なら閉じている */
  const [editId, setEditId] = useState('');


  const mediumFormate = (medium: string) => {
    return medium === '公式LINE' ? 'ALLGRIT' :
      medium === 'athome' ? 'アットホーム' : medium;
  };

  const dateFormate = (date: string) => {
    return date ? date.replace(/-/g, '/') : '';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.post("/", { request: 'customerTrend', category });
        const responseCustomer = response.data.customer.map(r => !r.medium ? ({
          ...r,
          medium: 'その他'
        }) : r);
        setOriginalUserData(responseCustomer);
        // ⚠️ show_graph で表・グラフに出す媒体を決める（下の displayMediums）
        setMediumList(response.data.medium);
        setOriginalShopArray(response.data.shop);
        setBudget(response.data.budget);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    setOriginalMonthArray(getYearMonthArray(2025, 1));
    fetchData();
  }, []);

  /**
   * ⚠️⚠️ **ここから下の派生値は useState + useEffect をやめて useMemo にした（2026-09-11）。**
   *
   *   以前は1つの useEffect の中で monthArray / sectionArray / userData /
   *   graphData を**まとめて setState** しており、依存配列から
   *   `originalShopArray` と `originalMonthArray` が**抜けていた**。
   *   ⚠️ そのため graphData が1テンポ古い値で作られる場面があり、
   *     さらに setState が4回走るため再描画が重なって表示がもたついていた。
   *
   * ⚠️ **この変更で表示が変わる場面がある。** ズレが直る方向だが、
   *   「前は違う数字だった」と見える可能性がある。
   */

  /** 表示対象の年月。開始月・終了月で切り出す */
  const monthArray = useMemo(() => {
    const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
    const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length;
    return originalMonthArray.slice(startIndex, endIndex);
  }, [originalMonthArray, startMonth, endMonth]);

  /** 課の一覧。⚠️ 「不動産営業2課」のような数字で並べる */
  const sectionArray = useMemo(() => {
    const unique = [...new Set(originalShopArray.filter(o => o.section).map(o => o.section))];
    return unique.sort((a, b) => {
      const numA = parseInt(a?.match(/\d+/)?.[0] ?? "9999", 10);
      const numB = parseInt(b?.match(/\d+/)?.[0] ?? "9999", 10);
      return numA - numB;
    });
  }, [originalShopArray]);

  /**
   * 絞り込み後の顧客。
   * ⚠️ `isDuplicate` が false のときだけ `show_dashboard = 1` に絞る。
   *   ⚠️ サーバ側で絞っていないのはこのためである（queries.ts のコメント参照）。
   *
   * ⚠️⚠️ **建売に併売店の概念は無い。** 注文（CustomerTrendOrder.tsx）には
   *   「併売店をまとめる」があるが、こちらには**意図的に入れていない**。
   *   同じ画面構成なので足したくなるが、足さないこと。
   */
  const userData = useMemo(() => {
    const sectionShops = originalShopArray.filter(o => o.section === targetSection).map(o => o.shop);
    return originalUserData.filter(o =>
      (targetSection ? sectionShops.includes(o.shop) : true) &&
      (targetShop ? o.shop === targetShop : true) &&
      (isDuplicate ? true : Number(o.show_dashboard) === 1)
    );
  }, [originalUserData, originalShopArray, targetSection, targetShop, isDuplicate]);

  const formattedMonthArray = useMemo(() => {
    return isReverse ? [...monthArray].reverse() : [...monthArray];
  }, [monthArray, isReverse]);

  const CustomLegend = ({ payload }: { payload?: any[] }) => {
    if (!payload) return null;
    return (
      <div style={{ fontSize: "12px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 12, height: 12, backgroundColor: entry.color, marginRight: 6, borderRadius: 2 }} />
            <span>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div style={{ background: "white", border: "1px solid #ccc", padding: "8px 12px", borderRadius: "6px", fontSize: "12px", lineHeight: "1.4", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
        <div style={{ marginBottom: 4, fontWeight: "bold" }}>{label}</div>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </div>
        ))}
      </div>
    );
  };

  const formate = (value: string) => {
    return value ? value.replace(/-/g, '/') : '';
  };

  const getValue = (base: CustomerList[], monthIndex: number, month: string, target: string, period: string[] = monthArray) => {
    const formattedPeriod = period.map(p => formate(p));
    const formattedMonth = formate(month);
    const isPeriodMode = monthIndex < 1;

    // 1. 各階層のKPIキーを配列として定義
    const registerKeys = ['register'] as const;
    const contactKeys = ['contact'] as const;
    const interviewKeys = ['interview', 'tour'] as const;
    const appointmentKeys = ['appointment'] as const;
    const screeningKeys = ['screening', 'obtain'] as const;
    const applicationKeys = ['application'] as const;
    const contractKeys = ['contract', 'contract_broker'] as const;

    // 2. 複数のキーの中で「最も古い日付（初回）」を取得する関数
    const getOldestDate = (b: CustomerList, keys: readonly string[]) => {
      const dates = keys
        .map(key => formate(b[key as keyof CustomerList] as string) || '')
        .filter(val => val !== '');

      if (dates.length === 0) return '';

      // 日付文字列をソートして一番古いものを返す
      return dates.sort()[0];
    };

    // 3. 取得した最古の日付が、対象月(または期間)に含まれるか判定する関数
    const isMatch = (dateStr: string) => {
      if (!dateStr) return false;
      return isPeriodMode
        ? formattedPeriod.includes(dateStr.slice(0, 7))
        : dateStr.includes(formattedMonth);
    };

    // 4. KPI判定の共通ロジック（自身の最古日付、なければ上位KPIの最古日付で判定）
    const evaluateKPI = (b: CustomerList, targetKeys: readonly string[], higherKeys: readonly string[] = []) => {
      const oldestTargetDate = getOldestDate(b, targetKeys);

      // 自身のステップに日付があれば、その一番古い日付で判定
      if (oldestTargetDate) {
        return isMatch(oldestTargetDate);
      }

      // 未入力の場合は上位KPIへフォールバック（上位KPIの中で一番古い日付を「到達日」とみなす）
      if (higherKeys.length > 0) {
        const oldestHigherDate = getOldestDate(b, higherKeys);
        return isMatch(oldestHigherDate);
      }

      return false;
    };

    // --- メインロジック ---
    if (target === 'contact') {
      const higherKeys = [...interviewKeys, ...appointmentKeys, ...screeningKeys, ...applicationKeys, ...contractKeys];
      return base.filter(b => evaluateKPI(b, contactKeys, higherKeys));
    }

    if (target === 'interview' || target === 'tour') {
      const higherKeys = [...appointmentKeys, ...screeningKeys, ...applicationKeys, ...contractKeys];
      return base.filter(b => evaluateKPI(b, interviewKeys, higherKeys));
    }

    if (target === 'appointment') {
      const higherKeys = [...screeningKeys, ...applicationKeys, ...contractKeys];
      return base.filter(b => evaluateKPI(b, appointmentKeys, higherKeys));
    }

    if (target === 'screening' || target === 'obtain') {
      const higherKeys = [...applicationKeys, ...contractKeys];
      return base.filter(b => evaluateKPI(b, screeningKeys, higherKeys));
    }

    if (target === 'application') {
      const higherKeys = [...contractKeys];
      return base.filter(b => evaluateKPI(b, applicationKeys, higherKeys));
    }

    if (target === 'contract') {
      return base.filter(b => b.status === '契約済み' && evaluateKPI(b, contractKeys));
    }

    // target === 'register' など単独キーへのフォールバック
    return base.filter(b => evaluateKPI(b, [target]));
  };

  const isHp = (value: string) => {
    // データが空（undefinedやnull）の時に.includesでクラッシュするのを防ぐ
    if (!value) return false;

    const portal = ['SUUMO', 'ALLGRIT', `HOME'S`, 'アットホーム', 'タウンライフ', 'カゴスマ'];
    const isPortalMatch = portal.some(p => value.includes(p));

    return !isPortalMatch;
  };

  /**
   * 表の行とグラフの系列に出す販促媒体。
   *
   * ─────────────────────────────────────────────
   * ⚠️⚠️ **2026-09-11 に直書きをやめ、DB（medium_kaeru.show_graph）に移した。**
   *   以前は
   *     const displayMediums = ['SUUMO', `HOME'S`, 'ALLGRIT', 'アットホーム'];
   *   と書いていた。媒体の増減は運用側で起こるため直書きは必ず腐る。
   *
   * ⚠️⚠️ **`mediumFormate()` を通してから配列にすること。**
   *   DB の実データは `公式LINE` / `athome` だが、画面の表示名と
   *   下の突き合わせ（`o.hp_campaign?.includes(medium)`）は
   *   `ALLGRIT` / `アットホーム` を前提にしている。
   *   生値のまま入れると、hp_campaign 側の一致が取れなくなり
   *   **数字が静かに減る**。
   *
   * ⚠️ 並び順は sort_key。グラフの色は添字で決まるので、
   *   sort_key を変えると**色の対応が変わる**。
   *
   * ⚠️ `isHp()` のポータル一覧（タウンライフ・カゴスマを含む）は別物で、
   *   ここには連動しない。あちらは「HP反響かどうか」の判定であり、
   *   表に出すかどうかとは目的が違う。
   *
   * ⚠️⚠️ **SQL を先に実行すること。** `show_graph` 列がまだ無いと
   *   `Number(undefined)` が NaN になって**空配列**になり、
   *   表は「全販促媒体 / ホームページ反響計」の2行だけ、
   *   グラフは1系列だけになる。**エラーは出ない。**
   *   フロントより先に backend/scripts/sql/2026-09-11_medium_kaeru_show_graph.sql
   *   を流すこと。
   * ─────────────────────────────────────────────
   */
  const displayMediums = useMemo(() =>
    mediumList
      .filter(m => Number(m.show_graph) === 1)
      .sort((a, b) => (Number(a.sort_key) || 0) - (Number(b.sort_key) || 0))
      .map(m => mediumFormate(m.medium)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediumList]);

  const hpMediums = ['会員登録', '資料請求', '来場予約', '先取物件', 'その他'];

  /**
   * その顧客が、表の「販促媒体名」の行に該当するか。
   *
   * ─────────────────────────────────────────────
   * ⚠️⚠️ **表（summary）とグラフの両方がこの1つを使う。**
   *   2026-09-11 まで、表はこの判定、グラフは
   *   `mediumFormate(o.medium) === mediumFormate(値)` という**別の判定**を
   *   使っていた。そのため hp_campaign 由来の反響がグラフでは
   *   どの系列にも入らず、**表とグラフで数字が合わなかった**。
   *
   * ⚠️ 中身は表にあったものをそのまま関数へ出しただけで、**判定は変えていない。**
   *
   * ⚠️ `mediumIndex` は 0（全販促媒体）と 1（ホームページ反響計）だけを見る。
   *   それ以外の行は値を問わないので、グラフからは 2 を渡している。
   * ─────────────────────────────────────────────
   */
  const matchesMediumRow = (o: CustomerList, medium: string, mediumIndex: number): boolean => {
    // 1. 全販促媒体
    if (mediumIndex === 0) return true;

    // --------------------------------------------------
    // 【追加】このデータ(o)が displayMediums の「いずれか」に該当するか判定
    // --------------------------------------------------
    const isAnyDisplayMedium = displayMediums.some(dm => {
      const isMatchMedium = mediumFormate(o.medium) === mediumFormate(dm);
      const isMatchCampaign = o.hp_campaign?.includes(dm) ?? false;
      return isMatchMedium || isMatchCampaign;
    });

    // --------------------------------------------------
    // displayMediums を選択中の場合の判定
    // --------------------------------------------------
    if (displayMediums.includes(medium)) {
      // 選択中の媒体(medium)に合致するかどうかだけを返す
      const isMatchMedium = mediumFormate(o.medium) === mediumFormate(medium);
      const isMatchCampaign = o.hp_campaign?.includes(medium) ?? false;
      return isMatchMedium || isMatchCampaign;
    }

    // --------------------------------------------------
    // 【修正】HPグループの判定
    // 条件: 「displayMediums に該当しない（!isAnyDisplayMedium）」かつ「HP系の条件を満たす」
    // --------------------------------------------------
    const isHpGroup = !isAnyDisplayMedium && (isHp(o.hp_campaign) || !o.medium || !o.hp_campaign);

    // 2. ホームページ反響計（合計）
    if (mediumIndex === 1) return isHpGroup;

    // 3. showSummary 表示時の HP内訳（hpMediums の要素）
    if (showSummary && hpMediums.includes(medium)) {
      if (!isHpGroup) return false; // HPグループ以外は弾く

      // HP反響の「その他」
      if (medium === 'その他') {
        const mainHpKeywords = ['会員登録', '資料請求', '来場予約', '先取物件'];
        // キャンペーン名が無い、または主要キーワードが含まれていない場合は全て「その他」へ
        return !o.hp_campaign || !mainHpKeywords.some(keyword => o.hp_campaign.includes(keyword));
      }

      // それ以外のHP内訳（会員登録、資料請求など）
      return o.hp_campaign?.includes(medium) ?? false;
    }

    // 4. その他の通常の媒体
    // HPグループに吸収されたデータは除外し、媒体名が一致するものだけを抽出
    return !isHpGroup && mediumFormate(o.medium) === mediumFormate(medium);
  };

  /**
   * グラフの系列。
   *
   * ⚠️⚠️ **表の行と同じにしている（2026-09-11）。**
   *   以前は `medium_kaeru` の全媒体を系列にしており、表には無い媒体が並んで
   *   数字が突き合わせられなかった。
   *
   * ⚠️ **「全販促媒体」は入れないこと。** 合計なので、積み上げると二重に数える。
   * ⚠️ HP内訳（showSummary）も入れない。切り替えるたびに系列数が変わり、
   *   色の対応が動いて読めなくなる。
   *
   * ⚠️ `displayMediums` は medium_kaeru.show_graph 由来なので、
   *   DB を直せば表もグラフも同時に変わる。片方だけ変わることはない。
   */
  const graphSeries = ['ホームページ反響計', ...displayMediums];

  /**
   * 積み上げ棒グラフのデータ。⚠️ グラフ非表示のときは作らない（重いため）
   *
   * ⚠️⚠️ **`getValue` の定義より後に置くこと。**
   *   useMemo のコールバックは**レンダー中に即実行される**ため、
   *   `const getValue = ...` より前に書くと初回レンダーで
   *   「Cannot access 'getValue' before initialization」になる。
   */
  const graphData = useMemo<GraphData[]>(() => {
    if (!checked.graph.show) return [];
    return monthArray.map(monthValue => ({
      month: monthValue,
      ...Object.fromEntries(
        graphSeries.map(seriesName => [seriesName,
          getValue(userData, monthArray.indexOf(monthValue) + 1, monthValue, graphCategory)
            // ⚠️ 表と同じ判定を使う。'ホームページ反響計' だけ mediumIndex = 1 相当
            .filter(item => matchesMediumRow(item, seriesName, seriesName === 'ホームページ反響計' ? 1 : 2)).length
        ])
      )
    }));
    // ⚠️ displayMediums（＝show_graph）が変われば系列も変わるので依存に入れる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, monthArray, graphCategory, checked.graph.show, showSummary, displayMediums]);

  /**
   * 数字のセルの見た目。
   * ⚠️ 0件のときは下線もカーソルも出さない。押しても何も起きないため、
   *   押せるように見せると「壊れている」と受け取られる。
   */
  const clickable = (value: number): React.CSSProperties =>
    value ? { textDecoration: 'underline', cursor: 'pointer' } : {};

  /** 顧客一覧モーダルを開く。⚠️ 0件のときは開かない */
  const handleShow = (list: CustomerList[], labelValue: string) => {
    if (list.length === 0) return;
    setListShow({ show: true, label: labelValue, list });
  };

  /**
   * 顧客詳細を閉じたあとの再取得。
   * ⚠️ 詳細で日付を直すと歩留まりが変わるため、閉じたら読み直す。
   */
  const closeInformationEdit = () => {
    setEditId('');
    const fetchData = async () => {
      try {
        const response = await apiClient.post("/", { request: 'customerTrend', category });
        setOriginalUserData(response.data.customer.map(r => !r.medium ? ({ ...r, medium: 'その他' }) : r));
      } catch (error) {
        console.error("データ取得エラー:", error);
      }
    };
    fetchData();
  };

  const checkedChange = (e) => {
    const { name } = e.target;
    setChecked(prev => ({
      ...prev,
      [name]: { ...prev[name], show: !prev[name].show }
    }));
  };

  const theme: Record<string, React.CSSProperties> = {
    table: { borderCollapse: 'separate', borderSpacing: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', width: '100%', backgroundColor: '#ffffff' },
    th: { backgroundColor: '#f8fafc', color: '#475569', fontWeight: '600', padding: '8px 6px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: '11px' },
    tdName: { backgroundColor: '#f8fafc', color: '#334155', fontWeight: '700', padding: '8px 6px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '11px' },
    tdContent: { padding: '6px', verticalAlign: 'top', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
    budgetDivider: {
      borderTop: '1px dashed #cbd5e1',
      margin: '4px 0',
    }
  };
  const nestWrapperStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
  const getCardStyle = (colorCode: string): React.CSSProperties => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${colorCode}`, borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' });
  const lastYearBadgeStyle: React.CSSProperties = { backgroundColor: '#fef2f2', color: '#b91c1c', padding: '2px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #fca5a5' };

  const searchParts = () => {
    return <>
      <div className="d-flex flex-wrap mb-1 search_condition">
        <div className="m-1">
          <select className="target" onChange={(e) => setStartMonth(e.target.value)}>
            <option value="" selected>開始月</option>
            {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
            ))}
          </select>
        </div>
        <span className='d-flex align-items-center mx-1'>～</span>
        <div className="m-1">
          <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
            <option value="" selected>終了月</option>
            {originalMonthArray.map((month, index) => (<option key={index} value={month}>{month}</option>
            ))}
          </select>
        </div>
        <div className="m-1">
          <select className="target" onChange={(e) => {
            setTargetShop('');
            setTargetBrand('');
            setTargetSection(e.target.value);
          }}><option value="">課を選択</option>
            {sectionArray.map((item, index) =>
              <option value={item} selected={item === targetSection} key={index}>{item}</option>
            )}
          </select>
        </div>
        <div className="m-1">
          <select className="target" onChange={(e) => {
            setTargetBrand('');
            setTargetSection('');
            setTargetShop(e.target.value);
          }}>
            <option value="">店舗を選択</option>
            {originalShopArray.filter(shop => !shop.shop?.includes('店舗未設定')).map(shop =>
              <option value={shop.shop} selected={shop.shop === targetShop}>{shop.shop}</option>
            )}
          </select>
        </div>
      </div>
      <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
      <div className="d-flex flex-wrap mb-1 search_condition">
        {Object.entries(checked).map(([key, value], index) => {
          if ((value.name === '広告費' || value.name === '昨年実績') && targetShop) return;
          return <div className="m-1" key={index}>
            <label className="target checkbox d-flex align-items-center">
              <input type="checkbox" checked={value.show} name={key} className='me-1' onChange={checkedChange} />{value.name}を表示
            </label>
          </div>
        })}
        <div className="m-1">
          <label className="target checkbox d-flex align-items-center">
            <input type="checkbox" checked={isReverse === false} className='me-1' onChange={() => setIsReverse(!isReverse)} />期間を反転
          </label>
        </div>
        <div className="m-1">
          <label className="target checkbox d-flex align-items-center">
            <input type="checkbox" checked={isDuplicate === true} className='me-1' onChange={() => setIsDuplicate(!isDuplicate)} />名寄せした顧客も表示
          </label>
        </div>
      </div>
    </>
  };

  const graphParts = () => {
    return <>
      <div className="mt-3">
        {checked.graph.show && <><div className="d-flex justify-content-center">
          <div className="btn bg-primary text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'register' ? 'scale(1.1)' : '', opacity: graphCategory === 'register' ? '1' : '.3' }}
            onClick={() => setGraphCategory('register')}>反響数推移</div>
          <div className="btn bg-warning text-dark px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'contact' ? 'scale(1.1)' : '', opacity: graphCategory === 'contact' ? '1' : '.3' }}
            onClick={() => setGraphCategory('contact')}>接触数推移</div>
          <div className="btn bg-success text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'interview' ? 'scale(1.1)' : '', opacity: graphCategory === 'interview' ? '1' : '.3' }}
            onClick={() => setGraphCategory('interview')}>来場数推移</div>
          {/* ⚠️ 「物件案内数推移」は KPI から外したためボタンを消した（2026-09-11）。
                getValue の 'tour' の扱いは残してある。interviewKeys に
                ['interview', 'tour'] として入っており、来場の判定に使っている */}
          <div className="btn bg-danger text-white px-4 rounded-pill mx-2" style={{ fontSize: '12px', letterSpacing: '1px', transform: graphCategory === 'contract' ? 'scale(1.1)' : '', opacity: graphCategory === 'contract' ? '1' : '.3' }}
            onClick={() => setGraphCategory('contract')}>契約数推移</div>
        </div>
          {graphData.length > 0 && <div className="my-5">
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={graphData}>
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip content={CustomTooltip} />
                <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                <Legend content={<CustomLegend />} />
                {graphSeries.map((seriesName, index) =>
                  <Bar key={seriesName} dataKey={seriesName} stackId="a" fill={chartColors[index]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>}</>}
      </div>
    </>
  };

  const summary = () => {
    return <>
      <Table>
        <tbody style={{ fontSize: "12px" }}>
          <tr className="sticky-header text-center">
            <td className="sticky-column text-center" style={{ ...theme.th, width: '300px' }}>販促媒体名</td>
            {['全期間', ...formattedMonthArray].map((month, index) => (
              <td key={`th-${index}`} style={theme.th}>
                {month}
              </td>
            ))}
          </tr>
          {['全販促媒体', 'ホームページ反響計', ...(showSummary ? hpMediums : []), ...displayMediums]
            .map((medium, mediumIndex) => {
              const sectionShops = originalShopArray.filter(o => o.section === targetSection).map(o => o.shop);
              
              // ⚠️ 判定は matchesMediumRow に出した。グラフも同じものを使う
              const base = userData.filter(o => matchesMediumRow(o, medium, mediumIndex));
              const baseBudget = budgetList.filter(b =>
                b.section === 'spec'
                && (mediumIndex === 0 ? true :
                  mediumIndex === 1 ? !displayMediums.includes(mediumFormate(b.medium)) : mediumFormate(b.medium) === mediumFormate(medium))
                && (targetSection ? sectionShops.includes(b.shop) : true)
                && (targetShop ? b.shop === targetShop : true));

              return (
                <React.Fragment key={mediumIndex}>
                  <tr>
                    <td className='align-middle sticky-column text-center' style={theme.tdName} rowSpan={1}>
                      <div className="mb-1">{medium}</div>
                      {medium === 'ホームページ反響計' &&
                        <div
                          className="bg-primary btn text-white rounded-pill py-0 mt-2"
                          style={{ fontSize: '10px', cursor: 'pointer', padding: '2px 10px' }}
                          onClick={() => setShowSummary(!showSummary)}
                        >
                          詳細を{showSummary ? '閉じる' : '表示'}
                        </div>}
                    </td>
                    {['全期間', ...formattedMonthArray].map((month, monthIndex) => {
                      const total = getValue(base, monthIndex, month, 'register');
                      const interview = getValue(base, monthIndex, month, 'interview');
                      const contract = getValue(base, monthIndex, month, 'contract');
                      const application = getValue(base, monthIndex, month, 'application');
                      const contact = getValue(base, monthIndex, month, 'contact');
                      const filteredBudget = baseBudget.filter(b =>
                        b.section === 'spec' &&
                          monthIndex > 0 ? formate(b.budget_period).includes(formate(month)) : monthArray.map(m => formate(m)).includes(formate(b.budget_period).slice(0, 7)));
                      const formattedValue = filteredBudget.reduce((acc, cur) => acc + Number(cur.budget_value ?? 0), 0);

                      const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
                      const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
                      // const isDisplayLastYear = (isLastYear(month) || monthIndex === 0) && checked.comparison.show;

                      const lastYearBudget = baseBudget.filter(b =>
                        b.section === 'order'
                        && (monthIndex > 0 ? b.budget_period.includes(lastYear) : lastYearMonthArray.includes(b.budget_period.slice(0, 7)))
                      );
                      const formattedLastYearValue = lastYearBudget.reduce((acc, cur) => acc + cur.budget_value, 0);

                      let lastYearValue = { total: 0, interview: 0, contract: 0 };
                      if (monthIndex === 0 || isLastYear(month)) {
                        lastYearValue = {
                          total: getValue(base, monthIndex, lastYear, 'register', lastYearMonthArray).length,
                          interview: getValue(base, monthIndex, lastYear, 'interview', lastYearMonthArray).length,
                          contract: getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray).length,
                        };
                      }
                      return (
                        <td key={monthIndex} style={theme.tdContent}>
                          {/* --- もともとの入れ子構造を維持しつつ、モダンなスタイルを適用 --- */}
                          <div style={nestWrapperStyle}>
                            {checked.register.show && (
                              <div style={getCardStyle('#38bdf8')}>
                                <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>総反響</div>
                                <span style={{ color: total.length ? '#0284c7' : '#94a3b8', fontWeight: 700, fontSize: '13px', ...clickable(total.length) }}
                                  onClick={() => handleShow(total, `${medium} ${month} 総反響`)}>{total.length.toLocaleString()}</span>
                              </div>
                            )}

                            <div style={nestWrapperStyle}>
                              {checked.contact.show && (
                                <div style={getCardStyle('#0ea5e9')}>
                                  <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>接触</div>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                                    <span style={{ color: contact.length ? '#0284c7' : '#94a3b8', fontWeight: 700, fontSize: '13px', ...clickable(contact.length) }}
                                  onClick={() => handleShow(contact, `${medium} ${month} 接触`)}>{contact.length.toLocaleString()}</span>
                                    <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 500 }}>({isNaN(contact.length / total.length) ? 0 : Math.floor(contact.length / total.length * 100)}%)</span>
                                  </div>
                                </div>
                              )}

                              <div style={nestWrapperStyle}>
                                {checked.interview.show && (
                                  <div style={getCardStyle('#0284c7')}>
                                    <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>来場・物件案内</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                                      <span style={{ color: interview.length ? '#0284c7' : '#94a3b8', fontWeight: 700, fontSize: '13px', ...clickable(interview.length) }}
                                  onClick={() => handleShow(interview, `${medium} ${month} 来場・物件案内`)}>{interview.length.toLocaleString()}</span>
                                      <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 500 }}>({isNaN(interview.length / contact.length) ? 0 : Math.floor(interview.length / contact.length * 100)}%)</span>
                                    </div>
                                  </div>
                                )}

                                {checked.application.show && (
                                  <div style={getCardStyle('#0284c7')}>
                                    <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>申込み</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                                      <span style={{ color: application.length ? '#0284c7' : '#94a3b8', fontWeight: 700, fontSize: '13px', ...clickable(application.length) }}
                                  onClick={() => handleShow(application, `${medium} ${month} 申込み`)}>{application.length.toLocaleString()}</span>
                                      <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 500 }}>({isNaN(application.length / contact.length) ? 0 : Math.floor(application.length / contact.length * 100)}%)</span>
                                    </div>
                                  </div>
                                )}

                                <div style={nestWrapperStyle}>
                                  {checked.contract.show && (
                                    <div style={getCardStyle('#075985')}>
                                      <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>契約</div>
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                                        <span style={{ color: contract.length ? '#0284c7' : '#94a3b8', fontWeight: 700, fontSize: '13px', ...clickable(contract.length) }}
                                  onClick={() => handleShow(contract, `${medium} ${month} 契約`)}>{contract.length.toLocaleString()}</span>
                                        <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 500 }}>({isNaN(contract.length / interview.length) ? 0 : Math.floor(contract.length / interview.length * 100)}%)</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          {(checked.budget.show && !hpMediums.includes(medium)) &&
                            <>
                              <div style={theme.budgetDivider}></div>
                              <div style={nestWrapperStyle}>
                                {[{ label: '総額', color: '#c03442' }, { label: '反響単価', color: '#b02a37' }, { label: '来場単価', color: '#8a1e28' }, { label: '契約単価', color: '#64151c' }]
                                  .map((item, index) => {
                                    const deno = index === 1 ? total.length : index === 2 ? interview.length : contract.length;
                                    const prevDeno = index === 1 ? lastYearValue.total : index === 2 ? lastYearValue.interview : lastYearValue.contract;
                                    const budgetVal = Math.ceil(formattedValue / deno);
                                    const lastYearBudgetVal = Math.ceil(formattedLastYearValue / prevDeno);

                                    const formattedBudget = index === 0 ? formattedValue : Number.isFinite(budgetVal) ? budgetVal : '-';
                                    const lastYearFormattedBudget = index === 0 ? formattedLastYearValue : Number.isFinite(lastYearBudgetVal) ? lastYearBudgetVal : '-';

                                    return (
                                      <div key={index} style={getCardStyle(item.color)}>
                                        <span style={{ color: '#475569', fontWeight: 600, fontSize: '11px' }}>{item.label}</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                          <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>
                                            {formattedBudget === '-' ? '-' : `￥${formattedBudget.toLocaleString()}`}
                                          </span>
                                          {/* {isDisplayLastYear && (
                                            <span style={lastYearBadgeStyle}>
                                              昨: {lastYearFormattedBudget === '-' ? '-' : `￥${lastYearFormattedBudget.toLocaleString()}`}
                                            </span>
                                          )} */}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </>}
                        </td>
                      )
                    })}
                  </tr>
                  {/* --- 予算行も同様のフラット風カードUI --- */}

                </React.Fragment>
              );
            })}
        </tbody>
      </Table></>
  };

  return (
    <>
      <div className='content bg-white p-2'>
        {searchParts()}
        <div className="table-wrapper">
          <div className="list_table">
            {graphParts()}
            <div style={{ width: `${(monthArray.length + 1) * 175 + 120}px` }}>
              {summary()}
            </div>
          </div>
        </div>
      </div>
      <CustomerListModal
        show={listShow.show}
        label={listShow.label}
        list={listShow.list}
        onHide={() => setListShow({ show: false, label: '', list: [] })}
        onSelectCustomer={setEditId}
      />
      <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
    </>
  );
};

export default CustomerTrendKaeru;