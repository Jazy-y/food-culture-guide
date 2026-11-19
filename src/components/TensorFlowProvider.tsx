import React, { createContext, useContext } from 'react';

// Create a mock context with fake values that don't require the actual TensorFlow
interface TensorFlowContextType {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  model: any;
  initialize: () => Promise<void>;
}

// Default context value - everything is mocked
const defaultContext: TensorFlowContextType = {
  isLoaded: true,
  isLoading: false,
  error: null,
  model: null,
  initialize: async () => { console.log('Mock TensorFlow initialized'); }
};

const TensorFlowContext = createContext<TensorFlowContextType>(defaultContext);

export const useTensorFlow = () => useContext(TensorFlowContext);

interface TensorFlowProviderProps {
  children: React.ReactNode;
  modelJSON?: any;
  modelWeights?: any;
}

// Simple provider that just renders children with mock TensorFlow context
export const TensorFlowProvider: React.FC<TensorFlowProviderProps> = ({ 
  children 
}) => {
  // Just pass the default context value
  return (
    <TensorFlowContext.Provider value={defaultContext}>
      {children}
    </TensorFlowContext.Provider>
  );
};

export default TensorFlowProvider; 