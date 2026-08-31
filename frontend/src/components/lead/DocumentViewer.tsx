import React, { useState, useEffect, useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../../context/AuthContext';
import { getYK, COMPANY } from './documentUtils'; // COMPANYは内部で定義されているため除外
import { safeParse, saveBrokerageRecord, nowDateTime } from './leadUtiles';

// ==========================================
// 💡 1. ユーティリティ・定数
// ==========================================
const formatYen = (num: number | string | null) => {
    if (!num) return '―';
    return `¥${Number(num).toLocaleString()}`;
};

const formatMan = (num: number | string | null) => {
    if (!num) return '―';
    return `${Math.round(Number(num) / 10000).toLocaleString()}万`;
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '―';
    const [y, m, d] = dateStr.slice(0, 10).split('-');
    if (!d) return dateStr;
    return `${y}/${Number(m)}/${Number(d)}`;
};

const addMonths = (dateStr: string, months: number) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
};

const stdFee = (price: number) => {
    if (!price || price <= 0) return 0;
    return price <= 8000000 ? 300000 : Math.round(price * 0.03 + 60000);
};

// ==========================================
// 💡 2. 型定義
// ==========================================
type DocumentFormData = {
    ctype: '専任媒介' | '専属専任媒介' | '一般媒介';
    purpose: '売却' | '購入';
    withPre: boolean;
    withYakkan: boolean;
    docDate: string;
    clientName: string;
    clientAddr: string;
    clientContact: string;
    propAddr: string;
    propName: string;
    propKind: string;
    landArea: string;
    bldgArea: string;
    madori: string;
    builtYear: string;
    rights: string;
    price: string | number;
    priceNote: string;
    startDate: string;
    endDate: string;
    reportFreq: string;
    reinsTerm: string;
    feeText: string;
    feeWhen: string;
    special: string;
    agent: string;
};

// 💡 ユーザーの指定に基づき、オプショナルプロパティを安全に拡張
type initialData = {
    name: string | null;
    baikaiType: '専任媒介' | '専属専任媒介' | '一般媒介';
    category?: string | null; // 追加: 区分
    phone?: string | null;    // 追加: 連絡先(電話)
    mail?: string | null;     // 追加: 連絡先(メール)
    addr: string | null;
    price: number | null;
    fee: number | null;
    /** 下書きの保存先となる brokerage_listings.id。未指定だと下書き保存は行えない。 */
    recordId?: string | null;
    /** 保存済みの下書き（brokerage_listings.docDraft の JSON 文字列） */
    docDraft?: string | null;
};

// ==========================================
// 💡 3. 約款データマスタ
// ==========================================
const YAK_TITLE: Record<string, string> = {
    '専任媒介': '専任媒介契約約款',
    '専属専任媒介': '専属専任媒介契約約款',
    '一般媒介': '一般媒介契約約款'
};

const YAK_CNAME: Record<string, string> = {
    '専任媒介': '専任媒介契約',
    '専属専任媒介': '専属専任媒介契約',
    '一般媒介': '一般媒介契約'
};

