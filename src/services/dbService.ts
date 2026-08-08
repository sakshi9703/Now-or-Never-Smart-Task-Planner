import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, Timestamp, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { Task, UserProfile, DailyPlan, SheetsSyncConfig } from "../types";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write"
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, userId?: string): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: userId || "unauthenticated",
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function removeUndefined(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

/**
 * Retrieves the user profile from Firestore or returns null.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path, userId);
  }
}

/**
 * Saves or updates a user profile.
 */
export async function saveUserProfile(userId: string, email: string, data: Partial<UserProfile>): Promise<void> {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, "users", userId);
    const filteredData = removeUndefined({ ...data });
    delete filteredData.updatedAt;
    const payload = {
      userId,
      email,
      updatedAt: serverTimestamp(),
      ...filteredData
    };
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, userId);
  }
}

/**
 * Retrieves all tasks for a specific user.
 */
export async function getUserTasks(userId: string): Promise<Task[]> {
  const path = `users/${userId}/tasks`;
  try {
    const colRef = collection(db, "users", userId, "tasks");
    const querySnapshot = await getDocs(colRef);
    const tasks: Task[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const task = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as Task;
      tasks.push(task);
    });
    return tasks;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, userId);
  }
}

/**
 * Creates a new task.
 */
export async function createNewTask(userId: string, taskId: string, task: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">): Promise<Task> {
  const path = `users/${userId}/tasks/${taskId}`;
  try {
    const docRef = doc(db, "users", userId, "tasks", taskId);
    const payload = {
      ...removeUndefined(task),
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(docRef, payload);
    return {
      id: taskId,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...task
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path, userId);
  }
}

/**
 * Updates an existing task.
 */
export async function updateExistingTask(userId: string, taskId: string, taskUpdates: Partial<Task>): Promise<void> {
  const path = `users/${userId}/tasks/${taskId}`;
  try {
    const docRef = doc(db, "users", userId, "tasks", taskId);
    // filter out system variables and immutables
    const filteredUpdates: any = removeUndefined({ ...taskUpdates });
    delete filteredUpdates.id;
    delete filteredUpdates.userId;
    delete filteredUpdates.createdAt;
    delete filteredUpdates.updatedAt;
    
    filteredUpdates.updatedAt = serverTimestamp();
    
    await setDoc(docRef, filteredUpdates, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path, userId);
  }
}

/**
 * Deletes a task.
 */
export async function deleteExistingTask(userId: string, taskId: string): Promise<void> {
  const path = `users/${userId}/tasks/${taskId}`;
  try {
    const docRef = doc(db, "users", userId, "tasks", taskId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path, userId);
  }
}
