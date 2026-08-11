fetch("https://maycosmeticos.vercel.app/api/create-payment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ items: [{ id: "A5iWd3f23aZ8pT5kH", quantity: 1 }] })
})
.then(res => res.text().then(text => console.log(res.status, text)))
.catch(err => console.error(err));
