import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Search, Check, Trash2, GripVertical,
  BarChart2, TrendingUp, Activity, PieChart, Circle, ChartScatter,
  Hexagon, Filter, Gauge, Grid3X3, GitMerge, LayoutList,
} from 'lucide-react';
import type { ChartType, CustomPanelConfig, EsgData, SeriesOverride } from '../store';
import { cn } from '../lib/utils';

// Default series colors — must match CustomPanelRenderer's COLORS array
const COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666',
  '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
];

interface ChartOption {
  type: ChartType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const CHART_OPTIONS: ChartOption[] = [
  { type: 'bar',         label: 'Bar',         description: 'Compare values across categories',  icon: <BarChart2 className="w-5 h-5" /> },
  { type: 'stacked-bar', label: 'Stacked Bar', description: 'Show composition over time',        icon: <LayoutList className="w-5 h-5" /> },
  { type: 'line',        label: 'Line',        description: 'Track trends over time',            icon: <TrendingUp className="w-5 h-5" /> },
  { type: 'area',        label: 'Area',        description: 'Trends with volume emphasis',       icon: <Activity className="w-5 h-5" /> },
  { type: 'pie',         label: 'Pie',         description: 'Share of total at a point in time', icon: <PieChart className="w-5 h-5" /> },
  { type: 'donut',       label: 'Donut',       description: 'Cleaner pie chart variant',         icon: <Circle className="w-5 h-5" /> },
  { type: 'scatter',     label: 'Scatter',     description: 'Correlation between metrics',       icon: <ChartScatter className="w-5 h-5" /> },
  { type: 'radar',       label: 'Radar',       description: 'Multi-metric spider comparison',    icon: <Hexagon className="w-5 h-5" /> },
  { type: 'funnel',      label: 'Funnel',      description: 'Reduction or pipeline stages',      icon: <Filter className="w-5 h-5" /> },
  { type: 'gauge',       label: 'Gauge',       description: 'Single KPI vs target (last year)',  icon: <Gauge className="w-5 h-5" /> },
  { type: 'heatmap',     label: 'Heatmap',     description: 'Year × metric density grid',        icon: <Grid3X3 className="w-5 h-5" /> },
  { type: 'sankey',      label: 'Sankey',      description: 'Flow / allocation between items',   icon: <GitMerge className="w-5 h-5" /> },
];

interface Props {
  config: CustomPanelConfig;
  allData: EsgData[];
  onSave: (draft: CustomPanelConfig) => void;
  onCancel: () => void;
  onDraftChange: (draft: CustomPanelConfig) => void;
}

export default function PanelEditModal({ config, allData, onSave, onCancel, onDraftChange }: Props) {
  const [draft, setDraft] = useState<CustomPanelConfig>(() => ({
    ...config,
    title: config.title ?? '',
    seriesOverrides: config.seriesOverrides ?? {},
  }));
  const [search, setSearch] = useState('');

  const update = (partial: Partial<CustomPanelConfig>) => {
    const next = { ...draft, ...partial };
    setDraft(next);
    onDraftChange(next);
  };

  const sortedIds = useMemo(
    () => [...allData.map(d => d.id)].sort((a, b) => a.localeCompare(b)),
    [allData]
  );

  const filteredIds = useMemo(
    () => sortedIds.filter(id => id.toLowerCase().includes(search.toLowerCase())),
    [sortedIds, search]
  );

  const toggleId = (id: string) => {
    const has = draft.dataIds.includes(id);
    const newIds = has ? draft.dataIds.filter(x => x !== id) : [...draft.dataIds, id];
    const newOverrides = { ...draft.seriesOverrides };
    if (has) delete newOverrides[id];
    update({ dataIds: newIds, seriesOverrides: newOverrides });
  };

  const setOv = (dataId: string, partial: Partial<SeriesOverride>) => {
    const prev = draft.seriesOverrides?.[dataId] ?? {};
    const next = { ...prev, ...partial };
    // Remove keys that are explicitly set to undefined
    Object.keys(next).forEach(k => { if ((next as any)[k] === undefined) delete (next as any)[k]; });
    update({ seriesOverrides: { ...draft.seriesOverrides, [dataId]: next } });
  };

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== idx) setDragOverIndex(idx);
  };

  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) { setDragIndex(null); setDragOverIndex(null); return; }

    // Snapshot each metric's resolved color before the reorder so it travels with the metric
    const resolvedColors: Record<string, string> = {};
    draft.dataIds.forEach((id, i) => {
      resolvedColors[id] = draft.seriesOverrides?.[id]?.color ?? COLORS[i % COLORS.length];
    });

    const newIds = [...draft.dataIds];
    const [moved] = newIds.splice(dragIndex, 1);
    newIds.splice(idx, 0, moved);

    // Write resolved colors into overrides so position no longer determines color
    const newOverrides = { ...draft.seriesOverrides };
    newIds.forEach(id => {
      newOverrides[id] = { ...newOverrides[id], color: resolvedColors[id] };
    });

    setDragIndex(null);
    setDragOverIndex(null);
    update({ dataIds: newIds, seriesOverrides: newOverrides });
  };

  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (draft.dataIds.length > 0) onSave(draft);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [draft, onSave]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Edit Panel</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* Section: Title */}
          <section className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Panel Title</p>
            <input
              type="text"
              value={draft.title ?? ''}
              onChange={e => update({ title: e.target.value })}
              placeholder="Enter panel title…"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
            />
          </section>

          {/* Section: Data Metrics */}
          <section className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Data Metrics
              {draft.dataIds.length > 0 && (
                <span className="ml-2 text-blue-500 normal-case font-medium">
                  {draft.dataIds.length} selected
                </span>
              )}
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search metrics…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
              />
            </div>
            <div className="space-y-0.5 max-h-[180px] overflow-y-auto border border-gray-100 rounded-lg p-1">
              {filteredIds.length === 0 && (
                <p className="text-sm text-gray-400 py-3 text-center">No metrics match</p>
              )}
              {filteredIds.map(id => {
                const checked = draft.dataIds.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleId(id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors',
                      checked ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      checked ? 'bg-white border-white' : 'border-gray-300'
                    )}>
                      {checked && <Check className="w-2.5 h-2.5 text-gray-900" />}
                    </div>
                    <span className="truncate">{id}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section: Chart Type */}
          <section className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Chart Type</p>
            <div className="grid grid-cols-4 gap-2">
              {CHART_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => update({ chartType: opt.type })}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all',
                    draft.chartType === opt.type
                      ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                      : 'border-gray-100 hover:border-gray-300 text-gray-700 bg-white'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    draft.chartType === opt.type ? 'bg-white/20' : 'bg-gray-50'
                  )}>
                    {opt.icon}
                  </div>
                  <span className="text-[11px] font-semibold leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Section: Legend Overrides */}
          {draft.dataIds.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Legend</p>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 w-6" />
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Metric</th>
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Label</th>
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Color</th>
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Unit</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {draft.dataIds.map((dataId, idx) => {
                      const ov = draft.seriesOverrides?.[dataId] ?? {};
                      const originalUnit = allData.find(d => d.id === dataId)?.unit ?? '';
                      const defaultColor = COLORS[idx % COLORS.length];

                      return (
                        <tr
                          key={dataId}
                          draggable
                          onDragStart={handleDragStart(idx)}
                          onDragOver={handleDragOver(idx)}
                          onDrop={handleDrop(idx)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            'transition-colors duration-100',
                            dragIndex === idx && 'opacity-40',
                            dragOverIndex === idx && dragIndex !== idx && 'bg-blue-50 border-t-2 border-blue-400'
                          )}
                        >
                          <td className="px-2 py-2.5 w-6">
                            <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab active:cursor-grabbing" />
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 w-[180px] max-w-[180px]">
                            <span className="break-words leading-relaxed">{dataId}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={ov.label ?? ''}
                              placeholder={dataId}
                              onChange={e => setOv(dataId, { label: e.target.value || undefined })}
                              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors placeholder:text-gray-300"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <label
                              className="block w-7 h-7 rounded-lg border-2 border-white shadow-sm cursor-pointer ring-1 ring-gray-200 hover:ring-gray-400 transition-all"
                              style={{ backgroundColor: ov.color ?? defaultColor }}
                            >
                              <input
                                type="color"
                                value={ov.color ?? defaultColor}
                                onChange={e => setOv(dataId, { color: e.target.value })}
                                className="sr-only"
                              />
                            </label>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={ov.unit ?? ''}
                              placeholder={originalUnit}
                              onChange={e => setOv(dataId, { unit: e.target.value || undefined })}
                              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors placeholder:text-gray-300"
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              onClick={() => toggleId(dataId)}
                              title="Remove metric"
                              className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={draft.dataIds.length === 0}
            className={cn(
              'px-5 py-2 text-sm font-medium rounded-lg transition-colors',
              draft.dataIds.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            )}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
