import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  originalProfile: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
  impersonate: (profileToImpersonate: Profile | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  originalProfile: null,
  loading: true,
  logout: async () => {},
  impersonate: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (!error && data) {
        setOriginalProfile(data as Profile);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    }).catch(err => {
      console.error("useAuth: getSession error:", err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setOriginalProfile(null);
          setImpersonatedProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const impersonate = (profileToImpersonate: Profile | null) => {
    setImpersonatedProfile(profileToImpersonate);
  };

  // Resolve active profile (use impersonated one if set, otherwise original)
  const activeProfile = impersonatedProfile || originalProfile;

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        profile: activeProfile, 
        originalProfile, 
        loading, 
        logout, 
        impersonate 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
