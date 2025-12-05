/* global google */
import React, { useEffect, useState, useRef, useContext } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import axios from "axios";
import Menu from "./Menu";
import AuthContext from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Table from "react-bootstrap/Table";
import Blue from "../assets/images/blue_ping.png";
import Red from "../assets/images/red_ping.png";
import MenuDev from "./MenuDev";

const libraries = ["marker"];

const Map = () => {
  const navigate = useNavigate();
  const { brand } = useContext(AuthContext);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyAJfDaeKmyprID8wKVgPCv_9ph_-y_wSbg",
    libraries,
  });

  const [originalMarkers, setOriginalMarkers] = useState([]);
  const [filteredMarkers, setFilteredMarkers] = useState([]);
  const [advMarkers, setAdvMarkers] = useState([]);
  const [medium, setMedium] = useState([]);
  const [shop, setShop] = useState([]);
  const [zoom, setZoom] = useState(10);
  const [iconSize, setIconSize] = useState(null);
  const [monthArray, setMonthArray] = useState([]);
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [targetMedium, setTargetMedium] = useState("");
  const [targetBrand, setTargetBrand] = useState("");
  const [targetStatus, setTargetStatus] = useState("");
  const [targetShop, setTargetShop] = useState("");
  const [areaList, setAreaList] = useState([]);
  const [slice, setSlice] = useState(20);

  const mapRef = useRef(null);
  const initialCenter = { lat: 31.584172816548488, lng: 130.7938207962173 };

  /** 年月配列を生成 */
  const getYearMonthArray = (startYear, startMonth) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const yearMonthArray = [];
    let year = startYear;
    let month = startMonth;

    while (
      year < currentYear ||
      (year === currentYear && month <= currentMonth)
    ) {
      const formattedMonth = month.toString().padStart(2, "0");
      yearMonthArray.push(`${year}/${formattedMonth}`);
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    return yearMonthArray;
  };

  /** エリアリストを生成 */
  const buildAreaList = (filtered) => {
    const filteredArea = filtered.map((item) => {
      const parts = item.full_address.split(" ");
      const match = parts.slice(0, 3).join("");
      const regex = /[0-9０-９]/;
      const idx = match.search(regex);
      return idx === -1 ? match : match.substring(0, idx);
    });

    return [...new Set(filteredArea)]
      .map((name) => ({
        name,
        count: filteredArea.filter((area) => area === name).length,
      }))
      .sort((a, b) => b.count - a.count);
  };

  /** AdvancedMarkerElement を生成 */
  const createMarkers = async (filtered) => {
    const { AdvancedMarkerElement } = await window.google.maps.importLibrary(
      "marker"
    );

    // 既存マーカーをクリア
    advMarkers.forEach((m) => (m.map = null));

    const newMarkers = filtered.map((item) => {
      const [latStr, lngStr] = item.lat_lng.split(",");
      const lat = Number(latStr);
      const lng = Number(lngStr);

      const pin = document.createElement("img");
      pin.src = item.contract ? Red : Blue;
      pin.style.width = `${iconSize?.width || 10}px`;
      pin.style.height = "auto";

      return new AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat, lng },
        title: item.label,
        content: pin,
      });
    });

    setAdvMarkers(newMarkers);
  };

  /** 初期データ取得 */
  useEffect(() => {
    if (!brand || brand.trim() === "") {
      navigate("/");
      return;
    }
    if (!isLoaded) return;

    setMonthArray(getYearMonthArray(2025, 1));

    const fetchData = async () => {
      try {
        const headers = {
          Authorization: "4081Kokubu",
          "Content-Type": "application/json",
        };
        const [customerResponse, mediumResponse, shopResponse] =
          await Promise.all([
            axios.post(
              "https://khg-marketing.info/dashboard/api/",
              { demand: "customer_map" },
              { headers }
            ),
            axios.post(
              "https://khg-marketing.info/dashboard/api/",
              { demand: "medium_list" },
              { headers }
            ),
            axios.post(
              "https://khg-marketing.info/dashboard/api/",
              { demand: "shop_list" },
              { headers }
            ),
          ]);
        const filtered = customerResponse.data.filter((item) => item.lat_lng);
        setOriginalMarkers(filtered);
        setMedium(mediumResponse.data);
        setShop(shopResponse.data);
      } catch (e) {
        console.error("データ取得エラー:", e);
      }
    };

    fetchData();
  }, [isLoaded]);

  /** フィルタリング処理 */
  useEffect(() => {
    if (!isLoaded) return;

    let startDate = startMonth ? new Date(`${startMonth}/01`) : null;
    let endDate = null;
    if (endMonth) {
      const [year, month] = endMonth.split("/").map(Number);
      endDate = new Date(year, month, 0);
    }

    const filtered = originalMarkers.filter((item) => {
      const targetDate = new Date(item.register);
      return (
        (!startDate || targetDate >= startDate) &&
        (!endDate || targetDate <= endDate) &&
        (!targetMedium || item.medium === targetMedium) &&
        (!targetBrand || item.shop.slice(0, 2) === targetBrand) &&
        (!targetStatus || item.status === targetStatus) &&
        (!targetShop || item.shop === targetShop)
      );
    });

    setFilteredMarkers(filtered);
    setAreaList(buildAreaList(filtered));
    createMarkers(filtered);
  }, [
    isLoaded,
    startMonth,
    endMonth,
    originalMarkers,
    targetMedium,
    targetBrand,
    targetStatus,
    targetShop,
    iconSize,
  ]);

  /** ズームに応じてマーカーサイズを変更 */
  useEffect(() => {
    if (!isLoaded) return;

    const baseSize = 10;
    const maxSize = 30;
    const minZoom = 8;
    const maxZoom = 16;

    const clampedZoom = Math.min(Math.max(zoom, minZoom), maxZoom);
    const scale = (clampedZoom - minZoom) / (maxZoom - minZoom);
    const sizeValue = baseSize + scale * (maxSize - baseSize);

    setIconSize(new window.google.maps.Size(sizeValue, sizeValue));
  }, [isLoaded, zoom]);

  const containerStyle = { width: "100%", height: "700px" };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="outer-container" style={{ width: "100vw" }}>
      <div className="d-flex">
        <div className="modal_menu" style={{ width: "20%" }}>
          <MenuDev brand={brand}/>
        </div>
        <div className="content customer p-2">
          <div className="d-flex flex-wrap align-items-center">
            <div className="m-1">
              <select
                className="target"
                onChange={(e) => setStartMonth(e.target.value)}
              >
                <option value="" selected>
                  開始月
                </option>
                {monthArray.map((month, index) => (
                  <option key={index} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <span style={{ marginLeft: "3px" }}>～</span>
            <div className="m-1">
              <select
                className="target"
                onChange={(e) => setEndMonth(e.target.value)}
              >
                <option value="" selected>
                  終了月
                </option>
                {monthArray.map((month, index) => (
                  <option key={index} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div className="m-1">
              <select
                className="target"
                onChange={(e) => setTargetMedium(e.target.value)}
              >
                <option value="">販促媒体を選択</option>
                {medium.map((item, index) => (
                  <option key={index} value={item.medium}>
                    {item.medium}
                  </option>
                ))}
              </select>
            </div>
            <div className="m-1">
              <select
                className="target"
                onChange={(e) => setTargetStatus(e.target.value)}
              >
                <option value="">ステータスを選択</option>
                <option value="見込み">見込み</option>
                <option value="契約済み">契約済み</option>
                <option value="会社管理">会社管理</option>
                <option value="失注">失注</option>
              </select>
            </div>
            <div className="m-1">
              <select
                className="target"
                onChange={(e) => setTargetBrand(e.target.value)}
              >
                <option value="">ブランドを選択</option>
                <option value="KH">KH</option>
                <option value="DJ">DJH</option>
                <option value="なご">なごみ</option>
                <option value="2L">2L</option>
                <option value="PG">PG HOUSE</option>
                <option value="JH">JH</option>
              </select>
            </div>
            <div className="m-1">
              <select
                className="target"
                onChange={(e) => setTargetShop(e.target.value)}
              >
                <option value="">店舗を選択</option>
                {shop
                  .filter((item) => !item.shop.includes("未設定"))
                  .map((item) => (
                    <option value={item.shop}>{item.shop}</option>
                  ))}
              </select>
            </div>
          </div>
          <div className="table-wrapper">
            <div className="list_table">
              <div className="d-flex">
                <div style={{ width: "70%" }}>
                  <div
                    className="d-flex"
                    style={{ fontSize: "12px", marginBottom: "10px" }}
                  >
                    <div style={{ width: "14px" }}>
                      <img src={Blue} className="w-100" />
                    </div>
                    <div style={{ marginLeft: "4px" }}>
                      来場済み（未契約者）
                    </div>
                    <div style={{ width: "14px", marginLeft: "20px" }}>
                      <img src={Red} className="w-100" />
                    </div>
                    <div style={{ marginLeft: "4px" }}>契約者</div>
                  </div>
                  <GoogleMap
                    mapContainerStyle={containerStyle}
                    zoom={zoom}
                    onLoad={(map) => {
                      mapRef.current = map;
                      map.setCenter(initialCenter); // 初期表示だけ中心を設定
                    }}
                    onZoomChanged={() => {
                      if (mapRef.current) {
                        const currentZoom = mapRef.current.getZoom();
                        if (currentZoom !== undefined) {
                          setZoom(currentZoom);
                        }
                      }
                    }}
                    options={{
                      gestureHandling: "greedy",
                      scrollwheel: true,
                      mapId: "4b6e2e3028fa3ddba1806a73", // ★ AdvancedMarkerElement を使う場合は必須
                    }}
                  >
                    {/* Marker はここでは描画しない */}
                  </GoogleMap>
                </div>
                <div
                  style={{
                    paddingLeft: "10px",
                    fontSize: "13px",
                    width: "20%",
                  }}
                >
                  <Table>
                    <tbody>
                      {areaList.slice(slice - 20, slice).map((item) => (
                        <tr>
                          <td>{item.name}</td>
                          <td>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <div className="d-flex justify-content-around">
                    <div
                      onClick={() => {
                        if (slice === 20) return;
                        setSlice(slice - 20);
                      }}
                      className={slice === 20 ? "transparent" : "hover"}
                    >
                      前へ
                    </div>
                    <div
                      onClick={() => {
                        setSlice(slice + 20);
                      }}
                      className={
                        slice >= areaList.length ? "transparent" : "hover"
                      }
                    >
                      次へ
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;
