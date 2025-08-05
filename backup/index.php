<?php
if(empty($_POST['brand'])){$brand="";}else{$brand=$_POST['brand'];}
if(empty($_POST['shop'])){$shop="";}else{$shop=$_POST['shop'];}
if(empty($_POST['date'])){$date="";}else{$date=$_POST['date'];}
if(empty($_POST['time'])){$time="";}else{$time=$_POST['time'];}
if(empty($_POST['sei'])){$sei="";}else{$sei=$_POST['sei'];}
if(empty($_POST['mei'])){$mei="";}else{$mei=$_POST['mei'];}
if(empty($_POST['sei_kana'])){$sei_kana="";}else{$sei_kana=$_POST['sei_kana'];}
if(empty($_POST['mei_kana'])){$mei_kana="";}else{$mei_kana=$_POST['mei_kana'];}
if(empty($_POST['age'])){$age="";}else{$age=$_POST['age'];}
if(empty($_POST['phone'])){$phone="";}else{$phone=$_POST['phone'];}
if(empty($_POST['mail'])){$mail="";}else{$mail=$_POST['mail'];}
if(empty($_POST['zip'])){$zip="";}else{$zip=$_POST['zip'];}
if(empty($_POST['pref'])){$pref="";}else{$pref=$_POST['pref'];}
if(empty($_POST['city'])){$city="";}else{$city=$_POST['city'];}
if(empty($_POST['town'])){$town="";}else{$town=$_POST['town'];}
if(empty($_POST['street'])){$street="";}else{$street=$_POST['street'];}
if(empty($_POST['media'])){$media="";}else{$media=$_POST['media'];}
if(empty($_POST['question'])){$question="";}else{$question=$_POST['question'];}
if(empty($_POST['to'])){$to="";}else{$to=$_POST['to'];}
if(empty($_POST['cc'])){$cc="";}else{$cc=$_POST['cc'];}
if(empty($_POST['campaign'])){$campaign="";}else{$campaign=$_POST['campaign'];}
if(empty($_POST['id'])){$id="";}else{$id=$_POST['id'];}
if(empty($_POST['redirect'])){$redirect="";}else{$redirect=$_POST['redirect'];}
if(empty($_POST['thanks'])){$thanks="";}else{$thanks=$_POST['thanks'];}
if(empty($_POST['demand'])){$demand="";}else{$demand=$_POST['demand'];}
if(empty($_POST['nierucatalogs'])){$nierucatalogs="";$nierucatalogsString="";}else{$nierucatalogs=$_POST['nierucatalogs'];$nierucatalogsString = implode(", ", $nierucatalogs);}
?>

<?php
$utm_source = !empty($_POST['utm_source']) ? $_POST['utm_source'] : "";
$utm_medium = !empty($_POST['utm_medium']) ? $_POST['utm_medium'] : "";
$utm_campaign = !empty($_POST['utm_campaign']) ? $_POST['utm_campaign'] : "";
?>

<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><? echo $campaign?></title>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"
        integrity="sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM" crossorigin="anonymous">
    <!--  独自ライブラリ読み込み -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chosen/1.8.7/chosen.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/chosen/1.8.7/chosen.jquery.min.js"></script>
    <!--  /独自ライブラリ読み込み -->
</head>

<body>
<form action="https://khg-marketing.info/regist/" method="post"><!-- ブランド -->
<input type="hidden" name="brand" value="<? echo $brand;?>">
<input type="hidden" name="shop" value="<? echo $shop;?>">
<input type="hidden" name="date" value="<? echo $date;?>">
<input type="hidden" name="time" value="<? echo $time;?>">
<input type="hidden" name="sei" value="<? echo $sei;?>">
<input type="hidden" name="mei" value="<? echo $mei;?>">
<input type="hidden" name="sei_kana" value="<? echo $sei_kana;?>">
<input type="hidden" name="mei_kana" value="<? echo $mei_kana;?>">
<input type="hidden" name="phone" value="<? echo $phone;?>">
<input type="hidden" name="mail" value="<? echo $mail;?>">
<input type="hidden" name="zip" value="<? echo $zip;?>">
<input type="hidden" name="pref" value="<? echo $pref;?>">
<input type="hidden" name="city" value="<? echo $city;?>">
<input type="hidden" name="town" value="<? echo $town;?>">
<input type="hidden" name="street" value="<? echo $street;?>">
<input type="hidden" name="media" value="<? echo $media;?>">
<input type="hidden" name="question" value="<? echo $question;?>">
<input type="hidden" name="age" value="<? echo $age;?>">
<input type="hidden" name="campaign" value="<? echo $campaign;?>">
<input type="hidden" name="id" value="<? echo $id;?>">
<input type="hidden" name="thanks" value="<? echo $thanks;?>">
<input type="hidden" name="to" value="<? echo $to;?>">
<input type="hidden" name="cc" value="<? echo $cc;?>">
<input type="hidden" name="redirect" value="<? echo $redirect;?>">
<input type="hidden" name="demand" value="<? echo $demand;?>">
<input type="hidden" name="nierucatalogs" value="<? echo $nierucatalogsString;?>">

