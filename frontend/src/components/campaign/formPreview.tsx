import React from 'react';
import type { FormState } from './NewCampaign';
import './formPreview.css';

/**
 * 「キャンペーン作成」の右側のプレビュー。公開フォーム（react/form_get の Form.tsx）の写しで、入力はできない。
 * ⚠️⚠️ **公開フォームの項目のまとまり・並びを変えたら、ここも揃えること**（揃えないとプレビューと実物が食い違う）。
 * ⚠️ 見た目は formPreview.css（publicForm.css の写し）。ロゴと差し色は form_get の src/api/brands.ts と同じ。
 */

const LOGO: Record<string, string> = {
    kh: 'https://kh-house.jp/wp-content/themes/kokubu/img/index/imgHeaderLogo_top.png?221028',
    djh: 'https://day-just-house.com/wp/wp-content/themes/dayjusthouse/assets/img/pc/header_logo.png',
    nagomi: 'https://www.nagomi-koumuten.jp/wp-content/themes/nagomi/img/movie/imgHeaderLogo.png',
    fh: 'https://furukomi-home.com/data/wp-content/themes/cms/images/header_logo.png?v=20210608',
    '2l': 'https://2lhome.net/wp-content/uploads/2025/08/brand-logo.png',
    pg: 'https://miyazaki.pg-house.jp/img/logo.webp',
    jh: 'https://jusfy-home.com/lp/assets/logo-Lleu0Agz.png',
    // ⚠️ v2.2.204〜 khg だけはダッシュボードの /dashboard/img/（frontend/public/img/khg.png）。以前は kh-house.jp/khg/form/img/khg.png
    khg: 'https://khg-marketing.info/dashboard/img/khg.png',
};

const ACCENT: Record<string, string> = {
    kh: '#0f3675',
    djh: '#1d8a94',
    nagomi: '#956134',
    '2l': '#0b8659',
    jh: '#dc4235',
    fh: '#cd3c33',
    pg: '#1a1a1a',
    khf: '#0d6d4b',
    khg: '#0f3675',
};

const previewAccent = (brand: string): string => ACCENT[brand.trim()] ?? '#0f3675';

/** ⚠️ 差し色は CSS 変数で渡す（formPreview.css が var(--pf-accent) で使う） */
type AccentStyle = React.CSSProperties & { '--pf-accent': string };

const Badge = ({ required }: { required: boolean }) => required
    ? <span className="pf-badge pf-badge-req">必須</span>
    : <span className="pf-badge pf-badge-opt">任意</span>;

/** 項目1つ（見るだけ）。⚠️ 公開フォームの Field と同じ形 */
const PreviewField = ({ label, required, children }: { label: string; required: boolean; children: React.ReactNode }) => (
    <div className="pf-field">
        <span className="pf-label"><Badge required={required} /><span>{label || '（見出し未入力）'}</span></span>
        {children}
    </div>
);

const Input = ({ placeholder, className = '' }: { placeholder?: string; className?: string }) =>
    <input className={`pf-input ${className}`.trim()} readOnly tabIndex={-1} placeholder={placeholder} />;

const Select = ({ options }: { options: string[] }) => (
    <select className="pf-select" tabIndex={-1} defaultValue="">
        <option value="">選択してください</option>
        {options.map((o, i) => <option key={i}>{o}</option>)}
    </select>
);

type Props = { form: FormState; brand: string };