const getYakkanArticles = (ctype: string) => {
    if (ctype === '専属専任媒介') {
        return [
            getYK("YK_PURPOSE"),
            {
                t: '（当事者の表示と用語の定義）',
                a: [getYK("YK_PARTY_HEAD"), '２ この約款において、「{C}」とは、甲が依頼の目的である宅地又は建物（以下「目的物件」といいます。）の売買又は交換の媒介又は代理を乙以外の宅地建物取引業者に重ねて依頼することができず、かつ、甲が自ら発見した相手方と目的物件の売買又は交換の契約を締結することができないものとする媒介契約をいいます。']
            },
            getYK("YK_OBJECT"), getYK("YK_DUTY_SEN"), getYK("YK_PRICE"), getYK("YK_INSPECT"), getYK("YK_TERM"), getYK("YK_FEE"), getYK("YK_FEETIME"), getYK("YK_COST"),
            {
                t: '（直接取引）',
                a: ['{C}の有効期間の満了後２年以内に、甲が乙の紹介によって知った相手方と乙を排除して目的物件の売買又は交換の契約を締結したときは、乙は、甲に対して、契約の成立に寄与した割合に応じた相当額の報酬を請求することができます。']
            },
            {
                t: '（違約金の請求）',
                a: ['甲は、{C}の有効期間内に、乙以外の宅地建物取引業者に目的物件の売買又は交換の媒介又は代理を依頼することはできません。甲がこれに違反し、売買又は交換の契約を成立させたときは、乙は、甲に対して、約定報酬額に相当する金額（この媒介に係る消費税額及び地方消費税額の合計額に相当する額を除きます。）の違約金の支払を請求することができます。', '２ 甲は、{C}の有効期間内に、自ら発見した相手方と目的物件の売買又は交換の契約を締結することはできません。甲がこれに違反したときは、乙は、甲に対して、約定報酬額に相当する金額（この媒介に係る消費税額及び地方消費税額の合計額に相当する額を除きます。）の違約金の支払を請求することができます。']
            },
            {
                t: '（費用償還の請求）',
                a: ['{C}の有効期間内において、乙の責めに帰すことができない事由によって{C}が解除されたときは、乙は、甲に対して、{C}の履行のために要した費用の償還を請求することができます。', '２ 前項の費用の額は、約定報酬額を超えることはできません。']
            },
            getYK("YK_RENEW"), getYK("YK_CANCEL1"), getYK("YK_CANCEL2"), getYK("YK_ANTI"), getYK("YK_SPECIAL")
        ];
    }

    if (ctype === '一般媒介') {
        return [
            getYK("YK_PURPOSE"),
            {
                t: '（当事者の表示と用語の定義）',
                a: [getYK("YK_PARTY_HEAD"), '２ この約款において、「{C}」とは、甲が依頼の目的である宅地又は建物（以下「目的物件」といいます。）の売買又は交換の媒介又は代理を乙以外の宅地建物取引業者に重ねて依頼することができるものとする媒介契約をいいます。']
            },
            getYK("YK_OBJECT"),
            {
                t: '（重ねて依頼をする宅地建物取引業者の明示）',
                a: ['甲は、目的物件の売買又は交換の媒介又は代理を乙以外の宅地建物取引業者に重ねて依頼するときは、その宅地建物取引業者を乙に明示しなければなりません。', '２ {C}の締結時においてすでに依頼をしている宅地建物取引業者の商号又は名称及び主たる事務所の所在地は、{C}書に記載するものとし、その後において更に他の宅地建物取引業者に依頼をしようとするときは、甲は、その旨を乙に通知するものとします。']
            },
            {
                t: '（宅地建物取引業者の義務等）',
                a: ['乙は、次の事項を履行する義務を負います。', '一 契約の相手方との契約条件の調整等を行い、契約の成立に向けて積極的に努力すること。', '二 目的物件の売買又は交換の申込みがあったときは、甲に対して、遅滞なく、その旨を報告すること。', '２ 乙は、前項に掲げる義務を履行するとともに、次の業務を行います。', '一 媒介価額の決定に際し、甲に、その価額に関する意見を述べるときは、根拠を示して説明を行うこと。', '二 甲が乙に目的物件の購入又は取得を依頼した場合にあっては、甲に対して、目的物件の売買又は交換の契約が成立するまでの間に、宅地建物取引士をして、宅地建物取引業法第35条に定める重要事項について、宅地建物取引士が記名した書面を交付（宅地建物取引業法第35条第８項又は第９項の規定による提供を含みます。）して説明させること。', '三 目的物件の売買又は交換の契約が成立したときは、甲及び甲の相手方に対して、遅滞なく、宅地建物取引業法第37条に定める書面を作成し、宅地建物取引士に当該書面に記名させた上で、これを交付（宅地建物取引業法第37条第４項の規定による提供を含みます。）すること。', '四 甲に対して、登記、決済手続等の目的物件の引渡しに係る事務の補助を行うこと。', '五 その他{C}書に記載する業務を行うこと。']
            },
            getYK("YK_PRICE"), getYK("YK_INSPECT"), getYK("YK_TERM"),
            {
                t: '（指定流通機構への登録）',
                a: ['乙は、この媒介契約において目的物件を指定流通機構に登録することとした場合にあっては、当該目的物件を{C}書に記載する指定流通機構に登録しなければなりません。']
            },
            getYK("YK_FEE"), getYK("YK_FEETIME"), getYK("YK_COST"),
            {
                t: '（直接取引）',
                a: ['{C}の有効期間内又は有効期間の満了後２年以内に、甲が乙の紹介によって知った相手方と乙を排除して目的物件の売買又は交換の契約を締結したときは、乙は、甲に対して、契約の成立に寄与した割合に応じた相当額の報酬を請求することができます。']
            },
            {
                t: '（費用償還の請求）',
                a: ['{C}の有効期間内に甲が乙に明示していない宅地建物取引業者に目的物件の売買又は交換の媒介又は代理を依頼し、これによって売買又は交換の契約を成立させたときは、乙は、甲に対して、{C}の履行のために要した費用の償還を請求することができます。', '２ 前項の費用の額は、約定報酬額を超えることはできません。']
            },
            {
                t: '（依頼者の通知義務）',
                a: ['甲は、{C}の有効期間内に、自ら発見した相手方と目的物件の売買若しくは交換の契約を締結したとき、又は乙以外の宅地建物取引業者の媒介若しくは代理によって目的物件の売買若しくは交換の契約を成立させたときは、乙に対して遅滞なくその旨を通知しなければなりません。', '２ 甲が前項の通知を怠った場合において、乙が売買又は交換の契約の成立後善意で甲のために{C}の事務の処理に要する費用を支出したときは、乙は、甲に対して、その費用の償還を請求することができます。']
            },
            getYK("YK_RENEW"), getYK("YK_CANCEL1"), getYK("YK_CANCEL2"), getYK("YK_ANTI"), getYK("YK_SPECIAL")
        ];
    }

    /* 専任媒介 (デフォルト) */
    return [
        getYK("YK_PURPOSE"),
        {
            t: '（当事者の表示と用語の定義）',
            a: [getYK("YK_PARTY_HEAD"), '２ この約款において、「{C}」とは、甲が依頼の目的である宅地又は建物（以下「目的物件」といいます。）の売買又は交換の媒介又は代理を乙以外の宅地建物取引業者に重ねて依頼することができないものとする媒介契約をいいます。']
        },
        getYK("YK_OBJECT"), getYK("YK_DUTY_SEN"), getYK("YK_PRICE"), getYK("YK_INSPECT"), getYK("YK_TERM"), getYK("YK_FEE"), getYK("YK_FEETIME"), getYK("YK_COST"),
        {
            t: '（直接取引）',
            a: ['{C}の有効期間内又は有効期間の満了後２年以内に、甲が乙の紹介によって知った相手方と乙を排除して目的物件の売買又は交換の契約を締結したときは、乙は、甲に対して、契約の成立に寄与した割合に応じた相当額の報酬を請求することができます。']
        },
        {
            t: '（違約金の請求）',
            a: ['甲は、{C}の有効期間内に、乙以外の宅地建物取引業者に目的物件の売買又は交換の媒介又は代理を依頼することはできません。甲がこれに違反し、売買又は交換の契約を成立させたときは、乙は、甲に対して、約定報酬額に相当する金額（この媒介に係る消費税額及び地方消費税額の合計額に相当する額を除きます。）の違約金の支払を請求することができます。']
        },
        {
            t: '（自ら発見した相手方と契約しようとする場合の通知）',
            a: ['甲は、{C}の有効期間内に、自ら発見した相手方と目的物件の売買又は交換の契約を締結しようとするときは、乙に対して、その旨を通知しなければなりません。']
        },
        {
            t: '（費用償還の請求）',
            a: ['{C}の有効期間内において、甲が自ら発見した相手方と目的物件の売買若しくは交換の契約を締結したとき、又は乙の責めに帰すことができない事由によって{C}が解除されたときは、乙は、甲に対して、{C}の履行のために要した費用の償還を請求することができます。', '２ 前項の費用の額は、約定報酬額を超えることはできません。']
        },
        getYK("YK_RENEW"), getYK("YK_CANCEL1"), getYK("YK_CANCEL2"), getYK("YK_ANTI"), getYK("YK_SPECIAL")
    ];
};

