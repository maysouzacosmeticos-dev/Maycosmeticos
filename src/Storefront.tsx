import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import type { Product } from './data/products';
import { products as localProducts } from './data/products';

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
    trackVisit();
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(false);
  };

  const handleInfinitePayCheckout = async () => {
    if (cart.length === 0) return;
    setIsCheckoutLoading(true);

    try {
      // Formatar itens para a InfinitePay (preço em centavos)
      const items = cart.map(item => ({
        name: item.product.name,
        price: Math.round(item.product.price * 100),
        quantity: item.quantity
      }));

      const payload = {
        handle: "jroberto_cerqueira",
        redirect_url: window.location.origin,
        items: items
      };

      const response = await fetch("/.netlify/functions/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar link de pagamento.");
      }

      const data = await response.json();
      
      // A API retorna o link gerado, geralmente no campo link_url ou url
      const paymentUrl = data.link_url || data.url;
      
      if (paymentUrl) {
        // Limpar carrinho e redirecionar
        setCart([]);
        setIsCartOpen(false);
        window.location.href = paymentUrl;
      } else {
        throw new Error("Link não encontrado na resposta.");
      }

    } catch (error) {
      console.error(error);
      alert("Houve um problema ao gerar o link de pagamento. Tente novamente mais tarde.");
    } finally {
      setIsCheckoutLoading(false);
    }
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

  const handleCheckout = () => {
    if (cart.length === 0) return;
    
    let message = "Olá May Cosméticos! Gostaria de fazer o seguinte pedido:\n\n";
    cart.forEach(item => {
      message += `${item.quantity}x ${item.product.name} (R$ ${item.product.price.toFixed(2)})\n`;
    });
    message += `\n*Total: R$ ${cartTotal.toFixed(2)}*\n\nComo podemos combinar a entrega?`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
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
                <button className="add-to-cart-btn" onClick={() => addToCart(product)}>
                  Adicionar
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* CARRINHO DE COMPRAS (SIDEBAR) */}
      {isCartOpen && (
        <div className="cart-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2>Seu Carrinho</h2>
              <button className="close-cart" onClick={() => setIsCartOpen(false)}>✕</button>
            </div>
            
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
                    onClick={handleInfinitePayCheckout}
                    disabled={isCheckoutLoading}
                    className="checkout-btn-infinitepay"
                  >
                    {isCheckoutLoading ? (
                      <span className="spinner-small"></span>
                    ) : (
                      <>💳 Pagar Agora (Cartão/Pix)</>
                    )}
                  </button>
                  <button className="checkout-btn" onClick={handleCheckout}>
                    Enviar Pedido por WhatsApp
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} May Cosméticos. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
