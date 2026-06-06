import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { Product } from './data/products';
import { products as localProducts } from './data/products';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [visitsCount, setVisitsCount] = useState<number>(0);
  
  // Form states
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchProducts();
        fetchVisits();
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
    setNewImage(null); // Force user to pick a new image only if they want to change it
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewName('');
    setNewPrice('');
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
          price: parseFloat(newPrice)
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
          description: ""
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
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold-dark)' }}>Painel Admin - May</h1>
        <button onClick={handleLogout} style={logoutBtnStyle}>Sair</button>
      </div>

      <div style={{ background: 'var(--gradient-gold)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-glass)', marginBottom: '20px', color: 'white', textAlign: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'normal' }}>Clientes que visitaram a vitrine</h3>
        <p style={{ margin: '10px 0 0 0', fontSize: '2.5rem', fontWeight: 'bold' }}>{visitsCount}</p>
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
    </div>
  );
}

const btnStyle = { padding: '12px 20px', background: 'var(--color-gold)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', width: '100%' };
const logoutBtnStyle = { padding: '8px 16px', background: '#eee', border: 'none', borderRadius: '8px', cursor: 'pointer' };
const deleteBtnStyle = { padding: '8px 12px', background: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '5px', fontSize: '16px' };
const labelStyle = { fontWeight: 'bold', color: 'var(--color-text-main)' };
