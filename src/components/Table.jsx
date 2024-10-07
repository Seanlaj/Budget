export default function Table({ tableData, month, year, updateExpenses }) {
    const monthArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    function HandleDelete(id) {

        document.getElementById(`deleteIcon${id}`).style.display = "none";
        document.getElementById(`deleteLoading${id}`).style.display = "flex";

        // const formData = new FormData();

        // let data = {
        //     row: id + 1,
        //     month: month,
        //     year: year
        // };

        // for (const key in data) {
        //     formData.append(key, data[key]);
        // }

        try {
            fetch(`https://d1-budget.slajeun217.workers.dev/api/delete?id=${id}`, {
                method: "POST",
                // body: formData,
                mode: "no-cors"
            }).then(() => {
                updateExpenses(month, year);
                document.getElementById(`deleteIcon${id}`).style.display = "flex";
                document.getElementById(`deleteLoading${id}`).style.display = "none";
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
                        <th className="align-middle">Date</th>
                        <th className="align-middle">Amount</th>
                        <th className="align-middle">Store</th>
                        <th className="align-middle">Items</th>
                        <th className="align-middle">Category</th>
                        <th className="align-middle">Delete</th>
                    </tr>
                </thead>
                <tbody>
                    {tableData.length > 0 ? (tableData.map((row, i) => {
                        if (row.Date !== 'Invalid Date') {
                            return (
                                <tr key={row.Id}>
                                    <td className="align-middle">{row.Date}</td>
                                    <td className="align-middle">${row.Amount}</td>
                                    <td className="align-middle">{row.Store}</td>
                                    <td className="align-middle">{row.Items}</td>
                                    <td className="align-middle">{row.Category}</td>
                                    <td className="align-middle">
                                        <div className="d-flex align-items-center flex-column">
                                            <button onClick={() => { let result = confirm("Are you sure you want to delete this expense?"); if (result) { HandleDelete(row.Id); } }} className="delete-button">
                                                <svg id={`deleteIcon${row.Id}`} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-trash text-danger" viewBox="0 0 16 16">
                                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                                                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
                                                </svg>
                                                <span id={`deleteLoading${row.Id}`} className="spinner-border spinner-border-sm text-danger" style={{display: 'none'}} role="status" aria-hidden="true"></span>
                                            </button>
                                        </div>
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