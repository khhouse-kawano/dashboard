# dashboard/frontend/src/component/company/Company.tsxの改修
* 建売のSランクは契約済みの顧客を意味する
* つまり全ての契約客を拾って大量になる
* 建売の場合のみ、Sランクはincludes(当月 YYYY/MM or YYYY-MM) を含むもののみ拾うことにする

## エラーログ確認
* *[Thu Sep 10 16:27:41.534545 2026] [proxy_fcgi:error] [pid 2734353:tid 2734373] [client 210.146.93.101:57606] AH01071: Got error 'PHP message: express_proxy: \xe8\xbb\xa2\xe9\x80\x81\xe5\x85\x88\xe3\x81\x8c 502 \xe3\x82\x92\xe8\xbf\x94\xe3\x81\x97\xe3\x81\xbe\xe3\x81\x97\xe3\x81\x9f\xe3\x80\x82\xe2\x91\xa0 \xe3\x81\xae\xe5\x87\xa6\xe7\x90\x86\xe3\x81\xab\xe5\x88\x87\xe3\x82\x8a\xe6\x9b\xbf\xe3\x81\x88\xe3\x81\xbe\xe3\x81\x99', referer: https://khg-marketing.info/dashboard/database*この原因と対策を