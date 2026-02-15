export const categories = [
  // ROOT - Main consciousness
  { id: 1, name: 'Core Self', x: 0, y: 3.5, z: 0, dataCount: 20, children: [2, 3, 4, 5], date: '2024-01-01' },
  
  // LEVEL 1 - Major life quadrants
  { id: 2, name: 'Personal Life', x: -4, y: 2.5, z: 3, dataCount: 18, children: [6, 7, 8], date: '2024-02-01' },
  { id: 3, name: 'Professional', x: 4, y: 2.5, z: 3, dataCount: 16, children: [9, 10, 11], date: '2024-02-15' },
  { id: 4, name: 'Social World', x: -4, y: 2.5, z: -3, dataCount: 15, children: [12, 13], date: '2024-03-01' },
  { id: 5, name: 'Creative', x: 4, y: 2.5, z: -3, dataCount: 14, children: [14, 15], date: '2024-03-15' },
  
  // LEVEL 2 - Personal Life branches
  { id: 6, name: 'Family', x: -5.5, y: 1.2, z: 4.5, dataCount: 14, children: [16, 17, 18], date: '2024-04-01' },
  { id: 7, name: 'Health', x: -3.5, y: 1.2, z: 5, dataCount: 12, children: [19, 20], date: '2024-04-15' },
  { id: 8, name: 'Home', x: -2.5, y: 1.2, z: 3.5, dataCount: 10, children: [21], date: '2024-05-01' },
  
  // LEVEL 2 - Professional branches
  { id: 9, name: 'Current Job', x: 5, y: 1.2, z: 4.5, dataCount: 13, children: [22, 23], date: '2024-05-15' },
  { id: 10, name: 'Skills', x: 4.5, y: 1.2, z: 3, dataCount: 11, children: [24, 25], date: '2024-06-01' },
  { id: 11, name: 'Career Goals', x: 2.5, y: 1.2, z: 4, dataCount: 9, children: [26], date: '2024-06-15' },
  
  // LEVEL 2 - Social branches
  { id: 12, name: 'Friends', x: -5, y: 1.2, z: -4, dataCount: 12, children: [27, 28], date: '2024-07-01' },
  { id: 13, name: 'Community', x: -3, y: 1.2, z: -4.5, dataCount: 8, children: [29], date: '2024-07-15' },
  
  // LEVEL 2 - Creative branches
  { id: 14, name: 'Art', x: 5, y: 1.2, z: -4, dataCount: 11, children: [30, 31], date: '2024-08-01' },
  { id: 15, name: 'Hobbies', x: 3.5, y: 1.2, z: -4.5, dataCount: 10, children: [32], date: '2024-08-15' },
  
  // LEVEL 3 - Family sub-branches
  { id: 16, name: 'Childhood', x: -6.5, y: 0, z: 5.5, dataCount: 15, children: [33, 34], date: '2024-09-01' },
  { id: 17, name: 'Parents', x: -5.5, y: 0, z: 6, dataCount: 12, children: [35], date: '2024-09-15' },
  { id: 18, name: 'Siblings', x: -4.5, y: 0, z: 5.5, dataCount: 10, children: [], date: '2024-10-01' },
  
  // LEVEL 3 - Health sub-branches
  { id: 19, name: 'Fitness', x: -4, y: 0, z: 6, dataCount: 9, children: [36], date: '2024-10-15' },
  { id: 20, name: 'Nutrition', x: -3, y: 0, z: 6, dataCount: 7, children: [], date: '2024-11-01' },
  
  // LEVEL 3 - Home sub-branch
  { id: 21, name: 'Living Space', x: -2, y: 0, z: 4.5, dataCount: 8, children: [37], date: '2024-11-15' },
  
  // LEVEL 3 - Work sub-branches
  { id: 22, name: 'Projects', x: 6, y: 0, z: 5.5, dataCount: 12, children: [38], date: '2024-12-01' },
  { id: 23, name: 'Colleagues', x: 5, y: 0, z: 5, dataCount: 8, children: [], date: '2024-12-15' },
  
  // LEVEL 3 - Skills sub-branches
  { id: 24, name: 'Learning', x: 5.5, y: 0, z: 3.5, dataCount: 10, children: [39], date: '2024-01-01' },
  { id: 25, name: 'Certifications', x: 4, y: 0, z: 3, dataCount: 6, children: [], date: '2024-01-15' },
  
  // LEVEL 3 - Career Goals sub-branch
  { id: 26, name: 'Aspirations', x: 2, y: 0, z: 5, dataCount: 7, children: [], date: '2024-02-01' },
  
  // LEVEL 3 - Friends sub-branches
  { id: 27, name: 'Close Friends', x: -6, y: 0, z: -4.5, dataCount: 11, children: [40], date: '2024-02-15' },
  { id: 28, name: 'Social Events', x: -4.5, y: 0, z: -5, dataCount: 9, children: [], date: '2024-03-01' },
  
  // LEVEL 3 - Community sub-branch
  { id: 29, name: 'Volunteering', x: -2.5, y: 0, z: -5.5, dataCount: 6, children: [], date: '2024-03-15' },
  
  // LEVEL 3 - Art sub-branches
  { id: 30, name: 'Drawing', x: 6, y: 0, z: -4.5, dataCount: 10, children: [], date: '2024-04-01' },
  { id: 31, name: 'Music', x: 5, y: 0, z: -5, dataCount: 12, children: [41, 42], date: '2024-04-15' },
  
  // LEVEL 3 - Hobbies sub-branch
  { id: 32, name: 'Reading', x: 3, y: 0, z: -5.5, dataCount: 8, children: [43], date: '2024-05-01' },
  
  // LEVEL 4 - Deep memories
  { id: 33, name: 'School Days', x: -7.5, y: -1.2, z: 6.5, dataCount: 13, children: [], date: '2024-05-15' },
  { id: 34, name: 'Early Years', x: -6, y: -1.2, z: 6.5, dataCount: 14, children: [], date: '2024-06-01' },
  { id: 35, name: 'Family Stories', x: -5, y: -1.2, z: 7, dataCount: 11, children: [], date: '2024-06-15' },
  { id: 36, name: 'Workouts', x: -4.5, y: -1.2, z: 7, dataCount: 7, children: [], date: '2024-07-01' },
  { id: 37, name: 'Memories', x: -1.5, y: -1.2, z: 5.5, dataCount: 6, children: [], date: '2024-07-15' },
  { id: 38, name: 'Achievements', x: 6.5, y: -1.2, z: 6.5, dataCount: 11, children: [], date: '2024-08-01' },
  { id: 39, name: 'Courses', x: 6, y: -1.2, z: 4.5, dataCount: 9, children: [], date: '2024-08-15' },
  { id: 40, name: 'Shared Moments', x: -6.5, y: -1.2, z: -5.5, dataCount: 12, children: [], date: '2024-09-01' },
  { id: 41, name: 'Concerts', x: 5.5, y: -1.2, z: -6, dataCount: 10, children: [], date: '2024-09-15' },
  { id: 42, name: 'Practice', x: 4.5, y: -1.2, z: -5.5, dataCount: 8, children: [], date: '2024-10-01' },
  { id: 43, name: 'Books', x: 2.5, y: -1.2, z: -6.5, dataCount: 9, children: [], date: '2024-10-15' },
  
  // Additional scattered memories
  { id: 44, name: 'Travel', x: 0, y: 1.5, z: 4, dataCount: 16, children: [45, 46], date: '2024-11-01' },
  { id: 45, name: 'Summer Trips', x: 1, y: 0.2, z: 5, dataCount: 10, children: [], date: '2024-11-15' },
  { id: 46, name: 'Adventures', x: -1, y: 0.2, z: 5, dataCount: 9, children: [], date: '2024-12-01' },
  
  { id: 47, name: 'Spiritual', x: 0, y: 2, z: -4, dataCount: 11, children: [48], date: '2024-12-15' },
  { id: 48, name: 'Reflection', x: 0, y: 0.5, z: -5.5, dataCount: 7, children: [], date: '2024-01-01' },
  
  { id: 49, name: 'Education', x: 0, y: 1, z: 0, dataCount: 13, children: [50], date: '2024-01-15' },
  { id: 50, name: 'Studies', x: 0, y: -0.5, z: 0, dataCount: 8, children: [], date: '2024-02-01' },
];

