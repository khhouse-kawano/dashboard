import React, { memo, useContext } from 'react';
import { safeFormate } from '../../utils/informationUtils';
import { inputStyle } from '../../utils/informationUtils';
import { dateFormate } from '../../utils/informationUtils';
import { UNKNOWN_COMPETITOR, requiredStyle } from '../../utils/informationUtils';
import {
    COUNTERMEASURE_KEY, LOSE_REASON_KEY, LOST_REASON_KEY, LOST_REASON_OPTIONS,
    LOST_TO_COMPETITOR, PRICE_GAP_KEY, PRICE_GAP_UNIT, RIVAL_CAMPAIGN_KEY,
    SALES_PERSON_KEY, WIN_REASON_KEY, isBlank, lostFieldLabel,
} from '../../utils/informationUtils';
import AuthContext from '../../context/AuthContext';
import TableInput from './TableInput';

type Maker = {
    label: string,
    letter: string
};

type Props = {
    information: Record<string, string>
    setInformation: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    idMapping: (text: string) => string,
    setShowLostReason: React.Dispatch<React.SetStateAction<boolean>>,
    competitorsRef: React.RefObject<HTMLInputElement | null>,
    competitorsInput: string,
    handleCompetitorsDelete: () => void,
    handleCompetitors: (maker?: string) => void,
    setCompetitorsInput: React.Dispatch<React.SetStateAction<string>>,
    makerList: Maker[]
}

