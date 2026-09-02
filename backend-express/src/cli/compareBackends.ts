/**
 * PHP と Express に同じリクエストを投げ、返ってきたJSONの差分を出す。
 *
 * ─────────────────────────────────────────────
 * なぜこれが必要か
 *
 *   移植で最も多い事故は「動くけれど形が違う」こと。
 *
 *     PHP     : { "sync": "0", "category": "1" }   ← 数値が文字列
 *     mysql2  : { "sync": 0,   "category": 1 }
 *
 *   フロントには `item.sync === 1` のような厳密比較が多数あり、
 *   型が変わるだけで条件が false になって画面が静かに壊れる。
 *   目視レビューでは気づけないため、機械的に比較する。
 *
 *   行数や合計値の一致だけでは不十分で、
 *   「キーの有無」「値の型」「順序」まで見る必要がある。
 * ─────────────────────────────────────────────
 *
 * 使い方
 *
 *   PHP_BASE=https://khg-marketing.info/dashboard/api/gateway/ \
 *   EXPRESS_BASE=http://localhost:3001/api/gateway \
 *   TOKEN=<staff.api_token> \
 *   npx tsx src/cli/compareBackends.ts --case cases/menu.json
 *
 *   ケースファイルは「フロントが送るボディ」そのもの。
 *     { "request": "menu" }
 *     { "request": "list", "category": "order" }
 *
 * ⚠️ 参照系のみに使うこと。
 *   更新系（insert / update / tag など）を投げると本番データが2回書き換わる。
 *   書き込みを伴うリクエストは自動で拒否している（WRITE_HINTS を参照）。
 *
 *   名前に更新系の語を含むが実際は SELECT のみ、という例外がある
 *   （update_log.php など）。その場合だけ --read-only-verified を付ける。
 *   ⚠️ 移植元のPHPを実際に読んで確認してから付けること。
 */

import { readFileSync } from 'node:fs';

interface Options {
  phpBase: string;
  expressBase: string;
  token: string;
  body: Record<string, unknown>;
  /** 差分の表示件数上限。全件出すとログが読めなくなる */
  maxDiffs: number;
  /**
   * 名前による更新系の拒否を解除する。
   *
   * ⚠️ 移植元のPHPを実際に読んで SELECT のみだと確認できた場合のみ付けること。
   *   例: update_log.php は名前に update を含むが SELECT しかしていない。
   */
  readOnlyVerified: boolean;
}

/**
 * 書き込みを伴う可能性のあるリクエスト名の断片。
 *
 * ⚠️ 完全ではない。名前から判断しているだけなので、
 *   ここに載っていない更新系もあり得る。
 *   実行前に必ず移植元のPHPを読んで、SELECTのみか確認すること。
 */
const WRITE_HINTS = [
  'insert',
  'update',
  'delete',
  'edit',
  'add',
  'change',
  'sync',
  'tag',
  'login',
  'token',
  'heartbeat',
  'upsert',
  'import',
  'send',
  'mail',
];

const parseArgs = (): Options => {
  const argv = process.argv.slice(2);

  const valueOf = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    if (index !== -1 && argv[index + 1] !== undefined) return argv[index + 1];
    const inline = argv.find((a) => a.startsWith(`--${name}=`));
    return inline?.split('=').slice(1).join('=');
  };

  const casePath = valueOf('case');
  const inlineBody = valueOf('body');

  if (casePath === undefined && inlineBody === undefined) {
    fail('--case <ファイル> または --body \'{"request":"menu"}\' を指定してください');
  }

  const raw = casePath === undefined ? (inlineBody as string) : readFileSync(casePath, 'utf8');

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    fail(`ケースのJSONが壊れています: ${(error as Error).message}`);
  }

  const phpBase = process.env.PHP_BASE ?? valueOf('php');
  const expressBase = process.env.EXPRESS_BASE ?? valueOf('express');

  if (phpBase === undefined || phpBase === '') fail('PHP_BASE を設定してください');
  if (expressBase === undefined || expressBase === '') fail('EXPRESS_BASE を設定してください');

  return {
    phpBase,
    expressBase,
    token: process.env.TOKEN ?? '',
    body,
    // 同じ原因でまとめて表示するため、内部的には多めに集める。
    // 数万行のレスポンスでも「原因の種類」は数個に収まる
    maxDiffs: Number(valueOf('max-diffs') ?? 5000),
    readOnlyVerified: argv.includes('--read-only-verified'),
  };
};

