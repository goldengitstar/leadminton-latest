export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  stats: Partial<Record<StatBonus, number>>;
  price_coins:number;
  price_diamonds:number;
  price_shuttlecocks:number;
  imageUrl: string;
}

export type EquipmentType = 'shoes' | 'racket' | 'strings' | 'shirt' | 'shorts';
export type EquipmentRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type StatBonus = 
  | 'endurance' 
  | 'strength' 
  | 'agility' 
  | 'speed' 
  | 'explosiveness' 
  | 'smash' 
  | 'defense' 
  | 'serve';

export interface PlayerEquipment {
  shoes?: Equipment;
  racket?: Equipment;
  strings?: Equipment;
  shirt?: Equipment;
  shorts?: Equipment;
}