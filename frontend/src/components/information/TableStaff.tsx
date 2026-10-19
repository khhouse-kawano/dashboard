import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { selectStyle } from '../../utils/informationUtils';
import { safeFormate } from '../../utils/informationUtils';

type Staff = { name: string; shop: string; category: number, section: string, period: string };

type Props = {
    information: Record<string, string>,
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    idMapping: (text: string) => string,
    staffArray: Staff[],
    /**
     * 選んでいる事業（注文営業なら注文事業）の店舗。⚠️ 並び順もこの順（店舗の表の順）。
     * ⚠️ v2.2.197: 営業の事業は「所属店舗の事業」で決める（staff_list に事業の列は無い）。
     */
    shopNames: string[],
    setShowDetail: React.Dispatch<React.SetStateAction<string>>,
    id: string
}

/** 一覧の1行。⚠️ kind で見出し・現在の担当・店舗の営業・管理を分ける */
type Option = { name: string; shop: string; kind: 'current' | 'own' | 'kanri' | 'other' };

/** ⚠️ staff_list には「KH霧島店 管理」のような名前の行もある → 営業の一覧からは外し、管理は1つにまとめる */
const isKanri = (name: string) => / 管理$/.test(name);

/**
 * 担当営業の選択（顧客情報・注文営業）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ v2.2.197 で select から自前のドロップダウンに変えた（2026-10-19 の指示）。
 *   ⚠️ 以前は担当店舗の営業しか選べず、⚠️⚠️ **一覧に無い担当（他店舗の営業など）が入っている顧客は「担当営業を選択」と表示され、
 *     そのまま保存し直すと担当が変わってしまうことがあった**（指示書の「{in_charge_store 管理}になってしまう」）。
 * ⚠️ 開いたとき: 「現在の担当」（一覧に無いときだけ）→ 担当店舗の営業 → 「◯◯ 管理」→「他店舗の営業を表示」。
 *   ⚠️「他店舗の営業を表示」を押すと、同じ事業の全営業（今年度）を店舗ごとに出す。⚠️ 閉じると最初の形に戻る。
 * ⚠️ 他店舗の営業を選んでも、担当店舗は変えない（指示）。⚠️ 欄の右に「他店舗：◯◯」と出す。
 * ⚠️ 選んだときの処理（変更前の担当を first_interviewed_user に残す・管理にしたら理由の入力を出す）は以前の select と同じ。
 * ─────────────────────────────────────────────
 */
