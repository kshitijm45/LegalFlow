import { create } from 'zustand'

interface UIState {
  selectedDocumentId: string
  setSelectedDocument: (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedDocumentId: 'doc-1',
  setSelectedDocument: (id) => set({ selectedDocumentId: id }),
}))
