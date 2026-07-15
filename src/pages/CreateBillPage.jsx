import { useState, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSheetData } from '@/hooks/useSheetData';
import { uploadFile } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Receipt,
  MapPin,
  CalendarCheck2,
  Eye,
  FileDown,
  FilePlus2,
} from 'lucide-react';
import jsPDF from 'jspdf';

// ─── Helpers ────────────────────────────────────────────────────────

/** Format ISO string → human-readable date string */
const formatDate = (isoString) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    // Reject Excel epoch glitches (year < 1990)
    if (isNaN(d) || d.getFullYear() < 1990) return isoString;
    return d.toLocaleString('en-IN', {
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

/** Check if a value is not null and not empty */
const isValidDate = (val) => {
  return val != null && String(val).trim() !== '';
};

/** Make a timestamp string in M/D/YYYY H:mm:ss format — same as FMS sheet */
const makeTimestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** Convert a date string (e.g. YYYY-MM-DD) into M/D/YYYY H:mm:ss format */
const formatToTimestamp = (dateVal) => {
  if (!dateVal) return '';
  const match = String(dateVal).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [_, year, month, day] = match;
    return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year} 00:00:00`;
  }
  const d = new Date(dateVal);
  if (isNaN(d)) return dateVal;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatAmount = (amount) => {
  if (amount == null || isNaN(amount) || amount === '') return '-';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

/** Calculate delay in calendar days between two ISO dates. Returns integer ≥ 0 */
const calcDelayDays = (plannedISO, actualISO) => {
  if (!plannedISO || !actualISO) return 0;
  const planned = new Date(plannedISO);
  const actual = new Date(actualISO);
  const diffMs = actual.getTime() - planned.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

/** Delay badge colour */
const delayBadgeClass = (days) => {
  if (days === 0)
    return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  if (days <= 3)
    return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  return 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
};

// ─── Status tabs ────────────────────────────────────────────────────

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'history', label: 'History' },
];

// ─── Component ──────────────────────────────────────────────────────

export function CreateBillPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // FMS is the single source of truth
  const [fmsData, setFmsData, fmsLoading] = useSheetData('FMS', 'poNumber');

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, row: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, row: null });

  // Create Bill dialog
  const [createBillDialog, setCreateBillDialog] = useState({ open: false, row: null });
  const [billAmountInput, setBillAmountInput] = useState('');
  const [billDateInput, setBillDateInput] = useState('');
  const [billPdfFile, setBillPdfFile] = useState(null);
  const [billPdfNameInput, setBillPdfNameInput] = useState('');
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // ── Pending   = planned1 (col L) NOT null  AND  actual1 (col M) IS null
  // ── Completed = planned1 (col L) NOT null  AND  actual1 (col M) NOT null
  const isPending = (row) => isValidDate(row.planned1) && !isValidDate(row.actual1);
  const isCompleted = (row) => isValidDate(row.planned1) && isValidDate(row.actual1);

  // ── Mark bill as completed ─────────────────────────────────────────
  const handleMarkComplete = (row) => {
    const nowTimestamp = makeTimestamp(); // M/D/YYYY H:mm:ss — saved to col M
    const userName = currentUser ? currentUser.name || currentUser.username : 'System';

    const updatedFms = fmsData.map((r) =>
      r.poNumber === row.poNumber
        ? { ...r, actual1: nowTimestamp, updatedBy: userName }
        : r
    );
    setFmsData(updatedFms);

    toast(`Bill for ${row.poNumber} marked as completed!`, 'success');
    setConfirmDialog({ open: false, row: null });
  };

  // ── Generate Bill PDF ───────────────────────────────────────────────
  const handleDownloadPdf = (row) => {
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
    doc.setFillColor(25, 55, 109);
    doc.rect(m, y, c - m, 22, 'F');
    C(255, 255, 255);
    B(18);
    T('PROCUREMENT SYSTEM', m + 5, y + 14);
    B(11);
    T('TAX INVOICE', c - 5, y + 14, 'right');
    y += 28;

    // ── COMPANY & INVOICE META ────────────────────────────────────────
    C(60, 60, 60);
    N(9);
    T('123 Business Park, Industrial Area', m, y);
    T(`Invoice #: ${row.billNumber || `BILL-${row.poNumber}`}`, c, y, 'right');
    y += 5;
    T('Raipur, Chhattisgarh - 492001', m, y);
    T(`Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, c, y, 'right');
    y += 5;
    C(80, 80, 80);
    B(9);
    T('GST: 22AAAAA0000A1Z5', m, y);
    N(9);
    T(`PO #: ${row.poNumber}`, c, y, 'right');
    y += 12;

    // ── DIVIDER ───────────────────────────────────────────────────────
    L(m, y, c, y, 200); y += 8;

    // ── BILL TO BOX ───────────────────────────────────────────────────
    R(m, y, c - m, 28);
    doc.setFillColor(245, 247, 250);
    doc.rect(m, y, c - m, 8, 'F');
    C(25, 55, 109);
    B(9);
    T('BILL TO', m + 4, y + 6);
    C(50, 50, 50);
    N(10);
    T(row.vendorName, m + 4, y + 16);
    N(8);
    T(row.location, m + 4, y + 23);
    T(row.address, c - 4, y + 23, 'right');

    // ── SHIP TO BOX ───────────────────────────────────────────────────
    const shipY = y + 34;
    R(m, shipY, c - m, 20);
    doc.setFillColor(245, 247, 250);
    doc.rect(m, shipY, c - m, 8, 'F');
    C(25, 55, 109);
    B(9);
    T('SHIP TO', m + 4, shipY + 6);
    C(50, 50, 50);
    N(8);
    T(row.location, m + 4, shipY + 15);
    T(row.address, c - 4, shipY + 15, 'right');

    y = shipY + 28;
    L(m, y, c, y, 200); y += 8;

    // ── ITEM TABLE ────────────────────────────────────────────────────
    const cols = [
      { x: m, w: 8, h: 8, label: '#' },
      { x: m + 8, w: 72, h: 8, label: 'DESCRIPTION' },
      { x: m + 80, w: 25, h: 8, label: 'QTY' },
      { x: m + 105, w: 35, h: 8, label: 'RATE' },
      { x: m + 140, w: 35, h: 8, label: 'AMOUNT' },
    ];

    // Table header
    doc.setFillColor(25, 55, 109);
    cols.forEach((col) => doc.rect(col.x, y, col.w, col.h, 'F'));
    C(255, 255, 255);
    B(8);
    cols.forEach((col) => T(col.label, col.x + col.w / 2, y + 5.5, 'center'));
    y += 8;

    // Table body row
    const billAmt = parseFloat(row.billAmount) || null;
    const rate = billAmt && row.totalQuantity
      ? Math.round(billAmt / row.totalQuantity)
      : null;
    const rowY = y;
    R(m, rowY, cols.reduce((s, c) => s + c.w, 0), 22);
    C(40, 40, 40);
    N(8);
    T('1', cols[0].x + cols[0].w / 2, rowY + 9, 'center');
    T(`${row.poNumber} - ${row.vendorName}`, cols[1].x + 3, rowY + 9, 'left');
    T(row.totalQuantity?.toLocaleString() || '—', cols[2].x + cols[2].w / 2, rowY + 9, 'center');
    T(rate !== null ? `₹ ${rate.toLocaleString('en-IN')}` : '—', cols[3].x + cols[3].w / 2, rowY + 9, 'center');
    T(billAmt ? formatAmount(billAmt) : '—', cols[4].x + cols[4].w / 2, rowY + 9, 'center');

    // Bottom border
    L(m, rowY + 22, c, rowY + 22, 220);
    y = rowY + 28;

    // ── AMOUNT SUMMARY ────────────────────────────────────────────────
    if (billAmt) {
      const boxX = c - 65;
      const boxW = 50;
      const amtY = y;

      R(boxX, amtY, boxW, 36);
      doc.setFillColor(245, 247, 250);
      doc.rect(boxX, amtY, boxW, 7, 'F');
      C(25, 55, 109);
      B(8);
      T('AMOUNT SUMMARY', boxX + boxW / 2, amtY + 5, 'center');

      C(60, 60, 60);
      N(8);
      T('Subtotal:', boxX + 3, amtY + 13);
      C(40, 40, 40);
      T(formatAmount(billAmt), boxX + boxW - 3, amtY + 13, 'right');

      C(60, 60, 60);
      N(8);
      T('Tax (0%):', boxX + 3, amtY + 20);
      C(40, 40, 40);
      T(formatAmount(0), boxX + boxW - 3, amtY + 20, 'right');

      L(boxX + 5, amtY + 24, boxX + boxW - 5, amtY + 24, 180);

      C(25, 55, 109);
      B(10);
      T('TOTAL:', boxX + 3, amtY + 32);
      T(formatAmount(billAmt), boxX + boxW - 3, amtY + 32, 'right');

      y = amtY + 42;
    }

    L(m, y, c, y, 200); y += 8;

    // ── TIMELINE & STATUS ─────────────────────────────────────────────
    C(25, 55, 109);
    B(10);
    T('TIMELINE & STATUS', m, y);
    y += 7;

    const tlLeft = (label, value) => {
      C(80, 80, 80); B(9); T(label + ':', m + 3, y);
      C(50, 50, 50); N(9); T(String(value), m + 38, y);
      y += 5.5;
    };

    tlLeft('Planned', isValidDate(row.planned1) ? formatDate(row.planned1) : '—');
    tlLeft('Actual', isValidDate(row.actual1) ? formatDate(row.actual1) : 'Not yet');
    tlLeft('Status', isValidDate(row.actual1) ? 'Completed' : 'Pending');
    if (isValidDate(row.actual1)) {
      const delay = row.delay1 || 0;
      tlLeft('Delay', delay === 0 ? 'On time' : `${delay} day${delay > 1 ? 's' : ''}`);
    }

    y += 4;
    L(m, y, c, y, 200); y += 8;

    // ── TERMS & FOOTER ────────────────────────────────────────────────
    C(25, 55, 109);
    B(10);
    T('TERMS & CONDITIONS', m, y);
    y += 7;
    C(100, 100, 100);
    N(8);
    T('1. Payment is due within 30 days from the invoice date.', m, y); y += 5;
    T('2. This is a system-generated invoice and is valid without a physical signature.', m, y); y += 5;
    T('3. For any queries regarding this invoice, please contact the procurement department.', m, y); y += 8;

    L(m, y, c, y, 200); y += 5;

    C(150, 150, 150);
    N(7);
    T('Thank you for your business!', m, y);
    T(`Generated: ${new Date().toLocaleString('en-IN')}`, c, y, 'right');
    y += 4;
    T(`Page 1/1`, c, y, 'right');

    doc.save(`Bill_${row.poNumber}.pdf`);
  };

  // ── Create Bill handler ────────────────────────────────────────────
  const handleCreateBill = async () => {
    const row = createBillDialog.row;
    if (!row) return;

    const amount = parseFloat(billAmountInput);
    if (isNaN(amount) || amount <= 0) {
      toast('Please enter a valid Bill Amount.', 'error');
      return;
    }

    if (!billDateInput) {
      toast('Please select a Bill Date.', 'error');
      return;
    }

    let billPdfUrl = row.billPdf || '';

    // Upload PDF if a new file is selected
    if (billPdfFile) {
      setIsUploadingPdf(true);
      try {
        toast('Uploading PDF…', 'info');
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(billPdfFile);
        });
        const res = await uploadFile(base64, billPdfFile.name, billPdfFile.type || 'application/pdf', '1Hzz1nxg1A_rDaigFZ6ZMxpB2-AzSmIhM');
        billPdfUrl = res.fileUrl || '';
      } catch (err) {
        toast(`PDF upload failed: ${err.message}`, 'error');
        setIsUploadingPdf(false);
        return;
      } finally {
        setIsUploadingPdf(false);
      }
    }

    const updatedFms = fmsData.map((r) =>
      r.poNumber === row.poNumber
        ? {
          ...r,
          billNumber: `BILL-${row.poNumber}`,
          billAmount: amount,
          billDate: billDateInput,
          billPdf: billPdfUrl,
          actual1: makeTimestamp(), // set actual1 in M/D/YYYY H:mm:ss format immediately
        }
        : r
    );
    setFmsData(updatedFms);
    toast(`Bill for ${row.poNumber} created successfully!`, 'success');
    setCreateBillDialog({ open: false, row: null });
  };

  // ── Filtered & searched list ───────────────────────────────────────
  const filteredRows = useMemo(() => {
    // Only show rows that have planned1 set (are in the "Create Bill" stage)
    let list = fmsData.filter((r) => isValidDate(r.planned1));

    // Tab filter
    if (activeTab === 'pending') list = list.filter(isPending);
    else if (activeTab === 'history') list = list.filter(isCompleted);

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.poNumber || '').toLowerCase().includes(q) ||
          String(r.vendorName || '').toLowerCase().includes(q) ||
          String(r.location || '').toLowerCase().includes(q)
      );
    }

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmsData, activeTab, searchTerm]);

  const counts = useMemo(() => {
    const staged = fmsData.filter((r) => isValidDate(r.planned1));
    const pendingCount = staged.filter(isPending).length;
    const historyCount = staged.filter(isCompleted).length;
    return {
      all: staged.length,
      pending: pendingCount,
      history: historyCount,
      completed: historyCount,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmsData]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Create Bill
          </h1>
          
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total */}
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Bills</p>
              <p className="text-xl font-bold text-foreground">{fmsLoading ? '…' : counts.all}</p>
            </div>
          </CardContent>
        </Card>
        {/* Pending */}
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pending</p>
              <p className="text-xl font-bold text-foreground">{fmsLoading ? '…' : counts.pending}</p>
            </div>
          </CardContent>
        </Card>
        {/* Completed */}
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Completed</p>
              <p className="text-xl font-bold text-foreground">{fmsLoading ? '…' : counts.completed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="py-4 px-4 md:px-6 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Left: search + record count */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search bills…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background h-9 text-xs sm:text-sm max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground hidden md:inline-block">
              {filteredRows.length} record(s)
            </div>
          </div>

          {/* Right: status tabs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/60 p-1 rounded-xl self-end sm:self-center">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${activeTab === tab.key
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-[10px] opacity-70">({counts[tab.key]})</span>
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
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">
                    Actions
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    PO Number
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Vendor
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Location
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Planned 1 (L)
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Bill Number
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Bill Amount
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Bill Date
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Actual 1 (M)
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Status
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Delay
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Bill PDF
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fmsLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-16 text-center text-muted-foreground text-sm">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length > 0 ? (
                  filteredRows.map((row) => {
                    const pending = isPending(row);
                    const completed = isCompleted(row);
                    const delay = row.delay1 || 0;

                    return (
                      <TableRow
                        key={row.poNumber}
                        className="hover:bg-accent/40 border-b border-border transition-colors"
                      >
                        {/* Actions */}
                        <TableCell className="pl-4 md:pl-6 py-4 text-left">
                          <div className="flex items-center gap-1.5">
                            {/* View detail */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDetailDialog({ open: true, row })}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                              title="View details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {!row.billNumber ? (
                              // No bill yet → Create Bill button
                              <Button
                                onClick={() => {
                                  setBillAmountInput('');
                                  setBillDateInput(new Date().toISOString().split('T')[0]);
                                  setBillPdfFile(null);
                                  setBillPdfNameInput('');
                                  setCreateBillDialog({ open: true, row });
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm"
                              >
                                <Receipt className="h-3.5 w-3.5" />
                                Create Bill
                              </Button>
                            ) : !completed ? (
                              // Bill created, not completed yet → Mark Complete
                              <Button
                                onClick={() => setConfirmDialog({ open: true, row })}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Mark Complete
                              </Button>
                            ) : (
                              // Completed → Download PDF
                              <Button
                                onClick={() => handleDownloadPdf(row)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm"
                              >
                                <FileDown className="h-3.5 w-3.5" />
                                Bill PDF
                              </Button>
                            )}
                          </div>
                        </TableCell>

                        {/* PO Number */}
                        <TableCell className="py-4 text-left font-semibold text-primary text-xs sm:text-sm">
                          {row.poNumber}
                        </TableCell>

                        {/* Vendor Name */}
                        <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">
                          {row.vendorName}
                        </TableCell>

                        {/* Location */}
                        <TableCell className="py-4 text-left">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                            <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                            {row.location}
                          </span>
                        </TableCell>

                        {/* Planned 1 (Col L) */}
                        <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground">
                          {isValidDate(row.planned1) ? formatDate(row.planned1) : '—'}
                        </TableCell>

                        {/* Bill Number */}
                        <TableCell className="py-4 text-left font-semibold text-xs sm:text-sm text-foreground">
                          {row.billNumber || '-'}
                        </TableCell>

                        {/* Bill Amount */}
                        <TableCell className="py-4 text-left text-xs sm:text-sm text-foreground">
                          {formatAmount(row.billAmount)}
                        </TableCell>

                        {/* Bill Date */}
                        <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground">
                          {row.billDate || '-'}
                        </TableCell>

                        {/* Actual 1 (Col M) */}
                        <TableCell className="py-4 text-left">
                          {completed ? (
                            <span className="text-xs sm:text-sm text-foreground flex items-center gap-1">
                              <CalendarCheck2 className="h-3.5 w-3.5 text-emerald-500" />
                              {formatDate(row.actual1)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not yet</span>
                          )}
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell className="py-4 text-left">
                          {completed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <Clock className="h-3 w-3" />
                              Pending
                            </span>
                          )}
                        </TableCell>

                        {/* Delay */}
                        <TableCell className="py-4 text-left">
                          {completed ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${delayBadgeClass(delay)}`}
                            >
                              <Timer className="h-3 w-3" />
                              {delay === 0 ? 'On time' : `${delay} day${delay > 1 ? 's' : ''}`}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>

                        {/* Bill PDF */}
                        <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground">
                          {row.billPdf ? (
                            String(row.billPdf).startsWith('http') ? (
                              <a
                                href={row.billPdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                              >
                                <FilePlus2 className="h-3.5 w-3.5" />
                                View PDF
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-primary">
                                <FilePlus2 className="h-3.5 w-3.5" />
                                {row.billPdf}
                              </span>
                            )
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={12} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="p-3 bg-primary/5 rounded-full">
                          <Receipt className="h-8 w-8 text-primary/40" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground/70">No bills found</p>
                          <p className="text-xs">
                            {counts.all === 0
                              ? 'No records with Planned 1 (col L) set. Rows appear here once planned1 is filled in the FMS sheet.'
                              : 'No records match your current filters.'}
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

      {/* ── Confirm Complete Dialog ─────────────────────────────────── */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, row: null })}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Confirm Bill Completion
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              This will set Actual 1 (col M) to now and mark the bill as completed.
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.row && (
            <div className="space-y-3 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">PO Number</span>
                <span className="font-semibold text-primary">{confirmDialog.row.poNumber}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{confirmDialog.row.vendorName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bill Number</span>
                <span className="font-medium">{confirmDialog.row.billNumber || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bill Amount</span>
                <span className="font-medium">{formatAmount(confirmDialog.row.billAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bill Date</span>
                <span className="font-medium">{confirmDialog.row.billDate || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Planned 1</span>
                <span className="font-medium">{formatDate(confirmDialog.row.planned1)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processed By</span>
                <span className="font-medium">{currentUser ? currentUser.name || currentUser.username : 'System'}</span>
              </div>
              <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  This will write the completion date to Actual 1 (col M) in the FMS sheet.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, row: null })}
              className="border-border hover:bg-accent rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmDialog.row && handleMarkComplete(confirmDialog.row)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Bill Dialog ─────────────────────────────────────── */}
      <Dialog open={createBillDialog.open} onOpenChange={(open) => !open && setCreateBillDialog({ open: false, row: null })}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Create Bill
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Enter bill details for PO {createBillDialog.row?.poNumber}.
            </DialogDescription>
          </DialogHeader>

          {createBillDialog.row && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Bill Number</Label>
                <Input
                  value={`BILL-${createBillDialog.row.poNumber}`}
                  readOnly
                  className="rounded-xl bg-muted border-input text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Bill Amount*</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={billAmountInput}
                  onChange={(e) => setBillAmountInput(e.target.value)}
                  placeholder="e.g. 50000"
                  className="rounded-xl bg-background border-input text-xs h-10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Bill Date*</Label>
                <Input
                  type="date"
                  value={billDateInput}
                  onChange={(e) => setBillDateInput(e.target.value)}
                  className="rounded-xl bg-background border-input text-xs h-10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Bill PDF</Label>
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBillPdfFile(file);
                      setBillPdfNameInput(file.name);
                    }
                  }}
                  className="rounded-xl bg-background border-input file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer text-xs h-10"
                />
                {billPdfNameInput && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Selected: {billPdfNameInput}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateBillDialog({ open: false, row: null })}
              className="border-border hover:bg-accent rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBill}
              disabled={isUploadingPdf}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl cursor-pointer gap-1.5 disabled:opacity-60"
            >
              <Receipt className="h-4 w-4" />
              {isUploadingPdf ? 'Uploading…' : 'Create Bill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail View Dialog ─────────────────────────────────────── */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, row: null })}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Bill Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Full details for this billing record.
            </DialogDescription>
          </DialogHeader>

          {detailDialog.row && (
            <div className="space-y-3 py-3">
              {[
                { label: 'PO Number', value: detailDialog.row.poNumber },
                { label: 'Vendor', value: detailDialog.row.vendorName },
                { label: 'Quantity', value: Number(detailDialog.row.totalQuantity || 0).toLocaleString() },
                { label: 'Location', value: detailDialog.row.location },
                { label: 'Address', value: detailDialog.row.address },
                { label: 'PO Received Date', value: detailDialog.row.poReceivedDate || '—' },
                { label: 'Bill Number', value: detailDialog.row.billNumber || '-' },
                { label: 'Bill Amount', value: formatAmount(detailDialog.row.billAmount) },
                { label: 'Bill Date', value: detailDialog.row.billDate || '-' },
                { label: 'PO PDF', value: detailDialog.row.poPdfName || '-' },
                { label: 'Bill PDF', value: detailDialog.row.billPdf || '-' },
                { label: 'Planned 1 (Col L)', value: isValidDate(detailDialog.row.planned1) ? formatDate(detailDialog.row.planned1) : '—' },
                { label: 'Actual 1 (Col M)', value: isValidDate(detailDialog.row.actual1) ? formatDate(detailDialog.row.actual1) : 'Not yet' },
                { label: 'Status', value: isCompleted(detailDialog.row) ? 'Completed' : 'Pending' },
                { label: 'Delay', value: isCompleted(detailDialog.row) ? (detailDialog.row.delay1 === 0 ? 'On time' : `${detailDialog.row.delay1} day(s)`) : '—' },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between text-sm gap-4">
                  <span className="text-muted-foreground shrink-0">{item.label}</span>
                  <span className="font-medium text-foreground text-right break-all">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDetailDialog({ open: false, row: null })}
              className="border-border hover:bg-accent rounded-xl cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