function fail(message: string): never {
  console.error(`エラー: ${message}`);
  process.exit(1);
}

const assertReadOnly = (body: Record<string, unknown>, readOnlyVerified: boolean): void => {
  const signature = [body.request, body.roll, body.category]
    .filter((v) => typeof v === 'string')
    .join(' ')
    .toLowerCase();

  const hit = WRITE_HINTS.find((hint) => signature.includes(hint));
  if (hit === undefined) return;

  // ⚠️ 既定は拒否のまま。付け忘れで本番を二重更新する事故を防ぐため、
  //   解除は必ず明示的なオプションを要求する。
  if (readOnlyVerified) {
    console.log(
      `⚠️ "${hit}" を含みますが --read-only-verified が指定されたため実行します（${signature}）。\n` +
        '   移植元のPHPが SELECT のみであることを確認済みという前提です。'
    );
    console.log('');
    return;
  }

  fail(
    `"${hit}" を含むリクエストは更新系の可能性があるため実行しません（${signature}）。\n` +
      '本番データが2回書き換わる恐れがあります。参照系のみを比較してください。\n' +
      '移植元のPHPを読んで SELECT のみだと確認できた場合は --read-only-verified を付けてください。'
  );
};

const post = async (
  url: string,
  body: Record<string, unknown>,
  token: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; text: string; ms: number }> => {
  const startedAt = Date.now();

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token !== '') headers.Token = token;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return { status: response.status, text: await response.text(), ms: Date.now() - startedAt };
};

/** 値の種類。型が変わったことを検出するために使う */
const kindOf = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

/**
 * 差分1件。
 *
 * ⚠️ 「どこが」（path）と「何が」（reason）を、具体的な値（detail）と
 *   分けて持つこと。1本の文字列にまとめると、まとめ表示のときに
 *   値まで含めてグループ化してしまい、
 *   「値が違う行の数」＝「原因の種類」になって集計が意味を失う。
 */
interface Diff {
  path: string;
  reason: string;
  detail: string;
}

/**
 * 2つのJSONを再帰的に比較して差分を列挙する。
 *
 * ⚠️ 型の違い（"0" と 0）を必ず差分として報告すること。
 *   ここを緩めると、このスクリプトを作った意味がなくなる。
 */
const diff = (
  a: unknown,
  b: unknown,
  path: string,
  out: Diff[],
  limit: number
): void => {
  if (out.length >= limit) return;

  const kindA = kindOf(a);
  const kindB = kindOf(b);

  if (kindA !== kindB) {
    out.push({
      path,
      reason: '型が違う',
      detail: `PHP=${kindA}(${preview(a)})  Express=${kindB}(${preview(b)})`,
    });
    return;
  }

  if (kindA === 'array') {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) {
      out.push({
        path,
        reason: '件数が違う',
        detail: `PHP=${arrA.length}  Express=${arrB.length}`,
      });
    }
    const shorter = Math.min(arrA.length, arrB.length);
    for (let i = 0; i < shorter; i += 1) {
      diff(arrA[i], arrB[i], `${path}[${i}]`, out, limit);
      if (out.length >= limit) return;
    }
    return;
  }

  if (kindA === 'object') {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    for (const key of keysA) {
      if (!(key in objB)) out.push({ path: `${path}.${key}`, reason: 'Express に無い', detail: '' });
    }
    for (const key of keysB) {
      if (!(key in objA)) {
        out.push({ path: `${path}.${key}`, reason: 'PHP に無い（余分）', detail: '' });
      }
    }

    for (const key of keysA) {
      if (!(key in objB)) continue;
      diff(objA[key], objB[key], `${path}.${key}`, out, limit);
      if (out.length >= limit) return;
    }
    return;
  }

  if (a !== b) {
    out.push({
      path,
      reason: '値が違う',
      detail: `PHP=${preview(a)}  Express=${preview(b)}`,
    });
  }
};

