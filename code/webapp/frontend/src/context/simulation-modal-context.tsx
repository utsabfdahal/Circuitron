import React, { createContext, useContext, useState } from "react";

interface SimulationModalContextType {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

const SimulationModalContext = createContext<
  SimulationModalContextType | undefined
>(undefined);

export const useSimulationModal = () => {
  const context = useContext(SimulationModalContext);
  if (!context) {
    throw new Error(
      "useSimulationModal must be used within a SimulationModalProvider"
    );
  }
  return context;
};

export const SimulationModalProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <SimulationModalContext.Provider value={{ isModalOpen, setIsModalOpen }}>
      {children}
    </SimulationModalContext.Provider>
  );
};
