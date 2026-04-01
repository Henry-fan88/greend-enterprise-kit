import React, { useState, useMemo } from 'react';
import { ResponsiveGridLayout, Layout, LayoutItem, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useApp } from '../store';
import type { CustomPanelConfig } from '../store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { X, Plus, GripHorizontal, Pencil } from 'lucide-react';
import AddPanelWizard from './AddPanelWizard';
import CustomPanelRenderer from './CustomPanelRenderer';
import PanelEditModal from './PanelEditModal';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const ResponsiveGridLayoutCompat = ResponsiveGridLayout as React.ComponentType<any>;

const AVAILABLE_PANELS = [
  { id: 'emissions', title: 'Carbon Emissions Trend', w: 6, h: 4 },
  { id: 'energy', title: 'Energy Distribution', w: 6, h: 4 },
  { id: 'diversity', title: 'Diversity Ratio (%)', w: 6, h: 4 },
  { id: 'summary', title: 'Quick Summary', w: 6, h: 4 },
  { id: 'water', title: 'Water Usage Trend', w: 6, h: 4 },
];

// Returns the month index (0–11) for a data point using its creation timestamp.
// Falls back to -1 if no history exists, which callers should ignore.
const creationMonth = (timestamps: { timestamp: string }[]): number =>
  timestamps[0] ? new Date(timestamps[0].timestamp).getMonth() : -1;

