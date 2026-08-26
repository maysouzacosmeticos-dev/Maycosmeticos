export const sendDigitalPaymentReceipt = (
  customerName: string,
  customerPhone: string,
  amountPaidNow: number,
  remainingDebt: number,
  paymentMethod: string = 'Pix / Dinheiro'
) => {
  const cleanPhone = (customerPhone || '').replace(/\D/g, '');
  const nowStr = new Date().toLocaleString('pt-BR');
  const isFullyPaid = remainingDebt <= 0;

  let msg = `🧾 *RECIBO DIGITAL DE PAGAMENTO*\n`;
  msg += `*May Cosméticos - Beleza & Bem-Estar*\n\n`;
  msg += `👤 *Cliente:* ${customerName || 'Cliente'}\n`;
  msg += `📅 *Data/Hora:* ${nowStr}\n`;
  msg += `💵 *Valor Recebido Hoje:* R$ ${amountPaidNow.toFixed(2)}\n`;
  msg += `💳 *Forma de Pagamento:* ${paymentMethod}\n`;
  msg += `-----------------------------------\n`;
  
  if (isFullyPaid) {
    msg += `🎉 *Status:* Conta Quitada 100% (Saldo ZERADO)!\n`;
  } else {
    msg += `📌 *Saldo Devedor Restante:* R$ ${remainingDebt.toFixed(2)}\n`;
  }
  
  msg += `\n*Agradecemos a sua preferência!* 💖`;

  if (cleanPhone) {
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  } else {
    navigator.clipboard.writeText(msg).catch(() => {});
    alert(`Recibo Digital Gerado com Sucesso! (Copiado para área de transferência):\n\n` + msg);
  }
};
