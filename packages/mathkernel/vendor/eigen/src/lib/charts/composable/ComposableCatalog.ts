/**
 * ComposableCatalog - Set-based operations on chart catalogs
 *
 * Provides a functional, composable interface for building chart subsets.
 * Immutable operations return new catalogs - original is never mutated.
 *
 * @module charts/composable/ComposableCatalog
 */

import type { ChartDefinition, ChartCategory, DataShape } from '../registry/definitions';

// =============================================================================
// ComposableCatalog Class
// =============================================================================

/**
 * Immutable catalog wrapper with set operations.
 *
 * All operations return new ComposableCatalog instances.
 * Internally uses Map for O(1) lookups.
 *
 * @example
 * ```typescript
 * const trends = ComposableCatalog.from(CHART_DEFINITIONS)
 *   .filter(def => def.category === 'trend');
 *
 * const combined = trendCharts.union(comparisonCharts);
 * const common = trendCharts.intersection(timeSeriesCharts);
 * ```
 */
export class ComposableCatalog<T extends { type: string }> {
  private readonly _map: ReadonlyMap<string, T>;

  /**
   * Protected constructor - use static factories (or subclass)
   */
  protected constructor(entries: Iterable<T>) {
    const map = new Map<string, T>();
    for (const entry of entries) {
      map.set(entry.type, entry);
    }
    this._map = map;
  }

  // ===========================================================================
  // Static Factories
  // ===========================================================================

  /**
   * Create a catalog from an iterable of definitions
   */
  static from<T extends { type: string }>(entries: Iterable<T>): ComposableCatalog<T> {
    return new ComposableCatalog(entries);
  }

  /**
   * Create an empty catalog
   */
  static empty<T extends { type: string }>(): ComposableCatalog<T> {
    return new ComposableCatalog<T>([]);
  }

  /**
   * Create a catalog from a single entry
   */
  static of<T extends { type: string }>(...entries: T[]): ComposableCatalog<T> {
    return new ComposableCatalog(entries);
  }

  // ===========================================================================
  // Accessors
  // ===========================================================================

  /**
   * Number of entries in the catalog
   */
  get size(): number {
    return this._map.size;
  }

  /**
   * Get all type keys
   */
  keys(): string[] {
    return Array.from(this._map.keys());
  }

  /**
   * Get all entries
   */
  values(): T[] {
    return Array.from(this._map.values());
  }

  /**
   * Get all entries as [key, value] pairs
   */
  entries(): [string, T][] {
    return Array.from(this._map.entries());
  }

  /**
   * Get a single entry by type
   */
  get(type: string): T | undefined {
    return this._map.get(type);
  }

  /**
   * Check if type exists in catalog
   */
  has(type: string): boolean {
    return this._map.has(type);
  }

  /**
   * Check if catalog is empty
   */
  isEmpty(): boolean {
    return this._map.size === 0;
  }

  // ===========================================================================
  // Set Operations
  // ===========================================================================

  /**
   * Union: A ∪ B - combines entries from both catalogs
   *
   * Entries from `other` take precedence for duplicate keys.
   */
  union(other: ComposableCatalog<T>): ComposableCatalog<T> {
    const combined = [...this.values(), ...other.values()];
    return new ComposableCatalog(combined);
  }

  /**
   * Intersection: A ∩ B - only entries present in BOTH catalogs
   */
  intersection(other: ComposableCatalog<T>): ComposableCatalog<T> {
    const result: T[] = [];
    for (const entry of this.values()) {
      if (other.has(entry.type)) {
        result.push(entry);
      }
    }
    return new ComposableCatalog(result);
  }

  /**
   * Difference: A - B - entries in this but NOT in other
   */
  difference(other: ComposableCatalog<T>): ComposableCatalog<T> {
    const result: T[] = [];
    for (const entry of this.values()) {
      if (!other.has(entry.type)) {
        result.push(entry);
      }
    }
    return new ComposableCatalog(result);
  }

  /**
   * Symmetric Difference: A △ B - entries in either but NOT both
   */
  symmetricDifference(other: ComposableCatalog<T>): ComposableCatalog<T> {
    const aMinusB = this.difference(other);
    const bMinusA = other.difference(this);
    return aMinusB.union(bMinusA);
  }

  // ===========================================================================
  // Filter & Transform
  // ===========================================================================

  /**
   * Filter entries by predicate
   */
  filter(predicate: (entry: T) => boolean): ComposableCatalog<T> {
    return new ComposableCatalog(this.values().filter(predicate));
  }

  /**
   * Pick specific types by key
   */
  pick(...types: string[]): ComposableCatalog<T> {
    const typeSet = new Set(types);
    return this.filter(entry => typeSet.has(entry.type));
  }

  /**
   * Omit specific types by key
   */
  omit(...types: string[]): ComposableCatalog<T> {
    const typeSet = new Set(types);
    return this.filter(entry => !typeSet.has(entry.type));
  }

  /**
   * Map entries (must preserve type field)
   */
  map<U extends { type: string }>(fn: (entry: T) => U): ComposableCatalog<U> {
    return new ComposableCatalog(this.values().map(fn));
  }

  // ===========================================================================
  // Iteration
  // ===========================================================================