export default function Dashboard() {
  const {
    data, dashboardLayout, setDashboardLayout, dashboardPanels, setDashboardPanels,
    customPanelConfigs, removeCustomPanel, updateCustomPanel,
  } = useApp();
  const { width, containerRef } = useContainerWidth();
  const [showWizard, setShowWizard] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<CustomPanelConfig | null>(null);

  const emissionsData = useMemo(() => {
    const scope1 = data.filter(d => d.section === 'Environmental' && d.scope === 'Scope 1');
    const scope2 = data.filter(d => d.section === 'Environmental' && d.scope === 'Scope 2');

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const aggregated = months.map(month => ({ name: month, Scope1: 0, Scope2: 0 }));

    scope1.forEach(d => {
      const idx = creationMonth(d.lastModifiedBy);
      if (idx >= 0) aggregated[idx].Scope1 += (d.yearlyValues[2024] ?? 0);
    });

    scope2.forEach(d => {
      const idx = creationMonth(d.lastModifiedBy);
      if (idx >= 0) aggregated[idx].Scope2 += (d.yearlyValues[2024] ?? 0);
    });

    const withData = aggregated.filter(a => a.Scope1 > 0 || a.Scope2 > 0);
    return withData.length > 0 ? withData : [
      { name: 'Jan', Scope1: 1200, Scope2: 800 },
      { name: 'Feb', Scope1: 1100, Scope2: 750 },
      { name: 'Mar', Scope1: 1050, Scope2: 700 },
    ];
  }, [data]);

  const energyData = useMemo(() => {
    const energy = data.filter(d => d.id === 'Energy Consumption');
    const byDept: Record<string, number> = {};

    energy.forEach(d => {
      byDept[d.department] = (byDept[d.department] || 0) + (d.yearlyValues[2024] ?? 0);
    });

    const result = Object.keys(byDept).map(dept => ({ name: dept, value: byDept[dept] }));
    return result.length > 0 ? result : [
      { name: 'Factory A', value: 4000 },
      { name: 'Factory B', value: 3000 },
      { name: 'Office', value: 1000 },
    ];
  }, [data]);

  const diversityData = useMemo(() => {
    const diversity = data.filter(d => d.id === 'Diversity Ratio');
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const aggregated = quarters.map(q => ({ name: q, ratio: 0, count: 0 }));

    diversity.forEach(d => {
      const month = creationMonth(d.lastModifiedBy);
      const qIdx = month >= 0 ? Math.floor(month / 3) : -1;
      if (qIdx >= 0 && qIdx < 4) {
        aggregated[qIdx].ratio += (d.yearlyValues[2024] ?? 0);
        aggregated[qIdx].count += 1;
      }
    });

    const result = aggregated
      .filter(a => a.count > 0)
      .map(a => ({ name: a.name, ratio: Math.round(a.ratio / a.count) }));

    return result.length > 0 ? result : [
      { name: 'Q1', ratio: 42 },
      { name: 'Q2', ratio: 43 },
      { name: 'Q3', ratio: 45 },
    ];
  }, [data]);

  const waterData = useMemo(() => {
    const water = data.filter(d => d.id === 'Water Usage');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const aggregated = months.map(month => ({ name: month, usage: 0 }));

    water.forEach(d => {
      const idx = creationMonth(d.lastModifiedBy);
      if (idx >= 0) aggregated[idx].usage += (d.yearlyValues[2024] ?? 0);
    });

    const result = aggregated.filter(a => a.usage > 0);
    return result.length > 0 ? result : [
      { name: 'Jan', usage: 300 },
      { name: 'Feb', usage: 280 },
      { name: 'Mar', usage: 310 },
    ];
  }, [data]);

  const summaryData = useMemo(() => {
    const sum = (filter: (d: typeof data[number]) => boolean) =>
      data.filter(filter).reduce((acc, cur) => acc + (cur.yearlyValues[2024] ?? 0), 0);

    return {
      scope1:  sum(d => d.section === 'Environmental' && d.scope === 'Scope 1') || 1200,
      energy:  sum(d => d.id === 'Energy Consumption') || 8000,
      water:   sum(d => d.id === 'Water Usage') || 300,
      rnd:     sum(d => d.id === 'R&D Green Tech Investment') || 2.5,
    };
  }, [data]);

  const removePanel = (id: string) => {
    setDashboardPanels(dashboardPanels.filter(p => p !== id));
    setDashboardLayout(dashboardLayout.filter(l => l.i !== id));
    if (id.startsWith('custom_')) removeCustomPanel(id);
  };

  const PanelHeader = ({ title, id, isCustom }: { title: string; id: string; isCustom: boolean }) => (
    <div className="mb-4">
      <div className="flex justify-center cursor-move drag-handle py-0.5 text-gray-300 hover:text-gray-500 transition-colors" title="Drag to move panel">
        <GripHorizontal className="w-5 h-5" />
      </div>
      <div className="flex justify-between items-center gap-2">
        <h3 className="font-semibold text-lg truncate">{title}</h3>
        <div className="flex items-center gap-1.5 text-gray-400 shrink-0">
          {isCustom && (
            <Pencil
              className="w-3.5 h-3.5 cursor-pointer hover:text-blue-500 transition-colors"
              title="Edit panel"
              onClick={e => { e.stopPropagation(); setEditingPanelId(id); setDraftConfig(customPanelConfigs[id] ?? null); }}
            />
          )}
          <X
            className="w-4 h-4 cursor-pointer hover:text-red-500 transition-colors"
            onClick={e => { e.stopPropagation(); removePanel(id); }}
          />
        </div>
      </div>
    </div>
  );

  const renderPanelContent = (id: string) => {
    switch (id) {
      case 'emissions':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={emissionsData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Line type="monotone" dataKey="Scope1" stroke="#8884d8" strokeWidth={2} />
              <Line type="monotone" dataKey="Scope2" stroke="#82ca9d" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'energy':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={energyData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {energyData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'diversity':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diversityData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <RechartsTooltip />
              <Bar dataKey="ratio" fill="#ffc658" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'water':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={waterData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Line type="monotone" dataKey="usage" stroke="#00C49F" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'summary':
        return (
          <div className="flex-1 grid grid-cols-2 gap-4 h-full">
            <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-center">
              <span className="text-sm text-gray-500">Total Scope 1</span>
              <span className="text-2xl font-bold mt-1">{summaryData.scope1.toLocaleString()} tCO2e</span>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-center">
              <span className="text-sm text-gray-500">Total Energy</span>
              <span className="text-2xl font-bold mt-1">{summaryData.energy.toLocaleString()} MWh</span>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-center">
              <span className="text-sm text-gray-500">Water Usage</span>
              <span className="text-2xl font-bold mt-1">{summaryData.water.toLocaleString()} m³</span>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-center">
              <span className="text-sm text-gray-500">R&D Green Tech</span>
              <span className="text-2xl font-bold mt-1">${summaryData.rnd.toLocaleString()}M</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8 h-full overflow-auto" ref={containerRef}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <button
          onClick={() => setShowWizard(true)}
          className="bg-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium border border-gray-200 hover:bg-gray-50 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Panel</span>
        </button>
      </div>

      {showWizard && <AddPanelWizard onClose={() => setShowWizard(false)} />}
      {editingPanelId && customPanelConfigs[editingPanelId] && (
        <PanelEditModal
          config={customPanelConfigs[editingPanelId]}
          allData={data}
          onDraftChange={setDraftConfig}
          onSave={draft => {
            updateCustomPanel(draft);
            setEditingPanelId(null);
            setDraftConfig(null);
          }}
          onCancel={() => {
            setEditingPanelId(null);
            setDraftConfig(null);
          }}
        />
      )}

      {width > 0 && (
        <ResponsiveGridLayoutCompat
          className="layout"
          layouts={{ lg: dashboardLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          width={width}
          draggableHandle=".drag-handle"
          onLayoutChange={(newLayout: Layout) => setDashboardLayout([...newLayout])}
        >
          {dashboardPanels.map(id => {
            const isCustom = id.startsWith('custom_');
            const config = customPanelConfigs[id];
            const activeDraft = editingPanelId === id ? draftConfig : null;
            const displayTitle = isCustom
              ? (activeDraft?.title || config?.title || config?.dataIds.join(' + ') || 'Custom Panel')
              : (AVAILABLE_PANELS.find(p => p.id === id)?.title ?? id);

            if (!isCustom && !AVAILABLE_PANELS.find(p => p.id === id)) return null;
            if (isCustom && !config) return null;

            return (
              <div key={id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <PanelHeader title={displayTitle} id={id} isCustom={isCustom} />
                <div className="flex-1 min-h-0">
                  {isCustom && config
                    ? <CustomPanelRenderer
                        config={config}
                        data={data}
                        configOverride={activeDraft ?? undefined}
                      />
                    : renderPanelContent(id)
                  }
                </div>
              </div>
            );
          })}
        </ResponsiveGridLayoutCompat>
      )}
    </div>
  );
}
