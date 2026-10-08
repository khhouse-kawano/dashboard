# v2.2.175 修正: 要確認ボタンを建売・中古にも ／ /home は対象外 ／ 事業を選んでから自動表示

## 依頼
- category が spec / used の場合も ActiveUser.tsx に要確認ボタンを掲載
- カレントディレクトリが home の場合は DailyAction.tsx の対象外
- Category.tsx で category が決まってから DailyAction.tsx 表示の発火とする

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/` | **DailyAction.tsx** | `NO_AUTO_OPEN`（自動だけ止める）→ **`NO_DAILY_ACTION`**（`/`・`/home`・`/login` は自動もボタンも出さない。export）。追加 **`markCategoryChosen`** / `isCategoryChosen`（sessionStorage `dailyActionCategory`）。`DAILY_CATEGORIES` を export。対象外の画面へ戻ったら閉じる useEffect、ボタン購読で `excludedRef` を見る |
| `frontend/src/components/` | **Category.tsx** | `goToDashboard` で `setCategory` の直後に `markCategoryChosen(categoryValue)` |
| `frontend/src/components/` | **ActiveUser.tsx** | ボタンの条件 `category === 'order'` → `DAILY_CATEGORIES.includes(category) && !NO_DAILY_ACTION.includes(location.pathname)` |

- ⚠️ `/` も `/home` と同じ Category.tsx なので対象外に入れた。
- ⚠️ 「事業を選んだ」は sessionStorage に持つ（⚠️ 同じタブの再読み込みでは選び直し不要。⚠️ 新しいタブでは Category.tsx を通るまで自動では出ない。⚠️ ボタンからは開ける）。
- ⚠️ 選んだ事業と今の category が違えば未選択扱い。
- build OK（main.79f19c9a.js。警告は既存）。⚠️ ブラウザ未確認。

## 差分
```diff
diff --git a/frontend/src/components/ActiveUser.tsx b/frontend/src/components/ActiveUser.tsx
index 46f48cd4..bc4168c9 100644
--- a/frontend/src/components/ActiveUser.tsx
+++ b/frontend/src/components/ActiveUser.tsx
@@ -2,7 +2,7 @@ import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
 import AuthContext from '../context/AuthContext';
 import { useLocation } from "react-router-dom";
 import apiClient from '../utils/apiClient';
-import { openDailyAction } from './DailyAction';
+import { openDailyAction, DAILY_CATEGORIES, NO_DAILY_ACTION } from './DailyAction';
 
 type User = { id?: string | number, name: string, heartbeat: string };
 
