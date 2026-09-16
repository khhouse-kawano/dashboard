import React, { useEffect, useState, useContext } from 'react';
import Table from "react-bootstrap/Table";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchDetail, fetchMaster, insertCampaign, updateCampaign } from './campaignApi';
import AuthContext from '../../context/AuthContext';
import { PLACEHOLDERS, unknownPlaceholders } from './mailTemplateFields';

type BooleanKeys =
    'thanks';

type FormState = {
    brand: string;
    campaign: string;
    campaign_id: string;
    mail_to: string;
    mail_cc: string;
    redirect: string;
    img_code: string,
    /**
     * ⚠️⚠️ **メール本文のひな型。空なら既定の文面が使われる。**
     *   ⚠️ 既定は ② の `campaignForm/mailTemplate.ts` にある。
     *     ⚠️ ここに書き写さないこと。写すと既定を直しても反映されなくなる。
     *   ⚠️ 既存の340件はすべて空。**空＝既定に戻す**という意味である。
     */
    thanks_subject: string,
    thanks_body: string,
    internal_subject: string,
    internal_body: string,
    notice: {
        bool: boolean,
        text: string
    }
    shop: {
        bool: boolean,
        required: boolean,
        text: string,
        shopName: string[],
        /**
         * ⚠️⚠️ **聞かない（bool=false）ときに、代わりに入れておく値。**
         *   ⚠️ 2026-09-16 追加。⚠️ 既存の272件にはこのキーが無いので
         *     **必ず `?? ''` で読むこと**（undefined が来る）。
         *   ⚠️ 列は増やしていない。既存の JSON に1つ足しただけなので、
         *     古いフォームはそのまま動く。
         *   ⚠️ 公開フォーム（react/form_get）がこの値を送る。
         *     ⚠️ 片方だけ直すと、指定したのに保存されない。
         */
        default?: string
    }
    date: {
        bool: boolean,
        required: boolean,
        text_day: string,
        text_time: string,
        time: string[]
    }
    name: {
        bool: boolean,
        required: boolean,
        text_sei: string,
        text_mei: string
    }
    kana: {
        bool: boolean,
        required: boolean,
        text_sei: string,
        text_mei: string
    }
    age: {
        bool: boolean,
        required: boolean,
        text: string
    }
    phone: {
        bool: boolean,
        required: boolean,
        text: string
    }
    mail: {
        bool: boolean,
        required: boolean,
        text: string
    }
    address: {
        bool: boolean,
        required: boolean,
        text_zip: string,
        text_pref: string,
        text_city: string,
        text_town: string,
        text_street: string
    }
    question: {
        bool: boolean,
        required: boolean,
        text: string
    }
    attention: {
        bool: boolean,
        text: string,
        bool_red: boolean,
        text_red: string
    }
    medium: {
        bool: boolean,
        required: boolean,
        text: string,
        mediumName: string[]
    }
} & Record<BooleanKeys, boolean>;

