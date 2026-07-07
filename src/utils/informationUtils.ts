export const baseStyle = { border: '1px solid #D3D3D3', borderRadius: '4px', height: '35px', width: '150px', paddingLeft: '10px', color: '#303030' };
export const labelStyle = { color: '#303030', fontSize: '11px', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' };
export const buttonStyle = {
    color: '#495057',                  // 入力欄の文字色(#303030)より少しだけ柔らかい色に
    backgroundColor: '#f8f9fa',        // 真っ白ではなく、ごく薄いグレーにして入力欄と区別
    border: '1px solid #d2d6da',       // 枠線も少しだけトーンを変える
    borderRadius: '6px',               // 入力欄(4px)より少しだけ丸くする
    padding: '0 16px',                 // 左右の余白を少し広めに
    fontSize: '11px',
    fontWeight: '600',                 // ほんの少し太字にしてボタンらしさを強調
    letterSpacing: '0.6px',
    marginBottom: '4px',
    cursor: 'pointer',
    height: '35px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', // 影をほんの少しだけ濃くして立体感を出す
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',          // 文字を左右中央に
    width: 'fit-content'
};
export const valueStyle = { fontSize: '12px', letterSpacing: '.6px', verticalAlign: 'middle' };
export const inputStyle = { ...baseStyle, margin: '5px', color: '#303030' };
export const selectStyle = { ...baseStyle };
export const requiredStyle = { border: '1px solid #9b9b9b', borderRadius: '4px', color: '#303030', padding: '3px 5px', marginLeft: '5px' };
export const actionButton = { backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' };
export const safeFormate = (value: string) => {
    return value ?? '';
};
export const toHalfWidth = (str: string) => {
    return str.replace(/[！-～]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    ).replace(/　/g, ' ');
};
export const expandButton = {
    ...buttonStyle,
    height: '28px',
    padding: '2px 10px'
};
export const competitorsStyle = {
    border: 'transparent',
    minWidth: '60px',
    maxWidth: '100%',
    flex: '1',
    outline: 'none',
    boxShadow: 'none'
};

export const dateFormate = (value: string) => {
    return value ? value.replace(/\//g, '-') : '';
};

export const calculateAge = (birthDateString: string) => {
    if (!birthDateString) return "";

    const today = new Date();
    const birthDate = new Date(birthDateString);

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
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
