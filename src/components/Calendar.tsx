import React from 'react'
import Calendar from 'react-calendar';
import { useState, useEffect } from 'react';
import 'react-calendar/dist/Calendar.css';
import Modal from 'react-bootstrap/Modal';
import "bootstrap/dist/css/bootstrap.min.css";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Table";
import axios from 'axios';

type ValueRange = { id: number, startDate: string, endDate: string, category: string, title: string, shop: string, flag: number };
type ReservedCounter = { shop: string, event: string, date: string, count: number, category: string };
type PostValue = { shop: string, event: string, date: string, count: any, category: string };
type shopList = { brand: string, shop: string };

type ReservedProps = {
  message: Date;
};

interface CalendarListProps {
    activeTab: string | null;
}

const CalendarApp: React.FC<CalendarListProps> = ({ activeTab }) => {
  const [listShow, setListShow] = useState(false);
  const [eventTitle, setEventTitle] = useState<ValueRange[]>([]);
  const [selectedRanges, setSelectedRanges] = useState<ValueRange[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('KH鹿児島店')
  const [shopList, setShopList] = useState<shopList[]>([])
  const [reservedNumber, setReservedNumber] = useState<ReservedCounter[]>([]);
  const [targetDateModal, setTargetDateModal] = useState<string>('');

  useEffect(() => {
    const fetchShopData = async () => {
      try {
        const response = await axios.post("/dashboard/api/shopCalendarList.php");
        setShopList(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchShopData();


    const fetchReservedData = async () => {
      try {
        const response = await axios.post("/dashboard/api/changeCalendar.php");
        setReservedNumber(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchReservedData();

    const fetchEventData = async () => {
      try {
        const response = await axios.post("/dashboard/api/eventCalendar.php");
        setSelectedRanges(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchEventData();
  }, []);

    useEffect(() => {
    const fetchShopData = async () => {
      try {
        const response = await axios.post("/dashboard/api/shopCalendarList.php");
        setShopList(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchShopData();


    const fetchReservedData = async () => {
      try {
        const response = await axios.post("/dashboard/api/changeCalendar.php");
        setReservedNumber(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }

    };
    fetchReservedData();

    const fetchEventData = async () => {
      try {
        const response = await axios.post("/dashboard/api/eventCalendar.php");
        setSelectedRanges(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }

    };
    fetchEventData();

  }, [activeTab]);

  const [resultReserve, setResultReserve] = useState<number | undefined>(0);
  const [newReserve, setNewReserve] = useState<number | undefined>(0);
  const [registeredReserve, setRegisteredReserve] = useState<number | undefined>(0);

  const addEvent = async (date: Date) => {

    const today = new Date();
    const currentMonth = today.getMonth();
    const clickedMonth = date.getMonth();

    if (clickedMonth !== currentMonth) {
      return;
    }

    const runningEvent = selectedRanges.filter(function (item) {
      const adjustedStartDate = new Date(item.startDate);
      return item.startDate && item.endDate && new Date(adjustedStartDate.setDate(adjustedStartDate.getDate() - 1)) <= date && new Date(item.endDate) >= date
    });
    setEventTitle(runningEvent);
    const adjustedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const adjustedYear = adjustedDate.getFullYear();
    const adjustedMonth = adjustedDate.getMonth() + 1;
    const formattedAdjustedMonth = String(adjustedMonth).padStart(2, '0');
    const adjustedDay = String(adjustedDate.getDate()).padStart(2, '0');
    const formattedDate = `${adjustedYear}-${formattedAdjustedMonth}-${adjustedDay}`;
    const reservedList = reservedNumber ? reservedNumber.find(reserve => reserve.category === 'reserved' && reserve.shop === selectedShop && reserve.event === '常設EV・モデル見学' && reserve.date === `${adjustedYear}-${formattedAdjustedMonth}-${adjustedDay}`)?.count : 0;
    const newList = reservedNumber ? reservedNumber.find(reserve => reserve.shop === selectedShop && reserve.category === 'new' && reserve.event === '常設EV・モデル見学' && reserve.date === `${adjustedYear}-${formattedAdjustedMonth}-${adjustedDay}`)?.count : 0;
    const resistedList = reservedNumber ? reservedNumber.find(reserve => reserve.shop === selectedShop && reserve.category === 'registered' && reserve.event === '常設EV・モデル見学' && reserve.date === `${adjustedYear}-${formattedAdjustedMonth}-${adjustedDay}`)?.count : 0;
    setTargetDateModal(formattedDate);
    await setResultReserve(reservedList);
    await setNewReserve(newList);
    await setRegisteredReserve(resistedList);
    setListShow(true);
  };


  const ReservedCounter: React.FC<ReservedProps> = ({ message }) => {
    const adjustedDate = new Date(message.getTime() - message.getTimezoneOffset() * 60000);
    const year = adjustedDate.getFullYear();
    const month = adjustedDate.getMonth() + 1;
    const day = adjustedDate.getDate();
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const resultReserve = reservedNumber.filter(item => item.shop === selectedShop && item.category === 'reserved' && item.date === formattedDate).reduce((sum, item) => sum + item.count, 0);
    const newReserve = reservedNumber.filter(item => item.shop === selectedShop && item.category === 'new' && item.date === formattedDate).reduce((sum, item) => sum + item.count, 0);
    const registerReserve = reservedNumber.filter(item => item.shop === selectedShop && item.category === 'registered' && item.date === formattedDate).reduce((sum, item) => sum + item.count, 0);
    return (
      <div className='customer_list position-absolute'>
        <span className='bg-danger text-white px-2 py-1 rounded-pill me-2'>{resultReserve ? resultReserve : '0'}</span>
        <span className='bg-primary text-white px-2 py-1 rounded-pill me-2'>{newReserve ? newReserve : '0'}</span>
        <span className='bg-secondary text-white px-2 py-1 rounded-pill me-2'>{registerReserve ? registerReserve : '0'}</span>
      </div>
    );
  };


  const modalClose = async () => {
    await setResultReserve(0);
    await setNewReserve(0);
    await setRegisteredReserve(0);
    setListShow(false);
  };

  const handleCount = async (countValue: any, titleValue: string, shopValue: string, dateValue: string, categoryValue: string) => {
    const postData = {
      shop: shopValue,
      event: titleValue,
      date: dateValue,
      count: countValue,
      category: categoryValue
    };

    try {
      const response = await fetch("/dashboard/api/changeCalendar.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData)
      });
      const data = await response.json();
      setReservedNumber(data);
    } catch (error) {
      console.error("エラー:", error);
    }
  };

  const [eventListShow, setEventListShow] = useState(false);
  const [modalEventTitle, setModalEventTitle] = useState<string>('');
  const [eventId, setEventId] = useState<number | null>(null);
  const [modalEventShop, setModalEventShop] = useState<string>('');
  const [modalEventCategory, setModalEventCategory] = useState<string>('');
  const [modalEventStartDate, setModalEventStartDate] = useState<string>('');
  const [modalEventEndDate, setModalEventEndDate] = useState<string>('');

  const changeEvent = async (id: number | null, titleValue: string, shopValue: string, categoryValue: string, startDateValue: string, endDateValue: string) => {
    setEventId(id);
    setModalEventTitle(titleValue);
    setModalEventShop(shopValue);
    setModalEventCategory(categoryValue);
    setModalEventStartDate(startDateValue);
    setModalEventEndDate(endDateValue);
    setEventListShow(true);
  };

  const deleteEvent = async (id: number | null) => {
    if (window.confirm("イベントを削除しますか？")) {
      const postData = { id: id, demand: 'delete' };
      try {
        const response = await fetch("/dashboard/api/changeEvent.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postData)
        });
        const data = await response.json();
        setSelectedRanges(data);
      } catch (error) {
        console.error("エラー:", error);
      }
    };
    setEventListShow(false);
  };

  const modalEventRegister = async () => {
    const postData = {
      id: eventId,
      shop: selectedShop,
      category: modalEventCategory,
      startDate: modalEventStartDate,
      endDate: modalEventEndDate,
      title: modalEventTitle,
      demand: 'change'
    };

    try {
      const response = await fetch("/dashboard/api/changeEvent.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData)
      });
      const data = await response.json();
      setSelectedRanges(data);
    } catch (error) {
      console.error("エラー:", error);
    }
    setEventListShow(false);
  };

  const modalEventClose = async () => {
    setEventListShow(false);
  };

  const shopChange= async(shopValue: string) =>{
    setSelectedShop(shopValue);
  }

  return (
    <div>
      <div className='text-center position-relative'>
        <select className='h5 form-select' style={{ width: '300px', margin: '30px auto'}} onChange={(e)=>shopChange(e.target.value)}>
          {shopList.map((shop, index)=>(
            <option key={index} selected={ selectedShop === shop.shop}>{shop.shop}</option>
          ))}
        </select>
        <div className='position-absolute top-0 end-0'>
          <span className='p bg-danger text-white px-2 py-1 rounded-pill me-2'>新規来場者数</span>
          <span className='p bg-primary text-white px-2 py-1 rounded-pill me-2'>有効新規数</span>
          <span className='p bg-secondary text-white px-2 py-1 rounded-pill me-2'>管理客来場者数</span>
        </div>
      </div>
      <Calendar
        onClickDay={(date) => addEvent(date)}
        minDetail='month'
        maxDetail='month'
        nextLabel="次の月へ"
        prevLabel="前の月へ"
        className="rounded bg-light border"
        tileClassName={({ date }) => {
          const classes: string[] = [];
          selectedRanges.forEach(item => {
            if (!item.startDate || !item.endDate) return;

            const adjustedStartDate = new Date(item.startDate);
            const adjustedEndDate = new Date(item.endDate);

            if ( item.shop === selectedShop && date >= new Date(adjustedStartDate.setDate(adjustedStartDate.getDate() - 1)) && date <= new Date(item.endDate)) {
              classes.push('selected-range');
              classes.push(item.category);
            }

            if ( item.shop === selectedShop && item.category === 'event' || item.category === 'event_even' || item.category === 'medium') {
              if (date.getDate() === new Date(item.startDate).getDate()) {
                classes.push(`${item.category}_start`);
              }
              if (date.getDate() === new Date(item.endDate).getDate()) {
                classes.push(`${item.category}_end`);
              }
            }
          });
          return classes.join(' ');

        }}

        tileContent={({ date }) => {
          const matchingRanges = selectedRanges.filter(item => {
            const targetDate = new Date(item.startDate);
            return date.getFullYear() === targetDate.getFullYear() &&
              date.getMonth() === targetDate.getMonth() &&
              date.getDate() === targetDate.getDate();
          });

          return matchingRanges.length > 0 ? (
            <div className='title position-relative'><ReservedCounter message={date} />{matchingRanges.filter(shop => shop.shop === selectedShop).map((value, index) => (
              <div key={index} className={value.category}>{value.title}</div>
            ))}
            </div>
          ) : <div className='title position-relative'><ReservedCounter message={date} />
          </div>;
        }}
      />


      <Modal show={listShow} onHide={modalClose} size="lg">
        <Modal.Header closeButton>
          <Modal.Title id="ranked-modal">{selectedShop} {targetDateModal} 反響</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table striped>
            <thead>
              <tr className='modal_event_list text-center'>
                <th>イベント</th>
                <th><span className='p bg-primary text-white px-2 py-1 rounded-pill me-2'>来場予約者数</span></th>
                <th><span className='p bg-success text-white px-2 py-1 rounded-pill me-2'>新規来場者数</span></th>
                <th><span className='p bg-secondary text-white px-2 py-1 rounded-pill me-2'>管理客来場者数</span></th>
                <th>編集</th>
              </tr>
            </thead>
            <tbody>
              {eventTitle.map(item => {
                let category;
                const resultReserve = reservedNumber?.find(reserve => reserve.shop === selectedShop && reserve.category === 'reserved' && reserve.event === item.title && reserve.date === targetDateModal);
                const newReserve = reservedNumber?.find(reserve => reserve.shop === selectedShop && reserve.category === 'new' && reserve.event === item.title && reserve.date === targetDateModal);
                const registeredReserve = reservedNumber?.find(reserve => reserve.shop === selectedShop && reserve.category === 'registered' && reserve.event === item.title && reserve.date === targetDateModal);
                if (item.category.includes('event')) {
                  category = 'event_modal text-white rounded p-2';
                } else {
                  category = `${item.category}_modal text-white rounded p-2`;
                }
                return (
                  <tr className='modal_event_list text-center'>
                    {/* <th className='align-middle'>{startYear}/{startFormattedMonth}/{startFormattedDay}</th>
                    <th className='align-middle'>{endYear}/{endFormattedMonth}/{endFormattedDay}</th> */}
                    <th className='align-middle'><span className={category}>{item.title}</span></th>
                    <th>{item.category !== 'medium' ? <input type="number" min="0" placeholder={resultReserve ? String(resultReserve?.count) : "0"} defaultValue={resultReserve ? resultReserve.count : 0} className="form-control reserved-counter" onChange={(e) => handleCount(e.target.value, item.title, item.shop, targetDateModal, 'reserved')} /> : ""}</th>
                    <th>{item.category !== 'medium' ? <input type='number' min="0" placeholder={newReserve ? String(newReserve?.count) : "0"} defaultValue={newReserve ? newReserve.count : 0} className='form-control reserved-counter' onChange={(e) => handleCount(e.target.value, item.title, item.shop, targetDateModal, 'new')} /> : ''}</th>
                    <th>{item.category !== 'medium' ? <input type='number' min="0" placeholder={registeredReserve ? String(registeredReserve?.count) : '0'} defaultValue={registeredReserve ? registeredReserve.count : 0} className='form-control reserved-counter' onChange={(e) => handleCount(e.target.value, item.title, item.shop, targetDateModal, 'registered')} /> : ''}</th>
                    <th className='align-middle'><div className='btn me-2 bg-primary text-white' onClick={() => changeEvent(item.id, item.title, item.shop, item.category, item.startDate, item.endDate)}><i className="fa-solid fa-file-pen"></i></div><div className='btn bg-danger text-white' onClick={() => deleteEvent(item.id)}><i className="fa-solid fa-trash"></i></div></th>
                  </tr>
                )
              })}
              <tr className='modal_event_list text-center'>
                <th className='align-middle'><span className='event_modal text-white rounded p-2'>{ }常設EV・モデル見学</span></th>
                <th><input type="number" min="0" placeholder={resultReserve ? String(resultReserve) : '0'} defaultValue={resultReserve ? String(resultReserve) : '0'} className="form-control reserved-counter" onChange={(e) => handleCount(e.target.value, '常設EV・モデル見学', selectedShop, targetDateModal, 'reserved')} /></th>
                <th><input type='number' min="0" placeholder={newReserve ? String(newReserve) : '0'} defaultValue={newReserve ? String(newReserve) : '0'} className='form-control reserved-counter' onChange={(e) => handleCount(e.target.value, '常設EV・モデル見学', selectedShop, targetDateModal, 'new')} /></th>
                <th><input type='number' min="0" placeholder={registeredReserve ? String(registeredReserve) : '0'} defaultValue={registeredReserve ? String(registeredReserve) : '0'} className='form-control reserved-counter' onChange={(e) => handleCount(e.target.value, '常設EV・モデル見学', selectedShop, targetDateModal, 'registered')} /></th>
                <th className='align-middle'></th>
              </tr>
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button className='bg-secondary rounded text-white btn calendar_modal_close' variant="secondary" onClick={modalClose}>
            閉じる
          </Button>
          <Button className='bg-primary rounded text-white btn calendar_modal_close' variant="secondary" onClick={() => changeEvent(null, '', '', '', '', '')}>
            イベント新規登録
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={eventListShow} onHide={modalEventClose} animation={false}>
        <Modal.Header closeButton>
          <Modal.Title>{modalEventTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className='mb-3'>
            <label className='form-label mb-0'>イベント名</label>
            <input type='text' className='form-control' value={modalEventTitle !== '' ? modalEventTitle : 'イベント名を入力'} onChange={(e) => setModalEventTitle(e.target.value)} />
          </div>
          <div className='mb-3'>
            <label className='form-label mb-0'>カテゴリー</label>
            <select className='form-control' onChange={(e) => setModalEventCategory(e.target.value)}>
              <option value=''>カテゴリーを選択</option>
              <option value='event' selected={modalEventCategory === 'event' ? true : false}>イベント(上段)</option>
              <option value='event_even' selected={modalEventCategory === 'event_even' ? true : false}>イベント(下段)</option>
              <option value='openhouse' selected={modalEventCategory === 'openhouse' ? true : false}>完成見学会</option>
              <option value='medium' selected={modalEventCategory === 'medium' ? true : false}>販促媒体</option>
            </select>
          </div>
          <div className='mb-3'>
            <label className='form-label mb-0'>開始日</label>
            <input type='date' className='form-control mb-3' value={modalEventStartDate} onChange={(e) => setModalEventStartDate(e.target.value)} />
          </div>
          <div className='mb-3'>
            <label className='form-label mb-0'>終了日</label>
            <input type='date' className='form-control mb-3' value={modalEventEndDate} onChange={(e) => setModalEventEndDate(e.target.value)} />
          </div>

        </Modal.Body>
        <Modal.Footer>
          <Button className='bg-secondary rounded text-white btn calendar_modal_close' variant="secondary" onClick={modalEventClose}>
            閉じる
          </Button>
          <Button className='bg-primary rounded text-white btn calendar_modal_close' variant="secondary" onClick={modalEventRegister}>
            保存
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default CalendarApp
