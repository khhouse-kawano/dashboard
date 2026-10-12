import React from 'react';

/**
 * 氏名②（customer_contacts_name_2）の表示と検索（v2.2.187 新規）。
 *
 * ⚠️ 顧客一覧（DatabaseOrder.tsx / DatabaseKaeru.tsx / DatabaseResale.tsx）の3画面で使う。
 * ⚠️ サーバーは `customer_2` という名前で返す（⚠️ ② features/database/queries.ts と
 *   ① handlers/databaseAction/database_*.php の両方。⚠️ 片方だけだと、どちらが応答したかで出たり出なかったりする）。
 * ⚠️ 値が無い（NULL は '' で返る）・空白だけのときは ⚠️ **今までと同じ1行の並び**（アイコン → 氏名①）。
 */

/** 空白（半角・全角）を消した名前。⚠️ 検索の比較に使う（既存の _cleanCustomer と同じ規則） */
export const cleanCustomerName = (value: unknown): string =>
    String(value ?? '').replace(/[\s　]+/g, '');

/** 氏名② があるか */
export const hasCustomerName2 = (value: unknown): boolean => cleanCustomerName(value) !== '';

type CustomerNameCellProps = {
    /** 氏名の左に出すアイコン（ギフトのドット・Nexus・カメラ・重複顧客 など）。⚠️ 並びは各画面のまま渡す */
    icons?: React.ReactNode;
    /** 氏名① */
    name: React.ReactNode;
    /** 氏名②（customer_2） */
    name2: unknown;
    /** 氏名①の右に続けて出すもの（中古の「媒介編集」「媒介追加」など） */
    after?: React.ReactNode;
};

/**
 * 顧客名のマスの中身（v2.2.187 修正: 2026-10-12 の指示で並びを変更）。
 *
 *   氏名②あり:   [アイコン] 氏名①
 *                 （縦中央）  氏名②
 *     ⚠️ アイコンは ⚠️ **氏名①②の2行に対して縦の真ん中**にそろえる。⚠️ 氏名①と②は左端をそろえる。
 *     ⚠️ 氏名②は氏名①と同じ大きさの灰色（⚠️ 氏名①と区別するため。⚠️ 2026-10-12 に大きさをそろえた）。
 *   氏名②なし:   [アイコン] 氏名①  … ⚠️ 今までと同じ（⚠️ 行の高さを変えない）
 */
export const CustomerNameCell = ({ icons, name, name2, after }: CustomerNameCellProps) => {
    if (!hasCustomerName2(name2)) {
        return <>{icons}{name}{after}</>;
    }
    const text = String(name2).trim();
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            {icons && <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center' }}>{icons}</span>}
            <div style={{ minWidth: 0 }}>
                <div>{name}{after}</div>
                {/* ⚠️ 2026-10-12: 文字の大きさは氏名①と同じ（⚠️ 色だけ灰色で区別する） */}
                <div style={{ color: '#6c757d' }} title={`氏名②：${text}`}>{text}</div>
            </div>
        </div>
    );
};
