import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  OAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  type UserCredential,
} from 'firebase/auth';

/**
 * Firebase client config — loaded from environment variables.
 *
 * Set these in apps/web/.env.local:
 *   NEXT_PUBLIC_FIREBASE_API_KEY=...
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
 *   NEXT_PUBLIC_FIREBASE_APP_ID=...
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// Check if Firebase is properly configured
export const isFirebaseConfigured =
  !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

// Initialize Firebase (singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = isFirebaseConfigured ? getAuth(app) : null;

// Providers
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

/**
 * Sign in with Google popup.
 * Returns the Firebase ID token to exchange with our backend.
 */
export async function signInWithGoogle(): Promise<string> {
  if (!auth) throw new Error('Firebase is not configured');

  try {
    const result: UserCredential = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return idToken;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed');
    }
    if (error.code === 'auth/popup-blocked') {
      // Fallback to redirect
      await signInWithRedirect(auth, googleProvider);
      throw new Error('Redirecting to Google sign-in...');
    }
    throw new Error(error.message || 'Google sign-in failed');
  }
}

/**
 * Sign in with Apple popup.
 * Returns the Firebase ID token to exchange with our backend.
 */
export async function signInWithApple(): Promise<string> {
  if (!auth) throw new Error('Firebase is not configured');

  try {
    const result: UserCredential = await signInWithPopup(auth, appleProvider);
    const idToken = await result.user.getIdToken();
    return idToken;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed');
    }
    throw new Error(error.message || 'Apple sign-in failed');
  }
}

/**
 * Handle redirect result (called on page load after redirect sign-in).
 */
export async function handleRedirectResult(): Promise<string | null> {
  if (!auth) return null;

  try {
    const result = await getRedirectResult(auth);
    if (result) {
      return await result.user.getIdToken();
    }
    return null;
  } catch {
    return null;
  }
}

function mapAuthError(error: any): Error {
  const code = error?.code as string | undefined;
  switch (code) {
    case 'auth/email-already-in-use':
      return new Error('An account with this email already exists. Please log in.');
    case 'auth/invalid-email':
      return new Error('Please enter a valid email address.');
    case 'auth/weak-password':
      return new Error('Password must be at least 6 characters.');
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return new Error('Incorrect email or password.');
    case 'auth/too-many-requests':
      return new Error('Too many attempts. Try again in a minute.');
    case 'auth/operation-not-allowed':
      return new Error('Email/password sign-in is not enabled in Firebase.');
    default:
      return new Error(error?.message || 'Authentication failed');
  }
}

/**
 * Create a Firebase account with email + password.
 * Returns the Firebase ID token to exchange with our backend.
 */
export async function signUpWithEmailPassword(email: string, password: string): Promise<string> {
  if (!auth) throw new Error('Firebase is not configured');
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return await result.user.getIdToken();
  } catch (error: any) {
    throw mapAuthError(error);
  }
}

/**
 * Sign in to an existing Firebase account with email + password.
 * Returns the Firebase ID token to exchange with our backend.
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<string> {
  if (!auth) throw new Error('Firebase is not configured');
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return await result.user.getIdToken();
  } catch (error: any) {
    throw mapAuthError(error);
  }
}

/**
 * Send a password reset email.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase is not configured');
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    throw mapAuthError(error);
  }
}

/**
 * Sign out from Firebase.
 */
export async function firebaseSignOut(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

export { auth };
