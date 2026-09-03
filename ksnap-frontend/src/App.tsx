import Content from './components/Content';
import Top from './components/Top';
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
// import { Dashboard } from './components/Dashboard';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE, API_HEADERS } from './config';
type CustomerData = Record<string, string>;

function App() {
  return (
    <Router basename="/">
      <AppInner />
    </Router>
  );
}

function AppInner() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const id = params.get("id") ?? '';
  const page = params.get("page");

  const isAllowed = location.state?.fromTop === true || id !== '';

  const [mainCategory, setMainCategory] = useState((page && page !== 'search') ? page : 'tag');
  const [customerData, setCustomerData] = useState<CustomerData>({});
  const [viewCount, setViewCount] = useState(0);


  useEffect(() => {
    if (page && page !== 'search') {
      setMainCategory(page);
    }
  }, [page]);


  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const response = await axios.post(API_BASE, { request: 'k-snap_customer', id: id }, { headers: API_HEADERS });
        const filtered = response.data.customer;
        if (filtered) {
          setCustomerData(filtered);
        } else {
          setCustomerData(prev => ({
            ...prev,
            id: id
          }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
  }, [id]);

  const handleBookmark = (idValue: string) => {
    if (!customerData.id && !idValue) {
      const prevArray = (localStorage.getItem('bookmark') ?? '').split(',');
      const newArray = [...prevArray, idValue];
      localStorage.setItem('bookmark', newArray.join(','));
    } else {
      const prevArray = customerData.bookmark
        ? customerData.bookmark.split(',')
        : [];
      let newArray: string[] = [];

      if (prevArray.includes(idValue)) {
        newArray = prevArray.filter(p => p !== idValue);
      } else {
        newArray = [...prevArray, idValue];
      }

      setCustomerData(prev => ({
        ...prev,
        bookmark: newArray.join(',')
      }));
    }
  };

  useEffect(() => {
    const storageViewCount = Number(localStorage.getItem('view'));

    if (!Number.isNaN(storageViewCount) && storageViewCount > 0) {
      setViewCount(storageViewCount);
    }

    const preventPinchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', preventPinchZoom, { passive: false });
    document.addEventListener('touchmove', preventPinchZoom, { passive: false });

    return () => {
      document.removeEventListener('touchstart', preventPinchZoom);
      document.removeEventListener('touchmove', preventPinchZoom);
    };
  }, []);

  useEffect(() => {
    if (!customerData.id) return;
    const postData = {
      ...customerData,
      request: 'k-snap_customer_update'
    };
    const fetchData = async () => {
      try {
        await axios.post(API_BASE, postData, { headers: API_HEADERS });
      } catch (err) {
        console.error(err)
      }
    };
    fetchData();
  }, [customerData]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          (page !== null && page.trim() === "") ? (
            <Navigate to="/" replace />
          ) :
            (page && page.trim() !== "") ? (
              isAllowed
                ? <Content customerData={customerData}
                  setCustomerData={setCustomerData}
                  handleBookmark={handleBookmark} mainCategory={mainCategory}
                  setMainCategory={setMainCategory}
                  viewCount={viewCount}
                  setViewCount={setViewCount} />
                : <Navigate to="/" replace />
            ) :
              (
                <Top customerData={customerData} />
              )
        }
      />
      {/* <Route path="/dashboard" element={<Dashboard />} /> */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;