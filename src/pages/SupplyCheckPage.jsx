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
  ClipboardCheck,
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

export function SupplyCheckPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Consolidated FMS sheet
  const [fmsData, setFmsData] = useSheetData('FMS', 'poNumber');

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, item: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, item: null });

  // ── Pending   = planned5 (col AH) NOT null  AND  actual5 (col AI) IS empty
  // ── Completed = planned5 (col AH) NOT null  AND  actual5 (col AI) NOT empty
  const isPending = (row) => hasValue(row.planned5) && !hasValue(row.actual5);
  const isCompleted = (row) => hasValue(row.planned5) && hasValue(row.actual5);

  // ── Mark as supply checked ─────────────────────────────────────────
  const handleMarkComplete = (item) => {
    const nowTimestamp = makeTimestamp(); // M/D/YYYY H:mm:ss format
    const userName = currentUser ? currentUser.name || currentUser.username : 'System';

    // Update FMS directly
    const updated = fmsData.map((r) =>
      r.poNumber === item.poNumber
        ? {
            ...r,
            actual5: nowTimestamp,
            updatedBy: userName,
          }
        : r
    );
    setFmsData(updated);

    toast(`Supply check for ${item.poNumber} completed!`, 'success');
    setConfirmDialog({ open: false, item: null });
  };

  // ── Filtered & searched list ───────────────────────────────────────
  const filteredItems = useMemo(() => {
    // Only show items where planned5 (col AH) has a value
    let list = fmsData.filter((r) => hasValue(r.planned5));

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
    const staged = fmsData.filter((r) => hasValue(r.planned5));
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
            Supply Check
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Perform physical checks and verify received supply items against purchase orders.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Checks</p>
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
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Checked</p>
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
                placeholder="Search supply checks…"
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
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Planned 5 (AH)</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Actual 5 (AI)</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Delay 5 (AJ)</TableHead>
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
                          {!hasValue(item.actual5) && (
                            <Button onClick={() => setConfirmDialog({ open: true, item })} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm">
                              <ClipboardCheck className="h-3.5 w-3.5" />Verify Supply
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
                      <TableCell className="py-4 text-left">
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />{formatDate(item.planned5)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        {hasValue(item.actual5) ? (
                          <span className="text-xs sm:text-sm text-foreground flex items-center gap-1">
                            <CalendarCheck2 className="h-3.5 w-3.5 text-emerald-500" />{formatDate(item.actual5)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not yet</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        {hasValue(item.actual5) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />Checked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="h-3 w-3" />Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-left">
                        {hasValue(item.actual5) ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${delayBadgeClass(item.delay5)}`}>
                            <Timer className="h-3 w-3" />{item.delay5 === 0 ? 'On time' : `${item.delay5} day(s)`}
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
                    <TableCell colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="p-3 bg-primary/5 rounded-full"><ClipboardCheck className="h-8 w-8 text-primary/40" /></div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground/70">No supply check records</p>
                          <p className="text-xs font-normal">
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

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" />Verify Received Supply
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              This will mark the received supply as checked and stamp Actual 5 (col AI).
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
                <span className="text-muted-foreground">Planned 5 (AH)</span>
                <span className="font-medium">{formatDate(confirmDialog.item.planned5)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Verified By</span>
                <span className="font-medium">{currentUser ? currentUser.name || currentUser.username : 'System'}</span>
              </div>
              <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />This will record Actual 5 (col AI) on the FMS sheet.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, item: null })} className="border-border hover:bg-accent rounded-xl cursor-pointer">Cancel</Button>
            <Button onClick={() => confirmDialog.item && handleMarkComplete(confirmDialog.item)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer gap-1.5">
              <ClipboardCheck className="h-4 w-4" />Verify Received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />Supply Check Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">Full details for this supply check record.</DialogDescription>
          </DialogHeader>
          {detailDialog.item && (
            <div className="space-y-3 py-3">
              {[
                { label: 'PO Number', value: detailDialog.item.poNumber },
                { label: 'Vendor', value: detailDialog.item.vendorName },
                { label: 'Quantity', value: detailDialog.item.totalQuantity?.toLocaleString() },
                { label: 'Location', value: detailDialog.item.location },
                { label: 'Address', value: detailDialog.item.address },
                { label: 'Planned 5 (AH)', value: formatDate(detailDialog.item.planned5) },
                { label: 'Actual 5 (AI)', value: hasValue(detailDialog.item.actual5) ? formatDate(detailDialog.item.actual5) : 'Not yet' },
                { label: 'Status', value: hasValue(detailDialog.item.actual5) ? 'Checked' : 'Pending' },
                { label: 'Delay 5 (AJ)', value: hasValue(detailDialog.item.actual5) ? (detailDialog.item.delay5 === 0 ? 'On time' : `${detailDialog.item.delay5} day(s)`) : '—' },
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
