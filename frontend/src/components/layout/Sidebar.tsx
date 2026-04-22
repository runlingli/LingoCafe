import { NavLink } from "react-router-dom";
import { CreateIcon, HomeIcon, ProfileIcon, SearchIcon, StudyIcon } from "@/components/icons/Icon";
import styles from "./Sidebar.module.css";

const navItems = [
  { to: "/", label: "Home", Icon: HomeIcon },
  { to: "/search", label: "Search", Icon: SearchIcon },
  { to: "/create", label: "Create", Icon: CreateIcon },
  { to: "/learn", label: "Learn", Icon: StudyIcon },
  { to: "/profile", label: "Profile", Icon: ProfileIcon }
] as const;

const Sidebar = () => {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <img src="/globe.png" alt="LingoCafe" />
      </div>
      <nav className={styles.nav}>
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.linkActive}` : styles.link)}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.divider} />
      <div className={styles.footer}>
        <span>LingoCafe</span>
        <div>Language learning reimagined</div>
      </div>
    </aside>
  );
};

export default Sidebar;
