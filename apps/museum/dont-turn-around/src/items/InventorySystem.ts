export type ItemId = 'phone' | 'survey_tag' | 'ridge_marker' | 'river_charm';

export class InventorySystem {
  private items: ItemId[] = [];

  addItem(id: ItemId): void {
    if (!this.items.includes(id)) this.items.push(id);
  }

  hasItem(id: ItemId): boolean {
    return this.items.includes(id);
  }

  clear(): void {
    this.items = [];
  }
}
