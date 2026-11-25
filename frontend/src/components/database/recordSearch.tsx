import React, { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * v2.2.296 顧客DB（注文 DatabaseOrder.tsx・建売 DatabaseKaeru.tsx・中古 DatabaseResale.tsx）の「商談・架電記録から検索」。
 *
 * ⚠️ 検索は ② だけ（database_list の条件 record。backend-express/src/features/database/recordSearch.ts）。
 *   記録は数十MB あり、全件をブラウザに送れないため、② に届かないとき（予備の全件読み込み）は使えない。
 * ⚠️ 入力しても自動では検索しない（1回に約1秒かかるため）。Enter か「商談・架電記録から検索」ボタンで送る。
 * ⚠️ ほかの絞り込みはそのまま残して、記録に当たった顧客にさらに絞る。
 * ⚠️ 検索しているときだけ、担当営業とステータスの間に「商談・架電内容」の列を足す（RECORD_COL_WIDTH だけ表を広げる）。
 * ⚠️ v2.2.297 記録の検索が失敗しても、予備の全件読み込みには切り替えない（切り替えると検索が使えなくなる）。
 *   一覧は前のまま残し、カードに理由（recordErrorOf）を出す。列も出さない。
 * ⚠️ この中の文字列 RECORD_CSS にバッククォートを書かないこと。
 */

/** ② が返す記録1件（before + match + after が本文の抜き出し。match が検索した語） */
export interface RecordHit {
    day: string;
    kind: '架電' | '商談';
    action: string;
    before: string;
    match: string;
    after: string;
}

/** 顧客1人分（items は新しい順に5件まで。total は当たった記録の数） */
export interface RecordHitGroup {
    total: number;
    items: RecordHit[];
}

/** 顧客ID → 当たった記録（今のページの顧客の分だけ） */
export type RecordMap = Record<string, RecordHitGroup>;

/** 「商談・架電内容」の列の幅（表をこの分だけ広げる） */
export const RECORD_COL_WIDTH = 440;

/**
 * 商談・架電記録から検索しているか。
 * ⚠️ 予備の全件読み込み（serverMode が偽）では検索していない（条件が効かない）ので偽。
 */
export const isRecordSearch = (keyword: string, serverMode: boolean): boolean => serverMode && keyword !== '';

/** 記録の検索が失敗した理由（① ② が返した文。無ければステータス番号・エラーの文） */
export const recordErrorOf = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        const message: unknown = error.response?.data?.message;
        if (typeof message === 'string' && message !== '') return message;
        if (error.response) return `応答 ${error.response.status}`;
    }
    return error instanceof Error ? error.message : '原因不明';
};

export const RECORD_CSS = `
.dbr_card { margin: 4px; padding: 6px 10px; gap: 6px; }
.dbr_card .target { width: 220px; }
.dbr_label { font-size: 11px; font-weight: 700; color: #6b7280; white-space: nowrap; }
.dbr_card .rk_btn { padding: 6px 12px; }
.dbr_card .rk_btn:disabled { opacity: .5; cursor: not-allowed; }
.dbr_note { font-size: 11px; color: #6b7280; white-space: nowrap; }
.dbr_note_warn { color: #b45309; }
.dbr_note_error { display: inline-block; color: #b91c1c; font-weight: 700; max-width: 420px; overflow: hidden; text-overflow: ellipsis; }
.database .dbk_table td.dbr_cell { width: ${RECORD_COL_WIDTH}px; min-width: ${RECORD_COL_WIDTH}px; text-align: left; vertical-align: top; }
.dbr_item { display: grid; grid-template-columns: 74px 96px 1fr; gap: 6px; padding: 3px 0; line-height: 1.5; }
.dbr_item + .dbr_item { border-top: 1px dashed #e5e7eb; }
.dbr_day { color: #4b5563; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dbr_kind { font-size: 10px; font-weight: 700; border-radius: 6px; padding: 1px 6px; align-self: start; text-align: center; }
.dbr_kind_call { background: #eff6ff; color: #1d4ed8; }
.dbr_kind_talk { background: #ecfdf5; color: #047857; }
.dbr_text { color: #1f2937; word-break: break-all; }
.dbr_mark { background: #fde68a; color: #111827; font-weight: 700; padding: 0 1px; border-radius: 2px; }
.dbr_more { font-size: 10px; color: #6b7280; padding-top: 2px; }
`;

interface RecordSearchCardProps {
    /** 今検索している語（URL・state の値） */
    value: string;
    /** 検索する（空なら解除） */
    onSearch: (keyword: string) => void;
    /** ② に届かない（予備の全件読み込み）とき */
    disabled: boolean;
    /** 一覧を読み込み中か */
    loading: boolean;
    /** 記録の検索が失敗した理由（失敗していなければ空） */
    error: string;
}

/** 「商談・架電記録から検索」のカード（ページ送りの右に置く。見た目は rk_bar・dbk_bar） */
export const RecordSearchCard: React.FC<RecordSearchCardProps> = ({ value, onSearch, disabled, loading, error }) => {
    const [input, setInput] = useState(value);
    // ⚠️ 解除・URL から戻したときに入力欄もそろえる
    useEffect(() => setInput(value), [value]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(input.trim());
    };

    return (
        <form className='rk_bar dbk_bar dbr_card' onSubmit={submit}>
            <span className='dbr_label'><i className='fa-solid fa-comments me-1'></i>商談・架電記録</span>
            <input className='target' placeholder='記録の内容で検索' value={input} disabled={disabled}
                onChange={(e) => setInput(e.target.value)} />
            <button type='submit' className='rk_btn' disabled={disabled || input.trim() === ''}>商談・架電記録から検索</button>
            {value !== '' && <button type='button' className='rk_btn rk_btn_ghost' onClick={() => onSearch('')}>解除</button>}
            {disabled && <span className='dbr_note dbr_note_warn'>この検索は今は使えません</span>}
            {!disabled && loading && value !== '' && <span className='dbr_note'>記録を検索しています…</span>}
            {!disabled && !loading && error !== '' && <span className='dbr_note dbr_note_error' title={error}>記録の検索に失敗しました（{error}）</span>}
        </form>
    );
};

/** 「商談・架電内容」の列のセル（日付｜架電・商談とアクション｜本文。検索した語に色を付ける） */
export const RecordCell: React.FC<{ group?: RecordHitGroup }> = ({ group }) => (
    <td className='dbr_cell'>
        {group?.items.map((h, i) => (
            <div key={i} className='dbr_item'>
                <span className='dbr_day'>{h.day || '日付なし'}</span>
                <span className={`dbr_kind ${h.kind === '架電' ? 'dbr_kind_call' : 'dbr_kind_talk'}`}>{h.kind}{h.action ? `・${h.action}` : ''}</span>
                <span className='dbr_text'>{h.before}{h.match && <mark className='dbr_mark'>{h.match}</mark>}{h.after}</span>
            </div>
        ))}
        {group && group.total > group.items.length && <div className='dbr_more'>ほか {group.total - group.items.length} 件</div>}
    </td>
);
