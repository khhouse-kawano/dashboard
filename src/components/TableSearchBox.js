import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Pagination from 'react-bootstrap/Pagination';
import Menu from "./Menu";

const TableSearchBox = ({userData, totalCount, brand}) => {
  const [activePage, setActivePage] = useState(1); // 現在のアクティブページを管理する状態
  const location = useLocation();
  const { shop, startMonth, endMonth, rank, medium, registerSort, reserveSort, contractSort, staff, step } = location.state || {};
  const [show, setShow] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const modalShow = (customer) =>{
    setSelectedCustomer(customer);
    setShow(true);
  };

  const modalClose = () =>{
    setSelectedCustomer(null);
    setShow(false);
  };

  const navigate = useNavigate();

  const handlePageClick = async ( event, page ) => {
    event.preventDefault();
    setActivePage(page);
    try {
      navigate("/result", {
        state: {
          shop: shop,
          startMonth: startMonth,
          endMonth: endMonth,
          rank: rank,
          medium: medium,
          registerSort: registerSort,
          reserveSort: reserveSort,
          contractSort: contractSort,
          staff: staff,
          step: step,
          page: page,
          brand: brand
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // ページングリンク
  const page1 = activePage > 3 && Math.ceil(totalCount/10) > 6 ? activePage - 2 : 1;

  let page2;
  if ( activePage > 3 && Math.ceil(totalCount/10) > 6 ){
    page2 = activePage - 1;
  } else if( Math.ceil(totalCount/10) < 2 ){
    page2 = "";
  } else{
    page2 = "2"
  }

  let page3;
  if ( activePage > 3 && Math.ceil(totalCount/10) > 6 ){
    page3 = activePage;
  } else if( Math.ceil(totalCount/10) < 3 ){
    page3 = "";
  } else{
    page3 = "3";
  }

  let page4;
  if ( activePage > 3 && Math.ceil(totalCount/10) > 6 ){
    page4 = activePage + 1;
  } else if( Math.ceil(totalCount/10) < 4 ){
    page4 = "";
  } else{
    page4 = "4";
  }

  let page5;
  if ( activePage > 3 && Math.ceil(totalCount/10) > 6 ){
    page5 = activePage + 2;
  } else if( Math.ceil(totalCount/10) < 5 ){
    page5 = "";
  } else{
    page5 = "5";
  }

  return (
    <div>
      <Menu  brand={brand}/>
      <div className="container bg-white py-2">
        <table className="table table-striped mt-3">
          <thead>
            <tr>
              <th scope="col">店舗</th>
              <th scope="col">担当営業</th>
              <th scope="col">顧客名</th>
              <th scope="col">反響日</th>
              <th scope="col">来場日</th>
              <th scope="col">販促媒体名</th>
              <th scope="col">ランク</th>
            </tr>
          </thead>
          <tbody>
            {userData.map((customer, index) => (
              <tr key={index}>
                <td>{customer.shop}</td>
                <td>{customer.staff}</td>
                <td>{customer.name}</td>
                <td>{customer.register}</td>
                <td>{customer.reserve}</td>
                <td>{customer.medium}</td>
                <td>{customer.rank}</td>
                <td><Button variant="primary" onClick={() => modalShow(customer)}>詳細</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
                <Modal show={show} onHide={modalClose} size="lg" aria-labelledby="example-custom-modal-styling-title">
                  <Modal.Header closeButton>
                    <Modal.Title id="example-custom-modal-styling-title">顧客情報詳細</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    { selectedCustomer && (
                    <div>
                    <div className="row customer-info bg-light mb-2">
                      <div className="col border">
                        <p><span>お客様名</span><br></br>{selectedCustomer.name}</p>
                      </div>
                      <div className="col border">
                        <p><span>担当店舗</span><br></br>{selectedCustomer.shop}</p>
                      </div>
                      <div className="col border">
                        <p><span>担当営業</span><br></br>{selectedCustomer.staff}</p>
                      </div>
                      <div className="col border">
                        <p><span>名簿取得日</span><br></br>{selectedCustomer.register}</p>
                      </div>
                      <div className="col border">
                        <p><span>販促媒体名</span><br></br>{selectedCustomer.medium}</p>
                      </div>
                      </div>
                    <div className="row customer-info bg-light mb-2">
                    <div className="col border">
                      <p><span>土地</span><br></br>{selectedCustomer.estate}</p>
                    </div>
                    <div className="col border">
                      <p><span>建築予定地</span><br></br>{selectedCustomer.place}</p>
                    </div>
                    <div className="col border">
                      <p><span>予算総額</span><br></br>{selectedCustomer.budget}</p>
                    </div>
                    <div className="col border">
                      <p><span>月々支払予算</span><br></br>{selectedCustomer.loan}</p>
                    </div>
                    <div className="col border">
                      <p><span>返済希望年数</span><br></br>{selectedCustomer.repayment}</p>
                    </div>
                    </div>
                    <div className="row customer-info bg-light mb-2">
                    <div className="col border">
                      <p>{selectedCustomer.meeting.split('\n').map((line, i) => (
                        <span key={i}>
                          {line}
                          <br></br>
                        </span>))}</p> 
                    </div>
                    </div>
                    <div className="row">
                      <div className="col-10"></div>
                      <div className="col-2"><Button variant="primary" onClick={modalClose}>Close</Button>
                    </div>
                  </div>
                  </div>)}
                </Modal.Body>
                </Modal>
      </div>
      <div className="pagination container p-2">
      <Pagination size="lg">
      <Pagination.First onClick={(event) => handlePageClick(event, 1)} />
      <Pagination.Prev onClick={(event) => handlePageClick(event, Math.max(activePage - 1, 1))} />
      <Pagination.Item active={activePage === page1} onClick={(event) => handlePageClick(event, page1)}>{page1}</Pagination.Item>
      { page2 ==="" ? null : <Pagination.Item active={activePage === page2} onClick={(event) => handlePageClick(event, page2)}>{page2}</Pagination.Item> }
      { page3 ==="" ? null : <Pagination.Item active={activePage === page3} onClick={(event) => handlePageClick(event, page3)}>{page3}</Pagination.Item> }
      { page4 ==="" ? null : <Pagination.Item active={activePage === page4} onClick={(event) => handlePageClick(event, page4)}>{page4}</Pagination.Item> }
      { page5 ==="" ? null : <Pagination.Item active={activePage === page5} onClick={(event) => handlePageClick(event, page5)}>{page5}</Pagination.Item> }
      <Pagination.Next onClick={(event) => handlePageClick(event, activePage + 1 < Math.ceil(totalCount/10) ? activePage + 1 : Math.ceil(totalCount/10))} />
      <Pagination.Last onClick={(event) => handlePageClick(event, Math.ceil(totalCount/10))} />
    </Pagination>
      </div>
    </div>  )
}

export default TableSearchBox