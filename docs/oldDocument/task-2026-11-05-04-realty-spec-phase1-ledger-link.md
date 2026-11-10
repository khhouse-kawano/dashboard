# 作業記録 2026-11-05-04　v2.2.248 不動産企画係：連動トリガー仕様書の ① 媒介獲得

## 依頼
- 「いくつか改修の方針に矛盾が生じている。連動トリガー仕様書（PDF・2026-11-04）を正として進める」
- 利用者の決定（AskUserQuestion）
  - 段階・現況の名前は変えない。仕様書の名前とは対応表で読み替える
  - 最初は ① 媒介獲得（必須の項目と、処理を1つにまとめる）
  - 仕様書の要約を docs に置き、引き継ぎ書に「この仕様書が正」と書く。v2.2.248 のブランチで始める
- 途中で「v2.2.247 を先にビルド」の指示 → v2.2.247 のブランチで `npm run build` をして、v2.2.248 に戻った（`frontend/build/` は 2.2.247 のまま）
- ① の計画を見せ、「進めてよい」の了承を得てから実装した

## 文書（先に push 済み・93a385e0d）
- **新規** `docs/realty-trigger-spec.md`：仕様書の要約（共通ルール・①〜⑤・付録）、利用者の決定、名前の対応表（ローカルの件数つき）、今の作りとの食い違い15項目
- `docs/realty-handoff.md`
  - 冒頭に「正は仕様書」と書いた
  - 読む順番に仕様書の要約を入れた
  - 方針の節を書き換えた
  - 次の予定を ①→②→③→④⑤ にし、判断待ちを足した
  - 「5. 次にやること」を v2.2.248 ① にした

## 変えたこと（コード）
### ②（VPS）
- **新規** `backend-express/src/features/realty/ledgerLink.ts`：`planner:ledger_link`
  - 前提条件（`problemsOf`）。満たさなければ何も書かずに 400 と、足りない項目の名前（problems）を返す
    - 媒介の種類（専属専任媒介・専任媒介・一般媒介）
    - 媒介契約日（未来の日付は不可）
    - 満了日（契約日より後。専任・専属専任は `maxExpiryOf`＝契約日の3か月後の前日まで。3か月後に同じ日が無ければ、その月の末日）
    - 売出価格（1円以上の整数）
    - 担当者・売主・所在地・種別
  - `withTransaction` の中で、次をまとめて行う
    1. 売り反響を `FOR UPDATE` で押さえる。台帳 No. がもうあれば作らずに `status: 'exists'` と、その No. を返す
    2. 台帳の最大 No. を `FOR UPDATE` で数えて +1（削除済みの台帳の No. も使わない）
    3. 台帳を INSERT する
       - 現況は情報整理中、propStatus はアクティブ
       - `expiry` に満了日、担当は設定の略称を入れる
       - 一般媒介の他の依頼先は、備考に書き足す
    4. 売り反響を、媒介受託・媒介契約日・ledgerNo・ledgerId にし、endReason を消す
    5. 変更履歴：売り反響のフェーズ（変わったとき）と、台帳の作成
  - 実施者は `resolveMe`（設定の担当者名）
- `backend-express/src/features/realty/calls.ts`：`jstNow`・`uid`・`resolveMe` を export した（中身は変えていない）
- `backend-express/src/gateway/registry.ts`：`planner:ledger_link` を登録した（staff、REALTY_SHOPS）

### ①（PHP）
- `backend/src/core/express_proxy.php`：`expressProxyRequests()` と `expressProxyExclusive()` の両方に `planner:ledger_link` を足した

### フロント
- `frontend/src/components/realty/common/leadLinks.ts`
  - `LEDGER_BAIKAI_TYPES`：専属専任媒介・専任媒介・一般媒介（買取を外した）
  - **追加**
    - `maxExpiryOf`
    - `ledgerFormProblems`（② の `problemsOf` と同じ）
    - `ledgerFormWarning`（一般媒介で3か月を超えるときの確認）
    - `linkLedger`（② を呼ぶ。form は JSON 文字列）
    - 型 `LedgerLinkResult`
  - `LedgerForm` に `expiry`・`otherBrokers` を足した。`ledgerFormOf` は満了日の初期値を入れる
  - **削除**：`ledgerFormError`・`leadToLedger`・`linkLedgerWithNotice`・`noticeLedgerOnSellScreen`（② に移した・使わなくなった）。使わなくなった `StaffSetting` の import も消した
- `frontend/src/components/realty/common/LedgerLinkModal.tsx`（書き直し）
  - 項目：満了日・一般媒介の他の依頼先を足した。必須の印を付けた
  - 契約日を変えると、満了日を初期値に入れ直す
  - 足りない項目は、上に赤で一覧する
  - 作ったら「台帳 No.X を作り…」と「媒介獲得台帳で No.X を開く」を出す（`/broker?ledgerNo=X` へ）
- `frontend/src/components/realty/sell/LeadSell.tsx`
  - `submitLedger` は `linkLedger` だけを呼ぶ（v2.2.247 は、段階 → 台帳 → 台帳 No. と別々に保存していた）
  - 編集画面で媒介受託にして保存したとき、台帳が無ければ段階は元のまま（ほかの項目だけ）保存し、媒介紐付の画面を開く
- `frontend/src/components/realty/common/LeadEdit.tsx`：**追加** prop `ledgerOnSellScreen`
  - 台帳の無い売り反響では「媒介受託」を選択肢から外し、「媒介受託は、売り反響の画面の『媒介紐付』から登録します」と出す
- `frontend/src/components/realty/callq/CallQueue.tsx`・`summary/Summary.tsx`
  - `ledgerOnSellScreen` を渡すようにした
  - v2.2.247 の知らせ（`noticeLedgerOnSellScreen`）は消した
- `frontend/src/components/database/DatabaseBroker.tsx`
  - `?ledgerNo=` の行を黄色・枠つきで出し、見えるところまで動かす（`useSearchParams`、`ledger-row-<No>`）
- `frontend/src/components/database/PropertyRegister.tsx`：台帳の編集画面の媒介種別に「専属専任媒介」を足した

### そのほか
- 版：`frontend/src/utils/version.ts` → 2.2.248
- SQL：`backend/scripts/sql/2026-11-05_update_log_2.2.248.sql`（update_log と業務ガイド）。ローカルに流した（no=347）
- 業務ガイド：`common/screen-247.md`
  - 「媒介獲得台帳へ登録する」の手順を、必須の項目・満了日・一緒に保存されること・台帳を開くボタン・キャンセルの扱い・買取は選べないこと、に書き換えた
  - 架電キュー・チームサマリーの注意を「媒介受託を選べない」にした

## テスト
- 型チェック：フロント・② とも 0
- ESLint：今回の範囲の警告 0（残りは、もとからある DatabaseBroker.tsx などの警告）
- ① を通した確認
  - トークン無しの `planner:ledger_link` → 401
  - 必須が足りない form → 400 と、足りない項目の一覧。DB は変わらない
  - 台帳がある反響にもう一度 → 200 `exists` と No.218（新しく作らない）
- Playwright（3100・Master。テスト用の売り反響 A・B・D・E）
  - A
    - 種類の選択肢は専属専任・専任・一般。初期値は契約日 2026-11-05、満了日 2027-02-04
    - 担当が空、未来の契約日、専任で満了日が3か月超、のどれも、赤の一覧で止まる
    - 専属専任・1,480万円で登録 → 完了の画面（ダイアログは出ない）
    - DB：台帳 218（専属専任・満了日 2027-02-04・14,800,000・担当の略称あり）。反響は媒介受託・ledgerNo・ledgerId あり
    - 変更履歴は2件（反響のフェーズ・台帳の作成）
    - 「開く」→ `/broker?ledgerNo=218` で、その行が黄色で画面の中に出る
  - B：一般媒介で満了日 2099-12-31 → 確かめる画面 → 台帳 219（備考に「他の依頼先：テスト不動産」）。一覧は台帳No.219・媒介受託
  - D：編集画面で媒介受託にして保存
    - DB は「通電済」のまま（メールだけ保存された）で、媒介紐付の画面が開いた
    - キャンセルすると、一覧の段階も通電済
  - 架電キュー・チームサマリーの編集画面
    - 通電済・訪問査定済の売り反響で「媒介受託」が選択肢に無く、案内が出る
  - ページのエラー：0
- 整理（使わない import の削除）のあとに、もう一度すべて通した
- 後片付け
  - テストの行・台帳・履歴と、仮スタッフを消した（行数は 2,986、台帳の最大 No. は 217 に戻った）
  - 開発サーバー（3100）を止めた

## 残したこと（次の版以降）
- ②：媒介物件の表、レインズ・初回販売報告の期限（営業日）
  - 台帳の一覧の満了日は、今も画面で計算している（`getContractExpirationDate`）。`expiry` の列を使うのは ②
- 「取消」のステータス、権限（課長だけができる操作）、朝礼アラート「直近14日の新規媒介獲得」

## 新規ファイルの全文
### backend-express/src/features/realty/ledgerLink.ts
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../../db/pool';
import type { Tx } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { jstNow, resolveMe, uid } from './calls';
import { norm } from './index';
import type { Result } from './index';

/**
 * 不動産企画係: 連動トリガー仕様書の ① 売り反響 → 媒介獲得（＋ ② 台帳の作成）（v2.2.248 新規。② だけ）。
 *
 * ─────────────────────────────────────────────
 *   planner:ledger_link … 売り反響の「媒介紐付」の画面（frontend common/LedgerLinkModal.tsx）の「登録」
 *
 *   1. 前提条件を確かめる（満たさなければ何も書かず、足りない項目の名前を返す。仕様書 共通ルール 2）
 *   2. 1つのトランザクションで（仕様書 共通ルール 3。途中で失敗したら全部戻る）
 *      ・売り反響を押さえる（FOR UPDATE）。すでに台帳に紐づいていれば作らずに、その台帳を返す（二重作成の防止）
 *      ・台帳 No. を振る（台帳の行を押さえて最大 + 1。同時に2人が登録しても重ならない）
 *      ・台帳を作る（現況は「情報整理中」＝仕様書の「販売準備中」。docs/realty-trigger-spec.md の対応表）
 *      ・売り反響を「媒介受託」（＝仕様書の「媒介獲得」）にし、媒介契約日・台帳 No.・台帳 ID を入れる
 *      ・変更履歴（kind = logs）を積む（仕様書の監査ログ）
 * ─────────────────────────────────────────────
 *
 * ⚠️ 段階・現況の名前は今のまま（2026-11-05 の利用者の決定）。仕様書の名前とは docs/realty-trigger-spec.md の「8」で読み替える。
 * ⚠️ 前提条件は画面（frontend common/leadLinks.ts の ledgerFormProblems）と同じ。⚠️ どちらかを変えたら両方を変える。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body });
const fail = (httpStatus: number, message: string, extra: Record<string, unknown> = {}): Result =>
  ({ httpStatus, body: { status: 'error', message, ...extra } });

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

/** ① の媒介の種類（仕様書：専属専任・専任・一般） */
export const BAIKAI_TYPES = ['専属専任媒介', '専任媒介', '一般媒介'];
/** 有効期間3か月の上限がある種類（宅建業法） */
const LIMITED_TYPES = ['専属専任媒介', '専任媒介'];

