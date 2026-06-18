import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AVAILABLE_PAGES, AVAILABLE_ROLES } from '@/utils/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  UserPlus, 
  Edit2, 
  Search, 
  Mail, 
  Lock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Building2, 
  Phone, 
  Trash2, 
  Sliders, 
  Briefcase, 
  LayoutDashboard, 
  Settings, 
  FileText, 
  Receipt, 
  PackageCheck, 
  Truck, 
  Printer, 
  ClipboardCheck, 
  CheckSquare, 
  CreditCard, 
  Package
} from 'lucide-react';

const SEED_VENDORS = [
  {
    id: '1',
    name: 'Blinkit',
    phone: '9876543210'
  },
  {
    id: '2',
    name: 'Zepto',
    phone: '9876543211'
  },
  {
    id: '1781765658987',
    name: 'Instamart',
    phone: '9876543210'
  }
];

const PAGE_ICON_MAP = {
  'Dashboard': LayoutDashboard,
  'Settings': Settings,
  'Generate PO': FileText,
  'Create Bill': Receipt,
  'Ready Product': PackageCheck,
  'Check Transport': Truck,
  'Print Invoice': Printer,
  'Supply Check': ClipboardCheck,
  'Approve Product': CheckSquare,
  'Payment Processing': CreditCard
};

