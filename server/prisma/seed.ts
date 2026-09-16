import { PrismaClient, Role, TaskStatus, TaskPriority } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Clean existing records in reverse order of foreign keys
  await prisma.notification.deleteMany();
  await prisma.taskActivityLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  // 2. Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const pmPassword = await bcrypt.hash('pm123', 10);
  const devPassword = await bcrypt.hash('dev123', 10);

  // 3. Create Users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@agency.com',
      passwordHash: adminPassword,
      name: 'Sarah Connor',
      username: 'sarah.admin',
      headline: 'Agency Director & Operations Head',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      role: Role.ADMIN,
    },
  });

  const pm1 = await prisma.user.create({
    data: {
      email: 'pm1@agency.com',
      passwordHash: pmPassword,
      name: 'Alex Johnson',
      username: 'alex.j',
      headline: 'Senior Technical Project Manager',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: Role.PM,
    },
  });

  const pm2 = await prisma.user.create({
    data: {
      email: 'pm2@agency.com',
      passwordHash: pmPassword,
      name: 'Elena Rostova',
      username: 'elena.r',
      headline: 'Product Lead & Agile Scrum Master',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      role: Role.PM,
    },
  });

  const dev1 = await prisma.user.create({
    data: {
      email: 'dev1@agency.com',
      passwordHash: devPassword,
      name: 'Ravi Kumar',
      username: 'ravi.k',
      headline: 'Senior Backend Engineer',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: Role.DEVELOPER,
    },
  });

  const dev2 = await prisma.user.create({
    data: {
      email: 'dev2@agency.com',
      passwordHash: devPassword,
      name: 'Marcus Chen',
      username: 'marcus.dev',
      headline: 'Full-Stack Developer & Cloud Architect',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      role: Role.DEVELOPER,
    },
  });

  const dev3 = await prisma.user.create({
    data: {
      email: 'dev3@agency.com',
      passwordHash: devPassword,
      name: 'Aisha Patel',
      username: 'aisha.p',
      headline: 'Staff UI/UX & Frontend Specialist',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      role: Role.DEVELOPER,
    },
  });

  const dev4 = await prisma.user.create({
    data: {
      email: 'dev4@agency.com',
      passwordHash: devPassword,
      name: 'Liam O\'Connor',
      username: 'liam.dev',
      headline: 'Mobile & Realtime Systems Engineer',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      role: Role.DEVELOPER,
    },
  });

  console.log('✅ Created 1 Admin, 2 PMs, 4 Developers');

  // 4. Create Clients
  const clientAcme = await prisma.client.create({
    data: {
      name: 'Acme Global Logistics',
      email: 'contact@acmelogistics.com',
      company: 'Acme Corp',
    },
  });

  const clientStark = await prisma.client.create({
    data: {
      name: 'Stark Enterprises',
      email: 'pepper@starkenterprises.com',
      company: 'Stark Industries',
    },
  });

  const clientWayne = await prisma.client.create({
    data: {
      name: 'Wayne Foundation',
      email: 'lucius@wayneenterprises.com',
      company: 'Wayne Enterprises',
    },
  });

  console.log('✅ Created 3 Clients');

  // 5. Create Projects
  const project1 = await prisma.project.create({
    data: {
      title: 'Global Supply Chain Portal',
      description: 'Real-time telemetry and container tracking for logistics operations.',
      clientId: clientAcme.id,
      createdBy: pm1.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      title: 'Arc Reactor Telemetry UI',
      description: 'Next-generation clean energy monitoring and heat distribution dashboard.',
      clientId: clientStark.id,
      createdBy: pm2.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      title: 'Gotham City Emergency Dispatch',
      description: 'High-availability public safety response coordination system.',
      clientId: clientWayne.id,
      createdBy: pm1.id,
    },
  });

  console.log('✅ Created 3 Projects (PM1 owns 2, PM2 owns 1)');

  const now = new Date();
  const pastDate1 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days ago
  const pastDate2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const futureDate1 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days ahead
  const futureDate2 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days ahead
  const futureDate3 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days ahead

  // 6. Create Tasks for Project 1 (Acme - PM1) - 6 tasks, including 1 OVERDUE
  const task1_1 = await prisma.task.create({
    data: {
      projectId: project1.id,
      assignedTo: dev1.id,
      title: 'Integrate GPS Webhook Ingestion',
      description: 'Ingest Kafka streams from cargo ships and format telemetry points.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: pastDate1,
      isOverdue: true, // OVERDUE TASK #1
    },
  });

  const task1_2 = await prisma.task.create({
    data: {
      projectId: project1.id,
      assignedTo: dev1.id,
      title: 'Fix Container Route Interpolation Bug',
      description: 'Map view glitches when ship crosses the international date line.',
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  const task1_3 = await prisma.task.create({
    data: {
      projectId: project1.id,
      assignedTo: dev2.id,
      title: 'Export Customs PDF Declarations',
      description: 'Generate compliance documents automatically upon harbor arrival.',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate2,
      isOverdue: false,
    },
  });

  const task1_4 = await prisma.task.create({
    data: {
      projectId: project1.id,
      assignedTo: dev2.id,
      title: 'Implement Multi-Currency Tariff Calculator',
      description: 'Calculate real-time import duties based on destination port.',
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      dueDate: pastDate2,
      isOverdue: false,
    },
  });

  const task1_5 = await prisma.task.create({
    data: {
      projectId: project1.id,
      assignedTo: dev1.id,
      title: 'Warehouse Inventory Sync API',
      description: 'Connect internal ERP inventory numbers with port cargo manifests.',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: futureDate3,
      isOverdue: false,
    },
  });

  const task1_6 = await prisma.task.create({
    data: {
      projectId: project1.id,
      assignedTo: dev2.id,
      title: 'Audit Cold-Chain Temperature Sensors',
      description: 'Alert dispatchers if vaccine transport temperature exceeds threshold.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  // 7. Create Tasks for Project 2 (Stark - PM2) - 5 tasks, including 1 OVERDUE
  const task2_1 = await prisma.task.create({
    data: {
      projectId: project2.id,
      assignedTo: dev3.id,
      title: 'Calibrate Core Thermal Sensors',
      description: 'Harmonize readings across 12 high-temp sensor nodes in sector 4.',
      status: TaskStatus.TODO,
      priority: TaskPriority.CRITICAL,
      dueDate: pastDate2,
      isOverdue: true, // OVERDUE TASK #2
    },
  });

  const task2_2 = await prisma.task.create({
    data: {
      projectId: project2.id,
      assignedTo: dev3.id,
      title: 'Sub-millisecond Feedback Control Loop',
      description: 'Optimize C++ binding latency for emergency cooling shutoff valves.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  const task2_3 = await prisma.task.create({
    data: {
      projectId: project2.id,
      assignedTo: dev4.id,
      title: 'JARVIS Voice Command Telemetry Bridge',
      description: 'Expose authenticated WebSocket channels for speech telemetry synthesis.',
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate2,
      isOverdue: false,
    },
  });

  const task2_4 = await prisma.task.create({
    data: {
      projectId: project2.id,
      assignedTo: dev4.id,
      title: 'Energy Grid Distribution Benchmark',
      description: 'Run load simulation comparing grid feed output against peak city demand.',
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      dueDate: pastDate1,
      isOverdue: false,
    },
  });

  const task2_5 = await prisma.task.create({
    data: {
      projectId: project2.id,
      assignedTo: dev3.id,
      title: 'Zero-Emission Safety Certification Audit',
      description: 'Produce immutable cryptographically signed safety reports for EPA.',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: futureDate3,
      isOverdue: false,
    },
  });

  // 8. Create Tasks for Project 3 (Wayne - PM1) - 5 tasks
  const task3_1 = await prisma.task.create({
    data: {
      projectId: project3.id,
      assignedTo: dev1.id,
      title: 'CAD System Geofence Routing',
      description: 'Route priority 1 distress calls to patrol units within a 2-mile radius.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  const task3_2 = await prisma.task.create({
    data: {
      projectId: project3.id,
      assignedTo: dev2.id,
      title: 'Helicopter Video Feed WebRTC Transcoder',
      description: 'Low-latency H.264 video feed ingestion directly to browser canvas.',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: futureDate2,
      isOverdue: false,
    },
  });

  const task3_3 = await prisma.task.create({
    data: {
      projectId: project3.id,
      assignedTo: dev1.id,
      title: 'Hospital Trauma Bay Availability Feed',
      description: 'Sync real-time ER bed and blood unit availability with dispatchers.',
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  const task3_4 = await prisma.task.create({
    data: {
      projectId: project3.id,
      assignedTo: dev2.id,
      title: 'Encrypted Radio Relay Health Monitor',
      description: 'Ping repeater stations across the city every 10 seconds.',
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      dueDate: pastDate1,
      isOverdue: false,
    },
  });

  const task3_5 = await prisma.task.create({
    data: {
      projectId: project3.id,
      assignedTo: dev4.id,
      title: 'Dispatch Console Dark Mode Ergonomics',
      description: 'Design high-contrast nighttime palette for dispatch operations center.',
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      dueDate: pastDate2,
      isOverdue: false,
    },
  });

  console.log('✅ Created 16 Tasks across 3 Projects (2 guaranteed Overdue)');

  // 9. Create Activity Logs
  const activityLogs = [
    {
      taskId: task1_2.id,
      userId: dev1.id,
      oldStatus: 'IN_PROGRESS',
      newStatus: 'IN_REVIEW',
      formattedMessage: 'Ravi Kumar moved Task "Fix Container Route Interpolation Bug" from IN_PROGRESS → IN_REVIEW',
      createdAt: new Date(now.getTime() - 45 * 60 * 1000), // 45 mins ago
    },
    {
      taskId: task1_4.id,
      userId: pm1.id,
      oldStatus: 'IN_REVIEW',
      newStatus: 'DONE',
      formattedMessage: 'Alex Johnson moved Task "Implement Multi-Currency Tariff Calculator" from IN_REVIEW → DONE',
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      taskId: task1_6.id,
      userId: dev2.id,
      oldStatus: 'TODO',
      newStatus: 'IN_PROGRESS',
      formattedMessage: 'Marcus Chen moved Task "Audit Cold-Chain Temperature Sensors" from TODO → IN_PROGRESS',
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
    },
    {
      taskId: task2_3.id,
      userId: dev4.id,
      oldStatus: 'IN_PROGRESS',
      newStatus: 'IN_REVIEW',
      formattedMessage: 'Liam O\'Connor moved Task "JARVIS Voice Command Telemetry Bridge" from IN_PROGRESS → IN_REVIEW',
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
    {
      taskId: task2_4.id,
      userId: pm2.id,
      oldStatus: 'IN_REVIEW',
      newStatus: 'DONE',
      formattedMessage: 'Elena Rostova moved Task "Energy Grid Distribution Benchmark" from IN_REVIEW → DONE',
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      taskId: task3_3.id,
      userId: dev1.id,
      oldStatus: 'IN_PROGRESS',
      newStatus: 'IN_REVIEW',
      formattedMessage: 'Ravi Kumar moved Task "Hospital Trauma Bay Availability Feed" from IN_PROGRESS → IN_REVIEW',
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
    {
      taskId: task3_4.id,
      userId: pm1.id,
      oldStatus: 'IN_REVIEW',
      newStatus: 'DONE',
      formattedMessage: 'Alex Johnson moved Task "Encrypted Radio Relay Health Monitor" from IN_REVIEW → DONE',
      createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    },
    {
      taskId: task3_1.id,
      userId: dev1.id,
      oldStatus: 'TODO',
      newStatus: 'IN_PROGRESS',
      formattedMessage: 'Ravi Kumar moved Task "CAD System Geofence Routing" from TODO → IN_PROGRESS',
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
    },
  ];

  for (const log of activityLogs) {
    await prisma.taskActivityLog.create({ data: log });
  }

  console.log(`✅ Seeded ${activityLogs.length} Task Activity Logs`);

  // 10. Create Notifications
  await prisma.notification.create({
    data: {
      userId: pm1.id,
      taskId: task1_2.id,
      title: 'Task Ready for Review',
      message: 'Ravi Kumar moved "Fix Container Route Interpolation Bug" to In Review.',
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: dev1.id,
      taskId: task1_1.id,
      title: 'Task Overdue Alert',
      message: 'Task "Integrate GPS Webhook Ingestion" is past its due date.',
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: dev2.id,
      taskId: task1_3.id,
      title: 'New Task Assigned',
      message: 'Alex Johnson assigned you "Export Customs PDF Declarations".',
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: pm2.id,
      taskId: task2_3.id,
      title: 'Task Ready for Review',
      message: 'Liam O\'Connor moved "JARVIS Voice Command Telemetry Bridge" to In Review.',
      isRead: false,
    },
  });

  console.log('✅ Seeded initial in-app Notifications');
  console.log('🚀 Database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
