import { useState, useEffect } from 'react';

/**
 * 画面幅が指定したブレイクポイント以下（スマホサイズ）かどうかを判定するカスタムフック
 * @param breakpoint SPとみなす最大幅（デフォルトは一般的な768px）
 * @returns スマホサイズなら true, そうでなければ false
 */
export const useIsSp = (breakpoint = 768): boolean => {
    const [isSp, setIsSp] = useState<boolean>(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

        setIsSp(mediaQuery.matches);

        const handleResize = (e: MediaQueryListEvent) => {
            setIsSp(e.matches);
        };

        mediaQuery.addEventListener('change', handleResize);

        return () => {
            mediaQuery.removeEventListener('change', handleResize);
        };
    }, [breakpoint]);

    return isSp;
};