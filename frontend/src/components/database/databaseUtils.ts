export const toHalfWidth = (str: string): string =>
    str.normalize('NFKC').replace(/\D/g, '');

export const dateFormate = (value: string) => {
    if (!value) return '-';
    return value.slice(0, 10).replace(/-/g, '/');
};

// 💡 「xms + ランダム英数字10文字」を生成する関数
export const generateNewId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < 10; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'xms' + randomPart;
};

export const parseTextWithUrl = (text?: string | null) => {
    if (!text) return { cleanText: '-', mapUrl: null };
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = text.match(urlRegex);
    const mapUrl = match ? match[0] : null;
    const cleanText = text.replace(urlRegex, '').replace(/[\s\t ]+$/, '');
    return { cleanText, mapUrl };
};

export const removeAllSpaces = (str: string): string => {
    if (!str) return '';
    return str.replace(/[ \u3000]+/g, '');
};

export const styles = {
    label: { color: '#303030', fontSize: '11px', marginBottom: '4px', letterSpacing: '.6px', fontWeight: '500', display: 'block' },
    input: { border: '1px solid #D3D3D3', borderRadius: '4px', height: '35px', width: '100%', paddingLeft: '10px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box' as const },
    textarea: { border: '1px solid #D3D3D3', borderRadius: '4px', width: '100%', padding: '10px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box' as const },
    // ボタン(キャンセル等)
    buttonSecondary: { color: '#495057', backgroundColor: '#f8f9fa', border: '1px solid #d2d6da', borderRadius: '6px', padding: '0 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.6px', height: '35px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content' },
    // ボタン(保存等 - ベースは同じで色だけ落ち着いたブルーグレーに変更)
    buttonPrimary: { color: '#ffffff', backgroundColor: '#5e72e4', border: '1px solid #5e72e4', borderRadius: '6px', padding: '0 24px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.6px', height: '35px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content' },
    // サジェストリストの枠
    suggestList: { zIndex: 9999, maxHeight: '250px', overflowY: 'auto' as const, top: 'calc(100% + 2px)', left: 0, backgroundColor: '#fff', border: '1px solid #D3D3D3', borderRadius: '4px', padding: 0, margin: 0, listStyle: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%', position: 'absolute' as const },
    // サジェストリストの各アイテム
    suggestItem: { cursor: 'pointer', fontSize: '12px', minHeight: '36px', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', color: '#303030', letterSpacing: '.6px', display: 'flex', alignItems: 'center' }
};

export const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', backgroundColor: '#f8f9fa', whiteSpace: 'nowrap' };

export const getReinsStatus = (reinsDate?: string | null, baikaiType?: string | null) => {
    if (reinsDate) {
        return { label: '登録済み', color: 'bg-success' }; // 緑色のバッジ
    }

    if (!reinsDate && (baikaiType === '専任媒介' || baikaiType === '専属専任媒介')) {
        return { label: '要登録', color: 'bg-danger' }; // 赤色のバッジ
    }

    return { label: '未登録', color: 'bg-secondary' }; // グレーのバッジ
};

export const getPropertyStatus = (status?: string) => {
    if (status === 'アクティブ') {
        return { label: 'アクティブ', color: 'bg-light text-secondary' }
    }
    if (status === '媒介終了') {
        return { label: '媒介終了', color: 'bg-dark text-light' }
    }
    if (status === '成約完了') {
        return { label: '成約完了', color: 'bg-primary text-white' }
    }
    if (!status) {
        return { label: '未設定', color: '' }
    }
    return { label: '未設定', color: 'bg-light text-secondary' };
};


// ⚠️ v2.2.249: 満了日・残り日数・更新状態の計算（getContractExpirationDate・getRemainingDays・getContractStatusInfo）は
//   realty/common/deadlines.ts へ移した（連動トリガー仕様書 ②。満了日は expiry を使い、14日前から警告）

export const kataToHira = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/[\u30a1-\u30f6]/g, (match) => {
        const chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
};

export const safeParse = (data: any) => {
    if (typeof data !== 'string' || data.trim() === '') return data ?? [];
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("JSONの解析に失敗しました。不正なデータです:", data);
        return [];
    }
};

export const hotleadStyle = (status: string | null) => {
  if (!status) return;

  const base = {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'inline-block',
    whiteSpace: 'nowrap',
    border: '1px solid',
    lineHeight: 1.2,
  };

  switch (status) {
    case '対応中':
      return { ...base, color: '#0369a1', backgroundColor: '#e0f2fe', borderColor: '#bae6fd' };
    case '架電停止':
      return { ...base, color: '#475569', backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' };
    case 'アポ予約済み':
      return { ...base, color: '#15803d', backgroundColor: '#dcfce7', borderColor: '#86efac' };
    default:
      return { ...base, color: '#4b5563', backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' };
  }
};
/**
 * 店舗を選んだときに出す担当営業の選択肢。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **同姓の担当者が増えたため**に入れた機能である（2026-09-14 の指示）。
 *   既存の担当者名のテキスト検索（staffSearch）とは**別物**で、あちらは
 *   部分一致なので「田中」で複数の田中が引っかかる。こちらは1人を選ぶ。
 *
 * ⚠️ 絞り込みの条件は3つすべて（指示）。
 *     period   … 年度。⚠️ **暦年ではない**。utils/thisYear.ts を使うこと。
 *                 ⚠️⚠️ 2026-09-13 に、暦年で比べていたために
 *                   候補が0件になる不具合があった（useAmbassadorMaster.ts）。
 *                   `getFullYear()` で代用しないこと。
 *     category … 1。⚠️ サーバーは `rank = 1` でしか絞っておらず、
 *                 実測（2026-09-14 / period = '2027'）で
 *                 rank=1 かつ category=0 が6件あった。ここで落とす必要がある。
 *     shop     … 選択中の店舗。
 *
 * ⚠️ 並び順は役職（utils/positions.ts）→ 社員番号。
 *   ⚠️ `sortStaff()` を header/useAmbassadorMaster.ts から借りている。
 *     同じ並びを2箇所に書くと、片方だけ直されて画面ごとに順序が変わる。
 * ─────────────────────────────────────────────
 */
export const staffOptionsOf = <T extends { name: string; shop: string; period: string; category: number | string; position: string; khg_id: string }>(
  staffList: T[],
  shop: string,
  year: number | string,
  sorter: (rows: T[]) => T[]
): T[] => {
  if (!shop) return [];
  const matched = (staffList ?? []).filter(s =>
    String(s.period ?? '') === String(year) &&
    Number(s.category) === 1 &&
    (s.shop ?? '') === shop
  );
  // ⚠️ 同姓ではなく**同一人物**が重複登録されている場合に備えて名前で一意にする。
  //   ⚠️ 同姓「別人」は名字だけでなくフルネームが違うので消えない
  const unique = [...new Map(matched.map(s => [s.name, s])).values()];
  return sorter(unique);
};
