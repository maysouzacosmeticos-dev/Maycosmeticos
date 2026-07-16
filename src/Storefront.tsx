import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, increment, getDoc, addDoc, query, where, updateDoc } from 'firebase/firestore';
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
  const whatsappNumber = "5575988071066";

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
        if (docSnap.exists()) setPixKey(docSnap.data().pixKey || '');
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
      // 1. Atualizar ou Criar Cliente no CRM
      const customersRef = collection(db, "customers");
      const q = query(customersRef, where("name", "==", customerInfo.name.trim()));
      const snap = await getDocs(q);
      
      let customerId = "";
      if (!snap.empty) {
        customerId = snap.docs[0].id;
        await updateDoc(doc(db, "customers", customerId), {
          phone: customerInfo.phone || "",
          address: customerInfo.address || ""
        });
      } else {
        const newCustomer = await addDoc(customersRef, {
          name: customerInfo.name.trim() || "Cliente Sem Nome",
          phone: customerInfo.phone || "",
          address: customerInfo.address || "",
          totalGasto: 0,
          totalDivida: 0
        });
        customerId = newCustomer.id;
      }

      // 2. Registrar o Pedido Pendente (sem baixar estoque)
      const cartTotalCalc = cart.reduce((total, item) => total + (item.product.price || 0) * item.quantity, 0);
      await addDoc(collection(db, "sales"), {
        date: new Date().toISOString(),
        items: cart.map(item => ({
          id: item.product.id || "sem-id",
          name: item.product.name || "Produto sem nome",
          price: item.product.price || 0,
          quantity: item.quantity || 1
        })),
        total: cartTotalCalc,
        method: selectedPaymentMethod === 'cartao' ? 'InfinitePay' : (selectedPaymentMethod === 'pix' ? 'Pix' : 'WhatsApp'),
        source: 'Online',
        status: 'pendente',
        customerName: customerInfo.name.trim() || "Cliente Sem Nome",
        customerId: customerId,
        customerPhone: customerInfo.phone || "",
        customerAddress: customerInfo.address || "",
        amountPaid: 0
      });

      // 3. Redirecionar para o passo final
      if (selectedPaymentMethod === 'cartao') {
        await executeInfinitePayCheckout();
      } else if (selectedPaymentMethod === 'pix') {
        setCheckoutMode('pix');
        setIsCheckoutLoading(false);
      } else {
        handleWhatsAppOrder(false, true); // true = bypass customer check since we just saved it
      }
    } catch (e) {
      console.error("Erro ao registrar pedido:", e);
      alert("Erro ao processar pedido. Tente novamente.");
      setIsCheckoutLoading(false);
    }
  };

  const executeInfinitePayCheckout = async () => {
    try {
      const items = cart.map(item => ({
        id: item.product.id.toString(),
        description: item.product.name,
        price: Math.round(item.product.price * 100),
        quantity: item.quantity
      }));

      const payload = {
        handle: "maycosmeticos2026",
        redirect_url: window.location.origin,
        order_nsu: Date.now().toString(),
        items: items
      };

      const response = await fetch("/.netlify/functions/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        alert(`Erro da InfinitePay: ${data.message || JSON.stringify(data) || "Erro."}`);
        setIsCheckoutLoading(false);
        return;
      }
      
      const paymentUrl = data.link_url || data.url;
      if (paymentUrl) {
        setCart([]);
        setIsCartOpen(false);
        window.location.href = paymentUrl;
      }
    } catch (error: any) {
      alert(`Houve um problema: ${error.message}`);
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

  const cartTotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);

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
      message += `${item.quantity}x ${item.product.name} (R$ ${item.product.price.toFixed(2)})\n`;
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

  return (
    <div className="app-container">
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
        <section className="products-grid">
          {storeProducts.map((product) => (
            <div key={product.id} className="product-card">
              <div className="product-image-container">
                <img src={product.image} alt={product.name} loading="lazy" />
              </div>
              <div className="product-info">
                <h3>{product.name}</h3>
                <p className="price">R$ {product.price.toFixed(2)}</p>
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
          ))}
        </section>
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
                    <img src={item.product.image} alt={item.product.name} />
                    <div className="item-details">
                      <h4>{item.product.name}</h4>
                      <p>R$ {item.product.price.toFixed(2)}</p>
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
                  <button
                    onClick={() => startCheckout('cartao')}
                    disabled={isCheckoutLoading}
                    className="checkout-btn-infinitepay"
                    style={{ marginBottom: '10px' }}
                  >
                    {isCheckoutLoading ? <span className="spinner-small"></span> : <>💳 Cartão de Crédito</>}
                  </button>
                  
                  {pixKey && (
                    <button 
                      onClick={() => startCheckout('pix')} 
                      style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginBottom: '10px' }}
                    >
                      <span style={{ marginRight: '5px' }}>💠</span> Pagar com Pix Direto
                    </button>
                  )}
                  
                  <button className="checkout-btn" onClick={() => startCheckout('whatsapp')}>
                    Combinar Pagamento via WhatsApp
                  </button>
                </div>
              </div>
            )}
            </>
            ) : checkoutMode === 'customer' ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              <div style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
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
