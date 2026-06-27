import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/useToast';
import { useSheetData } from '@/hooks/useSheetData';
import { insertRow } from '@/services/api';
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
  User,
  Timer,
  CreditCard,
  MapPin,
  CalendarClock,
  Eye,
  Banknote,
  CheckCircle2,
  Clock,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────

const formatDate = (isoString) => {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
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
  n != null && !isNaN(Number(n)) ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'history', label: 'History' },
];

const TH = ({ children }) => (
  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left px-3">
    {children}
  </TableHead>
);

// ─── Component ───────────────────────────────────────────────────────

export function PaymentProcessingPage() {
  const { toast } = useToast();

  const [fmsData] = useSheetData('FMS', 'poNumber');
  const [paymentHistoryData] = useSheetData('payment history', null);
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

  // Total received per PO — used for Received/Balance column in pending tab
  const receivedByPo = useMemo(() => {
    const map = {};
    paymentHistoryData.forEach((r) => {
      const po = String(r['PO Number'] || '').trim();
      if (!po) return;
      map[po] = (map[po] || 0) + Number(r['Received Amount'] || 0);
    });
    return map;
  }, [paymentHistoryData]);

  // ── Open payment dialog ───────────────────────────────────────────
  const handleOpenPayment = (item) => {
    setFormVendor(item.vendorName || '');
    setFormPoNumber(item.poNumber || '');
    setFormLocation(item.location || '');
    setFormAddress(item.address || '');
    setFormBillingAmount(item.billAmount != null ? String(item.billAmount) : '');
    setFormPaymentAmount('');
    setPayDialog({ open: true, item });
  };

  // ── Submit payment ────────────────────────────────────────────────
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!payDialog.item) return;

    const amountToAdd = Number(formPaymentAmount);
    if (!amountToAdd || amountToAdd <= 0) {
      toast('Please enter a valid payment amount.', 'error');
      return;
    }
    const billAmt = Number(formBillingAmount || payDialog.item.billAmount || 0);
    if (!billAmt || billAmt <= 0) {
      toast('Please enter a valid billing amount.', 'error');
      return;
    }
    const nowTimestamp = makeTimestamp();

    const instalmentNo = paymentHistoryData.filter(
      (r) => String(r['PO Number'] || '').trim() === String(formPoNumber).trim()
    ).length + 1;

    const paymentNo = `PH-${String(paymentHistoryData.length + 1).padStart(3, '0')}`;
    const serialNo  = `SN-${String(instalmentNo).padStart(3, '0')}`;

    setPayDialog({ open: false, item: null });
    setIsSaving(true);

    try {
      // Columns: Timestamp | Payment No | Serial No | PO Number | Vendor Name | Bill Amount | Received Amount
      await insertRow('payment history', [
        nowTimestamp,
        paymentNo,
        serialNo,
        formPoNumber,
        formVendor,
        billAmt,
        amountToAdd,
      ]);


      toast(
        `Payment ${paymentNo} of ₹${amountToAdd.toLocaleString('en-IN')} recorded for ${formPoNumber}.`,
        'success'
      );
    } catch (err) {
      toast(`Failed to save payment: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Filtered data per tab ─────────────────────────────────────────
  const pendingItems = useMemo(() => {
    let list = fmsData.filter(qualifies);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((r) =>
        String(r.poNumber || '').toLowerCase().includes(q) ||
        String(r.vendorName || '').toLowerCase().includes(q) ||
        String(r.location || '').toLowerCase().includes(q) ||
        String(r.updatedBy || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [fmsData, searchTerm]);

  const historyItems = useMemo(() => {
    let list = [...paymentHistoryData].reverse(); // latest first
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((r) =>
        String(r['PO Number'] || '').toLowerCase().includes(q) ||
        String(r['Vendor Name'] || '').toLowerCase().includes(q) ||
        String(r['Payment No'] || '').toLowerCase().includes(q) ||
        String(r['Serial NO'] || '').toLowerCase().includes(q) ||
        String(r['Payment Type'] || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [paymentHistoryData, searchTerm]);

  const displayCount = activeTab === 'pending' ? pendingItems.length : historyItems.length;

  const counts = useMemo(() => ({
    pending: fmsData.filter(qualifies).length,
    history: paymentHistoryData.length,
    totalBillAmount: fmsData.filter(qualifies).reduce((s, r) => s + (Number(r.billAmount) || 0), 0),
  }), [fmsData, paymentHistoryData]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="text-left">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          Payment Processing
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">
          Record vendor payments. Every entry is logged to the payment history sheet.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Bill</p>
              <p className="text-base font-bold text-foreground truncate">{fmt(counts.totalBillAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pending POs</p>
              <p className="text-base font-bold text-amber-700 dark:text-amber-300 truncate">{counts.pending}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Payments Logged</p>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 truncate">{counts.history}</p>
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
                placeholder="Search…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background h-9 text-xs sm:text-sm max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground hidden md:inline-block">
              {displayCount} record(s)
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/60 p-1 rounded-xl self-end sm:self-center">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearchTerm(''); }}
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
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            {/* ── Pending Tab Table ── */}
            {activeTab === 'pending' && (
              <Table>
                <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                  <TableRow>
                    <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">Actions</TableHead>
                    <TH>PO Number</TH>
                    <TH>Vendor</TH>
                    <TH>Location</TH>
                    <TH>Bill Amount</TH>
                    <TH>Received / Balance</TH>
                    <TH>Planned 7</TH>
                    <TH>Delay 7</TH>
                    <TH>Updated By</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingItems.length > 0 ? pendingItems.map((item) => {
                    const received = receivedByPo[String(item.poNumber)] || 0;
                    const bill = Number(item.billAmount) || 0;
                    const balance = bill > 0 ? Math.max(0, bill - received) : null;
                    return (
                      <TableRow key={item.poNumber} className="hover:bg-accent/40 border-b border-border transition-colors">
                        <TableCell className="pl-4 md:pl-6 py-4 text-left">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => setDetailDialog({ open: true, item })}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              onClick={() => handleOpenPayment(item)}
                              className={`gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm text-white ${
                                received > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                              }`}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              {received > 0 ? 'Add Payment' : 'Receive Payment'}
                            </Button>
                          </div>
                        </TableCell>

                        <TableCell className="px-3 py-4 font-semibold text-primary text-xs sm:text-sm">{item.poNumber}</TableCell>
                        <TableCell className="px-3 py-4 text-xs sm:text-sm font-medium text-foreground">{item.vendorName}</TableCell>

                        <TableCell className="px-3 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                            <MapPin className="h-2.5 w-2.5 text-muted-foreground" />{item.location}
                          </span>
                        </TableCell>

                        <TableCell className="px-3 py-4 text-xs sm:text-sm font-semibold text-foreground">
                          {bill ? fmt(bill) : '—'}
                        </TableCell>

                        <TableCell className="px-3 py-4 min-w-[160px]">
                          {bill > 0 ? (
                            <div className="space-y-1.5">
                              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                                  style={{ width: `${Math.min(100, (received / bill) * 100)}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-blue-600 dark:text-blue-400">Rcvd: {fmt(received)}</span>
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">Bal: {fmt(balance)}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>

                        <TableCell className="px-3 py-4">
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" />{formatDate(item.planned7)}
                          </span>
                        </TableCell>

                        <TableCell className="px-3 py-4">
                          {hasValue(item.actual7) ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${delayBadgeClass(item.delay7)}`}>
                              <Timer className="h-3 w-3" />{item.delay7 === 0 ? 'On time' : `${item.delay7} day(s)`}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>

                        <TableCell className="px-3 py-4">
                          {item.updatedBy ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3.5 w-3.5 shrink-0" />{item.updatedBy}
                            </span>
                          ) : <span className="text-xs text-muted-foreground italic">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center">
                        <EmptyState />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {/* ── History Tab Table ── */}
            {activeTab === 'history' && (
              <Table>
                <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                  <TableRow>
                    <TH>Timestamp</TH>
                    <TH>Payment No</TH>
                    <TH>Serial No</TH>
                    <TH>PO Number</TH>
                    <TH>Vendor Name</TH>
                    <TH>Bill Amount</TH>
                    <TH>Received Amount</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyItems.length > 0 ? historyItems.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-accent/40 border-b border-border transition-colors">
                      <TableCell className="px-3 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {row['Timestamp'] || '—'}
                      </TableCell>
                      <TableCell className="px-3 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                          {row['Payment No'] || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {row['Serial NO'] || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-4 font-semibold text-primary text-xs sm:text-sm">
                        {row['PO Number'] || '—'}
                      </TableCell>
                      <TableCell className="px-3 py-4 text-xs sm:text-sm text-foreground font-medium">
                        {row['Vendor Name'] || '—'}
                      </TableCell>
                      <TableCell className="px-3 py-4 text-xs sm:text-sm font-semibold text-foreground">
                        {row['Bill Amount'] ? fmt(Number(row['Bill Amount'])) : '—'}
                      </TableCell>
                      <TableCell className="px-3 py-4">
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          {row['Received Amount'] ? fmt(Number(row['Received Amount'])) : '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center">
                        <EmptyState message="No payment entries yet." />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Receive Payment Dialog ────────────────────────────────────────── */}
      <Dialog open={payDialog.open} onOpenChange={(open) => !open && setPayDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[700px] bg-card border-border shadow-xl rounded-2xl p-6">
          <form onSubmit={handlePaymentSubmit}>
            <DialogHeader className="text-left mb-5">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />Receive Payment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Recording payment for <span className="font-semibold text-foreground">{formPoNumber}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 py-2">
              {/* Vendor */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground">Vendor*</Label>
                <Select value={formVendor} onValueChange={setFormVendor}>
                  <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                    <SelectValue placeholder="Select Vendor" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {vendors.map((v) => (
                      <SelectItem key={v.id || v.name} value={v.name} className="text-xs focus:bg-accent cursor-pointer">
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PO Number read-only */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground">PO Number</Label>
                <Input value={formPoNumber} readOnly className="rounded-xl bg-neutral-100 dark:bg-neutral-800 border-input cursor-not-allowed text-xs h-10" />
              </div>

              {/* Location */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground">Location*</Label>
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
                <Label className="text-xs font-semibold text-muted-foreground">Address*</Label>
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
                <Label className="text-xs font-semibold text-muted-foreground">Billing Amount (INR)*</Label>
                <Input
                  type="number" min="1" step="0.01"
                  value={formBillingAmount}
                  onChange={(e) => setFormBillingAmount(e.target.value)}
                  placeholder="Total bill amount"
                  className="rounded-xl bg-background border-input text-xs h-10"
                  required
                />
              </div>

              {/* Amount received */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground">Amount Received (INR)*</Label>
                <Input
                  type="number" min="1" step="0.01"
                  value={formPaymentAmount}
                  onChange={(e) => setFormPaymentAmount(e.target.value)}
                  placeholder="Enter amount received"
                  className="rounded-xl bg-background border-input text-xs h-10"
                  required
                />
              </div>


            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => setPayDialog({ open: false, item: null })} className="border-border hover:bg-accent rounded-xl cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer gap-1.5 disabled:opacity-60">
                <Banknote className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[460px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />PO Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">Purchase order information.</DialogDescription>
          </DialogHeader>
          {detailDialog.item && (
            <div className="space-y-3 py-3">
              {[
                { label: 'PO Number',   value: detailDialog.item.poNumber },
                { label: 'Vendor',      value: detailDialog.item.vendorName },
                { label: 'Location',    value: detailDialog.item.location },
                { label: 'Address',     value: detailDialog.item.address || '—' },
                { label: 'Bill Amount', value: detailDialog.item.billAmount ? fmt(Number(detailDialog.item.billAmount)) : '—' },
                { label: 'Planned 7',   value: formatDate(detailDialog.item.planned7) },
                { label: 'Updated By',  value: detailDialog.item.updatedBy || '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between text-sm gap-4">
                  <span className="text-muted-foreground shrink-0">{row.label}</span>
                  <span className="font-medium text-foreground text-right">{row.value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDetailDialog({ open: false, item: null })} className="border-border hover:bg-accent rounded-xl cursor-pointer">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ message = 'No records match your current filters.' }) {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <div className="p-3 bg-primary/5 rounded-full">
        <CreditCard className="h-8 w-8 text-primary/40" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground/70">No records</p>
        <p className="text-xs">{message}</p>
      </div>
    </div>
  );
}
