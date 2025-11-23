function sayHello() {
    alert("Coucou !");
}


function powerCaseSimple(player) {
    switch (player.position) {
        case 1:
            logAction(`${player.name} - casse ${player.position} active une TOURNÉE GÉNÉRALE ! Tous les joueurs boivent 1 gorgée.`);
            break;
        case 2:
            logAction(`${player.name} - casse ${player.position} doit se déplacer de 2 cases en avant !`);
            movePlayer(scene, player, 2);
            break;
        case 4:
            logAction(`${player.name} - casse ${player.position} doit boire 2 gorgées !`);
            break;
        case 6:

        case 8:
            logAction(`${player.name} - casse ${player.position} distribue 2 gorgées !`);
            break;
        case 10:
            logAction(`${player.name} - casse ${player.position} doit se déplacer de 2 cases en avant !`);
            movePlayer(scene, player, 2);
            break;
        case 11:
            logAction(`${player.name} - casse ${player.position} doit se déplacer de 2 cases en avant !`);
            movePlayer(scene, player, 2);
            break;
        case 12:
            logAction(`${player.name} - casse ${player.position} devient le Petit Poulet !`);
            player.isPetitPoulet = true;
            break;
        case 14:
            if (player.isPetitPoulet) {
                logAction(`${player.name} - casse ${player.position} est déjà le Petit Poulet et devient maintenant le GROS POULET !`);
                player.isPetitPoulet = false;
                player.isGrosPoulet = true;
            }
            break;
        case 16:
            logAction(`${player.name} - casse ${player.position} copie l'effet d'un adversaire !`);
            break;
        case 18:
            logAction(`${player.name} - casse ${player.position} invente une règle qui dure jusqu'à la fin du jeu !`);
            break;
        case 20:
            logAction(`${player.name} - casse ${player.position} crie SCHMITT ! Le dernier à le faire boit 1 gorgée par joueur sur la case !`);
            break;
        default:
            logAction(`${player.name} - casse ${player.position} est sur une case normale.`);
    }
}