  /**
   * Iterate over entries
   */
  [Symbol.iterator](): Iterator<T> {
    return this.values()[Symbol.iterator]();
  }

  /**
   * forEach over entries
   */
  forEach(callback: (entry: T) => void): void {
    for (const entry of this.values()) {
      callback(entry);
    }
  }

  /**
   * Check if any entry matches predicate
   */
  some(predicate: (entry: T) => boolean): boolean {
    return this.values().some(predicate);
  }

  /**
   * Check if all entries match predicate
   */
  every(predicate: (entry: T) => boolean): boolean {
    return this.values().every(predicate);
  }

  /**
   * Find first entry matching predicate
   */
  find(predicate: (entry: T) => boolean): T | undefined {
    return this.values().find(predicate);
  }

  // ===========================================================================
  // Conversion
  // ===========================================================================

  /**
   * Convert to plain array
   */
  toArray(): T[] {
    return this.values();
  }

  /**
   * Convert to Record keyed by type
   */
  toRecord(): Record<string, T> {
    const record: Record<string, T> = {};
    for (const [key, value] of this._map) {
      record[key] = value;
    }
    return record;
  }

  /**
   * Convert to Map
   */
  toMap(): Map<string, T> {
    return new Map(this._map);
  }

  /**
   * Convert to Set of type keys
   */
  toTypeSet(): Set<string> {
    return new Set(this._map.keys());
  }
}

// =============================================================================
// ChartCatalog - Specialized for ChartDefinition
// =============================================================================

/**
 * Chart-specific catalog with domain-aware operations.
 *
 * Overrides base class methods to return ChartCatalog type.
 */
export class ChartCatalog extends ComposableCatalog<ChartDefinition> {
  /**
   * Create from chart definitions
   */
  static fromDefinitions(definitions: readonly ChartDefinition[]): ChartCatalog {
    return new ChartCatalog(definitions);
  }

  /**
   * Create empty ChartCatalog
   */
  static emptyChart(): ChartCatalog {
    return new ChartCatalog([]);
  }

  // ===========================================================================
  // Override base methods to return ChartCatalog
  // ===========================================================================

  override filter(predicate: (entry: ChartDefinition) => boolean): ChartCatalog {
    return new ChartCatalog(this.values().filter(predicate));
  }

  override pick(...types: string[]): ChartCatalog {
    const typeSet = new Set(types);
    return this.filter(entry => typeSet.has(entry.type));
  }

  override omit(...types: string[]): ChartCatalog {
    const typeSet = new Set(types);
    return this.filter(entry => !typeSet.has(entry.type));
  }

  override union(other: ComposableCatalog<ChartDefinition>): ChartCatalog {
    const combined = [...this.values(), ...other.values()];
    return new ChartCatalog(combined);
  }

  override intersection(other: ComposableCatalog<ChartDefinition>): ChartCatalog {
    const result: ChartDefinition[] = [];
    for (const entry of this.values()) {
      if (other.has(entry.type)) {
        result.push(entry);
      }
    }
    return new ChartCatalog(result);
  }

  override difference(other: ComposableCatalog<ChartDefinition>): ChartCatalog {
    const result: ChartDefinition[] = [];
    for (const entry of this.values()) {
      if (!other.has(entry.type)) {
        result.push(entry);
      }
    }
    return new ChartCatalog(result);
  }

  // ===========================================================================
  // Chart-specific methods
  // ===========================================================================

  /**
   * Filter by category
   */
  byCategory(category: ChartCategory): ChartCatalog {
    return this.filter(def => def.category === category);
  }

  /**
   * Filter by multiple categories
   */
  byCategories(...categories: ChartCategory[]): ChartCatalog {
    const categorySet = new Set(categories);
    return this.filter(def => categorySet.has(def.category));
  }

  /**
   * Filter by data shape
   */
  byDataShape(shape: DataShape): ChartCatalog {
    return this.filter(def => def.dataShapes.includes(shape));
  }

  /**
   * Filter by multiple data shapes (any match)
   */
  byDataShapes(...shapes: DataShape[]): ChartCatalog {
    const shapeSet = new Set(shapes);
    return this.filter(def => def.dataShapes.some(s => shapeSet.has(s)));
  }

  /**
   * Get charts that support hierarchical data
   */
  hierarchical(): ChartCatalog {
    return this.filter(def => def.hasChildren === true);
  }

  /**
   * Get charts with series field support
   */
  withSeriesSupport(): ChartCatalog {
    return this.filter(def => def.seriesField === true);
  }

  /**
   * Generate mini-schema prompt for selected charts
   *
   * Returns condensed schema info suitable for downstream agents.
   */
  generateMiniSchema(): string {
    const lines: string[] = ['# Available Chart Types\n'];

    for (const def of this.values()) {
      lines.push(`## ${def.type}`);
      lines.push(def.description);
      lines.push(`- Category: ${def.category}`);
      lines.push(`- Data shapes: ${def.dataShapes.join(', ')}`);
      if (def.requiredFields) {
        lines.push(`- Required fields: ${def.requiredFields.join(', ')}`);
      }
      if (def.seriesField) {
        lines.push(`- Supports series grouping`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get type names as array (convenience for discriminator)
   */
  getTypeNames(): string[] {
    return this.keys();
  }
}
