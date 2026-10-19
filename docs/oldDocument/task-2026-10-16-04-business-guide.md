# 2026-10-16-04 業務ガイド（v2.2.194）

## 指示
1. 機能が多く、新しく触れる人が難しく感じる。チャットボットではなく、Wiki のような機能を作りたい（「契約したら（注文営業）」のような文字を押すと記事が出る）。
2. 記事は DB に置く。編集できるのは authority が Master・BrandAdmin。最初は注文営業。
3. UI は GoogleReview.tsx をベンチマーク。スクリーンショットは使わずテキストで、視認性よく。
4. 入口ボタン: ActiveUser.tsx の「要確認」の下・Header.tsx の「マーケット情報」の右・Category.tsx の4つのボタンの下。名前は「業務ガイド」。
5. 作業しながら読むので別ウインドウで開く（目次と記事を同じウインドウに）。
6. （追加）コンポーネントを追加・修正するたびにエージェントが記事を直し、版の SQL に UPDATE を入れる。手で直された記事でもエージェント側を優先。CLAUDE.md に追記。
7. （追加）直近で作った・直した画面の記事も作る。
8. （追加）建売・中専（中古リノベ）も追加。建売のランクは「顧客ルール・ランク定義.pdf」、契約したときの操作は Company.tsx を参考に。

## 作ったもの
- **ディレクトリ** `frontend/src/components/guide/`（新規）
  - **Guide.tsx**：業務ガイドの画面（`/guide`、記事は `/guide?id=12`）。左＝目次・検索、中央＝記事、右＝見出し。事業の切り替え（注文・建売・中古）。
  - **GuideMarkdown.tsx**：本文の表示。`[[タイトル]]` のリンク（無い記事は赤）、注意・要確認・ポイントの枠、見出しの id。
    - 追加した関数：`outsideCode`・`expandLinks`・`expandStrong`・`expandGuideLinks`・`headingId`・`headingsOf`・`textOf`・`calloutKind`
  - **GuideEditor.tsx**：記事を作る・直す（左に入力・右にプレビュー）。
  - **GuideLink.tsx**：画面の中に置く記事へのリンク部品（`<GuideLink title="契約したら（注文営業）" />`）。⚠️ 今回は部品だけで、画面にはまだ置いていない。
  - **openGuide.ts**：別ウインドウで開く（`openGuide`）・事業の定義（`GUIDE_DIVISIONS`・`GUIDE_COMMON`・`isGuideCategory`・`allowedGuideDivisions`）。
- **② ファイル** `backend-express/src/features/guide.ts`（新規）：`listGuide`・`getGuide`・`saveGuide`・`canEditGuide`
- **② の request**：`guide_list`・`guide_article`・`guide_save`（registry.ts）。⚠️ 編集権限は `auth: 'staff'` で受けて saveGuide の中で判定（`auth: 'master'` だと BrandAdmin が通らない）。
- **① PHP** `express_proxy.php`：3つを `expressProxyRequests()` と `expressProxyExclusive()` の両方に追加。
- **表**（`backend/scripts/sql/2026-10-16_guide_article.sql`）：`guide_article`（記事）・`guide_history`（保存の直前の内容）。
- **記事の原稿** `backend/scripts/guide/articles/<事業>/*.md`（58本）と、そこから SQL を作る `backend/scripts/guide/build-guide-sql.cjs`。
  - SQL は `2026-10-16_update_log_2.2.194.sql` の後半に入れた（CLAUDE.md の新しいルールどおり）。
- **入口ボタン**：ActiveUser.tsx（要確認の下）・Header.tsx（マーケット情報の右）・Category.tsx（4つのボタンの下）。対象は注文営業・建売営業・中古リノベ。
- **App.tsx**：`/guide` のときはヘッダー・メニュー・アクティブユーザー・要確認を出さない。
- **CLAUDE.md**：「業務ガイドの記事（v2.2.194〜）」を追加。

## 決めたこと・気づいたこと
- ⚠️ **記事の URL を `/guide/12` にしない。** index.html が部品を `./static/...` で読むため、2段の URL で再読み込みすると真っ白になる（ブラウザで確認して `?id=` に変えた）。
- ⚠️ 日本語の太字（`**「契約済み」**のお客様`）は Markdown の規則で閉じないことがあるため、表示の前にリンクの形へ置き換えて `<strong>` で出す。
- ⚠️ 表（`|` 区切り）は使えない（表の部品を入れていない）。
- 建売のランク（S〜F・A〜D 保有25件・E以下へ落とすときは理由必須・F は上長承認・1名簿に架電10回必須）は PDF「顧客ルール・ランク定義」から。
- 「要確認：」の枠は社内ルールなど現場で確かめてほしいところ（契約時の報告先、中古リノベのランクの上げ方など）。
- コードを読んでの注意（今回は直していない）：店舗別広告費（注文）で媒体を絞り込んでも広告費が絞られない可能性がある（記事「店舗別広告費」に要確認として残した）。

## 記事の一覧（58本）
| ファイル | タイトル | 分類 |
|---|---|---|
| order/flow-010.md | 反響が来たら | 業務の流れ |
| order/flow-020.md | 来場予約が入ったら・来場したら | 業務の流れ |
| order/flow-030.md | 次アポを取ったら | 業務の流れ |
| order/flow-040.md | 契約したら（注文営業） | 業務の流れ |
| order/flow-050.md | 失注したら | 業務の流れ |
| order/flow-060.md | 毎日の確認（要確認） | 業務の流れ |
| order/screen-010.md | 反響一覧 | 画面の使い方 |
| order/screen-020.md | 顧客DB | 画面の使い方 |
| order/screen-030.md | 店舗・担当別反響 | 画面の使い方 |
| order/screen-040.md | 反響MAP | 画面の使い方 |
| order/screen-050.md | 販促媒体別広告費 | 画面の使い方 |
| order/screen-060.md | 店舗別広告費 | 画面の使い方 |
| order/screen-070.md | 反響推移（販促媒体別・店舗別） | 画面の使い方 |
| order/screen-080.md | カレンダー | 画面の使い方 |
| order/screen-090.md | K-snap登録 | 画面の使い方 |
| order/screen-100.md | 全社報告用フォーマット | 画面の使い方 |
| order/screen-160.md | AIデジタル資金計画書 | 画面の使い方 |
| order/term-010.md | 反響 | 用語 |
| order/term-020.md | 来場 | 用語 |
| order/term-030.md | 次アポ | 用語 |
| order/term-040.md | 契約 | 用語 |
| order/term-050.md | ランク | 用語 |
| order/term-060.md | 来場率・次アポ率・契約率 | 用語 |
| spec/flow-010.md | 反響が来たら（建売営業） | 業務の流れ |
| spec/flow-020.md | 接触・来場したら（建売営業） | 業務の流れ |
| spec/flow-030.md | 契約したら（建売営業） | 業務の流れ |
| spec/flow-040.md | 毎日の確認（要確認）（建売営業） | 業務の流れ |
| spec/screen-010.md | 反響一覧（建売営業） | 画面の使い方 |
| spec/screen-020.md | 顧客DB（建売営業） | 画面の使い方 |
| spec/screen-030.md | 店舗・担当別反響（建売営業） | 画面の使い方 |
| spec/screen-040.md | 広告費の画面（建売営業） | 画面の使い方 |
| spec/screen-050.md | 物件DB | 画面の使い方 |
| spec/screen-060.md | 全社報告用フォーマット（建売営業） | 画面の使い方 |
| spec/term-010.md | ランク（建売営業） | 用語 |
| spec/term-020.md | 顧客ルール（建売営業） | 用語 |
| spec/term-030.md | 来場・次アポ・契約（建売営業） | 用語 |
| used/flow-010.md | 反響が来たら（中古リノベ） | 業務の流れ |
| used/flow-020.md | 来場・物件案内のあと（中古リノベ） | 業務の流れ |
| used/flow-030.md | 契約したら（中古リノベ） | 業務の流れ |
| used/flow-040.md | 毎日の確認（要確認）（中古リノベ） | 業務の流れ |
| used/screen-010.md | 反響一覧（中古リノベ） | 画面の使い方 |
| used/screen-020.md | 顧客DB（中古リノベ） | 画面の使い方 |
| used/screen-030.md | 店舗・担当別反響（中古リノベ） | 画面の使い方 |
| used/screen-040.md | 全社報告用フォーマット（中古リノベ） | 画面の使い方 |
| used/term-010.md | ランク（中古リノベ） | 用語 |
| used/term-020.md | 取引区分（中古リノベ） | 用語 |
| used/term-030.md | 来場・次アポ・契約（中古リノベ） | 用語 |
| common/screen-110.md | 重複反響サマリー | 画面の使い方 |
| common/screen-120.md | 紹介キャンペーンサマリー | 画面の使い方 |
| common/screen-130.md | 営業別契約率 | 画面の使い方 |
| common/screen-140.md | 契約数ランキング | 画面の使い方 |
| common/screen-150.md | Claudeによる分析 | 画面の使い方 |
| common/screen-170.md | アクティブユーザー（右上のパネル） | 画面の使い方 |
| common/screen-180.md | 業務ガイドの使い方 | 画面の使い方 |
| common/screen-190.md | 業務ガイドの書き方（編集できる人向け） | 画面の使い方 |
| common/term-070.md | 反響単価・来場単価・次アポ単価・契約単価 | 用語 |
| common/term-080.md | 反響日起算と実績日起算 | 用語 |
| common/term-090.md | 重複（2つの意味） | 用語 |

## テスト
- ① 経由（`localhost:8080`）でトークン無し → 3つとも 401（② まで届いている）。許可リストに無い名前は 404。
- ② の関数を権限ごとに実行：一般は読めるが保存 403／BrandAdmin・Master は作成・更新できる／非公開は一般に見えない／更新で直前の内容が履歴に残る／タイトル重複 409・空・[ ]・長すぎ 400。
- Playwright（API はモック、記事はローカル DB の内容）:
  - 入口ボタン3か所が出る（注文・建売・中古）、不動産企画係には出ない。
  - 別ウインドウで開く・2回目は同じ窓・ガイドの窓にヘッダーが出ない。
  - 記事・目次の移動・記事内リンク・検索・`?title=`・無い記事の案内・狭い窓。
  - BrandAdmin で直す → 保存 → 赤いリンクから新規作成 → リンクが緑に戻る。
  - 建売の人は建売と共通の記事だけ、全事業の人は切り替えられる、別の事業の記事を開くと切り替えが移る。
  - 58本すべてで `**` `[[` `](` が文字で残っていない（書き方の記事の例は除く）。
  - 記事を開いて再読み込みしても表示される。
