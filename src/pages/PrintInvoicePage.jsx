import { useState, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSheetData } from '@/hooks/useSheetData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Timer,
  Printer,
  MapPin,
  CalendarClock,
  CalendarCheck2,
  Eye,
  FileDown,
} from 'lucide-react';
import jsPDF from 'jspdf';

// ─── Helpers ────────────────────────────────────────────────────────

const formatDate = (isoString) => {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
};

const formatAmount = (amount) => {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

const calcDelayDays = (plannedISO, actualISO) => {
  if (!plannedISO || !actualISO) return 0;
  const planned = new Date(plannedISO);
  const actual = new Date(actualISO);
  const diffMs = actual.getTime() - planned.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

const delayBadgeClass = (days) => {
  if (days === 0)
    return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  if (days <= 3)
    return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  return 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
};

const hasValue = (val) => val != null && String(val).trim() !== '';

const makeTimestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'history', label: 'History' },
];

// ─── Component ──────────────────────────────────────────────────────

export function PrintInvoicePage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Load consolidated FMS sheet directly
  const [fmsData, setFmsData] = useSheetData('FMS', 'poNumber');

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, item: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, item: null });

  // ── Pending   = planned4 (col AE) NOT null  AND  actual4 (col AF) IS empty
  // ── Completed = planned4 (col AE) NOT null  AND  actual4 (col AF) NOT empty
  const isPending = (row) => hasValue(row.planned4) && !hasValue(row.actual4);
  const isCompleted = (row) => hasValue(row.planned4) && hasValue(row.actual4);

  // ── Print PDF generators ──────────────────────────────────────────
  const handlePrintPO = (item) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210;
    const m = 15;
    const c = pw - m;
    let y = 15;

    const B = (s) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(s); };
    const N = (s) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(s); };
    const C = (r, g, b) => doc.setTextColor(r, g, b);
    const T = (t, x, y, a = 'left') => doc.text(t, x, y, { align: a });
    const R = (x, y, w, h) => { doc.rect(x, y, w, h); };
    const L = (x1, y1, x2, y2, col = 200) => { doc.setDrawColor(col); doc.line(x1, y1, x2, y2); };

    // ── TOP COLOR BAR ─────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42); // slate-900 color
    doc.rect(m, y, c - m, 22, 'F');
    C(255, 255, 255);
    B(18);
    T('PROCUREMENT SYSTEM', m + 5, y + 14);
    B(11);
    T('PURCHASE ORDER', c - 5, y + 14, 'right');
    y += 28;

    // ── DETAILS ───────────────────────────────────────────────────────
    C(60, 60, 60);
    N(9);
    T('123 Business Park, Industrial Area', m, y);
    T(`PO Number: ${item.poNumber}`, c, y, 'right');
    y += 5;
    T('Raipur, Chhattisgarh - 492001', m, y);
    T(`Date: ${formatDate(item.planned4 || item.timestamp)}`, c, y, 'right');
    y += 5;
    T('GST: 22AAAAA0000A1Z5', m, y);
    const poStatus = isCompleted(item) ? 'COMPLETED' : 'PENDING';
    T(`Status: ${poStatus}`, c, y, 'right');
    y += 12;

    // ── DIVIDER ───────────────────────────────────────────────────────
    L(m, y, c, y, 200); y += 8;

    // ── VENDOR BOX ───────────────────────────────────────────────────
    R(m, y, c - m, 28);
    doc.setFillColor(245, 247, 250);
    doc.rect(m, y, c - m, 8, 'F');
    C(15, 23, 42);
    B(9);
    T('VENDOR / SUPPLIER', m + 4, y + 6);
    C(50, 50, 50);
    N(10);
    T(item.vendorName, m + 4, y + 16);
    N(8);
    T(`Delivery Location: ${item.location}`, m + 4, y + 23);
    T(`Shipping Address: ${item.address}`, c - 4, y + 23, 'right');

    y += 36;
    L(m, y, c, y, 200); y += 8;

    // ── ITEM TABLE ────────────────────────────────────────────────────
    const cols = [
      { x: m, w: 8,  h: 8, label: '#' },
      { x: m + 8, w: 72, h: 8, label: 'ITEM DESCRIPTION' },
      { x: m + 80, w: 25, h: 8, label: 'QTY' },
      { x: m + 105, w: 35, h: 8, label: 'RATE' },
      { x: m + 140, w: 35, h: 8, label: 'AMOUNT' },
    ];

    // Table header
    doc.setFillColor(15, 23, 42);
    cols.forEach((col) => doc.rect(col.x, y, col.w, col.h, 'F'));
    C(255, 255, 255);
    B(8);
    cols.forEach((col) => T(col.label, col.x + col.w / 2, y + 5.5, 'center'));
    y += 8;

    // Table body row
    const rate = item.billAmount && item.totalQuantity
      ? Math.round(item.billAmount / item.totalQuantity)
      : null;
    const rowY = y;
    R(m, rowY, cols.reduce((s, c) => s + c.w, 0), 22);
    C(40, 40, 40);
    N(8);
    T('1', cols[0].x + cols[0].w / 2, rowY + 9, 'center');
    T(`Goods/Supplies delivery for PO ${item.poNumber}`, cols[1].x + 3, rowY + 9, 'left');
    T(item.totalQuantity?.toLocaleString() || '—', cols[2].x + cols[2].w / 2, rowY + 9, 'center');
    T(rate !== null ? `₹ ${rate.toLocaleString('en-IN')}` : '—', cols[3].x + cols[3].w / 2, rowY + 9, 'center');
    T(item.billAmount ? formatAmount(item.billAmount) : '—', cols[4].x + cols[4].w / 2, rowY + 9, 'center');

    // Bottom border
    L(m, rowY + 22, c, rowY + 22, 220);
    y = rowY + 28;

    // ── AMOUNT SUMMARY ────────────────────────────────────────────────
    if (item.billAmount) {
      const boxX = c - 65;
      const boxW = 50;
      const amtY = y;

      R(boxX, amtY, boxW, 36);
      doc.setFillColor(245, 247, 250);
      doc.rect(boxX, amtY, boxW, 7, 'F');
      C(15, 23, 42);
      B(8);
      T('AMOUNT SUMMARY', boxX + boxW / 2, amtY + 5, 'center');

      C(60, 60, 60);
      N(8);
      T('Subtotal:', boxX + 3, amtY + 13);
      C(40, 40, 40);
      T(formatAmount(item.billAmount), boxX + boxW - 3, amtY + 13, 'right');

      C(60, 60, 60);
      N(8);
      T('Tax (0%):', boxX + 3, amtY + 20);
      C(40, 40, 40);
      T(formatAmount(0), boxX + boxW - 3, amtY + 20, 'right');

      L(boxX + 5, amtY + 24, boxX + boxW - 5, amtY + 24, 180);

      C(15, 23, 42);
      B(10);
      T('TOTAL:', boxX + 3, amtY + 32);
      T(formatAmount(item.billAmount), boxX + boxW - 3, amtY + 32, 'right');

      y = amtY + 42;
    }

    L(m, y, c, y, 200); y += 8;

    // ── FOOTER ────────────────────────────────────────────────────────
    C(100, 100, 100);
    N(8);
    T('This Purchase Order serves as a request for delivery according to the agreed terms.', m, y); y += 5;
    T('Please provide the corresponding Tax Invoice at the time of delivery.', m, y); y += 12;

    L(m, y, c, y, 200); y += 5;
    C(150, 150, 150);
    N(7);
    T('ProcureFlow System Document', m, y);
    T(`Printed: ${new Date().toLocaleString('en-IN')}`, c, y, 'right');

    doc.save(`PO_${item.poNumber}.pdf`);
    toast(`PO ${item.poNumber} PDF downloaded!`, 'success');
  };

  const handlePrintInvoice = (item) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210;
    const m = 15;
    const c = pw - m;
    let y = 15;

    const B = (s) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(s); };
    const N = (s) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(s); };
    const C = (r, g, b) => doc.setTextColor(r, g, b);
    const T = (t, x, y, a = 'left') => doc.text(t, x, y, { align: a });
    const R = (x, y, w, h) => { doc.rect(x, y, w, h); };
    const L = (x1, y1, x2, y2, col = 200) => { doc.setDrawColor(col); doc.line(x1, y1, x2, y2); };

    // ── TOP COLOR BAR ─────────────────────────────────────────────────
    doc.setFillColor(22, 101, 52); // emerald-800
    doc.rect(m, y, c - m, 22, 'F');
    C(255, 255, 255);
    B(18);
    T('PROCUREMENT SYSTEM', m + 5, y + 14);
    B(11);
    T('TAX INVOICE', c - 5, y + 14, 'right');
    y += 28;

    // ── DETAILS ───────────────────────────────────────────────────────
    C(60, 60, 60);
    N(9);
    T('123 Business Park, Industrial Area', m, y);
    T(`Invoice #: ${item.billNumber || `BILL-${item.poNumber}`}`, c, y, 'right');
    y += 5;
    T('Raipur, Chhattisgarh - 492001', m, y);
    T(`Invoice Date: ${item.billDate ? new Date(item.billDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}`, c, y, 'right');
    y += 5;
    T('GST: 22AAAAA0000A1Z5', m, y);
    T(`PO #: ${item.poNumber}`, c, y, 'right');
    y += 12;

    // ── DIVIDER ───────────────────────────────────────────────────────
    L(m, y, c, y, 200); y += 8;

    // ── BILL TO BOX ───────────────────────────────────────────────────
    R(m, y, c - m, 28);
    doc.setFillColor(245, 247, 250);
    doc.rect(m, y, c - m, 8, 'F');
    C(22, 101, 52);
    B(9);
    T('BILL TO (VENDOR)', m + 4, y + 6);
    C(50, 50, 50);
    N(10);
    T(item.vendorName, m + 4, y + 16);
    N(8);
    T(`Location: ${item.location}`, m + 4, y + 23);
    T(`Address: ${item.address}`, c - 4, y + 23, 'right');

    // ── SHIPMENT & LOGISTICS INFO ─────────────────────────────────────
    const shipY = y + 34;
    R(m, shipY, c - m, 20);
    doc.setFillColor(245, 247, 250);
    doc.rect(m, shipY, c - m, 8, 'F');
    C(22, 101, 52);
    B(9);
    T('SHIPMENT & LOGISTICS', m + 4, shipY + 6);
    C(50, 50, 50);
    N(8);
    T(`Transporter: ${item.transporterName || '—'}`, m + 4, shipY + 15);
    T(`Planned Date: ${formatDate(item.planned4)}`, c - 4, shipY + 15, 'right');

    y = shipY + 28;
    L(m, y, c, y, 200); y += 8;

    // ── ITEM TABLE ────────────────────────────────────────────────────
    const cols = [
      { x: m, w: 8,  h: 8, label: '#' },
      { x: m + 8, w: 72, h: 8, label: 'DESCRIPTION' },
      { x: m + 80, w: 25, h: 8, label: 'QTY' },
      { x: m + 105, w: 35, h: 8, label: 'RATE' },
      { x: m + 140, w: 35, h: 8, label: 'AMOUNT' },
    ];

    // Table header
    doc.setFillColor(22, 101, 52);
    cols.forEach((col) => doc.rect(col.x, y, col.w, col.h, 'F'));
    C(255, 255, 255);
    B(8);
    cols.forEach((col) => T(col.label, col.x + col.w / 2, y + 5.5, 'center'));
    y += 8;

    // Table body row
    const rate = item.billAmount && item.totalQuantity
      ? Math.round(item.billAmount / item.totalQuantity)
      : null;
    const rowY = y;
    R(m, rowY, cols.reduce((s, c) => s + c.w, 0), 22);
    C(40, 40, 40);
    N(8);
    T('1', cols[0].x + cols[0].w / 2, rowY + 9, 'center');
    T(`${item.poNumber} - ${item.vendorName}`, cols[1].x + 3, rowY + 9, 'left');
    T(item.totalQuantity?.toLocaleString() || '—', cols[2].x + cols[2].w / 2, rowY + 9, 'center');
    T(rate !== null ? `₹ ${rate.toLocaleString('en-IN')}` : '—', cols[3].x + cols[3].w / 2, rowY + 9, 'center');
    T(item.billAmount ? formatAmount(item.billAmount) : '—', cols[4].x + cols[4].w / 2, rowY + 9, 'center');

    // Bottom border
    L(m, rowY + 22, c, rowY + 22, 220);
    y = rowY + 28;

    // ── AMOUNT SUMMARY ────────────────────────────────────────────────
    if (item.billAmount) {
      const boxX = c - 65;
      const boxW = 50;
      const amtY = y;

      R(boxX, amtY, boxW, 36);
      doc.setFillColor(245, 247, 250);
      doc.rect(boxX, amtY, boxW, 7, 'F');
      C(22, 101, 52);
      B(8);
      T('AMOUNT SUMMARY', boxX + boxW / 2, amtY + 5, 'center');

      C(60, 60, 60);
      N(8);
      T('Subtotal:', boxX + 3, amtY + 13);
      C(40, 40, 40);
      T(formatAmount(item.billAmount), boxX + boxW - 3, amtY + 13, 'right');

      C(60, 60, 60);
      N(8);
      T('Tax (0%):', boxX + 3, amtY + 20);
      C(40, 40, 40);
      T(formatAmount(0), boxX + boxW - 3, amtY + 20, 'right');

      L(boxX + 5, amtY + 24, boxX + boxW - 5, amtY + 24, 180);

      C(22, 101, 52);
      B(10);
      T('TOTAL:', boxX + 3, amtY + 32);
      T(formatAmount(item.billAmount), boxX + boxW - 3, amtY + 32, 'right');

      y = amtY + 42;
    }

    L(m, y, c, y, 200); y += 8;

    // ── FOOTER ────────────────────────────────────────────────────────
    C(100, 100, 100);
    N(8);
    T('1. Payment is due within 30 days from the invoice date.', m, y); y += 5;
    T('2. This is a system-generated invoice and is valid without a physical signature.', m, y); y += 8;

    L(m, y, c, y, 200); y += 5;
    C(150, 150, 150);
    N(7);
    T('Thank you for your business!', m, y);
    T(`Generated: ${new Date().toLocaleString('en-IN')}`, c, y, 'right');

    doc.save(`Invoice_${item.poNumber}.pdf`);
    toast(`Invoice for PO ${item.poNumber} PDF downloaded!`, 'success');
  };

  // ── Mark as invoice printed ────────────────────────────────────────
  const handleMarkComplete = (item) => {
    const nowTimestamp = makeTimestamp(); // M/D/YYYY H:mm:ss format
    const userName = currentUser ? currentUser.name || currentUser.username : 'System';

    // Update FMS state directly
    const updated = fmsData.map((r) =>
      r.poNumber === item.poNumber
        ? {
            ...r,
            actual4:  nowTimestamp,
            updatedBy: userName,
          }
        : r
    );
    setFmsData(updated);

    toast(`Invoice for ${item.poNumber} printed successfully!`, 'success');
    setConfirmDialog({ open: false, item: null });
  };

  // ── Filtered & searched list ───────────────────────────────────────
  const filteredItems = useMemo(() => {
    // Only show items where planned4 (col AE) has a value
    let list = fmsData.filter((r) => hasValue(r.planned4));

    if (activeTab === 'pending') list = list.filter(isPending);
    else if (activeTab === 'history') list = list.filter(isCompleted);

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.poNumber || '').toLowerCase().includes(q) ||
          String(r.vendorName || '').toLowerCase().includes(q) ||
          String(r.location || '').toLowerCase().includes(q) ||
          String(r.transporterName || '').toLowerCase().includes(q) ||
          String(r.updatedBy || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [fmsData, activeTab, searchTerm]);

  const counts = useMemo(() => {
    const staged = fmsData.filter((r) => hasValue(r.planned4));
    const pendingCount = staged.filter(isPending).length;
    const historyCount = staged.filter(isCompleted).length;
    return {
      all: staged.length,
      pending: pendingCount,
      history: historyCount,
      completed: historyCount,
    };
  }, [fmsData]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Print Invoice
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Review and print invoices for transported orders. Completed items move to Supply Check.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Printer className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Invoices</p>
              <p className="text-xl font-bold text-foreground">{counts.all}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pending</p>
              <p className="text-xl font-bold text-foreground">{counts.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Completed</p>
              <p className="text-xl font-bold text-foreground">{counts.completed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="py-4 px-4 md:px-6 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search invoices…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background h-9 text-xs sm:text-sm max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground hidden md:inline-block">{filteredItems.length} record(s)</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/60 p-1 rounded-xl self-end sm:self-center">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}<span className="ml-1.5 text-[10px] opacity-70">({counts[tab.key]})</span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                <TableRow>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">Actions</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">PO Number</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Vendor</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Transporter</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Location</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Invoice Number</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Invoice Amount</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Planned 4 (AE)</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Actual 4 (AF)</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Delay 4 (AG)</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Updated By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <TableRow key={item.poNumber} className="hover:bg-accent/40 border-b border-border transition-colors">
                      <TableCell className="pl-4 md:pl-6 py-4 text-left">
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="icon" onClick={() => setDetailDialog({ open: true, item })} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer" title="View details">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrintPO(item)} className="h-8 w-8 text-slate-700 hover:text-slate-900 hover:bg-accent rounded-lg cursor-pointer dark:text-slate-300 dark:hover:text-slate-100" title="Print PO">
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrintInvoice(item)} className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-accent rounded-lg cursor-pointer dark:text-emerald-400 dark:hover:text-emerald-300" title="Print Invoice">
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          {!hasValue(item.actual4) && (
                            <Button onClick={() => setConfirmDialog({ open: true, item })} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm">
                              <Printer className="h-3.5 w-3.5" />Invoice Printed
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pl-4 md:pl-6 py-4 text-left font-semibold text-primary text-xs sm:text-sm">{item.poNumber}</TableCell>
                      <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">{item.vendorName}</TableCell>
                      <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground">
                        {item.transporterName ? (
                          <span className="font-medium text-foreground">{item.transporterName}</span>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />{item.location}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-left font-semibold text-xs sm:text-sm text-foreground">
                        {item.billNumber || '—'}
                      </TableCell>
                      <TableCell className="py-4 text-left font-bold text-xs sm:text-sm text-foreground">
                        {formatAmount(item.billAmount)}
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />{formatDate(item.planned4)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        {hasValue(item.actual4) ? (
                          <span className="text-xs sm:text-sm text-foreground flex items-center gap-1">
                            <CalendarCheck2 className="h-3.5 w-3.5 text-emerald-500" />{formatDate(item.actual4)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not yet</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        {hasValue(item.actual4) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="h-3 w-3" />Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        {hasValue(item.actual4) ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${delayBadgeClass(item.delay4)}`}>
                            <Timer className="h-3 w-3" />{item.delay4 === 0 ? 'On time' : `${item.delay4} day(s)`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        {item.updatedBy ? (
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />{item.updatedBy}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={12} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="p-3 bg-primary/5 rounded-full"><Printer className="h-8 w-8 text-primary/40" /></div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground/70">No invoice records</p>
                          <p className="text-xs">
                            No invoice records match your current filters.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-500" />Confirm Invoice Printed
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              This will stamp Actual 4 (col AF) and mark the invoice as printed.
            </DialogDescription>
          </DialogHeader>
          {confirmDialog.item && (
            <div className="space-y-3 py-3 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">PO Number</span>
                <span className="font-semibold text-primary">{confirmDialog.item.poNumber}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{confirmDialog.item.vendorName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Transporter</span>
                <span className="font-medium">{confirmDialog.item.transporterName || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Invoice Number</span>
                <span className="font-medium">{confirmDialog.item.billNumber}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Invoice Amount</span>
                <span className="font-medium">{formatAmount(confirmDialog.item.billAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Planned 4 (AE)</span>
                <span className="font-medium">{formatDate(confirmDialog.item.planned4)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processed By</span>
                <span className="font-medium">{currentUser ? currentUser.name || currentUser.username : 'System'}</span>
              </div>
              <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />This action will write Actual 4 (col AF) to the FMS sheet.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, item: null })} className="border-border hover:bg-accent rounded-xl cursor-pointer">Cancel</Button>
            <Button onClick={() => confirmDialog.item && handleMarkComplete(confirmDialog.item)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer gap-1.5">
              <Printer className="h-4 w-4" />Confirm Printed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />Invoice Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">Full details for this invoice record.</DialogDescription>
          </DialogHeader>
          {detailDialog.item && (
            <div className="space-y-3 py-3">
              {[
                { label: 'PO Number', value: detailDialog.item.poNumber },
                { label: 'Vendor', value: detailDialog.item.vendorName },
                { label: 'Quantity', value: detailDialog.item.totalQuantity?.toLocaleString() },
                { label: 'Location', value: detailDialog.item.location },
                { label: 'Address', value: detailDialog.item.address },
                { label: 'Transporter', value: detailDialog.item.transporterName || '—' },
                { label: 'Invoice Number', value: detailDialog.item.billNumber },
                { label: 'Invoice Amount', value: formatAmount(detailDialog.item.billAmount) },
                { label: 'Invoice Date', value: detailDialog.item.billDate ? new Date(detailDialog.item.billDate).toLocaleDateString('en-IN') : '—' },
                { label: 'Planned 4 (AE)', value: formatDate(detailDialog.item.planned4) },
                { label: 'Actual 4 (AF)', value: hasValue(detailDialog.item.actual4) ? formatDate(detailDialog.item.actual4) : 'Not yet' },
                { label: 'Status', value: hasValue(detailDialog.item.actual4) ? 'Completed' : 'Pending' },
                { label: 'Delay 4 (AG)', value: hasValue(detailDialog.item.actual4) ? (detailDialog.item.delay4 === 0 ? 'On time' : `${detailDialog.item.delay4} day(s)`) : '—' },
                { label: 'Updated By', value: detailDialog.item.updatedBy || '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between text-sm gap-4">
                  <span className="text-muted-foreground shrink-0">{row.label}</span>
                  <span className="font-medium text-foreground text-right">{row.value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="mt-4 gap-2 justify-between flex-row sm:justify-between">
            <div className="flex gap-2">
              {detailDialog.item && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handlePrintPO(detailDialog.item)} className="border-border hover:bg-accent rounded-xl cursor-pointer gap-1.5 text-xs">
                    <FileDown className="h-4 w-4" />Print PO
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handlePrintInvoice(detailDialog.item)} className="border-border hover:bg-accent rounded-xl cursor-pointer gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <Printer className="h-4 w-4" />Print Invoice
                  </Button>
                </>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setDetailDialog({ open: false, item: null })} className="border-border hover:bg-accent rounded-xl cursor-pointer text-xs">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
