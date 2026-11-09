export const demoUsers = [
  {
    id: '100000000000000000000001',
    name: 'Minh Anh',
    email: 'player@keosan.demo',
    role: 'customer',
  },
  {
    id: '100000000000000000000002',
    name: 'Quản lý sân',
    email: 'owner@keosan.demo',
    role: 'owner',
  },
  {
    id: '100000000000000000000003',
    name: 'Tuấn Anh',
    email: 'other@keosan.demo',
    role: 'customer',
  },
];
export const DEMO_PASSWORD = 'Demo@12345';
const venueId = (number) => `200000000000000000000${number.toString(16).padStart(3, '0')}`;
export function seedVenues() {
  const rows = [
    [
      'Sân bóng Thành Phát',
      'Cầu Giấy',
      '2 Hoàng Minh Giám, Cầu Giấy, Hà Nội',
      7,
      350000,
      4.9,
      128,
      'pitch-1',
    ],
    [
      'Sân bóng Mỹ Đình',
      'Nam Từ Liêm',
      'Đường Lê Đức Thọ, Nam Từ Liêm, Hà Nội',
      7,
      300000,
      4.8,
      96,
      'pitch-2',
    ],
    ['Sân bóng Tây Hồ', 'Tây Hồ', 'Ngõ 264 Âu Cơ, Tây Hồ, Hà Nội', 5, 250000, 4.8, 84, 'pitch-3'],
    [
      'Sân bóng Đại học Quốc gia',
      'Cầu Giấy',
      '144 Xuân Thủy, Cầu Giấy, Hà Nội',
      5,
      200000,
      4.7,
      65,
      'pitch-2',
    ],
    [
      'Sân bóng Hà Đông',
      'Hà Đông',
      'Đường Tô Hiệu, Hà Đông, Hà Nội',
      11,
      600000,
      4.7,
      52,
      'pitch-1',
    ],
    [
      'Sân bóng Thanh Xuân',
      'Thanh Xuân',
      'Đường Nguyễn Xiển, Thanh Xuân, Hà Nội',
      7,
      280000,
      4.6,
      72,
      'pitch-3',
    ],
    [
      'Sân bóng Phạm Văn Đồng',
      'Bắc Từ Liêm',
      'Đường Phạm Văn Đồng, Bắc Từ Liêm, Hà Nội',
      7,
      320000,
      4.5,
      43,
      'pitch-1',
    ],
    [
      'Sân bóng Yên Hòa',
      'Cầu Giấy',
      'Đường Trung Kính, Cầu Giấy, Hà Nội',
      5,
      220000,
      4.5,
      37,
      'pitch-2',
    ],
    [
      'Sân bóng Dương Nội',
      'Hà Đông',
      'Đường Lê Trọng Tấn, Hà Đông, Hà Nội',
      11,
      550000,
      4.4,
      29,
      'pitch-3',
    ],
  ];
  return rows.map(
    ([name, district, address, type, price, rating, reviewCount, imageKey], index) => ({
      id: venueId(index + 1),
      ownerId: demoUsers[1].id,
      name,
      district,
      address,
      rating,
      reviewCount,
      imageKey,
      isActive: true,
      description:
        'Mặt cỏ nhân tạo êm, không gian thoáng và hệ thống đèn chiếu sáng cho những trận bóng buổi tối. Phù hợp để cả đội giao lưu, tập luyện và giữ nhịp đam mê mỗi tuần.',
      amenities: ['parking', 'lights', 'water', 'changing'],
      version: 1,
      createdAt: '2026-11-01T00:00:00.000Z',
    }),
  );
}

export function seedPitches() {
  const types = [7, 7, 5, 5, 11, 7, 7, 5, 11];
  const prices = [350000, 300000, 250000, 200000, 600000, 280000, 320000, 220000, 550000];
  const pitches = seedVenues().map((venue, index) => ({
    id: (index + 1).toString(16).padStart(24, '0'),
    venueId: venue.id,
    name: index === 4 ? 'Sân số 3' : 'Sân số 1',
    type: types[index],
    price: prices[index],
    description: `Sân ${types[index]} người riêng biệt, mặt cỏ nhân tạo và lịch đặt độc lập trong cơ sở.`,
    imageKey: venue.imageKey,
    isActive: true,
    version: 1,
    createdAt: '2026-11-01T00:00:00.000Z',
  }));
  for (let index = 0; index < 2; index++)
    pitches.push({
      ...pitches[4],
      id: (10 + index).toString(16).padStart(24, '0'),
      name: `Sân số ${index + 1}`,
      type: 5,
      price: 250000 + index * 30000,
      description: 'Sân 5 người riêng biệt tại cơ sở Hà Đông, có giá và lịch đặt độc lập.',
      imageKey: index === 0 ? 'pitch-2' : 'pitch-3',
    });
  return pitches;
}
