---
table: api_credential
title: Claude APIキー（暗号化保存）
business: common
source: 改修
---
Anthropic（Claude API）へ送る側の API キーを暗号化（AES-GCM）して持つ表。1行がキー1本。
① の credential_insert.php（登録）・credential_list.php（一覧）・credential_verify.php（疎通確認）と、kpi_analyze.php（使うキーを選んで復号）が使う。課金の記録は ai_usage_log.credential_id。
⚠️ 旧「KPI分析」の仕組み。credential_*・kpi_analyze は画面から呼ばれていない。
⚠️ 秘密の表。key_ciphertext・key_iv・key_tag・key_fingerprint の値は見ない・資料に出さない。復号の鍵（マスターキー）は DB の外（環境変数）にある。

## 列
- id: 連番（自動採番）。ai_usage_log.credential_id から参照される
- staff_id: 所有者。staff.id
- provider: どの会社の API か。いまは anthropic のみ（将来他社APIも扱えるように）
- label: 用途がわかる名前（例: だれの個人アカウントか）
- key_ciphertext: キーの暗号文。⚠️ 秘密
- key_iv: 初期化ベクトル(12byte)。⚠️ 秘密
- key_tag: 認証タグ(16byte)。⚠️ 秘密
- key_version: マスターキーの世代（鍵を替えたときに見分ける）
- key_hint: 画面表示用の末尾数文字（例: ...a3f9）
- key_fingerprint: HMAC-SHA256。重複登録の検出用。⚠️ 秘密
- status: active＝使える / revoked＝止めた / invalid＝疎通確認で無効と分かった。kpi_analyze は active だけを使う
- last_verified_at: 最後に疎通確認できた時刻
- created_at: 登録した日時
- updated_at: 最後に更新した日時
