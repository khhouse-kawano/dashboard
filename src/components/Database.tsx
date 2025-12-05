import React, { useEffect, useRef, useState, useContext, lazy } from 'react';
import { useNavigate } from "react-router-dom";
import Table from "react-bootstrap/Table";
import axios from "axios";
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../context/AuthContext';
import type { MasterData } from "./MasterData";
import type { MasterDataWithMeta } from "./MasterDataWithMeta";
import type { MasterDataSelected } from "./MasterDataSelected";
import MenuDev from "./MenuDev";
import { convertLength } from '@mui/material/styles/cssUtils';

type shopList = { brand: string, shop: string };
type staffList = { name: string; shop: string; pg_id: string; category: number };
type customerList = { id: string; shop: string; name: string; staff: string; status: string; rank: string; medium: string; reserve: string; register: string; before_survey: number; before_interview: number; after_interview: number; call_status: string, reserved_status: string, full_address: string; phone_number: string; };
type MediumType = { id: number, medium: string, category: string, sort_key: number, response_medium: number }
type CallAction = {
  day: string;
  time: string;
  action: string;
  note: string;
};
type CallLog = {
  id: string;
  shop: string;
  name: string;
  status: string;
  reserved_status: string;
  call_log: CallAction[];
  add: Boolean;
};


