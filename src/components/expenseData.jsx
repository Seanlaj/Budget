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

    setExpenseData(expenseArray);
    setMonth(new Date(Date.parse(month + 1,)).getMonth());
    setYear(year);

    const saveButton = document.getElementById("saveExpense");
    saveButton.style.display = "inline";

    const savingButton = document.getElementById("expenseSaving");
    savingButton.style.display = "none";

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

function pasrseTextToArray(text) {
  let commaSplit = text.split(',');
  let recordArray = [];
  let counter = 1;
  const row = {
    "Date": null,
    "Amount": null,
    "Store": null,
    "Items": null,
    "Category": null,
  };

  for (let index = 5; index < commaSplit.length; index++) {

    switch (counter) {
      case 1:
        row.Date = new Date(commaSplit[index]).toLocaleDateString("en-US");
        break;
      case 2:
        row.Amount = commaSplit[index];
        break;
      case 3:
        row.Store = commaSplit[index];
        break;
      case 4:
        row.Items = commaSplit[index];
        break;
      case 5:
        row.Category = commaSplit[index];
        break;
      default:
        break;
    }

    if (counter % 5 === 0) {
      let rowCopy = { ...row };
      recordArray.push(rowCopy);
      row.Date = null;
      row.Amount = null;
      row.Store = null;
      row.Items = null;
      row.Category = null;
      counter = 0;
    }

    counter++;
  }

  return recordArray;
}