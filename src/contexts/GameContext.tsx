import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
} from "react";
import { GameState, Resources } from "../types/game";
import { initialState } from "../utils/initialState";
import { rootReducer, GameAction } from "../reducers/rootReducer";
import {
  recordEquipmentChange,
  recordResourceUpdate,
} from "../lib/gameActions";
import { useAuth } from "./AuthContext";
import { UserService } from "@/services/database/userService";
import { ResourceService } from "@/services/database/resourceService";
import { PlayerService } from "@/services/database/playerService";
import { TournamentService } from "@/services/database/tournamentService";
import { Equipment } from "@/types/equipment";
import { Tournament } from "@/types/tournament";
import { supabase } from "@/lib/supabase";

interface GameContextType {
  gameState: GameState;
  resources: Resources;
  tournaments: Tournament[];
  setTournaments: (callback: (prev: Tournament[]) => Tournament[]) => void;
  updateResources: (
    source: string,
    changes: Partial<Record<keyof Resources, number>>,
    isAdd?: boolean
  ) => void;
  setGameState: (callback: (prev: GameState) => GameState) => void;
  dispatchGameState: React.Dispatch<GameAction>;
  equipItem: (playerId: string, equipment: Equipment) => void;
  updatePlayerName: (playerId: string, name: string) => void;
  healInjury: (
    playerId: string,
    injuryId: string,
    recoveryReduction: number
  ) => void;
  purchaseResources: (
    resource: keyof Resources,
    amount: number,
    cost: number
  ) => void;
  refreshGameState: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);
const resourceService = new ResourceService(supabase);
const tournamentService = new TournamentService(supabase);
const playerService = new PlayerService(supabase);
const userService = new UserService(supabase);

