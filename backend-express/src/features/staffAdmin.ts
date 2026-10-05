import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/pool';
import { logger } from '../utils/logger';

/**
 * スタッフ管理（ヘッダー → スタッフ管理）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面:
 *   header/EditAuth.tsx  … ログイン権限（`staff` テーブル）
 *   header/EditStaff.tsx … 人事マスタ（`staff_list` テーブル）
 *
 * ⚠️⚠️ **2つのテーブルは連携していない。** ⚠️ 片方を登録してももう片方には入らない。
 *
 * 移植元（2026-10-05 / v2.2.163）:
 *   header_edit_auth.php / header_auth_insert.php / header_auth_update.php
 *   header_staff_edit.php / header_staff_insert.php / header_staff_update.php
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **移植元の header_edit_auth.php は `SELECT * FROM staff` を返していた。**
 *
 *   ⚠️ ⚠️ **全スタッフの `api_token` と `password` がブラウザへ送られていた。**
 *     ⚠️ `api_token` はログイン状態そのもので、取得した人は
 *       ⚠️⚠️ **Master を含む誰にでもなりすませた。**
 *     ⚠️ しかも ① の入口にもハンドラにも ⚠️ **認証チェックが無かった。**
 *   ⚠️ `log` 列（合計221MB・485万件）も丸ごと返しており、
 *     ⚠️ ローカルでは ⚠️ **PHP のメモリ上限で落ちて画面が開けなかった。**
 *
 *   ⚠️⚠️ **ここでは返す列を必ず明示する。** ⚠️ `SELECT *` を書かないこと。
 *     ⚠️ `password` / `api_token` / `log` は ⚠️⚠️ **どの関数からも返さない。**
 * ─────────────────────────────────────────────
 */

// ===========================================================================
// 選択肢
// ===========================================================================

/**
 * 権限（`staff.brand`）として保存してよい値。⚠️ 画面の選択肢もこの順。
 *
 * ⚠️⚠️ **ここに無い値は保存させない。**
 *   ⚠️ リクエストの値をそのまま入れると、画面のどの選択肢にも一致しない権限が残る。
 *   ⚠️ 実データには ⚠️ `insideSales`（1名）/ `BrandAdimn`（綴り違い・1名）/ 空（12名）がある。
 *     ⚠️ ⚠️ **それらは「現在の値」として表示だけし、勝手に書き換えない**（画面側）。
 *
 * ⚠️ `insideSales` は Menu.tsx の「ISカレンダー」の判定に使われている。
 *   ⚠️ 選択肢に無いので**この画面からは付与できない**（2026-10-05 時点の指示どおり）。
 */
export const AUTH_BRANDS = ['Master', 'BrandAdmin', 'ordinary', 'Consulting'] as const;

/**
 * 事業区分（`staff.shop`）として保存してよい値。⚠️ 画面の選択肢もこの順。
 *
 * ⚠️⚠️ **`staff.shop` は店舗名ではない。** ⚠️ 事業区分である。
 *   ⚠️ Category.tsx が「選んだ事業区分と一致するか、`all` か」で入場を判定している。
 *   ⚠️ ⚠️ **空だとどの事業区分にも入れない**（2026-10-05 に実際に起きた）。
 *
 * ⚠️ `all` は指示書には無かったが、⚠️ **Master / BrandAdmin の多くが `all`**（29名）。
 *   ⚠️ 選択肢から外すと、⚠️⚠️ **全事業を見られる人をこの画面で作れなくなる**ため加えた
 *   （2026-10-05 に利用者と確認済み）。
 */
export const AUTH_SHOPS = ['order', 'spec', 'used', 'all'] as const;

const isAuthBrand = (value: string): boolean => (AUTH_BRANDS as readonly string[]).includes(value);
const isAuthShop = (value: string): boolean => (AUTH_SHOPS as readonly string[]).includes(value);

/** ⚠️ login.php と同じ判定（`filter_var(FILTER_VALIDATE_EMAIL)` に近いもの） */
const isMail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * パスワードのハッシュ化。
 *
 * ⚠️⚠️ **ログインは Google 認証に移行済みで、`staff.password` を読む処理は無い**（2026-10-05 時点）。
 *   ⚠️ それでも平文で持つ理由は無いので、⚠️ **書き込むときは必ずハッシュにする**（利用者と確認済み）。
 *   ⚠️ 既存の210名分は平文のまま残っている。⚠️ ⚠️ **ここでは一括変換していない。**
 *
 * ⚠️ `bcryptjs` は `$2b$` 形式。⚠️ PHP の `password_verify()` でも照合できる。
 */
