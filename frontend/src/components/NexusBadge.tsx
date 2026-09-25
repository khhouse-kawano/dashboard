import React from 'react';

/**
 * Nexus（自社の別システム）へ移行できる顧客に付けるアイコン。
 *
 * ⚠️ 出すかどうかは呼び出し側が `isNexus()` / `isNexusRow()` で決める。
 *   ⚠️ **このコンポネント自身は判定しない**（画面ごとにデータの形が違うため）。
 *
 * ⚠️ 色は指示どおり **ネイビー背景・白文字**で固定。
 *   ⚠️ Bootstrap の `bg-primary` は明るい青なので使わないこと。
 */
type Props = {
    /** 余白の付け方が画面ごとに違うので外から渡す（例: 'me-1' / 'mt-1'） */
    className?: string;
};

const NexusBadge = ({ className }: Props) => (
    <span
        className={`d-inline-block rounded fw-bold ${className ?? ''}`}
        style={{
            backgroundColor: '#1b2a56',
            color: '#ffffff',
            fontSize: '9px',
            letterSpacing: '0.5px',
            padding: '1px 5px',
            whiteSpace: 'nowrap'
        }}
        title="Nexusへ移行できる形式です（フリガナがカタカナ・姓名間が半角スペース）"
    >
        Nexus
    </span>
);

export default NexusBadge;
