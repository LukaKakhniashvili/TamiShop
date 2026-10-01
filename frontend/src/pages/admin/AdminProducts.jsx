import { useEffect, useState } from 'react';
import api from '../../api/axios';
import RichTextEditor from '../../components/RichTextEditor';
import Icon from '../../components/Icon';
import { useConfirm, useToast } from '../../context/UIContext';
import { Alert, Field, Loader, Tabs, formatPrice } from '../../components/ui';

const emptyForm = { name: '', description: '', price: '', oldPrice: '', onSale: false, specifications: [], image: '', images: [], category: '', inStock: true };
const emptyFilters = { search: '', category: '', inStock: '' };

const AdminProducts = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'form'

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [filters, setFilters] = useState(emptyFilters);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(t);
  }, [filters.search]);

  const loadCategories = async () => {
    try {
      const { data } = await api.get('/category-list');
      setCategories(data);
    } catch (err) {
      toast({ type: 'error', title: 'კატეგორიების ჩატვირთვა ვერ მოხერხდა' });
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 100,
        admin: 'true',
        search: debouncedSearch || undefined,
        category: filters.category || undefined,
        inStock: filters.inStock !== '' ? filters.inStock : undefined,
      };
      const { data } = await api.get('/product-list', { params });
      setProducts(data.products);
    } catch (err) {
      toast({ type: 'error', title: 'პროდუქტების ჩატვირთვა ვერ მოხერხდა' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [debouncedSearch, filters.category, filters.inStock]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const addImageFiles = (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(file);
          })
      )
    ).then((newImages) => {
      setForm((prev) => {
        const updatedImages = [...(prev.images || []), ...newImages];
        return {
          ...prev,
          images: updatedImages,
          image: prev.image || updatedImages[0] || '',
        };
      });
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        oldPrice: form.onSale ? Number(form.oldPrice) : null,
        onSale: form.onSale,
        specifications: form.specifications,
        inStock: form.inStock,
        images: form.images || (form.image ? [form.image] : []),
      };
      if (editingId) {
        await api.put(`/product-update/${editingId}`, payload);
        toast({ title: 'პროდუქტი განახლდა', description: form.name });
      } else {
        await api.post('/product-create', payload);
        toast({ title: 'პროდუქტი დაემატა', description: form.name });
      }
      resetForm();
      loadProducts();
      setActiveTab('list');
    } catch (err) {
      setError(err.response?.data?.message || 'შეცდომა შენახვისას');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product) => {
    setEditingId(product._id);
    setError('');
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      oldPrice: product.oldPrice || '',
      onSale: product.onSale || false,
      specifications: product.specifications || [],
      image: product.image || '',
      images: product.images || (product.image ? [product.image] : []),
      category: product.category?._id || product.category,
      inStock: product.inStock !== undefined ? product.inStock : true,
    });
    setActiveTab('form');
  };

  const handleDelete = async (product) => {
    const ok = await confirm({
      title: 'პროდუქტის წაშლა',
      message: `ნამდვილად გსურთ „${product.name}"-ის წაშლა? ეს მოქმედება შეუქცევადია.`,
    });
    if (!ok) return;
    try {
      await api.delete(`/product-delete/${product._id}`);
      toast({ title: 'პროდუქტი წაიშალა', description: product.name });
      loadProducts();
    } catch (err) {
      toast({ type: 'error', title: 'წაშლა ვერ მოხერხდა' });
    }
  };

  const updateSpec = (index, key, value) => {
    const newSpecs = form.specifications.map((s, i) => (i === index ? { ...s, [key]: value } : s));
    setForm({ ...form, specifications: newSpecs });
  };

  const hasFilters = filters.search || filters.category || filters.inStock;

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>პროდუქტები</h1>
          <p>მართეთ კატალოგი, ფასები და მარაგი</p>
        </div>
        {activeTab === 'list' && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setActiveTab('form'); }}>
            <Icon name="plus" size={18} /> ახალი პროდუქტი
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
          { id: 'list', label: 'სია', icon: 'grid', count: products.length },
          { id: 'form', label: editingId ? 'რედაქტირება' : 'დამატება', icon: editingId ? 'edit' : 'plus' },
        ]}
      />

      {activeTab === 'list' ? (
        <div>
          <div className="card filters">
            <div className="filters-grid">
              <Field label="ძებნა">
                <div className="input-group">
                  <span className="input-icon">
                    <Icon name="search" size={16} />
                  </span>
                  <input
                    className="input input-sm"
                    type="text"
                    placeholder="პროდუქტის სახელი..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  />
                </div>
              </Field>
              <Field label="კატეგორია">
                <select className="select input-sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                  <option value="">ყველა კატეგორია</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="მარაგი">
                <select className="select input-sm" value={filters.inStock} onChange={(e) => setFilters({ ...filters, inStock: e.target.value })}>
                  <option value="">ყველა სტატუსი</option>
                  <option value="true">მარაგშია</option>
                  <option value="false">არ არის მარაგში</option>
                </select>
              </Field>
              {hasFilters && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters(emptyFilters)} style={{ height: 38 }}>
                  <Icon name="x" size={16} /> გასუფთავება
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <Loader />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}></th>
                    <th>სახელი</th>
                    <th>კატეგორია</th>
                    <th>ფასი</th>
                    <th>სტატუსი</th>
                    <th className="right">მოქმედება</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p._id} style={{ animationDelay: `${Math.min(i, 15) * 25}ms` }}>
                      <td>
                        <img className="thumb-sm" src={p.image || p.images?.[0] || 'https://placehold.co/50x50'} alt="" />
                      </td>
                      <td className="strong">{p.name}</td>
                      <td>{p.category?.name ? <span className="pill pill-neutral no-dot">{p.category.name}</span> : '—'}</td>
                      <td className="nowrap">
                        <span className="strong">{formatPrice(p.price)}</span>
                        {p.onSale && p.oldPrice && <span className="sub" style={{ textDecoration: 'line-through' }}>{formatPrice(p.oldPrice)}</span>}
                      </td>
                      <td>
                        <span className={`pill ${p.inStock ? 'pill-success' : 'pill-danger'}`}>{p.inStock ? 'მარაგშია' : 'ამოწურულია'}</span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-btn" onClick={() => handleEdit(p)} title="რედაქტირება" aria-label="რედაქტირება">
                            <Icon name="edit" size={17} />
                          </button>
                          <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(p)} title="წაშლა" aria-label="წაშლა">
                            <Icon name="trash" size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan="6" className="empty">
                        პროდუქტები ვერ მოიძებნა
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <form className="form-stack" onSubmit={handleSubmit}>
          <Alert>{error}</Alert>

          <section className="card card-pad">
            <h2 className="card-title">ძირითადი ინფორმაცია</h2>
            <div className="form-grid">
              <Field label="სახელი" required>
                <input className="input" name="name" value={form.name} onChange={handleChange} required />
              </Field>
              <Field label="კატეგორია" required>
                <select className="select" name="category" value={form.category} onChange={handleChange} required>
                  <option value="">აირჩიეთ...</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="card-title">ფასი და მარაგი</h2>
            <div className="form-grid">
              <Field label="მიმდინარე ფასი (₾)" required>
                <input className="input" name="price" type="number" step="0.01" min="0" value={form.price} onChange={handleChange} required />
              </Field>
              <Field label="ძველი ფასი (₾)" required={form.onSale} hint={!form.onSale ? 'ჩართეთ ფასდაკლება ძველი ფასის მისათითებლად' : undefined}>
                <input
                  className="input"
                  name="oldPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.oldPrice}
                  onChange={handleChange}
                  disabled={!form.onSale}
                  required={form.onSale}
                />
              </Field>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.onSale}
                  onChange={(e) => setForm({ ...form, onSale: e.target.checked, oldPrice: e.target.checked ? form.oldPrice : '' })}
                />
                <span className="track" />
                ფასდაკლებაშია
              </label>
              <label className="switch">
                <input type="checkbox" checked={form.inStock} onChange={(e) => setForm({ ...form, inStock: e.target.checked })} />
                <span className="track" />
                მარაგშია
              </label>
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="card-title">სურათები</h2>
            <input type="file" accept="image/*" multiple onChange={(e) => { addImageFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} id="product-image-upload" />
            <label
              htmlFor="product-image-upload"
              className={`upload-zone ${dragOver ? 'over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addImageFiles(e.dataTransfer.files);
              }}
            >
              <Icon name="upload" size={28} />
              <span>ჩააგდეთ სურათები აქ ან დააჭირეთ ასარჩევად</span>
              <small>შეგიძლიათ აირჩიოთ რამდენიმე ფაილი</small>
            </label>

            {form.images?.length > 0 && (
              <div className="img-grid">
                {form.images.map((imgStr, idx) => {
                  const isMain = form.image === imgStr;
                  return (
                    <div key={idx} className={`img-tile ${isMain ? 'main' : ''}`}>
                      <img src={imgStr} alt={`სურათი ${idx + 1}`} />
                      {isMain && <span className="main-tag">მთავარი</span>}
                      <div className="tile-actions">
                        {!isMain && (
                          <button type="button" onClick={() => setForm({ ...form, image: imgStr })}>
                            მთავარად
                          </button>
                        )}
                        <button
                          type="button"
                          className="del"
                          aria-label="სურათის წაშლა"
                          onClick={() => {
                            const filteredImages = form.images.filter((_, i) => i !== idx);
                            setForm({ ...form, images: filteredImages, image: isMain ? filteredImages[0] || '' : form.image });
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="card-title">მახასიათებლები</h2>
            <div className="form-stack" style={{ gap: 10 }}>
              {form.specifications?.map((spec, index) => (
                <div key={index} className="spec-edit">
                  <input
                    className="input input-sm"
                    type="text"
                    placeholder="მახასიათებელი (მაგ. ოპერატიული მეხსიერება)"
                    value={spec.key}
                    onChange={(e) => updateSpec(index, 'key', e.target.value)}
                    required
                  />
                  <input
                    className="input input-sm"
                    type="text"
                    placeholder="მნიშვნელობა (მაგ. 12 GB)"
                    value={spec.value}
                    onChange={(e) => updateSpec(index, 'value', e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ color: 'var(--danger)', width: 38, height: 38 }}
                    aria-label="წაშლა"
                    onClick={() => setForm({ ...form, specifications: form.specifications.filter((_, i) => i !== index) })}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setForm({ ...form, specifications: [...(form.specifications || []), { key: '', value: '' }] })}
              >
                <Icon name="plus" size={16} /> მახასიათებლის დამატება
              </button>
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="card-title">აღწერა</h2>
            <RichTextEditor key={editingId || 'new'} defaultValue={form.description} onChange={(val) => setForm((prev) => ({ ...prev, description: val }))} />
          </section>

          <div className="form-actions">
            <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : <Icon name="check" size={18} />}
              {editingId ? 'ცვლილებების შენახვა' : 'პროდუქტის დამატება'}
            </button>
            <button type="button" className="btn btn-lg" onClick={() => { resetForm(); setActiveTab('list'); }}>
              გაუქმება
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminProducts;
