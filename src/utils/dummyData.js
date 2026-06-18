// Initial users dummy data
export const INITIAL_USERS = [
  {
    id: '1',
    name: 'Admin User',
    username: 'admin',
    password: 'admin123',
    email: 'admin@procureflow.com',
    phone: '8978987876',
    role: 'ADMIN',
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
    name: 'User One',
    username: 'userone',
    password: 'userone',
    email: 'userone@procureflow.com',
    phone: '9876545678',
    role: 'ADMIN',
    status: 'Active',
    dateJoined: '2026-02-10',
    pageAccess: [
      'Dashboard'
    ]
  },
  {
    id: '3',
    name: 'John Smith',
    username: 'johnsmith',
    password: 'password',
    email: 'john.smith@procureflow.com',
    phone: '8778586789',
    role: 'USER',
    status: 'Active',
    dateJoined: '2026-03-05',
    pageAccess: [
      'Dashboard',
      'Settings',
      'Ready Product',
      'Supply Check',
      'Print Invoice',
      'Create Bill',
      'Payment Processing',
      'Approve Product',
      'Check Transport',
      'Generate PO'
    ]
  },
  {
    id: '4',
    name: 'Sarah Jenkins',
    username: 'finance',
    password: 'password',
    email: 'sarah.j@procureflow.com',
    phone: '+1 (555) 041-8930',
    role: 'USER',
    status: 'Active',
    dateJoined: '2026-04-12',
    pageAccess: [
      'Dashboard'
    ]
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
