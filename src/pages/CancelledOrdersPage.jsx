import { useState, useMemo } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  XCircle, 
  Search, 
  RefreshCw, 
  Package, 
  ShoppingBag, 
  Building2,
  Calendar,
  Layers
} from 'lucide-react';

const formatDate = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d)) return val;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return val;
  }
};

export function CancelledOrdersPage() {
  const [cancelData, , loading, refetch] = useSheetData('Cancel', 'Timestamp');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!Array.isArray(cancelData)) return [];
    if (!searchTerm.trim()) return cancelData;

    const q = searchTerm.toLowerCase();
    return cancelData.filter((item) =>
      String(item['PO Number'] || item.poNumber || '').toLowerCase().includes(q) ||
      String(item['Vendor Name'] || item.vendorName || '').toLowerCase().includes(q) ||
      String(item['Stage Name'] || item.stageName || '').toLowerCase().includes(q) ||
      String(item['Serial No'] || item.serialNo || '').toLowerCase().includes(q)
    );
  }, [cancelData, searchTerm]);

  const stats = useMemo(() => {
    if (!Array.isArray(cancelData)) return { totalRecords: 0, totalCancelQty: 0, uniquePOs: 0 };

    const totalRecords = cancelData.length;
    const totalCancelQty = cancelData.reduce((sum, item) => {
      const q = Number(item['Cancel Qty'] || item.cancelQty || 0);
      return sum + (isNaN(q) ? 0 : q);
    }, 0);
    const poSet = new Set(cancelData.map((item) => item['PO Number'] || item.poNumber).filter(Boolean));

    return {
      totalRecords,
      totalCancelQty,
      uniquePOs: poSet.size,
    };
  }, [cancelData]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
            <XCircle className="h-7 w-7 text-rose-500" />
            Canceled Orders
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            View all canceled purchase order quantities across stages.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={loading}
          className="self-start sm:self-auto border-border rounded-xl gap-2 text-xs cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Cancel Records
              </p>
              <p className="text-xl font-bold text-foreground">{stats.totalRecords}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Package className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Canceled Quantity
              </p>
              <p className="text-xl font-bold text-foreground">{stats.totalCancelQty.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Unique POs Canceled
              </p>
              <p className="text-xl font-bold text-foreground">{stats.uniquePOs}</p>
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
                placeholder="Search canceled orders…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background h-9 text-xs sm:text-sm max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground hidden md:inline-block">
              {filteredData.length} record(s)
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                <TableRow>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">
                    Timestamp
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Serial No
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    PO Number
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">
                    Vendor Name
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-right">
                    Total Quantity
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left pl-6">
                    Stage Name
                  </TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pr-4 md:pr-6 py-3 text-right">
                    Cancel Qty
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                      Loading canceled records…
                    </TableCell>
                  </TableRow>
                ) : filteredData.length > 0 ? (
                  filteredData.map((item, idx) => {
                    const ts = item['Timestamp'] || item.timestamp || '—';
                    const serial = item['Serial No'] || item.serialNo || '—';
                    const po = item['PO Number'] || item.poNumber || '—';
                    const vendor = item['Vendor Name'] || item.vendorName || '—';
                    const totQty = Number(item['Total Quantity'] || item.totalQuantity || 0);
                    const stage = item['Stage Name'] || item.stageName || '—';
                    const canQty = Number(item['Cancel Qty'] || item.cancelQty || 0);

                    return (
                      <TableRow key={idx} className="hover:bg-accent/40 border-b border-border transition-colors">
                        <TableCell className="pl-4 md:pl-6 py-4 text-left text-xs text-muted-foreground font-mono">
                          {ts}
                        </TableCell>
                        <TableCell className="py-4 text-left text-xs font-semibold text-foreground">
                          {serial}
                        </TableCell>
                        <TableCell className="py-4 text-left font-semibold text-primary text-xs sm:text-sm">
                          {po}
                        </TableCell>
                        <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">
                          {vendor}
                        </TableCell>
                        <TableCell className="py-4 text-right text-xs sm:text-sm font-medium text-foreground">
                          {totQty ? totQty.toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="py-4 text-left pl-6">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                            <Layers className="h-2.5 w-2.5" />
                            {stage}
                          </span>
                        </TableCell>
                        <TableCell className="pr-4 md:pr-6 py-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
                            {canQty ? canQty.toLocaleString() : '0'}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="p-3 bg-rose-500/10 rounded-full">
                          <XCircle className="h-8 w-8 text-rose-500/60" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground/70">No canceled orders found</p>
                          <p className="text-xs">No records match your search or exist in the Cancel sheet.</p>
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
    </div>
  );
}
