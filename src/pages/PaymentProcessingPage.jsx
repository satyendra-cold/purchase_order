import { useState, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSheetData } from '@/hooks/useSheetData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  CreditCard,
  MapPin,
  CalendarClock,
  Eye,
  PlusCircle,
  Banknote,
  TrendingUp,
} from 'lucide-react';

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

const fmt = (n) =>
  n != null && !isNaN(Number(n))
    ? `₹${Number(n).toLocaleString('en-IN')}`
    : '—';

// ─── Payment History helpers ─────────────────────────────────────────
// All payments for a PO are stored as a JSON array in the single
// `paymentHistory` column: [{ amount, date }, ...]
// This removes the need for fixed Payment 1–5 columns in the sheet.

const parseHistory = (row) => {
  try {
    const h = row.paymentHistory;
    if (!h) return [];                    // null / undefined / 0
    if (Array.isArray(h)) return h;       // already parsed (shouldn't happen, but safe)
    const str = String(h).trim();
    if (!str || str === '[]') return [];  // empty or empty array string
    const parsed = JSON.parse(str);
    // JSON.parse('null') = null — ensure we always return an Array
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];                            // malformed JSON — treat as no history
  }
};

// If paymentHistory is empty/missing on a fresh sheet load, fall back to the
// sheet-written `totalPaid` value so status badges are correct after refresh.
const totalPaidLocal = (row) => {
  const history = parseHistory(row);
  if (history.length > 0) {
    return history.reduce((s, i) => s + Number(i.amount), 0);
  }
  // Fallback: use the value the app previously wrote to the sheet
  return Number(row.totalPaid) || 0;
};

const balanceDueLocal = (row) => {
  const bill = Number(row.billAmount);
  if (!bill) return null;
  const paid = totalPaidLocal(row);
  return Math.max(0, bill - paid);
};

const paymentStatusLocal = (row) => {
  const bill = Number(row.billAmount);
  if (!bill) {
    // Fallback: read status string from sheet if bill amount not set
    const s = String(row.paymentStatus || '').toLowerCase();
    if (s === 'fully paid') return 'fullyPaid';
    if (s === 'partial') return 'partial';
    return 'pending';
  }
  const paid = totalPaidLocal(row);
  if (paid >= bill) return 'fullyPaid';
  if (paid > 0) return 'partial';
  return 'pending';
};

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'history', label: 'History' },
];

// ─── Component ──────────────────────────────────────────────────────

