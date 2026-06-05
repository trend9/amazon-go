import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AmazonProductArticle } from './types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Sign in using Firebase Google Auth popup.
 */
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Sign out from Google Auth.
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Seed initial articles into Firestore if the articles collection is empty.
 */
export async function seedArticlesIfEmpty(initialArticles: AmazonProductArticle[]): Promise<void> {
  try {
    const articlesCol = collection(db, 'articles');
    const snap = await getDocs(articlesCol);
    if (snap.empty) {
      console.log('Firestore articles collection is empty; seeding default articles...');
      for (const art of initialArticles) {
        await setDoc(doc(db, 'articles', art.id), art);
      }
      console.log('Successfully seeded default articles in Firestore.');
    }
  } catch (err) {
    console.warn('Seeding articles failed (possibly due to read rules or offline mode):', err);
  }
}

/**
 * Subscribes to real-time articles updates in Firestore.
 * Falls back if rules deny access or database is not reachable.
 */
export function subscribeToArticles(
  onUpdate: (articles: AmazonProductArticle[]) => void,
  onError: (error: any) => void
) {
  const articlesCol = collection(db, 'articles');
  return onSnapshot(articlesCol, (snapshot) => {
    const articlesList: AmazonProductArticle[] = [];
    snapshot.forEach((docSnap) => {
      articlesList.push(docSnap.data() as AmazonProductArticle);
    });
    
    // Sort by createdAt descending
    articlesList.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    onUpdate(articlesList);
  }, (err) => {
    console.error('Firestore real-time subscription error:', err);
    onError(err);
  });
}

/**
 * Adds an article to Firestore.
 */
export async function saveArticleToFirestore(art: AmazonProductArticle): Promise<void> {
  await setDoc(doc(db, 'articles', art.id), art);
}

/**
 * Deletes an article from Firestore.
 */
export async function deleteArticleFromFirestore(id: string): Promise<void> {
  await deleteDoc(doc(db, 'articles', id));
}

/**
 * Syncs the global affiliate configurations to Firestore.
 */
export async function saveSettingsToFirestore(associateId: string, fallbackAdUrl: string): Promise<void> {
  await setDoc(doc(db, 'settings', 'config'), { associateId, fallbackAdUrl });
}

/**
 * Subscribes to settings config in Firestore.
 */
export function subscribeToSettings(
  onUpdate: (settings: { associateId: string; fallbackAdUrl: string }) => void
) {
  const settingsDocRef = doc(db, 'settings', 'config');
  return onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      onUpdate({
        associateId: data.associateId || 'amazongo-22',
        fallbackAdUrl: data.fallbackAdUrl || 'https://www.amazon.co.jp',
      });
    }
  }, (err) => {
    console.warn('Config subscription read error (using local state fallback):', err);
  });
}
