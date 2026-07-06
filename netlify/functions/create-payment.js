exports.handler = async function(event, context) {
  // Apenas aceitar POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body);

    // Fazer a requisição para a InfinitePay
    const response = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // Retornar a resposta da InfinitePay para o frontend
    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Erro na Netlify Function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro interno no servidor" })
    };
  }
};
