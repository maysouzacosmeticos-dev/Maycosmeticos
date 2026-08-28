import { useState } from 'react';
import { Package, CheckCircle, Trash2, Edit2, DollarSign, Plus, MessageCircle, Image as ImageIcon, X } from 'lucide-react';
import { doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { sendDigitalPaymentReceipt } from '../../utils/generatePaymentReceipt';
import { Receipt } from '../Receipt';
import html2canvas from 'html2canvas';

interface Props {
  sales: any[];
  productsList?: any[];
  onUpdate: () => void;
}

export function AdminSales({ sales, productsList = [], onUpdate }: Props) {
  const [filter, setFilter] = useState<'todos' | 'crediario' | 'pendente' | 'parcial' | 'pago'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [editedCustomerName, setEditedCustomerName] = useState('');
  const [editedCustomerPhone, setEditedCustomerPhone] = useState('');
  const [editedCustomerAddress, setEditedCustomerAddress] = useState('');
  const [editedMethod, setEditedMethod] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');

  // Modal de Recibo Visual / Cupom
  const [receiptModalSale, setReceiptModalSale] = useState<any | null>(null);
  const [allowCouponModal, setAllowCouponModal] = useState(false);
  const [includeCoupon, setIncludeCoupon] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponTextInput, setCouponTextInput] = useState('');

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

  const handleOpenReceiptModal = (sale: any, allowCoupon: boolean = false) => {
    setReceiptModalSale(sale);
    setAllowCouponModal(allowCoupon);
    setIncludeCoupon(false);
    setCouponCodeInput('');
    setCouponTextInput('');
  };

  const handleConfirmOrder = async (sale: any) => {
    if (window.confirm(`Confirmar o pedido de ${sale.customerName || 'Cliente'} e enviar mensagem de confirmação no WhatsApp?`)) {
      try {
        await updateDoc(doc(db, "sales", sale.id), { status: 'pago' });
        onUpdate();
        handleSendConfirmedReceipt(sale);
      } catch (e) {
        alert("Erro ao confirmar pedido.");
      }
    }
  };

  const generateReceiptCanvas = async () => {
    const elem = document.getElementById('receipt-container');
    if (!elem) return null;
    const originalLeft = elem.style.left;
    elem.style.left = '0px';
    elem.style.top = '0px';
    elem.style.zIndex = '99999';

    try {
      const canvas = await html2canvas(elem, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      elem.style.left = originalLeft;
      return canvas;
    } catch (err) {
      elem.style.left = originalLeft;
      console.error("Erro ao renderizar imagem do cupom:", err);
      return null;
    }
  };

  const handleDownloadReceiptImage = async () => {
    if (!receiptModalSale) return;
    const canvas = await generateReceiptCanvas();
    if (!canvas) {
      alert("Erro ao gerar imagem do cupom.");
      return;
    }
    const customerName = receiptModalSale.customerName || 'Cliente';
    const link = document.createElement('a');
    link.download = `Cupom_MayCosmeticos_${customerName.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleShareReceiptImage = async () => {
    if (!receiptModalSale) return;
    const canvas = await generateReceiptCanvas();
    if (!canvas) return;

    const customerName = receiptModalSale.customerName || 'Cliente';
    const customerPhone = receiptModalSale.customerPhone || '';

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `Cupom_MayCosmeticos_${customerName.replace(/\s+/g, '_')}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'Cupom de Venda - May Cosméticos',
            text: `Olá ${customerName}, aqui está o seu cupom oficial de compra da May Cosméticos! 🌸`,
            files: [file]
          });
        } catch (error) {}
      } else {
        const link = document.createElement('a');
        link.download = file.name;
        link.href = canvas.toDataURL('image/png');
        link.click();

        const cleanPhone = customerPhone.replace(/\D/g, '');
        if (cleanPhone) {
          setTimeout(() => {
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Olá ${customerName}, a imagem do seu cupom de compra da May Cosméticos foi gerada! 🌸`)}`, '_blank');
          }, 800);
        } else {
          alert("Imagem do cupom baixada!");
        }
      }
    });
  };

  const handleSendConfirmedReceipt = (sale: any) => {
    const customerName = sale.customerName || 'Cliente';
    const customerPhone = sale.customerPhone || '';
    const dateStr = sale.date ? new Date(sale.date).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    const itemsText = (sale.items || []).map((item: any) => ` • ${item.quantity}x ${item.name} (R$ ${(item.quantity * item.price).toFixed(2)})`).join('\n');
    
    let msg = `🧾 *COMPROVANTE DE VENDA CONFIRMADA*\n`;
    msg += `*May Cosméticos - Beleza & Bem-Estar*\n\n`;
    msg += `👤 *Cliente:* ${customerName}\n`;
    msg += `📅 *Data da Venda:* ${dateStr}\n`;
    msg += `💳 *Forma de Pagamento:* ${sale.method || 'Pix/Dinheiro'}\n`;
    msg += `-----------------------------------\n`;
    msg += `🛍️ *Itens do Pedido:*\n${itemsText}\n`;
    msg += `-----------------------------------\n`;
    msg += `💰 *TOTAL PAGO:* R$ ${sale.total.toFixed(2)}\n`;
    msg += `✅ *Status:* Venda Confirmada e Quitada!\n\n`;
    msg += `*Agradecemos imensamente a sua preferência!* 🌸💖`;

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      navigator.clipboard.writeText(msg).catch(() => {});
      alert(`Comprovante formatado!\n\n${msg}\n\n(Copiado para a área de transferência).`);
    }
  };

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
        
        if (window.confirm("Deseja enviar o Recibo Digital de Pagamento no WhatsApp do cliente?")) {
          sendDigitalPaymentReceipt(sale.customerName, sale.customerPhone, remaining, 0, 'Baixa Total (Quitação)');
        }
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
    const remainingDebt = Math.max(0, sale.total - newAmountPaid);
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

      if (window.confirm("Deseja enviar o Recibo Digital do Pagamento Parcial no WhatsApp do cliente?")) {
        sendDigitalPaymentReceipt(sale.customerName, sale.customerPhone, payValue, remainingDebt, 'Baixa Parcial');
      }
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
    setEditedItems([...(sale.items || [])]);
    setEditedCustomerName(sale.customerName || '');
    setEditedCustomerPhone(sale.customerPhone || '');
    setEditedCustomerAddress(sale.customerAddress || '');
    setEditedMethod(sale.method || 'Pix');
    setSelectedProductToAdd('');
  };

  const updateItemQuantity = (index: number, delta: number) => {
    setEditedItems(prev => prev.map((item, i) => {
      if (i === index) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeEditedItem = (index: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddItemToOrder = () => {
    if (!selectedProductToAdd) return;
    const product = productsList.find(p => p.id === selectedProductToAdd);
    if (!product) return;

    const existingIndex = editedItems.findIndex(i => i.id === product.id);
    if (existingIndex >= 0) {
      updateItemQuantity(existingIndex, 1);
    } else {
      setEditedItems(prev => [...prev, {
        id: product.id,
        name: product.name,
        price: product.isPromotion && product.promotionalPrice ? product.promotionalPrice : product.price,
        quantity: 1
      }]);
    }
    setSelectedProductToAdd('');
  };

  const saveEditedSale = async (sale: any) => {
    if (editedItems.length === 0) {
      alert("O pedido não pode ficar vazio. Se desejar cancelar o pedido inteiro, use o botão de excluir.");
      return;
    }

    try {
      const qtyMap = new Map<string, number>();

      for (const oldItem of (sale.items || [])) {
        if (oldItem.id) {
          qtyMap.set(oldItem.id, (qtyMap.get(oldItem.id) || 0) - oldItem.quantity);
        }
      }

      for (const newItem of editedItems) {
        if (newItem.id) {
          qtyMap.set(newItem.id, (qtyMap.get(newItem.id) || 0) + newItem.quantity);
        }
      }

      for (const [productId, delta] of qtyMap.entries()) {
        if (delta !== 0) {
          await updateDoc(doc(db, "products", productId), { stock: increment(-delta) });
        }
      }

      const oldTotal = sale.total || 0;
      const newTotal = editedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const totalDelta = newTotal - oldTotal;

      const amountPaidSoFar = sale.amountPaid !== undefined ? sale.amountPaid : (sale.status === 'pago' ? oldTotal : 0);
      const remaining = Math.max(0, newTotal - amountPaidSoFar);
      const newStatus = remaining <= 0 ? 'pago' : (amountPaidSoFar > 0 ? 'parcial' : 'pendente');

      await updateDoc(doc(db, "sales", sale.id), {
        items: editedItems,
        total: newTotal,
        status: newStatus,
        amountPaid: sale.status === 'pago' ? newTotal : amountPaidSoFar,
        customerName: editedCustomerName.trim(),
        customerPhone: editedCustomerPhone.trim(),
        customerAddress: editedCustomerAddress.trim(),
        method: editedMethod
      });

      if (sale.customerId && totalDelta !== 0) {
        await updateDoc(doc(db, "customers", sale.customerId), {
          totalDivida: increment(totalDelta)
        });
      }

      setEditingSaleId(null);
      onUpdate();
      alert(`Pedido de ${editedCustomerName || 'Cliente'} atualizado com sucesso! Novo Total: R$ ${newTotal.toFixed(2)}`);
    } catch (e) {
      console.error("Erro ao salvar pedido editado:", e);
      alert("Erro ao salvar alterações do pedido.");
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
                  {sale.status === 'pendente' && (
                    <button 
                      onClick={() => handleConfirmOrder(sale)} 
                      title="Confirmar pedido e notificar cliente no WhatsApp" 
                      style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CheckCircle size={15} /> Confirmar Pedido
                    </button>
                  )}

                  {isPendingOrCrediario ? (
                    <>
                      <button onClick={() => handleBaixaTotal(sale)} title="Quitar total da venda" style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={15} /> Baixa Total
                      </button>
                      <button onClick={() => handleBaixaParcial(sale)} title="Dar baixa parcial" style={{ background: '#ed6c02', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={15} /> Baixa Parcial
                      </button>
                      <button 
                        onClick={() => handleOpenReceiptModal(sale, false)} 
                        title="Gerar recibo parcial em imagem com débito restante" 
                        style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ImageIcon size={15} /> Recibo Parcial
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleOpenReceiptModal(sale, true)} 
                        title="Gerar cupom de desconto & recibo em imagem" 
                        style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ImageIcon size={15} /> 🎁 Cupom & Recibo
                      </button>
                    </>
                  )}
                  <button onClick={() => startEditing(sale)} title="Editar pedido completo" style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Edit2 size={16} /> Alterar Pedido
                  </button>
                  <button onClick={() => handleDeleteSale(sale)} title="Excluir nota" style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '15px', padding: '15px', background: '#f9f9f9', borderRadius: '10px', border: editingSaleId === sale.id ? '2px solid var(--color-gold)' : '1px solid #eee' }}>
                {editingSaleId === sale.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h4 style={{ margin: 0, color: 'var(--color-gold-dark)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ✏️ Editando Dados e Itens do Pedido
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Nome do Cliente:</label>
                        <input type="text" value={editedCustomerName} onChange={e => setEditedCustomerName(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Telefone / WhatsApp:</label>
                        <input type="text" value={editedCustomerPhone} onChange={e => setEditedCustomerPhone(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Forma de Pagamento:</label>
                        <select value={editedMethod} onChange={e => setEditedMethod(e.target.value)} style={inputStyle}>
                          <option value="Pix">Pix</option>
                          <option value="Cartão">Cartão</option>
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="A Prazo">A Prazo (Crediário)</option>
                        </select>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Endereço de Entrega:</label>
                        <input type="text" value={editedCustomerAddress} onChange={e => setEditedCustomerAddress(e.target.value)} placeholder="Endereço..." style={inputStyle} />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#444', marginBottom: '8px', display: 'block' }}>Itens do Pedido:</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {editedItems.map((item: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '160px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{item.name}</span>
                              <span style={{ color: 'var(--color-gold-dark)', marginLeft: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>R$ {(item.price * item.quantity).toFixed(2)}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button type="button" onClick={() => updateItemQuantity(i, -1)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>-</button>
                              <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
                              <button type="button" onClick={() => updateItemQuantity(i, 1)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>+</button>
                              <button type="button" onClick={() => removeEditedItem(i)} title="Remover item" style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', marginLeft: '6px' }}><Trash2 size={16}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {productsList.length > 0 && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px' }}>
                        <label style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#166534', display: 'block', marginBottom: '6px' }}>+ Adicionar Produto ao Pedido:</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <select value={selectedProductToAdd} onChange={e => setSelectedProductToAdd(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '200px', marginTop: 0 }}>
                            <option value="">-- Selecione um produto para adicionar --</option>
                            {productsList.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} (R$ {(p.isPromotion && p.promotionalPrice ? p.promotionalPrice : p.price).toFixed(2)})
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={handleAddItemToOrder} disabled={!selectedProductToAdd} style={{ padding: '8px 15px', background: selectedProductToAdd ? '#166534' : '#ccc', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: selectedProductToAdd ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Plus size={16} /> Incluir
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button type="button" onClick={() => setEditingSaleId(null)} style={{ flex: 1, padding: '12px', background: '#eee', color: '#555', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                      <button type="button" onClick={() => saveEditedSale(sale)} style={{ flex: 2, padding: '12px', background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>💾 Salvar Alterações no Pedido</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#555' }}>Itens do Pedido:</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#444' }}>
                      {sale.items?.map((item: any, i: number) => (
                        <li key={i} style={{ marginBottom: '5px' }}>
                          <strong>{item.quantity}x</strong> {item.name} <span style={{ color: '#888' }}>- R$ {(item.quantity * item.price).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                    {sale.customerAddress && (
                      <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', color: '#666', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                        <strong>🏠 Endereço:</strong> {sale.customerAddress}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Gerar Cupom / Recibo Imagem */}
      {receiptModalSale && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '16px', maxWidth: '480px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setReceiptModalSale(null)} style={{ position: 'absolute', top: '15px', right: '15px', border: 'none', background: '#f5f5f5', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>

            <h3 style={{ margin: '0 0 5px 0', color: 'var(--color-gold-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🧾 Gerar Cupom / Recibo Digital
            </h3>
            <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#666' }}>
              Cliente: <strong>{receiptModalSale.customerName || 'Consumidor Final'}</strong> | Total: <strong>R$ {receiptModalSale.total.toFixed(2)}</strong>
            </p>

            {/* Checkbox Cupom de Desconto */}
            {allowCouponModal ? (
              <div style={{ background: '#fffcf5', border: '1px solid #fde68a', padding: '12px 15px', borderRadius: '10px', marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#b45309', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="checkbox" 
                    checked={includeCoupon} 
                    onChange={e => setIncludeCoupon(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  🎁 Incluir Cupom de Desconto Especial no Recibo?
                </label>

                {includeCoupon && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Código do Cupom:</label>
                      <input 
                        type="text" 
                        placeholder="Ex: MAYBELEZA10 ou DESCONTO10" 
                        value={couponCodeInput} 
                        onChange={e => setCouponCodeInput(e.target.value.toUpperCase())} 
                        style={inputStyle} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>Descrição do Desconto:</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Ganhe 10% de desconto na sua próxima compra!" 
                        value={couponTextInput} 
                        onChange={e => setCouponTextInput(e.target.value)} 
                        style={inputStyle} 
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px 15px', borderRadius: '10px', marginBottom: '15px', color: '#1e40af', fontSize: '0.85rem' }}>
                📌 <strong>Recibo Parcial / Extrato:</strong> O cupom de desconto promocional é liberado exclusivamente em vendas com <strong>Baixa Total (100% quitadas)</strong>. Este recibo discrimina o valor recebido e o saldo devedor restante no crediário.
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={handleShareReceiptImage}
                style={{ width: '100%', padding: '14px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <MessageCircle size={18} /> Enviar Imagem do Cupom no WhatsApp
              </button>

              <button 
                onClick={handleDownloadReceiptImage}
                style={{ width: '100%', padding: '14px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <ImageIcon size={18} /> Baixar Imagem do Cupom (PNG)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elemento oculto do Recibo para html2canvas */}
      {receiptModalSale && (
        <Receipt 
          customerName={receiptModalSale.customerName || 'Consumidor Final'}
          customerPhone={receiptModalSale.customerPhone}
          items={(receiptModalSale.items || []).map((it: any) => ({
            id: it.id || '1',
            description: it.name,
            quantity: it.quantity,
            unitPrice: it.price,
            totalPrice: it.quantity * it.price
          }))}
          date={receiptModalSale.date ? new Date(receiptModalSale.date).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}
          paymentMethod={receiptModalSale.method || 'Pix'}
          totalAmount={receiptModalSale.total}
          partialPayment={receiptModalSale.amountPaid !== undefined ? receiptModalSale.amountPaid.toString() : (receiptModalSale.status === 'pago' ? receiptModalSale.total.toString() : '0')}
          couponCode={includeCoupon ? couponCodeInput : undefined}
          couponText={includeCoupon ? couponTextInput : undefined}
          saleNumber={receiptModalSale.id ? receiptModalSale.id.substring(0, 6) : undefined}
        />
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px', fontSize: '0.9rem', boxSizing: 'border-box' as const };

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
