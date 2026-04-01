import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

export type Theme = {
  customColors?: { primary: string };
  font: string;
};

export type User = {
  id: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  department: 'Sustainability' | 'R&D' | 'Factory' | 'HR';
};

// A single field-level change recorded on a data point
export type EsgDataChange = {
  userId: string;
  userName: string;
  timestamp: string;
  year: number;               // which data year this edit applies to
  field: string;              // which field changed (e.g. 'value', 'unit', 'scope', 'created')
  oldValue?: string | number;
  newValue?: string | number;
};

export type EsgData = {
  id: string;                                          // unique identifier, also serves as the human-readable name
  parentId?: string;                                   // optional: points to another EsgData.id (one level deep only)
  category?: string;                                   // optional, user-customizable grouping label
  section?: 'Environmental' | 'Social' | 'Governance';
  scope?: string;                                      // only meaningful when section === 'Environmental'
  yearlyValues: Record<number, number>;                // measured value per year, e.g. { 2020: 38, 2021: 43 }
  unit: string;
  department: string;
  lastModifiedBy: EsgDataChange[];                     // real user edits only, scoped by year
};

export type Log = {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
};

export type Requirement = {
  id: string;
  name: string;
  completed: boolean;
};

export type Framework = {
  id: string;
  name: string;
  region: string;
  progress: number;
  status: 'on-track' | 'at-risk' | 'completed';
  description: string;
  requirements: Requirement[];
};

export type ChartType =
  | 'bar' | 'stacked-bar'
  | 'line' | 'area'
  | 'pie' | 'donut'
  | 'scatter' | 'radar'
  | 'funnel' | 'gauge'
  | 'heatmap' | 'sankey';

export type SeriesOverride = {
  label?: string;   // display name (default: dataId)
  color?: string;   // hex color (default: COLORS[index])
  unit?: string;    // unit label (default: data.unit from EsgData)
};

export type CustomPanelConfig = {
  id: string;
  title?: string;
  dataIds: string[];
  chartType: ChartType;
  yearStart: number;
  yearEnd: number;
  seriesOverrides?: Record<string, SeriesOverride>;
};

type AppState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  user: User | null;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
  data: EsgData[];
  setData: (data: EsgData[]) => void;
  logs: Log[];
  addLog: (action: string, details: string) => void;
  dashboardLayout: any[];
  setDashboardLayout: (layout: any[]) => void;
  dashboardPanels: string[];
  setDashboardPanels: (panels: string[]) => void;
  frameworks: Framework[];
  setFrameworks: (frameworks: Framework[]) => void;
  customPanelConfigs: Record<string, CustomPanelConfig>;
  addCustomPanel: (config: CustomPanelConfig) => void;
  removeCustomPanel: (id: string) => void;
  updateCustomPanel: (config: CustomPanelConfig) => void;
  loading: boolean;
};

