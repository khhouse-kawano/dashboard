import React, { useEffect, useState } from 'react';
import TableInput from './TableInput';

/**
 * 顧客の編集画面（InformationEdit / Kaeru / Resale）の連絡先の LINE ID 欄と LINE アイコン。
 *
 * ⚠️⚠️ アイコンは「LINE ID をコピー」して「LINE WORKS の連絡先（登録画面）を新しいタブで開く」。
 *   ⚠️ お客様の個人 LINE ID からトークルームを直接開く方法は無く、先に連絡先へ登録する必要があるため。
 *   ⚠️ 開き先を変えるときは LINE_WORKS_CONTACT_URL だけ直す。
 */
const LINE_WORKS_CONTACT_URL = 'https://contact.worksmobile.com/p/web/shared/contact';
const LINE_GREEN = '#06C755';

type Props = {
    information: Record<string, string>;
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

const LineIdRow = ({ information, setInformation }: Props) => (
    <div className='d-flex align-items-center'>
        <TableInput information={information} setInformation={setInformation} itemKey='line_id' defaultValue='LINE ID' />
        <LineWorksButton lineId={information.line_id} />
    </div>
);

/** ⚠️ LINE ID が空なら薄く表示して押せない */
const LineWorksButton = ({ lineId }: { lineId: string | null | undefined }) => {
    const value = String(lineId ?? '').trim();
    const enabled = value !== '';
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 2000);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const handleClick = async () => {
        if (!enabled) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
        } catch (error) {
            // ⚠️ コピーできなくても連絡先は開く（ID は画面に出ているので手で入力できる）
            console.error('LINE ID をコピーできませんでした', error);
        }
        window.open(LINE_WORKS_CONTACT_URL, '_blank', 'noopener,noreferrer');
    };

    const label = enabled ? `LINE ID（${value}）をコピーして LINE WORKS の連絡先を開く` : 'LINE ID が未入力です';

    return (
        <span className="d-inline-flex align-items-center" style={{ verticalAlign: 'middle' }}>
            <button
                type="button"
                onClick={() => void handleClick()}
                disabled={!enabled}
                aria-label={label}
                title={label}
                style={{
                    border: 'none', background: 'transparent', padding: '0 4px', lineHeight: 1,
                    color: LINE_GREEN, opacity: enabled ? 1 : 0.35,
                    cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '20px',
                }}
            >
                <i className="fa-brands fa-line" aria-hidden="true"></i>
            </button>
            {copied && <span style={{ fontSize: '10px', color: LINE_GREEN, fontWeight: 700 }}>コピーしました</span>}
        </span>
    );
};

export default LineIdRow;
