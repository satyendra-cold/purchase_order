import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Receipt, 
  ShoppingBag, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Timer, 
  TrendingUp, 
  MapPin, 
  Activity, 
  ArrowUpRight, 
  Building2, 
  CalendarClock, 
  BarChart3, 
  PieChart, 
  User,
  Clock
} from 'lucide-react';

// ─── Helper to resolve PO Stage details ──────────────────────────────
const getPoCurrentStage = (poNumber, stages) => {
  const {
    paymentProcessing,
    approveProduct,
    supplyCheck,
    printInvoice,
    checkTransport,
    readyProducts,
    bills
  } = stages;

  const inPayment = paymentProcessing.find(x => x.poNumber === poNumber);
  if (inPayment) {
    return inPayment.status === 'completed' 
      ? { name: 'Completed', color: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30' }
      : { name: 'Payment Processing', color: 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30' };
  }

  const inApprove = approveProduct.find(x => x.poNumber === poNumber);
  if (inApprove) {
    return inApprove.status === 'completed'
      ? { name: 'Payment Processing', color: 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30' }
      : { name: 'Approve Product', color: 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/30' };
  }

  const inSupply = supplyCheck.find(x => x.poNumber === poNumber);
  if (inSupply) {
    return inSupply.status === 'completed'
      ? { name: 'Approve Product', color: 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/30' }
      : { name: 'Supply Check', color: 'bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/30' };
  }

  const inPrint = printInvoice.find(x => x.poNumber === poNumber);
  if (inPrint) {
    return inPrint.status === 'completed'
      ? { name: 'Supply Check', color: 'bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/30' }
      : { name: 'Print Invoice', color: 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/30' };
  }

  const inTransport = checkTransport.find(x => x.poNumber === poNumber);
  if (inTransport) {
    return inTransport.status === 'completed'
      ? { name: 'Print Invoice', color: 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/30' }
      : { name: 'Check Transport', color: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30' };
  }

  const inReady = readyProducts.find(x => x.poNumber === poNumber);
  if (inReady) {
    return inReady.status === 'completed'
      ? { name: 'Check Transport', color: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30' }
      : { name: 'Ready Product', color: 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/30' };
  }

  const inBills = bills.find(x => x.poNumber === poNumber);
  if (inBills) {
    return inBills.status === 'completed'
      ? { name: 'Ready Product', color: 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/30' }
      : { name: 'Create Bill', color: 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/30' };
  }

  return { name: 'Generate PO', color: 'bg-neutral-50 dark:bg-neutral-900/20 text-neutral-600 dark:text-neutral-400 border-border' };
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { users } = useAuth();

  // ─── Local Storage State Lists ─────────────────────────────────────
  const [purchaseOrders] = useLocalStorage('procureflow_generated_pos', []);
  const [bills] = useLocalStorage('procureflow_bills', []);
  const [readyProducts] = useLocalStorage('procureflow_ready_products', []);
  const [checkTransport] = useLocalStorage('procureflow_check_transport', []);
  const [printInvoice] = useLocalStorage('procureflow_print_invoice', []);
  const [supplyCheck] = useLocalStorage('procureflow_supply_check', []);
  const [approveProduct] = useLocalStorage('procureflow_approve_product', []);
  const [paymentProcessing] = useLocalStorage('procureflow_payment_processing', []);
  const [vendorsList] = useLocalStorage('procureflow_vendors', []);
  
  const displayPOs = purchaseOrders;
  const displayBills = bills;
  const displayReadyProducts = readyProducts;
  const displayCheckTransport = checkTransport;
  const displayPrintInvoice = printInvoice;
  const displaySupplyCheck = supplyCheck;
  const displayApproveProduct = approveProduct;
  const displayPaymentProcessing = paymentProcessing;
  const displayVendorsList = vendorsList;

  // Interactive chart state
  const [hoveredVendor, setHoveredVendor] = useState(null);
  const [hoveredLocationIdx, setHoveredLocationIdx] = useState(null);

  // ─── Combine Stage States ──────────────────────────────────────────
  const stages = useMemo(() => ({
    paymentProcessing: displayPaymentProcessing,
    approveProduct: displayApproveProduct,
    supplyCheck: displaySupplyCheck,
    printInvoice: displayPrintInvoice,
    checkTransport: displayCheckTransport,
    readyProducts: displayReadyProducts,
    bills: displayBills
  }), [displayPaymentProcessing, displayApproveProduct, displaySupplyCheck, displayPrintInvoice, displayCheckTransport, displayReadyProducts, displayBills]);

  // Resolve Stage helper
  const getStageDetails = useMemo(() => {
    return (poNumber) => getPoCurrentStage(poNumber, stages);
  }, [stages]);

  // ─── KPI Metrics ───────────────────────────────────────────────────
  const totalPOs = displayPOs.length;
  const totalQuantity = useMemo(() => {
    return displayPOs.reduce((sum, po) => sum + (po.totalQuantity || 0), 0);
  }, [displayPOs]);

  const activePipelineItems = useMemo(() => {
    return displayPOs.filter(po => {
      const st = getStageDetails(po.poNumber);
      return st.name !== 'Completed';
    }).length;
  }, [displayPOs, getStageDetails]);

  // Aggregate completion efficiency and average cycle delay across all steps
  const analyticsEfficiency = useMemo(() => {
    const allWorkflowItems = [
      ...displayBills,
      ...displayReadyProducts,
      ...displayCheckTransport,
      ...displayPrintInvoice,
      ...displaySupplyCheck,
      ...displayApproveProduct,
      ...displayPaymentProcessing
    ];
    
    const completedTasks = allWorkflowItems.filter(item => item.status === 'completed');
    const totalCompletions = completedTasks.length;
    const delayedCompletions = completedTasks.filter(item => (item.delay || 0) > 0).length;
    const sumDelayDays = completedTasks.reduce((sum, item) => sum + (item.delay || 0), 0);

    const onTimePercentage = totalCompletions > 0
      ? Math.round(((totalCompletions - delayedCompletions) / totalCompletions) * 100)
      : 100;

    const avgDelayDays = totalCompletions > 0
      ? parseFloat((sumDelayDays / totalCompletions).toFixed(1))
      : 0.0;

    return { onTimePercentage, avgDelayDays, totalCompletions };
  }, [displayBills, displayReadyProducts, displayCheckTransport, displayPrintInvoice, displaySupplyCheck, displayApproveProduct, displayPaymentProcessing]);

  // ─── Funnel Pipeline Stage Counts ──────────────────────────────────
  const funnelData = useMemo(() => {
    const pipelineStages = [
      { key: 'Generate PO', label: 'Generate PO', pending: 0, completed: 0 },
      { key: 'Create Bill', label: 'Create Bill', pending: 0, completed: 0 },
      { key: 'Ready Product', label: 'Ready Product', pending: 0, completed: 0 },
      { key: 'Check Transport', label: 'Check Transport', pending: 0, completed: 0 },
      { key: 'Print Invoice', label: 'Print Invoice', pending: 0, completed: 0 },
      { key: 'Supply Check', label: 'Supply Check', pending: 0, completed: 0 },
      { key: 'Approve Product', label: 'Approve Product', pending: 0, completed: 0 },
      { key: 'Payment Processing', label: 'Payment Processing', pending: 0, completed: 0 }
    ];

    purchaseOrders.forEach(po => {
      const current = getStageDetails(po.poNumber).name;
      let currentIdx = pipelineStages.findIndex(s => s.key === current);
      if (current === 'Completed') {
        currentIdx = pipelineStages.length; // completed past all stages
      }

      pipelineStages.forEach((stage, idx) => {
        if (idx < currentIdx) {
          stage.completed += 1;
        } else if (idx === currentIdx) {
          stage.pending += 1;
        }
      });
    });

    return pipelineStages;
  }, [displayPOs, getStageDetails]);

  // ─── Vendor Quantity Analysis Data ─────────────────────────────────
  const vendorChartData = useMemo(() => {
    const qtyMap = {};
    const countMap = {};

    displayVendorsList.forEach(v => {
      qtyMap[v.name] = 0;
      countMap[v.name] = 0;
    });

    displayPOs.forEach(po => {
      qtyMap[po.vendorName] = (qtyMap[po.vendorName] || 0) + (po.totalQuantity || 0);
      countMap[po.vendorName] = (countMap[po.vendorName] || 0) + 1;
    });

    return Object.keys(qtyMap).map(name => ({
      name,
      quantity: qtyMap[name] || 0,
      orders: countMap[name] || 0
    })).filter(item => item.orders > 0 || displayVendorsList.some(v => v.name === item.name));
  }, [displayPOs, displayVendorsList]);

  // ─── Location Distribution Data ────────────────────────────────────
  const locationChartData = useMemo(() => {
    const locMap = {};
    displayPOs.forEach(po => {
      const loc = po.location || 'UNKNOWN';
      locMap[loc] = (locMap[loc] || 0) + (po.totalQuantity || 0);
    });

    const totalLocQty = Object.values(locMap).reduce((sum, v) => sum + v, 0);
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

    return Object.keys(locMap).map((name, idx) => ({
      name,
      quantity: locMap[name],
      percentage: totalLocQty > 0 ? Math.round((locMap[name] / totalLocQty) * 100) : 0,
      color: colors[idx % colors.length]
    }));
  }, [displayPOs]);

  // ─── Detailed Tracker List ─────────────────────────────────────────
  const poTrackerList = useMemo(() => {
    return displayPOs.map(po => {
      const currentStage = getStageDetails(po.poNumber);
      return {
        ...po,
        stage: currentStage.name,
        badgeStyle: currentStage.color
      };
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [displayPOs, getStageDetails]);

  // Format Date Helper
  const formatTimestamp = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };



  // ─── SVG Donut Angles Calculations ─────────────────────────────────
  let accumulatedPercent = 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-left">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary animate-pulse" />
            Operations Analytics Dashboard
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Real-time pipeline monitoring, vendor supply volume, and logistical delivery efficiency metrics.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Ordered Quantity */}
        <Card className="border-border bg-card shadow-sm rounded-2xl relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 bg-primary/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110 duration-300" />
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Units Ordered</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{totalQuantity.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                Across <span className="font-semibold text-foreground">{totalPOs}</span> official POs
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Active Pipeline Items */}
        <Card className="border-border bg-card shadow-sm rounded-2xl relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 bg-amber-500/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110 duration-300" />
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Pipeline Items</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{activePipelineItems}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Currently processing in workflow
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: On-Time Logistics Efficiency */}
        <Card className="border-border bg-card shadow-sm rounded-2xl relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 bg-emerald-500/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110 duration-300" />
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">On-Time Completion</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{analyticsEfficiency.onTimePercentage}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Zero delay completion rate
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Average Delay Days */}
        <Card className="border-border bg-card shadow-sm rounded-2xl relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 bg-rose-500/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110 duration-300" />
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Timer className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg Pipeline Delay</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{analyticsEfficiency.avgDelayDays} Days</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Across {analyticsEfficiency.totalCompletions} workflow actions
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Vendor Supply Quantity Chart (Bar Chart) */}
        <Card className="border-border bg-card shadow-sm rounded-2xl p-5 text-left flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base font-bold text-foreground">Vendor Volume Comparison</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Total product units dispatched by vendor partner</p>
              </div>
            </div>

            {/* Interactive SVG Bar Chart */}
            <div className="relative h-[250px] w-full flex items-end justify-between px-6 pt-6 select-none">
              
              {/* Tooltip Overlay */}
              {hoveredVendor && (
                <div 
                  className="absolute top-2 left-1/2 -translate-x-1/2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-lg border border-border flex flex-col gap-0.5 animate-in fade-in zoom-in duration-150 z-10"
                >
                  <span className="text-muted-foreground text-[9px] uppercase tracking-wider">{hoveredVendor.name}</span>
                  <span>Units Ordered: {hoveredVendor.quantity.toLocaleString()}</span>
                  <span>Total POs: {hoveredVendor.orders}</span>
                </div>
              )}

              {/* Draw custom bars */}
              {vendorChartData.map((item, idx) => {
                const maxQty = Math.max(...vendorChartData.map(v => v.quantity), 1);
                const heightPercent = Math.max((item.quantity / maxQty) * 100, 4); // minimum bar height 4% for visibility
                
                return (
                  <div 
                    key={item.name} 
                    className="flex flex-col items-center flex-1 group"
                    onMouseEnter={() => setHoveredVendor(item)}
                    onMouseLeave={() => setHoveredVendor(null)}
                  >
                    {/* Visual Bar */}
                    <div className="w-12 sm:w-16 bg-neutral-100 dark:bg-neutral-800 rounded-t-xl h-[180px] flex items-end overflow-hidden border border-border/40 relative">
                      <div 
                        style={{ height: `${heightPercent}%` }}
                        className="w-full bg-gradient-to-t from-primary/80 to-primary rounded-t-lg transition-all duration-500 ease-out relative group-hover:brightness-110 shadow-[0_0_12px_rgba(var(--primary-color),0.1)] cursor-pointer"
                      />
                    </div>

                    {/* Bar quantity label */}
                    <span className="text-[10px] font-bold text-foreground mt-2 group-hover:text-primary transition-colors">
                      {item.quantity >= 1000 ? `${(item.quantity / 1000).toFixed(1)}k` : item.quantity}
                    </span>

                    {/* Bar bottom label */}
                    <span className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[80px] font-semibold uppercase tracking-wider">
                      {item.name}
                    </span>
                  </div>
                );
              })}

            </div>
          </div>
        </Card>

        {/* Regional Distribution (Donut Chart) */}
        <Card className="border-border bg-card shadow-sm rounded-2xl p-5 text-left flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
              <PieChart className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base font-bold text-foreground">Regional Unit Breakdown</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Distribution of ordered product units across hub locations</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
              {/* SVG Ring Donut */}
              <div className="relative w-[180px] h-[180px]">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  {locationChartData.map((slice, idx) => {
                    const r = 38;
                    const c = 2 * Math.PI * r; // 238.76
                    const dashArray = c;
                    const dashOffset = dashArray - (slice.percentage / 100) * dashArray;
                    
                    const rotation = (accumulatedPercent / 100) * 360;
                    accumulatedPercent += slice.percentage;

                    const isHovered = hoveredLocationIdx === idx;

                    return (
                      <circle
                        key={slice.name}
                        cx="50"
                        cy="50"
                        r={r}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth={isHovered ? 11 : 8}
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(${rotation} 50 50)`}
                        className="transition-all duration-300 cursor-pointer hover:brightness-110"
                        onMouseEnter={() => setHoveredLocationIdx(idx)}
                        onMouseLeave={() => setHoveredLocationIdx(null)}
                      />
                    );
                  })}
                </svg>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-transparent pointer-events-none select-none">
                  {hoveredLocationIdx !== null ? (
                    <div className="animate-in fade-in duration-200">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        {locationChartData[hoveredLocationIdx].name}
                      </span>
                      <p className="text-lg font-black text-foreground">
                        {locationChartData[hoveredLocationIdx].percentage}%
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {locationChartData[hoveredLocationIdx].quantity.toLocaleString()} units
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                        Total
                      </span>
                      <p className="text-lg font-black text-foreground">
                        {totalQuantity.toLocaleString()}
                      </p>
                      <p className="text-[8px] text-muted-foreground uppercase">
                        Units Seeding
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Legends list */}
              <div className="flex flex-col gap-2.5">
                {locationChartData.map((item, idx) => (
                  <div 
                    key={item.name} 
                    className={`flex items-center gap-3 px-3 py-1.5 rounded-xl border border-transparent transition-all ${
                      hoveredLocationIdx === idx ? 'bg-accent/40 border-border shadow-sm' : ''
                    }`}
                    onMouseEnter={() => setHoveredLocationIdx(idx)}
                    onMouseLeave={() => setHoveredLocationIdx(null)}
                  >
                    <span 
                      className="h-3 w-3 rounded-full shrink-0" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {item.quantity.toLocaleString()} units ({item.percentage}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Funnel Pipeline Visualizer */}
      <Card className="border-border bg-card shadow-sm rounded-2xl p-5 text-left">
        <div className="flex items-center gap-2 border-b border-border pb-3 mb-5">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base font-bold text-foreground">Workflow Funnel Distribution</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Distribution of all active and completed items across the 8 sequential pipeline stages</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {funnelData.map((stage, idx) => {
            const hasActivity = stage.pending > 0 || stage.completed > 0;
            return (
              <div 
                key={stage.key} 
                className={`p-4 rounded-xl border bg-neutral-50/50 dark:bg-neutral-900/10 flex flex-col justify-between h-[120px] transition-all ${
                  stage.pending > 0 
                    ? 'border-amber-200 dark:border-amber-900/40 bg-amber-500/[0.02] shadow-[0_0_12px_rgba(245,158,11,0.02)]' 
                    : stage.completed > 0
                    ? 'border-emerald-200 dark:border-emerald-900/40' 
                    : 'border-border'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Stage {idx + 1}</span>
                  {stage.pending > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                      Processing
                    </span>
                  )}
                </div>

                {/* Name */}
                <p className="text-sm font-bold text-foreground tracking-tight mt-1">{stage.label}</p>

                {/* Counts */}
                <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-border/40">
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] text-muted-foreground uppercase font-semibold">Pending</span>
                    <span className={`text-sm font-black mt-0.5 ${stage.pending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/60'}`}>
                      {stage.pending}
                    </span>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] text-muted-foreground uppercase font-semibold">Completed</span>
                    <span className={`text-sm font-black mt-0.5 ${stage.completed > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60'}`}>
                      {stage.completed}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* PO Stage Tracker Table */}
      <Card className="border-border bg-card shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="py-4 px-5 border-b border-border bg-neutral-50/50 dark:bg-neutral-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
          <div>
            <CardTitle className="text-base font-bold text-foreground">Purchase Order Stage Tracker</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Real-time status tracking of all active procurement runs in reverse chronological order</p>
          </div>
        </CardHeader>
        
        <div className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                <TableRow>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-5 py-3 text-left">PO Number</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Vendor Partner</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Total Units</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Location</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Date Generated</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Current Workflow Step</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poTrackerList.length > 0 ? (
                  poTrackerList.map((po) => (
                    <TableRow key={po.poNumber} className="hover:bg-accent/40 border-b border-border transition-colors">
                      
                      {/* PO Number */}
                      <TableCell className="pl-5 py-3 text-left font-bold text-primary text-xs sm:text-sm">
                        {po.poNumber}
                      </TableCell>

                      {/* Vendor Name */}
                      <TableCell className="py-3 text-left text-xs sm:text-sm font-semibold text-foreground">
                        {po.vendorName}
                      </TableCell>

                      {/* Total Quantity */}
                      <TableCell className="py-3 text-left text-xs sm:text-sm font-black text-foreground">
                        {po.totalQuantity.toLocaleString()}
                      </TableCell>

                      {/* Location */}
                      <TableCell className="py-3 text-left">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                          {po.location}
                        </span>
                      </TableCell>

                      {/* Created Date */}
                      <TableCell className="py-3 text-left text-xs text-muted-foreground">
                        {formatTimestamp(po.timestamp)}
                      </TableCell>

                      {/* Status badge */}
                      <TableCell className="py-3 text-left">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${po.badgeStyle}`}>
                          {po.stage === 'Completed' ? (
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {po.stage}
                        </span>
                      </TableCell>

                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground italic">
                      No purchase orders recorded yet. Go to Generate PO to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
      
    </div>
  );
}
