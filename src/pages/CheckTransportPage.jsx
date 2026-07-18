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
  Truck,
  MapPin,
  Map,
  CalendarClock,
  Eye,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────

const formatDate = (isoString) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
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

/** true if val is not null / not empty string */
const hasValue = (val) => val != null && String(val).trim() !== '';

/** Current timestamp in M/D/YYYY H:mm:ss — matches FMS sheet format */
const makeTimestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const TABS = [
  { key: 'pending',   label: 'Pending' },
  { key: 'history',   label: 'History' },
];

// ─── Component ──────────────────────────────────────────────────────

export function CheckTransportPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // FMS is the single source of truth — same as ReadyProductPage / CreateBillPage
  const [fmsData, setFmsData] = useSheetData('FMS', 'poNumber');

  // Locations & Transporters from master sheet
  const [locationData] = useSheetData('Locations', 'name');
  const locations = locationData.map((l) => l.name);
  const [transporters] = useSheetData('Transporters', 'id');

  // UI state
  const [searchTerm, setSearchTerm]     = useState('');
  const [activeTab, setActiveTab]       = useState('pending');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, item: null });
  const [detailDialog, setDetailDialog]   = useState({ open: false, item: null });

  // Confirm dialog form fields
  const [transporterName, setTransporterName] = useState('');
  const [editQuantity,    setEditQuantity]    = useState('');
  const [editLocation,    setEditLocation]    = useState('');
  const [editAddress,     setEditAddress]     = useState('');

  // ── Pending   = planned3 (col W) NOT null  AND  actual3 (col X) IS empty
  // ── Completed = planned3 (col W) NOT null  AND  actual3 (col X) NOT empty
  const isPending   = (row) => hasValue(row.planned3) && !hasValue(row.actual3);
  const isCompleted = (row) => hasValue(row.planned3) &&  hasValue(row.actual3);

  // ── Mark transport as verified ─────────────────────────────────────
  const handleMarkComplete = (item) => {
    const nowTimestamp = makeTimestamp(); // M/D/YYYY H:mm:ss format
    const userName = currentUser ? currentUser.name || currentUser.username : 'System';

    const updated = fmsData.map((r) =>
      r.poNumber === item.poNumber
        ? {
            ...r,
            actual3:          nowTimestamp,
            transporterName:  transporterName.trim(),
            quantity:         parseInt(editQuantity, 10) || r.quantity || r.totalQuantity,
            deliveryLocation: editLocation,
            deliveryAddress:  editAddress.trim(),
            updatedBy:        userName,
          }
        : r
    );
    setFmsData(updated);

    toast(`Transport for ${item.poNumber} verified!`, 'success');
    setConfirmDialog({ open: false, item: null });
  };

  // ── Filtered & searched list ───────────────────────────────────────
  const filteredItems = useMemo(() => {
    // Only show rows that have planned3 set (are in the "Check Transport" stage)
    let list = fmsData.filter((r) => hasValue(r.planned3));

    if (activeTab === 'pending')   list = list.filter(isPending);
    else if (activeTab === 'history') list = list.filter(isCompleted);

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.poNumber       || '').toLowerCase().includes(q) ||
          String(r.vendorName     || '').toLowerCase().includes(q) ||
          String(r.location       || '').toLowerCase().includes(q) ||
          String(r.transporterName|| '').toLowerCase().includes(q) ||
          String(r.updatedBy      || '').toLowerCase().includes(q)
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmsData, activeTab, searchTerm]);

  const counts = useMemo(() => {
    const staged = fmsData.filter((r) => hasValue(r.planned3));
    const pendingCount = staged.filter(isPending).length;
    const historyCount = staged.filter(isCompleted).length;
    return {
      all:       staged.length,
      pending:   pendingCount,
      history:   historyCount,
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
            Check Transport
          </h1>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Transports</p>
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
          {/* Left: search + record count */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search transports…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background h-9 text-xs sm:text-sm max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground hidden md:inline-block">
              {filteredItems.length} record(s)
            </div>
          </div>

          {/* Right: status tabs */}
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
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">Actions</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">PO Number</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Vendor</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Transporter</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Location</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Planned</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Updated By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <TableRow key={item.poNumber} className="hover:bg-accent/40 border-b border-border transition-colors">
                      {/* Actions */}
                      <TableCell className="pl-4 md:pl-6 py-4 text-left">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailDialog({ open: true, item })}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                            title="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {!hasValue(item.actual3) && (
                            <Button
                              onClick={() => {
                                setTransporterName(item.transporterName || '');
                                setEditQuantity(String(item.quantity || item.totalQuantity || ''));
                                setEditLocation(item.deliveryLocation || item.location || '');
                                setEditAddress(item.deliveryAddress || item.address || '');
                                setConfirmDialog({ open: true, item });
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-[11px] rounded-xl px-3 h-8 cursor-pointer shadow-sm"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              Transport Verified
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      {/* PO Number */}
                      <TableCell className="pl-4 md:pl-6 py-4 text-left font-semibold text-primary text-xs sm:text-sm">
                        {item.poNumber}
                      </TableCell>

                      {/* Vendor */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">
                        {item.vendorName}
                      </TableCell>

                      {/* Transporter */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground">
                        {hasValue(item.transporterName) ? (
                          <span className="font-medium text-foreground">{item.transporterName}</span>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </TableCell>

                      {/* Location */}
                      <TableCell className="py-4 text-left">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                          {item.deliveryLocation || item.location}
                        </span>
                      </TableCell>

                      {/* Planned 3 (col W) */}
                      <TableCell className="py-4 text-left">
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(item.planned3)}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-4 text-left">
                        {hasValue(item.actual3) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="h-3 w-3" />Pending
                          </span>
                        )}
                      </TableCell>

                      {/* Updated By */}
                      <TableCell className="py-4 text-left">
                        {hasValue(item.updatedBy) ? (
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.updatedBy}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="p-3 bg-primary/5 rounded-full">
                          <Truck className="h-8 w-8 text-primary/40" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground/70">No transport records</p>
                          <p className="text-xs">
                            {counts.all === 0
                              ? 'No records with Planned 3 (col W) set. Rows appear here once planned3 is filled in the FMS sheet.'
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

      {/* ── Confirm Transport Verified Dialog ──────────────────────── */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, item: null })}>
        <DialogContent className="w-[92vw] sm:max-w-[400px] bg-card border-border shadow-xl rounded-2xl p-4 max-h-[88vh] overflow-y-auto">
          <DialogHeader className="text-left mb-1">
            <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-500" />
              Confirm Transport Verified
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Fill in transport details to stamp Actual 3 and save to FMS sheet.
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.item && (
            <div className="space-y-3 py-1">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs px-0.5">
                <span className="text-muted-foreground">PO Number</span>
                <span className="font-semibold text-primary text-right truncate">{confirmDialog.item.poNumber}</span>
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium text-right truncate">{confirmDialog.item.vendorName}</span>
                <span className="text-muted-foreground">Planned 3</span>
                <span className="font-medium text-right">{formatDate(confirmDialog.item.planned3)}</span>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  Transporter Name*
                </Label>
                <Select value={transporterName} onValueChange={setTransporterName}>
                  <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-9">
                    <SelectValue placeholder="Select a transporter" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {transporters.map((t) => (
                      <SelectItem key={t.id} value={t.name} className="text-xs focus:bg-accent cursor-pointer">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Quantity*</Label>
                <Input
                  type="number"
                  min="1"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="rounded-xl bg-background border-input text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Delivery Location*
                </Label>
                <Select value={editLocation} onValueChange={setEditLocation}>
                  <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-9">
                    <SelectValue placeholder="Select location" />
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

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Map className="h-3 w-3" />
                  Delivery Address*
                </Label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Enter delivery address..."
                  className="w-full min-w-0 rounded-xl border border-input bg-transparent px-3 py-1.5 text-xs shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                  rows="2"
                  required
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  This will write Actual 3 (col X) and transport details to the FMS sheet.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-3 gap-2 flex-row justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, item: null })}
              className="border-border hover:bg-accent rounded-xl cursor-pointer text-xs h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmDialog.item && handleMarkComplete(confirmDialog.item)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer gap-1.5 text-xs h-9 px-4"
            >
              <Truck className="h-3.5 w-3.5" />
              Confirm Verified
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail View Dialog ──────────────────────────────────────── */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Transport Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Full details for this transport record.
            </DialogDescription>
          </DialogHeader>

          {detailDialog.item && (
            <div className="space-y-3 py-3">
              {[
                { label: 'PO Number',        value: detailDialog.item.poNumber },
                { label: 'Vendor',           value: detailDialog.item.vendorName },
                { label: 'Total Quantity',   value: detailDialog.item.totalQuantity?.toLocaleString() },
                { label: 'Dispatch Qty',     value: detailDialog.item.quantity?.toLocaleString() || '—' },
                { label: 'Location',         value: detailDialog.item.location },
                { label: 'Delivery Location',value: detailDialog.item.deliveryLocation || '—' },
                { label: 'Delivery Address', value: detailDialog.item.deliveryAddress || '—' },
                { label: 'Transporter',      value: detailDialog.item.transporterName || '—' },
                { label: 'Planned 3 (W)',    value: formatDate(detailDialog.item.planned3) },
                { label: 'Actual 3 (X)',     value: hasValue(detailDialog.item.actual3) ? formatDate(detailDialog.item.actual3) : 'Not yet' },
                { label: 'Status',           value: isCompleted(detailDialog.item) ? 'Completed' : 'Pending' },
                { label: 'Delay 3 (Y)',      value: isCompleted(detailDialog.item) ? ((detailDialog.item.delay3 || 0) === 0 ? 'On time' : `${detailDialog.item.delay3} day(s)`) : '—' },
                { label: 'Updated By',       value: detailDialog.item.updatedBy || '—' },
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
              onClick={() => setDetailDialog({ open: false, item: null })}
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
