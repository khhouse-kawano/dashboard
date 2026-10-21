# 2026-10-19 顧客情報の担当営業：他店舗の営業も選べるように（v2.2.197）

## 依頼（ReadMeClaude.md）
- `frontend/src/components/information/TableStaff.tsx` の改修
  - いまは担当店舗の営業しか選べない → それ以外の人が担当（in_charge_user）に入っている顧客は、表示が崩れ「◯◯店 管理」になってしまう
  - 選択肢を「今年度（period=2027）・選んでいる事業の営業」にする。最初に開いたときは担当店舗の営業と「◯◯店 管理」だけ
  - リストの最後に「他店舗の営業を表示」。押すと全営業から選べる。select で難しければ同じ UX・同じデザインの部品を作る

## 決めたこと（利用者に確認済み）
- 他店舗の営業を選んでも、**担当店舗はそのまま**（欄の右に「他店舗：◯◯店」と出す）
- 対象は **注文営業の顧客情報（TableStaff）だけ**。建売・中古は各画面に同じ select を直接書いているが今回は触らない

## わかったこと
- staff_list に事業（division）の列は無い。→ 営業の事業は **所属店舗の事業（shop_list.division）** で決めた。
  注文営業の顧客情報は、もともと `division === '注文事業'` の店舗（shopArray）を持っているので、その店舗の営業＝注文事業の営業。② / ① の変更なし。
- 「今年度」は InformationEdit の `thisYear`（6月はじまり。2026年10月なら 2027）。staffArray はもともと今年度・営業（category=1）に絞られている。
- staff_list には「KH霧島店 管理」のような名前の行もある → 一覧からは外し、管理の選択肢は担当店舗の「◯◯店 管理」1つにした。
- 実データで、担当店舗の今年度の名簿に無い担当が多い（例：中島 智彦 さん@JH熊本店 171件、宮元 伸太郎 さん@KH八代店 128件、積 元樹 さん@DJH鹿児島北店 125件＝建売の営業）。以前の select では「担当営業を選択」と表示されていた。

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/information | **TableStaff.tsx** | select を自前のドロップダウンに作り替え。props に `shopNames` を追加。`isKanri`・型 `Option`・CSS（接頭辞 ts_）を追加 |
| frontend/src/components/information | InformationEdit.tsx | `shopNames`（useMemo）を作って TableStaff に渡す。import に useMemo |
| frontend/src/utils | version.ts | 2.2.197 |
| backend/scripts/sql | **2026-10-19_update_log_2.2.197.sql**（新規） | update_log 1行 ＋ 記事1本 |
| backend/scripts/guide/articles/order | screen-020.md | 記事「顧客DB」に「担当営業の選び方」 |
| docs | oldDocument へ移動 | 2026-10-15・16 の作業記録と deploy-v2.2.191〜196 |

## 動き
- 開いたとき：（今の担当が一覧に無ければ）「現在の担当」→「◯◯店の営業」→「◯◯店 管理」→ ボタン「他店舗の営業を表示（N人）」
  - 「現在の担当」の右に、他店舗の営業なら「他店舗：◯◯」、名簿に無ければ「今年度の営業の名簿に無い」、他店舗の管理なら「他店舗の管理」
- 「他店舗の営業を表示」：注文事業の全店舗の営業を店舗ごと（店舗の表の順）に出す。上に検索欄（名前・店舗名）
- 閉じて開き直すと最初の形に戻る。外を押す・Esc で閉じる（Esc は顧客情報のモーダルへ流さない）
- キー操作：↓／Enter／スペースで開く、↑↓で移動、Enter で決定
- 選んだときの処理は以前の select と同じ（変更前の担当を first_interviewed_user に残す。「◯◯店 管理」にしたら理由の入力を出す）
- 担当店舗が空（新規）のときは「先に担当店舗を選んでください」

## 業務ガイドの記事
- **顧客DB**（order/screen-020.md）：「## 担当営業の選び方」を追加（最初に出る人・他店舗の営業を表示・担当店舗は変わらない・現在の担当・管理を選んだときの理由入力）

