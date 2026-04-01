import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Search, ChevronRight, ChevronLeft, BarChart2, TrendingUp, Activity,
  PieChart, Circle, ChartScatter, Hexagon, Filter, Gauge, Grid3X3, GitMerge,
  LayoutList, Check,
} from 'lucide-react';
import { useApp } from '../store';
import type { ChartType, CustomPanelConfig } from '../store';
import { cn } from '../lib/utils';

interface ChartTypeOption {
  type: ChartType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const CHART_OPTIONS: ChartTypeOption[] = [
  { type: 'bar',         label: 'Bar',          description: 'Compare values across categories',   icon: <BarChart2 className="w-5 h-5" /> },
  { type: 'stacked-bar', label: 'Stacked Bar',  description: 'Show composition over time',         icon: <LayoutList className="w-5 h-5" /> },
  { type: 'line',        label: 'Line',         description: 'Track trends over time',             icon: <TrendingUp className="w-5 h-5" /> },
  { type: 'area',        label: 'Area',         description: 'Trends with volume emphasis',        icon: <Activity className="w-5 h-5" /> },
  { type: 'pie',         label: 'Pie',          description: 'Share of total at a point in time',  icon: <PieChart className="w-5 h-5" /> },
  { type: 'donut',       label: 'Donut',        description: 'Cleaner pie chart variant',          icon: <Circle className="w-5 h-5" /> },
  { type: 'scatter',     label: 'Scatter',      description: 'Correlation between metrics',        icon: <ChartScatter className="w-5 h-5" /> },
  { type: 'radar',       label: 'Radar',        description: 'Multi-metric spider comparison',     icon: <Hexagon className="w-5 h-5" /> },
  { type: 'funnel',      label: 'Funnel',       description: 'Reduction or pipeline stages',       icon: <Filter className="w-5 h-5" /> },
  { type: 'gauge',       label: 'Gauge',        description: 'Single KPI vs target (last year)',   icon: <Gauge className="w-5 h-5" /> },
  { type: 'heatmap',     label: 'Heatmap',      description: 'Year × metric density grid',         icon: <Grid3X3 className="w-5 h-5" /> },
  { type: 'sankey',      label: 'Sankey',       description: 'Flow / allocation between items',    icon: <GitMerge className="w-5 h-5" /> },
];

function getAvailableYears(dataIds: string[], allData: { id: string; yearlyValues: Record<number, number> }[]): number[] {
  const years = new Set<number>();
  allData
    .filter(d => dataIds.includes(d.id))
    .forEach(d => Object.keys(d.yearlyValues).forEach(y => years.add(Number(y))));
  if (years.size === 0) years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => a - b);
}

const STEP_LABELS = ['Select Metrics', 'Chart Type', 'Year Range'];

