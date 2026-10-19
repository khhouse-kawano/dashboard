import React from 'react';
import ReactMarkdown from 'react-markdown';
import GuideScreenButton from './GuideScreenButton';
import { GUIDE_SCREENS, screenNameOf } from './guideScreens';

/**
 * 業務ガイドの本文（Markdown）を表示する（v2.2.194）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 独自の書き方（編集画面の「書き方」と同じ）:
 *   `[[タイトル]]`        … 別の記事へのリンク。⚠️ 記事があれば緑、まだ無ければ赤（編集できる人が押すと新規作成）
 *   `[[画面:名前]]`       … ダッシュボードの窓でその画面を開くボタン（v2.2.196。GuideScreenButton.tsx）。⚠️ 名前は guideScreens.ts のキー
 *   ⚠️ 書かなくても、`「顧客DB」` や `[[顧客DB]]` のように画面の名前が出てくると、後ろに小さい「開く」ボタンが付く（expandMentions）
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
const SCREEN_PREFIX = '#screen:';
/** `[[画面:名前]]`（⚠️ 全角の「：」も受ける）。⚠️ 記事へのリンクより先に置き換える */
const SCREEN_LINK = /\[\[画面[:：]([^[\]\n]+)\]\]/g;
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

/** ⚠️ 丸括弧はリンクの区切りと紛れるので符号化する */
const encodeTarget = (text: string): string => encodeURIComponent(text.trim()).replace(/\(/g, '%28').replace(/\)/g, '%29');

/** `[[画面:名前]]` → `[名前](#screen:…)`、`[[タイトル]]` → `[タイトル](#guide:…)` */
const expandLinks = (body: string): string =>
    outsideCode(body, (text) => text
        .replace(SCREEN_LINK, (_, name: string) => `[${name.trim()}](${SCREEN_PREFIX}${encodeTarget(name)})`)
        .replace(/\[\[([^[\]\n]+)\]\]/g, (_, title: string) => `[${title.trim()}](${LINK_PREFIX}${encodeTarget(title)})`));

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

/**
 * 画面の名前が出てくるところに、小さな「開く」ボタンを足す（v2.2.196・2026-10-16 の指示）。
 * ⚠️ 対象: `「顧客DB」`・`「反響管理 → 重複反響サマリー」`・`[[顧客DB]]`・`[[反響一覧（建売営業）]]`（言葉の判定は guideScreens.ts の screenNameOf）。
 * ⚠️ 足さないところ:
 *   - 見出しの行（⚠️ 右の目次の文字に混ざるため）・コードの中（outsideCode）
 *   - 記事に `[[画面:同じ名前]]` の大きいボタンがある画面（⚠️ 同じボタンが並ばないように）
 *   - 同じ行の2回目以降（⚠️ 1行にボタンが並びすぎないように）
 * ⚠️ 太字の置き換え（expandStrong）の**後**に呼ぶ。⚠️ 太字になった `[「顧客DB」](#guide-strong)` は、その後ろに足す
 *   （⚠️ リンクの文字の中にリンクは作れない）。
 */
const MINI_PREFIX = '#screen-mini:';
/**
 * かぎかっこ・リンクの無い名前（`顧客DBに載せる`）にも付ける（2026-10-16 の追加指示「名前が出るところには開くボタン」）。
 * ⚠️⚠️ **その記事で最初に出たところだけ**（⚠️ 「顧客DB」は1本の記事に何度も出るので、全部に付けると読めない）。
 * ⚠️ 長い名前から探す（⚠️ `紹介キャンペーンの反響一覧` の中の `反響一覧` を左のメニューの反響一覧にしない）。
 * ⚠️ ふつうの言葉としても使う名前は、かぎかっこ・リンクのときだけ（BARE_EXCLUDE）。
 */
const BARE_EXCLUDE = new Set(['カレンダー', 'マーケット情報', '店舗編集', '権限編集']);
const BARE_NAMES = Object.keys(GUIDE_SCREENS).filter((n) => !BARE_EXCLUDE.has(n)).sort((a, b) => b.length - a.length);
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BARE_PATTERN = new RegExp(BARE_NAMES.map(escapeRegExp).join('|'), 'g');
/** ⚠️ 名前を探さないところ: Markdown のリンク・`[[ ]]`・かぎかっこ（⚠️ これらは上で済ませてある） */
const PROTECTED = /(\[[^\]\n]*\]\([^)\n]*\)|\[\[[^\]\n]*\]\]|「[^」\n]*」)/;

