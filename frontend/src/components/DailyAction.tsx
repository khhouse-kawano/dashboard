import React, { useEffect, useState, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../context/AuthContext';
import apiClient from '../utils/apiClient';
import { useIsSp } from '../utils/isSp';

/**
 * 注文営業のダッシュボードを開いた直後に出す「要確認」。
 *
 * ⚠️⚠️ **狙いは「晒す」こと**（2026-09-28 の相談）。
 *   ⚠️ 未同期と来場日未入力は**放置されがち**なので、
 *     ⚠️ **誰の顧客かに関係なく全員に見せる。**
 *   ⚠️ ⚠️ **担当者で絞り込まないこと。** 絞ると自分の分しか見えず、狙いが消える。
 *
 * ⚠️ 出す条件
 *   ⚠️ `!isSp` … スマートフォンでは出さない（表が5列あり読めない）
 *   ⚠️ `category === 'order'` … 注文営業のみ
 *   ⚠️⚠️ **`staff.check_daily_action` が本日でないこと**（サーバーが `show` で返す）
 *   ⚠️⚠️ **件数が0件のときは出さない**（見せるものが無い）
 *
 * ⚠️⚠️ **2026-09-28 に「URL が変わるたびに出す」へ変えた**（利用者の相談）。
 *   ⚠️ 置き場所は `Menu.tsx`（⚠️ **`/login` と `/home` 以外の全ページで動く**）。
 *   ⚠️ ⚠️ **`Company.tsx` と `Category.tsx` の `fromCategory` は不要になったので消した。**
 *   ⚠️ きっかけは `useLocation()` の `pathname + search` の変化である。
 *   ⚠️ ⚠️ **背景クリックで閉じても、次に画面を移ると again 出る。**
 *     ⚠️ 止まるのは **「確認しました」を押したときだけ**（利用者の判断）。
 *
 * ⚠️⚠️ **モーダルの外をクリックすれば閉じられる**（2026-09-28 の指示）。
 *   ⚠️ 「確認せずに急ぎ作業を進めたい場合がある」ため。
 *   ⚠️ ⚠️ **そのときは `check` を送らないので、翌日もまた出る。** これが意図である。
 *   ⚠️ `check` が入るのは **「確認しました」を押したときだけ**。
 *
 * ⚠️ 見た目は `header/GoogleReview.tsx` に揃えてある（2026-09-28 の指示）。
 *   ⚠️ ⚠️ **共通CSSを汚さないよう、このコンポネント専用の `<style>` に閉じてある。**
 */

type Row = {
    /** ⚠️ 未同期・来場日未入力だけが持つ。本日の予定には無い */
    days?: number;
    shop: string;
    register: string;
    customer: string;
    medium: string;
    /** ⚠️ 未同期だけが持つ。⚠️ 空文字で届く（画面で `-` と出す） */
    campaign?: string;
    /** ⚠️ 担当営業。⚠️ **未同期以外が持つ**（未同期はまだ担当が決まっていない） */
    staff?: string;
};

type Section = {
    label: string;
    hasDays: boolean;
    /** ⚠️⚠️ **未同期だけ true**。⚠️ 他はこの列を持っていない */
    hasCampaign: boolean;
    /** ⚠️⚠️ **未同期以外 true**（2026-09-28）。⚠️ 未同期はまだ担当が決まっていない */
    hasStaff: boolean;
    rows: Row[];
};

type ListResponse = {
    sections?: Section[];
    total?: number;
    truncated?: boolean;
    show?: boolean;
};

/**
 * ⚠️⚠️ **取得はブラウザのセッション中で使い回す**（`Menu.tsx` の `fetchMenuOnce` と同じ考え方）。
 *   ⚠️ URL が変わるたびに出す作りなので、⚠️ **毎回取りに行くと ① のDBに負担がかかる。**
 *   ⚠️ ⚠️ **ただし古い数字を出し続けないよう、5分で取り直す。**
 *     ⚠️ 同期や入力を済ませた直後は、⚠️ **最大5分は古い件数が出る。**
 */
const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; promise: Promise<ListResponse> } | null = null;

/**
 * ⚠️⚠️ **「確認しました」を押したらこのタブでは二度と出さない。**
 *   ⚠️ サーバーの `show` も false になるが、⚠️ **キャッシュを見に行かせないため**に持つ。
 */
let sessionChecked = false;

