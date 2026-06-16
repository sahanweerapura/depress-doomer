// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtJWsorffo_XelURev7V6gIjKzf7NUwz4",
  authDomain: "depress-doomer-e7ba5.firebaseapp.com",
  projectId: "depress-doomer-e7ba5",
  storageBucket: "depress-doomer-e7ba5.firebasestorage.app",
  messagingSenderId: "607911895768",
  appId: "1:607911895768:web:b13a5b09c9f4d26fcdadad",
  measurementId: "G-JGEE387PC3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
