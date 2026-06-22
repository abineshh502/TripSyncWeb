"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc,
  onSnapshot 
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { UserProfile } from "../types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresh profile manually if needed
  const refreshProfile = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        setProfile(userDoc.data() as UserProfile);
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch or create Firestore user profile
        const userDocRef = doc(db, "users", firebaseUser.uid);
        
        // Use real-time snapshot for profile so updates propagate instantly
        const unsubscribeProfile = onSnapshot(
          userDocRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              setProfile(snapshot.data() as UserProfile);
            } else {
              // Create default profile if it doesn't exist
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Traveler",
                email: firebaseUser.email || "",
                favorites: [],
                visited: [],
              };
              await setDoc(userDocRef, newProfile);
              setProfile(newProfile);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Profile listen error:", error);
            setLoading(false);
          }
        );

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