/**
 * ⚠️⚠️ **自動では出さない画面。**
 *   ⚠️ `App.tsx` の「メニューを出す条件」と同じにしてある。
 *   ⚠️ ⚠️ **手動（ActiveUser の「要確認」ボタン）では出せる。**
 */
const NO_AUTO_OPEN: string[] = ['/home', '/login'];

/**
 * ⚠️⚠️ **外から開くための入口**（2026-09-28）。
 *   ⚠️ `ActiveUser.tsx` の「要確認」ボタンが呼ぶ。
 *   ⚠️ ⚠️ **状態を持ち回さずに済ませるため、purpose を絞った小さな購読にしてある。**
 *     ⚠️ Context を足すと `App.tsx` の階層を触ることになり、影響範囲が広い。
 *   ⚠️ 実体は `DailyAction` が1つだけ描画されている前提（⚠️ `App.tsx` を参照）。
 */
type Listener = () => void;
const listeners = new Set<Listener>();
export const openDailyAction = (): void => {
    listeners.forEach((listener) => listener());
};

/**
 * 放置日数の見た目。
 *
 * ⚠️ 段階はオーナー指定（2026-09-28）。
 *   ⚠️ 〜2日 … 薄い黄
 *   ⚠️ 3〜5日 … 橙
 *   ⚠️ 6日以上 … 赤
 *
 * ⚠️⚠️ **境目を変えるときはここだけを直すこと。**
 * ⚠️ 色は GoogleReview.tsx と同じ系統（amber / orange / red の 50・700）に寄せてある。
 */
const daysClass = (days: number): string => {
    if (days >= 6) return 'da_days da_days_high';
    if (days >= 3) return 'da_days da_days_mid';
    return 'da_days da_days_low';
};

/** ⚠️ 空の値は「(未設定)」と出す。空欄だと入力漏れなのか取得漏れなのか分からない */
const orUnset = (value: string): string => (value ?? '').trim() === '' ? '(未設定)' : value;

/**
 * キャンペーン名。
 *
 * ⚠️ 指示どおり ⚠️ **空なら `-`**（⚠️ 「(未設定)」ではない）。
 *   ⚠️ 実測で ⚠️ **9割以上が空**なので、⚠️ **短い記号のほうが表が静かになる。**
 */
const orDash = (value?: string): string => (value ?? '').trim() === '' ? '-' : (value ?? '');

/**
 * ⚠️⚠️ **未同期の表の見出し。**
 *   ⚠️ サーバー（features/dailyAction.ts）が付けている名前と同じにすること。
 *   ⚠️ ⚠️ **店舗別カードはこの表の上にだけ出す。**
 */
const UNSYNC_LABEL = '未同期';

/**
 * 未同期の行を店舗ごとに数える（2026-09-30 追加）。
 *
 * ⚠️⚠️ **件数の多い店舗から並べる**（指示）。
 *   ⚠️ 同数のときは ⚠️ **店舗名の順**にする（⚠️ **並びが毎回変わるのを防ぐため**）。
 *
 * ⚠️ ⚠️ **数えているのは「画面に出ている行」である。**
 *   ⚠️⚠️ **上限（200行）で切られているときは実際より少ない。**
 *     ⚠️ そのことは `truncated` の注意書きで伝えている。
 */
