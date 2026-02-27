
import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { db, auth } from '../services/firebase'; 
import { collection, doc, setDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { SECTOR_GOVERNORATES_MAP, SUPPORT_TEAM } from '../constants';

type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'update_progress' | 'reset' | 'fill' | 'manage';
type Resource = 'visits' | 'auditors' | 'team' | 'reports' | 'forms' | 'system' | 'users';

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; message?: string }>;
  signup: (data: Partial<User>) => Promise<string | null>;
  resetPassword: (email: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (action: Action, resource: Resource) => boolean;
  systemUsers: User[];
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = 'tveta_auth_user';

const SPECIAL_ADMINS = [
  { email: 'peterfathi2020@gmail.com', password: 'pepo_1759', name: 'Peter Fathi (Admin)' },
  { email: 'sayedjica2016@gmail.com', password: '01200355618', name: 'Sayed Jica (Admin)' }
];

// Helper to populate governorates based on role
const enrichUser = (user: User): User => {
    const enriched = { ...user };
    
    if (user.role === 'admin') {
        enriched.governorates = []; 
    } else if (user.role === 'sector_manager') {
        if (user.sector && SECTOR_GOVERNORATES_MAP[user.sector]) {
            enriched.governorates = SECTOR_GOVERNORATES_MAP[user.sector];
        } else {
             const staff = SUPPORT_TEAM.find(s => s.name === user.name || s.phone === user.phone);
             if (staff) {
                 enriched.sector = staff.sector;
                 enriched.governorates = staff.governorates;
             }
        }
    } else if (user.role === 'auditor') {
        if (user.governorate) {
            enriched.governorates = [user.governorate];
        }
    }
    return enriched;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [systemUsers, setSystemUsers] = useState<User[]>([]);

  // --- Real-time User Tracking & Presence ---
  useEffect(() => {
    if (!user || !db) return;

    // 1. Fetch all users to track their status (Online/Offline)
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
        const loadedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
        setSystemUsers(loadedUsers);
    }, (error) => {
        if (error.code === 'permission-denied') {
            console.warn("Permission denied for users collection. This is expected if Security Rules are not configured.");
        } else {
            console.error("Users sync error:", error);
        }
    });

    // 2. Heartbeat: Update current user's lastSeen every 2 minutes
    const userRef = doc(db, 'users', user.id);
    setDoc(userRef, { lastSeen: Date.now() }, { merge: true }).catch(() => {});

    const heartbeatInterval = setInterval(() => {
        setDoc(userRef, { lastSeen: Date.now() }, { merge: true }).catch(err => {
            if (err.code !== 'permission-denied') {
                console.error("Heartbeat fail", err);
            }
        });
    }, 120000); // 2 minutes

    return () => {
        usersUnsub();
        if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [user]); // Re-run when user changes (login/logout)


  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Check Hardcoded Admins
    const specialAdmin = SPECIAL_ADMINS.find(
      a => a.email.toLowerCase() === cleanEmail && a.password === cleanPass
    );

    if (specialAdmin) {
       const adminUser: User = {
         id: `admin_${cleanEmail}`,
         name: specialAdmin.name,
         email: specialAdmin.email,
         role: 'admin',
         password: specialAdmin.password 
       };
       setUser(adminUser);
       localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser));
       return { success: true };
    }

    // 2. Check Firestore
    if (!db) {
        return { success: false, message: 'قاعدة البيانات غير متصلة. يرجى التحقق من إعدادات Firebase.' };
    }
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, message: 'البريد الإلكتروني غير مسجل في النظام.' };
      }

      let foundUser: User | null = null;
      querySnapshot.forEach((doc) => {
        const userData = doc.data() as User;
        if (userData.password === cleanPass) {
          foundUser = { ...userData, id: doc.id }; // Ensure ID is captured
        }
      });

      if (foundUser) {
        const finalUser = enrichUser(foundUser);
        setUser(finalUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(finalUser));
        return { success: true };
      } else {
        return { success: false, message: 'كلمة المرور غير صحيحة.' };
      }

    } catch (error) {
      console.error("Login Error:", error);
      return { success: false, message: 'حدث خطأ في الاتصال بقاعدة البيانات.' };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    if (!auth || !db) {
        return { success: false, message: 'خدمة تسجيل الدخول غير متصلة. يرجى التحقق من إعدادات Firebase.' };
    }
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const firebaseUser = result.user;
        const email = firebaseUser.email?.toLowerCase();

        if (!email) {
            return { success: false, message: 'تعذر الحصول على البريد الإلكتروني من Google.' };
        }

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        let appUser: User;

        if (!querySnapshot.empty) {
            appUser = { ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id } as User;
        } else {
            const newId = firebaseUser.uid;
            appUser = {
                id: newId,
                name: firebaseUser.displayName || 'Google User',
                email: email,
                role: 'auditor', 
                password: '', 
                phone: firebaseUser.phoneNumber || '',
                governorate: 'غير محدد'
            };
            await setDoc(doc(db, 'users', newId), {
                ...appUser,
                createdAt: new Date().toISOString(),
                lastSeen: Date.now()
            });
            await setDoc(doc(db, 'auditors', newId), {
                id: newId,
                name: appUser.name,
                governorate: 'غير محدد',
                specialization: 'عام',
                phone: appUser.phone || '',
                status: 'Active',
                rating: 5
            });
        }

        const finalUser = enrichUser(appUser);
        setUser(finalUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(finalUser));
        return { success: true };

    } catch (error) {
        console.error("Google Login Error:", error);
        // @ts-expect-error - error type is unknown
        return { success: false, message: error.message || 'فشل الدخول باستخدام Google' };
    }
  };

  const signup = async (data: Partial<User>): Promise<string | null> => {
    if (!db) return "قاعدة البيانات غير متصلة.";
    const cleanEmail = data.email?.trim().toLowerCase();
    if (!cleanEmail) return "البريد الإلكتروني مطلوب";

    if (SPECIAL_ADMINS.find(a => a.email.toLowerCase() === cleanEmail)) {
        return "هذا البريد محجوز للإدارة العليا.";
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', cleanEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return "البريد الإلكتروني مسجل بالفعل.";
        }

        const newId = `user_${Date.now()}`;
        const newUser: User = {
            id: newId,
            name: data.name || 'User',
            email: cleanEmail,
            password: data.password || '',
            role: 'auditor', 
            governorate: data.governorate || '',
            phone: data.phone || '',
            specialization: data.specialization || 'عام'
        } as User;

        await setDoc(doc(db, 'users', newId), {
            ...newUser,
            createdAt: new Date().toISOString(),
            lastSeen: Date.now()
        });
        
        await setDoc(doc(db, 'auditors', newId), {
            id: newId,
            name: newUser.name,
            governorate: data.governorate || 'غير محدد',
            specialization: data.specialization || 'عام',
            phone: data.phone || '',
            status: 'Active',
            rating: 5
        });

        const finalUser = enrichUser(newUser);
        setUser(finalUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(finalUser));
        return null;
    } catch (error) {
      console.error(error);
      return "فشل إنشاء الحساب، يرجى المحاولة لاحقاً.";
    }
  };

  const resetPassword = async (): Promise<boolean> => {
    return true; 
  };

  const logout = () => {
    if (auth) auth.signOut().catch(() => {});
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // Enhanced Permission Check based on Role Hierarchy
  const hasPermission = (action: Action, resource: Resource): boolean => {
    if (!user) return false;
    
    if (user.role === 'admin') return true;

    const permissions: Record<string, Partial<Record<Resource, Action[]>>> = {
      sector_manager: {
        visits: ['view', 'create', 'edit', 'delete', 'update_progress'], // Added update_progress
        auditors: ['view', 'create', 'edit'],
        team: ['view', 'create', 'edit'],
        reports: ['view', 'approve'],
        forms: ['view', 'fill'],
        system: []
      },
      auditor: {
        visits: ['view', 'update_progress', 'create'], 
        auditors: ['view'],
        team: ['view'],
        reports: ['view', 'create', 'fill'],
        forms: ['view', 'fill'],
        system: []
      }
    };

    const rolePermissions = permissions[user.role];
    if (!rolePermissions) return false;

    const resourcePermissions = rolePermissions[resource];
    return resourcePermissions ? resourcePermissions.includes(action) : false;
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, signup, resetPassword, logout, isAuthenticated: !!user, hasPermission, systemUsers }}>
      {children}
    </AuthContext.Provider>
  );
};


