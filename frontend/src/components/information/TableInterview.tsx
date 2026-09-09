import React, { memo, useState, useEffect, useContext, useMemo } from 'react';
import TableInput from './TableInput';
import { inputStyle, toHalfWidth, dateFormate, actionButton, safeFormate } from '../../utils/informationUtils';
import AuthContext from '../../context/AuthContext';
import { canClearColumn, deriveKpiColumns, normalizeDay } from '../../utils/interviewKpi';

type InterviewAction = {
    day: string;
    action: string;
    note: string;
    staff: string;
};

type InterviewLog = {
    id: string,
    shop: string,
    name: string,
    interview_log: InterviewAction[],
    add: Boolean
};

type Props = {
    information: Record<string, string>,
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    interviewLog: InterviewLog,
    setInterviewLog: React.Dispatch<React.SetStateAction<InterviewLog>>,
    actionMap: Record<string, string>,
    interview: InterviewAction,
    setInterview: React.Dispatch<React.SetStateAction<InterviewAction>>,
    userName: string
};

const getMigratedAction = (actionStr: string, category: string) => {
    if (!actionStr) return '';
    const baseAction = actionStr.split(',')[0];

    if (baseAction === '物件案内') {
        if (category === 'used') {
            return actionStr;
        } else {
            return '初回面談';
        }
    } else if (baseAction === '事前取得（現金確認含む）' || baseAction === 'ローン事前承認済み') {
        return '2回目以降面談';
    } else if (baseAction === '次回アクション') {
        return '';
    } else {
        return actionStr;
    }
};

/**
 * 旧KPI名を備考の先頭に添えるための接頭辞を返す（表示専用）。
 *
 * ⚠️⚠️ **接頭辞を備考の本文に混ぜてはいけない。**
 *   2026-09-09 まで、この関数が接頭辞付きの文字列を返し、それを
 *   textarea の value にしていた。onChange は e.target.value を
 *   そのまま保存するため、**1文字でも編集すると接頭辞が備考に焼き付いた**
 *   （「物件案内\n」が保存内容の一部になる）。
 *
 *   接頭辞と本文を分けて返し、表示のときだけ連結する。
 *   保存するのは本文のみ。
 *
 * ⚠️ 2026-09-09 に「表示のみに留める」と決定済み。接頭辞そのものは残す
 *   （旧KPIが何だったか画面から分からなくなるため）。
 */
const getNotePrefix = (actionStr: string, noteStr: string, category: string): string => {
    if (!actionStr) return '';
    const base = actionStr.split(',')[0];
    if (base === '') return '';

    const mapped = getMigratedAction(actionStr, category);
    const mappedBase = mapped ? mapped.split(',')[0] : '';

    // 旧KPIが新しいKPIに丸め込まれている場合だけ添える
    if (base === mappedBase) return '';
    // ⚠️ 既に本文に旧KPI名が含まれているなら重ねない
    //   （焼き付いてしまった既存データを二重表示しないため）
    if ((noteStr || '').includes(base)) return '';

    return `${base}\n`;
};

