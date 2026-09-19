export interface GodFavor {
  name: string;
  icon: string;
  description: string;
}

/**
 * Mapping des faveurs des dieux selon la somme de 2 dés (2 à 12).
 * Extrait de main-camera.ts pour être testable indépendamment du rendu.
 *
 * LA TABLE SUIT LE PLATEAU PHYSIQUE, arbitrée par Quentin (#34). Elle était
 * décalée d'un cran sur les sommes 3 à 7 : ATHÉNA était en 4 au lieu de 3, et
 * chaque faveur suivante héritait de la place de la précédente. Le décalage
 * avait été repéré en comparant le code à la photo du vrai plateau.
 *
 * « JUGEMENT DERNIER » a été SUPPRIMÉE — elle était implémentée mais absente
 * du plateau physique. ARTÉMIS, qui n'existait pas dans le code, prend la
 * somme 7.
 */
export const GOD_FAVORS: Record<number, GodFavor> = {
  2: {
    name: 'COLÈRE DES DIEUX',
    icon: '💀',
    description: 'Le joueur reçoit 1 cul sec !'
  },
  3: {
    name: 'ATHÉNA',
    icon: '🛡️',
    description: 'Choisissez un objet bouclier. Ce bouclier renvoie 1 seule fois toutes les gorgées/cul-sec sur le joueur de votre choix. Tant que vous possédez le bouclier, vous ne pouvez pas gagner.'
  },
  4: {
    name: 'APHRODITE',
    icon: '💕',
    description: 'Lancez 2 dés, choisissez 2 adversaires et associez 1 dé à chacun. Déplacez-les en avant ou arrière. Ils appliquent l\'effet de leur nouvel emplacement.'
  },
  5: {
    name: 'HERMÈS',
    icon: '👟',
    description: 'Choisissez un adversaire et déplacez-vous sur sa case OU déplacez-le sur votre case. Appliquez l\'effet de la case du nouvel emplacement.'
  },
  6: {
    name: 'APOLLON',
    icon: '☀️',
    description: 'Rejouez un tour en lançant 2 dés, conservez celui de votre choix. Distribuez 1 gorgée à chaque adversaire que vous dépassez.'
  },
  7: {
    name: 'ARTÉMIS',
    icon: '🏹',
    description: 'Conservez 1 dé et relancez l\'autre une seule fois. Si vous retombez sur un double, distribuez les gorgées de la Colère des Dieux au joueur de votre choix à votre place.'
  },
  8: {
    name: 'ARÈS',
    icon: '⚔️',
    description: 'Tous les joueurs choisissent pouce haut ou bas. Ceux qui font l\'inverse de vous reçoivent autant de gorgées que le nombre qui ont fait comme vous.'
  },
  9: {
    name: 'DIONYSOS',
    icon: '🍷',
    description: 'Tous les joueurs trinquent et continuent de boire avec vous jusqu\'à ce que vous seul décidiez d\'arrêter.'
  },
  10: {
    name: 'HÉPHAÏSTOS',
    icon: '🔨',
    description: 'Placez 2 shooters sur des cases différentes. Le premier joueur à tomber dessus doit boire immédiatement le shooter, puis appliquer la case.'
  },
  11: {
    name: 'POSÉIDON',
    icon: '🔱',
    description: 'Ciblez un joueur et lancez 2 dés. Il reçoit autant de gorgées que le dé le plus élevé. Ses 2 voisins reçoivent chacun le score du dé le plus faible.'
  },
  12: {
    name: 'ZEUS - FAVEUR SUPRÊME',
    icon: '⚡',
    description: 'Choisissez n\'importe quelle faveur parmi celles disponibles !'
  }
};

export function getGodFavor(sum: number): GodFavor | undefined {
  return GOD_FAVORS[sum];
}

/**
 * Trouve les index des voisins gauche/droite d'un joueur dans l'ordre du tour.
 * Retourne null pour un côté quand il n'y a pas assez de joueurs pour avoir un voisin distinct.
 */
export function findNeighbors(
  playerIndex: number,
  totalPlayers: number
): { left: number | null; right: number | null } {
  if (totalPlayers <= 1) {
    return { left: null, right: null };
  }

  const leftIndex = (playerIndex - 1 + totalPlayers) % totalPlayers;
  const rightIndex = (playerIndex + 1) % totalPlayers;

  return {
    left: leftIndex !== playerIndex ? leftIndex : null,
    right: rightIndex !== playerIndex ? rightIndex : null
  };
}
