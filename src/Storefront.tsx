import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, increment, getDoc } from 'firebase/firestore';
import { generatePixPayload } from './utils/generatePix';
import { db } from './firebase';
import type { Product } from './data/products';
import { products as localProducts } from './data/products';
import { QRCodeSVG } from 'qrcode.react';
import { BottomNav } from './components/BottomNav';

interface CartItem {
  product: Product;
  quantity: number;
}

export default function Storefront() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [storeProducts, setStoreProducts] = useState<Product[]>(localProducts);
  const [loading, setLoading] = useState(true);
  const [pixKey, setPixKey] = useState('');
  const [pixPayload, setPixPayload] = useState('');
  const [checkoutMode, setCheckoutMode] = useState<'cart' | 'customer' | 'pix' | 'cartao'>('cart');
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', address: '' });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'pix' | 'cartao' | 'whatsapp' | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("5575988071066");
  const [showPromosOnly, setShowPromosOnly] = useState(false);

  useEffect(() => {
    // 1. Fetch Products
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const items: Product[] = [];
        querySnapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as Product);
        });
        
        if (items.length > 0) {
          setStoreProducts(items);
        }
      } catch (error) {
        console.error("Firebase connection not ready or empty. Using local fallback.");
      } finally {
        setLoading(false);
      }
    };

    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "store"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPixKey(data.pixKey || '');
          if (data.whatsapp) setWhatsappNumber(data.whatsapp);
        }
      } catch(e) {}
    };

    // 2. Track Visit
    const trackVisit = async () => {
      const hasVisited = localStorage.getItem('may_cosmeticos_visited');
      if (!hasVisited) {
        try {
          const analyticsRef = doc(db, 'analytics', 'visits');
          await setDoc(analyticsRef, { count: increment(1) }, { merge: true });
          localStorage.setItem('may_cosmeticos_visited', 'true');
        } catch (error) {
          console.error("Failed to track visit:", error);
        }
      }
    };

    fetchProducts();
    fetchSettings();
    trackVisit();
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      alert("Este produto está esgotado no momento.");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (product.stock !== undefined && existing.quantity >= product.stock) {
          alert(`Temos apenas ${product.stock} unidades em estoque.`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(false);
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerInfo.name || !customerInfo.phone) {
      alert("Por favor, preencha pelo menos nome e telefone.");
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const payload = {
        items: cart.map(item => ({
          id: item.product.id.toString(),
          quantity: item.quantity
        })),
        customerInfo: customerInfo,
        method: selectedPaymentMethod === 'whatsapp' ? 'WhatsApp' : (selectedPaymentMethod === 'pix' ? 'Pix' : 'InfinitePay')
      };

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();

      if (!response.ok) {
        alert(`Erro ao processar: ${data.error || data.message || "Erro desconhecido."}`);
        setIsCheckoutLoading(false);
        return;
      }

      // Se for WhatsApp, a venda foi criada e apenas abrimos o WhatsApp
      if (selectedPaymentMethod === 'whatsapp') {
        handleWhatsAppOrder(false, true); // true = bypass customer check
        setCart([]);
        setIsCartOpen(false);
        setIsCheckoutLoading(false);
        return;
      }

      // Se for Pix Direto, a venda foi criada e vamos para a tela do QR Code
      if (selectedPaymentMethod === 'pix') {
        setCheckoutMode('pix');
        setIsCheckoutLoading(false);
        return;
      }
      
      // Se for InfinitePay, redireciona para a URL de pagamento
      const paymentUrl = data.link_url || data.url;
      if (paymentUrl) {
        setCart([]);
        setIsCartOpen(false);
        window.location.href = paymentUrl;
      } else {
        alert("O servidor respondeu com sucesso, mas não enviou o link de pagamento.");
        setIsCheckoutLoading(false);
      }
    } catch (e) {
      console.error("Erro no checkout:", e);
      alert("Houve um problema de conexão. Tente novamente.");
      setIsCheckoutLoading(false);
    }
  };

  const startCheckout = (method: 'pix' | 'cartao' | 'whatsapp') => {
    setSelectedPaymentMethod(method);
    setCheckoutMode('customer');
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const newQuantity = item.quantity + delta;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const getEffectivePrice = (product: Product) => (product.isPromotion && product.promotionalPrice) ? product.promotionalPrice : product.price;

  const cartTotal = cart.reduce((total, item) => {
    const price = item.product.isPromotion && item.product.promotionalPrice ? item.product.promotionalPrice : item.product.price;
    return total + price * item.quantity;
  }, 0);

  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);

  const requiresPixOnly = cart.some(item => item.product.isPromotion && item.product.promoPaymentMethod === 'pix_only');

  useEffect(() => {
    if (checkoutMode === 'pix' && pixKey && cartTotal > 0) {
      try {
        const payload = generatePixPayload(pixKey, cartTotal, 'MayCosmeticos', 'Brasil');
        setPixPayload(payload);
      } catch (e) {
        console.error("Erro ao gerar Pix", e);
        setPixPayload('');
      }
    } else {
      setPixPayload('');
    }
  }, [checkoutMode, cartTotal, pixKey]);

  const handleWhatsAppOrder = async (paidWithPix: boolean = false, skipCustomer: boolean = false) => {
    if (cart.length === 0) return;
    
    // Se não passou pelo CRM ainda, inicia o checkout pedindo os dados
    if (!skipCustomer && checkoutMode !== 'pix') {
      startCheckout('whatsapp');
      return;
    }
    
    // Se chegou aqui via Pix, atualiza o status se quiser (opcional)
    
    let message = "Olá May Cosméticos! Gostaria de fazer o seguinte pedido:\n\n";
    cart.forEach(item => {
      const pPrice = getEffectivePrice(item.product);
      message += `${item.quantity}x ${item.product.name} (R$ ${pPrice.toFixed(2)})\n`;
    });
    message += `\n*Total: R$ ${cartTotal.toFixed(2)}*\n`;
    
    if (paidWithPix) {
       message += `\n✅ *Pagamento via Pix efetuado!* Segue o meu comprovante: `;
    } else {
       message += `\nComo podemos combinar a entrega?`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
    
    if (paidWithPix) {
      setCart([]);
      setIsCartOpen(false);
      setCheckoutMode('cart');
    }
  };

  if (loading) {
    return <div style={{textAlign:'center', padding: '50px'}}>Carregando Vitrine...</div>;
  }

  const promoProducts = storeProducts.filter(p => p.isPromotion);
  const displayProducts = showPromosOnly ? promoProducts : storeProducts;

  const renderProductCard = (product: Product) => (
    <div key={product.id} className="product-card">
      <div className="product-image-container" style={{ position: 'relative' }}>
        {product.isPromotion && (
          <div className="promo-badge">
            <span style={{ fontSize: '1rem' }}>⚡</span> OFERTA RELÂMPAGO
          </div>
        )}
        <img 
          src={product.image || "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80"} 
          alt={product.name} 
          loading="lazy" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const fallback = "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80";
            if (target.src !== fallback) {
              target.src = fallback;
            }
          }}
        />
      </div>
      <div className="product-info">
        <h3>{product.name}</h3>
        {product.isPromotion ? (
          <p className="price" style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '1rem', fontWeight: 'normal' }}>R$ {product.price.toFixed(2)}</span>
            <span style={{ color: '#e60000', fontSize: '1.4rem' }}>R$ {product.promotionalPrice?.toFixed(2)}</span>
          </p>
        ) : (
          <p className="price">R$ {product.price.toFixed(2)}</p>
        )}
        {product.stock !== undefined && product.stock <= 0 ? (
          <button className="add-to-cart-btn" style={{ background: '#999', cursor: 'not-allowed' }} disabled>
            Esgotado
          </button>
        ) : (
          <button className="add-to-cart-btn" onClick={() => addToCart(product)}>
            Adicionar
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="storefront-container">
      {/* HEADER PRINCIPAL */}
      <header className="header">
        <div className="header-content">
          <div className="header-logo">
            <img 
              src="/logo.jpeg" 
              alt="May Cosméticos Logo" 
              className="header-logo-image" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const placeholder = document.getElementById('header-logo-placeholder');
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />
            <div id="header-logo-placeholder" className="header-logo-placeholder" style={{ display: 'none' }}>
              May
            </div>
            <div>
              <h1 className="header-brand-name">May Cosméticos</h1>
              <p className="header-subtitle">Beleza & Bem-Estar</p>
            </div>
          </div>
          
          <button className="cart-toggle-btn" onClick={() => setIsCartOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" className="cart-icon">
              <path d="M0 24C0 10.7 10.7 0 24 0H69.5c22 0 41.5 12.8 50.6 32h411c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3H170.7l5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5H488c13.3 0 24 10.7 24 24s-10.7 24-24 24H199.7c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5H24C10.7 48 0 37.3 0 24zM128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/>
            </svg>
            <span className="cart-badge">{cartItemCount}</span>
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="hero-banner">
          <h2 className="slogan">"Floresça a sua melhor versão"</h2>
          <p>Confira nossos produtos e faça seu pedido direto pelo WhatsApp!</p>
        </div>

        {/* VITRINE DE PRODUTOS */}
        {!showPromosOnly && promoProducts.length > 0 && (
          <div className="promo-hero-banner">
            <h2>Ofertas Relâmpago! ⚡</h2>
            <p>Aproveite nossa queima de estoque exclusiva antes que acabe.</p>
            <button className="promo-hero-btn" onClick={() => setShowPromosOnly(true)}>
              Ver Ofertas
            </button>
          </div>
        )}

        {showPromosOnly && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ color: '#e60000', fontSize: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              ⚡ Ofertas Especiais
            </h2>
            <button 
              onClick={() => setShowPromosOnly(false)} 
              style={{ padding: '8px 20px', background: 'var(--color-rose)', border: 'none', borderRadius: '20px', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow-card)' }}
            >
              ← Voltar para Todos os Produtos
            </button>
          </div>
        )}

        {!showPromosOnly && (
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--color-gold-dark)', fontSize: '1.8rem' }}>
            Nossos Produtos
          </h2>
        )}

        <section className="products-grid">
          {displayProducts.map(renderProductCard)}
        </section>

        {showPromosOnly && (
          <div style={{ textAlign: 'center', marginTop: '3rem', marginBottom: '3rem' }}>
            <p style={{ color: '#666', marginBottom: '15px' }}>Quer adicionar outros produtos ao carrinho?</p>
            <button 
              onClick={() => setShowPromosOnly(false)} 
              style={{ padding: '15px 30px', background: '#333', border: 'none', borderRadius: '30px', color: 'white', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition: 'transform 0.2s' }}
            >
              Ver Toda a Loja 🛍️
            </button>
          </div>
        )}
      </main>

      {/* CARRINHO DE COMPRAS (SIDEBAR) */}
      {isCartOpen && (
        <div className="cart-overlay" onClick={() => { setIsCartOpen(false); setCheckoutMode('cart'); }}>
          <div className="cart-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2>{checkoutMode === 'pix' ? 'Pagamento Pix' : 'Seu Carrinho'}</h2>
              <button className="close-cart" onClick={() => { setIsCartOpen(false); setCheckoutMode('cart'); }}>✕</button>
            </div>
            
            {checkoutMode === 'cart' ? (
              <>
                <div className="cart-items">
              {cart.length === 0 ? (
                <p className="empty-cart">Seu carrinho está vazio.</p>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="cart-item">
                    <img 
                      src={item.product.image || "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80"} 
                      alt={item.product.name} 
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const fallback = "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80";
                        if (target.src !== fallback) {
                          target.src = fallback;
                        }
                      }}
                    />
                    <div className="item-details">
                      <h4>{item.product.name}</h4>
                      {item.product.isPromotion ? (
                        <p style={{ color: '#e60000', fontWeight: 'bold' }}>
                          R$ {item.product.promotionalPrice?.toFixed(2)} <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.8rem', fontWeight: 'normal' }}>R$ {item.product.price.toFixed(2)}</span>
                        </p>
                      ) : (
                        <p>R$ {item.product.price.toFixed(2)}</p>
                      )}
                      <div className="quantity-controls">
                        <button onClick={() => updateQuantity(item.product.id, -1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)}>+</button>
                      </div>
                    </div>
                    <button className="remove-item" onClick={() => removeFromCart(item.product.id)}>
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="cart-total">
                  <span>Total:</span>
                  <span>R$ {cartTotal.toFixed(2)}</span>
                </div>
                <div className="cart-footer-buttons">
                  {requiresPixOnly && (
                    <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', color: '#e65100', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: '1.4' }}>
                      <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                      Seu carrinho contém Ofertas Relâmpago exclusivas. O pagamento deve ser feito via PIX.
                    </div>
                  )}

                  <button
                    onClick={() => startCheckout('cartao')}
                    disabled={isCheckoutLoading || requiresPixOnly}
                    className="checkout-btn-infinitepay"
                    style={{ marginBottom: '10px', background: requiresPixOnly ? '#e0e0e0' : '#111', color: requiresPixOnly ? '#9e9e9e' : 'white', cursor: requiresPixOnly ? 'not-allowed' : 'pointer' }}
                  >
                    {isCheckoutLoading ? <span className="spinner-small"></span> : <>💳 Pagar com Cartão (InfinitePay)</>}
                  </button>
                  
                  {pixKey && (
                    <button 
                      onClick={() => startCheckout('pix')} 
                      disabled={isCheckoutLoading}
                      style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginBottom: '10px' }}
                    >
                      {isCheckoutLoading && selectedPaymentMethod === 'pix' ? <span className="spinner-small"></span> : <><span style={{ marginRight: '5px' }}>💠</span> Pagar com Pix Direto</>}
                    </button>
                  )}
                  
                  <button 
                    className="checkout-btn" 
                    onClick={() => startCheckout('whatsapp')}
                    disabled={requiresPixOnly}
                    style={requiresPixOnly ? { background: '#e0e0e0', color: '#9e9e9e', cursor: 'not-allowed' } : {}}
                  >
                    Combinar Pagamento via WhatsApp
                  </button>
                </div>
              </div>
            )}
            </>
            ) : checkoutMode === 'customer' ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '90px' }}>
                <h3 style={{ color: '#ec4899', marginBottom: '20px' }}>Detalhes da Entrega</h3>
                <form onSubmit={handleCustomerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Nome Completo *</label>
                    <input type="text" required value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} placeholder="Ex: Maria Silva" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>WhatsApp *</label>
                    <input type="tel" required value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Endereço Completo (Opcional)</label>
                    <textarea value={customerInfo.address} onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px' }} placeholder="Rua, Número, Bairro..."></textarea>
                  </div>
                  
                  <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                    <button type="submit" disabled={isCheckoutLoading} style={{ width: '100%', padding: '15px', background: '#ec4899', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', marginBottom: '10px' }}>
                      {isCheckoutLoading ? "Processando..." : "Continuar para Pagamento"}
                    </button>
                    <button type="button" onClick={() => setCheckoutMode('cart')} style={{ width: '100%', padding: '15px', background: 'transparent', color: '#666', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Voltar
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '90px' }}>
                <h3 style={{ color: '#166534', marginBottom: '10px' }}>Escaneie para Pagar</h3>
                <p style={{ color: '#555', marginBottom: '20px' }}>Abra o app do seu banco e escaneie o QR Code abaixo para pagar <strong>R$ {cartTotal.toFixed(2)}</strong>.</p>
                
                <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '12px', display: 'inline-block', margin: '0 auto 20px auto', border: '1px solid #bbf7d0' }}>
                  {pixPayload ? (
                    <QRCodeSVG value={pixPayload} size={200} />
                  ) : (
                    <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Gerando...</div>
                  )}
                </div>

                {pixPayload && (
                  <button 
                    onClick={() => { navigator.clipboard.writeText(pixPayload); alert("Código Pix Copia e Cola copiado!"); }}
                    style={{ background: '#eee', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#333', marginBottom: '30px' }}
                  >
                    Copiar Código Pix
                  </button>
                )}

                <div style={{ marginTop: 'auto' }}>
                  <button 
                    onClick={() => handleWhatsAppOrder(true)}
                    style={{ width: '100%', padding: '15px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', marginBottom: '10px' }}
                  >
                    Já Paguei! Enviar Comprovante
                  </button>
                  <button 
                    onClick={() => setCheckoutMode('cart')}
                    style={{ width: '100%', padding: '15px', background: 'transparent', color: '#666', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Voltar para o Carrinho
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="footer" style={{ paddingBottom: '80px' }}>
        <p>&copy; {new Date().getFullYear()} May Cosméticos. Todos os direitos reservados.</p>
      </footer>
      <BottomNav />
    </div>
  );
}
