import { useState } from 'react';
import { Package, Clock, CheckCircle, Trash2, Edit2, DollarSign } from 'lucide-react';
import { doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface Props {
  sales: any[];
  onUpdate: () => void;
}

export function AdminSales({ sales, onUpdate }: Props) {
  const [filter, setFilter] = useState<'todos' | 'crediario' | 'pendente' | 'parcial' | 'pago'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editedItems, setEditedItems] = useState<any[]>([]);

  const filteredSales = sales.filter(s => {
    let matchesStatus = true;
    if (filter === 'pendente') matchesStatus = s.status === 'pendente';
    else if (filter === 'parcial') matchesStatus = s.status === 'parcial';
    else if (filter === 'pago') matchesStatus = s.status === 'pago';
    else if (filter === 'crediario') matchesStatus = s.method === 'A Prazo' || s.status === 'pendente' || s.status === 'parcial';

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (s.customerName || '').toLowerCase().includes(searchLower) || 
      (s.customerPhone || '').includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = sales.filter(s => s.status === 'pendente' || s.status === 'parcial' || s.method === 'A Prazo').length;

  const handleBaixaTotal = async (sale: any) => {
    const amountPaidSoFar = sale.amountPaid !== undefined ? sale.amountPaid : (sale.status === 'pago' ? sale.total : 0);
    const remaining = Math.max(0, sale.total - amountPaidSoFar);

    if (window.confirm(`Confirmar BAIXA TOTAL de R$ ${remaining.toFixed(2)} para ${sale.customerName || 'Cliente'}?`)) {
      try {
        await updateDoc(doc(db, "sales", sale.id), { 
          status: 'pago', 
          amountPaid: sale.total 
        });

        if (sale.customerId) {
          await updateDoc(doc(db, "customers", sale.customerId), {
            totalDivida: increment(-remaining),
            totalGasto: increment(remaining)
          });
        }

        onUpdate();
        alert('Baixa total realizada com sucesso!');
      } catch (e) {
        alert('Erro ao realizar baixa total.');
      }
    }
  };

  const handleBaixaParcial = async (sale: any) => {
    const amountPaidSoFar = sale.amountPaid !== undefined ? sale.amountPaid : (sale.status === 'pago' ? sale.total : 0);
    const remaining = Math.max(0, sale.total - amountPaidSoFar);

    if (remaining <= 0) {
      alert("Esta venda já está quitada.");
      return;
    }

    const inputVal = window.prompt(`Informe o valor pago HOJE por ${sale.customerName || 'Cliente'} (Restante devedor: R$ ${remaining.toFixed(2)}):`, remaining.toFixed(2));
    if (!inputVal) return;

    const payValue = Math.min(remaining, Math.max(0, parseFloat(inputVal) || 0));
    if (payValue <= 0) return;

    const newAmountPaid = amountPaidSoFar + payValue;
    const isFullyPaid = newAmountPaid >= (sale.total - 0.01);
    const newStatus = isFullyPaid ? 'pago' : 'parcial';

    try {
      await updateDoc(doc(db, "sales", sale.id), {
        amountPaid: newAmountPaid,
        status: newStatus
      });

      if (sale.customerId) {
        await updateDoc(doc(db, "customers", sale.customerId), {
          totalDivida: increment(-payValue),
          totalGasto: increment(payValue)
        });
      }

      onUpdate();
      alert(`Baixa parcial de R$ ${payValue.toFixed(2)} registrada! Saldo restante: R$ ${(sale.total - newAmountPaid).toFixed(2)}`);
    } catch (e) {
      alert('Erro ao registrar baixa parcial.');
    }
  };

  const handleDeleteSale = async (sale: any) => {
    if (window.confirm('Deseja realmente apagar/cancelar esta venda do histórico?')) {
      try {
        await deleteDoc(doc(db, "sales", sale.id));
        onUpdate();
        alert('Venda apagada com sucesso.');
      } catch (e) {
        alert('Erro ao apagar venda.');
      }
    }
  };

  const startEditing = (sale: any) => {
    setEditingSaleId(sale.id);
    setEditedItems([...sale.items]);
  };

  const removeEditedItem = (index: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  const saveEditedSale = async (sale: any) => {
    if (editedItems.length === 0) {
      alert("A nota não pode ficar vazia. Use o botão da lixeira para apagar a venda inteira.");
      return;
    }

    try {
      if (sale.status === 'pago') {
        const removedItems = sale.items.filter((oldItem: any) => 
          !editedItems.some((newItem: any) => newItem.id === oldItem.id && newItem.quantity === oldItem.quantity)
        );
        for (const item of removedItems) {
           await updateDoc(doc(db, "products", item.id), { stock: increment(item.quantity) });
        }
      }

      const newTotal = editedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      
      await updateDoc(doc(db, "sales", sale.id), {
        items: editedItems,
        total: newTotal,
        amountPaid: sale.status === 'pago' ? newTotal : (sale.amountPaid || 0)
      });
      
      setEditingSaleId(null);
      onUpdate();
      alert("Nota atualizada com sucesso!");
    } catch (e) {
      alert("Erro ao salvar alterações.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package /> Gestão de Vendas & Crediário
        </h2>
        {pendingCount > 0 && (
          <span style={{ background: '#FF9800', color: 'white', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>
            {pendingCount} Pendentes / A Prazo
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <FilterButton active={filter === 'todos'} onClick={() => setFilter('todos')}>Todos</FilterButton>
          <FilterButton active={filter === 'crediario'} onClick={() => setFilter('crediario')}>A Prazo / Crediário</FilterButton>
          <FilterButton active={filter === 'pendente'} onClick={() => setFilter('pendente')}>Pendentes</FilterButton>
          <FilterButton active={filter === 'parcial'} onClick={() => setFilter('parcial')}>Parciais</FilterButton>
          <FilterButton active={filter === 'pago'} onClick={() => setFilter('pago')}>Concluídos</FilterButton>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '5px 15px', borderRadius: '25px', boxShadow: 'var(--shadow-card)', flex: '1 1 200px', maxWidth: '300px' }}>
          <input 
            type="text" 
            placeholder="Buscar por cliente ou telefone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '8px', width: '100%', outline: 'none' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredSales.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>Nenhum pedido encontrado.</p>
        ) : filteredSales.map(sale => {
          const amountPaid = sale.amountPaid !== undefined ? sale.amountPaid : (sale.status === 'pago' ? sale.total : 0);
          const remaining = Math.max(0, sale.total - amountPaid);
          const isPendingOrCrediario = remaining > 0 || sale.status !== 'pago';

          return (
            <div key={sale.id} style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-card)', borderLeft: `5px solid ${sale.status === 'pago' ? '#4CAF50' : (sale.status === 'parcial' ? '#FF9800' : '#e65100')}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {sale.customerName || 'Cliente Online'}
                    {sale.method === 'A Prazo' && <span style={{ background: '#fff3e0', color: '#e65100', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px' }}>CREDIÁRIO</span>}
                  </h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>📅 {new Date(sale.date).toLocaleString('pt-BR')} | 📱 {sale.customerPhone || 'Não informado'}</p>
                  <p style={{ margin: '5px 0', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--color-gold-dark)' }}>
                    R$ {sale.total.toFixed(2)} <span style={{fontSize: '0.9rem', fontWeight: 'normal', color: '#888'}}>via {sale.method || 'Online'}</span>
                  </p>

                  {isPendingOrCrediario && (
                    <div style={{ background: '#fff3e0', padding: '6px 10px', borderRadius: '6px', marginTop: '6px', fontSize: '0.85rem', color: '#e65100', display: 'inline-flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span>Pago: <strong>R$ {amountPaid.toFixed(2)}</strong></span>
                      <span>Falta Pagar: <strong>R$ {remaining.toFixed(2)}</strong></span>
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {isPendingOrCrediario ? (
                    <>
                      <button onClick={() => handleBaixaTotal(sale)} title="Quitar total da venda" style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={15} /> Baixa Total
                      </button>
                      <button onClick={() => handleBaixaParcial(sale)} title="Dar baixa parcial" style={{ background: '#ed6c02', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={15} /> Baixa Parcial
                      </button>
                    </>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4CAF50', fontWeight: 'bold', padding: '8px 12px' }}>
                      <CheckCircle size={18} /> Concluído
                    </span>
                  )}
                  <button onClick={() => startEditing(sale)} title="Editar nota" style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDeleteSale(sale)} title="Excluir nota" style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '15px', padding: '12px', background: '#f9f9f9', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#555' }}>
                  {editingSaleId === sale.id ? "Editando Itens do Pedido:" : "Itens do Pedido:"}
                </h4>
                
                <ul style={{ margin: 0, paddingLeft: editingSaleId === sale.id ? '0' : '20px', color: '#444', listStyleType: editingSaleId === sale.id ? 'none' : 'disc' }}>
                  {editingSaleId === sale.id ? (
                    editedItems.map((item: any, i: number) => (
                      <li key={i} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}>
                        <span><strong>{item.quantity}x</strong> {item.name} <span style={{ color: '#888' }}>- R$ {(item.quantity * item.price).toFixed(2)}</span></span>
                        <button onClick={() => removeEditedItem(i)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '5px', borderRadius: '5px', cursor: 'pointer' }}><Trash2 size={16}/></button>
                      </li>
                    ))
                  ) : (
                    sale.items?.map((item: any, i: number) => (
                      <li key={i} style={{ marginBottom: '5px' }}>
                        <strong>{item.quantity}x</strong> {item.name} <span style={{ color: '#888' }}>- R$ {(item.quantity * item.price).toFixed(2)}</span>
                      </li>
                    ))
                  )}
                </ul>
                
                {editingSaleId === sale.id && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button onClick={() => setEditingSaleId(null)} style={{ flex: 1, padding: '10px', background: '#ddd', color: '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                    <button onClick={() => saveEditedSale(sale)} style={{ flex: 1, padding: '10px', background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar Alterações</button>
                  </div>
                )}
                {sale.customerAddress && (
                  <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', color: '#666', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                    <strong>🏠 Endereço:</strong> {sale.customerAddress}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button 
      onClick={onClick} 
      style={{ 
        padding: '6px 14px', 
        borderRadius: '20px', 
        border: 'none', 
        background: active ? 'var(--color-gold)' : '#eee', 
        color: active ? 'white' : '#666', 
        fontWeight: 'bold', 
        fontSize: '0.85rem',
        cursor: 'pointer' 
      }}
    >
      {children}
    </button>
  );
}
