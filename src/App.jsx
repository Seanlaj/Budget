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
  const d = new Date();
  const [expenseData, setExpenseData] = useState({
    Expenses: [],
    Month: d.getMonth(),
    Year: d.getFullYear()
  });

  useEffect(() => {
    getTableData(setExpenseData, expenseData);
  }, []);

  function HandleExpenseDataUpdate(expenseData) {
    getTableData(setExpenseData, expenseData);
  }

  return (
    <>
      <Title getExpenseData={HandleExpenseDataUpdate} expenseData={expenseData}/>
      <div className='row'>
        <div className='col-md-6 expense-container'>
          <Expense expenseData={expenseData} setExpenseData={HandleExpenseDataUpdate} />
        </div>
        <div className='col-md-6'>
          <RemainingBalance expenseData={expenseData} />
        </div>
      </div>
      <div className='row' id="renderedData">
        <Table expenseData={expenseData} setExpenseData={HandleExpenseDataUpdate} />
      </div>
    </>
  )
}

export default App