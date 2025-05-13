import React, {useEffect, useState} from 'react'
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";

const Log = () => {
    const [logList, setLogList ] = useState([]);
    const location = useLocation();
    const { brand } = location.state || {};

    useEffect(() => {
      const fetchData = async () => {
        try {
          const response = await axios.post("/dashboard/api/loginLog.php");
          setLogList(response.data);
        } catch (error) {
          console.error("Error fetching user data:", error);
          setLogList([]);
        }
      };
    
      fetchData();
    }, []);

  return (
    <div>
    <Menu brand={brand} />
    <div className="container py-3  bg-white">
    <Table bordered hover>
      <thead>
        <tr>
          <th>ログイン日時</th>
          <th>氏名</th>
        </tr>
      </thead>
      <tbody>
      {logList.map((value, index) =>(
        <tr key={index}>
          <th>{value.timestamp}</th>
          <th>{value.staff}</th>
        </tr>))}
      </tbody>
    </Table>
    </div>
  </div>
  )
}

export default Log