const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, 10);

// ===========================================================================
// ログイン権限（staff）
// ===========================================================================

interface AuthRow extends RowDataPacket {
  id: number;
  name: string;
  brand: string;
  shop: string;
  mail: string;
  heartbeat: string;
  /** ⚠️ パスワードの**有無だけ**。⚠️⚠️ 値そのものは返さない */
  has_password: number;
}

/**
 * ログイン権限の一覧。
 *
 * ⚠️⚠️ **返す列を明示している。** ⚠️ `password` / `api_token` / `log` は返さない。
 *
 * ⚠️ 総アクセス時間は ⚠️ **ここでは返さない。** ⚠️ `runAuthAccessTimes()` で別に取る。
 *   ⚠️ 計算に `log`（485万件）を読む必要があり、一覧と一緒に出すと
 *   ⚠️ ⚠️ **画面がそのぶん待たされる。** ⚠️ 一覧を先に出し、時間は後から埋める。
 *
 * ⚠️ 移植元の画面は `mail` が空の行を出していなかった。⚠️ 同じ条件をここで掛ける。
 */
export const runAuthList = async (): Promise<{ staff: AuthRow[] }> => {
  const staff = await query<AuthRow>(
    `SELECT id, name, brand, shop, mail, heartbeat,
            (password <> '') AS has_password
       FROM staff
      WHERE mail <> ''
      ORDER BY id`
  );
  return { staff };
};

// ---------------------------------------------------------------------------
// 総アクセス時間
// ---------------------------------------------------------------------------

/** ログ1件。⚠️ `time` は `2026-04-08 11:04:59` の形 */
interface LogEntry {
  time?: string;
}

/**
 * ログを配列として取り出す。
 * ⚠️ mysql2 がパース済みで返す場合と文字列で返す場合の両方に備える
 *   （interview_log で文字列前提にして全件壊した前例がある）。
 */
const toLog = (value: unknown): LogEntry[] => {
  if (Array.isArray(value)) return value as LogEntry[];
  if (value === null || value === undefined || value === '') return [];
  try {
    const parsed: unknown = JSON.parse(String(value));
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return [];
  }
};

/**
 * 総アクセス時間（秒）。
 *
 * ⚠️⚠️ **EditAuth.tsx の `calculateTotalAccessTime()` と同じ結果になること。**
 *   ⚠️ 元の考え方: 間隔が60秒**未満**の間は同じセッションとみなし、
 *     セッションの長さ（最後 − 最初）を合算する。
 *   ⚠️ ⚠️ **これは「60秒未満の間隔だけを全部足す」と同じ**なので、そう書いている。
 *
 * ⚠️ 実測（2026-10-05 / ローカル）: ⚠️⚠️ **230人全員、元の計算と1秒単位で一致した。**
 *
 * ⚠️ 日付は元と同じく `-` を `/` に置き換えてから `new Date()` に渡す
 *   （⚠️ `2026-04-08 11:04:59` をそのまま渡すと環境によって読めない）。
 */
export const totalAccessSeconds = (log: unknown): number => {
  const times = toLog(log)
    .map((entry) => new Date(String(entry.time ?? '').replace(/-/g, '/')).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  let total = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = (times[i] - times[i - 1]) / 1000;
    if (gap < 60) total += gap;
  }
  return Math.floor(total);
};

/**
 * 計算済みの総アクセス時間。⚠️ キーは staff.id。
 *
 * ⚠️⚠️ **`heartbeat`（最終アクセス日時）が前回と同じなら計算し直さない。**
 *   ⚠️ `log` を書いているのは ① の heartbeat.php だけで、
 *     ⚠️⚠️ **`heartbeat` と `log` を必ず同じ UPDATE 文で書いている。**
 *     ⚠️ `heartbeat` が同じなら `log` も同じとみなせる。
 *   ⚠️ ⚠️ **`LENGTH(log)` を目印にしないこと。** ⚠️ 長さを測るだけで221MBを読み、
 *     ⚠️ 実測で ⚠️ **毎回3秒以上**かかってキャッシュの意味が無くなった。
 *   ⚠️ ⚠️ **heartbeat.php 以外で log を書くようにしたら、この前提が崩れる。**
 *
 * ⚠️ 実測（2026-10-05 / ローカル）: ⚠️ 全員を毎回計算すると ⚠️⚠️ **約4〜19秒**かかる。
 *   ⚠️ SQL（JSON_TABLE + LAG）で計算すると ⚠️ **約47秒**で、さらに遅かった。
 *
 * ⚠️ プロセスのメモリに持つだけなので、⚠️ **② を再起動すると最初の1回は遅い。**
 */