const Database = () => {
  const navigate = useNavigate();
  const { brand } = useContext(AuthContext);
  const [shopArray, setShopArray] = useState<shopList[]>([]);
  const [mediumArray, setMediumArray] = useState<string[]>([]);
  const [staffArray, setStaffArray] = useState<staffList[]>([]);
  const [monthArray, setMonthArray] = useState<string[]>([]);
  const [originalDatabase, setOriginalDatabase] = useState<customerList[]>([]);
  const [filteredDatabase, setFilteredDatabase] = useState<customerList[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('')
  const [selectedRegister, setSelectedRegister] = useState<string>('')
  const [selectedReserve, setSelectedReserve] = useState<string>('')
  const [selectedRank, setSelectedRank] = useState<string>('')
  const [selectedMedium, setSelectedMedium] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [searchedName, setSearchedName] = useState<string>('')
  const [searchedStaff, setSearchedStaff] = useState<string>('');
  const [searchedPhone, setSearchedPhone] = useState<string>('')
  const [displayLength, setDisplayLength] = useState<number>(20);
  const [beforeSurvey, setBeforeSurvey] = useState<number | null>(null);
  const [beforeInterview, setBeforeInterview] = useState<number | null>(null);
  const [afterInterview, setAfterInterview] = useState<number | null>(null);
  const [callStatus, setCallStatus] = useState<string>('');
  const [activePage, setActivePage] = useState<number>(1);
  const [sliceStart, setSliceStart] = useState<number>(0);
  const [modalShow, setModalShow] = useState(false);
  const [basicLength, setBasicLength] = useState<number>(20);
  const [question, setQuestion] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string[]>([]);
  const createEmptyMasterData = (): MasterData => {
    const keys = Object.keys({} as MasterData) as (keyof MasterData)[];
    return keys.reduce((acc, key) => {
      acc[key] = '';
      return acc;
    }, {} as MasterData);
  };

  const createEmptyMasterDataWithMeta = (): MasterDataWithMeta => {
    const keys = Object.keys({} as MasterData) as (keyof MasterData)[];
    return keys.reduce((acc, key) => {
      acc[key] = { value: '', updated: false };
      return acc;
    }, {} as MasterDataWithMeta);
  };

  const createEmptyMasterDataSelected = (): MasterDataSelected => {
    const keys = Object.keys({} as MasterData) as (keyof MasterData)[];
    return keys.reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {} as MasterDataSelected);
  };
  const [masterData, setMasterData] = useState<MasterData>(createEmptyMasterData());
  const [updatedData, setUpdatedData] = useState<MasterDataWithMeta>(createEmptyMasterDataWithMeta());
  const [selected, setSelected] = useState<MasterDataSelected>(createEmptyMasterDataSelected);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const formatDate = `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  useEffect(() => {
    // if (!brand || brand.trim() === "") navigate("/");
    const getYearMonthArray = (startYear: number, startMonth: number) => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const yearMonthArray: string[] = [];
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
    setMonthArray(getYearMonthArray(2025, 1));

    const fetchData = async () => {
      try {
        const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
        const [customerResponse, shopResponse, mediumResponse, staffResponse, masterResponse] = await Promise.all([
          axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_database" }, { headers }),
          axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
          axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
          axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
          axios.post("https://khg-marketing.info/dashboard/api/", { demand: "master_database" }, { headers })
        ]);
        await setOriginalDatabase(customerResponse.data);
        await setShopArray(shopResponse.data.filter((item: shopList) => !item.shop.includes('店舗未設定')));
        await setMediumArray(mediumResponse.data.map((item: MediumType) => item.medium));
        await setDisplayLength(customerResponse.data.length);
        await setStaffArray(staffResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const filtered = originalDatabase.filter(item => {
        if (selectedShop && !item.shop.includes(selectedShop)) return false;
        if (selectedRegister && !item.register.includes(selectedRegister)) return false;

        if (selectedReserve === 'notVisited') {
          if (!(item.reserved_status !== '' && item.reserve === '')) return false;
        } else if (selectedReserve && !item.reserve.includes(selectedReserve)) {
          return false;
        }

        if (selectedRank && !item.rank.includes(selectedRank)) return false;
        if (selectedMedium && !item.medium.includes(selectedMedium)) return false;
        if (selectedStatus && !item.status.includes(selectedStatus)) return false;
        let formattedName;
        if (searchedName.includes('&')) {
          formattedName = searchedName.split('&')[0];
        } else if (searchedName.includes('+')) {
          formattedName = searchedName.split('+')[0];
        } else {
          formattedName = searchedName
        }
        if (searchedName && !item.name.includes(formattedName)) return false;
        if (searchedStaff && !item.staff.includes(searchedStaff.split(' ')[0])) return false;
        const formattedNumber = searchedName.includes('&') ? searchedName.split('&')[1] : searchedPhone;
        if ((searchedPhone || searchedName) && !item.phone_number.includes(formattedNumber)) return false;
        const formattedAddress = searchedName.includes('+') ? searchedName.split('+')[1] : '';
        if ((formattedAddress) && !item.full_address.includes(formattedAddress)) return false;
        if (beforeSurvey !== null && item.before_survey !== beforeSurvey) return false;
        if (beforeInterview !== null && item.before_interview !== beforeInterview) return false;
        if (afterInterview !== null && item.after_interview !== afterInterview) return false;
        if (callStatus && item.call_status !== callStatus) return false;
        return true;
      });

      await setFilteredDatabase(filtered);
      await setDisplayLength(filtered.length);
    };

    setActivePage(1);
    setSliceStart(0);
    fetchData();
  }, [
    originalDatabase,
    selectedShop,
    selectedRegister,
    selectedReserve,
    selectedRank,
    selectedMedium,
    selectedStatus,
    searchedName,
    searchedStaff,
    beforeSurvey,
    beforeInterview,
    afterInterview,
    callStatus,
    searchedPhone
  ]);


  // ページングリンク

  let page1;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page1 = activePage - 4;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page1 = activePage - 3;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page1 = activePage - 2;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page1 = activePage - 2;
  } else {
    page1 = 1
  }

  let page2;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page2 = activePage - 3;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page2 = activePage - 2;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page2 = activePage - 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page2 = activePage - 1;
  } else if (Math.ceil(displayLength / basicLength) < 2) {
    page2 = null;
  } else {
    page2 = 2
  }

  let page3;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page3 = activePage - 2;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page3 = activePage - 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page3 = activePage;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page3 = activePage;
  } else if (Math.ceil(displayLength / basicLength) < 3) {
    page3 = null;
  } else {
    page3 = 3;
  }

  let page4;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page4 = activePage - 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page4 = activePage;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page4 = activePage + 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page4 = activePage + 1;
  } else if (Math.ceil(displayLength / basicLength) < 4) {
    page4 = null;
  } else {
    page4 = 4;
  }

  let page5;
  if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) === activePage) {
    page5 = activePage;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 1) {
    page5 = activePage + 1;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6 && Math.ceil(displayLength / basicLength) - activePage === 2) {
    page5 = activePage + 2;
  } else if (activePage > 3 && Math.ceil(displayLength / basicLength) > 6) {
    page5 = activePage + 2;
  } else if (Math.ceil(displayLength / basicLength) < 5) {
    page5 = null;
  } else {
    page5 = 5;
  }

  const handlePageClick = async (page: number) => {
    setActivePage(page);
    setSliceStart((page - 1) * basicLength);
  };

  const [callLog, setCallLog] = useState<CallLog>({
    id: '',
    shop: '',
    name: '',
    status: '',
    reserved_status: '',
    call_log: [],
    add: false
  });

  // モーダル画面
  const showSurvey = async (idValue: string, request: string, name: string, shop: string) => {
    if (request === 'before_visit') {
      const nameValue = name.replace(/　| /g, "");
      const brandValue = shop.slice(0, 2);
      const postData = {
        name: nameValue,
        brand: brandValue,
        demand: 'show_before_survey'
      };
      const fetchData = async () => {
        try {
          const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
          const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, { headers });
          const filtered: string[] = Object.values(response.data);
          setAnswer(filtered.slice(4));
          setQuestion(['来場前アンケート', '氏名', 'いつから検討を始めたか', '入居希望時期', '何社の住宅会社へ訪問したか', '検討し始めた理由', 'その他検討理由', '今後の予定'
            , 'その他行動予定', '希望する家の広さ', '希望の間取り', '重視項目', '入居予定人数', '総予算', '月々の希望返済額', '前年度年収', '勤続年数', '年収のある家族', '年収のある家族の年収'
            , '自己資金での支払い予定', 'その他ローン', '来場日に希望すること', 'その他希望', 'どのような住まいが希望か', 'その他希望', '希望エリア', '紹介者様', 'メールアドレス'
          ]);
        } catch (error) {
          alert('アンケートデータの取得に失敗');
          console.log(error);
        }
      };
      await fetchData();
    } else if (request === 'before_interview') {
      const nameValue = name.replace(/　| /g, "");
      const brandValue = shop.slice(0, 2);
      const postData = {
        id: idValue,
        name: nameValue,
        brand: brandValue,
        demand: 'show_before_interview'
      };
      const fetchData = async () => {
        try {
          const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
          const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, { headers });
          const filtered: string[] = Object.values(response.data);
          setAnswer(filtered.slice(2, 15))
          setQuestion(['面談前アンケート', '氏名', '来場店舗', 'お問合せのきっかけ', 'おうちづくりを検討したきっかけ', '注文住宅に興味を持った理由', '新築の計画', '希望入居時期', '土地の状況'
            , '建築予定地', 'こだわりたいポイント', '総予算', '要望', 'その他意見等']);
        } catch (error) {
          alert('アンケートデータの取得に失敗');
          console.log(error);
        }
      };
      await fetchData();
    } else if (request === 'after_interview') {
      const nameValue = name.replace(/　| /g, "");
      const brandValue = shop.slice(0, 2);
      const postData = {
        id: idValue,
        name: nameValue,
        brand: brandValue,
        demand: 'show_after_interview'
      };
      const fetchData = async () => {
        try {
          const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
          const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, { headers });
          const filtered: string[] = Object.values(response.data);
          const sliced1 = filtered.slice(4);
          const result = sliced1.slice(0, 1).concat(sliced1.slice(2));

          setAnswer(result);
          setQuestion(['面談後アンケート', '氏名', '面談で伝えた内容', '持ち家が欲しいと思えたか', '条件さえ整えば今すぐ家を建てようと思えたか', '最も重視したい項目', '弊社は家づくりの第一候補となれたか', 'ほかで気になるメーカー', '接客担当'
            , '接客の満足度', '提案の満足度', 'もっと知りたかった点、改善してほしい点', '担当変更について', '次回相談したい内容や要望、質問など']);
        } catch (error) {
          alert('アンケートデータの取得に失敗');
          console.log(error);
        }
      };
      await fetchData();
    } else if (request === 'information_edit') {
      const postData = {
        id: idValue,
        demand: 'show_customer_interview'
      };
      const postData2 = {
        id: idValue,
        demand: 'show_customer_call_log'
      };
      const fetchData = async () => {
        try {
          const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
          const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, { headers });
          const callRes = await axios.post('https://khg-marketing.info/dashboard/api/', postData2, { headers });
          setMasterData(response.data);
          console.log(callRes.data)
          setCallLog({
            id: callRes.data.id ?? response.data.id,
            shop: callRes.data.shop ?? response.data.in_charge_store,
            name: callRes.data.name ?? response.data.customer_contacts_name,
            status: callRes.data.status === 'not_found' ? '' : callRes.data.status,
            reserved_status: callRes.data.reserved_status ?? '',
            call_log: typeof callRes.data.call_log === 'string' && callRes.data.call_log.trim() !== ''
              ? JSON.parse(callRes.data.call_log)
              : callRes.data.call_log ?? [],

            add: false
          });
          setQuestion(['顧客情報修正']);
        } catch (error) {
          alert('アンケートデータの取得に失敗');
          console.log(error);
        };
      };
      await fetchData();
    }
    setModalShow(true);
  };

  const modalClose = () => {
    setAnswer([]);
    setQuestion([]);
    setModalShow(false);
    setSelected(createEmptyMasterDataSelected);
    setMasterData(createEmptyMasterData);
    setUpdatedData(createEmptyMasterDataWithMeta);
    setCall({
      status: '', day: '', time: '', action: '', note: ''
    });
  };

  const toHalfWidth = (str: string) => {
    return str.replace(/[！-～]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    ).replace(/　/g, ' ');
  };

  const handleSetSelected = async (target: string, block: string) => {
    setSelected(createEmptyMasterDataSelected);
    setSelected(prev => ({
      ...prev,
      [target]: true
    }));
    if (block === 'header') document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    setUpdatedData(prev => ({
      ...prev,
      inquiry_reason: { value: masterData.inquiry_reason, updated: masterData.inquiry_reason ? true : false },
      house_hunting_motivation: { value: masterData.house_hunting_motivation, updated: masterData.house_hunting_motivation ? true : false },
      customer_desired_floor: { value: masterData.customer_desired_floor, updated: masterData.customer_desired_floor ? true : false },
      customer_desired_period: { value: masterData.customer_desired_period, updated: masterData.customer_desired_period ? true : false },
      customer_desired_estate: { value: masterData.customer_desired_estate, updated: masterData.customer_desired_estate ? true : false },
      customer_desired_order: { value: masterData.customer_desired_order, updated: masterData.customer_desired_order ? true : false },
    })
    )
  }, [masterData]);

  const inquiryReasons: string[] = ['友人・知人から聞いた', 'SNS(Instagram/Facebook/youtube/その他)', '看板を見た', '親・親戚から聞いた', 'インターネット検索', '新聞を見た', 'まとめサイトを見た', 'チラシを見た', 'その他'];
  const houseHuntingMotivation: string[] = ['家賃がもったいない', '子どもが進学する', '土地をもらった', '家族が増える（減る）', '友人・知人が家を建てた', '家づくりは特に考えていない', '土地が見つかった', '親から勧められた', '工事費用が高くなる前に', '年齢的にそろそろ', '賃貸だと老後（退職後）が心配', '今の住まいが狭い', '水回り（キッチン・風呂・トイレ・洗面）が不便', '騒音が気になる', '収納が足りない', 'その他', '気密・断熱性にこだわりたい', '間取りにこだわりたい', '他人とは違った家にしたい', '耐震性にこだわりたい', 'インテリアにこだわりたい', '外観デザインにこだわりたい', '建築予定地が既にある', '収納にこだわりたい', '注文住宅にこだわりはない']

  const [sending, setSending] = useState<boolean>(true);
  const [call, setCall] = useState({
    status: '',
    day: '',
    time: '',
    action: '',
    note: ''
  });

  const handleSave = async () => {
    await setSending(false);
    const data = {
      ...masterData,
      request: 'before_interview_zero'
    };
    let postData;
    let calendarAdd;
    if (call.day && call.action) {
      const newCallLog = {
        ...callLog,
        call_log: [
          ...callLog.call_log,
          { day: call.day, time: call.time ?? '', action: call.action, note: call.note ?? '' }
        ]
      };
      postData = {
        ...newCallLog,
        demand: 'update_call_log'
      };
      calendarAdd = true;
    } else {
      postData = {
        ...callLog,
        demand: 'update_call_log'
      };
      calendarAdd = callLog.add;
    }

    if (callLog.status || (call.day && call.action && call.note)) {
      try {
        const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
        await axios.post("https://khg-marketing.info/dashboard/api/", postData, { headers });
      } catch (error) {
        console.error("データ取得エラー:", error);
      }
    }

    try {
      const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
      await axios.post("https://khg-marketing.info/survey/api/", data, { headers });
    } catch (error) {
      console.error("データ取得エラー:", error);
    }

    try {
      const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
      await axios.post("https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/update", data, { headers });
    } catch (error) {
      console.error("データ取得エラー:", error);
    }
    console.log(masterData);

    if (brand === 'insideSales' && calendarAdd && postData.call_log[postData.call_log.length - 1]['time']) {
      const pad = (num: number): string => String(num).padStart(2, '0');

      const parseDateAndTime = (dateStr: string, timeStr: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = timeStr.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes, 0);
      };

      const formatLocalISO = (d: Date): string => {
        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        const seconds = pad(d.getSeconds());
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };

      const lastLog = postData.call_log[postData.call_log.length - 1];
      const startDate = parseDateAndTime(lastLog.day, lastLog.time);
      const endDate = new Date(startDate.getTime() + 10 * 60000); // 10分後

      const data = {
        name: callLog.name,
        detail: `${lastLog.action}\n${lastLog.note}`,
        startTime: formatLocalISO(startDate),
        endTime: formatLocalISO(endDate)
      };


      const fetchCallData = async () => {
        try {
          const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
          await axios.post("https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/add_event", data, { headers });
        } catch (error) {
          console.error("データ取得エラー:", error);
        }
      };
      await fetchCallData();
    }

    const fetchData = async () => {
      try {
        const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
        const customerResponse = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_database" }, { headers });
        await setOriginalDatabase(customerResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    await fetchData();
    await modalClose();
    await setSending(true);
    await setCall({
      status: '',
      day: '',
      time: '',
      action: '',
      note: ''
    });
  };
  const [open, setOpen] = useState(false);

  const convertCsv = async() =>{
    const postData = {
      shop: selectedShop,
      registered: selectedRegister,
      reserve: selectedReserve,
      rank: selectedRank,
      medium: selectedMedium,
      status: selectedStatus,
      beforeSurvey: beforeSurvey,
      afterInterview: afterInterview,
      beforeInterview: beforeInterview,
      callStatus: callStatus
    };

    console.log(postData);

    const fetchData = async () =>{

    };

    fetchData();
  };

  return (
    <div className='outer-container'>
      <div className="d-flex">
        <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} />
        </div>
        <div className="header_sp">
          <i className="fa-solid fa-bars hamburger"
            onClick={() => setOpen(true)} />
        </div>
        <div className={`modal_menu_sp ${open ? "open" : ""}`}>
          <i className="fa-solid fa-xmark hamburger position-absolute"
            onClick={() => setOpen(false)} />
          <MenuDev brand={brand} />
        </div>
        <div className='content database bg-white p-2'>
          <div className='p-3 d-flex flex-wrap'>
            <div className="m-1">
              <select className="target" onChange={(e) => setSelectedShop(e.target.value)}>
                <option value="">店舗を選択</option>
                {shopArray.map((item, index) => <option key={index} value={item.shop}>{item.shop}</option>)}
              </select>
            </div>
            <div className="m-1">
              <select className="target" onChange={(e) => setSelectedRegister(e.target.value)}>
                <option value="">反響月を選択</option>
                {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="m-1">
              <select className="target" onChange={(e) => setSelectedReserve(e.target.value)}>
                <option value="">初回来場月を選択</option>
                <option value="notVisited">未来場・来場キャンセル</option>
                {monthArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="m-1">
              <select className="target" onChange={(e) => setSelectedRank(e.target.value)}>
                <option value="">ランクを選択</option>
                <option value="Aランク">Aランク</option>
                <option value="Bランク">Bランク</option>
                <option value="Cランク">Cランク</option>
                <option value="Dランク">Dランク</option>
                <option value="Eランク">Eランク</option>
              </select>
            </div>
            <div className="m-1">
              <select className="target" onChange={(e) => setSelectedMedium(e.target.value)}>
                <option value="">販促媒体を選択</option>
                {mediumArray.map((item, index) => <option key={index} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="m-1">
              <select className="target" onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="">ステータスを選択</option>
                <option value="見込み">見込み</option>
                <option value="契約済み">契約済み</option>
                <option value="失注">失注</option>
                <option value="会社管理">会社管理</option>
              </select>
            </div>
            <div className="m-1">
              <select className="target" onChange={(e) => {
                const value = e.target.value;
                setBeforeSurvey(value === "" ? null : Number(value));
              }}
              >
                <option value="">来場前アンケート</option>
                <option value="1">回答済み</option>
              </select>
            </div>
            <div className="m-1">
              <select className="target" onChange={(e) => {
                const value = e.target.value;
                setBeforeInterview(value === "" ? null : Number(value));
              }}>
                <option value="">面談前アンケート</option>
                <option value="1">回答済み</option>
              </select>
            </div>
            <div className="m-1">
              <select className="target" onChange={(e) => {
                const value = e.target.value;
                setAfterInterview(value === "" ? null : Number(value));
              }}>
                <option value="">面談後アンケート</option>
                <option value="1">回答済み</option>
              </select>
            </div>
            <div className="m-1">
              <select className="target" onChange={(e) => {
                setCallStatus(e.target.value);
              }}>
                <option value="">架電状況</option>
                <option value="未通電">未通電</option>
                <option value="継続">継続</option>
                <option value="来場アポ">来場アポ</option>
                <option value="来場済み">来場済み</option>
                <option value="架電停止">架電停止</option>
              </select>
            </div>
            <div className="m-1">
              <input className="target" placeholder='顧客名で検索(&電話番号+住所)' onChange={(e) => setSearchedName(e.target.value)} />
            </div>
            <div className="m-1">
              <input className="target" placeholder='営業名で検索' onChange={(e) => setSearchedStaff(e.target.value)} />
            </div>
            <div className="m-1">
              <input className="target" placeholder='電話番号で検索' onChange={(e) => setSearchedPhone(e.target.value)} />
            </div>
          </div>
          <div className="d-md-flex">
            <div className="d-flex flex-wrap align-items-center">
              <div className="">{filteredDatabase.length}<span style={{ fontSize: '12px' }}> 件中 {sliceStart + 1}件~{filteredDatabase.length > activePage * basicLength ? activePage * basicLength : filteredDatabase.length}件</span></div>
              <div className="ms-1" style={{ fontSize: '11px' }}>
                表示件数
                <select style={{ fontSize: '11px', borderRadius: '5px', width: '70px' }} onChange={(e) => setBasicLength(Number(e.target.value))}>
                  <option value='20'>20件</option>
                  <option value='50'>50件</option>
                  <option value='100'>100件</option>
                  <option value='500'>500件</option>
                </select>
              </div>
            </div>
            <div className="d-flex flex-wrap align-items-center">
              <div className="m-1 pt-3">
                <ul className="custom-pagination">
                  <li>
                    <button onClick={() => handlePageClick(1)}>«</button>
                  </li>
                  <li>
                    <button onClick={() => handlePageClick(Math.max(activePage - 1, 1))}>‹</button>
                  </li>
                  <li className={activePage === page1 ? 'active' : ''}>
                    <button onClick={() => handlePageClick(page1)}>{page1}</button>
                  </li>
                  {page2 !== null && (
                    <li className={activePage === page2 ? 'active' : ''}>
                      <button onClick={() => handlePageClick(page2)}>{page2}</button>
                    </li>
                  )}
                  {page3 !== null && (
                    <li className={activePage === page3 ? 'active' : ''}>
                      <button onClick={() => handlePageClick(page3)}>{page3}</button>
                    </li>
                  )}
                  {page4 !== null && (
                    <li className={activePage === page4 ? 'active' : ''}>
                      <button onClick={() => handlePageClick(page4)}>{page4}</button>
                    </li>
                  )}
                  {page5 !== null && (
                    <li className={activePage === page5 ? 'active' : ''}>
                      <button onClick={() => handlePageClick(page5)}>{page5}</button>
                    </li>
                  )}
                  <li>
                    <button onClick={() => handlePageClick(activePage + 1 < Math.ceil(displayLength / basicLength) ? activePage + 1 : Math.ceil(displayLength / basicLength))}>›</button>
                  </li>
                  <li>
                    <button onClick={() => handlePageClick(Math.ceil(displayLength / basicLength))}>»</button>
                  </li>
                </ul>
              </div>
            <div className="bg-primary text-white ms-1 rounded" style={{fontSize: '10px', padding: '5px 10px', cursor: 'pointer'}}
            onClick={()=>convertCsv()}>CSV出力</div>
            </div>
          </div>
          <div className='table-wrapper'>
            <Table responsive style={{ fontSize: '11px', textAlign: 'center' }} bordered striped className='list_table database_list'>
              <thead>
                <tr>
                  <td>顧客情報編集</td>
                  <td>店舗</td>
                  <td>顧客名</td>
                  <td>担当営業</td>
                  <td>ステータス</td>
                  <td>反響日</td>
                  <td>初回来場日<br /><span style={{ fontSize: '9px' }}>(来場予約日)</span></td>
                  <td>ランク</td>
                  <td>販促媒体</td>
                  <td>架電状況</td>
                  <td>来場前<br />アンケート</td>
                  <td>面談前<br />アンケート</td>
                  <td>面談後<br />アンケート</td>
                </tr>
              </thead>
              <tbody>
                {filteredDatabase.slice(sliceStart, sliceStart + basicLength).map((item, index) =>
                  <tr key={index}>
                    <td><div className='hover bg-danger text-white' style={{ fontSize: "12px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto', textDecoration: 'none' }} onClick={() => showSurvey(item.id, 'information_edit', '', '')}>編集</div></td>
                    <td>{item.shop}</td>
                    <td>{item.name}</td>
                    <td>{item.staff}</td>
                    <td>{item.status}</td>
                    <td>{item.register}</td>
                    <td>{item.reserve}<br /><span style={{ fontSize: '10px', fontWeight: '700' }}>{item.reserved_status ? <>({item.reserved_status.replace(/-/g, '/')})</> : ''}</span></td>
                    <td>{item.rank}</td>
                    <td>{item.medium}</td>
                    <td>{item.call_status}</td>
                    <td>{item.before_survey !== 1 || <div className='hover bg-primary text-white' style={{ fontSize: "11px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto', textDecoration: 'none' }} onClick={() => showSurvey(item.id, 'before_visit', item.name, item.shop)}>詳細</div>}</td>
                    <td>{item.before_interview !== 1 || <div className='hover bg-primary text-white' style={{ fontSize: "11px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto', textDecoration: 'none' }} onClick={() => showSurvey(item.id, 'before_interview', item.name, item.shop)}>詳細</div>}</td>
                    <td>{item.after_interview !== 1 || <div className='hover bg-primary text-white' style={{ fontSize: "11px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto', textDecoration: 'none' }} onClick={() => showSurvey(item.id, 'after_interview', item.name, item.shop)}>詳細</div>}</td>
                  </tr>)}
              </tbody>
            </Table>
          </div>
        </div>
        <Modal show={modalShow} onHide={modalClose} size='xl' style={{ overflowY: 'hidden', padding: '1rem' }} dialogClassName="fixed-header-modal">
          <div className="modal-header-sticky">
            <Modal.Header>
              <Modal.Title style={{ fontSize: '13px' }}>{question[0]} {question[0] === '顧客情報修正' && <><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※要入力項目</span> <span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※アンケート回答内容</span></>}
                <div className="position-absolute" style={{ top: '10px', right: '10px', cursor: 'pointer', fontSize: '17px' }} onClick={() => setModalShow(false)}>×</div>
                {question[0] === '顧客情報修正' &&
                  <div className="d-md-flex flex-wrap d-none" style={{ width: '100%', marginTop: '10px' }}>
                    <div className={selected.customer_contacts_name ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customer_contacts_name', 'header');
                      }}>お客様名</div>
                    <div className={selected.in_charge_user ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('in_charge_user', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>担当営業</div>
                    <div className={selected.status ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('status', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>ステータス</div>
                    <div className={selected.customized_input_01J82Z5F366ZQ897PXWF6H5ZAM ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>顧客ランク</div>
                    <div className={selected.sales_promotion_name ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('sales_promotion_name', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>反響媒体</div>
                    <div className={selected.inquiry_reason ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('inquiry_reason', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>問い合せのきっかけ</div>
                    <div className={selected.house_hunting_motivation ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('house_hunting_motivation', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>建築動機</div>
                    <div className={selected.customer_desired_floor ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customer_desired_floor', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>新築計画</div>
                    <div className={selected.customer_desired_period ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customer_desired_period', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>入居時期</div>
                    <div className={selected.customer_desired_estate ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customer_desired_estate', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>土地の状況</div>
                    <div className={selected.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>お問い合わせ日</div>
                    <div className={selected.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>初回来場日</div>
                    <div className={selected.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>LINEグループ作成日</div>
                    <div className={selected.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>事前審査</div>
                    <div className={selected.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>次回来場日</div>
                    <div className={selected.contact ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('contact', 'header');
                      }}>連絡先</div>
                    <div className={selected.address ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('address', 'header');
                      }}>住所</div>
                    <div className={selected.has_owned_land ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('has_owned_land', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>土地の有無</div>
                    <div className={selected.customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>重視項目</div>
                    <div className={selected.customized_input_01JSE7RNV3VK78YC2GYAG0554D ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customized_input_01JSE7RNV3VK78YC2GYAG0554D', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>契約スケジュール</div>
                    <div className={selected.budget ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('budget', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>予算総額</div>
                    <div className={selected.monthly_repayment_amount ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('monthly_repayment_amount', 'header');
                      }}>月々支払予算</div>
                    <div className={selected.repayment_years ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('repayment_years', 'header');
                      }}>返済希望年数</div>
                    <div className={selected.current_rent ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('current_rent', 'header');
                      }}>現居家賃</div>
                    <div className={selected.self_budget ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('self_budget', 'header');
                      }}>自己資金</div>
                    <div className={selected.current_utility_costs ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('current_utility_costs', 'header');
                      }}>現居光熱費</div>
                    <div className={selected.current_loan_balance ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('current_loan_balance', 'header');
                      }}>負債総額</div>
                    <div className={selected.current_contract_type ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('current_contract_type', 'header');
                      }}>現居契約形態</div>
                    <div className={selected.customer_contacts_employment_type ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customer_contacts_employment_type', 'header');
                      }}>雇用形態</div>
                    <div className={selected.customer_contacts_employer_name ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customer_contacts_employer_name', 'header');
                      }}>勤務先名</div>
                    <div className={selected.customer_contacts_employer_address ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customer_contacts_employer_address', 'header');
                      }}>勤務先住所</div>
                    <div className={selected.customer_contacts_years_of_service ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customer_contacts_years_of_service', 'header');
                      }}>勤続年数</div>
                    <div className={selected.customer_contacts_annual_income ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customer_contacts_annual_income', 'header');
                      }}>年収</div>
                    <div className={selected.desired_land_area ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('desired_land_area', 'header');
                      }}>希望土地面積</div>
                    <div className={selected.land_budget ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('land_budget', 'header');
                      }}>土地予算</div>
                    <div className={selected.planned_construction_site ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('planned_construction_site', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>建設予定地</div>
                    <div className={selected.customized_input_01J95TC6KEES87F0YXH29AJP7K ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('customized_input_01J95TC6KEES87F0YXH29AJP7K', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>面談時アンケート</div>
                    <div className={selected.remarks ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('remarks', 'header');
                      }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>備考</div>
                    <div className={selected.call_status ? 'menu_tab selected' : 'menu_tab'}
                      onClick={() => {
                        handleSetSelected('call_status', 'header');
                      }}>架電状況</div>
                  </div>
                }
              </Modal.Title>
            </Modal.Header></div>
          <Modal.Body style={{ height: '70vh', overflowY: 'auto' }} className='modal_body'>
            {question[0] === '来場前アンケート' || question[0] === '面談前アンケート' || question[0] === '面談後アンケート' ? (
              <div className="d-flex flex-wrap" style={{ margin: '0 auto' }}>
                {answer.map((item, index) => (
                  <div className="box m-2 modal_list interview">
                    <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px' }}>{question[index + 1]}</div>
                    <div style={{ fontSize: '12px', letterSpacing: '.6px' }}>{item}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='table-wrapper'>
                <Table responsive style={{ fontSize: '12px', textAlign: 'left' }} bordered striped className='list_table database'>
                  <tbody>
                    <tr id='customer_contacts_name' className={selected.customer_contacts_name ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_name', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>お客様名</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='名前（漢字）' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_contacts_name}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_name: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_name: { value: e.target.value, updated: true }
                              }
                            ));
                          }} />
                        <input type='text' placeholder='名前（かな）' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.customer_contacts_name_kana}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_name_kana: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_name_kana: { value: e.target.value, updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>担当店舗</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px', paddingLeft: '15px' }}>{masterData.in_charge_store}</td>
                    </tr>
                    <tr id='in_charge_user' className={selected.in_charge_user ? 'table-secondary' : undefined} onClick={() => handleSetSelected('in_charge_user', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>担当営業</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select
                          style={{
                            border: '1px solid #D3D3D3',
                            borderRadius: '3px',
                            height: '30px',
                            width: '150px',
                            paddingLeft: '10px'
                          }}
                          value={masterData.in_charge_user || ""}
                          onChange={(e) => {
                            const selected = staffArray.find(item => item.name === e.target.value);
                            setMasterData(prev => ({
                              ...prev,
                              in_charge_user: selected?.name || "",
                              in_charge_user_id: selected?.pg_id || ""
                            }));
                            setUpdatedData(prev => ({
                              ...prev,
                              in_charge_user: { value: selected?.name || "", updated: true }
                            }));
                          }}
                        >
                          {staffArray
                            .filter(item => item.shop === masterData.in_charge_store)
                            .map((item, index) => (
                              <option key={index} value={item.name}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                    <tr id='status' className={selected.status ? 'table-secondary' : undefined} onClick={() => handleSetSelected('status', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>ステータス</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.status}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                status: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                status: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value='見込み'>見込み</option>
                          <option value='会社管理'>会社管理</option>
                          <option value='失注'>失注</option>
                          <option value='重複'>重複</option>
                          <option value='契約済み' disabled>契約済み</option>
                        </select><span style={{ fontSize: '10px', fontWeight: '500', color: 'red', letterSpacing: '0', paddingLeft: '10px' }}> 契約へのステータス変更はPG CLOUDからおこなってください</span>
                      </td>
                    </tr>
                    <tr id='customized_input_01J82Z5F366ZQ897PXWF6H5ZAM' className={selected.customized_input_01J82Z5F366ZQ897PXWF6H5ZAM ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>顧客ランク</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customized_input_01J82Z5F366ZQ897PXWF6H5ZAM}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customized_input_01J82Z5F366ZQ897PXWF6H5ZAM: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customized_input_01J82Z5F366ZQ897PXWF6H5ZAM: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value="">選択してください</option>
                          <option value='Aランク'>Aランク</option>
                          <option value='Bランク'>Bランク</option>
                          <option value='Cランク'>Cランク</option>
                          <option value='Dランク'>Dランク</option>
                          <option value='Eランク'>Eランク</option>
                        </select>
                      </td>
                    </tr>
                    <tr id='sales_promotion_name' className={selected.sales_promotion_name ? 'table-secondary' : undefined} onClick={() => handleSetSelected('sales_promotion_name', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>反響媒体</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '200px', paddingLeft: '10px' }} value={masterData.sales_promotion_name}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                sales_promotion_name: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                sales_promotion_name: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          {mediumArray.filter(item => !/(Amazonギフトカード|HOTLEAD|アポラック|システム利用料)/.test(item)).map((item, index) =>
                            <option key={index} value={item}>{item}</option>
                          )}
                        </select>
                      </td>
                    </tr>
                    <tr id='inquiry_reason' className={selected.inquiry_reason ? 'table-secondary' : undefined} onClick={() => handleSetSelected('inquiry_reason', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>問い合わせのきっかけ<br />該当する項目は全てチェック</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        {inquiryReasons.map((item, index) =>
                          <div className="form-check" style={{ fontSize: '13px', letterSpacing: '.5px' }}>
                            <input className="form-check-input" type="checkbox" value={item} id={`check_${String(index + 1)}`} checked={masterData.inquiry_reason?.split(',').includes(item)}
                              onChange={(e) => {
                                const { checked, value } = e.target;
                                setMasterData(prev => {
                                  const current = prev.inquiry_reason?.split(',').filter(Boolean) ?? [];
                                  const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                  return {
                                    ...prev,
                                    inquiry_reason: updated.join(','),
                                  };
                                });
                                setUpdatedData(prev => {
                                  const current = prev.inquiry_reason?.value?.split(',').filter(Boolean) ?? [];
                                  const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                  return {
                                    ...prev,
                                    inquiry_reason: { value: updated.join(','), updated: true }
                                  };
                                });
                              }} />
                            <label className="form-check-label" htmlFor={`check_${String(index + 1)}`}>
                              {item}
                            </label>
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr id='house_hunting_motivation' className={selected.house_hunting_motivation ? 'table-secondary' : undefined} onClick={() => handleSetSelected('house_hunting_motivation', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>建築動機<br />該当する項目は全てチェック</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        {houseHuntingMotivation.slice(0, 16).map((item, index) =>
                          <div className="form-check" style={{ fontSize: '13px', letterSpacing: '.5px' }}>
                            <input className="form-check-input" type="checkbox" value={item} id={`check_${String(index + 10)}`} checked={masterData.house_hunting_motivation?.split(',').includes(item)}
                              onChange={(e) => {
                                const { checked, value } = e.target;
                                setMasterData(prev => {
                                  const current = prev.house_hunting_motivation?.split(',').filter(Boolean) ?? [];
                                  const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                  return {
                                    ...prev,
                                    house_hunting_motivation: updated.join(','),
                                  };
                                });
                                setUpdatedData(prev => {
                                  const current = prev.house_hunting_motivation?.value?.split(',').filter(Boolean) ?? [];
                                  const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                  return {
                                    ...prev,
                                    house_hunting_motivation: { value: updated.join(','), updated: true }
                                  };
                                });
                              }} />
                            <label className="form-check-label" htmlFor={`check_${String(index + 10)}`}>
                              {item}
                            </label>
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr id='house_hunting_motivation' className={selected.house_hunting_motivation ? 'table-secondary' : undefined} onClick={() => handleSetSelected('house_hunting_motivation', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>注文住宅に興味をもったきっかけ<br />該当する項目は全てチェック</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        {houseHuntingMotivation.slice(16, 25).map((item, index) =>
                          <div className="form-check" style={{ fontSize: '13px', letterSpacing: '.5px' }}>
                            <input className="form-check-input" type="checkbox" value={item} id={`check_${String(index + 10)}`} checked={masterData.house_hunting_motivation?.split(',').includes(item)}
                              onChange={(e) => {
                                const { checked, value } = e.target;
                                setMasterData(prev => {
                                  const current = prev.house_hunting_motivation?.split(',').filter(Boolean) ?? [];
                                  const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                  return {
                                    ...prev,
                                    house_hunting_motivation: updated.join(','),
                                  };
                                });
                                setUpdatedData(prev => {
                                  const current = prev.house_hunting_motivation?.value?.split(',').filter(Boolean) ?? [];
                                  const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                  return {
                                    ...prev,
                                    house_hunting_motivation: { value: updated.join(','), updated: true }
                                  };
                                });
                              }} />
                            <label className="form-check-label" htmlFor={`check_${String(index + 10)}`}>
                              {item}
                            </label>
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr id='customer_desired_floor' className={selected.customer_desired_floor ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_desired_floor', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>新築計画</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_desired_floor}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_desired_floor: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_desired_floor: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value="">選択してください</option>
                          <option value="新築平屋">新築平屋</option>
                          <option value="新築2階建て">新築2階建て</option>
                          <option value="建て替え平屋">建て替え平屋</option>
                          <option value="建て替え2階建て">建て替え2階建て</option>
                          <option value="その他">その他</option>
                        </select>
                      </td>
                    </tr>
                    <tr id='customer_desired_period' className={selected.customer_desired_period ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_desired_period', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>入居時期</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_desired_period}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_desired_period: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_desired_period: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value="">選択してください</option>
                          <option value="すぐにでも">すぐにでも</option>
                          <option value="半年～1年以内">半年～1年以内</option>
                          <option value="1年～2年以内">1年～2年以内</option>
                          <option value="2年以上後">2年以上後</option>
                          <option value="その他">その他</option>
                        </select>
                      </td>
                    </tr>
                    <tr id='customer_desired_estate' className={selected.customer_desired_estate ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_desired_estate', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>土地の状況</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '300px', paddingLeft: '10px' }} value={masterData.customer_desired_estate}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_desired_estate: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_desired_estate: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value="">選択してください</option>
                          <option value="自分で持っている（購入予定の土地がある）">自分で持っている（購入予定の土地がある）</option>
                          <option value="親・親族等の土地で建築予定">親・親族等の土地で建築予定</option>
                          <option value="土地を探している">土地を探している</option>
                        </select>
                      </td>
                    </tr>
                    <tr id='step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99' className={selected.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 ? 'table-secondary' : undefined} onClick={() => handleSetSelected('step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>お問い合わせ日</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 && masterData.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99.replace(/\//g, "-")}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: { value: e.target.value.replace(/\//g, '-'), updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7' className={selected.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 ? 'table-secondary' : undefined} onClick={() => handleSetSelected('step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>初回来場日</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 && masterData.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7.replace(/\//g, "-")}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7: { value: e.target.value.replace(/\//g, '-'), updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN' className={selected.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN ? 'table-secondary' : undefined} onClick={() => handleSetSelected('step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>LINEグループ作成日</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN && masterData.step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN.replace(/\//g, "-")}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7: { value: e.target.value.replace(/\//g, '-'), updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR' className={selected.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR ? 'table-secondary' : undefined} onClick={() => handleSetSelected('step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>事前審査</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR && masterData.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR.replace(/\//g, "-")}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR: { value: e.target.value.replace(/\//g, '-'), updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='step_migration_item_01JSENACS2FC422ZHEZWNSXNYA' className={selected.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA ? 'table-secondary' : undefined} onClick={() => handleSetSelected('step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>次回来場日</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='date' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA && masterData.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA.replace(/\//g, "-")}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                step_migration_item_01JSENACS2FC422ZHEZWNSXNYA: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                step_migration_item_01JSENACS2FC422ZHEZWNSXNYA: { value: e.target.value.replace(/\//g, '-'), updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='contact' className={selected.contact ? 'table-secondary' : undefined} onClick={() => handleSetSelected('contact', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>連絡先</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='固定電話' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_contacts_phone_number}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_phone_number: e.target.value
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9-]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_phone_number: numericOnly
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_phone_number: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />
                        <input type='text' placeholder='携帯電話' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.customer_contacts_mobile_phone_number}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_mobile_phone_number: e.target.value
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9-]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_mobile_phone_number: numericOnly
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_mobile_phone_number: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />
                        <input type='text' placeholder='メールアドレス' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '250px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.customer_contacts_email}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_email: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_email: { value: e.target.value, updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='address' className={selected.address ? 'table-secondary' : undefined} onClick={() => handleSetSelected('address', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>住所</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='郵便番号' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '100px', paddingLeft: '10px' }} value={masterData.postal_code}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                postal_code: e.target.value
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,-]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                postal_code: numericOnly
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                postal_code: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />
                        <input type='text' placeholder='住所' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '400px', paddingLeft: '10px', marginLeft: '8px' }} value={masterData.full_address}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                full_address: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                full_address: { value: e.target.value, updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='has_owned_land' className={selected.has_owned_land ? 'table-secondary' : undefined} onClick={() => handleSetSelected('has_owned_land', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>土地の有無</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.has_owned_land}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                has_owned_land: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                has_owned_land: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value="無">無</option><option value="有">有</option>
                        </select>
                      </td>
                    </tr>
                    <tr id='customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN' className={selected.customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>重視項目</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value="">選択してください</option>
                          <option value="性能">性能</option>
                          <option value="デザイン">デザイン</option>
                          <option value="価格">価格</option>
                          <option value="アフターサービス">アフターサービス</option>
                        </select>
                      </td>
                    </tr>
                    <tr id='customized_input_01JSE7RNV3VK78YC2GYAG0554D' className={selected.customized_input_01JSE7RNV3VK78YC2GYAG0554D ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customized_input_01JSE7RNV3VK78YC2GYAG0554D', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>契約スケジュール</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customized_input_01JSE7RNV3VK78YC2GYAG0554D}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customized_input_01JSE7RNV3VK78YC2GYAG0554D: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customized_input_01JSE7RNV3VK78YC2GYAG0554D: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value="">選択してください</option>
                          <option value="半月内">半月内</option>
                          <option value="月内">月内</option>
                          <option value="1か月後">1か月後</option>
                          <option value="3か月後">3か月後</option>
                          <option value="価格">価格</option>
                          <option value="9か月後">9か月後</option>
                          <option value="1年以上後">1年以上後</option>
                        </select>
                      </td>
                    </tr>
                    <tr id='budget' className={selected.budget ? 'table-secondary' : undefined} onClick={() => handleSetSelected('budget', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>予算総額</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                          value={masterData.budget ? masterData.budget.replace('万円', '') : ''}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                budget: e.target.value
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                budget: `${numericOnly}万円`
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                budget: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />万円
                      </td>
                    </tr>
                    <tr id='monthly_repayment_amount' className={selected.monthly_repayment_amount ? 'table-secondary' : undefined} onClick={() => handleSetSelected('monthly_repayment_amount', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>月々支払予算</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='月々支払予算' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                          value={masterData.monthly_repayment_amount ? masterData.monthly_repayment_amount.replace('0000', '') : ''}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                monthly_repayment_amount: `${e.target.value}0000`
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                monthly_repayment_amount: `${numericOnly}0000`
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                monthly_repayment_amount: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />万円
                      </td>
                    </tr>
                    <tr id='repayment_years' className={selected.repayment_years ? 'table-secondary' : undefined} onClick={() => handleSetSelected('repayment_years', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>返済希望年数</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='返済希望年数' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                          value={masterData.repayment_years ? masterData.repayment_years.replace(/[年\/]/g, '') : ''}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                repayment_years: e.target.value
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                repayment_years: `${numericOnly}年`
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                repayment_years: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />年
                      </td>
                    </tr>
                    <tr id='current_rent' className={selected.current_rent ? 'table-secondary' : undefined} onClick={() => handleSetSelected('current_rent', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居家賃</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='現居家賃' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                          value={masterData.current_rent ? masterData.current_rent.replace('万円', '') : ''}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                current_rent: e.target.value
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                current_rent: `${numericOnly}万円`
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                current_rent: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />万円
                      </td>
                    </tr>
                    <tr id='self_budget' className={selected.self_budget ? 'table-secondary' : undefined} onClick={() => handleSetSelected('self_budget', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>自己資金</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type="text" placeholder="自己資金" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.self_budget ? masterData.self_budget.replace('0000', '') : ''}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                self_budget: `${e.target.value}0000`
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                self_budget: `${numericOnly}0000`
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                self_budget: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />万円
                      </td>
                    </tr>
                    <tr id='current_utility_costs' className={selected.current_utility_costs ? 'table-secondary' : undefined} onClick={() => handleSetSelected('current_utility_costs', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居光熱費</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type="text" placeholder="現居光熱費" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.current_utility_costs ? masterData.current_utility_costs.replace('万円', '') : ''}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                current_utility_costs: e.target.value
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                current_utility_costs: numericOnly
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                current_utility_costs: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />万円
                      </td>
                    </tr>
                    <tr id='current_loan_balance' className={selected.current_loan_balance ? 'table-secondary' : undefined} onClick={() => handleSetSelected('current_loan_balance', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>負債総額</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type="text" placeholder="自己資金" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                          value={masterData.current_loan_balance ? masterData.current_loan_balance.replace('0000', '') : ''}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                current_loan_balance: `${e.target.value}0000`
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                current_loan_balance: `${numericOnly}0000`
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                current_loan_balance: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />万円
                      </td>
                    </tr>
                    <tr id='current_contract_type' className={selected.current_contract_type ? 'table-secondary' : undefined} onClick={() => handleSetSelected('current_contract_type', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居契約形態</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.current_contract_type}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                current_contract_type: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                current_contract_type: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value="">選択してください</option>
                          <option value="賃貸(マンション)">賃貸(マンション)</option>
                          <option value="賃貸(戸建)">賃貸(戸建)</option>
                          <option value="持家(マンション)">持家(マンション)</option>
                          <option value="持家(戸建)">持家(戸建)</option>
                          <option value="賃貸(アパート)">賃貸(アパート)</option>
                        </select>
                      </td>
                    </tr>
                    <tr id='customer_contacts_employment_type' className={selected.customer_contacts_employment_type ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_employment_type', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>雇用形態</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px' }} value={masterData.customer_contacts_employment_type}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_employment_type: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_employment_type: { value: e.target.value, updated: true }
                              }
                            ));
                          }}>
                          <option value="">選択してください</option>
                          <option value="経営者">経営者</option>
                          <option value="正社員">正社員</option>
                          <option value="契約社員">契約社員</option>
                          <option value="パート・アルバイト">パート・アルバイト</option>
                          <option value="派遣社員">派遣社員</option>
                          <option value="専業主婦">専業主婦</option>
                        </select>
                      </td>
                    </tr>
                    <tr id='customer_contacts_employer_name' className={selected.customer_contacts_employer_name ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_employer_name', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤務先名</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '350px', paddingLeft: '10px' }} value={masterData.customer_contacts_employer_name}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_employer_name: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_employer_name: { value: e.target.value, updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='customer_contacts_employer_address' className={selected.customer_contacts_employer_address ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_employer_address', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤務先住所</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '350px', paddingLeft: '10px' }} value={masterData.customer_contacts_employer_address}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_employer_address: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_employer_address: { value: e.target.value, updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='customer_contacts_years_of_service' className={selected.customer_contacts_years_of_service ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_years_of_service', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤続年数</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='勤続年数' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.customer_contacts_years_of_service}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_years_of_service: e.target.value
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_years_of_service: `${numericOnly}`
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_years_of_service: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />年
                      </td>
                    </tr>
                    <tr id='customer_contacts_annual_income' className={selected.customer_contacts_annual_income ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customer_contacts_annual_income', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>年収</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                          value={masterData.customer_contacts_annual_income ? masterData.customer_contacts_annual_income.replace('万円', '') : ''}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_annual_income: `${e.target.value}万円`
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                customer_contacts_annual_income: `${numericOnly}万円`
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customer_contacts_annual_income: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />万円
                      </td>
                    </tr>
                    <tr id='desired_land_area' className={selected.desired_land_area ? 'table-secondary' : undefined} onClick={() => handleSetSelected('desired_land_area', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>希望土地面積</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={masterData.desired_land_area}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                desired_land_area: e.target.value
                              }
                            ));
                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                desired_land_area: numericOnly
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                desired_land_area: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />坪
                      </td>
                    </tr>
                    <tr id='land_budget' className={selected.land_budget ? 'table-secondary' : undefined} onClick={() => handleSetSelected('land_budget', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>土地の予算</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' pattern="[A-Za-z0-9]*" placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                          value={masterData.land_budget ? masterData.land_budget.replace('万円', '') : ''}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                land_budget: `${e.target.value}万円`
                              }
                            ));

                          }}
                          onBlur={(e) => {
                            const halfValue = toHalfWidth(e.target.value);
                            const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                            setMasterData(prev => (
                              {
                                ...prev,
                                land_budget: `${numericOnly}万円`
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                land_budget: { value: numericOnly, updated: true }
                              }
                            ));
                          }} />万円
                      </td>
                    </tr>
                    <tr id='planned_construction_site' className={selected.planned_construction_site ? 'table-secondary' : undefined} onClick={() => handleSetSelected('planned_construction_site', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'blue' }}>※</span>建設予定地</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <input type='text' placeholder='建設予定地' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '30px', width: '350px', paddingLeft: '10px' }} value={masterData.planned_construction_site}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                planned_construction_site: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                planned_construction_site: { value: e.target.value, updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='customized_input_01J95TC6KEES87F0YXH29AJP7K' className={selected.customized_input_01J95TC6KEES87F0YXH29AJP7K ? 'table-secondary' : undefined} onClick={() => handleSetSelected('customized_input_01J95TC6KEES87F0YXH29AJP7K', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>面談時アンケート</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <textarea placeholder='面談時アンケート' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', width: '100%', paddingLeft: '10px' }} value={masterData.customized_input_01J95TC6KEES87F0YXH29AJP7K}
                          rows={masterData.customized_input_01J95TC6KEES87F0YXH29AJP7K ? (masterData.customized_input_01J95TC6KEES87F0YXH29AJP7K.match(/\n/g)?.length ?? 0) + 2 : 2}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                customized_input_01J95TC6KEES87F0YXH29AJP7K: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                customized_input_01J95TC6KEES87F0YXH29AJP7K: { value: e.target.value, updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='remarks' className={selected.remarks ? 'table-secondary' : undefined} onClick={() => handleSetSelected('remarks', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span style={{ fontSize: '10px', fontWeight: '500', color: 'red' }}>※</span>次回アポまでの対応内容・担当者の感覚</td>
                      <td style={{ fontSize: '13px', letterSpacing: '.6px' }}>
                        <textarea placeholder='次回アポまでの対応内容・担当者の感覚' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', width: '100%', paddingLeft: '10px' }} value={masterData.remarks}
                          rows={masterData.remarks ? (masterData.remarks.match(/\n/g)?.length ?? 0) + 2 : 2}
                          onChange={(e) => {
                            setMasterData(prev => (
                              {
                                ...prev,
                                remarks: e.target.value
                              }
                            ));
                            setUpdatedData(prev => (
                              {
                                ...prev,
                                remarks: { value: e.target.value, updated: true }
                              }
                            ));
                          }} />
                      </td>
                    </tr>
                    <tr id='call_status' className={selected.call_status ? 'table-secondary' : undefined} onClick={() => handleSetSelected('call_status', 'body')}>
                      <td style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>架電状況</td>
                      <td>
                        <div className="d-flex align-items-center mb-2">
                          <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>架電ステータス</div>
                          <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                            <select style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }}
                              onChange={(e) => {
                                setMasterData(prev => (
                                  {
                                    ...prev,
                                    call_status: e.target.value
                                  }
                                ));
                                setCallLog(prev => ({
                                  ...prev,
                                  status: e.target.value
                                }));
                              }}
                              value={masterData.call_status}>
                              <option value="">架電ステータスを選択</option>
                              <option value="未通電">未通電</option>
                              <option value="継続">継続</option>
                              <option value="来場アポ">来場アポ</option>
                              <option value="来場済み">来場済み</option>
                              <option value="架電停止">架電停止</option>
                            </select>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '40px' }}>来場予定日</div>
                          <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                            <input type="date" style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} value={callLog.reserved_status ? callLog.reserved_status : ''}
                              onChange={(e) => setCallLog(prev => ({
                                ...prev,
                                reserved_status: e.target.value
                              }))} />
                          </div>
                        </div>
                        <div style={{ padding: '5px', backgroundColor: '#f1f1f1ff' }}>
                          {callLog.call_log &&
                            callLog.call_log.map((item, index) => <><div className="d-flex align-items-center" style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                              <div className="">
                                <input type="date" value={item.day} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }}
                                  onChange={(e) => setCallLog(prev => ({
                                    ...prev,
                                    call_log: prev.call_log.map((log, i) => i === index ?
                                      { ...log, day: e.target.value } : log)
                                  }))} />
                              </div>
                              <div className="">
                                <input type="time" value={item.time} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', marginLeft: '5px', paddingLeft: '2px' }}
                                  onChange={(e) => setCallLog(prev => ({
                                    ...prev,
                                    call_log: prev.call_log.map((log, i) => i === index ?
                                      { ...log, time: e.target.value } : log)
                                  }))} />
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                <select style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} value={item.action}
                                  onChange={(e) => setCallLog(prev => ({
                                    ...prev,
                                    call_log: prev.call_log.map((log, i) => i === index ?
                                      { ...log, action: e.target.value } : log)
                                  }))}>
                                  <option value="">アクション内容</option>
                                  <option value="架電">架電</option>
                                  <option value="SMS送信">SMS送信</option>
                                  <option value="メール送信">メール送信</option>
                                  <option value="資料郵送">資料郵送</option>
                                </select>
                              </div>
                              <div className="">
                                <textarea style={{ border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '420px' }} placeholder='アクション内容・ヒアリング内容を記載' value={item.note} rows={item.note.split('\n').length}
                                  onChange={(e) => setCallLog(prev => ({
                                    ...prev,
                                    call_log: prev.call_log.map((log, i) => i === index ?
                                      { ...log, note: e.target.value } : log)
                                  }))}></textarea>
                              </div>
                              <div className="text-danger" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
                                onClick={() => setCallLog(prev => ({
                                  ...prev,
                                  call_log: prev.call_log.filter((_, i) => i !== index)
                                }))}>削除</div>
                            </div>
                              <div style={{ color: '#868686ff', marginBottom: '7px' }}>
                                <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                <div style={{ textAlign: 'center' }}>
                                  {callLog.call_log[index]['action'] === '架電' && <i className="fa-solid fa-phone-volume"></i>}
                                  {callLog.call_log[index]['action'] === 'SMS送信' && <i className="fa-solid fa-message"></i>}
                                  {callLog.call_log[index]['action'] === 'メール送信' && <i className="fa-solid fa-envelope"></i>}
                                  {callLog.call_log[index]['action'] === '資料郵送' && <i className="fa-solid fa-truck"></i>}
                                </div>
                                <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                              </div>
                            </>)}
                          <div className="d-flex align-items-center" style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                            <div className="">
                              <input type="date" style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }} value={call.day}
                                onChange={(e) => setCall(prev => ({
                                  ...prev,
                                  day: e.target.value
                                }))} />
                            </div>
                            <div className="">
                              <input type="time" step="60" style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '80px', paddingLeft: '2px' }} value={call.time}
                                onChange={(e) => setCall(prev => ({
                                  ...prev,
                                  time: e.target.value
                                }))} />
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                              <select style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }}
                                onChange={(e) => setCall(prev => ({
                                  ...prev,
                                  action: e.target.value
                                }))}
                                value={call.action}>
                                <option value="">アクション内容</option>
                                <option value="架電">架電</option>
                                <option value="SMS送信">SMS送信</option>
                                <option value="メール送信">メール送信</option>
                                <option value="資料郵送">資料郵送</option>
                              </select>
                            </div>
                            <div className="">
                              <textarea value={call.note} style={{ height: '30px', border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '420px' }} placeholder='アクション内容・ヒアリング内容を記載'
                                onChange={(e) => setCall(prev => ({
                                  ...prev,
                                  note: e.target.value
                                }))} ></textarea></div>
                            <div className="text-primary" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
                              onClick={() => {
                                if (!call.day && !call.action && !call.note) {
                                  alert('未入力の項目があります');
                                  return;
                                };
                                setCallLog(prev => ({
                                  ...prev,
                                  id: masterData.id,
                                  name: masterData.customer_contacts_name,
                                  status: masterData.call_status,
                                  call_log: [
                                    ...prev.call_log,
                                    { day: call.day, time: call.time, action: call.action, note: call.note }
                                  ],
                                  add: true
                                }));
                                setCall({
                                  status: '', day: '', time: '', action: '', note: ''
                                });
                                console.log(callLog);
                              }
                              }>追加</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            )}
          </Modal.Body>
          {question[0] === '顧客情報修正' && <Modal.Footer>
            <div className="d-flex handle_button">
              {sending === true ? <div className="button bg-primary text-white" onClick={() => handleSave()}>保存</div> : <div className="button bg-secondary text-white" style={{ cursor: 'text' }}>保存中</div>}
              <div className="button" onClick={() => setModalShow(false)}>閉じる</div>
              <a href={`https://pg-cloud.cloud/customers/${masterData.id}/summary`} target='_blank'><div className="button bg-danger text-white">PG CLOUD</div></a>
            </div>
          </Modal.Footer>}
        </Modal>
      </div>
    </div >
  )
}

export default Database
