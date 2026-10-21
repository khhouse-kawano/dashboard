# 2026-10-21 v2.2.204 顧客情報の「HP閲覧履歴」・閉じた欄のフェード表示・土地コーディネートの削除

## 依頼（ReadMeClaude.md）
- 新たに v2.2.204 で作業を始める。ダウンロードの db の CSV を、ファイル名と同じテーブルに流し込んでから始める
- 顧客情報（注文）から**土地コーディネート**を外す
- 商談ステップの行の上に **HP閲覧履歴** の行を入れる。master_data.landing_params の khg_vid で tracking_pageviews と突き合わせ、日時・url・title を見やすく出す。開閉のボタン（**閲覧**）を付ける
- 置いた開閉の仕組みを、商談ステップなどの「編集」にも反映する。半透明のマスクを続けるか、別のものにするかはエージェントが提案する
- 追加の指示
  - 「InformationEditKaeru.tsx と InformationEditResale.tsx にも反映させて」
    - 建売・中古の反響・顧客の表には landing_params が無く、閲覧と結びつけられない。確認の結果「**開閉の見た目だけ**」を反映した（HP閲覧履歴の行は注文だけ）
  - 「HP閲覧履歴は landing_params が存在する顧客だけの表示でよい」

## 0. 作業開始の準備
### 版を上げる3点
- `frontend/src/utils/version.ts`：`2.2.204`
- `backend/scripts/sql/2026-10-21_update_log_2.2.204.sql`（update_log の1行 ＋ 記事3本）
- ローカルDBに流した（update_log の no=303。記事 id 8・29・42）

### CSV の流し込み（ローカルDB）
`C:\Users\shinji-kawano\Downloads\db\` の4ファイル。どれも見出しはテーブルの列と同じ並び。

| テーブル | 前 | 後 |
|---|---|---|
| master_data | 26,568 | **26,643** |
| tracking_pageviews | 0 | **60** |
| tracking_keep_visitors | 0 | **8** |
| tracking_touches | 319 | **5,692** |

- 前のテーブルは `<名前>_bk_20261021` という名前でローカルに残した。mysqldump も scratchpad の `bk_csvload_20261021.sql` に残した
- `<名前>_new` に読み込み、件数・NULL・日本語を確かめてから `RENAME TABLE` で入れ替えた
- ⚠️ 落とし穴：Git Bash の `grep -c $'\r$'` は全行を CRLF と数えたが、**実際の改行は LF** だった。CRLF の指定で読むと、master_data は列がずれ、tracking の3つは0件になった（警告は master_data の分しか出ない）
- ⚠️ `ESCAPED BY ''`（エスケープ無し）で読んだ。`'\\'` のままだと、値の中の `\` で列がずれるおそれがある

```sql
LOAD DATA LOCAL INFILE '/tmp/master_data.csv' INTO TABLE master_data_new CHARACTER SET utf8mb4
  FIELDS TERMINATED BY ',' ENCLOSED BY '"' ESCAPED BY '' LINES TERMINATED BY '\n' IGNORE 1 LINES;
