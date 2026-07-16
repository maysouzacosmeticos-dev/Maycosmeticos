import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { db, auth } from './firebase';
import { BottomNav } from './components/BottomNav';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { Product } from './data/products';
import { products as localProducts } from './data/products';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [visitsCount, setVisitsCount] = useState<number>(0);
  
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [pixKey, setPixKey] = useState('');
  const [activeTab, setActiveTab] = useState<'produtos' | 'relatorios'>('produtos');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchProducts();
        fetchVisits();
        fetchSalesAndSettings();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchVisits = async () => {
    try {
      const docSnap = await getDoc(doc(db, "analytics", "visits"));
      if (docSnap.exists()) {
        setVisitsCount(docSnap.data().count || 0);
      }
    } catch (error) {
      console.error("Erro ao buscar visitas:", error);
    }
  };

  const fetchSalesAndSettings = async () => {
    try {
      const salesSnap = await getDocs(collection(db, "sales"));
      const salesData: any[] = [];
      salesSnap.forEach(d => salesData.push({ id: d.id, ...d.data() }));
      setSales(salesData.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())); // sort newest first

      const custSnap = await getDocs(collection(db, "customers"));
      const custData: any[] = [];
      custSnap.forEach(d => custData.push({ id: d.id, ...d.data() }));
      setCustomers(custData.sort((a,b) => (b.totalGasto || 0) - (a.totalGasto || 0))); // sort by total spent

      const settingsSnap = await getDoc(doc(db, "settings", "store"));
      if (settingsSnap.exists()) {
        setPixKey(settingsSnap.data().pixKey || '');
      }
    } catch(e) {}
  };

  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const items: Product[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProductsList(items);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setNewName(product.name);
    setNewPrice(product.price.toString());
    setNewBarcode(product.barcode || '');
    setNewStock(product.stock !== undefined ? product.stock.toString() : '');
    setNewImage(null); // Force user to pick a new image only if they want to change it
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewName('');
    setNewPrice('');
    setNewBarcode('');
    setNewStock('');
    setNewImage(null);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPrice) {
      alert("Por favor, preencha nome e preço.");
      return;
    }

    if (!editingId && !newImage) {
      alert("Para um novo produto, a foto é obrigatória.");
      return;
    }

    setUploading(true);
    try {
      let imageUrl = "";

      if (newImage) {
        const formData = new FormData();
        formData.append('image', newImage);
        
        const imgbbApiKey = "9a39f45b0c7c056e4ff6d0cd696c1681"; 
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        if (!data.success) throw new Error("Falha no upload");
        imageUrl = data.data.url;
      }

      if (editingId) {
        // Update existing product
        const productRef = doc(db, "products", editingId);
        const updates: any = {
          name: newName,
          price: parseFloat(newPrice),
          barcode: newBarcode,
          stock: newStock === '' ? 0 : parseInt(newStock)
        };
        if (imageUrl) updates.image = imageUrl; // Only update image if a new one was uploaded
        
        await updateDoc(productRef, updates);
        alert("Produto atualizado com sucesso!");
      } else {
        // Add new product
        await addDoc(collection(db, "products"), {
          name: newName,
          price: parseFloat(newPrice),
          image: imageUrl,
          description: "",
          barcode: newBarcode,
          stock: newStock === '' ? 0 : parseInt(newStock)
        });
        alert("Produto adicionado com sucesso!");
      }

      cancelEdit();
      fetchProducts();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      alert("Erro ao salvar produto. Verifique as configurações.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja apagar este produto?")) {
      try {
        await deleteDoc(doc(db, "products", id));
        fetchProducts();
      } catch (error) {
        console.error("Erro ao deletar:", error);
        alert("Erro ao remover produto.");
      }
    }
  };

  const migrateLocalProducts = async () => {
    if (window.confirm("Isso vai copiar todos os 38 produtos locais para o banco de dados. Continuar?")) {
      setUploading(true);
      try {
        for (const p of localProducts) {
          await addDoc(collection(db, "products"), {
            name: p.name,
            price: p.price,
            image: p.image,
            description: p.description
          });
        }
        alert("Migração concluída!");
        fetchProducts();
      } catch (e) {
        alert("Erro na migração.");
      } finally {
        setUploading(false);
      }
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Carregando Painel...</div>;

  if (!user) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <h2>Acesso Restrito</h2>
        <p>Você precisa estar logado para acessar o painel administrativo.</p>
        <button onClick={() => window.location.href = '/login'} style={btnStyle}>Ir para Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'var(--font-body)', paddingBottom: '100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold-dark)' }}>Painel Admin - May</h1>
      </div>

      {/* Header Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #ddd', background: '#fff', position: 'sticky', top: 0, zIndex: 9 }}>
        <button 
          onClick={() => setActiveTab('produtos')} 
          style={{ flex: 1, padding: '15px', background: 'none', border: 'none', borderBottom: activeTab === 'produtos' ? '3px solid var(--color-gold)' : 'none', fontWeight: 'bold', color: activeTab === 'produtos' ? 'var(--color-gold-dark)' : '#777', cursor: 'pointer' }}
        >
          📦 Produtos
        </button>
        <button 
          onClick={() => setActiveTab('relatorios')} 
          style={{ flex: 1, padding: '15px', background: 'none', border: 'none', borderBottom: activeTab === 'relatorios' ? '3px solid var(--color-gold)' : 'none', fontWeight: 'bold', color: activeTab === 'relatorios' ? 'var(--color-gold-dark)' : '#777', cursor: 'pointer' }}
        >
          📊 Relatórios & CRM
        </button>
      </div>

      <div style={{ padding: '20px' }}>
      
      {activeTab === 'produtos' ? (
        <>
          <div style={{ background: 'var(--gradient-gold)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-glass)', marginBottom: '20px', color: 'white', textAlign: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'normal' }}>Clientes que visitaram a vitrine</h3>
            <p style={{ margin: '10px 0 0 0', fontSize: '2.5rem', fontWeight: 'bold' }}>{visitsCount}</p>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', marginBottom: '30px' }}>
            <h3>Configurações da Loja</h3>
            <div>
              <label style={labelStyle}>Chave Pix (Para QR Code Automático):</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" value={pixKey} onChange={e => setPixKey(e.target.value)} style={inputStyle} placeholder="Ex: CNPJ, Email ou Celular" />
                <button onClick={async () => {
                  try {
                    await setDoc(doc(db, "settings", "store"), { pixKey }, { merge: true });
                    alert("Chave Pix salva!");
                  } catch(e) { alert("Erro ao salvar."); }
                }} style={{...btnStyle, width: 'auto'}}>Salvar</button>
              </div>
            </div>
          </div>

          {productsList.length === 0 && (
            <button onClick={migrateLocalProducts} style={{...btnStyle, marginBottom: 20, background: '#ff9800'}}>
              Mágica: Copiar 38 Produtos Iniciais para o Banco de Dados
            </button>
          )}

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', marginBottom: '30px' }}>
            <h3>{editingId ? "✏️ Editar Produto" : "+ Adicionar Novo Produto"}</h3>
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
              <div>
                <label style={labelStyle}>Nome do Produto:</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required style={inputStyle} placeholder="Ex: Batom Matte Vermelho" />
              </div>
              <div>
                <label style={labelStyle}>Preço (R$):</label>
                <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} required style={inputStyle} placeholder="Ex: 29.90" />
              </div>
              <div>
                <label style={labelStyle}>Código de Barras (Opcional):</label>
                <input type="text" value={newBarcode} onChange={e => setNewBarcode(e.target.value)} style={inputStyle} placeholder="Ex: 7891234567890" />
              </div>
              <div>
                <label style={labelStyle}>Quantidade em Estoque:</label>
                <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} style={inputStyle} placeholder="Ex: 10" />
              </div>
              <div>
                <label style={labelStyle}>{editingId ? "Nova Foto (Deixe em branco para manter a mesma):" : "Foto do Produto:"}</label>
                <input type="file" accept="image/*" onChange={e => setNewImage(e.target.files ? e.target.files[0] : null)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {editingId && (
                  <button type="button" onClick={cancelEdit} style={{...btnStyle, background: '#999', flex: 1}}>Cancelar</button>
                )}
                <button type="submit" disabled={uploading} style={{...btnStyle, opacity: uploading ? 0.7 : 1, flex: 2}}>
                  {uploading ? 'Enviando...' : (editingId ? 'Salvar Alterações' : 'Salvar Produto')}
                </button>
              </div>
            </form>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
            <h3>Produtos Cadastrados ({productsList.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              {productsList.map(product => (
                <div key={product.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', border: '1px solid #eee', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={product.image} alt={product.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                    <div>
                      <h4 style={{ margin: 0 }}>{product.name}</h4>
                      <p style={{ margin: 0, color: 'var(--color-gold-dark)', fontWeight: 'bold' }}>R$ {product.price.toFixed(2)}</p>
                      <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>Estoque: {product.stock || 0} un.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleEdit(product)} style={{...deleteBtnStyle, background: '#2196F3'}}>Editar</button>
                    <button onClick={() => handleDelete(product.id)} style={deleteBtnStyle}>Apagar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ABA DE RELATÓRIOS E CRM */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
            <h3>Fechamento de Caixa (Hoje)</h3>
            <div style={{ display: 'flex', gap: '15px', marginTop: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px', background: '#e3f2fd', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#1976d2', fontWeight: 'bold' }}>Cartão / Online</p>
                <h2 style={{ margin: '5px 0 0 0', color: '#1565c0' }}>
                  R$ {sales.filter(s => new Date(s.date).toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR') && (s.method === 'Cartão' || s.method === 'InfinitePay' || s.method === 'Online')).reduce((a, b) => a + (b.amountPaid || b.total), 0).toFixed(2)}
                </h2>
              </div>
              <div style={{ flex: '1 1 150px', background: '#e0f2f1', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#00897b', fontWeight: 'bold' }}>Pix</p>
                <h2 style={{ margin: '5px 0 0 0', color: '#00695c' }}>
                  R$ {sales.filter(s => new Date(s.date).toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR') && s.method === 'Pix').reduce((a, b) => a + (b.amountPaid || b.total), 0).toFixed(2)}
                </h2>
              </div>
              <div style={{ flex: '1 1 150px', background: '#fff3e0', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#f57c00', fontWeight: 'bold' }}>Dinheiro</p>
                <h2 style={{ margin: '5px 0 0 0', color: '#ef6c00' }}>
                  R$ {sales.filter(s => new Date(s.date).toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR') && s.method === 'Dinheiro').reduce((a, b) => a + (b.amountPaid || b.total), 0).toFixed(2)}
                </h2>
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', borderLeft: '5px solid #ff9800' }}>
            <h3>🚨 Pedidos Online (Aguardando Pagamento)</h3>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>Estes pedidos ainda não descontaram do estoque.</p>
            <div style={{ marginTop: '15px' }}>
              {sales.filter(s => s.status === 'pendente').length === 0 ? <p>Nenhum pedido pendente no momento.</p> : sales.filter(s => s.status === 'pendente').map(sale => (
                <div key={sale.id} style={{ padding: '15px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '10px', background: '#fff8e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0' }}>{sale.customerName || 'Cliente Online'}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>📱 {sale.customerPhone} | 🏠 {sale.customerAddress}</p>
                      <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Total: R$ {sale.total.toFixed(2)} ({sale.method})</p>
                    </div>
                    <button onClick={async () => {
                      if (window.confirm('Confirmar recebimento deste pedido? O estoque será debitado agora.')) {
                        try {
                          await updateDoc(doc(db, "sales", sale.id), { status: 'pago', amountPaid: sale.total });
                          for (const item of sale.items) {
                            await updateDoc(doc(db, "products", item.id), { stock: increment(-item.quantity) });
                          }
                          fetchSalesAndSettings();
                          alert('Venda confirmada e estoque atualizado!');
                        } catch (e) { alert('Erro ao confirmar.'); }
                      }
                    }} style={{ background: '#4CAF50', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                      💰 Confirmar Pagamento
                    </button>
                  </div>
                  <details style={{ marginTop: '10px', fontSize: '0.9rem' }}>
                    <summary style={{ cursor: 'pointer', color: '#555' }}>Ver Produtos ({sale.items?.length})</summary>
                    <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
                      {sale.items?.map((item: any, i: number) => (
                        <li key={i}>{item.quantity}x {item.name} - R$ {(item.quantity * item.price).toFixed(2)}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', borderLeft: '5px solid #f44336' }}>
            <h3>⚠️ Inadimplentes (Fiado / Parcial)</h3>
            <div style={{ marginTop: '15px' }}>
              {customers.filter(c => (c.totalDivida || 0) > 0).length === 0 ? <p>Ninguém devendo! Ótimo! 🎉</p> : customers.filter(c => (c.totalDivida || 0) > 0).map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '10px', background: '#ffebee' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0' }}>{c.name}</h4>
                    <p style={{ margin: 0, color: '#d32f2f', fontWeight: 'bold' }}>Dívida: R$ {(c.totalDivida || 0).toFixed(2)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {c.phone && (
                      <a href={`https://wa.me/${c.phone.replace(/\D/g,'')}?text=Olá ${c.name.split(' ')[0]}, vi aqui no meu sistema que ficou um valor pendente de R$ ${(c.totalDivida||0).toFixed(2)}. Podemos acertar hoje?`} target="_blank" rel="noreferrer" style={{ background: '#25D366', color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: '4px', fontSize: '0.9rem' }}>Cobrar</a>
                    )}
                    <button onClick={async () => {
                      if(window.confirm(`Quitar dívida de R$ ${(c.totalDivida).toFixed(2)} de ${c.name}?`)) {
                        await updateDoc(doc(db, "customers", c.id), { totalDivida: 0, totalGasto: increment(c.totalDivida) });
                        fetchSalesAndSettings();
                      }
                    }} style={{ background: '#4CAF50', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', borderLeft: '5px solid #2196F3' }}>
            <h3>⭐ Base de Clientes (CRM)</h3>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>Envie promoções e brindes para seus melhores clientes.</p>
            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {customers.map(c => (
                <div key={c.id} style={{ padding: '10px', border: '1px solid #eee', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h4 style={{ margin: 0 }}>{c.name}</h4>
                    <span style={{ color: 'var(--color-gold-dark)', fontWeight: 'bold' }}>Comprado: R$ {(c.totalGasto || 0).toFixed(2)}</span>
                  </div>
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem' }}>{c.phone ? `📱 ${c.phone}` : ''} {c.address ? `| 🏠 ${c.address}` : ''}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', borderLeft: '5px solid #9C27B0' }}>
            <h3>📋 Histórico de Vendas</h3>
            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
              {sales.slice(0, 100).map(sale => (
                <div key={sale.id} style={{ padding: '10px', border: '1px solid #eee', borderRadius: '8px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{new Date(sale.date).toLocaleDateString('pt-BR')} - {sale.customerName || 'Cliente'}</strong>
                    <span>R$ {sale.total.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', color: '#666' }}>
                    <span>{sale.method} ({sale.source})</span>
                    <span style={{ 
                      background: sale.status === 'pendente' ? '#ffe0b2' : sale.status === 'parcial' ? '#ffcdd2' : '#c8e6c9', 
                      padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' 
                    }}>
                      {sale.status?.toUpperCase() || 'PAGO'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '30px', paddingBottom: '30px' }}>
        <button onClick={handleLogout} style={logoutBtnStyle}>Sair do Sistema</button>
      </div>
      
      <BottomNav />
    </div>
  );
}

const btnStyle = { padding: '12px 20px', background: 'var(--color-gold)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', width: '100%' };
const logoutBtnStyle = { padding: '8px 16px', background: '#eee', border: 'none', borderRadius: '8px', cursor: 'pointer' };
const deleteBtnStyle = { padding: '8px 12px', background: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '5px', fontSize: '16px' };
const labelStyle = { fontWeight: 'bold', color: 'var(--color-text-main)' };
