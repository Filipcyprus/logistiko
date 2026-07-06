// Δημιουργία τυχαίου έγκυρου barcode τύπου EAN-13 (12 ψηφία + check digit).
export function generateBarcode() {
  let digits = "";
  for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return digits + check;
}
