<script>
(function(){
  try {
    var reserveDataRaw = localStorage.getItem("reserveData");
    var reserveData = reserveDataRaw ? JSON.parse(reserveDataRaw) : {};
  } catch (e) {
    console.error("localStorage read error:", e);
    var reserveData = {};
  }

  var keys = Object.keys(reserveData);
  if (keys.length === 0) {
    // データが無ければ遷移だけ行う（必要なら）
    window.location.href = "https://jusfy-home.com/reservation_ok/";
    return;
  }

  // body を作る
  var paramsArr = [];
  keys.forEach(function(key){
    var value = reserveData[key];
    if (value === undefined || value === null) value = "";
    paramsArr.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  });
  var bodyString = paramsArr.join("&");
  var url = "https://khg-marketing.info/api/kengakuCloud/";

  // 1) sendBeacon を優先
  if (navigator.sendBeacon) {
    try {
      var blob = new Blob([bodyString], { type: "application/x-www-form-urlencoded;charset=UTF-8" });
      var ok = navigator.sendBeacon(url, blob);
      if (ok) {
        localStorage.removeItem("reserveData");
        window.location.href = "https://jusfy-home.com/reservation_ok/";
        return;
      }
      // sendBeacon が false を返したらフォールバックへ
    } catch (e) {
      console.warn("sendBeacon failed, fallback to fetch/XHR", e);
    }
  }

  // 2) fetch keepalive を試す（モダンブラウザ）
  if (window.fetch) {
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: bodyString,
        keepalive: true
      }).then(function(res){
        // keepalive ではレスポンスが得られない場合もあるがエラーが出れば catch へ
        localStorage.removeItem("reserveData");
        // 少し遅延して遷移（モバイルで安定させるため）
        setTimeout(function(){ window.location.href = "https://jusfy-home.com/reservation_ok/"; }, 200);
      }).catch(function(err){
        console.error("fetch error:", err);
        // 最終フォールバックで XHR を試す
        sendWithXHR();
      });
      return;
    } catch (e) {
      console.warn("fetch keepalive not available, fallback", e);
    }
  }

  // 3) 最終フォールバック XHR（遷移は完了コールバック内で）
  function sendWithXHR() {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log("POST result:", xhr.responseText);
          localStorage.removeItem("reserveData");
          window.location.href = "https://jusfy-home.com/reservation_ok/";
        } else {
          console.error("POST error: status", xhr.status, xhr.responseText);
          // 遷移は行わないか、ユーザーに通知する
          alert("送信に失敗しました。ネットワークを確認してください。");
        }
      }
    };
    try {
      xhr.send(bodyString);
    } catch (e) {
      console.error("XHR send error:", e);
      alert("送信に失敗しました。");
    }
  }

  // 最後に XHR を呼ぶ（fetch/sendBeacon が使えない場合）
  sendWithXHR();
})();
</script>