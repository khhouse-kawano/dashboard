import { landGet } from './landApi';

/**
 * 土地仕入の一覧を CSV で書き出す（v2.2.311。移行元の「書き出し」）。
 * ⚠️ Excel でそのまま開けるよう、先頭に BOM を付ける（付けないと日本語が化ける）。
 * ⚠️ データは一覧と同じ GET（offset・limit で1000件ずつ全部読む）。絞り込みの条件もそのまま使う。
 */

export type CsvColumn<T> = [string, (row: T) => unknown];

const cell = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 一覧の GET を、終わりまで1000件ずつ読む */
export const fetchAllRows = async <T,>(request: string, params: Record<string, string>): Promise<T[]> => {
    const rows: T[] = [];
    for (let offset = 0; offset < 100000; offset += 1000) {
        const r = await landGet<{ rows: T[]; total: number }>(request, { ...params, offset, limit: 1000 });
        rows.push(...r.rows);
        if (rows.length >= r.total || r.rows.length === 0) break;
    }
    return rows;
};

export const downloadCsv = <T,>(fileName: string, columns: CsvColumn<T>[], rows: T[]): void => {
    const lines = [columns.map(([h]) => cell(h)).join(','), ...rows.map((r) => columns.map(([, f]) => cell(f(r))).join(','))];
    const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** ファイル名の日付（YYYYMMDD_HHMM） */
export const stamp = (): string => {
    const d = new Date(); const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};
