import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

export interface ClothingItem {
  id: string;
  name: string;
  category: string;
  color: string;
  imageUri?: string;
  description?: string;
  createdAt: number;
}

export interface OutfitResult {
  id: string;
  items: ClothingItem[];
  occasion: string;
  description: string;
  stylingTips: string[];
  imageBase64?: string;
  createdAt: number;
}

interface WardrobeContextValue {
  items: ClothingItem[];
  outfits: OutfitResult[];
  isLoading: boolean;
  addItem: (item: Omit<ClothingItem, "id" | "createdAt">) => Promise<ClothingItem>;
  removeItem: (id: string) => Promise<void>;
  addOutfit: (outfit: Omit<OutfitResult, "id" | "createdAt">) => Promise<void>;
  removeOutfit: (id: string) => Promise<void>;
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<OutfitResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [storedItems, storedOutfits] = await Promise.all([
        AsyncStorage.getItem("@stylist_wardrobe"),
        AsyncStorage.getItem("@stylist_outfits"),
      ]);
      if (storedItems) setItems(JSON.parse(storedItems));
      if (storedOutfits) setOutfits(JSON.parse(storedOutfits));
    } catch (e) {
      console.error("Failed to load wardrobe:", e);
    } finally {
      setIsLoading(false);
    }
  }

  const addItem = useCallback(async (item: Omit<ClothingItem, "id" | "createdAt">) => {
    const newItem: ClothingItem = {
      ...item,
      id: Crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setItems((prev) => {
      const updated = [newItem, ...prev];
      AsyncStorage.setItem("@stylist_wardrobe", JSON.stringify(updated));
      return updated;
    });
    return newItem;
  }, []);

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      AsyncStorage.setItem("@stylist_wardrobe", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addOutfit = useCallback(async (outfit: Omit<OutfitResult, "id" | "createdAt">) => {
    const newOutfit: OutfitResult = {
      ...outfit,
      id: Crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setOutfits((prev) => {
      const updated = [newOutfit, ...prev];
      AsyncStorage.setItem("@stylist_outfits", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeOutfit = useCallback(async (id: string) => {
    setOutfits((prev) => {
      const updated = prev.filter((o) => o.id !== id);
      AsyncStorage.setItem("@stylist_outfits", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({ items, outfits, isLoading, addItem, removeItem, addOutfit, removeOutfit }),
    [items, outfits, isLoading, addItem, removeItem, addOutfit, removeOutfit]
  );

  return <WardrobeContext.Provider value={value}>{children}</WardrobeContext.Provider>;
}

export function useWardrobe() {
  const context = useContext(WardrobeContext);
  if (!context) throw new Error("useWardrobe must be used within WardrobeProvider");
  return context;
}
