# 作業記録 2026-11-10-01　v2.2.258　媒介獲得台帳 ⇔ いえらぶの物件 ⇔ 買い反響のつながり

## 依頼
- 売り反響（媒介獲得台帳）の物件と、ポータルから届く買い反響の物件をつなげたい。
- 利用者の決定・指摘
  - 「国分ハウジンググループ中古住宅専門店」の物件（いえらぶ cloud が採番。`property_db` に毎日取り込み）でつなぐ。
  - いえらぶの番号は、ポータル（SUUMO・HOME'S・アットホーム）の自社の物件番号と同じ。
  - 媒介獲得台帳への登録は、いえらぶへの登録より先のことが多い（出稿前に売るため）。そのため、定期の処理だけでなく、次も必要。
    - 台帳の登録時に、番号を空けたまま登録する。
    - いえらぶに載ったら、物件名・住所で突き合わせる。
    - 表記の揺れを防ぐため、営業にはコピー＆ペーストのルールを徹底させる。
- ReadMeClaude.md の依頼（budget）は終了済み（利用者）。v2.2.258 は realty で開始してよい（利用者）。

## 決めたこと（利用者の承認済みの計画）
- **いえらぶの番号を空けたまま `property_db` に行を作ることはしない**。理由は次の2つです。
  - `property_db_update.php` は、`property_id` の一意の鍵で `ON DUPLICATE KEY UPDATE` している。先に作った行といえらぶの行が、二重になる。
  - `property_db` はほかの画面も「いえらぶの物件」として読む。
  - 代わりに、**台帳を「いえらぶ未採番」（`property_db_id` が空）のまま持ち**、② が定期的に突き合わせる。
- 台帳 → いえらぶ：中古住宅専門店の物件と、次の項目で比べる。
  - 所在地：v2.2.250 の `propertyKeyRules.json` でそろえる。地図の URL は除く。
  - 種別。
  - マンションは建物名・部屋番号も。
  - 結果に応じた扱い：
    - 1件だけ一致し、ほかの台帳につながっていなければ自動でつなぐ（`property_db_match = 'auto'`）。
    - 2件以上のとき、番地の細かさが違うとき、種別・建物名が違うときは「要確認」。
    - 候補が無ければ「いえらぶ未採番」。
- 買い反響 → 台帳：`extId` → 取り込み元の行の自社の物件番号 → その番号の台帳。対象は、買い反響の台帳が空のものだけ。
  - SUUMO `company_property_code`、HOME'S `companyId`、athome `company_property_id`（355050000＋6桁）。ローカルで、それぞれ66/66、53/53、68/72件がいえらぶの番号と一致した。
- 人が選んだ・外した（`staff`）・「該当なし」（`none`）の台帳は、自動で変えない。
- `projects/sync`・① の取り込み（`handlers/portal/*_resale.php`・`property_db_update.php`）は変えない。

## 変えたもの
| 区分 | ファイル | 内容 |
|---|---|---|
| ② | `backend-express/src/features/realty/ieloveMatch.ts`（**新規**） | 突き合わせ（`runIeloveMatch`・`startIeloveMatch`）、候補（`runIeloveCandidates`）、今すぐ（`runIeloveMatchNow`） |
| ② | `backend-express/src/features/realty/index.ts` | `ALLOWED_COLUMNS` に `property_db_match`。値の確かめ（`PROPERTY_DB_MATCH`）。`runBrokerUpdate` で、台帳の保存の直後に `runIeloveMatch([id])` |
| ② | `backend-express/src/gateway/registry.ts` | `broker:ielove_candidates`・`broker:ielove_match`（BROKER_SHOPS） |
| ② | `backend-express/src/server.ts` | `startIeloveMatch()`（起動の1分後と30分ごと） |
| ① | `backend/src/core/express_proxy.php` | `expressProxyRequests()`・`expressProxyExclusive()` の両方に2つの口 |
| ① DB | `backend/scripts/sql/2026-11-10_realty_property_db_match.sql`（**新規**） | `brokerage_listings.property_db_match` を追加。すでにつながっている台帳は `staff` |
| ① DB | `backend/scripts/sql/2026-11-10_update_log_2.2.258.sql`（**新規**） | 更新履歴＋業務ガイドの記事 |
| 画面 | `frontend/src/components/database/DatabaseBroker.tsx` | 「ポータル連携（いえらぶ）」の札（No.・要確認 N件・いえらぶ未採番・該当なし。押すと編集画面）、⑥ いえらぶの絞り込み（件数つき）、「いえらぶと突き合わせ」ボタン、保存のあとに札を読み直す |
| 画面 | `frontend/src/components/database/PropertyRegister.tsx` | 掲載物件連携（いえらぶの物件）：番号・物件名・所在地で探す（`normSearch`）、候補（`broker:ielove_candidates`）、外す・該当なし（`handlePropertyClear`）、選んだら `property_db_match: 'staff'`、自動の札、所在地・建物名のコピー（`copy`・`copyAddress`）、読み込み中の表示 |
| 画面 | `frontend/src/components/realty/common/LedgerPicker.tsx` | いえらぶの物件番号・物件名でも探せる。候補の行に「いえらぶ〇〇〇〇〇〇」 |
| 画面 | `frontend/src/utils/version.ts` | 2.2.258 |
| 記事 | `backend/scripts/guide/articles/common/screen-247.md` | 下の「業務ガイド」 |
| docs | 11/04〜11/06 の作業記録・手順書（v2.2.242〜256）を `docs/oldDocument/` へ移動。`realty-handoff.md` のリンクも直した |

## 業務ガイド
記事「反響から商談案件へのつながり（不動産企画係）」（common/screen-247）
- 買い反響：次の2つを足した。
  - 新しい節「ポータルの問い合わせは自動で台帳につながります」。
  - 検索欄で、いえらぶの物件番号でも探せること。
- 注意書きを「ポータルの問い合わせ以外は、物件名や住所が合っているだけでは紐づきません」に直した。
- 媒介獲得台帳：新しい節「いえらぶの物件とつなぐ」。
  - 内容：自動の条件・タイミング、札の意味、⑥ の絞り込み、編集画面の操作。
  - 注意書き：**いえらぶに登録するときは、台帳の「所在地をコピー」「建物名をコピー」で貼り付ける**ルール。
- summary にも足した。

## テスト
- 型チェック：② `npx tsc --noEmit`、フロント `npx tsc --noEmit` ともに通過（整理のあとにもう一度）。
- API（① 経由。`scratchpad/api_258.cjs`）：**18項目 OK**（整理のあとにもう一度 18項目 OK）
  - ① 経由・トークン無しなら、`broker:ielove_candidates`・`broker:ielove_match` とも 401。
  - テスト用のいえらぶの物件5件・台帳4件・SUUMO の取り込み行・買い反響で、次を確かめた。
    - 1件一致なら自動でつながる（auto）。
    - 同じ住所に2件なら要確認（2件）。
    - 該当なしは、つながらない。
    - 番地が粗い台帳は weak の候補だけで、つながらない。
    - 買い反響が SUUMO の物件番号から台帳へつながる（台帳 No. も入る）。
    - 自動の記録が2件残る。
    - 台帳の保存の直後に自動でつながる。
    - 人が選ぶ（staff）。人が外した台帳は、突き合わせでもつながらない。
    - 決まっていない値は 400。
    - 候補の状態（linked・none）。
- 画面（Playwright・3100。`scratchpad/pw_258.cjs`）：**13項目 OK**（整理のあとにもう一度 13項目 OK）
  - 札（No.・要確認・未採番）と、⑥ の件数・絞り込み。
  - 要確認の札 → 編集画面に候補。候補を押す → 連携済み・外す → 外すと候補が戻る。
  - 番号で探す。所在地のコピー（URL を除く）。
  - 未採番の案内。該当なしの札。突き合わせのボタン。
  - 買い反響の検索欄で、いえらぶの番号から台帳が出る。
  - 画面のエラーなし。
  - 画面のテストでは保存していない。
- 後片付け：テストの行（台帳・買い反響・記録・いえらぶの物件・SUUMO の行）0件。仮スタッフ 999999 を削除。開発サーバー 3100 を停止（netstat → taskkill）。

## ローカルのデータでの結果（本番でも同じことが起きる見込み）
⚠️ ② は、ファイルの保存で自動で再起動します。そのため、作業の途中でローカルの DB に突き合わせが走りました（ローカルだけ。本番は手順の後）。
- 台帳 196件の内訳（自動でつながった台帳は全件を目で確かめ、所在地・種別の誤りは無かった）
  - 自動でつながった：100件
  - 要確認：19件
  - いえらぶ未採番：77件
- 買い反響：ポータルの買い反響のうち **67件が自動で台帳につながった**（手で紐づけた21件と合わせて88件）。
  - 抜き取り15件を見て、問合せ物件の名前と台帳が一致していた。
- まだつながらないポータルの買い反響は86件。
  - 35件：取り込み元の行に物件番号が無い（以前のアプリから来た反響など）。
  - 51件（物件22件）：その物件の台帳が無い、または台帳がまだいえらぶとつながっていない。運用を始めた時期による。台帳がつながれば、次の突き合わせで自動でつながる。

