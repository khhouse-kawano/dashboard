import type { RowDataPacket } from 'mysql2/promise';
import type { Tx } from '../../db/pool';
import { logger } from '../../utils/logger';

/**
 * 資金計画書のカルテ →  family_info への書き戻し。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **既存の行を「作り直す」のではなく「差分だけ当てる」。**
 *
 *   family_info の1人分は9項目ある。
 *
 *     relation / name / kana / birth / mail / mobile /
 *     employmentType / employer / employmentYears
 *
 *   資金計画書のカルテにあるのは、そのうち
 *
 *     奥様   … name / birth / employer（kana も年齢も無い）
 *     お子様 … name のみ（⚠️ 下記）
 *
 *   だけである。配列を組み直すと残り6項目が消える。
 *   必ず既存の要素を読み込み、上書きする項目だけ差し替えること。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **お子様は氏名しか書き戻せない。**
 *   計画書のお子様は `{ name, age, plan }` で、**生年月日を持たない**。
 *   age は family_info の birth から計算した派生値である
 *   （mapping.ts の buildInitialPlan → ageFrom）。
 *   age を birth に戻すことはできない（誕生日が分からない）ため、
 *   birth には触らない。触ると "2014-11-04" のような実データが失われる。
 *
 * ⚠️⚠️ **人数が減っても行を消さない。**
 *   計画書でお子様の行を削除しても family_info からは消さない。
 *   資金計画のシミュレーションから外しただけの操作で、
 *   顧客台帳の家族構成を消すのは行き過ぎである。
 *   削除は Dashboard の家族情報モーダルで行ってもらう。
 *
 * ⚠️ 孫・その他の続柄の行には一切触らない。
 *   計画書は「これから進学する子」だけを扱っており、
 *   計画書に出ていない家族を消す根拠が無い。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** family_info の1要素。⚠️ 未知のキーも保持するため index signature を持たせる */
export interface FamilyRow {
  relation?: string;
  name?: string;
  kana?: string;
  birth?: string;
  mail?: string;
  mobile?: string;
  employmentType?: string;
  employer?: string;
  employmentYears?: string;
  [key: string]: unknown;
}

/** 計画書のお子様1人分 */
interface PlanKid {
  name?: unknown;
  age?: unknown;
  plan?: unknown;
}

const CHILD_RELATIONS = new Set(['息子', '娘']);

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * ⚠️ 空文字は「変更なし」として扱う。
 *   計画書で空のまま保存されたときに既存の値を消さないため
 *   （mapping.ts の buildMasterDataWriteBack と同じ方針）。
 */
const filled = (value: unknown): string | null => {
  const s = asString(value).trim();
  return s === '' ? null : s;
};

/** ⚠️ 名前が空白だけの行が実在する（"name":" "）。人数の判定に使わない */
const hasName = (row: FamilyRow): boolean => asString(row.name).trim() !== '';

const parseFamilyJson = (raw: unknown): FamilyRow[] => {
  const s = asString(raw).trim();
  if (s === '') return [];
  try {
    const parsed: unknown = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as FamilyRow[]) : [];
  } catch {
    // ⚠️ 壊れた JSON を「空」と見なして組み直すと家族情報が消える。
    //   何もしないほうが安全なので、呼び出し側で null を返させる
    logger.warn('funding_plan: family_info の JSON が壊れているため書き戻しを見送りました');
    return [];
  }
};

/**
 * 計画書のお子様配列を取り出す。
 * ⚠️ 配列でも JSON 文字列でも受ける（呼び出し箇所のコメント参照）。
 */
const parseKids = (raw: unknown): PlanKid[] => {
  if (Array.isArray(raw)) return raw as PlanKid[];
  const s = asString(raw).trim();
  if (s === '') return [];
  try {
    const parsed: unknown = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as PlanKid[]) : [];
  } catch {
    return [];
  }
};

/** 壊れた JSON かどうか（空配列と区別する） */
const isBrokenJson = (raw: unknown): boolean => {
  const s = asString(raw).trim();
  if (s === '') return false;
  try {
    JSON.parse(s);
    return false;
  } catch {
    return true;
  }
};

export interface FamilyWriteBackResult {
  /** 実際に書き換えた項目の説明（画面に出す用） */
  changed: string[];
  /** ⚠️ 続柄が未設定のまま追加したお子様の人数。営業に知らせる必要がある */
  addedKidsWithoutRelation: number;
}

/**
 * 差分を当てる。書き換えが無ければ null を返す（＝SQLを流さない）。
 *
 * @param touched 画面で人が編集したキー。これに入っていない項目は触らない。
 *   ⚠️ お子様の編集は `kids` というキーで通知される（[data-k] ではないため）。
 */
