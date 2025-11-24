/**
 * Capacitor Native Plugins - Exemples d'utilisation
 *
 * Ce fichier contient des exemples d'utilisation des plugins natifs Capacitor.
 * Vous pouvez importer ces fonctions dans votre code pour accéder aux fonctionnalités natives.
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Vérifie si l'app tourne sur une plateforme native (iOS/Android)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Retourne la plateforme actuelle
 */
export function getPlatform(): 'web' | 'ios' | 'android' {
  return Capacitor.getPlatform() as 'web' | 'ios' | 'android';
}

// ============================================
// 📸 CAMERA & PHOTOS
// ============================================

/**
 * Prendre une photo avec la caméra
 */
export async function takePhoto(): Promise<string | null> {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });

    return image.dataUrl || null;
  } catch (error) {
    console.error('Erreur lors de la prise de photo:', error);
    return null;
  }
}

/**
 * Choisir une photo depuis la galerie
 */
export async function pickPhoto(): Promise<string | null> {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
    });

    return image.dataUrl || null;
  } catch (error) {
    console.error('Erreur lors de la sélection de photo:', error);
    return null;
  }
}

/**
 * Demander les permissions pour la caméra
 */
export async function requestCameraPermissions(): Promise<boolean> {
  try {
    const result = await Camera.requestPermissions();
    return result.camera === 'granted';
  } catch (error) {
    console.error('Erreur lors de la demande de permissions caméra:', error);
    return false;
  }
}

// ============================================
// 📍 GEOLOCATION
// ============================================

/**
 * Obtenir la position actuelle
 */
export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const coordinates = await Geolocation.getCurrentPosition();
    return {
      lat: coordinates.coords.latitude,
      lng: coordinates.coords.longitude,
    };
  } catch (error) {
    console.error('Erreur lors de la récupération de la position:', error);
    return null;
  }
}

/**
 * Observer les changements de position (temps réel)
 */
export async function watchPosition(
  callback: (position: { lat: number; lng: number }) => void
): Promise<string> {
  const watchId = await Geolocation.watchPosition({}, (position, err) => {
    if (err) {
      console.error('Erreur watch position:', err);
      return;
    }
    if (position) {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    }
  });

  return watchId;
}

/**
 * Arrêter d'observer la position
 */
export async function clearWatch(watchId: string): Promise<void> {
  await Geolocation.clearWatch({ id: watchId });
}

/**
 * Demander les permissions de géolocalisation
 */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const result = await Geolocation.requestPermissions();
    return result.location === 'granted';
  } catch (error) {
    console.error('Erreur lors de la demande de permissions localisation:', error);
    return false;
  }
}

// ============================================
// 💾 PREFERENCES (Stockage Local Persistant)
// ============================================

/**
 * Sauvegarder une donnée dans le stockage persistant
 */
export async function saveData(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value });
}

/**
 * Récupérer une donnée depuis le stockage persistant
 */
export async function getData(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  return value;
}

/**
 * Supprimer une donnée du stockage persistant
 */
export async function removeData(key: string): Promise<void> {
  await Preferences.remove({ key });
}

/**
 * Effacer toutes les données du stockage
 */
export async function clearAllData(): Promise<void> {
  await Preferences.clear();
}

/**
 * Exemple : Sauvegarder l'état du jeu
 */
export async function saveGameState(gameState: object): Promise<void> {
  await saveData('game_state', JSON.stringify(gameState));
}

/**
 * Exemple : Charger l'état du jeu
 */
export async function loadGameState(): Promise<object | null> {
  const data = await getData('game_state');
  return data ? JSON.parse(data) : null;
}

// ============================================
// 🔔 PUSH NOTIFICATIONS
// ============================================

/**
 * Initialiser les notifications push
 */
export async function initPushNotifications(): Promise<void> {
  if (!isNativePlatform()) {
    console.log('Push notifications non disponibles sur web');
    return;
  }

  // Demander la permission
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.warn('Permissions notifications refusées');
    return;
  }

  // S'enregistrer pour recevoir les notifications
  await PushNotifications.register();

  // Écouter les événements
  PushNotifications.addListener('registration', (token) => {
    console.log('Push registration success, token: ' + token.value);
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.error('Error on registration: ' + JSON.stringify(error));
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received: ', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification action performed', notification.actionId, notification.inputValue);
  });
}

/**
 * Envoyer une notification locale
 */
export async function sendLocalNotification(title: string, body: string): Promise<void> {
  if (!isNativePlatform()) {
    console.log('Notifications locales non disponibles sur web');
    return;
  }

  // Note: Pour les notifications locales, il faut installer @capacitor/local-notifications
  console.log('Pour les notifications locales, installez @capacitor/local-notifications');
}

// ============================================
// 📱 APP LIFECYCLE
// ============================================

/**
 * Écouter les changements d'état de l'app
 */
export function listenToAppState(
  onActive: () => void,
  onBackground: () => void
): void {
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      onActive();
    } else {
      onBackground();
    }
  });
}

/**
 * Obtenir des informations sur l'app
 */
export async function getAppInfo(): Promise<{
  name: string;
  id: string;
  build: string;
  version: string;
}> {
  const info = await App.getInfo();
  return info;
}

/**
 * Obtenir des informations sur le device
 */
export async function getLaunchUrl(): Promise<string | undefined> {
  const result = await App.getLaunchUrl();
  return result?.url;
}

// ============================================
// 🎮 EXEMPLE D'INTÉGRATION DANS LE JEU
// ============================================

/**
 * Exemple : Sauvegarder automatiquement l'état du jeu quand l'app passe en arrière-plan
 */
export function enableAutoSave(getGameState: () => object): void {
  listenToAppState(
    () => {
      console.log('App active - Jeu en cours');
    },
    async () => {
      console.log('App en arrière-plan - Sauvegarde automatique...');
      const state = getGameState();
      await saveGameState(state);
      console.log('Jeu sauvegardé !');
    }
  );
}

/**
 * Exemple : Initialisation complète des plugins au démarrage du jeu
 */
export async function initializeNativePlugins(): Promise<void> {
  if (!isNativePlatform()) {
    console.log('Mode web - Plugins natifs désactivés');
    return;
  }

  console.log(`Initialisation des plugins natifs sur ${getPlatform()}`);

  // Afficher les infos de l'app
  const appInfo = await getAppInfo();
  console.log('App Info:', appInfo);

  // Demander les permissions
  const cameraGranted = await requestCameraPermissions();
  console.log('Permission caméra:', cameraGranted ? '✅' : '❌');

  const locationGranted = await requestLocationPermissions();
  console.log('Permission localisation:', locationGranted ? '✅' : '❌');

  // Initialiser les notifications
  await initPushNotifications();

  console.log('Plugins natifs initialisés !');
}
