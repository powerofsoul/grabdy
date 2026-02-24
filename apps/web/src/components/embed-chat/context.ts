import { createContext, useContext } from 'react';

const EmbedContext = createContext(false);

export const EmbedProvider = EmbedContext.Provider;

export function useIsEmbed(): boolean {
  return useContext(EmbedContext);
}