- フロントの型チェック：以前からある5件のみ。ビルド `main.5ae2ef2c.js`。② の型チェック通過。

## 追加したファイル（全文）

### backend-express/src/features/guide.ts
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../db/pool';
import type { AuthenticatedStaff } from '../types/staff';

/**
 * 業務ガイド（v2.2.194 新規）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面: frontend/src/components/guide/Guide.tsx（別ウインドウで開く `/guide`）
 * ⚠️ 表:   guide_article / guide_history（backend/scripts/sql/2026-10-16_guide_article.sql）
 *
 * ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ express_proxy.php の転送リストと転送専用リストの両方に入れてある。
 *
 * ⚠️ 読むのはログインした人全員。⚠️⚠️ **書くのは authority が Master / BrandAdmin の人だけ。**
 *   ⚠️ registry の `auth: 'master'` は Master しか通さない（BrandAdmin が入れない）ので、
 *     ⚠️ `auth: 'staff'` で受けてここで判定する（`canEditGuide`）。
 *
 * ⚠️ 事業区分（order / spec / used / common）。⚠️ 絞り込みは画面側（Guide.tsx）で行う（⚠️ リンクは事業をまたいで張れる）。
 * ⚠️ 記事は消さない（⚠️ published = 0 で隠す）。⚠️ 保存のたびに直前の内容を guide_history に積む。
 * ─────────────────────────────────────────────
 */

/** 編集できる authority（⚠️ staff.brand に入っている値） */
const EDITORS = ['Master', 'BrandAdmin'];
export const canEditGuide = (staff: AuthenticatedStaff | null): boolean => staff !== null && EDITORS.includes(staff.brand);

/** 分類（⚠️ 画面の並び順もこの順） */
export const GUIDE_SECTIONS = ['業務の流れ', '画面の使い方', '用語'] as const;
/** 事業区分。⚠️ common は全事業に出す。⚠️ 建売・中古は 2026-10-16 の指示で追加 */
export const GUIDE_DIVISIONS = ['order', 'spec', 'used', 'common'] as const;

/**
 * 本文の上限（バイト）。
 * ⚠️⚠️ **mysql2 の execute() は 65,535 バイト以上の値で落ちる**（db/pool.ts の executeLarge の説明）。
 *   ⚠️ 記事にそこまでの長さは要らないので、executeLarge を使わず上限で止める。
 */
const MAX_BODY_BYTES = 60000;

interface ArticleRow extends RowDataPacket {
  id: number;
  title: string;
  division: string;
  section: string;
  summary: string;
  body?: string;
  sort: number;
  published: number;
  updated_by: string;
  updated_at: string;
}

export interface GuideResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): GuideResult => ({ httpStatus: 200, body: { status: 'ok', ...body } });
const fail = (httpStatus: number, message: string): GuideResult => ({ httpStatus, body: { status: 'error', message } });
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** 一覧（⚠️ 本文なし）。⚠️ 編集できる人には隠した記事も返す（⚠️ 戻せるように） */
export const listGuide = async (staff: AuthenticatedStaff | null): Promise<GuideResult> => {
  const editor = canEditGuide(staff);
  const rows = await query<ArticleRow>(
    `SELECT id, title, division, section, summary, sort, published, updated_by,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated_at
       FROM guide_article
      ${editor ? '' : 'WHERE published = 1'}
      ORDER BY FIELD(section, ${GUIDE_SECTIONS.map(() => '?').join(', ')}), sort, id`,
    [...GUIDE_SECTIONS]
  );
  return ok({ canEdit: editor, sections: GUIDE_SECTIONS, articles: rows });
};

/** 記事1本（id で取る）。⚠️ 隠した記事は編集できる人だけ */
export const getGuide = async (staff: AuthenticatedStaff | null, idValue: unknown): Promise<GuideResult> => {
  const id = Number(idValue);
  if (!Number.isInteger(id) || id <= 0) return fail(400, '記事が指定されていません。');
  const rows = await query<ArticleRow>(
    `SELECT id, title, division, section, summary, body, sort, published, updated_by,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated_at
       FROM guide_article WHERE id = ?`,
    [id]
  );
  const article = rows[0];
  if (article === undefined || (article.published !== 1 && !canEditGuide(staff))) return fail(404, '記事が見つかりません。');
  return ok({ article });
};

interface SaveInput {
  id?: unknown;
  title?: unknown;
  division?: unknown;
  section?: unknown;
  summary?: unknown;
  body?: unknown;
  sort?: unknown;
  published?: unknown;
}

/**
 * 記事を保存する（⚠️ id が無ければ新規）。
 * ⚠️ 更新のときは、上書きする前の内容を guide_history に積む（同じトランザクション）。
 */