```
- khg_vid を持つ顧客は1件（id 015BS7R2NRG3Q9ZJ9488EGA9SA・閲覧5ページ）。確認に使った

## 1. 閉じた欄の見せ方（提案して採用）
以前：高さ 80px で切り、**欄の全体を半透明**（opacity .3）にしていた。

今回：高さ 80px で切り、**下へ向かって背景に溶けるように消す**（CSS の `mask-image`）。
- 上の数行ははっきり読めるので、中身を想像できるという意図は残る
- 「続きがある」と一目でわかる（GitHub や記事サイトの「続きを読む」と同じ見せ方）
- **薄い部分を押しても開く**。⚠️ 閉じているあいだは、中のボタン・リンクに押した操作を渡さない（capture で止める）。開くつもりで押したのに「追加」などが動かないようにするため
- 注文・建売・中古の3画面の、すべての「編集」の欄に入れた（`expandStyle` を使っている欄すべて）

## 2. 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/tracking | **customerPageviews.ts**（新規） | `listCustomerPageviews(id)`：master_data.landing_params の khg_vid → tracking_pageviews（新しい順・500行まで） |
| backend-express/src/gateway | **registry.ts** | request `customer_pageviews`（auth: staff） |
| backend/src/core | **express_proxy.php** | `expressProxyRequests()`・`expressProxyExclusive()` の両方に `customer_pageviews` |
| frontend/src/components/information | **CustomerPageviews.tsx**（新規。接頭辞 `cpv_`） | HP閲覧履歴の中身。要約（訪問の回数・ページ数・最終）＋訪問ごとのまとまり |
| frontend/src/components/information | **InformationEdit.tsx** | HP閲覧履歴の行（landing_params がある顧客だけ）・`expand.history`・`expandProps`・土地コーディネートのボタン／`estateId`／`<Estate>`／import を削除 |
| frontend/src/components/information | **InformationEditKaeru.tsx**・**InformationEditResale.tsx** | `expandProps`（フェード表示・押して開く）のみ |
| frontend/src/utils | **informationUtils.ts** | `collapsedMask`・`openOnClickCapture`（新規） |
| frontend/src/utils | **version.ts** | 2.2.204 |
| backend/scripts/sql | **2026-10-21_update_log_2.2.204.sql**（新規） | update_log ＋ 記事3本 |
| backend/scripts/guide/articles | **order/screen-020.md**・**spec/screen-020.md**・**used/screen-020.md** | 記事 |

- ⚠️ `components/Estate.tsx` は Menu.tsx でも使っているので残した（顧客情報から開く入口だけ外した）

### 設計の判断
- 画面からは顧客の **id だけ**を送る。visitor_id は ② が顧客の行から読む（画面から visitor_id を受け取ると、他人の閲覧を引けてしまうため）
- 閲覧履歴は、閉じていても上の数行が見えるので、**開く前から読み込む**（行を出す顧客のときだけ）
- 訪問（visit_id）ごとにまとめ、新しい訪問が上。訪問の中は**見た順**（流れが読めるように）
- title が空のページはパスを出す

## 3. 業務ガイドの記事
- **顧客DB**（order/screen-020.md）：「閉じている欄（「編集」「閲覧」）」「HP閲覧履歴」の節を足した（記録は 2026-10-21 から・反響を送ったサイトの閲覧だけ・お客様に伝えるかは社内ルール、の注意つき）
- **顧客DB（建売営業）**・**顧客DB（中古リノベ）**：「閉じている欄（「編集」）」の節を足した
- タイトルは変えていない

## 4. 確認
### ②（コンテナ内で処理を直接）
- 015BS7R2…：200・linked true・5件（新しい順、サイト名つき）
- 存在しない id：200・linked false・0件
- 空・数値：400「顧客が指定されていません。」
- 実行計画：`idx_tracking_pageviews_visitor` を使う

### ① 経由
- トークン無しで `{"request":"customer_pageviews"}` → **401**（② まで届いている）
- ⚠️ 確認の途中、`category` を付けて ② に直接送ったら「未移植」になった。`category` がゲートウェイの鍵に入るため（画面は付けないので問題なし）

### 画面（ビルド `main.04e52c85.js` を Playwright で。顧客情報と閲覧は ② の実データの返答。古い訪問を1つ足して確認）
- 注文
  - 行の順：競合情報 > **HP閲覧履歴** > 商談ステップ。土地コーディネートのボタンは0
  - 閉じた状態：高さ 80px・mask あり・opacity 1。要約「2回の訪問 7ページ 最終 10/21(水) 10:50」、訪問2つ（5ページ／2ページ）、訪問の中は見た順
  - 閉じたまま中のリンクを押す → タブは開かず、欄が開く（×閉じる・高さ 392px）
  - 開いているときにリンクを押す → 別タブで開く
  - ×閉じる → 閲覧・80px に戻る
  - 商談ステップの薄い部分を押す → 開く（×閉じる）。架電状況・アンケート・きっかけ・動機も同じフェード表示
  - khg_vid が無い（gclid だけ）→ 行は出て「顧客ID が無いため…」
  - landing_params が無い → 行を出さない（② への問い合わせもしない）
  - ② が失敗 → 「閲覧履歴を読み込めませんでした…」
  - 幅 390px：ページの横はみ出し 0
- 建売（新規登録で開く）：閉じた欄3つがフェード表示、半透明の欄0、押すと開く
- 中古（新規登録で開く）：閉じた欄2つがフェード表示、半透明の欄0、押すと開く
- eslint：変更した5ファイルに新しい警告なし（出ている警告は前からのもの）

### リファクタリング
- 閉じた欄のスタイルと「押して開く」を `informationUtils.ts` にまとめ、3画面は `expandProps` から使う形にした
- `CustomerPageviews.tsx` のリンクに付けていた `stopPropagation` は、capture で止めるので不要になり外した
- 上の画面の確認は、この整理のあとのビルドで行った

---

## 付録：追加・変更したコード

### backend-express/src/features/tracking/customerPageviews.ts（新規・全文）
```tsx
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { UUID_PATTERN, parseLandingParams } from './params';

/**
 * 顧客1人の HP閲覧履歴（v2.2.204）。画面は information/CustomerPageviews.tsx（注文営業の顧客情報）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面からは顧客の id だけを受け取る。master_data.landing_params の khg_vid を ② で読み、
 *   tracking_pageviews の visitor_id と突き合わせる（⚠️ 画面から visitor_id を受け取らない。他人の履歴を引けないように）。
 * ⚠️ 注文（master_data）だけ。建売・中古の顧客の表には landing_params が無い（2026-10-21 の指示で対象外）。
 * ⚠️ khg_vid はサイト（ドメイン）ごとの ID。反響を送ったサイトの閲覧だけが出る。
 * ⚠️ 古い行は 6時間ごとの整理で消えるが、有効名簿の人は消さない（maintenance.ts）。
 * ─────────────────────────────────────────────
 */

interface CustomerRow extends RowDataPacket {
  landing_params: string | null;
}

interface PageviewRow extends RowDataPacket {
  id: number;
  visit_id: string;
  url: string;
  title: string | null;
  created_at: string;
  site_name: string | null;
}

const LIMIT = 500;

