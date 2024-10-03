export function getTableData(setExpenseData, month, year, setMonth, setYear) {
  try {

    if (month !== null && year !== null) {
      let dataCall = fetch(`https://script.google.com/macros/s/AKfycbxkfSy9HtJyZSMTp9lyz-nlNaGzjTHuNkooM-UShLLIoVw9AZgrZO2wEgEXVv-F0tG7/exec?month=${month}&year=${year}`);

      dataCall.then(res => res.json()).then(res => {
        UpdateUI(res, setExpenseData, month, year, setMonth, setYear);
      });
    } else {
      let dataCall = fetch("https://script.google.com/macros/s/AKfycbxkfSy9HtJyZSMTp9lyz-nlNaGzjTHuNkooM-UShLLIoVw9AZgrZO2wEgEXVv-F0tG7/exec");
      dataCall.then(res => res.json()).then(res => {
        UpdateUI(res, setExpenseData, month, year, setMonth, setYear);
      });
    }
  } catch (error) {
    console.error(error.message);
  }
}

function UpdateUI(res, setExpenseData, month, year, setMonth, setYear) {
  let newMonth = new Date(Date.parse(month + 1,)).getMonth();

  if (month !== null && year !== undefined) {
    setMonth(newMonth);
    setYear(year);
  }

  const expenseArray = formatData(res);
  setExpenseData(expenseArray);

  document.getElementById("saveExpense").style.display = "inline";
  document.getElementById("expenseSaving").style.display = "none";
}

function formatData(data) {
  return data.filter((exp) => exp[1] !== "Invalid Date").map((exp) => {
    return ({
      "Date": new Date(exp[0]).toLocaleDateString("en-US"),
      "Amount": exp[1],
      "Store": exp[2],
      "Items": exp[3],
      "Category": exp[4],
    })
  });
}