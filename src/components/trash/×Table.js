import React from 'react'
import "./Table.css";
import "bootstrap/dist/css/bootstrap.min.css";

const Table = ({ userData }) => {

  const registerDesc =  () =>{
  }

  const registerAsc =  () =>{
  }

  const reserveDesc =  () =>{
  }

  const reserveAsc =  () =>{
  }

  const contractDesc =  () =>{
  }

  const contractAsc =  () =>{
  }
  return (
    <div className='container bg-white'>
        <table className="table table-striped mt-3">
            <thead>
                <tr>
                    <th scope="col">販促媒体名</th>
                    <th scope="col">総反響<span className="sort"><div className="desc" onClick={registerDesc}></div><div className="asc" onClick={registerAsc}></div></span></th>
                    <th scope="col">来場率</th>
                    <th scope="col">来場数<span className="sort"><div className="desc" onClick={reserveDesc}></div><div className="asc" onClick={reserveAsc}></div></span></th>
                    <th scope="col">契約率</th>
                    <th scope="col">契約数<span className="sort"><div className="desc" onClick={contractDesc}></div><div className="asc" onClick={contractAsc}></div></span></th>
                    <th scope="col">Aランク</th>
                    <th scope="col">Bランク</th>
                    <th scope="col">Cランク</th>
                    <th scope="col">Dランク</th>
                    <th scope="col">Eランク</th>
                    <th scope="col">総予算</th>
                    <th scope="col">反響単価</th>
                    <th scope="col">来場単価</th>
                    <th scope="col">契約単価</th>
                </tr>
            </thead>
            <tbody>
            {userData.map((customer, index) => (
          <tr key={index}>
                    <td>{ customer.medium }</td>
                    <td>{ customer.register_count }</td>
                    <td>{ customer.reserve_per }%</td>
                    <td>{ customer.reserve_count }</td>
                    <td>{ customer.contract_per }%</td>
                    <td>{ customer.contract_count }</td>
                    <td>{ customer.rankA_count }</td>
                    <td>{ customer.rankB_count }</td>
                    <td>{ customer.rankC_count }</td>
                    <td>{ customer.rankD_count }</td>
                    <td>{ customer.rankE_count }</td>
            </tr>  ))}
        </tbody>
    </table>
    </div>
  )
}

export default Table