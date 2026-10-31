import { createContext, useContext } from 'react';
export const ArenaContext = createContext(null);
export const useArena = () => useContext(ArenaContext);
