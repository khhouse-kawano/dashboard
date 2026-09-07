import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';
import { buildQrPng, sendInternalNotice, sendReservationConfirm } from './mail';
import type { ReservationMailData } from './mail';

/**
 * おうちづくりフェスタ2026 の来場予約を公開フォームから受け付ける。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **認証なしの書き込み口である**（ambassador_inquiry に次いで2つ目）。
 *
 *   予約元: https://kh-house.jp/festa/
 *   受け口: POST https://api.khg-marketing.info/api/gateway
 *           { "request": "event_reservation", ... }
 *
 *   社外の誰でも、ブラウザでもcurlでも叩ける。したがって
 *
 *     ・**リクエストの値を一切信用しない**
 *     ・title / status / shop / sync / check_in_time は**受け付けない**
 *       （受け付けると別イベントへの混入や「来場済み」への偽装ができる）
 *     ・全項目に長さ上限を掛ける
 *     ・例外の内容を応答に含めない
 *     ・流量制限を掛ける（middlewares/publicFormRateLimit.ts）
 * ─────────────────────────────────────────────
 *
 * ⚠️ `id` は**フォーム側（ブラウザ）が採番する。** QRコードを送信直後に
 *   表示する必要があり、サーバーの採番を待てないため。改ざんできる前提で
 *   形式検証を行い、二重登録は event_db.id の UNIQUE キーで防ぐ。
 *
 * 対になるフォーム: 20260425_kokubu_ouchi_festa_LP_NK/index.html
 *   ⚠️ フォームの name 属性を変えるとここも直す必要がある（型では検出できない）。
 */

/**
 * イベント名。
 *
 * ⚠️⚠️ **フォームから受け取らない。** event_db は複数のイベントで共用しており
 *   （既存: 住まいるフェスティバル2026）、この値で絞り込んでいる。
 *   リクエストで指定できるようにすると、他イベントの一覧に混入させられる。
 */
const EVENT_TITLE = 'おうちづくりフェスタ2026';

/**
 * 予約IDの形式。
 *
 * ⚠️ LPの generateReservationId() と一致させること。
 *   `festa2026_` ＋ 英数16文字。既存イベント（接頭辞なしの16文字）とは
 *   接頭辞で区別でき、同じテーブルに混在しても取り違えない。
 */
const ID_PATTERN = /^festa2026_[A-Za-z0-9]{16}$/;

/** 来場日として受け付ける値。⚠️ LPの select の option と一致させること */
const ALLOWED_DATES = new Set(['2026/10/10(土)', '2026/10/11(日)']);

/**
 * 制御文字。
 *
 * ⚠️ 除去は必須。フォームからは来ないが curl では送れる。混入すると
 *   一覧の表示やCSV出力が壊れ、メール本文ではヘッダ偽装の材料になる。
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * 文字列として取り出し、長さで切る。
 *
 * ⚠️ 上限を超えたらエラーにせず**切り詰める。** 長すぎるという理由で
 *   予約を捨てるのは損失が大きい。目的は TEXT 列を太らせないこと。
 */
const clean = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
};

/**
 * 複数選択（チェックボックス）をカンマ区切りにする。
 *
 * ⚠️ 区切りは**カンマのみ・スペースなし。** 既存データがこの形式であり
 *   （例: `中古住宅の相談,注文住宅の相談`）、変えると EventList の表示や
 *   既存の集計と揃わなくなる。
 *
 * ⚠️ 配列で来る前提だが、文字列1つで来ても受ける（フォームの実装が変わりうる）。
 */
const joinChoices = (value: unknown, maxItems: number, maxLength: number): string => {
  const list = Array.isArray(value) ? value : [value];
  const cleaned = list
    .slice(0, maxItems)
    .map((v) => clean(v, maxLength).replace(/,/g, '、'))
    .filter((v) => v !== '');
  return [...new Set(cleaned)].join(',');
};

/**
 * 電話番号。ハイフンや全角空白を落として数字だけにする。
 *
 * ⚠️ 数字以外が残っていても保存する。弾くと予約を失う。
 */
const normalizePhone = (value: string): string => {
  const digits = value.replace(/[-－\s　()（）]/g, '');
  return /^\+?\d{9,15}$/.test(digits) ? digits : value;
};

/** 空文字は NULL で保存する */
const orNull = (value: string): string | null => (value === '' ? null : value);

