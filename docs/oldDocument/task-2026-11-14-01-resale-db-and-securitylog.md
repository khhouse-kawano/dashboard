# v2.2.269 中古の顧客DBが開けない（メモリ不足）・セキュリティログが重い

日付：2026-11-14　ブランチ：v2.2.269

## 依頼
- DatabaseResale.tsx が容量オーバーでレンダリングできない（① のエラー：`database_used.php:90 Allowed memory size of 268435456 bytes exhausted (tried to allocate 57589760 bytes)`）。
- セキュリティログは最初に2,000行を全部描いて落ちる。例えば100件ずつ表示し、スクロール位置を検知して次の100件を表示する。
- 方針を示して「この方針で進める」の回答を得た。

## 原因
- 中古の顧客DB（request: database / category: used）は ① の PHP だけが処理している（② には移植していない）。
  - 返事は約56MB：call（call_sheet 全件・全事業 19,165行）約41MB、broker（brokerage_listings 全種類）約9MB、family（全項目）約2MB、customer 約1.7MB。
  - json_encode の途中で memory_limit 256M を超えていた。画面は20件ずつ描いており、描画ではなく受け取るデータが原因。
- 画面が使うのは：call は中古の顧客の call_log の「通電」「架電」「次回架電日」の day だけ／family は id だけ／broker は kind = ledger・show_dashboard = 1・master_data_id ありだけ。
- セキュリティログは ② が新しい順に最大2,000行を返し、画面が全行を描いていた。

## 変えたもの
- `backend/src/handlers/databaseAction/database_used.php`
  - 架電情報：`call_sheet` を `master_data_resale` と JOIN（削除済み除く）。call_log を3種類の `{ day, action }` だけに絞って JSON 文字列で返す（形 `{ id, call_log }` は変えない）。行ごとに fetch して組み立てる（全件を一度に持たない）。
  - 家族情報：`SELECT id FROM family_info`。
  - 媒介：画面と同じ条件を SQL の WHERE に入れた。
- `frontend/src/utils/useIncrementalList.ts`（新規）：`useIncrementalList(list, step, rootRef)` → `{ visible, hasMore, more, sentinelRef, total, shown }`。IntersectionObserver（rootMargin 下 300px）で表の下が見えたら step 行足す。一覧が変わったら先頭の step 行に戻し、表の枠を上端へ。
- `frontend/src/components/header/system/SecurityLog.tsx`：`ROW_STEP = 100`、表の枠に ref、`visibleRows` を描く、表の最後に「○ / ○ 行を表示中」と「続きを表示」ボタンの行。
- 版：`version.ts` 2.2.269、`2026-11-14_update_log_2.2.269.sql`（ローカル no=368）。
- 業務ガイド：記事「セキュリティログ」に、表は100行ずつ・スクロールで続き・並べ替えで先頭に戻る・2,000行までの注意を追記（SQL を update_log の SQL の末尾に入れ、ローカルにも流した）。
- `DatabaseResale.tsx` は変えていない（返事の形を変えていないため）。

## テスト
- ① 経由（仮スタッフ Master 999999）で直す前と後を比較：56,210,181B・11.2秒 → 2,277,227B・1.4秒。画面と同じ計算で出す初回通電日・最終架電日・次回架電日が全 2,767人で一致（差 0）、customer は完全一致、family の id の集合も一致。broker はローカルに顧客ID付きの台帳が無く、前後とも0件（画面と同じ条件を SQL にしただけ）。
- 型チェック：frontend エラー 0。
- Playwright（3100、security_log に試験用 2,500行を入れて）9項目 OK：最初は100行、「100 / 2,000 行を表示中」、表の下までスクロールで200行、最後まで足すと2,000行で案内が消える、並べ替えで先頭100行に戻る、「続きを表示」で増える、中古の顧客DBが開く（返事 2.17MB）、架電の日付が表に出る、画面のエラー 0。
  - 途中の不具合：並べ替えのあと表の枠が下のままで、戻した直後にまた100行足されていた → 一覧が変わったら枠を上端に戻すようにした。
