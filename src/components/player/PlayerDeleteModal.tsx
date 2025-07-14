import { Player } from "../../types/game";
import { useGame } from "@/contexts/GameContext";
import { supabase } from "@/lib/supabase";
import { toast } from 'sonner';

interface PlayerStrategyModalProps {
  player: Player;
  onClose: () => void;
  //   onUpdateStrategy: (playerId: string, strategy: PlayerStrategy) => void;
}

export default function PlayerDeleteModal({
  player,
  onClose,
}: PlayerStrategyModalProps) {
  const { resources, gameState, updateResources, dispatchGameState } =
    useGame();

  const removePlayer = async (playerid: string) => {
    try {
      // Delete in reverse order of dependencies
      
      // Delete player equipment history
      await supabase
        .from("player_equipment_history")
        .delete()
        .eq("player_id", playerid);
      
      // Delete player equipment
      await supabase
        .from("player_equipment")
        .delete()
        .eq("player_id", playerid);
      
      // Delete player training history  
      await supabase
        .from("player_training_history")
        .delete()
        .eq("player_id", playerid);
      
      // Delete player strategy
      const { error: strategyError } = await supabase
        .from("player_strategy")
        .delete()
        .eq("player_id", playerid);
      if (strategyError) {
        console.error('Error deleting player strategy:', strategyError);
        return false;
      }
      
      // Delete player levels
      const { error: levelsError } = await supabase
        .from("player_levels")
        .delete()
        .eq("player_id", playerid);
      if (levelsError) {
        console.error('Error deleting player levels:', levelsError);
        return false;
      }
      
      // Delete player stats
      const { error: statsError } = await supabase
        .from("player_stats")
        .delete()
        .eq("player_id", playerid);
      if (statsError) {
        console.error('Error deleting player stats:', statsError);
        return false;
      }
      
      // Finally delete the player
      const { error: playerError } = await supabase
        .from("players")
        .delete()
        .eq("id", playerid);
      if (playerError) {
        console.error('Error deleting player:', playerError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in removePlayer:', error);
      return false;
    }
  };

  const handleRemove = async () => {
    const cost = 0;
    if (resources.coins < cost) {
      toast.warning(`Not enough coins! You need ${cost} coins to remove a player.`);
      return;
    }

    try {
      const success = await removePlayer(player.id);
      if (!success) {
        toast.error('Failed to remove player. Please try again.');
        return;
      }

      // Deduct the cost
      updateResources("manual_adjustment", { coins: cost }, false);
      
      // Update game state
      dispatchGameState({
        type: "REMOVE_PLAYER",
        payload: { player },
      });
      
      console.log(`Successfully removed player ${player.name} for ${cost} coins`);
      onClose();
    } catch (error) {
      console.error('Error removing player:', error);
      toast.error('Failed to remove player. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => {
        onClose();
      }}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* <h1>{"Remove " + player?.name}</h1> */}
        <span className="text-xl">Remove</span> <span>{player.name}</span>
        <br></br>
        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={handleRemove}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 shadow-md"
          >
            Ok
          </button>
          <button
            onClick={() => {
              onClose();
            }}
            className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-200 shadow-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
