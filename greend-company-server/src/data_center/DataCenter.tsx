import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuthenticatedUser, useApp } from '../store';
import {
  Download, Upload, Plus, History, Edit2, Trash2, X,
  ArrowUp, ArrowDown, ArrowUpDown, ListFilter, RotateCcw, Search,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { EsgData, EsgDataChange } from '../store';
import ImportWizard from './import/ImportWizard';

const SECTIONS = ['Environmental', 'Social', 'Governance'] as const;

const getSectionStyle = (section: string | undefined) => {
  switch (section) {
    case 'Environmental': return 'bg-emerald-50 text-emerald-700';
    case 'Social':        return 'bg-blue-50 text-blue-700';
    case 'Governance':    return 'bg-purple-50 text-purple-700';
    default:              return 'bg-gray-100 text-gray-700';
  }
};

const getSectionDot = (section: string | undefined) => {
  switch (section) {
    case 'Environmental': return 'bg-emerald-400';
    case 'Social':        return 'bg-blue-400';
    case 'Governance':    return 'bg-purple-400';
    default:              return 'bg-gray-400';
  }
};

type SortField = 'id' | 'value' | 'lastModified';
type SortDir   = 'asc' | 'desc';
type FilterMap = { category: string | null; section: string | null; scope: string | null; department: string | null };

export default function DataCenter() {
  const { data, logs, addLog, setData } = useApp();
  const user = useAuthenticatedUser();
  const [activeTab, setActiveTab] = useState<'data' | 'logs'>('data');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EsgData>>({});
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => {
    const parentIds = new Set(data.filter(d => d.parentId).map(d => d.parentId!));
    return parentIds;
  });

  // Sort & filter state
  const [sortField,    setSortField]    = useState<SortField | null>(null);
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');
  const [filters,      setFilters]      = useState<FilterMap>({ category: null, section: null, scope: null, department: null });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Year selector state
  const dataYears = useMemo(() => {
    const years = new Set<number>();
    data.forEach(d => Object.keys(d.yearlyValues).forEach(y => years.add(Number(y))));
    return years;
  }, [data]);
  const [manualYears, setManualYears] = useState<number[]>([]);
  const availableYears = useMemo(() =>
    [...new Set([...dataYears, ...manualYears])].sort(),
    [dataYears, manualYears]
  );
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [addingYear, setAddingYear] = useState(false);
  const [yearInput, setYearInput] = useState('');

  // Import wizard state
  const [importFile, setImportFile] = useState<File | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Search state
  type SearchField = 'id' | 'category' | 'section' | 'scope' | 'value' | 'unit' | 'department';
  const [searchField, setSearchField] = useState<SearchField>('id');
  const [searchQuery, setSearchQuery] = useState('');

  const hasActiveControls = sortField !== null || Object.values(filters).some(Boolean) || searchQuery.trim() !== '';

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else setSortField(null);
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const setFilter = (col: keyof FilterMap, value: string | null) => {
    setFilters(prev => ({ ...prev, [col]: value }));
    setOpenDropdown(null);
  };

  const resetControls = () => {
    setSortField(null);
    setSortDir('asc');
    setFilters({ category: null, section: null, scope: null, department: null });
    setSearchQuery('');
  };

  // Unique values for filter dropdowns (always derived from full data)
  const uniqueCategories  = [...new Set(data.map(d => d.category).filter(Boolean))] as string[];
  const uniqueScopes      = [...new Set(data.map(d => d.scope).filter(Boolean))]    as string[];
  const uniqueDepartments = [...new Set(data.map(d => d.department))] as string[];

  // Derive displayRows: filter → search → rebuild tree → sort → flatten
  const q = searchQuery.trim().toLowerCase();
  const filtered = data
    .filter(d => !filters.category   || d.category   === filters.category)
    .filter(d => !filters.section    || d.section     === filters.section)
    .filter(d => !filters.scope      || d.scope       === filters.scope)
    .filter(d => !filters.department || d.department  === filters.department)
    .filter(d => {
      if (!q) return true;
      const val = (() => {
        switch (searchField) {
          case 'id':         return d.id;
          case 'category':   return d.category ?? '';
          case 'section':    return d.section;
          case 'scope':      return d.scope ?? '';
          case 'value':      return String(d.yearlyValues[selectedYear] ?? '');
          case 'unit':       return d.unit;
          case 'department': return d.department;
        }
      })();
      return val.toLowerCase().includes(q);
    });

  const childrenOf = new Map<string, EsgData[]>();
  const topLevel: EsgData[] = [];
  for (const record of filtered) {
    if (record.parentId) {
      const siblings = childrenOf.get(record.parentId) ?? [];
      siblings.push(record);
      childrenOf.set(record.parentId, siblings);
    } else {
      topLevel.push(record);
    }
  }

  if (sortField) {
    const dir = sortDir === 'asc' ? 1 : -1;
    topLevel.sort((a, b) => {
      if (sortField === 'id') return dir * a.id.localeCompare(b.id);
      if (sortField === 'value') return dir * ((a.yearlyValues[selectedYear] ?? 0) - (b.yearlyValues[selectedYear] ?? 0));
      // lastModified
      const aTs = a.lastModifiedBy.length > 0 ? a.lastModifiedBy[a.lastModifiedBy.length - 1].timestamp : '';
      const bTs = b.lastModifiedBy.length > 0 ? b.lastModifiedBy[b.lastModifiedBy.length - 1].timestamp : '';
      if (!aTs && !bTs) return 0;
      if (!aTs) return 1;   // no history sorts last
      if (!bTs) return -1;
      return dir * aTs.localeCompare(bTs);
    });
  }

  const displayRows: EsgData[] = [];
  for (const record of topLevel) {
    displayRows.push(record);
    (childrenOf.get(record.id) ?? []).forEach(c => displayRows.push(c));
  }

  // ── Sort icon helper ──
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const sortIconClass = (field: SortField) =>
    `p-0.5 rounded hover:bg-gray-100 transition-colors ${sortField === field ? 'text-black' : 'text-gray-400 hover:text-gray-700'}`;

  const filterIconClass = (col: keyof FilterMap) =>
    `p-0.5 rounded hover:bg-gray-100 transition-colors ${filters[col] ? 'text-black' : 'text-gray-400 hover:text-gray-700'}`;

  // ── Filter dropdown helper ──
  const FilterDropdown = ({ col, options }: { col: keyof FilterMap; options: string[] }) => (
    openDropdown === col ? (
      <div className="absolute top-full left-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px]">
        <button
          onClick={() => setFilter(col, null)}
          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${!filters[col] ? 'font-semibold text-black' : 'text-gray-600'}`}
        >
          All
        </button>
        {options.map(v => (
          <button
            key={v}
            onClick={() => setFilter(col, v)}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${filters[col] === v ? 'font-semibold text-black' : 'text-gray-600'}`}
          >
            {v}
          </button>
        ))}
      </div>
    ) : null
  );

  // ── Modal helpers ──
  const viewingRecord = viewingId ? data.find(d => d.id === viewingId) ?? null : null;

  const closeModal = () => { setViewingId(null); setIsEditMode(false); setEditForm({}); };
  const openView   = (id: string) => { setViewingId(id); setIsEditMode(false); setEditForm({}); };
  const openEdit   = (record: EsgData) => { setEditForm({ ...record }); setIsEditMode(true); };
  const cancelEdit = () => { setIsEditMode(false); setEditForm({}); };

  const saveEdit = () => {
    if (!viewingId) return;
    const original = data.find(d => d.id === viewingId);
    if (!original) return;

    const newSection = editForm.section ?? original.section;
    const updated: EsgData = {
      id: editForm.id?.trim() || original.id,
      parentId: editForm.parentId || undefined,
      category: editForm.category?.trim() || undefined,
      section: newSection,
      scope: newSection === 'Environmental' ? (editForm.scope?.trim() || undefined) : undefined,
      yearlyValues: editForm.yearlyValues ?? original.yearlyValues,
      unit: editForm.unit?.trim() || original.unit,
      department: editForm.department?.trim() || original.department,
      lastModifiedBy: original.lastModifiedBy,
    };

    type TrackableField = keyof Omit<EsgData, 'lastModifiedBy' | 'yearlyValues'>;
    const trackable: TrackableField[] = ['id', 'parentId', 'category', 'section', 'scope', 'unit', 'department'];
    const ts = new Date().toISOString();
    const changes: EsgDataChange[] = [];

    trackable.forEach(field => {
      const oldVal = original[field];
      const newVal = updated[field];
      if (oldVal !== newVal) {
        changes.push({ userId: user.id, userName: user.name, timestamp: ts, year: selectedYear, field, oldValue: oldVal as string | number | undefined, newValue: newVal as string | number | undefined });
      }
    });

    // Track value change for the selected year
    const oldYearVal = original.yearlyValues[selectedYear];
    const newYearVal = updated.yearlyValues[selectedYear];
    if (oldYearVal !== newYearVal) {
      changes.push({ userId: user.id, userName: user.name, timestamp: ts, year: selectedYear, field: 'value', oldValue: oldYearVal, newValue: newYearVal });
    }

    updated.lastModifiedBy = changes.length > 0 ? [...original.lastModifiedBy, ...changes] : original.lastModifiedBy;
    setData(data.map(d => d.id === viewingId ? updated : d));
    if (changes.length > 0) addLog('Updated Record', `Updated ${changes.map(c => c.field).join(', ')} on "${updated.id}"`);
    if (updated.id !== viewingId) setViewingId(updated.id);
    setIsEditMode(false);
    setEditForm({});
  };

  useEffect(() => {
    if (!viewingId || !isEditMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return;
      saveEdit();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [viewingId, isEditMode, editForm]);

  const deleteRecord = (id: string) => {
    if (window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      setData(data.filter(d => d.id !== id).map(d => d.parentId === id ? { ...d, parentId: undefined } : d));
      addLog('Deleted Record', `Deleted record "${id}"`);
      closeModal();
    }
  };

  const toggleParent = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const exportData = data.map(({ lastModifiedBy, ...rest }) => ({ ...rest, lastModifiedBy: JSON.stringify(lastModifiedBy) }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ESG Data');
    XLSX.writeFile(wb, 'ESG_Data_Export.xlsx');
    addLog('Exported Data', `Exported ${data.length} records to Excel`);
  };

  const handleImportConfirm = (records: EsgData[], year: number) => {
    const importedIds = new Set(records.map(r => r.id));
    const importedMap = new Map(records.map(r => [r.id, r]));
    const newRecords = records.filter(r => !data.some(d => d.id === r.id));
    const updatedCount = records.length - newRecords.length;
    const finalData = [
      ...newRecords,
      ...data.map(d => importedIds.has(d.id) ? importedMap.get(d.id)! : d),
    ];
    setData(finalData);
    addLog('Imported Data', `Imported ${records.length} records for ${year} (${newRecords.length} new, ${updatedCount} updated)`);
    setImportFile(null);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleAddData = () => {
    const newId = `New-${Date.now()}`;
    const newEntry: EsgData = { id: newId, yearlyValues: { [selectedYear]: 0 }, unit: '', department: user.department, lastModifiedBy: [] };
    setData([newEntry, ...data]);
    addLog('Added Record', `Added new record "${newEntry.id}"`);
    setViewingId(newEntry.id);
    setEditForm({ ...newEntry });
    setIsEditMode(true);
  };

  return (
    <div className="px-8 pt-6 pb-0 h-full flex flex-col">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-bold">Data Center</h2>
        <div className="flex space-x-3">
          {user.role !== 'viewer' && (
            <>
              <button
                onClick={() => importFileRef.current?.click()}
                className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium border border-gray-200 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                <span>Import</span>
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const validMime = [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                  ];
                  if (!validMime.includes(file.type) && !/\.(xlsx|xls)$/i.test(file.name)) {
                    alert('Please select a valid Excel file (.xlsx or .xls).');
                    e.target.value = '';
                    return;
                  }
                  setImportFile(file);
                }}
              />
            </>
          )}
          <button onClick={handleExport} className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium border border-gray-200 hover:bg-gray-50">
            <Upload className="w-4 h-4" />
            <span>Export</span>
          </button>
          {user.role !== 'viewer' && (
            <button onClick={handleAddData} className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-800">
              <Plus className="w-4 h-4" />
              <span>Add Record</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs + Reset */}
      <div className="flex items-center justify-between mb-0 border-b border-gray-200">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('data')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'data' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Master Sheet
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${activeTab === 'logs' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <History className="w-4 h-4" />
            <span>Modification Logs</span>
          </button>
        </div>
        {activeTab === 'data' && hasActiveControls && (
          <button
            onClick={resetControls}
            className="flex items-center gap-1.5 pb-2 text-xs font-medium text-gray-500 hover:text-black transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Search bar — Master Sheet only */}
      {activeTab === 'data' && (
        <div className="flex items-center gap-0 mt-3 mb-1">
          <select
            value={searchField}
            onChange={e => setSearchField(e.target.value as SearchField)}
            className="h-8 border border-r-0 border-gray-200 rounded-l-lg bg-gray-50 px-2 text-xs font-medium text-gray-600 focus:outline-none focus:ring-1 focus:ring-black/10 cursor-pointer"
          >
            <option value="id">ID</option>
            <option value="category">Category</option>
            <option value="section">Section</option>
            <option value="scope">Scope</option>
            <option value="value">Value</option>
            <option value="unit">Unit</option>
            <option value="department">Department</option>
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search by ${searchField}…`}
              className="h-8 w-full border border-gray-200 rounded-r-lg pl-7 pr-7 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black/10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Year selector — Master Sheet only */}
      {activeTab === 'data' && (
        <div className="flex items-center gap-1.5 mt-2 mb-1">
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedYear === year
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {year}
            </button>
          ))}
          {addingYear ? (
            <input
              autoFocus
              type="number"
              value={yearInput}
              onChange={e => setYearInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const y = Number(yearInput);
                  if (y > 1900 && y < 2200 && !availableYears.includes(y)) {
                    setManualYears(prev => [...prev, y]);
                    setSelectedYear(y);
                  } else if (availableYears.includes(y)) {
                    setSelectedYear(y);
                  }
                  setAddingYear(false);
                  setYearInput('');
                } else if (e.key === 'Escape') {
                  setAddingYear(false);
                  setYearInput('');
                }
              }}
              onBlur={() => { setAddingYear(false); setYearInput(''); }}
              placeholder="YYYY"
              className="w-16 h-6 px-2 rounded-full text-xs font-medium border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black/20 text-center"
            />
          ) : (
            <button
              onClick={() => setAddingYear(true)}
              className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-sm font-medium flex items-center justify-center transition-colors"
              title="Add year"
            >
              +
            </button>
          )}
        </div>
      )}

      {/* Table container */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {activeTab === 'data' ? (
          <div className="overflow-auto flex-1">
            {/* Backdrop to close filter dropdowns */}
            {openDropdown && (
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
            )}

            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-gray-200 z-10 bg-white">
                <tr>
                  {/* ID — sort */}
                  <th className="px-4 py-2 font-medium text-gray-400 whitespace-nowrap text-xs relative">
                    <div className="flex items-center gap-1">
                      <span>ID (Name)</span>
                      <button onClick={() => toggleSort('id')} className={sortIconClass('id')}>
                        <SortIcon field="id" />
                      </button>
                    </div>
                  </th>
                  {/* Category — filter */}
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs relative">
                    <div className="flex items-center gap-1">
                      <span>Category</span>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === 'category' ? null : 'category'); }}
                        className={filterIconClass('category')}
                      >
                        <ListFilter className="w-3 h-3" />
                      </button>
                    </div>
                    <FilterDropdown col="category" options={uniqueCategories} />
                  </th>
                  {/* Section — filter */}
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs relative">
                    <div className="flex items-center gap-1">
                      <span>Section</span>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === 'section' ? null : 'section'); }}
                        className={filterIconClass('section')}
                      >
                        <ListFilter className="w-3 h-3" />
                      </button>
                    </div>
                    <FilterDropdown col="section" options={[...SECTIONS]} />
                  </th>
                  {/* Scope — filter */}
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs relative">
                    <div className="flex items-center gap-1">
                      <span>Scope</span>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === 'scope' ? null : 'scope'); }}
                        className={filterIconClass('scope')}
                      >
                        <ListFilter className="w-3 h-3" />
                      </button>
                    </div>
                    <FilterDropdown col="scope" options={uniqueScopes} />
                  </th>
                  {/* Value — sort */}
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs relative">
                    <div className="flex items-center gap-1">
                      <span>Value</span>
                      <button onClick={() => toggleSort('value')} className={sortIconClass('value')}>
                        <SortIcon field="value" />
                      </button>
                    </div>
                  </th>
                  {/* Unit — no control */}
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs">Unit</th>
                  {/* Department — filter */}
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs relative">
                    <div className="flex items-center gap-1">
                      <span>Department</span>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === 'department' ? null : 'department'); }}
                        className={filterIconClass('department')}
                      >
                        <ListFilter className="w-3 h-3" />
                      </button>
                    </div>
                    <FilterDropdown col="department" options={uniqueDepartments} />
                  </th>
                  {/* Last Modified — sort */}
                  <th className="px-4 py-2 font-medium text-gray-400 whitespace-nowrap text-xs relative">
                    <div className="flex items-center gap-1">
                      <span>Last Modified</span>
                      <button onClick={() => toggleSort('lastModified')} className={sortIconClass('lastModified')}>
                        <SortIcon field="lastModified" />
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayRows.map((row) => {
                  if (row.parentId && !expandedParents.has(row.parentId)) return null;

                  const lastChange = row.lastModifiedBy[row.lastModifiedBy.length - 1];
                  return (
                    <tr
                      key={row.id}
                      onClick={() => openView(row.id)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2 font-medium">
                        {childrenOf.has(row.id) ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); toggleParent(row.id); }}
                              className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 text-xs"
                              aria-label={expandedParents.has(row.id) ? 'Collapse' : 'Expand'}
                            >
                              {expandedParents.has(row.id) ? '▼' : '▶'}
                            </button>
                            <span>{row.id}</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-normal">
                              {childrenOf.get(row.id)!.length}
                            </span>
                          </div>
                        ) : row.parentId ? (
                          <div className="pl-6 flex items-center gap-1.5">
                            <span className="text-gray-300 text-xs">↳</span>
                            <span>{row.id}</span>
                          </div>
                        ) : (
                          row.id
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {row.category ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        {row.section
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSectionStyle(row.section)}`}>{row.section}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {row.scope ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        {row.yearlyValues[selectedYear] != null
                          ? row.yearlyValues[selectedYear].toLocaleString()
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-2 text-gray-500">{row.unit}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {row.department}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {lastChange ? (
                          <div className="text-xs leading-tight">
                            <span className="font-medium text-gray-600">{lastChange.userName}</span>
                            <span className="text-gray-400"> · {new Date(lastChange.timestamp).toLocaleDateString()}</span>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        ) : (
          /* ── Modification Logs tab ── */
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-gray-200 z-10 bg-white">
                <tr>
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs">Timestamp</th>
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs">User</th>
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs">Action</th>
                  <th className="px-4 py-2 font-medium text-gray-400 text-xs">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-medium">{log.userName}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.action === 'Deleted Record' ? 'bg-red-50 text-red-700' :
                        log.action === 'Added Record'   ? 'bg-emerald-50 text-emerald-700' :
                        log.action === 'Updated Record' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ── Detail / Edit Modal ── */}
      {viewingRecord && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                {isEditMode ? (
                  <span className="text-sm text-gray-500 font-medium">Editing record</span>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900">{viewingRecord.id}</h3>
                    {viewingRecord.section && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSectionStyle(viewingRecord.section)}`}>
                        {viewingRecord.section}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button onClick={closeModal} className="ml-4 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

              {isEditMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Name (ID)</label>
                    <input type="text" className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/10" value={editForm.id || ''} onChange={e => setEditForm({ ...editForm, id: e.target.value })} placeholder="Record name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Parent</label>
                    <select className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/10" value={editForm.parentId || ''} onChange={e => setEditForm({ ...editForm, parentId: e.target.value || undefined })}>
                      <option value="">No parent (top-level)</option>
                      {data.filter(d => !d.parentId && d.id !== viewingId).map(d => (
                        <option key={d.id} value={d.id}>{d.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                    <input type="text" className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/10" value={editForm.category || ''} onChange={e => setEditForm({ ...editForm, category: e.target.value })} placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Section</label>
                    <select className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/10" value={editForm.section || 'Environmental'} onChange={e => setEditForm({ ...editForm, section: e.target.value as EsgData['section'], scope: e.target.value !== 'Environmental' ? undefined : editForm.scope })}>
                      {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Scope</label>
                    <input type="text" className={`border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/10 ${editForm.section !== 'Environmental' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`} value={editForm.section !== 'Environmental' ? '' : (editForm.scope || '')} onChange={e => setEditForm({ ...editForm, scope: e.target.value })} disabled={editForm.section !== 'Environmental'} placeholder={editForm.section !== 'Environmental' ? 'N/A' : 'e.g. Scope 1'} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Value ({selectedYear})</label>
                      <input type="number" className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/10" value={editForm.yearlyValues?.[selectedYear] ?? 0} onChange={e => setEditForm({ ...editForm, yearlyValues: { ...(editForm.yearlyValues ?? {}), [selectedYear]: Number(e.target.value) } })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                      <input type="text" className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/10" value={editForm.unit || ''} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                    <input type="text" className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/10" value={editForm.department || ''} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Category</p>
                    <p className="text-sm text-gray-800 mt-0.5">{viewingRecord.category || <span className="text-gray-300">—</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Section</p>
                    {viewingRecord.section
                      ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 ${getSectionStyle(viewingRecord.section)}`}>{viewingRecord.section}</span>
                      : <p className="text-sm text-gray-300 mt-0.5">—</p>
                    }
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Scope</p>
                    <p className="text-sm text-gray-800 mt-0.5">{viewingRecord.scope || <span className="text-gray-300">—</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Department</p>
                    <p className="text-sm text-gray-800 mt-0.5">{viewingRecord.department}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Value ({selectedYear})</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {viewingRecord.yearlyValues[selectedYear] != null
                        ? viewingRecord.yearlyValues[selectedYear].toLocaleString()
                        : <span className="text-gray-300">—</span>
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Unit</p>
                    <p className="text-sm text-gray-800 mt-0.5">{viewingRecord.unit || <span className="text-gray-300">—</span>}</p>
                  </div>
                  {viewingRecord.parentId && (
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Parent</p>
                      <p className="text-sm text-gray-800 mt-0.5">{viewingRecord.parentId}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Modification History Timeline */}
              <div>
                <div className="flex items-center gap-2 mb-3 mt-2">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Edits in {selectedYear}</span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                {(() => {
                  const yearHistory = viewingRecord.lastModifiedBy.filter(c => c.year === selectedYear);
                  return yearHistory.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">No edits recorded for {selectedYear}.</p>
                  ) : (
                    <div className="relative pl-4 space-y-3">
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                      {[...yearHistory].reverse().map((change, idx) => (
                        <div key={idx} className="relative flex gap-3">
                          <div className={`absolute -left-4 mt-1 w-3 h-3 rounded-full border-2 border-white ${getSectionDot(viewingRecord.section)} flex-shrink-0`} />
                          <div className="bg-gray-50 rounded-lg p-3 text-xs w-full border border-gray-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-700">{change.userName}</span>
                              <span className="text-gray-400">{new Date(change.timestamp).toLocaleString()}</span>
                            </div>
                            {change.field === 'created' ? (
                              <p className="text-gray-500">Record {change.newValue === 'imported' ? 'imported' : 'created'}</p>
                            ) : (
                              <p className="text-gray-500">
                                <span className="font-medium text-gray-600">{change.field}</span>
                                {change.oldValue !== undefined && (
                                  <> <span className="line-through text-gray-400">{String(change.oldValue)}</span> → </>
                                )}
                                <span className="text-gray-800">{change.newValue !== undefined ? String(change.newValue) : '—'}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0">
              {isEditMode ? (
                <>
                  <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={saveEdit} className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors">
                    Save
                  </button>
                </>
              ) : (
                <>
                  {user.role === 'admin' ? (
                    <button onClick={() => deleteRecord(viewingRecord.id)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  ) : (
                    <span />
                  )}
                  {user.role !== 'viewer' && (
                    <button onClick={() => openEdit(viewingRecord)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Wizard */}
      {importFile && (
        <ImportWizard
          file={importFile}
          existingData={data}
          existingYears={availableYears}
          user={user}
          onConfirm={handleImportConfirm}
          onClose={() => {
            setImportFile(null);
            if (importFileRef.current) importFileRef.current.value = '';
          }}
        />
      )}

    </div>
  );
}
