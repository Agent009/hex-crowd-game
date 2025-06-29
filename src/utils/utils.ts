import { Coins } from "lucide-react";
import {ResourceAmount, resourceData} from "../data/gameData";
import { BuildingData } from "../data/buildingsData";

export function getResourceIcon(resourceType: string) {
  return resourceData[resourceType as keyof typeof resourceData]?.icon || Coins;
}

export function getResourceColor(resourceType: string) {
  return resourceData[resourceType as keyof typeof resourceData]?.color || '#FFD700';
}

// Helper function to calculate building cost at a specific level
export function calculateBuildingCost(building: BuildingData, level: number): ResourceAmount {
  const levelData = building.levels.find(l => l.level === level);
  if (!levelData) return {};

  return levelData.resourcesCost;
}

// Helper function to format time (seconds to readable format)
export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export type ExtractId<T> = T extends { id: infer U } ? U : never;
