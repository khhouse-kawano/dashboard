/** staff テーブルのうち、認証後にアプリ内で持ち回る最小限の情報 */
export interface AuthenticatedStaff {
  id: number;
  name: string;
  mail: string;
  brand: string;
  shop: string;
}