## 残したこと・注意
- 同じいえらぶの物件に、媒介終了の台帳と新しい台帳があるときは、新しい台帳もつなげる。媒介終了の台帳は「使用中」と数えないため。買い反響は、媒介中の台帳を先に選ぶ（No. の大きい順）。
- 自動でつないだ記録は、`logs` に残す（誰が：「自動（いえらぶ突き合わせ）」）。
- メールで届いた反響（`mail:`）は対象外。メール取込の移植（以前のアプリの `mbFindLedger`）は未着手のまま。

## 新規ファイルの全文

### backend-express/src/features/realty/ieloveMatch.ts
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { uid } from './calls';
import { fullAddress, normPlace } from './propertyKey';
import type { Result } from './index';

/**
 * 媒介獲得台帳 ⇔ いえらぶの物件（property_db）⇔ 買い反響 のつながり（v2.2.258）。
 *
 * ─────────────────────────────────────────────
 *   ① 台帳 → いえらぶ（台帳の property_db_id が空のもの）
 *      中古住宅専門店のいえらぶの物件と、所在地（propertyKeyRules.json でそろえる）・種別・マンションは建物名と部屋で比べる。
 *      ・当てはまるのが1件だけで、ほかの台帳につながっていない → 自動でつなぐ（property_db_match = 'auto'）
 *      ・2件以上・番地の細かさが違う・種別が違う → 「要確認」（画面で選ぶ。broker:ielove_candidates）
 *      ・スタッフが選んだ（'staff'）・「該当なし」（'none'）の台帳は変えない
 *   ② 買い反響 → 台帳（買い反響の ledgerId が空のもの）
 *      extId → 取り込み元の行（suumo・homes・athome の *_db_resale）の自社の物件番号＝いえらぶの番号 → その番号の台帳
 *        SUUMO   suumo:{sequence_no}            … suumo_db_resale.company_property_code（6桁）
 *        HOME'S  homes:{userId}                 … homes_db_resale.companyId（6桁）
 *        athome  athome:{athome_property_id}:…  … athome_db_resale.company_property_id（355050000＋6桁）
 *
 * いつ動くか: ② の起動の1分後と30分ごと（startIeloveMatch）、台帳の保存の直後（index.ts の runBrokerUpdate）、
 *   画面の「今すぐ突き合わせ」（broker:ielove_match）。
 *
 * ⚠️ いえらぶの番号を空けたまま property_db に行を作らない（利用者と決めた。property_db はいえらぶの写しで、
 *   取り込み（property_db_update.php）が property_id で上書きするため、先に作った行と二重になる）。
 *   台帳が先に登録されても、いえらぶに載った次の突き合わせでつながる。
 * ⚠️ projects/sync・① の取り込み（handlers/portal/*_resale.php・property_db_update.php）は変えない。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 不動産企画係の物件の店舗名（いえらぶの担当店舗。利用者の決定） */
const IELOVE_STORE = '国分ハウジンググループ中古住宅専門店';
const FIRST_DELAY_MS = 60_000;
const INTERVAL_MS = 30 * 60 * 1000;
/** 自動でつないだときの記録の「誰が」 */
const AUTO_BY = '自動（いえらぶ突き合わせ）';
/** 画面に出す候補の最大 */
const MAX_CANDIDATES = 8;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const isActive = (r: DynamicRow): boolean => r.show_dashboard === null || Number(r.show_dashboard) !== 0;

/** 台帳の種別 → いえらぶの物件種別。⚠️ 無い種別（空・その他）は、種別で絞らない */
const CATEGORY_TYPES: Record<string, string[]> = {
  戸建: ['中古一戸建て', '新築一戸建て'],
  マンション: ['中古マンション'],
  住宅用地: ['売地'],
  賃収マンション: ['マンション（建物全部）', 'アパート'],
  '賃収・事業用': ['アパート', 'ビル（建物全部）', 'マンション（建物全部）', '売地'],
};
const isMansion = (ledgerCategory: string, propertyType: string): boolean =>
  ledgerCategory === 'マンション' || propertyType === '中古マンション';

/** URL（地図のリンク）を除いてそろえる */
const placeOf = (v: unknown): string => normPlace(str(v).replace(/https?:\/\/\S+/g, ''));
/** 物件名・部屋番号の「(公開)」「（非公開）」を除いてそろえる */
const nameOf = (v: unknown): string => normPlace(str(v).replace(/[(（][^)）]*公開[)）]/g, ''));
/** 部屋番号（「号室」を除く） */
const roomOf = (v: unknown): string => nameOf(v).replace(/室$/, '');

/**
 * 所在地の近さ。L＝台帳、A＝いえらぶ（どちらもそろえたもの）
 *   exact … 同じ。または台帳のほうが後ろに建物名などを足しただけ（続きが数字・「-」でない）
 *   near  … 片方が番地の途中までしか無い（1-33 と 1-33-30）。自動ではつながない
 */
type Closeness = 'exact' | 'near' | 'none';
const closeness = (l: string, a: string): Closeness => {
  if (!l || !a || !/[0-9]/.test(a) || !/[0-9]/.test(l)) return 'none';
  if (l === a) return 'exact';
  if (l.startsWith(a)) return /^[0-9-]/.test(l.slice(a.length)) ? (l[a.length] === '-' ? 'near' : 'none') : 'exact';
  if (a.startsWith(l) && a[l.length] === '-') return 'near';
  return 'none';
};

type Candidate = {
  property_id: string;
  property_name: string;
  property_type: string;
  address: string;
  room_number: string;
  price: string;
  /** strong＝自動でつなげる一致、weak＝要確認（番地の細かさ・種別・建物名の違い） */
  level: 'strong' | 'weak';
  /** なぜ候補か（画面の表示用） */
  reason: string;
  /** ほかの台帳につながっていれば、その台帳 No. */
  takenNo: string;
};

type LedgerPlace = { id: string; no: string; category: string; addr: string; building: string; room: string };
type Ielove = DynamicRow & { property_id: string };

/** 台帳と、その媒介物件（realty_properties。v2.2.250）から、比べる場所を作る */
const ledgerPlaceOf = (l: DynamicRow, props: Map<string, DynamicRow>): LedgerPlace => {
  const p = props.get(str(l.propertyId));
  return {
    id: str(l.id),
    no: str(l.no),
    category: str(l.category).trim(),
    addr: placeOf(p?.addr ?? fullAddress(l.addr1, l.addr2)),
    building: nameOf(p?.building_name ?? l.addr),
    room: roomOf(p?.room_no),
  };
};

/** 台帳1件の候補（強い順・同じ強さなら番号の新しい順） */
const candidatesOf = (lp: LedgerPlace, ieloves: Ielove[], takenBy: Map<string, DynamicRow>): Candidate[] => {
  const types = CATEGORY_TYPES[lp.category];
  const out: Candidate[] = [];
  for (const p of ieloves) {
    const c = closeness(lp.addr, placeOf(p.address));
    if (c === 'none') continue;
    const type = str(p.property_type);
    const reasons: string[] = [];
    let strong = c === 'exact';
    if (c === 'near') reasons.push('番地の細かさが違う');
    if (types && !types.includes(type)) { strong = false; reasons.push(`種別が違う（台帳 ${lp.category}）`); }
    if (isMansion(lp.category, type)) {
      const pr = roomOf(p.room_number);
      if (lp.room && pr && /[0-9]/.test(pr) && lp.room !== pr) continue; // ⚠️ 同じ建物の別の部屋
      const pb = nameOf(p.property_name);
      if (lp.building && pb && !lp.building.includes(pb) && !pb.includes(lp.building) && !lp.addr.includes(pb)) {
        strong = false;
        reasons.push('建物名が違う');
      }
    }
    const taken = takenBy.get(p.property_id);
    const takenNo = taken && str(taken.id) !== lp.id ? str(taken.no) || '―' : '';
    out.push({
      property_id: p.property_id,
      property_name: str(p.property_name),
      property_type: type,
      address: str(p.address),
      room_number: str(p.room_number),
      price: str(p.price),
      level: strong ? 'strong' : 'weak',
      reason: reasons.length ? reasons.join('・') : '所在地・種別が一致',
      takenNo,
    });
  }
  return out.sort((a, b) => (a.level === b.level ? b.property_id.localeCompare(a.property_id) : a.level === 'strong' ? -1 : 1));
};

/** 突き合わせに使う行を読む */
const loadAll = async () => {
  const [ledgers, ieloveRows, props] = await Promise.all([
    query<DynamicRow>(
      `SELECT \`id\`, \`no\`, category, addr1, addr2, addr, seller, propStatus, propertyId,
              property_db_id, property_db_name, property_db_match, show_dashboard
         FROM brokerage_listings WHERE kind = 'ledger'`
    ),
    query<DynamicRow>(
      `SELECT property_id, property_name, property_type, address, room_number, price
         FROM property_db
        WHERE REPLACE(REPLACE(store_name, ' ', ''), '　', '') = ? AND property_id IS NOT NULL AND property_id <> ''`,
      [IELOVE_STORE]
    ),
    query<DynamicRow>('SELECT id, addr, building_name, room_no FROM realty_properties'),
  ]);
  const active = ledgers.filter(isActive);
  /** いえらぶの番号 → つながっている台帳（媒介終了は、ほかの台帳が同じ物件につなげるように数えない） */
  const takenBy = new Map<string, DynamicRow>();
  for (const l of active) {
    const pid = str(l.property_db_id);
    if (pid && str(l.propStatus) !== '媒介終了') takenBy.set(pid, l);
  }
  return {
    ledgers: active,
    ieloves: ieloveRows.map((r) => ({ ...r, property_id: str(r.property_id) }) as Ielove),
    props: new Map(props.map((p) => [str(p.id), p])),
    takenBy,
  };
};