const TableStatus = ({ information, setInformation, idMapping, setShowLostReason, competitorsRef, competitorsInput, handleCompetitorsDelete, handleCompetitors, setCompetitorsInput, makerList }: Props) => {
    const { category, authority } = useContext(AuthContext);

    /**
     * 「失注先不明」のボタン。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **失注先が分からないときも、必ず何か入れてもらうためのもの。**
     *   ⚠️ 空文字や `null` のままだと「要回答」に数えられ続け、
     *     ⚠️ **答えようがないのに件数が減らない**（DatabaseOrder の loseLength）。
     *   ⚠️ `不明` を入れれば判定から外れる。
     *     判定は `!competitor_name || competitor_name === 'null'` なので、
     *     ⚠️ **空文字や 'null' 以外なら何でもよい**が、
     *       ⚠️ 既存データに `不明` が62件あるので**それに揃える**。
     *       ⚠️ 別の表記（「わからない」等）を足すと集計で分かれてしまう。
     *
     * ⚠️ 同じ判定が次の3か所にある。**片方だけ直さないこと。**
     *     frontend/src/components/database/DatabaseOrder.tsx
     *     frontend/src/components/LostStatusList.tsx
     *     backend-express/src/features/menu.ts
     *
     * ⚠️ 候補（competitors_text）がある画面と、入力欄がある画面の
     *   **両方に出す**。⚠️ 片方だけだと、候補があるお客様で選べない。
     * ─────────────────────────────────────────────
     */
    const isUnknown = information.competitor_name === UNKNOWN_COMPETITOR;

    const unknownButton = (
        <div
            key="__unknown__"
            className={`me-2 mb-1 px-2 py-1 rounded border text-nowrap ${isUnknown ? 'bg-warning border-warning fw-bold text-dark' : 'bg-white text-muted'}`}
            style={{ cursor: 'pointer', transition: 'all 0.2s', fontSize: '11px' }}
            title="失注先が分からない場合に選んでください"
            onClick={() => setInformation(prev => ({
                ...prev,
                // ⚠️ もう一度押したら解除する。誤って押しても戻せるように
                competitor_name: isUnknown ? '' : UNKNOWN_COMPETITOR
            }))}
        >
            失注先不明
        </div>
    );

    /**
     * ⚠️⚠️ **勝因・敗因の入力欄は注文事業にしか出さない**（2026-09-17）。
     *   ⚠️ このコンポーネントは **3事業で共有**している
     *     （InformationEdit / InformationEditKaeru / InformationEditResale）。
     *   ⚠️ 新しい5列は **master_data にしか無い。**
     *     ⚠️ 列の許可リスト（allowed_columns.php）は**3テーブル共通**なので、
     *       建売・中古から送ると `Unknown column` で**保存がまるごと失敗する。**
     *   ⚠️ 広げるときは **先に各テーブルへ SQL を流すこと**
     *     （backend/scripts/sql/2026-09-17_master_data_win_lose.sql）。
     */
    const isOrder = category === 'order';

    /**
     * 競合他社を選ぶUI。
     *
     * ⚠️⚠️ **失注先の選択と、契約済みの「競合を選択」で同じものを使う**（指示）。
     *   ⚠️ 入れる列も同じ `competitor_name` である。
     *   ⚠️ **複製しないこと。** 候補の有無で分岐する処理がここにしかない。
     */
    const competitorPicker = (label: string) => (
        <div className="d-flex flex-wrap align-items-center mb-3 p-2 bg-white rounded border" style={{ fontSize: '12px' }}>
            <span className="fw-bold me-3 text-secondary">{label}{information.competitor_name ? ':' : 'を選択'}</span>
            {information.competitors_text ? (
                information.competitors_text.split(',')
                    .filter(c => c !== 'null' && c.trim() !== '')
                    .map((c, cIndex) => (
                        <div className={`me-2 mb-1 px-2 py-1 rounded border ${information.competitor_name === c ? 'bg-warning border-warning fw-bold text-dark' : 'bg-light text-secondary'}`}
                            key={cIndex}
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            onClick={() => setInformation(prev => ({
                                ...prev,
                                competitor_name: c === information.competitor_name ? '' : c
                            }))}>
                            {c}
                        </div>
                    ))
                    // ⚠️ 候補があるときも「不明」を選べるようにする（下の unknownButton と同じもの）
                    .concat([unknownButton])
            ) : (
                <div className="d-flex align-items-center flex-grow-1 mt-1 mt-md-0">
                    <div className="position-relative flex-grow-1 me-2">
                        <input
                            type='text'
                            className="form-control form-control-sm border-0 shadow-none px-1"
                            style={{ backgroundColor: 'transparent', fontSize: '12px' }}
                            placeholder={!information.competitors_text ? '競合他社名を入力...' : ''}
                            ref={competitorsRef} // 👈 Backspaceの判定などで使うため残しておいてOKです

                            value={competitorsInput || ''} // 🌟 👈 ココを追加！！（ReactのStateと同期させる）

                            onKeyDown={(e) => {
                                // 入力欄が空の状態でBackspaceを押した時の処理
                                if (e.key === 'Backspace' && !competitorsInput) {
                                    handleCompetitorsDelete();
                                }
                                if (e.key === 'Enter') {
                                    e.preventDefault(); // Enterキーでの意図しない画面リロードを防止
                                    handleCompetitors();
                                }
                            }}
                            onChange={(e) => setCompetitorsInput(e.target.value)}
                        />

                        {competitorsInput && (
                            <div className="position-absolute bg-white border rounded shadow-sm w-100 py-1"
                                style={{ top: '100%', left: 0, marginTop: '2px', zIndex: 1000, maxHeight: '150px', overflowY: 'auto' }}>
                                {makerList.map((m, mIndex) => (
                                    <div key={mIndex}
                                        className="px-2 py-1 text-dark"
                                        style={{ cursor: 'pointer', fontSize: '12px' }}
                                        onMouseEnter={(e) => e.currentTarget.classList.add('bg-light')}
                                        onMouseLeave={(e) => e.currentTarget.classList.remove('bg-light')}
                                        onClick={() => {
                                            handleCompetitors(m.label);
                                            setInformation(prev => ({
                                                ...prev,
                                                competitor_name: m.label
                                            }));
                                        }}
                                    >
                                        {m.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ⚠️ 指示どおり「追加」の左隣に置く */}
                    {unknownButton}

                    <button
                        className="btn btn-primary btn-sm text-nowrap shadow-sm px-3"
                        onClick={() => handleCompetitors()}
                    >
                        追加
                    </button>
                </div>
            )}
        </div>
    );

    /**
     * 自由記述の1項目。
     *
     * ⚠️ 必須のものは**未入力のあいだ赤い印を出す。** 保存時に弾かれる理由が
     *   その場で分かるようにするため（判定は informationUtils の
     *   `statusRequiredError()`。⚠️ **ラベルを変えたら向こうも直すこと**）。
     * ⚠️ 価格差は `type='number'` だが、⚠️ **列は TEXT** である（既存の金額系に合わせた）。
     */
    const freeField = (
        itemKey: string,
        required: boolean,
        type: 'text' | 'number' | 'textarea',
        placeholder = '',
        /** 欄の右に出す単位。⚠️ **空なら出さない**（textarea では使わない） */
        unit = ''
    ) => {
        /**
         * ⚠️⚠️ **見出しは `LOST_FIELDS` / `WIN_FIELDS` の label を引く。**
         *   ⚠️ ここに文字列を手書きすると、
         *     ⚠️ **一覧の「〇〇未入力」・保存時の警告と名前が食い違う。**
         */
        const label = lostFieldLabel(itemKey);
        const value = safeFormate(information[itemKey]);
        // ⚠️ 判定は informationUtils と同じものを使う（'null' も空として扱う）
        const empty = isBlank(value);
        const change = (v: string) => setInformation(prev => ({ ...prev, [itemKey]: v }));

        return (
            <div className="mb-3">
                <div className="fw-bold mb-1 text-secondary" style={{ fontSize: '12px' }}>
                    {label}
                    {required
                        ? <span style={requiredStyle}>必須</span>
                        : <span className="ms-2 text-muted" style={{ fontSize: '10px' }}>任意</span>}
                    {/* ⚠️ 未入力のうちだけ出す。埋まっていれば消える */}
                    {required && empty && <i className="fa-solid fa-triangle-exclamation text-danger ms-2"></i>}
                </div>
                {type === 'textarea' ? (
                    <textarea
                        placeholder={placeholder}
                        style={{ fontSize: '12px', borderRadius: '5px', border: '1px solid #cfcfcf', width: '100%', height: '60px', padding: '8px', resize: 'none' }}
                        value={value}
                        onChange={(e) => change(e.target.value)}
                    ></textarea>
                ) : (
                    <div className="d-flex align-items-center gap-2">
                        <input
                            type={type}
                            placeholder={placeholder}
                            className="form-control form-control-sm"
                            style={{ fontSize: '12px', maxWidth: type === 'number' ? '200px' : '100%' }}
                            value={value}
                            onChange={(e) => change(e.target.value)}
                        />
                        {/**
                          * ⚠️⚠️ **単位は欄の横に出す。プレースホルダに書かない**（2026-09-17 の指示）。
                          *   ⚠️ プレースホルダは**入力すると消える**ため、
                          *     ⚠️ **あとから見た人に単位が分からない。**
                          *   ⚠️⚠️ **入力値はそのまま保存される（変換しない）。**
                          *     ⚠️ 単位の表示を変えるときは、**既存データの意味も変わる**ことに注意。
                          */}
                        {unit !== '' && (
                            <span className="text-secondary text-nowrap" style={{ fontSize: '12px' }}>{unit}</span>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {/* 1. ステータス選択エリア */}
            <div className="d-flex align-items-center mb-2">
                <select style={inputStyle} value={safeFormate(information[idMapping('ステータス')])}
                    onChange={(e) => {
                        setInformation(prev => (
                            {
                                ...prev,
                                [idMapping('ステータス')]: e.target.value
                            }
                        ));
                        if (e.target.value === '失注') setShowLostReason(true);
                    }}>
                    {category === 'spec' ?
                        <>
                            <option value="追客中">追客中</option>
                            <option value="接触（通話・返信）">接触（通話・返信）</option>
                            <option value="アポイント確定">アポイント確定</option>
                            <option value="来店あり">来店あり</option>
                            <option value="申込み済み">申込み済み</option>
                            <option value="事前取得（現金確認含む）">事前取得（現金確認含む）</option>
                            <option value="契約済み">契約済み</option>
                            <option value="追客終了">追客終了</option>
                            <option value="解約">解約</option>
                        </> : <>
                            <option value='見込み'>見込み</option>
                            <option value='会社管理'>会社管理</option>
                            <option value='失注'>失注</option>
                            <option value='重複'>重複</option>
                            <option value='契約済み'>{category === 'used' && '★'}契約済み</option>
                            <option value="解約">解約</option></>}
                </select>
            </div>

            {/**
              * ⚠️⚠️ **契約済みのときの「勝因の入力」**（2026-09-17 の指示）。
              *   ⚠️ 失注のときと同じように**理由を記入させる**のが目的である。
              *   ⚠️ **注文事業だけ**に出す（`isOrder` のコメント参照）。
              */}
            {isOrder && information[idMapping('ステータス')] === '契約済み' && (
                <div className="bg-light p-3 rounded border mt-2">

                    <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                        <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>
                            勝因の入力
                            {!safeFormate(information[WIN_REASON_KEY]).trim() && <i className="fa-solid fa-triangle-exclamation text-danger ms-2"></i>}
                        </div>
                    </div>

                    {/* ⚠️ 単位は欄の横に出す。⚠️ **入力値はそのまま保存される** */}
                    {freeField(PRICE_GAP_KEY, false, 'number', '他社との差額', PRICE_GAP_UNIT)}
                    {freeField(WIN_REASON_KEY, true, 'textarea', '選ばれた理由を具体的に入力してください')}

                    {/* ⚠️ 失注先の選択と同じUI・同じ列（competitor_name） */}
                    {competitorPicker('競合')}

                    {freeField(SALES_PERSON_KEY, false, 'text', '競合の営業担当者名')}
                </div>
            )}

            {information[idMapping('ステータス')] === '失注' && (
                <div className="bg-light p-3 rounded border mt-2">

                    <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                        {/* ⚠️ 2026-09-17 に見出しを分けた。⚠️ 「失注情報の入力」は
                               **競合負けのときだけ**出すため（指示） */}
                        <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>失注理由の入力{isBlank(information[LOST_REASON_KEY]) && <i className="fa-solid fa-triangle-exclamation text-danger ms-2"></i>}</div>
                    </div>

                    <div className="mb-3 d-flex align-items-center">
                        <span className="me-3 fw-bold text-secondary" style={{ fontSize: '12px' }}>失注理由:</span>
                        <select style={{ ...inputStyle, fontSize: '12px', width: '240px' }} value={safeFormate(information[LOST_REASON_KEY])}
                            onChange={(e) => {
                                setInformation(prev => ({ ...prev, [LOST_REASON_KEY]: e.target.value }));
                            }}>
                            <option value="">選択してください</option>
                            {/* ⚠️ 選択肢は informationUtils と共有する。⚠️ **ここに書き足さないこと** */}
                            {LOST_REASON_OPTIONS.map(reason => (
                                <option value={reason} key={reason}>{reason}</option>
                            ))}
                        </select>
                    </div>

                    {information[LOST_REASON_KEY] === LOST_TO_COMPETITOR && (
                        <>
                            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                                <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>失注情報の入力</div>
                            </div>

                            {/* ⚠️ 契約済みの「競合を選択」と同じもの。⚠️ **複製しない** */}
                            {competitorPicker('失注先')}
                            <div className="fw-bold mb-2 text-secondary mt-3" style={{ fontSize: '12px' }}>詳細な他決・失注理由（複数選択可）</div>
                            <div className="d-flex flex-wrap gap-2 mb-3">
                                {['価格・予算', '間取り・プラン提案', 'デザイン・外観', '性能', '土地・立地条件（他社物件）', '営業の対応（スピード・相性）', '保証・アフターサポート', '会社のブランド・信頼性', '縁戚・知人の紹介', 'その他'].map(reason => {
                                    const currentReasons = information.customized_input_01JRF9CZSW65A151WR30NA4PB3
                                        ? String(information.customized_input_01JRF9CZSW65A151WR30NA4PB3).split(',')
                                        : [];
                                    const isChecked = currentReasons.includes(reason);

                                    return (
                                        <div key={reason} className="form-check form-check-inline m-0">
                                            <input
                                                className="form-check-input shadow-sm"
                                                type="checkbox"
                                                id={`detail-reason-${reason}`}
                                                checked={isChecked}
                                                onChange={() => {
                                                    let newArray = [...currentReasons];
                                                    if (isChecked) {
                                                        newArray = newArray.filter(r => r !== reason);
                                                    } else {
                                                        newArray.push(reason);
                                                    }
                                                    setInformation(prev => ({
                                                        ...prev,
                                                        customized_input_01JRF9CZSW65A151WR30NA4PB3: newArray.filter(Boolean).join(',')
                                                    }));
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <label
                                                className="form-check-label text-dark"
                                                htmlFor={`detail-reason-${reason}`}
                                                style={{ fontSize: '12px', cursor: 'pointer' }}
                                            >
                                                {reason}
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                            {/**
                              * ⚠️⚠️ **この欄が「敗因」である**（2026-09-17 の指示）。
                              *   ⚠️ 列は増やしていない。既存の
                              *     `customized_input_01JSE7H4MQES619NBWX6PQDFRH` のまま。
                              *     ⚠️ **過去の入力がそのまま敗因として読める。**
                              *   ⚠️ 必須にするのは注文事業だけ。建売・中古では
                              *     ⚠️ **今までどおり任意**（判定を足すと保存できなくなる）。
                              */}
                            {freeField(
                                LOSE_REASON_KEY, isOrder, 'textarea',
                                '負けた理由を具体的に入力してください'
                            )}

                            {/* ⚠️ ここから下は注文事業だけ。⚠️ 列が master_data にしか無い */}
                            {isOrder && (
                                <>
                                    {freeField(SALES_PERSON_KEY, false, 'text', '競合の営業担当者名')}
                                    {/* ⚠️ 単位は契約済み側と必ず同じにする（同じ列に入るため） */}
                                    {freeField(PRICE_GAP_KEY, true, 'number', '他社との差額', PRICE_GAP_UNIT)}
                                    {freeField(COUNTERMEASURE_KEY, true, 'textarea', '次に同じ競合と当たったときの対策')}
                                    {freeField(RIVAL_CAMPAIGN_KEY, false, 'textarea', '他社が実施していた特典・値引きなど')}
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
            {information[idMapping('ステータス')] === '解約' && (
                <div className="d-flex align-items-center">
                    <div className="me-1">解約発生日</div>
                    <TableInput type='date' information={information} setInformation={setInformation}
                        itemKey='competitor_lost_contract_date' formattedValue={dateFormate(information.competitor_lost_contract_date)} />
                </div>
            )}
        </>
    )
}

export default memo(TableStatus, (prevProps, nextProps) => {
    const statusKey = prevProps.idMapping('ステータス');

    /**
     * ⚠️⚠️ **ここに書き忘れた列は、入力しても画面が描き直されない。**
     *   ⚠️ 値は state に入るので**保存はされる**が、
     *     ⚠️ **打った文字が出てこない**という分かりにくい壊れ方をする。
     *   ⚠️ 入力欄を増やしたら**必ずここにも足すこと。**
     */
    const fieldsToCheck = [
        statusKey,
        'competitor_lost_contract_reason',
        'competitor_lost_contract_date',
        'competitors_text',
        'competitor_name',
        'customized_input_01JRF9CZSW65A151WR30NA4PB3',
        'customized_input_01JSE7H4MQES619NBWX6PQDFRH',
        // ⚠️ 2026-09-17 に追加した5列（勝因・敗因の入力）
        'competitor_win_reason',
        'competitor_price_gap',
        'competitor_sales_person',
        'competitor_countermeasure',
        'competitor_campaign'
    ];

    for (const field of fieldsToCheck) {
        if (prevProps.information[field] !== nextProps.information[field]) {
            return false;
        }
    }

    if (prevProps.competitorsInput !== nextProps.competitorsInput) return false;
    if (prevProps.makerList !== nextProps.makerList) return false;

    return true;
});