export function SettingsPage() {
  const { users, currentUser, addUser, updateUser } = useAuth();
  const { toast } = useToast();

  // Tab State: 'staff' or 'vendors'
  const [activeTab, setActiveTab] = useState('staff');
  
  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');

  // ----------------------------------------------------
  // STAFF MANAGEMENT STATE & HANDLERS
  // ----------------------------------------------------
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [currentId, setCurrentId] = useState('');
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('USER');
  const [formStatus, setFormStatus] = useState('Active');
  const [formPageAccess, setFormPageAccess] = useState(['Dashboard']);
  const [showPassword, setShowPassword] = useState(false);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setCurrentId('');
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('USER');
    setFormStatus('Active');
    setFormPageAccess(['Dashboard']);
    setErrorMsg('');
    setShowPassword(false);
    setIsOpen(true);
  };

  const handleOpenEditModal = (user) => {
    setIsEditing(true);
    setCurrentId(user.id);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPassword(user.password || '');
    setFormEmail(user.email);
    setFormPhone(user.phone || '');
    setFormRole(user.role);
    setFormStatus(user.status);
    setFormPageAccess(user.pageAccess || []);
    setErrorMsg('');
    setShowPassword(false);
    setIsOpen(true);
  };

  const handlePageAccessChange = (page, checked) => {
    if (checked) {
      setFormPageAccess([...formPageAccess, page]);
    } else {
      setFormPageAccess(formPageAccess.filter(p => p !== page));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formName || !formUsername || !formPassword || !formEmail) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const exists = users.some(u => u.id !== currentId && u.username.toLowerCase() === formUsername.toLowerCase());
    if (exists) {
      setErrorMsg('Username is already taken.');
      return;
    }

    if (formPhone) {
      const phoneRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
      if (!phoneRegex.test(formPhone.replace(/\s+/g, ''))) {
        setErrorMsg('Please enter a valid 10-digit Indian phone number.');
        return;
      }
    }

    const userData = {
      name: formName,
      username: formUsername,
      password: formPassword,
      email: formEmail,
      phone: formPhone,
      role: formRole,
      status: formStatus,
      pageAccess: formPageAccess
    };

    if (isEditing) {
      updateUser({ ...userData, id: currentId });
      toast('Staff record updated successfully!', 'success');
    } else {
      addUser(userData);
      toast('Staff record registered successfully!', 'success');
    }

    setIsOpen(false);
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ----------------------------------------------------
  // VENDOR DIRECTORY STATE & HANDLERS
  // ----------------------------------------------------
  const [vendors, setVendors] = useLocalStorage('procureflow_vendors', SEED_VENDORS);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isEditingVendor, setIsEditingVendor] = useState(false);
  const [vendorErrorMsg, setVendorErrorMsg] = useState('');

  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');

  const handleOpenAddVendorModal = () => {
    setIsEditingVendor(false);
    setVendorId('');
    setVendorName('');
    setVendorPhone('');
    setVendorErrorMsg('');
    setIsVendorModalOpen(true);
  };

  const handleOpenEditVendorModal = (vendor) => {
    setIsEditingVendor(true);
    setVendorId(vendor.id);
    setVendorName(vendor.name);
    setVendorPhone(vendor.phone || '');
    setVendorErrorMsg('');
    setIsVendorModalOpen(true);
  };

  const handleSubmitVendor = (e) => {
    e.preventDefault();
    setVendorErrorMsg('');

    if (!vendorName.trim()) {
      setVendorErrorMsg('Please fill in the Vendor Name.');
      return;
    }

    if (vendorPhone.trim()) {
      const phoneRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
      if (!phoneRegex.test(vendorPhone.replace(/\s+/g, ''))) {
        setVendorErrorMsg('Please enter a valid 10-digit Indian phone number.');
        return;
      }
    }

    const nameExists = vendors.some(
      v => v.id !== vendorId && v.name.trim().toLowerCase() === vendorName.trim().toLowerCase()
    );
    if (nameExists) {
      setVendorErrorMsg('Vendor Name is already registered.');
      return;
    }

    const vendorData = {
      id: vendorId || Date.now().toString(),
      name: vendorName.trim(),
      phone: vendorPhone.trim()
    };

    if (isEditingVendor) {
      setVendors(vendors.map(v => v.id === vendorId ? vendorData : v));
      toast(`Vendor "${vendorName.trim()}" updated successfully!`, 'success');
    } else {
      setVendors([...vendors, vendorData]);
      toast(`Vendor "${vendorName.trim()}" registered successfully!`, 'success');
    }

    setIsVendorModalOpen(false);
  };

  const handleDeleteVendor = (id) => {
    const targetVendor = vendors.find(v => v.id === id);
    const name = targetVendor ? targetVendor.name : id;
    if (window.confirm(`Are you sure you want to delete vendor "${name}"?`)) {
      setVendors(vendors.filter(v => v.id !== id));
      toast(`Vendor "${name}" deleted successfully.`, 'success');
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(vendorSearchTerm.toLowerCase()) ||
    v.phone.toLowerCase().includes(vendorSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {activeTab === 'staff' ? 'User Settings' : 'Vendor Settings'}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {activeTab === 'staff'
              ? 'Manage your procurement staff records, system roles, and page access privileges.'
              : 'Manage registered suppliers and their contact telephone numbers.'}
          </p>
        </div>

        {activeTab === 'staff' && (
          <Button 
            onClick={handleOpenAddModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 self-start sm:self-center rounded-xl cursor-pointer shadow-sm text-xs sm:text-sm h-10 px-4"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        )}
        {activeTab === 'vendors' && (
          <Button 
            onClick={handleOpenAddVendorModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 self-start sm:self-center rounded-xl cursor-pointer shadow-sm text-xs sm:text-sm h-10 px-4"
          >
            <Building2 className="h-4 w-4" />
            Add Vendor
          </Button>
        )}
      </div>

      {/* Tabs Selector Bar */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 cursor-pointer ${
            activeTab === 'staff'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Staff Access
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 cursor-pointer ${
            activeTab === 'vendors'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Manage Vendors
        </button>
      </div>

      {/* STAFF MANAGEMENT CONTENT */}
      {activeTab === 'staff' && (
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardHeader className="py-4 px-4 md:px-6 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, email, role..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background text-xs sm:text-sm h-9 max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground text-left sm:text-right flex items-center justify-start sm:justify-end">
              Total records: {filteredUsers.length}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                  <TableRow>
                    <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">Staff Details</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Role</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-center">Status</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-right pr-4 md:pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-accent/40 border-b border-border transition-colors">
                        
                        <TableCell className="pl-4 md:pl-6 py-4 text-left">
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full bg-accent text-accent-foreground text-[10px] sm:text-xs flex items-center justify-center font-bold">
                              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-[100px] sm:max-w-none">{user.name}</span>
                              <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate max-w-[100px] sm:max-w-none">@{user.username}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-4 text-left">
                          <div className="flex flex-col space-y-0.5 sm:space-y-1">
                            <span className="text-xs sm:text-sm font-medium text-foreground">{user.role}</span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[120px] sm:max-w-none">
                              <Mail className="h-3 w-3 shrink-0" />
                              {user.email}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-4 text-center">
                          {user.status === 'Active' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-900/20 border border-border text-muted-foreground">
                              <XCircle className="h-3.5 w-3.5" />
                              Inactive
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="py-4 text-right pr-4 md:pr-6">
                          <div className="flex items-center justify-end gap-1.5 font-normal">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenEditModal(user)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                              title="Edit User"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>

                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-12 text-center text-muted-foreground text-sm">
                        No users match your search query.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VENDOR DIRECTORY CONTENT */}
      {activeTab === 'vendors' && (
        <Card className="border-border bg-card shadow-sm rounded-2xl">
          <CardHeader className="py-4 px-4 md:px-6 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by vendor name or phone..." 
                value={vendorSearchTerm}
                onChange={(e) => setVendorSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-input bg-background text-xs sm:text-sm h-9 max-w-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground text-left sm:text-right flex items-center justify-start sm:justify-end">
              Total vendors: {filteredVendors.length}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader className="bg-neutral-50/50 dark:bg-neutral-900/10 border-b border-border">
                  <TableRow>
                    <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider pl-4 md:pl-6 py-3 text-left">Vendor Name</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-left">Phone Number</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-bold uppercase tracking-wider py-3 text-right pr-4 md:pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.length > 0 ? (
                    filteredVendors.map((vendor) => (
                      <TableRow key={vendor.id} className="hover:bg-accent/40 border-b border-border transition-colors">
                        
                        {/* Vendor Name */}
                        <TableCell className="pl-4 md:pl-6 py-4 text-left">
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full bg-accent text-accent-foreground text-[10px] sm:text-xs flex items-center justify-center font-bold">
                              {vendor.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <span className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-[180px] sm:max-w-none">
                              {vendor.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Phone Number */}
                        <TableCell className="py-4 text-left">
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {vendor.phone}
                          </span>
                        </TableCell>

                         {/* Actions */}
                        <TableCell className="py-4 text-right pr-4 md:pr-6">
                          <div className="flex items-center justify-end gap-1.5 font-normal">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenEditVendorModal(vendor)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
                              title="Edit Vendor"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>

                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-12 text-center text-muted-foreground text-sm">
                        No vendors match your search query.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

       {/* STAFF ACCESS DIALOG MODAL */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()} className="sm:max-w-[750px] bg-card border-border shadow-xl rounded-2xl p-6 max-h-[calc(100vh-40px)] flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden min-h-0">
            <DialogHeader className="text-left mb-4 shrink-0">
              <DialogTitle className="text-xl font-bold text-foreground">
                {isEditing ? 'Modify User Profile' : 'Register New User'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {isEditing 
                  ? 'Update staff roles, personal contact details, and core platform permissions.' 
                  : 'Create a new staff member profile to grant access to ProcureFlow.'}
              </DialogDescription>
            </DialogHeader>

            {errorMsg && (
              <div className="mb-4 p-3 bg-destructive/5 border border-destructive/10 text-destructive rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200 shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4 py-2 overflow-y-auto pr-1.5 text-left flex-1 min-h-0">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="form-name" className="text-xs font-semibold text-muted-foreground pl-0.5">
                    Full Name*
                  </Label>
                  <Input
                    id="form-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Rachel Adams"
                    className="rounded-xl bg-background border-input"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="form-username" className="text-xs font-semibold text-muted-foreground pl-0.5">
                    Username*
                  </Label>
                  <Input
                    id="form-username"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="e.g. rachel.adams"
                    className="rounded-xl bg-background border-input"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="form-email" className="text-xs font-semibold text-muted-foreground pl-0.5">
                    Email Address*
                  </Label>
                  <Input
                    id="form-email"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="rachel@procureflow.com"
                    className="rounded-xl bg-background border-input"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="form-phone" className="text-xs font-semibold text-muted-foreground pl-0.5">
                    Phone Number
                  </Label>
                  <Input
                    id="form-phone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="rounded-xl bg-background border-input"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="form-password" className="text-xs font-semibold text-muted-foreground pl-0.5 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Password*
                  </Label>
                  <div className="relative">
                    <Input
                      id="form-password"
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="••••••••"
                      className="rounded-xl bg-background border-input pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* System Role */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="form-role" className="text-xs font-semibold text-muted-foreground pl-0.5">
                    System Role
                  </Label>
                  <Select value={formRole} onValueChange={setFormRole}>
                    <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {AVAILABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role} className="text-xs focus:bg-accent cursor-pointer">
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Account Status */}
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="form-status" className="text-xs font-semibold text-muted-foreground pl-0.5">
                    Account Status
                  </Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger className="w-full border-input rounded-xl bg-background text-left text-xs h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="Active" className="text-xs focus:bg-accent cursor-pointer">Active</SelectItem>
                      <SelectItem value="Inactive" className="text-xs focus:bg-accent cursor-pointer" disabled={currentUser?.id === currentId}>
                        Inactive
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl border border-border bg-neutral-50/50 dark:bg-neutral-900/10 space-y-3.5 text-left">
                <div>
                  <Label className="text-xs font-bold text-foreground">Page Access Permissions</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Configure visibility permissions for individual screen pages.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 pt-1">
                  {AVAILABLE_PAGES.map((page) => {
                    const isChecked = formPageAccess.includes(page);
                    const isSelfSettings = currentUser?.id === currentId && page === 'Settings';
                    return (
                      <div key={page} className="flex items-center space-x-2.5 py-1">
                        <Checkbox
                          id={`page-${page}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => handlePageAccessChange(page, !!checked)}
                          disabled={isSelfSettings}
                          className="rounded-md h-4 w-4 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground cursor-pointer"
                        />
                        <label
                          htmlFor={`page-${page}`}
                          className={`text-xs font-semibold text-foreground leading-none select-none transition-colors ${
                            isSelfSettings 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'cursor-pointer hover:text-primary'
                          }`}
                        >
                          {page}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            <DialogFooter className="mt-6 gap-2 shrink-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                className="border-border hover:bg-accent rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl cursor-pointer"
              >
                {isEditing ? 'Save Changes' : 'Create Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VENDOR DIRECTORY DIALOG MODAL */}
      <Dialog open={isVendorModalOpen} onOpenChange={setIsVendorModalOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()} className="sm:max-w-[400px] bg-card border-border shadow-xl rounded-2xl p-6">
          <form onSubmit={handleSubmitVendor}>
            <DialogHeader className="text-left mb-4">
              <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {isEditingVendor ? 'Modify Vendor Profile' : 'Register New Vendor'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {isEditingVendor 
                  ? 'Update supplier phone contact details.' 
                  : 'Establish a new supplier record inside the local directory.'}
              </DialogDescription>
            </DialogHeader>

            {vendorErrorMsg && (
              <div className="mb-4 p-3 bg-destructive/5 border border-destructive/10 text-destructive rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{vendorErrorMsg}</span>
              </div>
            )}

            <div className="space-y-4 py-2">
              
              {/* Vendor Name */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="vendor-name" className="text-xs font-semibold text-muted-foreground pl-0.5">
                  Vendor Name*
                </Label>
                <Input
                  id="vendor-name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Raipur Steel Enterprises"
                  className="rounded-xl bg-background border-input"
                  required
                />
              </div>

              {/* Vendor Phone */}
              <div className="space-y-1.5 text-left">
                <Label htmlFor="vendor-phone" className="text-xs font-semibold text-muted-foreground pl-0.5">
                  Phone Number
                </Label>
                <Input
                  id="vendor-phone"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="rounded-xl bg-background border-input"
                />
              </div>

            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsVendorModalOpen(false)}
                className="border-border hover:bg-accent rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl cursor-pointer"
              >
                {isEditingVendor ? 'Save Changes' : 'Create Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