export function GameProvider({ children }: { children: React.ReactNode }) {
  console.log('[GameProvider] mounted');
  const [gameState, dispatch] = useReducer(rootReducer, initialState);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const { isLogin, user } = useAuth();
  const [resources, setResources] = useState<Resources>({
    shuttlecocks: 10,
    meals: 10,
    coins: 200,
    diamonds: 9999999,
  });

  const updateResources = useCallback(
    async (
      source: string,
      changes: Partial<Record<keyof Resources, number>>,
      isAdd: boolean = true
    ) => {
      if (!user?.id) {
        console.error('No user ID available for resource update');
        return;
      }

      console.log(`[updateResources] ${source}:`, { changes, isAdd });

      try {
        // Record the resource transaction in database
        await recordResourceUpdate(user.id, source, changes, isAdd);
        
        // Reload actual resources from database to ensure consistency
        const resourceBalances = await resourceService.getUserResourceBalances(user.id);
        const newResources = {
          shuttlecocks: resourceBalances.shuttlecocks || 0,
          meals: resourceBalances.meals || 0,
          coins: resourceBalances.coins || 0,
          diamonds: resourceBalances.diamonds || 0,
        };
        if (newResources) {
          console.log(`[updateResources] Reloaded resources:`, newResources);
          setResources(newResources);
        } else {
          console.error('Failed to reload resources after update');
        }
      } catch (error) {
        console.error('Error updating resources:', error);
      }
    },
    [user]
  );

  const loadTournaments = async () => {
    const tournaments = await tournamentService.getTournaments();
    setTournaments(tournaments as unknown as Tournament[]);
  };

  const loadState = async () => {
    if (!user || !user.email) {
      dispatch({ type: "SET_GAME_STATE", payload: { state: initialState } });
      return;
    }

    console.log('[GameContext] Loading game state for user:', user.id);
    const state = await userService.loadGameState(user.id);
    console.log('[GameContext] Game state loaded:', state);
    dispatch({ type: "SET_GAME_STATE", payload: { state: state } });
    console.log('[GameContext] Game state loaded:', JSON.stringify(state, null, 2));
    // Clean up expired injuries for each player
    const now = Date.now();
    const cleanedPlayers = await Promise.all(
      state.players.map(async (player:any) => {
        if (!player.injuries || player.injuries.length === 0) return player;

        await playerService.removeHealedInjuries(player.id, player.injuries);
        const activeInjuries = player.injuries.filter(
          (injury:any) => injury.recoveryEndTime > now
        );

        return { ...player, injuries: activeInjuries };
      })
    );
    console.log("GameContext cleaned up players version")
    // Replace players with cleaned version
    state.players = cleanedPlayers;
    await loadTournaments();
  };

  const refreshGameState = useCallback(async () => {
    if (!user?.id) return;
    
    console.log('[GameContext] Manual refresh triggered');
    await Promise.all([
      loadState(),
      (async () => {
        const resourceBalances = await resourceService.getUserResourceBalances(user.id);
        const newResources = {
          shuttlecocks: resourceBalances.shuttlecocks || 0,
          meals: resourceBalances.meals || 0,
          coins: resourceBalances.coins || 0,
          diamonds: resourceBalances.diamonds || 0,
        };
        if (newResources) {
          setResources(newResources);
        }
      })()
    ]);
  }, [user?.id]);

  useEffect(() => {
    console.log("Running use effect one")
    if (!user) return;
    console.log("User found continuing")

    const loadResource = async () => {
      console.log('[GameContext] Loading resources for user:', user.id);
      const resourceBalances = await resourceService.getUserResourceBalances(user.id);
      const newResources = {
        shuttlecocks: resourceBalances.shuttlecocks || 0,
        meals: resourceBalances.meals || 0,
        coins: resourceBalances.coins || 0,
        diamonds: resourceBalances.diamonds || 0,
      };
      if (newResources) {
        console.log('[GameContext] Resources loaded:', newResources);
        setResources(newResources);
      } else {
        console.error('[GameContext] Failed to load resources');
      }
    };

    const loadEverything = async () => {
      console.log('[GameContext] Loading complete game state and resources');
      await Promise.all([
        loadState(),
        loadResource()
      ]);
    };

    // Load everything immediately when user changes
    console.log("Triggering load everything")
    loadEverything();
    
    // Set up periodic refresh every 15 seconds (faster for better UX)
    // This ensures new users see their facilities quickly
    // const timer = setInterval(async () => {
    //   console.log('[GameContext] Periodic refresh triggered');
    //   await loadEverything();
    // }, 60000);

    // return () => clearInterval(timer);
  }, [isLogin, user?.id]);

  const equipItem = async (playerId: string, equipment: Equipment) => {
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) return;

    try {
      await recordEquipmentChange(player, equipment, "equip");
      dispatch({ type: "EQUIP_ITEM", payload: { playerId, equipment } });
    } catch (error) {
      console.error("Failed to equip item:", error);
    }
  };

  const updatePlayerName = (playerId: string, name: string) => {
    dispatch({ type: "UPDATE_PLAYER_NAME", payload: { playerId, name } });
  };

  const healInjury = (
    playerId: string,
    injuryId: string,
    recoveryReduction: number
  ) => {
    console.log('healing injury', playerId, injuryId, recoveryReduction);
    dispatch({ type: "HEAL_INJURY", payload: { playerId, injuryId } });
  };

  const purchaseResources = (
    resource: keyof Resources,
    amount: number,
    cost: number
  ) => {
    if (resources.diamonds < cost) return;

    updateResources("shop_purchase", {
      [resource]: amount,
      diamonds: -cost,
    });
  };

  const setGameState = (callback: (prev: GameState) => GameState) => {
    dispatch({
      type: "SET_GAME_STATE",
      payload: { state: callback(gameState) },
    });
  };

  const value = {
    gameState,
    resources,
    tournaments,
    setTournaments,
    updateResources,
    setGameState,
    dispatchGameState: dispatch,
    equipItem,
    updatePlayerName,
    healInjury,
    purchaseResources,
    refreshGameState,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
