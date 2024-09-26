export default function Title() {
    const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const d = new Date();
    let name = month[d.getMonth()];
    
    return <h1 className="mb-5">{name} {d.getFullYear().toString()} Budget</h1>
}