## 確かめたこと（Playwright。顧客DB を ?id= で開いて顧客情報を表示。顧客情報の応答はローカル②の実データ）
- 1 KH霧島店・外 政明：最初は KH霧島店の営業4人＋KH霧島店 管理。ボタン「他店舗の営業を表示（128人）」→ 164行、管理の重複なし。「宇都」で検索 → PGH霧島店 宇都 武幸 → 選ぶと欄に「宇都 武幸」、右に「他店舗：PGH霧島店」、担当店舗は KH霧島店 のまま。開き直すと最初の形（現在の担当が先頭）。外を押すと閉じる。キーで選べる。Esc で一覧だけ閉じ顧客情報は開いたまま。管理を選ぶと「店舗管理への変更理由」が出る
- 2 他店舗の営業が担当（宇都 武幸@KH霧島店）：先頭に「現在の担当／他店舗：PGH霧島店」。他店舗を出すと重複しない
- 3 名簿に無い担当（宮元 伸太郎@KH八代店）：「現在の担当／今年度の営業の名簿に無い」
- 4 建売の営業（積 元樹）：「他店舗：鹿児島3係」
- 5 他店舗の管理（2L鹿児島店 管理@DJH鹿児島北店）：「他店舗の管理」
- 6 新規：「先に担当店舗を選んでください」
- 型チェック：既存の5件のみ
- ⚠️ ② / ① は変更なし（新しい request なし）。① 経由の確認は対象外

## 別件（今回は直していない）
- 顧客 `01K1HR5K0104DTDW0P6VNF0JK4`（JH熊本店・中島 智彦）は、顧客情報を開くと画面が `.map is not a function` で止まる。**改修前のコードでも同じ**（元の TableStaff に戻してビルドして確認）。顧客データ側の何かが原因。
- 担当店舗を選び直すと、TableShop が staff_list の先頭の人を担当に入れるため「◯◯店 管理」（staff_list の管理の行）が入ることがある（既存の動き。触っていない）。

## コード（全文・差分）

### frontend/src/components/information/TableStaff.tsx（全文）
```tsx
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
```

