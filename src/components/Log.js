import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthContext from "../context/AuthContext";
import MenuDev from "./MenuDev";

const Log = () => {
  const [logList, setLogList] = useState([]);
  const { brand } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if( !brand || brand.trim() === "") navigate("/");
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
    <div className="outer-container">
      <div className="d-flex">
        <div className="modal_menu" style={{ width: "20%" }}>
          <MenuDev brand={brand}/>
        </div>
        <div className="content database bg-white p-2">

              <Table bordered hover>
                <thead>
                  <tr>
                    <th>ログイン日時</th>
                    <th>氏名</th>
                  </tr>
                </thead>
                <tbody>
                  {logList.map((value, index) => (
                    <tr key={index}>
                      <th>{value.timestamp}</th>
                      <th>{value.staff}</th>
                    </tr>
                  ))}
                </tbody>
              </Table>

        </div>
      </div>
    </div>
  );
};

export default Log;
