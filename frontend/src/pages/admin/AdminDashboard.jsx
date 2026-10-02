import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/Icon';
import { getInitials } from '../../components/ui';

const links = [
  { to: '/admin/products', label: 'პროდუქტები', icon: 'box' },
  { to: '/admin/categories', label: 'კატეგორიები', icon: 'tag' },
  { to: '/admin/orders', label: 'შეკვეთები', icon: 'receipt' },
  { to: '/admin/users', label: 'მომხმარებლები', icon: 'users' },
  { to: '/admin/notifications', label: 'შეტყობინებები', icon: 'bell' },
  { to: '/admin/reviews', label: 'შეფასებები', icon: 'star' },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="container page admin">
      <aside className="card admin-side">
        <div className="admin-side-head">
          <span className="avatar">{getInitials(user)}</span>
          <div style={{ minWidth: 0 }}>
            <strong>სამართავი პანელი</strong>
            <span>{user?.role === 'admin' ? 'ადმინისტრატორი' : 'მენეჯერი'}</span>
          </div>
        </div>
        <nav className="admin-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={l.icon} size={18} />
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div key={location.pathname} className="page-enter" style={{ minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  );
};

export default AdminDashboard;
