# c:/Users/shinji-kawano/react/dashboard/frontend/src/header/InquiryIntroductory.tsxの改修
* 同期不要の判定機能追加
* UI修正

## 同期不要の判定
* テーブル左の*同期*ボタンの右に*重複*、*ブラックリスト*のclickableなタブを配置　小さめの文字
* クリックしたらsync = 1
* さらにinquiry_introductoryのＤＢに
    duplicate_tag tinyInt default 0 コメント'重複客'
    blacklist_tag tinyInt default 0 コメント'ブラックリスト客'
    を追加
    * *重複*をクリック => duplicate_tag = 1
    * *ブラックリスト*をクリック => blacklist_tag = 1
* duplicate_tag === 1 || blacklist_tag === 1　であれば sync === 1となるので同期済みの客として丸めてよいが *同期*ボタンを*同期済み*にはせずclickableなUIにしておく

## UI修正
* モーダル内で横幅いっぱいにテーブルをつかっているのでp-5等のクラスを加えて視認性をよくする
* 店舗の並びは以前つくったソート関数を反映