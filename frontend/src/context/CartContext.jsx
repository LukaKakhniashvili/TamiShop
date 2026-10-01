import { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from './UIContext';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const toast = useToast();
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product, quantity = 1, { silent = false } = {}) => {
    const image = product.image || product.images?.[0] || '';
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product._id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          // თავდაპირველი ფასი — შეკვეთის შეჯამებაში ფასდაკლების საჩვენებლად
          oldPrice: product.onSale && product.oldPrice > product.price ? product.oldPrice : null,
          image,
          quantity,
        },
      ];
    });

    if (!silent) {
      toast({
        title: 'დაემატა კალათაში',
        description: quantity > 1 ? `${quantity} × ${product.name}` : product.name,
        image: image || undefined,
        action: { label: 'კალათა', to: '/cart' },
      });
    }
  };

  const removeFromCart = (productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return removeFromCart(productId);
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
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
