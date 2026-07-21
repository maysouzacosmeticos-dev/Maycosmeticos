import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { BottomNav } from './components/BottomNav';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { Product } from './data/products';
import { products as localProducts } from './data/products';

import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminSales } from './components/admin/AdminSales';
import { AdminCRM } from './components/admin/AdminCRM';
import { AdminProducts } from './components/admin/AdminProducts';
import { LayoutDashboard, Users, Package, PackageSearch, LogOut } from 'lucide-react';

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [visitsCount, setVisitsCount] = useState<number>(0);
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [pixKey, setPixKey] = useState('');
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vendas' | 'crm' | 'produtos'>('dashboard');

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
    } catch (error) {}
  };

  const fetchSalesAndSettings = async () => {
    try {
      const salesSnap = await getDocs(collection(db, "sales"));
      const salesData: any[] = [];
      salesSnap.forEach(d => salesData.push({ id: d.id, ...d.data() }));
      setSales(salesData.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      const custSnap = await getDocs(collection(db, "customers"));
      const custData: any[] = [];
      custSnap.forEach(d => custData.push({ id: d.id, ...d.data() }));
      setCustomers(custData.sort((a,b) => (b.totalGasto || 0) - (a.totalGasto || 0)));

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
    } catch (error) {}
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const migrateLocalProducts = async () => {
    if (window.confirm("Isso vai copiar todos os 38 produtos locais para o banco de dados. Continuar?")) {
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
      }
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Carregando Painel...</div>;

  if (!user) {
    return (
      <div style={{ padding: 20, textAlign: 'center', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h2>Acesso Restrito</h2>
        <p>Você precisa estar logado para acessar o painel de gestão.</p>
        <button onClick={() => window.location.href = '/login'} style={{ padding: '12px 20px', background: 'var(--color-gold)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px' }}>Ir para Login</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa', fontFamily: 'var(--font-body)' }}>
      
      {/* Sidebar Nav (Desktop) */}
      <div className="admin-sidebar" style={{ width: '250px', background: '#fff', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', padding: '20px 0', position: 'fixed', height: '100vh', overflowY: 'auto' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold-dark)', textAlign: 'center', margin: '0 0 30px 0', fontSize: '1.5rem' }}>MAY CRM</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '0 15px', flex: 1 }}>
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
          <NavButton active={activeTab === 'vendas'} onClick={() => setActiveTab('vendas')} icon={<Package size={20}/>} label="Vendas" />
          <NavButton active={activeTab === 'crm'} onClick={() => setActiveTab('crm')} icon={<Users size={20}/>} label="Clientes" />
          <NavButton active={activeTab === 'produtos'} onClick={() => setActiveTab('produtos')} icon={<PackageSearch size={20}/>} label="Estoque" />
        </div>

        <div style={{ padding: '0 15px' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', fontWeight: 'bold' }}>
            <LogOut size={18}/> Sair do Sistema
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-content" style={{ flex: 1, marginLeft: '250px', padding: '30px', paddingBottom: '100px', maxWidth: '1000px' }}>
        {activeTab === 'dashboard' && <AdminDashboard sales={sales} customers={customers} visitsCount={visitsCount} />}
        {activeTab === 'vendas' && <AdminSales sales={sales} onUpdate={fetchSalesAndSettings} />}
        {activeTab === 'crm' && <AdminCRM customers={customers} sales={sales} onUpdate={fetchSalesAndSettings} />}
        {activeTab === 'produtos' && <AdminProducts productsList={productsList} pixKey={pixKey} setPixKey={setPixKey} onUpdate={() => { fetchProducts(); fetchSalesAndSettings(); }} migrateLocalProducts={migrateLocalProducts} />}
      </div>

      {/* Mobile Styles injected directly */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
          .admin-content { margin-left: 0 !important; padding: 15px !important; padding-bottom: 150px !important; }
        }
      `}} />

      <BottomNav />
      
      {/* Mobile Top Nav */}
      <div className="mobile-admin-nav" style={{ display: 'flex', overflowX: 'auto', background: '#fff', padding: '10px', gap: '10px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, borderBottom: '1px solid #ddd', boxShadow: 'var(--shadow-card)' }}>
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={18}/>} label="Dashboard" />
        <MobileNavButton active={activeTab === 'vendas'} onClick={() => setActiveTab('vendas')} icon={<Package size={18}/>} label="Vendas" />
        <MobileNavButton active={activeTab === 'crm'} onClick={() => setActiveTab('crm')} icon={<Users size={18}/>} label="Clientes" />
        <MobileNavButton active={activeTab === 'produtos'} onClick={() => setActiveTab('produtos')} icon={<PackageSearch size={18}/>} label="Estoque" />
        <style dangerouslySetInnerHTML={{__html: `
          @media (min-width: 769px) { .mobile-admin-nav { display: none !important; } }
        `}} />
      </div>

    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} style={{ width: '100%', padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '12px', background: active ? 'var(--color-gold)' : 'transparent', color: active ? 'white' : '#555', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'all 0.2s', textAlign: 'left' }}>
      {icon} {label}
    </button>
  );
}

function MobileNavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '5px', background: active ? 'var(--color-gold)' : '#f0f0f0', color: active ? 'white' : '#555', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 }}>
      {icon} {label}
    </button>
  );
}
