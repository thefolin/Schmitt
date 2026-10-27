/**
 * LES MOTS DE LA LIAISON À DEUX APPAREILS, RÉUNIS ICI.
 *
 * Quentin (27/10/2026) : « manette » ne convenait pas à tous les rôles. Il
 * a retenu « appareil de contrôle » ; « plateau » reste. RENOMMER SE FAIT
 * DANS CE FICHIER SEUL.
 *
 * Des PHRASES ENTIÈRES plutôt qu'un nom glissé dans des modèles : le
 * français accorde — « le plateau », « l'appareil de contrôle », « à
 * l'appareil ». Un nom variable donnerait « Visez le code de le appareil ».
 */
export const LINK_TEXT = {
  /** Le bouton et le titre de l'écran d'appairage. */
  title: '\u{1F4F1} Relier un second appareil',

  /** Le choix du rôle. */
  asMaster: 'Cet écran est le plateau',
  // « Cet appareil est l'appareil de contrôle » se répète : le bouton dit
  // plutôt ce qu'on en fait.
  asSlave: 'Utiliser comme appareil de contrôle',

  /** Côté plateau. */
  masterShowsOffer: '1. Scannez ce code avec l’appareil de contrôle — son appareil photo, ou le bouton du jeu.',
  masterScanAnswer: '2. Scanner sa réponse',
  masterAimsAtSlave: 'Visez le code affiché par l’appareil de contrôle.',

  /** Côté appareil de contrôle. */
  slaveAimsAtMaster: 'Visez le code affiché par le plateau.',
  slaveShowsAnswer: 'Montrez ce code au plateau : il le scanne avec « 2. Scanner sa réponse ».',
  slaveWaiting: 'En attente du plateau…',
  slaveLinked: '\u{1F7E2} Relié au plateau',
  slaveLost: '\u{1F534} Liaison perdue — vérifiez le WiFi',
  choiceOnMaster: 'Le choix se fait sur le plateau.',
} as const;