const accessTimeCache = new Map<number, { heartbeat: string; seconds: number }>();

interface HeartbeatRow extends RowDataPacket {
  id: number;
  heartbeat: string;
}

interface LogRow extends RowDataPacket {
  log: unknown;
}

export const runAuthAccessTimes = async (): Promise<{ status: 'ok'; times: Record<number, number> }> => {
  const marks = await query<HeartbeatRow>("SELECT id, heartbeat FROM staff WHERE mail <> ''");

  const times: Record<number, number> = {};
  let recalculated = 0;

  for (const row of marks) {
    const heartbeat = String(row.heartbeat ?? '');
    const cached = accessTimeCache.get(row.id);
    if (cached !== undefined && cached.heartbeat === heartbeat) {
      times[row.id] = cached.seconds;
      continue;
    }

    /**
     * ⚠️⚠️ **1人ずつ取る。** ⚠️ 全員まとめて取ると221MBを一度にメモリへ載せる
     *   （⚠️ 最大の人は1人で8.2MB）。
     */
    const [logRow] = await query<LogRow>('SELECT log FROM staff WHERE id = ? LIMIT 1', [row.id]);
    const seconds = totalAccessSeconds(logRow?.log);
    accessTimeCache.set(row.id, { heartbeat, seconds });
    times[row.id] = seconds;
    recalculated += 1;
  }

  if (recalculated > 0) {
    logger.info(`header_auth_access_time: ${recalculated}人分を計算し直しました（全${marks.length}人）`);
  }
  return { status: 'ok', times };
};

// ---------------------------------------------------------------------------
// 新規作成
// ---------------------------------------------------------------------------

interface CountRow extends RowDataPacket {
  c: number;
}

export interface WriteResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const fail = (message: string, httpStatus = 400): WriteResult => ({
  httpStatus,
  body: { status: 'error', message },
});

/** 同じメールアドレスの人がいるか。⚠️ `exceptId` は自分自身を除くため */
const mailTaken = async (mail: string, exceptId: number | null): Promise<boolean> => {
  const rows = exceptId === null
    ? await query<CountRow>('SELECT COUNT(*) AS c FROM staff WHERE mail = ?', [mail])
    : await query<CountRow>('SELECT COUNT(*) AS c FROM staff WHERE mail = ? AND id <> ?', [mail, exceptId]);
  return Number(rows[0]?.c ?? 0) > 0;
};

/**
 * ログイン用アカウントを作る。
 *
 * ⚠️⚠️ **移植元は `name, brand, mail` の3列しか INSERT していなかった。**
 *   ⚠️ ⚠️ **`shop`（事業区分）が必ず空になり、作った人は注文営業の画面に入れなかった**
 *     （2026-10-05 に舟木さんで実際に起きた）。
 *   ⚠️ `staff` は ⚠️ **既定値なしの NOT NULL 列が9つある。**
 *     ⚠️ STRICT モードなら INSERT ごと失敗する（⚠️ 本番はモードが緩く空文字で通っていた）。
 *   ⚠️ ⚠️ **ここでは全部埋める。**
 *
 * ⚠️⚠️ **メールアドレスの重複は登録させない。**
 *   ⚠️ login.php がメールアドレスだけで本人を特定するため、
 *   ⚠️ 重複すると後から登録した人がログインできなくなる。
 */
export const runAuthInsert = async (body: Record<string, unknown>): Promise<WriteResult> => {
  const name = text(body.name);
  const mail = text(body.mail);
  const brand = text(body.brand) === '' ? 'ordinary' : text(body.brand);
  const shop = text(body.shop);
  const password = typeof body.password === 'string' ? body.password : '';

  if (name === '') return fail('氏名を入力してください。');
  if (!isMail(mail)) return fail('有効なメールアドレスを入力してください。');
  if (!isAuthBrand(brand)) return fail('許可されていない権限です。');
  // ⚠️⚠️ **事業区分は必須。** ⚠️ 空で作ると、その人はどの画面にも入れない
  if (!isAuthShop(shop)) return fail('事業区分を選択してください。');

  if (await mailTaken(mail, null)) return fail('このメールアドレスは既に登録されています。');

  const hashed = password === '' ? '' : await hashPassword(password);

  const result = await execute(
    `INSERT INTO staff (name, brand, shop, mail, password, api_token, timestamp, url, heartbeat, flag)
     VALUES (?, ?, ?, ?, ?, '', '', '', '', 1)`,
    [name, brand, shop, mail, hashed]
  );

  return {
    httpStatus: 200,
    body: { status: 'success', message: 'ログイン用アカウントを作成しました。', id: result.insertId },
  };
};

