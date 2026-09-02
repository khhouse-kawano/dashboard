import type { Feature } from '../core/feature';
import { analysis } from './analysis';
import { menu } from './menu';
import { staff } from './staff';
import { versions } from './versions';

/**
 * 全機能の登録簿。
 *
 * 新しい機能を追加するときは
 *   1. features/xxx.ts を作って defineFeature() でエクスポート
 *   2. このファイルの import と配列に1行ずつ追加
 * の2ステップだけ。URL の割り当てもバリデーションも認証も自動で組み上がる。
 *
 * PHP から移植するときの対応表は README を参照。
 */
export const features: Feature[] = [versions, staff, analysis, menu];
