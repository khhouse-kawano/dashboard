/**
 * イベントの予約フォーム（v2.2.298）の入力欄。
 *
 * ─────────────────────────────────────────────
 * ⚠️ ここが入力欄の元（ラベル・種類・選択肢）。画面（フォーム作成）と公開フォームは ② から受け取って描く。
 *   ⚠️ 欄を足す・名前を変えるときはここだけを直す（画面・公開フォームに同じ一覧を写さない）。
 * ⚠️ key は event_db の列名と同じ（name → event_db.name …）。⚠️ 申し込みはこの key の列にだけ書く。
 *   ⚠️ ゲートウェイの request / roll / category と同じ名前の key を作らないこと（本文の鍵とぶつかる）。
 * ⚠️ fixed の欄（氏名・携帯電話・メールアドレス）は常に表示・必須（受付完了のメールと連絡に使うため）。
 * ─────────────────────────────────────────────
 */

export type FieldKind = 'text' | 'tel' | 'email' | 'zip' | 'radio' | 'number' | 'textarea';

export type FieldKey =
  | 'name' | 'kana' | 'phone' | 'mail' | 'zip' | 'address' | 'street'
  | 'medium' | 'area' | 'adult' | 'child' | 'house' | 'site' | 'question';

export interface FieldDef {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  /** radio の選択肢。⚠️ 選んだ文字がそのまま event_db に入る */
  options?: string[];
  /** 常に表示・必須（フォーム作成で外せない） */
  fixed?: boolean;
  /** 新しく作るフォームで必須にしておくか */
  defaultRequired?: boolean;
  /** 受ける長さ（⚠️ 超えた分は切る） */
  max: number;
  placeholder?: string;
  autocomplete?: string;
}

export const FIELD_DEFS: readonly FieldDef[] = [
  { key: 'name', label: '氏名（漢字）', kind: 'text', fixed: true, max: 64, placeholder: '例）国分 太郎', autocomplete: 'name' },
  { key: 'kana', label: '氏名（ふりがな）', kind: 'text', defaultRequired: true, max: 64, placeholder: '例）こくぶ たろう' },
  { key: 'phone', label: '携帯電話', kind: 'tel', fixed: true, max: 32, placeholder: '例）09012345678', autocomplete: 'tel' },
  { key: 'mail', label: 'メールアドレス', kind: 'email', fixed: true, max: 255, placeholder: '例）info@example.com', autocomplete: 'email' },
  { key: 'zip', label: '郵便番号', kind: 'zip', defaultRequired: true, max: 8, placeholder: '例）8994332', autocomplete: 'postal-code' },
  { key: 'address', label: '住所（番地まで）', kind: 'text', defaultRequired: true, max: 128, placeholder: '例）鹿児島県霧島市国分中央1-2-3', autocomplete: 'street-address' },
  { key: 'street', label: '建物名（ビル・マンション名・部屋番号）', kind: 'text', max: 128, placeholder: '例）○○マンション 101号室' },
  {
    key: 'medium', label: 'お申し込みのきっかけ', kind: 'radio', defaultRequired: true, max: 32,
    options: ['SNS広告', 'チラシ', '紹介', '看板', 'インターネット検索', 'YouTube'],
  },
  { key: 'area', label: '希望エリア', kind: 'text', max: 128, placeholder: '例）霧島市・姶良市' },
  { key: 'adult', label: '参加人数（大人）', kind: 'number', defaultRequired: true, max: 2 },
  { key: 'child', label: '参加人数（お子様）', kind: 'number', max: 2 },
  { key: 'house', label: 'ご自宅の状況', kind: 'radio', max: 8, options: ['持ち家', '賃貸'] },
  { key: 'site', label: '建築予定地', kind: 'text', max: 128, placeholder: '例）霧島市隼人町（未定の方は「未定」）' },
  { key: 'question', label: '備考', kind: 'textarea', max: 1000, placeholder: 'ご質問・ご要望などがあればご記入ください' },
];

/** 欄ごとの設定（event_form.fields に JSON で入る） */
export type FieldSettings = Record<FieldKey, { show: boolean; required: boolean }>;

/** 新しいフォームの既定（全部表示・defaultRequired の欄を必須） */
export const defaultSettings = (): FieldSettings =>
  Object.fromEntries(FIELD_DEFS.map((d) => [d.key, { show: true, required: d.fixed === true || d.defaultRequired === true }])) as FieldSettings;

/**
 * 保存されている JSON（または画面から来た値）を、欠けの無い設定に直す。
 * ⚠️ 読めない・項目が無いときは既定。⚠️ fixed の欄は必ず表示・必須。⚠️ 表示しない欄は必須にしない。
 * ⚠️ FIELD_DEFS に欄を足すと、保存済みのフォームにもその欄が既定（表示）で出る。出したくないときは足すときに既定を考えること。
 */
export const normalizeSettings = (value: unknown): FieldSettings => {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      raw = null;
    }
  }
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const base = defaultSettings();
  for (const d of FIELD_DEFS) {
    if (d.fixed) continue;
    const one = source[d.key];
    if (typeof one !== 'object' || one === null) continue;
    const show = (one as { show?: unknown }).show === true;
    base[d.key] = { show, required: show && (one as { required?: unknown }).required === true };
  }
  return base;
};
