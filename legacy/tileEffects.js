export function checkTileEffect(scene, player) {
    switch (player.position) {
        case 2:
        case 4:
            logAction(`${player.name} doit boire 2 gorgées !`);
            break;
        case 6:
            logAction(`${player.name} active une TOURNÉE GÉNÉRALE ! Tous les joueurs boivent 1 gorgée.`);
            break;
        case 8:
            logAction(`${player.name} distribue 2 gorgées !`);
            break;
        case 10:
            logAction(`${player.name} doit se déplacer de 2 cases en avant !`);
            movePlayer(scene, player, 2);
            break;
        case 12:
            logAction(`${player.name} devient le Petit Poulet !`);
            player.isPetitPoulet = true;
            break;
        case 14:
            if (player.isPetitPoulet) {
                logAction(`${player.name} est déjà le Petit Poulet et devient maintenant le GROS POULET !`);
                player.isPetitPoulet = false;
                player.isGrosPoulet = true;
            }
            break; /Users/quintus /00 - dev / jeux - schimit - 2025 / tileEffects.js
        case 16:
            logAction(`${player.name} copie l'effet d'un adversaire !`);
            break;
        case 18:
            logAction(`${player.name} invente une règle qui dure jusqu'à la fin du jeu !`);
            break;
        case 20:
            logAction(`${player.name} crie SCHMITT ! Le dernier à le faire boit 1 gorgée par joueur sur la case !`);
            break;
        default:
            logAction(`${player.name} est sur une case normale.`);
    }
}

function logAction(message) {
    const logList = document.getElementById("logList");
    const logItem = document.createElement("li");
    logItem.textContent = message;
    logList.appendChild(logItem);
    logList.scrollTop = logList.scrollHeight;
}