<input type="hidden" name="utm_source" value="<? echo $utm_source;?>">
<input type="hidden" name="utm_medium" value="<? echo $utm_medium;?>">
<input type="hidden" name="utm_campaign" value="<? echo $utm_campaign;?>">

<div class="border p-3" style="width:95%;max-width:960px;margin:0 auto;background-color:#fff;">
    <div class="my-4">
        <h5 class="text-center">入力内容のご確認</h5>
    </div>
<?php
if ( $shop !== "" ){ echo '
<div class="mb-0 row ">
    <div class="col"><h6 class="ps-2 ps-sm-5">来場希望場所</h6></div>
    <div class="col"><p>' . $shop . '</p></div>
</div>'
; } 
if ( $date !== "" ){ echo '
<div class="mb-0 row ">
    <div class="col"><h6 class="ps-2 ps-sm-5">来場希望日</h6></div>
    <div class="col"><p>' . $date . '</p></div>
</div>'
; } 
if ( $time !== "" ){ echo '
<div class="mb-0 row ">
    <div class="col"><h6 class="ps-2 ps-sm-5">来場希望時間</h6></div>
    <div class="col"><p>' . $time . '</p></div>
</div>'
; }
if (is_array($nierucatalogs) && !empty($nierucatalogs)) {
    foreach ($nierucatalogs as $nierucatalog) {
        echo '
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">希望カタログ</h6></div>
    <div class="col"><p>' . htmlspecialchars($nierucatalog) . '</p></div>
</div>';
    }
}

 ?>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">お名前(姓)</h6></div>
    <div class="col"><p><? echo $sei;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">お名前(名)</h6></div>
    <div class="col"><p><? echo $mei;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">お名前(セイ)</h6></div>
    <div class="col"><p><? echo $sei_kana;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">お名前(メイ)</h6></div>
    <div class="col"><p><? echo $mei_kana;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">ご年齢</h6></div>
    <div class="col"><p><? echo $age;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">携帯番号</h6></div>
    <div class="col"><p><? echo $phone;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">メールアドレス</h6></div>
    <div class="col"><p><? echo $mail;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">郵便番号</h6></div>
    <div class="col"><p><? echo $zip;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">都道府県</h6></div>
    <div class="col"><p><? echo $pref;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">市・区</h6></div>
    <div class="col"><p><? echo $city;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">町村</h6></div>
    <div class="col"><p><? echo $town;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">番地・建物名</h6></div>
    <div class="col"><p><? echo $street;?></p></div>
</div>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">ご予約のきっかけ</h6></div>
    <div class="col"><p><? echo $media;?></p></div>
</div>
<?php
if ( $demand !== "" ){ echo '
    <div class="mb-0 row ">
        <div class="col"><h6 class="ps-2 ps-sm-5">どのようなお住まいをご希望ですか？</h6></div>
        <div class="col"><p>' . $demand . '</p></div>
    </div>'
    ; } 
?>
<div class="mb-0 row">
    <div class="col"><h6 class="ps-2 ps-sm-5">その他質問やご希望</h6></div>
    <div class="col"><p><? echo $question;?></p></div>
</div>

<form action="https://khg-marketing.info/confirm/" method="POST">

</form>
<div class="text-center">
<input type="submit" class="btn btn-danger text-white px-5 rounded-pill my-5 mx-auto fw-bold" value="予約の確定">
<div class="txt bg-secondary p-3 rounded mb-0">
    <p class="text-white small">お客様に入力して頂いた氏名・住所・電話番号・E-mailアドレス等の個人情報は今後、弊社もしくは関係会社において、弊社が出展または主催する展示会・セミナーのご案内、弊社が提供する商品・サービスに関するご案内など各種情報のご提供、及び弊社営業部門からのご連絡などを目的として利用させて頂きます。弊社は、ご提供いただいた個人情報を、法令に基づく命令などを除いて、あらかじめお客様の同意を得ないで第三者に提供することはありません。</p>
</div>
</div>
</div>
</form>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
        integrity="sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz"
        crossorigin="anonymous"></script>
        <script type="text/javascript">
        let submitted = false;
    </script>

</body>

</html>