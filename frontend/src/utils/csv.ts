/**
 * CSV の読み込み（v2.2.168 新規。⚠️ ライブラリは使っていない）。
 *
 * ⚠️ 値の中のカンマ・改行・`"` に対応する（`"..."` で囲み、`"` は `""`）。
 *   ⚠️ 金利の備考（note）には読点代わりのカンマや改行が入るため、単純な split(',') では壊れる。
 */

/**
 * ファイルの中身を文字列にする。
 *
 * ⚠️ UTF-8 で読めなければ Shift_JIS として読む（⚠️ Excel で保存し直すと Shift_JIS になる）。
 * ⚠️ 先頭の BOM は落とす。
 */
export const decodeCsv = (buffer: ArrayBuffer): string => {
    let text: string;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        text = new TextDecoder('shift_jis').decode(buffer);
    }
    return text.replace(/^﻿/, '');
};

/** CSV を行 × 列の配列にする。⚠️ 空行は捨てる */
export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                field += c;
            }
            continue;
        }
        if (c === '"') {
            quoted = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            // ⚠️ CRLF は1つの改行として扱う
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            if (row.some((v) => v.trim() !== '')) rows.push(row);
            row = [];
        } else {
            field += c;
        }
    }
    row.push(field);
    if (row.some((v) => v.trim() !== '')) rows.push(row);
    return rows;
};

/**
 * 1行目を見出しとして、2行目以降を「見出し → 値」のオブジェクトにする。
 *
 * ⚠️ 見出しは前後の空白を落として照合する。⚠️ 知らない見出しの列はそのまま入る（使う側で無視する）。
 */
export const csvToObjects = (rows: string[][]): { header: string[]; records: Record<string, string>[] } => {
    const [head = [], ...body] = rows;
    const header = head.map((h) => h.trim());
    const records = body.map((cells) => {
        const record: Record<string, string> = {};
        header.forEach((h, i) => { record[h] = (cells[i] ?? '').trim(); });
        return record;
    });
    return { header, records };
};
