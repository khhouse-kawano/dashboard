# デプロイ手順 v2.2.275　反響一覧の期間を画面のアドレス（URL）に出す

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 反響一覧（注文・建売・中古）で選んだ期間が `/dashboard/list?startMonth=202610&endMonth=202611` のようにアドレスに残る。再読み込み・アドレスの共有・ブラウザの「戻る」で同じ期間が開く | ① フロント（Dashboard） |
| 2 | 更新履歴・業務ガイド3本（反響一覧／反響一覧（建売営業）／反響一覧（中古リノベ）） | ① DB `backend/scripts/sql/2026-11-17_update_log_2.2.275.sql` |

- ① PHP・② VPS の変更はありません。表の変更もありません。
- ⚠️ **v2.2.274 を先にデプロイしてから**、この版を上げてください（このブランチは v2.2.274 の上に作っています。期間で読む GET は v2.2.274 の ①②）。

## 順序
```
0. v2.2.274 のデプロイが済んでいること（①②とも。v2.2.274 の手順書どおり）
1. GitHub で v2.2.275 を production へマージ（PR）
2. ① Dashboard のフロント（npm run build → アップロード）
3. ① SQL：2026-11-17_update_log_2.2.275.sql   ← ⚠️ 1回だけ
```

### 手順2　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.275 になればよいです。

### 手順3　【① SQL】
phpMyAdmin で `2026-11-17_update_log_2.2.275.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT title, updated_at FROM guide_article WHERE title IN ('反響一覧', '反響一覧（建売営業）', '反響一覧（中古リノベ）');
```

## 終わったら（動作確認）
- 反響一覧で開始月・終了月を変えると、アドレスの末尾に `startMonth=…&endMonth=…` が付く。
- 再読み込み（F5）しても同じ期間で開く。ブラウザの「戻る」で前の期間に戻る。
- 左のメニューの「反響一覧」が選ばれた表示のまま。
- 中古は `?shop=renove&startMonth=…` のように `shop=renove` が残る。

## 切り戻し
フロントを前の版に戻すだけです。
