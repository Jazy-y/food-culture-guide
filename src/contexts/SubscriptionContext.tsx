import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '../config/firebase';
import { subscriptionService } from '../services/subscription-service';

interface SubscriptionData {
  plan: "free" | "basic" | "premium";
  scansRemaining?: number;
  features?: {
    scansRemaining?: number;
    dailyRecognitions?: number;
    offlineTranslations?: boolean;
    voiceInput?: boolean;
    culturalInsights?: boolean;
    [key: string]: any;
  };
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  error: Error | null;
  refreshSubscription: () => Promise<void>;
  hasFeature: (featureName: string) => boolean;
  remainingScans: number;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  loading: true,
  error: null,
  refreshSubscription: async () => {},
  hasFeature: () => false,
  remainingScans: 0
});

export const useSubscription = () => useContext(SubscriptionContext);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [remainingScans, setRemainingScans] = useState<number>(10); // Default value
  
  const loadSubscription = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const userId = auth.currentUser.uid;
      const userSubscription = await subscriptionService.getUserSubscription(userId);
      
      // Convert to our internal SubscriptionData format
      if (userSubscription) {
        // Safely cast as any to handle potential type mismatch between API and our types
        const apiSubscription = userSubscription as any;
        
        const subData: SubscriptionData = {
          plan: apiSubscription.plan,
          scansRemaining: apiSubscription.scansRemaining,
          features: apiSubscription.features
        };
        
        setSubscription(subData);
        
        // Set remaining scans based on subscription type
        const scans = 
          subData.scansRemaining || 
          subData.features?.scansRemaining || 
          subData.features?.dailyRecognitions || 
          (subData.plan === 'premium' ? Infinity : 10);
        
        setRemainingScans(scans);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error loading subscription:', err);
      setError(err instanceof Error ? err : new Error('Failed to load subscription'));
    } finally {
      setLoading(false);
    }
  };
  
  // Load subscription when auth state changes
  useEffect(() => {
    loadSubscription();
    
    // Set up listener for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadSubscription();
      } else {
        setSubscription(null);
        setRemainingScans(10); // Reset to default
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  const hasFeature = (featureName: string): boolean => {
    if (!subscription) return false;
    
    // Premium has everything
    if ((subscription.plan as 'free' | 'basic' | 'premium') === 'premium') return true;
    
    // Check for specific features
    if (subscription.features && featureName in subscription.features) {
      return Boolean(subscription.features[featureName]);
    }
    
    // Basic feature checks
    switch (featureName) {
      case 'foodRecognition':
        return true; // Available to all users with limited scans
      case 'cultureInsights':
        return subscription.plan !== 'free';
      case 'advancedTranslation':
        return subscription.plan === 'premium';
      default:
        return false;
    }
  };
  
  const refreshSubscription = async () => {
    await loadSubscription();
  };
  
  const value = {
    subscription,
    loading,
    error,
    refreshSubscription,
    hasFeature,
    remainingScans
  };
  
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionProvider; 