const TableStaff = ({ information, setInformation, idMapping, staffArray, shopNames, setShowDetail, id }: Props) => {
    const staffKey = idMapping('担当営業');
    const store = safeFormate(information.in_charge_store);
    const current = safeFormate(information[staffKey]);
    const kanriName = `${store} 管理`;

    const [open, setOpen] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [active, setActive] = useState(-1);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);

    /** 同じ事業の営業（⚠️ 管理の行を除く・同じ人の重複を除く） */
    const divisionStaff = useMemo(() => {
        const seen = new Set<string>();
        const order = new Map(shopNames.map((s, i) => [s, i]));
        return staffArray
            .filter(s => order.has(s.shop) && !isKanri(s.name))
            .filter(s => { const k = `${s.shop}/${s.name}`; if (seen.has(k)) return false; seen.add(k); return true; })
            .sort((a, b) => (order.get(a.shop)! - order.get(b.shop)!));
    }, [staffArray, shopNames]);

    // ⚠️ 今の担当の所属は、事業に関係なく今年度の名簿全体から探す（⚠️ 建売の営業が注文の顧客の担当になっていることもある）
    const currentStaff = staffArray.find(s => s.name === current && s.shop === store) ?? staffArray.find(s => s.name === current && !isKanri(s.name));
    /** 他店舗の営業が担当になっているとき、その店舗 */
    const currentOtherShop = currentStaff && currentStaff.shop !== store ? currentStaff.shop : '';

    const options = useMemo<Option[]>(() => {
        const own = divisionStaff.filter(s => s.shop === store).map<Option>(s => ({ name: s.name, shop: s.shop, kind: 'own' }));
        const list: Option[] = [];
        // ⚠️ 今の担当が一覧に出ないとき（他店舗の営業・今年度の名簿に無い人）は先頭に出す。⚠️ 出さないと誰が担当か分からない
        const shownByDefault = current === kanriName || own.some(o => o.name === current);
        const shownInOthers = showAll && divisionStaff.some(s => s.name === current);
        if (current !== '' && !shownByDefault && !shownInOthers) list.push({ name: current, shop: currentOtherShop, kind: 'current' });
        list.push(...own);
        if (store !== '') list.push({ name: kanriName, shop: store, kind: 'kanri' });
        if (showAll) {
            const k = keyword.trim();
            list.push(...divisionStaff
                .filter(s => s.shop !== store)
                .filter(s => k === '' || s.name.includes(k) || s.shop.includes(k))
                .map<Option>(s => ({ name: s.name, shop: s.shop, kind: 'other' })));
        }
        return list;
    }, [divisionStaff, store, current, kanriName, currentOtherShop, showAll, keyword]);

    // ⚠️ 外を押したら閉じる
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // ⚠️ キーで動かした行が見えるように
    useEffect(() => {
        if (!open || active < 0) return;
        listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [active, open]);

    const openList = () => {
        setShowAll(false);
        setKeyword('');
        setActive(-1);
        setOpen(true);
    };

    /** 選ぶ。⚠️ 中身は以前の select の onChange と同じ */
    const choose = (newStaff: string) => {
        setOpen(false);
        if (newStaff === current) return;
        setInformation(prev => ({
            ...prev,
            [staffKey]: newStaff,
            first_interviewed_user: id !== 'new' ? safeFormate(prev[staffKey]) : ''
        }));
        if (newStaff === kanriName && id !== 'new') {
            setShowDetail('staff');
        }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList(); }
            return;
        }
        // ⚠️ 顧客情報はモーダルの中。⚠️ Esc を外へ流すと顧客情報ごと閉じるので、ここで止める
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); return; }
        if (e.key === 'Enter' && active >= 0 && options[active]) { e.preventDefault(); choose(options[active].name); }
    };

    const otherCount = divisionStaff.filter(s => s.shop !== store).length;

    return (
        <>
            {/* ⚠️ このコンポーネント専用のスタイル（接頭辞 ts_） */}
            <style>{`
                .ts_root { position: relative; display: inline-block; }
                .ts_trigger { display: flex; align-items: center; justify-content: space-between; gap: 6px; background: #fff;
                              cursor: pointer; text-align: left; font-size: 12px; padding-right: 8px; }
                .ts_trigger:focus-visible { outline: 2px solid #86b7fe; outline-offset: 1px; }
                .ts_trigger_text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .ts_trigger_text.is_empty { color: #8a8f96; }
                .ts_caret { font-size: 9px; color: #6b7280; }
                .ts_menu { position: absolute; top: 100%; left: 0; margin-top: 2px; z-index: 1050; min-width: 240px; background: #fff;
                           border: 1px solid #d3d3d3; border-radius: 6px; box-shadow: 0 6px 18px rgba(15, 23, 42, .12); font-size: 12px; }
                .ts_list { max-height: 280px; overflow-y: auto; padding: 4px 0; }
                .ts_group { font-size: 10px; font-weight: 700; color: #6b7280; padding: 6px 10px 2px; letter-spacing: .04em; }
                .ts_option { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 10px; cursor: pointer; color: #303030; }
                .ts_option.is_active, .ts_option:hover { background: #f1f5f9; }
                .ts_option.is_selected { font-weight: 700; color: #0d6efd; }
                .ts_option small { color: #8a8f96; font-weight: 400; white-space: nowrap; }
                .ts_option.is_current small { color: #b45309; }
                .ts_search { padding: 6px 8px; border-bottom: 1px solid #eef0f2; }
                .ts_search input { width: 100%; border: 1px solid #d3d3d3; border-radius: 4px; padding: 3px 8px; font-size: 12px; }
                .ts_more { display: block; width: 100%; border: none; border-top: 1px solid #eef0f2; background: #f8f9fa; color: #0d6efd;
                           font-size: 12px; font-weight: 700; padding: 7px 10px; text-align: left; cursor: pointer; border-radius: 0 0 6px 6px; }
                .ts_more:hover { background: #eef4ff; }
                .ts_other_note { font-size: 11px; color: #b45309; white-space: nowrap; }
            `}</style>
            <div className="d-flex align-items-center flex-wrap gap-2">
                <div className="ts_root" ref={rootRef} onKeyDown={onKeyDown}>
                    <button
                        type="button"
                        className="ts_trigger"
                        // ⚠️ 見た目は他の select（selectStyle）と同じ。⚠️ 名前が長いときのために幅だけ伸ばせるようにする
                        style={{ ...selectStyle, width: 'auto', minWidth: '150px', maxWidth: '240px' }}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        onClick={() => (open ? setOpen(false) : openList())}
                    >
                        <span className={`ts_trigger_text${current === '' ? ' is_empty' : ''}`}>{current === '' ? '担当営業を選択' : current}</span>
                        <span className="ts_caret" aria-hidden="true">▼</span>
                    </button>

                    {open && (
                        <div className="ts_menu">
                            {showAll && (
                                <div className="ts_search">
                                    <input autoFocus type="text" value={keyword} placeholder="名前・店舗で探す"
                                        onChange={(e) => { setKeyword(e.target.value); setActive(-1); }} aria-label="営業を名前・店舗で探す" />
                                </div>
                            )}
                            <div className="ts_list" role="listbox" ref={listRef} aria-label="担当営業">
                                {options.map((o, i) => {
                                    // ⚠️ 他店舗の営業は店舗ごとに見出しを付ける
                                    const groupHead = (i === 0 || options[i - 1].kind !== o.kind || (o.kind === 'other' && options[i - 1].shop !== o.shop))
                                        ? (o.kind === 'current' ? '現在の担当' : o.kind === 'own' ? `${store}の営業` : o.kind === 'other' ? o.shop : '')
                                        : '';
                                    return (
                                        <React.Fragment key={`${o.kind}/${o.shop}/${o.name}`}>
                                            {groupHead !== '' && <div className="ts_group">{groupHead}</div>}
                                            <div
                                                role="option"
                                                aria-selected={o.name === current}
                                                data-index={i}
                                                className={`ts_option${i === active ? ' is_active' : ''}${o.name === current ? ' is_selected' : ''}${o.kind === 'current' ? ' is_current' : ''}`}
                                                onMouseEnter={() => setActive(i)}
                                                onClick={() => choose(o.name)}
                                            >
                                                <span>{o.name}</span>
                                                {o.kind === 'current' && <small>{o.shop ? `他店舗：${o.shop}` : isKanri(o.name) ? '他店舗の管理' : '今年度の営業の名簿に無い'}</small>}
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                                {store === '' && !showAll && <div className="ts_group">先に担当店舗を選んでください</div>}
                                {showAll && options.every(o => o.kind !== 'other') && (
                                    <div className="ts_group">{keyword ? '該当する営業がいません' : '他店舗の営業はいません'}</div>
                                )}
                            </div>
                            {!showAll && otherCount > 0 && (
                                <button type="button" className="ts_more" onClick={() => { setShowAll(true); setActive(-1); }}>
                                    他店舗の営業を表示（{otherCount}人）
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {currentOtherShop !== '' && <span className="ts_other_note">他店舗：{currentOtherShop}</span>}

                {(current === kanriName && information.first_interviewed_user)
                    && <div>変更前:{safeFormate(information.first_interviewed_user)}({safeFormate(information.last_action_step_migration_item_name)})</div>}
            </div>
        </>
    )
}

export default memo(TableStaff, (prevProps, nextProps) => {
    const staffKey = prevProps.idMapping('担当営業');

    const fieldsToCheck = [
        staffKey,
        'in_charge_store',
        'first_interviewed_user',
        'last_action_step_migration_item_name'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    if (prevProps.staffArray !== nextProps.staffArray) return false;
    if (prevProps.shopNames !== nextProps.shopNames) return false;
    if (prevProps.id !== nextProps.id) return false;


    return true;
});