const preview = (value: unknown): string => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined) return 'undefined';
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  assertReadOnly(options.body, options.readOnlyVerified);

  console.log('');
  console.log('リクエスト:', JSON.stringify(options.body));
  console.log('');

  // ⚠️⚠️ PHP 側には必ず X-Forwarded-By を付ける。
  //
  //   ① の core/express_proxy.php は「移植済み」の request を ② へ転送する。
  //   その状態で素のまま叩くと、PHP 側の応答が実は Express になり、
  //   **Express 同士を比較して必ず「差分なし」になる**（偽の合格）。
  //
  //   このヘッダが付いていると ① は転送せず自分で処理するため、
  //   移植済みのものでも本来のPHPの応答と比較できる。
  //   （② のループ検知と同じヘッダを利用している）
  const [php, express] = await Promise.all([
    post(options.phpBase, options.body, options.token, { 'X-Forwarded-By': 'compare-tool' }),
    post(options.expressBase, options.body, options.token),
  ]);

  console.log(`PHP     : HTTP ${php.status}  ${php.ms}ms  ${php.text.length.toLocaleString()} bytes`);
  console.log(
    `Express : HTTP ${express.status}  ${express.ms}ms  ${express.text.length.toLocaleString()} bytes`
  );
  console.log('');

  if (php.status !== express.status) {
    console.log(`⚠️ ステータスコードが違います（PHP=${php.status} / Express=${express.status}）`);
    console.log('');
  }

  let parsedPhp: unknown;
  let parsedExpress: unknown;

  try {
    parsedPhp = JSON.parse(php.text);
  } catch {
    console.log('PHP のレスポンスがJSONではありません。先頭300文字:');
    console.log(php.text.slice(0, 300));
    process.exit(1);
  }
  try {
    parsedExpress = JSON.parse(express.text);
  } catch {
    console.log('Express のレスポンスがJSONではありません。先頭300文字:');
    console.log(express.text.slice(0, 300));
    process.exit(1);
  }

  const diffs: Diff[] = [];
  diff(parsedPhp, parsedExpress, '$', diffs, options.maxDiffs);

  if (diffs.length === 0) {
    console.log('✅ 差分なし。移植して問題ありません。');
    console.log('');
    return;
  }

  // ⚠️ 生の差分をそのまま並べると、同じ原因の行が数万件出て読めなくなる。
  //   （型違いが1列あるだけで「行数 × 列数」件の差分になる）
  //   配列の添字を潰し、**パスと理由だけ**でまとめる。
  //
  // ⚠️ 具体的な値（detail）をキーに含めてはいけない。
  //   値が行ごとに違うのは当たり前なので、含めると
  //   「原因の種類」＝「差分の件数」になって集計の意味が消える。
  const groups = new Map<string, { count: number; example: string }>();

  for (const d of diffs) {
    const key = `${d.path.replace(/\[\d+\]/g, '[]')}: ${d.reason}`;
    const example = d.detail === '' ? d.path : `${d.path}  ${d.detail}`;
    const existing = groups.get(key);
    if (existing === undefined) groups.set(key, { count: 1, example });
    else existing.count += 1;
  }

  console.log(
    `❌ 差分 ${diffs.length} 件${diffs.length >= options.maxDiffs ? '以上（上限に達したため打ち切り）' : ''}` +
      ` / 原因は ${groups.size} 種類`
  );
  console.log('');

  const sorted = [...groups.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [key, { count, example }] of sorted) {
    console.log(`  ×${String(count).padStart(6)}  ${key}`);
    console.log(`          例: ${example}`);
  }
  console.log('');
  console.log('よくある原因:');
  console.log('  ・件数が違う → 両者が同じDBを見ているか確認する（ローカルDBのダンプは古い）');
  console.log('  ・型が違う（number と string）→ 値を変換していないか確認する。');
  console.log('    ① の PDO は EMULATE_PREPARES=false のため INT を数値で返す。');
  console.log('    mysql2 と最初から一致するので、文字列化してはいけない');
  console.log('  ・日付の形式 → pool.ts の dateStrings:true で文字列のまま返している。');
  console.log('    自分で new Date() を挟むとタイムゾーンでずれる');
  console.log('  ・順序が違う → PHPのSQLに ORDER BY が無い。同じ並びを保証できないため、');
  console.log('    行の中身が同じかを別途確認する');
  console.log('  ・NULL と空文字 → COALESCE の有無をPHPと突き合わせる');
  console.log('');
  process.exitCode = 1;
};

main().catch((error: unknown) => {
  console.error('比較に失敗しました', error);
  process.exitCode = 1;
});
