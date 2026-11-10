# 2026-11-05 v2.2.245（続き）不動産企画係：一覧の絞り込み・通期・媒介台帳の1枚表示・追加ボタンの削除

## 依頼
- 前日（11/04）に、v2.2.245 では tsconfig の修正まで済ませた（docs/task-2026-11-04-05-tsconfig.md）。続きを同じ版に入れる（「明日の改修で続きの作業も245に含める」）
- 制作者からの要望（4点）
  1. 売り・買いの反響管理に、担当者・反響元・フェーズ・反響受信月・顧客名 or 所在地（検索窓）を置く
  2. チームサマリーと、売り・買い反響管理の表示は、基本は通期にする。月は絞り込みのプルダウンで選ぶ
  3. 媒介台帳は、20件ごとのページ割りをせず、媒介獲得日の順に1枚で出す（最低でも100件ごと）
  4. 媒介台帳・商談案件の「媒介追加」「商談追加」ボタンは要らない。必ず売り・買い反響から登録する（どの反響から案件化したかを辿れるようにする）
- 利用者の判断（11/05）
  - 3は、とりあえず1枚
  - 通期は、とりあえず12か月（設定の期首月から）

## やったこと
| 要望 | 画面 | 内容 |
|---|---|---|
| 1 | 売り反響・買い反響 | 一覧の上に絞り込みを置いた：担当者（「未割当」も選べる）・反響元（買いはポータル）・フェーズ・検索（売りは売主名と所在地、買いは顧客名・物件・所在地）。反響受信月は、今ある左上の期間（月別・通期・全期間）がその役目 |
| 2 | 売り反響・買い反響 | 開いたときの期間を「今期の通期」にした（以前は今月） |
| 2 | チームサマリー | 期間の選択の先頭に「通期（2026年6月〜2027年5月）」を足し、既定にした。月は今期の12か月から選べる |
| 3 | 媒介獲得台帳 | ページ割りをやめ、媒介契約日の新しい順に全件（ローカル196件）を1枚で出す。媒介契約日が空の6件は最後 |
| 4 | 媒介獲得台帳 | 「媒介追加」ボタンと、その処理を消した |
| 4 | 商談案件管理 | 「＋ 商談案件を追加」（v2.2.244 で付けたもの）と、新規作成の処理を消した。既存の案件の編集・削除は残した |

### 通期のときの数え方（チームサマリー）
- 歩留まり・売りKPI・買いKPI：受信日が今期の12か月に入る反響
  - 目標受託数は年間の目標。前月比は「―」
- 年間予算の進捗：今期の12か月の合計（先の月に契約日がある契約予定も入る）
  - 経過月数は今月までで数え、遅れ・先行を判定する
- KPIサマリー：12か月の合計。目標の列は年間予算

### 気づいたこと
- 媒介台帳の「媒介契約日」の列は、並べるときに受信日・登録日を先に／代わりに見ていた
  - そのため、媒介契約日が空の6件が、登録日（8/26）の位置に混ざっていた。媒介契約日だけで並べるように直した
- 媒介台帳（DatabaseBroker.tsx）には、前からある警告（使っていない Modal・targetCustomer・uniqueStaffList）がある。今回の範囲外なので触っていない
- 買取再販の「新規」は残っている。売り反響 → 買取案件へ移す操作は v2.2.246 で作る予定
- ④で追加ボタンを消したので、他社の客付けで売れる案件は、媒介台帳の「買付有」→ 買付登録ができるまで、商談案件にできない（v2.2.246 で急ぐ）

## ディレクトリ・ファイル
| 区分 | ファイル | 内容 |
|---|---|---|
| 新規 | `frontend/src/components/realty/common/LeadFilterBar.tsx` | 絞り込みの部品。追加した関数・定数：`matchesFilter`・`EMPTY_FILTER`・`UNASSIGNED`、型 `LeadFilter` |
| 修正 | `frontend/src/components/realty/sell/LeadSell.tsx` | `periodLeads`（期間）と `filteredLeads`（＋絞り込み）、`sourceOptions`、次回アクションの警告は期間の全件で数える |
| 修正 | `frontend/src/components/realty/buy/LeadBuy.tsx` | 同上。`portalOptions`、ポータルの選択肢を `BUY_PORTALS` にまとめた（一覧の2か所と絞り込み） |
| 修正 | `frontend/src/components/realty/common/leadFunnel.ts` | `defaultPeriod` を今期の通期に。使わなくなった `todayStr` の import を外した |
| 修正 | `frontend/src/components/realty/summary/Summary.tsx` | `FY`・`isFy`・`selMonths`・`inSel`・`fyRange`・`selLabel`・`periodOptions`。歩留まり・予算・KPI・見出しを通期に対応 |
| 修正 | `frontend/src/components/database/DatabaseBroker.tsx` | ページ割りと「媒介追加」を消し、媒介契約日で並べる |
| 修正 | `frontend/src/components/realty/deals/LeadOpportunity.tsx` | 「＋ 商談案件を追加」と新規作成の処理を消した |
| 修正 | `backend/scripts/sql/2026-11-04_update_log_2.2.245.sql` | 更新履歴の文と、業務ガイド3本の SQL |
| 修正 | `backend/scripts/guide/articles/common/screen-240.md`・`screen-245.md`・`screen-247.md` | 業務ガイド |
| 移動 | `docs/*-2026-11-03-*`・`deploy-v2.2.239〜241.md` → `docs/oldDocument/` | 作って2日たったため |

## 業務ガイド
- **チームサマリー（不動産企画係）**：「対象月」を「対象期間」にした。開いたときは通期で、月も選べることを書いた。通期のときの予算・KPI・目標・前月比の数え方を書いた
- **売り反響・買い反響の歩留まり（不動産企画係）**：開いたときは通期になったこと（以前は今月）。「一覧の絞り込み」の節を足した
- **反響から商談案件へのつながり（不動産企画係）**：「＋ 商談案件を追加」の行を消した。どちらの画面でも新しく作れないこと（理由も）と、媒介獲得台帳が媒介契約日の順に1枚で出ることを書いた

## テスト
- 型（`npx tsc --noEmit -p frontend`）は0件。本番用ビルドは、型も確かめたうえで通った
- ① を通す：トークン無しで `planner:lead` を送ると 401。新しい request は無い
- update_log の SQL をローカルに流した：no=344。文は UPDATE で合わせ、記事3本も入れた
- Playwright（3100・Master）
  - 売り反響：既定が「2026年度（2026/6〜2027/5）通期」で303件
    - 担当で76件、＋フェーズで17件、検索「鹿児島」で284件、未割当で15件
    - 期間を月にすると71件
  - 買い反響：既定が通期で107件
    - 担当で23件、検索「マンション」で2件、未割当で1件
  - チームサマリー：既定が「通期（2026年6月〜2027年5月）」
    - 見出しが通期、表の見出しは「年間予算・通期見込・通期契約件数・通期媒介獲得」
    - 前月比は「―」、目標受託数は189（年間）
    - 10月に切り替えると、月次の見出しになり、前月比は +1、目標は16
  - 媒介獲得台帳：196件が1枚。媒介追加もページ送りも無い。媒介契約日の新しい順で、空の6件は最後
  - 商談案件管理：追加ボタンは無く、案内の文が出る。編集画面は「商談案件を編集」で、削除ボタンもある
  - 業務ガイド：記事3本が表示され、古い文は残っていない
  - 画面のエラーは0件
- リファクタリング（通期の範囲の文字を `fyRange` にまとめた）のあと、もう一度流して、同じ結果になった
- 後片付け：仮スタッフを消した。開発サーバー（3100）を止めた

## 新規ファイルの全文

### frontend/src/components/realty/common/LeadFilterBar.tsx
````tsx
import React from 'react';
import { removeSpaces } from './leadUtiles';

/**
 * 売り反響・買い反響の一覧の絞り込み（v2.2.245 新規）。制作者の要望「担当者・反響元・フェーズ・反響受信月・顧客名 or 所在地（検索窓）」。
 *
 * ⚠️ 反響受信月は、上の期間の選択（LeadHeader。月別・通期・全期間）がその役目。ここには置かない。
 * ⚠️ 絞るのは下の一覧だけ。上のタイル・歩留まり（LeadFunnelPanel）は期間だけで数える（以前のアプリと同じ）。
 */

export type LeadFilter = { staff: string; source: string; phase: string; q: string };

export const EMPTY_FILTER: LeadFilter = { staff: '', source: '', phase: '', q: '' };

