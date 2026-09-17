import React from 'react';
import Modal from 'react-bootstrap/Modal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import './shop.css';

/**
 * 店舗別の単価グラフ（モーダル）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ ShopOrder.tsx / ShopKaeru.tsx の両方から使う。
 *   系列（`series`）だけが違い、描き方は同じ。
 *
 * ⚠️⚠️ **画面に直接置かないこと。** 2026-09-11 に一度
 *   表の上へ直接置いたが、表と同時に見えて視認性が悪かった。
 *   ⚠️ 横棒（layout="vertical"）にして縦スクロールさせる案も試したが、
 *     やはり読みにくく、**モーダル＋縦棒**に落ち着いた経緯がある。
 * ─────────────────────────────────────────────
 */

/** 1項目あたりの横幅。⚠️ 4本の棒＋間隔が潰れない最小値 */
const WIDTH_PER_SHOP = 78;

/**
 * モーダルを全画面にする項目数のしきい値。
 *
 * ⚠️ Bootstrap の `xl` は約 1140px。左右の余白とY軸のラベルを引くと
 *   グラフに使えるのは 1000px ほどで、1項目 78px なら **12項目**で埋まる。
 *   これを超えたら全画面にして幅を稼ぐ。
 * ⚠️ 全画面でも足りない分は横スクロールで見る（shop.css 参照）。
 */
const FULLSCREEN_THRESHOLD = 12;

export type UnitPriceSeries = ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly color: string;
}>;

export type UnitPriceRow = {
    [key: string]: string | number;
};

type Props = {
    show: boolean;
    onHide: () => void;
    /** 単価の一覧。⚠️ 先頭に合計行（「グループ全体」「総反響」）が来るよう並べて渡すこと */
    data: UnitPriceRow[];
    /** 描く系列。unitPriceSeries.ts の定数を渡す */
    series: UnitPriceSeries;
    /** 見出し。事業名を入れる */
    title: string;
    /**
     * X軸に使う項目のキー。
     * ⚠️ 既定は 'shop'（店舗ランキング）。販促媒体別ランキング
     *   （customer/）からは 'medium' を渡す。
     * ⚠️ 既定値を変えないこと。shop 側を無変更で動かすためにある。
     */
    itemKey?: string;
    /** 見出しの「◯◯別」の語。⚠️ 既定は '店舗' */
    itemLabel?: string;
};

/**
 * ⚠️⚠️ **2026-09-14 に customer/（販促媒体別ランキング）からも使うようにした。**
 *   X軸が店舗名か販促媒体名かだけが違い、描き方は同じである。
 *   ⚠️ `itemKey` / `itemLabel` に既定値を置いてあるので、
 *     **shop 側の呼び出しは1文字も変えていない。**
 */
const UnitPriceGraphModal: React.FC<Props> = ({
    show, onHide, data, series, title, itemKey = 'shop', itemLabel = '店舗',
}) => {
    /**
     * ⚠️ 店舗数で全画面かどうかを決める。
     *   ⚠️ `fullscreen` プロパティは型が 'true | string' で真偽値を渡せないため、
     *     Bootstrap のクラスを直接当てる（Header.tsx と同じやり方）。
     */
    const isFullscreen = data.length > FULLSCREEN_THRESHOLD;

    /**
     * ⚠️ 中身の幅。店舗数から計算して**横スクロール**させる。
     *   ⚠️ `100%` を下限にしないと、店舗が少ないときにグラフが左に寄って
     *     間延びして見える。
     */
    const innerWidth = `max(100%, ${data.length * WIDTH_PER_SHOP}px)`;

    return (
        <Modal
            show={show}
            onHide={onHide}
            size={isFullscreen ? undefined : 'xl'}
            centered={!isFullscreen}
            dialogClassName={isFullscreen ? 'modal-fullscreen' : ''}
            contentClassName={isFullscreen ? 'h-100 d-flex flex-column' : ''}
        >
            {/**
              * ⚠️ 全画面のときは右上の × が本文から遠いので、見出しの隣にも閉じるボタンを置く。
              *   ⚠️ `.modal-header` は justify-content: space-between のため、
              *     そのままだとボタンが右端へ飛ぶ。左寄せに上書きしている（Header.tsx と同じ）。
              */}
            <Modal.Header
                closeButton
                className="border-bottom-0 pb-0 d-flex align-items-center gap-3 justify-content-start"
                style={{ fontSize: '14px' }}
            >
                <button
                    type="button"
                    onClick={onHide}
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 fw-normal"
                    style={{ fontSize: '12px' }}
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                    閉じる
                </button>
                <span className="fw-bold text-secondary">{title} {itemLabel}別 単価比較</span>
            </Modal.Header>
            <Modal.Body className={isFullscreen ? 'flex-grow-1 d-flex flex-column' : ''} style={{ minHeight: 0 }}>
                {/* ⚠️ 凡例は横スクロール領域の外。中に入れるとスクロールで流れていく */}
                <div className="shop_graph_legend mb-3 ps-2">
                    {series.map(s => (
                        <span key={s.key}>
                            <span className="swatch" style={{ backgroundColor: s.color }} />
                            {s.label}
                        </span>
                    ))}
                </div>
                <div className="shop_graph_scroll" style={{ flexGrow: isFullscreen ? 1 : undefined, minHeight: 0 }}>
                    {/* ⚠️ 全画面のときは高さを画面いっぱいに、そうでなければ固定 */}
                    <div style={{ width: innerWidth, height: isFullscreen ? '100%' : '520px', minHeight: '360px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 8, right: 24, left: 24, bottom: 120 }}>
                                <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                                {/**
                                  * X軸＝店舗、または販促媒体（`itemKey`）。
                                  * ⚠️⚠️ **`angle={-90}` にすること。** `90` だと文字が
                                  *   上から下へ向き、日本語の名前が読みにくい。
                                  *   -90 で**下から上に向かって**読める向きになる。
                                  * ⚠️ `textAnchor="end"` を外さないこと。回転の基点がずれて
                                  *   ラベルが軸から離れる。
                                  * ⚠️ `interval={0}` を外すと項目が間引かれる。
                                  */}
                                <XAxis
                                    dataKey={itemKey}
                                    fontSize={11}
                                    interval={0}
                                    angle={-90}
                                    textAnchor="end"
                                    height={120}
                                />
                                {/* Y軸＝円。⚠️ 3桁区切りにしないと桁が読めない */}
                                <YAxis
                                    fontSize={11}
                                    tickFormatter={(v: number) => `¥${v.toLocaleString()}`}
                                    width={80}
                                />
                                {/**
                                  * ⚠️⚠️ **`itemSorter={() => 0}` を外さないこと。**
                                  *   recharts の Tooltip は既定で**値の降順**に並べ替えるため、
                                  *   店舗ごとに反響単価と契約単価の順番が入れ替わり、
                                  *   毎回どれがどれか読み直すことになる。
                                  *   0 を返すと並べ替えが起きず、**Bar を宣言した順**
                                  *   （反響 → 来場 → 次アポ → 契約）のまま表示される。
                                  */}
                                <ChartTooltip
                                    formatter={(v: number, name: string) => [`¥${Number(v).toLocaleString()}`, name]}
                                    itemSorter={() => 0}
                                    contentStyle={{ fontSize: '12px' }}
                                />
                                {/* ⚠️ stackId は付けない。単価は足し合わせても意味がない */}
                                {series.map(s => (
                                    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default UnitPriceGraphModal;
