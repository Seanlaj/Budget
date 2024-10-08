export default function Expense({ expenseData, setExpenseData }) {

    function Submit(e) {
        const form = document.querySelector("form");
        e.preventDefault();

        const saveButton = document.getElementById("saveExpense");
        saveButton.style.display = "none";

        const savingButton = document.getElementById("expenseSaving");
        savingButton.style.display = "inline";

        const formData = new FormData(form);            

    try {
        fetch("https://d1-budget.slajeun217.workers.dev/api/create", {
            method: "POST",
            body: formData
        }).then(() => {
            let expenseDate = new Date(formData.get("Date") + " 00:00:00");
            const newMonth = expenseDate.getMonth();
            const newYear = expenseDate.getFullYear().toString();

            setExpenseData({
                ...expenseData,
                "Month": newMonth,
                "Year": newYear
            });
            form.reset();
        })
            .then(() => {
                let expenseDate = new Date(formData.get("Date") + " 00:00:00");
                const newMonth = expenseDate.getMonth();
                const newYear = expenseDate.getFullYear().toString();

                setExpenseData({
                    ...expenseData,
                    "Month": newMonth,
                    "Year": newYear
                });
                form.reset();
            })
            .catch(() => console.log("this is in the fetch catch"));
    } catch (error) {
        console.error("This is in the catch: " + error.message);
    }
}

return (
    <div id="newExpense">
        <h3>Add a new Expense</h3>
        <form onSubmit={(e) => Submit(e)}>
            <div className="form-group mt-4">
                <label htmlFor="date">Date</label>
                <input type="date" className="form-control" name="Date" id="date" required />
            </div>
            <div className="form-group mt-2">
                <label htmlFor="amount">Amount</label>
                <input type="number" className="form-control" name="Amount" id="amount" min="0" step=".01" inputMode="decimal" required />
            </div>
            <div className="form-group mt-2">
                <label htmlFor="store">Store</label>
                <input type="text" className="form-control" name="Store" id="store" required />
            </div>
            <div className="form-group mt-2">
                <label htmlFor="items">Item(s)</label>
                <input type="text" className="form-control" name="Items" id="items" required />
            </div>
            <div className="form-group mt-2">
                <label htmlFor="category">Category</label>
                <select defaultValue={""} className="form-control" id="category" name="Category" required>
                    <option value="" disabled>Select...</option>
                    <option value="Car Maintenance">Car Maintenance</option>
                    <option value="Clothes">Clothes</option>
                    <option value="Costco">Costco</option>
                    <option value="Eating Out">Eating Out</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Gas">Gas</option>
                    <option value="Gifts">Gifts</option>
                    <option value="Giving">Giving</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Miscellaneous Needs">Miscellaneous Needs</option>
                    <option value="Non-Essentials (Wants)">Non-Essentials (Wants)</option>
                </select>
            </div>
            <button id="saveExpense" type="submit" className="btn mt-5">
                Save
            </button>
            <button id="expenseSaving" className="btn mt-5" type="submit" disabled style={{ display: 'none' }}>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Saving...
            </button>
        </form>
    </div>
)
}