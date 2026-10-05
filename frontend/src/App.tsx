import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Grid, Search, ShoppingCart, Plus, Minus, X, ArrowLeft, Phone, MapPin, ExternalLink, CheckCircle, Mail, ChevronDown, AlertCircle, ChevronLeft, ChevronRight, RotateCcw, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { CartProvider, useCart } from './CartContext';
import type { Product } from './CartContext';

const API_URL = '/api/productos';

/** Nombre de contacto: sólo letras (acentos, ñ, ü) separadas por un espacio; mínimo 3 letras. */
const NOMBRE_RE = /^(?=.{3,80}$)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
const NOMBRE_INVALIDO = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g;

interface CatalogCategory {
  name: string;
  sub: string[];
}

/** Líneas y categorías vigentes en el SINV (`GET /api/categorias`). */
function useCatalogCategories(): CatalogCategory[] {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  useEffect(() => {
    fetch('/api/categorias')
      .then(res => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(err => console.error('Error al cargar categorías', err));
  }, []);
  return categories;
}

const WhatsAppIcon = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// --- ANIMATION VARIANTS ---
const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

const slideInRight: Variants = {
  initial: { x: '100%' },
  animate: { x: 0, transition: { type: "spring", damping: 25, stiffness: 200 } },
  exit: { x: '100%', transition: { type: "tween", duration: 0.3 } }
};

const chatBubbleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 10, transformOrigin: "bottom left" },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", bounce: 0.4, duration: 0.6 } }
};

const chatBubbleUserVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 10, transformOrigin: "bottom right" },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", bounce: 0.4, duration: 0.6 } }
};

// --- COMPONENTS ---
function SkeletonLoader() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-[52px] max-w-[88%] w-full overflow-hidden pb-4">
      <div className="flex gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="shrink-0 w-64 bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm flex flex-col p-4 animate-pulse">
            <div className="h-32 bg-gray-200 rounded-xl mb-4 w-full"></div>
            <div className="h-4 bg-gray-200 rounded-full w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded-full w-full mb-1"></div>
            <div className="h-3 bg-gray-200 rounded-full w-5/6 mb-4"></div>
            <div className="h-10 bg-teal-50 rounded-xl w-full mt-auto"></div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col self-start">
      <div className="bg-white border border-gray-100 rounded-[1.2rem] rounded-tl-[4px] px-4 py-3 shadow-sm flex items-center gap-1.5 w-fit">
        <motion.div className="w-1.5 h-1.5 bg-gray-400 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} />
        <motion.div className="w-1.5 h-1.5 bg-gray-400 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} />
        <motion.div className="w-1.5 h-1.5 bg-gray-400 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
      </div>
    </motion.div>
  );
}

