export async function getTableData(setExpenseData, month, year, setMonth, setYear) {
  try {

    let response = "";
    if (month !== null && year !== null) {
      response = await fetch(`https://script.google.com/macros/s/AKfycbxkfSy9HtJyZSMTp9lyz-nlNaGzjTHuNkooM-UShLLIoVw9AZgrZO2wEgEXVv-F0tG7/exec?month=${month}&year=${year}`);
    } else {
      response = await fetch("https://script.google.com/macros/s/AKfycbxkfSy9HtJyZSMTp9lyz-nlNaGzjTHuNkooM-UShLLIoVw9AZgrZO2wEgEXVv-F0tG7/exec");
    }

    if (!response.ok) {
      console.log("Error!");
    }

    const text = await response.text();
    const jsonData = JSON.parse(text);

    const expenseArray = formatData(jsonData);

    const saveButton = document.getElementById("saveExpense");
    saveButton.style.display = "inline";

    const savingButton = document.getElementById("expenseSaving");
    savingButton.style.display = "none";

    setExpenseData(expenseArray);

    if (month !== null && year !== undefined) {
      setMonth(new Date(Date.parse(month + 1,)).getMonth());
      setYear(year);
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