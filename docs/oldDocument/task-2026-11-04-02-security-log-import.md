# 2026-11-04 本番のセキュリティログをローカルDBへ取り込み

## 依頼
- ダウンロードの `security_log.csv`（本番①の phpMyAdmin から書き出したもの）をローカルDBへ入れる
- 危険なアクセスを遮断できるかの質問（回答のみ。実装は未着手）

## やったこと
- リポジトリのファイルは変更していない
- CSV（20行、2026-11-04 10:56〜11:48）を INSERT 文に変換し、ローカルの `local_db.security_log` へ入れた
  - 取り込み前のローカルは0行。`id`・`bucket` も CSV の値のまま入れた
  - CSV の引用なしの `NULL` は NULL、引用なしの空は空文字（表の定義で NOT NULL DEFAULT '' の列のため）
- 確認：20行、内訳 unknown_request 13・login 3・auth_failed 3・logout 1

## 変換に使ったスクリプト（作業用フォルダ。リポジトリには入れていない）
```js
const fs = require('fs');
const [, , src, out] = process.argv;
const text = fs.readFileSync(src, 'utf8').replace(/^﻿/, '');
// phpMyAdmin の CSV: "値" / 引用なしの NULL / 引用なしの空（=空文字）
function parseLine(line) {
  const cells = []; let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let v = ''; i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { v += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else v += line[i++];
      }
      cells.push({ q: true, v }); i++;
    } else {
      const j = line.indexOf(',', i); const end = j < 0 ? line.length : j;
      cells.push({ q: false, v: line.slice(i, end) }); i = end + 1;
    }
  }
  return cells;
}
const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
const cols = parseLine(lines[0]).map(c => c.v);
const BS = String.fromCharCode(92);
const esc = s => "'" + s.split(BS).join(BS + BS).split("'").join("''") + "'";
const rows = lines.slice(1).map(l => {
  const c = parseLine(l);
  if (c.length !== cols.length) throw new Error('列の数が違う: ' + l.slice(0, 40));
  return '(' + c.map(x => (!x.q && x.v === 'NULL') ? 'NULL' : esc(x.v)).join(',') + ')';
});
fs.writeFileSync(out, 'INSERT INTO security_log (`' + cols.join('`,`') + '`) VALUES\n' + rows.join(',\n') + ';\n');
console.log(rows.length + ' rows');
```

## 本番ログから分かったこと
- ① はログインした人の本当の接続元 IP を取れている（レンタルサーバー自身の IP になっていない）
- ① → ② の中継で `via_ip` に ① の IP が入り、`ip` には元の接続元が入っている（想定どおり）
- 存在しない処理の13件は、ほぼ Facebook のリンク確認用ロボット（`facebookexternalhit`）が ② の `GET /` を見に来たもの。ほかに python-requests・Gort（調査用ロボット）が各1件。今のところ危険なものはない

## 注意
- ローカルDBの時計は UTC、本番の記録は日本時間。取り込んだ行の時刻は日本時間のまま
