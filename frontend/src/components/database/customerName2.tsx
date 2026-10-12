import React from 'react';

/**
 * 氏名②（customer_contacts_name_2）の表示と検索（v2.2.187 新規）。
 *
 * ⚠️ 顧客一覧（DatabaseOrder.tsx / DatabaseKaeru.tsx / DatabaseResale.tsx）の3画面で使う。
 * ⚠️ サーバーは `customer_2` という名前で返す（⚠️ ② features/database/queries.ts と
 *   ① handlers/databaseAction/database_*.php の両方。⚠️ 片方だけだと、どちらが応答したかで出たり出なかったりする）。
 * ⚠️ 値が無い（NULL は '' で返る）・空白だけのときは何も出さない（⚠️ 1行のまま）。
 */

/** 空白（半角・全角）を消した名前。⚠️ 検索の比較に使う（既存の _cleanCustomer と同じ規則） */
export const cleanCustomerName = (value: unknown): string =>
    String(value ?? '').replace(/[\s　]+/g, '');

/** 氏名② があるか */
export const hasCustomerName2 = (value: unknown): boolean => cleanCustomerName(value) !== '';

/**
 * 顧客名のマスの2行目（氏名②）。⚠️ 値が無ければ null。
 * ⚠️ 1行目（氏名①）と区別するため、少し小さい灰色の文字にする。
 */
export const CustomerName2 = ({ value }: { value: unknown }) => {
    if (!hasCustomerName2(value)) return null;
    const text = String(value).trim();
    return (
        <div style={{ fontSize: '0.85em', color: '#6c757d', lineHeight: 1.3 }} title={`氏名②：${text}`}>
            {text}
        </div>
    );
};
