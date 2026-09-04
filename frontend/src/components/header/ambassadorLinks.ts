/**
 * アンバサダー関連のリンク生成。
 *
 * ⚠️ ここで作る2つのURLは**社外に配るもの**である。
 *   間違ったURLをアンバサダーに渡すと、反響が届かないまま
 *   「紹介したのに連絡が来ない」という事態になる。
 */

/** アンバサダー専用LPの置き場所。⚠️ 変えたらフォーム側の設置先も変える */
const LP_BASE = 'https://kh-house.jp/ambassador/';

/**
 * アンバサダー専用LPのURL。
 *
 * ⚠️ **`?id=` である（`/id=` ではない）。**
 *   クエリ文字列なので `?` が必要。`/id=1` にすると LP 側の
 *   `URLSearchParams` が id を拾えず、どのアンバサダー経由か
 *   分からない反響として届く（送信自体は成功するため気づけない）。
 */
export const ambassadorLpUrl = (no: number): string => `${LP_BASE}?id=${no}`;

/**
 * Instagram のプロフィールURL。
 *
 * ⚠️ account 列はハンドル名（@ 抜き）で保存している前提。
 *   保存時に @ を落としているが、手入力で @ が入ることもあるため
 *   ここでも落とす。二重に落としても害はない。
 *
 * ⚠️ ハンドル名として不正な文字が入っていたら null を返す。
 *   そのままURLに埋めると、まったく別のアカウントや外部サイトへ
 *   飛ぶリンクを社内画面に作ってしまう。
 */
export const instagramUrl = (account: string | null): string | null => {
    const handle = (account ?? '').trim().replace(/^@+/, '');
    if (handle === '') return null;
    // Instagram のハンドル名として許される文字だけを通す
    if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
    return `https://www.instagram.com/${handle}/`;
};

/**
 * クリップボードへコピーする。成功したら true。
 *
 * ⚠️ navigator.clipboard は **https か localhost でしか使えない。**
 *   社内から http で開いている場合に undefined になるため、
 *   古い execCommand へ退避する。これが無いと、
 *   一部の環境でだけ「コピーボタンが何も起きない」という
 *   再現しにくい不具合になる。
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // 権限拒否など。下の退避策を試す
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        // 画面をちらつかせないよう画面外に置く
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
};