export const listCustomerPageviews = async (idValue: unknown): Promise<{ httpStatus: number; body: Record<string, unknown> }> => {
  const id = typeof idValue === 'string' ? idValue.trim().slice(0, 100) : '';
  if (id === '') return { httpStatus: 400, body: { status: 'error', message: '顧客が指定されていません。' } };

  const customers = await query<CustomerRow>('SELECT landing_params FROM master_data WHERE id = ? LIMIT 1', [id]);
  const visitorId = (parseLandingParams(customers[0]?.landing_params).khg_vid ?? '').toLowerCase();
  if (!UUID_PATTERN.test(visitorId)) {
    return { httpStatus: 200, body: { status: 'ok', linked: false, pageviews: [], limit: LIMIT } };
  }

  const rows = await query<PageviewRow>(
    `SELECT p.id, p.visit_id, p.url, p.title, DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, s.name AS site_name
       FROM tracking_pageviews p LEFT JOIN tracking_sites s ON s.id = p.site_id
      WHERE p.visitor_id = ?
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${LIMIT}`,
    [visitorId]
  );

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      linked: true,
      pageviews: rows.map((r) => ({
        id: Number(r.id),
        visitId: r.visit_id,
        url: r.url,
        title: r.title ?? '',
        createdAt: r.created_at,
        site: r.site_name ?? '',
      })),
      limit: LIMIT,
    },
  };
};
```

### frontend/src/components/information/CustomerPageviews.tsx（新規・全文）
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';

/**
 * 顧客情報の「HP閲覧履歴」（v2.2.204 新規）。注文営業の顧客情報（InformationEdit.tsx）の商談ステップの上の行。
 *
 * ─────────────────────────────────────────────
 * ⚠️ ② の customer_pageviews（features/tracking/customerPageviews.ts）。顧客の id だけを送り、
 *   ② が顧客の landing_params の khg_vid で tracking_pageviews を探す。
 * ⚠️ 訪問（visit_id。30分あくと別の訪問）ごとにまとめ、新しい訪問が上・訪問の中は見た順。
 * ⚠️ 開閉は親（InformationEdit.tsx の expand.history）。閉じていても上の数行は見えるので、開く前から読み込む。
 * ─────────────────────────────────────────────
 */

interface Pageview {
    id: number;
    visitId: string;
    url: string;
    title: string;
    createdAt: string;
    site: string;
}

interface Visit {
    visitId: string;
    site: string;
    pages: Pageview[];
}

interface Props {
    /** 顧客の id。⚠️ 新規の顧客は空 */
    customerId: string;
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/** 2026-10-21 10:40:49 → 10/21(火) 10:40 */
const dayTime = (text: string): string => {
    const d = new Date(text.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return text;
    return `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const timeOf = (text: string): string => text.slice(11, 16);

/** https://kh-house.jp/event/a/ → /event/a/ */
const pathOf = (url: string): string => {
    try { return decodeURI(new URL(url).pathname); } catch { return url; }
};

