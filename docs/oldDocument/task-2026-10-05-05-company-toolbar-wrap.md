# 2026-10-05-05　全社報告用フォーマットの上部バーを折り返す（v2.2.163 の続き）

## 依頼

> Company.tsx の期間や事業部選択の select タグ及びボタン類を flex-wrap にして width がせまくなっても文字が改行しないようにしてほしい

## ⚠️ 単に flex-wrap を付けるだけでは足りなかった理由

| 問題 | 内容 |
|---|---|
| ⚠️⚠️ **表がバーに隠れる** | ⚠️ バーは `position: fixed`・⚠️ 高さ 60px 固定。⚠️ 下の表は ⚠️ **60.5px 固定**の translateY でずらしてあった。⚠️ 折り返して高さが増えると、⚠️ **表の見出しがバーの下に隠れる** |
| ⚠️⚠️ **右端が画面の外にはみ出していた** | ⚠️ fixed の `width: 100%` は ⚠️ **画面全体の幅**。⚠️ 左のメニューの分だけ右にはみ出しており、⚠️ **狭くしても折り返さない**（⚠️ 見えない所に並ぶだけ） |

⚠️ そこで ⚠️ **バーの幅を親（.content）に合わせ、実際の高さを測って表のずらし幅に使う**ようにした。

## 変更

| ディレクトリ | ファイル | |
|---|---|---|
| `frontend/src/components/company/` | **Company.tsx** | ⚠️ 下記 |
| `docs/` | **deploy-v2.2.163.md** | ⚠️ 成果物名・確認項目27〜29 |

| 追加したもの | |
|---|---|
| `toolbarRef` / state `toolbarBox` | ⚠️ バーの実寸（幅・高さ） |
| ⚠️ `useEffect`（ResizeObserver） | ⚠️ バーと親の大きさの変化を測る。⚠️ 値が同じなら state を変えない（⚠️ 往復を止める） |
| CSS `.company_toolbar` | ⚠️ `flex-wrap: wrap`。⚠️ 子要素は `white-space: nowrap` と `flex-shrink: 0` |
| バーの style | ⚠️ `height: auto` / `minHeight: 60px` / ⚠️ 幅は測った値（⚠️ 測れるまでは従来の 100%） |
| 表の translateY | ⚠️ `60.5px` 固定 → ⚠️ **`バーの高さ + 0.5px`** |

⚠️ `companyUtils.ts` の `sortStyle` は ⚠️ **変えていない**（⚠️ Company で上書きしている）。
⚠️ バックエンドの変更はない。

## 動作確認

```bash
cd frontend && npx react-scripts build   # -> Compiled with warnings
```

⚠️ Company.tsx の警告は ⚠️ **以前からある6件だけ**（⚠️ 新しい警告なし）。

| 成果物 | |
|---|---|
| ⚠️⚠️ **`static/js/main.a0cd8448.js`** | ⚠️ v2.2.163 の本体（⚠️ これまでの分も含む） |
| `static/css/main.7c10f266.css` | 変更なし |

⚠️⚠️ **ブラウザでの表示は未確認。** ⚠️ 狭くしたときに折り返すこと・表の見出しが隠れないこと・広い画面で従来どおりであることを見ること。

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️ 表の見出し（sticky-header）の top（0 / 34.5px / 69.5px）は ⚠️ **変えていない**。⚠️ ずらし幅だけを実寸に合わせた |
| 2 | ⚠️ スマホ表示（isSp）はバー自体を出さないので ⚠️ **影響なし** |

## 差分

