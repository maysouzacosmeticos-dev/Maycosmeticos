import { useState } from 'react';
import { PackageSearch, Plus, Edit2, Trash2, Settings, Smartphone } from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface Props {
  productsList: any[];
  pixKey: string;
  setPixKey: (val: string) => void;
  onUpdate: () => void;
  migrateLocalProducts: () => void;
}

export function AdminProducts({ productsList, pixKey, setPixKey, onUpdate, migrateLocalProducts }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newBarcode, setNewBarcode] = useState('');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setNewName(''); setNewPrice(''); setNewStock('10'); setNewBarcode(''); setNewImage(null); setEditingId(null); setIsAdding(false);
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setNewName(product.name);
    setNewPrice(product.price.toString());
    setNewStock(product.stock ? product.stock.toString() : '0');
    setNewBarcode(product.barcode || '');
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Certeza que deseja apagar este produto?")) {
      await deleteDoc(doc(db, "products", id));
      onUpdate();
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let imageUrl = "";
      if (newImage) {
        // Upload logic here (keeping it simple for the split, using the existing approach from Admin.tsx)
        const formData = new FormData();
        formData.append("image", newImage);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=9a39f45b0c7c056e4ff6d0cd696c1681`, { method: "POST", body: formData });
        const data = await res.json();
        imageUrl = data.data.url;
      }

      const productData: any = {
        name: newName,
        price: parseFloat(newPrice),
        stock: parseInt(newStock) || 0,
        barcode: newBarcode
      };

      if (imageUrl) productData.image = imageUrl;

      if (editingId) {
        await setDoc(doc(db, "products", editingId), productData, { merge: true });
        alert("Produto atualizado!");
      } else {
        if (!imageUrl) productData.image = "https://via.placeholder.com/150?text=Sem+Foto";
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

  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "store"), { pixKey }, { merge: true });
      alert("Configurações salvas!");
    } catch(e) { alert("Erro ao salvar."); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Settings Panel */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Settings size={20}/> Configurações da Loja</h3>
        <div>
          <label style={{ fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}><Smartphone size={16}/> Chave Pix (Para QR Code Automático)</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              value={pixKey} 
              onChange={e => setPixKey(e.target.value)} 
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' }} 
              placeholder="Ex: CNPJ, Email ou Celular" 
            />
            <button onClick={handleSaveSettings} style={{ background: 'var(--color-gold)', color: 'white', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Salvar</button>
          </div>
        </div>
      </div>

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
                <label style={{ fontWeight: 'bold' }}>Preço (R$):</label>
                <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold' }}>Estoque:</label>
                <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} style={inputStyle} />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><PackageSearch /> Estoque ({productsList.length})</h2>
          <button onClick={() => setIsAdding(true)} style={{ background: 'var(--color-gold)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Plus size={18} /> Novo Produto
          </button>
        </div>
      )}

      {/* Product List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
        {productsList.map(product => (
          <div key={product.id} style={{ background: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow-card)', padding: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src={product.image} alt={product.name} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px' }} />
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>{product.name}</h4>
              <p style={{ margin: 0, color: 'var(--color-gold-dark)', fontWeight: 'bold', fontSize: '1.1rem' }}>R$ {product.price.toFixed(2)}</p>
              <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>Estoque: {product.stock || 0} un.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => handleEdit(product)} style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><Edit2 size={16}/></button>
              <button onClick={() => handleDelete(product.id)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginTop: '5px', fontSize: '15px', boxSizing: 'border-box' as const };
