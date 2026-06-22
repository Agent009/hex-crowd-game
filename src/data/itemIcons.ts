// Emoji glyphs for resources and items, shared across the harvest/craft/trade
// UIs so a resource always reads the same wherever it appears.

export const RESOURCE_ICONS: Record<string, string> = {
  cloth: '🧵',
  wood: '🪵',
  stone: '🪨',
  water: '💧',
  shard: '💎',
  gems: '💠',
};

export const ITEM_ICONS: Record<string, string> = {
  boat: '⛵',
  camping_gear: '🏕️',
  climbing_gear: '🧗',
  cloak: '🧥',
  survival_kit: '🎒',
  terraform: '🌍',
  leech: '🩸',
  armageddon: '💥',
  rejuvenate: '💚',
};

export const resourceIcon = (id: string): string => RESOURCE_ICONS[id] ?? '📦';
export const itemIcon = (id: string): string => ITEM_ICONS[id] ?? '📦';