/**
 * 有効期間の満了日の上限＝契約日の3か月後の前日（仕様書の初期値）。
 * ⚠️ 3か月後に同じ日が無いとき（11/30 → 2/30 など）は、その月の末日（民法143条2項のただし書と同じ考え方）。
 * ⚠️ frontend common/leadLinks.ts の maxExpiryOf と同じ計算
 */
export const maxExpiryOf = (contractDate: string): string => {
  const [y, m, d] = contractDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + 3 + 1, 0)).getUTCDate();
  if (d > lastDay) return new Date(Date.UTC(y, m - 1 + 3, lastDay)).toISOString().slice(0, 10);
  return new Date(Date.UTC(y, m - 1 + 3, d - 1)).toISOString().slice(0, 10);
};

type LedgerLinkForm = {
  baikaiDate: string; baikaiType: string; expiry: string; seller: string; contact: string; category: string;
  addr1: string; addr2: string; price: number; staff: string; freq: string; note: string; otherBrokers: string;
};

/** 画面から来た値を読む。⚠️ ① を通すと {} が [] になるので、画面は JSON の文字列で送る */
const formOf = (raw: unknown): LedgerLinkForm | null => {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try { o = JSON.parse(raw); } catch { return null; }
  }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  return {
    baikaiDate: str(r.baikaiDate).trim(), baikaiType: str(r.baikaiType).trim(), expiry: str(r.expiry).trim(),
    seller: str(r.seller).trim(), contact: str(r.contact).trim(), category: str(r.category).trim(),
    addr1: str(r.addr1).trim(), addr2: str(r.addr2).trim(), price: Number(r.price),
    staff: str(r.staff).trim(), freq: str(r.freq).trim(), note: str(r.note).trim(), otherBrokers: str(r.otherBrokers).trim(),
  };
};

/** 前提条件（仕様書 ①）。満たさない項目の説明を返す（空なら満たしている） */
export const problemsOf = (f: LedgerLinkForm, today: string): string[] => {
  const p: string[] = [];
  if (!BAIKAI_TYPES.includes(f.baikaiType)) p.push('媒介の種類');
  if (!isIsoDate(f.baikaiDate)) p.push('媒介契約日');
  else if (f.baikaiDate > today) p.push('媒介契約日（未来の日付は入れられません）');
  if (!isIsoDate(f.expiry)) p.push('有効期間の満了日');
  else if (isIsoDate(f.baikaiDate)) {
    if (f.expiry < f.baikaiDate) p.push('有効期間の満了日（媒介契約日より前です）');
    else if (LIMITED_TYPES.includes(f.baikaiType) && f.expiry > maxExpiryOf(f.baikaiDate)) {
      p.push(`有効期間の満了日（${f.baikaiType}は契約日から3か月以内＝${maxExpiryOf(f.baikaiDate)}まで）`);
    }
  }
  if (!Number.isInteger(f.price) || f.price < 1) p.push('売出価格（1円以上の整数）');
  if (!f.staff) p.push('担当者');
  if (!f.seller) p.push('売主');
  if (!f.addr2) p.push('物件の所在地');
  if (!f.category) p.push('物件の種別');
  return p;
};

/** 設定の担当者の略称（台帳の担当は略称。以前のアプリと同じ）。⚠️ 名前は空白を除いて突き合わせる */
const abbrOf = async (tx: Tx, name: string): Promise<string> => {
  const [row] = await tx.query<DynamicRow>("SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings'");
  let list: unknown = row?.staff;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list)) return '';
  const me = norm(name);
  for (const s of list) {
    if (s !== null && typeof s === 'object' && norm((s as Record<string, unknown>).name) === me) return str((s as Record<string, unknown>).abbr);
  }
  return '';
};

/** 変更履歴を1件積む（frontend common/leadUtiles.ts の logChange と同じ形） */
const insertLog = (
  tx: Tx,
  log: { entity: string; entityId: string; entityNo: number | null; label: string; field: string; from: string; to: string; by: string; at: string; note: string }
) =>
  tx.execute(
    `INSERT INTO brokerage_listings (kind, \`id\`, entity, entityId, entityNo, label, field, \`from\`, \`to\`, \`by\`, \`at\`, note, show_dashboard)
     VALUES ('logs', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [uid(), log.entity, log.entityId, log.entityNo, log.label, log.field, log.from || '（未設定）', log.to || '（未設定）', log.by, log.at, log.note]
  );

/**
 * planner:ledger_link。body = { leadId, form: JSON 文字列 }
 * 応答
 *   作った          … { status: 'success', no, ledgerId, lead }（lead は保存後の売り反響）
 *   すでに紐づいている … { status: 'exists', no, ledgerId }
 *   前提条件を満たさない … 400 { status: 'error', message, problems: [...] }
 */
export const runLedgerLink = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const leadId = str(body.leadId).trim();
  if (leadId === '') return fail(400, '売り反響が指定されていません');
  const form = formOf(body.form);
  if (form === null) return fail(400, '入力の形が正しくありません');
  const now = jstNow();
  const problems = problemsOf(form, now.date);
  if (problems.length > 0) return fail(400, `次の項目を確かめてください：${problems.join('・')}`, { problems });

  return withTransaction(async (tx) => {
    const [lead] = await tx.query<DynamicRow>(
      `SELECT * FROM brokerage_listings
        WHERE \`id\` = ? AND kind = 'leads' AND (show_dashboard IS NULL OR show_dashboard <> 0)
        FOR UPDATE`,
      [leadId]
    );
    if (lead === undefined) return fail(404, '売り反響が見つかりません（削除された可能性があります）');
    if (str(lead.ledgerNo) !== '') return ok({ status: 'exists', no: Number(lead.ledgerNo), ledgerId: str(lead.ledgerId) || null });

    // ⚠️ 台帳の行を押さえてから最大を数える（同時に登録されても No. が重ならない）。⚠️ 削除済みの台帳の No. も使わない
    const [max] = await tx.query<DynamicRow>(
      "SELECT COALESCE(MAX(CAST(`no` AS UNSIGNED)), 0) AS m FROM brokerage_listings WHERE kind = 'ledger' FOR UPDATE"
    );
    const no = Number(max?.m ?? 0) + 1;
    const ledgerId = uid();
    const abbr = await abbrOf(tx, form.staff);
    const by = await resolveMe(tx, staff);
    const note = form.otherBrokers && form.baikaiType === '一般媒介'
      ? `${form.note}${form.note ? '／' : ''}他の依頼先：${form.otherBrokers}`
      : form.note;

    await tx.execute(
      `INSERT INTO brokerage_listings
         (kind, \`id\`, \`no\`, staff, portal, source, contractDate, baikaiType, expiry, seller, contact, category,
          currentStatus, addr1, addr2, price, freq, lastReportDate, reinsDate, priceRevDate, propStatus, keyStatus, keyInfo,
          note, createdAt, show_dashboard)
       VALUES ('ledger', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '情報整理中', ?, ?, ?, ?, NULL, NULL, NULL, 'アクティブ', NULL, NULL, ?, ?, 1)`,
      [ledgerId, no, abbr || null, abbr || null, str(lead.source) || null, form.baikaiDate, form.baikaiType, form.expiry,
        form.seller, form.contact || null, form.category, form.addr1 || null, form.addr2, form.price, form.freq || null,
        note || null, now.date]
    );

    const fromPhase = str(lead.phase);
    await tx.execute(
      `UPDATE brokerage_listings
          SET phase = '媒介受託', baikaiDate = ?, ledgerNo = ?, ledgerId = ?, endReason = NULL
        WHERE \`id\` = ?`,
      [form.baikaiDate, no, ledgerId, leadId]
    );

    const label = str(lead.seller) || str(lead.name) || str(lead.addr) || leadId;
    const at = new Date().toISOString();
    if (fromPhase !== '媒介受託') {
      await insertLog(tx, { entity: 'lead', entityId: leadId, entityNo: null, label, field: 'フェーズ', from: fromPhase, to: '媒介受託', by, at, note: `媒介紐付（台帳 No.${no}）` });
    }
    await insertLog(tx, {
      entity: 'ledger', entityId: ledgerId, entityNo: no, label: form.seller, field: '作成', from: '', to: `台帳 No.${no}`, by, at,
      note: `売り反響「${label}」の媒介紐付から作成（${form.baikaiType}・媒介契約日 ${form.baikaiDate}・満了日 ${form.expiry}・売出価格 ${form.price}円）`,
    });

    const [saved] = await tx.query<DynamicRow>('SELECT * FROM brokerage_listings WHERE `id` = ?', [leadId]);
    return ok({ status: 'success', no, ledgerId, lead: saved ?? null });
  });
};
```
### frontend/src/components/realty/common/LedgerLinkModal.tsx（書き直し）
```tsx
import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { useNavigate } from 'react-router-dom';
import {
    LEDGER_BAIKAI_TYPES, LEDGER_CATEGORIES, LEDGER_FREQS, ledgerFormOf, ledgerFormProblems, ledgerFormWarning, maxExpiryOf,
} from './leadLinks';
import type { LedgerForm, LedgerLinkResult } from './leadLinks';
import type { Row } from '../summary/kpi';

/**
 * 売り反響の「媒介紐付」（v2.2.247 新規。v2.2.248 で連動トリガー仕様書の ① に合わせた）。売り反響 → 媒介獲得台帳。
 *
 * ─────────────────────────────────────────────
 *   開く      … 売り反響の値を台帳の項目に写して出す（ledgerFormOf）
 *   登録      … 前提条件（ledgerFormProblems。仕様書 ①）を確かめ、onSubmit に渡す。作るのは ② の planner:ledger_link
 *   作れたら  … 台帳 No. と「媒介獲得台帳で開く」を出す（仕様書 共通ルール 4）
 *   キャンセル … 何も保存しない（台帳も反響の段階も変わらない）
 * ─────────────────────────────────────────────
 *
 * ⚠️ 利用者の指示（2026-11-05）: 台帳へつなぐのは売り反響の画面だけ。流れは「モーダル → 売り反響の値を必要な項目へ反映 → 登録」。
 * ⚠️ 必須（仕様書 ①）: 媒介の種類・媒介契約日（未来は不可）・満了日（専任・専属専任は3か月以内。一般は超えると警告）・売出価格・担当者・売主・所在地・種別
 */

