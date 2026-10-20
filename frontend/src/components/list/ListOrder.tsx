import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
import Table from "react-bootstrap/Table";
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { shopFormate } from '../../utils/shopFormate';
import { setStyleClass } from '../../utils/setStyleClass';
import { mediumFormate } from '../../utils/mediumFormate';
import InformationEdit from '../information/InformationEdit';
import { generateULID } from '../../utils/createULID';
import { positions } from './listUtils';
import { monthFormate, handleBlack, toHalfWidth, matchesBlackList, previousMonthValue, currentMonthValue, isSummaryShop, summaryTableWidth, SUMMARY_COLUMN_WIDTH, lineIdField, filledField } from './listUtils';
import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './listTags';
import type { TagKey } from './listTags';
import { useIsSp } from '../../utils/isSp';
import OrderModal from './OrderModal';
import TrackingTouches, { landingLabel } from './TrackingTouches';
import { hiraToKata } from '../../utils/nexusUtils';

type Shop = { brand: string, shop: string, section: string, area: string };

type Medium = { medium: string, list_medium: number };

type InquiryCustomer = {
    id: number, inquiry_id: string, pg_id: string, inquiry_date: string, medium: string, response_medium: string, first_name: string, last_name: string,
    first_name_kana: string, last_name_kana: string, mobile: string, landline: string, mail: string, line_id?: string | null, zip: string, pref: string, city: string, town: string, street: string,
    building: string, brand: string, shop: string, sync: number, staff: string, area: string, reserved_date: string, hp_campaign: string,
    duplicate: string, hotlead_url: string,
    // フォームを埋め込んだページの URL パラメータ（? 以降）
    url_params?: string | null, landing_params?: string | null,
    // 顧客タグ。判定は listTags.ts に集約している
    duplicate_flag: number, gift_flag: number, support_flag: number, black_flag: number,
};

type Customer = { register: string, shop: string, interview: string, medium: string };

type Staff = { name: string, pg_id: string, shop: string, category: number, robo_id: string, period: string, section: string, position: string };

type Survey = { id: number, sync: number, brand: string, dateStr: string, name: string, considerationStart: string, desiredMoveIn: string, visitedCompanies: string, reasonForConsidering: string, reasonOther: string, futurePlan: string, futureOther: string, desiredSize: string, desiredLayout: string, priorityItem: string, expectedResidents: string, totalBudget: string, monthlyRepayment: string, annualIncome: string, yearsOfService: string, otherIncomePerson: string, otherAnnualIncome: string, ownFunds: string, otherLoans: string, thingsToDo: string, thingsToDoOther: string, housingType: string, housingTypeOther: string, landArea: string, referrerName: string, emailAddress: string, campaign: string };

type Props = {
    onReload: () => void;
};

type Black = {
    mobile: string,
    mail: string
};


const monthArray = getYearMonthArray(2025, 1);

/* 追客対象外の判定は listTags.ts の isExcluded / notNeedSync を使う */

/**
 * 重複判定に使う値の正規化（v2.2.165）。
 *
 * ⚠️⚠️ **`inquiry_customer.duplicate` 列は使わない。** ⚠️ 画面で全反響を突き合わせて判定する。
 *   氏名   … 前後の空白を落とし、途中のスペース（⚠️ 全角も）を取り除く
 *   携帯   … ⚠️ 全角→半角にして **数字だけ**にする（listUtils の toHalfWidth）
 *   メール … 前後の空白を落とし、途中のスペースを取り除く
 * ⚠️ 空になった値は ⚠️ **突き合わせに使わない**（⚠️ 空どうしを「一致」にしない）。
 */
const normalizeText = (value: string | null | undefined): string => String(value ?? '').trim().replace(/[\s　]+/g, '');
const nameKey = (item: InquiryCustomer): string => normalizeText(`${item.first_name || ''}${item.last_name || ''}`);
const mobileKey = (item: InquiryCustomer): string => toHalfWidth(String(item.mobile ?? '').trim());
const mailKey = (item: InquiryCustomer): string => normalizeText(item.mail);

/**
 * そのタグが「立っていない」か。絞り込み条件で使う。
 * ⚠️ v2.2.165: state を使わないのでコンポーネントの外へ出した（⚠️ useMemo の依存に入れずに済む）
 */
const isSync = (list: InquiryCustomer, tag: TagKey) => !isTagOn(list, tag);

/** ⚠️ 何項目以上一致したら重複とみなすか（指示書: 氏名・携帯・メールのうち2つ以上） */
const DUPLICATE_MIN_MATCHES = 2;

/**
 * 重複顧客の一覧（inquiry_id → 重複相手の行）。
 *
 * ⚠️⚠️ **総当たり（n²）にしない。** ⚠️ 反響は数万件ある。
 *   ⚠️ 3つの値それぞれで「値 → 行番号」の索引を1回作り、
 *   ⚠️ 同じ値を持つ行だけを相手の候補として、⚠️ 一致した項目の数を数える。
 * ⚠️ 自分自身は数えない。
 */
const buildDuplicateMap = (list: InquiryCustomer[]): Map<string, InquiryCustomer[]> => {
    const keyFns = [nameKey, mobileKey, mailKey];
    const keys = list.map(item => keyFns.map(fn => fn(item)));
    const indexes = keyFns.map((_, k) => {
        const index = new Map<string, number[]>();
        keys.forEach((rowKeys, i) => {
            const key = rowKeys[k];
            if (key === '') return;
            const rows = index.get(key);
            if (rows) rows.push(i);
            else index.set(key, [i]);
        });
        return index;
    });

    const result = new Map<string, InquiryCustomer[]>();
    keys.forEach((rowKeys, i) => {
        const matches = new Map<number, number>();
        rowKeys.forEach((key, k) => {
            if (key === '') return;
            for (const j of indexes[k].get(key) ?? []) {
                if (j !== i) matches.set(j, (matches.get(j) ?? 0) + 1);
            }
        });
        const partners: InquiryCustomer[] = [];
        matches.forEach((count, j) => {
            if (count >= DUPLICATE_MIN_MATCHES) partners.push(list[j]);
        });
        if (partners.length > 0) result.set(list[i].inquiry_id, partners);
    });
    return result;
};