const expandMentions = (body: string): string => {
    const explicit = new Set([...body.matchAll(SCREEN_LINK)].map((m) => m[1].trim()));
    /** ⚠️ その記事でボタンを付けた名前（⚠️ かぎかっこの無い名前は、これに入っていれば付けない） */
    const seen = new Set<string>();
    return outsideCode(body, (text) => {
        if (/^\s*#{1,6}\s/.test(text)) return text;
        const used = new Set<string>();
        const mini = (word: string): string => {
            const name = screenNameOf(word);
            if (name === null || explicit.has(name) || used.has(name)) return '';
            used.add(name);
            seen.add(name);
            return `[開く](${MINI_PREFIX}${encodeTarget(name)})`;
        };
        const marked = text
            .replace(/\[「([^」\n]{1,40})」\]\(#guide-strong\)/g, (all, word: string) => `${all}${mini(word)}`)
            .replace(/「([^」\n]{1,40})」(?!\]\()/g, (all, word: string) => `${all}${mini(word)}`)
            .replace(/\[\[(?!画面[:：])([^[\]\n]+)\]\]/g, (all, title: string) => `${all}${mini(title)}`);
        return marked.split(PROTECTED).map((part, i) => (i % 2 === 1 ? part : part.replace(BARE_PATTERN, (name) => {
            if (explicit.has(name) || seen.has(name)) return name;
            seen.add(name);
            return `${name}[開く](${MINI_PREFIX}${encodeTarget(name)})`;
        }))).join('');
    });
};

const expandGuideLinks = (body: string): string => expandLinks(expandMentions(expandStrong(body)));

/** 見出しの id。⚠️ 目次（headingsOf）と本文（h2/h3）で同じ文字列から作ること */
const headingId = (text: string): string => `h-${encodeURIComponent(text.trim()).replace(/%/g, '')}`;

/** Markdown の飾りを落とした見出しの文字 */
const plainHeading = (line: string): string =>
    line.replace(SCREEN_LINK, '$1').replace(/\[\[([^[\]\n]+)\]\]/g, '$1').replace(/[*_`]/g, '').trim();

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
    /** 記事の事業（⚠️ 全事業共通は null）。⚠️ 「画面を開く」でどの事業の画面を開くかに使う */
    articleDivision: string | null;
    /** ⚠️ v2.2.198: 渡すと「画面を開く」をいまの窓で開き、開けたら呼ぶ（GuideScreenButton の onOpenedHere） */
    onScreenOpened?: () => void;
}

const GuideMarkdown: React.FC<Props> = ({ body, titleToId, onOpen, articleDivision, onScreenOpened }) => (
    <div className="gd_md">
        <ReactMarkdown
            components={{
                a: ({ href, children }) => {
                    if (href === STRONG_HREF) return <strong>{children}</strong>;
                    // ⚠️ 本文の画面の名前の後ろの小さいボタン（expandMentions）。⚠️ 登録のある名前だけが来る
                    if (href !== undefined && href.startsWith(MINI_PREFIX)) {
                        return <GuideScreenButton name={decodeURIComponent(href.slice(MINI_PREFIX.length))} articleDivision={articleDivision} compact onOpenedHere={onScreenOpened} />;
                    }
                    if (href !== undefined && href.startsWith(SCREEN_PREFIX)) {
                        const name = decodeURIComponent(href.slice(SCREEN_PREFIX.length));
                        // ⚠️ 登録の無い名前は赤い札（⚠️ 押せない。書き間違いに気づけるように）
                        if (GUIDE_SCREENS[name] === undefined) {
                            return <span className="gd_screen is_missing" title="この画面は登録されていません">{name}（画面の登録なし）</span>;
                        }
                        return <GuideScreenButton name={name} articleDivision={articleDivision} onOpenedHere={onScreenOpened} />;
                    }
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