/** 担当が未割当の行を選ぶための値（⚠️ 担当名と重ならない値） */
export const UNASSIGNED = '__unassigned__';

type Props = {
    value: LeadFilter;
    onChange: (next: LeadFilter) => void;
    staffOptions: string[];
    sourceOptions: string[];
    phaseOptions: string[];
    /** 反響元（売り）・ポータル（買い） */
    sourceLabel: string;
    searchPlaceholder: string;
    /** 絞り込んだ件数と、期間の中の件数 */
    shown: number;
    total: number;
};

/**
 * 1行が絞り込みに合うか。
 * @param fields 行から取り出した値（担当・反響元・フェーズ・検索の対象の文字）
 * @param defaultPhase フェーズが空の行をどの段階とみなすか（売り反響は「リード受信」）
 */
export const matchesFilter = (
    f: LeadFilter,
    fields: { staff: string | null | undefined; source: string; phase: string | null | undefined; text: (string | null | undefined)[] },
    defaultPhase = ''
): boolean => {
    const staff = removeSpaces(fields.staff);
    if (f.staff === UNASSIGNED ? staff !== '' : f.staff !== '' && staff !== removeSpaces(f.staff)) return false;
    if (f.source !== '' && fields.source !== f.source) return false;
    if (f.phase !== '' && (fields.phase || defaultPhase) !== f.phase) return false;
    const q = removeSpaces(f.q).toLowerCase();
    if (q !== '' && !fields.text.some(t => removeSpaces(t).toLowerCase().includes(q))) return false;
    return true;
};

const box: React.CSSProperties = { fontSize: '12px', height: '30px', padding: '2px 8px', border: '1px solid #ced4da', borderRadius: '4px', backgroundColor: '#fff' };
const label: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#6c757d', marginBottom: '2px' };

