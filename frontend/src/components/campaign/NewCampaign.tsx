import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { fetchDetail, fetchMaster, insertCampaign, updateCampaign } from './campaignApi';
import { PLACEHOLDERS, unknownPlaceholders } from './mailTemplateFields';
import FormPreview from './formPreview';
import { brandLogo } from './brands';
import './newCampaign.css';

/** プレビュー（formPreview.tsx）も使う */
export type FormState = {
    brand: string;
    campaign: string;
    campaign_id: string;
    mail_to: string;
    mail_cc: string;
    redirect: string;
    thanks: boolean;
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
    /** ⚠️ 列が無い古い応答・壊れた値は LINE_ID_DEFAULT で受ける（parseLineId） */
    line_id: {
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
};

type Response = { status: string; message: string }

/** ⚠️ DB の列の既定値（2026-10-12_line_id_columns.sql）と同じにすること */
const LINE_ID_DEFAULT: FormState['line_id'] = {
    bool: true,
    required: false,
    text: 'LINE IDをご入力ください',
};

/** line_id 列の値を読む。⚠️ 無い・壊れている・型が違う値は既定で埋める */
const parseLineId = (value: unknown): FormState['line_id'] => {
    if (typeof value !== 'string' || value === '') return LINE_ID_DEFAULT;
    try {
        const parsed: unknown = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
            const { bool, required, text } = parsed as Record<string, unknown>;
            return {
                bool: typeof bool === 'boolean' ? bool : LINE_ID_DEFAULT.bool,
                required: typeof required === 'boolean' ? required : LINE_ID_DEFAULT.required,
                text: typeof text === 'string' ? text : LINE_ID_DEFAULT.text,
            };
        }
    } catch {
        console.error(`LINE ID の設定を読めませんでした: ${String(value).slice(0, 80)}`);
    }
    return LINE_ID_DEFAULT;
};

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
        line_id: LINE_ID_DEFAULT,
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
    const [validation, setValidation] = useState<string[]>([]);
    /**
     * ⚠️ 設定を読めなかったことを画面に出すため。
     *   ⚠️ 2026-09-16 まで、読めなくても**何も出ず**、
     *     利用者には「修正を押したのに反映されない」としか見えなかった。
     */
    const [loadError, setLoadError] = useState<string>('');

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
                        line_id: parseLineId(row.line_id),
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
                        line_id: parseLineId(response.data.line_id),
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
            <div className="nc-template">
                <div className="nc-template-head">
                    <span className="nc-hint">{note}</span>
                    <span className={`nc-tag ${isDefault ? 'nc-tag-default' : 'nc-tag-custom'}`}>
                        {isDefault ? '既定の文面' : 'このキャンペーン専用'}
                    </span>
                    {isDefault ||
                        <button type="button" className="nc-btn nc-btn-ghost nc-btn-xs"
                            onClick={() => { changeTemplate(subjectKey, ''); changeTemplate(bodyKey, ''); }}>
                            既定に戻す
                        </button>}
                </div>

                <input type="text" className="nc-input" value={subject}
                    placeholder="件名（空欄なら既定）" aria-label={`${note} 件名`}
                    onChange={(e) => changeTemplate(subjectKey, e.target.value)} />

                <textarea className="nc-textarea" value={body} rows={8}
                    placeholder="本文（空欄なら既定の文面が送られます）" aria-label={`${note} 本文`}
                    onChange={(e) => changeTemplate(bodyKey, e.target.value)} />

                {unknown.length === 0 ||
                    <p className="nc-warn">
                        {`差し込めない語があります：${unknown.map(k => `{{${k}}}`).join(' ')}`}
                        <span className="ms-1">そのまま本文に出ます。</span>
                    </p>}

                <details className="nc-details">
                    <summary>使える差し込み語</summary>
                    <div className="nc-placeholders">
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
            // ⚠️ v2.2.223: `/campaign/?…` と末尾に / を付けない（再読み込みで ./static の場所がずれて真っ白になる。App.tsx の注記）
            navigate(`/campaign?brand=${form.brand}`);
        }
    }, [response])

    /** 項目の設定の一部だけを書き換える。⚠️ 表示・必須を切り替えても見出しなど他の設定は残す */
    type ItemKey = 'shop' | 'date' | 'name' | 'kana' | 'age' | 'phone' | 'mail' | 'line_id' | 'address' | 'medium' | 'question';
    const patch = <K extends ItemKey | 'notice' | 'attention'>(key: K, value: Partial<FormState[K]>) =>
        setForm(prev => ({ ...prev, [key]: { ...prev[key], ...value } }));

    /** 項目の行（表示する ／ 必須・任意）。⚠️ 中身は children */
    const item = (key: ItemKey, title: string, children: React.ReactNode, hiddenChildren?: React.ReactNode) => (
        <FieldItem
            key={key}
            title={title}
            shown={form[key].bool}
            onShown={(v) => patch(key, { bool: v })}
            required={form[key].required}
            onRequired={(v) => patch(key, { required: v })}
            hiddenChildren={hiddenChildren}
        >
            {children}
        </FieldItem>
    );

    const isEdit = Boolean(idValue);
    const backToList = () => navigate(`/campaign?brand=${brandValue ?? ''}`);

    return (
        <div className="nc">
            <header className="nc-header">
                <img className="nc-header-logo" src={brandLogo(brandValue)} alt="" />
                <div>
                    <p className="nc-crumb">キャンペーン一覧 ／ {isEdit ? '修正' : '新規作成'}</p>
                    <h1 className="nc-title">{isEdit ? 'キャンペーン修正' : 'キャンペーン作成'}</h1>
                </div>
                <div className="nc-header-actions">
                    <button type="button" className="nc-btn" onClick={backToList}>
                        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>一覧へ戻る
                    </button>
                </div>
            </header>

            {/**
              * ⚠️⚠️ **読み込めなかったことを必ず画面に出す。**
              *   ⚠️ 出さないと「修正を押したのに反映されない」としか見えず、
              *     利用者にも受けた側にも原因が分からない。
              */}
            {!loadError ||
                <div className="nc-alert" role="alert">
                    {loadError}
                    <small>このまま保存すると内容が上書きされます。一覧に戻ってやり直してください。</small>
                </div>}

            <div className="nc-layout">
                <div className="nc-main">
                    {/* ---- 基本情報 ---- */}
                    <section className="nc-card" aria-labelledby="nc-basic">
                        <div className="nc-card-head">
                            <h2 className="nc-card-title" id="nc-basic">基本情報</h2>
                            <p className="nc-card-desc">キャンペーン名は反響メールの件名になります</p>
                        </div>
                        <div className="nc-card-body">
                            <TextField id="campaign" label="キャンペーン名" required value={form.campaign}
                                placeholder="例）20**【KH**】****キャンペーン"
                                error={validation.includes('campaign') ? 'キャンペーン名が未入力です' : ''}
                                onChange={(v) => changeForm('campaign', v)} />
                            <TextField id="campaign_id" label="キャンペーンID" required value={form.campaign_id} disabled={isEdit}
                                placeholder="例）20**0101_kh**_***campaign"
                                hint={isEdit ? '登録後は変更できません' : '重複不可・半角英数のみ'}
                                error={validation.includes('campaign_id') ? 'キャンペーンIDが未入力です' : ''}
                                onChange={(v) => changeForm('campaign_id', v)} />
                            <TextField id="redirect" label="送信後に表示するページ（リダイレクトURL）" required value={form.redirect}
                                placeholder="https://"
                                error={validation.includes('redirect') ? 'リダイレクトURLが未入力です' : ''}
                                onChange={(v) => changeForm('redirect', v)} />
                        </div>
                    </section>

                    {/* ---- 通知・メール ---- */}
                    <section className="nc-card" aria-labelledby="nc-mail">
                        <div className="nc-card-head">
                            <h2 className="nc-card-title" id="nc-mail">通知とメール</h2>
                            <p className="nc-card-desc">反響が届いたときの社内通知と、お客様へのサンクスメール</p>
                        </div>
                        <div className="nc-card-body">
                            <div className="nc-grid-2">
                                <TextField id="mail_to" label="反響アドレス（To）" required value={form.mail_to}
                                    error={validation.includes('mail_to') ? '反響アドレス(To)が未入力です' : ''}
                                    onChange={(v) => changeForm('mail_to', v)} />
                                <TextField id="mail_cc" label="反響アドレス（Cc）" required value={form.mail_cc}
                                    error={validation.includes('mail_cc') ? '反響アドレス(Cc)が未入力です' : ''}
                                    onChange={(v) => changeForm('mail_cc', v)} />
                            </div>
                            <div className="nc-field">
                                <span className="nc-label">サンクスメール</span>
                                <Segmented value={form.thanks} trueLabel="送る" falseLabel="送らない"
                                    onChange={(v) => setForm(prev => ({ ...prev, thanks: v }))} />
                            </div>
                            <div className="nc-field">
                                <span className="nc-label">サンクスメールの文面</span>
                                {mailTemplateEditor('thanks_subject', 'thanks_body', 'お客様へ届くメールです。')}
                            </div>
                            <div className="nc-field">
                                <span className="nc-label">通知メールの文面</span>
                                {mailTemplateEditor('internal_subject', 'internal_body', '社内（反響アドレス）へ届くメールです。')}
                            </div>
                        </div>
                    </section>

                    {/* ---- フォームの冒頭 ---- */}
                    <section className="nc-card" aria-labelledby="nc-notice">
                        <div className="nc-card-head">
                            <h2 className="nc-card-title" id="nc-notice">フォーム冒頭の案内文</h2>
                            <p className="nc-card-desc">入力欄の上に表示されます</p>
                            <div className="nc-card-head-actions">
                                <Switch checked={form.notice.bool} label="表示する" onChange={(v) => patch('notice', { bool: v })} />
                            </div>
                        </div>
                        {!form.notice.bool ||
                            <div className="nc-card-body">
                                <textarea className="nc-textarea" rows={4} value={form.notice.text} aria-label="案内文"
                                    onChange={(e) => patch('notice', { text: e.target.value })} />
                            </div>}
                    </section>

                    {/* ---- フォーム項目 ---- */}
                    <section className="nc-card" aria-labelledby="nc-items">
                        <div className="nc-card-head">
                            <h2 className="nc-card-title" id="nc-items">フォーム項目</h2>
                            <p className="nc-card-desc">項目ごとに表示・必須・見出しの文言を設定します</p>
                        </div>
                        <div className="nc-items">
                            {item('shop', '来場希望場所', <>
                                <TextField label="見出し" value={form.shop.text} onChange={(v) => patch('shop', { text: v })} />
                                <div className="nc-field">
                                    <span className="nc-label">選択肢</span>
                                    <OptionList items={form.shop.shopName} placeholder="店舗名を追加"
                                        onChange={(items) => patch('shop', { shopName: items })} />
                                </div>
                            </>,
                                /**
                                 * ⚠️⚠️ **聞かないときは、代わりに入れておく値を選ばせる**（2026-09-16 の指示）。
                                 *   ⚠️ 候補は「選択肢」をそのまま使う。**別に持たせない**。
                                 */
                                <div className="nc-field">
                                    <span className="nc-label">聞かない代わりに、この値で登録する</span>
                                    <select className="nc-select" style={{ maxWidth: '360px' }} value={form.shop.default ?? ''}
                                        onChange={(e) => patch('shop', { default: e.target.value })}>
                                        <option value="">指定しない</option>
                                        {form.shop.shopName.map((s, i) => <option key={i} value={s}>{s}</option>)}
                                    </select>
                                    {form.shop.shopName.length > 0 || <p className="nc-hint">選択肢がまだありません。表示をオンにして追加すると選べます。</p>}
                                </div>)}
                            {item('date', '来場希望日時', <>
                                <div className="nc-grid-2">
                                    <TextField label="見出し（日付）" value={form.date.text_day} onChange={(v) => patch('date', { text_day: v })} />
                                    <TextField label="見出し（時間）" value={form.date.text_time} onChange={(v) => patch('date', { text_time: v })} />
                                </div>
                                <div className="nc-field">
                                    <span className="nc-label">時間の選択肢</span>
                                    <OptionList items={form.date.time} placeholder="例）10:00〜"
                                        onChange={(items) => patch('date', { time: items })} />
                                </div>
                            </>)}
                            {item('name', '氏名', <div className="nc-grid-2">
                                <TextField label="見出し（姓）" value={form.name.text_sei} onChange={(v) => patch('name', { text_sei: v })} />
                                <TextField label="見出し（名）" value={form.name.text_mei} onChange={(v) => patch('name', { text_mei: v })} />
                            </div>)}
                            {item('kana', '氏名（かな）', <div className="nc-grid-2">
                                <TextField label="見出し（セイ）" value={form.kana.text_sei} onChange={(v) => patch('kana', { text_sei: v })} />
                                <TextField label="見出し（メイ）" value={form.kana.text_mei} onChange={(v) => patch('kana', { text_mei: v })} />
                            </div>)}
                            {item('age', '年齢', <TextField label="見出し" value={form.age.text} onChange={(v) => patch('age', { text: v })} />)}
                            {item('phone', '携帯電話', <TextField label="見出し" value={form.phone.text} onChange={(v) => patch('phone', { text: v })} />)}
                            {item('mail', 'メールアドレス', <TextField label="見出し" value={form.mail.text} onChange={(v) => patch('mail', { text: v })} />)}
                            {item('line_id', 'LINE ID', <>
                                <TextField label="見出し" value={form.line_id.text} onChange={(v) => patch('line_id', { text: v })} />
                                <p className="nc-hint">入力された LINE ID は反響・顧客に保存され、通知メールとサンクスメールの「お問い合わせ内容」にも載ります。</p>
                            </>)}
                            {item('address', '住所', <>
                                <div className="nc-grid-2">
                                    <TextField label="見出し（郵便番号）" value={form.address.text_zip} onChange={(v) => patch('address', { text_zip: v })} />
                                    <TextField label="見出し（都道府県）" value={form.address.text_pref} onChange={(v) => patch('address', { text_pref: v })} />
                                    <TextField label="見出し（市区）" value={form.address.text_city} onChange={(v) => patch('address', { text_city: v })} />
                                    <TextField label="見出し（町村）" value={form.address.text_town} onChange={(v) => patch('address', { text_town: v })} />
                                </div>
                                <TextField label="見出し（番地・建物）" value={form.address.text_street} onChange={(v) => patch('address', { text_street: v })} />
                            </>)}
                            {item('medium', '販促媒体（ご予約のきっかけ）', <>
                                <TextField label="見出し" value={form.medium.text} onChange={(v) => patch('medium', { text: v })} />
                                <div className="nc-field">
                                    <span className="nc-label">選択肢</span>
                                    <OptionList items={form.medium.mediumName} placeholder="新たに販促媒体を追加する際は必ずご相談ください"
                                        onChange={(items) => patch('medium', { mediumName: items })} />
                                </div>
                            </>)}
                            {item('question', '質問・要望', <TextField label="見出し" value={form.question.text} onChange={(v) => patch('question', { text: v })} />)}
                        </div>
                    </section>

                    {/* ---- 注意事項・特典条件 ---- */}
                    <section className="nc-card" aria-labelledby="nc-attention">
                        <div className="nc-card-head">
                            <h2 className="nc-card-title" id="nc-attention">注意事項と特典条件</h2>
                            <p className="nc-card-desc">送信ボタンの上に表示されます</p>
                            <div className="nc-card-head-actions">
                                <Switch checked={form.attention.bool} label="表示する" onChange={(v) => patch('attention', { bool: v })} />
                            </div>
                        </div>
                        {!form.attention.bool ||
                            <div className="nc-card-body">
                                <div className="nc-field">
                                    <span className="nc-label">注意事項</span>
                                    <textarea className="nc-textarea" rows={4} value={form.attention.text}
                                        onChange={(e) => patch('attention', { text: e.target.value })} />
                                </div>
                                <div className="nc-field">
                                    <span className="nc-label">特典進呈条件</span>
                                    <Segmented value={form.attention.bool_red} trueLabel="表示する" falseLabel="表示しない"
                                        onChange={(v) => patch('attention', { bool_red: v })} />
                                </div>
                                {!form.attention.bool_red ||
                                    <div className="nc-field">
                                        <span className="nc-label">特典進呈条件の本文（「特典進呈条件を見る」で表示）</span>
                                        <textarea className="nc-textarea" rows={10} value={form.attention.text_red} style={{ color: '#c62828' }}
                                            onChange={(e) => patch('attention', { text_red: e.target.value })} />
                                    </div>}
                            </div>}
                    </section>
                </div>

                {/* ---- プレビュー ---- */}
                <aside className="nc-preview" aria-label="公開フォームのプレビュー">
                    <div className="nc-preview-head">
                        <span><i className="fa-regular fa-eye me-1" aria-hidden="true"></i>プレビュー（公開フォーム）</span>
                        <span className="nc-chip">入力すると反映</span>
                    </div>
                    <div className="nc-preview-body">
                        <FormPreview form={form} brand={String(brandValue ?? '')} />
                    </div>
                </aside>
            </div>

            <div className="nc-savebar">
                <div className="nc-savebar-inner">
                    <p className="nc-savebar-note">
                        {validation.length > 0
                            ? <span style={{ color: '#d93a4a', fontWeight: 600 }}>{validation.length}個の未入力項目があります</span>
                            : '保存すると公開中のフォームにすぐ反映されます'}
                    </p>
                    <button type="button" className="nc-btn" onClick={backToList}>キャンセル</button>
                    <button type="button" className="nc-btn nc-btn-primary" onClick={() => postForm()}>
                        {isEdit ? '修正を保存する' : 'キャンペーンを登録する'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// ⚠️⚠️ ここから下の部品は ⚠️ **NewCampaign の外に置くこと**（中に書くと描画のたびに作り直され、入力中にカーソルが外れる）。
// ---------------------------------------------------------------------------

/** オン・オフ（表示する／しない） */
const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button type="button" role="switch" aria-checked={checked} className="nc-switch" onClick={() => onChange(!checked)}>
        <span className="nc-switch-track" aria-hidden="true"></span>
        {label}
    </button>
);

/** 2択（必須／任意、送る／送らない など） */
const Segmented = ({ value, onChange, trueLabel, falseLabel, disabled }: {
    value: boolean; onChange: (v: boolean) => void; trueLabel: string; falseLabel: string; disabled?: boolean;
}) => (
    <div className="nc-seg" role="group">
        <button type="button" aria-pressed={value} disabled={disabled} onClick={() => onChange(true)}>{trueLabel}</button>
        <button type="button" aria-pressed={!value} disabled={disabled} onClick={() => onChange(false)}>{falseLabel}</button>
    </div>
);

/** 1行の入力欄（見出し・必須の印・エラー・補足つき） */
const TextField = ({ id, label, value, onChange, required, placeholder, error, hint, disabled }: {
    id?: string; label: string; value: string; onChange: (v: string) => void;
    required?: boolean; placeholder?: string; error?: string; hint?: string; disabled?: boolean;
}) => (
    <div className="nc-field" data-invalid={error ? '1' : '0'}>
        <label className="nc-label" htmlFor={id}>{label}{!required || <span className="nc-req">必須</span>}</label>
        <input id={id} type="text" className="nc-input" value={value ?? ''} placeholder={placeholder} disabled={disabled}
            onChange={(e) => onChange(e.target.value)} />
        {!hint || error || <p className="nc-hint">{hint}</p>}
        {!error || <p className="nc-error" role="alert">{error}</p>}
    </div>
);

/** フォーム項目の1行（表示する／必須・任意 ＋ 中身）。⚠️ 表示しないときは hiddenChildren だけ出す */
const FieldItem = ({ title, shown, onShown, required, onRequired, children, hiddenChildren }: {
    title: string; shown: boolean; onShown: (v: boolean) => void;
    required: boolean; onRequired: (v: boolean) => void;
    children: React.ReactNode; hiddenChildren?: React.ReactNode;
}) => (
    <div className="nc-item" data-shown={shown ? '1' : '0'}>
        <div className="nc-item-head">
            <h3 className="nc-item-name">{title}</h3>
            <div className="nc-item-controls">
                <Segmented value={required} trueLabel="必須" falseLabel="任意" onChange={onRequired} disabled={!shown} />
                <Switch checked={shown} label="表示" onChange={onShown} />
            </div>
        </div>
        {shown
            ? <div className="nc-item-body">{children}</div>
            : !hiddenChildren || <div className="nc-item-body">{hiddenChildren}</div>}
    </div>
);

/** 選択肢の一覧（来場希望場所・時間・販促媒体）。編集・削除・追加。追加欄の文字はこの部品が持つ */
const OptionList = ({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) => {
    const [draft, setDraft] = useState('');
    const add = () => {
        const value = draft.trim();
        if (!value) return;
        onChange([...items, value]);
        setDraft('');
    };
    return (
        <div className="nc-options">
            {items.map((value, index) => (
                <div className="nc-option" key={index}>
                    <input type="text" className="nc-input" value={value} aria-label={`選択肢 ${index + 1}`}
                        onChange={(e) => onChange(items.map((v, i) => (i === index ? e.target.value : v)))} />
                    <button type="button" className="nc-btn nc-btn-danger-text" aria-label={`${value} を削除`}
                        onClick={() => onChange(items.filter((_, i) => i !== index))}>
                        <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
                    </button>
                </div>
            ))}
            <div className="nc-option">
                <input type="text" className="nc-input" value={draft} placeholder={placeholder}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
                <button type="button" className="nc-btn" onClick={add} disabled={!draft.trim()}>
                    <i className="fa-solid fa-plus" aria-hidden="true"></i>追加
                </button>
            </div>
        </div>
    );
};

export default NewCampaign