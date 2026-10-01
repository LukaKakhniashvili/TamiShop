import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Icon from '../../components/Icon';
import { useConfirm, useToast } from '../../context/UIContext';
import { Alert, Field, Loader, Tabs } from '../../components/ui';

const AdminCategories = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'form'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/category-list');
      setCategories(data);
    } catch (err) {
      toast({ type: 'error', title: 'კატეგორიების ჩატვირთვა ვერ მოხერხდა' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm({ name: '', description: '' });
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/category-update/${editingId}`, form);
        toast({ title: 'კატეგორია განახლდა', description: form.name });
      } else {
        await api.post('/category-create', form);
        toast({ title: 'კატეგორია დაემატა', description: form.name });
      }
      resetForm();
      loadData();
      setActiveTab('list');
    } catch (err) {
      setError(err.response?.data?.message || 'შეცდომა შენახვისას');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category) => {
    setEditingId(category._id);
    setError('');
    setForm({ name: category.name, description: category.description || '' });
    setActiveTab('form');
  };

  const handleDelete = async (category) => {
    const ok = await confirm({
      title: 'კატეგორიის წაშლა',
      message: `ნამდვილად გსურთ „${category.name}"-ის წაშლა?`,
    });
    if (!ok) return;
    try {
      await api.delete(`/category-delete/${category._id}`);
      toast({ title: 'კატეგორია წაიშალა', description: category.name });
      loadData();
    } catch (err) {
      toast({ type: 'error', title: 'კატეგორიის წაშლა ვერ მოხერხდა', description: err.response?.data?.message });
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDrop = async (e, index) => {
    e.preventDefault();
    setOverIndex(null);
    if (draggedIndex === null || draggedIndex === index) return;

    const previous = categories;
    const reordered = [...categories];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, removed);

    setCategories(reordered);
    setDraggedIndex(null);

    try {
      await api.put('/category-reorder', { ids: reordered.map((c) => c._id) });
      toast({ title: 'თანმიმდევრობა შენახულია' });
    } catch (err) {
      setCategories(previous);
      toast({ type: 'error', title: 'თანმიმდევრობის შენახვა ვერ მოხერხდა' });
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setOverIndex(null);
  };

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>კატეგორიები</h1>
          <p>შექმენით და დაალაგეთ კატეგორიები</p>
        </div>
        {activeTab === 'list' && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setActiveTab('form'); }}>
            <Icon name="plus" size={18} /> ახალი კატეგორია
          </button>
        )}
      </div>

      <Tabs
        active={activeTab}
        onChange={(t) => {
          if (t === 'list') resetForm();
          setActiveTab(t);
        }}
        tabs={[
          { id: 'list', label: 'სია', icon: 'grid', count: categories.length },
          { id: 'form', label: editingId ? 'რედაქტირება' : 'დამატება', icon: editingId ? 'edit' : 'plus' },
        ]}
      />

      {activeTab === 'list' ? (
        <div>
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            <Icon name="drag" size={18} />
            <span>რიგითობის შესაცვლელად გადაათრიეთ ხაზი სასურველ ადგილას.</span>
          </div>
          {loading ? (
            <Loader />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th>სახელი</th>
                    <th>სლაგი</th>
                    <th>აღწერა</th>
                    <th className="right">მოქმედება</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c, index) => (
                    <tr
                      key={c._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`drag-row ${draggedIndex === index ? 'dragging' : ''} ${overIndex === index && draggedIndex !== index ? 'drag-over' : ''}`}
                    >
                      <td>
                        <span className="drag-handle">
                          <Icon name="drag" size={18} />
                        </span>
                      </td>
                      <td className="strong">{c.name}</td>
                      <td>
                        <code className="muted" style={{ fontSize: 13 }}>{c.slug}</code>
                      </td>
                      <td className="muted" style={{ fontSize: 13 }}>
                        {c.description || '—'}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-btn" onClick={() => handleEdit(c)} title="რედაქტირება" aria-label="რედაქტირება">
                            <Icon name="edit" size={17} />
                          </button>
                          <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c)} title="წაშლა" aria-label="წაშლა">
                            <Icon name="trash" size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan="5" className="empty">
                        კატეგორიები ვერ მოიძებნა
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <form className="card card-pad form-stack" onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            {editingId ? 'კატეგორიის რედაქტირება' : 'ახალი კატეგორია'}
          </h2>
          <Alert>{error}</Alert>
          <Field label="სახელი" required>
            <input className="input" name="name" value={form.name} onChange={handleChange} required autoFocus />
          </Field>
          <Field label="აღწერა">
            <textarea className="textarea" name="description" value={form.description} onChange={handleChange} rows={3} />
          </Field>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : <Icon name="check" size={18} />}
              {editingId ? 'განახლება' : 'დამატება'}
            </button>
            <button type="button" className="btn" onClick={() => { resetForm(); setActiveTab('list'); }}>
              გაუქმება
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminCategories;
