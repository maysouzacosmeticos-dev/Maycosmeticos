import React from 'react';

export interface ReceiptItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ReceiptProps {
  customerName: string;
  customerPhone?: string;
  items: ReceiptItem[];
  date: string;
  paymentMethod: string;
  installments?: number;
  totalAmount: number;
  partialPayment?: string;
  discount?: string;
  couponCode?: string;
  couponText?: string;
  saleNumber?: string;
}

export const Receipt: React.FC<ReceiptProps> = ({ 
  customerName, 
  customerPhone,
  items, 
  date, 
  paymentMethod, 
  totalAmount, 
  partialPayment, 
  discount,
  couponCode,
  couponText,
  saleNumber
}) => {
  const paidVal = partialPayment ? parseFloat(partialPayment) : totalAmount;
  const remaining = Math.max(0, totalAmount - paidVal);

  return (
    <div 
      id="receipt-container" 
      style={{ 
        width: '500px', 
        padding: '30px', 
        background: '#ffffff', 
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: '#333333',
        position: 'absolute',
        left: '-9999px',
        top: 0,
        boxSizing: 'border-box',
        border: '3px solid #dfb180',
        borderRadius: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
      }}
    >
      {/* Decorative inner border */}
      <div style={{ border: '1px solid #f3d5b5', padding: '20px', borderRadius: '14px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img 
            src="/logo.jpeg" 
            alt="May Cosméticos" 
            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #dfb180', marginBottom: '8px' }}
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <h1 style={{ fontSize: '22px', margin: '0 0 2px 0', color: '#8c502b', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>MAY COSMÉTICOS</h1>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#888', fontStyle: 'italic' }}>– Beleza & Bem-Estar –</p>
          
          <div style={{ background: '#faf3ec', color: '#8c502b', padding: '6px 14px', borderRadius: '20px', display: 'inline-block', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ebd5c1' }}>
            COMPROVANTE DE VENDA & CUPOM {saleNumber ? `| Nº ${saleNumber}` : ''}
          </div>
        </div>

        {/* Customer & Order Metadata Box */}
        <div style={{ background: '#fcf8f5', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', border: '1px solid #f3e5d8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span><strong>CLIENTE:</strong> {customerName || 'Consumidor Final'}</span>
            <span><strong>DATA:</strong> {date}</span>
          </div>
          {customerPhone && (
            <div style={{ marginTop: '2px' }}>
              <span><strong>CONTATO:</strong> {customerPhone}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div style={{ marginBottom: '20px' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5e8dd', color: '#6d3c1d' }}>
                <th style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '6px 0 0 6px', width: '10%' }}>ITEM</th>
                <th style={{ textAlign: 'left', padding: '8px 8px', width: '50%' }}>DESCRIÇÃO</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', width: '12%' }}>QTD</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', width: '14%' }}>VALOR</th>
                <th style={{ textAlign: 'right', padding: '8px 8px', borderRadius: '0 6px 6px 0', width: '14%' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ textAlign: 'center', padding: '8px 4px', color: '#777' }}>{index + 1}</td>
                  <td style={{ textAlign: 'left', padding: '8px 8px', fontWeight: '500' }}>{item.description}</td>
                  <td style={{ textAlign: 'center', padding: '8px 4px' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px', color: '#666' }}>R$ {item.unitPrice.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 'bold' }}>R$ {item.totalPrice.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Subtotal & Discounts */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '20px', fontSize: '13px', gap: '4px' }}>
          <div style={{ width: '220px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Subtotal:</span>
            <span style={{ fontWeight: 'bold' }}>R$ {(totalAmount + (discount ? parseFloat(discount) : 0)).toFixed(2)}</span>
          </div>
          {discount && parseFloat(discount) > 0 && (
            <div style={{ width: '220px', display: 'flex', justifyContent: 'space-between', color: '#c62828' }}>
              <span>Desconto (PROMOÇÃO):</span>
              <span>- R$ {parseFloat(discount).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Payment Summary Box */}
        <div style={{ background: '#f5f9f6', border: '1px solid #c8e6c9', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            RESUMO DO PAGAMENTO
          </div>
          <div style={{ background: '#2e7d32', color: '#ffffff', padding: '10px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '8px', boxShadow: '0 2px 6px rgba(46,125,50,0.2)' }}>
            TOTAL PAGO: R$ {paidVal.toFixed(2)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#555', marginTop: '6px' }}>
            <span>Forma: <strong>{paymentMethod}</strong></span>
            {remaining > 0 ? (
              <span style={{ color: '#d97706', fontWeight: 'bold' }}>Saldo Restante (A Prazo): R$ {remaining.toFixed(2)}</span>
            ) : (
              <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>Saldo Restante: R$ 0,00 (Quitado)</span>
            )}
          </div>
        </div>

        {/* Optional Editable Coupon Block */}
        {couponCode && (
          <div style={{ background: '#fffcf5', border: '2px dashed #f59e0b', padding: '14px', borderRadius: '12px', textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#b45309', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              🎁 CUPOM DE DESCONTO EXCLUSIVO
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#8c502b', margin: '4px 0' }}>
              CUPOM: {couponCode}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {couponText || 'Apresente este cupom e ganhe um desconto especial na sua próxima compra!'}
            </div>
          </div>
        )}

        {/* Footer Social */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#777', borderTop: '1px dashed #ddd', paddingTop: '14px' }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#8c502b' }}>@maycosmeticos.2026</p>
          <p style={{ margin: 0, fontStyle: 'italic', fontSize: '11px' }}>Floresça a sua melhor versão 🌸</p>
        </div>

      </div>
    </div>
  );
};