const CustomerPageviews = ({ customerId }: Props) => {
    const [state, setState] = useState<'loading' | 'error' | 'unlinked' | 'ok'>('loading');
    const [pageviews, setPageviews] = useState<Pageview[]>([]);
    const [limit, setLimit] = useState(0);

    useEffect(() => {
        if (!customerId) { setState('unlinked'); setPageviews([]); return; }
        let alive = true;
        setState('loading');
        apiClient.post('', { request: 'customer_pageviews', id: customerId })
            .then((res) => {
                if (!alive) return;
                setPageviews(res.data.pageviews ?? []);
                setLimit(res.data.limit ?? 0);
                setState(res.data.linked ? 'ok' : 'unlinked');
            })
            .catch((e) => {
                console.error('HP閲覧履歴の取得に失敗しました', e);
                if (alive) setState('error');
            });
        return () => { alive = false; };
    }, [customerId]);

    /** 新しい訪問が上。⚠️ ② は新しい順で返すので、同じ訪問の行は続いて並ぶ */
    const visits = useMemo(() => {
        const list: Visit[] = [];
        for (const p of pageviews) {
            const last = list[list.length - 1];
            if (last && last.visitId === p.visitId) last.pages.unshift(p);
            else list.push({ visitId: p.visitId, site: p.site, pages: [p] });
        }
        return list;
    }, [pageviews]);

    const style = (
        <style>{`
            .cpv_wrap { font-size: 12px; letter-spacing: .4px; color: #303030; }
            .cpv_summary { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: baseline; margin-bottom: 10px; }
            .cpv_summary b { font-size: 15px; font-variant-numeric: tabular-nums; margin-right: 2px; }
            .cpv_muted { color: #8a8f98; font-size: 11px; }
            .cpv_visit { border-left: 3px solid #d2d6da; padding: 2px 0 2px 12px; margin-bottom: 12px; }
            .cpv_visit_head { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; font-weight: 600; margin-bottom: 4px; }
            .cpv_page { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 8px; padding: 3px 0; }
            .cpv_time { color: #8a8f98; font-variant-numeric: tabular-nums; }
            .cpv_title { color: #0d6efd; text-decoration: none; overflow-wrap: anywhere; }
            .cpv_title:hover { text-decoration: underline; }
            .cpv_path { display: block; color: #8a8f98; font-size: 11px; overflow-wrap: anywhere; }
        `}</style>
    );

    if (state !== 'ok' || pageviews.length === 0) {
        const message = {
            loading: '読み込み中…',
            error: '閲覧履歴を読み込めませんでした。時間をおいて開き直してください。',
            unlinked: 'この顧客の流入情報には顧客ID が無いため、サイトの閲覧と結びつけられません（タグを入れる前の反響など）。',
            ok: '閲覧の記録はまだありません。',
        }[state];
        return <div className="cpv_wrap">{style}<span className="cpv_muted">{message}</span></div>;
    }

    return (
        <div className="cpv_wrap">
            {style}
            <div className="cpv_summary">
                <span><b>{visits.length}</b>回の訪問</span>
                <span><b>{pageviews.length}</b>ページ</span>
                <span className="cpv_muted">最終 {dayTime(pageviews[0].createdAt)}</span>
                {pageviews.length >= limit && <span className="cpv_muted">※新しい {limit} ページまで</span>}
            </div>
            {visits.map((v) => (
                <div className="cpv_visit" key={v.visitId}>
                    <div className="cpv_visit_head">
                        <span>{dayTime(v.pages[0].createdAt)}</span>
                        <span className="cpv_muted">{v.pages.length}ページ{v.site && ` · ${v.site}`}</span>
                    </div>
                    {v.pages.map((p) => (
                        <div className="cpv_page" key={p.id}>
                            <span className="cpv_time">{timeOf(p.createdAt)}</span>
                            <span>
                                <a className="cpv_title" href={p.url} target="_blank" rel="noopener noreferrer">{p.title || pathOf(p.url)}</a>
                                <span className="cpv_path">{pathOf(p.url)}</span>
                            </span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default CustomerPageviews;
```

### backend/scripts/sql/2026-10-21_update_log_2.2.204.sql（新規・全文）
```sql
-- =====================================================================
-- update_log に v2.2.204 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 記事の部分は backend/scripts/guide/build-guide-sql.cjs で作ったもの（⚠️ 手で直さない）。
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.204', '2026-10-21', '顧客情報に「HP閲覧履歴」を追加した（その顧客が自社サイトで見たページを、訪問ごとに日時つきで出す）。閉じている欄は下へ向かって薄く消える表示にし、薄い部分を押しても開くようにした。注文営業の顧客情報から「土地コーディネート」のボタンを外した。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（3本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ---------------------------------------------------------------
-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- order/screen-020.md：顧客DB
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '顧客DB';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('顧客DB', 'order', '画面の使い方', 'お客様の検索と、商談の日付・ステータス・ランクの入力。', '左のメニュー「顧客DB」。取り込んだお客様を探して、情報を直す画面です。お客様の名前を押すと、顧客情報の編集が開きます。

[[画面:顧客DB]]

## 絞り込み
- 店舗（選ぶと担当でも絞れます）
- 反響月・初回来場月（「未来場・来場キャンセル」も選べます）
- ランク・媒体・ステータス・架電状況
- 氏名・電話・メール・住所

## 名前の横の印
- **緑の点**：ギフト進呈の条件がそろっている（担当が決まっている・反響日がある・初回面談の記録がある・家族情報が入っている）
- **赤の点**：まだそろっていない
- **N**：Nexus に連携済み

## 担当営業の選び方
顧客情報の「担当営業」を押すと、一覧が開きます。
- はじめは、**担当店舗の営業**と「〇〇店 管理」だけが出ます
- 一番下の **他店舗の営業を表示** を押すと、注文営業の全店舗の営業が店舗ごとに出ます。上の欄で名前や店舗名で探せます
- 他店舗の営業を選んでも、**担当店舗は変わりません**。欄の右に「他店舗：〇〇店」と出ます
- 今の担当が一覧に無いとき（他店舗の営業・今年度の名簿にいない人）は、一番上に「現在の担当」として出ます

> 注意：「〇〇店 管理」を選ぶと、店舗管理に変える理由を入力する画面が出ます。

## 閉じている欄（「編集」「閲覧」）
商談ステップ・架電状況・アンケートなどの欄は、はじめは閉じています。
- 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています。開く前でも、だいたいの中身がわかります
- 左の **編集**（HP閲覧履歴は **閲覧**）を押すか、薄くなっている部分を押すと開きます
- 閉じるときは **×閉じる** を押します

> 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。

## HP閲覧履歴
商談ステップのすぐ上の欄です。そのお客様が、反響を送ったブランドのサイトで**どのページを、いつ見たか**が出ます。
- 上に、訪問の回数・見たページの数・最後に見た日時が出ます
- 訪問（30分以上あくと別の訪問）ごとにまとまり、新しい訪問が上です。訪問の中は見た順に並びます
- ページの名前を押すと、そのページが別のタブで開きます
- 欄が出るのは、サイトのフォームから流入の情報つきで反響が来たお客様だけです

> 注意：記録が始まったのは 2026年10月21日 からです。それより前に見たページは出ません。また、出るのは反響を送ったサイト（ドメイン）の閲覧だけです。

> 要確認：お客様に閲覧履歴の話をそのまま伝えるかどうかは、社内のルールに従ってください。

## 上のボタン
- **キャンセル集計（要回答）**：来場予約日を過ぎても、初回面談もキャンセル理由も空のお客様
- **失注集計（要回答）**：失注理由などが抜けているお客様（[[失注したら]]）

## 関係する記事
- [[来場予約が入ったら・来場したら]]
- [[契約したら（注文営業）]]
- [[ランク]]
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- spec/screen-020.md：顧客DB（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '顧客DB（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('顧客DB（建売営業）', 'spec', '画面の使い方', 'お客様の検索と、商談ステップ・ステータス・ランクの入力。', '左のメニュー「顧客DB」。お客様の名前を押すと、顧客情報の編集が開きます。

[[画面:顧客DB]]

## 絞り込み
- ステータス（建売営業の9種類。[[接触・来場したら（建売営業）]]）
- ランク（S〜F。[[ランク（建売営業）]]）
- **追客状況**：追客中（A〜D）／追客終了（E〜H）
- 店舗・担当・反響月・媒体・氏名・電話など

## 閉じている欄（「編集」）
顧客情報の架電状況・商談ステップ・反響内容の欄は、はじめは閉じています。
- 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています
- 左の **編集** を押すか、薄くなっている部分を押すと開きます。閉じるときは **×閉じる**

> 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- used/screen-020.md：顧客DB（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '顧客DB（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('顧客DB（中古リノベ）', 'used', '画面の使い方', 'お客様の検索と編集（中古リノベ）。', '左のメニュー「顧客DB」。お客様の名前を押すと、顧客情報の編集が開きます。

[[画面:顧客DB]]

- ステータス：見込み／契約済み／失注／会社管理
- ランク：S〜E（[[ランク（中古リノベ）]]）
- 「初回通電日」「次回架電日」の列があります
- 「複製」ボタンで、同じお客様を別の取引区分で登録し直せます

## 閉じている欄（「編集」）
顧客情報の商談ステップ・架電状況の欄は、はじめは閉じています。
- 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています
- 左の **編集** を押すか、薄くなっている部分を押すと開きます。閉じるときは **×閉じる**

> 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
```

### 差分（既存ファイル）
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 47732776..78af2929 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -17,6 +17,7 @@ import { trackingSiteSummary } from '../features/tracking/summary';
 import { trackingDetail } from '../features/tracking/detail';
 import { importMetaAds, isMetaConfigured } from '../features/metaAds/importer';
 import { listInquiryTouches } from '../features/tracking/touches';
+import { listCustomerPageviews } from '../features/tracking/customerPageviews';
 import {
   runAuthAccessTimes,
   runAuthInsert,
@@ -889,6 +890,18 @@ register({
   },
 });
 
+register({
+  request: 'customer_pageviews',
+  summary: '顧客1人の HP閲覧履歴（master_data.landing_params の khg_vid → tracking_pageviews。注文の顧客のみ）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await listCustomerPageviews(ctx.body.id);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 register({
   request: 'introductory_summary',
   summary: '紹介（注文・建売・中古）の紹介元・事業部・ブランド・エリア別の歩留まり',
diff --git a/backend/scripts/guide/articles/order/screen-020.md b/backend/scripts/guide/articles/order/screen-020.md
index 86e1425f..58177e06 100644
--- a/backend/scripts/guide/articles/order/screen-020.md
+++ b/backend/scripts/guide/articles/order/screen-020.md
@@ -28,6 +28,25 @@ summary: お客様の検索と、商談の日付・ステータス・ランク
 
 > 注意：「〇〇店 管理」を選ぶと、店舗管理に変える理由を入力する画面が出ます。
 
+## 閉じている欄（「編集」「閲覧」）
+商談ステップ・架電状況・アンケートなどの欄は、はじめは閉じています。
+- 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています。開く前でも、だいたいの中身がわかります
+- 左の **編集**（HP閲覧履歴は **閲覧**）を押すか、薄くなっている部分を押すと開きます
+- 閉じるときは **×閉じる** を押します
+
+> 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。
+
+## HP閲覧履歴
+商談ステップのすぐ上の欄です。そのお客様が、反響を送ったブランドのサイトで**どのページを、いつ見たか**が出ます。
+- 上に、訪問の回数・見たページの数・最後に見た日時が出ます
+- 訪問（30分以上あくと別の訪問）ごとにまとまり、新しい訪問が上です。訪問の中は見た順に並びます
+- ページの名前を押すと、そのページが別のタブで開きます
+- 欄が出るのは、サイトのフォームから流入の情報つきで反響が来たお客様だけです
+
+> 注意：記録が始まったのは 2026年10月21日 からです。それより前に見たページは出ません。また、出るのは反響を送ったサイト（ドメイン）の閲覧だけです。
+
+> 要確認：お客様に閲覧履歴の話をそのまま伝えるかどうかは、社内のルールに従ってください。
+
 ## 上のボタン
 - **キャンセル集計（要回答）**：来場予約日を過ぎても、初回面談もキャンセル理由も空のお客様
 - **失注集計（要回答）**：失注理由などが抜けているお客様（[[失注したら]]）
diff --git a/backend/scripts/guide/articles/spec/screen-020.md b/backend/scripts/guide/articles/spec/screen-020.md
index 6a76ae32..9f0d8d1e 100644
--- a/backend/scripts/guide/articles/spec/screen-020.md
+++ b/backend/scripts/guide/articles/spec/screen-020.md
@@ -13,3 +13,10 @@ summary: お客様の検索と、商談ステップ・ステータス・ラン
 - ランク（S〜F。[[ランク（建売営業）]]）
 - **追客状況**：追客中（A〜D）／追客終了（E〜H）
 - 店舗・担当・反響月・媒体・氏名・電話など
+
+## 閉じている欄（「編集」）
+顧客情報の架電状況・商談ステップ・反響内容の欄は、はじめは閉じています。
+- 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています
+- 左の **編集** を押すか、薄くなっている部分を押すと開きます。閉じるときは **×閉じる**
+
+> 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。
diff --git a/backend/scripts/guide/articles/used/screen-020.md b/backend/scripts/guide/articles/used/screen-020.md
index d6e05188..0798292b 100644
--- a/backend/scripts/guide/articles/used/screen-020.md
+++ b/backend/scripts/guide/articles/used/screen-020.md
@@ -12,3 +12,10 @@ summary: お客様の検索と編集（中古リノベ）。
 - ランク：S〜E（[[ランク（中古リノベ）]]）
 - 「初回通電日」「次回架電日」の列があります
 - 「複製」ボタンで、同じお客様を別の取引区分で登録し直せます
+
+## 閉じている欄（「編集」）
+顧客情報の商談ステップ・架電状況の欄は、はじめは閉じています。
+- 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています
+- 左の **編集** を押すか、薄くなっている部分を押すと開きます。閉じるときは **×閉じる**
+
+> 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 5065e3ba..ef04c3c8 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -676,6 +676,7 @@ function expressProxyRequests(): array
         'tracking_detail',
         'meta_ads_import',
         'tracking_touches',
+        'customer_pageviews',
     ];
 }
 
@@ -918,6 +919,7 @@ function expressProxyExclusive(): array
         'tracking_detail',
         'meta_ads_import',
         'tracking_touches',
+        'customer_pageviews',
     ];
 }
 
diff --git a/frontend/src/components/information/InformationEdit.tsx b/frontend/src/components/information/InformationEdit.tsx
index 8a6c2f04..f61b8f6c 100644
--- a/frontend/src/components/information/InformationEdit.tsx
+++ b/frontend/src/components/information/InformationEdit.tsx
@@ -8,10 +8,9 @@ import { baseURL } from '../../utils/baseURL';
 import FamilyInfo from '../FamilyInfo';
 import { generateULID } from '../../utils/createULID';
 import AuthContext from '../../context/AuthContext';
-import Estate from '../Estate';
 import KSnap from './KSnap';
 import IceWorld from '../calendar/IceWorld';
-import { labelStyle, buttonStyle, valueStyle, inputStyle, requiredStyle, safeFormate, expandButton, safeParse, dateFormate, statusRequiredError } from '../../utils/informationUtils';
+import { labelStyle, buttonStyle, valueStyle, inputStyle, requiredStyle, safeFormate, expandButton, safeParse, dateFormate, statusRequiredError, collapsedMask, openOnClickCapture } from '../../utils/informationUtils';
 import { kpiColumnFor } from '../../utils/interviewKpi';
 import TableInput from './TableInput';
 import LineIdRow from './LineIdRow';
@@ -28,6 +27,7 @@ import TableShop from './TableShop';
 import TableTextarea from './TableTextarea';
 import TableCheckboxGroup from './TableCheckboxGroup';
 import FundingPlan from './FundingPlan';
+import CustomerPageviews from './CustomerPageviews';
 import { useIsSp } from '../../utils/isSp';
 import apiClient from '../../utils/apiClient';
 import NexusBadge, { NEXUS_HEADER_LABEL } from '../NexusBadge';
@@ -78,7 +78,8 @@ type Expand = {
     call: boolean,
     remarks: boolean,
     reason: boolean,
-    trigger: boolean
+    trigger: boolean,
+    history: boolean
 };
 
 type Props = {
@@ -205,9 +206,9 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
         call: false,
         remarks: false,
         reason: false,
-        trigger: false
+        trigger: false,
+        history: false
     });
-    const [estateId, setEstateId] = useState('');
     const competitorsRef = useRef<HTMLInputElement>(null);
 
     const now = new Date();
@@ -662,11 +663,17 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
             border: key === 'interview' || key === 'call' ? '1px solid #dddddda9' : 'transparent',
             borderRadius: '7px',
             height: expand[key] ? 'auto' : '80px',
-            opacity: expand[key] ? '1' : '.3',
+            ...(expand[key] ? {} : collapsedMask),
             overflowY: 'hidden' as const
         }
     };
 
+    /** v2.2.204 閉じている欄は、薄く消えている部分を押しても開く */
+    const expandProps = (key: keyof Expand) => ({
+        style: expandStyle(key),
+        onClickCapture: openOnClickCapture(expand[key], () => setExpand(prev => ({ ...prev, [key]: true })))
+    });
+
     const handleClose = () => {
         setInterviewLog({
             id: '',
@@ -706,7 +713,8 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
             call: false,
             remarks: false,
             reason: false,
-            trigger: false
+            trigger: false,
+            history: false
         });
 
         setInformation({});
@@ -989,6 +997,30 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                                             />
                                         </td>
                                     </tr>
+                                    {/* ⚠️ v2.2.204: その顧客が自社サイトで見たページ（CustomerPageviews.tsx）。⚠️ 開く前から上の数行は見える
+                                        ⚠️ landing_params（フォームが送った流入情報）がある顧客だけ行を出す（2026-10-21 の指示） */}
+                                    {safeFormate(information.landing_params).trim() !== '' && <tr>
+                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
+                                            <div className="position-relative">
+                                                HP閲覧履歴
+                                                <div className='position-absolute'
+                                                    style={expandButton}
+                                                    onClick={() => {
+                                                        setExpand(prev =>
+                                                        ({
+                                                            ...prev,
+                                                            history: !prev.history
+                                                        })
+                                                        );
+                                                    }}>{expand.history ? '×閉じる' : '閲覧'}</div>
+                                            </div>
+                                        </td>
+                                        <td colSpan={3} style={{ verticalAlign: 'top', paddingTop: '25px' }}>
+                                            <div {...expandProps('history')}>
+                                                <CustomerPageviews customerId={id === 'new' ? '' : information.id ?? ''} />
+                                            </div>
+                                        </td>
+                                    </tr>}
                                     <tr>
                                         <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }} className='table-secondary'>
                                             <div className="position-relative">
@@ -1006,7 +1038,7 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                                             </div>
                                         </td>
                                         <td colSpan={3} className='table-secondary'>
-                                            <div style={expandStyle('interview')}>
+                                            <div {...expandProps('interview')}>
                                                 <TableInterview
                                                     information={information}
                                                     setInformation={setInformation}
@@ -1036,7 +1068,7 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                                             </div>
                                         </td>
                                         <td colSpan={3}>
-                                            <div style={expandStyle('call')}>
+                                            <div {...expandProps('call')}>
                                                 <TableCall
                                                     information={information}
                                                     setInformation={setInformation}
@@ -1064,13 +1096,13 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                                                     }}>{expand.remarks ? '×閉じる' : '編集'}</div>
                                             </div></td>
                                         <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
-                                            <div style={expandStyle('remarks')}>
+                                            <div {...expandProps('remarks')}>
                                                 <TableTextarea information={information} setInformation={setInformation} itemKey='customized_input_01J95TC6KEES87F0YXH29AJP7K' placeholder='面談前アンケート' />
                                             </div>
                                         </td>
                                         <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>面談後アンケート</td>
                                         <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
-                                            <div style={expandStyle('remarks')}>
+                                            <div {...expandProps('remarks')}>
                                                 <TableTextarea information={information} setInformation={setInformation} itemKey='remarks' placeholder='面談後アンケート' />
                                             </div>
                                         </td>
@@ -1092,13 +1124,13 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                                                     }}>{expand.reason ? '×閉じる' : '編集'}</div>
                                             </div></td>
                                         <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
-                                            <div style={expandStyle('reason')}>
+                                            <div {...expandProps('reason')}>
                                                 <TableCheckboxGroup information={information} setInformation={setInformation} itemKey={idMapping('問い合せのきっかけ')} idPrefix='inquiry_reason' options={inquiryReasons} />
                                             </div>
                                         </td>
                                         <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>建築動機</td>
                                         <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
-                                            <div style={expandStyle('reason')}>
+                                            <div {...expandProps('reason')}>
                                                 <TableCheckboxGroup information={information} setInformation={setInformation} itemKey={idMapping('建築動機')} idPrefix='house_hunting_motivation' options={houseHuntingMotivation.slice(0, 25)} />
                                             </div>
                                         </td>
@@ -1120,7 +1152,7 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                                             </div>
                                         </td>
                                         <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
-                                            <div style={expandStyle('trigger')}>
+                                            <div {...expandProps('trigger')}>
                                                 <TableCheckboxGroup information={information} setInformation={setInformation} itemKey={idMapping('建築動機')} idPrefix='house_hunting_motivation' options={houseHuntingMotivation.slice(16, 25)} />
                                             </div>
                                         </td>
@@ -1321,14 +1353,6 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                                 <i className="fa-regular fa-calendar-check me-1"></i>アイスワールド利用予約
                             </button>
 
-                            <button
-                                className="btn btn-outline-success btn-sm rounded-pill px-2 d-flex align-items-center"
-                                style={footerButtonStyle}
-                                onClick={() => setEstateId(information.id)}
-                            >
-                                <i className="fa-solid fa-map-location-dot me-1"></i>土地コーディネート
-                            </button>
-
                             <button
                                 className="btn btn-primary btn-sm rounded-pill px-3 shadow-sm d-flex align-items-center"
                                 style={{ ...footerButtonStyle, fontWeight: 'bold', letterSpacing: '1px', opacity: sending ? '1' : '0.5' }}
@@ -1474,7 +1498,6 @@ const InformationEdit = ({ id, token, onClose, authority }: Props) => {
                         </div></>}
                 </Modal.Body>
             </Modal >
-            <Estate estateId={estateId} setEstateId={setEstateId} />
             <KSnap id={kSnap} setKSnap={setKSnap} />
             <IceWorld shopList={shopArray.map(s => ({ brand: '', shop: s.shop }))} editId={editId} showIceWorld={showIceWorld} setShowIceWorld={setShowIceWorld} />
         </>
diff --git a/frontend/src/components/information/InformationEditKaeru.tsx b/frontend/src/components/information/InformationEditKaeru.tsx
index c6dd1b6b..efc87a5b 100644
--- a/frontend/src/components/information/InformationEditKaeru.tsx
+++ b/frontend/src/components/information/InformationEditKaeru.tsx
@@ -7,7 +7,7 @@ import { databaseList } from '../../utils/databaseList';
 import FamilyInfo from '../FamilyInfo';
 import { generateULID } from '../../utils/createULID';
 import AuthContext from '../../context/AuthContext';
-import { labelStyle } from '../../utils/informationUtils';
+import { labelStyle, collapsedMask, openOnClickCapture } from '../../utils/informationUtils';
 import { kpiColumnFor } from '../../utils/interviewKpi';
 import { buttonStyle } from '../../utils/informationUtils';
 import { valueStyle } from '../../utils/informationUtils';
@@ -598,10 +598,16 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
             border: key === 'interview' || key === 'call' ? '1px solid #dddddda9' : 'transparent',
             borderRadius: '7px',
             height: expand[key] ? 'auto' : '80px',
-            opacity: expand[key] ? '1' : '.3',
+            ...(expand[key] ? {} : collapsedMask),
             overflowY: 'hidden' as const
         }
     };
+
+    /** v2.2.204 閉じている欄は、薄く消えている部分を押しても開く */
+    const expandProps = (key: keyof Expand) => ({
+        style: expandStyle(key),
+        onClickCapture: openOnClickCapture(expand[key], () => setExpand(prev => ({ ...prev, [key]: true })))
+    });
     const handleClose = () => {
         setInterviewLog({
             id: '',
@@ -1016,7 +1022,7 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
                                             </div>
                                         </td>
                                         <td colSpan={3}>
-                                            <div style={expandStyle('call')}>
+                                            <div {...expandProps('call')}>
                                                 <TableCall
                                                     information={information}
                                                     setInformation={setInformation}
@@ -1045,7 +1051,7 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
                                             </div>
                                         </td>
                                         <td colSpan={3}>
-                                            <div style={expandStyle('interview')}>
+                                            <div {...expandProps('interview')}>
                                                 <TableInterview
                                                     information={information}
                                                     setInformation={setInformation}
@@ -1075,7 +1081,7 @@ const InformationEditKaeru = ({ id, token, onClose, authority }: Props) => {
                                                     }}>{expand.remarks ? '×閉じる' : '編集'}</div>
                                             </div></td>
                                         <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
-                                            <div style={expandStyle('remarks')}>
+                                            <div {...expandProps('remarks')}>
                                                 <textarea placeholder='反響内容・備考' style={{ ...inputStyle, width: '90%', height: 'auto' }} value={information.remarks}
                                                     rows={information.remarks ? Math.max(2, information.remarks.length / 23) + 2 : 2}
                                                     onChange={(e) => {
diff --git a/frontend/src/components/information/InformationEditResale.tsx b/frontend/src/components/information/InformationEditResale.tsx
index 17b182b5..daf6e2d1 100644
--- a/frontend/src/components/information/InformationEditResale.tsx
+++ b/frontend/src/components/information/InformationEditResale.tsx
@@ -5,7 +5,7 @@ import { databaseList } from '../../utils/databaseList';
 import FamilyInfo from '../FamilyInfo';
 import { generateULID } from '../../utils/createULID';
 import AuthContext from '../../context/AuthContext';
-import { labelStyle, buttonStyle, valueStyle, inputStyle, selectStyle, requiredStyle, safeFormate, competitorsStyle } from '../../utils/informationUtils';
+import { labelStyle, buttonStyle, valueStyle, inputStyle, selectStyle, requiredStyle, safeFormate, competitorsStyle, collapsedMask, openOnClickCapture } from '../../utils/informationUtils';
 import { kpiColumnFor } from '../../utils/interviewKpi';
 import TableInput from './TableInput';
 import LineIdRow from './LineIdRow';
@@ -614,11 +614,17 @@ const InformationEditResale = ({ id, token, onClose, authority }: Props) => {
             border: key === 'interview' || key === 'call' ? '1px solid #dddddda9' : 'transparent',
             borderRadius: '7px',
             height: expand[key] ? 'auto' : '80px',
-            opacity: expand[key] ? '1' : '.3',
+            ...(expand[key] ? {} : collapsedMask),
             overflowY: 'hidden' as const
         }
     };
 
+    /** v2.2.204 閉じている欄は、薄く消えている部分を押しても開く */
+    const expandProps = (key: keyof Expand) => ({
+        style: expandStyle(key),
+        onClickCapture: openOnClickCapture(expand[key], () => setExpand(prev => ({ ...prev, [key]: true })))
+    });
+
     const handleClose = () => {
         setInterviewLog({
             id: '',
@@ -1041,7 +1047,7 @@ const InformationEditResale = ({ id, token, onClose, authority }: Props) => {
                                             </div>
                                         </td>
                                         <td colSpan={3}>
-                                            <div style={expandStyle('interview')}>
+                                            <div {...expandProps('interview')}>
                                                 <TableInterview
                                                     information={information}
                                                     setInformation={setInformation}
@@ -1073,7 +1079,7 @@ const InformationEditResale = ({ id, token, onClose, authority }: Props) => {
                                             </div>
                                         </td>
                                         <td colSpan={3}>
-                                            <div style={expandStyle('call')}>
+                                            <div {...expandProps('call')}>
                                                 <TableCall
                                                     information={information}
                                                     setInformation={setInformation}
diff --git a/frontend/src/utils/informationUtils.ts b/frontend/src/utils/informationUtils.ts
index af39d0d3..55875a96 100644
--- a/frontend/src/utils/informationUtils.ts
+++ b/frontend/src/utils/informationUtils.ts
@@ -1,3 +1,5 @@
+import type { MouseEvent } from 'react';
+
 export const baseStyle = { border: '1px solid #D3D3D3', borderRadius: '4px', height: '35px', width: '150px', paddingLeft: '10px', color: '#303030' };
 export const labelStyle = { color: '#303030', fontSize: '11px', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' };
 export const buttonStyle = {
@@ -31,6 +33,28 @@ export const toHalfWidth = (str: string) => {
         String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
     ).replace(/　/g, ' ');
 };
+/**
+ * 顧客情報の閉じている欄（「編集」「閲覧」の欄）の見せ方（v2.2.204。注文・建売・中古の3画面で共通）。
+ * 高さ80pxで切り、下へ向かって背景に溶けるように消す。上の行は読めるので、開く前から中身が想像できる。
+ * ⚠️ 以前は欄の全体を半透明（opacity .3）にしていた。
+ */
+export const collapsedMask = {
+    maskImage: 'linear-gradient(to bottom, #000 30%, transparent 100%)',
+    WebkitMaskImage: 'linear-gradient(to bottom, #000 30%, transparent 100%)',
+    cursor: 'pointer'
+};
+
+/**
+ * 閉じている欄を押したら開く（v2.2.204）。⚠️ 閉じているあいだは中のボタン・リンクに押した操作を渡さない
+ * （capture で止める。開くつもりで押したのに、中の「追加」などが動かないように）。
+ */
+export const openOnClickCapture = (isOpen: boolean, open: () => void) => (e: MouseEvent) => {
+    if (isOpen) return;
+    e.preventDefault();
+    e.stopPropagation();
+    open();
+};
+
 export const expandButton = {
     ...buttonStyle,
     height: '28px',
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index f62cbb26..8deebc47 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.203';
+export const newVersion = '2.2.204';
```