const initialData: EsgData[] = [
  {
    id: "Tax",
    category: "Business Activities",
    yearlyValues: { 2020: 38.0, 2021: 43.0, 2022: 49.0, 2023: 49.0, 2024: 37.0 },
    unit: "RMB million",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Vehicles produced",
    category: "Business Activities",
    yearlyValues: { 2020: 602936.0, 2021: 700787.0, 2022: 674663.0, 2023: 728562.0, 2024: 628018.0 },
    unit: "unit",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Automobiles retailed deliveries",
    category: "Business Activities",
    yearlyValues: { 2022: 651236.0, 2023: 705163.0, 2024: 610153.0 },
    unit: "unit",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Authorised dealer outlets nationwide",
    category: "Business Activities",
    yearlyValues: { 2020: 666.0, 2021: 683.0, 2022: 707.0, 2023: 744.0, 2024: 698.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Average fleet CO₂ emissions (domestic)",
    category: "Products and Mobility Solutions",
    yearlyValues: { 2020: 142.1, 2021: 152.8, 2022: 144.1, 2023: 142.9, 2024: 140.1 },
    unit: "g/km",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Corporate average fuel consumption (domestic)",
    category: "Products and Mobility Solutions",
    yearlyValues: { 2020: 5.97, 2021: 6.42, 2022: 6.08, 2023: 6.03, 2024: 5.91 },
    unit: "l/100 km",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Retail New Energy Vehicles deliveries",
    category: "Products and Mobility Solutions",
    yearlyValues: { 2021: 47322.0, 2023: 93556.0, 2024: 94173.0 },
    unit: "unit",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "High-voltage batteries recycled (in pieces)",
    category: "Products and Mobility Solutions",
    yearlyValues: { 2020: 4347.0, 2021: 6173.0, 2022: 10153.0, 2023: 41759.0, 2024: 107467.0 },
    unit: "pieces",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "High-voltage batteries recycled (in kg)",
    category: "Products and Mobility Solutions",
    yearlyValues: { 2020: 98261.0, 2021: 123111.0, 2022: 579231.0, 2023: 1020470.0, 2024: 2387650.0 },
    unit: "kg",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Parts collected for qualified remanufacture",
    category: "Products and Mobility Solutions",
    yearlyValues: { 2022: 42237.0, 2023: 49696.0, 2024: 56517.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Weight of parts collected for qualified remanufacture",
    category: "Products and Mobility Solutions",
    yearlyValues: { 2022: 274.0, 2023: 246.0, 2024: 283.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Public charging pillar connected in China",
    category: "Products and Mobility Solutions",
    yearlyValues: { 2020: 306891.0, 2021: 365713.0, 2022: 470534.0, 2023: 588550.0, 2024: 766263.0 },
    unit: "unit",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Charging with renewable sources",
    category: "Products and Mobility Solutions",
    yearlyValues: { 2022: 26948.0, 2023: 89708.0, 2024: 97877.0 },
    unit: "kWh",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "CO₂e emissions per vehicle produced",
    category: "Production and Operation",
    yearlyValues: { 2020: 0.19, 2021: 0.17, 2022: 0.19, 2023: 0.18, 2024: 0.21 },
    unit: "t CO₂e/vehicle",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 1 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 43614.0, 2021: 50937.0, 2022: 54306.0, 2023: 57309.0, 2024: 52783.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 1 – BMW Brilliance locations",
    parentId: "Scope 1 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 43614.0, 2021: 50937.0, 2022: 54306.0, 2023: 53044.0, 2024: 43159.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 1 – Company vehicles",
    parentId: "Scope 1 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2023: 4265.0, 2024: 3409.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 1 – 3rd party, construction",
    parentId: "Scope 1 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2024: 1364.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 1 – Destroyed VOCs",
    parentId: "Scope 1 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2024: 4851.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 2 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 71275.0, 2021: 71604.0, 2022: 76121.0, 2023: 80662.0, 2024: 87639.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 2 – Electricity / heat purchased",
    parentId: "Scope 2 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 71275.0, 2021: 71604.0, 2022: 76121.0, 2023: 80662.0, 2024: 74120.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 2 – Company vehicles",
    parentId: "Scope 2 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2024: 1377.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 2 – 3rd party, construction",
    parentId: "Scope 2 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2024: 12141.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 3 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 23998281.0, 2021: 29079393.0, 2022: 32430178.0, 2023: 34642342.0, 2024: 35731546.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 3 – Purchased goods and services",
    parentId: "Scope 3 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 10711299.0, 2021: 12881245.0, 2022: 12973070.0, 2023: 13774060.0, 2024: 10446256.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 3 – Logistics",
    parentId: "Scope 3 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 175113.0, 2021: 310772.0, 2022: 519304.0, 2023: 619572.0, 2024: 575665.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 3 – Utilisation phase",
    parentId: "Scope 3 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 12799547.0, 2021: 15521957.0, 2022: 18562014.0, 2023: 19818887.0, 2024: 24260962.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 3 – Disposal",
    parentId: "Scope 3 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 300866.0, 2021: 352059.0, 2022: 361245.0, 2023: 411124.0, 2024: 412414.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 3 – Business trips",
    parentId: "Scope 3 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 2105.0, 2021: 2606.0, 2022: 2560.0, 2023: 6438.0, 2024: 6939.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Scope 3 – Employees commuting",
    parentId: "Scope 3 Greenhouse gas emissions",
    category: "Production and Operation",
    yearlyValues: { 2020: 9351.0, 2021: 10754.0, 2022: 11985.0, 2023: 12261.0, 2024: 29311.0 },
    unit: "t CO₂e",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Share of renewable electricity",
    category: "Production and Operation",
    yearlyValues: { 2020: 100.0, 2021: 100.0, 2022: 100.0, 2023: 100.0, 2024: 100.0 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total energy consumption",
    category: "Production and Operation",
    yearlyValues: { 2020: 1026890.0, 2021: 1106295.0, 2022: 1169425.0, 2023: 1245906.0, 2024: 1144072.0 },
    unit: "MWh",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total fuel consumption from non-renewable resources (natural gas)",
    parentId: "Total energy consumption",
    category: "Production and Operation",
    yearlyValues: { 2020: 238834.0, 2021: 295209.0, 2022: 297727.0, 2023: 298231.0, 2024: 239606.0 },
    unit: "MWh",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total electricity consumption",
    parentId: "Total energy consumption",
    category: "Production and Operation",
    yearlyValues: { 2020: 590214.0, 2021: 590662.0, 2022: 625039.0, 2023: 664759.0, 2024: 633218.0 },
    unit: "MWh",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total heating consumption",
    parentId: "Total energy consumption",
    category: "Production and Operation",
    yearlyValues: { 2020: 197842.0, 2021: 220424.0, 2022: 246659.0, 2023: 282916.0, 2024: 271247.0 },
    unit: "MWh",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Energy consumption per vehicle produced",
    category: "Production and Operation",
    yearlyValues: { 2020: 1.51, 2021: 1.4, 2022: 1.6, 2023: 1.58, 2024: 1.63 },
    unit: "MWh/vehicle",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total water consumption",
    category: "Production and Operation",
    yearlyValues: { 2020: 1188228.0, 2021: 1275998.0, 2022: 1191954.0, 2023: 1255579.0, 2024: 988743.0 },
    unit: "m³",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Potable water consumption per vehicle produced",
    category: "Production and Operation",
    yearlyValues: { 2020: 1.97, 2021: 1.82, 2022: 1.77, 2023: 1.72, 2024: 1.57 },
    unit: "m³/vehicle",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total waste",
    category: "Production and Operation",
    yearlyValues: { 2020: 181791.0, 2021: 210691.0, 2022: 208564.0, 2023: 231484.0, 2024: 197649.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total waste for recycling",
    parentId: "Total waste",
    category: "Production and Operation",
    yearlyValues: { 2020: 179987.0, 2021: 208940.0, 2022: 207214.0, 2023: 230235.0, 2024: 197649.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total waste for disposal",
    parentId: "Total waste",
    category: "Production and Operation",
    yearlyValues: { 2020: 1804.0, 2021: 1751.0, 2022: 1350.0, 2023: 1249.0, 2024: 0.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Waste for disposal per vehicle produced",
    category: "Production and Operation",
    yearlyValues: { 2020: 2.99, 2021: 2.5, 2022: 2.0, 2023: 1.72, 2024: 0.0 },
    unit: "kg/vehicle",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total non-hazardous waste",
    category: "Production and Operation",
    yearlyValues: { 2020: 172349.0, 2021: 200283.0, 2022: 198662.0, 2023: 221245.0, 2024: 189822.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total non-hazardous waste for recycling",
    parentId: "Total non-hazardous waste",
    category: "Production and Operation",
    yearlyValues: { 2020: 172007.0, 2021: 200068.0, 2022: 198474.0, 2023: 221245.0, 2024: 189822.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total non-hazardous waste for disposal",
    parentId: "Total non-hazardous waste",
    category: "Production and Operation",
    yearlyValues: { 2020: 342.0, 2021: 215.0, 2022: 188.0, 2023: 0.0, 2024: 0.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total hazardous waste",
    category: "Production and Operation",
    yearlyValues: { 2020: 9442.0, 2021: 10408.0, 2022: 9902.0, 2023: 10239.0, 2024: 7827.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total hazardous waste for recycling",
    parentId: "Total hazardous waste",
    category: "Production and Operation",
    yearlyValues: { 2020: 7980.0, 2021: 8872.0, 2022: 8740.0, 2023: 8990.0, 2024: 7827.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total hazardous waste for disposal",
    parentId: "Total hazardous waste",
    category: "Production and Operation",
    yearlyValues: { 2020: 1462.0, 2021: 1536.0, 2022: 1162.0, 2023: 1249.0, 2024: 0.0 },
    unit: "t",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Local content suppliers in China",
    category: "Retail Partner and Supply Chain",
    yearlyValues: { 2020: 400.0, 2021: 436.0, 2022: 429.0, 2023: 455.0, 2024: 462.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Purchasing volume in China",
    category: "Retail Partner and Supply Chain",
    yearlyValues: { 2020: 54.89, 2021: 71.39, 2022: 73.47, 2023: 86.53, 2024: 85.09 },
    unit: "RMB billion",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Certificated BMW NT Green Star dealers",
    category: "Retail Partner and Supply Chain",
    yearlyValues: { 2023: 251.0, 2024: 364.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total workforce at year-end",
    category: "Employee and Society",
    yearlyValues: { 2020: 20739.0, 2021: 22829.0, 2022: 25802.0, 2023: 25856.0, 2024: 25077.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Female employees in total workforce (number)",
    category: "Employee and Society",
    yearlyValues: { 2020: 2465.0, 2021: 2725.0, 2022: 2931.0, 2023: 3119.0, 2024: 3147.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Female employees in total workforce (in %)",
    category: "Employee and Society",
    yearlyValues: { 2020: 11.9, 2021: 11.9, 2022: 11.4, 2023: 12.1, 2024: 12.5 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Male employees in total workforce (number)",
    category: "Employee and Society",
    yearlyValues: { 2020: 18274.0, 2021: 20104.0, 2022: 22871.0, 2023: 22737.0, 2024: 21930.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Male employees in total workforce (in %)",
    category: "Employee and Society",
    yearlyValues: { 2020: 88.1, 2021: 88.1, 2022: 88.6, 2023: 87.9, 2024: 87.0 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees, age <30 (number)",
    category: "Employee and Society",
    yearlyValues: { 2020: 6893.0, 2021: 7099.0, 2022: 7881.0, 2023: 6811.0, 2024: 5367.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees, age <30 (in %)",
    category: "Employee and Society",
    yearlyValues: { 2020: 33.2, 2021: 31.1, 2022: 30.5, 2023: 26.3, 2024: 21.4 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees, age 30-50 (number)",
    category: "Employee and Society",
    yearlyValues: { 2020: 13675.0, 2021: 15515.0, 2022: 17670.0, 2023: 18741.0, 2024: 19332.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees, age 30-50 (in %)",
    category: "Employee and Society",
    yearlyValues: { 2020: 65.9, 2021: 68.0, 2022: 68.5, 2023: 72.5, 2024: 77.1 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees, age >50 (number)",
    category: "Employee and Society",
    yearlyValues: { 2020: 171.0, 2021: 215.0, 2022: 251.0, 2023: 304.0, 2024: 378.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees, age >50 (in %)",
    category: "Employee and Society",
    yearlyValues: { 2020: 0.8, 2021: 0.9, 2022: 1.0, 2023: 1.2, 2024: 1.5 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees in Shenyang (number)",
    category: "Employee and Society",
    yearlyValues: { 2020: 19963.0, 2021: 21563.0, 2022: 24174.0, 2023: 24027.0, 2024: 23190.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees in Shenyang (in %)",
    category: "Employee and Society",
    yearlyValues: { 2020: 96.3, 2021: 94.5, 2022: 93.7, 2023: 92.9, 2024: 92.5 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees in Beijing (number)",
    category: "Employee and Society",
    yearlyValues: { 2020: 776.0, 2021: 1266.0, 2022: 990.0, 2023: 1073.0, 2024: 1068.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees in Beijing (in %)",
    category: "Employee and Society",
    yearlyValues: { 2020: 3.7, 2021: 5.5, 2022: 3.8, 2023: 4.1, 2024: 4.3 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees in Shanghai (number)",
    category: "Employee and Society",
    yearlyValues: { 2022: 103.0, 2023: 96.0, 2024: 97.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees in Shanghai (in %)",
    category: "Employee and Society",
    yearlyValues: { 2022: 0.4, 2023: 0.4, 2024: 0.4 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees in other cities (number)",
    category: "Employee and Society",
    yearlyValues: { 2022: 535.0, 2023: 660.0, 2024: 722.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Employees in other cities (in %)",
    category: "Employee and Society",
    yearlyValues: { 2022: 2.1, 2023: 2.6, 2024: 2.9 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Female employees in management positions",
    category: "Employee and Society",
    yearlyValues: { 2020: 30.2, 2021: 31.4, 2022: 31.8, 2023: 33.2, 2024: 33.3 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Local employees in management positions",
    category: "Employee and Society",
    yearlyValues: { 2020: 87.2, 2021: 90.0, 2022: 91.7, 2023: 91.7, 2024: 91.3 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Share of employees with fixed-term contract",
    category: "Employee and Society",
    yearlyValues: { 2020: 41.0, 2021: 41.4, 2022: 48.8, 2023: 46.7, 2024: 37.3 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total local new employee hires",
    category: "Employee and Society",
    yearlyValues: { 2020: 8.2, 2021: 15.4, 2022: 18.3, 2023: 4.2, 2024: 1.9 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Local voluntary attrition rate",
    category: "Employee and Society",
    yearlyValues: { 2020: 2.9, 2021: 6.5, 2022: 6.0, 2023: 2.9, 2024: 1.8 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Accident frequency rate (per one million hours worked)",
    category: "Employee and Society",
    yearlyValues: { 2020: 0.09, 2021: 0.13, 2022: 0.08, 2023: 0.06, 2024: 0.04 },
    unit: "—",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Training days organised by the Academy of HR Department",
    category: "Employee and Society",
    yearlyValues: { 2020: 15491.0, 2021: 19524.0, 2022: 25844.0, 2023: 36730.0, 2024: 39012.0 },
    unit: "day",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Average training days per employee",
    category: "Employee and Society",
    yearlyValues: { 2020: 0.75, 2021: 0.86, 2022: 1.0, 2023: 1.42, 2024: 1.56 },
    unit: "day/person",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Training attendee satisfaction rate",
    category: "Employee and Society",
    yearlyValues: { 2020: 98.4, 2021: 99.0, 2022: 99.8, 2023: 99.0, 2024: 99.2 },
    unit: "%",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Beneficiaries of BMW CSR activities",
    category: "Employee and Society",
    yearlyValues: { 2020: 11568364.0, 2021: 11459458.0, 2022: 31885474.0, 2023: 35542888.0, 2024: 21997919.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Accumulated beneficiaries of BMW CSR activities",
    category: "Employee and Society",
    yearlyValues: { 2020: 14434966.0, 2021: 25894424.0, 2022: 57779898.0, 2023: 93322786.0, 2024: 115320705.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Expenditure on social commitment activities",
    category: "Employee and Society",
    yearlyValues: { 2020: 36619722.0, 2021: 23439759.0, 2022: 24210755.0, 2023: 15963774.0, 2024: 10199572.0 },
    unit: "RMB",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total participants of CSR activities",
    category: "Employee and Society",
    yearlyValues: { 2020: 85.0, 2021: 300.0, 2022: 616.0, 2023: 711.0, 2024: 1016.0 },
    unit: "number",
    department: "",
    lastModifiedBy: [],
  },
  {
    id: "Total hours of volunteer service",
    category: "Employee and Society",
    yearlyValues: { 2020: 923.0, 2021: 1914.0, 2022: 1916.0, 2023: 5085.0, 2024: 5979.0 },
    unit: "hour",
    department: "",
    lastModifiedBy: [],
  }
];

const initialLogs: Log[] = [];


const AppContext = createContext<AppState | undefined>(undefined);

const initialLayout = [
  { i: 'emissions', x: 0, y: 0, w: 6, h: 4 },
  { i: 'energy', x: 6, y: 0, w: 6, h: 4 },
  { i: 'diversity', x: 0, y: 4, w: 6, h: 4 },
  { i: 'summary', x: 6, y: 4, w: 6, h: 4 },
];

const initialFrameworks: Framework[] = [];

const PUT_JSON = (url: string, body: unknown) =>
  fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>({ font: 'Inter' });
  const [user, setUserState] = useState<User | null>(null);
  const [data, setDataState] = useState<EsgData[]>([]);
  const [logs, setLogsState] = useState<Log[]>([]);
  const [dashboardLayout, setDashboardLayoutState] = useState<any[]>(initialLayout);
  const [dashboardPanels, setDashboardPanelsState] = useState<string[]>(['emissions', 'energy', 'diversity', 'summary']);
  const [customPanelConfigs, setCustomPanelConfigsState] = useState<Record<string, CustomPanelConfig>>({});
  const [loading, setLoading] = useState(true);

  // frameworks are NOT persisted — always loaded from app code so version updates deliver new frameworks automatically
  const [frameworks, setFrameworks] = useState<Framework[]>(initialFrameworks);

  // Refs so savePrefs always reads latest values without stale closures
  const layoutRef = useRef(dashboardLayout);
  const panelsRef = useRef(dashboardPanels);
  const configsRef = useRef(customPanelConfigs);
  useEffect(() => { layoutRef.current = dashboardLayout; }, [dashboardLayout]);
  useEffect(() => { panelsRef.current = dashboardPanels; }, [dashboardPanels]);
  useEffect(() => { configsRef.current = customPanelConfigs; }, [customPanelConfigs]);

  // Check session on mount; if logged in, load all app data
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(me => {
        if (!me) { setLoading(false); return; }
        setUserState(me);
        return Promise.all([
          fetch('/api/theme').then(r => r.json()),
          fetch('/api/data').then(r => r.json()),
          fetch('/api/logs').then(r => r.json()),
        ]).then(([t, d, l]) => {
          setThemeState(t);
          if (d.length === 0) {
            setDataState(initialData);
            PUT_JSON('/api/data', initialData);
          } else {
            setDataState(d);
          }
          setLogsState(l);
          setLoading(false);
        });
      });
  }, []);

  // Reload user-scoped prefs whenever active user changes
  useEffect(() => {
    if (!user) return;
    fetch(`/api/prefs/${user.id}`)
      .then(r => r.json())
      .then(p => {
        setDashboardLayoutState(p.dashboardLayout);
        setDashboardPanelsState(p.dashboardPanels);
        setCustomPanelConfigsState(p.customPanelConfigs);
      });
  }, [user?.id]);

  function savePrefs(layout: any[], panels: string[], configs: Record<string, CustomPanelConfig>) {
    if (!user) return;
    PUT_JSON(`/api/prefs/${user.id}`, { dashboardLayout: layout, dashboardPanels: panels, customPanelConfigs: configs });
  }

  const setTheme = (t: Theme) => {
    setThemeState(t);
    PUT_JSON('/api/theme', t);
  };

  const login = async (username: string, password: string): Promise<string | null> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json();
      return body.error || 'Login failed';
    }
    const me = await res.json();
    setUserState(me);
    const [t, d, l] = await Promise.all([
      fetch('/api/theme').then(r => r.json()),
      fetch('/api/data').then(r => r.json()),
      fetch('/api/logs').then(r => r.json()),
    ]);
    setThemeState(t);
    if (d.length === 0) { setDataState(initialData); PUT_JSON('/api/data', initialData); }
    else setDataState(d);
    setLogsState(l);
    return null;
  };

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => {
      setUserState(null);
      setDataState([]);
      setLogsState([]);
      setThemeState({ font: 'Inter' });
      setDashboardLayoutState(initialLayout);
      setDashboardPanelsState(['emissions', 'energy', 'diversity', 'summary']);
      setCustomPanelConfigsState({});
    });
  };

  const setData = (d: EsgData[]) => {
    setDataState(d);
    PUT_JSON('/api/data', d);
  };

  const setDashboardLayout = (layout: any[]) => {
    setDashboardLayoutState(layout);
    savePrefs(layout, panelsRef.current, configsRef.current);
  };

  const setDashboardPanels = (panels: string[]) => {
    setDashboardPanelsState(panels);
    savePrefs(layoutRef.current, panels, configsRef.current);
  };

  const addCustomPanel = (config: CustomPanelConfig) => {
    setCustomPanelConfigsState(prev => {
      const next = { ...prev, [config.id]: config };
      savePrefs(layoutRef.current, panelsRef.current, next);
      return next;
    });
  };

  const removeCustomPanel = (id: string) => {
    setCustomPanelConfigsState(prev => {
      const next = { ...prev };
      delete next[id];
      savePrefs(layoutRef.current, panelsRef.current, next);
      return next;
    });
  };

  const updateCustomPanel = (config: CustomPanelConfig) => {
    setCustomPanelConfigsState(prev => {
      const next = { ...prev, [config.id]: config };
      savePrefs(layoutRef.current, panelsRef.current, next);
      return next;
    });
  };

  const addLog = (action: string, details: string) => {
    if (!user) return;
    const newLog: Log = {
      id: `l${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      action,
      details,
    };
    setLogsState(prev => {
      const next = [newLog, ...prev];
      PUT_JSON('/api/logs', next);
      return next;
    });
  };

  return (
    <AppContext.Provider value={{
      theme, setTheme, user, login, logout, data, setData, logs, addLog,
      dashboardLayout, setDashboardLayout, dashboardPanels, setDashboardPanels,
      frameworks, setFrameworks,
      customPanelConfigs, addCustomPanel, removeCustomPanel, updateCustomPanel,
      loading,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export function useAuthenticatedUser(): User {
  const { user } = useApp();
  if (!user) throw new Error('useAuthenticatedUser called outside authenticated context');
  return user;
}
