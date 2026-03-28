import * as ExpoCrypto from 'expo-crypto';

export const generateUUID = (): string => ExpoCrypto.randomUUID();