export function PaymentProcessingPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [fmsData, , , refetchFMS, setFmsLocal, patchFMS] = useSheetData('FMS', 'poNumber');
  const [vendors] = useSheetData('Vendors', 'id');
  const [locationData] = useSheetData('Locations', 'name');
  const locations = locationData.map((l) => l.name);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [payDialog, setPayDialog] = useState({ open: false, item: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, item: null });
  const [isSaving, setIsSaving] = useState(false);

  // Payment form state
  const [formVendor, setFormVendor] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formBillingAmount, setFormBillingAmount] = useState('');
  const [formPaymentAmount, setFormPaymentAmount] = useState('');

  const qualifies = (row) => hasValue(row.planned7);

  // ── Open payment dialog ──────────────────────────────────────────
  const handleOpenPayment = (item) => {
    setFormVendor(item.vendorName || '');
    setFormPoNumber(item.poNumber || '');
    setFormLocation(item.location || '');
    setFormAddress(item.address || '');
    setFormBillingAmount(
      item.billAmount !== undefined && item.billAmount !== null
        ? String(item.billAmount)
        : ''
    );
    setFormPaymentAmount('');
    setPayDialog({ open: true, item });
  };

  // ── Submit instalment ───────────────────────────────────────────
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const item = payDialog.item;
    if (!item) return;

    const amountToAdd = Number(formPaymentAmount);
    if (!amountToAdd || amountToAdd <= 0) {
      toast('Please enter a valid payment amount.', 'error');
      return;
    }

    const billAmt = Number(formBillingAmount || item.billAmount || 0);
    if (!billAmt || billAmt <= 0) {
      toast('Please enter a valid billing amount.', 'error');
      return;
    }

    const existingHistory = parseHistory(item);
    const alreadyPaid = existingHistory.length > 0
      ? existingHistory.reduce((s, i) => s + Number(i.amount), 0)
      : Number(item.totalPaid) || 0;
    const balance = Math.max(0, billAmt - alreadyPaid);

    if (amountToAdd > balance) {
      toast(`Amount exceeds balance due (${fmt(balance)}). Please enter ≤ balance.`, 'error');
      return;
    }

    const nowTimestamp = makeTimestamp();
    const userName = currentUser ? currentUser.name || currentUser.username : 'System';
    const newHistory = [...existingHistory, { amount: amountToAdd, date: nowTimestamp }];
    const newTotalPaid = newHistory.reduce((s, i) => s + Number(i.amount), 0);
    const newBalance = Math.max(0, billAmt - newTotalPaid);
    const isNowFullyPaid = newTotalPaid >= billAmt;

    const paymentFields = {
      actual7: nowTimestamp,
      totalPaid: newTotalPaid,
      balanceDue: newBalance,
      paymentStatus: isNowFullyPaid ? 'Fully Paid' : 'Partial',
      paymentHistory: JSON.stringify(newHistory),
    };

    // Close dialog and show optimistic update immediately
    setPayDialog({ open: false, item: null });
    setFmsLocal(fmsData.map((r) =>
      r.poNumber === item.poNumber ? { ...r, ...paymentFields } : r
    ));
    setIsSaving(true);

    try {
      // Write directly to sheet — throws on any failure
      await patchFMS(item.poNumber, paymentFields, { onlySpecified: true });
      if (isNowFullyPaid) {
        toast(`Payment for ${formPoNumber} fully completed! ✅`, 'success');
      } else {
        toast(
          `Instalment #${newHistory.length} of ₹${amountToAdd.toLocaleString('en-IN')} recorded. Balance: ₹${newBalance.toLocaleString('en-IN')}`,
          'success'
        );
      }
    } catch (err) {
      toast(`Failed to save payment: ${err.message}`, 'error');
      refetchFMS(); // revert optimistic update by reloading from sheet
    } finally {
      setIsSaving(false);
    }
  };

  // ── Filtered list ───────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let list = fmsData.filter(qualifies);
    if (activeTab === 'pending') {
      list = list.filter((r) => paymentStatusLocal(r) === 'pending' || paymentStatusLocal(r) === 'partial');
    } else if (activeTab === 'history') {
      list = list.filter((r) => paymentStatusLocal(r) === 'fullyPaid');
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.poNumber || '').toLowerCase().includes(q) ||
          String(r.vendorName || '').toLowerCase().includes(q) ||
          String(r.location || '').toLowerCase().includes(q) ||
          String(r.updatedBy || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [fmsData, activeTab, searchTerm]);

  const counts = useMemo(() => {
    const staged = fmsData.filter(qualifies);
    const pendingRows   = staged.filter((r) => paymentStatusLocal(r) === 'pending');
    const partialRows   = staged.filter((r) => paymentStatusLocal(r) === 'partial');
    const fullyPaidRows = staged.filter((r) => paymentStatusLocal(r) === 'fullyPaid');

    return {
      // counts (used by tab badges and cards)
      all:      staged.length,
      pending:  pendingRows.length + partialRows.length,
      history:  fullyPaidRows.length,
      partial:  partialRows.length,
      fullyPaid: fullyPaidRows.length,

      // ₹ amounts (used by KPI cards)
      totalBillAmount:    staged.reduce((s, r) => s + (Number(r.billAmount) || 0), 0),
      totalPaidAmount:    staged.reduce((s, r) => s + totalPaidLocal(r), 0),
      totalPendingAmount: [...pendingRows, ...partialRows].reduce(
        (s, r) => s + (balanceDueLocal(r) ?? 0), 0
      ),
      totalFullyPaidAmount: fullyPaidRows.reduce(
        (s, r) => s + (Number(r.billAmount) || 0), 0
      ),
    };
  }, [fmsData]);

  // ── Live values for dialog ────────────────────────────────────────
  const dialogItem = payDialog.item;
  const dialogHistory = dialogItem ? parseHistory(dialogItem) : [];
  const dialogTotalPaid = dialogItem ? totalPaidLocal(dialogItem) : 0;
  const dialogBillAmt = dialogItem ? Number(formBillingAmount || dialogItem.billAmount || 0) : 0;
  const dialogBalance = dialogBillAmt > 0 ? Math.max(0, dialogBillAmt - dialogTotalPaid) : null;
  const dialogProgress = dialogBillAmt > 0 ? Math.min(100, (dialogTotalPaid / dialogBillAmt) * 100) : 0;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Payment Processing
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Receive full or partial vendor payments. All instalments are tracked automatically.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Bill Amount */}
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Amount</p>
              <p className="text-base font-bold text-foreground truncate">{fmt(counts.totalBillAmount)}</p>
              <p className="text-[10px] text-muted-foreground">{counts.all} record{counts.all !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Paid */}
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Banknote className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Paid</p>
              <p className="text-base font-bold text-blue-700 dark:text-blue-300 truncate">{fmt(counts.totalPaidAmount)}</p>
              <p className="text-[10px] text-muted-foreground">{counts.partial} partial · {counts.fullyPaid} done</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Pending (Balance Due) */}
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Pending</p>
              <p className="text-base font-bold text-amber-700 dark:text-amber-300 truncate">{fmt(counts.totalPendingAmount)}</p>
              <p className="text-[10px] text-muted-foreground">{counts.pending} record{counts.pending !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>

        {/* Fully Paid */}
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fully Paid</p>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 truncate">{fmt(counts.totalFullyPaidAmount)}</p>
              <p className="text-[10px] text-muted-foreground">{counts.fullyPaid} record{counts.fullyPaid !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="py-4 px-4 md:px-6 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search payments…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background h-9 text-xs sm:text-sm max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground hidden md:inline-block">{filteredItems.length} record(s)</div>
          </div>
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
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                <TableRow>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">Actions</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-2 py-3 text-left">PO Number</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Vendor</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Location</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Bill / Paid / Balance</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Instalments</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Planned 7</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Delay 7</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Updated By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const status = paymentStatusLocal(item);
                    const paid = totalPaidLocal(item);
                    const bill = Number(item.billAmount);
                    const balance = bill > 0 ? Math.max(0, bill - paid) : null;
                    const progress = bill > 0 ? Math.min(100, (paid / bill) * 100) : 0;
                    const history = parseHistory(item);

                    return (
                      <TableRow key={item.poNumber} className="hover:bg-accent/40 border-b border-border transition-colors">
                        {/* Actions */}
                        <TableCell className="pl-4 md:pl-6 py-4 text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => setDetailDialog({ open: true, item })}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                              title="View details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {status === 'pending' && (
                              <Button
                                onClick={() => handleOpenPayment(item)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm"
                              >
                                <CreditCard className="h-3.5 w-3.5" />Receive Payment
                              </Button>
                            )}
                            {status === 'partial' && (
                              <Button
                                onClick={() => handleOpenPayment(item)}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm"
                              >
                                <PlusCircle className="h-3.5 w-3.5" />Receive More
                              </Button>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="pl-2 py-4 text-left font-semibold text-primary text-xs sm:text-sm">{item.poNumber}</TableCell>
                        <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">{item.vendorName}</TableCell>

                        <TableCell className="py-4 text-left">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                            <MapPin className="h-2.5 w-2.5 text-muted-foreground" />{item.location}
                          </span>
                        </TableCell>

                        {/* Bill / Paid / Balance with progress bar */}
                        <TableCell className="py-4 text-left min-w-[180px]">
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-muted-foreground">Bill:</span>
                              <span className="font-semibold text-foreground">{bill ? fmt(bill) : '—'}</span>
                            </div>
                            {bill > 0 && (
                              <>
                                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full transition-all duration-500 ${
                                      progress >= 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-blue-500' : 'bg-neutral-400'
                                    }`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-blue-600 dark:text-blue-400">Paid: {fmt(paid)}</span>
                                  <span className={balance === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                    Bal: {fmt(balance)}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </TableCell>

                        {/* Instalment count badge */}
                        <TableCell className="py-4 text-left">
                          {history.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <Banknote className="h-3 w-3" />{history.length} payment{history.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>

                        {/* Status badge */}
                        <TableCell className="py-4 text-left">
                          {status === 'fullyPaid' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />Fully Paid
                            </span>
                          )}
                          {status === 'partial' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <TrendingUp className="h-3 w-3" />Partial
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <Clock className="h-3 w-3" />Pending
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="py-4 text-left">
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />{formatDate(item.planned7)}
                          </span>
                        </TableCell>

                        <TableCell className="py-4 text-left">
                          {hasValue(item.actual7) ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${delayBadgeClass(item.delay7)}`}>
                              <Timer className="h-3 w-3" />{item.delay7 === 0 ? 'On time' : `${item.delay7} day(s)`}
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
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="p-3 bg-primary/5 rounded-full"><CreditCard className="h-8 w-8 text-primary/40" /></div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground/70">No payment records</p>
                          <p className="text-xs">No records match your current filters.</p>
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

      {/* ── Receive Payment Dialog ───────────────────────────────────────── */}
      <Dialog open={payDialog.open} onOpenChange={(open) => !open && setPayDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[760px] bg-card border-border shadow-xl rounded-2xl p-6">
          <form onSubmit={handlePaymentSubmit}>
            <DialogHeader className="text-left mb-4">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                {dialogHistory.length > 0 ? 'Receive More Payment' : 'Receive Payment'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Recording instalment <span className="font-semibold text-foreground">#{dialogHistory.length + 1}</span> for{' '}
                <span className="font-semibold text-foreground">{formPoNumber}</span>.
              </DialogDescription>
            </DialogHeader>

            {/* Payment progress summary */}
            {dialogBillAmt > 0 && (
              <div className="mb-5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-border space-y-3">
                <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>Bill Amount</span>
                  <span className="text-foreground">{fmt(dialogBillAmt)}</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${dialogProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${dialogProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Paid so far: {fmt(dialogTotalPaid)}</span>
                  <span className={`font-semibold ${dialogBalance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Balance: {fmt(dialogBalance)}
                  </span>
                </div>

                {/* Instalment history inside dialog */}
                {dialogHistory.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Previous Payments
                    </p>
                    {dialogHistory.map((inst, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px]">
                        <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-muted-foreground flex-1">{formatDate(inst.date)}</span>
                        <span className="font-semibold text-foreground">{fmt(inst.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 py-2">
              {/* Vendor */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground pl-0.5">Vendor*</Label>
                <Select value={formVendor} onValueChange={setFormVendor}>
                  <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                    <SelectValue placeholder="Select Vendor" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {vendors.map((v) => (
                      <SelectItem key={v.id || v.name} value={v.name} className="text-xs focus:bg-accent cursor-pointer">{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PO Number read-only */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground pl-0.5">PO Number</Label>
                <Input value={formPoNumber} readOnly className="rounded-xl bg-neutral-100 dark:bg-neutral-800 border-input cursor-not-allowed text-xs h-10" />
              </div>

              {/* Location */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground pl-0.5">Location*</Label>
                <Select value={formLocation} onValueChange={setFormLocation}>
                  <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {locations.map((loc) => (
                      <SelectItem key={loc} value={loc} className="text-xs focus:bg-accent cursor-pointer">{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Address */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground pl-0.5">Address*</Label>
                <Input
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Address"
                  className="rounded-xl bg-background border-input text-xs h-10"
                  required
                />
              </div>

              {/* Billing Amount */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground pl-0.5">Billing Amount (INR)*</Label>
                <Input
                  type="number" min="1" step="0.01"
                  value={formBillingAmount}
                  onChange={(e) => setFormBillingAmount(e.target.value)}
                  placeholder="Total bill amount"
                  className="rounded-xl bg-background border-input text-xs h-10"
                  required
                />
              </div>

              {/* Amount received now */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground pl-0.5">
                  Amount Received Now (INR)*
                  {dialogBalance !== null && dialogBalance > 0 && (
                    <span className="ml-2 text-rose-500 font-normal">max: {fmt(dialogBalance)}</span>
                  )}
                </Label>
                <Input
                  type="number" min="1"
                  max={dialogBalance ?? undefined}
                  step="0.01"
                  value={formPaymentAmount}
                  onChange={(e) => setFormPaymentAmount(e.target.value)}
                  placeholder={`Enter instalment #${dialogHistory.length + 1} amount`}
                  className="rounded-xl bg-background border-input text-xs h-10 focus:ring-2 focus:ring-emerald-500/30"
                  required
                />
                <p className="text-[11px] text-muted-foreground pl-0.5">
                  This will be saved as instalment <span className="font-semibold text-foreground">#{dialogHistory.length + 1}</span>.
                  You can add more later until the balance is cleared.
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => setPayDialog({ open: false, item: null })} className="border-border hover:bg-accent rounded-xl cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer gap-1.5 disabled:opacity-60">
                <Banknote className="h-4 w-4" />{isSaving ? 'Saving...' : `Record Instalment #${dialogHistory.length + 1}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />Payment Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">Full payment record and instalment history.</DialogDescription>
          </DialogHeader>
          {detailDialog.item && (() => {
            const di = detailDialog.item;
            const dStatus = paymentStatusLocal(di);
            const dPaid = totalPaidLocal(di);
            const dBill = Number(di.billAmount);
            const dBalance = dBill > 0 ? Math.max(0, dBill - dPaid) : null;
            const dProgress = dBill > 0 ? Math.min(100, (dPaid / dBill) * 100) : 0;
            const dHistory = parseHistory(di);

            return (
              <div className="space-y-4 py-3">
                {[
                  { label: 'PO Number', value: di.poNumber },
                  { label: 'Vendor', value: di.vendorName },
                  { label: 'Location', value: di.location },
                  { label: 'Address', value: di.address || '—' },
                  { label: 'Planned 7', value: formatDate(di.planned7) },
                  { label: 'Updated By', value: di.updatedBy || '—' },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between text-sm gap-4">
                    <span className="text-muted-foreground shrink-0">{row.label}</span>
                    <span className="font-medium text-foreground text-right">{row.value}</span>
                  </div>
                ))}

                {/* Payment summary */}
                <div className="pt-3 border-t border-border space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Summary</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bill Amount</span>
                    <span className="font-semibold text-foreground">{dBill ? fmt(dBill) : '—'}</span>
                  </div>
                  {dBill > 0 && (
                    <>
                      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full transition-all ${dProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${dProgress}%` }} />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600 dark:text-blue-400">Total Paid</span>
                        <span className="font-semibold text-blue-700 dark:text-blue-300">{fmt(dPaid)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={dBalance === 0 ? 'text-emerald-600' : 'text-rose-600'}>Balance Due</span>
                        <span className={`font-semibold ${dBalance === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{fmt(dBalance)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <span className={`font-semibold ${dStatus === 'fullyPaid' ? 'text-emerald-600' : dStatus === 'partial' ? 'text-blue-600' : 'text-amber-600'}`}>
                          {dStatus === 'fullyPaid' ? 'Fully Paid ✅' : dStatus === 'partial' ? 'Partial' : 'Pending'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Instalment timeline */}
                {dHistory.length > 0 && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Instalment History ({dHistory.length} payment{dHistory.length > 1 ? 's' : ''})
                    </p>
                    <div className="space-y-2">
                      {dHistory.map((inst, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </div>
                          <div className="flex-1 flex justify-between text-xs">
                            <span className="text-muted-foreground">{formatDate(inst.date)}</span>
                            <span className="font-semibold text-foreground">{fmt(inst.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDetailDialog({ open: false, item: null })} className="border-border hover:bg-accent rounded-xl cursor-pointer">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
