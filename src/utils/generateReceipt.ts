import html2canvas from 'html2canvas';

export const shareReceiptToWhatsApp = async (elementId: string = 'receipt-container', customerName: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error("Receipt element not found");
    alert("Erro ao gerar recibo.");
    return;
  }

  try {
    // Make the element briefly visible for html2canvas to capture it properly
    const originalLeft = element.style.left;
    element.style.left = '0';
    
    const canvas = await html2canvas(element, {
      scale: 2, // High quality
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    // Hide it again
    element.style.left = originalLeft;

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const file = new File([blob], `Recibo_MayCosmeticos_${customerName.replace(/\s+/g, '_')}.png`, { type: 'image/png' });

      // Check if Web Share API with files is supported (mobile browsers mostly)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'Extrato de Compras - May Cosméticos',
            text: `Olá ${customerName}, aqui está o extrato da sua compra na May Cosméticos!`,
            files: [file]
          });
          console.log('Compartilhado com sucesso!');
        } catch (error) {
          console.error('Erro ao compartilhar:', error);
        }
      } else {
        // Fallback for desktop or unsupported browsers
        alert("O seu navegador não suporta envio direto. A imagem será baixada para você enviar manualmente.");
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  } catch (error) {
    console.error('Error generating receipt image:', error);
    alert('Erro ao gerar imagem do recibo.');
  }
};
