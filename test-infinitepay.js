fetch("https://api.checkout.infinitepay.io/links", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    handle: "maycosmeticos26",
    redirect_url: "https://maycosmeticos.vercel.app",
    order_nsu: "123456",
    items: [{ id: "prod1", description: "Teste", price: 1000, quantity: 1 }]
  })
})
.then(res => res.text().then(text => console.log(res.status, text)))
.catch(err => console.error(err));