- 試験用の security_log 2,500行・仮スタッフは消した。3100 は止めた。

## Docker Desktop の「WSL integration … unexpectedly stopped（context deadline exceeded）」
- コードとは別の問題。WSL のメモリ不足・応答の遅れで出ることが多い。今回は手を入れていない。

## 新規・変更したコード（全文と差分）
### `frontend/src/utils/useIncrementalList.ts`（全文）
```ts
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

/**
 * 長い一覧を少しずつ描く（v2.2.269 新規）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 何千行を一度に描くと、ブラウザが固まる・落ちる（セキュリティログは最大2,000行を一度に描いていた）。
 *   ⚠️ はじめは step 行だけ描き、表の下（sentinelRef を付けた要素）が見えたら次の step 行を足す。
 * ⚠️ 並べ替え・絞り込みで list が変わったら、先頭の step 行に戻す。
 * ⚠️ スクロールするのが表の枠（overflow: auto の要素）なら、その要素を rootRef で渡すこと。
 *   ⚠️ 渡さないとブラウザの画面全体のスクロールで判定するため、枠の中をスクロールしても続きが出ない。
 * ⚠️ 見えたことに気づけない環境（古いブラウザ）のために、more() を「続きを表示」ボタンに付けておく。
 *
 * @example
 *   const wrapRef = useRef<HTMLDivElement>(null);
 *   const { visible, hasMore, more, sentinelRef, total } = useIncrementalList(rows, 100, wrapRef);
 *   <div ref={wrapRef} style={{ overflow: 'auto' }}>
 *     <table><tbody>{visible.map(...)}{hasMore && <tr ref={sentinelRef}>…</tr>}</tbody></table>
 *   </div>
 * ─────────────────────────────────────────────
 */
export const useIncrementalList = <T,>(
    list: T[],
    step = 100,
    rootRef?: RefObject<HTMLElement | null>,
) => {
    const [count, setCount] = useState(step);
    const [sentinel, setSentinel] = useState<Element | null>(null);
    const sentinelRef = useCallback((el: Element | null) => setSentinel(el), []);
    const listRef = useRef(list);

    // 一覧が変わったら（並べ替え・絞り込み・読み直し）先頭に戻す
    // ⚠️ 表の枠も上端に戻す。下のままだと、戻した直後に表の下が見えていて、すぐ次の step 行が足される
    useEffect(() => {
        if (listRef.current !== list) {
            listRef.current = list;
            setCount(step);
            if (rootRef?.current) rootRef.current.scrollTop = 0;
        }
    }, [list, step, rootRef]);

    const more = useCallback(() => setCount((c) => Math.min(c + step, list.length)), [step, list.length]);
    const hasMore = count < list.length;

    useEffect(() => {
        if (!hasMore || sentinel === null || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries.some((e) => e.isIntersecting)) more(); },
            // ⚠️ 下端の少し手前（300px）で足しておくと、スクロールが途切れない
            { root: rootRef?.current ?? null, rootMargin: '0px 0px 300px 0px' },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, sentinel, more, rootRef]);

    return { visible: list.slice(0, count), hasMore, more, sentinelRef, total: list.length, shown: Math.min(count, list.length) };
};
```

