import { inputStyle, safeFormate, toHalfWidth, dateFormate } from "../../utils/informationUtils";
import { MONEY_SCALE, manYenToStored, storedToManYen } from "../../utils/moneyUtils";
import React, { memo, useState, useEffect } from 'react';

type InputProps = {
    itemKey: string;
    defaultValue?: string;
    widthValue?: string;
    numeric?: boolean;
    information: Record<string, string>;
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    type?: string;
    formattedValue?: string;
    disabled?: boolean;
    /**
     * 万円単位の金額欄として扱う。
     *
     * ⚠️⚠️ **`formattedValue` と併用しないこと。** どちらも表示値を決めるため、
     *   両方渡すと `formattedValue` が勝ってしまい、保存だけが変換される
     *   （表示と保存が非対称になる＝直したかった不具合そのもの）。
     *
     * ⚠️ 対象の項目は utils/moneyUtils.ts の MONEY_SCALE に登録が必要。
     *   未登録の itemKey に付けても何も起きない（変換されない）。
     */
    moneyManYen?: boolean;
};

const TableInput = ({ itemKey, defaultValue, widthValue, numeric, information, setInformation, type, formattedValue, disabled, moneyManYen }: InputProps) => {

    // ⚠️ MONEY_SCALE に無い項目は変換しない。誤って付けても既存の挙動のまま
    const moneyScale = moneyManYen ? MONEY_SCALE[itemKey] : undefined;

    const toDisplay = (): string => {
        if (moneyScale !== undefined) return storedToManYen(information[itemKey], moneyScale);
        if (formattedValue !== undefined) return formattedValue;
        return type === 'date' ? dateFormate(information[itemKey]) : safeFormate(information[itemKey]);
    };

    const [localValue, setLocalValue] = useState(toDisplay);

    useEffect(() => {
        setLocalValue(toDisplay());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [information[itemKey], formattedValue, type, moneyScale]);

    return (
        <input
            type={type ?? 'text'}
            placeholder={defaultValue}
            style={widthValue ? { ...inputStyle, width: widthValue } : inputStyle}
            value={localValue}
            onChange={(e) => {
                setLocalValue(e.target.value);
            }}
            onBlur={(e) => {
                let finalValue = e.target.value;

                if (numeric) {
                    const halfValue = toHalfWidth(finalValue);
                    finalValue = halfValue.replace(/[^0-9-]/g, '');
                    setLocalValue(finalValue);
                }

                // ⚠️ 金額欄は表示（万円）→ 保存形式（万円のプレーン数値）へ変換する。
                //   表示と保存を対称にするのが目的。ここを外すと
                //   「開いて保存するだけで円が万円に変わる」不具合が復活する。
                if (moneyScale !== undefined) {
                    const stored = manYenToStored(finalValue);
                    // 入力欄も正規化後の値に揃える（全角・カンマ・単位を落とした形）
                    setLocalValue(stored);
                    setInformation((prev: any) => ({
                        ...prev,
                        [itemKey]: stored
                    }));
                    return;
                }

                setInformation((prev: any) => ({
                    ...prev,
                    [itemKey]: finalValue
                }));
            }}
            disabled={disabled}
        />
    );
};

export default memo(TableInput, (prevProps, nextProps) => {
    const isValueEqual = prevProps.information[prevProps.itemKey] === nextProps.information[nextProps.itemKey];
    const isFormattedEqual = prevProps.formattedValue === nextProps.formattedValue;
    const isDisabledEqual = prevProps.disabled === nextProps.disabled;
    return isValueEqual && isFormattedEqual && isDisabledEqual;
});