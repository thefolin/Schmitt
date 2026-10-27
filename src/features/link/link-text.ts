/**
 * LES MOTS DE LA LIAISON À DEUX APPAREILS, RÉUNIS ICI.
 *
 * Quentin (27/10/2026) trouve que « manette » ne convient pas à tous les
 * rôles, et choisira les noms. Tant qu'il n'a pas tranché, les textes
 * restent ceux d'origine ; RENOMMER SE FAIT DANS CE FICHIER SEUL.
 *
 * Des PHRASES ENTIÈRES plutôt qu'un nom glissé dans des modèles : le
 * français accorde — « le plateau » / « la manette », « au plateau » / « à la
 * manette ». Un nom variable donnerait « Montrez ce code à le manette ».
 */
export const LINK_TEXT = {
  /** Le bouton et le titre de l'écran d'appairage. */
  title: '\u{1F4F1} Relier un second appareil',

  /** Le choix du rôle. */
  asMaster: 'Cet écran est le plateau',
  asSlave: 'Cet appareil est la manette',

  /** Côté plateau. */
  masterShowsOffer: '1. Scannez ce code avec le téléphone — appareil photo ou bouton « manette ».',
  masterScanAnswer: '2. Scanner sa réponse',
  masterAimsAtSlave: 'Visez le code affiché par la manette.',

  /** Côté manette. */
  slaveAimsAtMaster: 'Visez le code affiché par le plateau.',
  slaveShowsAnswer: 'Montrez ce code au plateau : il le scanne avec « 2. Scanner sa réponse ».',
  slaveWaiting: 'En attente du plateau…',
  slaveLinked: '\u{1F7E2} Relié au plateau',
  slaveLost: '\u{1F534} Liaison perdue — vérifiez le WiFi',
  choiceOnMaster: 'Le choix se fait sur le plateau.',
} as const;
