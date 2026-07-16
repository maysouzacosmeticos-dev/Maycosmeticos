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
  items: ReceiptItem[];
  date: string;
  paymentMethod: string;
  installments: number;
  totalAmount: number;
  partialPayment: string;
  discount?: string;
}

export const Receipt: React.FC<ReceiptProps> = ({ customerName, items, date, paymentMethod, installments, totalAmount, partialPayment, discount }) => {
  return (
    <div 
      id="receipt-container" 
      style={{ 
        width: '400px', // More like a thermal receipt width but slightly wider for readability
        padding: '40px', 
        background: '#ffffff', 
        fontFamily: "'Courier New', Courier, monospace", // Classic receipt font
        color: '#000000',
        position: 'absolute',
        left: '-9999px',
        top: 0,
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px dashed #000', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>May Cosméticos</h1>
        <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>Rua Exemplo, 123 - Centro</p>
        <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>CNPJ: 00.000.000/0001-00</p>
        <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>Tel: (11) 99999-9999</p>
        <h2 style={{ fontSize: '20px', margin: 0, fontWeight: 'bold' }}>EXTRATO DE COMPRA</h2>
      </div>

      {/* Customer Info */}
      <div style={{ marginBottom: '20px', fontSize: '14px', lineHeight: '1.5' }}>
        <p style={{ margin: 0 }}><strong>Data:</strong> {date}</p>
        <p style={{ margin: 0 }}><strong>Cliente:</strong> {customerName || 'Consumidor Final'}</p>
        <p style={{ margin: 0 }}><strong>Vendedor:</strong> May</p>
      </div>

      {/* Items Table */}
      <div style={{ borderTop: '2px dashed #000', borderBottom: '2px dashed #000', padding: '15px 0', marginBottom: '20px' }}>
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingBottom: '10px', width: '15%' }}>QTD</th>
              <th style={{ textAlign: 'left', paddingBottom: '10px', width: '45%' }}>DESCRIÇÃO</th>
              <th style={{ textAlign: 'right', paddingBottom: '10px', width: '20%' }}>VL. UN.</th>
              <th style={{ textAlign: 'right', paddingBottom: '10px', width: '20%' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td style={{ verticalAlign: 'top', paddingTop: '5px' }}>{item.quantity}</td>
                <td style={{ verticalAlign: 'top', paddingTop: '5px', paddingRight: '10px' }}>
                  {item.description.length > 25 ? item.description.substring(0, 25) + '...' : item.description}
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: '5px' }}>
                  {item.unitPrice.toFixed(2)}
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: '5px' }}>
                  {item.totalPrice.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ marginBottom: '30px', fontSize: '16px' }}>
        
        {discount && parseFloat(discount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#555', fontSize: '14px' }}>
            <span>DESCONTO:</span>
            <span>- R$ {parseFloat(discount).toFixed(2)}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 'bold', fontSize: '18px' }}>
          <span>TOTAL A PAGAR:</span>
          <span>R$ {totalAmount.toFixed(2)}</span>
        </div>
        
        {partialPayment && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#555', fontSize: '14px' }}>
            <span>Valor Pago (Parcial):</span>
            <span>- R$ {parseFloat(partialPayment).toFixed(2)}</span>
          </div>
        )}

        {partialPayment && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontWeight: 'bold' }}>
            <span>RESTANTE:</span>
            <span>R$ {(totalAmount - parseFloat(partialPayment)).toFixed(2)}</span>
          </div>
        )}

        <div style={{ borderTop: '1px solid #000', paddingTop: '10px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
          <span>Forma de Pagamento:</span>
          <span style={{ fontWeight: 'bold' }}>{paymentMethod} {paymentMethod === 'Cartão' ? `(${installments}x)` : ''}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '14px', borderTop: '2px dashed #000', paddingTop: '20px' }}>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>OBRIGADO PELA PREFERÊNCIA!</p>
        <p style={{ margin: 0, fontSize: '12px' }}>* Documento sem valor fiscal *</p>
      </div>
    </div>
  );
};


