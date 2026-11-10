import {createContext,useContext} from 'react';
import type {StoragePolicy} from './storage-policy';
export const StorageContext=createContext<StoragePolicy|null>(null);
export function useStoragePolicy(){const value=useContext(StorageContext);if(!value)throw new Error('Storage configuration unavailable. Reopen the app.');return value;}
