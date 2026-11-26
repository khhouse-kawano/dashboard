---
table: company_achievement
title: 契約目標（会社実績）
business: common
source: 改修
---
会社実績の画面で入れる契約目標。1行＝1か月×区分×名前（period・category・name の UNIQUE キー）。
書くのは ② change_company_achievement（company/index.ts。① change_company_achievement.php から移したもの）。読むのは会社実績（Company.tsx・QuarterSummary.tsx）、ランク画面、予算シミュレーター（category = 'shop' の目標）。
⚠️ ON DUPLICATE KEY UPDATE で上書きする。UNIQUE キーが無いと同じマスに行が増えて合計が狂う。⚠️ 書き込みは ① へのフォールバック禁止。
⚠️ 入力を検証していない（空文字もそのまま入る。PHP からの挙動）。

## 列
- no: 連番（自動採番）
- category: 区分（shop = 店舗の目標 / staff = 営業の目標 / 中古リノベ = 中古の目標）
- name: 店舗名または営業の名前（category による）
- period: 年月（YYYY-MM）。中古リノベは空や「期間計」も入る
- value: 目標の値（契約棟数など。text）
