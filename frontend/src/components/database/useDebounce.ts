import { useState, useRef, useCallback } from 'react';

export const useDebounce = (initialValue: string = '', delay: number = 200) => {
    const [inputValue, setInputValue] = useState<string>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<string>(initialValue);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            setDebouncedValue(val);
        }, delay);
    }, [delay]);

    return { inputValue, debouncedValue, onChange };
};