import React from 'react';

/**
 * 販促媒体別反響推移の「ポータル反響のみ表示」（v2.2.282。注文・建売で共通）。
 *
 * ポータル反響かどうかは、反響一覧から取り込んだときに付く顧客台帳の印（portal_flag。v2.2.281）で決める。
 * ⚠️ 判定の規則は backend-express/src/features/list/portal.ts。画面では印を見るだけにする。
 * ⚠️ 反響一覧を通さずに登録した顧客には印が無いので、チェック中は数えない。
 */
export const isPortalCustomer = (o: { portal_flag?: number | string }): boolean => Number(o.portal_flag) === 1;

type Props = { checked: boolean; onChange: (next: boolean) => void };

const PortalOnlyCheck: React.FC<Props> = ({ checked, onChange }) => (
    <div className="m-1">
        <label className="target checkbox d-flex align-items-center">
            <input type="checkbox" checked={checked} className='me-1' onChange={() => onChange(!checked)} />ポータル反響のみ表示
        </label>
    </div>
);

export default PortalOnlyCheck;
