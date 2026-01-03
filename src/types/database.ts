export interface Location {
  id: string;
  created_at: string;
  name: string;
  type: 'warehouse' | 'port';
  latitude: number;
  longitude: number;
}

export type LocationInsert = Omit<Location, 'id' | 'created_at'>;