```diff
diff --git a/frontend/src/components/company/Company.tsx b/frontend/src/components/company/Company.tsx
index 44e2dece..576b879a 100644
--- a/frontend/src/components/company/Company.tsx
+++ b/frontend/src/components/company/Company.tsx
@@ -1,4 +1,4 @@
-import React, { useState, useEffect, useContext, useMemo } from 'react';
+import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
 import AuthContext from "../../context/AuthContext";
 import Table from "react-bootstrap/Table";
 import { getPeriod } from '../../utils/getPeriod';
@@ -73,6 +73,45 @@ const Company = () => {
 
     const isSp = useIsSp();
 
+    /**
+     * 上部の絞り込みバー（期・事業部・課・店舗・ボタン類）の実寸。
+     *
+     * ─────────────────────────────────────────────
+     * ⚠️⚠️ 2026-10-05: **幅が狭いときは折り返し、文字は改行させない**（指示）。
+     *
+     *   ⚠️ バーは `position: fixed` で、下の表は ⚠️ **バーの高さぶん translateY でずらして**ある。
+     *     ⚠️ 以前は高さ 60px 固定・ずらし幅 60.5px 固定だった。
+     *     ⚠️ ⚠️ **折り返すと高さが増え、固定のままだと表の上部がバーの下に隠れる。**
+     *     ⚠️ そこで実際の高さを測り、ずらし幅に使う（⚠️ +0.5px は以前と同じ）。
+     *
+     *   ⚠️ 幅も測る。⚠️ fixed の `width: 100%` は ⚠️ **画面全体の幅**になり、
+     *     ⚠️ 左のメニューの分だけ右端が画面の外にはみ出していた。
+     *     ⚠️ ⚠️ **はみ出したままだと、狭くしても折り返さない**（⚠️ 見えない所に並ぶだけ）。
+     *     ⚠️ 親（.content）の幅に合わせる。
+     * ─────────────────────────────────────────────
+     */
+    const toolbarRef = useRef<HTMLDivElement | null>(null);
+    const [toolbarBox, setToolbarBox] = useState<{ width: number; height: number }>({ width: 0, height: 60 });
+
+    useEffect(() => {
+        const el = toolbarRef.current;
+        const parent = el?.parentElement;
+        if (!el || !parent) return;
+
+        const apply = () => {
+            const width = parent.clientWidth;
+            const height = el.offsetHeight;
+            // ⚠️ 値が同じなら state を変えない（⚠️ ResizeObserver と描き直しの往復を止める）
+            setToolbarBox(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
+        };
+        apply();
+
+        const observer = new ResizeObserver(apply);
+        observer.observe(el);
+        observer.observe(parent);
+        return () => observer.disconnect();
+    }, [isSp]);
+
     const rankArray = ['契約済み', 'Sランク', 'Aランク', 'Bランク', 'Cランク'];
     const divisionMapping = {
         '注文事業': '注文',
@@ -941,8 +980,25 @@ const Company = () => {
     return (
         <>
             <div className='content company bg-white p-0'>
+                {/* ⚠️ バーの中身は改行させず、バーごと折り返す（toolbarRef の注記参照） */}
+                <style>{`
+                    .company_toolbar { flex-wrap: wrap; row-gap: 2px; }
+                    .company_toolbar > * { white-space: nowrap; flex-shrink: 0; }
+                    .company_toolbar label { white-space: nowrap; }
+                `}</style>
                 {!isSp &&
-                    <div className="d-flex align-items-center" style={sortStyle}>
+                    <div
+                        ref={toolbarRef}
+                        className="d-flex align-items-center company_toolbar"
+                        style={{
+                            ...sortStyle,
+                            // ⚠️ 高さは中身に任せる（⚠️ 折り返したら伸びる）。⚠️ 1行のときは従来どおり 60px
+                            height: 'auto',
+                            minHeight: '60px',
+                            // ⚠️ 測れるまでは従来どおり 100%
+                            width: toolbarBox.width > 0 ? `${toolbarBox.width}px` : sortStyle.width,
+                        }}
+                    >
                         <div className="bg-white m-1">
                             <select className='target' onChange={(e) => setTargetYear(Number(e.target.value))}
                                 value={String(targetYear)}>
@@ -1000,7 +1056,8 @@ const Company = () => {
                                     onChange={() => setShowMulti(!showMulti)} />併売店をまとめる</label>
                             </div>}
                     </div>}
-                <div style={{ transform: isSp ? '' : 'translateY(60.5px)' }}>
+                {/* ⚠️ バーの実際の高さぶんずらす（⚠️ 以前は 60.5px 固定。toolbarRef の注記参照） */}
+                <div style={{ transform: isSp ? '' : `translateY(${toolbarBox.height + 0.5}px)` }}>
                     <Table bordered style={tableStyle(isSp)} >
                         <tbody className='align-middle'>
                             {/* 以下グループ */}
```
