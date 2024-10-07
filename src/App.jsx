import { useState } from 'react'
import "bootstrap/dist/css/bootstrap.min.css";
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
    getTableData(setExpenseData, null);
  }, []);

  function HandleExpenseUpdate(newMonth, newYear) {
    getTableData(setExpenseData, newMonth, newYear, setMonth, setYear);
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
        <Table tableData={expenseData} month={month} year={year} updateExpenses={HandleExpenseUpdate} />
      </div>
    </>
  )
}

export default App