const countByShop = (rows: Row[]): { shop: string; count: number }[] => {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const shop = orUnset(row.shop);
        counts.set(shop, (counts.get(shop) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([shop, count]) => ({ shop, count }))
        .sort((a, b) => (b.count - a.count) || a.shop.localeCompare(b.shop, 'ja'));
};

const DailyAction = () => {
    const { category } = useContext(AuthContext);
    const isSp = useIsSp();
    const location = useLocation();
    /** ⚠️ 画面が変わったことの目印。⚠️ `Menu.tsx` の `fullPath` と同じ作り方 */
    const fullPath = location.pathname + location.search;

    const [sections, setSections] = useState<Section[]>([]);
    const [total, setTotal] = useState(0);
    const [truncated, setTruncated] = useState(false);
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    /**
     * ⚠️⚠️ **今日もう「確認しました」を押しているか。**
     *   ⚠️ 押していれば ⚠️ **自動では出さない**が、⚠️ **ボタンからは開ける。**
     *   ⚠️ そのときの閉じるボタンは ⚠️ **「閉じる」**（⚠️ 二重に記録しない）。
     */
    const [alreadyChecked, setAlreadyChecked] = useState(false);

    /** ⚠️ そもそも出す対象か。⚠️ **通信の前に判定する**（無駄な通信を避ける） */
    const isTarget = !isSp && category === 'order';

    /**
     * 件数を取ってくる。
     *
     * ⚠️ `force` … ⚠️ **ボタンから開いたときは取り直す**（⚠️ 古い数字を見せたくない）。
     *   ⚠️ 自動で出すときは ⚠️ **5分キャッシュ**を使う（⚠️ 画面を移るたびに叩かないため）。
     */
    const load = (force: boolean): Promise<ListResponse> => {
        const now = Date.now();
        if (force || cached === null || now - cached.at > CACHE_MS) {
            cached = {
                at: now,
                promise: apiClient
                    .post('', { request: 'daily_action', roll: 'list', category })
                    .then((response) => (response.data ?? {}) as ListResponse),
            };
        }
        return cached.promise;
    };

    /** ⚠️ 受け取った結果を画面の状態へ移す。⚠️ 自動・手動の両方から呼ぶ */
    const apply = (data: ListResponse): void => {
        setSections(data.sections ?? []);
        setTotal(Number(data.total ?? 0));
        setTruncated(data.truncated === true);
        setAlreadyChecked(data.show !== true);
    };

    /**
     * ⚠️ 取得に失敗したとき。
     *
     * ⚠️ 黙らせない。⚠️ **空なのか取得に失敗したのかが区別できないと、
     *   「今日は0件だった」と誤解される。**
     * ⚠️ ⚠️ **失敗したキャッシュは捨てる。** 残すと次の画面でも失敗したままになる。
     */
    const fail = (e: unknown): void => {
        cached = null;
        console.error('要確認の取得に失敗しました', e);
        setOpen(false);
    };

    // --- 自動で出す（URL が変わるたび）---
    useEffect(() => {
        if (!isTarget || sessionChecked) return;
        // ⚠️ トップとログインでは自動で出さない（⚠️ ボタンからは開ける）
        if (NO_AUTO_OPEN.includes(location.pathname)) return;

        let alive = true;
        load(false)
            .then((data) => {
                if (!alive) return;
                apply(data);
                // ⚠️⚠️ **0件・確認済みなら開かない。** ⚠️ 空の枠を出しても意味がない
                setOpen(data.show === true && Number(data.total ?? 0) > 0);
            })
            .catch((e) => { if (alive) fail(e); });

        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullPath, isTarget, category]);

    // --- ボタンから開く（ActiveUser.tsx）---
    useEffect(() => {
        if (!isTarget) return;

        const onOpen = () => {
            // ⚠️⚠️ **押したときは取り直す。** ⚠️ 対応した直後に古い件数を見せない
            load(true)
                .then((data) => {
                    apply(data);
                    // ⚠️⚠️ **0件でも開く。** ⚠️ 押した反応が無いほうが困る
                    setOpen(true);
                })
                .catch(fail);
        };
        listeners.add(onOpen);
        return () => { listeners.delete(onOpen); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTarget, category]);

    /**
     * 「確認しました」。
     *
     * ⚠️⚠️ **記録に失敗しても閉じる。** ⚠️ 閉じられないほうが困る。
     * ⚠️ 失敗した場合は**翌日以降もまた出る**だけで、害は無い。
     */
    const handleCheck = async () => {
        if (sending) return;
        /**
         * ⚠️⚠️ **今日もう押している人は記録しない**（2026-09-28 の指示）。
         *   ⚠️ ボタンの文字も「閉じる」になっている。⚠️ **閉じるだけ。**
         */
        if (alreadyChecked) {
            setOpen(false);
            return;
        }
        setSending(true);
        try {
            await apiClient.post('', { request: 'daily_action', roll: 'check', category });
        } catch (e) {
            console.error('確認済みの記録に失敗しました', e);
        } finally {
            /**
             * ⚠️⚠️ **このタブではもう出さない。**
             *   ⚠️ サーバーの `show` も false になるが、⚠️ **キャッシュが残っている間は
             *     それを見に行ってしまう**ので、手元にも目印を持つ。
             */
            sessionChecked = true;
            setSending(false);
            setOpen(false);
        }
    };

    if (!open) return null;

    const visible = sections.filter((section) => section.rows.length > 0);

    return (
        <Modal
            show={open}
            size='lg'
            centered
            scrollable
            /**
             * ⚠️⚠️ **背景クリックと ESC で閉じられる**（2026-09-28 の指示）。
             *   ⚠️ `backdrop='static'` を付け直さないこと。
             *   ⚠️ ⚠️ **閉じただけでは確認済みにならない**（`check` を送らない）。
             */
            /**
             * ⚠️⚠️ **閉じても「確認済み」にはならない**（`check` を送らない）。
             *   ⚠️ ⚠️ **次に画面を移るとまた出る**（2026-09-28 の判断）。
             */
            onHide={() => setOpen(false)}
            dialogClassName='da_dialog'
        >
            {/* ⚠️ このコンポネント専用のスタイル。共通CSSを汚さない（GoogleReview.tsx と同じ方針） */}
            <style>{`
                /* ⚠️ 画面が広いときに間延びしないよう、少しだけ広げる程度に留める */
                .da_dialog { max-width: 900px; }

                .da_head { display: block; width: 100%; border-bottom: 1px solid #e5e7eb;
                           padding: 14px 20px 12px; background: #fff; }
                .da_title { font-weight: 700; font-size: 15px; letter-spacing: .02em;
                            color: #1f2937; }
                .da_note { font-size: 11px; color: #6b7280; }
                /*
                 * ⚠️ 見落とされると困る但し書き（2026-09-30 の指示）。
                 *   ⚠️⚠️ **太字にして、少しだけ目立たせる。**
                 *   ⚠️ ⚠️ **赤にはしない。** ⚠️ 放置日数の赤と意味が混ざる。
                 */
                .da_note_strong { font-size: 11px; font-weight: 700; color: #b45309;
                                  background: #fffbeb; border: 1px solid #fde68a;
                                  border-radius: 999px; padding: 1px 9px; white-space: nowrap; }

                /*
                 * ⚠️ 未同期のある店舗のカード（2026-09-30 の指示）。
                 *   ⚠️⚠️ **未同期の表の上にだけ出す。** ⚠️ 他の表には出さない。
                 *   ⚠️ 上のまとめ（da_kpi_card）より一回り小さくする。
                 */
                .da_shops { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
                .da_shop_card { display: inline-flex; align-items: baseline; gap: 6px;
                                background: #fef2f2; border: 1px solid #fecaca;
                                border-radius: 999px; padding: 3px 10px; font-size: 11px;
                                color: #7f1d1d; white-space: nowrap; }
                .da_shop_count { font-weight: 700; color: #b91c1c;
                                 font-variant-numeric: tabular-nums; }

                /**
                 * ⚠️⚠️ **サマリーは Modal.Body の外（ヘッダー側）に置いてある。**
                 *   ⚠️ 以前は Body の中で position: sticky にしていたが、
                 *     ⚠️ ⚠️ **スクロールした行がこの上に描かれてはみ出した**（2026-09-28 の指摘）。
                 *   ⚠️ ⚠️ **Body に戻さないこと。** scrollable な Modal では Body だけが
                 *     スクロールするため、外に置けば sticky も z-index も要らない。
                 */
                .da_summary { display: flex; align-items: center; justify-content: space-between;
                              gap: 12px; flex-wrap: wrap; margin-top: 10px; }
                .da_kpi { display: flex; gap: 8px; flex-wrap: wrap; }
                .da_kpi_card { background: #f8fafc; border: 1px solid #e5e7eb;
                               border-radius: 10px; padding: 6px 12px; min-width: 104px; }
                .da_kpi_label { font-size: 10px; color: #6b7280; white-space: nowrap; }
                .da_kpi_value { font-size: 18px; font-weight: 700; line-height: 1.2;
                                color: #1f2937; font-variant-numeric: tabular-nums; }
                .da_kpi_value small { font-size: 10px; font-weight: 400; color: #6b7280;
                                      margin-left: 2px; }
                /* ⚠️ 放置のある表だけ数字を赤くする。本日の予定は青。色で種類が分かる */
                .da_kpi_card.is_alert .da_kpi_value { color: #b91c1c; }
                .da_kpi_card.is_alert { background: #fef2f2; border-color: #fecaca; }

                .da_btn { font-size: 12px; font-weight: 700; color: #fff; background: #2563eb;
                          border: none; border-radius: 999px; padding: 8px 20px;
                          white-space: nowrap; cursor: pointer; }
                .da_btn:hover { background: #1d4ed8; }
                .da_btn:disabled { opacity: .5; cursor: default; }

                .da_body { padding: 16px 20px 20px; background: #fff; }
                .da_caution { font-size: 11px; color: #92400e; line-height: 1.8;
                              background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }

                .da_none { font-size: 12px; color: #6b7280; background: #f8fafc;
                           border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px;
                           text-align: center; }
                .da_section { margin-bottom: 18px; }
                .da_section:last-child { margin-bottom: 0; }
                .da_section_head { display: flex; align-items: baseline; gap: 8px;
                                   margin-bottom: 6px; }
                .da_section_title { font-size: 13px; font-weight: 700; color: #1f2937; }
                .da_section_count { font-size: 11px; color: #6b7280;
                                    font-variant-numeric: tabular-nums; }

                /* ⚠️ 表。⚠️ 見出しは固定する（行が多いと見出しが流れるため） */
                .da_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px;
                                 overflow: hidden; background: #fff; }
                .da_table { width: 100%; border-collapse: separate; border-spacing: 0;
                            font-size: 12px; color: #1f2937; }
                .da_th { position: sticky; top: 0; z-index: 2; background: #f8fafc;
                         border-bottom: 1px solid #e5e7eb; padding: 7px 10px;
                         font-weight: 700; font-size: 10px; color: #4b5563;
                         white-space: nowrap; text-align: left; }
                .da_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px;
                         vertical-align: middle; }
                .da_row:last-child > .da_td { border-bottom: none; }
                .da_row:hover > .da_td { background: #f8fafc; }
                .da_name { font-weight: 700; }
                .da_muted { color: #9ca3af; }
                .da_date { font-variant-numeric: tabular-nums; color: #4b5563; }

                /* ⚠️ 放置日数。⚠️ 段階の色はオーナー指定なので変えないこと */
                .da_days { display: inline-block; min-width: 42px; text-align: center;
                           border-radius: 999px; padding: 2px 8px; font-size: 11px;
                           font-weight: 700; font-variant-numeric: tabular-nums; }
                .da_days_low { background: #fef9c3; color: #854d0e; }
                .da_days_mid { background: #ffedd5; color: #9a3412; }
                .da_days_high { background: #fee2e2; color: #b91c1c; }

                /**
                 * ⚠️ キャンペーン名は長い（20250426【KH共通】ゴールデンウィーク… のような値）。
                 *   ⚠️⚠️ **ここは <style>{...} のテンプレートリテラルの中。**
                 *     ⚠️ **バッククォートを書かないこと**（文字列が終わってビルドが落ちる）。
                 *   ⚠️⚠️ **折り返すと行の高さが揃わなくなる**ので省略表示にする。
                 *   ⚠️ 全文は title 属性（hover）で読める。
                 *   ⚠️ ⚠️ **table-layout: fixed が要る。** 無いと max-width が効かず、
                 *     ⚠️ 列が横に伸びて表がはみ出す。
                 */
                .da_table { table-layout: fixed; }
                .da_ellipsis { max-width: 0; overflow: hidden; text-overflow: ellipsis;
                               white-space: nowrap; }
            `}</style>

            {/* ⚠️ closeButton は付けない（指示）。閉じるのは背景クリックか「確認しました」 */}
            <Modal.Header className='da_head'>
                {/* ⚠️ 但し書きが増えたので折り返す。⚠️ **狭い画面ではみ出さないように** */}
                <div className='d-flex align-items-baseline flex-wrap' style={{ gap: '10px' }}>
                    <span className='da_title'>要確認</span>
                    <span className='da_note'>対応が必要な顧客と、本日の予定です</span>
                    {/* ⚠️⚠️ **本日ぶんを数えていないことを明示する**（2026-09-30 の指示） */}
                    <span className='da_note_strong'>本日の反響については未同期数に含みません</span>
                </div>

                {/*
                  ⚠️⚠️ **サマリーはヘッダー側に置く。** ⚠️ Body に戻すと、
                    ⚠️ **スクロールした行がこの上に重なって見える**（2026-09-28 の指摘）。
                  ⚠️ 0件の項目は出さない（指示）。`visible` が既に落としてある
                */}
                <div className='da_summary'>
                    <div className='da_kpi'>
                        {/* ⚠️ 0件のときはカードが1枚も出ない。⚠️ **ボタンだけが残る** */}
                        {visible.map((section) => (
                            <div
                                key={section.label}
                                className={`da_kpi_card${section.hasDays ? ' is_alert' : ''}`}
                            >
                                <div className='da_kpi_label'>{section.label}</div>
                                <div className='da_kpi_value'>
                                    {section.rows.length.toLocaleString()}<small>件</small>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* ⚠️⚠️ **確認済みなら「閉じる」**（⚠️ 押しても記録しない） */}
                    <button className='da_btn' onClick={handleCheck} disabled={sending}>
                        {alreadyChecked ? '閉じる' : '確認しました'}
                    </button>
                </div>
            </Modal.Header>

            <Modal.Body className='da_body' style={{ maxHeight: '66vh' }}>
                {/* ⚠️ 上限で切れたことを黙らない。⚠️ 「全部でこれだけ」と誤解される */}
                {truncated && (
                    <div className='da_caution'>
                        件数が多いため、放置日数の長い順に一部だけ表示しています。
                    </div>
                )}

                {/* ⚠️ ボタンから開いたときは0件でも開く。⚠️ **空の枠だけ出さない** */}
                {visible.length === 0 && (
                    <div className='da_none'>対応が必要な顧客はありません。本日の予定もありません。</div>
                )}

                {visible.map((section) => (
                    <div key={section.label} className='da_section'>
                        <div className='da_section_head'>
                            <span className='da_section_title'>{section.label}</span>
                            <span className='da_section_count'>{section.rows.length.toLocaleString()}件</span>
                        </div>

                        {/*
                          ⚠️⚠️ **未同期の表の上にだけ、店舗ごとの件数を出す**（2026-09-30 の指示）。
                            ⚠️ ⚠️ **多い店舗から並べる。**
                            ⚠️ 他の表（来場日未入力・本日の予定）には出さない。
                        */}
                        {section.label === UNSYNC_LABEL && (
                            <div className='da_shops'>
                                {countByShop(section.rows).map((item) => (
                                    <span className='da_shop_card' key={item.shop}>
                                        {item.shop}
                                        <span className='da_shop_count'>{item.count.toLocaleString()}</span>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className='da_table_wrap'>
                            <table className='da_table'>
                                <thead>
                                    <tr>
                                        {/* ⚠️ 放置日数の列は未同期・来場日未入力だけ。本日の予定には無い */}
                                        {section.hasDays && <th className='da_th' style={{ width: '72px' }}>放置日数</th>}
                                        <th className='da_th' style={{ width: '150px' }}>店舗</th>
                                        <th className='da_th' style={{ width: '100px' }}>反響日</th>
                                        <th className='da_th'>顧客名</th>
                                        {/* ⚠️ 担当営業は**顧客名のすぐ右**（指示）。⚠️ 未同期には出さない */}
                                        {section.hasStaff && <th className='da_th' style={{ width: '120px' }}>担当営業</th>}
                                        <th className='da_th' style={{ width: '130px' }}>反響媒体</th>
                                        {/* ⚠️ キャンペーンは**未同期の表だけ**。⚠️ 右端に置く（指示） */}
                                        {section.hasCampaign && <th className='da_th' style={{ width: '170px' }}>キャンペーン</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {section.rows.map((row, index) => (
                                        <tr className='da_row' key={`${section.label}-${row.customer}-${index}`}>
                                            {section.hasDays && (
                                                <td className='da_td'>
                                                    <span className={daysClass(Number(row.days))}>
                                                        {Number(row.days)}日
                                                    </span>
                                                </td>
                                            )}
                                            <td className='da_td'>{orUnset(row.shop)}</td>
                                            <td className='da_td da_date'>{orUnset(row.register)}</td>
                                            <td className='da_td da_name'>{orUnset(row.customer)}</td>
                                            {section.hasStaff && (
                                                /* ⚠️ 「◯◯店 管理」のままの行もある。⚠️ **そのまま出す**（誰の担当か分からない状態が正） */
                                                <td className='da_td da_ellipsis' title={orUnset(row.staff ?? '')}>
                                                    {orUnset(row.staff ?? '')}
                                                </td>
                                            )}
                                            <td className='da_td da_muted'>{orUnset(row.medium)}</td>
                                            {section.hasCampaign && (
                                                /* ⚠️ 長い名前が多いので省略表示。⚠️ **全文は hover で出す** */
                                                <td className='da_td da_muted da_ellipsis' title={orDash(row.campaign)}>
                                                    {orDash(row.campaign)}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </Modal.Body>
        </Modal>
    );
};

export default DailyAction;