const TableInterview = ({ information, setInformation, interviewLog, setInterviewLog, actionMap, interview, setInterview, userName }: Props) => {
    const { category } = useContext(AuthContext);
    const [interviewSort, setInterviewSort] = useState('asc');

    /**
     * ⚠️⚠️ **KPI日付は「商談ステップからまとめて導出」する。**
     *
     *   2026-09-09 まで、入力欄を触った瞬間に setInformation でその列を
     *   書いていた。そのため入力の順番で結果が変わっていた。
     *
     *     ・アクションを先に選ぶと、その時点の interview.day（空）が
     *       列に入る。⚠️ そのまま「追加」を押さずに離脱すると、
     *       **既存のKPI日付が消えたまま**残っていた
     *     ・`if (key && !information[key])` のため、あとから直しても
     *       既に値があると**無視**されていた
     *     ・同じアクションが2件あるとき1件消すと列が空になっていた
     *     ・対応列が無いアクションの削除で `[undefined]: ''` を書き、
     *       information['undefined'] というキーが生えていた
     *
     *   規則と根拠は utils/interviewKpi.ts に集約している。
     *   ⚠️ backend-express/src/features/interviewKpi.ts と対。片方だけ
     *     変えないこと。
     */
    const derivedKpi = useMemo(
        () => deriveKpiColumns(interviewLog.interview_log ?? [], actionMap),
        [interviewLog.interview_log, actionMap]
    );

    /**
     * 導出結果を information に反映する。
     *
     * ⚠️⚠️ **導出できた列だけを上書きする。導出できない列は触らない。**
     *   interview_log に根拠の無いKPI日付が本番相当データで1,944セル
     *   （うち契約日1,147件）あり、消すと取り返せない。
     *   詳細は utils/interviewKpi.ts のコメント。
     *
     * ⚠️ 値が変わる列が無いときは setInformation を呼ばない。
     *   毎回呼ぶと information の参照が変わり、再描画が止まらなくなる。
     */
    useEffect(() => {
        const changes: Record<string, string> = {};
        derivedKpi.forEach((day, column) => {
            if (normalizeDay(information[column]) !== day) changes[column] = day;
        });

        if (Object.keys(changes).length === 0) return;
        setInformation(prev => ({ ...prev, ...changes }));
    }, [derivedKpi, information, setInformation]);


    const stars = ['売買契約', '媒介取得', 'リフォーム契約'];

    const [localValue, setLocalValue] = useState(information.contraction_contract_price ?? '');
    useEffect(() => {
        setLocalValue(information.contraction_contract_price ?? '');
    }, [information.contraction_contract_price]);

    const [localDetailValue, setLocalDetailValue] = useState(information.additional_contraction_contract_price ?? '');
    useEffect(() => {
        setLocalDetailValue(information.additional_contraction_contract_price ?? '');
    }, [information.additional_contraction_contract_price]);

    const registerAction = () => (
        <>
            {interviewSort === 'desc' && actionIcon()}
            <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                <div>
                    <TableInput information={information} setInformation={setInformation} itemKey='step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99'
                        type='date' />
                </div>
                <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                    <select style={inputStyle} disabled>
                        <option value="反響取得">反響取得</option>
                    </select>
                </div>
                <div className="ms-2">
                    {information.sales_promotion_name}からの反響取得</div>
                {information.reserved_interview && <div className="ms-3 d-flex align-items-center">
                    <div>来場予約日</div>
                    <div>
                        <TableInput information={information} setInformation={setInformation} itemKey='reserved_interview'
                            type='date' />
                    </div>
                </div>}
            </div>
            {interviewSort === 'asc' && actionIcon()}
        </>
    );

    const newAction = () => (
        <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
            <div>
                <input type="date" style={inputStyle} value={dateFormate(interview.day)}
                    onChange={(e) => setInterview(prev => ({
                        ...prev,
                        day: e.target.value
                    }))} />
            </div>
            <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                <select style={{
                    ...inputStyle,
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                }}
                    title={interview.action || "アクション内容"}
                    onChange={(e) => {
                        const formattedValue = e.target.value.split(',')[0] ?? e.target.value;
                        setInterview(prev => ({
                            ...prev,
                            action: e.target.value,
                            note: e.target.value.includes('契約') ? '契約' : prev.note
                        }));
                        // ⚠️⚠️ **ここで setInformation してはいけない。**
                        //   以前は `[actionMap[action]]: interview.day` を代入していたが、
                        //   アクションを先に選ぶと interview.day はまだ空で、
                        //   **既存のKPI日付を空で上書き**していた。
                        //   「追加」を押さずに離脱すると空のまま残る。
                        //   KPI日付は商談ステップの配列から導出する（derivedKpi）。

                        if (formattedValue === '自社契約' || formattedValue === '仲介契約') {
                            const property = e.target.value.split(',')[1];
                            setInformation(prev => ({
                                ...prev,
                                property_contract_name: property
                            }));
                        }
                    }}>
                    <option value="">アクション内容</option>
                    {Object.keys(actionMap).map(item => {
                        if ((item === '自社契約' || item === '仲介契約') && information.property_name) {
                            return information.property_name.split(',').map((property, pIndex) =>
                                <option value={`${item},${property}`} key={pIndex}>{item}({property})</option>)
                        }
                        return <option value={item} key={item}>{(stars.includes(item) && category === 'used') && '★'}{item}</option>
                    }
                    )}
                </select>
            </div>
            <div>
                <textarea value={interview.note} style={{ ...inputStyle, width: '550px', height: 'auto' }} placeholder='面談内容を記載'
                    onChange={(e) => setInterview(prev => ({
                        ...prev,
                        note: e.target.value
                    }))} ></textarea></div>
            <div className="text-primary" style={actionButton}
                onClick={() => {
                    if (!interview.day || !interview.action) {
                        alert('未入力の項目があります');
                        return;
                    };
                    setInterviewLog(prev => ({
                        ...prev,
                        id: information.id,
                        name: information.customer_contacts_name,
                        status: information.call_status,
                        interview_log: [
                            ...prev.interview_log,
                            { day: interview.day, action: interview.action, note: interview.note, staff: userName }
                        ],
                        add: true
                    }));
                    // ⚠️⚠️ ここにあった
                    //     if (key && !information[key]) setInformation(...)
                    //   を撤去した。`!information[key]` のため
                    //   **既に日付が入っていると新しい日付が無視されていた**
                    //   （「あとから修正しても保存されない」の原因）。
                    //   KPI日付は derivedKpi が useEffect で反映する。

                    setInterview({
                        day: '', action: '', note: '', staff: ''
                    });
                }
                }>追加</div>
        </div>
    )

    /**
     * 表示用に日付順で並べる。
     *
     * ⚠️⚠️ **元の index を持たせる。**
     *   2026-09-09 まで `interviewLog.interview_log.sort(...)` と書いており、
     *   2つの問題があった。
     *
     *   (1) Array.prototype.sort は**破壊的**。state の配列を直接並べ替えて
     *       いたため、React が変更を検知できず（参照が同じ）
     *       memo の比較 `prevProps.interviewLog !== nextProps.interviewLog`
     *       もすり抜けた。
     *   (2) 並べ替え後の index で `prev.interview_log` を更新していた。
     *       ⚠️ その場では「たまたま」一致していた（同じ配列を並べ替えていた
     *         ため）が、コピーに変えた途端に**別の行を書き換える**バグになる。
     *       元の index を持ち回れば、どちらの並び順でも正しい行を更新できる。
     *
     * ⚠️ Date に変換しない。'YYYY-MM-DD' は文字列比較で日付順になる。
     *   new Date('2026/08/16') と new Date('2026-08-16') は
     *   タイムゾーンの扱いが違い、1日ずれることがある。
     */
    const orderedLogs = useMemo(() => {
        const list = (interviewLog.interview_log ?? []).map((item, index) => ({ item, index }));
        return list.sort((a, b) => {
            const da = normalizeDay(a.item.day);
            const db = normalizeDay(b.item.day);
            // ⚠️ 同じ日付なら登録順を保つ（並びを安定させる）
            if (da === db) return a.index - b.index;
            return interviewSort === 'asc' ? (da < db ? -1 : 1) : (da < db ? 1 : -1);
        });
    }, [interviewLog.interview_log, interviewSort]);

    const actionIcon = () => (
        <div style={{ color: '#868686ff', marginBottom: '7px' }}>
            {interviewSort === 'desc' && <div style={{ textAlign: 'center', margin: '2px 0' }}>
                <i className="fa-solid fa-arrow-up"></i>
            </div>}
            <div style={{ textAlign: 'center' }}>
                <i className="fa-solid fa-file-pen"></i>
            </div>
            {interviewSort === 'asc' && <div style={{ textAlign: 'center', margin: '2px 0' }}>
                <i className="fa-solid fa-arrow-down"></i>
            </div>}
        </div>
    );

    return (
        <>
            <div
                className="text-primary text-center mb-3"
                style={{ ...actionButton, width: '75px', cursor: 'pointer' }}
                onClick={() => setInterviewSort(interviewSort === 'asc' ? 'desc' : 'asc')}
            >
                <i
                    className={`fas ${interviewSort === 'asc' ? 'fa-arrow-down' : 'fa-arrow-up'}`}
                    style={{ marginRight: '5px' }}
                ></i>
                {interviewSort === 'asc' ? '古い順' : '新しい順'}
            </div>
            {interviewSort === 'desc' && newAction()}
            {interviewSort === 'asc' && registerAction()}
            {orderedLogs
                    .map(({ item, index }) => {
                        // ⚠️ 接頭辞は表示専用。保存するのは item.note のみ（getNotePrefix 参照）
                        const notePrefix = getNotePrefix(item.action, item.note, category);
                        const displayNote = notePrefix + (item.note || '');

                        return (
                            <React.Fragment key={index}>
                                {interviewSort === 'desc' && actionIcon()}
                                <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                    <div>
                                        <input type="date" value={dateFormate(item.day)} style={inputStyle}
                                            onChange={(e) => {
                                                setInterviewLog(prev => ({
                                                    ...prev,
                                                    add: true,
                                                    interview_log: prev.interview_log.map((log, i) => i === index ?
                                                        { ...log, day: e.target.value } : log)
                                                }));
                                                // ⚠️ setInformation はしない。derivedKpi が最古を選んで反映する。
                                                //   ここで直接書くと、同じアクションが2件あるとき
                                                //   触った側の日付で上書きされてしまう
                                            }} />
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                        <div>
                                            <select style={{
                                                ...inputStyle,
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden'
                                            }}
                                                title={item.action || "アクション内容"}
                                                onChange={(e) => {
                                                    const newActionValue = e.target.value;

                                                    const mappedOldAction = getMigratedAction(item.action, category);
                                                    const oldFormattedValue = mappedOldAction.split(',')[0] ?? mappedOldAction;
                                                    const oldKey = actionMap[oldFormattedValue];

                                                    const newFormattedValue = newActionValue.split(',')[0] ?? newActionValue;
                                                    const newKey = actionMap[newFormattedValue];

                                                    setInterviewLog(prev => ({
                                                        ...prev,
                                                        add: true,
                                                        interview_log: prev.interview_log.map((log, i) => i === index ?
                                                            { ...log, action: newActionValue } : log)
                                                    }));

                                                    // ⚠️⚠️ 以前はここで oldKey を '' にし、
                                                    //   newKey に item.day を入れていた。
                                                    //   ⚠️ oldKey を無条件に空にすると、同じアクションが
                                                    //     別の行にも残っている場合にKPI日付が消えた。
                                                    //   新しい列は derivedKpi が入れる。
                                                    //   ⚠️ 旧列は「その日付が今の値と一致し、他に根拠が無い」
                                                    //     ときだけ空にする（canClearColumn）。
                                                    const afterChange = interviewLog.interview_log.map((log, i) =>
                                                        i === index ? { ...log, action: newActionValue } : log);
                                                    if (canClearColumn(oldKey, item.day,
                                                        deriveKpiColumns(afterChange, actionMap), information[oldKey])) {
                                                        setInformation(prev => ({ ...prev, [oldKey]: '' }));
                                                    }

                                                    if (newFormattedValue === '自社契約' || newFormattedValue === '仲介契約') {
                                                        const property = newActionValue.split(',')[1];
                                                        setInformation(prev => ({
                                                            ...prev,
                                                            property_contract_name: property
                                                        }));
                                                    }
                                                }}
                                                value={getMigratedAction(item.action, category)}>
                                                <option value="">アクション内容</option>
                                                {Object.keys(actionMap).map(actionItem => {
                                                    if ((actionItem === '自社契約' || actionItem === '仲介契約') && information.property_name) {
                                                        return information.property_name.split(',').map((property, pIndex) =>
                                                            <option value={`${actionItem},${property}`} key={pIndex}>{actionItem}({property})</option>)
                                                    }
                                                    return <option value={actionItem} key={actionItem}>{(stars.includes(actionItem) && category === 'used') && '★'}{actionItem}</option>
                                                }
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <textarea style={{ ...inputStyle, width: '550px', height: 'auto' }} placeholder='面談内容を記載'
                                            value={displayNote}
                                            rows={Math.max(2, displayNote.split('\n').length, Math.ceil(displayNote.length / 50))}
                                            onChange={(e) => {
                                                // ⚠️⚠️ 表示用の接頭辞を**外してから**保存する。
                                                //   付けたまま保存すると備考に焼き付く（getNotePrefix 参照）
                                                const raw = e.target.value;
                                                const note = notePrefix !== '' && raw.startsWith(notePrefix)
                                                    ? raw.slice(notePrefix.length)
                                                    : raw;
                                                setInterviewLog(prev => ({
                                                    ...prev,
                                                    add: true,
                                                    interview_log: prev.interview_log.map((log, i) => i === index ?
                                                        { ...log, note } : log)
                                                }));
                                            }}></textarea>
                                    </div>
                                    <div className="text-danger" style={actionButton}
                                        onClick={() => {
                                            const mappedAction = getMigratedAction(item.action, category);
                                            const formattedValue = mappedAction.split(',')[0] ?? mappedAction;
                                            const key = actionMap[formattedValue];

                                            const rest = interviewLog.interview_log.filter((_, i) => i !== index);

                                            // ⚠️⚠️ 以前は無条件に `[key]: ''` としていた。
                                            //   ⚠️ key が undefined でも実行され information['undefined'] が生えた
                                            //   ⚠️ 同じアクションが別の行に残っていてもKPI日付を消していた
                                            //   ⚠️ ポータル同期や直接入力で入った日付まで消していた
                                            //   条件を満たすときだけ空にする（utils/interviewKpi.ts 参照）
                                            if (canClearColumn(key, item.day,
                                                deriveKpiColumns(rest, actionMap), information[key])) {
                                                setInformation(prev => ({ ...prev, [key]: '' }));
                                            }

                                            setInterviewLog(prev => ({
                                                ...prev,
                                                add: true,
                                                interview_log: prev.interview_log.filter((_, i) => i !== index)
                                            }));
                                        }}>削除</div>
                                </div>
                                {interviewSort === 'asc' && actionIcon()}
                            </React.Fragment>
                        );
                    })}
            {interviewSort === 'asc' && newAction()}
            {interviewSort === 'desc' && registerAction()}
            {category === 'used' && <div className="d-flex align-items-center mt-4" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                <div className='me-2'>
                    契約内容
                </div>
                <div className='me-2'>
                    <input
                        type="text"
                        inputMode="numeric"
                        style={inputStyle}
                        placeholder='予算額'
                        value={localValue}
                        onChange={(e) => {
                            setLocalValue(e.target.value);
                        }}
                        onBlur={() => {
                            let finalValue = localValue;
                            const halfValue = toHalfWidth(finalValue);
                            finalValue = halfValue.replace(/[^0-9-.,]/g, '');

                            setLocalValue(finalValue);
                            setInformation(prev => ({
                                ...prev,
                                contraction_contract_price: finalValue
                            }));
                        }}
                    />万円
                </div>
                <div>
                    <textarea
                        style={{ ...inputStyle, width: '550px', height: 'auto' }}
                        placeholder='予算詳細'
                        value={localDetailValue}
                        onChange={(e) => {
                            setLocalDetailValue(e.target.value);
                        }}
                        onBlur={() => {
                            setInformation(prev => ({
                                ...prev,
                                additional_contraction_contract_price: localDetailValue
                            }));
                        }}
                    ></textarea>
                </div>
            </div>}
        </>
    )
}

export default memo(TableInterview, (prevProps, nextProps) => {
    if (prevProps.interview !== nextProps.interview) return false;
    if (prevProps.interviewLog !== nextProps.interviewLog) return false;

    const fieldsToCheck = [
        'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99',
        'sales_promotion_name',
        'reserved_interview',
        'property_name',
        'property_tour_name',
        'id',
        'customer_contacts_name',
        'call_status',
        'contraction_contract_price',
        'additional_contraction_contract_price'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    return true;
});