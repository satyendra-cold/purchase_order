import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
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
} from 'lucide-react';
import jsPDF from 'jspdf';

// ─── Helpers ────────────────────────────────────────────────────────

/** Format ISO string → human-readable date string */
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

const formatReceivedDate = (bill) =>
  bill.poReceivedDate ||
  (bill.plannedDate
    ? new Date(bill.plannedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-');

const formatAmount = (amount) => {
  if (amount == null || isNaN(amount)) return '-';
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
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
];

// ─── Component ──────────────────────────────────────────────────────

export function CreateBillPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Read PO list (written by GeneratePOPage)
  const [purchaseOrders] = useLocalStorage('procureflow_generated_pos', []);

  // Bill records owned by this page
  const [bills, setBills] = useLocalStorage('procureflow_bills', []);

  // Ready products – we push into this when a bill is completed
  const [readyProducts, setReadyProducts] = useLocalStorage('procureflow_ready_products', []);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, bill: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, bill: null });

  // Create Bill dialog
  const [createBillDialog, setCreateBillDialog] = useState({ open: false, bill: null });
  const [billAmountInput, setBillAmountInput] = useState('');
  const [billDateInput, setBillDateInput] = useState('');
  const [billPdfInput, setBillPdfInput] = useState(null);
  const [billPdfNameInput, setBillPdfNameInput] = useState('');

  // ── Auto-sync: add bill entries for POs that don't have one yet ──
  useEffect(() => {
    if (!Array.isArray(purchaseOrders) || purchaseOrders.length === 0) return;

    const existingPoNumbers = new Set(bills.map((b) => b.poNumber));
    const newBills = purchaseOrders
      .filter((po) => !existingPoNumbers.has(po.poNumber))
      .map((po) => ({
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        totalQuantity: po.totalQuantity,
        location: po.location,
        address: po.address,
        poReceivedDate: po.poReceivedDate || po.timestamp?.split('T')[0] || '',
        poPdfName: po.poPdfName || '',
        plannedDate: po.poReceivedDate ? new Date(po.poReceivedDate).toISOString() : po.timestamp,
        billNumber: '',
        billAmount: null,
        billDate: '',
        billPdfName: '',
        actualDate: null,
        status: 'pending',
        delay: 0,
        updatedBy: '',
        createdAt: new Date().toISOString(),
      }));

    if (newBills.length > 0) {
      setBills((prev) => [...newBills, ...prev]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseOrders]);

  // ── Mark bill as completed ─────────────────────────────────────────
  const handleMarkComplete = (bill) => {
    const now = new Date().toISOString();
    const delay = calcDelayDays(bill.plannedDate, now);
    const userName = currentUser ? currentUser.name || currentUser.username : 'System';

    // Update bill record
    const updatedBills = bills.map((b) =>
      b.poNumber === bill.poNumber
        ? { ...b, actualDate: now, status: 'completed', delay, updatedBy: userName }
        : b
    );
    setBills(updatedBills);

    // Push to ready products (only if not already there)
    const alreadyInReady = readyProducts.some((r) => r.poNumber === bill.poNumber);
    if (!alreadyInReady) {
      const readyEntry = {
        poNumber: bill.poNumber,
        vendorName: bill.vendorName,
        totalQuantity: bill.totalQuantity,
        location: bill.location,
        address: bill.address,
        plannedDate: now, // The bill's actual completion date becomes the planned date for ready product
        actualDate: null,
        status: 'pending',
        delay: 0,
        updatedBy: '',
        createdAt: new Date().toISOString(),
      };
      setReadyProducts((prev) => [readyEntry, ...prev]);
    }

    toast(`Bill for ${bill.poNumber} marked as completed!`, 'success');
    setConfirmDialog({ open: false, bill: null });
  };

  // ── Generate Bill PDF ───────────────────────────────────────────────
  const handleDownloadPdf = (bill) => {
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
    T(`Invoice #: ${bill.billNumber || `BILL-${bill.poNumber}`}`, c, y, 'right');
    y += 5;
    T('Raipur, Chhattisgarh - 492001', m, y);
    T(`Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, c, y, 'right');
    y += 5;
    C(80, 80, 80);
    B(9);
    T('GST: 22AAAAA0000A1Z5', m, y);
    N(9);
    T(`PO #: ${bill.poNumber}`, c, y, 'right');
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
    T(bill.vendorName, m + 4, y + 16);
    N(8);
    T(bill.location, m + 4, y + 23);
    T(bill.address, c - 4, y + 23, 'right');

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
    T(bill.location, m + 4, shipY + 15);
    T(bill.address, c - 4, shipY + 15, 'right');

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
    doc.setFillColor(25, 55, 109);
    cols.forEach((col) => doc.rect(col.x, y, col.w, col.h, 'F'));
    C(255, 255, 255);
    B(8);
    cols.forEach((col) => T(col.label, col.x + col.w / 2, y + 5.5, 'center'));
    y += 8;

    // Table body row
    const rate = bill.billAmount && bill.totalQuantity
      ? Math.round(bill.billAmount / bill.totalQuantity)
      : null;
    const rowY = y;
    R(m, rowY, cols.reduce((s, c) => s + c.w, 0), 22);
    C(40, 40, 40);
    N(8);
    T('1', cols[0].x + cols[0].w / 2, rowY + 9, 'center');
    T(`${bill.poNumber} - ${bill.vendorName}`, cols[1].x + 3, rowY + 9, 'left');
    T(bill.totalQuantity?.toLocaleString() || '—', cols[2].x + cols[2].w / 2, rowY + 9, 'center');
    T(rate !== null ? `₹ ${rate.toLocaleString('en-IN')}` : '—', cols[3].x + cols[3].w / 2, rowY + 9, 'center');
    T(bill.billAmount ? formatAmount(bill.billAmount) : '—', cols[4].x + cols[4].w / 2, rowY + 9, 'center');

    // Bottom border
    L(m, rowY + 22, c, rowY + 22, 220);
    y = rowY + 28;

    // ── AMOUNT SUMMARY ────────────────────────────────────────────────
    if (bill.billAmount) {
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
      T(formatAmount(bill.billAmount), boxX + boxW - 3, amtY + 13, 'right');

      C(60, 60, 60);
      N(8);
      T('Tax (0%):', boxX + 3, amtY + 20);
      C(40, 40, 40);
      T(formatAmount(0), boxX + boxW - 3, amtY + 20, 'right');

      L(boxX + 5, amtY + 24, boxX + boxW - 5, amtY + 24, 180);

      C(25, 55, 109);
      B(10);
      T('TOTAL:', boxX + 3, amtY + 32);
      T(formatAmount(bill.billAmount), boxX + boxW - 3, amtY + 32, 'right');

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

    tlLeft('Planned', bill.plannedDate ? formatDate(bill.plannedDate) : '—');
    tlLeft('Actual', bill.actualDate ? formatDate(bill.actualDate) : 'Not yet');
    tlLeft('Status', bill.status === 'completed' ? 'Completed' : 'Pending');
    if (bill.status === 'completed') {
      tlLeft('Delay', bill.delay === 0 ? 'On time' : `${bill.delay} day${bill.delay > 1 ? 's' : ''}`);
      tlLeft('Completed By', bill.updatedBy || '—');
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

    doc.save(`Bill_${bill.poNumber}.pdf`);
  };

  // ── Create Bill handler ────────────────────────────────────────────
  const handleCreateBill = () => {
    const bill = createBillDialog.bill;
    if (!bill) return;

    const amount = parseFloat(billAmountInput);
    if (isNaN(amount) || amount <= 0) {
      toast('Please enter a valid Bill Amount.', 'error');
      return;
    }

    if (!billDateInput) {
      toast('Please select a Bill Date.', 'error');
      return;
    }

    const updatedBills = bills.map((b) =>
      b.poNumber === bill.poNumber
        ? {
            ...b,
            billNumber: `BILL-${bill.poNumber}`,
            billAmount: amount,
            billDate: billDateInput,
            billPdfName: billPdfNameInput,
          }
        : b
    );
    setBills(updatedBills);
    toast(`Bill for ${bill.poNumber} created successfully!`, 'success');
    setCreateBillDialog({ open: false, bill: null });
  };

  // ── Filtered & searched list ───────────────────────────────────────
  const filteredBills = useMemo(() => {
    let list = bills;

    // Tab filter
    if (activeTab === 'pending') list = list.filter((b) => b.status === 'pending');
    else if (activeTab === 'completed') list = list.filter((b) => b.status === 'completed');

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (b) =>
          b.poNumber.toLowerCase().includes(q) ||
          b.vendorName.toLowerCase().includes(q) ||
          b.location.toLowerCase().includes(q) ||
          (b.updatedBy && b.updatedBy.toLowerCase().includes(q))
      );
    }

    return list;
  }, [bills, activeTab, searchTerm]);

  // ── Tab counts ─────────────────────────────────────────────────────
  const counts = useMemo(
    () => ({
      all: bills.length,
      pending: bills.filter((b) => b.status === 'pending').length,
      completed: bills.filter((b) => b.status === 'completed').length,
    }),
    [bills]
  );

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Create Bill
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Process purchase orders by verifying and completing billing. Completed bills move automatically to Ready Product.
          </p>
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
              <p className="text-xl font-bold text-foreground">{counts.all}</p>
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
              <p className="text-xl font-bold text-foreground">{counts.pending}</p>
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
              <p className="text-xl font-bold text-foreground">{counts.completed}</p>
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
              {filteredBills.length} record(s)
            </div>
          </div>

          {/* Right: status tabs + add button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/60 p-1 rounded-xl self-end sm:self-center">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === tab.key
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
                    PO Received Date
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
                    Actual Date
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Status
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Delay
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Updated By
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.length > 0 ? (
                  filteredBills.map((bill) => (
                    <TableRow
                      key={bill.poNumber}
                      className="hover:bg-accent/40 border-b border-border transition-colors"
                    >
                      {/* Actions */}
                      <TableCell className="pl-4 md:pl-6 py-4 text-left">
                        <div className="flex items-center gap-1.5">
                          {/* View detail */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailDialog({ open: true, bill })}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                            title="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {!bill.billNumber ? (
                            <Button
                              onClick={() => {
                                setBillAmountInput('');
                                setBillDateInput(new Date().toISOString().split('T')[0]);
                                setBillPdfInput(null);
                                setBillPdfNameInput('');
                                setCreateBillDialog({ open: true, bill });
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Create Bill
                            </Button>
                          ) : bill.status === 'pending' ? (
                            <Button
                              onClick={() => setConfirmDialog({ open: true, bill })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark Complete
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleDownloadPdf(bill)}
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
                        {bill.poNumber}
                      </TableCell>

                      {/* Vendor Name */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">
                        {bill.vendorName}
                      </TableCell>

                      {/* Location */}
                      <TableCell className="py-4 text-left">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                          {bill.location}
                        </span>
                      </TableCell>

                      {/* PO Received Date */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground">
                        {formatReceivedDate(bill)}
                      </TableCell>

                      {/* Bill Number */}
                      <TableCell className="py-4 text-left font-semibold text-xs sm:text-sm text-foreground">
                        {bill.billNumber || '-'}
                      </TableCell>

                      {/* Bill Amount */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm text-foreground">
                        {formatAmount(bill.billAmount)}
                      </TableCell>

                      {/* Bill Date */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground">
                        {bill.billDate || '-'}
                      </TableCell>

                      {/* Actual Date */}
                      <TableCell className="py-4 text-left">
                        {bill.actualDate ? (
                          <span className="text-xs sm:text-sm text-foreground flex items-center gap-1">
                            <CalendarCheck2 className="h-3.5 w-3.5 text-emerald-500" />
                            {formatDate(bill.actualDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not yet</span>
                        )}
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell className="py-4 text-left">
                        {bill.status === 'completed' ? (
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
                        {bill.status === 'completed' ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${delayBadgeClass(
                              bill.delay
                            )}`}
                          >
                            <Timer className="h-3 w-3" />
                            {bill.delay === 0 ? 'On time' : `${bill.delay} day${bill.delay > 1 ? 's' : ''}`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>

                      {/* Updated By */}
                      <TableCell className="py-4 text-left">
                        {bill.updatedBy ? (
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {bill.updatedBy}
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
                        <div className="p-3 bg-primary/5 rounded-full">
                          <Receipt className="h-8 w-8 text-primary/40" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground/70">No bills found</p>
                          <p className="text-xs">
                            {bills.length === 0
                              ? 'No bills yet. Create a Purchase Order first — bills are generated automatically.'
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
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, bill: null })}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Confirm Bill Completion
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              This will mark the bill as completed and move it to the Ready Product stage.
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.bill && (
            <div className="space-y-3 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">PO Number</span>
                <span className="font-semibold text-primary">{confirmDialog.bill.poNumber}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{confirmDialog.bill.vendorName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bill Number</span>
                <span className="font-medium">{confirmDialog.bill.billNumber || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bill Amount</span>
                <span className="font-medium">{formatAmount(confirmDialog.bill.billAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bill Date</span>
                <span className="font-medium">{confirmDialog.bill.billDate || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">PO Received Date</span>
                <span className="font-medium">{formatReceivedDate(confirmDialog.bill)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Planned Date</span>
                <span className="font-medium">{formatDate(confirmDialog.bill.plannedDate)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processed By</span>
                <span className="font-medium">{currentUser ? currentUser.name || currentUser.username : 'System'}</span>
              </div>
              <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  This action cannot be undone. The PO will advance to Ready Product.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, bill: null })}
              className="border-border hover:bg-accent rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmDialog.bill && handleMarkComplete(confirmDialog.bill)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Bill Dialog ─────────────────────────────────────── */}
      <Dialog open={createBillDialog.open} onOpenChange={(open) => !open && setCreateBillDialog({ open: false, bill: null })}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Create Bill
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Enter bill details for PO {createBillDialog.bill?.poNumber}.
            </DialogDescription>
          </DialogHeader>

          {createBillDialog.bill && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Bill Number</Label>
                <Input
                  value={`BILL-${createBillDialog.bill.poNumber}`}
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
                      setBillPdfInput(file);
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
              onClick={() => setCreateBillDialog({ open: false, bill: null })}
              className="border-border hover:bg-accent rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBill}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl cursor-pointer gap-1.5"
            >
              <Receipt className="h-4 w-4" />
              Create Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail View Dialog ─────────────────────────────────────── */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, bill: null })}>
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

          {detailDialog.bill && (
            <div className="space-y-3 py-3">
              {[
                { label: 'PO Number', value: detailDialog.bill.poNumber },
                { label: 'Vendor', value: detailDialog.bill.vendorName },
                { label: 'Quantity', value: detailDialog.bill.totalQuantity?.toLocaleString() },
                { label: 'Location', value: detailDialog.bill.location },
                { label: 'Address', value: detailDialog.bill.address },
                { label: 'Bill Number', value: detailDialog.bill.billNumber || '-' },
                { label: 'Bill Amount', value: formatAmount(detailDialog.bill.billAmount) },
                { label: 'Bill Date', value: detailDialog.bill.billDate || '-' },
                { label: 'PO Received Date', value: formatReceivedDate(detailDialog.bill) },
                { label: 'PO PDF', value: detailDialog.bill.poPdfName || '-' },
                { label: 'Bill PDF', value: detailDialog.bill.billPdfName || '-' },
                { label: 'Planned Date', value: formatDate(detailDialog.bill.plannedDate) },
                { label: 'Actual Date', value: detailDialog.bill.actualDate ? formatDate(detailDialog.bill.actualDate) : 'Not yet' },
                { label: 'Status', value: detailDialog.bill.status === 'completed' ? 'Completed' : 'Pending' },
                { label: 'Delay', value: detailDialog.bill.status === 'completed' ? (detailDialog.bill.delay === 0 ? 'On time' : `${detailDialog.bill.delay} day(s)`) : '—' },
                { label: 'Updated By', value: detailDialog.bill.updatedBy || '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between text-sm gap-4">
                  <span className="text-muted-foreground shrink-0">{row.label}</span>
                  <span className="font-medium text-foreground text-right">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDetailDialog({ open: false, bill: null })}
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
