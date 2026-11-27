import React from 'react';
import type { LandMaster } from './landApi';
import { selOptions } from './landApi';
import type { ReplyLevel } from './landLogic';

/** 土地仕入の画面で共通の小さな部品（v2.2.311） */

/** 返答期日の残り（移行元の dueText） */
export const DueBadge = ({ level, days }: { level: ReplyLevel; days: number | null }) => {
    if (level === 'done') return <span className="ld_due unset">—</span>;
    if (level === 'unset' || days === null) return <span className="ld_due unset">期日未設定</span>;
    const text = days < 0 ? `${-days}日超過` : days === 0 ? '本日が期日' : `あと${days}日`;
    return <span className={`ld_due ${level}`}>{text}</span>;
};

/** 見出しを押して並べ替える th */
export const SortTh = ({ label, k, sort, onSort, num }: {
    label: string; k: string; sort: { key: string; dir: 'asc' | 'desc' }; onSort: (k: string) => void; num?: boolean;
}) => (
    <th className={`ld_th is_sort${num ? ' ld_num' : ''}`} onClick={() => onSort(k)}>
        {label}
        <span className={`ld_sort_icon${sort.key === k ? ' is_active' : ''}`}>{sort.key !== k ? '↕' : sort.dir === 'asc' ? '▲' : '▼'}</span>
    </th>
);

/** 担当の選択（チーム全員・エリアの合算・1人ずつ）。⚠️ 値は sel（'' / 'a:<id>' / 'm:<id>'） */
export const SelSelect = ({ master, value, onChange, allLabel, membersOnly }: {
    master: LandMaster; value: string; onChange: (v: string) => void; allLabel?: string; membersOnly?: boolean;
}) => {
    const opts = selOptions(master).filter((o) => !membersOnly || o.value.startsWith('m:'));
    const groups = Array.from(new Set(opts.map((o) => o.group)));
    return (
        <select className="ld_select" value={value} onChange={(e) => onChange(e.target.value)}>
            {membersOnly && <option value="">{allLabel ?? '（選んでください）'}</option>}
            {groups.map((g) => (g === ''
                ? opts.filter((o) => o.group === '').map((o) => <option key={o.value} value={o.value}>{allLabel ?? o.label}</option>)
                : <optgroup key={g} label={g}>{opts.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>))}
        </select>
    );
};

/** 担当者の選択（1人。⚠️ 値は land_member.id） */
export const MemberSelect = ({ master, value, onChange, includeStopped }: {
    master: LandMaster; value: number | null; onChange: (id: number | null) => void; includeStopped?: boolean;
}) => (
    <select className="ld_select" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">（選んでください）</option>
        {master.members.filter((m) => includeStopped || m.active || m.id === value).map((m) => (
            <option key={m.id} value={m.id}>{m.name}{m.active ? '' : '（停止中）'}</option>
        ))}
    </select>
);

/** 読み込み中・エラーの表示 */
export const LoadState = ({ loading, error }: { loading: boolean; error: string }) => (
    <>
        {error !== '' && <div className="ld_error">{error}</div>}
        {loading && error === '' && <div className="ld_note"><span className="spinner-border spinner-border-sm me-1" style={{ width: '.8rem', height: '.8rem' }} />読み込み中…</div>}
    </>
);

/** 地図のリンク */
export const MapLink = ({ url }: { url: string }) => (url
    ? <a className="ld_link ms-1" href={url} target="_blank" rel="noreferrer" title="地図を開く" onClick={(e) => e.stopPropagation()}><i className="fa-solid fa-location-dot" aria-hidden="true" /></a>
    : null);

export const Field = ({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) => (
    <label className={`ld_field${full ? ' is_full' : ''}`}>
        <span className="ld_label">{label}</span>
        {children}
    </label>
);
