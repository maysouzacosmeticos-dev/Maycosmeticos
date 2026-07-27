import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Missing FIREBASE_SERVICE_ACCOUNT variable.' });
  }

  try {
    const payload = req.body;
    console.log("Received InfinitePay Webhook:", payload);

    // Assuming the webhook payload contains the order_nsu (our saleId) and a status field.
    // InfinitePay usually sends `metadata.order_nsu` or similar. Let's try to extract it robustly.
    const saleId = payload.order_nsu || payload.metadata?.order_nsu || payload.id;
    const status = payload.status || payload.state; // e.g., 'approved', 'paid'
    
    // Check if it's a successful payment
    const isPaid = status === 'approved' || status === 'paid' || status === 'settled';

    if (!saleId) {
      return res.status(400).json({ error: 'Missing order ID in webhook' });
    }

    if (isPaid) {
      const saleRef = db.collection('sales').doc(saleId);
      
      // Use a transaction to ensure we only deduct stock once
      await db.runTransaction(async (transaction) => {
        const saleDoc = await transaction.get(saleRef);
        
        if (!saleDoc.exists) {
          throw new Error("Sale not found");
        }
        
        const saleData = saleDoc.data();
        
        // If already paid, do nothing
        if (saleData.status === 'pago') {
          return;
        }

        // 1. Mark sale as paid
        transaction.update(saleRef, {
          status: 'pago',
          amountPaid: saleData.total || 0,
          paidAt: new Date().toISOString()
        });

        // 2. Deduct inventory for each item
        if (saleData.items && Array.isArray(saleData.items)) {
          for (const item of saleData.items) {
            const productRef = db.collection('products').doc(item.id);
            // using increment to subtract the quantity safely
            transaction.update(productRef, {
              stock: FieldValue.increment(-item.quantity)
            });
          }
        }
      });
      
      console.log(`Sale ${saleId} marked as paid and stock deducted.`);
    }

    // Always return 200 OK to the webhook provider so they don't retry
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    // Still returning 200 is sometimes safer if the error is our fault (e.g. sale not found), 
    // but 500 will make InfinitePay retry if that's preferred.
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
