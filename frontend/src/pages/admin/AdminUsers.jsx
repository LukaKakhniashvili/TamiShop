import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Icon from '../../components/Icon';
import { useConfirm, useToast } from '../../context/UIContext';
import { Alert, Field, Loader, Pagination, PasswordInput, Tabs, getInitials } from '../../components/ui';

const PAGE_SIZE = 10;
const emptyForm = { firstName: '', lastName: '', email: '', password: '', role: 'manager', isActive: true };

const AdminUsers = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('customers'); // 'customers', 'internal_list', or 'internal_form'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Pagination for customers
  const [customerPage, setCustomerPage] = useState(1);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/user-list');
      setUsers(data);
    } catch (err) {
      toast({ type: 'error', title: 'მონაცემების ჩატვირთვა ვერ მოხერხდა' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFormChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  };

  const handleAddOrUpdateUser = async (e) => {
    e.preventDefault();
    setError('');

    // Password policy check for new users
    if (!editingId) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(form.password)) {
        setError('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს, ერთ დიდ ასოს და ერთ ციფრს');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/user-update/${editingId}`, payload);
        toast({ title: 'მომხმარებელი განახლდა', description: form.email });
      } else {
        await api.post('/user-create', form);
        toast({ title: 'მომხმარებელი დაემატა', description: form.email });
      }
      resetForm();
      loadData();
      setActiveTab('internal_list');
    } catch (err) {
      setError(err.response?.data?.message || 'შეცდომა შენახვისას');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (user) => {
    setEditingId(user._id);
    setError('');
    setForm({
      firstName: user.firstName,
      lastName: user.lastName || '',
      email: user.email,
      password: '', // blank password unless changing it
      role: user.role,
      isActive: user.isActive !== undefined ? user.isActive : true,
    });
    setActiveTab('internal_form');
  };

  const handleDeleteUser = async (user) => {
    const ok = await confirm({
      title: 'მომხმარებლის წაშლა',
      message: `ნამდვილად გსურთ ${user.email}-ის წაშლა?`,
    });
    if (!ok) return;
    try {
      await api.delete(`/user-delete/${user._id}`);
      toast({ title: 'მომხმარებელი წაიშალა', description: user.email });
      loadData();
    } catch (err) {
      toast({ type: 'error', title: 'წაშლა ვერ მოხერხდა', description: err.response?.data?.message });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ka-GE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const q = search.trim().toLowerCase();
  const matches = (u) =>
    !q || [u.firstName, u.lastName, u.email, u.phone].some((v) => v?.toLowerCase().includes(q));

  const customers = users.filter((u) => u.role === 'customer' && matches(u));
  const internalUsers = users.filter((u) => u.role === 'admin' || u.role === 'manager');

  const totalCustomerPages = Math.ceil(customers.length / PAGE_SIZE);
  const paginatedCustomers = customers.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE);

  const switchTab = (t) => {
    if (t !== 'internal_form') resetForm();
    if (t === 'customers') setCustomerPage(1);
    setActiveTab(t);
  };

  const userCell = (u) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="avatar">{getInitials(u)}</span>
      <div style={{ minWidth: 0 }}>
        <span className="strong">
          {u.firstName} {u.lastName}
        </span>
        <span className="sub">{u.email}</span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>მომხმარებლები</h1>
          <p>კლიენტები და შიდა გუნდის წევრები</p>
        </div>
        {activeTab !== 'internal_form' && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setActiveTab('internal_form'); }}>
            <Icon name="plus" size={18} /> შიდა მომხმარებელი
          </button>
        )}
      </div>

      {/* ფორმა შიდა მომხმარებლების ნაწილია — მისი ჩანართი რჩება მონიშნული */}
      <Tabs
        active={activeTab === 'internal_form' ? 'internal_list' : activeTab}
        onChange={switchTab}
        tabs={[
          { id: 'customers', label: 'კლიენტები', icon: 'users', count: users.filter((u) => u.role === 'customer').length },
          { id: 'internal_list', label: 'შიდა მომხმარებლები', icon: 'shield', count: internalUsers.length },
        ]}
      />

      {loading ? (
        <Loader />
      ) : (
        <>
          {activeTab === 'customers' && (
            <div>
              <div className="card filters">
                <div className="input-group" style={{ maxWidth: 360 }}>
                  <span className="input-icon">
                    <Icon name="search" size={16} />
                  </span>
                  <input
                    className="input input-sm"
                    placeholder="სახელი, ელ. ფოსტა ან ტელეფონი..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCustomerPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>კლიენტი</th>
                      <th>ტელეფონი</th>
                      <th>მისამართი</th>
                      <th>რეგისტრაცია</th>
                      <th>ბოლო აქტივობა</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCustomers.map((u, i) => (
                      <tr key={u._id} style={{ animationDelay: `${i * 25}ms` }}>
                        <td>{userCell(u)}</td>
                        <td className="nowrap">{u.phone || '—'}</td>
                        <td style={{ fontSize: 13 }}>{u.address?.city && u.address?.street ? `${u.address.city}, ${u.address.street}` : '—'}</td>
                        <td className="nowrap muted" style={{ fontSize: 13 }}>{formatDate(u.createdAt)}</td>
                        <td className="nowrap muted" style={{ fontSize: 13 }}>{formatDate(u.updatedAt)}</td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty">
                          კლიენტები ვერ მოიძებნა
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={customerPage} totalPages={totalCustomerPages} onChange={setCustomerPage} />
            </div>
          )}

          {activeTab === 'internal_list' && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>მომხმარებელი</th>
                    <th>როლი</th>
                    <th>სტატუსი</th>
                    <th className="right">მოქმედება</th>
                  </tr>
                </thead>
                <tbody>
                  {internalUsers.map((u) => (
                    <tr key={u._id}>
                      <td>{userCell(u)}</td>
                      <td>
                        <span className={`pill no-dot ${u.role === 'admin' ? 'pill-accent' : 'pill-info'}`}>
                          {u.role === 'admin' ? 'ადმინისტრატორი' : 'მენეჯერი'}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${u.isActive ? 'pill-success' : 'pill-danger'}`}>{u.isActive ? 'აქტიური' : 'გამორთული'}</span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-btn" onClick={() => handleEditClick(u)} title="რედაქტირება" aria-label="რედაქტირება">
                            <Icon name="edit" size={17} />
                          </button>
                          <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteUser(u)} title="წაშლა" aria-label="წაშლა">
                            <Icon name="trash" size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {internalUsers.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty">
                        შიდა მომხმარებლები ვერ მოიძებნა
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'internal_form' && (
            <form className="card card-pad form-stack" onSubmit={handleAddOrUpdateUser} style={{ maxWidth: 720 }}>
              <h2 className="card-title" style={{ marginBottom: 0 }}>
                {editingId ? 'მომხმარებლის რედაქტირება' : 'შიდა მომხმარებლის დამატება'}
              </h2>
              <Alert>{error}</Alert>

              <div className="form-grid">
                <Field label="სახელი" required>
                  <input className="input" name="firstName" value={form.firstName} onChange={handleFormChange} required />
                </Field>
                <Field label="გვარი">
                  <input className="input" name="lastName" value={form.lastName} onChange={handleFormChange} />
                </Field>
                <Field label="ელ. ფოსტა" required>
                  <input className="input" type="email" name="email" value={form.email} onChange={handleFormChange} required />
                </Field>
                <Field label="როლი" required>
                  <select className="select" name="role" value={form.role} onChange={handleFormChange} required>
                    <option value="manager">მენეჯერი (manager)</option>
                    <option value="admin">ადმინისტრატორი (admin)</option>
                  </select>
                </Field>
                <Field
                  label={editingId ? 'ახალი პაროლი' : 'პაროლი'}
                  required={!editingId}
                  className="span-2"
                  hint={editingId ? 'დატოვეთ ცარიელი, თუ არ გსურთ შეცვლა' : 'მინ. 8 სიმბოლო, 1 დიდი ასო, 1 ციფრი'}
                >
                  <PasswordInput name="password" value={form.password} onChange={handleFormChange} required={!editingId} autoComplete="new-password" />
                </Field>
              </div>

              {editingId && (
                <label className="switch">
                  <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleFormChange} />
                  <span className="track" />
                  მომხმარებელი აქტიურია
                </label>
              )}

              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? <span className="spinner" /> : <Icon name="check" size={18} />}
                  {editingId ? 'განახლება' : 'დამატება'}
                </button>
                <button type="button" className="btn" onClick={() => switchTab('internal_list')}>
                  გაუქმება
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default AdminUsers;
