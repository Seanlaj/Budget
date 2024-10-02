export function getTableData(setExpenseData, month, year, setMonth, setYear) {
  try {

    if (month !== null && year !== null) {
      let dataCall = fetch(`https://script.google.com/macros/s/AKfycbxkfSy9HtJyZSMTp9lyz-nlNaGzjTHuNkooM-UShLLIoVw9AZgrZO2wEgEXVv-F0tG7/exec?month=${month}&year=${year}`);

      const saveButton = document.getElementById("saveExpense");
      saveButton.style.display = "inline";

      const savingButton = document.getElementById("expenseSaving");
      savingButton.style.display = "none";

      dataCall.then(res => res.json()).then(res => {

        const expenseArray = formatData(res);

        setExpenseData(expenseArray);

        let newMonth = new Date(Date.parse(month + 1,)).getMonth();

        if (month !== null && year !== undefined) {
          setMonth(newMonth);
          setYear(year);
        }
      });
    } else {
      let dataCall = fetch("https://script.google.com/macros/s/AKfycbxkfSy9HtJyZSMTp9lyz-nlNaGzjTHuNkooM-UShLLIoVw9AZgrZO2wEgEXVv-F0tG7/exec");
      
      dataCall.then(res => res.json()).then(res => {

        const expenseArray = formatData(res);

        const saveButton = document.getElementById("saveExpense");
        saveButton.style.display = "inline";

        const savingButton = document.getElementById("expenseSaving");
        savingButton.style.display = "none";

        setExpenseData(expenseArray);

        let newMonth = new Date(Date.parse(month + 1,)).getMonth();

        if (month !== null && year !== undefined) {
          setMonth(newMonth);
          setYear(year);
        }
      });
    }
  } catch (error) {
    console.error(error.message);
  }
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