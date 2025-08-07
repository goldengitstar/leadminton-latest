import { useState, useEffect } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { Equipment, EquipmentType } from '../../types/equipment';
import { Resources } from '../../types/game';
import EquipmentCard from './EquipmentCard';
import { supabase } from '../../lib/supabase';

interface CustomizationModalProps {
  onClose: () => void;
  playerEquipment: Equipment[];
  onEquip: (equipment: Equipment) => void;
  resources: Resources;
}

const EQUIPMENT_TYPES: { type: EquipmentType; label: string }[] = [
  { type: 'shoes', label: 'Shoes' },
  { type: 'racket', label: 'Racket' },
  { type: 'strings', label: 'Strings' },
  { type: 'shirt', label: 'Shirt' },
  { type: 'shorts', label: 'Shorts' },
];

export default function CustomizationModal({
  onClose,
  playerEquipment,
  onEquip,
  resources,
}: CustomizationModalProps) {
  const [selectedType, setSelectedType] = useState<EquipmentType>('shoes');
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const equippedIds = playerEquipment?.map(pe => pe.id);

  useEffect(() => {
    const fetchEquipment = async () => {
      setLoading(true); // start loading
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('type', selectedType)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching equipment:', error);
        setLoading(false);
        return;
      }

      const transformed = data.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type as EquipmentType,
        price_coins: item.price_coins,
        price_diamonds: item.price_diamonds,
        price_shuttlecocks: item.price_shuttlecocks,
        imageUrl: item.image_url ?? '',
        stats: {
          endurance: item.endurance_boost,
          strength: item.strength_boost,
          agility: item.agility_boost,
          speed: item.speed_boost,
          explosiveness: item.explosiveness_boost,
          smash: item.smash_boost,
          defense: item.defense_boost,
          serve: item.serve_boost,
        },
      }));

      setFilteredEquipment(transformed);
      setLoading(false); // done loading
    };

    fetchEquipment();
  }, [selectedType]);

  const canAfford = (equipment: Equipment): boolean => {
    return (
      resources.coins >= equipment.price_coins &&
      resources.diamonds >= equipment.price_diamonds &&
      resources.shuttlecocks >= equipment.price_shuttlecocks
    );
  };

  console.log("Player equipment ", playerEquipment)
  console.log("Filered equipment ", filteredEquipment)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold">Equipment Shop</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex space-x-4 mb-6">
          {EQUIPMENT_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedType === type
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-10">
              <div className="w-10 h-10 border-4 border-blue-300 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading equipment...</p>
            </div>
          ) : filteredEquipment.length === 0 ? (
            <div className="border border-dashed rounded-lg p-6 text-center text-gray-400 col-span-full">
              No equipment available.
            </div>
          ) : (
            filteredEquipment.map((equipment) => (
              <EquipmentCard
                key={equipment.id}
                equipment={equipment}
                isEquipped={equippedIds.includes(equipment.id)}
                onEquip={onEquip}
                canAfford={canAfford(equipment)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}