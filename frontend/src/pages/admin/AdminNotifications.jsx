import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api/axios';
import Icon from '../../components/Icon';
import { Alert, Field, Loader, Pagination, Tabs } from '../../components/ui';
import { useConfirm, useToast } from '../../context/UIContext';
import { CONTENT_LANGUAGES } from '../../components/admin/TranslationsEditor';
import { Flag } from '../../components/LanguageSwitcher';
import { formatDateTime } from '../../i18n/content';
import { safeInternalLink } from '../../i18n/notifications';

/*
 * ადმინი → შეტყობინებები / კამპანიები (ადმინი და მენეჯერი).
 * გაგზავნა მხოლოდ სერვერზე ხდება (ერთი მოთხოვნა ნებისმიერი აუდიტორიისთვის — დიდი სიაც ფონურად, პარტიებად).
 * idempotencyKey — ფორმის ერთი გაგზავნა = ერთი კამპანია (ორმაგი დაჭერა დუბლიკატს არ ქმნის).
 */

const TYPES = [
  { id: 'promotion', label: 'შეთავაზება / ფასდაკლება' },
  { id: 'marketing', label: 'სიახლე / ახალი პროდუქტები' },
  { id: 'system', label: 'ზოგადი განცხადება' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.id, t.label]));
const MODES = [
  { id: 'user', label: 'კონკრეტული მომხმარებელი' },
  { id: 'selected', label: 'არჩეული მომხმარებლები' },
  { id: 'all', label: 'ყველა მყიდველი' },
];
const STATUS = {
  queued: ['რიგშია', 'pill-neutral'],
  sending: ['იგზავნება', 'pill-warning'],
  completed: ['გაგზავნილია', 'pill-success'],
  failed: ['შეცდომა', 'pill-danger'],
};
const LIMITS = { title: 120, message: 1000 };

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
const emptyForm = () => ({ type: 'promotion', title: '', message: '', translations: {}, link: '', mode: 'selected', recipients: [], key: newKey() });
const userLabel = (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;

const RecipientPicker = ({ mode, recipients, onChange }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return undefined;
    }
    const id = ++seq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/notification-recipient-search', { params: { q: term } });
        if (id === seq.current) setResults(data.users);
      } catch {
        if (id === seq.current) setResults([]);
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const add = (u) => {
    if (recipients.some((r) => r._id === u._id)) return;
    onChange(mode === 'user' ? [u] : [...recipients, u]);
    if (mode === 'user') setQ('');
  };

  return (
    <div className="nc-picker">
      <div className="input-group">
        <span className="input-icon">
          <Icon name="search" size={16} />
        </span>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="სახელი, ელ. ფოსტა ან ტელეფონი (მინ. 2 სიმბოლო)" />
      </div>
      {q.trim().length >= 2 && (
        <div className="nc-results">
          {searching && !results.length ? (
            <div className="muted nc-results-state">იძებნება...</div>
          ) : results.length === 0 ? (
            <div className="muted nc-results-state">მყიდველი ვერ მოიძებნა</div>
          ) : (
            results.map((u) => {
              const picked = recipients.some((r) => r._id === u._id);
              return (
                <button type="button" key={u._id} className={`nc-result ${picked ? 'picked' : ''}`} onClick={() => add(u)} disabled={picked}>
                  <span>
                    <strong>{userLabel(u)}</strong>
                    <small>
                      {u.email}
                      {u.phone ? ` · ${u.phone}` : ''}
                    </small>
                  </span>
                  <Icon name={picked ? 'check' : 'plus'} size={16} />
                </button>
              );
            })
          )}
        </div>
      )}
      {recipients.length > 0 && (
        <div className="nc-chips">
          {recipients.map((u) => (
            <span key={u._id} className="chip nc-chip">
              {userLabel(u)}
              <button type="button" onClick={() => onChange(recipients.filter((r) => r._id !== u._id))} aria-label={`${userLabel(u)} — წაშლა`}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const AdminNotifications = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(emptyForm);
  const [lang, setLang] = useState('ka');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async (p = page) => {
    try {
      const { data } = await api.get('/notification-campaign-list', { params: { page: p, limit: 10 } });
      setHistory(data);
    } catch {
      setHistory((h) => h || { campaigns: [], pages: 1, eligibleCustomers: 0, failed: true });
    }
  }, [page]);

  useEffect(() => {
    loadHistory(page);
  }, [page, loadHistory]);

  // მიმდინარე გაგზავნის სტატუსი — მხოლოდ სანამ კამპანია იგზავნება (შეზღუდული განახლება)
  const inFlight = history?.campaigns?.some((c) => c.status === 'queued' || c.status === 'sending');
  useEffect(() => {
    if (!inFlight) return undefined;
    const timer = setTimeout(() => loadHistory(page), 2000);
    return () => clearTimeout(timer);
  }, [inFlight, history, page, loadHistory]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const tr = form.translations[lang] || {};
  const setText = (field, value) =>
    lang === 'ka' ? set({ [field]: value }) : set({ translations: { ...form.translations, [lang]: { ...tr, [field]: value } } });
  const value = (field) => (lang === 'ka' ? form[field] : tr[field] || '');

  const eligible = history?.eligibleCustomers ?? 0;
  const audienceText = useMemo(() => {
    if (form.mode === 'all') return `ყველა აქტიური მყიდველი — ${eligible}`;
    if (!form.recipients.length) return 'მიმღები არ არის არჩეული';
    if (form.mode === 'user') return userLabel(form.recipients[0]);
    return `${form.recipients.length} არჩეული მყიდველი`;
  }, [form.mode, form.recipients, eligible]);

  const validate = () => {
    if (!form.title.trim()) return 'შეიყვანეთ სათაური (ქართულად)';
    if (!form.message.trim()) return 'შეიყვანეთ ტექსტი (ქართულად)';
    if (form.link.trim() && !safeInternalLink(form.link.trim())) return 'ბმული უნდა იყოს საიტის შიდა მისამართი, მაგ. /products?discounted=1';
    if (form.mode !== 'all' && !form.recipients.length) return 'აირჩიეთ მიმღები';
    if (form.mode === 'all' && !eligible) return 'აქტიური მყიდველები არ არის';
    return '';
  };

  const send = async (e) => {
    e.preventDefault();
    setError('');
    const problem = validate();
    if (problem) {
      if (!form.title.trim() || !form.message.trim()) setLang('ka');
      setError(problem);
      return;
    }
    const ok = await confirm({
      title: form.mode === 'all' ? `გაგზავნა ყველა მყიდველთან (${eligible})?` : 'შეტყობინების გაგზავნა?',
      message:
        form.mode === 'all'
          ? `შეტყობინება „${form.title.trim()}" მიუვა ყველა აქტიურ მყიდველს (${eligible}). გაგზავნის შემდეგ მისი გაუქმება შეუძლებელია.`
          : `აუდიტორია: ${audienceText}. სათაური: „${form.title.trim()}".`,
      confirmText: form.mode === 'all' ? `დიახ, ${eligible} მყიდველთან` : 'გაგზავნა',
      cancelText: 'გაუქმება',
      danger: form.mode === 'all',
      icon: 'bell',
    });
    if (!ok) return;

    setSending(true);
    try {
      const { data } = await api.post('/notification-campaign-create', {
        type: form.type,
        title: form.title,
        message: form.message,
        translations: form.translations,
        link: form.link.trim() || undefined,
        audience: { mode: form.mode, userIds: form.mode === 'all' ? undefined : form.recipients.map((r) => r._id) },
        confirmAll: form.mode === 'all' ? true : undefined,
        idempotencyKey: form.key,
      });
      toast({ type: 'success', title: data.duplicate ? 'ეს შეტყობინება უკვე გაგზავნილია' : 'შეტყობინება იგზავნება', description: form.title });
      setForm(emptyForm());
      setLang('ka');
      setPage(1);
      loadHistory(1);
    } catch (err) {
      setError(err.response?.data?.message || 'გაგზავნა ვერ მოხერხდა');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>შეტყობინებები</h1>
          <p>მარკეტინგული შეტყობინებები, შეთავაზებები და განცხადებები მყიდველებისთვის</p>
        </div>
      </div>

      <form className="card card-pad form-stack nc-form" onSubmit={send}>
        <h2 className="card-title" style={{ marginBottom: 0 }}>
          <Icon name="bell" size={18} /> ახალი შეტყობინება
        </h2>
        <Alert>{error}</Alert>

        <div className="form-grid">
          <Field label="ტიპი" required>
            <select className="select" value={form.type} onChange={(e) => set({ type: e.target.value })}>
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ბმული (არასავალდებულო)" hint="საიტის შიდა მისამართი: /products?discounted=1, /category/electronics, /product/...">
            <input className="input" value={form.link} onChange={(e) => set({ link: e.target.value })} placeholder="/products?discounted=1" maxLength={300} />
          </Field>
        </div>

        <div className="tr-editor">
          <Tabs
            active={lang}
            onChange={setLang}
            tabs={CONTENT_LANGUAGES.map((l) => ({
              id: l.code,
              label: (
                <span className="tr-tab">
                  <Flag code={l.code} /> {l.label}
                </span>
              ),
            }))}
          />
          <div className="form-stack" lang={lang}>
            <Field label="სათაური" required={lang === 'ka'} hint={lang !== 'ka' && form.title ? `ქართულად: ${form.title}` : `${value('title').length}/${LIMITS.title}`}>
              <input className="input" value={value('title')} onChange={(e) => setText('title', e.target.value)} maxLength={LIMITS.title} placeholder={lang === 'ka' ? 'მაგ. 20% ფასდაკლება ელექტრონიკაზე' : form.title} />
            </Field>
            <Field label="ტექსტი" required={lang === 'ka'} hint={`${value('message').length}/${LIMITS.message}`}>
              <textarea className="textarea" rows={3} value={value('message')} onChange={(e) => setText('message', e.target.value)} maxLength={LIMITS.message} placeholder={lang === 'ka' ? 'მაგ. აღმოაჩინეთ ამ კვირის შეთავაზებები.' : form.message} />
            </Field>
            {lang !== 'ka' && <p className="muted tr-note">არასავალდებულო — ცარიელი ველის ნაცვლად მომხმარებელი ქართულ ტექსტს ნახავს.</p>}
          </div>
        </div>

        <div className="field">
          <span className="field-label">მიმღებები</span>
          <div className="nc-modes" role="radiogroup" aria-label="მიმღებები">
            {MODES.map((m) => (
              <label key={m.id} className={`nc-mode ${form.mode === m.id ? 'selected' : ''}`}>
                <input type="radio" name="mode" checked={form.mode === m.id} onChange={() => set({ mode: m.id, recipients: m.id === 'user' ? form.recipients.slice(0, 1) : form.recipients })} />
                {m.label}
                {m.id === 'all' && <span className="pill pill-neutral no-dot">{eligible}</span>}
              </label>
            ))}
          </div>
          {form.mode !== 'all' && <RecipientPicker mode={form.mode} recipients={form.recipients} onChange={(recipients) => set({ recipients })} />}
        </div>

        <div className={`nc-summary ${form.mode === 'all' ? 'all' : ''}`}>
          <Icon name={form.mode === 'all' ? 'alert' : 'users'} size={18} />
          <span>
            <strong>აუდიტორია:</strong> {audienceText} · <strong>არხი:</strong> საიტზე (in-app) · <strong>ტიპი:</strong> {TYPE_LABEL[form.type]}
          </span>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={sending}>
            {sending ? <span className="spinner" /> : <Icon name="bell" size={18} />}
            {form.mode === 'all' ? 'გაგზავნა ყველასთან' : 'გაგზავნა'}
          </button>
          <button type="button" className="btn" onClick={() => { setForm(emptyForm()); setError(''); setLang('ka'); }} disabled={sending}>
            გასუფთავება
          </button>
        </div>
      </form>

      <section className="card card-pad nc-history">
        <h2 className="card-title">გაგზავნილი შეტყობინებები</h2>
        {!history ? (
          <Loader />
        ) : history.campaigns.length === 0 ? (
          <p className="muted">{history.failed ? 'ისტორია ვერ ჩაიტვირთა' : 'ჯერ არაფერი გაგზავნილა'}</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>თარიღი</th>
                    <th>სათაური</th>
                    <th>ტიპი</th>
                    <th>აუდიტორია</th>
                    <th>სტატუსი</th>
                    <th className="right">მიწოდება</th>
                    <th>ავტორი</th>
                  </tr>
                </thead>
                <tbody>
                  {history.campaigns.map((c) => (
                    <tr key={c._id}>
                      <td className="muted nowrap">{formatDateTime(c.createdAt)}</td>
                      <td className="strong">
                        {c.title}
                        {c.link && <small className="muted nc-link">{c.link}</small>}
                      </td>
                      <td>{TYPE_LABEL[c.type] || c.type}</td>
                      <td>{MODES.find((m) => m.id === c.audience?.mode)?.label}{c.audience?.mode !== 'all' && c.audience?.userIds ? ` (${c.audience.userIds.length})` : ''}</td>
                      <td>
                        <span className={`pill ${STATUS[c.status]?.[1] || 'pill-neutral'}`}>{STATUS[c.status]?.[0] || c.status}</span>
                      </td>
                      <td className="right nowrap">
                        {c.deliveredCount}/{c.recipientCount}
                      </td>
                      <td className="muted">{c.createdBy ? userLabel(c.createdBy) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={history.page} totalPages={history.pages} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
};

export default AdminNotifications;
