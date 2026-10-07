import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/** Producto tal como lo entrega el backend del catálogo (datos del SINV). `id` = SKU. */
export interface Product {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string;
  /** MXN, IVA incluido. */
  precio_estimado: number | null;
  imagen_url: string | null;
  etiquetas: string[];
  disponible?: number;
  en_stock?: boolean;
  optic_times_id?: string;
}

interface CartItem extends Product {
  cantidad: number;
}

interface CartContextType {
  cart: CartItem[];
  /** `openCart: false` agrega sin abrir el panel de cotización (lo usa el chat de Nexi). */
  addToCart: (product: Product, openCart?: boolean) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, cantidad: number) => void;
  totalEstimado: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// El carrito sobrevive a recargas durante 24 h desde el último cambio. Sólo productos y
// cantidades: los datos de contacto no se guardan (equipos compartidos). El SKU y el precio
// se validan de nuevo en el SINV al enviar.
const CART_KEY = 'eepsa-carrito';
const CART_TTL_MS = 24 * 60 * 60 * 1000;

function loadCart(): CartItem[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) ?? 'null') as { at?: number; items?: unknown } | null;
    if (!saved || typeof saved.at !== 'number' || Date.now() - saved.at > CART_TTL_MS || !Array.isArray(saved.items)) return [];
    return (saved.items as CartItem[]).filter(i => i && typeof i.sku === 'string' && Number.isInteger(i.cantidad) && i.cantidad > 0);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      if (cart.length) localStorage.setItem(CART_KEY, JSON.stringify({ at: Date.now(), items: cart }));
      else localStorage.removeItem(CART_KEY);
    } catch {
      // Navegación privada o almacenamiento bloqueado: el carrito sólo vive en esta pestaña
    }
  }, [cart]);

  const addToCart = (product: Product, openCart = true) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { ...product, cantidad: 1 }];
    });
    if (openCart) setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, cantidad: number) => {
    if (cantidad < 1) return;
    setCart(prev => prev.map(item => item.id === productId ? { ...item, cantidad } : item));
  };

  const totalEstimado = cart.reduce((acc, item) => {
    const price = parseFloat(item.precio_estimado?.toString() || '0');
    return acc + (price * item.cantidad);
  }, 0);

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, totalEstimado, isCartOpen, setIsCartOpen, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