function GlobalNavbar() {
  const { cart, setIsCartOpen } = useCart();
  const location = useLocation();
  const cartCount = cart.reduce((acc, item) => acc + item.cantidad, 0);
  
  const showCart = location.pathname !== '/';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3 sm:px-6 shadow-sm w-full">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 relative">
        <a href="https://eepsa.com.mx/" target="_blank" rel="noopener noreferrer" className="shrink-0 transition-transform hover:scale-105 z-10">
          <img src="/LogoEepsaVectorizado.png" alt="EEPSA" className="h-8 sm:h-10 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </a>

        <div className="flex items-center gap-4 sm:gap-6 ml-auto z-10 bg-white/50 pl-2 rounded-xl">
          {/* Contactos (Teléfono y Correo apilados, como en la imagen) */}
          <div className="hidden md:flex flex-col items-end gap-1.5 text-[13px] font-medium text-gray-700 pr-2">
            <a href="tel:5579916042" className="flex items-center gap-2 hover:text-teal-700 transition-colors leading-none">
              <Phone className="w-3.5 h-3.5 text-gray-500 fill-gray-500" /> <span>(55) 79916042</span>
            </a>
            <a href="mailto:contacto@eepsa.com.mx" className="flex items-center gap-2 hover:text-teal-700 transition-colors leading-none">
              <Mail className="w-3.5 h-3.5 text-gray-500 fill-gray-500" /> <span>contacto@eepsa.com.mx</span>
            </a>
          </div>

          <div className="flex md:hidden flex-col items-end gap-1 text-[11px] font-medium text-gray-600">
            <a href="tel:5579916042" className="flex items-center gap-1 hover:text-teal-700"><Phone className="w-3 h-3 fill-gray-500" /></a>
            <a href="mailto:contacto@eepsa.com.mx" className="flex items-center gap-1 hover:text-teal-700"><Mail className="w-3 h-3 fill-gray-500" /></a>
          </div>

          {showCart && (
             <>
                <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setIsCartOpen(true)}
                  className="relative flex items-center justify-center w-11 h-11 rounded-full bg-teal-50 text-teal-700 transition-colors hover:bg-teal-100"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <AnimatePresence>
                    {cartCount > 0 && (
                      <motion.span 
                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-teal-600 text-white text-[10px] font-bold rounded-full border-2 border-white"
                      >
                        {cartCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
             </>
          )}
        </div>
      </div>
    </header>
  );
}

function CartUI() {
  const { cart, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, totalEstimado, clearCart } = useCart();
  const [isGenerating, setIsGenerating] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const [quoteId, setQuoteId] = useState('');
  const [quotePending, setQuotePending] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [contacto, setContacto] = useState({ nombre: '', telefono: '', correo: '' });
  // Una llave por intento de envío: si la red falla y el cliente reintenta, el SINV no duplica la cotización.
  // Cambiar el carrito o los datos genera una llave nueva (es otra solicitud).
  const idempotencyKey = useRef<string | null>(null);
  useEffect(() => {
    idempotencyKey.current = null;
  }, [cart, contacto]);

  // Nombre: sólo letras (con acentos y ñ) y espacios. Teléfono: 10 dígitos. Correo: opcional.
  const nombreError = !NOMBRE_RE.test(contacto.nombre.trim()) ? 'Escribe tu nombre (sólo letras)' : '';
  const telefonoError = !/^\d{10}$/.test(contacto.telefono) ? 'El teléfono debe tener 10 dígitos' : '';
  const correoError =
    contacto.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto.correo.trim()) ? 'El correo no es válido' : '';
  const contactError = nombreError || telefonoError || correoError;

  const handleGenerateQuote = async () => {
    if (cart.length === 0) return;
    if (contactError) {
      setQuoteError(contactError);
      return;
    }
    idempotencyKey.current ??= crypto.randomUUID();
    setIsGenerating(true);
    setQuoteError('');
    try {
      const res = await fetch('/api/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          cart: cart.map(item => ({ sku: item.sku, cantidad: item.cantidad })),
          contacto,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setQuoteId(data.folio ?? data.referencia);
        setQuotePending(Boolean(data.pendiente));
        setQuoteMessage(data.mensaje ?? '');
        setQuoteSuccess(true);
        clearCart();
        idempotencyKey.current = null;
      } else {
        setQuoteError(data.error ?? 'No pudimos generar tu cotización. Intenta de nuevo.');
      }
    } catch (error) {
      console.error('Error generating quote', error);
      setQuoteError('Sin conexión. Revisa tu internet e intenta de nuevo.');
    }
    setIsGenerating(false);
  };

  const closeCart = () => {
    setIsCartOpen(false);
    if (quoteSuccess) {
      setTimeout(() => {
        setQuoteSuccess(false);
        setQuoteId('');
        setQuotePending(false);
        setQuoteMessage('');
      }, 300); // Resetear estado después de la animación de cierre
    }
  };

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/20';

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-brand-ink/30 backdrop-blur-sm" onClick={closeCart} 
          />
          
          <motion.div 
            variants={slideInRight} initial="initial" animate="animate" exit="exit"
            className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-2xl font-heading font-extrabold text-teal-800">Tu Cotización</h2>
              <button onClick={closeCart} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {quoteSuccess ? (
               <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                     <CheckCircle className="w-10 h-10" /> 
                  </div>
                  <h3 className="text-2xl font-black font-heading text-brand-ink mb-2">¡Cotización Generada!</h3>
                  <p className="text-gray-500 mb-6">
                    {quotePending
                      ? 'Tu pedido quedó registrado con la siguiente referencia (en breve te asignaremos un folio):'
                      : 'Tu pedido ha sido registrado exitosamente con el siguiente folio:'}
                  </p>

                  <div className="bg-gray-50 border-2 border-dashed border-teal-200 rounded-2xl p-6 w-full mb-4">
                     <span className="block text-3xl font-black text-teal-700 tracking-wider font-mono">{quoteId}</span>
                  </div>
                  {quoteMessage && <p className="text-sm text-gray-500 mb-8">{quoteMessage}</p>}

                  <p className="text-sm font-bold text-gray-600 mb-4">Elige cómo deseas continuar con tu pedido:</p>
                  
                  <div className="flex flex-col gap-3 w-full">
                     <a href={`https://wa.me/525579916042?text=Hola, quiero darle seguimiento a mi cotización con folio ${quoteId}.`} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors">
                        <WhatsAppIcon className="w-5 h-5 fill-white" /> WhatsApp
                     </a>
                     <a href={`mailto:ventas@eepsa.com.mx?subject=Cotización ${quoteId}&body=Hola, quiero darle seguimiento a mi cotización con folio ${quoteId}.`} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors">
                        <Mail className="w-5 h-5" /> Enviar Correo
                     </a>
                     <a href="tel:5579916042" className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors">
                        <Phone className="w-5 h-5" /> Hablar a Telemarketing
                     </a>
                     <button className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors">
                        <MapPin className="w-5 h-5" /> Visitar Tienda Física
                     </button>
                  </div>
               </div>
            ) : (
              <>
            <div className="flex-1 overflow-y-auto p-6 hide-scrollbar">
              {cart.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-20 flex flex-col items-center">
                  <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                    <ShoppingCart className="w-10 h-10 text-teal-300" />
                  </div>
                  <h3 className="font-heading font-bold text-gray-700 text-lg">Tu carrito está vacío</h3>
                  <p className="text-gray-500 text-sm mt-2">Explora nuestros productos y añádelos aquí.</p>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-4">
                  <AnimatePresence>
                    {cart.map(item => (
                      <motion.div 
                        key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                        className="flex gap-4 p-4 bg-white rounded-3xl border border-gray-100 premium-shadow"
                      >
                        <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                          {item.imagen_url ? (
                             <img src={item.imagen_url} alt={item.nombre} className="w-full h-full object-contain mix-blend-multiply p-1" />
                          ) : (
                             <Grid className="w-6 h-6 text-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 flex flex-col">
                          <h3 className="font-bold text-sm text-brand-ink leading-tight mb-1">{item.nombre}</h3>
                          <p className="text-xs text-gray-500 line-clamp-1 mb-3">{item.descripcion}</p>
                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                              <button onClick={() => updateQuantity(item.id, item.cantidad - 1)} className="w-6 h-6 flex items-center justify-center rounded-md bg-white shadow-sm text-gray-500 hover:text-teal-600"><Minus className="w-3 h-3" /></button>
                              <span className="text-xs font-bold w-6 text-center text-brand-ink">{item.cantidad}</span>
                              <button onClick={() => updateQuantity(item.id, item.cantidad + 1)} className="w-6 h-6 flex items-center justify-center rounded-md bg-white shadow-sm text-gray-500 hover:text-teal-600"><Plus className="w-3 h-3" /></button>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="text-xs font-bold text-red-500/70 hover:text-red-600 transition-colors">Quitar</button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-10">
              <div className="bg-gray-50 text-gray-600 text-xs font-medium px-4 py-3 rounded-xl mb-5 flex items-start gap-2 border border-gray-200">
                <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <p><strong>Nota importante:</strong> No se procesan pagos en línea por este medio. Los pagos se acordarán directamente con un asesor tras generar la cotización.</p>
              </div>
              <div className="flex justify-between items-end mb-6">
                <span className="font-medium text-gray-500">Total Estimado</span>
                <div className="text-right">
                  <span className="text-3xl font-heading font-black text-teal-800 tracking-tight">${totalEstimado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <p className="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wider">MXN · IVA incluido</p>
                </div>
              </div>

              {cart.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <p className="col-span-2 text-xs font-bold text-gray-600">¿A quién contactamos para cerrar tu pedido?</p>
                  <input className={`${inputClass} col-span-2`} placeholder="Nombre *" autoComplete="name" maxLength={80} value={contacto.nombre} onChange={e => setContacto({ ...contacto, nombre: e.target.value.replace(NOMBRE_INVALIDO, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '') })} />
                  {contacto.nombre && nombreError && <p className="col-span-2 -mt-1 text-[11px] font-semibold text-red-500">{nombreError}</p>}
                  <input className={inputClass} placeholder="Teléfono *" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={contacto.telefono} onChange={e => setContacto({ ...contacto, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                  <input className={inputClass} placeholder="Correo (opcional)" type="email" autoComplete="email" maxLength={160} value={contacto.correo} onChange={e => setContacto({ ...contacto, correo: e.target.value.trim() })} />
                  {contacto.telefono && telefonoError && <p className="col-span-2 -mt-1 text-[11px] font-semibold text-red-500">{telefonoError}</p>}
                  {correoError && <p className="col-span-2 -mt-1 text-[11px] font-semibold text-red-500">{correoError}</p>}
                  <p className="col-span-2 text-[11px] text-gray-400">* Nombre y teléfono son obligatorios.</p>
                </div>
              )}

              {quoteError && (
                <p role="alert" className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{quoteError}</p>
              )}

              <div className="flex flex-col gap-3">
                 <motion.button 
                   whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} 
                   onClick={handleGenerateQuote}
                   disabled={isGenerating || cart.length === 0 || Boolean(contactError)}
                   className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-colors"
                 >
                    {isGenerating ? 'Generando...' : 'Generar Cotización'}
                 </motion.button>
              </div>
            </div>
            </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- COMPONENTS ---
function ProductModal({ product, isOpen, onClose, onAddToCart }: any) {
  if (!isOpen || !product) return null;
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X className="w-5 h-5"/></button>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/2 bg-gray-50 rounded-2xl flex items-center justify-center p-6 border border-gray-100">
                {product.imagen_url ? <img src={product.imagen_url} alt={product.nombre} className="w-full h-auto max-h-[300px] object-contain mix-blend-multiply" /> : <Grid className="w-16 h-16 text-gray-300" />}
              </div>
              <div className="w-full md:w-1/2 flex flex-col">
                <div className="mb-2 flex flex-wrap gap-2">
                  {product.etiquetas && Array.isArray(product.etiquetas) && product.etiquetas.map((t: string) => (
                    <span key={t} className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">{t}</span>
                  ))}
                </div>
                <h2 className="text-2xl font-black font-heading text-brand-ink mb-2 leading-tight">{product.nombre}</h2>
                <div className="text-3xl font-black text-teal-600 mb-4">${Number(product.precio_estimado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-400 font-medium tracking-wider">MXN</span></div>
                <p className="text-sm font-medium text-gray-500 mb-6 flex-1 leading-relaxed">{product.descripcion}</p>
                <div className="flex flex-col gap-3 mt-auto">
                   {product.optic_times_id && (
                     <a href={`https://optictimes.mx/product?id=${product.optic_times_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-3.5 rounded-xl transition-colors">
                       <ExternalLink className="w-5 h-5" /> Ver Ficha Técnica Oficial
                     </a>
                   )}
                   <button onClick={() => { onAddToCart(product); onClose(); }} className="flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-600/30 transition-colors">
                     <ShoppingCart className="w-5 h-5" /> Añadir a Cotización
                   </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- SCREENS ---
function Screen1Selection() {
  const navigate = useNavigate();
  return (
    <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit" className="min-h-screen nexi-bg flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black text-brand-ink mb-5 font-heading tracking-tight leading-tight mt-8">
            Catálogo Interactivo de <br className="hidden md:block"/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500">Equipamiento Óptico</span>
          </h1>
          <p className="text-lg font-medium text-gray-500 max-w-2xl mx-auto">Explora nuestras soluciones y herramientas para redes de fibra óptica. Selecciona tu método de navegación preferido.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
          <motion.div 
            whileHover={{ y: -8, scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/assistant')} 
            className="bg-white/80 backdrop-blur-xl border-2 border-white shadow-xl hover:shadow-[0_20px_40px_-15px_rgba(20,184,166,0.3)] hover:border-teal-400 rounded-[2rem] p-8 md:p-10 cursor-pointer group transition-all duration-300 relative overflow-hidden"
          >
            {/* Gradiente sutil que aparece en hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="relative z-10">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 group-hover:ring-4 ring-teal-500/30 transition-all shadow-sm overflow-hidden border border-gray-100 group-hover:border-teal-200">
                <img src="/nexi.png" alt="Nexi" className="w-full h-full object-cover scale-110" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-brand-ink font-heading group-hover:text-teal-700 transition-colors">Asesoría con Nexi</h2>
              <p className="text-sm font-medium text-gray-500 leading-relaxed group-hover:text-gray-700 transition-colors">No estoy seguro de qué necesito. Deja que nuestro asistente virtual te guíe paso a paso para encontrar el producto ideal.</p>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -8, scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/catalog')} 
            className="bg-white/80 backdrop-blur-xl border-2 border-white shadow-xl hover:shadow-[0_20px_40px_-15px_rgba(20,184,166,0.3)] hover:border-teal-400 rounded-[2rem] p-8 md:p-10 cursor-pointer group transition-all duration-300 relative overflow-hidden"
          >
            {/* Gradiente sutil que aparece en hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="relative z-10">
              <div className="w-20 h-20 bg-gray-50 rounded-[1.5rem] flex items-center justify-center mb-6 group-hover:ring-4 ring-teal-500/30 transition-all shadow-sm border border-gray-100 group-hover:border-teal-200">
                <Grid className="w-8 h-8 text-teal-600 group-hover:text-teal-500 transition-colors" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-brand-ink font-heading group-hover:text-teal-700 transition-colors">Explorar Catálogo</h2>
              <p className="text-sm font-medium text-gray-500 leading-relaxed group-hover:text-gray-700 transition-colors">Sé lo que busco. Visualiza todo nuestro inventario, filtra productos y arma tu propia cotización directa.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

type ChatMessage = {
  id: number;
  type: 'user' | 'bot';
  text: string;
  products?: Product[];
  icon?: 'success';
  productImage?: string;
};

function Screen2AAssistant() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [waitingForCategory, setWaitingForCategory] = useState(false);
  const initialized = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom with delay to wait for animations
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 300);
    return () => clearTimeout(timer);
  }, [messages, loading, initialLoading, waitingForCategory]);

  const resetSearch = () => {
    setMessages(prev => [
      ...prev, 
      { id: Date.now(), type: 'user', text: 'Quiero buscar otra categoría' },
      { id: Date.now() + 1, type: 'bot', text: '¡Claro! ¿Qué otra categoría te gustaría explorar?' }
    ]);
    setWaitingForCategory(true);
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Simular escritura de los primeros mensajes al cargar la pantalla
    const loadInitialMessages = async () => {
      await new Promise(resolve => setTimeout(resolve, 600));
      setMessages([{ id: Date.now(), type: 'bot', text: '¡Hola! Soy Nexi. Te ayudaré a encontrar el equipo de fibra óptica ideal.' }]);
      
      await new Promise(resolve => setTimeout(resolve, 1200));
      setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: 'Para empezar, ¿Qué tipo de producto estás buscando? Selecciona una categoría.' }]);
      setInitialLoading(false);
      setWaitingForCategory(true);
    };
    loadInitialMessages();
  }, []);

  // Las líneas de producto salen del SINV: si el Administrador crea una línea nueva, Nexi la ofrece sola.
  const categories = ['Todos', ...useCatalogCategories().map(c => c.name)];

  const handleCategoryClick = async (category: string) => {
    setWaitingForCategory(false);
    const userMsgId = Date.now();
    setMessages(prev => [...prev, { id: userMsgId, type: 'user', text: category }]);
    setLoading(true);
    
    // Simulate slight delay for more natural UX
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const tags = category === 'Todos' ? '' : encodeURIComponent(category);
      const res = await fetch(`${API_URL}?tags=${tags}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const botMsgId = Date.now() + 1;
      setMessages(prev => [...prev, { id: botMsgId, type: 'bot', text: `¡Excelente! Encontré estas opciones para "${category}".`, products: data }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'bot', text: 'Uy, tuvimos un problema de conexión. ¿Intentamos de nuevo?' }]);
      setWaitingForCategory(true);
    }
    setLoading(false);
  };

  const handleAddToCartInChat = (p: Product) => {
    addToCart(p);
    setMessages(prev => [
      ...prev,
      { id: Date.now(), type: 'bot', text: `He agregado "${p.nombre}" a tu cotización.`, icon: 'success', productImage: p.imagen_url ?? undefined }
    ]);
  };

  const scrollCarousel = (containerId: string, direction: 'left' | 'right') => {
    const container = document.getElementById(containerId);
    if (container) {
      // Calcular ancho de carta visible
      const cardWidth = container.querySelector('.snap-center')?.clientWidth || 320;
      const scrollAmount = cardWidth + 16; // ancho + gap
      container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col items-center sm:py-6 sm:px-4 bg-gray-50">
      <div className="relative flex h-[calc(100vh-4rem)] w-full max-w-4xl flex-col bg-white sm:h-[calc(100vh-8rem)] sm:max-h-[900px] sm:rounded-[2.5rem] sm:border sm:border-gray-200 premium-shadow overflow-hidden">
        <div className="p-3 bg-white/95 backdrop-blur-md border-b border-gray-100 z-20 flex items-center gap-3 shadow-sm">
           <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} className="text-gray-500 hover:text-teal-700 transition-colors p-1.5 rounded-full ml-1">
             <ArrowLeft className="w-5 h-5" />
           </motion.button>
           
           <div className="flex items-center gap-3 cursor-pointer group">
             <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm relative bg-[#f3f4f6]">
                <img src="/nexi.png" alt="Nexi" className="w-full h-full object-cover scale-110" />
             </div>
             <div className="flex flex-col justify-center">
                <span className="font-bold text-brand-ink text-[15px] leading-[1.1] group-hover:text-teal-700 transition-colors">Nexi</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span className="text-teal-600 text-[12px] font-medium leading-none">en línea</span>
                </div>
             </div>
           </div>
        </div>

        <div 
          className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 custom-scrollbar relative scroll-smooth"
          style={{
            backgroundColor: '#f4f7f7',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10h10v10H10V10zm20 20h10v10H30V30zm40-20h10v10H70V10zm-20 40h10v10H50V50zm-40 20h10v10H10V70zm60 20h10v10H70V90z' fill='%230f766e' fill-opacity='0.03' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          }}
        >
          <div className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const timeStr = new Date(msg.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={msg.id} className="flex flex-col w-full">
                    <motion.div 
                      variants={msg.type === 'bot' ? chatBubbleVariants : chatBubbleUserVariants}
                      initial="hidden" animate="visible"
                      className={`flex items-end gap-2 max-w-[85%] ${msg.type === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
                    >
                      {msg.type === 'bot' && (
                        <div className="relative flex w-8 h-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-gray-100 shadow-sm mb-0.5">
                          <img src="/nexi.png" alt="Nexi" className="w-full h-full object-cover scale-110" />
                        </div>
                      )}
                      <div className={`relative px-4 py-2.5 text-[15px] sm:text-[16px] font-medium leading-snug shadow-sm flex flex-col min-w-[90px]
                        ${msg.type === 'user' 
                          ? 'bg-teal-600 text-white rounded-[1.2rem] rounded-tr-[4px]' 
                          : 'bg-white text-brand-ink rounded-[1.2rem] rounded-tl-[4px] border border-gray-100'}`}
                      >
                        {msg.productImage && (
                          <div className="w-full sm:min-w-[200px] h-28 sm:h-32 bg-gray-50/80 rounded-xl mb-2 overflow-hidden flex items-center justify-center p-2 border border-gray-100/50">
                             <img src={msg.productImage} className="h-full object-contain mix-blend-multiply" alt="Producto agregado" />
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          {msg.icon === 'success' && <CheckCircle className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />}
                          <span className="pb-3.5 pr-2">{msg.text}</span>
                        </div>
                        <div className={`absolute bottom-1.5 right-2 flex items-center justify-end gap-1 ${msg.type === 'user' ? 'text-teal-100' : 'text-gray-400'}`}>
                           <span className="text-[9px] font-bold opacity-90 leading-none">{timeStr}</span>
                           {msg.type === 'user' && <CheckCheck className="w-3.5 h-3.5 text-sky-300" />}
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Render Products Inline if present */}
                    {msg.products && msg.products.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-start w-full relative group mt-4">
                        {msg.products.length > 3 && (
                          <>
                            <button onClick={() => scrollCarousel(`carousel-${msg.id}`, 'left')} className="absolute left-2 top-32 -translate-y-1/2 z-20 bg-white/90 backdrop-blur-md border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full p-2.5 text-brand-ink hover:text-teal-600 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 hidden sm:block">
                              <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button onClick={() => scrollCarousel(`carousel-${msg.id}`, 'right')} className="absolute right-2 top-32 -translate-y-1/2 z-20 bg-white/90 backdrop-blur-md border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full p-2.5 text-brand-ink hover:text-teal-600 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 hidden sm:block">
                              <ChevronRight className="w-6 h-6" />
                            </button>
                          </>
                        )}
                        <div id={`carousel-${msg.id}`} className="overflow-x-auto pb-4 pt-2 snap-x custom-scrollbar flex gap-3 sm:gap-4 w-full">
                           {msg.products.map((p, pIdx) => (
                              <motion.div 
                                key={p.id} 
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: pIdx * 0.1 }}
                                className="snap-center shrink-0 w-[80%] sm:w-[calc(33.333%-0.75rem)] bg-white rounded-[1.25rem] border border-gray-100 overflow-hidden premium-shadow flex flex-col group/card"
                              >
                                 <div 
                                   onClick={() => setSelectedProduct(p)} 
                                   className="cursor-pointer flex-1 flex flex-col group/inner relative"
                                 >
                                   <div className="absolute inset-0 bg-teal-600/0 group-hover/inner:bg-teal-600/5 transition-colors z-10 rounded-t-[1.25rem]" />
                                   <div className="h-28 sm:h-32 bg-gray-50 flex items-center justify-center p-3 relative overflow-hidden shrink-0">
                                      {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} className="h-full object-contain mix-blend-multiply group-hover/inner:scale-110 transition-transform duration-700" /> : <Grid className="text-gray-300 w-10 h-10" />}
                                   </div>
                                   <div className="p-3 sm:p-4 flex-1 flex flex-col">
                                      <h3 className="font-bold font-heading text-brand-ink text-[13px] sm:text-[14px] mb-1 leading-tight line-clamp-2 group-hover/inner:text-teal-700 transition-colors">{p.nombre}</h3>
                                      <p className="text-[11px] sm:text-[12px] font-medium text-gray-400 mb-2 line-clamp-2 leading-snug">{p.descripcion}</p>
                                      <div className="text-[15px] sm:text-base font-black text-teal-600 mt-auto">${Number(p.precio_estimado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium tracking-wider">MXN</span></div>
                                   </div>
                                 </div>
                                 
                                 <div className="p-3 sm:p-4 pt-0 mt-auto flex flex-col gap-2 relative z-20">
                                   <motion.button 
                                     whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                     onClick={() => handleAddToCartInChat(p)} 
                                     className="w-full bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold py-2 rounded-lg text-[12px] sm:text-[13px] transition-colors flex justify-center items-center gap-1.5"
                                   >
                                      <Plus className="w-3.5 h-3.5" /> Agregar
                                   </motion.button>
                                 </div>
                              </motion.div>
                           ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </AnimatePresence>
            
            {/* Action Buttons at the bottom of the chat */}
            {!loading && !waitingForCategory && messages.length > 2 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start mt-4 mb-6">
                <button onClick={resetSearch} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 font-bold py-2.5 px-5 rounded-full hover:bg-teal-50 hover:text-teal-700 transition-colors shadow-sm text-sm ml-2 sm:ml-10 premium-shadow">
                  <RotateCcw className="w-4 h-4" /> Buscar otra categoría
                </button>
              </motion.div>
            )}

            {initialLoading && <TypingIndicator />}
            {loading && <SkeletonLoader />}

            {waitingForCategory && !loading && !initialLoading && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="self-start max-w-[95%] w-full mt-2 ml-0 sm:ml-10">
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat, idx) => (
                    <motion.button 
                      key={cat} 
                      whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + (idx * 0.03) }}
                      onClick={() => handleCategoryClick(cat)} 
                      className="rounded-xl border-2 border-teal-500 bg-teal-50 px-4 py-2.5 text-[14px] sm:text-[15px] font-bold text-teal-800 hover:bg-teal-500 hover:text-white transition-all shadow-md"
                    >
                      {cat}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
            
            {/* Element to scroll to bottom */}
            <div ref={messagesEndRef} className="h-20 shrink-0 w-full" />
          </div>
        </div>
        
        {/* Decorative fade for bottom of chat */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
      </div>
      <ProductModal product={selectedProduct} isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} />
    </motion.div>
  );
}

function Screen2BCatalog() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Equipo Activo');

  // Menú lateral = líneas y categorías del SINV (antes estaba fijo y se desfasaba del catálogo real)
  const catalogCategories: CatalogCategory[] = [{ name: 'Todos', sub: [] }, ...useCatalogCategories()];

  useEffect(() => {
    fetch(API_URL)
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filtered = products.filter(p => {
    const term = search.toLowerCase();
    const matchesSearch = p.nombre.toLowerCase().includes(term) || p.descripcion.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);

    if (selectedCategory === 'Todos') return matchesSearch;

    // etiquetas = [línea, categoría] del SINV
    const [line, sub] = p.etiquetas;
    if (line !== selectedCategory) return false;
    if (selectedSubCategory && sub !== selectedSubCategory) return false;
    return matchesSearch;
  });

  return (
    <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit" className="flex-1 bg-gray-50 flex flex-col">
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-[68px] z-30 px-4 py-4 sm:px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 sm:gap-8">
          <div className="flex items-center gap-4 flex-1">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} className="text-gray-400 hover:text-brand-ink transition-colors bg-gray-50 p-2 rounded-full">
               <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <h1 className="text-xl font-black font-heading text-brand-ink hidden sm:block tracking-tight">Catálogo</h1>
            <div className="relative flex-1 max-w-lg">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input 
                 type="text" 
                 placeholder="Buscar por nombre o descripción..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full pl-11 pr-5 py-3 rounded-full border border-gray-200 focus:outline-none focus:ring-4 focus:ring-teal-500/20 bg-gray-50 focus:bg-white text-sm font-medium transition-all"
               />
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 flex flex-col md:flex-row gap-6 lg:gap-8">
         {/* Sidebar Categorías */}
         <aside className="w-full md:w-64 shrink-0">
           <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm sticky top-[150px]">
              <ul className="space-y-1">
                {catalogCategories.map(cat => (
                  <li key={cat.name} className="flex flex-col">
                    <button 
                      onClick={() => {
                        if (cat.name === 'Todos') {
                          setSelectedCategory('Todos');
                          setSelectedSubCategory(null);
                        } else {
                          if (expandedCategory === cat.name && cat.sub.length > 0) {
                            setExpandedCategory(null);
                          } else {
                            setExpandedCategory(cat.name);
                            setSelectedCategory(cat.name);
                            setSelectedSubCategory(null);
                          }
                        }
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-colors ${selectedCategory === cat.name ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {cat.name}
                      {cat.sub.length > 0 && (
                        <ChevronDown className={`w-4 h-4 transition-transform ${expandedCategory === cat.name ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                    <AnimatePresence>
                      {cat.sub.length > 0 && expandedCategory === cat.name && (
                        <motion.ul 
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden flex flex-col pl-6 mt-1 space-y-1"
                        >
                          {cat.sub.map(sub => (
                            <li key={sub}>
                              <button 
                                onClick={() => {
                                  setSelectedCategory(cat.name);
                                  setSelectedSubCategory(sub);
                                }}
                                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedSubCategory === sub ? 'text-teal-700 bg-teal-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                              >
                                {sub}
                              </button>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </li>
                ))}
              </ul>
           </div>
         </aside>

         <div className="flex-1">
         {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="bg-white rounded-3xl border border-gray-100 p-5 h-[340px] animate-pulse">
                  <div className="h-40 bg-gray-100 rounded-2xl mb-5 w-full"></div>
                  <div className="h-4 bg-gray-100 rounded-full w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-100 rounded-full w-full mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded-full w-4/5 mb-6"></div>
                  <div className="h-12 bg-gray-100 rounded-2xl w-full mt-auto"></div>
                </div>
              ))}
            </div>
         ) : (
           <>
             <div className="mb-6 flex items-center justify-between">
               <span className="text-sm font-bold text-gray-500">{filtered.length} productos encontrados</span>
             </div>
             
             <AnimatePresence mode="wait">
               <motion.div 
                 key={selectedCategory + '-' + (selectedSubCategory || 'all')}
                 initial={{ opacity: 0, y: 15 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 exit={{ opacity: 0, y: -15 }} 
                 transition={{ duration: 0.25 }}
                 className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
               >
                  {filtered.map((p) => (
                     <div 
                        key={p.id} 
                        className="bg-white rounded-3xl border border-gray-100 premium-shadow hover:shadow-[0_20px_40px_-15px_rgba(15,118,110,0.15)] transition-all duration-300 overflow-hidden flex flex-col group"
                     >
                        <div 
                           onClick={() => setSelectedProduct(p)}
                           className="cursor-pointer flex-1 flex flex-col group/inner relative"
                        >
                           <div className="absolute inset-0 bg-teal-600/0 group-hover/inner:bg-teal-600/5 transition-colors z-10 rounded-t-3xl" />
                           <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center p-6 relative overflow-hidden shrink-0">
                              {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain mix-blend-multiply group-hover/inner:scale-110 transition-transform duration-700" /> : <Grid className="w-12 h-12 text-gray-200" />}
                           </div>
                           <div className="p-6 flex-1 flex flex-col pb-0">
                              <h3 className="font-bold font-heading text-brand-ink mb-2 text-[17px] leading-tight line-clamp-2 group-hover/inner:text-teal-700 transition-colors">{p.nombre}</h3>
                              <p className="text-[13px] font-medium text-gray-400 mb-3 line-clamp-2">{p.descripcion}</p>
                              {p.en_stock !== undefined && (
                                <span className={`self-start mb-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${p.en_stock ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {p.en_stock ? 'En existencia' : 'Sobre pedido'}
                                </span>
                              )}
                              <div className="text-xl font-black text-teal-600 mb-4">${Number(p.precio_estimado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-gray-400 font-medium tracking-wider">MXN</span></div>
                           </div>
                        </div>

                        <div className="p-6 pt-4 mt-auto flex flex-col gap-4 relative z-20">
                           {p.optic_times_id && (
                             <a 
                               href={`https://optictimes.mx/product?id=${p.optic_times_id}`}
                               target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold text-xs transition-colors"
                             >
                               <ExternalLink className="w-3.5 h-3.5" /> Ver Ficha Técnica Oficial
                             </a>
                           )}

                           <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Añadir a Cotización</span>
                              <motion.button 
                                whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                                onClick={() => addToCart(p)} 
                                className="bg-brand-ink text-white p-3.5 rounded-2xl shadow-lg shadow-black/10 hover:bg-teal-700 transition-colors"
                              >
                                 <Plus className="w-5 h-5" />
                              </motion.button>
                           </div>
                        </div>
                     </div>
                  ))}
               </motion.div>
             </AnimatePresence>

             {filtered.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-32 flex flex-col items-center">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <Search className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="font-heading font-bold text-xl text-brand-ink mb-2">No encontramos resultados</h3>
                  <p className="text-gray-500 font-medium">Intenta buscar con otras palabras o navega con nuestro asistente.</p>
                </motion.div>
             )}
           </>
         )}
         </div>
      </main>
      <ProductModal product={selectedProduct} isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} />
    </motion.div>
  );
}

function App() {
  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen">
        <GlobalNavbar />
        <main className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Screen1Selection />} />
              <Route path="/assistant" element={<Screen2AAssistant />} />
              <Route path="/catalog" element={<Screen2BCatalog />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
      <CartUI />
    </CartProvider>
  );
}

export default App;
