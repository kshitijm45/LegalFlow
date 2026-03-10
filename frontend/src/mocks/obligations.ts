import type { Obligation } from '@/types'

export const mockObligations: Obligation[] = [
  {
    id: 'ob-1',
    title: 'Q1 SOC-2 Type II Report Submission',
    category: 'Compliance',
    documentId: 'doc-1',
    documentName: 'Tata Digital Ltd — MSA 2024',
    section: '§8.3 Security Certifications',
    dueDate: '2024-01-15',
    status: 'overdue',
    assignee: 'Ananya Krishnan',
    counterparty: 'Tata Digital Ltd',
    sourceClause: 'Vendor shall provide Customer with a SOC-2 Type II report within thirty (30) days of each quarter end, certifying that Vendor\'s security controls meet industry standards. Failure to provide such report shall constitute a material breach.',
    reminders: [
      { id: 'r1', type: 'email', timing: '7 days before', recipient: 'ananya.krishnan@mehtaiyer.com', enabled: true },
      { id: 'r2', type: 'email', timing: '1 day before', recipient: 'arjun.mehta@mehtaiyer.com', enabled: true },
      { id: 'r3', type: 'slack', timing: '3 days before', recipient: '#legal-team', enabled: false },
    ],
    activity: [
      { id: 'a1', text: 'Email reminder sent to ananya.krishnan@mehtaiyer.com (7 days before)', timestamp: '2024-01-08T09:00:00Z' },
      { id: 'a2', text: 'Email reminder sent to arjun.mehta@mehtaiyer.com (1 day before)', timestamp: '2024-01-14T09:00:00Z' },
      { id: 'a3', text: 'Obligation extracted from Tata Digital MSA §8.3', timestamp: '2024-01-02T14:30:00Z' },
      { id: 'a4', text: 'Assigned to Ananya Krishnan by Arjun Mehta', timestamp: '2024-01-02T14:35:00Z' },
    ],
  },
  {
    id: 'ob-2',
    title: 'DPDP Act Data Processing Addendum Renewal',
    category: 'Compliance',
    documentId: 'doc-3',
    documentName: 'Razorpay SaaS Agreement',
    section: '§12.1 Data Protection',
    dueDate: '2024-01-20',
    status: 'overdue',
    assignee: 'Rohan Desai',
    counterparty: 'Razorpay Software Pvt Ltd',
    sourceClause: 'The Data Processing Addendum, executed in compliance with the Digital Personal Data Protection Act, 2023, shall be reviewed and re-executed annually on or before the anniversary of the Effective Date.',
    reminders: [
      { id: 'r4', type: 'email', timing: '14 days before', recipient: 'rohan.desai@mehtaiyer.com', enabled: true },
    ],
    activity: [
      { id: 'a5', text: 'Email reminder sent to rohan.desai@mehtaiyer.com', timestamp: '2024-01-06T09:00:00Z' },
      { id: 'a6', text: 'Obligation extracted from Razorpay SaaS Agreement §12.1', timestamp: '2024-01-01T10:00:00Z' },
    ],
  },
  {
    id: 'ob-3',
    title: 'Insurance Certificate Delivery',
    category: 'Compliance',
    documentId: 'doc-5',
    documentName: 'Wipro Enterprises — SOW Q1',
    section: '§6.2 Insurance Requirements',
    dueDate: '2024-01-28',
    status: 'overdue',
    assignee: 'Arjun Mehta',
    counterparty: 'Wipro Enterprises Ltd',
    sourceClause: 'Vendor shall provide evidence of required insurance coverage, including professional indemnity and general liability policies, within fifteen (15) days of contract execution and annually thereafter.',
    reminders: [
      { id: 'r5', type: 'email', timing: '7 days before', recipient: 'arjun.mehta@mehtaiyer.com', enabled: true },
      { id: 'r6', type: 'slack', timing: '3 days before', recipient: '#compliance', enabled: true },
    ],
    activity: [
      { id: 'a7', text: 'Obligation extracted from Wipro SOW §6.2', timestamp: '2024-01-10T11:00:00Z' },
    ],
  },
  {
    id: 'ob-4',
    title: 'Quarterly Security Audit Report',
    category: 'Reporting',
    documentId: 'doc-8',
    documentName: 'HDFC Capital Advisors — DPA',
    section: '§9.4 Audit Rights',
    dueDate: '2024-02-05',
    status: 'pending',
    assignee: 'Kavya Nair',
    counterparty: 'HDFC Capital Advisors Ltd',
    sourceClause: 'Vendor shall conduct and deliver a security audit report to Customer within fifteen (15) business days after the end of each calendar quarter.',
    reminders: [
      { id: 'r7', type: 'email', timing: '7 days before', recipient: 'kavya.nair@mehtaiyer.com', enabled: true },
    ],
    activity: [
      { id: 'a8', text: 'Obligation extracted from HDFC Capital DPA §9.4', timestamp: '2024-01-20T09:30:00Z' },
    ],
  },
  {
    id: 'ob-5',
    title: 'Annual Contract Renewal Decision',
    category: 'Renewal',
    documentId: 'doc-1',
    documentName: 'Tata Digital Ltd — MSA 2024',
    section: '§3.1 Term and Renewal',
    dueDate: '2024-02-10',
    status: 'pending',
    assignee: 'Priya Iyer',
    counterparty: 'Tata Digital Ltd',
    sourceClause: 'Notice of non-renewal must be provided no later than sixty (60) days prior to the end of the current Term.',
    reminders: [
      { id: 'r8', type: 'email', timing: '14 days before', recipient: 'priya.iyer@mehtaiyer.com', enabled: true },
      { id: 'r9', type: 'email', timing: '3 days before', recipient: 'arjun.mehta@mehtaiyer.com', enabled: true },
    ],
    activity: [
      { id: 'a9', text: 'Obligation extracted from Tata Digital MSA §3.1', timestamp: '2024-01-15T14:00:00Z' },
      { id: 'a10', text: 'Assigned to Priya Iyer', timestamp: '2024-01-15T14:10:00Z' },
    ],
  },
  {
    id: 'ob-6',
    title: 'Monthly SLA Performance Report',
    category: 'Reporting',
    documentId: 'doc-4',
    documentName: 'Infosys BPM — Software License',
    section: '§7.2 Service Levels',
    dueDate: '2024-02-12',
    status: 'pending',
    assignee: 'Ananya Krishnan',
    counterparty: 'Infosys BPM Ltd',
    sourceClause: 'Vendor shall provide monthly SLA performance reports within five (5) business days after month-end.',
    reminders: [
      { id: 'r10', type: 'email', timing: '3 days before', recipient: 'ananya.krishnan@mehtaiyer.com', enabled: true },
    ],
    activity: [
      { id: 'a11', text: 'Obligation extracted from Infosys BPM License §7.2', timestamp: '2024-01-22T10:00:00Z' },
    ],
  },
  {
    id: 'ob-7',
    title: 'Q2 Payment Milestone — Razorpay',
    category: 'Payment',
    documentId: 'doc-3',
    documentName: 'Razorpay SaaS Agreement',
    section: '§4.1 Payment Terms',
    dueDate: '2024-03-01',
    status: 'pending',
    assignee: 'Vikram Kapoor',
    counterparty: 'Razorpay Software Pvt Ltd',
    sourceClause: 'Payment of ₹1,05,00,000 (Rupees One Crore Five Lakhs only) shall be due on the first day of each calendar quarter.',
    reminders: [
      { id: 'r11', type: 'email', timing: '7 days before', recipient: 'vikram.kapoor@mehtaiyer.com', enabled: true },
      { id: 'r12', type: 'slack', timing: '1 day before', recipient: '#finance-legal', enabled: true },
    ],
    activity: [
      { id: 'a12', text: 'Obligation extracted from Razorpay §4.1', timestamp: '2024-01-05T09:00:00Z' },
    ],
  },
  {
    id: 'ob-8',
    title: 'Annual Penetration Test Results',
    category: 'Compliance',
    documentId: 'doc-1',
    documentName: 'Tata Digital Ltd — MSA 2024',
    section: '§8.5 Security Testing',
    dueDate: '2024-03-15',
    status: 'pending',
    assignee: 'Rohan Desai',
    counterparty: 'Tata Digital Ltd',
    sourceClause: 'Vendor shall conduct annual penetration testing and provide Customer with a summary report within thirty (30) days of test completion.',
    reminders: [
      { id: 'r13', type: 'email', timing: '14 days before', recipient: 'rohan.desai@mehtaiyer.com', enabled: true },
    ],
    activity: [
      { id: 'a13', text: 'Obligation extracted from Tata Digital MSA §8.5', timestamp: '2024-01-15T14:00:00Z' },
    ],
  },
  {
    id: 'ob-9',
    title: 'Data Retention Policy Update',
    category: 'Compliance',
    documentId: 'doc-8',
    documentName: 'HDFC Capital Advisors — DPA',
    section: '§11.2 Data Retention',
    dueDate: '2024-03-30',
    status: 'pending',
    assignee: 'Kavya Nair',
    counterparty: 'HDFC Capital Advisors Ltd',
    sourceClause: 'Customer\'s data retention policy shall be reviewed and updated on an annual basis in accordance with applicable Indian data protection regulations.',
    reminders: [],
    activity: [],
  },
  {
    id: 'ob-10',
    title: 'Jio Cloud Services Renewal Decision',
    category: 'Renewal',
    documentId: 'doc-7',
    documentName: 'Jio Cloud Services — MSA Amendment No. 3',
    section: '§2.1 Renewal',
    dueDate: '2024-04-01',
    status: 'pending',
    assignee: 'Priya Iyer',
    counterparty: 'Jio Cloud Services Ltd',
    sourceClause: 'Notice of non-renewal must be provided ninety (90) days prior to the expiration date.',
    reminders: [
      { id: 'r14', type: 'email', timing: '30 days before', recipient: 'priya.iyer@mehtaiyer.com', enabled: true },
    ],
    activity: [],
  },
  {
    id: 'ob-11',
    title: 'Quarterly Compliance Report — Mahindra',
    category: 'Reporting',
    documentId: 'doc-6',
    documentName: 'Mahindra & Mahindra — Employment Agreement',
    section: '§14.3 Regulatory Compliance',
    dueDate: '2023-12-31',
    status: 'completed',
    assignee: 'Arjun Mehta',
    counterparty: 'Mahindra & Mahindra Ltd',
    sourceClause: 'Compliance reports shall be submitted quarterly to the relevant regulatory authority.',
    reminders: [],
    activity: [
      { id: 'a14', text: 'Marked as complete by Arjun Mehta', timestamp: '2023-12-28T16:00:00Z' },
    ],
  },
  {
    id: 'ob-12',
    title: 'Zepto Technologies NDA — Annual Review',
    category: 'Review',
    documentId: 'doc-2',
    documentName: 'Zepto Technologies NDA — Series B',
    section: '§5.1 Term',
    dueDate: '2024-01-05',
    status: 'completed',
    assignee: 'Vikram Kapoor',
    counterparty: 'Zepto Technologies Pvt Ltd',
    sourceClause: 'This NDA shall be reviewed annually for continued applicability.',
    reminders: [],
    activity: [
      { id: 'a15', text: 'Marked as complete by Vikram Kapoor', timestamp: '2024-01-04T11:30:00Z' },
    ],
  },
]

export const getObligationStats = () => {
  const overdue = mockObligations.filter((o) => o.status === 'overdue').length
  const pending = mockObligations.filter((o) => o.status === 'pending').length
  const completed = mockObligations.filter((o) => o.status === 'completed').length
  const total = mockObligations.filter((o) => o.status !== 'completed').length

  const now = new Date()
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const dueThisWeek = mockObligations.filter((o) => {
    if (o.status === 'completed') return false
    const due = new Date(o.dueDate)
    return due >= now && due <= oneWeekFromNow
  }).length

  return { total, overdue, pending, completed, dueThisWeek }
}
