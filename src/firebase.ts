import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// COLOQUE SUAS CHAVES AQUI
const firebaseConfig = {
  apiKey: "AIzaSyBgTXCpcl8M315iYhIPwOov--icfDqiNoU",
  authDomain: "may-cosmeticos-app.firebaseapp.com",
  projectId: "may-cosmeticos-app",
  storageBucket: "may-cosmeticos-app.firebasestorage.app",
  messagingSenderId: "970865036869",
  appId: "1:970865036869:web:7186b0922c08be5cc41d2c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
