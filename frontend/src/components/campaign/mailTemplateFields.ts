/**
 * メール本文のひな型に使える差し込み語。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **② の `campaignForm/mailTemplate.ts` の PLACEHOLDERS と必ず揃えること。**
 *   ⚠️ 片方だけ増やすと「画面には出るが効かない語」ができ、
 *     **打った本人は気づけないまま顧客へ届く**。
 *
 * ⚠️⚠️ **通知先アドレスの語は作らないこと。**
 *   ⚠️ 顧客宛の本文に社内の宛先を書けてしまう。
 *
 * ⚠️ 既定の文面は**ここに書かない**（② が持っている）。
 *   ⚠️ 写すと、既定を直しても画面の表示だけ古いままになる。
 * ─────────────────────────────────────────────
 */

export interface Placeholder {
    /** `{{ }}` の中に書く語 */
    key: string;
    /** 画面に出す説明 */
    note: string;
}

export const PLACEHOLDERS: Placeholder[] = [
    { key: 'お名前', note: '姓と名（間に半角空白）' },
    { key: '姓', note: '姓だけ' },
    { key: '名', note: '名だけ' },
    { key: 'お名前カナ', note: 'せいとめい' },
    { key: 'お問い合わせ内容', note: '入力項目の一覧（未入力の行は出ません）' },
    { key: 'キャンペーン名', note: '' },
    { key: 'ブランド名', note: '例）国分ハウジング' },
    { key: '受付日時', note: '社内通知メール向け' },
    { key: '来場希望場所', note: '' },
    { key: '来場希望日', note: '' },
    { key: '来場希望時間', note: '' },
    { key: '携帯番号', note: '' },
    { key: 'メールアドレス', note: '' },
    { key: '年齢', note: '' },
    { key: '事前アンケート', note: '案内文ごと。URLが無いブランドでは何も出ません' },
    { key: '事前アンケートURL', note: 'URLだけ' },
];

const KNOWN = new Set(PLACEHOLDERS.map(p => p.key));

/**
 * ひな型に書かれた「知らない語」を拾う。
 *
 * ⚠️⚠️ **知らない語は ② でもそのまま残る**（黙って消さない）。
 *   ⚠️ 消してしまうと打ち間違いに誰も気づけない。
 *   ⚠️ そのぶん、保存前にここで知らせる。
 *
 * @returns 重複を除いた語の一覧。順番は書かれた順
 */
export const unknownPlaceholders = (template: string): string[] => {
    const found: string[] = [];
    const seen = new Set<string>();

    // ⚠️ ② の正規表現と同じにすること（40文字まで・入れ子なし）
    const pattern = /\{\{([^{}]{1,40})\}\}/g;
    let match = pattern.exec(template);
    while (match !== null) {
        const key = match[1].trim();
        if (!KNOWN.has(key) && !seen.has(key)) {
            seen.add(key);
            found.push(key);
        }
        match = pattern.exec(template);
    }

    return found;
};
