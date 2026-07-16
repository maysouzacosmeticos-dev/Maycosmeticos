export function generatePixPayload(chave: string, valor: number, nome: string, cidade: string): string {
  const payloadFormat = '000201';
  const merchantAccountInfo = `0014br.gov.bcb.pix01${chave.length.toString().padStart(2, '0')}${chave}`;
  const accountInfoLength = merchantAccountInfo.length.toString().padStart(2, '0');
  const merchantCategoryCode = '52040000';
  const transactionCurrency = '5303986';
  
  const formattedValor = valor.toFixed(2);
  const transactionAmount = `54${formattedValor.length.toString().padStart(2, '0')}${formattedValor}`;
  
  const countryCode = '5802BR';
  // Limit length of name and city to fit EMV rules if needed, but usually short strings are fine.
  const merchantName = `59${nome.length.toString().padStart(2, '0')}${nome}`;
  const merchantCity = `60${cidade.length.toString().padStart(2, '0')}${cidade}`;
  
  const additionalData = `0503***`; // TxId ***
  const additionalDataField = `62${additionalData.length.toString().padStart(2, '0')}${additionalData}`;
  
  const payloadBase = `${payloadFormat}26${accountInfoLength}${merchantAccountInfo}${merchantCategoryCode}${transactionCurrency}${transactionAmount}${countryCode}${merchantName}${merchantCity}${additionalDataField}6304`;
  
  // Calculate CRC16 CCITT (0xFFFF)
  let crc = 0xFFFF;
  for (let i = 0; i < payloadBase.length; i++) {
    crc ^= payloadBase.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  crc = crc & 0xFFFF;
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
  
  return payloadBase + crcHex;
}
