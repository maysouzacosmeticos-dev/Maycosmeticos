import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

let firebaseConfig;
try {
  // Try to find the service account key if we have it locally, or we'll just fail.
  // Wait, I don't have the key locally!
  console.log("No key");
} catch (e) {}
