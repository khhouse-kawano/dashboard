// utils/extractNumbers.ts などに配置すると便利です

export const extractNumbers = (value: string | number | null | undefined): string => {
    // 値が空（nullやundefined）の場合は空文字を返す
    if (value === null || value === undefined) return '';

    // 一度文字列に変換してから、数字以外を空文字に置換する
    return String(value).replace(/\D/g, '');
};