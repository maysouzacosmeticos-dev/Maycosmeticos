import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, increment } from 'firebase/firestore';
import { db, auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { Product } from './data/products';
import { Html5Qrcode } from 'html5-qrcode';
import { generatePixPayload } from './utils/generatePix';
import { Receipt } from './components/Receipt';
import { shareReceiptToWhatsApp } from './utils/generateReceipt';
import { Search, Camera, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BottomNav } from './components/BottomNav';

export default function PDV() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Pix' | 'Cartão' | 'Dinheiro'>('Pix');
  const [installments, setInstallments] = useState(1);
  const [partialPayment, setPartialPayment] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Authentication Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = '/login';
      }
    });
    return () => unsubscribe();
  }, []);
  const [pixKey, setPixKey] = useState('');
  const [pixPayload, setPixPayload] = useState('');
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchSettings();
    fetchCustomers();
  }, []);

  const fetchSettings = async () => {
    try {
      const docSnap = await getDoc(doc(db, "settings", "store"));
      if (docSnap.exists()) setPixKey(docSnap.data().pixKey || '');
    } catch(e) {}
  };

  const fetchCustomers = async () => {
    try {
      const snap = await getDocs(collection(db, "customers"));
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setCustomersList(items);
    } catch(e) {}
  };

  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const items: Product[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(items);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  };

  // Keyboard barcode scanner listener (listens for rapid typing ending in Enter)
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field (except body)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentTime = new Date().getTime();
      
      if (currentTime - lastKeyTime.current > 50) {
        barcodeBuffer.current = '';
      }
      
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 3) {
          handleScan(barcodeBuffer.current);
          barcodeBuffer.current = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
      
      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  const handleScan = (barcode: string) => {
    const matchedProduct = products.find(p => p.barcode === barcode);
    if (matchedProduct) {
      addToCart(matchedProduct);
      alert(`Adicionado: ${matchedProduct.name}`);
    } else {
      alert("Produto não encontrado pelo código: " + barcode);
    }
  };

  const startCameraScanner = () => {
    setIsScannerOpen(true);
    setTimeout(() => {
      try {
        scannerRef.current = new Html5Qrcode("reader");
        scannerRef.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText: string) => {
            handleScan(decodedText);
            stopCameraScanner();
          },
          () => {} // ignore frame errors
        ).catch((err: any) => {
          console.error("Camera error:", err);
          alert("Erro ao abrir a câmera. Verifique as permissões do navegador.");
          setIsScannerOpen(false);
        });
      } catch (e) {
        console.error("Setup error:", e);
      }
    }, 300);
  };

  const stopCameraScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        }).catch((e: any) => console.log("Failed to stop scanner", e));
      } catch (e) {
        scannerRef.current?.clear();
      }
    }
    setIsScannerOpen(false);
  };

  const addToCart = (product: Product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      alert("Este produto está esgotado no momento.");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (product.stock !== undefined && existing.quantity >= product.stock) {
          alert(`Temos apenas ${product.stock} unidades em estoque.`);
          return prev;
        }
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearchTerm('');
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const discountVal = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountVal);

  useEffect(() => {
    if (paymentMethod === 'Pix' && pixKey && total > 0) {
      try {
        const payload = generatePixPayload(pixKey, total, 'MayCosmeticos', 'Brasil');
        setPixPayload(payload);
      } catch (e) {
        console.error("Erro ao gerar Pix", e);
        setPixPayload('');
      }
    } else {
      setPixPayload('');
    }
  }, [total, pixKey, paymentMethod]);

  const filteredProducts = searchTerm.trim() 
    ? products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode === searchTerm)
    : [];

  const handleFinalize = async () => {
    if (cart.length === 0) return;

    try {
      const amountPaid = partialPayment ? parseFloat(partialPayment) : total;
      const debt = Math.max(0, total - amountPaid);
      const status = debt > 0 ? 'parcial' : 'pago';
      let customerId = "";

      // Salvar Cliente VIP
      if (customerName.trim()) {
        const existing = customersList.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase());
        if (existing) {
          customerId = existing.id;
          await updateDoc(doc(db, "customers", existing.id), { 
            totalGasto: increment(amountPaid),
            totalDivida: increment(debt),
            phone: customerPhone || existing.phone || '',
            address: customerAddress || existing.address || ''
          });
        } else {
          const newC = await addDoc(collection(db, "customers"), { 
            name: customerName.trim(), 
            totalGasto: amountPaid,
            totalDivida: debt,
            phone: customerPhone,
            address: customerAddress
          });
          customerId = newC.id;
        }
      }

      // Registrar Venda
      await addDoc(collection(db, "sales"), {
        date: new Date().toISOString(),
        items: cart.map(item => ({ id: item.product.id, name: item.product.name, price: item.product.price, quantity: item.quantity })),
        total: total,
        amountPaid: amountPaid,
        method: paymentMethod,
        source: 'PDV',
        status: status,
        customerName: customerName.trim(),
        customerId: customerId,
        customerPhone: customerPhone,
        customerAddress: customerAddress
      });

      // Baixa no Estoque
      for (const item of cart) {
        const productRef = doc(db, "products", item.product.id);
        await updateDoc(productRef, { stock: increment(-item.quantity) });
      }

    } catch (e) {
      console.error("Erro ao registrar venda:", e);
    }

    await shareReceiptToWhatsApp('receipt-container', customerName || 'Cliente');
    
    // Clear after success
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setPaymentMethod('Pix');
    setInstallments(1);
    setPartialPayment('');
    setDiscount('');
    setPixPayload('');
    fetchProducts();
  };

  return (
    <div style={{ fontFamily: 'var(--font-body)', background: '#fcfcfc', minHeight: '100vh', paddingBottom: '250px' }}>
      
      {/* Header */}
      <div style={{ background: 'var(--gradient-gold)', padding: '15px 20px', color: 'white', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '1.2rem' }}>PDV - May Cosméticos</h1>
      </div>

      <div style={{ padding: '15px' }}>
        
        {/* Customer Name */}
        <div style={{ marginBottom: '15px', position: 'relative' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold' }}>Nome do Cliente</label>
          <input 
            type="text" 
            value={customerName} 
            onChange={(e) => {
              setCustomerName(e.target.value);
              setShowCustomerDropdown(true);
            }} 
            onFocus={() => setShowCustomerDropdown(true)}
            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
            placeholder="Ex: Maria Clara"
            style={inputStyle}
          />
          {showCustomerDropdown && customerName && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '8px', zIndex: 100, maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
               {customersList.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).map(c => (
                 <div key={c.id} onClick={() => { 
                   setCustomerName(c.name); 
                   setCustomerPhone(c.phone || '');
                   setCustomerAddress(c.address || '');
                   setShowCustomerDropdown(false); 
                 }} style={{ padding: '10px 15px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                   {c.name} <span style={{ fontSize: '0.8rem', color: 'var(--color-gold-dark)' }}>(VIP)</span>
                 </div>
               ))}
            </div>
          )}
          
          {(customerName && !showCustomerDropdown) && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <input type="tel" placeholder="WhatsApp (Opcional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <input type="text" placeholder="Endereço (Opcional)" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
            </div>
          )}
        </div>

        {/* Search & Scan */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={20} color="#999" style={{ position: 'absolute', left: '10px', top: '12px' }} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar produto..."
              style={{ ...inputStyle, paddingLeft: '40px' }}
            />
          </div>
          <button onClick={isScannerOpen ? stopCameraScanner : startCameraScanner} style={{ background: 'var(--color-gold)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px' }}>
            <Camera size={24} />
          </button>
        </div>

        {/* Camera Scanner View */}
        {isScannerOpen && (
          <div style={{ background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '15px' }}>
            <div id="reader" style={{ width: '100%' }}></div>
            <button onClick={stopCameraScanner} style={{ width: '100%', padding: '10px', background: '#ff4d4f', color: 'white', border: 'none', fontWeight: 'bold' }}>Fechar Câmera</button>
          </div>
        )}

        {/* Search Results */}
        {searchTerm && filteredProducts.length > 0 && (
          <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {filteredProducts.map(product => (
              <div key={product.id} onClick={() => addToCart(product)} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 15px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                <span>{product.name}</span>
                <span style={{ fontWeight: 'bold', color: 'var(--color-gold-dark)' }}>R$ {product.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Cart Items */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#333', borderBottom: '2px solid var(--color-gold)', paddingBottom: '5px' }}>Itens da Venda</h3>
          {cart.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>Nenhum item adicionado.</p>
          ) : (
            cart.map(item => (
              <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <img src={item.product.image} style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover' }} />
                <div style={{ flex: 1, marginLeft: '12px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>{item.product.name}</h4>
                  <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-gold-dark)' }}>R$ {(item.product.price * item.quantity).toFixed(2)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: '20px', padding: '2px' }}>
                  <button onClick={() => updateQuantity(item.product.id, -1)} style={qtyBtnStyle}><Minus size={16} /></button>
                  <span style={{ margin: '0 10px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, 1)} style={qtyBtnStyle}><Plus size={16} /></button>
                </div>
                <button onClick={() => removeFromCart(item.product.id)} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', marginLeft: '10px', padding: '5px' }}>
                  <Trash2 size={20} />
                </button>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Sticky Bottom Actions */}
      <div style={{ position: 'fixed', bottom: '60px', left: 0, right: 0, background: 'white', padding: '15px', borderTop: '1px solid #ddd', boxShadow: '0 -4px 15px rgba(0,0,0,0.05)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', zIndex: 5 }}>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button onClick={() => setPaymentMethod('Pix')} style={{ ...chipStyle, background: paymentMethod === 'Pix' ? 'var(--color-gold)' : '#eee', color: paymentMethod === 'Pix' ? 'white' : '#333' }}><Smartphone size={16} /> Pix</button>
          <button onClick={() => setPaymentMethod('Cartão')} style={{ ...chipStyle, background: paymentMethod === 'Cartão' ? 'var(--color-gold)' : '#eee', color: paymentMethod === 'Cartão' ? 'white' : '#333' }}><CreditCard size={16} /> Cartão</button>
          <button onClick={() => setPaymentMethod('Dinheiro')} style={{ ...chipStyle, background: paymentMethod === 'Dinheiro' ? 'var(--color-gold)' : '#eee', color: paymentMethod === 'Dinheiro' ? 'white' : '#333' }}><Banknote size={16} /> Dinheiro</button>
        </div>

        {paymentMethod === 'Cartão' && (
          <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold', color: '#555' }}>Parcelas:</label>
            <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} style={{ ...inputStyle, width: 'auto', flex: 1, padding: '8px' }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                <option key={n} value={n}>{n}x</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
             <label style={{ display: 'block', fontSize: '0.8rem', color: '#777' }}>Desconto (R$)</label>
             <input type="number" placeholder="0.00" value={discount} onChange={e => setDiscount(e.target.value)} style={{ ...inputStyle, padding: '8px' }} />
          </div>
          <div style={{ flex: 1 }}>
             <label style={{ display: 'block', fontSize: '0.8rem', color: '#777' }}>Valor Pago (Parcial)</label>
             <input type="number" placeholder="Ex: 50.00" value={partialPayment} onChange={e => setPartialPayment(e.target.value)} style={{ ...inputStyle, padding: '8px' }} />
          </div>
        </div>

        <div style={{ textAlign: 'right', marginBottom: '15px' }}>
          <span style={{ display: 'block', fontSize: '0.9rem', color: '#555' }}>Subtotal: R$ {subtotal.toFixed(2)}</span>
          {discountVal > 0 && <span style={{ display: 'block', fontSize: '0.9rem', color: '#ef4444' }}>Desconto: - R$ {discountVal.toFixed(2)}</span>}
          <span style={{ display: 'block', fontSize: '0.9rem', color: '#555', marginTop: '5px' }}>Total a pagar</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-gold-dark)', lineHeight: 1 }}>R$ {total.toFixed(2)}</span>
        </div>

        {paymentMethod === 'Pix' && pixPayload && total > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '15px', borderRadius: '12px', marginBottom: '15px', textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#166534' }}>Escaneie para pagar com Pix</h4>
            <div style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '8px' }}>
              <QRCodeSVG value={pixPayload} size={150} />
            </div>
          </div>
        )}

        <button 
          onClick={handleFinalize} 
          disabled={cart.length === 0}
          style={{ width: '100%', background: cart.length > 0 ? '#22c55e' : '#ccc', color: 'white', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
        >
          Gerar e Enviar Extrato
        </button>
      </div>

      {/* Hidden Receipt Element for HTML2Canvas */}
      <Receipt 
        customerName={customerName} 
        items={cart.map(item => ({
          id: item.product.id,
          description: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          totalPrice: item.product.price * item.quantity
        }))} 
        date={new Date().toLocaleDateString('pt-BR')} 
        paymentMethod={paymentMethod}
        installments={installments}
        totalAmount={total}
        partialPayment={partialPayment}
        discount={discount}
      />
      <BottomNav />
    </div>
  );
}

const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', fontSize: '16px' };
const qtyBtnStyle = { background: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-gold-dark)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const chipStyle = { flex: 1, border: 'none', padding: '10px 5px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontSize: '0.9rem' };
