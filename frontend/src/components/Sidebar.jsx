import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Meetings', end: true },
  { to: '/dashboard/action-items', label: 'Action Items' },
  { to: '/dashboard/patterns', label: 'Patterns' },
  { to: '/dashboard/settings', label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">MeetingMind</div>
      <nav>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}