### 差分
```diff
diff --git a/backend/scripts/guide/articles/common/screen-195.md b/backend/scripts/guide/articles/common/screen-195.md
index db6be874e..021b6175e 100644
--- a/backend/scripts/guide/articles/common/screen-195.md
+++ b/backend/scripts/guide/articles/common/screen-195.md
@@ -28,6 +28,9 @@ summary: ログイン・ログアウトと、失敗・エラーの記録を見
    - 札は、はじめは**10個まで**出します。失敗の連打・存在しない処理の連打・ログイン失敗の接続元が先で、User-Agent だけの理由の接続元はあとに並びます
    - 残りは「**残り N件を表示**」で開き、「閉じる」で戻ります
 4. 「要注意の IP だけ」に印を付けると、目印の付いた接続元の行だけになります
+5. 表は、はじめに**100行**だけ出します。表の下までスクロールすると、次の100行が出ます（表の下の「続きを表示」を押しても出ます）。並べ替えたり絞り直したりすると、先頭の100行に戻ります
+
+> 注意：表に出るのは、新しい順に2,000行までです。それより多いときは表の上に案内が出るので、期間を短くするか、種類・IP で絞ってください。
 
 ## 要注意の目印
 次のどれかに当てはまる接続元（IP）には、赤い「要注意」の札が付きます。
diff --git a/backend/src/handlers/databaseAction/database_used.php b/backend/src/handlers/databaseAction/database_used.php
index b83edf40e..2639230f1 100644
--- a/backend/src/handlers/databaseAction/database_used.php
+++ b/backend/src/handlers/databaseAction/database_used.php
@@ -17,10 +17,33 @@ $response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);
 
 
 // 架電情報
-$sql_call = "SELECT * FROM call_sheet";
+// ⚠️ v2.2.269: 以前は call_sheet の全件（全事業 約19,000行・約43MB）を送っており、
+//   ⚠️ json_encode の途中で memory_limit（256M）を超えて「Allowed memory size … exhausted」で落ちていた。
+//   ⚠️ 画面（DatabaseResale.tsx）が使うのは、中古の顧客の call_log のうち「通電」「架電」「次回架電日」の day だけ。
+//   ⚠️ 中古の顧客の行だけにし、call_log もその3つの { day, action } だけに絞る（返す形 { id, call_log: JSON文字列 } は変えない）。
+$CALL_ACTIONS = ['通電', '架電', '次回架電日'];
+$sql_call = "SELECT c.id, c.call_log
+        FROM call_sheet c
+        JOIN master_data_resale m ON m.id = c.id
+        WHERE COALESCE(m.delete_dashboard, 0) = 0";
 $stmt_call = $pdo->prepare($sql_call);
 $stmt_call->execute();
-$response_call = $stmt_call->fetchAll(PDO::FETCH_ASSOC);
+$response_call = [];
+while ($row = $stmt_call->fetch(PDO::FETCH_ASSOC)) {
+    $log = json_decode((string) ($row['call_log'] ?? ''), true);
+    $kept = [];
+    if (is_array($log)) {
+        foreach ($log as $entry) {
+            if (is_array($entry) && in_array($entry['action'] ?? '', $CALL_ACTIONS, true)) {
+                $kept[] = ['day' => $entry['day'] ?? '', 'action' => $entry['action']];
+            }
+        }
+    }
+    $response_call[] = [
+        'id' => $row['id'],
+        'call_log' => json_encode($kept, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
+    ];
+}
 
 
 // 顧客一覧
@@ -65,14 +88,17 @@ $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);
 
 
 // 家族情報
-$sql_family = "SELECT * FROM family_info";
+// ⚠️ v2.2.269: 画面は id しか使わない（「家族情報あり」の絞り込み）。本文（family_info）は送らない
+$sql_family = "SELECT id FROM family_info";
 $stmt_family = $pdo->prepare($sql_family);
 $stmt_family->execute();
 $response_family = $stmt_family->fetchAll(PDO::FETCH_ASSOC);
 
 
 // 媒介取得
-$sql_broker = "SELECT *  FROM brokerage_listings";
+// ⚠️ v2.2.269: 画面と同じ条件（媒介台帳・表示中・顧客IDあり）で絞る。以前は全種類（反響・ログ・通知など）を送っていた
+$sql_broker = "SELECT * FROM brokerage_listings
+        WHERE kind = 'ledger' AND show_dashboard = 1 AND COALESCE(master_data_id, '') <> ''";
 $stmt_broker = $pdo->prepare($sql_broker);
 $stmt_broker->execute();
 $response_broker = $stmt_broker->fetchAll(PDO::FETCH_ASSOC);
diff --git a/frontend/src/components/header/system/SecurityLog.tsx b/frontend/src/components/header/system/SecurityLog.tsx
index 3a19e1f15..26f67d8aa 100644
--- a/frontend/src/components/header/system/SecurityLog.tsx
+++ b/frontend/src/components/header/system/SecurityLog.tsx
@@ -1,4 +1,5 @@
-import React, { useCallback, useEffect, useMemo, useState } from 'react';
+import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
+import { useIncrementalList } from '../../../utils/useIncrementalList';
 import apiClient from '../../../utils/apiClient';
 
 /**
@@ -69,6 +70,8 @@ type SortKey = 'occurredAt' | 'event' | 'count' | 'staffName' | 'ip' | 'request'
 
 /** 要注意の IP の札を、はじめに出す数（v2.2.261。残りは「残り N件を表示」で開く） */
 const FLAG_LIMIT = 10;
+/** 表を一度に描く行数（v2.2.269。下までスクロールすると同じ数ずつ足す） */
+const ROW_STEP = 100;
 
 const sum = (totals: ListResponse['totals'], keys: EventKey[]): number => keys.reduce((n, k) => n + (totals[k] ?? 0), 0);
 
@@ -123,6 +126,10 @@ const SecurityLog = () => {
         });
     }, [data, flaggedOnly, flags, sortKey, sortOrder]);
 
+    // ⚠️ v2.2.269: 最大2,000行を一度に描くとブラウザが落ちるため、100行ずつ描き、表の下までスクロールしたら続きを足す
+    const tableWrapRef = useRef<HTMLDivElement>(null);
+    const { visible: visibleRows, hasMore, more, sentinelRef, shown } = useIncrementalList(rows, ROW_STEP, tableWrapRef);
+
     const totals = data?.totals ?? {};
     /**
      * ⚠️ v2.2.261: 要注意の IP は大事なものから並べる（失敗・探り・ログイン失敗の連打 → User-Agent だけの順。同じなら理由の多い順）。
@@ -215,6 +222,10 @@ const SecurityLog = () => {
                 .sl_ua { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #4b5563; }
                 .sl_msg { min-width: 160px; overflow-wrap: anywhere; }
                 .sl_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
+                .sl_more { text-align: center; color: #6b7280; font-size: 11px; padding: 14px 0; }
+                .sl_more_btn { margin-left: 10px; border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 6px;
+                               font-size: 11px; font-weight: 700; padding: 2px 10px; cursor: pointer; }
+                .sl_more_btn:hover { background: #f1f5f9; }
                 @media (max-width: 900px) { .sl_wrap { padding: 12px 16px 16px; } }
             `}</style>
 
