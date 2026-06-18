// Initial users dummy data
export const INITIAL_USERS = [
  {
    id: '1',
    username: 'admin',
    password: 'password',
    name: 'Admin User',
    email: 'admin@procureflow.com',
    role: 'ADMIN',
    phone: '+1 (555) 019-2834',
    status: 'Active',
    dateJoined: '2026-01-15',
    pageAccess: [
      'Dashboard',
      'Settings',
      'Generate PO',
      'Create Bill',
      'Ready Product',
      'Check Transport',
      'Print Invoice',
      'Supply Check',
      'Approve Product',
      'Payment Processing'
    ]
  },
  {
    id: '2',
    username: 'manager',
    password: 'password',
    name: 'Jane Doe',
    email: 'jane.doe@procureflow.com',
    role: 'USER',
    phone: '+1 (555) 024-9182',
    status: 'Active',
    dateJoined: '2026-02-10',
    pageAccess: ['Dashboard']
  },
  {
    id: '3',
    username: 'buyer',
    password: 'password',
    name: 'John Smith',
    email: 'john.smith@procureflow.com',
    role: 'USER',
    phone: '+1 (555) 039-4821',
    status: 'Active',
    dateJoined: '2026-03-05',
    pageAccess: ['Dashboard']
  },
  {
    id: '4',
    username: 'finance',
    password: 'password',
    name: 'Sarah Jenkins',
    email: 'sarah.j@procureflow.com',
    role: 'USER',
    phone: '+1 (555) 041-8930',
    status: 'Inactive',
    dateJoined: '2026-04-12',
    pageAccess: ['Dashboard']
  }
];

// Initial purchase orders dummy data for Dashboard display
export const INITIAL_PURCHASE_ORDERS = [
  {
    id: 'PO-2026-001',
    supplier: 'Global Tech Corp',
    amount: 15420.00,
    status: 'Approved',
    date: '2026-06-01',
    itemsCount: 5,
    category: 'Hardware'
  },
  {
    id: 'PO-2026-002',
    supplier: 'OfficeDepot Solutions',
    amount: 2350.50,
    status: 'Pending',
    date: '2026-06-12',
    itemsCount: 12,
    category: 'Office Supplies'
  },
  {
    id: 'PO-2026-003',
    supplier: 'Apex Consulting Group',
    amount: 45000.00,
    status: 'Approved',
    date: '2026-06-14',
    itemsCount: 1,
    category: 'Services'
  },
  {
    id: 'PO-2026-004',
    supplier: 'Industrial Machinery Inc',
    amount: 128900.00,
    status: 'Pending',
    date: '2026-06-15',
    itemsCount: 3,
    category: 'Machinery'
  },
  {
    id: 'PO-2026-005',
    supplier: 'Delta Materials Co',
    amount: 8750.00,
    status: 'Rejected',
    date: '2026-06-16',
    itemsCount: 8,
    category: 'Raw Materials'
  },
  {
    id: 'PO-2026-006',
    supplier: 'Cloud hosting providers',
    amount: 3200.00,
    status: 'Draft',
    date: '2026-06-17',
    itemsCount: 2,
    category: 'Software'
  }
];

// Deprecated AVAILABLE_PAGES and AVAILABLE_ROLES constants removed. Imported from constants.js instead.