// ---------------------------------------------------------------------------
// 更新
// ---------------------------------------------------------------------------

/** 更新してよい列。⚠️ 画面の入力欄と1対1 */
const AUTH_FIELDS = ['name', 'brand', 'shop', 'mail', 'password'] as const;
type AuthField = (typeof AUTH_FIELDS)[number];

/**
 * ログイン権限を1項目だけ更新する。
 *
 * 受け取る形: `{ id, field, value }`
 *
 * ⚠️⚠️ **旧い画面の形 `{ id, brand }` も受ける。**
 *   ⚠️ デプロイ直後は、⚠️ **古い main.js を開いたままの利用者がいる。**
 *   ⚠️ 受けないと、その人が権限を変えたときに何も起きなくなる。
 *
 * ⚠️⚠️ **① の header_auth_update.php は `brand` しか扱えない。**
 *   ⚠️ 新しい形を ① へ流すと ⚠️ **`brand` が空で上書きされ、その人の権限が消える。**
 *   ⚠️ ⚠️ **そのため expressProxyExclusive() に入れ、① へはフォールバックさせない。**
 */
export const runAuthUpdate = async (body: Record<string, unknown>): Promise<WriteResult> => {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return fail('対象が見つかりません。');

  let field = text(body.field) as AuthField;
  let raw: unknown = body.value;

  // ⚠️ 旧い画面（`{ id, brand }`）
  if (field === ('' as AuthField) && typeof body.brand === 'string') {
    field = 'brand';
    raw = body.brand;
  }

  if (!(AUTH_FIELDS as readonly string[]).includes(field)) return fail('変更できない項目です。');

  // ⚠️ パスワードだけは前後の空白を削らない（⚠️ 空白も文字として扱う）
  const value = field === 'password' ? (typeof raw === 'string' ? raw : '') : text(raw);

  switch (field) {
    case 'name':
      if (value === '') return fail('氏名を入力してください。');
      break;
    case 'brand':
      if (!isAuthBrand(value)) return fail('許可されていない権限です。');
      break;
    case 'shop':
      if (!isAuthShop(value)) return fail('許可されていない事業区分です。');
      break;
    case 'mail':
      if (!isMail(value)) return fail('有効なメールアドレスを入力してください。');
      if (await mailTaken(value, id)) return fail('このメールアドレスは既に登録されています。');
      break;
    case 'password':
      // ⚠️ 空で上書きさせない（⚠️ 消したいという操作はこの画面に無い）
      if (value === '') return fail('パスワードを入力してください。');
      break;
  }

  const stored = field === 'password' ? await hashPassword(value) : value;

  // ⚠️ 列名は上の許可リストを通ったものだけ。⚠️ リクエストの文字列を直接埋めていない
  const result = await execute(`UPDATE staff SET \`${field}\` = ? WHERE id = ?`, [stored, id]);
  if (result.affectedRows === 0) return fail('対象が見つかりません。', 404);

  return { httpStatus: 200, body: { status: 'success' } };
};

// ===========================================================================
// 人事マスタ（staff_list）
// ===========================================================================

/**
 * 人事マスタの一覧と、選択肢のマスタ。
 *
 * ⚠️ 移植元は `SELECT * FROM staff_list` から `mail` を落として返していた。
 *   ⚠️ ⚠️ **ここでは返す列を明示する**（⚠️ 列が増えても勝手に流れないように）。
 *
 * ⚠️ `auth_names` は新規登録時の氏名サジェスト用（⚠️ `staff` の氏名だけ）。
 */