export const saveGuide = async (staff: AuthenticatedStaff | null, input: SaveInput): Promise<GuideResult> => {
  if (!canEditGuide(staff) || staff === null) return fail(403, '業務ガイドを編集する権限がありません。');

  const title = text(input.title, 191);
  const section = text(input.section, 32);
  const division = text(input.division, 16) || 'order';
  const summary = text(input.summary, 255);
  const body = typeof input.body === 'string' ? input.body.replace(/\r\n/g, '\n') : '';
  const sort = Number.isInteger(Number(input.sort)) ? Number(input.sort) : 0;
  const published = input.published === 0 || input.published === '0' || input.published === false ? 0 : 1;
  const id = input.id === undefined || input.id === null || input.id === '' ? null : Number(input.id);

  if (title === '') return fail(400, 'タイトルを入力してください。');
  if (/[[\]]/.test(title)) return fail(400, 'タイトルに [ ] は使えません（リンクの記号と区別できなくなるため）。');
  if (!(GUIDE_SECTIONS as readonly string[]).includes(section)) return fail(400, '分類を選んでください。');
  if (!(GUIDE_DIVISIONS as readonly string[]).includes(division)) return fail(400, '事業区分が正しくありません。');
  if (body.trim() === '') return fail(400, '本文を入力してください。');
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return fail(400, '本文が長すぎます。記事を分けてください。');
  if (id !== null && (!Number.isInteger(id) || id <= 0)) return fail(400, '記事の指定が正しくありません。');

  const duplicate = await query<ArticleRow>('SELECT id FROM guide_article WHERE title = ? AND id <> ?', [title, id ?? 0]);
  if (duplicate.length > 0) return fail(409, '同じタイトルの記事がすでにあります。');

  const savedId = await withTransaction(async (tx) => {
    if (id === null) {
      const result = await tx.execute(
        `INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, division, section, summary, body, sort, published, staff.name]
      );
      return result.insertId;
    }
    const before = await tx.query<ArticleRow>('SELECT id FROM guide_article WHERE id = ? FOR UPDATE', [id]);
    if (before.length === 0) return null;
    await tx.execute(
      `INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
       SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE id = ?`,
      [id]
    );
    await tx.execute(
      `UPDATE guide_article SET title = ?, division = ?, section = ?, summary = ?, body = ?, sort = ?, published = ?, updated_by = ?
        WHERE id = ?`,
      [title, division, section, summary, body, sort, published, staff.name, id]
    );
    return id;
  });
  if (savedId === null) return fail(404, '記事が見つかりません。');
  return ok({ id: savedId });
};
```

### frontend/src/components/guide/Guide.tsx
```tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import GuideMarkdown, { headingsOf } from './GuideMarkdown';
import GuideEditor, { GuideDraft } from './GuideEditor';
import { GUIDE_DIVISIONS, GUIDE_COMMON, allowedGuideDivisions } from './openGuide';

/**
 * 業務ガイド（v2.2.194 新規）。別ウインドウで開く `/guide`（記事は `/guide?id=12`）。
 *
 * ⚠️⚠️ **記事を `/guide/12` の形にしないこと。** ⚠️ index.html が画面の部品を相対パス（`./static/...`）で読むため、
 *   ⚠️ 2段の URL で再読み込みすると部品の場所がずれて真っ白になる（2026-10-16 にブラウザで確認）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 開き方: openGuide.ts（ヘッダー・アクティブユーザー・トップ画面の「業務ガイド」ボタン、GuideLink）。
 * ⚠️⚠️ App.tsx で `/guide` のときだけヘッダー・メニュー・アクティブユーザー・要確認を出さない。
 *
 * ⚠️ 画面: 左＝目次（分類別の記事一覧・検索）／中央＝記事／右＝記事内の見出し。
 *   ⚠️ 窓を狭くすると右の見出しを消し、左の目次はボタンで開閉する。
 *
 * ⚠️ 事業（注文営業・建売営業・中古リノベ）ごとに記事を分けて出す（⚠️ 建売・中古は 2026-10-16 の追加指示）。
 *   ⚠️ 共通（common）の記事はどの事業にも出す。⚠️ 見られる事業は allowedGuideDivisions（openGuide.ts）。
 *   ⚠️ リンクは事業をまたいで張れる。⚠️ 別の事業の記事を開いたら、上の切り替えもその事業に移す。
 * ⚠️ 編集（作る・直す）は Master / BrandAdmin（② が判定し、`canEdit` で返す）。
 * ⚠️ `?title=タイトル` で開かれたら、そのタイトルの記事へ移る（GuideLink 用）。
 * ─────────────────────────────────────────────
 */

interface ArticleSummary {
    id: number;
    title: string;
    division: string;
    section: string;
    summary: string;
    sort: number;
    published: number;
    updated_by: string;
    updated_at: string;
}

interface Article extends ArticleSummary {
    body: string;
}

const emptyDraft = (section: string, division: string, title = ''): GuideDraft => ({
    id: null, title, division, section, summary: '', body: '', sort: 0, published: true,
});

const Guide: React.FC = () => {
    const { authority, category, shopName } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const idParam = searchParams.get('id') ?? undefined;
    const titleParam = searchParams.get('title') ?? '';

    const allowedDivisions = useMemo(() => allowedGuideDivisions(authority, category, shopName), [authority, category, shopName]);
    const allowed = allowedDivisions.length > 0;

    const [articles, setArticles] = useState<ArticleSummary[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [canEdit, setCanEdit] = useState(false);
    const [listLoaded, setListLoaded] = useState(false);
    const [article, setArticle] = useState<Article | null>(null);
    const [message, setMessage] = useState('');
    const [keyword, setKeyword] = useState('');
    const [draft, setDraft] = useState<GuideDraft | null>(null);
    const [navOpen, setNavOpen] = useState(false);
    /** 表示中の事業。⚠️ はじめは選んでいる事業（category）。⚠️ 見られなければ最初の1つ */
    const [division, setDivision] = useState<string>(() => (allowedDivisions.includes(category) ? category : allowedDivisions[0] ?? 'order'));
    const divisionLabel = GUIDE_DIVISIONS.find((d) => d.value === division)?.label ?? '';

    const loadList = useCallback(async () => {
        try {
            const response = await apiClient.post('', { request: 'guide_list' });
            setArticles(response.data?.articles ?? []);
            setSections(response.data?.sections ?? []);
            setCanEdit(response.data?.canEdit === true);
        } catch (e) {
            console.error('guide_list failed:', e);
            setMessage('記事の一覧を読み込めませんでした。ウインドウを開き直してください。');
        } finally {
            setListLoaded(true);
        }
    }, []);

    useEffect(() => { if (allowed) loadList(); }, [allowed, loadList]);

    const titleToId = useMemo(() => new Map(articles.map((a) => [a.title, a.id])), [articles]);

    /** タイトルで開く（⚠️ 無い記事は、編集できる人なら新規作成） */
    const openByTitle = useCallback((title: string) => {
        const found = titleToId.get(title);
        if (found !== undefined) {
            navigate(`/guide?id=${found}`);
            return;
        }
        if (canEdit) {
            setDraft(emptyDraft(sections[0] ?? '用語', division, title));
            return;
        }
        setArticle(null);
        setMessage(`「${title}」の記事はまだありません。`);
    }, [titleToId, canEdit, sections, division, navigate]);

    // ⚠️ `?title=` で開かれたとき（GuideLink）。⚠️ 一覧を読み終えてから探す
    useEffect(() => {
        if (!listLoaded || titleParam === '') return;
        openByTitle(titleParam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listLoaded, titleParam]);

    // 記事を読む
    useEffect(() => {
        if (!allowed || idParam === undefined) { setArticle(null); return; }
        let cancelled = false;
        setMessage('');
        setDraft(null);
        (async () => {
            try {
                const response = await apiClient.post('', { request: 'guide_article', id: Number(idParam) });
                if (cancelled) return;
                const loaded: Article | null = response.data?.article ?? null;
                setArticle(loaded);
                // ⚠️ 別の事業の記事へリンクで移ったら、切り替えもその事業へ（⚠️ 共通の記事では動かさない）
                if (loaded && loaded.division !== GUIDE_COMMON && allowedDivisions.includes(loaded.division)) setDivision(loaded.division);
            } catch (e) {
                if (cancelled) return;
                console.error('guide_article failed:', e);
                setArticle(null);
                setMessage('記事が見つかりませんでした。左の目次から選び直してください。');
            }
        })();
        return () => { cancelled = true; };
    }, [allowed, idParam, allowedDivisions]);

    useEffect(() => {
        document.title = article ? `業務ガイド｜${article.title}` : '業務ガイド';
    }, [article]);

    const filtered = useMemo(() => {
        const k = keyword.trim().toLowerCase();
        return articles
            .filter((a) => a.division === division || a.division === GUIDE_COMMON)
            .filter((a) => k === '' || `${a.title} ${a.summary}`.toLowerCase().includes(k));
    }, [articles, keyword, division]);
    const bySection = useMemo(
        () => sections.map((s) => ({ section: s, items: filtered.filter((a) => a.section === s) })).filter((g) => g.items.length > 0),
        [sections, filtered]
    );
    const headings = useMemo(() => (article ? headingsOf(article.body) : []), [article]);
    const editorDivisions = useMemo(
        () => [...GUIDE_DIVISIONS.filter((d) => allowedDivisions.includes(d.value)).map(({ value, label }) => ({ value, label })), { value: GUIDE_COMMON, label: '全事業共通' }],
        [allowedDivisions]
    );

    const goHome = () => { setDraft(null); setArticle(null); setNavOpen(false); navigate('/guide'); };
    const goArticle = (id: number) => { setNavOpen(false); setDraft(null); navigate(`/guide?id=${id}`); };
    const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const onSaved = async (id: number) => {
        setDraft(null);
        await loadList();
        if (String(id) === idParam) {
            const response = await apiClient.post('', { request: 'guide_article', id });
            setArticle(response.data?.article ?? null);
        } else {
            navigate(`/guide?id=${id}`);
        }
    };

    if (!allowed) {
        return (
            <div className="gd_root"><style>{CSS}</style>
                <div className="gd_denied">業務ガイドは、いまは注文営業・建売営業・中古リノベの方向けです。</div>
            </div>
        );
    }

    return (
        <div className="gd_root">
            <style>{CSS}</style>
            <header className="gd_top">
                <button type="button" className="gd_menu_btn" onClick={() => setNavOpen((v) => !v)} aria-label="目次を開く" aria-expanded={navOpen}>☰</button>
                <button type="button" className="gd_brand" onClick={goHome}>業務ガイド</button>
                {/* ⚠️ 事業の切り替え。⚠️ 1つしか見られない人には札として出す（押せない） */}
                <div className="gd_divs" role="group" aria-label="事業">
                    {GUIDE_DIVISIONS.filter((d) => allowedDivisions.includes(d.value)).map((d) => (
                        <button key={d.value} type="button" aria-pressed={d.value === division}
                            className={`gd_div${d.value === division ? ' is_active' : ''}`}
                            style={{ '--gd-div': d.color } as React.CSSProperties}
                            disabled={allowedDivisions.length === 1}
                            onClick={() => { setDivision(d.value); goHome(); }}>
                            {d.label}
                        </button>
                    ))}
                </div>
                <input className="gd_search" type="search" placeholder="記事を探す（例：契約、来場）" value={keyword}
                    onChange={(e) => { setKeyword(e.target.value); setNavOpen(true); }} aria-label="記事を探す" />
                {canEdit && (
                    <button type="button" className="gd_btn is_primary gd_new" onClick={() => setDraft(emptyDraft(sections[0] ?? '用語', division))}>
                        記事を作る
                    </button>
                )}
            </header>

            <div className={`gd_body${draft ? ' is_editing' : ''}`}>
                <nav className={`gd_nav${navOpen ? ' is_open' : ''}`} aria-label="記事の目次">
                    {bySection.map((g) => (
                        <div key={g.section} className="gd_nav_group">
                            <div className="gd_nav_section">{g.section}</div>
                            {g.items.map((a) => (
                                <button key={a.id} type="button"
                                    className={`gd_nav_item${String(a.id) === idParam ? ' is_active' : ''}${a.published ? '' : ' is_hidden'}`}
                                    onClick={() => goArticle(a.id)}>
                                    {a.title}{!a.published && <span className="gd_badge">非公開</span>}
                                </button>
                            ))}
                        </div>
                    ))}
                    {listLoaded && bySection.length === 0 && <div className="gd_empty">該当する記事がありません。</div>}
                </nav>

                <main className="gd_main">
                    {draft ? (
                        <GuideEditor key={`${draft.id ?? 'new'}-${draft.title}`} draft={draft} sections={sections} divisions={editorDivisions}
                            titleToId={titleToId} onSaved={onSaved} onCancel={() => setDraft(null)} />
                    ) : article ? (
                        <article className="gd_article">
                            <div className="gd_meta">
                                <span className="gd_tag">{article.section}</span>
                                {article.division === GUIDE_COMMON && <span className="gd_tag is_common">全事業共通</span>}
                                {!article.published && <span className="gd_badge">非公開</span>}
                                <span className="gd_updated">更新 {article.updated_at}{article.updated_by ? `（${article.updated_by}）` : ''}</span>
                                {canEdit && (
                                    <button type="button" className="gd_btn gd_edit" onClick={() => setDraft({
                                        id: article.id, title: article.title, division: article.division, section: article.section,
                                        summary: article.summary, body: article.body, sort: article.sort, published: article.published === 1,
                                    })}>直す</button>
                                )}
                            </div>
                            <h1 className="gd_h1">{article.title}</h1>
                            {article.summary && <p className="gd_lead">{article.summary}</p>}
                            <GuideMarkdown body={article.body} titleToId={titleToId} onOpen={openByTitle} />
                        </article>
                    ) : (
                        <div className="gd_home">
                            {message !== '' && <div className="gd_error" role="status">{message}</div>}
                            <h1 className="gd_h1">業務ガイド（{divisionLabel}）</h1>
                            <p className="gd_lead">ダッシュボードの使い方と、{divisionLabel}の業務の流れをまとめています。作業中の画面と並べて読めるよう、別のウインドウで開いています。</p>
                            <div className="gd_cards">
                                {bySection.map((g) => (
                                    <section key={g.section} className="gd_card">
                                        <h2 className="gd_card_title">{g.section}</h2>
                                        <ul>
                                            {g.items.map((a) => (
                                                <li key={a.id}>
                                                    <button type="button" className="gd_card_link" onClick={() => goArticle(a.id)}>{a.title}</button>
                                                    {a.summary && <div className="gd_card_sub">{a.summary}</div>}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                ))}
                            </div>
                        </div>
                    )}
                </main>

                {!draft && article && headings.length > 0 && (
                    <aside className="gd_toc" aria-label="この記事の見出し">
                        <div className="gd_toc_title">この記事の見出し</div>
                        {headings.map((h) => (
                            <button key={h.id} type="button" className={`gd_toc_item is_h${h.level}`} onClick={() => jump(h.id)}>{h.text}</button>
                        ))}
                    </aside>
                )}
            </div>
        </div>
    );
};

/**
 * ⚠️ GoogleReview.tsx に合わせた配色・角丸・文字の大きさ（接頭辞 gd_）。
 * ⚠️ 本文は読み物なので、表の画面より文字を大きく、行間を広く、1行を約40字までに抑える。
 */
const CSS = `
.gd_root { position: fixed; inset: 0; display: flex; flex-direction: column; background: #fff; color: #1f2937;
           font-size: 13px; z-index: 1; }
.gd_top { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 10px 20px;
          border-bottom: 1px solid #e5e7eb; background: #f8fafc; }
.gd_menu_btn { display: none; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 4px 10px; cursor: pointer; }
.gd_brand { border: none; background: none; padding: 0; cursor: pointer; font-weight: 700; font-size: 15px;
            letter-spacing: .02em; color: #0f766e; white-space: nowrap; }
.gd_divs { display: flex; gap: 4px; flex-shrink: 0; }
.gd_div { border: 1px solid #e5e7eb; background: #fff; color: #4b5563; border-radius: 999px; padding: 2px 10px;
          font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.gd_div:hover:not(:disabled) { border-color: var(--gd-div); color: var(--gd-div); }
.gd_div.is_active { background: var(--gd-div); border-color: var(--gd-div); color: #fff; }
.gd_div:disabled { cursor: default; }
.gd_search { flex: 1 1 auto; max-width: 420px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.gd_search:focus, .gd_input:focus, .gd_textarea:focus { outline: 2px solid #99f6e4; border-color: #14b8a6; }
.gd_new { margin-left: auto; }

.gd_body { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: 250px minmax(0, 1fr) 210px; }
.gd_body.is_editing { grid-template-columns: 250px minmax(0, 1fr); }
.gd_nav { border-right: 1px solid #e5e7eb; overflow-y: auto; padding: 14px 10px 30px; background: #fff; }
.gd_nav_group + .gd_nav_group { margin-top: 14px; }
.gd_nav_section { font-size: 11px; font-weight: 700; color: #6b7280; padding: 0 8px 4px; letter-spacing: .04em; }
.gd_nav_item { display: block; width: 100%; text-align: left; border: none; background: none; border-radius: 8px;
               padding: 6px 8px; font-size: 13px; color: #1f2937; cursor: pointer; line-height: 1.5; }
.gd_nav_item:hover { background: #f1f5f9; }
.gd_nav_item.is_active { background: #ecfdf5; color: #0f766e; font-weight: 700; }
.gd_nav_item.is_hidden { color: #9ca3af; }
.gd_nav_item:focus-visible, .gd_card_link:focus-visible, .gd_toc_item:focus-visible, .gd_ref:focus-visible, .gd_div:focus-visible { outline: 2px solid #14b8a6; }
.gd_badge { margin-left: 6px; font-size: 10px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 999px; padding: 0 6px; }
.gd_empty { color: #9ca3af; font-size: 12px; padding: 8px; }

.gd_main { overflow-y: auto; padding: 28px 40px 80px; scroll-behavior: smooth; }
.gd_article, .gd_home { max-width: 44em; margin: 0 auto; }
.gd_meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.gd_tag { font-size: 11px; font-weight: 700; color: #0f766e; background: #ecfdf5; border-radius: 999px; padding: 2px 10px; }
.gd_tag.is_common { color: #4b5563; background: #f3f4f6; }
.gd_updated { font-size: 11px; color: #9ca3af; }
.gd_edit { margin-left: auto; }
.gd_h1 { font-size: 24px; font-weight: 700; line-height: 1.4; margin: 4px 0 8px; letter-spacing: .01em; }
.gd_lead { font-size: 14px; color: #4b5563; line-height: 1.8; margin: 0 0 20px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }

/* ⚠️ 本文。⚠️ 読み物なので 15px・行間 1.95 */
.gd_md { font-size: 15px; line-height: 1.95; }
.gd_md h2 { font-size: 19px; font-weight: 700; margin: 36px 0 10px; padding-top: 14px; border-top: 1px solid #e5e7eb; scroll-margin-top: 12px; }
.gd_md h3 { font-size: 16px; font-weight: 700; margin: 26px 0 8px; padding-left: 10px; border-left: 4px solid #14b8a6; scroll-margin-top: 12px; }
.gd_md p { margin: 0 0 14px; }
.gd_md ul, .gd_md ol { margin: 0 0 16px; padding-left: 1.5em; }
.gd_md li { margin: 4px 0; }
.gd_md ol > li::marker { font-weight: 700; color: #0f766e; }
.gd_md strong { background: linear-gradient(transparent 62%, #fef08a 62%); }
.gd_md code { font-size: 13px; background: #f3f4f6; border-radius: 4px; padding: 1px 6px; }
.gd_md hr { border: none; border-top: 1px dashed #e5e7eb; margin: 24px 0; }
.gd_md a { color: #2563eb; }
.gd_ref { border: none; background: none; padding: 0; font: inherit; color: #0f766e; font-weight: 700; cursor: pointer;
          text-decoration: underline; text-decoration-color: #99f6e4; text-decoration-thickness: 2px; text-underline-offset: 3px; }
.gd_ref:hover { text-decoration-color: #0f766e; }
.gd_ref.is_missing { color: #dc2626; text-decoration-color: #fecaca; }
.gd_callout { margin: 0 0 16px; padding: 10px 14px; border-radius: 10px; border: 1px solid; font-size: 14px; line-height: 1.85; }
.gd_callout p:last-child { margin-bottom: 0; }
.gd_callout.is_tip { background: #f0fdfa; border-color: #99f6e4; }
.gd_callout.is_warn { background: #fffbeb; border-color: #fde68a; color: #78350f; }
.gd_callout.is_check { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }

.gd_toc { border-left: 1px solid #e5e7eb; overflow-y: auto; padding: 28px 14px; }
.gd_toc_title { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 6px; }
.gd_toc_item { display: block; width: 100%; text-align: left; border: none; background: none; cursor: pointer;
               font-size: 12px; color: #4b5563; padding: 4px 6px; border-radius: 6px; line-height: 1.5; }
.gd_toc_item:hover { background: #f1f5f9; color: #0f766e; }
.gd_toc_item.is_h3 { padding-left: 18px; font-size: 11.5px; color: #6b7280; }

.gd_cards { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.gd_card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; background: #fff; }
.gd_card_title { font-size: 14px; font-weight: 700; color: #0f766e; margin: 0 0 8px; }
.gd_card ul { list-style: none; margin: 0; padding: 0; }
.gd_card li { padding: 6px 0; border-top: 1px solid #f1f5f9; }
.gd_card li:first-child { border-top: none; }
.gd_card_link { border: none; background: none; padding: 0; font-size: 14px; font-weight: 700; color: #1f2937; cursor: pointer; text-align: left; }
.gd_card_link:hover { color: #0f766e; text-decoration: underline; }
.gd_card_sub { font-size: 12px; color: #6b7280; line-height: 1.6; }

.gd_btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; color: #374151; white-space: nowrap; }
.gd_btn:hover { background: #f8fafc; }
.gd_btn.is_primary { background: #0f766e; border-color: #0f766e; color: #fff; }
.gd_btn.is_primary:hover { background: #115e59; }
.gd_btn:disabled { opacity: .6; cursor: default; }
.gd_error { font-size: 12px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
.gd_denied { margin: 80px auto; max-width: 30em; text-align: center; color: #4b5563; font-size: 14px; }

.gd_editor { max-width: 1200px; margin: 0 auto; }
.gd_editor_head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.gd_editor_title { font-weight: 700; font-size: 15px; }
.gd_editor_actions { margin-left: auto; display: flex; gap: 8px; }
.gd_form { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; background: #f8fafc; border: 1px solid #e5e7eb;
           border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
.gd_field { display: flex; flex-direction: column; gap: 2px; }
.gd_field.is_wide { flex: 1 1 260px; }
.gd_field.is_narrow { width: 80px; }
.gd_field.is_full { flex: 1 1 100%; }
.gd_check { flex-direction: row; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding-bottom: 6px; }
.gd_label { font-size: 11px; font-weight: 700; color: #6b7280; }
.gd_input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; font-size: 13px; background: #fff; }
.gd_split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
.gd_split_col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.gd_textarea { min-height: 60vh; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; font-size: 13px; line-height: 1.8;
               font-family: ui-monospace, Consolas, 'BIZ UDGothic', monospace; resize: vertical; }
.gd_preview { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; min-height: 60vh; overflow: auto; }
.gd_syntax { font-size: 12px; color: #4b5563; margin-top: 6px; }
.gd_syntax summary { cursor: pointer; font-weight: 700; }
.gd_syntax dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 8px 0; }
.gd_syntax dd { margin: 0; }

/* ⚠️ 窓が狭いとき: 右の見出しを消す → さらに狭いと左の目次を開閉式にする */
@media (max-width: 1100px) {
  .gd_body { grid-template-columns: 230px minmax(0, 1fr); }
  .gd_toc { display: none; }
}
@media (max-width: 760px) {
  .gd_menu_btn { display: inline-block; }
  .gd_top { flex-wrap: wrap; }
  .gd_body, .gd_body.is_editing { grid-template-columns: minmax(0, 1fr); position: relative; }
  .gd_nav { display: none; position: absolute; inset: 0 30% 0 0; z-index: 3; box-shadow: 4px 0 16px rgba(15, 23, 42, .12); }
  .gd_nav.is_open { display: block; }
  .gd_main { padding: 20px 18px 60px; }
  .gd_split { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .gd_main { scroll-behavior: auto; } }
`;

export default Guide;
```

### frontend/src/components/guide/GuideMarkdown.tsx
```tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * 業務ガイドの本文（Markdown）を表示する（v2.2.194）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 独自の書き方（編集画面の「書き方」と同じ）:
 *   `[[タイトル]]`        … 別の記事へのリンク。⚠️ 記事があれば緑、まだ無ければ赤（編集できる人が押すと新規作成）
 *   `> 注意：…`          … 黄色の注意枠
 *   `> 要確認：…`        … 赤い枠（⚠️ 社内ルールなど、現場で確かめてほしいこと）
 *   `> …`（上以外）       … 緑のポイント枠
 *   `## 見出し` `### 小見出し` … 右の目次に出る
 *
 * ⚠️⚠️ **表（| a | b |）は使えない。** ⚠️ 表の書き方（GFM）の部品を入れていないため。
 *   ⚠️ 箇条書きか見出しで書く（編集画面の「書き方」にも書いてある）。
 *
 * ⚠️ リンクは `#guide:<タイトル>` に置き換えてから渡す。
 *   ⚠️ `guide:` のような独自の先頭にすると react-markdown が安全のため URL を消す（⚠️ `#` で始めれば相対 URL 扱いで残る）。
 * ─────────────────────────────────────────────
 */

const LINK_PREFIX = '#guide:';
const STRONG_HREF = '#guide-strong';

/**
 * コードの外側だけに置き換えをかける。
 * ⚠️ `` ` ``で囲んだところと ``` のブロックの中は書き方の例なので、そのまま出す（⚠️ 「書き方」の記事の `[[ ]]` がリンクにならないように）。
 */
const outsideCode = (body: string, replace: (text: string) => string): string => {
    let inFence = false;
    return body.split('\n').map((line) => {
        if (/^```/.test(line.trim())) { inFence = !inFence; return line; }
        if (inFence) return line;
        return line.split(/(`[^`]*`)/).map((part, i) => (i % 2 === 1 ? part : replace(part))).join('');
    }).join('\n');
};

/** `[[タイトル]]` → `[タイトル](#guide:…)`。⚠️ 丸括弧はリンクの区切りと紛れるので符号化する */
const expandLinks = (body: string): string =>
    outsideCode(body, (text) => text.replace(/\[\[([^[\]\n]+)\]\]/g, (_, title: string) => {
        const target = encodeURIComponent(title.trim()).replace(/\(/g, '%28').replace(/\)/g, '%29');
        return `[${title.trim()}](${LINK_PREFIX}${target})`;
    }));

/**
 * `**太字**` → `[太字](#guide-strong)`（表示は <strong>）。
 *
 * ⚠️⚠️ **Markdown の規則では、日本語の太字が閉じないことがある。**
 *   ⚠️ 例: `**「契約済み」**のお客様` … 閉じる `**` の前が「」」、後ろが「の」なので太字の終わりと認められず、
 *     ⚠️ `**` がそのまま文字で出る（2026-10-16 に画面で確認）。⚠️ 現場の人が書く記事では避けようがない。
 *   ⚠️ リンクの形には前後の文字の決まりが無いので、太字をリンクの形に置き換えてから渡す。
 * ⚠️ `[` `]` や `` ` `` を含む太字は置き換えない（⚠️ リンクの中にリンクは作れないため。従来の書き方のまま）。
 * ⚠️ コードの中は置き換えない（outsideCode）。
 */
const expandStrong = (body: string): string =>
    outsideCode(body, (text) => text.replace(/\*\*([^*\n`[\]]+?)\*\*/g, `[$1](${STRONG_HREF})`));

const expandGuideLinks = (body: string): string => expandLinks(expandStrong(body));

/** 見出しの id。⚠️ 目次（headingsOf）と本文（h2/h3）で同じ文字列から作ること */
const headingId = (text: string): string => `h-${encodeURIComponent(text.trim()).replace(/%/g, '')}`;

/** Markdown の飾りを落とした見出しの文字 */
const plainHeading = (line: string): string =>
    line.replace(/\[\[([^[\]\n]+)\]\]/g, '$1').replace(/[*_`]/g, '').trim();

/** 目次。⚠️ コードブロックの中の `#` は見出しにしない */
export const headingsOf = (body: string): { level: 2 | 3; text: string; id: string }[] => {
    const result: { level: 2 | 3; text: string; id: string }[] = [];
    let inCode = false;
    for (const line of body.split('\n')) {
        if (/^```/.test(line.trim())) { inCode = !inCode; continue; }
        if (inCode) continue;
        const m = /^(##|###)\s+(.+)$/.exec(line);
        if (m === null) continue;
        const text = plainHeading(m[2]);
        result.push({ level: m[1] === '##' ? 2 : 3, text, id: headingId(text) });
    }
    return result;
};

/** React の子要素から文字だけを取り出す */
const textOf = (node: React.ReactNode): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
    return '';
};

const calloutKind = (text: string): 'warn' | 'check' | 'tip' => {
    const head = text.trim();
    if (/^注意/.test(head)) return 'warn';
    if (/^要確認/.test(head)) return 'check';
    return 'tip';
};

interface Props {
    body: string;
    /** 記事のタイトル → id（⚠️ 公開・非公開を問わず。リンクの色分けに使う） */
    titleToId: Map<string, number>;
    /** 記事へのリンクを押したとき */
    onOpen: (title: string) => void;
}

const GuideMarkdown: React.FC<Props> = ({ body, titleToId, onOpen }) => (
    <div className="gd_md">
        <ReactMarkdown
            components={{
                a: ({ href, children }) => {
                    if (href === STRONG_HREF) return <strong>{children}</strong>;
                    if (href !== undefined && href.startsWith(LINK_PREFIX)) {
                        const title = decodeURIComponent(href.slice(LINK_PREFIX.length));
                        const exists = titleToId.has(title);
                        return (
                            <button
                                type="button"
                                className={`gd_ref${exists ? '' : ' is_missing'}`}
                                onClick={() => onOpen(title)}
                                title={exists ? `「${title}」を開く` : `「${title}」はまだ書かれていません`}
                            >
                                {children}
                            </button>
                        );
                    }
                    // ⚠️ 外部リンクは別タブ（⚠️ ガイドのウインドウを離れない）
                    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                },
                h2: ({ children }) => <h2 id={headingId(textOf(children))}>{children}</h2>,
                h3: ({ children }) => <h3 id={headingId(textOf(children))}>{children}</h3>,
                blockquote: ({ children }) => (
                    <blockquote className={`gd_callout is_${calloutKind(textOf(children))}`}>{children}</blockquote>
                ),
            }}
        >
            {expandGuideLinks(body)}
        </ReactMarkdown>
    </div>
);

export default GuideMarkdown;
```

### frontend/src/components/guide/GuideEditor.tsx
```tsx
import React, { useState } from 'react';
import apiClient from '../../utils/apiClient';
import GuideMarkdown from './GuideMarkdown';

/**
 * 業務ガイドの記事を作る・直す画面（v2.2.194）。⚠️ Master / BrandAdmin だけに出す（Guide.tsx）。
 *
 * ⚠️ 権限の最終判定は ②（features/guide.ts の saveGuide）が行う。⚠️ ここで隠すのは見た目のためだけ。
 * ⚠️ 保存すると、直前の内容が変更履歴に残る（② 側）。
 */

export interface GuideDraft {
    id: number | null;
    title: string;
    /** 事業（order / spec / used / common） */
    division: string;
    section: string;
    summary: string;
    body: string;
    sort: number;
    published: boolean;
}

interface Props {
    draft: GuideDraft;
    sections: readonly string[];
    /** 選べる事業（⚠️ 見られる事業＋全事業共通） */
    divisions: { value: string; label: string }[];
    titleToId: Map<string, number>;
    onSaved: (id: number) => void;
    onCancel: () => void;
}

const SYNTAX_HELP: [string, string][] = [
    ['## 見出し', '大きな見出し（右の目次に出る）'],
    ['### 小見出し', '小さな見出し（目次に出る）'],
    ['[[記事のタイトル]]', '別の記事へのリンク。まだ無い記事は赤になる'],
    ['> 注意：〜', '黄色の注意枠'],
    ['> 要確認：〜', '赤い枠（現場で確かめてほしいこと）'],
    ['> 〜', '緑のポイント枠'],
    ['1. 〜', '番号付きの手順'],
    ['- 〜', '箇条書き'],
    ['**太字**', '強調'],
];

const GuideEditor: React.FC<Props> = ({ draft: initial, sections, divisions, titleToId, onSaved, onCancel }) => {
    const [draft, setDraft] = useState<GuideDraft>(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = <K extends keyof GuideDraft>(key: K, value: GuideDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const response = await apiClient.post('', {
                request: 'guide_save',
                id: draft.id,
                title: draft.title,
                division: draft.division,
                section: draft.section,
                summary: draft.summary,
                body: draft.body,
                sort: draft.sort,
                published: draft.published ? 1 : 0,
            });
            if (response.data?.status !== 'ok') {
                setError(response.data?.message ?? '保存できませんでした。');
                return;
            }
            onSaved(Number(response.data.id));
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '保存できませんでした。通信状態を確かめて、もう一度押してください。');
            console.error('guide_save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="gd_editor">
            <div className="gd_editor_head">
                <div className="gd_editor_title">{draft.id === null ? '記事を作る' : '記事を直す'}</div>
                <div className="gd_editor_actions">
                    <button type="button" className="gd_btn" onClick={onCancel} disabled={saving}>やめる</button>
                    <button type="button" className="gd_btn is_primary" onClick={save} disabled={saving}>
                        {saving ? '保存中…' : '保存する'}
                    </button>
                </div>
            </div>
            {error !== '' && <div className="gd_error" role="alert">{error}</div>}

            <div className="gd_form">
                <label className="gd_field is_wide">
                    <span className="gd_label">タイトル</span>
                    <input className="gd_input" value={draft.title} maxLength={191}
                        onChange={(e) => set('title', e.target.value)} placeholder="例：契約したら（注文営業）" />
                </label>
                <label className="gd_field">
                    <span className="gd_label">事業</span>
                    <select className="gd_input" value={draft.division} onChange={(e) => set('division', e.target.value)}>
                        {/* ⚠️ 見られない事業の記事を直すときも、今の値を消さない */}
                        {[...divisions, ...(divisions.some((d) => d.value === draft.division) ? [] : [{ value: draft.division, label: draft.division }])]
                            .map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                </label>
                <label className="gd_field">
                    <span className="gd_label">分類</span>
                    <select className="gd_input" value={draft.section} onChange={(e) => set('section', e.target.value)}>
                        {sections.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
                <label className="gd_field is_narrow">
                    <span className="gd_label">並び順</span>
                    <input className="gd_input" type="number" value={draft.sort}
                        onChange={(e) => set('sort', Number(e.target.value) || 0)} />
                </label>
                <label className="gd_field gd_check">
                    <input type="checkbox" checked={draft.published} onChange={(e) => set('published', e.target.checked)} />
                    <span>公開する</span>
                </label>
                <label className="gd_field is_full">
                    <span className="gd_label">1行の説明（一覧に出ます）</span>
                    <input className="gd_input" value={draft.summary} maxLength={255}
                        onChange={(e) => set('summary', e.target.value)} />
                </label>
            </div>

            <div className="gd_split">
                <div className="gd_split_col">
                    <div className="gd_label">本文</div>
                    <textarea className="gd_textarea" value={draft.body} onChange={(e) => set('body', e.target.value)} spellCheck={false} />
                    <details className="gd_syntax">
                        <summary>書き方</summary>
                        <dl>
                            {SYNTAX_HELP.map(([code, desc]) => (
                                <React.Fragment key={code}><dt><code>{code}</code></dt><dd>{desc}</dd></React.Fragment>
                            ))}
                        </dl>
                        <p>表（｜で区切る書き方）は使えません。箇条書きか見出しで書いてください。</p>
                    </details>
                </div>
                <div className="gd_split_col">
                    <div className="gd_label">プレビュー</div>
                    <div className="gd_preview">
                        <h1 className="gd_h1">{draft.title || '（タイトル）'}</h1>
                        <GuideMarkdown body={draft.body} titleToId={titleToId} onOpen={() => undefined} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuideEditor;
```

### frontend/src/components/guide/GuideLink.tsx
```tsx
import React from 'react';
import { openGuide } from './openGuide';

/**
 * 画面の中に置く「業務ガイドへのリンク」（v2.2.194）。
 *
 * 例: `<GuideLink title="契約したら（注文営業）" />`
 *     `<GuideLink title="来場">来場とは</GuideLink>`
 *
 * ⚠️ 押すと業務ガイドの別ウインドウでその記事が開く（⚠️ 作業中の画面はそのまま）。
 * ⚠️ title は記事のタイトルと**完全に一致**させること（⚠️ 一致しなければガイドの一覧が開く）。
 */
const GuideLink: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
    <button
        type="button"
        onClick={() => openGuide(title)}
        title={`業務ガイド「${title}」を開く`}
        style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: '#0f766e', fontWeight: 700, fontSize: 'inherit',
            textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3,
        }}
    >
        {children ?? title}
    </button>
);

export default GuideLink;
```

### frontend/src/components/guide/openGuide.ts
```ts
/**
 * 業務ガイドを別ウインドウで開く（v2.2.194）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ウインドウに名前（GUIDE_WINDOW）を付けて開く。**
 *   ⚠️ 2回目以降は**同じウインドウ**の中身が切り替わる（⚠️ ボタンを押すたびに窓が増えない）。
 *
 * ⚠️ 中身は同じアプリの `/guide`（App.tsx でヘッダー・メニュー・アクティブユーザーを出さない）。
 *   ⚠️ 同じドメインなのでログイン状態（localStorage の token）はそのまま使える。
 *
 * ⚠️ スマホ（幅 768px 未満）は別ウインドウが扱いにくいので、同じタブで移動する。
 * ─────────────────────────────────────────────
 */

const GUIDE_WINDOW = 'khg-business-guide';

/**
 * 業務ガイドの対象の事業。⚠️ 色はトップ画面（Category.tsx）のボタンと同じ。
 * ⚠️ はじめは注文営業だけ → 2026-10-16 の追加指示で建売営業・中古リノベを足した。⚠️ 不動産企画係は対象外。
 */
export const GUIDE_DIVISIONS = [
    { value: 'order', label: '注文営業', color: '#0d6efd' },
    { value: 'spec', label: '建売営業', color: '#198754' },
    { value: 'used', label: '中古リノベ', color: '#d97706' },
] as const;
/** 全事業に出す記事の事業区分 */
export const GUIDE_COMMON = 'common';

/** 入口ボタンを出す事業（⚠️ 選んでいる事業＝category で判定） */
export const isGuideCategory = (category: string): boolean => GUIDE_DIVISIONS.some((d) => d.value === category);

/**
 * 見られる事業。⚠️ shopName は担当事業（order / spec / used / all）。
 * ⚠️ Master と全事業（all）の人はすべて。⚠️ 選んでいる事業（category）も足す（⚠️ 事業の権限はトップ画面が確かめている）。
 */
export const allowedGuideDivisions = (authority: string, category: string, shopName: string): string[] =>
    GUIDE_DIVISIONS.map((d) => d.value as string).filter((v) =>
        authority === 'Master' || shopName === 'all' || shopName === v || category === v);

/** ⚠️ Router の basename（App.tsx の `/dashboard`）を含めた URL */
const guideUrl = (title?: string): string =>
    `/dashboard/guide${title ? `?title=${encodeURIComponent(title)}` : ''}`;

/** 業務ガイドを開く。⚠️ title を渡すと、その記事を開く（無ければ一覧） */
export const openGuide = (title?: string): void => {
    const url = guideUrl(title);
    if (window.innerWidth < 768) {
        window.location.assign(url);
        return;
    }
    // ⚠️ 画面の右側に寄せて開く（⚠️ 作業中の画面と並べて読む前提）
    const width = Math.min(1180, Math.max(720, Math.round(window.screen.availWidth * 0.5)));
    const height = Math.max(640, window.screen.availHeight - 80);
    const left = Math.max(0, window.screen.availWidth - width);
    const opened = window.open(url, GUIDE_WINDOW, `width=${width},height=${height},left=${left},top=0`);
    // ⚠️ ポップアップを止められたら、同じタブで開く（⚠️ 何も起きないよりよい）
    if (opened === null) {
        window.location.assign(url);
        return;
    }
    opened.focus();
};
```

### backend/scripts/guide/build-guide-sql.cjs
```js
#!/usr/bin/env node
/**
 * 業務ガイドの記事（articles/<事業>/*.md）から、① に流す SQL を作る（v2.2.194）。
 *
 * ─────────────────────────────────────────────
 * 使い方（リポジトリの直下で）:
 *   node backend/scripts/guide/build-guide-sql.cjs                          … すべての記事
 *   node backend/scripts/guide/build-guide-sql.cjs order/screen-110.md ...  … 指定した記事だけ（articles/ からの道のり）
 *   ⚠️ 出力は標準出力。⚠️ その版の update_log の SQL ファイルの末尾に貼る（CLAUDE.md「業務ガイドの記事」）。
 *
 * 置き場所: articles/<事業>/<分類>-<並び順>.md
 *   ⚠️ 事業はフォルダ名で決まる（order 注文営業 / spec 建売営業 / used 中古リノベ / common 全事業共通）。
 *
 * 記事ファイルの形:
 *   ---
 *   title: 契約したら（注文営業）
 *   section: 業務の流れ        （業務の流れ / 画面の使い方 / 用語）
 *   sort: 40
 *   summary: 一覧に出す1行の説明
 *   ---
 *   本文（Markdown）
 *
 * ⚠️⚠️ **エージェントの内容を優先する**（2026-10-16 の指示）。
 *   ⚠️ 同じタイトルの記事が ① にあれば、手で直された記事でも**上書きする**。
 *   ⚠️ 上書きの直前の内容は guide_history に残す（⚠️ 画面で直した人の文章は消えない）。
 * ⚠️ タイトルは事業が違っても重複できない（⚠️ [[ ]] リンクはタイトルで探すため）。
 * ⚠️ タイトルを変えるときは、このスクリプトでは追えない（⚠️ 別の記事として作られる）。
 *   ⚠️ `UPDATE guide_article SET title = '新' WHERE title = '旧';` を先に手で書くこと。
 * ─────────────────────────────────────────────
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'articles');
const SECTIONS = ['業務の流れ', '画面の使い方', '用語'];
const DIVISIONS = ['order', 'spec', 'used', 'common'];
const MAX_BODY_BYTES = 60000; // ⚠️ ② の features/guide.ts と同じ上限
const LINK = /\[\[([^[\]\n]+)\]\]/g;

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";

const parse = (file) => {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (m === null) throw new Error(`${file}: 先頭の --- で囲んだ見出し情報がありません`);
  const meta = Object.fromEntries(m[1].split('\n').map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const body = m[2].trim() + '\n';
  const division = file.split('/')[0];
  if (!DIVISIONS.includes(division)) throw new Error(`${file}: 事業のフォルダ（${DIVISIONS.join(' / ')}）の中に置いてください`);
  if (!meta.title) throw new Error(`${file}: title がありません`);
  if (/[[\]]/.test(meta.title)) throw new Error(`${file}: title に [ ] は使えません`);
  if (!SECTIONS.includes(meta.section)) throw new Error(`${file}: section は ${SECTIONS.join(' / ')} のどれか`);
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw new Error(`${file}: 本文が長すぎます`);
  return { file, title: meta.title, section: meta.section, sort: Number(meta.sort) || 0, summary: meta.summary ?? '', division, body };
};

/** articles/ の下の .md（⚠️ `order/flow-010.md` の形） */
const listAll = () => DIVISIONS.flatMap((d) => {
  const dir = path.join(DIR, d);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => `${d}/${f}`) : [];
});

const all = listAll().map(parse);
const titleCount = new Map();
for (const a of all) titleCount.set(a.title, (titleCount.get(a.title) ?? 0) + 1);
for (const [t, n] of titleCount) if (n > 1) throw new Error(`同じタイトルの記事が ${n} 本あります: ${t}（⚠️ 事業が違っても重複できない）`);

const targets = process.argv.slice(2).length > 0
  ? process.argv.slice(2).map((f) => parse(f.split(path.sep).join('/').replace(/^.*articles\//, '')))
  : all;

// ⚠️ [[ ]] の行き先が記事ファイルに無ければ知らせる（⚠️ 画面では赤いリンクになる）
// ⚠️ コード（` ` と ``` の中）は書き方の例なので見ない（⚠️ 画面でもリンクにならない）
const withoutCode = (body) => body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
for (const a of targets) {
  for (const [, t] of withoutCode(a.body).matchAll(LINK)) {
    if (!titleCount.has(t.trim())) process.stderr.write(`⚠️ ${a.file}: [[${t.trim()}]] の記事がありません（赤いリンクになります）\n`);
  }
}

const out = [];
out.push('-- ---------------------------------------------------------------');
out.push(`-- 業務ガイドの記事（${targets.length}本）。backend/scripts/guide/build-guide-sql.cjs で作成`);
out.push('-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）');
out.push('-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す');
out.push('-- ---------------------------------------------------------------');
for (const a of targets) {
  out.push(`-- ${a.file}：${a.title}`);
  out.push(`INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = ${q(a.title)};`);
  out.push(`INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES (${q(a.title)}, ${q(a.division)}, ${q(a.section)}, ${q(a.summary)}, ${q(a.body)}, ${a.sort}, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);`);
}
process.stdout.write(out.join('\n') + '\n');
```

### backend/scripts/sql/2026-10-16_guide_article.sql
```sql
-- ===========================================================
-- 業務ガイド（guide_article / guide_history）
--
-- 2026-10-16 新規（v2.2.194）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 既存の表は変更しない（新規2表のみ）。
--
-- ─────────────────────────────────────────────
-- 何のテーブルか
--
--   ヘッダー・アクティブユーザー・トップ画面の「業務ガイド」ボタンから
--   別ウインドウで開く記事（frontend/src/components/guide/Guide.tsx）。
--   用語・画面の使い方・業務の流れを、現場の人がブラウザ上で書き換えられるよう DB に置く。
--
--   guide_article … 記事（1行 = 1記事）
--   guide_history … 保存の直前の内容（⚠️ 保存のたびに1行積む。書き間違えたときに戻すため）
-- ─────────────────────────────────────────────
--
-- ⚠️⚠️ **title は重複不可。** 本文の `[[タイトル]]` はタイトルで記事を探すため。
-- ⚠️ 記事は消さずに published = 0 で隠す（⚠️ 他の記事からのリンク先が消えないように）。
-- ⚠️ 編集できるのは authority が Master / BrandAdmin の人（② features/guide.ts で判定）。
-- ===========================================================

CREATE TABLE IF NOT EXISTS `guide_article` (
   `id`         INT          NOT NULL AUTO_INCREMENT
  ,`title`      VARCHAR(191) NOT NULL COMMENT '記事のタイトル（例: 契約したら（注文営業））。⚠️ [[ ]] リンクの照合キー'
  ,`division`   VARCHAR(16)  NOT NULL DEFAULT 'order' COMMENT '事業区分（order 注文営業 / spec 建売営業 / used 中古リノベ / common 共通）'
  ,`section`    VARCHAR(32)  NOT NULL DEFAULT '用語' COMMENT '分類（用語 / 画面の使い方 / 業務の流れ）'
  ,`summary`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '一覧に出す1行の説明'
  ,`body`       MEDIUMTEXT   NOT NULL COMMENT '本文（Markdown）。⚠️ 60,000 バイトまで（② で検査）'
  ,`sort`       INT          NOT NULL DEFAULT 0 COMMENT '分類の中の並び順（小さいほど上）'
  ,`published`  TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '1 = 出す / 0 = 隠す'
  ,`updated_by` VARCHAR(191) NOT NULL DEFAULT '' COMMENT '最後に保存した人（staff.name）'
  ,`created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,`updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ,PRIMARY KEY (`id`)
  ,UNIQUE KEY `uk_guide_article_title` (`title`)
  ,KEY `idx_guide_article_list` (`division`, `published`, `section`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='業務ガイドの記事（v2.2.194）';

CREATE TABLE IF NOT EXISTS `guide_history` (
   `no`         INT          NOT NULL AUTO_INCREMENT
  ,`article_id` INT          NOT NULL COMMENT 'guide_article.id'
  ,`title`      VARCHAR(191) NOT NULL
  ,`section`    VARCHAR(32)  NOT NULL
  ,`summary`    VARCHAR(255) NOT NULL DEFAULT ''
  ,`body`       MEDIUMTEXT   NOT NULL
  ,`published`  TINYINT(1)   NOT NULL DEFAULT 1
  ,`edited_by`  VARCHAR(191) NOT NULL DEFAULT '' COMMENT 'この内容を保存した人（＝上書きされる前の版を書いた人）'
  ,`edited_at`  DATETIME     NOT NULL COMMENT 'この内容が保存された日時（guide_article.updated_at の写し）'
  ,`saved_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '履歴に積んだ日時（＝上書きされた日時）'
  ,PRIMARY KEY (`no`)
  ,KEY `idx_guide_history_article` (`article_id`, `no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='業務ガイドの変更履歴（保存の直前の内容）';
```

## 直したファイル（差分）

### backend-express/src/gateway/registry.ts
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 4316b5bf..2cada8e7 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -11,6 +11,7 @@ import { runAmbassadorKpi } from '../features/ambassador/kpi';
 import { runStaffContract, toDepartment } from '../features/staffContract';
 import { runIntroductorySummary } from '../features/introductory/summary';
 import { runDuplicateSummary } from '../features/duplicateSummary';
+import { getGuide, listGuide, saveGuide } from '../features/guide';
 import {
   runAuthAccessTimes,
   runAuthInsert,
@@ -746,6 +747,50 @@ register({
   },
 });
 
+/**
+ * 業務ガイド（v2.2.194）。⚠️ 中身は features/guide.ts。
+ *
+ * ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ express_proxy.php の転送リストと転送専用リストの両方に入れてある。
+ * ⚠️⚠️ **guide_save は `auth: 'staff'` で受け、編集権限（Master / BrandAdmin）は saveGuide の中で見る。**
+ *   ⚠️ `auth: 'master'` にすると BrandAdmin が保存できなくなる。
+ */
+register({
+  request: 'guide_list',
+  summary: '業務ガイドの記事一覧（本文なし）と、編集できるか',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await listGuide(ctx.staff);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
+register({
+  request: 'guide_article',
+  summary: '業務ガイドの記事1本',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await getGuide(ctx.staff, ctx.body.id);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
+register({
+  request: 'guide_save',
+  summary: '【書き込み】業務ガイドの記事を作る・直す（Master / BrandAdmin のみ。直前の内容を履歴に残す）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const { id, title, division, section, summary, body, sort, published } = ctx.body;
+    const result = await saveGuide(ctx.staff, { id, title, division, section, summary, body, sort, published });
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 register({
   request: 'introductory_summary',
   summary: '紹介（注文・建売・中古）の紹介元・事業部・ブランド・エリア別の歩留まり',
```

### backend/src/core/express_proxy.php
```diff
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 379dd08c..64861313 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -648,6 +648,17 @@ function expressProxyRequests(): array
         //   ⚠️ ⚠️ **入れないと ① が404を返す。** ⚠️ expressProxyExclusive() にも入れてある。
         // -----------------------------------------------------------------
         'duplicate_summary',
+
+        // -----------------------------------------------------------------
+        // 2026-10-16 新規（v2.2.194）。業務ガイド（guide/Guide.tsx。別ウインドウの `/guide`）。
+        //
+        // ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある**（features/guide.ts）。
+        //   ⚠️ ⚠️ **入れないと ① が404を返す。** ⚠️ expressProxyExclusive() にも入れてある。
+        //   ⚠️ guide_save は書き込み。⚠️ 編集できる人（Master / BrandAdmin）の判定は ② が行う。
+        // -----------------------------------------------------------------
+        'guide_list',
+        'guide_article',
+        'guide_save',
     ];
 }
 
@@ -879,6 +890,10 @@ function expressProxyExclusive(): array
         'introductory_summary',
         // ⚠️ 2026-10-16 新規（v2.2.193）。重複反響サマリー。⚠️ 理由は上と同じ
         'duplicate_summary',
+        // ⚠️ 2026-10-16 新規（v2.2.194）。業務ガイド。⚠️ 理由は上と同じ
+        'guide_list',
+        'guide_article',
+        'guide_save',
     ];
 }
 
```

### frontend/src/App.tsx
```diff
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index 272bb292..539919d9 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -39,6 +39,7 @@ import LeadSell from "./components/lead/LeadSell";
 import LeadOpportunity from "./components/lead/LeadOpportunity";
 import LeadResale from "./components/lead/LeadResale";
 import Summary from "./components/summary/Summary";
+import Guide from "./components/guide/Guide";
 
 const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ['marker'];
 
@@ -77,6 +78,19 @@ function AppInner() {
     setOpen(true);
   }, []);
 
+  /**
+   * ⚠️⚠️ **業務ガイド（v2.2.194）は別ウインドウで開く専用の画面。**
+   *   ⚠️ ヘッダー・メニュー・アクティブユーザー・要確認を出さない（⚠️ 出すとガイドの窓にも二重に出る）。
+   *   ⚠️ ログイン確認（AuthProvider）はほかの画面と同じく効く。
+   */
+  //   ⚠️ 記事は `/guide?id=12`（⚠️ `/guide/12` にすると再読み込みで真っ白になる。Guide.tsx の説明）。
+  if (currentPath === '/guide') {
+    return (
+      <Routes>
+        <Route path="/guide" element={<Guide />} />
+      </Routes>
+    );
+  }
 
 
   return (
```

### frontend/src/components/ActiveUser.tsx
```diff
diff --git a/frontend/src/components/ActiveUser.tsx b/frontend/src/components/ActiveUser.tsx
index 9dfb9ee5..3e6a17c9 100644
--- a/frontend/src/components/ActiveUser.tsx
+++ b/frontend/src/components/ActiveUser.tsx
@@ -3,6 +3,7 @@ import AuthContext from '../context/AuthContext';
 import { useLocation } from "react-router-dom";
 import apiClient from '../utils/apiClient';
 import { openDailyAction, DAILY_CATEGORIES, NO_DAILY_ACTION } from './DailyAction';
+import { isGuideCategory, openGuide } from './guide/openGuide';
 
 type User = { id?: string | number, name: string, heartbeat: string };
 
@@ -26,6 +27,16 @@ const alertButtonStyle: React.CSSProperties = {
     whiteSpace: 'nowrap',
 };
 
+/**
+ * 「業務ガイド」ボタンの見た目（v2.2.194）。⚠️ 要確認ボタンと同じ形で、色だけ変える（⚠️ 赤＝要対応と紛れないように緑）。
+ */
+const guideButtonStyle: React.CSSProperties = {
+    ...alertButtonStyle,
+    background: '#f0fdfa',
+    border: '1px solid #99f6e4',
+    color: '#0f766e',
+};
+
 /**
  * パネルを右端に隠しているか（v2.2.193）。⚠️⚠️ **ページを移っても・再読み込みしても保つ**（2026-10-16 の指示）。
  *   ⚠️ localStorage はブラウザの設定で使えないことがあるので、⚠️ 読み書きは必ず try で包む（使えなければ表示のまま）。
@@ -332,6 +343,15 @@ const ActiveUser: React.FC = () => {
                             要確認
                         </button>
                     )}
+                    {/*
+                      ⚠️ v2.2.194: 「業務ガイド」（⚠️ 要確認の下・指示）。⚠️ 押すと別ウインドウで開く（guide/openGuide.ts）。
+                        ⚠️ 注文営業・建売営業・中古リノベ（指示）。⚠️ 要確認が出ない画面（トップなど）でも出す。
+                    */}
+                    {isGuideCategory(category) && (
+                        <button type="button" style={guideButtonStyle} onClick={() => openGuide()} aria-label="業務ガイドを別ウインドウで開く">
+                            業務ガイド
+                        </button>
+                    )}
                     <div style={headerStyle}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                             <span style={{ color: '#0d6efd' }}>●</span>
```

### frontend/src/components/header/Header.tsx
```diff
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 4ce5a4ee..ae820f9c 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -34,6 +34,7 @@ import GoogleReview from './GoogleReview';
 import UploadLoan from './UploadLoan';
 import RankingLoader from '../company/RankingLoader';
 import { openDailyAction } from '../DailyAction';
+import { isGuideCategory, openGuide } from '../guide/openGuide';
 import { useNavigate } from "react-router-dom";
 
 // 型安全のための定義
@@ -372,6 +373,18 @@ const Header = ({ }) => {
                 >
                     マーケット情報
                 </div>
+                {/* ⚠️ v2.2.194: 業務ガイド（⚠️ マーケット情報の右・指示）。⚠️ 別ウインドウで開く。⚠️ 注文営業・建売営業・中古リノベ */}
+                {isGuideCategory(category) && (
+                    <div className='rounded-pill text-white me-1 shadow-sm'
+                        role="button" tabIndex={0}
+                        style={{ padding: '2px 10px', fontSize: '10px', cursor: 'pointer', background: '#0f766e' }}
+                        onClick={() => openGuide()}
+                        onKeyDown={(e) => { if (e.key === 'Enter') openGuide(); }}
+                        title="業務ガイドを別ウインドウで開く"
+                    >
+                        業務ガイド
+                    </div>
+                )}
                 {menuArray.map((menu) => (
                     <Dropdown key={menu} className="me-1">
                         <Dropdown.Toggle
```

### frontend/src/components/Category.tsx
```diff
diff --git a/frontend/src/components/Category.tsx b/frontend/src/components/Category.tsx
index 1dd3b077..97f804f3 100644
--- a/frontend/src/components/Category.tsx
+++ b/frontend/src/components/Category.tsx
@@ -6,6 +6,7 @@ import apiClient from '../utils/apiClient';
 import Table from "react-bootstrap/Table";
 import { useIsSp } from '../utils/isSp';
 import { markCategoryChosen } from './DailyAction';
+import { openGuide } from './guide/openGuide';
 
 type Log = { no: number, version: string, date: string, note: string };
 
@@ -71,6 +72,19 @@ const Category = () => {
                     <div className="bg-warning text-center text-white py-2 py-md-3  px-4 px-md-5 rounded-pill pointer my-2" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                         onClick={() => goToDashboard('used')}>中古リノベ</div>
                 </div>
+                {/*
+                  ⚠️ v2.2.194: 業務ガイド（⚠️ 4つのボタンの下・指示）。⚠️ 別ウインドウで開く（guide/openGuide.ts）。
+                    ⚠️ この画面ではまだ事業を選んでいないので、⚠️ **担当事業（shopValue）が注文営業・建売営業・中古リノベ・全事業の人にだけ**出す。
+                */}
+                {['order', 'spec', 'used', 'all'].includes(shopValue) && (
+                    <div className="text-center mt-2">
+                        <button type="button" onClick={() => openGuide()}
+                            style={{ background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', borderRadius: 999,
+                                padding: isSp ? '4px 16px' : '6px 24px', fontSize: isSp ? 11 : 13, fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' }}>
+                            業務ガイド
+                        </button>
+                    </div>
+                )}
                 <div style={{ width: '90%', maxWidth: '568px', margin: '30px auto 0', height: '180px', overflowY: 'scroll' }}>
                     <Table striped>
                         <tbody style={{ fontSize: '10px' }}>
```

### frontend/src/utils/version.ts
```diff
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 17754a95..1d7dd3b5 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.193';
+export const newVersion = '2.2.194';
```

### CLAUDE.md
```diff
diff --git a/CLAUDE.md b/CLAUDE.md
index e8a065b1..cebe57da 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -43,6 +43,23 @@ MSYS_NO_PATHCONV=1 docker exec dashboard-mariadb-db-1 sh -c 'mariadb --default-c
 - パスワードは**コンテナ内の環境変数のまま**使い、値を画面に出さない。
 - 入れ終えたら `SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;` で確認する。
 
+## 業務ガイドの記事（v2.2.194〜）
+画面（コンポーネント）を追加・修正したら、**そのたびに業務ガイドの記事も直す（無ければ作る）**こと。記事を直さないまま「完了」と報告しない。
+1. 原稿は `backend/scripts/guide/articles/<事業>/<分類>-<並び順>.md`（事業は `order` 注文営業／`spec` 建売営業／`used` 中古リノベ／`common` 全事業共通）。ここを直す。
+2. `node backend/scripts/guide/build-guide-sql.cjs <直した記事>`（例 `order/screen-050.md`）を流し、出てきた SQL を**その版の update_log の SQL ファイルの末尾に入れる**（記事のためだけの SQL ファイルは作らない）。
+3. その SQL をローカルDBにも流す（「版を上げるとき」の 3 と同じ手順）。
+4. 作業記録（docs）に、直した記事のタイトルと変えた点を書く。
+
+- ⚠️ **現場の人が画面で手直しした記事でも、エージェントの内容を最優先する**（上書きする）。上書きの直前の内容は、スクリプトが出す SQL が `guide_history` に残すので消えない。
+- ⚠️ タイトルを変えるときは、スクリプトの出力の前に `UPDATE guide_article SET title = '新' WHERE title = '旧';` を手で書く（書かないと別の記事として増える）。
+- ⚠️ タイトルは事業が違っても重複できない。建売・中古の記事は末尾に「（建売営業）」「（中古リノベ）」を付ける。
+- 書き方：
+  - 読むのは現場の営業・マーケティング担当（非エンジニア）。
+  - テーブル名・カラム名・システムの用語は出さない。
+  - 表（`|` 区切り）は使えない。
+  - 記事どうしのリンクは `[[タイトル]]`。
+  - `> 注意：` は黄色、`> 要確認：` は赤（社内ルールなど現場で確かめること）、それ以外の `>` は緑の枠になる。
+
 # セキュリティと禁止事項
 - `.env` やクレデンシャル（パスワードやAPIキー等）が含まれるファイルは、いかなる理由があっても読み書きしないこと。
 - システム全体に影響を与える破壊的なコマンド（`rm -rf`, DBの削除など）は実行しないこと。
```

## 記事の原稿の例（order/flow-040.md）
```md
---
title: 契約したら（注文営業）
section: 業務の流れ
sort: 40
summary: 契約の入れ方（商談ステップ・ステータス・勝因）と、全社報告用フォーマットでの数え方。
---
契約は、お客様の顧客情報で入力します。全社報告用フォーマットや店舗・担当別反響には、入力した内容が自動で集計されます（報告用の画面に直接入れる場所はありません）。

## やること
1. [[顧客DB]] でお客様を開く（反響一覧の「詳細」や、全社報告用フォーマットの数字を押して出る一覧からも開けます）
2. **商談ステップに「契約」を追加**し、契約した日を入れる（この日付が契約日になります）
3. ステータスを **契約済み** にする
4. **勝因の入力**をする
   - 選ばれた理由
   - 他社との差額
   - 競合（比べていた会社）
   - 競合の営業担当者の名前
5. [[ランク]] を S にする

> 注意：契約として数えるのは「契約日が入っていて、ステータスが契約済み（または解約）」のお客様です。どちらか片方だけでは、店舗の契約数にも契約率にも入りません。

> 勝因は、次の商談で同じ競合に勝つための材料になります。失注したときの「敗因」と対で残してください（[[失注したら]]）。

## 全社報告用フォーマットでの数え方
- **契約日の月**で数えます（年度は6月はじまり）
- **契約済み（当月）**：契約日が今月のお客様
- **S/A/B/C の見込み**：ステータスが「見込み」のお客様だけ。契約見込み月が来月以降のお客様は、今月の見込みに入りません
- 予算（目標）は、店舗の行と担当の行に直接入力します

## 解約になったら
1. ステータスを **解約** にする
2. **解約発生日**を入れる

> 注意：解約になっても契約日が残っていれば、契約の数には入ったままです。「キャンセル数を表示」にチェックを付けると、そのうちの解約の数が赤い印で出ます。

> 要確認：契約したときの社内への報告先・書類の流れは、ここに書き足してください。

## 関係する記事
- [[契約]]
- [[全社報告用フォーマット]]
- [[店舗・担当別反響]]
```
