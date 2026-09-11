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

/** 1店舗あたりの横幅。⚠️ 4本の棒＋間隔が潰れない最小値 */
const WIDTH_PER_SHOP = 78;

/**
 * モーダルを全画面にする店舗数のしきい値。
 *
 * ⚠️ Bootstrap の `xl` は約 1140px。左右の余白とY軸のラベルを引くと
 *   グラフに使えるのは 1000px ほどで、1店舗 78px なら **12店舗**で埋まる。
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
    shop: string;
    [key: string]: string | number;
};

type Props = {
    show: boolean;
    onHide: () => void;
    /** 店舗ごとの単価。⚠️ 先頭が「グループ全体」になるよう並べて渡すこと */
    data: UnitPriceRow[];
    /** 描く系列。unitPriceSeries.ts の定数を渡す */
    series: UnitPriceSeries;
    /** 見出し。事業名を入れる */
    title: string;
};

const UnitPriceGraphModal: React.FC<Props> = ({ show, onHide, data, series, title }) => {
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
            <Modal.Header closeButton className="border-bottom-0 pb-0" style={{ fontSize: '14px' }}>
                <span className="fw-bold text-secondary">{title} 店舗別 単価比較</span>
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
                                  * X軸＝店舗。
                                  * ⚠️⚠️ **`angle={-90}` にすること。** `90` だと文字が
                                  *   上から下へ向き、日本語の店舗名が読みにくい。
                                  *   -90 で**下から上に向かって**読める向きになる。
                                  * ⚠️ `textAnchor="end"` を外さないこと。回転の基点がずれて
                                  *   ラベルが軸から離れる。
                                  * ⚠️ `interval={0}` を外すと店舗が間引かれる。
                                  */}
                                <XAxis
                                    dataKey="shop"
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
                                <ChartTooltip
                                    formatter={(v: number, name: string) => [`¥${Number(v).toLocaleString()}`, name]}
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