const ListOrder = ({ onReload }: Props) => {
    const { authority, token, category } = useContext(AuthContext);
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [originalList, setOriginalList] = useState<InquiryCustomer[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [targetSync, setTargetSync] = useState<number | null>(0);
    const [targetMedium, setTargetMedium] = useState<string>('');
    const [targetName, setTargetName] = useState<string>('');
    const [targetAddress, setTargetAddress] = useState<string>('');
    const [targetShop, setTargetShop] = useState<string>('');
    const [targetSection, setTargetSection] = useState('');
    const [displayLength, setDisplayLength] = useState<number>(20);
    const [originalBeforeList, setOriginalBeforeList] = useState<Survey[]>([]);
    const [modalBeforeContent, setModalBeforeContent] = useState<Survey>();
    const [show, setShow] = useState(false);
    const [editId, setEditId] = useState('');
    /** ⚠️ v2.2.199: 流入履歴を開いている反響（TrackingTouches.tsx） */
    const [trackingTarget, setTrackingTarget] = useState<{ id: string, name: string } | null>(null);
    const [blackList, setBlackList] = useState<Black[]>([]);
    const [sections, setSections] = useState<string[]>([]);

    const [checkedIds, setCheckedIds] = useState<string[]>([]);

    const isSp = useIsSp();
    const loaderRef = useRef<HTMLDivElement>(null);

    /**
     * 上部サマリーの列（店舗）。
     *
     * ⚠️⚠️ **判定を1箇所にまとめた。** 2026-09-09 まで
     *   `!未設定 && !FH && !JH八代店` を見出しと本文で**別々に書いて**いた。
     *   片方だけ直すと見出しと数値の列がずれる。条件は listUtils の
     *   isSummaryShop に移しただけで、中身は変えていない。
     */
    const summaryShops = useMemo(
        () => shopArray.filter(item => isSummaryShop(item.shop)),
        [shopArray]
    );

    /**
     * 本文の行で回す列。⚠️ 先頭に「グループ全体」の擬似店舗を足す。
     *   見出し側（summaryShops）より1つ多くなるので、幅の計算では +1 する。
     */
    const summaryRows = useMemo(
        () => [{ brand: '', shop: 'グループ全体', section: '', area: '' }, ...summaryShops],
        [summaryShops]
    );

    useEffect(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        // ⚠️ monthArray はモジュール直下の const（この画面だけ持ち方が違う）
        const months = monthArray;
        /**
         * ⚠️⚠️ **開始月は当月の1か月前**（2026-09-09 変更）。
         *   両方を当月にしていたため、月初に開くと当月の数件しか見えなかった。
         *
         * ⚠️ months を渡している。1か月前が選択肢に無い場合は先頭が返る。
         *   選択肢に無い値を入れると、select の表示と絞り込みが食い違う。
         */
        setStartMonth(previousMonthValue({ monthArray: months }));
        setEndMonth(currentMonthValue());
        setSelectedMonth([`${year}/${month}`]);
        const thisYear = now.getMonth() <= 4 ? year : year + 1;

        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'list', category });
                setCustomerList(response.data.summary);
                setShopArray(response.data.shop);
                const responseSection = response.data.section.filter(s => s.division === '注文事業').map(s => s.name);
                setStaffList(response.data.staff.filter((s: Staff) => s.period === String(thisYear) && responseSection.includes(s.section))
            .sort((a, b) => {
                const positionA = positions.indexOf(a.position) ?? 6;
                const positionB = positions.indexOf(b.position) ?? 6;
                return positionA - positionB}));
                setMediumArray(response.data.medium.filter((m: Medium) => m.list_medium === 1));
                setOriginalList(response.data.inquiry);
                setOriginalBeforeList(response.data.survey);
                setBlackList(response.data.black);
                setSections(responseSection);
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        };

        fetchData();
    }, [category]);

    useEffect(() => {
        const startIndex = startMonth ? monthArray.indexOf(startMonth) : 0;
        const endIndex = endMonth ? monthArray.indexOf(endMonth) : monthArray.length - 1;
        const filteredMonth = monthArray.slice(startIndex, endIndex + 1);
        setSelectedMonth(filteredMonth);
    }, [startMonth, endMonth]);

    useEffect(() => {
        if (isSp) {
            setTargetSync(null);
        }
    }, [isSp]);

    const mediumValue = targetMedium === '公式LINE' ? 'ALLGRIT' : targetMedium;

    /**
     * 絞り込み条件をまとめた鍵。
     *
     * ⚠️ v2.2.165: 「条件が変わったとき」だけ、表示件数・チェック・残す行（keptIds）を戻す。
     *   ⚠️⚠️ **一覧の中身が変わったとき（店舗・タグの変更）に戻さないこと。**
     *   ⚠️ 戻すと、1件変えるたびに表示が先頭20件に戻り、スクロール位置が飛ぶ。
     */
    const filterKey = JSON.stringify([selectedMonth, targetShop, mediumValue, targetSync, targetName, targetAddress, targetSection]);

    /**
     * 店舗・タグを変更した行（inquiry_id）。⚠️ 条件に合わなくなっても ⚠️ **その場では残す**（2026-10-06 の確認）。
     * ⚠️ 押し間違えたときに、その行ですぐ戻せるようにするため。
     * ⚠️ 鍵（filterKey）が変わったら無効にする（⚠️ 条件を変えれば正しく絞り込まれる）。
     * ⚠️ 取込（同期）した行は入れない。⚠️ 従来どおり「未取込」で絞り込み中なら消える。
     */
    const [kept, setKept] = useState<{ key: string; ids: Set<string> }>({ key: '', ids: new Set() });
    const keptIds = kept.key === filterKey ? kept.ids : null;
    const keepRow = (id: string) => setKept(prev => {
        const ids = new Set(prev.key === filterKey ? prev.ids : []);
        ids.add(id);
        return { key: filterKey, ids };
    });

    /** ⚠️ 課の店舗。⚠️ v2.2.164 までは**1件ごとに**作り直していた */
    const sectionShops = useMemo(
        () => new Set(shopArray.filter(s => s.section === targetSection).map(s => s.shop)),
        [shopArray, targetSection]
    );

    /**
     * 表に出す反響。
     *
     * ⚠️⚠️ v2.2.165: **これをそのまま表に使う。**
     *   ⚠️ v2.2.164 までは、この結果を useEffect で `inquiryList` という state に**写して**いた。
     *   ⚠️ 店舗・タグの変更はその写しにだけ書かれ、⚠️ **元の originalList には入らなかった**ため、
     *   ⚠️ 絞り込みを変えると写しが作り直されて ⚠️ **変更が画面から消えて見えた**（DB には保存済み）。
     *   ⚠️ 今は変更を originalList に書き、⚠️ 写しは持たない。
     */
    const filteredInquiryList = useMemo(() => originalList.filter(item => {
        if (keptIds?.has(item.inquiry_id)) return true;
        const fullName = `${item.first_name || ""}${item.last_name || ""}`;
        const fullAddress = `${item.pref || ""}${item.city || ""}${item.town || ""}${item.street || ""}${item.building || ""}`;
        const resMedium = item.response_medium || '';
        const inqDate = item.inquiry_date || '';
        const itemShop = item.shop || '';

        return (
            selectedMonth.includes(monthFormate(inqDate)) &&
            (targetShop === '' || itemShop.includes(targetShop)) &&
            (mediumValue === '' || resMedium === mediumValue) &&
            (targetSync === null || (targetSync === 0 ?
                (item.sync === targetSync && (isSync(item, 'duplicate') && isSync(item, 'support') && isSync(item, 'black')))
                : item.sync === targetSync || !isSync(item, 'duplicate') || !isSync(item, 'support') || !isSync(item, 'black'))) &&
            (targetName === '' || fullName.includes(targetName)) &&
            (targetSection === '' || sectionShops.has(item.shop)) &&
            (targetAddress === '' || fullAddress.includes(targetAddress)))
    }), [originalList, selectedMonth, targetShop, mediumValue, targetSync, targetName, targetAddress, targetSection, sectionShops, keptIds]);

    const totalLength = filteredInquiryList.length;

    /** ⚠️ 条件が変わったときだけ戻す（filterKey の注記参照） */
    useEffect(() => {
        setDisplayLength(20);
        setCheckedIds([]);
    }, [filterKey]);

    /** 重複顧客（v2.2.165）。⚠️ 期間などの絞り込みに関係なく、⚠️ **反響すべて**から探す */
    const duplicateMap = useMemo(() => buildDuplicateMap(originalList), [originalList]);

    /** ⚠️ v2.2.164 までは useEffect で state に写していた。⚠️ 写さずにそのまま使う */
    const surveyBeforeList = useMemo(
        () => originalBeforeList.filter(item => selectedMonth.includes(monthFormate(item.dateStr || ''))),
        [originalBeforeList, selectedMonth]
    );

    /**
     * 事前アンケートの索引（ブランド＋メール → アンケート）。
     * ⚠️ v2.2.164 までは**1行ごとに2回**一覧を頭から探していた。
     * ⚠️ 同じ鍵が複数あるときは ⚠️ **先に出てきたもの**（従来の find と同じ）。
     */
    const surveyByMail = useMemo(() => {
        const map = new Map<string, Survey>();
        surveyBeforeList.forEach(s => {
            const key = `${s.brand}\u0000${s.emailAddress}`;
            if (!map.has(key)) map.set(key, s);
        });
        return map;
    }, [surveyBeforeList]);
    const surveyOf = (brand: string, mail: string) => surveyByMail.get(`${brand}\u0000${mail}`);

    /**
     * 上部サマリーの件数（店舗 → 件数）。⚠️ キー '' はグループ全体。
     *
     * ⚠️ v2.2.164 までは ⚠️ **店舗の数 × 全件**を数え直していた（列ごとに filter）。
     *   ⚠️ 1回だけ舐めて数える。⚠️ 判定（店舗の完全一致・未同期かつ対象外でない）は従来と同じ。
     */
    const summaryCounts = useMemo(() => {
        const inquiry = new Map<string, number>();
        const unSync = new Map<string, number>();
        const reserve = new Map<string, number>();
        const add = (map: Map<string, number>, shop: string) => {
            map.set('', (map.get('') ?? 0) + 1);
            // ⚠️ 店舗が空の行を '' に二重で数えない
            if (shop) map.set(shop, (map.get(shop) ?? 0) + 1);
        };
        const months = new Set(selectedMonth);
        originalList.forEach(c => {
            if (!months.has(monthFormate(c.inquiry_date || ''))) return;
            add(inquiry, c.shop);
            if (c.sync === 0 && !isExcluded(c)) add(unSync, c.shop);
        });
        customerList.forEach(c => {
            if (months.has(monthFormate(c.interview || ''))) add(reserve, c.shop);
        });
        return { inquiry, unSync, reserve };
    }, [originalList, customerList, selectedMonth]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayLength((prev) => {
                        if (prev < totalLength) return prev + 20;
                        return prev;
                    });
                }
            },
            { rootMargin: '200px' }
        );

        const currentLoader = loaderRef.current;
        if (currentLoader) {
            observer.observe(currentLoader);
        }

        return () => {
            if (currentLoader) observer.unobserve(currentLoader);
        };
    }, [totalLength]);


    // 💡 修正: 指定された同期成功後のロジックを復元し、一括処理にも対応
    const handleSync = async (idValues: string | string[]) => {
        const idsToProcess = Array.isArray(idValues) ? idValues : [idValues];
        const targets = filteredInquiryList.filter(i => idsToProcess.includes(i.inquiry_id));

        if (targets.length === 0) return;

        const unassigned = targets.find(t => shopFormate(t.shop || '', t.brand || '', shopArray)?.includes('店舗未設定'));
        if (unassigned) {
            alert(`同期に失敗しました。 ※店舗が未選択の顧客が含まれています。`);
            return;
        }

        const confirmMsg = targets.length === 1
            ? `${shopFormate(targets[0].shop || '', targets[0].brand || '', shopArray)} ${targets[0].first_name || ''} ${targets[0].last_name || ''}様 顧客情報を取り込みますか?`
            : `選択した ${targets.length} 件の顧客情報を一括で取り込みますか?`;

        if (!window.confirm(confirmMsg)) {
            console.log("キャンセルされました。");
            return;
        }

        let successCount = 0;
        let failCount = 0;
        let lastMessage = '';
        /**
         * 取り込めた行（inquiry_id → pg_id）。
         * ⚠️⚠️ v2.2.165: 最後に ⚠️ **最新の originalList に**反映する（setOriginalList(prev => …)）。
         *   ⚠️ v2.2.164 までは開始時点の写しを最後に丸ごと戻していた。⚠️ 今は店舗・タグの変更も
         *   originalList に書くため、⚠️ 写しで戻すと ⚠️ **取込中に付けたタグが消える。**
         */
        const synced = new Map<string, string>();

        for (const filteredCustomer of targets) {
            const filteredShop = shopFormate(filteredCustomer.shop || '', filteredCustomer.brand || '', shopArray) ?? '';
            const filteredMedium = mediumFormate(filteredCustomer.medium || '');
            const brandValue = filteredCustomer.brand ?? '';
            const mailValue = filteredCustomer.mail ?? '';
            // ⚠️ 従来の find（ブランド＋メール → その id で再検索）と同じ結果。⚠️ 索引から引く
            const targetData = surveyOf(brandValue, mailValue);

            const phone_number_1 = toHalfWidth(filteredCustomer.mobile || '') || toHalfWidth(filteredCustomer.landline || '');
            const phone_number_2 = phone_number_1 === toHalfWidth(filteredCustomer.landline || '') ? '' : toHalfWidth(filteredCustomer.landline || '');

            const brands: Record<string, string> = {
                'KH': '国分ハウジング',
                'DJ': 'デイジャストハウス',
                'なご': 'なごみ工務店',
                '2L': 'ニーエルホーム',
                'JH': 'ジャスフィーホーム',
                'FH': 'フルコミホーム',
                'PG': 'PG HOUSE'
            };

            const brandValueStr = brands[filteredShop.slice(0, 2)] || '';

            const postData = {
                id: generateULID(),
                inquiry_id: filteredCustomer.inquiry_id,
                in_charge_user: filteredCustomer.staff ? filteredCustomer.staff : `${filteredShop} 管理`,
                customer_contacts_name: `${filteredCustomer.first_name || ''} ${filteredCustomer.last_name || ''}`,
                /**
                 * ⚠️⚠️ **フリガナは必ずカタカナに直してから登録する**（2026-09-25 の指示）。
                 *   ⚠️ 反響フォームは**ひらがなで送ってくる顧客が多い。**
                 *   ⚠️ Nexus へ移行できるのはカタカナだけなので、**入口で揃えておく。**
                 *   ⚠️ 変換は utils/nexusUtils.ts の `hiraToKata()`。
                 *   ⚠️ 姓名間の半角スペースは**この行がもともと入れている。**
                 */
                customer_contacts_name_kana: hiraToKata(`${filteredCustomer.first_name_kana || ''} ${filteredCustomer.last_name_kana || ''}`).trim(),
                in_charge_store: filteredShop,
                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: filteredCustomer.inquiry_date || '',
                customer_contacts_mobile_phone_number: phone_number_1,
                customer_contacts_phone_number: phone_number_2,
                customer_contacts_email: mailValue,
                ...lineIdField(filteredCustomer.line_id),
                ...filledField('url_params', filteredCustomer.url_params),
                ...filledField('landing_params', filteredCustomer.landing_params),
                postal_code: filteredCustomer.zip || '',
                full_address: `${filteredCustomer.pref || ''} ${filteredCustomer.city || ''} ${filteredCustomer.town || ''} ${filteredCustomer.street || ''} ${filteredCustomer.building || ''}`,
                sales_promotion_name: filteredCustomer.response_medium || '',
                remarks: targetData ? `反響経路:${filteredCustomer.hp_campaign}／検討時期:${targetData?.considerationStart}\n入居希望時期:${targetData?.desiredMoveIn}／新築検討理由:${targetData?.reasonForConsidering} ${targetData?.reasonOther}\n今後の予定:${targetData?.futurePlan} ${targetData?.futureOther}／希望の広さ:${targetData?.desiredSize}／希望の間取り:${targetData?.desiredLayout}\n重視項目:${targetData?.priorityItem}／入居予定人数:${targetData?.expectedResidents}\n総予算:${targetData?.totalBudget}／返済額:${targetData?.monthlyRepayment}\n前年度の年収:${targetData?.annualIncome}／勤続年数:${targetData?.yearsOfService}\n年収がある方：${targetData?.otherIncomePerson}／年収がある方の年収:${targetData?.otherAnnualIncome}\n自己資金:${targetData?.ownFunds}／その他ローン:${targetData?.otherLoans}\n当日したいこと:${targetData?.thingsToDo} ${targetData?.thingsToDoOther}／新居の希望:${targetData?.housingType} ${targetData?.housingTypeOther}\n希望の土地エリア:${targetData?.landArea}／紹介者:${targetData?.referrerName}`
                    : '',
                reserved_interview: filteredCustomer.reserved_date || '',
                response_status: filteredMedium,
                hp_campaign: filteredCustomer.hp_campaign || '',
                status: '見込み',
                planned_construction_site: filteredCustomer.area || '',
                request: 'list',
                section: shopArray.find(s => s.shop === filteredShop)?.section ?? '',
                brand: brandValueStr,
                category,
                roll: 'insert'
            };

            try {
                const response = await apiClient.post("", postData);
                if (response.data && response.data.status === 'success') {
                    successCount++;
                    lastMessage = response.data.message || '同期が完了しました。';

                    // 💡 指定された元のロジックを適用
                    synced.set(filteredCustomer.inquiry_id, response.data.pg_id?.pg_id ?? '');
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error("データ取得エラー:", error);
                failCount++;
            }
        }

        // 💡 状態を一度に更新
        if (synced.size > 0) {
            setOriginalList(prev => prev.map(o => synced.has(o.inquiry_id)
                ? { ...o, pg_id: synced.get(o.inquiry_id) ?? '', sync: 1 }
                : o));
        }

        if (targets.length === 1) {
            if (successCount > 0) alert(lastMessage);
            else alert('同期に失敗しました。');
        } else {
            alert(`一括同期が完了しました。\n成功: ${successCount}件\n失敗: ${failCount}件`);
        }

        setCheckedIds([]);
        onReload();
    };

    const handleCheck = (id: string) => {
        setCheckedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
    };
    /** ⚠️ 1行ごとの includes をやめる（⚠️ チェックが増えると行数 × 件数になる） */
    const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

    /**
     * 1行の値を書き換える。
     * ⚠️⚠️ v2.2.165: **元データ（originalList）に書く。** ⚠️ 写し（旧 inquiryList）は無くなった。
     * ⚠️ 書き換えた行は keepRow で「その場に残す」（filterKey の注記参照）。
     */
    const patchRow = (id: string, patch: Partial<InquiryCustomer>) => {
        setOriginalList(prev => prev.map(row => row.inquiry_id === id ? { ...row, ...patch } : row));
        keepRow(id);
    };

    /** 店舗・担当営業の変更 */
    const listChange = async (id: string, listValue: string, demandValue: 'shop_change' | 'staff_change') => {
        const key = demandValue === 'shop_change' ? 'shop' : 'staff';

        patchRow(id, { [key]: listValue });

        try {
            const response = await apiClient.post('', {
                list: listValue,
                roll: demandValue,
                inquiry_id: id,
                request: 'list',
                category
            });
            if (response.data?.status === 'error') {
                alert(response.data.message ?? '処理に失敗しました。');
            }
        } catch (error) {
            console.error('エラー:', error);
        }
    };

    /**
     * 顧客タグの ON / OFF。
     *
     * ⚠️ 旧実装は black_list に文字列を追記し、出現回数の偶奇で判定していた。
     *   「押すたびに反転」する仕様だったため、通信が二重に走ると状態が
     *   ずれて戻せなくなった。ここでは次の値を明示して送るので冪等になる。
     */
    const toggleTag = async (item: InquiryCustomer, tag: TagKey) => {
        const nextValue = isTagOn(item, tag) ? 0 : 1;
        const field = TAG_FIELD[tag];

        patchRow(item.inquiry_id, { [field]: nextValue });

        try {
            const response = await apiClient.post('', {
                list: tag,
                value: nextValue,
                roll: 'tag',
                inquiry_id: item.inquiry_id,
                request: 'list',
                category
            });

            if (response.data?.status !== 'success') {
                // 失敗したら楽観更新を巻き戻す。画面と実体がずれたままになるのを防ぐ
                patchRow(item.inquiry_id, { [field]: nextValue === 1 ? 0 : 1 });
                alert(response.data?.message ?? 'タグの更新に失敗しました。');
                return;
            }
        } catch (error) {
            console.error('エラー:', error);
            patchRow(item.inquiry_id, { [field]: nextValue === 1 ? 0 : 1 });
            alert('通信エラーが発生しました。');
            return;
        }

        // ブラックリストへの登録は名簿テーブル側の更新も伴う
        if (tag === 'black' && nextValue === 1) {
            handleBlack(
                item.brand || '',
                `${item.first_name || ''}${item.last_name || ''}`,
                item.mobile || '',
                item.mail || '',
                item.zip || '',
                `${item.pref || ''}${item.city || ''}${item.town || ''}${item.street || ''}${item.building || ''}`,
                category
            );
        }

        // 追客対象の件数が変わるタグは、メニューの未同期件数を数え直す
        if (tag !== 'gift') onReload();
    };

    const [modalContent, setModalContent] = useState<string>('');

    /**
     * 事前アンケートを開く。
     * ⚠️ v2.2.165: 列を1つずつ写していたのをまとめた（⚠️ 中身は同じ。sync は 0、campaign は反響の値）。
     * ⚠️ setState は Promise を返さないので await しない。
     */
    const showBeforeSurvey = (survey: Survey, campaignValue: string) => {
        setModalContent('beforeSurvey');
        setModalBeforeContent({ ...survey, sync: 0, campaign: campaignValue });
        setShow(true);
    };

    const modalClose = () => setShow(false);

    /** 上部サマリーの1マス。⚠️ 店舗 '' はグループ全体（summaryCounts 参照） */
    const inquiryFilter = (shopValue: string) => summaryCounts.inquiry.get(shopValue) ?? 0;
    const unSyncFilter = (shopValue: string) => summaryCounts.unSync.get(shopValue) ?? 0;
    const reserveFilter = (shopValue: string) => summaryCounts.reserve.get(shopValue) ?? 0;

    /** 反響・来場の対象の営業（category = 1）。⚠️ 目標の計算と担当営業の選択肢で使う */
    const activeStaff = useMemo(() => staffList.filter(s => s.category === 1), [staffList]);

    const achievementFilter = (shopValue: string, value: number) => {
        return activeStaff.filter(s => (shopValue ? s.shop === shopValue : true)).length * value;
    };

    /**
     * 店舗の選択肢（ブランド付きの表記）。
     * ⚠️ v2.2.164 までは ⚠️ **1行ごとに**全店舗を shopFormate して作り直していた。
     */
    const formattedShops = useMemo(
        () => shopArray.map(shopItem => shopFormate(shopItem.shop, shopItem.brand, shopArray) ?? ''),
        [shopArray]
    );

    /**
     * ブラックリスト該当か。
     * 名簿テーブル（black_list）に一致するか、この反響に black タグが立っている場合。
     *
     * ⚠️ テーブル名 black_list（名簿）と、旧カラム名 black_list（タグ文字列）は
     *   まったくの別物だった。タグ側はフラグカラムへ移行済み。
     *
     * ⚠️⚠️ **突合そのものは list/listUtils.ts の `matchesBlackList()` にある。**
     *   ⚠️ 注文・建売・中古の**3画面で共有**している。⚠️ **ここに書き戻さないこと。**
     *   ⚠️ 電話番号は `isValidMobile()` を通ったものだけを使う（2026-09-18 の指示）。
     *     ⚠️ 実測でこの画面の該当が **183件 → 141件**（⚠️ **42件が誤検知**）になる。
     */
    const isBlack = (item: InquiryCustomer) =>
        matchesBlackList(item.mail, item.mobile, blackList) || isTagOn(item, 'black');

    const closeInformationEdit = () => setEditId('');


    // ⚠️ 集客イベントの導線は 2026-09-06 にヘッダーへ移した。
    //   コンポーネントは header/EventList.tsx にあり、
    //   「集客イベント → 反響一覧」から開く。ここからは呼び出していない。

    /**
     * その行の事前アンケート。
     * ⚠️ 従来の find（brand・mail の完全一致）と同じ。⚠️ 値が無い行は探さない（⚠️ 空文字どうしで一致させない）。
     */
    const rowSurvey = (item: InquiryCustomer) =>
        item.brand == null || item.mail == null ? undefined : surveyOf(item.brand, item.mail);

    return (
        <>
            {/*
              ⚠️ v2.2.165: SaaS 風の見た目。⚠️ **このコンポーネント専用**（lo_ で始まるクラス）。
              ⚠️⚠️ **表を包む要素に overflow: hidden を付けないこと。**
                ⚠️ 見出し行の固定（sticky-header）は ⚠️ **スクロールする .inquiry を基準**に効いている。
                ⚠️ 間に overflow: hidden を挟むと固定が外れる。⚠️ 角丸と影は .inquiry 自体に付ける。
            */}
            <style>{`
                .lo_saas { background: #f6f7f9; color: #1f2937; }
                .lo_saas .lo_toolbar { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
                                       box-shadow: 0 1px 2px rgba(15, 23, 42, .05); padding: 6px 8px; gap: 2px; }
                .lo_saas .lo_toolbar .target { border: 1px solid #d1d5db; border-radius: 8px; background: #fff;
                                               color: #1f2937; padding: 0 8px; outline: none; }
                .lo_saas .lo_toolbar .target:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
                .lo_saas .lo_tilde { color: #9ca3af; }
                .lo_saas .lo_btn { border: 0; border-radius: 8px; font-size: 13px; font-weight: 600; height: 30px;
                                   padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
                .lo_saas .lo_btn_primary { background: #2563eb; color: #fff; }
                .lo_saas .lo_btn_primary:hover { background: #1d4ed8; }
                .lo_saas .lo_btn_success { background: #16a34a; color: #fff; }
                .lo_saas .lo_btn_success:hover { background: #15803d; }

                .lo_saas .inquiry { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
                                    box-shadow: 0 1px 3px rgba(15, 23, 42, .06), 0 1px 2px rgba(15, 23, 42, .04); }
                .lo_saas .inquiry .table { color: #1f2937; margin-bottom: 0; --bs-table-color: #1f2937;
                                           --bs-table-border-color: #eef0f3; }
                .lo_saas .inquiry .table > thead td { background: #f8fafc; color: #4b5563; font-weight: 600;
                                                      border-bottom: 1px solid #e5e7eb; }
                .lo_saas .inquiry .table td { border-color: #eef0f3; }
                .lo_saas .inquiry .lo_summary { margin-bottom: 12px; }
                .lo_saas .lo_dup { border-radius: 6px; padding: 1px 6px; font-size: 11px; width: fit-content; }
                .lo_saas .lo_badge { display: inline-flex; align-items: center; border-radius: 6px; padding: 3px 7px;
                                     color: #fff; cursor: pointer; }
                .lo_saas .lo_badge_sync { background: #2563eb; }
                .lo_saas .lo_badge_survey { background: #16a34a; }
                /* ⚠️ v2.2.199: 流入履歴（TrackingTouches.tsx）を開く札。⚠️ 媒体名の下に小さく出す */
                .lo_saas .lo_flow { display: inline-flex; align-items: center; gap: 3px; margin-top: 3px; border: 1px solid #bfdbfe;
                                    background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 0 7px; font-size: 10px;
                                    font-weight: 700; cursor: pointer; line-height: 1.6; }
                .lo_saas .lo_flow:hover { background: #dbeafe; }
                .lo_saas .lo_flow.is_id { border-color: #e5e7eb; background: #f9fafb; color: #6b7280; }
            `}</style>
            <div className='inquiry_table spec lo_saas p-2'>
                <div className="lo_toolbar d-flex flex-wrap mb-2 align-items-center" style={{ paddingTop: isSp ? '30px' : '' }}>
                    <div className="m-1">
                        {/*
                          ⚠️⚠️ **value で制御する。** 以前は <option selected> で
                            常に末尾（当月）を選んでいたため、開始月の初期値を
                            1か月前にすると**表示は当月・絞り込みは前月**という
                            食い違いが起きる。
                          ⚠️ React は <option selected> に警告を出す作法違反でもある。
                        */}
                        <select className="target" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={{ fontSize: '13px' }}>
                            {monthArray.map((month) => (<option key={month} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lo_tilde">~</div>
                    <div className="m-1">
                        {/* ⚠️ 開始月と同じ理由で value 制御にする */}
                        <select className="target" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} style={{ fontSize: '13px' }}>
                            {monthArray.map((month) => (<option key={month} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" value={targetShop} onChange={(e) => setTargetShop(e.target.value)} style={{ fontSize: '13px' }}>
                            <option value=''>全店舗表示</option>
                            {shopArray.map((item) =>
                                <option key={item.shop} value={item.shop}>{item.shop}</option>
                            )}
                        </select>
                    </div>
                    {!isSp && <>
                        <div className="m-1">
                            <select className="target" value={targetSection} onChange={(e) => setTargetSection(e.target.value)} style={{ fontSize: '13px' }}>
                                <option value=''>全課表示</option>
                                {sections.map(item =>
                                    <option key={item} value={item}>{item}</option>
                                )}
                            </select>
                        </div>
                        <div className="m-1">
                            <select className="target" value={targetMedium} onChange={(e) => setTargetMedium(e.target.value)} style={{ fontSize: '13px' }}>
                                <option value=''>全媒体表示</option>
                                {mediumArray.map((item) =>
                                    <option key={item.medium} value={item.medium}>{item.medium}</option>
                                )}
                            </select>
                        </div>
                        <div className="m-1">
                            {/* ⚠️ v2.2.165: <option selected> をやめて value で制御する（⚠️ 中身は同じ） */}
                            <select className="target" value={targetSync === null ? '' : String(targetSync)} onChange={(e) => {
                                const value = e.target.value;
                                setTargetSync(value === '' ? null : Number(value));
                            }} style={{ fontSize: '13px' }}>
                                <option value="">全て表示</option>
                                <option value="1">取込済み</option>
                                <option value="0">未取込</option>
                            </select>
                        </div>
                        <div className="m-1">
                            <input type="text" className='target' placeholder='氏名で検索' onChange={(e) => setTargetName(e.target.value)} style={{ fontSize: '13px' }} />
                        </div>
                        <div className="m-1">
                            <input type="text" className='target' placeholder='住所で検索' onChange={(e) => setTargetAddress(e.target.value)} style={{ fontSize: '13px' }} />
                        </div>
                    </>}

                    <button type="button" className="lo_btn lo_btn_primary m-1" onClick={() => setEditId('new')}>
                        <i className="fa-solid fa-plus" aria-hidden="true" />新規登録
                    </button>

                    {checkedIds.length > 0 && (
                        <button type="button" className="lo_btn lo_btn_success m-1" onClick={() => handleSync(checkedIds)}>
                            <i className="fa-solid fa-check-double" aria-hidden="true" /> {checkedIds.length}件を一括同期
                        </button>
                    )}
                </div>

                <div className='p-0 inquiry'>
                    {!isSp &&
                        <Table
                            striped bordered hover
                            className="lo_summary"
                            style={{
                                tableLayout: 'fixed',
                                width: `${summaryTableWidth(summaryShops.length + 1, 130)}px`
                            }}
                        >
                            <thead className='sticky-header' style={{ fontSize: "10px" }}>
                                <tr className='sticky-header' style={{ textAlign: 'center' }}>
                                    <td className="sticky-column" style={{ width: '130px' }}>店舗名</td>
                                    <td style={{ width: `${SUMMARY_COLUMN_WIDTH}px` }}>グループ全体</td>
                                    {summaryShops.map((value) => (<td key={value.shop} className='text-center' style={{ width: `${SUMMARY_COLUMN_WIDTH}px` }}>{value.shop.replace('店', '')}</td>))}
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: "12px" }}>
                                {['反響合計(未同期)', '反響目標(単月)', '来場合計', '来場目標(単月)'].map((category, cIndex) => <tr key={category} className='text-center'>
                                    <td className="sticky-column">{category}</td>
                                    {summaryRows
                                        .map((value, sIndex) => {
                                            const shopValue = sIndex === 0 ? '' : value.shop;
                                            let totalValue;
                                            if (cIndex === 0) {
                                                totalValue = (`${inquiryFilter(shopValue)}(${unSyncFilter(shopValue)})`);
                                            } else if (cIndex === 1 || cIndex === 3) {
                                                totalValue = achievementFilter(shopValue, cIndex === 1 ? 8 : 4);
                                            } else {
                                                totalValue = reserveFilter(shopValue);
                                            }
                                            return <td key={value.shop} className='text-center' style={{ width: `${SUMMARY_COLUMN_WIDTH}px` }}>{totalValue}</td>
                                        })}
                                </tr>
                                )}
                            </tbody>
                        </Table>}

                    <Table striped bordered hover style={{ width: isSp ? '1200px' : '1800px', fontSize: isSp ? "8px" : "12px" }}>
                        <thead className='sticky-header'>
                            <tr className='sticky-header'>
                                {/* 💡 チェックボックスと同期ボタンを同じカラムに統合 */}
                                <td style={{ width: '80px', textAlign: 'center' }} className={`${isSp ? '' : 'sticky-column'}`}>顧客取込</td>
                                <td style={{ width: '60px', textAlign: 'center' }}>事前アンケート</td>
                                <td style={{ width: '80px', textAlign: 'center' }}>店舗名</td>
                                <td style={{ width: '80px', textAlign: 'center' }}>担当営業</td>
                                <td style={{ width: '40px' }}>反響日</td>
                                <td style={{ width: '90px' }}>反響媒体</td>
                                <td style={{ width: '80px' }}>お客様名</td>
                                <td style={{ width: '200px' }}>連絡先</td>
                                <td style={{ width: '130px' }}>詳細</td>
                                <td style={{ width: '120px' }}>予定地</td>
                                <td style={{ width: '400px' }}>顧客タグ</td>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInquiryList.slice(0, displayLength).map((item) => {
                                const formattedValue = shopFormate(item.shop || '', item.brand || '', shopArray) ?? '';
                                const styleClass = setStyleClass(item.shop || '');
                                const blacklisted = isBlack(item);
                                const survey = rowSurvey(item);
                                const duplicates = duplicateMap.get(item.inquiry_id);
                                const flow = landingLabel(item.landing_params);

                                return (
                                    /* ⚠️ v2.2.165: key を index から inquiry_id に（⚠️ 絞り込みで行がずれても select の状態が混ざらない） */
                                    <tr key={item.inquiry_id} style={{ textAlign: 'left' }}
                                        className={blacklisted ? 'table-danger align-middle' : notNeedSync(item) ? 'table-primary align-middle' : 'align-middle'}>

                                        {/* 💡 横並びのレイアウト調整 */}
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }} className={`${isSp ? '' : 'sticky-column'}`}>
                                            <div className="d-flex align-items-center justify-content-center gap-2">
                                                {item.sync !== 1 && !isExcluded(item) && !blacklisted && (
                                                    <input
                                                        type="checkbox"
                                                        checked={checkedSet.has(item.inquiry_id)}
                                                        onChange={() => handleCheck(item.inquiry_id)}
                                                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                                                    />
                                                )}
                                                <>{isExcluded(item) ? <i className="fa-solid fa-xmark"></i> :
                                                    item.sync === 1 ? <span className="lo_badge lo_badge_sync"
                                                        onClick={() => (item.pg_id || '').length === 26 ? setEditId(item.pg_id) : null}><i className="fa-solid fa-up-right-from-square"></i></span> :
                                                        <i className='fa-solid fa-arrows-rotate pointer'
                                                            onClick={() => handleSync(item.inquiry_id)}
                                                        ></i>
                                                }</>
                                            </div>
                                            {blacklisted &&
                                                <div className='text-danger mt-1'><i className="fa-solid fa-triangle-exclamation"></i><span style={{ fontSize: '9px' }}>ブラックリスト</span></div>}
                                        </td>

                                        <td style={{ textAlign: 'center' }}>{survey ? (
                                            <span className="lo_badge lo_badge_survey"
                                                onClick={() => showBeforeSurvey(survey, item.hp_campaign || '')}><i className="fa-solid fa-magnifying-glass-plus"></i></span>)
                                            : ('-')}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {item.sync === 1 ? item.shop :
                                                /* ⚠️ v2.2.165: <option selected> をやめて defaultValue に（⚠️ 選んだ値の扱いは従来どおり） */
                                                <select defaultValue={formattedValue} style={{ ...styleClass, fontSize: isSp ? '8px' : '12px' }} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'shop_change')}>
                                                    {formattedShops.map((shopValue, shopIndex) => (
                                                        <option key={`${shopIndex}-${shopValue}`} value={shopValue} style={{ backgroundColor: '#fff', color: '#000' }}>{shopValue}</option>
                                                    ))}
                                                </select>}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <select defaultValue={item.staff || ''} style={{ ...styleClass, fontSize: isSp ? '8px' : '12px' }} onChange={(e) => listChange(item.inquiry_id, e.target.value, 'staff_change')}>
                                                <option value=''>担当営業を選択</option>
                                                {activeStaff.filter(staffValue =>
                                                    formattedValue.includes('全店舗管理') ? staffValue.shop.includes(item.brand || '') && staffValue.shop.includes('霧島店') : staffValue.shop === formattedValue
                                                ).map((staffValue) =>
                                                    <option key={`${staffValue.shop}-${staffValue.name}`} value={staffValue.name} style={{ backgroundColor: '#fff', color: '#000' }}>{staffValue.name}</option>
                                                )}
                                            </select>
                                        </td>
                                        <td>{item.inquiry_date}</td>
                                        <td>{item.response_medium || ''}{(item.medium || '') !== 'ホームページ反響' || <><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>（{item.hp_campaign || ''}）</span></>}
                                            {/* ⚠️ v2.2.199: フォームが送った流入情報（landing_params）がある反響だけ。「ID」は広告の情報が無く顧客IDだけのもの */}
                                            {flow !== '' && (
                                                <div>
                                                    <button type="button" className={`lo_flow${flow === 'ID' ? ' is_id' : ''}`}
                                                        onClick={() => setTrackingTarget({ id: item.inquiry_id, name: `${item.first_name || ''}${item.last_name || ''}` })}
                                                        title="流入履歴を見る">
                                                        <i className="fa-solid fa-route" aria-hidden="true" />流入：{flow}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td>{item.first_name || ''}{item.last_name || ''}</td>
                                        <td>{item.pref || ''}{item.city || ''}{item.town || ''}{item.street || ''}{item.building || ''}<br />{toHalfWidth(item.mobile || '')}{(!item.mobile && item.landline) && `/${toHalfWidth(item.landline || '')}`}</td>
                                        {/*
                                          ⚠️⚠️ v2.2.165: **重複は duplicate 列ではなく画面で判定する**（buildDuplicateMap）。
                                            ⚠️ 氏名・携帯・メールのうち2つ以上が一致した相手を ⚠️ `{店舗}_{媒体}重複` で出す。
                                            ⚠️ 色は相手の店舗の色。⚠️ ホットリードへのリンクは出さない（2026-10-06 の確認）。
                                        */}
                                        <td>{duplicates?.map((d) => (
                                            <div key={d.inquiry_id} style={setStyleClass(d.shop || '')} className='mb-1 lo_dup'>
                                                {`${d.shop || ''}_${d.response_medium || ''}重複`}
                                            </div>
                                        ))}</td>
                                        <td>{item.area || ''}</td>
                                        <td>
                                            <div className='d-flex'>
                                                {TAG_DEFINITIONS.map(tag => (
                                                    <div
                                                        key={tag.key}
                                                        className={`${tag.className} text-white rounded-pill px-2 me-2 tag ${isTagOn(item, tag.key) ? 'checked' : ''}`}
                                                        onClick={() => toggleTag(item, tag.key)}
                                                    >{tag.label}</div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>);
                            })}
                        </tbody>
                    </Table>

                    <div ref={loaderRef} style={{ height: '30px', textAlign: 'center', paddingBottom: '20px' }}>
                        {totalLength > displayLength && <span className="text-muted" style={{ fontSize: '12px' }}>読み込み中...</span>}
                    </div>

                </div>
            </div>
            <OrderModal show={show} modalClose={modalClose} modalContent={modalContent} modalBeforeContent={modalBeforeContent} />
            <TrackingTouches inquiryId={trackingTarget?.id ?? null} customerName={trackingTarget?.name ?? ''} onClose={() => setTrackingTarget(null)} />
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
        </>
    )
}
export default ListOrder;