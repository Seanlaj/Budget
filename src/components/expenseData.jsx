export function getTableData(setExpenseData, expenseData) {
  try {

    if (expenseData.Month !== null && expenseData.Year !== null) {
      let dataCall = fetch(`https://d1-budget.slajeun217.workers.dev/api/expensebydate?month=${expenseData.Month}&year=${expenseData.Year}`);

      dataCall.then(res => res.json()).then(res => {
        UpdateUI(res, setExpenseData, expenseData.Month, expenseData.Year);
      });
    } 
  } catch (error) {
    console.error(error.message);
  }
}

function UpdateUI(res, setExpenseData, month, year) {
  let newMonth = new Date(year, month).getMonth();

    setExpenseData({
      Expenses: res,
      Month: newMonth,
      Year: year
    });

  document.getElementById("saveExpense").style.display = "inline";
  document.getElementById("expenseSaving").style.display = "none";
}