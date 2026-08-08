import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDwdXtm5SSxDAW0BhWpH8tYEwosv06kW9U",
  authDomain: "now-or-never-43dfd.firebaseapp.com",
  projectId: "now-or-never-43dfd",
  storageBucket: "now-or-never-43dfd.firebasestorage.app",
  messagingSenderId: "1038581551072",
  appId: "1:1038581551072:web:c1a7d91fb824646c6c6585",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();

let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onAuthSuccess?.(user);
    } else {
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (): Promise<User | null> => {
  try {
    isSigningIn = true;

    const result = await signInWithPopup(auth, provider);

    console.log("Google user:", result.user.email);

    console.log(result.user.uid);
    console.log(result.user.email);

    return result.user;
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  await auth.signOut();
};