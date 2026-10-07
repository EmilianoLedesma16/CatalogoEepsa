import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Grid, Search, ShoppingCart, Plus, Minus, X, ArrowLeft, ArrowRight, Phone, Bot, LayoutGrid, List, ShieldCheck, Headset, Truck, Award, MapPin, ExternalLink, CheckCircle, ChevronDown, AlertCircle, ChevronLeft, ChevronRight, RotateCcw, CheckCheck, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { CartProvider, useCart } from './CartContext';
import type { Product } from './CartContext';

const API_URL = '/api/productos';

/** Nombre de contacto: sólo letras (acentos, ñ, ü) separadas por un espacio; mínimo 3 letras. */
const NOMBRE_RE = /^(?=.{3,80}$)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
const NOMBRE_INVALIDO = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g;

const AVISO_PRECIOS = 'Precios de referencia, sujetos a cambio sin previo aviso y a disponibilidad.';

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

/** Sobre sólido (como `fa-envelope` del sitio principal). */
const EnvelopeIcon = ({ className = 'w-4 h-4' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden="true">
    <path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z" />
  </svg>
);

// Nav copiado del sitio principal (repo eepsa3, next-app/src/components/Header.tsx y MobileMenu.tsx),
// en Tailwind, más el botón del carrito de cotización.
const NAV_EEPSA = [
  { href: 'https://www.eepsa.com.mx/', label: 'Inicio' },
  { href: 'https://www.eepsa.com.mx/Servicios', label: 'Servicios' },
  { href: 'https://www.eepsa.com.mx/Nosotros', label: 'Nosotros' },
  { href: 'https://www.eepsa.com.mx/Contacto', label: 'Contacto' },
];

function GlobalNavbar() {
  const { cart, setIsCartOpen } = useCart();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = cart.reduce((acc, item) => acc + item.cantidad, 0);

  const showCart = location.pathname !== '/';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const desktopLink =
    "relative inline-block px-0.5 py-2 text-[1.1rem] font-medium leading-[1.2] text-[#343a40] transition-colors hover:text-[#1a5952] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-[#1a5952] after:transition-all after:duration-300 after:content-[''] hover:after:w-full";

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 py-3 font-[Arial,sans-serif] leading-[1.6] text-[#333] shadow-[0_2px_20px_rgba(0,0,0,0.1)] backdrop-blur-[10px]">
        <div className="mx-auto flex w-[90%] max-w-[1200px] items-center justify-between gap-5 px-[15px]">
          <a href="https://www.eepsa.com.mx/" className="flex shrink-0 items-center" aria-label="Ir al inicio">
            <img src="/EPSA.png" alt="EEPSA" width={200} height={75} className="block h-auto w-[155px] object-contain" />
          </a>

          <nav className="hidden min-[993px]:block" aria-label="Navegación principal">
            <ul className="flex list-none gap-[30px]">
              {NAV_EEPSA.map(({ href, label }) => (
                <li key={href}>
                  <a href={href} className={desktopLink}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden flex-col gap-1 text-[0.8rem] min-[993px]:flex">
              <a
                href="https://wa.me/525543241575?text=Hola%2C%20me%20gustar%C3%ADa%20solicitar%20informaci%C3%B3n%20sobre%20sus%20servicios."
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contactar a EEPSA por WhatsApp"
                className="flex items-center gap-1.5 text-[#343a40] transition-colors hover:text-[#1a5952]"
              >
                <span className="flex w-4 justify-center" aria-hidden="true"><WhatsAppIcon className="h-[0.8rem] w-[0.8rem]" /></span>
                <span>(52) 5543241575</span>
              </a>
              <a href="mailto:contacto@eepsa.com.mx" aria-label="Enviar correo electrónico a EEPSA" className="flex items-center gap-1.5 text-[#343a40] transition-colors hover:text-[#1a5952]">
                <span className="flex w-4 justify-center" aria-hidden="true"><EnvelopeIcon className="h-[0.8rem] w-[0.8rem]" /></span>
                <span>contacto@eepsa.com.mx</span>
              </a>
            </div>

            {showCart && (
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setIsCartOpen(true)}
                aria-label="Ver mi cotización"
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-700 transition-colors hover:bg-teal-100"
              >
                <ShoppingCart className="h-5 w-5" />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-[10px] font-bold text-white"
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}

            <button
              type="button"
              className="p-2 text-[#343a40] min-[993px]:hidden"
              aria-label="Abrir menú de navegación"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Menú móvil */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 transition-all duration-300 ${menuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="mobile-menu"
        aria-label="Menú de navegación móvil"
        className={`fixed top-0 z-[61] flex h-dvh font-[Arial,sans-serif] leading-[1.6] w-[300px] flex-col gap-6 overflow-y-auto bg-white px-5 py-6 transition-[right] duration-300 ease-in-out ${menuOpen ? 'right-0' : '-right-[320px]'}`}
      >
        <div className="flex items-center justify-between">
          <a href="https://www.eepsa.com.mx/" className="flex items-center">
            <img src="/EPSA.png" alt="EEPSA" width={120} height={45} className="h-auto w-[120px]" />
          </a>
          <button className="p-2 text-[#343a40]" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav aria-label="Menú móvil">
          <ul className="flex flex-col gap-1">
            {NAV_EEPSA.map(({ href, label }) => (
              <li key={href}>
                <a href={href} className="block rounded-[10px] px-4 py-3 font-medium text-[#343a40] transition-all hover:bg-[rgba(57,150,142,0.08)] hover:text-[#1a5952]">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-[#eee] pt-5">
          <a href="tel:+525558398082" className="flex items-center gap-2.5 text-[0.9rem] text-[#6c757d]">
            <Phone className="h-4 w-4 text-[#1a5952]" /> (55) 5839 8082
          </a>
          <a href="mailto:contacto@eepsa.com.mx" className="flex items-center gap-2.5 text-[0.9rem] text-[#6c757d]">
            <EnvelopeIcon className="h-[0.9rem] w-[0.9rem] text-[#1a5952]" /> contacto@eepsa.com.mx
          </a>
        </div>
      </aside>
    </>
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
  // Modo consulta (el SINV aún no está conectado): se puede ver el catálogo pero no cotizar en línea
  const [sinCotizaciones, setSinCotizaciones] = useState('');
  useEffect(() => {
    if (!isCartOpen) return;
    fetch('/api/estado')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setSinCotizaciones(data && data.cotizaciones === false ? (data.mensaje ?? 'Por ahora no recibimos cotizaciones en línea.') : ''))
      .catch(() => setSinCotizaciones(''));
  }, [isCartOpen]);
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

                  <a href="https://maps.app.goo.gl/k84HifViNSYAn8LMA" target="_blank" rel="noopener noreferrer" className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors">
                     <MapPin className="w-5 h-5" /> Visualizar ubicación de la tienda
                  </a>
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
              <p className="-mt-4 mb-5 text-right text-[11px] text-gray-400">{AVISO_PRECIOS}</p>

              {sinCotizaciones && (
                <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{sinCotizaciones}</p>
              )}

              {cart.length > 0 && !sinCotizaciones && (
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
                   disabled={isGenerating || cart.length === 0 || Boolean(contactError) || Boolean(sinCotizaciones)}
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
                <div className="text-3xl font-black text-teal-600">${Number(product.precio_estimado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-400 font-medium tracking-wider">MXN</span></div>
                <p className="text-[11px] text-gray-400 mt-1 mb-4">IVA incluido. {AVISO_PRECIOS}</p>
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
  const categories = useCatalogCategories();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch(API_URL)
      .then(res => (res.ok ? res.json() : []))
      .then(setProducts)
      .catch(err => console.error('Error al cargar productos', err));
  }, []);

  const goCatalog = (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    navigate(qs ? `/catalog?${qs}` : '/catalog');
  };

  // Líneas del SINV con su conteo real y la foto de un producto de esa línea
  const lines = categories
    .map(c => {
      const items = products.filter(p => p.etiquetas[0] === c.name);
      // Disponible = al menos un producto de la línea con existencia (disponible >= 1) en el SINV.
      // null = sin dato de existencias (catálogo en modo consulta): no se muestra la etiqueta.
      const inStock = items.some(p => p.disponible !== undefined) ? items.some(p => (p.disponible ?? 0) >= 1) : null;
      return { ...c, count: items.length, inStock, image: items.find(p => p.imagen_url)?.imagen_url ?? null };
    })
    .sort((a, b) => b.count - a.count);

  const paths = [
    {
      eyebrow: 'Diagnóstico asistido',
      title: 'Asesoría Técnica con Nexi',
      desc: 'Nuestro asistente técnico te guía paso a paso hasta el producto ideal según tu topología (FTTH, DWDM, Backhaul) y tu presupuesto.',
      cta: 'Iniciar consulta guiada',
      icon: Bot,
      mascot: '/nexi.png',
      onClick: () => navigate('/assistant'),
    },
    {
      eyebrow: 'Inventario en línea',
      title: 'Explorar Catálogo Completo',
      desc: 'Consulta disponibilidad en tiempo real, compara especificaciones, abre fichas técnicas y arma tu cotización al instante.',
      cta: 'Ver todos los productos',
      icon: LayoutGrid,
      cornerIcon: List,
      mascot: null,
      onClick: () => goCatalog(),
    },
  ];

  const perks = [
    { icon: ShieldCheck, title: 'Garantía oficial eepsa', desc: 'Respaldo directo de fábrica' },
    { icon: Headset, title: 'Soporte especializado', desc: 'Ingenieros certificados en fibra' },
    { icon: Truck, title: 'Envíos inmediatos', desc: 'Distribución nacional en México' },
    { icon: Award, title: 'Certificación ITU-T', desc: 'Normativas G.652, G.657 y TIA' },
  ];

  return (
    <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit" className="flex-1 bg-[#F7F9FB]">
      {/* HERO */}
      <section className="px-4 sm:px-6 pt-12 md:pt-16 pb-14">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-5xl font-bold text-brand-ink font-heading tracking-tight leading-tight">
              Catálogo de <span className="text-teal-600">Equipamiento Óptico</span>
            </h1>
            <p className="mt-5 text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Elige la forma más ágil de encontrar el equipo, consumible o solución de telecomunicaciones que requiere tu proyecto de red e infraestructura crítica.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {paths.map(p => (
              <button
                key={p.title}
                onClick={p.onClick}
                className="group relative text-left bg-white border border-gray-200/80 hover:border-teal-500/60 rounded-2xl p-7 md:p-8 shadow-sm hover:shadow-lg hover:shadow-teal-900/5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 flex flex-col"
              >
                <div className="w-12 h-12 mb-8 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                  <p.icon className="w-6 h-6 text-teal-700" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{p.eyebrow}</span>
                <h2 className="mt-1.5 text-xl font-semibold text-brand-ink font-heading">{p.title}</h2>
                <p className={`mt-3 text-sm text-gray-600 leading-relaxed flex-1 ${p.mascot ? 'pr-24 sm:pr-32 md:pr-36' : ''}`}>{p.desc}</p>
                <div className="w-full mt-8 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                    {p.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                  {p.cornerIcon && (
                    <span className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center">
                      <p.cornerIcon className="w-4 h-4 text-teal-600" />
                    </span>
                  )}
                </div>
                {/* Nexi sale por la esquina inferior derecha de la tarjeta */}
                {p.mascot && (
                  <img
                    src={p.mascot}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none select-none absolute right-2 bottom-0 h-36 sm:h-44 md:h-56 md:-right-3 md:-bottom-8 z-10 drop-shadow-xl group-hover:-translate-y-1 transition-transform duration-300"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORÍAS */}
      {lines.length > 0 && (
        <section className="px-4 sm:px-6 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Líneas de producto</span>
                <h2 className="mt-1 text-2xl md:text-3xl font-bold text-brand-ink font-heading">Categorías principales</h2>
              </div>
              <button onClick={() => goCatalog()} className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-600">
                Explorar todo el catálogo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {lines.slice(0, 4).map(l => (
                <button
                  key={l.name}
                  onClick={() => goCatalog({ cat: l.name })}
                  className="group text-left bg-white border border-gray-200/80 hover:border-teal-500/60 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:shadow-teal-900/5 transition-all duration-200 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <div className="relative w-full h-36 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center">
                    {l.image
                      ? <img src={l.image} alt={l.name} loading="lazy" className="w-full h-full object-contain p-3 mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
                      : <LayoutGrid className="w-10 h-10 text-gray-300" />}
                    {l.inStock !== null && (
                      <span className={`absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${l.inStock ? 'bg-teal-50 border-teal-100 text-teal-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${l.inStock ? 'bg-teal-600' : 'bg-gray-400'}`} />
                        {l.inStock ? 'Disponible' : 'No disponible'}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-brand-ink font-heading">{l.name}</h3>
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1">
                    {l.sub.length ? l.sub.join(', ') : 'Consulta los productos disponibles de esta línea.'}
                  </p>
                  <div className="w-full mt-4 flex items-center justify-between text-xs font-semibold text-teal-700">
                    Ver equipos <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BENEFICIOS */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {perks.map(p => (
            <div key={p.title} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200/80 px-4 py-3.5">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-teal-50 flex items-center justify-center">
                <p.icon className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-brand-ink">{p.title}</p>
                <p className="text-xs text-gray-500">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
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
  const { addToCart, cart, removeFromCart, updateQuantity, totalEstimado, setIsCartOpen } = useCart();
  const [lastResults, setLastResults] = useState<{ category: string; products: Product[] } | null>(null);
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
      setLastResults({ category, products: data });
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'bot', text: 'Uy, tuvimos un problema de conexión. ¿Intentamos de nuevo?' }]);
      setWaitingForCategory(true);
    }
    setLoading(false);
  };

  const handleAddToCartInChat = (p: Product) => {
    addToCart(p, false);
    setMessages(prev => [
      ...prev,
      { id: Date.now(), type: 'bot', text: `He agregado "${p.nombre}" a tu cotización.`, icon: 'success', productImage: p.imagen_url ?? undefined }
    ]);
  };

  // Vuelve a mostrar los productos de la categoría actual sin consultar de nuevo
  const continueCategory = () => {
    if (!lastResults) return;
    const now = Date.now();
    setMessages(prev => [
      ...prev,
      { id: now, type: 'user', text: `Seguir en ${lastResults.category}` },
      { id: now + 1, type: 'bot', text: `Claro, aquí tienes de nuevo las opciones de "${lastResults.category}".`, products: lastResults.products },
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
      <div className="flex w-full max-w-6xl gap-6">
      <div className="relative flex h-[calc(100vh-4rem)] w-full min-w-0 flex-1 flex-col bg-white sm:h-[calc(100vh-8rem)] sm:max-h-[900px] sm:rounded-[2.5rem] sm:border sm:border-gray-200 premium-shadow overflow-hidden">
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
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap justify-start gap-2 mt-4 mb-6 ml-2 sm:ml-10">
                {lastResults && (
                  <button onClick={continueCategory} className="flex items-center gap-2 bg-teal-600 border border-teal-600 text-white font-bold py-2.5 px-5 rounded-full hover:bg-teal-700 transition-colors shadow-sm text-sm">
                    <ArrowRight className="w-4 h-4" /> Seguir en {lastResults.category}
                  </button>
                )}
                <button onClick={resetSearch} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 font-bold py-2.5 px-5 rounded-full hover:bg-teal-50 hover:text-teal-700 transition-colors shadow-sm text-sm premium-shadow">
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

      {/* Panel lateral: lo que el usuario va seleccionando en el chat */}
      <aside className="hidden lg:flex w-80 shrink-0 flex-col sm:h-[calc(100vh-8rem)] sm:max-h-[900px] bg-white border border-gray-200 rounded-[2rem] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-brand-ink font-heading">Tu selección</h2>
          <p className="text-xs text-gray-500 mt-0.5">Se actualiza conforme avanzas con Nexi.</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 flex flex-col gap-6">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">Productos agregados</h3>
            {cart.length === 0 ? (
              <p className="text-sm text-gray-400">Agrega productos desde el chat y aparecerán aquí.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {cart.map(item => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2">
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                      {item.imagen_url ? <img src={item.imagen_url} alt="" className="w-full h-full object-contain p-1 mix-blend-multiply" /> : <Grid className="w-5 h-5 text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-brand-ink line-clamp-2 leading-snug">{item.nombre}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">${Number(item.precio_estimado ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} c/u</p>
                      <div className="mt-1.5 inline-flex items-center rounded-lg border border-gray-200">
                        <button onClick={() => updateQuantity(item.id, item.cantidad - 1)} disabled={item.cantidad <= 1} aria-label="Restar uno" className="p-1.5 text-gray-500 hover:text-teal-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="min-w-[1.75rem] text-center text-xs font-semibold text-brand-ink">{item.cantidad}</span>
                        <button onClick={() => updateQuantity(item.id, item.cantidad + 1)} aria-label="Sumar uno" className="p-1.5 text-gray-500 hover:text-teal-700 transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} aria-label={`Quitar ${item.nombre}`} className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {cart.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-sm text-gray-500">Total estimado</span>
              <span className="text-lg font-bold text-teal-700">${totalEstimado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-medium text-gray-400">MXN</span></span>
            </div>
            <button onClick={() => setIsCartOpen(true)} className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-3 transition-colors">
              Ver cotización
            </button>
          </div>
        )}
      </aside>
      </div>
      <ProductModal product={selectedProduct} isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={handleAddToCartInChat} />
    </motion.div>
  );
}

function Screen2BCatalog() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  // Filtros iniciales desde la URL (los manda el buscador/categorías de la pantalla de inicio)
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('cat') ?? 'Todos');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(searchParams.get('sub'));
  const [expandedCategory, setExpandedCategory] = useState<string | null>(searchParams.get('cat'));

  // Menú lateral = líneas y categorías del SINV (antes estaba fijo y se desfasaba del catálogo real)
  const catalogCategories: CatalogCategory[] = [{ name: 'Todos', sub: [] }, ...useCatalogCategories()];

  // Al cambiar de categoría/subcategoría, volver arriba para ver la lista desde el inicio
  const firstFilterRender = useRef(true);
  useEffect(() => {
    if (firstFilterRender.current) { firstFilterRender.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedCategory, selectedSubCategory]);

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
             <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
               <span className="text-sm font-bold text-gray-500">{filtered.length} productos encontrados</span>
               <span className="text-xs text-gray-400">{AVISO_PRECIOS}</span>
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

// Footer copiado del sitio principal (repo eepsa3, next-app/src/components/Footer.tsx), en Tailwind.
const SITIO_EEPSA = 'https://www.eepsa.com.mx';

function GlobalFooter() {
  const year = new Date().getFullYear();
  const linkClass = 'text-[0.9rem] text-white/65 transition-colors hover:text-[#1a5952]';

  return (
    <footer className="mt-10 bg-[#343a40] pb-[30px] pt-[60px] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 grid grid-cols-1 gap-7 min-[601px]:grid-cols-2 min-[901px]:grid-cols-[2fr_1fr_1fr_1.5fr] min-[901px]:gap-10">
          <div>
            <img src="/EPSA.png" alt="EEPSA" width={140} height={50} className="mb-4 h-auto max-w-[140px]" />
            <p className="mb-4 text-[0.9rem] leading-[1.7] text-white/65">
              Optimizamos infraestructura y soluciones tecnológicas avanzadas para impulsar el éxito de tu negocio.
            </p>
          </div>

          <div>
            <h4 className="mb-3.5 text-[0.95rem] font-bold text-white/80">Servicios</h4>
            <ul className="flex flex-col gap-2.5">
              <li><a className={linkClass} href={`${SITIO_EEPSA}/Servicios#instalaciones-electricas`}>Instalación Eléctrica</a></li>
              <li><a className={linkClass} href={`${SITIO_EEPSA}/Servicios#sistemas-mecanicos`}>Sistemas Mecánicos</a></li>
              <li><a className={linkClass} href={`${SITIO_EEPSA}/Servicios#proyectos-ingenieria`}>Proyectos de Ingeniería</a></li>
              <li><a className={linkClass} href={`${SITIO_EEPSA}/Servicios#mantenimiento-industrial`}>Mantenimiento Industrial</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3.5 text-[0.95rem] font-bold text-white/80">Compañía</h4>
            <ul className="flex flex-col gap-2.5">
              <li><a className={linkClass} href={`${SITIO_EEPSA}/Nosotros`}>Quiénes Somos</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3.5 text-[0.95rem] font-bold text-white/80">Contacto</h4>
            <a href="https://maps.app.goo.gl/jivwPy1VbwrSibpg7" target="_blank" rel="noopener noreferrer" className="group">
              <p className="mb-2.5 flex items-start gap-2.5 text-[0.88rem] text-white/65 transition-colors group-hover:text-[#1a5952]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#1a5952]" aria-hidden="true" />
                DONIZETTI 217 COL. VALLEJO, Ciudad de México, México
              </p>
            </a>
            <a href="https://wa.me/525543241575" target="_blank" rel="noopener noreferrer" aria-label="Contactar a EEPSA por WhatsApp" className="group">
              <p className="mb-2.5 flex items-start gap-2.5 text-[0.88rem] text-white/65 transition-colors group-hover:text-[#1a5952]">
                <WhatsAppIcon className="mt-0.5 h-4 w-4 shrink-0 fill-[#1a5952]" />
                (52) 5543241575
              </p>
            </a>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 text-center text-[0.85rem] text-white/50">
          <p>&copy; {year} EEPSA. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
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
        <GlobalFooter />
      </div>
      <CartUI />
    </CartProvider>
  );
}

export default App;
