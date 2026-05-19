import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            "AIzaSyChYNALFdJ--U8jtgIOwMMJ7h4jraatZCU",
  authDomain:        "gen-lang-client-0110716015.firebaseapp.com",
  projectId:         "gen-lang-client-0110716015",
  storageBucket:     "gen-lang-client-0110716015.firebasestorage.app",
  messagingSenderId: "607833833489",
  appId:             "1:607833833489:web:d502d98447b3ba887931b0",
}

const app = initializeApp(firebaseConfig)
export const db             = getFirestore(app)
export const auth           = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
