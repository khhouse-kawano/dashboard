import React, { memo, useEffect, useRef } from 'react';
import { RANKS } from './companyAggregate';
import { dateFormate } from './companyUtils';
import type { Customer, Head, InputCell, NumCell, RowModel } from './companyTypes';

/**
 * 全社報告用フォーマットの表（v2.2.264 で Company.tsx から分けた）。
 *
 * ⚠️ 行とセルの中身は companyAggregate.ts の buildRows が作る。ここは並べるだけ（顧客・予算の配列を探さない）。
 * ⚠️ セルは memo。予算を1つ保存すると行の配列は作り直されるが、文字が変わらないセルは描き直さない。
 * ⚠️ 部品は必ずこのファイルの一番上の階層に置く（以前は Company の中で定義していて、描き直すたびに全セルを作り直していた）。
 */

/** 見出し2列 ＋ 12か月 ＋ 合計・個人目標 ＋ 区切り ＋ ランク5列 */
const COLUMN_COUNT = 2 + 12 + 2 + 1 + RANKS.length;

const sameList = (a: Customer[], b: Customer[]): boolean => a === b || (a.length === b.length && a.every((v, i) => v === b[i]));

type NumProps = { cell: NumCell; showLastYear: boolean; showCancel: boolean; onOpen: (list: Customer[]) => void };

const NumTd = memo(({ cell, showLastYear, showCancel, onOpen }: NumProps) => {
    // ⚠️ 不動産企画係の売上（sales）は押せない（お客様の一覧を持っていない）
    const clickable = cell.tone === 'contract' && cell.list.length > 0;
    const on = cell.active ? ` co_on-${cell.tone === 'budgetFixed' ? 'budget' : cell.tone}` : '';
    return (
        <td rowSpan={cell.rowSpan} colSpan={cell.colSpan} className={`${on}${clickable ? ' co_click' : ''}`}
            onClick={clickable ? () => onOpen(cell.list) : undefined}>
            <div className="co_n">
                {cell.main}
                {cell.broker > 0 && <span className="co_broker">({cell.broker})</span>}
                {showCancel && cell.cancel > 0 && <span className="co_cancel">{cell.cancel}</span>}
                {showLastYear && cell.ly !== null &&
                    <span className="co_ly" style={{ right: `${cell.lyRight}px` }}>
                        {cell.ly}
                        {cell.lyBroker > 0 && <span className="co_broker">({cell.lyBroker})</span>}
                    </span>}
            </div>
        </td>
    );
}, (a, b) =>
    a.showLastYear === b.showLastYear && a.showCancel === b.showCancel && a.onOpen === b.onOpen
    && a.cell.tone === b.cell.tone && a.cell.main === b.cell.main && a.cell.broker === b.cell.broker && a.cell.cancel === b.cell.cancel
    && a.cell.ly === b.cell.ly && a.cell.lyBroker === b.cell.lyBroker && a.cell.lyRight === b.cell.lyRight && a.cell.active === b.cell.active
    && a.cell.colSpan === b.cell.colSpan && a.cell.rowSpan === b.cell.rowSpan && sameList(a.cell.list, b.cell.list));

export type CommitBudget = (period: string, category: string, name: string, value: string) => void;

/**
 * 予算の入力欄。
 * ⚠️ 入力中の文字は欄（useRef）だけが持つ。**欄を離れたとき（または Enter）に保存する**（2026-11-11 の決定）。
 *   以前は1文字ごとに保存し、そのたびに表全体を描き直していた。
 * ⚠️ Esc で入力前の値に戻す。
 * ⚠️ 保存に失敗したときは、Company.tsx が値を元に戻す（cell.value が戻り、下の useEffect が欄も戻す）。
 */
