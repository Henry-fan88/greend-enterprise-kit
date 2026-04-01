import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { SlidersHorizontal, RotateCcw, ArrowRight } from 'lucide-react';
import type { EsgData, CustomPanelConfig, SeriesOverride } from '../store';
import { cn } from '../lib/utils';

const COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666',
  '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
];

const CARTESIAN_TYPES = new Set(['bar', 'stacked-bar', 'line', 'area', 'scatter', 'heatmap']);

type YearRow = { year: string; [dataId: string]: number | string };

interface AxisOverrides {
  yMin?: number;
  yMax?: number;
  yScale?: 'value' | 'log';
  xStart?: number;
  xEnd?: number;
}

function buildYearlyData(config: CustomPanelConfig, allData: EsgData[]): YearRow[] {
  const years: number[] = [];
  for (let y = config.yearStart; y <= config.yearEnd; y++) years.push(y);

  return years.map(year => {
    const row: YearRow = { year: String(year) };
    config.dataIds.forEach(dataId => {
      const item = allData.find(d => d.id === dataId);
      if (!item) { row[dataId] = 0; return; }
      row[dataId] = item.yearlyValues[year] ?? 0;
    });
    return row;
  });
}

function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  return Math.ceil(rawMax / mag) * mag;
}

function buildEChartsOption(
  config: CustomPanelConfig,
  yearlyRows: YearRow[],
  overrides: AxisOverrides = {},
  allData: EsgData[] = []
): object {
  const { chartType, dataIds } = config;

  // Helper: resolve per-series display name, color, and unit
  const seriesName = (id: string) => config.seriesOverrides?.[id]?.label ?? id;
  const seriesColor = (id: string, idx: number) => config.seriesOverrides?.[id]?.color ?? COLORS[idx % COLORS.length];
  const seriesUnit = (id: string) =>
    config.seriesOverrides?.[id]?.unit ?? allData.find(d => d.id === id)?.unit ?? '';
  // seriesLabel = name + unit suffix shown in legend and labels
  const seriesLabel = (id: string) => {
    const name = seriesName(id);
    const unit = seriesUnit(id);
    return unit ? `${name} (${unit})` : name;
  };
  const lastRow = yearlyRows[yearlyRows.length - 1] ?? { year: '' };

  // Apply X-axis range filtering for Cartesian charts
  const xStart = overrides.xStart ?? config.yearStart;
  const xEnd   = overrides.xEnd   ?? config.yearEnd;
  const visibleRows = CARTESIAN_TYPES.has(chartType)
    ? yearlyRows.filter(r => { const n = Number(r.year); return n >= xStart && n <= xEnd; })
    : yearlyRows;
  const years = visibleRows.map(r => r.year);

  // Shared Y-axis option for Cartesian value axes
  const yAxisOption = {
    type: overrides.yScale ?? 'value',
    ...(overrides.yMin !== undefined ? { min: overrides.yMin } : {}),
    ...(overrides.yMax !== undefined ? { max: overrides.yMax } : {}),
  };

  // Unit is already embedded in p.seriesName via seriesLabel, so no suffix needed
  const axisTooltipFormatter = (params: any[]) =>
    params.map((p: any) => `${p.marker}${p.seriesName}: <b>${p.value}</b>`).join('<br/>');

  const baseOption = {
    backgroundColor: 'transparent',
    color: COLORS,
    animation: true,
    animationDuration: 700,
    tooltip: { confine: true },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 16, top: 10, bottom: 40, containLabel: true },
  };

  if (chartType === 'bar' || chartType === 'stacked-bar') {
    return {
      ...baseOption,
      tooltip: { trigger: 'axis', confine: true, formatter: axisTooltipFormatter },
      xAxis: { type: 'category', data: years },
      yAxis: yAxisOption,
      series: dataIds.map((id, i) => ({
        name: seriesLabel(id),
        type: 'bar',
        stack: chartType === 'stacked-bar' ? 'total' : undefined,
        data: visibleRows.map(r => r[id] ?? 0),
        itemStyle: { color: seriesColor(id, i) },
        emphasis: { focus: 'series' },
        barMaxWidth: 48,
      })),
    };
  }

  if (chartType === 'line') {
    return {
      ...baseOption,
      tooltip: { trigger: 'axis', confine: true, formatter: axisTooltipFormatter },
      xAxis: { type: 'category', data: years },
      yAxis: yAxisOption,
      series: dataIds.map((id, i) => ({
        name: seriesLabel(id),
        type: 'line',
        smooth: true,
        data: visibleRows.map(r => r[id] ?? 0),
        itemStyle: { color: seriesColor(id, i) },
        lineStyle: { width: 2, color: seriesColor(id, i) },
        symbol: 'circle',
        symbolSize: 6,
      })),
    };
  }

  if (chartType === 'area') {
    return {
      ...baseOption,
      tooltip: { trigger: 'axis', confine: true, formatter: axisTooltipFormatter },
      xAxis: { type: 'category', data: years },
      yAxis: yAxisOption,
      series: dataIds.map((id, i) => ({
        name: seriesLabel(id),
        type: 'line',
        smooth: true,
        data: visibleRows.map(r => r[id] ?? 0),
        areaStyle: { opacity: 0.3, color: seriesColor(id, i) },
        itemStyle: { color: seriesColor(id, i) },
        lineStyle: { width: 2, color: seriesColor(id, i) },
      })),
    };
  }

  if (chartType === 'pie' || chartType === 'donut') {
    return {
      ...baseOption,
      grid: undefined,
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: any) => {
          const id = dataIds[p.dataIndex] ?? p.name;
          const unit = seriesUnit(id);
          return `${p.name}: <b>${p.value}</b>${unit ? ' ' + unit : ''} (${p.percent}%)`;
        },
      },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: chartType === 'donut' ? ['38%', '65%'] : '65%',
        center: ['50%', '45%'],
        data: dataIds.map((id, i) => ({
          name: seriesLabel(id),
          value: lastRow[id] ?? 0,
          itemStyle: { color: seriesColor(id, i) },
        })),
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.2)' } },
        label: { formatter: '{b}\n{d}%', fontSize: 11 },
      }],
    };
  }

  if (chartType === 'scatter') {
    return {
      ...baseOption,
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: any) => {
          const id = dataIds[p.seriesIndex] ?? p.seriesName;
          const unit = seriesUnit(id);
          return `${p.seriesName}<br/>${p.data[0]}: <b>${p.data[1]}</b>${unit ? ' ' + unit : ''}`;
        },
      },
      xAxis: { type: 'category', data: years, name: 'Year' },
      yAxis: yAxisOption,
      series: dataIds.map((id, i) => ({
        name: seriesLabel(id),
        type: 'scatter',
        data: visibleRows.map(r => [r.year, r[id] ?? 0]),
        itemStyle: { color: seriesColor(id, i) },
        symbolSize: 10,
      })),
    };
  }

  if (chartType === 'radar') {
    const maxVal = Math.max(
      ...dataIds.flatMap(id => yearlyRows.map(r => Number(r[id] ?? 0))),
      1
    );
    return {
      ...baseOption,
      grid: undefined,
      tooltip: { trigger: 'item', confine: true },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      radar: {
        indicator: dataIds.map(id => ({ name: seriesLabel(id), max: maxVal * 1.2 })),
        radius: '55%',
        center: ['50%', '45%'],
      },
      series: [{
        type: 'radar',
        data: yearlyRows.map((row, i) => ({
          name: row.year,
          value: dataIds.map(id => row[id] ?? 0),
          areaStyle: { opacity: 0.2 },
          lineStyle: { color: COLORS[i % COLORS.length] },
          itemStyle: { color: COLORS[i % COLORS.length] },
        })),
      }],
    };
  }

  if (chartType === 'funnel') {
    const funnelData = dataIds
      .map((id, i) => ({ name: seriesLabel(id), value: Number(lastRow[id] ?? 0), itemStyle: { color: seriesColor(id, i) } }))
      .sort((a, b) => b.value - a.value);
    return {
      ...baseOption,
      grid: undefined,
      tooltip: { trigger: 'item', formatter: '{b}: {c}', confine: true },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      series: [{
        type: 'funnel',
        left: '10%',
        top: 10,
        bottom: 40,
        width: '80%',
        sort: 'descending',
        data: funnelData,
        label: { position: 'inside', formatter: '{b}' },
      }],
    };
  }

  if (chartType === 'gauge') {
    const primaryId = dataIds[0];
    const val = Number(lastRow[primaryId] ?? 0);
    const allVals = yearlyRows.map(r => Number(r[primaryId] ?? 0)).filter(v => v > 0);
    const maxV = allVals.length > 0 ? Math.max(...allVals) * 1.25 : 100;
    const unit = seriesUnit(primaryId);
    return {
      ...baseOption,
      grid: undefined,
      legend: undefined,
      tooltip: { formatter: `{b}: {c}${unit ? ' ' + unit : ''}`, confine: true },
      series: [{
        type: 'gauge',
        center: ['50%', '55%'],
        radius: '70%',
        min: 0,
        max: Math.round(maxV),
        detail: { formatter: `{value}${unit ? ' ' + unit : ''}`, fontSize: 18, offsetCenter: [0, '70%'] },
        title: { offsetCenter: [0, '90%'], fontSize: 12, color: '#666' },
        data: [{ value: val, name: seriesLabel(primaryId) }],
        axisLine: { lineStyle: { width: 16, color: [[0.3, '#67e0e3'], [0.7, '#37a2da'], [1, '#fd666d']] } },
        pointer: { itemStyle: { color: 'auto' } },
      }],
    };
  }

  if (chartType === 'heatmap') {
    const allValues = visibleRows.flatMap(r => dataIds.map(id => Number(r[id] ?? 0)));
    const maxV = Math.max(...allValues, 1);
    const heatData: [number, number, number][] = [];
    visibleRows.forEach((row, yi) => {
      dataIds.forEach((id, di) => {
        heatData.push([yi, di, Number(row[id] ?? 0)]);
      });
    });
    return {
      ...baseOption,
      grid: { left: 100, right: 40, top: 10, bottom: 60, containLabel: false },
      tooltip: { trigger: 'item', formatter: (p: any) => `${years[p.data[0]]} / ${seriesName(dataIds[p.data[1]])}: ${p.data[2]}`, confine: true },
      legend: undefined,
      xAxis: { type: 'category', data: years, splitArea: { show: true } },
      yAxis: { type: 'category', data: dataIds.map(seriesLabel), splitArea: { show: true }, axisLabel: { width: 90, overflow: 'truncate' } },
      visualMap: { min: 0, max: maxV, calculable: true, orient: 'horizontal', left: 'center', bottom: 5, itemHeight: 100, textStyle: { fontSize: 10 } },
      series: [{ type: 'heatmap', data: heatData, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10 } } }],
    };
  }

  if (chartType === 'sankey') {
    if (dataIds.length < 2) {
      return {
        ...baseOption,
        tooltip: { trigger: 'axis', confine: true },
        xAxis: { type: 'category', data: years },
        yAxis: yAxisOption,
        series: [{ name: seriesLabel(dataIds[0]), type: 'bar', data: visibleRows.map(r => r[dataIds[0]] ?? 0), itemStyle: { color: COLORS[0] } }],
      };
    }
    const nodes = dataIds.map(id => ({ name: seriesLabel(id) }));
    const links = dataIds.slice(0, -1).map((id, i) => ({
      source: seriesLabel(id),
      target: seriesLabel(dataIds[i + 1]),
      value: Number(lastRow[id] ?? 0) || 1,
    }));
    return {
      ...baseOption,
      grid: undefined,
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}: ${p.value ?? ''}`, confine: true },
      legend: undefined,
      series: [{
        type: 'sankey',
        top: 10,
        bottom: 20,
        left: 20,
        right: 20,
        data: nodes,
        links,
        lineStyle: { color: 'gradient', opacity: 0.4 },
        label: { color: '#333', fontSize: 11 },
        emphasis: { focus: 'adjacency' },
      }],
    };
  }

  // Fallback: bar
  return {
    ...baseOption,
    tooltip: { trigger: 'axis', confine: true, formatter: axisTooltipFormatter },
    xAxis: { type: 'category', data: years },
    yAxis: yAxisOption,
    series: dataIds.map((id, i) => ({
      name: seriesLabel(id),
      type: 'bar',
      data: visibleRows.map(r => r[id] ?? 0),
      itemStyle: { color: seriesColor(id, i) },
    })),
  };
}

interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
}

function RangeSlider({ min, max, step, valueMin, valueMax, onChange }: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'min' | 'max' | null>(null);

  const toPercent = (v: number) => ((v - min) / (max - min)) * 100;
  const snap = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));

  const getValueFromPointer = (clientX: number): number => {
    if (!trackRef.current) return min;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return snap(min + pct * (max - min));
  };

  const onPointerDown = (handle: 'min' | 'max') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = handle;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const v = getValueFromPointer(e.clientX);
    if (dragging.current === 'min') {
      onChange(Math.min(v, valueMax), valueMax);
    } else {
      onChange(valueMin, Math.max(v, valueMin));
    }
  };

  const onPointerUp = () => { dragging.current = null; };

  const minPct = toPercent(valueMin);
  const maxPct = toPercent(valueMax);

  return (
    <div
      ref={trackRef}
      className="relative h-5 flex items-center select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Track background */}
      <div className="absolute w-full h-1.5 rounded-full bg-gray-200" />
      {/* Filled segment */}
      <div
        className="absolute h-1.5 rounded-full bg-blue-500"
        style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
      />
      {/* Min handle */}
      <div
        className="absolute w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-grab active:cursor-grabbing"
        style={{ left: `${minPct}%`, transform: 'translateX(-50%)', zIndex: valueMin === valueMax ? 3 : 1 }}
        onPointerDown={onPointerDown('min')}
      />
      {/* Max handle */}
      <div
        className="absolute w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-grab active:cursor-grabbing"
        style={{ left: `${maxPct}%`, transform: 'translateX(-50%)', zIndex: 2 }}
        onPointerDown={onPointerDown('max')}
      />
    </div>
  );
}

interface Props {
  config: CustomPanelConfig;
  data: EsgData[];
  configOverride?: CustomPanelConfig;
}

export default function CustomPanelRenderer({ config, data, configOverride }: Props) {
  const activeConfig = configOverride ?? config;

  const yearlyRows = useMemo(() => buildYearlyData(activeConfig, data), [activeConfig, data]);

  // Compute slider bounds from actual data values
  const { sliderMin, sliderMax, sliderStep } = useMemo(() => {
    const allVals = activeConfig.dataIds.flatMap(id =>
      yearlyRows.map(r => Number(r[id] ?? 0))
    );
    const rawMin = allVals.length > 0 ? Math.min(...allVals) : 0;
    const rawMax = allVals.length > 0 ? Math.max(...allVals) : 100;
    const sMin = Math.min(0, rawMin < 0 ? Math.floor(rawMin) : 0);
    const sMax = niceMax(rawMax);
    const range = sMax - sMin;
    const step = range <= 10 ? 1 : range <= 100 ? 5 : range <= 1000 ? 10 : range <= 10000 ? 100 : 1000;
    return { sliderMin: sMin, sliderMax: sMax, sliderStep: step };
  }, [yearlyRows, activeConfig.dataIds]);

  const [open, setOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const [yMin, setYMin] = useState<number | undefined>(undefined);
  const [yMax, setYMax] = useState<number | undefined>(undefined);
  const [yScale, setYScale] = useState<'value' | 'log'>('value');
  const [xStart, setXStart] = useState<number>(config.yearStart);
  const [xEnd, setXEnd] = useState<number>(config.yearEnd);

  useEffect(() => {
    setYMin(undefined);
    setYMax(undefined);
    setYScale('value');
    setXStart(config.yearStart);
    setXEnd(config.yearEnd);
  }, [config.id]);

  const isCartesian = CARTESIAN_TYPES.has(activeConfig.chartType);

  // Resolve effective values: undefined means "at default bound"
  const effectiveYMin = yMin ?? sliderMin;
  const effectiveYMax = yMax ?? sliderMax;

  const isCustomized =
    effectiveYMin !== sliderMin || effectiveYMax !== sliderMax ||
    yScale !== 'value' ||
    xStart !== activeConfig.yearStart || xEnd !== activeConfig.yearEnd;

  const handleReset = () => {
    setYMin(undefined);
    setYMax(undefined);
    setYScale('value');
    setXStart(activeConfig.yearStart);
    setXEnd(activeConfig.yearEnd);
  };

  const option = useMemo(
    () => buildEChartsOption(activeConfig, yearlyRows, {
      yMin: effectiveYMin,
      yMax: effectiveYMax,
      yScale,
      xStart,
      xEnd,
    }, data),
    [activeConfig, yearlyRows, effectiveYMin, effectiveYMax, yScale, xStart, xEnd, data]
  );

  const allYears: number[] = [];
  for (let y = activeConfig.yearStart; y <= activeConfig.yearEnd; y++) allYears.push(y);

  const chart = (
    <ReactECharts
      option={option}
      notMerge={true}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );

  if (!isCartesian) {
    return (
      <div className="w-full h-full rounded-lg overflow-hidden">
        {chart}
      </div>
    );
  }

  return (
    <div className="relative flex flex-row w-full h-full gap-1">
      {/* Framed chart — fills full height */}
      <div className="flex-1 min-w-0 h-full rounded-lg overflow-hidden">
        {chart}
      </div>

      {/* Icon column + overlay — wrapped together so click-outside works correctly */}
      <div ref={settingsRef} className="relative shrink-0 flex flex-col items-center">
        <button
          className={cn(
            'p-1.5 rounded-md transition-colors duration-150',
            isCustomized
              ? 'text-blue-500 bg-blue-50 hover:bg-blue-100'
              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100/60'
          )}
          onClick={() => setOpen(o => !o)}
          title="Axis settings"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {isCustomized && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </button>

      {/* Control panel overlay */}
      <div
        className={cn(
          'absolute top-0 right-full mr-1 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg',
          'transition-all duration-200 ease-out origin-top-right',
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Axis Settings
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors duration-150"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>

        <div className="px-3 pb-3 space-y-3">
          {/* Y Axis */}
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Y Axis</p>

          {/* Min / Max value readout */}
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] font-semibold text-gray-600 tabular-nums">
              {effectiveYMin.toLocaleString()}
            </span>
            <span className="text-[10px] font-semibold text-gray-600 tabular-nums">
              {effectiveYMax.toLocaleString()}
            </span>
          </div>

          {/* Dual-handle range slider */}
          <RangeSlider
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            valueMin={effectiveYMin}
            valueMax={effectiveYMax}
            onChange={(newMin, newMax) => {
              setYMin(newMin === sliderMin ? undefined : newMin);
              setYMax(newMax === sliderMax ? undefined : newMax);
            }}
          />

          {/* Scale toggle — hidden for heatmap (its Y-axis is categorical) */}
          {activeConfig.chartType !== 'heatmap' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Scale</span>
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
                {(['value', 'log'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setYScale(s)}
                    className={cn(
                      'flex-1 text-xs font-medium px-3 py-1 rounded-md transition-colors duration-150',
                      yScale === s
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {s === 'value' ? 'Linear' : 'Log'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="h-px bg-gray-100" />

          {/* X Range */}
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">X Range</p>

          <div className="flex items-center gap-1.5">
            <select
              value={xStart}
              onChange={e => {
                const v = Number(e.target.value);
                setXStart(v);
                if (v > xEnd) setXEnd(v);
              }}
              className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer"
            >
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
            <select
              value={xEnd}
              onChange={e => {
                const v = Number(e.target.value);
                setXEnd(v);
                if (v < xStart) setXStart(v);
              }}
              className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer"
            >
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
