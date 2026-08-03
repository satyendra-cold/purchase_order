import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/useToast';
import { useSheetData } from '@/hooks/useSheetData';
import { insertRow } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  CreditCard,
  MapPin,
  CalendarClock,
  Eye,
  Banknote,
  CheckCircle2,
  Clock,
  Pencil,
  CheckSquare,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';

import { makeTimestamp, formatDisplayDate, hasValue } from '@/utils/dateUtils';

// ─── Helpers ─────────────────────────────────────────────────────────

const formatDate = (isoString) => {
  return formatDisplayDate(isoString, true);
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

  const handleSheetError = (msg) => {
    toast(msg || 'Sheet synchronization failed', 'error');
  };

  const [fmsData, , loadingFms] = useSheetData('FMS', 'poNumber', { onError: handleSheetError });
  const [paymentHistoryData, setPaymentHistoryData, loadingHistory] = useSheetData('payment history', '_row', { onError: handleSheetError });
  const [vendors] = useSheetData('Vendors', 'id');
  const [locationData] = useSheetData('Locations', 'name');

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [payDialog, setPayDialog] = useState({ open: false, item: null, isEdit: false, editingRowId: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, item: null });
  const [isSaving, setIsSaving] = useState(false);

  // Selection Mode state (tracked by unique Google Sheets physical row ID _row)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Payment form state
  const [formVendor, setFormVendor] = useState('');
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formBillingAmount, setFormBillingAmount] = useState('');
  const [formPaymentAmount, setFormPaymentAmount] = useState('');

  const isDeleted = (r) => String(r['Delete Status'] || r.deleteStatus || '').trim().toLowerCase() === 'deleted';

  // Vendor options from Vendors sheet + FMS data so vendor details are always available
  const vendorOptions = useMemo(() => {
    const set = new Set();
    vendors.forEach((v) => {
      if (v.name) set.add(v.name);
      else if (typeof v === 'string') set.add(v);
    });
    fmsData.forEach((r) => {
      if (r.vendorName) set.add(r.vendorName);
    });
    return Array.from(set).sort();
  }, [vendors, fmsData]);

  // Location options from Locations sheet + FMS data so location details are always available
  const locationOptions = useMemo(() => {
    const set = new Set();
    locationData.forEach((l) => {
      if (l.name) set.add(l.name);
      else if (typeof l === 'string') set.add(l);
    });
    fmsData.forEach((r) => {
      if (r.location) set.add(r.location);
    });
    return Array.from(set).sort();
  }, [locationData, fmsData]);

  // Map FMS data by PO number for robust Bill Amount fallbacks
  const fmsByPo = useMemo(() => {
    const map = {};
    fmsData.forEach((r) => {
      if (r.poNumber) map[String(r.poNumber).trim()] = r;
    });
    return map;
  }, [fmsData]);

  // Robust Bill Amount resolution for History records
  const getBillAmount = (row) => {
    const direct = row['Bill Amount'] ?? row.billAmount;
    if (direct != null && direct !== '' && !isNaN(Number(direct)) && Number(direct) > 0) {
      return Number(direct);
    }
    const poNo = String(row['PO Number'] || row.poNumber || '').trim();
    if (poNo && fmsByPo[poNo]) {
      const fmsBill = Number(fmsByPo[poNo].billAmount);
      if (fmsBill > 0) return fmsBill;
    }
    return null;
  };

  // Total received per PO — used for Received/Balance column in pending tab and remaining balance calculation
  const receivedByPo = useMemo(() => {
    const map = {};
    paymentHistoryData.forEach((r) => {
      const po = String(r['PO Number'] || r.poNumber || '').trim();
      if (!po) return;
      map[po] = (map[po] || 0) + Number(r['Received Amount'] ?? r.receivedAmount ?? 0);
    });
    return map;
  }, [paymentHistoryData]);

  // Qualification for Pending: planned7 set, not deleted, and NOT fully paid (totalReceived < billAmount)
  const qualifiesPending = (row) => {
    if (!hasValue(row.planned7) || isDeleted(row)) return false;
    const poNo = String(row.poNumber || '').trim();
    const bill = Number(row.billAmount) || 0;
    const received = receivedByPo[poNo] || 0;
    // Once total received reaches or exceeds bill amount (when bill > 0), PO is completed and removed from pending
    if (bill > 0 && received >= bill) return false;
    return true;
  };

  // ── Compute max allowable payment for current dialog ───────────────
  const remainingBalance = useMemo(() => {
    if (!payDialog.open) return 0;
    const poNo = String(formPoNumber || '').trim();
    const totalBill = Number(formBillingAmount || (payDialog.item && payDialog.item.billAmount) || 0);

    if (payDialog.isEdit && payDialog.editingRowId != null) {
      // In edit mode, exclude the current payment record's existing received amount
      const currentRecordAmount = Number(payDialog.item?.['Received Amount'] ?? payDialog.item?.receivedAmount ?? 0);
      const otherReceived = (receivedByPo[poNo] || 0) - currentRecordAmount;
      return Math.max(0, totalBill - otherReceived);
    }

    const totalReceived = receivedByPo[poNo] || 0;
    return Math.max(0, totalBill - totalReceived);
  }, [payDialog, formPoNumber, formBillingAmount, receivedByPo]);

  // ── Open payment dialog for new entry ────────────────────────────
  const handleOpenPayment = (item) => {
    setFormVendor(item.vendorName || '');
    setFormPoNumber(item.poNumber || '');
    setFormLocation(item.location || '');
    setFormAddress(item.address || '');
    setFormBillingAmount(item.billAmount != null ? String(item.billAmount) : '');
    setFormPaymentAmount('');
    setPayDialog({ open: true, item, isEdit: false, editingRowId: null });
  };

  // ── Open payment dialog for editing history record ────────────────
  const handleOpenEdit = (row) => {
    const bill = getBillAmount(row) ?? (row['Bill Amount'] != null ? Number(row['Bill Amount']) : null);
    setFormVendor(row['Vendor Name'] || row.vendorName || '');
    setFormPoNumber(row['PO Number'] || row.poNumber || '');
    setFormLocation(row['Location'] || row.location || '');
    setFormAddress(row['Address'] || row.address || '');
    setFormBillingAmount(bill != null ? String(bill) : '');
    setFormPaymentAmount(
      row['Received Amount'] != null
        ? String(row['Received Amount'])
        : (row.receivedAmount != null ? String(row.receivedAmount) : '')
    );
    setPayDialog({ open: true, item: row, isEdit: true, editingRowId: row._row });
  };

  // ── Submit payment (create or edit) ──────────────────────────────
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!payDialog.item && !payDialog.isEdit) return;

    const amountToAdd = Number(formPaymentAmount);
    if (!amountToAdd || amountToAdd <= 0) {
      toast('Please enter a valid payment amount.', 'error');
      return;
    }
    const billAmt = Number(formBillingAmount || (payDialog.item && payDialog.item.billAmount) || 0);
    if (!billAmt || billAmt <= 0) {
      toast('Please enter a valid billing amount.', 'error');
      return;
    }

    // Overpayment validation
    if (remainingBalance > 0 && amountToAdd > remainingBalance) {
      toast(`Payment amount (₹${amountToAdd.toLocaleString('en-IN')}) cannot exceed remaining balance of ₹${remainingBalance.toLocaleString('en-IN')}.`, 'error');
      return;
    }

    const nowTimestamp = makeTimestamp();

    if (payDialog.isEdit) {
      const targetRowId = payDialog.editingRowId;
      setIsSaving(true);
      try {
        const updated = paymentHistoryData.map((r) => {
          if (r._row === targetRowId) {
            return {
              ...r,
              'PO Number': formPoNumber,
              poNumber: formPoNumber,
              'Vendor Name': formVendor,
              vendorName: formVendor,
              'Bill Amount': billAmt,
              billAmount: billAmt,
              'Received Amount': amountToAdd,
              receivedAmount: amountToAdd,
              'Location': formLocation,
              location: formLocation,
              'Address': formAddress,
              address: formAddress,
            };
          }
          return r;
        });
        await setPaymentHistoryData(updated);
        toast(`Payment record updated successfully.`, 'success');
        setPayDialog({ open: false, item: null, isEdit: false, editingRowId: null });
      } catch (err) {
        toast(`Failed to update payment: ${err.message}`, 'error');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // New payment entry
    const instalmentNo = paymentHistoryData.filter(
      (r) => String(r['PO Number'] || r.poNumber || '').trim() === String(formPoNumber).trim()
    ).length + 1;

    const paymentNo = `PH-${String(paymentHistoryData.length + 1).padStart(3, '0')}`;
    const serialNo  = `SN-${String(instalmentNo).padStart(3, '0')}`;

    setPayDialog({ open: false, item: null, isEdit: false, editingRowId: null });
    setIsSaving(true);

    try {
      await insertRow('payment history', [
        nowTimestamp,
        paymentNo,
        serialNo,
        formPoNumber,
        formVendor,
        billAmt,
        amountToAdd,
      ]);

      const newRecord = {
        'Timestamp': nowTimestamp,
        'Payment No': paymentNo,
        'Serial NO': serialNo,
        'PO Number': formPoNumber,
        'Vendor Name': formVendor,
        'Bill Amount': billAmt,
        'Received Amount': amountToAdd,
        location: formLocation,
        address: formAddress,
      };
      await setPaymentHistoryData((prev) => [newRecord, ...prev]);

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
    let list = fmsData.filter(qualifiesPending);
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
  }, [fmsData, searchTerm, receivedByPo]);

  const historyItems = useMemo(() => {
    let list = [...paymentHistoryData].reverse(); // latest first
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((r) =>
        String(r['PO Number'] || r.poNumber || '').toLowerCase().includes(q) ||
        String(r['Vendor Name'] || r.vendorName || '').toLowerCase().includes(q) ||
        String(r['Payment No'] || r.paymentNo || '').toLowerCase().includes(q) ||
        String(r['Serial NO'] || r['Serial No'] || r.serialNo || '').toLowerCase().includes(q) ||
        String(r['Payment Type'] || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [paymentHistoryData, searchTerm]);

  const displayCount = activeTab === 'pending' ? pendingItems.length : historyItems.length;

  const counts = useMemo(() => ({
    pending: fmsData.filter(qualifiesPending).length,
    history: paymentHistoryData.length,
    totalBillAmount: fmsData.filter(qualifiesPending).reduce((s, r) => s + (Number(r.billAmount) || 0), 0),
  }), [fmsData, paymentHistoryData, receivedByPo]);

  // ── Selection mode handlers using unique _row ─────────────────────
  const isAllSelected = useMemo(() => {
    return historyItems.length > 0 && historyItems.every((r) => selectedRowIds.includes(r._row));
  }, [historyItems, selectedRowIds]);

  const handleSelectAll = (checked) => {
    if (checked) {
      const allVisibleRowIds = historyItems.map((r) => r._row).filter((id) => id != null);
      setSelectedRowIds(Array.from(new Set([...selectedRowIds, ...allVisibleRowIds])));
    } else {
      const visibleRowIdSet = new Set(historyItems.map((r) => r._row));
      setSelectedRowIds(selectedRowIds.filter((id) => !visibleRowIdSet.has(id)));
    }
  };

  const handleToggleSelect = (rowId) => {
    setSelectedRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((x) => x !== rowId) : [...prev, rowId]
    );
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedRowIds([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedRowIds.length === 0) return;
    setIsDeleting(true);
    try {
      const selectedSet = new Set(selectedRowIds);
      const updated = paymentHistoryData.filter((r) => !selectedSet.has(r._row));
      await setPaymentHistoryData(updated);
      toast(`Successfully deleted ${selectedRowIds.length} payment record(s).`, 'success');
      setSelectedRowIds([]);
      setIsSelectionMode(false);
      setDeleteConfirmOpen(false);
    } catch (err) {
      toast(`Failed to delete payments: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="text-left">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          Payment Processing
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">
          Record vendor payments and manage payment processing history.
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

          {/* Tabs & Select Mode Button */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/60 p-1 rounded-xl">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSearchTerm('');
                    if (tab.key !== 'history') {
                      setIsSelectionMode(false);
                      setSelectedRowIds([]);
                    }
                  }}
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

            {activeTab === 'history' && (
              !isSelectionMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSelectionMode(true)}
                  className="h-8 rounded-xl text-xs font-semibold gap-1.5 border-border hover:bg-accent cursor-pointer"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Select
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelSelection}
                  className="h-8 rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel Selection
                </Button>
              )
            )}
          </div>
        </CardHeader>

        {/* Selection Toolbar Action Bar */}
        {activeTab === 'history' && isSelectionMode && (
          <div className="px-4 md:px-6 py-2.5 bg-neutral-50 dark:bg-neutral-900/40 border-b border-border flex items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3 text-xs font-semibold text-foreground">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {selectedRowIds.length} selected
              </span>
              {selectedRowIds.length === 0 && (
                <span className="text-muted-foreground font-normal hidden sm:inline">Select records below to delete</span>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedRowIds.length === 0}
              onClick={() => setDeleteConfirmOpen(true)}
              className="h-8 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected {selectedRowIds.length > 0 ? `(${selectedRowIds.length})` : ''}
            </Button>
          </div>
        )}

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
                    <TH>PO Quantity</TH>
                    <TH>Pending Quantity</TH>
                    <TH>Canceled Quantity</TH>
                    <TH>Location</TH>
                    <TH>Bill Amount</TH>
                    <TH>Received / Balance</TH>
                    <TH>Planned</TH>
                    <TH>Updated By</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingFms ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-xs font-semibold text-foreground/80 animate-pulse">
                            Fetching transaction data from Google Sheets…
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pendingItems.length > 0 ? (
                    pendingItems.map((item) => {
                      const received = receivedByPo[String(item.poNumber)] || 0;
                      const bill = Number(item.billAmount) || 0;
                      const balance = bill > 0 ? Math.max(0, bill - received) : null;
                      return (
                        <TableRow key={item.poNumber} className="hover:bg-accent/40 border-b border-border transition-colors">
                          <TableCell className="pl-4 md:pl-6 py-4 text-left">
                            <div className="flex items-center gap-1.5">
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
                          <TableCell className="px-3 py-4 font-bold text-xs sm:text-sm text-foreground">
                            {Number(item.totalQuantity || item['Total Quantity'] || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="px-3 py-4 font-semibold text-xs sm:text-sm text-foreground">
                            {(item['Pending Qty'] != null && item['Pending Qty'] !== '')
                              ? Number(item['Pending Qty']).toLocaleString()
                              : (item.pendingQty != null && item.pendingQty !== '' ? Number(item.pendingQty).toLocaleString() : '0')}
                          </TableCell>
                          <TableCell className="px-3 py-4 font-semibold text-xs sm:text-sm text-foreground">
                            {(item['Cancel Qty'] != null && item['Cancel Qty'] !== '')
                              ? Number(item['Cancel Qty']).toLocaleString()
                              : (item.cancelQty != null && item.cancelQty !== '' ? Number(item.cancelQty).toLocaleString() : '0')}
                          </TableCell>

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
                            {item.updatedBy ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3.5 w-3.5 shrink-0" />{item.updatedBy}
                              </span>
                            ) : <span className="text-xs text-muted-foreground italic">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={11} className="py-16 text-center">
                        <EmptyState message="No pending payment records." />
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
                    {isSelectionMode ? (
                      <TableHead className="w-[50px] py-3 text-center pl-4">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all transactions"
                        />
                      </TableHead>
                    ) : (
                      <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left pl-4 md:pl-6 w-[90px]">
                        Actions
                      </TableHead>
                    )}
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
                  {loadingHistory ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-xs font-semibold text-foreground/80 animate-pulse">
                            Fetching transaction data from Google Sheets…
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : historyItems.length > 0 ? (
                    historyItems.map((row) => {
                      const rowId = row._row;
                      const isSelected = selectedRowIds.includes(rowId);
                      const billAmt = getBillAmount(row);

                      return (
                        <TableRow key={rowId} className={`hover:bg-accent/40 border-b border-border transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                          {isSelectionMode ? (
                            <TableCell className="text-center pl-4 py-4 w-[50px]">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleSelect(rowId)}
                                aria-label={`Select transaction ${rowId}`}
                              />
                            </TableCell>
                          ) : (
                            <TableCell className="pl-4 md:pl-6 py-4 text-left w-[90px]">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(row)}
                                className="h-7 px-2.5 text-[11px] rounded-lg gap-1 border-border hover:bg-accent text-foreground cursor-pointer"
                                title="Edit Payment"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                Edit
                              </Button>
                            </TableCell>
                          )}
                          <TableCell className="px-3 py-4 text-xs text-muted-foreground whitespace-nowrap">
                            {row['Timestamp'] || row.timestamp || '—'}
                          </TableCell>
                          <TableCell className="px-3 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {row['Payment No'] || row.paymentNo || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {row['Serial NO'] || row['Serial No'] || row.serialNo || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-4 font-semibold text-primary text-xs sm:text-sm">
                            {row['PO Number'] || row.poNumber || '—'}
                          </TableCell>
                          <TableCell className="px-3 py-4 text-xs sm:text-sm text-foreground font-medium">
                            {row['Vendor Name'] || row.vendorName || '—'}
                          </TableCell>
                          <TableCell className="px-3 py-4 text-xs sm:text-sm font-semibold text-foreground">
                            {billAmt != null ? fmt(billAmt) : '—'}
                          </TableCell>
                          <TableCell className="px-3 py-4">
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              {row['Received Amount'] != null || row.receivedAmount != null ? fmt(Number(row['Received Amount'] ?? row.receivedAmount)) : '—'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="py-16 text-center">
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

      {/* ── Receive / Edit Payment Dialog ─────────────────────────────────── */}
      <Dialog open={payDialog.open} onOpenChange={(open) => !open && setPayDialog({ open: false, item: null, isEdit: false, editingRowId: null })}>
        <DialogContent
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-[700px] bg-card border-border shadow-xl rounded-2xl p-6"
        >
          <form onSubmit={handlePaymentSubmit}>
            <DialogHeader className="text-left mb-5">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                {payDialog.isEdit ? 'Edit Payment Record' : 'Receive Payment'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {payDialog.isEdit
                  ? `Editing payment record for ${formPoNumber}.`
                  : `Recording payment for ${formPoNumber}.`}
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
                    {vendorOptions.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs focus:bg-accent cursor-pointer">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PO Number */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground">PO Number</Label>
                <Input
                  value={formPoNumber}
                  onChange={(e) => payDialog.isEdit && setFormPoNumber(e.target.value)}
                  readOnly={!payDialog.isEdit}
                  className={`rounded-xl border-input text-xs h-10 ${!payDialog.isEdit ? 'bg-neutral-100 dark:bg-neutral-800 cursor-not-allowed' : 'bg-background'}`}
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-muted-foreground">Location*</Label>
                <Select value={formLocation} onValueChange={setFormLocation}>
                  <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {locationOptions.map((loc) => (
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

              {/* Amount received with Overpayment Validation */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">Amount Received (INR)*</Label>
                  {remainingBalance > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Max: ₹{remainingBalance.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  min="0.01"
                  max={remainingBalance > 0 ? remainingBalance : undefined}
                  step="0.01"
                  value={formPaymentAmount}
                  onChange={(e) => setFormPaymentAmount(e.target.value)}
                  placeholder="Enter amount received"
                  className={`rounded-xl bg-background border-input text-xs h-10 ${
                    formPaymentAmount !== '' && remainingBalance > 0 && Number(formPaymentAmount) > remainingBalance
                      ? 'border-rose-500 focus-visible:ring-rose-500'
                      : ''
                  }`}
                  required
                />
                {formPaymentAmount !== '' && remainingBalance > 0 && Number(formPaymentAmount) > remainingBalance && (
                  <p className="text-[11px] text-rose-500 font-medium mt-1">
                    Amount cannot exceed remaining balance of ₹{remainingBalance.toLocaleString('en-IN')}.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => setPayDialog({ open: false, item: null, isEdit: false, editingRowId: null })} className="border-border hover:bg-accent rounded-xl cursor-pointer">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || (formPaymentAmount !== '' && remainingBalance > 0 && Number(formPaymentAmount) > remainingBalance)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Banknote className="h-4 w-4" />
                {isSaving ? 'Saving...' : (payDialog.isEdit ? 'Save Changes' : 'Record Payment')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-[420px] bg-card border-border shadow-xl rounded-2xl p-6"
        >
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Payment Records
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you want to permanently delete {selectedRowIds.length} selected payment transaction(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
              className="border-border hover:bg-accent rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer gap-1.5 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete Selected'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, item: null })}>
        <DialogContent
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-[460px] bg-card border-border shadow-xl rounded-2xl p-6"
        >
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
