// Small, asset-free jokes for the opt-in Other Other sandbox.
// They are deliberately data-light: the main campaign never imports this list
// directly and no feature has a network or persistence side effect.
export const FUNNY_FEATURES = Object.freeze([
  { id: "rgb", icon: "🌈", label: "RGB-Welt", description: "Die Welt pulsiert durch alle Farben.", key: "K" },
  { id: "matrix", icon: "🟩", label: "Matrix-HUD", description: "Fake-Pakete, Koordinaten und grüner Terminal-Regen.", key: "J" },
  { id: "disco", icon: "🪩", label: "Disco-Sicht", description: "Ein harmloser Farbblitz legt sich über den Bildschirm.", key: "V" },
  { id: "rain", icon: "🌧", label: "Emoji-Regen", description: "Wolken, Blitze und Emojis regnen über die Sandbox.", key: "O" },
  { id: "moon", icon: "🌙", label: "Mond-Sprung", description: "Niedrige Gravitation und übertriebene Sprünge.", key: "L" },
  { id: "turbo", icon: "⚡", label: "Turbo-Stiefel", description: "Mehr Tempo für die optionale Chaos-Runde.", key: "Y" },
  { id: "wide", icon: "🐟", label: "Fischaugen-Kamera", description: "Extra breites Sichtfeld wie eine Actioncam." },
  { id: "invert", icon: "🙃", label: "Upside-Down-Steuerung", description: "Nur im Sandbox-Modus sind links und rechts verdreht.", key: "I" },
  { id: "spin", icon: "🌀", label: "Drehwurm", description: "Der Blick dreht sich ganz langsam von allein.", key: "Z" },
  { id: "esp", icon: "🛰", label: "Joke-ESP", description: "Ein Fake-Scanner zeigt Sandbox-Koordinaten.", key: "Q" },
  { id: "random", icon: "🎲", label: "Teleport-Lotto", description: "Springe an einen zufälligen sicheren Ort.", action: "random-teleport" },
  { id: "reflex", icon: "🎯", label: "Reflex-Minispiel", description: "Klicke 15 Sekunden lang auf das wandernde Ziel.", action: "reflex" },
  { id: "reset", icon: "🧼", label: "Alles normal", description: "Schaltet die lustigen Effekte sofort zurück.", action: "reset" },
]);

export const FUNNY_FEATURE_BY_ID = Object.freeze(
  Object.fromEntries(FUNNY_FEATURES.map((feature) => [feature.id, feature])),
);