export default function AddPanelWizard({ onClose }: { onClose: () => void }) {
  const { data, dashboardLayout, dashboardPanels, setDashboardPanels, setDashboardLayout, addCustomPanel } = useApp();

  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [chartType, setChartType] = useState<ChartType | null>(null);
  const [yearStart, setYearStart] = useState<number>(new Date().getFullYear());
  const [yearEnd, setYearEnd] = useState<number>(new Date().getFullYear());

  const sortedIds = useMemo(
    () => [...data.map(d => d.id)].sort((a, b) => a.localeCompare(b)),
    [data]
  );

  const filteredIds = useMemo(
    () => sortedIds.filter(id => id.toLowerCase().includes(search.toLowerCase())),
    [sortedIds, search]
  );

  const availableYears = useMemo(() => {
    if (selectedIds.length === 0) return [new Date().getFullYear()];
    return getAvailableYears(selectedIds, data);
  }, [selectedIds, data]);

  const minYear = availableYears[0];
  const maxYear = availableYears[availableYears.length - 1];

  const goToStep2 = () => {
    const years = getAvailableYears(selectedIds, data);
    setYearStart(years[0]);
    setYearEnd(years[years.length - 1]);
    setStep(1);
  };

  const toggleId = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (!chartType) return;
    const id = `custom_${Date.now()}`;
    const config: CustomPanelConfig = { id, dataIds: selectedIds, chartType, yearStart, yearEnd };
    addCustomPanel(config);
    const maxY = Math.max(0, ...dashboardLayout.map((l: any) => l.y + l.h));
    setDashboardPanels([...dashboardPanels, id]);
    setDashboardLayout([...dashboardLayout, { i: id, x: 0, y: maxY, w: 6, h: 4 }]);
    onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (step === 2) { handleConfirm(); return; }
      if (step === 1 && chartType) { setStep(2); return; }
      if (step === 0 && selectedIds.length > 0) { goToStep2(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [step, selectedIds, chartType]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[580px] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create Custom Panel</h2>
            <p className="text-xs text-gray-500 mt-0.5">Step {step + 1} of 3 — {STEP_LABELS[step]}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
              )}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={cn('text-xs font-medium truncate', i === step ? 'text-gray-900' : 'text-gray-400')}>
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-gray-200 ml-1" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Step 1: Select data IDs */}
          {step === 0 && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search metrics..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              {selectedIds.length > 0 && (
                <p className="text-xs text-green-600 font-medium">{selectedIds.length} metric{selectedIds.length > 1 ? 's' : ''} selected</p>
              )}
              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                {filteredIds.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">No metrics match your search</p>
                )}
                {filteredIds.map(id => {
                  const checked = selectedIds.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleId(id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors',
                        checked ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                        checked ? 'bg-white border-white' : 'border-gray-300'
                      )}>
                        {checked && <Check className="w-3 h-3 text-gray-900" />}
                      </div>
                      {id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Chart type */}
          {step === 1 && (
            <div className="grid grid-cols-3 gap-3">
              {CHART_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => setChartType(opt.type)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all',
                    chartType === opt.type
                      ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                      : 'border-gray-100 hover:border-gray-300 text-gray-700 bg-white'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    chartType === opt.type ? 'bg-white/20' : 'bg-gray-50'
                  )}>
                    {opt.icon}
                  </div>
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className={cn('text-[10px] leading-tight', chartType === opt.type ? 'text-white/70' : 'text-gray-400')}>
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Year range */}
          {step === 2 && (
            <div className="flex flex-col gap-6 py-2">
              <div className="text-center">
                <span className="text-3xl font-bold text-gray-900">{yearStart}</span>
                <span className="text-xl text-gray-400 mx-3">–</span>
                <span className="text-3xl font-bold text-gray-900">{yearEnd}</span>
              </div>

              {minYear === maxYear ? (
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-500 text-center">
                  Only data from {minYear} is available. The panel will display this year.
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>Start year</span>
                      <span className="font-medium text-gray-700">{yearStart}</span>
                    </div>
                    <input
                      type="range"
                      min={minYear}
                      max={maxYear}
                      value={yearStart}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setYearStart(v);
                        if (v > yearEnd) setYearEnd(v);
                      }}
                      className="w-full accent-gray-900"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>End year</span>
                      <span className="font-medium text-gray-700">{yearEnd}</span>
                    </div>
                    <input
                      type="range"
                      min={minYear}
                      max={maxYear}
                      value={yearEnd}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setYearEnd(v);
                        if (v < yearStart) setYearStart(v);
                      }}
                      className="w-full accent-gray-900"
                    />
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Panel summary</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Metrics:</span> {selectedIds.join(', ')}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Chart:</span> {CHART_OPTIONS.find(o => o.type === chartType)?.label}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Years:</span> {yearStart} – {yearEnd}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < 2 ? (
            <button
              onClick={() => step === 0 ? goToStep2() : setStep(2)}
              disabled={(step === 0 && selectedIds.length === 0) || (step === 1 && !chartType)}
              className={cn(
                'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all',
                ((step === 0 && selectedIds.length === 0) || (step === 1 && !chartType))
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
              )}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              Confirm & Add Panel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
