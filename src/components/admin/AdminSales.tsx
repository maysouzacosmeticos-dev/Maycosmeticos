import { useState } from 'react';
import { Package, Clock, CheckCircle } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase';

interface Props {
  sales: any[];
  onUpdate: () => void;
}

export function AdminSales({ sales, onUpdate }: Props) {
  const [filter, setFilter] = useState<'todos' | 'pendente' | 'pago'>('todos');

  const filteredSales = sales.filter(s => filter === 'todos' ? true : s.status === filter);
  const pendingCount = sales.filter(s => s.status === 'pendente').length;

  const handleConfirmPayment = async (sale: any) => {
    if (window.confirm('Confirmar recebimento deste pedido? O estoque será debitado agora.')) {
      try {
        await updateDoc(doc(db, "sales", sale.id), { status: 'pago', amountPaid: sale.total });
        for (const item of sale.items) {
          await updateDoc(doc(db, "products", item.id), { stock: increment(-item.quantity) });
        }
        onUpdate();
        alert('Venda confirmada e estoque atualizado!');
      } catch (e) {
        alert('Erro ao confirmar.');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package /> Gestão de Vendas
        </h2>
        {pendingCount > 0 && (
          <span style={{ background: '#FF9800', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>
            {pendingCount} Pendentes
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <FilterButton active={filter === 'todos'} onClick={() => setFilter('todos')}>Todos</FilterButton>
        <FilterButton active={filter === 'pendente'} onClick={() => setFilter('pendente')}>Pendentes</FilterButton>
        <FilterButton active={filter === 'pago'} onClick={() => setFilter('pago')}>Concluídos</FilterButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredSales.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>Nenhum pedido encontrado.</p>
        ) : filteredSales.map(sale => (
          <div key={sale.id} style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', borderLeft: `5px solid ${sale.status === 'pendente' ? '#FF9800' : '#4CAF50'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>{sale.customerName || 'Cliente Online'}</h3>
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>📅 {new Date(sale.date).toLocaleString('pt-BR')} | 📱 {sale.customerPhone}</p>
                <p style={{ margin: '5px 0', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--color-gold-dark)' }}>R$ {sale.total.toFixed(2)} <span style={{fontSize: '0.9rem', fontWeight: 'normal', color: '#888'}}>via {sale.method}</span></p>
              </div>
              
              {sale.status === 'pendente' ? (
                <button onClick={() => handleConfirmPayment(sale)} style={{ background: '#4CAF50', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={18} /> Confirmar
                </button>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4CAF50', fontWeight: 'bold', padding: '10px' }}>
                  <CheckCircle size={18} /> Pago
                </span>
              )}
            </div>

            <div style={{ marginTop: '15px', padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#555' }}>Itens do Pedido:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#444' }}>
                {sale.items?.map((item: any, i: number) => (
                  <li key={i} style={{ marginBottom: '5px' }}>
                    <strong>{item.quantity}x</strong> {item.name} <span style={{ color: '#888' }}>- R$ {(item.quantity * item.price).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              {sale.customerAddress && (
                <p style={{ margin: '15px 0 0 0', fontSize: '0.9rem', color: '#666', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
                  <strong>🏠 Endereço:</strong> {sale.customerAddress}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button 
      onClick={onClick} 
      style={{ 
        padding: '8px 16px', 
        borderRadius: '20px', 
        border: 'none', 
        background: active ? 'var(--color-gold)' : '#eee', 
        color: active ? 'white' : '#666', 
        fontWeight: 'bold', 
        cursor: 'pointer' 
      }}
    >
      {children}
    </button>
  );
}
