if (window.location.href.indexOf("kokubuhousinggroup") !== -1) {
  var postData = {};

  var meta = document.querySelector('meta[property="og:title"]');
  var ogTitle = meta ? meta.getAttribute("content") : "";

  // 分割代入やアロー関数を古い書き方に修正
  var titleParts = ogTitle.split("|");
  var campaignValue = titleParts.length > 0 ? titleParts[0].trim() : "";

  postData.campaign = campaignValue;
  postData.brand = "KH";

  var pathList = {
    name: "/html/body/div[3]/main/table/tbody/tr[1]/td[2]",
    kana: "/html/body/div[3]/main/table/tbody/tr[2]/td[2]",
    mail: "/html/body/div[3]/main/table/tbody/tr[3]/td[2]",
    mobile: "/html/body/div[3]/main/table/tbody/tr[4]/td[2]",
    pref: "/html/body/div[3]/main/table/tbody/tr[5]/td[2]",
    town: "/html/body/div[3]/main/table/tbody/tr[6]/td[2]",
    street: "/html/body/div[3]/main/table/tbody/tr[7]/td[2]",
    building: "/html/body/div[3]/main/table/tbody/tr[8]/td[2]",
    shop: "/html/body/div[3]/main/table/tbody/tr[9]/td[2]",
    age: "/html/body/div[3]/main/table/tbody/tr[10]/td[2]",
    medium: "/html/body/div[3]/main/table/tbody/tr[11]/td[2]",
    reserved_date: "/html/body/div[3]/div/h3",
  };

  // Object.entriesをfor文に修正
  var pathKeys = Object.keys(pathList);
  for (var k = 0; k < pathKeys.length; k++) {
    var key = pathKeys[k];
    var xpath = pathList[key];

    var node = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    ).singleNodeValue;

    var text = "";
    if (node && node.textContent) {
      text = node.textContent.trim();
    }

    if (
      key === "pref" ||
      key === "town" ||
      key === "street" ||
      key === "building"
    ) {
      postData["full_address"] = (postData["full_address"] || "") + text;
    } else if (key === "shop") {
      postData["shop"] = "KH" + text;
    } else {
      postData[key] = text;
    }
  }

  if (postData.reserved_date) {
    var dateText = postData.reserved_date;

    var match = dateText.match(/(\d{4})年(\d{2})月(\d{2})日/);
    if (match) {
      postData.reserved_date = match[1] + "-" + match[2] + "-" + match[3];
    }

    var timeMatch = dateText.match(/(\d{2}:\d{2})/);
    if (timeMatch) {
      postData.reserved_time = timeMatch[1];
    }
  }

  // 取得したデータをlocalStorageに保存
  localStorage.setItem("reserveData", JSON.stringify(postData));

  console.log(postData);
  if (!postData.name) {
    console.log("顧客情報の取得に失敗しました");
  }
}

if (window.location.href.indexOf("kokubuhousinggroup") !== -1) {
  (function () {
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
      window.location.href = "https://kh-house.jp/event_ok/";
      return;
    }

    // body を作る
    var paramsArr = [];
    keys.forEach(function (key) {
      var value = reserveData[key];
      if (value === undefined || value === null) value = "";
      paramsArr.push(
        encodeURIComponent(key) + "=" + encodeURIComponent(String(value)),
      );
    });
    var bodyString = paramsArr.join("&");
    var url = "https://khg-marketing.info/api/kengakuCloud/all/";

    // 1) sendBeacon を優先
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([bodyString], {
          type: "application/x-www-form-urlencoded;charset=UTF-8",
        });
        var ok = navigator.sendBeacon(url, blob);
        if (ok) {
          localStorage.removeItem("reserveData");
          window.location.href = "https://kh-house.jp/event_ok/";
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
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: bodyString,
          keepalive: true,
        })
          .then(function (res) {
            // keepalive ではレスポンスが得られない場合もあるがエラーが出れば catch へ
            localStorage.removeItem("reserveData");
            // 少し遅延して遷移（モバイルで安定させるため）
            setTimeout(function () {
              window.location.href = "https://kh-house.jp/event_ok/";
            }, 200);
          })
          .catch(function (err) {
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
      xhr.setRequestHeader(
        "Content-Type",
        "application/x-www-form-urlencoded;charset=UTF-8",
      );
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log("POST result:", xhr.responseText);
            localStorage.removeItem("reserveData");
            window.location.href = "https://kh-house.jp/event_ok/";
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
}
