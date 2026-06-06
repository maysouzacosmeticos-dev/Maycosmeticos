import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = '/admin';
    } catch (err: any) {
      console.error(err);
      setError(`Erro: ${err.message}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-rose-light)' }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: 'var(--shadow-glass)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold-dark)', textAlign: 'center', marginBottom: '20px' }}>
          May Cosméticos Admin
        </h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {error && <p style={{ color: 'red', textAlign: 'center', fontSize: '14px' }}>{error}</p>}
          <div>
            <label style={{ fontWeight: 'bold' }}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '5px' }} />
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '5px' }} />
          </div>
          <button type="submit" style={{ padding: '14px', background: 'var(--gradient-gold)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '10px' }}>
            Entrar no Painel
          </button>
        </form>
      </div>
    </div>
  );
}
