import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * 業務ガイドの本文（Markdown）を表示する（v2.2.194）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 独自の書き方（編集画面の「書き方」と同じ）:
 *   `[[タイトル]]`        … 別の記事へのリンク。⚠️ 記事があれば緑、まだ無ければ赤（編集できる人が押すと新規作成）
 *   `> 注意：…`          … 黄色の注意枠
 *   `> 要確認：…`        … 赤い枠（⚠️ 社内ルールなど、現場で確かめてほしいこと）
 *   `> …`（上以外）       … 緑のポイント枠
 *   `## 見出し` `### 小見出し` … 右の目次に出る
 *
 * ⚠️⚠️ **表（| a | b |）は使えない。** ⚠️ 表の書き方（GFM）の部品を入れていないため。
 *   ⚠️ 箇条書きか見出しで書く（編集画面の「書き方」にも書いてある）。
 *
 * ⚠️ リンクは `#guide:<タイトル>` に置き換えてから渡す。
 *   ⚠️ `guide:` のような独自の先頭にすると react-markdown が安全のため URL を消す（⚠️ `#` で始めれば相対 URL 扱いで残る）。
 * ─────────────────────────────────────────────
 */

const LINK_PREFIX = '#guide:';
const STRONG_HREF = '#guide-strong';

/**
 * コードの外側だけに置き換えをかける。
 * ⚠️ `` ` ``で囲んだところと ``` のブロックの中は書き方の例なので、そのまま出す（⚠️ 「書き方」の記事の `[[ ]]` がリンクにならないように）。
 */
const outsideCode = (body: string, replace: (text: string) => string): string => {
    let inFence = false;
    return body.split('\n').map((line) => {
        if (/^```/.test(line.trim())) { inFence = !inFence; return line; }
        if (inFence) return line;
        return line.split(/(`[^`]*`)/).map((part, i) => (i % 2 === 1 ? part : replace(part))).join('');
    }).join('\n');
};

/** `[[タイトル]]` → `[タイトル](#guide:…)`。⚠️ 丸括弧はリンクの区切りと紛れるので符号化する */
const expandLinks = (body: string): string =>
    outsideCode(body, (text) => text.replace(/\[\[([^[\]\n]+)\]\]/g, (_, title: string) => {
        const target = encodeURIComponent(title.trim()).replace(/\(/g, '%28').replace(/\)/g, '%29');
        return `[${title.trim()}](${LINK_PREFIX}${target})`;
    }));

/**
 * `**太字**` → `[太字](#guide-strong)`（表示は <strong>）。
 *
 * ⚠️⚠️ **Markdown の規則では、日本語の太字が閉じないことがある。**
 *   ⚠️ 例: `**「契約済み」**のお客様` … 閉じる `**` の前が「」」、後ろが「の」なので太字の終わりと認められず、
 *     ⚠️ `**` がそのまま文字で出る（2026-10-16 に画面で確認）。⚠️ 現場の人が書く記事では避けようがない。
 *   ⚠️ リンクの形には前後の文字の決まりが無いので、太字をリンクの形に置き換えてから渡す。
 * ⚠️ `[` `]` や `` ` `` を含む太字は置き換えない（⚠️ リンクの中にリンクは作れないため。従来の書き方のまま）。
 * ⚠️ コードの中は置き換えない（outsideCode）。
 */
const expandStrong = (body: string): string =>
    outsideCode(body, (text) => text.replace(/\*\*([^*\n`[\]]+?)\*\*/g, `[$1](${STRONG_HREF})`));

const expandGuideLinks = (body: string): string => expandLinks(expandStrong(body));

/** 見出しの id。⚠️ 目次（headingsOf）と本文（h2/h3）で同じ文字列から作ること */
const headingId = (text: string): string => `h-${encodeURIComponent(text.trim()).replace(/%/g, '')}`;

/** Markdown の飾りを落とした見出しの文字 */
const plainHeading = (line: string): string =>
    line.replace(/\[\[([^[\]\n]+)\]\]/g, '$1').replace(/[*_`]/g, '').trim();

/** 目次。⚠️ コードブロックの中の `#` は見出しにしない */
export const headingsOf = (body: string): { level: 2 | 3; text: string; id: string }[] => {
    const result: { level: 2 | 3; text: string; id: string }[] = [];
    let inCode = false;
    for (const line of body.split('\n')) {
        if (/^```/.test(line.trim())) { inCode = !inCode; continue; }
        if (inCode) continue;
        const m = /^(##|###)\s+(.+)$/.exec(line);
        if (m === null) continue;
        const text = plainHeading(m[2]);
        result.push({ level: m[1] === '##' ? 2 : 3, text, id: headingId(text) });
    }
    return result;
};

/** React の子要素から文字だけを取り出す */
const textOf = (node: React.ReactNode): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
    return '';
};

const calloutKind = (text: string): 'warn' | 'check' | 'tip' => {
    const head = text.trim();
    if (/^注意/.test(head)) return 'warn';
    if (/^要確認/.test(head)) return 'check';
    return 'tip';
};

interface Props {
    body: string;
    /** 記事のタイトル → id（⚠️ 公開・非公開を問わず。リンクの色分けに使う） */
    titleToId: Map<string, number>;
    /** 記事へのリンクを押したとき */
    onOpen: (title: string) => void;
}

const GuideMarkdown: React.FC<Props> = ({ body, titleToId, onOpen }) => (
    <div className="gd_md">
        <ReactMarkdown
            components={{
                a: ({ href, children }) => {
                    if (href === STRONG_HREF) return <strong>{children}</strong>;
                    if (href !== undefined && href.startsWith(LINK_PREFIX)) {
                        const title = decodeURIComponent(href.slice(LINK_PREFIX.length));
                        const exists = titleToId.has(title);
                        return (
                            <button
                                type="button"
                                className={`gd_ref${exists ? '' : ' is_missing'}`}
                                onClick={() => onOpen(title)}
                                title={exists ? `「${title}」を開く` : `「${title}」はまだ書かれていません`}
                            >
                                {children}
                            </button>
                        );
                    }
                    // ⚠️ 外部リンクは別タブ（⚠️ ガイドのウインドウを離れない）
                    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                },
                h2: ({ children }) => <h2 id={headingId(textOf(children))}>{children}</h2>,
                h3: ({ children }) => <h3 id={headingId(textOf(children))}>{children}</h3>,
                blockquote: ({ children }) => (
                    <blockquote className={`gd_callout is_${calloutKind(textOf(children))}`}>{children}</blockquote>
                ),
            }}
        >
            {expandGuideLinks(body)}
        </ReactMarkdown>
    </div>
);

export default GuideMarkdown;
