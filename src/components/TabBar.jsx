// components/TabBar.jsx
import { NavLink } from "react-router-dom";
import { FaHome, FaFlagCheckered, FaUserFriends, FaTasks, FaShoppingCart, FaGamepad, FaLaptopCode } from "react-icons/fa";

const TabBar = () => {
    
  const tickets = Number(localStorage.getItem("tickets")) || 0;
    
const tabs = [
  { to: "/", label: "Planet", icon: <FaGlobeAmericas /> },
  { to: "/missions", label: "Missions", icon: <FaRocket /> },
  { to: "/colony", label: "Colony", icon: <FaCity /> },
  { to: "/locations", label: "Locations", icon: <FaMapMarkerAlt /> },
  { to: "/friends", label: "Friends", icon: <FaUserFriends /> }
];

  return (
    <nav style={styles.nav}>
      {tabs.map((tab) => (
        <NavLink
          to={tab.to}
          state={tab.state}    
          key={tab.to}
          style={({ isActive }) => ({
            ...styles.link,
            color: isActive ? "#1da7ff" : "#d3d3d3",
          })}
        >
          <div style={styles.icon}>{tab.icon}</div>
          <span style={styles.label}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

const styles = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60px",
    backgroundColor: "#2d2d2d",
    borderTop: "1px solid #2d2d2d",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 1000,
    paddingBottom: "5px",  },
  link: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textDecoration: "none",
    fontSize: "12px",
  },
  icon: {
    fontSize: "20px",
    marginBottom: "2px",
  },
  label: {
    fontSize: "11px",
  },
};

export default TabBar;
