import { useState, useMemo } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  Trash2, 
  Search, 
  MapPin, 
  User, 
  Clock, 
  FileText, 
  ShoppingBag,
  FilePlus2
} from 'lucide-react';

export function DeletedPOsPage() {
  const [fmsData, , loading] = useSheetData('FMS', 'Serial No');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter only soft-deleted PO records
  const deletedOrders = useMemo(() => {
    return fmsData.filter(item => {
      const status = String(item['Delete Status'] || item.deleteStatus || '').trim().toLowerCase();
      return status === 'deleted';
    });
  }, [fmsData]);

  // Compute metrics
  const totalDeletedCount = deletedOrders.length;
  const totalDeletedQuantity = useMemo(() => {
    return deletedOrders.reduce((sum, item) => {
      const q = Number(item.totalQuantity || item['Total Quantity'] || 0);
      return sum + (isNaN(q) ? 0 : q);
    }, 0);
  }, [deletedOrders]);

  // Search filter
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return deletedOrders;
    const q = searchTerm.toLowerCase();
    return deletedOrders.filter(item =>
      String(item['Serial No'] || item.serialNo || '').toLowerCase().includes(q) ||
      String(item.poNumber || item['PO Number'] || '').toLowerCase().includes(q) ||
      String(item.vendorName || item['Vendor Name'] || '').toLowerCase().includes(q) ||
      String(item.location || item['Location'] || '').toLowerCase().includes(q) ||
      String(item.createdBy || item['Created By'] || '').toLowerCase().includes(q)
    );
  }, [deletedOrders, searchTerm]);

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    const s = String(ts);
    if (/^\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}$/.test(s)) return s;
    try {
      const d = new Date(s);
      if (isNaN(d)) return s;
      const pad = n => String(n).padStart(2, '0');
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return s;
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300 pb-12 text-left">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
            <Trash2 className="h-7 w-7 text-rose-600 dark:text-rose-400" />
            Deleted Purchase Orders
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Audit log of purchase orders soft-deleted from the system.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Total Deleted Records */}
        <Card className="border-border bg-card shadow-sm rounded-2xl relative overflow-hidden">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Deleted POs</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{totalDeletedCount}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Records marked as Deleted in FMS</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Canceled Quantity */}
        <Card className="border-border bg-card shadow-sm rounded-2xl relative overflow-hidden">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Deleted Units</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{totalDeletedQuantity.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sum of quantity in deleted orders</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main Table View */}
      <Card className="border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="py-4 px-4 md:px-6 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by Serial No, PO Number, Vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background h-9 text-xs sm:text-sm max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground hidden md:inline-block">
              {filteredList.length} record(s)
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                <TableRow>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">Serial No</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">PO Number</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Vendor Name</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Total Quantity</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Location</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Address</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Created By</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">PO Received Date</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                      Loading deleted purchase orders...
                    </TableCell>
                  </TableRow>
                ) : filteredList.length > 0 ? (
                  filteredList.map((item, idx) => {
                    const serialNo = item['Serial No'] || item.serialNo || '-';
                    const poNum = item.poNumber || item['PO Number'] || '-';
                    const vendor = item.vendorName || item['Vendor Name'] || '-';
                    const qty = Number(item.totalQuantity || item['Total Quantity'] || 0);
                    const loc = item.location || item['Location'] || '-';
                    const addr = item.address || item['Address'] || '-';
                    const createdBy = item.createdBy || item['Created By'] || '-';
                    const receivedDate = item.poReceivedDate || item['PO Received Date'] || formatTimestamp(item.timestamp);

                    return (
                      <TableRow key={item._row || serialNo || idx} className="hover:bg-accent/40 border-b border-border transition-colors">
                        <TableCell className="pl-4 md:pl-6 py-4 text-left text-xs sm:text-sm font-mono text-muted-foreground">
                          {serialNo}
                        </TableCell>
                        <TableCell className="py-4 text-left font-semibold text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                          {poNum}
                        </TableCell>
                        <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">
                          {vendor}
                        </TableCell>
                        <TableCell className="py-4 text-left font-bold text-xs sm:text-sm text-foreground">
                          {qty.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-4 text-left">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                            <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                            {loc}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-left text-xs text-muted-foreground max-w-[150px] truncate" title={addr}>
                          {addr}
                        </TableCell>
                        <TableCell className="py-4 text-left">
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {createdBy}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-left">
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {receivedDate}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-left">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30">
                            <Trash2 className="h-2.5 w-2.5" />
                            Deleted
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                      No deleted purchase orders found.
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
