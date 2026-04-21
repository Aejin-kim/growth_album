/**
 * Mock data for the Growth Journey album.
 * Includes photos from various years (2012-2026).
 */

export const mockPhotos = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&q=80&w=800",
    date: "2026-04-10",
    description: "생일 파티에서 케이크를 먹는 모습",
    isMilestone: true,
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&q=80&w=800",
    date: "2026-03-15",
    description: "봄나들이 공원에서 산책",
    isMilestone: false,
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1476703993599-0035a21b17a9?auto=format&q=80&w=800",
    date: "2025-12-25",
    description: "크리스마스 트리 앞에서의 미소",
    isMilestone: true,
  },
  {
    id: 4,
    url: "https://images.unsplash.com/photo-1511270339343-bcbb51a27012?auto=format&q=80&w=800",
    date: "2025-08-10",
    description: "여름 휴가 바다 여행",
    isMilestone: false,
  },
  {
    id: 5,
    url: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&q=80&w=800",
    date: "2024-05-20",
    description: "놀이공원에서 신나게 노는 날",
    isMilestone: true,
  },
  {
    id: 6,
    url: "https://images.unsplash.com/photo-1544126592-807daa2e5682?auto=format&q=80&w=800",
    date: "2023-11-11",
    description: "가을 단풍잎을 줍는 아이",
    isMilestone: false,
  },
  {
    id: 7,
    url: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&q=80&w=800",
    date: "2022-01-05",
    description: "첫 눈 오는 날의 풍경",
    isMilestone: true,
  },
  {
    id: 8,
    url: "https://images.unsplash.com/photo-1484665754804-74b091211472?auto=format&q=80&w=800",
    date: "2020-03-20",
    description: "집 앞 마당에서 물장난",
    isMilestone: false,
  },

  {
    id: 9,
    url: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&q=80&w=800",
    date: "2018-09-10",
    description: "아장아장 처음 걷기 시작한 날",
    isMilestone: true,
  },
  {
    id: 10,
    url: "https://images.unsplash.com/photo-1507567330391-1f394593d3d8?auto=format&fit=crop&q=80&w=800",
    date: "2015-06-12",
    description: "유모차 타고 공원 한 바퀴",
    isMilestone: false,
  },
  {
    id: 11,
    url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800",
    date: "2012-10-01",
    description: "우리의 시작, 첫 만남",
    isMilestone: true,
  },
];

/**
 * Groups photos by year.
 * @param {Array} photos - Array of photo objects.
 * @returns {Object} - Photos grouped by year.
 */
export const groupByYear = (photos) => {
  return photos.reduce((acc, photo) => {
    const year = new Date(photo.date).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(photo);
    return acc;
  }, {});
};
