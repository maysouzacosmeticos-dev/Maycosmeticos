import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
let firebaseConfig;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    firebaseConfig = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
} catch (e) {
  console.error("Error parsing FIREBASE_SERVICE_ACCOUNT", e);
}

if (!getApps().length && firebaseConfig) {
  try {
    initializeApp({
      credential: cert(firebaseConfig)
    });
  } catch (error) {
    console.error('Firebase Admin initialization error', error.stack);
  }
}

const db = getApps().length ? getFirestore() : null;

export default async function handler(req, res) {
  // CORS Configuration
  const allowedOrigins = [
    'https://resonant-queijadas-a99c55.netlify.app', 
    'https://maycosmeticos.vercel.app',
    'http://localhost:5173'
  ];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Missing FIREBASE_SERVICE_ACCOUNT variable in Vercel. Please add it to your project environment variables.' });
  }

  try {
    const { items, customerInfo } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty items array' });
    }
    if (!customerInfo || !customerInfo.phone) {
      return res.status(400).json({ error: 'Customer phone is required' });
    }

    const validatedItems = [];
    let cartTotalCalc = 0;
    
    // Fetch real prices from Firestore
    for (const item of items) {
      if (!item.id || !item.quantity) {
        return res.status(400).json({ error: 'Item missing id or quantity' });
      }

      const productRef = db.collection('products').doc(item.id);
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        return res.status(404).json({ error: `Product with ID ${item.id} not found` });
      }

      const productData = productSnap.data();
      const priceInCents = Math.round(productData.price * 100);
      cartTotalCalc += (productData.price * parseInt(item.quantity, 10));

      validatedItems.push({
        id: item.id,
        description: productData.name || 'Produto',
        price: priceInCents,
        quantity: parseInt(item.quantity, 10),
        // For our own db storage:
        originalPrice: productData.price 
      });
    }

    // 1. Manage Customer Profile (Deduplication)
    const customerId = customerInfo.phone.replace(/\D/g, "");
    const customerRef = db.collection("customers").doc(customerId);
    
    await customerRef.set({
      name: customerInfo.name?.trim() || "Cliente Sem Nome",
      phone: customerInfo.phone || "",
      address: customerInfo.address || "",
      lastPurchase: new Date().toISOString()
    }, { merge: true });

    // 2. Create the Sale Document in Firebase (status: pending)
    const newSaleRef = db.collection("sales").doc(); // auto-generate ID
    const saleId = newSaleRef.id;
    
    const method = req.body.method || 'InfinitePay'; // 'InfinitePay' or 'WhatsApp'

    await newSaleRef.set({
      date: new Date().toISOString(),
      items: validatedItems.map(vi => ({
        id: vi.id,
        name: vi.description,
        price: vi.originalPrice,
        quantity: vi.quantity
      })),
      total: cartTotalCalc,
      method: method, 
      source: 'Online',
      status: 'pendente',
      customerName: customerInfo.name?.trim() || "Cliente Sem Nome",
      customerId: customerId,
      customerPhone: customerInfo.phone || "",
      customerAddress: customerInfo.address || "",
      amountPaid: 0,
      infinitePayOrderId: method !== 'WhatsApp' ? saleId : null
    });

    if (method === 'WhatsApp') {
      // No need to contact InfinitePay
      return res.status(200).json({ success: true, saleId: saleId });
    }

    // 3. Construct the payload for InfinitePay with our Sale ID as order_nsu
    const payload = {
      handle: "maycosmeticos26",
      redirect_url: origin || "https://maycosmeticos.vercel.app",
      order_nsu: saleId, 
      items: validatedItems.map(vi => ({
        id: vi.id,
        description: vi.description,
        price: vi.price,
        quantity: vi.quantity
      }))
    };

    // 4. Request the Checkout Link
    const response = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    // We return both the InfinitePay data and the created sale ID
    return res.status(response.status).json({ ...data, saleId: saleId });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
