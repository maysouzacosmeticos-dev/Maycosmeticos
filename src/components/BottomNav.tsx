import { ShoppingBag, LayoutDashboard, Store } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading || !user) return null;

  const navItemStyle = (path: string) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    color: location.pathname === path ? 'var(--color-gold-dark)' : '#999',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '10px 0',
    transition: 'color 0.2s'
  });

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      background: 'white',
      borderTop: '1px solid #eee',
      display: 'flex',
      justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 1000,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
    }}>
      <button style={navItemStyle('/pdv')} onClick={() => navigate('/pdv')}>
        <ShoppingBag size={24} style={{ marginBottom: '4px' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: location.pathname === '/pdv' ? 'bold' : 'normal' }}>Caixa (PDV)</span>
      </button>
      
      <button style={navItemStyle('/admin')} onClick={() => navigate('/admin')}>
        <LayoutDashboard size={24} style={{ marginBottom: '4px' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: location.pathname === '/admin' ? 'bold' : 'normal' }}>Gestão</span>
      </button>

      <button style={navItemStyle('/')} onClick={() => navigate('/')}>
        <Store size={24} style={{ marginBottom: '4px' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: location.pathname === '/' ? 'bold' : 'normal' }}>Loja Online</span>
      </button>
    </div>
  );
}