export const dataItems = {
  1: {
    images: [
      { id: 'img1', thumbnail: '/api/placeholder/80/80', name: 'profile.jpg', date: '2024-01-01' },
    ],
    files: [
      { id: 'file1', name: 'about-me.txt', type: 'txt', size: '5 KB', date: '2024-01-01' },
    ]
  },
  2: {
    images: [
      { id: 'img2', thumbnail: '/api/placeholder/80/80', name: 'beach-sunset.jpg', date: '2024-06-15' },
      { id: 'img3', thumbnail: '/api/placeholder/80/80', name: 'pool-party.jpg', date: '2024-06-18' },
    ],
    files: [
      { id: 'file2', name: 'vacation-itinerary.pdf', type: 'pdf', size: '245 KB', date: '2024-06-14' },
    ]
  },
  3: {
    images: [
      { id: 'img4', thumbnail: '/api/placeholder/80/80', name: 'presentation.jpg', date: '2024-06-21' },
    ],
    files: [
      { id: 'file3', name: 'project-proposal.docx', type: 'docx', size: '1.2 MB', date: '2024-06-20' },
      { id: 'file4', name: 'meeting-notes.txt', type: 'txt', size: '15 KB', date: '2024-06-25' },
    ]
  }
};

export const queryOptions = [
  { id: 'recent', label: 'Show recent memories', icon: '🕐' },
  { id: 'category', label: 'Browse by category', icon: '📁' },
  { id: 'search', label: 'Search specific content', icon: '🔍' },
  { id: 'timeline', label: 'View timeline', icon: '📅' },
];
