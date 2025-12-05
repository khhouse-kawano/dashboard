import axios from 'axios';
import React, { useEffect, useState } from 'react';
import Calendar, { CalendarProps } from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Value } from 'react-calendar/dist/cjs/shared/types';

type Customers = {
  no: number;
  id_action: string;
  staff: string;
  shop: string;
  id_related: string;
  name: string;
  estate_name_1: string;
  estate_name_2: string;
  action_date: string;
  action_method: string;
  category: string;
  medium: string;
  subject: string;
  note: string;
  case: string;
  id_case: string;
  status: string;
};

const KhfDatabase = () => {
  const [value, setValue] = useState<Value>(new Date());
  const [customers, setCustomers] = useState<Customers[]>([]);

  const formatDateLoose = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    return `${yyyy}/${mm}/${dd}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = {
          Authorization: '4081Kokubu',
          'Content-Type': 'application/json',
        };
        const response = await axios.post(
          'https://khg-marketing.info/dashboard/api/',
          { demand: 'khf_customer' },
          { headers }
        );
        setCustomers(response.data);
      } catch (error) {
        console.error('データ取得エラー:', error);
      }
    };
    fetchData();
  }, []);

  const handleChange: CalendarProps['onChange'] = (val, event) => {
    setValue(val);

    if (val instanceof Date) {
      alert(formatDateLoose(val));
    } else {
      console.warn('選択された値がDate型じゃないよ:', val);
    }
  };

  return (
    <div>
      <div className="" style={{ width: '768px', margin: '0 auto' }}>
        <Calendar
          onChange={handleChange}
          value={value}
          tileContent={({ date, view }) => {
            if (view !== 'month') return null;

            const formatted = formatDateLoose(date);
            const matched = customers.filter(item =>
              item.action_date.includes(formatted)
            );

            return (
              <div style={{ fontSize: '0.7em', color: 'green' }}>
                {matched.length > 0 && <span>{matched.length}</span>}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};

export default KhfDatabase;
