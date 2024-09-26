export default function RemainingBalance({expenseData}) {

    const balances = {
        CarMaintenance: 50,
        Clothes: 100,        
        Costco: 220,
        EatingOut: 120,
        Entertainment: 100,        
        Gas: 175,        
        Gifts: 75,
        Giving: 20,
        Groceries: 1100,
        Healthcare: 200,
        MiscellaneousNeeds: 300,
        NonEssentialsWants: 150
    };

    const remaining = {
        CarMaintenance: balances.CarMaintenance - expenseData.filter(exp => exp.Category == "Car Maintenance").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
        Clothes: balances.Clothes - expenseData.filter(exp => exp.Category == "Clothes").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
        Costco: balances.Costco - expenseData.filter(exp => exp.Category == "Costco").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
        EatingOut: balances.EatingOut - expenseData.filter(exp => exp.Category == "Eating Out").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
        Entertainment: balances.Entertainment - expenseData.filter(exp => exp.Category == "Entertainment").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),        
        Gas: balances.Gas - expenseData.filter(exp => exp.Category == "Gas").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),        
        Gifts: balances.Gifts - expenseData.filter(exp => exp.Category == "Gifts").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
        Giving: balances.Giving - expenseData.filter(exp => exp.Category == "Giving").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
        Groceries: balances.Groceries - expenseData.filter(exp => exp.Category == "Groceries").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
        Healthcare: balances.Healthcare - expenseData.filter(exp => exp.Category == "Healthcare").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
        MiscellaneousNeeds: balances.MiscellaneousNeeds - expenseData.filter(exp => exp.Category == "Miscellaneous Needs").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
        NonEssentialsWants: balances.NonEssentialsWants - expenseData.filter(exp => exp.Category == "Non-Essentials (Wants)").map((exp) => {return Number(exp.Amount)}).reduce((partialSum, a) => partialSum + a, 0),
    }

    const total = Object.values(balances).reduce((partialSum, a) => partialSum + a, 0) - expenseData.filter(exp => exp.Date !== "Invalid Date").map((exp) => {return exp.Amount}).reduce((partialSum, a) => partialSum + a, 0);
    
    return (
        <>
            <table className="table table-striped table-bordered table-data table-responsive rounded">
            <thead>
                    <tr>
                        <th>Category</th>
                        <th>Remaining</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Car Maintenance</td>
                        <td className={remaining.CarMaintenance < 0 ? 'negative' : undefined}>${remaining.CarMaintenance.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Clothes</td>
                        <td className={remaining.Clothes < 0 ? 'negative' : undefined}>${remaining.Clothes.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Costco</td>
                        <td className={remaining.Costco < 0 ? 'negative' : undefined}>${remaining.Costco.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Eating Out</td>
                        <td className={remaining.EatingOut < 0 ? 'negative' : undefined}>${remaining.EatingOut.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Entertainment</td>
                        <td className={remaining.Entertainment < 0 ? 'negative' : undefined}>${remaining.Entertainment.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Gas</td>
                        <td className={remaining.Gas < 0 ? 'negative' : undefined}>${remaining.Gas.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Gifts</td>
                        <td className={remaining.Gifts < 0 ? 'negative' : undefined}>${remaining.Gifts.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Giving</td>
                        <td className={remaining.Giving < 0 ? 'negative' : undefined}>${remaining.Giving.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Groceries</td>
                        <td className={remaining.Groceries < 0 ? 'negative' : undefined}>${remaining.Groceries.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Healthcare</td>
                        <td className={remaining.Healthcare < 0 ? 'negative' : undefined}>${remaining.Healthcare.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Miscellaneous Needs</td>
                        <td className={remaining.MiscellaneousNeeds < 0 ? 'negative' : undefined}>${remaining.MiscellaneousNeeds.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Non-Essentials (Wants)</td>
                        <td className={remaining.NonEssentialsWants < 0 ? 'negative' : undefined}>${remaining.NonEssentialsWants.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td><b>Total</b></td>
                        <td>${total.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        </>
    )
}