import { useState } from 'react';
import { PackageSearch, Plus, Trash2, Edit2, Search, Star } from 'lucide-react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface Props {
  productsList: any[];
  onUpdate: () => void;
  migrateLocalProducts: () => void;
}

export function AdminProducts({ productsList, onUpdate, migrateLocalProducts }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCost, setNewCost] = useState('0');
  const [newStock, setNewStock] = useState('10');
  const [newBarcode, setNewBarcode] = useState('');
  const [isPromotion, setIsPromotion] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [promotionalPrice, setPromotionalPrice] = useState('');
  const [promoPaymentMethod, setPromoPaymentMethod] = useState<'all' | 'pix_only'>('all');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setNewName(''); setNewPrice(''); setNewCost('0'); setNewStock('10'); setNewBarcode(''); setIsPromotion(false); setIsFeatured(false); setPromotionalPrice(''); setPromoPaymentMethod('all'); setNewImage(null); setEditingId(null); setIsAdding(false);
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setNewName(product.name);
    setNewPrice(product.price.toString());
    setNewCost(product.cost ? product.cost.toString() : '0');
    setNewStock(product.stock !== undefined ? product.stock.toString() : '0');
    setNewBarcode(product.barcode || '');
    setIsPromotion(product.isPromotion || false);
    setIsFeatured(product.isFeatured || false);
    setPromotionalPrice(product.promotionalPrice ? product.promotionalPrice.toString() : '');
    setPromoPaymentMethod(product.promoPaymentMethod || 'all');
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Certeza que deseja apagar este produto?")) {
      await deleteDoc(doc(db, "products", id));
      onUpdate();
    }
  };

  const handleQuickStockUpdate = async (id: string, newStockVal: number) => {
    const validStock = Math.max(0, newStockVal);
    try {
      await updateDoc(doc(db, "products", id), { stock: validStock });
      onUpdate();
    } catch (error) {
      console.error("Erro ao atualizar estoque:", error);
      alert("Erro ao atualizar estoque no banco de dados.");
    }
  };

  const handleToggleFeatured = async (product: any) => {
    const newFeatured = !product.isFeatured;
    try {
      await updateDoc(doc(db, "products", product.id), { isFeatured: newFeatured });
      onUpdate();
    } catch (error) {
      console.error("Erro ao alterar destaque:", error);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let imageUrl = "";
      if (newImage) {
        const formData = new FormData();
        formData.append("image", newImage);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=9a39f45b0c7c056e4ff6d0cd696c1681`, { method: "POST", body: formData });
        const data = await res.json();
        imageUrl = data.data.url;
      }

      const productData: any = {
        name: newName,
        price: parseFloat(newPrice),
        cost: parseFloat(newCost) || 0,
        isPromotion: isPromotion,
        isFeatured: isFeatured,
        promotionalPrice: isPromotion ? parseFloat(promotionalPrice) : null,
        promoPaymentMethod: isPromotion ? promoPaymentMethod : 'all',
        stock: parseInt(newStock) || 0,
        barcode: newBarcode
      };

      if (imageUrl) productData.image = imageUrl;

      if (editingId) {
        await setDoc(doc(db, "products", editingId), productData, { merge: true });
        alert("Produto atualizado!");
      } else {
        if (!imageUrl) productData.image = "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80";
        const newId = newBarcode || Date.now().toString();
        await setDoc(doc(db, "products", newId), productData);
        alert("Produto adicionado!");
      }

      resetForm();
      onUpdate();
    } catch (e) {
      alert("Erro ao salvar produto.");
    } finally {
      setUploading(false);
    }
  };

  const filteredProducts = productsList.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {productsList.length === 0 && (
        <button onClick={migrateLocalProducts} style={{ padding: '15px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow-card)' }}>
          Mágica: Copiar 38 Produtos Iniciais para o Banco de Dados
        </button>
      )}

      {/* Add / Edit Form */}
      {isAdding ? (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', border: '2px solid var(--color-gold)' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>{editingId ? "✏️ Editar Produto" : "+ Adicionar Novo Produto"}</h3>
          <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ fontWeight: 'bold' }}>Nome do Produto:</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold' }}>Custo (R$):</label>
                <input type="number" step="0.01" value={newCost} onChange={e => setNewCost(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold' }}>Preço Venda (R$):</label>
                <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold' }}>Estoque:</label>
                <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px', background: '#fff8e1', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ffe082', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="featuredToggle" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                <label htmlFor="featuredToggle" style={{ fontWeight: 'bold', color: '#b45309', cursor: 'pointer', margin: 0 }}>⭐ Destacar Produto no Topo da Loja?</label>
              </div>

              <div style={{ flex: 1, minWidth: '220px', background: '#fff3e0', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ffe0b2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isPromotion ? '15px' : '0' }}>
                  <input type="checkbox" id="promoToggle" checked={isPromotion} onChange={e => setIsPromotion(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  <label htmlFor="promoToggle" style={{ fontWeight: 'bold', color: '#e65100', cursor: 'pointer', margin: 0 }}>🔥 Ativar Promoção / Oferta Relâmpago?</label>
                </div>
                
                {isPromotion && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                    <div>
                      <label style={{ fontWeight: 'bold', color: '#e65100', display: 'block', marginBottom: '5px' }}>Preço Promocional (R$):</label>
                      <input type="number" step="0.01" value={promotionalPrice} onChange={e => setPromotionalPrice(e.target.value)} required style={{ ...inputStyle, borderColor: '#ffcc80' }} />
                    </div>
                    <div>
                      <label style={{ fontWeight: 'bold', color: '#e65100', display: 'block', marginBottom: '5px' }}>Forma de Pagamento da Oferta:</label>
                      <select value={promoPaymentMethod} onChange={e => setPromoPaymentMethod(e.target.value as any)} style={{ ...inputStyle, borderColor: '#ffcc80' }}>
                        <option value="all">Aceitar todos os métodos (Cartão, Pix, Whats)</option>
                        <option value="pix_only">Apenas PIX (Bloquear Cartão)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 'bold' }}>Código de Barras (Opcional):</label>
              <input type="text" value={newBarcode} onChange={e => setNewBarcode(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontWeight: 'bold' }}>{editingId ? "Nova Foto (Opcional):" : "Foto do Produto:"}</label>
              <input type="file" accept="image/*" onChange={e => setNewImage(e.target.files ? e.target.files[0] : null)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={resetForm} style={{ padding: '12px', background: '#eee', border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 1, fontWeight: 'bold', color: '#555' }}>Cancelar</button>
              <button type="submit" disabled={uploading} style={{ padding: '12px', background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 2, fontWeight: 'bold' }}>
                {uploading ? 'Enviando...' : 'Salvar Produto'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><PackageSearch /> Estoque ({productsList.length})</h2>
            <button onClick={() => setIsAdding(true)} style={{ background: 'var(--color-gold)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Plus size={18} /> Novo Produto
            </button>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input
              type="text"
              placeholder="Buscar produto por nome ou código de barras..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '38px', marginTop: 0 }}
            />
          </div>
        </div>
      )}

      {/* Product List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {filteredProducts.map(product => (
          <div key={product.id} style={{ background: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow-card)', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img 
              src={product.image || "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80"} 
              alt={product.name} 
              style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                const fallback = "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80";
                if (target.src !== fallback) {
                  target.src = fallback;
                }
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', wordBreak: 'break-word' }}>
                {product.name}
                {product.isFeatured && <span style={{ background: '#fff8e1', color: '#b45309', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 'bold', border: '1px solid #fde68a' }}>⭐ DESTAQUE</span>}
                {product.isPromotion && <span style={{ background: '#ffebee', color: '#c62828', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 'bold' }}>OFERTA</span>}
              </h4>
              
              {product.isPromotion ? (
                <div>
                  <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.85rem', marginRight: '6px' }}>R$ {product.price.toFixed(2)}</span>
                  <span style={{ color: '#c62828', fontWeight: 'bold', fontSize: '1.1rem' }}>R$ {product.promotionalPrice?.toFixed(2)}</span>
                </div>
              ) : (
                <p style={{ margin: 0, color: 'var(--color-gold-dark)', fontWeight: 'bold', fontSize: '1rem' }}>R$ {product.price.toFixed(2)}</p>
              )}
              
              {product.cost > 0 && (
                <div style={{ background: '#f5f7fa', padding: '4px 6px', borderRadius: '6px', marginTop: '4px', fontSize: '0.75rem' }}>
                  <span style={{ color: '#666' }}>Custo: R$ {product.cost.toFixed(2)}</span><br/>
                  <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>
                    Lucro: R$ {(product.price - product.cost).toFixed(2)} ({Math.round(((product.price - product.cost) / product.price) * 100)}%)
                  </span>
                </div>
              )}
              
              {/* Quick stock controller */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>Estoque:</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <button
                    type="button"
                    onClick={() => handleQuickStockUpdate(product.id, (product.stock || 0) - 1)}
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '15px' }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={product.stock ?? 0}
                    onChange={(e) => handleQuickStockUpdate(product.id, parseInt(e.target.value) || 0)}
                    style={{ width: '48px', textAlign: 'center', padding: '4px 2px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.85rem', fontWeight: 'bold' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickStockUpdate(product.id, (product.stock || 0) + 1)}
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '15px' }}
                  >
                    +
                  </button>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>un.</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => handleToggleFeatured(product)} title={product.isFeatured ? "Remover dos Destaques" : "Marcar como Destaque no Topo da Loja"} style={{ background: product.isFeatured ? '#fff8e1' : '#f5f5f5', color: product.isFeatured ? '#f59e0b' : '#999', border: '1px solid ' + (product.isFeatured ? '#f59e0b' : '#ddd'), padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                <Star size={16} fill={product.isFeatured ? '#f59e0b' : 'none'} />
              </button>
              <button onClick={() => handleEdit(product)} title="Editar produto completo" style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><Edit2 size={16}/></button>
              <button onClick={() => handleDelete(product.id)} title="Excluir produto" style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px', fontSize: '0.9rem', boxSizing: 'border-box' as const };
