import { useState, useEffect } from 'react';
import { Settings, Smartphone, Bell, Phone } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export function AdminSettings() {
  const [pixKey, setPixKey] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "store"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPixKey(data.pixKey || '');
          setWhatsapp(data.whatsapp || '');
          setTelegramToken(data.telegramToken || '');
          setTelegramChatId(data.telegramChatId || '');
        }
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "store"), { 
        pixKey,
        whatsapp,
        telegramToken,
        telegramChatId
      }, { merge: true });
      alert("Configurações salvas com sucesso!");
    } catch(e) { 
      alert("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Carregando configurações...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
      <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Settings /> Configurações da Loja
      </h2>

      <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Pix & WhatsApp */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: 0, color: '#333' }}>Informações de Contato e Pagamento</h3>
          
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
              <Smartphone size={16}/> Chave Pix (Para QR Code Automático)
            </label>
            <input 
              type="text" 
              value={pixKey} 
              onChange={e => setPixKey(e.target.value)} 
              style={inputStyle} 
              placeholder="Ex: CNPJ, Email ou Celular" 
            />
          </div>

          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
              <Phone size={16}/> Número do WhatsApp (Receber Pedidos)
            </label>
            <input 
              type="text" 
              value={whatsapp} 
              onChange={e => setWhatsapp(e.target.value)} 
              style={inputStyle} 
              placeholder="Ex: 5575988071066 (Apenas números)" 
            />
          </div>
        </div>

        {/* Telegram Notifications */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} color="#0088cc" /> Notificações pelo Telegram
          </h3>
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
            Receba alertas de novas vendas em tempo real no seu celular. Crie um bot no <strong>@BotFather</strong> e pegue seu ID no <strong>@userinfobot</strong>.
          </p>
          
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
              Token do Bot
            </label>
            <input 
              type="password" 
              value={telegramToken} 
              onChange={e => setTelegramToken(e.target.value)} 
              style={inputStyle} 
              placeholder="Ex: 123456789:ABCdefGHIjklmNOPqrsTUVwxyz..." 
            />
          </div>

          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
              Seu Chat ID
            </label>
            <input 
              type="text" 
              value={telegramChatId} 
              onChange={e => setTelegramChatId(e.target.value)} 
              style={inputStyle} 
              placeholder="Ex: 123456789" 
            />
          </div>
        </div>

        <button type="submit" disabled={saving} style={{ background: 'var(--color-gold)', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: 'var(--shadow-card)' }}>
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', boxSizing: 'border-box' as const };
