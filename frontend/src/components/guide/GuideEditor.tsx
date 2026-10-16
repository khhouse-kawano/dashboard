import React, { useState } from 'react';
import apiClient from '../../utils/apiClient';
import GuideMarkdown from './GuideMarkdown';
import { GUIDE_COMMON } from './openGuide';
import { GUIDE_SCREENS } from './guideScreens';

/**
 * 業務ガイドの記事を作る・直す画面（v2.2.194）。⚠️ Master / BrandAdmin だけに出す（Guide.tsx）。
 *
 * ⚠️ 権限の最終判定は ②（features/guide.ts の saveGuide）が行う。⚠️ ここで隠すのは見た目のためだけ。
 * ⚠️ 保存すると、直前の内容が変更履歴に残る（② 側）。
 */

export interface GuideDraft {
    id: number | null;
    title: string;
    /** 事業（order / spec / used / common） */
    division: string;
    section: string;
    summary: string;
    body: string;
    sort: number;
    published: boolean;
}

interface Props {
    draft: GuideDraft;
    sections: readonly string[];
    /** 選べる事業（⚠️ 見られる事業＋全事業共通） */
    divisions: { value: string; label: string }[];
    titleToId: Map<string, number>;
    onSaved: (id: number) => void;
    onCancel: () => void;
}

const SYNTAX_HELP: [string, string][] = [
    ['## 見出し', '大きな見出し（右の目次に出る）'],
    ['### 小見出し', '小さな見出し（目次に出る）'],
    ['[[記事のタイトル]]', '別の記事へのリンク。まだ無い記事は赤になる'],
    // ⚠️ v2.2.196: 画面を開くボタン（GuideScreenButton.tsx）。⚠️ 名前は guideScreens.ts に登録したものだけ
    ['[[画面:顧客DB]]', 'ダッシュボードの窓でその画面を開くボタン。登録の無い名前は赤になる'],
    ['> 注意：〜', '黄色の注意枠'],
    ['> 要確認：〜', '赤い枠（現場で確かめてほしいこと）'],
    ['> 〜', '緑のポイント枠'],
    ['1. 〜', '番号付きの手順'],
    ['- 〜', '箇条書き'],
    ['**太字**', '強調'],
];

const GuideEditor: React.FC<Props> = ({ draft: initial, sections, divisions, titleToId, onSaved, onCancel }) => {
    const [draft, setDraft] = useState<GuideDraft>(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = <K extends keyof GuideDraft>(key: K, value: GuideDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const response = await apiClient.post('', {
                request: 'guide_save',
                id: draft.id,
                title: draft.title,
                division: draft.division,
                section: draft.section,
                summary: draft.summary,
                body: draft.body,
                sort: draft.sort,
                published: draft.published ? 1 : 0,
            });
            if (response.data?.status !== 'ok') {
                setError(response.data?.message ?? '保存できませんでした。');
                return;
            }
            onSaved(Number(response.data.id));
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '保存できませんでした。通信状態を確かめて、もう一度押してください。');
            console.error('guide_save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="gd_editor">
            <div className="gd_editor_head">
                <div className="gd_editor_title">{draft.id === null ? '記事を作る' : '記事を直す'}</div>
                <div className="gd_editor_actions">
                    <button type="button" className="gd_btn" onClick={onCancel} disabled={saving}>やめる</button>
                    <button type="button" className="gd_btn is_primary" onClick={save} disabled={saving}>
                        {saving ? '保存中…' : '保存する'}
                    </button>
                </div>
            </div>
            {error !== '' && <div className="gd_error" role="alert">{error}</div>}

            <div className="gd_form">
                <label className="gd_field is_wide">
                    <span className="gd_label">タイトル</span>
                    <input className="gd_input" value={draft.title} maxLength={191}
                        onChange={(e) => set('title', e.target.value)} placeholder="例：契約したら（注文営業）" />
                </label>
                <label className="gd_field">
                    <span className="gd_label">事業</span>
                    <select className="gd_input" value={draft.division} onChange={(e) => set('division', e.target.value)}>
                        {/* ⚠️ 見られない事業の記事を直すときも、今の値を消さない */}
                        {[...divisions, ...(divisions.some((d) => d.value === draft.division) ? [] : [{ value: draft.division, label: draft.division }])]
                            .map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                </label>
                <label className="gd_field">
                    <span className="gd_label">分類</span>
                    <select className="gd_input" value={draft.section} onChange={(e) => set('section', e.target.value)}>
                        {sections.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
                <label className="gd_field is_narrow">
                    <span className="gd_label">並び順</span>
                    <input className="gd_input" type="number" value={draft.sort}
                        onChange={(e) => set('sort', Number(e.target.value) || 0)} />
                </label>
                <label className="gd_field gd_check">
                    <input type="checkbox" checked={draft.published} onChange={(e) => set('published', e.target.checked)} />
                    <span>公開する</span>
                </label>
                <label className="gd_field is_full">
                    <span className="gd_label">1行の説明（一覧に出ます）</span>
                    <input className="gd_input" value={draft.summary} maxLength={255}
                        onChange={(e) => set('summary', e.target.value)} />
                </label>
            </div>

            <div className="gd_split">
                <div className="gd_split_col">
                    <div className="gd_label">本文</div>
                    <textarea className="gd_textarea" value={draft.body} onChange={(e) => set('body', e.target.value)} spellCheck={false} />
                    <details className="gd_syntax">
                        <summary>書き方</summary>
                        <dl>
                            {SYNTAX_HELP.map(([code, desc]) => (
                                <React.Fragment key={code}><dt><code>{code}</code></dt><dd>{desc}</dd></React.Fragment>
                            ))}
                        </dl>
                        <p>表（｜で区切る書き方）は使えません。箇条書きか見出しで書いてください。</p>
                        {/* ⚠️ v2.2.196: `[[画面:名前]]` に使える名前（guideScreens.ts の GUIDE_SCREENS） */}
                        <p className="gd_syntax_screens"><b>画面の名前：</b>{Object.keys(GUIDE_SCREENS).join('、')}</p>
                    </details>
                </div>
                <div className="gd_split_col">
                    <div className="gd_label">プレビュー</div>
                    <div className="gd_preview">
                        <h1 className="gd_h1">{draft.title || '（タイトル）'}</h1>
                        <GuideMarkdown body={draft.body} titleToId={titleToId} onOpen={() => undefined}
                            articleDivision={draft.division === GUIDE_COMMON ? null : draft.division} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuideEditor;
