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
  const d = new Date();
  const [month, setMonth] = useState(d.getMonth());
  const [year, setYear] = useState(d.getFullYear());

  useEffect(() => {
    getTableData(setExpenseData, null)
  }, []);

  function HandleExpenseUpdate(newMonth, newYear) {
    if (newMonth !== undefined && newYear !== undefined) {
      getTableData(setExpenseData, newMonth, newYear, setMonth, setYear);
    } else {
      getTableData(setExpenseData, null, null);
    }
  }

  return (
    <>
      <Title getExpenseData={HandleExpenseUpdate} month={month} year={year} setMonth={setMonth} setYear={setYear} />
      <div className='row'>
        <div className='col-md-6 expense-container'>
          <Expense expenseSaved={HandleExpenseUpdate} />
        </div>
        <div className='col-md-6'>
          <RemainingBalance expenseData={expenseData} />
        </div>
      </div>
      <div className='row' id="renderedData">
        <Table tableData={expenseData} />
      </div>
    </>
  )
}

export default App
