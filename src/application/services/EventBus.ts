/**
 * EventBus - Publish/Subscribe pour les événements du jeu
 * Permet la communication découplée entre les composants
 */

import { GameEventDTO } from '../dto/GameDTO';

export type EventHandler = (event: GameEventDTO) => void | Promise<void>;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();

  /**
   * Abonne un handler à un type d'événement spécifique
   */
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Retourne une fonction de désabonnement
    return () => {
      this.unsubscribe(eventType, handler);
    };
  }

  /**
   * Abonne un handler à TOUS les événements
   */
  subscribeAll(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler);

    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  /**
   * Désabonne un handler d'un type d'événement
   */
  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * Publie un événement
   */
  async publish(event: GameEventDTO): Promise<void> {
    // Handlers spécifiques au type
    const typeHandlers = this.handlers.get(event.type) || new Set();

    // Tous les handlers à exécuter
    const allHandlers = new Set([...typeHandlers, ...this.wildcardHandlers]);

    // Exécuter tous les handlers
    const promises = Array.from(allHandlers).map(handler =>
      Promise.resolve(handler(event))
    );

    await Promise.all(promises);
  }

  /**
   * Publie plusieurs événements en séquence
   */
  async publishMany(events: GameEventDTO[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Efface tous les handlers
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  /**
   * Obtient le nombre de handlers pour un type
   */
  getHandlerCount(eventType?: string): number {
    if (eventType) {
      return (this.handlers.get(eventType)?.size || 0) + this.wildcardHandlers.size;
    }
    return Array.from(this.handlers.values()).reduce((sum, set) => sum + set.size, 0) + this.wildcardHandlers.size;
  }
}
