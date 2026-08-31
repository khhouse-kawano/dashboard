import React, { useState, useEffect, memo } from 'react';

type MemoProps = {
    staffName: string;
    staffShop: string;
    initialMemo: string;
    onSave: (text: string, staff: string, shop: string) => void;
};

const StaffMemo = memo(({ staffName, staffShop, initialMemo, onSave }: MemoProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const [text, setText] = useState(initialMemo);

    useEffect(() => {
        setText(initialMemo);
    }, [initialMemo]);

    const handleBlur = () => {
        setIsFocused(false);
        onSave(text, staffName, staffShop);
    };

    return (
        <div
            className="d-inline-block position-relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <i className="fa-regular fa-pen-to-square ps-1" style={{ cursor: 'pointer' }}></i>

            {(isHovered || isFocused) && (
                <div
                    className="position-absolute"
                    style={{ top: '0', right: '-101px', zIndex: '1000' }}
                    onClick={(e) => e.stopPropagation()} // 親のクリックイベント発火防止
                >
                    <textarea
                        style={{ width: '100px' }}
                        value={text}
                        rows={Math.ceil(text.length === 0 ? 2 : text.length / 6)}
                        onChange={(e) => setText(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={handleBlur}
                    />
                </div>
            )}
        </div>
    );
});

export default StaffMemo