// ==========================================
// 💡 4. スタイル定義
// ==========================================
const styles = {
    overlay: { position: 'fixed', inset: 0, backgroundColor: '#5f5f5a', zIndex: 1000, overflowY: 'auto', display: 'flex', flexDirection: 'column' } as React.CSSProperties,
    topBar: { position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#182f45', color: '#e8ecef', display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' } as React.CSSProperties,
    wrap: { display: 'flex', gap: '20px', padding: '20px', justifyContent: 'center', alignItems: 'flex-start' } as React.CSSProperties,
    sidePanel: { width: '300px', backgroundColor: '#fff', borderRadius: '8px', padding: '16px', position: 'sticky', top: '70px', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' } as React.CSSProperties,
    page: { width: '210mm', minHeight: '297mm', padding: '15mm 16mm', backgroundColor: '#fff', color: '#000', margin: '0 auto 20px', boxShadow: '0 3px 14px rgba(0,0,0,.35)', fontSize: '10.5pt', lineHeight: 1.7, boxSizing: 'border-box' } as React.CSSProperties,
    input: { border: 'none', borderBottom: '1px dotted #8d8d86', backgroundColor: '#fffbe9', fontSize: '10.5pt', outline: 'none', padding: '2px 4px', width: '100%', color: '#000' } as React.CSSProperties,
    textarea: { border: '1px dashed #b5b5ad', backgroundColor: '#fffbe9', fontSize: '10.5pt', width: '100%', padding: '8px', outline: 'none', resize: 'vertical' } as React.CSSProperties,
    th: { border: '1px solid #000', padding: '6px 8px', backgroundColor: '#efefec', fontWeight: 'bold', textAlign: 'center' } as React.CSSProperties,
    td: { border: '1px solid #000', padding: '6px 8px', textAlign: 'left', verticalAlign: 'top' } as React.CSSProperties,
};

// ==========================================
// 💡 5. メインコンポーネント
// ==========================================
export const DocumentViewer = ({ initialData, documentShow, setDocumentShow }: {
    initialData?: initialData,
    documentShow: boolean,
    setDocumentShow: React.Dispatch<React.SetStateAction<boolean>>
}) => {
    const { userName } = useContext(AuthContext);
    const today = new Date().toISOString().slice(0, 10);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

    // 💡 フォームの状態管理
    const [form, setForm] = useState<DocumentFormData>({
        ctype: '専任媒介',
        purpose: '売却',
        withPre: true,
        withYakkan: true,
        docDate: today,
        clientName: '',
        clientAddr: '',
        clientContact: '',
        propAddr: '',
        propName: '',
        propKind: '',
        landArea: '',
        bldgArea: '',
        madori: '',
        builtYear: '',
        rights: '所有権',
        price: 0,
        priceNote: '（消費税等相当額を含む。土地は非課税）',
        startDate: today,
        endDate: addMonths(today, 3),
        reportFreq: '2週間に1回以上（文書または電子メール）',
        reinsTerm: '媒介契約締結の日の翌日から7日以内（休業日を除く）に登録',
        feeText: '売買代金の3％＋6万円（別途消費税）',
        feeWhen: '売買契約成立時に50％、残額は引渡完了時',
        special: '',
        agent: COMPANY.agent,
    });

    useEffect(() => {
        if (!initialData) return;

        setForm(prev => {
            const newCtype = ['専任媒介', '専属専任媒介', '一般媒介'].includes(initialData.baikaiType)
                ? initialData.baikaiType
                : '専任媒介';

            let reportFreq = prev.reportFreq;
            let reinsTerm = prev.reinsTerm;

            if (newCtype === '専属専任媒介') {
                reportFreq = '1週間に1回以上（文書または電子メール）';
                reinsTerm = '媒介契約締結の日の翌日から5日以内（休業日を除く）に登録';
            } else if (newCtype === '専任媒介') {
                reportFreq = '2週間に1回以上（文書または電子メール）';
                reinsTerm = '媒介契約締結の日の翌日から7日以内（休業日を除く）に登録';
            } else {
                reportFreq = '（法令上の義務なし／任意：1か月に1回以上）';
                reinsTerm = '（任意登録）';
            }

            const price = initialData.price || 0;
            const fee = initialData.fee;
            const calculatedFee = stdFee(price);
            let feeText = '売買代金の3％＋6万円（別途消費税）';

            if (fee != null) {
                if (calculatedFee === fee) {
                    feeText = `売買代金の3％＋6万円（別途消費税）=${formatYen(fee)}`;
                } else {
                    feeText = `${formatYen(fee)}（別途消費税）`;
                }
            } else {
                feeText = price ? `売買代金の3％＋6万円（別途消費税）=${formatYen(calculatedFee)}` : '売買代金の3％＋6万円（別途消費税）';
            }

            return {
                ...prev,
                reportFreq,
                reinsTerm,
                clientName: initialData.name ?? '',
                clientContact: [initialData.phone, initialData.mail].filter(Boolean).join(' / ') || '',
                propAddr: initialData.addr ?? '',
                propKind: initialData.category ?? '',
                price: price,
                feeText,
                ctype: newCtype as any
            };
        });
    }, [
        initialData?.name,
        initialData?.baikaiType,
        initialData?.category,
        initialData?.phone,
        initialData?.mail,
        initialData?.addr,
        initialData?.price,
        initialData?.fee
    ]);

    // 保存済みの下書きがあれば、リードから組み立てた値の上に重ねる。
    // 手入力した内容（面積・間取り・特約など）はリード側に存在しないため、
    // 下書きを後から当てないと毎回入力し直しになる。
    useEffect(() => {
        if (!initialData?.docDraft) return;
        const draft = safeParse(initialData.docDraft);
        if (!draft || Array.isArray(draft) || typeof draft !== 'object') return;
        setForm(prev => ({ ...prev, ...(draft as Partial<DocumentFormData>) }));
    }, [initialData?.docDraft]);

    /** 下書きを brokerage_listings.docDraft に保存する */
    const handleSaveDraft = async () => {
        const recordId = initialData?.recordId;
        if (!recordId) {
            alert('この画面からは下書きを保存できません（保存先のレコードが特定できません）。');
            return;
        }
        setIsSavingDraft(true);
        try {
            await saveBrokerageRecord(recordId, {
                docDraft: JSON.stringify(form),
                docDraftAt: nowDateTime(),
                docDraftBy: userName || '不明',
            });
            setDraftSavedAt(nowDateTime());
        } catch (e) {
            console.error('[DocumentViewer] 下書きの保存に失敗しました', { recordId }, e);
            alert('下書きの保存に失敗しました。通信状況を確認して、もう一度お試しください。');
        } finally {
            setIsSavingDraft(false);
        }
    };

    // 契約種別が手動で変わった時の連動処理
    useEffect(() => {
        setForm(prev => {
            let reportFreq = prev.reportFreq;
            let reinsTerm = prev.reinsTerm;
            if (prev.ctype === '専属専任媒介') {
                reportFreq = '1週間に1回以上（文書または電子メール）';
                reinsTerm = '媒介契約締結の日の翌日から5日以内（休業日を除く）に登録';
            } else if (prev.ctype === '専任媒介') {
                reportFreq = '2週間に1回以上（文書または電子メール）';
                reinsTerm = '媒介契約締結の日の翌日から7日以内（休業日を除く）に登録';
            } else {
                reportFreq = '（法令上の義務なし／任意：1か月に1回以上）';
                reinsTerm = '（任意登録）';
            }
            return { ...prev, reportFreq, reinsTerm };
        });
    }, [form.ctype]);

    const handleChange = (key: keyof DocumentFormData, value: string | boolean | number) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handlePrint = () => {
        window.print();
    };

    const isBuy = form.purpose === '購入';

    const DocInput = ({ fKey, placeholder, style }: { fKey: keyof DocumentFormData, placeholder?: string, style?: React.CSSProperties }) => (
        <input
            style={{ ...styles.input, ...style }}
            value={String(form[fKey] || '')}
            placeholder={placeholder}
            onChange={(e) => handleChange(fKey, e.target.value)}
        />
    );

    return (
        <Modal show={documentShow} onHide={() => setDocumentShow(false)} fullscreen>
            <div style={styles.overlay} className="print-overlay">
                {/* ==========================================
                    💡 印刷用CSS（モーダル制限の解除・幅の自動調整・全ページ表示）
                ========================================== */}
                <style>{`
                @media print {
                    /* モーダル等によるスクロール制限や固定配置を完全に解除 */
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                        background: transparent !important;
                    }
                    .modal, .modal-dialog, .modal-content, .modal-body {
                        position: static !important;
                        height: auto !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        overflow: visible !important;
                        border: none !important;
                        background: transparent !important;
                        display: block !important;
                        transform: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    
                    /* 不要なUIを隠し、ドキュメント部分だけを表示 */
                    body * { visibility: hidden; }
                    
                    /* overlayから下を全て表示対象にする */
                    .print-overlay, .print-overlay * { visibility: visible; }
                    
                    /* 親要素の flex を解除し block に変更（ページ切れや描画バグの根本原因解消） */
                    .print-overlay {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                        background: transparent !important;
                    }
                    
                    .print-wrap {
                        display: block !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                    }
                    
                    #doc-pages {
                        position: static !important;
                        width: 100% !important;
                        display: block !important;
                    }
                    
                    .no-print { display: none !important; }
                    
                    /* 横幅見切れ解消 & ページ分割対応 */
                    .page {
                        width: 100% !important;          
                        max-width: 100% !important;
                        min-height: auto !important;     
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 5mm 10mm !important;   
                        page-break-after: always !important;
                        page-break-inside: avoid !important;
                        box-sizing: border-box !important;
                    }
                    
                    /* フォーム要素が印刷時に見切れないようにする */
                    input, textarea {
                        background: transparent !important;
                        color: #000 !important;
                        box-shadow: none !important;
                        text-overflow: clip !important;
                        overflow: visible !important;
                    }

                    /* ブラウザ依存のマージンをリセット */
                    @page {
                        size: A4;
                        margin: 5mm;
                    }
                }
                `}</style>

                {/* トップバー */}
                <div style={styles.topBar} className="no-print">
                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>📝 {form.ctype}契約書</span>
                    <span style={{ flex: 1 }}></span>
                    <button onClick={handlePrint} style={{ padding: '6px 16px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ PDF保存（印刷）</button>
                    {draftSavedAt && (
                        <span style={{ fontSize: '11px', opacity: 0.8 }}>下書き保存済み {draftSavedAt.slice(5, 16)}</span>
                    )}
                    <button
                        onClick={handleSaveDraft}
                        disabled={isSavingDraft || !initialData?.recordId}
                        title={initialData?.recordId ? '入力内容をこの案件の下書きとして保存します' : '保存先の案件が特定できないため使用できません'}
                        style={{ padding: '6px 16px', backgroundColor: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: (isSavingDraft || !initialData?.recordId) ? 'not-allowed' : 'pointer', opacity: (isSavingDraft || !initialData?.recordId) ? 0.5 : 1 }}
                    >
                        {isSavingDraft ? '保存中…' : '💾 下書き保存'}
                    </button>
                    <button onClick={() => setDocumentShow(false)} style={{ padding: '6px 16px', backgroundColor: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}>✕ 閉じる</button>
                </div>

                <div style={styles.wrap} className="print-wrap">
                    {/* ⚙️ サイドパネル (設定) */}
                    <aside style={styles.sidePanel} className="no-print">
                        <h4 style={{ fontSize: '14px', borderBottom: '1px solid #dee2e6', paddingBottom: '8px', marginBottom: '12px' }}>書類の設定</h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>契約の種類</label>
                                <select value={form.ctype} onChange={(e) => handleChange('ctype', e.target.value as any)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ced4da' }}>
                                    {['専任媒介', '専属専任媒介', '一般媒介'].map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>依頼内容</label>
                                <select value={form.purpose} onChange={(e) => handleChange('purpose', e.target.value as any)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ced4da' }}>
                                    {['売却', '購入'].map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={form.withPre} onChange={(e) => handleChange('withPre', e.target.checked)} />
                                    事前説明書を1ページ目に含める
                                </label>
                            </div>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={form.withYakkan} onChange={(e) => handleChange('withYakkan', e.target.checked)} />
                                    約款の全文を末尾に添付する
                                </label>
                            </div>
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>作成日</label>
                                <input type="date" value={form.docDate} onChange={(e) => handleChange('docDate', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ced4da' }} />
                            </div>
                        </div>
                    </aside>

                    {/* 📄 A4用紙プレビューエリア */}
                    <div id="doc-pages" style={{ display: 'flex', flexDirection: 'column' }}>

                        {/* --- Page 1: 事前説明書 --- */}
                        {form.withPre && (
                            <section style={styles.page} className="page">
                                <div style={{ textAlign: 'right', marginBottom: '10px' }}>{formatDate(form.docDate)}</div>
                                <h1 style={{ textAlign: 'center', fontSize: '18pt', letterSpacing: '0.4em', marginBottom: '20px' }}>事前説明書</h1>
                                <div style={{ textAlign: 'center', marginBottom: '6mm' }}>（{isBuy ? '不動産の購入' : '不動産の売却'}に関する媒介契約締結前のご説明）</div>

                                <div style={{ marginBottom: '20px', fontSize: '11pt' }}>
                                    <DocInput fKey="clientName" placeholder="依頼者のお名前" style={{ width: '70mm' }} /> 様
                                </div>

                                <p style={{ marginBottom: '4mm', textAlign: 'justify', lineHeight: 1.9, fontSize: '10pt' }}>
                                    このたびは、{isBuy ? '不動産のご購入' : '不動産のご売却'}につきまして当社にご相談いただき、誠にありがとうございます。媒介契約を締結いただくにあたり、契約の種類・有効期間・報酬額など、あらかじめご確認いただきたい事項を以下のとおりご説明いたします。内容をご確認のうえ、ご不明な点がございましたら担当者までお申し付けください。
                                </p>

                                <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>1. 媒介契約の種類と特徴</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '20px', textAlign: 'center' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...styles.th, width: '22%' }}>項目</th>
                                            <th style={styles.th}>専属専任媒介</th>
                                            <th style={styles.th}>専任媒介</th>
                                            <th style={styles.th}>一般媒介</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={styles.td}>他の宅建業者への重ねての依頼</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>できない</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>できない</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>できる</td>
                                        </tr>
                                        <tr>
                                            <td style={styles.td}>依頼者が自ら発見した相手方との{isBuy ? '契約' : '直接取引'}</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>できない</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>できる</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>できる</td>
                                        </tr>
                                        <tr>
                                            <td style={styles.td}>指定流通機構（レインズ）への登録</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>5日以内</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>7日以内</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>任意</td>
                                        </tr>
                                        <tr>
                                            <td style={styles.td}>業務処理状況のご報告</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>1週間に1回以上</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>2週間に1回以上</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>義務なし</td>
                                        </tr>
                                        <tr>
                                            <td style={styles.td}>有効期間</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }} colSpan={2}>3か月以内（更新可）</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>法令上の定めなし<br />（当社は3か月）</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <p style={{ fontSize: '8.5pt', color: '#333', lineHeight: 1.6, marginBottom: '20px' }}>
                                    ※ 休業日は日数に算入しません。※ 有効期間の更新は、依頼者からのお申出により行います（自動更新はいたしません）。
                                </p>

                                <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>2. 報酬（仲介手数料）について</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '20px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...styles.th, width: '55%' }}>{isBuy ? '購入' : '売買'}価額（消費税抜き）</th>
                                            <th style={styles.th}>報酬額の上限（消費税別）</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr><td style={styles.td}>200万円以下の部分</td><td style={styles.td}>取引価額の5％</td></tr>
                                        <tr><td style={styles.td}>200万円を超え400万円以下の部分</td><td style={styles.td}>取引価額の4％＋2万円</td></tr>
                                        <tr><td style={styles.td}>400万円を超える部分</td><td style={styles.td}>取引価額の3％＋6万円</td></tr>
                                        <tr><td style={styles.td}>800万円以下の物件（低廉な空家等の特例）</td><td style={styles.td}>30万円（当事者双方の合意による）</td></tr>
                                    </tbody>
                                </table>
                                <p style={{ fontSize: '8.5pt', color: '#333', lineHeight: 1.6, marginBottom: '20px' }}>
                                    ※ 報酬は媒介により売買契約が成立したときにお支払いいただきます（契約が成立しなかった場合は不要です）。※ 別途、依頼者から特別に依頼を受けて要した実費（広告費・遠隔地への出張費等）は、あらかじめご了解をいただいたうえで別途申し受けます。
                                </p>

                                <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>3. 媒介契約約款について</h3>
                                <p style={{ marginBottom: '3mm', textAlign: 'justify' }}>
                                    本媒介契約は、国土交通省が定めた<b>標準媒介契約約款</b>（平成2年1月30日建設省告示第115号、最終改正 令和6年1月24日国土交通省告示第34号）に基づく契約です。約款の全文は媒介契約書の末尾に添付しております。主な内容は次のとおりです。
                                </p>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '9pt', marginBottom: '20px', pageBreakInside: 'avoid' }}>
                                    <tbody>
                                        <tr>
                                            <th style={{ ...styles.th, width: '22%' }}>当社の義務</th>
                                            <td style={styles.td}>相手方の探索と契約条件の調整／業務処理状況のご報告／申込みがあったときの遅滞ないご報告／指定流通機構への登録と登録済証の交付</td>
                                        </tr>
                                        <tr>
                                            <th style={styles.th}>違約金・費用償還</th>
                                            <td style={styles.td}>
                                                {form.ctype === '一般媒介'
                                                    ? '明示いただいていない他の宅建業者の媒介等により契約を成立させたときは、履行のために要した費用の償還を請求できます（約定報酬額が上限）。'
                                                    : '有効期間内に他の宅建業者へ重ねてご依頼のうえ契約を成立させたときは、約定報酬額相当額を違約金として請求できます。' + (form.ctype === '専属専任媒介' ? '自ら発見された相手方と契約されたときも同様です。' : '自ら発見された相手方と契約されたときは、履行のために要した費用の償還を請求できます（約定報酬額が上限）。')
                                                }
                                            </td>
                                        </tr>
                                        <tr>
                                            <th style={styles.th}>直接取引</th>
                                            <td style={styles.td}>
                                                {form.ctype === '専属専任媒介' ? '有効期間の満了後2年以内に' : '有効期間内又は有効期間の満了後2年以内に'}、当社の紹介により知った相手方と当社を排除して契約されたときは、寄与の割合に応じた報酬を請求できます。
                                            </td>
                                        </tr>
                                        <tr>
                                            <th style={styles.th}>解除・反社条項</th>
                                            <td style={styles.td}>義務の不履行があるときは催告のうえ解除できます。当社に法令違反・不正等があるときは甲から解除できます。反社会的勢力に該当した場合は無催告で解除できます。</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <p style={{ fontSize: '8.5pt', color: '#333', lineHeight: 1.6, marginBottom: '20px' }}>
                                    ※ 上記は要点の抜粋です。詳細は添付の約款全文をご確認ください。約款の各条項に反する特約で依頼者に不利なものは無効となります。
                                </p>

                                <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>4. ご説明・ご確認欄</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '9pt', pageBreakInside: 'avoid' }}>
                                    <tbody>
                                        <tr><th style={{ ...styles.th, width: '30%' }}>説明年月日</th><td style={styles.td}>{formatDate(form.docDate)}</td></tr>
                                        <tr><th style={styles.th}>説明した宅地建物取引業者</th><td style={styles.td}>{COMPANY.name} {COMPANY.dept}</td></tr>
                                        <tr>
                                            <th style={styles.th}>説明者（宅地建物取引士）</th>
                                            <td style={styles.td}><DocInput fKey="agent" placeholder="氏名" style={{ width: '55mm', marginRight: '70px' }} />㊞</td>
                                        </tr>
                                        <tr>
                                            <th style={styles.th}>上記の説明を受けました<br />（依頼者）</th>
                                            <td style={styles.td}>氏名 <DocInput fKey="clientName" style={{ width: '60mm', marginRight: '70px' }} />㊞</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </section>
                        )}

                        {/* --- Page 2: 契約書本体 --- */}
                        <section style={styles.page} className="page">
                            <h1 style={{ textAlign: 'center', fontSize: '16pt', letterSpacing: '0.2em', marginBottom: '10px', fontWeight: 'bold' }}>{form.ctype}契約書</h1>
                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>（{isBuy ? '購入' : '売却'}の媒介）</div>

                            <p style={{ textAlign: 'justify', marginBottom: '20px' }}>
                                依頼者（以下「甲」という。）と宅地建物取引業者（以下「乙」という。）は、下記のとおり{form.ctype}契約を締結する。なお、本契約は国土交通省が定める標準媒介契約約款に基づく契約であり、甲及び乙は末尾の約款を承認のうえ記名押印する。
                            </p>

                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>1. 当事者の表示</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '16px' }}>
                                <tbody>
                                    <tr><th style={{ ...styles.th, width: '27%' }}>甲（依頼者）住所</th><td style={styles.td}><DocInput fKey="clientAddr" placeholder="住所" /></td></tr>
                                    <tr><th style={styles.th}>甲（依頼者）氏名</th><td style={styles.td}><DocInput fKey="clientName" placeholder="氏名" style={{ width: '60mm', marginRight: '70px' }} />㊞</td></tr>
                                    <tr><th style={styles.th}>甲 連絡先</th><td style={styles.td}><DocInput fKey="clientContact" placeholder="電話・メール" /></td></tr>
                                    <tr><th style={styles.th}>乙（宅地建物取引業者）</th><td style={styles.td}>
                                        商号：{COMPANY.name} {COMPANY.dept}<br />
                                        代表者：{COMPANY.rep} <span style={{ marginLeft: '70px' }}>㊞</span><br />
                                        所在地：{COMPANY.addr}<br />
                                        TEL：{COMPANY.tel} {COMPANY.fax ? ` FAX：${COMPANY.fax}` : ''}<br />
                                        免許証番号：{COMPANY.license}<br />
                                        {COMPANY.assoc}
                                    </td></tr>
                                    <tr><th style={styles.th}>担当する宅地建物取引士</th><td style={styles.td}><DocInput fKey="agent" placeholder="氏名" style={{ width: '55mm' }} /></td></tr>
                                </tbody>
                            </table>

                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>2. {isBuy ? '目的物件（購入希望条件）' : '目的物件の表示'}</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '16px' }}>
                                <tbody>
                                    <tr><th style={{ ...styles.th, width: '27%' }}>所在地</th><td style={styles.td}><DocInput fKey="propAddr" placeholder="所在地" /></td></tr>
                                    <tr><th style={styles.th}>物件名・部屋番号</th><td style={styles.td}><DocInput fKey="propName" placeholder="マンション名・号室など" /></td></tr>
                                    <tr><th style={styles.th}>種別</th><td style={styles.td}><DocInput fKey="propKind" placeholder="土地／戸建／マンション 等" style={{ width: '55mm' }} /></td></tr>
                                    <tr><th style={styles.th}>土地（地積）</th><td style={styles.td}><DocInput fKey="landArea" style={{ width: '45mm' }} /> ㎡</td></tr>
                                    <tr><th style={styles.th}>建物（床面積・間取り）</th><td style={styles.td}>
                                        <DocInput fKey="bldgArea" style={{ width: '45mm' }} /> ㎡ 間取り <DocInput fKey="madori" style={{ width: '35mm' }} />
                                    </td></tr>
                                    <tr><th style={styles.th}>築年月・権利</th><td style={styles.td}>
                                        築年月 <DocInput fKey="builtYear" style={{ width: '40mm' }} /> 権利 <DocInput fKey="rights" placeholder="所有権 等" style={{ width: '35mm' }} />
                                    </td></tr>
                                </tbody>
                            </table>

                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>3. {isBuy ? '購入希望価額' : '媒介価額（売出価額）'}</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '16px' }}>
                                <tbody>
                                    <tr>
                                        <th style={{ ...styles.th, width: '27%' }}>金額</th>
                                        <td style={styles.td}>
                                            金 <DocInput fKey="price" style={{ width: '55mm', textAlign: 'right' }} /> 円
                                            {Number(form.price) ? <span style={{ marginLeft: '10px', fontSize: '9pt', color: '#333' }}>（{formatMan(form.price)}円）</span> : null}
                                        </td>
                                    </tr>
                                    <tr><th style={styles.th}>備考</th><td style={styles.td}><DocInput fKey="priceNote" /></td></tr>
                                </tbody>
                            </table>

                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>4. 有効期間</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '16px' }}>
                                <tbody>
                                    <tr><th style={{ ...styles.th, width: '27%' }}>期間</th><td style={styles.td}>
                                        <input type="date" value={form.startDate} onChange={e => handleChange('startDate', e.target.value)} style={{ ...styles.input, width: 'auto', minWidth: '22mm' }} /> から
                                        <input type="date" value={form.endDate} onChange={e => handleChange('endDate', e.target.value)} style={{ ...styles.input, width: 'auto', minWidth: '22mm', marginLeft: '8px' }} /> まで（3か月以内）
                                    </td></tr>
                                </tbody>
                            </table>
                            
                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>5. 指定流通機構への登録</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '16px' }}>
                                <tbody>
                                    <tr><th style={{ ...styles.th, width: '27%' }}>登録期限</th><td style={styles.td}><DocInput fKey="reinsTerm" /></td></tr>
                                </tbody>
                            </table>
                            
                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>6. 業務処理状況の報告</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '16px' }}>
                                <tbody>
                                    <tr><th style={{ ...styles.th, width: '27%' }}>報告の頻度</th><td style={styles.td}><DocInput fKey="reportFreq" /></td></tr>
                                </tbody>
                            </table>
                        </section>

                        {/* --- Page 3: 報酬・特約 --- */}
                        <section style={styles.page} className="page">
                            <h2 style={{ fontSize: '12pt', textAlign: 'center', letterSpacing: '0.2em', marginBottom: '4mm', fontWeight: 'bold' }}>{form.ctype}契約書（つづき）</h2>

                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>7. 報酬額（媒介報酬）</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '8px' }}>
                                <tbody>
                                    <tr><th style={{ ...styles.th, width: '27%' }}>報酬額</th><td style={styles.td}><DocInput fKey="feeText" /></td></tr>
                                    <tr><th style={styles.th}>支払時期</th><td style={styles.td}><DocInput fKey="feeWhen" /></td></tr>
                                </tbody>
                            </table>
                            <p style={{ fontSize: '8.5pt', color: '#333', lineHeight: 1.6, marginBottom: '20px' }}>
                                ※ 報酬額は国土交通省告示に定める上限額の範囲内とし、売買契約が成立したときに支払うものとします。※ 甲の特別の依頼による広告費・調査費等の実費は、事前に甲の承諾を得たうえで別途申し受けます。
                            </p>

                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>8. 特約事項</h3>
                            <textarea
                                style={styles.textarea}
                                rows={7}
                                value={form.special}
                                onChange={e => handleChange('special', e.target.value)}
                                placeholder="例）媒介価額の改定について／広告・現地販売会の実施について／有効期間満了後の取扱い など"
                            />

                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>9. 媒介契約約款</h3>
                            <p style={{ marginBottom: '3mm', textAlign: 'justify' }}>
                                本契約は、国土交通省が定めた標準媒介契約約款に基づく契約です。{form.withYakkan ? `約款の全文は本書末尾に「${YAK_TITLE[form.ctype] || '媒介契約約款'}」として添付しています。` : `約款の全文は別紙「${YAK_TITLE[form.ctype] || '媒介契約約款'}」のとおりです。`}
                            </p>
                            <p style={{ fontSize: '8.5pt', color: '#333', lineHeight: 1.6, marginBottom: '20px' }}>
                                本契約は、上記約款及び本書に記載の条件に基づいて締結されるものであり、甲は約款の交付を受け、その内容を確認しました。
                            </p>

                            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', borderLeft: '3px solid #000', paddingLeft: '8px', margin: '5mm 0 2mm' }}>10. 記名押印</h3>
                            <p style={{ marginBottom: '3mm', textAlign: 'justify' }}>
                                本契約の成立を証するため本書2通を作成し、甲乙記名押印のうえ各自1通を保有する。
                            </p>

                            <div style={{ textAlign: 'right', marginTop: '4mm', marginBottom: '4mm' }}>{formatDate(form.docDate)}</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', pageBreakInside: 'avoid' }}>
                                <tbody>
                                    <tr>
                                        <th style={{ ...styles.th, height: '12mm', verticalAlign: 'middle', width: '27%' }}>甲（依頼者）</th>
                                        <td style={{ ...styles.td, height: '12mm', verticalAlign: 'middle' }}>
                                            住所 <DocInput fKey="clientAddr" style={{ width: '120mm' }} /><br />
                                            氏名 <DocInput fKey="clientName" style={{ width: '60mm', marginRight: '70px' }} />㊞
                                        </td>
                                    </tr>
                                    <tr>
                                        <th style={{ ...styles.th, height: '12mm', verticalAlign: 'middle' }}>乙（宅地建物取引業者）</th>
                                        <td style={{ ...styles.td, height: '12mm', verticalAlign: 'middle' }}>
                                            所在地 {COMPANY.addr}<br />
                                            商号 {COMPANY.name}<br />
                                            代表者 {COMPANY.rep}  ㊞<br />
                                            免許証番号 {COMPANY.license}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th style={{ ...styles.th, height: '12mm', verticalAlign: 'middle' }}>担当宅地建物取引士</th>
                                        <td style={{ ...styles.td, height: '12mm', verticalAlign: 'middle' }}>
                                            <DocInput fKey="agent" style={{ width: '55mm', marginRight: '70px' }} />㊞
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </section>

                        {/* --- Page 4: 約款 (オプション) --- */}
                        {form.withYakkan && (
                            <section style={styles.page} className="page">
                                <h2 style={{ fontSize: '12pt', textAlign: 'center', marginBottom: '2mm', fontWeight: 'bold' }}>{YAK_TITLE[form.ctype]}</h2>
                                <div style={{ fontSize: '8.5pt', color: '#333', textAlign: 'center', marginBottom: '4mm' }}>
                                    （宅地建物取引業法施行規則の規定による標準媒介契約約款／平成2年1月30日建設省告示第115号 最終改正 令和6年1月24日国土交通省告示第34号）
                                </div>

                                {getYakkanArticles(form.ctype).map((art, idx) => (
                                    <div key={idx} style={{ marginBottom: '12px' }}>
                                        {art.t && <h4 style={{ fontSize: '9pt', fontWeight: 'bold', margin: '3.2mm 0 0.8mm' }}>{art.t}</h4>}
                                        {art.a.map((text: string, i: number) => {
                                            const isListItem = /^[２３４５６７８９]|^１０|^[一二三四五六七八九十]\s|^[イロハニホ]\s/.test(text);
                                            return (
                                                <p key={i} style={{
                                                    fontSize: '9pt',
                                                    margin: '0 0 1.2mm',
                                                    textAlign: 'justify',
                                                    paddingLeft: isListItem ? '6mm' : '0',
                                                    textIndent: isListItem ? '-2.6mm' : '0'
                                                }}>
                                                    {i === 0 ? <b>第{idx + 1}条</b> : ''} {text.replace(/\{C\}/g, YAK_CNAME[form.ctype])}
                                                </p>
                                            );
                                        })}
                                    </div>
                                ))}
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default DocumentViewer;