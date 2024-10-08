export function getTableData(setExpenseData, month, year, setMonth, setYear) {
  try {

    if (month !== null && year !== null) {
      let dataCall = fetch(`https://d1-budget.slajeun217.workers.dev/api/expensebydate?month=${month}&year=${year}`);

      dataCall.then(res => res.json()).then(res => {
        UpdateUI(res, setExpenseData, month, year, setMonth, setYear);
      });
    } else {
      let d = new Date();
      const defaultMonth = d.getMonth();
      const defaultYear = d.getFullYear();
      let dataCall = fetch(`https://d1-budget.slajeun217.workers.dev/api/expensebydate?month=${defaultMonth}&year=${defaultYear}`);
      dataCall.then(res => res.json()).then(res => {
        UpdateUI(res, setExpenseData, month, year, setMonth, setYear);
      });
    }
  } catch (error) {
    console.error(error.message);
  }
}

function UpdateUI(res, setExpenseData, month, year, setMonth, setYear) {
  let newMonth = new Date(year, month).getMonth();

  if (month !== null && year !== undefined) {
    setMonth(newMonth);
    setYear(year);
  }

  setExpenseData(res);

  document.getElementById("saveExpense").style.display = "inline";
  document.getElementById("expenseSaving").style.display = "none";
}