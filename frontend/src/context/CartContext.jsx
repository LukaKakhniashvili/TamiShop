import { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from './UIContext';
import { cartLineId, describeVariant } from '../utils/variants';
import api from '../api/axios';
import i18n from '../i18n';
import { localizedField } from '../i18n/content';

const pickNameTranslations = (product) => {
  const out = {};
  for (const [lng, tr] of Object.entries(product.translations || {})) if (tr?.name) out[lng] = { name: tr.name };
  return Object.keys(out).length ? out : undefined;
};

const CartContext = createContext(null);

/*
 * კალათის ხაზი = პროდუქტი + (არასავალდებულო) ვარიანტი. სხვადასხვა კონფიგურაცია (მაგ. შავი/128 GB და
 * თეთრი/256 GB) ცალკე ხაზებია; იდენტური — ერთიანდება. ფასი აქ მხოლოდ საჩვენებელია —
 * შეკვეთისას სერვერი ფასს ბაზიდან ითვლის.
 */

// ძველ ჩანაწერებს (ვარიანტების გარეშე) lineId არ აქვს
const normalize = (items) =>
  Array.isArray(items) ? items.map((i) => ({ ...i, lineId: i.lineId || cartLineId(i.productId, i.variantId) })) : [];

export const CartProvider = ({ children }) => {
  const toast = useToast();
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cart');
      return saved ? normalize(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  // ძველ ხაზებს (თარგმანების დამატებამდე შექმნილს) სახელისა და ოფციების თარგმანები ერთხელ ემატება სერვერიდან.
  // იცვლება მხოლოდ საჩვენებელი ტექსტები — ფასი, რაოდენობა და ვარიანტი უცვლელია.
  useEffect(() => {
    const stale = [...new Set(items.filter((i) => !i.trSynced).map((i) => i.productId))];
    if (!stale.length) return;
    Promise.all(stale.slice(0, 30).map((id) => api.get(`/product-details/${id}`).then((r) => r.data).catch(() => null))).then((products) => {
      const byId = new Map(products.filter(Boolean).map((p) => [String(p._id), p]));
      setItems((prev) =>
        prev.map((i) => {
          const p = byId.get(String(i.productId));
          if (!p || i.trSynced) return i;
          const variant = i.variantId ? p.variants?.find((v) => v._id === i.variantId) : null;
          return {
            ...i,
            translations: pickNameTranslations(p),
            options: variant ? describeVariant(p, variant) : i.options,
            trSynced: true,
          };
        })
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * @param product  API-ის პროდუქტი
   * @param quantity რაოდენობა
   * @param opts.variant  არჩეული ვარიანტი (ვარიანტიანი პროდუქტისთვის)
   * @param opts.options  [{ name, value }] — ვარიანტის აღწერა საჩვენებლად
   */
  const addToCart = (product, quantity = 1, { silent = false, variant = null, options = [] } = {}) => {
    const image = product.image || product.images?.[0] || '';
    const lineId = cartLineId(product._id, variant?._id);
    const price = variant ? variant.price : product.price;
    const original = variant ? variant.oldPrice : product.oldPrice;
    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        return prev.map((i) => (i.lineId === lineId ? { ...i, quantity: Math.min(i.maxQuantity || 99, i.quantity + quantity) } : i));
      }
      return [
        ...prev,
        {
          lineId,
          productId: product._id,
          variantId: variant?._id || null,
          options,
          slug: product.slug,
          name: product.name,
          // სახელის თარგმანები — კალათა ენის შეცვლისას ითარგმნება (fallback: name)
          translations: pickNameTranslations(product),
          trSynced: true,
          price,
          // თავდაპირველი ფასი — შეკვეთის შეჯამებაში ფასდაკლების საჩვენებლად
          oldPrice: product.onSale && original > price ? original : null,
          image,
          quantity,
          // ვარიანტის მარაგი (UI-ის ზღვარი; საბოლოოდ სერვერი ამოწმებს)
          maxQuantity: variant ? Math.max(1, Math.min(99, variant.stock)) : 99,
        },
      ];
    });

    if (!silent) {
      const optionText = options.map((o) => localizedField(o, 'value')).join(', ');
      const name = localizedField(product, 'name');
      toast({
        title: i18n.t('cart.added'),
        description: `${quantity > 1 ? `${quantity} × ` : ''}${name}${optionText ? ` (${optionText})` : ''}`,
        image: image || undefined,
        action: { label: i18n.t('nav.cart'), to: '/cart' },
      });
    }
  };

  const removeFromCart = (lineId) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const updateQuantity = (lineId, quantity) => {
    if (quantity < 1) return removeFromCart(lineId);
    setItems((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, quantity: Math.min(i.maxQuantity || 99, quantity) } : i)));
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