type Response = { status: string; message: string }
const NewCampaign = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const brandValue = queryParams.get('brand');
    const idValue = queryParams.get('id');
    const [form, setForm] = useState<FormState>({
        brand: '',
        campaign: '',
        campaign_id: '',
        mail_to: '',
        mail_cc: '',
        thanks: true,
        redirect: '',
        img_code: '',
        thanks_subject: '',
        thanks_body: '',
        internal_subject: '',
        internal_body: '',
        notice: {
            bool: true,
            text: '',
        },
        shop: {
            bool: true,
            required: true,
            text: '',
            shopName: [],
            default: ''
        },
        date: {
            bool: true,
            required: true,
            text_day: '',
            text_time: '',
            time: []
        },
        name: {
            bool: true,
            required: true,
            text_sei: '',
            text_mei: ''
        },
        kana: {
            bool: true,
            required: true,
            text_sei: '',
            text_mei: ''
        },
        age: {
            bool: true,
            required: true,
            text: ''
        },
        phone: {
            bool: true,
            required: true,
            text: ''
        },
        mail: {
            bool: true,
            required: true,
            text: ''
        },
        address: {
            bool: true,
            required: true,
            text_zip: '',
            text_pref: '',
            text_city: '',
            text_town: '',
            text_street: ''
        },
        medium: {
            bool: true,
            required: true,
            text: '',
            mediumName: []
        },
        question: {
            bool: true,
            required: false,
            text: ''
        },
        attention: {
            bool: true,
            text: '',
            bool_red: true,
            text_red: ''
        },
    });
    const [response, setResponse] = useState<Response>();
    const [newShop, setNewShop] = useState<string>('');
    const [newTime, setNewTime] = useState<string>('');
    const [newMedium, setNewMedium] = useState<string>('');
    const [validation, setValidation] = useState<string[]>([]);
    /**
     * ⚠️ 設定を読めなかったことを画面に出すため。
     *   ⚠️ 2026-09-16 まで、読めなくても**何も出ず**、
     *     利用者には「修正を押したのに反映されない」としか見えなかった。
     */
    const [loadError, setLoadError] = useState<string>('');
    const { token } = useContext(AuthContext);
    const { category } = useContext(AuthContext);

    useEffect(() => {
        const fetchData = async () => {
            if (idValue) {
                try {
                    const response = await fetchDetail(String(brandValue ?? ''), String(idValue ?? ''));
                    const row = response.data;

                    /**
                     * ⚠️⚠️ **`response.data` が行そのもの。`response.data.data` ではない。**
                     *   ⚠️ 2026-09-16、旧APIから移した際にここだけ直し忘れ、
                     *     **全項目が undefined** になっていた。
                     *   ⚠️ さらに `JSON.parse(undefined)` で例外になり、
                     *     **修正ボタンを押しても画面に何も入らなかった。**
                     */
                    if (!row) {
                        console.error(`キャンペーン設定が見つかりません brand="${brandValue}" id="${idValue}"`);
                        setLoadError('キャンペーン設定を読み込めませんでした。');
                        return;
                    }

                    /**
                     * ⚠️ JSON 列は文字列で入っている。
                     *   ⚠️ 1つでも壊れていると画面全体が出なくなるので、項目ごとに受け止める。
                     */
                    const parse = <T,>(value: string | undefined, fallback: T): T => {
                        if (!value) return fallback;
                        try {
                            return JSON.parse(value) as T;
                        } catch {
                            console.error(`設定の解釈に失敗しました: ${String(value).slice(0, 80)}`);
                            return fallback;
                        }
                    };

                    setForm(prev => ({
                        brand: brandValue as string,
                        campaign: row.campaign ?? '',
                        campaign_id: row.campaign_id ?? '',
                        mail_to: row.mail_to ?? '',
                        mail_cc: row.mail_cc ?? '',
                        thanks: Boolean(Number(row.thanks ?? 0)),
                        redirect: row.redirect ?? '',
                        // ⚠️ img_code は form_table に列が無い（form_database だけ）。常に空になる
                        img_code: row.img_code ?? '',
                        /**
                         * ⚠️⚠️ **列が無い古い応答でも空文字にすること。**
                         *   ⚠️ undefined のまま textarea に渡すと React が
                         *     **非制御→制御の切り替わり**で警告を出し、入力が壊れる。
                         */
                        thanks_subject: row.thanks_subject ?? '',
                        thanks_body: row.thanks_body ?? '',
                        internal_subject: row.internal_subject ?? '',
                        internal_body: row.internal_body ?? '',
                        notice: parse(row.notice, prev.notice),
                        shop: parse(row.shop, prev.shop),
                        date: parse(row.date, prev.date),
                        name: parse(row.name, prev.name),
                        kana: parse(row.kana, prev.kana),
                        age: parse(row.age, prev.age),
                        phone: parse(row.phone, prev.phone),
                        mail: parse(row.mail, prev.mail),
                        address: parse(row.address, prev.address),
                        medium: parse(row.medium, prev.medium),
                        question: parse(row.question, prev.question),
                        attention: parse(row.attention, prev.attention),
                    }));
                } catch (error) {
                    // ⚠️ 黙らない。利用者には「修正を押したのに反映されない」としか見えない
                    console.error("キャンペーン設定の取得に失敗:", error);
                    setLoadError('キャンペーン設定を読み込めませんでした。');
                }
            } else {
                try {
                    const response = { data: await fetchMaster(String(brandValue ?? '')) };
                    setForm({
                        brand: response.data.brand,
                        campaign: '',
                        campaign_id: '',
                        mail_to: response.data.mail_to,
                        mail_cc: response.data.mail_cc,
                        thanks: Boolean(response.data.thanks),
                        redirect: response.data.redirect,
                        img_code: response.data.img_code,
                        // ⚠️ form_database（ブランド既定値）にひな型の列は無い。新規は常に空＝既定
                        thanks_subject: '',
                        thanks_body: '',
                        internal_subject: '',
                        internal_body: '',
                        notice: JSON.parse(response.data.notice),
                        shop: JSON.parse(response.data.shop),
                        date: JSON.parse(response.data.date),
                        name: JSON.parse(response.data.name),
                        kana: JSON.parse(response.data.kana),
                        age: JSON.parse(response.data.age),
                        phone: JSON.parse(response.data.phone),
                        mail: JSON.parse(response.data.mail),
                        address: JSON.parse(response.data.address),
                        medium: JSON.parse(response.data.medium),
                        question: JSON.parse(response.data.question),
                        attention: JSON.parse(response.data.attention),
                    });
                } catch (error) {
                    console.error("データ取得エラー:", error);
                }
            }
        };

        fetchData();
    }, [])

    const changeForm = (category: keyof FormState, value?: string) => {
        setForm(prev => {
            if (!prev) return prev;

            if ((category as BooleanKeys) in prev && typeof prev[category] === 'boolean') {
                return {
                    ...prev,
                    [category]: !prev[category as BooleanKeys]
                };
            }

            if (category === 'campaign_id') {
                let urlValue: string = '';
                let tagValue: string = '';
                if (brandValue === 'kh') {
                    urlValue = `https://kh-house.jp/form/?id=${value}&brand=${brandValue}`;
                    tagValue = `<iframe id=f src="/form/?id=${value}&brand=${brandValue}" width=100% frameborder=0 scrolling=no style="border:none"></iframe><script>setInterval(r=()=>f.style.height=f.contentWindow?.document?.body?.scrollHeight+120+"px",1e3);f.addEventListener("load",r);</script>`
                } else if (brandValue === 'djh') {
                    urlValue = `https://day-just-house.com/form/?id=${value}&brand=${brandValue}`;
                    tagValue = `<iframe id=f src="/form/?id=${value}&brand=${brandValue}" width=100% frameborder=0 scrolling=no style="border:none"></iframe><script>setInterval(r=()=>f.style.height=f.contentWindow?.document?.body?.scrollHeight+120+"px",1e3);f.addEventListener("load",r);</script>`
                } else if (brandValue === 'nagomi') {
                    urlValue = `https://www.nagomi-koumuten.jp/form/?id=${value}&brand=${brandValue}`
                    tagValue = `<iframe id=f src="/form/?id=${value}&brand=${brandValue}" width=100% frameborder=0 scrolling=no style="border:none"></iframe><script>setInterval(r=()=>f.style.height=f.contentWindow?.document?.body?.scrollHeight+120+"px",1e3);f.addEventListener("load",r);</script>`
                } else if (brandValue === '2l') {
                    urlValue = `https://2lhome.net/form/?id=${value}&brand=${brandValue}`
                    tagValue = `<iframe id=f src="/form/?id=${value}&brand=${brandValue}" width=100% frameborder=0 scrolling=no style="border:none"></iframe><script>setInterval(r=()=>f.style.height=f.contentWindow?.document?.body?.scrollHeight+120+"px",1e3);f.addEventListener("load",r);</script>`
                } else if (brandValue === 'fh') {
                    urlValue = `https://furukomi-home.com/form/?id=${value}&brand=${brandValue}`
                    tagValue = `<iframe id=f src="/form/?id=${value}&brand=${brandValue}" width=100% frameborder=0 scrolling=no style="border:none"></iframe><script>setInterval(r=()=>f.style.height=f.contentWindow?.document?.body?.scrollHeight+120+"px",1e3);f.addEventListener("load",r);</script>`
                } else if (brandValue === 'pg') {
                    urlValue = `https://miyazaki.pg-house.jp/form/?id=${value}&brand=${brandValue}`
                    tagValue = `<iframe id=f src="/form/?id=${value}&brand=${brandValue}" width=100% frameborder=0 scrolling=no style="border:none"></iframe><script>setInterval(r=()=>f.style.height=f.contentWindow?.document?.body?.scrollHeight+120+"px",1e3);f.addEventListener("load",r);</script>`
                } else if (brandValue === 'jh') {
                    urlValue = `https://jusfy-home.com/form/?id=${value}&brand=${brandValue}`
                    tagValue = `<iframe id=f src="/form/?id=${value}&brand=${brandValue}" width=100% frameborder=0 scrolling=no style="border:none"></iframe><script>setInterval(r=()=>f.style.height=f.contentWindow?.document?.body?.scrollHeight+120+"px",1e3);f.addEventListener("load",r);</script>`
                } else if (brandValue === 'khg') {
                    urlValue = `https://kh-house.jp/khg/form/?id=${value}&brand=${brandValue}`
                    tagValue = `<iframe id=f src="/khg/form/?id=${value}&brand=${brandValue}" width=100% frameborder=0 scrolling=no style="border:none"></iframe><script>setInterval(r=()=>f.style.height=f.contentWindow?.document?.body?.scrollHeight+120+"px",1e3);f.addEventListener("load",r);</script>`
                }
                return {
                    ...prev,
                    [category]: value ?? '',
                    url: urlValue,
                    tag: tagValue
                };
            }

            if (category === 'shop' || category === 'date' || category === 'medium') {
                return {
                    ...prev,
                    [category]: {
                        ...prev[category],
                        bool: !prev[category].bool
                    }
                };
            }

            return {
                ...prev,
                [category]: value ?? ''
            };
        });
    };



    type TemplateKey = 'thanks_subject' | 'thanks_body' | 'internal_subject' | 'internal_body';

    const changeTemplate = (key: TemplateKey, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    /**
     * メール文面の編集欄。
     *
     * ⚠️⚠️ **空欄＝既定の文面**である。
     *   ⚠️ 既定の本文はここに書き写していない（② が持っている）。
     *     ⚠️ 写すと、既定を直しても画面だけ古いままになる。
     *   ⚠️ したがって「既定に戻す」は**空にするだけ**でよい。
     *
     * ⚠️ 差し込み語は `{{ }}` で書く。⚠️ 知らない語はそのまま本文に残る。
     *   ⚠️ 気づけるよう、保存前にここで知らせる。
     */
    const mailTemplateEditor = (subjectKey: TemplateKey, bodyKey: TemplateKey, note: string) => {
        const subject = form[subjectKey];
        const body = form[bodyKey];
        const unknown = [...unknownPlaceholders(subject), ...unknownPlaceholders(body)];
        const isDefault = subject.trim() === '' && body.trim() === '';

        return (
            <div>
                <div className="d-flex align-items-center mb-2" style={{ gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>{note}</span>
                    <span style={{
                        fontSize: '11px', padding: '2px 10px', borderRadius: '999px',
                        backgroundColor: isDefault ? '#eef2f7' : '#fff7ed',
                        color: isDefault ? '#4b5563' : '#b45309',
                    }}>
                        {isDefault ? '既定の文面' : 'このキャンペーン専用'}
                    </span>
                    {isDefault ||
                        <button type="button"
                            onClick={() => { changeTemplate(subjectKey, ''); changeTemplate(bodyKey, ''); }}
                            style={{
                                fontSize: '11px', border: '1px solid #d1d5db', borderRadius: '999px',
                                background: '#fff', padding: '2px 12px', cursor: 'pointer',
                            }}>
                            既定に戻す
                        </button>}
                </div>

                <input type="text" className="form-control mb-2" value={subject}
                    placeholder="件名（空欄なら既定）"
                    onChange={(e) => changeTemplate(subjectKey, e.target.value)}
                    style={{ fontSize: '12px' }} />

                <textarea value={body} rows={10}
                    placeholder="本文（空欄なら既定の文面が送られます）"
                    onChange={(e) => changeTemplate(bodyKey, e.target.value)}
                    style={{
                        width: '100%', border: '1px solid #D3D3D3', borderRadius: '7px',
                        fontSize: '12px', letterSpacing: '.7px', padding: '6px',
                    }} />

                {unknown.length === 0 ||
                    <div style={{ color: '#b45309', fontSize: '12px', marginTop: '4px' }}>
                        {`差し込めない語があります：${unknown.map(k => `{{${k}}}`).join(' ')}`}
                        <span className="ms-1">そのまま本文に出ます。</span>
                    </div>}

                <details style={{ marginTop: '6px' }}>
                    <summary style={{ fontSize: '12px', cursor: 'pointer', color: '#2563eb' }}>
                        使える差し込み語
                    </summary>
                    <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: 1.9, marginTop: '4px' }}>
                        {PLACEHOLDERS.map(item => (
                            <div key={item.key}>
                                <code>{`{{${item.key}}}`}</code>
                                {!item.note || <span className="ms-2">{item.note}</span>}
                            </div>
                        ))}
                    </div>
                </details>
            </div>
        );
    };

    const postForm = async () => {
        console.log(form);
        setValidation([]);
        const missing: string[] = [];
        for (const [key, value] of Object.entries(form)) {
            const required: string[] = ['campaign', 'campaign_id', 'mail_to', 'mail_cc', 'redirect'];
            required.map(item => {
                if (item === key && !value) missing.push(key);
            }
            )
        }
        if (missing.length > 0) {
            alert(`${missing.length}個の未入力項目があります`);
            setValidation(missing);
            return;
        }
        const fetchData = async () => {
            if (idValue) {
                try {
                    setResponse(await updateCampaign(form));
                } catch (error) {
                    console.error("データ取得エラー:", error);
                }
            } else {
                try {
                    setResponse(await insertCampaign(form));
                } catch (error) {
                    console.error("データ取得エラー:", error);
                }
            }
        };

        fetchData();
    };

    useEffect(() => {
        if (response?.status === 'duplicate') {
            alert('キャンペーンIDが重複しています')
        } else if (response?.status === 'success') {
            navigate(`/campaign/?brand=${form.brand}`);
        }
    }, [response])

    return (
        <>
            <div className='content database bg-white p-2'>
                <div className="table-wrapper">
                    <div className="list_table">
                        <div className='bg-light w-75' style={{ position: 'fixed', bottom: '0', height: '130px', zIndex: '100' }}>
                            <div className="p-3 rounded-pill" style={{ width: '400px', margin: '40px auto', textAlign: 'center', cursor: 'pointer', backgroundColor: 'blue', color: '#fff', textDecoration: 'none' }} onClick={() => postForm()}>{!idValue ? '入力内容でキャンペーン登録' : '入力内容でキャンペーン修正'}</div>
                        </div>
                        <div className="bg-white" style={{ width: '90%', maxWidth: '960px', margin: '0 auto', paddingBottom: '200px' }}>
                            <div className="pt-3" style={{ width: '200px', margin: '0 auto' }}>
                                <img src={`https://khg-marketing.info/dashboard/form/img/${brandValue}.png`} className="w-100" />
                            </div>
                            <div className="w-100 pt-3" style={{ fontSize: '15px', textAlign: 'center', marginBottom: '30px' }}>
                                {idValue ? 'キャンペーン修正' : 'キャンペーン作成'}
                            </div>

                            {/**
                              * ⚠️⚠️ **読み込めなかったことを必ず画面に出す。**
                              *   ⚠️ 出さないと「修正を押したのに反映されない」としか見えず、
                              *     利用者にも受けた側にも原因が分からない。
                              */}
                            {!loadError ||
                                <div className="border rounded p-3 mb-4 text-center"
                                    style={{ fontSize: '13px', color: '#dc3545', backgroundColor: '#fff5f5' }}>
                                    {loadError}<br />
                                    <span style={{ fontSize: '11px', color: '#666' }}>
                                        このまま保存すると内容が上書きされます。一覧に戻ってやり直してください。
                                    </span>
                                </div>}
                            <Table style={{ width: '90%', margin: '0 auto' }}>
                                <tbody style={{ border: '1px solid #d3d3d3ff' }}>
                                    <tr style={{ fontSize: '13px' }}>
                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            キャンペーン名
                                        </td>
                                        <td>
                                            <div><input type="text" className="form-control" value={form.campaign} id='campaign' onChange={(e) => changeForm('campaign', e.target.value)} placeholder='例)20**【KH**】****キャンペーン ※反響メールのタイトルになります' /></div>
                                            {!validation.includes('campaign') || <div style={{ color: 'red', marginTop: '-5px' }}>キャンペーン名が未入力です</div>}
                                        </td>
                                    </tr >
                                    <tr style={{ fontSize: '13px' }}>
                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            キャンペーンID
                                        </td>
                                        <td>
                                            <div><input type="text" className="form-control" value={form.campaign_id} onChange={(e) => changeForm('campaign_id', e.target.value)} disabled={!!idValue} placeholder='例)20**0101_kh**_***campaign ※重複不可 半角英数のみ使用' /></div>
                                            {!validation.includes('campaign_id') || <div style={{ color: 'red', marginTop: '-5px' }}>キャンペーンIDが未入力です</div>}
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px' }}>
                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            反響アドレス(To)
                                        </td>
                                        <td>
                                            <div><input type="text" className="form-control" value={form.mail_to} onChange={(e) => changeForm('mail_to', e.target.value)} /></div>
                                            {!validation.includes('mail_to') || <div style={{ color: 'red', marginTop: '-5px' }}>反響アドレス(To)が未入力です</div>}
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px' }}>
                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            反響アドレス(Cc)
                                        </td>
                                        <td>
                                            <div><input type="text" className="form-control" value={form.mail_cc} onChange={(e) => changeForm('mail_cc', e.target.value)} /></div>
                                            {!validation.includes('mail_cc') || <div style={{ color: 'red', marginTop: '-5px' }}>反響アドレス(Cc)が未入力です</div>}
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px' }}>
                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            サンクスメール
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-3">
                                                <div>
                                                    <input type="radio" name='thanks' style={{ transform: 'scale(1.5)', cursor: 'pointer' }} checked={form.thanks === true} onChange={() => changeForm('thanks')} />
                                                </div>
                                                <div className="ms-2">
                                                    送る
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <div>
                                                    <input type="radio" name='thanks' style={{ transform: 'scale(1.5)', cursor: 'pointer' }} checked={form.thanks === false} onChange={() => changeForm('thanks')} />
                                                </div>
                                                <div className="ms-2">
                                                    不要
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px' }}>
                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            サンクスメールの文面
                                        </td>
                                        <td>
                                            {mailTemplateEditor('thanks_subject', 'thanks_body', 'お客様へ届くメールです。')}
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px' }}>
                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            通知メールの文面
                                        </td>
                                        <td>
                                            {mailTemplateEditor('internal_subject', 'internal_body', '社内（反響アドレス）へ届くメールです。')}
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px' }}>
                                        <td style={{ width: '200px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            リダイレクトURL
                                        </td>
                                        <td>
                                            <div><input type="text" className="form-control" value={form.redirect} onChange={(e) => changeForm('redirect', e.target.value)} /></div>
                                            {!validation.includes('redirect') || <div style={{ color: 'red', marginTop: '-5px' }}>リダイレクトURLが未入力です</div>}
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px' }}>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <div>注意書き</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.notice.bool} onChange={() => changeForm('notice')} /></div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '13px', letterSpacing: '1px' }}>
                                                <textarea value={form.notice.text} style={{ width: '100%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} rows={5}
                                                    onChange={(e) =>
                                                        setForm(prev => ({
                                                            ...prev,
                                                            notice: {
                                                                ...prev.notice,
                                                                text: e.target.value
                                                            }
                                                        }))
                                                    }></textarea>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>来場希望場所</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.shop.bool} onChange={() => changeForm('shop')} /></div>
                                        </td>
                                        <td>
                                            {/**
                                              * ⚠️⚠️ **聞かないときは、代わりに入れておく値を選ばせる**（2026-09-16 の指示）。
                                              *   ⚠️ 例: 店舗が1つに決まっているLPで、来場希望場所を尋ねずに固定する。
                                              *   ⚠️ 空のままなら今までどおり（何も入らない）。
                                              *   ⚠️ 候補は下の「選択肢」をそのまま使う。**別に持たせない**
                                              *     （持たせると選択肢を直したときに片方だけ古くなる）。
                                              */}
                                            {form.shop.bool ||
                                                <div className="mb-3 p-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                                                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                                        聞かない代わりに、この値で登録する
                                                    </div>
                                                    <select
                                                        value={form.shop.default ?? ''}
                                                        style={{ fontSize: '13px', padding: '3px 6px', minWidth: '260px', maxWidth: '100%' }}
                                                        onChange={(e) => setForm(prev => ({
                                                            ...prev,
                                                            shop: { ...prev.shop, default: e.target.value }
                                                        }))}
                                                    >
                                                        <option value="">指定しない</option>
                                                        {form.shop.shopName.map((item, index) =>
                                                            <option key={index} value={item}>{item}</option>)}
                                                    </select>
                                                    {form.shop.shopName.length > 0 ||
                                                        <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                                            ⚠️ 選択肢がまだありません。下で追加すると選べます。
                                                        </div>}
                                                </div>}

                                            <div>
                                                <div className="d-flex align-items-center mb-2">
                                                    <div>
                                                        <input type="radio" name='shop' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.shop.required === true}
                                                            onChange={() =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    shop: {
                                                                        ...prev.shop,
                                                                        required: !prev.shop.required
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div className="ms-1">
                                                        必須
                                                    </div>
                                                    <div>
                                                        <input type="radio" name='shop' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.shop.required === false}
                                                            onChange={() =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    shop: {
                                                                        ...prev.shop,
                                                                        required: !prev.shop.required
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div className="ms-1">
                                                        任意
                                                    </div>
                                                </div>
                                                <div className="d-flex align-items-center">
                                                    {!form.shop.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}<input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.shop.text}
                                                        onChange={(e) =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                shop: {
                                                                    ...prev.shop,
                                                                    text: e.target.value
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div>
                                                    <div className="">
                                                        <select style={{ width: '100%', height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', border: '1px solid #D3D3D3' }} name="shop" required>
                                                            <option value="">選択してください</option>
                                                            {form.shop.shopName.map((item, index) =>
                                                                <option key={index}>{item}</option>
                                                            )}
                                                        </select>
                                                    </div>
                                                    <div className="mt-2">
                                                        {form.shop.shopName.map((item, index) =>
                                                            <div className="d-flex align-items-center" key={index} >
                                                                <div style={{ width: '90%' }}>
                                                                    <input type="text" value={item} style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }}
                                                                        onChange={(e) => setForm(prev => {
                                                                            const newShops: string[] = [...prev.shop.shopName];
                                                                            newShops[index] = e.target.value;
                                                                            return {
                                                                                ...prev,
                                                                                shop: {
                                                                                    ...prev.shop,
                                                                                    shopName: newShops
                                                                                }
                                                                            }
                                                                        })
                                                                        } />
                                                                </div>
                                                                <div style={{ width: '10%', marginLeft: '6px' }}>
                                                                    <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
                                                                        onClick={() => setForm(prev => {
                                                                            const newShops: string[] = prev.shop.shopName.filter((_, i) => i !== index);
                                                                            return {
                                                                                ...prev,
                                                                                shop: {
                                                                                    ...prev.shop,
                                                                                    shopName: newShops
                                                                                }
                                                                            }
                                                                        })
                                                                        }>削除</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="d-flex align-items-center">
                                                            <div style={{ width: '90%' }}>
                                                                <input type="text" style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }} value={newShop} onChange={(e) => setNewShop(e.target.value)} />
                                                            </div>
                                                            <div style={{ width: '10%', marginLeft: '6px' }}>
                                                                <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
                                                                    onClick={() => {
                                                                        if (!newShop) return;
                                                                        setForm(prev => {
                                                                            const newShops: string[] = [...prev.shop.shopName];
                                                                            newShops.push(newShop);
                                                                            return {
                                                                                ...prev,
                                                                                shop: {
                                                                                    ...prev.shop,
                                                                                    shopName: newShops
                                                                                }
                                                                            }
                                                                        });
                                                                        setNewShop('');
                                                                    }}>追加</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>来場希望時間</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.date.bool} onChange={() => changeForm('date')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='date' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.date.required === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                date: {
                                                                    ...prev.date,
                                                                    required: !prev.date.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    必須
                                                </div>
                                                <div>
                                                    <input type="radio" name='date' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.date.required === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                date: {
                                                                    ...prev.date,
                                                                    required: !prev.date.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    任意
                                                </div>
                                            </div>
                                            <div className="row">
                                                <div className="col">
                                                    <div className="d-flex align-items-center">
                                                        {!form.date.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.date.text_day}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    date: {
                                                                        ...prev.date,
                                                                        text_day: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div >
                                                        <input type="date" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
                                                    </div>
                                                </div>
                                                <div className="col">
                                                    <div className="d-flex align-items-center">
                                                        {!form.date.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.date.text_time}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    date: {
                                                                        ...prev.date,
                                                                        text_time: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div>
                                                        <select style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} name="time" required aria-label="select example" >
                                                            <option value="">選択してください</option>
                                                            {form.date.time.map((item, index) =>
                                                                <option key={index}>{item}</option>
                                                            )}
                                                        </select>
                                                    </div>
                                                    <div className="mt-2">
                                                        {form.date.time.map((item, index) =>
                                                            <div className="d-flex align-items-center" key={index} >
                                                                <div style={{ width: '70%' }}>
                                                                    <input type="text" value={item} style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }}
                                                                        onChange={(e) => setForm(prev => {
                                                                            const newTimes: string[] = [...prev.date.time];
                                                                            newTimes[index] = e.target.value;
                                                                            return {
                                                                                ...prev,
                                                                                date: {
                                                                                    ...prev.date,
                                                                                    time: newTimes
                                                                                }
                                                                            }
                                                                        })
                                                                        } />
                                                                </div>
                                                                <div style={{ width: '30%', marginLeft: '6px' }}>
                                                                    <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
                                                                        onClick={() => setForm(prev => {
                                                                            const newTimes: string[] = prev.date.time.filter((_, i) => i !== index);
                                                                            return {
                                                                                ...prev,
                                                                                date: {
                                                                                    ...prev.date,
                                                                                    time: newTimes
                                                                                }
                                                                            }
                                                                        })
                                                                        }>削除</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="d-flex align-items-center">
                                                            <div style={{ width: '70%' }}>
                                                                <input type="text" value={newTime} style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }}
                                                                    onChange={(e) => {
                                                                        setNewTime(e.target.value);
                                                                        setForm(prev => {
                                                                            const newTime: string[] = [...prev.date.time];
                                                                            return {
                                                                                ...prev,
                                                                                date: {
                                                                                    ...prev.date,
                                                                                    time: newTime
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                    } />
                                                            </div>
                                                            <div style={{ width: '30%', marginLeft: '6px' }}>
                                                                <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
                                                                    onClick={() => {
                                                                        if (!newTime) return;
                                                                        setForm(prev => {
                                                                            const newTimes: string[] = [...prev.date.time];
                                                                            newTimes.push(newTime);
                                                                            return {
                                                                                ...prev,
                                                                                date: {
                                                                                    ...prev.date,
                                                                                    time: newTimes
                                                                                }
                                                                            }
                                                                        });
                                                                        setNewTime('');
                                                                    }}>追加</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>氏名</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.name.bool} onChange={() => changeForm('name')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='name' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.name.required === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                name: {
                                                                    ...prev.name,
                                                                    required: !prev.name.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    必須
                                                </div>
                                                <div>
                                                    <input type="radio" name='name' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.name.required === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                name: {
                                                                    ...prev.name,
                                                                    required: !prev.name.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    任意
                                                </div>
                                            </div>
                                            <div className="row">
                                                <div className="col">
                                                    <div className="d-flex align-items-center">
                                                        {!form.name.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.name.text_sei}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    name: {
                                                                        ...prev.name,
                                                                        text_sei: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div >
                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
                                                    </div>
                                                </div>
                                                <div className="col">
                                                    <div className="d-flex align-items-center">
                                                        {!form.name.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.name.text_mei}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    name: {
                                                                        ...prev.name,
                                                                        text_mei: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div >
                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>氏名(かな)</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.kana.bool} onChange={() => changeForm('kana')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='kana' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.kana.required === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                kana: {
                                                                    ...prev.kana,
                                                                    required: !prev.kana.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    必須
                                                </div>
                                                <div>
                                                    <input type="radio" name='kana' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.kana.required === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                kana: {
                                                                    ...prev.kana,
                                                                    required: !prev.kana.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    任意
                                                </div>
                                            </div>
                                            <div className="row">
                                                <div className="col">
                                                    <div className="d-flex align-items-center mb-2">
                                                        {!form.kana.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.kana.text_sei}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    kana: {
                                                                        ...prev.kana,
                                                                        text_sei: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div >
                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
                                                    </div>
                                                </div>
                                                <div className="col">
                                                    <div className="d-flex align-items-center mb-2">
                                                        {!form.kana.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.kana.text_mei}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    kana: {
                                                                        ...prev.kana,
                                                                        text_mei: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div >
                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>年齢</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.age.bool} onChange={() => changeForm('age')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='age' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.age.required === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                age: {
                                                                    ...prev.age,
                                                                    required: !prev.age.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    必須
                                                </div>
                                                <div>
                                                    <input type="radio" name='age' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.age.required === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                age: {
                                                                    ...prev.age,
                                                                    required: !prev.age.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    任意
                                                </div>
                                            </div>
                                            <div className="row">
                                                <div className="col">
                                                    <div className="d-flex align-items-center mb-2">
                                                        {!form.age.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.age.text}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    age: {
                                                                        ...prev.age,
                                                                        text: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div >
                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} />
                                                    </div>
                                                </div>
                                                <div className="col">
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>携帯電話</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.phone.bool} onChange={() => changeForm('phone')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='phone' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.phone.required === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                phone: {
                                                                    ...prev.phone,
                                                                    required: !prev.phone.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    必須
                                                </div>
                                                <div>
                                                    <input type="radio" name='phone' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.phone.required === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                phone: {
                                                                    ...prev.phone,
                                                                    required: !prev.phone.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    任意
                                                </div>
                                            </div>
                                            <div>
                                                <div className="d-flex align-items-center mb-2">
                                                    {!form.phone.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.phone.text}
                                                        onChange={(e) =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                phone: {
                                                                    ...prev.phone,
                                                                    text: e.target.value
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div>
                                                    <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{9,}" required />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>メールアドレス</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.mail.bool} onChange={() => changeForm('mail')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='mail' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.mail.required === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                mail: {
                                                                    ...prev.mail,
                                                                    required: !prev.mail.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    必須
                                                </div>
                                                <div>
                                                    <input type="radio" name='mail' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.mail.required === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                mail: {
                                                                    ...prev.mail,
                                                                    required: !prev.mail.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    任意
                                                </div>
                                            </div>
                                            <div>
                                                <div className="d-flex align-items-center mb-2">
                                                    {!form.mail.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.mail.text}
                                                        onChange={(e) =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                mail: {
                                                                    ...prev.mail,
                                                                    text: e.target.value
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div>
                                                    <input type="mail" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{9,}" required />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>住所</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.address.bool} onChange={() => changeForm('address')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='address' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.address.required === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                address: {
                                                                    ...prev.address,
                                                                    required: !prev.address.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    必須
                                                </div>
                                                <div>
                                                    <input type="radio" name='address' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.address.required === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                address: {
                                                                    ...prev.address,
                                                                    required: !prev.address.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    任意
                                                </div>
                                            </div>
                                            <div className="row d-flex align-items-end">
                                                <div className="col">
                                                    <div className="d-flex align-items-center mb-2">
                                                        {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_zip}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    address: {
                                                                        ...prev.address,
                                                                        text_zip: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div >
                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
                                                    </div>
                                                </div>
                                                <div className="col">
                                                    <button type="button" className="btn btn-primary zip_button" id="search_button">郵便番号検索</button>
                                                </div>
                                            </div>
                                            <div className="row mt-2">
                                                <div className="col">
                                                    <div className="d-flex align-items-center mb-2">
                                                        {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_pref}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    address: {
                                                                        ...prev.address,
                                                                        text_pref: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div >
                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
                                                    </div>
                                                </div>
                                                <div className="col">
                                                    <div className="d-flex align-items-center mb-2">
                                                        {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                        <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_city}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    address: {
                                                                        ...prev.address,
                                                                        text_city: e.target.value
                                                                    }
                                                                }))
                                                            } />
                                                    </div>
                                                    <div >
                                                        <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-2">
                                                <div className="d-flex align-items-center mb-2">
                                                    {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_town}
                                                        onChange={(e) =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                address: {
                                                                    ...prev.address,
                                                                    text_town: e.target.value
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div >
                                                    <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
                                                </div>
                                            </div>
                                            <div className="mt-2">
                                                <div className="d-flex align-items-center mb-2">
                                                    {!form.address.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.address.text_street}
                                                        onChange={(e) =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                address: {
                                                                    ...prev.address,
                                                                    text_street: e.target.value
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div >
                                                    <input type="text" style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} pattern="\d{7,}" />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>販促媒体</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.medium.bool} onChange={() => changeForm('medium')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='medium' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.medium.required === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                medium: {
                                                                    ...prev.medium,
                                                                    required: !prev.medium.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    必須
                                                </div>
                                                <div>
                                                    <input type="radio" name='medium' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.medium.required === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                medium: {
                                                                    ...prev.medium,
                                                                    required: !prev.medium.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    任意
                                                </div>
                                            </div>
                                            <div className="col">
                                                <div className="d-flex align-items-center mb-2">
                                                    {!form.medium.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.medium.text}
                                                        onChange={(e) =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                medium: {
                                                                    ...prev.medium,
                                                                    text: e.target.value
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div>
                                                    <select style={{ height: '40px', borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} name="time" required aria-label="select example" >
                                                        <option value="">選択してください</option>
                                                        {form.medium.mediumName.map((item, index) =>
                                                            <option key={index}>{item}</option>)}
                                                    </select>
                                                    <div className="mt-2">
                                                        {form.medium.mediumName.map((item, index) =>
                                                            <div className="d-flex align-items-center" key={index} >
                                                                <div style={{ width: '90%' }}>
                                                                    <input type="text" value={item} style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }}
                                                                        onChange={(e) => setForm(prev => {
                                                                            const newMediums: string[] = [...prev.medium.mediumName];
                                                                            newMediums[index] = e.target.value;
                                                                            return {
                                                                                ...prev,
                                                                                medium: {
                                                                                    ...prev.shop,
                                                                                    mediumName: newMediums
                                                                                }
                                                                            }
                                                                        })
                                                                        } />
                                                                </div>
                                                                <div style={{ width: '10%', marginLeft: '6px' }}>
                                                                    <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
                                                                        onClick={() => setForm(prev => {
                                                                            const newMediums: string[] = prev.medium.mediumName.filter((_, i) => i !== index);
                                                                            return {
                                                                                ...prev,
                                                                                medium: {
                                                                                    ...prev.medium,
                                                                                    mediumName: newMediums
                                                                                }
                                                                            }
                                                                        })
                                                                        }>削除</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="d-flex align-items-center">
                                                            <div style={{ width: '90%' }}>
                                                                <input type="text" placeholder="新たに販促媒体を追加する際は必ずご相談ください" style={{ width: '100%', height: '30px', borderRadius: '2px', fontSize: '12px', letterSpacing: '.7px', marginBottom: '2px', border: '1px solid #D3D3D3' }} value={newMedium} onChange={(e) => setNewMedium(e.target.value)} />
                                                            </div>
                                                            <div style={{ width: '10%', marginLeft: '6px' }}>
                                                                <button style={{ backgroundColor: '#DDD', borderRadius: '4px', border: 'none' }}
                                                                    onClick={() => {
                                                                        if (!newMedium) return;
                                                                        setForm(prev => {
                                                                            const newMediums: string[] = [...prev.medium.mediumName];
                                                                            newMediums.push(newMedium);
                                                                            return {
                                                                                ...prev,
                                                                                medium: {
                                                                                    ...prev.shop,
                                                                                    mediumName: newMediums
                                                                                }
                                                                            }
                                                                        });
                                                                        setNewMedium('');
                                                                    }}>追加</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>質問・要望</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.question.bool} onChange={() => changeForm('question')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='question' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.question.required === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                question: {
                                                                    ...prev.question,
                                                                    required: !prev.question.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    必須
                                                </div>
                                                <div>
                                                    <input type="radio" name='question' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.question.required === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                question: {
                                                                    ...prev.question,
                                                                    required: !prev.question.required
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    任意
                                                </div>
                                            </div>
                                            <div className="col">
                                                <div className="d-flex align-items-center mb-2">
                                                    {!form.question.required || <div style={{ backgroundColor: 'red', width: 'fit-content', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '7px', marginRight: '3px' }}>必須</div>}
                                                    <input type="text" style={{ width: '80%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px' }} value={form.question.text}
                                                        onChange={(e) =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                question: {
                                                                    ...prev.question,
                                                                    text: e.target.value
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div>
                                                    <textarea style={{ borderRadius: '7px', fontSize: '14px', letterSpacing: '.7px', width: '100%', border: '1px solid #D3D3D3' }} cols={5}></textarea>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr style={{ fontSize: '13px', verticalAlign: 'middle' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <div>注意事項</div><div style={{ marginLeft: '75px' }}><input type="checkbox" className="ms-2 form-check" style={{ width: '20px', margin: '0 auto' }} checked={form.attention.bool} onChange={() => changeForm('attention')} /></div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center mb-2">
                                                <div>
                                                    <input type="radio" name='attention' style={{ transform: 'scale(1.3)', cursor: 'pointer' }} checked={form.attention.bool_red === true}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                attention: {
                                                                    ...prev.attention,
                                                                    bool_red: !prev.attention.bool_red
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    特典進呈条件を表示
                                                </div>
                                                <div>
                                                    <input type="radio" name='attention' style={{ transform: 'scale(1.3)', cursor: 'pointer', marginLeft: '20px' }} checked={form.attention.bool_red === false}
                                                        onChange={() =>
                                                            setForm(prev => ({
                                                                ...prev,
                                                                attention: {
                                                                    ...prev.attention,
                                                                    bool_red: !prev.attention.bool_red
                                                                }
                                                            }))
                                                        } />
                                                </div>
                                                <div className="ms-1">
                                                    特典進呈条件を非表示
                                                </div>
                                            </div>
                                            <div className="col">
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#fff', backgroundColor: 'gray', letterSpacing: '.7px', textAlign: 'justify', padding: '10px', borderRadius: '10px' }}>
                                                        <textarea value={form.attention.text} style={{ width: '100%', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px', backgroundColor: 'transparent', color: '#fff' }} rows={5}
                                                            onChange={(e) =>
                                                                setForm(prev => ({
                                                                    ...prev,
                                                                    attention: {
                                                                        ...prev.attention,
                                                                        text: e.target.value
                                                                    }
                                                                }))
                                                            }></textarea>
                                                    </div>
                                                    {!form.attention.bool_red || <>
                                                        <div style={{ fontSize: '14px', color: '#fff', backgroundColor: 'black', letterSpacing: '.7px', textAlign: 'justify', padding: '10px 20px', borderRadius: '10px', width: 'fit-content', margin: '20px auto', cursor: 'pointer', textDecoration: 'none' }}
                                                            onClick={() => {
                                                                const modal = document.querySelector('#modal') as HTMLElement;
                                                                modal.style.display = 'block'
                                                            }}>特典進呈条件を見る</div>
                                                        <div style={{ display: 'none', position: 'fixed', zIndex: '1000', top: '0', left: '0', backgroundColor: '#42424277', width: '100vw', height: '100vh' }} id='modal'>
                                                            <div style={{ backgroundColor: '#fff', width: '90%', maxWidth: '560px', margin: '20vh auto', padding: '20px', borderRadius: '10px' }}>
                                                                <div style={{ color: 'red', lineHeight: '20px' }}>
                                                                    <span style={{ fontWeight: 'bold' }}>【来場予約特典条件】</span>
                                                                    <textarea value={form.attention.text_red} style={{ width: '100%', border: '1px solid #D3D3D3', borderRadius: '7px', fontSize: '12px', letterSpacing: '.7px', color: 'red' }} rows={20}
                                                                        onChange={(e) =>
                                                                            setForm(prev => ({
                                                                                ...prev,
                                                                                attention: {
                                                                                    ...prev.attention,
                                                                                    text_red: e.target.value
                                                                                }
                                                                            }))
                                                                        }></textarea>
                                                                </div>
                                                                <div style={{ fontSize: '14px', color: '#fff', backgroundColor: 'black', letterSpacing: '.7px', textAlign: 'justify', padding: '10px 20px', borderRadius: '10px', width: 'fit-content', margin: '20px auto', cursor: 'pointer', textDecoration: 'none' }}
                                                                    onClick={() => {
                                                                        const modal = document.querySelector('#modal') as HTMLElement;
                                                                        modal.style.display = 'none'
                                                                    }}>閉じる</div>
                                                            </div>
                                                        </div></>}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default NewCampaign