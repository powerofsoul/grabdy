export abstract class EncryptionService {
  abstract encrypt(plaintext: string): Promise<string>;
  abstract decrypt(encrypted: string): Promise<string>;
}
