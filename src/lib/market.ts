import { supabase } from "@/integrations/supabase/client";

export const CATEGORIES = [
  "Electronics",
  "Furniture",
  "Vehicles",
  "Fashion",
  "Books",
  "Home & Kitchen",
  "Sports",
  "Other",
] as const;

export type ListingType = "sell" | "donate" | "bid";
export type ListingStatus = "pending" | "approved" | "rejected" | "sold";

export interface Listing {
  id: string;
  owner_id: string;
  type: ListingType;
  title: string;
  description: string;
  price: number | null;
  category: string;
  location: string;
  photos: string[];
  status: ListingStatus;
  rejection_reason: string | null;
  bid_deadline: string | null;
  created_at: string;
  updated_at: string;
}

/** Normalize an Indian phone number to international digits (91XXXXXXXXXX). Returns null if invalid. */
export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  return null;
}

/** Synthetic auth credentials derived from the phone number (no email needed). */
export function authEmailFor(phoneDigits: string) {
  return `${phoneDigits}@rdxmarket.local`;
}
export function authPasswordFor(phoneDigits: string) {
  return `rdx-${phoneDigits}-market`;
}

export function formatINR(amount: number | null | undefined) {
  if (amount == null) return "";
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export function whatsappLink(phoneDigits: string, itemTitle: string) {
  const text = encodeURIComponent(
    `Hi! I saw your listing "${itemTitle}" on RDX Market and I'm interested.`,
  );
  return `https://wa.me/${phoneDigits}?text=${text}`;
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** Create (and cache) a signed URL for a photo in the private listing-photos bucket. */
export async function signedPhotoUrl(path: string): Promise<string> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase.storage
    .from("listing-photos")
    .createSignedUrl(path, 60 * 50);
  if (error || !data) return "";
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + 50 * 60 * 1000,
  });
  return data.signedUrl;
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 1024 * 1024) {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const maxWidth = 1400;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.75
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export async function uploadPhoto(userId: string, file: File): Promise<string> {
  const processedFile = await compressImage(file);
  const ext = processedFile.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("listing-photos")
    .upload(path, processedFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: processedFile.type,
    });
  if (error) throw new Error(error.message);
  signedUrlCache.delete(path);
  return path;
}

export function timeLeft(deadline: string, now: number): string {
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}
