const handles = ["maycosmeticos", "$maycosmeticos"];

async function test() {
  for (const handle of handles) {
    console.log(`Testing handle: ${handle}`);
    try {
      const res = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          handle: handle,
          redirect_url: 'https://google.com',
          items: [{description: 'Produto', price: 1500, quantity: 1}]
        })
      });
      const data = await res.json();
      console.log(data);
    } catch(e) {
      console.error(e.message);
    }
  }
}

test();
