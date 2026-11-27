/**
 * 会社概要・名刺・署名などのテキストから、業者の項目を抜き出す（v2.2.311。移行元の extractVendorFields と同じ式）。
 * ⚠️ 画面の中だけで動く（どこにも送らない）。抜き出した値は、業者の画面で直してから保存する。
 */

const PREFS = '北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県';
const CORP = '株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|医療法人|社会福祉法人|学校法人|司法書士法人|税理士法人|行政書士法人|土地家屋調査士法人';

/** 数字・英字・記号だけ半角にする（長音記号は業者名を壊すので本文には使わない） */
const numText = (s: string): string => String(s || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/＠/g, '@').replace(/．/g, '.').replace(/：/g, ':')
    .replace(/[（]/g, '(').replace(/[）]/g, ')')
    .replace(/[‐‑‒–—―ー−ｰ－]/g, '-')
    .replace(/　/g, ' ');

const tidyName = (s: string): string => String(s || '')
    .replace(/^[\s|｜/／・:：]+/, '').replace(/[\s|｜/／・:：]+$/, '').replace(/(御中|様)$/, '').replace(/[ 　]{2,}/g, ' ').trim()
    .replace(new RegExp(`^(${CORP})[ 　]+`), '$1').replace(new RegExp(`[ 　]+(${CORP})$`), '$1');

const extractVendorName = (text: string): string => {
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (const ln of lines) {
        const m = ln.match(/^(?:会社名|商号|社名|名称|企業名|法人名)[\s:：|｜]*(.+)$/);
        if (m && tidyName(m[1])) return tidyName(m[1]);
    }
    const norm = (ln: string) => ln.replace(/\(株\)|（株）/g, '株式会社').replace(/\(有\)|（有）/g, '有限会社').replace(/\(同\)|（同）/g, '合同会社');
    const pre = new RegExp(`((?:${CORP})\\s{0,2}[^\\s、。,／/|｜:：]{1,24})`);
    const suf = new RegExp(`([^\\s、。,／/|｜:：]{1,24}\\s{0,2}(?:${CORP}))`);
    for (const raw of lines) {
        const ln = norm(raw);
        const m = ln.match(pre) ?? ln.match(suf);
        if (m) return tidyName(m[1]);
    }
    return lines[0] ? tidyName(lines[0]).slice(0, 40) : '';
};

const extractTel = (text: string): { tel: string; fax: string } => {
    const lines = numText(text).replace(/〒\s*\d{3}-?\d{4}/g, ' ').split(/\r?\n/);
    const pat = /(?:\+81[-\s]?|0)\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/g;
    let tel = ''; let fax = '';
    for (const ln of lines) {
        const ms = ln.match(pat);
        if (!ms) continue;
        const isFax = /fax|ファックス/i.test(ln); const isTel = /tel|℡|電話|phone|携帯|mobile/i.test(ln);
        for (const raw of ms) {
            const v = raw.replace(/\s/g, '').replace(/^\+81-?/, '0');
            const digits = v.replace(/\D/g, '');
            if (digits.length < 10 || digits.length > 11) continue;
            if (isFax && !isTel) { if (!fax) fax = v; continue; }
            if (!tel) tel = v;
        }
    }
    return { tel, fax };
};
const extractEmail = (text: string): string => numText(text).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? '';
const extractURL = (text: string): string => {
    const m = numText(text).match(/https?:\/\/[^\s、。,）)】"'<>]+/);
    if (m) return m[0].replace(/[.,]$/, '');
    const m2 = numText(text).match(/(?:^|\s)(www\.[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s、。,）)]*)/);
    return m2 ? `https://${m2[1]}` : '';
};
const extractAddress = (text: string): string => {
    const t = numText(text);
    const m = t.match(new RegExp(`(?:〒\\s*\\d{3}-?\\d{4}\\s*)?((?:${PREFS})[^\\n、,｜|]{0,60})`));
    if (m) return tidyName(m[1]);
    const m2 = t.match(/^(?:住所|所在地|本社|本店)[\s:：|｜]*(.+)$/m);
    return m2 ? tidyName(m2[1]) : '';
};
const extractArea = (addr: string, text: string): string => {
    const src = addr || numText(text);
    return src.match(new RegExp(`(?:${PREFS})\\s*([^\\s\\d]{1,10}?[市区町村])`))?.[1]
        ?? src.match(/([^\s\d、。,]{1,10}?郡[^\s\d、。,]{1,10}?[町村])/)?.[1]
        ?? src.match(/([^\s\d、。,]{2,10}?[市区])/)?.[1] ?? '';
};
const extractContact = (text: string): string => {
    const NAME = '([^\\s\\n、,。｜|:：]{1,8}(?:[ 　][^\\s\\n、,。｜|:：]{1,8})?)';
    const m = text.match(new RegExp(`(?:担当者名|担当者|担当|窓口|ご担当)[\\s:：|｜]*${NAME}`));
    if (m) return tidyName(m[1]);
    const m2 = text.match(new RegExp(`(?:代表取締役社長|代表取締役|取締役社長|取締役|専務取締役|常務取締役|執行役員|統括部長|営業部長|部長|次長|課長|係長|主任|店長|代表)[\\s:：　]*${NAME}`));
    return m2 && m2[1] && !new RegExp(CORP).test(m2[1]) ? tidyName(m2[1]) : '';
};
const guessVkind = (text: string): string => {
    if (/司法書士|税理士|土地家屋調査士|行政書士|弁護士|測量士/.test(text)) return '士業';
    if (/銀行|信用金庫|信金|信用組合|labank|ローン/i.test(text)) return '金融機関';
    if (/建設|工務店|建築|土木|ハウス工業|組$/m.test(text)) return '建設・工務店';
    return '不動産業者';
};

export interface ExtractedVendor { name: string; vkind: string; contact: string; tel: string; email: string; area: string; addr: string; url: string; memo: string }
export const extractVendorFields = (text: string): ExtractedVendor => {
    const { tel, fax } = extractTel(text);
    const addr = extractAddress(text);
    return {
        name: extractVendorName(text), vkind: guessVkind(text), contact: extractContact(text), tel, email: extractEmail(text),
        area: extractArea(addr, text), addr, url: extractURL(text), memo: fax ? `FAX：${fax}` : '',
    };
};
