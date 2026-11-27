import React from 'react';
import Table from 'react-bootstrap/Table';
import type { PortalDetail } from './PortalDetailModal';

/**
 * 物件の詳細の部品（v2.2.307。PropertySummary.tsx から切り出した）。
 * ⚠️ 物件の詳細（PropertySummary.tsx）と、媒介獲得台帳の「物件の状況」（LedgerPropertyStatus.tsx）で使う。
 *   見た目は PropertySummary.tsx の v2.2.306 までと同じ。
 */

type Row = Record<string, any> | null | undefined;

export type PropertyPv = { suumo: number; homes: number; athome: number; total: number };

/**
 * ポータルごとの PV。
 * ⚠️⚠️ 物件DB（DatabaseProperty.tsx の propertyList・② の propertyGet.ts の runPropertyPage）と同じ式にする（片方だけ直さない）。
 *   SUUMO ＝ pv_total（⚠️ v2.2.307 で物件の詳細も pv_recent_week から pv_total にそろえた）
 *   HOME'S ＝ detail_page_views ÷ 今日の日（小数1桁で切り上げ）
 *   at home ＝ pv_total ÷ 掲載日数（end_date − start_date。小数1桁で切り上げ）
 */
export const propertyPvOf = (suumo: Row, homes: Row, athome: Row): PropertyPv => {
    const pvSuumo = Number(suumo?.pv_total ?? 0);
    const today = new Date().getDate() || 1;
    const pvHomes = Math.ceil((Number(homes?.detail_page_views ?? 0) / today) * 10) / 10;
    let pvAthome = 0;
    if (athome?.start_date && athome?.end_date) {
        const startDate = new Date(String(athome.start_date).replace(/\//g, '-'));
        const endDate = new Date(String(athome.end_date).replace(/\//g, '-'));
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const elapsedDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
            pvAthome = Math.ceil((Number(athome.pv_total ?? 0) / elapsedDays) * 10) / 10;
        }
    }
    return { suumo: pvSuumo, homes: pvHomes, athome: pvAthome, total: pvSuumo + pvHomes + pvAthome };
};

const thStyle: React.CSSProperties = { backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500' };
const tdStyle: React.CSSProperties = { color: '#2d3748', fontWeight: 'bold' };

/** 基本情報（所在地・担当営業・価格・取扱・面積・間取り・建築時期） */
export const PropertyBasicInfo = ({ property }: { property: Row }) => (
    <div className="card shadow-sm border-0 rounded-3">
        <div className="card-header bg-white border-bottom-0 pt-3 pb-1">
            <h6 className="fw-bold mb-0" style={{ fontSize: '13px', color: '#4a5568' }}>基本情報</h6>
        </div>
        <div className="card-body pt-1 pb-3 px-3">
            <Table bordered className="mb-0 align-middle" style={{ fontSize: '12px', borderColor: '#e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                <tbody>
                    <tr>
                        <th style={{ ...thStyle, width: '15%' }}>所在地</th>
                        <td style={{ ...tdStyle, width: '35%' }}>{property?.address}</td>
                        <th style={{ ...thStyle, width: '15%' }}>担当営業</th>
                        <td style={{ ...tdStyle, width: '35%' }}>{property?.property_staff}</td>
                    </tr>
                    <tr>
                        <th style={thStyle}>価格</th>
                        <td style={{ color: '#e53e3e', fontWeight: 'bold', fontSize: '13px' }}>{property?.price}</td>
                        <th style={thStyle}>取扱</th>
                        <td style={tdStyle}>{property?.seller}</td>
                    </tr>
                    <tr>
                        <th style={thStyle}>土地面積</th>
                        <td style={tdStyle}>{property?.land_area}</td>
                        <th style={thStyle}>建築面積</th>
                        <td style={tdStyle}>{property?.building_area}</td>
                    </tr>
                    <tr>
                        <th style={thStyle}>間取り</th>
                        <td style={tdStyle}>{property?.layout}</td>
                        <th style={thStyle}>建築時期</th>
                        <td style={tdStyle}>{property?.building_age}</td>
                    </tr>
                </tbody>
            </Table>
        </div>
    </div>
);

type PvProps = {
    pv: PropertyPv;
    /** v2.2.307 渡すと、掲載データのあるポータルの数字を押せる（押すと掲載サマリ。PortalDetailModal.tsx） */
    onPortal?: (portal: PortalDetail) => void;
    suumo?: Row;
    homes?: Row;
    athome?: Row;
};

/** PV サマリ（総PV・SUUMO・HOME'S・athome） */
export const PropertyPvSummary = ({ pv, onPortal, suumo, homes, athome }: PvProps) => {
    const cell = (value: number, color: string, type: PortalDetail['type'], data: Row) => {
        const text = value.toLocaleString();
        if (!onPortal || !data) return <td className="fw-bold" style={{ color }}>{text}</td>;
        return (
            <td className="fw-bold" style={{ color }}>
                <span role="button" tabIndex={0} className="text-decoration-underline" style={{ cursor: 'pointer' }}
                    aria-label={`${type} の掲載サマリを開く`}
                    onClick={() => onPortal({ type, data: data as Record<string, string> })}
                    onKeyDown={(e) => { if (e.key === 'Enter') onPortal({ type, data: data as Record<string, string> }); }}>
                    {text}
                </span>
            </td>
        );
    };
    return (
        <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white border-bottom-0 pt-3 pb-1">
                <h6 className="fw-bold mb-0" style={{ fontSize: '13px', color: '#4a5568' }}>PVサマリ</h6>
            </div>
            <div className="card-body pt-1 pb-3 px-3">
                <Table bordered className="mb-0 text-center align-middle" style={{ fontSize: '12px', borderColor: '#e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                    <thead style={{ backgroundColor: '#f8f9fa' }}>
                        <tr>
                            <th style={{ color: '#718096', fontWeight: '500' }}>総PV</th>
                            <th style={{ color: '#38a169', fontWeight: '500' }}>SUUMO</th>
                            <th style={{ color: '#e53e3e', fontWeight: '500' }}>HOME'S</th>
                            <th style={{ color: '#3182ce', fontWeight: '500' }}>athome</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="fw-bold" style={{ fontSize: '14px', color: '#2d3748' }}>{pv.total.toLocaleString()}</td>
                            {cell(pv.suumo, '#2f855a', 'SUUMO', suumo)}
                            {cell(pv.homes, '#c53030', "HOME'S", homes)}
                            {cell(pv.athome, '#2b6cb0', 'athome', athome)}
                        </tr>
                    </tbody>
                </Table>
                {onPortal && <div className="text-muted mt-1" style={{ fontSize: '10px' }}>数字を押すと、そのポータルの掲載サマリが開きます</div>}
            </div>
        </div>
    );
};

/** 地図（緯度経度があるときだけ） */
export const PropertyMap = ({ latLng }: { latLng?: string | null }) => {
    if (!latLng) return null;
    return (
        <div className="rounded-3 overflow-hidden shadow-sm" style={{ height: '250px', backgroundColor: '#e2e8f0', border: '1px solid #e2e8f0' }}>
            <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${latLng}&hl=ja&z=16&output=embed`}
                allowFullScreen
                title="Property Location Map"
            ></iframe>
        </div>
    );
};
