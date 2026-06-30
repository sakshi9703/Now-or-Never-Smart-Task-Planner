
export function safeDate(value: any): Date | null {
  if (!value) return null;
  
  // Handle Firestore Timestamp (native or serialized/parsed JSON)
  if (typeof value === 'object' && value !== null) {
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate();
      } catch (e) {
        // Fallback
      }
    }
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }
    // Handle standard JS Date object
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function toISODateString(value: any): string | undefined {
  const date = safeDate(value);
  return date ? date.toISOString() : undefined;
}