const insertLog = (entity: string, entityId: string, entityNo: number | null, label: string, field: string, to: string, note: string) =>
  execute(
    `INSERT INTO brokerage_listings (kind, \`id\`, entity, entityId, entityNo, label, field, \`from\`, \`to\`, \`by\`, \`at\`, note, show_dashboard)
     VALUES ('logs', ?, ?, ?, ?, ?, ?, '（未設定）', ?, ?, ?, ?, 1)`,
    [uid(), entity, entityId, entityNo, label, field, to, AUTO_BY, new Date().toISOString(), note]
  );

const numOrNull = (v: unknown): number | null => (str(v) !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** ① 台帳 → いえらぶ。ledgerIds を渡すとその台帳だけ。つないだ件数を返す */
const matchLedgers = async (ledgerIds?: string[]): Promise<number> => {
  const { ledgers, ieloves, props, takenBy } = await loadAll();
  let linked = 0;
  for (const l of ledgers) {
    if (ledgerIds && !ledgerIds.includes(str(l.id))) continue;
    if (str(l.property_db_id) !== '' || str(l.property_db_match) !== '') continue; // ⚠️ 人が決めたもの・つながっているものは触らない
    const strong = candidatesOf(ledgerPlaceOf(l, props), ieloves, takenBy).filter((c) => c.level === 'strong');
    if (strong.length !== 1 || strong[0].takenNo !== '') continue;
    const c = strong[0];
    const r = await execute(
      `UPDATE brokerage_listings SET property_db_id = ?, property_db_name = ?, property_db_match = 'auto'
        WHERE \`id\` = ? AND kind = 'ledger' AND (property_db_id IS NULL OR property_db_id = '') AND property_db_match IS NULL`,
      [c.property_id, c.property_name || null, str(l.id)]
    );
    if (r.affectedRows === 0) continue;
    takenBy.set(c.property_id, l);
    linked += 1;
    await insertLog('ledger', str(l.id), numOrNull(l.no), str(l.seller), 'いえらぶの物件', `No.${c.property_id}`,
      `所在地・種別が一致する物件が1件だけだったので自動でつないだ（${c.property_name}／${c.address}）`);
  }
  return linked;
};

/** 6桁のいえらぶの番号にする（athome は 355050000＋6桁）。それ以外の形は '' */
const ieloveNoOf = (v: unknown): string => {
  const d = str(v).trim();
  if (/^\d{6}$/.test(d)) return d;
  if (/^355050000\d{6}$/.test(d)) return d.slice(9);
  return '';
};

/** ② 買い反響 → 台帳。つないだ件数を返す */
const linkBuyLeads = async (): Promise<number> => {
  const leads = await query<DynamicRow>(
    `SELECT \`id\`, extId, \`name\` FROM brokerage_listings
      WHERE kind = 'buyLeads' AND (show_dashboard IS NULL OR show_dashboard <> 0)
        AND (ledgerId IS NULL OR ledgerId = '')
        AND (extId LIKE 'suumo:%' OR extId LIKE 'homes:%' OR extId LIKE 'athome:%')`
  );
  if (leads.length === 0) return 0;
  const keyOf = (extId: string): [string, string] => {
    const [src, key] = extId.split(':');
    return [src, key ?? ''];
  };
  const keys = { suumo: new Set<string>(), homes: new Set<string>(), athome: new Set<string>() };
  for (const l of leads) {
    const [src, key] = keyOf(str(l.extId));
    if (key && (src === 'suumo' || src === 'homes' || src === 'athome')) keys[src].add(key);
  }
  const lookup = async (sql: string, list: Set<string>): Promise<Map<string, string>> => {
    if (list.size === 0) return new Map();
    const rows = await query<DynamicRow>(sql.replace('?', [...list].map(() => '?').join(', ')), [...list]);
    return new Map(rows.map((r) => [str(r.k), ieloveNoOf(r.v)]));
  };
  const [suumo, homes, athome] = await Promise.all([
    lookup('SELECT sequence_no AS k, company_property_code AS v FROM suumo_db_resale WHERE sequence_no IN (?)', keys.suumo),
    lookup('SELECT userId AS k, companyId AS v FROM homes_db_resale WHERE userId IN (?)', keys.homes),
    lookup('SELECT athome_property_id AS k, MAX(company_property_id) AS v FROM athome_db_resale WHERE athome_property_id IN (?) GROUP BY athome_property_id', keys.athome),
  ]);
  const bySrc: Record<string, Map<string, string>> = { suumo, homes, athome };

  /** いえらぶの番号 → 台帳（媒介中を先に、同じなら No. の大きい＝新しい台帳） */
  const ledgers = (await query<DynamicRow>(
    `SELECT \`id\`, \`no\`, propertyId, propStatus, property_db_id FROM brokerage_listings
      WHERE kind = 'ledger' AND (show_dashboard IS NULL OR show_dashboard <> 0) AND property_db_id IS NOT NULL AND property_db_id <> ''`
  )).sort((a, b) => (str(a.propStatus) === '媒介終了' ? 1 : 0) - (str(b.propStatus) === '媒介終了' ? 1 : 0) || Number(b.no) - Number(a.no));
  const ledgerOf = new Map<string, DynamicRow>();
  for (const l of ledgers) if (!ledgerOf.has(str(l.property_db_id))) ledgerOf.set(str(l.property_db_id), l);

  let linked = 0;
  for (const lead of leads) {
    const [src, key] = keyOf(str(lead.extId));
    const no = bySrc[src]?.get(key) ?? '';
    const ledger = no ? ledgerOf.get(no) : undefined;
    if (!ledger) continue;
    const r = await execute(
      `UPDATE brokerage_listings SET ledgerId = ?, ledgerNo = ?, propertyId = ?
        WHERE \`id\` = ? AND kind = 'buyLeads' AND (ledgerId IS NULL OR ledgerId = '')`,
      [str(ledger.id), str(ledger.no) || null, str(ledger.propertyId) || null, str(lead.id)]
    );
    if (r.affectedRows === 0) continue;
    linked += 1;
    await insertLog('buy', str(lead.id), null, str(lead.name), '問合せ物件', `台帳 No.${str(ledger.no)}`,
      `問い合わせの物件番号（いえらぶ No.${no}）から自動でつないだ`);
  }
  return linked;
};

let running: Promise<{ ledgers: number; buyLeads: number }> | null = null;

/**
 * 突き合わせ（① → ② の順。① でつないだ台帳に、② の買い反響がすぐつながる）。
 * ⚠️ 同時に2つ走らせない（30分ごとと保存の直後が重なったときは、走っているものを待つ）
 */
export const runIeloveMatch = async (ledgerIds?: string[]): Promise<{ ledgers: number; buyLeads: number }> => {
  while (running) await running.catch(() => undefined);
  running = (async () => ({ ledgers: await matchLedgers(ledgerIds), buyLeads: await linkBuyLeads() }))();
  try {
    const result = await running;
    if (result.ledgers > 0 || result.buyLeads > 0) {
      logger.info(`realty: いえらぶの突き合わせ（台帳 ${result.ledgers} 件・買い反響 ${result.buyLeads} 件をつないだ）`);
    }
    return result;
  } finally {
    running = null;
  }
};

export const startIeloveMatch = (): void => {
  const run = (): void => {
    runIeloveMatch().catch((error: unknown) => logger.error('realty: いえらぶの突き合わせに失敗しました', error));
  };
  setTimeout(run, FIRST_DELAY_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
};

// ---------------------------------------------------------------------------
// 画面から
// ---------------------------------------------------------------------------

/** 台帳ごとの状態（一覧の札） */
export type IeloveState = 'linked' | 'none' | 'review' | 'unmatched';

/**
 * broker:ielove_candidates。body.ledgerId があればその台帳だけ（候補つき）、無ければつながっていない台帳すべて（状態と件数）。
 * 応答: { status, ledgers: { [ledgerId]: { state, count, candidates? } } }
 *   linked＝つながっている、none＝「該当なし」にした、review＝候補あり（要確認）、unmatched＝候補なし（いえらぶ未採番）
 */
export const runIeloveCandidates = async (body: Record<string, unknown>): Promise<Result> => {
  const only = str(body.ledgerId).trim();
  const { ledgers, ieloves, props, takenBy } = await loadAll();
  const out: Record<string, { state: IeloveState; count: number; candidates?: Candidate[] }> = {};
  for (const l of ledgers) {
    const id = str(l.id);
    if (only && id !== only) continue;
    const linked = str(l.property_db_id) !== '';
    // ⚠️ 一覧ではつながっている台帳の候補は数えない（台帳を1件指定したときは、選び直せるように候補も返す）
    if (linked && !only) { out[id] = { state: 'linked', count: 0 }; continue; }
    const list = candidatesOf(ledgerPlaceOf(l, props), ieloves, takenBy);
    const state: IeloveState = linked ? 'linked'
      : str(l.property_db_match) === 'none' ? 'none'
      : list.length > 0 ? 'review' : 'unmatched';
    out[id] = { state, count: list.length, ...(only ? { candidates: list.slice(0, MAX_CANDIDATES) } : {}) };
  }
  return { httpStatus: 200, body: { status: 'success', ledgers: out } };
};

/** broker:ielove_match。今すぐ突き合わせる（全部の台帳と買い反響） */
export const runIeloveMatchNow = async (): Promise<Result> => {
  const result = await runIeloveMatch();
  return { httpStatus: 200, body: { status: 'success', ...result } };
};
```

### backend/scripts/sql/2026-11-10_realty_property_db_match.sql
```sql
-- =====================================================================
-- v2.2.258 不動産企画係：媒介獲得台帳といえらぶの物件のつなぎ方の列
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② の更新より**前に**流す（② の突き合わせ・台帳の保存がこの列を使う）
-- ⚠️ 何回流しても同じ（IF NOT EXISTS）
-- =====================================================================

-- auto＝② が自動でつないだ、staff＝人が選んだ・外した、none＝「該当なし」にした、NULL＝まだ（② の突き合わせの対象）
ALTER TABLE brokerage_listings ADD COLUMN IF NOT EXISTS property_db_match VARCHAR(10) NULL COMMENT 'いえらぶの物件のつなぎ方（auto・staff・none。v2.2.258）' AFTER property_db_name;

-- すでにつながっている台帳（中古の画面で人が選んだもの）は「人が選んだ」にする
UPDATE brokerage_listings SET property_db_match = 'staff'
 WHERE kind = 'ledger' AND property_db_id IS NOT NULL AND property_db_id <> '' AND property_db_match IS NULL;

-- 確認（結果が返ればよい）
SHOW COLUMNS FROM brokerage_listings LIKE 'property_db_match';
```

## git diff（既存ファイル）
```diff
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index 3bbced267..95181464a 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -1,6 +1,8 @@
 import type { RowDataPacket } from 'mysql2/promise';
 import { executeLarge, query } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
+import { logger } from '../../utils/logger';
+import { runIeloveMatch } from './ieloveMatch';
 
 /**
  * 不動産企画係（category = realty）のデータ（v2.2.221 で ① から移植）。
@@ -179,6 +181,8 @@ const ALLOWED_COLUMNS = [
   'deleted_at', 'deleted_by',
   'docDraft', 'docDraftAt', 'docDraftBy',
   'master_data_id', 'property_db_id', 'property_db_name',
+  // ⚠️ v2.2.258: いえらぶの物件のつなぎ方（auto＝自動・staff＝人が選んだ／外した・none＝該当なし）。ieloveMatch.ts
+  'property_db_match',
   'raw_data',
 ] as const;
 
@@ -197,6 +201,9 @@ const toSqlValue = (value: unknown): SqlValue => {
   return String(value);
 };
 
+/** property_db_match に入れてよい値（空＝NULL） */
+const PROPERTY_DB_MATCH = ['', 'auto', 'staff', 'none'];
+
 /** 連絡先（contact）を「電話 / メール」で作り直す反響の種類（v2.2.252） */
 const LEAD_KINDS_WITH_CONTACT = ['leads', 'buyLeads'];
 
@@ -234,6 +241,9 @@ export const runBrokerUpdate = async (body: Record<string, unknown>): Promise<Re
   const data = await withLeadContact(id, body.data !== null && typeof body.data === 'object' && !Array.isArray(body.data)
     ? (body.data as Record<string, unknown>)
     : {});
+  if (has(data, 'property_db_match') && !PROPERTY_DB_MATCH.includes(trimStr(data.property_db_match))) {
+    return fail(400, 'いえらぶの物件のつなぎ方（property_db_match）が正しくありません');
+  }
 
   const columns = ['`id`'];
   const updates: string[] = [];
@@ -254,6 +264,12 @@ export const runBrokerUpdate = async (body: Record<string, unknown>): Promise<Re
     params
   );
 
+  // ⚠️ v2.2.258: 台帳を保存したら、その台帳といえらぶの物件・買い反響をすぐ突き合わせる（失敗しても保存は成功のまま。30分ごとにもう一度動く）
+  const saved = (await query<DynamicRow>('SELECT kind FROM brokerage_listings WHERE `id` = ?', [id]))[0];
+  if (saved?.kind === 'ledger') {
+    await runIeloveMatch([id]).catch((error: unknown) => logger.error('realty: 台帳の保存のあとの、いえらぶの突き合わせに失敗しました', error));
+  }
+
   const rows = await query<DynamicRow>('SELECT * FROM brokerage_listings WHERE `id` = ?', [id]);
   const row = rows[0] ?? null;
 
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index be199a508..82b451131 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -184,6 +184,7 @@ import { runPlannerCompliance, runPlannerSettings, runPlannerState, runPlannerWe
 import { runImportCheck, runImportFinish, runImportRecords } from '../features/realty/importer';
 import { runCallLogs, runCallLogsImport, runCallMark, runCallUndo, runNaviSave, runPracticeLogsImport } from '../features/realty/calls';
 import { runLedgerLink } from '../features/realty/ledgerLink';
+import { runIeloveCandidates, runIeloveMatchNow } from '../features/realty/ieloveMatch';
 import { runUsedQueueList, runUsedQueueMark } from '../features/callq/usedQueue';
 import { INQUIRY_CATEGORIES, MASTER_CATEGORIES, runPrivacyEraseInquiry, runPrivacyEraseMaster } from '../features/privacy';
 import type { AuthenticatedStaff } from '../types/staff';
@@ -1231,6 +1232,10 @@ register({ request: 'broker', roll: 'list', summary: '媒介台帳などの全
 register({ request: 'broker', roll: 'report', summary: '月次報告書の元データ（broker:list と同じ）', phpSource: 'brokerAction/broker_report.php', auth: 'staff', handler: realty(BROKER_SHOPS, () => runBrokerList()) });
 register({ request: 'broker', roll: 'customer', summary: '中古の顧客と物件（台帳との紐づけ用）', phpSource: 'brokerAction/broker_customer.php', auth: 'staff', handler: realty(BROKER_SHOPS, () => runBrokerCustomer()) });
 register({ request: 'broker', roll: 'update', summary: '【書き込み】台帳などの1件を保存（UPSERT）', phpSource: 'brokerAction/broker_update.php', auth: 'staff', handler: realty(BROKER_SHOPS, (_s, body) => runBrokerUpdate(body)) });
+// ⚠️ v2.2.258 新規（② だけ）。媒介獲得台帳といえらぶの物件・買い反響のつながり。features/realty/ieloveMatch.ts
+//   台帳の編集画面（PropertyRegister.tsx）は中古の顧客DB・顧客詳細からも開くので broker と同じ担当事業
+register({ request: 'broker', roll: 'ielove_candidates', summary: '媒介獲得台帳の、いえらぶの物件の候補と状態', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(BROKER_SHOPS, (_s, body) => runIeloveCandidates(body)) });
+register({ request: 'broker', roll: 'ielove_match', summary: '【書き込み】媒介獲得台帳といえらぶの物件・買い反響を今すぐ突き合わせる', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(BROKER_SHOPS, () => runIeloveMatchNow()) });
 register({ request: 'activity', roll: 'history', summary: '不動産企画係: 変更履歴', phpSource: 'activityAction/activity_history.php', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runActivityHistory(body)) });
 register({ request: 'activity', roll: 'notice', summary: '不動産企画係: 本人宛の通知', phpSource: 'activityAction/activity_notice.php', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runActivityNotice(s, body)) });
 register({ request: 'activity', roll: 'read', summary: '【書き込み】不動産企画係: 本人宛の通知を既読にする', phpSource: 'activityAction/activity_read.php', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runActivityRead(s, body)) });
diff --git a/backend-express/src/server.ts b/backend-express/src/server.ts
index 0c88c8988..c5f971697 100644
--- a/backend-express/src/server.ts
+++ b/backend-express/src/server.ts
@@ -5,6 +5,7 @@ import { failInterruptedJobs } from './features/aiAnalysis/job';
 import { startMetaAdsScheduler } from './features/metaAds/scheduler';
 import { startCvMatch } from './features/tracking/cvMatch';
 import { startTrackingMaintenance } from './features/tracking/maintenance';
+import { startIeloveMatch } from './features/realty/ieloveMatch';
 import { gatewaySummary, logGatewayRoutes } from './gateway';
 import { logger } from './utils/logger';
 
@@ -38,6 +39,8 @@ const bootstrap = async (): Promise<void> => {
     startTrackingMaintenance();
     // 自社のフォームでないサイトの CV と反響の突き合わせ（v2.2.205。5分ごと）
     startCvMatch();
+    // 媒介獲得台帳といえらぶの物件・買い反響の突き合わせ（v2.2.258。30分ごと）
+    startIeloveMatch();
     // Claudeによる分析（v2.2.217）。再起動で消えた実行中の分析を失敗にする（画面が待ち続けないように）
     failInterruptedJobs()
       .then((count) => { if (count > 0) logger.warn(`ai_analysis: 再起動で中断された分析 ${count} 件を失敗にしました`); })
diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
index 780520ce7..dcb3a4076 100644
--- a/backend/scripts/guide/articles/common/screen-247.md
+++ b/backend/scripts/guide/articles/common/screen-247.md
@@ -2,7 +2,7 @@
 title: 反響から商談案件へのつながり（不動産企画係）
 section: 画面の使い方
 sort: 247
-summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談案件・買取再販案件へつなぐ動き（媒介紐付・購入申込・買付登録・買取案件へ）、商談案件管理・媒介獲得台帳の使い方。
+summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談案件・買取再販案件へつなぐ動き（媒介紐付・購入申込・買付登録・買取案件へ）、媒介獲得台帳といえらぶの物件・ポータルの買い反響の自動のつながり、商談案件管理・媒介獲得台帳の使い方。
 ---
 不動産企画係の画面では、反響の段階を変えると、次の台帳や案件へつながります。以前のアプリと同じ動きです。
 
@@ -54,10 +54,16 @@ summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談
 > 注意：今日の架電キュー・チームサマリーの編集画面では、段階に「媒介受託」を選べません。売り反響の画面の「媒介紐付」から登録してください。
 
 ## 買い反響（ポータル）
+### ポータルの問い合わせは自動で台帳につながります
+SUUMO・HOME'S・アットホームから届いた買い反響は、問い合わせの物件番号（いえらぶの物件番号と同じ）で、その物件の媒介獲得台帳に**自動で**紐づきます。
+- 台帳が、いえらぶの物件とつながっていることが条件です（この記事の「媒介獲得台帳」の「いえらぶの物件とつなぐ」）
+- 30分ごとと、台帳を保存したときに動きます。すでに紐づいている買い反響は変えません
+- メールで届いた反響や、電話・来店の反響は、自動ではつながりません。下の手順で紐づけてください
+
 ### 問合せ物件を媒介獲得台帳の物件に紐づける
 ポータルに載せる前の物件や、電話・来店の反響のように、どの物件への問い合わせかを自動で拾えないときは、編集画面で紐づけます。
 1. 買い反響の顧客名を押して編集画面を開く
-2. 「**問合せ物件（媒介獲得台帳）**」の欄に、台帳No.・売主名・所在地の一部を入れる（例：「吉野 3丁目」「125」）。空白で区切ると、すべての言葉に当てはまる物件だけに絞れます
+2. 「**問合せ物件（媒介獲得台帳）**」の欄に、台帳No.・売主名・所在地の一部・いえらぶの物件番号を入れる（例：「吉野 3丁目」「125」「274111」）。空白で区切ると、すべての言葉に当てはまる物件だけに絞れます
 3. 下に出た候補（台帳No.／売主／所在地／売出価格／媒介の種類／現況）を押す
 4. 「保存する」を押す
 
@@ -68,7 +74,7 @@ summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談
 - この欄で紐づけた買い反響は、台帳と同じ「媒介物件」にもつながります
 - 媒介獲得台帳の「🤝買付登録」の自社客付けで選んだ買い反響も、まだどの台帳にも紐づいていなければ、その台帳に紐づきます
 
-> 注意：物件名や住所が合っているだけでは、紐づきません。この欄か、媒介獲得台帳の「買付登録」で紐づけてください。
+> 注意：ポータルの問い合わせ以外は、物件名や住所が合っているだけでは紐づきません。この欄か、媒介獲得台帳の「買付登録」で紐づけてください。
 
 ### 段階と商談案件
 - 段階を「**購入申込**」にすると、「商談案件管理へ転記しますか？」と聞かれます。「OK」で、**商談案件管理に「買」の案件が1件作られます**。物件名・価格を確かめてください
@@ -93,6 +99,26 @@ summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談
 - 一覧は、**媒介契約日の新しい順に、全件を1枚**で出します（ページの切り替えはありません）。媒介契約日が入っていない台帳は、いちばん下に出ます
 - 担当欄は、反響・商談案件と同じ**担当者名**（空白なし）です。媒介紐付でも、台帳の編集画面で選び直しても、同じ形で入ります
 
+### いえらぶの物件とつなぐ
+媒介獲得台帳の物件と、いえらぶに登録した物件（中古住宅専門店の物件）をつなぎます。つながると、ポータルから届いた買い反響が、その台帳に自動で紐づきます。
+- 台帳を登録したあと、いえらぶに物件を登録すると、**所在地と種別**（マンションは建物名・部屋番号も）が同じ物件に、自動でつながります
+  - 30分ごとと、台帳を保存したときに動きます。すぐつなぎたいときは、一覧の上の「**いえらぶと突き合わせ**」を押します
+  - 所在地の空白・全角半角・「丁目・番地・番・号」と「-」の違い、先頭の「鹿児島県」はそろえて比べます
+- 一覧の「**ポータル連携（いえらぶ）**」の列に、つながり方が出ます。押すと編集画面が開きます
+  - 「**No.〇〇〇〇〇〇**」：いえらぶの物件番号につながっています
+  - 「**要確認 N件**」：所在地が近い物件が見つかりましたが、1件に決められません（同じ住所に区画が2つある、番地の細かさが違う、種別が違う など）。編集画面で選んでください
+  - 「**いえらぶ未採番**」：所在地が同じ物件が、いえらぶにまだありません。いえらぶに登録すると、自動でつながります
+  - 「**該当なし**」：いえらぶに載せない物件にしたもの
+- 一覧の上の「⑥ いえらぶ」で、要確認・未採番の台帳だけに絞れます
+
+編集画面の「**掲載物件連携（いえらぶの物件）**」の欄
+- いえらぶの物件番号・物件名・所在地の一部で探して選べます
+- まだつながっていない台帳には、所在地が近い物件の候補が出ます。押すとつながります（「保存する」で保存）
+- 「**外す**」でつながりを外せます。外した台帳や、人が選んだ台帳は、自動で変えられません
+- いえらぶに載せない物件は「**該当なし**」を押して保存します
+
+> 注意：いえらぶに物件を登録するときは、台帳の編集画面の「**所在地をコピー**」「**建物名をコピー**」を押して、いえらぶの入力欄に**貼り付けて**ください（Ctrl+C・Ctrl+V）。手で打ち直すと表記がずれて、自動でつながらず「要確認」「いえらぶ未採番」に残ります。
+
 ### 期限の見方
 台帳ごとに、次の3つの期限を出します。期限が近いと**黄色**、過ぎると**赤**になります。媒介終了・成約完了の台帳には出しません。
 - **レインズ（REINZ の列）**：まだ登録していない専属専任媒介・専任媒介に「要登録 11/12（あと3日）」のように出ます
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 3967a2bda..897d02b82 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -168,6 +168,9 @@ function expressProxyRequests(): array
         'planner:practice_logs_import',
         // ⚠️ v2.2.248: 売り反響の媒介紐付（台帳の作成を1つのトランザクションで。② だけ）
         'planner:ledger_link',
+        // ⚠️ v2.2.258: 媒介獲得台帳といえらぶの物件の候補・今すぐ突き合わせ（② だけ）
+        'broker:ielove_candidates',
+        'broker:ielove_match',
         // ⚠️ v2.2.239。中古リノベの今日の架電キュー（② だけ）。expressProxyExclusive() にも入れてある
         'callq_used:list',
         'callq_used:mark',
@@ -871,6 +874,9 @@ function expressProxyExclusive(): array
         'planner:practice_logs_import',
         // ⚠️ v2.2.248: 売り反響の媒介紐付（台帳の作成を1つのトランザクションで。② だけ）
         'planner:ledger_link',
+        // ⚠️ v2.2.258: 媒介獲得台帳といえらぶの物件の候補・今すぐ突き合わせ（② だけ）
+        'broker:ielove_candidates',
+        'broker:ielove_match',
         // v2.2.239 新規。中古リノベの今日の架電キュー（mark は書き込み）。⚠️ ① に PHP ハンドラは無い（② だけ）
         'callq_used:list',
         'callq_used:mark',
diff --git a/frontend/src/components/database/DatabaseBroker.tsx b/frontend/src/components/database/DatabaseBroker.tsx
index f6df789db..0b89d7542 100644
--- a/frontend/src/components/database/DatabaseBroker.tsx
+++ b/frontend/src/components/database/DatabaseBroker.tsx
@@ -68,7 +68,14 @@ export interface BrokerData {
     [key: string]: any;
 }
 
-type SortKey = 'displayName' | 'displayAddress' | 'displayPrice' | 'phase' | 'staff' | 'date' | 'medium' | 'updated_at';
+/** いえらぶの物件とのつながり（v2.2.258。② の features/realty/ieloveMatch.ts の IeloveState） */
+type IeloveState = 'linked' | 'review' | 'unmatched' | 'none';
+const IELOVE_LABEL: Record<IeloveState, string> = { linked: 'つながっている', review: '要確認', unmatched: 'いえらぶ未採番', none: '該当なし' };
+const IELOVE_BADGE: Record<IeloveState, string> = {
+    linked: 'bg-success bg-opacity-75', review: 'bg-warning text-dark', unmatched: 'bg-light text-secondary border', none: 'bg-secondary bg-opacity-50',
+};
+
+type SortKey ='displayName' | 'displayAddress' | 'displayPrice' | 'phase' | 'staff' | 'date' | 'medium' | 'updated_at';
 
 const DatabaseBroker = () => {
     const [originalData, setOriginalData] = useState<BrokerData[]>([]);
@@ -117,6 +124,39 @@ const DatabaseBroker = () => {
             .catch(e => console.error('[DatabaseBroker] 商談案件の読み込みに失敗しました', e));
     }, []);
     useEffect(() => { loadDeals(); }, [loadDeals]);
+
+    /**
+     * ⚠️ v2.2.258: いえらぶの物件とのつながり（② の broker:ielove_candidates。features/realty/ieloveMatch.ts）。
+     *   台帳 id → 状態（linked つながっている・review 候補あり＝要確認・unmatched 候補なし＝いえらぶ未採番・none 該当なし）
+     */
+    const [ielove, setIelove] = useState<Record<string, { state: IeloveState; count: number }> | null>(null);
+    const loadIelove = useCallback(() => {
+        apiClient.post('', { request: 'broker', roll: 'ielove_candidates' })
+            .then(res => setIelove(res.data?.ledgers ?? {}))
+            .catch(e => console.error('[DatabaseBroker] いえらぶの物件とのつながりを読めませんでした', e));
+    }, []);
+    useEffect(() => { loadIelove(); }, [loadIelove]);
+    const ieloveStateOf = (item: BrokerData): IeloveState | '' =>
+        item.property_db_id ? 'linked' : ielove?.[item.id]?.state ?? '';
+    const [searchIelove, setSearchIelove] = useState<IeloveState | ''>('');
+    const [matching, setMatching] = useState(false);
+    /** 「いえらぶと突き合わせ」：今すぐ ② の突き合わせを動かし、一覧を読み直す */
+    const runIeloveMatch = async () => {
+        setMatching(true);
+        try {
+            const res = await apiClient.post('', { request: 'broker', roll: 'ielove_match' });
+            if (res.data?.status !== 'success') throw new Error(res.data?.message || '突き合わせに失敗しました');
+            const list = await apiClient.post('', { request: 'broker', roll: 'list' });
+            setOriginalData(list.data.brokerage.filter((b: BrokerData) => b.kind === 'ledger' && b.show_dashboard === 1));
+            loadIelove();
+            alert(`いえらぶの物件と突き合わせました。\n台帳 ${res.data.ledgers}件・買い反響 ${res.data.buyLeads}件を新しくつなぎました。`);
+        } catch (e) {
+            console.error(e);
+            alert('いえらぶの物件との突き合わせに失敗しました。');
+        } finally {
+            setMatching(false);
+        }
+    };
     const closeOffer = useCallback(() => setOfferLedger(null), []);
 
     /**
@@ -191,8 +231,9 @@ const DatabaseBroker = () => {
             const matchStaff = !searchStaff || item.staff === searchStaff;
             const matchCategory = !searchCategory || item.category === searchCategory;
             const matchStatus = !searchStatus || item.propStatus === searchStatus
+            const matchIelove = !searchIelove || ieloveStateOf(item) === searchIelove;
 
-            return matchAddress && matchCustomer && matchStaff && matchCategory && matchStatus;
+            return matchAddress && matchCustomer && matchStaff && matchCategory && matchStatus && matchIelove;
         });
 
         // 2. 絞り込んだ結果をソート
@@ -226,7 +267,16 @@ const DatabaseBroker = () => {
         });
 
         return filtered;
-    }, [originalData, sortConfig, searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus]);
+        // eslint-disable-next-line react-hooks/exhaustive-deps -- ieloveStateOf は ielove だけを読む
+    }, [originalData, sortConfig, searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus, searchIelove, ielove]);
+
+    /** いえらぶの状態ごとの件数（絞り込みの選択肢に出す） */
+    const ieloveCounts = useMemo(() => {
+        const c: Record<string, number> = {};
+        for (const d of originalData) { const s = ieloveStateOf(d); if (s) c[s] = (c[s] ?? 0) + 1; }
+        return c;
+        // eslint-disable-next-line react-hooks/exhaustive-deps -- ieloveStateOf は ielove だけを読む
+    }, [originalData, ielove]);
 
     // ⚠️ v2.2.250: 媒介物件ごとの台帳 No.（同じ物件に台帳が2件以上あるとき、一覧に「同じ物件の台帳 N件」を出す）
     const ledgerNosByProperty = useMemo(() => {
@@ -284,6 +334,7 @@ const DatabaseBroker = () => {
             if (response.data.status === 'error') alert('更新に失敗しました');
             const filtered = response.data.brokerage.filter(b => b.kind === 'ledger' && b.show_dashboard === 1);
             setOriginalData(filtered);
+            loadIelove(); // ⚠️ v2.2.258: 保存のあと ② がいえらぶと突き合わせるので、札を読み直す
             const saved = filtered.find((b: BrokerData) => b.id === targetPropertyId);
             if (toOffer && saved && response.data.status !== 'error'
                 && window.confirm('台帳の現況を「買付有」にしました。\n商談案件管理へつなぐには、買付の内容（買主・買付金額・契約希望日）が要ります。\n買付登録の画面を開きますか？')) {
@@ -410,6 +461,20 @@ const DatabaseBroker = () => {
                                 ))}
                             </select>
                         </div>
+                        {/* ⚠️ v2.2.258: いえらぶの物件とのつながり */}
+                        <div className="col-md-2">
+                            <label className="form-label text-muted small fw-bold mb-1">⑥ いえらぶ</label>
+                            <select
+                                className="form-select form-select-sm"
+                                value={searchIelove}
+                                onChange={(e) => setSearchIelove(e.target.value as IeloveState | '')}
+                            >
+                                <option value="">すべて</option>
+                                {(Object.keys(IELOVE_LABEL) as IeloveState[]).map(s => (
+                                    <option key={s} value={s}>{IELOVE_LABEL[s]}（{ieloveCounts[s] ?? 0}件）</option>
+                                ))}
+                            </select>
+                        </div>
                     </div>
                 </div>
             </div>
@@ -426,6 +491,13 @@ const DatabaseBroker = () => {
                     */}
                     <span className="text-muted" style={{ fontSize: '11px' }}>媒介は売り反響を「媒介受託」にすると作られます</span>
                 </div>
+                {/* ⚠️ v2.2.258: ふだんは ② が30分ごとと台帳の保存のあとに突き合わせる。いえらぶに登録した直後に、すぐつなぎたいとき用 */}
+                <button className="btn btn-sm btn-outline-success bg-white rounded-pill px-3 py-0" style={{ fontSize: '11px' }}
+                    disabled={matching} onClick={runIeloveMatch}
+                    title="所在地・種別が一致するいえらぶの物件が1件だけの台帳をつなぎ、ポータルの買い反響を台帳へつなぎます（30分ごとにも自動で動きます）">
+                    {matching ? <span className="spinner-border spinner-border-sm me-1" style={{ width: '.8rem', height: '.8rem' }}></span> : <i className="bi bi-arrow-repeat me-1"></i>}
+                    いえらぶと突き合わせ
+                </button>
             </div>
 
             {/* === テーブルUI === */}
@@ -454,7 +526,7 @@ const DatabaseBroker = () => {
                                     <th className="py-2">販売報告</th>
                                     <th className="py-2">物件状態</th>
                                     <th className="py-2">MAP</th>
-                                    <th className="py-2">ポータル連携</th>
+                                    <th className="py-2">ポータル連携（いえらぶ）</th>
                                     {/* 💡 追加: サマリー列 */}
                                     <th className="py-2">サマリー</th>
                                     <th className="py-2">非表示</th>
@@ -586,11 +658,22 @@ const DatabaseBroker = () => {
                                                     ) : <span className="text-muted" style={{ fontSize: '11px' }}>-</span>}
                                                 </td>
                                                 <td>
-                                                    {item.property_db_id ? (
-                                                        <span className="badge bg-success bg-opacity-75">連携済み</span>
-                                                    ) : (
-                                                        <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
-                                                    )}
+                                                    {/* ⚠️ v2.2.258: いえらぶの番号・要確認・未採番・該当なし。押すと編集画面（候補から選べる） */}
+                                                    {(() => {
+                                                        const s = ieloveStateOf(item);
+                                                        if (!s) return <span className="text-muted" style={{ fontSize: '11px' }}>…</span>;
+                                                        const text = s === 'linked' ? `No.${item.property_db_id}`
+                                                            : s === 'review' ? `要確認 ${ielove?.[item.id]?.count ?? 0}件` : IELOVE_LABEL[s];
+                                                        const title = s === 'linked' ? `${item.property_db_name || ''}${item.property_db_match === 'auto' ? '（自動でつないだ）' : ''}`
+                                                            : s === 'review' ? '所在地が近いいえらぶの物件があります。編集画面で選んでください'
+                                                            : s === 'unmatched' ? 'いえらぶにまだ登録されていません（登録されると自動でつながります）' : 'いえらぶに載せない物件';
+                                                        return (
+                                                            <button type="button" className={`badge border-0 ${IELOVE_BADGE[s]}`} style={{ fontSize: '10px', cursor: 'pointer' }}
+                                                                title={title} onClick={() => setTargetPropertyId(item.id)}>
+                                                                {text}
+                                                            </button>
+                                                        );
+                                                    })()}
                                                 </td>
                                                 {/* 💡 追加: サマリーセル */}
                                                 <td>
diff --git a/frontend/src/components/database/PropertyRegister.tsx b/frontend/src/components/database/PropertyRegister.tsx
index 5cf226abc..11644f039 100644
--- a/frontend/src/components/database/PropertyRegister.tsx
+++ b/frontend/src/components/database/PropertyRegister.tsx
@@ -13,9 +13,30 @@ const styles = {
     suggestItem: { cursor: 'pointer', fontSize: '12px', minHeight: '36px', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', color: '#303030', letterSpacing: '.6px', display: 'flex', alignItems: 'center' },
     // 💡 連携バッジ用のスタイル
     badgeLinked: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e6fffa', color: '#38a169', border: '1px solid #9ae6b4', marginLeft: '8px', fontWeight: 'bold' },
-    badgeUnlinked: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f8f9fa', color: '#a0aec0', border: '1px solid #e2e8f0', marginLeft: '8px', fontWeight: 'bold' }
+    badgeUnlinked: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f8f9fa', color: '#a0aec0', border: '1px solid #e2e8f0', marginLeft: '8px', fontWeight: 'bold' },
+    // v2.2.258: いえらぶの物件の候補・小さいボタン
+    miniButton: { fontSize: '10px', padding: '2px 8px', border: '1px solid #ced4da', borderRadius: '4px', background: '#fff', color: '#495057', cursor: 'pointer', whiteSpace: 'nowrap' as const },
+    candidateBox: { marginTop: '6px', padding: '8px 10px', border: '1px solid #fbd38d', background: '#fffaf0', borderRadius: '4px', fontSize: '11px' },
+    candidateItem: { display: 'block', width: '100%', textAlign: 'left' as const, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '5px 8px', marginTop: '4px', fontSize: '11px', color: '#303030', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
 };
 
+/** いえらぶの物件の候補（② の broker:ielove_candidates。features/realty/ieloveMatch.ts の Candidate） */
+type IeloveCandidate = {
+    property_id: string;
+    property_name: string;
+    property_type: string;
+    address: string;
+    room_number: string;
+    price: string;
+    level: 'strong' | 'weak';
+    reason: string;
+    takenNo: string;
+};
+
+/** 探すための形（空白を除き、全角英数を半角に、「丁目」「番」「－」の揺れを「-」に、小文字に） */
+const normSearch = (v: string): string => v.normalize('NFKC').replace(/\s/g, '').replace(/鹿児島県|宮崎県/g, '')
+    .replace(/丁目|番地|番|[ー‐−–—―]/g, '-').replace(/号/g, '').toLowerCase();
+
 export interface BrokerData {
     internal_id: number;
     id: string;
@@ -128,10 +149,48 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
             name: p.property_name ?? '',
             type: p.property_type ?? '',
             address: p.address ?? '',
-            price: p.price ?? ''
+            price: p.price ?? '',
+            // ⚠️ v2.2.258: 番号・物件名・所在地のどれでも探せるように（空白・全角半角・「鹿児島県」を無視）
+            key: normSearch(`${p.property_id} ${p.property_name ?? ''} ${p.address ?? ''}`),
         }))
     }, [propertyList]);
 
+    /**
+     * ⚠️ v2.2.258: この台帳の、いえらぶの物件の候補（② の broker:ielove_candidates。所在地・種別で探したもの）。
+     *   まだ保存していない台帳（中古の画面の新規）は候補なし
+     */
+    const [candidates, setCandidates] = useState<IeloveCandidate[] | null>(null);
+    useEffect(() => {
+        if (!targetPropertyId) { setCandidates(null); return; }
+        let alive = true;
+        setCandidates(null);
+        apiClient.post('', { request: 'broker', roll: 'ielove_candidates', ledgerId: targetPropertyId })
+            .then(res => { if (alive) setCandidates(res.data?.ledgers?.[targetPropertyId]?.candidates ?? []); })
+            .catch(e => { console.error('[PropertyRegister] いえらぶの物件の候補を読めませんでした', e); if (alive) setCandidates([]); });
+        return () => { alive = false; };
+    }, [targetPropertyId]);
+
+    /** コピーした項目（「コピーしました」の表示） */
+    const [copied, setCopied] = useState('');
+    const copy = async (label: string, text: string) => {
+        if (!text) return;
+        try {
+            await navigator.clipboard.writeText(text);
+            setCopied(label);
+            setTimeout(() => setCopied(c => (c === label ? '' : c)), 1500);
+        } catch (e) {
+            // ⚠️ navigator.clipboard は HTTPS か localhost でしか使えない
+            console.error(e);
+            window.prompt('コピーできませんでした。下の文字を選んでコピーしてください', text);
+        }
+    };
+    /** いえらぶに貼り付ける所在地（市区町村＋番地。地図の URL は除く） */
+    const copyAddress = useMemo(() => {
+        const a1 = (editData.addr1 || '').trim();
+        const a2 = (editData.addr2 || '').replace(/https?:\/\/\S+/g, '').trim();
+        return a1 && a2.startsWith(a1) ? a2 : `${a1}${a2}`;
+    }, [editData.addr1, editData.addr2]);
+
     const displayCustomers = useMemo(() => {
         if (!searchQuery) return [];
         return filteredCustomer.filter(c =>
@@ -140,11 +199,10 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
     }, [searchQuery, filteredCustomer]);
 
     const displayProperties = useMemo(() => {
-        if (!searchPropertyQuery) return [];
-        return filteredProperty.filter(p =>
-            p.name.toLowerCase().includes(searchPropertyQuery.toLowerCase())
-        );
-    }, [searchPropertyQuery, filteredProperty]);
+        const words = searchPropertyQuery.split(/[\s　]+/).map(normSearch).filter(Boolean);
+        if (!words.length || searchPropertyQuery === (editData.property_db_name || '')) return [];
+        return filteredProperty.filter(p => words.every(w => p.key.includes(w))).slice(0, 30);
+    }, [searchPropertyQuery, filteredProperty, editData.property_db_name]);
 
     const handleInputChange = (field: keyof BrokerData, value: string | number | null) => {
         setEditData(prev => ({ ...prev, [field]: value }));
@@ -173,14 +231,33 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
         setShowDropdown(false);
     };
 
-    const handlePropertySelect = (property: { id: string, name: string, type: string, address: string, price: string | number }) => {
-        handleInputChange('property_db_id', property.id);
-        handleInputChange('property_db_name', property.name);
+    /** ⚠️ v2.2.258: 人が選んだ・外した・該当なしは property_db_match に残す（② の自動の突き合わせが上書きしない） */
+    const handlePropertySelect = (property: { id: string, name: string }) => {
+        setEditData(prev => ({ ...prev, property_db_id: property.id, property_db_name: property.name, property_db_match: 'staff' }));
         setSearchPropertyQuery(property.name);
         setShowPropertyDropdown(false);
     };
+    const handlePropertyClear = (match: 'staff' | 'none') => {
+        if (match === 'none' && !window.confirm('この物件は、いえらぶに載せない（該当なし）にしますか？\n自動の突き合わせでもつながらなくなります。')) return;
+        setEditData(prev => ({ ...prev, property_db_id: null, property_db_name: null, property_db_match: match }));
+        setSearchPropertyQuery('');
+    };
 
-    const renderLinkBadge = (id?: string | null) => {
+    const renderLinkBadge = (id?: string | null, match?: string | null) => {
+        if (id && match === 'auto') {
+            return (
+                <span style={styles.badgeLinked} title="所在地・種別が一致したので自動でつなぎました">
+                    <i className="bi bi-check-circle-fill me-1"></i>自動で連携
+                </span>
+            );
+        }
+        if (!id && match === 'none') {
+            return (
+                <span style={styles.badgeUnlinked} title="いえらぶに載せない物件（自動でもつながりません）">
+                    <i className="bi bi-slash-circle me-1"></i>該当なし
+                </span>
+            );
+        }
         if (id) {
             return (
                 <span style={styles.badgeLinked}>
@@ -249,16 +326,22 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
                             )}
                         </div>
 
-                        {/* 掲載物件連携 */}
+                        {/* 掲載物件連携（いえらぶの物件）。⚠️ v2.2.258: 番号・物件名・所在地で探す、候補、外す・該当なし */}
                         <div className="col-12 position-relative mt-2">
                             <label style={styles.label}>
-                                <i className="bi bi-building me-1 text-success"></i>掲載物件連携
-                                {renderLinkBadge(editData.property_db_id)}
+                                <i className="bi bi-building me-1 text-success"></i>掲載物件連携（いえらぶの物件）
+                                {renderLinkBadge(editData.property_db_id, editData.property_db_match)}
+                                {editData.property_db_id && <span style={{ marginLeft: '8px', color: '#718096' }}>No.{editData.property_db_id}</span>}
+                                <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
+                                    {editData.property_db_id
+                                        ? <button type="button" style={styles.miniButton} onClick={() => handlePropertyClear('staff')}>外す</button>
+                                        : editData.property_db_match !== 'none' && <button type="button" style={styles.miniButton} onClick={() => handlePropertyClear('none')}>該当なし（いえらぶに載せない）</button>}
+                                </span>
                             </label>
                             <input
                                 type="text"
                                 style={styles.input}
-                                placeholder="物件名を入力して検索..."
+                                placeholder="いえらぶの物件番号・物件名・所在地で探す（例：274111、西伊敷 50-3）"
                                 value={searchPropertyQuery}
                                 onChange={(e) => {
                                     setSearchPropertyQuery(e.target.value);
@@ -267,6 +350,11 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
                                 onFocus={() => setShowPropertyDropdown(true)}
                                 onBlur={() => setShowPropertyDropdown(false)}
                             />
+                            {showPropertyDropdown && searchPropertyQuery.trim() !== '' && propertyList.length === 0 && (
+                                <ul style={{ ...styles.suggestList, zIndex: 9998 }}>
+                                    <li style={{ ...styles.suggestItem, color: '#a0aec0' }}>いえらぶの物件を読み込み中…</li>
+                                </ul>
+                            )}
                             {showPropertyDropdown && displayProperties.length > 0 && (
                                 <ul style={{ ...styles.suggestList, zIndex: 9998 }}>
                                     {displayProperties.map(p => (
@@ -281,12 +369,36 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
                                             onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                         >
                                             <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
-                                                <span style={{ fontWeight: 'bold', color: '#4a5568' }}>{p.name}</span> <span style={{ color: '#a0aec0' }}>({p.type}_{p.address}) : {p.price}</span>
+                                                <span style={{ color: '#718096' }}>No.{p.id}</span> <span style={{ fontWeight: 'bold', color: '#4a5568' }}>{p.name}</span> <span style={{ color: '#a0aec0' }}>({p.type}_{p.address}) : {p.price}</span>
                                             </div>
                                         </li>
                                     ))}
                                 </ul>
                             )}
+                            {/* 所在地・種別から探した候補（まだつながっていないとき） */}
+                            {!editData.property_db_id && editData.property_db_match !== 'none' && candidates !== null && (
+                                <div style={styles.candidateBox}>
+                                    {candidates.length === 0 ? (
+                                        <div style={{ color: '#718096' }}>所在地が同じいえらぶの物件はまだありません（いえらぶ未採番）。いえらぶに登録すると、自動でつながります。</div>
+                                    ) : (
+                                        <>
+                                            <div style={{ color: '#975a16', fontWeight: 'bold', marginBottom: '4px' }}>
+                                                <i className="bi bi-exclamation-triangle me-1"></i>要確認：所在地が近いいえらぶの物件 {candidates.length}件（押すとつなぎます）
+                                            </div>
+                                            {candidates.map(c => (
+                                                <button type="button" key={c.property_id} style={styles.candidateItem}
+                                                    onClick={() => handlePropertySelect({ id: c.property_id, name: c.property_name })}>
+                                                    <span style={{ color: '#718096' }}>No.{c.property_id}</span>{' '}
+                                                    <b>{c.property_name}</b>{c.room_number ? ` ${c.room_number}` : ''}
+                                                    <span style={{ color: '#a0aec0' }}>（{c.property_type}_{c.address}）</span>
+                                                    <span style={{ color: c.level === 'strong' ? '#2f855a' : '#c05621', marginLeft: '6px' }}>{c.reason}</span>
+                                                    {c.takenNo && <span style={{ color: '#e53e3e', marginLeft: '6px' }}>台帳 No.{c.takenNo} につながっています</span>}
+                                                </button>
+                                            ))}
+                                        </>
+                                    )}
+                                </div>
+                            )}
                         </div>
 
                         <div className="col-12"><hr style={{ margin: '10px 0', borderColor: '#e2e8f0' }} /></div>
@@ -304,6 +416,17 @@ const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, set
                             <label style={styles.label}>建物名 (addr)</label>
                             <input type="text" style={styles.input} value={editData.addr || ''} onChange={e => handleInputChange('addr', e.target.value)} />
                         </div>
+                        {/* ⚠️ v2.2.258: いえらぶに登録するときは、ここからコピーして貼り付ける（表記がそろい、自動でつながる） */}
+                        <div className="col-12" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', fontSize: '11px', color: '#718096' }}>
+                            <span>いえらぶに登録するときは、コピーして貼り付けてください：</span>
+                            <button type="button" style={styles.miniButton} disabled={!copyAddress} onClick={() => copy('所在地', copyAddress)}>
+                                <i className="bi bi-clipboard me-1"></i>所在地をコピー
+                            </button>
+                            <button type="button" style={styles.miniButton} disabled={!editData.addr} onClick={() => copy('建物名', editData.addr || '')}>
+                                <i className="bi bi-clipboard me-1"></i>建物名をコピー
+                            </button>
+                            {copied && <span style={{ color: '#38a169' }}><i className="bi bi-check2 me-1"></i>{copied}をコピーしました</span>}
+                        </div>
 
                         {/* 💡 価格・手数料・担当 */}
                         <div className="col-md-4">
diff --git a/frontend/src/components/realty/common/LedgerPicker.tsx b/frontend/src/components/realty/common/LedgerPicker.tsx
index ffedf6921..dd90e625e 100644
--- a/frontend/src/components/realty/common/LedgerPicker.tsx
+++ b/frontend/src/components/realty/common/LedgerPicker.tsx
@@ -6,7 +6,8 @@ import { guessProperty } from './leadLinks';
  * 買い反響の「問合せ物件（媒介獲得台帳）」（v2.2.256。以前のアプリ v14.14 の blLedOpts・blLedPick を検索の形にしたもの）。
  *   入れた文字で媒介獲得台帳を探して候補に出し、押すとその台帳に紐づける。
  *   ポータルに載せる前の物件や、電話・来店の反響を、台帳の物件とつなぐため。
- * ⚠️ 探すのは 台帳No.・売主・所在地（addr1・addr2。URL は除く）・種別。空白・全角半角・大文字小文字は無視する。
+ * ⚠️ 探すのは 台帳No.・売主・所在地（addr1・addr2。URL は除く）・種別・いえらぶの物件番号と物件名（v2.2.258）。空白・全角半角・大文字小文字は無視する。
+ * ⚠️ v2.2.258 から、ポータルの買い反響は ② が問い合わせの物件番号で自動でつなぐ（features/realty/ieloveMatch.ts）。ここは手で選ぶとき用。
  * ⚠️ 媒介終了の台帳は候補に出さない（以前のアプリの blLedList と同じ）。今つながっている台帳は、媒介終了でも札に出す。
  */
 type Row = Record<string, unknown>;
@@ -33,7 +34,8 @@ const addrOf = (l: Row): string => {
 const yen = (v: unknown): string => (Number(v) ? `${Math.round(Number(v) / 10000).toLocaleString()}万円` : '');
 /** 候補・札の1行（以前のアプリの ledPickLabel に媒介の種類・現況を足した） */
 const labelOf = (l: Row): string =>
-    [`No.${str(l.no) || '―'}`, str(l.seller) || '売主未入力', addrOf(l).slice(0, 30), yen(l.price), str(l.baikaiType), str(l.propStatus)]
+    [`No.${str(l.no) || '―'}`, str(l.seller) || '売主未入力', addrOf(l).slice(0, 30), yen(l.price), str(l.baikaiType), str(l.propStatus),
+        str(l.property_db_id) ? `いえらぶ${str(l.property_db_id)}` : '']
         .filter(Boolean).join('／');
 
 const css = `
@@ -69,7 +71,8 @@ const LedgerPicker: React.FC<Props> = ({ ledgerId, ledgerNo, onPick }) => {
     const pool = useMemo(() => (ledger ?? [])
         .filter(l => str(l.propStatus) !== '媒介終了')
         .sort((a, b) => str(b.contractDate).localeCompare(str(a.contractDate)))
-        .map(l => ({ l, key: norm([`no.${str(l.no)}`, l.seller, l.addr1, str(l.addr2).split('http')[0], l.category].join(' ')) })), [ledger]);
+        // ⚠️ v2.2.258: いえらぶの物件番号（ポータルの自社の物件番号と同じ）・物件名でも探せる
+        .map(l => ({ l, key: norm([`no.${str(l.no)}`, l.seller, l.addr1, str(l.addr2).split('http')[0], l.category, l.property_db_id, l.property_db_name].join(' ')) })), [ledger]);
 
     const hits = useMemo(() => {
         const words = q.split(/[\s　]+/).map(norm).filter(Boolean);
@@ -115,7 +118,7 @@ const LedgerPicker: React.FC<Props> = ({ ledgerId, ledgerNo, onPick }) => {
             <input
                 className="lp_input"
                 value={q}
-                placeholder={ledger === null ? '媒介獲得台帳を読み込み中…' : '台帳No.・売主・所在地で探す（例：吉野 3丁目）'}
+                placeholder={ledger === null ? '媒介獲得台帳を読み込み中…' : '台帳No.・売主・所在地・いえらぶの物件番号で探す（例：吉野 3丁目）'}
                 disabled={ledger === null}
                 onChange={e => { setQ(e.target.value); setOpen(true); setCur(0); }}
                 onFocus={() => setOpen(true)}
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 917008452..5de6a5b4b 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.257';
+export const newVersion = '2.2.258';
```
