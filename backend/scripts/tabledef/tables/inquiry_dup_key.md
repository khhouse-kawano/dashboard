---
table: inquiry_dup_key
title: 重複反響の判定の鍵
business: common
source: 改修
---
事業をまたいだ重複反響の判定用の表（v2.2.276）。1行が1件の反響（注文・建売・中古の反響の表の1行）。
「正規化したメール」か「携帯（070/080/090/050 で始まる11桁）」が同じ、ほかの反響の数を持つ。氏名は使わない。
② の inquiryDup/refresh.ts だけが書く。3つの反響の表と除外の名簿（inquiry_dup_exclude）の指紋（件数・最大 id・CRC の XOR）を比べ、変わっていたら全件を計算し直して変わった行だけ書く。
呼ぶのは反響一覧（list）と重複の詳細（request inquiryDup）の冒頭、10分ごとの安全網。
反響一覧（② の list/queries.ts、① の予備 list_order.php・list_spec.php・list_used.php）が dup_count を読み、件数のアイコンを出す。
⚠️ 反響の経路ごとには更新しない（約40経路あり漏れるため）。⚠️ 手で直さない（次の計算で上書きされる）。
⚠️ ② が止まっている間は ① の予備が止まった時点の件数を出す。

## 列
- brand: 事業。order（inquiry_customer）/ spec（inquiry_customer_kaeru）/ used（inquiry_customer_resale）
- src_id: 反響の表の id（brand で表が決まる）。brand と合わせて主キー
- mail_key: NFKC・空白除去・小文字にしたメール。メールの形でない・除外の名簿にあるなら NULL
- mobile_key: 070/080/090/050 で始まる11桁の携帯。それ以外・除外なら NULL
- dup_count: メールか携帯が同じ、ほかの反響の数（3事業をまたぐ。自分は除く）
- updated_at: この行を書いた日時
