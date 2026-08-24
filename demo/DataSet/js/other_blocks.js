// The optional "Other Other" sandbox catalog. These IDs never appear in the
// campaign hotbar or authored level data; they only become placeable after the
// player explicitly enables the experimental tools in Settings.
const defineBlock = (id, key, name, icon, color, material = "stone") =>
  Object.freeze({ id, key, name, icon, color: Object.freeze(color), material });

export const OTHER_BLOCKS = Object.freeze([
  defineBlock(32, "RAINBOW", "Regenbogen", "🌈", [1.0, 0.16, 0.55], "metal"),
  defineBlock(33, "LAVA", "Lava", "🌋", [1.0, 0.18, 0.03], "stone"),
  defineBlock(34, "OBSIDIAN", "Obsidian", "⬛", [0.09, 0.05, 0.16], "stone"),
  defineBlock(35, "GOLD", "Gold", "🟨", [1.0, 0.72, 0.05], "metal"),
  defineBlock(36, "COPPER", "Kupfer", "🟧", [0.78, 0.32, 0.12], "metal"),
  defineBlock(37, "AMETHYST", "Amethyst", "💜", [0.58, 0.22, 0.82], "glass"),
  defineBlock(38, "RUBY", "Rubin", "♦", [0.83, 0.03, 0.12], "glass"),
  defineBlock(39, "SAPPHIRE", "Saphir", "🔷", [0.06, 0.25, 0.88], "glass"),
  defineBlock(40, "EMERALD", "Smaragd", "💚", [0.04, 0.68, 0.28], "glass"),
  defineBlock(41, "QUARTZ", "Quarz", "◇", [0.9, 0.92, 0.98], "stone"),
  defineBlock(42, "MARBLE", "Marmor", "◻", [0.82, 0.86, 0.84], "stone"),
  defineBlock(43, "BASALT", "Basalt", "▦", [0.16, 0.18, 0.2], "stone"),
  defineBlock(44, "SLIME", "Schleim", "🟢", [0.22, 0.92, 0.24], "water"),
  defineBlock(45, "HONEY", "Honig", "🍯", [1.0, 0.58, 0.05], "water"),
  defineBlock(46, "ICE_CREAM", "Eiscreme", "🍦", [1.0, 0.55, 0.78], "snow"),
  defineBlock(47, "CLOUD", "Wolke", "☁", [0.88, 0.94, 1.0], "snow"),
  defineBlock(48, "SUN", "Sonne", "☀", [1.0, 0.9, 0.14], "metal"),
  defineBlock(49, "MOON", "Mond", "🌙", [0.56, 0.64, 0.86], "stone"),
  defineBlock(50, "STAR", "Stern", "⭐", [1.0, 0.96, 0.42], "metal"),
  defineBlock(51, "GALAXY", "Galaxie", "🌌", [0.18, 0.05, 0.42], "glass"),
  defineBlock(52, "CYBER", "Cyber", "⚡", [0.02, 0.8, 0.92], "metal"),
  defineBlock(53, "HOLOGRAM", "Hologramm", "🌀", [0.18, 0.9, 0.86], "glass"),
  defineBlock(54, "MAGMA", "Magma", "🔥", [0.92, 0.08, 0.02], "stone"),
  defineBlock(55, "CRYSTAL", "Kristall", "🔶", [0.35, 0.86, 1.0], "glass"),
  defineBlock(56, "BUBBLE", "Blase", "🫧", [0.4, 0.82, 1.0], "water"),
  defineBlock(57, "CONFETTI", "Konfetti", "🎉", [0.96, 0.18, 0.52], "metal"),
  defineBlock(58, "PASTEL_PINK", "Pastellrosa", "🌸", [1.0, 0.48, 0.68], "stone"),
  defineBlock(59, "PASTEL_BLUE", "Pastellblau", "🩵", [0.42, 0.78, 1.0], "stone"),
  defineBlock(60, "MINT", "Minze", "🌿", [0.36, 0.92, 0.7], "grass"),
  defineBlock(61, "LEMON", "Zitrone", "🍋", [0.94, 0.98, 0.2], "grass"),
  defineBlock(62, "LILAC", "Flieder", "🪻", [0.7, 0.5, 0.92], "grass"),
  defineBlock(63, "VOID", "Leere", "🕳", [0.015, 0.015, 0.02], "stone"),
  defineBlock(64, "TOXIC", "Giftgrün", "☢", [0.62, 0.96, 0.04], "metal"),
  defineBlock(65, "CANDY", "Bonbon", "🍬", [0.96, 0.24, 0.68], "wood"),
  defineBlock(66, "LEGO_RED", "Baustein Rot", "🟥", [0.92, 0.04, 0.05], "plastic"),
  defineBlock(67, "LEGO_BLUE", "Baustein Blau", "🟦", [0.04, 0.25, 0.9], "plastic"),
  defineBlock(68, "LEGO_YELLOW", "Baustein Gelb", "🟨", [0.98, 0.78, 0.04], "plastic"),
  defineBlock(69, "LEGO_GREEN", "Baustein Grün", "🟩", [0.08, 0.7, 0.16], "plastic"),
  defineBlock(70, "CHECKER", "Schachbrett", "▧", [0.12, 0.12, 0.16], "stone"),
  defineBlock(71, "GOLDEN_BRICK", "Goldziegel", "🧱", [0.88, 0.48, 0.08], "metal"),
]);

export const OTHER_BLOCK_BY_ID = Object.freeze(
  Object.fromEntries(OTHER_BLOCKS.map((block) => [block.id, block])),
);
