# デジシキ機能の改修

## 元ファイルの修正確認
* C:Users\shinji-kawano\Downloads\AIデジタル資金計画書.htmlに改修が入った
* それにともなうUIの変更及びデータ連携の変更

### 主な変更点
* 顧客情報が表示されなくなった => 連携が不要になった項目が増えた
* 印刷機能にA3拡張追加

### 権限の編集
* authority === 'Master'にくわえてuserNameで条件を満たせば表示できるようにしたい
    * const targetStaff = staff_list.find(item => item.name === userName && item.period === String(thisYear) && item.shop === 'KH久留米店');
    * targetStaffが真の場合にもデジシキ作成ボタンを設置したい