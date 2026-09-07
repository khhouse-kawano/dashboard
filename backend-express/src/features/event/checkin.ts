import { timingSafeEqual } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { EventResult } from './reservation';

/**
 * イベント受付（チェックイン・退場）。
 *
 * ─────────────────────────────────────────────
 * 当日の動線
 *
 *   1. 来場者が予約完了メールのQRコードを見せる
 *   2. スタッフが**自分のスマホの標準カメラ**でQRを読む
 *   3. https://kh-house.jp/festa/reservation/?id=festa2026_xxxx が開く
 *   4. スタッフが合い言葉を入力 → 予約内容が出る
 *   5. 「チェックイン」または「退場する」を押す
 *
 * ⚠️ ダッシュボード（EventList）からは読み取らない。スマホでは
 *   ヘッダーのメニューが表示されないため、そもそも開けない。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **認証なしの書き込み口である**（3つ目）。しかも来場者の氏名を返す。
 *   予約IDを知っていれば誰でもこのURLを開けるため、**合い言葉が唯一の壁**になる。
 *
 *     ・合い言葉が未設定なら**全て拒否する**（素通しにしない）
 *     ・合い言葉を検証するまで**氏名を一切返さない**
 *       （画面側で隠すだけでは、通信を見れば読めてしまう）
 *     ・失敗回数に上限を掛ける（middlewares/publicFormRateLimit.ts）
 *     ・照合は timingSafeEqual を使う（応答時間から1文字ずつ当てられないように）
 */

/** 予約IDの形式。⚠️ features/event/reservation.ts と揃えること */
const ID_PATTERN = /^festa2026_[A-Za-z0-9]{16}$/;

interface ReservationRow extends RowDataPacket {
  id: string;
  name: string | null;
  kana: string | null;
  date: string | null;
  time: string | null;
  title: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
}

/**
 * 合い言葉を照合する。
 *
 * ⚠️ `===` で比較しない。文字列比較は一致した文字数だけ時間が延びるため、
 *   応答時間の差から1文字ずつ絞り込める。
 *
 * ⚠️ 長さが違うと timingSafeEqual が例外を投げる。先に長さで弾くが、
 *   その時点で「長さが違う」ことは漏れる。合い言葉の長さ自体は秘密ではない。
 */
const passcodeMatches = (input: string): boolean => {
  const expected = env.eventCheckinPasscode;
  if (expected === '') return false;

  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

/** 受付時刻。⚠️ event_db.check_in_time は TEXT。既存データに合わせて `YYYY/MM/DD HH:MM:SS` */
const stamp = (): string => {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** 画面へ返す予約内容。⚠️ 電話番号・メールアドレスは返さない（受付に不要） */
const toPublicView = (row: ReservationRow) => ({
  id: row.id,
  name: row.name ?? '',
  kana: row.kana ?? '',
  date: row.date ?? '',
  time: row.time ?? '',
  title: row.title ?? '',
  checkInTime: row.check_in_time ?? '',
  checkOutTime: row.check_out_time ?? '',
});

/**
 * 受付の処理。
 *
 * roll:
 *   'lookup'   … 予約内容を返すだけ。記録しない（確認してから押させるため）
 *   'checkin'  … check_in_time を記録する
 *   'checkout' … check_out_time を記録する
 *
 * ⚠️ 応答は常に**最新の予約内容**を含める。押したあとに画面を組み直す必要がなく、
 *   別の端末で先にチェックインされていた場合もその場で分かる。
 */
export const runEventCheckin = async (
  body: Record<string, unknown>
): Promise<EventResult> => {
  // ⚠️ 合い言葉の検証を最初に行う。IDの存在確認を先にすると、
  //   応答の違いから「そのIDが実在するか」を合い言葉なしで調べられる
  if (!passcodeMatches(asString(body.passcode))) {
    if (env.eventCheckinPasscode === '') {
      // ⚠️ 運用の事故。設定されるまで受付は一切できない
      logger.warn('EVENT_CHECKIN_PASSCODE が未設定のため、イベント受付を拒否しました。');
    }
    return {
      httpStatus: 401,
      body: { status: 'error', message: '合い言葉が違います。' },
    };
  }

  const id = asString(body.id);
  if (!ID_PATTERN.test(id)) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '予約情報が正しくありません。' },
    };
  }

  const roll = asString(body.roll) === '' ? 'lookup' : asString(body.roll);
  if (!['lookup', 'checkin', 'checkout'].includes(roll)) {
    return { httpStatus: 400, body: { status: 'error', message: '操作が不正です。' } };
  }

  const SELECT_SQL = `
    SELECT id, name, kana, date, time, title, check_in_time, check_out_time
      FROM event_db
     WHERE id = ?
     LIMIT 1
  `;

  try {
    const rows = await query<ReservationRow>(SELECT_SQL, [id]);
    const row = rows[0];

    if (row === undefined) {
      return {
        httpStatus: 404,
        body: { status: 'error', message: '該当する予約が見つかりません。' },
      };
    }

    const hasCheckIn = (row.check_in_time ?? '') !== '';
    const hasCheckOut = (row.check_out_time ?? '') !== '';

    if (roll === 'checkin') {
      // ⚠️ 上書きしない。二度読みしても最初の時刻を残す
      if (hasCheckIn) {
        return {
          httpStatus: 200,
          body: { status: 'ok', already: true, reservation: toPublicView(row) },
        };
      }
      const value = stamp();
      await execute('UPDATE event_db SET check_in_time = ? WHERE id = ?', [value, id]);
      return {
        httpStatus: 200,
        body: {
          status: 'ok',
          reservation: { ...toPublicView(row), checkInTime: value },
        },
      };
    }

    if (roll === 'checkout') {
      // ⚠️ チェックインしていない人は退場できない。順序が壊れたデータを作らない
      if (!hasCheckIn) {
        return {
          httpStatus: 400,
          body: { status: 'error', message: 'まだ受付が済んでいません。先にチェックインしてください。' },
        };
      }
      if (hasCheckOut) {
        return {
          httpStatus: 200,
          body: { status: 'ok', already: true, reservation: toPublicView(row) },
        };
      }
      const value = stamp();
      await execute('UPDATE event_db SET check_out_time = ? WHERE id = ?', [value, id]);
      return {
        httpStatus: 200,
        body: {
          status: 'ok',
          reservation: { ...toPublicView(row), checkOutTime: value },
        },
      };
    }

    return { httpStatus: 200, body: { status: 'ok', reservation: toPublicView(row) } };
  } catch (error) {
    // ⚠️ 例外の内容を応答に含めない
    logger.error(`event_checkin に失敗しました id=${id} roll=${roll}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '処理に失敗しました。時間をおいて再度お試しください。' },
    };
  }
};
