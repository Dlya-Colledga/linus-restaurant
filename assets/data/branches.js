'use strict';
(() => {
  const branches = [
  {
    id: 'chuy', name: 'проспект Чуй',
    address: 'проспект Чуй, 388 (Бишкек)',
    image: 'https://placehold.co/1800x1400/464037/e9e2d4/png?text=CHUY+AVENUE',
    popular: [['Kernel Burger', 590], ['Root Steak', 1390], ['Arch Pasta', 690]],
    hours: {
      weekday: ['09:00','23:00'], weekend: ['10:00','00:00']
    }
  },
  {
    id: 'bishkek-park', name: 'Bishkek Park',
    address: 'ул. Киевская, 148, 2 этаж (Бишкек)',
    image: 'https://placehold.co/1800x1400/343b3b/e5e6e3/png?text=BISHKEK+PARK',
    popular: [['Tux Wings', 420], ['Open Source Fries', 290], ['Chocolate Kernel', 390]],
    hours: {
      weekday: ['10:00','22:00'], weekend: ['10:00','22:00']
    }
  },
  {
    id: 'asia-mall', name: 'Asia Mall',
    address: 'проспект Чынгыза Айтматова, 3, 3 этаж (Бишкек)',
    image: 'https://placehold.co/1800x1400/514638/eee2c9/png?text=ASIA+MALL',
    popular: [['Daemon Ramen', 490], ['Forked Rice Bowl', 580], ['Linux Mint Lemonade', 240]],
    hours: {
      weekday: ['10:00','22:00'], weekend: ['10:00','22:00']
    }
  },
  {
    id: 'abdrakhmanova', name: 'ул. Абдрахманова',
    address: 'ул. Абдрахманова, 13/1 (Балыкчы)',
    image: 'https://placehold.co/1800x1400/302d2c/e2d5c3/png?text=ABDRAKHMANOVA',
    popular: [['Root Steak', 1390], ['Gentoo Grill Chicken', 620], ['Mint OS Cheesecake', 370]],
    hours: {
      weekday: ['09:00','22:00'], weekend: ['10:00','23:00']
    }
  }
  ];
  window.LinusBranches = branches;
})();
