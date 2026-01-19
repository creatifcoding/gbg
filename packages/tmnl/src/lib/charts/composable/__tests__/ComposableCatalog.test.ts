/**
 * ComposableCatalog Tests
 *
 * Verifies set operations and category catalogs.
 */

import { describe, it, expect } from 'vitest';
import {
  allCharts,
  trendCharts,
  comparisonCharts,
  partToWholeCharts,
  distributionCharts,
  hierarchicalCharts,
  networkCharts,
  statisticalCharts,
  relationalCharts,
  dashboardCharts,
} from '../categories';
import { ChartCatalog } from '../ComposableCatalog';

describe('ComposableCatalog', () => {
  describe('static catalogs', () => {
    it('allCharts contains all 35 chart types', () => {
      // 27 statistical + 8 relational = 35
      expect(allCharts.size).toBe(35);
    });

    it('trendCharts contains Line, Area, Stock', () => {
      const types = trendCharts.getTypeNames();
      expect(types).toContain('Line');
      expect(types).toContain('Area');
      expect(types).toContain('Stock');
      expect(types.length).toBe(3);
    });

    it('comparisonCharts contains Bar, Column, Radar, Rose, BidirectionalBar', () => {
      const types = comparisonCharts.getTypeNames();
      expect(types).toContain('Bar');
      expect(types).toContain('Column');
      expect(types).toContain('Radar');
      expect(types).toContain('Rose');
      expect(types).toContain('BidirectionalBar');
    });

    it('partToWholeCharts contains Pie, Treemap, Sunburst, CirclePacking', () => {
      const types = partToWholeCharts.getTypeNames();
      expect(types).toContain('Pie');
      expect(types).toContain('Treemap');
      expect(types).toContain('Sunburst');
      expect(types).toContain('CirclePacking');
    });

    it('distributionCharts contains Scatter, Histogram, Box, Violin', () => {
      const types = distributionCharts.getTypeNames();
      expect(types).toContain('Scatter');
      expect(types).toContain('Histogram');
      expect(types).toContain('Box');
      expect(types).toContain('Violin');
    });
  });

  describe('set operations', () => {
    it('union combines catalogs', () => {
      const combined = trendCharts.union(comparisonCharts);
      expect(combined.size).toBe(trendCharts.size + comparisonCharts.size);
      expect(combined.has('Line')).toBe(true);
      expect(combined.has('Bar')).toBe(true);
    });

    it('intersection finds common charts', () => {
      // Line is only in trend, Bar is only in comparison
      const intersection = trendCharts.intersection(comparisonCharts);
      expect(intersection.size).toBe(0);

      // statisticalCharts and allCharts should have all statistical
      const statistical = allCharts.intersection(statisticalCharts);
      expect(statistical.size).toBe(statisticalCharts.size);
    });

    it('difference removes charts', () => {
      const withoutTrend = allCharts.difference(trendCharts);
      expect(withoutTrend.has('Line')).toBe(false);
      expect(withoutTrend.has('Area')).toBe(false);
      expect(withoutTrend.has('Bar')).toBe(true);
    });

    it('pick selects specific charts', () => {
      const selected = allCharts.pick('Line', 'Bar', 'Pie');
      expect(selected.size).toBe(3);
      expect(selected.has('Line')).toBe(true);
      expect(selected.has('Bar')).toBe(true);
      expect(selected.has('Pie')).toBe(true);
    });

    it('omit excludes specific charts', () => {
      const excluded = allCharts.omit('Line', 'Bar');
      expect(excluded.has('Line')).toBe(false);
      expect(excluded.has('Bar')).toBe(false);
      expect(excluded.has('Pie')).toBe(true);
    });

    it('filter by predicate', () => {
      const withSeries = allCharts.filter(def => def.seriesField === true);
      expect(withSeries.every(def => def.seriesField === true)).toBe(true);
    });
  });

  describe('chart-specific methods', () => {
    it('byCategory filters correctly', () => {
      const trend = allCharts.byCategory('trend');
      expect(trend.getTypeNames()).toEqual(trendCharts.getTypeNames());
    });

    it('byDataShape filters correctly', () => {
      const timeSeries = allCharts.byDataShape('time-series');
      expect(timeSeries.some(def => def.dataShapes.includes('time-series'))).toBe(true);
    });

    it('hierarchical returns only hierarchical charts', () => {
      const hierarchical = allCharts.hierarchical();
      expect(hierarchical.every(def => def.hasChildren === true)).toBe(true);
    });

    it('withSeriesSupport returns only charts with series field', () => {
      const withSeries = allCharts.withSeriesSupport();
      expect(withSeries.every(def => def.seriesField === true)).toBe(true);
    });
  });

  describe('convenience groupings', () => {
    it('statisticalCharts excludes hierarchical and network', () => {
      expect(statisticalCharts.some(def => def.category === 'hierarchical')).toBe(false);
      expect(statisticalCharts.some(def => def.category === 'network')).toBe(false);
    });

    it('relationalCharts contains only hierarchical and network', () => {
      expect(relationalCharts.every(
        def => def.category === 'hierarchical' || def.category === 'network'
      )).toBe(true);
    });

    it('dashboardCharts contains trends, comparisons, KPIs, part-to-whole', () => {
      expect(dashboardCharts.has('Line')).toBe(true);  // trend
      expect(dashboardCharts.has('Bar')).toBe(true);   // comparison
      expect(dashboardCharts.has('Gauge')).toBe(true); // kpi
      expect(dashboardCharts.has('Pie')).toBe(true);   // part-to-whole
    });
  });

  describe('mini-schema generation', () => {
    it('generateMiniSchema produces readable output', () => {
      const schema = trendCharts.generateMiniSchema();
      expect(schema).toContain('Line');
      expect(schema).toContain('Area');
      expect(schema).toContain('Stock');
      expect(schema).toContain('Category:');
      expect(schema).toContain('Data shapes:');
    });
  });
});
