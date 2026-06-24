import { useState, useRef } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSheetData } from '@/hooks/useSheetData';
import { insertRow, uploadFile } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  Plus, 
  Search, 
  MapPin, 
  User, 
  Clock, 
  Trash2, 
  Copy, 
  Map, 
  AlertCircle,
  ShoppingBag,
  FilePlus2,
  Edit2
} from 'lucide-react';

export function GeneratePOPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Sheet-backed lists
  const [purchaseOrders, setPurchaseOrders, , refetchPOs] = useSheetData('FMS', 'poNumber');
  const [locationData, setLocationData] = useSheetData('Locations', 'name');
  const [vendors] = useSheetData('Vendors', 'id');
  const locationNames = locationData.map(l => l.name);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog / Modal Visibility & Mode Control
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOriginalPoNumber, setEditingOriginalPoNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // poNumber to delete

  // Form Fields
  const [poNumber, setPoNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [poReceivedDate, setPoReceivedDate] = useState('');
  const [poExpiredDate, setPoExpiredDate] = useState('');
  const [poPdf, setPoPdf] = useState(null);
  const [poPdfName, setPoPdfName] = useState('');

  // Inline location creator states (within modal Form)
  const [isAddingLocInline, setIsAddingLocInline] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [locError, setLocError] = useState('');

  // Get active vendors list
  const activeVendors = vendors;

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      // strip "data:<mime>;base64," prefix — Apps Script needs raw base64
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const makeTimestamp = () => {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // Open modal for creating new PO
  const handleOpenAddPoModal = () => {
    setIsEditing(false);
    setPoNumber('');
    setEditingOriginalPoNumber('');
    setVendorName('');
    setTotalQuantity('');
    setLocation('');
    setAddress('');
    setPoReceivedDate('');
    setPoExpiredDate('');
    setPoPdf(null);
    setPoPdfName('');
    setIsAddingLocInline(false);
    setNewLocationInput('');
    setLocError('');
    setIsFormOpen(true);
  };

  // Open modal for editing existing PO
  const handleOpenEditPoModal = (po) => {
    setIsEditing(true);
    setPoNumber(po.poNumber);
    setEditingOriginalPoNumber(po.poNumber);
    setVendorName(po.vendorName);
    setTotalQuantity(String(po.totalQuantity));
    setLocation(po.location);
    setAddress(po.address);
    setPoReceivedDate(po.poReceivedDate || po.timestamp?.split('T')[0] || '');
    setPoExpiredDate(po.poExpiredDate || '');
    setPoPdfName(po.poPdfName || '');
    setPoPdf(null);
    setIsAddingLocInline(false);
    setNewLocationInput('');
    setLocError('');
    setIsFormOpen(true);
  };

  // Handle vendor dropdown changes
  const handleVendorChange = (selectedName) => {
    setVendorName(selectedName);
  };

  // Inline location creator submit
  const handleAddLocationInline = (e) => {
    e.preventDefault();
    setLocError('');

    const formattedLoc = newLocationInput.trim().toUpperCase();
    if (!formattedLoc) {
      setLocError('Location name cannot be empty.');
      return;
    }

    if (locationNames.map(l => l.toUpperCase()).includes(formattedLoc)) {
      setLocError('Location constant already exists.');
      return;
    }

    setLocationData([...locationData, { name: formattedLoc }]);
    setLocation(formattedLoc); // auto-select the location
    setIsAddingLocInline(false);
    setNewLocationInput('');
    toast(`Location constant "${formattedLoc}" added!`, 'success');
  };

  // Submit PO form (supports Create and Edit)
  const handleSubmitPo = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!poNumber.trim()) { toast('Please enter a PO Number.', 'error'); return; }

    if (!isEditing) {
      const poExists = purchaseOrders.some(
        po => String(po.poNumber || '').trim().toLowerCase() === poNumber.trim().toLowerCase()
      );
      if (poExists) { toast(`PO Number "${poNumber.trim()}" is already in use.`, 'error'); return; }
    }

    if (!vendorName.trim()) { toast('Please enter a Vendor name.', 'error'); return; }

    const qty = parseInt(totalQuantity, 10);
    if (isNaN(qty) || qty <= 0) { toast('Total Quantity must be a valid positive integer.', 'error'); return; }

    if (!location) { toast('Please enter a Location.', 'error'); return; }
    if (!address.trim()) { toast('Please enter the Address.', 'error'); return; }

    if (isEditing && poNumber.trim().toLowerCase() !== editingOriginalPoNumber.trim().toLowerCase()) {
      const poExists = purchaseOrders.some(
        po => String(po.poNumber || '').trim().toLowerCase() === poNumber.trim().toLowerCase()
      );
      if (poExists) { toast(`PO Number "${poNumber.trim()}" is already in use.`, 'error'); return; }
    }

    // ── Lock (ref = synchronous, state = UI) ─────────────────────────────────
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (isEditing) {
        setIsFormOpen(false); // close immediately

        let updatedPoPdfName = poPdfName;
        if (poPdf) {
          toast('Uploading PDF...', 'info');
          const base64 = await readFileAsBase64(poPdf);
          const res = await uploadFile(base64, poPdf.name, poPdf.type || 'application/pdf', '1Hzz1nxg1A_rDaigFZ6ZMxpB2-AzSmIhM');
          updatedPoPdfName = res.fileUrl || poPdfName;
        }

        const editTimestamp = makeTimestamp();

        const updatedPOs = purchaseOrders.map(po =>
          po.poNumber === editingOriginalPoNumber
            ? { ...po, poNumber: poNumber.trim(), vendorName: vendorName.trim(), totalQuantity: qty, location, address: address.trim(), poReceivedDate, poExpiredDate, poPdfName: updatedPoPdfName, timestamp: editTimestamp }
            : po
        );
        setPurchaseOrders(updatedPOs);
        toast(`Purchase Order ${poNumber.trim()} updated successfully!`, 'success');
      } else {
        // ── Create: close form immediately, submit in background ──────────────
        const createdBy = currentUser ? (currentUser.name || currentUser.username) : 'System';
        const existingSerials = purchaseOrders
          .map(po => parseInt(po.serialNo || 0, 10))
          .filter(n => !isNaN(n) && n > 0);
        const nextSerialNo = existingSerials.length > 0 ? Math.max(...existingSerials) + 1 : 1;

        const timestamp = makeTimestamp();

        // Close form right away so user sees the page
        setIsFormOpen(false);

        let poPdfUrl = '';
        if (poPdf) {
          toast('Uploading PDF...', 'info');
          const base64 = await readFileAsBase64(poPdf);
          const res = await uploadFile(base64, poPdf.name, poPdf.type || 'application/pdf', '1Hzz1nxg1A_rDaigFZ6ZMxpB2-AzSmIhM');
          poPdfUrl = res.fileUrl || '';
        }

        const rowData = [
          timestamp,
          nextSerialNo,
          poNumber.trim(),
          vendorName.trim(),
          qty,
          location,
          address.trim(),
          createdBy,
          poReceivedDate,
          poExpiredDate,
          poPdfUrl,
        ];

        await insertRow('FMS', rowData);
        toast(`Purchase Order ${poNumber.trim()} saved!`, 'success');
        refetchPOs();
      }
    } catch (err) {
      toast(`Failed: ${err.message}`, 'error');
      console.error('[GeneratePO] submit failed:', err);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Delete PO Record
  const confirmDelete = () => {
    if (!deleteTarget) return;
    setPurchaseOrders(purchaseOrders.filter(po => po.poNumber !== deleteTarget));
    toast(`Purchase Order ${deleteTarget} deleted successfully.`, 'success');
    setDeleteTarget(null);
  };

  // Copy PO details to clipboard
  const handleCopyPo = (po) => {
    const details = `PO Number: ${po.poNumber}\nVendor: ${po.vendorName}\nQty: ${po.totalQuantity}\nLocation: ${po.location}\nAddress: ${po.address}\nCreated By: ${po.createdBy}\nDate: ${po.poReceivedDate || formatTimestamp(po.timestamp)}\nExpired: ${po.poExpiredDate || '-'}\nPDF: ${po.poPdfName || '-'}`;
    navigator.clipboard.writeText(details)
      .then(() => toast(`Copied details of ${po.poNumber} to clipboard!`, 'success'))
      .catch(() => toast('Failed to copy text', 'error'));
  };

  // Format Date Helper — output: M/D/YYYY H:mm:ss
  const formatTimestamp = (ts) => {
    if (!ts) return '';
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

  // Filter purchase orders
  const filteredPOs = purchaseOrders.filter(po =>
    String(po.poNumber   || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(po.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(po.location   || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(po.createdBy  || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Generate Purchase Order
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Audit existing purchase orders, add custom locations, and generate official records.
          </p>
        </div>
      </div>

      {/* Main Table View Card (Full Width) */}
      <Card className="border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="py-4 px-4 md:px-6 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search POs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background h-9 text-xs sm:text-sm max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground hidden md:inline-block">
              Total: {filteredPOs.length} record(s)
            </div>
          </div>

          <Button
            onClick={handleOpenAddPoModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 self-end sm:self-center rounded-xl cursor-pointer shadow-sm text-xs sm:text-sm py-2 px-4 h-9"
          >
            <Plus className="h-4 w-4" />
            Add PO
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                <TableRow>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">Actions</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">#</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">PO Number</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Vendor Name</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Total Quantity</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Location</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Address</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Created By</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">PO Received Date</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">PO Expired Date</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">PO PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPOs.length > 0 ? (
                  filteredPOs.map((po) => (
                    <TableRow key={po.poNumber} className="hover:bg-accent/40 border-b border-border transition-colors">

                      {/* Action buttons */}
                      <TableCell className="pl-4 md:pl-6 py-4 text-left">
                        <div className="flex items-center gap-1.5 font-normal">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyPo(po)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                            title="Copy details"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditPoModal(po)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                            title="Edit details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(po.poNumber)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>

                      {/* Serial No */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground font-mono">
                        {po.serialNo || '-'}
                      </TableCell>

                      {/* PO Number */}
                      <TableCell className="py-4 text-left font-semibold text-primary text-xs sm:text-sm">
                        {po.poNumber}
                      </TableCell>

                      {/* Vendor Name */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm font-medium text-foreground">
                        {po.vendorName}
                      </TableCell>

                      {/* Total Quantity */}
                      <TableCell className="py-4 text-left font-bold text-xs sm:text-sm text-foreground">
                        {Number(po.totalQuantity || 0).toLocaleString()}
                      </TableCell>

                      {/* Location Badge */}
                      <TableCell className="py-4 text-left">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                          {po.location}
                        </span>
                      </TableCell>

                      {/* Address */}
                      <TableCell className="py-4 text-left text-xs text-muted-foreground max-w-[150px] truncate" title={po.address}>
                        {po.address}
                      </TableCell>

                      {/* Created By Staff */}
                      <TableCell className="py-4 text-left">
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {po.createdBy}
                        </span>
                      </TableCell>

                      {/* PO Received Date */}
                      <TableCell className="py-4 text-left">
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {po.poReceivedDate || formatTimestamp(po.timestamp)}
                        </span>
                      </TableCell>

                      {/* PO Expired Date */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground">
                        {po.poExpiredDate || '-'}
                      </TableCell>

                      {/* PO PDF */}
                      <TableCell className="py-4 text-left text-xs sm:text-sm text-muted-foreground">
                        {po.poPdfName ? (
                          String(po.poPdfName).startsWith('data:') ? (
                            <a
                              href={po.poPdfName}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                              <FilePlus2 className="h-3.5 w-3.5" />
                              View File
                            </a>
                          ) : String(po.poPdfName).startsWith('http') ? (
                            <a
                              href={po.poPdfName}
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
                              {po.poPdfName}
                            </span>
                          )
                        ) : '-'}
                      </TableCell>

                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center text-muted-foreground text-sm">
                      No purchase orders found. Click "Add PO" to generate your first record!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Generate PO Dialog Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()} className="sm:max-w-[700px] bg-card border-border shadow-xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmitPo}>
            <DialogHeader className="text-left mb-4">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <FilePlus2 className="h-5 w-5 text-primary" />
                {isEditing ? 'Edit Purchase Order' : 'Generate Purchase Order'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {isEditing 
                  ? ''
                  : 'Enter purchasing details to create a persistent purchase order record.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 py-2">
              
              {/* PO Number */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="poNumber" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  PO Number*
                </Label>
                <Input
                  id="poNumber"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="e.g. PO-2026-003"
                  className="rounded-xl bg-background border-input"
                  required
                />
              </div>

              {/* Vendor Name (Dropdown) */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="vendorName" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Vendor Name*
                </Label>
                {activeVendors.length > 0 ? (
                  <Select value={vendorName} onValueChange={handleVendorChange}>
                    <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {activeVendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.name} className="text-xs focus:bg-accent cursor-pointer">
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="vendorName"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="Type vendor name..."
                    className="rounded-xl bg-background border-input"
                    required
                  />
                )}
              </div>

              {/* Total Quantity */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="totalQuantity" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Total Quantity*
                </Label>
                <Input
                  id="totalQuantity"
                  type="number"
                  min="1"
                  value={totalQuantity}
                  onChange={(e) => setTotalQuantity(e.target.value)}
                  placeholder="e.g. 250"
                  className="rounded-xl bg-background border-input"
                  required
                />
              </div>

              {/* Location Dropdown + Inline constant adder */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center mb-0.5">
                  <Label htmlFor="location" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Location*
                  </Label>
                  {!isAddingLocInline && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocError('');
                        setNewLocationInput('');
                        setIsAddingLocInline(true);
                      }}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer focus:outline-none"
                    >
                      <Plus className="h-3 w-3" /> Add Location
                    </button>
                  )}
                </div>

                {isAddingLocInline ? (
                  <div className="space-y-2 p-3 rounded-xl border border-border bg-neutral-50/50 dark:bg-neutral-900/10 animate-in slide-in-from-top-1 duration-200">
                    <div className="flex gap-2">
                      <Input
                        value={newLocationInput}
                        onChange={(e) => setNewLocationInput(e.target.value)}
                        placeholder="e.g. BILASPUR"
                        className="rounded-xl bg-background border-input uppercase text-xs h-9 flex-1"
                        required
                      />
                      <Button
                        type="button"
                        onClick={handleAddLocationInline}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl px-3 h-9 cursor-pointer"
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddingLocInline(false)}
                        className="border-border hover:bg-accent text-xs rounded-xl px-3 h-9 cursor-pointer"
                      >
                        Cancel
                      </Button>
                    </div>
                    {locError && (
                      <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> {locError}
                      </p>
                    )}
                  </div>
                ) : locationNames.length > 0 ? (
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {locationNames.map((loc) => (
                        <SelectItem key={loc} value={loc} className="text-xs focus:bg-accent cursor-pointer">
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value.toUpperCase())}
                    placeholder="Type location e.g. BILASPUR"
                    className="rounded-xl bg-background border-input uppercase"
                    required
                  />
                )}
              </div>

              {/* Address - full width */}
              <div className="space-y-1.5 text-left sm:col-span-2">
                <Label htmlFor="address" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <Map className="h-3.5 w-3.5" />
                  Address*
                </Label>
                <textarea
                  id="address"
                  rows="2"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter shipping or delivery address..."
                  className="w-full min-w-0 rounded-xl border border-input bg-transparent px-3 py-2 text-xs sm:text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                  required
                />
              </div>

              {/* PO Received Date */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="poReceivedDate" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  PO Received Date
                </Label>
                <Input
                  id="poReceivedDate"
                  type="date"
                  value={poReceivedDate}
                  onChange={(e) => setPoReceivedDate(e.target.value)}
                  className="rounded-xl bg-background border-input"
                />
              </div>

              {/* PO Expired Date */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="poExpiredDate" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  PO Expired Date
                </Label>
                <Input
                  id="poExpiredDate"
                  type="date"
                  value={poExpiredDate}
                  onChange={(e) => setPoExpiredDate(e.target.value)}
                  className="rounded-xl bg-background border-input"
                />
              </div>

              {/* PO PDF - full width */}
              <div className="space-y-1.5 text-left sm:col-span-2">
                <Label htmlFor="poPdf" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                  <FilePlus2 className="h-3.5 w-3.5" />
                  PO PDF
                </Label>
                <Input
                  id="poPdf"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPoPdf(file);
                      setPoPdfName(file.name);
                    }
                  }}
                  className="rounded-xl bg-background border-input file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
                {poPdfName && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Selected: {poPdfName}
                  </p>
                )}
              </div>

            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="border-border hover:bg-accent rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Generate PO'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete Purchase Order
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-border hover:bg-accent rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl cursor-pointer"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
