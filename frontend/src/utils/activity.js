// მომხმარებლის ბრაუზერში ინახება ბოლოს ნანახი პროდუქტები — რეკომენდაციების სიგნალად.
const KEY = 'recentlyViewed';
const MAX = 20;

export const getViewedIds = () => {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

// უახლესი პირველია (სერვერი ახლახან ნანახს მეტ წონას აძლევს)
export const trackProductView = (productId) => {
  if (!productId) return;
  try {
    const ids = [productId, ...getViewedIds().filter((id) => id !== productId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // localStorage მიუწვდომელია (მაგ. private რეჟიმი) — რეკომენდაციები უბრალოდ იქნება ზოგადი
  }
};
