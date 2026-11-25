import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';

/**
 * フォーム作成で使うイベントカレンダー（event_calendar）のイベント（v2.2.299）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 対象は全社イベント（shop = 'khg'）かつ表示する（flag = 1）ものだけ。集客サマリー（eventSummary.ts の EVENT_SQL）と同じ条件。
 * ⚠️ 日付は DATE_FORMAT で 'YYYY-MM-DD' の文字にして読む（mysql2 は DATE を Date で返し、時差で前日になりうる）。
 * ⚠️ 反響一覧（event_db.title）に入れる名前は「開始日_イベント名」（eventTitleOf）。集客サマリーは先頭の日付を外して結び付ける。
 * ─────────────────────────────────────────────
 */

export interface CalendarEvent {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  url: string;
}

interface CalendarRow extends RowDataPacket, CalendarEvent {}

const COLUMNS = `id, title, DATE_FORMAT(startDate, '%Y-%m-%d') AS startDate, DATE_FORMAT(endDate, '%Y-%m-%d') AS endDate, COALESCE(url, '') AS url`;

/** 選べるイベント（開始日の新しい順） */
export const listCalendarEvents = async (): Promise<CalendarEvent[]> =>
  query<CalendarRow>(`SELECT ${COLUMNS} FROM event_calendar WHERE shop = 'khg' AND flag = 1 ORDER BY startDate DESC, id DESC`);

/** 1件（⚠️ 全社・表示中でなければ null） */
export const findCalendarEvent = async (id: unknown): Promise<CalendarEvent | null> => {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  const rows = await query<CalendarRow>(`SELECT ${COLUMNS} FROM event_calendar WHERE id = ? AND shop = 'khg' AND flag = 1`, [n]);
  return rows[0] ?? null;
};

/** 反響一覧（event_db.title）に入れる名前 */
export const eventTitleOf = (e: Pick<CalendarEvent, 'title' | 'startDate'>): string => `${e.startDate}_${e.title}`;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const parse = (ymd: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d;
};

/**
 * 開催日の表記。'2026年12月5日（土）'、2日以上は '2026年12月5日（土）〜6日（日）'。
 * ⚠️ 月・年が変わるときは、変わったところから書く（〜1月2日（金）・〜2027年1月2日（土））。⚠️ 読めない日付は空。
 */
export const formatEventDate = (start: string, end = ''): string => {
  const s = parse(start);
  if (!s) return '';
  const day = (d: Date) => `${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
  const head = `${s.getFullYear()}年${s.getMonth() + 1}月${day(s)}`;
  const e = parse(end);
  if (!e || e.getTime() <= s.getTime()) return head;
  if (e.getFullYear() !== s.getFullYear()) return `${head}〜${e.getFullYear()}年${e.getMonth() + 1}月${day(e)}`;
  if (e.getMonth() !== s.getMonth()) return `${head}〜${e.getMonth() + 1}月${day(e)}`;
  return `${head}〜${day(e)}`;
};

/** 'YYYY-MM-DD' として正しい日付か */
export const isDate = (v: string): boolean => parse(v) !== null;
