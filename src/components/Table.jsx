export default function Table({tableData}) {
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
                    </tr>
                </thead>
                <tbody>
                    {tableData.length > 0 ? (tableData.map((row) => {
                        if (row.Date !== 'Invalid Date') {
                            return (
                                <tr key={row.Date + row.Amount + row.Items + Math.random()}>
                                    <td>{row.Date}</td>
                                    <td>${row.Amount}</td>
                                    <td>{row.Store}</td>
                                    <td>{row.Items}</td>
                                    <td>{row.Category}</td>
                                </tr>
                            )
                        }
                    })) : null}
                </tbody>
            </table>
        </>
    )
}