@@ -275,13 +275,15 @@ const ActiveUser: React.FC = () => {
                 <div style={containerStyle} aria-label="Active users">
                     {/*
                       ⚠️⚠️ **「要確認」ボタン（2026-09-28 の指示）。**
-                        ⚠️ ⚠️ **注文営業のときだけ・常に出す**（⚠️ 今日もう確認していても出す）。
+                        ⚠️ ⚠️ **注文・建売・中古のとき・常に出す**（⚠️ 今日もう確認していても出す）。
+                          ⚠️ v2.2.175 修正: 注文だけ → ⚠️ DailyAction.tsx の DAILY_CATEGORIES（order / spec / used）。
+                          ⚠️ 事業を選ぶ画面（`/`・`/home`）では出さない（⚠️ DailyAction の対象外）。
                         ⚠️ 押すと `App.tsx` に1つだけ置いた `DailyAction` が開く。
                         ⚠️ ⚠️ **確認済みなら中のボタンは「閉じる」**になり、記録はしない。
                         ⚠️ この枠自体が `width >= 768` のときしか出ないので、
                           ⚠️ **スマホでは出ない**（DailyAction 側の条件とも一致する）。
                     */}
-                    {category === 'order' && (
+                    {DAILY_CATEGORIES.includes(category) && !NO_DAILY_ACTION.includes(location.pathname) && (
                         <button
                             type="button"
                             style={alertButtonStyle}
diff --git a/frontend/src/components/Category.tsx b/frontend/src/components/Category.tsx
index bc2d894e..1dd3b077 100644
--- a/frontend/src/components/Category.tsx
+++ b/frontend/src/components/Category.tsx
@@ -5,6 +5,7 @@ import Logo from "../assets/images/logo.png";
 import apiClient from '../utils/apiClient';
 import Table from "react-bootstrap/Table";
 import { useIsSp } from '../utils/isSp';
+import { markCategoryChosen } from './DailyAction';
 
 type Log = { no: number, version: string, date: string, note: string };
 
@@ -38,6 +39,11 @@ const Category = () => {
             planner: '/summary'
         };
         await setCategory(categoryValue);
+        /**
+         * ⚠️ v2.2.175 修正: 要確認は ⚠️ **ここで事業を選んでから**出す（DailyAction.tsx の markCategoryChosen）。
+         *   ⚠️ navigate の前に呼ぶこと（⚠️ 遷移で DailyAction が判定するため）。
+         */
+        markCategoryChosen(categoryValue);
         /**
          * ⚠️ ここから遷移すると「要確認」モーダルも出る（2026-09-28）。
          *   ⚠️ ⚠️ **目印は渡していない。** `App.tsx` の `DailyAction` が
diff --git a/frontend/src/components/DailyAction.tsx b/frontend/src/components/DailyAction.tsx
index b05c1df7..198e7a7e 100644
--- a/frontend/src/components/DailyAction.tsx
+++ b/frontend/src/components/DailyAction.tsx
@@ -1,4 +1,4 @@
-import React, { useEffect, useState, useContext } from 'react';
+import React, { useEffect, useRef, useState, useContext } from 'react';
 import { useLocation } from 'react-router-dom';
 import Modal from 'react-bootstrap/Modal';
 import AuthContext from '../context/AuthContext';
@@ -94,11 +94,41 @@ let cached: { at: number; category: string; promise: Promise<ListResponse> } | n
 let sessionChecked = false;
 
 /**
- * ⚠️⚠️ **自動では出さない画面。**
- *   ⚠️ `App.tsx` の「メニューを出す条件」と同じにしてある。
- *   ⚠️ ⚠️ **手動（ActiveUser の「要確認」ボタン）では出せる。**
+ * ⚠️⚠️ **要確認の対象外の画面。**
+ *   ⚠️ v2.2.175 修正: 以前は「自動では出さない（ボタンからは開ける）」だったが、
+ *     ⚠️ ⚠️ **ボタンからも開かない**（指示: home は DailyAction の対象外）。
+ *   ⚠️ `/` と `/home` はどちらも事業を選ぶ画面（Category.tsx）。
  */
-const NO_AUTO_OPEN: string[] = ['/home', '/login'];
+export const NO_DAILY_ACTION: string[] = ['/', '/home', '/login'];
+
+/**
+ * ⚠️⚠️ **事業を選んだか**（v2.2.175 修正）。
+ *   ⚠️ 指示: ⚠️ **Category.tsx で category が決まってから**要確認を出す。
+ *   ⚠️ AuthContext の category は前回の値が残っていることがあり、
+ *     ⚠️ それだけで出すと、事業を選ぶ前（ログイン直後など）に開いてしまう。
+ *   ⚠️ Category.tsx の goToDashboard が `markCategoryChosen()` を呼ぶ。
+ *   ⚠️ ⚠️ **sessionStorage に持つ**（⚠️ 同じタブで再読み込みしても選び直さなくてよい）。
+ *     ⚠️ 選んだ事業と今の category が違えば ⚠️ 未選択として扱う。
+ *     ⚠️ 読み書きできない環境では ⚠️ メモリの値だけで判定する。
+ */
+const CHOSEN_KEY = 'dailyActionCategory';
+let chosenCategory = '';
+export const markCategoryChosen = (category: string): void => {
+    chosenCategory = category;
+    try {
+        sessionStorage.setItem(CHOSEN_KEY, category);
+    } catch {
+        // ⚠️ 保存できなくてもメモリの値で動く
+    }
+};
+const isCategoryChosen = (category: string): boolean => {
+    if (chosenCategory === category) return true;
+    try {
+        return sessionStorage.getItem(CHOSEN_KEY) === category;
+    } catch {
+        return false;
+    }
+};
 
 /**
  * ⚠️⚠️ **外から開くための入口**（2026-09-28）。
@@ -149,7 +179,7 @@ const orDash = (value?: string): string => (value ?? '').trim() === '' ? '-' : (
 const UNSYNC_LABEL = '未同期';
 
 /** ⚠️ 要確認を出す事業（v2.2.175）。⚠️ サーバー（features/dailyAction.ts の DailyCategory）と同じ */
-const DAILY_CATEGORIES: string[] = ['order', 'spec', 'used'];
+export const DAILY_CATEGORIES: string[] = ['order', 'spec', 'used'];
 
 /**
  * 表の見出しの id（v2.2.175）。⚠️ 上のカードを押すとここへ移る。
@@ -255,6 +285,16 @@ const DailyAction = () => {
      *   ⚠️ planner などは対象外（⚠️ サーバーの DAILY_SOURCES に無い）。
      */
     const isTarget = !isSp && DAILY_CATEGORIES.includes(category);
+    /** ⚠️ v2.2.175 修正: 事業を選ぶ画面（`/`・`/home`）とログインでは ⚠️ **自動でもボタンでも出さない** */
+    const isExcludedPage = NO_DAILY_ACTION.includes(location.pathname);
+    /** ⚠️ ボタンの購読（下の useEffect）から今の画面を見るため */
+    const excludedRef = useRef(isExcludedPage);
+    excludedRef.current = isExcludedPage;
+
+    // ⚠️ 開いたまま事業を選ぶ画面へ戻ったら閉じる（⚠️ 確認済みにはしない）
+    useEffect(() => {
+        if (isExcludedPage) setOpen(false);
+    }, [isExcludedPage]);
 
     /**
      * 件数を取ってくる。
@@ -300,8 +340,10 @@ const DailyAction = () => {
     // --- 自動で出す（URL が変わるたび）---
     useEffect(() => {
         if (!isTarget || sessionChecked) return;
-        // ⚠️ トップとログインでは自動で出さない（⚠️ ボタンからは開ける）
-        if (NO_AUTO_OPEN.includes(location.pathname)) return;
+        // ⚠️ 事業を選ぶ画面とログインでは出さない（v2.2.175 修正: ボタンからも出さない）
+        if (isExcludedPage) return;
+        // ⚠️⚠️ **Category.tsx で事業を選んでから**（v2.2.175 修正）。⚠️ 前回の category が残っているだけでは出さない
+        if (!isCategoryChosen(category)) return;
 
         let alive = true;
         load(false)
@@ -322,6 +364,9 @@ const DailyAction = () => {
         if (!isTarget) return;
 
         const onOpen = () => {
+            // ⚠️ v2.2.175 修正: 事業を選ぶ画面では開かない（⚠️ ボタンも出していないが念のため）
+            //   ⚠️ window.location ではなく router の pathname（⚠️ 公開先のサブパスに左右されない）
+            if (excludedRef.current) return;
             // ⚠️⚠️ **押したときは取り直す。** ⚠️ 対応した直後に古い件数を見せない
             load(true)
                 .then((data) => {
```
