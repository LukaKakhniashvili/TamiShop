import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import { useToast } from '../../context/UIContext';
import { apiErrorMessage } from '../../i18n/errors';
import Icon from '../Icon';
import { Alert, Field } from '../ui';
import { StarInput } from './Stars';

// იგივე ზღვრები, რაც სერვერზე (backend/models/Review.js) — საბოლოო შემოწმება სერვერზეა
export const COMMENT_MIN = 3;
export const COMMENT_MAX = 2000;

/**
 * შეფასების დაწერა / რედაქტირება — არსებული dialog-ის სტილით.
 * review — არსებული (რედაქტირება) ან null (ახალი). verifiedPurchase / მომხმარებელი სერვერი ადგენს.
 */
const ReviewForm = ({ productId, productName, review, onClose, onSaved }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const editing = !!review;
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || '');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  const busyRef = useRef(false);

  // Escape ხურავს (შენახვისას — არა); ფოკუსი ფანჯრის შიგნით რჩება; ფონის სქროლი ჩაკეტილია
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busyRef.current) {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = [...dialogRef.current.querySelectorAll('button:not([disabled]), textarea:not([disabled]), input:not([disabled])')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // გახსნისას ფოკუსი — ვარსკვლავებზე (არჩეულზე, თუ არის)
  useEffect(() => {
    dialogRef.current?.querySelector('input[type=radio]:checked, input[type=radio]')?.focus({ preventScroll: true });
  }, []);

  const validate = () => {
    const next = {};
    const text = comment.trim();
    if (!rating) next.rating = t('reviews.ratingRequired');
    if (text.length < COMMENT_MIN) next.comment = t('reviews.commentTooShort', { min: COMMENT_MIN });
    else if (text.length > COMMENT_MAX) next.comment = t('reviews.commentTooLong', { max: COMMENT_MAX });
    return next;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busyRef.current) return; // ორმაგი გაგზავნა გამორიცხულია
    const next = validate();
    setErrors(next);
    setServerError('');
    if (Object.keys(next).length) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const body = { rating, comment: comment.trim() };
      const { data } = editing ? await api.put(`/review-update/${review._id}`, body) : await api.post(`/review-create/${productId}`, body);
      toast({ type: 'success', title: t(editing ? 'reviews.reviewUpdated' : 'reviews.reviewSubmitted') });
      onSaved(data.review, editing ? 'updated' : 'created');
    } catch (err) {
      setServerError(apiErrorMessage(err, editing ? 'reviews.updateFailed' : 'reviews.submitFailed'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const length = comment.trim().length;

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form
        ref={dialogRef}
        className="dialog review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        onSubmit={submit}
        noValidate
      >
        <div className="review-dialog-head">
          <div>
            <h3 id="review-dialog-title">{t(editing ? 'reviews.editReview' : 'reviews.writeReview')}</h3>
            {productName && <p className="review-dialog-product">{productName}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')} disabled={busy}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <Alert>{serverError}</Alert>

        <Field label={t('reviews.rating')} required>
          <StarInput
            value={rating}
            onChange={(n) => {
              setRating(n);
              setErrors((x) => ({ ...x, rating: undefined }));
            }}
            disabled={busy}
            invalid={!!errors.rating}
            describedBy={errors.rating ? 'review-rating-error' : undefined}
          />
          {errors.rating && (
            <span className="field-error" id="review-rating-error" role="alert">
              {errors.rating}
            </span>
          )}
        </Field>

        <Field label={t('reviews.comment')} required>
          <textarea
            className={`textarea ${errors.comment ? 'is-invalid' : ''}`}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (errors.comment) setErrors((x) => ({ ...x, comment: undefined }));
            }}
            maxLength={COMMENT_MAX + 200}
            rows={5}
            disabled={busy}
            placeholder={t('reviews.commentPlaceholder')}
            aria-invalid={!!errors.comment}
            aria-describedby="review-comment-help"
          />
          <span className="review-comment-help" id="review-comment-help">
            {errors.comment ? (
              <span className="field-error" role="alert">
                {errors.comment}
              </span>
            ) : (
              <span className="muted">{t('reviews.commentHint', { min: COMMENT_MIN })}</span>
            )}
            <span className={`review-counter ${length > COMMENT_MAX ? 'over' : ''}`}>
              {length} / {COMMENT_MAX}
            </span>
          </span>
        </Field>

        <p className="review-dialog-note muted">
          <Icon name="shield" size={14} /> {t('reviews.publicNote')}
        </p>

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
            {busy ? t('reviews.saving') : t(editing ? 'reviews.update' : 'reviews.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewForm;
