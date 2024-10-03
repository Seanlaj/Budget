export default function Table({ tableData, month, year, updateExpenses }) {
    const monthArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    function HandleDelete(rowNum) {
        const formData = new FormData();

        let data = {
            row: rowNum + 1,
            month: month,
            year: year
        };

        for (const key in data) {
            formData.append(key, data[key]);
        }

        try {
            fetch("https://script.google.com/macros/s/AKfycbwPGRfROc9SCuYQKAHvgvXUz24r_PT5UdDrVWhWfg0x-axLv8unQgj6YA29sjawOZbX/exec", {
                method: "POST",
                body: formData,
                mode: "no-cors"
            }).then(() => {
                updateExpenses(monthArray[month], year);
            })
        } catch (error) {
            console.error(error.message);
        }
    }

    return (
        <>
            <table className="table table-striped table-bordered table-responsive my-5 table-data">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Store</th>
                        <th>Items</th>
                        <th>Category</th>
                        <th>Delete</th>
                    </tr>
                </thead>
                <tbody>
                    {tableData.length > 0 ? (tableData.map((row, i) => {
                        if (row.Date !== 'Invalid Date') {
                            return (
                                <tr key={row.Date + row.Amount + row.Items + Math.random()}>
                                    <td>{row.Date}</td>
                                    <td>${row.Amount}</td>
                                    <td>{row.Store}</td>
                                    <td>{row.Items}</td>
                                    <td>{row.Category}</td>
                                    <td><button onClick={() => {let result = confirm("Are you sure you want to delete this expense?"); if (result) {HandleDelete(i);}}} className="delete-button">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-trash text-danger" viewBox="0 0 16 16">
                                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                                            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
                                        </svg>
                                    </button>
                                    </td>
                                </tr>
                            )
                        }
                    })) : null}
                </tbody>
            </table>
        </>
    )
}