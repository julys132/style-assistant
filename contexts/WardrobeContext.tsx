import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useAuth } from "@/contexts/AuthContext";

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
const MAX_STORED_OUTFITS = 40;
const MAX_IMAGE_BASE64_LENGTH_FOR_STORAGE = 2_500_000;

function parseStoredArray<T>(rawValue: string | null): T[] {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function isStorageQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("quota") ||
    message.includes("sqlite_full") ||
    message.includes("database or disk is full")
  );
}

function sanitizeOutfitForStorage(outfit: OutfitResult): OutfitResult {
  if (!outfit.imageBase64 || outfit.imageBase64.length <= MAX_IMAGE_BASE64_LENGTH_FOR_STORAGE) {
    return outfit;
  }

  const { imageBase64: _imageBase64, ...rest } = outfit;
  return rest;
}

function removeImageFromOutfit(outfit: OutfitResult): OutfitResult {
  if (!outfit.imageBase64) return outfit;
  const { imageBase64: _imageBase64, ...rest } = outfit;
  return rest;
}

function shouldSyncOutfitState(current: OutfitResult[], persisted: OutfitResult[]): boolean {
  if (current.length !== persisted.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const persistedItem = persisted[index];
    if (!persistedItem || currentItem.id !== persistedItem.id) return true;
    if (currentItem.imageBase64 !== persistedItem.imageBase64) return true;
  }

  return false;
}

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<OutfitResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const wardrobeKey = user?.id ? `@stylist_wardrobe_${user.id}` : "@stylist_wardrobe_guest";
  const outfitsKey = user?.id ? `@stylist_outfits_${user.id}` : "@stylist_outfits_guest";

  const persistOutfits = useCallback(
    async (nextOutfits: OutfitResult[]): Promise<OutfitResult[]> => {
      const sanitized = nextOutfits
        .slice(0, MAX_STORED_OUTFITS)
        .map((outfit) => sanitizeOutfitForStorage(outfit));

      try {
        await AsyncStorage.setItem(outfitsKey, JSON.stringify(sanitized));
        return sanitized;
      } catch (error) {
        if (!isStorageQuotaError(error)) {
          throw error;
        }

        // Preserve most recent looks first. If storage is full, strip images from the oldest outfits.
        const trimmedByAge = [...sanitized];
        for (let index = trimmedByAge.length - 1; index >= 0; index -= 1) {
          if (!trimmedByAge[index].imageBase64) continue;
          trimmedByAge[index] = removeImageFromOutfit(trimmedByAge[index]);
          try {
            await AsyncStorage.setItem(outfitsKey, JSON.stringify(trimmedByAge));
            return trimmedByAge;
          } catch (retryError) {
            if (!isStorageQuotaError(retryError)) {
              throw retryError;
            }
          }
        }

        // If still too large, reduce total history length while keeping newest entries.
        for (let count = trimmedByAge.length - 1; count >= 0; count -= 1) {
          const candidate = trimmedByAge.slice(0, count);
          try {
            await AsyncStorage.setItem(outfitsKey, JSON.stringify(candidate));
            return candidate;
          } catch (retryError) {
            if (!isStorageQuotaError(retryError)) {
              throw retryError;
            }
          }
        }

        await AsyncStorage.removeItem(outfitsKey);
        return [];
      }
    },
    [outfitsKey],
  );

  const loadData = useCallback(async () => {
    try {
      const [storedItems, storedOutfits] = await Promise.all([
        AsyncStorage.getItem(wardrobeKey),
        AsyncStorage.getItem(outfitsKey),
      ]);
      setItems(parseStoredArray<ClothingItem>(storedItems));
      setOutfits(parseStoredArray<OutfitResult>(storedOutfits));
    } catch (e) {
      console.error("Failed to load wardrobe:", e);
      setItems([]);
      setOutfits([]);
    } finally {
      setIsLoading(false);
    }
  }, [wardrobeKey, outfitsKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const addItem = useCallback(async (item: Omit<ClothingItem, "id" | "createdAt">) => {
    const newItem: ClothingItem = {
      ...item,
      id: Crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setItems((prev) => {
      const updated = [newItem, ...prev];
      void AsyncStorage.setItem(wardrobeKey, JSON.stringify(updated)).catch((error) => {
        console.error("Failed to persist wardrobe items:", error);
      });
      return updated;
    });
    return newItem;
  }, [wardrobeKey]);

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      void AsyncStorage.setItem(wardrobeKey, JSON.stringify(updated)).catch((error) => {
        console.error("Failed to persist wardrobe items:", error);
      });
      return updated;
    });
  }, [wardrobeKey]);

  const addOutfit = useCallback(async (outfit: Omit<OutfitResult, "id" | "createdAt">) => {
    const newOutfit: OutfitResult = {
      ...outfit,
      id: Crypto.randomUUID(),
      createdAt: Date.now(),
    };
    const nextOutfits = [newOutfit, ...outfits];
    setOutfits(nextOutfits);

    const persisted = await persistOutfits(nextOutfits);
    if (shouldSyncOutfitState(nextOutfits, persisted)) {
      setOutfits(persisted);
    }
  }, [outfits, persistOutfits]);

  const removeOutfit = useCallback(async (id: string) => {
    const nextOutfits = outfits.filter((o) => o.id !== id);
    setOutfits(nextOutfits);

    try {
      const persisted = await persistOutfits(nextOutfits);
      if (shouldSyncOutfitState(nextOutfits, persisted)) {
        setOutfits(persisted);
      }
    } catch (e) {
      console.error("Failed to persist outfits:", e);
    }
  }, [outfits, persistOutfits]);

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