### 差分
```diff
diff --git a/backend/scripts/guide/articles/order/screen-020.md b/backend/scripts/guide/articles/order/screen-020.md
index 7b018782..86e1425f 100644
--- a/backend/scripts/guide/articles/order/screen-020.md
+++ b/backend/scripts/guide/articles/order/screen-020.md
@@ -17,10 +17,19 @@ summary: お客様の検索と、商談の日付・ステータス・ランク
 ## 名前の横の印
 - **緑の点**：ギフト進呈の条件がそろっている（担当が決まっている・反響日がある・初回面談の記録がある・家族情報が入っている）
 - **赤の点**：まだそろっていない
 - **N**：Nexus に連携済み
 
+## 担当営業の選び方
+顧客情報の「担当営業」を押すと、一覧が開きます。
+- はじめは、**担当店舗の営業**と「〇〇店 管理」だけが出ます
+- 一番下の **他店舗の営業を表示** を押すと、注文営業の全店舗の営業が店舗ごとに出ます。上の欄で名前や店舗名で探せます
+- 他店舗の営業を選んでも、**担当店舗は変わりません**。欄の右に「他店舗：〇〇店」と出ます
+- 今の担当が一覧に無いとき（他店舗の営業・今年度の名簿にいない人）は、一番上に「現在の担当」として出ます
+
+> 注意：「〇〇店 管理」を選ぶと、店舗管理に変える理由を入力する画面が出ます。
+
 ## 上のボタン
 - **キャンセル集計（要回答）**：来場予約日を過ぎても、初回面談もキャンセル理由も空のお客様
 - **失注集計（要回答）**：失注理由などが抜けているお客様（[[失注したら]]）
 
 ## 関係する記事
diff --git a/frontend/src/components/information/InformationEdit.tsx b/frontend/src/components/information/InformationEdit.tsx
index 9ad0a8ce..8a6c2f04 100644
--- a/frontend/src/components/information/InformationEdit.tsx
+++ b/frontend/src/components/information/InformationEdit.tsx
@@ -1,6 +1,6 @@
-import React, { useEffect, useState, useContext, useRef } from 'react';
+import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
 import Modal from 'react-bootstrap/Modal';
 import axios from 'axios';
 import { headers } from '../../utils/headers';
 import Table from "react-bootstrap/Table";
 import { databaseList } from '../../utils/databaseList';
@@ -159,10 +159,12 @@ const steps = [
 ];
 const InformationEdit = ({ id, token, onClose, authority }: Props) => {
     const { userName } = useContext(AuthContext);
     const { category } = useContext(AuthContext);
     const [shopArray, setShopArray] = useState<Shop[]>([]);
+    // ⚠️ v2.2.197: 担当営業の「他店舗の営業」は、この事業（注文事業）の店舗の営業だけ（TableStaff.tsx）
+    const shopNames = useMemo(() => shopArray.map(s => s.shop), [shopArray]);
     const [information, setInformation] = useState<Customer>({});
     const [staffArray, setStaffArray] = useState<Staff[]>([]);
     const [mediumArray, setMediumArray] = useState<Medium[]>([]);
     const [interviewLog, setInterviewLog] = useState<InterviewLog>({
         id: '',
@@ -904,10 +906,11 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                                             <TableStaff
                                                 information={information}
                                                 setInformation={setInformation}
                                                 idMapping={idMapping}
                                                 staffArray={staffArray}
+                                                shopNames={shopNames}
                                                 setShowDetail={setShowDetail}
                                                 id={id}
                                             />
                                         </td>
                                         <td style={labelStyle}>ステータス</td>
diff --git a/frontend/src/components/information/TableStaff.tsx b/frontend/src/components/information/TableStaff.tsx
index b34d145d..b66de476 100644
--- a/frontend/src/components/information/TableStaff.tsx
+++ b/frontend/src/components/information/TableStaff.tsx
@@ -1,59 +1,233 @@
-import React, { memo } from 'react';
+import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
 import { selectStyle } from '../../utils/informationUtils';
 import { safeFormate } from '../../utils/informationUtils';
 
 type Staff = { name: string; shop: string; category: number, section: string, period: string };
 
 type Props = {
     information: Record<string, string>,
     setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
     idMapping: (text: string) => string,
     staffArray: Staff[],
+    /**
+     * 選んでいる事業（注文営業なら注文事業）の店舗。⚠️ 並び順もこの順（店舗の表の順）。
+     * ⚠️ v2.2.197: 営業の事業は「所属店舗の事業」で決める（staff_list に事業の列は無い）。
+     */
+    shopNames: string[],
     setShowDetail: React.Dispatch<React.SetStateAction<string>>,
     id: string
 }
 
-const TableStaff = ({ information, setInformation, idMapping, staffArray, setShowDetail, id }: Props) => {
+/** 一覧の1行。⚠️ kind で見出し・現在の担当・店舗の営業・管理を分ける */
+type Option = { name: string; shop: string; kind: 'current' | 'own' | 'kanri' | 'other' };
+
+/** ⚠️ staff_list には「KH霧島店 管理」のような名前の行もある → 営業の一覧からは外し、管理は1つにまとめる */
+const isKanri = (name: string) => / 管理$/.test(name);
+
+/**
+ * 担当営業の選択（顧客情報・注文営業）。
+ *
+ * ─────────────────────────────────────────────
+ * ⚠️ v2.2.197 で select から自前のドロップダウンに変えた（2026-10-19 の指示）。
+ *   ⚠️ 以前は担当店舗の営業しか選べず、⚠️⚠️ **一覧に無い担当（他店舗の営業など）が入っている顧客は「担当営業を選択」と表示され、
+ *     そのまま保存し直すと担当が変わってしまうことがあった**（指示書の「{in_charge_store 管理}になってしまう」）。
+ * ⚠️ 開いたとき: 「現在の担当」（一覧に無いときだけ）→ 担当店舗の営業 → 「◯◯ 管理」→「他店舗の営業を表示」。
+ *   ⚠️「他店舗の営業を表示」を押すと、同じ事業の全営業（今年度）を店舗ごとに出す。⚠️ 閉じると最初の形に戻る。
+ * ⚠️ 他店舗の営業を選んでも、担当店舗は変えない（指示）。⚠️ 欄の右に「他店舗：◯◯」と出す。
+ * ⚠️ 選んだときの処理（変更前の担当を first_interviewed_user に残す・管理にしたら理由の入力を出す）は以前の select と同じ。
+ * ─────────────────────────────────────────────
+ */
+const TableStaff = ({ information, setInformation, idMapping, staffArray, shopNames, setShowDetail, id }: Props) => {
+    const staffKey = idMapping('担当営業');
+    const store = safeFormate(information.in_charge_store);
+    const current = safeFormate(information[staffKey]);
+    const kanriName = `${store} 管理`;
+
+    const [open, setOpen] = useState(false);
+    const [showAll, setShowAll] = useState(false);
+    const [keyword, setKeyword] = useState('');
+    const [active, setActive] = useState(-1);
+    const rootRef = useRef<HTMLDivElement | null>(null);
+    const listRef = useRef<HTMLDivElement | null>(null);
+
+    /** 同じ事業の営業（⚠️ 管理の行を除く・同じ人の重複を除く） */
+    const divisionStaff = useMemo(() => {
+        const seen = new Set<string>();
+        const order = new Map(shopNames.map((s, i) => [s, i]));
+        return staffArray
+            .filter(s => order.has(s.shop) && !isKanri(s.name))
+            .filter(s => { const k = `${s.shop}/${s.name}`; if (seen.has(k)) return false; seen.add(k); return true; })
+            .sort((a, b) => (order.get(a.shop)! - order.get(b.shop)!));
+    }, [staffArray, shopNames]);
+
+    // ⚠️ 今の担当の所属は、事業に関係なく今年度の名簿全体から探す（⚠️ 建売の営業が注文の顧客の担当になっていることもある）
+    const currentStaff = staffArray.find(s => s.name === current && s.shop === store) ?? staffArray.find(s => s.name === current && !isKanri(s.name));
+    /** 他店舗の営業が担当になっているとき、その店舗 */
+    const currentOtherShop = currentStaff && currentStaff.shop !== store ? currentStaff.shop : '';
+
+    const options = useMemo<Option[]>(() => {
+        const own = divisionStaff.filter(s => s.shop === store).map<Option>(s => ({ name: s.name, shop: s.shop, kind: 'own' }));
+        const list: Option[] = [];
+        // ⚠️ 今の担当が一覧に出ないとき（他店舗の営業・今年度の名簿に無い人）は先頭に出す。⚠️ 出さないと誰が担当か分からない
+        const shownByDefault = current === kanriName || own.some(o => o.name === current);
+        const shownInOthers = showAll && divisionStaff.some(s => s.name === current);
+        if (current !== '' && !shownByDefault && !shownInOthers) list.push({ name: current, shop: currentOtherShop, kind: 'current' });
+        list.push(...own);
+        if (store !== '') list.push({ name: kanriName, shop: store, kind: 'kanri' });
+        if (showAll) {
+            const k = keyword.trim();
+            list.push(...divisionStaff
+                .filter(s => s.shop !== store)
+                .filter(s => k === '' || s.name.includes(k) || s.shop.includes(k))
+                .map<Option>(s => ({ name: s.name, shop: s.shop, kind: 'other' })));
+        }
+        return list;
+    }, [divisionStaff, store, current, kanriName, currentOtherShop, showAll, keyword]);
+
+    // ⚠️ 外を押したら閉じる
+    useEffect(() => {
+        if (!open) return;
+        const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
+        document.addEventListener('mousedown', onDown);
+        return () => document.removeEventListener('mousedown', onDown);
+    }, [open]);
+
+    // ⚠️ キーで動かした行が見えるように
+    useEffect(() => {
+        if (!open || active < 0) return;
+        listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
+    }, [active, open]);
+
+    const openList = () => {
+        setShowAll(false);
+        setKeyword('');
+        setActive(-1);
+        setOpen(true);
+    };
+
+    /** 選ぶ。⚠️ 中身は以前の select の onChange と同じ */
+    const choose = (newStaff: string) => {
+        setOpen(false);
+        if (newStaff === current) return;
+        setInformation(prev => ({
+            ...prev,
+            [staffKey]: newStaff,
+            first_interviewed_user: id !== 'new' ? safeFormate(prev[staffKey]) : ''
+        }));
+        if (newStaff === kanriName && id !== 'new') {
+            setShowDetail('staff');
+        }
+    };
+
+    const onKeyDown = (e: React.KeyboardEvent) => {
+        if (!open) {
+            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList(); }
+            return;
+        }
+        // ⚠️ 顧客情報はモーダルの中。⚠️ Esc を外へ流すと顧客情報ごと閉じるので、ここで止める
+        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
+        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); return; }
+        if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); return; }
+        if (e.key === 'Enter' && active >= 0 && options[active]) { e.preventDefault(); choose(options[active].name); }
+    };
+
+    const otherCount = divisionStaff.filter(s => s.shop !== store).length;
+
     return (
         <>
-            <div className="d-flex align-items-center">
-                <select
-                    style={selectStyle}
-                    value={safeFormate(information[idMapping('担当営業')])}
-                    onChange={(e) => {
-                        const newStaff = e.target.value;
-                        const listedCustomer = `${information.in_charge_store} 管理`;
-
-                        const selected = staffArray.find(item => item.name === newStaff);
-                        const nextStaffName = selected?.name || newStaff;
-
-                        setInformation(prev => ({
-                            ...prev,
-                            [idMapping('担当営業')]: nextStaffName,
-                            first_interviewed_user: id !== 'new' ? safeFormate(prev[idMapping('担当営業')]) : ''
-                        }));
-
-                        if (newStaff === listedCustomer && id !== 'new') {
-                            setShowDetail('staff');
-                        }
-                    }}
-                >
-                    <option value=''>担当営業を選択</option>
-                    {staffArray
-                        .filter(item => item.shop === information.in_charge_store)
-                        .map((item, index) => (
-                            <option key={index} value={item.name}>
-                                {item.name}
-                            </option>
-                        ))}
-                    <option value={`${information.in_charge_store} 管理`}>{information.in_charge_store} 管理</option>
-                </select>
-
-                {(information[idMapping('担当営業')] === `${information.in_charge_store} 管理` && information.first_interviewed_user)
-                    && <div className="ms-2">変更前:{safeFormate(information.first_interviewed_user)}({safeFormate(information.last_action_step_migration_item_name)})</div>}
-            </div></>
+            {/* ⚠️ このコンポーネント専用のスタイル（接頭辞 ts_） */}
+            <style>{`
+                .ts_root { position: relative; display: inline-block; }
+                .ts_trigger { display: flex; align-items: center; justify-content: space-between; gap: 6px; background: #fff;
+                              cursor: pointer; text-align: left; font-size: 12px; padding-right: 8px; }
+                .ts_trigger:focus-visible { outline: 2px solid #86b7fe; outline-offset: 1px; }
+                .ts_trigger_text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
+                .ts_trigger_text.is_empty { color: #8a8f96; }
+                .ts_caret { font-size: 9px; color: #6b7280; }
+                .ts_menu { position: absolute; top: 100%; left: 0; margin-top: 2px; z-index: 1050; min-width: 240px; background: #fff;
+                           border: 1px solid #d3d3d3; border-radius: 6px; box-shadow: 0 6px 18px rgba(15, 23, 42, .12); font-size: 12px; }
+                .ts_list { max-height: 280px; overflow-y: auto; padding: 4px 0; }
+                .ts_group { font-size: 10px; font-weight: 700; color: #6b7280; padding: 6px 10px 2px; letter-spacing: .04em; }
+                .ts_option { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 10px; cursor: pointer; color: #303030; }
+                .ts_option.is_active, .ts_option:hover { background: #f1f5f9; }
+                .ts_option.is_selected { font-weight: 700; color: #0d6efd; }
+                .ts_option small { color: #8a8f96; font-weight: 400; white-space: nowrap; }
+                .ts_option.is_current small { color: #b45309; }
+                .ts_search { padding: 6px 8px; border-bottom: 1px solid #eef0f2; }
+                .ts_search input { width: 100%; border: 1px solid #d3d3d3; border-radius: 4px; padding: 3px 8px; font-size: 12px; }
+                .ts_more { display: block; width: 100%; border: none; border-top: 1px solid #eef0f2; background: #f8f9fa; color: #0d6efd;
+                           font-size: 12px; font-weight: 700; padding: 7px 10px; text-align: left; cursor: pointer; border-radius: 0 0 6px 6px; }
+                .ts_more:hover { background: #eef4ff; }
+                .ts_other_note { font-size: 11px; color: #b45309; white-space: nowrap; }
+            `}</style>
+            <div className="d-flex align-items-center flex-wrap gap-2">
+                <div className="ts_root" ref={rootRef} onKeyDown={onKeyDown}>
+                    <button
+                        type="button"
+                        className="ts_trigger"
+                        // ⚠️ 見た目は他の select（selectStyle）と同じ。⚠️ 名前が長いときのために幅だけ伸ばせるようにする
+                        style={{ ...selectStyle, width: 'auto', minWidth: '150px', maxWidth: '240px' }}
+                        aria-haspopup="listbox"
+                        aria-expanded={open}
+                        onClick={() => (open ? setOpen(false) : openList())}
+                    >
+                        <span className={`ts_trigger_text${current === '' ? ' is_empty' : ''}`}>{current === '' ? '担当営業を選択' : current}</span>
+                        <span className="ts_caret" aria-hidden="true">▼</span>
+                    </button>
+
+                    {open && (
+                        <div className="ts_menu">
+                            {showAll && (
+                                <div className="ts_search">
+                                    <input autoFocus type="text" value={keyword} placeholder="名前・店舗で探す"
+                                        onChange={(e) => { setKeyword(e.target.value); setActive(-1); }} aria-label="営業を名前・店舗で探す" />
+                                </div>
+                            )}
+                            <div className="ts_list" role="listbox" ref={listRef} aria-label="担当営業">
+                                {options.map((o, i) => {
+                                    // ⚠️ 他店舗の営業は店舗ごとに見出しを付ける
+                                    const groupHead = (i === 0 || options[i - 1].kind !== o.kind || (o.kind === 'other' && options[i - 1].shop !== o.shop))
+                                        ? (o.kind === 'current' ? '現在の担当' : o.kind === 'own' ? `${store}の営業` : o.kind === 'other' ? o.shop : '')
+                                        : '';
+                                    return (
+                                        <React.Fragment key={`${o.kind}/${o.shop}/${o.name}`}>
+                                            {groupHead !== '' && <div className="ts_group">{groupHead}</div>}
+                                            <div
+                                                role="option"
+                                                aria-selected={o.name === current}
+                                                data-index={i}
+                                                className={`ts_option${i === active ? ' is_active' : ''}${o.name === current ? ' is_selected' : ''}${o.kind === 'current' ? ' is_current' : ''}`}
+                                                onMouseEnter={() => setActive(i)}
+                                                onClick={() => choose(o.name)}
+                                            >
+                                                <span>{o.name}</span>
+                                                {o.kind === 'current' && <small>{o.shop ? `他店舗：${o.shop}` : isKanri(o.name) ? '他店舗の管理' : '今年度の営業の名簿に無い'}</small>}
+                                            </div>
+                                        </React.Fragment>
+                                    );
+                                })}
+                                {store === '' && !showAll && <div className="ts_group">先に担当店舗を選んでください</div>}
+                                {showAll && options.every(o => o.kind !== 'other') && (
+                                    <div className="ts_group">{keyword ? '該当する営業がいません' : '他店舗の営業はいません'}</div>
+                                )}
+                            </div>
+                            {!showAll && otherCount > 0 && (
+                                <button type="button" className="ts_more" onClick={() => { setShowAll(true); setActive(-1); }}>
+                                    他店舗の営業を表示（{otherCount}人）
+                                </button>
+                            )}
+                        </div>
+                    )}
+                </div>
+
+                {currentOtherShop !== '' && <span className="ts_other_note">他店舗：{currentOtherShop}</span>}
+
+                {(current === kanriName && information.first_interviewed_user)
+                    && <div>変更前:{safeFormate(information.first_interviewed_user)}({safeFormate(information.last_action_step_migration_item_name)})</div>}
+            </div>
+        </>
     )
 }
 
 export default memo(TableStaff, (prevProps, nextProps) => {
     const staffKey = prevProps.idMapping('担当営業');
@@ -70,10 +244,11 @@ export default memo(TableStaff, (prevProps, nextProps) => {
             return false;
         }
     }
 
     if (prevProps.staffArray !== nextProps.staffArray) return false;
+    if (prevProps.shopNames !== nextProps.shopNames) return false;
     if (prevProps.id !== nextProps.id) return false;
 
 
     return true;
-});
\ No newline at end of file
+});
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 01f18fc5..27f903be 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.196';
+export const newVersion = '2.2.197';
```
