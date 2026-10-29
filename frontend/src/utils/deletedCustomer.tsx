import React from 'react';

/**
 * 個人情報削除で「削除済み」にした顧客（v2.2.229）。
 *
 * ⚠️ 顧客DB（database）・顧客詳細（information）には ② が返さない。
 * ⚠️ 集計（customerTrend・shopTrend・rank・company）には返る（歩留まりに数えるため）。
 *   歩留まりを押して出る一覧では、名前の代わりに「削除済み顧客」と出し、顧客名・編集ボタンを押せなくする。
 * ⚠️ 判定は ② が集計の行に付ける delete_dashboard（1 = 削除済み）。
 */

export const DELETED_CUSTOMER_LABEL = '削除済み顧客';

/** ⚠️ 引数は object で受ける（画面ごとの行の型に delete_dashboard が書かれていなくても渡せるように） */
export const isDelete = (row: object | null | undefined): boolean =>
    Number((row as { delete_dashboard?: unknown } | null | undefined)?.delete_dashboard) === 1;

type NameProps = {
    /** 集計の1行（delete_dashboard を見る） */
    row: object;
    /** 押したとき（顧客詳細を開く）。⚠️ 削除済みなら呼ばない */
    onClick?: () => void;
    /** 名前の部分（「様」や王冠のアイコンを含めてよい） */
    children: React.ReactNode;
    style?: React.CSSProperties;
};

/**
 * 歩留まりの一覧の顧客名。削除済みなら灰色の「削除済み顧客」で押せない。
 * それ以外は今までどおり点線の下線つきで押せる（onClick が無ければただの文字）。
 */
export const CustomerName = ({ row, onClick, children, style }: NameProps) => {
    if (isDelete(row)) {
        return <span className="text-secondary" style={{ cursor: 'not-allowed', ...style }}
            title="個人情報を削除した顧客です。開けません">{DELETED_CUSTOMER_LABEL}</span>;
    }
    if (!onClick) return <>{children}</>;
    return <span onClick={onClick} style={{ cursor: 'pointer', textDecoration: 'underline dotted', ...style }}>{children}</span>;
};
