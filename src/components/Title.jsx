import { useState } from 'react'

export default function Title({ getExpenseData, month, year, setMonth, setYear }) {

    const monthArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const d = new Date();

    function HandleMonthChange(newMonth, newYear, action) {
        
        //Disable the previous month button if you're at the first month of data
        if (newMonth === 2 && newYear === 2024) {
            document.getElementById("prevMonth").style.display = 'none';
        } else {
            document.getElementById("prevMonth").style.display = 'flex';
        }

        //Disable the next month button if you're at the last month of data
        if (newMonth === (d.getMonth()) && newYear === year) {
            document.getElementById("nextMonth").style.display = 'none';
        } else {
            document.getElementById("nextMonth").style.display = 'flex';
        }

        if (newMonth === 12 && action ==="next") {
            setYear(year + 1);
            setMonth(0);
        } else if (newMonth === -1 && action === "prev") {
            setYear(year - 1);
            setMonth(11)
        } else {
            setMonth(newMonth);
            setYear(newYear);
        }

        getExpenseData(monthArray[newMonth], newYear);
    }

    return (
        <>
            <div className="mb-5 row justify-content-center align-items-center">
                <button id="prevMonth" onClick={() => HandleMonthChange(month-1, year, "prev")} className="col-md-1 month-change" style={{width: '10%', padding: '15px'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-chevron-left m-auto" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0" />
                    </svg>
                </button>

                <h1 className="d-inline col-md-10 d-inline" style={{width: '80%'}}>{monthArray[month]} {year} Budget</h1>

                <button id="nextMonth" onClick={() => HandleMonthChange(month+1, year, "next")} className="col-md-1 month-change" style={{width: '10%', display: 'none', padding: '15px'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-chevron-right m-auto" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708" />
                    </svg>
                </button>
            </div>
        </>
    )
}