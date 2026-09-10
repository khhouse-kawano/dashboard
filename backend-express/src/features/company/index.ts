import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import {
  ACHIEVEMENT_SQL,
  CONTRACT_KAERU_SQL,
  CONTRACT_RESALE_SQL,
  CONTRACT_SQL,
  SECTION_SQL,
  SHOP_SQL,
  STAFF_SQL,
} from './queries';

/**
 * 会社実績（company/Company.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元:
 *   backend/src/handlers/company.php                    （参照）
 *   backend/src/handlers/change_company_achievement.php （書き込み）
 *
 * ⚠️ 参照（company）は ① に PHP ハンドラが実在するので、
 *   転送に失敗したら ① にフォールバックしてよい。
 *
 * ⚠️⚠️ 書き込み（change_company_achievement）は**フォールバック禁止**に
 *   登録している。両方で実行されると company_achievement が二重に書かれる。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface CompanyResult {
  httpStatus: number;
  body: unknown;
}

export const runCompany = async (): Promise<CompanyResult> => {
  /**
   * ⚠️ 並列で投げる。PHP は逐次だったが結果は同じで、
   *   契約者一覧が数万行あるため待ち時間が縮む。
   *
   * ⚠️⚠️ **キー名と順序は PHP と同じにする。**
   *   フロントは response.data.staff / .shop / .section /
   *   .contract / .contract_kaeru / .contract_resale / .achievement
   *   をそのまま読む。
   */
  const [staff, shop, section, contract, contractKaeru, contractResale, achievement] =
    await Promise.all([
      query<DynamicRow>(STAFF_SQL),
      query<DynamicRow>(SHOP_SQL),
      query<DynamicRow>(SECTION_SQL),
      query<DynamicRow>(CONTRACT_SQL),
      query<DynamicRow>(CONTRACT_KAERU_SQL),
      query<DynamicRow>(CONTRACT_RESALE_SQL),
      query<DynamicRow>(ACHIEVEMENT_SQL),
    ]);

  return {
    httpStatus: 200,
    body: {
      staff,
      shop,
      section,
      contract,
      contract_kaeru: contractKaeru,
      contract_resale: contractResale,
      achievement,
    },
  };
};

/** 文字列として受け取る。⚠️ 数値で送られても文字列に揃える（PHP は型を見ない） */
const asString = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * 契約目標の登録・更新。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`ON DUPLICATE KEY UPDATE` に頼っている。**
 *   company_achievement に (period, category, name) の一意キーが
 *   無いと、同じマスに何度も行が増えて合計が狂う。
 *   ⚠️ キーの有無を変える改修をするときは、この upsert も見直すこと。
 *
 * ⚠️ PHP は入力を一切検証せず、そのまま4値を渡している。
 *   ここでも同じ挙動にしている（検証を足すと、これまで通っていた
 *   空文字などが弾かれて画面の保存が失敗するようになる）。
 *   ⚠️ ただし undefined を渡すと mysql2 が例外を投げるため、
 *     空文字に落としている。
 * ─────────────────────────────────────────────
 */
export const runChangeCompanyAchievement = async (
  body: Record<string, unknown>
): Promise<CompanyResult> => {
  try {
    await execute(
      'INSERT INTO company_achievement (period, category, name, value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [
        asString(body.period),
        asString(body.category),
        asString(body.name),
        asString(body.value),
      ]
    );

    return { httpStatus: 200, body: { status: 'success' } };
  } catch (error) {
    // ⚠️ PHP と同じ 500 とメッセージにする。フロントは status を見ていないが、
    //   ① へ戻したときに挙動が変わらないようにしておく
    console.error('change_company_achievement failed', error);
    return {
      httpStatus: 500,
      body: { status: 'error', message: 'データの保存に失敗しました。' },
    };
  }
};