const BudgetInput = memo(({ cell, onCommit }: { cell: InputCell; onCommit: CommitBudget }) => {
    const ref = useRef<HTMLInputElement | null>(null);
    const saved = useRef(cell.value);
    useEffect(() => {
        saved.current = cell.value;
        // ⚠️ 入力中の欄は書き換えない（ほかの欄の保存で表が作り直されても、打っている文字を消さない）
        if (ref.current && document.activeElement !== ref.current) ref.current.value = cell.value;
    }, [cell.value]);

    const commit = () => {
        // ⚠️ 全角の数字は半角にそろえて保存する（全角のままだと合計が NaN になる）
        const value = (ref.current?.value ?? '').normalize('NFKC').trim();
        if (ref.current) ref.current.value = value;
        if (value === saved.current) return;
        saved.current = value;
        onCommit(cell.period, cell.category, cell.name, value);
    };
    return (
        <td colSpan={cell.colSpan} className={`co_in-${cell.tone}`}>
            <input ref={ref} type="text" className="co_in" defaultValue={cell.value} inputMode="decimal"
                aria-label={`${cell.name} ${cell.category === 'shop' ? `${cell.period} の予算` : '個人目標'}`}
                onBlur={commit}
                onKeyDown={(e) => {
                    // ⚠️ 日本語入力の確定の Enter では保存しない
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') { e.currentTarget.value = saved.current; e.currentTarget.blur(); }
                }} />
        </td>
    );
}, (a, b) => a.onCommit === b.onCommit && a.cell.value === b.cell.value && a.cell.name === b.cell.name
    && a.cell.period === b.cell.period && a.cell.category === b.cell.category && a.cell.tone === b.cell.tone && a.cell.colSpan === b.cell.colSpan);

const HeadTd = ({ h }: { h: Head }) => (
    <td rowSpan={h.rowSpan} colSpan={h.colSpan}
        className={`${h.second ? 'co_c2' : 'co_c1'} co_h-${h.variant}${h.color !== undefined ? ` co_col${h.color % 6}` : ''}`}>
        {h.text}
    </td>
);

type RowProps = { row: RowModel; showLastYear: boolean; showCancel: boolean; onOpen: (list: Customer[]) => void; onCommit: CommitBudget };

const Row = ({ row, showLastYear, showCancel, onOpen, onCommit }: RowProps) => (
    <>
        {row.gapBefore &&
            <tr className={`co_gap co_gap${row.gapBefore}`} aria-hidden="true">
                <td colSpan={COLUMN_COUNT} data-label={row.gapLabel ?? ''}></td>
            </tr>}
        <tr id={row.id} data-new={row.isNew ? '1' : undefined}
            className={`co_l-${row.level} co_k-${row.kind}${row.first ? ' co_first' : ''}${row.sticky ? ` co_s${row.sticky}` : ''}`}>
            {row.heads.map((h, i) => <HeadTd key={i} h={h} />)}
            {row.tds.map((td, i) => (td.t === 'input'
                ? <BudgetInput key={i} cell={td} onCommit={onCommit} />
                : <NumTd key={i} cell={td} showLastYear={showLastYear} showCancel={showCancel} onOpen={onOpen} />))}
            <td className="co_sep"></td>
            {row.ranks?.map((cell, i) => <NumTd key={`r${i}`} cell={cell} showLastYear={showLastYear} showCancel={showCancel} onOpen={onOpen} />)}
        </tr>
    </>
);

type Props = {
    rows: RowModel[];
    monthArray: string[];
    targetYear: number | null;
    showLastYear: boolean;
    showCancel: boolean;
    onOpen: (list: Customer[]) => void;
    onCommit: CommitBudget;
};

const CompanyTable = ({ rows, monthArray, targetYear, showLastYear, showCancel, onOpen, onCommit }: Props) => (
    <div className="co_scroll">
        <div className="co_pad">
        <div className="co_card">
            <table className="co_tbl">
                <tbody>
                    <tr className="co_s0">
                        <td colSpan={2} className="co_c1">{Number(targetYear) - 1}/06~{Number(targetYear)}/05</td>
                        {monthArray.map(month => <td className="co_m" key={month}>{dateFormate(month)}</td>)}
                        <td className="co_m">合計</td>
                        <td className="co_m">個人目標</td>
                        <td className="co_sep"></td>
                        {RANKS.map(r => <td className="co_m" key={r}>{r}</td>)}
                    </tr>
                    {rows.map(row => <Row key={row.key} row={row} showLastYear={showLastYear} showCancel={showCancel} onOpen={onOpen} onCommit={onCommit} />)}
                </tbody>
            </table>
        </div>
        </div>
    </div>
);

export default memo(CompanyTable);