export const runStaffEdit = async (): Promise<Record<string, unknown>> => {
  const [staff, section, shop, authNames] = await Promise.all([
    query<RowDataPacket>(
      `SELECT id, name, pg_id, shop, section, robo_id, status, category, \`rank\`, multi,
              khg_id, sort, report, estate, memo, period, position, inside
         FROM staff_list`
    ),
    query<RowDataPacket>('SELECT * FROM section_list'),
    query<RowDataPacket>('SELECT * FROM shop_list'),
    query<RowDataPacket>("SELECT DISTINCT `name` FROM `staff` WHERE `name` <> '' ORDER BY `name`"),
  ]);

  return {
    staff,
    section,
    shop,
    auth_names: authNames.map((r) => String(r.name)),
  };
};

/** スイッチ（0/1）の列。⚠️ `1` 以外はすべて `0` として保存する */
const FLAG_COLUMNS = ['category', 'rank', 'report', 'multi', 'estate', 'inside'] as const;

const flag = (value: unknown): number => (String(value ?? '') === '1' ? 1 : 0);

/**
 * 人事マスタへ1人登録する。
 *
 * ⚠️⚠️ **課と店舗は必須にした**（2026-10-05）。
 *   ⚠️ 移植元の画面は、新規行の課と店舗に ⚠️ **マスタの先頭（鹿児島営業1課・KH霧島店）が
 *     最初から選ばれた状態**で表示していた。
 *   ⚠️ ⚠️ **触らずに登録するとそれが保存され、選んだように見えるので気づけなかった。**
 *   ⚠️ 画面側は空から始めるように変えたが、⚠️ **古い画面からも来るのでここでも弾く。**
 *
 * ⚠️ `staff_list` は ⚠️ **id と inside を除く全列が NOT NULL・既定値なし。**
 *   ⚠️ この画面で扱わない列（pg_id / robo_id / mail / memo / sort）も必ず埋める。
 */
export const runStaffInsert = async (body: Record<string, unknown>): Promise<WriteResult> => {
  const name = text(body.name);
  const section = text(body.section);
  const shop = text(body.shop);
  const period = text(body.period);

  if (name === '') return fail('氏名を入力してください。');
  if (section === '') return fail('所属（課）を選択してください。');
  if (shop === '') return fail('店舗を選択してください。');
  if (period === '') return fail('年度を選択してください。');

  const result = await execute(
    `INSERT INTO staff_list (
        khg_id, pg_id, robo_id, name, position, mail, memo, sort,
        status, section, shop,
        category, \`rank\`, report, multi, estate, inside, period
     ) VALUES (?, '', '', ?, ?, '', '', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      text(body.khg_id),
      name,
      text(body.position) === '' ? '一般' : text(body.position),
      text(body.status) === '' ? '在籍' : text(body.status),
      section,
      shop,
      ...FLAG_COLUMNS.map((column) => flag(body[column])),
      period,
    ]
  );

  return {
    httpStatus: 200,
    body: { status: 'success', message: 'スタッフを新規登録しました。', id: result.insertId },
  };
};

/** 1項目ずつ更新してよい列。⚠️ 移植元と同じ */
const STAFF_COLUMNS = [
  'status', 'section', 'shop', 'category', 'rank', 'report', 'estate', 'multi', 'inside', 'period', 'position',
] as const;

/**
 * 人事マスタを1項目だけ更新する。
 *
 * 受け取る形: `{ id, <列名>: 値 }`（⚠️ 移植元と同じ）
 *
 * ⚠️ 移植元は「`id` 以外で最初に出てきたキー」を列名にしていた。
 *   ⚠️ キーの順番に依存していて、`request` が先に来ると壊れる。
 *   ⚠️ ⚠️ **ここでは許可リストにある列を探す。**
 */
export const runStaffUpdate = async (body: Record<string, unknown>): Promise<WriteResult> => {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return fail('対象が見つかりません。');

  const column = STAFF_COLUMNS.find((c) => Object.prototype.hasOwnProperty.call(body, c));
  if (column === undefined) return fail('更新対象のキーが見つかりません。');

  const isFlag = (FLAG_COLUMNS as readonly string[]).includes(column);
  const value = isFlag ? flag(body[column]) : text(body[column]);

  // ⚠️ 課・店舗・年度は空にさせない（⚠️ 空にすると集計から消える）
  if (!isFlag && value === '' && ['section', 'shop', 'period'].includes(column)) {
    return fail('空にはできません。');
  }

  await execute(`UPDATE staff_list SET \`${column}\` = ? WHERE id = ?`, [value, id]);
  return { httpStatus: 200, body: { status: 'success', message: 'アップデートに成功しました。' } };
};