const LeadFilterBar = ({ value, onChange, staffOptions, sourceOptions, phaseOptions, sourceLabel, searchPlaceholder, shown, total }: Props) => {
    const set = (p: Partial<LeadFilter>) => onChange({ ...value, ...p });
    const active = value.staff !== '' || value.source !== '' || value.phase !== '' || value.q.trim() !== '';
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', padding: '10px 12px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '8px' }}>
            <div>
                <div style={label}>担当者</div>
                <select style={{ ...box, width: '150px' }} value={value.staff} onChange={e => set({ staff: e.target.value })} aria-label="担当者">
                    <option value="">すべて</option>
                    <option value={UNASSIGNED}>未割当</option>
                    {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div>
                <div style={label}>{sourceLabel}</div>
                <select style={{ ...box, width: '150px' }} value={value.source} onChange={e => set({ source: e.target.value })} aria-label={sourceLabel}>
                    <option value="">すべて</option>
                    {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div>
                <div style={label}>フェーズ</div>
                <select style={{ ...box, width: '140px' }} value={value.phase} onChange={e => set({ phase: e.target.value })} aria-label="フェーズ">
                    <option value="">すべて</option>
                    {phaseOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <div>
                <div style={label}>検索</div>
                <input style={{ ...box, width: '240px' }} value={value.q} placeholder={searchPlaceholder} onChange={e => set({ q: e.target.value })} aria-label="検索" />
            </div>
            {active && (
                <button type="button" style={{ ...box, cursor: 'pointer', color: '#6c757d' }} onClick={() => onChange(EMPTY_FILTER)}>
                    条件を消す
                </button>
            )}
            <span style={{ fontSize: '11px', color: '#6c757d', marginLeft: 'auto', paddingBottom: '6px' }}>
                {active ? `${shown} 件 ／ 期間の中 ${total} 件` : `${total} 件`}
            </span>
        </div>
    );
};

export default LeadFilterBar;
````

### backend/scripts/sql/2026-11-04_update_log_2.2.245.sql（更新履歴の部分）
````sql
-- =====================================================================
-- v2.2.245 tsconfig の修正・不動産企画係の一覧の絞り込み・通期・媒介台帳の1枚表示・追加ボタンの削除 ＋ update_log
--   （末尾に業務ガイド「チームサマリー」「売り反響・買い反響の歩留まり」「反響から商談案件へのつながり」（いずれも不動産企画係）の上書き）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================

-- 1. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.245', '2026-11-05', '不動産企画係の売り反響・買い反響の一覧に、担当者・反響元・フェーズ・名前や所在地での絞り込みを追加し、売り反響・買い反響・チームサマリーは通期で開くようにした。媒介獲得台帳は媒介契約日の順に1枚で出し、媒介獲得台帳・商談案件管理では新しく作れないようにした（必ず反響から作る）。');

-- ---------------------------------------------------------------
````

## 修正したファイルの差分
````diff
diff --git a/backend/scripts/guide/articles/common/screen-240.md b/backend/scripts/guide/articles/common/screen-240.md
index 72517e1d2..070465f3f 100644
--- a/backend/scripts/guide/articles/common/screen-240.md
+++ b/backend/scripts/guide/articles/common/screen-240.md
@@ -2,19 +2,22 @@
 title: チームサマリー（不動産企画係）
 section: 画面の使い方
 sort: 240
-summary: 以前のアプリの「ダッシュボード」と同じ画面。歩留まり・年間予算の進捗・担当者別の月次KPI・架電実績・朝礼用アラート・営業司令塔。
+summary: 以前のアプリの「ダッシュボード」と同じ画面。歩留まり・年間予算の進捗・担当者別のKPI（通期・月別）・架電実績・朝礼用アラート・営業司令塔。
 ---
 不動産企画係の画面の最初のページで、以前のアプリの「📊 ダッシュボード」と同じ画面です。事業を選ぶ画面で「不動産企画係」を押すと開きます（[[不動産企画係の画面（入口と権限）]]）。
 
-## 対象月
-左上で月を選びます。選べるのは**今期の12か月**です（期首月は設定の値。いまは6月はじまり）。
+## 対象期間
+左上で選びます。開いたときは**通期**（今期の12か月。期首月は設定の値で、いまは6月はじまり）です。月ごとに見たいときは、同じところで**今期の月**を選びます。
 
 ## 上から順に（以前のアプリと同じ並び）
-- **歩留まりファネル**：対象月に受信した売り反響・買い反響が、どこまで進んだか（数え方は[[売り反響・買い反響の歩留まり（不動産企画係）]]）
-- **年間予算進捗**：期首から対象月までの**売上計上額の累計**を、担当者の年間予算の合計で割ったもの。経過月数に比べて遅れていれば赤、先行していれば緑です
-- **月次KPIサマリー**：担当者ごとの今月目標・今月見込の売上・達成率・契約件数・媒介獲得・未決の案件など
-- **架電実績**：担当者ごとの本日・今週（月曜はじまり）・今月の架電の数（売り・買い）
-- **一括査定KPIサマリー・買い反響KPIサマリー**：対象月に受信した反響の通電率・査定率・受託率・目標達成率・前月比・反響費用・獲得単価など
+- **歩留まりファネル**：選んだ期間に受信した売り反響・買い反響が、どこまで進んだか（数え方は[[売り反響・買い反響の歩留まり（不動産企画係）]]）
+- **年間予算進捗**：期首から選んだ月までの**売上計上額の累計**を、担当者の年間予算の合計で割ったもの。経過月数に比べて遅れていれば赤、先行していれば緑です
+  - 通期のときは、今期の12か月の合計です。先の月に契約日がある案件（契約予定）も入ります。遅れ・先行は、今月までの経過月数で比べます
+- **KPIサマリー**：担当者ごとの目標・見込の売上・達成率・契約件数・媒介獲得・未決の案件など
+  - 月を選んだときは今月目標、通期のときは年間予算と比べます
+- **架電実績**：担当者ごとの本日・今週（月曜はじまり）・今月の架電の数（売り・買い）。期間の選択に関係ありません
+- **一括査定KPIサマリー・買い反響KPIサマリー**：選んだ期間に受信した反響の通電率・査定率・受託率・目標達成率・反響費用・獲得単価など
+  - 目標受託数は、月を選んだときは年間目標の12分の1、通期のときは年間目標です。前月比は、月を選んだときだけ出します
 - **朝礼用アラート**：直近14日に商談リストへ登録された案件、新しく獲得した媒介、買取再販の期限・要対応（在庫日数・取得後2年・建物の按分）。14日を過ぎると自動で外れます
 - **営業司令塔**（最下段・押すと開く）：反響を点数で並べ、「今日やること」「ホットな反響」「停滞アラート」の3つのタブで出します。「自分の担当のみ」で絞れます。「開く」でその反響を直せます
 
diff --git a/backend/scripts/guide/articles/common/screen-245.md b/backend/scripts/guide/articles/common/screen-245.md
index d96ff1fea..a9dfe326a 100644
--- a/backend/scripts/guide/articles/common/screen-245.md
+++ b/backend/scripts/guide/articles/common/screen-245.md
@@ -12,7 +12,16 @@ summary: 売り反響・買い反響の画面の上に出るタイル・反響
 - **通期（期ごと）**：1期分（期首月は[[設定（不動産企画係）]]の値）
 - **全期間**：過去すべて
 
-開いたときは今月です。下の一覧も、選んだ期間に受信した反響になります。
+開いたときは**今期の通期**です（2026年11月から。以前は今月でした）。下の一覧も、選んだ期間に受信した反響になります。
+
+## 一覧の絞り込み
+下の反響一覧の上で、さらに絞れます。上のタイルや表は、絞り込みに関係なく、選んだ期間の全部で数えます。
+- **担当者**：「未割当」を選ぶと、担当がまだ決まっていない反響だけになります
+- **反響元**（買い反響は**ポータル**）
+- **フェーズ**
+- **検索**：売り反響は売主名か物件の所在地、買い反響は顧客名か物件・所在地の一部で探せます
+
+「条件を消す」で、絞り込みを全部はずします。反響を受信した月で絞るときは、左上の期間で月を選びます。
 
 ## 数え方（受信月コホート）
 選んだ期間に**受信した反響**が、いまどこまで進んでいるかを数えます。
diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
index eedc89724..f67be4aeb 100644
--- a/backend/scripts/guide/articles/common/screen-247.md
+++ b/backend/scripts/guide/articles/common/screen-247.md
@@ -2,7 +2,7 @@
 title: 反響から商談案件へのつながり（不動産企画係）
 section: 画面の使い方
 sort: 247
-summary: 売り反響・買い反響の段階を変えたときに媒介獲得台帳・商談案件管理へ自動で反映される動きと、商談案件管理の使い方。
+summary: 売り反響・買い反響の段階を変えたときに媒介獲得台帳・商談案件管理へ自動で反映される動きと、商談案件管理・媒介獲得台帳の使い方。
 ---
 不動産企画係の画面では、反響の段階を変えると、次の台帳や案件へ自動でつながります。以前のアプリと同じ動きです。
 
@@ -23,7 +23,12 @@ summary: 売り反響・買い反響の段階を変えたときに媒介獲得
 [[月次売上管理（不動産企画係）]] の数字のもとになる、商談案件の一覧です。
 - 1行が1案件です。成約価格・進捗フェーズ・契約日・決済予定日・リフォームの受注額と粗利は、一覧のまま直せます（自動で保存）
 - 仲介手数料は、成約価格から自動で計算します（800万円以下は30万円、それより上は価格×3％＋6万円・税抜）。手入力した額は黄色で出ます
-- 「＋ 商談案件を追加」で、案件を手で作れます。「編集」で、共同担当と売上の割合、次回アクションなども直せます
+- 「編集」で、共同担当と売上の割合、次回アクションなども直せます
+- この画面では、案件を新しく作れません。案件は必ず買い反響（「購入申込」）から作ります。どの反響から来たお客様かを、あとで辿れるようにするためです
+
+## 媒介獲得台帳
+- 媒介も、この画面では新しく作れません。必ず売り反響を「媒介受託」にして作ります。売主がどの反響から来たかを、あとで辿れるようにするためです
+- 一覧は、**媒介契約日の新しい順に、全件を1枚**で出します（ページの切り替えはありません）。媒介契約日が入っていない台帳は、いちばん下に出ます
 - 上の「担当者別サマリー」は、失注を除いた案件の数と契約率、リフォームの受注額・粗利です
 
 ### 失注にする
diff --git a/frontend/src/components/database/DatabaseBroker.tsx b/frontend/src/components/database/DatabaseBroker.tsx
index 8182609e6..beff1e02c 100644
--- a/frontend/src/components/database/DatabaseBroker.tsx
+++ b/frontend/src/components/database/DatabaseBroker.tsx
@@ -1,7 +1,7 @@
 import React, { useState, useMemo, useEffect } from 'react';
 import Modal from 'react-bootstrap/Modal';
 import apiClient from '../../utils/apiClient';
-import { dateFormate, generateNewId, parseTextWithUrl, thStyle, getReinsStatus, getPropertyStatus, getContractExpirationDate, getRemainingDays, getContractStatusInfo } from './databaseUtils';
+import { dateFormate, parseTextWithUrl, thStyle, getReinsStatus, getPropertyStatus, getContractExpirationDate, getRemainingDays, getContractStatusInfo } from './databaseUtils';
 import PropertyRegister from './PropertyRegister';
 import InformationEditResale from '../information/InformationEditResale';
 import PropertySummary from './PropertySummary';
@@ -66,8 +66,6 @@ const DatabaseBroker = () => {
 
     // === テーブル制御用のState ===
     const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
-    const [activePage, setActivePage] = useState<number>(1);
-    const [basicLength, setBasicLength] = useState<number>(20);
 
     // === モーダル制御用のState ===
     const [targetPropertyId, setTargetPropertyId] = useState<string>('');
@@ -101,11 +99,6 @@ const DatabaseBroker = () => {
         fetchData();
     }, []);
 
-    // 💡 検索条件が変更されたら、ページネーションを1ページ目に戻す
-    useEffect(() => {
-        setActivePage(1);
-    }, [searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus]);
-
     // 💡 編集ボタンを押した時に、選択された行のデータをフォームの初期値としてセットする
     useEffect(() => {
         if (targetPropertyId) {
@@ -155,7 +148,12 @@ const DatabaseBroker = () => {
                 case 'displayName': return item.seller || item.name || item.customer || '';
                 case 'displayAddress': return `${item.addr1 || ''} ${item.addr2 || ''} ${item.addr || ''}`.trim() || item.property || item.targetProperty || '';
                 case 'displayPrice': return item.price || item.budget || 0;
-                case 'date': return item.receivedDate || item.contractDate || item.created_at || '';
+                /*
+                 * ⚠️ v2.2.245: 媒介契約日（contractDate）だけで並べる。列の見出しも「媒介契約日」。
+                 *   以前は受信日・登録日を先に／代わりに見ていたため、媒介契約日が空の行（6件）が登録日の位置に混ざっていた。
+                 *   空の行は新しい順のとき最後に来る（台帳の行に受信日が入っているものは無い）。
+                 */
+                case 'date': return item.contractDate || '';
                 case 'phase': return item.phase || item.currentStatus || '';
                 case 'staff': return item.staff || '';
                 default: return '';
@@ -177,13 +175,10 @@ const DatabaseBroker = () => {
         return filtered;
     }, [originalData, sortConfig, searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus]);
 
-    // === ページネーション制御 ===
-    const totalPages = Math.ceil(processedData.length / basicLength) || 1;
-    const sliceStart = (activePage - 1) * basicLength;
-    const paginatedData = processedData.slice(sliceStart, sliceStart + basicLength);
-
-    const handlePrevPage = () => setActivePage(prev => Math.max(prev - 1, 1));
-    const handleNextPage = () => setActivePage(prev => Math.min(prev + 1, totalPages));
+    /*
+     * ⚠️ v2.2.245: ページ割りをやめ、媒介契約日の新しい順に全件を1枚で出す（制作者の要望。以前は20件ごと）。
+     *   件数が増えて重くなったら、100件ごとのページ割りに戻す（要望の第二案）。
+     */
 
     // === UIヘルパー ===
     const requestSort = (key: SortKey) => {
@@ -224,12 +219,6 @@ const DatabaseBroker = () => {
     };
 
 
-    const handleAddNew = () => {
-        const newId = generateNewId();
-        setTargetPropertyId(newId);
-        setEditData({ id: newId, kind: 'ledger' });
-    };
-
     useEffect(() => {
         if (targetPropertyId) {
             const target = originalData.find(d => d.id === targetPropertyId);
@@ -348,28 +337,14 @@ const DatabaseBroker = () => {
             <div className="d-flex justify-content-between align-items-center mb-2">
                 <div className="d-flex align-items-center gap-3">
                     <div className="fw-bold text-secondary">
-                        該当 {processedData.length} 件 <span className="fw-normal" style={{ fontSize: '12px' }}>({processedData.length > 0 ? sliceStart + 1 : 0} ~ {Math.min(activePage * basicLength, processedData.length)}件)</span>
+                        該当 {processedData.length} 件
                     </div>
-                    {/* 💡 新規追加ボタン */}
-                    <button className="btn btn-sm btn-primary rounded-pill px-3 shadow-sm fw-bold" onClick={handleAddNew}>
-                        <i className="bi bi-plus-circle me-1"></i> 媒介追加
-                    </button>
+                    {/*
+                      ⚠️ v2.2.245: 「媒介追加」を消した。媒介は必ず売り反響の「媒介受託」から作る（realty/common/leadLinks.ts の leadToLedger）。
+                        ここで作ると、売主がどの反響から来たのか分からない物件ができてしまう（制作者の要望）。
+                    */}
+                    <span className="text-muted" style={{ fontSize: '11px' }}>媒介は売り反響を「媒介受託」にすると作られます</span>
                 </div>
-
-                {/* 💡 ページネーション UI */}
-                {totalPages > 1 && (
-                    <div className="btn-group shadow-sm">
-                        <button className="btn btn-sm btn-outline-secondary bg-white" onClick={handlePrevPage} disabled={activePage === 1}>
-                            <i className="bi bi-chevron-left"></i> 前へ
-                        </button>
-                        <span className="btn btn-sm btn-light border-secondary text-dark pe-none">
-                            {activePage} / {totalPages}
-                        </span>
-                        <button className="btn btn-sm btn-outline-secondary bg-white" onClick={handleNextPage} disabled={activePage === totalPages}>
-                            次へ <i className="bi bi-chevron-right"></i>
-                        </button>
-                    </div>
-                )}
             </div>
 
             {/* === テーブルUI === */}
@@ -402,8 +377,8 @@ const DatabaseBroker = () => {
                                 </tr>
                             </thead>
                             <tbody>
-                                {paginatedData.length > 0 ? (
-                                    paginatedData.map((item, index) => {
+                                {processedData.length > 0 ? (
+                                    processedData.map((item, index) => {
                                         const displayPrice = item.price || 0;
 
                                         const rawAddress = [item.addr1, item.addr2, item.addr, item.property, item.targetProperty]
@@ -420,7 +395,7 @@ const DatabaseBroker = () => {
 
                                         return (
                                             <tr key={item.id}>
-                                                <td className="text-muted">{sliceStart + index + 1}</td>
+                                                <td className="text-muted">{index + 1}</td>
                                                 <td>
                                                     <button
                                                         className="btn btn-sm btn-outline-danger rounded-pill px-3 py-0"
diff --git a/frontend/src/components/realty/buy/LeadBuy.tsx b/frontend/src/components/realty/buy/LeadBuy.tsx
index cba5d8651..30f513cbd 100644
--- a/frontend/src/components/realty/buy/LeadBuy.tsx
+++ b/frontend/src/components/realty/buy/LeadBuy.tsx
@@ -10,12 +10,17 @@ import AuthContext from '../../../context/AuthContext';
 import { removeSpaces, safeParse, BUY_END_REASONS, BUY_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
 import { buyToDeal } from '../common/leadLinks';
 import LeadEdit from '../common/LeadEdit';
+import LeadFilterBar, { EMPTY_FILTER, matchesFilter } from '../common/LeadFilterBar';
+import type { LeadFilter } from '../common/LeadFilterBar';
 import LeadCall, { CallLog } from '../common/LeadCall';
 import DocumentViewer from '../documents/DocumentViewer';
 
 // ==========================================
 // 💡 型定義
 // ==========================================
+/** ポータルの決まった選択肢（⚠️ v2.2.245 で一覧の2か所と絞り込みに共通にした） */
+const BUY_PORTALS = ['SUUMO', 'アットホーム', "HOME'S", '自社HP', 'その他', '楽待'];
+
 type BuyLead = {
     id: string;
     receivedDate: string | null;
@@ -255,26 +260,39 @@ const LeadBuy = () => {
     /** ⚠️ v2.2.225: 期間の選択肢（以前のアプリと同じ: 月別（今期）／通期／全期間） */
     const periodOptions = useMemo(() => periodGroups(settings.fiscalStart, leads as unknown as Row[]), [settings.fiscalStart, leads]);
 
-    /** 一覧は選んだ期間に受信した反響（受信日の新しい順） */
-    const filteredLeads = useMemo(() => {
+    /** 選んだ期間に受信した反響（受信日の新しい順） */
+    const periodLeads = useMemo(() => {
         const result = period ? leads.filter(l => periodHas(period, recvMonthKey(l as unknown as Row), settings.fiscalStart)) : leads;
         return result.sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || ''));
     }, [leads, period, settings.fiscalStart]);
 
+    /** ⚠️ v2.2.245: 一覧の絞り込み（担当者・ポータル・フェーズ・顧客名か物件・所在地）。common/LeadFilterBar.tsx */
+    const [filter, setFilter] = useState<LeadFilter>(EMPTY_FILTER);
+    const filteredLeads = useMemo(() => periodLeads.filter(l => matchesFilter(filter, {
+        staff: l.staff, source: l.portal || '', phase: l.phase,
+        text: [l.name, l.targetProperty, l.addr],
+    })), [periodLeads, filter]);
+
+    /** ポータルの選択肢（決まった6つ＋実データにある値） */
+    const portalOptions = useMemo(() => {
+        const extra = Array.from(new Set(leads.map(l => l.portal || '').filter(p => p !== '' && !BUY_PORTALS.includes(p)))).sort();
+        return [...BUY_PORTALS, ...extra];
+    }, [leads]);
+
     useEffect(() => {
         setDisplayLimit(15);
-    }, [period]);
+    }, [period, filter]);
 
-    // 💡 追加: 次回アクション未設定・期限超過件数（LeadHeaderへ渡すアラート用）
+    // 💡 追加: 次回アクション未設定・期限超過件数（LeadHeaderへ渡すアラート用）。⚠️ v2.2.245: 絞り込みに関係なく期間の全件で数える
     const nextActionAlert = useMemo(() => {
         let overdue = 0, missing = 0;
-        for (const l of filteredLeads) {
+        for (const l of periodLeads) {
             if (l.phase === '追客終了') continue;
             if (!l.nextDate) { missing++; continue; }
             if (l.nextDate.replace(/\//g, '-') < today) overdue++;
         }
         return { overdue, missing };
-    }, [filteredLeads, today]);
+    }, [periodLeads, today]);
 
     /**
      * brokerage_listings の1行を部分更新する。
@@ -541,6 +559,18 @@ const LeadBuy = () => {
                     <span style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#e9ecef', borderRadius: '12px', color: '#6c757d' }}>{filteredLeads.length} 件</span>
                 </div>
 
+                <LeadFilterBar
+                    value={filter}
+                    onChange={setFilter}
+                    staffOptions={staffList}
+                    sourceOptions={portalOptions}
+                    phaseOptions={BUY_PHASES}
+                    sourceLabel="ポータル"
+                    searchPlaceholder="顧客名・物件・所在地"
+                    shown={filteredLeads.length}
+                    total={periodLeads.length}
+                />
+
                 <div style={{ overflowX: 'auto' }}>
                     <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                         <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
@@ -572,7 +602,7 @@ const LeadBuy = () => {
                                     <td style={getTdStyle(false)}>
                                         <select style={compactInputStyle} defaultValue="" ref={newPortalRef}>
                                             <option value="">ポータル</option>
-                                            {['SUUMO', 'アットホーム', "HOME'S", '自社HP', 'その他', '楽待'].map(p => <option key={p} value={p}>{p}</option>)}
+                                            {BUY_PORTALS.map(p => <option key={p} value={p}>{p}</option>)}
                                         </select>
                                     </td>
                                     <td style={getTdStyle(false)}>
@@ -624,7 +654,7 @@ const LeadBuy = () => {
                                                     onBlur={(e) => handleApiUpdate(lead.id, 'portal', e.target.value)}
                                                 >
                                                     <option value="">ポータル</option>
-                                                    {['SUUMO', 'アットホーム', "HOME'S", '自社HP', 'その他', '楽待'].map(p => <option key={p} value={p}>{p}</option>)}
+                                                    {BUY_PORTALS.map(p => <option key={p} value={p}>{p}</option>)}
                                                 </select>
                                             </td>
                                             <td style={getTdStyle(isUnassigned)} className="fw-bold">
diff --git a/frontend/src/components/realty/common/leadFunnel.ts b/frontend/src/components/realty/common/leadFunnel.ts
index 12f7f65c7..5f3241df9 100644
--- a/frontend/src/components/realty/common/leadFunnel.ts
+++ b/frontend/src/components/realty/common/leadFunnel.ts
@@ -8,7 +8,7 @@
  * 期間（P）: 'm:YYYY-MM'（単月）・'fy:YYYY-MM'（通期。期首月）・'all'（全期間）
  * 受信月コホート基準（その期間に受信した反響が、どこまで進んだか）。架電だけは「その期間にした架電」（📞のみ）。
  */
-import { callStats, callsOf, fiscalMonths, monthLabel, todayStr } from '../summary/kpi';
+import { callStats, callsOf, fiscalMonths, monthLabel } from '../summary/kpi';
 import type { Row } from '../summary/kpi';
 
 export type Period = string;
@@ -75,12 +75,11 @@ export const periodGroups = (fiscalStart: string | undefined, rows: Row[]): Peri
     ];
 };
 
-/** 既定の期間: 今月（今期に無ければ期首月） */
-export const defaultPeriod = (fiscalStart: string | undefined): Period => {
-    const months = fiscalMonths(fiscalStart);
-    const cur = todayStr().slice(0, 7);
-    return `m:${months.includes(cur) ? cur : months[0]}`;
-};
+/**
+ * 既定の期間: 今期の通期（期首月からの12か月）。
+ * ⚠️ v2.2.245: 以前は今月だった。制作者の要望「基本は通期を表示し、月は絞り込みのプルダウンで」で通期にした。
+ */
+export const defaultPeriod = (fiscalStart: string | undefined): Period => `fy:${fiscalMonths(fiscalStart)[0]}`;
 
 /** 架電の種類（callType）。⚠️ type が無い・知らない値は「架電」 */
 const callType = (c: unknown): 'call' | 'line' | 'mail' => {
diff --git a/frontend/src/components/realty/deals/LeadOpportunity.tsx b/frontend/src/components/realty/deals/LeadOpportunity.tsx
index 52db9a62e..5f4853f35 100644
--- a/frontend/src/components/realty/deals/LeadOpportunity.tsx
+++ b/frontend/src/components/realty/deals/LeadOpportunity.tsx
@@ -5,7 +5,7 @@ import DocumentViewer from '../documents/DocumentViewer';
 import PlannerGenerator, { PlannerInputState } from '../documents/PlannerGenerator';
 import LeadNotifications from '../common/LeadNotifications';
 import {
-    saveBrokerageRecord, recordFieldChanges, softDeleteRecord, newRecordId,
+    saveBrokerageRecord, recordFieldChanges, softDeleteRecord,
     DEAL_PHASES, DEAL_LOST_REASONS, NEXT_EXEMPT,
 } from '../common/leadUtiles';
 import { loadRecords } from '../common/realtyState';
@@ -20,10 +20,10 @@ import type { Row } from '../summary/kpi';
  *   v2.2.243 までは媒介台帳と買い反響をフェーズで絞って出しており、商談案件そのもの（67件）が1件も出ていなかった。
  *   月次売上・失注分析は商談案件で数えるので、ここで直した値がそのまま集計に出る。
  *
- * ⚠️ 案件は次の3つでできる。
- *   ・この画面の「＋ 商談案件を追加」
+ * ⚠️⚠️ **案件は必ず反響からできる。この画面では作れない**（v2.2.245 で「＋ 商談案件を追加」を消した。制作者の要望）。
+ *   ここで作ると、売主・買主がどの反響から来たのか分からない案件ができてしまうため。
  *   ・買い反響を「購入申込」にしたときの転記（common/leadLinks.ts の buyToDeal）
- *   ・媒介台帳の買付登録（⚠️ まだ移していない。v2.2.245 以降）
+ *   ・媒介台帳の買付登録（⚠️ まだ移していない。v2.2.246 の予定）
  * ⚠️ 失注にするときは失注理由が必須（lostReason・lostDate・lostNote。2026-11-04_realty_deal_lost.sql で列にした）。
  * ⚠️ 仲介手数料は成約価格から自動計算（800万円以下＝30万円／超＝3%＋6万円・税抜。kpi.ts の stdFee）。手入力した額があればそちら（feeManual）。
  * ⚠️ 削除は論理削除（show_dashboard = 0）。以前のアプリは消していた。
@@ -94,7 +94,7 @@ const LeadOpportunity = () => {
     const [hideSettled, setHideSettled] = useState(true);
     const [showReform, setShowReform] = useState(true);
 
-    /** 編集中（null は閉じている）。editingId が空なら新規 */
+    /** 編集中（null は閉じている） */
     const [form, setForm] = useState<Form | null>(null);
     const [editingId, setEditingId] = useState('');
 
@@ -168,15 +168,9 @@ const LeadOpportunity = () => {
         void patchDeal(str(d.id), { phase: next });
     };
 
-    const openEdit = (d: Row | null, preset: Partial<Form> = {}) => {
-        if (d) {
-            setEditingId(str(d.id));
-            setForm({ ...formOf(d), ...preset });
-        } else {
-            const no = Math.max(0, ...deals.map(x => num(x.no))) + 1;
-            setEditingId('');
-            setForm({ ...formOf({ no, type: '売', phase: '初回接触' }), ...preset });
-        }
+    const openEdit = (d: Row, preset: Partial<Form> = {}) => {
+        setEditingId(str(d.id));
+        setForm({ ...formOf(d), ...preset });
     };
 
     const patchForm = (p: Partial<Form>) => setForm(prev => (prev ? { ...prev, ...p } : prev));
@@ -213,20 +207,7 @@ const LeadOpportunity = () => {
         // ⚠️ 手入力の額が規定の計算と同じなら自動計算に戻す（以前のアプリと同じ）
         if (fields.feeManual && stdFee(price) === fields.fee) { fields.feeManual = false; fields.fee = null; }
 
-        if (editingId) {
-            if (await patchDeal(editingId, fields)) setForm(null);
-            return;
-        }
-        const id = newRecordId();
-        const row: Row = { id, kind: 'deals', priority: '', createdAt: today, ...fields };
-        try {
-            await saveBrokerageRecord(id, row);
-            setDeals(prev => [...prev, row]);
-            setForm(null);
-        } catch (e) {
-            console.error('[LeadOpportunity] 商談案件の追加に失敗しました', row, e);
-            alert('商談案件を追加できませんでした。もう一度お試しください。');
-        }
+        if (await patchDeal(editingId, fields)) setForm(null);
     };
 
     const deleteDeal = async () => {
@@ -345,9 +326,8 @@ const LeadOpportunity = () => {
                 </div>
                 <div className="d-flex align-items-center gap-2 mt-3 mt-md-0">
                     <LeadNotifications />
-                    <button className="btn btn-primary btn-sm fw-bold" style={{ fontSize: '12px' }} onClick={() => openEdit(null)}>
-                        ＋ 商談案件を追加
-                    </button>
+                    {/* ⚠️ v2.2.245: 「＋ 商談案件を追加」は消した（案件は反響から作る。上の注記） */}
+                    <span className="text-muted" style={{ fontSize: '11px' }}>案件は買い反響を「購入申込」にすると作られます</span>
                 </div>
             </div>
 
@@ -498,7 +478,7 @@ const LeadOpportunity = () => {
 
             <Modal show={form !== null} onHide={() => setForm(null)} size="lg" centered>
                 <Modal.Header closeButton>
-                    <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>{editingId ? '商談案件を編集' : '商談案件を追加'}</Modal.Title>
+                    <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>商談案件を編集</Modal.Title>
                 </Modal.Header>
                 {form && (
                     <Modal.Body style={{ fontSize: '12px' }}>
@@ -579,7 +559,7 @@ const LeadOpportunity = () => {
                     </Modal.Body>
                 )}
                 <Modal.Footer>
-                    {editingId && <button className="btn btn-outline-danger btn-sm me-auto" onClick={() => void deleteDeal()}>削除</button>}
+                    <button className="btn btn-outline-danger btn-sm me-auto" onClick={() => void deleteDeal()}>削除</button>
                     <button className="btn btn-light border btn-sm" onClick={() => setForm(null)}>キャンセル</button>
                     <button className="btn btn-primary btn-sm fw-bold" onClick={() => void saveForm()}>保存</button>
                 </Modal.Footer>
diff --git a/frontend/src/components/realty/sell/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
index f0ae967db..097bf3bb0 100644
--- a/frontend/src/components/realty/sell/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -10,6 +10,8 @@ import AuthContext from '../../../context/AuthContext';
 import { removeSpaces, safeParse, LEAD_END_REASONS, LEAD_PHASES, askEndReason, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
 import { askBaikaiDate, linkLedgerAfterEdit, linkLedgerWithNotice } from '../common/leadLinks';
 import LeadEdit from '../common/LeadEdit';
+import LeadFilterBar, { EMPTY_FILTER, matchesFilter } from '../common/LeadFilterBar';
+import type { LeadFilter } from '../common/LeadFilterBar';
 import LeadCall, { CallLog } from '../common/LeadCall';
 import DocumentViewer from '../documents/DocumentViewer';
 import { openNavi } from '../navi/naviHost';
@@ -269,26 +271,39 @@ const LeadSell = () => {
   /** ⚠️ v2.2.225: 期間の選択肢（以前のアプリと同じ: 月別（今期）／通期／全期間） */
   const periodOptions = useMemo(() => periodGroups(settings.fiscalStart, leads as unknown as Row[]), [settings.fiscalStart, leads]);
 
-  /** 一覧は選んだ期間に受信した反響（受信日の新しい順） */
-  const filteredLeads = useMemo(() => {
+  /** 選んだ期間に受信した反響（受信日の新しい順） */
+  const periodLeads = useMemo(() => {
     const result = period ? leads.filter(l => periodHas(period, recvMonthKey(l as unknown as Row), settings.fiscalStart)) : leads;
     return result.sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || ''));
   }, [leads, period, settings.fiscalStart]);
 
+  /** ⚠️ v2.2.245: 一覧の絞り込み（担当者・反響元・フェーズ・売主名か所在地）。common/LeadFilterBar.tsx */
+  const [filter, setFilter] = useState<LeadFilter>(EMPTY_FILTER);
+  const filteredLeads = useMemo(() => periodLeads.filter(l => matchesFilter(filter, {
+    staff: l.staff, source: l.source || l.portal || '', phase: l.phase,
+    text: [l.seller, l.name, l.addr, l.addr1, l.addr2],
+  }, 'リード受信')), [periodLeads, filter]);
+
+  /** 反響元の選択肢（決まった5つ＋実データにある値） */
+  const sourceOptions = useMemo(() => {
+    const extra = Array.from(new Set(leads.map(l => l.source || l.portal || '').filter(s => s !== '' && !SELL_SOURCES.includes(s)))).sort();
+    return [...SELL_SOURCES, ...extra];
+  }, [leads]);
+
   useEffect(() => {
     setDisplayLimit(15);
-  }, [period]);
+  }, [period, filter]);
 
   // 💡 追加: 次回アクション未設定・期限超過件数（LeadHeaderへ渡すアラート用）
   const nextActionAlert = useMemo(() => {
     let overdue = 0, missing = 0;
-    for (const l of filteredLeads) {
+    for (const l of periodLeads) {
       if (l.phase === '追客終了') continue;
       if (!l.nextDate) { missing++; continue; }
       if (l.nextDate.replace(/\//g, '-') < today) overdue++;
     }
     return { overdue, missing };
-  }, [filteredLeads, today]);
+  }, [periodLeads, today]);
 
 
   /**
@@ -630,6 +645,18 @@ const LeadSell = () => {
           <span style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#e9ecef', borderRadius: '12px', color: '#6c757d' }}>{filteredLeads.length} 件</span>
         </div>
 
+        <LeadFilterBar
+          value={filter}
+          onChange={setFilter}
+          staffOptions={staffList}
+          sourceOptions={sourceOptions}
+          phaseOptions={LEAD_PHASES}
+          sourceLabel="反響元"
+          searchPlaceholder="売主名・物件所在地"
+          shown={filteredLeads.length}
+          total={periodLeads.length}
+        />
+
         <div style={{ overflowX: 'auto' }}>
           <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
             <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
diff --git a/frontend/src/components/realty/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
index a82bcfae0..022665d27 100644
--- a/frontend/src/components/realty/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -1,4 +1,4 @@
-import React, { useState, useEffect, useMemo, useContext } from 'react';
+import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
 import apiClient from '../../../utils/apiClient';
 import LeadHeader from '../common/LeadHeader'; // パスは環境に合わせて調整してください
 import { thisYear } from '../../../utils/thisYear';
@@ -94,6 +94,9 @@ const parseCallDates = (raw: string | null | undefined): CallEntry[] => {
  * また「対象月に受信したリード」ではなく「対象月に行われた架電」を数えるため、
  * 全リードを走査して架電日の年月で絞り込む。
  */
+/** 期間の選択で「今期の通期」を表す値（v2.2.245） */
+const FY = 'fy';
+
 const countCalls = (leads: { callDates: string | null }[], month: string) =>
     leads.reduce((total, lead) => total + parseCallDates(lead.callDates).filter(c => {
         const type = c?.type ? String(c.type) : 'call';
@@ -172,7 +175,11 @@ const Summary = () => {
     const [staffList, setStaffList] = useState<string[]>([]);
     const [settings, setSettings] = useState<AppSettings>({});
     // ⚠️ v2.2.222: 既定は今月（以前は 2026-07 で固定だった）
-    const [selectedMonth, setSelectedMonth] = useState<string>(() => todayStr().slice(0, 7));
+    /**
+     * 選んだ期間。⚠️ v2.2.245: 'fy'（今期の通期＝期首月からの12か月）か 'YYYY-MM'（今期の月）。既定は通期
+     *   （制作者の要望「基本は通期を表示し、月は絞り込みのプルダウンで」）。以前は今月だけだった。
+     */
+    const [selectedMonth, setSelectedMonth] = useState<string>(FY);
 
     // 💡 顧客情報編集モーダル（LeadSell / LeadBuy と同じ LeadEdit を共用する）
     const [isEditModalOpen, setIsEditModalOpen] = useState(false);
@@ -284,6 +291,20 @@ const Summary = () => {
         }
     };
 
+    /**
+     * 今期の12か月（設定の期首月から）。⚠️ v2.2.222: 本番アプリと同じく、月は今期の中だけを選ばせる
+     *   （年間予算の進捗は期首から対象月までの累計なので、期をまたぐ月は選ばせない）。
+     */
+    const fyMonths = useMemo(() => fiscalMonths(settings.fiscalStart), [settings.fiscalStart]);
+    const isFy = selectedMonth === FY;
+    /** 選んだ期間の月（通期は今期の12か月） */
+    const selMonths = useMemo(() => (isFy ? fyMonths : [selectedMonth]), [isFy, fyMonths, selectedMonth]);
+    /** その日付（受信日など）が選んだ期間に入るか。⚠️ 'YYYY/MM/DD' もある */
+    const inSel = useCallback((d: string | null | undefined) => selMonths.includes(String(d ?? '').replace(/\//g, '-').slice(0, 7)), [selMonths]);
+    /** 今期の範囲（'2026年6月〜2027年5月'） */
+    const fyRange = `${monthLabel(fyMonths[0])}〜${monthLabel(fyMonths[11])}`;
+    const selLabel = isFy ? `${fyRange}の通期` : monthLabel(selectedMonth);
+
     // ==========================================
     // 💡 3. 歩留まりファネル集計
     // ==========================================
@@ -294,7 +315,7 @@ const Summary = () => {
         };
 
         // 売りファネル
-        const targetSell = leads.filter(l => l.receivedDate?.startsWith(selectedMonth));
+        const targetSell = leads.filter(l => inSel(l.receivedDate));
         result.sell.leads = targetSell.length;
         targetSell.forEach(l => {
             if (l.connectDate || ['通電済', '訪問査定予定', '訪問査定済', '査定書提出', '媒介受託'].includes(l.phase || '')) result.sell.connects++;
@@ -304,7 +325,7 @@ const Summary = () => {
         });
 
         // 買いファネル
-        const targetBuy = buyLeads.filter(l => l.receivedDate?.startsWith(selectedMonth));
+        const targetBuy = buyLeads.filter(l => inSel(l.receivedDate));
         result.buy.leads = targetBuy.length;
         targetBuy.forEach(l => {
             if (l.connectDate || ['通電済', '内見予約', '内見済', '購入申込', '成約'].includes(l.phase || '')) result.buy.connects++;
@@ -314,7 +335,7 @@ const Summary = () => {
         });
 
         return result;
-    }, [leads, buyLeads, selectedMonth]);
+    }, [leads, buyLeads, inSel]);
 
 
     // ==========================================
@@ -324,12 +345,15 @@ const Summary = () => {
      * 対象月の選択肢。⚠️ v2.2.222: 本番アプリと同じく「今期の12か月」（設定の期首月から）。
      *   年間予算の進捗は期首から対象月までの累計なので、期をまたぐ月は選ばせない。
      */
-    const fyMonths = useMemo(() => fiscalMonths(settings.fiscalStart), [settings.fiscalStart]);
-    const availableMonths = useMemo(() => [...fyMonths].reverse(), [fyMonths]);
-    // 期首月が届いたら、今期に無い月（初期値の今月が期外のときなど）を期首月へ寄せる
+    /** ⚠️ v2.2.245: 通期を先頭にした選択肢（LeadHeader の periodGroups の形） */
+    const periodOptions = useMemo(() => [
+        { label: '通期', options: [{ value: FY, label: `通期（${fyRange}）` }] },
+        { label: '月別（今期）', options: [...fyMonths].reverse().map(mk => ({ value: mk, label: monthLabel(mk) })) },
+    ], [fyMonths, fyRange]);
+    // 期首月が届いたら、今期に無い月を通期へ戻す
     useEffect(() => {
-        if (settings.fiscalStart && !fyMonths.includes(selectedMonth)) setSelectedMonth(fyMonths[0]);
-    }, [fyMonths, settings.fiscalStart, selectedMonth]);
+        if (settings.fiscalStart && !isFy && !fyMonths.includes(selectedMonth)) setSelectedMonth(FY);
+    }, [fyMonths, settings.fiscalStart, selectedMonth, isFy]);
 
     const headerLabel = { title: 'チームサマリー', describe: '本日のタスク、追客予定、月次KPI、架電実績' };
 
@@ -339,10 +363,14 @@ const Summary = () => {
      *   担当者と目標・予算は設定（app_state.settings.staff）。
      */
     const kpi = useMemo(() => {
-        const tm = selectedMonth;
         const staffSettings = (settings.staff ?? []).filter(st => st.name);
         const names = staffSettings.map(st => String(st.name));
-        const cumMks = fyMonths.includes(tm) ? fyMonths.slice(0, fyMonths.indexOf(tm) + 1) : [tm];
+        /**
+         * 累計の月。月を選んだときは期首〜その月。⚠️ v2.2.245: 通期は今期の12か月（先の月の契約予定＝見込も入る）。
+         *   経過月数（遅れ・先行の判定）は、通期では今月までで数える。
+         */
+        const cumMks = isFy ? fyMonths : fyMonths.includes(selectedMonth) ? fyMonths.slice(0, fyMonths.indexOf(selectedMonth) + 1) : [selectedMonth];
+        const nowMk = todayStr().slice(0, 7);
 
         const salesAll = salesByStaffMonth(deals);
         const feeAll = feeByStaffMonth(deals);
@@ -357,7 +385,7 @@ const Summary = () => {
         const sumCum = (all: Record<string, Record<string, number>>) => names.reduce((a, n) => a + sumRow(all[n], cumMks), 0);
         const cum = sumCum(salesAll);
         const prog = totalBudget ? cum / totalBudget : 0;
-        const elapsed = cumMks.length;
+        const elapsed = isFy ? Math.max(1, fyMonths.filter(mk => mk <= nowMk).length) : cumMks.length;
 
         const rows = staffSettings.map(st => {
             const n = String(st.name);
@@ -365,16 +393,17 @@ const Summary = () => {
             const dCon = dAll.filter(d => CONFIRMED.includes(String(d.phase ?? '')));
             return {
                 name: n,
-                goal: Number(st.monthlyGoal) || 0,
+                // ⚠️ 通期の目標は年間予算
+                goal: isFy ? Number(st.budget) || 0 : Number(st.monthlyGoal) || 0,
                 budget: Number(st.budget) || 0,
-                sales: salesAll[n]?.[tm] ?? 0,
-                fee: feeAll[n]?.[tm] ?? 0,
-                reformGp: rgAll[n]?.[tm] ?? 0,
-                reform: rfAll[n]?.[tm] ?? 0,
+                sales: sumRow(salesAll[n], selMonths),
+                fee: sumRow(feeAll[n], selMonths),
+                reformGp: sumRow(rgAll[n], selMonths),
+                reform: sumRow(rfAll[n], selMonths),
                 deals: dAll.length,
                 confirmed: dCon.length,
-                contracts: cntAll[n]?.[tm] ?? 0,
-                baikai: bCnt[n]?.[tm] ?? 0,
+                contracts: sumRow(cntAll[n], selMonths),
+                baikai: sumRow(bCnt[n], selMonths),
                 pending: dAll.length - dCon.length,
                 cumSales: sumRow(salesAll[n], cumMks),
             };
@@ -388,9 +417,9 @@ const Summary = () => {
         return {
             rows, total, totalBudget, cum, prog, elapsed, paceGap: prog - elapsed / 12,
             cumFee: sumCum(feeAll), cumRf: sumCum(rfAll), cumRg: sumCum(rgAll),
-            fromMonth: cumMks[0], hasStaff: staffSettings.length > 0,
+            fromMonth: cumMks[0], toMonth: cumMks[cumMks.length - 1], hasStaff: staffSettings.length > 0,
         };
-    }, [deals, ledger, settings.staff, selectedMonth, fyMonths]);
+    }, [deals, ledger, settings.staff, selectedMonth, fyMonths, isFy, selMonths]);
 
     /** 📞 架電実績（v2.2.222。本番アプリの callStats と同じ。実日付で本日・今週・今月） */
     const calls = useMemo(() => {
@@ -435,7 +464,7 @@ const Summary = () => {
     // ==========================================
     const sellKpiSummary = useMemo(() => {
         const target = funnelData.sell;                       // リード数・通電・査定・受託は歩留まりファネルと同じ集計
-        const monthLeads = leads.filter(l => l.receivedDate?.startsWith(selectedMonth));
+        const monthLeads = leads.filter(l => inSel(l.receivedDate));
 
         // 反響費用 = 対象月に受信したリードの反響単価の合計
         const srcCosts = settings.srcCosts || {};
@@ -444,54 +473,56 @@ const Summary = () => {
         // 月次の媒介受託目標 = 担当者ごとの年間目標の合計 ÷ 12
         const annualTarget = (settings.staff || []).reduce((sum, st) => sum + (Number(st.baikaiTarget) || 0), 0);
 
-        // 前月比受託数
+        // 前月比受託数（⚠️ 通期では出さない）
         const prev = prevMonth(selectedMonth);
-        const prevWins = leads.filter(l => l.receivedDate?.startsWith(prev) && l.phase === '媒介受託').length;
+        const prevWins = isFy ? 0 : leads.filter(l => l.receivedDate?.startsWith(prev) && l.phase === '媒介受託').length;
 
         return {
             leads: target.leads,
-            calls: countCalls(leads, selectedMonth),
+            calls: selMonths.reduce((t, mk) => t + countCalls(leads, mk), 0),
             connects: target.connects,
             visits: target.visits,
             wins: target.wins,
-            target: Math.round(annualTarget / 12),
-            lastMonthDiff: target.wins - prevWins,
+            // ⚠️ 通期は年間の目標そのもの
+            target: Math.round(annualTarget / 12 * selMonths.length),
+            lastMonthDiff: isFy ? null : target.wins - prevWins,
             cost,
         };
-    }, [leads, funnelData, selectedMonth, settings]);
+    }, [leads, funnelData, selectedMonth, settings, inSel, isFy, selMonths]);
 
     const buyKpiSummary = useMemo(() => {
         const target = funnelData.buy;
-        const monthLeads = buyLeads.filter(l => l.receivedDate?.startsWith(selectedMonth));
+        const monthLeads = buyLeads.filter(l => inSel(l.receivedDate));
 
         // 買いリードの反響元は source ではなく portal に入っている
         const portalCosts = settings.portalCosts || {};
         const cost = monthLeads.reduce((sum, l) => sum + (Number(portalCosts[l.portal]) || 0), 0);
 
-        // 前月比申込数
+        // 前月比申込数（⚠️ 通期では出さない）
         const prev = prevMonth(selectedMonth);
-        const prevOffers = buyLeads.filter(l =>
+        const prevOffers = isFy ? 0 : buyLeads.filter(l =>
             l.receivedDate?.startsWith(prev) && ['購入申込', '成約'].includes(l.phase || '')
         ).length;
 
         return {
             leads: target.leads,
-            calls: countCalls(buyLeads, selectedMonth),
+            calls: selMonths.reduce((t, mk) => t + countCalls(buyLeads, mk), 0),
             connects: target.connects,
             views: target.views,
             offers: target.offers,
             wins: target.wins,
-            lastMonthDiff: target.offers - prevOffers,
+            lastMonthDiff: isFy ? null : target.offers - prevOffers,
             cost,
         };
-    }, [buyLeads, funnelData, selectedMonth, settings]);
+    }, [buyLeads, funnelData, selectedMonth, settings, inSel, isFy, selMonths]);
 
     return (
         <div style={{ padding: '20px', backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>
             <LeadHeader
                 selectedMonth={selectedMonth}
                 setSelectedMonth={setSelectedMonth}
-                availableMonths={availableMonths}
+                availableMonths={[]}
+                periodGroups={periodOptions}
                 handleAddClick={() => { }}
                 isAdding={false}
                 headerLabel={headerLabel}
@@ -506,7 +537,7 @@ const Summary = () => {
                     ========================================== */}
                     <div style={s.card}>
                         <div style={s.cardTitle}>
-                            🔻 歩留まりファネル（{selectedMonth.replace('-', '年')}月受信分）
+                            🔻 歩留まりファネル（{selLabel}受信分）
                             <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
                                 カッコ内は直前の段からの移行率
                             </span>
@@ -594,7 +625,7 @@ const Summary = () => {
                             <div style={{ width: `${Math.min(100, kpi.prog * 100)}%`, height: '100%', backgroundColor: kpi.paceGap < 0 ? '#dc3545' : '#198754' }}></div>
                         </div>
                         <div style={{ fontSize: '11px', color: '#495057', marginTop: '8px' }}>
-                            内訳（{monthLabel(kpi.fromMonth)}〜{monthLabel(selectedMonth)}累計）：仲介手数料 <b>{fmtYen(kpi.cumFee)}</b> ＋ リフォーム粗利 <b>{fmtYen(kpi.cumRg)}</b> ＝ 売上計上額 <b>{fmtYen(kpi.cum)}</b>
+                            内訳（{monthLabel(kpi.fromMonth)}〜{monthLabel(kpi.toMonth)}累計{isFy ? '・先の月の契約予定を含む' : ''}）：仲介手数料 <b>{fmtYen(kpi.cumFee)}</b> ＋ リフォーム粗利 <b>{fmtYen(kpi.cumRg)}</b> ＝ 売上計上額 <b>{fmtYen(kpi.cum)}</b>
                             <span style={{ color: '#6c757d', marginLeft: '6px' }}>
                                 ※リフォームは受注額ではなく粗利を売上に計上します（受注額 {fmtYen0(kpi.cumRf)}・粗利率 {kpi.cumRf ? pct(kpi.cumRg / kpi.cumRf) : '―'} は参考値）
                             </span>
@@ -609,7 +640,7 @@ const Summary = () => {
                     ========================================== */}
                     <div style={s.card}>
                         <div style={s.cardTitle}>
-                            月次KPIサマリー（{monthLabel(selectedMonth)}）
+                            {isFy ? '通期' : '月次'}KPIサマリー（{selLabel}）
                             <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
                                 灰色＝自動集計。<b>売上計上額＝仲介手数料＋リフォーム粗利</b>（リフォーム受注額は参考値）。商談案件の契約日ベース・共同担当は按分。
                             </span>
@@ -619,16 +650,16 @@ const Summary = () => {
                                 <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                     <tr>
                                         <th style={{ ...s.th, textAlign: 'left' }}>担当者</th>
-                                        <th style={s.th}>今月目標<br/>売上(円)</th>
-                                        <th style={s.th}>今月見込<br/>売上(円)</th>
+                                        <th style={s.th}>{isFy ? '年間予算' : '今月目標'}<br/>売上(円)</th>
+                                        <th style={s.th}>{isFy ? '通期' : '今月'}見込<br/>売上(円)</th>
                                         <th style={s.th}>達成率</th>
                                         <th style={s.th}>うち仲介<br/>手数料(円)</th>
                                         <th style={s.th}>うちリフォーム<br/>粗利(円)</th>
                                         <th style={s.th}>リフォーム<br/>受注額(円)<br/><span style={{ fontWeight: 'normal' }}>※参考</span></th>
                                         <th style={s.th}>案件数<br/>(累計)</th>
-                                        <th style={s.th}>今月<br/>契約件数</th>
+                                        <th style={s.th}>{isFy ? '通期' : '今月'}<br/>契約件数</th>
                                         <th style={s.th}>契約率</th>
-                                        <th style={s.th}>今月<br/>媒介獲得</th>
+                                        <th style={s.th}>{isFy ? '通期' : '今月'}<br/>媒介獲得</th>
                                         <th style={s.th}>未決<br/>案件数</th>
                                         <th style={s.th}>年間予算<br/>進捗率</th>
                                     </tr>
@@ -735,7 +766,7 @@ const Summary = () => {
                     ========================================== */}
                     <div style={s.card}>
                         <div style={s.cardTitle}>
-                            一括査定KPIサマリー（{monthLabel(selectedMonth)}受信リード・チーム合計）
+                            一括査定KPIサマリー（{selLabel}受信リード・チーム合計）
                             <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>売り反響から自動集計</span>
                         </div>
                         <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
@@ -748,7 +779,7 @@ const Summary = () => {
                                 </thead>
                                 <tbody>
                                     {sellKpiSummary.leads === 0 && sellKpiSummary.calls === 0 ? (
-                                        <tr><td colSpan={14} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>{monthLabel(selectedMonth)}受信のリードはまだ登録されていません</td></tr>
+                                        <tr><td colSpan={14} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>{selLabel}受信のリードはまだ登録されていません</td></tr>
                                     ) : (
                                         <tr>
                                             <td style={s.td}>{sellKpiSummary.leads}</td>
@@ -762,7 +793,7 @@ const Summary = () => {
                                             <td style={s.td}>{calcRate(sellKpiSummary.wins, sellKpiSummary.visits)}</td>
                                             <td style={{ ...s.td, backgroundColor: '#fff8e1' }}>{sellKpiSummary.target}</td>
                                             <td style={s.td}>{calcRate(sellKpiSummary.wins, sellKpiSummary.target)}</td>
-                                            <td style={s.td}>{sellKpiSummary.lastMonthDiff >= 0 ? '+' : ''}{sellKpiSummary.lastMonthDiff}</td>
+                                            <td style={s.td}>{sellKpiSummary.lastMonthDiff === null ? '―' : `${sellKpiSummary.lastMonthDiff >= 0 ? '+' : ''}${sellKpiSummary.lastMonthDiff}`}</td>
                                             <td style={s.td}>{fmtYen0(sellKpiSummary.cost)}</td>
                                             <td style={s.td}>{sellKpiSummary.wins && sellKpiSummary.cost ? fmtYen(Math.round(sellKpiSummary.cost / sellKpiSummary.wins)) : '―'}</td>
                                         </tr>
@@ -774,7 +805,7 @@ const Summary = () => {
 
                     <div style={s.card}>
                         <div style={s.cardTitle}>
-                            買い反響KPIサマリー（{monthLabel(selectedMonth)}受信・チーム合計）
+                            買い反響KPIサマリー（{selLabel}受信・チーム合計）
                             <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>買い反響から自動集計</span>
                         </div>
                         <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
@@ -787,7 +818,7 @@ const Summary = () => {
                                 </thead>
                                 <tbody>
                                     {buyKpiSummary.leads === 0 && buyKpiSummary.calls === 0 ? (
-                                        <tr><td colSpan={12} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>{monthLabel(selectedMonth)}受信の買い反響はまだ登録されていません</td></tr>
+                                        <tr><td colSpan={12} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>{selLabel}受信の買い反響はまだ登録されていません</td></tr>
                                     ) : (
                                         <tr>
                                             <td style={s.td}>{buyKpiSummary.leads}</td>
@@ -799,7 +830,7 @@ const Summary = () => {
                                             <td style={s.td}>{buyKpiSummary.offers}</td>
                                             <td style={s.td}>{calcRate(buyKpiSummary.offers, buyKpiSummary.leads)}</td>
                                             <td style={s.td}>{buyKpiSummary.wins}</td>
-                                            <td style={s.td}>{buyKpiSummary.lastMonthDiff >= 0 ? '+' : ''}{buyKpiSummary.lastMonthDiff}</td>
+                                            <td style={s.td}>{buyKpiSummary.lastMonthDiff === null ? '―' : `${buyKpiSummary.lastMonthDiff >= 0 ? '+' : ''}${buyKpiSummary.lastMonthDiff}`}</td>
                                             <td style={s.td}>{fmtYen0(buyKpiSummary.cost)}</td>
                                             <td style={s.td}>{buyKpiSummary.offers && buyKpiSummary.cost ? fmtYen(Math.round(buyKpiSummary.cost / buyKpiSummary.offers)) : '―'}</td>
                                         </tr>
````