export const mergeFamilyRows = (
  existing: FamilyRow[],
  plan: Record<string, unknown>,
  touched: ReadonlySet<string>
): { rows: FamilyRow[]; result: FamilyWriteBackResult } | null => {
  // ⚠️ 参照を共有しないよう複製する。呼び出し元の配列を書き換えない
  const rows: FamilyRow[] = existing.map((r) => ({ ...r }));
  const changed: string[] = [];
  let addedKidsWithoutRelation = 0;

  // --- 奥様 ---
  const spouseEdits: { key: string; field: keyof FamilyRow; label: string }[] = [
    { key: 'k_w_name', field: 'name', label: '奥様 お名前' },
    { key: 'k_w_birth', field: 'birth', label: '奥様 生年月日' },
    { key: 'k_w_work', field: 'employer', label: '奥様 お勤め先' },
  ];
  const spouseTouched = spouseEdits.filter((e) => touched.has(e.key));

  if (spouseTouched.length > 0) {
    // ⚠️⚠️ **先頭の配偶者行だけを更新する。** 配偶者の行が2行ある顧客が
    //   実在する（ローカルDBで確認。どちらも氏名が空白の不良データ）。
    //   全部に同じ値を入れると同じ人が2人いる状態になる。
    let index = rows.findIndex((r) => r.relation === '配偶者');

    if (index < 0) {
      // 配偶者の行が無いので追加する。⚠️ 他の6項目は空のまま
      rows.push({ relation: '配偶者' });
      index = rows.length - 1;
      changed.push('奥様の行を追加');
    }

    const target = rows[index];
    if (target !== undefined) {
      for (const edit of spouseTouched) {
        const value = filled(plan[edit.key]);
        if (value === null) continue;
        if (asString(target[edit.field]) === value) continue;
        target[edit.field] = value;
        changed.push(edit.label);
      }
    }
  }

  // --- お子様（氏名のみ） ---
  if (touched.has('kids')) {
    // ⚠️⚠️ `kids` は JSON 列なので、正規化を通った plan では
    //   **文字列**になっている（index.ts の cleanJson）。
    //   Array.isArray だけで判定すると常に空になり、
    //   お子様の書き戻しが黙って何もしない。両方受ける。
    const kids: PlanKid[] = parseKids(plan.kids);

    // ⚠️ buildInitialPlan が 息子・娘 を**出現順**に取り込んでいるので、
    //   同じ順番で突き合わせる。並べ替えの機能は計画書側に無い。
    const childIndexes = rows
      .map((r, i) => ({ r, i }))
      .filter((x) => CHILD_RELATIONS.has(asString(x.r.relation)))
      .map((x) => x.i);

    kids.forEach((kid, order) => {
      const name = filled(kid.name);
      if (name === null) return;

      const rowIndex = childIndexes[order];

      if (rowIndex === undefined) {
        // ⚠️⚠️ 計画書で増えたお子様。**続柄が分からない。**
        //   計画書のお子様は { name, age, plan } で息子／娘の区別を持たない。
        //   ここで「息子」と決め打つと性別を捏造することになるため空にする。
        //
        //   ⚠️ 続柄が空の行は buildInitialPlan の取り込み対象外なので、
        //     次に計画書を開いてもこのお子様は出てこない。
        //     Dashboard の家族情報モーダルで続柄を設定してもらう必要がある。
        //     そのため件数を呼び出し元へ返して画面に出す。
        rows.push({ relation: '', name });
        addedKidsWithoutRelation += 1;
        changed.push(`お子様「${name}」の行を追加`);
        return;
      }

      const target = rows[rowIndex];
      if (target === undefined) return;
      if (asString(target.name).trim() === name) return;

      // ⚠️ name だけ。birth / kana / その他は触らない（冒頭のコメント参照）
      target.name = name;
      changed.push(`お子様 お名前（${name}）`);
    });

    // ⚠️ kids.length < childIndexes.length（計画書で減った）でも消さない
  }

  if (changed.length === 0) return null;

  return { rows, result: { changed, addedKidsWithoutRelation } };
};

const SELECT_SQL = 'SELECT family_info FROM family_info WHERE id = ?';
/** ⚠️ family_info 列だけを更新する。shop / name は既存の値を保つ */
const UPDATE_SQL = 'UPDATE family_info SET family_info = ? WHERE id = ?';
/** 行が無いときだけ使う。⚠️ shop / name は master_data から埋める */
const INSERT_SQL = 'INSERT INTO family_info (id, shop, name, family_info) VALUES (?, ?, ?, ?)';

/**
 * family_info へ書き戻す。
 *
 * ⚠️ 呼び出し元と**同じトランザクション**で実行する。資金計画書だけ
 *   保存されて家族情報が古いまま、という状態を作らないため。
 *
 * ⚠️ 空文字の id では実行しない。family_info には id が空の行が実在し、
 *   `WHERE id = ''` で**他人の家族情報**を書き換えてしまう
 *   （features/familyInfo.ts の runFamilyInfoShow のコメント参照）。
 */
export const writeBackToFamilyInfo = async (
  tx: Tx,
  id: string,
  plan: Record<string, unknown>,
  touched: ReadonlySet<string>,
  /** 行が無いときの INSERT に使う。master_data の値 */
  fallback: { shop: string; name: string }
): Promise<FamilyWriteBackResult | null> => {
  if (id === '') return null;

  const relevant = ['k_w_name', 'k_w_birth', 'k_w_work', 'kids'];
  if (!relevant.some((k) => touched.has(k))) return null;

  const rows = await tx.query<DynamicRow>(SELECT_SQL, [id]);
  const current = rows[0];

  // ⚠️ 壊れた JSON のときは何もしない。空配列と見なして組み直すと
  //   読めなかった家族情報を消すことになる
  if (current !== undefined && isBrokenJson(current.family_info)) {
    logger.warn(`funding_plan: family_info が壊れているため書き戻しを見送りました id=${id}`);
    return null;
  }

  const existing = current === undefined ? [] : parseFamilyJson(current.family_info);

  const merged = mergeFamilyRows(existing, plan, touched);
  if (merged === null) return null;

  const json = JSON.stringify(merged.rows);

  if (current === undefined) {
    // ⚠️ 意味のある行が1つも無いなら作らない。空の家族情報の行が増えるだけ
    if (!merged.rows.some(hasName)) return null;
    await tx.execute(INSERT_SQL, [id, fallback.shop, fallback.name, json]);
  } else {
    await tx.execute(UPDATE_SQL, [json, id]);
  }

  return merged.result;
};
