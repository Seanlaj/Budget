import { useState } from 'react'
import "bootstrap/dist/css/bootstrap.min.css";
// import "bootstrap/dist/js/bootstrap.bundle.min";
import './App.css'
import './index.css'
import Expense from './components/Expense'
import Table from "./components/Table";
import { getTableData } from './components/expenseData';
import { useEffect } from 'react';
import RemainingBalance from './components/RemainingBalance';
import Title from './components/Title';

function App() {
  const [expenseData, setExpenseData] = useState([]);

  useEffect(() => {
    getTableData(setExpenseData)
  }, []);

  function HandleExpenseUpdate() {
    getTableData(setExpenseData)
  }

  return (
    <>
      <Title/>
      <div className='row'>
        <div className='col-md-6 ml-2 d-flex'>
          <Expense expenseSaved={HandleExpenseUpdate} />
        </div>
        <div className='col-md-6 mv-3'>
          <RemainingBalance expenseData={expenseData} />
        </div>
      </div>
      <div>
        <Table tableData={expenseData} />
      </div>
    </>
  )
}

export default App