type Props = {
    /** 対象の売り反響（null は閉じている） */
    lead: Row | null;
    /** 担当の選択肢（設定の担当者の氏名） */
    staffNames: string[];
    onClose: () => void;
    /** 「登録」。作れた（すでにあった）ら結果、作れなかったら null（画面は開いたまま） */
    onSubmit: (lead: Row, form: LedgerForm) => Promise<LedgerLinkResult | null>;
};

const str = (v: unknown): string => (v == null ? '' : String(v));
const label: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#6c757d', marginBottom: 0 };
const req = <span className="text-danger">*</span>;

/** 選択肢に無い今の値（反響で手入力された区分など）も消さずに出す */
const withCurrent = (options: string[], current: string): string[] =>
    current && !options.includes(current) ? [...options, current] : options;

const LedgerLinkModal = ({ lead, staffNames, onClose, onSubmit }: Props) => {
    const navigate = useNavigate();
    const [form, setForm] = useState<LedgerForm | null>(null);
    const [busy, setBusy] = useState(false);
    const [problems, setProblems] = useState<string[]>([]);
    const [done, setDone] = useState<LedgerLinkResult | null>(null);

    useEffect(() => {
        setForm(lead ? ledgerFormOf(lead) : null);
        setBusy(false);
        setProblems([]);
        setDone(null);
    }, [lead]);

    if (!lead || !form) return null;

    const set = (patch: Partial<LedgerForm>) => setForm(prev => (prev ? { ...prev, ...patch } : prev));
    /** 媒介契約日を変えたら、満了日を「3か月後の前日」に入れ直す（仕様書の初期値） */
    const setBaikaiDate = (baikaiDate: string) => set({ baikaiDate, ...(/^\d{4}-\d{2}-\d{2}$/.test(baikaiDate) ? { expiry: maxExpiryOf(baikaiDate) } : {}) });

    const submit = async () => {
        const p = ledgerFormProblems(form);
        setProblems(p);
        if (p.length > 0) return;
        const warn = ledgerFormWarning(form);
        if (warn && !window.confirm(warn)) return;
        setBusy(true);
        try {
            const r = await onSubmit(lead, form);
            if (r) setDone(r);
        } finally {
            setBusy(false);
        }
    };

    const openLedger = () => {
        if (!done) return;
        onClose();
        navigate(`/broker?ledgerNo=${done.no}`);
    };

    const general = form.baikaiType === '一般媒介';

    return (
        <Modal show onHide={busy ? undefined : onClose} size="lg" centered>
            <Modal.Header closeButton={!busy}>
                <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>🔗 媒介紐付（媒介獲得台帳へ登録）</Modal.Title>
            </Modal.Header>
            {done ? (
                <>
                    <Modal.Body style={{ fontSize: '13px' }}>
                        <p className="mb-2">
                            {done.status === 'exists'
                                ? <>この売り反響は、すでに <b>媒介獲得台帳 No.{done.no}</b> につながっています（新しくは作っていません）。</>
                                : <><b>媒介獲得台帳 No.{done.no}</b> を作り、売り反響を「媒介受託」にしました。</>}
                        </p>
                        <p className="text-muted mb-0" style={{ fontSize: '11px' }}>媒介獲得台帳で、レインズ登録日・鍵の預かりなどを続けて入れてください。</p>
                    </Modal.Body>
                    <Modal.Footer>
                        <button className="btn btn-light border btn-sm" onClick={onClose}>閉じる</button>
                        <button className="btn btn-primary btn-sm fw-bold" onClick={openLedger}>媒介獲得台帳で No.{done.no} を開く</button>
                    </Modal.Footer>
                </>
            ) : (
                <>
                    <Modal.Body style={{ fontSize: '12px' }}>
                        <div className="row g-2">
                            <div className="col-12 text-muted">
                                売り反響：<b>{str(lead.seller || lead.name) || '（名称なし）'}</b>／{str(lead.source) || '反響元未設定'}／段階 {str(lead.phase) || '―'}
                                <br />売り反響の値を下の項目に入れてあります。確かめて、足りないところを直してから「登録」を押してください。<span className="text-danger">*</span> は必須です。
                            </div>
                            {problems.length > 0 && (
                                <div className="col-12">
                                    <div className="rlt-alert" style={{ borderRadius: '6px', padding: '8px 12px', fontSize: '11px', border: '1px solid #f1aeb5', background: '#f8d7da', color: '#842029' }}>
                                        次の項目を確かめてください：{problems.join('・')}
                                    </div>
                                </div>
                            )}
                            <div className="col-md-4"><div style={label}>媒介の種類 {req}</div>
                                <select className="form-select form-select-sm" value={form.baikaiType} onChange={e => set({ baikaiType: e.target.value })}>
                                    {LEDGER_BAIKAI_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                                </select></div>
                            <div className="col-md-4"><div style={label}>媒介契約日 {req}</div>
                                <input type="date" className="form-control form-control-sm" value={form.baikaiDate} onChange={e => setBaikaiDate(e.target.value)} /></div>
                            <div className="col-md-4"><div style={label}>有効期間の満了日 {req}</div>
                                <input type="date" className="form-control form-control-sm" value={form.expiry} onChange={e => set({ expiry: e.target.value })} /></div>
                            <div className="col-12 text-muted" style={{ fontSize: '10px', marginTop: 0 }}>
                                満了日は「契約日の3か月後の前日」が入ります。専任媒介・専属専任媒介は3か月を超えられません（宅建業法）。一般媒介は超えると確かめる画面が出ます。
                            </div>
                            {general && (
                                <div className="col-12"><div style={label}>一般媒介の他の依頼先（明示型のとき。任意）</div>
                                    <input className="form-control form-control-sm" placeholder="○○不動産・△△ホーム など" value={form.otherBrokers} onChange={e => set({ otherBrokers: e.target.value })} /></div>
                            )}
                            <div className="col-md-4"><div style={label}>売出価格(円) {req}</div>
                                <input type="number" min={1} className="form-control form-control-sm" value={form.price ?? ''} onChange={e => set({ price: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                            <div className="col-md-4"><div style={label}>担当者 {req}</div>
                                <select className="form-select form-select-sm" value={form.staff} onChange={e => set({ staff: e.target.value })}>
                                    <option value="">選択してください</option>
                                    {withCurrent(staffNames, form.staff).map(s => <option key={s} value={s}>{s}</option>)}
                                </select></div>
                            <div className="col-md-4"><div style={label}>連絡頻度</div>
                                <select className="form-select form-select-sm" value={form.freq} onChange={e => set({ freq: e.target.value })}>
                                    {LEDGER_FREQS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select></div>
                            <div className="col-md-6"><div style={label}>売主 {req}</div>
                                <input className="form-control form-control-sm" value={form.seller} onChange={e => set({ seller: e.target.value })} /></div>
                            <div className="col-md-6"><div style={label}>連絡先（電話・メール）</div>
                                <input className="form-control form-control-sm" value={form.contact} onChange={e => set({ contact: e.target.value })} /></div>
                            <div className="col-md-4"><div style={label}>市区町村</div>
                                <input className="form-control form-control-sm" value={form.addr1} onChange={e => set({ addr1: e.target.value })} /></div>
                            <div className="col-md-8"><div style={label}>物件の所在地（番地まで） {req}</div>
                                <input className="form-control form-control-sm" value={form.addr2} onChange={e => set({ addr2: e.target.value })} /></div>
                            <div className="col-md-4"><div style={label}>物件の種別 {req}</div>
                                <select className="form-select form-select-sm" value={form.category} onChange={e => set({ category: e.target.value })}>
                                    <option value="">選択してください</option>
                                    {withCurrent(LEDGER_CATEGORIES, form.category).map(o => <option key={o} value={o}>{o}</option>)}
                                </select></div>
                            <div className="col-md-8"><div style={label}>備考</div>
                                <input className="form-control form-control-sm" value={form.note} onChange={e => set({ note: e.target.value })} /></div>
                            <div className="col-12 text-muted mt-2">
                                📌 登録すると、媒介獲得台帳に1行を作り（現況は「情報整理中」）、この売り反響の段階を「媒介受託」にします。どちらか一方だけが保存されることはありません。キャンセルすると、何も変わりません。
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button className="btn btn-light border btn-sm" disabled={busy} onClick={onClose}>キャンセル</button>
                        <button className="btn btn-primary btn-sm fw-bold" disabled={busy} onClick={() => void submit()}>{busy ? '登録しています…' : '登録'}</button>
                    </Modal.Footer>
                </>
            )}
        </Modal>
    );
};

export default LedgerLinkModal;
```

## 変更の差分（git diff）
```diff
diff --git a/backend-express/src/features/realty/calls.ts b/backend-express/src/features/realty/calls.ts
index e152f396c..259abad8c 100644
--- a/backend-express/src/features/realty/calls.ts
+++ b/backend-express/src/features/realty/calls.ts
@@ -55,7 +55,7 @@ const parseJsonText = (v: unknown): unknown => (typeof v === 'string' ? parseJso
 const p2 = (n: number) => String(n).padStart(2, '0');
 
 /** 日本時間の今。date = 'YYYY-MM-DD'、stamp = 'YYYY-MM-DDTHH:MM'（以前のアプリの nowStamp）、sql = 'YYYY-MM-DD HH:MM:SS' */
-const jstNow = (now = new Date()) => {
+export const jstNow = (now = new Date()) => {
   const d = new Date(now.getTime() + 9 * 3600_000);
   const date = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
   const hm = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
@@ -84,14 +84,14 @@ const jstIso = (v: unknown): string | null => {
 };
 
 /** 以前のアプリの uid()（変更履歴の id） */
-const uid = (): string => randomBytes(6).toString('hex') + Date.now().toString(36).slice(-4);
+export const uid = (): string => randomBytes(6).toString('hex') + Date.now().toString(36).slice(-4);
 
 // ---------------------------------------------------------------------------
 // 共通
 // ---------------------------------------------------------------------------
 
 /** 架電の記録の「実施者」。設定の担当者と空白を除いて一致すれば設定の名前、無ければログイン名 */
-const resolveMe = async (tx: Tx, staff: AuthenticatedStaff): Promise<string> => {
+export const resolveMe = async (tx: Tx, staff: AuthenticatedStaff): Promise<string> => {
   const [row] = await tx.query<DynamicRow>("SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings'");
   const list = parseJson(row?.staff);
   const me = norm(staff.name);
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index e41d6778b..01ec6d935 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -181,6 +181,7 @@ import type { Result as RealtyResult } from '../features/realty';
 import { runPlannerCompliance, runPlannerSettings, runPlannerState, runPlannerWeekly } from '../features/realty/state';
 import { runImportCheck, runImportFinish, runImportRecords } from '../features/realty/importer';
 import { runCallLogs, runCallLogsImport, runCallMark, runCallUndo, runNaviSave, runPracticeLogsImport } from '../features/realty/calls';
+import { runLedgerLink } from '../features/realty/ledgerLink';
 import { runUsedQueueList, runUsedQueueMark } from '../features/callq/usedQueue';
 import { INQUIRY_CATEGORIES, MASTER_CATEGORIES, runPrivacyEraseInquiry, runPrivacyEraseMaster } from '../features/privacy';
 import type { AuthenticatedStaff } from '../types/staff';
@@ -1261,6 +1262,8 @@ register({ request: 'planner', roll: 'call_undo', summary: '【書き込み】
 register({ request: 'planner', roll: 'navi_save', summary: '【書き込み】不動産企画係: 架電ナビの記録（反響の更新と通話記録）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runNaviSave(s, body)) });
 register({ request: 'planner', roll: 'call_logs', summary: '不動産企画係: 架電ナビの通話記録（期間を指定）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runCallLogs(body)) });
 register({ request: 'planner', roll: 'call_logs_import', summary: '【書き込み】不動産企画係: 以前のアプリの通話記録（CSV）を取り込む（300件まで）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runCallLogsImport) });
+// ⚠️ v2.2.248 新規（② だけ）。連動トリガー仕様書の ① 媒介獲得（売り反響 → 台帳を1つのトランザクションで）。features/realty/ledgerLink.ts
+register({ request: 'planner', roll: 'ledger_link', summary: '【書き込み】不動産企画係: 売り反響の媒介紐付（前提条件を確かめ、台帳の作成・反響の媒介受託・変更履歴を1つのトランザクションで）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runLedgerLink(s, body)) });
 register({ request: 'planner', roll: 'practice_logs_import', summary: '【書き込み】不動産企画係: 以前のアプリの練習記録（CSV）を取り込む（300件まで）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runPracticeLogsImport) });
 
 // ⚠️ v2.2.239 新規（② だけ）。中古リノベの今日の架電キュー。features/callq/usedQueue.ts
diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
index 2f6c75b06..cd4e51e0a 100644
--- a/backend/scripts/guide/articles/common/screen-247.md
+++ b/backend/scripts/guide/articles/common/screen-247.md
@@ -23,14 +23,23 @@ summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談
 ### 媒介獲得台帳へ登録する
 1. 「媒介紐付」を押す（一覧で段階を「**媒介受託**」に変えたときと、編集画面で媒介受託にして保存したときも、同じ画面が開きます）
 2. 売り反響の売主・連絡先・所在地・区分・査定額・担当が、台帳の項目に入った状態で開きます
-3. 媒介契約日・媒介種別（専任媒介／一般媒介／買取）・販売価格などを確かめて直す。**媒介契約日・媒介種別・売主は必須**です
-4. 「**登録**」を押すと、媒介獲得台帳に1行が作られ（台帳の No. は自動・現況は「情報整理中」）、売り反響の段階が「媒介受託」になります
-
-- 「キャンセル」を押すと、何も変わりません（一覧で媒介受託を選んだときは、段階も元に戻ります）
+3. 次の項目を確かめて直す（**すべて必須**）
+   - 媒介の種類（専属専任媒介／専任媒介／一般媒介）
+   - 媒介契約日（未来の日付は入れられません）
+   - 有効期間の満了日：最初は「契約日の3か月後の前日」が入ります。専属専任媒介・専任媒介は3か月を超えられません（宅建業法）。一般媒介は超えると確かめる画面が出ます
+   - 売出価格（1円以上）
+   - 担当者・売主・物件の所在地・物件の種別
+4. 「**登録**」を押すと、媒介獲得台帳に1行が作られ（台帳の No. は自動・現況は「情報整理中」）、売り反響の段階が「媒介受託」になります。台帳と段階は**必ず一緒に**保存されます（片方だけが保存されることはありません）
+5. 「**媒介獲得台帳で No.〇 を開く**」を押すと、媒介獲得台帳でその行が黄色で出ます
+
+- 足りない項目があると、画面の上に赤で項目の名前が出て、登録できません
+- 一般媒介で、明示型のときは「他の依頼先」も入れられます（台帳の備考に入ります）
+- 「キャンセル」を押すと、何も変わりません。一覧で媒介受託を選んだときは段階も元に戻り、編集画面からのときは段階以外の項目だけが保存されています
 - すでに台帳に作られた反響は、段階を変え直しても、もう1行は作られません
+- 買取（自社で買い取る）は、この画面では選べません。「買取案件へ」を使います
 - 段階を「**追客終了**」にすると、理由を聞かれます（他決／辞退・売却中止／連絡不能／対象外／その他）。理由は「失注・他決の分析」に出ます。追客終了から別の段階に戻すと、理由は消えます
 
-> 注意：今日の架電キュー・チームサマリーの編集画面で媒介受託にして保存しても、台帳は作られません（「未転記」になります）。売り反響の画面の「媒介紐付」の列で転記してください。
+> 注意：今日の架電キュー・チームサマリーの編集画面では、段階に「媒介受託」を選べません。売り反響の画面の「媒介紐付」から登録してください。
 
 ## 買い反響（ポータル）
 - 段階を「**購入申込**」にすると、「商談案件管理へ転記しますか？」と聞かれます。「OK」で、**商談案件管理に「買」の案件が1件作られます**。物件名・価格を確かめてください
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 52ceeace0..98714f2b9 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -166,6 +166,8 @@ function expressProxyRequests(): array
         'planner:call_logs',
         'planner:call_logs_import',
         'planner:practice_logs_import',
+        // ⚠️ v2.2.248: 売り反響の媒介紐付（台帳の作成を1つのトランザクションで。② だけ）
+        'planner:ledger_link',
         // ⚠️ v2.2.239。中古リノベの今日の架電キュー（② だけ）。expressProxyExclusive() にも入れてある
         'callq_used:list',
         'callq_used:mark',
@@ -856,6 +858,8 @@ function expressProxyExclusive(): array
         'planner:call_logs',
         'planner:call_logs_import',
         'planner:practice_logs_import',
+        // ⚠️ v2.2.248: 売り反響の媒介紐付（台帳の作成を1つのトランザクションで。② だけ）
+        'planner:ledger_link',
         // v2.2.239 新規。中古リノベの今日の架電キュー（mark は書き込み）。⚠️ ① に PHP ハンドラは無い（② だけ）
         'callq_used:list',
         'callq_used:mark',
diff --git a/frontend/src/components/database/DatabaseBroker.tsx b/frontend/src/components/database/DatabaseBroker.tsx
index 5b7346d5b..ae9012642 100644
--- a/frontend/src/components/database/DatabaseBroker.tsx
+++ b/frontend/src/components/database/DatabaseBroker.tsx
@@ -9,6 +9,7 @@ import BuyOfferModal from '../realty/common/BuyOfferModal';
 import { OFFER_STATUS } from '../realty/common/leadLinks';
 import { loadRecords } from '../realty/common/realtyState';
 import AuthContext from '../../context/AuthContext';
+import { useSearchParams } from 'react-router-dom';
 import type { Row, StaffSetting } from '../realty/summary/kpi';
 
 export interface BrokerData {
@@ -105,6 +106,13 @@ const DatabaseBroker = () => {
     }, []);
     useEffect(() => { loadDeals(); }, [loadDeals]);
     const closeOffer = useCallback(() => setOfferLedger(null), []);
+
+    /**
+     * ⚠️ v2.2.248: 売り反響の「媒介紐付」で台帳を作ったあとの「媒介獲得台帳で開く」（/broker?ledgerNo=…）。
+     *   その台帳の行を黄色にし、見えるところまで動かす（連動トリガー仕様書 共通ルール 4）
+     */
+    const [searchParams] = useSearchParams();
+    const focusNo = searchParams.get('ledgerNo') ?? '';
     /** 買付登録・解除のあと、一覧の台帳を直し、案件の No. を読み直す */
     const onOfferSaved = (ledgerId: string, fields: Row) => {
         setOriginalData(prev => prev.map(d => (d.id === ledgerId ? { ...d, ...fields } as BrokerData : d)));
@@ -208,6 +216,16 @@ const DatabaseBroker = () => {
         return filtered;
     }, [originalData, sortConfig, searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus]);
 
+    // ⚠️ v2.2.248: ?ledgerNo= の行が一覧に出たら、見えるところまで動かす（1回だけ）
+    const [focusedNo, setFocusedNo] = useState('');
+    useEffect(() => {
+        if (focusNo === '' || focusedNo === focusNo) return;
+        const el = document.getElementById(`ledger-row-${focusNo}`);
+        if (!el) return;
+        el.scrollIntoView({ block: 'center' });
+        setFocusedNo(focusNo);
+    }, [focusNo, focusedNo, processedData]);
+
     /*
      * ⚠️ v2.2.245: ページ割りをやめ、媒介契約日の新しい順に全件を1枚で出す（制作者の要望。以前は20件ごと）。
      *   件数が増えて重くなったら、100件ごとのページ割りに戻す（要望の第二案）。
@@ -381,7 +399,7 @@ const DatabaseBroker = () => {
                         該当 {processedData.length} 件
                     </div>
                     {/*
-                      ⚠️ v2.2.245: 「媒介追加」を消した。媒介は必ず売り反響の「媒介受託」から作る（realty/common/leadLinks.ts の leadToLedger）。
+                      ⚠️ v2.2.245: 「媒介追加」を消した。媒介は必ず売り反響の「媒介受託」から作る（v2.2.248 からは売り反響の「媒介紐付」→ ② の planner:ledger_link）。
                         ここで作ると、売主がどの反響から来たのか分からない物件ができてしまう（制作者の要望）。
                     */}
                     <span className="text-muted" style={{ fontSize: '11px' }}>媒介は売り反響を「媒介受託」にすると作られます</span>
@@ -437,7 +455,7 @@ const DatabaseBroker = () => {
                                         const contractStatusInfo = getContractStatusInfo(remainingDays);
 
                                         return (
-                                            <tr key={item.id}>
+                                            <tr key={item.id} id={`ledger-row-${String(item.no ?? '')}`} style={focusNo !== '' && String(item.no ?? '') === focusNo ? { outline: '2px solid #fd7e14', background: '#fff3cd' } : undefined}>
                                                 <td className="text-muted">{index + 1}</td>
                                                 <td>
                                                     <button
diff --git a/frontend/src/components/database/PropertyRegister.tsx b/frontend/src/components/database/PropertyRegister.tsx
index 5320731a0..abfac9de0 100644
--- a/frontend/src/components/database/PropertyRegister.tsx
+++ b/frontend/src/components/database/PropertyRegister.tsx
@@ -340,7 +340,7 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
                             <label style={styles.label}>媒介種別 (baikaiType)</label>
                             <select style={styles.input} value={editData.baikaiType || ''} onChange={e => handleInputChange('baikaiType', e.target.value)}>
                                 <option value="">選択してください</option>
-                                {['専任媒介', '一般媒介', '買取'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
+                                {['専属専任媒介', '専任媒介', '一般媒介', '買取'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                             </select>
                         </div>
                         <div className="col-md-4">
diff --git a/frontend/src/components/realty/callq/CallQueue.tsx b/frontend/src/components/realty/callq/CallQueue.tsx
index fda39de4e..6d86b127f 100644
--- a/frontend/src/components/realty/callq/CallQueue.tsx
+++ b/frontend/src/components/realty/callq/CallQueue.tsx
@@ -6,7 +6,6 @@ import { recordFieldChanges, saveBrokerageRecord } from '../common/leadUtiles';
 import LeadEdit from '../common/LeadEdit';
 import { todayStr } from '../summary/kpi';
 import type { Row } from '../summary/kpi';
-import { noticeLedgerOnSellScreen } from '../common/leadLinks';
 import { openNavi } from '../navi/naviHost';
 import {
     CQ_OUT, ST, TAGL, build, callOutcome, callqConf, callqScripts, callsOnly, contactKpi, diffDays, keyOf, newListings,
@@ -240,8 +239,6 @@ const CallQueue: React.FC = () => {
         try {
             const row = await saveBrokerageRecord(str(cur.id), fields);
             replaceRow(kind, (row as Row | null) ?? { ...before, ...fields });
-            // ⚠️ v2.2.247: 媒介獲得台帳は売り反響の画面でだけ作る（v2.2.244〜246 はここでも作っていた）
-            if (kind === 'leads') noticeLedgerOnSellScreen({ ...before, ...fields });
             if (before) {
                 await recordFieldChanges({
                     entity: kind === 'buyLeads' ? 'buy' : 'lead', entityId: str(cur.id),
@@ -429,6 +426,7 @@ const CallQueue: React.FC = () => {
                 setCustomerInfo={setEditing}
                 leadCategory={editing?.kind === 'buyLeads' ? 'buy' : 'sell'}
                 staffList={staffNames}
+                ledgerOnSellScreen
             />
         </div>
     );
diff --git a/frontend/src/components/realty/common/LeadEdit.tsx b/frontend/src/components/realty/common/LeadEdit.tsx
index 7e2bed143..5bf78eb64 100644
--- a/frontend/src/components/realty/common/LeadEdit.tsx
+++ b/frontend/src/components/realty/common/LeadEdit.tsx
@@ -42,6 +42,11 @@ export type LeadEditProps = {
     onNavi?: () => void;
     /** 反響元・ポータルの選択肢（v2.2.247。一覧と同じ値。渡さなければ以前からの固定の選択肢） */
     sourceOptions?: string[];
+    /**
+     * ⚠️ v2.2.248: 売り反響の画面以外（架電キュー・チームサマリー）で開くとき true。
+     *   台帳の無い売り反響では「媒介受託」を選ばせない（台帳は売り反響の画面の「媒介紐付」でだけ作る。利用者の指示・仕様書 共通ルール 2）
+     */
+    ledgerOnSellScreen?: boolean;
 };
 
 /** 渡されないときの反響元・ポータルの選択肢（v2.2.246 まで全画面で使っていたもの） */
@@ -141,7 +146,8 @@ const LeadEdit: React.FC<LeadEditProps> = ({
     leadCategory,
     staffList,
     onNavi,
-    sourceOptions
+    sourceOptions,
+    ledgerOnSellScreen
 }) => {
     const { userName } = useContext(AuthContext);
 
@@ -179,7 +185,11 @@ const LeadEdit: React.FC<LeadEditProps> = ({
     // ⚠️ v2.2.244: 以前のアプリの値（leadUtiles.ts）。⚠️ 選択肢に無い今の値（手入力されたもの）は消さずに足す
     // ⚠️ v2.2.247: id が無ければ反響の登録（売り・買い反響の「反響を追加」）
     const isNew = !customerInfo?.id;
-    const basePhases = (isSellType ? LEAD_PHASES : BUY_PHASES).filter(p => !isNew || !NOT_ON_CREATE.includes(p));
+    // ⚠️ v2.2.248: 開いたときに媒介受託でなく台帳も無ければ、売り反響の画面以外では媒介受託を選べない
+    const blockLedgerPhase = !!ledgerOnSellScreen && leadCategory === 'sell' && !customerInfo.ledgerNo && snapshot?.phase !== '媒介受託';
+    const basePhases = (isSellType ? LEAD_PHASES : BUY_PHASES)
+        .filter(p => !isNew || !NOT_ON_CREATE.includes(p))
+        .filter(p => !blockLedgerPhase || p !== '媒介受託');
     const phaseList = customerInfo.phase && !basePhases.includes(customerInfo.phase) ? [...basePhases, customerInfo.phase] : basePhases;
     const currentSource = customerInfo.source || customerInfo.portal || '';
     const sourceList = sourceOptions ?? DEFAULT_SOURCES;
@@ -418,6 +428,9 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                                     <option value="">フェーズを選択</option>
                                     {phaseList.map(p => <option key={p} value={p}>{p}</option>)}
                                 </select>
+                                {blockLedgerPhase && (
+                                    <div className="text-muted" style={{ fontSize: '9px', marginTop: '2px' }}>媒介受託は、売り反響の画面の「媒介紐付」から登録します</div>
+                                )}
                             </div>
 
                             {/* ▼ 追客終了の場合は理由を必須入力 ▼ */}
diff --git a/frontend/src/components/realty/common/LedgerLinkModal.tsx b/frontend/src/components/realty/common/LedgerLinkModal.tsx
index cadd90790..a9a181369 100644
--- a/frontend/src/components/realty/common/LedgerLinkModal.tsx
+++ b/frontend/src/components/realty/common/LedgerLinkModal.tsx
@@ -1,20 +1,24 @@
 import React, { useEffect, useState } from 'react';
 import Modal from 'react-bootstrap/Modal';
-import { LEDGER_BAIKAI_TYPES, LEDGER_CATEGORIES, LEDGER_FREQS, ledgerFormError, ledgerFormOf } from './leadLinks';
-import type { LedgerForm } from './leadLinks';
+import { useNavigate } from 'react-router-dom';
+import {
+    LEDGER_BAIKAI_TYPES, LEDGER_CATEGORIES, LEDGER_FREQS, ledgerFormOf, ledgerFormProblems, ledgerFormWarning, maxExpiryOf,
+} from './leadLinks';
+import type { LedgerForm, LedgerLinkResult } from './leadLinks';
 import type { Row } from '../summary/kpi';
 
 /**
- * 売り反響の「媒介紐付」（v2.2.247 新規）。売り反響 → 媒介獲得台帳。
+ * 売り反響の「媒介紐付」（v2.2.247 新規。v2.2.248 で連動トリガー仕様書の ① に合わせた）。売り反響 → 媒介獲得台帳。
  *
  * ─────────────────────────────────────────────
- *   開く   … 売り反響の値を台帳の項目に写して出す（ledgerFormOf。以前のアプリの leadToLedger と同じ写し方）
- *   登録   … 必須（媒介契約日・媒介種別・売主）を確かめ、onSubmit に渡す。台帳を作るのは呼び出し側（LeadSell.tsx）
+ *   開く      … 売り反響の値を台帳の項目に写して出す（ledgerFormOf）
+ *   登録      … 前提条件（ledgerFormProblems。仕様書 ①）を確かめ、onSubmit に渡す。作るのは ② の planner:ledger_link
+ *   作れたら  … 台帳 No. と「媒介獲得台帳で開く」を出す（仕様書 共通ルール 4）
  *   キャンセル … 何も保存しない（台帳も反響の段階も変わらない）
  * ─────────────────────────────────────────────
  *
  * ⚠️ 利用者の指示（2026-11-05）: 台帳へつなぐのは売り反響の画面だけ。流れは「モーダル → 売り反響の値を必要な項目へ反映 → 登録」。
- *   v2.2.246 までは媒介契約日だけを聞き、すぐに台帳を作っていた（媒介種別は専任媒介のまま、販売価格は査定額のまま）。
+ * ⚠️ 必須（仕様書 ①）: 媒介の種類・媒介契約日（未来は不可）・満了日（専任・専属専任は3か月以内。一般は超えると警告）・売出価格・担当者・売主・所在地・種別
  */
 
 type Props = {
@@ -23,8 +27,8 @@ type Props = {
     /** 担当の選択肢（設定の担当者の氏名） */
     staffNames: string[];
     onClose: () => void;
-    /** 「登録」。台帳を作れたら true（閉じる）。false なら開いたまま */
-    onSubmit: (lead: Row, form: LedgerForm) => Promise<boolean>;
+    /** 「登録」。作れた（すでにあった）ら結果、作れなかったら null（画面は開いたまま） */
+    onSubmit: (lead: Row, form: LedgerForm) => Promise<LedgerLinkResult | null>;
 };
 
 const str = (v: unknown): string => (v == null ? '' : String(v));
@@ -36,81 +40,135 @@ const withCurrent = (options: string[], current: string): string[] =>
     current && !options.includes(current) ? [...options, current] : options;
 
 const LedgerLinkModal = ({ lead, staffNames, onClose, onSubmit }: Props) => {
+    const navigate = useNavigate();
     const [form, setForm] = useState<LedgerForm | null>(null);
     const [busy, setBusy] = useState(false);
+    const [problems, setProblems] = useState<string[]>([]);
+    const [done, setDone] = useState<LedgerLinkResult | null>(null);
 
     useEffect(() => {
         setForm(lead ? ledgerFormOf(lead) : null);
         setBusy(false);
+        setProblems([]);
+        setDone(null);
     }, [lead]);
 
     if (!lead || !form) return null;
 
     const set = (patch: Partial<LedgerForm>) => setForm(prev => (prev ? { ...prev, ...patch } : prev));
+    /** 媒介契約日を変えたら、満了日を「3か月後の前日」に入れ直す（仕様書の初期値） */
+    const setBaikaiDate = (baikaiDate: string) => set({ baikaiDate, ...(/^\d{4}-\d{2}-\d{2}$/.test(baikaiDate) ? { expiry: maxExpiryOf(baikaiDate) } : {}) });
 
     const submit = async () => {
-        const err = ledgerFormError(form);
-        if (err) { alert(err); return; }
+        const p = ledgerFormProblems(form);
+        setProblems(p);
+        if (p.length > 0) return;
+        const warn = ledgerFormWarning(form);
+        if (warn && !window.confirm(warn)) return;
         setBusy(true);
         try {
-            if (await onSubmit(lead, form)) onClose();
+            const r = await onSubmit(lead, form);
+            if (r) setDone(r);
         } finally {
             setBusy(false);
         }
     };
 
+    const openLedger = () => {
+        if (!done) return;
+        onClose();
+        navigate(`/broker?ledgerNo=${done.no}`);
+    };
+
+    const general = form.baikaiType === '一般媒介';
+
     return (
         <Modal show onHide={busy ? undefined : onClose} size="lg" centered>
             <Modal.Header closeButton={!busy}>
                 <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>🔗 媒介紐付（媒介獲得台帳へ登録）</Modal.Title>
             </Modal.Header>
-            <Modal.Body style={{ fontSize: '12px' }}>
-                <div className="row g-2">
-                    <div className="col-12 text-muted">
-                        売り反響：<b>{str(lead.seller || lead.name) || '（名称なし）'}</b>／{str(lead.source) || '反響元未設定'}／段階 {str(lead.phase) || '―'}
-                        <br />売り反響の値を下の項目に入れてあります。確かめて、足りないところを直してから「登録」を押してください。
-                    </div>
-                    <div className="col-md-4"><div style={label}>媒介契約日 {req}</div>
-                        <input type="date" className="form-control form-control-sm" value={form.baikaiDate} onChange={e => set({ baikaiDate: e.target.value })} /></div>
-                    <div className="col-md-4"><div style={label}>媒介種別 {req}</div>
-                        <select className="form-select form-select-sm" value={form.baikaiType} onChange={e => set({ baikaiType: e.target.value })}>
-                            {LEDGER_BAIKAI_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
-                        </select></div>
-                    <div className="col-md-4"><div style={label}>担当</div>
-                        <select className="form-select form-select-sm" value={form.staff} onChange={e => set({ staff: e.target.value })}>
-                            <option value="">（未割当）</option>
-                            {withCurrent(staffNames, form.staff).map(s => <option key={s} value={s}>{s}</option>)}
-                        </select></div>
-                    <div className="col-md-6"><div style={label}>売主 {req}</div>
-                        <input className="form-control form-control-sm" value={form.seller} onChange={e => set({ seller: e.target.value })} /></div>
-                    <div className="col-md-6"><div style={label}>連絡先（電話・メール）</div>
-                        <input className="form-control form-control-sm" value={form.contact} onChange={e => set({ contact: e.target.value })} /></div>
-                    <div className="col-md-4"><div style={label}>市区町村</div>
-                        <input className="form-control form-control-sm" value={form.addr1} onChange={e => set({ addr1: e.target.value })} /></div>
-                    <div className="col-md-8"><div style={label}>所在地（番地まで）</div>
-                        <input className="form-control form-control-sm" value={form.addr2} onChange={e => set({ addr2: e.target.value })} /></div>
-                    <div className="col-md-4"><div style={label}>区分</div>
-                        <select className="form-select form-select-sm" value={form.category} onChange={e => set({ category: e.target.value })}>
-                            <option value="">選択してください</option>
-                            {withCurrent(LEDGER_CATEGORIES, form.category).map(o => <option key={o} value={o}>{o}</option>)}
-                        </select></div>
-                    <div className="col-md-4"><div style={label}>販売価格(円)（初めは査定額）</div>
-                        <input type="number" className="form-control form-control-sm" value={form.price ?? ''} onChange={e => set({ price: Number(e.target.value) || null })} /></div>
-                    <div className="col-md-4"><div style={label}>連絡頻度</div>
-                        <select className="form-select form-select-sm" value={form.freq} onChange={e => set({ freq: e.target.value })}>
-                            {LEDGER_FREQS.map(o => <option key={o} value={o}>{o}</option>)}
-                        </select></div>
-                    <div className="col-12"><div style={label}>備考</div>
-                        <input className="form-control form-control-sm" value={form.note} onChange={e => set({ note: e.target.value })} /></div>
-                    <div className="col-12 text-muted mt-2">
-                        📌 登録すると、媒介獲得台帳に1行を作り（現況は「情報整理中」）、この売り反響の段階を「媒介受託」にします。キャンセルすると、何も変わりません。
-                    </div>
-                </div>
-            </Modal.Body>
-            <Modal.Footer>
-                <button className="btn btn-light border btn-sm" disabled={busy} onClick={onClose}>キャンセル</button>
-                <button className="btn btn-primary btn-sm fw-bold" disabled={busy} onClick={() => void submit()}>{busy ? '登録しています…' : '登録'}</button>
-            </Modal.Footer>
+            {done ? (
+                <>
+                    <Modal.Body style={{ fontSize: '13px' }}>
+                        <p className="mb-2">
+                            {done.status === 'exists'
+                                ? <>この売り反響は、すでに <b>媒介獲得台帳 No.{done.no}</b> につながっています（新しくは作っていません）。</>
+                                : <><b>媒介獲得台帳 No.{done.no}</b> を作り、売り反響を「媒介受託」にしました。</>}
+                        </p>
+                        <p className="text-muted mb-0" style={{ fontSize: '11px' }}>媒介獲得台帳で、レインズ登録日・鍵の預かりなどを続けて入れてください。</p>
+                    </Modal.Body>
+                    <Modal.Footer>
+                        <button className="btn btn-light border btn-sm" onClick={onClose}>閉じる</button>
+                        <button className="btn btn-primary btn-sm fw-bold" onClick={openLedger}>媒介獲得台帳で No.{done.no} を開く</button>
+                    </Modal.Footer>
+                </>
+            ) : (
+                <>
+                    <Modal.Body style={{ fontSize: '12px' }}>
+                        <div className="row g-2">
+                            <div className="col-12 text-muted">
+                                売り反響：<b>{str(lead.seller || lead.name) || '（名称なし）'}</b>／{str(lead.source) || '反響元未設定'}／段階 {str(lead.phase) || '―'}
+                                <br />売り反響の値を下の項目に入れてあります。確かめて、足りないところを直してから「登録」を押してください。<span className="text-danger">*</span> は必須です。
+                            </div>
+                            {problems.length > 0 && (
+                                <div className="col-12">
+                                    <div className="rlt-alert" style={{ borderRadius: '6px', padding: '8px 12px', fontSize: '11px', border: '1px solid #f1aeb5', background: '#f8d7da', color: '#842029' }}>
+                                        次の項目を確かめてください：{problems.join('・')}
+                                    </div>
+                                </div>
+                            )}
+                            <div className="col-md-4"><div style={label}>媒介の種類 {req}</div>
+                                <select className="form-select form-select-sm" value={form.baikaiType} onChange={e => set({ baikaiType: e.target.value })}>
+                                    {LEDGER_BAIKAI_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
+                                </select></div>
+                            <div className="col-md-4"><div style={label}>媒介契約日 {req}</div>
+                                <input type="date" className="form-control form-control-sm" value={form.baikaiDate} onChange={e => setBaikaiDate(e.target.value)} /></div>
+                            <div className="col-md-4"><div style={label}>有効期間の満了日 {req}</div>
+                                <input type="date" className="form-control form-control-sm" value={form.expiry} onChange={e => set({ expiry: e.target.value })} /></div>
+                            <div className="col-12 text-muted" style={{ fontSize: '10px', marginTop: 0 }}>
+                                満了日は「契約日の3か月後の前日」が入ります。専任媒介・専属専任媒介は3か月を超えられません（宅建業法）。一般媒介は超えると確かめる画面が出ます。
+                            </div>
+                            {general && (
+                                <div className="col-12"><div style={label}>一般媒介の他の依頼先（明示型のとき。任意）</div>
+                                    <input className="form-control form-control-sm" placeholder="○○不動産・△△ホーム など" value={form.otherBrokers} onChange={e => set({ otherBrokers: e.target.value })} /></div>
+                            )}
+                            <div className="col-md-4"><div style={label}>売出価格(円) {req}</div>
+                                <input type="number" min={1} className="form-control form-control-sm" value={form.price ?? ''} onChange={e => set({ price: e.target.value === '' ? null : Number(e.target.value) })} /></div>
+                            <div className="col-md-4"><div style={label}>担当者 {req}</div>
+                                <select className="form-select form-select-sm" value={form.staff} onChange={e => set({ staff: e.target.value })}>
+                                    <option value="">選択してください</option>
+                                    {withCurrent(staffNames, form.staff).map(s => <option key={s} value={s}>{s}</option>)}
+                                </select></div>
+                            <div className="col-md-4"><div style={label}>連絡頻度</div>
+                                <select className="form-select form-select-sm" value={form.freq} onChange={e => set({ freq: e.target.value })}>
+                                    {LEDGER_FREQS.map(o => <option key={o} value={o}>{o}</option>)}
+                                </select></div>
+                            <div className="col-md-6"><div style={label}>売主 {req}</div>
+                                <input className="form-control form-control-sm" value={form.seller} onChange={e => set({ seller: e.target.value })} /></div>
+                            <div className="col-md-6"><div style={label}>連絡先（電話・メール）</div>
+                                <input className="form-control form-control-sm" value={form.contact} onChange={e => set({ contact: e.target.value })} /></div>
+                            <div className="col-md-4"><div style={label}>市区町村</div>
+                                <input className="form-control form-control-sm" value={form.addr1} onChange={e => set({ addr1: e.target.value })} /></div>
+                            <div className="col-md-8"><div style={label}>物件の所在地（番地まで） {req}</div>
+                                <input className="form-control form-control-sm" value={form.addr2} onChange={e => set({ addr2: e.target.value })} /></div>
+                            <div className="col-md-4"><div style={label}>物件の種別 {req}</div>
+                                <select className="form-select form-select-sm" value={form.category} onChange={e => set({ category: e.target.value })}>
+                                    <option value="">選択してください</option>
+                                    {withCurrent(LEDGER_CATEGORIES, form.category).map(o => <option key={o} value={o}>{o}</option>)}
+                                </select></div>
+                            <div className="col-md-8"><div style={label}>備考</div>
+                                <input className="form-control form-control-sm" value={form.note} onChange={e => set({ note: e.target.value })} /></div>
+                            <div className="col-12 text-muted mt-2">
+                                📌 登録すると、媒介獲得台帳に1行を作り（現況は「情報整理中」）、この売り反響の段階を「媒介受託」にします。どちらか一方だけが保存されることはありません。キャンセルすると、何も変わりません。
+                            </div>
+                        </div>
+                    </Modal.Body>
+                    <Modal.Footer>
+                        <button className="btn btn-light border btn-sm" disabled={busy} onClick={onClose}>キャンセル</button>
+                        <button className="btn btn-primary btn-sm fw-bold" disabled={busy} onClick={() => void submit()}>{busy ? '登録しています…' : '登録'}</button>
+                    </Modal.Footer>
+                </>
+            )}
         </Modal>
     );
 };
diff --git a/frontend/src/components/realty/common/leadLinks.ts b/frontend/src/components/realty/common/leadLinks.ts
index 725ac6eb5..4b74680d9 100644
--- a/frontend/src/components/realty/common/leadLinks.ts
+++ b/frontend/src/components/realty/common/leadLinks.ts
@@ -1,6 +1,5 @@
-import { loadRecords } from './realtyState';
+import { loadRecords, post } from './realtyState';
 import { logChange, newRecordId, saveBrokerageRecord } from './leadUtiles';
-import type { StaffSetting } from '../summary/kpi';
 
 /**
  * 反響から次の台帳・案件への連携（v2.2.244 新規）。以前のアプリ v14.29 の leadToLedger / buyToDeal と同じ動き。
@@ -8,6 +7,7 @@ import type { StaffSetting } from '../summary/kpi';
  * ─────────────────────────────────────────────
  *   売り反響を「媒介受託」にする → 媒介獲得台帳（kind = ledger）へ1行作り、反響に ledgerNo を持たせる
  *     ⚠️ v2.2.247: 売り反響の画面の「媒介紐付」の画面（LedgerLinkModal）で台帳の値を確かめてから作る。売り反響の画面だけで作る
+ *     ⚠️ v2.2.248: 連動トリガー仕様書の ①。前提条件を確かめ、台帳の作成・反響の媒介受託・変更履歴を ② の planner:ledger_link が1つのトランザクションで行う（linkLedger）
  *   買い反響を「購入申込」にする → 商談案件（kind = deals）へ「買」案件を1件作り、反響に dealId を持たせる
  *   ⚠️ v2.2.246:
  *   媒介台帳の「買付登録」     → 他社客付けは商談案件「売」を1件、自社客付けは「売」「買」の2件（registerBuyOffer）
@@ -37,27 +37,47 @@ const guessCity = (addr: string): string => addr.match(/^(.+?[市郡町村])/)?.
 /** 'YYYY-MM-DD' か。⚠️ 以前のアプリと同じ形だけを受け付ける */
 export const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);
 
-/** 媒介獲得台帳の選択肢（database/PropertyRegister.tsx の台帳の編集画面と同じ） */
-export const LEDGER_BAIKAI_TYPES = ['専任媒介', '一般媒介', '買取'];
+/**
+ * ⚠️ v2.2.248: 連動トリガー仕様書の ① 媒介獲得（docs/realty-trigger-spec.md）。
+ *   媒介の種類は専属専任・専任・一般（「買取」は ④ で扱うので、ここでは選ばせない）
+ */
+export const LEDGER_BAIKAI_TYPES = ['専属専任媒介', '専任媒介', '一般媒介'];
+/** 有効期間3か月の上限がある種類（宅建業法） */
+const LIMITED_BAIKAI_TYPES = ['専属専任媒介', '専任媒介'];
+/** 媒介獲得台帳の選択肢（database/PropertyRegister.tsx の台帳の編集画面と同じ。仕様書の「土地」は「住宅用地」など） */
 export const LEDGER_CATEGORIES = ['戸建', 'マンション', '住宅用地', '賃収マンション', '賃収・事業用', 'その他'];
 export const LEDGER_FREQS = ['1週間', '2週間', '1か月'];
 
 /**
- * ⚠️ v2.2.247: 売り反響 → 媒介獲得台帳の「媒介紐付」の画面（common/LedgerLinkModal.tsx）で確かめる値。
- *   staff は氏名（台帳には略称で入れる）
+ * 有効期間の満了日の上限＝契約日の3か月後の前日（仕様書の初期値）。
+ * ⚠️ 3か月後に同じ日が無いとき（11/30 → 2/30 など）は、その月の末日。
+ * ⚠️ ② の features/realty/ledgerLink.ts の maxExpiryOf と同じ計算
+ */
+export const maxExpiryOf = (contractDate: string): string => {
+    const [y, m, d] = contractDate.split('-').map(Number);
+    const lastDay = new Date(Date.UTC(y, m - 1 + 3 + 1, 0)).getUTCDate();
+    if (d > lastDay) return new Date(Date.UTC(y, m - 1 + 3, lastDay)).toISOString().slice(0, 10);
+    return new Date(Date.UTC(y, m - 1 + 3, d - 1)).toISOString().slice(0, 10);
+};
+
+/**
+ * 売り反響 → 媒介獲得台帳の「媒介紐付」の画面（common/LedgerLinkModal.tsx）で確かめる値。
+ * staff は氏名（台帳には略称で入る）。otherBrokers は一般媒介の他の依頼先（任意。台帳の備考に書き足す）
  */
 export type LedgerForm = {
-    baikaiDate: string; baikaiType: string; seller: string; contact: string; category: string;
-    addr1: string; addr2: string; price: number | null; staff: string; freq: string; note: string;
+    baikaiDate: string; baikaiType: string; expiry: string; seller: string; contact: string; category: string;
+    addr1: string; addr2: string; price: number | null; staff: string; freq: string; note: string; otherBrokers: string;
 };
 
-/** 売り反響の値を台帳の項目に写す（以前のアプリの leadToLedger と同じ写し方。媒介契約日が無ければ今日） */
+/** 売り反響の値を台帳の項目に写す（媒介契約日が無ければ今日。満了日は3か月後の前日） */
 export const ledgerFormOf = (lead: Rec): LedgerForm => {
     const addr = str(lead.addr || lead.addr1);
-    const baikaiDate = str(lead.baikaiDate).replace(/\//g, '-');
+    const d = str(lead.baikaiDate).replace(/\//g, '-');
+    const baikaiDate = isIsoDate(d) ? d : todayStr();
     return {
-        baikaiDate: isIsoDate(baikaiDate) ? baikaiDate : todayStr(),
+        baikaiDate,
         baikaiType: '専任媒介',
+        expiry: maxExpiryOf(baikaiDate),
         seller: str(lead.seller || lead.name),
         contact: str(lead.contact) || [lead.phone, lead.mail].map(str).filter(Boolean).join(' / '),
         category: str(lead.category),
@@ -66,66 +86,56 @@ export const ledgerFormOf = (lead: Rec): LedgerForm => {
         staff: str(lead.staff),
         freq: '1か月',
         note: `反響リードより転記（${str(lead.source) || '反響元未設定'}）`,
+        otherBrokers: '',
     };
 };
 
-/** 登録の前に確かめる（必須：媒介契約日・媒介種別・売主）。問題が無ければ null */
-export const ledgerFormError = (f: LedgerForm): string | null => {
-    if (!isIsoDate(f.baikaiDate)) return '媒介契約日を入力してください。';
-    if (!f.baikaiType) return '媒介種別を選んでください。';
-    if (!f.seller.trim()) return '売主を入力してください。';
-    return null;
-};
-
 /**
- * 売り反響 → 媒介獲得台帳。⚠️ v2.2.247: 台帳の値は「媒介紐付」の画面で確かめたもの（form）
- * @returns 作った台帳の No. と、反響に保存した値
+ * 前提条件（仕様書 ①。満たさなければ保存しない）。満たさない項目の説明を返す（空なら満たしている）。
+ * ⚠️ ② の features/realty/ledgerLink.ts の problemsOf と同じ。⚠️ どちらかを変えたら両方を変える
  */
-export const leadToLedger = async (
-    lead: Rec,
-    form: LedgerForm,
-    staffSettings: StaffSetting[] = []
-): Promise<{ no: number; leadFields: Rec }> => {
-    const { records } = await loadRecords(['ledger']);
-    const no = nextNo(records.ledger);
-    const abbr = staffSettings.find((s) => s.name === form.staff)?.abbr ?? '';
-    const ledgerId = newRecordId();
-    await saveBrokerageRecord(ledgerId, {
-        kind: 'ledger', no, staff: abbr, portal: abbr, source: str(lead.source),
-        contractDate: form.baikaiDate, baikaiType: form.baikaiType, seller: form.seller.trim(), contact: form.contact.trim(),
-        category: form.category, currentStatus: '情報整理中', addr1: form.addr1.trim(), addr2: form.addr2.trim(),
-        price: form.price || null, freq: form.freq, lastReportDate: '', reinsDate: '', priceRevDate: '',
-        propStatus: 'アクティブ', keyStatus: '', keyInfo: '', note: form.note,
-    });
-    const leadFields = { ledgerNo: no, ledgerId, phase: '媒介受託', baikaiDate: form.baikaiDate };
-    await saveBrokerageRecord(str(lead.id), leadFields);
-    return { no, leadFields };
+export const ledgerFormProblems = (f: LedgerForm, today: string = todayStr()): string[] => {
+    const p: string[] = [];
+    if (!LEDGER_BAIKAI_TYPES.includes(f.baikaiType)) p.push('媒介の種類');
+    if (!isIsoDate(f.baikaiDate)) p.push('媒介契約日');
+    else if (f.baikaiDate > today) p.push('媒介契約日（未来の日付は入れられません）');
+    if (!isIsoDate(f.expiry)) p.push('有効期間の満了日');
+    else if (isIsoDate(f.baikaiDate)) {
+        if (f.expiry < f.baikaiDate) p.push('有効期間の満了日（媒介契約日より前です）');
+        else if (LIMITED_BAIKAI_TYPES.includes(f.baikaiType) && f.expiry > maxExpiryOf(f.baikaiDate)) {
+            p.push(`有効期間の満了日（${f.baikaiType}は契約日から3か月以内＝${maxExpiryOf(f.baikaiDate)}まで）`);
+        }
+    }
+    if (!Number.isInteger(f.price) || (f.price ?? 0) < 1) p.push('売出価格（1円以上の整数）');
+    if (!f.staff.trim()) p.push('担当者');
+    if (!f.seller.trim()) p.push('売主');
+    if (!f.addr2.trim()) p.push('物件の所在地');
+    if (!f.category) p.push('物件の種別');
+    return p;
 };
 
+/** 一般媒介で3か月を超える満了日（仕様書：警告。保存はできる）。問題が無ければ null */
+export const ledgerFormWarning = (f: LedgerForm): string | null =>
+    f.baikaiType === '一般媒介' && isIsoDate(f.baikaiDate) && isIsoDate(f.expiry) && f.expiry > maxExpiryOf(f.baikaiDate)
+        ? `有効期間が3か月（${maxExpiryOf(f.baikaiDate)}まで）を超えています。このまま登録しますか？`
+        : null;
+
+export type LedgerLinkResult = { status: 'success' | 'exists'; no: number; ledgerId: string | null; lead: Rec | null };
+
 /**
- * ⚠️ v2.2.247: 媒介獲得台帳へつなぐのは売り反響の画面だけ（利用者の指示）。
- *   架電キュー・チームサマリーの編集画面で媒介受託にして保存したときは、台帳を作らずに、売り反響の画面で転記するよう知らせる
+ * 売り反響 → 媒介獲得台帳（② の planner:ledger_link）。
+ * ⚠️ 台帳の作成・売り反響の媒介受託・変更履歴は、② が1つのトランザクションで行う（仕様書 共通ルール 3。v2.2.247 までは画面から別々に保存していた）。
+ * ⚠️ すでに台帳に紐づいていれば、② は作らずに status = 'exists' と、その台帳 No. を返す。
+ * ⚠️ form は JSON の文字列で送る（① を通ると {} が [] になるため）。前提条件を満たさなければ ② のメッセージで例外になる
  */
-export const noticeLedgerOnSellScreen = (saved: Rec): void => {
-    if (str(saved.phase) !== '媒介受託' || str(saved.ledgerNo) !== '') return;
-    alert('媒介受託で保存しました。\n媒介獲得台帳への転記は、売り反響の画面の「媒介紐付」の列で行ってください。');
-};
-
-/** leadToLedger を呼び、結果を知らせる。⚠️ 失敗は知らせて null */
-export const linkLedgerWithNotice = async (
-    lead: Rec,
-    form: LedgerForm,
-    staffSettings: StaffSetting[] = []
-): Promise<{ no: number; leadFields: Rec } | null> => {
-    try {
-        const result = await leadToLedger(lead, form, staffSettings);
-        alert(`媒介獲得台帳 No.${result.no} を作りました（媒介契約日 ${form.baikaiDate}）。`);
-        return result;
-    } catch (e) {
-        console.error('[leadLinks] 媒介獲得台帳への反映に失敗しました', lead.id, e);
-        alert('媒介獲得台帳を作れませんでした。時間をおいて、もう一度「媒介紐付」から登録してください。');
-        return null;
-    }
+export const linkLedger = async (leadId: string, form: LedgerForm): Promise<LedgerLinkResult> => {
+    const d = await post('ledger_link', { leadId, form: JSON.stringify(form) });
+    return {
+        status: d.status === 'exists' ? 'exists' : 'success',
+        no: Number(d.no),
+        ledgerId: typeof d.ledgerId === 'string' ? d.ledgerId : null,
+        lead: d.lead && typeof d.lead === 'object' ? (d.lead as Rec) : null,
+    };
 };
 
 /**
@@ -189,7 +199,7 @@ export const isOwnStock = (ledger: Rec): boolean =>
 export const guessProperty = (ledger: Rec): string => {
     const m = str(ledger.seller).match(/^\(株\)国分ハウジング（(.+)）$/);
     if (m) return m[1];
-    // ⚠️ 売り反響から作った台帳は、所在地1に市、所在地2に住所全体が入る（leadToLedger）。重ねない
+    // ⚠️ 売り反響から作った台帳は、所在地1に市、所在地2に住所全体が入る（leadLinks の ledgerFormOf / ② の planner:ledger_link）。重ねない
     const a1 = str(ledger.addr1).trim();
     const a2 = str(ledger.addr2).split('http')[0].trim();
     const base = (a1 && a2.startsWith(a1) ? a2 : `${a1}${a2}`).trim();
diff --git a/frontend/src/components/realty/sell/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
index 3e4f125ca..c553a7a9f 100644
--- a/frontend/src/components/realty/sell/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -8,8 +8,8 @@ import type { Row, Settings } from '../summary/kpi';
 import LeadHeader from '../common/LeadHeader';
 import AuthContext from '../../../context/AuthContext';
 import { removeSpaces, safeParse, LEAD_END_REASONS, LEAD_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted, findDuplicateLead } from '../common/leadUtiles';
-import { leadToResale, linkLedgerWithNotice } from '../common/leadLinks';
-import type { LedgerForm } from '../common/leadLinks';
+import { leadToResale, linkLedger } from '../common/leadLinks';
+import type { LedgerForm, LedgerLinkResult } from '../common/leadLinks';
 import LedgerLinkModal from '../common/LedgerLinkModal';
 import LeadEdit from '../common/LeadEdit';
 import LeadFilterBar, { EMPTY_FILTER, matchesFilter } from '../common/LeadFilterBar';
@@ -347,23 +347,25 @@ const LeadSell = () => {
   };
 
   /**
-   * ⚠️ v2.2.247: 媒介紐付の画面（common/LedgerLinkModal.tsx）の「登録」。売り反響 → 媒介獲得台帳。
-   *   1. 段階を媒介受託・媒介契約日を保存（handleApiPatch。一覧で段階を変えたときと同じく、変更履歴に残す）
-   *   2. 画面で確かめた値で台帳へ1行作り、反響に台帳 No. を持たせる（common/leadLinks.ts の leadToLedger）
-   * ⚠️ 台帳に紐づいている（ledgerNo がある）反響では作らない（二重に作らない）。
-   * @returns 作れたら true（画面を閉じる）
+   * 媒介紐付の画面（common/LedgerLinkModal.tsx）の「登録」。売り反響 → 媒介獲得台帳。
+   * ⚠️ v2.2.248: 連動トリガー仕様書の ①。台帳の作成・反響の媒介受託・変更履歴は、② の planner:ledger_link が
+   *   1つのトランザクションで行う（common/leadLinks.ts の linkLedger）。v2.2.247 は画面から段階 → 台帳 → 台帳 No. と別々に保存していた。
+   * ⚠️ 台帳に紐づいている反響では、② が作らずに既存の台帳 No. を返す（二重作成の防止）。
+   * @returns 作れた（すでにあった）ら結果。作れなければ null（画面は開いたまま）
    */
-  const submitLedger = async (row: Row, form: LedgerForm): Promise<boolean> => {
-    const lead = leads.find(l => l.id === String(row.id));
-    if (!lead || lead.ledgerNo) return true;
-    if (lead.phase !== '媒介受託' || lead.baikaiDate !== form.baikaiDate || lead.endReason) {
-      const ok = await handleApiPatch(lead.id, { phase: '媒介受託', baikaiDate: form.baikaiDate, ...(lead.endReason ? { endReason: '' } : {}) });
-      if (!ok) return false;
+  const submitLedger = async (row: Row, form: LedgerForm): Promise<LedgerLinkResult | null> => {
+    const id = String(row.id);
+    try {
+      const r = await linkLedger(id, form);
+      const no = String(r.no);
+      const fields = { phase: '媒介受託', baikaiDate: form.baikaiDate, ledgerNo: no, ledgerId: r.ledgerId, endReason: null };
+      setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...(r.status === 'exists' ? { ledgerNo: no } : fields) } as SellLead : l)));
+      return r;
+    } catch (e) {
+      console.error('[LeadSell] 媒介紐付に失敗しました', id, e);
+      alert(`媒介獲得台帳を作れませんでした。\n${e instanceof Error ? e.message : ''}`);
+      return null;
     }
-    const linked = await linkLedgerWithNotice(lead as unknown as Record<string, unknown>, form, settings.staff);
-    if (!linked) return false;
-    setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, ...linked.leadFields } as SellLead : l)));
-    return true;
   };
 
   /**
@@ -535,9 +537,13 @@ const LeadSell = () => {
     // 残りのうちサーバーの許可カラムに無いキーは broker_update.php 側で捨てられる。
     const { id, internal_id, created_at, updated_at, ...fields } = customerInfo as SellLead;
     const saved = customerInfo as SellLead;
+    // ⚠️ v2.2.248: 媒介受託にして保存したとき、台帳がまだ無ければ、段階は変えずに（ほかの項目だけ保存して）媒介紐付の画面を開く。
+    //   段階は「登録」で台帳と一緒に媒介受託になる（仕様書 共通ルール 2: 段階だけが先に変わって台帳が無い状態を作らない）
+    const before = leads.find(l => l.id === id);
+    const toLedger = saved.phase === '媒介受託' && !saved.ledgerNo;
+    if (toLedger && before && before.phase !== '媒介受託') fields.phase = before.phase;
     void handleApiPatch(id, fields).then(ok => {
-      // ⚠️ v2.2.247: 媒介受託で保存して台帳がまだ無ければ、媒介紐付の画面を開く（v2.2.244〜246 はすぐに台帳を作っていた）
-      if (ok && saved.phase === '媒介受託' && !saved.ledgerNo) setLedgerTarget(saved);
+      if (ok && toLedger) setLedgerTarget(saved);
     });
     setIsEditModalOpen(false);
   };
diff --git a/frontend/src/components/realty/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
index 300d8338a..306495eaf 100644
--- a/frontend/src/components/realty/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -7,7 +7,6 @@ import AuthContext from '../../../context/AuthContext';
 // 💡 追加: タスク一覧の「開く」から顧客情報を編集する
 import LeadEdit, { LeadCategory } from '../common/LeadEdit';
 import { saveBrokerageRecord, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
-import { noticeLedgerOnSellScreen } from '../common/leadLinks';
 // ⚠️ v2.2.222: 年間予算進捗・月次KPI・架電実績・朝礼用アラートは本番アプリの集計をそのまま写した kpi.ts で出す
 import {
     ALERT_DAYS, CONFIRMED, alertWindow, callStats, daysAgoLabel, dealCountByStaffMonth, dealRegDate,
@@ -268,8 +267,6 @@ const Summary = () => {
 
         try {
             await saveBrokerageRecord(id, fields);
-            // ⚠️ v2.2.247: 媒介獲得台帳は売り反響の画面でだけ作る（v2.2.244〜246 はここでも作っていた）
-            if (!isBuy) noticeLedgerOnSellScreen({ ...(before ?? {}), ...fields });
             // 保存が成功してから履歴を残す（失敗した変更を履歴に残さないため）
             if (before) {
                 await recordFieldChanges({
@@ -952,6 +949,7 @@ const Summary = () => {
                 setCustomerInfo={setCustomerInfo}
                 leadCategory={editCategory}
                 staffList={staffList}
+                ledgerOnSellScreen
             />
         </div>
     );
```