/** 受付日時（YYYY-MM-DD HH:MM:SS）。⚠️ コンテナは TZ=Asia/Tokyo 前提 */
const nowForDb = (): string => {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

interface CountRow extends RowDataPacket {
  c: number;
}

export interface EventResult {
  httpStatus: number;
  body: unknown;
}

/**
 * 予約を受け付ける。
 *
 * ⚠️ 応答に内部の情報を含めない。採番した `no` も返さない。
 *   フォーム側は成功・失敗しか見ていない。
 *
 * ⚠️ メール送信の失敗では 200 を返す。予約は保存済みであり、
 *   ここで失敗を返すと利用者が再送して**同じ人が二重に予約する。**
 *   （id が同じなら UNIQUE で弾かれるが、画面を開き直すと別idになる）
 */
export const runEventReservation = async (
  body: Record<string, unknown>
): Promise<EventResult> => {
  const id = clean(body.id, 64);

  if (!ID_PATTERN.test(id)) {
    // ⚠️ 形式の詳細は返さない。総当たりの手がかりになる
    return {
      httpStatus: 400,
      body: { status: 'error', message: '予約情報が正しくありません。お手数ですが最初からやり直してください。' },
    };
  }

  const name = clean(body.name, 64);
  if (name === '') {
    return { httpStatus: 400, body: { status: 'error', message: 'お名前を入力してください。' } };
  }

  const mail = clean(body.mail, 255);
  const phone = normalizePhone(clean(body.phone, 32));
  if (mail === '' && phone === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: 'メールアドレスか電話番号のいずれかを入力してください。' },
    };
  }

  const date = clean(body.date, 32);
  if (!ALLOWED_DATES.has(date)) {
    return { httpStatus: 400, body: { status: 'error', message: '来場日を選択してください。' } };
  }

  const time = clean(body.time, 16);
  if (time === '') {
    return { httpStatus: 400, body: { status: 'error', message: '来場時間を選択してください。' } };
  }

  const record = {
    id,
    title: EVENT_TITLE,
    date,
    time,
    name,
    kana: clean(body.kana, 64),
    mail,
    phone,
    address: clean(body.address, 128),
    area: clean(body.area, 128),
    interview: joinChoices(body.interview, 20, 64),
    // ⚠️⚠️ フォームの `request[]`（マイホームのご検討）は **`request_type`** という
    //   キーで送られてくる。`request` はゲートウェイのリクエスト種別
    //   （'event_reservation'）で予約済みのため、そのままでは使えない。
    //   ここを body.request にすると、保存される値が 'event_reservation' になる。
    request: joinChoices(body.request_type, 10, 64),
    // ⚠️ フォームは同意必須。'1' 以外が来たら未同意として保存する（弾かない）
    agree: clean(body.agree, 4) === '1' ? 1 : 0,
    reserved_at: nowForDb(),
  };

  try {
    // ⚠️ UNIQUE キーだけに頼らず、先に確認して分かりやすい応答を返す。
    //   利用者が「送信」を2回押したときに赤いエラーを出さないため。
    const existing = await query<CountRow>(
      'SELECT COUNT(*) AS c FROM event_db WHERE id = ?',
      [id]
    );
    if ((existing[0]?.c ?? 0) > 0) {
      return {
        httpStatus: 200,
        body: { status: 'ok', duplicate: true },
      };
    }

    const columns = Object.keys(record);
    const values: SqlParam[] = columns.map((col) => {
      const v = (record as Record<string, string | number>)[col];
      return typeof v === 'number' ? v : orNull(v);
    });

    await execute(
      `INSERT INTO event_db (${columns.map((c) => `\`${c}\``).join(', ')})
       VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );
  } catch (error) {
    // ⚠️ 例外の内容を応答に含めない（SQLや列名が漏れる）
    logger.error(`event_reservation の保存に失敗しました id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: 'ご予約の登録に失敗しました。時間をおいて再度お試しください。' },
    };
  }

  // ⚠️ ここから先の失敗では 400 / 500 を返さない。予約は保存済みである
  const payload: ReservationMailData = {
    id: record.id,
    name: record.name,
    kana: record.kana,
    date: record.date,
    time: record.time,
    mail: record.mail,
    phone: record.phone,
    address: record.address,
    area: record.area,
    interview: record.interview,
    request: record.request,
    title: record.title,
    agree: record.agree,
  };

  // ⚠️ QRは1回だけ作って両方のメールに渡す。
  //   顧客宛（当日の提示用）と社内宛（紛失時の再送用）の両方に添付する。
  const qr = await buildQrPng(record.id);

  const [confirmSent, noticeSent] = await Promise.all([
    sendReservationConfirm(payload, qr),
    sendInternalNotice(payload, qr),
  ]);

  if (!noticeSent) {
    // ⚠️ 社内通知が飛ばないと誰も予約に気づかない。ログには必ず残す
    logger.warn(`event_reservation の社内通知を送信できませんでした id=${id}`);
  }

  return {
    httpStatus: 200,
    body: { status: 'ok', mailSent: confirmSent },
  };
};
