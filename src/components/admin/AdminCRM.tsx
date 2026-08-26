import { useState } from 'react';
import { Users, Search, MessageCircle, FileText, ChevronDown, ChevronUp, Edit2, Trash2, Star, Clock, AlertTriangle, Heart, Copy } from 'lucide-react';
import { doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { sendDigitalPaymentReceipt } from '../../utils/generatePaymentReceipt';

interface Props {
  customers: any[];
  sales: any[];
  onUpdate: () => void;
}

export function AdminCRM({ customers, sales, onUpdate }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ [key: string]: string }>({});

  const [activeFilter, setActiveFilter] = useState<'all' | 'vip' | 'inactive' | 'debt' | 'interest'>('all');
  const [inactiveDays, setInactiveDays] = useState(60);
  const [interestProduct, setInterestProduct] = useState('');

  const allProductsSold = Array.from(new Set(sales.flatMap(s => s.items?.map((i:any) => i.name) || []))).filter(Boolean);

  const filteredCustomers = customers.filter(c => {
    // Text Search
    if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.phone?.includes(searchTerm)) {
      return false;
    }
    
    // Smart Filters
    if (activeFilter === 'vip') {
      if ((c.totalGasto || 0) < 300) return false;
    } 
    else if (activeFilter === 'debt') {
      if ((c.totalDivida || 0) <= 0) return false;
    }
    else if (activeFilter === 'inactive') {
      const customerSales = sales.filter(s => s.customerPhone === c.phone || s.customerId === c.id);
      if (customerSales.length === 0) return false;
      const latestSale = customerSales.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const daysSincePurchase = (new Date().getTime() - new Date(latestSale.date).getTime()) / (1000 * 3600 * 24);
      if (daysSincePurchase < inactiveDays) return false;
    }
    else if (activeFilter === 'interest' && interestProduct) {
      const customerSales = sales.filter(s => s.customerPhone === c.phone || s.customerId === c.id);
      const boughtProduct = customerSales.some(s => s.items?.some((i:any) => i.name === interestProduct));
      if (!boughtProduct) return false;
    }
    
    return true;
  });

  const handleExportList = () => {
    if (filteredCustomers.length === 0) return alert("A lista está vazia!");
    const phones = filteredCustomers.map(c => c.phone?.replace(/\D/g, '')).filter(p => p && p.length >= 10);
    const listString = phones.join(', ');
    navigator.clipboard.writeText(listString).then(() => {
      alert(`Lista com ${phones.length} números copiada para a área de transferência!\n\nCole no seu WhatsApp para disparos.`);
    }).catch(() => {
      alert("Erro ao copiar. Os números são:\n" + listString);
    });
  };

  const toggleCustomer = (id: string) => {
    if (expandedId === id) setExpandedId(null);
    else setExpandedId(id);
  };

  const handleNotesChange = (id: string, text: string) => {
    setEditingNotes({ ...editingNotes, [id]: text });
  };

  const saveNotes = async (id: string) => {
    try {
      await updateDoc(doc(db, "customers", id), { notes: editingNotes[id] });
      onUpdate();
      alert("Anotações salvas com sucesso!");
    } catch (e) {
      alert("Erro ao salvar anotações.");
    }
  };

  const quitarDivida = async (c: any) => {
    const dividaValor = c.totalDivida || 0;
    if(window.confirm(`Quitar dívida de R$ ${dividaValor.toFixed(2)} de ${c.name}?`)) {
      try {
        await updateDoc(doc(db, "customers", c.id), { totalDivida: 0, totalGasto: increment(dividaValor) });
        onUpdate();
        
        if (window.confirm("Deseja enviar o Recibo Digital de Quitação no WhatsApp do cliente?")) {
          sendDigitalPaymentReceipt(c.name, c.phone, dividaValor, 0, 'Quitação Total de Dívida');
        }
      } catch (e) {
        alert("Erro ao quitar dívida.");
      }
    }
  };

  const baixarParcialDivida = async (c: any) => {
    const dividaAtual = c.totalDivida || 0;
    if (dividaAtual <= 0) return;

    const inputVal = window.prompt(`Informe o valor da BAIXA PARCIAL para ${c.name} (Dívida em aberto: R$ ${dividaAtual.toFixed(2)}):`, dividaAtual.toFixed(2));
    if (!inputVal) return;

    const val = Math.min(dividaAtual, Math.max(0, parseFloat(inputVal) || 0));
    if (val <= 0) return;

    try {
      const novaDivida = Math.max(0, dividaAtual - val);
      await updateDoc(doc(db, "customers", c.id), { 
        totalDivida: novaDivida, 
        totalGasto: increment(val) 
      });
      onUpdate();

      if (window.confirm("Deseja enviar o Recibo Digital de Baixa Parcial no WhatsApp do cliente?")) {
        sendDigitalPaymentReceipt(c.name, c.phone, val, novaDivida, 'Baixa Parcial no CRM');
      }
    } catch (e) {
      alert("Erro ao dar baixa parcial.");
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if(window.confirm('Apagar permanentemente este cliente e suas anotações?')) {
      try {
        await deleteDoc(doc(db, "customers", id));
        onUpdate();
      } catch (e) {
        alert("Erro ao apagar cliente.");
      }
    }
  };

  const handleEditCustomer = async (c: any) => {
    const newName = window.prompt("Nome do cliente:", c.name);
    if (newName === null) return;
    const newPhone = window.prompt("WhatsApp:", c.phone || '');
    if (newPhone === null) return;
    const newAddress = window.prompt("Endereço:", c.address || '');
    if (newAddress === null) return;

    try {
      await updateDoc(doc(db, "customers", c.id), {
        name: newName.trim(),
        phone: newPhone.trim(),
        address: newAddress.trim()
      });
      onUpdate();
    } catch(e) {
      alert("Erro ao atualizar cliente.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users /> Gestão de Clientes (CRM)
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '5px 15px', borderRadius: '25px', boxShadow: 'var(--shadow-card)', flex: '1 1 200px', maxWidth: '300px' }}>
          <Search size={18} color="#888" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou número..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '10px', width: '100%', outline: 'none' }}
          />
        </div>
      </div>

      {/* SMART FILTERS */}
      <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveFilter('all')} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', background: activeFilter === 'all' ? 'var(--color-gold)' : '#e2e8f0', color: activeFilter === 'all' ? 'white' : '#475569', cursor: 'pointer', fontWeight: 'bold' }}>
            Todos
          </button>
          <button onClick={() => setActiveFilter('vip')} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', background: activeFilter === 'vip' ? '#eab308' : '#e2e8f0', color: activeFilter === 'vip' ? 'white' : '#475569', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Star size={16}/> VIPs (+R$ 300)
          </button>
          <button onClick={() => setActiveFilter('inactive')} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', background: activeFilter === 'inactive' ? '#64748b' : '#e2e8f0', color: activeFilter === 'inactive' ? 'white' : '#475569', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={16}/> Inativos
          </button>
          <button onClick={() => setActiveFilter('debt')} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', background: activeFilter === 'debt' ? '#ef4444' : '#e2e8f0', color: activeFilter === 'debt' ? 'white' : '#475569', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertTriangle size={16}/> Devedores
          </button>
          <button onClick={() => setActiveFilter('interest')} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', background: activeFilter === 'interest' ? '#ec4899' : '#e2e8f0', color: activeFilter === 'interest' ? 'white' : '#475569', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Heart size={16}/> Por Interesse
          </button>
        </div>

        {activeFilter === 'inactive' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Mostrar clientes que não compram há mais de:</span>
            <input type="number" value={inactiveDays} onChange={e => setInactiveDays(Number(e.target.value))} style={{ width: '60px', padding: '5px', borderRadius: '5px', border: '1px solid #ccc' }} />
            <span>dias.</span>
          </div>
        )}

        {activeFilter === 'interest' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Filtrar clientes que compraram:</span>
            <select value={interestProduct} onChange={e => setInterestProduct(e.target.value)} style={{ padding: '5px', borderRadius: '5px', border: '1px solid #ccc', flex: 1, maxWidth: '300px' }}>
              <option value="">Selecione um produto...</option>
              {allProductsSold.map((p, i) => <option key={i} value={p as string}>{p as string}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* EXPORT BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontWeight: 'bold', color: '#64748b' }}>Mostrando {filteredCustomers.length} clientes</p>
        <button onClick={handleExportList} style={{ background: '#25D366', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 5px rgba(37,211,102,0.3)' }}>
          <Copy size={18}/> Copiar para Lista de Transmissão
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredCustomers.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>Nenhum cliente encontrado.</p>
        ) : filteredCustomers.map(customer => {
          const isExpanded = expandedId === customer.id;
          const customerSales = sales.filter(s => s.customerPhone === customer.phone || s.customerId === customer.id);
          
          return (
            <div key={customer.id} style={{ background: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
              {/* Header (Clickable) */}
              <div onClick={() => toggleCustomer(customer.id)} style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isExpanded ? '1px solid #eee' : 'none' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {customer.name} 
                    {(customer.totalDivida || 0) > 0 && <span style={{ background: '#ffebee', color: '#c62828', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '10px' }}>Em Dívida</span>}
                  </h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>📱 {customer.phone} {customer.address ? `| 🏠 ${customer.address}` : ''}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ textAlign: 'right', marginRight: '10px' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>Total Comprado</p>
                    <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-gold-dark)' }}>R$ {(customer.totalGasto || 0).toFixed(2)}</p>
                  </div>
                  
                  {isExpanded && (
                    <div style={{ display: 'flex', gap: '5px', marginRight: '10px' }}>
                      <button onClick={(e) => { e.stopPropagation(); handleEditCustomer(customer); }} style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><Edit2 size={16}/></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </div>
                  )}

                  {isExpanded ? <ChevronUp color="#888" /> : <ChevronDown color="#888" />}
                </div>
              </div>

              {/* Expanded Details - Ficha do Cliente */}
              {isExpanded && (
                <div style={{ padding: '25px', background: '#f8fafc', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', borderTop: '1px solid #eee' }}>
                  
                  {/* Coluna Esquerda: Anotações & Financeiro */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Anotações */}
                    <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                        <FileText size={18} color="#64748b"/> Histórico e Preferências
                      </h4>
                      <textarea 
                        value={editingNotes[customer.id] !== undefined ? editingNotes[customer.id] : (customer.notes || '')}
                        onChange={(e) => handleNotesChange(customer.id, e.target.value)}
                        placeholder="Ex: Cliente prefere tons pastéis, alergia a componente X, aniversário 12/05..."
                        style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit', resize: 'vertical', fontSize: '0.95rem', background: '#f8fafc', boxSizing: 'border-box' }}
                      />
                      <button 
                        onClick={() => saveNotes(customer.id)}
                        style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', marginTop: '12px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                      >
                        Salvar Observações
                      </button>
                    </div>

                    {/* Área Financeira (Só aparece se houver dívida) */}
                    {(customer.totalDivida || 0) > 0 && (
                      <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          ⚠️ Dívida em Aberto: R$ {(customer.totalDivida || 0).toFixed(2)}
                        </h4>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <a href={`https://wa.me/${customer.phone?.replace(/\D/g,'')}?text=Olá ${customer.name?.split(' ')[0]}, vi aqui no meu sistema que ficou um valor pendente de R$ ${(customer.totalDivida||0).toFixed(2)}. Podemos acertar hoje?`} target="_blank" rel="noreferrer" style={{ background: '#25D366', color: '#fff', textDecoration: 'none', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px', flex: '1 1 120px', justifyContent: 'center', fontWeight: 'bold' }}>
                            <MessageCircle size={16}/> Cobrar no Whats
                          </a>
                          <button onClick={() => quitarDivida(customer)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', flex: '1 1 110px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            ✅ Quitar Tudo
                          </button>
                          <button onClick={() => baixarParcialDivida(customer)} style={{ background: '#ed6c02', color: '#fff', border: 'none', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', flex: '1 1 110px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            💵 Baixa Parcial
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Coluna Direita: Histórico de Compras */}
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#334155' }}>
                      Pedidos Recentes 
                      <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem' }}>{customerSales.length} compras</span>
                    </h4>
                    
                    <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '5px' }}>
                      {customerSales.length === 0 ? <p style={{ fontSize: '0.9rem', color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>Nenhuma compra registrada ainda.</p> : customerSales.map(sale => (
                        <div key={sale.id} style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                            <strong style={{ color: '#475569' }}>📅 {new Date(sale.date).toLocaleDateString('pt-BR')}</strong>
                            <span style={{ color: 'var(--color-gold-dark)', fontWeight: 'bold' }}>R$ {sale.total.toFixed(2)}</span>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '15px', color: '#64748b', fontSize: '0.9rem' }}>
                            {sale.items?.map((item: any, i: number) => (
                              <li key={i} style={{ marginBottom: '4px' }}>{item.quantity}x {item.name}</li>
                            ))}
                          </ul>
                          <div style={{ marginTop: '10px', fontSize: '0.8rem', color: sale.status === 'pago' ? '#10b981' : '#f59e0b', fontWeight: 'bold', display: 'flex', justifyContent: 'flex-end' }}>
                            {sale.status === 'pago' ? '✓ PAGO' : '⏳ PENDENTE'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
