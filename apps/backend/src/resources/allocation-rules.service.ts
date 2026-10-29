import { Injectable } from "@nestjs/common";

@Injectable()
export class AllocationRulesService {

  // calculer le minimum a conserver

  calculateMinimumRetention(
    initialQuantity: number,
    retentionPercent: number,
  ): number {
    return Math.ceil(initialQuantity * (retentionPercent / 100));
  }

  // calculer la quantite utilisable

  calculateAvailableQuantity(
    currentQuantity: number,
    minimumRetention: number,
  ): number {
    return Math.max(0, currentQuantity - minimumRetention);
  }

  // verifier si une demande est possible

  canAllocate(
    currentQuantity: number,
    initialQuantity: number,
    requestedQuantity: number,
    retentionPercent: number,
  ): boolean {
    const minimumRetention = this.calculateMinimumRetention(
      initialQuantity,
      retentionPercent,
    );

    const availableQuantity = this.calculateAvailableQuantity(
      currentQuantity,
      minimumRetention,
    );

    return requestedQuantity <= availableQuantity;
  }
}
