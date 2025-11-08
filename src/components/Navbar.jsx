import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav style={{ display: "flex", gap: "10px", padding: "10px", justifyContent: "center" }}>
      <Link to="/">Home</Link>
      <Link to="/race">Race</Link>
      <Link to="/friends">Friends</Link>
      <Link to="/tasks">Tasks</Link>
      <Link to="/shop">Shop</Link>
    </nav>
  );
}

export default Navbar;
