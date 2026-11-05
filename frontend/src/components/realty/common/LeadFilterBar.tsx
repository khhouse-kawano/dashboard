import React from 'react';
import { removeSpaces } from './leadUtiles';

/**
 * 売り反響・買い反響の一覧の絞り込み（v2.2.245 新規）。制作者の要望「担当者・反響元・フェーズ・反響受信月・顧客名 or 所在地（検索窓）」。
 *
 * ⚠️ 反響受信月は、上の期間の選択（LeadHeader。月別・通期・全期間）がその役目。ここには置かない。
 * ⚠️ 絞るのは下の一覧だけ。上のタイル・歩留まり（LeadFunnelPanel）は期間だけで数える（以前のアプリと同じ）。
 */

export type LeadFilter = { staff: string; source: string; phase: string; q: string };

export const EMPTY_FILTER: LeadFilter = { staff: '', source: '', phase: '', q: '' };

/** 担当が未割当の行を選ぶための値（⚠️ 担当名と重ならない値） */
export const UNASSIGNED = '__unassigned__';

type Props = {
    value: LeadFilter;
    onChange: (next: LeadFilter) => void;
    staffOptions: string[];
    sourceOptions: string[];
    phaseOptions: string[];
    /** 反響元（売り）・ポータル（買い） */
    sourceLabel: string;
    searchPlaceholder: string;
    /** 絞り込んだ件数と、期間の中の件数 */
    shown: number;
    total: number;
};

/**
 * 1行が絞り込みに合うか。
 * @param fields 行から取り出した値（担当・反響元・フェーズ・検索の対象の文字）
 * @param defaultPhase フェーズが空の行をどの段階とみなすか（売り反響は「リード受信」）
 */
export const matchesFilter = (
    f: LeadFilter,
    fields: { staff: string | null | undefined; source: string; phase: string | null | undefined; text: (string | null | undefined)[] },
    defaultPhase = ''
): boolean => {
    const staff = removeSpaces(fields.staff);
    if (f.staff === UNASSIGNED ? staff !== '' : f.staff !== '' && staff !== removeSpaces(f.staff)) return false;
    if (f.source !== '' && fields.source !== f.source) return false;
    if (f.phase !== '' && (fields.phase || defaultPhase) !== f.phase) return false;
    const q = removeSpaces(f.q).toLowerCase();
    if (q !== '' && !fields.text.some(t => removeSpaces(t).toLowerCase().includes(q))) return false;
    return true;
};

const box: React.CSSProperties = { fontSize: '12px', height: '30px', padding: '2px 8px', border: '1px solid #ced4da', borderRadius: '4px', backgroundColor: '#fff' };
const label: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#6c757d', marginBottom: '2px' };

const LeadFilterBar = ({ value, onChange, staffOptions, sourceOptions, phaseOptions, sourceLabel, searchPlaceholder, shown, total }: Props) => {
    const set = (p: Partial<LeadFilter>) => onChange({ ...value, ...p });
    const active = value.staff !== '' || value.source !== '' || value.phase !== '' || value.q.trim() !== '';
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', padding: '10px 12px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '8px' }}>
            <div>
                <div style={label}>担当者</div>
                <select style={{ ...box, width: '150px' }} value={value.staff} onChange={e => set({ staff: e.target.value })} aria-label="担当者">
                    <option value="">すべて</option>
                    <option value={UNASSIGNED}>未割当</option>
                    {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div>
                <div style={label}>{sourceLabel}</div>
                <select style={{ ...box, width: '150px' }} value={value.source} onChange={e => set({ source: e.target.value })} aria-label={sourceLabel}>
                    <option value="">すべて</option>
                    {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div>
                <div style={label}>フェーズ</div>
                <select style={{ ...box, width: '140px' }} value={value.phase} onChange={e => set({ phase: e.target.value })} aria-label="フェーズ">
                    <option value="">すべて</option>
                    {phaseOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <div>
                <div style={label}>検索</div>
                <input style={{ ...box, width: '240px' }} value={value.q} placeholder={searchPlaceholder} onChange={e => set({ q: e.target.value })} aria-label="検索" />
            </div>
            {active && (
                <button type="button" style={{ ...box, cursor: 'pointer', color: '#6c757d' }} onClick={() => onChange(EMPTY_FILTER)}>
                    条件を消す
                </button>
            )}
            <span style={{ fontSize: '11px', color: '#6c757d', marginLeft: 'auto', paddingBottom: '6px' }}>
                {active ? `${shown} 件 ／ 期間の中 ${total} 件` : `${total} 件`}
            </span>
        </div>
    );
};

export default LeadFilterBar;
