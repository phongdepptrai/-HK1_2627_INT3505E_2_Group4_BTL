import { localDate, addDays, slotStart } from '../../../../packages/shared/time.js';

// Browser-only demo fixtures. Never send these accounts/passwords to a real service.
export const demoPassword = 'Demo@12345';
export function createFixtures(now = Date.now()) {
  const users = [
    {
      id: 'u-player',
      email: 'player@keosan.demo',
      fullName: 'Minh Anh',
      phone: '0900000000',
      role: 'CUSTOMER',
    },
    {
      id: 'u-owner',
      email: 'owner@keosan.demo',
      fullName: 'Quản lý sân',
      phone: '0900000001',
      role: 'OWNER',
    },
    {
      id: 'u-admin',
      email: 'admin@keosan.demo',
      fullName: 'Quản trị viên',
      phone: '0900000002',
      role: 'ADMIN',
    },
  ];
  const sports = [
    { id: 'football', name: 'Bóng đá' },
    { id: 'badminton', name: 'Cầu lông' },
    { id: 'tennis', name: 'Tennis' },
  ];
  const rows = [
    ['Thành Phát', 'Cầu Giấy', '2 Hoàng Minh Giám', 7, 350000, 'pitch-2'],
    ['Mỹ Đình', 'Nam Từ Liêm', 'Đường Lê Đức Thọ', 7, 300000, 'pitch-1'],
    ['Tây Hồ', 'Tây Hồ', 'Ngõ 264 Âu Cơ', 5, 250000, 'pitch-3'],
    ['Đại học Quốc gia', 'Cầu Giấy', '144 Xuân Thủy', 5, 200000, 'pitch-2'],
    ['Hà Đông', 'Hà Đông', 'Đường Tô Hiệu', 11, 600000, 'pitch-1'],
    ['Thanh Xuân', 'Thanh Xuân', 'Đường Nguyễn Xiển', 7, 280000, 'pitch-3'],
    ['Phạm Văn Đồng', 'Bắc Từ Liêm', 'Đường Phạm Văn Đồng', 7, 320000, 'pitch-1'],
    ['Yên Hòa', 'Cầu Giấy', 'Đường Trung Kính', 5, 220000, 'pitch-2'],
    ['Dương Nội', 'Hà Đông', 'Đường Lê Trọng Tấn', 11, 550000, 'pitch-3'],
  ];
  const venues = rows.map(([name, district, address, , , imageKey], i) => ({
    id: `20000000000000000000000${i + 1}`,
    ownerId: 'u-owner',
    name: `Sân bóng ${name}`,
    address: `${address}, ${district}, Hà Nội`,
    city: 'Hà Nội',
    district,
    description:
      'Mặt cỏ nhân tạo êm, không gian thoáng và hệ thống đèn sáng. Cùng đội bạn tập luyện, giao lưu và tận hưởng từng trận bóng.',
    openTime: '06:00',
    closeTime: '23:00',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'active',
    amenities: ['parking', 'lights', 'water', 'changing'],
    imageKey,
    version: 1,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  }));
  const courts = rows.map(([, , , teamSize, basePricePerHour, imageKey], i) => ({
    id: (i + 1).toString(16).padStart(24, '0'),
    venueId: venues[i].id,
    sportTypeId: 'football',
    name: i === 4 ? 'Sân số 3' : 'Sân số 1',
    teamSize,
    basePricePerHour,
    imageKey,
    description: 'Sân riêng biệt với lịch đặt độc lập, phù hợp cho cả đội giao lưu và tập luyện.',
    status: 'active',
    version: 1,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  }));
  for (let i = 0; i < 2; i++)
    courts.push({
      ...courts[4],
      id: (10 + i).toString(16).padStart(24, '0'),
      name: `Sân số ${i + 1}`,
      teamSize: 5,
      basePricePerHour: 250000 + i * 30000,
      imageKey: i ? 'pitch-3' : 'pitch-2',
    });
  const booking = (id, court, day, hour, status) => ({
    id,
    code: `KS-${id.slice(-4).toUpperCase()}`,
    userId: users[0].id,
    courtId: court.id,
    venueId: court.venueId,
    venueName: venues.find((v) => v.id === court.venueId).name,
    courtName: court.name,
    sportName: 'Bóng đá',
    teamSize: court.teamSize,
    address: venues.find((v) => v.id === court.venueId).address,
    imageKey: court.imageKey,
    contactName: users[0].fullName,
    contactPhone: users[0].phone,
    startTime: slotStart(day, hour),
    endTime: slotStart(day, hour + 1),
    totalPrice: court.basePricePerHour + (hour >= 17 && hour < 22 ? 100000 : 0),
    currency: 'VND',
    status,
    expiresAt: status === 'pending' ? new Date(now + 30 * 60000).toISOString() : null,
    note: 'Lịch mẫu để trải nghiệm giao diện.',
    paymentStatus: status === 'completed' ? 'paid' : 'unpaid',
    createdAt: new Date(now - 86400000).toISOString(),
    updatedAt: new Date(now).toISOString(),
  });
  const bookings = [
    booking('demo-completed', courts[9], addDays(localDate(now), -1), 18, 'completed'),
    booking('demo-confirmed', courts[10], addDays(localDate(now), 1), 19, 'confirmed'),
    booking('demo-pending', courts[4], addDays(localDate(now), 1), 20, 'pending'),
    booking('demo-ready', courts[0], addDays(localDate(now), -1), 18, 'confirmed'),
  ];
  const payments = [
    {
      id: 'demo-paid',
      bookingId: bookings[0].id,
      amount: bookings[0].totalPrice,
      currency: 'VND',
      method: 'bank_transfer',
      status: 'succeeded',
      transactionRef: 'DEMO-PAID',
      paidAt: new Date(now - 86400000).toISOString(),
      createdAt: new Date(now - 86400000).toISOString(),
      checkoutUrl: null,
    },
  ];
  return { users, sports, venues, courts, bookings, payments, reviews: [] };
}