@@ -300,7 +311,7 @@ const SecurityLog = () => {
                             {data.truncated && <><br />⚠️ 新しい順に {data.maxRows.toLocaleString()} 行までを出しています。期間を短くするか、種類・IP で絞ってください。</>}
                         </div>
 
-                        <div className="sl_table_wrap">
+                        <div className="sl_table_wrap" ref={tableWrapRef}>
                             <table className="sl_table">
                                 <thead>
                                     <tr>
@@ -319,7 +330,7 @@ const SecurityLog = () => {
                                     {rows.length === 0 && (
                                         <tr><td className="sl_td sl_empty" colSpan={9}>{loading ? '読み込み中…' : '該当する記録はありません'}</td></tr>
                                     )}
-                                    {rows.map((r) => {
+                                    {visibleRows.map((r) => {
                                         const ev = EVENTS[r.event] ?? { label: r.event, tone: 'muted' as const };
                                         const flagged = flags[r.ip] !== undefined;
                                         return (
@@ -347,6 +358,14 @@ const SecurityLog = () => {
                                             </tr>
                                         );
                                     })}
+                                    {hasMore && (
+                                        <tr ref={sentinelRef}>
+                                            <td className="sl_td sl_more" colSpan={9}>
+                                                {shown.toLocaleString()} / {rows.length.toLocaleString()} 行を表示中（下までスクロールすると続きを表示します）
+                                                <button type="button" className="sl_more_btn" onClick={more}>続きを表示</button>
+                                            </td>
+                                        </tr>
+                                    )}
                                 </tbody>
                             </table>
                         </div>
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 69e41e479..8f27a347a 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.268';
+export const newVersion = '2.2.269';
```
