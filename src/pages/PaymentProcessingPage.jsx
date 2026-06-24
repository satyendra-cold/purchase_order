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
  CalendarCheck2,
  Eye,
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
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
];

// ─── Component ──────────────────────────────────────────────────────

export function PaymentProcessingPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Load consolidated FMS sheet directly
  const [fmsData, setFmsData] = useSheetData('FMS', 'poNumber');

  // Related configuration data
  const [vendors] = useSheetData('Vendors', 'id');
  const [locationData] = useSheetData('Locations', 'name');
  const locations = locationData.map(l => l.name);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, item: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, item: null });

  // Payment Processing form state
  const [formVendor, setFormVendor] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formBillingAmount, setFormBillingAmount] = useState('');

  // ── Pending   = planned7 (col AN) NOT null  AND  actual7 (col AO) IS empty
  // ── Completed = planned7 (col AN) NOT null  AND  actual7 (col AO) NOT empty
  const isPending = (row) => hasValue(row.planned7) && !hasValue(row.actual7);
  const isCompleted = (row) => hasValue(row.planned7) && hasValue(row.actual7);

  // ── Open modal for processing payment ────────────────────────────
  const handleOpenProcessPayment = (item) => {
    setFormVendor(item.vendorName || '');
    setFormPoNumber(item.poNumber || '');
    setFormLocation(item.location || '');
    setFormAddress(item.address || '');
    setFormBillingAmount(item.billAmount !== undefined && item.billAmount !== null ? String(item.billAmount) : '');

    setConfirmDialog({ open: true, item });
  };

  // ── Confirm Payment Form Submission ──────────────────────────────────
  const handleConfirmPaymentSubmit = (e) => {
    e.preventDefault();
    const item = confirmDialog.item;
    if (!item) return;

    const nowTimestamp = makeTimestamp(); // M/D/YYYY H:mm:ss format
    const userName = currentUser ? currentUser.name || currentUser.username : 'System';

    // Update FMS directly
    const updated = fmsData.map((r) =>
      r.poNumber === item.poNumber
        ? {
            ...r,
            vendorName: formVendor.trim(),
            location: formLocation,
            address: formAddress.trim(),
            billAmount: formBillingAmount ? Number(formBillingAmount) : null,
            actual7: nowTimestamp,
            updatedBy: userName,
          }
        : r
    );
    setFmsData(updated);

    toast(`Payment for ${formPoNumber} processed successfully!`, 'success');
    setConfirmDialog({ open: false, item: null });
  };

  // ── Filtered & searched list ───────────────────────────────────────
  const filteredItems = useMemo(() => {
    // Only show items where planned7 (col AN) has a value
    let list = fmsData.filter((r) => hasValue(r.planned7));

    if (activeTab === 'pending') list = list.filter(isPending);
    else if (activeTab === 'completed') list = list.filter(isCompleted);

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
    const staged = fmsData.filter((r) => hasValue(r.planned7));
    return {
      all: staged.length,
      pending: staged.filter(isPending).length,
      completed: staged.filter(isCompleted).length,
    };
  }, [fmsData]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Payment Processing
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Process and finalize vendor payments. This is the final stage of the procurement pipeline.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Payments</p>
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
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Processed</p>
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
                placeholder="Search payments…"
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
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Location</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Address</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Billing Amount</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Planned 7 (AN)</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Actual 7 (AO)</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Delay 7 (AP)</TableHead>
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
                          {!hasValue(item.actual7) && (
                            <Button onClick={() => handleOpenProcessPayment(item)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm">
                              <CreditCard className="h-3.5 w-3.5" />Process Payment
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pl-4 md:pl-6 py-4 text-left font-semibold text-primary text-xs sm:text-sm">{item.poNumber}</TableCell>
                      <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">{item.vendorName}</TableCell>
                      <TableCell className="py-4 text-left">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />{item.location}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-left text-xs sm:text-sm text-foreground">{item.address || '—'}</TableCell>
                      <TableCell className="py-4 text-left font-medium text-foreground">
                        {item.billAmount !== null && item.billAmount !== undefined ? `₹${item.billAmount.toLocaleString('en-IN')}` : '—'}
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />{formatDate(item.planned7)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        {hasValue(item.actual7) ? (
                          <span className="text-xs sm:text-sm text-foreground flex items-center gap-1">
                            <CalendarCheck2 className="h-3.5 w-3.5 text-emerald-500" />{formatDate(item.actual7)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not yet</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        {hasValue(item.actual7) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />Processed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="h-3 w-3" />Pending
                          </span>
                        )}
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="p-3 bg-primary/5 rounded-full"><CreditCard className="h-8 w-8 text-primary/40" /></div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground/70">No payment records</p>
                          <p className="text-xs">
                            No records match your current filters.
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

      {/* Process Payment Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border shadow-xl rounded-2xl p-6">
          <form onSubmit={handleConfirmPaymentSubmit}>
            <DialogHeader className="text-left mb-4">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />Process Payment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Enter payment details. This will stamp Actual 7 (col AO) in the FMS sheet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Vendor Selection */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="vendor" className="text-xs font-semibold text-muted-foreground pl-0.5">
                  Vendor*
                </Label>
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

              {/* PO Number */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="poNumber" className="text-xs font-semibold text-muted-foreground pl-0.5">
                  PO Number*
                </Label>
                <Input
                  id="poNumber"
                  value={formPoNumber}
                  readOnly
                  className="rounded-xl bg-neutral-100 dark:bg-neutral-800 border-input cursor-not-allowed text-xs h-10"
                  required
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="location" className="text-xs font-semibold text-muted-foreground pl-0.5">
                  Location*
                </Label>
                <Select value={formLocation} onValueChange={setFormLocation}>
                  <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {locations.map((loc) => (
                      <SelectItem key={loc} value={loc} className="text-xs focus:bg-accent cursor-pointer">
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Address */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="address" className="text-xs font-semibold text-muted-foreground pl-0.5">
                  Address*
                </Label>
                <Input
                  id="address"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Address"
                  className="rounded-xl bg-background border-input text-xs h-10"
                  required
                />
              </div>

              {/* Billing Amount */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="billingAmount" className="text-xs font-semibold text-muted-foreground pl-0.5">
                  Billing Amount (INR)*
                </Label>
                <Input
                  id="billingAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formBillingAmount}
                  onChange={(e) => setFormBillingAmount(e.target.value)}
                  placeholder="Enter billing amount"
                  className="rounded-xl bg-background border-input text-xs h-10"
                  required
                />
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmDialog({ open: false, item: null })} className="border-border hover:bg-accent rounded-xl cursor-pointer">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer gap-1.5">
                <CreditCard className="h-4 w-4" />Confirm Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />Payment Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">Full details for this payment record.</DialogDescription>
          </DialogHeader>
          {detailDialog.item && (
            <div className="space-y-3 py-3">
              {[
                { label: 'PO Number', value: detailDialog.item.poNumber },
                { label: 'Vendor', value: detailDialog.item.vendorName },
                { label: 'Quantity', value: detailDialog.item.totalQuantity?.toLocaleString() },
                { label: 'Location', value: detailDialog.item.location },
                { label: 'Address', value: detailDialog.item.address || '—' },
                { label: 'Billing Amount', value: detailDialog.item.billAmount !== null && detailDialog.item.billAmount !== undefined ? `₹${detailDialog.item.billAmount.toLocaleString('en-IN')}` : '—' },
                { label: 'Planned 7 (AN)', value: formatDate(detailDialog.item.planned7) },
                { label: 'Actual 7 (AO)', value: hasValue(detailDialog.item.actual7) ? formatDate(detailDialog.item.actual7) : 'Not yet' },
                { label: 'Status', value: hasValue(detailDialog.item.actual7) ? 'Processed' : 'Pending' },
                { label: 'Delay 7 (AP)', value: hasValue(detailDialog.item.actual7) ? (detailDialog.item.delay7 === 0 ? 'On time' : `${detailDialog.item.delay7} day(s)`) : '—' },
                { label: 'Updated By', value: detailDialog.item.updatedBy || '—' },
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