const FormPreview = ({ form, brand }: Props) => {
    const visitShown = form.shop.bool || form.date.bool;
    const personShown = form.name.bool || form.kana.bool || form.age.bool;
    const contactShown = form.phone.bool || form.mail.bool || form.line_id.bool;
    const otherShown = form.medium.bool || form.question.bool;
    const logo = LOGO[brand.trim()] ?? '';
    const style: AccentStyle = { '--pf-accent': previewAccent(brand), padding: '20px 14px 28px' };

    return (
        <div className="pf" style={style}
            aria-label="公開フォームのプレビュー">
            {!logo || <div className="pf-logo"><img src={logo} alt="" /></div>}
            <ol className="pf-steps" aria-hidden="true">
                <li aria-current="step"><span className="pf-step-num">1</span>入力</li>
                <li><span className="pf-step-num">2</span>確認</li>
                <li><span className="pf-step-num">3</span>完了</li>
            </ol>
            {!form.notice.bool || !form.notice.text || <p className="pf-lead">{form.notice.text}</p>}

            {!visitShown ||
                <section className="pf-card">
                    <h2 className="pf-card-title">ご来場について</h2>
                    {!form.shop.bool ||
                        <PreviewField label={form.shop.text} required={form.shop.required}><Select options={form.shop.shopName} /></PreviewField>}
                    {!form.date.bool ||
                        <div className="pf-row pf-row-2">
                            <PreviewField label={form.date.text_day} required={form.date.required}><Input className="pf-date" /></PreviewField>
                            <PreviewField label={form.date.text_time} required={form.date.required}><Select options={form.date.time} /></PreviewField>
                        </div>}
                </section>}

            {!personShown ||
                <section className="pf-card">
                    <h2 className="pf-card-title">お客様情報</h2>
                    {!form.name.bool ||
                        <div className="pf-row pf-row-2">
                            <PreviewField label={form.name.text_sei} required={form.name.required}><Input /></PreviewField>
                            <PreviewField label={form.name.text_mei} required={form.name.required}><Input /></PreviewField>
                        </div>}
                    {!form.kana.bool ||
                        <div className="pf-row pf-row-2">
                            <PreviewField label={form.kana.text_sei} required={form.kana.required}><Input /></PreviewField>
                            <PreviewField label={form.kana.text_mei} required={form.kana.required}><Input /></PreviewField>
                        </div>}
                    {!form.age.bool ||
                        <div className="pf-row pf-row-2">
                            <PreviewField label={form.age.text} required={form.age.required}><Input /></PreviewField>
                        </div>}
                </section>}

            {!contactShown ||
                <section className="pf-card">
                    <h2 className="pf-card-title">ご連絡先</h2>
                    {!form.phone.bool || <PreviewField label={form.phone.text} required={form.phone.required}><Input /></PreviewField>}
                    {!form.mail.bool || <PreviewField label={form.mail.text} required={form.mail.required}><Input /></PreviewField>}
                    {!form.line_id.bool || <PreviewField label={form.line_id.text} required={form.line_id.required}><Input /></PreviewField>}
                </section>}

            {!form.address.bool ||
                <section className="pf-card">
                    <h2 className="pf-card-title">ご住所</h2>
                    <PreviewField label={form.address.text_zip} required={form.address.required}>
                        <div className="pf-inline"><Input /><span className="pf-btn" aria-hidden="true">住所を検索</span></div>
                    </PreviewField>
                    <div className="pf-row pf-row-2">
                        <PreviewField label={form.address.text_pref} required={form.address.required}><Input /></PreviewField>
                        <PreviewField label={form.address.text_city} required={form.address.required}><Input /></PreviewField>
                    </div>
                    <PreviewField label={form.address.text_town} required={form.address.required}><Input /></PreviewField>
                    <PreviewField label={form.address.text_street} required={form.address.required}><Input /></PreviewField>
                </section>}

            {!otherShown ||
                <section className="pf-card">
                    <h2 className="pf-card-title">その他</h2>
                    {!form.medium.bool || <PreviewField label={form.medium.text} required={form.medium.required}><Select options={form.medium.mediumName} /></PreviewField>}
                    {!form.question.bool || <PreviewField label={form.question.text} required={form.question.required}><textarea className="pf-textarea" readOnly tabIndex={-1} rows={3} /></PreviewField>}
                </section>}

            {!form.attention.bool ||
                <div className="pf-card">
                    {!form.attention.text || <p className="pf-note">{form.attention.text}</p>}
                    {!form.attention.bool_red ||
                        <div style={{ display: 'flex', justifyContent: 'center' }}><span className="pf-btn" aria-hidden="true">特典進呈条件を見る</span></div>}
                </div>}

            <div className="pf-actions">
                <span className="pf-btn pf-btn-primary" aria-hidden="true">入力内容の確認へ進む</span>
            </div>
        </div>
    );
};

export default FormPreview;
