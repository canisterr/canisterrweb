import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";

type Subscriber = {
  onValue: (value: unknown | null) => void;
  onError?: (error: Error) => void;
};

type SharedSubscription = {
  subscribers: Set<Subscriber>;
  unsubscribe: (() => void) | null;
  value: unknown | null;
  hasValue: boolean;
};

const subscriptions = new Map<string, SharedSubscription>();

/** Share one RTDB notifications listener when the bell and page are mounted together. */
export function subscribeToUserNotifications(
  userId: string,
  onValueChange: Subscriber["onValue"],
  onError?: Subscriber["onError"]
) {
  let shared = subscriptions.get(userId);
  if (!shared) {
    shared = { subscribers: new Set(), unsubscribe: null, value: null, hasValue: false };
    subscriptions.set(userId, shared);
  }

  const subscriber: Subscriber = { onValue: onValueChange, onError };
  shared.subscribers.add(subscriber);
  if (shared.hasValue) onValueChange(shared.value);

  if (!shared.unsubscribe) {
    const current = shared;
    current.unsubscribe = onValue(
      ref(db, `notifications/${userId}`),
      (snapshot) => {
        current.value = snapshot.exists() ? snapshot.val() : null;
        current.hasValue = true;
        for (const item of current.subscribers) item.onValue(current.value);
      },
      (error) => {
        for (const item of current.subscribers) item.onError?.(error);
      }
    );
  }

  return () => {
    shared?.subscribers.delete(subscriber);
    if (shared && shared.subscribers.size === 0) {
      shared.unsubscribe?.();
      subscriptions.delete(userId);
    }
  };
}
